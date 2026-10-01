"use client";

/**
 * API раздела «journal». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area';
 * сущности ядра — функции '@/api/core'. Экраны зовут эти функции через useApiQuery/useApiMutation.
 */
import { mutateArea, readArea, readCore } from "@/api/area";
import {
  getBookingPaymentSummary,
  payBookingQuick,
  payBookingSplit,
  recordPrepaymentRefundSync,
  refundBookingPayment,
  removeBookingPaymentLine,
} from "@/api/finance";
import { paymentGroupKey } from "@/domain/finance";
import {
  coreCreate,
  coreGet,
  coreTx,
  coreUpdate,
  createBooking,
  findClientByPhone,
  placeBooking,
  updateBooking,
} from "@/api/core";
import {
  computePackageSlots,
  setDayHours,
  type PackageOrder,
  type PackageServiceInput,
} from "@/api/schedule";
import { ApiError, request } from "@/api/request";
import { assertCan, currentActor } from "@/api/core";
import {
  cancelSaleOperation,
  computeLevels,
  createSaleOperation,
  type SalePaymentMethod,
} from "@/api/stock";
import { isApiMode } from "@/api/http";
import * as S from "@/api/journal.server";
import * as JM from "@/api/journal-more.server";
import { listServices as serverListServices } from "@/api/services.server";
import * as StockServer from "@/api/stock.server";
import type {
  Booking,
  BookingStatus,
  Client,
  CoreData,
  DayHours,
  ISODate,
  ISODateTime,
  Id,
  Money,
  Service,
  TimeHM,
} from "@/domain/core";
import type {
  AutoWriteoffInfo,
  BookingLacquer,
  BookingCategoryDef,
  BookingHistoryEntry,
  WindowDraftSnapshot,
  BookingExtras,
  BookingGoodsLine,
  ClientSubscriptionBalance,
  CustomFieldDef,
  DataOpsLogEntry,
  FavoriteSection,
  GoodsCatalogItem,
  JournalBlockRights,
  JournalLedgerCategory,
  JournalLedgerCounterpartyType,
  JournalLedgerEntry,
  JournalPaymentLine,
  JournalPaymentMethod,
  JournalPrefs,
  JournalSettings,
  JournalZoomMin,
  MedicalCard,
  MedicalVisitNote,
  PackageGroup,
  PackageOrderMode,
  QuickSaleRecord,
  RecurrenceRule,
  RecurrenceTemplate,
  StaffMarkupMin,
  StaffSet,
  DayLayout,
  TreatmentPlan,
  VisitGroupingMode,
  WindowRights,
} from "@/domain/journal";
import { EMPTY_BOOKING_EXTRAS, VISIT_GAP_OPTIONS } from "@/domain/journal";
import { hasBookingOverlap } from "@/domain/rules";
import { generateOccurrenceDates } from "@/areas/journal/lib/recurrence";
import { newId } from "@/lib/id";
import {
  combine,
  diffMinutes,
  eachDay,
  fromMinutes,
  nowDateTime,
  parse,
  toISODate,
  today,
  toMinutes,
  weekdayIndex,
} from "@/lib/date";
import { normalizeSearch } from "@/lib/text";
import { localDigits, normalizePhone } from "@/lib/phone";

// ─────────────────────────── Настройки (F-01-014, F-01-015, F-01-021) ───────────────────────────

/**
 * «Мои наборы» мастеров сотрудника (⭐ 29.09.2026) — личные, у каждого свои, на любом устройстве. Пока живут в срезе
 * журнала и в режиме api (сервер их ещё не хранит — перенос на сервер вместе с остальными настройками журнала).
 */
export function listStaffSets(staffId: Id): Promise<StaffSet[]> {
  return request(() => readArea("journal").staffSets?.[staffId] ?? []);
}

export function saveStaffSet(input: { staffId: Id; name: string; staffIds: Id[] }): Promise<StaffSet[]> {
  return request(
    () =>
      mutateArea("journal", (s) => {
        const list = (s.staffSets ??= {})[input.staffId] ?? [];
        s.staffSets[input.staffId] = [...list, { id: newId("set"), name: input.name.trim(), staffIds: input.staffIds }];
      }).staffSets[input.staffId],
  );
}

export function deleteStaffSet(input: { staffId: Id; setId: Id }): Promise<StaffSet[]> {
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.staffSets ??= {};
        s.staffSets[input.staffId] = (s.staffSets[input.staffId] ?? []).filter((x) => x.id !== input.setId);
      }).staffSets[input.staffId],
  );
}

/** Вид дня сотрудника (⭐ 29.09.2026) — личный, хранится рядом с наборами мастеров */
export function getDayLayout(staffId: Id): Promise<DayLayout> {
  return request(() => readArea("journal").dayLayouts?.[staffId] ?? "columns");
}

export function setDayLayout(input: { staffId: Id; layout: DayLayout }): Promise<DayLayout> {
  return request(
    () =>
      mutateArea("journal", (s) => {
        (s.dayLayouts ??= {})[input.staffId] = input.layout;
      }).dayLayouts[input.staffId],
  );
}

export function getJournalPrefs(): Promise<JournalPrefs> {
  if (isApiMode()) return S.getConfig().then(() => request(() => readArea("journal").prefs));
  return request(() => readArea("journal").prefs);
}

export function setJournalZoom(zoomMin: JournalZoomMin): Promise<JournalPrefs> {
  if (isApiMode()) return S.patchConfig({ zoomMin }).then(() => request(() => readArea("journal").prefs));
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.prefs.zoomMin = zoomMin;
      }).prefs,
  );
}

export function setJournalHiddenStatuses(
  hiddenStatuses: string[],
): Promise<JournalPrefs> {
  if (isApiMode()) return S.patchConfig({ hiddenStatuses }).then(() => request(() => readArea("journal").prefs));
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.prefs.hiddenStatuses = hiddenStatuses;
      }).prefs,
  );
}

/** F-01-133: как складывать перерывы визита из нескольких услуг — временно в шапке (см. domain/journal.ts) */
export function setBreakCombineMode(
  mode: "longest" | "sum",
): Promise<JournalPrefs> {
  if (isApiMode()) return S.patchConfig({ breakCombineMode: mode }).then(() => request(() => readArea("journal").prefs));
  return request(() => {
    // Настройка всего салона (F-01-174/175) — только с settings.manage (qa/full-test-0930/journal-perms.md)
    assertCan("settings.manage");
    return mutateArea("journal", (s) => {
      s.prefs.breakCombineMode = mode;
    }).prefs;
  });
}

/**
 * F-01-132: включить/выключить разделение записи по услугам с разными ресурсами. Настройка журнала
 * (F-01-174) — временно в шапке, как breakCombineMode выше (см. domain/journal.ts).
 */
export function setSplitByResourceEnabled(
  enabled: boolean,
): Promise<JournalPrefs> {
  if (isApiMode()) return S.patchConfig({ splitByResourceEnabled: enabled }).then(() => request(() => readArea("journal").prefs));
  return request(() => {
    // Настройка всего салона (F-01-174/175) — только с settings.manage (qa/full-test-0930/journal-perms.md)
    assertCan("settings.manage");
    return mutateArea("journal", (s) => {
      s.prefs.splitByResourceEnabled = enabled;
    }).prefs;
  });
}

/** Разметка сетки сотрудника (F-01-021); 0 = «Не выбрано» */
export function setStaffMarkup(
  staffId: Id,
  minutes: StaffMarkupMin | 0,
): Promise<JournalPrefs> {
  if (isApiMode()) return S.patchConfig({ staffMarkupMin: { [staffId]: minutes } }).then(() => request(() => readArea("journal").prefs));
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.prefs.staffMarkupMin[staffId] = minutes;
      }).prefs,
  );
}

/** Изменить длительность технического перерыва под записью (F-01-032); 0 = удалить перерыв. */
export function setBookingBreakOverride(
  bookingId: Id,
  minutes: number,
): Promise<JournalPrefs> {
  if (isApiMode()) return S.setBreakOverride(bookingId, minutes).then(() => request(() => readArea("journal").prefs));
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.prefs.breakOverrideMin[bookingId] = minutes;
      }).prefs,
  );
}

// ─────────────────────────── Настройки «Цифровой журнал» (F-01-155, F-01-165…180, пачка b05) ───────────────────────────

export function getJournalSettings(): Promise<JournalSettings> {
  if (isApiMode()) return S.getConfig().then((c) => c.settings);
  return request(() => readArea("journal").settings);
}

/** F-01-168: страница «Цифровой журнал» сохраняется целиком одной кнопкой */
export function setJournalSettings(
  patch: Partial<JournalSettings>,
): Promise<JournalSettings> {
  if (isApiMode()) return S.patchConfig({ settings: patch as JournalSettings }).then((c) => c.settings);
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.settings = { ...s.settings, ...patch };
      }).settings,
  );
}

/** F-01-172: интервал склейки визита — зеркало JournalWindowState.visitIntervalMin как режим настройки */
export function getVisitGroupingMode(): Promise<VisitGroupingMode> {
  if (isApiMode()) return S.getConfig().then((c) => visitModeOf(c.visitIntervalMin));
  return request(() => {
    const min = readArea("journal").visitIntervalMin;
    if (min === 0) return { kind: "perBooking" };
    if (min >= 1440) return { kind: "allDay" };
    const closest = VISIT_GAP_OPTIONS.reduce((best, v) =>
      Math.abs(v - min) < Math.abs(best - min) ? v : best,
    );
    return { kind: "gapMinutes", minutes: closest };
  });
}

export function setVisitGroupingMode(
  mode: VisitGroupingMode,
): Promise<VisitGroupingMode> {
  if (isApiMode()) return S.patchConfig({ visitIntervalMin: mode.kind === "perBooking" ? 0 : mode.kind === "allDay" ? 1440 : mode.minutes }).then(() => mode);
  return request(() => {
    const min =
      mode.kind === "perBooking" ? 0 : mode.kind === "allDay" ? 1440 : mode.minutes;
    mutateArea("journal", (s) => {
      s.visitIntervalMin = min;
    });
    return mode;
  });
}

// ─────────────────────────── Права блоков «Журнал записей» / «Окно записи» (F-01-178, F-01-179) ───────────────────────────

export function getStaffJournalRights(
  staffId: Id,
): Promise<Partial<JournalBlockRights> | undefined> {
  if (isApiMode()) return S.getConfig().then((c) => c.staffJournalRights[staffId]);
  return request(() => readArea("journal").staffJournalRights[staffId]);
}

export function setStaffJournalRights(
  staffId: Id,
  rights: JournalBlockRights,
): Promise<JournalBlockRights> {
  if (isApiMode()) return S.patchConfig({ staffJournalRights: { [staffId]: rights } }).then(() => rights);
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.staffJournalRights[staffId] = rights;
      }).staffJournalRights[staffId] as JournalBlockRights,
  );
}

export function getStaffWindowRights(
  staffId: Id,
): Promise<Partial<WindowRights> | undefined> {
  if (isApiMode()) return S.getConfig().then((c) => c.staffWindowRights[staffId]);
  return request(() => readArea("journal").staffWindowRights[staffId]);
}

export function setStaffWindowRights(
  staffId: Id,
  rights: WindowRights,
): Promise<WindowRights> {
  if (isApiMode()) return S.patchConfig({ staffWindowRights: { [staffId]: rights } }).then(() => rights);
  return request(
    () =>
      mutateArea("journal", (s) => {
        s.staffWindowRights[staffId] = rights;
      }).staffWindowRights[staffId] as WindowRights,
  );
}

// ─────────────────────────── Дублирование записи (F-01-192) ───────────────────────────

/**
 * F-01-192: копия записи без политики оплаты и депозита (справка 360426) — статус сбрасывается на
 * «Ожидает», оплата (extras.paidAmount) не переносится, состав услуг/товаров копируется.
 */
export async function duplicateBooking(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return S.duplicate(bookingId);
  const core = readCore();
  const source = core.bookings.find((b) => b.id === bookingId);
  if (!source) throw new ApiError("not_found", "Запись не найдена");
  // F-01-178: копия чужой записи без journal.others — то же, что создать запись в чужой колонке
  assertCan("journal.create", { targetStaffId: source.staffId });
  const extras = readArea("journal").extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
  const now = nowDateTime();
  const copy = await coreCreate("bookings", {
    businessId: source.businessId,
    locationId: source.locationId,
    staffId: source.staffId,
    clientId: source.clientId,
    appUserId: source.appUserId,
    start: source.start,
    durationMin: source.durationMin,
    status: "scheduled",
    services: source.services,
    total: source.total,
    resourceIds: source.resourceIds,
    workplace: source.workplace,
    source: "journal",
    createdBy: source.createdBy,
    forWhom: source.forWhom,
    visitorName: source.visitorName,
    comment: source.comment,
    createdAt: now,
    updatedAt: now,
  });
  mutateArea("journal", (s) => {
    s.extras[copy.id] = {
      ...EMPTY_BOOKING_EXTRAS,
      categoryIds: extras.categoryIds,
      colorIndex: extras.colorIndex,
      customFieldValues: extras.customFieldValues,
    };
  });
  return copy;
}

// ─────────────────────────── F-01-036: запись от бота/CRM через API ───────────────────────────

export interface ExternalBookingInput {
  businessId: Id;
  locationId?: Id;
  name: string;
  phone: string;
  serviceId: Id;
  /** Нет — «любой свободный» (подбирается сам среди назначенных на услугу мастеров, F-01-036) */
  staffId?: Id;
  start: ISODateTime;
}

/**
 * F-01-036: точка входа, которой пользуются ИИ-боты и внешние CRM через интеграции — та же
 * запись, что у обычного визита локации (единый поток placeBooking, rules/booking-flow), только
 * source: 'external'. Минимум — имя, телефон, услуга, мастер или «любой свободный», дата и время
 * (справка 380205); клиент с таким телефоном уже есть — визит уходит в его историю, находит его сам
 * placeBooking по номеру (F-00-128). Пока в разделе «Интеграции» нет реальных подключений (не наш
 * раздел, qa/requests/journal.md), сюда заходит демо-кнопка «Симулировать запись от бота» в
 * RecordsScreen — но сама функция ничем не отличается от того, что вызовет настоящий бот через наш API.
 */
export async function createExternalBooking(
  input: ExternalBookingInput,
): Promise<Booking> {
  if (isApiMode()) return S.external(input);
  const phone = input.phone.trim();
  if (!phone) {
    throw new ApiError(
      "phone_required",
      "Без номера телефона запись от бота или CRM создать нельзя",
    );
  }
  const name = input.name.trim();
  if (!name) throw new ApiError("name_required", "Укажите имя клиента");

  // computeOverlap/readCore читают базу напрямую — оборачиваем в request(), иначе mock-db предупреждает
  // «обращение к базе вне request()» (видно в консоли под demo, qa/measure ловит как ошибку/предупреждение).
  const staffId = await request(() => {
    const core = readCore();
    const service = core.services.find(
      (s) => s.id === input.serviceId && s.businessId === input.businessId,
    );
    if (!service) throw new ApiError("not_found", "Услуга не найдена");
    if (input.staffId) return input.staffId;
    const durationMin = service.durationMax ?? service.durationMin;
    const free = service.staffIds.find(
      (id) => !computeOverlap(core, id, input.start, durationMin),
    );
    if (!free) {
      throw new ApiError(
        "no_free_staff",
        "Нет свободного мастера на это время",
      );
    }
    return free;
  });

  const result = await placeBooking({
    source: "external",
    businessId: input.businessId,
    locationId: input.locationId,
    staffId,
    start: input.start,
    services: [{ serviceId: input.serviceId }],
    client: { phone, name },
    createdBy: "client",
  });
  return result.booking;
}

// ─────────────────────────── Рабочие часы (для сетки) ───────────────────────────

/** Объединение пересекающихся интервалов, отсортировано */
function mergeRanges(ranges: DayHours): DayHours {
  const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
  const out: DayHours = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to) last.to = r.to > last.to ? r.to : last.to;
    else out.push({ ...r });
  }
  return out;
}

/** Рабочие интервалы сотрудника на дату (объединение по всем его графикам, F-01-019/023) */
export function computeStaffHours(
  core: CoreData,
  staffId: Id,
  date: ISODate,
  locationId?: Id,
): DayHours {
  const schedules = core.schedules.filter(
    (s) =>
      s.staffId === staffId && (!locationId || s.locationId === locationId),
  );
  const ranges: DayHours = [];
  for (const sch of schedules) {
    const hours = sch.overrides[date] ?? sch.week[weekdayIndex(date)];
    ranges.push(...hours);
  }
  return mergeRanges(ranges);
}

export function getStaffWorkHours(
  staffId: Id,
  date: ISODate,
  locationId?: Id,
): Promise<DayHours> {
  if (isApiMode()) return JM.staffHours([staffId], date, date, locationId).then((m) => m[staffId]?.[date] ?? []);
  return request(() =>
    computeStaffHours(readCore(), staffId, date, locationId),
  );
}

/** Рабочие часы нескольких сотрудников на дату — одним запросом для сетки (F-01-019, F-01-023) */
export function getStaffHoursMap(
  staffIds: Id[],
  date: ISODate,
  locationId?: Id,
): Promise<Record<Id, DayHours>> {
  if (isApiMode())
    return JM.staffHours(staffIds, date, date, locationId).then((m) =>
      Object.fromEntries(staffIds.map((id) => [id, m[id]?.[date] ?? []])),
    );
  return request(() => {
    const core = readCore();
    const out: Record<Id, DayHours> = {};
    for (const staffId of staffIds)
      out[staffId] = computeStaffHours(core, staffId, date, locationId);
    return out;
  });
}

/** Часы одного сотрудника на 7 дней недели, начиная с weekStart (F-01-013) */
export function getWeekHours(
  staffId: Id,
  weekStart: ISODate,
  locationId?: Id,
): Promise<Record<ISODate, DayHours>> {
  if (isApiMode())
    return JM.staffHours([staffId], weekStart, toISODate(parse(weekStart).add(6, "day")), locationId).then((m) => m[staffId] ?? {});
  return request(() => {
    const core = readCore();
    const days = eachDay(weekStart, toISODate(parse(weekStart).add(6, "day")));
    const out: Record<ISODate, DayHours> = {};
    for (const date of days)
      out[date] = computeStaffHours(core, staffId, date, locationId);
    return out;
  });
}

/** Часы нескольких сотрудников на диапазон дат — одним запросом («Загрузка недели» журнала) */
export function getStaffHoursRange(
  staffIds: Id[],
  from: ISODate,
  to: ISODate,
  locationId?: Id,
): Promise<Record<Id, Record<ISODate, DayHours>>> {
  if (isApiMode()) return JM.staffHours(staffIds, from, to, locationId);
  return request(() => {
    const core = readCore();
    const days = eachDay(from, to);
    const out: Record<Id, Record<ISODate, DayHours>> = {};
    for (const staffId of staffIds) {
      const byDay: Record<ISODate, DayHours> = {};
      for (const date of days) byDay[date] = computeStaffHours(core, staffId, date, locationId);
      out[staffId] = byDay;
    }
    return out;
  });
}

/** Есть ли у сотрудника график в эту дату хоть где-то (для «пустого дня», F-01-018/019) */
export function hasScheduleOnDate(
  core: CoreData,
  staffId: Id,
  date: ISODate,
): boolean {
  return core.schedules.some((s) => {
    const hours = s.overrides[date] ?? s.week[weekdayIndex(date)];
    return s.staffId === staffId && hours.length > 0;
  });
}

// ─────────────────────────── Пересечения (F-01-034, F-01-215) ───────────────────────────

const INACTIVE = new Set(["cancelled_by_client", "cancelled_by_master"]);

/**
 * F-01-173: «Разрешить онлайн-запись поверх записей со статусом «Не пришел»» (включено по умолчанию,
 * DEFAULT_JOURNAL_SETTINGS.allowOverlapOverNoShow) — с настройкой включённой «Не пришёл» не блокирует
 * новую запись на то же время, как и отменённые (INACTIVE).
 */
function isOverlapBlockingStatus(
  status: BookingStatus,
  allowOverlapOverNoShow: boolean,
): boolean {
  if (INACTIVE.has(status)) return false;
  if (status === "no_show" && allowOverlapOverNoShow) return false;
  return true;
}

/** Тип своего среза — только для сигнатур чистых функций ниже (сам срез читается/пишется через readArea/mutateArea) */
type JournalArea = ReturnType<typeof readArea<"journal">>;

/** Занята ли запись мастера в это время другой активной записью (F-00-045: двойная запись невозможна) */
export function computeOverlap(
  core: CoreData,
  staffId: Id,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): boolean {
  const from = toMinutes(start.slice(11, 16));
  const to = from + durationMin;
  const day = start.slice(0, 10);
  const allowOverlapOverNoShow = readArea("journal").settings.allowOverlapOverNoShow;
  return core.bookings.some((b) => {
    if (b.id === excludeId || b.deletedAt || !isOverlapBlockingStatus(b.status, allowOverlapOverNoShow))
      return false;
    if (!b.start.startsWith(day)) return false;
    if (b.staffId !== staffId && !b.services.some((s) => s.staffId === staffId))
      return false;
    const bFrom = toMinutes(b.start.slice(11, 16));
    const bTo = bFrom + b.durationMin;
    return from < bTo && to > bFrom;
  });
}

export function hasOverlap(
  staffId: Id,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): Promise<boolean> {
  if (isApiMode()) return S.check({ staffId, start, durationMin, excludeBookingId: excludeId }).then((r) => r.overlap);
  return request(() =>
    computeOverlap(readCore(), staffId, start, durationMin, excludeId),
  );
}

/**
 * У клиента уже есть другая активная запись, которая пересекается с этим временем (у любого мастера салона) —
 * журнал предупреждает перед сохранением (сценарии 30.09: Эрик 17:00 и массаж 17:00 без предупреждения).
 * Режим api — та же проверка сервера (POST journal/check с clientId).
 */
export function findClientOverlap(
  clientId: Id,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): Promise<{ start: ISODateTime; staffId: Id; serviceId?: Id } | undefined> {
  if (isApiMode()) return S.check({ clientId, start, durationMin, excludeBookingId: excludeId }).then((r) => r.clientOverlap);
  return request(() => {
    const from = toMinutes(start.slice(11, 16));
    const to = from + durationMin;
    const day = start.slice(0, 10);
    const hit = readCore().bookings.find((b) => {
      if (b.id === excludeId || b.clientId !== clientId || b.deletedAt || !isOverlapBlockingStatus(b.status, true)) return false;
      if (!b.start.startsWith(day)) return false;
      const bFrom = toMinutes(b.start.slice(11, 16));
      return from < bFrom + b.durationMin && to > bFrom;
    });
    return hit ? { start: hit.start, staffId: hit.staffId, serviceId: hit.services[0]?.serviceId } : undefined;
  });
}

/**
 * ⭐ «Подтвердить завтра» (F-00-121): каким из этих клиентов напомнит Telegram-бот — номер привязан к боту
 * (в демо — отметка client.telegramLinked). Журнал помечает их «Напомнит Telegram», чтобы не писать второй раз.
 */
export function listTelegramLinkedClients(businessId: Id, clientIds: Id[]): Promise<Id[]> {
  if (isApiMode()) return S.telegramLinkedClients(businessId, clientIds);
  return request(() => {
    const linked = readArea("client").telegramLinked;
    const wanted = new Set(clientIds);
    return readCore()
      .clients.filter((c) => wanted.has(c.id) && c.businessId === businessId && c.phone && linked[c.phone])
      .map((c) => c.id);
  });
}

/** F-01-114: свободен ли экземпляр ресурса на новое время при переносе перетаскиванием */
export function hasResourceOverlap(
  resourceId: Id,
  instanceId: Id,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): Promise<boolean> {
  if (isApiMode()) return S.check({ resourceId, instanceId, start, durationMin, excludeBookingId: excludeId }).then((r) => !r.resourceFree);
  return request(
    () =>
      !computeResourceFree(
        readCore(),
        resourceId,
        instanceId,
        start,
        durationMin,
        excludeId,
      ),
  );
}

/**
 * F-01-046: экземпляры ресурсов локации, занятые на это время — используется полем «Ресурсы» окна
 * записи, чтобы не дать выбрать то же кресло/аппарат ещё раз (Готово-критерий «занятый экземпляр
 * ресурса нельзя выбрать на то же время»). Один проход по core.bookings вместо hasResourceOverlap на
 * каждый экземпляр по отдельности.
 */
export function listOccupiedResourceInstanceIds(
  locationId: Id,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): Promise<Set<Id>> {
  if (isApiMode()) return S.check({ locationId, start, durationMin, excludeBookingId: excludeId }).then((r) => new Set(r.occupiedInstanceIds));
  return request(() => {
    const core = readCore();
    const from = toMinutes(start.slice(11, 16));
    const to = from + durationMin;
    const day = start.slice(0, 10);
    const allowOverlapOverNoShow = readArea("journal").settings.allowOverlapOverNoShow;
    const occupied = new Set<Id>();
    for (const b of core.bookings) {
      if (
        b.id === excludeId ||
        b.deletedAt ||
        b.locationId !== locationId ||
        !isOverlapBlockingStatus(b.status, allowOverlapOverNoShow) ||
        !b.start.startsWith(day)
      )
        continue;
      const bFrom = toMinutes(b.start.slice(11, 16));
      const bTo = bFrom + b.durationMin;
      if (from < bTo && to > bFrom) {
        for (const id of b.resourceIds) occupied.add(id);
      }
    }
    return occupied;
  });
}

/** Входит ли [start, start+durationMin) целиком в рабочие часы сотрудника в эту дату (F-01-215) */
export function isWithinWorkingHours(
  staffId: Id,
  start: ISODateTime,
  durationMin: number,
): Promise<boolean> {
  if (isApiMode()) return S.check({ staffId, start, durationMin }).then((r) => r.withinHours);
  return request(() => {
    const core = readCore();
    const date = start.slice(0, 10);
    const hours = computeStaffHours(core, staffId, date);
    const from = toMinutes(start.slice(11, 16));
    const to = from + durationMin;
    return hours.some(
      (h) => toMinutes(h.from) <= from && to <= toMinutes(h.to),
    );
  });
}

/** Свободен ли конкретный экземпляр ресурса в это время (F-01-022, F-01-215) */
export function computeResourceFree(
  core: CoreData,
  resourceId: Id,
  instanceId: Id,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): boolean {
  const from = toMinutes(start.slice(11, 16));
  const to = from + durationMin;
  const day = start.slice(0, 10);
  const allowOverlapOverNoShow = readArea("journal").settings.allowOverlapOverNoShow;
  const busy = core.bookings.some((b) => {
    if (b.id === excludeId || b.deletedAt || !isOverlapBlockingStatus(b.status, allowOverlapOverNoShow))
      return false;
    if (!b.start.startsWith(day)) return false;
    if (!b.resourceIds.includes(instanceId)) return false;
    const bFrom = toMinutes(b.start.slice(11, 16));
    const bTo = bFrom + b.durationMin;
    return from < bTo && to > bFrom;
  });
  return !busy;
}

// ─────────────────────────── Загрузка дней (мини-календарь, F-01-003/004) ───────────────────────────

export interface DayLoad {
  /** Доля занятого рабочего времени (перерывы внутри записей не считаем, они малы) */
  ratio: number;
  /** Есть ли у кого-то из staffIds график в эту дату */
  hasSchedule: boolean;
}

function sumMinutes(hours: DayHours): number {
  return hours.reduce(
    (sum, r) => sum + (toMinutes(r.to) - toMinutes(r.from)),
    0,
  );
}

function computeDayLoad(
  core: CoreData,
  staffIds: Id[],
  date: ISODate,
): DayLoad {
  let worked = 0;
  let busy = 0;
  let hasSchedule = false;
  for (const staffId of staffIds) {
    const hours = computeStaffHours(core, staffId, date);
    if (hours.length > 0) hasSchedule = true;
    worked += sumMinutes(hours);
  }
  if (worked === 0) return { ratio: 0, hasSchedule };
  for (const b of core.bookings) {
    if (b.deletedAt || INACTIVE.has(b.status) || !b.start.startsWith(date))
      continue;
    if (!staffIds.includes(b.staffId)) continue;
    busy += b.durationMin;
  }
  return { ratio: Math.min(busy / worked, 1), hasSchedule };
}

/** Загрузка каждого дня диапазона [from, to] для набора сотрудников — для мини-календаря */
export function getRangeLoad(
  staffIds: Id[],
  from: ISODate,
  to: ISODate,
): Promise<Record<ISODate, DayLoad>> {
  if (isApiMode()) return JM.rangeLoad(staffIds, from, to);
  return request(() => {
    const core = readCore();
    const out: Record<ISODate, DayLoad> = {};
    for (const date of eachDay(from, to))
      out[date] = computeDayLoad(core, staffIds, date);
    return out;
  });
}

// ─────────────────────────── Окно записи: категории и свои поля (F-01-051, F-01-053) ───────────────────────────

export function getBookingCategories(): Promise<BookingCategoryDef[]> {
  if (isApiMode()) return S.getConfig().then((c) => c.bookingCategories);
  return request(() => readArea("journal").bookingCategories);
}

/** Новая своя категория записи (F-01-051) — системные четыре создавать/менять нельзя */
export function addBookingCategory(input: {
  name: string;
  colorIndex: number;
}): Promise<BookingCategoryDef> {
  if (isApiMode()) return S.addCategory(input);
  return request(() => {
    const def: BookingCategoryDef = {
      id: newId("bc"),
      name: input.name,
      colorIndex: input.colorIndex,
      system: false,
    };
    mutateArea("journal", (s) => {
      s.bookingCategories.push(def);
    });
    return def;
  });
}

export function getCustomFieldDefs(): Promise<CustomFieldDef[]> {
  if (isApiMode()) return S.getConfig().then((c) => c.customFieldDefs);
  return request(() => readArea("journal").customFieldDefs);
}

// ─────────────────────────── Закреплённые поля (F-01-048) ───────────────────────────

const DEFAULT_PINNED = ["comment"];

/** Закреплённые поля текущего пользователя (по id сотрудника — «у каждого пользователя свои») */
export function getPinnedFields(userKey: Id): Promise<string[]> {
  if (isApiMode()) return JM.prefs(userKey).then((p) => p.pinnedFields ?? DEFAULT_PINNED);
  return request(
    () => readArea("journal").pinnedFields[userKey] ?? DEFAULT_PINNED,
  );
}

export function togglePinnedField(
  userKey: Id,
  field: string,
): Promise<string[]> {
  if (isApiMode())
    return JM.prefs(userKey).then((p) => {
      const current = p.pinnedFields ?? DEFAULT_PINNED;
      const next = current.includes(field) ? current.filter((f) => f !== field) : [...current, field];
      return JM.patchPrefs(userKey, { pinnedFields: next }).then((r) => r.pinnedFields ?? next);
    });
  return request(() => {
    let result: string[] = [];
    mutateArea("journal", (s) => {
      const current = s.pinnedFields[userKey] ?? DEFAULT_PINNED;
      result = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];
      s.pinnedFields[userKey] = result;
    });
    return result;
  });
}

// ─────────────────────────── Плитки карточки клиента в окне записи (F-01-069) ───────────────────────────

/** Разделы карточки клиента, которые можно закрепить плиткой из «Еще» (Профиль/История — плитки всегда) */
export function getClientCardPins(userKey: Id): Promise<string[]> {
  if (isApiMode()) return JM.prefs(userKey).then((p) => p.clientCardPins);
  return request(() => readArea("journal").clientCardPins[userKey] ?? []);
}

export function toggleClientCardPin(
  userKey: Id,
  section: string,
): Promise<string[]> {
  if (isApiMode())
    return JM.prefs(userKey).then((p) => {
      const next = p.clientCardPins.includes(section)
        ? p.clientCardPins.filter((f) => f !== section)
        : [...p.clientCardPins, section];
      return JM.patchPrefs(userKey, { clientCardPins: next }).then((r) => r.clientCardPins);
    });
  return request(() => {
    let result: string[] = [];
    mutateArea("journal", (s) => {
      const current = s.clientCardPins[userKey] ?? [];
      result = current.includes(section)
        ? current.filter((f) => f !== section)
        : [...current, section];
      s.clientCardPins[userKey] = result;
    });
    return result;
  });
}

// ─────────────────────────── Доп. данные визита (F-01-050…053, F-01-060, F-01-061, F-01-211) ───────────────────────────

export function getBookingExtras(bookingId: Id): Promise<BookingExtras> {
  if (isApiMode()) return S.getExtras(bookingId);
  return request(() => withFinanceLines(bookingId, readArea("journal").extras[bookingId]));
}

/**
 * Мок: платежи кассы визита, которых нет строками окна журнала (засеянные оплаты демо, проведённые до зеркала
 * mirrorToJournalSync), — строками оплаты при чтении (id = ключ платежа, сумма за вычетом возвратов), как их отдаёт
 * сервер. Так возврат и отмена работают из окна и у засеянных визитов (решение владельца 01.10.2026). Не хранится:
 * отмена/возврат в кассе сразу видны и здесь. Только деньги — скидки и счёт лояльности пишет «Лояльность» сама.
 * Только внутри request().
 */
function withFinanceLines(bookingId: Id, stored: BookingExtras | undefined): BookingExtras {
  const extras = stored ?? EMPTY_BOOKING_EXTRAS;
  const booking = readCore().bookings.find((b) => b.id === bookingId);
  if (!booking) return extras;
  const have = new Set((extras.payments ?? []).map((l) => l.id));
  const groups = new Map<string, JournalPaymentLine>();
  for (const p of readArea("finance").bookingPayments) {
    if (p.bookingId !== bookingId || p.businessId !== booking.businessId || p.cancelled || p.kind !== "money") continue;
    const key = paymentGroupKey(p);
    if (have.has(key) || have.has(p.id)) continue;
    const net = Math.max(0, p.amount - (p.refundedAmount ?? 0));
    const line = groups.get(key);
    if (line) line.amount += net;
    else groups.set(key, { id: key, method: p.methodKey === "cash" ? "cash" : "card", amount: net, label: p.methodLabel, at: p.createdAt });
  }
  const extra = [...groups.values()].filter((l) => l.amount > 0);
  if (extra.length === 0) return extras;
  const payments = [...extra, ...(extras.payments ?? [])];
  return { ...extras, payments, paidAmount: payments.reduce((sum, l) => sum + l.amount, 0) };
}

/**
 * F-01-028/051/052: сетка (DayGrid/WeekGrid → BookingBlock) красит блок ручным цветом и рисует
 * значки категорий записи — одним запросом на весь видимый набор записей, а не по одному запросу
 * на блок (иначе 30+ запросов на экран дня, каждый со своей случайной задержкой мока).
 */
export function listBookingExtrasByIds(
  bookingIds: Id[],
): Promise<Record<Id, BookingExtras>> {
  if (isApiMode()) return S.listExtrasByIds(bookingIds);
  return request(() => {
    const all = readArea("journal").extras;
    const result: Record<Id, BookingExtras> = {};
    for (const id of bookingIds) {
      const extras = withFinanceLines(id, all[id]);
      if (all[id] || extras !== EMPTY_BOOKING_EXTRAS) result[id] = extras;
    }
    return result;
  });
}

/**
 * Оттенок лака записи для карточки «C · Тон» (DESIGN.md, F-00-094: «выбранный оттенок виден мастеру в записи»).
 * Есть только у записей услуг с выбором оттенка (Service.shadeChoice). Своего поля «оттенок» у записи в ядре пока нет —
 * демо берёт оттенок из палитры салона детерминированно по id записи (одинаковый при каждом открытии); запись без такой
 * услуги оттенка не получает, и карточка красится цветом категории услуги.
 */
export function listBookingLacquers(bookingIds: Id[]): Promise<Record<Id, BookingLacquer>> {
  if (isApiMode()) return JM.lacquersByIds(bookingIds);
  return request(() => lacquersOf(readCore(), (b) => bookingIds.includes(b.id)));
}

/** То же на день целиком (ключ запроса — дата: при листании дней нет «вспышки» цветов категорий) */
export function listDayLacquers(businessIds: Id[], date: ISODate): Promise<Record<Id, BookingLacquer>> {
  if (isApiMode()) return JM.lacquersByDay(businessIds, date);
  return request(() => lacquersOf(readCore(), (b) => businessIds.includes(b.businessId) && b.start.startsWith(date)));
}

function lacquersOf(core: CoreData, pick: (b: Booking) => boolean): Record<Id, BookingLacquer> {
  const shades = readArea("journal").lacquerShades ?? [];
  const shadeServices = new Set(core.services.filter((s) => s.shadeChoice).map((s) => s.id));
  const result: Record<Id, BookingLacquer> = {};
  if (shades.length === 0) return result;
  for (const b of core.bookings) {
    if (!pick(b)) continue;
    if (!b.services.some((line) => shadeServices.has(line.serviceId))) continue;
    let h = 0;
    for (let i = 0; i < b.id.length; i++) h = (h * 31 + b.id.charCodeAt(i)) >>> 0;
    const shade = shades[h % shades.length];
    result[b.id] = { name: shade.name, hex: shade.hex };
  }
  return result;
}

export function setBookingExtras(
  bookingId: Id,
  patch: Partial<BookingExtras>,
): Promise<BookingExtras> {
  // Ск3 и в режиме api: товары или оплата визита поменялись — свести продажу на складе (сервер сам её не трогает)
  if (isApiMode()) return "goodsLines" in patch || "paidAmount" in patch || "payments" in patch ? withVisitSale(bookingId, S.setExtras(bookingId, patch)) : S.setExtras(bookingId, patch);
  const write = request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      result = { ...current, ...patch };
      s.extras[bookingId] = result;
    });
    return result;
  });
  // Ск3: товары или оплата визита поменялись — свести продажу на складе
  return "goodsLines" in patch || "paidAmount" in patch || "payments" in patch ? withVisitSale(bookingId, write) : write;
}

// ─────────────────────────── Статистика клиента в окне записи (F-01-071) ───────────────────────────

export interface ClientVisitStats {
  totalVisits: number;
  sold: number;
  paid: number;
  balance: number;
  noShowCount: number;
  lastVisitAt?: ISODateTime;
}

/**
 * F-01-071: «Всего визитов», «Продано» (только по «Клиент пришёл», 1471), «Оплачено» (сумма
 * extras.paidAmount — F-01-061), «Баланс» = оплачено − продано, число неявок — берём готовое из
 * ядра (Client.noShowCount, ведёт changeBookingStatus). Сеть (F-01-006): при «Все филиалы» считаем
 * по всем businessId сети, иначе по одному.
 */
export function getClientVisitStats(
  clientId: Id,
  businessIds: Id[],
): Promise<ClientVisitStats> {
  if (isApiMode()) return JM.clientVisitStats(clientId, businessIds);
  return request(() => {
    const core = readCore();
    const client = core.clients.find((c) => c.id === clientId);
    const extras = readArea("journal").extras;
    const bookings = core.bookings.filter(
      (b) => b.clientId === clientId && businessIds.includes(b.businessId),
    );
    const arrived = bookings.filter((b) => b.status === "arrived");
    const sold = arrived.reduce((sum, b) => sum + b.total, 0);
    const paid = bookings.reduce(
      (sum, b) => sum + (extras[b.id]?.paidAmount ?? 0),
      0,
    );
    const lastVisitAt = arrived
      .map((b) => b.start)
      .sort()
      .at(-1);
    return {
      totalVisits: arrived.length,
      sold,
      paid,
      balance: paid - sold,
      noShowCount: client?.noShowCount ?? 0,
      lastVisitAt,
    };
  });
}

// ─────────────────────────── Последствия статуса «Клиент пришёл» (F-01-081) ───────────────────────────
// Разделы «Склад» (расходники по техкарте) и «Зарплата»/«Лояльность» (пересчёт) ещё не построены —
// демо-отметка в своём срезе, см. qa/requests/journal.md. «Продано» / долг клиента — уже считается
// из extras.paidAmount (F-01-061), сводка дня «Выполнено» — экран b04, вне этой пачки.

/**
 * F-01-081: применить последствия «Клиент пришёл» (списать расходники — демо) / откатить их при
 * возврате в «Ожидание» и любой другой нефинальный статус. changeBookingStatus() уже применяет
 * +1/−1 неявок в ядре — здесь только наша часть (extras.consumablesDeducted).
 */
export function syncArrivedConsequences(
  bookingId: Id,
  status: BookingStatus,
): Promise<BookingExtras> {
  if (isApiMode()) return S.getExtras(bookingId);
  return request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      result = { ...current, consumablesDeducted: status === "arrived" };
      s.extras[bookingId] = result;
    });
    return result;
  });
}

// ─────────────────────────── Товары, абонементы, сертификаты (F-01-060, F-01-211) ───────────────────────────
// Товары (kind 'product') — настоящий каталог склада (раздел stock): id строки = id товара склада, остаток —
// на складах «для продажи» локации (Ск3, ревью склада 27.09). Абонементы/сертификаты — по-прежнему
// демо-каталог своего среза (qa/requests/journal.md). Демо-товары среза остаются в каталоге только
// там, где на них уже ссылаются строки визитов (старые данные не теряют названий); payroll читает срез сам.

/** Остаток товара на складах «для продажи» локации (или всех локаций бизнеса), в единицах продажи */
function saleStockOf(businessId: Id, goodId: Id, saleWarehouseIds: ReadonlySet<Id>): number {
  return computeLevels(businessId, goodId)
    .filter((l) => saleWarehouseIds.has(l.warehouseId))
    .reduce((sum, l) => sum + l.qty, 0);
}

/** Id товаров склада бизнеса — чтобы отличить строку визита «товар склада» от демо-строки */
function stockGoodIds(businessId: Id): Set<Id> {
  return new Set(
    readArea("stock")
      .goods.filter((g) => g.businessId === businessId)
      .map((g) => g.id),
  );
}

export function getGoodsCatalog(locationId?: Id): Promise<GoodsCatalogItem[]> {
  if (isApiMode()) return JM.goodsCatalog(locationId);
  return request(() => {
    const own = readArea("journal");
    const nonProducts = own.goodsCatalog.filter((g) => g.kind !== "product");
    const businessId = currentActor().businessId;
    if (!businessId) return own.goodsCatalog;
    const stock = readArea("stock");
    const byLocation = locationId && locationId !== "all" ? locationId : undefined;
    const saleWarehouseIds = new Set(
      stock.warehouses
        .filter(
          (w) =>
            w.businessId === businessId &&
            w.type === "sale" &&
            (!byLocation || w.locationId === byLocation),
        )
        .map((w) => w.id),
    );
    const products: GoodsCatalogItem[] = stock.goods
      .filter(
        (g) =>
          g.businessId === businessId &&
          !g.archived &&
          (!byLocation || g.locationId === byLocation),
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        kind: "product" as const,
        price: g.salePrice,
        stock: saleStockOf(businessId, g.id, saleWarehouseIds),
        requiresCode: false,
      }))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name));
    // Старые строки визитов с демо-товаром — оставляем его в каталоге, чтобы строка не потеряла название
    const referenced = new Set<Id>();
    for (const extras of Object.values(own.extras))
      for (const line of extras.goodsLines ?? []) referenced.add(line.itemId);
    const legacy = own.goodsCatalog.filter((g) => g.kind === "product" && referenced.has(g.id));
    return [...products, ...legacy, ...nonProducts];
  });
}

/**
 * ⭐ Допродажа при записи (01.10.2026): товарные строки, которые клиент добавил онлайн к новой записи. Синхронно —
 * зовётся внутри request() потока записи (client/online); к оплате на визите их ведёт обычная продажа склада.
 */
export function attachUpsellGoodsTx(bookingId: Id, lines: BookingGoodsLine[]): void {
  if (!lines.length) return;
  mutateArea("journal", (s) => {
    const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
    s.extras[bookingId] = { ...current, goodsLines: [...(current.goodsLines ?? []), ...lines] };
  });
}

export interface SellWithoutBookingInput {
  itemId: Id;
  qty: number;
  paymentMethod: "cash" | "card";
  code?: string;
  /** F-04-219: клиент продажи вне визита — необязателен (можно продать без клиента). */
  clientId?: Id;
  clientName?: string;
  /** Локация журнала — с её склада «для продажи» уходит товар склада (Ск3) */
  locationId?: Id;
}

/** Продажа вне визита, за которой стоит документ продажи склада (Ск3) — id документа хранится рядом с записью */
type QuickSaleWithStock = QuickSaleRecord & { stockDocId?: Id; stockBusinessId?: Id };

/** Склад «для продажи» локации (первый по порядку), иначе любой склад локации */
function saleWarehouseOf(businessId: Id, locationId: Id): Id | undefined {
  const all = readArea("stock")
    .warehouses.filter((w) => w.businessId === businessId && w.locationId === locationId)
    .sort((a, b) => a.order - b.order);
  return (all.find((w) => w.type === "sale") ?? all[0])?.id;
}

/**
 * F-01-010: «Продать → Товар/Абонемент/Сертификат» без записи на день, во всплывающем окне в
 * контексте журнала (не уводит на чужой экран). Товар склада — документ «Продажа товара» склада
 * (остаток и касса — у склада, Ск3); демо-товар — как раньше, демо-остаток; абонемент/сертификат
 * с `requiresCode` — не продаётся без кода (CYCLE-09).
 * F-04-219: если выбран клиент, продажа привязывается к нему — считается в его «Продано»/«Оплачено»
 * (clientMoney() суммирует quickSales того же клиента, см. src/domain/clients/money.ts).
 */
export async function sellWithoutBooking(
  input: SellWithoutBookingInput,
): Promise<QuickSaleRecord> {
  if (isApiMode()) return JM.sell(input);
  const stockGood = await request(() => {
    const businessId = currentActor().businessId;
    const good = businessId
      ? readArea("stock").goods.find((g) => g.id === input.itemId && g.businessId === businessId)
      : undefined;
    return good && businessId ? { good, businessId } : undefined;
  });
  if (stockGood) {
    if (!(input.qty > 0)) throw new ApiError("validation");
    const { good, businessId } = stockGood;
    const locationId = input.locationId && input.locationId !== "all" ? input.locationId : good.locationId;
    const warehouseId = await request(() => saleWarehouseOf(businessId, locationId));
    if (!warehouseId) throw new ApiError("validation");
    const doc = await createSaleOperation(businessId, locationId, {
      date: nowDateTime(),
      warehouseId,
      clientId: input.clientId,
      paymentMethod: input.paymentMethod,
      paid: true,
      lines: [{ goodId: good.id, qtySale: input.qty, unitPrice: good.salePrice }],
    });
    return request(() => {
      const record: QuickSaleWithStock = {
        id: newId("sale"),
        itemId: good.id,
        itemName: good.name,
        kind: "product",
        qty: input.qty,
        totalPrice: good.salePrice * input.qty,
        paymentMethod: input.paymentMethod,
        createdAt: nowDateTime(),
        clientId: input.clientId,
        clientName: input.clientName,
        stockDocId: doc.id,
        stockBusinessId: businessId,
      };
      mutateArea("journal", (s) => {
        s.quickSales = [record, ...s.quickSales];
      });
      return record;
    });
  }
  return request(() => {
    const item = readArea("journal").goodsCatalog.find(
      (g) => g.id === input.itemId,
    );
    if (!item) throw new ApiError("not_found");
    if (item.requiresCode && !input.code?.trim() && !input.clientId)
      throw new ApiError("code_required");
    if (item.kind === "product" && item.stock < input.qty)
      throw new ApiError("out_of_stock");
    let record!: QuickSaleRecord;
    mutateArea("journal", (s) => {
      const catalogItem = s.goodsCatalog.find((g) => g.id === input.itemId)!;
      if (catalogItem.kind === "product")
        catalogItem.stock = Math.max(0, catalogItem.stock - input.qty);
      record = {
        id: newId("sale"),
        itemId: item.id,
        itemName: item.name,
        kind: item.kind,
        qty: input.qty,
        totalPrice: item.price * input.qty,
        paymentMethod: input.paymentMethod,
        code: input.code?.trim() || undefined,
        createdAt: nowDateTime(),
        clientId: input.clientId,
        clientName: input.clientName,
      };
      s.quickSales = [record, ...s.quickSales];
    });
    return record;
  });
}

/** F-04-219: отмена продажи вне визита уменьшает «Продано»/«Оплачено» клиента (запись помечается, не удаляется).
 * Продажа товара склада отменяется и на складе: товар возвращается документом прихода, выручка снимается с кассы. */
export async function cancelQuickSale(saleId: Id): Promise<void> {
  if (isApiMode()) return JM.cancelSale(saleId);
  const linked = await request(() => {
    const sale = readArea("journal").quickSales.find((q) => q.id === saleId) as QuickSaleWithStock | undefined;
    if (!sale) throw new ApiError("not_found");
    if (sale.cancelled) return undefined;
    const docId = sale.stockDocId;
    const businessId = sale.stockBusinessId;
    if (!docId || !businessId) return undefined;
    const doc = readArea("stock").operations.find((op) => op.id === docId);
    return doc && !doc.cancelledAt ? { businessId, docId } : undefined;
  });
  if (linked) await cancelSaleOperation(linked.businessId, linked.docId);
  await request(() => {
    mutateArea("journal", (s) => {
      const sale = s.quickSales.find((q) => q.id === saleId);
      if (!sale) throw new ApiError("not_found");
      sale.cancelled = true;
    });
  });
}

// ─────────────────────────── Продажа товаров визита на складе (Ск3) ───────────────────────────
// Товарные строки визита, у которого есть оплата, — один документ «Продажа товара» склада с bookingId
// (остаток уходит со склада «для продажи» локации визита). Состав поменялся, оплату сняли, визит
// удалили — прежний документ отменяется (cancelSaleOperation: возврат на склад + снятие выручки в кассе)
// и, если нужно, создаётся новый. Идемпотентно: одна действующая продажа на визит, повтор ничего не делает.
// Оплата во вкладке «Оплата» finance (платёж с goods) — тоже «оплачено»; finance проводит в кассу только услуги.
// Касса: оплата визита в журнале (extras.payments) в кассу finance не пишет — выручку товаров туда
// кладёт сам склад (paid:true), двойного счёта нет. Сбой склада не ломает оплату — только предупреждение.

const visitSaleQueue = new Map<Id, Promise<void>>();

function mapVisitPaymentMethod(method: JournalPaymentMethod | undefined): SalePaymentMethod {
  if (method === "card") return "card";
  if (method === "cash" || method === undefined) return "cash";
  return "loyalty";
}

/** Способ оплаты продажи склада по плитке оплаты finance: наличные / карта (и рассрочка, ссылка) / счёт клиента */
function financeSaleMethod(methodKey: string): SalePaymentMethod {
  if (methodKey === "cash") return "cash";
  if (methodKey === "account") return "loyalty";
  return "card";
}

function saleLinesKey(lines: { goodId: Id; qty: number; price: Money; discountPct?: number; sellerId?: Id }[]): string {
  return lines
    .map((l) => `${l.goodId}:${l.qty}:${l.price}:${l.discountPct ?? 0}:${l.sellerId ?? ""}`)
    .sort()
    .join("|");
}

async function runVisitSaleSync(bookingId: Id): Promise<void> {
  const plan = await request(() => {
    const booking = readCore().bookings.find((b) => b.id === bookingId);
    if (!booking) return undefined;
    const extras = readArea("journal").extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
    const goodIds = stockGoodIds(booking.businessId);
    // Оплачено — отметкой журнала (extras.paidAmount) ИЛИ деньгами за товары во вкладке «Оплата» finance:
    // действующий (не отменённый, не весь возвращённый) платёж не-скидкой по товарам визита
    const financeGoods = readArea("finance").bookingPayments.filter(
      (p) => p.bookingId === bookingId && p.goods && !p.cancelled && p.kind !== "discount" && p.amount - (p.refundedAmount ?? 0) > 0,
    );
    const paid = extras.paidAmount > 0 || financeGoods.length > 0;
    const wanted =
      booking.deletedAt || !paid
        ? []
        : (extras.goodsLines ?? []).filter((l) => goodIds.has(l.itemId) && l.qty > 0);
    const active = readArea("stock").operations.filter(
      (op) => op.businessId === booking.businessId && op.type === "sale" && op.bookingId === bookingId && !op.cancelledAt,
    );
    // З9: продавец строки — выбранный в окне записи, иначе мастер визита
    const sellerOf = (l: { sellerId?: Id }) => l.sellerId || booking.staffId;
    const wantKey = saleLinesKey(wanted.map((l) => ({ goodId: l.itemId, qty: l.qty, price: l.price, discountPct: l.discountPct, sellerId: sellerOf(l) })));
    const haveKey =
      active.length === 1
        ? saleLinesKey(active[0].lines.map((l) => ({ goodId: l.goodId, qty: Math.abs(l.qtySale), price: l.unitPrice, discountPct: l.discountPct, sellerId: l.sellerId })))
        : "";
    if (active.length <= 1 && wantKey === haveKey) return undefined;
    return {
      businessId: booking.businessId,
      locationId: booking.locationId,
      clientId: booking.clientId,
      cancelIds: active.map((op) => op.id),
      warehouseId: saleWarehouseOf(booking.businessId, booking.locationId),
      method: extras.paidAmount > 0 || financeGoods.length === 0 ? mapVisitPaymentMethod(extras.payments?.[0]?.method) : financeSaleMethod(financeGoods[0].methodKey),
      lines: wanted.map((l) => ({ goodId: l.itemId, qtySale: l.qty, unitPrice: l.price, discountPct: l.discountPct || undefined, sellerId: sellerOf(l) })),
    };
  });
  if (!plan) return;
  for (const docId of plan.cancelIds) await cancelSaleOperation(plan.businessId, docId);
  if (!plan.lines.length || !plan.warehouseId) return;
  await createSaleOperation(plan.businessId, plan.locationId, {
    date: nowDateTime(),
    warehouseId: plan.warehouseId,
    clientId: plan.clientId,
    bookingId,
    paymentMethod: plan.method,
    paid: true,
    lines: plan.lines,
  });
}

/** Свести документ продажи склада с товарами и оплатой визита (последовательно по визиту — без гонок) */
export function syncVisitGoodsSale(bookingId: Id): Promise<void> {
  if (isApiMode()) return StockServer.syncVisitGoodsSale(bookingId).catch((error: unknown) => console.warn("[journal] продажа товаров визита на складе не сведена", bookingId, error));
  const prev = visitSaleQueue.get(bookingId) ?? Promise.resolve();
  const next = prev
    .then(() => runVisitSaleSync(bookingId))
    .catch((error: unknown) => console.warn("[journal] продажа товаров визита на складе не сведена", bookingId, error));
  visitSaleQueue.set(bookingId, next);
  void next.then(() => {
    if (visitSaleQueue.get(bookingId) === next) visitSaleQueue.delete(bookingId);
  });
  return next;
}

/**
 * Результат записи визита + сведение продажи склада в фоне: оплата/сохранение не ждут склад (ничего не
 * тормозит), а экраны склада и каталог перечитаются сами по изменению базы. Ошибка склада оплату не роняет.
 */
async function withVisitSale<T>(bookingId: Id, write: Promise<T>): Promise<T> {
  const result = await write;
  void syncVisitGoodsSale(bookingId);
  return result;
}

// ─────────────────────────── Автосписание с абонемента (F-01-080) ───────────────────────────
// Разделы «Лояльность» (абонементы) и «Услуги» (флаг «автосписание» у услуги) ещё не построены —
// временный демо-баланс и демо-настройка в своём срезе, см. qa/requests/journal.md.

/** Балансы абонементов клиента, ещё годные к списанию (есть остаток и срок не истёк) */
export function getClientSubscriptions(
  clientId: Id,
): Promise<ClientSubscriptionBalance[]> {
  return request(() => {
    const day = toISODate(parse(nowDateTime()));
    return readArea("journal")
      .clientSubscriptions.filter(
        (s) =>
          s.clientId === clientId &&
          s.remainingVisits > 0 &&
          s.expiresAt >= day,
      )
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  });
}

function computeAutoWriteoff(
  area: JournalArea,
  booking: Booking,
): AutoWriteoffInfo | undefined {
  if (!booking.clientId) return undefined;
  const eligible = new Set(area.autoWriteoffServiceIds);
  const eligibleLines = booking.services.filter((s) =>
    eligible.has(s.serviceId),
  );
  if (eligibleLines.length === 0) return undefined;
  const eligibleTotal: Money = eligibleLines.reduce(
    (sum, l) => sum + l.price,
    0,
  );
  const day = toISODate(parse(nowDateTime()));
  const balance = area.clientSubscriptions
    .filter(
      (s) =>
        s.clientId === booking.clientId &&
        s.remainingVisits > 0 &&
        s.expiresAt >= day,
    )
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
  // Готово-критерий (проверка 1): запись из нескольких услуг, автосписание только у части — списывается
  // только эта часть, доплатить нужно за остальные строки (упрощённо — без списания по нескольким разным
  // абонементам сразу, см. assumed в отчёте b03-fix2).
  const restTotal = booking.total - eligibleTotal;
  if (!balance)
    return { status: "not_written_off", amountDue: eligibleTotal + restTotal };
  return {
    status: "written_off",
    amountDue: restTotal,
    subscriptionId: balance.id,
  };
}

/**
 * F-01-080: посчитать и применить автосписание визита в момент его начала — идемпотентно (второй
 * вызов на ту же запись ничего не меняет, читает уже посчитанный результат). Зовите при открытии
 * записи в окне и при отрисовке блока в сетке (пачка сама решает, когда время пришло — прошедших
 * записей без записанного результата в базе быть не должно после первого показа).
 */
export function ensureAutoWriteoff(
  bookingId: Id,
): Promise<AutoWriteoffInfo | undefined> {
  if (isApiMode()) return apiEnsureAutoWriteoff(bookingId);
  return request(() => {
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId);
    if (!booking || booking.deletedAt || INACTIVE.has(booking.status))
      return undefined;
    if (nowDateTime() < booking.start) return undefined;
    const existing = readArea("journal").extras[bookingId]?.autoWriteoff;
    if (existing) return existing;
    const result = computeAutoWriteoff(readArea("journal"), booking);
    if (!result) return undefined;
    mutateArea("journal", (s) => {
      if (result.status === "written_off" && result.subscriptionId) {
        const sub = s.clientSubscriptions.find(
          (x) => x.id === result.subscriptionId,
        );
        if (sub) sub.remainingVisits = Math.max(0, sub.remainingVisits - 1);
      }
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      s.extras[bookingId] = { ...current, autoWriteoff: result };
    });
    return result;
  });
}

/** Вернуть посещение абонемента, списанное автосписанием (F-01-120: удаление записи возвращает посещение) */
function revertAutoWriteoffSync(s: JournalArea, bookingId: Id): void {
  const info = s.extras[bookingId]?.autoWriteoff;
  if (info?.status === "written_off" && info.subscriptionId) {
    const sub = s.clientSubscriptions.find((x) => x.id === info.subscriptionId);
    if (sub) sub.remainingVisits += 1;
  }
}

export function addBookingGoodsLine(
  bookingId: Id,
  line: Omit<BookingGoodsLine, "id">,
): Promise<BookingExtras> {
  if (isApiMode()) return S.addGoodsLine(bookingId, line);
  return withVisitSale(bookingId, request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      result = {
        ...current,
        goodsLines: [...current.goodsLines, { ...line, id: newId("gl") }],
      };
      s.extras[bookingId] = result;
    });
    return result;
  }));
}

export function removeBookingGoodsLine(
  bookingId: Id,
  lineId: Id,
): Promise<BookingExtras> {
  if (isApiMode()) return S.removeGoodsLine(bookingId, lineId);
  return withVisitSale(bookingId, request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      result = {
        ...current,
        goodsLines: current.goodsLines.filter((l) => l.id !== lineId),
      };
      s.extras[bookingId] = result;
    });
    return result;
  }));
}

export function updateBookingGoodsLine(
  bookingId: Id,
  lineId: Id,
  patch: Partial<BookingGoodsLine>,
): Promise<BookingExtras> {
  if (isApiMode()) return S.patchGoodsLine(bookingId, lineId, patch);
  return withVisitSale(bookingId, request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      result = {
        ...current,
        goodsLines: current.goodsLines.map((l) =>
          l.id === lineId ? { ...l, ...patch } : l,
        ),
      };
      s.extras[bookingId] = result;
    });
    return result;
  }));
}

// ─────────────────────────── Частые и прошлые услуги (F-01-056) ───────────────────────────

/** До 6 самых частых услуг мастера по истории его записей (F-01-056) */
export function getFrequentServices(
  staffId: Id,
  limit = 6,
): Promise<Service[]> {
  if (isApiMode())
    return Promise.all([
      JM.frequentServiceIds(staffId, limit),
      serverListServices(S.bizOfStaffOrSession(staffId)),
    ]).then(([ids, services]) =>
      ids.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => Boolean(s)),
    );
  return request(() => {
    const core = readCore();
    const counts = new Map<Id, number>();
    for (const b of core.bookings) {
      if (b.deletedAt || b.staffId !== staffId) continue;
      for (const line of b.services)
        counts.set(line.serviceId, (counts.get(line.serviceId) ?? 0) + 1);
    }
    // F-01-193: частые услуги предлагаются только для индивидуальной записи — групповые (kind
    // 'group') сюда не попадают.
    const services = core.services.filter(
      (s) => s.staffIds.includes(staffId) && s.active && s.kind === "individual",
    );
    return services
      .filter((s) => counts.has(s.id))
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .slice(0, limit);
  });
}

/** Последняя услуга, которую этот клиент брал у этого мастера — подставляется в новую запись (F-00-060) */
export function getLastClientService(
  clientId: Id,
  staffId: Id,
): Promise<Id | undefined> {
  if (isApiMode())
    return S.listBookings({ clientId, staffId }).then(
      (list) =>
        list
          .filter((b) => !b.deletedAt && b.staffId === staffId && b.services.length > 0)
          .sort((a, b) => b.start.localeCompare(a.start))[0]?.services[0]?.serviceId,
    );
  return request(() => {
    const core = readCore();
    const past = core.bookings
      .filter(
        (b) =>
          !b.deletedAt &&
          b.clientId === clientId &&
          b.staffId === staffId &&
          b.services.length > 0,
      )
      .sort((a, b) => b.start.localeCompare(a.start));
    return past[0]?.services[0]?.serviceId;
  });
}

// ─────────────────────────── Клиент в окне записи (F-01-063, F-01-064) ───────────────────────────

/** Подсказка клиента по цифрам номера, имени или email, не больше 6 (F-01-064) */
export function searchClientsForBooking(
  businessId: Id,
  query: string,
): Promise<Client[]> {
  if (isApiMode()) return apiSearchClients(businessId, query);
  return request(() => {
    // qa/measure/journal/ux-r2.md #1: PhoneInput всегда держит код страны в значении ('+374700…'),
    // даже пока номер ещё не введён целиком (normalizePhone() тогда возвращает undefined и не помогает) —
    // сырые цифры запроса начинались с «374» и никогда не входили в местные 8 цифр клиента. Код страны
    // снимаем вручную, а не только через localDigits (та не справляется с неполным номером).
    const rawDigits = query.replace(/\D/g, "");
    const digits =
      rawDigits.startsWith("374") && rawDigits.length > 3
        ? rawDigits.slice(3)
        : rawDigits;
    const q = normalizeSearch(query);
    if (!digits && q.length < 2) return [];
    const core = readCore();
    // F-01-070 «Готово, когда»: примечание, добавленное из окна записи, должно находиться и в этом
    // поиске (1157) — override из журнала главнее Client.note (та же логика, что в getClientNoteForWindow).
    const journalState = readArea("journal");
    return core.clients
      .filter((c) => {
        if (c.businessId !== businessId) return false;
        if (digits && localDigits(c.phone).includes(digits)) return true;
        if (q.length >= 2 && normalizeSearch(c.name).includes(q)) return true;
        if (q.length >= 2 && c.email && normalizeSearch(c.email).includes(q))
          return true;
        if (q.length < 2) return false;
        const note = journalState.clientNoteOverrides[c.id] ?? c.note ?? "";
        if (note && normalizeSearch(note).includes(q)) return true;
        // F-01-073: «Отображать в окне записи поиск по лояльности» — если включено в настройках
        // журнала, ввод номера абонемента (у нас — его id, своего каталога карт лояльности с
        // отдельным номером в проекте пока нет, qa/requests/journal.md) находит владельца.
        if (journalState.settings.loyaltySearchEnabled) {
          return journalState.clientSubscriptions.some(
            (sub) => sub.clientId === c.id && sub.id.toLowerCase().includes(q),
          );
        }
        return false;
      })
      .slice(0, 6);
  });
}

// ─────────────────────────── Визит: склейка записей клиента (F-01-041) ───────────────────────────

/** Записи клиента в этот день, которыми новая/меняемая запись могла бы склеиться в визит (для расчёта и для UI) */
function findJoinableBooking(
  core: CoreData,
  clientId: Id,
  date: ISODate,
  start: ISODateTime,
  durationMin: number,
  intervalMin: number,
  excludeId?: Id,
): Booking | undefined {
  const from = toMinutes(start.slice(11, 16));
  const to = from + durationMin;
  const candidates = core.bookings.filter(
    (b) =>
      b.id !== excludeId &&
      !b.deletedAt &&
      b.clientId === clientId &&
      b.start.startsWith(date) &&
      !INACTIVE.has(b.status),
  );
  for (const b of candidates) {
    const bFrom = toMinutes(b.start.slice(11, 16));
    const bTo = bFrom + b.durationMin;
    const gap = from >= bTo ? from - bTo : bFrom >= to ? bFrom - to : 0;
    if (gap <= intervalMin) return b;
  }
  return undefined;
}

/**
 * Id визита для новой/переносимой записи (F-01-041): ищет соседнюю активную запись того же клиента
 * в тот же день в пределах интервала склейки и переиспользует её visitId (или создаёт общий новый и
 * дописывает его найденной записи). Без клиента или без соседей — undefined (запись остаётся без визита).
 */
export async function resolveVisitId(
  clientId: Id | undefined,
  date: ISODate,
  start: ISODateTime,
  durationMin: number,
  excludeId?: Id,
): Promise<Id | undefined> {
  if (isApiMode()) return S.visitIdFor({ clientId, start, durationMin, excludeBookingId: excludeId });
  if (!clientId) return undefined;
  const joined = await request(() => {
    const { visitIntervalMin } = readArea("journal");
    return findJoinableBooking(
      readCore(),
      clientId,
      date,
      start,
      durationMin,
      visitIntervalMin,
      excludeId,
    );
  });
  if (!joined) return undefined;
  if (joined.visitId) return joined.visitId;
  const visitId = newId("vis");
  await coreUpdate("bookings", joined.id, { visitId });
  return visitId;
}

/** Статус и оплата ставятся сразу на весь визит (F-01-041): применяет статус ко всем остальным записям того же visitId. */
export async function syncVisitStatus(
  visitId: Id,
  status: Booking["status"],
  excludeId: Id,
): Promise<void> {
  if (isApiMode()) return S.syncVisitStatus(visitId, status, excludeId);
  const siblingIds = await request(() =>
    readCore()
      .bookings.filter(
        (b) => b.visitId === visitId && b.id !== excludeId && !b.deletedAt,
      )
      .map((b) => b.id),
  );
  await Promise.all(
    siblingIds.map((id) => coreUpdate("bookings", id, { status })),
  );
}

// ─────────────────────────── Черновик окна записи (F-01-040) ───────────────────────────

export function loadDraft(
  key: string,
): Promise<WindowDraftSnapshot | undefined> {
  // api: сперва свой браузер (flushDraftSync пишет его синхронно при закрытии окна), иначе — сервер (другое устройство)
  if (isApiMode())
    return request(() => readArea("journal").drafts[key]).then((local) => local ?? JM.draft(key));
  return request(() => readArea("journal").drafts[key]);
}

export function saveDraft(
  key: string,
  data: WindowDraftSnapshot,
): Promise<void> {
  const local = request(() => {
    mutateArea("journal", (s) => {
      s.drafts[key] = data;
    });
  });
  if (isApiMode()) return local.then(() => JM.setDraft(key, data));
  return local;
}

/**
 * То же самое, но БЕЗ искусственной сетевой задержки request() (F-01-040): вызывается при закрытии
 * окна записи (unmount), чтобы последняя правка точно легла в стор ДО того, как окно откроется
 * повторно тем же ключом — иначе задержка 150–400 мс у обычного saveDraft оставляла окно гонки,
 * в которое попадало мгновенное переоткрытие после Escape.
 */
// F-01-127 (минор): flushDraftSync обходит request() НАМЕРЕННО — синхронная запись на unmount, без
// задержки (см. комментарий выше), — и это стабильно пишет [mock-db] «обращение к базе вне request()»
// в консоль при каждом закрытии окна записи. Настоящий выключатель этого предупреждения — markRequest()
// из src/mock/db.ts, но импортировать его сюда нельзя: no-restricted-imports держит прямой доступ к
// mock/db только за src/api/{core,area,request}.ts (фундамент), src/api/journal.ts под тем же запретом,
// что и экраны. Попросил фундамент завести исключение (mutateAreaSync в src/api/area.ts) —
// qa/requests/journal.md. До ответа: предупреждение остаётся, но безвредно (пишет ровно то же самое,
// что обычный mutateArea, просто без искусственной задержки — данные и откат при ошибке не пострадали).
export function flushDraftSync(key: string, data: WindowDraftSnapshot): void {
  mutateArea("journal", (s) => {
    s.drafts[key] = data;
  });
  if (isApiMode()) void JM.setDraft(key, data).catch(() => undefined);
}

export function clearDraft(key: string): Promise<void> {
  const local = request(() => {
    mutateArea("journal", (s) => {
      delete s.drafts[key];
    });
  });
  if (isApiMode()) return local.then(() => JM.setDraft(key, null));
  return local;
}

// ─────────────────────────── Удаление записи (F-01-118…121) ───────────────────────────

export interface DeletionImpact {
  /** Сколько уйдёт из демо-кассы (F-01-120: extras.paidAmount — реальные кассы считает finance) */
  paidAmount: Money;
  /** Расходники по техкарте вернутся на демо-склад (F-01-081/F-01-120) */
  consumablesReturned: boolean;
  /** Посещение абонемента будет возвращено клиенту (F-01-080/F-01-120) */
  subscriptionVisitReturned: boolean;
}

/** F-01-120: что покажет предупреждение перед удалением оплаченной записи — «что уйдёт из кассы» */
export function getDeletionImpact(bookingId: Id): Promise<DeletionImpact> {
  if (isApiMode()) return S.deletionImpact(bookingId);
  return request(() => {
    const extras =
      readArea("journal").extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
    return {
      paidAmount: extras.paidAmount,
      consumablesReturned: Boolean(extras.consumablesDeducted),
      subscriptionVisitReturned: extras.autoWriteoff?.status === "written_off",
    };
  });
}

/**
 * Мягкое удаление с автором (F-01-118, F-01-119): пишет Booking.deletedAt в ядре и запоминает,
 * кто удалил, у себя в extras (ядро своего автора не хранит). byClient=true — «Удалено клиентом»
 * вместо имени сотрудника (клиентская отмена по ссылке идёт отдельным путём, cancelBookingAsClient).
 * ⭐ F-01-120: удаление оплаченной записи откатывает и её деньги (обнуляет paidAmount — реальная
 * касса считается разделом «Финансы»), и списанные расходники, и посещение абонемента — одной
 * транзакцией (A2: одна операция = один request()), а не двумя последовательными как раньше —
 * второй отдельный `coreDeleteBooking()` после `await` был лишним обращением к базе вне транзакции
 * записи в свой срез (F-01-118, замечание проверяющего про предупреждение `[mock-db]`).
 */
export function deleteBookingWithAuthor(
  bookingId: Id,
  byName: string,
  byClient = false,
): Promise<Booking> {
  if (isApiMode()) return apiDeleteWithAuthor(bookingId, byName, byClient);
  return withVisitSale(bookingId, request(() => {
    // F-01-178 (qa/full-test-0930/journal-perms.md): чужую запись без journal.others не удалить и по прямому вызову
    if (!byClient) {
      const target = readCore().bookings.find((b) => b.id === bookingId);
      if (target) assertCan("journal.edit", { targetStaffId: target.staffId });
    }
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      revertAutoWriteoffSync(s, bookingId);
      s.extras[bookingId] = {
        ...current,
        deletion: {
          byName,
          byClient,
          at: nowDateTime(),
          restore: {
            paidAmount: current.paidAmount,
            consumablesDeducted: current.consumablesDeducted,
            autoWriteoff: current.autoWriteoff,
          },
        },
        consumablesDeducted: false,
        paidAmount: 0,
      };
    });
    return coreTx.update("bookings", bookingId, { deletedAt: nowDateTime() });
  }));
}

/**
 * F-01-116/F-01-124: решение администратора по внесённой предоплате при позднем переносе или
 * «Не пришёл» — держать (доход бизнеса) или простить (вернуть клиенту). Пишет только в свой срез
 * (extras) — реальными деньгами не двигает (F-00-126: только записываем), как и остальная ручная
 * предоплата F-00-097.
 */
export function decidePrepayment(
  bookingId: Id,
  kept: boolean,
  reason: "late_reschedule" | "no_show",
  decidedBy: string,
  auto = false,
): Promise<void> {
  if (isApiMode()) return S.decidePrepayment(bookingId, { kept, reason, decidedBy, auto });
  return request(() => {
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      s.extras[bookingId] = {
        ...current,
        prepaymentDecision: { kept, reason, decidedBy, decidedAt: nowDateTime(), auto },
      };
    });
  });
}

/**
 * Откат мягкого удаления в течение 5 секунд («Отменить» в тосте, F-00-061/F-01-118) — НЕ то же самое,
 * что F-01-121 (восстановление из «Изменений данных» спустя произвольное время, которого у Altegio нет).
 * Возвращает и деньги/расходники/посещение абонемента, которые снял `deleteBookingWithAuthor` (из
 * снимка `deletion.restore`) — иначе «Отменить» отменяло бы только видимость записи, а касса и
 * абонемент оставались бы обнулёнными.
 */
export function undoDeleteBooking(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return apiRestore(bookingId);
  return withVisitSale(bookingId, request(() => {
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      const restore = current.deletion?.restore;
      if (
        restore?.autoWriteoff?.status === "written_off" &&
        restore.autoWriteoff.subscriptionId
      ) {
        const sub = s.clientSubscriptions.find(
          (x) => x.id === restore.autoWriteoff!.subscriptionId,
        );
        if (sub) sub.remainingVisits = Math.max(0, sub.remainingVisits - 1);
      }
      s.extras[bookingId] = {
        ...current,
        deletion: undefined,
        paidAmount: restore?.paidAmount ?? current.paidAmount,
        consumablesDeducted: restore?.consumablesDeducted,
        autoWriteoff: restore?.autoWriteoff ?? current.autoWriteoff,
      };
    });
    return coreTx.update("bookings", bookingId, { deletedAt: undefined });
  }));
}

/**
 * F-01-121 (решение владельца, ANSWERS.md): удалённую запись можно вернуть в течение
 * `JournalSettings.deletionRestoreWindowDays` (по умолчанию 7) — целиком (клиент/мастер/услуги/время —
 * они и так остались на самой Booking, мягкое удаление их не трогает; деньги/расходники/абонемент —
 * из снимка `deletion.restore`, как у 5-секундного `undoDeleteBooking`, но с проверкой срока и
 * занятости времени, если её время ещё свободно). Строку
 * «восстановлена» в историю (F-01-096, читает и F-12-076 «Изменения данных») пишет вызывающий экран
 * через `logBookingHistory(id, author, 'restored', t(...))` — здесь нет доступа к переводу (i18n).
 * Отказ — `ApiError('restore_expired' | 'restore_slot_taken' | 'not_found')`, экран показывает
 * «Создать заново» с подставленными данными вместо восстановления (records.recreateRow).
 */
export function restoreDeletedBooking(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return apiRestore(bookingId);
  return withVisitSale(bookingId, request(() => {
    const area = readArea("journal");
    const current = area.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
    const deletion = current.deletion;
    if (!deletion) throw new ApiError("not_found");
    const windowDays = area.settings.deletionRestoreWindowDays;
    if (diffMinutes(deletion.at, nowDateTime()) / 1440 > windowDays) {
      throw new ApiError("restore_expired");
    }
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError("not_found");
    if (
      hasBookingOverlap(
        core,
        booking.staffId,
        booking.start,
        booking.durationMin,
        booking.id,
      )
    ) {
      throw new ApiError("restore_slot_taken");
    }
    const restore = deletion.restore;
    mutateArea("journal", (s) => {
      if (
        restore?.autoWriteoff?.status === "written_off" &&
        restore.autoWriteoff.subscriptionId
      ) {
        const sub = s.clientSubscriptions.find(
          (x) => x.id === restore.autoWriteoff!.subscriptionId,
        );
        if (sub) sub.remainingVisits = Math.max(0, sub.remainingVisits - 1);
      }
      s.extras[bookingId] = {
        ...current,
        deletion: undefined,
        paidAmount: restore?.paidAmount ?? current.paidAmount,
        consumablesDeducted: restore?.consumablesDeducted,
        autoWriteoff: restore?.autoWriteoff ?? current.autoWriteoff,
      };
    });
    return coreTx.update("bookings", bookingId, { deletedAt: undefined });
  }));
}

/** Сбросить отметку оплаты — визит становится «Оплачен не полностью» (F-01-079) */
export function cancelBookingPayment(bookingId: Id): Promise<BookingExtras> {
  if (isApiMode()) return withVisitSale(bookingId, S.cancelPayments(bookingId));
  // Как сервер (journal.server cancelPayments): платежи кассы отменяются — приходы и расходы «Возврат» снимаются
  return withVisitSale(bookingId, (async () => {
    const businessId = await businessOfBooking(bookingId);
    if (businessId) {
      for (const lineId of await financeMoneyLineIds(businessId, bookingId)) await removeBookingPaymentLine(businessId, lineId);
    }
    return setBookingExtras(bookingId, { paidAmount: 0, payments: [] });
  })());
}

/** Мгновенная оплата всей суммы визита из всплывающей карточки (F-01-141) */
/**
 * Подпись строки оплаты «предоплата получена» (F-00-097) — ключ, а не текст: так же пишет сервер
 * (bookings.service prepaymentReceived); PaymentSheet показывает её словами window.pay.prepaymentLine.
 */
export const PREPAYMENT_LINE_LABEL = "prepayment";

/**
 * Мастер вернул клиенту предоплату (F-00-100, В-04: отмена мастером или клиентом раньше срока) — напоминание
 * «Верните …» в окне записи гаснет. Сервер: POST …/refund-done.
 */
export function markPrepaymentRefunded(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return S.refundDone(bookingId);
  return request(async () => {
    const b = await coreGet("bookings", bookingId);
    if (!b.prepayment) throw new ApiError("invalid_transition", "Предоплаты нет");
    // Решение владельца 01.10.2026: «Вернул» — обратная операция к приходу предоплаты в финансах
    recordPrepaymentRefundSync(bookingId);
    return updateBooking(bookingId, { prepayment: { ...b.prepayment, refundDue: 0, refundedAt: nowDateTime() } });
  });
}

/** Мок: мастер отметил «Деньги пришли» — предоплата становится строкой оплаты визита, как на сервере */
export function recordPrepaymentLineSync(bookingId: Id, amount: Money): void {
  mutateArea("journal", (s) => {
    const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
    if ((current.payments ?? []).some((l) => l.label === PREPAYMENT_LINE_LABEL)) return;
    const payments = [...(current.payments ?? []), { id: newId("pay"), method: "cash" as const, amount, label: PREPAYMENT_LINE_LABEL, at: nowDateTime() }];
    s.extras[bookingId] = { ...current, payments, paidAmount: payments.reduce((sum, l) => sum + l.amount, 0) };
  });
}

export function instantPayBooking(
  bookingId: Id,
  total: number,
  /** Способ: наличные (по умолчанию, «Список») или карта — касса карты (кнопка «Банковские карты» карточки) */
  method: "cash" | "card" = "cash",
): Promise<BookingExtras> {
  if (isApiMode()) return withVisitSale(bookingId, S.instantPay(bookingId, total, method));
  // Остаток считает касса (сумма визита − платежи − полученная предоплата); строку оплаты журнала пишет она же
  // (finance mirrorToJournalSync, как сервер) — своя строка «Наличные» здесь задвоила бы оплату
  return withVisitSale(bookingId, payThroughFinance(bookingId, method).then(() => getBookingExtras(bookingId)));
}

/** Мок: бизнес записи — одним запросом (без чтения базы вне request()) */
function businessOfBooking(bookingId: Id): Promise<Id | undefined> {
  return request(() => readCore().bookings.find((b) => b.id === bookingId)?.businessId);
}

/** Мок: по одной строке на каждый активный платёж кассы визита, кроме скидок (как financeMoneyGroups сервера) */
async function financeMoneyLineIds(businessId: Id, bookingId: Id): Promise<Id[]> {
  const summary = await getBookingPaymentSummary(businessId, bookingId);
  const seen = new Set<string>();
  const ids: Id[] = [];
  for (const p of summary.payments) {
    if (p.cancelled || p.kind === "discount") continue;
    const key = paymentGroupKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(p.id);
  }
  return ids;
}

/** Мок: строка оплаты журнала, которая зеркалит платёж кассы (id строки = ключ платежа), → строка платежа кассы */
async function financeLineOfJournalLine(bookingId: Id, lineId: Id): Promise<{ businessId: Id; financeLineId: Id } | undefined> {
  return request(() => {
    const booking = readCore().bookings.find((b) => b.id === bookingId);
    if (!booking) return undefined;
    const line = readArea("finance").bookingPayments.find(
      (p) => p.businessId === booking.businessId && p.bookingId === bookingId && !p.cancelled && (p.id === lineId || paymentGroupKey(p) === lineId),
    );
    return line ? { businessId: booking.businessId, financeLineId: line.id } : undefined;
  });
}

/**
 * «Оплатить» в «Списке» и во всплывающей карточке — та же оплата визита в финансах, что в окне записи
 * (payBookingQuick, наличные): операция попадает в кассу, «Касса за день», «Финансовый» и P&L. Остаток считает
 * finance — полученная предоплата (F-00-097) уже вычтена, повторно не берём. Раньше писалось только в extras журнала:
 * журнал показывал «Оплачено 2 000», а касса — 0 (reports.md). Уже оплачено — ничего не делаем.
 */
async function payThroughFinance(bookingId: Id, method: "cash" | "card"): Promise<void> {
  const businessId = await businessOfBooking(bookingId);
  if (!businessId) return;
  const summary = await getBookingPaymentSummary(businessId, bookingId);
  if (summary.due > 0) await payBookingQuick(businessId, bookingId, method);
}

// ─────────────────────────── Окно «Оплата визита» (F-01-138…146, F-01-151, F-01-084) ───────────────────────────

export interface JournalPaymentLineInput {
  method: JournalPaymentMethod;
  amount: Money;
  label: string;
  cashRegister?: string;
  refId?: Id;
}

/**
 * F-01-138 (быстрая) / F-01-139 (раздельная): добавляет одну или несколько строк оплаты к визиту и
 * пересчитывает `paidAmount` как их сумму. Не трогает лояльность/счета клиента — списание чужой
 * сущности (абонемент/сертификат/бонусы карты) вызывающий код проводит отдельно через `@/api/loyalty`
 * до этого вызова; `personal_account` целиком демо (см. domain/journal.ts).
 */
export function payBookingLines(
  bookingId: Id,
  lines: JournalPaymentLineInput[],
): Promise<BookingExtras> {
  if (isApiMode()) return withVisitSale(bookingId, S.payLines(bookingId, lines));
  // Решение владельца 01.10.2026: наличные и карта окна «Оплата визита» — через кассу, как в режиме api (приход,
  // строка платежа визита и строка журнала пишет finance). Лояльность (refId) и прочие способы — строками журнала.
  const money = lines.filter(isCashLine);
  const rest = lines.filter((l) => !isCashLine(l));
  return withVisitSale(bookingId, (async () => {
    if (money.length > 0) await payMoneyThroughFinance(bookingId, money);
    if (rest.length === 0) return getBookingExtras(bookingId);
    return addJournalPaymentLines(bookingId, rest);
  })());
}

function isCashLine(l: { method: string; refId?: Id }): boolean {
  return (l.method === "cash" || l.method === "card") && !l.refId;
}

/** Мок: деньги окна журнала — раздельной оплатой кассы; сумма не больше остатка, который считает касса */
async function payMoneyThroughFinance(bookingId: Id, money: JournalPaymentLineInput[]): Promise<void> {
  const businessId = await businessOfBooking(bookingId);
  if (!businessId) throw new ApiError("not_found");
  const summary = await getBookingPaymentSummary(businessId, bookingId);
  let left = summary.due;
  const parts: { methodKey: string; amount: Money }[] = [];
  for (const l of money) {
    const amount = Math.min(l.amount, left);
    if (amount <= 0) break;
    parts.push({ methodKey: l.method, amount });
    left -= amount;
  }
  if (parts.length > 0) await payBookingSplit(businessId, bookingId, parts);
}

function addJournalPaymentLines(bookingId: Id, lines: JournalPaymentLineInput[]): Promise<BookingExtras> {
  return request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      const newLines: JournalPaymentLine[] = lines.map((l) => ({
        ...l,
        id: newId("pay"),
        at: nowDateTime(),
      }));
      const payments = [...(current.payments ?? []), ...newLines];
      result = {
        ...current,
        payments,
        paidAmount: payments.reduce((sum, l) => sum + l.amount, 0),
      };
      s.extras[bookingId] = result;
    });
    return result;
  });
}

/**
 * F-01-143: удаляет одну ошибочную строку оплаты («корзина» у платежа); визит, у которого сумма
 * платежей стала меньше «К оплате», возвращается в «Оплачен не полностью» — статус читает
 * `paidAmount` как и раньше, здесь только сама сумма и список строк.
 */
export function cancelPaymentLine(
  bookingId: Id,
  lineId: Id,
): Promise<BookingExtras> {
  if (isApiMode()) return withVisitSale(bookingId, S.cancelPaymentLine(bookingId, lineId));
  // Платёж кассы: отмена снимает приход (и расходы «Возврат» по нему), строку журнала убирает finance
  return withVisitSale(bookingId, financeLineOfJournalLine(bookingId, lineId).then(async (fin) => {
    if (fin) {
      await removeBookingPaymentLine(fin.businessId, fin.financeLineId);
      return getBookingExtras(bookingId);
    }
    return removeJournalPaymentLine(bookingId, lineId);
  }));
}

function removeJournalPaymentLine(bookingId: Id, lineId: Id): Promise<BookingExtras> {
  return request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      const payments = (current.payments ?? []).filter((l) => l.id !== lineId);
      result = {
        ...current,
        payments,
        paidAmount: payments.reduce((sum, l) => sum + l.amount, 0),
      };
      s.extras[bookingId] = result;
    });
    return result;
  });
}

/**
 * F-01-212: частичный возврат за оплаченную строку визита — уменьшает сумму строки на `amount`
 * (не может уйти в минус), не убирая её целиком автоматически, только когда остаток дошёл до нуля.
 * Полный возврат — тот же приём с `amount` равным всей строке (эквивалентен `cancelPaymentLine`).
 */
export function refundPaymentLine(
  bookingId: Id,
  lineId: Id,
  amount: Money,
): Promise<BookingExtras> {
  if (isApiMode()) return withVisitSale(bookingId, S.refundPaymentLine(bookingId, lineId, amount));
  // Платёж кассы: расход «Возврат», визит снова ждёт возвращённую часть; строку журнала уменьшает finance
  return withVisitSale(bookingId, financeLineOfJournalLine(bookingId, lineId).then(async (fin) => {
    if (fin) {
      await refundBookingPayment(fin.businessId, fin.financeLineId, amount, "");
      return getBookingExtras(bookingId);
    }
    return refundJournalPaymentLine(bookingId, lineId, amount);
  }));
}

function refundJournalPaymentLine(bookingId: Id, lineId: Id, amount: Money): Promise<BookingExtras> {
  return request(() => {
    let result!: BookingExtras;
    mutateArea("journal", (s) => {
      const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
      const payments = (current.payments ?? [])
        .map((l) =>
          l.id === lineId ? { ...l, amount: Math.max(0, l.amount - amount) } : l,
        )
        .filter((l) => l.amount > 0);
      result = {
        ...current,
        payments,
        paidAmount: payments.reduce((sum, l) => sum + l.amount, 0),
      };
      s.extras[bookingId] = result;
    });
    return result;
  });
}

// ─────────────────────────── «Новый платёж» (F-01-151, F-01-084) ───────────────────────────

export interface CreateLedgerEntryInput {
  locationId: Id;
  at: ISODateTime;
  category: JournalLedgerCategory;
  cashRegister: string;
  counterpartyType: JournalLedgerCounterpartyType;
  counterpartyName: string;
  amount: Money;
  comment?: string;
  createdByStaffId?: Id;
}

/**
 * F-01-151: платёж без визита («Новый платеж» в левой панели журнала) и F-01-084 (штраф — тот же
 * экран, статья «Списание штрафа»). Настоящие «Счета и кассы»/«Финансовые операции» — раздел
 * «Финансы» (не построен) — временный демо-леджер в своём срезе, см. qa/requests/journal.md; поэтому
 * пункт «виден в финансовых операциях» из F-01-151 закрыть отсюда нельзя, только «платёж создаётся».
 */
export function createLedgerEntry(
  input: CreateLedgerEntryInput,
): Promise<JournalLedgerEntry> {
  if (isApiMode()) return JM.createLedger(input);
  return request(() => {
    const entry: JournalLedgerEntry = { id: newId("ledger"), ...input };
    mutateArea("journal", (s) => {
      s.ledgerEntries = [entry, ...s.ledgerEntries];
    });
    return entry;
  });
}

export function listLedgerEntries(locationId: Id): Promise<JournalLedgerEntry[]> {
  if (isApiMode()) return JM.ledger(locationId);
  return request(() =>
    readArea("journal")
      .ledgerEntries.filter((e) => e.locationId === locationId)
      .sort((a, b) => (a.at < b.at ? 1 : -1)),
  );
}

/** «Отмена» операции = удаление (CYCLE-REPORT); запись остаётся видна с `canceled: true` (фильтр «Отменённые» — F-01-151) */
export function cancelLedgerEntry(entryId: Id): Promise<void> {
  if (isApiMode()) return JM.cancelLedger(entryId);
  return request(() => {
    mutateArea("journal", (s) => {
      const entry = s.ledgerEntries.find((e) => e.id === entryId);
      if (entry) entry.canceled = true;
    });
  });
}

// ─────────────────────────── Повторение записи (F-01-100…107) ───────────────────────────

export function getRecurrenceTemplates(): Promise<RecurrenceTemplate[]> {
  if (isApiMode()) return S.getConfig().then((c) => c.recurrenceTemplates);
  return request(() => readArea("journal").recurrenceTemplates);
}

/** Сохранить текущее правило под именем шаблона (F-01-101) — переиспользуется в других записях */
export function saveRecurrenceTemplate(
  name: string,
  rule: RecurrenceRule,
): Promise<RecurrenceTemplate> {
  if (isApiMode()) return S.addRecurrenceTemplate(name, rule);
  return request(() => {
    const tpl: RecurrenceTemplate = { id: newId("rt"), name, rule };
    mutateArea("journal", (s) => {
      s.recurrenceTemplates.push(tpl);
    });
    return tpl;
  });
}

export interface CreateSeriesResult {
  created: Booking[];
  /** Сколько повторов пропущено из-за занятого времени мастера (F-01-106) */
  skipped: number;
}

/**
 * Создаёт серию повторов по образцу сохранённой записи (F-01-100, F-01-106):
 *  - копии — самостоятельные записи с общим seriesId, без связи друг с другом (F-01-107);
 *  - копии НЕ наследуют предоплату/срок исходной записи (360426);
 *  - попадание на занятое время мастера пропускается, а не создаёт двойную запись (F-00-045).
 */
export async function createRecurrenceSeries(
  source: Booking,
  rule: RecurrenceRule,
): Promise<CreateSeriesResult> {
  if (isApiMode()) return S.createRecurrence(source.id, rule, generateOccurrenceDates(rule)).then((r) => ({ created: r.created, skipped: r.skipped }));
  const dates = generateOccurrenceDates(rule);
  const seriesId = newId("series");
  const created: Booking[] = [];
  let skipped = 0;
  for (const date of dates) {
    const start = combine(date, rule.time);
    const overlapped = await hasOverlap(
      source.staffId,
      start,
      source.durationMin,
    );
    if (overlapped) {
      skipped += 1;
      continue;
    }
    const booking = await coreCreate("bookings", {
      businessId: source.businessId,
      locationId: source.locationId,
      staffId: source.staffId,
      clientId: rule.withClient ? source.clientId : undefined,
      start,
      durationMin: source.durationMin,
      status: "scheduled",
      services: source.services,
      total: source.total,
      resourceIds: source.resourceIds,
      workplace: source.workplace,
      source: source.source,
      createdBy: source.createdBy,
      forWhom: source.forWhom,
      comment: source.comment,
      seriesId,
      createdAt: nowDateTime(),
      updatedAt: nowDateTime(),
    });
    created.push(booking);
  }
  return { created, skipped };
}

/** Все записи серии, кроме исходной (F-01-107) — для «удалить всю серию» и для показа в окне */
export function listSeriesBookings(seriesId: Id): Promise<Booking[]> {
  if (isApiMode()) return S.seriesBookings(seriesId);
  return request(() =>
    readCore().bookings.filter((b) => b.seriesId === seriesId && !b.deletedAt),
  );
}

/** Удалить всю серию разом (F-01-107) — по одной, но одним действием пользователя; друг на друга не влияют */
export async function deleteSeries(
  seriesId: Id,
  byName: string,
): Promise<number> {
  if (isApiMode()) return S.deleteSeriesBookings(seriesId, byName);
  const bookings = await listSeriesBookings(seriesId);
  for (const b of bookings) await deleteBookingWithAuthor(b.id, byName);
  return bookings.length;
}

// ═══════════════════════════ b04 · вокруг журнала ═══════════════════════════

// ─────────────────────────── F-01-005: избранное ───────────────────────────

/**
 * Список закреплённых разделов пользователя. ⭐ Звёздочка у заголовка любого раздела — часть
 * `PageHeader` (foundation, он её сегодня не умеет) — до просьбы (qa/requests/journal.md) звёздочка
 * есть только у заголовка самого журнала; список готов принять записи любых других разделов.
 */
export function getFavorites(staffId: Id): Promise<FavoriteSection[]> {
  if (isApiMode()) return JM.prefs(staffId).then((p) => p.favorites);
  return request(() => readArea("journal").favorites[staffId] ?? []);
}

export function isFavorite(staffId: Id, sectionId: string): Promise<boolean> {
  if (isApiMode()) return JM.prefs(staffId).then((p) => p.favorites.some((f) => f.id === sectionId));
  return request(() =>
    (readArea("journal").favorites[staffId] ?? []).some(
      (f) => f.id === sectionId,
    ),
  );
}

export function toggleFavorite(
  staffId: Id,
  section: FavoriteSection,
): Promise<FavoriteSection[]> {
  if (isApiMode())
    return JM.prefs(staffId).then((p) => {
      const next = p.favorites.some((f) => f.id === section.id)
        ? p.favorites.filter((f) => f.id !== section.id)
        : [...p.favorites, section];
      return JM.patchPrefs(staffId, { favorites: next }).then((r) => r.favorites);
    });
  return request(() => {
    mutateArea("journal", (s) => {
      const list = s.favorites[staffId] ?? [];
      const idx = list.findIndex((f) => f.id === section.id);
      const next =
        idx >= 0 ? list.filter((f) => f.id !== section.id) : [...list, section];
      s.favorites[staffId] = next;
    });
    return readArea("journal").favorites[staffId] ?? [];
  });
}

// ─────────────────────────── F-01-011: сводка дня ───────────────────────────

export interface DaySummary {
  /** «Поступлений в кассы» */
  cashIn: Money;
  cash: Money;
  cashless: Money;
  doneTotal: Money;
  bookedTotal: Money;
  loyaltyTotal: Money;
  goodsTotal: Money;
  clientsCount: number;
}

/**
 * F-01-011: сводка дня (касса за день). ⭐ Способ оплаты (нал/безнал) и оплата лояльностью
 * (сертификаты/абонементы/бонусы) отдельной строкой ещё не хранятся (раздел «Финансы» их не
 * считает) — «Наличными» = все поступления, «Безналом» и «Лояльность» временно 0, см.
 * qa/requests/journal.md.
 */
export function getDaySummary(
  businessId: Id,
  date: ISODate,
): Promise<DaySummary> {
  if (isApiMode()) return JM.daySummary(businessId, date);
  return request(() => {
    const core = readCore();
    const area = readArea("journal");
    const bookings = core.bookings.filter(
      (b) =>
        b.businessId === businessId && !b.deletedAt && b.start.startsWith(date),
    );
    const clientIds = new Set<Id>();
    let bookedTotal = 0;
    let doneTotal = 0;
    let goodsTotal = 0;
    let cashIn = 0;
    for (const b of bookings) {
      bookedTotal += b.total;
      if (b.clientId) clientIds.add(b.clientId);
      const extras = area.extras[b.id];
      const lineGoodsTotal = extras
        ? extras.goodsLines.reduce(
            (sum, g) =>
              sum + Math.round(g.price * g.qty * (1 - g.discountPct / 100)),
            0,
          )
        : 0;
      goodsTotal += lineGoodsTotal;
      if (b.status === "arrived") doneTotal += b.total + lineGoodsTotal;
      cashIn += extras?.paidAmount ?? 0;
    }
    return {
      cashIn,
      cash: cashIn,
      cashless: 0,
      doneTotal,
      bookedTotal,
      loyaltyTotal: 0,
      goodsTotal,
      clientsCount: clientIds.size,
    };
  });
}

// ─────────────────────────── F-01-096: история изменений записи ───────────────────────────

export function getBookingHistory(
  bookingId: Id,
): Promise<BookingHistoryEntry[]> {
  if (isApiMode()) return S.history(bookingId);
  return request(() =>
    (readArea("journal").history[bookingId] ?? [])
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

export function logBookingHistory(
  bookingId: Id,
  authorName: string,
  action: BookingHistoryEntry["action"],
  summary: string,
): Promise<BookingHistoryEntry> {
  if (isApiMode()) return S.logHistory(bookingId, { authorName, action, summary });
  return request(() => {
    const entry: BookingHistoryEntry = {
      id: newId("bh"),
      bookingId,
      authorName,
      action,
      summary,
      at: nowDateTime(),
    };
    mutateArea("journal", (s) => {
      const list = s.history[bookingId] ?? [];
      s.history[bookingId] = [...list, entry];
    });
    return entry;
  });
}

// ─────────────────────────── F-01-127…129: посетитель ───────────────────────────

export interface VisitorHistoryItem {
  bookingId: Id;
  start: ISODateTime;
  staffId: Id;
  status: BookingStatus;
}

/** F-01-129: история визитов посетителя — считаем по записям того же клиента с тем же именем посетителя */
export function getVisitorHistory(
  clientId: Id,
  visitorName: string,
): Promise<VisitorHistoryItem[]> {
  if (isApiMode())
    return S.listBookings({ clientId }).then((list) =>
      list
        .filter((b) => b.visitorName === visitorName && !b.deletedAt)
        .sort((a, b) => b.start.localeCompare(a.start))
        .map((b) => ({ bookingId: b.id, start: b.start, staffId: b.staffId, status: b.status })),
    );
  return request(() =>
    readCore()
      .bookings.filter(
        (b) =>
          b.clientId === clientId &&
          b.visitorName === visitorName &&
          !b.deletedAt,
      )
      .sort((a, b) => b.start.localeCompare(a.start))
      .map((b) => ({
        bookingId: b.id,
        start: b.start,
        staffId: b.staffId,
        status: b.status,
      })),
  );
}

// ─────────────────────────── F-01-163: панель «Клиенты» — последние записи ───────────────────────────

export interface ClientRecentBooking {
  id: Id;
  start: ISODateTime;
  staffId: Id;
  total: Money;
  status: BookingStatus;
  locationId: Id;
}

/** Не больше 25 (F-01-163); товары, скидки и комментарии здесь не показываем — по ТЗ */
export function getClientRecentBookings(
  clientId: Id,
  limit = 25,
): Promise<ClientRecentBooking[]> {
  if (isApiMode())
    return S.listBookings({ clientId }).then((list) =>
      list
        .filter((b) => !b.deletedAt)
        .sort((a, b) => b.start.localeCompare(a.start))
        .slice(0, limit)
        .map((b) => ({ id: b.id, start: b.start, staffId: b.staffId, total: b.total, status: b.status, locationId: b.locationId })),
    );
  return request(() =>
    readCore()
      .bookings.filter((b) => b.clientId === clientId && !b.deletedAt)
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, limit)
      .map((b) => ({
        id: b.id,
        start: b.start,
        staffId: b.staffId,
        total: b.total,
        status: b.status,
        locationId: b.locationId,
      })),
  );
}

// ─────────────────────────── F-01-016: сотрудник в расписание дня ───────────────────────────

export interface AddStaffToScheduleInput {
  staffId: Id;
  hours: DayHours;
  locationId?: Id;
}

/**
 * F-01-016: ставит сотрудников работать в открытый день, не заходя в «График работы» — тонкая
 * обёртка над setDayHours() раздела schedule (своя функция там уже есть, сигнатуру не меняем).
 */
export async function addStaffToScheduleDay(
  date: ISODate,
  inputs: AddStaffToScheduleInput[],
  actorName: string,
): Promise<void> {
  for (const input of inputs) {
    await setDayHours(
      input.staffId,
      date,
      input.hours,
      actorName,
      input.locationId,
    );
  }
}

// ─────────────────────────── F-01-122: массовое удаление в «Записях» ───────────────────────────

export interface BulkDeleteItem {
  id: Id;
  status: BookingStatus;
  paidAmount: Money;
}

export interface BulkDeleteResult {
  deletedIds: Id[];
  skippedIds: Id[];
}

/** F-01-085/F-01-122: оплаченные и «Клиент пришёл» пропускаются — пользователь видит, какие именно */
export async function bulkDeleteBookings(
  items: BulkDeleteItem[],
  authorName: string,
): Promise<BulkDeleteResult> {
  const deletedIds: Id[] = [];
  const skippedIds: Id[] = [];
  for (const item of items) {
    if (item.status === "arrived" || item.paidAmount > 0) {
      skippedIds.push(item.id);
      continue;
    }
    await deleteBookingWithAuthor(item.id, authorName);
    deletedIds.push(item.id);
  }
  return { deletedIds, skippedIds };
}

// ─────────────────────────── F-01-182/183: импорт и выгрузка «Записей» ───────────────────────────

export interface ImportRow {
  dateTime: string;
  staffId: Id;
  clientPhone: string;
  clientName?: string;
  durationMin?: number;
  serviceName: string;
  price: number;
  discountPct?: number;
  comment?: string;
  statusRaw: string;
  paidAmount?: number;
}

export interface ImportResult {
  createdCount: number;
  errorCount: number;
  errors: string[];
}

const IMPORT_STATUS_MAP: Record<string, BookingStatus> = {
  "-1": "no_show",
  "0": "scheduled",
  "1": "arrived",
  "2": "client_confirmed",
  "не пришел": "no_show",
  ожидание: "scheduled",
  пришел: "arrived",
  подтвердил: "client_confirmed",
};

/**
 * F-01-182: импорт визитов из Excel. ⭐ Разбор самого .xlsx-файла (столбцы, «##», округление к
 * шагу сетки) — работа для отдельной библиотеки парсинга, которой в проекте пока нет; здесь —
 * готовые строки после разбора (до 5000 за раз по ТЗ), сама привязка к клиенту/статусу/оплате
 * настоящая, не демо.
 */
export async function importBookingRows(
  businessId: Id,
  locationId: Id,
  createdBy: Id,
  rows: ImportRow[],
): Promise<ImportResult> {
  if (isApiMode()) return S.importRows(businessId, locationId, createdBy, rows);
  // F-01-182 (qa/full-test-0930/journal-perms.md): загрузка заводит клиентов — нужно clients.edit; записи чужим
  // мастерам отсекает сам createBooking (journal.create с targetStaffId)
  assertCan("clients.edit");
  let createdCount = 0;
  const errors: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      const normalized = normalizePhone(row.clientPhone);
      if (!normalized) throw new Error("phone");
      let client = await findClientByPhone(businessId, normalized);
      if (!client) {
        client = await coreCreate("clients", {
          businessId,
          phone: normalized,
          name: row.clientName || normalized,
          gender: "unknown",
          tags: [],
          noShowCount: 0,
          createdAt: nowDateTime(),
        });
      }
      const { date: importDate, time: importTime } = parseImportDateTime(
        row.dateTime,
      );
      const start = combine(importDate, importTime);
      const status =
        IMPORT_STATUS_MAP[row.statusRaw.trim().toLowerCase()] ?? "scheduled";
      const durationMin = Math.max(
        15,
        Math.round((row.durationMin ?? 15) / 15) * 15,
      );
      const price = Math.round(row.price * (1 - (row.discountPct ?? 0) / 100));
      const booking = await createBooking({
        businessId,
        locationId,
        staffId: row.staffId,
        clientId: client.id,
        start,
        durationMin,
        status,
        services: [
          {
            serviceId: "imported",
            staffId: row.staffId,
            price,
            durationMin,
            qty: 1,
          },
        ],
        resourceIds: [],
        workplace: "salon",
        source: "import",
        createdBy,
        forWhom: "self",
        comment: row.comment,
      });
      if (status === "arrived" && row.paidAmount)
        await setBookingExtras(booking.id, { paidAmount: row.paidAmount });
      createdCount += 1;
    } catch {
      errors.push(
        `${t01182RowLabel(index)}: ${row.clientName || row.clientPhone}`,
      );
    }
  }
  await logExportOrImport("import", createdCount);
  return { createdCount, errorCount: errors.length, errors };
}

/** «04.01.2022 10:30» → ISODate + TimeHM (F-01-182, столбец «дата») */
function parseImportDateTime(value: string): { date: ISODate; time: TimeHM } {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error("bad_date");
  const [, dd, mm, yyyy, hh, min] = m;
  return {
    date: `${yyyy}-${mm}-${dd}` as ISODate,
    time: `${hh}:${min}` as TimeHM,
  };
}

function t01182RowLabel(index: number): string {
  return `#${index + 2}`; // первая строка файла пропускается (F-01-182)
}

/** F-01-182/183: «журнал выгрузок» — каждый видит только свои (по authorStaffId в UI) */
export function logExportOrImport(
  kind: "import" | "export",
  count: number,
  authorStaffId: Id = "",
): Promise<DataOpsLogEntry> {
  if (isApiMode()) return S.logDataOp(kind, count);
  return request(() => {
    const entry: DataOpsLogEntry = {
      id: newId("dop"),
      kind,
      count,
      authorStaffId,
      at: nowDateTime(),
    };
    mutateArea("journal", (s) => {
      s.dataOpsLog = [...(s.dataOpsLog ?? []), entry];
    });
    return entry;
  });
}

export function getDataOpsLog(authorStaffId: Id): Promise<DataOpsLogEntry[]> {
  if (isApiMode()) return S.dataOps().then((list) => list.filter((e) => e.authorStaffId === authorStaffId));
  return request(() =>
    (readArea("journal").dataOpsLog ?? [])
      .filter((e) => e.authorStaffId === authorStaffId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

/** F-01-183: «выгрузка» — демо шлёт ссылкой на почту пользователя, реально просто пишет журнал */
export async function exportBookingsToEmail(
  businessId: Id,
  authorStaffId: Id,
  email: string,
  count: number,
): Promise<{ ok: true; email: string }> {
  // F-01-183: выгрузка клиентских данных — право clients.export (CONVENTIONS §16.5)
  assertCan("clients.export");
  await logExportOrImport("export", count, authorStaffId);
  return { ok: true, email };
}

// ─────────────────────────── F-01-113, 134…136: пакеты (комплексы) ───────────────────────────

export interface PackagePlanStep {
  serviceId: Id;
  staffId: Id;
  durationMin: number;
  bufferAfterMin?: number;
  name: string;
  price: Money;
}

/** F-01-134: слоты, где весь пакет помещается — обёртка над computePackageSlots() раздела schedule */
export function getPackageSlots(
  locationId: Id,
  date: ISODate,
  steps: PackagePlanStep[],
  order: PackageOrderMode,
): Promise<{ start: ISODateTime; end: ISODateTime }[]> {
  if (isApiMode()) return JM.packageSlots(locationId, date, steps, order);
  return request(() => {
    const core = readCore();
    const input: PackageServiceInput[] = steps.map((s) => ({
      serviceId: s.serviceId,
      staffId: s.staffId,
      durationMin: s.durationMin,
      bufferAfterMin: s.bufferAfterMin,
    }));
    const scheduleOrder: PackageOrder =
      order === "parallel" ? "parallel" : "sequential_one";
    return computePackageSlots(core, locationId, date, input, scheduleOrder);
  });
}

export interface CreatePackageInput {
  businessId: Id;
  locationId: Id;
  clientId?: Id;
  start: ISODateTime;
  order: PackageOrderMode;
  steps: PackagePlanStep[];
  createdBy: Id;
  comment?: string;
}

export interface CreatePackageResult {
  groupId: Id;
  bookings: Booking[];
}

/**
 * F-01-134: создаёт связанные записи пакета — параллельно (все услуги в один `start`) или
 * последовательно одним мастером (следующая услуга начинается сразу после предыдущей + её перерыв).
 * ⚠️ «Последовательно несколькими специалистами» (119203) не строим — справка сама называет это
 * противоречием («сейчас последовательный пакет оказывает только один мастер»), см. F-01-134.
 */
export async function createPackageBooking(
  input: CreatePackageInput,
): Promise<CreatePackageResult> {
  if (isApiMode()) return S.createPackage(input.businessId, { locationId: input.locationId, clientId: input.clientId, start: input.start, order: input.order, steps: input.steps, createdBy: input.createdBy, comment: input.comment });
  const groupId = newId("pkg");
  const bookings: Booking[] = [];
  let cursor = input.start;
  for (const step of input.steps) {
    const start = input.order === "parallel" ? input.start : cursor;
    const booking = await createBooking({
      businessId: input.businessId,
      locationId: input.locationId,
      staffId: step.staffId,
      clientId: input.clientId,
      start,
      durationMin: step.durationMin,
      status: "scheduled",
      services: [
        {
          serviceId: step.serviceId,
          staffId: step.staffId,
          price: step.price,
          durationMin: step.durationMin,
          qty: 1,
        },
      ],
      resourceIds: [],
      workplace: "salon",
      source: "journal",
      createdBy: input.createdBy,
      forWhom: "self",
      comment: input.comment,
    });
    bookings.push(booking);
    await setBookingExtras(booking.id, { packageGroupId: groupId });
    if (input.order === "sequential_one") {
      const nextMin =
        toMinutes(cursor.slice(11, 16)) +
        step.durationMin +
        (step.bufferAfterMin ?? 0);
      cursor = combine(cursor.slice(0, 10), fromMinutes(nextMin));
    }
  }
  await request(() => {
    const group: PackageGroup = {
      id: groupId,
      businessId: input.businessId,
      order: input.order,
      bookingIds: bookings.map((b) => b.id),
      createdAt: nowDateTime(),
    };
    mutateArea("journal", (s) => {
      s.packageGroups[groupId] = group;
    });
  });
  return { groupId, bookings };
}

export function getPackageGroup(
  groupId: Id,
): Promise<PackageGroup | undefined> {
  if (isApiMode()) return S.getPackage(groupId);
  return request(() => readArea("journal").packageGroups[groupId]);
}

export interface PackageSibling {
  booking: Booking;
  staffName: string;
}

/** F-01-113/136: другие записи того же пакета — для блока «Связанные записи», переноса и удаления */
export async function getPackageSiblings(
  bookingId: Id,
): Promise<PackageSibling[]> {
  if (isApiMode()) return S.packageSiblings(bookingId);
  const extras = await getBookingExtras(bookingId);
  if (!extras.packageGroupId) return [];
  const group = await getPackageGroup(extras.packageGroupId);
  if (!group) return [];
  const core = readCore();
  return group.bookingIds
    .filter((id) => id !== bookingId)
    .map((id) => core.bookings.find((b) => b.id === id))
    .filter((b): b is Booking => b !== undefined && !b.deletedAt)
    .map((b) => ({
      booking: b,
      staffName: core.staff.find((s) => s.id === b.staffId)?.name ?? "",
    }));
}

/** F-01-113: переносит все записи пакета на ту же разницу во времени, что и главную */
export async function transferPackageTogether(
  bookingId: Id,
  deltaMin: number,
  authorName: string,
): Promise<void> {
  if (isApiMode()) return S.transferPackage(bookingId, deltaMin, authorName);
  const siblings = await getPackageSiblings(bookingId);
  for (const { booking } of siblings) {
    const startMin =
      (((toMinutes(booking.start.slice(11, 16)) + deltaMin) % 1440) + 1440) %
      1440;
    const newStart = combine(booking.start.slice(0, 10), fromMinutes(startMin));
    await updateBooking(booking.id, { start: newStart });
    await logBookingHistory(
      booking.id,
      authorName,
      "updated",
      "Перенесено вместе с пакетом",
    );
  }
}

/** F-01-136 «удалить пакет» — все услуги из всех связанных записей */
export async function deleteWholePackage(
  bookingId: Id,
  authorName: string,
): Promise<Id[]> {
  if (isApiMode()) return S.deletePackage(bookingId, authorName);
  const extras = await getBookingExtras(bookingId);
  const groupId = extras.packageGroupId;
  const group = groupId ? await getPackageGroup(groupId) : undefined;
  const all = group ? group.bookingIds : [bookingId];
  const deleted: Id[] = [];
  for (const id of all) {
    await deleteBookingWithAuthor(id, authorName);
    deleted.push(id);
  }
  return deleted;
}

// ─────────────── F-16-125, F-16-129, F-16-130: пакет, добавленный в открытое окно записи ───────────────

export interface LinkedBookingPlan {
  staffId: Id;
  start: ISODateTime;
  lines: { serviceId: Id; price: Money; durationMin: number }[];
}

export interface LinkedBookingProblem {
  staffId: Id;
  reason: "busy" | "offHours";
}

/**
 * «Все мастера пакета должны быть свободны в выбранное время и иметь пересекающиеся рабочие часы»
 * (119203) — проверка связанных записей ДО сохранения окна, чтобы не сохранить половину визита.
 */
export function checkLinkedBookings(
  plans: LinkedBookingPlan[],
): Promise<LinkedBookingProblem[]> {
  if (isApiMode()) return S.checkLinked(plans);
  return request(() => {
    const core = readCore();
    const problems: LinkedBookingProblem[] = [];
    for (const plan of plans) {
      const duration = plan.lines.reduce((n, l) => n + l.durationMin, 0);
      if (computeOverlap(core, plan.staffId, plan.start, duration)) {
        problems.push({ staffId: plan.staffId, reason: "busy" });
        continue;
      }
      const hours = computeStaffHours(core, plan.staffId, plan.start.slice(0, 10));
      const from = toMinutes(plan.start.slice(11, 16));
      const inside = hours.some(
        (h) => toMinutes(h.from) <= from && from + duration <= toMinutes(h.to),
      );
      if (!inside) problems.push({ staffId: plan.staffId, reason: "offHours" });
    }
    return problems;
  });
}

/**
 * Создаёт связанные записи пакета к уже сохранённой записи окна одной операцией: записи других мастеров
 * + общая PackageGroup (если запись уже в пакете — новые записи попадают в ЕЁ группу, так в один визит
 * ложится и второй пакет, F-16-130). Дальше работают те же getPackageSiblings / transferPackageTogether /
 * deleteWholePackage, что и у пакета из PackageCreateModal.
 */
export function attachLinkedBookings(input: {
  mainBookingId: Id;
  businessId: Id;
  locationId: Id;
  clientId?: Id;
  createdBy: Id;
  order: PackageOrderMode;
  plans: LinkedBookingPlan[];
}): Promise<Id[]> {
  if (isApiMode()) return S.attachLinked(input);
  return request(() => {
    const created = input.plans.map((plan) =>
      coreTx.createBooking({
        businessId: input.businessId,
        locationId: input.locationId,
        staffId: plan.staffId,
        clientId: input.clientId,
        start: plan.start,
        durationMin: plan.lines.reduce((n, l) => n + l.durationMin, 0),
        status: "scheduled",
        services: plan.lines.map((l) => ({
          serviceId: l.serviceId,
          staffId: plan.staffId,
          price: l.price,
          durationMin: l.durationMin,
          qty: 1,
        })),
        resourceIds: [],
        workplace: "salon",
        source: "journal",
        createdBy: input.createdBy,
        forWhom: "self",
      }),
    );
    const newIds = created.map((b) => b.id);
    mutateArea("journal", (s) => {
      const existingId = s.extras[input.mainBookingId]?.packageGroupId;
      const existing = existingId ? s.packageGroups[existingId] : undefined;
      const groupId = existing?.id ?? newId("pkg");
      s.packageGroups[groupId] = existing
        ? {
            ...existing,
            order: input.order === "parallel" ? "parallel" : existing.order,
            bookingIds: [...existing.bookingIds, ...newIds],
          }
        : {
            id: groupId,
            businessId: input.businessId,
            order: input.order,
            bookingIds: [input.mainBookingId, ...newIds],
            createdAt: nowDateTime(),
          };
      for (const id of [input.mainBookingId, ...newIds]) {
        s.extras[id] = {
          ...(s.extras[id] ?? EMPTY_BOOKING_EXTRAS),
          packageGroupId: groupId,
        };
      }
    });
    return newIds;
  });
}

// ─────────────────────────── Медицинские сферы: «Текущий приём», «Медкарта», «План лечения» (F-01-189…191) ───────────────────────────

const EMPTY_MEDICAL_VISIT_FIELDS = {
  complaints: "",
  diseaseHistory: "",
  lifeHistory: "",
  chronicConditions: "",
  epidemiological: "",
  allergy: "",
  examination: "",
  procedures: "",
  diagnosis: "",
  prescriptions: "",
  recommendations: "",
  comment: "",
} as const;

/** F-01-189: заключение по визиту (по id записи) — пусто, если ещё не заполняли */
export function getMedicalVisit(
  bookingId: Id,
): Promise<MedicalVisitNote | undefined> {
  if (isApiMode()) return S.medicalVisit(bookingId);
  return request(() => readArea("journal").medicalVisits[bookingId]);
}

export function setMedicalVisit(
  bookingId: Id,
  patch: Partial<Omit<MedicalVisitNote, "bookingId" | "updatedAt">>,
  authorName: string,
): Promise<MedicalVisitNote> {
  if (isApiMode()) return S.setMedicalVisit(bookingId, patch as Record<string, string>, authorName);
  return request(() => {
    let result!: MedicalVisitNote;
    mutateArea("journal", (s) => {
      const current: MedicalVisitNote = s.medicalVisits[bookingId] ?? {
        bookingId,
        ...EMPTY_MEDICAL_VISIT_FIELDS,
        authorName,
        updatedAt: nowDateTime(),
      };
      result = {
        ...current,
        ...patch,
        bookingId,
        authorName,
        updatedAt: nowDateTime(),
      };
      s.medicalVisits[bookingId] = result;
    });
    return result;
  });
}

/** F-01-190: медкарта пациента (по id клиента) — пусто, если ещё не заводили */
export function getMedicalCard(
  clientId: Id,
): Promise<MedicalCard | undefined> {
  if (isApiMode()) return S.medicalCard(clientId);
  return request(() => readArea("journal").medicalCards[clientId]);
}

export function setMedicalCard(
  clientId: Id,
  patch: Partial<Omit<MedicalCard, "clientId" | "updatedAt">>,
): Promise<MedicalCard> {
  if (isApiMode()) return S.setMedicalCard(clientId, patch as Record<string, string>);
  return request(() => {
    let result!: MedicalCard;
    mutateArea("journal", (s) => {
      const current: MedicalCard = s.medicalCards[clientId] ?? {
        clientId,
        cardNumber: "",
        filledAt: today(),
        address: "",
        locality: "",
        documentNo: "",
        insurancePolicy: "",
        socialNumber: "",
        maritalStatus: "",
        education: "",
        employment: "",
        workplace: "",
        insuranceCompany: "",
        disability: "",
        bloodType: "",
        allergies: "",
        updatedAt: nowDateTime(),
      };
      result = { ...current, ...patch, clientId, updatedAt: nowDateTime() };
      s.medicalCards[clientId] = result;
    });
    return result;
  });
}

/** F-01-191: список планов лечения клиента, новые — в начале */
export function listTreatmentPlans(clientId: Id): Promise<TreatmentPlan[]> {
  if (isApiMode()) return S.listPlans(clientId);
  return request(() =>
    [...(readArea("journal").treatmentPlans[clientId] ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  );
}

/**
 * F-01-191: цена в плане — минимальная у услуги (Service.priceMin); при смене цены услуги
 * читатели плана берут актуальную минимальную цену заново, а не хранят её застывшей на планах.
 */
export function refreshTreatmentPlanPrices(clientId: Id): Promise<void> {
  if (isApiMode()) return S.refreshPlans(clientId);
  return request(() => {
    const core = readCore();
    mutateArea("journal", (s) => {
      const plans = s.treatmentPlans[clientId];
      if (!plans) return;
      for (const plan of plans) {
        for (const item of plan.items) {
          const svc = core.services.find((sv) => sv.id === item.serviceId);
          if (svc) item.priceMin = svc.priceMin;
        }
      }
    });
  });
}

export async function addTreatmentPlan(
  clientId: Id,
  title: string,
  serviceIds: Id[],
): Promise<TreatmentPlan> {
  if (isApiMode()) return S.addPlan(clientId, title, serviceIds);
  const core = readCore();
  return request(() => {
    let result!: TreatmentPlan;
    mutateArea("journal", (s) => {
      const plan: TreatmentPlan = {
        id: newId("tplan"),
        clientId,
        title,
        items: serviceIds.map((serviceId) => ({
          id: newId("tpi"),
          serviceId,
          priceMin:
            core.services.find((sv) => sv.id === serviceId)?.priceMin ?? 0,
        })),
        createdAt: nowDateTime(),
        updatedAt: nowDateTime(),
      };
      s.treatmentPlans[clientId] = [...(s.treatmentPlans[clientId] ?? []), plan];
      result = plan;
    });
    return result;
  });
}

export function duplicateTreatmentPlan(
  clientId: Id,
  planId: Id,
): Promise<TreatmentPlan | undefined> {
  if (isApiMode()) return S.duplicatePlan(clientId, planId);
  return request(() => {
    let result: TreatmentPlan | undefined;
    mutateArea("journal", (s) => {
      const plans = s.treatmentPlans[clientId] ?? [];
      const source = plans.find((p) => p.id === planId);
      if (!source) return;
      const copy: TreatmentPlan = {
        ...source,
        id: newId("tplan"),
        title: `${source.title} · copy`,
        items: source.items.map((i) => ({ ...i, id: newId("tpi") })),
        createdAt: nowDateTime(),
        updatedAt: nowDateTime(),
      };
      s.treatmentPlans[clientId] = [...plans, copy];
      result = copy;
    });
    return result;
  });
}

export function deleteTreatmentPlan(
  clientId: Id,
  planId: Id,
): Promise<void> {
  if (isApiMode()) return S.deletePlan(clientId, planId);
  return request(() => {
    mutateArea("journal", (s) => {
      s.treatmentPlans[clientId] = (s.treatmentPlans[clientId] ?? []).filter(
        (p) => p.id !== planId,
      );
    });
  });
}

// ─────────────────────────── F-01-070: примечание о клиенте в окне записи ───────────────────────────

/**
 * Показ читает override (если правили из окна записи), иначе Client.note/tags из ядра как есть —
 * см. комментарий у clientNoteOverrides в domain/journal.ts.
 */
export function getClientNoteForWindow(client: Client): Promise<{
  note: string;
  tags: string[];
}> {
  if (isApiMode()) return Promise.resolve({ note: client.note ?? "", tags: client.tags ?? [] });
  return request(() => {
    const s = readArea("journal");
    return {
      note: s.clientNoteOverrides[client.id] ?? client.note ?? "",
      tags: s.clientTagOverrides[client.id] ?? client.tags ?? [],
    };
  });
}

export function setClientNoteForWindow(
  clientId: Id,
  note: string,
): Promise<void> {
  if (isApiMode()) return S.setClientNote(clientId, note);
  return request(() => {
    mutateArea("journal", (s) => {
      s.clientNoteOverrides[clientId] = note;
    });
  });
}

export function setClientTagsForWindow(
  clientId: Id,
  tags: string[],
): Promise<void> {
  if (isApiMode()) return S.setClientTags(clientId, tags);
  return request(() => {
    mutateArea("journal", (s) => {
      s.clientTagOverrides[clientId] = tags;
    });
  });
}

// ─────────────────────────── F-01-156…162: лист ожидания ───────────────────────────

/* F-01-156…162: сами заявки листа ожидания — в api/resources.ts (один лист бизнеса на экран /biz/waitlist и панель
   журнала, владелец 30.09.2026): useWaitlist, addToWaitlist, updateWaitlistEntry, closeWaitlistEntry, removeWaitlistEntry.
   Здесь осталось только состояние панели. */

/** F-01-156: панель помнит «открыта/закрыта» после перезагрузки — ключ по сотруднику */
export function getWaitlistPanelOpen(staffId: Id): Promise<boolean> {
  if (isApiMode()) return JM.prefs(staffId).then((p) => p.waitlistPanelOpen);
  return request(() => readArea("journal").waitlistPanelOpen[staffId] ?? false);
}

export function setWaitlistPanelOpen(
  staffId: Id,
  open: boolean,
): Promise<void> {
  if (isApiMode()) return JM.patchPrefs(staffId, { waitlistPanelOpen: open }).then(() => undefined);
  return request(() => {
    mutateArea("journal", (s) => {
      s.waitlistPanelOpen[staffId] = open;
    });
  });
}

// ─────────────────────────── Режим api (этап 7): помощники ───────────────────────────

/** Интервал склейки визита → режим настройки (F-01-172), как getVisitGroupingMode мока */
function visitModeOf(min: number): VisitGroupingMode {
  if (min === 0) return { kind: "perBooking" };
  if (min >= 1440) return { kind: "allDay" };
  const closest = VISIT_GAP_OPTIONS.reduce((best, v) => (Math.abs(v - min) < Math.abs(best - min) ? v : best));
  return { kind: "gapMinutes", minutes: closest };
}

/**
 * F-01-080 в режиме api: балансы абонементов ещё живут в срезе journal браузера (раздел «Лояльность» — этап 11),
 * а итог автосписания — в доп. данных записи на сервере. Считаем здесь один раз и пишем итог на сервер.
 */
async function apiEnsureAutoWriteoff(bookingId: Id): Promise<AutoWriteoffInfo | undefined> {
  const planned = await request(() => {
    const booking = readCore().bookings.find((b) => b.id === bookingId);
    if (!booking || booking.deletedAt || INACTIVE.has(booking.status)) return undefined;
    if (nowDateTime() < booking.start) return undefined;
    const existing = readArea("journal").extras[bookingId]?.autoWriteoff;
    if (existing) return { existing };
    const result = computeAutoWriteoff(readArea("journal"), booking);
    if (!result) return undefined;
    mutateArea("journal", (s) => {
      if (result.status === "written_off" && result.subscriptionId) {
        const sub = s.clientSubscriptions.find((x) => x.id === result.subscriptionId);
        if (sub) sub.remainingVisits = Math.max(0, sub.remainingVisits - 1);
      }
    });
    return { result };
  });
  if (!planned) return undefined;
  if ("existing" in planned) return planned.existing;
  await S.setExtras(bookingId, { autoWriteoff: planned.result });
  return planned.result;
}

/** Удаление с автором (режим api): посещение абонемента возвращается в срез браузера, остальное — сервер */
async function apiDeleteWithAuthor(bookingId: Id, byName: string, byClient: boolean): Promise<Booking> {
  await request(() => mutateArea("journal", (s) => revertAutoWriteoffSync(s, bookingId)));
  return S.removeBooking(bookingId, { byName, byClient });
}

/** Вернуть удалённую (режим api): сервер проверяет срок и занятость; списанное посещение снова списывается у себя */
async function apiRestore(bookingId: Id): Promise<Booking> {
  const restored = await S.restoreBooking(bookingId);
  await request(() =>
    mutateArea("journal", (s) => {
      const info = s.extras[bookingId]?.autoWriteoff;
      if (info?.status === "written_off" && info.subscriptionId) {
        const sub = s.clientSubscriptions.find((x) => x.id === info.subscriptionId);
        if (sub) sub.remainingVisits = Math.max(0, sub.remainingVisits - 1);
      }
    }),
  );
  return restored;
}

/**
 * Подсказка клиента в окне записи (режим api): клиенты бизнеса — на сервере (поиск CRM, этап 5), в зеркале только
 * открытые, поэтому ищем там же, где CRM; найденные кладутся в ядро браузера (зеркало клиентов).
 */
async function apiSearchClients(businessId: Id, query: string): Promise<Client[]> {
  const rawDigits = query.replace(/\D/g, "");
  const digits = rawDigits.startsWith("374") && rawDigits.length > 3 ? rawDigits.slice(3) : rawDigits;
  const q = normalizeSearch(query);
  if (!digits && q.length < 2) return [];
  const C = await import("@/api/clients/clients.server");
  const page = await C.listClients({ businessId, search: digits || query, page: 1, pageSize: 6 });
  const ids = new Set(page.rows.map((r) => r.id));
  return request(() => readCore().clients.filter((c) => ids.has(c.id)).slice(0, 6));
}

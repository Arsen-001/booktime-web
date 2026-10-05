/**
 * Типы раздела «resources» (F-16): ресурсы и групповые события читаются/пишутся как сущности ядра
 * (Resource, GroupEvent — src/domain/core.ts, CRUD через coreList/coreCreate/coreUpdate). Здесь — только
 * то, чего в ядре нет: лист ожидания (арх. заметка core-rules/core-k2/core-k3: resources — владелец сущности).
 *
 * Лист ожидания бизнеса — ОДИН (владелец, 30.09.2026): эти тип, правила и срез resources.waitlist читают и полный
 * экран /biz/waitlist (F-16-149…168), и компактная панель журнала (F-01-156…162). Прежняя вторая реализация журнала
 * (journal.waitlistEntries со «slots») переезжает сюда: `waitlistFromLegacyJournal` ниже, перенос — api/resources.ts.
 *
 * data-f="F-16-094"
 * F-16-094 «Групповая запись во внешних системах» — решение: у нас пока нет ни одного ПОДКЛЮЧЁННОГО
 * внешнего канала записи (Яндекс Карты/Kommo/Reserve with Google и т. п. — integrations area, только
 * интерфейс без настоящих подключений). Поэтому вопрос ТЗ «какие наши каналы показывают групповые события»
 * решён на сейчас тривиально: каналов, которым есть что показывать, ещё нет. Как только integrations заведёт
 * первое настоящее подключение, решение нужно принять заново по месту (не здесь) — задача не в этом файле.
 */
import { addDays, addMinutes, eachDay, parse, toISODate, weekdayIndex } from '@/lib/date';
import type { Id, ISODate, ISODateTime, Minutes, Money, ServiceKind, ServicePackage, TimeHM } from '@/domain/core';
import { localDigits } from '@/lib/phone';
import { normalizeSearch } from '@/lib/text';

type ServicePackageMode = ServicePackage['mode'];

/** Статус заявки листа ожидания (F-16-163): считается функцией, не хранится */
export type WaitlistStatus = 'active' | 'expired' | 'closed';

/** Одна желаемая дата/время заявки — клиент может назвать несколько вариантов */
export interface WaitlistWish {
  /** Нет даты — любой день (из панели журнала: «любой день, но с 10 до 12»); желание без даты не истекает */
  date?: ISODate;
  /** Нет времени и нет intervals — «любое время» этого дня */
  time?: TimeHM;
  /** F-16-153: несколько интервалов внутри одного дня («+ Добавить время»); если задано, замещает `time` в показе */
  intervals?: { from: TimeHM; to: TimeHM }[];
}

/**
 * Откуда заявка (владелец, 30.09.2026: все входы пишут в один лист): сотрудник вручную (экран листа, панель журнала),
 * клиент сам из приложения («Сообщить, когда освободится») или из виджета записи. Нет поля — сотрудник (старые данные).
 */
export type WaitlistSource = 'staff' | 'app' | 'widget';

export interface WaitlistEntry {
  id: Id;
  businessId: Id;
  locationId: Id;
  clientName: string;
  clientPhone: string;
  source?: WaitlistSource;
  /** Встал сам из приложения: ему «Освободилось время» приходит пушем в приложение, он видит заявку у себя */
  appUserId?: Id;
  /** Услуги, которые клиент ждёт (хотя бы одна) */
  serviceIds: Id[];
  /** F-16-152: пусто — «любой специалист»; можно указать нескольких */
  staffIds: Id[];
  wishes: WaitlistWish[];
  comment?: string;
  tags: string[];
  createdAt: ISODateTime;
  /** Заявка закрыта записью — id созданной брони (F-16-163) */
  closedBookingId?: Id;
}

/**
 * Статус заявки (F-16-163): «Активная» — хотя бы одно желание ещё впереди; «Срок истёк» — все прошли;
 * «Закрытая» — по заявке уже создана запись. Желание без даты («любое время») не истекает никогда
 * (вывод из ТЗ: «остаётся активной»).
 */
export function computeWaitlistStatus(entry: Pick<WaitlistEntry, 'wishes' | 'closedBookingId'>, today: ISODate): WaitlistStatus {
  if (entry.closedBookingId) return 'closed';
  if (entry.wishes.length === 0) return 'active';
  const hasOpenWish = entry.wishes.some((w) => !w.date || w.date >= today);
  return hasOpenWish ? 'active' : 'expired';
}

/** Ближайшее ожидаемое желание — для сортировки и показа в свёрнутой карточке */
export function nextWish(entry: Pick<WaitlistEntry, 'wishes'>): WaitlistWish | undefined {
  return [...entry.wishes].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))[0];
}

/** Ближайшее ещё не прошедшее желание (у активной заявки прошлые желания бывают рядом с будущими) */
export function upcomingWish(entry: Pick<WaitlistEntry, 'wishes'>, today: ISODate): WaitlistWish | undefined {
  return nextWish({ wishes: entry.wishes.filter((w) => !w.date || w.date >= today) });
}

// ─────────── Один лист на оба экрана: фильтр, «ждёт ли это окно», черновик формы, перенос старых заявок ───────────

export interface WaitlistRow extends WaitlistEntry {
  status: WaitlistStatus;
}

export interface WaitlistFilter {
  status?: WaitlistStatus | 'all';
  /** «На выбранную дату» (журнал: день сетки) / «На сегодня» / «Все»; заявка без даты подходит любому дню */
  dateMode?: 'selected' | 'today' | 'all';
  selectedDate?: ISODate;
  /** «На ближайшее время» — без даты в конце; «Сначала новые/старые» — по дате создания */
  sort?: 'soonest' | 'newest' | 'oldest';
  /** Имя или цифры телефона */
  query?: string;
}

/** Заявка ждёт этот день: «любое время» (нет желаний), желание без даты или ровно на этот день */
export function waitlistWantsDay(entry: Pick<WaitlistEntry, 'wishes'>, day: ISODate): boolean {
  return entry.wishes.length === 0 || entry.wishes.some((w) => !w.date || w.date === day);
}

/** F-01-156 / F-16-155…158: статус, дата, поиск и сортировка — одно правило для экрана и панели журнала */
export function filterWaitlist(entries: WaitlistEntry[], filter: WaitlistFilter, today: ISODate): WaitlistRow[] {
  let rows: WaitlistRow[] = entries.map((e) => ({ ...e, status: computeWaitlistStatus(e, today) }));
  const status = filter.status ?? 'active';
  if (status !== 'all') rows = rows.filter((e) => e.status === status);
  const dateMode = filter.dateMode ?? 'all';
  const day = dateMode === 'today' ? today : dateMode === 'selected' ? filter.selectedDate : undefined;
  if (day) rows = rows.filter((e) => waitlistWantsDay(e, day));
  const q = normalizeSearch(filter.query ?? '');
  if (q) {
    const digits = q.replace(/\D/g, '');
    rows = rows.filter((e) => normalizeSearch(e.clientName).includes(q) || (digits.length > 0 && localDigits(e.clientPhone).includes(digits)));
  }
  const sort = filter.sort ?? 'soonest';
  return rows.sort((a, b) => {
    if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
    if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
    const da = nextWish(a)?.date;
    const db = nextWish(b)?.date;
    if (da && db && da !== db) return da.localeCompare(db);
    if (da && !db) return -1;
    if (db && !da) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Свободное окно, которое предлагают листу ожидания («Найти окно» → «Предложить», «Свободно сегодня») */
export interface WaitlistSlotTarget {
  businessId: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate;
  time: TimeHM;
}

/**
 * Заявка ждёт это окно: активна, та же услуга (или услуги не заданы), тот же мастер или «любой», желание на этот день
 * (или без дня) и время — любое, точное или внутри интервала [from; to).
 */
export function waitlistWantsSlot(entry: WaitlistEntry, t: WaitlistSlotTarget, today: ISODate): boolean {
  if (entry.businessId !== t.businessId || computeWaitlistStatus(entry, today) !== 'active') return false;
  if (entry.serviceIds.length > 0 && !entry.serviceIds.includes(t.serviceId)) return false;
  if (entry.staffIds.length > 0 && !entry.staffIds.includes(t.staffId)) return false;
  if (entry.wishes.length === 0) return true;
  return entry.wishes.some((w) => {
    if (w.date && w.date !== t.date) return false;
    if (w.intervals?.length) return w.intervals.some((i) => i.from <= t.time && t.time < i.to);
    return !w.time || w.time === t.time;
  });
}

/**
 * «Записать» из заявки: самое раннее свободное окно, которое заявка ждёт (день, время/интервал, мастер). Нет такого —
 * undefined, и окно записи открывается без времени (раньше «Любое время» ставило 10:00 даже на занятое — сохранение падало).
 */
export function pickWaitlistSlot<S extends { staffId: Id; start: ISODateTime }>(entry: WaitlistEntry, slots: S[], today: ISODate): S | undefined {
  const serviceId = entry.serviceIds[0] ?? '';
  return [...slots]
    .sort((a, b) => a.start.localeCompare(b.start))
    .find((s) =>
      waitlistWantsSlot(entry, { businessId: entry.businessId, staffId: s.staffId, serviceId, date: s.start.slice(0, 10), time: s.start.slice(11, 16) as TimeHM }, today),
    );
}

/** Строка формы «когда ждёт»: день (или любой), «любое время» или интервалы — общая для обеих форм */
export interface WaitlistWishDraft {
  date?: ISODate;
  anyTime: boolean;
  intervals: { from: TimeHM; to: TimeHM }[];
}

export function wishesToDrafts(wishes: WaitlistWish[]): WaitlistWishDraft[] {
  if (wishes.length === 0) return [{ anyTime: true, intervals: [] }];
  return wishes.map((w) => ({
    date: w.date,
    anyTime: !w.time && (!w.intervals || w.intervals.length === 0),
    intervals: w.intervals?.length ? w.intervals : w.time ? [{ from: w.time, to: w.time }] : [],
  }));
}

/** Строка «любой день, любое время» — это «ждёт когда угодно» (пустой список желаний), её не храним */
export function draftsToWishes(drafts: WaitlistWishDraft[]): WaitlistWish[] {
  return drafts
    .filter((d) => d.date || (!d.anyTime && d.intervals.length > 0))
    .map((d) => {
      const timed = !d.anyTime && d.intervals.length > 0;
      return {
        ...(d.date ? { date: d.date } : {}),
        // И один интервал хранится целиком: раньше «12:00–15:00» сохранялось как «12:00», а правка открывала «12:00–12:00»
        ...(timed ? { time: d.intervals[0].from, intervals: d.intervals } : {}),
      };
    });
}

/**
 * Заявка старой панели журнала (срез journal.waitlistEntries до 30.09.2026, таблица waitlist_entries.slots на сервере).
 * Живёт только для переноса сохранённых в браузере данных — новых таких не пишем.
 */
export interface LegacyJournalWaitlistEntry {
  id: Id;
  businessId: Id;
  locationId: Id;
  clientName: string;
  clientPhone: string;
  serviceIds?: Id[];
  staffIds?: Id[];
  slots?: { date?: ISODate; anyTime?: boolean; intervals?: { from: TimeHM; to: TimeHM }[] }[];
  comment?: string;
  bookingId?: Id;
  createdAt: ISODateTime;
}

/** Старая заявка журнала → заявка единого листа: слоты → желания, bookingId → closedBookingId, пустой комментарий — нет */
export function waitlistFromLegacyJournal(e: LegacyJournalWaitlistEntry): WaitlistEntry {
  const wishes = draftsToWishes(
    (e.slots ?? []).map((s) => ({ date: s.date, anyTime: s.anyTime ?? true, intervals: s.anyTime ? [] : (s.intervals ?? []) })),
  );
  return {
    id: e.id,
    businessId: e.businessId,
    locationId: e.locationId,
    clientName: e.clientName,
    clientPhone: e.clientPhone,
    serviceIds: e.serviceIds ?? [],
    staffIds: e.staffIds ?? [],
    wishes,
    ...(e.comment?.trim() ? { comment: e.comment.trim() } : {}),
    tags: [],
    createdAt: e.createdAt,
    ...(e.bookingId ? { closedBookingId: e.bookingId } : {}),
  };
}

// ─────────── Входы клиента: приложение и виджет записи пишут в тот же лист (владелец, 30.09.2026) ───────────

/** Один день от клиента («этот день» или «любой день») → желания листа: «любой день» — пустой список (ждёт когда угодно) */
export function wishesForDay(date: ISODate | 'any' | undefined): WaitlistWish[] {
  return date && date !== 'any' ? [{ date }] : [];
}

/** Обратно для приложения клиента: заявка «на один день» показывается этим днём, всё остальное — «любой день» */
export function waitlistDayOf(entry: Pick<WaitlistEntry, 'wishes'>): ISODate | 'any' {
  const dated = entry.wishes.filter((w) => w.date);
  return dated.length === 1 && entry.wishes.length === 1 ? (dated[0].date as ISODate) : 'any';
}

/**
 * Этот человек уже ждёт это (не даём встать дважды): тот же бизнес, тот же клиент (пользователь приложения или телефон),
 * та же услуга и мастер, заявка активна и ждёт этот день (или любой).
 */
export function findSameWaitlistRequest(
  entries: WaitlistEntry[],
  q: { businessId: Id; staffId: Id; serviceId: Id; date: ISODate | 'any'; appUserId?: Id; phone?: string },
  today: ISODate,
): WaitlistEntry | undefined {
  return entries.find(
    (e) =>
      e.businessId === q.businessId &&
      ((q.appUserId && e.appUserId === q.appUserId) || (q.phone && e.clientPhone === q.phone)) &&
      e.serviceIds.includes(q.serviceId) &&
      (e.staffIds.length === 0 || e.staffIds.includes(q.staffId)) &&
      computeWaitlistStatus(e, today) === 'active' &&
      (q.date === 'any' ? waitlistDayOf(e) === 'any' : waitlistWantsDay(e, q.date)),
  );
}

/** Заявка приложения клиента до 01.10.2026 (срез client.waitlist) — только для переноса сохранённых в браузере данных */
export interface LegacyAppWaitlistEntry {
  id: Id;
  appUserId: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate | 'any';
  createdAt: ISODateTime;
  notifiedAt?: ISODateTime;
}

/** Заявка виджета записи до 01.10.2026 (срез online.waitlistRequests) — только для переноса */
export interface LegacyWidgetWaitlistEntry {
  id: Id;
  businessId: Id;
  locationId?: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate;
  clientName: string;
  clientPhone: string;
  comment?: string;
  status?: 'pending' | 'notified' | 'booked' | 'cancelled';
  createdAt: ISODateTime;
}

/** Старая заявка приложения → заявка листа; кто и где — из ядра (вызывающий передаёт) */
export function waitlistFromLegacyApp(
  e: LegacyAppWaitlistEntry,
  who: { businessId: Id; locationId: Id; clientName: string; clientPhone: string },
): WaitlistEntry {
  return {
    id: e.id,
    ...who,
    source: 'app',
    appUserId: e.appUserId,
    serviceIds: [e.serviceId],
    staffIds: [e.staffId],
    wishes: wishesForDay(e.date),
    tags: [],
    createdAt: e.createdAt,
  };
}

/** Старая заявка виджета → заявка листа; отменённую и уже записанную (без ссылки на запись) не переносим */
export function waitlistFromLegacyWidget(e: LegacyWidgetWaitlistEntry): WaitlistEntry | undefined {
  if (e.status === 'cancelled' || e.status === 'booked') return undefined;
  return {
    id: e.id,
    businessId: e.businessId,
    locationId: e.locationId ?? '',
    clientName: e.clientName,
    clientPhone: e.clientPhone,
    source: 'widget',
    serviceIds: [e.serviceId],
    staffIds: [e.staffId],
    wishes: wishesForDay(e.date),
    ...(e.comment?.trim() ? { comment: e.comment.trim() } : {}),
    tags: [],
    createdAt: e.createdAt,
  };
}

// ─────────────────────────── Занятость ресурсов (arch-a1 №1: хозяин правила — resources) ───────────────────────────

/** Бронь, урезанная до того, что нужно движку занятости ресурса */
export interface ResourceBusyBooking {
  id: Id;
  start: ISODateTime;
  durationMin: Minutes;
  resourceIds: Id[];
  occupiesTime: boolean;
  /** Технический перерыв услуги держит ресурс занятым и после конца записи (F-16-017) */
  bufferAfterMin?: Minutes;
  /**
   * F-16-016 «Разделять запись с услугами, которые используют разные ресурсы»: когда задано, ресурс
   * `resourceId` занят только на своё окно [start+startOffsetMin, +durationMin), а не на всю запись —
   * применяется, только если бизнес включил `splitByResource` и у строки записи указан свой `resourceId`
   * (BookingServiceLine.resourceId). Нет поля — старое поведение (ресурс занят на всю запись, resourceIds).
   */
  lineWindows?: { resourceId: Id; startOffsetMin: Minutes; durationMin: Minutes }[];
}

/** Групповое событие, урезанное до того, что нужно движку занятости ресурса */
export interface ResourceBusyEvent {
  id: Id;
  start: ISODateTime;
  durationMin: Minutes;
  resourceIds: Id[];
  cancelled: boolean;
}

function overlaps(aFrom: ISODateTime, aTo: ISODateTime, bFrom: ISODateTime, bTo: ISODateTime): boolean {
  return aFrom < bTo && bFrom < aTo;
}

/**
 * Экземпляр ресурса занят на [start, start+durationMin)? (F-16-011, F-16-012, F-16-017: перерыв услуги держит
 * ресурс занятым и после записи). excludeBookingId — не считать саму правящуюся запись.
 */
export function instanceBusy(
  instanceId: Id,
  start: ISODateTime,
  durationMin: Minutes,
  bookings: ResourceBusyBooking[],
  events: ResourceBusyEvent[],
  excludeBookingId?: Id,
): boolean {
  const to = addMinutes(start, durationMin);
  const bookingHit = bookings.some((b) => {
    if (b.id === excludeBookingId || !b.occupiesTime) return false;
    // F-16-016: с разделением по ресурсам — только своё окно строки, не вся запись
    if (b.lineWindows?.length) {
      return b.lineWindows.some((w) => {
        if (w.resourceId !== instanceId) return false;
        const wFrom = addMinutes(b.start, w.startOffsetMin);
        const wTo = addMinutes(wFrom, w.durationMin + (b.bufferAfterMin ?? 0));
        return overlaps(start, to, wFrom, wTo);
      });
    }
    if (!b.resourceIds.includes(instanceId)) return false;
    const bTo = addMinutes(b.start, b.durationMin + (b.bufferAfterMin ?? 0));
    return overlaps(start, to, b.start, bTo);
  });
  if (bookingHit) return true;
  return events.some((e) => {
    if (e.cancelled || !e.resourceIds.includes(instanceId)) return false;
    const eTo = addMinutes(e.start, e.durationMin);
    return overlaps(start, to, e.start, eTo);
  });
}

/**
 * По одному свободному экземпляру каждого переданного ресурса (F-16-011: онлайн-запись берёт первый свободный).
 * Нет свободного хотя бы у одного ресурса — undefined (F-16-012: «нет свободного ресурса — нет записи»).
 */
export function pickFreeInstances(
  resourceIds: Id[],
  instancesByResource: Map<Id, Id[]>,
  start: ISODateTime,
  durationMin: Minutes,
  bookings: ResourceBusyBooking[],
  events: ResourceBusyEvent[],
  excludeBookingId?: Id,
): Id[] | undefined {
  const picked: Id[] = [];
  for (const resourceId of resourceIds) {
    const instances = instancesByResource.get(resourceId) ?? [];
    const free = instances.find((instanceId) => !instanceBusy(instanceId, start, durationMin, bookings, events, excludeBookingId));
    if (!free) return undefined;
    picked.push(free);
  }
  return picked;
}

/** Все переданные экземпляры (уже выбранные вручную, F-16-013) свободны на это время? */
export function checkInstancesFree(
  instanceIds: Id[],
  start: ISODateTime,
  durationMin: Minutes,
  bookings: ResourceBusyBooking[],
  events: ResourceBusyEvent[],
  excludeBookingId?: Id,
): boolean {
  return instanceIds.every((id) => !instanceBusy(id, start, durationMin, bookings, events, excludeBookingId));
}

/** Ресурс, урезанный до того, что нужно для подбора экземпляров записи */
export interface ResourceForAssign {
  id: Id;
  locationId: Id;
  active: boolean;
  serviceIds: Id[];
  instances: { id: Id }[];
}

export interface ResolveBookingResourcesInput {
  resources: ResourceForAssign[];
  locationId: Id;
  /** Услуги, чьи привязанные ресурсы запись должна занять сама (F-16-008, F-16-011) */
  requiredServiceIds: Id[];
  /** Что уже выбрано в записи (вручную или раньше) — экземпляры; id самого ресурса (старые данные) тоже понимается */
  resourceIds: Id[];
  start: ISODateTime;
  /** Длительность вместе с техническим перерывом (F-16-017) */
  durationMin: Minutes;
  bookings: ResourceBusyBooking[];
  events: ResourceBusyEvent[];
  excludeBookingId?: Id;
}

/**
 * Единое правило «нет свободного ресурса — нет записи» (F-16-011, F-16-012, F-16-013) для записи из журнала и её правки:
 *  1) выбранный экземпляр должен быть свободен; занят — берётся другой свободный экземпляр того же ресурса;
 *  2) id ресурса вместо экземпляра (старые данные) заменяется свободным экземпляром;
 *  3) каждый активный ресурс локации, привязанный к requiredServiceIds и ещё не взятый, получает свой свободный экземпляр.
 * Нечего взять хотя бы для одного — undefined: запись на это время поставить нельзя (две записи на единственный лазер).
 * Экземпляры архивного ресурса и неизвестные id остаются как были — ими никто больше не занимает время.
 */
export function resolveBookingResources(input: ResolveBookingResourcesInput): Id[] | undefined {
  const { resources, start, durationMin, bookings, events, excludeBookingId } = input;
  const byResourceId = new Map(resources.map((r) => [r.id, r] as const));
  const ownerOfInstance = new Map<Id, ResourceForAssign>();
  for (const r of resources) for (const inst of r.instances) ownerOfInstance.set(inst.id, r);

  const picked: Id[] = [];
  const taken = new Set<Id>();
  const requested = new Set(input.resourceIds);
  const isFree = (instanceId: Id) => !taken.has(instanceId) && !instanceBusy(instanceId, start, durationMin, bookings, events, excludeBookingId);
  const take = (id: Id) => {
    picked.push(id);
    taken.add(id);
  };
  const pickFrom = (r: ResourceForAssign): boolean => {
    // Сначала экземпляр, который не выбран в этой же записи для другой строки
    const free = r.instances.find((i) => !requested.has(i.id) && isFree(i.id)) ?? r.instances.find((i) => isFree(i.id));
    if (!free) return false;
    take(free.id);
    return true;
  };

  for (const id of input.resourceIds) {
    if (!id || taken.has(id)) continue;
    const legacy = byResourceId.get(id);
    if (legacy) {
      if (!legacy.active) continue;
      if (!pickFrom(legacy)) return undefined;
      continue;
    }
    const owner = ownerOfInstance.get(id);
    if (!owner || !owner.active) {
      take(id);
      continue;
    }
    if (isFree(id)) take(id);
    else if (!pickFrom(owner)) return undefined;
  }

  const required = new Set(input.requiredServiceIds);
  if (required.size) {
    for (const r of resources) {
      if (!r.active || r.locationId !== input.locationId || !r.serviceIds.some((s) => required.has(s))) continue;
      if (r.instances.some((i) => taken.has(i.id))) continue;
      if (!pickFrom(r)) return undefined;
    }
  }
  return picked;
}

// ─────────────────────────── Повтор события по шаблону (F-16-064, F-16-065, F-16-101) ───────────────────────────

/** Периодичность повтора/расписания — как у повтора записи (F-01-100…107), см. F-16-064 */
export type RepeatFreq = 'daily' | 'weekdays' | 'monWedFri' | 'tueThu' | 'weekly' | 'monthly' | 'yearly';

export const REPEAT_FREQS: RepeatFreq[] = ['daily', 'weekdays', 'monWedFri', 'tueThu', 'weekly', 'monthly', 'yearly'];

/** Сохранённый шаблон повтора (F-16-064: «Сохранить шаблон» → выбирается в другом событии) */
export interface EventTemplate {
  id: Id;
  businessId: Id;
  name: string;
  freq: RepeatFreq;
  /** Только для 'weekly': шаг в неделях (1 = каждую неделю, 2 = раз в две недели) */
  weekIntervalWeeks?: number;
}

export type RepeatEnd = { kind: 'count'; count: number } | { kind: 'date'; date: ISODate };

export interface RepeatDatesParams {
  freq: RepeatFreq;
  startDate: ISODate;
  weekIntervalWeeks?: number;
  end: RepeatEnd;
}

const WEEKDAY_SETS: Partial<Record<RepeatFreq, number[]>> = {
  weekdays: [0, 1, 2, 3, 4],
  monWedFri: [0, 2, 4],
  tueThu: [1, 3],
};

/** Максимум дат за один расчёт — защита от зависшего цикла при некорректных входных данных */
const REPEAT_SAFETY_LIMIT = 500;

/**
 * Даты повтора/серии, включая startDate (F-16-064, F-16-067). 'daily'/'weekdays'/'monWedFri'/'tueThu' идут по
 * дням и отбирают нужные дни недели; 'weekly' — шаг в днях (7 × интервал); 'monthly'/'yearly' — тот же день
 * месяца/года. Условие окончания — «Макс. повторов» или «Дата окончания» (136897 uk, 147353).
 */
export function repeatDates(params: RepeatDatesParams): ISODate[] {
  const { freq, startDate, end } = params;
  const maxCount = end.kind === 'count' ? Math.max(1, end.count) : REPEAT_SAFETY_LIMIT;
  const endDate = end.kind === 'date' ? end.date : undefined;
  const dates: ISODate[] = [];

  if (freq === 'monthly' || freq === 'yearly') {
    let d = parse(startDate);
    for (let i = 0; i < maxCount && dates.length < REPEAT_SAFETY_LIMIT; i++) {
      const iso = toISODate(d);
      if (endDate && iso > endDate) break;
      dates.push(iso);
      d = d.add(1, freq === 'monthly' ? 'month' : 'year');
    }
    return dates;
  }

  const weekdaySet = WEEKDAY_SETS[freq];
  const stepDays = freq === 'weekly' ? 7 * Math.max(1, params.weekIntervalWeeks ?? 1) : 1;
  let cursor = startDate;
  for (let i = 0; i < REPEAT_SAFETY_LIMIT && dates.length < maxCount; i++) {
    if (endDate && cursor > endDate) break;
    if (!weekdaySet || weekdaySet.includes(weekdayIndex(cursor))) dates.push(cursor);
    cursor = addDays(cursor, stepDays);
  }
  return dates;
}

// ─────────────────────────── Расписание событий — серия (F-16-067…077) ───────────────────────────

/** Один день недели расписания серии — своё время, длительность и ресурсы (F-16-067) */
export interface SeriesDayRule {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: TimeHM;
  durationMin: Minutes;
  resourceIds: Id[];
}

/**
 * Расписание (серия) событий — своя надстройка над GroupEvent.seriesId (ядро уже хранит поле, сюда — то, чего
 * там нет: правило по дням недели, дата окончания и какие события серии стали «уникальными», F-16-074).
 */
export interface EventSeriesDef {
  /** Совпадает с GroupEvent.seriesId у всех событий серии */
  id: Id;
  businessId: Id;
  locationId: Id;
  staffId: Id;
  serviceId: Id;
  capacity: number;
  days: SeriesDayRule[];
  endDate: ISODate;
  sourceEventId: Id;
  /** Событие, изменённое отдельно (F-16-074/075) — правки серии больше не трогают то, что менялось вручную */
  uniqueEventIds: Id[];
  createdAt: ISODateTime;
}

/** Даты серии в [from, to] по правилам дней недели (F-16-067, F-16-071 продление/сокращение) */
export function seriesOccurrences(days: SeriesDayRule[], from: ISODate, to: ISODate): { date: ISODate; rule: SeriesDayRule }[] {
  if (to < from) return [];
  const out: { date: ISODate; rule: SeriesDayRule }[] = [];
  for (const date of eachDay(from, to)) {
    const wd = weekdayIndex(date);
    for (const rule of days) if (rule.weekday === wd) out.push({ date, rule });
  }
  return out;
}

// ─────────────────────────── Расписание посещений клиента (F-16-078…080) ───────────────────────────

/** «Абонемент на серию»: клиент попадает во все события серии в отмеченные дни недели (F-16-078) */
export interface VisitScheduleEntry {
  id: Id;
  seriesId: Id;
  clientId?: Id;
  clientName: string;
  clientPhone: string;
  /** 0 = понедельник … 6 = воскресенье, как WeekdayPicker */
  weekdays: number[];
  createdAt: ISODateTime;
}

// ─────────────────────────── Пакеты услуг (F-16-107…124, 133…135) ───────────────────────────
//
// Пакет — это Service ядра (kind остаётся 'individual') с заполненным servicePackage.items/mode
// (core.ts, «хозяин — services»). Всё, чего нет в ядре — способ цены, ограничение доступности онлайн,
// предоплата, ресурсы всего пакета — хранит собственная надстройка PackageExtra в срезе resources,
// ключ — id услуги-пакета.

export type PackagePricingMethod = 'sumServices' | 'manual' | 'discountPercent';

/** Ограничение доступности онлайн-записи на пакет (F-16-118) — тот же набор полей, что у услуги */
export interface PackageAvailabilityWindow {
  enabled: boolean;
  dateFrom?: ISODate;
  dateTo?: ISODate;
  timeFrom?: TimeHM;
  timeTo?: TimeHM;
  days: 'any' | 'weekdays' | 'weekend' | 'custom';
  customDates?: ISODate[];
}

/** Надстройка пакета — то, чего нет в Service ядра (F-16-115…120) */
export interface PackageExtra {
  serviceId: Id;
  pricingMethod: PackagePricingMethod;
  manualPrice?: Money;
  discountPercent?: number;
  availability: PackageAvailabilityWindow;
  /** ⭐ ручная предоплата по реквизитам (F-00-097), только «включена / нет» — сумму спрашивает finance */
  prepaymentRequired: boolean;
  /** Ресурсы «на весь пакет» — отдельно от ресурсов входящих услуг (F-16-120) */
  wholePackageResourceIds: Id[];
}

export function defaultPackageExtra(serviceId: Id): PackageExtra {
  return {
    serviceId,
    pricingMethod: 'sumServices',
    availability: { enabled: false, days: 'any' },
    prepaymentRequired: false,
    wholePackageResourceIds: [],
  };
}

/** Услуга, урезанная до того, что нужно расчётам длительности/цены пакета */
export interface PackageServiceLite {
  id: Id;
  kind: ServiceKind;
  durationMin: Minutes;
  durationMax?: Minutes;
  priceMin: Money;
  priceMax?: Money;
  staffIds: Id[];
}

/**
 * Длительность пакета (F-16-114): параллельный — самая длинная услуга; последовательный — сумма.
 * Диапазоны считаются по нижним/верхним границам отдельно; нулевые длительности не учитываются — если
 * ВСЕ нулевые, пакет 0.
 */
export function packageDuration(
  items: { serviceId: Id; qty: number }[],
  servicesById: Map<Id, PackageServiceLite>,
  mode: ServicePackageMode,
): { min: Minutes; max: Minutes } {
  const durations: { min: Minutes; max: Minutes }[] = [];
  for (const item of items) {
    const svc = servicesById.get(item.serviceId);
    if (!svc) continue;
    const min = svc.durationMin;
    const max = svc.durationMax ?? svc.durationMin;
    for (let i = 0; i < Math.max(1, item.qty); i++) durations.push({ min, max });
  }
  const nonZero = durations.filter((d) => d.min > 0 || d.max > 0);
  if (nonZero.length === 0) return { min: 0, max: 0 };
  if (mode === 'parallel') {
    return { min: Math.max(...nonZero.map((d) => d.min)), max: Math.max(...nonZero.map((d) => d.max)) };
  }
  return { min: nonZero.reduce((n, d) => n + d.min, 0), max: nonZero.reduce((n, d) => n + d.max, 0) };
}

export interface PackagePriceResult {
  min: Money;
  max: Money;
  /** Цена по услуге пакета после распределения/скидки — для показа в списке услуг пакета */
  perService: Record<Id, { min: Money; max: Money }>;
}

/**
 * Цена пакета (F-16-115, F-16-116): «Суммировать» — сумма (диапазоном, если есть диапазоны/по мастеру);
 * «Вручную» — своя цена, разница распределяется ПРОПОРЦИОНАЛЬНО ценам услуг (остаток округления — на
 * услугу с наибольшей ценой, чтобы сумма точно совпала со введённой); «Скидка %» — процент на каждую
 * услугу, округление до целых (F-00-002 драмы целые).
 */
export function packagePrice(
  items: { serviceId: Id; qty: number }[],
  servicesById: Map<Id, PackageServiceLite>,
  method: PackagePricingMethod,
  manualPrice: Money | undefined,
  discountPercent: number | undefined,
): PackagePriceResult {
  const lines = items.flatMap((item) => {
    const svc = servicesById.get(item.serviceId);
    if (!svc) return [];
    return Array.from({ length: Math.max(1, item.qty) }, () => ({ serviceId: item.serviceId, min: svc.priceMin, max: svc.priceMax ?? svc.priceMin }));
  });
  const sumMin = lines.reduce((n, l) => n + l.min, 0);
  const sumMax = lines.reduce((n, l) => n + l.max, 0);
  const perService: Record<Id, { min: Money; max: Money }> = {};
  for (const l of lines) perService[l.serviceId] = { min: (perService[l.serviceId]?.min ?? 0) + l.min, max: (perService[l.serviceId]?.max ?? 0) + l.max };

  if (method === 'discountPercent') {
    const pct = Math.max(0, Math.min(100, discountPercent ?? 0)) / 100;
    const perServiceDisc: Record<Id, { min: Money; max: Money }> = {};
    for (const [id, v] of Object.entries(perService)) perServiceDisc[id] = { min: Math.round(v.min * (1 - pct)), max: Math.round(v.max * (1 - pct)) };
    const discMin = Object.values(perServiceDisc).reduce((n, v) => n + v.min, 0);
    const discMax = Object.values(perServiceDisc).reduce((n, v) => n + v.max, 0);
    return { min: discMin, max: discMax, perService: perServiceDisc };
  }

  if (method === 'manual' && manualPrice !== undefined) {
    const distribute = (sum: number, perSvc: Record<Id, { min: number; max: number }>, key: 'min' | 'max') => {
      const ids = Object.keys(perSvc);
      if (sum <= 0) return Object.fromEntries(ids.map((id) => [id, Math.round(manualPrice / Math.max(1, ids.length))]));
      const raw = ids.map((id) => [id, (perSvc[id][key] / sum) * manualPrice] as const);
      const rounded = raw.map(([id, v]) => [id, Math.round(v)] as [Id, number]);
      const diff = manualPrice - rounded.reduce((n, [, v]) => n + v, 0);
      if (diff !== 0 && rounded.length > 0) {
        const biggestIdx = rounded.reduce((best, cur, i) => (cur[1] > rounded[best][1] ? i : best), 0);
        rounded[biggestIdx] = [rounded[biggestIdx][0], rounded[biggestIdx][1] + diff];
      }
      return Object.fromEntries(rounded);
    };
    const minMap = distribute(sumMin, perService, 'min') as Record<Id, number>;
    const maxMap = distribute(sumMax, perService, 'max') as Record<Id, number>;
    const perServiceManual: Record<Id, { min: Money; max: Money }> = {};
    for (const id of Object.keys(perService)) perServiceManual[id] = { min: minMap[id] ?? 0, max: maxMap[id] ?? 0 };
    return { min: manualPrice, max: manualPrice, perService: perServiceManual };
  }

  return { min: sumMin, max: sumMax, perService };
}

/** Только нулевые цены услуг — «Суммировать»/«Скидка» дали бы 0; доступен только «Вручную» (F-16-116) */
export function packagePriceMethodsAvailable(items: { serviceId: Id }[], servicesById: Map<Id, PackageServiceLite>): PackagePricingMethod[] {
  const allZero = items.length > 0 && items.every((i) => {
    const svc = servicesById.get(i.serviceId);
    return !svc || (svc.priceMin === 0 && (svc.priceMax ?? 0) === 0);
  });
  return allZero ? ['manual'] : ['sumServices', 'manual', 'discountPercent'];
}

/** «Последовательно одним специалистом» доступен только если у всех услуг пакета есть общий мастер (F-16-113) */
export function packageCanSequentialSame(items: { serviceId: Id }[], servicesById: Map<Id, PackageServiceLite>): boolean {
  if (items.length === 0) return false;
  let common: Id[] | undefined;
  for (const item of items) {
    const svc = servicesById.get(item.serviceId);
    const staffIds: Id[] = svc?.staffIds ?? [];
    common = common === undefined ? staffIds : common.filter((id) => staffIds.includes(id));
    if (common.length === 0) return false;
  }
  return (common?.length ?? 0) > 0;
}

/** Правила состава пакета (F-16-111): 2–10 услуг */
export function validatePackageComposition(items: { serviceId: Id; qty: number }[]): 'ok' | 'tooFew' | 'tooMany' {
  const count = items.reduce((n, i) => n + Math.max(1, i.qty), 0);
  if (count < 2) return 'tooFew';
  if (count > 10) return 'tooMany';
  return 'ok';
}

/** Пакет «сломан» (F-16-124): одна из входящих услуг стала групповой */
export function isPackageBroken(items: { serviceId: Id }[], servicesById: Map<Id, PackageServiceLite>): boolean {
  return items.some((i) => servicesById.get(i.serviceId)?.kind === 'group');
}

/** Услуга пакета без мастера — «Не настроено», пакет нельзя полностью настроить (F-16-112) */
export function packageUnconfiguredServiceIds(items: { serviceId: Id }[], servicesById: Map<Id, PackageServiceLite>): Id[] {
  return items.filter((i) => (servicesById.get(i.serviceId)?.staffIds.length ?? 0) === 0).map((i) => i.serviceId);
}

/** Три готовых рецепта пакета (F-16-134) */
export type PackageTemplateId = 'fourHandsManicurePedicure' | 'polishManicureShellac' | 'rfLiftingFourHands';

// ─────────────────────────── Ассистенты (F-16-136…147) ───────────────────────────

export type AssistantShareRule = 'full' | 'split';

/** Ассистент строки услуги записи (F-16-142/143) — свой слой над Booking (ядро поля не хранит) */
export interface BookingAssistant {
  staffId: Id;
  sharePercent: number;
}

/**
 * Доли ассистентов по умолчанию (F-16-143): «полная каждому» — 100% каждому, меняется вручную;
 * «делится» — распределяются поровну (в сумме 100), в интерфейсе построчно не редактируются.
 */
export function defaultAssistantShares(staffIds: Id[], rule: AssistantShareRule): BookingAssistant[] {
  if (staffIds.length === 0) return [];
  if (rule === 'full') return staffIds.map((staffId) => ({ staffId, sharePercent: 100 }));
  const base = Math.floor(100 / staffIds.length);
  const remainder = 100 - base * staffIds.length;
  return staffIds.map((staffId, i) => ({ staffId, sharePercent: base + (i < remainder ? 1 : 0) }));
}

/** Настройки компенсации за ассистирование бизнеса (F-16-140/141 — их строит payroll, здесь только то, что
 * читает наш вклад в окно записи, пока запрос не выполнен — qa/requests/resources.md) */
export interface AssistantSettings {
  compensationEnabled: boolean;
  allowMultiple: boolean;
  shareRule: AssistantShareRule;
}

// ─────────────────────────── Событие: детали, категории, участники (F-16-039, F-16-043, F-16-049…061) ───────────────────────────

/** Категория события (F-16-043) — свой справочник, отдельный от категорий записи/клиента */
export interface EventCategory {
  id: Id;
  businessId: Id;
  name: string;
  /** 1..8 → токен chart-N, как цвет мастера (F-16-043: у категории события нет отдельной пиктограммы) */
  colorIndex: number;
}

/** «Детали события» (F-16-039) — то, чего GroupEvent ядра не хранит: цвет, категории, комментарий к событию */
export interface EventExtra {
  eventId: Id;
  colorIndex?: number;
  categoryIds: Id[];
  comment?: string;
}

export function defaultEventExtra(eventId: Id): EventExtra {
  return { eventId, categoryIds: [] };
}

/** Лимит комментария к брони участника (F-16-054) */
export const PARTICIPANT_COMMENT_MAX = 200;

/**
 * Предоплата и абонемент у групповой услуги (F-16-031) — надстройка над Service ядра (kind='group'),
 * ключ = Service.id. В отличие от индивидуальной услуги (там — «или предоплата, или абонемент»), у
 * групповой можно включить ОБА сразу (ТЗ 1155/1380): клиент сам выбирает при записи. ⭐ Предоплата —
 * ручная по реквизитам (F-00-097), поэтому здесь только «включена/нет» и всегда 100%, без %/суммы.
 */
export interface GroupServicePaymentSettings {
  serviceId: Id;
  /** «Онлайн-предоплата» — у группового события всегда 100% (ТЗ: «только 100%») */
  onlinePrepaymentEnabled: boolean;
  /** «Запись по абонементу» (Membership booking) */
  membershipBookingEnabled: boolean;
}

export function defaultGroupServicePaymentSettings(serviceId: Id): GroupServicePaymentSettings {
  return { serviceId, onlinePrepaymentEnabled: false, membershipBookingEnabled: false };
}

/** Настройка «несколько мест для одного клиента» (F-16-049), ключ — businessId: своя надстройка, в ядре поля нет */
export interface GroupSeatsSettings {
  allowMultiSeat: boolean;
  maxSeats: number;
}

export const DEFAULT_GROUP_SEATS_SETTINGS: GroupSeatsSettings = { allowMultiSeat: true, maxSeats: 6 };

/** Проданный товар/абонемент/сертификат участнику события, без отдельной складской операции (F-16-059, упрощённо) */
export type ParticipantExtraKind = 'product' | 'membership' | 'certificate';

export interface ParticipantExtraItem {
  id: Id;
  bookingId: Id;
  kind: ParticipantExtraKind;
  name: string;
  price: Money;
}

/** Способ быстрой оплаты участника (F-16-060/061) — деньги не принимаем, только фиксируем способ (F-00-126) */
export type ParticipantPaymentMethod = 'membership' | 'card' | 'cash' | 'other';

export interface ParticipantPayment {
  method: ParticipantPaymentMethod;
  at: ISODateTime;
}

// ─────────────────────────── Тонкие права раздела (F-16-026, F-16-144, F-16-169) ───────────────────────────

/** Тонкие права раздела «resources», тоньше грубого resources.manage фундамента (см. areas/resources/lib/rights.ts) */
export interface ResourcesFineRights {
  /** Видит раздел «Ресурсы» вообще (F-16-026) */
  viewResources: boolean;
  /** Вкладка «Ресурсы» карточки услуги — можно менять, а не только смотреть (F-16-026) */
  editServiceResources: boolean;
  /** Видит плитку и раздел «Лист ожидания» (F-16-169) */
  viewWaitlist: boolean;
  /** Кнопка «+ Добавить ассистента» в окне записи (F-16-144) */
  addAssistants: boolean;
  /** Правит долю вознаграждения ассистента (F-16-144, только при «полная каждому») */
  editAssistantShare: boolean;
}

// ─────────────────────────── Журнал изменений (F-16-171) ───────────────────────────

export type ResourcesChangeEntity = 'resource' | 'event' | 'waitlist' | 'package';
export type ResourcesChangeAction = 'create' | 'update' | 'delete' | 'restore';

export interface ResourcesChangeLogEntry {
  id: Id;
  businessId: Id;
  entity: ResourcesChangeEntity;
  entityId: Id;
  action: ResourcesChangeAction;
  actorName: string;
  at: ISODateTime;
  summary: string;
}

"use client";

/**
 * API раздела «staff» (Сотрудники, роли, права, безопасность). Принадлежит разделу.
 * Список сотрудников — одним запросом (arch-a1 №1): найти, отобрать, отсортировать здесь, экран получает
 * готовую страницу. logChange()/listChanges() — общий журнал изменений (⭐ F-00-040), пишут все разделы.
 */
import {
  assertCan,
  coreCreate,
  coreRemove,
  coreTx,
  coreUpdate,
  currentActor,
} from "@/api/core";
import { mutateArea, readArea, readCore } from "@/api/area";
import { ApiError, request } from "@/api/request";
import { isApiMode } from "@/api/http";
import * as J from "@/api/journal.server";
import * as S from "@/api/staff.server";
import type { Permission } from "@/config/permissions";
import type {
  Id,
  LocalizedText,
  Staff,
  StaffRole,
  StaffStatus,
  Workplace,
} from "@/domain/core";
import {
  DEFAULT_STAFF_SORT,
  defaultRoleTemplateFor,
  emptyBusinessSecuritySettings,
  emptyIpRestriction,
  emptyStaffAccess,
  emptyStaffCardSettings,
  emptyStaffLegalInfo,
  ipAllowed,
  isValidIpRange,
  matchesStaffLicenseFilter,
  matchesStaffSearch,
  matchesStaffStatusFilter,
  sortStaffRows,
  applyStaffMove,
  isAssistantStaff,
  orderedStaffIds,
  type DeletedStaffSnapshot,
  type FutureBookingDecision,
  type StaffDismissal,
  type RightScope,
  type StaffAccessInfo,
  type StaffAuditEntry,
  type StaffAuditFilter,
  type StaffBusinessSecuritySettings,
  type StaffCardSettings,
  type StaffDismissInput,
  type StaffExportEntry,
  type StaffExportFilter,
  type StaffExportOperationType,
  type StaffExportReportType,
  type StaffInvite,
  type StaffIpRestriction,
  type StaffLegalInfo,
  type StaffListFilters,
  type StaffListSort,
  type StaffLoginEntry,
  type StaffPosition,
  type StaffRoleTemplateId,
} from "@/domain/staff";
import { seatsFor, type SeatInfo } from "@/areas/staff/pricing";
import { getScheduleEnd } from "@/api/schedule/table";
import { txScheduleEnd } from "@/api/schedule/shared";
import type { Booking, DayHours, ISODate, WeekTemplate } from "@/domain/core";
import { newId } from "@/lib/id";
import { addDays, today, weekdayIndex } from "@/lib/date";
import { normalizePhone } from "@/lib/phone";

// ─────────────────────────── Список (F-10-005…013) ───────────────────────────

export interface StaffListRow {
  staff: Staff;
  order: number;
  seat: SeatInfo;
  positionLabel: string;
  /** До какого дня открыт график (С8); null — графика нет совсем */
  scheduleUntil: ISODate | null;
  /** Сколько услуг назначено (С8) — ссылка на вкладку «Услуги» карточки */
  servicesCount: number;
  /** Увольнение: уже состоялось или запланировано на дату (С3) */
  dismissal?: StaffDismissal;
}

export interface StaffListQuery {
  businessId: Id;
  locationIds?: Id[];
  search?: string;
  filters: StaffListFilters;
  sort?: StaffListSort;
}

export function listStaffRows(query: StaffListQuery): Promise<StaffListRow[]> {
  if (isApiMode()) {
    // Сервер отдаёт всех сотрудников бизнеса с порядком; найти, отобрать, отсортировать — той же функцией, что у мока.
    // Конец графика (С8) — отдельным чтением на сотрудника: своего поля в строке сервера пока нет (qa/requests/staff.md).
    return S.listStaff(query.businessId).then(async (rows) => {
      const staff = rows.map((r) => r.staff);
      const ends = await Promise.all(staff.map((st) => getScheduleEnd(st.id).catch(() => undefined)));
      return buildStaffRows(
        query,
        staff,
        Object.fromEntries(rows.map((r) => [r.staff.id, r.order])),
        Object.fromEntries(staff.map((st, i) => [st.id, ends[i] ?? null])),
        {},
      );
    });
  }
  return request(() => {
    const all = readCore().staff.filter((s) => s.businessId === query.businessId);
    const area = readArea("staff");
    return buildStaffRows(
      query,
      all,
      area.order,
      Object.fromEntries(all.map((st) => [st.id, scheduleEndOf(st.id)])),
      area.dismissals,
    );
  });
}

/** Конец графика в моке: есть хоть один график — его openUntil (или «без срока» = далёкая дата), нет — null */
function scheduleEndOf(staffId: Id): ISODate | null {
  const has = readCore().schedules.some((w) => w.staffId === staffId);
  if (!has) return null;
  return txScheduleEnd(staffId) ?? "9999-12-31";
}

function buildStaffRows(
  query: StaffListQuery,
  all: Staff[],
  order: Record<Id, number>,
  scheduleEnds: Record<Id, ISODate | null>,
  dismissals: Record<Id, StaffDismissal>,
): StaffListRow[] {
  const locationIds = query.locationIds ?? [];
  const scoped = locationIds.length
    ? all.filter((s) => s.locationIds.some((l) => locationIds.includes(l)))
    : all;
  const scheduled = new Set(
    Object.entries(scheduleEnds)
      .filter(([, end]) => end !== null)
      .map(([id]) => id),
  );
  const seats = seatsFor(all, scheduled);

  let found = scoped;
  const search = query.search ?? "";
  if (search.trim())
    found = found.filter((s) => matchesStaffSearch(s, search));
  found = found.filter((s) =>
    matchesStaffStatusFilter(s, query.filters.status),
  );
  found = found.filter((s) =>
    matchesStaffLicenseFilter(
      seats.get(s.id)?.paid ?? false,
      query.filters.license,
    ),
  );
  if (query.filters.positionName)
    found = found.filter(
      (s) => (s.position?.ru ?? "") === query.filters.positionName,
    );

  const ids = orderedStaffIds(all, order);
  const rows: StaffListRow[] = found.map((s) => ({
    staff: s,
    // Стабильный номер по всему бизнесу (С1): у двух сотрудников не бывает одного номера
    order: ids.indexOf(s.id),
    seat: seats.get(s.id) ?? { staffId: s.id, paid: false, price: 0 },
    positionLabel: s.position?.ru ?? "",
    scheduleUntil: scheduleEnds[s.id] ?? null,
    servicesCount: s.serviceIds.length,
    dismissal: dismissals[s.id],
  }));
  return sortStaffRows(rows, query.sort ?? DEFAULT_STAFF_SORT);
}

/** Этот номер уже у другого сотрудника бизнеса (С11): форма добавления предлагает открыть его карточку */
export function findStaffByPhone(
  businessId: Id,
  phone: string,
  exceptStaffId?: Id,
): Promise<Staff | undefined> {
  const normalized = normalizePhone(phone);
  if (!normalized) return Promise.resolve(undefined);
  const digits = normalized.replace(/\D/g, "");
  const match = (list: Staff[]) =>
    list.find(
      (s) =>
        s.id !== exceptStaffId &&
        s.status !== "fired" &&
        s.phone.replace(/\D/g, "") === digits,
    );
  if (isApiMode()) return S.listStaff(businessId).then((rows) => match(rows.map((r) => r.staff)));
  return request(() => match(readCore().staff.filter((s) => s.businessId === businessId)));
}

// ─────────────────────────── Добавить сотрудника (F-10-015…018, F-10-022, F-10-023) ───────────────────────────

export interface AddStaffInput {
  businessId: Id;
  locationIds: Id[];
  name: string;
  role: StaffRole;
  phone?: string;
  email?: string;
  position?: string;
  specialty?: string;
  sphereIds: string[];
  /** Ассистент (F-10-022): без графика, без прав назначения услуг/прав — бесплатен, пока не поставлен в график */
  asAssistant?: boolean;
  /** Доступ в кабинет сразу при создании (F-10-019): для master — приглашение по телефону, для admin — логин/пароль */
  grantAccess?: boolean;
  /** Роль-шаблон, выбранная в форме (F-10-019/053), по умолчанию — «Специалист»/«Администратор» */
  roleTemplateId?: StaffRoleTemplateId;
}

export class StaffValidationError extends ApiError {
  readonly field: "name" | "phone" | "email";
  constructor(field: "name" | "phone" | "email", message: string) {
    super("invalid_field", message);
    this.field = field;
  }
}

function nextColorIndex(staffOfBusiness: Staff[]): number {
  return (staffOfBusiness.length % 8) + 1;
}

export async function addStaff(input: AddStaffInput): Promise<Staff> {
  if (isApiMode())
    return S.withFieldErrors(
      () => S.addStaff(input),
      (field, message) => new StaffValidationError(field, message),
    );
  return request(async () => {
    assertCan("staff.manage");
    if (!input.name.trim())
      throw new StaffValidationError("name", "name required");
    let phone: string | undefined;
    if (input.phone) {
      phone = normalizePhone(input.phone);
      if (!phone) throw new StaffValidationError("phone", "invalid phone");
    } else if (input.role === "master") {
      throw new StaffValidationError("phone", "phone required");
    }
    if (input.email && !/^\S+@\S+\.\S+$/.test(input.email))
      throw new StaffValidationError("email", "invalid email");

    const siblings = readCore().staff.filter(
      (s) => s.businessId === input.businessId,
    );
    const position: LocalizedText | undefined = input.position?.trim()
      ? { ru: input.position.trim() }
      : undefined;
    const specialty: LocalizedText | undefined = input.specialty?.trim()
      ? { ru: input.specialty.trim() }
      : undefined;
    const workplaces: Workplace[] = input.asAssistant ? [] : ["salon"];
    const status: StaffStatus = input.role === "owner" ? "active" : "invited";

    const draft: Omit<Staff, "id"> = {
      businessId: input.businessId,
      locationIds: input.locationIds,
      name: input.name.trim(),
      phone: phone ?? "",
      email: input.email?.trim() || undefined,
      role: input.role,
      position,
      specialty,
      sphereIds: input.sphereIds as Staff["sphereIds"],
      photos: [],
      materials: [],
      workplaces,
      accepts: "all",
      calendarVisibility: "all",
      calendarMode: "free",
      // В-03: новый мастер по умолчанию «с подтверждением» — мастер сам переключает на «сразу»
      confirmMode: "manual",
      colorIndex: nextColorIndex(siblings),
      serviceIds: [],
      status,
      hiredAt: today(),
      // С12: без услуг и графика записаться всё равно нельзя — онлайн-запись включается, когда они появятся
      onlineBookingEnabled: input.role !== "master",
      assistantOnly: input.asAssistant || undefined,
    };
    const created = await coreCreate("staff", draft);

    mutateArea("staff", (s) => {
      // Новый — последним в порядке бизнеса (С1): номер больше всех занятых, а не «сколько ключей»
      s.order[created.id] = Math.max(-1, ...Object.values(s.order)) + 1;
      if (
        position &&
        !s.positions.some(
          (p) => p.businessId === input.businessId && p.name.ru === position.ru,
        )
      ) {
        s.positions.push({
          id: newId("stpos"),
          businessId: input.businessId,
          name: position,
          order: s.positions.length,
          createdAt: today(),
        });
      }
      const grantAccess = input.grantAccess ?? true;
      if (status === "invited" && grantAccess && (phone || input.email)) {
        s.invites.push({
          id: newId("stinv"),
          businessId: input.businessId,
          staffId: created.id,
          role: input.role === "admin" ? "admin" : "master",
          phone,
          email: input.email,
          status: "pending",
          createdAt: today(),
        });
      }
      s.access[created.id] = {
        enabled: input.role === "owner" || grantAccess,
        roleTemplateId:
          input.roleTemplateId ?? defaultRoleTemplateFor(input.role),
      };
    });
    writeAudit({
      businessId: input.businessId,
      entity: "staff",
      entityId: created.id,
      action: "created",
      after: { name: created.name, role: created.role },
    });
    return created;
  });
}

export function addPosition(
  businessId: Id,
  name: string,
  description?: string,
): Promise<StaffPosition> {
  if (isApiMode()) return S.addPosition(businessId, name, description);
  return request(() => {
    assertCan("staff.manage");
    const trimmed = name.trim();
    if (!trimmed) throw new ApiError("invalid_field", "name required");
    const existing = readArea("staff").positions.find(
      (p) =>
        p.businessId === businessId &&
        p.name.ru.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const created: StaffPosition = {
      id: newId("stpos"),
      businessId,
      name: { ru: trimmed },
      description: description?.trim() || undefined,
      order: readArea("staff").positions.length,
      createdAt: today(),
    };
    mutateArea("staff", (s) => {
      s.positions.push(created);
    });
    writeAudit({
      businessId,
      entity: "staffPosition",
      entityId: created.id,
      action: "created",
      after: { name: trimmed },
    });
    return created;
  });
}

export function listPositions(businessId: Id): Promise<StaffPosition[]> {
  if (isApiMode())
    return S.listPositionRows(businessId).then((rows) =>
      rows.map(({ staffCount: _c, staffNames: _n, ...p }) => p),
    );
  return request(() =>
    readArea("staff")
      .positions.filter((p) => p.businessId === businessId)
      .sort((a, b) => a.order - b.order),
  );
}

export interface PositionRow extends StaffPosition {
  /** Сколько сотрудников бизнеса сейчас на этой должности (F-10-046/049/050) — сверка по имени (`position.ru`) */
  staffCount: number;
  staffNames: string[];
}

/** Список должностей со счётчиком сотрудников (F-10-046) */
export function listPositionRows(businessId: Id): Promise<PositionRow[]> {
  if (isApiMode()) return S.listPositionRows(businessId);
  return request(() => {
    const positions = readArea("staff")
      .positions.filter((p) => p.businessId === businessId)
      .sort((a, b) => a.order - b.order);
    const staffOfBiz = readCore().staff.filter(
      (s) => s.businessId === businessId && s.status !== "fired",
    );
    return positions.map((p) => {
      const holders = staffOfBiz.filter(
        (s) => (s.position?.ru ?? "") === p.name.ru,
      );
      return {
        ...p,
        staffCount: holders.length,
        staffNames: holders.map((s) => s.name),
      };
    });
  });
}

export function renamePosition(
  id: Id,
  name: string,
  description?: string,
): Promise<StaffPosition> {
  if (isApiMode()) return S.renamePosition(id, name, description);
  return request(async () => {
    assertCan("staff.manage");
    const trimmed = name.trim();
    if (!trimmed) throw new ApiError("invalid_field", "name required");
    let updated: StaffPosition | undefined;
    let previousName = "";
    mutateArea("staff", (s) => {
      const pos = s.positions.find((p) => p.id === id);
      if (!pos) throw new ApiError("not_found");
      previousName = pos.name.ru;
      pos.name = { ...pos.name, ru: trimmed };
      if (description !== undefined)
        pos.description = description.trim() || undefined;
      updated = pos;
    });
    if (!updated) throw new ApiError("not_found");
    // Переименование каталога переносится и на уже назначенных сотрудников (иначе группировка списка
    // и фильтры расходятся с каталогом — известное упрощение b01 до появления Staff.positionId).
    if (previousName !== trimmed) {
      const holders = readCore().staff.filter(
        (st) =>
          st.businessId === updated!.businessId &&
          st.position?.ru === previousName,
      );
      for (const st of holders) {
        await coreUpdate("staff", st.id, {
          position: { ...st.position, ru: trimmed },
        });
      }
    }
    return updated;
  });
}

/** Удаление запрещено, если на должности есть сотрудники (F-10-049) */
export function removePosition(id: Id): Promise<void> {
  if (isApiMode()) return S.removePosition(id);
  return request(() => {
    assertCan("staff.manage");
    const pos = readArea("staff").positions.find((p) => p.id === id);
    if (!pos) throw new ApiError("not_found");
    const holders = readCore().staff.filter(
      (s) =>
        s.businessId === pos.businessId &&
        s.status !== "fired" &&
        s.position?.ru === pos.name.ru,
    );
    if (holders.length > 0) {
      throw new ApiError("in_use", holders.map((s) => s.name).join(", "));
    }
    mutateArea("staff", (s) => {
      s.positions = s.positions.filter((p) => p.id !== id);
    });
    writeAudit({
      businessId: pos.businessId,
      entity: "staffPosition",
      entityId: id,
      action: "removed",
      before: { name: pos.name.ru },
    });
  });
}

// ─────────────────────────── Порядок (F-10-009, F-10-013) ───────────────────────────

export function reorderStaff(orderedIds: Id[]): Promise<void> {
  if (isApiMode()) return S.reorder(orderedIds);
  return request(() => {
    mutateArea("staff", (s) => {
      orderedIds.forEach((id, idx) => {
        s.order[id] = idx;
      });
    });
  });
}

export interface MoveStaffInput {
  businessId: Id;
  staffId: Id;
  targetId: Id;
  place: "before" | "after";
}

/**
 * Переставить ОДНОГО сотрудника (С1): порядок всего бизнеса одним запросом — не обмены соседей по видимому списку.
 * Экран сразу правит кэш (optimistic), ответ сверяет.
 */
export function moveStaff(input: MoveStaffInput): Promise<void> {
  if (isApiMode())
    return S.listStaff(input.businessId).then((rows) => {
      const ids = [...rows].sort((a, b) => a.order - b.order).map((r) => r.staff.id);
      return S.reorder(applyStaffMove(ids, input.staffId, input.targetId, input.place));
    });
  return request(() => {
    assertCan("staff.manage");
    const all = readCore().staff.filter((st) => st.businessId === input.businessId);
    const next = applyStaffMove(orderedStaffIds(all, readArea("staff").order), input.staffId, input.targetId, input.place);
    mutateArea("staff", (s) => {
      next.forEach((id, idx) => {
        s.order[id] = idx;
      });
    });
  });
}

// ─────────────────────────── Действия строки (F-10-011, F-10-012) ───────────────────────────

export async function setOnlineBookingEnabled(
  staffId: Id,
  enabled: boolean,
): Promise<Staff> {
  if (isApiMode()) return S.patchStaff(staffId, { onlineBookingEnabled: enabled });
  return request(async () => {
    assertCan("staff.manage");
    const before = readCore().staff.find((s) => s.id === staffId);
    const updated = await coreUpdate("staff", staffId, {
      onlineBookingEnabled: enabled,
    });
    writeAudit({
      businessId: updated.businessId,
      entity: "staff",
      entityId: staffId,
      action: "onlineBookingToggled",
      before: { enabled: before?.onlineBookingEnabled },
      after: { enabled },
    });
    return updated;
  });
}

/** Увольнение «быстрым» способом (без окна) — оставлено для тоста-отмены 5 сек существующих экранов */
export async function fireStaff(staffId: Id): Promise<Staff> {
  return dismissStaff(staffId, { date: today(), reason: "" });
}

// ─────────────────────────── Увольнение и его проверки (F-10-040, F-10-042, F-10-043) ───────────────────────────

const INACTIVE_BOOKING: string[] = ["no_show", "cancelled_by_client", "cancelled_by_master"];

/** Число будущих записей сотрудника — предупреждение в окне увольнения (F-10-042) */
export function futureBookingsCountFor(staffId: Id): Promise<number> {
  return listFutureBookingsFor(staffId, today()).then((list) => list.length);
}

/** Будущая запись увольняемого — строка окна увольнения (С3) */
export interface FutureBookingRow {
  id: Id;
  start: Booking["start"];
  durationMin: number;
  clientName: string;
  serviceName: string;
  total: number;
  status: Booking["status"];
}

/** Записи сотрудника с даты увольнения и дальше (С3): их решают прямо в окне — передать, отменить или оставить */
export function listFutureBookingsFor(staffId: Id, from: ISODate): Promise<FutureBookingRow[]> {
  const toRow = (b: Booking, clientName: string, serviceName: string): FutureBookingRow => ({
    id: b.id,
    start: b.start,
    durationMin: b.durationMin,
    clientName,
    serviceName,
    total: b.total,
    status: b.status,
  });
  const active = (b: Booking) =>
    b.staffId === staffId && b.start.slice(0, 10) >= from && !INACTIVE_BOOKING.includes(b.status) && !b.deletedAt;
  // Режим api (этап 7): записи — на сервере; имена клиента и услуги — из зеркала ядра
  if (isApiMode()) {
    return J.listBookings({ businessId: J.bizOfStaffOrSession(staffId), staffId, from }).then((list) => {
      const core = readCore();
      return list
        .filter(active)
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((b) =>
          toRow(
            b,
            core.clients.find((c) => c.id === b.clientId)?.name ?? b.visitorName ?? "",
            core.services.find((sv) => sv.id === b.services[0]?.serviceId)?.name.ru ?? "",
          ),
        );
    });
  }
  return request(() => {
    const core = readCore();
    return core.bookings
      .filter(active)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) =>
        toRow(
          b,
          core.clients.find((c) => c.id === b.clientId)?.name ?? b.visitorName ?? "",
          core.services.find((sv) => sv.id === b.services[0]?.serviceId)?.name.ru ?? "",
        ),
      );
  });
}

/** Сколько всего записей у сотрудника (прошлых и будущих) — удалить навсегда можно только карточку без истории (С4) */
export function bookingsCountFor(staffId: Id): Promise<number> {
  if (isApiMode())
    return J.listBookings({ businessId: J.bizOfStaffOrSession(staffId), staffId }).then(
      (list) => list.filter((b) => b.staffId === staffId).length,
    );
  return request(() => readCore().bookings.filter((b) => b.staffId === staffId).length);
}

/**
 * Решения по будущим записям увольняемого (С3): передать другому мастеру (время то же), отменить с уведомлением
 * клиента (статус «отменил мастер» — клиент получает уведомление об отмене), оставить как есть.
 */
export async function resolveFutureBookings(
  fromStaffId: Id,
  decisions: FutureBookingDecision[],
): Promise<{ reassigned: number; cancelled: number }> {
  const reassigned = decisions.filter((d) => d.action === "reassign").length;
  const cancelled = decisions.filter((d) => d.action === "cancel").length;
  const moveLines = (b: Booking, to: Id) =>
    // Строки услуг тоже переходят к новому мастеру — иначе зарплата и отчёты считали бы их уволенному
    b.services.map((l) => (l.staffId === fromStaffId ? { ...l, staffId: to } : l));
  if (isApiMode()) {
    // Сервер: запросы параллельно — 20 записей не ждут друг друга
    await Promise.all(
      decisions.map(async (d) => {
        if (d.action === "reassign") {
          const b = await J.getBooking(d.bookingId);
          await J.updateBooking(d.bookingId, { staffId: d.toStaffId, services: moveLines(b, d.toStaffId) });
        } else if (d.action === "cancel") await J.changeBookingStatus(d.bookingId, "cancelled_by_master", "business");
      }),
    );
    return { reassigned, cancelled };
  }
  // Мок: все решения — одной транзакцией (одна задержка «сети», а не по записи на каждую)
  return request(() => {
    for (const d of decisions) {
      const b = readCore().bookings.find((x) => x.id === d.bookingId);
      if (!b) continue;
      if (d.action === "reassign") coreTx.updateBooking(d.bookingId, { staffId: d.toStaffId, services: moveLines(b, d.toStaffId) });
      else if (d.action === "cancel") coreTx.changeBookingStatus(d.bookingId, "cancelled_by_master", "business");
    }
    return { reassigned, cancelled };
  });
}

/** «Отменить» в тосте увольнения (С3): записи возвращаются уволенному, как были — мастер и статус */
export async function undoFutureBookings(
  fromStaffId: Id,
  decisions: FutureBookingDecision[],
  before: FutureBookingRow[],
): Promise<void> {
  const back = (b: Booking, d: FutureBookingDecision) => ({
    staffId: fromStaffId,
    status: before.find((x) => x.id === d.bookingId)?.status ?? b.status,
    services:
      d.action === "reassign" ? b.services.map((l) => (l.staffId === d.toStaffId ? { ...l, staffId: fromStaffId } : l)) : b.services,
  });
  const todo = decisions.filter((d) => d.action !== "keep");
  if (isApiMode()) {
    await Promise.all(todo.map(async (d) => J.updateBooking(d.bookingId, back(await J.getBooking(d.bookingId), d))));
    return;
  }
  return request(() => {
    for (const d of todo) {
      const b = readCore().bookings.find((x) => x.id === d.bookingId);
      if (b) coreTx.updateBooking(d.bookingId, back(b, d));
    }
  });
}

/**
 * Увольнение (F-10-040, С3): дата сегодня или раньше — сразу; дата в будущем — запланировано, до неё сотрудник
 * работает и остаётся в графике, в этот день увольнение вступает в силу (applyDueDismissals).
 */
export async function dismissStaff(
  staffId: Id,
  input: StaffDismissInput,
): Promise<Staff> {
  if (isApiMode()) return S.dismiss(staffId, input);
  return request(() => {
    assertCan("staff.manage");
    const before = readCore().staff.find((s) => s.id === staffId);
    if (!before) throw new ApiError("not_found");
    if (before.role === "owner" && ownerCountOf(before.businessId) <= 1) {
      throw new ApiError("last_owner");
    }
    const scheduled = input.date > today();
    const updated = scheduled
      ? before
      : coreTx.update("staff", staffId, { status: "fired" as StaffStatus });
    mutateArea("staff", (s) => {
      s.dismissals[staffId] = {
        staffId,
        date: input.date,
        reason: input.reason,
        firedAt: scheduled ? undefined : today(),
        scheduled: scheduled || undefined,
      };
    });
    writeAudit({
      businessId: updated.businessId,
      entity: "staff",
      entityId: staffId,
      action: scheduled ? "dismissalScheduled" : "fired",
      before: { status: before.status },
      after: { date: input.date, reason: input.reason },
    });
    return updated;
  });
}

/** Запланированные увольнения, чей день настал, вступают в силу (мок; сервер делает это сам) */
export function applyDueDismissals(businessId: Id): Promise<number> {
  if (isApiMode()) return Promise.resolve(0);
  return request(() => {
    const now = today();
    const due = Object.values(readArea("staff").dismissals).filter(
      (d) => d.scheduled && d.date <= now && readCore().staff.some((st) => st.id === d.staffId && st.businessId === businessId),
    );
    if (!due.length) return 0;
    for (const d of due) coreTx.update("staff", d.staffId, { status: "fired" as StaffStatus });
    mutateArea("staff", (s) => {
      for (const d of due) s.dismissals[d.staffId] = { ...d, scheduled: undefined, firedAt: d.date };
    });
    return due.length;
  });
}

/**
 * Вернуть уволенного (F-10-044, С3): в любой момент — блокировки «со 2-го по 30-й день» больше нет (обзор
 * «Сотрудники» 27.09.2026: увольнение обратимо). Запланированное увольнение этим же снимается.
 */
export async function restoreStaff(staffId: Id): Promise<Staff> {
  if (isApiMode()) return S.restore(staffId);
  return request(() => {
    assertCan("staff.manage");
    const before = readCore().staff.find((s) => s.id === staffId);
    if (!before) throw new ApiError("not_found");
    const updated =
      before.status === "fired"
        ? coreTx.update("staff", staffId, { status: "active" as StaffStatus })
        : before;
    mutateArea("staff", (s) => {
      delete s.dismissals[staffId];
    });
    writeAudit({
      businessId: updated.businessId,
      entity: "staff",
      entityId: staffId,
      action: before.status === "fired" ? "restored" : "dismissalCancelled",
    });
    return updated;
  });
}

export async function revokeAccess(staffId: Id): Promise<Staff> {
  if (isApiMode()) return (await S.setAccessEnabled(staffId, false)).staff;
  return request(async () => {
    assertCan("staff.manage");
    const updated = await coreUpdate("staff", staffId, {
      status: "disabled" as StaffStatus,
      login: undefined,
    });
    writeAudit({
      businessId: updated.businessId,
      entity: "staff",
      entityId: staffId,
      action: "accessRevoked",
    });
    return updated;
  });
}

export function resendInvite(inviteId: Id): Promise<StaffInvite> {
  return request(() => {
    let invite: StaffInvite | undefined;
    mutateArea("staff", (s) => {
      invite = s.invites.find((i) => i.id === inviteId);
      if (!invite) throw new ApiError("not_found");
      invite.createdAt = today();
      invite.status = "pending";
    });
    if (!invite) throw new ApiError("not_found");
    return invite;
  });
}

/** Отправить приглашение ещё раз по сотруднику (экран не хранит id приглашения — находим последнее) */
export function resendInviteForStaff(staffId: Id): Promise<StaffInvite> {
  if (isApiMode()) return S.reissueInvite(staffId).then((r) => r.invite);
  return request(() => {
    let invite: StaffInvite | undefined;
    mutateArea("staff", (s) => {
      invite = [...s.invites].reverse().find((i) => i.staffId === staffId);
      if (!invite) throw new ApiError("not_found");
      invite.createdAt = today();
      invite.status = "pending";
    });
    if (!invite) throw new ApiError("not_found");
    return invite;
  });
}

/** Отозвать непринятое приглашение (F-10-020) */
export function revokeInviteForStaff(staffId: Id): Promise<StaffInvite> {
  if (isApiMode()) return S.revokeInvite(staffId);
  return request(() => {
    let invite: StaffInvite | undefined;
    mutateArea("staff", (s) => {
      invite = [...s.invites].reverse().find((i) => i.staffId === staffId);
      if (!invite) throw new ApiError("not_found");
      invite.status = "revoked";
    });
    if (!invite) throw new ApiError("not_found");
    return invite;
  });
}

/** Ссылка-приглашение (F-10-020) — экран сам копирует её в буфер */
/** Режим api: в базе только хэш токена — выпускается новая ссылка, прежняя перестаёт работать */
export function inviteLinkFor(staffId: Id): Promise<string> {
  if (isApiMode()) return S.reissueInvite(staffId).then((r) => r.link);
  return request(() => {
    const invite = [...readArea("staff").invites]
      .reverse()
      .find((i) => i.staffId === staffId);
    if (!invite) throw new ApiError("not_found");
    if (typeof window === "undefined") return `/invite/${invite.id}`;
    return `${window.location.origin}/invite/${invite.id}`;
  });
}

// ─────────────────────────── Вкладка «Доступ» (F-10-019, F-10-031, F-00-038…040) ───────────────────────────

export interface StaffAccessData {
  access: StaffAccessInfo;
  invite?: StaffInvite;
  staff: Staff;
}

export function getStaffAccess(staffId: Id): Promise<StaffAccessData> {
  if (isApiMode()) return S.getAccess(staffId);
  return request(() => {
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    const areaState = readArea("staff");
    const access =
      areaState.access[staffId] ?? emptyStaffAccess(staff.role);
    const invite = [...areaState.invites]
      .reverse()
      .find((i) => i.staffId === staffId && i.status !== "revoked");
    return { access, invite, staff };
  });
}

/** Тумблер «Предоставить доступ» (F-10-031, ⭐ F-00-040): выключение закрывает вход, не удаляя карточку */
export async function setStaffAccessEnabled(
  staffId: Id,
  enabled: boolean,
): Promise<StaffAccessInfo> {
  if (isApiMode()) return S.setAccessEnabled(staffId, enabled).then((r) => r.access);
  return request(async () => {
    assertCan("staff.manage");
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    if (staff.role !== "owner" && staff.status !== "fired") {
      await coreUpdate("staff", staffId, {
        status: (enabled ? "active" : "disabled") as StaffStatus,
      });
    }
    let result!: StaffAccessInfo;
    mutateArea("staff", (s) => {
      const current = s.access[staffId] ?? emptyStaffAccess(staff.role);
      current.enabled = enabled;
      s.access[staffId] = current;
      result = current;
    });
    writeAudit({
      businessId: staff.businessId,
      entity: "staff",
      entityId: staffId,
      action: enabled ? "accessGranted" : "accessRevoked",
    });
    return result;
  });
}

export function setStaffAccessInfo(
  staffId: Id,
  info: string,
): Promise<StaffAccessInfo> {
  if (isApiMode()) return S.setAccessInfo(staffId, info).then((r) => r.access);
  return request(() => {
    let result!: StaffAccessInfo;
    mutateArea("staff", (s) => {
      const staff = readCore().staff.find((st) => st.id === staffId);
      const current =
        s.access[staffId] ?? emptyStaffAccess(staff?.role ?? "master");
      current.info = info;
      s.access[staffId] = current;
      result = current;
    });
    return result;
  });
}

/** Смена роли-шаблона (F-10-053…061): галочки прав самой роли остаются за редактором прав (b04) */
export async function setStaffRoleTemplate(
  staffId: Id,
  roleTemplateId: StaffRoleTemplateId,
): Promise<StaffAccessInfo> {
  if (isApiMode()) return S.setRoleTemplate(staffId, roleTemplateId).then((r) => r.access);
  return request(async () => {
    assertCan("staff.manage");
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    let result!: StaffAccessInfo;
    mutateArea("staff", (s) => {
      const current = s.access[staffId] ?? emptyStaffAccess(staff.role);
      current.roleTemplateId = roleTemplateId;
      s.access[staffId] = current;
      result = current;
    });
    writeAudit({
      businessId: staff.businessId,
      entity: "staff",
      entityId: staffId,
      action: "roleChanged",
      after: { roleTemplateId },
    });
    return result;
  });
}

// ─────────────────────────── Удаление и восстановление (F-10-041, F-10-044, F-10-131, F-10-155) ───────────────────────────

/** Удаление навсегда (F-10-155): подтверждение словом DELETE проверяет экран, здесь — снимок + сама операция */
export async function deleteStaffForever(staffId: Id): Promise<void> {
  if (isApiMode()) return S.remove(staffId);
  return request(async () => {
    assertCan("staff.manage");
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    if (staff.role === "owner" && ownerCountOf(staff.businessId) <= 1) {
      throw new ApiError("last_owner");
    }
    // С4: удалить навсегда можно только карточку без единой записи (заведённую по ошибке) — у остальных
    // история записей и выручка в отчётах остаются за мастером, он живёт в архиве уволенных
    if (readCore().bookings.some((b) => b.staffId === staffId)) {
      throw new ApiError("has_history");
    }
    writeAudit({
      businessId: staff.businessId,
      entity: "staff",
      entityId: staffId,
      action: "deletedForever",
      before: { name: staff.name },
    });
    const deletedAt = today();
    mutateArea("staff", (s) => {
      s.deleted.push({
        id: staffId,
        businessId: staff.businessId,
        snapshot: staff,
        access: s.access[staffId],
        deletedAt,
      });
      delete s.order[staffId];
      delete s.access[staffId];
      delete s.dismissals[staffId];
      s.invites = s.invites.filter((i) => i.staffId !== staffId);
    });
    await coreRemove("staff", staffId);
  });
}

export function listDeletedStaff(businessId: Id): Promise<DeletedStaffSnapshot[]> {
  if (isApiMode()) return S.listDeleted(businessId);
  return request(() =>
    readArea("staff").deleted.filter((d) => d.businessId === businessId),
  );
}

/** Вернуть удалённого из архива (F-10-044, С4): в любой момент, без блокировки 30 дней */
export async function restoreDeletedStaff(staffId: Id): Promise<Staff> {
  if (isApiMode()) return S.undelete(S.bizOf(), staffId);
  return request(async () => {
    assertCan("staff.manage");
    const record = readArea("staff").deleted.find((d) => d.id === staffId);
    if (!record) throw new ApiError("not_found");
    const restored = await coreCreate("staff", {
      ...record.snapshot,
      id: record.id,
      status: "active" as StaffStatus,
    });
    mutateArea("staff", (s) => {
      s.deleted = s.deleted.filter((d) => d.id !== staffId);
      s.order[restored.id] = Math.max(-1, ...Object.values(s.order)) + 1;
      if (record.access) s.access[restored.id] = record.access;
    });
    writeAudit({
      businessId: restored.businessId,
      entity: "staff",
      entityId: restored.id,
      action: "restoredFromDeleted",
    });
    return restored;
  });
}

// ─────────────────────────── Перенос доступа (F-10-045) ───────────────────────────

export interface TransferAccessInput {
  fromStaffId: Id;
  toStaffId: Id;
  deleteSource: boolean;
}

/** Переносит вход, роль и приглашение с одной карточки на другую без доступа (F-10-045) */
export async function transferAccess(
  input: TransferAccessInput,
): Promise<void> {
  if (isApiMode()) return S.transferAccess(input);
  return request(async () => {
    assertCan("staff.manage");
    const { fromStaffId, toStaffId, deleteSource } = input;
    const from = readCore().staff.find((s) => s.id === fromStaffId);
    const to = readCore().staff.find((s) => s.id === toStaffId);
    if (!from || !to) throw new ApiError("not_found");
    const areaState = readArea("staff");
    const toAccess = areaState.access[toStaffId];
    if (toAccess?.enabled) {
      throw new ApiError("has_access", "target already has access");
    }
    const fromAccess = areaState.access[fromStaffId] ?? emptyStaffAccess(from.role);
    await coreUpdate("staff", toStaffId, {
      login: from.login,
      status: from.status === "invited" ? "invited" : "active",
    });
    mutateArea("staff", (s) => {
      s.access[toStaffId] = { ...fromAccess };
      const invite = [...s.invites]
        .reverse()
        .find((i) => i.staffId === fromStaffId);
      if (invite) invite.staffId = toStaffId;
      delete s.access[fromStaffId];
    });
    writeAudit({
      businessId: from.businessId,
      entity: "staff",
      entityId: toStaffId,
      action: "accessTransferred",
      before: { from: fromStaffId },
    });
    if (deleteSource) {
      await deleteStaffForever(fromStaffId);
    } else {
      await coreUpdate("staff", fromStaffId, {
        status: "disabled" as StaffStatus,
        login: undefined,
      });
    }
  });
}

// ─────────────────────────── Журнал изменений (⭐ F-00-040) ───────────────────────────

export interface LogChangeInput {
  businessId: Id;
  entity: string;
  entityId: Id;
  action: string;
  before?: unknown;
  after?: unknown;
}

function writeAudit(input: LogChangeInput): void {
  const actor = currentActor();
  const actorStaff = actor.staffId
    ? readCore().staff.find((s) => s.id === actor.staffId)
    : undefined;
  const entry: StaffAuditEntry = {
    id: newId("staud"),
    businessId: input.businessId,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    actorStaffId: actor.staffId,
    actorLabel: actorStaff?.name ?? "system",
    before: input.before,
    after: input.after,
    at: today(),
  };
  mutateArea("staff", (s) => {
    s.audit.unshift(entry);
  });
}

/**
 * Пишут другие разделы (journal, clients, services, stock…): logChange({ entity, entityId, action, before, after }).
 * Этап 21 «Сдача», лейн rest: в режиме api — no-op. Реальные мутации (услуги, зарплата, права…) уже пишут свою
 * запись в audit_events самим сервером (AuditService.record внутри их транзакций — services.service.ts,
 * payroll-*.service.ts и т.п.); повторный POST с этого фасада задвоил бы «Отчёт изменений данных» (F-10-100,
 * читает только сервер — listChanges() выше). Мок остаётся как был.
 */
export function logChange(input: LogChangeInput): Promise<void> {
  if (isApiMode()) return Promise.resolve();
  return request(() => writeAudit(input));
}

/** Отчёт «Изменения данных» (F-10-100): требует право «Журнал безопасности бизнеса» (settings.manage) */
export function listChanges(
  filter: StaffAuditFilter,
): Promise<StaffAuditEntry[]> {
  if (isApiMode()) return S.listChanges(filter);
  return request(() => {
    assertCan("settings.manage");
    return readArea("staff")
      .audit.filter((a) => a.businessId === filter.businessId)
      .filter((a) => !filter.entity || a.entity === filter.entity)
      .filter((a) => !filter.entityId || a.entityId === filter.entityId)
      .filter((a) => !filter.action || a.action === filter.action)
      .filter(
        (a) => !filter.actorStaffId || a.actorStaffId === filter.actorStaffId,
      );
  });
}

// ─────────────────────────── Журнал «Операции с данными» (F-10-102, F-10-103, F-10-104) ───────────────────────────

export interface LogExportInput {
  businessId: Id;
  reportType: StaffExportReportType;
  isImport?: boolean;
  operationType: StaffExportOperationType;
}

/** Пишут разделы, у которых есть кнопка «Выгрузить»/«Загрузить»: logExport({ businessId, reportType, operationType }) */
export function logExport(input: LogExportInput): Promise<void> {
  if (isApiMode()) return S.logExport(input);
  return request(() => {
    const actor = currentActor();
    const actorStaff = actor.staffId
      ? readCore().staff.find((s) => s.id === actor.staffId)
      : undefined;
    const entry: StaffExportEntry = {
      id: newId("stexp"),
      businessId: input.businessId,
      actorStaffId: actor.staffId,
      actorLabel: actorStaff?.name ?? "system",
      reportType: input.reportType,
      isImport: input.isImport ?? false,
      operationType: input.operationType,
      at: today(),
    };
    mutateArea("staff", (s) => {
      s.exports.unshift(entry);
    });
  });
}

/** Требует право «Экспорт данных» (clients.export — бесплатное, F-10-104) */
export function listExports(filter: StaffExportFilter): Promise<StaffExportEntry[]> {
  if (isApiMode()) return S.listExports(filter);
  return request(() => {
    assertCan("clients.export");
    return readArea("staff")
      .exports.filter((e) => e.businessId === filter.businessId)
      .filter((e) => !filter.actorStaffId || e.actorStaffId === filter.actorStaffId)
      .filter((e) => !filter.reportType || e.reportType === filter.reportType)
      .filter((e) => !filter.operationType || e.operationType === filter.operationType);
  });
}

// ─────────────────────────── Журнал входов (F-10-106) ───────────────────────────

/** Только в справке у Altegio — у нас показываем прямо в кабинете (наше решение, полнее заявленного) */
export function listLogins(businessId: Id): Promise<StaffLoginEntry[]> {
  if (isApiMode()) return S.listLogins(businessId);
  return request(() => {
    assertCan("settings.manage");
    return readArea("staff").logins.filter((l) => l.businessId === businessId);
  });
}

// ─────────────────────────── Доступ по IP-адресам (F-10-091) ───────────────────────────

export function getIpRestriction(staffId: Id): Promise<StaffIpRestriction> {
  if (isApiMode()) return S.getAccess(staffId).then((r) => r.access.ipRestriction ?? emptyIpRestriction());
  return request(
    () => readArea("staff").access[staffId]?.ipRestriction ?? emptyIpRestriction(),
  );
}

/** Владелец задаёт список масок; невалидные адреса отклоняются до сохранения */
export async function setIpRestriction(
  staffId: Id,
  restriction: StaffIpRestriction,
): Promise<StaffIpRestriction> {
  if (isApiMode()) return S.setIpRestriction(staffId, restriction);
  return request(async () => {
    assertCan("staff.manage");
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    if (restriction.enabled) {
      const bad = restriction.ranges.find((r) => !isValidIpRange(r));
      if (bad) throw new ApiError("invalid_ip_range");
    }
    let result!: StaffIpRestriction;
    mutateArea("staff", (s) => {
      const current = s.access[staffId] ?? emptyStaffAccess(staff.role);
      current.ipRestriction = restriction;
      s.access[staffId] = current;
      result = restriction;
    });
    writeAudit({
      businessId: staff.businessId,
      entity: "staff",
      entityId: staffId,
      action: "ipRestrictionChanged",
      after: { enabled: restriction.enabled, ranges: restriction.ranges },
    });
    return result;
  });
}

/** Демо-проверка (нет настоящего входа, F-10-091): «войдёт ли сотрудник с этого адреса сейчас» */
export function checkIpAllowed(staffId: Id, ip: string): Promise<boolean> {
  if (isApiMode()) return getIpRestriction(staffId).then((r) => ipAllowed(r, ip));
  return request(() => {
    const restriction = readArea("staff").access[staffId]?.ipRestriction;
    return ipAllowed(restriction, ip);
  });
}

// ─────────────────────────── Настройки безопасности бизнеса (⭐ F-00-047) ───────────────────────────

export function getBusinessSecuritySettings(
  businessId: Id,
): Promise<StaffBusinessSecuritySettings> {
  if (isApiMode()) return S.getSecurity(businessId);
  return request(() => {
    // Правило читается из бизнеса ядра (F-00-047, как сервер: Business.forbidHomeBookingsDuringShift)
    const forbid = readCore().businesses.find((b) => b.id === businessId)?.forbidHomeBookingsDuringShift;
    const saved = readArea("staff").businessSettings[businessId] ?? emptyBusinessSecuritySettings();
    return forbid === undefined ? saved : { ...saved, blockHomeVisitDuringShift: forbid };
  });
}

export function setBlockHomeVisitDuringShift(
  businessId: Id,
  value: boolean,
): Promise<StaffBusinessSecuritySettings> {
  if (isApiMode()) return S.setSecurity(businessId, value);
  return request(() => {
    assertCan("settings.manage");
    let result: StaffBusinessSecuritySettings = emptyBusinessSecuritySettings();
    mutateArea("staff", (s) => {
      result = {
        ...(s.businessSettings[businessId] ?? emptyBusinessSecuritySettings()),
        blockHomeVisitDuringShift: value,
      };
      s.businessSettings[businessId] = result;
    });
    // Источник правды — бизнес ядра: его читает проверка записи (rules/busy homeShiftConflict)
    coreTx.update("businesses", businessId, { forbidHomeBookingsDuringShift: value });
    writeAudit({
      businessId,
      entity: "business",
      entityId: businessId,
      action: "homeVisitRuleChanged",
      after: { blockHomeVisitDuringShift: value },
    });
    return result;
  });
}

// ─────────────────────────── Передача владения (F-10-149) ───────────────────────────

/** Сколько активных владельцев у бизнеса — последнего нельзя разжаловать/уволить/удалить */
export function ownerCountOf(businessId: Id): number {
  return readCore().staff.filter(
    (s) => s.businessId === businessId && s.role === "owner" && s.status !== "fired",
  ).length;
}

/**
 * Передача роли «Владелец» другому сотруднику (F-10-149): бывший владелец становится администратором
 * (шаблон «Владелец» больше не про него), новый получает роль и доступ. Необратимо для звонящего —
 * подтверждается словом TRANSFER_OWNER_CONFIRM_WORD в модалке экрана.
 */
export async function transferOwnership(
  fromStaffId: Id,
  toStaffId: Id,
): Promise<void> {
  if (isApiMode()) return S.transferOwnership(fromStaffId, toStaffId);
  return request(async () => {
    const from = readCore().staff.find((s) => s.id === fromStaffId);
    const to = readCore().staff.find((s) => s.id === toStaffId);
    if (!from || !to) throw new ApiError("not_found");
    if (from.role !== "owner") throw new ApiError("forbidden");
    if (from.businessId !== to.businessId) throw new ApiError("forbidden");
    await coreUpdate("staff", toStaffId, { role: "owner" as StaffRole });
    await coreUpdate("staff", fromStaffId, { role: "admin" as StaffRole });
    mutateArea("staff", (s) => {
      const toAccess = s.access[toStaffId] ?? emptyStaffAccess("owner");
      toAccess.enabled = true;
      toAccess.roleTemplateId = "owner";
      s.access[toStaffId] = toAccess;
      const fromAccess = s.access[fromStaffId] ?? emptyStaffAccess("admin");
      fromAccess.roleTemplateId = "admin";
      s.access[fromStaffId] = fromAccess;
    });
    writeAudit({
      businessId: from.businessId,
      entity: "staff",
      entityId: toStaffId,
      action: "ownershipTransferred",
      before: { ownerStaffId: fromStaffId },
      after: { ownerStaffId: toStaffId },
    });
  });
}

// ─────────────────────────── Редактор прав (F-10-032, F-10-062…090, F-10-160, F-00-039) ───────────────────────────

/** Тонкие права сотрудника — id строк каталога staff/permissions/catalog.ts; undefined — ещё не открывали редактор */
export function getStaffRights(staffId: Id): Promise<string[] | undefined> {
  if (isApiMode()) return S.getRights(staffId).then((r) => r.fine ?? undefined);
  return request(() => readArea("staff").rights[staffId]);
}

/**
 * Сохранение редактора прав: пишет тонкий набор (для самого редактора), сводит его к грубому и зовёт
 * setStaffPermissions() ядра — PermissionGate по всем разделам подхватывает сразу (F-10-072/074).
 */
export async function setStaffRights(
  staffId: Id,
  fineIds: string[],
  coarse: Permission[],
): Promise<void> {
  if (isApiMode()) return S.setRights(staffId, fineIds, coarse);
  return request(async () => {
    assertCan("staff.manage");
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    const before = readArea("staff").rights[staffId];
    mutateArea("staff", (s) => {
      s.rights[staffId] = fineIds;
    });
    const { setStaffPermissions } = await import("@/api/core");
    await setStaffPermissions(staffId, coarse);
    writeAudit({
      businessId: staff.businessId,
      entity: "staffRights",
      entityId: staffId,
      action: "rightsChanged",
      before,
      after: fineIds,
    });
  });
}

/** «Скопировать права» (F-10-069): другие сотрудники с доступом того же бизнеса, кроме себя и владельца */
export function listStaffForRightsCopy(
  businessId: Id,
  excludeStaffId: Id,
): Promise<Staff[]> {
  if (isApiMode())
    return S.listStaff(businessId).then((rows) =>
      rows
        .map((r) => r.staff)
        .filter((s) => s.id !== excludeStaffId && s.role !== "owner" && s.status !== "fired"),
    );
  return request(() =>
    readCore().staff.filter(
      (s) =>
        s.businessId === businessId &&
        s.id !== excludeStaffId &&
        s.role !== "owner" &&
        s.status !== "fired",
    ),
  );
}

/** История изменений прав этого сотрудника (F-10-070) — тот же общий журнал, entity 'staffRights' */
export function listRightsHistory(
  businessId: Id,
  staffId: Id,
): Promise<StaffAuditEntry[]> {
  if (isApiMode()) return S.listRightsHistory(businessId, staffId);
  return request(() =>
    readArea("staff")
      .audit.filter(
        (a) =>
          a.businessId === businessId &&
          a.entity === "staffRights" &&
          a.entityId === staffId,
      ),
  );
}

/** Значения «▾» у строк прав (F-10-071: период, «всех / выбранных») */
export function getStaffRightScopes(
  staffId: Id,
): Promise<Record<string, RightScope>> {
  if (isApiMode()) return S.getRights(staffId).then((r) => r.scopes ?? {});
  return request(() => readArea("staff").rightScopes[staffId] ?? {});
}

export function setStaffRightScopes(
  staffId: Id,
  scopes: Record<string, RightScope>,
): Promise<void> {
  if (isApiMode()) return S.setRightScopes(staffId, scopes);
  return request(() => {
    mutateArea("staff", (s) => {
      s.rightScopes[staffId] = scopes;
    });
  });
}

// ─────────────────────────── Карточка сотрудника (F-10-024…039, F-00-048, F-00-045, F-00-046) ───────────────────────────

export interface StaffCardData {
  staff: Staff;
  positionLabel: string;
  seat: SeatInfo;
  /** F-00-048: «индивидуал» / «в салоне <название>» */
  workModeLabel: "individual" | "salon";
  /** Название бизнеса — одним запросом с карточкой (М3: не «В салоне «»», пока оно догружается отдельно) */
  businessName: string;
  /** До какого дня открыт график; null — графика нет (С12: плашка «Не принимает записи») */
  scheduleUntil: ISODate | null;
  dismissal?: StaffDismissal;
}

/** Всё для карточки одним запросом (arch-a1 №1) */
export function getStaffCard(staffId: Id): Promise<StaffCardData> {
  if (isApiMode()) {
    const businessId = S.bizOf(staffId);
    return Promise.all([
      S.listStaff(businessId),
      getScheduleEnd(staffId).catch(() => undefined),
    ]).then(([rows, end]) => {
      const siblings = rows.map((r) => r.staff);
      const staff = siblings.find((s) => s.id === staffId);
      if (!staff) throw new ApiError("not_found");
      const businessName = readCore().businesses.find((b) => b.id === businessId)?.name ?? "";
      return staffCardOf(staff, siblings, end ?? null, businessName, undefined);
    });
  }
  return request(() => {
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    return staffCardOf(
      staff,
      readCore().staff.filter((s) => s.businessId === staff.businessId),
      scheduleEndOf(staffId),
      readCore().businesses.find((b) => b.id === staff.businessId)?.name ?? "",
      readArea("staff").dismissals[staffId],
    );
  });
}

function staffCardOf(
  staff: Staff,
  siblings: Staff[],
  scheduleUntil: ISODate | null,
  businessName: string,
  dismissal: StaffDismissal | undefined,
): StaffCardData {
  const seats = seatsFor(siblings, new Set(scheduleUntil ? [staff.id] : []));
  return {
    staff,
    positionLabel: staff.position?.ru ?? "",
    seat: seats.get(staff.id) ?? { staffId: staff.id, paid: false, price: 0 },
    workModeLabel: staff.workplaces.includes("salon") ? "salon" : "individual",
    businessName,
    scheduleUntil,
    dismissal,
  };
}

/** Карточка из строки списка (М1): шапка и форма видны сразу, без второго похода за тем же сотрудником */
export function staffCardFromRow(row: StaffListRow, businessName: string): StaffCardData {
  return {
    staff: row.staff,
    positionLabel: row.positionLabel,
    seat: row.seat,
    workModeLabel: row.staff.workplaces.includes("salon") ? "salon" : "individual",
    businessName,
    scheduleUntil: row.scheduleUntil,
    dismissal: row.dismissal,
  };
}

export interface UpdateStaffInfoInput {
  staffId: Id;
  name: string;
  specialty?: string;
  /** Название должности; если не совпадает с каталогом — создаётся новая (F-10-048) */
  position?: string;
  phone?: string;
  email?: string;
  /** «О себе» на трёх языках (С18); пустой язык не пишется */
  bio?: { ru: string; hy?: string; en?: string };
  hiredAt?: string;
}

function localizedOrNull(text: { ru: string; hy?: string; en?: string } | undefined): LocalizedText | undefined {
  if (!text) return undefined;
  const ru = text.ru.trim();
  const hy = text.hy?.trim();
  const en = text.en?.trim();
  if (!ru && !hy && !en) return undefined;
  return { ru, ...(hy ? { hy } : {}), ...(en ? { en } : {}) };
}

/** Вкладка «Информация» (F-10-025): правка не заводит новую сущность (F-10-039) — тот же Staff.id везде */
export async function updateStaffInfo(
  input: UpdateStaffInfoInput,
): Promise<Staff> {
  if (isApiMode()) {
    // Как мок: специализация и «о себе» пишутся строкой ru; должность — именем (нет в каталоге — сервер создаст)
    const patch: Record<string, unknown> = {
      name: input.name,
      specialty: input.specialty?.trim() ? { ru: input.specialty.trim() } : null,
      bio: localizedOrNull(input.bio) ?? null,
      email: input.email?.trim() || null,
    };
    if (input.position !== undefined) patch.position = input.position.trim() || null;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.hiredAt) patch.hiredAt = input.hiredAt;
    return S.withFieldErrors(
      () => S.patchStaff(input.staffId, patch),
      (field, message) => new StaffValidationError(field, message),
    );
  }
  return request(async () => {
    assertCan("staff.manage");
    if (!input.name.trim())
      throw new StaffValidationError("name", "name required");
    let phone: string | undefined = input.phone;
    if (input.phone?.trim()) {
      const normalized = normalizePhone(input.phone);
      if (!normalized) throw new StaffValidationError("phone", "invalid phone");
      phone = normalized;
    }
    if (input.email?.trim() && !/^\S+@\S+\.\S+$/.test(input.email))
      throw new StaffValidationError("email", "invalid email");

    const before = readCore().staff.find((s) => s.id === input.staffId);
    if (!before) throw new ApiError("not_found");

    let position: LocalizedText | undefined = before.position;
    const trimmedPosition = input.position?.trim();
    if (trimmedPosition !== undefined) {
      position = trimmedPosition ? { ru: trimmedPosition } : undefined;
      if (trimmedPosition) {
        const inCatalog = readArea("staff").positions.some(
          (p) =>
            p.businessId === before.businessId &&
            p.name.ru.toLowerCase() === trimmedPosition.toLowerCase(),
        );
        if (!inCatalog) await addPosition(before.businessId, trimmedPosition);
      }
    }

    const patch: Partial<Staff> = {
      name: input.name.trim(),
      specialty: input.specialty?.trim()
        ? { ru: input.specialty.trim() }
        : undefined,
      position,
      phone: phone ?? before.phone,
      email: input.email?.trim() || undefined,
      bio: localizedOrNull(input.bio),
      hiredAt: input.hiredAt || before.hiredAt,
    };
    const updated = await coreUpdate("staff", input.staffId, patch);
    writeAudit({
      businessId: updated.businessId,
      entity: "staff",
      entityId: input.staffId,
      action: "infoUpdated",
      before: {
        name: before.name,
        position: before.position?.ru,
        specialty: before.specialty?.ru,
      },
      after: {
        name: updated.name,
        position: updated.position?.ru,
        specialty: updated.specialty?.ru,
      },
    });
    return updated;
  });
}

/** Фото сотрудника (F-10-026) — файл уже сжат и проверен ImageUpload; здесь только запись */
export async function updateStaffPhoto(
  staffId: Id,
  avatarUrl: string | undefined,
): Promise<Staff> {
  if (isApiMode()) return S.patchStaff(staffId, { avatarUrl: avatarUrl ?? null });
  return request(async () => {
    assertCan("staff.manage");
    return coreUpdate("staff", staffId, { avatarUrl });
  });
}

// ─────────────────────────── «Индивидуал» / «в салоне» и «принимаю и дома» (F-00-048, F-00-045) ───────────────────────────

/**
 * Галочку ставит сам мастер (решение владельца 23.09.2026) — мгновенный тумблер, не ждёт общее «Сохранить»
 * карточки. `workplaces` уже поддерживает несколько мест одновременно (F-00-045) — здесь только 'home'.
 */
export async function setHomeAcceptance(
  staffId: Id,
  enabled: boolean,
): Promise<Staff> {
  if (isApiMode())
    return S.getStaff(staffId).then((before) =>
      S.patchStaff(staffId, {
        workplaces: enabled
          ? Array.from(new Set([...before.workplaces, "home" as Workplace]))
          : before.workplaces.filter((w) => w !== "home"),
      }),
    );
  return request(async () => {
    const before = readCore().staff.find((s) => s.id === staffId);
    if (!before) throw new ApiError("not_found");
    const workplaces: Workplace[] = enabled
      ? Array.from(new Set([...before.workplaces, "home" as Workplace]))
      : before.workplaces.filter((w) => w !== "home");
    return coreUpdate("staff", staffId, { workplaces });
  });
}

// ─────────────────────────── Юр. информация (F-10-038) ───────────────────────────

export function getStaffLegalInfo(staffId: Id): Promise<StaffLegalInfo> {
  if (isApiMode()) return S.getTab<StaffLegalInfo>(staffId, "legal").then((v) => v ?? emptyStaffLegalInfo());
  return request(
    () => readArea("staff").legalInfo[staffId] ?? emptyStaffLegalInfo(),
  );
}

export function setStaffLegalInfo(
  staffId: Id,
  businessId: Id,
  info: StaffLegalInfo,
): Promise<StaffLegalInfo> {
  if (isApiMode()) return S.setTab(staffId, "legal", info).then(() => info);
  return request(() => {
    assertCan("staff.manage");
    mutateArea("staff", (s) => {
      s.legalInfo[staffId] = info;
    });
    writeAudit({
      businessId,
      entity: "staff",
      entityId: staffId,
      action: "legalInfoUpdated",
    });
    return info;
  });
}

// ─────────────────────────── Настройки карточки (F-10-036 внешний ID, F-10-037) ───────────────────────────

export function getStaffCardSettings(staffId: Id): Promise<StaffCardSettings> {
  if (isApiMode())
    return S.getTab<StaffCardSettings>(staffId, "card-settings").then((v) => ({ ...emptyStaffCardSettings(), ...(v ?? {}) }));
  return request(
    () => readArea("staff").cardSettings[staffId] ?? emptyStaffCardSettings(),
  );
}

export function setStaffCardSettings(
  staffId: Id,
  patch: StaffCardSettings,
): Promise<StaffCardSettings> {
  if (isApiMode())
    return S.setTab(staffId, "card-settings", patch).then((v) => ({ ...emptyStaffCardSettings(), ...v }));
  return request(() => {
    assertCan("staff.manage");
    let result: StaffCardSettings = emptyStaffCardSettings();
    mutateArea("staff", (s) => {
      result = {
        ...(s.cardSettings[staffId] ?? emptyStaffCardSettings()),
        ...patch,
      };
      s.cardSettings[staffId] = result;
    });
    return result;
  });
}

// F-10-030 «Убрать из графика» — уже полностью построено разделом schedule
// (removeFromScheduleWithUndo/restoreAfterRemoveFromSchedule в src/api/schedule.ts, вкладка «График работы»
// хоста staffCard); свою версию здесь не заводим — не дублируем.

// ─────────────────────────── Пуши мастера «на себя» (F-10-137) ───────────────────────────

/** Мастер видит и включает только те типы, что владелец разрешил в матрице «Уведомления» (канал push) */
export function getMasterPushPrefs(
  staffId: Id,
): Promise<Record<string, boolean>> {
  if (isApiMode()) return S.getTab<Record<string, boolean>>(staffId, "push-prefs").then((v) => v ?? {});
  return request(() => readArea("staff").masterPushPrefs[staffId] ?? {});
}

export function setMasterPushPref(
  staffId: Id,
  event: string,
  value: boolean,
): Promise<Record<string, boolean>> {
  if (isApiMode()) return S.setTab(staffId, "push-prefs", { [event]: value }) as Promise<Record<string, boolean>>;
  return request(() => {
    let result: Record<string, boolean> = {};
    mutateArea("staff", (s) => {
      const prefs = { ...(s.masterPushPrefs[staffId] ?? {}), [event]: value };
      s.masterPushPrefs[staffId] = prefs;
      result = prefs;
    });
    return result;
  });
}

// ─────────────────────────── Ассистент и приглашение из карточки (С9, С13) ───────────────────────────

/** Галочка «Ассистент» в карточке (С9): бесплатное место, без своих записей и графика */
export async function setStaffAssistantOnly(staffId: Id, value: boolean): Promise<Staff> {
  if (isApiMode()) return S.patchStaff(staffId, { assistantOnly: value });
  return request(() => {
    assertCan("staff.manage");
    return coreTx.update("staff", staffId, { assistantOnly: value || undefined });
  });
}

/**
 * Отправить приглашение с вкладки «Доступ» (С13): только на проверенный телефон или почту — строка «staff-bad»
 * больше не проходит. По умолчанию номер из карточки.
 */
export function sendInviteForStaff(staffId: Id, target: string): Promise<StaffInvite> {
  const value = target.trim();
  const isEmail = /^\S+@\S+\.\S+$/.test(value);
  const phone = isEmail ? undefined : normalizePhone(value);
  if (!isEmail && !phone) return Promise.reject(new StaffValidationError("phone", "invalid phone"));
  if (isApiMode()) return S.reissueInvite(staffId).then((r) => r.invite);
  return request(() => {
    assertCan("staff.manage");
    const staff = readCore().staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError("not_found");
    const invite: StaffInvite = {
      id: newId("stinv"),
      businessId: staff.businessId,
      staffId,
      role: staff.role === "admin" ? "admin" : "master",
      phone: phone ?? undefined,
      email: isEmail ? value : undefined,
      status: "pending",
      createdAt: today(),
    };
    mutateArea("staff", (s) => {
      s.invites.push(invite);
    });
    writeAudit({ businessId: staff.businessId, entity: "staff", entityId: staffId, action: "inviteSent" });
    return invite;
  });
}

// ─────────────────────────── Роли и права (С19) ───────────────────────────

export interface RoleSummary {
  roleTemplateId: StaffRoleTemplateId;
  staff: { id: Id; name: string }[];
}

/** Сколько людей на каждой роли и кто они (экран «Роли и права») — по всем работающим сотрудникам бизнеса */
export function listRoleSummaries(businessId: Id): Promise<RoleSummary[]> {
  const build = (staff: Staff[], accessOf: (s: Staff) => StaffAccessInfo) => {
    const map = new Map<StaffRoleTemplateId, RoleSummary>();
    for (const st of staff) {
      if (st.status === "fired") continue;
      const id = accessOf(st).roleTemplateId ?? defaultRoleTemplateFor(st.role);
      const entry = map.get(id) ?? { roleTemplateId: id, staff: [] };
      entry.staff.push({ id: st.id, name: st.name });
      map.set(id, entry);
    }
    return [...map.values()];
  };
  if (isApiMode())
    return S.listStaff(businessId).then(async (rows) => {
      const staff = rows.map((r) => r.staff).filter((st) => st.status !== "fired");
      const access = await Promise.all(staff.map((st) => S.getAccess(st.id).then((a) => a.access).catch(() => emptyStaffAccess(st.role))));
      const byId = new Map(staff.map((st, i) => [st.id, access[i]]));
      return build(staff, (st) => byId.get(st.id) ?? emptyStaffAccess(st.role));
    });
  return request(() => {
    const area = readArea("staff");
    return build(
      readCore().staff.filter((st) => st.businessId === businessId),
      (st) => area.access[st.id] ?? emptyStaffAccess(st.role),
    );
  });
}

/**
 * Права роли разом (С19): грубый набор роли применяется ко всем её сотрудникам. Тонкие галочки конкретного
 * человека сбрасываются к роли — как «Сбросить к шаблону» в карточке, только для всех сразу.
 */
export async function applyRoleRights(
  businessId: Id,
  roleTemplateId: StaffRoleTemplateId,
  coarse: Permission[],
): Promise<number> {
  const summaries = await listRoleSummaries(businessId);
  const holders = summaries.find((r) => r.roleTemplateId === roleTemplateId)?.staff ?? [];
  for (const h of holders) {
    if (isApiMode()) await S.setRights(h.id, [], coarse);
    else {
      const { setStaffPermissions } = await import("@/api/core");
      await request(() => {
        mutateArea("staff", (s) => {
          delete s.rights[h.id];
        });
      });
      await setStaffPermissions(h.id, coarse);
    }
  }
  if (!isApiMode())
    await request(() =>
      writeAudit({ businessId, entity: "staffRole", entityId: roleTemplateId, action: "roleRightsApplied", after: { count: holders.length } }),
    );
  return holders.length;
}

// ─────────────────────────── «Что делает» новый мастер (С12) ───────────────────────────

export interface StaffSetupInput {
  staffId: Id;
  businessId: Id;
  /** Отмеченные услуги — назначаются (снятые галочки не трогаем: убрать услугу — во вкладке «Услуги») */
  serviceIds: Id[];
  /** «Как у салона» — рабочие часы филиала на 30 дней вперёд; keep — график не трогаем */
  schedule: "salon" | "keep";
  actorName: string;
}

/**
 * Шаг «Что делает» после добавления (С12): назначить услуги и график и, когда есть и то и другое, включить онлайн-
 * запись. Услуги и график — функциями их разделов (services, schedule): каждая проверяет свои права сама.
 */
/**
 * Неделя по умолчанию для «Как у салона», когда у филиала ещё нет часов работы (новый салон): пн–пт 10–19, сб 10–16.
 * Раньше шаг молча пропускался и мастер оставался «Не принимает записи: нет графика» (QA 01.10.2026).
 */
export const DEFAULT_SETUP_WEEK: WeekTemplate = {
  0: [{ from: "10:00", to: "19:00" }],
  1: [{ from: "10:00", to: "19:00" }],
  2: [{ from: "10:00", to: "19:00" }],
  3: [{ from: "10:00", to: "19:00" }],
  4: [{ from: "10:00", to: "19:00" }],
  5: [{ from: "10:00", to: "16:00" }],
  6: [],
};

/** Есть ли у филиала хоть один рабочий день (без этого «Как у салона» ставит DEFAULT_SETUP_WEEK) */
export function hasOpenHours(week: WeekTemplate | undefined): week is WeekTemplate {
  return Boolean(week && Object.values(week).some((d) => d?.length));
}

export async function applyStaffSetup(input: StaffSetupInput): Promise<{ onlineEnabled: boolean; usedDefaultWeek: boolean }> {
  const { assignStaffToService } = await import("@/api/services");
  const { setCells } = await import("@/api/schedule/table");
  const staff = isApiMode() ? await S.getStaff(input.staffId) : readCore().staff.find((s) => s.id === input.staffId);
  if (!staff) throw new ApiError("not_found");
  for (const serviceId of input.serviceIds) {
    if (!staff.serviceIds.includes(serviceId)) await assignStaffToService(serviceId, input.staffId, input.businessId);
  }
  let hasSchedule = isApiMode() ? Boolean(await getScheduleEnd(input.staffId)) : scheduleEndOf(input.staffId) !== null;
  let usedDefaultWeek = false;
  if (input.schedule === "salon") {
    const locationId = staff.locationIds[0];
    const location = readCore().locations.find((l) => l.id === locationId);
    usedDefaultWeek = !hasOpenHours(location?.openHours);
    const week = usedDefaultWeek ? DEFAULT_SETUP_WEEK : location?.openHours;
    if (locationId && week) {
      // Дни с одинаковыми часами — одним вызовом
      const byHours = new Map<string, { hours: DayHours; dates: ISODate[] }>();
      for (let i = 0; i < 30; i++) {
        const date = addDays(today(), i);
        const hours = week[weekdayIndex(date)];
        if (!hours?.length) continue;
        const key = JSON.stringify(hours);
        const entry = byHours.get(key) ?? { hours, dates: [] };
        entry.dates.push(date);
        byHours.set(key, entry);
      }
      for (const { hours, dates } of byHours.values()) {
        await setCells({ staffIds: [input.staffId], dates, typeId: "work", hours, locationId, actorName: input.actorName });
      }
      hasSchedule = hasSchedule || byHours.size > 0;
    }
  }
  const hasServices = staff.serviceIds.length + input.serviceIds.length > 0;
  const onlineEnabled = hasServices && hasSchedule;
  if (onlineEnabled && staff.onlineBookingEnabled === false) await setOnlineBookingEnabled(input.staffId, true);
  return { onlineEnabled, usedDefaultWeek };
}

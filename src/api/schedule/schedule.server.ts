'use client';

/**
 * Раздел «schedule» на настоящем сервере (docs/backend/PLAN.md этап 6, docs/backend/02 §5, 04): график, типы дня,
 * отметки календаря, правила онлайн-записи и свободные окна. Функции src/api/schedule/* в режиме `api` зовут эти.
 * После каждой записи график бизнеса перечитывается в зеркало (syncSchedule) — журнал, онлайн-запись и приложение
 * клиента ещё считают окна у себя (этапы 7–9) и должны видеть те же часы и правила.
 * Остаются на моке до этапа 7 (нужна таблица записей): серии, учебная запись, «Закончить раньше», «Задерживаюсь»,
 * быстрая запись (создание), загрузка дня, заполненность, окна пакетов.
 */
import { http } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import { mirrorCore, syncSchedule } from '@/api/mirror';
import { ApiError, trackRead } from '@/api/request';
import type { Booking, CalendarMark, DayHours, ISODate, ISODateTime, Id, Minutes, Staff, TimeRange } from '@/domain/core';
import type { HistoryEntry, PlanningPeriodYears, ScheduleFilters, ScheduleTemplate, ScheduleViewConfig, ServiceSlotWindow, SlotRule, SlotScopeKind, UnavailableRange } from '@/domain/schedule';
import { useDb } from '@/mock/db';
import { today } from '@/lib/date';
import type { AffectedBooking, CellSnapshot, CellsApplyResult, CellsEditResult, MarksEditResult, SetCellsInput, SetCellsResult } from '@/api/schedule/shared';
import type { AnySpecialistSlot, FreeSlot, SlotQuery, StaffSlotUtilization } from '@/api/schedule/slots';
import type { CalendarWeek } from '@/api/schedule/calendar';
import type { CopyScheduleInput, DeleteCellsInput, ScheduleRow, ScheduleTableInput } from '@/api/schedule/table';
import type { RemoveFromScheduleOutcome, RemoveFromScheduleSnapshot } from '@/api/schedule/staff';

// ─────────── чей бизнес ───────────

function sessionBiz(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}
export function bizOfStaff(staffId?: Id): Id {
  const fromMirror = staffId ? useDb.getState().core.staff.find((s) => s.id === staffId)?.businessId : undefined;
  return fromMirror ?? sessionBiz();
}
function bizOfScope(kind: SlotScopeKind, id: Id): Id {
  if (kind === 'staff') return bizOfStaff(id);
  return useDb.getState().core.locations.find((l) => l.id === id)?.businessId ?? sessionBiz();
}
function bizOfService(serviceId: Id): Id {
  return useDb.getState().core.services.find((s) => s.id === serviceId)?.businessId ?? sessionBiz();
}
function staffOfMark(markId: Id): Id {
  const staffId = useDb.getState().core.calendarMarks.find((m) => m.id === markId)?.staffId;
  if (!staffId) throw new ApiError('not_found', 'Mark not found');
  return staffId;
}
/** Бизнес записи — из зеркала журнала (стадия 21, лейн services+rest: getMoveCandidates не имеет businessId в подписи) */
function bizOfBooking(bookingId?: Id): Id {
  const fromMirror = bookingId ? useDb.getState().core.bookings.find((bk) => bk.id === bookingId)?.businessId : undefined;
  return fromMirror ?? sessionBiz();
}

const b = (businessId: Id) => `/v1/biz/${businessId}`;
const reads = () => trackRead('core.schedules', 'core.calendarMarks', 'areas.schedule');

/** После записи: график бизнеса — в зеркало, открытые экраны перечитают свои запросы */
async function changed<T>(businessId: Id, value: T): Promise<T> {
  await syncSchedule(businessId).catch(() => undefined);
  return value;
}

// ─────────── таблица и ячейки ───────────

export function getScheduleTable(input: ScheduleTableInput): Promise<ScheduleRow[]> {
  reads();
  trackRead('core.staff');
  return http<ScheduleRow[]>('POST', `${b(input.businessId)}/schedule/table`, {
    locationIds: input.locationIds,
    from: input.from,
    to: input.to,
    filters: input.filters,
  });
}

export function hasSavedSchedule(staffIds: Id[]): Promise<boolean> {
  reads();
  if (!staffIds.length) return Promise.resolve(false);
  return http<{ value: boolean }>('POST', `${b(bizOfStaff(staffIds[0]))}/schedule/has-saved`, { staffIds }).then((r) => r.value);
}

interface AffectedRef {
  bookingId: Id;
  staffId: Id;
  staffName: string;
  businessId: Id;
  start: ISODateTime;
  durationMin: number;
}

/** Ответ сервера — ссылки на записи; сами записи экран берёт из ядра (записи переезжают на сервер на этапе 7) */
function toAffected(refs: AffectedRef[]): AffectedBooking[] {
  const bookings = useDb.getState().core.bookings;
  return refs.map((r) => {
    const booking =
      bookings.find((x) => x.id === r.bookingId) ??
      ({
        id: r.bookingId,
        businessId: r.businessId,
        locationId: '',
        staffId: r.staffId,
        start: r.start,
        durationMin: r.durationMin,
        status: 'scheduled',
        services: [],
        total: 0,
        resourceIds: [],
        workplace: 'salon',
        source: 'journal',
        createdBy: r.staffId,
        forWhom: 'self',
      } as unknown as Booking);
    return { booking, staffName: r.staffName };
  });
}

export async function findAffectedBookings(staffIds: Id[], dates: ISODate[], newHours?: DayHours): Promise<AffectedBooking[]> {
  if (!staffIds.length || !dates.length) return [];
  const refs = await http<AffectedRef[]>('POST', `${b(bizOfStaff(staffIds[0]))}/schedule/affected`, { staffIds, dates, newHours });
  return toAffected(refs);
}

/** Тип и заметка дня сотрудников на дату (Г3, Г16) — сервер `note` пока не хранит (см. docstring контроллера) */
export function getStaffDayInfo(staffIds: Id[], date: ISODate): Promise<Record<Id, { typeId: string | null; note?: string }>> {
  reads();
  if (!staffIds.length) return Promise.resolve({});
  return http('POST', `${b(bizOfStaff(staffIds[0]))}/schedule/day-info`, { staffIds, date });
}

/** Кому передать записи закрываемого дня (Г3) */
export function getMoveCandidates(bookingIds: Id[]): Promise<Record<Id, { staffId: Id; name: string }[]>> {
  reads();
  if (!bookingIds.length) return Promise.resolve({});
  return http('POST', `${b(bizOfBooking(bookingIds[0]))}/schedule/move-candidates`, { bookingIds });
}

function cellsBody(input: SetCellsInput & { force?: boolean }) {
  return {
    staffIds: input.staffIds,
    dates: input.dates,
    typeId: input.typeId,
    hours: input.hours,
    locationId: input.locationId,
    vacationUntil: input.vacationUntil,
    historyAction: input.historyAction,
    force: input.force,
  };
}

export async function setCells(input: SetCellsInput): Promise<SetCellsResult> {
  const businessId = bizOfStaff(input.staffIds[0]);
  return changed(businessId, await http<SetCellsResult>('PUT', `${b(businessId)}/schedule/cells`, cellsBody(input)));
}

export function snapshotCells(staffIds: Id[], dates: ISODate[]): Promise<CellSnapshot[]> {
  return http<CellSnapshot[]>('POST', `${b(bizOfStaff(staffIds[0]))}/schedule/cells/snapshot`, { staffIds, dates });
}

export async function restoreCells(snapshot: CellSnapshot[]): Promise<void> {
  if (!snapshot.length) return;
  const businessId = bizOfStaff(snapshot[0].staffId);
  await http<void>('POST', `${b(businessId)}/schedule/cells/restore`, { snapshot });
  await changed(businessId, undefined);
}

type ApplyWire = ({ ok: true } & CellsEditResult) | { ok: false; affected: AffectedRef[] };

export async function applyCells(input: SetCellsInput & { force?: boolean }): Promise<CellsApplyResult> {
  const businessId = bizOfStaff(input.staffIds[0]);
  const res = await http<ApplyWire>('POST', `${b(businessId)}/schedule/cells/apply`, cellsBody(input));
  if (!res.ok) return { ok: false, affected: toAffected(res.affected) };
  return changed(businessId, res);
}

export async function deleteCells(input: DeleteCellsInput): Promise<SetCellsResult> {
  const businessId = bizOfStaff(input.staffIds[0]);
  const res = await http<SetCellsResult>('POST', `${b(businessId)}/schedule/cells/delete`, {
    staffIds: input.staffIds,
    dates: input.dates,
    force: input.force,
  });
  return changed(businessId, res);
}

// ─────────── шаблоны ───────────

export function getTemplates(businessId: Id): Promise<ScheduleTemplate[]> {
  trackRead('areas.schedule');
  return http<ScheduleTemplate[]>('GET', `${b(businessId)}/schedule/templates`);
}

export async function createTemplate(input: Omit<ScheduleTemplate, 'id' | 'createdAt'> & { id?: Id }): Promise<ScheduleTemplate> {
  const t = await http<ScheduleTemplate>('POST', `${b(input.businessId)}/schedule/templates`, {
    id: input.id || undefined,
    name: input.name,
    kind: input.kind,
    weekdays: input.weekdays,
    shiftWork: input.shiftWork,
    shiftOff: input.shiftOff,
    hours: input.hours,
  });
  return changed(input.businessId, t);
}

export async function updateTemplate(businessId: Id, id: Id, patch: Partial<Omit<ScheduleTemplate, 'id' | 'businessId'>>): Promise<void> {
  const { createdAt: _c, ...rest } = patch;
  await http<void>('PATCH', `${b(businessId)}/schedule/templates/${id}`, rest);
  await changed(businessId, undefined);
}

export async function deleteTemplate(businessId: Id, id: Id): Promise<void> {
  await http<void>('DELETE', `${b(businessId)}/schedule/templates/${id}`);
  await changed(businessId, undefined);
}

// ─────────── копирование ───────────

export async function copySchedule(input: CopyScheduleInput): Promise<void> {
  const businessId = bizOfStaff(input.fromStaffId);
  await http<void>('POST', `${b(businessId)}/schedule/copy`, {
    fromStaffId: input.fromStaffId,
    toStaffIds: input.toStaffIds,
    from: input.from,
    to: input.to,
    includeBreaks: input.includeBreaks,
  });
  await changed(businessId, undefined);
}

export async function copyFromLastWeek(staffId: Id, weekAnchor: ISODate): Promise<void> {
  const businessId = bizOfStaff(staffId);
  await http<void>('POST', `${b(businessId)}/schedule/copy-last-week`, { staffId, weekAnchor });
  await changed(businessId, undefined);
}

// ─────────── часы ───────────

interface HoursWire {
  days: { date: ISODate; hours: DayHours }[];
  scheduledMinutes: Minutes;
  scheduleEnd: ISODate | null;
}

function hours(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<HoursWire> {
  reads();
  return http<HoursWire>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/hours`, undefined, { query: { from, to, locationId } });
}

export function getDayHours(staffId: Id, date: ISODate, locationId?: Id): Promise<DayHours> {
  return hours(staffId, date, date, locationId).then((r) => r.days[0]?.hours ?? []);
}
export function getWorkDays(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<ISODate[]> {
  return hours(staffId, from, to, locationId).then((r) => r.days.filter((d) => d.hours.length > 0).map((d) => d.date));
}
export function getScheduledMinutes(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<Minutes> {
  return hours(staffId, from, to, locationId).then((r) => r.scheduledMinutes);
}
export function getScheduleEnd(staffId: Id): Promise<ISODate | undefined> {
  reads();
  const now = today();
  return hours(staffId, now, now).then((r) => r.scheduleEnd ?? undefined);
}

export async function addWorkDayWithUndo(staffId: Id, date: ISODate): Promise<CellsEditResult & { hours: DayHours }> {
  const businessId = bizOfStaff(staffId);
  return changed(businessId, await http<CellsEditResult & { hours: DayHours }>('POST', `${b(businessId)}/staff/${staffId}/work-day-with-undo`, { date }));
}

export async function addWorkDays(staffId: Id, dates: ISODate[], hoursIn?: DayHours, locationId?: Id): Promise<SetCellsResult> {
  const businessId = bizOfStaff(staffId);
  return changed(businessId, await http<SetCellsResult>('POST', `${b(businessId)}/staff/${staffId}/work-days`, { dates, hours: hoursIn, locationId }));
}

export function getHistory(staffIds?: Id[]): Promise<HistoryEntry[]> {
  trackRead('areas.schedule');
  const businessId = bizOfStaff(staffIds?.[0]);
  return http<HistoryEntry[]>('GET', `${b(businessId)}/schedule/history`, undefined, { query: { staffIds: staffIds?.length ? staffIds.join(',') : undefined } });
}

// ─────────── настройки раздела ───────────

interface SettingsWire {
  anySpecialistAllowed: boolean;
  allowOnlineOverNoShow: boolean;
  planningPeriodYears: PlanningPeriodYears;
  notifyMasterOnScheduleChange: boolean;
  skipStaffSelection: Record<Id, boolean>;
  historyLimitDays: Record<Id, number>;
  includeInFillRate: Record<Id, boolean>;
  googleCalendar: Record<Id, { connected: boolean; shareClientNames: boolean }>;
}
interface SettingsPatch {
  anySpecialistAllowed?: boolean;
  allowOnlineOverNoShow?: boolean;
  planningPeriodYears?: PlanningPeriodYears;
  notifyMasterOnScheduleChange?: boolean;
  /** Карты по сотруднику: null снимает ключ */
  skipStaffSelection?: Record<Id, boolean | null>;
  historyLimitDays?: Record<Id, number | null>;
  includeInFillRate?: Record<Id, boolean | null>;
  googleCalendar?: Record<Id, { connected: boolean; shareClientNames: boolean } | null>;
}

export function getSettings(businessId: Id): Promise<SettingsWire> {
  trackRead('areas.schedule');
  return http<SettingsWire>('GET', `${b(businessId)}/schedule/settings`);
}

export async function patchSettings(businessId: Id, patch: SettingsPatch): Promise<void> {
  await http<SettingsWire>('PATCH', `${b(businessId)}/schedule/settings`, patch);
  await changed(businessId, undefined);
}

export function staffSettings(staffId: Id): Promise<SettingsWire> {
  return getSettings(bizOfStaff(staffId));
}

export function patchStaffSettings(staffId: Id, patch: SettingsPatch): Promise<void> {
  return patchSettings(bizOfStaff(staffId), patch);
}

/**
 * Вид таблицы (F-02-004) и фильтры (F-02-003) — этап 21, лейн rest: были только в моке (свой `readArea('schedule')`
 * без сервера вообще), `ScheduleScreen` в api-режиме молча ничего не сохранял. Свой `area` на бэкенде — не
 * `schedule/settings` выше.
 */
export function getViewConfig(businessId: Id): Promise<ScheduleViewConfig> {
  trackRead('areas.schedule');
  return http<ScheduleViewConfig>('GET', `${b(businessId)}/schedule/view-config`);
}

export async function setViewConfig(businessId: Id, config: ScheduleViewConfig): Promise<void> {
  await http<ScheduleViewConfig>('PUT', `${b(businessId)}/schedule/view-config`, config);
  await changed(businessId, undefined);
}

export function getFilters(businessId: Id): Promise<ScheduleFilters> {
  trackRead('areas.schedule');
  return http<ScheduleFilters>('GET', `${b(businessId)}/schedule/table-filters`);
}

export async function setFilters(businessId: Id, filters: ScheduleFilters): Promise<void> {
  await http<ScheduleFilters>('PUT', `${b(businessId)}/schedule/table-filters`, filters);
  await changed(businessId, undefined);
}

export async function setJournalView(staffId: Id, patch: { hiddenInJournal?: boolean; journalMarkupMin?: number | null }): Promise<void> {
  const businessId = bizOfStaff(staffId);
  await http<void>('PUT', `${b(businessId)}/staff/${staffId}/journal-view`, patch);
  const staff = useDb.getState().core.staff.find((s) => s.id === staffId);
  if (staff) {
    const next: Staff = { ...staff };
    if (patch.hiddenInJournal !== undefined) next.hiddenInJournal = patch.hiddenInJournal || undefined;
    if (patch.journalMarkupMin !== undefined) next.journalMarkupMin = (patch.journalMarkupMin ?? undefined) as Staff['journalMarkupMin'];
    mirrorCore({ staff: [next] });
  }
}

// ─────────── «Убрать из графика» ───────────

export function previewRemoveFromSchedule(staffId: Id): Promise<number> {
  return http<{ affected: number }>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/remove-from-schedule`).then((r) => r.affected);
}

export async function removeFromScheduleWithUndo(staffId: Id, force: boolean): Promise<RemoveFromScheduleOutcome> {
  const businessId = bizOfStaff(staffId);
  const res = await http<{ ok: false; affected: number } | { ok: true; snapshot: { cells: CellSnapshot[]; openUntil: ISODate | null } }>(
    'POST',
    `${b(businessId)}/staff/${staffId}/remove-from-schedule`,
    { force },
  );
  if (!res.ok) return res;
  return changed(businessId, { ok: true as const, snapshot: { cells: res.snapshot.cells, openUntil: res.snapshot.openUntil ?? undefined } });
}

export async function restoreAfterRemoveFromSchedule(staffId: Id, snapshot: RemoveFromScheduleSnapshot): Promise<void> {
  const businessId = bizOfStaff(staffId);
  await http<void>('POST', `${b(businessId)}/staff/${staffId}/remove-from-schedule/restore`, {
    snapshot: { cells: snapshot.cells, openUntil: snapshot.openUntil ?? null },
  });
  await changed(businessId, undefined);
}

// ─────────── «Мой календарь» ───────────

export function getCalendarMode(staffId: Id): Promise<Staff['calendarMode'] | undefined> {
  trackRead('core.staff');
  return http<{ mode: Staff['calendarMode'] }>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/calendar-mode`).then((r) => r.mode);
}

export async function setCalendarMode(staffId: Id, mode: Staff['calendarMode']): Promise<void> {
  const businessId = bizOfStaff(staffId);
  await http<void>('PUT', `${b(businessId)}/staff/${staffId}/calendar-mode`, { mode });
  const staff = useDb.getState().core.staff.find((s) => s.id === staffId);
  if (staff) mirrorCore({ staff: [{ ...staff, calendarMode: mode }] });
  await changed(businessId, undefined);
}

export function getCalendarMarks(staffId: Id, from: ISODate, to: ISODate): Promise<CalendarMark[]> {
  reads();
  return http<CalendarMark[]>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/marks`, undefined, { query: { from, to } });
}

export async function addMark(input: Omit<CalendarMark, 'id'>): Promise<CalendarMark> {
  const businessId = bizOfStaff(input.staffId);
  const mark = await http<CalendarMark>('POST', `${b(businessId)}/staff/${input.staffId}/marks`, {
    date: input.date,
    from: input.from,
    to: input.to,
    kind: input.kind,
    workplace: input.workplace,
    note: input.note,
  });
  return changed(businessId, mark);
}

export async function removeMarkWithUndo(id: Id): Promise<MarksEditResult> {
  const staffId = staffOfMark(id);
  const businessId = bizOfStaff(staffId);
  return changed(businessId, await http<MarksEditResult>('DELETE', `${b(businessId)}/staff/${staffId}/marks/${id}`));
}

export async function restoreMarksRange(staffId: Id, from: ISODate, to: ISODate, marks: CalendarMark[]): Promise<void> {
  const businessId = bizOfStaff(staffId);
  await http<void>('POST', `${b(businessId)}/staff/${staffId}/marks/restore`, {
    from,
    to,
    marks: marks.map((m) => ({ date: m.date, from: m.from, to: m.to, kind: m.kind, workplace: m.workplace, note: m.note })),
  });
  await changed(businessId, undefined);
}

async function markTool<T>(staffId: Id, path: string, body: unknown): Promise<T> {
  const businessId = bizOfStaff(staffId);
  return changed(businessId, await http<T>('POST', `${b(businessId)}/staff/${staffId}/${path}`, body));
}

export const openWholeDay = (staffId: Id, date: ISODate) => markTool<MarksEditResult>(staffId, 'marks/whole-day', { date });
export const openWeek = (staffId: Id, from: ISODate, to: ISODate) => markTool<MarksEditResult>(staffId, 'marks/open-week', { from, to });
export const markCalendarRange = (staffId: Id, date: ISODate, from: string, to: string) =>
  markTool<MarksEditResult & { removed: boolean }>(staffId, 'marks/range', { date, from, to });
export const copyMarksFromLastWeek = (staffId: Id, weekAnchor: ISODate) => markTool<MarksEditResult>(staffId, 'marks/copy-last-week', { weekAnchor });
export const setVacationUntil = (staffId: Id, until: ISODate) => markTool<CellsEditResult>(staffId, 'vacation', { until });

export function getCalendarWeek(staffId: Id, from: ISODate, to: ISODate): Promise<CalendarWeek> {
  reads();
  trackRead('core.bookings');
  return http<CalendarWeek>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/calendar-week`, undefined, { query: { from, to } });
}

export function hasEmptyNextWeek(staffId: Id, from: ISODate): Promise<boolean> {
  reads();
  return http<{ value: boolean }>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/empty-next-week`, undefined, { query: { from } }).then((r) => r.value);
}

// ─────────── окна ───────────

export function getFreeSlots(q: SlotQuery): Promise<FreeSlot[]> {
  reads();
  trackRead('core.bookings');
  return http<FreeSlot[]>('GET', `${b(bizOfStaff(q.staffId))}/staff/${q.staffId}/slots`, undefined, {
    query: {
      date: q.date,
      durationMin: q.durationMin,
      durationMax: q.durationMax,
      bufferAfterMin: q.bufferAfterMin,
      locationId: q.locationId,
      stepMin: q.stepMin,
      serviceId: q.serviceId,
    },
  });
}

export function getNearestSlots(q: Omit<SlotQuery, 'date'> & { days?: number; limit?: number }): Promise<FreeSlot[]> {
  reads();
  trackRead('core.bookings');
  return http<FreeSlot[]>('GET', `${b(bizOfStaff(q.staffId))}/staff/${q.staffId}/nearest-slots`, undefined, {
    query: {
      durationMin: q.durationMin,
      durationMax: q.durationMax,
      bufferAfterMin: q.bufferAfterMin,
      locationId: q.locationId,
      stepMin: q.stepMin,
      serviceId: q.serviceId,
      days: q.days,
      limit: q.limit,
    },
  });
}

export function getQuickBookingSlots(q: { staffId: Id; date: ISODate; serviceId?: Id; locationId?: Id }): Promise<FreeSlot[]> {
  reads();
  trackRead('core.bookings');
  return http<FreeSlot[]>('GET', `${b(bizOfStaff(q.staffId))}/staff/${q.staffId}/quick-slots`, undefined, {
    query: { date: q.date, serviceId: q.serviceId, locationId: q.locationId },
  });
}

export function getAnySpecialistSlots(input: {
  businessId: Id;
  locationId: Id;
  date: ISODate;
  durationMin: Minutes;
  durationMax?: Minutes;
  bufferAfterMin?: Minutes;
  stepMin?: Minutes;
  serviceId?: Id;
}): Promise<AnySpecialistSlot[]> {
  reads();
  trackRead('core.bookings');
  const { businessId, ...query } = input;
  return http<AnySpecialistSlot[]>('GET', `${b(businessId)}/slots/any-specialist`, undefined, { query });
}

export function getSlotUtilizationReport(staffIds: Id[], from: ISODate, to: ISODate, locationId?: Id): Promise<StaffSlotUtilization[]> {
  reads();
  if (!staffIds.length) return Promise.resolve([]);
  return http<StaffSlotUtilization[]>('GET', `${b(bizOfStaff(staffIds[0]))}/slots/utilization`, undefined, {
    query: { staffIds: staffIds.join(','), from, to, locationId },
  });
}

// ─────────── правила онлайн-записи ───────────

export function getSlotMode(staffId: Id): Promise<'location' | 'own'> {
  reads();
  return http<{ mode: 'location' | 'own' }>('GET', `${b(bizOfStaff(staffId))}/staff/${staffId}/slot-mode`).then((r) => r.mode);
}

export async function setSlotMode(staffId: Id, locationId: Id, mode: 'location' | 'own'): Promise<void> {
  const businessId = bizOfStaff(staffId);
  await http<void>('PUT', `${b(businessId)}/staff/${staffId}/slot-mode`, { mode, locationId });
  await changed(businessId, undefined);
}

export function getSlotRules(kind: SlotScopeKind, id: Id): Promise<SlotRule[]> {
  reads();
  return http<SlotRule[]>('GET', `${b(bizOfScope(kind, id))}/slot-rules/${kind}/${id}`);
}

export function getEffectiveSlotRule(staffId: Id, locationId: Id, date: ISODate): Promise<SlotRule> {
  reads();
  return http<SlotRule>('GET', `${b(bizOfStaff(staffId))}/slot-rules/effective`, undefined, { query: { staffId, locationId, date } });
}

export async function saveSlotRule(kind: SlotScopeKind, id: Id, rule: SlotRule): Promise<SlotRule> {
  const businessId = bizOfScope(kind, id);
  return changed(businessId, await http<SlotRule>('PUT', `${b(businessId)}/slot-rules/${kind}/${id}`, rule));
}

export async function deleteSlotRule(kind: SlotScopeKind, id: Id, ruleId: Id): Promise<void> {
  const businessId = bizOfScope(kind, id);
  await http<void>('DELETE', `${b(businessId)}/slot-rules/${kind}/${id}/${ruleId}`);
  await changed(businessId, undefined);
}

export async function toggleRuleSlot(kind: SlotScopeKind, id: Id, ruleId: Id, time: string): Promise<void> {
  const businessId = bizOfScope(kind, id);
  await http<void>('POST', `${b(businessId)}/slot-rules/${kind}/${id}/${ruleId}/toggle-slot`, { time });
  await changed(businessId, undefined);
}

export async function toggleRulePart(kind: SlotScopeKind, id: Id, ruleId: Id, times: string[], enable: boolean): Promise<void> {
  const businessId = bizOfScope(kind, id);
  await http<void>('POST', `${b(businessId)}/slot-rules/${kind}/${id}/${ruleId}/toggle-part`, { times, enable });
  await changed(businessId, undefined);
}

export function getWorkRange(kind: SlotScopeKind, id: Id): Promise<TimeRange | null> {
  reads();
  return http<{ range: TimeRange | null }>('GET', `${b(bizOfScope(kind, id))}/work-range/${kind}/${id}`).then((r) => r.range);
}

export function getUnavailableDays(kind: SlotScopeKind, id: Id): Promise<UnavailableRange[]> {
  reads();
  return http<UnavailableRange[]>('GET', `${b(bizOfScope(kind, id))}/unavailable/${kind}/${id}`);
}

export async function addUnavailableRange(kind: SlotScopeKind, id: Id, range: Omit<UnavailableRange, 'id'>): Promise<UnavailableRange> {
  const businessId = bizOfScope(kind, id);
  return changed(businessId, await http<UnavailableRange>('POST', `${b(businessId)}/unavailable/${kind}/${id}`, range));
}

export async function removeUnavailableRange(kind: SlotScopeKind, id: Id, rangeId: Id): Promise<void> {
  const businessId = bizOfScope(kind, id);
  await http<void>('DELETE', `${b(businessId)}/unavailable/${kind}/${id}/${rangeId}`);
  await changed(businessId, undefined);
}

export function getBufferMin(kind: SlotScopeKind, id: Id): Promise<number> {
  reads();
  return http<{ minutes: number }>('GET', `${b(bizOfScope(kind, id))}/buffer/${kind}/${id}`).then((r) => r.minutes);
}

export async function setBufferMin(kind: SlotScopeKind, id: Id, minutes: number): Promise<void> {
  const businessId = bizOfScope(kind, id);
  await http<void>('PUT', `${b(businessId)}/buffer/${kind}/${id}`, { minutes });
  await changed(businessId, undefined);
}

export function getServiceSlotWindow(serviceId: Id): Promise<ServiceSlotWindow | undefined> {
  reads();
  return http<{ window: ServiceSlotWindow | null }>('GET', `${b(bizOfService(serviceId))}/service-window/${serviceId}`).then((r) => r.window ?? undefined);
}

export async function setServiceSlotWindow(window: ServiceSlotWindow): Promise<void> {
  const businessId = bizOfService(window.serviceId);
  const { serviceId, ...body } = window;
  await http<void>('PUT', `${b(businessId)}/service-window/${serviceId}`, body);
  await changed(businessId, undefined);
}

export async function clearServiceSlotWindow(serviceId: Id): Promise<void> {
  const businessId = bizOfService(serviceId);
  await http<void>('DELETE', `${b(businessId)}/service-window/${serviceId}`);
  await changed(businessId, undefined);
}


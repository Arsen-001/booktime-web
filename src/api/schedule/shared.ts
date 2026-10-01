'use client';

/**
 * Внутреннее раздела schedule: интервалы, права на график, запись ячеек графика и отметок — СИНХРОННО внутри request().
 * Наружу (index.ts) отдаются только типы правок и DEFAULT_DAY_RANGE.
 */
import { ApiError } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, canNow, coreTx, currentActor } from '@/api/core';
import {
  intersectIntervals,
  occupiesTime,
  rangesToIntervals as coreRangesToIntervals,
  scheduleHours,
  staffDayHours,
  subtractInterval,
  type Interval as CoreInterval,
} from '@/domain/rules';
import type { Booking, CalendarMark, CoreData, DayHours, ISODate, ISODateTime, Id, Minutes, TimeRange, WorkSchedule } from '@/domain/core';
import type { DayRecord, DayTypeId, HistoryAction, HistoryEntry } from '@/domain/schedule';
import { dayKey, dayTypeById } from '@/domain/schedule';
import { newId } from '@/lib/id';
import { datePart, dayjs, nowDateTime, toMinutes } from '@/lib/date';

export type Interval = [number, number];

/** Интервалы ядра (readonly) → изменяемые пары для расчётов раздела */
export function mutable(list: readonly CoreInterval[]): Interval[] {
  return list.map(([a, b]) => [a, b] as Interval);
}

export function rangesToIntervals(ranges: DayHours | TimeRange[]): Interval[] {
  return mutable(coreRangesToIntervals(ranges));
}

export function subtract(intervals: Interval[], cut: Interval): Interval[] {
  return mutable(subtractInterval(intervals, cut));
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  return mutable(intersectIntervals(a, b));
}

/** «Сейчас» по Еревану для «чистых» расчётов: принимает и старый Date (совместимость), и ISODateTime */
export function nowIso(now?: Date | ISODateTime): ISODateTime {
  if (!now) return nowDateTime();
  return typeof now === 'string' ? now : (dayjs(now).format('YYYY-MM-DDTHH:mm') as ISODateTime);
}

/** Минуты от начала дня для ISODateTime */
export function minutesOfDay(dt: ISODateTime): number {
  return toMinutes(dt.slice(11, 16) as TimeRange['from']);
}

/**
 * Править график: право schedule.edit; чужой график (не свой staffId) — ещё journal.others (у мастера его нет:
 * мастер правит только себя). Проверяется ВНУТРИ request() — так же проверит сервер.
 */
export function assertCanEditSchedule(targetStaffIds: readonly Id[]): void {
  assertCan('schedule.edit');
  const actor = currentActor();
  const foreign = targetStaffIds.some((id) => id !== actor.staffId);
  if (foreign && !canNow('journal.others')) throw new ApiError('forbidden', 'Чужой график правит только администратор');
}

export function effectiveHours(schedule: WorkSchedule, date: ISODate): DayHours {
  return scheduleHours(schedule, date);
}

/** График сотрудника для ЧТЕНИЯ одного места: в филиале — его график (салон первым), без филиала — салонный */
export function findSchedule(core: CoreData, staffId: Id, locationId?: Id): WorkSchedule | undefined {
  const own = core.schedules.filter((s) => s.staffId === staffId);
  if (locationId) {
    const here = own.filter((s) => s.locationId === locationId);
    return here.find((s) => s.workplace === 'salon') ?? here[0] ?? own[0];
  }
  return own.find((s) => s.workplace === 'salon') ?? own[0];
}

/** График, который ПРАВИТ таблица: салонный в филиале, иначе любой в филиале; нет — создадим салонный */
export function editableSchedule(core: CoreData, staffId: Id, locationId: Id): WorkSchedule | undefined {
  const here = core.schedules.filter((s) => s.staffId === staffId && s.locationId === locationId);
  return here.find((s) => s.workplace === 'salon') ?? here[0];
}

const EMPTY_WEEK: WorkSchedule['week'] = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
};

/** Синхронно пишет часы на даты в график сотрудника (внутри request()) */
export function txWriteOverrides(core: CoreData, staffId: Id, locationId: Id, patch: Record<ISODate, DayHours>): void {
  const existing = editableSchedule(core, staffId, locationId);
  if (existing) {
    coreTx.update('schedules', existing.id, {
      overrides: { ...existing.overrides, ...patch },
    });
    return;
  }
  coreTx.create('schedules', {
    staffId,
    locationId,
    workplace: 'salon',
    week: EMPTY_WEEK,
    overrides: patch,
  });
}

function readDays(): Record<string, DayRecord> {
  return readArea('schedule').days;
}

/** Явный тип дня из своего среза, иначе — вывод из часов ('work' если есть часы, иначе null — «нет данных») */
export function effectiveTypeId(staffId: Id, date: ISODate, hours: DayHours): DayTypeId | null {
  const explicit = readDays()[dayKey(staffId, date)];
  if (explicit) return explicit.typeId;
  return hours.length > 0 ? 'work' : null;
}

function hoursText(hours: DayHours): string {
  if (hours.length === 0) return '—';
  return `${hours[0].from}–${hours[hours.length - 1].to}`;
}

/** Автор правки для истории: имя сотрудника или роль (если своей карточки нет) — внутри request() */
export function historyActor(): { actorName: string; actorStaffId: Id | null; role: 'owner' | 'admin' | 'master' } {
  const actor = currentActor();
  const name = actor.staffId ? (readCore().staff.find((s) => s.id === actor.staffId)?.name ?? '') : '';
  const role = actor.persona === 'owner' || actor.persona === 'network' ? 'owner' : actor.persona === 'admin' ? 'admin' : 'master';
  return { actorName: name, actorStaffId: actor.staffId ?? null, role };
}

export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'at'>): void {
  mutateArea('schedule', (draft) => {
    draft.history = [{ id: newId('scha'), at: nowDateTime(), ...entry }, ...draft.history].slice(0, 200);
  });
}

export function minutesOf(hours: DayHours): Minutes {
  return hours.reduce((sum, r) => sum + (toMinutes(r.to) - toMinutes(r.from)), 0);
}

export interface AffectedBooking {
  booking: Booking;
  staffName: string;
  /** Г3: кого обзвонить — имя клиента записи */
  clientName?: string;
}

/** Запись выпадает из новых часов дня (или день становится нерабочим) */
function fallsOutside(b: Booking, newHours: DayHours | undefined): boolean {
  if (newHours === undefined) return true;
  if (newHours.length === 0) return true;
  const from = minutesOfDay(b.start);
  const to = from + b.durationMin;
  return !newHours.some((h) => toMinutes(h.from) <= from && to <= toMinutes(h.to));
}

export function txFindAffected(core: CoreData, staffIds: Id[], dates: ISODate[], newHours?: DayHours): AffectedBooking[] {
  const dateSet = new Set(dates);
  const out: AffectedBooking[] = [];
  for (const b of core.bookings) {
    if (!occupiesTime(b)) continue;
    if (!dateSet.has(datePart(b.start))) continue;
    const staff = staffIds.find((id) => id === b.staffId || b.services.some((s) => s.staffId === id));
    if (!staff) continue;
    if (!fallsOutside(b, newHours)) continue;
    const staffName = core.staff.find((s) => s.id === staff)?.name ?? '';
    const clientName = (b.clientId ? core.clients.find((c) => c.id === b.clientId)?.name : undefined) ?? b.visitorName;
    out.push({ booking: b, staffName, ...(clientName ? { clientName } : {}) });
  }
  return out.sort((a, b) => a.booking.start.localeCompare(b.booking.start));
}

export interface SetCellsInput {
  staffIds: Id[];
  dates: ISODate[];
  typeId: DayTypeId;
  /** Игнорируется для нерабочих типов — часы там всегда пустые */
  hours: DayHours;
  locationId?: Id;
  vacationUntil?: ISODate;
  /** Г16: заметка к дням; undefined — оставить прежнюю, '' — стереть */
  note?: string;
  actorName: string;
  actorStaffId?: Id | null;
  /** Какая операция для истории (по умолчанию — «Часы») */
  historyAction?: HistoryAction;
}

export interface SetCellsResult {
  addedDays: number;
  changedDays: number;
}

/** Синхронная правка ячеек — внутри request() */
export function txSetCells(input: SetCellsInput): SetCellsResult {
  assertCanEditSchedule(input.staffIds);
  const dt = dayTypeById(input.typeId);
  const hours = dt.working ? input.hours : [];
  let addedDays = 0;
  let changedDays = 0;
  let before: string | undefined;
  const core = readCore();

  for (const staffId of input.staffIds) {
    const staff = core.staff.find((s) => s.id === staffId);
    const locationId = input.locationId ?? staff?.locationIds[0];
    if (!locationId) continue;
    const existing = editableSchedule(core, staffId, locationId);
    const patch: Record<ISODate, DayHours> = {};
    for (const date of input.dates) {
      const was = existing ? effectiveHours(existing, date) : [];
      if (before === undefined) before = hoursText(was);
      if (was.length === 0 && hours.length > 0) addedDays += 1;
      else if (was.length > 0) changedDays += 1;
      patch[date] = hours;
    }
    txWriteOverrides(core, staffId, locationId, patch);
  }

  mutateArea('schedule', (draft) => {
    for (const staffId of input.staffIds) {
      for (const date of input.dates) {
        const key = dayKey(staffId, date);
        const note = input.note !== undefined ? input.note || undefined : draft.days[key]?.note;
        draft.days[key] = {
          staffId,
          date,
          typeId: input.typeId,
          vacationUntil: input.vacationUntil,
          ...(note ? { note } : {}),
        };
      }
    }
  });
  pushHistory({
    action: input.historyAction ?? (input.typeId === 'not_working' ? 'delete_days' : 'set_hours'),
    targetStaffIds: input.staffIds,
    dates: input.dates,
    summary: '',
    details: {
      typeId: input.typeId,
      days: input.dates.length,
      staff: input.staffIds.length,
      ...(input.dates.length === 1 && input.staffIds.length === 1 ? { before, after: hoursText(hours) } : {}),
    },
    actorName: input.actorName,
    actorStaffId: input.actorStaffId ?? currentActor().staffId ?? null,
  });
  return { addedDays, changedDays };
}

export interface CellSnapshot {
  staffId: Id;
  date: ISODate;
  hours: DayHours;
  typeId: DayTypeId;
  /** Г6: филиал, в котором сняли слепок, — «Отменить» возвращает туда же */
  locationId?: Id;
  note?: string;
}

/** Г6: правка идёт в выбранный филиал; не выбран — в первый филиал сотрудника */
export function editLocation(core: CoreData, staffId: Id, locationId?: Id): Id | undefined {
  const staff = core.staff.find((s) => s.id === staffId);
  if (locationId && staff?.locationIds.includes(locationId)) return locationId;
  return staff?.locationIds[0];
}

export function txSnapshotCells(core: CoreData, staffIds: Id[], dates: ISODate[], locationId?: Id): CellSnapshot[] {
  const out: CellSnapshot[] = [];
  const days = readDays();
  for (const staffId of staffIds) {
    const loc = editLocation(core, staffId, locationId);
    const schedule = loc ? editableSchedule(core, staffId, loc) : undefined;
    for (const date of dates) {
      const hours = schedule ? effectiveHours(schedule, date) : [];
      const note = days[dayKey(staffId, date)]?.note;
      out.push({
        staffId,
        date,
        hours,
        typeId: effectiveTypeId(staffId, date, hours) ?? 'not_working',
        ...(loc ? { locationId: loc } : {}),
        ...(note ? { note } : {}),
      });
    }
  }
  return out;
}

export function txRestoreCells(snapshot: CellSnapshot[]): void {
  const core = readCore();
  const byTarget = new Map<string, CellSnapshot[]>();
  for (const s of snapshot) {
    const key = `${s.staffId}|${s.locationId ?? ''}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), s]);
  }
  for (const cells of byTarget.values()) {
    const { staffId } = cells[0];
    const locationId = editLocation(core, staffId, cells[0].locationId);
    if (!locationId) continue;
    const patch: Record<ISODate, DayHours> = {};
    for (const c of cells) patch[c.date] = c.hours;
    txWriteOverrides(core, staffId, locationId, patch);
  }
  mutateArea('schedule', (draft) => {
    for (const c of snapshot)
      draft.days[dayKey(c.staffId, c.date)] = {
        staffId: c.staffId,
        date: c.date,
        typeId: c.typeId,
        ...(c.note ? { note: c.note } : {}),
      };
  });
}

// ─────────── План графика: шаблон, «повторить неделю», копирование, отсутствие, выходной салона (Г2, Г11, Г12, Г16) ───────────

/**
 * Одна клетка плана. hours — рабочий день с этими часами; null без typeId — день отдыха по циклу шаблона: рабочие
 * часы в нём СНИМАЮТСЯ (Г2: шаблон заменяет график в периоде, а не ложится поверх), отпуск и прочие типы остаются.
 * typeId нерабочего типа — отпуск / больничный / выходной салона на этот день.
 */
export interface PlanEntry {
  staffId: Id;
  date: ISODate;
  hours: DayHours | null;
  typeId?: DayTypeId;
  note?: string;
}

/** Итог плана — ОДИН расчёт для предпросмотра и для тоста после записи (Г2: «счётчик врёт») */
export interface PlanCounts {
  /** Рабочих дней в плане */
  work: number;
  /** Дней отдыха / отсутствия в плане */
  off: number;
  /** Было пусто — станет рабочим */
  added: number;
  /** Были другие часы или тип */
  changed: number;
  /** Были рабочие часы — день станет нерабочим */
  removed: number;
  unchanged: number;
}

type EntryEffect = 'added' | 'changed' | 'removed' | 'unchanged';

function sameDayHours(a: DayHours, b: DayHours): boolean {
  return a.length === b.length && a.every((r, i) => r.from === b[i].from && r.to === b[i].to);
}

export function planEffect(was: CellSnapshot | undefined, e: PlanEntry): EntryEffect {
  const wasType = was?.typeId ?? 'not_working';
  const wasWorking = Boolean(was && was.hours.length > 0 && dayTypeById(wasType).working);
  const noteChanged = e.note !== undefined && (e.note || undefined) !== was?.note;
  if (e.typeId && !dayTypeById(e.typeId).working) {
    if (wasWorking) return 'removed';
    return wasType === e.typeId && !noteChanged ? 'unchanged' : 'changed';
  }
  if (e.hours) {
    if (!wasWorking) return 'added';
    return sameDayHours(was?.hours ?? [], e.hours) && wasType === (e.typeId ?? 'work') && !noteChanged ? 'unchanged' : 'changed';
  }
  return wasWorking ? 'removed' : 'unchanged';
}

export function countPlan(before: CellSnapshot[], entries: PlanEntry[]): PlanCounts {
  const byKey = new Map(before.map((c) => [dayKey(c.staffId, c.date), c]));
  const out: PlanCounts = { work: 0, off: 0, added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const e of entries) {
    const isWork = Boolean(e.hours) && (!e.typeId || dayTypeById(e.typeId).working);
    if (isWork) out.work += 1;
    else out.off += 1;
    out[planEffect(byKey.get(dayKey(e.staffId, e.date)), e)] += 1;
  }
  return out;
}

/** Часы клетки после плана: undefined — клетку план не трогает */
export function planHours(e: PlanEntry, effect: EntryEffect): DayHours | undefined {
  if (effect === 'unchanged') return undefined;
  if (e.typeId && !dayTypeById(e.typeId).working) return [];
  return e.hours ?? [];
}

export function planTypeId(e: PlanEntry): DayTypeId {
  if (e.typeId) return e.typeId;
  return e.hours ? 'work' : 'not_working';
}

export interface PlanApplyInput {
  entries: PlanEntry[];
  locationId?: Id;
  actorName: string;
  actorStaffId?: Id | null;
  historyAction?: HistoryAction;
  force?: boolean;
}

export type PlanApplyResult = ({ ok: true; before: CellSnapshot[] } & PlanCounts) | { ok: false; affected: AffectedBooking[] };

export function planStaffDates(entries: PlanEntry[]): { staffIds: Id[]; dates: ISODate[] } {
  return {
    staffIds: [...new Set(entries.map((e) => e.staffId))],
    dates: [...new Set(entries.map((e) => e.date))].sort(),
  };
}

/** Синхронная запись плана — внутри request(). Записи в затронутых днях без force — ok=false со списком. */
export function txApplyPlan(input: PlanApplyInput): PlanApplyResult {
  const { staffIds, dates } = planStaffDates(input.entries);
  assertCanEditSchedule(staffIds);
  const core = readCore();
  const before = txSnapshotCells(core, staffIds, dates, input.locationId);
  const byKey = new Map(before.map((c) => [dayKey(c.staffId, c.date), c]));
  const writes = input.entries
    .map((e) => ({ e, effect: planEffect(byKey.get(dayKey(e.staffId, e.date)), e) }))
    .filter((w) => w.effect !== 'unchanged');

  if (!input.force) {
    const seen = new Set<Id>();
    const affected: AffectedBooking[] = [];
    for (const { e, effect } of writes) {
      for (const a of txFindAffected(core, [e.staffId], [e.date], planHours(e, effect)))
        if (!seen.has(a.booking.id)) {
          seen.add(a.booking.id);
          affected.push(a);
        }
    }
    if (affected.length > 0) return { ok: false, affected: affected.sort((a, b) => a.booking.start.localeCompare(b.booking.start)) };
  }

  const patches = new Map<Id, Record<ISODate, DayHours>>();
  for (const { e, effect } of writes) {
    const patch = patches.get(e.staffId) ?? {};
    patch[e.date] = planHours(e, effect) ?? [];
    patches.set(e.staffId, patch);
  }
  for (const [staffId, patch] of patches) {
    const loc = editLocation(core, staffId, input.locationId);
    if (loc) txWriteOverrides(core, staffId, loc, patch);
  }
  mutateArea('schedule', (draft) => {
    for (const { e } of writes) {
      const key = dayKey(e.staffId, e.date);
      const note = e.note !== undefined ? e.note || undefined : draft.days[key]?.note;
      draft.days[key] = { staffId: e.staffId, date: e.date, typeId: planTypeId(e), ...(note ? { note } : {}) };
    }
  });
  const counts = countPlan(before, input.entries);
  if (writes.length > 0)
    pushHistory({
      action: input.historyAction ?? 'apply_template',
      targetStaffIds: staffIds,
      dates,
      summary: '',
      details: { days: writes.length, staff: staffIds.length },
      actorName: input.actorName,
      actorStaffId: input.actorStaffId ?? currentActor().staffId ?? null,
    });
  return { ok: true, before, ...counts };
}

/** Правка + слепок «до» одним запросом — экран держит слепок для «Отменить» */
export interface CellsEditResult extends SetCellsResult {
  before: CellSnapshot[];
}

/**
 * Ответ правки, которая может задеть записи (F-02-106): ok=false — ничего не записано, экран показывает записи
 * и «Сохранить всё равно» (force). Один запрос вместо «проверить, потом записать».
 */
export type CellsApplyResult = ({ ok: true } & CellsEditResult) | { ok: false; affected: AffectedBooking[] };

export function stripBreaks(hours: DayHours): DayHours {
  if (hours.length <= 1) return hours;
  return [{ from: hours[0].from, to: hours[hours.length - 1].to }];
}

export function staffNameOf(staffId: Id): string {
  return readCore().staff.find((s) => s.id === staffId)?.name ?? '';
}

export function txMarks(staffId: Id, from: ISODate, to: ISODate): CalendarMark[] {
  return readCore().calendarMarks.filter((m) => m.staffId === staffId && m.date >= from && m.date <= to);
}

export function txAddMark(input: Omit<CalendarMark, 'id'>): CalendarMark {
  return coreTx.create('calendarMarks', input);
}

export function txRemoveMark(id: Id): void {
  coreTx.remove('calendarMarks', id);
}

export function txReplaceMarks(staffId: Id, from: ISODate, to: ISODate, marks: CalendarMark[]): void {
  for (const m of txMarks(staffId, from, to)) txRemoveMark(m.id);
  for (const m of marks)
    txAddMark({
      staffId: m.staffId,
      date: m.date,
      from: m.from,
      to: m.to,
      kind: m.kind,
      workplace: m.workplace,
      note: m.note,
    });
}

/** Результат быстрого инструмента календаря — слепок «до» для «Отменить» и сколько изменено */
export interface MarksEditResult {
  before: CalendarMark[];
  from: ISODate;
  to: ISODate;
  changed: number;
}

/** Часы дня «с–до» без перерывов (для «Открыть весь день») или 10:00–19:00, если графика нет */
export function txWholeDayRange(core: CoreData, staffId: Id, date: ISODate): TimeRange | null {
  const hours = staffDayHours(core, staffId, date);
  if (hours.length === 0) return null;
  return stripBreaks(hours)[0];
}

export function txOpenDay(core: CoreData, staffId: Id, date: ISODate): boolean {
  const staff = core.staff.find((s) => s.id === staffId);
  if (staff?.calendarMode === 'busy') {
    const range = txWholeDayRange(core, staffId, date) ?? DEFAULT_DAY_RANGE;
    const already = txMarks(staffId, date, date).some((m) => m.kind === 'free' && m.from <= range.from && m.to >= range.to);
    if (already) return false;
    for (const m of txMarks(staffId, date, date).filter((x) => x.kind === 'free')) txRemoveMark(m.id);
    txAddMark({ staffId, date, from: range.from, to: range.to, kind: 'free' });
    return true;
  }
  const busy = txMarks(staffId, date, date).filter((x) => x.kind === 'busy');
  for (const m of busy) txRemoveMark(m.id);
  return busy.length > 0;
}

/** Часы по умолчанию, когда взять неоткуда (новый мастер): 10:00–19:00 (ux-r5 S-2 — не 10–22) */
export const DEFAULT_DAY_RANGE: TimeRange = { from: '10:00', to: '19:00' };

export function txScheduleEnd(staffId: Id): ISODate | undefined {
  const ends = readCore()
    .schedules.filter((s) => s.staffId === staffId)
    .map((s) => s.openUntil)
    .filter((d): d is ISODate => Boolean(d));
  return ends.length ? ends.sort().at(-1) : undefined;
}

export interface QuickBookingInput {
  businessId: Id;
  locationId: Id;
  staffId: Id;
  start: ISODateTime;
  serviceId: Id;
  durationMin: number;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  createdBy: Id | 'client';
  seriesId?: Id;
}

export function quickBookingInput(input: QuickBookingInput) {
  return {
    source: 'journal' as const,
    businessId: input.businessId,
    locationId: input.locationId,
    staffId: input.staffId,
    start: input.start,
    services: [{ serviceId: input.serviceId }],
    client: input.clientId ? { clientId: input.clientId } : { phone: input.clientPhone, name: input.clientName },
    createdBy: input.createdBy,
    seriesId: input.seriesId,
  };
}

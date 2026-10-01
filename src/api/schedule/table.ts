'use client';

/**
 * Таблица «Сотрудники × дни» (F-02-002…016, F-02-106): правка ячеек, шаблоны, копирование, помощники для журнала, история.
 */
import { isApiMode } from '@/api/http';
import * as S from '@/api/schedule/schedule.server';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, currentActor } from '@/api/core';
import { occupiesTime, staffDayHours } from '@/domain/rules';
import type { DayHours, ISODate, Id, Minutes, Staff, Workplace } from '@/domain/core';
import type { DayTypeId, HistoryEntry, ScheduleFilters, ScheduleTemplate, ScheduleViewConfig } from '@/domain/schedule';
import { DEFAULT_FILTERS, DEFAULT_VIEW_CONFIG, dayKey, dayTypeById, isScheduleStaff } from '@/domain/schedule';
import { newId } from '@/lib/id';
import { addDays, datePart, eachDay, nowDateTime, parse, today, toISODate, weekStart, weekdayIndex } from '@/lib/date';
import {
  DEFAULT_DAY_RANGE,
  assertCanEditSchedule,
  countPlan,
  editLocation,
  editableSchedule,
  effectiveHours,
  effectiveTypeId,
  findSchedule,
  minutesOf,
  pushHistory,
  stripBreaks,
  txFindAffected,
  txRestoreCells,
  planEffect,
  planHours,
  planStaffDates,
  planTypeId,
  txApplyPlan,
  txScheduleEnd,
  txSetCells,
  txSnapshotCells,
  txWriteOverrides,
} from '@/api/schedule/shared';
import type {
  AffectedBooking,
  CellSnapshot,
  CellsApplyResult,
  CellsEditResult,
  PlanApplyInput,
  PlanApplyResult,
  PlanCounts,
  PlanEntry,
  SetCellsInput,
  SetCellsResult,
} from '@/api/schedule/shared';

/** Часы в другом месте работы («дома», выезд) — видны в таблице подписью, правятся в своём графике */
export interface ScheduleCellElsewhere {
  workplace: Workplace;
  hours: DayHours;
  /** Г6: в каком филиале эти часы (при «Все филиалы» у мастера двух филиалов) */
  locationId?: Id;
}

export interface ScheduleCell {
  date: ISODate;
  /** Часы графика, который правит таблица (салон в филиале) */
  hours: DayHours;
  typeId: DayTypeId | null;
  hasBookings: boolean;
  /** Г3: сколько записей в дне — нерабочий день с записями подсвечивается «перенести» */
  bookings?: number;
  /** Г16: заметка к дню */
  note?: string;
  /** Г6: филиал основного графика клетки (только если мастер работает в нескольких филиалах) */
  locationId?: Id;
  /** e2e-q1 №1: второй график мастера (дома / выезд) — клиенты по нему записываются, мастер должен его видеть */
  elsewhere?: ScheduleCellElsewhere[];
}

export interface ScheduleRow {
  staff: Staff;
  cells: ScheduleCell[];
  /** Рабочих дней и суммарных часов за период по ВСЕМ местам работы (F-02-002 «Итого») */
  totalDays: number;
  totalMinutes: Minutes;
}

export interface ScheduleTableInput {
  businessId: Id;
  locationIds: Id[];
  from: ISODate;
  to: ISODate;
  filters?: Partial<ScheduleFilters>;
}

/**
 * Таблица «Сотрудники × дни» (F-02-002) уже применяет фильтры (F-02-003). Строки: сначала те, у кого в периоде
 * есть рабочие дни (ux-best-c3 №1), потом без графика — по имени.
 */
export function getScheduleTable(input: ScheduleTableInput): Promise<ScheduleRow[]> {
  if (isApiMode()) return S.getScheduleTable(input);
  return request(() => {
    const core = readCore();
    const dates = eachDay(input.from, input.to);
    const f = { ...DEFAULT_FILTERS, ...input.filters };
    let staffList = core.staff.filter((s) => s.businessId === input.businessId && s.locationIds.some((l) => input.locationIds.includes(l)));
    // Г14: кто стоит в графике — общее правило с журналом (isScheduleStaff); фильтры «Уволенные / Удалённые» — только их
    staffList = staffList.filter((s) =>
      f.fired === 'only' ? s.status === 'fired' : f.deleted === 'only' ? s.status === 'disabled' : isScheduleStaff(s),
    );
    if (f.staffIds.length) staffList = staffList.filter((s) => f.staffIds.includes(s.id));
    if (f.positions.length) staffList = staffList.filter((s) => s.position && f.positions.includes(s.position.ru));
    if (f.specializations.length) {
      const categoryOf = new Map(core.services.map((sv) => [sv.id, sv.categoryId]));
      staffList = staffList.filter((s) => s.serviceIds.some((id) => f.specializations.includes(categoryOf.get(id) ?? '')));
    }

    const singleLocation = input.locationIds.length === 1 ? input.locationIds[0] : undefined;
    const days = readArea('schedule').days;
    const bookingsByDay = new Map<string, number>();
    for (const b of core.bookings) {
      if (!occupiesTime(b)) continue;
      const d = datePart(b.start);
      if (d < input.from || d > input.to) continue;
      for (const id of new Set([b.staffId, ...b.services.map((sv) => sv.staffId)])) {
        const k = dayKey(id, d);
        bookingsByDay.set(k, (bookingsByDay.get(k) ?? 0) + 1);
      }
    }
    const rows: ScheduleRow[] = staffList.map((staff) => {
      const own = core.schedules.filter((s) => s.staffId === staff.id && (!singleLocation || s.locationId === singleLocation));
      const main = own.find((s) => s.workplace === 'salon') ?? own[0];
      const others = own.filter((s) => s !== main);
      const multiLocation = !singleLocation && new Set(own.map((s) => s.locationId)).size > 1;
      let totalDays = 0;
      let totalMinutes = 0;
      const cells: ScheduleCell[] = dates.map((date) => {
        const hours = main ? effectiveHours(main, date) : [];
        const typeId = effectiveTypeId(staff.id, date, hours);
        const elsewhere = others
          .map((s) => ({
            workplace: s.workplace,
            hours: effectiveHours(s, date),
            ...(multiLocation ? { locationId: s.locationId } : {}),
          }))
          .filter((x) => x.hours.length > 0);
        const union = staffDayHours({ schedules: own }, staff.id, date);
        const mainWorks = hours.length > 0 && typeId !== 'not_working';
        if (mainWorks || elsewhere.length > 0) {
          totalDays += 1;
          totalMinutes += minutesOf(mainWorks ? union : elsewhere.flatMap((x) => x.hours));
        }
        const bookings = bookingsByDay.get(dayKey(staff.id, date)) ?? 0;
        const note = days[dayKey(staff.id, date)]?.note;
        return {
          date,
          hours,
          typeId,
          hasBookings: bookings > 0,
          ...(bookings > 0 ? { bookings } : {}),
          ...(note ? { note } : {}),
          ...(multiLocation && main ? { locationId: main.locationId } : {}),
          ...(elsewhere.length ? { elsewhere } : {}),
        };
      });
      return { staff, cells, totalDays, totalMinutes };
    });

    const filtered =
      f.hasSchedule === 'with'
        ? rows.filter((r) => r.totalDays > 0)
        : f.hasSchedule === 'without'
          ? rows.filter((r) => r.totalDays === 0)
          : rows;
    return filtered.sort((a, b) => {
      const aw = a.totalDays > 0 ? 0 : 1;
      const bw = b.totalDays > 0 ? 0 : 1;
      return aw - bw || a.staff.name.localeCompare(b.staff.name);
    });
  });
}

/**
 * Хоть у одного из сотрудников уже есть сохранённый график (F-02-010): «Нерабочий день» существует
 * только для удаления РАНЕЕ поставленного рабочего дня — у полностью пустого графика (новый салон)
 * удалять пока нечего, поэтому тип в списке не предлагаем.
 */
export function hasSavedSchedule(staffIds: Id[]): Promise<boolean> {
  if (isApiMode()) return S.hasSavedSchedule(staffIds);
  return request(() => {
    const core = readCore();
    return staffIds.some((staffId) =>
      core.schedules.some(
        (schedule) =>
          schedule.staffId === staffId &&
          (Object.values(schedule.week).some((h) => h.length > 0) || Object.values(schedule.overrides).some((h) => h.length > 0)),
      ),
    );
  });
}

export function getViewConfig(businessId: Id): Promise<ScheduleViewConfig> {
  if (isApiMode()) return S.getViewConfig(businessId);
  return request(() => readArea('schedule').viewConfig[businessId] ?? DEFAULT_VIEW_CONFIG);
}

export function setViewConfig(businessId: Id, config: ScheduleViewConfig): Promise<void> {
  if (isApiMode()) return S.setViewConfig(businessId, config);
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.viewConfig[businessId] = config;
    });
  });
}

export function getFilters(businessId: Id): Promise<ScheduleFilters> {
  if (isApiMode()) return S.getFilters(businessId);
  return request(() => readArea('schedule').filters[businessId] ?? DEFAULT_FILTERS);
}

export function setFilters(businessId: Id, filters: ScheduleFilters): Promise<void> {
  if (isApiMode()) return S.setFilters(businessId, filters);
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.filters[businessId] = filters;
    });
  });
}

/**
 * Записи, задетые правкой графика на эти даты у этих сотрудников (F-02-106). newHours — новые часы: тогда
 * в ответе только записи, которые в них НЕ помещаются (удлинение дня никого не задевает — ux-r5 S-3).
 * Без newHours — все записи на даты (день становится нерабочим).
 */
export function findAffectedBookings(staffIds: Id[], dates: ISODate[], newHours?: DayHours): Promise<AffectedBooking[]> {
  if (isApiMode()) return S.findAffectedBookings(staffIds, dates, newHours);
  return request(() => txFindAffected(readCore(), staffIds, dates, newHours));
}

/** Кладёт тип+часы на все отмеченные (staff × date) — панель «Настройка графика» и шаблоны. Один запрос. */
export function setCells(input: SetCellsInput): Promise<SetCellsResult> {
  if (isApiMode()) return S.setCells(input);
  return request(() => txSetCells(input));
}

/** Слепок ячеек ДО правки — для «Отменить» 5 секунд (F-00-061) */
export function snapshotCells(staffIds: Id[], dates: ISODate[], locationId?: Id): Promise<CellSnapshot[]> {
  if (isApiMode()) return S.snapshotCells(staffIds, dates);
  return request(() => txSnapshotCells(readCore(), staffIds, dates, locationId));
}

/** Возвращает ячейки к слепку из snapshotCells (реализация «Отменить») — один запрос */
export function restoreCells(snapshot: CellSnapshot[]): Promise<void> {
  if (isApiMode()) return S.restoreCells(snapshot);
  return request(() => {
    assertCanEditSchedule([...new Set(snapshot.map((c) => c.staffId))]);
    txRestoreCells(snapshot);
  });
}

/** Панель «Настройка графика»: одним запросом проверка записей, слепок «до» и запись (F-02-005, F-02-106) */
export function applyCells(input: SetCellsInput & { force?: boolean }): Promise<CellsApplyResult> {
  if (isApiMode()) return S.applyCells(input);
  return request(() => {
    const core = readCore();
    if (!input.force) {
      const dt = dayTypeById(input.typeId);
      const affected = txFindAffected(core, input.staffIds, input.dates, dt.working ? input.hours : []);
      if (affected.length > 0) return { ok: false as const, affected };
    }
    const before = txSnapshotCells(core, input.staffIds, input.dates, input.locationId);
    const result = txSetCells(input);
    return { ok: true as const, ...result, before };
  });
}

export interface DeleteCellsInput {
  staffIds: Id[];
  dates: ISODate[];
  actorName: string;
  actorStaffId?: Id | null;
  /** Продолжить, даже если на эти даты есть записи (F-02-106: без force — ошибка) */
  force?: boolean;
  /** Г6: филиал, в котором правим (по умолчанию — первый филиал сотрудника) */
  locationId?: Id;
}

/**
 * Удаление рабочих дней (F-02-014): тип «Нерабочий день», часы пустые. Это функция, которую вызывают
 * «Отменить рабочий день» (F-02-027) и «Удалить рабочие дни» из журнала (F-02-028, F-02-035). Без force бросает
 * schedule_has_bookings (F-02-106), если на даты есть записи. Один запрос: проверка и запись вместе.
 */
export function deleteCells(input: DeleteCellsInput): Promise<SetCellsResult> {
  if (isApiMode()) return S.deleteCells(input);
  return request(() => {
    if (!input.force) {
      const affected = txFindAffected(readCore(), input.staffIds, input.dates);
      if (affected.length > 0) throw new ApiError('schedule_has_bookings', String(affected.length));
    }
    return txSetCells({
      staffIds: input.staffIds,
      dates: input.dates,
      typeId: 'not_working',
      hours: [],
      locationId: input.locationId,
      actorName: input.actorName,
      actorStaffId: input.actorStaffId,
    });
  });
}

/** Удаление со слепком «до» одним запросом — для «Отменить» 5 с (F-00-061); записи на датах — ok=false */
export function deleteCellsWithUndo(input: DeleteCellsInput): Promise<CellsApplyResult> {
  return applyCells({ ...input, typeId: 'not_working', hours: [] });
}

/** «Без шаблона» (F-02-006) — отмеченные даты как есть, без вычисления */
export function datesForNoneTemplate(dates: ISODate[]): ISODate[] {
  return dates;
}

/** «По дням недели» (F-02-007, F-02-033): weeks недель от даты якоря (не обязательно понедельник) */
export function datesForWeekdaysTemplate(anchor: ISODate, weekdays: number[], weeks: number): ISODate[] {
  const days = Math.max(1, Math.min(30, weeks)) * 7;
  const out: ISODate[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(anchor, i);
    if (weekdays.includes(weekdayIndex(iso))) out.push(iso);
  }
  return out;
}

/** «По сменам» (F-02-008, F-02-033): цикл N рабочих / M выходных от даты якоря, максимум 365 дней всего */
export function datesForShiftsTemplate(anchor: ISODate, workDays: number, offDays: number, weeks: number): ISODate[] {
  const totalDays = Math.min(365, Math.max(1, Math.min(30, weeks)) * 7);
  const cycle = Math.max(1, workDays + offDays);
  const out: ISODate[] = [];
  for (let i = 0; i < totalDays; i++) {
    if (i % cycle < workDays) out.push(addDays(anchor, i));
  }
  return out;
}

export function getTemplates(businessId: Id): Promise<ScheduleTemplate[]> {
  if (isApiMode()) return S.getTemplates(businessId);
  return request(() => readArea('schedule').templates[businessId] ?? []);
}

export function createTemplate(input: Omit<ScheduleTemplate, 'id' | 'createdAt'> & { id?: Id }): Promise<ScheduleTemplate> {
  if (isApiMode()) return S.createTemplate(input);
  return request(() => {
    assertCan('schedule.edit');
    const created: ScheduleTemplate = {
      ...input,
      id: input.id ?? newId('sctpl'),
      createdAt: nowDateTime(),
    };
    mutateArea('schedule', (draft) => {
      draft.templates[input.businessId] = [...(draft.templates[input.businessId] ?? []), created];
    });
    return created;
  });
}

export function updateTemplate(businessId: Id, id: Id, patch: Partial<Omit<ScheduleTemplate, 'id' | 'businessId'>>): Promise<void> {
  if (isApiMode()) return S.updateTemplate(businessId, id, patch);
  return request(() => {
    assertCan('schedule.edit');
    mutateArea('schedule', (draft) => {
      draft.templates[businessId] = (draft.templates[businessId] ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t));
    });
  });
}

export function deleteTemplate(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return S.deleteTemplate(businessId, id);
  return request(() => {
    assertCan('schedule.edit');
    mutateArea('schedule', (draft) => {
      draft.templates[businessId] = (draft.templates[businessId] ?? []).filter((t) => t.id !== id);
    });
  });
}

export interface CopyScheduleInput {
  fromStaffId: Id;
  toStaffIds: Id[];
  from: ISODate;
  to: ISODate;
  includeBreaks: boolean;
  actorName: string;
  actorStaffId?: Id | null;
  /** Г6: филиал — и источник, и куда пишем */
  locationId?: Id;
  force?: boolean;
}

/** Максимум периода копирования — до конца следующего месяца (F-02-015) */
export function maxCopyToDate(from: ISODate = today()): ISODate {
  return toISODate(parse(from).add(1, 'month').endOf('month'));
}

function copyDates(input: Pick<CopyScheduleInput, 'from' | 'to'>): ISODate[] {
  const cap = maxCopyToDate(input.from);
  return eachDay(input.from, input.to > cap ? cap : input.to);
}

/** План копирования: у каждого получателя день становится таким же, как у источника (рабочий, отпуск, выходной) */
function copyEntries(source: CellSnapshot[], toStaffIds: Id[], includeBreaks: boolean): PlanEntry[] {
  return toStaffIds.flatMap((staffId) =>
    source.map((c): PlanEntry => {
      const working = c.hours.length > 0 && dayTypeById(c.typeId).working;
      if (working) return { staffId, date: c.date, hours: includeBreaks ? c.hours : stripBreaks(c.hours) };
      return c.typeId === 'not_working' || c.typeId === 'work' ? { staffId, date: c.date, hours: null } : { staffId, date: c.date, hours: null, typeId: c.typeId };
    }),
  );
}

async function copyPlan(input: CopyScheduleInput): Promise<PlanEntry[]> {
  const source = await snapshotCells([input.fromStaffId], copyDates(input), input.locationId);
  return copyEntries(source, input.toStaffIds, input.includeBreaks);
}

/** Г12: что перезапишет копирование — у кого сколько дней поменяется (до записи) */
export async function previewCopy(input: CopyScheduleInput): Promise<PlanPreview> {
  return previewPlan(await copyPlan(input), input.locationId);
}

/**
 * Копирует график (рабочие И нерабочие дни) с одного сотрудника на других (F-02-015). Г12: со слепком «до» —
 * экран даёт «Отменить» 5 с; записи в задетых днях без force — ok=false со списком.
 */
export async function copySchedule(input: CopyScheduleInput): Promise<PlanApplyResult> {
  const entries = await copyPlan(input);
  return applyPlan({
    entries,
    locationId: input.locationId,
    actorName: input.actorName,
    actorStaffId: input.actorStaffId,
    historyAction: 'copy_schedule',
    force: input.force,
  });
}

/** ⭐ «Как на прошлой неделе»: копирует у ТОГО ЖЕ сотрудника часы прошлой недели на текущую (F-00-054, F-02-015) */
export function copyFromLastWeek(
  staffId: Id,
  weekAnchor: ISODate,
  actorName: string,
  actorStaffId?: Id | null,
  locationId?: Id,
  force = false,
): Promise<CellsEditResult & { affected?: AffectedBooking[] }> {
  if (isApiMode())
    return (async () => {
      const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart(weekAnchor), i));
      const before = await S.snapshotCells([staffId], dates);
      await S.copyFromLastWeek(staffId, weekAnchor);
      return { addedDays: 0, changedDays: dates.length, before };
    })();
  return request(() => {
    assertCanEditSchedule([staffId]);
    const thisWeekStart = weekStart(weekAnchor);
    const core = readCore();
    const lastWeek = Array.from({ length: 7 }, (_, i) => addDays(thisWeekStart, i - 7));
    const source = txSnapshotCells(core, [staffId], lastWeek, locationId);
    const entries = copyEntries(
      source.map((c) => ({ ...c, date: addDays(c.date, 7) })),
      [staffId],
      true,
    );
    // Записи в днях, которые станут нерабочими или короче, молча не теряем (schedule.md): без force — ничего не пишем и
    // отдаём список, экран показывает его, как панель графика, и спрашивает «Всё равно применить»
    const result = txApplyPlan({ entries, locationId, actorName, actorStaffId, historyAction: 'copy_schedule', force });
    if (!result.ok) return { addedDays: 0, changedDays: 0, before: [], affected: result.affected };
    return { addedDays: result.added, changedDays: result.changed + result.removed, before: result.before };
  });
}

// ─────────── План графика (Г2, Г10–Г12, Г16) ───────────

export interface PlanPreview extends PlanCounts {
  /** Итог по каждому сотруднику — «у кого что перезапишется» */
  perStaff: Record<Id, PlanCounts>;
}

function previewFrom(before: CellSnapshot[], entries: PlanEntry[]): PlanPreview {
  const perStaff: Record<Id, PlanCounts> = {};
  for (const staffId of new Set(entries.map((e) => e.staffId)))
    perStaff[staffId] = countPlan(
      before.filter((c) => c.staffId === staffId),
      entries.filter((e) => e.staffId === staffId),
    );
  return { ...countPlan(before, entries), perStaff };
}

/** Предпросмотр плана по ВСЕМУ периоду (Г2): тот же расчёт, что вернёт applyPlan в тосте */
export async function previewPlan(entries: PlanEntry[], locationId?: Id): Promise<PlanPreview> {
  if (entries.length === 0) return previewFrom([], []);
  const { staffIds, dates } = planStaffDates(entries);
  const before = await snapshotCells(staffIds, dates, locationId);
  return previewFrom(before, entries);
}

/** Сервер пока не знает «план» — пишем его теми же setCells по группам одинаковых дней */
async function applyPlanViaServer(input: PlanApplyInput): Promise<PlanApplyResult> {
  const { staffIds, dates } = planStaffDates(input.entries);
  const before = await S.snapshotCells(staffIds, dates);
  const byKey = new Map(before.map((c) => [dayKey(c.staffId, c.date), c]));
  const groups = new Map<string, { staffId: Id; typeId: DayTypeId; hours: DayHours; note?: string; dates: ISODate[] }>();
  for (const e of input.entries) {
    const hours = planHours(e, planEffect(byKey.get(dayKey(e.staffId, e.date)), e));
    if (!hours) continue;
    const typeId = planTypeId(e);
    const k = `${e.staffId}|${typeId}|${JSON.stringify(hours)}|${e.note ?? ''}`;
    const g = groups.get(k) ?? { staffId: e.staffId, typeId, hours, note: e.note, dates: [] };
    g.dates.push(e.date);
    groups.set(k, g);
  }
  if (!input.force) {
    const found = (await Promise.all([...groups.values()].map((g) => S.findAffectedBookings([g.staffId], g.dates, g.hours)))).flat();
    const affected = [...new Map(found.map((a) => [a.booking.id, a])).values()];
    if (affected.length > 0) return { ok: false, affected };
  }
  for (const g of groups.values())
    await S.setCells({
      staffIds: [g.staffId],
      dates: g.dates,
      typeId: g.typeId,
      hours: g.hours,
      note: g.note,
      locationId: input.locationId,
      actorName: input.actorName,
    });
  return { ok: true, before, ...countPlan(before, input.entries) };
}

/** Записать план одним запросом: слепок «до» для «Отменить», записи в задетых днях — ok=false со списком */
export function applyPlan(input: PlanApplyInput): Promise<PlanApplyResult> {
  if (isApiMode()) return applyPlanViaServer(input);
  return request(() => txApplyPlan(input));
}

// ─────────── Для журнала: тип и заметка дня мастера (Г3, Г16) ───────────

export interface StaffDayInfo {
  typeId: DayTypeId | null;
  note?: string;
}

/** Тип дня и заметка у сотрудников на дату — журнал подписывает колонку «Отпуск · 7 записей» и заметку над колонкой */
export function getStaffDayInfo(staffIds: Id[], date: ISODate): Promise<Record<Id, StaffDayInfo>> {
  if (isApiMode()) return S.getStaffDayInfo(staffIds, date) as Promise<Record<Id, StaffDayInfo>>;
  return request(() => {
    const core = readCore();
    const days = readArea('schedule').days;
    const out: Record<Id, StaffDayInfo> = {};
    for (const staffId of staffIds) {
      const rec = days[dayKey(staffId, date)];
      const hours = staffDayHours(core, staffId, date);
      const typeId = rec?.typeId ?? (hours.length > 0 ? 'work' : null);
      out[staffId] = { typeId, ...(rec?.note ? { note: rec.note } : {}) };
    }
    return out;
  });
}

// ─────────── Г3: кому можно передать запись с закрываемого дня ───────────

export interface MoveCandidate {
  staffId: Id;
  name: string;
}

/**
 * Для каждой записи — мастера, которые в это время работают (график покрывает запись целиком), свободны и
 * делают эту услугу. Экран предлагает «Перенести к …» до того, как день закроют.
 */
export function getMoveCandidates(bookingIds: Id[]): Promise<Record<Id, MoveCandidate[]>> {
  if (isApiMode()) return S.getMoveCandidates(bookingIds);
  return request(() => {
    const core = readCore();
    const out: Record<Id, MoveCandidate[]> = {};
    for (const id of bookingIds) {
      const b = core.bookings.find((x) => x.id === id);
      if (!b) continue;
      const date = datePart(b.start);
      const from = toMinutesOf(b.start);
      const to = from + b.durationMin;
      const serviceIds = b.services.map((sv) => sv.serviceId);
      out[id] = core.staff
        .filter(
          (s) =>
            s.id !== b.staffId &&
            s.businessId === b.businessId &&
            isScheduleStaff(s) &&
            s.locationIds.includes(b.locationId) &&
            serviceIds.every((sid) => s.serviceIds.includes(sid)),
        )
        .filter((s) => staffDayHours(core, s.id, date, b.locationId).some((h) => toMinutesHM(h.from) <= from && to <= toMinutesHM(h.to)))
        .filter(
          (s) =>
            !core.bookings.some(
              (o) =>
                o.id !== b.id &&
                occupiesTime(o) &&
                datePart(o.start) === date &&
                (o.staffId === s.id || o.services.some((sv) => sv.staffId === s.id)) &&
                toMinutesOf(o.start) < to &&
                from < toMinutesOf(o.start) + o.durationMin,
            ),
        )
        .map((s) => ({ staffId: s.id, name: s.name }));
    }
    return out;
  });
}

function toMinutesHM(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

function toMinutesOf(dt: string): number {
  return toMinutesHM(dt.slice(11, 16));
}

/** Рабочие часы сотрудника на дату (все места работы; с locationId — только в этом филиале) */
export function getDayHours(staffId: Id, date: ISODate, locationId?: Id): Promise<DayHours> {
  if (isApiMode()) return S.getDayHours(staffId, date, locationId);
  return request(() => staffDayHours(readCore(), staffId, date, locationId));
}

/** Даты в диапазоне, где у сотрудника есть рабочие часы */
export function getWorkDays(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<ISODate[]> {
  if (isApiMode()) return S.getWorkDays(staffId, from, to, locationId);
  return request(() => {
    const core = readCore();
    return eachDay(from, to).filter((d) => staffDayHours(core, staffId, d, locationId).length > 0);
  });
}

/** Сумма рабочих минут за период (для будущего расчёта зарплаты — F-02-057 связка с payroll) */
export function getScheduledMinutes(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<Minutes> {
  if (isApiMode()) return S.getScheduledMinutes(staffId, from, to, locationId);
  return request(() => {
    const core = readCore();
    return eachDay(from, to).reduce((sum, d) => sum + minutesOf(staffDayHours(core, staffId, d, locationId)), 0);
  });
}

/** До какой даты у сотрудника продолжается график (F-00-055, F-02-021) */
export function getScheduleEnd(staffId: Id): Promise<ISODate | undefined> {
  if (isApiMode()) return S.getScheduleEnd(staffId);
  return request(() => txScheduleEnd(staffId));
}

export interface FillRateResult {
  /** Рабочие минуты по графику за период */
  scheduledMinutes: Minutes;
  /** Отработанные минуты — записи со статусом «Пришёл» (только уже наступившие визиты) */
  arrivedMinutes: Minutes;
  /** Минуты будущих (ещё не наступивших) записей — считаются отдельно, в % заполненности не входят */
  upcomingMinutes: Minutes;
  /** % заполненности: arrivedMinutes / scheduledMinutes × 100, округлено до 0,1 */
  percent: number;
}

/**
 * F-02-084: заполненность сотрудника за период — отработанные часы («Клиент пришёл») к рабочим часам графика.
 * Пример справки: 48 ч графика и 3,5 ч «Клиент пришёл» → 7,3%. Будущие записи не в счёт (у периода целиком
 * в будущем percent = 0) — они видны отдельно в upcomingMinutes. Читают reports (F-12-016/041/042) и payroll
 * (F-02-096, оплата «за рабочий день»); здесь только сам расчёт — F-02-081 `includeInFillRate` фильтрует,
 * кого учитывать, на стороне вызывающего (getIncludeInFillRate).
 */
// data-f="F-02-084"
export function getFillRate(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<FillRateResult> {
  return request(() => {
    const core = readCore();
    const scheduledMinutes = eachDay(from, to).reduce((sum, d) => sum + minutesOf(staffDayHours(core, staffId, d, locationId)), 0);
    let arrivedMinutes = 0;
    let upcomingMinutes = 0;
    for (const b of core.bookings) {
      if (b.staffId !== staffId) continue;
      if (locationId && b.locationId !== locationId) continue;
      const d = datePart(b.start);
      if (d < from || d > to) continue;
      if (b.status === 'arrived') arrivedMinutes += b.durationMin;
      else if (
        b.status === 'scheduled' ||
        b.status === 'client_confirmed' ||
        b.status === 'awaiting_confirmation' ||
        b.status === 'awaiting_prepayment'
      ) {
        upcomingMinutes += b.durationMin;
      }
    }
    const percent = scheduledMinutes > 0 ? Math.round((arrivedMinutes / scheduledMinutes) * 1000) / 10 : 0;
    return { scheduledMinutes, arrivedMinutes, upcomingMinutes, percent };
  });
}

/** Быстрая установка рабочих часов одного дня (F-02-024 «Добавить сотрудника в расписание» — вызывает journal) */
export function setDayHours(staffId: Id, date: ISODate, hours: DayHours, actorName: string, locationId?: Id): Promise<SetCellsResult> {
  return setCells({
    staffIds: [staffId],
    dates: [date],
    typeId: hours.length > 0 ? 'work' : 'not_working',
    hours,
    locationId,
    actorName,
  });
}

/** «Рабочий день завтра» из меню строки таблицы: часы как в тот же день недели графика, иначе 10:00–19:00. Со слепком. */
export function addWorkDayWithUndo(staffId: Id, date: ISODate, actorName: string): Promise<CellsEditResult & { hours: DayHours }> {
  if (isApiMode()) return S.addWorkDayWithUndo(staffId, date);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    const schedule = staff?.locationIds[0] ? editableSchedule(core, staffId, staff.locationIds[0]) : undefined;
    const fromWeek = schedule?.week[weekdayIndex(date)] ?? [];
    const hours: DayHours = fromWeek.length > 0 ? fromWeek : [DEFAULT_DAY_RANGE];
    const before = txSnapshotCells(core, [staffId], [date]);
    const result = txSetCells({
      staffIds: [staffId],
      dates: [date],
      typeId: 'work',
      hours,
      actorName,
      actorStaffId: currentActor().staffId ?? null,
    });
    return { ...result, before, hours };
  });
}

/**
 * Добавить рабочие дни сотруднику на выбранные даты (F-02-028, F-02-035: «Добавить рабочие дни» из журнала
 * и из приложения на телефоне). Без часов — берёт часы из шаблона недели графика (тот же день недели), если
 * они там заданы, иначе 10:00–19:00. Один запрос.
 */
export function addWorkDays(staffId: Id, dates: ISODate[], actorName: string, hours?: DayHours, locationId?: Id): Promise<SetCellsResult> {
  if (isApiMode()) return S.addWorkDays(staffId, dates, hours, locationId);
  return request(() => {
    const schedule = findSchedule(readCore(), staffId, locationId);
    let total: SetCellsResult = { addedDays: 0, changedDays: 0 };
    for (const date of dates) {
      const fallback = schedule?.week[weekdayIndex(date)];
      const dayHours: DayHours = hours && hours.length > 0 ? hours : fallback && fallback.length > 0 ? fallback : [DEFAULT_DAY_RANGE];
      const r = txSetCells({
        staffIds: [staffId],
        dates: [date],
        typeId: 'work',
        hours: dayHours,
        locationId,
        actorName,
      });
      total = {
        addedDays: total.addedDays + r.addedDays,
        changedDays: total.changedDays + r.changedDays,
      };
    }
    return total;
  });
}

/**
 * Убрать рабочие дни сотрудника на выбранные даты, без проверки записей. Днём становится «Нерабочий день».
 * ⚠️ Журнал зовёт deleteCells() — там есть проверка «есть записи → предупредить».
 */
export function removeWorkDays(staffId: Id, dates: ISODate[], actorName: string, locationId?: Id): Promise<SetCellsResult> {
  return setCells({
    staffIds: [staffId],
    dates,
    typeId: 'not_working',
    hours: [],
    locationId,
    actorName,
  });
}

/** Доля дня, занятая записями (0–1) — «кружок загрузки» дня в журнале (F-02-031, F-02-038) */
export function getDayLoad(staffId: Id, date: ISODate, locationId?: Id): Promise<number> {
  return request(() => {
    const core = readCore();
    const workMinutes = minutesOf(staffDayHours(core, staffId, date, locationId));
    if (workMinutes <= 0) return 0;
    const bookedMinutes = core.bookings
      .filter((b) => b.staffId === staffId && datePart(b.start) === date && occupiesTime(b) && b.status !== 'no_show')
      .reduce((sum, b) => sum + b.durationMin, 0);
    return Math.min(1, bookedMinutes / workMinutes);
  });
}

/** История правок графика и правил слотов (F-02-102) */
export function getHistory(staffIds?: Id[]): Promise<HistoryEntry[]> {
  if (isApiMode()) return S.getHistory(staffIds);
  return request(() => {
    const all = readArea('schedule').history;
    if (!staffIds?.length) return all;
    return all.filter((h) => h.targetStaffIds.some((id) => staffIds.includes(id)));
  });
}

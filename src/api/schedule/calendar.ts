'use client';

/**
 * «Мой календарь» (F-00-051…060): режим, отметки, неделя одним запросом, отпуск, «Закончить раньше», «Задерживаюсь»,
 * быстрая запись.
 */
import { isApiMode } from '@/api/http';
import * as J from '@/api/journal.server';
import * as S from '@/api/schedule/schedule.server';
import * as St from '@/api/staff.server';
import { getClientRow } from '@/api/clients/clients.server';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, coreTx, currentActor } from '@/api/core';
import { busyIntervals, occupiesTime, staffWorkIntervals } from '@/domain/rules';
import type { Booking, CalendarMark, CoreData, DayHours, ISODate, ISODateTime, Id, Staff, TimeRange } from '@/domain/core';
import type { DayTypeId, DelayNotice } from '@/domain/schedule';
import { dayTypeById } from '@/domain/schedule';
import {
  addDays,
  addMinutes,
  combine,
  datePart,
  eachDay,
  fromMinutes,
  nowDateTime,
  today,
  toMinutes,
  weekStart,
  weekdayIndex,
} from '@/lib/date';
import {
  assertCanEditSchedule,
  effectiveHours,
  effectiveTypeId,
  minutesOfDay,
  pushHistory,
  quickBookingInput,
  staffNameOf,
  txAddMark,
  txFindAffected,
  txMarks,
  txOpenDay,
  txRemoveMark,
  txReplaceMarks,
  txSetCells,
  txSnapshotCells,
  txWholeDayRange,
} from '@/api/schedule/shared';
import type { AffectedBooking, CellsApplyResult, CellSnapshot, Interval, MarksEditResult, PlanApplyResult, QuickBookingInput } from '@/api/schedule/shared';
import type { FreeSlot } from '@/api/schedule/slots';
import { applyCells, applyPlan, copyFromLastWeek } from '@/api/schedule/table';
import type { ScheduleCellElsewhere } from '@/api/schedule/table';

export function getCalendarMode(staffId: Id): Promise<Staff['calendarMode'] | undefined> {
  if (isApiMode()) return S.getCalendarMode(staffId);
  return request(() => readCore().staff.find((s) => s.id === staffId)?.calendarMode);
}

/**
 * Режим календаря переключает сам мастер — F-00-051 (наше решение, не как у Altegio, где это
 * может owner/admin/network). actorStaffId — кто нажал; несовпадение со staffId — отказ.
 */
export function setCalendarMode(staffId: Id, mode: Staff['calendarMode'], actorStaffId?: Id | null): Promise<void> {
  if (isApiMode()) return S.setCalendarMode(staffId, mode);
  return request(() => {
    const actor = currentActor();
    const who = actorStaffId === undefined ? actor.staffId : actorStaffId;
    if (who !== staffId || actor.staffId !== staffId) throw new ApiError('forbidden', 'Режим меняет сам мастер');
    coreTx.update('staff', staffId, { calendarMode: mode });
    pushHistory({
      action: 'set_mode',
      targetStaffIds: [staffId],
      dates: [],
      summary: '',
      details: { mode },
      actorName: staffNameOf(staffId),
      actorStaffId: staffId,
    });
  });
}

export function getCalendarMarks(staffId: Id, from: ISODate, to: ISODate): Promise<CalendarMark[]> {
  if (isApiMode()) return S.getCalendarMarks(staffId, from, to);
  return request(() => readCore().calendarMarks.filter((m) => m.staffId === staffId && m.date >= from && m.date <= to));
}

export function addMark(input: Omit<CalendarMark, 'id'>): Promise<CalendarMark> {
  if (isApiMode()) return S.addMark(input);
  return request(() => {
    assertCanEditSchedule([input.staffId]);
    return txAddMark(input);
  });
}

export function removeMark(id: Id): Promise<void> {
  if (isApiMode()) return S.removeMarkWithUndo(id).then(() => undefined);
  return request(() => {
    const mark = readCore().calendarMarks.find((m) => m.id === id);
    if (mark) assertCanEditSchedule([mark.staffId]);
    txRemoveMark(id);
  });
}

/** Слепок отметок за диапазон дат — для «Отменить» 5 с (F-00-061) вокруг быстрых инструментов календаря */
export function snapshotMarksRange(staffId: Id, from: ISODate, to: ISODate): Promise<CalendarMark[]> {
  return getCalendarMarks(staffId, from, to);
}

/** Возвращает диапазон к состоянию слепка: убирает всё текущее, ставит обратно, что было. Один запрос. */
export function restoreMarksRange(staffId: Id, from: ISODate, to: ISODate, marks: CalendarMark[]): Promise<void> {
  if (isApiMode()) return S.restoreMarksRange(staffId, from, to, marks);
  return request(() => {
    assertCanEditSchedule([staffId]);
    txReplaceMarks(staffId, from, to, marks);
  });
}

/** «Открыть весь день» (F-00-054) — рабочие часы дня (или 10:00–19:00), со слепком для «Отменить» */
export function openWholeDay(staffId: Id, date: ISODate): Promise<MarksEditResult> {
  if (isApiMode()) return S.openWholeDay(staffId, date);
  return request(() => {
    assertCanEditSchedule([staffId]);
    const core = readCore();
    const before = txMarks(staffId, date, date);
    const changed = txOpenDay(core, staffId, date) ? 1 : 0;
    return { before, from: date, to: date, changed };
  });
}

/**
 * «Открыть по рабочим часам» — вся неделя разом (speed-k1 №5, k2 №5, k3 №4): каждый рабочий день с сегодняшнего
 * по конец недели открывается по часам графика. Прошедшие дни не трогаем. Один запрос, слепок для «Отменить».
 */
export function openWeek(staffId: Id, from: ISODate, to: ISODate): Promise<MarksEditResult> {
  if (isApiMode()) return S.openWeek(staffId, from, to);
  return request(() => {
    assertCanEditSchedule([staffId]);
    const core = readCore();
    const start = from < today() ? today() : from;
    const before = txMarks(staffId, start, to);
    let changed = 0;
    for (const date of start <= to ? eachDay(start, to) : []) {
      if (!txWholeDayRange(core, staffId, date)) continue;
      if (txOpenDay(core, staffId, date)) changed += 1;
    }
    return { before, from: start, to, changed };
  });
}

/**
 * «Провести пальцем по часам» (F-00-054): отметить отрезок занятым/открытым по текущему режиму. Один запрос.
 * Если такой же отрезок уже отмечен — снимает его (повторный тап по часу — «свободно снова»).
 */
export function markCalendarRange(staffId: Id, date: ISODate, from: string, to: string): Promise<MarksEditResult & { removed: boolean }> {
  if (isApiMode()) return S.markCalendarRange(staffId, date, from, to);
  return request(() => {
    assertCanEditSchedule([staffId]);
    if (toMinutes(to as TimeRange['from']) <= toMinutes(from as TimeRange['from'])) throw new ApiError('invalid_range');
    const staff = readCore().staff.find((s) => s.id === staffId);
    const kind = staff?.calendarMode === 'busy' ? 'free' : 'busy';
    const before = txMarks(staffId, date, date);
    const same = before.find((m) => m.kind === kind && m.from === from && m.to === to);
    if (same) {
      txRemoveMark(same.id);
      return { before, from: date, to: date, changed: 1, removed: true };
    }
    txAddMark({
      staffId,
      date,
      from: from as TimeRange['from'],
      to: to as TimeRange['to'],
      kind,
    });
    return { before, from: date, to: date, changed: 1, removed: false };
  });
}

/** Снять одну отметку со слепком для «Отменить» */
export function removeMarkWithUndo(id: Id): Promise<MarksEditResult> {
  if (isApiMode()) return S.removeMarkWithUndo(id);
  return request(() => {
    const mark = readCore().calendarMarks.find((m) => m.id === id);
    if (!mark) throw new ApiError('not_found');
    assertCanEditSchedule([mark.staffId]);
    const before = txMarks(mark.staffId, mark.date, mark.date);
    txRemoveMark(id);
    return { before, from: mark.date, to: mark.date, changed: 1 };
  });
}

/**
 * «Как на прошлой неделе» для отметок (копирует открытые окна / занятость прошлой недели). Сначала очищает
 * текущую неделю — повторный вызов не удваивает отметки. changed=0 — «нечего было копировать» (F-00-054).
 */
export function copyMarksFromLastWeek(staffId: Id, weekAnchor: ISODate): Promise<MarksEditResult> {
  if (isApiMode()) return S.copyMarksFromLastWeek(staffId, weekAnchor);
  return request(() => {
    assertCanEditSchedule([staffId]);
    const thisWeekStart = weekStart(weekAnchor);
    const thisWeekEnd = addDays(thisWeekStart, 6);
    const lastMarks = txMarks(staffId, addDays(thisWeekStart, -7), addDays(thisWeekStart, -1));
    const before = txMarks(staffId, thisWeekStart, thisWeekEnd);
    if (lastMarks.length === 0) return { before, from: thisWeekStart, to: thisWeekEnd, changed: 0 };
    txReplaceMarks(
      staffId,
      thisWeekStart,
      thisWeekEnd,
      lastMarks.map((m) => ({ ...m, date: addDays(m.date, 7) })),
    );
    return {
      before,
      from: thisWeekStart,
      to: thisWeekEnd,
      changed: lastMarks.length,
    };
  });
}

/**
 * «В отпуске до…» (F-00-054, F-02-010): закрывает окна от завтра до даты включительно. Слепок — для «Отменить».
 * Решение владельца 01.10.2026: записи (и повторяющиеся) САМИ не переносим — без force ответ ok=false со списком
 * задетых записей, экран показывает их с «Перенести к…» / «Отменить с уведомлением» (F-02-106), как панель графика.
 */
export function setVacationUntil(staffId: Id, until: ISODate, actorName: string, force = false): Promise<CellsApplyResult> {
  if (isApiMode())
    return (async () => {
      const tomorrow = addDays(today(), 1);
      if (until < tomorrow) throw new ApiError('invalid_range');
      if (!force) {
        const affected = await S.findAffectedBookings([staffId], eachDay(tomorrow, until));
        if (affected.length > 0) return { ok: false as const, affected };
      }
      return { ok: true as const, ...(await S.setVacationUntil(staffId, until)) };
    })();
  return request(() => {
    const tomorrow = addDays(today(), 1);
    if (until < tomorrow) throw new ApiError('invalid_range');
    const dates = eachDay(tomorrow, until);
    const core = readCore();
    if (!force) {
      const affected = txFindAffected(core, [staffId], dates);
      if (affected.length > 0) return { ok: false as const, affected };
    }
    const before = txSnapshotCells(core, [staffId], dates);
    const result = txSetCells({
      staffIds: [staffId],
      dates,
      typeId: 'vacation',
      hours: [],
      vacationUntil: until,
      actorName,
      actorStaffId: currentActor().staffId ?? null,
    });
    return { ok: true as const, ...result, before };
  });
}

/** Г11: отсутствие — отпуск, больничный, отгул… с «с — по» (можно с сегодня и заранее), с заметкой */
export interface AbsenceInput {
  staffIds: Id[];
  from: ISODate;
  to: ISODate;
  typeId: DayTypeId;
  note?: string;
  locationId?: Id;
  actorName: string;
  force?: boolean;
}

/** Ставит нерабочий тип на весь период (Г11) или «Выходной салона» всем (Г16). Записи в периоде — ok=false со списком. */
export function setAbsence(input: AbsenceInput): Promise<PlanApplyResult> {
  if (input.to < input.from) return Promise.reject(new ApiError('invalid_range'));
  const dates = eachDay(input.from, input.to);
  return applyPlan({
    entries: input.staffIds.flatMap((staffId) =>
      dates.map((date) => ({ staffId, date, hours: null, typeId: input.typeId, ...(input.note !== undefined ? { note: input.note } : {}) })),
    ),
    locationId: input.locationId,
    actorName: input.actorName,
    historyAction: 'set_hours',
    force: input.force,
  });
}

/** Г7: «Как на прошлой неделе» — и часы, и отметки «занято / открыто»; оба слепка для одного «Отменить» */
export interface WeekCopyResult {
  cells: CellSnapshot[];
  marks: MarksEditResult;
  changed: number;
  /** Записи в днях, которые копирование сделало бы нерабочими/короче: ничего не записано — экран спрашивает (force) */
  affected?: AffectedBooking[];
}

export async function copyWeekFromLast(staffId: Id, weekAnchor: ISODate, actorName: string, locationId?: Id, force = false): Promise<WeekCopyResult> {
  const cells = await copyFromLastWeek(staffId, weekAnchor, actorName, currentActorStaffId(), locationId, force);
  if (cells.affected?.length) {
    const from = weekStart(weekAnchor);
    return { cells: [], marks: { before: [], from, to: addDays(from, 6), changed: 0 }, changed: 0, affected: cells.affected };
  }
  const marks = await copyMarksFromLastWeek(staffId, weekAnchor);
  return { cells: cells.before, marks, changed: cells.addedDays + cells.changedDays + marks.changed };
}

function currentActorStaffId(): Id | null {
  return isApiMode() ? null : (currentActor().staffId ?? null);
}

/**
 * Неделя «Моего календаря» одним запросом (arch-a1 №1, state-s1 №1: было 7 запросов подряд): часы каждого дня
 * по всем местам работы, тип дня, отметки, режим, признаки «неделя пустая» для баннера (F-00-055).
 */
export interface CalendarDay {
  date: ISODate;
  /** Часы, которые правит мастер (салон / основное место) */
  hours: DayHours;
  typeId: DayTypeId | null;
  /** Часы в другом месте работы (дома / выезд) */
  elsewhere?: ScheduleCellElsewhere[];
  marks: CalendarMark[];
  /** Записей в этот день */
  bookings: number;
  /** Г16: заметка к дню */
  note?: string;
}

export interface CalendarWeek {
  mode: Staff['calendarMode'] | undefined;
  days: CalendarDay[];
  /** Режим «всё занято» и ни одного открытого часа с сегодняшнего дня до конца недели (при рабочих днях) */
  nothingOpen: boolean;
}

export function getCalendarWeek(staffId: Id, from: ISODate, to: ISODate, locationId?: Id): Promise<CalendarWeek> {
  if (isApiMode()) return S.getCalendarWeek(staffId, from, to);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    const all = core.schedules.filter((s) => s.staffId === staffId);
    // Г6: день правится в выбранном филиале — в нём и читаем основной график
    const here = locationId ? all.filter((s) => s.locationId === locationId) : [];
    const own = here.length > 0 ? [...here, ...all.filter((s) => !here.includes(s))] : all;
    const days = readArea('schedule').days;
    const main = own.find((s) => s.workplace === 'salon') ?? own[0];
    const others = own.filter((s) => s !== main);
    const marks = txMarks(staffId, from, to);
    const week: CalendarDay[] = eachDay(from, to).map((date) => {
      const hours = main ? effectiveHours(main, date) : [];
      const note = days[`${staffId}|${date}`]?.note;
      const elsewhere = others
        .map((s) => ({
          workplace: s.workplace,
          hours: effectiveHours(s, date),
        }))
        .filter((x) => x.hours.length > 0);
      return {
        date,
        hours,
        typeId: effectiveTypeId(staffId, date, hours),
        ...(elsewhere.length ? { elsewhere } : {}),
        ...(note ? { note } : {}),
        marks: marks.filter((m) => m.date === date).sort((a, b) => a.from.localeCompare(b.from)),
        bookings: core.bookings.filter(
          (b) => occupiesTime(b) && datePart(b.start) === date && (b.staffId === staffId || b.services.some((l) => l.staffId === staffId)),
        ).length,
      };
    });
    const now = today();
    const upcoming = week.filter((d) => d.date >= now && (d.hours.length > 0 || (d.elsewhere?.length ?? 0) > 0));
    const nothingOpen =
      staff?.calendarMode === 'busy' && upcoming.length > 0 && upcoming.every((d) => !d.marks.some((m) => m.kind === 'free'));
    return { mode: staff?.calendarMode, days: week, nothingOpen };
  });
}

/**
 * Правка одного дня из «Моего календаря» (Sheet «Сохранить»): тип дня и часы. Нерабочий тип при записях на дату —
 * ApiError('schedule_has_bookings') без force. Возвращает слепок «до» для «Отменить».
 */
export function saveCalendarDay(input: {
  staffId: Id;
  date: ISODate;
  typeId: DayTypeId;
  hours: DayHours;
  actorName: string;
  force?: boolean;
  /** Г16: заметка; undefined — не трогать */
  note?: string;
  /** Г6: филиал дня */
  locationId?: Id;
}): Promise<CellsApplyResult> {
  const working = dayTypeById(input.typeId).working;
  // Г1: рабочий день без часов — ошибка, а не молчаливый выходной (экран не даёт сохранить неверные часы)
  if (working && input.hours.length === 0) return Promise.reject(new ApiError('invalid_hours'));
  return applyCells({
    staffIds: [input.staffId],
    dates: [input.date],
    typeId: input.typeId,
    hours: working ? input.hours : [],
    note: input.note,
    locationId: input.locationId,
    actorName: input.actorName,
    force: input.force,
  });
}

/**
 * Мастер в «всё занято» без единого открытого часа на следующие 7 дней (F-00-055) — напоминание в воскресенье.
 * (Для текущей недели экран берёт CalendarWeek.nothingOpen — баннер с «Открыть по рабочим часам».)
 */
export function hasEmptyNextWeek(staffId: Id, from: ISODate): Promise<boolean> {
  if (isApiMode()) return S.hasEmptyNextWeek(staffId, from);
  return request(() => {
    if (weekdayIndex(from) !== 6) return false;
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    if (staff?.calendarMode !== 'busy') return false;
    const to = addDays(from, 6);
    return !core.calendarMarks.some((m) => m.staffId === staffId && m.kind === 'free' && m.date >= from && m.date <= to);
  });
}

/**
 * Укорачивает ИДУЩУЮ запись до фактически отработанного времени — остаток сразу становится свободным окном.
 * Запись, которая ещё не началась или уже закончилась, — ApiError('not_ongoing') (recheck-c2 block: у будущей записи
 * длительность становилась 5 мин и её время открывалось клиентам). Возвращает новое время конца.
 */
export function finishEarly(bookingId: Id, actualDurationMin?: number): Promise<Booking> {
  // Режим api (этап 7): «только идущая запись» и остаток-окно (В-18) — на сервере
  if (isApiMode()) return J.finishEarly(bookingId, actualDurationMin);
  return request(() => {
    const b = readCore().bookings.find((x) => x.id === bookingId);
    if (!b || !occupiesTime(b)) throw new ApiError('not_found');
    assertCan('journal.edit', { targetStaffId: b.staffId });
    const now = nowDateTime();
    const end = addMinutes(b.start, b.durationMin);
    if (!(b.start <= now && now < end)) throw new ApiError('not_ongoing');
    const elapsed = Math.max(5, Math.round((minutesOfDay(now) - minutesOfDay(b.start)) / 5) * 5);
    const next = Math.min(b.durationMin, Math.max(5, actualDurationMin ?? elapsed, elapsed));
    return coreTx.updateBooking(bookingId, { durationMin: next });
  });
}

function txNextBooking(core: CoreData, b: Booking): Booking | undefined {
  const date = datePart(b.start);
  return core.bookings
    .filter((x) => occupiesTime(x) && x.id !== b.id && x.staffId === b.staffId && datePart(x.start) === date && x.start > b.start)
    .sort((a, c) => a.start.localeCompare(c.start))[0];
}

/** Ближайшая после этой запись того же мастера в тот же день — «следующий клиент», кому уйдёт уведомление */
export function getNextBookingForDelay(bookingId: Id): Promise<Booking | undefined> {
  return request(() => {
    const core = readCore();
    const b = core.bookings.find((x) => x.id === bookingId);
    return b ? txNextBooking(core, b) : undefined;
  });
}

export function getDelayNotice(bookingId: Id): Promise<DelayNotice | undefined> {
  return request(() => readArea('schedule').delayNotices[bookingId]);
}

/** Сегодняшняя запись мастера для «Сегодня: записи» в календаре — только нужные поля (DTO) */
export interface MasterTodayBooking {
  id: Id;
  start: ISODateTime;
  end: ISODateTime;
  clientName?: string;
  /** Идёт прямо сейчас — можно «Закончить раньше» (F-00-058) */
  ongoing: boolean;
  /** Уже отмечено «Задерживаюсь на N мин» (F-00-059) */
  delayMin?: number;
}

/** Записи мастера на сегодня (не отменённые) одним запросом — без чтения всей базы клиентов в экране */
export function getMasterToday(staffId: Id): Promise<MasterTodayBooking[]> {
  if (isApiMode()) return apiGetMasterToday(staffId);
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    const date = datePart(now);
    const notices = readArea('schedule').delayNotices;
    return core.bookings
      .filter((b) => b.staffId === staffId && datePart(b.start) === date && occupiesTime(b) && b.status !== 'no_show')
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => {
        const end = addMinutes(b.start, b.durationMin);
        return {
          id: b.id,
          start: b.start,
          end,
          clientName: b.clientId ? core.clients.find((c) => c.id === b.clientId)?.name : b.visitorName,
          ongoing: b.start <= now && now < end,
          delayMin: notices[b.id]?.minutes,
        };
      });
  });
}

async function apiGetMasterToday(staffId: Id): Promise<MasterTodayBooking[]> {
  const businessId = St.bizOf(staffId);
  const date = today();
  const now = nowDateTime();
  const [bookings, notices] = await Promise.all([J.listBookings({ businessId, staffId, from: date, to: date }), Promise.resolve(readArea('schedule').delayNotices)]);
  const active = bookings.filter((b) => occupiesTime(b) && b.status !== 'no_show').sort((a, b) => a.start.localeCompare(b.start));
  const clientIds = [...new Set(active.map((b) => b.clientId).filter((id): id is Id => Boolean(id)))];
  const names = new Map(
    (await Promise.all(clientIds.map(async (id) => [id, (await getClientRow(businessId, id)).name] as const))).map(([id, name]) => [id, name]),
  );
  return active.map((b) => {
    const end = addMinutes(b.start, b.durationMin);
    return {
      id: b.id,
      start: b.start,
      end,
      clientName: b.clientId ? names.get(b.clientId) : b.visitorName,
      ongoing: b.start <= now && now < end,
      delayMin: notices[b.id]?.minutes,
    };
  });
}

/** Что произошло после «Задерживаюсь»: клиент получил уведомление в приложении / у клиента приложения нет — позвонить */
export interface DelayResult {
  notice: DelayNotice;
  /** Уведомление ушло следующему клиенту (у него есть приложение) */
  notified: boolean;
  /** Номер следующего клиента, если уведомить не получилось — «позвоните» */
  callPhone?: string;
}

/**
 * Мастер отмечает задержку (F-00-059). Событие 'delayed' пишет ЯДРО (coreTx.reportDelay) на следующую запись —
 * клиент видит его в своих уведомлениях (core-k3 №1, e2e-q2 №1, recheck-c2). Один запрос.
 */
export function sendDelayNotice(bookingId: Id, minutes: number): Promise<DelayResult> {
  if (isApiMode()) return apiSendDelayNotice(bookingId, minutes);
  return request(() => {
    const core = readCore();
    const b = core.bookings.find((x) => x.id === bookingId);
    if (!b) throw new ApiError('not_found');
    const next = txNextBooking(core, b);
    let notified = false;
    let callPhone: string | undefined;
    if (next) {
      coreTx.reportDelay(next.id, minutes);
      notified = Boolean(next.appUserId);
      if (!notified && next.clientId) callPhone = core.clients.find((c) => c.id === next.clientId)?.phone;
    }
    const notice: DelayNotice = {
      bookingId,
      minutes,
      nextBookingId: next?.id,
      sentAt: nowDateTime(),
    };
    mutateArea('schedule', (draft) => {
      draft.delayNotices[bookingId] = notice;
    });
    return { notice, notified, callPhone };
  });
}

/** Запись в несколько нажатий (F-00-060), тот же поток вызывает виджет «+ запись» (F-00-062) и разбор фразы (F-00-063) */
export function createQuickBooking(input: QuickBookingInput) {
  if (isApiMode()) return J.placeBooking(quickBookingInput(input));
  return request(() => coreTx.placeBooking(quickBookingInput(input)));
}

/**
 * «Задерживаюсь» в режиме api: событие delayed следующей записи пишет сервер (клиент видит его в своей ленте);
 * отметка «уже отмечено» для экрана «Сегодня» — в срезе schedule браузера, как и было.
 */
async function apiSendDelayNotice(bookingId: Id, minutes: number): Promise<DelayResult> {
  const found = await request(() => {
    const core = readCore();
    const b = core.bookings.find((x) => x.id === bookingId);
    if (!b) throw new ApiError('not_found');
    const next = txNextBooking(core, b);
    const callPhone = next && !next.appUserId && next.clientId ? core.clients.find((c) => c.id === next.clientId)?.phone : undefined;
    return { nextId: next?.id, notified: Boolean(next?.appUserId), callPhone };
  });
  if (found.nextId) await J.reportDelay(found.nextId, minutes);
  const notice: DelayNotice = { bookingId, minutes, nextBookingId: found.nextId, sentAt: nowDateTime() };
  await request(() =>
    mutateArea('schedule', (draft) => {
      draft.delayNotices[bookingId] = notice;
    }),
  );
  return { notice, notified: found.notified, callPhone: found.callPhone };
}

/** Что нужно окну быстрой записи (F-00-060): недавние клиенты мастера и их последняя услуга — одним запросом */
export interface QuickBookingContext {
  recentClients: { id: Id; name: string }[];
  lastServiceByClient: Record<Id, Id>;
}

export function getQuickBookingContext(businessId: Id, staffId: Id): Promise<QuickBookingContext> {
  if (isApiMode()) return apiGetQuickBookingContext(businessId, staffId);
  return request(() => {
    const core = readCore();
    const own = core.bookings
      .filter((b) => b.businessId === businessId && b.staffId === staffId && !b.deletedAt && b.clientId)
      .sort((a, b) => b.start.localeCompare(a.start));
    const recent: { id: Id; name: string }[] = [];
    const lastServiceByClient: Record<Id, Id> = {};
    for (const b of own) {
      const clientId = b.clientId as Id;
      if (!lastServiceByClient[clientId] && b.services[0]) lastServiceByClient[clientId] = b.services[0].serviceId;
      if (recent.length < 5 && !recent.some((r) => r.id === clientId)) {
        const c = core.clients.find((x) => x.id === clientId && !x.deletedAt);
        if (c) recent.push({ id: c.id, name: c.name });
      }
    }
    return { recentClients: recent, lastServiceByClient };
  });
}

/** Записи мастера этого бизнеса (без удалённых) от новых к старым — «недавние клиенты» одним запросом к серверу */
async function apiGetQuickBookingContext(businessId: Id, staffId: Id): Promise<QuickBookingContext> {
  const own = (await J.listBookings({ businessId, staffId })).filter((b) => !b.deletedAt && b.clientId).sort((a, b) => b.start.localeCompare(a.start));
  const recentIds: Id[] = [];
  const lastServiceByClient: Record<Id, Id> = {};
  for (const b of own) {
    const clientId = b.clientId as Id;
    if (!lastServiceByClient[clientId] && b.services[0]) lastServiceByClient[clientId] = b.services[0].serviceId;
    if (recentIds.length < 5 && !recentIds.includes(clientId)) recentIds.push(clientId);
  }
  const recent = (
    await Promise.all(
      recentIds.map(async (id) => {
        try {
          const c = await getClientRow(businessId, id);
          return { id: c.id, name: c.name };
        } catch {
          return null;
        }
      }),
    )
  ).filter((x): x is { id: Id; name: string } => x !== null);
  return { recentClients: recent, lastServiceByClient };
}

/**
 * Окна быстрой записи на день (Q-1: время — рядом свободных окон, а не TimePicker, который попадёт на занятое):
 * окна мастера под услугу, начиная с «сейчас» для сегодняшнего дня.
 */
export function getQuickBookingSlots(q: { staffId: Id; date: ISODate; serviceId?: Id; locationId?: Id }): Promise<FreeSlot[]> {
  if (isApiMode()) return S.getQuickBookingSlots(q);
  return request(() => {
    const core = readCore();
    const service = q.serviceId ? core.services.find((s) => s.id === q.serviceId) : undefined;
    const durationMin = service ? (service.durationMax ?? service.durationMin) : 30;
    const now = nowDateTime();
    const staff = core.staff.find((s) => s.id === q.staffId);
    if (!staff) return [];
    // Мастер записывает сам — правила онлайн-записи (сетка, выключенные окна) не нужны: база ядра, шаг 15 мин
    const work = staffWorkIntervals(core, q.staffId, q.date, {
      locationId: q.locationId,
    });
    const busy = busyIntervals(core, q.staffId, q.date, { now }).map((b) => [b.from, b.to] as Interval);
    const minStart = q.date === datePart(now) ? Math.ceil(minutesOfDay(now) / 15) * 15 : 0;
    const need = durationMin + (service?.bufferAfterMin ?? 0);
    const out: FreeSlot[] = [];
    for (const w of work) {
      for (let t = Math.max(w.from, minStart); t + need <= w.to; t += 15) {
        if (busy.some(([a, b]) => t < b && t + need > a)) continue;
        out.push({
          staffId: q.staffId,
          locationId: w.locationId,
          workplace: w.workplace,
          start: combine(q.date, fromMinutes(t)),
          end: combine(q.date, fromMinutes(t + durationMin)),
        });
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  });
}

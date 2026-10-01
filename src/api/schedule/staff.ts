'use client';

/**
 * Настройки сотрудника и бизнеса (F-02-020…030, F-02-081…090, F-02-105): доступ к истории, журнал, Google, «Убрать из графика».
 */
import { isApiMode } from '@/api/http';
import * as S from '@/api/schedule/schedule.server';
import { request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, coreTx } from '@/api/core';
import type { ISODate, Id } from '@/domain/core';
import type { PlanningPeriodYears } from '@/domain/schedule';
import { DEFAULT_PLANNING_PERIOD_YEARS } from '@/domain/schedule';
import { addDays, eachDay, parse, today, toISODate } from '@/lib/date';
import { assertCanEditSchedule, txFindAffected, txRestoreCells, txScheduleEnd, txSetCells, txSnapshotCells } from '@/api/schedule/shared';
import type { CellSnapshot } from '@/api/schedule/shared';

/** undefined — не ограничено */
export function getHistoryLimitDays(staffId: Id): Promise<number | undefined> {
  if (isApiMode()) return S.staffSettings(staffId).then((s) => s.historyLimitDays[staffId]);
  return request(() => readArea('schedule').historyLimitDays[staffId]);
}

export function setHistoryLimitDays(staffId: Id, days: number | undefined): Promise<void> {
  if (isApiMode()) return S.patchStaffSettings(staffId, { historyLimitDays: { [staffId]: days ?? null } });
  return request(() => {
    mutateArea('schedule', (draft) => {
      if (days === undefined) delete draft.historyLimitDays[staffId];
      else draft.historyLimitDays[staffId] = days;
    });
  });
}

/** F-02-082/F-01-019: не показывать колонку сотрудника в журнале (поле лежит в ядре, здесь — только запись) */
export function setHiddenInJournal(staffId: Id, hidden: boolean): Promise<void> {
  if (isApiMode()) return S.setJournalView(staffId, { hiddenInJournal: hidden });
  return request(() => {
    assertCan('staff.manage');
    coreTx.update('staff', staffId, { hiddenInJournal: hidden || undefined });
  });
}

/** F-02-083/F-01-021: шаг разметки сетки в колонке сотрудника, «Не выбрано» — undefined */
export function setJournalMarkupMin(staffId: Id, minutes: 15 | 30 | 60 | 90 | 120 | undefined): Promise<void> {
  if (isApiMode()) return S.setJournalView(staffId, { journalMarkupMin: minutes ?? null });
  return request(() => {
    assertCan('staff.manage');
    coreTx.update('staff', staffId, { journalMarkupMin: minutes });
  });
}

/** F-02-081: учитывать ли сотрудника в заполненности — нет ключа значит включено */
export function getIncludeInFillRate(staffId: Id): Promise<boolean> {
  if (isApiMode()) return S.staffSettings(staffId).then((s) => s.includeInFillRate[staffId] ?? true);
  return request(() => readArea('schedule').includeInFillRate[staffId] ?? true);
}

export function setIncludeInFillRate(staffId: Id, value: boolean): Promise<void> {
  if (isApiMode()) return S.patchStaffSettings(staffId, { includeInFillRate: { [staffId]: value } });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.includeInFillRate[staffId] = value;
    });
  });
}

export interface GoogleCalendarLink {
  connected: boolean;
  shareClientNames: boolean;
}

export function getGoogleCalendarLink(staffId: Id): Promise<GoogleCalendarLink> {
  if (isApiMode()) return S.staffSettings(staffId).then((s) => s.googleCalendar[staffId] ?? { connected: false, shareClientNames: false });
  return request(
    () =>
      readArea('schedule').googleCalendar[staffId] ?? {
        connected: false,
        shareClientNames: false,
      },
  );
}

/** Демо: нет настоящего входа через Google — «подключаем» сразу, как договорено в assumed отчёта */
export function connectGoogleCalendar(staffId: Id): Promise<void> {
  if (isApiMode()) return S.patchStaffSettings(staffId, { googleCalendar: { [staffId]: { connected: true, shareClientNames: false } } });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.googleCalendar[staffId] = {
        connected: true,
        shareClientNames: false,
      };
    });
  });
}

export function disconnectGoogleCalendar(staffId: Id): Promise<void> {
  if (isApiMode()) return S.patchStaffSettings(staffId, { googleCalendar: { [staffId]: null } });
  return request(() => {
    mutateArea('schedule', (draft) => {
      delete draft.googleCalendar[staffId];
    });
  });
}

export function setGoogleCalendarShareClientNames(staffId: Id, value: boolean): Promise<void> {
  if (isApiMode()) return S.staffSettings(staffId).then((s) => S.patchStaffSettings(staffId, { googleCalendar: { [staffId]: { ...(s.googleCalendar[staffId] ?? { connected: true, shareClientNames: false }), shareClientNames: value } } }));
  return request(() => {
    mutateArea('schedule', (draft) => {
      const link = draft.googleCalendar[staffId] ?? {
        connected: true,
        shareClientNames: false,
      };
      draft.googleCalendar[staffId] = { ...link, shareClientNames: value };
    });
  });
}

/** Дата за пределами разрешённой истории — ScheduleScreen/HistoryScreen отсекают ей навигацию назад */
export function isDateBeyondHistoryLimit(date: ISODate, limitDays: number | undefined, todayIso: ISODate = today()): boolean {
  if (limitDays === undefined) return false;
  return date < addDays(todayIso, -limitDays);
}

export function getPlanningPeriodYears(businessId: Id): Promise<PlanningPeriodYears> {
  if (isApiMode()) return S.getSettings(businessId).then((s) => s.planningPeriodYears);
  return request(() => readArea('schedule').planningPeriodYears[businessId] ?? DEFAULT_PLANNING_PERIOD_YEARS);
}

export function setPlanningPeriodYears(businessId: Id, years: PlanningPeriodYears): Promise<void> {
  if (isApiMode()) return S.patchSettings(businessId, { planningPeriodYears: years });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.planningPeriodYears[businessId] = years;
    });
  });
}

export function getNotifyMasterOnScheduleChange(businessId: Id): Promise<boolean> {
  if (isApiMode()) return S.getSettings(businessId).then((s) => s.notifyMasterOnScheduleChange);
  return request(() => readArea('schedule').notifyMasterOnScheduleChange[businessId] ?? false);
}

export function setNotifyMasterOnScheduleChange(businessId: Id, value: boolean): Promise<void> {
  if (isApiMode()) return S.patchSettings(businessId, { notifyMasterOnScheduleChange: value });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.notifyMasterOnScheduleChange[businessId] = value;
    });
  });
}

/** Последняя дата, на которую вообще можно смотреть/ставить график при этом горизонте (F-02-030) */
export function planningHorizonEnd(years: PlanningPeriodYears, from: ISODate = today()): ISODate {
  return toISODate(parse(from).add(Math.round(years * 12), 'month'));
}

export interface RemoveFromScheduleResult {
  /** Найдены будущие записи — ничего не удалено, показываем предупреждение (передайте force, чтобы удалить всё равно) */
  affectedBookings: number;
  removedDays: number;
}

function txRemoveRange(staffId: Id): ISODate[] {
  const end = txScheduleEnd(staffId);
  const to = end && end > today() ? end : toISODate(parse(today()).add(2, 'year'));
  return eachDay(today(), to);
}

/** Только смотрит, есть ли будущие записи — ничего не меняет (для текста диалога подтверждения) */
export function previewRemoveFromSchedule(staffId: Id): Promise<number> {
  if (isApiMode()) return S.previewRemoveFromSchedule(staffId);
  return request(() => txFindAffected(readCore(), [staffId], txRemoveRange(staffId)).length);
}

/** Слепок для «Отменить» после removeStaffFromSchedule — ячейки (snapshotCells) + дата конца графика */
export interface RemoveFromScheduleSnapshot {
  cells: CellSnapshot[];
  openUntil: ISODate | undefined;
}

/** Слепок ДО снятия с графика — по решению В-861/F-00-061 «без будущих записей — "Отменить" на 5 секунд» */
export function snapshotBeforeRemoveFromSchedule(staffId: Id): Promise<RemoveFromScheduleSnapshot> {
  return request(() => ({
    cells: txSnapshotCells(readCore(), [staffId], txRemoveRange(staffId)),
    openUntil: txScheduleEnd(staffId),
  }));
}

export function removeStaffFromSchedule(staffId: Id, actorName: string, actorStaffId: Id | null): Promise<RemoveFromScheduleResult> {
  if (isApiMode()) return S.removeFromScheduleWithUndo(staffId, true).then((r) => ({ affectedBookings: 0, removedDays: r.ok ? r.snapshot.cells.length : 0 }));
  return request(() => {
    const result = txSetCells({
      staffIds: [staffId],
      dates: txRemoveRange(staffId),
      typeId: 'not_working',
      hours: [],
      actorName,
      actorStaffId,
    });
    // Дни закрыты, и дата конца графика тоже снимается — карточка сотрудника не покажет старый openUntil (F-02-020)
    for (const schedule of readCore().schedules.filter((s) => s.staffId === staffId)) {
      coreTx.update('schedules', schedule.id, { openUntil: undefined });
    }
    return {
      affectedBookings: 0,
      removedDays: result.changedDays + result.addedDays,
    };
  });
}

/** Возвращает график к слепку из snapshotBeforeRemoveFromSchedule (реализация «Отменить», F-02-020) */
export function restoreAfterRemoveFromSchedule(staffId: Id, snapshot: RemoveFromScheduleSnapshot): Promise<void> {
  if (isApiMode()) return S.restoreAfterRemoveFromSchedule(staffId, snapshot);
  return request(() => {
    assertCanEditSchedule([staffId]);
    txRestoreCells(snapshot.cells);
    for (const schedule of readCore().schedules.filter((s) => s.staffId === staffId)) {
      coreTx.update('schedules', schedule.id, {
        openUntil: snapshot.openUntil,
      });
    }
  });
}

/**
 * «Убрать из графика» одним запросом (F-02-020): есть будущие записи и нет force — ничего не меняем, отвечаем их числом
 * (экран спросит подтверждение); иначе снимаем и возвращаем слепок для «Отменить» (F-00-061).
 */
export type RemoveFromScheduleOutcome = { ok: false; affected: number } | { ok: true; snapshot: RemoveFromScheduleSnapshot };

export function removeFromScheduleWithUndo(staffId: Id, actorName: string, force = false): Promise<RemoveFromScheduleOutcome> {
  if (isApiMode()) return S.removeFromScheduleWithUndo(staffId, force);
  return request(() => {
    const dates = txRemoveRange(staffId);
    if (!force) {
      const affected = txFindAffected(readCore(), [staffId], dates).length;
      if (affected > 0) return { ok: false as const, affected };
    }
    const snapshot: RemoveFromScheduleSnapshot = {
      cells: txSnapshotCells(readCore(), [staffId], dates),
      openUntil: txScheduleEnd(staffId),
    };
    txSetCells({
      staffIds: [staffId],
      dates,
      typeId: 'not_working',
      hours: [],
      actorName,
    });
    for (const schedule of readCore().schedules.filter((s) => s.staffId === staffId)) {
      coreTx.update('schedules', schedule.id, { openUntil: undefined });
    }
    return { ok: true as const, snapshot };
  });
}

/**
 * Помощники сетки таблицы «Сотрудники × дни» (F-02-002): список дат недели/месяца, подписи.
 */
import type { ISODate } from '@/domain/core';
import { dayjs, eachDay, toISODate, weekStart } from '@/lib/date';

export type ScheduleView = 'week' | 'month';

/** Диапазон дат видимого окна таблицы от якоря */
export function rangeFor(view: ScheduleView, anchor: ISODate): { from: ISODate; to: ISODate } {
  if (view === 'week') {
    const from = weekStart(anchor);
    return { from, to: toISODate(dayjs(from).add(6, 'day')) };
  }
  const from = toISODate(dayjs(anchor).startOf('month'));
  const to = toISODate(dayjs(anchor).endOf('month'));
  return { from, to };
}

export function shift(view: ScheduleView, anchor: ISODate, dir: 1 | -1): ISODate {
  return toISODate(dayjs(anchor).add(dir, view === 'week' ? 'week' : 'month'));
}

export function datesOf(view: ScheduleView, anchor: ISODate): ISODate[] {
  const { from, to } = rangeFor(view, anchor);
  return eachDay(from, to);
}

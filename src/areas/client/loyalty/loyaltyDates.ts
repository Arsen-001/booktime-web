import type { ISODate } from '@/domain/core';
import { dayjs, today } from '@/lib/date';

/** Сколько полных дней осталось до даты (F-14-038: порог «скоро истекает») */
export function daysUntil(date: ISODate): number {
  return dayjs(date).diff(dayjs(today()), 'day');
}

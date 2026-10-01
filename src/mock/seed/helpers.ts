import type { DayHours, ISODate, ISODateTime, LocalizedText, TimeRange, WeekTemplate } from '@/domain/core';
import { dayjs, toISODate, toISODateTime } from '@/lib/date';

/** Текст на трёх языках */
export function lt(ru: string, hy: string, en: string): LocalizedText {
  return { ru, hy, en };
}

export function h(from: string, to: string): TimeRange {
  return { from, to };
}

/** Шаблон недели: 0 = пн … 6 = вс; не указанные дни — выходные */
export function week(days: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>>): WeekTemplate {
  return {
    0: days[0] ?? [],
    1: days[1] ?? [],
    2: days[2] ?? [],
    3: days[3] ?? [],
    4: days[4] ?? [],
    5: days[5] ?? [],
    6: days[6] ?? [],
  };
}

/** Одинаковые часы в указанные дни */
export function sameDays(days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], hours: DayHours): WeekTemplate {
  const out: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>> = {};
  days.forEach((d) => (out[d] = hours.map((r) => ({ ...r }))));
  return week(out);
}

/** Контекст времени сида: всё считается от момента now */
export interface SeedClock {
  now: Date;
  today: ISODate;
  /** Минуты от полуночи «сейчас» */
  nowMin: number;
  /** Дата со сдвигом в днях от сегодня */
  day: (offset: number) => ISODate;
  /** Дата-время: offset дней от сегодня + 'HH:mm' */
  at: (offset: number, time: string) => ISODateTime;
  /** Момент на N минут раньше/позже now */
  minutesFromNow: (minutes: number) => ISODateTime;
}

export function makeClock(now: Date): SeedClock {
  const base = dayjs(now).startOf('day');
  return {
    now,
    today: toISODate(base),
    nowMin: now.getHours() * 60 + now.getMinutes(),
    day: (offset) => toISODate(base.add(offset, 'day')),
    at: (offset, time) => `${toISODate(base.add(offset, 'day'))}T${time}`,
    minutesFromNow: (minutes) => toISODateTime(dayjs(now).add(minutes, 'minute')),
  };
}

export function yandexLink(address: string): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`Ереван, ${address}`)}`;
}

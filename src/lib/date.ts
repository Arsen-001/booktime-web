/**
 * Даты и время. dayjs с локалями ru / hy-am / en, неделя с понедельника, 24 часа.
 * В данных: дата 'YYYY-MM-DD', дата-время 'YYYY-MM-DDTHH:mm' (местное время Еревана, без пояса).
 * Для показа пользователю — useFormat() (src/i18n/useFormat.ts), не форматируйте вручную.
 *
 * 🔴 «Сейчас» и «сегодня» — только nowDateTime() / today() / nowYerevan(): они считают по поясу Asia/Yerevan,
 * а не по поясу браузера (турист в другом поясе, сервер в UTC). `toISOString()` и `new Date('YYYY-MM-DD')`
 * для дат НЕЛЬЗЯ: они переводят в UTC и сдвигают день на 4 часа (сторож A9). Сдвиг дат — addDays().
 */
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/hy-am';
import 'dayjs/locale/en';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import timezone from 'dayjs/plugin/timezone';
import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';
import type { ISODate, ISODateTime, Minutes, TimeHM } from '@/domain/core';
import type { Locale } from '@/i18n/config';

dayjs.extend(customParseFormat);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(updateLocale);
dayjs.extend(utc);
dayjs.extend(timezone);
// Неделя с понедельника во всех языках
dayjs.updateLocale('en', { weekStart: 1 });

export { dayjs, type Dayjs };

export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
export const TIME_FORMAT = 'HH:mm';

export const DAYJS_LOCALE: Record<Locale, string> = { ru: 'ru', hy: 'hy-am', en: 'en' };

export function toISODate(d: Dayjs | Date): ISODate {
  return dayjs(d).format(DATE_FORMAT);
}

export function toISODateTime(d: Dayjs | Date): ISODateTime {
  return dayjs(d).format(DATE_TIME_FORMAT);
}

/** 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:mm' → Dayjs */
export function parse(value: ISODate | ISODateTime): Dayjs {
  return dayjs(value, value.length > 10 ? DATE_TIME_FORMAT : DATE_FORMAT);
}

/** Пояс платформы: все даты в данных — местное время Еревана */
export const YEREVAN_TZ = 'Asia/Yerevan';

/**
 * «Сейчас» по Еревану как Dayjs — для арифметики (`nowYerevan().add(1, 'day')`) вместо `dayjs()`.
 * Если в среде нет данных о поясах (редкий старый браузер) — время устройства.
 */
export function nowYerevan(): Dayjs {
  try {
    const wall = dayjs().tz(YEREVAN_TZ).format('YYYY-MM-DDTHH:mm:ss');
    return dayjs(wall, 'YYYY-MM-DDTHH:mm:ss');
  } catch {
    return dayjs();
  }
}

/** Сейчас по Еревану, 'YYYY-MM-DDTHH:mm' */
export function nowDateTime(): ISODateTime {
  return toISODateTime(nowYerevan());
}

/** Сегодня по Еревану, 'YYYY-MM-DD' */
export function today(): ISODate {
  return toISODate(nowYerevan());
}

/** Сдвиг даты на n дней (n < 0 — назад): addDays('2026-09-30', 1) → '2026-10-01' */
export function addDays(date: ISODate, n: number): ISODate {
  return toISODate(parse(date).add(n, 'day'));
}

/** Разница в минутах b − a (для «сколько осталось до начала») */
export function diffMinutes(a: ISODateTime, b: ISODateTime): Minutes {
  return parse(b).diff(parse(a), 'minute');
}

export function datePart(dt: ISODateTime): ISODate {
  return dt.slice(0, 10);
}

export function timePart(dt: ISODateTime): TimeHM {
  return dt.slice(11, 16);
}

export function combine(date: ISODate, time: TimeHM): ISODateTime {
  return `${date}T${time}`;
}

/** 'HH:mm' → минуты от полуночи */
export function toMinutes(time: TimeHM): Minutes {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** минуты от полуночи → 'HH:mm' */
export function fromMinutes(total: Minutes): TimeHM {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(dt: ISODateTime, minutes: Minutes): ISODateTime {
  return toISODateTime(parse(dt).add(minutes, 'minute'));
}

/** Понедельник недели, в которую попадает дата */
export function weekStart(date: ISODate): ISODate {
  return toISODate(parse(date).isoWeekday(1));
}

/** 0 = понедельник … 6 = воскресенье (как в WeekTemplate) */
export function weekdayIndex(date: ISODate): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return (parse(date).isoWeekday() - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Даты от from до to включительно */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let d = parse(from);
  const end = parse(to);
  while (d.isSameOrBefore(end, 'day')) {
    out.push(toISODate(d));
    d = d.add(1, 'day');
  }
  return out;
}

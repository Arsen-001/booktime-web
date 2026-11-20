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
// Армянский: у dayjs только родительный падеж («հոկտեմբերի») — он верен после числа («4 հոկտեմբերի»), а месяц
// сам по себе («Հոկտեմբեր», «հոկտեմբեր 2026») — в именительном. Так же устроена локаль ru.
const HY_MONTHS_GENITIVE = 'հունվարի_փետրվարի_մարտի_ապրիլի_մայիսի_հունիսի_հուլիսի_օգոստոսի_սեպտեմբերի_հոկտեմբերի_նոյեմբերի_դեկտեմբերի'.split('_');
const HY_MONTHS_STANDALONE = 'հունվար_փետրվար_մարտ_ապրիլ_մայիս_հունիս_հուլիս_օգոստոս_սեպտեմբեր_հոկտեմբեր_նոյեմբեր_դեկտեմբեր'.split('_');
const hyMonths = Object.assign(
  (d: Dayjs, format: string) => (/D[oD]?(\[[^[\]]*\]|\s)+MMMM?/.test(format) ? HY_MONTHS_GENITIVE : HY_MONTHS_STANDALONE)[d.month()],
  { s: HY_MONTHS_STANDALONE, f: HY_MONTHS_GENITIVE },
);
// Короткие месяцы — как в CLDR и TEXT-STYLE §4 («26 սեպ», «20 նոյ»): у dayjs свои «սպտ», «հկտ», «նմբ», «դկտ», «փտր»
const HY_MONTHS_SHORT = 'հնվ_փտվ_մրտ_ապր_մյս_հնս_հլս_օգս_սեպ_հոկ_նոյ_դեկ'.split('_');
dayjs.updateLocale('hy-am', { months: hyMonths, monthsShort: HY_MONTHS_SHORT });

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
  // Мгновение с поясом ('2026-11-16T22:06:06Z' с сервера) — сначала во время Еревана: строгий разбор по формату
  // отбрасывал пояс, и оплату 17.11 в 02:06 было видно как «16 ноября, 22:06» (проход 17.11)
  if (value.length > 16 && /[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return dayjs(toLocalDateTime(value) as string, DATE_TIME_FORMAT);
  return dayjs(value, value.length > 10 ? DATE_TIME_FORMAT : DATE_FORMAT);
}

/** Пояс платформы: все даты в данных — местное время Еревана */
export const YEREVAN_TZ = 'Asia/Yerevan';

/**
 * Время с сервера может прийти мгновением с поясом ('2026-10-03T10:30:00.000Z') — в данных у нас местное время Еревана
 * без пояса ('2026-10-03T14:30'), как в моке. Местное время без пояса — как есть (обрезаем секунды).
 */
export function toLocalDateTime(value: string | null | undefined): ISODateTime | null {
  if (!value) return null;
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value.slice(0, 16);
  try {
    return dayjs(value).tz(YEREVAN_TZ).format('YYYY-MM-DDTHH:mm');
  } catch {
    return value.slice(0, 16);
  }
}

/**
 * Позже ли время `a`, чем `b`, с точностью до минуты. Строки бывают местным временем Еревана ('2026-11-17T16:30', как
 * в моке и у записей) и мгновением с поясом с сервера ('2026-11-17T12:23:40.645Z'): строками их сравнивать нельзя —
 * сдвиг на 4 часа (ведомость, 17.11: визит, правленый до начисления, светился «Изменилось после начисления»).
 */
export function isLaterTime(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = toLocalDateTime(a);
  const y = toLocalDateTime(b);
  return Boolean(x && y && x > y);
}

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

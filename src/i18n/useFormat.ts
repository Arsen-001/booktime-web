'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ISODate, ISODateTime, Minutes } from '@/domain/core';
import { DAYJS_LOCALE, addDays, dayjs, parse, today } from '@/lib/date';
import { formatMoney, formatMoneyRange, formatNumber } from '@/lib/money';
import { formatPhone, maskPhone } from '@/lib/phone';

/**
 * monthYearGenitive — месяц в родительном падеже для фраз «с сентября 2025», «работает с июня 2026»
 * (ru; en/hy — как monthYear).
 */
export type DateStyle =
  | 'short'
  | 'long'
  | 'dayMonth'
  | 'dayMonthShort'
  | 'weekday'
  | 'weekdayLong'
  | 'weekdayShort'
  | 'monthYear'
  | 'monthYearGenitive';

const DATE_PATTERNS: Record<DateStyle, string> = {
  short: 'DD.MM.YYYY',
  long: 'D MMMM YYYY',
  dayMonth: 'D MMMM',
  weekday: 'dd, D MMMM',
  weekdayLong: 'dddd, D MMMM',
  // Короткие — для тесных мест (заголовок журнала на узком экране): «вт, 29 сент.», «29 сент.»
  weekdayShort: 'dd, D MMM',
  dayMonthShort: 'D MMM',
  monthYear: 'MMMM YYYY',
  // В ru dayjs склоняет месяц только рядом с числом — формат с днём, день потом отрезаем
  monthYearGenitive: 'D MMMM YYYY',
};

// Английский порядок и сокращения (06.10.2026): «Fri, Oct 2», «October 2», «October 2, 2026» — dayjs 'dd' в en
// давал «Fr», а «D MMMM» — неанглийский порядок. ru/hy — как в DATE_PATTERNS.
const EN_PATTERNS: Partial<Record<DateStyle, string>> = {
  long: 'MMMM D, YYYY',
  dayMonth: 'MMMM D',
  weekday: 'ddd, MMM D',
  weekdayLong: 'dddd, MMMM D',
  weekdayShort: 'ddd, MMM D',
  dayMonthShort: 'MMM D',
};

/** Формат часов: '24' — «14:30» (по умолчанию), '12' — «2:30 PM» (выбор клиента в профиле, F-14-061) */
export type HourCycle = '24' | '12';

export interface FormatOptions {
  hourCycle?: HourCycle;
}

/**
 * Форматирование для показа: деньги «5 000 ֏», телефоны «+374 00 123 456», даты по-русски/армянски/английски,
 * время 24 ч (или 12 ч: useFormat({ hourCycle: '12' })), длительность «1 ч 30 мин». Используйте ТОЛЬКО это,
 * не форматируйте вручную.
 */
export function useFormat(options?: FormatOptions) {
  const locale = useLocale();
  const timePattern = options?.hourCycle === '12' ? 'h:mm A' : 'HH:mm';
  // Хук фундамента: прямой useTranslations допустим (разделам — useT)
  const t = useTranslations('common.units');
  const tDates = useTranslations('common.dates');
  const dl = DAYJS_LOCALE[locale];

  const durationText = (minutes: Minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const text = h && m ? t('hm', { h, m }) : h ? t('h', { h }) : t('m', { m });
    return text.replace(/ /g, '\u00A0');
  };

  const date = (value: ISODate | ISODateTime | Date, style: DateStyle = 'short') => {
    const d = value instanceof Date ? dayjs(value) : parse(value);
    if (style === 'monthYearGenitive') {
      return locale === 'ru' ? d.locale(dl).format(DATE_PATTERNS[style]).replace(/^\d+\s+/, '') : d.locale(dl).format(DATE_PATTERNS.monthYear);
    }
    return d.locale(dl).format((locale === 'en' && EN_PATTERNS[style]) || DATE_PATTERNS[style]);
  };

  // 12 ч — AM/PM на любом языке (владелец, 01.10.2026): меридием dayjs в ru/hy давал «5:00 вечера», поэтому
  // 12-часовое время всегда форматируем английской локалью — цифры и AM/PM одинаковы для всех языков
  const time = (value: ISODateTime) => parse(value).locale(options?.hourCycle === '12' ? 'en' : dl).format(timePattern);

  const relativeDay = (value: ISODate | ISODateTime) => {
    const d = value.slice(0, 10);
    const now = today();
    if (d === now) return tDates('today');
    if (d === addDays(now, 1)) return tDates('tomorrow');
    if (d === addDays(now, -1)) return tDates('yesterday');
    return date(d, 'weekday');
  };

  // Внутри фразы: строчными только «сегодня/завтра/вчера», дата остаётся как есть («Sent Fri, Oct 2», а не «fri, oct 2»)
  const relativeDayInline = (value: ISODate | ISODateTime) => {
    const d = value.slice(0, 10);
    const now = today();
    const word = d === now ? 'today' : d === addDays(now, 1) ? 'tomorrow' : d === addDays(now, -1) ? 'yesterday' : null;
    return word ? tDates(word).toLocaleLowerCase(locale) : date(d, 'weekday');
  };

  return {
    money: formatMoney,
    moneyRange: formatMoneyRange,
    number: formatNumber,
    phone: formatPhone,
    maskedPhone: maskPhone,
    date,
    /** 'YYYY-MM-DDTHH:mm' → '14:30' (или '2:30 PM' при hourCycle '12') */
    time,
    dateTime: (value: ISODateTime) => `${date(value, 'dayMonth')}, ${time(value)}`,
    /** 90 → «1 ч 30 мин» (неразрывно) */
    duration: (minutes: Minutes) => durationText(minutes),
    /** Длительность «от–до» */
    durationRange: (min: Minutes, max?: Minutes) =>
      max && max > min ? `${durationText(min)} – ${durationText(max)}` : durationText(min),
    /** «Сегодня», «Завтра», «Вчера» или дата с днём недели («сегодня» — по Еревану) */
    relativeDay,
    /** Как relativeDay, но для середины фразы: «сегодня», «завтра», «пт, 2 октября» / «Fri, Oct 2» */
    relativeDayInline,
    /**
     * Сколько прошло: «Сегодня», «Вчера», «3 дня назад», «2 недели назад», «5 месяцев назад», «Больше года назад».
     * Для «последний визит», «отправлено», журналов. Будущая дата — как relativeDay.
     */
    ago: (value: ISODate | ISODateTime) => {
      const d = value.slice(0, 10);
      const days = parse(today()).diff(parse(d), 'day');
      if (days <= 1) return relativeDay(d);
      if (days < 7) return tDates('daysAgo', { n: days });
      if (days < 30) return tDates('weeksAgo', { n: Math.floor(days / 7) });
      const months = parse(today()).diff(parse(d), 'month');
      if (months < 12) return tDates('monthsAgo', { n: Math.max(1, months) });
      return tDates('overYearAgo');
    },
    /** Короткие дни недели с понедельника: ['пн', 'вт', …] */
    weekdaysShort: () => Array.from({ length: 7 }, (_, i) => dayjs().isoWeekday(i + 1).locale(dl).format('dd')),
    /** Название месяца в именительном падеже */
    monthName: (value: ISODate) => parse(value).locale(dl).format('MMMM'),
  };
}

export type Formatter = ReturnType<typeof useFormat>;

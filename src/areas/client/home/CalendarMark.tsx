'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/areas/client/home/landing';
import mark from '@/shell/brand-mark.json';
import { useT } from '@/i18n/useT';
import { useIsClient } from '@/ui/hooks/useIsClient';

const BOOK_EVERY_MS = 2400;
const BOOKED_FOR_MS = 2600;
const COLS = mark.rows[0].length;

/**
 * Календарь-логотип рядом с телефоном (владелец 03.10.2026): знак BookTime 6×5 — это 30 дней текущего месяца.
 * Месяц, число дней и «сегодня» — из даты в браузере: 31-е встаёт под 30-м (в той же строке — подписи, карточка не
 * растёт), в коротком месяце лишние клетки бледные и без числа, чтобы знак не ломался. Клетки B и T заняты, бледные
 * свободны и то и дело «занимаются» — кто-то только что записался. Картинка (aria-hidden), не настоящие записи.
 */
export function CalendarMark() {
  const t = useT('client');
  const reduced = useReducedMotion();
  // Дата — только в браузере: у сервера свой часовой пояс, на стыке месяцев числа разошлись бы с гидрацией
  const client = useIsClient();
  const now = client ? new Date() : null;
  const year = now?.getFullYear() ?? 2026;
  const month = now?.getMonth() ?? 0;
  const today = now?.getDate() ?? 0;
  const daysIn = now ? new Date(year, month + 1, 0).getDate() : 30;
  // Названия месяцев и дней — из словаря: в Intl армянского может не оказаться (WebView), а подпись должна быть на языке сайта
  const months = t('home.calendar.months').split(',');
  const monthsOf = t('home.calendar.monthsOf').split(',');
  const weekdays = t('home.calendar.weekdays').split(',');
  const monthName = now ? months[month] : '';
  const dayLabel = (d: number) =>
    t('home.calendar.dayLabel', { weekday: weekdays[new Date(year, month, d).getDay()], day: d, month: monthsOf[month] });

  const free = mark.rows
    .flatMap((row, r) => [...row].map((k, c) => (k === '.' ? r * COLS + c + 1 : 0)))
    .filter((d) => d > 0 && d <= daysIn)
    .concat(daysIn === 31 ? [31] : []);
  const [booked, setBooked] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const freeKey = free.join(',');

  useEffect(() => {
    if (reduced || !client) return;
    const days = freeKey.split(',').map(Number);
    let off = 0;
    const id = window.setInterval(() => {
      let next = days[Math.floor(Math.random() * days.length)];
      if (next === last.current) next = days[(days.indexOf(next) + 1) % days.length];
      last.current = next;
      setBooked(next);
      window.clearTimeout(off);
      off = window.setTimeout(() => setBooked(null), BOOKED_FOR_MS);
    }, BOOK_EVERY_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(off);
    };
  }, [reduced, client, freeKey]);

  const cell = (day: number, k: string, w: number) => {
    const kind = k === 'b' || k === 't' ? k : undefined;
    if (day > daysIn) return <span key={day} className="lp-cell" data-k={kind} data-out="" style={{ ['--w' as string]: w }} />;
    const isBooked = booked === day;
    const busy = Boolean(kind) || isBooked;
    return (
      <span
        key={day}
        className="lp-cell"
        data-k={kind}
        {...(isBooked ? { 'data-booked': '' } : {})}
        {...(day === today ? { 'data-today': '' } : {})}
        style={{ ['--w' as string]: w }}
      >
        {client && <span className="lp-num">{day}</span>}
        {client && (
          <span className="lp-tip">
            {dayLabel(day)}
            {day === today ? ` · ${t('home.calendar.today')}` : ''} · {busy ? t('home.calendar.busyShort') : t('home.calendar.freeShort')}
          </span>
        )}
      </span>
    );
  };

  return (
    <div aria-hidden data-in="" className="lp-cal lp-calcard flex w-[16.25rem] min-w-0 shrink flex-col gap-3 rounded-3xl border border-border bg-surface p-[1.125rem] shadow-lg">
      <div className="flex flex-col">
        <b className="min-h-6 font-display text-base font-extrabold text-fg first-letter:uppercase">{monthName}</b>
        <span className="text-[13px] text-muted">{t('home.calendar.who')}</span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {mark.rows.flatMap((row, r) => [...row].map((k, c) => cell(r * COLS + c + 1, k, Number(Math.hypot(c - 2.5, r - 2).toFixed(2)))))}
        <span className="col-span-5 flex flex-wrap content-center items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-[0.6875rem] rounded-[3px] bg-brand-b" />
            {t('home.calendar.busy')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-[0.6875rem] rounded-[3px] bg-brand-empty" />
            {t('home.calendar.free')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-[0.6875rem] rounded-[3px] bg-primary-soft ring-2 ring-primary-text ring-inset" />
            {t('home.calendar.justBooked')}
          </span>
        </span>
        {daysIn === 31 && cell(31, '.', 4.6)}
      </div>
    </div>
  );
}

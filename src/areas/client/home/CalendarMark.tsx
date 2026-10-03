'use client';

import { useEffect, useRef, useState } from 'react';
import { inAttr, useInView, useReducedMotion } from '@/areas/client/home/landing';
import mark from '@/shell/brand-mark.json';
import { useT } from '@/i18n/useT';

const TIMES = ['10:00', '12:00', '14:00', '16:00', '18:00'] as const;
const BOOK_EVERY_MS = 1100;
const BOOKED_FOR_MS = 2600;

/**
 * Календарь-логотип (владелец 03.10.2026: «календарь делай как лого — 30 кубиков»): знак BookTime 6×5 — это неделя
 * мастера. Клетки B и T заняты, бледные свободны; свободные то и дело «занимаются» — кто-то только что записался.
 * Клетки появляются волной, когда блок попадает в экран; при наведении — день, время и занято ли.
 */
export function CalendarMark() {
  const t = useT('client');
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const days = t('home.calendar.days').split(',');
  const free = mark.rows.flatMap((row, r) => [...row].map((k, c) => (k === '.' ? r * row.length + c : -1))).filter((i) => i >= 0);
  const [booked, setBooked] = useState<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !inView) return;
    let off = 0;
    const id = window.setInterval(() => {
      let next = free[Math.floor(Math.random() * free.length)];
      if (next === last.current) next = free[(free.indexOf(next) + 1) % free.length];
      last.current = next;
      setBooked(next);
      window.clearTimeout(off);
      off = window.setTimeout(() => setBooked(null), BOOKED_FOR_MS);
    }, BOOK_EVERY_MS + BOOKED_FOR_MS / 2);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(off);
    };
    // free — из файла знака, не меняется
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, inView]);

  return (
    <section className="grid items-center gap-10 rounded-[2rem] border border-border bg-surface p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16 lg:p-14">
      <div className="flex min-w-0 flex-col gap-4">
        <span className="text-sm font-semibold text-primary-text">{t('home.calendar.eyebrow')}</span>
        <h2 className="font-display text-[1.75rem] leading-[1.1] font-extrabold tracking-tight text-balance text-fg md:text-[2.5rem]">
          {t('home.calendar.title')}
        </h2>
        <p className="max-w-[48ch] text-base text-muted md:text-lg">{t('home.calendar.text')}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="size-3.5 rounded bg-brand-b" />
            {t('home.calendar.busy')}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3.5 rounded bg-brand-empty" />
            {t('home.calendar.free')}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3.5 rounded bg-primary-soft ring-2 ring-primary-text ring-inset" />
            {t('home.calendar.justBooked')}
          </span>
        </div>
      </div>

      <div ref={ref} aria-hidden className="lp-cal w-full max-w-[440px] justify-self-center" {...inAttr(inView)}>
        <div className="mb-2 grid grid-cols-6 gap-2.5 text-center text-xs font-semibold text-muted sm:gap-3.5">
          {days.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-2.5 sm:gap-3.5">
          {mark.rows.flatMap((row, r) =>
            [...row].map((k, c) => {
              const i = r * row.length + c;
              const isBooked = booked === i;
              const busy = k !== '.';
              return (
                <span
                  key={i}
                  className="lp-cell"
                  data-k={k}
                  {...(isBooked ? { 'data-booked': '' } : {})}
                  style={{ ['--w' as string]: Math.hypot(c - 2.5, r - 2).toFixed(2) }}
                >
                  <span className="lp-tip">
                    {days[c]} · {TIMES[r]} · {busy || isBooked ? t('home.calendar.busyShort') : t('home.calendar.freeShort')}
                  </span>
                </span>
              );
            }),
          )}
        </div>
      </div>
    </section>
  );
}

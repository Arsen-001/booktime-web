'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { inAttr, useInView, useReducedMotion } from '@/areas/client/home/landing';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

/** Мастера мини-журнала: цвет колонки — из палитры графиков */
const COLS = [
  { key: 'a', tone: 'var(--chart-5)', name: 'home.journalDemo.master1', initials: 'home.journalDemo.master1Initials' },
  { key: 'b', tone: 'var(--chart-4)', name: 'home.journalDemo.master2', initials: 'home.journalDemo.master2Initials' },
  { key: 'c', tone: 'var(--chart-2)', name: 'home.journalDemo.master3', initials: 'home.journalDemo.master3Initials' },
] as const;
/** Записи падают по одной: [колонка, время, номер клиента в текстах] */
const BOOKINGS = [
  [0, '10:00', 1],
  [2, '11:00', 2],
  [1, '10:30', 3],
  [0, '12:00', 4],
  [2, '12:00', 5],
  [1, '13:15', 6],
  [2, '13:00', 7],
  [0, '15:30', 8],
] as const;
const DROP_MS = 1100;
const HOLD_MS = 2600;

/**
 * «Для мастеров, салонов и клиник» (F-00-035) — тёмный блок с мини-журналом, в который сами падают записи
 * (вариант «Живая запись», 03.10.2026). Кнопки: подключить бизнес и войти в кабинет.
 */
export function ForBusinessBanner() {
  const t = useT('client');
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLElement>(0.25);
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const shown = reduced ? BOOKINGS.length : count;

  useEffect(() => {
    if (reduced || !inView) return;
    let id = 0;
    let n = 0;
    const step = () => {
      if (n >= BOOKINGS.length) {
        setLeaving(true);
        id = window.setTimeout(() => {
          n = 0;
          setLeaving(false);
          setCount(0);
          id = window.setTimeout(step, 400);
        }, 450);
        return;
      }
      n += 1;
      setCount(n);
      id = window.setTimeout(step, n >= BOOKINGS.length ? HOLD_MS : DROP_MS);
    };
    id = window.setTimeout(step, 300);
    return () => window.clearTimeout(id);
  }, [reduced, inView]);

  const points = [t('home.business.point1'), t('home.business.point2'), t('home.business.point3')];

  return (
    <section
      ref={ref}
      data-f="F-00-035"
      className="lp-biz lp-rv relative grid gap-10 overflow-hidden rounded-[2rem] bg-deep p-6 text-primary-contrast sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-12 lg:p-14"
      {...inAttr(inView)}
    >
      <div className="relative flex min-w-0 flex-col gap-4">
        <span className="text-sm font-semibold opacity-80">{t('home.business.eyebrow')}</span>
        <h2 className="font-display text-[1.75rem] leading-[1.1] font-extrabold tracking-tight text-balance md:text-[2.5rem]">
          {t('home.business.title')}
        </h2>
        <p className="max-w-[52ch] text-base opacity-85 md:text-lg">{t('home.business.text')}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[15px]">
          {points.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="size-4 shrink-0 text-success-soft" />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/register-business"
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary-contrast px-5 font-semibold text-primary transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-contrast"
          >
            {t('home.business.cta')}
            <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login?next=%2Fbiz"
            className="inline-flex h-12 items-center rounded-xl border border-primary-contrast/35 px-5 font-semibold transition-colors hover:bg-primary-contrast/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-contrast"
          >
            {t('home.business.login')}
          </Link>
        </div>
      </div>

      <div aria-hidden className="relative flex flex-col gap-3 rounded-[1.375rem] bg-surface p-4 text-fg">
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <b className="text-[15px]">{t('home.journalDemo.day')}</b>
          <span className="text-muted tabular-nums">{t('home.journalDemo.count', { count: shown })}</span>
        </div>
        <div className="grid min-h-[15.5rem] grid-cols-3 gap-2">
          {COLS.map((col, ci) => (
            <div key={col.key} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                  style={{ background: `color-mix(in srgb, ${col.tone} 16%, var(--surface))`, color: col.tone }}
                >
                  {t(col.initials)}
                </span>
                <span className="truncate">{t(col.name)}</span>
              </div>
              {BOOKINGS.slice(0, shown)
                .filter(([c]) => c === ci)
                .map(([, time, who]) => (
                  <div
                    key={time + who}
                    className={cn('lp-bk flex flex-col rounded-xl px-2.5 py-2')}
                    {...(leaving ? { 'data-out': '' } : {})}
                    style={{ background: `color-mix(in srgb, ${col.tone} 16%, var(--surface))` }}
                  >
                    <b className="font-display text-[1.375rem] leading-tight font-extrabold tracking-[-0.04em]" style={{ color: col.tone }}>
                      {time}
                    </b>
                    <span className="truncate text-xs font-semibold">{t(`home.journalDemo.client${who}`)}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/areas/client/home/landing';
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
 * Мини-журнал на три мастера, в который сами падают записи (вариант «Живая запись», 03.10.2026). Общий для блока
 * «Для бизнеса» на главной и страницы /business. `active` — блок на экране: пока его не видно, сцена не идёт;
 * без движения (prefers-reduced-motion) — сразу полный день. `initial` — сколько записей уже стоит в первом кадре
 * (первый экран /business не начинается с пустого журнала).
 */
export function MiniJournal({ active, initial = 0, className }: { active: boolean; initial?: number; className?: string }) {
  const t = useT('client');
  const reduced = useReducedMotion();
  const [count, setCount] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const shown = reduced ? BOOKINGS.length : count;

  useEffect(() => {
    if (reduced || !active) return;
    let id = 0;
    let n = initial;
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
  }, [reduced, active, initial]);

  return (
    <div aria-hidden className={cn('relative flex flex-col gap-3 rounded-[1.375rem] bg-surface p-4 text-fg', className)}>
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
                  className="lp-bk flex flex-col rounded-xl px-2.5 py-2"
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
  );
}

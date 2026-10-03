'use client';

import { useT } from '@/i18n/useT';

const STEPS = [1, 2, 3] as const;

/** «Как записаться» для гостя: три шага, чтобы за 3 секунды было понятно, что здесь происходит */
export function HowItWorks() {
  const t = useT('client');
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-fg">{t('home.how.title')}</h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((n) => (
          <li key={n} className="flex gap-4 rounded-xl border border-border bg-surface p-5 md:flex-col md:gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary-text tabular-nums">
              {n}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-base font-semibold text-fg">{t(`home.how.step${n}Title`)}</h3>
              <p className="text-sm text-muted">{t(`home.how.step${n}Text`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/useT';

const STEPS = [1, 2, 3] as const;

/**
 * «Три шага — и вы записаны»: линия между кружками дорисовывается при прокрутке, кружки загораются по очереди
 * (вариант «Живая запись», 03.10.2026). На телефоне шаги столбиком, без линии.
 */
export function HowItWorks() {
  const t = useT('client');
  const ref = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setProgress(Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.5))));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="flex flex-col gap-7">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg md:text-[2rem]">{t('home.how.title')}</h2>
      <ol ref={ref} className="relative grid gap-6 md:grid-cols-3 md:gap-8">
        <span aria-hidden className="absolute top-7 right-7 left-7 hidden h-0.5 rounded-full bg-border md:block" />
        <span
          aria-hidden
          className="absolute top-7 left-7 hidden h-[3px] -translate-y-px origin-left rounded-full bg-primary md:block"
          style={{ width: 'calc(100% - 3.5rem)', transform: `scaleX(${progress})` }}
        />
        {STEPS.map((n, i) => (
          <li key={n} className="lp-step relative flex gap-4 md:flex-col md:gap-3" {...(progress >= i / 2 - 0.02 ? { 'data-lit': '' } : {})}>
            <span className="lp-step-n relative grid size-14 shrink-0 place-items-center rounded-full border-2 border-border bg-surface font-display text-xl font-extrabold text-fg tabular-nums">
              {n}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-display text-xl font-bold tracking-tight text-fg">{t(`home.how.step${n}Title`)}</h3>
              <p className="text-[15px] text-muted">{t(`home.how.step${n}Text`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

'use client';

import { ArrowRight, Check, Globe } from 'lucide-react';
import Link from 'next/link';
import { ctaPrimary, ctaSecondary } from '@/areas/client/business/cta';
import { useInView } from '@/areas/client/home/landing';
import { MiniJournal } from '@/areas/client/home/MiniJournal';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';

/**
 * Первый экран /business (04.10.2026): кому и что — заголовок, подзаголовок, «Подключить бизнес» и «Войти в кабинет»;
 * справа — тот же живой мини-журнал, что в блоке «Для бизнеса» на главной, на тёмной подложке.
 */
export function BusinessHero() {
  const t = useT('client');
  const localize = useLocalizedHref();
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const points = [t('bizLanding.hero.point1'), t('bizLanding.hero.point2'), t('bizLanding.hero.point3')];

  return (
    <section data-f="F-00-035" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-6">
        <span className="inline-flex w-max max-w-full items-center gap-2.5 rounded-2xl border border-border bg-surface py-1.5 pr-3.5 pl-2.5 text-sm font-semibold text-muted">
          <span className="lp-pulse shrink-0" />
          <span className="min-w-0">{t('bizLanding.hero.eyebrow')}</span>
        </span>
        <h1 className="font-display text-[clamp(1.85rem,8vw,2.5rem)] leading-[1.08] font-extrabold tracking-tight text-balance text-fg sm:text-[3rem] lg:text-[2.75rem] xl:text-[3.125rem] [:lang(hy)_&]:sm:text-[2.5rem] [:lang(hy)_&]:lg:text-[2.25rem] [:lang(hy)_&]:xl:text-[2.5rem]">
          {t('bizLanding.hero.title')}
        </h1>
        <p className="max-w-[56ch] text-base text-muted md:text-lg">{t('bizLanding.hero.text')}</p>
        <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
          <Link href={localize('/register-business')} className={ctaPrimary}>
            {t('bizLanding.hero.cta')}
            <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/login?next=%2Fbiz" className={ctaSecondary}>
            {t('bizLanding.hero.login')}
          </Link>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-fg">
          {points.map((p, i) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              {i === 0 ? <Globe aria-hidden className="size-4 shrink-0 text-success" /> : <Check aria-hidden className="size-4 shrink-0 text-success" />}
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div ref={ref} className="lp-biz relative overflow-hidden rounded-[2rem] bg-deep p-4 sm:p-6 sm:pb-20">
        <MiniJournal active={inView} initial={4} />
        <span
          aria-hidden
          className="lp-chip absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap text-fg shadow-md sm:inline-flex"
        >
          <span className="size-2 rounded-full bg-success" />
          {t('bizLanding.hero.chip')}
        </span>
      </div>
    </section>
  );
}

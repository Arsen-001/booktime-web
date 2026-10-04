'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ctaOnDark, ctaOnDarkGhost } from '@/areas/client/business/cta';
import { inAttr, useInView } from '@/areas/client/home/landing';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';

/**
 * Последний блок /business — тёмная полоса с «Подключить бизнес» и входом в кабинет. Отдельного канала связи
 * (бота поддержки, почты) пока нет — только регистрация (04.10.2026).
 */
export function BusinessFinalCta() {
  const t = useT('client');
  const localize = useLocalizedHref();
  const [ref, inView] = useInView<HTMLElement>(0.25);

  return (
    <section
      ref={ref}
      className="lp-biz lp-rv relative flex flex-col items-start gap-5 overflow-hidden rounded-[2rem] bg-deep p-6 text-primary-contrast sm:p-10 md:items-center md:text-center lg:p-14"
      {...inAttr(inView)}
    >
      <h2 className="relative font-display text-[1.75rem] leading-[1.1] font-extrabold tracking-tight text-balance md:text-[2.5rem]">
        {t('bizLanding.final.title')}
      </h2>
      <p className="relative max-w-[52ch] text-base opacity-85 md:text-lg">{t('bizLanding.final.text')}</p>
      <div className="relative flex w-full flex-col gap-3 pt-1 min-[480px]:w-auto min-[480px]:flex-row min-[480px]:flex-wrap md:justify-center">
        <Link href={localize('/register-business')} className={ctaOnDark}>
          {t('bizLanding.final.cta')}
          <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/login?next=%2Fbiz" className={ctaOnDarkGhost}>
          {t('bizLanding.final.login')}
        </Link>
      </div>
    </section>
  );
}

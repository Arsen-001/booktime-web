'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { inAttr, useInView } from '@/areas/client/home/landing';
import { MiniJournal } from '@/areas/client/home/MiniJournal';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';

/**
 * «Для мастеров, салонов и клиник» (F-00-035) — тёмный блок с мини-журналом, в который сами падают записи
 * (вариант «Живая запись», 03.10.2026). Кнопки: подключить бизнес и войти в кабинет; ссылка «Подробнее» — на
 * страницу для владельцев /business (04.10.2026).
 */
export function ForBusinessBanner() {
  const t = useT('client');
  const localize = useLocalizedHref();
  const [ref, inView] = useInView<HTMLElement>(0.25);

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
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href={localize('/register-business')}
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
          <Link
            href={localize('/business')}
            className="inline-flex h-12 items-center px-2 font-semibold underline decoration-primary-contrast/40 underline-offset-4 transition-colors hover:decoration-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-contrast"
          >
            {t('home.business.more')}
          </Link>
        </div>
      </div>

      <MiniJournal active={inView} />
    </section>
  );
}

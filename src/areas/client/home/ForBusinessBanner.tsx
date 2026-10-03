'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';

/**
 * «Вы мастер или салон?» на главной гостя (F-00-035): вход в подключение бизнеса и в кабинет. Единственный залитый
 * блок страницы — у бизнеса свой главный путь, он не должен теряться среди клиентских секций.
 */
export function ForBusinessBanner() {
  const t = useT('client');
  const points = [t('home.business.point1'), t('home.business.point2'), t('home.business.point3')];
  return (
    <section
      data-f="F-00-035"
      className="grid gap-6 rounded-2xl bg-primary p-6 text-primary-contrast md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-8"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide opacity-80">{t('home.business.eyebrow')}</p>
        <h2 className="text-2xl font-bold tracking-tight text-balance md:text-[1.75rem]">{t('home.business.title')}</h2>
        <p className="max-w-[56ch] text-[0.9375rem] opacity-90">{t('home.business.text')}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">
          {points.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="size-4 shrink-0" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
        <LinkButton
          href="/register-business"
          size="lg"
          variant="secondary"
          rightIcon={<ArrowRight aria-hidden />}
          className="border-transparent text-primary-text"
        >
          {t('home.business.cta')}
        </LinkButton>
        <Link
          href="/login?next=%2Fbiz"
          className="inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-contrast"
        >
          {t('home.business.login')}
        </Link>
      </div>
    </section>
  );
}

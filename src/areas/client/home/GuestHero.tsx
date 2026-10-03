'use client';

import { BadgeCheck, Check, Send } from 'lucide-react';
import { HomeSearchBar } from '@/areas/client/home/HomeSearchBar';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';

const PREVIEW_SLOTS = ['16:00', '17:30', '18:15'] as const;
const PREVIEW_PICKED = '17:30';

/**
 * Первый экран главной для гостя (владелец 03.10.2026: «переработать первую страницу»): кто мы, одна фраза — зачем,
 * поиск как главное действие и три обещания. Справа на компьютере — картинка продукта (карточка записи), не фото.
 */
export function GuestHero() {
  const t = useT('client');
  const points = [t('home.hero.free'), t('home.hero.noCalls'), t('home.hero.reminders')];

  return (
    <section data-f="F-00-005" className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-5">
        <p className="text-sm font-semibold tracking-wide text-primary-text">{t('home.hero.eyebrow')}</p>
        <h1 className="text-[2rem] leading-[1.1] font-bold tracking-tight text-balance text-fg md:text-[2.75rem]">
          {t('home.hero.title')}
        </h1>
        <p className="max-w-[54ch] text-base text-muted md:text-lg">{t('home.hero.text')}</p>
        <HomeSearchBar />
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg">
          {points.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="size-4 shrink-0 text-success" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <HeroPreview />
    </section>
  );
}

/** Картинка продукта из настоящих деталей интерфейса: карточка мастера с окнами и подтверждение записи */
function HeroPreview() {
  const t = useT('client');
  return (
    <div aria-hidden className="relative max-lg:hidden">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-md">
        <div className="flex items-center gap-3">
          <Avatar name={t('home.hero.previewMaster')} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{t('home.hero.previewService')}</p>
            <p className="truncate text-xs text-muted">{t('home.hero.previewMaster')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-muted">{t('home.hero.previewDay')}</span>
          {PREVIEW_SLOTS.map((s) => (
            <span
              key={s}
              className={
                s === PREVIEW_PICKED
                  ? 'rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-contrast tabular-nums'
                  : 'rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-text tabular-nums'
              }
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="relative -mt-3 ml-8 flex flex-col gap-1.5 rounded-2xl border border-border bg-success-soft p-4 shadow-lg">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
          <BadgeCheck className="size-5 text-success" />
          {t('home.hero.previewBooked')}
        </p>
        <p className="inline-flex items-center gap-2 text-xs text-muted">
          <Send className="size-4" />
          {t('home.hero.previewReminder')}
        </p>
      </div>
    </div>
  );
}

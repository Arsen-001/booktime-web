'use client';

import { BellRing, CalendarDays, Link2, PackageCheck, Search, UsersRound, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { sectionTitle } from '@/areas/client/business/cta';
import { inAttr, useInView } from '@/areas/client/home/landing';
import { useT } from '@/i18n/useT';

/**
 * «Что вы получаете» — шесть настоящих функций (проверены по коду и docs/better-than-altegio.md, 04.10.2026):
 * страница записи /b/<slug> со ссылкой (online), журнал на телефоне (journal), база клиентов с выгрузкой (clients),
 * напоминания за сутки и 2 часа в Telegram и подтверждение визита (notify, F-00-120, F-05-028), каталог и
 * «Свободно сегодня» (F-00-001), заказы мастерских с квитанцией и «Готово» клиенту (orders).
 */
const BENEFITS: { id: 'link' | 'journal' | 'clients' | 'reminders' | 'catalog' | 'orders'; icon: LucideIcon; tone: string }[] = [
  { id: 'link', icon: Link2, tone: 'var(--chart-1)' },
  { id: 'journal', icon: CalendarDays, tone: 'var(--chart-2)' },
  { id: 'clients', icon: UsersRound, tone: 'var(--chart-4)' },
  { id: 'reminders', icon: BellRing, tone: 'var(--chart-5)' },
  { id: 'catalog', icon: Search, tone: 'var(--chart-6)' },
  { id: 'orders', icon: PackageCheck, tone: 'var(--chart-3)' },
];

export function BusinessBenefits() {
  const t = useT('client');
  const [ref, inView] = useInView<HTMLUListElement>();

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('bizLanding.benefits.title')}</h2>
        <p className="max-w-[60ch] text-base text-muted md:text-lg">{t('bizLanding.benefits.text')}</p>
      </div>
      <ul ref={ref} className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {BENEFITS.map(({ id, icon: Icon, tone }, i) => (
          <li
            key={id}
            className="lp-rv flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            style={{ '--d': i, '--tone': tone } as CSSProperties}
            {...inAttr(inView)}
          >
            <span className="lp-tile-icon inline-flex size-12 items-center justify-center rounded-2xl">
              <Icon aria-hidden className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-xl font-bold tracking-tight text-fg">{t(`bizLanding.benefits.${id}.title`)}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{t(`bizLanding.benefits.${id}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

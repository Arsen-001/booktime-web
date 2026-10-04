'use client';

import { ArrowRight, Wrench, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { sectionTitle } from '@/areas/client/business/cta';
import { inAttr, useInView } from '@/areas/client/home/landing';
import { SPHERE_ICON } from '@/areas/client/ui/sphereIcons';
import type { SphereId } from '@/domain/core';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';

type Tile = { id: 'hair' | 'nails' | 'barber' | 'cosmetology' | 'dental' | 'massage' | 'fitness' | 'workshops'; sphere?: SphereId; icon: LucideIcon; tone: string };

/** Мастерские — четыре сферы заказов одной плиткой (ателье, ремонт, химчистка, детейлинг): сферу выберут в анкете */
const TILES: Tile[] = [
  { id: 'hair', sphere: 'hair', icon: SPHERE_ICON.hair, tone: 'var(--chart-4)' },
  { id: 'nails', sphere: 'nails', icon: SPHERE_ICON.nails, tone: 'var(--chart-5)' },
  { id: 'barber', sphere: 'barber', icon: SPHERE_ICON.barber, tone: 'var(--chart-2)' },
  { id: 'cosmetology', sphere: 'cosmetology', icon: SPHERE_ICON.cosmetology, tone: 'var(--chart-6)' },
  { id: 'dental', sphere: 'dental', icon: SPHERE_ICON.dental, tone: 'var(--chart-1)' },
  { id: 'massage', sphere: 'massage', icon: SPHERE_ICON.massage, tone: 'var(--chart-3)' },
  { id: 'fitness', sphere: 'fitness', icon: SPHERE_ICON.fitness, tone: 'var(--chart-8)' },
  { id: 'workshops', icon: Wrench, tone: 'var(--chart-7)' },
];

/**
 * «Для кого» — сферы плитками, как на главной гостя (заливка цветом сферы при наведении). Плитка ведёт в анкету
 * регистрации с уже отмеченной сферой (/register-business?sphere=…).
 */
export function BusinessSpheres() {
  const t = useT('client');
  const localize = useLocalizedHref();
  const [ref, inView] = useInView<HTMLUListElement>();

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('bizLanding.spheres.title')}</h2>
        <p className="max-w-[60ch] text-base text-muted md:text-lg">{t('bizLanding.spheres.text')}</p>
      </div>
      <ul ref={ref} className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
        {TILES.map(({ id, sphere, icon: Icon, tone }, i) => (
          <li key={id} className="lp-rv min-w-0" style={{ '--d': i } as CSSProperties} {...inAttr(inView)}>
            <Link
              href={localize(sphere ? `/register-business?sphere=${sphere}` : '/register-business')}
              style={{ '--tone': tone } as CSSProperties}
              className="lp-tile flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-4 focus-visible:outline-2 focus-visible:outline-focus sm:gap-6 sm:p-5 [--fill-x:16px] [--fill-y:16px] sm:[--fill-x:20px] sm:[--fill-y:20px]"
            >
              <span className="lp-tile-icon inline-flex size-12 items-center justify-center rounded-2xl">
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <b className="font-display text-[1.0625rem] leading-snug font-bold tracking-tight text-fg [overflow-wrap:anywhere] sm:text-lg">
                  {t(`bizLanding.spheres.${id}.title`)}
                </b>
                <span className="text-sm text-muted">{t(`bizLanding.spheres.${id}.text`)}</span>
              </span>
              <ArrowRight aria-hidden className="lp-tile-go absolute top-5 right-5 size-5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

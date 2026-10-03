'use client';

import Link from 'next/link';
import { CLIENT_SPHERES, SPHERE_ICON } from '@/areas/client/ui/sphereIcons';
import { useT } from '@/i18n/useT';

/** Сферы плитками для гостя (F-00-110): все восемь видны сразу, без прокрутки ряда; тап — поиск по сфере */
export function SphereGrid() {
  const tc = useT('common');
  const t = useT('client');
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-fg">{t('home.spheresTitle')}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CLIENT_SPHERES.map((id) => {
          const Icon = SPHERE_ICON[id];
          return (
            <li key={id} className="min-w-0">
              <Link
                href={`/search?sphere=${id}`}
                className="flex h-full min-h-14 items-center gap-2.5 rounded-xl border border-border bg-surface p-3 text-sm font-medium text-fg shadow-xs transition-colors hover:border-primary hover:text-primary-text focus-visible:outline-2 focus-visible:outline-focus sm:flex-col sm:items-start sm:gap-4 sm:p-4 sm:[&>span:first-child]:size-10 sm:text-[0.9375rem]"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{tc(`spheres.${id}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

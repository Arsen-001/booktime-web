'use client';

import Link from 'next/link';
import { CLIENT_SPHERES, SPHERE_ICON } from '@/areas/client/ui/sphereIcons';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';
import { ScrollRow } from '@/ui/ScrollRow';

/** Крупные категории под поиском (F-00-110, ux-r1 №6, ux-best-c1 №6): тап — поиск по сфере, кто свободен сегодня */
export function SphereLinks() {
  const tc = useT('common');
  const localize = useLocalizedHref();
  const t = useT('client');
  return (
    <ScrollRow bleed aria-label={t('home.spheresLabel')}>
      {CLIENT_SPHERES.map((id) => {
        const Icon = SPHERE_ICON[id];
        return (
          <Link
            key={id}
            href={localize(`/search?sphere=${id}`)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong/40 bg-surface px-4 text-sm font-medium whitespace-nowrap text-fg shadow-xs transition-colors hover:border-primary hover:text-primary-text focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Icon aria-hidden className="size-5 text-primary-text" />
            {tc(`spheres.${id}`)}
          </Link>
        );
      })}
    </ScrollRow>
  );
}

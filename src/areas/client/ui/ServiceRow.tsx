'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { PublicService } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { pickText } from '@/lib/text';

/**
 * Строка услуги — одинаковая на карточке мастера и карточке места (ux-best-c2 №2, ux-r5 №21): название, длительность,
 * цена «от–до», тап ведёт в запись с уже выбранной услугой.
 */
export function ServiceRow({ service, href }: { service: PublicService; href: string }) {
  const fmt = useClientFormat();
  const locale = useLocale();
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="min-w-0">
          <span className="block font-medium text-fg">{pickText(service.name, locale)}</span>
          <span className="block text-sm text-muted">{fmt.durationRange(service.durationMin, service.durationMax)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-fg tabular-nums">
          {fmt.moneyRange(service.priceMin, service.priceMax)}
          <ChevronRight aria-hidden className="size-4 text-muted" />
        </span>
      </Link>
    </li>
  );
}

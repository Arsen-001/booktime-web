'use client';

/**
 * Акции бизнеса на карточке места/мастера (F-14-032, F-14-033): активные сторис этого бизнеса, новая первой. Нет — блока
 * нет вовсе (§0.3).
 */
import Image from 'next/image';
import Link from 'next/link';
import { listBusinessPromoStories } from '@/api/client';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { ScrollRow } from '@/ui/ScrollRow';

export function PromoStoriesRow({ businessId }: { businessId: Id }) {
  const t = useT('client');
  const q = useApiQuery(['client', 'businessPromoStories', businessId], () => listBusinessPromoStories(businessId));
  if (!q.data?.length) return null;

  return (
    <section data-f="F-14-032 F-14-033 F-06-164" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">{t('place.promoTitle')}</h2>
      <ScrollRow gap="sm" aria-label={t('place.promoTitle')}>
        {q.data.map((s) => (
          <Link
            key={s.id}
            href={`/stories/${s.id}`}
            className="block h-28 w-[72px] shrink-0 overflow-hidden rounded-xl ring-1 ring-border focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Image src={s.imageUrl} alt={t('place.promoOpen')} width={72} height={112} unoptimized className="size-full object-cover" />
          </Link>
        ))}
      </ScrollRow>
    </section>
  );
}

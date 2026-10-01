'use client';

import { CalendarSearch } from 'lucide-react';
import { listCatalog } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { CatalogEntryCard, CatalogEntryCardSkeleton } from '@/areas/client/catalog/CatalogEntryCard';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { InlineError } from '@/areas/client/ui/InlineError';
import { SectionHeader } from '@/areas/client/ui/SectionHeader';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

const QUERY = { limit: 6 } as const;

/**
 * «Свободно сегодня» — главное отличие продукта, поэтому сразу под поиском (ux-best-c3 №5, demo-q3/q4). «Рядом» в
 * заголовке — только когда есть геолокация (ux-r1 №2), поэтому здесь «Свободно сегодня».
 */
export function FreeTodaySection() {
  const t = useT('client');
  const { ready } = useCurrent();
  const q = useApiQuery(clientKeys.catalog(QUERY), () => listCatalog(QUERY), { enabled: ready });
  const skeletonCount = useSkeletonCount('home-free-today', { loading: q.isLoading, count: q.data?.length, fallback: QUERY.limit, max: QUERY.limit });

  return (
    <section data-f="F-00-001 F-00-108" className="flex flex-col gap-3">
      <SectionHeader title={t('home.nearby.title')} href="/search?free=today" linkLabel={t('home.nearby.all')} />
      {q.isLoading ? (
        <ul className="grid gap-3 lg:grid-cols-2" aria-busy="true">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <CatalogEntryCardSkeleton key={i} />
          ))}
        </ul>
      ) : q.isError ? (
        <InlineError onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState
          compact
          icon={<CalendarSearch />}
          title={t('home.nearby.empty')}
          action={
            <LinkButton href="/search?free=tomorrow" variant="secondary" size="sm">
              {t('home.nearby.tomorrow')}
            </LinkButton>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((entry) => (
            <CatalogEntryCard key={entry.staff.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

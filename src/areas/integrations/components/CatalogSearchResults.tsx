'use client';

/** F-13-002: результаты поиска по каталогу — список / пусто / ошибка / загрузка */
import { Puzzle } from 'lucide-react';
import { AppTile } from '@/areas/integrations/components/AppTile';
import type { Id } from '@/domain/core';
import type { CatalogApp, InstallStatus } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';

export function CatalogSearchResults({
  items,
  loading,
  error,
  onRetry,
  statuses,
  onReset,
}: {
  items?: CatalogApp[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  statuses?: Record<Id, InstallStatus>;
  /** QA 30.09: «Ничего не нашли» + «Сбросить», как в списке категории (CONVENTIONS §0.3) */
  onReset?: () => void;
}) {
  const t = useT('integrations');
  if (error) return <ErrorState onRetry={onRetry} />;
  // Скелетон — только пока результатов нет совсем; новый запрос держит прежние карточки (keepPrevious)
  if (loading && !items) return <Skeleton lines={6} />;
  if (!items || items.length === 0) {
    return <EmptyState kind="search" icon={<Puzzle aria-hidden />} title={t('search.emptyTitle')} description={t('search.emptyText')} onReset={onReset} />;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-f="F-13-002">
      {items.map((app) => (
        <AppTile key={app.id} app={app} status={statuses?.[app.id]} />
      ))}
    </ul>
  );
}

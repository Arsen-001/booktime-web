'use client';

/** /biz/stock/inventory — F-08-079, F-08-114: список всех инвентаризаций; «Создать» только с правом. */
import { ChevronRight, ClipboardCheck, Lock } from 'lucide-react';
import { listInventories } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LinkButton } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StatCard } from '@/ui/StatCard';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';

/** Скелетон строки инвентаризации — та же карточка: номер и склад, дата и число товаров, статус, стрелка */
function InventoryRowSkeleton() {
  return (
    <li>
      <Card padding="sm" className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            <SkeletonText width="22ch" />
          </p>
          <p className="text-xs text-muted">
            <SkeletonText width="24ch" />
          </p>
        </div>
        <Badge tone="neutral" size="sm">
          <SkeletonText width="8ch" />
        </Badge>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </Card>
    </li>
  );
}

export function InventoryListScreen() {
  const t = useT('stock');
  const format = useFormat();
  const perm = useStockPermissions();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);
  const q = useApiQuery(['stock', 'inventories', businessId, locationId], () => listInventories(businessId!, locationId!), { enabled: enabled && perm.inventoryView });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);
  // Сколько карточек было в прошлый раз; в демо инвентаризаций обычно нет — тогда при загрузке то же пустое состояние
  const skeletonRows = useSkeletonCount('inventories', { loading: q.isLoading, count: q.data ? pageItems.length : undefined, fallback: 0, max: 10 });

  if (!perm.inventoryView) {
    return (
      <div data-f="F-08-079 F-08-114" className="flex w-full flex-col gap-6">
        <PageHeader title={t('inventory.title')} description={t('inventory.subtitle')} />
        <EmptyState icon={<Lock aria-hidden />} title={t('inventory.noAccessTitle')} description={t('inventory.noAccessText')} />
      </div>
    );
  }

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const items = q.data ?? [];
  const openCount = items.filter((inv) => inv.status === 'draft').length;

  return (
    <div data-f="F-08-079 F-08-114" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('inventory.title')}
        description={t('inventory.subtitle')}
        actions={perm.inventoryCreate ? <LinkButton href="/biz/stock/inventory/new">{t('inventory.create')}</LinkButton> : undefined}
      />

      {q.isLoading && skeletonRows > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard label={t('inventory.stats.total')} value="" icon={<ClipboardCheck aria-hidden />} loading />
            <StatCard label={t('inventory.stats.open')} value="" icon={<Lock aria-hidden />} loading />
          </div>
          <ul className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <InventoryRowSkeleton key={i} />
            ))}
          </ul>
        </>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck aria-hidden />}
          title={t('inventory.emptyTitle')}
          description={t('inventory.emptyText')}
          action={perm.inventoryCreate ? <LinkButton href="/biz/stock/inventory/new">{t('inventory.create')}</LinkButton> : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard label={t('inventory.stats.total')} value={format.number(items.length)} icon={<ClipboardCheck aria-hidden />} />
            <StatCard label={t('inventory.stats.open')} value={format.number(openCount)} icon={<Lock aria-hidden />} />
          </div>
          <ul className="flex flex-col gap-2">
            {pageItems.map((inv) => (
              <li key={inv.id}>
                <Card href={`/biz/stock/inventory/${inv.id}`} padding="sm" className="flex min-h-11 items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">
                      № {inv.number} · {inv.warehouseName}
                      {inv.categoryName ? ` · ${inv.categoryName}` : ''}
                    </p>
                    <p className="text-xs text-muted">
                      {format.date(inv.date, 'short')} {format.time(inv.date)} · {t('inventory.goodsCount', { count: inv.goodsCount })}
                    </p>
                  </div>
                  <Badge tone={inv.status === 'done' ? 'success' : 'neutral'} size="sm">
                    {inv.status === 'done' ? t('inventory.statusDone') : t('inventory.statusDraft')}
                  </Badge>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                </Card>
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}
    </div>
  );
}

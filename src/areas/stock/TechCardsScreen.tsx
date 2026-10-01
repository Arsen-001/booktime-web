'use client';

/**
 * /biz/stock/tech-cards — F-08-036: список технологических карт (услуга × мастер), у каждого мастера
 * услуги — своя техкарта (F-08-039). F-08-002: пустое состояние отличает «нет ни одного прихода
 * расходника» от «приход есть, техкарт ещё нет».
 */
import { useMemo, useState } from 'react';
import { ClipboardList, PackageSearch, Plus } from 'lucide-react';
import { listOperations, listTechCards, listWarehouses } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { Button, LinkButton } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';
import { warehouseNameLabel } from '@/areas/stock/warehouse.utils';

/** Скелетон строки техкарты — та же разметка: услуга, мастер, расходники, плашка с числом строк */
function TechCardRowSkeleton() {
  return (
    <li>
      <span className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">
            <SkeletonText width="20ch" />
          </p>
          <p className="text-xs text-muted">
            <SkeletonText width="14ch" />
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            <SkeletonText width="44ch" />
          </p>
        </div>
        <Badge tone="neutral">
          <SkeletonText width="9.5ch" />
        </Badge>
      </span>
    </li>
  );
}

export function TechCardsScreen() {
  const t = useT('stock');
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);
  const [search, setSearch] = useState('');

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const writeoffWarehouseId = warehousesQ.data?.find((w) => w.type === 'writeoff')?.id;

  const incomeQ = useApiQuery(
    ['stock', 'operations', businessId, locationId, 'income', writeoffWarehouseId],
    () => listOperations(businessId!, locationId!, { type: 'income', warehouseId: writeoffWarehouseId, page: 1, pageSize: 1 }),
    { enabled: enabled && Boolean(writeoffWarehouseId) },
  );
  const hasIncome = (incomeQ.data?.total ?? 0) > 0;

  const cardsQ = useApiQuery(['stock', 'techCards', businessId, locationId], () => listTechCards(businessId!, locationId!), { enabled: enabled && hasIncome });

  // F-08-036: поиск «по названию или комментарию» — у техкарты нет своего названия/комментария (домен: услуга ×
  // мастер), поэтому ищем по названию услуги, имени мастера и названиям расходников в строках (assumed).
  const filteredCards = useMemo(() => {
    const cards = cardsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.serviceName.toLowerCase().includes(q) ||
        c.staffName.toLowerCase().includes(q) ||
        c.lineDetails.some((l) => l.goodName.toLowerCase().includes(q)),
    );
  }, [cardsQ.data, search]);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: cardsPage, pager } = usePagedList(filteredCards, { resetKey: search });

  const skeletonRows = useSkeletonCount('techCards', { loading: !cardsQ.data, count: cardsPage.length, fallback: 6, max: 10 });

  if (warehousesQ.isError) return <ErrorState onRetry={warehousesQ.refetch} />;
  if (incomeQ.isError) return <ErrorState onRetry={incomeQ.refetch} />;
  if (cardsQ.isError) return <ErrorState onRetry={cardsQ.refetch} />;

  const loading = !enabled || warehousesQ.isLoading || (Boolean(writeoffWarehouseId) && incomeQ.isLoading) || (hasIncome && cardsQ.isLoading);

  return (
    <div data-f="F-08-002 F-08-036 F-08-039 F-08-136 F-08-143" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('techCards.title')}
        description={t('techCards.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <HelpArticleButton titleKey="help.techCards.title" bodyKey="help.techCards.body" />
            {/* При загрузке кнопка уже на месте (неактивна) — не появляется из пустоты */}
            {loading ? (
              <Button leftIcon={<Plus className="size-4" aria-hidden />} disabled>
                {t('techCards.addCard')}
              </Button>
            ) : hasIncome && (
              <LinkButton href="/biz/stock/tech-cards/new" leftIcon={<Plus className="size-4" aria-hidden />}>
                {t('techCards.addCard')}
              </LinkButton>
            )}
          </div>
        }
      />
      {(loading || (hasIncome && Boolean(cardsQ.data?.length))) && (
        <FilterBar search={{ value: search, onValueChange: setSearch, placeholder: t('techCards.searchPlaceholder') }} />
      )}
      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <ul className="divide-y divide-border" aria-hidden>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <TechCardRowSkeleton key={i} />
            ))}
          </ul>
        ) : !hasIncome ? (
          <EmptyState
            icon={<PackageSearch aria-hidden />}
            title={t('techCards.emptyNoIncomeTitle')}
            description={t('techCards.emptyNoIncomeText')}
            action={<LinkButton href="/biz/stock/operations">{t('techCards.goToIncome')}</LinkButton>}
          />
        ) : !cardsQ.data?.length ? (
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={t('techCards.emptyReadyTitle')}
            description={t('techCards.emptyReadyText')}
            action={<LinkButton href="/biz/stock/tech-cards/new">{t('techCards.addCard')}</LinkButton>}
          />
        ) : !filteredCards.length ? (
          <EmptyState compact icon={<PackageSearch aria-hidden />} title={t('techCards.searchEmptyTitle')} description={t('techCards.searchEmptyText')} />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {cardsPage.map((c) => (
                <li key={c.id}>
                  <LinkButton
                    href={`/biz/stock/tech-cards/${c.id}`}
                    variant="ghost"
                    className="flex h-auto min-h-11 w-full items-center justify-between gap-3 rounded-none px-4 py-3.5 text-left whitespace-normal md:h-auto"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{c.serviceName || t('techCards.unknownService')}</p>
                      <p className="text-xs text-muted">{c.staffName}</p>
                      {c.lineDetails.length > 0 && (
                        <p className="mt-1 truncate text-xs text-muted">
                          {c.lineDetails
                            .map((l) => t('techCards.lineDetails', { good: l.goodName, warehouse: warehouseNameLabel(l.warehouseName, t), qty: `${l.qtyWriteoff} ${l.unitShort}` }))
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <Badge tone="neutral">{t('techCards.lineCount', { count: c.lineDetails.length })}</Badge>
                  </LinkButton>
                </li>
              ))}
            </ul>
            {pager && <div className="border-t border-border px-4 py-3">{pager}</div>}
          </>
        )}
      </Card>
    </div>
  );
}

'use client';

/**
 * /biz/network/goods — «Товары» сети (F-11-111): первая категория создаётся вручную, дальше — с выбором
 * родительской; поиск товара по названию, штрихкоду или артикулу (по реальному складу филиалов сети).
 */
import { useState } from 'react';
import { Archive, ArrowLeftRight, Boxes, FolderPlus, Package, Plus } from 'lucide-react';
import { addAllGoodsToLocation, archiveNetworkGoods, listNetworkGoodsCategories, listNetworkLocations, searchNetworkGoods } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import type { Id } from '@/domain/core';
import { Button, LinkButton, buttonClasses } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SearchInput } from '@/ui/SearchInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { cn } from '@/lib/cn';
import { useConfirm, useToast } from '@/ui/Toast';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { useNetwork } from '@/areas/network/lib/useNetwork';

const GOOD_ROW = 'flex items-center gap-3 rounded-lg border border-border px-3 py-2';
const GOOD_LINK = 'h-auto min-h-11 flex-1 justify-between gap-3 px-0 py-1.5 text-left md:h-auto';
const CATEGORY_LINK = 'h-auto w-full justify-start rounded-lg border border-border px-3 py-2 text-left text-sm text-fg';

/** Скелетон строки товара — та же разметка: галочка, название и артикул, цена */
function GoodRowSkeleton({ i }: { i: number }) {
  return (
    <li className={GOOD_ROW}>
      <Checkbox checked={false} disabled aria-hidden />
      <span className={cn(buttonClasses({ variant: 'ghost' }), GOOD_LINK)}>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-fg">
            <SkeletonText width={i % 2 ? '14ch' : '20ch'} />
          </span>
          <span className="block truncate text-xs text-muted">
            <SkeletonText width="16ch" />
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-fg">
          <SkeletonText width="7ch" />
        </span>
      </span>
    </li>
  );
}

export function GoodsScreen() {
  const t = useT('network');
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const categoriesQ = useApiQuery(['network', 'goodsCategories', networkId], () => listNetworkGoodsCategories(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const [query, setQuery] = useState('');
  const goodsQ = useApiQuery(['network', 'goods', networkId, query], () => searchNetworkGoods(networkId!, query), {
    enabled: ready && Boolean(networkId),
  });

  const [selected, setSelected] = useState<Id[]>([]);
  const [addAllOpen, setAddAllOpen] = useState(false);
  const [addAllTarget, setAddAllTarget] = useState<Id | ''>('');

  const archiveMutation = useApiMutation((ids: Id[]) => archiveNetworkGoods(networkId!, ids));
  const addAllMutation = useApiMutation((target: Id) => addAllGoodsToLocation(networkId!, target));

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: goodsPage, pager: goodsPager } = usePagedList(goodsQ.data ?? [], { resetKey: query });
  const goodsLoading = !ready || goodsQ.isLoading;
  const goodRows = useSkeletonCount('networkGoods', { loading: goodsLoading, count: goodsQ.data ? goodsPage.length : undefined, fallback: 6, max: 10 });
  const categoryRows = useSkeletonCount('networkGoodsCategories', { loading: categoriesQ.isLoading, count: categoriesQ.data?.length, fallback: 0, max: 20 });

  if (isError || categoriesQ.isError || goodsQ.isError) return <ErrorState onRetry={() => refetch()} />;

  const toggle = (id: Id, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)));
  };

  const archiveSelected = async () => {
    if (!selected.length) return;
    const ok = await confirm({ title: t('goods.archiveSelected'), tone: 'danger' });
    if (!ok) return;
    try {
      await archiveMutation.mutate(selected);
      toast.success(t('goods.archiveDone'));
      setSelected([]);
      goodsQ.refetch();
    } catch {
      toast.error(t('goods.actionFailed'));
    }
  };

  const addAll = async () => {
    if (!addAllTarget) return;
    try {
      const res = await addAllMutation.mutate(addAllTarget);
      toast.success(t('goods.addAllDone', { count: res.added }));
      setAddAllOpen(false);
      setAddAllTarget('');
      goodsQ.refetch();
    } catch {
      toast.error(t('goods.actionFailed'));
    }
  };

  return (
    <div data-f="F-11-111 F-08-128" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('goods.title')}
        description={t('goods.subtitle')}
        actions={
          <NetworkPageActions
            titleKey="help.goods.title"
            bodyKey="help.goods.body"
            extra={
              <LinkButton href="/biz/network/goods/new" size="sm" leftIcon={<Plus aria-hidden />}>
                {t('goods.product.newTitle')}
              </LinkButton>
            }
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/biz/network/goods/migration" variant="secondary" size="sm" leftIcon={<ArrowLeftRight aria-hidden />}>
          {t('goods.openMigration')}
        </LinkButton>
        <LinkButton href="/biz/network/goods/archive" variant="secondary" size="sm" leftIcon={<Archive aria-hidden />}>
          {t('goods.openArchive')}
        </LinkButton>
        <LinkButton href="/biz/network/goods/stock" variant="secondary" size="sm" leftIcon={<Boxes aria-hidden />}>
          {t('goods.openStock')}
        </LinkButton>
        <span data-f="F-11-114">
          <Button variant="secondary" size="sm" onClick={() => setAddAllOpen(true)}>
            {t('goods.addAllToLocation')}
          </Button>
        </span>
      </div>

      <SearchInput value={query} onValueChange={setQuery} placeholder={t('goods.searchPlaceholder')} />

      {selected.length > 0 && (
        <div data-f="F-11-114" className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5">
          <span className="text-sm text-muted">{t('migration.selectedCount', { count: selected.length })}</span>
          <Button size="sm" variant="danger" className="ml-auto" onClick={archiveSelected} loading={archiveMutation.isPending}>
            {t('goods.archiveSelected')}
          </Button>
        </div>
      )}

      {goodsLoading && goodRows > 0 ? (
        <ul aria-hidden className="flex flex-col gap-2">
          {Array.from({ length: goodRows }, (_, i) => (
            <GoodRowSkeleton key={i} i={i} />
          ))}
        </ul>
      ) : !goodsQ.data?.length ? (
        <EmptyState compact kind={query ? 'search' : undefined} onReset={query ? () => setQuery('') : undefined} title={t('goods.searchEmpty')} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {goodsPage.map((g) => (
              <li key={g.id} className={GOOD_ROW}>
                <Checkbox checked={selected.includes(g.id)} onCheckedChange={(checked) => toggle(g.id, checked)} />
                <LinkButton
                  href={`/biz/network/goods/${encodeURIComponent(g.networkGroupId ?? g.id)}`}
                  variant="ghost"
                  className={GOOD_LINK}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">{g.name}</span>
                    <span className="block truncate text-xs text-muted">{[g.sku, g.barcode].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-fg">{format.money(g.salePrice)}</span>
                </LinkButton>
              </li>
            ))}
          </ul>
          {goodsPager}
        </div>
      )}

      <SectionCard
        title={t('goods.categoriesTitle')}
        actions={
          <LinkButton href="/biz/network/goods/categories/new" size="sm" leftIcon={<FolderPlus aria-hidden />}>
            {t('goods.addCategory')}
          </LinkButton>
        }
      >
        {categoriesQ.isLoading && categoryRows > 0 ? (
          <ul aria-hidden className="flex flex-col gap-2">
            {Array.from({ length: categoryRows }, (_, i) => (
              <li key={i}>
                <span className={cn(buttonClasses({ variant: 'ghost' }), CATEGORY_LINK)}>
                  <SkeletonText width={i % 2 ? '12ch' : '16ch'} />
                </span>
              </li>
            ))}
          </ul>
        ) : !categoriesQ.data?.length ? (
          <EmptyState compact icon={<Package aria-hidden />} title={t('goods.noCategories')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {categoriesQ.data.map((c) => (
              <li key={c.id}>
                <LinkButton
                  href={`/biz/network/goods/categories/${encodeURIComponent(c.id)}`}
                  variant="ghost"
                  className={CATEGORY_LINK}
                >
                  {c.name}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div data-f="F-11-115 F-11-119">
        <SectionCard title={t('goods.branchRulesTitle')}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            <li>{t('goods.branchRules.copyToLocations')}</li>
            <li>{t('goods.branchRules.categoryReadonly')}</li>
          </ul>
        </SectionCard>
      </div>

      <Modal
        open={addAllOpen}
        onOpenChange={setAddAllOpen}
        title={t('goods.addAllToLocation')}
        size="sm"
        footer={
          <Button loading={addAllMutation.isPending} onClick={addAll} className="w-full">
            {t('migration.confirmAction')}
          </Button>
        }
      >
        <FormField label={t('goods.product.locationsTitle')}>
          <Select
            options={(locationsQ.data ?? []).map((l) => ({ value: l.business.id, label: l.business.name }))}
            value={addAllTarget}
            onValueChange={(v) => setAddAllTarget(v as Id)}
          />
        </FormField>
      </Modal>
    </div>
  );
}

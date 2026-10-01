'use client';

/**
 * /biz/network/goods/migration — перенос и объединение категорий/товаров филиала с сетевыми (F-11-116, F-11-117).
 */
import { useState } from 'react';
import { Package } from 'lucide-react';
import { listNetworkLocations, mergeGoodIntoNetworkGroup, migrateGoodsToNetwork, searchNetworkGoods } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import type { Id } from '@/domain/core';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';
import { useNetwork } from '@/areas/network/lib/useNetwork';

export function GoodsMigrationScreen() {
  const t = useT('network');
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const [businessId, setBusinessId] = useState<Id | ''>('');
  const goodsQ = useApiQuery(['network', 'goods', networkId, ''], () => searchNetworkGoods(networkId!, ''), { enabled: ready && Boolean(networkId) });
  const [selected, setSelected] = useState<Id[]>([]);
  const [mergeTarget, setMergeTarget] = useState<Id | ''>('');
  const [mergeSource, setMergeSource] = useState<Id | ''>('');

  const moveMutation = useApiMutation((ids: Id[] | 'all') => migrateGoodsToNetwork(networkId!, businessId as Id, ids));
  const mergeMutation = useApiMutation((input: { local: Id; target: Id }) => mergeGoodIntoNetworkGroup(networkId!, input.local, input.target));

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: branchGoodsPage, pager } = usePagedList((goodsQ.data ?? []).filter((g) => g.businessId === businessId), { resetKey: businessId });

  if (isError || goodsQ.isError || locationsQ.isError) return <ErrorState onRetry={() => refetch()} />;

  const locations = locationsQ.data ?? [];
  const branchGoods = (goodsQ.data ?? []).filter((g) => g.businessId === businessId);
  const networkGoods = (goodsQ.data ?? []).filter((g) => g.isNetworkSource);

  const toggle = (id: Id, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)));
  };

  const moveAll = async () => {
    if (!businessId) return;
    const ok = await confirm({ title: t('goods.migration.moveConfirmTitle'), description: t('goods.migration.moveConfirmBody') });
    if (!ok) return;
    try {
      const res = await moveMutation.mutate('all');
      toast.success(t('goods.migration.moveDone', { count: res.moved }));
      goodsQ.refetch();
    } catch {
      toast.error(t('goods.migration.actionFailed'));
    }
  };

  const moveSelected = async () => {
    if (!businessId || !selected.length) return;
    const ok = await confirm({ title: t('goods.migration.moveConfirmTitle'), description: t('goods.migration.moveConfirmBody') });
    if (!ok) return;
    try {
      const res = await moveMutation.mutate(selected);
      toast.success(t('goods.migration.moveDone', { count: res.moved }));
      setSelected([]);
      goodsQ.refetch();
    } catch {
      toast.error(t('goods.migration.actionFailed'));
    }
  };

  const mergeAction = async () => {
    if (!mergeSource || !mergeTarget) return;
    const ok = await confirm({ title: t('goods.migration.mergeConfirmTitle'), description: t('goods.migration.mergeConfirmBody'), tone: 'danger' });
    if (!ok) return;
    try {
      await mergeMutation.mutate({ local: mergeSource as Id, target: mergeTarget as Id });
      toast.success(t('goods.migration.mergeDone'));
      setMergeSource('');
      setMergeTarget('');
      goodsQ.refetch();
    } catch {
      toast.error(t('goods.migration.actionFailed'));
    }
  };

  return (
    <div data-f="F-11-116 F-08-131" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('goods.migration.title')} description={t('goods.migration.subtitle')} />
      <LinkButton href="/biz/network/goods" variant="ghost" size="sm" className="w-fit">
        ← {t('goods.title')}
      </LinkButton>

      <SectionCard title={t('goods.migration.sourceLabel')}>
        <Select
          options={locations.map((l) => ({ value: l.business.id, label: l.business.name }))}
          value={businessId}
          onValueChange={(v) => {
            setBusinessId(v as Id);
            setSelected([]);
          }}
          placeholder={t('goods.migration.sourceLabel')}
        />
      </SectionCard>

      {!businessId ? null : !ready || goodsQ.isLoading ? (
        <Skeleton lines={4} />
      ) : !branchGoods.length ? (
        <EmptyState compact icon={<Package aria-hidden />} title={t('goods.migration.empty')} />
      ) : (
        <SectionCard
          title={t('goods.title')}
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={moveAll} loading={moveMutation.isPending}>
                {t('goods.migration.moveAll')}
              </Button>
              <Button size="sm" variant="secondary" disabled={!selected.length} onClick={moveSelected} loading={moveMutation.isPending}>
                {t('goods.migration.moveSelected')}
              </Button>
            </div>
          }
        >
          <ul className="flex flex-col gap-1.5">
            {branchGoodsPage.map((g) => (
              <li key={g.id}>
                <Checkbox
                  checked={selected.includes(g.id)}
                  onCheckedChange={(checked) => toggle(g.id, checked)}
                  label={`${g.name} — ${format.money(g.salePrice)}`}
                />
              </li>
            ))}
          </ul>
          {pager && <div className="mt-4">{pager}</div>}
        </SectionCard>
      )}

      <SectionCard title={t('goods.migration.mergeTitle')}>
        <div className="flex flex-col gap-3" data-f="F-11-117 F-08-132">
          <Select
            options={(goodsQ.data ?? []).filter((g) => !g.networkGroupId).map((g) => ({ value: g.id, label: g.name }))}
            value={mergeSource}
            onValueChange={(v) => setMergeSource(v as Id)}
            placeholder={t('goods.migration.mergeSourceLabel')}
          />
          <Select
            options={networkGoods.map((g) => ({ value: g.id, label: g.name }))}
            value={mergeTarget}
            onValueChange={(v) => setMergeTarget(v as Id)}
            placeholder={t('goods.migration.mergeTargetLabel')}
          />
          <Button variant="secondary" disabled={!mergeSource || !mergeTarget} onClick={mergeAction} loading={mergeMutation.isPending}>
            {t('goods.migration.mergeTitle')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

'use client';

/**
 * /biz/network/goods/categories/[categoryId] — форма сетевой категории товаров (F-11-112).
 */
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getNetworkGoodsCategoryDetail, listNetworkGoodsCategories, listNetworkLocations, saveNetworkGoodsCategory } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { LocationsPicker } from '@/areas/network/lib/LocationsPicker';
import { useNetwork } from '@/areas/network/lib/useNetwork';

export function GoodsCategoryFormScreen() {
  const t = useT('network');
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ categoryId: string }>();
  const isNew = params.categoryId === 'new';
  const id = isNew ? undefined : decodeURIComponent(params.categoryId);
  const { ready, networkId, isError, refetch } = useNetwork();

  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const categoriesQ = useApiQuery(['network', 'goodsCategories', networkId], () => listNetworkGoodsCategories(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const detailQ = useApiQuery(['network', 'goodsCategory', networkId, id], () => getNetworkGoodsCategoryDetail(networkId!, id!), {
    enabled: ready && Boolean(networkId) && !isNew,
  });

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [filled, setFilled] = useState(false);

  if (detailQ.data && !filled) {
    setName(detailQ.data.name);
    setParentId(detailQ.data.parentId ?? '');
    setBusinessIds(detailQ.data.businessIds);
    setFilled(true);
  }

  const mutation = useApiMutation((_: void) =>
    saveNetworkGoodsCategory(networkId!, { id, name: name.trim(), parentId: parentId || undefined, businessIds }),
  );

  if (isError || detailQ.isError) return <ErrorState onRetry={() => (isError ? refetch() : detailQ.refetch())} />;

  const loading = !ready || locationsQ.isLoading || categoriesQ.isLoading || (!isNew && detailQ.isLoading);

  const save = async () => {
    if (!name.trim()) {
      setError(t('goods.category.nameRequired'));
      return;
    }
    try {
      await mutation.mutate();
      toast.success(t('goods.category.saved'));
      router.push('/biz/network/goods');
    } catch {
      toast.error(t('goods.category.saveFailed'));
    }
  };

  return (
    <div data-f="F-11-112 F-08-129" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={isNew ? t('goods.category.newTitle') : t('goods.category.editTitle')} />
      {loading ? (
        <Skeleton lines={5} />
      ) : (
        <>
          <SectionCard title={t('goods.category.nameLabel')}>
            <div className="flex flex-col gap-4">
              <FormField label={t('goods.category.nameLabel')} required error={error}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </FormField>
              <FormField label={t('goods.category.parentLabel')} optional>
                <Select
                  options={[
                    { value: '', label: t('goods.category.noParent') },
                    ...(categoriesQ.data ?? []).filter((c) => c.id !== id).map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={parentId}
                  onValueChange={setParentId}
                />
              </FormField>
            </div>
          </SectionCard>
          <SectionCard title={t('goods.category.locationsTitle')}>
            <LocationsPicker locations={locationsQ.data ?? []} value={businessIds} onChange={setBusinessIds} />
          </SectionCard>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              {t('goods.category.cancel')}
            </Button>
            <Button loading={mutation.isPending} onClick={save}>
              {t('goods.category.save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

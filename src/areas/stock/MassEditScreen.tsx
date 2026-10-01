'use client';

/**
 * /biz/stock/mass-edit — «Быстрое управление» (F-08-031): артикул, штрихкод, цена продажи, себестоимость,
 * масса нетто/брутто многих товаров в одной таблице, сохраняются вместе.
 */
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ListChecks, Save } from 'lucide-react';
import { listCategoriesFlat, listMassEditGoods, saveMassEdit, type MassEditRow } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function MassEditScreen() {
  const t = useT('stock');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '');

  const categoriesQ = useApiQuery(['stock', 'categoriesFlat', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled });
  const goodsQ = useApiQuery(['stock', 'massEditGoods', businessId, locationId, categoryId], () => listMassEditGoods(businessId!, locationId!, categoryId || undefined), { enabled });

  const categoryOptions = useMemo(
    () => [{ value: '', label: t('massEdit.allCategories') }, ...(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))],
    [categoriesQ.data, t],
  );

  if (goodsQ.isError) return <ErrorState onRetry={goodsQ.refetch} />;

  return (
    <div data-f="F-08-031 F-08-143 F-08-145" className="flex w-full flex-col gap-6 pb-24">
      <PageHeader
        title={t('massEdit.title')}
        description={t('massEdit.subtitle')}
        actions={<Button variant="secondary" onClick={() => router.push('/biz/stock')}>{t('massEdit.back')}</Button>}
      />

      <div className="max-w-xs">
        <Select value={categoryId} onValueChange={setCategoryId} options={categoryOptions} />
      </div>

      {goodsQ.isLoading || !businessId ? (
        <Skeleton lines={6} />
      ) : (
        // key=categoryId: смена категории — новая таблица с чистым состоянием правок (без useEffect-синка)
        <MassEditTable key={categoryId} businessId={businessId} initialRows={goodsQ.data ?? []} />
      )}
    </div>
  );
}

function MassEditTable({ businessId, initialRows }: { businessId: Id; initialRows: MassEditRow[] }) {
  const t = useT('stock');
  const toast = useToast();
  const [rows, setRows] = useState(initialRows);
  const [dirty, setDirty] = useState(false);
  const saveMutation = useApiMutation((r: MassEditRow[]) => saveMassEdit(businessId, r));
  // Постранично, как во всех списках (DESIGN.md → Long lists); правки всех страниц живут в rows и сохраняются вместе
  const { pageItems, pager } = usePagedList(rows);

  const patch = (id: string, field: keyof MassEditRow, value: string) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'sku' || field === 'barcode') return { ...r, [field]: value };
        return { ...r, [field]: Number(value) || 0 };
      }),
    );
  };

  const save = async () => {
    try {
      const count = await saveMutation.mutate(rows);
      toast.success(count > 0 ? t('massEdit.saved', { count }) : t('massEdit.nothingChanged'));
      setDirty(false);
    } catch {
      toast.error(t('massEdit.saveFailed'));
    }
  };

  if (rows.length === 0) {
    return <EmptyState icon={<ListChecks aria-hidden />} title={t('massEdit.emptyTitle')} description={t('massEdit.emptyText')} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* F-08-031: на телефоне (390×844) таблица с 7 колонками не помещается — карточка на товар вместо
          обрезанной по бокам таблицы (CONVENTIONS §0 «Телефон — первым»). */}
      <div className="flex flex-col gap-3 sm:hidden">
        {pageItems.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <p className="truncate text-sm font-medium text-fg">{r.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('massEdit.columns.sku')}
                <Input value={r.sku ?? ''} onChange={(e) => patch(r.id, 'sku', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('massEdit.columns.barcode')}
                <Input value={r.barcode ?? ''} onChange={(e) => patch(r.id, 'barcode', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('massEdit.columns.salePrice')}
                <Input type="number" min={0} value={String(r.salePrice)} onChange={(e) => patch(r.id, 'salePrice', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('massEdit.columns.costPrice')}
                <Input type="number" min={0} value={String(r.costPrice)} onChange={(e) => patch(r.id, 'costPrice', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('massEdit.columns.massNet')}
                <Input type="number" min={0} value={String(r.massNetG ?? '')} onChange={(e) => patch(r.id, 'massNetG', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('massEdit.columns.massGross')}
                <Input type="number" min={0} value={String(r.massGrossG ?? '')} onChange={(e) => patch(r.id, 'massGrossG', e.target.value)} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface sm:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="p-3 font-medium">{t('massEdit.columns.name')}</th>
              <th className="p-3 font-medium">{t('massEdit.columns.sku')}</th>
              <th className="p-3 font-medium">{t('massEdit.columns.barcode')}</th>
              <th className="p-3 text-right font-medium">{t('massEdit.columns.salePrice')}</th>
              <th className="p-3 text-right font-medium">{t('massEdit.columns.costPrice')}</th>
              <th className="p-3 text-right font-medium">{t('massEdit.columns.massNet')}</th>
              <th className="p-3 text-right font-medium">{t('massEdit.columns.massGross')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="max-w-[16rem] truncate p-2 text-fg">{r.name}</td>
                <td className="p-2"><Input value={r.sku ?? ''} onChange={(e) => patch(r.id, 'sku', e.target.value)} className="min-w-24" /></td>
                <td className="p-2"><Input value={r.barcode ?? ''} onChange={(e) => patch(r.id, 'barcode', e.target.value)} className="min-w-28" /></td>
                <td className="p-2"><Input type="number" min={0} value={String(r.salePrice)} onChange={(e) => patch(r.id, 'salePrice', e.target.value)} className="min-w-20 text-right" /></td>
                <td className="p-2"><Input type="number" min={0} value={String(r.costPrice)} onChange={(e) => patch(r.id, 'costPrice', e.target.value)} className="min-w-20 text-right" /></td>
                <td className="p-2"><Input type="number" min={0} value={String(r.massNetG ?? '')} onChange={(e) => patch(r.id, 'massNetG', e.target.value)} className="min-w-16 text-right" /></td>
                <td className="p-2"><Input type="number" min={0} value={String(r.massGrossG ?? '')} onChange={(e) => patch(r.id, 'massGrossG', e.target.value)} className="min-w-16 text-right" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager}
      <Button leftIcon={<Save aria-hidden />} onClick={save} loading={saveMutation.isPending} disabled={!dirty} className="self-end">
        {t('massEdit.save')}
      </Button>
    </div>
  );
}

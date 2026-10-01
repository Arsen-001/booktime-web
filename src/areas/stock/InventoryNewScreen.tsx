'use client';

/** /biz/stock/inventory/new — F-08-080/081: параметры новой инвентаризации + файл со штрихкодами. */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInventory, listCategoriesFlat, listWarehouses } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { warehouseLabel } from '@/areas/stock/warehouse.utils';
import { readTextFile } from '@/lib/csv';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function InventoryNewScreen() {
  const t = useT('stock');
  const toast = useToast();
  const router = useRouter();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [comment, setComment] = useState('');
  const [useBarcodeFile, setUseBarcodeFile] = useState(false);
  const [missingBehavior, setMissingBehavior] = useState<'zero' | 'calc'>('zero');
  const [fileName, setFileName] = useState('');
  const [barcodeCounts, setBarcodeCounts] = useState<Record<string, number> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const categoriesQ = useApiQuery(['stock', 'categoriesFlat', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled });
  const mutation = useApiMutation((input: Parameters<typeof createInventory>[2]) => createInventory(businessId!, locationId!, input));

  const warehouses = warehousesQ.data ?? [];
  if (warehouseId === '' && warehouses.length) setWarehouseId(warehouses[0].id);

  const onFile = async (file: File) => {
    const text = await readTextFile(file);
    const codes = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const counts: Record<string, number> = {};
    codes.forEach((c) => {
      counts[c] = (counts[c] ?? 0) + 1;
    });
    setBarcodeCounts(counts);
    setFileName(file.name);
  };

  const start = async () => {
    if (!warehouseId) return;
    try {
      const inv = await mutation.mutate({
        warehouseId,
        categoryId: categoryId || undefined,
        comment: comment || undefined,
        barcodeCounts: useBarcodeFile && barcodeCounts ? barcodeCounts : undefined,
        missingBehavior,
      });
      toast.success(t('inventoryNew.created'));
      router.push(`/biz/stock/inventory/${inv.id}`);
    } catch {
      toast.error(t('inventoryNew.createFailed'));
    }
  };

  if (warehousesQ.isError) return <ErrorState onRetry={warehousesQ.refetch} />;
  if (!enabled || warehousesQ.isLoading || categoriesQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={6} />
      </div>
    );
  }
  if (warehouses.length === 0) {
    return <EmptyState title={t('operationForm.noWarehousesTitle')} description={t('operationForm.noWarehousesText')} />;
  }

  return (
    <div data-f="F-08-080 F-08-081" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28">
      <PageHeader title={t('inventoryNew.title')} back={{ href: '/biz/stock/inventory' }} />

      <SectionCard title={t('inventoryNew.section')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('operationForm.warehouse')}>
            <Select options={warehouses.map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))} value={warehouseId} onValueChange={setWarehouseId} />
          </FormField>
          <FormField label={t('inventoryNew.category')}>
            <Select
              options={[{ value: '', label: t('inventoryNew.allCategories') }, ...(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              value={categoryId}
              onValueChange={setCategoryId}
            />
          </FormField>
          <FormField label={t('operationForm.section.comment')} optional>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </FormField>

          <label className="flex min-h-11 items-center gap-3">
            <Checkbox checked={useBarcodeFile} onCheckedChange={setUseBarcodeFile} />
            <span className="text-sm text-fg">{t('inventoryNew.useBarcodeFile')}</span>
          </label>

          {useBarcodeFile && (
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
              <FormField label={t('inventoryNew.missingBehavior')}>
                <ChoiceGroup
                  options={[
                    { value: 'zero', title: t('inventoryNew.missingZero') },
                    { value: 'calc', title: t('inventoryNew.missingCalc') },
                  ]}
                  value={missingBehavior}
                  onValueChange={(v) => setMissingBehavior(v as 'zero' | 'calc')}
                  columns={1}
                />
              </FormField>
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                {fileName || t('inventoryNew.chooseFile')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}
        </div>
      </SectionCard>

      <StickyActionBar>
        <Button onClick={start} loading={mutation.isPending} disabled={!warehouseId}>
          {t('inventoryNew.start')}
        </Button>
      </StickyActionBar>
    </div>
  );
}

'use client';

/**
 * /biz/stock/tech-cards/new и /biz/stock/tech-cards/[cardId] — F-08-037…039: форма техкарты — услуга,
 * мастер (у каждого мастера своя карта), строки «расходник × количество в единице списания».
 */
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteTechCard, getTechCard, listGoods, listWarehouses, saveTechCard, type GoodRow } from '@/api/stock';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { type TechCardLine } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { GoodPicker } from '@/areas/stock/GoodPicker';
import { warehouseLabel, useUnitShort } from '@/areas/stock/warehouse.utils';

interface LineDraft {
  good: GoodRow;
  warehouseId: Id;
  qtyWriteoff: number;
}

export function TechCardFormScreen({ cardId }: { cardId?: Id }) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const toast = useToast();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [serviceId, setServiceId] = useState(searchParams.get('serviceId') ?? '');
  const [staffId, setStaffId] = useState(searchParams.get('staffId') ?? '');
  const [lines, setLines] = useState<LineDraft[] | null>(null);
  const [touched, setTouched] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cardQ = useApiQuery(['stock', 'techCard', businessId, cardId], () => getTechCard(businessId!, cardId!), { enabled: enabled && Boolean(cardId) });
  const servicesQ = useCoreList('services', { businessId: businessId ?? '' }, { enabled });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled });
  const goodsForLinesQ = useApiQuery(
    ['stock', 'goods', businessId, locationId, 'techcard-lines'],
    () => listGoods(businessId!, locationId!, { pageSize: 1000 }),
    { enabled },
  );
  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const defaultWarehouseId = warehousesQ.data?.find((w) => w.type === 'writeoff')?.id ?? warehousesQ.data?.[0]?.id ?? '';

  const save = useApiMutation((input: Parameters<typeof saveTechCard>[2]) => saveTechCard(businessId!, locationId!, input));
  const remove = useApiMutation(() => deleteTechCard(businessId!, cardId!));

  const isNew = !cardId;
  const currentServiceId = isNew ? serviceId : cardQ.data?.serviceId ?? '';
  const currentStaffId = isNew ? staffId : cardQ.data?.staffId ?? '';

  const goodsById = useMemo(() => new Map((goodsForLinesQ.data?.items ?? []).map((g) => [g.id, g])), [goodsForLinesQ.data]);
  const effectiveLines: LineDraft[] =
    lines ??
    (cardQ.data?.lineDetails ?? []).map((l) => ({
      good: goodsById.get(l.goodId) ?? ({ id: l.goodId, name: l.goodName, saleUnit: 'pcs', writeoffUnit: 'pcs' } as GoodRow),
      warehouseId: l.warehouseId ?? defaultWarehouseId,
      qtyWriteoff: l.qtyWriteoff,
    }));

  const addLine = (good: GoodRow) => {
    if (effectiveLines.some((l) => l.good.id === good.id)) return;
    setLines([...(lines ?? effectiveLines), { good, warehouseId: defaultWarehouseId, qtyWriteoff: 1 }]);
  };
  const removeLine = (goodId: Id) => setLines((lines ?? effectiveLines).filter((l) => l.good.id !== goodId));
  const patchLine = (goodId: Id, patch: Partial<Pick<LineDraft, 'qtyWriteoff' | 'warehouseId'>>) =>
    setLines((lines ?? effectiveLines).map((l) => (l.good.id === goodId ? { ...l, ...patch } : l)));

  const serviceError = touched && !currentServiceId ? t('techCardForm.serviceRequired') : undefined;
  const staffError = touched && !currentStaffId ? t('techCardForm.staffRequired') : undefined;
  const linesError = touched && effectiveLines.length === 0 ? t('techCardForm.linesRequired') : undefined;

  const doSave = async () => {
    setTouched(true);
    if (!currentServiceId || !currentStaffId || !effectiveLines.length) return;
    const payload: TechCardLine[] = effectiveLines.map((l) => ({ goodId: l.good.id, warehouseId: l.warehouseId || defaultWarehouseId, qtyWriteoff: l.qtyWriteoff }));
    try {
      await save.mutate({ serviceId: currentServiceId, staffId: currentStaffId, lines: payload });
      toast.success(t('techCardForm.saved'));
      router.push('/biz/stock/tech-cards');
    } catch {
      toast.error(t('techCardForm.saveFailed'));
    }
  };

  const doDelete = async () => {
    try {
      await remove.mutate(undefined);
      toast.success(t('techCardForm.deleted'));
      router.push('/biz/stock/tech-cards');
    } catch {
      toast.error(t('techCardForm.deleteFailed'));
    }
  };

  if (cardQ.isError || goodsForLinesQ.isError || warehousesQ.isError) return <ErrorState onRetry={() => { cardQ.refetch(); goodsForLinesQ.refetch(); warehousesQ.refetch(); }} />;
  if (!enabled || (cardId && cardQ.isLoading) || servicesQ.isLoading || staffQ.isLoading || goodsForLinesQ.isLoading || warehousesQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (cardId && !cardQ.data) {
    return <EmptyState title={t('techCardForm.notFound')} />;
  }

  const services = servicesQ.data ?? [];
  const staff = staffQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];

  return (
    <div data-f="F-08-037 F-08-038 F-08-039 F-00-136" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28">
      <PageHeader title={isNew ? t('techCardForm.title') : t('techCardForm.editTitle')} back={{ href: '/biz/stock/tech-cards' }} />

      <SectionCard title={t('operationForm.section.general')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('techCardForm.service')} error={serviceError}>
            <Select
              options={services.map((s) => ({ value: s.id, label: pickText(s.name, locale) }))}
              value={currentServiceId}
              onValueChange={setServiceId}
              disabled={!isNew}
              placeholder={t('techCardForm.servicePlaceholder')}
            />
          </FormField>
          <FormField label={t('techCardForm.staff')} error={staffError} hint={t('techCardForm.staffHint')}>
            <Select
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              value={currentStaffId}
              onValueChange={setStaffId}
              disabled={!isNew}
              placeholder={t('techCardForm.staffPlaceholder')}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('techCardForm.linesTitle')}>
        <div className="flex flex-col gap-4">
          {businessId && locationId && (
            <GoodPicker businessId={businessId} locationId={locationId} excludeIds={effectiveLines.map((l) => l.good.id)} onAdd={addLine} />
          )}
          {linesError && <p className="text-sm text-danger">{linesError}</p>}
          {effectiveLines.length === 0 ? (
            <EmptyState compact title={t('techCardForm.noLines')} description={t('techCardForm.noLinesText')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {effectiveLines.map((l, i) => (
                <li key={l.good.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex-1 text-sm font-medium text-fg">
                    {i + 1}. {l.good.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      options={warehouses.map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))}
                      value={l.warehouseId}
                      onValueChange={(warehouseId) => patchLine(l.good.id, { warehouseId })}
                      placeholder={t('techCardForm.warehousePlaceholder')}
                      className="w-36"
                      aria-label={t('techCardForm.warehouse')}
                    />
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={l.qtyWriteoff}
                      onChange={(e) => patchLine(l.good.id, { qtyWriteoff: Number(e.target.value) || 0 })}
                      className="w-20"
                      aria-label={t('techCardForm.qty')}
                    />
                    <span className="w-12 text-xs text-muted">{unitShort(l.good.writeoffUnit)}</span>
                    <button type="button" onClick={() => removeLine(l.good.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-danger hover:bg-danger/10" aria-label={t('operationForm.removeLine')}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <StickyActionBar>
        {!isNew && (
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            {t('techCardForm.delete')}
          </Button>
        )}
        <Button onClick={doSave} loading={save.isPending}>
          {t('techCardForm.save')}
        </Button>
      </StickyActionBar>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={t('techCardForm.deleteConfirmTitle')}
        description={t('techCardForm.deleteConfirmText')}
        confirmLabel={t('techCardForm.delete')}
        onConfirm={doDelete}
      />
    </div>
  );
}

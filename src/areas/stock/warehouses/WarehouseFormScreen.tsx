'use client';

/** /biz/stock/warehouses/new и /[warehouseId] — форма склада (F-08-007, F-08-008, F-08-009). */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { createWarehouse, deleteWarehouse, getWarehouse, updateWarehouse, type WarehouseInput } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { WarehouseType } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export function WarehouseFormScreen({ warehouseId }: { warehouseId?: Id }) {
  const t = useT('stock');
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const isEdit = Boolean(warehouseId);
  const [deleted, setDeleted] = useState(false);

  const existingQ = useApiQuery(['stock', 'warehouse', businessId, warehouseId], () => getWarehouse(businessId!, warehouseId!), {
    enabled: ready && Boolean(businessId) && isEdit && !deleted,
  });

  if (isEdit && existingQ.isError) return <ErrorState onRetry={existingQ.refetch} />;
  if (!ready || (isEdit && existingQ.isLoading)) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={6} />
      </div>
    );
  }
  if (isEdit && !existingQ.data) return <EmptyState icon={<WarehouseIcon aria-hidden />} title={t('warehouseForm.notFound')} />;

  return (
    <WarehouseFormBody
      key={warehouseId ?? 'new'}
      warehouseId={warehouseId}
      businessId={businessId!}
      locationId={locationId!}
      initial={existingQ.data}
      onDeleted={() => setDeleted(true)}
    />
  );
}

function WarehouseFormBody({
  warehouseId,
  businessId,
  locationId,
  initial,
  onDeleted,
}: {
  warehouseId?: Id;
  businessId: Id;
  locationId: Id;
  initial?: { name: string; type: WarehouseType; comment?: string };
  onDeleted: () => void;
}) {
  const t = useT('stock');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEdit = Boolean(warehouseId);

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<WarehouseType>(initial?.type ?? 'writeoff');
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [touched, setTouched] = useState(false);

  const createMutation = useApiMutation((input: WarehouseInput) => createWarehouse(businessId, locationId, input));
  const updateMutation = useApiMutation((input: WarehouseInput) => updateWarehouse(businessId, warehouseId!, input));
  const saving = createMutation.isPending || updateMutation.isPending;

  const nameError = touched && !name.trim() ? t('warehouseForm.nameRequired') : undefined;

  const save = async () => {
    setTouched(true);
    if (!name.trim()) return;
    const input: WarehouseInput = { name, type, comment: comment || undefined };
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('warehouseForm.saved'));
      } else {
        await createMutation.mutate(input);
        toast.success(t('warehouseForm.created'));
        router.push('/biz/stock/warehouses');
      }
    } catch {
      toast.error(t('warehouseForm.saveFailed'));
    }
  };

  const remove = async () => {
    if (!warehouseId) return;
    const ok = await confirm({ title: t('warehouseForm.deleteConfirmTitle'), description: t('warehouseForm.deleteConfirmText'), tone: 'danger', confirmLabel: t('warehouseForm.delete') });
    if (!ok) return;
    onDeleted();
    try {
      await deleteWarehouse(businessId, warehouseId);
      toast.success(t('warehouseForm.deleted'));
      router.push('/biz/stock/warehouses');
    } catch {
      toast.error(t('warehouseForm.deleteFailedHasStock'));
    }
  };

  return (
    <div data-f="F-08-007 F-08-008 F-08-009" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={isEdit ? t('warehouseForm.editTitle') : t('warehouseForm.title')} back={{ href: '/biz/stock/warehouses' }} />

      <SectionCard title={t('warehouseForm.section')}>
        <div className="flex flex-col gap-5">
          <FormField label={t('warehouseForm.name')} required error={nameError}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('warehouseForm.namePlaceholder')} autoFocus />
          </FormField>
          <FormField label={t('warehouseForm.type')} hint={t('warehouseForm.typeHint')}>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as WarehouseType)}
              options={[
                { value: 'writeoff', label: t('warehouseForm.typeWriteoff') },
                { value: 'sale', label: t('warehouseForm.typeSale') },
              ]}
            />
          </FormField>
          <FormField label={t('warehouseForm.comment')}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t('warehouseForm.commentPlaceholder')} />
          </FormField>
        </div>
      </SectionCard>

      <StickyActionBar>
        {isEdit && (
          <Button variant="danger" onClick={remove}>
            {t('warehouseForm.delete')}
          </Button>
        )}
        <Button onClick={save} loading={saving}>
          {t('warehouseForm.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}

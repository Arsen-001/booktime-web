'use client';

/** /biz/stock/equipment/new и /[itemId] — форма оборудования (⭐ F-00-141). */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { createEquipment, deleteEquipment, getEquipment, updateEquipment, type EquipmentInput } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export function EquipmentFormScreen({ itemId }: { itemId?: Id }) {
  const t = useT('stock');
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const isEdit = Boolean(itemId);
  const [deleted, setDeleted] = useState(false);

  const existingQ = useApiQuery(['stock', 'equipmentItem', businessId, itemId], () => getEquipment(businessId!, itemId!), { enabled: ready && Boolean(businessId) && isEdit && !deleted });

  if (isEdit && existingQ.isError) return <ErrorState onRetry={existingQ.refetch} />;
  if (!ready || (isEdit && existingQ.isLoading)) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={6} />
      </div>
    );
  }
  if (isEdit && !existingQ.data) return <EmptyState icon={<Wrench aria-hidden />} title={t('equipmentForm.notFound')} />;

  return <EquipmentFormBody key={itemId ?? 'new'} itemId={itemId} businessId={businessId!} locationId={locationId!} initial={existingQ.data} onDeleted={() => setDeleted(true)} />;
}

function EquipmentFormBody({
  itemId,
  businessId,
  locationId,
  initial,
  onDeleted,
}: {
  itemId?: Id;
  businessId: Id;
  locationId: Id;
  initial?: EquipmentInput & { name: string };
  onDeleted: () => void;
}) {
  const t = useT('stock');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEdit = Boolean(itemId);

  const [form, setForm] = useState<EquipmentInput>(() => ({
    name: initial?.name ?? '',
    category: initial?.category,
    purchaseDate: initial?.purchaseDate ?? '',
    warrantyUntil: initial?.warrantyUntil,
    serviceIntervalMonths: initial?.serviceIntervalMonths,
    lastServiceDate: initial?.lastServiceDate,
    replaceReminderDate: initial?.replaceReminderDate,
    comment: initial?.comment,
  }));
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof EquipmentInput>(key: K, value: EquipmentInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const createMutation = useApiMutation((input: EquipmentInput) => createEquipment(businessId, locationId, input));
  const updateMutation = useApiMutation((input: EquipmentInput) => updateEquipment(businessId, itemId!, input));
  const saving = createMutation.isPending || updateMutation.isPending;

  const nameError = touched && !form.name.trim() ? t('equipmentForm.nameRequired') : undefined;
  const dateError = touched && !form.purchaseDate ? t('equipmentForm.purchaseDateRequired') : undefined;

  const save = async () => {
    setTouched(true);
    if (!form.name.trim() || !form.purchaseDate) return;
    try {
      if (isEdit) {
        await updateMutation.mutate(form);
        toast.success(t('equipmentForm.saved'));
      } else {
        await createMutation.mutate(form);
        toast.success(t('equipmentForm.created'));
        router.push('/biz/stock/equipment');
      }
    } catch {
      toast.error(t('equipmentForm.saveFailed'));
    }
  };

  const remove = async () => {
    if (!itemId) return;
    const ok = await confirm({ title: t('equipmentForm.deleteConfirmTitle'), tone: 'danger', confirmLabel: t('equipmentForm.delete') });
    if (!ok) return;
    onDeleted();
    try {
      await deleteEquipment(businessId, itemId);
      toast.success(t('equipmentForm.deleted'));
      router.push('/biz/stock/equipment');
    } catch {
      toast.error(t('equipmentForm.deleteFailed'));
    }
  };

  return (
    <div data-f="F-00-141" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={isEdit ? form.name || t('equipmentForm.editTitle') : t('equipmentForm.title')} back={{ href: '/biz/stock/equipment' }} />

      <SectionCard title={t('equipmentForm.section.general')}>
        <div className="flex flex-col gap-5">
          <FormField label={t('equipmentForm.name')} required error={nameError}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </FormField>
          <FormField label={t('equipmentForm.category')} optional>
            <Input value={form.category ?? ''} onChange={(e) => set('category', e.target.value || undefined)} placeholder={t('equipmentForm.categoryPlaceholder')} />
          </FormField>
          <FormField label={t('equipmentForm.purchaseDate')} required error={dateError}>
            <DatePicker value={form.purchaseDate || null} onValueChange={(v) => set('purchaseDate', v ?? '')} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('equipmentForm.section.warranty')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('equipmentForm.warrantyUntil')} optional>
            <DatePicker value={form.warrantyUntil ?? null} onValueChange={(v) => set('warrantyUntil', v ?? undefined)} clearable />
          </FormField>
          <FormField label={t('equipmentForm.serviceInterval')} optional>
            <Input type="number" min={0} value={form.serviceIntervalMonths ?? ''} onChange={(e) => set('serviceIntervalMonths', e.target.value === '' ? undefined : Number(e.target.value))} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('equipmentForm.section.replace')} description={t('equipmentForm.replaceHint')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('equipmentForm.lastServiceDate')} optional>
            <DatePicker value={form.lastServiceDate ?? null} onValueChange={(v) => set('lastServiceDate', v ?? undefined)} clearable />
          </FormField>
          <FormField label={t('equipmentForm.replaceReminderDate')} optional>
            <DatePicker value={form.replaceReminderDate ?? null} onValueChange={(v) => set('replaceReminderDate', v ?? undefined)} clearable />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('equipmentForm.section.comment')}>
        <Textarea value={form.comment ?? ''} onChange={(e) => set('comment', e.target.value || undefined)} rows={3} />
      </SectionCard>

      <StickyActionBar>
        {isEdit && (
          <Button variant="danger" onClick={remove}>
            {t('equipmentForm.delete')}
          </Button>
        )}
        <Button onClick={save} loading={saving}>
          {t('equipmentForm.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}

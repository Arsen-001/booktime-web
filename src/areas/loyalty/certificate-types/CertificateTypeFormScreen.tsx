'use client';

/**
 * /biz/loyalty/certificates/types/new и /biz/loyalty/certificates/types/[typeId] — форма типа сертификата.
 * F-06-087 (все поля создания), F-06-088 (номинал и тип списания — с примером расчёта), F-06-089
 * (категория), F-06-090 (ограничение применения — услуги/товары), F-06-091 (срок действия), F-06-092
 * (именной сертификат — без кода), F-06-093 (где можно менять баланс/срок), F-06-147 (продажа онлайн).
 * Правка/удаление — своя кнопка (в ТЗ нет отдельного F-id удаления сертификата, как есть у типа карты).
 *
 * Тело монтируется только когда данные правки уже загружены — useState сразу с нужным значением,
 * без эффекта переноса (тот же приём, что в CardTypeFormScreen, b02).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from 'lucide-react';
import {
  createCertificateType,
  deleteCertificateType,
  getCertificateType,
  listCertificateTypes,
  listServiceScopeOptions,
  updateCertificateType,
  type CertificateTypeInput,
} from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import {
  CERTIFICATE_CATEGORIES,
  chargeCertificate,
  defaultOnlineSale,
  type CertificateCategory,
  type CertificateChargeType,
  type CertificateExpiryMode,
  type CertificateServicesMode,
  type CertificateType,
  type EditLocationsMode,
  type ExpiryPeriodUnit,
} from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { coreList } from '@/api/core';
import { useDemo } from '@/demo/hooks';
import { pickText } from '@/lib/text';
import { ServiceScopePicker } from '@/areas/loyalty/ServiceScopePicker';
import { OnlineSaleFields } from '@/areas/loyalty/OnlineSaleFields';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useConfirm, useToast } from '@/ui/Toast';

export function CertificateTypeFormScreen({ typeId }: { typeId?: Id }) {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const isEdit = Boolean(typeId);
  const [deleted, setDeleted] = useState(false);

  const existingQ = useApiQuery(['loyalty', 'certificateType', businessId, typeId], () => getCertificateType(businessId!, typeId!), {
    enabled: ready && Boolean(businessId) && Boolean(typeId) && !deleted,
  });

  if (isEdit && existingQ.isError) return <ErrorState onRetry={existingQ.refetch} />;
  if (!ready || (isEdit && existingQ.isLoading)) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (isEdit && !existingQ.data) return <EmptyState icon={<Ticket aria-hidden />} title={t('certificateTypeForm.notFound')} />;

  return <CertificateTypeFormBody key={typeId ?? 'new'} typeId={typeId} initial={existingQ.data} onDeleted={() => setDeleted(true)} />;
}

function CertificateTypeFormBody({ typeId, initial, onDeleted }: { typeId?: Id; initial?: CertificateType; onDeleted: () => void }) {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { businessId, networkId } = useCurrent();
  const isEdit = Boolean(typeId);

  const scopeOptionsQ = useApiQuery(['loyalty', 'serviceScope', businessId], () => listServiceScopeOptions(businessId!), { enabled: Boolean(businessId) });
  const typesQ = useApiQuery(['loyalty', 'certificateTypes', businessId], () => listCertificateTypes(businessId!), { enabled: Boolean(businessId) && isEdit });
  const soldCount = typesQ.data?.find((ct) => ct.id === typeId)?.soldCount ?? 0;

  const createMutation = useApiMutation((input: CertificateTypeInput) => createCertificateType(businessId!, input));
  const updateMutation = useApiMutation((input: CertificateTypeInput) => updateCertificateType(businessId!, typeId!, input));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState(initial?.name ?? '');
  const [nominal, setNominal] = useState<number | undefined>(initial?.nominal ?? 0);
  const [chargeType, setChargeType] = useState<CertificateChargeType>(initial?.chargeType ?? 'multiple');
  const [category, setCategory] = useState<CertificateCategory>(initial?.category ?? 'none');
  const [applyServicesMode, setApplyServicesMode] = useState<CertificateServicesMode>(initial?.applyServicesMode ?? 'all');
  const [applyServiceScope, setApplyServiceScope] = useState(initial?.applyServiceScope ?? { categoryIds: [], serviceIds: [] });
  const [applyProductsAllowed, setApplyProductsAllowed] = useState(initial?.applyProductsAllowed ?? true);
  const [expiryMode, setExpiryMode] = useState<CertificateExpiryMode>(initial?.expiryMode ?? 'none');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? null);
  const [expiryPeriodValue, setExpiryPeriodValue] = useState(initial?.expiryPeriodValue ?? 3);
  const [expiryPeriodUnit, setExpiryPeriodUnit] = useState<ExpiryPeriodUnit>(initial?.expiryPeriodUnit ?? 'month');
  const [allowNoCode, setAllowNoCode] = useState(initial?.allowNoCode ?? false);
  const [editLocationsMode, setEditLocationsMode] = useState<EditLocationsMode>(initial?.editLocationsMode ?? 'none');
  const [onlineSale, setOnlineSale] = useState(initial?.onlineSale ?? defaultOnlineSale());
  const [locationIds, setLocationIds] = useState<Id[]>(initial?.locationIds ?? []);
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? t('certificateTypeForm.nameRequired') : undefined;
  const applyInvalid = applyServicesMode === 'none' && !applyProductsAllowed;

  const save = async () => {
    setTouched(true);
    if (!name.trim() || applyInvalid) return;
    const input: CertificateTypeInput = {
      name,
      nominal: nominal ?? 0,
      chargeType,
      category,
      applyServicesMode,
      applyServiceScope: applyServicesMode === 'some' ? applyServiceScope : undefined,
      applyProductsAllowed,
      expiryMode,
      expiryDate: expiryMode === 'fixedDate' ? (expiryDate ?? undefined) : undefined,
      expiryPeriodValue: expiryMode === 'fixedPeriod' ? expiryPeriodValue : undefined,
      expiryPeriodUnit: expiryMode === 'fixedPeriod' ? expiryPeriodUnit : undefined,
      allowNoCode,
      editLocationsMode,
      onlineSale,
      locationIds,
    };
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('certificateTypeForm.saved'));
      } else {
        const created = await createMutation.mutate(input);
        toast.success(t('certificateTypeForm.created'));
        router.push(`/biz/loyalty/certificates/types/${created.id}`);
        return;
      }
    } catch {
      toast.error(t('certificateTypeForm.saveFailed'));
    }
  };

  const remove = async () => {
    if (!typeId) return;
    const ok = await confirm({
      title: t('certificateTypeForm.deleteConfirmTitle'),
      description: soldCount > 0 ? t('certificateTypeForm.deleteConfirmTextCount', { count: soldCount }) : t('certificateTypeForm.deleteConfirmText'),
      tone: 'danger',
      confirmLabel: t('certificateTypeForm.deleteConfirm'),
    });
    if (!ok) return;
    onDeleted();
    try {
      await deleteCertificateType(businessId!, typeId);
      toast.success(t('certificateTypeForm.deleted'));
      router.push('/biz/loyalty/certificates/types');
    } catch {
      toast.error(t('certificateTypeForm.deleteFailed'));
    }
  };

  const charge = chargeCertificate(nominal ?? 0, chargeType, 3000);
  const expiryPreviewDate = addDays(today(), expiryPeriodUnitToDays(expiryPeriodValue, expiryPeriodUnit));

  return (
    <div data-f="F-06-087 F-06-088" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader
        title={isEdit ? t('certificateTypeForm.editTitle') : t('certificateTypeForm.title')}
        description={t('certificateTypeForm.subtitle')}
        back={{ href: isEdit ? `/biz/loyalty/certificates/types/${typeId}` : '/biz/loyalty/certificates/types' }}
      />

      <SectionCard title={t('certificateTypeForm.section.general')}>
        <div className="flex flex-col gap-5">
          <FormField label={t('certificateTypeForm.name')} required error={nameError}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('certificateTypeForm.namePlaceholder')} />
          </FormField>
          <FormField label={t('certificateTypeForm.nominal')}>
            <MoneyInput value={nominal} onValueChange={setNominal} placeholder="0" />
          </FormField>
        </div>
      </SectionCard>

      <div data-f="F-06-088">
        <SectionCard title={t('certificateTypeForm.section.chargeType')}>
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={chargeType}
              onValueChange={(v) => setChargeType(v as CertificateChargeType)}
              options={[
                { value: 'multiple', label: t('certificateTypeForm.chargeTypeOptions.multiple') },
                { value: 'single', label: t('certificateTypeForm.chargeTypeOptions.single') },
              ]}
            />
            <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
              <p className="font-medium text-fg">{t('certificateTypeForm.chargePreviewTitle')}</p>
              <p>{t('certificateTypeForm.chargePreviewText', { nominal: nominal ?? 0, charged: charge.charged, remaining: charge.remainingBalance })}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-06-089">
        <SectionCard title={t('certificateTypeForm.section.category')}>
          <FormField label={t('certificateTypeForm.categoryLabel')}>
            <Select
              options={CERTIFICATE_CATEGORIES.map((c) => ({ value: c, label: t(`certificateTypeForm.categoryOptions.${c}`) }))}
              value={category}
              onValueChange={(v) => setCategory(v as CertificateCategory)}
            />
          </FormField>
        </SectionCard>
      </div>

      <div data-f="F-06-090">
        <SectionCard title={t('certificateTypeForm.section.apply')}>
          <div className="flex flex-col gap-5">
            <FormField label={t('certificateTypeForm.applyServicesLabel')} error={applyInvalid ? t('certificateTypeForm.applyInvalidCombo') : undefined}>
              <RadioGroup
                orientation="horizontal"
                value={applyServicesMode}
                onValueChange={(v) => setApplyServicesMode(v as CertificateServicesMode)}
                options={[
                  { value: 'all', label: t('certificateTypeForm.applyServicesOptions.all') },
                  { value: 'some', label: t('certificateTypeForm.applyServicesOptions.some') },
                  { value: 'none', label: t('certificateTypeForm.applyServicesOptions.none') },
                ]}
              />
            </FormField>
            {applyServicesMode === 'some' &&
              (scopeOptionsQ.isLoading ? <Skeleton lines={3} /> : <ServiceScopePicker value={applyServiceScope} onChange={setApplyServiceScope} />)}
            <FormField label={t('certificateTypeForm.applyProductsLabel')} hint={t('certificateTypeForm.applyProductsHint')}>
              <RadioGroup
                orientation="horizontal"
                value={applyProductsAllowed ? 'allowed' : 'forbidden'}
                onValueChange={(v) => setApplyProductsAllowed(v === 'allowed')}
                options={[
                  { value: 'allowed', label: t('certificateTypeForm.applyProductsOptions.allowed') },
                  { value: 'forbidden', label: t('certificateTypeForm.applyProductsOptions.forbidden') },
                ]}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-06-091">
        <SectionCard title={t('certificateTypeForm.section.expiry')}>
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={expiryMode}
              onValueChange={(v) => setExpiryMode(v as CertificateExpiryMode)}
              options={[
                { value: 'none', label: t('certificateTypeForm.expiryOptions.none') },
                { value: 'fixedDate', label: t('certificateTypeForm.expiryOptions.fixedDate') },
                { value: 'fixedPeriod', label: t('certificateTypeForm.expiryOptions.fixedPeriod') },
              ]}
            />
            {expiryMode === 'fixedDate' && (
              <FormField label={t('certificateTypeForm.expiryDate')}>
                <DatePicker value={expiryDate} onValueChange={setExpiryDate} min={today()} />
              </FormField>
            )}
            {expiryMode === 'fixedPeriod' && (
              <>
                <div className="grid grid-cols-[1fr_1fr] gap-3">
                  <FormField label={t('certificateTypeForm.expiryPeriodValue')}>
                    <Input type="number" min={1} value={expiryPeriodValue} onChange={(e) => setExpiryPeriodValue(Math.max(1, Number(e.target.value) || 1))} />
                  </FormField>
                  <FormField label=" ">
                    <Select
                      options={(['day', 'week', 'month', 'year'] as ExpiryPeriodUnit[]).map((u) => ({ value: u, label: t(`certificateTypeForm.expiryPeriodUnit.${u}`) }))}
                      value={expiryPeriodUnit}
                      onValueChange={(v) => setExpiryPeriodUnit(v as ExpiryPeriodUnit)}
                    />
                  </FormField>
                </div>
                <p className="text-sm text-muted">{t('certificateTypeForm.expiryPreview', { date: format.date(expiryPreviewDate, 'long') })}</p>
              </>
            )}
          </div>
        </SectionCard>
      </div>

      <div data-f="F-06-092">
        <SectionCard title={t('certificateTypeForm.section.code')}>
          <Checkbox checked={allowNoCode} onCheckedChange={setAllowNoCode} label={t('certificateTypeForm.allowNoCode')} description={t('certificateTypeForm.allowNoCodeHint')} />
        </SectionCard>
      </div>

      <div data-f="F-06-093">
        <SectionCard title={t('certificateTypeForm.section.edit')}>
          <FormField label={t('certificateTypeForm.editLocationsLabel')} hint={t('certificateTypeForm.editLocationsHint')}>
            <Select
              options={[
                { value: 'none', label: t('certificateTypeForm.editLocationsOptions.none') },
                { value: 'saleLocation', label: t('certificateTypeForm.editLocationsOptions.saleLocation') },
                { value: 'allLocations', label: t('certificateTypeForm.editLocationsOptions.allLocations') },
              ]}
              value={editLocationsMode}
              onValueChange={(v) => setEditLocationsMode(v as EditLocationsMode)}
            />
          </FormField>
        </SectionCard>
      </div>

      <div data-f="F-06-147">
        <SectionCard title={t('onlineSale.sectionTitle')}>
          <OnlineSaleFields value={onlineSale} onChange={setOnlineSale} />
        </SectionCard>
      </div>

      {networkId && (
        <SectionCard title={t('certificateTypeForm.locations')}>
          <LocationsPicker businessId={businessId!} value={locationIds} onChange={setLocationIds} />
        </SectionCard>
      )}

      <StickyActionBar>
        {isEdit && (
          <Button variant="danger" onClick={remove}>
            {t('certificateTypeForm.delete')}
          </Button>
        )}
        <Button onClick={save} loading={isSaving}>
          {t('certificateTypeForm.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}

function expiryPeriodUnitToDays(value: number, unit: ExpiryPeriodUnit): number {
  const factor = { day: 1, week: 7, month: 30, year: 365 }[unit];
  return value * factor;
}

function LocationsPicker({ businessId, value, onChange }: { businessId: Id; value: Id[]; onChange: (ids: Id[]) => void }) {
  const t = useT('loyalty');
  const { lang } = useDemo();
  const q = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId }));
  if (q.isLoading) return <Skeleton lines={2} />;
  const locations = q.data ?? [];
  if (locations.length === 0) return <EmptyState compact title={t('cardTypeForm.noLocations')} />;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong bg-surface p-3">
      {locations.map((l) => (
        <Checkbox
          key={l.id}
          checked={value.includes(l.id)}
          onCheckedChange={(checked) => onChange(checked ? [...value, l.id] : value.filter((id) => id !== l.id))}
          label={pickText(l.name, lang)}
        />
      ))}
    </div>
  );
}

'use client';

/**
 * /biz/loyalty/memberships/types/new и /biz/loyalty/memberships/types/[typeId] — форма типа абонемента.
 * F-06-106 (вкладки, все поля создания), F-06-107 (услуги/баланс), F-06-108 (стоимость/длительность),
 * F-06-109 (момент активации), F-06-110 (автоактивация), F-06-111 (где менять баланс/срок), F-06-112
 * (разрешить заморозку), F-06-113 (именной, без кода), F-06-114 (пересчёт цены), F-06-115 (блокировка
 * после продажи + «Дублировать»), F-06-116 (архивирование/восстановление), F-06-117 (удаление), F-06-134
 * (категория «с автопродлением»), F-06-147 (продажа онлайн), F-06-118…120 (вкладка «Уведомления»).
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Plus, Trash2 } from 'lucide-react';
import {
  createMembershipType,
  deleteMembershipType,
  duplicateMembershipType,
  getMembershipType,
  listMembershipTypes,
  listServiceScopeOptions,
  setMembershipTypeArchived,
  updateMembershipType,
  type MembershipTypeInput,
} from '@/api/loyalty';
import { coreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import {
  defaultMembershipNotify,
  defaultOnlineSale,
  recalcMembershipVisitPrice,
  type EditLocationsMode,
  type ExpiryPeriodUnit,
  type MembershipActivationMode,
  type MembershipBalanceMode,
  type MembershipRenewalKind,
  type MembershipServiceLine,
  type MembershipType,
} from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { NotifyTemplateField } from '@/areas/loyalty/NotifyTemplateField';
import { OnlineSaleFields } from '@/areas/loyalty/OnlineSaleFields';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';

export function MembershipTypeFormScreen({ typeId }: { typeId?: Id }) {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const isEdit = Boolean(typeId);
  const [deleted, setDeleted] = useState(false);

  const existingQ = useApiQuery(['loyalty', 'membershipType', businessId, typeId], () => getMembershipType(businessId!, typeId!), {
    enabled: ready && Boolean(businessId) && Boolean(typeId) && !deleted,
  });
  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const scopeOptionsQ = useApiQuery(['loyalty', 'serviceScope', businessId], () => listServiceScopeOptions(businessId!), {
    enabled: ready && Boolean(businessId),
  });

  if (isEdit && existingQ.isError) return <ErrorState onRetry={existingQ.refetch} />;
  if (locationsQ.isError) return <ErrorState onRetry={locationsQ.refetch} />;
  if (!ready || (isEdit && existingQ.isLoading) || locationsQ.isLoading || scopeOptionsQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (isEdit && !existingQ.data) return <EmptyState icon={<Gift aria-hidden />} title={t('membershipTypeForm.notFound')} />;

  return (
    <MembershipTypeFormBody
      key={typeId ?? 'new'}
      typeId={typeId}
      initial={existingQ.data}
      allLocationIds={locationsQ.data?.map((l) => l.id) ?? []}
      services={scopeOptionsQ.data?.services ?? []}
      onDeleted={() => setDeleted(true)}
    />
  );
}

function MembershipTypeFormBody({
  typeId,
  initial,
  allLocationIds,
  services,
  onDeleted,
}: {
  typeId?: Id;
  initial?: MembershipType;
  allLocationIds: Id[];
  services: { id: Id; name: string; categoryId: Id }[];
  onDeleted: () => void;
}) {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { businessId, networkId } = useCurrent();
  const { lang } = useDemo();
  const isEdit = Boolean(typeId);

  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: Boolean(businessId),
  });
  const typesQ = useApiQuery(['loyalty', 'membershipTypes', businessId], () => listMembershipTypes(businessId!), { enabled: Boolean(businessId) && isEdit });
  const soldCount = typesQ.data?.find((mt) => mt.id === typeId)?.soldCount ?? 0;
  const locked = isEdit && soldCount > 0;

  const createMutation = useApiMutation((input: MembershipTypeInput) => createMembershipType(businessId!, input));
  const updateMutation = useApiMutation((input: MembershipTypeInput) => updateMembershipType(businessId!, typeId!, input));
  const archiveMutation = useApiMutation((archived: boolean) => setMembershipTypeArchived(businessId!, typeId!, archived));
  const duplicateMutation = useApiMutation(() => duplicateMembershipType(businessId!, typeId!));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [tab, setTab] = useState<'settings' | 'notify'>('settings');
  const [name, setName] = useState(initial?.name ?? '');
  const [balanceMode, setBalanceMode] = useState<MembershipBalanceMode>(initial?.balanceMode ?? 'separate');
  const [lines, setLines] = useState<MembershipServiceLine[]>(initial?.services ?? []);
  const [sharedVisits, setSharedVisits] = useState(initial?.sharedVisits ?? 8);
  const [price, setPrice] = useState<number | undefined>(initial?.price ?? 0);
  const [durationValue, setDurationValue] = useState(initial?.durationValue ?? 1);
  const [durationUnit, setDurationUnit] = useState<ExpiryPeriodUnit>(initial?.durationUnit ?? 'month');
  const [activationMode, setActivationMode] = useState<MembershipActivationMode>(initial?.activationMode ?? 'firstVisit');
  const [autoActivateEnabled, setAutoActivateEnabled] = useState(initial?.autoActivateEnabled ?? false);
  const [autoActivateDays, setAutoActivateDays] = useState(initial?.autoActivateDays ?? 30);
  const [editLocationsMode, setEditLocationsMode] = useState<EditLocationsMode>(initial?.editLocationsMode ?? 'none');
  const [freezeAllowed, setFreezeAllowed] = useState(initial?.freezeAllowed ?? false);
  const [allowNoCode, setAllowNoCode] = useState(initial?.allowNoCode ?? false);
  const [recalcPriceOnPay, setRecalcPriceOnPay] = useState(initial?.recalcPriceOnPay ?? false);
  const [renewalKind, setRenewalKind] = useState<MembershipRenewalKind>(initial?.renewalKind ?? 'standard');
  const [onlineSale, setOnlineSale] = useState(initial?.onlineSale ?? defaultOnlineSale());
  const [locationIds, setLocationIds] = useState<Id[]>(initial?.locationIds ?? allLocationIds);
  const [notify, setNotify] = useState(initial?.notify ?? defaultMembershipNotify());
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? t('membershipTypeForm.nameRequired') : undefined;
  const linesError = touched && balanceMode === 'separate' && lines.length === 0 ? t('membershipTypeForm.noServices') : undefined;
  const nameFieldRef = useRef<HTMLDivElement>(null);
  const servicesFieldRef = useRef<HTMLDivElement>(null);
  const totalVisits = balanceMode === 'shared' ? sharedVisits : lines.reduce((sum, l) => sum + l.visits, 0);

  const buildInput = (): MembershipTypeInput => ({
    name,
    balanceMode,
    services: balanceMode === 'separate' ? lines : [],
    sharedVisits: balanceMode === 'shared' ? sharedVisits : undefined,
    price: price ?? 0,
    durationValue,
    durationUnit,
    activationMode,
    autoActivateEnabled: activationMode === 'firstVisit' ? autoActivateEnabled : false,
    autoActivateDays: activationMode === 'firstVisit' && autoActivateEnabled ? autoActivateDays : undefined,
    editLocationsMode,
    freezeAllowed,
    allowNoCode,
    recalcPriceOnPay,
    renewalKind,
    onlineSale,
    locationIds,
    notify,
  });

  const save = async () => {
    setTouched(true);
    if (!name.trim() || (balanceMode === 'separate' && lines.length === 0)) {
      toast.error(t('membershipTypeForm.fixErrors'));
      const target = !name.trim() ? nameFieldRef.current : servicesFieldRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const input = buildInput();
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('membershipTypeForm.saved'));
      } else {
        const created = await createMutation.mutate(input);
        toast.success(t('membershipTypeForm.created'));
        router.push(`/biz/loyalty/memberships/types/${created.id}`);
        return;
      }
    } catch {
      toast.error(t('membershipTypeForm.saveFailed'));
    }
  };

  const saveNotify = async () => {
    if (!typeId) return;
    try {
      await updateMutation.mutate(buildInput());
      toast.success(t('membershipTypeForm.notify.saved'));
    } catch {
      toast.error(t('membershipTypeForm.saveFailed'));
    }
  };

  const toggleArchive = async () => {
    try {
      await archiveMutation.mutate(!initial?.archived);
      toast.success(initial?.archived ? t('membershipTypeForm.restored') : t('membershipTypeForm.archived'));
    } catch {
      toast.error(t('membershipTypeForm.saveFailed'));
    }
  };

  const duplicate = async () => {
    try {
      const copy = await duplicateMutation.mutate(undefined);
      toast.success(t('membershipTypeForm.duplicated', { name: copy.name }));
      router.push(`/biz/loyalty/memberships/types/${copy.id}`);
    } catch {
      toast.error(t('membershipTypeForm.saveFailed'));
    }
  };

  const remove = async () => {
    if (!typeId) return;
    const ok = await confirm({
      title: t('membershipTypeForm.deleteConfirmTitle'),
      description: t('membershipTypeForm.deleteConfirmText'),
      tone: 'danger',
      confirmLabel: t('membershipTypeForm.deleteConfirm'),
    });
    if (!ok) return;
    onDeleted();
    try {
      await deleteMembershipType(businessId!, typeId);
      toast.success(t('membershipTypeForm.deleted'));
      router.push('/biz/loyalty/memberships/types');
    } catch {
      toast.error(t('membershipTypeForm.deleteFailed'));
    }
  };

  const locations = locationsQ.data ?? [];
  const autoActivatePreview = addDays(today(), autoActivateDays);
  const perVisit = recalcMembershipVisitPrice(price ?? 0, totalVisits || 1);

  return (
    <div data-f="F-06-106 F-06-115 F-06-116 F-06-117 F-06-134" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader
        title={isEdit ? t('membershipTypeForm.editTitle') : t('membershipTypeForm.title')}
        description={t('membershipTypeForm.subtitle')}
        back={{ href: isEdit ? `/biz/loyalty/memberships/types/${typeId}` : '/biz/loyalty/memberships/types' }}
      />

      <Tabs
        items={[
          { value: 'settings', label: t('membershipTypeForm.tabs.settings') },
          { value: 'notify', label: t('membershipTypeForm.tabs.notify'), disabled: !isEdit },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as 'settings' | 'notify')}
      />
      {!isEdit && <p className="-mt-2 text-xs text-muted">{t('membershipTypeForm.notifyLockedHint')}</p>}

      {tab === 'settings' ? (
        <>
          <div ref={nameFieldRef}>
            <SectionCard title={t('membershipTypeForm.name')}>
              <FormField label={t('membershipTypeForm.name')} required error={nameError}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('membershipTypeForm.namePlaceholder')} />
              </FormField>
            </SectionCard>
          </div>

          <div ref={servicesFieldRef} data-f="F-06-107">
            <SectionCard title={t('membershipTypeForm.section.services')} description={locked ? t('membershipTypeForm.lockedAfterSaleHint') : undefined}>
              <div className="flex flex-col gap-4">
                <FormField label={t('membershipTypeForm.balanceMode')} hint={t('membershipTypeForm.balanceModeHint')}>
                  <RadioGroup
                    orientation="horizontal"
                    value={balanceMode}
                    onValueChange={(v) => !locked && setBalanceMode(v as MembershipBalanceMode)}
                    options={[
                      { value: 'separate', label: t('membershipTypeForm.balanceModeOptions.separate'), disabled: locked },
                      { value: 'shared', label: t('membershipTypeForm.balanceModeOptions.shared'), disabled: locked },
                    ]}
                  />
                </FormField>
                {balanceMode === 'separate' ? (
                  <div className="flex flex-col gap-2">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select
                          className="flex-1"
                          options={services.map((s) => ({ value: s.id, label: s.name }))}
                          value={line.serviceId ?? ''}
                          onValueChange={(v) => !locked && setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, serviceId: v } : l)))}
                          disabled={locked}
                        />
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          aria-label={t('membershipTypeForm.serviceVisits')}
                          value={line.visits}
                          onChange={(e) => !locked && setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, visits: Math.max(1, Number(e.target.value) || 1) } : l)))}
                          disabled={locked}
                        />
                        {!locked && (
                          <IconButton
                            icon={<Trash2 aria-hidden />}
                            label={t('membershipTypeForm.removeService')}
                            variant="ghost"
                            onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                          />
                        )}
                      </div>
                    ))}
                    {linesError && <p className="text-sm text-danger">{linesError}</p>}
                    {!locked && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Plus aria-hidden />}
                        onClick={() => setLines((ls) => [...ls, { serviceId: services[0]?.id, visits: 1 }])}
                        disabled={services.length === 0}
                      >
                        {t('membershipTypeForm.addService')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <FormField label={t('membershipTypeForm.sharedVisits')}>
                    <Input type="number" min={1} value={sharedVisits} onChange={(e) => !locked && setSharedVisits(Math.max(1, Number(e.target.value) || 1))} disabled={locked} />
                  </FormField>
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard title={t('membershipTypeForm.section.main')}>
            <div className="flex flex-col gap-5">
              <div data-f="F-06-108" className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_1fr]">
                <FormField label={t('membershipTypeForm.price')} hint={locked ? t('membershipTypeForm.priceLockedHint') : undefined}>
                  <MoneyInput value={price} onValueChange={locked ? undefined : setPrice} placeholder="0" disabled={locked} />
                </FormField>
                <FormField label={t('membershipTypeForm.duration')} hint={t('membershipTypeForm.durationHint')}>
                  <Input type="number" min={0} value={durationValue} onChange={(e) => setDurationValue(Math.max(0, Number(e.target.value) || 0))} />
                </FormField>
                <FormField label=" ">
                  <Select
                    options={(['day', 'week', 'month', 'year'] as ExpiryPeriodUnit[]).map((u) => ({ value: u, label: t(`membershipTypeForm.durationUnit.${u}`) }))}
                    value={durationUnit}
                    onValueChange={(v) => setDurationUnit(v as ExpiryPeriodUnit)}
                  />
                </FormField>
              </div>

              <div data-f="F-06-109">
                <FormField label={t('membershipTypeForm.activation')} hint={t('membershipTypeForm.activationHint')}>
                  <RadioGroup
                    value={activationMode}
                    onValueChange={(v) => setActivationMode(v as MembershipActivationMode)}
                    options={[
                      { value: 'firstVisit', label: t('membershipTypeForm.activationOptions.firstVisit') },
                      { value: 'onSale', label: t('membershipTypeForm.activationOptions.onSale') },
                    ]}
                  />
                </FormField>
              </div>

              {activationMode === 'firstVisit' && (
                <div data-f="F-06-110" className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-2 p-3">
                  <Checkbox checked={autoActivateEnabled} onCheckedChange={setAutoActivateEnabled} label={t('membershipTypeForm.autoActivate')} description={t('membershipTypeForm.autoActivateHint')} />
                  {autoActivateEnabled && (
                    <>
                      <FormField label={t('membershipTypeForm.autoActivateDays')}>
                        <Input type="number" min={1} value={autoActivateDays} onChange={(e) => setAutoActivateDays(Math.max(1, Number(e.target.value) || 1))} />
                      </FormField>
                      <p className="text-sm text-muted">{t('membershipTypeForm.autoActivatePreview', { date: format.date(autoActivatePreview, 'long') })}</p>
                    </>
                  )}
                </div>
              )}

              <div data-f="F-06-111">
                <FormField label={t('membershipTypeForm.editLocationsLabel')} hint={t('membershipTypeForm.editLocationsHint')}>
                  <Select
                    options={[
                      { value: 'none', label: t('membershipTypeForm.editLocationsOptions.none') },
                      { value: 'saleLocation', label: t('membershipTypeForm.editLocationsOptions.saleLocation') },
                      { value: 'allLocations', label: t('membershipTypeForm.editLocationsOptions.allLocations') },
                    ]}
                    value={editLocationsMode}
                    onValueChange={(v) => setEditLocationsMode(v as EditLocationsMode)}
                  />
                </FormField>
              </div>

              <div data-f="F-06-112">
                <Checkbox checked={freezeAllowed} onCheckedChange={setFreezeAllowed} label={t('membershipTypeForm.freezeAllowed')} description={t('membershipTypeForm.freezeAllowedHint')} />
              </div>

              {networkId && (
                <FormField label={t('membershipTypeForm.locations')}>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setLocationIds(allLocationIds)}>
                        {t('membershipTypeForm.addAllLocations')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setLocationIds([])}>
                        {t('membershipTypeForm.clearLocations')}
                      </Button>
                    </div>
                    {locations.length === 0 ? (
                      <EmptyState compact title={t('cardTypeForm.noLocations')} />
                    ) : (
                      <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong bg-surface p-3">
                        {locations.map((l) => (
                          <Checkbox
                            key={l.id}
                            checked={locationIds.includes(l.id)}
                            onCheckedChange={(checked) => setLocationIds((ids) => (checked ? [...ids, l.id] : ids.filter((id) => id !== l.id)))}
                            label={pickText(l.name, lang)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </FormField>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t('membershipTypeForm.section.settings')}>
            <div className="flex flex-col gap-4">
              <div data-f="F-06-113">
                <Checkbox checked={allowNoCode} onCheckedChange={setAllowNoCode} label={t('membershipTypeForm.allowNoCode')} description={t('membershipTypeForm.allowNoCodeHint')} />
              </div>
              <div data-f="F-06-114" className="flex flex-col gap-2">
                <Checkbox checked={recalcPriceOnPay} onCheckedChange={setRecalcPriceOnPay} label={t('membershipTypeForm.recalcPrice')} description={t('membershipTypeForm.recalcPriceHint')} />
                {recalcPriceOnPay && (
                  <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
                    <p className="font-medium text-fg">{t('membershipTypeForm.recalcPreviewTitle')}</p>
                    <p>{t('membershipTypeForm.recalcPreviewText', { price: price ?? 0, visits: totalVisits || 1, perVisit })}</p>
                  </div>
                )}
              </div>
              <div data-f="F-06-134">
                <FormField label={t('membershipTypeForm.renewalKind')} hint={t('membershipTypeForm.renewalKindHint')}>
                  <RadioGroup
                    value={renewalKind}
                    onValueChange={(v) => setRenewalKind(v as MembershipRenewalKind)}
                    options={[
                      { value: 'standard', label: t('membershipTypeForm.renewalKindOptions.standard') },
                      {
                        value: 'autoRenew',
                        label: t('membershipTypeForm.renewalKindOptions.autoRenew'),
                        description: t('membershipTypeForm.renewalKindOptions.autoRenewDisabledHint'),
                        disabled: true,
                      },
                    ]}
                  />
                </FormField>
              </div>
            </div>
          </SectionCard>

          <div data-f="F-06-147">
            <SectionCard title={t('onlineSale.sectionTitle')}>
              <OnlineSaleFields value={onlineSale} onChange={setOnlineSale} />
            </SectionCard>
          </div>

          <StickyActionBar>
            {isEdit && (
              <>
                <Button variant="danger" onClick={remove}>
                  {t('membershipTypeForm.delete')}
                </Button>
                <Button variant="secondary" onClick={duplicate} loading={duplicateMutation.isPending}>
                  {t('membershipTypeForm.duplicate')}
                </Button>
                <Button variant="secondary" onClick={toggleArchive} loading={archiveMutation.isPending}>
                  {initial?.archived ? t('membershipTypeForm.restore') : t('membershipTypeForm.archive')}
                </Button>
              </>
            )}
            <Button onClick={save} loading={isSaving}>
              {t('membershipTypeForm.save')}
            </Button>
          </StickyActionBar>
        </>
      ) : (
        <>
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{t('membershipTypeForm.notify.banner')}</p>
          <div data-f="F-06-118 F-06-119">
            <SectionCard title={t('membershipTypeForm.notify.expiry')} description={t('membershipTypeForm.notify.expiryHint')}>
              <NotifyTemplateField
                value={notify.expiry}
                onChange={(v) => setNotify((n) => ({ ...n, expiry: { ...n.expiry, ...v } }))}
                label={t('membershipTypeForm.notify.expiry')}
                templates={t.raw('membershipTypeForm.notify.expiryTemplates') as [string, string, string]}
                extra={
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={t('membershipTypeForm.notify.expiryDaysBefore')}>
                      <Input
                        type="number"
                        min={1}
                        value={notify.expiry.daysBefore ?? ''}
                        onChange={(e) => setNotify((n) => ({ ...n, expiry: { ...n.expiry, daysBefore: e.target.value ? Number(e.target.value) : undefined } }))}
                      />
                    </FormField>
                    <FormField label={t('membershipTypeForm.notify.expiryAtVisitsLeft')}>
                      <Input
                        type="number"
                        min={0}
                        value={notify.expiry.atVisitsLeft ?? ''}
                        onChange={(e) => setNotify((n) => ({ ...n, expiry: { ...n.expiry, atVisitsLeft: e.target.value ? Number(e.target.value) : undefined } }))}
                      />
                    </FormField>
                  </div>
                }
              />
            </SectionCard>
          </div>
          <div data-f="F-06-120">
            <SectionCard title={t('membershipTypeForm.notify.charge')} description={t('membershipTypeForm.notify.chargeHint')}>
              <NotifyTemplateField
                value={notify.charge}
                onChange={(v) => setNotify((n) => ({ ...n, charge: v }))}
                label={t('membershipTypeForm.notify.charge')}
                templates={t.raw('membershipTypeForm.notify.chargeTemplates') as [string, string, string]}
              />
            </SectionCard>
          </div>
          <StickyActionBar>
            <Button onClick={saveNotify} loading={updateMutation.isPending}>
              {t('membershipTypeForm.notify.save')}
            </Button>
          </StickyActionBar>
        </>
      )}
    </div>
  );
}

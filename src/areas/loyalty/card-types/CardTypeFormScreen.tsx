'use client';

/**
 * /biz/loyalty/card-types/new и /biz/loyalty/card-types/[typeId] — форма типа карты.
 * F-06-021 (все поля создания), F-06-022 (источник для накопительных акций), F-06-023 (локации),
 * F-06-024 (автовыпуск), F-06-025 (сгорание баллов), F-06-026 (ограничение списания — услуги/товары),
 * F-06-027 (лимит оплаты баллами), F-06-028 (показ кэшбэка в приложении клиента), F-06-030 (правка и
 * удаление, каскадное удаление выданных карт).
 *
 * Внутренняя форма монтируется только когда исходные данные (для правки) уже загружены, поэтому
 * `useState` сразу инициализируется нужными значениями — без эффекта, который переносил бы данные
 * запроса в состояние после монтирования.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { coreList } from '@/api/core';
import {
  createCardType,
  deleteCardType,
  getCardType,
  listCardTypes,
  listServiceScopeOptions,
  setCardTypeArchived,
  updateCardType,
  type CardTypeInput,
} from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { defaultCardTypeNotify, type AutoIssueMode, type CardSourceScope, type CardType, type ScopeLimitMode } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { NotifyTemplateField } from '@/areas/loyalty/NotifyTemplateField';
import { ServiceScopePicker } from '@/areas/loyalty/ServiceScopePicker';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
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

const BURN_DAYS_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 15, 20, 21, 25, 28, 30, 45, 60, 90, 120, 180, 365];

export function CardTypeFormScreen({ typeId }: { typeId?: Id }) {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const isEdit = Boolean(typeId);
  // После удаления записи (Body.remove) отключаем перечитывание existingQ: удаление типа карты
  // трогает ту же коллекцию, точечная инвалидация будит existingQ ещё до редиректа, и фоновый
  // getCardType на уже удалённую запись падает not_found прямо в консоль.
  const [deleted, setDeleted] = useState(false);

  const existingQ = useApiQuery(['loyalty', 'cardType', businessId, typeId], () => getCardType(businessId!, typeId!), {
    enabled: ready && Boolean(businessId) && Boolean(typeId) && !deleted,
  });
  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });

  if (isEdit && existingQ.isError) return <ErrorState onRetry={existingQ.refetch} />;
  if (locationsQ.isError) return <ErrorState onRetry={locationsQ.refetch} />;
  // Ждём и данные правки (для isEdit), и список локаций — на НОВОМ типе умолчание «все локации
  // отмечены сразу» строится из allLocationIds, а useState в CardTypeFormBody фиксирует значение
  // один раз при монтировании: смонтировать тело раньше ответа locationsQ значит навсегда получить
  // пустой список локаций.
  if (!ready || (isEdit && existingQ.isLoading) || locationsQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (isEdit && !existingQ.data) return <EmptyState icon={<CreditCard aria-hidden />} title={t('cardTypeForm.notFound')} />;

  return (
    <CardTypeFormBody
      key={typeId ?? 'new'}
      typeId={typeId}
      initial={existingQ.data}
      allLocationIds={locationsQ.data?.map((l) => l.id) ?? []}
      onDeleted={() => setDeleted(true)}
    />
  );
}

function CardTypeFormBody({
  typeId,
  initial,
  allLocationIds,
  onDeleted,
}: {
  typeId?: Id;
  initial?: CardType;
  allLocationIds: Id[];
  onDeleted: () => void;
}) {
  const t = useT('loyalty');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { businessId, networkId } = useCurrent();
  const { lang } = useDemo();
  const isEdit = Boolean(typeId);

  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: Boolean(businessId),
  });
  const scopeOptionsQ = useApiQuery(['loyalty', 'serviceScope', businessId], () => listServiceScopeOptions(businessId!), {
    enabled: Boolean(businessId),
  });
  // ux-best-c2 #3: подтверждение удаления должно называть число задетых клиентов, а не только предупреждать словами
  const cardTypesQ = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: Boolean(businessId) && isEdit });
  const issuedCount = cardTypesQ.data?.find((ct) => ct.id === typeId)?.issuedCount ?? 0;

  const createMutation = useApiMutation((input: CardTypeInput) => createCardType(businessId!, input));
  const updateMutation = useApiMutation((input: CardTypeInput) => updateCardType(businessId!, typeId!, input));
  const archiveMutation = useApiMutation((archived: boolean) => setCardTypeArchived(businessId!, typeId!, archived));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState(initial?.name ?? '');
  // Значения по умолчанию для нового типа: все локации отмечены сразу, чтобы не создать тип «без локаций» по невнимательности
  const [locationIds, setLocationIds] = useState<Id[]>(initial?.locationIds ?? allLocationIds);
  const [sourceScope, setSourceScope] = useState<CardSourceScope>(initial?.sourceScope ?? 'activeLocations');
  const [autoIssueMode, setAutoIssueMode] = useState<AutoIssueMode>(initial?.autoIssueMode ?? 'none');
  const [burnDays, setBurnDays] = useState<number | undefined>(initial?.burnDays);
  const [serviceLimitMode, setServiceLimitMode] = useState<ScopeLimitMode>(initial?.serviceLimitMode ?? 'all');
  const [serviceLimitScope, setServiceLimitScope] = useState<{ categoryIds: Id[]; serviceIds: Id[] }>(
    initial?.serviceLimitScope ?? { categoryIds: [], serviceIds: [] },
  );
  const [productLimitMode, setProductLimitMode] = useState<ScopeLimitMode>(initial?.productLimitMode ?? 'all');
  const [paymentLimitFixed, setPaymentLimitFixed] = useState<number | undefined>(initial?.paymentLimitFixed ?? 0);
  const [paymentLimitPercent, setPaymentLimitPercent] = useState<number | undefined>(initial?.paymentLimitPercent ?? 0);
  const [cashbackVisibleInApp, setCashbackVisibleInApp] = useState(initial?.cashbackVisibleInApp ?? true);
  const [birthdayBonus, setBirthdayBonus] = useState<number | undefined>(initial?.birthdayBonus);
  const [notify, setNotify] = useState(initial?.notify ?? defaultCardTypeNotify());
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? t('cardTypeForm.nameRequired') : undefined;

  const save = async () => {
    setTouched(true);
    if (!name.trim()) return;
    const input: CardTypeInput = {
      name,
      locationIds,
      sourceScope,
      autoIssueMode,
      burnDays,
      serviceLimitMode,
      serviceLimitScope: serviceLimitMode === 'some' ? serviceLimitScope : undefined,
      productLimitMode,
      paymentLimitFixed: paymentLimitFixed ?? 0,
      paymentLimitPercent: paymentLimitPercent ?? 0,
      cashbackVisibleInApp,
      birthdayBonus: birthdayBonus || undefined,
      notify,
    };
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('cardTypeForm.saved'));
      } else {
        const created = await createMutation.mutate(input);
        toast.success(t('cardTypeForm.created'));
        router.push(`/biz/loyalty/card-types/${created.id}`);
        return;
      }
    } catch {
      toast.error(t('cardTypeForm.saveFailed'));
    }
  };

  // questions-q4 В-40: «Удалить» только у типа без выданных карт — у остальных подсказка «В архив»
  const remove = async () => {
    if (!typeId) return;
    const ok = await confirm({
      title: t('cardTypeForm.deleteConfirmTitle'),
      description: t('cardTypeForm.deleteConfirmText'),
      tone: 'danger',
      confirmLabel: t('cardTypeForm.deleteConfirm'),
    });
    if (!ok) return;
    // Отключаем existingQ ДО записи в базу (не после): deleteCardType сам занимает 150–400 мс,
    // и этого достаточно, чтобы React перерисовал экран с enabled:false прежде, чем точечная
    // инвалидация после самой записи разбудит ещё смонтированный запрос на удалённую запись.
    onDeleted();
    try {
      await deleteCardType(businessId!, typeId);
      toast.success(t('cardTypeForm.deleted'));
      router.push('/biz/loyalty/card-types');
    } catch {
      toast.error(t('cardTypeForm.deleteFailed'));
    }
  };

  const toggleArchive = async () => {
    if (!typeId) return;
    try {
      await archiveMutation.mutate(!initial?.archived);
      toast.success(initial?.archived ? t('cardTypeForm.restored') : t('cardTypeForm.archived'));
    } catch {
      toast.error(t('cardTypeForm.saveFailed'));
    }
  };

  const locations = locationsQ.data ?? [];

  return (
    <div data-f="F-06-021 F-06-030" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader
        title={isEdit ? t('cardTypeForm.editTitle') : t('cardTypeForm.title')}
        description={t('cardTypeForm.subtitle')}
        back={{ href: isEdit ? `/biz/loyalty/card-types/${typeId}` : '/biz/loyalty/card-types' }}
      />

      <SectionCard title={t('cardTypeForm.section.general')}>
        <div className="flex flex-col gap-5">
          <FormField label={t('cardTypeForm.name')} required error={nameError}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cardTypeForm.namePlaceholder')} />
          </FormField>

          <div data-f="F-06-022">
            <FormField label={t('cardTypeForm.sourceScope')} hint={t('cardTypeForm.sourceScopeHint')}>
              <Select
                options={[
                  { value: 'activeLocations', label: t('cardTypeForm.sourceScopeOptions.activeLocations') },
                  { value: 'network', label: t('cardTypeForm.sourceScopeOptions.network') },
                ]}
                value={sourceScope}
                onValueChange={(v) => setSourceScope(v as CardSourceScope)}
              />
            </FormField>
          </div>

          {networkId && (
            <div data-f="F-06-023">
              <FormField label={t('cardTypeForm.locations')} hint={t('cardTypeForm.locationsHint')}>
                {locationsQ.isLoading ? (
                  <Skeleton lines={2} />
                ) : locations.length === 0 ? (
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
              </FormField>
            </div>
          )}
        </div>
      </SectionCard>

      <div data-f="F-06-024">
        <SectionCard title={t('cardTypeForm.section.autoIssue')}>
          <RadioGroup
            value={autoIssueMode}
            onValueChange={(v) => setAutoIssueMode(v as AutoIssueMode)}
            options={[
              { value: 'none', label: t('cardTypeForm.autoIssueOptions.none') },
              { value: 'anyLocation', label: t('cardTypeForm.autoIssueOptions.anyLocation') },
              { value: 'connected', label: t('cardTypeForm.autoIssueOptions.connected') },
            ]}
          />
        </SectionCard>
      </div>

      <div data-f="F-06-025">
        <SectionCard title={t('cardTypeForm.section.burn')} description={t('cardTypeForm.burnHint')}>
          <Select
            options={[
              { value: '0', label: t('cardTypeForm.burnNone') },
              ...BURN_DAYS_OPTIONS.map((d) => ({ value: String(d), label: t('cardTypeForm.burnDays', { days: d }) })),
            ]}
            value={String(burnDays ?? 0)}
            onValueChange={(v) => setBurnDays(Number(v) || undefined)}
          />
        </SectionCard>
      </div>

      {/* Л16: бонус держателю карты в день рождения — раз в год, начисляется сам */}
      <SectionCard title={t('cardTypeForm.section.birthday')} description={t('cardTypeForm.birthdayHint')}>
        <FormField label={t('cardTypeForm.birthdayBonus')} optional>
          <MoneyInput value={birthdayBonus} onValueChange={setBirthdayBonus} placeholder="0" />
        </FormField>
      </SectionCard>

      <div data-f="F-06-026 F-08-127">
        <SectionCard title={t('cardTypeForm.section.limitPayment')} description={t('cardTypeForm.limitPaymentHint')}>
          <div className="flex flex-col gap-5">
            <FormField label={t('cardTypeForm.serviceLimitLabel')}>
              <RadioGroup
                orientation="horizontal"
                value={serviceLimitMode}
                onValueChange={(v) => setServiceLimitMode(v as ScopeLimitMode)}
                options={[
                  { value: 'all', label: t('cardTypeForm.limitModeOptions.allServices') },
                  { value: 'none', label: t('cardTypeForm.limitModeOptions.noneServices') },
                  { value: 'some', label: t('cardTypeForm.limitModeOptions.someServices') },
                ]}
              />
            </FormField>
            {serviceLimitMode === 'some' &&
              (scopeOptionsQ.isLoading ? <Skeleton lines={3} /> : <ServiceScopePicker value={serviceLimitScope} onChange={setServiceLimitScope} />)}
            <FormField label={t('cardTypeForm.productLimitLabel')} hint={t('cardTypeForm.productLimitHint')}>
              <RadioGroup
                orientation="horizontal"
                value={productLimitMode}
                onValueChange={(v) => setProductLimitMode(v as ScopeLimitMode)}
                options={[
                  { value: 'all', label: t('cardTypeForm.limitModeOptions.allProducts') },
                  { value: 'none', label: t('cardTypeForm.limitModeOptions.noneProducts') },
                  { value: 'some', label: t('cardTypeForm.limitModeOptions.someProducts') },
                ]}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-06-027">
        <SectionCard title={t('cardTypeForm.section.limitAmount')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('cardTypeForm.limitFixed')}>
              <MoneyInput value={paymentLimitFixed} onValueChange={setPaymentLimitFixed} placeholder="0" />
            </FormField>
            <FormField label={t('cardTypeForm.limitPercent')}>
              <Input
                type="number"
                min={0}
                max={100}
                value={paymentLimitPercent ?? ''}
                onChange={(e) => setPaymentLimitPercent(e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-06-028">
        <SectionCard title={t('cardTypeForm.section.cashbackVisible')}>
          <RadioGroup
            value={cashbackVisibleInApp ? 'show' : 'hide'}
            onValueChange={(v) => setCashbackVisibleInApp(v === 'show')}
            options={[
              { value: 'show', label: t('cardTypeForm.cashbackVisibleOptions.show') },
              { value: 'hide', label: t('cardTypeForm.cashbackVisibleOptions.hide') },
            ]}
          />
        </SectionCard>
      </div>

      {isEdit && (
        <div data-f="F-06-029">
          <SectionCard title={t('cardTypeForm.section.notify')}>
            <div className="flex flex-col gap-4">
              <NotifyTemplateField
                value={notify.issue}
                onChange={(v) => setNotify((n) => ({ ...n, issue: v }))}
                label={t('cardTypeForm.notify.issue')}
                templates={t.raw('cardTypeForm.notify.issueTemplates') as [string, string, string]}
              />
              <NotifyTemplateField
                value={notify.accrual}
                onChange={(v) => setNotify((n) => ({ ...n, accrual: v }))}
                label={t('cardTypeForm.notify.accrual')}
                templates={t.raw('cardTypeForm.notify.accrualTemplates') as [string, string, string]}
              />
              <NotifyTemplateField
                value={notify.charge}
                onChange={(v) => setNotify((n) => ({ ...n, charge: v }))}
                label={t('cardTypeForm.notify.charge')}
                templates={t.raw('cardTypeForm.notify.chargeTemplates') as [string, string, string]}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {isEdit && issuedCount > 0 && <p className="text-xs text-muted">{t('cardTypeForm.deleteBlockedHint', { count: issuedCount })}</p>}

      <StickyActionBar>
        {isEdit && (
          <>
            {issuedCount === 0 && (
              <Button variant="danger" onClick={remove}>
                {t('cardTypeForm.delete')}
              </Button>
            )}
            <Button variant="secondary" onClick={toggleArchive} loading={archiveMutation.isPending}>
              {initial?.archived ? t('cardTypeForm.restore') : t('cardTypeForm.archive')}
            </Button>
          </>
        )}
        <Button onClick={save} loading={isSaving}>
          {t('cardTypeForm.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}

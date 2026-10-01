'use client';

/**
 * /biz/finance/methods — «Методы оплаты и комиссии» (F-07-025…030, 032, 035): наличные (касса, выбор кассы),
 * банковская карта (комиссия, касса, срок зачисления — для Армении один карточный метод, F-07-028), рассрочка,
 * свои способы оплаты (⭐ реквизиты мастера для ручной предоплаты, F-00-097), кто платит комиссию в зарплате.
 * Настроенные методы сразу видны плитками в окне оплаты визита (вкладка «Оплата» — extensions/BookingWindow.tsx).
 */
import { useState } from 'react';
import Link from 'next/link';
import { Banknote, CreditCard, Layers, Plus, Wallet } from 'lucide-react';
import {
  addCustomPaymentMethod,
  getOnlinePaymentSettings,
  getPaymentMethodsSettings,
  listAccounts,
  savePaymentMethodsSettings,
  updateCustomPaymentMethod,
} from '@/api/finance';
import type { Account, AcquiringFeeShareMode, CashCashierMode, PaymentMethodsSettings } from '@/domain/finance';
import { ONLINE_PROVIDERS } from '@/domain/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { Collapse } from '@/ui/Collapse';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

/** Числовое поле с суффиксом единицы (% или дни) — MoneyInput не подходит, он всегда в драмах */
function NumberField({
  value,
  onValueChange,
  suffix,
  disabled,
}: {
  value: number;
  onValueChange: (v: number) => void;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value) || 0)}
      disabled={disabled}
      rightSlot={<span className="text-sm text-muted">{suffix}</span>}
    />
  );
}

export function MethodsScreen() {
  const t = useT('finance');
  const { ready, businessId } = useCurrent();
  const [tab, setTab] = useState<'onsite' | 'online'>('onsite');

  const accountsQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId!), { enabled: ready && Boolean(businessId) });
  const settingsQ = useApiQuery(['finance', 'paymentMethods', businessId], () => getPaymentMethodsSettings(businessId!), {
    enabled: ready && Boolean(businessId),
  });

  if (settingsQ.isError || accountsQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('nav.methods')} />
        <ErrorState
          onRetry={() => {
            settingsQ.refetch();
            accountsQ.refetch();
          }}
        />
      </div>
    );
  }

  // Загрузка — та же страница: вкладки и форма (выключенная, поля пустые), данные потом просто встают в поля
  const loading = settingsQ.isLoading || accountsQ.isLoading || !settingsQ.data;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={t('nav.methods')} description={t('methods.subtitle')} />
      <Tabs
        items={[
          { value: 'onsite', label: t('methods.tabOnsite') },
          { value: 'online', label: t('methods.tabOnline') },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as 'onsite' | 'online')}
      />
      {tab === 'onsite' ? (
        // key: перечитанные настройки (после сохранения обновляется updatedAt) пересоздают форму с новым initial —
        // без useEffect/setState (react-hooks/set-state-in-effect)
        <MethodsForm
          key={settingsQ.data?.updatedAt ?? 'loading'}
          initial={settingsQ.data ?? LOADING_METHODS}
          loading={loading}
          accounts={accountsQ.data ?? []}
          onSaved={() => settingsQ.refetch()}
          noHeader
        />
      ) : (
        <OnlineCardTab businessId={businessId!} />
      )}
    </div>
  );
}

/** F-07-031 — вкладка «Онлайн-оплата картой»: комиссия приходит от платёжной системы, руками не вводится */
function OnlineCardTab({ businessId }: { businessId: string }) {
  const t = useT('finance');
  const onlineQ = useApiQuery(['finance', 'onlinePaymentSettings', businessId], () => getOnlinePaymentSettings(businessId));

  if (onlineQ.isError) return <ErrorState onRetry={() => onlineQ.refetch()} />;
  if (onlineQ.isLoading || !onlineQ.data) return <Skeleton lines={4} />;

  const providerKey = onlineQ.data.providerByWay.widgetPrepayment ?? onlineQ.data.providerByWay.link;
  const provider = ONLINE_PROVIDERS.find((p) => p.key === providerKey);

  return (
    <div data-f="F-07-031 F-13-186" className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <SectionCard title={t('methods.online.title')} description={t('methods.online.description')}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
            <span className="text-sm text-fg">{t('methods.online.provider')}</span>
            <Badge tone={provider ? 'primary' : 'neutral'}>{provider ? t(`online.provider.${provider.key}`) : t('online.providerNone')}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
            <span className="text-sm text-fg">{t('methods.online.commission')}</span>
            <span className="text-sm text-muted">{t('methods.online.commissionHint')}</span>
          </div>
          <Link
            href="/biz/finance/online"
            className="inline-flex min-h-10 w-fit items-center gap-1.5 text-sm font-medium text-primary-text underline decoration-border-strong underline-offset-2"
          >
            {t('online.openSettings')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

/** Настройки на время загрузки: поля пустые, как у демо-бизнеса по составу (карта без брендов, один свой способ) */
const LOADING_METHODS: PaymentMethodsSettings = {
  businessId: '',
  cash: { accountId: null, cashierMode: 'default' },
  card: { perBrand: false, feePct: 0, brands: [], accountId: null, settlementDays: 1 },
  installment: { enabled: false, plans: [] },
  custom: [{ id: 'loading', name: '', feePct: 0, accountId: null, active: true }],
  feeShare: 'business',
  updatedAt: '',
};

function MethodsForm({
  initial,
  accounts,
  onSaved,
  loading = false,
}: {
  initial: PaymentMethodsSettings;
  accounts: Account[];
  onSaved: () => void;
  loading?: boolean;
  noHeader?: boolean;
}) {
  const t = useT('finance');
  const toast = useToast();
  const canEdit = useCan('finance.edit');

  const [draft, setDraft] = useState<PaymentMethodsSettings>(initial);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomFee, setNewCustomFee] = useState<number | undefined>(0);
  const [addingCustom, setAddingCustom] = useState(false);

  const { businessId } = useCurrent();
  const saveM = useApiMutation((s: PaymentMethodsSettings) =>
    savePaymentMethodsSettings(businessId!, { cash: s.cash, card: s.card, installment: s.installment, feeShare: s.feeShare }),
  );
  const addCustomM = useApiMutation((input: { name: string; feePct: number; accountId: string | null }) =>
    addCustomPaymentMethod(businessId!, input),
  );
  const toggleCustomM = useApiMutation((args: { id: string; active: boolean }) =>
    updateCustomPaymentMethod(businessId!, args.id, { active: args.active }),
  );

  const handleSave = async () => {
    try {
      await saveM.mutate(draft);
      toast.success(t('methods.saved'));
      onSaved();
    } catch {
      toast.error(t('methods.saveFailed'));
    }
  };

  const handleAddCustom = async () => {
    if (!newCustomName.trim()) return;
    try {
      await addCustomM.mutate({ name: newCustomName.trim(), feePct: newCustomFee ?? 0, accountId: draft.card.accountId });
      toast.success(t('methods.customAdded'));
      setNewCustomName('');
      setNewCustomFee(0);
      setAddingCustom(false);
      onSaved();
    } catch {
      toast.error(t('methods.saveFailed'));
    }
  };

  const handleToggleCustom = async (id: string, active: boolean) => {
    try {
      await toggleCustomM.mutate({ id, active });
      onSaved();
    } catch {
      toast.error(t('methods.saveFailed'));
    }
  };

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const cashierModeOptions = [
    { value: 'default' as CashCashierMode, title: t('methods.cash.modeDefault'), description: t('methods.cash.modeDefaultHint') },
    { value: 'choose' as CashCashierMode, title: t('methods.cash.modeChoose'), description: t('methods.cash.modeChooseHint') },
    { value: 'disabled' as CashCashierMode, title: t('methods.cash.modeDisabled'), description: t('methods.cash.modeDisabledHint') },
  ];

  const feeShareOptions: { value: AcquiringFeeShareMode; title: string; description: string }[] = [
    { value: 'business', title: t('methods.feeShare.business'), description: t('methods.feeShare.businessHint') },
    { value: 'proportional', title: t('methods.feeShare.proportional'), description: t('methods.feeShare.proportionalHint') },
    { value: 'staffAndBusiness', title: t('methods.feeShare.staffAndBusiness'), description: t('methods.feeShare.staffAndBusinessHint') },
    { value: 'staffAndAssistants', title: t('methods.feeShare.staffAndAssistants'), description: t('methods.feeShare.staffAndAssistantsHint') },
    { value: 'staffOnly', title: t('methods.feeShare.staffOnly'), description: t('methods.feeShare.staffOnlyHint') },
  ];

  return (
    <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
    <div data-f="F-07-025" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      {/* F-07-026 — Наличные; F-07-032 — касса по умолчанию для быстрой оплаты этим методом */}
      <div data-f="F-07-026 F-07-032">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Banknote aria-hidden className="size-4 text-muted" />
              {t('methods.cash.title')}
            </span>
          }
          description={t('methods.cash.description')}
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('methods.cash.account')}</span>
              <Select
                options={accountOptions}
                value={draft.cash.accountId ?? ''}
                onValueChange={(v) => setDraft((d) => (d ? { ...d, cash: { ...d.cash, accountId: v || null } } : d))}
                placeholder={t('methods.selectAccount')}
                disabled={!canEdit}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('methods.cash.chooseCashier')}</span>
              <ChoiceGroup
                options={cashierModeOptions.map((o) => ({ value: o.value, title: o.title, description: o.description }))}
                value={draft.cash.cashierMode}
                onValueChange={(v) => setDraft((d) => (d ? { ...d, cash: { ...d.cash, cashierMode: v as CashCashierMode } } : d))}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* F-07-027/028 — Банковская карта (для Армении один вид «Банковская карта», F-07-028) */}
      <div data-f="F-07-027 F-07-028 F-07-032 F-07-033">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <CreditCard aria-hidden className="size-4 text-muted" />
              {t('methods.card.title')}
            </span>
          }
          description={t('methods.card.description')}
        >
          <div className="flex flex-col gap-4">
            <Switch
              label={t('methods.card.perBrand')}
              description={t('methods.card.perBrandHint')}
              checked={draft.card.perBrand}
              onCheckedChange={(v) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        card: {
                          ...d.card,
                          perBrand: v,
                          brands:
                            v && d.card.brands.length === 0
                              ? [
                                  { brand: 'visa', feePct: d.card.feePct },
                                  { brand: 'mastercard', feePct: d.card.feePct },
                                ]
                              : d.card.brands,
                        },
                      }
                    : d,
                )
              }
              disabled={!canEdit}
            />
            {draft.card.perBrand ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {draft.card.brands.map((b) => (
                  <label key={b.brand} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium capitalize">{b.brand}</span>
                    <NumberField
                      value={b.feePct}
                      onValueChange={(v) =>
                        setDraft((d) =>
                          d ? { ...d, card: { ...d.card, brands: d.card.brands.map((x) => (x.brand === b.brand ? { ...x, feePct: v } : x)) } } : d,
                        )
                      }
                      suffix="%"
                      disabled={!canEdit}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <label className="flex flex-col gap-1.5 sm:max-w-xs">
                <span className="text-sm font-medium">{t('methods.card.feePct')}</span>
                <NumberField
                  value={draft.card.feePct}
                  onValueChange={(v) => setDraft((d) => (d ? { ...d, card: { ...d.card, feePct: v } } : d))}
                  suffix="%"
                  disabled={!canEdit}
                />
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('methods.card.account')}</span>
                <Select
                  options={accountOptions}
                  value={draft.card.accountId ?? ''}
                  onValueChange={(v) => setDraft((d) => (d ? { ...d, card: { ...d.card, accountId: v || null } } : d))}
                  placeholder={t('methods.selectAccount')}
                  disabled={!canEdit}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('methods.card.settlementDays')}</span>
                <NumberField
                  value={draft.card.settlementDays}
                  onValueChange={(v) => setDraft((d) => (d ? { ...d, card: { ...d.card, settlementDays: v } } : d))}
                  suffix={t('methods.card.calendarDays')}
                  disabled={!canEdit}
                />
              </label>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* F-07-029 — Рассрочка */}
      <div data-f="F-07-029">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Layers aria-hidden className="size-4 text-muted" />
              {t('methods.installment.title')}
            </span>
          }
          description={t('methods.installment.description')}
        >
          <div className="flex flex-col gap-4">
            <Switch
              label={t('methods.installment.enable')}
              checked={draft.installment.enabled}
              onCheckedChange={(v) => setDraft((d) => (d ? { ...d, installment: { ...d.installment, enabled: v } } : d))}
              disabled={!canEdit}
            />
            {draft.installment.enabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                {draft.installment.plans.map((p) => (
                  <label key={p.id} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('methods.installment.plan', { months: p.months })}</span>
                    <NumberField
                      value={p.feePct}
                      onValueChange={(v) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                installment: { ...d.installment, plans: d.installment.plans.map((x) => (x.id === p.id ? { ...x, feePct: v } : x)) },
                              }
                            : d,
                        )
                      }
                      suffix="%"
                      disabled={!canEdit}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* F-07-030 — Свой способ оплаты */}
      <div data-f="F-07-030">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Wallet aria-hidden className="size-4 text-muted" />
              {t('methods.custom.title')}
            </span>
          }
          description={t('methods.custom.description')}
          actions={
            canEdit ? (
              <Button size="sm" variant="secondary" leftIcon={<Plus aria-hidden className="size-4" />} onClick={() => setAddingCustom((v) => !v)}>
                {t('methods.custom.add')}
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-3">
            {draft.custom.length === 0 && !addingCustom ? (
              <p className="text-sm text-muted">{t('methods.custom.empty')}</p>
            ) : (
              draft.custom.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{loading ? <SkeletonText width="8ch" /> : c.name}</span>
                    <span className="text-xs text-muted">
                      {loading ? (
                        <SkeletonText width="22ch" />
                      ) : (
                        t('methods.custom.feeAndAccount', { fee: c.feePct, account: accounts.find((a) => a.id === c.accountId)?.name ?? '—' })
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={c.active ? 'success' : 'neutral'}>
                      {loading ? <SkeletonText width="9ch" /> : c.active ? t('methods.custom.connected') : t('methods.custom.disconnected')}
                    </Badge>
                    {canEdit && (
                      <Switch checked={c.active} onCheckedChange={(v) => handleToggleCustom(c.id, v)} aria-label={t('methods.custom.toggle')} />
                    )}
                  </div>
                </div>
              ))
            )}
            <Collapse open={addingCustom}>
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('methods.custom.name')}</span>
                    <Input value={newCustomName} onChange={(e) => setNewCustomName(e.target.value)} placeholder={t('methods.custom.namePlaceholder')} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('methods.card.feePct')}</span>
                    <NumberField value={newCustomFee ?? 0} onValueChange={setNewCustomFee} suffix="%" />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAddingCustom(false)}>
                    {t('methods.custom.cancel')}
                  </Button>
                  <Button size="sm" loading={addCustomM.isPending} disabled={!newCustomName.trim()} onClick={handleAddCustom}>
                    {t('methods.custom.save')}
                  </Button>
                </div>
              </div>
            </Collapse>
          </div>
        </SectionCard>
      </div>

      {/* F-07-035 — Кто платит комиссию банка в зарплате */}
      <div data-f="F-07-035">
        <SectionCard title={t('methods.feeShare.title')} description={t('methods.feeShare.description')}>
          <ChoiceGroup
            options={feeShareOptions}
            value={draft.feeShare}
            onValueChange={(v) => setDraft((d) => (d ? { ...d, feeShare: v as AcquiringFeeShareMode } : d))}
          />
        </SectionCard>
      </div>

      {canEdit && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-10 flex justify-end">
          <Button size="lg" loading={saveM.isPending} onClick={handleSave}>
            {t('methods.save')}
          </Button>
        </div>
      )}
    </div>
    </fieldset>
  );
}

'use client';

/**
 * /biz/finance/policy — «Политика оплаты» (b05, F-07-101…110, F-07-130): три режима (без политики / депозит /
 * гарантия картой), настройки режима, охват (услуги, сотрудники, клиенты, минимальная сумма), сохранение и
 * карточка «Activated». Гарантия картой недоступна без подключённого Adyen (F-07-104/135, → /biz/finance/adyen).
 * Своя политика услуги (F-07-106) — список переопределений здесь же (карточки услуг — чужой путь, не наш).
 * ⭐ F-00-028: приём денег онлайн отложен — экран целиком работает на моках, с видимой пометкой «демо».
 * Счёт клиента «Payment Policy» (F-07-112) — areas/finance/policy/PolicyAccountSection.tsx (вклад ClientCard).
 * Снимок и действия по записи (F-07-113…122) — areas/finance/policy/PolicyBookingBlock.tsx (вклад BookingWindow).
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Info, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import {
  getAdyenConnection,
  getOnlinePaymentSettings,
  getPaymentPolicy,
  listServicePolicyOverrides,
  listServicesBrief,
  listStaffBriefFinance,
  savePaymentPolicy,
  setServicePolicyOverride,
  type PaymentPolicyPatch,
} from '@/api/finance';
import { ApiError } from '@/api/request';
import {
  DEFAULT_POLICY_CARD_GUARANTEE,
  DEFAULT_POLICY_DEPOSIT,
  policyAmountValue,
  type PaymentPolicy,
  type PaymentPolicyCardGuaranteeSettings,
  type PaymentPolicyConditions,
  type PaymentPolicyDepositSettings,
  type PaymentPolicyMode,
  type PaymentPolicyServiceOverride,
  type PolicyAmount,
  type PolicyClientScope,
} from '@/domain/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ClientPolicyPreviewModal } from '@/areas/finance/policy/ClientPolicyPreviewModal';
import { useCan, useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { SkeletonText } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function PolicyScreen() {
  const t = useT('finance');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');

  const policyQ = useApiQuery(['finance', 'policy', businessId], () => getPaymentPolicy(businessId!), { enabled: ready && Boolean(businessId) });
  const adyenQ = useApiQuery(['finance', 'adyen', businessId], () => getAdyenConnection(businessId!), { enabled: ready && Boolean(businessId) });
  const onlineQ = useApiQuery(['finance', 'onlinePaymentSettings', businessId], () => getOnlinePaymentSettings(businessId!), { enabled: ready && Boolean(businessId) });
  const servicesQ = useApiQuery(['finance', 'policyServices', businessId], () => listServicesBrief(businessId!), { enabled: ready && Boolean(businessId) });
  const staffQ = useApiQuery(['finance', 'policyStaff', businessId], () => listStaffBriefFinance(businessId!), { enabled: ready && Boolean(businessId) });
  const overridesQ = useApiQuery(['finance', 'policyOverrides', businessId], () => listServicePolicyOverrides(businessId!), { enabled: ready && Boolean(businessId) });

  const saveM = useApiMutation((patch: PaymentPolicyPatch) => savePaymentPolicy(businessId!, patch));

  if (policyQ.isError || adyenQ.isError || onlineQ.isError || servicesQ.isError || staffQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('policy.title')} />
        <ErrorState
          onRetry={() => {
            policyQ.refetch();
            adyenQ.refetch();
            onlineQ.refetch();
            servicesQ.refetch();
            staffQ.refetch();
          }}
        />
      </div>
    );
  }

  if (!policyQ.data || !adyenQ.data || !onlineQ.data || !servicesQ.data || !staffQ.data || !overridesQ.data) {
    return <PolicySkeleton />;
  }

  return (
    <PolicyForm
      key={policyQ.data.updatedAt}
      initial={policyQ.data}
      adyenConnected={adyenQ.data.status === 'connected'}
      anyPaymentSystemConnected={adyenQ.data.status === 'connected' || Object.values(onlineQ.data.providerByWay).some((p) => p !== null)}
      services={servicesQ.data}
      staff={staffQ.data}
      overrides={overridesQ.data}
      canEdit={canEdit}
      pending={saveM.isPending}
      onSave={saveM.mutate}
      onSaved={() => {
        policyQ.refetch();
        overridesQ.refetch();
        toast.success(t('policy.saved'));
      }}
      onFail={(e) => toast.error(e instanceof ApiError ? e.message : t('policy.saveFailed'))}
      onOverridesChanged={() => overridesQ.refetch()}
    />
  );
}

const MODES: PaymentPolicyMode[] = ['none', 'deposit', 'cardGuarantee'];

function PolicyForm({
  initial,
  adyenConnected,
  anyPaymentSystemConnected,
  services,
  staff,
  overrides,
  canEdit,
  pending,
  onSave,
  onSaved,
  onFail,
  onOverridesChanged,
}: {
  initial: PaymentPolicy;
  adyenConnected: boolean;
  anyPaymentSystemConnected: boolean;
  services: { id: string; name: string; free: boolean }[];
  staff: { id: string; name: string }[];
  overrides: PaymentPolicyServiceOverride[];
  canEdit: boolean;
  pending: boolean;
  onSave: (patch: PaymentPolicyPatch) => Promise<PaymentPolicy>;
  onSaved: () => void;
  onFail: (e: unknown) => void;
  onOverridesChanged: () => void;
}) {
  const t = useT('finance');
  const format = useFormat();
  const [mode, setMode] = useState<PaymentPolicyMode>(initial.mode);
  const [deposit, setDeposit] = useState<PaymentPolicyDepositSettings>(initial.deposit);
  const [cardGuarantee, setCardGuarantee] = useState<PaymentPolicyCardGuaranteeSettings>(initial.cardGuarantee);
  const [conditions, setConditions] = useState<PaymentPolicyConditions>(initial.conditions);
  const [overrideTarget, setOverrideTarget] = useState<{ id: string; name: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSave = async () => {
    try {
      await onSave({ mode, deposit, cardGuarantee, conditions });
      onSaved();
    } catch (e) {
      onFail(e);
    }
  };

  const overrideByService = new Map(overrides.map((o) => [o.serviceId, o]));
  const activeSample = 10000;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-6">
      <PageHeader title={t('policy.title')} description={t('policy.subtitle')} />

      <div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>{t('policy.demoBanner')}</p>
      </div>

      {mode !== 'none' && (
        <Button variant="secondary" className="self-start" onClick={() => setPreviewOpen(true)}>
          {t('policy.clientPreview.open')}
        </Button>
      )}

      {initial.mode !== 'none' && initial.activatedAt && initial.lastSnapshot && (
        <div data-f="F-07-110">
          <SectionCard title={<span className="flex items-center gap-2 text-success"><ShieldCheck aria-hidden className="size-4" />{t('policy.activatedTitle')}</span>}>
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted">{t('policy.activatedSince')} {format.dateTime(initial.activatedAt)}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {initial.lastSnapshot.depositAmountLabel && <KV label={t('policy.activatedDeposit')} value={initial.lastSnapshot.depositAmountLabel} />}
                {initial.lastSnapshot.lateCancellationFeeLabel && <KV label={t('policy.activatedLateFee')} value={initial.lastSnapshot.lateCancellationFeeLabel} />}
                {initial.lastSnapshot.noShowFeeLabel && <KV label={t('policy.activatedNoShowFee')} value={initial.lastSnapshot.noShowFeeLabel} />}
                {initial.lastSnapshot.freeCancellationWindowHours !== undefined && <KV label={t('policy.activatedWindow')} value={format.duration(initial.lastSnapshot.freeCancellationWindowHours * 60)} />}
                {initial.lastSnapshot.deadlineMin !== undefined && <KV label={t('policy.activatedDeadline')} value={format.duration(initial.lastSnapshot.deadlineMin)} />}
                <KV label={t('policy.activatedScope')} value={t(`policy.conditions.clientScope.${initial.lastSnapshot.clientScope}`)} />
              </div>
            </div>
          </SectionCard>
        </div>
      )}
      {mode === 'none' && !(initial.mode !== 'none' && initial.activatedAt) && <p className="text-sm text-muted">{t('policy.notActivatedHint')}</p>}

      <SectionCard title={t('policy.modeTitle')}>
        <div data-f="F-07-101">
          <ChoiceGroup
            options={MODES.map((m) => ({
              value: m,
              title: t(`policy.mode.${m}`),
              description: t(`policy.modeHint.${m}`),
              disabled: (m === 'cardGuarantee' && !adyenConnected) || (m === 'deposit' && !anyPaymentSystemConnected),
            }))}
            value={mode}
            onValueChange={(v) => setMode(v as PaymentPolicyMode)}
          />
        </div>
        {!anyPaymentSystemConnected && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
            <span className="text-muted">{t('policy.needsPaymentSystem')}</span>
            <Link href="/biz/finance/online">
              <Button size="sm" variant="secondary">
                {t('policy.connectPaymentSystem')}
              </Button>
            </Link>
          </div>
        )}
        {anyPaymentSystemConnected && !adyenConnected && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
            <span className="text-muted">{t('policy.needsAdyen')}</span>
            <Link href="/biz/finance/adyen">
              <Button size="sm" variant="secondary">
                {t('policy.connectAdyen')}
              </Button>
            </Link>
          </div>
        )}
        {anyPaymentSystemConnected && (
          <Badge tone="success" className="mt-3">
            {adyenConnected ? t('policy.adyenConnected') : t('policy.paymentSystemConnected')}
          </Badge>
        )}
      </SectionCard>

      {mode === 'deposit' && (
        <div data-f="F-07-102 F-07-103">
          <SectionCard title={t('policy.tabs.deposit')}>
            <div className="flex flex-col gap-5">
              <label className="flex max-w-[220px] flex-col gap-1.5">
                <span className="text-sm font-medium">{t('policy.deposit.deadlineLabel')}</span>
                <Input type="number" inputMode="numeric" min={1} value={deposit.paymentDeadlineMin} onChange={(e) => setDeposit((d) => ({ ...d, paymentDeadlineMin: Math.max(1, Number(e.target.value) || 1) }))} disabled={!canEdit} rightSlot={<span className="text-xs text-muted">{t('policy.deposit.deadlineHint').split(' —')[0]}</span>} />
                <span className="text-xs text-muted">{t('policy.deposit.deadlineHint')}</span>
              </label>

              <AmountField label={t('policy.deposit.amountTitle')} amount={deposit.amount} onChange={(a) => setDeposit((d) => ({ ...d, amount: a }))} disabled={!canEdit} percentLabel={t('policy.deposit.amountPercent')} fixedLabel={t('policy.deposit.amountFixed')} />
              {(!deposit.amount.value || deposit.amount.value <= 0) && <p data-f="F-07-102" className="text-xs text-danger">{t('policy.deposit.amountZeroError')}</p>}
              <p className="text-xs text-muted">{t('policy.deposit.amountTitle')}: {format.money(policyAmountValue(deposit.amount, activeSample))} · {format.money(activeSample)} {t('policy.deposit.amountFixed') === 'Amount, ֏' ? '' : ''}</p>

              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <span className="text-sm font-medium">{t('policy.deposit.rulesTitle')}</span>
                <Switch label={t('policy.deposit.creditOnCancel')} checked={deposit.creditDepositOnCancel} onCheckedChange={(v) => setDeposit((d) => ({ ...d, creditDepositOnCancel: v }))} disabled={!canEdit} />
                {deposit.creditDepositOnCancel && (
                  <label className="flex max-w-[220px] flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('policy.deposit.freeWindowLabel')}</span>
                    <Input type="number" inputMode="numeric" min={1} max={72} value={deposit.freeCancellationWindowHours} onChange={(e) => setDeposit((d) => ({ ...d, freeCancellationWindowHours: Number(e.target.value) || 1 }))} disabled={!canEdit} rightSlot={<span className="text-xs text-muted">ч</span>} invalid={deposit.freeCancellationWindowHours < 1 || deposit.freeCancellationWindowHours > 72} />
                    <span className="text-xs text-muted">{t('policy.deposit.freeWindowHint')}</span>
                    {(deposit.freeCancellationWindowHours < 1 || deposit.freeCancellationWindowHours > 72) && <span className="text-xs text-danger">{t('policy.deposit.freeWindowError')}</span>}
                  </label>
                )}
                <Switch label={t('policy.deposit.allowNotCharge')} checked={deposit.allowReceptionistNotCharge} onCheckedChange={(v) => setDeposit((d) => ({ ...d, allowReceptionistNotCharge: v }))} disabled={!canEdit} />
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <span className="text-sm font-medium">{t('policy.deposit.noShowFeeAboveTitle')}</span>
                {adyenConnected ? (
                  <MoneyInput value={deposit.noShowFeeAboveDeposit} onValueChange={(v) => setDeposit((d) => ({ ...d, noShowFeeAboveDeposit: v }))} disabled={!canEdit} placeholder={String(policyAmountValue(deposit.amount, activeSample))} />
                ) : (
                  <p className="text-xs text-muted">{t('policy.deposit.noShowFeeAboveHint')}</p>
                )}
              </div>

              <p className="text-xs text-muted">{t('policy.deposit.membershipHint')}</p>
            </div>
          </SectionCard>
        </div>
      )}

      {mode === 'cardGuarantee' && (
        <div data-f="F-07-104">
          <SectionCard title={t('policy.tabs.cardGuarantee')}>
            <div className="flex flex-col gap-5">
              <label className="flex max-w-[220px] flex-col gap-1.5">
                <span className="text-sm font-medium">{t('policy.cardGuarantee.deadlineLabel')}</span>
                <Input type="number" inputMode="numeric" min={1} value={cardGuarantee.deadlineMin} onChange={(e) => setCardGuarantee((c) => ({ ...c, deadlineMin: Math.max(1, Number(e.target.value) || 1) }))} disabled={!canEdit} rightSlot={<span className="text-xs text-muted">мин</span>} />
                <span className="text-xs text-muted">{t('policy.cardGuarantee.deadlineHint')}</span>
              </label>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <Switch label={t('policy.cardGuarantee.lateFeeToggle')} checked={cardGuarantee.chargeLateCancellationFee} onCheckedChange={(v) => setCardGuarantee((c) => ({ ...c, chargeLateCancellationFee: v }))} disabled={!canEdit} />
                {cardGuarantee.chargeLateCancellationFee && <AmountField label={t('policy.cardGuarantee.lateFeeTitle')} amount={cardGuarantee.lateCancellationFee} onChange={(a) => setCardGuarantee((c) => ({ ...c, lateCancellationFee: a }))} disabled={!canEdit} percentLabel={t('policy.cardGuarantee.percent')} fixedLabel={t('policy.cardGuarantee.fixed')} />}
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <Switch label={t('policy.cardGuarantee.freeCancelToggle')} checked={cardGuarantee.allowFreeCancellation} onCheckedChange={(v) => setCardGuarantee((c) => ({ ...c, allowFreeCancellation: v }))} disabled={!canEdit} />
                {cardGuarantee.allowFreeCancellation && (
                  <label className="flex max-w-[220px] flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('policy.cardGuarantee.freeWindowLabel')}</span>
                    <Input type="number" inputMode="numeric" min={1} max={72} value={cardGuarantee.freeCancellationWindowHours} onChange={(e) => setCardGuarantee((c) => ({ ...c, freeCancellationWindowHours: Number(e.target.value) || 1 }))} disabled={!canEdit} rightSlot={<span className="text-xs text-muted">ч</span>} invalid={cardGuarantee.freeCancellationWindowHours < 1 || cardGuarantee.freeCancellationWindowHours > 72} />
                    <span className="text-xs text-muted">{t('policy.cardGuarantee.freeWindowHint')}</span>
                    {(cardGuarantee.freeCancellationWindowHours < 1 || cardGuarantee.freeCancellationWindowHours > 72) && <span className="text-xs text-danger">{t('policy.cardGuarantee.freeWindowError')}</span>}
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <Switch label={t('policy.cardGuarantee.noShowFeeToggle')} checked={cardGuarantee.chargeNoShowFee} onCheckedChange={(v) => setCardGuarantee((c) => ({ ...c, chargeNoShowFee: v }))} disabled={!canEdit} />
                {cardGuarantee.chargeNoShowFee && <AmountField label={t('policy.cardGuarantee.noShowFeeTitle')} amount={cardGuarantee.noShowFee} onChange={(a) => setCardGuarantee((c) => ({ ...c, noShowFee: a }))} disabled={!canEdit} percentLabel={t('policy.cardGuarantee.percent')} fixedLabel={t('policy.cardGuarantee.fixed')} />}
              </div>

              <Switch label={t('policy.cardGuarantee.allowNotCharge')} checked={cardGuarantee.allowReceptionistNotCharge} onCheckedChange={(v) => setCardGuarantee((c) => ({ ...c, allowReceptionistNotCharge: v }))} disabled={!canEdit} />
              <p className="text-xs text-muted">{t('policy.deposit.membershipHint')}</p>
            </div>
          </SectionCard>
        </div>
      )}

      {mode !== 'none' && (
        <div data-f="F-07-105 F-07-107 F-07-108 F-07-109" className="flex flex-col gap-6">
          <SectionCard title={t('policy.conditions.servicesTitle')} description={t('policy.conditions.servicesHint')}>
            {services.length === 0 ? (
              <EmptyState compact title={t('policy.conditions.servicesEmpty')} />
            ) : (
              <div className="flex flex-col gap-2.5">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        label={s.name}
                        checked={!s.free && !conditions.excludedServiceIds.includes(s.id)}
                        onCheckedChange={(v) => setConditions((c) => ({ ...c, excludedServiceIds: v ? c.excludedServiceIds.filter((id) => id !== s.id) : [...c.excludedServiceIds, s.id] }))}
                        disabled={!canEdit || s.free}
                      />
                      {s.free && <Badge tone="neutral">{t('policy.conditions.serviceFree')}</Badge>}
                    </div>
                    <IconButton label={t('policy.overrideAdd')} icon={<Pencil aria-hidden className="size-4" />} size="sm" variant="ghost" onClick={() => setOverrideTarget(s)} disabled={s.free} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('policy.conditions.staffTitle')} description={t('policy.conditions.staffHint')}>
            {staff.length === 0 ? (
              <EmptyState compact title={t('policy.conditions.staffEmpty')} />
            ) : (
              <div className="flex flex-col gap-2.5">
                {staff.map((s) => (
                  <Checkbox key={s.id} label={s.name} checked={!conditions.excludedStaffIds.includes(s.id)} onCheckedChange={(v) => setConditions((c) => ({ ...c, excludedStaffIds: v ? c.excludedStaffIds.filter((id) => id !== s.id) : [...c.excludedStaffIds, s.id] }))} disabled={!canEdit} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('policy.conditions.clientsTitle')}>
            <div className="flex flex-col gap-4">
              <SegmentedControl
                options={(['all', 'new', 'existing'] as PolicyClientScope[]).map((v) => ({ value: v, label: t(`policy.conditions.clientScope.${v}`) }))}
                value={conditions.clientScope}
                onValueChange={(v) => setConditions((c) => ({ ...c, clientScope: v as PolicyClientScope }))}
                fullWidth
              />
              <div data-f="F-07-123" className="border-t border-border pt-4">
                <Switch label={t('policy.conditions.debtorsToggle')} checked={conditions.applyToDebtors} onCheckedChange={(v) => setConditions((c) => ({ ...c, applyToDebtors: v }))} disabled={!canEdit} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('policy.conditions.selfServiceTitle')} description={t('policy.conditions.selfServiceHint')}>
            <div data-f="F-07-099" className="flex flex-col gap-3">
              <Switch label={t('policy.conditions.selfCancel')} checked={conditions.allowClientSelfCancelPrepaid} onCheckedChange={(v) => setConditions((c) => ({ ...c, allowClientSelfCancelPrepaid: v }))} disabled={!canEdit} />
              <Switch label={t('policy.conditions.selfReschedule')} checked={conditions.allowClientSelfReschedulePrepaid} onCheckedChange={(v) => setConditions((c) => ({ ...c, allowClientSelfReschedulePrepaid: v }))} disabled={!canEdit} />
            </div>
          </SectionCard>

          <SectionCard title={t('policy.conditions.minAmountToggle')}>
            <div className="flex flex-col gap-3">
              <Switch label={t('policy.conditions.minAmountToggle')} checked={conditions.minVisitAmountEnabled} onCheckedChange={(v) => setConditions((c) => ({ ...c, minVisitAmountEnabled: v }))} disabled={!canEdit} />
              {conditions.minVisitAmountEnabled && (
                <label className="flex max-w-[220px] flex-col gap-1.5">
                  <span className="text-sm font-medium">{t('policy.conditions.minAmountLabel')}</span>
                  <MoneyInput value={conditions.minVisitAmount} onValueChange={(v) => setConditions((c) => ({ ...c, minVisitAmount: v ?? 0 }))} disabled={!canEdit} />
                </label>
              )}
            </div>
          </SectionCard>

          <div data-f="F-07-106">
          <SectionCard title={t('policy.overridesTitle')} description={t('policy.overridesHint')}>
            {overrides.length === 0 ? (
              <EmptyState compact title={t('policy.overridesEmpty')} />
            ) : (
              <div className="flex flex-col gap-2">
                {overrides.map((o) => {
                  const service = services.find((s) => s.id === o.serviceId);
                  return (
                    <div key={o.serviceId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{service?.name ?? o.serviceId}</span>
                        <span className="text-xs text-muted">{t(`policy.mode.${o.mode}`)}</span>
                      </div>
                      {canEdit && (
                        <IconButton
                          label={t('policy.overrideRemove')}
                          icon={<Trash2 aria-hidden className="size-4 text-danger" />}
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await setServicePolicyOverride(initial.businessId, o.serviceId, null);
                            onOverridesChanged();
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
          </div>
        </div>
      )}

      {canEdit && (
        <StickyActionBar>
          <Button size="lg" loading={pending} onClick={handleSave}>
            {t('policy.save')}
          </Button>
        </StickyActionBar>
      )}

      <ExitHold value={previewOpen}>
        {() => (
        <ClientPolicyPreviewModal
          businessId={initial.businessId}
          mode={mode}
          deposit={deposit}
          cardGuarantee={cardGuarantee}
          onClose={() => setPreviewOpen(false)}
        />
        )}
      </ExitHold>

      <ExitHold value={overrideTarget}>
        {(overrideTarget) => (
        <ServiceOverrideModal
          service={overrideTarget}
          businessId={initial.businessId}
          existing={overrideByService.get(overrideTarget.id) ?? null}
          onClose={() => setOverrideTarget(null)}
          onSaved={() => {
            setOverrideTarget(null);
            onOverridesChanged();
          }}
        />
        )}
      </ExitHold>
    </div>
  );
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="text-sm">
      <span className="text-muted">{label}: </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

/**
 * Скелетон страницы политики — та же разметка, что у формы с действующей политикой (так у демо-бизнеса): шапка,
 * плашка демо, кнопка «Как видит клиент», карточка «Политика действует» с парами «подпись: значение», выбор режима.
 */
function PolicySkeleton() {
  const t = useT('finance');
  const canEdit = useCan('finance.edit');
  return (
    <div aria-busy className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-6">
      <PageHeader title={t('policy.title')} description={t('policy.subtitle')} />

      <div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>{t('policy.demoBanner')}</p>
      </div>

      <Button variant="secondary" className="self-start" disabled>
        {t('policy.clientPreview.open')}
      </Button>

      <SectionCard title={<span className="flex items-center gap-2 text-success"><ShieldCheck aria-hidden className="size-4" />{t('policy.activatedTitle')}</span>}>
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted">
            {t('policy.activatedSince')} <SkeletonText width="14ch" />
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            <KV label={t('policy.activatedDeposit')} value={<SkeletonText width="3ch" />} />
            <KV label={t('policy.activatedWindow')} value={<SkeletonText width="4ch" />} />
            <KV label={t('policy.activatedDeadline')} value={<SkeletonText width="6ch" />} />
            <KV label={t('policy.activatedScope')} value={<SkeletonText width="10ch" />} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('policy.modeTitle')}>
        <ChoiceGroup
          options={MODES.map((m) => ({ value: m, title: t(`policy.mode.${m}`), description: t(`policy.modeHint.${m}`), disabled: true }))}
          value=""
          onValueChange={() => {}}
        />
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
          <span className="text-muted">{t('policy.needsAdyen')}</span>
          <Button size="sm" variant="secondary" disabled>
            {t('policy.connectAdyen')}
          </Button>
        </div>
        <Badge tone="success" className="mt-3">
          {t('policy.paymentSystemConnected')}
        </Badge>
      </SectionCard>

      {canEdit && (
        <StickyActionBar>
          <Button size="lg" disabled>
            {t('policy.save')}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}

function AmountField({ label, amount, onChange, disabled, percentLabel, fixedLabel }: { label: string; amount: PolicyAmount; onChange: (a: PolicyAmount) => void; disabled?: boolean; percentLabel: string; fixedLabel: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          options={[
            { value: 'percent', label: percentLabel },
            { value: 'fixed', label: fixedLabel },
          ]}
          value={amount.mode}
          onValueChange={(v) => onChange({ mode: v as PolicyAmount['mode'], value: amount.value })}
        />
        {amount.mode === 'percent' ? (
          <Input type="number" inputMode="numeric" min={0} max={100} className="max-w-[120px]" value={amount.value} onChange={(e) => onChange({ ...amount, value: Number(e.target.value) || 0 })} disabled={disabled} rightSlot={<span className="text-xs text-muted">%</span>} />
        ) : (
          <MoneyInput className="max-w-[160px]" value={amount.value} onValueChange={(v) => onChange({ ...amount, value: v ?? 0 })} disabled={disabled} />
        )}
      </div>
    </div>
  );
}

function ServiceOverrideModal({ service, businessId, existing, onClose, onSaved }: { service: { id: string; name: string }; businessId: string; existing: PaymentPolicyServiceOverride | null; onClose: () => void; onSaved: () => void }) {
  const t = useT('finance');
  const toast = useToast();
  const [mode, setMode] = useState<'deposit' | 'cardGuarantee'>(existing?.mode ?? 'deposit');
  const [deposit, setDeposit] = useState<PaymentPolicyDepositSettings>(existing?.deposit ?? DEFAULT_POLICY_DEPOSIT);
  const [cardGuarantee, setCardGuarantee] = useState<PaymentPolicyCardGuaranteeSettings>(existing?.cardGuarantee ?? DEFAULT_POLICY_CARD_GUARANTEE);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const override: PaymentPolicyServiceOverride = mode === 'deposit' ? { serviceId: service.id, mode: 'deposit', deposit } : { serviceId: service.id, mode: 'cardGuarantee', cardGuarantee };
      await setServicePolicyOverride(businessId, service.id, override);
      toast.success(t('policy.overrideSaved'));
      onSaved();
    } catch {
      toast.error(t('policy.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await setServicePolicyOverride(businessId, service.id, null);
      toast.success(t('policy.overrideRemoved'));
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={service.name}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {existing ? (
            <Button variant="ghost" onClick={remove} loading={saving}>
              {t('policy.overrideRemove')}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} loading={saving}>
            {t('policy.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl options={[{ value: 'deposit', label: t('policy.mode.deposit') }, { value: 'cardGuarantee', label: t('policy.mode.cardGuarantee') }]} value={mode} onValueChange={(v) => setMode(v as 'deposit' | 'cardGuarantee')} fullWidth />
        {mode === 'deposit' ? (
          <AmountField label={t('policy.deposit.amountTitle')} amount={deposit.amount} onChange={(a) => setDeposit((d) => ({ ...d, amount: a }))} percentLabel={t('policy.deposit.amountPercent')} fixedLabel={t('policy.deposit.amountFixed')} />
        ) : (
          <AmountField label={t('policy.cardGuarantee.noShowFeeTitle')} amount={cardGuarantee.noShowFee} onChange={(a) => setCardGuarantee((c) => ({ ...c, noShowFee: a }))} percentLabel={t('policy.cardGuarantee.percent')} fixedLabel={t('policy.cardGuarantee.fixed')} />
        )}
      </div>
    </Modal>
  );
}

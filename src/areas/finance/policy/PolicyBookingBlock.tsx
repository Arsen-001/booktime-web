'use client';

/**
 * Блок политики оплаты в окне визита (F-07-114): снимок (депозит/штрафы числами), статус (F-07-121), значок
 * срока бесплатной отмены (зелёный/красный), баланс/доступно клиента (F-07-112) и решения — F-07-115
 * (зачесть депозит), F-07-117/118 (поздняя отмена/неявка: взять или простить), F-07-121 (окончательность).
 * Вставляется из extensions/BookingWindow.tsx — тонкая обёртка, вся логика в api/finance.ts.
 * ⭐ F-00-028: демо — на записи без снимка и активной политике есть кнопка «смоделировать» для проверки.
 */
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Calendar, Clock, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import {
  applyPolicyDepositAtCheckout,
  clientCancelBookingWithPolicy,
  clientRescheduleBookingWithPolicy,
  getBookingPolicySnapshot,
  getPaymentPolicy,
  getPolicyAccountSummary,
  resolvePolicyDecision,
  resolvePolicyReschedule,
  type PolicyDecision,
} from '@/api/finance';
import { ApiError } from '@/api/request';
import { useApiQuery } from '@/api/request';
import type { BookingPolicyStatus } from '@/domain/finance';
import { nowDateTime } from '@/lib/date';
import { useCan } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

const STATUS_TONE: Record<BookingPolicyStatus, BadgeTone> = {
  clientAccepted: 'info',
  confirmedAtCheckout: 'success',
  creditedToBalance: 'neutral',
  appliedCharged: 'warning',
  appliedWaived: 'neutral',
  expired: 'danger',
};

const STATUS_LABEL_KEY: Record<BookingPolicyStatus, 'policy.statusClientAccepted' | 'policy.statusConfirmedAtCheckout' | 'policy.statusCreditedToBalance' | 'policy.statusAppliedCharged' | 'policy.statusAppliedWaived' | 'policy.statusExpired'> = {
  clientAccepted: 'policy.statusClientAccepted',
  confirmedAtCheckout: 'policy.statusConfirmedAtCheckout',
  creditedToBalance: 'policy.statusCreditedToBalance',
  appliedCharged: 'policy.statusAppliedCharged',
  appliedWaived: 'policy.statusAppliedWaived',
  expired: 'policy.statusExpired',
};

export function PolicyBookingBlock({ bookingId, businessId, clientId, cancelledLate, noShow, hasPrepayment }: { bookingId?: string; businessId: string; clientId?: string; bookingTotal: number; cancelledLate?: boolean; noShow?: boolean; hasPrepayment?: boolean }) {
  const t = useT('finance');
  const toast = useToast();
  const format = useFormat();
  const canDecide = useCan('finance.edit');
  // F-07-119/120 — состояние живёт здесь (не ниже ранних return'ов), чтобы не менять порядок хуков между рендерами
  const [rescheduleAsk, setRescheduleAsk] = useState<{ newStart: string } | null>(null);
  const [demoBusy2, setDemoBusy2] = useState<'cancel' | 'reschedule' | null>(null);

  const policyQ = useApiQuery(['finance', 'policy', businessId], () => getPaymentPolicy(businessId), { enabled: Boolean(businessId) });
  const snapshotQ = useApiQuery(['finance', 'policySnapshot', bookingId], () => getBookingPolicySnapshot(businessId, bookingId!), { enabled: Boolean(bookingId) });
  const accountQ = useApiQuery(['finance', 'policyAccount', clientId], () => getPolicyAccountSummary(businessId, clientId!), { enabled: Boolean(clientId) });

  if (!bookingId || !policyQ.data || policyQ.data.mode === 'none') return null;

  if (!snapshotQ.data) {
    // Пока грузится — ничего: блок стоит внизу вкладки и не сдвигает оплату (fin-review М2)
    if (snapshotQ.isLoading) return null;
    // У записи есть предоплата по реквизитам (F-00-097) — фраза «политика не применяется» рядом с блоком «Предоплата»
    // читается как противоречие (journal.md, scenarios.md №10): молчим.
    if (hasPrepayment) return null;
    // F-07-126: к записи политика не применялась (не подпадала под охват или создана раньше политики) — одна строка,
    // без служебных «demo»-кнопок в рабочем окне (fin-review Ф10)
    return (
      <p data-f="F-07-114 F-07-126" className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
        {t('policy.notAppliedToBooking')}
      </p>
    );
  }

  const snap = snapshotQ.data;
  const deadlinePassed = snap.freeCancellationDeadline < nowDateTime();
  const pending = snap.status === 'clientAccepted';
  const reason: 'lateCancel' | 'noShow' = noShow ? 'noShow' : 'lateCancel';
  const showDecision = pending && canDecide && (cancelledLate || noShow);

  const decide = async (decision: PolicyDecision) => {
    try {
      await resolvePolicyDecision(businessId, bookingId, decision, reason);
      snapshotQ.refetch();
      accountQ.refetch();
      toast.success(t('policy.decisionDone'));
    } catch {
      toast.error(t('policy.decisionFailed'));
    }
  };

  // F-07-119: перенос администратором — в окне бесплатной отмены сдвигает крайний срок без денег; после окна
  // требует явного решения «взять/простить» (rescheduleAsk), которое даёт то же resolvePolicyReschedule.
  const doReschedule = async (decision?: 'charge' | 'forgive') => {
    const newStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    try {
      await resolvePolicyReschedule(businessId, bookingId, newStart, decision);
      setRescheduleAsk(null);
      snapshotQ.refetch();
      accountQ.refetch();
      toast.success(t('policy.rescheduleDone'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'validation') {
        setRescheduleAsk({ newStart });
      } else {
        toast.error(t('policy.rescheduleFailed'));
      }
    }
  };

  // F-07-120 (демо): клиент отменяет/переносит запись из своего приложения — без хоста на клиентские экраны
  // это единственная точка проверить логику вживую; помечено явно как демо-моделирование, не как боевая кнопка.
  const demoClientCancel = async () => {
    setDemoBusy2('cancel');
    try {
      await clientCancelBookingWithPolicy(businessId, bookingId);
      snapshotQ.refetch();
      accountQ.refetch();
    } finally {
      setDemoBusy2(null);
    }
  };
  const demoClientReschedule = async () => {
    setDemoBusy2('reschedule');
    try {
      await clientRescheduleBookingWithPolicy(businessId, bookingId, new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());
      snapshotQ.refetch();
      accountQ.refetch();
    } finally {
      setDemoBusy2(null);
    }
  };

  const applyDeposit = async () => {
    try {
      const res = await applyPolicyDepositAtCheckout(businessId, bookingId);
      snapshotQ.refetch();
      accountQ.refetch();
      if (res) toast.success(res.refundedToBalance > 0 ? t('policy.refundToBalance') : t('policy.applyDepositDone'));
    } catch {
      toast.error(t('policy.applyDepositFailed'));
    }
  };

  return (
    <div data-f="F-07-114">
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-4" />
            {t('policy.bookingBlockTitle')}
          </span>
        }
        actions={<Badge tone={STATUS_TONE[snap.status]}>{t(STATUS_LABEL_KEY[snap.status])}</Badge>}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {snap.depositAmount !== undefined && <KV label={t('policy.activatedDeposit')} value={format.money(snap.depositAmount)} />}
            {snap.lateCancellationFee !== undefined && <KV label={t('policy.activatedLateFee')} value={format.money(snap.lateCancellationFee)} />}
            {snap.noShowFee !== undefined && <KV label={t('policy.activatedNoShowFee')} value={format.money(snap.noShowFee)} />}
          </div>

          <div className="flex items-center gap-2">
            <Calendar aria-hidden className={`size-4 ${deadlinePassed ? 'text-danger' : 'text-success'}`} />
            <span className={deadlinePassed ? 'text-danger' : 'text-success'}>{deadlinePassed ? t('policy.deadlinePassed') : t('policy.deadlineActive')}</span>
            <span className="text-xs text-muted">· {format.dateTime(snap.freeCancellationDeadline)}</span>
          </div>

          {accountQ.data && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-surface-2 px-3 py-2">
              <KV label={t('policy.accountBalance')} value={<span className={accountQ.data.balance < 0 ? 'text-danger' : ''}>{format.money(accountQ.data.balance)}</span>} />
              <KV label={t('policy.accountAvailable')} value={<span className={accountQ.data.available < 0 ? 'text-danger' : ''}>{format.money(accountQ.data.available)}</span>} />
            </div>
          )}

          <p data-f="F-07-114 F-07-130" className="flex items-center gap-1.5 text-xs text-muted">
            <Lock aria-hidden className="size-3.5" />
            {t('policy.phoneLocked')}
          </p>

          {pending && snap.mode === 'deposit' && !cancelledLate && !noShow && canDecide && (
            <div data-f="F-07-113 F-07-115">
              <Button size="sm" onClick={applyDeposit} className="self-start">
                {t('policy.applyDeposit')}
              </Button>
            </div>
          )}

          {showDecision && (
            <div data-f="F-07-117 F-07-118 F-07-121 F-04-162" className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted">{noShow ? t('policy.decisionNoShowTitle') : t('policy.decisionLateCancelTitle')}</span>
              <div className="flex flex-wrap gap-2">
                {snap.mode === 'deposit' ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => decide('charge')}>
                      {t('policy.decisionCharge')}
                    </Button>
                    {snap.allowReceptionistNotCharge && (
                      <Button size="sm" variant="ghost" onClick={() => decide('credit')}>
                        {t('policy.decisionCredit')}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {/* F-07-122: карта не привязана в демо — списание штрафа гарантии идёт со счёта «Payment Policy» напрямую */}
                    <Button size="sm" variant="secondary" onClick={() => decide('charge')}>
                      {t('policy.decisionChargeFee')}
                    </Button>
                    {snap.allowReceptionistNotCharge && (
                      <Button size="sm" variant="ghost" onClick={() => decide('waive')}>
                        {t('policy.decisionWaive')}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!pending && (
            <p data-f="F-07-121" className="flex items-center gap-1.5 text-xs text-muted">
              <AlertTriangle aria-hidden className="size-3.5" />
              {t('policy.decisionFinal')}
            </p>
          )}

          {pending && canDecide && !cancelledLate && !noShow && (
            <div data-f="F-07-119" className="flex flex-col gap-2 border-t border-border pt-3">
              {rescheduleAsk ? (
                <>
                  <span className="text-xs font-medium text-muted">{t('policy.rescheduleAskTitle')}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => doReschedule('charge')}>
                      {snap.mode === 'deposit' ? t('policy.decisionCharge') : t('policy.decisionChargeFee')}
                    </Button>
                    {snap.allowReceptionistNotCharge && (
                      <Button size="sm" variant="ghost" onClick={() => doReschedule('forgive')}>
                        {t('policy.rescheduleForgive')}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Button size="sm" variant="secondary" leftIcon={<Clock aria-hidden className="size-4" />} className="self-start" onClick={() => doReschedule()}>
                  {t('policy.rescheduleAction')}
                </Button>
              )}
            </div>
          )}

          {pending && (
            <div data-f="F-07-120" className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
              <span className="text-xs text-muted">{t('policy.clientDemoLabel')}</span>
              <Button size="sm" variant="ghost" leftIcon={<Undo2 aria-hidden className="size-3.5" />} loading={demoBusy2 === 'cancel'} onClick={demoClientCancel}>
                {t('policy.clientDemoCancel')}
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<Clock aria-hidden className="size-3.5" />} loading={demoBusy2 === 'reschedule'} onClick={demoClientReschedule}>
                {t('policy.clientDemoReschedule')}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>
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

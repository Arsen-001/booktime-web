'use client';

/**
 * «Как это видит клиент» — демо-предпросмотр виджета онлайн-записи с включённой политикой оплаты.
 * Полноценный виджет — не наш путь (клиентское приложение, extensions без хоста для него нет), поэтому
 * здесь — самодостаточная модалка на выдуманной сумме визита, без побочных эффектов в сторе:
 *  F-07-096 — сумма предоплаты видна до оплаты, статус «Оплачено» после;
 *  F-07-124 — депозит: две галочки согласия, без них кнопка неактивна;
 *  F-07-125 — гарантия картой: те же две галочки, деньги не списываются, карта не сохраняется между визитами;
 *  F-07-127 — «Смоделировать сбой» показывает ошибку и возвращает на шаг условий, ничего не «зависает»;
 *  F-07-128 — текст, который клиент увидит в уведомлении о записи (депозит/штраф/крайний срок).
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react';
import { policyAmountValue, policyFreeCancellationDeadline, type PaymentPolicyCardGuaranteeSettings, type PaymentPolicyDepositSettings, type PaymentPolicyMode } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Modal } from '@/ui/Modal';

const SAMPLE_TOTAL = 10000;

type Step = 'terms' | 'paying' | 'done' | 'failed';

export function ClientPolicyPreviewModal({
  businessId: _businessId,
  mode,
  deposit,
  cardGuarantee,
  onClose,
}: {
  businessId: string;
  mode: PaymentPolicyMode;
  deposit: PaymentPolicyDepositSettings;
  cardGuarantee: PaymentPolicyCardGuaranteeSettings;
  onClose: () => void;
}) {
  const t = useT('finance');
  const format = useFormat();
  const [step, setStep] = useState<Step>('terms');
  const [agreeCharges, setAgreeCharges] = useState(false);
  const [agreeStorage, setAgreeStorage] = useState(false);
  // Выдуманное время визита демо-записи (F-07-096/124/125) — считаем один раз при открытии, не на каждый рендер
  const [sampleStart] = useState(() => new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());

  if (mode === 'none') return null;

  const isDeposit = mode === 'deposit';
  const amount = isDeposit ? policyAmountValue(deposit.amount, SAMPLE_TOTAL) : (cardGuarantee.chargeLateCancellationFee ? policyAmountValue(cardGuarantee.lateCancellationFee, SAMPLE_TOTAL) : 0);
  const noShowFee = isDeposit ? undefined : cardGuarantee.chargeNoShowFee ? policyAmountValue(cardGuarantee.noShowFee, SAMPLE_TOTAL) : undefined;
  const windowHours = isDeposit ? (deposit.creditDepositOnCancel ? deposit.freeCancellationWindowHours : 0) : cardGuarantee.allowFreeCancellation ? cardGuarantee.freeCancellationWindowHours : 0;
  const deadline = policyFreeCancellationDeadline(sampleStart, windowHours || 0);

  const canConfirm = agreeCharges && agreeStorage;

  const confirm = () => {
    if (!canConfirm) return;
    setStep('paying');
    setTimeout(() => setStep('done'), 500);
  };

  const simulateFailure = () => {
    setStep('failed');
  };

  const reset = () => {
    setAgreeCharges(false);
    setAgreeStorage(false);
    setStep('terms');
  };

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={t('policy.clientPreview.title')} description={t('policy.clientPreview.subtitle')}>
      <div data-f="F-07-096 F-07-124 F-07-125 F-07-127 F-07-128" className="flex flex-col gap-4">
        {step === 'terms' && (
          <>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {isDeposit ? <ShieldCheck aria-hidden className="size-4" /> : <CreditCard aria-hidden className="size-4" />}
                {isDeposit ? t('policy.clientPreview.depositTitle') : t('policy.clientPreview.guaranteeTitle')}
              </div>
              <p className="text-muted">{t('policy.clientPreview.serviceLine', { total: format.money(SAMPLE_TOTAL) })}</p>
              {isDeposit ? (
                <p>{t('policy.clientPreview.depositAmount', { amount: format.money(amount) })}</p>
              ) : (
                <>
                  {cardGuarantee.chargeLateCancellationFee && <p>{t('policy.clientPreview.lateFeeAmount', { amount: format.money(amount) })}</p>}
                  {noShowFee !== undefined && <p>{t('policy.clientPreview.noShowFeeAmount', { amount: format.money(noShowFee) })}</p>}
                </>
              )}
              {windowHours > 0 && <p className="text-xs text-muted">{t('policy.clientPreview.freeUntil', { time: format.dateTime(deadline) })}</p>}
            </div>

            <div className="flex flex-col gap-2.5">
              <Checkbox label={t('policy.clientPreview.agreeCharges')} checked={agreeCharges} onCheckedChange={setAgreeCharges} />
              <Checkbox label={isDeposit ? t('policy.clientPreview.agreeStorageDeposit') : t('policy.clientPreview.agreeStorageCard')} checked={agreeStorage} onCheckedChange={setAgreeStorage} />
            </div>

            <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted">
              <p className="mb-1 font-medium text-fg">{t('policy.clientPreview.notificationPreviewTitle')}</p>
              <p>
                {isDeposit
                  ? t('policy.clientPreview.notificationTextDeposit', { amount: format.money(amount), time: format.dateTime(deadline) })
                  : t('policy.clientPreview.notificationTextGuarantee', { amount: format.money(amount), time: format.dateTime(deadline) })}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="text-danger" onClick={simulateFailure}>
                {t('policy.clientPreview.simulateFailure')}
              </Button>
              <Button disabled={!canConfirm} onClick={confirm}>
                {isDeposit ? t('policy.clientPreview.pay') : t('policy.clientPreview.linkCard')}
              </Button>
            </div>
          </>
        )}

        {step === 'paying' && <p className="py-6 text-center text-sm text-muted">{t('policy.clientPreview.processing')}</p>}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 aria-hidden className="size-10 text-success" />
            <p className="font-medium">{isDeposit ? t('policy.clientPreview.paidDone', { amount: format.money(amount) }) : t('policy.clientPreview.cardLinked')}</p>
            <p className="text-xs text-muted">{t('policy.clientPreview.doneHint')}</p>
            <Button variant="secondary" size="sm" onClick={reset}>
              {t('policy.clientPreview.again')}
            </Button>
          </div>
        )}

        {step === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertTriangle aria-hidden className="size-10 text-danger" />
            <p className="font-medium text-danger">{t('policy.clientPreview.failedTitle')}</p>
            <p className="text-xs text-muted">{t('policy.clientPreview.failedHint')}</p>
            <Button size="sm" onClick={reset}>
              {t('policy.clientPreview.retry')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

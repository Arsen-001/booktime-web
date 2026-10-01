'use client';

/**
 * Возврат клиенту (fin-review Ф7/Ф8, F-07-066/067): полный — всё, что клиент заплатил деньгами и со счёта; частичный —
 * любая сумма по одному платежу. Исходная оплата остаётся, возврат пишется отдельной операцией «Возврат» с причиной
 * в комментарии; со счёта клиента деньги уходят обратно на счёт. Примечание к оплате причина не затирает (Ф14).
 */
import { useState } from 'react';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';

export type RefundTarget =
  | { mode: 'full'; amount: number }
  | { mode: 'partial'; lineId: string; key: string; label: string; paid: number; refunded: number; toAccount: boolean };

export interface RefundModalProps {
  target: RefundTarget | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (amount: number, reason: string) => void;
}

export function RefundModal({ target, pending, onClose, onConfirm }: RefundModalProps) {
  const t = useT('finance');
  const format = useFormat();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [forKey, setForKey] = useState<string | null>(null);
  const targetKey = target ? (target.mode === 'full' ? 'full' : target.key) : null;
  if (targetKey !== forKey) {
    setForKey(targetKey);
    setAmount(target?.mode === 'partial' ? target.paid - target.refunded : undefined);
    setReason('');
  }

  const max = target ? (target.mode === 'full' ? target.amount : target.paid - target.refunded) : 0;
  const value = target?.mode === 'full' ? target.amount : (amount ?? 0);
  const invalid = target?.mode === 'partial' && (value <= 0 || value > max);

  return (
    <Modal
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={target?.mode === 'full' ? t('bookingPayment.refundFullTitle') : t('bookingPayment.refundTitle')}
      description={
        target?.mode === 'full'
          ? t('bookingPayment.refundFullText', { amount: format.money(target.amount) })
          : target
            ? t('bookingPayment.refundText', { method: target.label, paid: format.money(target.paid), max: format.money(max) })
            : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('bookingPayment.confirmPayBack')}
          </Button>
          <Button variant="danger" loading={pending} disabled={invalid || value <= 0} onClick={() => onConfirm(value, reason)}>
            {t('bookingPayment.refundConfirm', { amount: format.money(Math.max(0, value)) })}
          </Button>
        </>
      }
    >
      <div data-f={target?.mode === 'full' ? 'F-07-066' : 'F-07-067'} className="flex flex-col gap-3">
        {target?.mode === 'partial' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('bookingPayment.refundAmount')}</span>
            <MoneyInput value={amount} onValueChange={setAmount} max={max} invalid={invalid} />
            {value > max && <span className="text-xs text-danger">{t('bookingPayment.refundTooMuch', { amount: format.money(max) })}</span>}
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('bookingPayment.refundFullReason')}</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('bookingPayment.refundFullReasonPlaceholder')} />
        </label>
        <p className="text-xs text-muted">{target?.mode === 'partial' && target.toAccount ? t('bookingPayment.refundToAccountHint') : t('bookingPayment.refundHint')}</p>
      </div>
    </Modal>
  );
}

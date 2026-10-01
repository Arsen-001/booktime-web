'use client';

import { useState } from 'react';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addMinutes } from '@/lib/date';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

const REASONS = ['plans', 'ill', 'otherTime', 'other'] as const;

/**
 * О20: отмена по правилам — в окне сказано, до какого момента отмена бесплатная и что позже она засчитается
 * неявкой (так и считает cancelOnlineBooking); кнопки «Да, отменить» / «Оставить запись» с разными словами;
 * необязательная причина. Мастер запретил отменять оплаченные записи самим — окно сразу говорит «через мастера».
 */
export function CancelBookingDialog({
  open,
  onOpenChange,
  start,
  cancelWindowHours,
  canCancelFree,
  prepaidAmount = 0,
  keepPrepaymentOnLateCancel = true,
  allowCancelPrepaid = true,
  onConfirm,
  pending,
  hourCycle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: string;
  cancelWindowHours: number | undefined;
  canCancelFree: boolean | undefined;
  /** Внесённая предоплата — окно говорит, вернётся ли она (В-04) */
  prepaidAmount?: number;
  keepPrepaymentOnLateCancel?: boolean;
  /** false — мастер запретил клиентам отменять оплаченные записи (prepaid_locked): без «Да, отменить» */
  allowCancelPrepaid?: boolean;
  onConfirm: (reason: string | undefined) => void;
  pending: boolean;
  hourCycle?: '24' | '12';
}) {
  const t = useT('online');
  const tc = useT('common');
  const format = useFormat({ hourCycle });
  const [reason, setReason] = useState<(typeof REASONS)[number] | undefined>();
  const freeUntil = cancelWindowHours !== undefined ? addMinutes(start, -cancelWindowHours * 60) : undefined;
  const locked = prepaidAmount > 0 && !allowCancelPrepaid;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('confirmed.cancelDialog.title')}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
          <Button variant="secondary" fullWidth onClick={() => onOpenChange(false)}>
            {t('confirmed.cancelDialog.keep')}
          </Button>
          {!locked && (
            <Button variant="danger" fullWidth loading={pending} onClick={() => onConfirm(reason ? t(`confirmed.cancelDialog.reasons.${reason}`) : undefined)}>
              {t('confirmed.cancelDialog.confirm')}
            </Button>
          )}
        </div>
      }
    >
      {locked ? (
        <p className="rounded-xl bg-warning-soft p-3 text-sm text-fg" data-f="F-00-098 F-03-100">
          {tc('bookingErrors.prepaid_locked')}
        </p>
      ) : (
        <div className="flex flex-col gap-4" data-f="F-03-100 F-03-067">
          {freeUntil &&
            (canCancelFree === false ? (
              <p className="rounded-xl bg-warning-soft p-3 text-sm text-fg">{t('confirmed.cancelDialog.late', { date: format.dateTime(freeUntil) })}</p>
            ) : (
              <p className="text-sm text-fg">{t('confirmed.cancelDialog.free', { date: format.dateTime(freeUntil) })}</p>
            ))}
          {prepaidAmount > 0 &&
            (canCancelFree === false && keepPrepaymentOnLateCancel ? (
              <p className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-fg" data-f="F-00-098">
                {t('confirmed.cancelDialog.prepaidKept', { amount: format.money(prepaidAmount) })}
              </p>
            ) : (
              <p className="text-sm font-medium text-fg" data-f="F-00-098">
                {t('confirmed.cancelDialog.prepaidRefund', { amount: format.money(prepaidAmount) })}
              </p>
            ))}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg">{t('confirmed.cancelDialog.reasonLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(reason === r ? undefined : r)}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-full border px-3 text-sm transition-colors',
                    reason === r ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-surface text-fg hover:bg-surface-2',
                  )}
                >
                  {t(`confirmed.cancelDialog.reasons.${r}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

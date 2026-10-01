'use client';

/**
 * Кассовая смена наличной кассы (fin-review Ф1) — на карточке кассы в «Кассах и счетах»: «Открыть смену» (пересчитать
 * ящик — размен), «Закрыть смену» (пересчёт, расхождение с учётом записывается поправкой), Z-отчёт закрытой смены.
 * Свой запрос на кассу — открытие/закрытие перерисовывает только эту карточку.
 */
import { useState } from 'react';
import { Lock, LockOpen, ReceiptText } from 'lucide-react';
import { closeCashShift, isCashShiftSupported, listCashShifts, openCashShift, type CashShiftView } from '@/api/finance';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { SkeletonText } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { ZReportView } from '@/areas/finance/shift/ZReportView';

export interface CashShiftPanelProps {
  businessId: string;
  accountId: string;
  canEdit: boolean;
  /** Остаток кассы по учёту (нет — нет права видеть остаток): в окне открытия показать, с чем сверяем пересчёт */
  balance?: number;
}

export function CashShiftPanel({ businessId, accountId, canEdit, balance }: CashShiftPanelProps) {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const [dialog, setDialog] = useState<'open' | 'close' | 'report' | null>(null);
  const [counted, setCounted] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [reportOf, setReportOf] = useState<CashShiftView | null>(null);

  const supported = isCashShiftSupported();
  const shiftsQ = useApiQuery(['finance', 'cashShifts', businessId, accountId], () => listCashShifts(businessId, accountId), { enabled: supported });
  const openM = useApiMutation((args: { amount: number; comment: string }) => openCashShift(businessId, accountId, args.amount, args.comment));
  const closeM = useApiMutation((args: { shiftId: string; amount: number; comment: string }) => closeCashShift(businessId, args.shiftId, args.amount, args.comment));

  if (!supported) return null;
  // Скелет — в той же рамке и высоте, что строка смены: карточка кассы не растёт при загрузке (М1)
  if (shiftsQ.isLoading || !shiftsQ.data)
    return (
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Lock aria-hidden className="size-4" />
            <SkeletonText width="16ch" />
          </span>
          {canEdit && (
            <span className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" disabled>
                {t('shift.open')}
              </Button>
            </span>
          )}
        </div>
      </div>
    );

  const current = shiftsQ.data.find((v) => v.shift.status === 'open');
  const lastClosed = shiftsQ.data.find((v) => v.shift.status === 'closed');
  // Открытие сверяет пересчёт с остатком по учёту так же, как закрытие: разница уйдёт поправкой — кассир видит её до «Открыть»
  const expected = dialog === 'open' ? (balance ?? 0) : (current?.expectedNow ?? 0);
  const showExpected = dialog === 'close' ? Boolean(current) : dialog === 'open' && balance !== undefined;
  const diff = counted === undefined ? 0 : counted - expected;

  const start = (kind: 'open' | 'close') => {
    setCounted(undefined);
    setComment('');
    setDialog(kind);
  };

  const submit = async () => {
    if (counted === undefined) return;
    try {
      if (dialog === 'open') {
        await openM.mutate({ amount: counted, comment });
        toast.success(t('shift.opened'));
        setDialog(null);
      } else if (dialog === 'close' && current) {
        const view = await closeM.mutate({ shiftId: current.shift.id, amount: counted, comment });
        toast.success(t('shift.closed'));
        setReportOf(view);
        setDialog('report');
      }
      shiftsQ.refetch();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'shift_already_open' ? t('shift.alreadyOpen') : t('shift.failed'));
    }
  };

  return (
    <div data-f="F-07-001" className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 text-sm', current ? 'text-success' : 'text-muted')}>
          {current ? <LockOpen aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
          {current ? t('shift.openSince', { time: format.dateTime(current.shift.openedAt) }) : t('shift.closedNow')}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {current && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ReceiptText aria-hidden />}
              onClick={() => {
                setReportOf(current);
                setDialog('report');
              }}
            >
              {t('shift.currentReport')}
            </Button>
          )}
          {!current && lastClosed && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ReceiptText aria-hidden />}
              onClick={() => {
                setReportOf(lastClosed);
                setDialog('report');
              }}
            >
              {t('shift.lastReport')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant={current ? 'secondary' : 'primary'} onClick={() => start(current ? 'close' : 'open')}>
              {current ? t('shift.close') : t('shift.open')}
            </Button>
          )}
        </span>
      </div>

      <Modal
        open={dialog === 'open' || dialog === 'close'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'close' ? t('shift.closeTitle') : t('shift.openTitle')}
        description={dialog === 'close' ? t('shift.closeText') : t('shift.openText')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t('settlements.payoutCancel')}
            </Button>
            <Button loading={openM.isPending || closeM.isPending} disabled={counted === undefined} onClick={submit}>
              {dialog === 'close' ? t('shift.close') : t('shift.open')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{dialog === 'close' ? t('shift.countedClose') : t('shift.countedOpen')}</span>
            <MoneyInput value={counted} onValueChange={setCounted} autoFocus />
          </label>
          {showExpected && (
            <dl className="flex flex-col gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t('shift.expected')}</dt>
                <dd className="tabular-nums">{format.money(expected)}</dd>
              </div>
              {counted !== undefined && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{diff === 0 ? t('shift.matches') : diff > 0 ? t('shift.surplus') : t('shift.shortage')}</dt>
                  <dd className={cn('font-semibold tabular-nums', diff < 0 ? 'text-danger' : diff > 0 ? 'text-warning-text' : 'text-success')}>{format.money(Math.abs(diff))}</dd>
                </div>
              )}
            </dl>
          )}
          {showExpected && diff !== 0 && counted !== undefined && <p className="text-xs text-muted">{t('shift.adjustmentHint')}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('settlements.comment')}</span>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </label>
        </div>
      </Modal>

      <Modal open={dialog === 'report' && reportOf !== null} onOpenChange={(o) => !o && setDialog(null)} title={t('shift.reportTitle')} size="sm">
        {reportOf && <ZReportView view={reportOf} />}
      </Modal>
    </div>
  );
}

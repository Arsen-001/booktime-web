'use client';

/**
 * «Оплачено» в окне визита (F-07-039/181/042/043): один платёж — одна строка на всю сумму, как бы он ни разнёсся
 * по услугам (fin-review Ф11). У платежа: открыть операцию, «Вернуть деньги» (возврат — отдельная операция, Ф7/Ф8)
 * и «Отменить платёж» (исправление ошибки кассира; после возврата недоступно — касса дня оплаты не меняется
 * задним числом). Возвращённое видно под суммой платежа.
 */
import Link from 'next/link';
import { Gift, Info, Printer, RotateCcw, Trash2 } from 'lucide-react';
import type { BookingPaymentGroup } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { IconButton } from '@/ui/IconButton';
import { Tooltip } from '@/ui/Tooltip';

export interface PaymentHistoryProps {
  groups: BookingPaymentGroup[];
  canRefund: boolean;
  canCancel: boolean;
  cancelling: boolean;
  onRefund: (group: BookingPaymentGroup) => void;
  onCancel: (group: BookingPaymentGroup) => void;
  /** Платежи-зеркала строк лояльности: отменяются только во вкладке «Лояльность» (там вернутся бонусы/сертификат) */
  loyaltyKeys: string[];
}

/** «Скидка по акции «Списание бонусов»» → «Списание бонусов»: у строк лояльности своя подпись */
function loyaltyLabel(label: string): string {
  const m = /^Скидка по акции «(.+)»$/.exec(label);
  return m ? m[1] : label;
}

export function PaymentHistory({ groups, canRefund, canCancel, cancelling, onRefund, onCancel, loyaltyKeys }: PaymentHistoryProps) {
  const t = useT('finance');
  const format = useFormat();

  return (
    <ul data-f="F-07-039" className="flex flex-col gap-2">
      {groups.map((g) => {
        const net = Math.max(0, g.amount - g.refunded);
        const refundable = canRefund && g.kind !== 'discount' && net > 0;
        const fromLoyalty = loyaltyKeys.includes(g.key);
        return (
          <li key={g.key} data-f="F-07-181 F-07-050 F-07-184" className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{fromLoyalty ? loyaltyLabel(g.methodLabel) : g.methodLabel}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {format.dateTime(g.createdAt)}
                {fromLoyalty && (
                  <Badge tone="info" size="sm" icon={<Gift aria-hidden />}>
                    {t('bookingPayment.fromLoyalty')}
                  </Badge>
                )}
                {g.debt && (
                  <Badge tone="danger" size="sm">
                    {t('bookingPayment.debtBadge')}
                  </Badge>
                )}
                {g.refunded > 0 && (
                  <Badge tone={net > 0 ? 'warning' : 'neutral'} size="sm" icon={<RotateCcw aria-hidden />}>
                    {t('bookingPayment.refundedAmount', { amount: format.money(g.refunded) })}
                  </Badge>
                )}
              </span>
            </div>
            <div data-f="F-07-042" className="flex shrink-0 items-center gap-0.5">
              <span className="mr-1 text-sm font-medium tabular-nums">{format.money(g.amount)}</span>
              {g.operationId && (
                <Tooltip content={t('bookingPayment.openOperation')}>
                  <Link
                    href={`/biz/finance/operations/${g.operationId}`}
                    aria-label={t('bookingPayment.openOperation')}
                    className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                  >
                    <Printer aria-hidden className="size-4" />
                  </Link>
                </Tooltip>
              )}
              {refundable && (
                <IconButton data-f="F-07-067" icon={<RotateCcw aria-hidden className="size-4" />} label={t('bookingPayment.refund')} onClick={() => onRefund(g)} />
              )}
              {/* F-07-167: без права на правку оплаченной записи у платежа нет корзины; после возврата — тоже */}
              {/* loyalty-review: строку лояльности отменяют во вкладке «Лояльность» — там клиенту вернутся бонусы/сертификат */}
              {fromLoyalty && canCancel && (
                <Tooltip content={t('bookingPayment.cancelInLoyalty')}>
                  <span tabIndex={0} className="flex size-10 items-center justify-center text-muted">
                    <Info aria-hidden className="size-4" />
                    <span className="sr-only">{t('bookingPayment.cancelInLoyalty')}</span>
                  </span>
                </Tooltip>
              )}
              {canCancel && !fromLoyalty && g.refunded <= 0 && (
                <IconButton icon={<Trash2 aria-hidden className="size-4" />} label={t('bookingPayment.remove')} disabled={cancelling} onClick={() => onCancel(g)} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

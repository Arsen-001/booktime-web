'use client';

/**
 * «За что платят» в окне оплаты (fin-review Ф10, F-07-039/181): услуги визита с ценами — администратор видит,
 * из чего сложилась сумма, прежде чем нажать «Оплатить». Имена услуг — тем же запросом, что и экран политики
 * (один кэш), за ними — товары визита; пока имён нет — «Услуга 1», строка при этом не меняет высоту.
 */
import { listServicesBrief, type BookingGoodsDueLine } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import type { Booking, Money } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';

export interface VisitLinesProps {
  businessId: string;
  booking: Booking;
  lineTotals: Money[];
  /** Товары визита — входят в «К оплате» (продаёт их склад) */
  goods?: BookingGoodsDueLine[];
}

export function VisitLines({ businessId, booking, lineTotals, goods = [] }: VisitLinesProps) {
  const t = useT('finance');
  const format = useFormat();
  const namesQ = useApiQuery(['finance', 'policyServices', businessId], () => listServicesBrief(businessId), { enabled: Boolean(businessId) });
  const nameOf = (serviceId: string) => namesQ.data?.find((s) => s.id === serviceId)?.name;

  if (booking.services.length === 0 && goods.length === 0) return null;

  return (
    <ul data-f="F-07-181" aria-label={t('bookingPayment.visitLines')} className="flex flex-col gap-1 text-sm">
      {booking.services.map((line, i) => (
        <li key={`${line.serviceId}-${i}`} className="flex min-h-6 items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-fg">
            {nameOf(line.serviceId) ?? t('bookingPayment.serviceFallback', { n: i + 1 })}
            {line.qty > 1 && <span className="text-muted"> · {t('bookingPayment.qtyTimesPrice', { qty: line.qty, price: format.money(line.price) })}</span>}
          </span>
          <span className="shrink-0 tabular-nums text-muted">{format.money(lineTotals[i] ?? line.price * line.qty)}</span>
        </li>
      ))}
      {goods.map((g, i) => (
        <li key={`goods-${i}`} className="flex min-h-6 items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-fg">
            {g.name}
            {g.qty > 1 && <span className="text-muted"> · {t('bookingPayment.qtyTimesPrice', { qty: g.qty, price: format.money(g.price) })}</span>}
          </span>
          <span className="shrink-0 tabular-nums text-muted">{format.money(g.total)}</span>
        </li>
      ))}
    </ul>
  );
}

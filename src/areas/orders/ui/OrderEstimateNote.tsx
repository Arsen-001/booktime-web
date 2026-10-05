'use client';

import { Hourglass, ThumbsDown } from 'lucide-react';
import { isEstimateDeclined, isEstimatePending, type Order } from '@/domain/orders';
import { useT } from '@/i18n/useT';

/** ⭐ Смета: «ждём согласия» / «отказ от ремонта» под статусом — сразу видно, кого ждём и что выдать без ремонта */
export function OrderEstimateNote({ order }: { order: Order }) {
  const t = useT('orders');
  if (isEstimatePending(order))
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-warning">
        <Hourglass aria-hidden className="size-4 shrink-0" />
        {t('list.estimatePending')}
      </span>
    );
  if (isEstimateDeclined(order))
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-danger">
        <ThumbsDown aria-hidden className="size-4 shrink-0" />
        {t('list.estimateDeclined')}
      </span>
    );
  return null;
}

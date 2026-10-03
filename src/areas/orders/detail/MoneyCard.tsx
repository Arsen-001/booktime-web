'use client';

import { orderRemaining, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { SectionCard } from '@/ui/SectionCard';

export function MoneyCard({ order }: { order: Order }) {
  const t = useT('orders');
  const fmt = useFormat();
  const left = orderRemaining(order);
  return (
    <SectionCard title={t('detail.money')}>
      <dl className="flex flex-col gap-2 text-base">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('detail.price')}</dt>
          <dd className="text-fg tabular-nums">{fmt.money(order.price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('detail.prepaid')}</dt>
          <dd className="text-fg tabular-nums">{fmt.money(order.prepaid)}</dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="font-semibold text-fg">{t('detail.remaining')}</dt>
          <dd className="text-2xl font-bold text-fg tabular-nums">{fmt.money(left)}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

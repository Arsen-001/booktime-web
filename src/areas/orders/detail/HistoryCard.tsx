'use client';

import { type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { ORDER_STATUS_META } from '@/areas/orders/ui/orderStatusMeta';
import { SectionCard } from '@/ui/SectionCard';
import { Timeline } from '@/ui/Timeline';

export function HistoryCard({ order, staffName }: { order: Order; staffName: (id: string | null) => string | undefined }) {
  const t = useT('orders');
  const fmt = useFormat();
  const items = [...order.history].reverse().map((h, i) => {
    const { icon: Icon, tone } = ORDER_STATUS_META[h.status];
    const who = staffName(h.by);
    return {
      id: `${h.at}-${i}`,
      title: t(`history.${h.status}`),
      time: `${fmt.relativeDay(h.at)}, ${fmt.time(h.at)}`,
      description: who,
      icon: <Icon aria-hidden />,
      tone,
    };
  });
  return (
    <SectionCard title={t('detail.history')}>
      <Timeline items={items} />
      {order.readyNotifiedAt && (
        <p className="mt-4 text-sm text-muted">{t('detail.notifiedAt', { when: `${fmt.relativeDay(order.readyNotifiedAt)}, ${fmt.time(order.readyNotifiedAt)}` })}</p>
      )}
    </SectionCard>
  );
}

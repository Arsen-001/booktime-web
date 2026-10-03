'use client';

import { nextPickupReminderAt, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { diffMinutes, today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { usePickupReminders } from '@/areas/orders/lib/useOrdersData';
import { ORDER_STATUS_META } from '@/areas/orders/ui/orderStatusMeta';
import { SectionCard } from '@/ui/SectionCard';
import { Timeline } from '@/ui/Timeline';

export function HistoryCard({ order, staffName }: { order: Order; staffName: (id: string | null) => string | undefined }) {
  const t = useT('orders');
  const fmt = useFormat();
  const modeQ = usePickupReminders();
  const reminded = order.pickupReminderCount ?? 0;
  // «вт, 7 окт» — день недели и дата; сегодня/вчера/завтра — словом со строчной (внутри фразы)
  const day = (v: string) => {
    const text = fmt.relativeDay(v);
    const near = Math.abs(diffMinutes(`${today()}T00:00`, `${v.slice(0, 10)}T00:00`)) <= 24 * 60;
    return near ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : text;
  };
  const nextAt = modeQ.data ? nextPickupReminderAt(order, modeQ.data) : null;
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
      {(order.readyNotifiedAt || reminded > 0 || nextAt) && (
        <div className="mt-4 flex flex-col gap-1 text-sm text-muted">
          {order.readyNotifiedAt && <p>{t('detail.notifiedAt', { when: `${fmt.relativeDay(order.readyNotifiedAt)}, ${fmt.time(order.readyNotifiedAt)}` })}</p>}
          {reminded > 0 && order.pickupRemindedAt && (
            <p data-f="orders-pickup-reminded">{t('detail.reminded', { count: reminded, when: day(order.pickupRemindedAt) })}</p>
          )}
          {nextAt && <p>{t('detail.remindNext', { when: day(nextAt) })}</p>}
        </div>
      )}
    </SectionCard>
  );
}

'use client';

import type { OrderStatus } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeSize } from '@/ui/Badge';
import { ORDER_STATUS_META } from '@/areas/orders/ui/orderStatusMeta';

/** Статус заказа: «Готов» с галочкой-коробкой, «В работе» с ключом… */
export function OrderStatusBadge({ status, size = 'sm' }: { status: OrderStatus; size?: BadgeSize }) {
  const t = useT('orders');
  const { icon: Icon, tone } = ORDER_STATUS_META[status];
  return (
    <Badge tone={tone} size={size} icon={<Icon aria-hidden />}>
      {t(`status.${status}`)}
    </Badge>
  );
}

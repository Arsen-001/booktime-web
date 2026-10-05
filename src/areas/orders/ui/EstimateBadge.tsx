'use client';

import { Hourglass, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { EstimateStatus } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeSize, type BadgeTone } from '@/ui/Badge';

const META: Record<EstimateStatus, { icon: typeof Hourglass; tone: BadgeTone }> = {
  pending: { icon: Hourglass, tone: 'warning' },
  approved: { icon: ThumbsUp, tone: 'success' },
  declined: { icon: ThumbsDown, tone: 'danger' },
};

/** ⭐ Смета: «Ждём согласия клиента» / «Клиент согласен» / «Клиент отказался» — словом и значком */
export function EstimateBadge({ status, size = 'sm' }: { status: EstimateStatus; size?: BadgeSize }) {
  const t = useT('orders');
  const { icon: Icon, tone } = META[status];
  return (
    <Badge data-f="orders-estimate-status" tone={tone} size={size} icon={<Icon aria-hidden />}>
      {t(`estimate.badge.${status}`)}
    </Badge>
  );
}

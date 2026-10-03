import { Ban, CheckCheck, Inbox, PackageCheck, Wrench, type LucideIcon } from 'lucide-react';
import type { OrderStatus } from '@/domain/orders';
import type { BadgeTone } from '@/ui/Badge';

/** Значок и тон статуса заказа — одни и те же в кабинете и на публичной странице (статус — словом и значком, не цветом) */
export const ORDER_STATUS_META: Record<OrderStatus, { icon: LucideIcon; tone: BadgeTone }> = {
  received: { icon: Inbox, tone: 'info' },
  in_progress: { icon: Wrench, tone: 'primary' },
  ready: { icon: PackageCheck, tone: 'success' },
  issued: { icon: CheckCheck, tone: 'neutral' },
  cancelled: { icon: Ban, tone: 'danger' },
};

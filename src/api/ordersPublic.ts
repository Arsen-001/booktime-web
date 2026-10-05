'use client';

/**
 * Публичный вид заказа для мока (страница /o/<code>, без входа): только то, что нужно клиенту, — как publicOrderView
 * сервера (modules/orders/order-rules.ts). Зовётся внутри request() из '@/api/orders' и '@/api/ordersEstimate'.
 */
import { readArea, readCore } from '@/api/area';
import { ApiError } from '@/api/request';
import { orderReadyAt, type PublicOrder } from '@/domain/orders';

export function publicOrderTx(code: string): PublicOrder {
  const order = readArea('orders').orders.find((o) => o.code === code);
  if (!order) throw new ApiError('not_found', 'Заказ не найден');
  const core = readCore();
  const business = core.businesses.find((b) => b.id === order.businessId);
  const location = core.locations.find((l) => l.id === (order.locationId ?? business?.locationIds[0]));
  const est = order.estimate;
  return {
    number: order.number,
    status: order.status,
    items: order.items.map((i) => ({ title: i.title, qty: i.qty })),
    dueDate: order.dueDate,
    readyAt: order.status === 'ready' || order.status === 'issued' ? orderReadyAt(order) : null,
    price: order.price,
    prepaid: order.prepaid,
    // Смета — без того, кто отметил ответ, и без времени напоминания
    estimate:
      est && order.status !== 'cancelled'
        ? { status: est.status, version: est.version, lines: est.lines, total: est.total, comment: est.comment, sentAt: est.sentAt, decidedAt: est.decidedAt, clientComment: est.clientComment }
        : null,
    business: {
      name: business?.brandName || business?.name || '',
      phone: location?.phone ?? business?.phone ?? null,
      address: location?.address ?? null,
      slug: business?.slug ?? '',
    },
  };
}

'use client';

/**
 * ⭐ Заказы (03.10.2026) на настоящем сервере (booktime-backend, модуль orders). Функции src/api/orders.ts в режиме
 * `api` зовут эти; экран получает те же типы, что от мока. Переходы статусов, номер, публичный код и «Готово»
 * клиенту — на сервере (неверный переход — 422 → ApiError с кодом сервера).
 *
 * Перечитывание: чтения объявляют метку areas.orders (trackRead), запись будит её (notifyDbChange).
 * Время с сервера может прийти с поясом (…Z) — приводим к местному Еревана 'YYYY-MM-DDTHH:mm', как в моке.
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import type { Id } from '@/domain/core';
import type { Order, OrderInput, OrderPatch, OrdersPage, OrdersQuery, OrderStatus, PublicOrder } from '@/domain/orders';
import { toLocalDateTime } from '@/areas/orders/lib/serverTime';
import { notifyDbChange } from '@/mock/db';

/** Путь заказов бизнеса — по контракту 03.10.2026 */
const ORDERS_BASE = (businessId: Id) => `/v1/biz/${encodeURIComponent(businessId)}/orders`;
/** Настройки раздела — общий JSON настроек бизнеса (business_settings, area = 'orders') */
// «Заказы» вкл/выкл — поле ordersEnabled самого бизнеса (сервер: null → по сфере; GET отдаёт уже решённое значение)
const BUSINESS_PATH = (businessId: Id) => `/v1/biz/${encodeURIComponent(businessId)}`;

const localTime = toLocalDateTime;

function normalizeOrder(o: Order): Order {
  return {
    ...o,
    dueDate: o.dueDate ? o.dueDate.slice(0, 10) : null,
    history: (o.history ?? []).map((h) => ({ ...h, at: localTime(h.at) ?? h.at })),
    photos: o.photos ?? [],
    readyNotifiedAt: localTime(o.readyNotifiedAt),
    issuedAt: localTime(o.issuedAt),
    createdAt: localTime(o.createdAt) ?? o.createdAt,
    updatedAt: localTime(o.updatedAt) ?? o.updatedAt,
  };
}

async function write(fn: () => Promise<Order>): Promise<Order> {
  const res = normalizeOrder(await fn());
  notifyDbChange('areas.orders');
  return res;
}

export async function listOrdersServer(businessId: Id, q: OrdersQuery): Promise<OrdersPage> {
  trackRead('areas.orders');
  const res = await http<OrdersPage>('GET', ORDERS_BASE(businessId), undefined, {
    query: { status: q.status ?? 'active', q: q.q || undefined, page: q.page, pageSize: q.pageSize },
  });
  return { items: res.items.map(normalizeOrder), total: res.total };
}

export async function getOrderServer(businessId: Id, orderId: Id): Promise<Order> {
  trackRead('areas.orders');
  return normalizeOrder(await http<Order>('GET', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}`));
}

export const createOrderServer = (businessId: Id, input: OrderInput) => write(() => http<Order>('POST', ORDERS_BASE(businessId), input));

export const updateOrderServer = (businessId: Id, orderId: Id, patch: OrderPatch) =>
  write(() => http<Order>('PATCH', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}`, patch));

export const setOrderStatusServer = (businessId: Id, orderId: Id, status: OrderStatus) =>
  write(() => http<Order>('POST', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}/status`, { status }));

export const notifyOrderReadyServer = (businessId: Id, orderId: Id) =>
  write(() => http<Order>('POST', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}/notify`));

/** Публично, без входа: статус заказа по коду ссылки */
export async function getPublicOrderServer(code: string): Promise<PublicOrder> {
  trackRead('areas.orders');
  const res = await http<PublicOrder>('GET', `/v1/public/orders/${encodeURIComponent(code)}`);
  return { ...res, dueDate: res.dueDate ? res.dueDate.slice(0, 10) : null, readyAt: localTime(res.readyAt) };
}

interface BusinessOut {
  ordersEnabled?: boolean;
  version: number;
}

/** «Заказы» вкл/выкл: сервер уже решил за бизнес, который ещё не выбирал (по сфере) */
export async function getOrdersEnabledServer(businessId: Id): Promise<boolean | undefined> {
  trackRead('areas.orders');
  const b = await http<BusinessOut>('GET', BUSINESS_PATH(businessId));
  return typeof b.ordersEnabled === 'boolean' ? b.ordersEnabled : undefined;
}

export async function setOrdersEnabledServer(businessId: Id, enabled: boolean): Promise<boolean> {
  const b = await http<BusinessOut>('GET', BUSINESS_PATH(businessId));
  await http<BusinessOut>('PATCH', BUSINESS_PATH(businessId), { ordersEnabled: enabled }, { version: b.version ?? 0 });
  notifyDbChange('areas.orders');
  return enabled;
}

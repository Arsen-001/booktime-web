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
import {
  pickupReminderModeOf,
  type EstimateDecision,
  type EstimateInput,
  type IntakeBooking,
  type IntakeSettings,
  type IntakeSettingsInput,
  type Order,
  type OrderInput,
  type OrderPatch,
  type OrdersPage,
  type OrdersQuery,
  type OrderStatus,
  type PickupReminderMode,
  type PublicOrder,
} from '@/domain/orders';
import { normalizeEstimate, toLocalDateTime } from '@/areas/orders/lib/serverTime';
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
    pickupReminderCount: o.pickupReminderCount ?? 0,
    pickupRemindedAt: localTime(o.pickupRemindedAt ?? null),
    estimate: normalizeEstimate(o.estimate ?? null),
    bookingId: o.bookingId ?? null,
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
  return normalizePublic(res);
}

function normalizePublic(res: PublicOrder): PublicOrder {
  return { ...res, dueDate: res.dueDate ? res.dueDate.slice(0, 10) : null, readyAt: localTime(res.readyAt), estimate: normalizeEstimate(res.estimate ?? null) };
}

// ─────────── ⭐ смета (05.10.2026) ───────────

export const sendOrderEstimateServer = (businessId: Id, orderId: Id, input: EstimateInput) =>
  write(() => http<Order>('POST', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}/estimate`, input));

export const resendOrderEstimateServer = (businessId: Id, orderId: Id) =>
  write(() => http<Order>('POST', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}/estimate/notify`));

export const decideOrderEstimateServer = (businessId: Id, orderId: Id, decision: EstimateDecision, comment: string | null) =>
  write(() => http<Order>('POST', `${ORDERS_BASE(businessId)}/${encodeURIComponent(orderId)}/estimate/decision`, { decision, comment }));

/** Клиент по ссылке, без входа: «Согласен» / «Отказаться» на смету версии version */
export async function decidePublicEstimateServer(code: string, decision: EstimateDecision, version: number, comment: string | null): Promise<PublicOrder> {
  const res = normalizePublic(await http<PublicOrder>('POST', `/v1/public/orders/${encodeURIComponent(code)}/estimate`, { decision, version, comment }));
  notifyDbChange('areas.orders');
  return res;
}

interface BusinessOut {
  ordersEnabled?: boolean;
  /** «Заказ ждёт вас» (04.10.2026): off | 3 | 3_7 — сервер уже подставил умолчание */
  orderPickupReminders?: string;
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

/** «Заказ ждёт вас»: когда напоминать клиенту, который не забрал готовый заказ (поле бизнеса orderPickupReminders) */
export async function getPickupRemindersServer(businessId: Id): Promise<PickupReminderMode> {
  trackRead('areas.orders');
  const b = await http<BusinessOut>('GET', BUSINESS_PATH(businessId));
  return pickupReminderModeOf(b.orderPickupReminders);
}

export async function setPickupRemindersServer(businessId: Id, mode: PickupReminderMode): Promise<PickupReminderMode> {
  const b = await http<BusinessOut>('GET', BUSINESS_PATH(businessId));
  await http<BusinessOut>('PATCH', BUSINESS_PATH(businessId), { orderPickupReminders: mode }, { version: b.version ?? 0 });
  notifyDbChange('areas.orders');
  return mode;
}

// ─────────── ⭐ запись на сдачу по времени (05.10.2026) ───────────

export async function getIntakeSettingsServer(businessId: Id): Promise<IntakeSettings> {
  trackRead('areas.orders');
  return http<IntakeSettings>('GET', `${ORDERS_BASE(businessId)}/intake`);
}

export async function setIntakeSettingsServer(businessId: Id, input: IntakeSettingsInput): Promise<IntakeSettings> {
  const res = await http<IntakeSettings>('PUT', `${ORDERS_BASE(businessId)}/intake`, input);
  notifyDbChange('areas.orders');
  return res;
}

/** Записи на сдачу за день (время Еревана) */
export async function listIntakeBookingsServer(businessId: Id, date: string): Promise<IntakeBooking[]> {
  // Запись клиента на сдачу приходит в журнал (зеркало записей) — список перечитывается вместе с ним
  trackRead('areas.orders', 'core.bookings');
  const rows = await http<IntakeBooking[]>('GET', `${ORDERS_BASE(businessId)}/intake/bookings`, undefined, { query: { date } });
  return rows.map((r) => ({ ...r, start: localTime(r.start) ?? r.start }));
}

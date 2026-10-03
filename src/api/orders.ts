'use client';

/**
 * ⭐ Заказы (владелец, 03.10.2026): ателье, ремонт техники, химчистка, детейлинг. Одна операция = одна функция =
 * один request() (мок) или один вызов сервера (режим api, src/api/orders.server.ts) — экран видит тот же тип.
 *
 * Мок повторяет правила сервера: номер в бизнесе с 1001, публичный код из 10 символов, переходы ORDER_TRANSITIONS
 * (иначе ApiError('invalid_transition')), «Готово» — строка журнала отправок уведомлений (пуш клиенту с приложением,
 * иначе Telegram) с ссылкой /o/<code>; «Отправить ещё раз» — только у готового заказа.
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { coreTx, currentActor } from '@/api/core';
import { isApiMode } from '@/api/http';
import { appendNotifyLogTx } from '@/api/notify';
import * as S from '@/api/orders.server';
import { ApiError, request, useApiQuery, type QueryOptions } from '@/api/request';
import type { Client, Id, LocalizedText, SphereId } from '@/domain/core';
import type { LogChannel } from '@/domain/notify';
import {
  canTransitionOrder,
  defaultOrdersEnabled,
  FIRST_ORDER_NUMBER,
  matchesOrderStatus,
  ORDER_CODE_ALPHABET,
  ORDER_CODE_LENGTH,
  orderReadyAt,
  type Order,
  type OrderInput,
  type OrderItem,
  type OrderPatch,
  type OrdersPage,
  type OrdersQuery,
  type OrderStatus,
  type PublicOrder,
} from '@/domain/orders';
import { nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { localDigits, normalizePhone } from '@/lib/phone';
import { normalizeSearch, pickText } from '@/lib/text';

/** Ключи запросов раздела: ['orders', <ресурс>, …] */
export const ordersKeys = {
  all: ['orders'] as const,
  list: (businessId: Id, query: OrdersQuery) => ['orders', 'list', businessId, query] as const,
  count: (businessId: Id, status: OrderStatus) => ['orders', 'count', businessId, status] as const,
  order: (businessId: Id, orderId: Id) => ['orders', 'order', businessId, orderId] as const,
  public: (code: string) => ['orders', 'public', code] as const,
  enabled: (businessId: Id) => ['orders', 'enabled', businessId] as const,
  pickupReminders: (businessId: Id) => ['orders', 'pickup-reminders', businessId] as const,
};

// ─────────────────────────── мок: помощники ───────────────────────────

function findOrderTx(businessId: Id, orderId: Id): Order {
  const order = readArea('orders').orders.find((o) => o.businessId === businessId && o.id === orderId);
  if (!order) throw new ApiError('not_found', 'Заказ не найден');
  return order;
}

function saveOrderTx(order: Order): Order {
  mutateArea('orders', (s) => {
    const i = s.orders.findIndex((o) => o.id === order.id);
    if (i >= 0) s.orders[i] = order;
    else s.orders.unshift(order);
  });
  return order;
}

function newCodeTx(): string {
  const taken = new Set(readArea('orders').orders.map((o) => o.code));
  for (;;) {
    let code = '';
    for (let i = 0; i < ORDER_CODE_LENGTH; i++) code += ORDER_CODE_ALPHABET[Math.floor(Math.random() * ORDER_CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
}

function cleanItems(items: OrderItem[] | undefined): OrderItem[] {
  return (items ?? [])
    .map((i) => ({ title: i.title.trim(), qty: Math.max(1, Math.round(Number(i.qty) || 1)), ...(i.note?.trim() ? { note: i.note.trim() } : {}) }))
    .filter((i) => i.title);
}

/** Проверка полей заказа (как у сервера): имя, номер, хотя бы одна вещь, деньги не отрицательные, предоплата ≤ цены */
function validateTx(o: Pick<Order, 'clientName' | 'clientPhone' | 'items' | 'price' | 'prepaid'>): void {
  if (!o.clientName.trim()) throw new ApiError('validation', 'clientName');
  if (!normalizePhone(o.clientPhone)) throw new ApiError('validation', 'clientPhone');
  if (!o.items.length) throw new ApiError('validation', 'items');
  if (!(o.price >= 0) || !(o.prepaid >= 0)) throw new ApiError('validation', 'price');
  if (o.prepaid > o.price) throw new ApiError('validation', 'prepaid');
}

/** Карточка клиента бизнеса для заказа: указанная → по номеру → новая (ключ клиента — телефон) */
function ensureClientTx(businessId: Id, clientId: Id | null | undefined, name: string, phone: string): Id {
  const core = readCore();
  if (clientId) {
    const c = core.clients.find((x) => x.id === clientId && x.businessId === businessId && !x.deletedAt);
    if (c) return c.id;
  }
  const byPhone = coreTx.findClientByPhone(businessId, phone);
  if (byPhone && !byPhone.deletedAt) return byPhone.id;
  const created = coreTx.create('clients', {
    businessId,
    phone,
    name: name.trim(),
    gender: 'unknown',
    tags: [],
    noShowCount: 0,
    createdAt: nowDateTime(),
  } satisfies Omit<Client, 'id'>);
  return created.id;
}

function publicOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** «Заказ готов» в журнал отправок: пуш клиенту с приложением, иначе Telegram-бот (платных SMS нет) */
function logReadyTx(order: Order, at: string): void {
  const core = readCore();
  const business = core.businesses.find((b) => b.id === order.businessId);
  const client = order.clientId ? core.clients.find((c) => c.id === order.clientId) : undefined;
  const channel: LogChannel = client?.appUserId ? 'push' : 'telegram';
  const link = `${publicOrigin()}/o/${order.code}`;
  const name = business?.brandName || business?.name || '';
  const text: LocalizedText = {
    ru: `Заказ №${order.number} готов — можно забирать. ${name}. Статус: ${link}`,
    en: `Order #${order.number} is ready for pickup. ${name}. Status: ${link}`,
    hy: `Պատվեր №${order.number}-ը պատրաստ է, կարող եք վերցնել։ ${name}։ Կարգավիճակը՝ ${link}`,
  };
  appendNotifyLogTx(order.businessId, [
    {
      createdAt: at,
      typeLabel: { ru: 'Заказ готов', en: 'Order ready', hy: 'Պատվերը պատրաստ է' },
      channel,
      status: 'sent',
      contact: order.clientPhone,
      text,
      clientId: order.clientId ?? undefined,
      ...(order.staffId ? { staffId: order.staffId } : {}),
    },
  ]);
}

// ─────────────────────────── чтения ───────────────────────────

/** Список заказов бизнеса: фильтр статуса (по умолчанию активные), поиск по №, имени, номеру, вещам; новые сверху */
export function listOrders(businessId: Id, query: OrdersQuery = {}): Promise<OrdersPage> {
  if (isApiMode()) return S.listOrdersServer(businessId, query);
  return request(() => {
    const status = query.status ?? 'active';
    const q = normalizeSearch(query.q ?? '');
    const digits = (query.q ?? '').replace(/\D/g, '');
    const local = digits.startsWith('374') && digits.length > 3 ? digits.slice(3) : digits;
    const all = readArea('orders')
      .orders.filter((o) => o.businessId === businessId && matchesOrderStatus(o.status, status))
      .filter((o) => {
        if (!q) return true;
        if (local && (String(o.number).includes(local) || localDigits(o.clientPhone).includes(local))) return true;
        if (normalizeSearch(o.clientName).includes(q)) return true;
        return o.items.some((i) => normalizeSearch(i.title).includes(q));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number);
    const pageSize = Math.max(1, query.pageSize ?? 10);
    const page = Math.max(1, query.page ?? 1);
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  });
}

export function getOrder(businessId: Id, orderId: Id): Promise<Order> {
  if (isApiMode()) return S.getOrderServer(businessId, orderId);
  return request(() => findOrderTx(businessId, orderId));
}

/** Публичный статус по коду ссылки — без входа (страница /o/<code>) */
export function getPublicOrder(code: string): Promise<PublicOrder> {
  if (isApiMode()) return S.getPublicOrderServer(code);
  return request(() => {
    const order = readArea('orders').orders.find((o) => o.code === code);
    if (!order) throw new ApiError('not_found', 'Заказ не найден');
    const core = readCore();
    const business = core.businesses.find((b) => b.id === order.businessId);
    const location = core.locations.find((l) => l.id === (order.locationId ?? business?.locationIds[0]));
    return {
      number: order.number,
      status: order.status,
      items: order.items.map((i) => ({ title: i.title, qty: i.qty })),
      dueDate: order.dueDate,
      readyAt: order.status === 'ready' || order.status === 'issued' ? orderReadyAt(order) : null,
      price: order.price,
      prepaid: order.prepaid,
      business: {
        name: business?.brandName || business?.name || '',
        phone: location?.phone ?? business?.phone ?? null,
        address: location?.address ?? null,
        slug: business?.slug ?? '',
      },
    };
  });
}

/** «Заказы» включены у бизнеса: выбор владельца, иначе — по сфере бизнеса */
export function getOrdersEnabled(businessId: Id, sphereIds: readonly SphereId[]): Promise<boolean> {
  if (isApiMode()) return S.getOrdersEnabledServer(businessId).then((v) => v ?? defaultOrdersEnabled(sphereIds));
  return request(() => readArea('orders').settings[businessId]?.ordersEnabled ?? defaultOrdersEnabled(sphereIds));
}

/** Хук: включены ли «Заказы» (меню кабинета, экран настроек). Пока бизнес не известен — по сфере */
export function useOrdersEnabledQuery(businessId: Id | undefined, sphereIds: readonly SphereId[], options?: QueryOptions<boolean>) {
  return useApiQuery(ordersKeys.enabled(businessId ?? ''), () => getOrdersEnabled(businessId ?? '', sphereIds), {
    ...options,
    enabled: Boolean(businessId) && (options?.enabled ?? true),
  });
}

// ─────────────────────────── записи ───────────────────────────

/** Принять заказ */
export function createOrder(args: { businessId: Id; input: OrderInput }): Promise<Order> {
  const { businessId, input } = args;
  if (isApiMode()) return S.createOrderServer(businessId, input);
  return request(() => {
    const phone = normalizePhone(input.clientPhone) ?? input.clientPhone;
    const draft = {
      clientName: input.clientName.trim(),
      clientPhone: phone,
      items: cleanItems(input.items),
      price: Math.round(input.price),
      prepaid: Math.round(input.prepaid ?? 0),
    };
    validateTx(draft);
    const now = nowDateTime();
    const actor = currentActor();
    const mine = readArea('orders').orders.filter((o) => o.businessId === businessId);
    const business = readCore().businesses.find((b) => b.id === businessId);
    const order: Order = {
      id: newId('ord'),
      businessId,
      locationId: input.locationId ?? business?.locationIds[0] ?? null,
      number: mine.length ? Math.max(...mine.map((o) => o.number)) + 1 : FIRST_ORDER_NUMBER,
      code: newCodeTx(),
      clientId: ensureClientTx(businessId, input.clientId, draft.clientName, phone),
      ...draft,
      photos: input.photos ?? [],
      staffId: input.staffId ?? null,
      status: 'received',
      dueDate: input.dueDate ?? null,
      comment: input.comment?.trim() || null,
      history: [{ at: now, status: 'received', by: actor.staffId ?? null }],
      readyNotifiedAt: null,
      issuedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return saveOrderTx(order);
  });
}

/** Изменить заказ (что сдали, клиент, мастер, срок, деньги, комментарий) */
export function updateOrder(args: { businessId: Id; orderId: Id; patch: OrderPatch }): Promise<Order> {
  const { businessId, orderId, patch } = args;
  if (isApiMode()) return S.updateOrderServer(businessId, orderId, patch);
  return request(() => {
    const current = findOrderTx(businessId, orderId);
    const phone = patch.clientPhone !== undefined ? (normalizePhone(patch.clientPhone) ?? patch.clientPhone) : current.clientPhone;
    const next: Order = {
      ...current,
      ...patch,
      clientName: (patch.clientName ?? current.clientName).trim(),
      clientPhone: phone,
      items: patch.items ? cleanItems(patch.items) : current.items,
      price: Math.round(patch.price ?? current.price),
      prepaid: Math.round(patch.prepaid ?? current.prepaid),
      comment: patch.comment !== undefined ? patch.comment?.trim() || null : current.comment,
      updatedAt: nowDateTime(),
    };
    validateTx(next);
    if (patch.clientPhone !== undefined || patch.clientId !== undefined) {
      next.clientId = ensureClientTx(businessId, patch.clientId ?? null, next.clientName, phone);
    }
    return saveOrderTx(next);
  });
}

/** Перевести заказ: «В работу», «Готово» (клиенту уходит уведомление само), «Выдать», «Вернуть в работу», «Отменить» */
export function setOrderStatus(args: { businessId: Id; orderId: Id; status: OrderStatus }): Promise<Order> {
  const { businessId, orderId, status } = args;
  if (isApiMode()) return S.setOrderStatusServer(businessId, orderId, status);
  return request(() => {
    const current = findOrderTx(businessId, orderId);
    if (!canTransitionOrder(current.status, status)) throw new ApiError('invalid_transition', `${current.status} → ${status}`);
    const now = nowDateTime();
    const next: Order = {
      ...current,
      status,
      history: [...current.history, { at: now, status, by: currentActor().staffId ?? null }],
      updatedAt: now,
      // Новый «Готов» — новый отсчёт напоминаний «заказ ждёт вас»
      ...(status === 'ready' ? { readyNotifiedAt: now, pickupReminderCount: 0, pickupRemindedAt: null } : {}),
      ...(status === 'issued' ? { issuedAt: now } : {}),
    };
    if (status === 'ready') logReadyTx(next, now);
    return saveOrderTx(next);
  });
}

/** «Отправить ещё раз»: напомнить клиенту, что заказ готов (только у готового) */
export function notifyOrderReady(args: { businessId: Id; orderId: Id }): Promise<Order> {
  const { businessId, orderId } = args;
  if (isApiMode()) return S.notifyOrderReadyServer(businessId, orderId);
  return request(() => {
    const current = findOrderTx(businessId, orderId);
    if (current.status !== 'ready') throw new ApiError('invalid_status', 'Заказ ещё не готов');
    const now = nowDateTime();
    const next: Order = { ...current, readyNotifiedAt: now, updatedAt: now };
    logReadyTx(next, now);
    return saveOrderTx(next);
  });
}

/** Включить или выключить «Заказы» у бизнеса (пункт меню, экран) */
export function setOrdersEnabled(args: { businessId: Id; enabled: boolean }): Promise<boolean> {
  const { businessId, enabled } = args;
  if (isApiMode()) return S.setOrdersEnabledServer(businessId, enabled);
  return request(
    () => {
      mutateArea('orders', (s) => {
        s.settings[businessId] = { ...s.settings[businessId], ordersEnabled: enabled };
      });
      return enabled;
    },
    { permission: 'settings.manage' },
  );
}

/** Адрес бизнеса для публичной страницы: строка сервера или текст мока на языке страницы */
export function publicAddressText(address: PublicOrder['business']['address'], locale: 'ru' | 'en' | 'hy'): string {
  if (!address) return '';
  return typeof address === 'string' ? address : pickText(address, locale);
}

export { getPickupReminders, runPickupReminders, setPickupReminders } from '@/api/ordersReminders';

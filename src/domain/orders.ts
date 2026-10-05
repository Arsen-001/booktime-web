/**
 * ⭐ Заказы (владелец, 03.10.2026): ателье, ремонт техники, химчистка, детейлинг. Бизнес принимает вещь (что сдали,
 * фото, срок, цена, предоплата), ведёт заказ по статусам; «Готово» уходит клиенту само, а статус клиент смотрит по
 * публичной ссылке /o/<code> без входа. Типы — как у сервера (booktime-backend, контракт 03.10.2026), правила —
 * чистые функции: одни и те же для мока, экранов и (по смыслу) сервера.
 */
import type { Id, ISODate, ISODateTime, LocalizedText, SphereId } from '@/domain/core';
import { SPHERES } from '@/config/spheres';
import { addDays, diffMinutes } from '@/lib/date';
import { canSendEstimate, isStatusEntry, type EstimateStatus, type OrderEstimate, type PublicOrderEstimate } from '@/domain/ordersEstimate';

export * from '@/domain/ordersEstimate';

export type OrderStatus = 'received' | 'in_progress' | 'ready' | 'issued' | 'cancelled';

/** Фильтр списка: статус, «активные» (принят · в работе · готов) или все */
export type OrderStatusFilter = OrderStatus | 'active' | 'all';

export interface OrderItem {
  title: string;
  qty: number;
  note?: string;
}

/** События сметы в истории заказа (status у такой строки — статус заказа в тот момент) */
export type OrderHistoryEvent = 'estimate_sent' | 'estimate_approved' | 'estimate_declined';

export interface OrderHistoryEntry {
  at: ISODateTime;
  status: OrderStatus;
  /** Кто перевёл (id сотрудника); null — система, клиент (ответ по ссылке) или неизвестно */
  by: string | null;
  /** Нет — смена статуса; есть — событие сметы */
  event?: OrderHistoryEvent;
  /** Сумма сметы (estimate_sent), ֏ */
  amount?: number;
  /** Комментарий клиента к ответу по смете */
  note?: string;
}

export interface Order {
  id: Id;
  businessId: Id;
  locationId: Id | null;
  /** Номер заказа в бизнесе — с 1001 */
  number: number;
  /** Публичный код ссылки /o/<code> (10 символов) */
  code: string;
  clientId: Id | null;
  clientName: string;
  /** E.164: '+374XXXXXXXX' */
  clientPhone: string;
  items: OrderItem[];
  photos: string[];
  staffId: Id | null;
  status: OrderStatus;
  dueDate: ISODate | null;
  /** Цена, ֏ */
  price: number;
  /** Предоплата, ֏ */
  prepaid: number;
  comment: string | null;
  history: OrderHistoryEntry[];
  /** Когда клиенту ушло «Готово» (последний раз) */
  readyNotifiedAt: ISODateTime | null;
  issuedAt: ISODateTime | null;
  /** «Заказ ждёт вас» (04.10.2026): сколько авто-напоминаний ушло за текущий «Готов» (нет поля — 0) */
  pickupReminderCount?: number;
  /** Когда ушло последнее авто-напоминание */
  pickupRemindedAt?: ISODateTime | null;
  /** ⭐ Смета (05.10.2026); нет поля или null — не отправляли */
  estimate?: OrderEstimate | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Новый заказ (POST /orders) */
export interface OrderInput {
  clientName: string;
  clientPhone: string;
  clientId?: Id | null;
  items: OrderItem[];
  photos?: string[];
  staffId?: Id | null;
  dueDate?: ISODate | null;
  price: number;
  prepaid?: number;
  comment?: string | null;
  locationId?: Id | null;
}

/** Что можно поменять у заказа (PATCH) */
export type OrderPatch = Partial<
  Pick<Order, 'clientName' | 'clientPhone' | 'clientId' | 'items' | 'photos' | 'staffId' | 'dueDate' | 'price' | 'prepaid' | 'comment' | 'locationId'>
>;

export interface OrdersQuery {
  status?: OrderStatusFilter;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface OrdersPage {
  items: Order[];
  total: number;
}

/** Публичный статус заказа — то, что видит клиент по ссылке (без телефона клиента и внутренних полей) */
export interface PublicOrder {
  number: number;
  status: OrderStatus;
  items: { title: string; qty: number }[];
  dueDate: ISODate | null;
  /** Когда стал «Готов» (последний раз) */
  readyAt: ISODateTime | null;
  price: number;
  prepaid: number;
  /** ⭐ Смета, если мастерская её отправила (05.10.2026); нет поля — старый сервер */
  estimate?: PublicOrderEstimate | null;
  business: {
    name: string;
    phone: string | null;
    /** Сервер отдаёт строку; мок — текст на трёх языках */
    address: string | LocalizedText | null;
    slug: string;
  };
}

/** Напомнить клиенту, что готовый заказ ждёт: выключено / через 3 дня / через 3 и 7 дней после «Готов» */
export type PickupReminderMode = 'off' | '3' | '3_7';
export const PICKUP_REMINDER_MODES: readonly PickupReminderMode[] = ['off', '3', '3_7'];
export const DEFAULT_PICKUP_REMINDER_MODE: PickupReminderMode = '3_7';

export interface OrdersSettings {
  ordersEnabled?: boolean;
  /** Нет поля — по умолчанию «3 и 7 дней» */
  pickupReminders?: PickupReminderMode;
}

// ─────────────────────────── правила ───────────────────────────

/** Путь заказа по шагам (отмена — вне шагов) */
export const ORDER_STEPS = ['received', 'in_progress', 'ready', 'issued'] as const satisfies readonly OrderStatus[];

/** Активные — те, что ещё у мастера */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ['received', 'in_progress', 'ready'];

/** Разрешённые переходы (сервер отвечает 422 на остальные) */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  received: ['in_progress', 'ready', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['issued', 'in_progress'],
  issued: [],
  cancelled: [],
};

/** Можно ли перевести заказ. Клиент отказался от сметы — вещь выдают без ремонта: из «Принят» / «В работе» сразу в «Выдан» */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus, estimateStatus?: EstimateStatus | null): boolean {
  if (to === 'issued' && estimateStatus === 'declined' && canSendEstimate(from)) return true;
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Главный следующий шаг (одна кнопка): принят → в работу, в работе → готово, готов → выдать. Смета ждёт ответа —
 * кнопки нет (ждём клиента); клиент отказался — «Выдать без ремонта».
 */
export function nextOrderStep(status: OrderStatus, estimateStatus?: EstimateStatus | null): OrderStatus | null {
  if (canSendEstimate(status) && estimateStatus === 'declined') return 'issued';
  if (canSendEstimate(status) && estimateStatus === 'pending') return null;
  if (status === 'received') return 'in_progress';
  if (status === 'in_progress') return 'ready';
  if (status === 'ready') return 'issued';
  return null;
}

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

/** Просрочен: срок прошёл, а заказ ещё не готов */
export function isOrderOverdue(order: Pick<Order, 'status' | 'dueDate'>, today: ISODate): boolean {
  return Boolean(order.dueDate) && (order.status === 'received' || order.status === 'in_progress') && order.dueDate! < today;
}

/** Осталось заплатить: цена минус предоплата, не меньше нуля */
export function orderRemaining(order: Pick<Order, 'price' | 'prepaid'>): number {
  return Math.max(0, order.price - order.prepaid);
}

/** Подходит ли заказ под фильтр списка */
export function matchesOrderStatus(status: OrderStatus, filter: OrderStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveOrder(status);
  return status === filter;
}

/** «Заказы» включены по умолчанию у сфер с функцией orders (ателье, ремонт, химчистка, детейлинг) */
export function defaultOrdersEnabled(sphereIds: readonly SphereId[]): boolean {
  return sphereIds.some((s) => SPHERES[s]?.features.includes('orders'));
}

/** Когда заказ последний раз стал «Готов» (из истории) */
export function orderReadyAt(order: Pick<Order, 'history'>): ISODateTime | null {
  for (let i = order.history.length - 1; i >= 0; i--) if (isStatusEntry(order.history[i]) && order.history[i].status === 'ready') return order.history[i].at;
  return null;
}

/** Короткая строка «что сдали»: «iPhone 13 · Чехол ×2» */
export function orderItemsSummary(items: readonly Pick<OrderItem, 'title' | 'qty'>[]): string {
  return items.map((i) => (i.qty > 1 ? `${i.title} ×${i.qty}` : i.title)).join(' · ');
}

/** Алфавит публичного кода — без похожих символов (0/O, 1/l/I) */
export const ORDER_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ORDER_CODE_LENGTH = 10;
export const FIRST_ORDER_NUMBER = 1001;

// ─────────────── «Заказ ждёт вас» — напоминание, если не забрали (04.10.2026) ───────────────
// Те же правила, что у сервера (booktime-backend: modules/orders/order-rules.ts → pickupReminderDue, задача воркера
// jobs/orders-pickup-reminders.ts): только «Готов», сроки от последнего перехода в «Готов», не больше двух, ручное
// «Отправить ещё раз» меньше суток назад — ждём; воркер лежал и прошли оба срока — одно сообщение.

export function pickupReminderModeOf(stored: string | null | undefined): PickupReminderMode {
  return (PICKUP_REMINDER_MODES as readonly string[]).includes(String(stored)) ? (stored as PickupReminderMode) : DEFAULT_PICKUP_REMINDER_MODE;
}

/** Через сколько дней после «Готов» — каждое напоминание по порядку */
export function pickupReminderDays(mode: PickupReminderMode): readonly number[] {
  return mode === 'off' ? [] : mode === '3' ? [3] : [3, 7];
}

const DAY_MIN = 24 * 60;

/** Минуты b − a для 'YYYY-MM-DDTHH:mm' (время Еревана, без пояса) */
const minutesBetween = (a: ISODateTime, b: ISODateTime) => diffMinutes(a.slice(0, 16), b.slice(0, 16));

/** Пора ли напомнить: null — нет; иначе новое значение счётчика напоминаний */
export function pickupReminderDue(
  order: Pick<Order, 'status' | 'history' | 'readyNotifiedAt' | 'pickupReminderCount'>,
  mode: PickupReminderMode,
  now: ISODateTime,
): { nextCount: number } | null {
  if (order.status !== 'ready') return null;
  const days = pickupReminderDays(mode);
  const done = Math.max(0, order.pickupReminderCount ?? 0);
  if (done >= days.length) return null;
  const readyAt = orderReadyAt(order) ?? order.readyNotifiedAt;
  if (!readyAt) return null;
  const elapsed = minutesBetween(readyAt, now);
  if (elapsed < days[done] * DAY_MIN) return null;
  if (order.readyNotifiedAt && order.readyNotifiedAt > readyAt && minutesBetween(order.readyNotifiedAt, now) < DAY_MIN) return null;
  let nextCount = done + 1;
  while (nextCount < days.length && elapsed >= days[nextCount] * DAY_MIN) nextCount++;
  return { nextCount };
}

/** Когда уйдёт следующее авто-напоминание (для подсказки в истории заказа): 'YYYY-MM-DDTHH:mm' или null */
export function nextPickupReminderAt(order: Pick<Order, 'status' | 'history' | 'readyNotifiedAt' | 'pickupReminderCount'>, mode: PickupReminderMode): ISODateTime | null {
  if (order.status !== 'ready') return null;
  const days = pickupReminderDays(mode);
  const done = Math.max(0, order.pickupReminderCount ?? 0);
  const readyAt = orderReadyAt(order) ?? order.readyNotifiedAt;
  if (done >= days.length || !readyAt) return null;
  return `${addDays(readyAt.slice(0, 10), days[done])}T${readyAt.slice(11, 16)}`;
}

/** Тихие часы 21:00–10:00 по Еревану — напоминание «заказ ждёт» не шлём (как сервер, notify/quiet-hours.ts) */
export function inQuietHours(now: ISODateTime): boolean {
  const h = Number(now.slice(11, 13));
  return h >= 21 || h < 10;
}

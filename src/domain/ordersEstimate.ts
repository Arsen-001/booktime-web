/**
 * ⭐ Смета и согласование цены (05.10.2026). Мастерская приняла вещь, посмотрела (диагностика) и отправляет смету —
 * работы и запчасти с ценами или одну сумму с комментарием. Клиент по ссылке /o/<code> отвечает «Согласен» (заказ идёт
 * в работу, цена заказа = итог сметы) или «Отказаться» (вещь выдают без ремонта). Не ответил за сутки — одно
 * напоминание. Сотрудник может отметить ответ, полученный по телефону. Новая смета — новая версия: ответ на старую не
 * принимается. Те же правила, что у сервера (booktime-backend: modules/orders/order-rules.ts). Экраны импортируют
 * из '@/domain/orders' (реэкспорт).
 */
import type { ISODateTime } from '@/domain/core';
import type { OrderHistoryEntry, OrderStatus } from '@/domain/orders';
import { diffMinutes } from '@/lib/date';

export type EstimateStatus = 'pending' | 'approved' | 'declined';
export type EstimateDecision = 'approve' | 'decline';

export interface EstimateLine {
  title: string;
  /** ֏ */
  price: number;
}

/** Смета заказа (кабинет) */
export interface OrderEstimate {
  status: EstimateStatus;
  /** Растёт с каждой новой сметой — ответ клиента привязан к версии, которую он видел */
  version: number;
  /** Пусто — смета одной суммой */
  lines: EstimateLine[];
  total: number;
  /** Комментарий мастерской — его видит клиент */
  comment: string | null;
  sentAt: ISODateTime | null;
  /** Ушло напоминание «ждём ответа» (одно на версию) */
  remindedAt: ISODateTime | null;
  decidedAt: ISODateTime | null;
  /** client — ответил по ссылке, staff — сотрудник отметил ответ по телефону */
  decidedBy: 'client' | 'staff' | null;
  /** Комментарий клиента к ответу */
  clientComment: string | null;
}

/** Смета на публичной странице — без того, кто отмечал ответ и когда напоминали */
export type PublicOrderEstimate = Omit<OrderEstimate, 'remindedAt' | 'decidedBy'>;

/** Отправить смету (POST …/estimate): строки или одна сумма */
export interface EstimateInput {
  lines: EstimateLine[];
  /** Только когда строк нет */
  total?: number;
  comment?: string | null;
}

/** Смету отправляют, пока вещь у мастера и не готова: после приёма (диагностика) или по ходу работы («нашли ещё») */
export const ESTIMATE_ORDER_STATUSES: readonly OrderStatus[] = ['received', 'in_progress'];

export function canSendEstimate(status: OrderStatus): boolean {
  return ESTIMATE_ORDER_STATUSES.includes(status);
}

/** Итог сметы: сумма строк; без строк — одна сумма */
export function estimateTotalOf(lines: readonly EstimateLine[], total?: number | null): number {
  return lines.length ? lines.reduce((s, l) => s + l.price, 0) : Math.max(0, Math.round(total ?? 0));
}

/** Строка истории — смена статуса, а не событие сметы */
export function isStatusEntry(h: Pick<OrderHistoryEntry, 'event'>): boolean {
  return !h.event;
}

/** Ждём ответа клиента по смете (заказ ещё у мастера) */
export function isEstimatePending(order: { status: OrderStatus; estimate?: { status: EstimateStatus } | null }): boolean {
  return order.estimate?.status === 'pending' && canSendEstimate(order.status);
}

/** Клиент отказался — вещь отдают без ремонта */
export function isEstimateDeclined(order: { status: OrderStatus; estimate?: { status: EstimateStatus } | null }): boolean {
  return order.estimate?.status === 'declined' && canSendEstimate(order.status);
}

export type EstimateDecisionPlan =
  | { kind: 'apply'; status: Exclude<EstimateStatus, 'pending'>; orderStatus: OrderStatus }
  /** Тот же ответ на ту же смету уже записан (повтор нажатия) */
  | { kind: 'same' }
  | { kind: 'error'; code: 'estimate_not_pending' | 'estimate_changed' | 'estimate_already_decided' };

/** Ответ на смету; version — какую видел клиент (сотрудник отвечает на текущую — null) */
export function planEstimateDecision(
  order: { status: OrderStatus; estimate?: Pick<OrderEstimate, 'status' | 'version'> | null },
  decision: EstimateDecision,
  version: number | null,
): EstimateDecisionPlan {
  const est = order.estimate;
  if (!est) return { kind: 'error', code: 'estimate_not_pending' };
  if (version !== null && version !== est.version) return { kind: 'error', code: 'estimate_changed' };
  const wanted = decision === 'approve' ? 'approved' : 'declined';
  if (est.status !== 'pending') return est.status === wanted ? { kind: 'same' } : { kind: 'error', code: 'estimate_already_decided' };
  if (!canSendEstimate(order.status)) return { kind: 'error', code: 'estimate_not_pending' };
  return { kind: 'apply', status: wanted, orderStatus: decision === 'approve' && order.status === 'received' ? 'in_progress' : order.status };
}

const DAY_MIN = 24 * 60;

/** Пора напомнить «ждём ответа по смете»: сутки без ответа, одно напоминание на версию */
export function estimateReminderDue(order: { status: OrderStatus; estimate?: Pick<OrderEstimate, 'status' | 'sentAt' | 'remindedAt'> | null }, now: ISODateTime): boolean {
  const est = order.estimate;
  if (!est || est.status !== 'pending' || !canSendEstimate(order.status) || est.remindedAt || !est.sentAt) return false;
  return diffMinutes(est.sentAt.slice(0, 16), now.slice(0, 16)) >= DAY_MIN;
}

/** Шаги, которых не было: клиент отказался от сметы и вещь выдали без ремонта — «В работе» и «Готов» пропущены */
export function skippedOrderSteps(order: { status: OrderStatus; estimate?: { status: EstimateStatus } | null }): OrderStatus[] {
  return order.status === 'issued' && order.estimate?.status === 'declined' ? ['in_progress', 'ready'] : [];
}

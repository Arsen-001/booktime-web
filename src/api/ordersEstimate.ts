'use client';

/**
 * ⭐ Смета и согласование цены (05.10.2026): отправить смету клиенту, «Отправить ещё раз», ответ клиента по ссылке
 * /o/<code> и ответ, полученный по телефону (отмечает сотрудник), мок задачи воркера «ждём ответа по смете». Одна
 * операция = один request() (мок) или один вызов сервера (режим api, src/api/orders.server.ts). Правила — в
 * '@/domain/orders' (как у сервера: modules/orders/order-rules.ts). Экраны импортируют из '@/api/orders' (реэкспорт).
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { currentActor } from '@/api/core';
import { isApiMode } from '@/api/http';
import { appendNotifyLogTx } from '@/api/notify';
import * as S from '@/api/orders.server';
import { ApiError, request } from '@/api/request';
import { publicOrderTx } from '@/api/ordersPublic';
import type { Id, LocalizedText } from '@/domain/core';
import type { LogChannel } from '@/domain/notify';
import {
  canSendEstimate,
  estimateReminderDue,
  estimateTotalOf,
  inQuietHours,
  planEstimateDecision,
  type EstimateDecision,
  type EstimateInput,
  type Order,
  type OrderEstimate,
  type OrderHistoryEntry,
  type PublicOrder,
} from '@/domain/orders';
import { nowDateTime } from '@/lib/date';

function findOrderTx(businessId: Id, orderId: Id): Order {
  const order = readArea('orders').orders.find((o) => o.businessId === businessId && o.id === orderId);
  if (!order) throw new ApiError('not_found', 'Заказ не найден');
  return order;
}

function saveOrderTx(order: Order): Order {
  mutateArea('orders', (s) => {
    const i = s.orders.findIndex((o) => o.id === order.id);
    if (i >= 0) s.orders[i] = order;
  });
  return order;
}

function publicOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** «52 000 ֏» — как в сообщении сервера */
const amd = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ֏`;

/** Строка журнала отправок — тем же каналом, что «Заказ готов»: пуш клиенту с приложением, иначе Telegram-бот */
function logEstimateTx(order: Order, at: string, kind: 'estimate' | 'reminder'): void {
  const core = readCore();
  const business = core.businesses.find((b) => b.id === order.businessId);
  const client = order.clientId ? core.clients.find((c) => c.id === order.clientId) : undefined;
  const channel: LogChannel = client?.appUserId ? 'push' : 'telegram';
  const url = `${publicOrigin()}/o/${order.code}`;
  const name = business?.brandName || business?.name || '';
  const total = amd(order.estimate?.total ?? 0);
  const n = order.number;
  const text: LocalizedText =
    kind === 'estimate'
      ? {
          ru: `Смета по заказу №${n} в «${name}»: ${total}. Согласуйте или откажитесь по ссылке: ${url}`,
          en: `Estimate for your order No. ${n} at «${name}»: ${total}. Approve or decline here: ${url}`,
          hy: `«${name}»-ում ձեր №${n} պատվերի նախահաշիվը՝ ${total}։ Համաձայնեք կամ հրաժարվեք հղումով՝ ${url}`,
        }
      : {
          ru: `«${name}» ждёт вашего ответа по смете заказа №${n} (${total}). Ответить: ${url}`,
          en: `«${name}» is waiting for your reply on the estimate for order No. ${n} (${total}). Reply here: ${url}`,
          hy: `«${name}»-ը սպասում է ձեր պատասխանին №${n} պատվերի նախահաշվի վերաբերյալ (${total})։ Պատասխանել՝ ${url}`,
        };
  appendNotifyLogTx(order.businessId, [
    {
      createdAt: at,
      typeLabel:
        kind === 'estimate'
          ? { ru: 'Смета по заказу', en: 'Order estimate', hy: 'Պատվերի նախահաշիվ' }
          : { ru: 'Ждём ответа по смете', en: 'Estimate awaiting reply', hy: 'Սպասում ենք նախահաշվի պատասխանին' },
      channel,
      status: 'sent',
      contact: order.clientPhone,
      text,
      clientId: order.clientId ?? undefined,
      ...(order.staffId ? { staffId: order.staffId } : {}),
    },
  ]);
}

/** Ответ на смету (клиент или сотрудник) — общий для обоих путей; 'same' — повтор, ничего не меняем */
function decideTx(order: Order, decision: EstimateDecision, version: number | null, comment: string | null, by: { staffId: string | null; decidedBy: 'client' | 'staff' }): Order {
  const plan = planEstimateDecision(order, decision, version);
  if (plan.kind === 'same') return order;
  if (plan.kind === 'error') throw new ApiError(plan.code, plan.code);
  const est = order.estimate as OrderEstimate;
  const now = nowDateTime();
  const note = comment?.trim() || undefined;
  const history: OrderHistoryEntry[] = [
    ...order.history,
    { at: now, status: order.status, by: by.staffId, event: plan.status === 'approved' ? 'estimate_approved' : 'estimate_declined', ...(note ? { note } : {}) },
  ];
  if (plan.orderStatus !== order.status) history.push({ at: now, status: plan.orderStatus, by: by.staffId });
  return saveOrderTx({
    ...order,
    status: plan.orderStatus,
    price: plan.status === 'approved' ? est.total : order.price,
    estimate: { ...est, status: plan.status, decidedAt: now, decidedBy: by.decidedBy, clientComment: note ?? null },
    history,
    updatedAt: now,
  });
}

/** Отправить клиенту смету: новая версия, ждём ответа; клиенту — сообщение со ссылкой */
export function sendOrderEstimate(args: { businessId: Id; orderId: Id; input: EstimateInput }): Promise<Order> {
  const { businessId, orderId, input } = args;
  if (isApiMode()) return S.sendOrderEstimateServer(businessId, orderId, input);
  return request(() => {
    const current = findOrderTx(businessId, orderId);
    if (!canSendEstimate(current.status)) throw new ApiError('order_estimate_not_allowed', current.status);
    const lines = input.lines.map((l) => ({ title: l.title.trim(), price: Math.max(0, Math.round(l.price)) })).filter((l) => l.title);
    if (!lines.length && input.total === undefined) throw new ApiError('validation', 'total');
    const total = estimateTotalOf(lines, input.total);
    if (current.prepaid > total) throw new ApiError('validation', 'prepaid');
    const now = nowDateTime();
    const estimate: OrderEstimate = {
      status: 'pending',
      version: (current.estimate?.version ?? 0) + 1,
      lines,
      total,
      comment: input.comment?.trim() || null,
      sentAt: now,
      remindedAt: null,
      decidedAt: null,
      decidedBy: null,
      clientComment: null,
    };
    const next: Order = {
      ...current,
      estimate,
      history: [...current.history, { at: now, status: current.status, by: currentActor().staffId ?? null, event: 'estimate_sent', amount: total }],
      updatedAt: now,
    };
    logEstimateTx(next, now, 'estimate');
    return saveOrderTx(next);
  });
}

/** «Отправить ещё раз» — смета ждёт ответа */
export function resendOrderEstimate(args: { businessId: Id; orderId: Id }): Promise<Order> {
  const { businessId, orderId } = args;
  if (isApiMode()) return S.resendOrderEstimateServer(businessId, orderId);
  return request(() => {
    const current = findOrderTx(businessId, orderId);
    if (current.estimate?.status !== 'pending' || !canSendEstimate(current.status)) throw new ApiError('estimate_not_pending', 'estimate_not_pending');
    logEstimateTx(current, nowDateTime(), 'estimate');
    return current;
  });
}

/** Сотрудник отмечает ответ клиента, полученный по телефону: «согласен» — в работу, цена = смета */
export function decideOrderEstimate(args: { businessId: Id; orderId: Id; decision: EstimateDecision; comment?: string | null }): Promise<Order> {
  const { businessId, orderId, decision, comment = null } = args;
  if (isApiMode()) return S.decideOrderEstimateServer(businessId, orderId, decision, comment);
  return request(() => decideTx(findOrderTx(businessId, orderId), decision, null, comment, { staffId: currentActor().staffId ?? null, decidedBy: 'staff' }));
}

/** Демо-реализация decidePublicEstimate (сервер и обёртка — '@/api/orders-public') */
export function decidePublicEstimateMock(args: { code: string; decision: EstimateDecision; version: number; comment?: string | null }): Promise<PublicOrder> {
  const { code, decision, version, comment = null } = args;
  return request(() => {
    const order = readArea('orders').orders.find((o) => o.code === code);
    if (!order) throw new ApiError('not_found', 'Заказ не найден');
    decideTx(order, decision, version, comment, { staffId: null, decidedBy: 'client' });
    return publicOrderTx(code);
  });
}

/**
 * Мок задачи воркера «ждём ответа по смете» (сервер: jobs/orders-estimate-reminders.ts, раз в 15 минут): сутки без
 * ответа — одно напоминание на версию сметы. Тихие часы 21:00–10:00 — пропуск. Режим api — напоминает сервер.
 */
export function runEstimateReminders(args: { businessId: Id }): Promise<number> {
  const { businessId } = args;
  if (isApiMode()) return Promise.resolve(0);
  return request(() => {
    const now = nowDateTime();
    if (inQuietHours(now)) return 0;
    const due = readArea('orders').orders.filter((o) => o.businessId === businessId && estimateReminderDue(o, now));
    for (const o of due) {
      const next: Order = { ...o, estimate: { ...(o.estimate as OrderEstimate), remindedAt: now } };
      logEstimateTx(next, now, 'reminder');
      saveOrderTx(next);
    }
    return due.length;
  });
}

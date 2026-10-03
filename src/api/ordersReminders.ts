'use client';

/**
 * «Заказ ждёт вас» (04.10.2026) — напоминание клиенту, который не забрал готовый заказ: настройка бизнеса (выкл / 3 /
 * 3 и 7 дней) и мок задачи воркера (сервер: booktime-backend jobs/orders-pickup-reminders.ts). Экраны импортируют из
 * '@/api/orders' (реэкспорт).
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { isApiMode } from '@/api/http';
import { appendNotifyLogTx } from '@/api/notify';
import * as S from '@/api/orders.server';
import { request } from '@/api/request';
import type { Id } from '@/domain/core';
import type { LogChannel } from '@/domain/notify';
import { DEFAULT_PICKUP_REMINDER_MODE, inQuietHours, pickupReminderDue, type Order, type PickupReminderMode } from '@/domain/orders';
import { nowDateTime } from '@/lib/date';

function publicOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function saveOrderTx(order: Order): void {
  mutateArea('orders', (s) => {
    const i = s.orders.findIndex((o) => o.id === order.id);
    if (i >= 0) s.orders[i] = order;
  });
}

/** «Заказ ждёт клиента» в журнал отправок — тем же каналом, что «Заказ готов» */
function logPickupReminderTx(order: Order, at: string): void {
  const core = readCore();
  const business = core.businesses.find((b) => b.id === order.businessId);
  const client = order.clientId ? core.clients.find((c) => c.id === order.clientId) : undefined;
  const channel: LogChannel = client?.appUserId ? 'push' : 'telegram';
  const link = `${publicOrigin()}/o/${order.code}`;
  const name = business?.brandName || business?.name || '';
  appendNotifyLogTx(order.businessId, [
    {
      createdAt: at,
      typeLabel: { ru: 'Заказ ждёт клиента', en: 'Order awaiting pickup', hy: 'Պատվերը սպասում է հաճախորդին' },
      channel,
      status: 'sent',
      contact: order.clientPhone,
      text: {
        ru: `Напоминаем: заказ №${order.number} в «${name}» готов и ждёт вас. Статус: ${link}`,
        en: `Reminder: your order No. ${order.number} at «${name}» is ready and waiting for you. Status: ${link}`,
        hy: `Հիշեցնում ենք՝ ձեր №${order.number} պատվերը «${name}»-ում պատրաստ է և սպասում է ձեզ։ Կարգավիճակը՝ ${link}`,
      },
      clientId: order.clientId ?? undefined,
      ...(order.staffId ? { staffId: order.staffId } : {}),
    },
  ]);
}

function pickupModeTx(businessId: Id): PickupReminderMode {
  return readArea('orders').settings[businessId]?.pickupReminders ?? DEFAULT_PICKUP_REMINDER_MODE;
}

/** «Заказ ждёт вас»: когда напоминать клиенту, который не забрал готовый заказ (по умолчанию — через 3 и 7 дней) */
export function getPickupReminders(businessId: Id): Promise<PickupReminderMode> {
  if (isApiMode()) return S.getPickupRemindersServer(businessId);
  return request(() => pickupModeTx(businessId));
}

export function setPickupReminders(args: { businessId: Id; mode: PickupReminderMode }): Promise<PickupReminderMode> {
  const { businessId, mode } = args;
  if (isApiMode()) return S.setPickupRemindersServer(businessId, mode);
  return request(
    () => {
      mutateArea('orders', (s) => {
        s.settings[businessId] = { ...s.settings[businessId], pickupReminders: mode };
      });
      return mode;
    },
    { permission: 'settings.manage' },
  );
}

/**
 * Мок задачи воркера «заказ ждёт вас» (сервер: jobs/orders-pickup-reminders.ts, раз в 15 минут). Зовёт кабинет при
 * открытии «Заказов»: готовым заказам, у которых наступил срок, — строка журнала отправок и счётчик у заказа.
 * Тихие часы 21:00–10:00 — пропуск, как у сервера. Возвращает, скольким клиентам напомнили. Режим api — шлёт сервер.
 */
export function runPickupReminders(args: { businessId: Id }): Promise<number> {
  const { businessId } = args;
  if (isApiMode()) return Promise.resolve(0);
  return request(() => {
    const now = nowDateTime();
    if (inQuietHours(now)) return 0;
    const mode = pickupModeTx(businessId);
    if (mode === 'off') return 0;
    const due = readArea('orders')
      .orders.filter((o) => o.businessId === businessId && o.status === 'ready')
      .map((o) => ({ o, plan: pickupReminderDue(o, mode, now) }))
      .filter((x): x is { o: Order; plan: { nextCount: number } } => x.plan !== null);
    for (const { o, plan } of due) {
      const next: Order = { ...o, pickupReminderCount: plan.nextCount, pickupRemindedAt: now };
      logPickupReminderTx(next, now);
      saveOrderTx(next);
    }
    return due.length;
  });
}


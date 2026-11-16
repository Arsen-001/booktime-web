'use client';

/**
 * Чтения раздела «Заказы»: один ключ = одна функция api (ordersKeys). Бизнес и сфера — из демо-контекста / сессии.
 */
import {
  getIntakeSettings,
  getOrder,
  getPickupReminders,
  listIntakeBookings,
  listOrders,
  listPickupBookings,
  ordersKeys,
} from '@/api/orders';
import { useApiQuery, type QueryOptions } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { Order, OrdersQuery } from '@/domain/orders';

// Чтения страницы заказа без входа (/o/<код>) — в лёгком usePublicOrderData (не тянет api кабинета); реэкспорт для прежних импортов
export { usePickupSlots, usePublicOrder } from '@/areas/orders/lib/usePublicOrderData';

export function useOrdersList(query: OrdersQuery) {
  const { ready, businessId } = useCurrent();
  return useApiQuery(ordersKeys.list(businessId ?? '', query), () => listOrders(businessId ?? '', query), { enabled: ready && Boolean(businessId) });
}

export function useOrder(orderId: Id, options?: QueryOptions<Order>) {
  const { ready, businessId } = useCurrent();
  return useApiQuery(ordersKeys.order(businessId ?? '', orderId), () => getOrder(businessId ?? '', orderId), {
    ...options,
    enabled: ready && Boolean(businessId) && Boolean(orderId),
  });
}

// Меню кабинета (каждая страница /biz) — лёгкий useOrdersShell; реэкспорт для прежних импортов
export { useOrdersEnabled, useReadyOrdersCount } from '@/areas/orders/lib/useOrdersShell';

/** «Заказ ждёт вас»: когда напоминать клиенту, который не забрал готовый заказ (по умолчанию — 3 и 7 дней) */
export function usePickupReminders() {
  const { ready, businessId } = useCurrent();
  return useApiQuery(ordersKeys.pickupReminders(businessId ?? ''), () => getPickupReminders(businessId ?? ''), { enabled: ready && Boolean(businessId) });
}

/** ⭐ «Запись на сдачу» (05.10.2026): вкл/выкл, длина окна, кто принимает */
export function useIntakeSettings() {
  const { ready, businessId } = useCurrent();
  return useApiQuery(ordersKeys.intake(businessId ?? ''), () => getIntakeSettings(businessId ?? ''), { enabled: ready && Boolean(businessId) });
}

/** Записи на сдачу за день (по умолчанию — сегодня): кто придёт, что сдаёт, принят ли заказ */
export function useIntakeBookings(date: string, options?: { enabled?: boolean }) {
  const { ready, businessId } = useCurrent();
  return useApiQuery(ordersKeys.intakeBookings(businessId ?? '', date), () => listIntakeBookings(businessId ?? '', date), {
    enabled: ready && Boolean(businessId) && (options?.enabled ?? true),
  });
}

/** ⭐ «Забирают сегодня» (выдача по времени, 06.10.2026): записи на выдачу за день и их заказы */
export function usePickupBookings(date: string, options?: { enabled?: boolean }) {
  const { ready, businessId } = useCurrent();
  return useApiQuery(ordersKeys.pickupBookings(businessId ?? '', date), () => listPickupBookings(businessId ?? '', date), {
    enabled: ready && Boolean(businessId) && (options?.enabled ?? true),
  });
}

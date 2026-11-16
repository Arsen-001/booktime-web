'use client';

/**
 * Заказы — лёгкий вход для каркаса кабинета (07.10.2026, скорость): «Заказы включены?» (пункт меню) и счётчик
 * готовых заказов у пункта меню есть на каждой странице /biz. В режиме api — запрос к серверу; в демо полный
 * '@/api/orders' догружается отдельным куском (viaMock). Без этого каждая страница кабинета тянула API заказов,
 * а через него — уведомлений, настроек, журнала, финансов. Те же имена реэкспортирует '@/api/orders'.
 */
import { isApiMode } from '@/api/http';
import { ordersKeys } from '@/api/orders-public';
import * as S from '@/api/orders.server';
import { useApiQuery, viaMock, type QueryOptions } from '@/api/request';
import type { Id, SphereId } from '@/domain/core';
import { defaultOrdersEnabled, type OrdersPage, type OrdersQuery } from '@/domain/orders';

const orders = () => import('@/api/orders');

/** Список заказов (поиск, статус, страница) */
export function listOrders(businessId: Id, query: OrdersQuery = {}): Promise<OrdersPage> {
  if (isApiMode()) return S.listOrdersServer(businessId, query);
  return viaMock(orders, (m) => m.listOrdersMock(businessId, query));
}

/** «Заказы» включены у бизнеса: выбор владельца, иначе — по сфере бизнеса */
export function getOrdersEnabled(businessId: Id, sphereIds: readonly SphereId[]): Promise<boolean> {
  if (isApiMode()) return S.getOrdersEnabledServer(businessId).then((v) => v ?? defaultOrdersEnabled(sphereIds));
  return viaMock(orders, (m) => m.getOrdersEnabledMock(businessId, sphereIds));
}

/** Хук: включены ли «Заказы» (меню кабинета, экран настроек). Пока бизнес не известен — по сфере */
export function useOrdersEnabledQuery(businessId: Id | undefined, sphereIds: readonly SphereId[], options?: QueryOptions<boolean>) {
  return useApiQuery(ordersKeys.enabled(businessId ?? ''), () => getOrdersEnabled(businessId ?? '', sphereIds), {
    ...options,
    enabled: Boolean(businessId) && (options?.enabled ?? true),
  });
}

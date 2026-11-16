'use client';

/**
 * Чтения «Заказов» для каркаса кабинета (меню на каждой странице /biz): включены ли заказы, счётчик готовых.
 * Лёгкий файл (07.10.2026, скорость): только '@/api/orders-shell', без API раздела целиком. Реэкспорт — useOrdersData.
 */
import { useCoreGet } from '@/api/core';
import { ordersKeys } from '@/api/orders-public';
import { listOrders, useOrdersEnabledQuery } from '@/api/orders-shell';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { defaultOrdersEnabled } from '@/domain/orders';

/** Счётчик готовых заказов у пункта меню (нет данных или 0 — без значка) */
export function useReadyOrdersCount(): number | undefined {
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(ordersKeys.count(businessId ?? '', 'ready'), () => listOrders(businessId ?? '', { status: 'ready', page: 1, pageSize: 1 }), {
    enabled: ready && Boolean(businessId),
  });
  return q.data?.total;
}

/**
 * Включены ли «Заказы» у текущего бизнеса. Пока ответа нет — по сфере бизнеса (а пока не знаем и бизнес — по сфере демо),
 * чтобы пункт меню не появлялся и не исчезал после загрузки.
 */
export function useOrdersEnabled(): { enabled: boolean; loading: boolean } {
  const { ready, businessId, sphere } = useCurrent();
  const businessQ = useCoreGet('businesses', businessId, { enabled: ready });
  const sphereIds = businessQ.data?.sphereIds ?? [sphere];
  const q = useOrdersEnabledQuery(businessId, sphereIds, { enabled: ready && Boolean(businessQ.data) });
  return { enabled: q.data ?? defaultOrdersEnabled(sphereIds), loading: !ready || businessQ.isLoading || q.isLoading };
}

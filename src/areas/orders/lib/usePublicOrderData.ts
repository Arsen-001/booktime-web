'use client';

/**
 * Чтения страницы заказа без входа (/o/<код>): только '@/api/orders-public' — страница не тянет api кабинета.
 * Остальные чтения раздела — useOrdersData.ts (он же реэкспортирует эти хуки).
 */
import { getPublicOrder, getPublicPickupSlots, ordersKeys } from '@/api/orders-public';
import { useApiQuery } from '@/api/request';
import type { PublicOrder } from '@/domain/orders';

export function usePublicOrder(code: string, initialData?: PublicOrder) {
  return useApiQuery(ordersKeys.public(code), () => getPublicOrder(code), { enabled: Boolean(code), initialData });
}

/** Свободное время выдачи готового заказа на неделю (страница /o/<код>, без входа) */
export function usePickupSlots(code: string, enabled: boolean) {
  return useApiQuery(ordersKeys.pickupSlots(code), () => getPublicPickupSlots(code), { enabled: Boolean(code) && enabled });
}

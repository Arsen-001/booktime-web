'use client';

/**
 * F-02-011: свои типы нерабочих дней сети (строит раздел network — src/areas/network/OffDaysScreen.tsx),
 * здесь только чтение для показа в «Тип» панели графика и в таблице/ячейке. Один тип может быть отмечен
 * не для всех локаций сети — фильтруем по businessId текущего кабинета.
 */
import type { Id } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import { listNetworkOffDayTypes } from '@/api/network';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';

export function useCustomDayTypes(businessId?: Id): NetworkOffDayType[] {
  const { networkId } = useCurrent();
  const q = useApiQuery(
    ['schedule', 'network-off-day-types', networkId ?? ''],
    () => listNetworkOffDayTypes(networkId!),
    { enabled: Boolean(networkId) },
  );
  const all = q.data ?? [];
  return businessId ? all.filter((o) => o.businessIds.includes(businessId)) : all;
}

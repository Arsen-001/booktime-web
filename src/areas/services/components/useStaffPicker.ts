'use client';

/**
 * Выбор «чей профиль» на экранах /biz/services/{photos,documents,materials}: владелец и админ выбирают
 * мастера из списка, мастер-индивидуал и мастер в салоне видят только свой профиль (без селектора).
 * По умолчанию — первый мастер, у которого на этом экране что-то есть (У28), а не владелица с пустым профилем.
 * Можно прийти с ?staffId=<id> (ссылка из вклада в карточку сотрудника, F-10-027 extension).
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { listStaffContentCounts, listStaffForPicker, type StaffContentCounts } from '@/api/services';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Staff } from '@/domain/core';

export interface StaffPickerResult {
  ready: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** true — персона видит только себя (мастер/индивидуал), селектор не нужен */
  fixed: boolean;
  staffId: string | undefined;
  staffList: Staff[];
  counts: Record<string, StaffContentCounts>;
  setStaffId: (id: string) => void;
}

export function useStaffPicker(kind: keyof StaffContentCounts): StaffPickerResult {
  const { ready, businessId, persona, staffId: myStaffId } = useCurrent();
  const searchParams = useSearchParams();
  const fixed = persona === 'master' || persona === 'individual';
  const enabled = ready && Boolean(businessId) && !fixed;
  const staffQ = useApiQuery(['services', 'staffPicker', businessId], () => listStaffForPicker(businessId ?? ''), { enabled });
  const countsQ = useApiQuery(['services', 'staffContentCounts', businessId], () => listStaffContentCounts(businessId ?? ''), { enabled });
  const list = staffQ.data ?? [];
  const counts = countsQ.data ?? {};
  const fromQuery = searchParams.get('staffId') ?? undefined;
  const [selected, setSelected] = useState<string | undefined>(fromQuery);

  const withData = list.find((s) => (counts[s.id]?.[kind] ?? 0) > 0);
  const staffId = fixed ? myStaffId : selected && list.some((s) => s.id === selected) ? selected : (withData ?? list[0])?.id;

  return {
    ready: fixed ? ready : ready && !staffQ.isLoading && !countsQ.isLoading,
    isLoading: !fixed && (staffQ.isLoading || countsQ.isLoading),
    isError: !fixed && staffQ.isError,
    refetch: () => staffQ.refetch(),
    fixed,
    staffId,
    staffList: list,
    counts,
    setStaffId: setSelected,
  };
}

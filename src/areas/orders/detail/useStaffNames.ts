'use client';

import { useCoreList } from '@/api/core';

export function useStaffNames(businessId: string): (id: string | null | undefined) => string | undefined {
  const q = useCoreList('staff', { businessId }, { enabled: Boolean(businessId) });
  return (id) => (id ? q.data?.find((s) => s.id === id)?.name : undefined);
}

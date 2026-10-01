'use client';

import { deleteStaffSet, listStaffSets, saveStaffSet } from '@/api/journal';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import type { StaffSet } from '@/domain/journal';

/**
 * «Мои наборы» мастеров в журнале (⭐ наше, 29.09.2026): сотрудник сохраняет, кого показывать («Утренняя смена»,
 * «Барберы»), и включает набор одним нажатием. Наборы личные и хранятся в аккаунте сотрудника (src/api/journal —
 * listStaffSets), поэтому одинаковы на любом компьютере и телефоне.
 */
export function useStaffSets(staffId: Id | undefined): {
  sets: StaffSet[];
  add: (name: string, staffIds: Id[]) => void;
  remove: (setId: Id) => void;
} {
  const q = useApiQuery(['journal', 'staff-sets', staffId], () => listStaffSets(staffId!), { enabled: Boolean(staffId) });
  const save = useApiMutation(saveStaffSet);
  const del = useApiMutation(deleteStaffSet);
  return {
    sets: q.data ?? [],
    add: (name, staffIds) => {
      if (staffId) save.mutate({ staffId, name, staffIds });
    },
    remove: (setId) => {
      if (staffId) del.mutate({ staffId, setId });
    },
  };
}

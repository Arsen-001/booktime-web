'use client';

/**
 * F-12-084…089: 25 галочек группы «Отчёты» текущего сотрудника — см. ReportsStaffPermissions в
 * domain/reports.ts. Мелкое право раздела читается здесь так же, как useStockPermissions в stock.
 */
import { getReportsPermissions } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { defaultReportsPermissions, type ReportsStaffPermissions } from '@/domain/reports';

export function useReportsPermissions(): ReportsStaffPermissions {
  const { businessId, staffId } = useCurrent();
  const edit = useCan('staff.manage');
  const view = useCan('reports.view');
  const q = useApiQuery(['reports', 'permissions', businessId, staffId], () => getReportsPermissions(businessId!, staffId!), { enabled: Boolean(businessId) && Boolean(staffId) });
  return q.data ?? defaultReportsPermissions({ edit, view });
}

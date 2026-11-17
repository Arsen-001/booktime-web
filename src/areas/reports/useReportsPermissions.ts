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
  // Галочки читает сервер только при staff.view: у мастера без него был 403 в консоли («Моя аналитика», проход 17.11);
  // ему и так всё по умолчанию — отчёты закрыты
  const staffView = useCan('staff.view');
  const q = useApiQuery(['reports', 'permissions', businessId, staffId], () => getReportsPermissions(businessId!, staffId!), {
    enabled: Boolean(businessId) && Boolean(staffId) && staffView,
  });
  return q.data ?? defaultReportsPermissions({ edit, view });
}

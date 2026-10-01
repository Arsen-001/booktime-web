'use client';

/**
 * Вклад раздела «payroll» в карточку сотрудника (хост «staffCard»): вкладка «Зарплата» — тот же
 * редактор схемы, что и /biz/payroll/staff/[staffId] (F-09-010, F-09-011). Принадлежит разделу «payroll».
 * Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/payroll
 */
import type { StaffCardExtProps } from '@/extensions/types';
import { SchemeEditor } from '@/areas/payroll/scheme/SchemeEditor';

export default function PayrollStaffCard({ staffId, businessId }: StaffCardExtProps) {
  return <SchemeEditor staffId={staffId} businessId={businessId} embedded />;
}

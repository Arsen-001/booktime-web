'use client';

/**
 * Вклад раздела «payroll» в карточку сотрудника (хост «staffCard»): вкладка «Зарплата» — тот же
 * редактор схемы, что и /biz/payroll/staff/[staffId] (F-09-010, F-09-011). Принадлежит разделу «payroll».
 * Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/payroll
 */
import { LockKeyhole } from 'lucide-react';
import type { StaffCardExtProps } from '@/extensions/types';
import { SchemeEditor } from '@/areas/payroll/scheme/SchemeEditor';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export default function PayrollStaffCard({ staffId, businessId }: StaffCardExtProps) {
  const t = useT('ui');
  const { staffId: currentStaffId, ready } = useCurrent();
  const canManage = useCan('payroll.manage');
  // Чужую схему сервер отдаёт только с payroll.manage (своя — с payroll.view): без права — понятный отказ, а не
  // «Не удалось загрузить» и 403 в консоли (проход 17.11, «только просмотр»)
  if (!ready) return null;
  if (!canManage && staffId !== currentStaffId) {
    return <EmptyState compact icon={<LockKeyhole aria-hidden className="size-6" />} title={t('permission.denied')} description={t('permission.deniedHint')} />;
  }
  return <SchemeEditor staffId={staffId} businessId={businessId} embedded />;
}

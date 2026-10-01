'use client';

/**
 * Вклад раздела «schedule» в карточку сотрудника (хост «staffCard»). Файл принадлежит разделу «schedule».
 * График (до какой даты, настроить, убрать), онлайн-запись мастера, доступ и журнал, Google Календарь.
 * Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/schedule
 */
import type { StaffCardExtProps } from '@/extensions/types';
import { useCoreGet } from '@/api/core';
import { StaffAccessSection } from '@/areas/schedule/staff-card/StaffAccessSection';
import { StaffGoogleSection } from '@/areas/schedule/staff-card/StaffGoogleSection';
import { StaffOnlineSection } from '@/areas/schedule/staff-card/StaffOnlineSection';
import { StaffScheduleSection } from '@/areas/schedule/staff-card/StaffScheduleSection';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';

export default function ScheduleStaffCard({ staffId, businessId }: StaffCardExtProps) {
  const t = useT('schedule');
  // Настройки чужого сотрудника — у тех, кто ведёт всех (владелец, администратор, сеть), не у самого мастера
  const canManage = useCan('journal.others');
  const canEdit = useCan('schedule.edit');
  const staffQuery = useCoreGet('staff', staffId);
  const staff = staffQuery.data;

  // Пока сотрудник грузится — та же карточка: секции рисуют себя неактивными с полосами на месте значений
  // (DESIGN.md → «The skeleton IS the page»), а не три серые строки
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface [&>*]:p-4">
      <StaffScheduleSection staffId={staffId} staff={staff} canEdit={canEdit} />
      <StaffOnlineSection staffId={staffId} businessId={businessId} />
      {staff && staff.locationIds.length > 1 && (
        <div data-f="F-02-089">
          <Badge tone="neutral">{t('staffCard.networkStaff', { n: staff.locationIds.length })}</Badge>
        </div>
      )}
      {canManage && (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-fg">{t('staffCard.recordsTitle')}</p>
          <StaffAccessSection staffId={staffId} staff={staff} />
        </div>
      )}
      {canManage && <StaffGoogleSection staffId={staffId} />}
    </div>
  );
}

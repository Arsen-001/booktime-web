'use client';

import { CalendarDays, CalendarPlus, Copy, EllipsisVertical, Repeat, UserRound } from 'lucide-react';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { DropdownMenu } from '@/ui/DropdownMenu';

export interface ScheduleRowMenuProps {
  staffId: Id;
  staffName: string;
  canEdit: boolean;
  onCopy: (staffId: Id) => void;
  onAddTomorrow: (staffId: Id) => void;
  /** Г12: «Повторить неделю…» — неделя этого мастера на N недель вперёд */
  onRepeatWeek?: (staffId: Id) => void;
  /** Месяц на телефоне: узкая кнопка */
  compact?: boolean;
}

/**
 * «⋯» у сотрудника: открыть его неделю, рабочий день на завтра, скопировать график, карточка. Заменяет карточку
 * «Быстрый доступ» над таблицей (ux-r5 №2.4, ux-best-c2 №3). Кнопка подписана именем (ux-r2 m-4).
 * Наш аналог «Панели быстрого доступа» (F-02-099): из списка сотрудников — сразу в его неделю
 * (`table.openWeek` → `/biz/schedule/calendar?staff=`) и «добавить рабочий день» (`table.addTomorrow`),
 * кнопка скрыта без права на правку графика.
 */
export function ScheduleRowMenu({ staffId, staffName, canEdit, onCopy, onAddTomorrow, onRepeatWeek, compact = false }: ScheduleRowMenuProps) {
  const t = useT('schedule');
  return (
    <DropdownMenu
      label={staffName}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          data-f="F-02-099"
          aria-label={t('table.rowMenuFor', { name: staffName })}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg',
            compact && 'max-sm:w-7',
          )}
        >
          <EllipsisVertical className="size-5" aria-hidden />
        </button>
      )}
      items={[
        { id: 'week', label: t('table.openWeek'), icon: <CalendarDays aria-hidden />, href: `/biz/schedule/calendar?staff=${staffId}` },
        ...(canEdit
          ? [
              { id: 'tomorrow', label: t('table.addTomorrow'), icon: <CalendarPlus aria-hidden />, onSelect: () => onAddTomorrow(staffId) },
              { id: 'copy', label: t('copy.action'), icon: <Copy aria-hidden />, onSelect: () => onCopy(staffId) },
              ...(onRepeatWeek
                ? [{ id: 'repeat', label: t('repeat.menu'), icon: <Repeat aria-hidden />, onSelect: () => onRepeatWeek(staffId) }]
                : []),
            ]
          : []),
        { id: 'card', label: t('table.editStaff'), icon: <UserRound aria-hidden />, href: `/biz/staff/${staffId}` },
      ]}
    />
  );
}

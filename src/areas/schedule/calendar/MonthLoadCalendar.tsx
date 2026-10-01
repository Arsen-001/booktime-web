'use client';

/**
 * F-02-038: месячный календарь загрузки — открывается по дате в углу «Моего календаря»; кружок дня красится по
 * загрузке (F-02-031), выбор «Все / один сотрудник» доступен владельцу и админу. Дни без права смотреть прошлое
 * остаются видимыми (загрузка не прячется), но день просто не открывается — обрабатывает вызывающий экран.
 */
import { useMemo, useState } from 'react';
import type { Id, ISODate } from '@/domain/core';
import { getRangeLoad } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { parse, toISODate } from '@/lib/date';
import { Calendar, type CalendarDayMeta, type CalendarDayTone } from '@/ui/Calendar';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';

export interface MonthLoadCalendarStaffOption {
  id: Id;
  name: string;
}

export interface MonthLoadCalendarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Сотрудники, среди которых можно выбирать «Все» / одного (пусто — выбора нет, считаем только staffIds) */
  staffOptions: MonthLoadCalendarStaffOption[];
  /** Когда выбор недоступен (мастер смотрит только свой) — фиксированный набор id для расчёта */
  staffIds: Id[];
  anchor: ISODate;
  onPickDate: (date: ISODate) => void;
}

function loadTone(ratio: number): CalendarDayTone {
  if (ratio > 0.8) return 'danger';
  if (ratio > 0.5) return 'warning';
  return 'success';
}

export function MonthLoadCalendar({
  open,
  onOpenChange,
  staffOptions,
  staffIds,
  anchor,
  onPickDate,
}: MonthLoadCalendarProps) {
  const t = useT('schedule');
  const [month, setMonth] = useState(() => anchor.slice(0, 7) + '-01');
  const [pickedStaff, setPickedStaff] = useState<'all' | Id>('all');

  const activeStaffIds = staffOptions.length > 1 && pickedStaff !== 'all' ? [pickedStaff] : staffIds;

  // видны текущий, прошлый и следующий месяцы (F-02-038)
  const range = useMemo(() => {
    const start = parse(month).subtract(1, 'month').startOf('month');
    const end = parse(month).add(1, 'month').endOf('month');
    return { from: toISODate(start), to: toISODate(end) };
  }, [month]);

  const q = useApiQuery(
    ['schedule', 'month-load', activeStaffIds.join(','), range.from, range.to],
    () => getRangeLoad(activeStaffIds, range.from, range.to),
    { enabled: open && activeStaffIds.length > 0 },
  );

  const dayMeta = (date: ISODate): CalendarDayMeta | undefined => {
    const load = q.data?.[date];
    if (!load) return undefined;
    if (!load.hasSchedule) return { label: t('miniCalendar.noSchedule') };
    if (load.ratio <= 0) return undefined;
    return {
      tone: loadTone(load.ratio),
      dot: true,
      label: t('miniCalendar.loadPercent', { pct: Math.round(load.ratio * 100) }),
    };
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('calendar.monthLoadTitle')} size="sm">
      <div className="flex flex-col gap-4" data-f="F-02-038">
        {staffOptions.length > 1 && (
          <Select
            aria-label={t('calendar.pickStaff')}
            value={pickedStaff}
            onValueChange={(v) => setPickedStaff(v as 'all' | Id)}
            options={[
              { value: 'all', label: t('calendar.monthLoadAllStaff') },
              ...staffOptions.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        )}
        {q.isLoading && !q.data ? (
          <Skeleton variant="rect" className="h-64 w-full rounded-xl" />
        ) : (
          <Calendar
            value={anchor}
            onValueChange={(d) => {
              onPickDate(d);
              onOpenChange(false);
            }}
            month={month}
            onMonthChange={setMonth}
            dayMeta={dayMeta}
          />
        )}
      </div>
    </Modal>
  );
}

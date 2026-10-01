'use client';

import { CalendarOff, Coffee, House, Plane, Thermometer, UserX, type LucideIcon } from 'lucide-react';
import type { ScheduleCell } from '@/api/schedule';
import type { NetworkOffDayType } from '@/domain/network';
import type { DayTypeId } from '@/domain/schedule';
import { dayTypeById } from '@/domain/schedule';
import { breaksOf, shortHours, shortTime, spanText } from '@/areas/schedule/lib/hours';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';

/** Литеральные классы — Tailwind сканирует исходники, конструировать имя строкой нельзя */
export const CELL_BG: Record<DayTypeId | 'empty' | 'elsewhere', string> = {
  work: 'bg-success-soft text-fg',
  sick: 'bg-chart-5/15 text-fg',
  vacation: 'bg-chart-1/15 text-fg',
  unpaid_leave: 'bg-chart-6/15 text-fg',
  absence: 'bg-chart-8/15 text-fg',
  paid_day_off: 'bg-chart-4/15 text-fg',
  not_working: 'bg-surface-2 text-muted',
  empty: 'bg-surface text-muted',
  elsewhere: 'bg-info-soft text-fg',
};

/** F-02-011: свой тип нерабочего дня — цвет из своего colorIndex (1..8), а не из системной палитры выше */
const CUSTOM_TYPE_BG: Record<number, string> = {
  1: 'bg-chart-1/15 text-fg',
  2: 'bg-chart-2/15 text-fg',
  3: 'bg-chart-3/15 text-fg',
  4: 'bg-chart-4/15 text-fg',
  5: 'bg-chart-5/15 text-fg',
  6: 'bg-chart-6/15 text-fg',
  7: 'bg-chart-7/15 text-fg',
  8: 'bg-chart-8/15 text-fg',
};

/** Нерабочие типы — иконкой 16 px вместо слова мелким шрифтом (ux-r2 m-3) */
export const DAY_TYPE_ICON: Partial<Record<DayTypeId, LucideIcon>> = {
  sick: Thermometer,
  vacation: Plane,
  unpaid_leave: CalendarOff,
  absence: UserX,
  paid_day_off: Coffee,
};

export type CellPreview = 'work' | 'off';

export interface ScheduleCellViewProps {
  cell: ScheduleCell;
  /** Выбрана (пунктир primary) */
  active: boolean;
  /** Попадёт под правку: 'work' — станет рабочим (светлый пунктир), 'off' — снимем часы (красный пунктир) */
  preview?: CellPreview;
  /** Выбор снимается протягиванием (красный пунктир) */
  removing?: boolean;
  /** Телефон: число месяца в углу */
  showDate?: boolean;
  /** Г9: месяц — узкая клетка, часы в две строки «10 / 19» */
  compact?: boolean;
  /** Г6: короткая метка филиала (при «Все филиалы» у мастера нескольких филиалов) */
  locationLabel?: string;
  /** F-02-011: свои типы нерабочих дней сети — для показа настоящего имени и цвета вместо генерик-фолбэка */
  customTypes?: NetworkOffDayType[];
}

/**
 * Ячейка таблицы графика: часы «10–19», тип дня иконкой, «дома», точка «есть записи», выделение пунктиром.
 * Г13: перерыв — точка в углу и подсказка с часами перерыва; часы «дома» видны и на телефоне. Г16: заметка — уголок.
 * Г3: нерабочий день, в котором остались записи, — предупреждающая рамка и число записей.
 */
export function ScheduleCellView({
  cell,
  active,
  preview,
  removing = false,
  showDate = false,
  compact = false,
  locationLabel,
  customTypes,
}: ScheduleCellViewProps) {
  const t = useT('schedule');
  const tDyn = useTDynamic();
  const format = useFormat();
  const dt = cell.typeId ? dayTypeById(cell.typeId) : null;
  const custom = dt && dt.id.startsWith('custom:') ? customTypes?.find((c) => `custom:${c.id}` === dt.id) : undefined;
  const works = Boolean(dt?.working) && cell.hours.length > 0;
  const elsewhere = cell.elsewhere?.[0];
  const isCustom = Boolean(dt?.id.startsWith('custom:')) && !works;
  const kind: DayTypeId | 'empty' | 'elsewhere' =
    works ? 'work' : dt && dt.id !== 'work' && !isCustom ? dt.id : elsewhere ? 'elsewhere' : 'empty';
  const bgClass = isCustom ? CUSTOM_TYPE_BG[custom?.colorIndex ?? 2] : CELL_BG[kind];
  const Icon = dt ? DAY_TYPE_ICON[dt.id] : undefined;
  const isToday = cell.date === today();
  const customTypeLabel = custom ? custom.name : dt?.id.startsWith('custom:') ? tDyn(`schedule.${dt.labelKey}`) : undefined;
  const breaks = works ? breaksOf(cell.hours) : [];
  const offWithBookings = !works && !elsewhere && (cell.bookings ?? 0) > 0;
  const hoursText = shortHours(cell.hours);

  const label = [
    format.date(cell.date, 'weekday'),
    works ? spanText(cell.hours) : (customTypeLabel ?? (dt && dt.id !== 'work' ? tDyn(`schedule.${dt.labelKey}`) : t('table.cellEmpty'))),
    breaks.length ? t('table.breaks', { list: breaks.map((b) => `${b.from}–${b.to}`).join(', ') }) : '',
    elsewhere ? `${t(`table.workplace.${elsewhere.workplace}` as 'table.workplace.home')} ${spanText(elsewhere.hours)}` : '',
    offWithBookings ? t('table.offWithBookings', { n: cell.bookings ?? 0 }) : cell.hasBookings ? t('table.hasBookings') : '',
    cell.note ? t('table.noteLabel', { note: cell.note }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const border =
    active && removing
      ? 'border-dashed border-danger'
      : active
        ? 'border-dashed border-primary'
        : preview === 'off' && works
          ? 'border-dashed border-danger/70'
          : preview
            ? 'border-dashed border-primary/60'
            : offWithBookings
              ? 'border-warning'
              : isToday
                ? 'border-primary/25'
                : kind === 'empty'
                  ? 'border-border'
                  : 'border-transparent';

  return (
    <span
      className={cn(
        'relative flex w-full flex-col items-center justify-center gap-0.5 rounded-md border-2 text-center transition-colors',
        compact ? 'h-12 min-w-0' : 'h-14',
        !showDate && !compact && 'min-w-16',
        bgClass,
        border,
      )}
      title={label}
      aria-label={label}
    >
      {showDate && (
        <span aria-hidden className={cn('absolute top-0.5 left-1 text-xs leading-none font-semibold', isToday ? 'text-primary-text' : 'text-muted')}>
          {Number(cell.date.slice(8, 10))}
        </span>
      )}
      {cell.note && <span aria-hidden className="absolute top-0 left-0 size-0 border-t-[7px] border-r-[7px] border-t-info border-r-transparent" />}
      {breaks.length > 0 && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-warning" />}
      {locationLabel && !compact && (
        <span aria-hidden className="absolute right-1 bottom-0.5 text-[10px] leading-none font-semibold text-muted">
          {locationLabel}
        </span>
      )}
      <span aria-hidden className="flex flex-col items-center leading-tight">
        {works ? (
          compact ? (
            <span className="flex flex-col text-[11px] leading-[1.15] font-semibold tabular-nums">
              <span>{shortTime(cell.hours[0].from)}</span>
              <span>{shortTime(cell.hours[cell.hours.length - 1].to)}</span>
            </span>
          ) : (
            <span className={cn('font-semibold whitespace-nowrap tabular-nums', showDate && hoursText.length > 5 ? 'text-xs' : 'text-sm')}>{hoursText}</span>
          )
        ) : isCustom ? (
          <span className={cn('truncate font-semibold', compact ? 'max-w-7 text-[10px]' : 'max-w-14 text-xs')} data-f="F-02-011">
            {customTypeLabel}
          </span>
        ) : Icon ? (
          <Icon className={compact ? 'size-3.5' : 'size-4'} />
        ) : elsewhere ? (
          <span className="flex flex-col items-center gap-0 leading-none">
            <House className="size-3.5 shrink-0" />
            {!compact && (
              <span className={cn('font-semibold whitespace-nowrap tabular-nums', showDate ? 'mt-0.5 text-[10px]' : 'mt-0.5 text-xs')}>
                {shortHours(elsewhere.hours)}
              </span>
            )}
          </span>
        ) : (
          <span>—</span>
        )}
        {works && elsewhere && !compact && <House className="size-3.5 text-info" />}
      </span>
      {offWithBookings ? (
        <span aria-hidden className={cn('font-semibold text-warning tabular-nums', compact ? 'text-[10px] leading-none' : 'text-[11px] leading-none')}>
          {cell.bookings}
        </span>
      ) : (
        cell.hasBookings && !compact && <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      )}
    </span>
  );
}

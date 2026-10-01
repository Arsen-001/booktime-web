'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ISODate } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { parse, toISODate, today } from '@/lib/date';
import { IconButton } from '@/ui/IconButton';

export type CalendarDayTone = 'success' | 'warning' | 'danger' | 'primary' | 'muted';

export interface CalendarDayMeta {
  /**
   * Цвет дня: с dot — цвет точки под числом («есть время», «есть записи»); без dot — мягкая заливка ячейки, только для
   * ОСОБЫХ дней (праздник, отпуск). Недоступный день — это `disabled` без тона: он бледный, и точка у него не рисуется.
   */
  tone?: CalendarDayTone;
  dot?: boolean;
  disabled?: boolean;
  /** Добавляется к подписи дня для скринридера и в подсказку */
  label?: string;
}

export interface DateRange {
  from?: ISODate;
  to?: ISODate;
}

export interface CalendarProps {
  /** Любая дата показываемого месяца (управляемо) */
  month?: ISODate;
  defaultMonth?: ISODate;
  onMonthChange?: (month: ISODate) => void;
  mode?: 'single' | 'range';
  value?: ISODate | null;
  onValueChange?: (date: ISODate) => void;
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  min?: ISODate;
  max?: ISODate;
  dayMeta?: (date: ISODate) => CalendarDayMeta | undefined;
  className?: string;
}

const SOFT: Record<CalendarDayTone, string> = {
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  primary: 'bg-primary-soft',
  muted: 'bg-surface-3',
};

const DOT: Record<CalendarDayTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  primary: 'bg-primary',
  muted: 'bg-muted',
};

function monthStart(date: ISODate): ISODate {
  return toISODate(parse(date).startOf('month'));
}

/** 6 недель с понедельника, покрывающих месяц */
function gridDays(month: ISODate): ISODate[] {
  const first = parse(month).startOf('month');
  const start = first.isoWeekday(1);
  const weeks = first.add(1, 'month').subtract(1, 'day').diff(start, 'day') >= 35 ? 6 : 5;
  return Array.from({ length: weeks * 7 }, (_, i) => toISODate(start.add(i, 'day')));
}

/**
 * Календарь месяца (неделя с понедельника). Один день или период, отметки дней (dayMeta),
 * клавиатура: стрелки, PageUp/PageDown — месяц, Home/End — начало/конец недели.
 */
export function Calendar({
  month: monthProp,
  defaultMonth,
  onMonthChange,
  mode = 'single',
  value,
  onValueChange,
  range,
  onRangeChange,
  min,
  max,
  dayMeta,
  className,
}: CalendarProps) {
  const t = useT('ui');
  const format = useFormat();
  const initial = monthStart(defaultMonth ?? value ?? range?.from ?? today());
  const [innerMonth, setInnerMonth] = useState(initial);
  const month = monthProp ? monthStart(monthProp) : innerMonth;
  const [focused, setFocused] = useState<ISODate | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef(false);

  const now = today();
  const days = gridDays(month);
  const monthKey = month.slice(0, 7);
  const selected = mode === 'single' ? (value ?? null) : null;
  const candidate = focused ?? selected ?? range?.from ?? now;
  const focusDate = candidate.startsWith(monthKey) ? candidate : month;

  const setMonth = (next: ISODate) => {
    const m = monthStart(next);
    if (!monthProp) setInnerMonth(m);
    onMonthChange?.(m);
  };

  useEffect(() => {
    if (!keyboardRef.current) return;
    keyboardRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate]);

  const isDisabled = (d: ISODate) => Boolean((min && d < min) || (max && d > max) || dayMeta?.(d)?.disabled);

  const pick = (d: ISODate) => {
    if (isDisabled(d)) return;
    setFocused(d);
    if (!d.startsWith(monthKey)) setMonth(d);
    if (mode === 'single') {
      onValueChange?.(d);
      return;
    }
    const from = range?.from;
    const to = range?.to;
    if (!from || to) onRangeChange?.({ from: d, to: undefined });
    else if (d < from) onRangeChange?.({ from: d, to: from });
    else onRangeChange?.({ from, to: d });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = parse(focusDate);
    let next: ISODate | null = null;
    if (event.key === 'ArrowLeft') next = toISODate(base.subtract(1, 'day'));
    else if (event.key === 'ArrowRight') next = toISODate(base.add(1, 'day'));
    else if (event.key === 'ArrowUp') next = toISODate(base.subtract(7, 'day'));
    else if (event.key === 'ArrowDown') next = toISODate(base.add(7, 'day'));
    else if (event.key === 'PageUp') next = toISODate(base.subtract(1, 'month'));
    else if (event.key === 'PageDown') next = toISODate(base.add(1, 'month'));
    else if (event.key === 'Home') next = toISODate(base.isoWeekday(1));
    else if (event.key === 'End') next = toISODate(base.isoWeekday(7));
    if (!next) return;
    event.preventDefault();
    keyboardRef.current = true;
    setFocused(next);
    if (!next.startsWith(monthKey)) setMonth(next);
  };

  const title = format.date(month, 'monthYear');
  const weekdays = format.weekdaysShort();

  return (
    <div className={cn('w-full max-w-[22rem] select-none', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton
          size="sm"
          icon={<ChevronLeft aria-hidden />}
          label={t('calendar.prevMonth')}
          onClick={() => setMonth(toISODate(parse(month).subtract(1, 'month')))}
        />
        <p aria-live="polite" className="text-base font-semibold first-letter:uppercase">
          {title}
        </p>
        <IconButton
          size="sm"
          icon={<ChevronRight aria-hidden />}
          label={t('calendar.nextMonth')}
          onClick={() => setMonth(toISODate(parse(month).add(1, 'month')))}
        />
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted" aria-hidden>
        {weekdays.map((w, i) => (
          // Выходные — тем же цветом: для салона суббота — рабочий день, красный здесь был бы случайным цветом
          <span key={i} className="py-1.5 first-letter:uppercase">
            {w}
          </span>
        ))}
      </div>
      <div ref={gridRef} role="grid" aria-label={title} onKeyDown={onKeyDown} className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const meta = dayMeta?.(d);
          const outside = !d.startsWith(monthKey);
          const disabled = isDisabled(d);
          const isToday = d === now;
          const isSelected = mode === 'single' ? d === selected : d === range?.from || d === range?.to;
          const inRange = mode === 'range' && range?.from && range?.to && d > range.from && d < range.to;
          const rangeStart = mode === 'range' && range?.from && range?.to && d === range.from;
          const rangeEnd = mode === 'range' && range?.from && range?.to && d === range.to;
          const label = [format.date(d, 'weekdayLong'), meta?.label].filter(Boolean).join(', ');
          return (
            <div
              key={d}
              role="gridcell"
              aria-selected={isSelected || undefined}
              className={cn(
                'flex justify-center',
                inRange && 'bg-primary-soft',
                rangeStart && 'rounded-l-full bg-primary-soft',
                rangeEnd && 'rounded-r-full bg-primary-soft',
              )}
            >
              <button
                type="button"
                data-date={d}
                tabIndex={d === focusDate ? 0 : -1}
                disabled={disabled}
                aria-label={label}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => pick(d)}
                className={cn(
                  // Круг 44 px; в узкой панели (288 px) — по ширине колонки (≥ 40 px), не залезая на соседа
                  // Цвет и прозрачность меняются плавно: отметки «есть время» приходят позже сетки — без рывка перекраски (М3)
                  'relative flex aspect-square w-full max-w-11 min-w-10 flex-col items-center justify-center rounded-full text-[0.9375rem] tabular-nums transition-[color,background-color,opacity] duration-200',
                  'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1',
                  outside ? 'text-muted' : 'text-fg',
                  meta?.tone && !meta.dot && !isSelected && SOFT[meta.tone],
                  isToday && !isSelected && 'font-semibold text-primary-text ring-1 ring-primary ring-inset',
                  isSelected && 'bg-primary font-semibold text-primary-contrast hover:bg-primary-hover',
                  disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                )}
              >
                <span>{parse(d).date()}</span>
                {meta?.dot && !disabled && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute bottom-1.5 size-1.5 rounded-full',
                      isSelected ? 'bg-primary-contrast' : DOT[meta.tone ?? 'primary'],
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

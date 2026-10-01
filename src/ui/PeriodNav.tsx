'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { parse, toISODate, today, weekStart } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Calendar } from '@/ui/Calendar';
import { IconButton } from '@/ui/IconButton';
import { Popover } from '@/ui/Popover';

export type PeriodUnit = 'day' | 'week' | 'month';

export interface PeriodNavProps {
  unit: PeriodUnit;
  /** Любая дата периода */
  value: ISODate;
  onValueChange: (value: ISODate) => void;
  min?: ISODate;
  max?: ISODate;
  /** Кнопка «Сегодня» (скрыта, если текущий период уже открыт). По умолчанию да */
  showToday?: boolean;
  className?: string;
}

/** Начало периода, в который входит дата */
function periodStart(unit: PeriodUnit, date: ISODate): ISODate {
  if (unit === 'week') return weekStart(date);
  if (unit === 'month') return toISODate(parse(date).startOf('month'));
  return date;
}

function shift(unit: PeriodUnit, date: ISODate, dir: 1 | -1): ISODate {
  return toISODate(parse(periodStart(unit, date)).add(dir, unit));
}

/**
 * Навигация по периоду — одна для журнала, графика, отчётов: ‹ · подпись периода (открывает календарь) · › · «Сегодня».
 * Подпись: «Сегодня, 25 сентября» / «пт, 26 сентября», «21–27 сентября», «Сентябрь 2026».
 */
export function PeriodNav({ unit, value, onValueChange, min, max, showToday = true, className }: PeriodNavProps) {
  const t = useT('ui');
  const fmt = useFormat();
  const now = today();
  const start = periodStart(unit, value);
  const isCurrent = start === periodStart(unit, now);

  // Узкий экран (телефон): неделя на стыке месяцев — короткими месяцами («28 сент. – 4 окт.»), чтобы подпись и стрелки
  // оставались в одну строку (schedule.md: «4 октяб…» обрезалось, стрелка «›» уезжала на новую строку)
  const shortLabel = (() => {
    if (unit !== 'week') return undefined;
    const from = parse(start);
    const to = from.add(6, 'day');
    const fromText = from.month() === to.month() ? String(from.date()) : fmt.date(toISODate(from), 'dayMonthShort');
    return `${fromText} – ${fmt.date(toISODate(to), 'dayMonthShort')}`;
  })();

  const label = (() => {
    if (unit === 'day') {
      const rel = fmt.relativeDay(value);
      const dm = fmt.date(value, 'dayMonth');
      return rel.includes(dm) ? rel : `${rel}, ${dm}`;
    }
    if (unit === 'week') {
      const from = parse(start);
      const to = from.add(6, 'day');
      const fromText = from.month() === to.month() ? String(from.date()) : fmt.date(toISODate(from), 'dayMonth');
      return `${fromText} – ${fmt.date(toISODate(to), 'dayMonth')}`;
    }
    return fmt.date(start, 'monthYear');
  })();

  const prev = shift(unit, value, -1);
  const next = shift(unit, value, 1);
  const prevDisabled = Boolean(min && toISODate(parse(periodStart(unit, value)).subtract(1, 'day')) < min);
  const nextDisabled = Boolean(max && next > max);

  return (
    <div className={cn('flex min-w-0 flex-nowrap items-center gap-1', className)}>
      <IconButton
        icon={<ChevronLeft aria-hidden />}
        className="shrink-0"
        label={t('periodNav.prev')}
        disabled={prevDisabled}
        onClick={() => onValueChange(prev)}
      />
      <Popover
        mobile="sheet"
        label={t('periodNav.pick')}
        trigger={(p) => (
          <button
            {...p}
            type="button"
            className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 text-base font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus active:bg-surface-3"
          >
            <CalendarDays aria-hidden className="size-5 shrink-0 text-muted" />
            {shortLabel ? (
              <>
                <span className="block truncate first-letter:uppercase sm:hidden">{shortLabel}</span>
                <span className="hidden truncate first-letter:uppercase sm:block">{label}</span>
              </>
            ) : (
              <span className="block truncate first-letter:uppercase">{label}</span>
            )}
            <DropdownChevron open={p['aria-expanded']} />
          </button>
        )}
      >
        {({ close }) => (
          <Calendar
            value={value}
            min={min}
            max={max}
            className="mx-auto p-1"
            onValueChange={(d) => {
              onValueChange(d);
              close();
            }}
          />
        )}
      </Popover>
      <IconButton
        icon={<ChevronRight aria-hidden />}
        className="shrink-0"
        label={t('periodNav.next')}
        disabled={nextDisabled}
        onClick={() => onValueChange(next)}
      />
      {showToday && !isCurrent && (
        <Button variant="ghost" size="sm" className="shrink-0 text-primary-text" onClick={() => onValueChange(now)}>
          {t('periodNav.today')}
        </Button>
      )}
    </div>
  );
}

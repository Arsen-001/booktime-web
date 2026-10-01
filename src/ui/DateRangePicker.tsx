'use client';

import { CalendarRange } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ISODate } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { dayjs, toISODate, type Dayjs } from '@/lib/date';
import { Calendar, type DateRange } from '@/ui/Calendar';
import { FIELD_BASE, FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { Popover, type PopoverTriggerProps } from '@/ui/Popover';
import { Sheet } from '@/ui/Sheet';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear';

export interface DateRangePickerProps {
  value?: DateRange;
  onValueChange: (range: DateRange) => void;
  /**
   * Быстрые периоды: сегодня, неделя, месяц… `'long'` — ещё 90 дней, квартал и год (отчёты: сравнить
   * сезон, закрыть год), `false` — только календарь.
   */
  presets?: boolean | 'long';
  placeholder?: ReactNode;
  min?: ISODate;
  max?: ISODate;
  invalid?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  id?: string;
  className?: string;
}

const PRESETS: DateRangePreset[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'last7',
  'last30',
];

/** Длинные периоды — к коротким в режиме presets="long" */
const LONG_PRESETS: DateRangePreset[] = [...PRESETS, 'last90', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear'];

/** Период по быстрой кнопке (неделя — с понедельника) */
export function presetRange(preset: DateRangePreset): Required<DateRange> {
  const d = dayjs();
  const r = (a: Dayjs, b: Dayjs) => ({ from: toISODate(a), to: toISODate(b) });
  switch (preset) {
    case 'today':
      return r(d, d);
    case 'yesterday':
      return r(d.subtract(1, 'day'), d.subtract(1, 'day'));
    case 'thisWeek':
      return r(d.isoWeekday(1), d.isoWeekday(7));
    case 'lastWeek':
      return r(d.subtract(1, 'week').isoWeekday(1), d.subtract(1, 'week').isoWeekday(7));
    case 'thisMonth':
      return r(d.startOf('month'), d.endOf('month'));
    case 'lastMonth':
      return r(d.subtract(1, 'month').startOf('month'), d.subtract(1, 'month').endOf('month'));
    case 'last7':
      return r(d.subtract(6, 'day'), d);
    case 'last30':
      return r(d.subtract(29, 'day'), d);
    case 'last90':
      return r(d.subtract(89, 'day'), d);
    case 'thisQuarter': {
      const start = d.month(Math.floor(d.month() / 3) * 3).startOf('month');
      return r(start, start.add(2, 'month').endOf('month'));
    }
    case 'lastQuarter': {
      const start = d.month(Math.floor(d.month() / 3) * 3).startOf('month').subtract(3, 'month');
      return r(start, start.add(2, 'month').endOf('month'));
    }
    case 'thisYear':
      return r(d.startOf('year'), d.endOf('year'));
    case 'lastYear':
      return r(d.subtract(1, 'year').startOf('year'), d.subtract(1, 'year').endOf('year'));
  }
}

/** Период словами: «3 – 9 сентября 2026», один день — «3 сентября 2026»; без начала — null (подпись поля, чип фильтра) */
export function formatDateRange(format: ReturnType<typeof useFormat>, range: DateRange | undefined): string | null {
  const from = range?.from;
  const to = range?.to;
  if (!from) return null;
  if (!to || to === from) return format.date(from, 'long');
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${format.date(from, sameYear ? 'dayMonth' : 'long')} – ${format.date(to, 'long')}`;
}

/** Поле выбора периода: быстрые периоды + календарь (первый клик — начало, второй — конец). */
export function DateRangePicker({
  value,
  onValueChange,
  presets = true,
  placeholder,
  min,
  max,
  invalid = false,
  disabled = false,
  size = 'md',
  id,
  className,
}: DateRangePickerProps) {
  const t = useT('ui');
  const format = useFormat();
  const from = value?.from;
  const to = value?.to;

  const text = formatDateRange(format, value);

  const presetList = presets === 'long' ? LONG_PRESETS : PRESETS;
  const activePreset = presetList.find((p) => {
    const r = presetRange(p);
    return r.from === from && r.to === to;
  });

  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const renderTrigger = (p: Partial<PopoverTriggerProps>) => (
    <button
      {...p}
      id={id}
      type="button"
      disabled={disabled}
      className={cn(
        FIELD_BASE,
        FIELD_BORDER[invalid ? 'invalid' : 'normal'],
        FIELD_HEIGHT[size],
        'flex items-center gap-2.5 px-3.5 text-left',
        className,
      )}
    >
      <CalendarRange className="size-5 shrink-0 text-muted" aria-hidden />
      <span className={cn('min-w-0 flex-1 truncate', !text && 'text-muted/80')}>
        {text ?? placeholder ?? t('dateRange.placeholder')}
      </span>
      <DropdownChevron open={Boolean(p['aria-expanded'])} />
    </button>
  );

  const body = (close: () => void) => (
    <div className="flex flex-col gap-3 md:flex-row">
      {presets && (
        <div
          className={cn(
            '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar md:mx-0 md:overflow-visible md:border-r md:border-border md:pr-3 md:pb-0',
            // 13 длинных периодов столбиком выше календаря — в две колонки они той же высоты
            presets === 'long' ? 'md:grid md:w-80 md:auto-rows-min md:grid-cols-2 md:gap-1' : 'md:w-40 md:flex-col',
          )}
        >
          {presetList.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={activePreset === preset}
              onClick={() => {
                onValueChange(presetRange(preset));
                close();
              }}
              className={cn(
                'min-h-10 shrink-0 rounded-full px-3.5 text-left text-sm whitespace-nowrap transition-colors md:rounded-lg md:px-3',
                activePreset === preset
                  ? 'bg-primary-soft font-medium text-primary-text'
                  : 'bg-surface-2 text-fg hover:bg-surface-3 md:bg-transparent md:hover:bg-surface-2',
              )}
            >
              {t(`dateRange.presets.${preset}`)}
            </button>
          ))}
        </div>
      )}
      <Calendar
        mode="range"
        range={value ?? {}}
        min={min}
        max={max}
        className={isMobile ? 'mx-auto max-w-[24rem]' : undefined}
        onRangeChange={(r) => {
          onValueChange(r);
          if (r.from && r.to) close();
        }}
      />
    </div>
  );

  if (isMobile) {
    return (
      <>
        {renderTrigger({ onClick: () => setSheetOpen(true), 'aria-haspopup': 'dialog', 'aria-expanded': sheetOpen })}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} side="bottom" title={t('dateRange.placeholder')}>
          {body(() => setSheetOpen(false))}
        </Sheet>
      </>
    );
  }

  return (
    <Popover align="start" label={t('dateRange.placeholder')} className="p-3" trigger={renderTrigger}>
      {({ close }) => body(close)}
    </Popover>
  );
}

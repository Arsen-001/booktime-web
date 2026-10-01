'use client';

import { CalendarDays, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ISODate } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { Calendar, type CalendarDayMeta } from '@/ui/Calendar';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { IconButton } from '@/ui/IconButton';
import { FIELD_BASE, FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Popover, type PopoverTriggerProps } from '@/ui/Popover';
import { Sheet } from '@/ui/Sheet';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { today } from '@/lib/date';

export interface DatePickerProps {
  value?: ISODate | null;
  onValueChange: (date: ISODate | null) => void;
  placeholder?: ReactNode;
  min?: ISODate;
  max?: ISODate;
  /** Крестик «очистить» */
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  dayMeta?: (date: ISODate) => CalendarDayMeta | undefined;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}

/**
 * Поле выбора даты: кнопка-поле + календарь. Десктоп — всплывающая панель у поля;
 * телефон — шторка снизу с крупным календарём и кнопкой «Сегодня».
 */
export function DatePicker({
  value,
  onValueChange,
  placeholder,
  min,
  max,
  clearable = false,
  invalid = false,
  disabled = false,
  size = 'md',
  dayMeta,
  id,
  className,
  'aria-describedby': describedBy,
}: DatePickerProps) {
  const t = useT('ui');
  const format = useFormat();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const showClear = clearable && Boolean(value) && !disabled;
  const now = today();
  const todayAllowed = !(min && now < min) && !(max && now > max) && !dayMeta?.(now)?.disabled;

  const renderTrigger = (p: Partial<PopoverTriggerProps>) => (
    <button
      {...p}
      id={id}
      type="button"
      disabled={disabled}
      aria-describedby={describedBy}
      className={cn(
        FIELD_BASE,
        FIELD_BORDER[invalid ? 'invalid' : 'normal'],
        FIELD_HEIGHT[size],
        'flex items-center gap-2.5 px-3.5 text-left',
      )}
    >
      <CalendarDays className="size-5 shrink-0 text-muted" aria-hidden />
      <span className={cn('min-w-0 flex-1 truncate', !value && 'text-muted/80', showClear && 'mr-8')}>
        {value ? format.date(value, 'long') : (placeholder ?? t('datePicker.placeholder'))}
      </span>
      {/* Шеврон всегда (DESIGN.md → Dropdowns, «везде где dropdown»); крестик «очистить» стоит левее него */}
      <DropdownChevron open={Boolean(p['aria-expanded'])} />
    </button>
  );

  const pick = (d: ISODate) => {
    onValueChange(d);
    setSheetOpen(false);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {isMobile ? (
        <>
          {renderTrigger({
            onClick: () => setSheetOpen(true),
            'aria-haspopup': 'dialog',
            'aria-expanded': sheetOpen,
          })}
          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            side="bottom"
            title={t('datePicker.placeholder')}
            footer={
              todayAllowed || showClear ? (
                <>
                  {showClear && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onValueChange(null);
                        setSheetOpen(false);
                      }}
                    >
                      {t('clear')}
                    </Button>
                  )}
                  {todayAllowed && (
                    <Button variant="secondary" onClick={() => pick(now)}>
                      {t('calendar.today')}
                    </Button>
                  )}
                </>
              ) : undefined
            }
          >
            <Calendar
              value={value ?? null}
              min={min}
              max={max}
              dayMeta={dayMeta}
              className="mx-auto max-w-[24rem]"
              onValueChange={pick}
            />
          </Sheet>
        </>
      ) : (
        <Popover align="start" label={t('datePicker.placeholder')} className="p-3" trigger={renderTrigger}>
          {({ close }) => (
            <Calendar
              value={value ?? null}
              min={min}
              max={max}
              dayMeta={dayMeta}
              onValueChange={(d) => {
                onValueChange(d);
                close();
              }}
            />
          )}
        </Popover>
      )}
      {showClear && (
        <span className="absolute inset-y-0 right-9 flex items-center">
          <IconButton size="sm" icon={<X aria-hidden />} label={t('clear')} onClick={() => onValueChange(null)} />
        </span>
      )}
    </div>
  );
}

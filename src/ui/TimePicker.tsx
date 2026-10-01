'use client';

import { Clock } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { TimeHM } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { fromMinutes, toMinutes } from '@/lib/date';
import { FIELD_BASE, FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { Popover, type PopoverTriggerProps } from '@/ui/Popover';
import { Sheet } from '@/ui/Sheet';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';

export interface TimePickerProps {
  value?: TimeHM | null;
  onValueChange: (time: TimeHM) => void;
  /** Шаг, мин */
  step?: 5 | 10 | 15 | 30;
  /** Первое время списка, 'HH:mm' */
  min?: TimeHM;
  /** Последнее время списка */
  max?: TimeHM;
  placeholder?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  id?: string;
  className?: string;
}

function TimeList({
  times,
  value,
  onPick,
  large = false,
}: {
  times: TimeHM[];
  value: TimeHM | null | undefined;
  onPick: (t: TimeHM) => void;
  /** Крупная сетка для шторки на телефоне */
  large?: boolean;
}) {
  const t = useT('ui');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Кадр спустя: панель уже видима (скрытое не фокусируется)
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const target =
        list?.querySelector<HTMLElement>('[aria-selected="true"]') ??
        list?.querySelector<HTMLElement>('[role="option"]');
      target?.scrollIntoView({ block: 'center' });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    nodes[Math.max(0, Math.min(nodes.length - 1, index + delta))]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={t('timePicker.placeholder')}
      onKeyDown={onKeyDown}
      className={cn(
        'grid gap-1 overflow-y-auto scrollbar-thin',
        large ? 'max-h-[55dvh] grid-cols-4 gap-2' : 'max-h-72 grid-cols-3 sm:grid-cols-4',
      )}
    >
      {times.map((time) => (
        <button
          key={time}
          type="button"
          role="option"
          aria-selected={time === value}
          tabIndex={time === (value ?? times[0]) ? 0 : -1}
          onClick={() => onPick(time)}
          className={cn(
            'rounded-lg px-2 text-[0.9375rem] tabular-nums transition-colors active:scale-95',
            large ? 'min-h-12 border border-border text-base' : 'min-h-10',
            time === value
              ? 'border-primary bg-primary font-semibold text-primary-contrast'
              : 'text-fg hover:bg-surface-2',
          )}
        >
          {time}
        </button>
      ))}
    </div>
  );
}

/** Поле выбора времени (24 ч) со списком по шагу. Телефон — шторка снизу с крупной сеткой. */
export function TimePicker({
  value,
  onValueChange,
  step = 15,
  min = '00:00',
  max = '23:59',
  placeholder,
  invalid = false,
  disabled = false,
  size = 'md',
  id,
  className,
}: TimePickerProps) {
  const t = useT('ui');
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const times: TimeHM[] = [];
  for (let m = toMinutes(min); m <= toMinutes(max); m += step) times.push(fromMinutes(m));

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
      <Clock className="size-5 shrink-0 text-muted" aria-hidden />
      <span className={cn('flex-1 tabular-nums', !value && 'text-muted/80')}>
        {value ?? placeholder ?? t('timePicker.placeholder')}
      </span>
      <DropdownChevron open={Boolean(p['aria-expanded'])} />
    </button>
  );

  if (isMobile) {
    return (
      <>
        {renderTrigger({ onClick: () => setSheetOpen(true), 'aria-haspopup': 'dialog', 'aria-expanded': sheetOpen })}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} side="bottom" title={t('timePicker.placeholder')}>
          <TimeList
            large
            times={times}
            value={value}
            onPick={(time) => {
              onValueChange(time);
              setSheetOpen(false);
            }}
          />
        </Sheet>
      </>
    );
  }

  return (
    <Popover align="start" matchWidth role="listbox" className="w-72 p-2" trigger={renderTrigger}>
      {({ close }) => (
        <TimeList
          times={times}
          value={value}
          onPick={(time) => {
            onValueChange(time);
            close();
          }}
        />
      )}
    </Popover>
  );
}

'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useControllableState } from '@/ui/hooks/useControllableState';
import { scrollEdgeClass, useScrollEdges } from '@/ui/hooks/useScrollEdges';
import { useSlidingIndicator } from '@/ui/hooks/useSlidingIndicator';

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export type SegmentedSize = 'sm' | 'md';

const SIZE: Record<SegmentedSize, string> = {
  // Телефон — 44 px под палец, десктоп — 40 px
  sm: 'min-h-11 px-3 text-sm md:min-h-10 [&_svg]:size-4',
  md: 'min-h-11 px-4 text-base [&_svg]:size-5',
};

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: SegmentedSize;
  fullWidth?: boolean;
  /** Ошибка выбора (FormField проставляет сам) — красная рамка */
  invalid?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

/**
 * Переключатель из нескольких сегментов (День / Неделя / Месяц). Для 2–4 коротких вариантов.
 * Больше вариантов или длинные подписи — RadioGroup / ChoiceGroup / Select. Если не влез по ширине, ряд листается
 * (край затухает), а не вылезает за экран. Белая «пилюля» выбранного сегмента переезжает к новому (WAAPI, без
 * перерисовок React).
 */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  size = 'md',
  fullWidth = false,
  invalid = false,
  className,
  ...aria
}: SegmentedControlProps) {
  const [current, setCurrent] = useControllableState(value, defaultValue ?? options[0]?.value ?? '', onValueChange);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(rootRef);
  const pillRef = useRef<HTMLSpanElement>(null);
  const currentIndex = options.findIndex((o) => o.value === current);
  useSlidingIndicator(rootRef, pillRef, refs, currentIndex, options.map((o) => o.value).join('|'));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const start = options.findIndex((o) => o.value === current);
    for (let step = 1; step <= options.length; step++) {
      const i = (start + dir * step + options.length) % options.length;
      if (!options[i].disabled) {
        setCurrent(options[i].value);
        refs.current[i]?.focus();
        refs.current[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        break;
      }
    }
  };

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      onKeyDown={onKeyDown}
      className={cn(
        'group/seg no-scrollbar relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-surface-2 p-1',
        scrollEdgeClass(edges),
        // w-fit: в колонке (flex-col) не растягиваться на всю ширину с пустым хвостом
        fullWidth ? 'flex w-full' : 'w-fit',
        invalid && 'ring-2 ring-danger',
        className,
      )}
      {...aria}
    >
      {options.map((o, i) => {
        const selected = o.value === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={o.disabled}
            onClick={() => setCurrent(o.value)}
            className={cn(
              'relative z-[1] inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:opacity-50',
              SIZE[size],
              fullWidth && 'flex-1',
              // Подложку выбранного рисует скользящая «пилюля»; своя — только до гидратации (data-slide ещё нет)
              selected
                ? 'bg-surface text-fg shadow-xs dark:bg-surface-3 group-data-[slide]/seg:bg-transparent group-data-[slide]/seg:shadow-none dark:group-data-[slide]/seg:bg-transparent'
                : 'text-muted hover:text-fg',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-0 origin-left rounded-sm bg-surface opacity-0 shadow-xs dark:bg-surface-3"
      />
    </div>
  );
}

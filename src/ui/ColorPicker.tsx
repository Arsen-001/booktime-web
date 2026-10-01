'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { SWATCH_BG } from '@/ui/ColorSwatch';
import { Check } from 'lucide-react';

export interface ColorPickerProps {
  /** 1..8 — индекс цвета-токена chart-N */
  value?: number;
  onValueChange: (colorIndex: number) => void;
  label?: string;
  className?: string;
}

const INDEXES = [1, 2, 3, 4, 5, 6, 7, 8];

/** Выбор цвета из 8 токенов (цвет мастера в журнале, категории записи). Стрелки меняют выбор. */
export function ColorPicker({ value, onValueChange, label, className }: ColorPickerProps) {
  const t = useT('ui');
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const current = value ?? 1;
    const next = ((current - 1 + delta + INDEXES.length) % INDEXES.length) + 1;
    onValueChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label ?? t('color.pick')}
      onKeyDown={onKeyDown}
      className={cn('flex flex-wrap gap-1', className)}
    >
      {INDEXES.map((i) => {
        const checked = value === i;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            data-index={i}
            aria-checked={checked}
            aria-label={t('color.option', { n: i })}
            tabIndex={checked || (value === undefined && i === 1) ? 0 : -1}
            onClick={() => onValueChange(i)}
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
          >
            <span
              aria-hidden
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full',
                SWATCH_BG[i],
                checked && 'ring-2 ring-primary ring-offset-2 ring-offset-surface',
              )}
            >
              {checked && <Check strokeWidth={3} className="size-4 text-surface" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

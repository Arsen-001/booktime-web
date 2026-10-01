'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTip } from '@/ui/hooks/useTip';

export type ColorSwatchSize = 'sm' | 'md' | 'lg';

export interface ColorSwatchProps {
  /** 1..8 → токены chart-1…chart-8 (цвет мастера, категории) */
  colorIndex?: number;
  /** Цвет ИЗ ДАННЫХ (оттенок лака, краски) — единственный случай, когда сырой цвет допустим */
  color?: string;
  selected?: boolean;
  size?: ColorSwatchSize;
  /** Подпись для скринридера и подсказка */
  label?: string;
  onClick?: () => void;
  className?: string;
}

/** Классы фона для 8 цветов-токенов (списком, чтобы Tailwind их увидел) */
export const SWATCH_BG: Record<number, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
  6: 'bg-chart-6',
  7: 'bg-chart-7',
  8: 'bg-chart-8',
};

const CIRCLE: Record<ColorSwatchSize, string> = {
  sm: 'size-5',
  md: 'size-7',
  lg: 'size-9',
};

/** Кружок цвета. С onClick — кнопка с зоной нажатия ≥40px. */
export function ColorSwatch({
  colorIndex,
  color,
  selected = false,
  size = 'md',
  label,
  onClick,
  className,
}: ColorSwatchProps) {
  const { handlers, tip } = useTip(label);
  const circle = (
    <span
      aria-hidden={onClick ? true : undefined}
      role={onClick ? undefined : 'img'}
      aria-label={onClick ? undefined : label}
      {...(onClick ? {} : handlers)}
      style={color ? { backgroundColor: color } : undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border border-border',
        CIRCLE[size],
        !color && SWATCH_BG[colorIndex ?? 1],
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-surface',
        !onClick && className,
      )}
    >
      {selected && (
        <Check aria-hidden strokeWidth={3} className="size-3.5 text-primary-contrast mix-blend-difference" />
      )}
    </span>
  );
  if (!onClick)
    return (
      <>
        {circle}
        {tip}
      </>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      {...handlers}
      className={cn('inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2', className)}
    >
      {circle}
      {tip}
    </button>
  );
}

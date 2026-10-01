'use client';

import Link from 'next/link';
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { mergeTipHandlers, useTip } from '@/ui/hooks/useTip';

export type SlotButtonSize = 'sm' | 'md';

const SIZE: Record<SlotButtonSize, string> = {
  // Телефон — 44 px под палец, десктоп — 40 px
  sm: 'min-h-11 min-w-16 px-3 text-sm md:min-h-10',
  md: 'min-h-12 min-w-20 px-4 text-base md:min-h-11',
};

export interface SlotButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Время окна: «11:30» */
  children: ReactNode;
  /** Выбранное окно */
  selected?: boolean;
  /** Окно недоступно; причина — в `disabledReason` (подсказка и скринридер) */
  disabled?: boolean;
  disabledReason?: string;
  /** Ссылка вместо кнопки (каталог: окно ведёт сразу в запись) */
  href?: string;
  size?: SlotButtonSize;
}

function slotClasses(size: SlotButtonSize, selected: boolean, disabled: boolean): string {
  return cn(
    'relative inline-flex shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums whitespace-nowrap select-none',
    'transition-[color,background-color,box-shadow,transform] duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    SIZE[size],
    disabled
      ? 'cursor-not-allowed bg-surface-2 text-muted opacity-70'
      : selected
        ? 'bg-primary text-primary-contrast shadow-sm ring-2 ring-primary/25 ring-offset-1 ring-offset-surface'
        : 'bg-primary-soft text-primary-text hover:bg-primary hover:text-primary-contrast hover:shadow-sm active:scale-[0.97]',
  );
}

/**
 * Свободное окно времени — одинаковое во всех разделах (каталог, карточка мастера, запись, публичная страница,
 * свободные окна в кабинете). Недоступное окно не выключено насовсем: фокусируется и объясняет причину подсказкой.
 */
export function SlotButton({
  children,
  selected = false,
  disabled = false,
  disabledReason,
  href,
  size = 'sm',
  className,
  onClick,
  type = 'button',
  ...rest
}: SlotButtonProps) {
  const cls = cn(slotClasses(size, selected, disabled), className);
  // Причина недоступности — нашей подсказкой при наведении (на телефоне её читают из sr-only и видят по виду кнопки)
  const { handlers, tip } = useTip(disabled ? disabledReason : undefined, { side: 'top' });

  if (href && !disabled) {
    return (
      <Link href={href} data-slot-button="" className={cls} aria-current={selected ? 'true' : undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      data-slot-button=""
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cls}
      {...rest}
      {...mergeTipHandlers(handlers, rest)}
    >
      {children}
      {disabled && disabledReason && <span className="sr-only">, {disabledReason}</span>}
      {tip}
    </button>
  );
}

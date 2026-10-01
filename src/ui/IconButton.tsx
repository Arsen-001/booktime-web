'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { mergeTipHandlers, useTip } from '@/ui/hooks/useTip';

export type IconButtonVariant = 'ghost' | 'secondary' | 'outline' | 'primary';
export type IconButtonSize = 'sm' | 'md' | 'lg';

// Радиус 10 (rounded-md) как у Button; md — 44 на телефоне, 40 на компьютере (макет)
const SIZE: Record<IconButtonSize, string> = {
  sm: 'size-10 md:size-9 rounded-md [&_svg]:size-4',
  md: 'size-11 md:size-10 rounded-md [&_svg]:size-5',
  lg: 'size-12 md:size-11 rounded-md [&_svg]:size-5',
};

const VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent text-fg hover:bg-surface-2 active:bg-surface-3',
  secondary: 'border border-border bg-surface text-fg hover:border-border-strong/45 hover:bg-surface-2',
  // Рамка мягче, чем у полей: кнопку узнают по подписи, а резкая рамка у каждой второй кнопки шумит
  outline: 'border border-border-strong/55 bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2',
  primary: 'bg-primary text-primary-contrast shadow-xs hover:bg-primary-hover',
};

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: ReactNode;
  /** Обязательная подпись: aria-label и всплывающая подсказка (наша, не системный title) */
  label: string;
  /** Не показывать всплывающую подсказку (подпись уже видна рядом) */
  hideTip?: boolean;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  hideTip = false,
  ...rest
}: IconButtonProps) {
  const { handlers, tip } = useTip(label, {
    disabled: hideTip || rest.disabled,
  });
  return (
    <>
      <button
        type={type}
        data-icon-button=""
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50',
          SIZE[size],
          VARIANT[variant],
          className,
        )}
        {...rest}
        {...mergeTipHandlers(handlers, rest)}
      >
        {icon}
      </button>
      {tip}
    </>
  );
}

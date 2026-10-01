import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeVariant = 'soft' | 'solid' | 'outline';
export type BadgeSize = 'sm' | 'md';

const TONES: Record<BadgeVariant, Record<BadgeTone, string>> = {
  soft: {
    neutral: 'bg-surface-3 text-fg',
    primary: 'bg-primary-soft text-primary-text',
    accent: 'bg-accent-soft text-accent-text',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
  },
  solid: {
    neutral: 'bg-fg text-bg',
    primary: 'bg-primary text-primary-contrast',
    accent: 'bg-accent text-accent-contrast',
    success: 'bg-success text-primary-contrast',
    warning: 'bg-warning text-primary-contrast',
    danger: 'bg-danger text-primary-contrast',
    info: 'bg-info text-primary-contrast',
  },
  outline: {
    neutral: 'border border-border-strong text-fg',
    primary: 'border border-primary text-primary-text',
    accent: 'border border-accent text-accent-text',
    success: 'border border-success text-success',
    warning: 'border border-warning text-warning',
    danger: 'border border-danger text-danger',
    info: 'border border-info text-info',
  },
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-6 px-2 text-xs gap-1 [&_svg]:size-3.5',
  md: 'h-7 px-2.5 text-sm gap-1.5 [&_svg]:size-4',
};

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  /** Точка-индикатор слева */
  dot?: boolean;
}

/** Метка статуса или количества */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap',
        SIZE[size],
        TONES[variant][tone],
        className,
      )}
      {...rest}
    >
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}

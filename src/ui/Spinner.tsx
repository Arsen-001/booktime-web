'use client';

import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Подпись для экранного диктора; по умолчанию «Загрузка…» */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const t = useT('ui');
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center text-primary-text', className)}>
      <LoaderCircle aria-hidden className={cn('animate-spin', SIZE[size])} />
      <span className="sr-only">{label ?? t('loading')}</span>
    </span>
  );
}

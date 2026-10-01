'use client';

import type { ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';

export interface ErrorStateProps {
  /** По умолчанию «Не удалось загрузить» */
  title?: ReactNode;
  /** По умолчанию «Проверьте соединение и попробуйте ещё раз.» */
  description?: ReactNode;
  /** Показать кнопку «Повторить» */
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

/** Ошибка загрузки экрана или блока с кнопкой «Повторить» */
export function ErrorState({ title, description, onRetry, compact = false, className }: ErrorStateProps) {
  const t = useT('ui');
  return (
    <div
      role="alert"
      className={cn(
        'flex animate-rise flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12 sm:py-16',
        className,
      )}
    >
      <span
        className={cn(
          'mb-1 inline-flex items-center justify-center rounded-full bg-danger-soft text-danger ring-danger-soft/50',
          compact ? 'size-12 ring-[6px] [&_svg]:size-5' : 'size-16 ring-8 [&_svg]:size-7',
        )}
      >
        <TriangleAlert aria-hidden />
      </span>
      <p className={cn('font-semibold tracking-tight text-fg', compact ? 'text-base' : 'text-lg sm:text-xl')}>
        {title ?? t('errorState.title')}
      </p>
      <p className={cn('max-w-md leading-relaxed text-muted', compact ? 'text-sm' : 'text-base')}>
        {description ?? t('errorState.text')}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          leftIcon={<RefreshCw aria-hidden />}
          onClick={onRetry}
          className={compact ? 'mt-1' : 'mt-3'}
        >
          {t('errorState.retry')}
        </Button>
      )}
    </div>
  );
}

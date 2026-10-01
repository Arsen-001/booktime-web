'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { SkeletonText } from '@/ui/Skeleton';

export interface ChipProps {
  children: ReactNode;
  /** Выбран (для фильтров-переключателей) */
  selected?: boolean;
  onClick?: () => void;
  /** Показать крестик «убрать» */
  onRemove?: () => void;
  icon?: ReactNode;
  /** Число справа (найдено по фильтру) */
  count?: number;
  /** Число ещё считается: плашка числа уже на месте (с полосой-скелетоном), чип не подрастает, когда оно приходит */
  countLoading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Подпись для крестика; по умолчанию «Убрать» */
  removeLabel?: string;
}

/** Чип: фильтр-переключатель или метка с крестиком. Высота 44 px на телефоне (под палец), 40 px на десктопе */
export function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  icon,
  count,
  countLoading = false,
  disabled = false,
  className,
  removeLabel,
}: ChipProps) {
  const t = useT('ui');
  const tone = selected
    ? 'border-primary bg-primary-soft text-primary-text shadow-xs'
    : 'border-border-strong/40 bg-surface text-fg hover:border-border-strong/70';

  const content = (
    <>
      {icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
      <span className="truncate">{children}</span>
      {(count !== undefined || countLoading) && (
        <span
          className={cn(
            // Ширина — под две цифры всегда: «0» и «24» одной ширины, соседние чипы не сдвигаются, когда число приходит
            'inline-flex min-w-[1.625rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums',
            selected ? 'bg-primary text-primary-contrast' : 'bg-surface-3 text-fg',
          )}
        >
          {countLoading && count === undefined ? <SkeletonText width="2ch" /> : count}
        </span>
      )}
    </>
  );

  const main = onClick ? (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 transition-transform md:min-h-10 active:scale-[0.97] disabled:cursor-not-allowed',
        !onRemove && 'hover:bg-surface-2',
        selected && !onRemove && 'hover:bg-primary-soft',
      )}
    >
      {content}
    </button>
  ) : (
    <span className="inline-flex min-h-11 items-center gap-1.5 px-3.5 md:min-h-10">{content}</span>
  );

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border text-sm font-medium transition-colors duration-150',
        tone,
        disabled && 'opacity-50',
        className,
      )}
    >
      {main}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? t('remove')}
          disabled={disabled}
          onClick={onRemove}
          className="-ml-2.5 inline-flex h-11 min-w-11 md:h-10 md:min-w-10 items-center justify-center rounded-full hover:bg-surface-3 disabled:cursor-not-allowed"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </span>
  );
}

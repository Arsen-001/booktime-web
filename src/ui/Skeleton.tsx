import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

const VARIANT: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded-md',
  rect: 'h-24 w-full rounded-lg',
  circle: 'size-10 rounded-full',
};

/** Ширины строк текста: разная длина читается как «текст», а не как полосы */
const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-5/6'];

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Для text: несколько строк, последняя короче */
  lines?: number;
  className?: string;
}

const BLOCK_INLINE = 'skeleton-shimmer animate-shimmer';
const BLOCK = `block ${BLOCK_INLINE}`;

/**
 * Заглушка на время загрузки. Корень помечен data-skeleton — скрипт замеров ждёт,
 * пока на странице не останется ни одного [data-skeleton].
 */
export function Skeleton({ variant = 'text', lines = 1, className }: SkeletonProps) {
  if (variant === 'text' && lines > 1) {
    // Каждая строка — высотой в строку текста родителя (1lh), полоса внутри: абзац из N строк = N строк текста
    return (
      <span data-skeleton aria-hidden className={cn('flex w-full flex-col', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="flex h-[1lh] items-center">
            <span
              className={cn(
                BLOCK,
                'h-[0.75em] rounded-[0.25em]',
                i === lines - 1 ? 'w-3/5' : LINE_WIDTHS[i % LINE_WIDTHS.length],
              )}
            />
          </span>
        ))}
      </span>
    );
  }
  return <span data-skeleton aria-hidden className={cn(BLOCK, VARIANT[variant], className)} />;
}

export interface SkeletonTextProps {
  /** Ширина полосы: '12ch' (≈ столько знаков), '60%', 'full'. По умолчанию 8ch */
  width?: string;
  className?: string;
}

/**
 * Полоса на месте текста — ставится ВНУТРЬ того же элемента, где потом будет текст, с теми же классами:
 *   <p className="text-sm text-muted">{loading ? <SkeletonText width="14ch" /> : client.phone}</p>
 * Высота строки берётся у шрифта элемента (line-height), поэтому скелетон и текст одной высоты — ничего не прыгает.
 * Ширина в ch — «примерно столько знаков» в этом шрифте: берите типичную длину значения.
 */
export function SkeletonText({ width = '8ch', className }: SkeletonTextProps) {
  // Коробка ровно в одну строку (1lh — высота строки шрифта родителя) и в строке текста, и во flex-контейнере
  // (плашка счётчика, ячейка): внутри — полоса по центру. Так скелетон не меньше и не больше строки текста.
  return (
    <span
      data-skeleton
      aria-hidden
      className={cn('inline-flex h-[1lh] max-w-full items-center align-top', className)}
      style={{ width: width === 'full' ? '100%' : width }}
    >
      <span className={cn('h-[0.75em] w-full rounded-[0.25em]', BLOCK_INLINE)} />
    </span>
  );
}

/**
 * Известный заранее текст под серой плашкой на время загрузки: плашка ровно того размера и числа строк, что текст
 * (заголовок пустого состояния, постоянная подпись). Для значений из данных — SkeletonText.
 *   <EmptyState title={loading ? <SkeletonOver>{t('emptyTitle')}</SkeletonOver> : t('emptyTitle')} />
 */
export function SkeletonOver({ children }: { children: ReactNode }) {
  return (
    <span data-skeleton aria-hidden className="relative block">
      <span className="invisible">{children}</span>
      <span className={cn('absolute inset-0 rounded-[0.25em]', BLOCK_INLINE)} />
    </span>
  );
}

export interface SkeletonListProps {
  /** Сколько строк-заглушек */
  rows?: number;
  /** Кружок-аватар слева */
  avatar?: boolean;
  /** Строки внутри карточек (как список на телефоне), иначе — с разделителями */
  cards?: boolean;
  className?: string;
}

/**
 * Заглушка списка в форме содержимого: аватар, имя, подпись, значение справа.
 * Для списков клиентов, мастеров, записей — вместо спиннера и голых полос.
 */
export function SkeletonList({ rows = 4, avatar = true, cards = false, className }: SkeletonListProps) {
  return (
    <span
      data-skeleton
      aria-hidden
      className={cn('flex w-full flex-col', cards ? 'gap-2' : 'divide-y divide-border', className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className={cn('flex items-center gap-3', cards ? 'rounded-xl border border-border bg-surface p-4' : 'py-3.5')}
        >
          {avatar && <span className={cn(BLOCK, 'size-10 shrink-0 rounded-full')} />}
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className={cn(BLOCK, 'h-4 rounded-md', i % 2 ? 'w-2/5' : 'w-1/2')} />
            <span className={cn(BLOCK, 'h-3 rounded-md', i % 3 ? 'w-3/5' : 'w-1/3')} />
          </span>
          <span className={cn(BLOCK, 'h-4 w-14 shrink-0 rounded-md')} />
        </span>
      ))}
    </span>
  );
}

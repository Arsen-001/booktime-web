'use client';

import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { SkeletonText } from '@/ui/Skeleton';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Изменение к прошлому периоду, % (12.5 → «+12,5%», зелёным; −3 → красным) */
  delta?: number;
  hint?: ReactNode;
  /** Подпись не из данных (кнопка «Купить», постоянный текст) — при загрузке остаётся как есть, а не полосой */
  keepHint?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

function formatDelta(delta: number): string {
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${String(rounded).replace('.', ',')}%`;
}

type DeltaTone = 'up' | 'down' | 'flat';

const DELTA_BG: Record<DeltaTone, string> = {
  up: 'bg-success-soft text-success',
  down: 'bg-danger-soft text-danger',
  flat: 'bg-surface-2 text-muted',
};

/** Показатель: подпись, крупное значение, изменение к прошлому периоду */
export function StatCard({ label, value, delta, hint, keepHint = false, icon, loading = false, className }: StatCardProps) {
  const t = useT('ui');
  const tone: DeltaTone = delta === undefined || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 sm:p-5',
        // Карточка внутри ссылки (переход к списку) — видно, что она нажимается
        'transition-[box-shadow,border-color,transform] duration-200 ease-out in-[a]:hover:border-border-strong/60 in-[a]:hover:shadow-md motion-safe:in-[a]:hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 pt-0.5 text-sm leading-snug font-medium text-muted">{label}</p>
        {icon && (
          <span className="-mt-0.5 -mr-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
      </div>
      {/* Скелетон — в тех же элементах, что значение и подпись: высота строк та же, плитка не подрастает */}
      <p className="num-headline pt-1 text-fg">{loading ? <SkeletonText width="5ch" /> : value}</p>
      {loading && (delta !== undefined || (hint && !keepHint)) && (
        <div className="mt-auto flex items-center pt-0.5 text-[13px] leading-snug">
          <span className="inline-flex items-center rounded-full py-px">
            <SkeletonText width="14ch" />
          </span>
        </div>
      )}
      {(!loading || (keepHint && hint && delta === undefined)) && (delta !== undefined || hint) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[13px] leading-snug">
          {delta !== undefined && (
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {/* Изменение — пилюлей: знак и иконка, а не только цвет */}
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-semibold tabular-nums',
                  DELTA_BG[tone],
                )}
              >
                <DeltaIcon aria-hidden className="size-3.5" />
                {formatDelta(delta)}
              </span>
              <span className="whitespace-nowrap text-muted">{t('stat.vsPrev')}</span>
            </span>
          )}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Плитка главной владельца: подпись с «i», крупное число, строка-пояснение и ОДНО действие внизу (CONVENTIONS §0:
 * у каждой цифры — что с ней сделать). Тот же язык, что MetricTile «Основных показателей» (num-headline, радиус,
 * подсказка «i»), но с кнопкой действия и необязательной полосой прогресса (план месяца).
 * Скелетон — та же разметка: число и пояснение — SkeletonText в своих строках, кнопка на месте (disabled).
 */
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { SkeletonText } from '@/ui/Skeleton';
import { Tooltip } from '@/ui/Tooltip';

export interface HomeTileProps {
  label: ReactNode;
  hint: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Полоса под числом (план месяца): 0…100 и отметка «темп к сегодня» */
  progress?: { pct: number; pacePct?: number; label: string };
  /** Тон числа: «не пришли» > 0 — предупреждение, «пора позвать» — акцент */
  tone?: 'default' | 'warning' | 'primary';
  action: ReactNode;
  /** Вторая, тихая ссылка рядом с действием («Отчёт») */
  secondary?: ReactNode;
  loading?: boolean;
  className?: string;
  'data-f'?: string;
}

const VALUE_TONE: Record<NonNullable<HomeTileProps['tone']>, string> = {
  default: 'text-fg',
  warning: 'text-warning',
  primary: 'text-primary-text',
};

export function HomeTile({ label, hint, value, sub, progress, tone = 'default', action, secondary, loading, className, ...rest }: HomeTileProps) {
  const t = useT('reports');
  const pct = progress ? Math.min(100, Math.max(0, progress.pct)) : 0;
  const pace = progress?.pacePct !== undefined ? Math.min(100, Math.max(0, progress.pacePct)) : undefined;

  return (
    <section data-f={rest['data-f']} className={cn('flex h-full min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 pt-0.5 text-sm leading-snug font-medium text-muted xl:min-h-[2lh]">{label}</h2>
        <Tooltip content={hint}>
          <button
            type="button"
            className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
            aria-label={t('dashboard.tileHint')}
          >
            <Info className="size-4" aria-hidden />
          </button>
        </Tooltip>
      </div>
      <p className={cn('num-headline pt-1', VALUE_TONE[tone])}>{loading ? <SkeletonText width="6ch" /> : value}</p>
      {sub !== undefined && <p className="min-h-[2lh] text-[13px] leading-snug text-muted tabular-nums">{loading ? <SkeletonText width="16ch" /> : sub}</p>}
      {progress && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={loading ? undefined : pct}
          aria-label={progress.label}
          className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-3"
        >
          {/* Анимируется только transform (DESIGN.md «Performance») */}
          <div
            className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${loading ? 0 : pct / 100})` }}
          />
          {pace !== undefined && !loading && <span aria-hidden className="absolute inset-y-0 w-0.5 bg-fg/50" style={{ left: `calc(${pace}% - 1px)` }} />}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
        {action}
        {secondary}
      </div>
    </section>
  );
}

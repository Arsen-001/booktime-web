'use client';

/**
 * Плитка «Основных показателей» (F-12-010…018): значение, «i» с формулой, динамика к прошлому периоду
 * (или «Новое» — F-12-017 готово-когда: не пустое место при делении на ноль), опциональная ссылка «Посмотреть».
 *
 * Визуально — тот же язык, что у @/ui/StatCard (num-headline, та же пилюля дельты, тот же радиус карточки —
 * DESIGN.md «headline карточки — крупное число»): здесь свой компонент, а не сам StatCard, только из-за
 * трёх вещей, которых у общего кита нет — подсказка «i» с формулой, «N% от всех записей» и ссылка «Посмотреть».
 */
import { Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { SkeletonText } from '@/ui/Skeleton';
import { Tooltip } from '@/ui/Tooltip';

export interface MetricTileProps {
  label: string;
  value: ReactNode;
  hint: string;
  deltaPct?: number;
  isNew?: boolean;
  /** «N% от всех записей» вместо динамики (F-12-016) */
  sharePct?: number;
  /** Отч6: значение прошлого периода, уже отформатированное («12 000 ֏») — «было …» рядом с процентом */
  previous?: string;
  /** Вторая строка под числом (Отч8: «179 операций» — отдельно от денег, а не в той же строке) */
  sub?: ReactNode;
  href?: string;
  hrefLabel?: string;
  loading?: boolean;
  /** У плитки не бывает строки динамики/доли («Потерянные», средние) — скелетон не рисует её место */
  noTrend?: boolean;
  className?: string;
}

type DeltaTone = 'up' | 'down' | 'flat';

const DELTA_BG: Record<DeltaTone, string> = {
  up: 'bg-success-soft text-success',
  down: 'bg-danger-soft text-danger',
  flat: 'bg-surface-2 text-muted',
};

export function MetricTile({ label, value, hint, deltaPct, isNew, sharePct, previous, sub, href, hrefLabel, loading, noTrend, className }: MetricTileProps) {
  const t = useT('reports');
  const tUi = useT('ui');
  const tone: DeltaTone = deltaPct === undefined || deltaPct === 0 ? 'flat' : deltaPct > 0 ? 'up' : 'down';
  const DeltaIcon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus;

  return (
    <div
      data-f="F-12-017"
      className={cn('flex h-full flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 sm:p-5', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 pt-0.5 text-sm leading-snug font-medium text-muted">{label}</p>
        <Tooltip content={hint}>
          <button
            type="button"
            tabIndex={0}
            className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
            aria-label={t('dashboard.tileHint')}
          >
            <Info className="size-4" aria-hidden />
          </button>
        </Tooltip>
      </div>
      {/* Число — «заголовок» карточки (DESIGN.md), тот же num-headline, что у StatCard; при загрузке — полоса в той же строке */}
      <p className="num-headline pt-1 text-fg">{loading ? <SkeletonText width="7ch" /> : value}</p>
      {sub !== undefined && <p className="text-[13px] leading-snug text-muted tabular-nums">{loading ? <SkeletonText width="11ch" /> : sub}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1 text-[13px] leading-snug">
        {!loading && sharePct !== undefined ? (
          <span className="text-muted">{t('dashboard.shareOfAll', { pct: sharePct })}</span>
        ) : !loading && isNew ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <span className="inline-flex w-fit items-center rounded-full bg-primary-soft px-1.5 py-px font-semibold text-primary-text">
              {t('dashboard.newMetric')}
            </span>
            {previous !== undefined && <span className="whitespace-nowrap text-muted tabular-nums">{t('dashboard.wasValue', { value: previous })}</span>}
          </span>
        ) : !loading && deltaPct !== undefined ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-semibold tabular-nums', DELTA_BG[tone])}>
              <DeltaIcon aria-hidden className="size-3.5" />
              {deltaPct > 0 ? '+' : ''}
              {deltaPct}%
            </span>
            <span className="whitespace-nowrap text-muted tabular-nums">{previous !== undefined ? t('dashboard.wasValue', { value: previous }) : tUi('stat.vsPrev')}</span>
          </span>
        ) : loading && !noTrend ? (
          // Место пилюли динамики: та же высота строки, что у «+12% было …»
          <span className="inline-flex items-center gap-x-1.5">
            <span className="inline-flex items-center rounded-full py-px">
              <SkeletonText width="5ch" />
            </span>
            <SkeletonText width="8ch" />
          </span>
        ) : (
          <span />
        )}
        {href && (
          <Link href={href} className="-my-3 flex min-h-11 items-center font-medium text-primary-text hover:underline">
            {hrefLabel ?? t('dashboard.viewClients')}
          </Link>
        )}
      </div>
    </div>
  );
}

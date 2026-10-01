'use client';

/** Прогресс плана запуска по волнам: «Волна 1 · готово 6 из 10» с полосой; вся карточка ведёт в план. */
import { ChevronRight } from 'lucide-react';
import type { OverviewSummary } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { SkeletonText } from '@/ui/Skeleton';

/** Волн в плане всегда три — скелетон рисует те же три строки */
const WAVES_COUNT = 3;

export function WavesCard({ waves, loading }: { waves: OverviewSummary['waves']; loading: boolean }) {
  const t = useT('platform');
  return (
    <Card interactive href="/platform/plan" className="group flex flex-col gap-4" padding="lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{t('overview.wavesProgress')}</h2>
        <ChevronRight aria-hidden className="size-4 text-muted group-hover:text-primary-text" />
      </div>
      <ul className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: WAVES_COUNT }, (_, i) => (
              <li key={i} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-fg">{t('overview.wave', { n: i + 1 })}</span>
                  <span className="text-muted tabular-nums">
                    <SkeletonText width="10ch" />
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3" />
              </li>
            ))
          : waves.map((w) => (
              <li key={w.wave} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-fg">{t('overview.wave', { n: w.wave })}</span>
                  <span className="text-muted tabular-nums">{t('overview.waveDone', { passed: w.passed, total: w.total })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={w.total} aria-valuenow={w.passed} aria-label={t('overview.wave', { n: w.wave })}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${w.total ? (w.passed / w.total) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
      </ul>
    </Card>
  );
}

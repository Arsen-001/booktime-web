'use client';

/**
 * /platform/demand — спрос без предложения (F-00-180): один запрос — одна строка, районы внутри, сначала то, где у нас
 * нет мастеров. Картинка для соцсетей — из строки (F-00-202); награда первому (F-00-181).
 */
import { useState } from 'react';
import { SearchX, Shapes, Users } from 'lucide-react';
import { DemandImageSheet } from '@/areas/platform/demand/DemandImageSheet';
import { DemandQueryRow, DemandQueryRowSkeleton } from '@/areas/platform/demand/DemandQueryRow';
import { FirstAwardList } from '@/areas/platform/demand/FirstAwardList';
import { useDemandReport } from '@/areas/platform/hooks/usePlatformData';
import type { DemandPeriod, DemandQueryGroup } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StatCard } from '@/ui/StatCard';
import { Switch } from '@/ui/Switch';
import { ExitHold } from '@/ui/ExitHold';

/** Как в демо за неделю: строк запросов без предложения и запросов без мастеров во всём городе */
const TYPICAL_ROWS = 10;
const TYPICAL_NO_SPHERE = 0;

export function DemandScreen() {
  const t = useT('platform');
  const [period, setPeriod] = useState<DemandPeriod>('week');
  const [showAll, setShowAll] = useState(false);
  const [image, setImage] = useState<DemandQueryGroup | null>(null);
  const q = useDemandReport(period);
  const r = q.data;
  const groups = (r?.groups ?? []).filter((g) => showAll || g.districtsWithoutOffer > 0);
  // Скелетон — столько же строк, сколько было (иначе как в демо); плитка «нет во всём городе» — если была в прошлый раз
  const skeletonRows = useSkeletonCount('demand-rows', { loading: q.isLoading, count: r ? groups.length : undefined, fallback: TYPICAL_ROWS });
  const skeletonNoSphere = useSkeletonCount('demand-no-sphere', { loading: q.isLoading, count: r?.noSphere.length, fallback: TYPICAL_NO_SPHERE });
  const showNoSphere = q.isLoading ? skeletonNoSphere > 0 : (r?.noSphere.length ?? 0) > 0;

  return (
    <div data-f="F-00-180" className="flex flex-col gap-6">
      <PageHeader title={t('demand.title')} description={t('demand.subtitle')} />

      <SegmentedControl
        fullWidth
        value={period}
        onValueChange={(v) => setPeriod(v as DemandPeriod)}
        options={[
          { value: 'week', label: t('demand.periodWeek') },
          { value: 'prevWeek', label: t('demand.periodPrevWeek') },
          { value: 'month', label: t('demand.periodMonth') },
        ]}
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label={t('demand.totalPeople')} value={r?.totalPeople ?? 0} loading={q.isLoading} icon={<Users aria-hidden />} />
            <StatCard label={t('demand.withoutOffer')} value={r?.withoutOffer ?? 0} loading={q.isLoading} icon={<SearchX aria-hidden />} />
            {/* Ноль — не достижение (Р24): «нет мастеров во всём городе» показываем, только когда такие запросы есть */}
            {showNoSphere && <StatCard label={t('demand.noSphereCount')} value={r?.noSphere.length ?? 0} loading={q.isLoading} icon={<Shapes aria-hidden />} />}
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-fg">{t('demand.tableTitle')}</h2>
              <Switch checked={showAll} onCheckedChange={setShowAll} label={t('demand.showCovered')} labelPosition="start" />
            </div>
            {q.isLoading ? (
              <ul aria-busy className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                {Array.from({ length: skeletonRows }, (_, i) => (
                  <DemandQueryRowSkeleton key={i} />
                ))}
              </ul>
            ) : !groups.length ? (
              <EmptyState
                framed
                icon={<SearchX aria-hidden />}
                title={r?.groups.length ? t('demand.emptyNoOffer') : t('demand.empty')}
                description={r?.groups.length ? t('demand.emptyNoOfferHint') : t('demand.emptyHint')}
              />
            ) : (
              <ul className={cn('flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface', q.isPlaceholderData && 'opacity-60')}>
                {groups.map((g) => (
                  <DemandQueryRow key={g.key} group={g} onImage={() => setImage(g)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <FirstAwardList />
      <ExitHold value={image}>{(image) => <DemandImageSheet group={image} onClose={() => setImage(null)} />}</ExitHold>
    </div>
  );
}

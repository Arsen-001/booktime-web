'use client';

/**
 * /biz/network/analytics — сводный отчёт сети (F-11-062, F-11-063): период, шесть плиток с процентом
 * изменения к прошлому периоду той же длины и подсказкой-формулой у каждой.
 */
import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import type { DateRange } from '@/ui/Calendar';
import { defaultAnalyticsRange, getNetworkAnalyticsBreakdown, getNetworkAnalyticsSummary } from '@/api/network';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StatCard } from '@/ui/StatCard';
import { Tabs } from '@/ui/Tabs';
import {
  AnalyticsSettingsTab,
  DailyDetailTab,
  HrReportTab,
  LocationsDetailTab,
  ParamsDetailTab,
  PlanExecutionTab,
  ServicesReportTab,
  StaffReportTab,
} from '@/areas/network/analytics/AnalyticsReports';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { useNetwork } from '@/areas/network/lib/useNetwork';

type AnalyticsTab = 'summary' | 'locations' | 'daily' | 'params' | 'plan' | 'services' | 'staff' | 'hr' | 'settings';

type TileKey = 'revenue' | 'servicesRevenue' | 'goodsRevenue' | 'avgCheck' | 'avgCheckServices' | 'occupancy';
const TILES: TileKey[] = ['revenue', 'servicesRevenue', 'goodsRevenue', 'avgCheck', 'avgCheckServices', 'occupancy'];

/** Скелетон строки «подпись — число» в «Источниках» и «Статусах» — та же разметка */
function BreakdownRowSkeleton({ i }: { i: number }) {
  return (
    <li aria-hidden className="flex items-center justify-between">
      <span className="text-muted">
        <SkeletonText width={i % 2 ? '9ch' : '13ch'} />
      </span>
      <span className="font-medium text-fg">
        <SkeletonText width="2ch" />
      </span>
    </li>
  );
}

/** Сколько строк в «Статусах» (одинаковые подписи складываются в одну) — для числа строк скелетона */
function statusCount(byStatus: Record<string, number>, t: ReturnType<typeof useT<'network'>>): number {
  return new Set(Object.keys(byStatus).map((k) => t(`analytics.status.${k}` as never) as string)).size;
}

export function AnalyticsScreen() {
  const t = useT('network');
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const initial = defaultAnalyticsRange();
  // Сеть12: период применяется сразу (без отдельной карточки и «Показать»); половина периода — держим прежний
  const [applied, setApplied] = useState<DateRange>({ from: initial.from, to: initial.to });
  const [range, setRangeState] = useState<DateRange>({ from: initial.from, to: initial.to });
  const setRange = (r: DateRange) => {
    setRangeState(r);
    if (r.from && r.to) setApplied(r);
  };
  const [hint, setHint] = useState<TileKey | null>(null);
  const [tab, setTab] = useState<AnalyticsTab>('summary');

  const q = useApiQuery(
    ['network', 'analytics', networkId, applied.from, applied.to],
    () => getNetworkAnalyticsSummary(networkId!, applied.from!, applied.to!),
    { enabled: ready && Boolean(networkId) && Boolean(applied.from) && Boolean(applied.to) && tab === 'summary' },
  );
  const breakdownQ = useApiQuery(
    ['network', 'analyticsBreakdown', networkId, applied.from, applied.to],
    () => getNetworkAnalyticsBreakdown(networkId!, applied.from!, applied.to!),
    { enabled: ready && Boolean(networkId) && Boolean(applied.from) && Boolean(applied.to) && tab === 'summary' },
  );

  const breakdownLoading = !breakdownQ.data && (breakdownQ.isLoading || !ready);
  const sourceRows = useSkeletonCount('analyticsSources', {
    loading: breakdownLoading,
    count: breakdownQ.data ? Object.keys(breakdownQ.data.bySource).length : undefined,
    fallback: 5,
    max: 10,
  });
  const statusSkeletonRows = useSkeletonCount('analyticsStatuses', { loading: breakdownLoading, count: breakdownQ.data ? statusCount(breakdownQ.data.byStatus, t) : undefined, fallback: 6, max: 10 });

  if (isError || q.isError) return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const tilesLoading = !ready || q.isLoading;
  const money = (v: number) => format.money(v);
  const valueOf = (key: TileKey) => (q.data ? (key === 'occupancy' ? `${q.data.occupancy}%` : money(q.data[key])) : '—');
  // Сеть12: прошлый период пуст или крошечный (рост больше чем в 4 раза) — процент ничего не говорит, пишем «было X»
  const wasTiny = (key: TileKey) => {
    if (!q.data) return false;
    const d = q.data[`${key}Delta` as const];
    return q.data.previous[key] === 0 ? q.data[key] !== 0 : Math.abs(d) > 300;
  };
  const deltaOf = (key: TileKey) => (q.data && !wasTiny(key) ? q.data[`${key}Delta` as const] : undefined);
  const hintOf = (key: TileKey) =>
    q.data && wasTiny(key)
      ? t('analytics.wasValue', {
          value: key === 'occupancy' ? `${q.data.previous.occupancy}%` : money(q.data.previous[key]),
        })
      : undefined;
  // Сеть12: у двух статусов одна подпись («Отменена» клиентом и мастером, «Подтвердил») — одна строка с суммой
  const statusRows = (() => {
    const map = new Map<string, number>();
    for (const [k, v] of Object.entries(breakdownQ.data?.byStatus ?? {})) {
      const label = t(`analytics.status.${k}` as never) as string;
      map.set(label, (map.get(label) ?? 0) + v);
    }
    return [...map.entries()];
  })();

  return (
    <div
      data-f="F-11-062 F-11-063 F-11-064 F-11-065 F-11-066 F-11-067 F-11-068 F-11-069 F-11-070 F-11-071 F-11-072 F-11-073 F-11-078 F-12-091 F-12-092"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader
        title={t('analytics.title')}
        description={t('analytics.subtitle')}
        actions={<NetworkPageActions titleKey="help.analytics.title" bodyKey="help.analytics.body" />}
      />

      <Tabs
        items={(['summary', 'locations', 'daily', 'params', 'plan', 'services', 'staff', 'hr', 'settings'] as AnalyticsTab[]).map((v) => ({
          value: v,
          label: t(`analytics.tabs.${v}` as const),
        }))}
        value={tab}
        onValueChange={(v) => setTab(v as AnalyticsTab)}
      />

      {['summary', 'locations', 'daily', 'params', 'services', 'staff'].includes(tab) && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">{t('analytics.periodLabel')}</span>
          <DateRangePicker value={range} onValueChange={setRange} presets className="w-full sm:w-72" />
        </div>
      )}

      {tab === 'summary' && (
        <>
          {/* Плитки те же и при загрузке: подпись, значение и строка «к прошлому периоду» — полосами */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TILES.map((key) => (
              <div key={key} className="relative">
                <StatCard
                  label={t(`analytics.tile.${key}` as const)}
                  value={tilesLoading ? '' : valueOf(key)}
                  delta={tilesLoading ? 0 : deltaOf(key)}
                  hint={tilesLoading ? undefined : hintOf(key)}
                  loading={tilesLoading}
                />
                <IconButton
                  icon={<CircleHelp aria-hidden />}
                  variant="ghost"
                  size="sm"
                  label={t('analytics.tileHint')}
                  className="absolute top-2 right-2"
                  onClick={() => setHint(key)}
                />
              </div>
            ))}
          </div>

          {breakdownLoading || breakdownQ.data ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SectionCard title={t('analytics.clientsBlock')}>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.newClients')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.newClients : <SkeletonText width="3ch" />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.returningClients')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.returningClients : <SkeletonText width="3ch" />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.lostClients')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.lostClients : <SkeletonText width="3ch" />}</dd>
                  </div>
                </dl>
              </SectionCard>
              <SectionCard title={t('analytics.bookingsBlock')}>
                <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.totalBookings')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.totalBookings : <SkeletonText width="3ch" />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.completedBookings')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.completedBookings : <SkeletonText width="3ch" />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.pendingBookings')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.pendingBookings : <SkeletonText width="3ch" />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('analytics.cancelledBookings')}</dt>
                    <dd className="text-lg font-semibold text-fg">{breakdownQ.data ? breakdownQ.data.cancelledBookings : <SkeletonText width="3ch" />}</dd>
                  </div>
                </dl>
              </SectionCard>
              <SectionCard title={t('analytics.sourcesBlock')}>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {!breakdownQ.data &&
                    Array.from({ length: sourceRows }, (_, i) => <BreakdownRowSkeleton key={i} i={i} />)}
                  {Object.entries(breakdownQ.data?.bySource ?? {}).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="text-muted">{t(`analytics.source.${k}` as never) as string}</span>
                      <span className="font-medium text-fg">{v}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title={t('analytics.statusesBlock')}>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {!breakdownQ.data &&
                    Array.from({ length: statusSkeletonRows }, (_, i) => <BreakdownRowSkeleton key={i} i={i} />)}
                  {statusRows.map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="text-muted">{k}</span>
                      <span className="font-medium text-fg">{v}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          ) : null}
        </>
      )}

      {tab === 'locations' && networkId && applied.from && applied.to && (
        <LocationsDetailTab networkId={networkId} from={applied.from} to={applied.to} />
      )}
      {tab === 'daily' && networkId && applied.from && applied.to && <DailyDetailTab networkId={networkId} from={applied.from} to={applied.to} />}
      {tab === 'params' && networkId && applied.from && applied.to && <ParamsDetailTab networkId={networkId} from={applied.from} to={applied.to} />}
      {tab === 'plan' && networkId && <PlanExecutionTab networkId={networkId} />}
      {tab === 'services' && networkId && applied.from && applied.to && (
        <ServicesReportTab networkId={networkId} from={applied.from} to={applied.to} />
      )}
      {tab === 'staff' && networkId && applied.from && applied.to && <StaffReportTab networkId={networkId} from={applied.from} to={applied.to} />}
      {tab === 'hr' && networkId && <HrReportTab networkId={networkId} />}
      {tab === 'settings' && networkId && <AnalyticsSettingsTab networkId={networkId} />}

      <Modal open={Boolean(hint)} onOpenChange={(open) => !open && setHint(null)} title={hint ? t(`analytics.tile.${hint}` as const) : ''} size="sm">
        {hint && <p className="text-sm leading-relaxed text-fg">{t(`analytics.tileFormula.${hint}` as const)}</p>}
      </Modal>
    </div>
  );
}

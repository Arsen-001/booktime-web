'use client';

/**
 * «Приложение» → аналитика (F-14-122…124, F-14-126, F-14-129). Демо-симуляция раздела «Analytics» в
 * приложении для бизнеса: Z-отчёт (закрытие смены), дневной отчёт с 6 показателями и сравнением к
 * вчера, отчёт за период (по умолчанию — прошлая неделя), «Моя аналитика» и переключение филиалов.
 */
import { useState } from 'react';
import { Banknote, Building2, Lock, TrendingDown, TrendingUp } from 'lucide-react';
import { getDailyReport, getDayZReport, getMyAnalytics, getNetworkDayStats, getPeriodReport, listAppStaff } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { ISODate } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { Card } from '@/ui/Card';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';

// «Сегодня» — по Еревану (@/lib/date), не по UTC: с 00:00 до 04:00 toISOString() давал вчерашний день (F-14-122…124, A9)
function todayISO(): ISODate {
  return today();
}
function weekAgoISO(): ISODate {
  return addDays(today(), -6);
}

export function ReportsAppScreen() {
  const t = useT('client');
  const { ready, businessId } = useCurrent();
  // Права — как в вебе (A8): отчёты салона — reports.view, Z-отчёт (деньги смены) — finance.view; «Моя аналитика» — всем
  const canReports = useCan('reports.view');
  const canFinance = useCan('finance.view');
  type Tab = 'z' | 'daily' | 'period' | 'mine' | 'network';
  const allowed: Record<Tab, boolean> = { daily: canReports, z: canFinance, period: canReports, mine: true, network: canReports };
  const [picked, setPicked] = useState<Tab>('daily');
  const tab: Tab = allowed[picked] ? picked : canReports ? 'daily' : canFinance ? 'z' : 'mine';

  return (
    <div data-f="F-14-122 F-14-123 F-14-124 F-14-126 F-14-129" className="flex flex-col gap-6">
      <PageHeader title={t('apps.reports.title')} description={t('apps.reports.subtitle')} />

      <Tabs
        value={tab}
        onValueChange={(v) => setPicked(v as Tab)}
        items={(
          [
            { value: 'daily', label: t('apps.reports.tabDaily') },
            { value: 'z', label: t('apps.reports.tabZ') },
            { value: 'period', label: t('apps.reports.tabPeriod') },
            { value: 'mine', label: t('apps.reports.tabMine') },
            { value: 'network', label: t('apps.reports.tabNetwork') },
          ] as const
        ).filter((it) => allowed[it.value])}
      />

      {!ready || !businessId ? (
        <Skeleton lines={4} />
      ) : tab === 'daily' ? (
        <DailyReportTab businessId={businessId} />
      ) : tab === 'z' ? (
        <ZReportTab businessId={businessId} />
      ) : tab === 'period' ? (
        <PeriodReportTab businessId={businessId} />
      ) : tab === 'mine' ? (
        <MyAnalyticsTab businessId={businessId} />
      ) : (
        <NetworkTab />
      )}
    </div>
  );
}

function DailyReportTab({ businessId }: { businessId: string }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const q = useApiQuery(['daily-report', businessId], () => getDailyReport(businessId, todayISO()));

  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  const { today, yesterday } = q.data;
  const metrics: Array<{ key: keyof typeof today; label: string; format: (v: number) => string; goodDirection: 1 | -1 }> = [
    { key: 'revenue', label: t('apps.reports.metric.revenue'), format: fmt.money, goodDirection: 1 },
    { key: 'bookingsCount', label: t('apps.reports.metric.bookingsCount'), format: String, goodDirection: 1 },
    { key: 'newClients', label: t('apps.reports.metric.newClients'), format: String, goodDirection: 1 },
    { key: 'cancelledCount', label: t('apps.reports.metric.cancelledCount'), format: String, goodDirection: -1 },
    { key: 'noShowCount', label: t('apps.reports.metric.noShowCount'), format: String, goodDirection: -1 },
    { key: 'avgCheck', label: t('apps.reports.metric.avgCheck'), format: fmt.money, goodDirection: 1 },
  ];

  return (
    <div data-f="F-14-123" className="grid grid-cols-2 gap-3">
      {metrics.map((m) => {
        const value = today[m.key];
        const prev = yesterday[m.key];
        const diff = value - prev;
        const positive = diff * m.goodDirection >= 0;
        return (
          <Card key={m.key} padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{m.label}</span>
            <span className="text-lg font-semibold text-fg">{m.format(value)}</span>
            <span className={`flex items-center gap-1 text-xs ${diff === 0 ? 'text-muted' : positive ? 'text-success' : 'text-danger'}`}>
              {diff !== 0 && (diff > 0 ? <TrendingUp aria-hidden className="size-3.5" /> : <TrendingDown aria-hidden className="size-3.5" />)}
              {diff > 0 ? '+' : ''}
              {m.format(diff)} {t('apps.reports.vsYesterday')}
            </span>
          </Card>
        );
      })}
    </div>
  );
}

function ZReportTab({ businessId }: { businessId: string }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const [staffId, setStaffId] = useState<string>('');
  const staffQ = useApiQuery(['app-staff-brief', businessId], () => listAppStaff(businessId, false));
  const q = useApiQuery(['z-report', businessId, staffId], () => getDayZReport(businessId, todayISO(), staffId || undefined));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data?.rows ?? [], { resetKey: staffId });

  if (q.isLoading || staffQ.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <div data-f="F-14-122" className="flex flex-col gap-4">
      <Select
        options={[{ value: '', label: t('apps.reports.allStaff') }, ...(staffQ.data ?? []).map((r) => ({ value: r.staff.id, label: r.staff.name }))]}
        value={staffId}
        onValueChange={setStaffId}
      />

      <Card padding="sm" className="flex items-center justify-between bg-surface-2">
        <span className="text-sm text-muted">{t('apps.reports.zTotal')}</span>
        <span className="text-lg font-semibold text-fg">{fmt.money(q.data.total)}</span>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {(['cash', 'card', 'loyalty'] as const).map((m) => (
          <Card key={m} padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t(`apps.visit.method.${m}` as 'apps.visit.method.cash')}</span>
            <span className="text-sm font-semibold text-fg">{fmt.money(q.data!.byMethod[m])}</span>
          </Card>
        ))}
      </div>

      {q.data.rows.length === 0 ? (
        <EmptyState icon={<Banknote aria-hidden className="size-8 text-muted" />} title={t('apps.reports.zEmpty')} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {pageItems.map((row) => (
              <li key={row.booking.id}>
                <Card padding="sm" className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{row.clientName || t('apps.visit.guest')}</p>
                    <p className="text-xs text-muted">{row.staffName}</p>
                  </div>
                  <span className="text-sm font-medium text-fg">{fmt.money(row.paidTotal)}</span>
                </Card>
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}
    </div>
  );
}

function PeriodReportTab({ businessId }: { businessId: string }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const [range, setRange] = useState<{ from: ISODate; to: ISODate }>({ from: weekAgoISO(), to: todayISO() });
  const q = useApiQuery(['period-report', businessId, range.from, range.to], () => getPeriodReport(businessId, range.from, range.to));

  return (
    <div data-f="F-14-124" className="flex flex-col gap-4">
      <DateRangePicker
        value={range}
        onValueChange={(v) => v.from && v.to && setRange({ from: v.from, to: v.to })}
      />
      {q.isLoading ? (
        <Skeleton lines={3} />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Card padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('apps.reports.metric.revenue')}</span>
            <span className="text-lg font-semibold text-fg">{fmt.money(q.data.revenue)}</span>
          </Card>
          <Card padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('apps.reports.metric.bookingsCount')}</span>
            <span className="text-lg font-semibold text-fg">{q.data.bookingsCount}</span>
          </Card>
          <Card padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('apps.reports.metric.avgCheck')}</span>
            <span className="text-lg font-semibold text-fg">{fmt.money(q.data.avgCheck)}</span>
          </Card>
          <Card padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('apps.reports.periodDays')}</span>
            <span className="text-lg font-semibold text-fg">{q.data.days}</span>
          </Card>
        </div>
      )}
    </div>
  );
}

function MyAnalyticsTab({ businessId }: { businessId: string }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const { staffId } = useCurrent();
  const q = useApiQuery(
    ['my-analytics-tab', businessId, staffId],
    () => getMyAnalytics(businessId, staffId!, weekAgoISO(), todayISO()),
    { enabled: Boolean(staffId) },
  );

  if (!staffId) {
    return <EmptyState icon={<Lock aria-hidden className="size-8 text-muted" />} title={t('apps.reports.mineNeedsStaff')} />;
  }
  if (q.isLoading) return <Skeleton lines={2} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <div data-f="F-14-126" className="grid grid-cols-2 gap-3">
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.reports.metric.revenue')}</span>
        <span className="text-lg font-semibold text-fg">{fmt.money(q.data.revenue)}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.reports.metric.bookingsCount')}</span>
        <span className="text-lg font-semibold text-fg">{q.data.bookingsCount}</span>
      </Card>
      <p className="col-span-full text-xs text-muted">{t('apps.reports.mineOnlyOwn')}</p>
    </div>
  );
}

function NetworkTab() {
  const t = useT('client');
  const fmt = useClientFormat();
  const { locationIds, networkId } = useCurrent();
  const q = useApiQuery(['network-day-stats', locationIds.join(',')], () => getNetworkDayStats(locationIds, todayISO()), {
    enabled: locationIds.length > 0,
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  if (!networkId || locationIds.length < 2) {
    return <EmptyState icon={<Building2 aria-hidden className="size-8 text-muted" />} title={t('apps.reports.networkSingle')} />;
  }
  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <>
      <ul data-f="F-14-129" className="flex flex-col gap-2">
        {pageItems.map((row) => (
          <li key={row.businessId}>
            <Card padding="sm" className="flex items-center justify-between">
              <span className="font-medium text-fg">{row.name}</span>
              <span className="text-sm font-semibold text-fg">{fmt.money(row.metrics.revenue)}</span>
            </Card>
          </li>
        ))}
      </ul>
      {pager}
    </>
  );
}

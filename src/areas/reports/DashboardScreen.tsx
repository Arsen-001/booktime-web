'use client';

/**
 * F-12-009…018 «Основные показатели»: период (умолчание — 30 дней, F-12-005), фильтры (Должности/Сотрудники/
 * Сотрудники с доступом, F-12-009), три блока «Продажи»/«Посещаемость»/«Заполненность» (F-12-010…016),
 * подсказки «i» и справка по разделу (F-12-018), динамика к прошлому периоду (F-12-017).
 */
import { BarChart3, SlidersHorizontal } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useId, useMemo, useState } from 'react';
import { useCoreList } from '@/api/core';
import { getMainDashboard } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { bucketByMonth, chartGranularity, compactAxis } from '@/areas/reports/chartBuckets';
import { MetricTile } from '@/areas/reports/components/MetricTile';
import { MonthlyPlanCard } from '@/areas/reports/components/MonthlyPlanCard';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { reportLink, setReportStaff, useReportRange, useReportStaff, type ReportRange } from '@/areas/reports/reportPeriod';
import { useCan, useCurrent } from '@/demo/hooks';
import type { MainDashboardData, MetricValue } from '@/domain/reports';
import { dayjs } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button, LinkButton } from '@/ui/Button';
import type { DateRange } from '@/ui/Calendar';
import { ChartCard, CHART_COLORS, chartTheme } from '@/ui/ChartCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';

export function DashboardScreen() {
  const t = useT('reports');
  const { businessId, activeLocationIds, ready } = useCurrent();
  const canView = useCan('reports.view');
  const range = useReportRange();
  const staffId = useReportStaff();
  const [position, setPosition] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStaff, setDraftStaff] = useState('');
  const [draftPosition, setDraftPosition] = useState('');

  const filters = useMemo(() => ({ staffId: staffId || undefined, position: position || undefined }), [staffId, position]);

  // Отч12: смена филиала/периода/фильтра — прежние цифры остаются на месте, пока считаются новые
  const q = useApiQuery(
    ['reports', 'dashboard', businessId, activeLocationIds, range, filters],
    () => getMainDashboard({ businessId: businessId!, locationIds: activeLocationIds, range, filters }),
    { enabled: ready && !!businessId && canView, keepPrevious: true },
  );

  const activeCount = (staffId ? 1 : 0) + (position ? 1 : 0);
  const empty = !q.isLoading && q.data?.isEmpty;

  if (!ready) return null;

  return (
    <PermissionGate permission="reports.view" fallback="message">
      {/*
        F-12-105/106 (b03): у нас один адаптивный веб-кабинет, а не отдельное приложение для бизнеса —
        эта же страница на телефоне 390×844 и есть «вкладка Аналитика в приложении» (три отчёта из
        F-12-105 — «Основные показатели»/«Финансовый»/«По сотрудникам» — уже построены и одинаково
        доступны с любого экрана); личный экран «Моя аналитика» администратора (F-12-106) построен
        отдельно (MyAnalyticsScreen.tsx), гейт правом «Аналитика администраторов» — см. F-12-089.
        F-12-090 «доступ только к отчётам — бесплатно»: `reports.view` (canView выше) — и есть та самая
        бесплатная роль «Только просмотр» (ROLE_TEMPLATES.viewer/systemManager, domain/staff.ts,
        freeByDefault: true) — она не даёт менять данные (нет staff.manage/edit), поэтому не занимает
        платное место в лицензии (F-00-016).
      */}
      <div data-f="F-12-009 F-12-105 F-02-104 F-07-171 F-12-090 F-12-027" className="flex flex-col gap-6">
        <ReportHeader slug="dashboard" helpBody={t('help.dashboard')} />

        {/* Пустой бизнес: ни фильтров, ни периода над пустотой (qa/measure/reports/empty-d1.md) */}
        {!empty && <MonthlyPlanCard />}

        {!empty && (
          <div data-f="F-12-005" className="flex flex-wrap items-center gap-2">
            <ReportPeriodPicker />
            <span className="text-sm text-muted">{t('dashboard.selectedDays', { n: daysBetween(range) })}</span>
            <Button
              variant="secondary"
              leftIcon={<SlidersHorizontal className="size-4" />}
              onClick={() => {
                setDraftStaff(staffId);
                setDraftPosition(position);
                setFiltersOpen(true);
              }}
            >
              {t('dashboard.filters')}
              {activeCount > 0 && ` (${activeCount})`}
            </Button>
          </div>
        )}

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : empty ? (
          <EmptyState
            variant="page"
            icon={<BarChart3 />}
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyText')}
            action={<LinkButton href="/biz/journal">{t('dashboard.emptyAction')}</LinkButton>}
          />
        ) : (
          <>
            <SalesSection data={q.data} loading={q.isLoading} range={range} staffId={staffId} />
            <AttendanceSection data={q.data} loading={q.isLoading} range={range} staffId={staffId} />
            <OccupancySection data={q.data} loading={q.isLoading} range={range} staffId={staffId} />
            <ExtrasSection data={q.data} loading={q.isLoading} />
          </>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('dashboard.filters')}
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDraftStaff('');
                setDraftPosition('');
              }}
            >
              {t('dashboard.resetAll')}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setFiltersOpen(false)}>
                {t('dashboard.cancel')}
              </Button>
              <Button
                onClick={() => {
                  setReportStaff(draftStaff);
                  setPosition(draftPosition);
                  setFiltersOpen(false);
                }}
              >
                {t('dashboard.apply')}
              </Button>
            </div>
          </div>
        }
      >
        <StaffFilterFields
          businessId={businessId}
          staffId={draftStaff}
          position={draftPosition}
          onStaffChange={setDraftStaff}
          onPositionChange={setDraftPosition}
        />
      </Sheet>
    </PermissionGate>
  );
}

interface SectionProps {
  data: MainDashboardData | undefined;
  loading: boolean;
  range: ReportRange;
  staffId: string;
}

/** «было X» для плитки: деньги — деньгами, штуки — числом (Отч6) */
function prevText(m: MetricValue | undefined, fmt: (n: number) => string): string | undefined {
  return m?.previous === undefined ? undefined : fmt(m.previous);
}

function SalesSection({ data, loading, range, staffId }: SectionProps) {
  const t = useT('reports');
  const f = useFormat();
  const sales = data?.sales;
  const money = (n: number) => f.money(n);
  // Отч9: цифра продаж ведёт к списку — «По сотрудникам» за тот же период
  const toStaff = reportLink('/biz/reports/r/salesByStaff', range, { staff: staffId || undefined });
  const byDay = bucketByMonth(sales?.byDay ?? []);
  const monthly = chartGranularity(sales?.byDay.length ?? 0) === 'month';
  const tick = (d: string) => f.date(d, monthly ? 'monthYear' : 'dayMonth');

  return (
    <section data-f="F-12-010 F-08-108" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-fg">{t('dashboard.sales.title')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile
          label={t('dashboard.sales.total')}
          value={sales ? money(sales.total.value) : ''}
          sub={sales ? t('dashboard.opsCount', { n: sales.total.count }) : ''}
          hint={t('help.tiles.total')}
          deltaPct={sales?.total.deltaPct}
          isNew={sales?.total.isNew}
          previous={prevText(sales?.total, money)}
          href={toStaff}
          hrefLabel={t('dashboard.byStaffLink')}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.sales.services')}
          value={sales ? money(sales.services.value) : ''}
          sub={sales ? t('dashboard.servicesCount', { n: sales.services.count }) : ''}
          hint={t('help.tiles.services')}
          deltaPct={sales?.services.deltaPct}
          isNew={sales?.services.isNew}
          previous={prevText(sales?.services, money)}
          href={toStaff}
          hrefLabel={t('dashboard.byStaffLink')}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.sales.products')}
          value={sales ? money(sales.products.value) : ''}
          sub={sales ? t('dashboard.productsCount', { n: sales.products.count }) : ''}
          hint={t('help.tiles.products')}
          deltaPct={sales?.products.deltaPct}
          isNew={sales?.products.isNew}
          previous={prevText(sales?.products, money)}
          href={toStaff}
          hrefLabel={t('dashboard.byStaffLink')}
          loading={loading}
        />
        <div data-f="F-12-006" className="contents">
          <div data-f="F-12-011" className="contents">
            <MetricTile
              label={t('dashboard.sales.avgVisit')}
              value={sales ? money(sales.avgVisit.value) : ''}
              sub={sales?.avgVisit.count !== undefined ? t('dashboard.receiptsCount', { n: sales.avgVisit.count }) : ''}
              hint={t('help.tiles.avgVisit')}
              deltaPct={sales?.avgVisit.deltaPct}
              isNew={sales?.avgVisit.isNew}
              previous={prevText(sales?.avgVisit, money)}
              loading={loading}
            />
          </div>
        </div>
        <MetricTile
          label={t('dashboard.sales.avgService')}
          value={sales ? money(sales.avgService.value) : ''}
          hint={t('help.tiles.avgService')}
          deltaPct={sales?.avgService.deltaPct}
          isNew={sales?.avgService.isNew}
          previous={prevText(sales?.avgService, money)}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.sales.avgProduct')}
          value={sales ? money(sales.avgProduct.value) : ''}
          hint={t('help.tiles.avgProduct')}
          deltaPct={sales?.avgProduct.deltaPct}
          isNew={sales?.avgProduct.isNew}
          previous={prevText(sales?.avgProduct, money)}
          loading={loading}
        />
      </div>
      {sales?.booked && (
        <p data-f="F-12-010" className="text-sm text-muted">
          {t('dashboard.sales.booked', { total: money(sales.booked.total), services: money(sales.booked.services) })}
        </p>
      )}
      <p data-f="F-12-012" className="text-xs text-muted">
        * {t('dashboard.sales.footnote')}
        <span data-f="F-12-115" className="contents" />
      </p>
      {/* Отч8: «Итого» и «Услуги» линиями почти одного цвета сливались — столбики «услуги + товары» стопкой, высота = итого */}
      <ChartCard title={monthly ? t('dashboard.sales.chartTitleMonthly') : t('dashboard.sales.chartTitle')} loading={loading} height={240}>
        <BarChart data={byDay}>
          <CartesianGrid {...chartTheme.grid} />
          <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={tick} />
          <YAxis {...chartTheme.axis} tickFormatter={compactAxis} width={56} />
          <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => tick(String(label))} formatter={(v) => money(Number(v))} />
          <Legend {...chartTheme.legend} />
          <Bar dataKey="services" name={t('dashboard.sales.services')} stackId="s" fill={CHART_COLORS[0]} />
          <Bar dataKey="products" name={t('dashboard.sales.products')} stackId="s" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </section>
  );
}

function AttendanceSection({ data, loading, range, staffId }: SectionProps) {
  const t = useT('reports');
  const f = useFormat();
  const a = data?.attendance;
  const num = (n: number) => f.number(n);
  const byDay = bucketByMonth(a?.byDay ?? []);
  const monthly = chartGranularity(a?.byDay.length ?? 0) === 'month';
  const tick = (d: string) => f.date(d, monthly ? 'monthYear' : 'dayMonth');

  return (
    <section data-f="F-12-013" className="flex flex-col gap-3">
      <div data-f="F-12-119" className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-fg">{t('dashboard.attendance.title')}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div data-f="F-12-015" className="contents">
          <MetricTile
            label={t('dashboard.attendance.clients')}
            value={a?.clients.value ?? ''}
            hint={t('help.tiles.clients')}
            deltaPct={a?.clients.deltaPct}
            isNew={a?.clients.isNew}
            previous={prevText(a?.clients, num)}
            href={`/biz/clients?range=${range.from}_${range.to}`}
            hrefLabel={t('dashboard.viewClients')}
            loading={loading}
          />
        </div>
        <MetricTile
          label={t('dashboard.attendance.visits')}
          value={a?.visits.value ?? ''}
          hint={t('help.tiles.visits')}
          deltaPct={a?.visits.deltaPct}
          isNew={a?.visits.isNew}
          previous={prevText(a?.visits, num)}
          href={appointmentsLink(range, staffId, { status: 'arrived' })}
          hrefLabel={t('dashboard.openList')}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.attendance.appointments')}
          value={a?.appointments.value ?? ''}
          hint={t('help.tiles.appointments')}
          deltaPct={a?.appointments.deltaPct}
          isNew={a?.appointments.isNew}
          previous={prevText(a?.appointments, num)}
          href={appointmentsLink(range, staffId)}
          hrefLabel={t('dashboard.openList')}
          loading={loading}
        />
      </div>
      <div data-f="F-12-014" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile
          label={t('dashboard.attendance.newClients')}
          value={a?.newClients.value ?? ''}
          hint={t('help.tiles.newClients')}
          deltaPct={a?.newClients.deltaPct}
          isNew={a?.newClients.isNew}
          previous={prevText(a?.newClients, num)}
          href={`/biz/clients?pick=new&range=${range.from}_${range.to}`}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.attendance.returningClients')}
          value={a?.returningClients.value ?? ''}
          hint={t('help.tiles.returningClients')}
          deltaPct={a?.returningClients.deltaPct}
          isNew={a?.returningClients.isNew}
          previous={prevText(a?.returningClients, num)}
          href={`/biz/clients?pick=repeat&range=${range.from}_${range.to}`}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.attendance.lostClients')}
          value={a?.lostClients.value ?? ''}
          hint={t('help.tiles.lostClients')}
          href={`/biz/clients?pick=lost&range=${range.from}_${range.to}`}
          loading={loading}
          noTrend
        />
      </div>
      <ChartCard
        title={monthly ? t('dashboard.attendance.chartTitleMonthly') : t('dashboard.attendance.chartTitle')}
        description={t('dashboard.attendance.chartHint')}
        loading={loading}
        height={220}
      >
        <BarChart data={byDay}>
          <CartesianGrid {...chartTheme.grid} />
          <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={tick} />
          <YAxis {...chartTheme.axis} allowDecimals={false} />
          <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => tick(String(label))} />
          <Legend {...chartTheme.legend} />
          <Bar dataKey="newClients" name={t('dashboard.attendance.newClients')} stackId="a" fill={CHART_COLORS[0]} />
          <Bar dataKey="returningClients" name={t('dashboard.attendance.returningClients')} stackId="a" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </section>
  );
}

/** Отч9: ссылка «от плитки к записям» — отчёт «Записи» по дате визита, со статусом/отменой */
function appointmentsLink(range: ReportRange, staffId: string, extra?: { status?: string; cancelled?: string }): string {
  const params = new URLSearchParams({ visitFrom: range.from, visitTo: range.to });
  if (staffId) params.set('staff', staffId);
  if (extra?.status) params.set('status', extra.status);
  if (extra?.cancelled) params.set('cancelled', extra.cancelled);
  return `/biz/reports/r/appointments?${params.toString()}`;
}

function OccupancySection({ data, loading, range, staffId }: SectionProps) {
  const t = useT('reports');
  const f = useFormat();
  const o = data?.occupancy;
  const byDay = bucketByMonth(o?.byDay ?? [], ['occupancyPct']);
  const monthly = chartGranularity(o?.byDay.length ?? 0) === 'month';
  const tick = (d: string) => f.date(d, monthly ? 'monthYear' : 'dayMonth');

  return (
    <section data-f="F-12-016" className="flex flex-col gap-3">
      <h2 data-f="F-12-121" className="text-lg font-semibold text-fg">
        {t('dashboard.occupancy.title')}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile
          label={t('dashboard.occupancy.completed')}
          value={o?.completed.count ?? ''}
          hint={t('help.tiles.completed')}
          sharePct={o?.completed.sharePct}
          href={appointmentsLink(range, staffId, { status: 'arrived' })}
          hrefLabel={t('dashboard.openList')}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.occupancy.incomplete')}
          value={o?.incomplete.count ?? ''}
          hint={t('help.tiles.incomplete')}
          sharePct={o?.incomplete.sharePct}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.occupancy.noShow')}
          value={o?.noShow?.count ?? ''}
          hint={t('help.tiles.noShow')}
          sharePct={o?.noShow?.sharePct}
          href={appointmentsLink(range, staffId, { status: 'no_show' })}
          hrefLabel={t('dashboard.openList')}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.occupancy.cancelled')}
          value={o?.cancelled.count ?? ''}
          hint={t('help.tiles.cancelled')}
          sharePct={o?.cancelled.sharePct}
          href={appointmentsLink(range, staffId, { cancelled: 'cancelled' })}
          hrefLabel={t('dashboard.openList')}
          loading={loading}
        />
        <MetricTile
          label={t('dashboard.occupancy.avg')}
          value={o ? `${o.avgOccupancyPct}%` : ''}
          hint={t('help.tiles.avgOccupancy')}
          loading={loading}
          noTrend
        />
      </div>
      <ChartCard title={monthly ? t('dashboard.occupancy.chartTitleMonthly') : t('dashboard.occupancy.chartTitle')} loading={loading} height={220}>
        <LineChart data={byDay}>
          <CartesianGrid {...chartTheme.grid} />
          <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={tick} />
          <YAxis {...chartTheme.axis} unit="%" />
          <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => tick(String(label))} />
          <Line type="monotone" dataKey="occupancyPct" name={t('dashboard.occupancy.avg')} stroke={CHART_COLORS[4]} dot={false} strokeWidth={2} />
        </LineChart>
      </ChartCard>
    </section>
  );
}

/** Отч13: перезапись, неявки, выручка на час графика, источники новых клиентов */
function ExtrasSection({ data, loading }: Pick<SectionProps, 'data' | 'loading'>) {
  const t = useT('reports');
  const f = useFormat();
  const x = data?.extras;
  // Сервер этих цифр пока не считает — без них секции просто нет (а не нули)
  if (!loading && !x) return null;
  const maxSource = Math.max(1, ...(x?.newClientSources ?? []).map((s) => s.count));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-fg">{t('dashboard.extra.title')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label={t('dashboard.extra.rebooking')}
          value={x ? (x.rebookingPct === null ? '—' : `${x.rebookingPct}%`) : ''}
          sub={x ? t('dashboard.extra.rebookingSub', { n: x.rebookedClients, total: x.visitedClients }) : ''}
          hint={t('help.tiles.rebooking')}
          loading={loading}
          noTrend
        />
        <MetricTile
          label={t('dashboard.extra.noShowRate')}
          value={x ? (x.noShowPct === null ? '—' : `${x.noShowPct}%`) : ''}
          sub={x ? t('dashboard.extra.noShowSub') : ''}
          hint={t('help.tiles.noShowRate')}
          loading={loading}
          noTrend
        />
        <MetricTile
          label={t('dashboard.extra.revenuePerHour')}
          value={x ? (x.revenuePerScheduledHour === null ? '—' : f.money(x.revenuePerScheduledHour)) : ''}
          sub={x ? t('dashboard.extra.revenuePerHourSub', { n: x.scheduledHours }) : ''}
          hint={t('help.tiles.revenuePerHour')}
          loading={loading}
          noTrend
        />
        <div className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <p className="text-sm leading-snug font-medium text-muted">{t('dashboard.extra.sources')}</p>
          {loading || !x ? (
            // Те же строки, что у списка источников: название · число и полоска под ними
            <ul className="flex flex-col gap-1.5 pt-1">
              {['12ch', '9ch', '14ch', '8ch'].map((w) => (
                <li key={w} className="flex flex-col gap-0.5 text-sm">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-fg">
                      <SkeletonText width={w} />
                    </span>
                    <span className="font-medium text-fg tabular-nums">
                      <SkeletonText width="2ch" />
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" />
                </li>
              ))}
            </ul>
          ) : x.newClientSources.length === 0 ? (
            <p className="text-sm text-muted">{t('dashboard.extra.sourcesEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 pt-1">
              {x.newClientSources.slice(0, 4).map((s) => (
                <li key={s.source} className="flex flex-col gap-0.5 text-sm">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-fg">{t(`visits.source.${s.source}` as never)}</span>
                    <span className="font-medium text-fg tabular-nums">{s.count}</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${s.count / maxSource})` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function daysBetween(range: DateRange): number {
  if (!range.from || !range.to) return 0;
  return dayjs(range.to).diff(dayjs(range.from), 'day') + 1;
}

function StaffFilterFields({
  businessId,
  staffId,
  position,
  onStaffChange,
  onPositionChange,
}: {
  businessId?: string;
  staffId: string;
  position: string;
  onStaffChange: (v: string) => void;
  onPositionChange: (v: string) => void;
}) {
  const t = useT('reports');
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const staff = staffQ.data ?? [];
  const positions = [...new Set(staff.map((s) => s.position?.ru).filter((v): v is string => !!v))];
  const positionId = useId();
  const staffFieldId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div data-f="F-12-007" className="flex flex-col gap-1.5">
        <label htmlFor={positionId} className="text-sm font-medium text-fg">{t('dashboard.filterPosition')}</label>
        <Select
          id={positionId}
          value={position}
          onValueChange={onPositionChange}
          options={[{ value: '', label: t('dashboard.allValue') }, ...positions.map((p) => ({ value: p, label: p }))]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={staffFieldId} className="text-sm font-medium text-fg">{t('dashboard.filterStaff')}</label>
        <Select
          id={staffFieldId}
          value={staffId}
          onValueChange={onStaffChange}
          options={[{ value: '', label: t('dashboard.allValue') }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>
    </div>
  );
}

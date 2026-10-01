'use client';

/**
 * F-12-050…051: «По сотрудникам» — выручка, услуги/товары суммой и количеством, будущие записи (деньги),
 * отработано часов, стоимость часа, доля в выручке; стрелка у процента открывает график по дням.
 */
import { ChevronRight, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { getSalesByStaff } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useCurrent } from '@/demo/hooks';
import type { SalesByStaffRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { Sheet } from '@/ui/Sheet';
import { Table, type TableColumn } from '@/ui/Table';

export function SalesByStaffScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const range = useReportRange();
  const [openRow, setOpenRow] = useState<SalesByStaffRow | null>(null);

  const q = useApiQuery(
    ['reports', 'salesByStaff', businessId, activeLocationIds, range],
    () => getSalesByStaff({ businessId: businessId!, locationIds: activeLocationIds, range }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<SalesByStaffRow>[] = useMemo(
    () => [
      { id: 'staff', header: t('salesByStaff.columns.staff'), cell: (r) => r.staffName, mobile: 'title' },
      { id: 'revenue', header: t('salesByStaff.columns.revenue'), cell: (r) => f.money(r.revenue), align: 'right', sortable: true, sortValue: (r) => r.revenue, mobile: 'aside' },
      { id: 'services', header: t('salesByStaff.columns.services'), cell: (r) => `${f.money(r.servicesAmount)} · ${r.servicesCount}`, align: 'right' },
      { id: 'products', header: t('salesByStaff.columns.products'), cell: (r) => `${f.money(r.productsAmount)} · ${r.productsCount}`, align: 'right' },
      { id: 'future', header: <span data-f="F-12-051">{t('salesByStaff.columns.future')}</span>, cell: (r) => f.money(r.futureBookingsAmount), align: 'right' },
      { id: 'hours', header: t('salesByStaff.columns.hours'), cell: (r) => r.workedHours, align: 'right' },
      { id: 'hourCost', header: t('salesByStaff.columns.hourCost'), cell: (r) => (r.hourCost === null ? '—' : f.money(r.hourCost)), align: 'right' },
      {
        id: 'share',
        header: t('salesByStaff.columns.share'),
        cell: (r) => (
          <span className="inline-flex items-center gap-1">
            {r.revenueSharePct}%
            <IconButton icon={<ChevronRight className="size-4" />} label={t('salesByStaff.openChart')} variant="ghost" onClick={() => setOpenRow(r)} />
          </span>
        ),
        align: 'right',
      },
    ],
    [t, f],
  );

  // Пустой бизнес/период: строки сотрудников есть, но ни денег, ни услуг, ни записей вперёд — это «пусто», а не таблица нулей
  const noData = rows.every((r) => r.revenue === 0 && r.servicesCount === 0 && r.productsCount === 0 && r.futureBookingsAmount === 0);
  const exportRows = rows.map((r) => [r.staffName, r.revenue, r.servicesAmount, r.servicesCount, r.productsAmount, r.productsCount, r.futureBookingsAmount, r.workedHours, r.hourCost ?? '', r.revenueSharePct]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-050 F-08-108 F-10-147" className="flex flex-col gap-6">
        <ReportHeader
          slug="salesByStaff"
          crumbGroup="sales"
          helpBody={t('help.salesByStaff')}
          actions={
            <ExportExcelButton
              fileName="sales-by-staff.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[
                t('salesByStaff.columns.staff'),
                t('salesByStaff.columns.revenue'),
                t('dashboard.sales.services'),
                t('financeReport.columns.total'),
                t('dashboard.sales.products'),
                t('financeReport.columns.total'),
                t('salesByStaff.columns.future'),
                t('salesByStaff.columns.hours'),
                t('salesByStaff.columns.hourCost'),
                t('salesByStaff.columns.share'),
              ]}
              disabled={rows.length === 0}
            />
          }
        />

        <ReportPeriodPicker />

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && noData ? (
          <EmptyState variant="page" icon={<Users />} title={t('salesByStaff.emptyTitle')} description={t('salesByStaff.emptyText')} />
        ) : (
          <>
            <Table columns={columns} rows={rows} rowKey={(r) => r.staffId} loading={q.isLoading} label={t('catalog.items.salesByStaff.title')} />
            {q.data && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted">
                  {t('salesByStaff.grandLine', {
                    revenue: f.money(q.data.grandRevenue),
                    unassigned: f.money(q.data.unassignedRevenue ?? 0),
                    booked: f.money(q.data.grandBooked ?? 0),
                  })}
                </p>
                <p data-f="F-12-006" className="text-xs text-muted">
                  * {t('salesByStaff.moneyFootnote')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={!!openRow} onOpenChange={(v) => !v && setOpenRow(null)} title={openRow?.staffName ?? ''} side="right" size="md">
        <ChartCard title={t('salesByStaff.chartTitle')} height={220}>
          <LineChart data={openRow?.byDay ?? []}>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d: string) => f.date(d, 'dayMonth')} />
            <YAxis {...chartTheme.axis} />
            <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => f.date(String(label), 'dayMonth')} />
            <Line type="monotone" dataKey="revenue" name={t('salesByStaff.columns.revenue')} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
          </LineChart>
        </ChartCard>
      </Sheet>
    </PermissionGate>
  );
}

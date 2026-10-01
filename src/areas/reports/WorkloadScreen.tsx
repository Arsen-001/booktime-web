'use client';

/**
 * F-12-041…042: «Загруженность сотрудников» — рабочие/отработанные часы, простой, заполненность,
 * будущие записи (число); кнопка в конце строки открывает график заполненности по дням.
 */
import { BarChart3, ChevronRight, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { getWorkloadReport, setWorkloadIncluded } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useCurrent } from '@/demo/hooks';
import type { WorkloadRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { ChartCard, CHART_COLORS, chartTheme } from '@/ui/ChartCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { Sheet } from '@/ui/Sheet';
import { Switch } from '@/ui/Switch';
import { Table, type TableColumn } from '@/ui/Table';
import { Tooltip } from '@/ui/Tooltip';
import { useToast } from '@/ui/Toast';

export function WorkloadScreen() {
  const t = useT('reports');
  const f = useFormat();
  const toast = useToast();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const range = useReportRange();
  const [openStaff, setOpenStaff] = useState<WorkloadRow | null>(null);

  const q = useApiQuery(
    ['reports', 'workload', businessId, activeLocationIds, range],
    () => getWorkloadReport({ businessId: businessId!, locationIds: activeLocationIds, range }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );
  const setIncluded = useApiMutation(({ staffId, included }: { staffId: string; included: boolean }) =>
    setWorkloadIncluded(businessId!, staffId, included),
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<WorkloadRow>[] = useMemo(
    () => [
      { id: 'staff', header: t('workload.columns.staff'), cell: (r) => r.staffName, mobile: 'title' },
      { id: 'workedDays', header: t('workload.columns.workedDays'), cell: (r) => r.workedDays, align: 'right' },
      {
        id: 'scheduledHours',
        header: t('workload.columns.scheduledHours'),
        cell: (r) => (r.scheduledHours === null ? t('workload.noSchedule') : f.duration(Math.round(r.scheduledHours * 60))),
        align: 'right',
      },
      { id: 'workedHours', header: t('workload.columns.workedHours'), cell: (r) => f.duration(Math.round(r.workedHours * 60)), align: 'right', sortable: true, sortValue: (r) => r.workedHours },
      { id: 'idleHours', header: t('workload.columns.idleHours'), cell: (r) => (r.idleHours === null ? '—' : f.duration(Math.round(Math.max(0, r.idleHours) * 60))), align: 'right' },
      {
        id: 'occupancy',
        header: t('workload.columns.occupancy'),
        cell: (r) => (r.occupancyPct === null ? t('workload.noSchedule') : `${r.workedHours}/${r.scheduledHours} ${r.occupancyPct}%`),
        align: 'right',
      },
      { id: 'future', header: <span data-f="F-12-042">{t('workload.columns.future')}</span>, cell: (r) => r.futureBookings, align: 'right' },
      {
        id: 'included',
        header: <span data-f="F-12-008">{t('workload.columns.included')}</span>,
        cell: (r) => (
          <Tooltip content={t('workload.includeHint')}>
            <span>
              <Switch
                checked={r.includedInAverage}
                onCheckedChange={async (checked) => {
                  try {
                    await setIncluded.mutate({ staffId: r.staffId, included: checked });
                  } catch {
                    toast.error(t('workload.includeToggleFailed'));
                  }
                }}
                aria-label={t('workload.columns.included')}
              />
            </span>
          </Tooltip>
        ),
        align: 'right',
      },
      {
        id: 'chart',
        header: '',
        cell: (r) => (
          <IconButton icon={<ChevronRight />} label={t('workload.openChart')} variant="ghost" onClick={() => setOpenStaff(r)} />
        ),
        align: 'right',
        mobile: 'hidden',
      },
    ],
    [t, f, setIncluded, toast],
  );

  const exportRows = rows.map((r) => [r.staffName, r.workedDays, r.scheduledHours ?? '', r.workedHours, r.idleHours ?? '', r.occupancyPct ?? '', r.futureBookings]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-041 F-10-147" className="flex flex-col gap-6">
        <ReportHeader
          slug="workload"
          crumbGroup="attendance"
          helpBody={t('help.workload')}
          actions={
            <ExportExcelButton
              fileName="workload.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[
                t('workload.columns.staff'),
                t('workload.columns.workedDays'),
                t('workload.columns.scheduledHours'),
                t('workload.columns.workedHours'),
                t('workload.columns.idleHours'),
                t('workload.columns.occupancy'),
                t('workload.columns.future'),
              ]}
              disabled={rows.length === 0}
            />
          }
        />

        <ReportPeriodPicker />

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Clock />} title={t('workload.emptyTitle')} description={t('workload.emptyText')} />
        ) : (
          <>
            <Table columns={columns} rows={rows} rowKey={(r) => r.staffId} loading={q.isLoading} label={t('catalog.items.workload.title')} />
            <p className="text-sm text-muted">{t('workload.total', { worked: q.data?.totalWorkedHours ?? 0, scheduled: q.data?.totalScheduledHours ?? 0 })}</p>
          </>
        )}
      </div>

      <Sheet open={!!openStaff} onOpenChange={(v) => !v && setOpenStaff(null)} title={openStaff?.staffName ?? ''} side="right" size="md">
        <ChartCard title={t('workload.chartTitle')} height={220}>
          <LineChart data={openStaff?.byDay ?? []}>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d: string) => f.date(d, 'dayMonth')} />
            <YAxis {...chartTheme.axis} unit="%" />
            <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => f.date(String(label), 'dayMonth')} />
            <Line type="monotone" dataKey="occupancyPct" name={t('workload.columns.occupancy')} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
          </LineChart>
        </ChartCard>
        {!openStaff?.byDay.length && <EmptyState icon={<BarChart3 />} title={t('workload.emptyChart')} />}
      </Sheet>
    </PermissionGate>
  );
}

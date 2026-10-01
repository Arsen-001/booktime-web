'use client';

/**
 * F-12-053…054: «По услугам» — количество, оплаты, расходники, зарплата, прибыль, доля по каждой услуге.
 * ⭐ «Допродано» (решение владельца 01.10.2026): сколько раз и на какую сумму услугу добавили к визиту как сопутствующую.
 * F-09-090 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md 2026-09-26):
 * колонка «ЗП сотрудников» уже строится через `getSalesByServices` → `payrollCost` (см. src/api/reports.ts) —
 * тег добавлен на заголовок колонки, прибыль (`profit`) уже = выручка − расходники − зарплата.
 */
import { ChevronRight, Scissors } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useCoreList } from '@/api/core';
import { getSalesByServices } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { setReportStaff, useReportRange, useReportStaff } from '@/areas/reports/reportPeriod';
import { useCurrent } from '@/demo/hooks';
import type { SalesByServiceRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { HelpTip } from '@/ui/onboarding/HelpTip';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Table, type TableColumn } from '@/ui/Table';

export function SalesByServicesScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const range = useReportRange();
  const staffId = useReportStaff();
  const [openRow, setOpenRow] = useState<SalesByServiceRow | null>(null);

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'salesByServices', businessId, activeLocationIds, range, staffId],
    () => getSalesByServices({ businessId: businessId!, locationIds: activeLocationIds, range, staffId: staffId || undefined }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<SalesByServiceRow>[] = useMemo(
    () => [
      { id: 'service', header: t('salesByServices.columns.service'), cell: (r) => (
          <span className="flex flex-col">
            <span>{r.serviceName}</span>
            <span className="text-xs text-muted">{r.categoryName}</span>
          </span>
        ), mobile: 'title' },
      { id: 'count', header: t('salesByServices.columns.count'), cell: (r) => r.count, align: 'right' },
      { id: 'paidMoney', header: t('salesByServices.columns.paidMoney'), cell: (r) => f.money(r.paidMoney), align: 'right', sortable: true, sortValue: (r) => r.paidMoney, mobile: 'aside' },
      {
        // ⭐ Решение владельца 01.10.2026: «Допродано» — услуга добавлена к визиту как сопутствующая (строки upsellOf)
        id: 'upsold',
        header: (
          <span className="inline-flex items-center gap-0.5">
            {t('salesByServices.columns.upsold')}
            <HelpTip label={t('salesByServices.upsoldHintLabel')}>{t('salesByServices.upsoldHint')}</HelpTip>
          </span>
        ),
        cell: (r) =>
          r.upsoldCount > 0 ? (
            <span className="inline-flex flex-col items-start md:items-end">
              <span>{f.money(r.upsoldMoney)}</span>
              <span className="text-xs text-muted">{t('salesByServices.upsoldTimes', { count: r.upsoldCount })}</span>
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
        // Без sortable: в заголовке кнопка «?» (HelpTip), а сортировка оборачивает заголовок в свою кнопку
        align: 'right',
        skeletonWidth: '8ch',
      },
      { id: 'consumables', header: <span data-f="F-12-054">{t('salesByServices.columns.consumables')}</span>, cell: (r) => f.money(r.consumablesCost), align: 'right' },
      { id: 'payroll', header: <span data-f="F-09-090">{t('salesByServices.columns.payroll')}</span>, cell: (r) => f.money(r.payrollCost), align: 'right' },
      { id: 'profit', header: t('salesByServices.columns.profit'), cell: (r) => f.money(r.profit), align: 'right', sortable: true, sortValue: (r) => r.profit },
      {
        id: 'share',
        header: t('salesByServices.columns.share'),
        cell: (r) => (
          <span className="inline-flex items-center gap-1">
            {r.revenueSharePct}%
            <IconButton icon={<ChevronRight className="size-4" />} label={t('salesByServices.openChart')} variant="ghost" onClick={() => setOpenRow(r)} />
          </span>
        ),
        align: 'right',
      },
    ],
    [t, f],
  );

  const exportRows = rows.map((r) => [r.serviceName, r.categoryName, r.count, r.paidMoney, r.upsoldCount, r.upsoldMoney, r.consumablesCost, r.payrollCost, r.profit, r.revenueSharePct]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-053 F-08-108" className="flex flex-col gap-6">
        <ReportHeader
          slug="salesByServices"
          crumbGroup="sales"
          helpBody={t('help.salesByServices')}
          actions={
            <ExportExcelButton
              fileName="sales-by-services.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[
                t('salesByServices.columns.service'),
                t('salesByServices.columns.category'),
                t('salesByServices.columns.count'),
                t('salesByServices.columns.paidMoney'),
                t('salesByServices.columns.upsoldCount'),
                t('salesByServices.columns.upsoldMoney'),
                t('salesByServices.columns.consumables'),
                t('salesByServices.columns.payroll'),
                t('salesByServices.columns.profit'),
                t('salesByServices.columns.share'),
              ]}
              disabled={rows.length === 0}
            />
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <ReportPeriodPicker />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('salesByServices.filterStaff')}
              value={staffId}
              onValueChange={setReportStaff}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Scissors />} title={t('salesByServices.emptyTitle')} description={t('salesByServices.emptyText')} />
        ) : (
          <>
            <Table columns={columns} rows={rows} rowKey={(r) => r.serviceId} loading={q.isLoading} label={t('catalog.items.salesByServices.title')} />
            {/* Отч4: графа — цена по прайсу, а не деньги в кассе; говорим, где деньги */}
            <p className="text-xs text-muted">* {t('salesByServices.footnote')}</p>
          </>
        )}
      </div>

      <Sheet open={!!openRow} onOpenChange={(v) => !v && setOpenRow(null)} title={openRow?.serviceName ?? ''} side="right" size="md">
        <ChartCard title={t('salesByServices.chartTitle')} height={220}>
          <LineChart data={openRow?.byDay ?? []}>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d: string) => f.date(d, 'dayMonth')} />
            <YAxis {...chartTheme.axis} />
            <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => f.date(String(label), 'dayMonth')} />
            <Line type="monotone" dataKey="paidMoney" name={t('salesByServices.columns.paidMoney')} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
          </LineChart>
        </ChartCard>
      </Sheet>
    </PermissionGate>
  );
}

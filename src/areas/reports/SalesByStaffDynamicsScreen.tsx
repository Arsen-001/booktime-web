'use client';

/**
 * F-12-052: «По сотрудникам в динамике» — по выбранному мастеру: услуги/записи/средний чек/товары по месяцам,
 * от заданного стартового месяца.
 */
import { LineChart as LineChartIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCoreList } from '@/api/core';
import { getSalesByStaffDynamics } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { setReportStaff, useReportStaff } from '@/areas/reports/reportPeriod';
import { useCurrent } from '@/demo/hooks';
import type { StaffDynamicsMonth } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { dayjs, today } from '@/lib/date';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function SalesByStaffDynamicsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  // Общий сотрудник раздела; пусто — Отч10: сервер отчёта сам берёт мастера с наибольшей выручкой
  // (раньше открывался первый в списке — администратор с нулями по всем месяцам)
  const staffId = useReportStaff();
  const [fromMonth, setFromMonth] = useState(dayjs(today()).subtract(5, 'month').format('YYYY-MM'));

  const q = useApiQuery(
    ['reports', 'salesByStaffDynamics', businessId, activeLocationIds, staffId, fromMonth],
    () => getSalesByStaffDynamics({ businessId: businessId!, locationIds: activeLocationIds, staffId: staffId || undefined, fromMonth }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );
  const effectiveStaffId = staffId || q.data?.staffId || '';
  const masters = (staffQ.data ?? []).filter((s) => s.role === 'master' || s.id === effectiveStaffId);

  const columns: TableColumn<StaffDynamicsMonth>[] = useMemo(
    () => [
      { id: 'month', header: t('salesByStaffDynamics.columns.month'), cell: (r) => f.date(`${r.month}-01`, 'monthYear'), mobile: 'title' },
      { id: 'services', header: t('salesByStaffDynamics.columns.services'), cell: (r) => `${f.money(r.servicesAmount)} · ${r.servicesCount}`, align: 'right' },
      { id: 'visits', header: t('salesByStaffDynamics.columns.visits'), cell: (r) => r.visits, align: 'right' },
      { id: 'avgReceipt', header: t('salesByStaffDynamics.columns.avgReceipt'), cell: (r) => f.money(r.avgReceipt), align: 'right' },
      { id: 'products', header: t('salesByStaffDynamics.columns.products'), cell: (r) => `${f.money(r.productsAmount)} · ${r.productsCount}`, align: 'right' },
    ],
    [t, f],
  );

  const rows = q.data?.months ?? [];
  const exportRows = rows.map((r) => [r.month, r.servicesAmount, r.servicesCount, r.visits, r.avgReceipt, r.productsAmount, r.productsCount]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-052 F-08-108 F-10-147" className="flex flex-col gap-6">
        <ReportHeader
          slug="salesByStaffDynamics"
          crumbGroup="sales"
          helpBody={t('help.salesByStaffDynamics')}
          actions={
            <ExportExcelButton
              fileName="sales-by-staff-dynamics.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[
                t('salesByStaffDynamics.columns.month'),
                t('dashboard.sales.services'),
                t('financeReport.columns.total'),
                t('salesByStaffDynamics.columns.visits'),
                t('salesByStaffDynamics.columns.avgReceipt'),
                t('dashboard.sales.products'),
                t('financeReport.columns.total'),
              ]}
              disabled={rows.length === 0}
            />
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs">
            <Select aria-label={t('salesByStaffDynamics.filterStaff')} value={effectiveStaffId} onValueChange={setReportStaff} options={masters.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <div className="w-full max-w-[10rem]">
            <label className="mb-1 block text-sm font-medium text-fg">{t('salesByStaffDynamics.fromMonth')}</label>
            <Input aria-label={t('salesByStaffDynamics.fromMonth')} inputMode="numeric" placeholder="2026-01" defaultValue={fromMonth} onBlur={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && setFromMonth(e.target.value)} />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && (!effectiveStaffId || rows.length === 0) ? (
          <EmptyState variant="page" icon={<LineChartIcon />} title={t('salesByStaffDynamics.emptyTitle')} description={t('salesByStaffDynamics.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.month} loading={q.isLoading} label={t('catalog.items.salesByStaffDynamics.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

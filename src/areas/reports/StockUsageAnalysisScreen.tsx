'use client';

/**
 * F-12-060: «Анализ расхода материалов» — факт (складские списания) против расчёта (техкарта × визиты).
 * F-12-060 (проверка 1): удаление визита убирает его и из факта, и из расчёта — оба считаются заново из
 * текущих данных при каждом запросе, а не накапливаются отдельным счётчиком.
 */
import { FlaskConical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getStockUsageAnalysis } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { listCategoriesFlat } from '@/api/stock';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { StockUsageAnalysisRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function StockUsageAnalysisScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;

  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -29), to: today() });
  const [categoryId, setCategoryId] = useState('');

  const categoriesQ = useApiQuery(['stock', 'categories', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });

  const q = useApiQuery(
    ['reports', 'stockUsageAnalysis', businessId, locationId, range, categoryId],
    () => getStockUsageAnalysis({ businessId: businessId!, locationId: locationId!, range, categoryId: categoryId || undefined }),
    { enabled: ready && !!businessId && !!locationId, keepPrevious: true },
  );

  const rows = q.data ?? [];

  const columns: TableColumn<StockUsageAnalysisRow>[] = useMemo(
    () => [
      { id: 'good', header: t('stockUsageAnalysis.columns.good'), cell: (r) => (
          <span className="flex flex-col">
            <span>{r.goodName}</span>
            <span className="text-xs text-muted">{r.categoryName}</span>
          </span>
        ), mobile: 'title' },
      { id: 'actualQty', header: t('stockUsageAnalysis.columns.actualQty'), cell: (r) => r.actualQty, align: 'right', mobile: 'aside' },
      { id: 'actualCost', header: t('stockUsageAnalysis.columns.actualCost'), cell: (r) => f.money(r.actualCost), align: 'right' },
      { id: 'calcQty', header: t('stockUsageAnalysis.columns.calcQty'), cell: (r) => r.calcQty, align: 'right', mobile: 'subtitle' },
      { id: 'calcCost', header: t('stockUsageAnalysis.columns.calcCost'), cell: (r) => f.money(r.calcCost), align: 'right' },
      {
        id: 'diffQty',
        header: t('stockUsageAnalysis.columns.diffQty'),
        cell: (r) => <span className={r.diffQty > 0 ? 'font-semibold text-error' : undefined}>{r.diffQty}</span>,
        align: 'right',
        sortable: true,
        sortValue: (r) => r.diffQty,
        mobile: 'meta',
      },
      { id: 'diffCost', header: t('stockUsageAnalysis.columns.diffCost'), cell: (r) => f.money(r.diffCost), align: 'right' },
    ],
    [t, f],
  );

  return (
    <PermissionGate permission="stock.view" fallback="message">
      <div data-f="F-12-060" className="flex flex-col gap-6">
        <ReportHeader slug="stockUsageAnalysis" crumbGroup="stock" helpBody={t('help.stockUsageAnalysis')} />

        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker value={range} onValueChange={(r) => setRange({ from: r.from ?? range.from, to: r.to ?? range.to })} presets />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('stockBalance.filterCategory')}
              value={categoryId}
              onValueChange={setCategoryId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<FlaskConical />} title={t('stockUsageAnalysis.emptyTitle')} description={t('stockUsageAnalysis.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} loading={q.isLoading} label={t('catalog.items.stockUsageAnalysis.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

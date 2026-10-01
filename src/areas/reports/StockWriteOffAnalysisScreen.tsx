'use client';

/**
 * F-12-061: «Анализ списания товаров» — движение за период: было, пришло, ушло, осталось.
 */
import { Archive } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getStockWriteOffReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { listCategoriesFlat, listWarehouses } from '@/api/stock';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { StockUnitMode, StockWriteOffRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { Checkbox } from '@/ui/Checkbox';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function StockWriteOffAnalysisScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;

  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -29), to: today() });
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitMode, setUnitMode] = useState<StockUnitMode>('sale');
  const [countMoves, setCountMoves] = useState(false);

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });
  const categoriesQ = useApiQuery(['stock', 'categories', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });

  const q = useApiQuery(
    ['reports', 'stockWriteOff', businessId, locationId, range, warehouseId, categoryId, unitMode, countMoves],
    () =>
      getStockWriteOffReport({
        businessId: businessId!,
        locationId: locationId!,
        filters: { range, warehouseId: warehouseId || undefined, categoryId: categoryId || undefined, unitMode, countMoves },
      }),
    { enabled: ready && !!businessId && !!locationId, keepPrevious: true },
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<StockWriteOffRow>[] = useMemo(
    () => [
      { id: 'good', header: t('stockWriteOffAnalysis.columns.good'), cell: (r) => r.goodName, mobile: 'title' },
      { id: 'start', header: t('stockWriteOffAnalysis.columns.start'), cell: (r) => `${r.startQty} / ${f.money(r.startValue)}`, align: 'right', mobile: 'aside' },
      { id: 'in', header: t('stockWriteOffAnalysis.columns.in'), cell: (r) => `${r.inQty} / ${f.money(r.inValue)}`, align: 'right' },
      { id: 'out', header: t('stockWriteOffAnalysis.columns.out'), cell: (r) => `${r.outQty} / ${f.money(r.outValue)}`, align: 'right', mobile: 'subtitle' },
      { id: 'end', header: t('stockWriteOffAnalysis.columns.end'), cell: (r) => `${r.endQty} / ${f.money(r.endValue)}`, align: 'right', sortable: true, sortValue: (r) => r.endValue, mobile: 'meta' },
    ],
    [t, f],
  );

  const exportRows = rows.map((r) => [r.sku ?? '', r.goodName, r.startQty, r.startValue, r.inQty, r.inValue, r.outQty, r.outValue, r.endQty, r.endValue]);

  return (
    <PermissionGate permission="stock.view" fallback="message">
      <div data-f="F-12-061" className="flex flex-col gap-6">
        <ReportHeader
          slug="stockWriteOffAnalysis"
          crumbGroup="stock"
          helpBody={t('help.stockWriteOffAnalysis')}
          actions={
            <ExportExcelButton
              fileName="stock-write-off-analysis.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[t('stockWriteOffAnalysis.columns.sku'), t('stockWriteOffAnalysis.columns.good'), 'startQty', 'startValue', 'inQty', 'inValue', 'outQty', 'outValue', 'endQty', 'endValue']}
              disabled={rows.length === 0}
            />
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker value={range} onValueChange={(r) => setRange({ from: r.from ?? range.from, to: r.to ?? range.to })} presets />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('stockBalance.filterWarehouse')}
              value={warehouseId}
              onValueChange={setWarehouseId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(warehousesQ.data ?? []).map((w) => ({ value: w.id, label: w.name }))]}
            />
          </div>
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('stockBalance.filterCategory')}
              value={categoryId}
              onValueChange={setCategoryId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('stockWriteOffAnalysis.unitMode')}
              value={unitMode}
              onValueChange={(v) => setUnitMode(v as StockUnitMode)}
              options={[
                { value: 'sale', label: t('stockWriteOffAnalysis.unit.sale') },
                { value: 'writeoff', label: t('stockWriteOffAnalysis.unit.writeoff') },
              ]}
            />
          </div>
          <Checkbox checked={countMoves} onCheckedChange={setCountMoves} label={t('stockWriteOffAnalysis.countMoves')} />
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Archive />} title={t('stockWriteOffAnalysis.emptyTitle')} description={t('stockWriteOffAnalysis.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} loading={q.isLoading} label={t('catalog.items.stockWriteOffAnalysis.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

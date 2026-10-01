'use client';

/**
 * F-12-062: «Анализ оборачиваемости» — как быстро продаётся запас и на сколько дней его хватит.
 * F-12-113: багфикс Altegio НЕ повторяем — у товаров с отрицательным/нулевым остатком (проданный
 * абонемент и т.п.) дни оборачиваемости не уходят в минус, показываем «—».
 */
import { Gauge } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getStockTurnoverReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { listCategoriesFlat, listWarehouses } from '@/api/stock';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { StockTurnoverRow } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function StockTurnoverScreen() {
  const t = useT('reports');
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;

  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -29), to: today() });
  const [categoryId, setCategoryId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const categoriesQ = useApiQuery(['stock', 'categories', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });
  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });

  const q = useApiQuery(
    ['reports', 'stockTurnover', businessId, locationId, range, categoryId, warehouseId],
    () => getStockTurnoverReport({ businessId: businessId!, locationId: locationId!, range, categoryId: categoryId || undefined, warehouseId: warehouseId || undefined }),
    { enabled: ready && !!businessId && !!locationId, keepPrevious: true },
  );

  const rows = q.data ?? [];

  const columns: TableColumn<StockTurnoverRow>[] = useMemo(
    () => [
      { id: 'good', header: t('stockTurnover.columns.good'), cell: (r) => r.goodName, mobile: 'title' },
      { id: 'qtyIn', header: t('stockTurnover.columns.qtyIn'), cell: (r) => r.qtyIn, align: 'right' },
      { id: 'start', header: t('stockTurnover.columns.start'), cell: (r) => r.startQty, align: 'right', mobile: 'hidden' },
      { id: 'end', header: t('stockTurnover.columns.end'), cell: (r) => r.endQty, align: 'right', mobile: 'aside' },
      { id: 'sold', header: t('stockTurnover.columns.sold'), cell: (r) => r.soldQty, align: 'right' },
      { id: 'avgStock', header: t('stockTurnover.columns.avgStock'), cell: (r) => r.avgStock, align: 'right', mobile: 'subtitle' },
      {
        id: 'turnoverDays',
        header: <span data-f="F-12-113 F-12-062">{t('stockTurnover.columns.turnoverDays')}</span>,
        cell: (r) => (r.turnoverDays === null ? '—' : t('stockTurnover.days', { n: r.turnoverDays })),
        align: 'right',
        mobile: 'meta',
      },
      { id: 'turnoverTimes', header: t('stockTurnover.columns.turnoverTimes'), cell: (r) => (r.turnoverTimes === null ? '—' : r.turnoverTimes) },
      { id: 'stockLevel', header: t('stockTurnover.columns.stockLevel'), cell: (r) => (r.stockLevelDays === null ? '—' : t('stockTurnover.days', { n: r.stockLevelDays })), align: 'right' },
    ],
    [t],
  );

  const exportRows = rows.map((r) => [r.sku ?? '', r.goodName, r.qtyIn, r.startQty, r.endQty, r.soldQty, r.avgStock, r.turnoverDays ?? '', r.turnoverTimes ?? '', r.stockLevelDays ?? '']);

  return (
    <PermissionGate permission="stock.view" fallback="message">
      <div data-f="F-12-062" className="flex flex-col gap-6">
        <ReportHeader
          slug="stockTurnover"
          crumbGroup="stock"
          helpBody={t('help.stockTurnover')}
          actions={
            <ExportExcelButton
              fileName="stock-turnover.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[t('stockTurnover.columns.sku'), t('stockTurnover.columns.good'), t('stockTurnover.columns.qtyIn'), t('stockTurnover.columns.start'), t('stockTurnover.columns.end'), t('stockTurnover.columns.sold'), t('stockTurnover.columns.avgStock'), t('stockTurnover.columns.turnoverDays'), t('stockTurnover.columns.turnoverTimes'), t('stockTurnover.columns.stockLevel')]}
              disabled={rows.length === 0}
            />
          }
        />

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
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('stockBalance.filterWarehouse')}
              value={warehouseId}
              onValueChange={setWarehouseId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(warehousesQ.data ?? []).map((w) => ({ value: w.id, label: w.name }))]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Gauge />} title={t('stockTurnover.emptyTitle')} description={t('stockTurnover.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} loading={q.isLoading} label={t('catalog.items.stockTurnover.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

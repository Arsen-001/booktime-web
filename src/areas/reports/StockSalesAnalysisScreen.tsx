'use client';

/**
 * F-12-059: «Анализ продаж товаров» — что продаётся и с какой наценкой.
 * F-12-059 (проверка 2): «Себестоимость» — сумма за ВСЕ проданные единицы строки, не за одну.
 */
import { ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getStockSalesAnalysis } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { useCoreList } from '@/api/core';
import { listCategoriesFlat } from '@/api/stock';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { StockSalesAnalysisRow } from '@/domain/reports';
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

export function StockSalesAnalysisScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;

  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -29), to: today() });
  const [categoryId, setCategoryId] = useState('');
  const [staffId, setStaffId] = useState('');

  const categoriesQ = useApiQuery(['stock', 'categories', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'stockSalesAnalysis', businessId, locationId, range, categoryId, staffId],
    () => getStockSalesAnalysis({ businessId: businessId!, locationId: locationId!, range, categoryId: categoryId || undefined, staffId: staffId || undefined }),
    { enabled: ready && !!businessId && !!locationId, keepPrevious: true },
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<StockSalesAnalysisRow>[] = useMemo(
    () => [
      { id: 'good', header: t('stockSalesAnalysis.columns.good'), cell: (r) => (
          <span className="flex flex-col">
            <span>{r.goodName}</span>
            <span className="text-xs text-muted">{r.categoryName}</span>
          </span>
        ), mobile: 'title' },
      { id: 'qty', header: t('stockSalesAnalysis.columns.qty'), cell: (r) => r.qty, align: 'right', mobile: 'aside' },
      { id: 'cost', header: <span data-f="F-12-059">{t('stockSalesAnalysis.columns.cost')}</span>, cell: (r) => f.money(r.costTotal), align: 'right' },
      { id: 'markup', header: t('stockSalesAnalysis.columns.markup'), cell: (r) => f.money(r.markup), align: 'right' },
      { id: 'markupPct', header: t('stockSalesAnalysis.columns.markupPct'), cell: (r) => `${r.markupPct}%`, align: 'right' },
      { id: 'totalValue', header: t('stockSalesAnalysis.columns.totalValue'), cell: (r) => f.money(r.totalValue), align: 'right', sortable: true, sortValue: (r) => r.totalValue, mobile: 'meta' },
    ],
    [t, f],
  );

  const exportRows = rows.map((r) => [r.sku ?? '', r.barcode ?? '', r.goodName, r.qty, r.costTotal, r.markup, r.markupPct, r.totalValue]);

  return (
    <PermissionGate permission="stock.view" fallback="message">
      <div data-f="F-12-059" className="flex flex-col gap-6">
        <ReportHeader
          slug="stockSalesAnalysis"
          crumbGroup="stock"
          helpBody={t('help.stockSalesAnalysis')}
          actions={
            <ExportExcelButton
              fileName="stock-sales-analysis.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[t('stockSalesAnalysis.columns.sku'), t('stockSalesAnalysis.columns.barcode'), t('stockSalesAnalysis.columns.good'), t('stockSalesAnalysis.columns.qty'), t('stockSalesAnalysis.columns.cost'), t('stockSalesAnalysis.columns.markup'), t('stockSalesAnalysis.columns.markupPct'), t('stockSalesAnalysis.columns.totalValue')]}
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
              aria-label={t('salesByServices.filterStaff')}
              value={staffId}
              onValueChange={setStaffId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<ShoppingBag />} title={t('stockSalesAnalysis.emptyTitle')} description={t('stockSalesAnalysis.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} loading={q.isLoading} label={t('catalog.items.stockSalesAnalysis.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

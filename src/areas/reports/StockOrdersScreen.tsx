'use client';

/**
 * F-12-058: «Заказ товаров» — товары ниже желаемого остатка с недостатком до желаемого (⭐ F-00-137).
 */
import { PackageSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getStockOrderReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { listCategoriesFlat } from '@/api/stock';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { StockOrderRow } from '@/domain/reports';
import { unitById } from '@/domain/stock';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function StockOrdersScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;

  const [categoryId, setCategoryId] = useState('');
  const [onlyCritical, setOnlyCritical] = useState(false);

  const categoriesQ = useApiQuery(['stock', 'categories', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled: Boolean(businessId) && Boolean(locationId) });

  const q = useApiQuery(
    ['reports', 'stockOrders', businessId, locationId, categoryId, onlyCritical],
    () => getStockOrderReport({ businessId: businessId!, locationId: locationId!, categoryId: categoryId || undefined, onlyCritical }),
    { enabled: ready && !!businessId && !!locationId, keepPrevious: true },
  );

  const rows = q.data ?? [];

  const columns: TableColumn<StockOrderRow>[] = useMemo(
    () => [
      { id: 'good', header: t('stockOrders.columns.good'), cell: (r) => (
          <span className="flex flex-col">
            <span>{r.goodName}</span>
            <span className="text-xs text-muted">{r.categoryName}</span>
          </span>
        ), mobile: 'title' },
      { id: 'stock', header: t('stockOrders.columns.stock'), cell: (r) => `${f.number(r.stock)} ${unitById(r.unit).short.ru}`, align: 'right', mobile: 'aside' },
      { id: 'critical', header: t('stockOrders.columns.critical'), cell: (r) => f.number(r.criticalStock), align: 'right', mobile: 'hidden' },
      { id: 'desired', header: t('stockOrders.columns.desired'), cell: (r) => f.number(r.desiredStock), align: 'right', mobile: 'subtitle' },
      { id: 'shortage', header: t('stockOrders.columns.shortage'), cell: (r) => `${f.number(r.shortage)} ${unitById(r.unit).short.ru}`, align: 'right', sortable: true, sortValue: (r) => r.shortage, mobile: 'meta' },
    ],
    [t, f],
  );

  const exportRows = rows.map((r) => [r.sku ?? '', r.goodName, r.categoryName, r.stock, r.criticalStock, r.desiredStock, r.shortage]);

  return (
    <PermissionGate permission="stock.view" fallback="message">
      <div data-f="F-12-058" className="flex flex-col gap-6">
        <ReportHeader
          slug="stockOrders"
          crumbGroup="stock"
          helpBody={t('help.stockOrders')}
          actions={
            <ExportExcelButton
              fileName="stock-orders.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[t('stockOrders.columns.sku'), t('stockOrders.columns.good'), t('stockOrders.columns.category'), t('stockOrders.columns.stock'), t('stockOrders.columns.critical'), t('stockOrders.columns.desired'), t('stockOrders.columns.shortage')]}
              disabled={rows.length === 0}
            />
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('stockBalance.filterCategory')}
              value={categoryId}
              onValueChange={setCategoryId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <Checkbox checked={onlyCritical} onCheckedChange={setOnlyCritical} label={t('stockOrders.onlyCritical')} />
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<PackageSearch />} title={t('stockOrders.emptyTitle')} description={t('stockOrders.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} loading={q.isLoading} label={t('catalog.items.stockOrders.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

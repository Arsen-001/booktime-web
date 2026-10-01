'use client';

/**
 * F-12-057: «Остатки на складах» — что лежит, по какой себестоимости и сколько денег в запасе.
 * F-12-120: себестоимость на дату — costPriceAt() (последний приход на/до эту дату); без права
 * viewCost колонки себестоимости/наценки/суммы скрыты целиком (F-12-057 «проверка 1»).
 */
import { Boxes } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getStockBalanceReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { listCategoriesFlat, listWarehouses } from '@/api/stock';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';
import { useCurrent } from '@/demo/hooks';
import type { StockBalanceRow } from '@/domain/reports';
import { unitById } from '@/domain/stock';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function StockBalanceScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const perms = useStockPermissions();

  const [atDate, setAtDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [zeroFilter, setZeroFilter] = useState<'all' | 'onlyZero' | 'withoutZero'>('all');
  const [search, setSearch] = useState('');

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), {
    enabled: Boolean(businessId) && Boolean(locationId),
  });
  const categoriesQ = useApiQuery(['stock', 'categories', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), {
    enabled: Boolean(businessId) && Boolean(locationId),
  });
  // F-12-088 (проверка 1): сотрудник с доступом только к складу расходников видит в отчёте только его
  const allowedWarehouses = (warehousesQ.data ?? []).filter((w) => perms.warehouseAccess === 'all' || perms.warehouseAccess.includes(w.id));

  const canViewCost = perms.viewCost;
  const allowedWarehouseIds = perms.warehouseAccess === 'all' ? undefined : perms.warehouseAccess;
  const q = useApiQuery(
    [
      'reports',
      'stockBalance',
      businessId,
      locationId,
      atDate,
      warehouseId,
      categoryId,
      onlyCritical,
      zeroFilter,
      search,
      canViewCost,
      allowedWarehouseIds,
    ],
    () =>
      getStockBalanceReport({
        businessId: businessId!,
        locationId: locationId!,
        canViewCost,
        allowedWarehouseIds,
        filters: {
          atDate,
          warehouseId: warehouseId || undefined,
          categoryId: categoryId || undefined,
          onlyCritical,
          zeroFilter,
          search: search || undefined,
        },
      }),
    { enabled: ready && !!businessId && !!locationId, keepPrevious: true },
  );

  const rows = q.data ?? [];

  const columns: TableColumn<StockBalanceRow>[] = useMemo(() => {
    const base: TableColumn<StockBalanceRow>[] = [
      {
        id: 'good',
        header: t('stockBalance.columns.good'),
        cell: (r) => (
          <span className="flex flex-col">
            <span>{r.goodName}</span>
            <span className="text-xs text-muted">{r.categoryName}</span>
          </span>
        ),
        mobile: 'title',
      },
      { id: 'sku', header: t('stockBalance.columns.sku'), cell: (r) => r.sku ?? '—', mobile: 'hidden' },
      {
        id: 'qty',
        header: t('stockBalance.columns.qty'),
        cell: (r) => `${f.number(r.qtySale)} ${unitById(r.saleUnit).short.ru}`,
        align: 'right',
        mobile: 'aside',
      },
      {
        id: 'qtyWriteoff',
        header: t('stockBalance.columns.qtyWriteoff'),
        cell: (r) => `${f.number(r.qtyWriteoff)} ${unitById(r.writeoffUnit).short.ru}`,
        align: 'right',
        mobile: 'subtitle',
      },
      { id: 'price', header: t('stockBalance.columns.price'), cell: (r) => f.money(r.price), align: 'right' },
      {
        id: 'totalValue',
        header: t('stockBalance.columns.totalValue'),
        cell: (r) => f.money(r.totalValue),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.totalValue,
        mobile: 'meta',
      },
    ];
    if (canViewCost) {
      base.splice(
        4,
        0,
        { id: 'cost', header: t('stockBalance.columns.cost'), cell: (r) => f.money(r.costPrice ?? 0), align: 'right' },
        { id: 'markup', header: t('stockBalance.columns.markup'), cell: (r) => f.money(r.markup ?? 0), align: 'right' },
        { id: 'markupPct', header: t('stockBalance.columns.markupPct'), cell: (r) => `${r.markupPct ?? 0}%`, align: 'right' },
        {
          id: 'totalCost',
          header: <span data-f="F-12-120">{t('stockBalance.columns.totalCost')}</span>,
          cell: (r) => f.money(r.totalCost ?? 0),
          align: 'right',
        },
      );
    }
    return base;
  }, [t, f, canViewCost]);

  const exportRows = rows.map((r) => [
    r.sku ?? '',
    r.goodName,
    r.categoryName,
    r.qtySale,
    r.qtyWriteoff,
    ...(canViewCost ? [r.costPrice ?? 0, r.markup ?? 0, r.markupPct ?? 0] : []),
    r.price,
    ...(canViewCost ? [r.totalCost ?? 0] : []),
    r.totalValue,
  ]);
  const exportHeaders = [
    t('stockBalance.columns.sku'),
    t('stockBalance.columns.good'),
    t('stockBalance.columns.category'),
    t('stockBalance.columns.qty'),
    t('stockBalance.columns.qtyWriteoff'),
    ...(canViewCost ? [t('stockBalance.columns.cost'), t('stockBalance.columns.markup'), t('stockBalance.columns.markupPct')] : []),
    t('stockBalance.columns.price'),
    ...(canViewCost ? [t('stockBalance.columns.totalCost')] : []),
    t('stockBalance.columns.totalValue'),
  ];

  return (
    <PermissionGate permission="stock.view" fallback="message">
      <div data-f="F-12-057" className="flex flex-col gap-6">
        <ReportHeader
          slug="stockBalance"
          crumbGroup="stock"
          helpBody={t('help.stockBalance')}
          actions={
            <ExportExcelButton
              fileName="stock-balance.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={exportHeaders}
              disabled={rows.length === 0}
            />
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <DatePicker value={atDate} onValueChange={(d) => d && setAtDate(d)} />
          <div data-f="F-12-088 F-08-115" className="w-full max-w-xs">
            <Select
              aria-label={t('stockBalance.filterWarehouse')}
              value={warehouseId}
              onValueChange={setWarehouseId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...allowedWarehouses.map((w) => ({ value: w.id, label: w.name }))]}
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
              aria-label={t('stockBalance.filterZero')}
              value={zeroFilter}
              onValueChange={(v) => setZeroFilter(v as typeof zeroFilter)}
              options={[
                { value: 'all', label: t('stockBalance.zero.all') },
                { value: 'onlyZero', label: t('stockBalance.zero.onlyZero') },
                { value: 'withoutZero', label: t('stockBalance.zero.withoutZero') },
              ]}
            />
          </div>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('stockBalance.search')} className="max-w-xs" />
          <Checkbox checked={onlyCritical} onCheckedChange={setOnlyCritical} label={t('stockBalance.onlyCritical')} />
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Boxes />} title={t('stockBalance.emptyTitle')} description={t('stockBalance.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} loading={q.isLoading} label={t('catalog.items.stockBalance.title')} />
        )}
      </div>
    </PermissionGate>
  );
}

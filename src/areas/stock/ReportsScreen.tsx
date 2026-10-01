'use client';

/**
 * /biz/stock/reports — «Отчёты» (F-08-001, F-08-101): переключатель «Отчёты ▾» между шестью отчётами
 * склада (F-08-102…107) — «Заказ товаров» ведёт на отдельный экран /biz/stock/order (⭐ F-00-137, WhatsApp).
 * У каждого отчёта — своя выгрузка в Excel (кроме «Заказа», у него своя кнопка на своём экране).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Boxes, CalendarClock, Download, Wallet } from 'lucide-react';
import {
  getConsumablesAnalysis,
  getMovementReport,
  listGoods,
  listOperations,
  type ConsumablesAnalysisRow,
  type GoodRow,
  type MovementReportRow,
  type OperationRow,
} from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { expiryFlag } from '@/domain/stock';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { downloadCsv, toCsv } from '@/lib/csv';
import { addDays, today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { type DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { ErrorState } from '@/ui/ErrorState';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';
import { formatQty, useUnitShort } from '@/areas/stock/warehouse.utils';

type ReportKind = 'remnants' | 'movement' | 'order' | 'sales' | 'consumables' | 'writeoffs' | 'turnover';
const NEEDS_PERIOD: ReportKind[] = ['movement', 'sales', 'consumables', 'writeoffs', 'turnover'];
/** Отчёты на строках журнала операций; «движение» и «расход против нормы» считают своё на сервере */
const NEEDS_OPS: ReportKind[] = ['sales', 'writeoffs', 'turnover'];

export function ReportsScreen() {
  const t = useT('stock');
  const router = useRouter();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [kind, setKind] = useState<ReportKind>('remnants');
  const [range, setRange] = useState<DateRange>({ from: addDays(today(), -30), to: today() });

  const goodsQ = useApiQuery(['stock', 'goods', businessId, locationId, 'reports'], () => listGoods(businessId!, locationId!, { pageSize: 1000 }), { enabled });
  const opsEnabled = enabled && NEEDS_OPS.includes(kind);
  const opsQ = useApiQuery(
    ['stock', 'operations', businessId, locationId, 'reports', range.from, range.to],
    () => listOperations(businessId!, locationId!, { dateFrom: range.from, dateTo: range.to, pageSize: 100000 }),
    { enabled: opsEnabled },
  );

  const kindOptions = [
    { value: 'remnants', label: t('reports.switcher.remnants') },
    { value: 'movement', label: t('reports.switcher.movement') },
    { value: 'order', label: t('reports.switcher.order') },
    { value: 'sales', label: t('reports.switcher.sales') },
    { value: 'consumables', label: t('reports.switcher.consumables') },
    { value: 'writeoffs', label: t('reports.switcher.writeoffs') },
    { value: 'turnover', label: t('reports.switcher.turnover') },
  ];

  if (goodsQ.isError) return <ErrorState onRetry={goodsQ.refetch} />;
  if (opsEnabled && opsQ.isError) return <ErrorState onRetry={opsQ.refetch} />;

  const items = goodsQ.data?.items ?? [];
  const ops = opsQ.data?.items ?? [];
  const loading = goodsQ.isLoading || (opsEnabled && opsQ.isLoading);

  return (
    <div data-f="F-08-001 F-08-101" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={<HelpArticleButton titleKey="help.reports.title" bodyKey="help.reports.body" />}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Select
            aria-label={t('reports.switcher.label')}
            value={kind}
            onValueChange={(v) => {
              const next = v as ReportKind;
              if (next === 'order') router.push('/biz/stock/order');
              else setKind(next);
            }}
            options={kindOptions}
          />
        </div>
        {NEEDS_PERIOD.includes(kind) && (
          <div className="w-full max-w-xs">
            <DateRangePicker value={range} onValueChange={setRange} presets placeholder={t('reports.period')} />
          </div>
        )}
      </div>

      {loading && kind === 'remnants' ? (
        <RemnantsReport items={[]} loading />
      ) : loading ? (
        <Skeleton lines={5} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Boxes aria-hidden />} title={t('reports.emptyTitle')} description={t('reports.emptyText')} />
      ) : kind === 'remnants' ? (
        <RemnantsReport items={items} />
      ) : kind === 'movement' ? (
        <MovementReport businessId={businessId!} locationId={locationId!} from={range.from ?? today()} to={range.to ?? today()} />
      ) : kind === 'sales' ? (
        <SalesReport ops={ops.filter((o) => o.type === 'sale')} />
      ) : kind === 'consumables' ? (
        <ConsumablesReport businessId={businessId!} locationId={locationId!} from={range.from ?? today()} to={range.to ?? today()} />
      ) : kind === 'writeoffs' ? (
        <WriteoffsReport ops={ops.filter((o) => o.type === 'writeoffProduct')} incomeOps={ops.filter((o) => o.type === 'income')} />
      ) : kind === 'turnover' ? (
        <TurnoverReport items={items} sales={ops.filter((o) => o.type === 'sale')} incomes={ops.filter((o) => o.type === 'income')} rangeDays={rangeDays(range)} />
      ) : null}
    </div>
  );
}

function rangeDays(range: DateRange): number {
  if (!range.from || !range.to) return 30;
  return Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000) + 1);
}

function ExportButton({ onExport, disabled }: { onExport: () => void; disabled?: boolean }) {
  const t = useT('stock');
  return (
    <Button variant="secondary" size="sm" leftIcon={<Download aria-hidden />} onClick={onExport} disabled={disabled} className="self-start">
      {t('reports.exportExcel')}
    </Button>
  );
}

// ─────────────────────────── F-08-102: Остатки на складах ───────────────────────────

/** Текст ячейки в одну строку в пределах колонки: высота строки и ширина колонки не зависят от данных */
function Clip({ children, className }: { children: ReactNode; className: string }) {
  return <span className={cn('block truncate', className)}>{children}</span>;
}

function RemnantsReport({ items, loading = false }: { items: GoodRow[]; loading?: boolean }) {
  const t = useT('stock');
  const format = useFormat();
  const now = today();
  const stockValue = items.reduce((sum, g) => sum + g.totalStock * g.costPrice, 0);
  const belowCritical = items.filter((g) => g.belowCritical);
  const expiring = items.filter((g) => expiryFlag(g.expiryDate, now) === 'expiring');
  const expired = items.filter((g) => expiryFlag(g.expiryDate, now) === 'expired');

  const rows = items.map((g) => {
    const totalCost = g.totalStock * g.costPrice;
    const totalValue = g.totalStock * g.salePrice;
    const markup = g.salePrice - g.costPrice;
    const markupPercent = g.costPrice > 0 ? (markup / g.costPrice) * 100 : 0;
    return { ...g, totalCost, totalValue, markup, markupPercent };
  });

  const columns: TableColumn<(typeof rows)[number]>[] = [
    { id: 'sku', header: t('reports.remnants.columns.sku'), mobile: 'meta', width: '9rem', cell: (g) => <Clip className="max-w-[7rem]">{g.sku ?? '—'}</Clip> },
    { id: 'name', header: t('reports.remnants.columns.name'), mobile: 'title', width: '14rem', cell: (g) => <Clip className="max-w-[12rem]">{g.name}</Clip> },
    { id: 'category', header: t('reports.remnants.columns.category'), mobile: 'subtitle', width: '12rem', cell: (g) => <Clip className="max-w-[10rem]">{g.categoryName}</Clip> },
    { id: 'stock', header: t('reports.remnants.columns.stock'), mobile: 'aside', align: 'right', width: '7.5rem', sortable: true, sortValue: (g) => g.totalStock, cell: (g) => formatQty(g.totalStock) },
    { id: 'stockWriteoff', header: t('reports.remnants.columns.stockWriteoff'), align: 'right', width: '12rem', cell: (g) => formatQty(g.totalStock * g.unitRatio) },
    { id: 'cost', header: t('reports.remnants.columns.cost'), align: 'right', width: '9.5rem', cell: (g) => format.money(g.costPrice) },
    { id: 'markup', header: t('reports.remnants.columns.markup'), align: 'right', width: '7.5rem', cell: (g) => format.money(g.markup) },
    { id: 'markupPercent', header: t('reports.remnants.columns.markupPercent'), align: 'right', width: '7.5rem', cell: (g) => `${format.number(Math.round(g.markupPercent))}%` },
    { id: 'price', header: t('reports.remnants.columns.price'), align: 'right', width: '8rem', cell: (g) => format.money(g.salePrice) },
    { id: 'totalCost', header: t('reports.remnants.columns.totalCost'), align: 'right', width: '12rem', sortable: true, sortValue: (g) => g.totalCost, cell: (g) => format.money(g.totalCost) },
    { id: 'totalValue', header: t('reports.remnants.columns.totalValue'), align: 'right', width: '12rem', sortable: true, sortValue: (g) => g.totalValue, cell: (g) => format.money(g.totalValue) },
  ];

  const exportExcel = () => {
    const csv = toCsv(
      rows.map((g) => [g.sku ?? '', g.name, g.categoryName, g.totalStock, g.totalStock * g.unitRatio, g.costPrice, g.markup, Math.round(g.markupPercent), g.salePrice, g.totalCost, g.totalValue]),
      [
        t('reports.remnants.columns.sku'), t('reports.remnants.columns.name'), t('reports.remnants.columns.category'), t('reports.remnants.columns.stock'),
        t('reports.remnants.columns.stockWriteoff'), t('reports.remnants.columns.cost'), t('reports.remnants.columns.markup'), t('reports.remnants.columns.markupPercent'),
        t('reports.remnants.columns.price'), t('reports.remnants.columns.totalCost'), t('reports.remnants.columns.totalValue'),
      ],
    );
    downloadCsv('stock-remnants.csv', csv);
  };

  return (
    <div data-f="F-08-102" className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Wallet aria-hidden className="size-4" />} label={t('reports.stat.value')} value={format.money(stockValue)} loading={loading} />
        <StatCard icon={<AlertTriangle aria-hidden className="size-4" />} label={t('reports.stat.belowCritical')} value={belowCritical.length} tone="danger" loading={loading} />
        <StatCard icon={<CalendarClock aria-hidden className="size-4" />} label={t('reports.stat.expiring')} value={expiring.length} tone="warning" loading={loading} />
        <StatCard icon={<CalendarClock aria-hidden className="size-4" />} label={t('reports.stat.expired')} value={expired.length} tone="danger" loading={loading} />
      </div>
      <ExportButton onExport={exportExcel} disabled={loading} />
      <Table columns={columns} rows={rows} rowKey={(g) => g.id} label={t('reports.switcher.remnants')} loading={loading} loadingRows={6} />
    </div>
  );
}

function StatCard({ icon, label, value, tone, loading = false }: { icon: ReactNode; label: string; value: number | string; tone?: 'danger' | 'warning'; loading?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="flex items-center gap-2 text-xs text-muted">
        {icon} {label}
      </span>
      {/* h-7 — под плашку с числом: карточка с плашкой, с текстом и скелетоном одной высоты */}
      <span className="flex h-7 items-center text-xl font-semibold text-fg">
        {loading ? <SkeletonText width={tone ? '2ch' : '9ch'} /> : tone && typeof value === 'number' && value > 0 ? <Badge tone={tone}>{value}</Badge> : value}
      </span>
    </div>
  );
}

// ─────────────────────────── F-08-104: Анализ продаж товаров ───────────────────────────

function SalesReport({ ops }: { ops: OperationRow[] }) {
  const t = useT('stock');
  const format = useFormat();

  // Ск14: у продажи costTotal — это ВЫРУЧКА (сумма чека), себестоимость — отдельное поле costValue
  const rows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number; revenue: number; cost: number }>();
    ops.forEach((op) => {
      const entry = map.get(op.goodId) ?? { id: op.goodId, name: op.goodName, qty: 0, revenue: 0, cost: 0 };
      entry.qty += Math.abs(op.qtySale);
      entry.revenue += Math.abs(op.costTotal);
      entry.cost += op.costValue;
      map.set(op.goodId, entry);
    });
    return Array.from(map.values()).map((r) => ({ ...r, markup: r.revenue - r.cost, markupPct: r.cost > 0 ? ((r.revenue - r.cost) / r.cost) * 100 : undefined }));
  }, [ops]);

  if (rows.length === 0) return <EmptyState icon={<Boxes aria-hidden />} title={t('reports.noRows')} />;

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const pct = (v: number | undefined) => (v === undefined ? '—' : `${format.number(Math.round(v))}%`);

  const columns: TableColumn<(typeof rows)[number]>[] = [
    { id: 'name', header: t('reports.sales.columns.name'), mobile: 'title', cell: (r) => r.name },
    { id: 'qty', header: t('reports.sales.columns.qty'), mobile: 'meta', align: 'right', sortable: true, sortValue: (r) => r.qty, cell: (r) => formatQty(r.qty) },
    { id: 'revenue', header: t('reports.sales.columns.revenue'), mobile: 'aside', align: 'right', sortable: true, sortValue: (r) => r.revenue, cell: (r) => format.money(r.revenue) },
    { id: 'cost', header: t('reports.sales.columns.cost'), align: 'right', sortable: true, sortValue: (r) => r.cost, cell: (r) => format.money(r.cost) },
    {
      id: 'markup',
      header: t('reports.sales.columns.markup'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.markup,
      cell: (r) => <span className={cn(r.markup < 0 && 'text-danger')}>{format.money(r.markup)}</span>,
    },
    { id: 'markupPct', header: t('reports.sales.columns.markupPct'), align: 'right', cell: (r) => pct(r.markupPct) },
  ];

  const exportExcel = () => {
    const csv = toCsv(
      rows.map((r) => [r.name, r.qty, r.revenue, r.cost, r.markup, r.markupPct === undefined ? '' : Math.round(r.markupPct)]),
      [
        t('reports.sales.columns.name'), t('reports.sales.columns.qty'), t('reports.sales.columns.revenue'), t('reports.sales.columns.cost'),
        t('reports.sales.columns.markup'), t('reports.sales.columns.markupPct'),
      ],
    );
    downloadCsv('stock-sales.csv', csv);
  };

  return (
    <div data-f="F-08-104" className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Wallet aria-hidden className="size-4" />} label={t('reports.sales.columns.revenue')} value={format.money(totalRevenue)} />
        <StatCard icon={<Wallet aria-hidden className="size-4" />} label={t('reports.sales.columns.cost')} value={format.money(totalCost)} />
        <StatCard
          icon={<Wallet aria-hidden className="size-4" />}
          label={t('reports.sales.columns.markup')}
          value={`${format.money(totalRevenue - totalCost)} · ${pct(totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : undefined)}`}
        />
      </div>
      <ExportButton onExport={exportExcel} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.id} label={t('reports.switcher.sales')} />
    </div>
  );
}

// ─────────────────────────── F-08-105: Анализ расхода материалов ───────────────────────────

function ConsumablesReport({ businessId, locationId, from, to }: { businessId: string; locationId: string; from: string; to: string }) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const format = useFormat();
  const q = useApiQuery(['stock', 'consumablesAnalysis', businessId, locationId, from, to], () => getConsumablesAnalysis(businessId, locationId, from, to));

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading) return <Skeleton lines={5} />;
  const rows: ConsumablesAnalysisRow[] = q.data ?? [];
  if (rows.length === 0) return <EmptyState icon={<Boxes aria-hidden />} title={t('reports.noRows')} />;

  const unit = (r: ConsumablesAnalysisRow) => unitShort(r.writeoffUnit);
  const columns: TableColumn<ConsumablesAnalysisRow>[] = [
    { id: 'name', header: t('reports.consumables.columns.name'), mobile: 'title', cell: (r) => r.name },
    { id: 'norm', header: t('reports.consumables.columns.normQty'), mobile: 'meta', align: 'right', cell: (r) => `${formatQty(r.normQty)} ${unit(r)}` },
    { id: 'actual', header: t('reports.consumables.columns.actualQty'), align: 'right', sortable: true, sortValue: (r) => r.actualQty, cell: (r) => `${formatQty(r.actualQty)} ${unit(r)}` },
    {
      id: 'diff',
      header: t('reports.consumables.columns.diffQty'),
      mobile: 'aside',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.diffQty,
      // Перерасход против нормы — красным, экономия — зелёным
      cell: (r) => (
        <span className={cn('tabular-nums', r.diffQty > 0 ? 'font-medium text-danger' : r.diffQty < 0 ? 'text-success' : 'text-muted')}>
          {r.diffQty > 0 ? '+' : ''}
          {formatQty(r.diffQty)} {unit(r)}
        </span>
      ),
    },
    { id: 'cost', header: t('reports.consumables.columns.actualCost'), align: 'right', cell: (r) => format.money(r.actualCost) },
  ];

  const exportExcel = () => {
    const csv = toCsv(
      rows.map((r) => [r.name, unit(r), r.normQty, r.actualQty, r.diffQty, r.actualCost]),
      [
        t('reports.consumables.columns.name'), t('reports.consumables.columns.unit'), t('reports.consumables.columns.normQty'),
        t('reports.consumables.columns.actualQty'), t('reports.consumables.columns.diffQty'), t('reports.consumables.columns.actualCost'),
      ],
    );
    downloadCsv('stock-consumables.csv', csv);
  };

  return (
    <div data-f="F-08-105" className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('reports.consumables.hintNorm')}</p>
      <ExportButton onExport={exportExcel} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} label={t('reports.switcher.consumables')} />
    </div>
  );
}

// ─────────────────────────── Ск14: движение за период ───────────────────────────

function MovementReport({ businessId, locationId, from, to }: { businessId: string; locationId: string; from: string; to: string }) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const format = useFormat();
  const q = useApiQuery(['stock', 'movementReport', businessId, locationId, from, to], () => getMovementReport(businessId, locationId, from, to));

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading) return <Skeleton lines={5} />;
  const rows: MovementReportRow[] = q.data ?? [];
  if (rows.length === 0) return <EmptyState icon={<Boxes aria-hidden />} title={t('reports.noRows')} />;

  const qty = (v: number, r: MovementReportRow) => (
    <span className={cn('tabular-nums', v < 0 && 'text-danger')}>
      {formatQty(v)} {unitShort(r.unit)}
    </span>
  );
  const columns: TableColumn<MovementReportRow>[] = [
    { id: 'name', header: t('reports.movement.columns.name'), mobile: 'title', cell: (r) => r.name },
    { id: 'start', header: t('reports.movement.columns.start'), mobile: 'meta', align: 'right', cell: (r) => qty(r.startQty, r) },
    { id: 'income', header: t('reports.movement.columns.income'), align: 'right', sortable: true, sortValue: (r) => r.incomeQty, cell: (r) => qty(r.incomeQty, r) },
    { id: 'out', header: t('reports.movement.columns.out'), align: 'right', sortable: true, sortValue: (r) => r.outQty, cell: (r) => qty(r.outQty, r) },
    { id: 'end', header: t('reports.movement.columns.end'), mobile: 'aside', align: 'right', sortable: true, sortValue: (r) => r.endQty, cell: (r) => qty(r.endQty, r) },
    { id: 'endValue', header: t('reports.movement.columns.endValue'), align: 'right', cell: (r) => format.money(r.endValue) },
  ];

  const exportExcel = () => {
    const csv = toCsv(
      rows.map((r) => [r.sku ?? '', r.name, unitShort(r.unit), r.startQty, r.incomeQty, r.outQty, r.endQty, r.endValue]),
      [
        t('reports.remnants.columns.sku'), t('reports.movement.columns.name'), t('reports.consumables.columns.unit'), t('reports.movement.columns.start'),
        t('reports.movement.columns.income'), t('reports.movement.columns.out'), t('reports.movement.columns.end'), t('reports.movement.columns.endValue'),
      ],
    );
    downloadCsv('stock-movement.csv', csv);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('reports.movement.hint')}</p>
      <ExportButton onExport={exportExcel} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.goodId} label={t('reports.switcher.movement')} />
    </div>
  );
}

// ─────────────────────────── F-08-106: Анализ списания товаров ───────────────────────────

function WriteoffsReport({ ops, incomeOps }: { ops: OperationRow[]; incomeOps: OperationRow[] }) {
  const t = useT('stock');
  const format = useFormat();

  const rows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku?: string; outQty: number; outValue: number; incomeQty: number }>();
    ops.forEach((op) => {
      const entry = map.get(op.goodId) ?? { id: op.goodId, name: op.goodName, outQty: 0, outValue: 0, incomeQty: 0 };
      entry.outQty += Math.abs(op.qtySale);
      entry.outValue += Math.abs(op.costTotal);
      map.set(op.goodId, entry);
    });
    incomeOps.forEach((op) => {
      const entry = map.get(op.goodId);
      if (entry) entry.incomeQty += Math.abs(op.qtySale);
    });
    return Array.from(map.values());
  }, [ops, incomeOps]);

  if (rows.length === 0) return <EmptyState icon={<Boxes aria-hidden />} title={t('reports.noRows')} />;

  const totalQty = rows.reduce((s, r) => s + r.outQty, 0);
  const totalValue = rows.reduce((s, r) => s + r.outValue, 0);

  const columns: TableColumn<(typeof rows)[number]>[] = [
    { id: 'name', header: t('reports.writeoffs.columns.name'), mobile: 'title', cell: (r) => r.name },
    { id: 'income', header: t('reports.writeoffs.columns.incomeQty'), mobile: 'aside', align: 'right', cell: (r) => formatQty(r.incomeQty) },
    { id: 'out', header: t('reports.writeoffs.columns.outQty'), align: 'right', sortable: true, sortValue: (r) => r.outQty, cell: (r) => formatQty(r.outQty) },
    { id: 'outValue', header: t('reports.writeoffs.columns.outValue'), align: 'right', sortable: true, sortValue: (r) => r.outValue, cell: (r) => format.money(r.outValue) },
  ];

  const exportExcel = () => {
    const csv = toCsv(
      rows.map((r) => [r.name, r.incomeQty, r.outQty, r.outValue]),
      [t('reports.writeoffs.columns.name'), t('reports.writeoffs.columns.incomeQty'), t('reports.writeoffs.columns.outQty'), t('reports.writeoffs.columns.outValue')],
    );
    downloadCsv('stock-writeoffs.csv', csv);
  };

  return (
    <div data-f="F-08-106" className="flex flex-col gap-4">
      <ExportButton onExport={exportExcel} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.id} label={t('reports.switcher.writeoffs')} />
      <p className="text-sm text-muted">
        {t('reports.writeoffs.totalsQty')}: {formatQty(totalQty)} · {t('reports.writeoffs.totalsValue')}: {format.money(totalValue)}
      </p>
    </div>
  );
}

// ─────────────────────────── F-08-107: Анализ оборачиваемости ───────────────────────────

function TurnoverReport({ items, sales, incomes, rangeDays }: { items: GoodRow[]; sales: OperationRow[]; incomes: OperationRow[]; rangeDays: number }) {
  const t = useT('stock');
  const format = useFormat();

  const rows = useMemo(() => {
    const salesByGood = new Map<string, number>();
    sales.forEach((op) => salesByGood.set(op.goodId, (salesByGood.get(op.goodId) ?? 0) + Math.abs(op.qtySale)));
    const incomeByGood = new Map<string, number>();
    incomes.forEach((op) => incomeByGood.set(op.goodId, (incomeByGood.get(op.goodId) ?? 0) + Math.abs(op.qtySale)));

    return items
      .filter((g) => (salesByGood.get(g.id) ?? 0) > 0 || (incomeByGood.get(g.id) ?? 0) > 0)
      .map((g) => {
        const salesQty = salesByGood.get(g.id) ?? 0;
        const incomeQty = incomeByGood.get(g.id) ?? 0;
        const endQty = g.totalStock;
        const startQty = Math.max(0, endQty + salesQty - incomeQty);
        // F-08-107: средний запас упрощённо — (начало + конец) / 2, без ежедневного среза остатков
        const avgStock = (startQty + endQty) / 2;
        const days = avgStock > 0 && salesQty > 0 ? Math.round((avgStock / salesQty) * rangeDays) : undefined;
        const times = avgStock > 0 ? Math.round((salesQty / avgStock) * 10) / 10 : undefined;
        const dailyTurnover = salesQty / rangeDays;
        const level = dailyTurnover > 0 ? Math.round(endQty / dailyTurnover) : undefined;
        return { id: g.id, name: g.name, incomeQty, startQty, endQty, salesQty, avgStock, days, times, level };
      });
  }, [items, sales, incomes, rangeDays]);

  if (rows.length === 0) return <EmptyState icon={<Boxes aria-hidden />} title={t('reports.noRows')} />;

  const columns: TableColumn<(typeof rows)[number]>[] = [
    { id: 'name', header: t('reports.turnover.columns.name'), mobile: 'title', cell: (r) => r.name },
    { id: 'income', header: t('reports.turnover.columns.incomeQty'), mobile: 'aside', align: 'right', cell: (r) => formatQty(r.incomeQty) },
    { id: 'end', header: t('reports.turnover.columns.endQty'), align: 'right', cell: (r) => formatQty(r.endQty) },
    { id: 'sales', header: t('reports.turnover.columns.salesQty'), align: 'right', sortable: true, sortValue: (r) => r.salesQty, cell: (r) => formatQty(r.salesQty) },
    { id: 'avg', header: t('reports.turnover.columns.avgStock'), align: 'right', cell: (r) => formatQty(Math.round(r.avgStock * 10) / 10) },
    { id: 'days', header: t('reports.turnover.columns.days'), align: 'right', cell: (r) => (r.days === undefined ? '—' : format.number(r.days)) },
    { id: 'times', header: t('reports.turnover.columns.times'), align: 'right', cell: (r) => (r.times === undefined ? '—' : format.number(r.times)) },
    { id: 'level', header: t('reports.turnover.columns.level'), align: 'right', cell: (r) => (r.level === undefined ? '—' : format.number(r.level)) },
  ];

  const exportExcel = () => {
    const csv = toCsv(
      rows.map((r) => [r.name, r.incomeQty, r.startQty, r.endQty, r.salesQty, Math.round(r.avgStock * 10) / 10, r.days ?? '', r.times ?? '', r.level ?? '']),
      [
        t('reports.turnover.columns.name'), t('reports.turnover.columns.incomeQty'), t('reports.turnover.columns.startQty'), t('reports.turnover.columns.endQty'),
        t('reports.turnover.columns.salesQty'), t('reports.turnover.columns.avgStock'), t('reports.turnover.columns.days'), t('reports.turnover.columns.times'), t('reports.turnover.columns.level'),
      ],
    );
    downloadCsv('stock-turnover.csv', csv);
  };

  return (
    <div data-f="F-08-107" className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('reports.turnover.hint')}</p>
      <ExportButton onExport={exportExcel} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.id} label={t('reports.switcher.turnover')} />
    </div>
  );
}

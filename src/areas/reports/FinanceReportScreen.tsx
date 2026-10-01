'use client';

/**
 * F-12-044…045: «Финансовый отчет» — период (умолчание неделя), статья/контрагент/касса/тип кассы,
 * детализация по типу/по кассе, «только с движением», матрица «статья × день», график, «Остаток на конец дня».
 */
import { SlidersHorizontal, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { listAccounts, listItems } from '@/api/finance';
import { getFinanceReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { compactAxis } from '@/areas/reports/chartBuckets';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCurrent } from '@/demo/hooks';
import type { CashRegisterKind, FinanceDetailMode, FinanceReportRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChartCard, CHART_COLORS, chartTheme } from '@/ui/ChartCard';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Table, type TableColumn } from '@/ui/Table';

export function FinanceReportScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const perms = useReportsPermissions();
  // Отч3: общий период раздела (раньше здесь был свой, 7 дней, и он терялся при переходе из «Основных показателей»)
  const range = useReportRange();
  const [itemId, setItemId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [registerKind, setRegisterKind] = useState<CashRegisterKind>('any');
  const [detail, setDetail] = useState<FinanceDetailMode>('none');
  const [showAllItems, setShowAllItems] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState({ itemId, accountId, registerKind, detail, showAllItems });

  const activeFilterCount = [itemId, accountId, registerKind !== 'any', detail !== 'none', showAllItems].filter(Boolean).length;

  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: !!businessId });
  const accountsQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId!), { enabled: !!businessId });

  const filters = useMemo(
    () => ({ itemId: itemId || undefined, accountId: accountId || undefined, registerKind, detail, showAllItems }),
    [itemId, accountId, registerKind, detail, showAllItems],
  );

  const q = useApiQuery(
    ['reports', 'finance', businessId, activeLocationIds, range, filters],
    () => getFinanceReport({ businessId: businessId!, locationIds: activeLocationIds, range, filters }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const monthly = q.data?.granularity === 'month';
  // Отч7: за период длиннее месяца колонки — месяцы («сентябрь 2026»), иначе дни
  const periodLabel = (part: string) => (part.length === 7 ? f.date(`${part}-01`, 'monthYear') : f.date(part, 'dayMonth'));
  const columnLabel = (label: string) => {
    const [periodPart, kindPart] = label.split(':');
    const kindLabel = kindPart === 'cash' ? t('financeReport.kind.cash') : kindPart === 'noncash' ? t('financeReport.kind.noncash') : kindPart;
    return kindLabel ? `${periodLabel(periodPart)} · ${kindLabel}` : periodLabel(periodPart);
  };

  const columns: TableColumn<FinanceReportRow>[] = useMemo(() => {
    const dataColumns = q.data?.columns ?? [];
    return [
      { id: 'item', header: t('financeReport.columns.item'), cell: (r) => r.itemLabel, mobile: 'title' },
      ...dataColumns.map((c): TableColumn<FinanceReportRow> => {
        return {
          id: c.key,
          header: columnLabel(c.label),
          cell: (r) => (r.byColumn[c.key] ? f.money(r.byColumn[c.key]) : '—'),
          align: 'right',
          mobile: 'hidden',
        };
      }),
      { id: 'total', header: t('financeReport.columns.total'), cell: (r) => f.money(r.total), align: 'right', mobile: 'aside' },
    ];
  }, [q.data?.columns, t, f, columnLabel]);

  const exportRows = [...(q.data?.income ?? []), ...(q.data?.expense ?? [])].map((r) => [r.itemLabel, ...( q.data?.columns ?? []).map((c) => r.byColumn[c.key] ?? 0), r.total]);

  if (!perms.financePeriod)
    return (
      <div data-f="F-12-087">
        <ErrorState title={t('appointments.noAccess')} />
      </div>
    );

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-044 F-07-163 F-08-108" className="flex flex-col gap-6">
        <ReportHeader
          slug="finance"
          crumbGroup="finance"
          helpBody={t('help.financeReport')}
          actions={
            <ExportExcelButton
              fileName="finance-report.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[t('financeReport.columns.item'), ...(q.data?.columns ?? []).map((c) => columnLabel(c.label)), t('financeReport.columns.total')]}
              disabled={!q.data || (q.data.income.length === 0 && q.data.expense.length === 0)}
            />
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <ReportPeriodPicker />
          <Button
            variant="secondary"
            leftIcon={<SlidersHorizontal className="size-4" />}
            onClick={() => {
              setDraft({ itemId, accountId, registerKind, detail, showAllItems });
              setFiltersOpen(true);
            }}
          >
            {t('dashboard.filters')}
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </Button>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && q.data?.income.length === 0 && q.data?.expense.length === 0 ? (
          <EmptyState variant="page" icon={<Wallet />} title={t('financeReport.emptyTitle')} description={t('financeReport.emptyText')} />
        ) : (
          <>
            <ChartCard title={t('financeReport.chartTitle')} description={monthly ? t('financeReport.monthlyHint') : undefined} loading={q.isLoading} height={220}>
              <BarChart data={q.data?.chart ?? []}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d: string) => f.date(d, monthly ? 'monthYear' : 'dayMonth')} />
                <YAxis {...chartTheme.axis} tickFormatter={compactAxis} width={56} />
                <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => f.date(String(label), monthly ? 'monthYear' : 'dayMonth')} formatter={(v) => f.money(Number(v))} />
                <Legend {...chartTheme.legend} />
                <Bar dataKey="income" name={t('financeReport.income')} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name={t('financeReport.expense')} fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <section data-f="F-12-045" className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-fg">{t('financeReport.income')}</h2>
              <Table columns={columns} rows={q.data?.income ?? []} rowKey={(r) => r.itemId} loading={q.isLoading} label={t('financeReport.income')} />
              <h2 data-f="F-12-118" className="mt-2 text-sm font-semibold text-fg">{t('financeReport.expense')}</h2>
              <Table columns={columns} rows={q.data?.expense ?? []} rowKey={(r) => r.itemId} loading={q.isLoading} label={t('financeReport.expense')} />
              <p className="text-sm text-muted">
                {t('financeReport.grandTotals', { income: f.money(q.data?.grandIncome ?? 0), expense: f.money(q.data?.grandExpense ?? 0) })}
              </p>
            </section>
          </>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('dashboard.filters')}
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setDraft({ itemId: '', accountId: '', registerKind: 'any', detail: 'none', showAllItems: false })}
            >
              {t('dashboard.resetAll')}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setFiltersOpen(false)}>
                {t('dashboard.cancel')}
              </Button>
              <Button
                onClick={() => {
                  setItemId(draft.itemId);
                  setAccountId(draft.accountId);
                  setRegisterKind(draft.registerKind);
                  setDetail(draft.detail);
                  setShowAllItems(draft.showAllItems);
                  setFiltersOpen(false);
                }}
              >
                {t('dashboard.apply')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-fg">{t('financeReport.filterItem')}</label>
            <Select
              aria-label={t('financeReport.filterItem')}
              value={draft.itemId}
              onValueChange={(v) => setDraft((s) => ({ ...s, itemId: v }))}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(itemsQ.data ?? []).map((i) => ({ value: i.id, label: i.name }))]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-fg">{t('financeReport.filterAccount')}</label>
            <Select
              aria-label={t('financeReport.filterAccount')}
              value={draft.accountId}
              onValueChange={(v) => setDraft((s) => ({ ...s, accountId: v }))}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(accountsQ.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-fg">{t('financeReport.filterKind')}</label>
            <Select
              aria-label={t('financeReport.filterKind')}
              value={draft.registerKind}
              onValueChange={(v) => setDraft((s) => ({ ...s, registerKind: v as CashRegisterKind }))}
              options={[
                { value: 'any', label: t('financeReport.kind.any') },
                { value: 'cash', label: t('financeReport.kind.cash') },
                { value: 'noncash', label: t('financeReport.kind.noncash') },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-fg">{t('financeReport.filterDetail')}</label>
            <Select
              aria-label={t('financeReport.filterDetail')}
              value={draft.detail}
              onValueChange={(v) => setDraft((s) => ({ ...s, detail: v as FinanceDetailMode }))}
              options={[
                { value: 'none', label: t('financeReport.detail.none') },
                { value: 'byKind', label: t('financeReport.detail.byKind') },
                { value: 'byAccount', label: t('financeReport.detail.byAccount') },
              ]}
            />
          </div>
          <Checkbox
            checked={draft.showAllItems}
            onCheckedChange={(v) => setDraft((s) => ({ ...s, showAllItems: v }))}
            label={t('financeReport.showAllItems')}
          />
        </div>
      </Sheet>
    </PermissionGate>
  );
}

'use client';

/**
 * F-12-046…047: «P&L отчет» — 12 месяцев, «Итого до уплаты налогов» = выручка − расходы; клик по сумме
 * открывает операции статьи за месяц.
 * F-09-091 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md
 * 2026-09-26): селектор «Детализировать зарплату» реально разбивает статью «Зарплата персонала» на
 * строки по сотруднику/должности (было: принимался, но ничего не менял — см. src/api/reports.ts
 * getPnlReport). Отчёт остаётся кассовым — детализация строится по тем же операциям выплаты
 * (partyType: 'staff'), начисленное, но не выданное сюда не попадает.
 */
import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { getPnlItemOperations, getPnlReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCurrent } from '@/demo/hooks';
import type { PayrollDetailMode, PnlRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { dayjs, today } from '@/lib/date';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';

export function PnlScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const perms = useReportsPermissions();
  const [fromMonth, setFromMonth] = useState(dayjs(today()).subtract(11, 'month').format('YYYY-MM'));
  const [payrollDetail, setPayrollDetail] = useState<PayrollDetailMode>('none');
  const [drill, setDrill] = useState<{ itemId: string; month: string; label: string; partyIds?: string[] } | null>(null);

  const q = useApiQuery(
    ['reports', 'pnl', businessId, activeLocationIds, fromMonth, payrollDetail],
    () => getPnlReport({ businessId: businessId!, locationIds: activeLocationIds, fromMonth, payrollDetail }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  // Не `drill!.itemId`/`drill!.month`/`drill!.partyIds`: React Compiler по «!» считает drill не-null и выносит чтение полей в рендер.
  const opsQ = useApiQuery(
    ['reports', 'pnl', 'ops', businessId, activeLocationIds, drill?.itemId, drill?.month, drill?.partyIds],
    () => getPnlItemOperations({ businessId: businessId!, itemId: drill?.itemId ?? '', month: drill?.month ?? '', partyIds: drill?.partyIds, locationIds: activeLocationIds }),
    { enabled: !!drill && !!businessId },
  );

  const months = useMemo(() => q.data?.months ?? [], [q.data?.months]);
  const rows = useMemo(() => [...(q.data?.income ?? []), ...(q.data?.expense ?? [])], [q.data?.income, q.data?.expense]);
  // F-09-091: с детализацией зарплаты несколько строк делят один и тот же itemId (payroll) — ключ строки
  // должен различать их, иначе React перепутает строки и клик по сумме откроет чужого сотрудника.
  const rowKey = (r: PnlRow) => (r.partyIds ? `${r.itemId}:${r.partyIds.join(',')}` : r.itemId);

  const columns: TableColumn<PnlRow>[] = useMemo(
    () => [
      {
        id: 'item',
        header: t('pnl.columns.item'),
        cell: (r) =>
          r.advance ? (
            <span className="flex flex-col">
              <span>{r.itemLabel}</span>
              {/* Отч11: пополнение депозита — аванс клиента, а не выручка */}
              <span className="text-xs text-muted">{t('pnl.advanceNote')}</span>
            </span>
          ) : (
            r.itemLabel
          ),
        mobile: 'title',
      },
      ...months.map(
        (m, idx): TableColumn<PnlRow> => ({
          id: m,
          header: f.date(`${m}-01`, 'monthYear'),
          cell: (r) => (
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => setDrill({ itemId: r.itemId, month: m, label: r.itemLabel, partyIds: r.partyIds })}>
              {r.byMonth[idx] ? f.money(r.byMonth[idx]) : '—'}
            </button>
          ),
          align: 'right',
          mobile: 'hidden',
        }),
      ),
      { id: 'total', header: t('pnl.columns.total'), cell: (r) => f.money(r.total), align: 'right', mobile: 'aside' },
    ],
    [months, t, f],
  );

  const exportRows = rows.map((r) => [r.itemLabel, ...r.byMonth, r.total]);
  const advanceTotal = rows.filter((r) => r.advance).reduce((sum, r) => sum + r.total, 0);

  if (!perms.financeYear)
    return (
      <div data-f="F-12-087">
        <ErrorState title={t('appointments.noAccess')} />
      </div>
    );

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-046 F-00-192 F-07-164 F-08-108" className="flex flex-col gap-6">
        <ReportHeader
          slug="pnl"
          crumbGroup="finance"
          helpBody={t('help.pnl')}
          actions={
            <ExportExcelButton fileName="pnl.csv" type="reportBuilder" rows={exportRows} headers={[t('pnl.columns.item'), ...months.map((m) => f.date(`${m}-01`, 'monthYear')), t('pnl.columns.total')]} disabled={rows.length === 0} />
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[10rem]">
            <label className="mb-1 block text-sm font-medium text-fg">{t('pnl.fromMonth')}</label>
            <Input
              aria-label={t('pnl.fromMonth')}
              inputMode="numeric"
              placeholder="2026-01"
              defaultValue={fromMonth}
              onBlur={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && setFromMonth(e.target.value)}
            />
          </div>
          <div data-f="F-09-091" className="w-full max-w-[14rem]">
            <Select
              aria-label={t('pnl.payrollDetail')}
              value={payrollDetail}
              onValueChange={(v) => setPayrollDetail(v as PayrollDetailMode)}
              options={[
                { value: 'none', label: t('pnl.detail.none') },
                { value: 'byPosition', label: t('pnl.detail.byPosition') },
                { value: 'byStaff', label: t('pnl.detail.byStaff') },
              ]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<TrendingUp />} title={t('pnl.emptyTitle')} description={t('pnl.emptyText')} />
        ) : (
          <>
            <ChartCard title={t('pnl.chartTitle')} loading={q.isLoading} height={220}>
              <LineChart data={q.data?.chart ?? []}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="month" {...chartTheme.axis} tickFormatter={(m: string) => f.date(`${m}-01`, 'monthYear')} />
                <YAxis {...chartTheme.axis} />
                <RTooltip {...chartTheme.tooltip} labelFormatter={(label) => f.date(`${label}-01`, 'monthYear')} />
                <Legend {...chartTheme.legend} />
                <Line type="monotone" dataKey="income" name={t('financeReport.income')} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="expense" name={t('financeReport.expense')} stroke={CHART_COLORS[3]} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name={t('pnl.profit')} stroke={CHART_COLORS[1]} dot={false} strokeWidth={2} />
              </LineChart>
            </ChartCard>
            <Table columns={columns} rows={rows} rowKey={rowKey} loading={q.isLoading} label={t('catalog.items.pnl.title')} />
            <p data-f="F-12-046" className="text-sm text-muted">
              {t('pnl.totalBeforeTax', { value: f.money(q.data?.totalBeforeTax.reduce((a, b) => a + b, 0) ?? 0) })}
            </p>
            {advanceTotal > 0 && <p className="text-sm text-muted">{t('pnl.advanceTotal', { value: f.money(advanceTotal) })}</p>}
          </>
        )}
      </div>

      <Sheet open={!!drill} onOpenChange={(v) => !v && setDrill(null)} title={drill ? `${drill.label} · ${f.date(`${drill.month}-01`, 'monthYear')}` : ''} side="right" size="md">
        <div data-f="F-12-047" className="flex flex-col gap-2">
          {opsQ.isLoading ? <Skeleton lines={4} /> : (opsQ.data ?? []).length === 0 ? (
            <EmptyState title={t('pnl.noOperations')} />
          ) : (
            (opsQ.data ?? []).map((op) => (
              <div key={op.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted">{f.date(op.date, 'short')}</span>
                <span className="font-medium text-fg">{f.money(op.amount)}</span>
              </div>
            ))
          )}
        </div>
      </Sheet>
    </PermissionGate>
  );
}

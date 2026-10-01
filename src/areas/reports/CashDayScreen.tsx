'use client';

/**
 * F-12-048…049: «Отчет по кассе за день» — плитки «количество · сумма» за день, таблицы касс и операций.
 */
import { Wallet } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { useCoreList } from '@/api/core';
import { getCashDayReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { setReportStaff, useReportStaff } from '@/areas/reports/reportPeriod';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCan, useCurrent } from '@/demo/hooks';
import type { CashOperationRow, CashRegisterRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';

function methodLabel(t: ReturnType<typeof useT<'reports'>>, method: string): string {
  if (method === 'cash') return t('cashDay.method.cash');
  if (method === 'card') return t('cashDay.method.card');
  if (method === 'transfer') return t('cashDay.method.transfer');
  return t('cashDay.method.other');
}

/** ?date=YYYY-MM-DD — открыть кассу конкретного дня по ссылке (из «Финансового отчёта», из закладки) */
function CashDayUrlDate({ onDate }: { onDate: (d: string) => void }) {
  const params = useSearchParams();
  const date = params.get('date');
  useLayoutEffect(() => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) onDate(date);
  }, [date]);
  return null;
}

export function CashDayScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const canSeePhones = useCan('clients.phones');
  const perms = useReportsPermissions();
  const [date, setDate] = useState(today());
  const staffId = useReportStaff();

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'cashDay', businessId, activeLocationIds, date, staffId],
    () => getCashDayReport({ businessId: businessId!, locationIds: activeLocationIds, date, staffId: staffId || undefined, canSeePhones }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const registerColumns: TableColumn<CashRegisterRow>[] = useMemo(
    () => [
      { id: 'account', header: t('cashDay.columns.account'), cell: (r) => r.accountName, mobile: 'title' },
      { id: 'paid', header: t('cashDay.columns.paid'), cell: (r) => f.money(r.paid), align: 'right' },
      { id: 'opening', header: t('cashDay.columns.opening'), cell: (r) => f.money(r.openingBalance), align: 'right' },
      { id: 'closing', header: t('cashDay.columns.closing'), cell: (r) => f.money(r.closingBalance), align: 'right' },
    ],
    [t, f],
  );

  const opColumns: TableColumn<CashOperationRow>[] = useMemo(
    () => [
      { id: 'time', header: t('cashDay.columns.time'), cell: (r) => r.time, mobile: 'aside' },
      { id: 'client', header: t('cashDay.columns.client'), cell: (r) => r.clientName ?? '—', mobile: 'title' },
      { id: 'staff', header: t('cashDay.columns.staff'), cell: (r) => r.staffName, mobile: 'meta' },
      { id: 'line', header: t('cashDay.columns.line'), cell: (r) => r.lineLabel, mobile: 'subtitle' },
      {
        id: 'total',
        header: t('cashDay.columns.total'),
        cell: (r) => (
          <span className={cn(r.isRefund && 'text-error')}>{r.isRefund ? '−' : ''}{f.money(r.total)}</span>
        ),
        align: 'right',
      },
      { id: 'method', header: t('cashDay.columns.method'), cell: (r) => `${r.accountName}, ${methodLabel(t, r.method)}`, mobile: 'meta' },
    ],
    [t, f],
  );

  const summary = q.data?.summary;
  // Пустой день/бизнес: ни записей, ни операций, ни денег в кассах — одно «пусто» вместо девяти нулевых плиток
  const dayEmpty =
    !q.isLoading &&
    !!q.data &&
    q.data.summary.totalRecords.count === 0 &&
    q.data.operations.length === 0 &&
    q.data.registers.every((r) => r.openingBalance === 0 && r.closingBalance === 0);
  const exportRows = (q.data?.operations ?? []).map((o) => [o.time, o.clientName ?? '', o.staffName, o.lineLabel, o.total, o.accountName, o.method]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-048 F-07-165 F-07-170 F-08-108" className="flex flex-col gap-6">
        <ReportHeader
          slug="cashDay"
          crumbGroup="finance"
          helpBody={t('help.cashDay')}
          actions={
            <ExportExcelButton
              fileName="cash-day.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[t('cashDay.columns.time'), t('cashDay.columns.client'), t('cashDay.columns.staff'), t('cashDay.columns.line'), t('cashDay.columns.total'), t('cashDay.columns.account'), t('cashDay.columns.method')]}
              disabled={exportRows.length === 0}
            />
          }
        />

        <Suspense fallback={null}>
          <CashDayUrlDate onDate={(d) => setDate(perms.cashDayTodayOnly ? today() : d)} />
        </Suspense>
        <div data-f="F-12-087" className="flex flex-wrap items-end gap-3">
          <DatePicker className="sm:w-auto sm:min-w-[16rem]" value={date} onValueChange={(v) => v && setDate(v)} min={perms.cashDayTodayOnly ? today() : undefined} max={perms.cashDayTodayOnly ? today() : undefined} />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('cashDay.filterStaff')}
              value={staffId}
              onValueChange={setReportStaff}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : dayEmpty ? (
          <EmptyState variant="page" icon={<Wallet />} title={t('cashDay.emptyTitle')} description={t('cashDay.emptyText')} />
        ) : (
          <>
            {/* Отч1: плитки записей дня видны всегда — «операций нет» не значит «визитов не было» */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.totalRecords')} value={f.money(summary?.totalRecords.amount ?? 0)} hint={t('cashDay.tileCount', { n: summary?.totalRecords.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.withClients')} value={f.money(summary?.recordsWithClients.amount ?? 0)} hint={t('cashDay.tileCount', { n: summary?.recordsWithClients.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.withoutClients')} value={f.money(summary?.recordsWithoutClients.amount ?? 0)} hint={t('cashDay.tileCount', { n: summary?.recordsWithoutClients.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.clients')} value={summary?.clients.count ?? 0} hint={t('cashDay.tileAvg', { avg: f.money(summary?.clients.avg ?? 0) })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.services')} value={f.money(summary?.servicesPaid.amount ?? 0)} hint={t('cashDay.tileOps', { n: summary?.servicesPaid.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.accountTopUps')} value={f.money(summary?.accountTopUps.amount ?? 0)} hint={t('cashDay.tileOps', { n: summary?.accountTopUps.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.products')} value={f.money(summary?.productsPaid.amount ?? 0)} hint={t('cashDay.tileOps', { n: summary?.productsPaid.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.certificates')} value={f.money(summary?.certificatesPaid.amount ?? 0)} hint={t('cashDay.tileOps', { n: summary?.certificatesPaid.count ?? 0 })} />
              <StatCard loading={q.isLoading} label={t('cashDay.tiles.memberships')} value={f.money(summary?.membershipsPaid.amount ?? 0)} hint={t('cashDay.tileOps', { n: summary?.membershipsPaid.count ?? 0 })} />
            </div>

            <section data-f="F-12-049" className="flex flex-col gap-4">
              <Table columns={registerColumns} rows={q.data?.registers ?? []} rowKey={(r) => r.accountId} loading={q.isLoading} label={t('cashDay.registersTitle')} />
              {!q.isLoading && (q.data?.operations.length ?? 0) === 0 ? (
                <EmptyState icon={<Wallet />} title={t('cashDay.emptyTitle')} description={t('cashDay.emptyText')} />
              ) : (
                <Table columns={opColumns} rows={q.data?.operations ?? []} rowKey={(r) => r.operationId} loading={q.isLoading} label={t('cashDay.operationsTitle')} />
              )}
            </section>
          </>
        )}
      </div>
    </PermissionGate>
  );
}

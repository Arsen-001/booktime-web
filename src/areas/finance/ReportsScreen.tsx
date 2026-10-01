'use client';

/**
 * /biz/finance/reports — «Кассовая книга» (F-07-176, fin-review Ф25: раньше тут была пустая карточка со ссылкой).
 * По одной кассе за период: остаток на начало, каждая операция с нарастающим остатком (порядок compareOperationsAsc —
 * тот же, что у списка операций), приход, расход и остаток на конец; начало + приход − расход = конец.
 * Полные финансовые отчёты (P&L, план-факт) — в разделе «Отчёты», ссылка в шапке.
 */
import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, BookOpen } from 'lucide-react';
import { listAccounts, listItems, listOperations } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Operation } from '@/domain/finance';
import { compareOperationsAsc, operationSign } from '@/domain/finance';
import { dayjs, today } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { LinkButton } from '@/ui/Button';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { DEFAULT_PAGE_SIZE } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';

interface BookRow {
  op: Operation;
  balance: number;
}

export function ReportsScreen() {
  const t = useT('finance');
  const format = useFormat();
  const { ready, businessId, activeLocationIds } = useCurrent();
  const [accountIdPick, setAccountIdPick] = useState('');
  const [range, setRange] = useState<DateRange>(() => ({ from: dayjs(today()).startOf('month').format('YYYY-MM-DD'), to: today() }));

  const accountsQ = useApiQuery(['finance', 'accounts', businessId, activeLocationIds], () => listAccounts(businessId!, activeLocationIds), { enabled: ready && Boolean(businessId) });
  const accounts = accountsQ.data ?? [];
  const accountId = accountIdPick || accounts.find((a) => a.kind === 'cash')?.id || accounts[0]?.id || '';
  const account = accounts.find((a) => a.id === accountId);
  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: ready && Boolean(businessId) });
  // Все операции кассы (без отменённых) — остаток на начало периода считается по всему, что было до него
  const opsQ = useApiQuery(['finance', 'operations', businessId, 'cashBook', accountId], () => listOperations(businessId!, { accountId, cancelled: false }), {
    enabled: ready && Boolean(businessId) && Boolean(accountId),
  });

  const from = range.from ? `${range.from}T00:00` : '';
  const to = range.to ? `${range.to}T23:59` : '9999';
  const sorted = [...(opsQ.data ?? [])].sort(compareOperationsAsc);
  let opening = account?.openingBalance ?? 0;
  let balance = opening;
  let income = 0;
  let expense = 0;
  const rows: BookRow[] = [];
  for (const op of sorted) {
    if (op.date > to) break;
    const delta = operationSign(op.kind) * op.amount;
    balance += delta;
    if (op.date < from) {
      opening = balance;
      continue;
    }
    if (delta > 0) income += op.amount;
    else expense += op.amount;
    rows.push({ op, balance });
  }
  const closing = opening + income - expense;
  const itemName = (op: Operation) =>
    op.kind === 'transfer_in' || op.kind === 'transfer_out' ? t('operations.transferItem') : (itemsQ.data?.find((i) => i.id === op.itemId)?.name ?? '—');
  const loading = accountsQ.isLoading || !accountsQ.data || (Boolean(accountId) && (opsQ.isLoading || !opsQ.data));

  const columns: TableColumn<BookRow>[] = [
    {
      id: 'date',
      header: t('operations.columns.date'),
      cell: (r) => (
        <Link href={`/biz/finance/operations/${r.op.id}`} className="inline-flex min-h-10 items-center whitespace-nowrap text-primary-text underline decoration-border-strong underline-offset-2">
          {format.date(r.op.date, 'short')}, {format.time(r.op.date)}
        </Link>
      ),
      mobile: 'title',
      width: '10rem',
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="13ch" />
        </span>
      ),
    },
    { id: 'item', header: t('operations.columns.item'), cell: (r) => <span className="block truncate">{itemName(r.op)}</span>, mobile: 'subtitle', width: '14rem', skeletonWidth: '16ch' },
    { id: 'party', header: t('operations.columns.party'), cell: (r) => <span className="block truncate">{r.op.partyName ?? r.op.comment ?? '—'}</span>, mobile: 'meta', width: '14rem', skeletonWidth: '14ch' },
    {
      id: 'in',
      header: t('operations.totals.income'),
      cell: (r) => (operationSign(r.op.kind) > 0 ? <span className="whitespace-nowrap font-medium text-success">+{format.money(r.op.amount)}</span> : ''),
      align: 'right',
      mobile: 'meta',
      width: '9rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'out',
      header: t('operations.totals.expense'),
      cell: (r) => (operationSign(r.op.kind) < 0 ? <span className="whitespace-nowrap font-medium">−{format.money(r.op.amount)}</span> : ''),
      align: 'right',
      mobile: 'meta',
      width: '9rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'balance',
      header: t('operations.columns.balanceAfter'),
      cell: (r) => <span className={cn('whitespace-nowrap tabular-nums', r.balance < 0 && 'text-danger')}>{format.money(r.balance)}</span>,
      align: 'right',
      mobile: 'meta',
      width: '9rem',
      skeletonWidth: '9ch',
    },
  ];

  if (accountsQ.isError || opsQ.isError) {
    return <ErrorState onRetry={() => { accountsQ.refetch(); opsQ.refetch(); }} />;
  }

  return (
    <div data-f="F-07-176" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          <LinkButton href="/biz/reports" variant="secondary" leftIcon={<BarChart3 aria-hidden />}>
            {t('reports.openReports')}
          </LinkButton>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-64">
          <Select options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onValueChange={setAccountIdPick} placeholder={t('operationForm.accountPlaceholder')} />
        </div>
        <div className="w-full sm:w-auto">
          <DateRangePicker value={range} onValueChange={setRange} presets placeholder={t('operations.filters.period')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('reports.opening')} value={format.money(opening)} loading={loading} />
        <StatCard label={t('operations.totals.income')} value={`+${format.money(income)}`} loading={loading} />
        <StatCard label={t('operations.totals.expense')} value={`−${format.money(expense)}`} loading={loading} />
        <StatCard label={t('reports.closing')} value={format.money(closing)} loading={loading} />
      </div>

      {!loading && accounts.length === 0 ? (
        <EmptyState icon={<BookOpen aria-hidden className="size-8" />} title={t('reports.noAccounts')} action={<LinkButton href="/biz/finance/accounts">{t('onboarding.action')}</LinkButton>} />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.op.id}
          loading={loading}
          loadingRows={DEFAULT_PAGE_SIZE}
          label={t('reports.title')}
          empty={<EmptyState kind="search" title={t('reports.emptyPeriod')} description={t('reports.emptyPeriodText')} />}
        />
      )}
    </div>
  );
}

'use client';

/**
 * /biz/finance/accounts — «Счета и кассы» (F-07-001): карточки касс с балансом и оборотом за месяц,
 * добавление, перевод средств, порядок. Кассы по умолчанию (F-07-002) сеет мок-база; F-07-183 (системная
 * касса онлайн-денег) появится в b04 вместе с онлайн-платежами.
 * fin-review 27.09: сами кассы — сразу под итогами, графики ниже (Ф22); «Остатки по дням» — остаток на конец дня;
 * кассовая смена на наличной кассе (Ф1); скелеты того же размера, что содержимое (М1).
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Landmark, Lock, Pencil, Plus, Wallet } from 'lucide-react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { getFinanceRights, listAccountsWithBalance, listItems, listOperations, reorderAccounts, type AccountWithBalance } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { AccountFormSheet } from '@/areas/finance/accounts/AccountFormSheet';
import { TransferFundsSheet } from '@/areas/finance/accounts/TransferFundsSheet';
import { CashShiftPanel } from '@/areas/finance/shift/CashShiftPanel';
import { operationSign } from '@/domain/finance';
import { useCan, useCurrent } from '@/demo/hooks';
import { addDays, dayjs, today } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { useToast } from '@/ui/Toast';
import { Tooltip } from '@/ui/Tooltip';

const KIND_ICON = { cash: Wallet, card: Landmark, other: Wallet } as const;

/** Кассы в скелетоне — как в демо: наличная касса (со строкой смены), расчётный счёт и системная «Онлайн-платежи» */
const ACCOUNT_SKELETON_KINDS: ('cash' | 'card')[] = ['cash', 'card', 'card'];

/** Скелетон карточки кассы — та же разметка: значок, имя и вид, кнопки порядка, остаток, строка смены у наличной */
function AccountCardSkeleton({ kind, canEdit }: { kind: 'cash' | 'card'; canEdit: boolean }) {
  const t = useT('finance');
  const Icon = KIND_ICON[kind];
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
            <Icon aria-hidden className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
              <SkeletonText width="14ch" />
            </p>
            <p className="text-xs text-muted">{t(`accounts.kind.${kind}`)}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton size="sm" variant="ghost" icon={<ArrowUp aria-hidden />} label={t('accounts.moveUp')} disabled />
            <IconButton size="sm" variant="ghost" icon={<ArrowDown aria-hidden />} label={t('accounts.moveDown')} disabled />
            <IconButton size="sm" variant="ghost" icon={<Pencil aria-hidden />} label={t('accounts.edit')} disabled />
          </div>
        )}
      </div>
      <p className="num-headline text-fg">
        <SkeletonText width="9ch" />
      </p>
      <p className="text-xs text-muted">{t('accounts.currentBalance')}</p>
      {kind === 'cash' && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Lock aria-hidden className="size-4" />
              <SkeletonText width="16ch" />
            </span>
            {canEdit && (
              <span className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" disabled>
                  {t('shift.open')}
                </Button>
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export function AccountsScreen() {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const { ready, businessId, activeLocationIds, staffId } = useCurrent();
  const canEdit = useCan('finance.edit');
  const canShift = useCan('finance.shift');
  const rightsQ = useApiQuery(['finance', 'rights', businessId, staffId], () => getFinanceRights(businessId!, staffId!), { enabled: ready && Boolean(businessId) && Boolean(staffId) });
  // F-07-166: «Доступ к балансу» — без него суммы в кассах скрыты
  const canViewBalance = rightsQ.data ? rightsQ.data.canViewBalance : true;

  const [editing, setEditing] = useState<AccountWithBalance | 'new' | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [reordering, setReordering] = useState(false);

  const accountsQ = useApiQuery(
    ['finance', 'accounts', businessId, activeLocationIds],
    () => listAccountsWithBalance(businessId!, activeLocationIds),
    { enabled: ready && Boolean(businessId) },
  );
  const monthStart = useMemo(() => dayjs(today()).startOf('month').format('YYYY-MM-DD') + 'T00:00', []);
  const opsQ = useApiQuery(
    ['finance', 'operations', businessId, 'accountsMonth', activeLocationIds, monthStart],
    () => listOperations(businessId!, { locationIds: activeLocationIds, dateFrom: monthStart, cancelled: false }),
    { enabled: ready && Boolean(businessId) },
  );
  // «Последние 5 дней» и график «Выручка/Расходы» смотрят на 2 недели назад — своим окном, месяц может быть короче (F-07-001)
  const twoWeeksAgo = useMemo(() => `${addDays(today(), -13)}T00:00`, []);
  const recentOpsQ = useApiQuery(
    ['finance', 'operations', businessId, 'accountsRecent', activeLocationIds, twoWeeksAgo],
    () => listOperations(businessId!, { locationIds: activeLocationIds, dateFrom: twoWeeksAgo, cancelled: false }),
    { enabled: ready && Boolean(businessId) },
  );
  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: ready && Boolean(businessId) });

  if (accountsQ.isError || opsQ.isError || recentOpsQ.isError) {
    return <ErrorState onRetry={() => { accountsQ.refetch(); opsQ.refetch(); recentOpsQ.refetch(); }} />;
  }

  const accounts = accountsQ.data ?? [];
  const ops = opsQ.data ?? [];
  const recentOps = recentOpsQ.data ?? [];
  const items = itemsQ.data ?? [];
  const itemById = new Map(items.map((i) => [i.id, i]));
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const monthIncome = ops.filter((o) => o.kind === 'income').reduce((s, o) => s + o.amount, 0);
  const monthExpense = ops.filter((o) => o.kind === 'expense').reduce((s, o) => s + o.amount, 0);

  // Остатки по дням — 5 последних дней, каждый кликабелен (F-07-001). Ф22: главное число — ОСТАТОК всех касс на конец
  // дня (сегодняшний минус всё, что прошло позже), приход/расход дня — мелко рядом
  const last5Days = Array.from({ length: 5 }, (_, i) => addDays(today(), -i)).map((day) => {
    const dayOps = recentOps.filter((o) => o.date.slice(0, 10) === day);
    const later = recentOps.filter((o) => o.date.slice(0, 10) > day).reduce((sum, o) => sum + operationSign(o.kind) * o.amount, 0);
    return {
      day,
      closing: totalBalance - later,
      income: dayOps.filter((o) => o.kind === 'income').reduce((s, o) => s + o.amount, 0),
      expense: dayOps.filter((o) => o.kind === 'expense').reduce((s, o) => s + o.amount, 0),
    };
  });

  // График «Выручка / Расходы» по дням за 2 недели (F-07-001)
  const revenueChartData = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13)).map((day) => {
    const dayOps = recentOps.filter((o) => o.date.slice(0, 10) === day);
    return {
      day: format.date(day, 'dayMonth'),
      income: dayOps.filter((o) => o.kind === 'income').reduce((s, o) => s + o.amount, 0),
      expense: dayOps.filter((o) => o.kind === 'expense').reduce((s, o) => s + o.amount, 0),
    };
  });

  // Круговые диаграммы «детализация по основным статьям» — топ-5 статей месяца + «Остальные» (F-07-001)
  const breakdownOf = (kind: 'income' | 'expense') => {
    const byItem = new Map<string, number>();
    ops.filter((o) => o.kind === kind).forEach((o) => byItem.set(o.itemId, (byItem.get(o.itemId) ?? 0) + o.amount));
    // Пока не пришли статьи (itemsQ ещё грузится), у нескольких строк совпало бы имя «—» — ключ берём по itemId, он всегда уникален
    const rows = Array.from(byItem.entries())
      .map(([itemId, value]) => ({ key: itemId, name: itemById.get(itemId)?.name ?? '—', value }))
      .sort((a, b) => b.value - a.value);
    if (rows.length <= 6) return rows;
    const top = rows.slice(0, 5);
    const rest = rows.slice(5).reduce((s, r) => s + r.value, 0);
    return [...top, { key: 'other', name: t('accounts.breakdownChart.other'), value: rest }];
  };
  const incomeBreakdown = breakdownOf('income');
  const expenseBreakdown = breakdownOf('expense');

  const move = async (id: string, dir: -1 | 1) => {
    const sorted = [...accounts].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((a) => a.id === id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return;
    const nextOrder = [...sorted];
    [nextOrder[idx], nextOrder[swapWith]] = [nextOrder[swapWith], nextOrder[idx]];
    setReordering(true);
    try {
      await reorderAccounts(businessId!, nextOrder.map((a) => a.id));
    } catch {
      toast.error(t('accounts.reorderFailed'));
    } finally {
      setReordering(false);
    }
  };

  return (
    <div data-f="F-07-001 F-07-002 F-07-177" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('accounts.title')}
        description={t('accounts.subtitle')}
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button data-f="F-07-006" variant="secondary" leftIcon={<ArrowLeftRight aria-hidden />} onClick={() => setTransferring(true)} disabled={accounts.length < 2}>
                {t('accounts.transfer')}
              </Button>
              <Button data-f="F-07-003" leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
                {t('accounts.add')}
              </Button>
            </div>
          )
        }
      />

      {/* М1: те же три плитки и во время загрузки (StatCard loading) — ничего не прыгает */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('accounts.stats.total')} value={canViewBalance ? format.money(totalBalance) : '•••'} icon={<Wallet aria-hidden />} loading={accountsQ.isLoading || !accountsQ.data} />
        <StatCard label={t('accounts.stats.incomeMonth')} value={format.money(monthIncome)} icon={<ArrowUp aria-hidden />} loading={opsQ.isLoading || !opsQ.data} />
        <StatCard label={t('accounts.stats.expenseMonth')} value={format.money(monthExpense)} icon={<ArrowDown aria-hidden />} loading={opsQ.isLoading || !opsQ.data} />
      </div>

      {/* Ф22: сами кассы — сразу под итогами, а не внизу под графиками */}
      {accountsQ.isLoading || !accountsQ.data ? (
        <ul aria-busy className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACCOUNT_SKELETON_KINDS.map((kind, i) => (
            <AccountCardSkeleton key={i} kind={kind} canEdit={canEdit} />
          ))}
        </ul>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet aria-hidden />}
          title={t('accounts.emptyTitle')}
          description={t('accounts.emptyText')}
          action={
            canEdit ? (
              <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
                {t('accounts.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...accounts]
            .sort((a, b) => a.order - b.order)
            .map((acc, i) => {
              const Icon = KIND_ICON[acc.kind];
              return (
                <Card key={acc.id} as="li" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                        <Icon aria-hidden className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
                          <span className="truncate">{acc.name}</span>
                          {acc.systemGenerated && (
                            <Tooltip content={t('accounts.systemHint')}>
                              <span data-f="F-07-183">
                                <Badge tone="neutral" size="sm">
                                  {t('accounts.systemBadge')}
                                </Badge>
                              </span>
                            </Tooltip>
                          )}
                        </p>
                        <p className="text-xs text-muted">{t(`accounts.kind.${acc.kind}`)}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div data-f="F-07-005" className="flex shrink-0 items-center gap-0.5">
                        <IconButton size="sm" variant="ghost" icon={<ArrowUp aria-hidden />} label={t('accounts.moveUp')} onClick={() => move(acc.id, -1)} disabled={i === 0 || reordering} />
                        <IconButton size="sm" variant="ghost" icon={<ArrowDown aria-hidden />} label={t('accounts.moveDown')} onClick={() => move(acc.id, 1)} disabled={i === accounts.length - 1 || reordering} />
                        {!acc.systemGenerated && (
                          <IconButton data-f="F-07-004" size="sm" variant="ghost" icon={<Pencil aria-hidden />} label={t('accounts.edit')} onClick={() => setEditing(acc)} />
                        )}
                      </div>
                    )}
                  </div>
                  <p data-f="F-07-166" className="num-headline text-fg">{canViewBalance ? format.money(acc.balance) : '•••'}</p>
                  <p className="text-xs text-muted">{t('accounts.currentBalance')}</p>
                  {acc.kind === 'cash' && businessId && <CashShiftPanel businessId={businessId} accountId={acc.id} canEdit={canEdit || canShift} balance={canViewBalance ? acc.balance : undefined} />}
                </Card>
              );
            })}
        </ul>
      )}


      <Card data-f="F-07-001" className="flex flex-col gap-1">
        <div>
          <h3 className="font-semibold text-fg">{t('accounts.days.title')}</h3>
          <p className="text-sm text-muted">{t('accounts.days.subtitle')}</p>
        </div>
        {recentOpsQ.isLoading || !recentOpsQ.data || !accountsQ.data ? (
          // Те же пять строк дней: «сегодня» · остаток, та же высота и разделители
          <ul aria-busy className="mt-2 flex flex-col divide-y divide-border">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i}>
                <div className="-mx-1.5 flex min-h-11 items-center justify-between gap-3 px-1.5 py-2.5 text-sm">
                  <span className="font-medium text-fg">
                    <SkeletonText width="9ch" />
                  </span>
                  <span className="font-semibold text-fg tabular-nums">
                    <SkeletonText width="10ch" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {last5Days.map(({ day, closing, income, expense }) => (
              <li key={day}>
                <Link
                  href={`/biz/finance?from=${day}&to=${day}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-2.5 text-sm hover:bg-surface-2 rounded-lg px-1.5 -mx-1.5"
                >
                  <span className="font-medium text-fg">{format.relativeDay(day)}</span>
                  <span className="flex items-baseline gap-3 tabular-nums">
                    <span className="hidden text-xs sm:inline">
                      {income > 0 && <span className="text-success">+{format.money(income)}</span>}
                      {income > 0 && expense > 0 && ' · '}
                      {expense > 0 && <span className="text-muted">−{format.money(expense)}</span>}
                    </span>
                    <span className="font-semibold text-fg">{canViewBalance ? format.money(closing) : '•••'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t('accounts.revenueChart.title')}
          description={t('accounts.revenueChart.subtitle')}
          loading={recentOpsQ.isLoading}
          className="lg:col-span-2"
          height={220}
        >
          <BarChart data={revenueChartData}>
            <XAxis dataKey="day" {...chartTheme.axis} />
            <YAxis {...chartTheme.axis} width={64} tickFormatter={(v) => format.number(Number(v))} />
            <RTooltip {...chartTheme.tooltip} formatter={(v) => format.money(Number(v))} />
            <Legend {...chartTheme.legend} />
            <Bar dataKey="income" name={t('accounts.revenueChart.income')} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name={t('accounts.revenueChart.expense')} fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title={t('accounts.breakdownChart.incomeTitle')} description={t('accounts.breakdownChart.subtitle')} loading={opsQ.isLoading} height={220}>
          <PieChart>
            <Pie data={incomeBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {incomeBreakdown.map((entry, i) => (
                <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <RTooltip {...chartTheme.tooltip} formatter={(v) => format.money(Number(v))} />
            <Legend {...chartTheme.legend} />
          </PieChart>
        </ChartCard>

        <ChartCard title={t('accounts.breakdownChart.expenseTitle')} description={t('accounts.breakdownChart.subtitle')} loading={opsQ.isLoading} height={220}>
          <PieChart>
            <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {expenseBreakdown.map((entry, i) => (
                <Cell key={entry.key} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
              ))}
            </Pie>
            <RTooltip {...chartTheme.tooltip} formatter={(v) => format.money(Number(v))} />
            <Legend {...chartTheme.legend} />
          </PieChart>
        </ChartCard>
      </div>

      <AccountFormSheet
        key={editing === 'new' || editing === null ? 'new' : editing.id}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing && editing !== 'new' ? editing : undefined}
      />
      <TransferFundsSheet open={transferring} onOpenChange={setTransferring} accounts={accounts} />
    </div>
  );
}

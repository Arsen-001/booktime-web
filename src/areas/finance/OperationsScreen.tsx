'use client';

/**
 * /biz/finance — «Финансовые операции» (F-07-010/011): список с фильтрами, «Новый платёж» (F-07-012/013),
 * Excel (F-07-016/017), плашка первичной настройки (F-07-178). Адрес ?new=1 — открыть «Новый платёж» сразу
 * (плитка журнала F-07-052 ведёт сюда, пока у нас нет отдельной кнопки в шапке журнала).
 */
import { useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Columns3, Download, ExternalLink, Landmark, Minus, Plus, Upload, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDayMoneySummary, getFinanceRights, listAccounts, listItems, listOperations } from '@/api/finance';
import { useCoreList } from '@/api/core';
import { useApiQuery } from '@/api/request';
import { ImportOperationsSheet } from '@/areas/finance/operations/ImportOperationsSheet';
import { NewOperationSheet } from '@/areas/finance/operations/NewOperationSheet';
import { OperationsTotals } from '@/areas/finance/operations/OperationsTotals';
import { UnpaidVisitsCard } from '@/areas/finance/operations/UnpaidVisitsCard';
import { formatSignedMoney } from '@/areas/finance/money';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Operation, OperationKind, OperationMethod } from '@/domain/finance';
import { accountRunningBalances, compareOperationsAsc, withinDepth } from '@/domain/finance';
import { nowDateTime } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import type { DateRange } from '@/ui/Calendar';
import { Collapse } from '@/ui/Collapse';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { Popover } from '@/ui/Popover';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

const noSubscribe = () => () => {};

function hintDismissedKey(businessId: string): string {
  return `finance.onboardingDismissed.${businessId}`;
}

/** Плашка первичной настройки закрыта раньше (F-07-178) — читаем localStorage как внешнее хранилище, не setState в эффекте */
function readHintDismissed(businessId: string | undefined): boolean {
  if (!businessId) return false;
  try {
    return window.localStorage.getItem(hintDismissedKey(businessId)) === '1';
  } catch {
    return false;
  }
}

const COLUMNS_KEY = 'finance.operations.columns';
/** Колонки, которые видны по умолчанию (fin-review Ф21: 12 колонок не помещались — 1663 px при 1022) */
const DEFAULT_COLUMNS = ['date', 'item', 'account', 'method', 'party', 'amount', 'balanceAfter'];
/** Колонки, которые нельзя спрятать */
const FIXED_COLUMNS = new Set(['date', 'amount']);

let columnsSnapshot: string[] | null = null;
const columnListeners = new Set<() => void>();
function readColumns(): string[] {
  if (columnsSnapshot) return columnsSnapshot;
  try {
    const raw = window.localStorage.getItem(COLUMNS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    columnsSnapshot = Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? (parsed as string[]) : DEFAULT_COLUMNS;
  } catch {
    columnsSnapshot = DEFAULT_COLUMNS;
  }
  return columnsSnapshot;
}
function writeColumns(next: string[]) {
  columnsSnapshot = next;
  try {
    window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
  } catch {
    // приватный режим — выбор живёт до перезагрузки
  }
  columnListeners.forEach((l) => l());
}
function subscribeColumns(listener: () => void) {
  columnListeners.add(listener);
  return () => columnListeners.delete(listener);
}

export function OperationsScreen() {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, businessId, activeLocationIds, staffId } = useCurrent();
  const canEditPermission = useCan('finance.edit');
  const rightsQ = useApiQuery(['finance', 'rights', businessId, staffId], () => getFinanceRights(businessId!, staffId!), { enabled: ready && Boolean(businessId) && Boolean(staffId) });
  const rights = rightsQ.data;
  // F-07-166: «Создание/Редактирование транзакций» — без обоих кнопки нет даже с общим finance.edit
  const canEdit = canEditPermission && (rights ? rights.canEdit : true);
  const canViewBalance = rights ? rights.canViewBalance : true;

  // Адрес ?from=...&to=... открывает список сразу на нужном дне (блок «последние 5 дней», F-07-001)
  const [range, setRange] = useState<DateRange>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    return from ? { from, to: to ?? from } : {};
  });
  const [accountId, setAccountId] = useState('');
  const [itemId, setItemId] = useState('');
  // 'transfer' — оба конца перевода между кассами (fin-review Ф16)
  const [kind, setKind] = useState<OperationKind | 'transfer' | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const visibleColumns = useSyncExternalStore(subscribeColumns, readColumns, () => DEFAULT_COLUMNS);
  const [method, setMethod] = useState<OperationMethod | ''>('');
  const [showCancelled, setShowCancelled] = useState(false);
  // F-04-230: «Поиск клиента (имя или телефон)» — сверка «Оплачено» клиента по его операциям
  const [clientSearch, setClientSearch] = useState('');
  const [creating, setCreating] = useState(() => searchParams.get('new') === '1');
  // Ф19: «Расход» открывает ту же форму сразу на расходе
  const [createKind, setCreateKind] = useState<'income' | 'expense'>('income');
  const [importing, setImporting] = useState(false);
  const [hintDismissedOverride, setHintDismissedOverride] = useState<boolean | null>(null);
  // Сервер рисует плашку (у нового бизнеса она есть) — у тех, кто её не закрывал, она не выпрыгивает после загрузки (М1)
  const storedHintDismissed = useSyncExternalStore(noSubscribe, () => readHintDismissed(businessId), () => false);
  const hintDismissed = hintDismissedOverride ?? storedHintDismissed;

  useEffect(() => {
    // Адрес ?new=1 открывает «Новый платёж», ?from=&to= — сразу проставленный период; чистим адрес один раз, не трогая state здесь
    if (searchParams.get('new') === '1' || searchParams.get('from')) router.replace('/biz/finance');
  }, [searchParams, router]);

  const accountsQ = useApiQuery(['finance', 'accounts', businessId, activeLocationIds], () => listAccounts(businessId!, activeLocationIds), { enabled: ready && Boolean(businessId) });
  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: ready && Boolean(businessId) });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const opsQ = useApiQuery(
    ['finance', 'operations', businessId, activeLocationIds, range, accountId, itemId, kind, method, showCancelled, clientSearch],
    () =>
      listOperations(businessId!, {
        locationIds: activeLocationIds,
        dateFrom: range.from ? `${range.from}T00:00` : undefined,
        dateTo: range.to ? `${range.to}T23:59` : undefined,
        accountId: accountId || undefined,
        itemId: itemId || undefined,
        kind: kind && kind !== 'transfer' ? kind : undefined,
        method: method || undefined,
        cancelled: showCancelled ? undefined : false,
        search: clientSearch.trim() || undefined,
      }),
    { enabled: ready && Boolean(businessId) },
  );
  // «Остаток в кассе» (F-07-011) — считается по ВСЕМ операциям кассы, не только по отфильтрованной странице
  const allOpsQ = useApiQuery(
    ['finance', 'operations', businessId, activeLocationIds, 'allForBalance'],
    () => listOperations(businessId!, { locationIds: activeLocationIds }),
    { enabled: ready && Boolean(businessId) },
  );

  // F-07-166: «Доступ ко всем кассам» / только к выбранным — сужает и фильтр, и список
  const accounts = useMemo(() => {
    const all = accountsQ.data ?? [];
    if (!rights || rights.allAccounts) return all;
    return all.filter((a) => rights.allowedAccountIds.includes(a.id));
  }, [accountsQ.data, rights]);
  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const staffById = useMemo(() => new Map((staffQ.data ?? []).map((s) => [s.id, s])), [staffQ.data]);
  const balanceAfterById = useMemo(() => {
    const map = new Map<string, number>();
    const byAccount = new Map<string, Operation[]>();
    (allOpsQ.data ?? []).forEach((op) => {
      const list = byAccount.get(op.accountId) ?? [];
      list.push(op);
      byAccount.set(op.accountId, list);
    });
    byAccount.forEach((list, accId) => {
      const account = accountById.get(accId);
      if (!account) return;
      // fin-review Ф18: тот же порядок, что у списка (приход раньше своей комиссии) — остаток не скачет
      const sorted = [...list].sort(compareOperationsAsc);
      accountRunningBalances(account.openingBalance, sorted).forEach((balance, opId) => map.set(opId, balance));
    });
    return map;
  }, [allOpsQ.data, accountById]);

  if (accountsQ.isError || itemsQ.isError || opsQ.isError) {
    return <ErrorState onRetry={() => { accountsQ.refetch(); itemsQ.refetch(); opsQ.refetch(); }} />;
  }

  // F-07-166: сужение до разрешённых касс + глубина просмотра назад («Просмотр движений средств»)
  const allowedAccountIds = rights && !rights.allAccounts ? new Set(rights.allowedAccountIds) : null;
  const now = nowDateTime();
  const ops = (opsQ.data ?? []).filter(
    (op) =>
      (!allowedAccountIds || allowedAccountIds.has(op.accountId)) &&
      (!rights || withinDepth(op.date, rights.viewDepth, now)) &&
      (kind !== 'transfer' || op.kind === 'transfer_in' || op.kind === 'transfer_out'),
  );
  // Ф17: постраничный вывод — страница за пределами после смены фильтра прижимается к последней
  const pageCount = Math.max(1, Math.ceil(ops.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageOps = ops.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const itemName = (op: Operation) => (op.kind === 'transfer_in' || op.kind === 'transfer_out' ? t('operations.transferItem') : (itemById.get(op.itemId)?.name ?? '—'));
  const activeCount = [range.from, accountId, itemId, kind, method, showCancelled || undefined, clientSearch.trim() || undefined].filter(Boolean).length;
  const resetFilters = () => {
    setRange({});
    setAccountId('');
    setItemId('');
    setKind('');
    setMethod('');
    setShowCancelled(false);
    setClientSearch('');
    setPage(1);
  };

  const dismissHint = () => {
    setHintDismissedOverride(true);
    try {
      if (businessId) window.localStorage.setItem(hintDismissedKey(businessId), '1');
    } catch {
      // localStorage может быть недоступен (приватный режим) — просто не запоминаем
    }
  };

  // F-07-016 — выгрузка содержит ВСЕ колонки списка операций за период (все 12, не только видимые в таблице)
  const exportCsv = () => {
    const csv = toCsv(
      ops.map((op) => [
        `${format.date(op.date, 'short')}, ${format.time(op.date)}`,
        op.docNumber ?? '',
        itemName(op),
        accountById.get(op.accountId)?.name ?? '',
        t(`operations.method.${op.method}`),
        op.partyName ?? '',
        op.lineLabel ?? '',
        op.comment ?? '',
        op.createdBy === 'system' ? t('operations.systemAuthor') : (staffById.get(op.createdBy)?.name ?? op.createdBy),
        op.cancelled ? t('operations.cancelledShort') : formatSignedMoney(op.amount, op.kind),
        canViewBalance ? (balanceAfterById.get(op.id) !== undefined ? format.money(balanceAfterById.get(op.id) as number) : '') : '',
        op.source === 'booking' && op.refId ? op.refId : '',
      ]),
      [
        t('operations.columns.date'),
        t('operations.columns.docNumber'),
        t('operations.columns.item'),
        t('operations.columns.account'),
        t('operations.columns.method'),
        t('operations.columns.party'),
        t('operations.columns.lineItem'),
        t('operations.columns.comment'),
        t('operations.columns.author'),
        t('operations.columns.amount'),
        t('operations.columns.balanceAfter'),
        t('operations.columns.visit'),
      ],
    );
    downloadCsv('operations.csv', csv);
    toast.success(t('operations.exported'));
  };

  const columns: TableColumn<Operation>[] = [
    {
      id: 'date',
      header: t('operations.columns.date'),
      cell: (op) => (
        <Link href={`/biz/finance/operations/${op.id}`} className="inline-flex min-h-10 items-center whitespace-nowrap text-primary-text underline decoration-border-strong underline-offset-2">
          {format.date(op.date, 'short')}, {format.time(op.date)}
        </Link>
      ),
      sortable: true,
      sortValue: (op) => op.date,
      mobile: 'title',
      width: '10.5rem',
      // Ссылка высотой 40 px — скелетон той же высоты (и в строке таблицы, и в заголовке карточки на телефоне)
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="13ch" />
        </span>
      ),
    },
    { id: 'docNumber', header: t('operations.columns.docNumber'), cell: (op) => op.docNumber ?? '—', mobile: 'hidden', width: '7rem', skeletonWidth: '6ch' },
    {
      id: 'item',
      header: t('operations.columns.item'),
      // Одна строка: длинная статья обрезается, плашка источника не переносится — строки таблицы одной высоты
      cell: (op) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{itemName(op)}</span>
          {op.source !== 'manual' && (
            <Badge data-f="F-07-018" tone="neutral" variant="outline" size="sm" className="shrink-0">
              {t(`operations.source.${op.source}`)}
            </Badge>
          )}
        </span>
      ),
      mobile: 'subtitle',
      width: '13rem',
      // max-w-0 у ячейки: колонка держит заданную ширину, длинное обрезается (иначе авто-таблица растягивает колонку)
      className: 'max-w-0',
      skeletonWidth: '16ch',
    },
    { id: 'account', header: t('operations.columns.account'), cell: (op) => <OneLine>{accountById.get(op.accountId)?.name ?? '—'}</OneLine>, mobile: 'meta', width: '9rem', className: 'max-w-0', skeletonWidth: '10ch' },
    { id: 'method', header: t('operations.columns.method'), cell: (op) => t(`operations.method.${op.method}`), mobile: 'hidden', width: '7rem', skeletonWidth: '7ch' },
    { id: 'party', header: t('operations.columns.party'), cell: (op) => <OneLine>{op.partyName ?? '—'}</OneLine>, mobile: 'meta', width: '11rem', className: 'max-w-0', skeletonWidth: '14ch' },
    { id: 'lineItem', header: t('operations.columns.lineItem'), cell: (op) => <OneLine>{op.lineLabel ?? '—'}</OneLine>, mobile: 'hidden', width: '12rem', className: 'max-w-0', skeletonWidth: '12ch' },
    { id: 'comment', header: t('operations.columns.comment'), cell: (op) => <OneLine>{op.comment ?? '—'}</OneLine>, mobile: 'hidden', width: '12rem', className: 'max-w-0', skeletonWidth: '12ch' },
    {
      id: 'author',
      header: t('operations.columns.author'),
      cell: (op) => <OneLine>{op.createdBy === 'system' ? t('operations.systemAuthor') : (staffById.get(op.createdBy)?.name ?? op.createdBy)}</OneLine>,
      mobile: 'hidden',
      width: '10rem',
      skeletonWidth: '11ch',
      className: 'max-w-0',
    },
    {
      id: 'amount',
      header: t('operations.columns.amount'),
      cell: (op) =>
        op.cancelled ? (
          <Badge tone="neutral" size="sm">
            {t('operations.cancelledShort')}
          </Badge>
        ) : (
          <span className={op.kind === 'income' || op.kind === 'transfer_in' ? 'font-semibold whitespace-nowrap text-success' : 'font-semibold whitespace-nowrap text-fg'}>{formatSignedMoney(op.amount, op.kind)}</span>
        ),
      align: 'right',
      sortable: true,
      sortValue: (op) => op.amount,
      mobile: 'aside',
      width: '8.5rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'balanceAfter',
      header: t('operations.columns.balanceAfter'),
      cell: (op) => {
        if (!canViewBalance) return <span className="tabular-nums text-muted">•••</span>;
        const balance = balanceAfterById.get(op.id);
        return <span className="whitespace-nowrap tabular-nums">{balance === undefined ? '—' : format.money(balance)}</span>;
      },
      align: 'right',
      mobile: 'hidden',
      width: '8.5rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'visit',
      header: t('operations.columns.visit'),
      cell: (op) =>
        op.source === 'booking' && op.refId ? (
          <Link href={`/biz/journal?booking=${op.refId}`} className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap text-primary-text underline decoration-border-strong underline-offset-2">
            {t('operations.openVisit')} <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        ) : (
          '—'
        ),
      mobile: 'hidden',
      width: '8rem',
      skeletonWidth: '7ch',
    },
  ];
  const shownColumns = columns.filter((c) => FIXED_COLUMNS.has(c.id) || visibleColumns.includes(c.id));
  const toggleColumn = (id: string, on: boolean) => writeColumns(on ? [...visibleColumns.filter((c) => c !== id), id] : visibleColumns.filter((c) => c !== id));

  return (
    <div data-f="F-07-010 F-07-011 F-07-177 F-07-185" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('operations.title')}
        description={t('operations.subtitle')}
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <DropdownMenu
                trigger={(p) => (
                  <Button data-f="F-07-016 F-07-017" variant="secondary" {...p}>
                    {t('operations.excel')}
                  </Button>
                )}
                items={[
                  { id: 'export', label: t('operations.export'), icon: <Download aria-hidden />, onSelect: exportCsv },
                  { id: 'import', label: t('operations.import'), icon: <Upload aria-hidden />, onSelect: () => setImporting(true) },
                ]}
              />
              <Button
                variant="secondary"
                leftIcon={<Minus aria-hidden />}
                onClick={() => {
                  setCreateKind('expense');
                  setCreating(true);
                }}
              >
                {t('operations.addExpense')}
              </Button>
              <Button
                data-f="F-07-012"
                leftIcon={<Plus aria-hidden />}
                onClick={() => {
                  setCreateKind('income');
                  setCreating(true);
                }}
              >
                {t('operations.add')}
              </Button>
            </div>
          )
        }
      />

      {!hintDismissed && canEdit && (
        <div data-f="F-07-178" className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3.5">
          <Landmark aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-text" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{t('onboarding.title')}</p>
            <p className="mt-0.5 text-sm text-muted">{t('onboarding.text')}</p>
            <LinkButton href="/biz/finance/accounts" variant="ghost" size="sm" className="mt-2 -ml-2">
              {t('onboarding.action')}
            </LinkButton>
          </div>
          <Button variant="ghost" size="sm" onClick={dismissHint} className="shrink-0" aria-label={t('onboarding.dismiss')}>
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <DayMoneySummaryCard businessId={businessId} activeLocationIds={activeLocationIds} staffId={staffId} ready={ready} />

      <UnpaidVisitsCard businessId={businessId} activeLocationIds={activeLocationIds} ready={ready} />

      <FilterBar
        filters={[
          { id: 'period', label: t('operations.filters.period'), primary: true, node: <DateRangePicker value={range} onValueChange={setRange} presets placeholder={t('operations.filters.period')} /> },
          {
            id: 'client',
            label: t('operations.filters.client'),
            node: (
              <div data-f="F-04-230">
                <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder={t('operations.filters.clientPlaceholder')} />
              </div>
            ),
          },
          { id: 'account', label: t('operations.filters.account'), node: <Select options={[{ value: '', label: t('operations.filters.allAccounts') }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} value={accountId} onValueChange={setAccountId} /> },
          { id: 'item', label: t('operations.filters.item'), node: <Select options={[{ value: '', label: t('operations.filters.allItems') }, ...items.map((i) => ({ value: i.id, label: i.name }))]} value={itemId} onValueChange={setItemId} /> },
          {
            id: 'kind',
            label: t('operations.filters.kind'),
            node: (
              <Select
                options={[
                  { value: '', label: t('operations.filters.allKinds') },
                  { value: 'income', label: t('items.incomeGroup') },
                  { value: 'expense', label: t('items.expenseGroup') },
                  { value: 'transfer', label: t('operations.filters.transfer') },
                ]}
                value={kind}
                onValueChange={(v) => {
                  setKind(v as OperationKind | 'transfer' | '');
                  setPage(1);
                }}
              />
            ),
          },
          {
            id: 'method',
            label: t('operations.filters.method'),
            node: (
              <Select
                options={[
                  { value: '', label: t('operations.filters.allMethods') },
                  { value: 'cash', label: t('operations.method.cash') },
                  { value: 'card', label: t('operations.method.card') },
                  { value: 'transfer', label: t('operations.method.transfer') },
                  { value: 'other', label: t('operations.method.other') },
                ]}
                value={method}
                onValueChange={(v) => setMethod(v as OperationMethod | '')}
              />
            ),
          },
          {
            id: 'cancelled',
            label: t('operations.filters.cancelled'),
            node: (
              <Select
                options={[
                  { value: '0', label: t('operations.filters.activeOnly') },
                  { value: '1', label: t('operations.filters.withCancelled') },
                ]}
                value={showCancelled ? '1' : '0'}
                onValueChange={(v) => setShowCancelled(v === '1')}
              />
            ),
          },
        ]}
        activeCount={activeCount}
        onReset={resetFilters}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <OperationsTotals ops={ops} accountFiltered={Boolean(accountId)} loading={opsQ.isLoading} />
        <Popover
          label={t('operations.columnsPick')}
          trigger={(p) => (
            <Button variant="secondary" size="sm" leftIcon={<Columns3 aria-hidden />} className="hidden md:inline-flex" {...p}>
              {t('operations.columnsPick')}
            </Button>
          )}
        >
          <div className="flex w-64 flex-col gap-1 p-2">
            {columns
              .filter((c) => !FIXED_COLUMNS.has(c.id))
              .map((c) => (
                <Checkbox key={c.id} checked={visibleColumns.includes(c.id)} onCheckedChange={(on) => toggleColumn(c.id, on)} label={c.header} classNames={{ root: 'min-h-10 px-2' }} />
              ))}
          </div>
        </Popover>
      </div>

      <Table
        columns={shownColumns}
        rows={pageOps}
        // Страницы — свои (Ф17), встроенные у таблицы выключены
        pagination={false}
        rowKey={(op) => op.id}
        loading={opsQ.isLoading || accountsQ.isLoading || itemsQ.isLoading || staffQ.isLoading}
        loadingRows={pageSize}
        label={t('operations.title')}
        empty={
          <EmptyState
            kind={activeCount > 0 ? 'search' : 'default'}
            title={activeCount > 0 ? undefined : t('operations.emptyTitle')}
            description={activeCount > 0 ? undefined : t('operations.emptyText')}
            onReset={activeCount > 0 ? resetFilters : undefined}
            action={
              activeCount === 0 && canEdit ? (
                <Button leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
                  {t('operations.add')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      {ops.length > DEFAULT_PAGE_SIZE && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={ops.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      <NewOperationSheet open={creating} onOpenChange={setCreating} initialKind={createKind} />
      <ImportOperationsSheet open={importing} onOpenChange={setImporting} />
    </div>
  );
}

/**
 * Сводка денег за день (F-07-046) — в Altegio это кнопка «‹сумма› ▾» в шапке журнала; журнал — не наш путь
 * (`src/app/biz/journal/**`), поэтому здесь тот же снимок дня прямо в финансовых операциях, за правом
 * «Показывать статистику» (FinanceRights.canSeeJournalStats).
 */
function DayMoneySummaryCard({ businessId, activeLocationIds, staffId, ready }: { businessId?: string; activeLocationIds: string[]; staffId?: string; ready: boolean }) {
  const t = useT('finance');
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const today = nowDateTime().slice(0, 10);

  const rightsQ = useApiQuery(['finance', 'rights', businessId, staffId], () => getFinanceRights(businessId!, staffId!), { enabled: ready && Boolean(businessId) && Boolean(staffId) });
  const canSeeStats = rightsQ.data?.canSeeJournalStats ?? true;
  const summaryQ = useApiQuery(['finance', 'daySummary', businessId, today, activeLocationIds.join(',')], () => getDayMoneySummary(businessId!, today, activeLocationIds), { enabled: ready && Boolean(businessId) && canSeeStats });

  // Нет права — блока нет; пока бизнес/права не известны — рамка того же размера со скелетоном (fin-review М1)
  if (!canSeeStats) return null;
  const loading = !ready || !businessId || summaryQ.isLoading || !summaryQ.data;

  // Кассa за день — «заголовок» карточки: крупная сумма (num-headline), как строка итогов дня в журнале (DESIGN.md)
  return (
    <div data-f="F-07-046 F-06-173" className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60 sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
            <Wallet aria-hidden className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted">{t('daySummary.trigger')}</span>
            <span className="num-headline block text-fg">{loading || !summaryQ.data ? <SkeletonText width="8ch" /> : format.money(summaryQ.data.totalIn)}</span>
          </span>
        </span>
        <DropdownChevron open={open} className="mr-0.5" />
      </button>
      <Collapse open={open} id={bodyId}>
        <div className="border-t border-border px-4 pt-3.5 pb-4 sm:px-5">
          {summaryQ.isLoading || !summaryQ.data ? (
            <Skeleton lines={4} />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                {format.date(today, 'short')} · {t('daySummary.clients', { count: summaryQ.data.clientsCount })}
              </p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                <SummaryRow label={t('daySummary.cashIn')} value={format.money(summaryQ.data.cashIn)} />
                <SummaryRow label={t('daySummary.cardIn')} value={format.money(summaryQ.data.cardIn)} />
                <SummaryRow label={t('daySummary.doneTotal')} value={format.money(summaryQ.data.doneTotal)} />
                <SummaryRow label={t('daySummary.recordsTotal')} value={format.money(summaryQ.data.recordsTotal)} />
                <SummaryRow label={t('daySummary.loyaltyTotal')} value={format.money(summaryQ.data.loyaltyTotal)} />
                <SummaryRow label={t('daySummary.goodsTotal')} value={format.money(summaryQ.data.goodsTotal)} />
              </dl>
            </>
          )}
        </div>
      </Collapse>
    </div>
  );
}

/** Текст ячейки в одну строку: длинное обрезается, а не растит строку таблицы */
function OneLine({ children }: { children: ReactNode }) {
  return <span className="block truncate">{children}</span>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="num-md tabular-nums text-fg">{value}</dd>
    </div>
  );
}

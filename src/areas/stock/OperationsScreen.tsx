'use client';

/**
 * /biz/stock/operations — журнал складских операций (F-08-046 фильтры, F-08-047 колонки, F-08-048
 * меню «Операции с товарами» — создание форм самих операций пачка b02, здесь только вход в меню).
 */
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, History as HistoryIcon } from 'lucide-react';
import {
  exportOperationsCsv,
  historyCutoffDate,
  listOperationHistory,
  listOperations,
  listWarehouses,
  warehouseAllowed,
  type OperationFilters,
  type OperationRow,
} from '@/api/stock';
import { downloadCsv } from '@/lib/csv';
import { useApiQuery } from '@/api/request';
import { useCoreList } from '@/api/core';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { OPERATION_TYPE_LABELS, unitById, type OperationType } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { formatQty, warehouseLabel } from '@/areas/stock/warehouse.utils';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';
import { useFormat } from '@/i18n/useFormat';
import { addDays, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { ErrorState } from '@/ui/ErrorState';
import { EmptyState } from '@/ui/EmptyState';
import { FilterBar } from '@/ui/FilterBar';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { Button } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';
import { useDebouncedValue } from '@/areas/stock/useDebouncedValue';

const TYPE_TONE: Record<OperationType, 'success' | 'accent' | 'danger' | 'warning' | 'neutral'> = {
  income: 'success',
  sale: 'accent',
  writeoffService: 'warning',
  writeoffProduct: 'danger',
  move: 'neutral',
};

function OperationHistoryButton({ businessId, docId, docNumber }: { businessId: Id; docId: Id; docNumber: string }) {
  const t = useT('stock');
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const q = useApiQuery(['stock', 'operationHistory', businessId, docId], () => listOperationHistory(businessId, docId), { enabled: open });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t('operations.columns.showHistory')}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={t('operations.history.title', { number: docNumber })} size="sm">
        {q.isLoading ? (
          <Skeleton lines={3} />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState compact icon={<HistoryIcon aria-hidden />} title={t('operations.history.empty')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {(q.data ?? []).map((h) => (
              <li key={h.id} className="text-sm">
                <p className="text-fg">{h.summary}</p>
                <p className="text-xs text-muted">
                  {h.staffName} · {format.dateTime(h.at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

export function OperationsScreen() {
  const t = useT('stock');
  const router = useRouter();
  const format = useFormat();
  const { lang } = useDemo();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [range, setRange] = useState<{ from: string; to: string }>({ from: addDays(today(), -30), to: today() });
  const [type, setType] = useState<OperationType | ''>('');
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [paid, setPaid] = useState<'' | 'paid' | 'unpaid'>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Ск2: «Движение товара» из карточки — журнал сразу по одному товару
  const goodId = useSearchParams().get('good') ?? undefined;
  // М2: текстовые поля фильтров уходят в запрос после паузы в наборе, а не на каждую букву
  const searchQ = useDebouncedValue(search);
  const docNumberQ = useDebouncedValue(docNumber);
  const counterpartyQ = useDebouncedValue(counterparty);
  const clientSearchQ = useDebouncedValue(clientSearch);

  // F-08-109…113: доступ ко складам, срок «назад» и права на экспорт/действия — из мелких прав сотрудника
  const perm = useStockPermissions();
  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const allowedWarehouses = (warehousesQ.data ?? []).filter((w) => warehouseAllowed(perm, w.id));
  const cutoff = historyCutoffDate(perm);
  const effectiveFrom = cutoff && (!range.from || cutoff > range.from) ? cutoff : range.from;
  const servicesQ = useCoreList('services', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const filters: OperationFilters = {
    dateFrom: effectiveFrom ? `${effectiveFrom}T00:00` : undefined,
    dateTo: range.to,
    type: type || undefined,
    warehouseId: warehouseId || undefined,
    search: searchQ || undefined,
    docNumber: docNumberQ || undefined,
    counterparty: counterpartyQ || undefined,
    clientSearch: clientSearchQ || undefined,
    goodId,
    serviceId: serviceId || undefined,
    paid: paid || undefined,
    page,
    pageSize,
  };
  const opsQ = useApiQuery(['stock', 'operations', businessId, locationId, filters], () => listOperations(businessId!, locationId!, filters), {
    enabled,
  });

  // F-08-041/042: автосписания по визитам «пришёл» синхронизирует сам listOperations (как и любое чтение остатков, Ск1)

  if (opsQ.isError) return <ErrorState onRetry={opsQ.refetch} />;

  const rows = opsQ.data?.items ?? [];
  const total = opsQ.data?.total ?? 0;
  const activeCount = [type, warehouseId, docNumber, counterparty, clientSearch, serviceId, paid, goodId].filter(Boolean).length;
  const resetFilters = () => {
    if (goodId) router.replace('/biz/stock/operations');
    setType('');
    setWarehouseId('');
    setDocNumber('');
    setCounterparty('');
    setClientSearch('');
    setServiceId('');
    setPaid('');
    setPage(1);
  };

  const openDoc = (r: OperationRow) => {
    if (r.bookingId) router.push(`/biz/journal?booking=${r.bookingId}`);
  };

  const exportExcel = async () => {
    const csv = await exportOperationsCsv(businessId!, locationId!, filters);
    downloadCsv('stock-operations.csv', csv);
  };

  const columns: TableColumn<OperationRow>[] = [
    {
      id: 'type',
      header: t('operations.columns.type'),
      mobile: 'badge',
      width: '13.5rem',
      cell: (r) => (
        <Badge tone={TYPE_TONE[r.type]} size="sm">
          {OPERATION_TYPE_LABELS[r.type].ru}
        </Badge>
      ),
      // Плашка типа — той же высоты и типичной ширины («Списание расходников»)
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="20.3ch" />
        </Badge>
      ),
    },
    {
      id: 'date',
      header: t('operations.columns.date'),
      mobile: 'meta',
      sortable: true,
      sortValue: (r) => r.date,
      width: '10.5rem',
      // Дата-ссылка на визит выше строки текста (h-6 в строке) — скелетон той же высоты
      skeleton: <span className="inline-flex h-6 items-center"><SkeletonText width="15ch" /></span>,
      cell: (r) =>
        r.bookingId ? (
          <button
            type="button"
            className="-my-2.5 inline-flex min-h-11 items-center py-2.5 whitespace-nowrap text-primary-text underline underline-offset-2 hover:no-underline"
            onClick={(e) => {
              e.stopPropagation();
              openDoc(r);
            }}
          >
            {format.date(r.date, 'short')} {format.time(r.date)}
          </button>
        ) : (
          <span className="whitespace-nowrap">
            {format.date(r.date, 'short')} {format.time(r.date)}
          </span>
        ),
    },
    {
      id: 'number',
      header: t('operations.columns.number'),
      mobile: 'hidden',
      width: '8.5rem',
      skeletonWidth: '6ch',
      cell: (r) => (
        <button
          type="button"
          className="-my-2.5 inline-flex min-h-11 items-center py-2.5 text-fg underline underline-offset-2 hover:text-primary-text hover:no-underline"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/biz/stock/operations/${r.docId}`);
          }}
        >
          {r.number}
        </button>
      ),
    },
    // Длинный текст — многоточием в пределах колонки: строка одной высоты, колонка не шире заданной
    { id: 'counterparty', header: t('operations.columns.counterparty'), mobile: 'hidden', width: '13.5rem', cell: (r) => <span className="block max-w-[11.5rem] truncate">{r.counterpartyOrClient || '—'}</span> },
    { id: 'warehouse', header: t('operations.columns.warehouse'), mobile: 'hidden', width: '9rem', cell: (r) => <span className="block max-w-[7rem] truncate">{r.warehouseName}</span> },
    { id: 'comment', header: t('operations.columns.comment'), mobile: 'hidden', width: '10rem', cell: (r) => <span className="block max-w-[8rem] truncate">{r.comment || '—'}</span> },
    {
      id: 'good',
      header: t('operations.columns.good'),
      mobile: 'title',
      width: '14rem',
      cell: (r) => (
        <button
          type="button"
          className="-my-2.5 inline-flex min-h-11 max-w-full items-center py-2.5 text-left text-fg underline underline-offset-2 hover:text-primary-text hover:no-underline md:max-w-[12rem]"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/biz/stock/goods/${r.goodId}`);
          }}
        >
          <span className="truncate">{r.goodName}</span>
        </button>
      ),
    },
    {
      id: 'qty',
      header: t('operations.columns.qty'),
      mobile: 'subtitle',
      align: 'right',
      width: '8.5rem',
      className: 'whitespace-nowrap',
      cell: (r) => `${r.qtySale > 0 ? '+' : ''}${formatQty(r.qtySale)} ${pickText(unitById(r.saleUnit).short, lang)}`,
    },
    // F-08-110: себестоимость скрыта без права «Просмотр себестоимости»
    ...(perm.viewCost
      ? ([
          { id: 'cost', header: t('operations.columns.cost'), mobile: 'aside', align: 'right', width: '9.5rem', className: 'whitespace-nowrap', cell: (r) => format.money(Math.abs(r.costTotal)) },
        ] as TableColumn<OperationRow>[])
      : []),
    {
      id: 'stockAfter',
      header: t('operations.columns.stockAfter'),
      mobile: 'hidden',
      align: 'right',
      width: '9.5rem',
      // F-08-061: отрицательный остаток — красным
      cell: (r) => (r.stockAfter < 0 ? <span className="font-medium text-danger">{formatQty(r.stockAfter)}</span> : formatQty(r.stockAfter)),
    },
    {
      id: 'visit',
      header: t('operations.columns.visit'),
      mobile: 'hidden',
      width: '11rem',
      // Строка с кнопкой (h-9) выше строки текста — скелетон той же высоты
      skeleton: <span className="inline-flex h-9 items-center"><SkeletonText width="9ch" /></span>,
      cell: (r) =>
        r.bookingId ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openDoc(r);
            }}
          >
            {t('operations.columns.openVisit')}
          </Button>
        ) : (
          '—'
        ),
    },
    {
      id: 'history',
      header: t('operations.columns.history'),
      mobile: 'hidden',
      width: '10rem',
      skeleton: <span className="inline-flex h-9 items-center"><SkeletonText width="9ch" /></span>,
      cell: (r) => (businessId ? <OperationHistoryButton businessId={businessId} docId={r.docId} docNumber={r.number} /> : null),
    },
  ];

  return (
    <div
      data-f="F-08-046 F-08-047 F-08-048 F-08-053 F-08-061 F-08-109 F-08-110 F-08-111 F-08-112 F-08-113 F-08-143 F-08-145 F-12-063"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader
        title={t('operations.title')}
        description={t('operations.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <HelpArticleButton titleKey="help.operations.title" bodyKey="help.operations.body" />
            {/* F-08-113: выгрузка в Excel только с правом */}
            {perm.excelExport && (
              <Button variant="secondary" onClick={exportExcel} disabled={rows.length === 0}>
                {t('operations.exportExcel')}
              </Button>
            )}
            {/* F-08-112: создание и перемещение — по отдельным правам */}
            {(perm.canCreateOps || perm.canMoveOps) && (
              <DropdownMenu
                trigger={(props) => <Button {...props}>{t('operations.newOperation')}</Button>}
                items={[
                  ...(perm.canCreateOps
                    ? [
                        { id: 'income', label: t('operations.menu.income'), onSelect: () => router.push('/biz/stock/operations/new/income') },
                        { id: 'writeoff', label: t('operations.menu.writeoff'), onSelect: () => router.push('/biz/stock/operations/new/write-off') },
                        { id: 'sale', label: t('operations.menu.sale'), onSelect: () => router.push('/biz/stock/operations/new/sale') },
                      ]
                    : []),
                  ...(perm.canMoveOps
                    ? [{ id: 'move', label: t('operations.menu.move'), onSelect: () => router.push('/biz/stock/operations/new/move') }]
                    : []),
                ]}
              />
            )}
          </div>
        }
      />

      {/* F-08-046/047: заголовок-число вместо строки текста — сколько документов попало под текущие фильтры */}
      <StatCard
        className="sm:max-w-xs"
        label={t('operations.stats.found')}
        value={format.number(total)}
        icon={<ClipboardList aria-hidden />}
        loading={opsQ.isLoading}
      />

      <FilterBar
        search={{
          value: search,
          onValueChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: t('operations.searchGoodPlaceholder'),
        }}
        activeCount={activeCount}
        onReset={resetFilters}
        filters={[
          {
            id: 'range',
            label: t('operations.filters.period'),
            primary: true,
            node: <DateRangePicker value={range} onValueChange={(v) => setRange({ from: v.from ?? '', to: v.to ?? '' })} />,
          },
          {
            id: 'type',
            label: t('operations.filters.type'),
            node: (
              <Select
                options={[
                  { value: '', label: t('operations.filters.allTypes') },
                  ...Object.entries(OPERATION_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l.ru })),
                ]}
                value={type}
                onValueChange={(v) => {
                  setType(v as OperationType | '');
                  setPage(1);
                }}
              />
            ),
          },
          {
            id: 'warehouse',
            label: t('operations.filters.warehouse'),
            node: (
              <Select
                options={[
                  { value: '', label: t('operations.filters.allWarehouses') },
                  ...allowedWarehouses.map((w) => ({ value: w.id, label: warehouseLabel(w, t) })),
                ]}
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId(v);
                  setPage(1);
                }}
              />
            ),
          },
          {
            id: 'counterparty',
            label: t('operations.filters.counterparty'),
            node: (
              <Input
                value={counterparty}
                onChange={(e) => {
                  setCounterparty(e.target.value);
                  setPage(1);
                }}
                placeholder={t('operations.filters.counterpartyPlaceholder')}
              />
            ),
          },
          {
            id: 'client',
            label: t('operations.filters.client'),
            node: (
              <Input
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('operations.filters.clientPlaceholder')}
              />
            ),
          },
          {
            id: 'service',
            label: t('operations.filters.service'),
            node: (
              <Select
                options={[
                  { value: '', label: t('operations.filters.allServices') },
                  ...(servicesQ.data ?? []).map((s) => ({ value: s.id, label: pickText(s.name, lang) })),
                ]}
                value={serviceId}
                onValueChange={(v) => {
                  setServiceId(v);
                  setPage(1);
                }}
              />
            ),
          },
          {
            id: 'paid',
            label: t('operations.filters.paid'),
            node: (
              <Select
                options={[
                  { value: '', label: t('operations.filters.allPaid') },
                  { value: 'paid', label: t('operations.filters.paidOnly') },
                  { value: 'unpaid', label: t('operations.filters.unpaidOnly') },
                ]}
                value={paid}
                onValueChange={(v) => {
                  setPaid(v as 'paid' | 'unpaid' | '');
                  setPage(1);
                }}
              />
            ),
          },
          {
            id: 'docNumber',
            label: t('operations.filters.docNumber'),
            node: (
              <Input
                value={docNumber}
                onChange={(e) => {
                  setDocNumber(e.target.value);
                  setPage(1);
                }}
                placeholder={t('operations.filters.docNumberPlaceholder')}
              />
            ),
          },
        ]}
      />

      {rows.length === 0 && !opsQ.isLoading ? (
        <EmptyState
          kind={activeCount || search ? 'search' : 'default'}
          icon={<ClipboardList aria-hidden />}
          title={activeCount || search ? t('operations.notFoundTitle') : t('operations.emptyTitle')}
          description={activeCount || search ? t('operations.notFoundText') : t('operations.emptyText')}
        />
      ) : (
        <>
          {/* Страницы отдаёт сервер — встроенные у таблицы выключены */}
          <Table columns={columns} rows={rows} rowKey={(r) => `${r.docId}_${r.goodId}`} loading={opsQ.isLoading} loadingRows={pageSize} pagination={false} />
          {total > DEFAULT_PAGE_SIZE && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

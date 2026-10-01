'use client';

/** /biz/finance/counterparties — контрагенты (F-07-019…023): список, поиск, Excel, расчёты. */
import { useMemo, useState } from 'react';
import { Building2, Download, Plus, Upload } from 'lucide-react';
import { listCounterparties, listOperations } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { CounterpartyFormSheet } from '@/areas/finance/counterparties/CounterpartyFormSheet';
import { ImportCounterpartiesSheet } from '@/areas/finance/counterparties/ImportCounterpartiesSheet';
import { useCan, useCurrent } from '@/demo/hooks';
import { counterpartyBalance } from '@/domain/finance';
import type { Counterparty } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { normalizeSearch } from '@/lib/text';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

interface Row extends Counterparty {
  balance: number;
}

export function CounterpartiesScreen() {
  const t = useT('finance');
  const toast = useToast();
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Counterparty | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const listQ = useApiQuery(['finance', 'counterparties', businessId], () => listCounterparties(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const opsQ = useApiQuery(
    ['finance', 'operations', businessId, 'forCounterparties'],
    () => listOperations(businessId!, { partyType: 'counterparty' }),
    { enabled: ready && Boolean(businessId) },
  );

  const rows: Row[] = useMemo(() => {
    const list = listQ.data ?? [];
    const ops = opsQ.data ?? [];
    return list.map((cp) => ({ ...cp, balance: counterpartyBalance(ops.filter((o) => o.partyId === cp.id)) }));
  }, [listQ.data, opsQ.data]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = normalizeSearch(search);
    return rows.filter((r) => normalizeSearch(`${r.name} ${r.phone ?? ''} ${r.inn ?? ''}`).includes(q));
  }, [rows, search]);

  if (listQ.isError || opsQ.isError)
    return (
      <ErrorState
        onRetry={() => {
          listQ.refetch();
          opsQ.refetch();
        }}
      />
    );

  const exportCsv = () => {
    const csv = toCsv(
      filtered.map((r) => [r.name, t(`counterparties.type.${r.type}`), r.inn ?? '', r.phone ?? '', r.email ?? '', r.balance]),
      [
        t('counterparties.columns.name'),
        t('counterparties.columns.type'),
        t('counterparties.columns.inn'),
        t('counterparties.columns.phone'),
        t('counterparties.columns.email'),
        t('counterparties.columns.balance'),
      ],
    );
    downloadCsv('counterparties.csv', csv);
    toast.success(t('counterparties.exported'));
  };

  const columns: TableColumn<Row>[] = [
    { id: 'name', header: t('counterparties.columns.name'), cell: (r) => <span className="block truncate">{r.name}</span>, mobile: 'title', width: '20rem', skeletonWidth: '22ch', className: 'max-w-0' },
    { id: 'type', header: t('counterparties.columns.type'), cell: (r) => t(`counterparties.type.${r.type}`), mobile: 'meta', width: '10rem', skeletonWidth: '9ch' },
    { id: 'phone', header: t('counterparties.columns.phone'), cell: (r) => (r.phone ? format.phone(r.phone) : '—'), mobile: 'meta', width: '11rem', skeletonWidth: '15ch' },
    {
      id: 'balance',
      header: t('counterparties.columns.balance'),
      // Ф27: минус — вы заплатили контрагенту больше, чем получили от него; подпись прямо под суммой
      cell: (r) => (
        <span className="flex flex-col items-end">
          <span className={r.balance < 0 ? 'font-semibold text-danger' : 'font-semibold text-fg'}>{format.money(r.balance)}</span>
          {/* Строка подписи есть всегда (при нуле — пустая): строки таблицы одной высоты, скелетон совпадает */}
          <span className="text-xs text-muted">{r.balance === 0 ? '\u00a0' : r.balance < 0 ? t('counterparties.balancePaidShort') : t('counterparties.balanceReceivedShort')}</span>
        </span>
      ),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.balance,
      mobile: 'aside',
      width: '11rem',
      skeleton: (
        <span className="flex flex-col items-end">
          <span className="font-semibold text-fg">
            <SkeletonText width="9ch" />
          </span>
          <span className="text-xs text-muted">
            <SkeletonText width="11ch" />
          </span>
        </span>
      ),
    },
  ];

  return (
    <div data-f="F-07-019 F-07-023" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('counterparties.title')}
        description={t('counterparties.subtitle')}
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <div data-f="F-07-022 F-08-120 F-08-148">
                <DropdownMenu
                  trigger={(p) => (
                    <Button variant="secondary" {...p}>
                      {t('counterparties.excel')}
                    </Button>
                  )}
                  items={[
                    { id: 'export', label: t('counterparties.export'), icon: <Download aria-hidden />, onSelect: exportCsv },
                    { id: 'import', label: t('counterparties.import'), icon: <Upload aria-hidden />, onSelect: () => setImporting(true) },
                  ]}
                />
              </div>
              <Button data-f="F-07-020" leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
                {t('counterparties.add')}
              </Button>
            </div>
          )
        }
      />

      <FilterBar search={{ value: search, onValueChange: setSearch, placeholder: t('counterparties.searchPlaceholder') }} />

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        loading={listQ.isLoading || opsQ.isLoading}
        loadingRows={5}
        onRowClick={canEdit ? (r) => setEditing(r) : undefined}
        label={t('counterparties.title')}
        empty={
          <EmptyState
            icon={<Building2 aria-hidden />}
            kind={search ? 'search' : 'default'}
            title={search ? undefined : t('counterparties.emptyTitle')}
            onReset={search ? () => setSearch('') : undefined}
            action={
              !search && canEdit ? (
                <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
                  {t('counterparties.add')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      <CounterpartyFormSheet
        key={editing === 'new' || editing === null ? 'new' : editing.id}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing && editing !== 'new' ? editing : undefined}
      />
      <ImportCounterpartiesSheet open={importing} onOpenChange={setImporting} />
    </div>
  );
}

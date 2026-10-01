'use client';

/**
 * /biz/loyalty/deposits — список счетов клиентов сети (F-06-141): фильтр по типу, балансу, владельцу.
 * Пополнение — только в локации (finance/clients), здесь только отчёт.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LifeBuoy, Upload, Wallet } from 'lucide-react';
import { findClientByPhone } from '@/api/core';
import { listAccountTypes, listAccounts, openAccount, topupAccount } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { BulkImportModal } from '@/areas/loyalty/components/BulkImportModal';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';

export function AccountsScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const { ready, businessId, activeLocationIds } = useCurrent();

  const [query, setQuery] = useState('');
  const [accountTypeId, setAccountTypeId] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const typesQ = useApiQuery(['loyalty', 'accountTypes', businessId], () => listAccountTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const q = useApiQuery(
    ['loyalty', 'accounts', businessId, query, accountTypeId, minBalance],
    () =>
      listAccounts(businessId!, {
        query: query || undefined,
        accountTypeId: accountTypeId || undefined,
        minBalance: minBalance !== '' ? Number(minBalance) : undefined,
      }),
    { enabled: ready && Boolean(businessId) },
  );

  const typeOptions = useMemo(() => [{ value: '', label: t('accounts.filters.allTypes') }, ...(typesQ.data ?? []).map((tp) => ({ value: tp.id, label: tp.name }))], [typesQ.data, t]);

  const columns: TableColumn<NonNullable<typeof q.data>[number]>[] = [
    {
      id: 'clientPhone',
      header: t('accounts.columns.owner'),
      cell: (r) => (
        <Link href={`/biz/clients/${r.clientId}`} className="inline-flex min-h-10 max-w-full items-center text-primary-text underline decoration-border-strong underline-offset-2">
          <span className="truncate">
            {r.clientName} · {format.phone(r.clientPhone)}
          </span>
        </Link>
      ),
      mobile: 'title',
      // Ссылка на клиента высотой 40 px — скелетон той же высоты
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="26ch" />
        </span>
      ),
    },
    {
      id: 'typeName',
      header: t('accounts.columns.type'),
      cell: (r) => <span className="block max-w-[14rem] truncate">{r.typeName}</span>,
      mobile: 'meta',
      width: '16rem',
      skeletonWidth: '8ch',
    },
    {
      id: 'balance',
      header: t('accounts.columns.balance'),
      cell: (r) => <span className={r.balance < 0 ? 'font-semibold text-danger' : 'font-semibold text-fg'}>{format.money(r.balance)}</span>,
      align: 'right',
      sortable: true,
      sortValue: (r) => r.balance,
      mobile: 'aside',
      width: '10rem',
      skeletonWidth: '8ch',
    },
  ];

  if (typesQ.isError || q.isError)
    return (
      <ErrorState
        onRetry={() => {
          typesQ.refetch();
          q.refetch();
        }}
      />
    );

  const hasFilters = Boolean(query) || Boolean(accountTypeId) || Boolean(minBalance);
  const reset = () => {
    setQuery('');
    setAccountTypeId('');
    setMinBalance('');
  };

  // F-06-145/180: перенос счетов из другой системы (или командой Altegio при подключении салона) — тот
  // же путь, что F-06-057/130: телефон клиента, название типа счёта, перенесённый баланс.
  // F-06-130: проверка строки БЕЗ записи — читает клиента/тип, но ничего не меняет
  const checkAccountsRow = async (cells: string[]) => {
    const [rawPhone, typeName] = cells;
    if (!rawPhone?.trim()) throw new Error(t('accounts.transfer.rowNoPhone'));
    const client = await findClientByPhone(businessId!, rawPhone.trim());
    if (!client) throw new Error(t('accounts.transfer.clientNotFound'));
    const type = (typesQ.data ?? []).find((ty) => ty.name.trim().toLowerCase() === (typeName ?? '').trim().toLowerCase());
    if (!type) throw new Error(t('accounts.transfer.typeNotFound'));
    return { client, type };
  };
  const importAccounts = async (cells: string[]): Promise<string> => {
    const [, , rawBalance] = cells;
    const { client, type } = await checkAccountsRow(cells);
    const balance = Number((rawBalance ?? '0').replace(/[^\d.-]/g, '')) || 0;
    const existing = (await listAccounts(businessId!, { query: client.phone })).find((a) => a.accountTypeId === type.id && a.clientId === client.id);
    const account = existing ?? (await openAccount(businessId!, client.id, type.id, activeLocationIds[0] ?? businessId!));
    if (balance > 0) await topupAccount(businessId!, account.id, balance);
    return t('accounts.transfer.rowOk', { name: client.name });
  };

  return (
    <div data-f="F-06-141 F-06-145 F-06-180" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('accounts.title')}
        description={t('accounts.subtitle')}
        actions={
          <>
            <Button variant="outline" leftIcon={<LifeBuoy aria-hidden />} onClick={() => setSupportOpen(true)}>
              {t('accounts.transfer.support')}
            </Button>
            <Button variant="outline" leftIcon={<Upload aria-hidden />} onClick={() => setTransferOpen(true)}>
              {t('accounts.transfer.button')}
            </Button>
          </>
        }
      />

      <FilterBar
        search={{
          value: query,
          onValueChange: setQuery,
          placeholder: t('accounts.filters.searchPlaceholder'),
        }}
        filters={[
          {
            id: 'type',
            label: t('accounts.filters.type'),
            node: <Select options={typeOptions} value={accountTypeId} onValueChange={setAccountTypeId} />,
          },
          {
            id: 'minBalance',
            label: t('accounts.filters.minBalance'),
            node: <Input inputMode="numeric" value={minBalance} onChange={(e) => setMinBalance(e.target.value.replace(/[^\d-]/g, ''))} />,
          },
        ]}
        activeCount={hasFilters ? 1 : 0}
        onReset={reset}
      />

      <Table columns={columns} rows={q.data ?? []} rowKey={(r) => r.id} loading={q.isLoading} loadingRows={4} label={t('accounts.title')} empty={<EmptyState icon={<Wallet aria-hidden />} kind={hasFilters ? 'search' : 'default'} title={hasFilters ? undefined : t('accounts.emptyTitle')} onReset={hasFilters ? reset : undefined} />} />

      <BulkImportModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title={t('accounts.transfer.title')}
        hint={t('accounts.transfer.hint')}
        templateHeader={t('accounts.transfer.template')}
        columns={[
          { key: 'phone', label: t('accounts.transfer.colPhone') },
          { key: 'type', label: t('accounts.transfer.colType') },
          { key: 'balance', label: t('accounts.transfer.colBalance') },
        ]}
        onImportRow={importAccounts}
        onValidateRow={checkAccountsRow}
        onDone={() => q.refetch()}
      />

      <Modal open={supportOpen} onOpenChange={setSupportOpen} title={t('accounts.transfer.supportTitle')} footer={<Button onClick={() => setSupportOpen(false)}>{t('clientCard.cancel')}</Button>}>
        <p className="text-sm text-muted">{t('accounts.transfer.supportText')}</p>
      </Modal>
    </div>
  );
}

'use client';

/**
 * /biz/loyalty/cards — список выданных карт сети (F-06-058): фильтры по типу и телефону, ссылки на
 * карту (F-06-059) и на карточку клиента. Выдача карты клиенту — пачка b02/b04.
 */
import { useMemo, useState } from 'react';
import { CreditCard, Upload } from 'lucide-react';
import { findClientByPhone } from '@/api/core';
import { adjustCardBalance, issueCard, listCardTypes, listCards } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { BulkImportModal } from '@/areas/loyalty/components/BulkImportModal';
import { useCurrent, useDemo } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { StatCard } from '@/ui/StatCard';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';

export function CardsScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const { ready, businessId, activeLocationIds } = useCurrent();
  const { persona } = useDemo();
  // demo-q4 minor: «сети» звучит бессмысленно у бизнеса с одним адресом
  const subtitle = persona === 'network' ? t('cards.subtitle') : persona === 'individual' ? t('cards.subtitleIndividual') : t('cards.subtitleSingle');

  const [phone, setPhone] = useState('');
  const [cardTypeId, setCardTypeId] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const typesQ = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const cardsQ = useApiQuery(
    ['loyalty', 'cards', businessId, cardTypeId, phone],
    () => listCards(businessId!, { cardTypeId: cardTypeId || undefined, phone: phone || undefined }),
    { enabled: ready && Boolean(businessId) },
  );

  const typeOptions = useMemo(
    () => [{ value: '', label: t('cards.filters.allTypes') }, ...(typesQ.data ?? []).map((ct) => ({ value: ct.id, label: ct.name }))],
    [typesQ.data, t],
  );

  const columns: TableColumn<NonNullable<typeof cardsQ.data>[number]>[] = [
    { id: 'number', header: t('cards.columns.number'), cell: (r) => r.number, mobile: 'title', width: '8rem', skeletonWidth: '4ch' },
    { id: 'cardTypeName', header: t('cards.columns.type'), cell: (r) => <span className="block max-w-[12rem] truncate">{r.cardTypeName}</span>, mobile: 'meta', width: '14rem', skeletonWidth: '14ch' },
    {
      id: 'clientPhone',
      header: t('cards.columns.phone'),
      cell: (r) => (
        <a
          href={`/biz/clients/${r.clientId}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex min-h-10 items-center text-primary-text underline decoration-border-strong underline-offset-2"
        >
          {format.phone(r.clientPhone)}
        </a>
      ),
      mobile: 'subtitle',
      width: '12rem',
      // Ссылка-телефон высотой 40 px — скелетон той же высоты
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="15ch" />
        </span>
      ),
    },
    {
      id: 'balance',
      header: t('cards.columns.balance'),
      cell: (r) => format.money(r.balance),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.balance,
      mobile: 'aside',
      width: '9rem',
      skeletonWidth: '7ch',
    },
    {
      id: 'createdAt',
      header: t('cards.columns.createdAt'),
      cell: (r) => format.date(r.createdAt),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.createdAt,
      mobile: 'hidden',
      skeletonWidth: '10ch',
    },
  ];

  if (typesQ.isError || cardsQ.isError)
    return (
      <ErrorState
        onRetry={() => {
          typesQ.refetch();
          cardsQ.refetch();
        }}
      />
    );

  const hasFilters = Boolean(phone) || Boolean(cardTypeId);
  // F-06-058 (ux-best): «сколько выдано» и «сколько на балансах» — крупным числом, а не только строками таблицы
  const totalBalance = (cardsQ.data ?? []).reduce((sum, r) => sum + r.balance, 0);

  // F-06-057: массовая выдача карт и изменение балансов из Excel — телефон (+374), тип карты (по названию), баланс
  // F-06-130: проверка строки БЕЗ записи — читает клиента/тип, но ничего не меняет
  const checkCardsRow = async (cells: string[]) => {
    const [rawPhone, typeName] = cells;
    if (!rawPhone?.trim()) throw new Error(t('cards.import.rowNoPhone'));
    const client = await findClientByPhone(businessId!, rawPhone.trim());
    if (!client) throw new Error(t('cards.import.clientNotFound'));
    const type = (typesQ.data ?? []).find((ty) => ty.name.trim().toLowerCase() === (typeName ?? '').trim().toLowerCase());
    if (!type) throw new Error(t('cards.import.typeNotFound'));
    return { client, type };
  };
  const importCards = async (cells: string[]): Promise<string> => {
    const [, , rawBalance] = cells;
    const { client, type } = await checkCardsRow(cells);
    // F-06-057: значение в файле — это НОВЫЙ баланс (цель); но минус перед числом («-100») — это не цель «-100»
    // (баланс не бывает отрицательным), а команда «уменьшить на 100» — относительная правка.
    const rawTrimmed = (rawBalance ?? '').trim();
    const isDecreaseDelta = rawTrimmed.startsWith('-');
    const parsedBalance = Number(rawTrimmed.replace(/[^\d.-]/g, '')) || 0;
    let card: { id: string; balance: number } | undefined = (await listCards(businessId!, { clientId: client.id, cardTypeId: type.id }))[0];
    if (!card) card = await issueCard(businessId!, client.id, type.id);
    if (parsedBalance !== 0) {
      const delta = isDecreaseDelta ? parsedBalance : parsedBalance - card.balance;
      if (delta !== 0) await adjustCardBalance(businessId!, card.id, activeLocationIds[0] ?? businessId!, delta);
    }
    return t('cards.import.rowOk', { name: client.name });
  };

  return (
    <div data-f="F-06-058 F-06-198 F-06-057 F-04-134" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('cards.title')}
        description={subtitle}
        actions={
          <Button variant="outline" leftIcon={<Upload aria-hidden />} onClick={() => setImportOpen(true)}>
            {t('cards.import.button')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('cards.stats.issued')} value={String((cardsQ.data ?? []).length)} loading={cardsQ.isLoading} icon={<CreditCard aria-hidden />} />
        <StatCard label={t('cards.stats.totalBalance')} value={format.money(totalBalance)} loading={cardsQ.isLoading} />
      </div>

      <FilterBar
        search={{ value: phone, onValueChange: setPhone, placeholder: t('cards.filters.phonePlaceholder') }}
        filters={[
          {
            id: 'type',
            label: t('cards.filters.type'),
            node: <Select options={typeOptions} value={cardTypeId} onValueChange={setCardTypeId} placeholder={t('cards.filters.allTypes')} />,
          },
        ]}
        activeCount={hasFilters ? 1 : 0}
        onReset={() => {
          setPhone('');
          setCardTypeId('');
        }}
      />

      <Table
        columns={columns}
        rows={cardsQ.data ?? []}
        rowKey={(r) => r.id}
        loading={cardsQ.isLoading}
        loadingRows={10}
        rowHref={(r) => `/biz/loyalty/cards/${r.id}`}
        label={t('cards.title')}
        empty={
          <EmptyState
            icon={<CreditCard aria-hidden />}
            kind={hasFilters ? 'search' : 'default'}
            title={hasFilters ? undefined : t('cards.emptyTitle')}
            description={hasFilters ? undefined : t('cards.emptyText')}
            onReset={
              hasFilters
                ? () => {
                    setPhone('');
                    setCardTypeId('');
                  }
                : undefined
            }
          />
        }
      />

      <BulkImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t('cards.import.title')}
        hint={t('cards.import.hint')}
        templateHeader={t('cards.import.template')}
        columns={[
          { key: 'phone', label: t('cards.import.colPhone') },
          { key: 'type', label: t('cards.import.colType') },
          { key: 'balance', label: t('cards.import.colBalance') },
        ]}
        onImportRow={importCards}
        onValidateRow={checkCardsRow}
        onDone={() => {
          typesQ.refetch();
          cardsQ.refetch();
        }}
      />
    </div>
  );
}

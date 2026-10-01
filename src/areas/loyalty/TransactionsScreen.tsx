'use client';

/**
 * /biz/loyalty/transactions — журнал операций лояльности (F-06-076, F-06-077) с фильтром по типу,
 * акции, филиалу и периоду. F-06-085 «Отчёт по реферальным начислениям» — тот же экран с
 * ?type=referralAccrual (deep-link со страницы «Реферальная программа»).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Download, Receipt } from 'lucide-react';
import { coreList } from '@/api/core';
import { listPromotions, listTransactions } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { LOYALTY_TX_TYPES } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import type { DateRange } from '@/ui/Calendar';

export function TransactionsScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const format = useFormat();
  const locale = useLocale();
  const { ready, businessId } = useCurrent();
  const search = useSearchParams();

  // Deep-link ?type=… (со страницы «Реферальная программа», F-06-085) — берём один раз при монтировании,
  // дальше это обычный локальный фильтр экрана.
  const [type, setType] = useState(() => {
    const initial = search.get('type');
    return initial && (LOYALTY_TX_TYPES as string[]).includes(initial) ? initial : '';
  });
  const [locationId, setLocationId] = useState('');
  const [promotionId, setPromotionId] = useState('');
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const promosQ = useApiQuery(['loyalty', 'promotions', businessId], () => listPromotions(businessId!), { enabled: ready && Boolean(businessId) });
  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const txQ = useApiQuery(
    ['loyalty', 'transactions', businessId, type, locationId, promotionId, range?.from, range?.to],
    () =>
      listTransactions(
        businessId!,
        { type: (type as never) || undefined, locationId: locationId || undefined, promotionId: promotionId || undefined, dateFrom: range?.from, dateTo: range?.to },
        locale,
      ),
    { enabled: ready && Boolean(businessId) },
  );

  const typeOptions = useMemo(
    () => [{ value: '', label: t('transactions.filters.allTypes') }, ...LOYALTY_TX_TYPES.map((tt) => ({ value: tt, label: t(`transactions.types.${tt}`) }))],
    [t],
  );
  const locationOptions = useMemo(
    () => [{ value: '', label: t('transactions.filters.allLocations') }, ...(locationsQ.data ?? []).map((l) => ({ value: l.id, label: pickText(l.name, locale) }))],
    [locationsQ.data, locale, t],
  );
  const promotionOptions = useMemo(
    () => [{ value: '', label: t('transactions.filters.allPromotions') }, ...(promosQ.data ?? []).map((p) => ({ value: p.id, label: p.name }))],
    [promosQ.data, t],
  );

  const columns: TableColumn<NonNullable<typeof txQ.data>[number]>[] = [
    { id: 'createdAt', header: t('transactions.columns.date'), cell: (r) => format.date(r.createdAt, 'short'), mobile: 'meta', width: '8rem', skeletonWidth: '8ch' },
    { id: 'type', header: t('transactions.columns.type'), cell: (r) => <span className="block max-w-[12rem] truncate">{t(`transactions.types.${r.type}`)}</span>, mobile: 'title', width: '14rem', skeletonWidth: '16ch' },
    { id: 'promotionName', header: t('transactions.columns.promotion'), cell: (r) => <span className="block max-w-[15rem] truncate">{r.promotionName ?? '—'}</span>, mobile: 'hidden', width: '17rem', skeletonWidth: '18ch' },
    { id: 'cardNumber', header: t('transactions.columns.card'), cell: (r) => r.cardNumber ?? '—', mobile: 'hidden', width: '7rem', skeletonWidth: '4ch' },
    {
      id: 'clientPhone',
      header: t('transactions.columns.client'),
      cell: (r) => (
        <Link href={`/biz/clients/${r.clientId}`} className="inline-flex min-h-10 items-center text-primary-text underline decoration-border-strong underline-offset-2">
          {format.phone(r.clientPhone)}
        </Link>
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
      id: 'amount',
      header: t('transactions.columns.amount'),
      cell: (r) => (
        <span className={r.amount < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>
          {r.amount > 0 ? '+' : ''}
          {format.money(r.amount)}
        </span>
      ),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.amount,
      mobile: 'aside',
      skeletonWidth: '8ch',
      className: 'whitespace-nowrap',
    },
  ];

  if (txQ.isError) return <ErrorState onRetry={txQ.refetch} />;

  const exportExcel = () => {
    const rows = txQ.data ?? [];
    const csv = toCsv(
      rows.map((r) => [
        format.date(r.createdAt, 'short'),
        t(`transactions.types.${r.type}`),
        r.promotionName ?? '',
        r.cardNumber ?? '',
        format.phone(r.clientPhone),
        format.money(r.amount),
      ]),
      [
        t('transactions.columns.date'),
        t('transactions.columns.type'),
        t('transactions.columns.promotion'),
        t('transactions.columns.card'),
        t('transactions.columns.client'),
        t('transactions.columns.amount'),
      ],
    );
    downloadCsv('loyalty-transactions.csv', csv);
    toast.success(t('transactions.exported'));
  };
  const hasFilters = Boolean(type) || Boolean(locationId) || Boolean(promotionId) || Boolean(range?.from);
  const resetFilters = () => {
    setType('');
    setLocationId('');
    setPromotionId('');
    setRange(undefined);
  };

  return (
    <div data-f="F-06-076 F-06-077 F-06-085" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('transactions.title')}
        description={t('transactions.subtitle')}
        actions={
          <Button variant="outline" leftIcon={<Download aria-hidden />} onClick={exportExcel}>
            {t('transactions.export')}
          </Button>
        }
      />

      <FilterBar
        filters={[
          { id: 'type', label: t('transactions.filters.type'), node: <Select options={typeOptions} value={type} onValueChange={setType} /> },
          { id: 'promotion', label: t('transactions.filters.promotion'), node: <Select options={promotionOptions} value={promotionId} onValueChange={setPromotionId} /> },
          { id: 'location', label: t('transactions.filters.location'), node: <Select options={locationOptions} value={locationId} onValueChange={setLocationId} /> },
          { id: 'period', label: t('transactions.filters.period'), node: <DateRangePicker value={range} onValueChange={setRange} presets /> },
        ]}
        activeCount={hasFilters ? 1 : 0}
        onReset={resetFilters}
      />

      <Table
        columns={columns}
        rows={txQ.data ?? []}
        rowKey={(r) => r.id}
        loading={txQ.isLoading || promosQ.isLoading}
        loadingRows={10}
        label={t('transactions.title')}
        empty={
          <EmptyState
            icon={<Receipt aria-hidden />}
            kind={hasFilters ? 'search' : 'default'}
            title={hasFilters ? undefined : t('transactions.emptyTitle')}
            description={hasFilters ? undefined : t('transactions.emptyText')}
            onReset={hasFilters ? resetFilters : undefined}
          />
        }
      />
    </div>
  );
}

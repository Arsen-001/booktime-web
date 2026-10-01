'use client';

/**
 * /biz/network/records — «Обзор → Записи» сети (F-11-075): все записи сети с колонкой филиала и фильтрами.
 */
import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Booking } from '@/domain/core';
import { listNetworkLocations, listNetworkRecordsPage, type NetworkRecordFilters } from '@/api/network';
import { useApiQuery } from '@/api/request';
import { setLocationId } from '@/demo/store';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { addDays, today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Table, type TableColumn } from '@/ui/Table';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { useNetwork } from '@/areas/network/lib/useNetwork';

const SOURCE_BADGE = 'max-w-[12rem] min-w-[10.5rem]';
const STATUS_BADGE = 'min-w-[8.5rem]';

const CANCELLED_OPTIONS = ['all', 'cancelled', 'notCancelled'] as const;

export function RecordsScreen() {
  const t = useT('network');
  const format = useFormat();
  const { ready, networkId, isError, refetch, locationId } = useNetwork();
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [cancelled, setCancelled] = useState<NetworkRecordFilters['cancelled']>('all');
  // Сеть10: период по умолчанию — месяц назад и месяц вперёд; новые сверху, постранично
  const [range, setRange] = useState<DateRange>(() => ({ from: addDays(today(), -30), to: addDays(today(), 30) }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  // Сеть10: фильтр филиала связан с переключателем в шапке — выбран филиал там, он же здесь, и наоборот
  const businessId =
    locationId && locationId !== 'all'
      ? ((locationsQ.data ?? []).find((r) => r.business.locationIds.includes(locationId))?.business.id ?? '')
      : '';
  const pickBusiness = (id: string) => {
    const row = (locationsQ.data ?? []).find((r) => r.business.id === id);
    setLocationId(row ? (row.location?.id ?? row.business.locationIds[0] ?? 'all') : 'all');
    setPage(1);
  };
  const filters: NetworkRecordFilters = { businessId: businessId || undefined, onlineOnly, cancelled, from: range.from, to: range.to };
  const recordsQ = useApiQuery(
    ['network', 'records-page', networkId, filters, page, pageSize],
    () => listNetworkRecordsPage(networkId!, { ...filters, page, pageSize }),
    { enabled: ready && Boolean(networkId) && (!locationId || locationId === 'all' || Boolean(locationsQ.data)) },
  );
  const businessNameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of locationsQ.data ?? []) map.set(row.business.id, row.business.name);
    return map;
  }, [locationsQ.data]);

  if (isError || recordsQ.isError) return <ErrorState onRetry={() => (isError ? refetch() : recordsQ.refetch())} />;

  // Ширины колонок заданы, текст — в одну строку: строки одной высоты, скелетон и данные одной ширины.
  // Плашки источника и статуса — одной ширины (min-w), чтобы коробка не зависела от подписи
  const columns: TableColumn<Booking>[] = [
    {
      id: 'location',
      header: t('records.colLocation'),
      cell: (b) => <span className="block max-w-[12rem] truncate">{businessNameOf.get(b.businessId) ?? '—'}</span>,
      mobile: 'meta',
      width: '14rem',
      skeletonWidth: '14ch',
    },
    {
      id: 'start',
      header: t('records.colTime'),
      cell: (b) => <span className="whitespace-nowrap">{`${format.date(b.start.slice(0, 10))} ${b.start.slice(11, 16)}`}</span>,
      mobile: 'aside',
      width: '11rem',
      skeletonWidth: '16ch',
    },
    {
      id: 'total',
      header: t('records.colTotal'),
      cell: (b) => <span className="whitespace-nowrap">{format.money(b.total)}</span>,
      align: 'right',
      mobile: 'aside',
      width: '8rem',
      skeletonWidth: '7ch',
    },
    {
      id: 'source',
      header: t('records.colSource'),
      cell: (b) => (
        <Badge tone="neutral" size="sm" className={SOURCE_BADGE}>
          <span className="min-w-0 truncate">{t(`records.source.${b.source}` as const)}</span>
        </Badge>
      ),
      mobile: 'meta',
      width: '14rem',
      skeleton: (
        <Badge tone="neutral" size="sm" className={SOURCE_BADGE}>
          <SkeletonText width="10ch" />
        </Badge>
      ),
    },
    {
      id: 'status',
      header: t('records.colStatus'),
      cell: (b) => <BookingStatusBadge status={b.status} className={STATUS_BADGE} />,
      mobile: 'badge',
      width: '12rem',
      skeleton: (
        <Badge tone="neutral" icon={<span className="size-4" />} className={STATUS_BADGE}>
          <SkeletonText width="8ch" />
        </Badge>
      ),
    },
  ];

  return (
    <div data-f="F-11-075 F-12-100" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('records.title')}
        description={t('records.subtitle')}
        actions={<NetworkPageActions titleKey="help.records.title" bodyKey="help.records.body" />}
      />

      <SectionCard title={t('records.filtersTitle')}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-56">
            <Select
              options={[
                { value: '', label: t('records.allLocations') },
                ...(locationsQ.data ?? []).map((r) => ({ value: r.business.id, label: r.business.name })),
              ]}
              value={businessId}
              onValueChange={pickBusiness}
            />
          </div>
          <div className="w-full sm:w-72">
            <DateRangePicker
              value={range}
              onValueChange={(r) => {
                setRange(r);
                setPage(1);
              }}
              presets="long"
            />
          </div>
          <SegmentedControl
            options={CANCELLED_OPTIONS.map((v) => ({ value: v, label: t(`records.cancelled.${v}` as const) }))}
            value={cancelled}
            onValueChange={(v) => {
              setCancelled(v as NetworkRecordFilters['cancelled']);
              setPage(1);
            }}
          />
          <Switch
            checked={onlineOnly}
            onCheckedChange={(v) => {
              setOnlineOnly(v);
              setPage(1);
            }}
            label={t('records.onlineOnly')}
          />
        </div>
      </SectionCard>

      <div className="flex flex-col gap-4">
        <Table
          columns={columns}
          rows={recordsQ.data?.rows ?? []}
          loading={!ready || recordsQ.isLoading}
          // Фиксированная раскладка: ширины колонок по заданным width, а не по содержимому — скелетон и данные совпадают
          classNames={{ table: 'table-fixed' }}
          loadingRows={pageSize}
          // Страницы отдаёт сервер — встроенные у таблицы выключены
          pagination={false}
          rowKey={(b) => b.id}
          empty={
            <EmptyState
              icon={<CalendarClock aria-hidden />}
              kind="search"
              onReset={() => {
                pickBusiness('');
                setOnlineOnly(false);
                setCancelled('all');
                setRange({ from: addDays(today(), -30), to: addDays(today(), 30) });
              }}
              title={t('records.empty')}
            />
          }
        />
        {(recordsQ.data?.total ?? 0) > DEFAULT_PAGE_SIZE && (
          <Pagination
            page={recordsQ.data?.page ?? page}
            pageSize={pageSize}
            total={recordsQ.data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          />
        )}
      </div>
    </div>
  );
}

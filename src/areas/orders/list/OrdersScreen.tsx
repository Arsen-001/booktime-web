'use client';

/**
 * /biz/orders — ⭐ Заказы (03.10.2026): «Активные · Готовы · Выданы · Все», поиск по №, имени, номеру и вещам,
 * постранично с сервера. На телефоне — карточки, на компьютере — таблица; строка открывает заказ. Главное действие —
 * «Принять заказ» (шторка с формой; на телефоне — кнопка внизу у большого пальца).
 */
import { useState } from 'react';
import { PackageCheck, Plus } from 'lucide-react';
import { ordersKeys } from '@/api/orders';
import { seedApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Order, OrderStatusFilter } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { OrderFormSheet } from '@/areas/orders/form/OrderFormSheet';
import { ORDER_MOBILE_CARD_SKELETON, OrderMobileCard, useOrderColumns } from '@/areas/orders/list/useOrderColumns';
import { useOrdersList } from '@/areas/orders/lib/useOrdersData';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ExitHold } from '@/ui/ExitHold';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { SearchInput } from '@/ui/SearchInput';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Table } from '@/ui/Table';

const TABS = ['active', 'ready', 'issued', 'all'] as const satisfies readonly OrderStatusFilter[];

export function OrdersScreen() {
  const t = useT('orders');
  const { businessId } = useCurrent();
  const columns = useOrderColumns();
  const [status, setStatus] = useState<OrderStatusFilter>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [creating, setCreating] = useState(false);

  const query = { status, q: search.trim() || undefined, page, pageSize };
  const q = useOrdersList(query);
  const data = q.data;
  const narrowed = Boolean(query.q);
  const loading = q.isLoading;

  const reset = () => {
    setSearch('');
    setPage(1);
  };
  const add = (
    <Button data-f="orders-create" leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
      {t('add')}
    </Button>
  );

  return (
    <div data-f="orders-list" className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} actions={<span className="hidden md:inline-flex">{add}</span>} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SegmentedControl
          aria-label={t('title')}
          size="sm"
          fullWidth
          className="md:w-auto"
          options={TABS.map((s) => ({ value: s, label: t(`tabs.${s}`) }))}
          value={status}
          onValueChange={(v) => {
            setStatus(v as OrderStatusFilter);
            setPage(1);
          }}
        />
        <SearchInput
          value={search}
          onValueChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          debounceMs={250}
          placeholder={t('list.search')}
          aria-label={t('list.search')}
          className="md:w-80"
        />
      </div>

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <Table
            label={t('title')}
            skeletonId="orders-list"
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(o) => o.id}
            loading={loading}
            loadingRows={6}
            manualSort
            pagination={false}
            onRowClick={(o: Order) => seedApiQuery(ordersKeys.order(businessId ?? '', o.id), o)}
            rowHref={(o) => `/biz/orders/${o.id}`}
            mobileCard={(o) => <OrderMobileCard order={o} />}
            mobileCardSkeleton={ORDER_MOBILE_CARD_SKELETON}
            classNames={{ table: cn(q.isPlaceholderData && 'opacity-60 transition-opacity'), cards: cn(q.isPlaceholderData && 'opacity-60 transition-opacity') }}
            empty={
              narrowed ? (
                <EmptyState kind="search" title={t('list.emptySearch')} onReset={reset} />
              ) : (
                <EmptyState
                  icon={<PackageCheck aria-hidden />}
                  title={t(`list.empty.${status}`)}
                  description={status === 'active' || status === 'all' ? t('list.emptyHint') : undefined}
                  action={status === 'active' || status === 'all' ? add : undefined}
                />
              )
            }
          />
          {(loading || (data?.total ?? 0) > DEFAULT_PAGE_SIZE) && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data?.total ?? 0}
              loading={loading}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      <StickyActionBar desktop="hidden">
        <Button fullWidth leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
          {t('add')}
        </Button>
      </StickyActionBar>

      <ExitHold value={creating ? 'new' : null}>{() => <OrderFormSheet onClose={() => setCreating(false)} />}</ExitHold>
    </div>
  );
}

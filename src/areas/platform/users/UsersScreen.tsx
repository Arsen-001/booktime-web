'use client';

/**
 * /platform/users — все зарегистрированные люди (03.10.2026): счётчики сверху, поиск по имени и номеру, фильтры
 * (роль, статус, активность, Telegram, Google, дата регистрации), порядок, постранично с сервера. Строка открывает
 * карточку (Sheet) с действиями. На телефоне — карточки строк. Поиск, фильтры и страница — в api (§16.10).
 */
import { useState } from 'react';
import { CalendarPlus, Send, UserCheck, Users } from 'lucide-react';
import { UserSheet } from '@/areas/platform/users/UserSheet';
import { useUsersFilters, type UsersFilterState } from '@/areas/platform/users/useUsersFilters';
import { USER_MOBILE_CARD_SKELETON, UserMobileCard, useUserColumns } from '@/areas/platform/users/useUserColumns';
import { usePlatformUsers } from '@/areas/platform/users/useUsers';
import type { PlatformUserRow, PlatformUserSort, PlatformUsersQuery } from '@/domain/platform/types/users';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ExitHold } from '@/ui/ExitHold';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableSort } from '@/ui/Table';

const EMPTY: UsersFilterState = { role: '', status: '', activeDays: '', telegram: '', google: '', range: {} };

export function UsersScreen() {
  const t = useT('platform');
  const fmt = useFormat();
  const columns = useUserColumns();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<UsersFilterState>(EMPTY);
  const [sort, setSort] = useState<{ sort: PlatformUserSort; dir: 'asc' | 'desc' }>({ sort: 'registered', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [open, setOpen] = useState<PlatformUserRow | null>(null);

  const query: PlatformUsersQuery = {
    q: search.trim() || undefined,
    role: filters.role || undefined,
    status: filters.status || undefined,
    activeDays: filters.activeDays ? Number(filters.activeDays) : undefined,
    telegram: filters.telegram || undefined,
    google: filters.google || undefined,
    regFrom: filters.range.from,
    regTo: filters.range.to,
    sort: sort.sort,
    dir: sort.dir,
    page,
    pageSize,
  };
  const q = usePlatformUsers(query);
  const data = q.data;

  const changeFilters = (patch: Partial<UsersFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const changeSort = (next: { sort: PlatformUserSort; dir: 'asc' | 'desc' }) => {
    setSort(next);
    setPage(1);
  };
  const resetAll = () => {
    setSearch('');
    setFilters(EMPTY);
    setPage(1);
  };
  const filterItems = useUsersFilters(filters, changeFilters, sort, changeSort);
  const narrowed = Boolean(query.q) || Object.entries(filters).some(([k, v]) => (k === 'range' ? Boolean(filters.range.from || filters.range.to) : Boolean(v)));
  const tableSort: TableSort = { columnId: sort.sort, dir: sort.dir };
  const c = data?.counters;
  const loading = q.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('users.title')} description={t('users.subtitle')} />

      {!q.isError && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('users.counters.total')} value={fmt.number(c?.total ?? 0)} icon={<Users aria-hidden />} loading={loading} />
          <StatCard label={t('users.counters.new7d')} value={fmt.number(c?.new7d ?? 0)} icon={<CalendarPlus aria-hidden />} loading={loading} />
          <StatCard label={t('users.counters.active7d')} value={fmt.number(c?.active7d ?? 0)} icon={<UserCheck aria-hidden />} loading={loading} />
          <StatCard label={t('users.counters.telegram')} value={fmt.number(c?.telegram ?? 0)} icon={<Send aria-hidden />} loading={loading} />
        </div>
      )}

      <FilterBar
        search={{
          value: search,
          onValueChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: t('users.search'),
          debounceMs: 250,
        }}
        filters={filterItems}
        onReset={resetAll}
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <Table
            label={t('users.title')}
            skeletonId="platform-users"
            columns={columns}
            rows={data?.rows ?? []}
            rowKey={(r) => r.id}
            loading={loading}
            loadingRows={pageSize}
            manualSort
            sort={tableSort}
            onSortChange={(s) => changeSort(s ? { sort: s.columnId as PlatformUserSort, dir: s.dir } : { sort: 'registered', dir: 'desc' })}
            onRowClick={(r) => setOpen(r)}
            mobileCard={(r) => <UserMobileCard row={r} />}
            mobileCardSkeleton={USER_MOBILE_CARD_SKELETON}
            classNames={{ table: cn(q.isPlaceholderData && 'opacity-60 transition-opacity'), cards: cn(q.isPlaceholderData && 'opacity-60 transition-opacity') }}
            empty={
              narrowed ? (
                <EmptyState kind="search" title={t('users.emptySearch')} onReset={resetAll} />
              ) : (
                <EmptyState icon={<Users aria-hidden />} title={t('users.empty')} description={t('users.emptyHint')} />
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
      <ExitHold value={open}>{(row) => <UserSheet key={row.id} row={row} onClose={() => setOpen(null)} />}</ExitHold>
    </div>
  );
}

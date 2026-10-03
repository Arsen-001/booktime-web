'use client';

/**
 * /platform/users — все зарегистрированные люди (03.10.2026): счётчики сверху, поиск по имени и номеру, фильтры
 * (роль, статус, активность, Telegram, Google, дата регистрации), порядок, постранично с сервера. Строка открывает
 * карточку (Sheet) с действиями. На телефоне — карточки строк. Поиск, фильтры и страница — в api (§16.10).
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { setUrlParam } from '@/areas/platform/lib/urlParam';
import { UsersCounters } from '@/areas/platform/users/UsersCounters';
import { UserSheet } from '@/areas/platform/users/UserSheet';
import { useUsersFilters, type UsersFilterState } from '@/areas/platform/users/useUsersFilters';
import { USER_MOBILE_CARD_SKELETON, UserMobileCard, useUserColumns } from '@/areas/platform/users/useUserColumns';
import { usePlatformUsers } from '@/areas/platform/users/useUsers';
import type { PlatformUserRow, PlatformUserSort, PlatformUsersQuery } from '@/domain/platform/types/users';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ExitHold } from '@/ui/ExitHold';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { Table, type TableSort } from '@/ui/Table';

const EMPTY: UsersFilterState = { role: '', status: '', activeDays: '', telegram: '', whatsapp: '', google: '', range: {} };

export function UsersScreen() {
  const t = useT('platform');
  const params = useSearchParams();
  const columns = useUserColumns();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<UsersFilterState>(EMPTY);
  const [sort, setSort] = useState<{ sort: PlatformUserSort; dir: 'asc' | 'desc' }>({ sort: 'registered', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Открытая карточка — в адресе (?u=<id>): ссылку можно переслать, карточку открывают и с других экранов
  const [openId, setOpenId] = useState<string | null>(() => params.get('u'));
  const [openRow, setOpenRow] = useState<PlatformUserRow | null>(null);
  const openUser = (row: PlatformUserRow | null) => {
    setOpenId(row?.id ?? null);
    if (row) setOpenRow(row);
    setUrlParam('u', row?.id ?? null);
  };
  const closeUser = () => {
    setOpenId(null);
    setUrlParam('u', null);
  };

  const query: PlatformUsersQuery = {
    q: search.trim() || undefined,
    role: filters.role || undefined,
    status: filters.status || undefined,
    activeDays: filters.activeDays ? Number(filters.activeDays) : undefined,
    telegram: filters.telegram || undefined,
    whatsapp: filters.whatsapp || undefined,
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
  const loading = q.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('users.title')} description={t('users.subtitle')} />

      {!q.isError && (
        <UsersCounters counters={data?.counters} loading={loading} filters={filters} narrowed={narrowed} onChange={changeFilters} onReset={resetAll} />
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
            onRowClick={(r) => openUser(r)}
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
      <ExitHold value={openId}>{(id) => <UserSheet key={id} id={id} row={openRow?.id === id ? openRow : undefined} onClose={closeUser} />}</ExitHold>
    </div>
  );
}

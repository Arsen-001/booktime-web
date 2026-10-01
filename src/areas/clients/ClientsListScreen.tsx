'use client';

/**
 * /biz/clients — «Клиенты» (F-04-001…042, F-04-157, F-04-199). Экран держит только состояние поиска и фильтров;
 * найти, отобрать, отсортировать и нарезать страницу — одна функция api `listClients` (arch-a1 №1).
 *
 * Телефон: заголовок → поиск и «Фильтры» в одну строку → подборки одной листаемой строкой → клиенты строками по ~72 px →
 * «Добавить клиента» плавающей кнопкой у пальца (ux-r1 №1, ux-r5 улучшение 1, speed-k3 №2).
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckSquare, LoaderCircle, SlidersHorizontal, Upload, UserPlus, Users } from 'lucide-react';
import { exportClients, getAutoSaveChatLeads, getColumnsPrefs, listCategoryOptions, listClients } from '@/api/clients';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { AddClientSheet } from '@/areas/clients/components/AddClientSheet';
import { AddVisitSheet } from '@/areas/clients/components/AddVisitSheet';
import { ColumnsMenu } from '@/areas/clients/components/ColumnsMenu';
import { FilterBuilderSheet } from '@/areas/clients/components/FilterBuilderSheet';
import { ActiveFilterChips } from '@/areas/clients/components/list/ActiveFilterChips';
import { ClientMobileRow, ClientMobileRowSkeleton } from '@/areas/clients/components/list/ClientMobileRow';
import { ClientsBulkActions } from '@/areas/clients/components/list/ClientsBulkActions';
import { ClientsHeaderActions } from '@/areas/clients/components/list/ClientsHeaderActions';
import { PendingMarksBanner } from '@/areas/clients/components/list/PendingMarksBanner';
import { QuickPicksRow } from '@/areas/clients/components/list/QuickPicksRow';
import { clientsCsv } from '@/areas/clients/lib/export';
import { useClientColumns } from '@/areas/clients/lib/columns';
import { seedClientRow } from '@/areas/clients/lib/cardCache';
import { useDelayedFlag } from '@/areas/clients/lib/useDelayedFlag';
import { useClientsRights } from '@/areas/clients/lib/rights';
import { useApiMode } from '@/areas/clients/lib/useApiMode';
import { activeFilterCount, DEFAULT_CLIENTS_SORT, defaultColumnsPrefs, emptyFilterState, type ClientsSort, type QuickPickId } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { downloadCsv } from '@/lib/csv';
import { today } from '@/lib/date';
import { cn } from '@/lib/cn';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { SearchInput } from '@/ui/SearchInput';
import { SkeletonText } from '@/ui/Skeleton';
import { useRememberedLayout } from '@/ui/hooks/useSkeletonCount';
import { Table, type TableSort } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';


export function ClientsListScreen() {
  const t = useT('clients');
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const isMobile = useIsMobile();
  const { ready, businessId, businessIds, locationId, activeLocationIds, staffId } = useCurrent();
  const rights = useClientsRights();
  const canEdit = useCan('clients.edit');
  const canMail = useCan('notify.mailings');
  const canBook = useCan('journal.create');
  const canSeeContacts = rights.contactsInList;
  const apiMode = useApiMode();

  // Общий поиск в шапке ведёт сюда с ?q=… (speed-k3 №1): поле берёт запрос из адреса и следит за ним
  const qParam = params.get('q') ?? '';
  const [search, setSearch] = useState(qParam);
  const [seenQ, setSeenQ] = useState(qParam);
  if (qParam !== seenQ) {
    setSeenQ(qParam);
    setSearch(qParam);
  }
  // С плиток «Основных показателей» приходят с ?pick=new|repeat|lost… — база сразу отфильтрована сегментом (F-12-015)
  // ?pick=due — только в моках: сервер «Пора записать» пока не поддерживает (см. QuickPicksRow)
  const pickValues: QuickPickId[] = [...(apiMode ? [] : (['due'] as QuickPickId[])), 'new', 'repeat', 'lost', 'subscriptionEnding', 'noShow', 'chatLeads'];
  const rawPick = params.get('pick');
  const pickParam = (pickValues as string[]).includes(rawPick ?? '') ? (rawPick as QuickPickId) : null;
  const [pick, setPick] = useState<QuickPickId | null>(pickParam);
  const [seenPick, setSeenPick] = useState(pickParam);
  if (pickParam !== seenPick) {
    setSeenPick(pickParam);
    setPick(pickParam);
  }
  // Из справочника категорий приходят с ?category=… — база сразу отфильтрована по ней (ux-r5 №20)
  const categoryParam = params.get('category') ?? '';
  const withCategory = (name: string) => {
    const base = emptyFilterState();
    return name ? { ...base, clients: { categoryTags: [name] } } : base;
  };
  const [filters, setFilters] = useState(() => withCategory(categoryParam));
  const [seenCategory, setSeenCategory] = useState(categoryParam);
  if (categoryParam !== seenCategory) {
    setSeenCategory(categoryParam);
    setFilters(withCategory(categoryParam));
  }
  // null — порядок по умолчанию: «последний визит» новее выше, а в «Пора записать» — самые просроченные первыми
  const [sort, setSort] = useState<ClientsSort | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<Id[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addVisitOpen, setAddVisitOpen] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  // Новый клиент (F-04-061): api отдаёт страницу, где он стоит, строка подсвечена «Новый» несколько секунд
  const [revealId, setRevealId] = useState<Id | null>(null);
  const [highlightId, setHighlightId] = useState<Id | null>(null);

  const enabled = ready && Boolean(businessId);
  const onlyStaffId = !rights.seeAllClients && staffId ? staffId : undefined;
  const filterCount = activeFilterCount(filters);
  const query = {
    businessId: businessId ?? '',
    locationIds: activeLocationIds,
    search,
    pick,
    filters,
    sort: sort ?? undefined,
    onlyStaffId,
    page,
    pageSize,
    revealId: revealId ?? undefined,
  };
  const listQ = useApiQuery(['clients', 'list', query], () => listClients(query), { enabled });
  const listBusy = useDelayedFlag(listQ.isPlaceholderData);
  const columnsQ = useApiQuery(['clients', 'columns', businessId, staffId], () => getColumnsPrefs(businessId ?? '', staffId ?? undefined), { enabled });
  const chatLeadsQ = useApiQuery(['clients', 'autoSaveChatLeads', businessId], () => getAutoSaveChatLeads(businessId ?? undefined), { enabled });
  const categoriesQ = useApiQuery(['clients', 'categories', businessId], () => listCategoryOptions(businessId ?? ''), { enabled });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled });
  const servicesQ = useCoreList('services', { businessId: businessId ?? '' }, { enabled });
  const exportM = useApiMutation(exportClients);

  const data = listQ.data;
  // Показать нового клиента: страница пришла — запоминаем её и подсвечиваем строку
  if (revealId && data && !listQ.isPlaceholderData) {
    setRevealId(null);
    setPage(data.page);
    setHighlightId(revealId);
  }
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const columns = useClientColumns(columnsQ.data ?? defaultColumnsPrefs(), highlightId, canSeeContacts, canBook, rights.viewFullName, rights.viewAccounts);

  const resetPage = () => {
    setPage(1);
    setSelected([]);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    resetPage();
    // Адрес держим в синхроне с полем — ссылкой на поиск можно поделиться, «назад» возвращает к нему
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set('q', value.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(window.history.state, '', url);
  };
  // Подборка — тоже в адресе: из карточки «назад» возвращает в ту же подборку («Пора записать» → карточка → следующий)
  const changePick = (next: QuickPickId | null) => {
    setPick(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('pick', next);
    else url.searchParams.delete('pick');
    window.history.replaceState(window.history.state, '', url);
  };
  const resetAll = () => {
    changeSearch('');
    changePick(null);
    setFilters(emptyFilterState());
  };

  const runExport = async (ids: Id[]) => {
    if (!businessId) return;
    const fileName = `clients-${today()}.csv`;
    try {
      const rows = await exportM.mutate({ businessId, locationIds: activeLocationIds, ids, authorName: t('card.you'), fileName });
      downloadCsv(fileName, clientsCsv(rows, t));
      toast.success(t('excel.exported', { count: rows.length, file: fileName }));
    } catch {
      toast.error(t('excel.exportFailed'));
    }
  };

  const openAdd = (name = '') => {
    setPrefillName(name);
    setAddOpen(true);
  };

  const isFirstLoad = !enabled || listQ.isLoading;
  const [hadPager, saveHadPager] = useRememberedLayout<boolean>('clients-pager');
  useEffect(() => {
    if (!isFirstLoad) saveHadPager((data?.total ?? 0) > DEFAULT_PAGE_SIZE);
  });
  // Десктоп — в шапке рядом с «Добавить клиента»; телефон — «⋯» в строке поиска, «Добавить» — плавающей кнопкой
  const headerActions = (
    <ClientsHeaderActions
      canEdit={canEdit}
      canExport={rights.exportList}
      exportCount={data?.total ?? 0}
      exporting={exportM.isPending}
      disabled={!enabled || listQ.isError}
      onAdd={() => openAdd()}
      onAddVisit={() => setAddVisitOpen(true)}
      onExport={() => data && runExport(data.ids)}
      onOpenColumns={() => setColumnsOpen(true)}
    />
  );
  const baseEmpty = data?.baseTotal === 0;
  const searching = Boolean(search.trim()) || Boolean(pick) || filterCount > 0;
  const selectable = !isMobile || selectMode;

  return (
    <div data-f="F-04-001" className="flex flex-col gap-4 md:gap-6">
      <span data-f="F-04-199" hidden />
      <PageHeader
        title={t('title')}
        description={<span className="max-md:hidden">{t('subtitle')}</span>}
        actions={<span className="flex items-center gap-2 max-md:hidden">{headerActions}</span>}
      />

      {ready && businessId && !searching && <PendingMarksBanner businessId={businessId} />}

      {listQ.isError ? (
        <ErrorState title={t('list.loadFailed')} onRetry={listQ.refetch} />
      ) : baseEmpty && !onlyStaffId ? (
        // Пустая база (onboarding-k3 №1, empty-d1): без поиска, фильтров и нулей — сразу что делать
        <EmptyState
          icon={<Users aria-hidden />}
          title={t('empty.baseTitle')}
          description={t('empty.baseText')}
          action={
            canEdit ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button leftIcon={<UserPlus aria-hidden />} onClick={() => openAdd()}>
                  {t('addClient')}
                </Button>
                <LinkButton href="/biz/clients/import" variant="outline" leftIcon={<Upload aria-hidden />}>
                  {t('empty.importAction')}
                </LinkButton>
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div data-f="F-04-002 F-04-017" className="flex items-center gap-2">
              <SearchInput
                value={search}
                onValueChange={changeSearch}
                debounceMs={250}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="min-w-0 flex-1 md:max-w-xl"
              />
              {/* С3 (clients-review 27.09.2026): та же кнопка «Фильтры ⌄», что и на других экранах (FilterBar) —
                  раньше это была неподписанная иконка, новичок не понимал, что она открывает. */}
              {isMobile ? (
                <Button
                  variant="outline"
                  aria-haspopup="dialog"
                  aria-expanded={filterOpen}
                  aria-label={filterCount > 0 ? t('filters.buttonActive', { count: filterCount }) : t('filters.button')}
                  chevron={false}
                  className={cn('relative w-11 shrink-0 px-0', filterCount > 0 && 'border-primary text-primary-text')}
                  onClick={() => setFilterOpen(true)}
                >
                  <SlidersHorizontal aria-hidden />
                  {filterCount > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-5 font-semibold text-primary-contrast ring-2 ring-bg"
                    >
                      {filterCount}
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  aria-haspopup="dialog"
                  aria-expanded={filterOpen}
                  leftIcon={<SlidersHorizontal aria-hidden />}
                  className={cn('shrink-0', filterCount > 0 && 'border-primary text-primary-text')}
                  onClick={() => setFilterOpen(true)}
                >
                  {t('filters.button')}
                  {filterCount > 0 && (
                    <span
                      aria-hidden
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-contrast"
                    >
                      {filterCount}
                    </span>
                  )}
                </Button>
              )}
              <span className="flex items-center md:hidden">{headerActions}</span>
            </div>
            <QuickPicksRow
              value={pick}
              onChange={(p) => {
                changePick(p);
                resetPage();
              }}
              counts={data?.pickCounts}
              countsLoading={isFirstLoad}
              showChatLeads={chatLeadsQ.data ?? false}
            />
            {filterCount > 0 && (
              <ActiveFilterChips
                value={filters}
                onOpen={() => setFilterOpen(true)}
                onChange={(next) => {
                  setFilters(next);
                  resetPage();
                }}
              />
            )}
          </div>

          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
              {isFirstLoad
                ? <SkeletonText width="11ch" />
                : searching
                  ? t('list.foundOf', { found: data?.total ?? 0, total: data?.baseTotal ?? 0 })
                  : t('list.total', { count: data?.baseTotal ?? 0 })}
              <span aria-hidden className="inline-flex size-4 items-center justify-center">
                {listBusy && <LoaderCircle className="size-4 animate-spin text-muted" />}
              </span>
            </p>
            <div className="flex items-center gap-1">
              {(filterCount > 0 || pick) && (
                <Button variant="ghost" size="sm" onClick={resetAll}>
                  {t('filters.resetAll')}
                </Button>
              )}
              {/* При загрузке кнопка уже на месте (выключена) — не появляется из пустоты, когда приходит список */}
              {isMobile && (isFirstLoad || (data?.total ?? 0) > 0) && (
                <Button
                  disabled={isFirstLoad}
                  variant="ghost"
                  size="sm"
                  leftIcon={<CheckSquare aria-hidden />}
                  onClick={() => {
                    setSelectMode((v) => !v);
                    setSelected([]);
                  }}
                >
                  {selectMode ? t('list.selectDone') : t('list.select')}
                </Button>
              )}
            </div>
          </div>

          {/* Пока ищется новый ответ, прежние строки остаются как есть (не приглушаются — это мигание всей таблицы,
              DESIGN.md → «Nothing blinks»): поиск идёт — крутится только значок у счётчика над таблицей. */}
          <div data-f="F-04-003 F-04-006 F-04-007 F-04-010">
            <Table
              columns={columns}
              rows={data?.rows ?? []}
              rowKey={(r) => r.id}
              selectable={selectable}
              selected={selected}
              onSelectedChange={setSelected}
              sort={sort ?? (pick === 'due' ? null : DEFAULT_CLIENTS_SORT)}
              onSortChange={(next: TableSort | null) => {
                setSort(next ? { columnId: next.columnId as ClientsSort['columnId'], dir: next.dir } : null);
                setPage(1);
              }}
              manualSort
              onRowClick={(row) => {
                // Строка уже на экране — карточка покажет её сразу, а не скелетон всей страницы
                seedClientRow(row, businessId ?? undefined, businessIds, onlyStaffId);
              }}
              rowHref={(row) => `/biz/clients/${row.id}`}
              mobileCard={(row) => (
                <ClientMobileRow
                  row={row}
                  canSeeContacts={canSeeContacts}
                  canViewFullName={rights.viewFullName}
                  canViewAccounts={rights.viewAccounts}
                  highlighted={row.id === highlightId}
                />
              )}
              classNames={{ card: 'p-3', row: 'h-14' }}
              mobileCardSkeleton={<ClientMobileRowSkeleton />}
              loading={isFirstLoad}
              loadingRows={DEFAULT_PAGE_SIZE}
              label={t('title')}
              empty={
                <div data-f="F-04-008">
                  <EmptyState
                    variant="section"
                    kind="search"
                    icon={<Users aria-hidden />}
                    title={search.trim() ? t('empty.searchTitle', { query: search.trim() }) : t('empty.filterTitle')}
                    description={t('empty.searchText')}
                    onReset={resetAll}
                    action={
                      canEdit && search.trim() ? (
                        <Button variant="outline" leftIcon={<UserPlus aria-hidden />} onClick={() => openAdd(search.trim())}>
                          {t('empty.addWithQuery', { query: search.trim() })}
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              }
            />
            {/* При загрузке строка страниц уже на месте, если в прошлый раз клиентов было больше страницы (по умолчанию —
                да: база салона обычно больше 10 клиентов) */}
            {(isFirstLoad ? (hadPager ?? true) : (data?.total ?? 0) > DEFAULT_PAGE_SIZE) && (
              <Pagination
                loading={isFirstLoad}
                page={data?.page ?? page}
                pageSize={pageSize}
                total={data?.total ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                className="mt-4"
              />
            )}
            {businessId && (
              <ClientsBulkActions
                businessId={businessId}
                selected={selected}
                onClear={() => setSelected([])}
                categoryOptions={categoriesQ.data ?? []}
                canMail={canMail}
                canEdit={canEdit}
                canExport={rights.exportList}
                canDelete={rights.deleteClients}
                exporting={exportM.isPending}
                onExport={runExport}
              />
            )}
          </div>
        </>
      )}

      {canEdit && selected.length === 0 && !baseEmpty && <Fab icon={<UserPlus aria-hidden />} label={t('addClient')} onClick={() => openAdd()} />}

      <FilterBuilderSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onApply={(next) => {
          setFilters(next);
          resetPage();
        }}
        staffOptions={(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        serviceOptions={(servicesQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        categoryOptions={categoriesQ.data ?? []}
        businessId={businessId ?? undefined}
        locationIds={activeLocationIds}
      />

      <AddClientSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        businessId={businessId ?? undefined}
        prefill={prefillName}
        onCreated={(id) => {
          // Остаёмся на списке (F-04-061): сбрасываем поиск и фильтры, api отдаёт страницу с новой строкой
          resetAll();
          setSort(null);
          setRevealId(id);
        }}
        onDuplicateFound={(id) => router.push(`/biz/clients/${id}`)}
      />

      <AddVisitSheet
        open={addVisitOpen}
        onOpenChange={setAddVisitOpen}
        businessId={businessId ?? undefined}
        locationId={locationId && locationId !== 'all' ? locationId : undefined}
      />

      <ColumnsMenu
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        businessId={businessId ?? ''}
        staffId={staffId ?? undefined}
        prefs={columnsQ.data ?? defaultColumnsPrefs()}
      />
    </div>
  );
}

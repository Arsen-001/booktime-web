'use client';

/**
 * /biz/services — каталог услуг (F-00-082, F-14-114, F-16-028, F-01-193, F-16-170).
 * Широкий экран — таблица во всю ширину с правкой прямо в строке (У5), телефон — компактные строки (У6).
 * Перетаскивание, отметки и массовые действия, фильтр по мастеру и чипы-исключения (У10). Категорию можно
 * переименовать и удалить прямо здесь (У1); пустые категории видны (У12). «+» на телефоне — меню «Создать» (У2).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { LayoutGrid, ListPlus, Plus, Sparkles } from 'lucide-react';
import { listCategories, listServiceRows, listStaffForPicker } from '@/api/services';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { normalizeSearch, pickText } from '@/lib/text';
import { CatalogBulkBar } from '@/areas/services/catalog/CatalogBulkBar';
import { CatalogExcelMenu } from '@/areas/services/catalog/CatalogExcelMenu';
import { CatalogSummary } from '@/areas/services/catalog/CatalogSummary';
import { CatalogTable } from '@/areas/services/catalog/CatalogTable';
import { CatalogToolbar, NO_FILTERS, type CatalogFilters } from '@/areas/services/catalog/CatalogToolbar';
import { CatalogSkeleton, SummarySkeleton } from '@/areas/services/catalog/CatalogSkeleton';
import { CreateSheet } from '@/areas/services/catalog/CreateSheet';
import { TABLE_QUERY } from '@/areas/services/catalog/grid';
import { useCatalogActions } from '@/areas/services/catalog/useCatalogActions';
import { Button, LinkButton } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { PageHeader } from '@/ui/PageHeader';
import { Reveal } from '@/ui/Reveal';
import { useIsMobile, useMediaQuery } from '@/ui/hooks/useMediaQuery';

export function ServicesScreen() {
  const t = useT('services');
  const router = useRouter();
  const locale = useLocale() as 'ru' | 'en';
  const isMobile = useIsMobile();
  const table = useMediaQuery(TABLE_QUERY);
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('services.edit');
  const [filters, setFilters] = useState<CatalogFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const enabled = ready && Boolean(businessId);
  const rowsQ = useApiQuery(['services', 'rows', businessId], () => listServiceRows(businessId ?? ''), { enabled });
  const categoriesQ = useApiQuery(['services', 'categories', businessId], () => listCategories(businessId ?? ''), { enabled });
  const staffQ = useApiQuery(['services', 'staffPicker', businessId], () => listStaffForPicker(businessId ?? ''), { enabled });
  const actions = useCatalogActions(businessId ?? '');

  const rows = [...(rowsQ.data ?? [])].sort((a, b) => a.service.order - b.service.order);
  const categories = [...(categoriesQ.data ?? [])].sort((a, b) => a.order - b.order);
  const staffList = staffQ.data ?? [];

  const q = normalizeSearch(filters.search);
  const filterActive = q !== '' || filters.staffId !== '' || filters.notOnline || filters.noStaff;
  const filtered = rows.filter(
    ({ service: s }) =>
      (!q || [s.name.ru, s.name.hy, s.name.en, pickText(s.name, locale)].some((n) => n && normalizeSearch(n).includes(q))) &&
      (!filters.staffId || s.staffIds.includes(filters.staffId)) &&
      (!filters.notOnline || !s.onlineBookable) &&
      (!filters.noStaff || s.staffIds.length === 0),
  );
  const groups = categories
    .map((category) => ({
      category,
      rows: filtered.filter((r) => r.service.categoryId === category.id),
    }))
    .filter((g) => g.rows.length > 0 || !filterActive);
  const counts = {
    notOnline: rows.filter((r) => !r.service.onlineBookable).length,
    noStaff: rows.filter((r) => r.service.staffIds.length === 0).length,
  };
  const selectedRows = rows.filter((r) => selected.has(r.service.id));

  const loading = rowsQ.isLoading || categoriesQ.isLoading;
  const noServices = !loading && rows.length === 0;
  const filterEmpty = !loading && rows.length > 0 && filtered.length === 0;

  const onSelect = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const onSelectMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const createMenu = (
    <DropdownMenu
      trigger={(p) => (
        <Button leftIcon={<Plus aria-hidden />} {...p}>
          {t('createMenu.button')}
        </Button>
      )}
      items={[
        {
          id: 'service',
          label: t('createMenu.service'),
          icon: <ListPlus aria-hidden />,
          onSelect: () => router.push('/biz/services/new'),
        },
        {
          id: 'category',
          label: t('createMenu.category'),
          icon: <LayoutGrid aria-hidden />,
          onSelect: () => router.push('/biz/services/categories/new'),
        },
        {
          id: 'templates',
          label: t('createMenu.templates'),
          icon: <Sparkles aria-hidden />,
          onSelect: () => router.push('/biz/services/templates'),
        },
      ]}
      label={t('createMenu.button')}
    />
  );

  return (
    <div data-f="F-00-082 F-14-114" className="flex flex-col gap-5 pb-28 md:gap-6 md:pb-10">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canEdit ? (
            <span className="flex items-center gap-2 max-md:hidden">
              <CatalogExcelMenu rows={rows} categories={categories} />
              {createMenu}
            </span>
          ) : undefined
        }
      />

      {rowsQ.isError || categoriesQ.isError ? (
        <ErrorState onRetry={() => (rowsQ.isError ? rowsQ.refetch() : categoriesQ.refetch())} />
      ) : (
        <>
          {loading ? (
            <SummarySkeleton />
          ) : noServices ? (
            <EmptyState
              icon={<Sparkles aria-hidden />}
              title={t('empty.title')}
              description={t('empty.description')}
              action={
                canEdit ? (
                  <span className="flex flex-wrap justify-center gap-2">
                    <LinkButton href="/biz/services/templates" leftIcon={<Sparkles aria-hidden />}>
                      {t('empty.action')}
                    </LinkButton>
                    <LinkButton href="/biz/services/new" variant="secondary" leftIcon={<Plus aria-hidden />}>
                      {t('empty.create')}
                    </LinkButton>
                  </span>
                ) : undefined
              }
            />
          ) : (
            <CatalogSummary
              total={rows.length}
              categories={categories.length}
              online={rows.filter((r) => r.service.onlineBookable).length}
            />
          )}
          {!noServices && <CatalogToolbar value={filters} onValueChange={setFilters} staffList={staffList} counts={counts} />}
          <Reveal loading={loading} skeleton={<CatalogSkeleton table={table} canEdit={canEdit} />}>
            {filterEmpty ? (
              <EmptyState variant="section" kind="search" title={t('empty.searchTitle')} onReset={() => setFilters(NO_FILTERS)} compact />
            ) : (
              groups.length > 0 && (
                <CatalogTable
                  groups={groups}
                  allRows={rows}
                  staffList={staffList}
                  selected={selected}
                  onSelect={onSelect}
                  onSelectMany={onSelectMany}
                  canEdit={canEdit}
                  dragDisabled={filterActive}
                  table={table}
                  actions={actions}
                />
              )
            )}
          </Reveal>
          {canEdit && (
            <CatalogBulkBar selectedRows={selectedRows} categories={categories} onClear={() => setSelected(new Set())} actions={actions} />
          )}
        </>
      )}

      {isMobile && canEdit && (
        <>
          <Fab icon={<Plus aria-hidden />} label={t('createMenu.button')} onClick={() => setCreateOpen(true)} />
          <CreateSheet open={createOpen} onOpenChange={setCreateOpen} />
        </>
      )}
    </div>
  );
}

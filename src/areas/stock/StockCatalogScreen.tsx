'use client';

/**
 * /biz/stock — «Товары»: дерево категорий + «Все товары» (F-08-010, F-08-015, F-08-016), карточка товара —
 * отдельные страницы /biz/stock/goods/**. Пачка b01: F-00-133, F-08-001, F-08-002, F-08-010, F-08-011,
 * F-08-015, F-08-016, F-08-024 (метка «критично»), F-00-140 (метка срока), F-08-143 (пустые состояния).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Archive, ArchiveRestore, Boxes, Camera, CalendarClock, Download, FileSpreadsheet, ListChecks, Package, PanelLeft, Upload } from 'lucide-react';
import { archiveGoods, countBelowCritical, exportGoodsCsv, listCategoryTree, listExpiredGoods, listGoods, searchGoods, type CategoryNode } from '@/api/stock';
import { downloadCsv } from '@/lib/csv';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { Category } from '@/domain/stock';
import { expiryFlag, unitById } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { pickText } from '@/lib/text';
import { today } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { Sheet } from '@/ui/Sheet';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { useConfirm, useToast } from '@/ui/Toast';
import { Tooltip } from '@/ui/Tooltip';
import { CameraScanner } from '@/areas/stock/CameraScanner';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';
import { CategoryFormModal } from '@/areas/stock/CategoryFormModal';
import { CategoryTree, CategoryTreeSkeleton } from '@/areas/stock/CategoryTree';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';
import { formatQty } from '@/areas/stock/warehouse.utils';

function flatten(tree: CategoryNode[]): Category[] {
  return tree.flatMap((n) => [n as Category, ...flatten(n.children)]);
}

function countGoods(tree: CategoryNode[]): number {
  return tree.reduce((sum, n) => sum + n.goodsCount + countGoods(n.children), 0);
}

export function StockCatalogScreen() {
  const t = useT('stock');
  const router = useRouter();
  const format = useFormat();
  const { lang } = useDemo();
  // F-08-116: создание/архивация товаров — только с правом «Доступ к управлению товарами»
  const perm = useStockPermissions();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [categoryId, setCategoryId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [treeOpen, setTreeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // М1: номер открытия окна категории — новая форма на каждое ОТКРЫТИЕ, а закрытие не пересоздаёт окно
  // (раньше ключ содержал modalOpen, и окно размонтировалось на закрытии — без анимации ухода)
  const [formSeq, setFormSeq] = useState(0);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [newCategoryParent, setNewCategoryParent] = useState<string | undefined>();
  const [selected, setSelected] = useState<Id[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const treeQ = useApiQuery(['stock', 'categoryTree', businessId, locationId], () => listCategoryTree(businessId!, locationId!), { enabled });
  const goodsQ = useApiQuery(
    ['stock', 'goods', businessId, locationId, categoryId, search, page, pageSize],
    () => listGoods(businessId!, locationId!, { categoryId: categoryId === 'all' ? undefined : categoryId, search, page, pageSize }),
    { enabled },
  );
  const criticalQ = useApiQuery(['stock', 'belowCritical', businessId, locationId], () => countBelowCritical(businessId!, locationId!), { enabled });
  // F-00-140: срок годности — тот же сигнал, что и «Списать просроченное» в форме списания, здесь только счётчик
  const expiredQ = useApiQuery(['stock', 'expiredCount', businessId, locationId], () => listExpiredGoods(businessId!, locationId!), { enabled });
  const archiveMutation = useApiMutation((ids: Id[]) => archiveGoods(businessId!, ids));

  const exportExcel = async () => {
    const csv = await exportGoodsCsv(businessId!, locationId!, categoryId === 'all' ? undefined : categoryId);
    downloadCsv('stock-goods.csv', csv);
  };

  const clearSelection = () => setSelected([]);
  const archiveSelected = async () => {
    const ok = await confirm({
      title: t('catalog.bulk.archiveConfirmTitle', { count: selected.length }),
      description: t('catalog.bulk.archiveConfirmText'),
      confirmLabel: t('catalog.bulk.archiveConfirm'),
    });
    if (!ok) return;
    try {
      const result = await archiveMutation.mutate(selected);
      // F-08-028: счётчик «Все товары (N)» в сайдбаре берётся из дерева категорий — `listCategoryTree`
      // читает `goods`, поэтому запись в архив будит его сама (state-s1 §2), явный refetch не нужен.
      if (result.skipped.length > 0) {
        toast.error(t('catalog.bulk.archivedSkipped', { archived: result.archived.length, skipped: result.skipped.length }));
      } else {
        toast.success(t('catalog.bulk.archived', { count: result.archived.length }));
      }
      clearSelection();
    } catch {
      toast.error(t('catalog.bulk.archiveFailed'));
    }
  };

  if (treeQ.isError) return <ErrorState onRetry={treeQ.refetch} />;
  if (goodsQ.isError) return <ErrorState onRetry={goodsQ.refetch} />;

  const tree = treeQ.data ?? [];
  const flatCategories = flatten(tree);
  const totalGoodsInLocation = countGoods(tree);
  const rows = goodsQ.data?.items ?? [];
  const total = goodsQ.data?.total ?? 0;
  const hasAnyGoods = totalGoodsInLocation > 0;
  const isFiltered = Boolean(search.trim()) || categoryId !== 'all';

  const columns: TableColumn<(typeof rows)[number]>[] = [
    {
      id: 'name',
      header: t('catalog.columns.name'),
      mobile: 'title',
      width: '18rem',
      // Одна строка: длинное название — многоточием, метки рядом; строка и колонка не зависят от данных
      cell: (g) => (
        <span className="flex max-w-[16rem] items-center gap-2 whitespace-nowrap">
          <span className="min-w-0 truncate">{g.name}</span>
          {g.belowCritical && (
            <Tooltip content={t('catalog.criticalHint')}>
              <Badge tone="danger" size="sm">
                {t('catalog.criticalBadge')}
              </Badge>
            </Tooltip>
          )}
          {expiryFlag(g.expiryDate, today()) !== 'ok' && (
            <Badge tone={expiryFlag(g.expiryDate, today()) === 'expired' ? 'danger' : 'warning'} size="sm">
              {expiryFlag(g.expiryDate, today()) === 'expired' ? t('catalog.expiredBadge') : t('catalog.expiringBadge')}
            </Badge>
          )}
        </span>
      ),
    },
    { id: 'category', header: t('catalog.columns.category'), mobile: 'subtitle', width: '11rem', cell: (g) => <span className="block max-w-[9rem] truncate">{g.categoryName}</span> },
    {
      id: 'stock',
      header: t('catalog.columns.stock'),
      mobile: 'meta',
      align: 'right',
      width: '11rem',
      className: 'whitespace-nowrap',
      sortable: true,
      sortValue: (g) => g.totalStock,
      // F-08-020: остаток виден в обеих единицах — продажи и списания («0,8 флак. (8 мл)»); F-08-061: минус — красным
      cell: (g) => {
        const saleText = `${formatQty(g.totalStock)} ${pickText(unitById(g.saleUnit).short, lang)}`;
        const text = g.writeoffUnit === g.saleUnit ? saleText : `${saleText} (${formatQty(g.totalStock * g.unitRatio)} ${pickText(unitById(g.writeoffUnit).short, lang)})`;
        return g.totalStock < 0 ? <span className="font-medium text-danger">{text}</span> : text;
      },
    },
    { id: 'price', header: t('catalog.columns.price'), mobile: 'aside', align: 'right', width: '7.5rem', className: 'whitespace-nowrap', sortable: true, sortValue: (g) => g.salePrice, cell: (g) => (g.salePrice ? format.money(g.salePrice) : '—') },
  ];

  return (
    <div data-f="F-00-133 F-08-001 F-08-002 F-00-137 F-00-139 F-08-028 F-08-032 F-08-061 F-08-116 F-08-143 F-08-144 F-08-145 F-08-147" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('catalog.title')}
        description={t('catalog.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <HelpArticleButton titleKey="help.catalog.title" bodyKey="help.catalog.body" />
            <IconButton icon={<Camera aria-hidden />} label={t('goodPicker.scan')} variant="outline" onClick={() => setScannerOpen(true)} />
            <DropdownMenu
              trigger={(props) => <IconButton {...props} icon={<FileSpreadsheet aria-hidden />} variant="outline" label={t('catalog.excelMenu')} />}
              items={[
                { id: 'export', label: t('catalog.exportExcel'), icon: <Download aria-hidden />, onSelect: exportExcel },
                {
                  id: 'import',
                  label: t('catalog.importExcel'),
                  icon: <Upload aria-hidden />,
                  onSelect: () => router.push(`/biz/stock/import${categoryId !== 'all' ? `?category=${categoryId}` : ''}`),
                },
                { id: 'sep', separator: true },
                { id: 'archive', label: t('catalog.archiveLink'), icon: <ArchiveRestore aria-hidden />, onSelect: () => router.push('/biz/stock/archive') },
              ]}
            />
            {perm.manageGoods && <LinkButton href={`/biz/stock/goods/new${categoryId !== 'all' ? `?category=${categoryId}` : ''}`}>{t('catalog.addGood')}</LinkButton>}
          </div>
        }
      />
      <CameraScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={async (code) => {
          setScannerOpen(false);
          const found = await searchGoods(businessId!, locationId!, code, 5);
          const exact = found.find((g) => g.barcode === code);
          if (exact) router.push(`/biz/stock/goods/${exact.id}`);
          else {
            setSearch(code);
            toast.info(t('goodPicker.scanNotFound'));
          }
        }}
      />

      {/* F-00-137/F-08-028: остаток и «ниже критичного» — как заголовок карточки, а не строка в шапке страницы */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('catalog.stats.total')} value={format.number(totalGoodsInLocation)} icon={<Package aria-hidden />} loading={treeQ.isLoading} />
        {criticalQ.isLoading ? (
          // Чаще всего есть товары ниже критичного — пока грузится, карточка уже той высоты, что с подсказкой
          <StatCard label={t('catalog.stats.critical')} value="" icon={<AlertTriangle aria-hidden />} hint={t('catalog.criticalHint')} loading />
        ) : criticalQ.data && criticalQ.data > 0 ? (
          <Link href="/biz/stock/order" className="block">
            <StatCard
              label={t('catalog.stats.critical')}
              value={format.number(criticalQ.data)}
              icon={<AlertTriangle aria-hidden />}
              hint={t('catalog.criticalHint')}
              className="border-danger/30 bg-danger-soft/40"
            />
          </Link>
        ) : (
          <StatCard label={t('catalog.stats.critical')} value={format.number(criticalQ.data ?? 0)} icon={<AlertTriangle aria-hidden />} loading={criticalQ.isLoading} />
        )}
        <StatCard label={t('catalog.stats.expired')} value={format.number(expiredQ.data?.length ?? 0)} icon={<CalendarClock aria-hidden />} loading={expiredQ.isLoading} />
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 rounded-xl border border-border bg-surface p-3 md:block">
          {treeQ.isLoading ? (
            <CategoryTreeSkeleton />
          ) : (
            <CategoryTree
              tree={tree}
              selectedId={categoryId}
              onSelect={setCategoryId}
              onEdit={(node) => {
                setEditingCategory(node);
                setFormSeq((n) => n + 1);
                setModalOpen(true);
              }}
              onAddChild={(parentId) => {
                setEditingCategory(undefined);
                setNewCategoryParent(parentId);
                setFormSeq((n) => n + 1);
                setModalOpen(true);
              }}
              allGoodsCount={totalGoodsInLocation}
            />
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-2 md:hidden">
            <IconButton icon={<PanelLeft aria-hidden />} variant="outline" label={t('catalog.openCategories')} onClick={() => setTreeOpen(true)} />
            <FilterBar
              className="flex-1"
              search={{ value: search, onValueChange: (v) => { setSearch(v); setPage(1); }, placeholder: t('catalog.searchPlaceholder') }}
            />
          </div>
          <div className="hidden md:block">
            <FilterBar search={{ value: search, onValueChange: (v) => { setSearch(v); setPage(1); }, placeholder: t('catalog.searchPlaceholder') }} />
          </div>

          {!treeQ.isLoading && !hasAnyGoods && !isFiltered ? (
            <EmptyState
              icon={<Package aria-hidden />}
              title={t('catalog.emptyStartTitle')}
              description={t('catalog.emptyStartText')}
              action={perm.manageGoods ? <LinkButton href="/biz/stock/goods/new">{t('catalog.addGood')}</LinkButton> : undefined}
            />
          ) : (
            <div data-f="F-08-015 F-08-016">
              <Table
                columns={columns}
                rows={rows}
                // Страницы отдаёт сервер — встроенные у таблицы выключены
                pagination={false}
                rowKey={(g) => g.id}
                selectable
                selected={selected}
                onSelectedChange={(ids) => setSelected(ids as Id[])}
                loading={goodsQ.isLoading || treeQ.isLoading}
                loadingRows={6}
                rowHref={(g) => `/biz/stock/goods/${g.id}`}
                label={t('catalog.title')}
                empty={
                  <EmptyState
                    kind="search"
                    icon={<Boxes aria-hidden />}
                    title={t('catalog.notFoundTitle')}
                    description={t('catalog.notFoundText')}
                    action={
                      isFiltered ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-primary-text underline underline-offset-2"
                          onClick={() => { setSearch(''); setCategoryId('all'); setPage(1); }}
                        >
                          {t('catalog.resetFilters')}
                        </button>
                      ) : undefined
                    }
                  />
                }
              />
              <BulkActionBar
                count={selected.length}
                onClear={clearSelection}
                actions={
                  // F-08-031: «Быстрое управление» — отдельная страница с таблицей, а не модалка на паре полей
                  <Button size="sm" variant="secondary" leftIcon={<ListChecks aria-hidden />} className="max-sm:gap-0 max-sm:px-3" onClick={() => router.push('/biz/stock/mass-edit')}>
                    <span className="max-sm:sr-only">{t('catalog.bulk.quickEdit')}</span>
                  </Button>
                }
                moreItems={perm.manageGoods ? [
                  { id: 'archive', label: t('catalog.bulk.archiveSelected'), icon: <Archive aria-hidden />, danger: true, onSelect: archiveSelected },
                ] : []}
              />
            </div>
          )}

          {/* F-08-015: переключатель строк на странице (25/50/100) должен быть виден и когда товаров
              меньше одной страницы — раньше Pagination рисовался только при total > pageSize, и на
              небольшом каталоге (демо-данные — единицы товаров) переключатель не появлялся вовсе. */}
          {goodsQ.isLoading ? (
            // Пока грузится — та же полоса страниц (одна страница, текст «1–N из N» ещё скрыт), неактивная
            <div inert className="[&_nav>p]:invisible">
              <Pagination page={1} pageSize={pageSize} total={1} onPageChange={() => {}} onPageSizeChange={() => {}} />
            </div>
          ) : total > 0 && (
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          )}
        </div>
      </div>

      <Sheet open={treeOpen} onOpenChange={setTreeOpen} title={t('catalog.categoriesTitle')} side="left">
        <CategoryTree
          tree={tree}
          selectedId={categoryId}
          onSelect={(id) => { setCategoryId(id); setTreeOpen(false); }}
          onEdit={(node) => {
            setEditingCategory(node);
            setFormSeq((n) => n + 1);
            setModalOpen(true);
          }}
          onAddChild={(parentId) => {
            setEditingCategory(undefined);
            setNewCategoryParent(parentId);
            setFormSeq((n) => n + 1);
            setModalOpen(true);
          }}
          allGoodsCount={totalGoodsInLocation}
        />
      </Sheet>

      {businessId && locationId && (
        <CategoryFormModal
          // F-08-012: CategoryFormModal хранит name/sku/comment в useState, инициализированном из `editing`
          // при первом монтировании — сам компонент между открытиями не размонтируется (только его внутренний
          // <Modal> возвращает null), поэтому смена редактируемой категории не перечитывала бы поля заново.
          // Ключ по editing?.id + номеру открытия пересоздаёт форму с чистым состоянием на каждое открытие,
          // а закрытие идёт в том же экземпляре — окно уходит с анимацией (М1).
          key={`${editingCategory?.id ?? 'new'}:${formSeq}`}
          open={modalOpen}
          onOpenChange={setModalOpen}
          businessId={businessId}
          locationId={locationId}
          flatCategories={flatCategories}
          editing={editingCategory}
          defaultParentId={newCategoryParent}
          onSaved={(cat) => setCategoryId(cat.id)}
          onArchivedOrDeleted={() => {
            // `listCategoryTree` читает `categories`, поэтому запись сама будит дерево (state-s1 §2).
            if (editingCategory && categoryId === editingCategory.id) setCategoryId('all');
          }}
        />
      )}
    </div>
  );
}

'use client';

/**
 * /biz/stock/archive — «Архив товаров» (F-08-013, F-08-029, F-08-030/F-08-014 удаление насовсем).
 * Две вкладки: Товары и Категории; по каждой строке — «Восстановить» и «Удалить» (необратимо, слово-подтверждение
 * для нескольких сразу — как у одного товара, F-08-144).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, FolderArchive, Trash2 } from 'lucide-react';
import {
  deleteCategory,
  deleteGoods,
  listArchivedCategories,
  listArchivedGoods,
  restoreCategories,
  restoreGoods,
  type ArchivedGoodRow,
} from '@/api/stock';
import { useApiMutation, useApiQuery, ApiError } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { Category } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { Switch } from '@/ui/Switch';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';

const CONFIRM_WORD = 'Удалить';

export function ArchiveScreen() {
  const t = useT('stock');
  const router = useRouter();
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [tab, setTab] = useState<'goods' | 'categories'>('goods');
  const [selectedGoods, setSelectedGoods] = useState<Id[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Id[]>([]);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleteOpen, setDeleteOpen] = useState<'goods' | undefined>();
  // F-08-029: «Не добавлять» / «Добавлять [Восстановлено] в название» — переключатель окна восстановления
  const [markRestored, setMarkRestored] = useState(false);

  const goodsQ = useApiQuery(['stock', 'archivedGoods', businessId, locationId], () => listArchivedGoods(businessId!, locationId!), { enabled });
  const categoriesQ = useApiQuery(['stock', 'archivedCategories', businessId, locationId], () => listArchivedCategories(businessId!, locationId!), { enabled });

  const restoreGoodsMutation = useApiMutation(({ ids, markRestored: mark }: { ids: Id[]; markRestored: boolean }) => restoreGoods(businessId!, ids, mark));
  const deleteGoodsMutation = useApiMutation((ids: Id[]) => deleteGoods(businessId!, ids));
  const restoreCategoriesMutation = useApiMutation((ids: Id[]) => restoreCategories(businessId!, ids));
  const deleteCategoryMutation = useApiMutation((id: Id) => deleteCategory(businessId!, id));

  if (goodsQ.isError) return <ErrorState onRetry={goodsQ.refetch} />;
  if (categoriesQ.isError) return <ErrorState onRetry={categoriesQ.refetch} />;

  const goods = goodsQ.data ?? [];
  const categories = categoriesQ.data ?? [];

  const restoreSelectedGoods = async () => {
    try {
      const res = await restoreGoodsMutation.mutate({ ids: selectedGoods, markRestored });
      if (res.skipped.length) toast.error(t('archive.restorePartial', { restored: res.restored.length, skipped: res.skipped.length }));
      else toast.success(t('archive.restored', { count: res.restored.length }));
      setSelectedGoods([]);
    } catch {
      toast.error(t('archive.restoreFailed'));
    }
  };

  const restoreSelectedCategories = async () => {
    try {
      const res = await restoreCategoriesMutation.mutate(selectedCategories);
      if (res.skipped.length) toast.error(t('archive.restorePartial', { restored: res.restored.length, skipped: res.skipped.length }));
      else toast.success(t('archive.restored', { count: res.restored.length }));
      setSelectedCategories([]);
    } catch {
      toast.error(t('archive.restoreFailed'));
    }
  };

  const confirmDeleteGoods = async () => {
    if (deleteWord.trim() !== CONFIRM_WORD) return;
    try {
      await deleteGoodsMutation.mutate(selectedGoods);
      toast.success(t('archive.deleted', { count: selectedGoods.length }));
      setSelectedGoods([]);
      setDeleteOpen(undefined);
      setDeleteWord('');
    } catch {
      toast.error(t('archive.deleteFailed'));
    }
  };

  const deleteOneCategory = async (id: Id) => {
    const ok = await confirm({ title: t('archive.deleteCategoryConfirmTitle'), description: t('archive.deleteCategoryConfirmText'), confirmLabel: t('archive.delete'), tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCategoryMutation.mutate(id);
      toast.success(t('archive.categoryDeleted'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'category_not_empty') toast.error(t('archive.categoryNotEmpty'));
      else if (e instanceof ApiError && e.code === 'last_category') toast.error(t('archive.lastCategory'));
      else toast.error(t('archive.deleteFailed'));
    }
  };

  const goodColumns: TableColumn<ArchivedGoodRow>[] = [
    { id: 'name', header: t('archive.columns.name'), mobile: 'title', cell: (g) => g.name },
    { id: 'category', header: t('archive.columns.category'), mobile: 'subtitle', cell: (g) => g.categoryName },
    { id: 'price', header: t('archive.columns.price'), mobile: 'aside', align: 'right', cell: (g) => (g.salePrice ? format.money(g.salePrice) : '—') },
  ];

  const categoryColumns: TableColumn<Category>[] = [
    { id: 'name', header: t('archive.columns.name'), mobile: 'title', cell: (c) => c.name },
    {
      id: 'actions',
      header: '',
      mobile: 'aside',
      align: 'right',
      cell: (c) => (
        <Button variant="ghost" size="sm" leftIcon={<Trash2 aria-hidden />} onClick={(e) => { e.stopPropagation(); deleteOneCategory(c.id); }}>
          {t('archive.delete')}
        </Button>
      ),
    },
  ];

  return (
    <div data-f="F-08-013 F-08-014 F-08-029 F-08-030 F-08-143 F-08-147" className="flex w-full flex-col gap-6">
      <PageHeader title={t('archive.title')} description={t('archive.subtitle')} actions={<Button variant="secondary" onClick={() => router.push('/biz/stock')}>{t('archive.back')}</Button>} />

      <Tabs
        items={[
          { value: 'goods', label: t('archive.tabGoods'), badge: goods.length || undefined },
          { value: 'categories', label: t('archive.tabCategories'), badge: categories.length || undefined },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
      />

      {tab === 'goods' ? (
        goodsQ.isLoading ? null : goods.length === 0 ? (
          <EmptyState icon={<Archive aria-hidden />} title={t('archive.emptyGoodsTitle')} description={t('archive.emptyGoodsText')} />
        ) : (
          <>
            <Switch checked={markRestored} onCheckedChange={setMarkRestored} label={t('archive.markRestoredLabel')} description={t('archive.markRestoredHint')} labelPosition="start" className="rounded-xl border border-border bg-surface px-3" />
            <Table
              columns={goodColumns}
              rows={goods}
              rowKey={(g) => g.id}
              selectable
              selected={selectedGoods}
              onSelectedChange={(ids) => setSelectedGoods(ids as Id[])}
              label={t('archive.tabGoods')}
            />
            <BulkActionBar
              count={selectedGoods.length}
              onClear={() => setSelectedGoods([])}
              actions={
                <Button size="sm" variant="secondary" leftIcon={<ArchiveRestore aria-hidden />} onClick={restoreSelectedGoods} loading={restoreGoodsMutation.isPending}>
                  {t('archive.restoreSelected')}
                </Button>
              }
              moreItems={[{ id: 'delete', label: t('archive.deleteSelected'), icon: <Trash2 aria-hidden />, danger: true, onSelect: () => setDeleteOpen('goods') }]}
            />
          </>
        )
      ) : categoriesQ.isLoading ? null : categories.length === 0 ? (
        <EmptyState icon={<FolderArchive aria-hidden />} title={t('archive.emptyCategoriesTitle')} description={t('archive.emptyCategoriesText')} />
      ) : (
        <>
          <Table
            columns={categoryColumns}
            rows={categories}
            rowKey={(c) => c.id}
            selectable
            selected={selectedCategories}
            onSelectedChange={(ids) => setSelectedCategories(ids as Id[])}
            label={t('archive.tabCategories')}
          />
          <BulkActionBar
            count={selectedCategories.length}
            onClear={() => setSelectedCategories([])}
            actions={
              <Button size="sm" variant="secondary" leftIcon={<ArchiveRestore aria-hidden />} onClick={restoreSelectedCategories} loading={restoreCategoriesMutation.isPending}>
                {t('archive.restoreSelected')}
              </Button>
            }
          />
        </>
      )}

      <Modal
        open={deleteOpen === 'goods'}
        onOpenChange={(o) => { if (!o) { setDeleteOpen(undefined); setDeleteWord(''); } }}
        title={t('archive.deleteConfirmTitle', { count: selectedGoods.length })}
        description={t('archive.deleteConfirmText')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(undefined)}>{t('archive.cancel')}</Button>
            <Button variant="danger" onClick={confirmDeleteGoods} loading={deleteGoodsMutation.isPending} disabled={deleteWord.trim() !== CONFIRM_WORD}>
              {t('archive.delete')}
            </Button>
          </>
        }
      >
        <Input value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} placeholder={CONFIRM_WORD} autoFocus />
        <p className="mt-2 text-xs text-muted">{t('goodForm.deleteTypeWord', { word: CONFIRM_WORD })}</p>
      </Modal>
    </div>
  );
}

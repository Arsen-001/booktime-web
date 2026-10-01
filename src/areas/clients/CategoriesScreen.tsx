'use client';

/**
 * /biz/clients/categories — справочник категорий клиентов (F-04-109/110). Раздел «clients».
 * Категория клиента = тег ядра (F-00-188); здесь — полноценное управление: создать, переименовать,
 * перекрасить, удалить (снимает тег у всех клиентов, сами клиенты остаются).
 */
import { useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/api/clients';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useClientsRights } from '@/areas/clients/lib/rights';
import { useCurrent } from '@/demo/hooks';
import type { ClientCategory } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ColorPicker } from '@/ui/ColorPicker';
import { ColorSwatch } from '@/ui/ColorSwatch';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';

interface Draft {
  original?: string;
  name: string;
  color: number;
}

export function CategoriesScreen() {
  const t = useT('clients');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const rights = useClientsRights();

  const listQ = useApiQuery(['clients', 'categories', 'full', businessId], () => listCategories(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  // Окно закрывается с анимацией — пока оно уезжает, показываем последний черновик, а не пустое окно
  // с заголовком «Новая категория» (содержимое не должно меняться во время выхода)
  const [shownDraft, setShownDraft] = useState<Draft | null>(null);
  if (draft && draft !== shownDraft) setShownDraft(draft);
  const view = draft ?? shownDraft;
  const [confirmDelete, setConfirmDelete] = useState<ClientCategory | null>(null);

  const create = useApiMutation((args: { name: string; color: string }) => createCategory(args.name, args.color));
  const update = useApiMutation((args: { name: string; nextName: string; color: string }) =>
    updateCategory(businessId ?? '', args.name, { name: args.nextName, color: args.color }),
  );
  const remove = useApiMutation((name: string) => deleteCategory(businessId ?? '', name));

  const openCreate = () => {
    setError(undefined);
    setDraft({ name: '', color: 1 });
  };
  const openEdit = (c: ClientCategory) => {
    setError(undefined);
    setDraft({ original: c.name, name: c.name, color: Number(c.color) || 1 });
  };

  const submit = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError(t('categoriesPage.form.nameRequired'));
      return;
    }
    try {
      if (draft.original) {
        await update.mutate({ name: draft.original, nextName: draft.name, color: String(draft.color) });
        toast.success(t('categoriesPage.form.updated'));
      } else {
        await create.mutate({ name: draft.name, color: String(draft.color) });
        toast.success(t('categoriesPage.form.created'));
      }
      setDraft(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate_category') setError(t('categoriesPage.form.duplicate'));
      else toast.error(t('categoriesPage.form.saveFailed'));
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await remove.mutate(confirmDelete.name);
      toast.success(t('categoriesPage.deleted'));
      setConfirmDelete(null);
    } catch {
      toast.error(t('categoriesPage.deleteFailed'));
    }
  };

  const categories = listQ.data ?? [];
  const skeletonRows = useSkeletonCount('categories', { loading: listQ.isLoading, count: listQ.data?.length, fallback: 8, max: 20 });

  return (
    <div data-f="F-04-109 F-04-110 F-04-113 F-04-204 F-00-188 F-14-104 F-15-127" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('categoriesPage.title')}
        description={rights.manageCategories ? t('categoriesPage.subtitle') : t('categoriesPage.readOnly')}
        actions={
          rights.manageCategories ? (
            <Button leftIcon={<Plus aria-hidden />} onClick={openCreate}>
              {t('categoriesPage.add')}
            </Button>
          ) : undefined
        }
      />

      {listQ.isError ? (
        <ErrorState title={t('categoriesPage.loadFailed')} onRetry={listQ.refetch} />
      ) : listQ.isLoading ? (
        // Те же строки: кружок цвета, имя, «N клиентов», место под «⋯»
        <ul className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 pl-3">
              <span className="-my-1 flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-1">
                <Skeleton variant="circle" className="size-7 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-fg">
                    <SkeletonText width={i % 2 ? '10ch' : '14ch'} />
                  </span>
                  <span className="block text-sm text-muted">
                    <SkeletonText width="10ch" />
                  </span>
                </span>
              </span>
              {rights.manageCategories && <span aria-hidden className="size-11 shrink-0 md:size-10" />}
            </li>
          ))}
        </ul>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Tag aria-hidden />}
          title={t('categoriesPage.emptyTitle')}
          description={t('categoriesPage.emptyText')}
          action={
            rights.manageCategories ? (
              <Button leftIcon={<Plus aria-hidden />} onClick={openCreate}>
                {t('categoriesPage.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.name} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 pl-3">
              {/* Э2 (clients-review 27.09.2026): строка ведёт в базу, отфильтрованную по категории (ux-r5 №20) —
                  без стрелки: она читалась как второе действие рядом с карандашом. Правка/удаление — в «⋯». */}
              <Link
                href={`/biz/clients?category=${encodeURIComponent(c.name)}`}
                className="-my-1 flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 hover:bg-surface-2"
              >
                <ColorSwatch colorIndex={Number(c.color) || 1} label={c.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-fg">{c.name}</span>
                  <span className="block text-sm text-muted">{t('categoriesPage.clientsCount', { count: c.count })}</span>
                </span>
              </Link>
              {rights.manageCategories && (
                <DropdownMenu
                  label={t('card.more')}
                  align="end"
                  trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('card.more')} variant="ghost" />}
                  items={[
                    { id: 'edit', label: t('categoriesPage.form.editTitle', { name: c.name }), icon: <Pencil aria-hidden />, onSelect: () => openEdit(c) },
                    {
                      id: 'delete',
                      label: t('categoriesPage.form.delete'),
                      icon: <Trash2 aria-hidden />,
                      danger: true,
                      onSelect: () => setConfirmDelete(c),
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={view?.original ? t('categoriesPage.form.editTitle', { name: view.original }) : t('categoriesPage.form.addTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('categoriesPage.form.cancel')}
            </Button>
            <Button loading={create.isPending || update.isPending} onClick={submit}>
              {t('categoriesPage.form.save')}
            </Button>
          </>
        }
      >
        {view && (
          <div className="flex flex-col gap-4">
            <FormField label={t('categoriesPage.form.name')} error={error} required>
              <Input
                value={view.name}
                onChange={(e) => setDraft({ ...view, name: e.target.value })}
                placeholder={t('categoriesPage.form.namePlaceholder')}
              />
            </FormField>
            <ColorPicker value={view.color} onValueChange={(color) => setDraft({ ...view, color })} label={t('categoriesPage.form.color')} />
            {view.name.trim() && (
              <p className="flex items-center gap-2 text-sm text-muted">
                {t('categoriesPage.form.preview')}
                <Badge tone="neutral" variant="outline" icon={<ColorSwatch colorIndex={view.color} label={view.name} size="sm" />}>
                  {view.name.trim()}
                </Badge>
              </p>
            )}
            {view.original && (
              <Button
                variant="ghost"
                className="self-start text-danger"
                leftIcon={<Trash2 aria-hidden className="size-4" />}
                onClick={() => {
                  const name = view.original as string;
                  setConfirmDelete(categories.find((c) => c.name === name) ?? { name, color: String(view.color), count: 0 });
                  setDraft(null);
                }}
              >
                {t('categoriesPage.form.delete')}
              </Button>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        tone="danger"
        title={confirmDelete ? t('categoriesPage.confirmDelete.title', { name: confirmDelete.name }) : ''}
        description={t('categoriesPage.confirmDelete.descriptionCount', { count: confirmDelete?.count ?? 0 })}
        confirmLabel={t('categoriesPage.form.delete')}
        onConfirm={doDelete}
      />
    </div>
  );
}

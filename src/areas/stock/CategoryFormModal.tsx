'use client';

/**
 * Окно категории (новая / правка) — F-08-011, F-08-012 «Архивировать», F-08-014 «Удалить». Открывается
 * поверх /biz/stock, не отдельной страницей (в плане раздела экраны и маршруты у категории своего адреса нет).
 */
import { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { archiveCategory, createCategory, deleteCategory, updateCategory, type CategoryInput } from '@/api/stock';
import { ApiError, useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import type { Category } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export function CategoryFormModal({
  open,
  onOpenChange,
  businessId,
  locationId,
  flatCategories,
  editing,
  defaultParentId,
  onSaved,
  onArchivedOrDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  flatCategories: Category[];
  editing?: Category;
  defaultParentId?: Id;
  onSaved?: (category: Category) => void;
  onArchivedOrDeleted?: () => void;
}) {
  const t = useT('stock');
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState<string>(editing?.parentId ?? defaultParentId ?? '');
  const [sku, setSku] = useState(editing?.sku ?? '');
  const [comment, setComment] = useState(editing?.comment ?? '');
  const [touched, setTouched] = useState(false);

  const createMutation = useApiMutation((input: CategoryInput) => createCategory(businessId, locationId, input));
  // Не `editing!.id`: React Compiler по «!» считает editing не-null и выносит чтение поля в рендер.
  const editingId = editing?.id;
  const updateMutation = useApiMutation((input: CategoryInput) => {
    if (!editingId) throw new Error('category is not selected');
    return updateCategory(businessId, editingId, input);
  });
  const archiveMutation = useApiMutation(() => {
    if (!editingId) throw new Error('category is not selected');
    return archiveCategory(businessId, editingId);
  });
  const deleteMutation = useApiMutation(() => {
    if (!editingId) throw new Error('category is not selected');
    return deleteCategory(businessId, editingId);
  });
  const saving = createMutation.isPending || updateMutation.isPending;

  const nameError = touched && !name.trim() ? t('categoryForm.nameRequired') : undefined;

  const categoryErrorText = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.code === 'category_not_empty') return t('categoryForm.notEmpty');
      if (e.code === 'last_category') return t('categoryForm.lastCategory');
    }
    return undefined;
  };

  const save = async () => {
    setTouched(true);
    if (!name.trim()) return;
    const input: CategoryInput = { name, parentId: parentId || undefined, sku: sku || undefined, comment: comment || undefined };
    try {
      const saved = editing ? await updateMutation.mutate(input) : await createMutation.mutate(input);
      toast.success(editing ? t('categoryForm.saved') : t('categoryForm.created'));
      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      toast.error(t('categoryForm.saveFailed'));
    }
  };

  // F-08-012: архивировать нельзя категорию с активными товарами/подкатегориями или единственную — понятная причина
  const archive = async () => {
    try {
      await archiveMutation.mutate(undefined);
      toast.success(t('categoryForm.archived'));
      onArchivedOrDeleted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(categoryErrorText(e) ?? t('categoryForm.archiveFailed'));
    }
  };

  // F-08-014: та же защита, «Удалить» необратимо — подтверждаем
  const remove = async () => {
    const ok = await confirm({ title: t('categoryForm.deleteConfirmTitle'), description: t('categoryForm.deleteConfirmText'), confirmLabel: t('categoryForm.delete'), tone: 'danger' });
    if (!ok) return;
    try {
      await deleteMutation.mutate(undefined);
      toast.success(t('categoryForm.deleted'));
      onArchivedOrDeleted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(categoryErrorText(e) ?? t('categoryForm.deleteFailed'));
    }
  };

  const parentOptions = [
    { value: '', label: t('categoryForm.noParent') },
    ...flatCategories.filter((c) => c.id !== editing?.id).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('categoryForm.editTitle') : t('categoryForm.title')}
      footer={
        <>
          {editing && (
            <>
              <Button variant="ghost" size="sm" leftIcon={<Archive aria-hidden />} onClick={archive} loading={archiveMutation.isPending} className="mr-auto">
                {t('categoryForm.archive')}
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash2 aria-hidden />} onClick={remove} loading={deleteMutation.isPending} className="text-danger hover:bg-danger/10">
                {t('categoryForm.delete')}
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('categoryForm.cancel')}
          </Button>
          <Button onClick={save} loading={saving}>
            {t('categoryForm.save')}
          </Button>
        </>
      }
    >
      <div data-f="F-08-011 F-08-012 F-08-014 F-08-147" className="flex flex-col gap-4">
        <FormField label={t('categoryForm.name')} required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('categoryForm.namePlaceholder')} autoFocus />
        </FormField>
        <FormField label={t('categoryForm.parent')}>
          <Select options={parentOptions} value={parentId} onValueChange={setParentId} />
        </FormField>
        <FormField label={t('categoryForm.sku')}>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} />
        </FormField>
        <FormField label={t('categoryForm.comment')}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Modal>
  );
}

'use client';

/** Создание (F-07-008) и правка статьи (F-07-009) — системные статьи переименовываются, но не удаляются. */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createItem, removeItem, updateItem } from '@/api/finance';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { FinanceItem, FinanceItemGroup, FinanceItemKind } from '@/domain/finance';
import { FINANCE_ITEM_GROUPS, financeItemGroup } from '@/domain/finance';
import { Select } from '@/ui/Select';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export interface ItemFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: FinanceItem;
}

export function ItemFormModal({ open, onOpenChange, initial }: ItemFormModalProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId } = useCurrent();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<FinanceItemKind>(initial?.kind ?? 'expense');
  const [comment, setComment] = useState(initial?.comment ?? '');
  // Ф26: строка отчёта о прибылях и убытках; при смене вида — группа по умолчанию для него
  const [groupPick, setGroupPick] = useState<FinanceItemGroup | null>(initial ? financeItemGroup(initial) : null);
  const group = groupPick && FINANCE_ITEM_GROUPS[kind].includes(groupPick) ? groupPick : financeItemGroup({ kind });
  const [touched, setTouched] = useState(false);

  const createMutation = useApiMutation((input: { name: string; kind: FinanceItemKind; comment?: string; group: FinanceItemGroup }) => createItem(businessId!, input));
  // Без initial!.id — React Compiler выносит поле в рендер и падает, пока initial === undefined (§18.5)
  const updateMutation = useApiMutation((input: { name: string; comment?: string; group: FinanceItemGroup }) => updateItem(businessId!, initial?.id ?? '', input));
  const removeMutation = useApiMutation(() => removeItem(businessId!, initial?.id ?? ''));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const nameError = touched && !name.trim() ? t('itemForm.nameRequired') : undefined;

  const save = async () => {
    setTouched(true);
    if (!name.trim()) return;
    try {
      if (isEdit) {
        await updateMutation.mutate({ name: name.trim(), comment: comment.trim() || undefined, group });
        toast.success(t('itemForm.saved'));
      } else {
        await createMutation.mutate({ name: name.trim(), kind, comment: comment.trim() || undefined, group });
        toast.success(t('itemForm.created'));
        setName('');
        setComment('');
        setTouched(false);
      }
      onOpenChange(false);
    } catch {
      toast.error(t('itemForm.saveFailed'));
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('itemForm.deleteTitle'),
      description: t('itemForm.deleteText'),
      tone: 'danger',
      confirmLabel: tc('actions.delete'),
    });
    if (!ok) return;
    try {
      await removeMutation.mutate(undefined);
      toast.success(t('itemForm.deleted'));
      onOpenChange(false);
    } catch {
      toast.error(t('itemForm.deleteFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('itemForm.editTitle') : t('itemForm.title')}
      footer={
        <>
          {isEdit && !initial?.system && (
            <Button
              variant="ghost"
              leftIcon={<Trash2 aria-hidden />}
              onClick={remove}
              loading={removeMutation.isPending}
              className="mr-auto text-danger hover:bg-danger-soft"
            >
              {tc('actions.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={save} loading={isSaving}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <div data-f="F-07-008 F-07-009 F-08-121" className="flex flex-col gap-5">
        <FormField label={t('itemForm.name')} required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('itemForm.namePlaceholder')} />
        </FormField>

        {!isEdit && (
          <FormField label={t('itemForm.kind')}>
            <SegmentedControl
              value={kind}
              onValueChange={(v) => setKind(v as FinanceItemKind)}
              fullWidth
              options={[
                { value: 'income', label: t('items.incomeGroup') },
                { value: 'expense', label: t('items.expenseGroup') },
              ]}
            />
          </FormField>
        )}

        <FormField label={t('itemForm.group')} hint={t('itemForm.groupHint')}>
          <Select
            value={group}
            onValueChange={(v) => setGroupPick(v as FinanceItemGroup)}
            options={FINANCE_ITEM_GROUPS[kind].map((g) => ({ value: g, label: t(`items.group.${g}`) }))}
          />
        </FormField>

        <FormField label={t('itemForm.comment')}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Modal>
  );
}

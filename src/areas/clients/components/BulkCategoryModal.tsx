'use client';

/** Массово «Добавить в категорию» (F-04-041). Раздел «clients». */
import { useState } from 'react';
import { bulkAddCategory } from '@/api/clients';
import { useApiMutation } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ColorPicker } from '@/ui/ColorPicker';
import { Combobox } from '@/ui/Combobox';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

export interface BulkCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientIds: string[];
  categoryOptions: string[];
  onApplied: () => void;
}

export function BulkCategoryModal({ open, onOpenChange, clientIds, categoryOptions, onApplied }: BulkCategoryModalProps) {
  const t = useT('clients');
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [color, setColor] = useState<number | undefined>(undefined);
  const apply = useApiMutation((args: { clientIds: string[]; category: string; color?: string }) => bulkAddCategory(args.clientIds, args.category, args.color));

  const submit = async () => {
    if (!category.trim()) return;
    try {
      await apply.mutate({ clientIds, category, color: isNew && color ? String(color) : undefined });
      toast.success(t('bulk.category.applied', { count: clientIds.length }));
      onOpenChange(false);
      setCategory('');
      setIsNew(false);
      setColor(undefined);
      onApplied();
    } catch {
      toast.error(t('bulk.category.applyFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('bulk.category.title')}
      description={t('bulk.category.audience', { count: clientIds.length })}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('addClientForm.cancel')}
          </Button>
          <Button loading={apply.isPending} disabled={!category.trim()} onClick={submit}>
            {t('bulk.category.apply')}
          </Button>
        </>
      }
    >
      <div data-f="F-04-041 F-15-128" className="flex flex-col gap-3">
        <Combobox
          options={categoryOptions.map((c) => ({ value: c, label: c }))}
          value={category || null}
          onValueChange={(v) => {
            setCategory(v ?? '');
            setIsNew(false);
          }}
          allowCreate
          onCreate={(text) => {
            setCategory(text);
            setIsNew(true);
          }}
          placeholder={t('bulk.category.placeholder')}
          emptyText={t('bulk.category.empty')}
        />
        {isNew && <ColorPicker value={color} onValueChange={setColor} label={t('bulk.category.color')} />}
      </div>
    </Modal>
  );
}

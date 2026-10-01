'use client';

/** Массово «Удалить из базы» (F-04-042): необратимо — просим ввести слово подтверждения. Раздел «clients». */
import { useState } from 'react';
import { BULK_DELETE_WORD, bulkDeleteClients } from '@/api/clients';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

export interface BulkDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  clientIds: string[];
  onDeleted: () => void;
}

export function BulkDeleteModal({ open, onOpenChange, businessId, clientIds, onDeleted }: BulkDeleteModalProps) {
  const t = useT('clients');
  const toast = useToast();
  const { staffId } = useCurrent();
  const [word, setWord] = useState('');
  const remove = useApiMutation((args: { businessId: string; clientIds: string[] }) =>
    bulkDeleteClients(args.businessId, args.clientIds, staffId ?? undefined, t('card.you')),
  );

  const canDelete = word.trim() === BULK_DELETE_WORD;

  const submit = async () => {
    if (!canDelete) return;
    try {
      await remove.mutate({ businessId, clientIds });
      toast.success(t('bulk.delete.deleted', { count: clientIds.length }));
      onOpenChange(false);
      setWord('');
      onDeleted();
    } catch {
      toast.error(t('bulk.delete.deleteFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('bulk.delete.title')}
      description={t('bulk.delete.audience', { count: clientIds.length })}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('addClientForm.cancel')}
          </Button>
          <Button variant="danger" loading={remove.isPending} disabled={!canDelete} onClick={submit}>
            {t('bulk.delete.confirmButton')}
          </Button>
        </>
      }
    >
      <div data-f="F-04-042" className="flex flex-col gap-3">
        <p className="text-sm text-fg">{t('bulk.delete.warning')}</p>
        <p className="text-sm text-muted">{t('bulk.delete.typeWord', { word: BULK_DELETE_WORD })}</p>
        <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder={BULK_DELETE_WORD} />
      </div>
    </Modal>
  );
}

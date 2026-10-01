'use client';

/**
 * F-04-135/136/137: объединение дублей — переносит визиты дубля на выбранную карточку и удаляет
 * дубль. Карта лояльности/абонемент/счёт дубля НЕ переносятся — предупреждение показано перед подтверждением.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { listClientRows, mergeClients } from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { ClientRow } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { Combobox } from '@/ui/Combobox';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

export function MergeClientsModal({
  open,
  onOpenChange,
  businessId,
  current,
  authorName,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  current: ClientRow;
  /** Имя того, кто объединяет, — в журнал изменений (не «Вы», его читают другие) */
  authorName: string;
  onMerged: () => void;
}) {
  const t = useT('clients');
  const toast = useToast();
  const { phone } = useFormat();
  const { staffId } = useCurrent();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listQ = useApiQuery(['clients', 'merge-candidates', businessId], () => listClientRows(businessId), { enabled: open });
  const merge = useApiMutation((args: { keepId: Id; duplicateId: Id }) =>
    mergeClients(businessId, args.keepId, args.duplicateId, staffId ?? undefined, authorName),
  );

  const candidates = (listQ.data ?? []).filter((r) => r.id !== current.id);
  const target = candidates.find((r) => r.id === targetId) ?? null;

  const doMerge = async () => {
    if (!targetId) return;
    try {
      // Оставляем карточку с бОльшим количеством визитов — по инструкции F-04-135 остаётся та,
      // где уже карта/абонемент/счёт; у нас это приближение — больше визитов, вероятнее, основная.
      const keepId = target && target.visits >= current.visits ? target.id : current.id;
      const duplicateId = keepId === current.id ? targetId : current.id;
      await merge.mutate({ keepId, duplicateId });
      toast.success(t('card.merge.done'));
      setConfirmOpen(false);
      onOpenChange(false);
      onMerged();
    } catch {
      toast.error(t('card.merge.failed'));
    }
  };

  return (
    <>
      <Modal
        open={open && !confirmOpen}
        onOpenChange={onOpenChange}
        title={t('card.merge.title')}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('card.merge.cancel')}
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!targetId}>
              {t('card.merge.continue')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('card.merge.description', { name: current.name })}</p>
          <Combobox
            options={candidates.map((r) => ({
              value: r.id,
              label: r.name,
              description: phone(r.phone),
            }))}
            value={targetId}
            onValueChange={setTargetId}
            placeholder={t('card.merge.pickClient')}
            loading={listQ.isLoading}
            emptyText={t('card.merge.noCandidates')}
          />
          <div data-f="F-06-181" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-xs text-fg">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>{t('card.merge.notTransferredWarning')}</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title={t('card.merge.confirmTitle')}
        description={t('card.merge.confirmDescription')}
        confirmLabel={t('card.merge.confirmButton')}
        onConfirm={doMerge}
      />
    </>
  );
}

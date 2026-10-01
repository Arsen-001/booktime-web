'use client';

/**
 * Отклонить выбранные разом: одна причина и комментарий на всех, сколько монет вернётся — заранее. Причина обязательна
 * (бизнес видит её в уведомлении); ошибка — под полем, окно не закрывается.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { RejectReasonPicker } from '@/areas/platform/moderation/RejectReasonPicker';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

interface BulkRejectSheetProps {
  open: boolean;
  count: number;
  /** Сумма монет за платные среди выбранных — вернутся бизнесам */
  paidCoins: number;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reasonId: Id, note?: string) => void;
}

export function BulkRejectSheet({ open, count, paidCoins, pending, onOpenChange, onConfirm }: BulkRejectSheetProps) {
  const t = useT('platform');
  const [reasonId, setReasonId] = useState<Id>('');
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);

  const close = (o: boolean) => {
    if (!o) {
      setReasonId('');
      setNote('');
      setShowError(false);
    }
    onOpenChange(o);
  };
  const confirm = () => {
    if (!reasonId) return setShowError(true);
    onConfirm(reasonId, note.trim() || undefined);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title={t('moderation.bulkRejectTitle', { n: count })}
      description={t('moderation.bulkRejectHint')}
      size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => close(false)}>
            {t('moderation.cancelReject')}
          </Button>
          <Button variant="danger" className="flex-[2]" leftIcon={<X aria-hidden />} onClick={confirm} loading={pending}>
            {t('moderation.bulkRejectConfirm', { n: count })}
          </Button>
        </div>
      }
    >
      <div data-f="F-00-170">
        <RejectReasonPicker
          reasonId={reasonId}
          note={note}
          paidCoins={paidCoins > 0 ? paidCoins : undefined}
          showError={showError}
          onReasonChange={(id) => {
            setReasonId(id);
            setShowError(false);
          }}
          onNoteChange={setNote}
        />
      </div>
    </Sheet>
  );
}

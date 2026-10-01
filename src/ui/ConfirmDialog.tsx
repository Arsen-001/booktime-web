'use client';

import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

export type ConfirmTone = 'danger' | 'primary';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: ConfirmTone;
  /** Если вернёт промис — кнопка крутит лоадер, окно закроется после успеха */
  onConfirm: () => void | Promise<void>;
  /** Уход окна закончился — см. Modal.onExitComplete */
  onExitComplete?: () => void;
}

const CONFIRM_VARIANT: Record<ConfirmTone, 'primary' | 'danger'> = {
  primary: 'primary',
  danger: 'danger',
};

/** Подтверждение действия. Для «вызвал и дождался ответа» есть useConfirm() из '@/ui/Toast'. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  onExitComplete,
}: ConfirmDialogProps) {
  const t = useT('ui');
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onExitComplete={onExitComplete}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={title ?? t('confirmDialog.title')}
      description={description}
      size="sm"
      hideClose
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel ?? t('confirmDialog.cancel')}
          </Button>
          <Button data-autofocus variant={CONFIRM_VARIANT[tone]} onClick={handleConfirm} loading={pending}>
            {confirmLabel ?? t('confirmDialog.confirm')}
          </Button>
        </>
      }
    />
  );
}

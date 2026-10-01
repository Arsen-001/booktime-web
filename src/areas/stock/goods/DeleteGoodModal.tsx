'use client';

/**
 * F-08-030 / F-08-144: удаление товара необратимо (теряются все операции) — кнопка активна только
 * после ввода слова «Удалить», как в Altegio (в отличие от обратимых действий — там наша отмена на 5с, F-00-061).
 */
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';

const CONFIRM_WORD = 'Удалить';

export function DeleteGoodModal({
  open,
  onOpenChange,
  goodName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goodName: string;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useT('stock');
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const ready = value.trim() === CONFIRM_WORD;

  const confirm = async () => {
    if (!ready) return;
    setPending(true);
    try {
      await onConfirm();
      setValue('');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setValue('');
      }}
      title={t('goodForm.deleteConfirmTitle')}
      description={t('goodForm.deleteConfirmText', { name: goodName || t('goodForm.thisGood') })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('goodForm.cancel')}
          </Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>
            {t('goodForm.delete')}
          </Button>
        </>
      }
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={CONFIRM_WORD} aria-label={t('goodForm.deleteTypeWord', { word: CONFIRM_WORD })} autoFocus />
      <p className="mt-2 text-xs text-muted">{t('goodForm.deleteTypeWord', { word: CONFIRM_WORD })}</p>
    </Modal>
  );
}

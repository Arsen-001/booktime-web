'use client';

/**
 * «Заблокировать человека?» — подтверждение с последствиями и обязательной причиной (в журнал аудита).
 * ConfirmDialog поле не принимает, поэтому — Modal той же формы: «Отмена» и опасная кнопка, лоадер на время запроса.
 */
import { useState } from 'react';
import { setPlatformUserBlocked } from '@/api/platform/users';
import { ApiError, useApiMutation } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const REASON_MIN = 3;

export function BlockUserDialog({ userId, name, open, onOpenChange }: { userId: string; name: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const block = useApiMutation((a: { id: string; reason: string }) => setPlatformUserBlocked(a.id, true, a.reason));
  const invalid = reason.trim().length < REASON_MIN;

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    try {
      const res = await block.mutate({ id: userId, reason: reason.trim() });
      toast.success(res.revokedSessions > 0 ? t('users.block.doneSessions', { name, n: res.revokedSessions }) : t('users.block.done', { name }));
      onOpenChange(false);
      setReason('');
      setTouched(false);
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'forbidden' ? t('users.forbidden') : t('users.actionFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !block.isPending && onOpenChange(o)}
      title={t('users.block.title', { name })}
      description={t('users.block.text')}
      size="sm"
      hideClose
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={block.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={block.isPending}>
            {t('users.block.confirm')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label={t('users.block.reason')} hint={t('users.block.reasonHint')} error={touched && invalid ? t('users.block.reasonRequired') : undefined} required>
          <Textarea data-autofocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={t('users.block.reasonPlaceholder')} rows={3} />
        </FormField>
      </form>
    </Modal>
  );
}

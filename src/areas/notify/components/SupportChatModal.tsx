'use client';

/**
 * «Чат с поддержкой» (F-05-132): вместо виджета Intercom — наша модалка, пишет обращение в общую очередь
 * поддержки (F-00-182, `createSupportTicket`), как уже делает `LoyaltyHubScreen` для «Помогите настроить».
 */
import { useState } from 'react';
import { useCoreGet } from '@/api/core';
import { createSupportTicket } from '@/api/platform/support';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export interface SupportChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportChatModal({ open, onOpenChange }: SupportChatModalProps) {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  // Обращение из кабинета подписываем названием салона и каналом «Кабинет бизнеса» — так его узнают в /platform/support
  const businessQ = useCoreGet('businesses', businessId, { enabled: ready && !!businessId });
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const create = useApiMutation(createSupportTicket);

  const submit = async () => {
    if (!text.trim()) return;
    try {
      await create.mutate({
        from: 'business',
        businessId,
        name: businessQ.data?.brandName || businessQ.data?.name || t('inbox.supportChat'),
        channel: 'cabinet',
        section: 'settings',
        topic: 'help',
        text: text.trim(),
      });
      setSent(true);
      setText('');
      toast.success(t('inbox.supportSent'));
    } catch {
      toast.error(t('inbox.supportFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSent(false);
      }}
      title={t('inbox.supportChat')}
      description={t('inbox.supportChatHint')}
      footer={
        !sent && (
          <Button onClick={submit} loading={create.isPending} disabled={!text.trim()} fullWidth>
            {t('inbox.supportSend')}
          </Button>
        )
      }
    >
      {sent ? (
        <p className="text-sm text-fg">{t('inbox.supportSentHint')}</p>
      ) : (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('inbox.supportPlaceholder')}
          autoResize
          rows={4}
        />
      )}
    </Modal>
  );
}

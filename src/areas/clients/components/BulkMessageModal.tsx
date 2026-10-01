'use client';

/**
 * Массовая рассылка (F-04-038 «Отправить сообщение», F-04-039/040 «Пуш»). По нашему решению (F-00-114, F-00-120) два вида
 * пуша Altegio слиты в один — пуш в наше приложение клиента. Кому уйдёт, считает api (`bulkAudience`): отказавшиеся от
 * рекламы исключены (F-04-227), число видно до отправки (ux-best-c2 №6).
 */
import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { bulkAudience, bulkSendMessage, bulkSendPush } from '@/api/clients';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Modal } from '@/ui/Modal';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export type BulkMessageChannel = 'sms' | 'push';

export interface BulkMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: BulkMessageChannel;
  businessId: string;
  clientIds: string[];
}

export function BulkMessageModal({ open, onOpenChange, channel, businessId, clientIds }: BulkMessageModalProps) {
  const t = useT('clients');
  const toast = useToast();
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const audienceQ = useApiQuery(['clients', 'audience', clientIds], () => bulkAudience(clientIds), { enabled: open });
  const sendSms = useApiMutation((args: { clientIds: string[]; text: string }) => bulkSendMessage(businessId, args.clientIds, args.text));
  const sendPush = useApiMutation((args: { clientIds: string[]; text: string }) => bulkSendPush(businessId, args.clientIds, args.text));

  const audience = channel === 'sms' ? (audienceQ.data?.sms.length ?? 0) : (audienceQ.data?.push.length ?? 0);
  // F-04-227: без галочки ответственности массовая отправка невозможна — для обоих каналов
  const canSend = text.trim().length > 0 && consent && audience > 0;
  const nameToken = t('bulk.message.nameToken');

  const submit = async () => {
    try {
      const count = channel === 'sms' ? await sendSms.mutate({ clientIds, text }) : await sendPush.mutate({ clientIds, text });
      toast.success(t('bulk.message.sent', { count }));
      onOpenChange(false);
      setText('');
      setConsent(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sms_not_connected') {
        toast.error(t('bulk.message.smsNotConnected'));
      } else if (err instanceof ApiError && err.code === 'weekly_push_limit') {
        toast.error(t('bulk.message.weeklyPushLimit'));
      } else {
        toast.error(t('bulk.message.sendFailed'));
      }
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(`bulk.message.title.${channel}`)}
      description={audienceQ.isLoading ? <Skeleton className="h-4 w-40" /> : t('bulk.message.audience', { count: audience })}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('addClientForm.cancel')}
          </Button>
          <Button loading={sendSms.isPending || sendPush.isPending} disabled={!canSend} onClick={submit}>
            {t('bulk.message.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {channel === 'sms' && <span data-f="F-04-038" hidden />}
        {channel === 'push' && <span data-f="F-04-039 F-04-040 F-14-160 F-14-069" hidden />}
        <span data-f="F-04-227" hidden />
        {/* F-04-043: разрешённые каналы массовой рассылки — по нашему решению пуш (пуш/смс здесь), аудитория уже
            вычищена от отказавшихся от рекламы и от каналов, которых у клиента нет (bulkAudience) */}
        <span data-f="F-04-043" hidden />
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('bulk.message.placeholder')} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<UserRound aria-hidden />}
            onClick={() => setText((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}${nameToken}`)}
          >
            {t('bulk.message.insertName')}
          </Button>
          <p className="text-sm text-muted">{t('bulk.message.variableHint', { token: nameToken })}</p>
        </div>
        <Checkbox checked={consent} onCheckedChange={setConsent} label={t('bulk.message.consent')} />
        {!audienceQ.isLoading && audience === 0 && <p className="text-sm text-danger">{t('bulk.message.noAudience')}</p>}
      </div>
    </Modal>
  );
}

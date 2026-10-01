'use client';

/** Обращение: кто и о чём, переписка, ответ внизу у пальца; «Закрыть обращение» — в меню «⋯». */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { CheckCircle2, MoreHorizontal, RotateCcw, Send } from 'lucide-react';
import { closeSupportTicket, reopenSupportTicket, replySupportTicket } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { SUPPORT_TONE } from '@/areas/platform/lib/tones';
import type { SupportTicketView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { telLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function TicketSheet({ ticket, onClose }: { ticket: SupportTicketView; onClose: () => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const send = useApiMutation((a: { id: string; text: string }) => replySupportTicket(a.id, a.text));
  const close = useApiMutation(closeSupportTicket);
  const reopen = useApiMutation(reopenSupportTicket);
  const closed = ticket.status === 'closed';
  // Недописанный ответ не теряется молча при закрытии шторки
  const onOpenChange = useGuardedClose(Boolean(reply.trim()), onClose);

  const doSend = async () => {
    if (!reply.trim()) return;
    try {
      await send.mutate({ id: ticket.id, text: reply.trim() });
      setReply('');
      toast.success(t('support.sent'));
    } catch {
      toast.error(t('support.sendFailed'));
    }
  };
  const doClose = async () => {
    try {
      await close.mutate(ticket.id);
      toast.success(t('support.closed'), {
        action: { label: t('common.undo'), onClick: () => void reopen.mutate(ticket.id).catch(() => toast.error(t('support.sendFailed'))) },
      });
      onClose();
    } catch {
      toast.error(t('support.sendFailed'));
    }
  };
  const doReopen = async () => {
    try {
      await reopen.mutate(ticket.id);
      toast.success(t('support.reopened'));
    } catch {
      toast.error(t('support.sendFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={`${ticket.name} · ${t(`support.topic.${ticket.topic}`)}`}
      description={t('support.ticketMeta', {
        number: ticket.number,
        channel: t(`support.channel.${ticket.channel}`),
        ago: fmt.ago(ticket.createdAt),
      })}
      size="md"
      headerActions={
        <DropdownMenu
          label={t('support.more')}
          trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('support.more')} size="sm" />}
          items={
            closed
              ? [{ id: 'reopen', label: t('support.reopen'), icon: <RotateCcw aria-hidden />, onSelect: doReopen }]
              : [{ id: 'close', label: t('support.close'), icon: <CheckCircle2 aria-hidden />, onSelect: doClose }]
          }
        />
      }
      footer={
        closed ? (
          <Button fullWidth variant="outline" leftIcon={<RotateCcw aria-hidden />} onClick={doReopen} loading={reopen.isPending}>
            {t('support.reopen')}
          </Button>
        ) : (
          <form
            noValidate
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void doSend();
            }}
          >
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t('support.replyPlaceholder')}
              rows={2}
              className="flex-1"
              aria-label={t('support.reply')}
            />
            <Button type="submit" leftIcon={<Send aria-hidden />} loading={send.isPending} disabled={!reply.trim()}>
              {t('support.send')}
            </Button>
          </form>
        )
      }
    >
      <div data-f="F-00-182 F-14-137" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SUPPORT_TONE[ticket.status]}>{t(`support.status.${ticket.status}`)}</Badge>
          <Badge tone="neutral">{t(`support.from.${ticket.from}`)}</Badge>
          {ticket.section && <Badge tone="neutral">{t(`support.section.${ticket.section}`)}</Badge>}
        </div>
        {(ticket.businessName || ticket.phone) && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
            {ticket.businessName && <span>{ticket.businessName}</span>}
            {ticket.phone && (
              <a href={telLink(ticket.phone)} className="text-primary-text hover:underline">
                {fmt.phone(ticket.phone)}
              </a>
            )}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {ticket.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-base',
                m.author === 'us' ? 'self-end rounded-br-md bg-primary-soft text-fg' : 'self-start rounded-bl-md bg-surface-2 text-fg',
              )}
            >
              <p className="whitespace-pre-line">{m.text}</p>
              <p className="mt-1 text-xs text-muted">{fmt.dateTime(m.at)}</p>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

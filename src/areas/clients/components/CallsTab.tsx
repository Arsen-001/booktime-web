'use client';

/**
 * «Сообщения и звонки» → «История звонков» (F-04-079, F-04-190). Раздел «clients».
 * 🔒 Телефония нигде в проекте не подключена — список демонстрационный, помечен как демо (правило 0.1):
 * при подключённой облачной телефонии сюда попадали бы настоящие звонки и записи разговоров.
 * F-04-190 «Готово, когда»: звонок виден и в отчёте «Звонки», и в карточке клиента с записью разговора — здесь
 * построена карточная половина (запись 🔒 демо, showTitle `hasRecording` → «Play»); отчёт «Отчёты → Звонки» —
 * узел раздела `reports`, не наш (см. qa/requests/clients.md).
 */
import { MessageCircle, MessageSquare, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, Smartphone } from 'lucide-react';
import { listCalls, listClientMessages } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';

export interface CallsTabProps {
  clientId: string;
}

export function CallsTab({ clientId }: CallsTabProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const callsQ = useApiQuery(['clients', 'calls', clientId], () => listCalls(clientId), { enabled: Boolean(clientId) });
  const messagesQ = useApiQuery(['clients', 'messages', clientId], () => listClientMessages(clientId), { enabled: Boolean(clientId) });
  // Постранично, как во всех списках (DESIGN.md → Long lists): сообщения и звонки
  const { pageItems: messagesPage, pager: messagesPager } = usePagedList(messagesQ.data ?? []);
  const { pageItems: callsPage, pager: callsPager } = usePagedList(callsQ.data ?? []);

  if (callsQ.isError) return <ErrorState onRetry={callsQ.refetch} />;
  if (callsQ.isLoading || messagesQ.isLoading) return <Skeleton lines={3} />;

  const calls = callsQ.data ?? [];
  const messages = messagesQ.data ?? [];

  return (
    <div data-f="F-04-078 F-04-079 F-04-100 F-04-190 F-13-096" className="flex flex-col gap-4">
      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">{t('card.calls.messagesTitle')}</p>
          <ul className="flex flex-col gap-2">
            {messagesPage.map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
                <span className="mt-0.5 shrink-0 text-muted [&_svg]:size-4">
                  {m.channel === 'sms' ? <MessageSquare aria-hidden /> : m.channel === 'whatsapp' ? <MessageCircle aria-hidden /> : <Smartphone aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base text-fg">{m.text}</p>
                  <p className="text-sm text-muted">
                    {t(`bulk.message.channel.${m.channel}`)} · {fmt.ago(m.sentAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {messagesPager}
        </div>
      )}
      {calls.length === 0 ? (
        <EmptyState variant="section" framed icon={<Phone aria-hidden />} title={t('card.calls.emptyTitle')} description={t('card.calls.emptyText')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {callsPage.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              {c.direction === 'incoming' && <PhoneIncoming aria-hidden className="size-4 shrink-0 text-success" />}
              {c.direction === 'outgoing' && <PhoneOutgoing aria-hidden className="size-4 shrink-0 text-accent" />}
              {c.direction === 'missed' && <PhoneMissed aria-hidden className="size-4 shrink-0 text-danger" />}
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-fg">{t(`card.calls.direction.${c.direction}`)}</p>
                <p className="text-sm text-muted">
                  {fmt.dateTime(c.at)} {c.direction !== 'missed' && `· ${fmt.duration(Math.round(c.durationSec / 60) || 1)}`}
                </p>
              </div>
              {c.hasRecording && (
                <span className="flex items-center gap-1 text-sm text-muted">
                  <Play aria-hidden className="size-3.5" />
                  {t('card.calls.recording')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {callsPager}
    </div>
  );
}

'use client';

/** «Отправленные сообщения» за период (F-04-038…040): что ушло клиентам массовой рассылкой */
import { MessageCircle, MessageSquare, Send, Smartphone } from 'lucide-react';
import { listMessageLog } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import type { Id, ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function MessageLogCard({ businessId, range }: { businessId: Id; range: { from: ISODate; to: ISODate } }) {
  const t = useT('clients');
  const fmt = useFormat();
  const q = useApiQuery(['clients', 'messageLog', businessId, range.from, range.to], () => listMessageLog(businessId, range));
  const rows = q.data ?? [];
  const skeletonRows = useSkeletonCount('messageLog', { loading: q.isLoading, count: q.data?.length, fallback: 0, max: 20 });
  return (
    <div data-f="F-04-038 F-04-039 F-04-040 F-14-160">
      <SectionCard title={t('summary.messagesTitle')} description={t('summary.messagesHint')}>
        {q.isLoading && skeletonRows === 0 ? (
          // В прошлый раз сообщений не было (в демо — обычно так) — скелетон пустого состояния той же высоты
          <EmptyState
            variant="inline"
            icon={<Send aria-hidden />}
            title={<SkeletonText width="18ch" />}
            description={<SkeletonText width="30ch" />}
          />
        ) : q.isLoading ? (
          // Те же строки сообщений: значок канала, текст, канал · кому · когда
          <ul className="flex flex-col gap-2" aria-busy>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-muted [&_svg]:size-4">
                  <MessageSquare aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-fg">
                    <SkeletonText width={i % 2 ? '24ch' : '32ch'} />
                  </p>
                  <p className="text-sm text-muted">
                    <SkeletonText width="22ch" />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Send aria-hidden />}
            title={t('summary.messagesEmptyTitle')}
            description={t('summary.messagesEmptyText')}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-muted [&_svg]:size-4">
                  {m.channel === 'sms' ? (
                    <MessageSquare aria-hidden />
                  ) : m.channel === 'whatsapp' ? (
                    <MessageCircle aria-hidden />
                  ) : (
                    <Smartphone aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-fg">{m.text}</p>
                  <p className="text-sm text-muted">
                    {t(`bulk.message.channel.${m.channel}`)}
                    {m.source === 'bookingWindow'
                      ? ` · ${t('bulk.message.sourceBookingWindow')}`
                      : ` · ${t('summary.messageAudience', { count: m.audienceCount })}`}
                    {' · '}
                    {fmt.ago(m.sentAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

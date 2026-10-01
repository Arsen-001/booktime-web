'use client';

import { AlertTriangle, Ban } from 'lucide-react';
import { coreGet, coreUpdate } from '@/api/core';
import { getClientCustomFieldAnswers } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { ClientCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/**
 * Вклад раздела «online» в карточку клиента (F-00-071, F-03-073, F-03-135): число неявок, ответы на свои
 * поля («Сохранять в карточку: Карточка клиента») и запрет онлайн-записи.
 * Посмотреть вклад без хозяина хоста: /dev/ext/clientCard/online
 */
export default function OnlineClientCard({ clientId }: ClientCardExtProps) {
  const t = useT('online');
  const toast = useToast();
  const clientQ = useApiQuery(['online-clientcard', clientId], () => coreGet('clients', clientId));
  const answersQ = useApiQuery(['online-clientcard-answers', clientId], () => getClientCustomFieldAnswers(clientId));
  const mutation = useApiMutation((blocked: boolean) => coreUpdate('clients', clientId, { blocked }));

  if (!clientQ.isLoading && (clientQ.isError || !clientQ.data)) return <p className="text-sm text-muted">{t('clientCard.loadFailed')}</p>;

  // До данных — те же строки: подписи настоящие, число неявок полосой, переключатель выключен
  const client = clientQ.data;

  return (
    <div className="flex flex-col gap-4" aria-busy={!client || undefined}>
      <div className="flex items-center justify-between gap-3" data-f="F-00-071">
        <span className="text-sm font-medium text-fg">{t('clientCard.noShowCount')}</span>
        {!client ? (
          <Badge tone="neutral" size="sm" variant="soft">
            <SkeletonText width="6ch" />
          </Badge>
        ) : client.noShowCount > 0 ? (
          <Badge tone="warning" icon={<AlertTriangle aria-hidden />} size="sm">
            {t('clientCard.noShowValue', { count: client.noShowCount })}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm" variant="soft">
            {t('clientCard.noShowNone')}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-3" data-f="F-03-135">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg">
          <Ban aria-hidden className="size-4 text-muted" />
          {t('clientCard.blockOnline')}
        </span>
        <Switch
          checked={Boolean(client?.blocked)}
          data-f="F-00-189"
          disabled={!client || mutation.isPending}
          onCheckedChange={async (checked) => {
            try {
              await mutation.mutate(checked);
              toast.success(checked ? t('clientCard.blocked') : t('clientCard.unblocked'));
              clientQ.refetch();
            } catch {
              toast.error(t('clientCard.updateFailed'));
            }
          }}
        />
      </div>

      {answersQ.data && answersQ.data.length > 0 && (
        <div className="flex flex-col gap-2" data-f="F-03-073">
          <span className="text-sm font-medium text-fg">{t('clientCard.customAnswers')}</span>
          <dl className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3">
            {answersQ.data.map((a) => (
              <div key={a.label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="text-sm text-muted">{a.label}</dt>
                <dd className="text-sm font-medium text-fg">{a.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

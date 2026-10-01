'use client';

/** Строка журнала доставок вебхуков (F-13-062). Ревью 27.09 (И13): у ошибки — причина, число попыток и «Повторить». */
import { RotateCw } from 'lucide-react';
import { retryWebhookDelivery } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { WebhookDelivery } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

export function WebhookDeliveryRow({ delivery: d, businessId, canRetry }: { delivery: WebhookDelivery; businessId: string; canRetry: boolean }) {
  const t = useT('integrations');
  const toast = useToast();
  const { date, time } = useFormat();
  const retry = useApiMutation(() => retryWebhookDelivery(businessId, d.id));

  const onRetry = async () => {
    try {
      const result = await retry.mutate(undefined);
      if (result.status === 'delivered') toast.success(t('api.webhooks.retryOk'));
      else toast.error(t('api.webhooks.retryFailed'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between" data-delivery={d.id}>
      <div className="min-w-0">
        <p className="truncate text-fg">{d.objectLabel}</p>
        <p className="truncate text-muted">
          {t(`api.webhooks.entity.${d.entity}`)} · {t(`api.webhooks.action.${d.action}`)} · {date(d.createdAt)} {time(d.createdAt)}
        </p>
        {d.status === 'failed' && (
          <p className="text-danger">
            {t(`api.webhooks.failReason.${d.failReason ?? 'http5xx'}` as never)}
            {d.attempts ? ` · ${t('api.webhooks.attempts', { count: d.attempts })}` : ''}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={d.status === 'delivered' ? 'success' : 'danger'}>{t(`api.webhooks.status.${d.status}`)}</Badge>
        {d.status === 'failed' && canRetry && (
          <Button size="sm" variant="secondary" leftIcon={<RotateCw aria-hidden />} loading={retry.isPending} onClick={onRetry}>
            {t('api.webhooks.retry')}
          </Button>
        )}
      </div>
    </li>
  );
}

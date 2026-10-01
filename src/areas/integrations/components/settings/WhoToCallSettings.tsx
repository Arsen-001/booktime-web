'use client';

/**
 * F-13-110/F-13-111: вкладка «Кого позвать» у Beauty AI — GPT — до 10 клиентов на завтрашнее свободное окно
 * с готовым текстом сообщения. Бот сам не записывает — текст отправляет администратор (⭐ стыкуется с
 * «пора снова», горящими окнами и листом ожидания — F-00-084/103/119).
 */
import { Copy } from 'lucide-react';
import { listWhoToCallCandidates } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function WhoToCallSettings() {
  const t = useT('integrations');
  const toast = useToast();
  const { date } = useFormat();
  const { locationId, locationIds } = useCurrent();
  const currentLocationId =
    locationId && locationId !== 'all' ? locationId : locationIds[0];

  const q = useApiQuery(
    ['integrations', 'whoToCall', currentLocationId],
    () => listWhoToCallCandidates(currentLocationId!),
    { enabled: Boolean(currentLocationId) },
  );

  const copy = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(t('app.settings.whoToCall.copiedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-110 F-13-111" className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('app.settings.whoToCall.hint')}</p>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton lines={4} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          kind="default"
          compact
          title={t('app.settings.whoToCall.emptyTitle')}
          description={t('app.settings.whoToCall.emptyText')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(q.data ?? []).map((c) => (
            <li key={c.clientId}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg">{c.clientName}</p>
                  <span className="text-xs text-muted">
                    {date(c.slotTime, 'short')} ·{' '}
                    {c.reason === 'usualTime'
                      ? t('app.settings.whoToCall.reasonUsualTime')
                      : t('app.settings.whoToCall.reasonDueForService')}
                  </span>
                </div>
                <p className="text-sm text-muted">{c.message}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Copy className="h-4 w-4" aria-hidden />}
                  className="self-start"
                  onClick={() => copy(c.message)}
                >
                  {t('app.settings.whoToCall.copyCta')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

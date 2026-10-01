'use client';

/**
 * /biz/notifications/channels/developer — «Для разработчиков»: вебхуки внешним системам (F-05-120),
 * флаги уведомлений при записи через внешнего агента (F-05-121), сводки и оповещения бизнесу от
 * приложений партнёров в Telegram/на почту (F-05-126).
 */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  createWebhook,
  deleteWebhook,
  getAgentNotifyFlags,
  getPartnerSummarySettings,
  listWebhooks,
  setWebhookActive,
  simulateAgentBooking,
  updateAgentNotifyFlags,
  updatePartnerSummarySettings,
} from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { WebhookEntity } from '@/domain/notify';
import { WEBHOOK_ENTITIES } from '@/domain/notify';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

function WebhooksCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [url, setUrl] = useState('');
  const [entities, setEntities] = useState<Set<WebhookEntity>>(new Set(['bookings']));
  const [error, setError] = useState<string | undefined>();

  const q = useApiQuery(['notify', 'webhooks', businessId], () => listWebhooks(businessId!), { enabled: ready && !!businessId });
  const create = useApiMutation(createWebhook);
  const setActive = useApiMutation(setWebhookActive);
  const remove = useApiMutation(deleteWebhook);

  if (!ready || q.isLoading) return <Skeleton lines={5} />;
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const rows = q.data ?? [];

  const toggleEntity = (e: WebhookEntity) => {
    setEntities((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  };

  const submit = async () => {
    if (!/^https?:\/\/.+/i.test(url.trim())) {
      setError(t('developer.webhookUrlInvalid'));
      return;
    }
    if (entities.size === 0) {
      setError(t('developer.webhookEntitiesRequired'));
      return;
    }
    setError(undefined);
    try {
      await create.mutate({ businessId: businessId!, url: url.trim(), entities: Array.from(entities) });
      setUrl('');
      toast.success(t('developer.webhookAdded'));
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div data-f="F-05-120">
      <SectionCard title={t('developer.webhooksTitle')} description={t('developer.webhooksHint')}>
        <div className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <EmptyState compact title={t('developer.webhooksEmptyTitle')} description={t('developer.webhooksEmptyText')} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((w) => (
                <li key={w.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{w.url}</p>
                    <p className="text-xs text-muted">{w.entities.map((e) => t(`developer.entity.${e}`)).join(', ')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={w.active}
                      onCheckedChange={(active) => setActive.mutate({ businessId: businessId!, webhookId: w.id, active })}
                      aria-label={t('developer.webhookToggleAria')}
                    />
                    <IconButton
                      icon={<Trash2 aria-hidden className="size-4" />}
                      variant="ghost"
                      size="sm"
                      label={t('developer.webhookDeleteAria')}
                      onClick={() => remove.mutate({ businessId: businessId!, webhookId: w.id })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex flex-col gap-3 border-t border-border pt-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <FormField label={t('developer.webhookUrl')} error={error}>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hook" />
            </FormField>
            <div className="flex flex-wrap gap-3">
              {WEBHOOK_ENTITIES.map((e) => (
                <Checkbox key={e} checked={entities.has(e)} onCheckedChange={() => toggleEntity(e)} label={t(`developer.entity.${e}`)} />
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={create.isPending}>
                {t('developer.webhookAdd')}
              </Button>
            </div>
          </form>
        </div>
      </SectionCard>
    </div>
  );
}

function AgentFlagsCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['notify', 'agentFlags', businessId], () => getAgentNotifyFlags(businessId!), { enabled: ready && !!businessId });
  const save = useApiMutation(updateAgentNotifyFlags);
  const simulate = useApiMutation(simulateAgentBooking);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  if (!ready || q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={q.refetch} />;

  const flags = q.data;
  const patch = async (next: typeof flags) => {
    try {
      await save.mutate({ businessId: businessId!, flags: next });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const runSimulation = async () => {
    try {
      const res = await simulate.mutate({ businessId: businessId!, clientPhone: '+374 00 100 000', sendToClient: true });
      setLastResult(res.sent);
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div data-f="F-05-121">
      <SectionCard title={t('developer.agentFlagsTitle')} description={t('developer.agentFlagsHint')}>
        <div className="flex flex-col gap-3">
          <Checkbox checked={flags.sendToClient} onCheckedChange={(sendToClient) => patch({ ...flags, sendToClient })} label={t('developer.agentFlagClient')} />
          <Checkbox checked={flags.sendToAdmin} onCheckedChange={(sendToAdmin) => patch({ ...flags, sendToAdmin })} label={t('developer.agentFlagAdmin')} />
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={runSimulation} loading={simulate.isPending}>
              {t('developer.simulateAgentBooking')}
            </Button>
            {lastResult !== null && (
              <Badge tone={lastResult ? 'success' : 'neutral'} size="sm">
                {lastResult ? t('developer.simulateSent') : t('developer.simulateNotSent')}
              </Badge>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function PartnerSummaryCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['notify', 'partnerSummary', businessId], () => getPartnerSummarySettings(businessId!), { enabled: ready && !!businessId });
  const save = useApiMutation(updatePartnerSummarySettings);

  if (!ready || q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={q.refetch} />;

  const s = q.data;
  const patch = async (next: typeof s) => {
    try {
      await save.mutate({ businessId: businessId!, settings: next });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div data-f="F-05-126">
      <SectionCard title={t('developer.summaryTitle')} description={t('developer.summaryHint')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Checkbox checked={s.telegramEnabled} onCheckedChange={(telegramEnabled) => patch({ ...s, telegramEnabled })} label={t('developer.summaryTelegram')} />
            {s.telegramEnabled && (
              <Input value={s.telegramChatLabel} onChange={(e) => patch({ ...s, telegramChatLabel: e.target.value })} placeholder="@my_salon_chat" className="ml-7 max-w-xs" />
            )}
          </div>
          <Checkbox checked={s.emailEnabled} onCheckedChange={(emailEnabled) => patch({ ...s, emailEnabled })} label={t('developer.summaryEmail')} />
          <Checkbox checked={s.connectionWatchdog} onCheckedChange={(connectionWatchdog) => patch({ ...s, connectionWatchdog })} label={t('developer.summaryWatchdog')} />
        </div>
      </SectionCard>
    </div>
  );
}

export function DeveloperScreen() {
  const t = useT('notify');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('developer.title')} description={t('developer.subtitle')} />
      <WebhooksCard />
      <AgentFlagsCard />
      <PartnerSummaryCard />
    </div>
  );
}

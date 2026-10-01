'use client';

/**
 * F-13-062: страница «Для разработчиков» (WebHook) — включатель, адреса, сущности.
 * F-13-063: 16 сущностей. F-13-064: формат события — пример тела. F-13-065/ревью 27.09 (И13): адрес добавляется
 * здесь же с проверочным запросом и секретом подписи; адрес для приложения каталога — в непубличном приложении (F-13-066). F-13-068: вебхуки партнёров
 * маркетплейса. F-13-069: обратные вызовы платёжных систем. F-13-070: предупреждение перед импортом Excel.
 */
import { AlertTriangle } from 'lucide-react';
import { getWebhookConfig, listWebhookDeliveries, setWebhookEntities, setWebhooksEnabled } from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import { WebhookAddressesCard } from '@/areas/integrations/api/tabs/WebhookAddressesCard';
import { WebhookDeliveryRow } from '@/areas/integrations/api/tabs/WebhookDeliveryRow';
import { useCurrent } from '@/demo/hooks';
import { WEBHOOK_ENTITIES, type WebhookEntity } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const EVENT_EXAMPLE = `{
  "company_id": 12345,
  "resource": "record",
  "resource_id": 987654,
  "status": "update",
  "data": { "id": 987654, "datetime": "2026-09-25T14:00:00+04:00" }
}`;

export function WebhooksTab() {
  const t = useT('integrations');
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const cfgQ = useApiQuery(['integrations', 'webhookConfig', businessId], () => getWebhookConfig(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const deliveriesQ = useApiQuery(['integrations', 'webhookDeliveries', businessId], () => listWebhookDeliveries(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const toggleEnabled = useApiMutation((enabled: boolean) => setWebhooksEnabled(businessId!, enabled));
  const setEntities = useApiMutation((entities: WebhookEntity[]) => setWebhookEntities(businessId!, entities));
  // Постранично, как во всех списках (DESIGN.md → Long lists): журнал доставок
  const { pageItems: deliveriesPage, pager: deliveriesPager } = usePagedList(deliveriesQ.data ?? []);

  const cfg = cfgQ.data;

  const onToggle = async (enabled: boolean) => {
    try {
      await toggleEnabled.mutate(enabled);
      cfgQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onToggleEntity = async (entity: WebhookEntity) => {
    if (!cfg) return;
    const next = cfg.entities.includes(entity) ? cfg.entities.filter((e) => e !== entity) : [...cfg.entities, entity];
    try {
      await setEntities.mutate(next);
      cfgQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  // QA 30.09: ошибка загрузки — ErrorState, а не пустая вкладка
  if (cfgQ.isError) return <ErrorState onRetry={() => cfgQ.refetch()} />;
  if (!ready || cfgQ.isLoading) return <Skeleton lines={8} />;
  if (!cfg) return null;

  return (
    <div data-f="F-13-062 F-13-063 F-13-064 F-13-068 F-13-069 F-13-070 F-08-138 F-07-174" className="flex flex-col gap-4">
      <SectionCard title={t('api.webhooks.enableTitle')}>
        <Switch checked={cfg.enabled} onCheckedChange={onToggle} label={cfg.enabled ? t('api.webhooks.enabled') : t('api.webhooks.disabled')} />
      </SectionCard>

      <WebhookAddressesCard businessId={businessId!} cfg={cfg} canEdit />

      <SectionCard title={t('api.webhooks.entitiesTitle')} description={t('api.webhooks.entitiesHint')}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" data-f="F-10-158">
          {WEBHOOK_ENTITIES.map((entity) => (
            <Checkbox
              key={entity}
              checked={cfg.entities.includes(entity)}
              onCheckedChange={() => onToggleEntity(entity)}
              label={t(`api.webhooks.entity.${entity}`)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t('api.webhooks.formatTitle')} description={t('api.webhooks.formatHint')}>
        <pre className="overflow-x-auto rounded-lg bg-surface-3 p-3 font-mono text-xs text-fg">{EVENT_EXAMPLE}</pre>
      </SectionCard>

      <SectionCard title={t('api.webhooks.logTitle')}>
        {!deliveriesQ.data?.length ? (
          <EmptyState compact title={t('api.webhooks.logEmpty')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {deliveriesPage.map((d) => (
              <WebhookDeliveryRow key={d.id} delivery={d} businessId={businessId!} canRetry />
            ))}
          </ul>
        )}
        {deliveriesPager}
      </SectionCard>

      <SectionCard title={t('api.webhooks.partnersTitle')} description={t('api.webhooks.partnersHint')} />

      <SectionCard title={t('api.webhooks.paymentsTitle')} description={t('api.webhooks.paymentsHint')} />

      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-fg">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        {t('api.webhooks.excelImportWarning')}
      </div>
    </div>
  );
}

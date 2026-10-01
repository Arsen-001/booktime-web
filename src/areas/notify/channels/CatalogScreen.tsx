'use client';

/**
 * /biz/notifications/channels/catalog — «Каталог каналов»: SMS-агрегаторы (F-05-069), маркетплейс
 * «Уведомления» с фильтром по каналу/возможностям/типу и карточкой приложения (F-05-070), мессенджер-боты
 * партнёров (F-05-075), требования к SMS-агрегатору (F-05-119), официальный API против QR (F-05-074),
 * подключение сразу к нескольким локациям (F-05-122), статус подписки и автоотключение/возврат (F-05-123),
 * служебный пользователь интеграции не входит в лицензию (F-05-117), партнёр меняет статус записи через
 * API (F-05-076, демо-кнопка на карточке подключённого бота).
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Info, Star } from 'lucide-react';
import {
  connectPartnerApp,
  disconnectPartnerApp,
  expirePartnerApp,
  listPartnerApps,
  listPartnerConnections,
  reactivatePartnerApp,
  simulatePartnerConfirmBooking,
} from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { PartnerApp, PartnerCapability, PartnerChannelKind, PartnerSubscriptionStatus } from '@/domain/notify';
import { PARTNER_CAPABILITIES, PARTNER_CHANNEL_KINDS } from '@/domain/notify';
import type { Locale } from '@/i18n/config';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

const CHANNEL_ICON_KEYS = PARTNER_CHANNEL_KINDS;
const CAPABILITY_KEYS = PARTNER_CAPABILITIES;

function AppDetailModal({
  app,
  connected,
  status,
  trialEndsAt,
  systemUserLabel,
  businessIds,
  onClose,
}: {
  app: PartnerApp;
  connected: boolean;
  status?: PartnerSubscriptionStatus;
  trialEndsAt?: string;
  systemUserLabel?: string;
  businessIds: string[];
  onClose: () => void;
}) {
  const t = useT('notify');
  const toast = useToast();
  const locale = useLocale() as Locale;
  const format = useFormat();
  const { businessId } = useCurrent();
  const [selected, setSelected] = useState<Set<string>>(new Set(businessId ? [businessId] : []));
  const connect = useApiMutation(connectPartnerApp);
  const disconnect = useApiMutation(disconnectPartnerApp);
  const reactivate = useApiMutation(reactivatePartnerApp);
  const expire = useApiMutation(expirePartnerApp);

  const toggleLocation = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitConnect = async () => {
    if (selected.size === 0) return;
    try {
      await connect.mutate({ appId: app.id, businessIds: Array.from(selected) });
      toast.success(t('catalog.connected'));
      onClose();
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const doDisconnect = async () => {
    if (!businessId) return;
    try {
      await disconnect.mutate({ businessId, appId: app.id });
      toast.success(t('catalog.disconnected'));
      onClose();
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <Modal open onOpenChange={onClose} title={app.name} size="lg">
      <div data-f="F-05-070 F-05-069 F-05-075" className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" size="sm">
            {t(app.type === 'smsAggregator' ? 'catalog.typeSmsAggregator' : 'catalog.typeChatBot')}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Star aria-hidden className="size-3.5 fill-current text-warning" />
            {app.rating.toFixed(1)}
          </span>
          <span className="text-xs text-muted">{t('catalog.installs', { n: app.installs })}</span>
          <span className="text-xs text-muted">{app.developer}</span>
        </div>
        <p className="text-fg">{app.description[locale] ?? app.description.ru}</p>
        <div className="flex flex-wrap gap-1.5">
          {app.channels.map((ch) => (
            <Chip key={ch}>
              {t(`catalog.channelKind.${ch}`)}
            </Chip>
          ))}
        </div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{t('catalog.price')}</dt>
            <dd className="font-medium text-fg">{app.priceNote[locale] ?? app.priceNote.ru}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t('catalog.trial')}</dt>
            <dd className="font-medium text-fg">{app.freeTrialDays ? t('catalog.trialDays', { n: app.freeTrialDays }) : t('catalog.noTrial')}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">{t('catalog.countries')}</dt>
            <dd className="text-fg">{app.countries[locale] ?? app.countries.ru}</dd>
          </div>
        </dl>

        {/* F-05-119: требования к SMS-агрегатору для подключения */}
        {app.requirements && (
          <div data-f="F-05-119" className="flex gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>{app.requirements[locale] ?? app.requirements.ru}</p>
          </div>
        )}

        {/* F-05-074: официальный API против подключения по QR */}
        {app.connectionKind && (
          <div data-f="F-05-074" className="flex gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>{t(app.connectionKind === 'officialApi' ? 'catalog.connectionOfficial' : 'catalog.connectionQr')}</p>
          </div>
        )}

        {connected ? (
          <SectionCard title={t('catalog.subscriptionTitle')} padding="sm">
            <div data-f="F-05-123 F-05-117" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={status === 'active' ? 'success' : status === 'trial' ? 'warning' : 'danger'} size="sm">
                  {t(`catalog.status.${status ?? 'trial'}`)}
                </Badge>
                {trialEndsAt && status === 'trial' && <span className="text-xs text-muted">{t('catalog.trialEnds', { date: format.date(trialEndsAt, 'long') })}</span>}
              </div>
              <p className="text-xs text-muted">{t('catalog.systemUser', { name: systemUserLabel ?? '' })}</p>
              <div className="flex flex-wrap justify-end gap-2">
                {status !== 'autoDisconnected' && (
                  <Button variant="outline" size="sm" onClick={() => expire.mutate({ businessId: businessId!, appId: app.id })} loading={expire.isPending}>
                    {t('catalog.simulateExpire')}
                  </Button>
                )}
                {status === 'autoDisconnected' && (
                  <Button variant="outline" size="sm" onClick={() => reactivate.mutate({ businessId: businessId!, appId: app.id })} loading={reactivate.isPending}>
                    {t('catalog.simulateReactivate')}
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={doDisconnect} loading={disconnect.isPending}>
                  {t('channelsTab.disconnect')}
                </Button>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {/* F-05-076: партнёр меняет статус записи через API — сам Altegio такой логики не имеет */}
        {connected && app.type === 'chatBot' && (
          <SectionCard title={t('catalog.partnerActionsTitle')} padding="sm">
            <div data-f="F-05-076" className="flex flex-col gap-2">
              <p className="text-xs text-muted">{t('catalog.partnerActionsHint')}</p>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const res = await simulatePartnerConfirmBooking(businessId!);
                    toast[res.confirmed ? 'success' : 'info'](t(res.confirmed ? 'catalog.partnerConfirmedOne' : 'catalog.partnerConfirmedNone'));
                  }}
                >
                  {t('catalog.partnerConfirmDemo')}
                </Button>
              </div>
            </div>
          </SectionCard>
        )}

        {!connected && (
          <SectionCard title={t('catalog.connectTitle')} padding="sm">
            {/* F-05-122: подключение сразу к нескольким локациям */}
            <div data-f="F-05-122" className="flex flex-col gap-3">
              <p className="text-xs text-muted">{t('catalog.chooseLocations')}</p>
              <ul className="flex flex-col gap-1.5">
                {businessIds.map((id) => (
                  <li key={id}>
                    <Checkbox checked={selected.has(id)} onCheckedChange={() => toggleLocation(id)} label={id === businessId ? t('catalog.thisLocation') : id} />
                  </li>
                ))}
              </ul>
              {businessIds.length > 1 && (
                <Checkbox
                  checked={selected.size === businessIds.length}
                  onCheckedChange={(checked) => setSelected(checked ? new Set(businessIds) : new Set())}
                  label={t('catalog.allLocations')}
                />
              )}
              <div className="flex justify-end">
                <Button size="sm" onClick={submitConnect} loading={connect.isPending} disabled={selected.size === 0}>
                  {t('channelsTab.connect')}
                </Button>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </Modal>
  );
}

export function CatalogScreen() {
  const t = useT('notify');
  const locale = useLocale() as Locale;
  const { ready, businessId, businessIds } = useCurrent();
  const [typeFilter, setTypeFilter] = useState<'all' | 'smsAggregator' | 'chatBot'>('all');
  const [channelFilter, setChannelFilter] = useState<PartnerChannelKind | 'all'>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<PartnerCapability | 'all'>('all');
  const [openAppId, setOpenAppId] = useState<string | null>(null);

  const appsQ = useApiQuery(['notify', 'partnerApps'], () => listPartnerApps(), { enabled: ready });
  const connQ = useApiQuery(['notify', 'partnerConnections', businessId], () => listPartnerConnections(businessId!), {
    enabled: ready && !!businessId,
  });

  if (!ready || appsQ.isLoading || connQ.isLoading) return <Skeleton lines={8} />;
  if (appsQ.isError || connQ.isError) return <ErrorState onRetry={() => (appsQ.isError ? appsQ.refetch() : connQ.refetch())} />;

  const apps = appsQ.data ?? [];
  const connections = connQ.data ?? [];
  const connectedByApp = new Map(connections.map((c) => [c.appId, c]));

  const filtered = apps.filter((app) => {
    if (typeFilter !== 'all' && app.type !== typeFilter) return false;
    if (channelFilter !== 'all' && !app.channels.includes(channelFilter)) return false;
    if (capabilityFilter !== 'all' && !app.capabilities.includes(capabilityFilter)) return false;
    return true;
  });

  const openApp = apps.find((a) => a.id === openAppId);
  const openConn = openApp ? connectedByApp.get(openApp.id) : undefined;

  return (
    <div data-f="F-05-070" className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('catalog.title')} description={t('catalog.subtitle')} />

      <div data-f="F-05-117" className="flex gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>{t('catalog.licenseNote')}</p>
      </div>

      <FilterBar
        filters={[
          {
            id: 'type',
            label: t('catalog.filterType'),
            node: (
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
                options={[
                  { value: 'all', label: t('typesTab.filterAll') },
                  { value: 'smsAggregator', label: t('catalog.typeSmsAggregator') },
                  { value: 'chatBot', label: t('catalog.typeChatBot') },
                ]}
              />
            ),
          },
          {
            id: 'channel',
            label: t('catalog.filterChannel'),
            node: (
              <Select
                value={channelFilter}
                onValueChange={(v) => setChannelFilter(v as typeof channelFilter)}
                options={[{ value: 'all', label: t('typesTab.filterAll') }, ...CHANNEL_ICON_KEYS.map((ch) => ({ value: ch, label: t(`catalog.channelKind.${ch}`) }))]}
              />
            ),
          },
          {
            id: 'capability',
            label: t('catalog.filterCapability'),
            node: (
              <Select
                value={capabilityFilter}
                onValueChange={(v) => setCapabilityFilter(v as typeof capabilityFilter)}
                options={[{ value: 'all', label: t('typesTab.filterAll') }, ...CAPABILITY_KEYS.map((c) => ({ value: c, label: t(`catalog.capability.${c}`) }))]}
              />
            ),
          },
        ]}
        activeCount={(typeFilter !== 'all' ? 1 : 0) + (channelFilter !== 'all' ? 1 : 0) + (capabilityFilter !== 'all' ? 1 : 0)}
        onReset={() => {
          setTypeFilter('all');
          setChannelFilter('all');
          setCapabilityFilter('all');
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState title={t('catalog.emptyTitle')} description={t('catalog.emptyText')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((app) => {
            const conn = connectedByApp.get(app.id);
            return (
              <button
                key={app.id}
                type="button"
                data-f="F-05-069 F-05-070 F-05-075"
                onClick={() => setOpenAppId(app.id)}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4 text-left transition hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-fg">{app.name}</p>
                  {conn && (
                    <Badge tone={conn.status === 'active' ? 'success' : conn.status === 'trial' ? 'warning' : 'danger'} size="sm">
                      {t(`catalog.status.${conn.status}`)}
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted">{app.description[locale] ?? app.description.ru}</p>
                <div className="flex flex-wrap gap-1">
                  {app.channels.slice(0, 4).map((ch) => (
                    <Chip key={ch}>
                      {t(`catalog.channelKind.${ch}`)}
                    </Chip>
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Star aria-hidden className="size-3.5 fill-current text-warning" />
                    {app.rating.toFixed(1)}
                  </span>
                  <span>{app.priceNote[locale] ?? app.priceNote.ru}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ExitHold value={openApp}>
        {(openApp) => (
        <AppDetailModal
          app={openApp}
          connected={!!openConn}
          status={openConn?.status}
          trialEndsAt={openConn?.trialEndsAt}
          systemUserLabel={openConn?.systemUserLabel}
          businessIds={businessIds}
          onClose={() => setOpenAppId(null)}
        />
        )}
      </ExitHold>
    </div>
  );
}

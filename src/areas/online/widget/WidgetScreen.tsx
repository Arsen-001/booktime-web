'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { coreGet, coreList } from '@/api/core';
import {
  generateApiKey,
  getApiCredentials,
  getMobileAppLinks,
  isSubdomainAvailable,
  listIntegrations,
  listLinks,
  requestBrandedAppConsult,
  revokeApiKey,
  setIntegrationConnected,
  updateLink,
  updateMobileAppLinks,
} from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { cn } from '@/lib/cn';
import { DEFAULT_WEBSITE_BUTTON, INTEGRATION_CATALOG, LINK_DOMAINS, type ButtonCorner, type IntegrationId, type LinkDomain, type WidgetSide } from '@/domain/online';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useOnlineAccess } from '@/areas/online/access';
import { copyText } from '@/areas/online/links/copyText';
import { HelpHint } from '@/areas/online/HelpHint';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { SearchInput } from '@/ui/SearchInput';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { isOrderService } from '@/domain/ordersPickup';

type WidgetTab = 'button' | 'install' | 'addresses';
type InstallMethod = 'round' | 'custom' | 'form';

function CodeBlock({
  code,
  onCopy,
  copyLabel,
  primary = false,
  testHref,
}: {
  code: string;
  onCopy: () => void;
  copyLabel: string;
  primary?: boolean;
  /** О29: «Проверить» — открыть адрес, куда ведёт кнопка, в новой вкладке */
  testHref?: string;
}) {
  const t = useT('online');
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
      <pre className="w-full overflow-x-auto whitespace-pre font-mono text-xs text-fg">{code}</pre>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={primary ? 'primary' : 'secondary'} leftIcon={<Copy aria-hidden />} onClick={onCopy}>
          {copyLabel}
        </Button>
        {testHref && (
          <Button size="sm" variant="ghost" leftIcon={<ExternalLink aria-hidden />} onClick={() => window.open(testHref, '_blank', 'noopener')}>
            {t('widget.install.test')}
          </Button>
        )}
      </div>
    </div>
  );
}

const CORNER_CSS: Record<ButtonCorner, string> = { br: 'right:24px;bottom:24px', tr: 'right:24px;top:24px', bl: 'left:24px;bottom:24px', tl: 'left:24px;top:24px' };

/**
 * О29: код кнопки для сайта — обычная ссылка на страницу записи ЭТОГО салона в BookTime (адрес ссылки и её номер
 * формы), без чужого скрипта: раньше код вёл на w1400000.zapis.link — одинаковый для всех и не наш, кнопка не
 * работала. Ссылка работает на любом конструкторе сайтов без JavaScript.
 */
function roundButtonSnippet(url: string, label: string, cfg: { position: ButtonCorner; color: string }): string {
  const style = `position:fixed;${CORNER_CSS[cfg.position]};z-index:9999;padding:14px 22px;border-radius:999px;background:${cfg.color};color:#fff;font:600 15px/1 sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.2)`; // tokens-ok: цвет — данные (код для сайта салона / цвет кнопки по умолчанию)
  return `<!-- BookTime: кнопка онлайн-записи -->\n<a href="${url}" target="_blank" rel="noopener" style="${style}">${label}</a>`;
}

/** /biz/online/widget — кнопка на сайте, установка, номера для ссылок, домен, Instagram (F-03-013, F-03-028…038) */
/** Адрес сайта не меняется — подписка не нужна (useSyncExternalStore для безопасной гидратации) */
const noopSubscribe = () => () => {};

export function WidgetScreen() {
  const t = useT('online');
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const { full: hasAccess } = useOnlineAccess();
  const [tab, setTab] = useState<WidgetTab>('button');
  const [installMethod, setInstallMethod] = useState<InstallMethod>('round');

  const businessQ = useApiQuery(['online-widget-business', businessId], () => coreGet('businesses', businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const linksQ = useApiQuery(['online-widget-links', businessId], () => listLinks(businessId!), { enabled: ready && Boolean(businessId) });
  const staffQ = useApiQuery(['online-widget-staff', businessId], () => coreList('staff', (s) => s.businessId === businessId), {
    enabled: ready && Boolean(businessId),
  });
  const servicesQ = useApiQuery(['online-widget-services', businessId], () => coreList('services', (s) => s.businessId === businessId && !isOrderService(s)), {
    enabled: ready && Boolean(businessId),
  });
  const locationsQ = useApiQuery(['online-widget-locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });

  const loading = !ready || businessQ.isLoading || linksQ.isLoading || staffQ.isLoading || servicesQ.isLoading || locationsQ.isLoading;
  const failed = businessQ.isError || linksQ.isError || !businessQ.data;

  const primary = linksQ.data?.find((l) => l.primary);
  // На сервере адреса нет: '' и на первой отрисовке клиента тоже '' — иначе разметка не совпадает (hydration mismatch)
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '');

  const copy = async (text: string, okKey: 'widget.copied' = 'widget.copied') => {
    if (await copyText(text)) toast.success(t(okKey));
    else toast.error(t('links.card.copyFailed'));
  };

  const tabItems = [
    { value: 'button', label: t('widget.tabs.button') },
    { value: 'install', label: t('widget.tabs.install') },
    { value: 'addresses', label: t('widget.tabs.addresses') },
  ];

  if (loading) {
    // До данных — та же страница: шапка, вкладки и карточка кнопки с настройками по умолчанию (как у новой ссылки),
    // без ввода; с данными карточка заводится заново по своим значениям
    return (
      <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto w-full max-w-[760px]">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-10" aria-busy="true">
          <PageHeader title={t('nav.widget')} description={t('widget.subtitle')} meta={<HelpHint screenKey="widget" />} />
          <Tabs items={tabItems} value={tab} onValueChange={(v) => setTab(v as typeof tab)} />
          {tab === 'button' && (
            <div inert>
              <WebsiteButtonCard
                key="loading"
                linkId=""
                config={DEFAULT_WEBSITE_BUTTON}
                bookingUrl={`${origin}/b/…`}
                buttonLabel={t('widget.install.customButtonLabel')}
                onCopy={() => undefined}
              />
            </div>
          )}
        </div>
      </PermissionGate>
    );
  }
  if (failed) {
    return (
      <ErrorState
        onRetry={() => {
          businessQ.refetch();
          linksQ.refetch();
        }}
      />
    );
  }
  if (!primary || !businessQ.data) {
    return <ErrorState onRetry={linksQ.refetch} />;
  }
  const business = businessQ.data;

  const bookingUrl = `${origin}/b/${business.slug}`;
  const linkUrl = (formId: string, isPrimary: boolean) => (isPrimary ? bookingUrl : `${bookingUrl}/f/${formId}`);
  const buttonLabel = t('widget.install.customButtonLabel');
  const buttonSnippet = roundButtonSnippet(bookingUrl, buttonLabel, primary.websiteButton);
  const customButtonSnippet = `<a href="${bookingUrl}" target="_blank" rel="noopener">${buttonLabel}</a>`;
  const iframeSnippet = `<iframe src="${bookingUrl}/embed" width="545" height="780" frameborder="0"></iframe>`;
  const multiFormSnippet = (linksQ.data ?? [])
    .map((l) => `<a href="${linkUrl(l.formId, l.primary)}" target="_blank" rel="noopener">${l.name}</a>`)
    .join('\n');

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto w-full max-w-[760px]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-10">
        <PageHeader title={t('nav.widget')} description={t('widget.subtitle')} meta={<HelpHint screenKey="widget" />} />

        <Tabs
          items={tabItems}
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        />

        {tab === 'button' && (
          <WebsiteButtonCard
            linkId={primary.id}
            config={primary.websiteButton}
            bookingUrl={bookingUrl}
            buttonLabel={buttonLabel}
            onCopy={(code) => copy(code)}
          />
        )}

        {tab === 'install' && (
          <div className="flex flex-col gap-6">
            <SectionCard title={t('widget.install.title')} description={t('widget.install.hint')}>
              <div className="flex flex-col gap-4" data-f="F-03-029 F-03-030 F-03-031 F-03-032 F-13-138">
                <FormField label={t('widget.install.howTitle')}>
                  <ChoiceGroup
                    columns={1}
                    value={installMethod}
                    onValueChange={(v) => setInstallMethod(v as InstallMethod)}
                    options={[
                      { value: 'round', title: t('widget.install.roundButton') },
                      { value: 'custom', title: t('widget.install.customButton') },
                      { value: 'form', title: t('widget.install.formOnPage') },
                    ]}
                  />
                </FormField>
                {installMethod === 'round' && (
                  <div>
                    <p className="mb-2 text-sm text-muted">{t('widget.install.standardHint')}</p>
                    <CodeBlock code={buttonSnippet} onCopy={() => copy(buttonSnippet)} copyLabel={t('widget.install.copyButtonCode')} primary testHref={bookingUrl} />
                  </div>
                )}
                {installMethod === 'custom' && (
                  <div>
                    <p className="mb-2 text-sm text-muted">{t('widget.install.customHint')}</p>
                    <CodeBlock code={customButtonSnippet} onCopy={() => copy(customButtonSnippet)} copyLabel={t('widget.install.copyButtonCode')} primary testHref={bookingUrl} />
                  </div>
                )}
                {installMethod === 'form' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="mb-2 text-sm text-muted">{t('widget.install.multiFormHint')}</p>
                      <CodeBlock code={multiFormSnippet} onCopy={() => copy(multiFormSnippet)} copyLabel={t('widget.install.copyButtonCode')} primary testHref={bookingUrl} />
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="mb-1 text-sm font-medium text-fg">{t('widget.install.iframe')}</p>
                      <p className="mb-2 text-sm text-muted">{t('widget.install.iframeHint')}</p>
                      <CodeBlock code={iframeSnippet} onCopy={() => copy(iframeSnippet)} copyLabel={t('widget.install.copyButtonCode')} primary testHref={`${bookingUrl}/embed`} />
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title={t('widget.platforms.title')}>
              <Accordion
                variant="plain"
                items={[
                  { id: 'wordpress', title: t('widget.platforms.wordpress'), content: <p className="text-sm text-muted" data-f="F-03-033">{t('widget.platforms.wordpressText')}</p> },
                  { id: 'joomla', title: t('widget.platforms.joomla'), content: <p className="text-sm text-muted" data-f="F-03-033">{t('widget.platforms.joomlaText')}</p> },
                  { id: 'google', title: t('widget.platforms.googleSites'), content: <p className="text-sm text-muted" data-f="F-03-033">{t('widget.platforms.googleSitesText')}</p> },
                  { id: 'wix', title: t('widget.platforms.wix'), content: <p className="text-sm text-muted" data-f="F-03-034">{t('widget.platforms.wixText')}</p> },
                  { id: 'tilda', title: t('widget.platforms.tilda'), content: <p className="text-sm text-muted" data-f="F-03-035">{t('widget.platforms.tildaText')}</p> },
                ]}
              />
            </SectionCard>
          </div>
        )}

        {tab === 'addresses' && (
          <div className="flex flex-col gap-6">
            <DomainCard linkId={primary.id} currentSubdomain={primary.subdomain} currentDomain={primary.domain} onSaved={linksQ.refetch} />

            <SectionCard title={t('widget.instagram.title')} description={t('widget.instagram.hint')}>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2" data-f="F-03-038">
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{`${origin}/b/${business.slug}`}</span>
                <IconButton icon={<Copy aria-hidden />} label={t('links.card.copy')} size="sm" onClick={() => copy(`${origin}/b/${business.slug}`)} />
              </div>
            </SectionCard>

            <SectionCard title={t('widget.ids.title')} description={t('widget.ids.hint')} padding="none">
              <Accordion
                variant="plain"
                items={[
                  {
                    id: 'dev-ids',
                    title: t('widget.ids.devTitle'),
                    content: (
                      <div className="flex flex-col gap-4" data-f="F-03-013">
                        <IdSearchList
                          groups={[
                            { title: t('widget.ids.forms'), items: (linksQ.data ?? []).map((l) => ({ id: l.formId, label: l.name })) },
                            {
                              title: t('widget.ids.staff'),
                              items: (staffQ.data ?? [])
                                .filter((s) => s.role === 'master')
                                .map((s) => ({ id: s.id, label: s.name })),
                            },
                            { title: t('widget.ids.services'), items: (servicesQ.data ?? []).map((s) => ({ id: s.id, label: s.name.ru })) },
                            { title: t('widget.ids.locations'), items: (locationsQ.data ?? []).map((l) => ({ id: l.id, label: l.name.ru })) },
                          ]}
                          onCopy={(v) => copy(v)}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </SectionCard>
          </div>
        )}

        <ChannelsCard businessId={businessId!} />
        <MobileAppCard businessId={businessId!} />
      </div>
    </PermissionGate>
  );
}

/**
 * Другие каналы записи — свой API, Book Now (Instagram/Facebook), Google, Яндекс.Карты, 2GIS, партнёрские
 * каталоги и сторонние боты (F-03-036, F-03-039…043, F-03-046). ⭐ Понятно? 🔒 у всех этих функций — они живут
 * за пределами кабинета или в маркетплейсе, который наш «Интеграции» пока не строит (qa/requests/online.md);
 * здесь — демо-подключение (переключатель меняет своё состояние в срезе online, реального похода на площадку
 * нет — как договорено в CONVENTIONS §0 «🔒 — интерфейс на моках с пометкой «демо»»).
 */
function ChannelsCard({ businessId }: { businessId: string }) {
  const t = useT('online');
  const toast = useToast();
  const integrationsQ = useApiQuery(['online-integrations', businessId], () => listIntegrations(businessId));
  const credsQ = useApiQuery(['online-api-credentials', businessId], () => getApiCredentials(businessId));
  // Не `credsQ.data!.apiKey`: React Compiler по «!» считает credsQ.data не-null и выносит чтение поля в рендер.
  const apiKey = credsQ.data?.apiKey;
  const toggleMutation = useApiMutation((args: { id: IntegrationId; connected: boolean }) => setIntegrationConnected(businessId, args.id, args.connected));
  const genMutation = useApiMutation((_: void) => generateApiKey(businessId));
  const revokeMutation = useApiMutation((_: void) => revokeApiKey(businessId));

  if (integrationsQ.isLoading || credsQ.isLoading) return <Skeleton variant="rect" className="h-40 rounded-xl" />;
  if (integrationsQ.isError || !integrationsQ.data) return null;
  const byId = new Map(integrationsQ.data.map((i) => [i.id, i] as const));

  const toggle = async (id: IntegrationId, connected: boolean) => {
    try {
      await toggleMutation.mutate({ id, connected });
      toast.success(connected ? t('widget.channels.connected') : t('settings.saved'));
      integrationsQ.refetch();
    } catch {
      toast.error(t('widget.channels.unavailable'));
    }
  };


  return (
    <SectionCard title={t('widget.channels.title')} description={t('widget.channels.hint')} padding="none">
      <ul className="flex flex-col divide-y divide-border">
        <li className="flex flex-col gap-3 px-4 py-4 sm:px-5" data-f="F-03-036">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-fg">{t('widget.channels.ownApi.title')}</p>
              <p className="text-sm text-muted">{t('widget.channels.ownApi.hint')}</p>
            </div>
            {credsQ.data?.apiKey ? (
              <Badge tone="success" variant="soft" icon={<Check aria-hidden />}>
                {t('widget.channels.connected')}
              </Badge>
            ) : null}
          </div>
          {credsQ.data?.apiKey ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{credsQ.data.apiKey}</span>
                <IconButton
                  icon={<Copy aria-hidden />}
                  label={t('links.card.copy')}
                  size="sm"
                  onClick={() => {
                    if (!apiKey) return;
                    copy(apiKey);
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={genMutation.isPending}
                  onClick={async () => {
                    await genMutation.mutate();
                    toast.success(t('widget.channels.ownApi.generated'));
                    credsQ.refetch();
                  }}
                >
                  {t('widget.channels.ownApi.regenerate')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  loading={revokeMutation.isPending}
                  onClick={async () => {
                    await revokeMutation.mutate();
                    toast.success(t('widget.channels.ownApi.revoked'));
                    credsQ.refetch();
                  }}
                >
                  {t('widget.channels.ownApi.revoke')}
                </Button>
              </div>
            </>
          ) : (
            <div>
              <Button
                size="sm"
                variant="secondary"
                loading={genMutation.isPending}
                onClick={async () => {
                  await genMutation.mutate();
                  toast.success(t('widget.channels.ownApi.generated'));
                  credsQ.refetch();
                }}
              >
                {t('widget.channels.ownApi.generate')}
              </Button>
            </div>
          )}
        </li>
        {/* Литеральный data-f у каждого <li> (не через переменную) — scripts/fids.mjs размечает охват
            статическим regex по исходнику и не видит `data-f={переменная}` — ChannelRow рендерит только
            содержимое строки, литеральный data-f стоит здесь, в JSX вызова. */}
        <li className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5" data-f="F-03-039">
          <ChannelRow id="metaBookNow" byId={byId} toggle={toggle} pending={toggleMutation.isPending} />
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5" data-f="F-03-040">
          <ChannelRow id="googleReserve" byId={byId} toggle={toggle} pending={toggleMutation.isPending} />
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5" data-f="F-03-041">
          <ChannelRow id="yandexMaps" byId={byId} toggle={toggle} pending={toggleMutation.isPending} />
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5" data-f="F-03-042">
          <ChannelRow id="twoGis" byId={byId} toggle={toggle} pending={toggleMutation.isPending} />
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5" data-f="F-03-043">
          <ChannelRow id="earlyone" byId={byId} toggle={toggle} pending={toggleMutation.isPending} />
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5" data-f="F-03-046">
          <ChannelRow id="thirdPartyBots" byId={byId} toggle={toggle} pending={toggleMutation.isPending} />
        </li>
      </ul>
    </SectionCard>
  );

  function copy(text: string) {
    copyText(text).then((ok) => toast[ok ? 'success' : 'error'](ok ? t('widget.copied') : t('links.card.copyFailed')));
  }
}

function ChannelRow({
  id,
  byId,
  toggle,
  pending,
}: {
  id: IntegrationId;
  byId: Map<IntegrationId, { id: IntegrationId; connected: boolean }>;
  toggle: (id: IntegrationId, v: boolean) => void;
  pending: boolean;
}) {
  const t = useT('online');
  const conn = byId.get(id);
  const entry = INTEGRATION_CATALOG.find((c) => c.id === id)!;
  const title = t(`widget.channels.${id}.title` as 'widget.channels.metaBookNow.title');
  return (
    <>
      <div className="min-w-0">
        <p className="font-medium text-fg">{title}</p>
        <p className="text-sm text-muted">{t(`widget.channels.${id}.hint` as 'widget.channels.metaBookNow.hint')}</p>
        {!entry.availableInArmenia && (
          <Badge tone="neutral" size="sm" variant="soft" className="mt-1.5 w-fit">
            {t('widget.channels.unavailable')}
          </Badge>
        )}
        {entry.requiresPaidLicense && (
          <Badge tone="warning" size="sm" variant="soft" className="mt-1.5 w-fit">
            {t('widget.channels.requiresLicense')}
          </Badge>
        )}
      </div>
      <Switch
        checked={conn?.connected ?? false}
        disabled={!entry.availableInArmenia || pending}
        onCheckedChange={(v) => toggle(id, v)}
        aria-label={title}
      />
    </>
  );
}

/** «Мобильные приложения»: свои ссылки + заявка на брендированное приложение (F-03-048) */
function MobileAppCard({ businessId }: { businessId: string }) {
  const t = useT('online');
  const toast = useToast();
  const format = useFormat();
  const linksQ = useApiQuery(['online-mobile-app', businessId], () => getMobileAppLinks(businessId));
  const saveMutation = useApiMutation((patch: Parameters<typeof updateMobileAppLinks>[1]) => updateMobileAppLinks(businessId, patch));
  const consultMutation = useApiMutation((_: void) => requestBrandedAppConsult(businessId));
  const [ios, setIos] = useState('');
  const [android, setAndroid] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (linksQ.data && loadedFor !== businessId) {
    setIos(linksQ.data.iosUrl ?? '');
    setAndroid(linksQ.data.androidUrl ?? '');
    setLoadedFor(businessId);
  }

  if (linksQ.isLoading) return <Skeleton variant="rect" className="h-40 rounded-xl" />;
  if (linksQ.isError || !linksQ.data) return null;

  const save = async () => {
    try {
      await saveMutation.mutate({ iosUrl: ios.trim() || undefined, androidUrl: android.trim() || undefined });
      toast.success(t('widget.mobileApp.linksSaved'));
      linksQ.refetch();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div data-f="F-03-048">
      <SectionCard title={t('widget.mobileApp.title')} description={t('widget.mobileApp.hint')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('widget.mobileApp.ios')} optional>
            <Input value={ios} onChange={(e) => setIos(e.target.value)} placeholder="https://apps.apple.com/…" />
          </FormField>
          <FormField label={t('widget.mobileApp.android')} optional>
            <Input value={android} onChange={(e) => setAndroid(e.target.value)} placeholder="https://play.google.com/…" />
          </FormField>
          <div>
            <Button size="sm" onClick={save} loading={saveMutation.isPending}>
              {t('settings.save')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-fg">{t('widget.mobileApp.orderTitle')}</p>
            <p className="text-sm text-muted">{t('widget.mobileApp.orderHint')}</p>
            {linksQ.data.consultRequestedAt ? (
              <Badge tone="success" variant="soft" icon={<Check aria-hidden />} className="w-fit">
                {t('widget.mobileApp.orderSent', { date: format.date(linksQ.data.consultRequestedAt) })}
              </Badge>
            ) : (
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={consultMutation.isPending}
                  onClick={async () => {
                    await consultMutation.mutate();
                    linksQ.refetch();
                  }}
                >
                  {t('widget.mobileApp.orderButton')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function IdSearchList({
  groups,
  onCopy,
}: {
  groups: { title: string; items: { id: string; label: string }[] }[];
  onCopy: (v: string) => void;
}) {
  const t = useT('online');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = groups.map((g) => ({ ...g, items: g.items.filter((it) => !q || it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q)) }));
  const hasAny = filtered.some((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={query} onValueChange={setQuery} placeholder={t('widget.ids.search')} />
      {!hasAny ? (
        <p className="text-sm text-muted">{t('widget.ids.empty')}</p>
      ) : (
        filtered
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-sm font-medium text-fg">{g.title}</p>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {g.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm text-fg">{it.label}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{it.id}</span>
                    <IconButton icon={<Copy aria-hidden />} label={t('links.card.copy')} size="sm" variant="ghost" onClick={() => onCopy(it.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </div>
  );
}

const CORNERS: { value: ButtonCorner; label: string }[] = [
  { value: 'br', label: 'widget.button.cornerBr' },
  { value: 'tr', label: 'widget.button.cornerTr' },
  { value: 'bl', label: 'widget.button.cornerBl' },
  { value: 'tl', label: 'widget.button.cornerTl' },
];

/** Блок «Кнопка на сайте» (F-03-028) */
function WebsiteButtonCard({
  linkId,
  config,
  bookingUrl,
  buttonLabel,
  onCopy,
}: {
  linkId: string;
  config: { show: boolean; position: ButtonCorner; widgetSide: WidgetSide; color: string; animation: boolean };
  bookingUrl: string;
  buttonLabel: string;
  onCopy: (code: string) => void;
}) {
  const t = useT('online');
  const toast = useToast();
  const [show, setShow] = useState(config.show);
  const [position, setPosition] = useState<ButtonCorner>(config.position);
  const [widgetSide, setWidgetSide] = useState<WidgetSide>(config.widgetSide);
  const [color, setColor] = useState(config.color);
  const [animation, setAnimation] = useState(config.animation);
  const mutation = useApiMutation((patch: Parameters<typeof updateLink>[1]) => updateLink(linkId, patch));

  const save = async () => {
    try {
      await mutation.mutate({ websiteButton: { show, position, widgetSide, color, animation } });
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  const snippet = roundButtonSnippet(bookingUrl, buttonLabel, { position, color });
  const cornerPos: Record<ButtonCorner, string> = { br: 'bottom-2 right-2', tr: 'top-2 right-2', bl: 'bottom-2 left-2', tl: 'top-2 left-2' };

  return (
    <SectionCard title={t('widget.button.title')} description={t('widget.button.hint')}>
      <div className="flex flex-col gap-4" data-f="F-03-028">
        <Switch checked={show} onCheckedChange={setShow} label={t('widget.button.show')} />
        {show && (
          <>
            <div className="relative h-24 w-full rounded-lg border border-border bg-surface-2" aria-hidden>
              <span className={cn('absolute size-8 rounded-full shadow-sm', cornerPos[position])} style={{ backgroundColor: color }} />
            </div>
            <FormField label={t('widget.button.position')}>
              <ChoiceGroup columns={2} value={position} onValueChange={(v) => setPosition(v as ButtonCorner)} options={CORNERS.map((c) => ({ value: c.value, title: t(c.label as 'widget.button.cornerBr') }))} />
            </FormField>
            <FormField label={t('widget.button.side')}>
              <Select
                value={widgetSide}
                onValueChange={(v) => setWidgetSide(v as WidgetSide)}
                options={[
                  { value: 'right', label: t('widget.button.sideRight') },
                  { value: 'left', label: t('widget.button.sideLeft') },
                ]}
              />
            </FormField>
            <FormField label={t('widget.button.color')}>
              {/* F-03-024: на телефоне 390px три элемента в одну строку сжимали поле кода до одного символа —
                  теперь поле не ужимается ниже разумного минимума, а кнопка сброса переносится строкой ниже. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="size-9 shrink-0 rounded-lg border border-border" style={{ backgroundColor: color }} aria-hidden />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="min-w-[7.5rem] flex-1 font-mono sm:max-w-40 sm:flex-none"
                />
                <Button variant="ghost" size="sm" onClick={() => setColor('#3b32c9')}> {/* tokens-ok: цвет кнопки по умолчанию — данные */}
                  {t('linkSettings.design.colorReset')}
                </Button>
              </div>
            </FormField>
            <Switch checked={animation} onCheckedChange={setAnimation} label={t('widget.button.animation')} />
          </>
        )}
        <div>
          <Button size="sm" variant="secondary" onClick={save} loading={mutation.isPending}>
            {t('settings.save')}
          </Button>
        </div>
        {/* Код сразу отражает выбранный угол и цвет — то, что владелец видит в превью, то и вставит */}
        {show && (
          <CodeBlock
            code={snippet}
            onCopy={() => onCopy(snippet)}
            copyLabel={t('widget.install.copyButtonCode')}
            primary
            testHref={bookingUrl}
          />
        )}
      </div>
    </SectionCard>
  );
}

/** Персональный домен (F-03-037) */
function DomainCard({
  linkId,
  currentSubdomain,
  currentDomain,
  onSaved,
}: {
  linkId: string;
  currentSubdomain: string | undefined;
  currentDomain: string | undefined;
  onSaved: () => void;
}) {
  const t = useT('online');
  const toast = useToast();
  const [subdomain, setSubdomain] = useState(currentSubdomain ?? '');
  // Старые сохранённые чужие домены (zapis.link) больше не предлагаем — О29
  const [domain, setDomain] = useState<string>(currentDomain && (LINK_DOMAINS as readonly string[]).includes(currentDomain) ? currentDomain : LINK_DOMAINS[0]);
  const [error, setError] = useState<string | undefined>();
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const mutation = useApiMutation((patch: Parameters<typeof updateLink>[1]) => updateLink(linkId, patch));

  const finalAddress = subdomain.trim() ? `${subdomain.trim()}.${domain}` : '';

  const checkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checkToken = useRef(0);

  const onSubdomainChange = (value: string) => {
    setSubdomain(value);
    clearTimeout(checkTimer.current);
    const clean = value.trim().toLowerCase();
    const unchanged = !clean || clean === (currentSubdomain ?? '').toLowerCase();
    if (unchanged || !/^[a-z0-9-]{3,40}$/.test(clean)) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const token = ++checkToken.current;
    checkTimer.current = setTimeout(async () => {
      const ok = await isSubdomainAvailable(clean, linkId);
      if (checkToken.current === token) setAvailability(ok ? 'free' : 'taken');
    }, 300);
  };

  const save = async () => {
    const clean = subdomain.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(clean)) {
      setError(t('widget.domain.invalid'));
      return;
    }
    const available = await isSubdomainAvailable(clean, linkId);
    if (!available) {
      setError(t('widget.domain.taken'));
      return;
    }
    setError(undefined);
    try {
      await mutation.mutate({ subdomain: clean, domain: domain as (typeof LINK_DOMAINS)[number] });
      toast.success(t('settings.saved'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <SectionCard title={t('widget.domain.title')} description={t('widget.domain.hint')}>
      <div className="flex flex-col gap-3" data-f="F-03-037">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <FormField label={t('widget.domain.subdomain')} error={error}>
            <Input value={subdomain} onChange={(e) => onSubdomainChange(e.target.value)} placeholder="beauty-spa" />
          </FormField>
          <FormField label={t('widget.domain.domain')}>
            {LINK_DOMAINS.length > 1 ? (
              <Select value={domain} onValueChange={setDomain} options={LINK_DOMAINS.map((d: LinkDomain) => ({ value: d, label: `.${d}` }))} />
            ) : (
              <p className="flex min-h-11 items-center font-mono text-sm text-fg">.{domain}</p>
            )}
          </FormField>
        </div>
        {finalAddress && (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">{t('widget.domain.finalAddressHint')}</p>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{finalAddress}</span>
              <IconButton icon={<Copy aria-hidden />} label={t('links.card.copy')} size="sm" onClick={() => copyText(finalAddress)} />
            </div>
            {availability === 'checking' && <Badge tone="neutral" variant="soft" size="sm" className="w-fit">{t('widget.domain.checking')}</Badge>}
            {availability === 'free' && <Badge tone="success" variant="soft" size="sm" icon={<Check aria-hidden />} className="w-fit">{t('widget.domain.free')}</Badge>}
            {availability === 'taken' && <Badge tone="danger" variant="soft" size="sm" className="w-fit">{t('widget.domain.taken2')}</Badge>}
          </div>
        )}
        <div>
          <Button size="sm" onClick={save} loading={mutation.isPending} disabled={!subdomain.trim() || availability === 'taken' || availability === 'checking'}>
            {t('settings.save')}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

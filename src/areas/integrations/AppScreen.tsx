'use client';

/**
 * /biz/integrations/apps/[appId] — карточка приложения (F-13-008…F-13-023). Вкладки «Информация», «Отзывы»,
 * «Тарифы», «Настройки»; плашки «Цена» и «Каналы»; подключение/отключение/автоотключение.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, ExternalLink, Phone, SearchX, Star } from 'lucide-react';
import {
  connectApp,
  demoIncomingCall,
  getApp,
  getAppByCode,
  getInstall,
  listLiveInstallLocationIds,
  refundLastPartnerPayment,
  type DemoIncomingCall,
} from '@/api/integrations';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { AppActionCard } from '@/areas/integrations/components/AppActionCard';
import { AppInfoTab } from '@/areas/integrations/components/AppInfoTab';
import { AppPricingTab } from '@/areas/integrations/components/AppPricingTab';
import { AppReviewsTab } from '@/areas/integrations/components/AppReviewsTab';
import { AppSettingsTab } from '@/areas/integrations/components/AppSettingsTab';
import { APP_ICON, appIconKey, appTileTone, FROM_AREA_HREF } from '@/areas/integrations/catalog';
import { ConnectSheet } from '@/areas/integrations/components/ConnectSheet';
import { IncomingCallCard } from '@/areas/integrations/components/IncomingCallCard';
import { useCan, useCurrent } from '@/demo/hooks';
import { appHasOwnSettings, canPersonaConnect, canRefundLastPayment, isInstallLive, paysPartnerDirectly, type CatalogApp, type RequestedScope } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { KeyValueList } from '@/ui/KeyValueList';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

function priceLine(app: CatalogApp, t: ReturnType<typeof useT<'integrations'>>, money: (v: number) => string): string {
  const p = app.price;
  if (app.builtin) return t('price.builtin');
  switch (p.model) {
    case 'free':
      return t('price.free');
    case 'freeTier':
      return t('price.freeTier');
    case 'trialDays':
      return t('price.trialDays', { n: p.trialDays ?? 14 });
    case 'testPeriod':
      return t('price.testPeriod');
    case 'comingSoon':
      return t('price.comingSoon');
    case 'perMessage':
      return t('price.perMessage', { amount: p.currency === 'AMD' ? money(p.amount ?? 0) : `${p.amount} ${p.currency}` });
    case 'fromPrice':
      return t('price.fromPrice', { amount: p.currency === 'AMD' ? money(p.amount ?? 0) : `${p.amount} ${p.currency}` });
    default:
      return t('price.none');
  }
}

/**
 * Решение владельца 01.10: адрес карточки принимает и id, и code приложения — «Ссылка для отзыва» из кабинета
 * разработчика строится по code (/apps/<code>?review=1). Не нашли по id — ищем по code.
 */
async function getAppByIdOrCode(idOrCode: string): Promise<CatalogApp> {
  try {
    return await getApp(idOrCode);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return getAppByCode(idOrCode);
    throw e;
  }
}

export function AppScreen({ appId: idOrCode }: { appId: string }) {
  const t = useT('integrations');
  const { money, date } = useFormat();
  const toast = useToast();
  const { ready, businessId, locationIds, locationId: activeLocationId, persona } = useCurrent();
  const can = useCan('integrations.manage');
  const searchParams = useSearchParams();
  // ?review=1 — ссылка «оставить отзыв»: сразу вкладка «Отзывы»
  const [tab, setTab] = useState(searchParams.get('review') === '1' ? 'reviews' : 'info');
  const [connectOpen, setConnectOpen] = useState(false);
  const from = searchParams.get('from');
  const fromHref = from ? FROM_AREA_HREF[from] : undefined;
  const [connectKey, setConnectKey] = useState(0);
  const [activeCall, setActiveCall] = useState<DemoIncomingCall | null>(null);

  const appQ = useApiQuery(['integrations', 'app', idOrCode], () => getAppByIdOrCode(idOrCode), { enabled: ready });
  // Настоящий id — после того как карточка нашлась (по id или по code); до этого подключения не запрашиваем
  const appId = appQ.data?.id ?? idOrCode;
  const currentLocationId = activeLocationId && activeLocationId !== 'all' ? activeLocationId : locationIds[0];
  const installQ = useApiQuery(['integrations', 'install', appId, currentLocationId], () => getInstall(appId, currentLocationId!), {
    enabled: ready && Boolean(currentLocationId) && Boolean(appQ.data),
  });
  const liveLocationsQ = useApiQuery(
    ['integrations', 'liveInstallLocations', appId, locationIds.join(',')],
    () => listLiveInstallLocationIds(appId, locationIds),
    { enabled: ready && locationIds.length > 0 && Boolean(appQ.data) },
  );
  const availableLocationIds = useMemo(
    () => locationIds.filter((id) => !(liveLocationsQ.data ?? []).includes(id)),
    [locationIds, liveLocationsQ.data],
  );

  const connect = useApiMutation((args: { locationIds: string[]; scopes: RequestedScope[] }) =>
    connectApp({ appId, businessId: businessId!, locationIds: args.locationIds, scopes: args.scopes }),
  );
  const checkCall = useApiMutation(() => demoIncomingCall(businessId!));
  const refund = useApiMutation((installId: string) => refundLastPartnerPayment(installId));

  const handleCheckCall = async () => {
    try {
      const call = await checkCall.mutate(undefined);
      setActiveCall(call);
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const handleRefund = async () => {
    if (!install) return;
    try {
      await refund.mutate(install.id);
      toast.success(t('app.payments.refundedToast'));
      installQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const app = appQ.data;
  const install = installQ.data;
  const isLive = install ? isInstallLive(install.status) : false;

  const relatedFaq = useMemo(() => app?.faq ?? [], [app]);

  // QA 30.09: несуществующее приложение (старая ссылка, удалённая карточка) — «не нашли», а не «проверьте соединение»
  if (appQ.isError && appQ.error instanceof ApiError && appQ.error.code === 'not_found') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={t('directLink.notFoundTitle')}
          description={t('directLink.notFoundText')}
          action={<LinkButton href="/biz/integrations">{t('directLink.notFoundAction')}</LinkButton>}
        />
      </div>
    );
  }
  if (appQ.isError) return <ErrorState onRetry={() => appQ.refetch()} />;
  if (appQ.isLoading || !app) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Skeleton lines={2} />
        <Skeleton lines={8} />
      </div>
    );
  }

  const Icon = APP_ICON[appIconKey(app)];
  const tile = appTileTone(app.id);

  const handleConnect = async (locIds: string[], scopes: RequestedScope[]) => {
    try {
      const created = await connect.mutate({ locationIds: locIds, scopes });
      setConnectOpen(false);
      // И1: партнёр ещё не активировал — это заявка, а не «подключено»
      const allLive = created.length > 0 && created.every((i) => i.status === 'connected');
      toast.success(allLive ? t('connect.connectedToast') : t('connect.requestSentToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/biz/integrations/e/${app.code}`);
      toast.success(t('app.linkCopied'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const canConnectApp = !app.builtin && canPersonaConnect(app, persona);

  const tabs = [
    { value: 'info', label: t('app.tabs.info') },
    { value: 'reviews', label: t('app.tabs.reviews'), badge: app.reviewsCount || undefined },
    ...(app.plans?.length ? [{ value: 'pricing', label: t('app.tabs.pricing') }] : []),
    // И1: вкладка «Настройки» — только у приложений со своими настройками и только после подключения
    ...(isLive && install?.status === 'connected' && appHasOwnSettings(app) ? [{ value: 'settings', label: t('app.tabs.settings') }] : []),
  ];

  return (
    <div
      // b04: карточки-каталога без отдельной механики рендерятся этим же общим экраном (данные — в
      // src/mock/slices/integrations.ts), поэтому их F-id стоят здесь же, на корне карточки.
      data-f="F-13-008 F-13-109 F-13-112 F-13-113 F-13-114 F-13-115 F-13-116 F-13-117 F-13-118 F-13-119 F-13-121 F-13-131 F-13-132 F-13-133 F-13-134 F-13-135 F-13-136 F-13-177 F-13-179 F-13-180 F-13-182 F-13-183 F-13-099 F-13-100 F-13-101 F-13-102 F-13-103 F-13-104 F-13-189 F-13-191 F-13-192 F-13-194 F-13-195 F-13-196 F-13-197 F-13-198 F-13-200 F-13-204 F-13-205 F-13-206 F-14-174 F-02-101 F-06-192"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
    >
      <PageHeader
        back={{ href: fromHref ?? `/biz/integrations/category/${app.categoryId}` }}
        breadcrumbs={[
          { label: t('hub.title'), href: '/biz/integrations' },
          { label: t(`category.${app.categoryId}.title` as never), href: `/biz/integrations/category/${app.categoryId}` },
        ]}
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: tile.fill, color: tile.ink }} aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            {app.name}
            {!app.countries.includes('AM') && !app.builtin && (
              <Badge tone="neutral" variant="outline" size="sm" data-f="F-13-154 F-13-166">
                {t(`country.tags.${app.countries[0].toLowerCase()}` as never)}
              </Badge>
            )}
          </span>
        }
        description={app.subtitle}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted" data-f="F-13-026">
            {app.websiteUrl && (
              <a
                href={app.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 underline decoration-border-strong underline-offset-2"
              >
                {t('app.partnerSite')} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-11 items-center gap-1 underline decoration-border-strong underline-offset-2"
              data-f="F-13-013"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden /> {t('app.copyLink')}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_260px]">
        <div className="order-2 md:order-1">
          <Tabs items={tabs} value={tab} onValueChange={setTab} />
          <div className="mt-4">
            {tab === 'info' && <AppInfoTab app={app} faq={relatedFaq} />}
            {tab === 'reviews' && <AppReviewsTab appId={app.id} businessId={businessId} installed={isLive} />}
            {tab === 'pricing' && <AppPricingTab app={app} />}
            {tab === 'settings' && install && <AppSettingsTab app={app} install={install} onInstallChange={() => installQ.refetch()} />}
          </div>
        </div>

        <div className="order-1 flex flex-col gap-4 md:order-2">
          {app.price.model !== 'none' && (
            <Card data-f="F-13-009 F-13-022" className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('app.priceLabel')}</p>
              <p className="text-lg font-semibold text-fg">{priceLine(app, t, money)}</p>
              {paysPartnerDirectly(app) && <p className="text-xs text-muted">{t('app.paysPartner')}</p>}
              {app.armeniaManualNote && <p className="text-xs text-muted">{t('category.payments.armenia.note')}</p>}
              {app.tipsQuestionNote && (
                <p className="text-xs text-muted" data-f="F-13-200">
                  {t('app.tipsQuestionNote')}
                </p>
              )}
            </Card>
          )}

          {app.telephonyPbx && (
            <Card data-f="F-13-093 F-01-202 F-01-203" className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('call.checkTitle')}</p>
              <Button variant="secondary" leftIcon={<Phone aria-hidden />} loading={checkCall.isPending} onClick={handleCheckCall}>
                {t('call.checkCta')}
              </Button>
            </Card>
          )}

          {app.channels && app.channels.length > 0 && (
            <Card data-f="F-13-010" className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('app.channelsLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {app.channels.map((ch) => (
                  <Badge key={ch} variant="soft">
                    {t(`channels.${ch}` as never)}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <AppActionCard
            app={app}
            install={install}
            can={can}
            canConnectApp={canConnectApp}
            onConnect={() => {
              setConnectKey((k) => k + 1);
              setConnectOpen(true);
            }}
          />

          {!app.builtin && install && (install.paidUntil || (install.paymentHistory?.length ?? 0) > 0) && (
            <Card data-f="F-13-043 F-13-044" className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('app.payments.title')}</p>
              {install.paidUntil && (
                <KeyValueList columns={1} items={[{ label: t('app.payments.paidUntil'), value: date(install.paidUntil, 'long') }]} />
              )}
              {(install.paymentHistory?.length ?? 0) > 0 && (
                <ul className="flex flex-col gap-1.5 text-xs text-muted">
                  {install
                    .paymentHistory!.slice(-3)
                    .reverse()
                    .map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span>{date(p.createdAt, 'long')}</span>
                        <span>
                          {p.currency === 'AMD' ? money(p.amount) : `${p.amount} ${p.currency}`}
                          {p.refundedAt ? ` · ${t('app.payments.refunded')}` : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              {canRefundLastPayment(install.paymentHistory) && (
                <Button variant="ghost" size="sm" loading={refund.isPending} onClick={handleRefund} className="self-start">
                  {t('app.payments.refundCta')}
                </Button>
              )}
            </Card>
          )}

          {/* F-13-011: показываем рейтинг только когда есть реальные отзывы — иначе цифра расходится
              с пустой вкладкой «Отзывы» (было: app.rating > 0, а рейтинг генерировался всегда). */}
          {app.reviewsCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <Star className="h-4 w-4 fill-warning text-warning" aria-hidden />
              {app.rating.toFixed(1)} · {t('reviewsCountShort', { count: app.reviewsCount })}
            </div>
          )}
        </div>
      </div>

      {currentLocationId && (
        <ConnectSheet
          key={connectKey}
          app={app}
          open={connectOpen}
          onOpenChange={setConnectOpen}
          availableLocationIds={availableLocationIds}
          submitting={connect.isPending}
          onConfirm={handleConnect}
        />
      )}

      {activeCall && <IncomingCallCard call={activeCall} onClose={() => setActiveCall(null)} />}
    </div>
  );
}

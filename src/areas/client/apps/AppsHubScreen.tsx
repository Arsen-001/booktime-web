'use client';

/**
 * Хаб «Приложения» в кабинете бизнеса (F-14-002, F-14-003, F-14-080, F-14-082, F-14-084, F-14-139, F-14-140).
 * По решению пользователя общее приложение клиента — центр продукта; отдельная «реклама приложения» бизнесу
 * не нужна, но ссылка «Скачать приложение для клиентов» (QR, ссылка на сторы) — полезна для стойки (F-14-003).
 */
import {
  Apple,
  BadgePercent,
  BarChart3,
  Banknote,
  CalendarRange,
  Gift,
  Globe,
  Megaphone,
  Rocket,
  Rss,
  Smartphone,
  Sparkles,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { getCashbackVisibleForBusiness, setCashbackVisibleForBusiness } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { qrPreviewSvg } from '@/areas/client/apps/qrPreview';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useHideDigitalPurchases } from '@/lib/native/useNativeApp';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { PermissionGate } from '@/ui/PermissionGate';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const CLIENT_APP_URL = 'https://luckybooking.am';

export function AppsHubScreen() {
  const t = useT('client');
  const toast = useToast();
  // Сторис и продвижение покупаются за монеты — в приложениях iOS/Android их нет (App Store 3.1.1)
  const hidePurchases = useHideDigitalPurchases();
  const { ready, businessId } = useCurrent();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(CLIENT_APP_URL);
      toast.success(t('apps.hub.linkCopied'));
    } catch {
      toast.info(t('apps.hub.linkCopyFailed', { link: CLIENT_APP_URL }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('apps.hub.title')} description={t('apps.hub.subtitle')} />

      <div data-f="F-14-003">
        <SectionCard title={t('apps.hub.tellClientsTitle')} description={t('apps.hub.tellClientsHint')}>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img
              src={qrPreviewSvg(CLIENT_APP_URL)}
              alt={t('apps.hub.qrAlt')}
              className="size-32 shrink-0 rounded-lg border border-border bg-surface-2 p-2"
            />
            <div className="flex flex-1 flex-col gap-2">
              <p className="break-all rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">{CLIENT_APP_URL}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void copyLink()}>
                  {t('apps.hub.copyLink')}
                </Button>
                <LinkButton size="sm" variant="ghost" href="/" target="_blank">
                  {t('apps.hub.openApp')}
                </LinkButton>
              </div>
              <p className="text-xs text-muted">{t('apps.hub.qrHint')}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-14-001 F-14-005 F-14-166" className="grid gap-3 sm:grid-cols-3">
        <Card padding="sm" className="flex flex-col gap-1 bg-surface-2">
          <p className="text-xs font-medium text-muted">{t('apps.hub.threeApps.client.title')}</p>
          <p className="text-sm text-fg">{t('apps.hub.threeApps.client.text')}</p>
          <Badge tone="success" variant="soft" className="mt-1 w-fit">
            {t('apps.hub.threeApps.client.free')}
          </Badge>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1 bg-surface-2">
          <p className="text-xs font-medium text-muted">{t('apps.hub.threeApps.business.title')}</p>
          <p className="text-sm text-fg">{t('apps.hub.threeApps.business.text')}</p>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1 bg-surface-2">
          <p className="text-xs font-medium text-muted">{t('apps.hub.threeApps.branded.title')}</p>
          <p className="text-sm text-fg">{t('apps.hub.threeApps.branded.text')}</p>
        </Card>
        <p className="col-span-full text-xs text-muted">{t('apps.hub.positioningHint')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PermissionGate permission="billing.manage">
          <Card data-f="F-14-142 F-14-144" href="/biz/apps/branded" interactive padding="md" className="flex items-start gap-3">
            <Rocket aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileBrandedTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileBrandedHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        {/* Сторис публикует и мастер салона — свои (владелец, 01.10.2026) */}
        {!hidePurchases && (
          <PermissionGate permission="journal.view">
            <Card data-f="F-00-159" href="/biz/apps/stories" interactive padding="md" className="flex items-start gap-3">
              <Sparkles aria-hidden className="size-6 shrink-0 text-primary-text" />
              <div>
                <p className="font-medium text-fg">{t('apps.hub.tileStoriesTitle')}</p>
                <p className="text-sm text-muted">{t('apps.hub.tileStoriesHint')}</p>
              </div>
            </Card>
          </PermissionGate>
        )}
        <PermissionGate permission="notify.mailings">
          <Card data-f="F-00-114" href="/biz/apps/news" interactive padding="md" className="flex items-start gap-3">
            <Rss aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileNewsTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileNewsHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        {!hidePurchases && (
          <PermissionGate permission="billing.manage">
            <Card data-f="F-00-103 F-00-167" href="/biz/apps/promotion" interactive padding="md" className="flex items-start gap-3">
              <Megaphone aria-hidden className="size-6 shrink-0 text-primary-text" />
              <div>
                <p className="font-medium text-fg">{t('apps.hub.tilePromotionTitle')}</p>
                <p className="text-sm text-muted">{t('apps.hub.tilePromotionHint')}</p>
              </div>
            </Card>
          </PermissionGate>
        )}
        <PermissionGate permission="clients.phones">
          <Card data-f="F-00-121" href="/biz/apps/reminders" interactive padding="md" className="flex items-start gap-3">
            <Smartphone aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileRemindersTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileRemindersHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        <PermissionGate permission="journal.view">
          <Card data-f="F-14-092" href="/biz/apps/visit" interactive padding="md" className="flex items-start gap-3">
            <Banknote aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileVisitTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileVisitHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        <PermissionGate permission="staff.view">
          <Card data-f="F-14-116" href="/biz/apps/team" interactive padding="md" className="flex items-start gap-3">
            <Users aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileTeamTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileTeamHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        <PermissionGate permission="journal.view">
          <Card data-f="F-14-106" href="/biz/apps/events" interactive padding="md" className="flex items-start gap-3">
            <CalendarRange aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileEventsTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileEventsHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        <Card data-f="F-14-122" href="/biz/apps/reports" interactive padding="md" className="flex items-start gap-3">
          <BarChart3 aria-hidden className="size-6 shrink-0 text-primary-text" />
          <div>
            <p className="font-medium text-fg">{t('apps.hub.tileReportsTitle')}</p>
            <p className="text-sm text-muted">{t('apps.hub.tileReportsHint')}</p>
          </div>
        </Card>
        <PermissionGate permission="services.view">
          <Card data-f="F-14-114 F-14-115" href="/biz/apps/services" interactive padding="md" className="flex items-start gap-3">
            <Tag aria-hidden className="size-6 shrink-0 text-primary-text" />
            <div>
              <p className="font-medium text-fg">{t('apps.hub.tileServicesTitle')}</p>
              <p className="text-sm text-muted">{t('apps.hub.tileServicesHint')}</p>
            </div>
          </Card>
        </PermissionGate>
        <Card data-f="F-14-127" href="/biz/apps/payroll" interactive padding="md" className="flex items-start gap-3">
          <Wallet aria-hidden className="size-6 shrink-0 text-primary-text" />
          <div>
            <p className="font-medium text-fg">{t('apps.hub.tilePayrollTitle')}</p>
            <p className="text-sm text-muted">{t('apps.hub.tilePayrollHint')}</p>
          </div>
        </Card>
      </div>

      <PermissionGate permission="loyalty.rules">
        <div data-f="F-14-053">
          <CashbackVisibilityCard ready={ready} businessId={businessId} />
        </div>
      </PermissionGate>

      <div data-f="F-14-004 F-14-175 F-14-176">
        <SectionCard title={t('apps.hub.relatedTitle')}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            <li className="flex items-start gap-2">
              <Gift aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
              {t('apps.hub.relatedMarketplace')}
            </li>
            <li className="flex items-start gap-2">
              <BadgePercent aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
              {t('apps.hub.relatedWallet')}
            </li>
            <li className="flex items-start gap-2">
              <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
              {t('apps.hub.relatedThirdParty')}
            </li>
          </ul>
        </SectionCard>
      </div>

      <div data-f="F-14-080 F-14-002">
        <SectionCard title={t('apps.hub.downloadTitle')} description={t('apps.hub.downloadHint')}>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<Apple aria-hidden />} disabled>
              App Store
            </Button>
            <Button variant="secondary" leftIcon={<Globe aria-hidden />} disabled>
              Google Play
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">{t('apps.hub.downloadSoon')}</p>
        </SectionCard>
      </div>

      <div data-f="F-14-173">
        <Card padding="sm" className="flex items-start gap-2 bg-surface-2 text-sm text-muted">
          <Megaphone aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t('apps.hub.pushVsSmsHint')}</span>
        </Card>
      </div>

      <div data-f="F-14-082">
        <SectionCard title={t('apps.hub.capabilitiesTitle')}>
          <ul className="flex flex-col gap-1.5 text-sm text-fg">
            {(t.raw('apps.hub.capabilitiesList') as string[]).map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-primary-text">
                  •
                </span>
                {line}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div data-f="F-14-084">
        <SectionCard title={t('apps.hub.navigationTitle')} description={t('apps.hub.navigationHint')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div data-f="F-14-139">
          <SectionCard title={t('apps.hub.webOnlyTitle')}>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {(t.raw('apps.hub.webOnlyList') as string[]).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </SectionCard>
        </div>
        <div data-f="F-14-140">
          <SectionCard title={t('apps.hub.appOnlyTitle')}>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {(t.raw('apps.hub.appOnlyList') as string[]).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <p className="text-center text-sm text-muted">
        {t('apps.hub.translationsHint')}{' '}
        <Link
          href="/biz/apps/translations"
          className="inline-flex min-h-10 items-center font-medium text-primary-text hover:underline"
        >
          {t('apps.hub.translationsLink')}
        </Link>
      </p>
    </div>
  );
}

/** «Показывать кэшбэк в приложении клиента» — переключатель типа карты (F-14-053) */
function CashbackVisibilityCard({ ready, businessId }: { ready: boolean; businessId?: string }) {
  const t = useT('client');
  const toast = useToast();
  const q = useApiQuery(['cashback-visible', businessId], () => getCashbackVisibleForBusiness(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const setVisible = useApiMutation(({ visible }: { visible: boolean }) => setCashbackVisibleForBusiness(businessId!, visible));

  // До данных — та же карточка, переключатель выключен (заголовок и подписи известны заранее)
  const loading = !ready || q.isLoading;
  return (
    <SectionCard title={t('apps.hub.cashbackVisibilityTitle')} description={t('apps.hub.cashbackVisibilityHint')}>
      <Switch
        labelPosition="start"
        label={t('apps.hub.cashbackVisibilityLabel')}
        checked={q.data ?? true}
        disabled={loading}
        onCheckedChange={(v) =>
          void setVisible
            .mutate({ visible: v })
            .then(() => {
              void q.refetch();
              toast.success(v ? t('apps.hub.cashbackShown') : t('apps.hub.cashbackHidden'));
            })
        }
      />
    </SectionCard>
  );
}

'use client';

/**
 * /biz/settings/mobile-app — «Мобильные приложения» (F-03-048, F-14-164, F-14-171, В-29 из ANSWERS.md):
 * своя ссылка салона (F-00-006, уже есть в «Онлайн-запись → Ссылки») + значок на экран телефона (приложение
 * уже устанавливаемое — src/app/manifest.ts) — и своё брендированное приложение в App Store и Google Play,
 * которое остаётся будущей платной услугой: карточка «скоро» с кнопкой «Оставить заявку» в моковую базу.
 */
import { useState } from 'react';
import { Copy, Eye, PlusSquare, Rocket, Send, Share, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { coreList } from '@/api/core';
import { listLinks } from '@/api/online';
import { createMobileAppOrderRequest, listMobileAppOrderRequests } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { copyText } from '@/areas/online/links/copyText';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function MobileAppsScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const [copied, setCopied] = useState(false);

  const businessQ = useApiQuery(
    ['settings', 'mobileApp', 'business', businessId],
    async () => {
      const [businesses, links] = await Promise.all([
        coreList('businesses', { id: businessId! }),
        listLinks(businessId!),
      ]);
      return { business: businesses[0], links };
    },
    { enabled: ready && Boolean(businessId) },
  );
  const requestsQ = useApiQuery(
    ['settings', 'mobileApp', 'requests', businessId],
    () => listMobileAppOrderRequests(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  const order = useApiMutation(createMobileAppOrderRequest, {
    invalidates: [['settings', 'mobileApp', 'requests', businessId]],
  });

  // До ответа — та же страница: ссылка полосой, кнопки выключены (DESIGN.md «The skeleton IS the page»)
  const loading = !ready || businessQ.isLoading || requestsQ.isLoading;
  if (!loading && (businessQ.isError || requestsQ.isError || !businessQ.data?.business)) {
    return <ErrorState onRetry={() => { businessQ.refetch(); requestsQ.refetch(); }} />;
  }

  const business = businessQ.data?.business;
  const links = businessQ.data?.links ?? [];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const primary = links.find((l) => l.primary);
  const publicUrl = business ? `${origin}/b/${business.slug}${primary || !links.length ? '' : `/f/${links[0].formId}`}` : '';
  const lastRequest = requestsQ.data?.[0];

  const copy = async () => {
    if (await copyText(publicUrl)) {
      setCopied(true);
      toast.success(t('mobileApp.link.copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(t('mobileApp.link.copyFailed'));
    }
  };

  const submitOrder = async () => {
    if (!businessId || !staffId) return;
    try {
      await order.mutate({ businessId, authorStaffId: staffId });
      toast.success(t('mobileApp.own.sent'));
    } catch {
      toast.error(t('mobileApp.own.sendFailed'));
    }
  };

  return (
    <div data-f="F-03-048 F-14-164 F-14-171" aria-busy={loading || undefined} className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('mobileApp.title')} description={t('mobileApp.description')} back={{ href: '/biz/settings' }} />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Smartphone aria-hidden className="size-4 shrink-0 text-muted" />
            {t('mobileApp.link.title')}
          </span>
        }
        description={t('mobileApp.link.description')}
      >
        <div data-f="F-00-006" className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <a
            href={publicUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-10 min-w-0 flex-1 items-center truncate text-sm text-primary-text hover:underline"
          >
            {loading ? <SkeletonText width="30ch" /> : publicUrl.replace(/^https?:\/\//, '')}
          </a>
          <IconButton
            icon={<Copy aria-hidden />}
            label={copied ? t('mobileApp.link.copied') : t('mobileApp.link.copy')}
            size="sm"
            onClick={copy}
            disabled={loading}
          />
          <IconButton
            icon={<Eye aria-hidden />}
            label={t('mobileApp.link.preview')}
            size="sm"
            onClick={() => window.open(publicUrl, '_blank', 'noopener')}
            disabled={loading}
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          {t('mobileApp.link.moreHint')}{' '}
          <Link href="/biz/online" className="text-primary-text hover:underline">
            {t('mobileApp.link.moreLink')}
          </Link>
        </p>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <PlusSquare aria-hidden className="size-4 shrink-0 text-muted" />
            {t('mobileApp.homescreen.title')}
          </span>
        }
        description={t('mobileApp.homescreen.description')}
      >
        <ol className="flex flex-col gap-3 text-sm text-fg">
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text">1</span>
            <span className="flex-1">
              {t('mobileApp.homescreen.iosStep')}{' '}
              <Share aria-hidden className="inline size-4 align-text-bottom text-muted" />
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text">2</span>
            <span className="flex-1">{t('mobileApp.homescreen.androidStep')}</span>
          </li>
        </ol>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Rocket aria-hidden className="size-4 shrink-0 text-muted" />
            {t('mobileApp.own.title')}
            <Badge tone="accent" size="sm">
              {t('mobileApp.own.badge')}
            </Badge>
          </span>
        }
        description={t('mobileApp.own.description')}
      >
        <p className="text-sm text-muted">{t('mobileApp.own.details')}</p>
        {lastRequest ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-fg">
            <Badge tone="success">{t('mobileApp.own.requestSent')}</Badge>
            <span className="text-muted">{format.date(lastRequest.createdAt)}</span>
          </div>
        ) : (
          <Button
            leftIcon={<Send aria-hidden />}
            loading={order.isPending}
            disabled={loading}
            onClick={submitOrder}
            className="mt-4"
          >
            {t('mobileApp.own.cta')}
          </Button>
        )}
      </SectionCard>
    </div>
  );
}

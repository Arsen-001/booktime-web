'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Flame, Snowflake } from 'lucide-react';
import { findRenewTemplate, getDefaultNetworkLocation, getMembership, purchaseMembership, toggleMembershipAutoRenew, toggleMembershipFreeze } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { daysUntil } from '@/areas/client/loyalty/loyaltyDates';
import { NetworkLocationModal } from '@/areas/client/network/NetworkLocationModal';
import { PurchaseStatusBadge, PurchaseStatusCard } from '@/areas/client/purchases/PurchaseStatusCard';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/** Карточка абонемента: визиты, срок, заморозка, кнопки (F-14-038, F-14-039, F-14-045) */
export function MembershipDetailScreen({ membershipId }: { membershipId: Id }) {
  const t = useT('client');
  const locale = useLocale();
  const router = useRouter();
  const fmt = useClientFormat();
  const { ready, appUserId } = useCurrent();
  const toast = useToast();
  const q = useApiQuery(['membership', membershipId, appUserId], () => getMembership(membershipId, appUserId), {
    enabled: ready,
  });
  const freeze = useApiMutation((id: Id) => toggleMembershipFreeze(id, appUserId!));
  const autoRenewMut = useApiMutation((id: Id) => toggleMembershipAutoRenew(id, appUserId!));
  const renew = useApiMutation(async (m: NonNullable<typeof q.data>) => {
    const tpl = await findRenewTemplate(m.businessId, m.title);
    if (!tpl) return undefined;
    return purchaseMembership(appUserId!, tpl.id);
  });
  const [pickLocationOpen, setPickLocationOpen] = useState(false);
  const networkId = q.data?.network?.networkId;
  const defaultLocationQ = useApiQuery(
    ['default-network-location', appUserId ?? '', networkId ?? ''],
    () => getDefaultNetworkLocation(appUserId, networkId!),
    { enabled: ready && Boolean(appUserId) && Boolean(networkId) },
  );

  if (!ready || q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-32 rounded-2xl" />
        <Skeleton variant="rect" className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const m = q.data;
  if (!m)
    return (
      <EmptyState
        title={t('memberships.notFound')}
        action={<LinkButton href="/memberships">{t('memberships.title')}</LinkButton>}
      />
    );

  const daysLeft = daysUntil(m.validUntil);
  const expiringSoon = m.visitsLeft <= 1 || daysLeft <= 5;
  const canFreeze = m.frozen || m.freezeDaysAvailable !== undefined;

  const handleFreeze = async () => {
    try {
      await freeze.mutate(m.id);
      toast.success(m.frozen ? t('memberships.unfrozenToast') : t('memberships.frozenToast'));
      void q.refetch();
    } catch {
      toast.error(t('memberships.actionFailed'));
    }
  };

  const goToBooking = (businessId: Id) => router.push(`/book?business=${businessId}`);

  const handleBook = () => {
    if (m.network) {
      setPickLocationOpen(true);
      return;
    }
    goToBooking(m.businessId);
  };

  const handlePickLocation = (businessId: Id) => {
    setPickLocationOpen(false);
    goToBooking(businessId);
  };

  const handleAutoRenew = async () => {
    try {
      await autoRenewMut.mutate(m.id);
      toast.success(m.autoRenew ? t('memberships.autoRenewOffToast') : t('memberships.autoRenewOnToast'));
      void q.refetch();
    } catch {
      toast.error(t('memberships.actionFailed'));
    }
  };

  const handleRenew = async () => {
    try {
      const purchased = await renew.mutate(m);
      if (purchased) {
        toast.success(t('memberships.renewed'));
        router.push(`/memberships/${purchased.id}`);
      } else {
        toast.info(t('memberships.renewedToSale'));
        router.push(`/places/${m.businessId}`);
      }
    } catch {
      toast.error(t('memberships.actionFailed'));
    }
  };

  return (
    <div data-f="F-14-038" className="flex flex-col gap-5 pb-6">
      <PageHeader back={{ href: '/memberships' }} title={pickText(m.title, locale)} />

      {m.imageUrl && (
        <div data-f="F-14-041" className="relative h-40 w-full overflow-hidden rounded-2xl">
          <Image src={m.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 480px" className="object-cover" unoptimized />
        </div>
      )}

      <Card padding="md">
        <div className="flex items-center gap-3">
          <Avatar name={m.businessName} src={m.businessLogoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-fg">{m.businessName}</p>
            <p className="text-sm text-muted">{t('memberships.number', { number: m.number })}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {m.frozen && (
            <Badge tone="info" variant="soft">
              <Snowflake aria-hidden className="mr-1 size-3.5" />
              {t('memberships.frozen')}
            </Badge>
          )}
          {expiringSoon && !m.frozen && (
            <Badge tone="warning" variant="soft">
              <Flame aria-hidden className="mr-1 size-3.5" />
              {t('memberships.expiringSoon')}
            </Badge>
          )}
          {m.purchaseStatus === 'confirmed' && !m.active && (
            <Badge tone="neutral" variant="soft">
              {t('memberships.usedUp')}
            </Badge>
          )}
          <PurchaseStatusBadge status={m.purchaseStatus} />
        </div>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Row label={t('memberships.visitsLeftLabel')} value={t('memberships.visitsLeft', { left: m.visitsLeft, total: m.visitsTotal })} />
          <Row label={t('memberships.validUntilLabel')} value={fmt.date(m.validUntil, 'long')} />
          {m.freezeDaysAvailable !== undefined && (
            <Row label={t('memberships.freezeDaysLabel')} value={t('memberships.freezeDays', { days: m.freezeDaysAvailable })} />
          )}
          {m.serviceNames.length > 0 && <Row label={t('memberships.services')} value={m.serviceNames.join(', ')} />}
        </dl>
      </Card>

      {m.purchaseStatus === 'confirmed' && m.active && (
        <Card data-f="F-14-047" padding="md" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-fg">{t('memberships.autoRenewTitle')}</p>
              <p className="text-sm text-muted">{m.autoRenew ? t('memberships.autoRenewOnHint') : t('memberships.autoRenewOffHint')}</p>
            </div>
            <Button
              size="sm"
              variant={m.autoRenew ? 'outline' : 'secondary'}
              loading={autoRenewMut.isPending}
              onClick={() => void handleAutoRenew()}
            >
              {m.autoRenew ? t('memberships.autoRenewCancel') : t('memberships.autoRenewEnable')}
            </Button>
          </div>
          {m.autoRenew && daysLeft <= 3 && (
            <Badge tone="warning" variant="soft" className="w-fit">
              {t('memberships.autoRenewSoon', { days: Math.max(0, daysLeft) })}
            </Badge>
          )}
        </Card>
      )}

      {m.purchaseStatus !== 'confirmed' && (
        <PurchaseStatusCard
          kind="membership"
          id={m.id}
          appUserId={appUserId}
          businessId={m.businessId}
          price={m.price}
          status={m.purchaseStatus}
          paymentSentAt={m.paymentSentAt}
          onChanged={() => void q.refetch()}
        />
      )}

      {m.purchaseStatus === 'confirmed' && (
        <div className="flex flex-col gap-3">
          {m.active && (
            <Button data-f="F-14-039" onClick={handleBook} fullWidth>
              {t('memberships.book')}
            </Button>
          )}
          <Button data-f="F-14-045" variant="outline" onClick={() => void handleRenew()} loading={renew.isPending} fullWidth>
            {t('memberships.renew')}
          </Button>
          {canFreeze && (
            <Button variant="ghost" onClick={() => void handleFreeze()} loading={freeze.isPending} fullWidth>
              {m.frozen ? t('memberships.unfreeze') : t('memberships.freeze')}
            </Button>
          )}
        </div>
      )}

      {m.network && (
        <NetworkLocationModal
          open={pickLocationOpen}
          onOpenChange={setPickLocationOpen}
          network={m.network}
          initialBusinessId={defaultLocationQ.data ?? m.businessId}
          onConfirm={handlePickLocation}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}


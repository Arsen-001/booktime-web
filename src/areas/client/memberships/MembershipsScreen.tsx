'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Snowflake, Flame, User } from 'lucide-react';
import { listMemberships, type MembershipWithBusiness } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { LoginGate } from '@/areas/client/ui/GuestGate';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { daysUntil } from '@/areas/client/loyalty/loyaltyDates';
import { PurchaseStatusBadge } from '@/areas/client/purchases/PurchaseStatusCard';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';

/** Абонементы клиента — карточками (F-14-037) */
export function MembershipsScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(['memberships', appUserId], () => listMemberships(appUserId!), {
    enabled: ready && Boolean(appUserId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-14-037" className="flex flex-col gap-5 pb-6">
      <PageHeader title={t('memberships.title')} />
      {ready && !appUserId ? (
        <LoginGate icon={<User aria-hidden className="size-8 text-muted" />} next="/memberships" />
      ) : !ready || q.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton variant="rect" className="h-40 rounded-2xl" />
          <Skeleton variant="rect" className="h-40 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<User aria-hidden className="size-8 text-muted" />}
          title={t('memberships.emptyTitle')}
          description={t('memberships.emptyHint')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pageItems.map((m) => (
              <MembershipCard key={m.id} membership={m} />
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

export function MembershipCard({ membership }: { membership: MembershipWithBusiness }) {
  const t = useT('client');
  const locale = useLocale();
  const fmt = useClientFormat();
  const daysLeft = daysUntil(membership.validUntil);
  const expiringSoon = membership.visitsLeft <= 1 || daysLeft <= 5;

  return (
    <Link href={`/memberships/${membership.id}`}>
      <Card interactive padding="none" className="flex flex-col gap-3 overflow-hidden">
        {membership.imageUrl && (
          <div data-f="F-14-041" className="relative h-28 w-full">
            <Image src={membership.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" unoptimized />
          </div>
        )}
        <div className={`flex flex-col gap-3 ${membership.imageUrl ? 'px-4 pb-4' : 'p-4'}`}>
          <div className="flex items-center gap-3">
            <span data-f="F-14-042">
              <Avatar name={membership.businessName} src={membership.businessLogoUrl} size="md" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{pickText(membership.title, locale)}</p>
              <p className="truncate text-sm text-muted">{membership.businessName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PurchaseStatusBadge status={membership.purchaseStatus} />
            {membership.frozen && (
              <Badge tone="info" variant="soft" data-f="F-14-038">
                <Snowflake aria-hidden className="mr-1 size-3.5" />
                {t('memberships.frozen')}
              </Badge>
            )}
            {expiringSoon && !membership.frozen && (
              <Badge tone="warning" variant="soft" data-f="F-14-038">
                <Flame aria-hidden className="mr-1 size-3.5" />
                {t('memberships.expiringSoon')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-fg">{t('memberships.visitsLeft', { left: membership.visitsLeft, total: membership.visitsTotal })}</p>
          <p className="text-sm text-muted">{t('memberships.validUntil', { date: fmt.date(membership.validUntil) })}</p>
        </div>
      </Card>
    </Link>
  );
}

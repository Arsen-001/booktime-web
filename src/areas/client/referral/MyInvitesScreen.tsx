'use client';

/**
 * /profile/invite — ⭐ «Пригласи подругу» в приложении клиента: своя ссылка в каждом салоне, где идёт программа, кого
 * пригласили и что с ними (есть запись → визит состоялся → бонус начислен), сколько бонусов получено.
 */
import { CalendarCheck, CircleCheck, Gift, Users, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { listMyReferrals, type MyReferralBusiness } from '@/api/referral';
import { useApiQuery } from '@/api/request';
import { InviteFriendCard, InviteFriendCardSkeleton } from '@/areas/client/referral/InviteFriendCard';
import { useCurrent } from '@/demo/hooks';
import { LoginGate } from '@/areas/client/ui/GuestGate';
import type { ReferralInviteeStatus } from '@/domain/rules/referral';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';

const STATUS: Record<ReferralInviteeStatus, { tone: BadgeTone; icon: ReactNode }> = {
  booked: { tone: 'info', icon: <CalendarCheck aria-hidden /> },
  visited: { tone: 'primary', icon: <CircleCheck aria-hidden /> },
  rewarded: { tone: 'success', icon: <Gift aria-hidden /> },
  cancelled: { tone: 'neutral', icon: <XCircle aria-hidden /> },
};

export function MyInvitesScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(['loyalty', 'my-referrals', appUserId ?? ''], () => listMyReferrals(appUserId ?? ''), { enabled: ready && Boolean(appUserId) });

  return (
    <div data-f="F-06-081 F-06-085" className="flex flex-col gap-6 pb-6">
      <PageHeader back={{ href: '/profile' }} title={t('referral.pageTitle')} description={t('referral.pageSubtitle')} />
      {ready && !appUserId ? (
        <LoginGate icon={<Gift />} next="/profile/invite" />
      ) : !ready || q.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy>
          <InviteFriendCardSkeleton />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Gift />}
          title={t('referral.emptyTitle')}
          description={t('referral.emptyText')}
          action={<LinkButton href="/search">{t('referral.emptyCta')}</LinkButton>}
        />
      ) : (
        q.data.map((b) => <BusinessInvites key={b.businessId} item={b} />)
      )}
    </div>
  );
}

function BusinessInvites({ item }: { item: MyReferralBusiness }) {
  const t = useT('client');
  const fmt = useFormat();
  return (
    <InviteFriendCard invite={item} title={item.businessName}>
      <div className="flex flex-col gap-2" aria-label={t('referral.invitedTitle')}>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <p className="text-sm font-semibold text-fg">{t('referral.invitedTitle')}</p>
          {item.bonusTotal > 0 && <Badge tone="success">{t('referral.bonusTotal', { amount: fmt.money(item.bonusTotal) })}</Badge>}
        </div>
        {item.invitees.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Users aria-hidden className="size-4 shrink-0" />
            {t('referral.invitedEmptyText')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {item.invitees.map((p, i) => (
              <li key={`${p.name}-${p.at}-${i}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{p.name}</p>
                  <p className="text-sm text-muted">{t('referral.invitedAt', { date: fmt.date(p.at, 'dayMonth') })}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={STATUS[p.status].tone} icon={STATUS[p.status].icon}>
                    {t(`referral.status.${p.status}`)}
                  </Badge>
                  {p.bonus > 0 && <span className="text-sm font-semibold text-success">+{fmt.money(p.bonus)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InviteFriendCard>
  );
}

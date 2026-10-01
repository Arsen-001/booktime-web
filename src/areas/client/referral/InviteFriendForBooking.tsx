'use client';

/** «Вы записаны» в приложении: своя ссылка в этом салоне, если у него включена «Пригласи подругу» */
import { getMyReferralInvite } from '@/api/referral';
import { useApiQuery } from '@/api/request';
import { InviteFriendCard, InviteFriendCardSkeleton } from '@/areas/client/referral/InviteFriendCard';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';

export function InviteFriendForBooking({ businessId }: { businessId: Id }) {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(['loyalty', 'referral-invite', appUserId ?? '', businessId], () => getMyReferralInvite(appUserId ?? '', businessId), {
    enabled: ready && Boolean(appUserId),
  });
  if (q.isLoading) return <InviteFriendCardSkeleton />;
  if (!q.data) return null;
  return <InviteFriendCard invite={q.data} title={t('referral.doneTitle')} />;
}

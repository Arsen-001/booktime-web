'use client';

/**
 * ⭐ «Пригласи подругу» на «Вы записаны» без входа (наше решение 01.10.2026): личная ссылка клиента этой записи — по
 * хэшу записи. Подруга записывается по ссылке — сервер сам привязывает её к пригласившей (не себя, только новый
 * клиент, один пригласивший); скидка и бонус — по настройкам рефералки салона при оплате её первого визита.
 */
import { Gift } from 'lucide-react';
import { getBookingReferralInvite, type ReferralInvite, type ReferralReward } from '@/api/referral';
import { useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { ShareLinkPanel } from '@/ui/ShareLinkPanel';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function InviteFriendCard({ bookingId, hash }: { bookingId: string; hash: string }) {
  const t = useT('online');
  const fmt = useFormat();
  const q = useApiQuery(['loyalty', 'booking-referral-invite', bookingId, hash], () => getBookingReferralInvite(bookingId, hash));
  if (q.isLoading) return <InviteFriendSkeleton />;
  const invite: ReferralInvite | null | undefined = q.data;
  if (!invite) return null;

  const inviteeReward = (r: ReferralReward | undefined) =>
    r ? (r.valueType === 'percent' ? t('confirmed.referral.inviteePercent', { value: r.value }) : t('confirmed.referral.inviteeFixed', { amount: fmt.money(r.value) })) : t('confirmed.referral.none');
  const referrerReward = (r: ReferralReward | undefined) =>
    r ? (r.valueType === 'percent' ? t('confirmed.referral.referrerPercent', { value: r.value }) : t('confirmed.referral.referrerFixed', { amount: fmt.money(r.value) })) : t('confirmed.referral.none');
  const url = typeof window === 'undefined' ? invite.path : `${window.location.origin}${invite.path}`;
  const reward = inviteeReward(invite.inviteeReward);

  return (
    <Card padding="md" className="flex flex-col gap-4" data-f="F-06-081 F-06-083" data-testid="invite-friend">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5">
          <Gift />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-semibold text-fg">{t('confirmed.referral.title')}</p>
          <p className="text-sm text-muted">{t('confirmed.referral.text', { invitee: reward, referrer: referrerReward(invite.referrerReward) })}</p>
        </div>
      </div>
      <ShareLinkPanel
        url={url}
        code={invite.code}
        message={t('confirmed.referral.message', { business: invite.businessName, reward, url })}
        telegramText={t('confirmed.referral.telegram', { business: invite.businessName, reward })}
      />
    </Card>
  );
}

function InviteFriendSkeleton() {
  return (
    <Card padding="md" className="flex flex-col gap-4" aria-busy>
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-semibold">
            <SkeletonText width="16ch" />
          </p>
          <p className="text-sm">
            <SkeletonText width="90%" />
          </p>
        </div>
      </div>
      <Skeleton variant="rect" className="h-11 rounded-md" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Skeleton variant="rect" className="col-span-2 h-11 rounded-md sm:col-span-1 md:h-10" />
        <Skeleton variant="rect" className="h-11 rounded-md sm:w-32 md:h-10" />
        <Skeleton variant="rect" className="h-11 rounded-md sm:w-32 md:h-10" />
      </div>
    </Card>
  );
}

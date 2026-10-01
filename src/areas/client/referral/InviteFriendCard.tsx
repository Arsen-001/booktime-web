'use client';

/**
 * ⭐ «Пригласи подругу» (наше решение 01.10.2026): личная ссылка клиента в салоне — на «Вы записаны» и в профиле.
 * Подруга записывается по ссылке — запись сама привязывает её к пригласившей (сервер проверяет: не себя, только
 * новый клиент, один пригласивший), скидка и бонус — по настройкам рефералки салона при оплате первого визита.
 */
import { Gift } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ReferralInvite } from '@/api/referral';
import { useReferralTexts } from '@/areas/client/referral/useReferralTexts';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { ShareLinkPanel } from '@/ui/ShareLinkPanel';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function InviteFriendCard({ invite, title, children }: { invite: ReferralInvite; title?: string; children?: ReactNode }) {
  const t = useT('client');
  const texts = useReferralTexts();
  return (
    <Card padding="md" className="flex flex-col gap-4 text-left" data-f="F-06-081 F-06-083" data-testid="invite-friend">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5">
          <Gift />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-semibold text-fg">{title ?? t('referral.cardTitle')}</p>
          <p className="text-sm text-muted">{texts.rewards(invite)}</p>
        </div>
      </div>
      <ShareLinkPanel url={texts.url(invite)} code={invite.code} message={texts.message(invite)} telegramText={texts.telegramText(invite)} />
      {children && <div className="border-t border-border pt-4">{children}</div>}
    </Card>
  );
}

/** Та же карточка до ответа сервера: место под заголовок, ссылку и три кнопки */
export function InviteFriendCardSkeleton() {
  return (
    <Card padding="md" className="flex flex-col gap-4 text-left" aria-busy>
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

'use client';

/** Профиль: вход в «Пригласи подругу» — сколько пригласили и сколько бонусов. Нет салонов с программой — не видно */
import { ChevronRight, Gift } from 'lucide-react';
import Link from 'next/link';
import { listMyReferrals } from '@/api/referral';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { SkeletonText } from '@/ui/Skeleton';

export function InviteFriendsEntry({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const fmt = useFormat();
  const q = useApiQuery(['loyalty', 'my-referrals', appUserId], () => listMyReferrals(appUserId));
  if (!q.isLoading && !q.data?.length) return null;
  const invited = (q.data ?? []).reduce((n, b) => n + b.invitees.length, 0);
  const bonus = (q.data ?? []).reduce((n, b) => n + b.bonusTotal, 0);
  return (
    <Link
      href="/profile/invite"
      data-f="F-06-081"
      data-testid="invite-entry"
      className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors duration-150 hover:bg-surface-2"
    >
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5">
        <Gift />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-fg">{t('referral.profileTitle')}</span>
        <span className="text-sm text-muted">
          {q.isLoading ? <SkeletonText width="24ch" /> : invited > 0 ? t('referral.profileStats', { count: invited, amount: fmt.money(bonus) }) : t('referral.profileText')}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

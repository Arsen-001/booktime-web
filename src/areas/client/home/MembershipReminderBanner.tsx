'use client';

import { Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { listPendingMembershipReminders, markMembershipReminderSeen } from '@/api/client-public';
import { useApiMutation, useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/**
 * Абонемент скоро закончится (F-14-046) — одно напоминание за раз. На телефоне колонкой (ux-r5 №3: заголовок сжимался
 * в 3 строки). «Продлить» открывает покупку того же типа на карточке места — с подтверждением суммы, а не молча.
 */
export function MembershipReminderBanner({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(clientKeys.membershipReminders(appUserId ?? ''), () => listPendingMembershipReminders(appUserId ?? ''), {
    enabled: Boolean(appUserId),
  });
  const seen = useApiMutation((id: Id) => markMembershipReminderSeen(id));
  const m = q.data?.[0];
  // Первая загрузка — баннер на месте (у демо-клиента он есть): заголовок и кнопки настоящие, текст — полосами
  const loading = q.isLoading;
  if (!m && !loading) return null;

  const hide = async () => {
    if (!m) return;
    try {
      await seen.mutate(m.id);
    } catch {
      toast.error(t('memberships.actionFailed'));
    }
  };

  const renew = () => {
    if (!m) return;
    void hide();
    if (!m.renewTemplateId) toast.info(t('memberships.renewedToSale'));
    router.push(m.renewTemplateId ? `/places/${m.businessId}?buy=${m.renewTemplateId}` : `/places/${m.businessId}`);
  };

  return (
    <div data-f="F-14-046" aria-busy={loading || undefined} className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning-soft/70 p-4 sm:flex-row sm:items-center">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-warning">
        <Ticket className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{t('home.reminderTitle')}</p>
        <p className="line-clamp-2 text-sm text-muted">
          {m ? t('home.reminderText', { title: pickText(m.title, locale), left: m.visitsLeft }) : <>
              {/* Телефон — две строки, шире — одна (как текст напоминания) */}
              <Skeleton lines={2} className="sm:hidden" />
              <SkeletonText width="48ch" className="max-sm:hidden" />
            </>}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={renew} disabled={!m}>
          {t('home.reminderRenew')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void hide()} loading={seen.isPending} disabled={!m}>
          {t('home.reminderLater')}
        </Button>
      </div>
    </div>
  );
}

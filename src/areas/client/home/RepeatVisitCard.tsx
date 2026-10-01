'use client';

import { RotateCcw } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getRepeatSuggestion } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id } from '@/domain/core';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';

/**
 * «Снова к Ани?» (ux-best-c2 №3, speed-k2 №2, F-00-118): прошлая услуга у того же мастера и его ближайшее окно —
 * кнопка ведёт в запись, где всё уже выбрано, остаётся «Подтвердить».
 */
export function RepeatVisitCard({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const fmt = useClientFormat();
  const locale = useLocale();
  const q = useApiQuery(['client', 'repeatSuggestion', appUserId ?? ''], () => getRepeatSuggestion(appUserId ?? ''), {
    enabled: Boolean(appUserId),
  });
  const s = q.data;
  if (!s) return null;
  const { booking, nextSlot } = s;
  const serviceId = booking.services[0]?.serviceId ?? '';
  const href = `/book?staff=${booking.staff.id}&service=${serviceId}${nextSlot ? `&slot=${encodeURIComponent(nextSlot.start)}` : ''}`;
  const firstName = nameOf(booking.staff.name).split(' ')[0];

  return (
    <Card data-f="F-00-118" padding="md" className="flex flex-wrap items-center gap-3">
      <Avatar name={booking.staff.name} src={booking.staff.avatarUrl} colorIndex={booking.staff.colorIndex} size="md" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">{t('home.repeat.title', { name: firstName })}</p>
        <p className="line-clamp-1 text-sm text-muted">
          {booking.service ? pickText(booking.service.name, locale) : ''}
          {nextSlot ? ` · ${t('home.repeat.next', { when: `${fmt.relativeDay(nextSlot.start)}, ${fmt.time(nextSlot.start)}` })}` : ''}
        </p>
      </div>
      <LinkButton href={href} size="sm" leftIcon={<RotateCcw aria-hidden />} className="max-sm:w-full">
        {t('home.repeat.cta')}
      </LinkButton>
    </Card>
  );
}


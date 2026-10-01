'use client';

import { CircleCheck, Hourglass, Wallet } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { Booking } from '@/domain/core';
import type { MasterCard, PublicService } from '@/api/client';
import { InviteFriendForBooking } from '@/areas/client/referral/InviteFriendForBooking';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { addMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { cn } from '@/lib/cn';
import { Avatar } from '@/ui/Avatar';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';

/**
 * Экран «Готово» после записи (ux-r1 №34, ux-r2 улучшение 1, ux-best-c1 №3): что будет дальше — словами по статусу,
 * карточка записи и следующие действия. Форма больше не показывается — второй раз записаться случайно нельзя.
 */
export function BookingDone({
  booking,
  card,
  service,
  membershipLeft,
}: {
  booking: Booking;
  card: MasterCard;
  service?: PublicService;
  membershipLeft?: { left: number; total: number };
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const locale = useLocale();
  const kind = booking.status === 'awaiting_prepayment' ? 'prepayment' : booking.status === 'awaiting_confirmation' ? 'pending' : 'booked';
  const Icon = kind === 'booked' ? CircleCheck : kind === 'pending' ? Hourglass : Wallet;
  const tone = kind === 'booked' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning';
  const place = card.locations.find((l) => l.id === booking.locationId) ?? card.locations[0];

  return (
    <div data-f="F-00-005 F-00-092 F-00-093" className="flex animate-rise flex-col items-center gap-6 py-4 text-center">
      <span aria-hidden className={cn('grid size-16 place-items-center rounded-full ring-8 ring-surface-2 [&_svg]:size-8', tone)}>
        <Icon />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-fg">{t(`book.done.${kind}.title`)}</h1>
        <p className="text-muted">
          {kind === 'prepayment' && booking.prepayment?.full
            ? t('book.done.prepayment.textFull', { amount: fmt.money(booking.prepayment.amount) })
            : t(`book.done.${kind}.text`)}
        </p>
        {kind === 'prepayment' && booking.prepayment?.reason === 'no_shows' && (
          <p className="text-sm text-muted" data-f="F-00-071">
            {t('book.prepayNoShowsWhy', { count: booking.prepayment.noShows ?? 2, months: booking.prepayment.months ?? 12 })}
          </p>
        )}
        {membershipLeft && (
          <p className="text-sm text-muted">{t('book.done.membership', { left: membershipLeft.left, total: membershipLeft.total })}</p>
        )}
      </div>
      <Card padding="md" className="flex w-full max-w-md items-center gap-3 text-left">
        <Avatar name={card.staff.name} src={card.staff.avatarUrl} colorIndex={card.staff.colorIndex} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold text-fg first-letter:uppercase">
            {fmt.relativeDay(booking.start)}, {fmt.time(booking.start)}–{fmt.time(addMinutes(booking.start, booking.durationMin))}
          </p>
          <p className="line-clamp-2 text-fg">
            {[service, ...booking.services.filter((l) => l.upsellOf).map((l) => card.services.find((x) => x.id === l.serviceId))]
              .filter((x): x is PublicService => Boolean(x))
              .map((x) => pickText(x.name, locale))
              .join(' + ')}
          </p>
          <p className="line-clamp-1 text-sm text-muted">
            {card.staff.name}
            {place && !('isHome' in place && place.isHome) && pickText(place.address, locale) ? ` · ${pickText(place.address, locale)}` : ''}
          </p>
        </div>
      </Card>
      <div className="flex w-full max-w-md flex-col gap-2">
        <LinkButton href={`/bookings/${booking.id}`} size="lg" fullWidth>
          {kind === 'prepayment' ? t('book.done.payCta') : t('book.done.openBooking')}
        </LinkButton>
        <LinkButton href="/" variant="ghost" fullWidth>
          {t('book.done.home')}
        </LinkButton>
      </div>
      <div className="w-full max-w-md">
        <InviteFriendForBooking businessId={booking.businessId} />
      </div>
    </div>
  );
}

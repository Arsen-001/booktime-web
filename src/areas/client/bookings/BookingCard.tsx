'use client';

import type { CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { ChevronRight, CircleCheck, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { EnrichedBooking } from '@/api/client';
import type { BookingStatus } from '@/domain/core';
import { AWAITING, bookingCardTone } from '@/areas/client/bookings/bookingTone';
import styles from '@/areas/client/bookings/bookingCard.module.css';
import { usePlaceLine } from '@/areas/client/ui/usePlaceLine';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { ClientStatusBadge } from '@/areas/client/ui/ClientStatusBadge';
import { LinkButton } from '@/ui/Button';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/** Статусы, которые требуют внимания клиента, — только у них метка (ux-r2 улучшение 2: «Подтверждена» и «Вы подтвердили» спорили) */
const ATTENTION: readonly BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment', 'cancelled_by_master', 'no_show'];
const CONFIRMED: readonly BookingStatus[] = ['scheduled', 'client_confirmed'];
const INACTIVE: readonly BookingStatus[] = ['cancelled_by_client', 'cancelled_by_master', 'no_show'];

export type BookingCardVariant = 'full' | 'compact';

/**
 * Запись клиента одной карточкой — в «Моих записях», на главной и на карточке места (ux-r2 №47: одинаковые вещи выглядят
 * одинаково). Тон карточки — цвет категории услуги (docs/design/DESIGN.md → «C · Тон», bookingTone.ts): владелец
 * прямо отверг «плоский блок» как «одноразовый, как везде» — время крупным тёмным тоном того же цвета, капля слева,
 * пунктир у «ждёт ответа». Прошедшая запись — с «Записаться снова».
 */
export function BookingCard({ booking, variant = 'full' }: { booking: EnrichedBooking; variant?: BookingCardVariant }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const placeLine = usePlaceLine();
  const { staff, business, service, location, status } = booking;
  const seats = booking.services[0]?.qty ?? 1;
  const isPast = status === 'arrived';
  const isInactive = INACTIVE.includes(status);
  const isAwaiting = AWAITING.includes(status);
  // У частного мастера название бизнеса = его имя — вместо него район (ux-r2 №18: «Лусине Погосян · Лусине Погосян»)
  const who =
    business.kind === 'individual'
      ? [nameOf(staff.name), location ? tc(`districts.${location.district}`) : undefined].filter(Boolean).join(' · ')
      : `${nameOf(staff.name)} · ${placeLine(business, location)}`;

  const tone = bookingCardTone(status, service?.categoryId);
  const toneVars = {
    '--tone-fill': tone.fill,
    '--tone-ink': tone.ink,
    '--tone-drop': tone.drop,
    '--tone-ring': tone.ring,
  } as CSSProperties;

  return (
    <div style={toneVars} className={cn(styles.card, 'overflow-hidden rounded-lg', isAwaiting && styles.pending, isInactive && 'opacity-80')}>
      <Link
        href={`/bookings/${booking.id}`}
        className="flex items-start gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span aria-hidden className={cn(styles.drop, 'mt-1 hidden size-4 shrink-0 rounded-full sm:block')} />
        <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            {CONFIRMED.includes(status) && <CircleCheck aria-hidden className={cn(styles.ink, 'size-4 shrink-0 translate-y-px')} />}
            <span className={cn(styles.ink, 'num-lg whitespace-nowrap', isInactive && 'line-through')}>{fmt.time(booking.start)}</span>
            <span className={cn(styles.ink, 'inline-block text-sm font-medium opacity-80 first-letter:uppercase')}>{fmt.relativeDay(booking.start)}</span>
          </span>
          {/* Одна строка (полное название — в записи): карточки одной высоты, скелетон совпадает (DESIGN.md «The skeleton IS the page») */}
          <span className="mt-0.5 line-clamp-1 font-semibold text-fg">{service ? pickText(service.name, locale) : t('bookings.serviceRemoved')}</span>
          <span className="line-clamp-1 text-sm text-muted">{who}</span>
          {(ATTENTION.includes(status) || booking.byMembership || (booking.groupEventId && seats > 1)) && (
            <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {ATTENTION.includes(status) && (
                <span className="inline-flex rounded-full bg-surface shadow-xs">
                  <ClientStatusBadge
                    status={status}
                    reason={booking.cancelReason}
                    paymentReported={Boolean(booking.prepayment?.clientMarkedPaidAt && !booking.prepayment.paid)}
                    size="sm"
                  />
                </span>
              )}
              {booking.groupEventId && seats > 1 && (
                <Badge tone="neutral" variant="soft" size="sm">
                  {t('bookings.seats', { count: seats })}
                </Badge>
              )}
              {booking.byMembership && (
                <span data-f="F-14-025" className="text-sm text-muted">
                  {t('bookings.paidByMembership')}
                </span>
              )}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0 self-center text-muted" />
      </Link>
      {variant === 'full' && isPast && (
        <div className="px-4 pb-4 pl-[4.25rem]">
          <LinkButton
            data-f="F-00-118"
            href={`/book?staff=${staff.id}&service=${booking.services[0]?.serviceId ?? ''}`}
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw aria-hidden />}
          >
            {t('bookings.bookAgain')}
          </LinkButton>
        </div>
      )}
    </div>
  );
}

/**
 * Скелетон карточки записи — та же разметка, что BookingCard (DESIGN.md «The skeleton IS the page»): капля, фото 40,
 * время крупно и день, услуга, «мастер · место», шеврон. Метки «ждёт ответа» — только у некоторых, в скелетоне их нет.
 */
export function BookingCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-lg bg-surface">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-1 hidden size-4 shrink-0 rounded-full skeleton-shimmer sm:block" />
        <Skeleton variant="circle" className="inline-flex size-10 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="num-lg whitespace-nowrap">
              <SkeletonText width="4ch" />
            </span>
            <span className="text-sm font-medium opacity-80">
              <SkeletonText width="8ch" />
            </span>
          </span>
          <span className="mt-0.5 line-clamp-1 font-semibold text-fg">
            <SkeletonText width="16ch" />
          </span>
          <span className="line-clamp-1 text-sm text-muted">
            <SkeletonText width="24ch" />
          </span>
        </span>
        <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0 self-center text-muted" />
      </div>
    </div>
  );
}

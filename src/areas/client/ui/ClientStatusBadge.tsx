'use client';

import type { BookingStatus } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeSize } from '@/ui/Badge';
import { BOOKING_STATUS_META } from '@/ui/BookingStatusBadge';

/**
 * Статус записи для клиента: тон и значок — общие (BOOKING_STATUS_META, одинаково во всех разделах), слова — от лица
 * клиента из словаря client (CONVENTIONS §8: «у клиента — от его лица, в словаре client»).
 */
export function ClientStatusBadge({
  status,
  reason,
  paymentReported,
  size = 'md',
  className,
}: {
  status: BookingStatus;
  /** Причина снятия (Booking.cancelReason): у confirmation_expired — «Мастер не ответил», а не «Отменена мастером» (В-03) */
  reason?: string;
  /** Клиент нажал «Я оплатил», мастер ещё не сверил деньги — «Ждёт мастера», а не «Ждёт предоплату» (владелец, 01.10.2026) */
  paymentReported?: boolean;
  size?: BadgeSize;
  className?: string;
}) {
  const t = useT('client');
  const { tone, icon: Icon } = BOOKING_STATUS_META[status];
  return (
    <Badge tone={tone} size={size} variant="soft" icon={<Icon aria-hidden />} className={className}>
      {status === 'cancelled_by_master' && reason === 'confirmation_expired'
        ? t('bookings.status.confirmation_expired')
        : reason === 'rescheduled'
          ? t('bookings.status.rescheduled')
        : status === 'awaiting_prepayment' && paymentReported
          ? t('bookings.status.awaiting_master')
          : t(`bookings.status.${status}`)}
    </Badge>
  );
}

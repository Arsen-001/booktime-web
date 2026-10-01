'use client';

import {
  Ban,
  CalendarCheck,
  CircleCheckBig,
  CircleX,
  Hourglass,
  ThumbsUp,
  UserX,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { BookingStatus } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeSize, type BadgeTone, type BadgeVariant } from '@/ui/Badge';

export interface BookingStatusMeta {
  tone: BadgeTone;
  icon: LucideIcon;
}

/**
 * Одна карта «статус записи → тон + иконка» для всех разделов (журнал, клиенты, онлайн-запись, приложение клиента).
 * Статус виден формой (иконка), а не только цветом. Ждёт действия — warning; в силе — info/primary; состоялось — success;
 * не пришёл — danger; отменено (кем бы то ни было) — neutral.
 */
export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  awaiting_confirmation: { tone: 'warning', icon: Hourglass },
  awaiting_prepayment: { tone: 'warning', icon: Wallet },
  scheduled: { tone: 'info', icon: CalendarCheck },
  client_confirmed: { tone: 'primary', icon: ThumbsUp },
  arrived: { tone: 'success', icon: CircleCheckBig },
  no_show: { tone: 'danger', icon: UserX },
  cancelled_by_client: { tone: 'neutral', icon: CircleX },
  cancelled_by_master: { tone: 'neutral', icon: Ban },
};

export type BookingStatusAudience = 'business' | 'client';

export interface BookingStatusBadgeProps {
  status: BookingStatus;
  /** business — слова кабинета («Клиент подтвердил»), client — от лица клиента («Вы подтвердили визит») */
  audience?: BookingStatusAudience;
  size?: BadgeSize;
  variant?: BadgeVariant;
  className?: string;
}

/** Подпись статуса записи — для мест, где нужен текст без метки (select, подсказка) */
export function useBookingStatusLabel(audience: BookingStatusAudience = 'business') {
  const tc = useT('common');
  const tu = useT('ui');
  return (status: BookingStatus): string =>
    audience === 'client' ? tu(`bookingStatusClient.${status}`) : tc(`bookingStatus.${status}`);
}

/** Метка статуса записи: одинаковые слова, цвет и иконка во всех разделах */
export function BookingStatusBadge({
  status,
  audience = 'business',
  size = 'md',
  variant = 'soft',
  className,
}: BookingStatusBadgeProps) {
  const label = useBookingStatusLabel(audience);
  const { tone, icon: Icon } = BOOKING_STATUS_META[status];
  return (
    <Badge tone={tone} size={size} variant={variant} icon={<Icon aria-hidden />} className={className}>
      {label(status)}
    </Badge>
  );
}

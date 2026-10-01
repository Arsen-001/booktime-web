'use client';

/**
 * «Что важно сейчас» в карточке (ux-best-c1 №3): ближайшая запись клиента — когда, что, к кому — с переходом в журнал.
 * Какие записи впереди, решает правило ядра `splitClientBookings`.
 */
import { CalendarClock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useCoreList } from '@/api/core';
import type { Id, Service } from '@/domain/core';
import { splitClientBookings } from '@/domain/rules';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { nowDateTime } from '@/lib/date';
import { pickText } from '@/lib/text';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { Skeleton } from '@/ui/Skeleton';

export interface ClientNextBookingProps {
  clientId: Id;
  businessId: Id;
  services: Service[];
}

export function ClientNextBooking({ clientId, businessId, services }: ClientNextBookingProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const locale = useLocale();
  const bookingsQ = useCoreList('bookings', { clientId, businessId });
  const staffQ = useCoreList('staff', { businessId });
  // Пока записи клиента читаются — место под плашку той же высоты: приехавшая «Следующая запись» не сдвигает
  // деньги и вкладки ниже (scripts/flicker.mjs, clients-open)
  if (bookingsQ.isLoading) return <Skeleton variant="rect" className="h-[70px] w-full rounded-2xl" />;
  const next = splitClientBookings(bookingsQ.data ?? [], nowDateTime()).upcoming[0];
  if (!next) return null;
  const service = services.find((s) => s.id === next.services[0]?.serviceId);
  const master = staffQ.data?.find((s) => s.id === next.staffId)?.name;
  const what = [service ? pickText(service.name, locale as never) : undefined, master].filter(Boolean).join(' · ');
  return (
    <Link
      // F-04-075 (исправлено, recheck-c3): без `date=` журнал открывает СЕГОДНЯ — запись на другой день не находится
      href={`/biz/journal?date=${next.start.slice(0, 10)}&booking=${next.id}`}
      className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 transition-colors hover:border-primary/60"
    >
      <CalendarClock aria-hidden className="size-5 shrink-0 text-primary-text" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-primary-text">{t('cardView.nextBooking')}</span>
        <span className="block truncate text-base font-semibold text-fg">
          {fmt.relativeDay(next.start)}, {fmt.time(next.start)}
          {what ? ` · ${what}` : ''}
        </span>
      </span>
      <BookingStatusBadge status={next.status} size="sm" className="max-sm:hidden" />
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

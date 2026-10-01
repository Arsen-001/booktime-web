'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { CalendarX2 } from 'lucide-react';
import { getBooking, getBookingDays, rescheduleBookingByClient } from '@/api/client';
import type { FreeSlot } from '@/api/schedule';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { SlotPicker } from '@/areas/client/book/SlotPicker';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useCurrent } from '@/demo/hooks';
import type { Id, ISODateTime } from '@/domain/core';
import { isActiveBooking } from '@/domain/rules/booking-status';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';

/**
 * Перенос записи клиентом (F-00-099, F-14-016): окна того же мастера на ту же услугу. Перенос одним касанием —
 * быстро (speed-k4), а промах возвращается «Вернуть» в тосте (speed-k2 №5, ux-r2 №33). Текущее время отмечено.
 */
export function RescheduleScreen({ bookingId }: { bookingId: Id }) {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(clientKeys.booking(bookingId, appUserId), () => getBooking(bookingId, appUserId), { enabled: ready });
  const back = { href: `/bookings/${bookingId}` };

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeader back={back} title={t('reschedule.title')} />
        <Skeleton variant="rect" className="h-20 rounded-xl" />
        <Skeleton variant="rect" className="h-64 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader back={back} title={t('reschedule.title')} />
        <ErrorState onRetry={q.refetch} />
      </div>
    );
  }
  if (!q.data || !appUserId) return <EmptyState icon={<CalendarX2 />} title={t('bookingDetail.notFound')} description={t('bookingDetail.notFoundHint')} action={<LinkButton href="/bookings">{t('bookingDetail.toList')}</LinkButton>} />;
  if (!isActiveBooking(q.data.booking) || !q.data.canReschedule) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader back={back} title={t('reschedule.title')} />
        <EmptyState icon={<CalendarX2 />} title={t('reschedule.notAllowed')} description={t('reschedule.notAllowedHint')} />
      </div>
    );
  }
  return <RescheduleBody detail={q.data} appUserId={appUserId} />;
}

function RescheduleBody({ detail, appUserId }: { detail: NonNullable<Awaited<ReturnType<typeof getBooking>>>; appUserId: Id }) {
  const { booking, staff, service } = detail;
  const t = useT('client');
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const toast = useToast();
  const serviceId = service?.id ?? booking.services[0]?.serviceId ?? '';
  const daysQ = useApiQuery(clientKeys.bookingDays(staff.id, serviceId), () => getBookingDays(staff.id, serviceId), { enabled: Boolean(serviceId) });
  const [moved, setMoved] = useState(false);
  const move = useApiMutation(({ start }: { start: ISODateTime }) => rescheduleBookingByClient(booking.id, start, appUserId), {
    invalidates: [clientKeys.booking(booking.id, appUserId), clientKeys.myBookings(appUserId), clientKeys.upcoming(appUserId), clientKeys.bookingDays(staff.id, serviceId)],
  });

  const moveTo = async (start: ISODateTime, undo = false) => {
    const from = booking.start;
    try {
      await move.mutate({ start });
      if (undo) {
        toast.success(t('reschedule.undone'));
        return;
      }
      setMoved(true);
      toast.success(t('reschedule.success', { when: `${fmt.relativeDay(start)}, ${fmt.time(start)}` }), {
        action: { label: t('reschedule.undo'), onClick: () => void moveTo(from, true) },
      });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      toast.error(code ? tc(`bookingErrors.${code}` as 'bookingErrors.slot_taken') : t('reschedule.failed'));
    }
  };

  return (
    <div data-f="F-00-099 F-14-016 F-14-017" className="flex flex-col gap-5">
      <PageHeader back={{ href: `/bookings/${booking.id}` }} title={t('reschedule.title')} description={t('reschedule.subtitle')} />
      <Card padding="md" className="flex items-center gap-3">
        <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="md" />
        <div className="min-w-0">
          <p className="font-medium text-fg">{service ? pickText(service.name, locale) : t('bookings.serviceRemoved')}</p>
          <p className="text-sm text-muted">
            {t('reschedule.currentLine', { name: staff.name, when: `${fmt.relativeDay(booking.start).toLocaleLowerCase(locale)}, ${fmt.time(booking.start)}` })}
          </p>
        </div>
      </Card>
      <Card padding="md" className={move.isPending ? 'pointer-events-none opacity-60' : undefined}>
        <SlotPicker days={daysQ.data} loading={daysQ.isLoading} current={booking.start} onSelect={(s: FreeSlot) => void moveTo(s.start)} />
      </Card>
      {moved && (
        <StickyActionBar desktop="inline" aria-label={t('reschedule.title')}>
          <LinkButton href={`/bookings/${booking.id}`}>{t('reschedule.toBooking')}</LinkButton>
        </StickyActionBar>
      )}
    </div>
  );
}

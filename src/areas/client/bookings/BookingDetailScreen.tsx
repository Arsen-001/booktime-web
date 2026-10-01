'use client';

import { CalendarX2 } from 'lucide-react';
import { getBooking } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { BookingDetailBody } from '@/areas/client/bookings/BookingDetailBody';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

/** Карточка записи клиента (F-00-097…102, F-14-011…057). Чужую запись не отдаёт api (decision-c1 block №1) */
export function BookingDetailScreen({ bookingId }: { bookingId: Id }) {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(clientKeys.booking(bookingId, appUserId), () => getBooking(bookingId, appUserId), { enabled: ready });
  const back = { href: '/bookings', label: t('bookings.title') };

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <PageHeader back={back} title={<Skeleton variant="text" className="h-7 w-56" />} />
        <Skeleton variant="rect" className="h-24 rounded-xl" />
        <Skeleton variant="rect" className="h-32 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={back} title={t('bookingDetail.title')} />
        <ErrorState onRetry={q.refetch} />
      </div>
    );
  }
  if (!q.data || !appUserId) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={back} title={t('bookingDetail.title')} />
        <EmptyState
          icon={<CalendarX2 />}
          title={t('bookingDetail.notFound')}
          description={t('bookingDetail.notFoundHint')}
          action={<LinkButton href="/bookings">{t('bookingDetail.toList')}</LinkButton>}
        />
      </div>
    );
  }
  return <BookingDetailBody detail={q.data} appUserId={appUserId} />;
}

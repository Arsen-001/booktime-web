'use client';

import { useState, type ReactNode } from 'react';
import { CalendarCheck, CalendarX2, History, Search } from 'lucide-react';
import { listMyBookings } from '@/api/client';
import type { EnrichedBooking } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { BookingCard, BookingCardSkeleton } from '@/areas/client/bookings/BookingCard';
import { WaitlistStrip } from '@/areas/client/bookings/WaitlistStrip';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { GuestGate } from '@/areas/client/ui/GuestGate';
import { useClientSession } from '@/areas/client/ui/useClientSession';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';

type Tab = 'upcoming' | 'past' | 'cancelled';

/** «Мои записи» (F-14-011): будущие / прошлые / отменённые, лист ожидания над будущими (F-00-102) */
export function BookingsScreen() {
  const t = useT('client');
  const { appUserId, signedIn } = useClientSession();

  // Вошедший клиент — раскладка списка с первого кадра (пока база поднимается — скелетоны тех же карточек)
  // Гость (персона известна и серверу) — сразу приглашение, без скелетона
  if (signedIn) return <BookingsBody appUserId={appUserId} />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('bookings.title')} />
      <GuestGate icon={<CalendarCheck />} title={t('bookings.needLoginTitle')} description={t('bookings.needLoginHint')} next="/bookings" />
    </div>
  );
}

function BookingsBody({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const q = useApiQuery(clientKeys.myBookings(appUserId ?? ''), () => listMyBookings(appUserId ?? ''), { enabled: Boolean(appUserId) });
  // Сколько карточек было в прошлый раз (в демо — 3), не больше страницы
  const skeletonCount = useSkeletonCount('bookings-upcoming', { loading: q.isLoading, count: q.data?.upcoming.length, fallback: 4, max: 10 });
  const [tab, setTab] = useState<Tab>('upcoming');
  const isMobile = useIsMobile();
  const data = q.data;

  return (
    <div data-f="F-14-011" className="flex flex-col gap-5">
      <PageHeader title={t('bookings.title')} description={t('bookings.subtitle')} />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : q.isLoading || !data || !appUserId ? (
        // Та же раскладка до данных: вкладки настоящие (выключены), карточки — BookingCardSkeleton
        <>
          <SegmentedControl
            size="sm"
            fullWidth={isMobile}
            aria-label={t('bookings.title')}
            value={tab}
            onValueChange={() => undefined}
            options={[
              {
                value: 'upcoming',
                disabled: true,
                label: isMobile ? t('bookings.tabUpcoming') : (
                  // Одним куском, как строка «Предстоящие · 4» (в кнопке — flex с отступом между детьми)
                  <span>
                    {t('bookings.tabUpcoming')} · <SkeletonText width="1ch" />
                  </span>
                ),
              },
              { value: 'past', label: t('bookings.tabPast'), disabled: true },
              { value: 'cancelled', label: t('bookings.tabCancelled'), disabled: true },
            ]}
          />
          <ul className="grid gap-3 lg:grid-cols-2" aria-busy="true">
            {Array.from({ length: skeletonCount }, (_, i) => (
              <li key={i}>
                <BookingCardSkeleton />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <SegmentedControl
            size="sm"
            fullWidth={isMobile}
            aria-label={t('bookings.title')}
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            options={[
              { value: 'upcoming', label: data.upcoming.length && !isMobile ? `${t('bookings.tabUpcoming')} · ${data.upcoming.length}` : t('bookings.tabUpcoming') },
              { value: 'past', label: t('bookings.tabPast') },
              { value: 'cancelled', label: t('bookings.tabCancelled') },
            ]}
          />
          <div hidden={tab !== 'upcoming'} className="empty:hidden">
            <WaitlistStrip appUserId={appUserId} />
          </div>
          {/* Все три вкладки смонтированы, видна одна: при переключении ничего не пересоздаётся, вкладка проявляется */}
          <div hidden={tab !== 'upcoming'}>
            <BookingList
              bookings={data.upcoming}
              empty={
                <EmptyState
                  compact
                  icon={<CalendarCheck />}
                  title={t('bookings.emptyUpcomingTitle')}
                  description={t('bookings.emptyUpcomingHint')}
                  action={
                    <LinkButton href="/search" leftIcon={<Search aria-hidden />}>
                      {t('common.findMaster')}
                    </LinkButton>
                  }
                />
              }
            />
          </div>
          <div hidden={tab !== 'past'}>
            <BookingList bookings={data.past} empty={<EmptyState compact icon={<History />} title={t('bookings.emptyPastTitle')} />} />
          </div>
          <div hidden={tab !== 'cancelled'}>
            <BookingList bookings={data.cancelled} empty={<EmptyState compact icon={<CalendarX2 />} title={t('bookings.emptyCancelledTitle')} />} />
          </div>
        </>
      )}
    </div>
  );
}

function BookingList({ bookings, empty }: { bookings: EnrichedBooking[]; empty: ReactNode }) {
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(bookings);
  if (!bookings.length) return <>{empty}</>;
  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {pageItems.map((b) => (
          <li key={b.id} data-f={b.groupEventId ? 'F-14-017 F-14-023 F-16-091 F-16-092' : undefined}>
            <BookingCard booking={b} />
          </li>
        ))}
      </ul>
      {pager}
    </>
  );
}

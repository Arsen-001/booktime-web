'use client';

import { CalendarCheck, Search } from 'lucide-react';
import { listUpcomingBookings } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { BookingCard, BookingCardSkeleton } from '@/areas/client/bookings/BookingCard';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { InlineError } from '@/areas/client/ui/InlineError';
import { SectionHeader } from '@/areas/client/ui/SectionHeader';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/**
 * Ближайшие записи на главной — та же карточка, что в «Моих записях» (ux-r1 №1, ux-r2 №47): когда, что, у кого и где,
 * а не одна дата. Пусто — не тупик, а «Найти мастера» (onboarding-k2…k4).
 */
export function UpcomingSection({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const q = useApiQuery(clientKeys.upcoming(appUserId ?? ''), () => listUpcomingBookings(appUserId ?? ''), { enabled: Boolean(appUserId) });
  const skeletonCount = useSkeletonCount('home-upcoming', { loading: q.isLoading, count: q.data?.length, fallback: 3, max: 3 });

  return (
    <section data-f="F-14-010" className="flex flex-col gap-3">
      <SectionHeader title={t('home.upcoming.title')} href="/bookings" linkLabel={t('home.upcoming.all')} />
      {q.isLoading ? (
        <ul className="grid gap-3 lg:grid-cols-2" aria-busy="true">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <li key={i}>
              <BookingCardSkeleton />
            </li>
          ))}
        </ul>
      ) : q.isError ? (
        <InlineError onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState
          variant="inline"
          icon={<CalendarCheck />}
          title={t('home.upcoming.empty')}
          action={
            <LinkButton href="/search" size="sm" variant="secondary" leftIcon={<Search aria-hidden />}>
              {t('common.findMaster')}
            </LinkButton>
          }
          className="rounded-xl border border-border bg-surface"
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((b) => (
            <li key={b.id}>
              <BookingCard booking={b} variant="compact" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

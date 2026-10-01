'use client';

import { CalendarClock, SearchX, UserX } from 'lucide-react';
import { getMasterCard } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { BookFlow } from '@/areas/client/book/BookFlow';
import { BusinessBookPicker } from '@/areas/client/book/BusinessBookPicker';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useCurrent } from '@/demo/hooks';
import type { Id, ISODateTime } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Запись клиентом (F-00-092). /book?staff=&slot=&service= — к мастеру (окно и услуга из ссылки пропускают свои шаги);
 * /book?business= — «Записаться» с карточки места: сначала услуга и мастер (F-14-029).
 */
export function BookScreen({
  staffId,
  slot,
  serviceId,
  businessId,
  storyId,
}: {
  staffId: Id | undefined;
  slot: ISODateTime | undefined;
  serviceId?: Id;
  businessId?: Id;
  /** Пришёл со «Записаться» в сторис (F-14-035) — считает bookingCount той сторис при реальной записи */
  storyId?: Id;
}) {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(clientKeys.masterCard(staffId ?? '', appUserId), () => getMasterCard(staffId ?? '', appUserId), {
    enabled: ready && Boolean(staffId),
  });

  if (!staffId) {
    if (businessId) return <BusinessBookPicker businessId={businessId} storyId={storyId} initialServiceId={serviceId} />;
    // Без мастера и места — не тупик: сразу к поиску свободного времени (ux-r1 №33)
    return (
      <EmptyState
        icon={<CalendarClock />}
        title={t('book.missingSlot')}
        description={t('book.missingSlotHint')}
        action={<LinkButton href="/search?free=today">{t('book.findTime')}</LinkButton>}
      />
    );
  }

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="rect" className="h-28 rounded-xl" />
        <Skeleton variant="rect" className="h-64 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader back={{ href: `/masters/${staffId}` }} title={t('book.title')} />
        <ErrorState onRetry={q.refetch} />
      </div>
    );
  }
  if (!q.data) {
    return (
      <EmptyState
        icon={<UserX />}
        title={t('master.notFound')}
        description={t('master.notFoundHint')}
        action={<LinkButton href="/search">{t('common.findMaster')}</LinkButton>}
      />
    );
  }
  if (!q.data.services.length) {
    return (
      <EmptyState
        icon={<SearchX />}
        title={t('book.noServices')}
        description={t('book.noServicesHint')}
        action={<LinkButton href={`/masters/${staffId}`} variant="secondary">{t('book.backToMaster')}</LinkButton>}
      />
    );
  }

  return (
    <BookFlow
      key={`${staffId}:${slot ?? ''}:${serviceId ?? ''}`}
      card={q.data}
      initialSlot={slot}
      initialServiceId={serviceId && q.data.services.some((s) => s.id === serviceId) ? serviceId : undefined}
      storyId={storyId}
    />
  );
}

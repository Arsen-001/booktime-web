'use client';

import { useState } from 'react';
import { ChevronRight, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { getPlaceCard } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { ServiceChoices } from '@/areas/client/book/ServiceChoices';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { Stepper } from '@/ui/Stepper';

/**
 * «Записаться» с карточки места (F-14-029): услуга → мастер. Мастер — карточкой с фото и ближайшим временем, первым —
 * «Любой мастер — самое раннее время» (ux-r2 №42а, ux-best-c1 №4). Дальше — обычный поток записи к мастеру.
 */
export function BusinessBookPicker({ businessId, storyId, initialServiceId }: { businessId: Id; storyId?: Id; initialServiceId?: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const q = useApiQuery(clientKeys.placeCard(businessId), () => getPlaceCard(businessId));
  const [serviceId, setServiceId] = useState<Id | undefined>(initialServiceId);
  const [picking, setPicking] = useState(Boolean(initialServiceId));

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="rect" className="h-64 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader back={{ href: `/places/${businessId}` }} title={t('book.title')} />
        <ErrorState onRetry={q.refetch} />
      </div>
    );
  }
  if (!q.data) return <EmptyState title={t('place.notFound')} description={t('place.notFoundHint')} />;

  const { business, services, staff } = q.data;
  if (!services.length) return <EmptyState icon={<SearchX />} title={t('book.noServices')} description={t('book.noServicesHint')} />;

  const service = services.find((s) => s.id === serviceId);
  const staffForService = service ? staff.filter((m) => service.staffIds.includes(m.staff.id)) : [];
  const suffix = storyId ? `&story=${storyId}` : '';
  const hrefFor = (staffId: Id, slot?: string) =>
    `/book?staff=${staffId}&service=${serviceId}${slot ? `&slot=${encodeURIComponent(slot)}` : ''}${suffix}`;
  const earliest = [...staffForService].filter((m) => m.nextSlot).sort((a, b) => a.nextSlot!.start.localeCompare(b.nextSlot!.start))[0];
  const stepIndex = picking && service ? 1 : 0;

  return (
    <div data-f="F-14-029" className="flex flex-col gap-5">
      {stepIndex === 0 ? (
        <PageHeader back={{ href: `/places/${businessId}` }} title={t('book.title')} description={business.name} />
      ) : (
        <div className="flex flex-col gap-3">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted" onClick={() => setPicking(false)}>
            {t('book.back')}
          </Button>
          <PageHeader title={t('book.title')} description={business.name} />
        </div>
      )}
      <Stepper steps={[{ id: 'service', label: t('book.step.service') }, { id: 'master', label: t('book.step.master') }]} current={stepIndex} />

      {stepIndex === 0 ? (
        <ServiceChoices
          services={services}
          value={serviceId}
          onPick={(id) => {
            setServiceId(id);
            setPicking(true);
          }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {earliest && staffForService.length > 1 && (
            <li>
              <Link
                href={hrefFor(earliest.staff.id, earliest.nextSlot?.start)}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 p-4 transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast">
                  <Shuffle className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg">{t('book.anyMaster')}</span>
                  <span className="block text-sm text-muted">
                    {t('book.earliest', { when: `${fmt.relativeDay(earliest.nextSlot!.start)}, ${fmt.time(earliest.nextSlot!.start)}` })}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted" />
              </Link>
            </li>
          )}
          {staffForService.map(({ staff: m, nextSlot }) => (
            <li key={m.id}>
              <Link
                href={hrefFor(m.id)}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
              >
                <Avatar name={m.name} src={m.avatarUrl} colorIndex={m.colorIndex} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg">{m.name}</span>
                  <span className="block text-sm text-muted">
                    {nextSlot ? t('book.earliest', { when: `${fmt.relativeDay(nextSlot.start)}, ${fmt.time(nextSlot.start)}` }) : t('master.noSlots')}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { UserX } from 'lucide-react';
import { getMasterCard, type MasterCard } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { AutoTranslatedText } from '@/areas/client/AutoTranslatedText';
import { ContactBlock } from '@/areas/client/masters/ContactBlock';
import { MasterHeader } from '@/areas/client/masters/MasterHeader';
import { MasterPlaces } from '@/areas/client/masters/MasterPlaces';
import { MasterSlotsCard } from '@/areas/client/masters/MasterSlotsCard';
import { MasterTrustBadges, ReportMasterButton, SterilizationCard } from '@/areas/client/masters/MasterTrust';
import { PhotoStrip } from '@/areas/client/masters/PhotoStrip';
import { PromoStoriesRow } from '@/areas/client/promo/PromoStoriesRow';
import { useLastSearchHref } from '@/areas/client/search/useLastSearchHref';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { ServiceRow } from '@/areas/client/ui/ServiceRow';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';

/** Карточка мастера для клиента (F-00-123). Скрытого, замороженного и «Только мои» чужому api не отдаёт */
export function MasterCardScreen({ staffId, serviceId }: { staffId: Id; /** Из поиска: окна под найденную услугу */ serviceId?: Id }) {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(clientKeys.masterCard(staffId, appUserId, serviceId), () => getMasterCard(staffId, appUserId, serviceId), { enabled: ready });
  const back = { href: useLastSearchHref(), label: t('master.backToSearch') };

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <PageHeader back={back} title={<Skeleton variant="text" className="h-8 w-48" />} />
        <Skeleton variant="rect" className="h-32 rounded-xl" />
        <Skeleton variant="rect" className="h-40 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={back} title={t('master.title')} />
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
  return <MasterCardBody card={q.data} />;
}

function MasterCardBody({ card }: { card: MasterCard }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const { staff, business, services, nearestSlots, slotService } = card;
  const backHref = useLastSearchHref();
  const next = nearestSlots[0];
  const bookHref = next
    ? `/book?staff=${staff.id}&slot=${encodeURIComponent(next.start)}${slotService ? `&service=${slotService.id}` : ''}`
    : `/book?staff=${staff.id}${services.length === 1 ? `&service=${services[0].id}` : ''}`;

  return (
    <div data-f="F-00-123" className="flex flex-col gap-5">
      <PageHeader back={{ href: backHref, label: t('master.backToSearch') }} title={<span className="sr-only">{staff.name}</span>} className="-mb-3" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <MasterHeader card={card} />
          <MasterTrustBadges staffId={staff.id} businessId={business.id} />
          <MasterSlotsCard card={card} className="lg:hidden" />
          {staff.bio && (
            <div data-f="F-00-174">
              <AutoTranslatedText text={staff.bio} owner="staff" ownerId={staff.id} field="bio" className="text-fg" />
            </div>
          )}
          <PhotoStrip photos={staff.photos} title={t('master.photosTitle')} />
          <SectionCard title={t('master.servicesTitle')}>
            {services.length === 0 ? (
              <EmptyState variant="inline" title={t('master.noServices')} />
            ) : (
              <ul className="flex flex-col">
                {services.map((s) => (
                  <ServiceRow key={s.id} service={s} href={`/book?staff=${staff.id}&service=${s.id}`} />
                ))}
              </ul>
            )}
          </SectionCard>
          <MasterPlaces card={card} />
          {staff.materials.length > 0 && (
            <SectionCard title={t('master.materialsTitle')}>
              <div className="flex flex-wrap gap-1.5">
                {staff.materials.map((m) => (
                  <Badge key={m} tone="neutral">
                    {m}
                  </Badge>
                ))}
              </div>
            </SectionCard>
          )}
          <SterilizationCard staffId={staff.id} />
          <PromoStoriesRow businessId={business.id} />
          <ContactBlock card={card} />
          <ReportMasterButton staffId={staff.id} businessId={business.id} />
        </div>

        <aside className="sticky top-24 hidden flex-col gap-3 lg:flex">
          <MasterSlotsCard card={card} />
          {services.length > 0 && (
            <LinkButton data-f="F-14-029" href={bookHref} size="lg" fullWidth>
              {t('master.bookCta')}
            </LinkButton>
          )}
        </aside>
      </div>

      {services.length > 0 && (
        <StickyActionBar
          desktop="hidden"
          aria-label={t('master.bookCta')}
          summary={next ? <>{t('master.nearestShort')} <b>{`${fmt.relativeDay(next.start)}, ${fmt.time(next.start)}`}</b></> : undefined}
        >
          <LinkButton data-f="F-14-029" href={bookHref}>
            {t('master.bookCta')}
          </LinkButton>
        </StickyActionBar>
      )}
    </div>
  );
}

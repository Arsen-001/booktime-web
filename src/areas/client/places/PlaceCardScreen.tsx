'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AtSign, Check, ChevronRight, Copy, Gift, Globe, MapPin, MessageCircle, Phone, Store, Wallet } from 'lucide-react';
import {
  getCashbackForBusiness,
  getDefaultNetworkLocation,
  getPlaceCard,
  listLocationReviews,
  listMyBookingsInBusiness,
  listPurchasableCertificates,
  listPurchasableMemberships,
  purchaseCertificate,
  purchaseMembership,
  setDefaultNetworkLocation,
} from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id, WeekTemplate } from '@/domain/core';
import type { CertificateTemplate, MembershipTemplate, NetworkLocationsInfo } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { telLink, waLink } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { AutoTranslatedText } from '@/areas/client/AutoTranslatedText';
import { BookingCard } from '@/areas/client/bookings/BookingCard';
import { FirstBadge } from '@/areas/client/masters/MasterTrust';
import { FavoriteButton } from '@/areas/client/favorites/FavoriteButton';
import { PromoStoriesRow } from '@/areas/client/promo/PromoStoriesRow';
import { useLastSearchHref } from '@/areas/client/search/useLastSearchHref';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton, buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function PlaceCardScreen({ businessId }: { businessId: Id }) {
  const t = useT('client');
  const q = useApiQuery(['place-card', businessId], () => getPlaceCard(businessId));

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-32 rounded-2xl" />
        <Skeleton variant="rect" className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (!q.data)
    return (
      <EmptyState
        title={t('place.notFound')}
        description={t('place.notFoundHint')}
        action={<LinkButton href="/search">{t('common.findMaster')}</LinkButton>}
      />
    );

  return <PlaceCardBody card={q.data} />;
}

function PlaceCardBody({ card }: { card: NonNullable<Awaited<ReturnType<typeof getPlaceCard>>> }) {
  const { business, locations, categories, services, staff, regularsCount } = card;
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const toast = useToast();
  const location = locations[0];
  const { ready, appUserId } = useCurrent();
  const backHref = useLastSearchHref();
  const socials = business.socials ?? {};
  // У индивидуала публичный номер уходит только через карточку мастера (PublicBusiness.phone) — здесь подстраховка от пустого
  const phone = business.phone ?? '';

  const myBookingsQ = useApiQuery(
    ['my-bookings-in-business', appUserId ?? '', business.id],
    () => listMyBookingsInBusiness(appUserId!, business.id),
    { enabled: ready && Boolean(appUserId) },
  );
  const reviewsQ = useApiQuery(['location-reviews', business.id], () => listLocationReviews(business.id));
  const cashbackQ = useApiQuery(['cashback-detail', business.id, appUserId], () => getCashbackForBusiness(appUserId, business.id), {
    enabled: ready && Boolean(appUserId),
  });
  const membershipsForSaleQ = useApiQuery(['purchasable-memberships', business.id], () => listPurchasableMemberships(business.id));
  const certificatesForSaleQ = useApiQuery(['purchasable-certificates', business.id], () => listPurchasableCertificates(business.id));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: reviewsPage, pager: reviewsPager } = usePagedList(reviewsQ.data ?? []);
  const { pageItems: myBookingsPage, pager: myBookingsPager } = usePagedList(myBookingsQ.data ?? []);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      /* буфер недоступен — номер всё равно виден на экране */
    }
    toast.success(t('place.callCopied', { phone: fmt.phone(phone) }));
  };

  return (
    <div data-f="F-14-028" className="flex flex-col gap-5">
      <PageHeader
        back={{ href: backHref }}
        title={
          <div className="flex items-center gap-3">
            {business.logoUrl ? (
              <Avatar name={business.name} src={business.logoUrl} size="xl" colorIndex={1} />
            ) : (
              <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-chart-1/20 ring-1 ring-chart-1/40">
                <Store className="size-7 text-fg" />
              </span>
            )}
            <span className="text-xl font-semibold text-fg">{nameOf(business.name)}</span>
          </div>
        }
        meta={
          <>
            {business.sphereIds.map((s) => (
              <Badge key={s} tone="primary">
                {tc(`spheres.${s}`)}
              </Badge>
            ))}
            <FirstBadge businessId={business.id} />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <FavoriteButton appUserId={appUserId} targetType="business" targetId={business.id} />
            {staff.length > 0 && (
              // «Записаться» на любую услугу этого места — не привязано к одному мастеру (F-14-029)
              <LinkButton href={`/book?business=${business.id}`} data-f="F-14-029">
                {t('place.book')}
              </LinkButton>
            )}
          </div>
        }
      />

      {ready && appUserId && cashbackQ.data && (
        <Link href={`/places/${business.id}/cashback`} data-f="F-14-049" className="w-fit">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent-text">
            <Wallet aria-hidden className="size-4" />
            {cashbackQ.data.balance > 0
              ? t('place.cashbackButton', { amount: fmt.money(cashbackQ.data.balance) })
              : t('place.cashbackButtonZero')}
          </span>
        </Link>
      )}

      {regularsCount > 0 && (
        <Badge tone="info" variant="soft" className="w-fit">
          {t('place.factsRegulars', { count: regularsCount })}
        </Badge>
      )}

      <PromoStoriesRow businessId={business.id} />

      {card.network && <NetworkBranchesSection network={card.network} currentBusinessId={business.id} appUserId={appUserId} />}

      <SectionCard title={t('place.aboutTitle')}>
        <div className="flex flex-col gap-3 text-sm">
          {business.description && (
            <div data-f="F-00-174">
              <AutoTranslatedText
                text={business.description}
                owner="business"
                ownerId={business.id}
                field="description"
                className="text-fg"
              />
            </div>
          )}
          {location && (
            <p className="flex items-start gap-2 text-fg">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                {pickText(location.address, locale)} · {tc(`districts.${location.district}`)}
              </span>
            </p>
          )}
          {location?.openHours && <OpenHours hours={location.openHours} />}
        </div>
      </SectionCard>

      <SectionCard title={t('place.contactsTitle')}>
        <div data-f="F-14-030" className="flex flex-wrap gap-2">
          <button type="button" onClick={copyPhone} className={buttonClasses({ variant: 'secondary' })}>
            <Copy aria-hidden className="size-5" />
            {fmt.phone(phone)}
          </button>
          <a href={telLink(phone)} className={buttonClasses({ variant: 'outline' })}>
            <Phone aria-hidden className="size-5" />
            {t('place.call')}
          </a>
          {location?.yandexMapsUrl && (
            <a href={location.yandexMapsUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: 'ghost' })}>
              {t('place.openMap')}
            </a>
          )}
        </div>
      </SectionCard>

      {(socials.website || socials.instagram || socials.facebook || socials.whatsapp) && (
        <SectionCard title={t('place.socialsTitle')}>
          <div data-f="F-14-028" className="flex flex-wrap gap-2">
            {socials.website && (
              <a
                href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: 'secondary' })}
              >
                <Globe aria-hidden className="size-5" />
                {socials.website}
              </a>
            )}
            {socials.instagram && (
              <a
                href={`https://instagram.com/${socials.instagram}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: 'secondary' })}
              >
                <AtSign aria-hidden className="size-5" />
                {t('place.instagram')}
              </a>
            )}
            {socials.facebook && (
              <a
                href={`https://facebook.com/${socials.facebook}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: 'secondary' })}
              >
                {t('place.facebook')}
              </a>
            )}
            {socials.whatsapp && (
              <a
                href={waLink(phone)}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: 'secondary' })}
              >
                <MessageCircle aria-hidden className="size-5" />
                {t('place.whatsapp')}
              </a>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('place.servicesTitle')}>
        {services.length === 0 ? (
          <EmptyState compact title={t('master.noSlots')} />
        ) : (
          <div className="flex flex-col gap-4">
            {categories
              .filter((c) => services.some((s) => s.categoryId === c.id))
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <div key={c.id} className="flex flex-col gap-1">
                  <h3 className="mt-2 text-sm font-semibold text-muted">{pickText(c.name, locale)}</h3>
                  <ul className="divide-y divide-border">
                    {services
                      .filter((s) => s.categoryId === c.id)
                      .sort((a, b) => a.order - b.order)
                      .map((s) => (
                        <li key={s.id} data-f="F-14-029">
                          <Link
                            href={`/book?business=${business.id}&service=${s.id}`}
                            className="flex items-center justify-between gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-fg">{pickText(s.name, locale)}</p>
                              <p className="text-sm text-muted">{fmt.durationRange(s.durationMin, s.durationMax)}</p>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 font-medium text-fg">
                              {fmt.moneyRange(s.priceMin, s.priceMax)}
                              <ChevronRight aria-hidden className="size-4 text-muted" />
                            </span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </SectionCard>

      {staff.length > 0 && (
        <SectionCard title={t('place.mastersTitle')}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {staff.map(({ staff: m }) => (
              <li key={m.id}>
                <Link href={`/masters/${m.id}`}>
                  <Card interactive padding="sm" className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} colorIndex={m.colorIndex} size="md" />
                    <span className="truncate font-medium text-fg">{m.name}</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title={t('place.reviewsTitle')}>
        <div data-f="F-14-014">
          {reviewsQ.isLoading ? (
            <Skeleton variant="rect" className="h-16 rounded-xl" />
          ) : reviewsQ.isError ? (
            <ErrorState compact onRetry={reviewsQ.refetch} />
          ) : !reviewsQ.data?.length ? (
            <EmptyState compact title={t('place.reviewsEmpty')} />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border">
                {reviewsPage.map((r) => (
                  <li key={r.id} className="py-3 text-sm">
                    <p className="text-fg">{r.text}</p>
                    <p className="mt-1 text-muted">{fmt.relativeDay(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
              {reviewsPager}
            </>
          )}
        </div>
      </SectionCard>

      {Boolean(membershipsForSaleQ.data?.length || certificatesForSaleQ.data?.length) && (
        <div data-f="F-14-043 F-14-044">
          <SectionCard title={t('place.purchasesTitle')}>
            <div className="flex flex-col gap-3">
              {membershipsForSaleQ.data?.map((tpl) => (
                <PurchaseMembershipRow key={tpl.id} template={tpl} appUserId={appUserId} />
              ))}
              {certificatesForSaleQ.data?.map((tpl) => (
                <PurchaseCertificateRow key={tpl.id} template={tpl} appUserId={appUserId} />
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {ready && appUserId && (
        <SectionCard title={t('place.myBookingsTitle')}>
          <div data-f="F-14-026">
            {myBookingsQ.isLoading ? (
              <Skeleton variant="rect" className="h-16 rounded-xl" />
            ) : myBookingsQ.isError ? (
              <ErrorState compact onRetry={myBookingsQ.refetch} />
            ) : !myBookingsQ.data?.length ? (
              <EmptyState compact title={t('place.myBookingsEmpty')} />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {myBookingsPage.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
                {myBookingsPager}
              </>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/** Филиал сети по умолчанию (F-14-163): клиент видит все локации сети и отмечает свою основную */
function NetworkBranchesSection({
  network,
  currentBusinessId,
  appUserId,
}: {
  network: NetworkLocationsInfo;
  currentBusinessId: Id;
  appUserId: Id | undefined;
}) {
  const t = useT('client');
  const toast = useToast();
  const defaultQ = useApiQuery(['default-network-location', appUserId ?? '', network.networkId], () => getDefaultNetworkLocation(appUserId, network.networkId), {
    enabled: Boolean(appUserId),
  });
  const setDefault = useApiMutation((businessId: Id) => setDefaultNetworkLocation(appUserId!, network.networkId, businessId));
  const defaultBusinessId = defaultQ.data ?? network.locations[0]?.businessId;

  const handlePick = async (businessId: Id) => {
    if (!appUserId) return;
    try {
      await setDefault.mutate(businessId);
      toast.success(t('place.branchDefaultSet'));
      void defaultQ.refetch();
    } catch {
      toast.error(t('place.branchDefaultFailed'));
    }
  };

  return (
    <div data-f="F-14-163">
      <SectionCard title={t('place.branchesTitle')}>
        <div className="flex flex-col gap-2">
          {network.locations.map((loc) => {
            const isHere = loc.businessId === currentBusinessId;
            const isDefault = appUserId ? loc.businessId === defaultBusinessId : false;
            return (
              <Card key={loc.businessId} padding="sm" className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-fg">{loc.name}</span>
                  {isHere && (
                    <Badge tone="neutral" variant="soft" className="shrink-0">
                      {t('place.branchHere')}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isHere && (
                    <Link href={`/places/${loc.businessId}`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
                      {t('place.openBranch')}
                    </Link>
                  )}
                  {appUserId &&
                    (isDefault ? (
                      <Badge tone="primary" variant="soft">
                        <Check aria-hidden className="mr-1 size-3.5" />
                        {t('place.branchDefault')}
                      </Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => void handlePick(loc.businessId)} loading={setDefault.isPending}>
                        {t('place.branchSetDefault')}
                      </Button>
                    ))}
                </div>
              </Card>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6] as const;

function OpenHours({ hours }: { hours: WeekTemplate }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const labels = fmt.weekdaysShort();
  return (
    <div>
      <p className="mb-1 font-medium text-fg">{t('place.hoursTitle')}</p>
      <ul className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted">
        {WEEK_ORDER.map((day) => {
          const ranges = hours[day];
          return (
            <li key={day} className="contents">
              <span className="capitalize">{labels[day]}</span>
              <span>{ranges.length === 0 ? t('place.dayOff') : ranges.map((r) => `${r.from}–${r.to}`).join(', ')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Купить абонемент со страницы бизнеса (F-14-043) — оплата по реквизитам мастера, как предоплата (F-00-097) */
function PurchaseMembershipRow({ template, appUserId }: { template: MembershipTemplate; appUserId: Id | undefined }) {
  const t = useT('client');
  const locale = useLocale();
  const fmt = useClientFormat();
  const toast = useToast();
  const router = useRouter();
  const purchase = useApiMutation((id: Id) => purchaseMembership(appUserId!, id));

  const handleBuy = async () => {
    if (!appUserId) {
      router.push('/login');
      return;
    }
    try {
      const m = await purchase.mutate(template.id);
      toast.success(t('place.purchaseSuccess'));
      router.push(`/memberships/${m.id}`);
    } catch {
      toast.error(t('place.purchaseFailed'));
    }
  };

  return (
    <Card padding="sm" className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-fg">{pickText(template.title, locale)}</p>
        <p className="text-sm text-muted">{fmt.money(template.price)}</p>
      </div>
      <Button size="sm" onClick={() => void handleBuy()} loading={purchase.isPending}>
        {t('place.buy')}
      </Button>
    </Card>
  );
}

/** Купить сертификат со страницы бизнеса (F-14-043) */
function PurchaseCertificateRow({ template, appUserId }: { template: CertificateTemplate; appUserId: Id | undefined }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const router = useRouter();
  const purchase = useApiMutation((id: Id) => purchaseCertificate(appUserId!, id));

  const handleBuy = async () => {
    if (!appUserId) {
      router.push('/login');
      return;
    }
    try {
      const c = await purchase.mutate(template.id);
      toast.success(t('place.purchaseSuccess'));
      router.push(`/certificates/${c.id}`);
    } catch {
      toast.error(t('place.purchaseFailed'));
    }
  };

  return (
    <Card padding="sm" className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-2 text-fg">
        <Gift aria-hidden className="size-4 shrink-0 text-muted" />
        <p className="font-medium">{fmt.money(template.faceValue)}</p>
      </div>
      <Button size="sm" onClick={() => void handleBuy()} loading={purchase.isPending}>
        {t('place.buy')}
      </Button>
    </Card>
  );
}

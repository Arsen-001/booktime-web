'use client';

import { ExternalLink, MapPin, Phone, Users } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getClientFieldsConfig, getPublicBusinessData } from '@/api/online-public';
import { useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { UnpublishedNotice } from '@/areas/online/public/UnpublishedNotice';
import { useT } from '@/i18n/useT';
import { telLink } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';

/** Страница «О компании» в виджете (F-03-103) — своё имя, логотип, фото, контакты, «Записаться» */
export function AboutScreen({ slug }: { slug: string }) {
  const t = useT('online');
  const tc = useT('common');
  const format = useFormat();
  const locale = useLocale();
  const q = useApiQuery(['online-about', slug], () => getPublicBusinessData(slug));
  const aboutBusinessId = q.data?.business.id;
  const brandsQ = useApiQuery(['online-about-brands', aboutBusinessId], () => getClientFieldsConfig(aboutBusinessId ?? ''), {
    enabled: Boolean(aboutBusinessId),
  });

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-40 rounded-2xl" />
        <Skeleton variant="rect" className="h-32 rounded-2xl" />
      </div>
    );
  }
  if (q.isError) {
    const code = (q.error as { code?: string } | undefined)?.code;
    // О24: черновик салона — «запись скоро откроется», а не «опечатка в ссылке»
    if (code === 'not_published') return <UnpublishedNotice slug={slug} />;
    const notFound = code === 'not_found';
    return notFound ? <EmptyState title={t('public.notFound')} description={t('public.notFoundHint')} /> : <ErrorState onRetry={q.refetch} />;
  }
  if (!q.data) return null;

  const { business, location, regularsCount, addressHidden } = q.data;
  const displayName = business.name.trim() || t('public.unnamedBusiness');

  return (
    <div className="flex flex-col gap-4" data-f="F-03-103">
      <Card padding="lg" className="flex flex-col items-center gap-3 text-center" data-f="F-03-026">
        <Avatar name={displayName} src={business.logoUrl} size="xl" />
        <h1 className="text-xl font-semibold text-fg">{displayName}</h1>
      </Card>

      {business.description && (
        <SectionCard title={t('about.description')}>
          <p className="whitespace-pre-line text-sm text-fg">{pickText(business.description, locale)}</p>
        </SectionCard>
      )}

      {business.photos.length > 0 && (
        <SectionCard title={t('about.gallery')}>
          <div className="grid grid-cols-3 gap-2">
            {business.photos.slice(0, 6).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('about.contacts')}>
        <div className="flex flex-col gap-2 text-sm">
          {location && (
            <p className="flex items-start gap-2 text-fg" data-f="F-00-077">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              {addressHidden ? (
                <span>
                  {tc(`districts.${location.district}` as never)}
                  <span className="block text-xs text-muted">{t('about.addressAfterConfirm')}</span>
                </span>
              ) : (
                <span>{pickText(location.address, locale)}</span>
              )}
            </p>
          )}
          <a href={telLink(business.phone)} className="inline-flex min-h-10 items-center gap-1.5 text-primary-text hover:underline">
            <Phone aria-hidden className="size-4" />
            {format.phone(business.phone)}
          </a>
          {!addressHidden && location?.yandexMapsUrl && (
            <a
              href={location.yandexMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 text-primary-text hover:underline"
            >
              <ExternalLink aria-hidden className="size-4" />
              {t('public.openMap')}
            </a>
          )}
        </div>
      </SectionCard>

      {brandsQ.data && brandsQ.data.partnerBrands.length > 0 && (
        <div data-f="F-03-104">
          <SectionCard title={t('page.brands.title')}>
            <div className="flex flex-wrap gap-2">
              {brandsQ.data.partnerBrands.map((b) => (
                <span key={b} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-fg">
                  {b}
                </span>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {regularsCount > 0 && (
        <SectionCard title={t('about.trust')}>
          <div className="flex items-center gap-2 py-1 text-fg">
            <Users aria-hidden className="size-5 text-primary-text" />
            <p className="text-sm font-medium">{t('about.regularsCount', { count: regularsCount })}</p>
          </div>
        </SectionCard>
      )}

      <LinkButton href={`/b/${slug}/book`} fullWidth>
        {t('public.book')}
      </LinkButton>
    </div>
  );
}

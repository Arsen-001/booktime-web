'use client';

/**
 * Мастерская «заказов» в каталоге (04.10.2026): ателье, ремонт техники, химчистка, детейлинг работают не по записи —
 * вместо окон «Сегодня 10:00 10:30» карточка места: кто, где, «без записи — принесите в часы работы, о готовности
 * сообщат сами» и две кнопки той же высоты, что ряд окон: «Позвонить» и «Подробнее» (страница бизнеса /b/<адрес>).
 */
import { ChevronRight, MapPin, PackageCheck, Phone } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { CatalogEntry } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { buttonClasses, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';

export function OrdersPlaceCard({ entry }: { entry: CatalogEntry }) {
  const t = useT('client');
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const localized = useLocalizedHref();
  const { business, location } = entry;
  const href = localized(`/b/${business.slug}`);
  const phone = location?.phone || business.phone;
  const spheres = business.sphereIds.map((s) => tc(`spheres.${s}`)).join(', ');
  const district = location ? tc(`districts.${location.district}`) : '';

  return (
    <Card as="li" padding="md" data-f="client-orders-place" className="flex min-w-0 list-none flex-col gap-3">
      <div className="flex items-start gap-3">
        <Link href={href} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-focus" tabIndex={-1}>
          <Avatar name={business.name} src={business.logoUrl} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={href} className="-my-2.5 min-w-0 py-2.5 font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
              <span className="line-clamp-1">{business.name}</span>
            </Link>
            {entry.distanceKm !== undefined && (
              <span className="flex shrink-0 items-center gap-0.5 text-sm text-muted">
                <MapPin aria-hidden className="size-3.5" />
                {t('search.distanceKm', { km: fmt.number(Math.round(entry.distanceKm * 10) / 10) })}
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-sm text-muted">{district ? `${spheres} · ${district}` : spheres}</p>
          {location?.address && <p className="line-clamp-1 text-sm text-muted">{pickText(location.address, locale)}</p>}
          <div className="mt-1.5 flex min-h-6 flex-wrap gap-1.5">
            <Badge tone="info" variant="soft" size="sm" icon={<PackageCheck aria-hidden />}>
              {t('search.ordersPlace.badge')}
            </Badge>
          </div>
        </div>
      </div>
      <p className="text-sm text-fg">{t('search.ordersPlace.hint')}</p>
      <div className="flex gap-2">
        {phone && (
          <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={cn(buttonClasses({ variant: 'outline' }), 'flex-1 md:flex-none')}>
            <Phone aria-hidden className="size-4" />
            {t('search.ordersPlace.call')}
          </a>
        )}
        <LinkButton href={href} variant="secondary" rightIcon={<ChevronRight aria-hidden />} className="flex-1 md:flex-none">
          {t('search.ordersPlace.open')}
        </LinkButton>
      </div>
    </Card>
  );
}

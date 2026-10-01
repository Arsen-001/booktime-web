'use client';

import { Car, ChevronRight, MapPin, Navigation } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { MasterCard } from '@/api/client';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { SectionCard } from '@/ui/SectionCard';

/**
 * Где принимает (ux-r1 №19, decision-c1 №10): название места ссылкой на его карточку, адрес, «Как добраться»;
 * дома у частного мастера — до подтверждённой записи только район (F-00-077); выезд — районы.
 */
export function MasterPlaces({ card }: { card: MasterCard }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const locale = useLocale();
  const { staff, business, locations } = card;
  if (!locations.length && !staff.workplaces.includes('visit')) return null;

  return (
    <SectionCard title={t('master.addressTitle')}>
      <ul className="flex flex-col divide-y divide-border">
        {locations.map((loc) => {
          const address = pickText(loc.address, locale);
          return (
            <li key={loc.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              {business.kind === 'salon' ? (
                <Link href={`/places/${business.id}`} className="flex min-h-11 items-center justify-between gap-2 font-medium text-fg hover:underline">
                  <span className="truncate">{nameOf(business.name)}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                </Link>
              ) : (
                <p className="font-medium text-fg">{loc.isHome ? tc('workplace.home') : pickText(loc.name, locale)}</p>
              )}
              <p className="flex items-start gap-2 text-sm text-muted">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  {address ? `${address} · ` : ''}
                  {tc(`districts.${loc.district}`)}
                  {loc.isHome && !address ? ` · ${t('master.homeAddressLater')}` : ''}
                </span>
              </p>
              {loc.yandexMapsUrl && (
                <a
                  href={loc.yandexMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 -ml-2 text-sm font-medium text-primary-text hover:bg-surface-2"
                >
                  <Navigation aria-hidden className="size-4" />
                  {t('place.openMap')}
                </a>
              )}
            </li>
          );
        })}
        {staff.workplaces.includes('visit') && staff.visitDistricts?.length ? (
          <li className="flex items-start gap-2 py-3 text-sm text-fg last:pb-0">
            <Car aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            {t('master.homeVisitText', { districts: staff.visitDistricts.map((d) => tc(`districts.${d}`)).join(', ') })}
          </li>
        ) : null}
      </ul>
    </SectionCard>
  );
}

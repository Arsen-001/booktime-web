'use client';

import { Flame, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { CatalogEntry } from '@/api/client';
import { SlotsByDay } from '@/areas/client/ui/SlotsByDay';
import { usePlaceLine } from '@/areas/client/ui/usePlaceLine';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { ScrollRow } from '@/ui/ScrollRow';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/**
 * Мастер в каталоге (главная, поиск): кто, что и почём, где, и ближайшие окна кнопками (F-00-001, F-00-108).
 * Тап по окну — сразу запись в это время на показанную услугу (ux-r1 №3, speed-k3 №1: запись в 2 нажатия);
 * ссылка на мастера — на фото и имени, чтобы окна оставались своими ссылками (без вложенных <a>).
 */
export function CatalogEntryCard({ entry }: { entry: CatalogEntry }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const placeLine = usePlaceLine();
  const { staff, business, location, service } = entry;
  // На /hy, /en карточка мастера — тоже с языком в адресе (src/i18n/localePath.ts)
  const localized = useLocalizedHref();
  const masterHref = localized(`/masters/${staff.id}${service ? `?service=${service.id}` : ''}`);
  const bookHref = (slotStart: string) =>
    `/book?staff=${staff.id}&slot=${encodeURIComponent(slotStart)}${service ? `&service=${service.id}` : ''}`;

  return (
    <Card as="li" padding="md" className="flex min-w-0 list-none flex-col gap-3">
      <div className="flex items-start gap-3">
        <Link href={masterHref} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-focus" tabIndex={-1}>
          <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={masterHref} className="-my-2.5 min-w-0 py-2.5 font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
              <span className="line-clamp-1">{nameOf(staff.name)}</span>
            </Link>
            {entry.distanceKm !== undefined && (
              <span className="flex shrink-0 items-center gap-0.5 text-sm text-muted">
                <MapPin aria-hidden className="size-3.5" />
                {t('search.distanceKm', { km: fmt.number(Math.round(entry.distanceKm * 10) / 10) })}
              </span>
            )}
          </div>
          {service && (
            <p className="line-clamp-1 text-sm text-muted">
              {pickText(service.name, locale)} · {t('search.fromPrice', { price: fmt.money(service.priceMin) })}
            </p>
          )}
          <p className="line-clamp-1 text-sm text-muted">
            {placeLine(business, location)}
            {staff.accepts !== 'all' ? ` · ${tc(`accepts.${staff.accepts}`).toLowerCase()}` : ''}
          </p>
          {/* Ряд меток всегда на месте (min-h-6): карточка без меток той же высоты — скелетон и соседи не прыгают */}
          <div className="mt-1.5 flex min-h-6 flex-wrap gap-1.5">
            {(entry.boosted || entry.hotToday) && (
              <>
              {entry.hotToday && (
                <Badge data-f="F-00-103 F-02-092" tone="warning" variant="soft" size="sm" icon={<Flame aria-hidden />}>
                  {entry.hotDiscountPercent ? t('search.hotSlotDiscount', { percent: entry.hotDiscountPercent }) : t('search.hotSlot')}
                </Badge>
              )}
              {entry.boosted && (
                <Badge data-f="F-00-167" tone="neutral" variant="outline" size="sm">
                  {t('search.boostedBadge')}
                </Badge>
              )}
              </>
            )}
          </div>
        </div>
      </div>
      <SlotsByDay singleRow slots={entry.nearestSlots} hrefFor={(s) => bookHref(s.start)} showWorkplace={staff.workplaces.length > 1} />
    </Card>
  );
}

/**
 * Скелетон карточки каталога — та же разметка, что CatalogEntryCard (DESIGN.md «The skeleton IS the page»): фото 48,
 * имя, услуга с ценой, место, ряд меток, ряд окон «Сегодня 10:00 10:30 11:30».
 */
export function CatalogEntryCardSkeleton() {
  return (
    <Card as="li" padding="md" aria-hidden className="flex min-w-0 list-none flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-full">
          <Skeleton variant="circle" className="inline-flex size-12 shrink-0" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="-my-2.5 min-w-0 py-2.5 font-semibold text-fg">
              <span className="line-clamp-1">
                <SkeletonText width="14ch" />
              </span>
            </span>
          </div>
          <p className="line-clamp-1 text-sm text-muted">
            <SkeletonText width="18ch" />
          </p>
          <p className="line-clamp-1 text-sm text-muted">
            <SkeletonText width="26ch" />
          </p>
          <div className="mt-1.5 flex min-h-6 flex-wrap gap-1.5">
            <Skeleton variant="rect" className="h-6 w-28 rounded-full" />
          </div>
        </div>
      </div>
      <SlotsRowSkeleton />
    </Card>
  );
}

/** Один ряд окон SlotsByDay в скелетоне: подпись дня и три окна тех же размеров (44 px, на десктопе 40) */
export function SlotsRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <ScrollRow className="w-full">
        <span className="inline-block pr-1 text-sm font-medium whitespace-nowrap text-muted">
          <SkeletonText width="7ch" />
        </span>
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} variant="rect" className="h-11 w-16 shrink-0 rounded-lg md:h-10" />
        ))}
      </ScrollRow>
    </div>
  );
}

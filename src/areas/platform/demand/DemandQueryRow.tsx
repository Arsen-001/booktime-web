'use client';

/** Один запрос клиентов: сколько людей, в скольких районах нет предложения; районы — чипами (красные — где нет). */
import { ImageDown } from 'lucide-react';
import type { DemandQueryGroup } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge } from '@/ui/Badge';
import { IconButton } from '@/ui/IconButton';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function DemandQueryRow({ group, onImage }: { group: DemandQueryGroup; onImage: () => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const total = group.districts.length;
  return (
    <li className="flex gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        {/* На телефоне плашка — под запросом (рядом длинный запрос переносил её строкой ниже, строка росла) */}
        <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-start max-sm:gap-1">
          <p className="text-base font-semibold text-fg">{group.query}</p>
          {group.offerInCity === 0 ? (
            <Badge tone="danger" size="sm">{t('demand.noOfferCity')}</Badge>
          ) : group.districtsWithoutOffer > 0 ? (
            <Badge tone="warning" size="sm">{t('demand.noOfferDistricts', { n: group.districtsWithoutOffer, total })}</Badge>
          ) : (
            <Badge tone="success" size="sm">{t('demand.offerEverywhere')}</Badge>
          )}
        </div>
        {/* На телефоне: сводка — ровно две строки, районы — одной прокручиваемой строкой; высота строки запроса не зависит
            от числа районов и длины сводки (скелетон ей равен) */}
        <p className="mt-0.5 text-sm text-muted max-sm:line-clamp-2 max-sm:min-h-[2lh]">
          {t('demand.peopleSearched', { n: group.people })}
          {group.notify > 0 ? ` · ${t('demand.waitNotify', { n: group.notify })}` : ''}
          {group.offerInCity > 0 ? ` · ${t('demand.offerInCity', { n: group.offerInCity })}` : ''}
        </p>
        <ul className="no-scrollbar mt-2 flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto" aria-label={t('demand.districtsAria')}>
          {group.districts.map((d) => (
            <li
              key={d.district}
              className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', d.offerInDistrict === 0 ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted')}
            >
              {tc(`districts.${d.district}`)} · {d.people}
            </li>
          ))}
        </ul>
      </div>
      <IconButton icon={<ImageDown />} label={t('demand.makeImage')} variant="outline" onClick={onImage} className="shrink-0 self-start" />
    </li>
  );
}

/** Строка запроса до данных: та же разметка — запрос и плашка, строка «сколько искали», чипы районов, кнопка картинки */
export function DemandQueryRowSkeleton({ chips = 5 }: { chips?: number }) {
  const t = useT('platform');
  return (
    <li className="flex gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-start max-sm:gap-1">
          <p className="text-base font-semibold text-fg">
            <SkeletonText width="16ch" />
          </p>
          <Badge tone="neutral" size="sm">
            <SkeletonText width="12ch" />
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted max-sm:line-clamp-2 max-sm:min-h-[2lh]">
          <Skeleton lines={2} className="sm:hidden" />
          <SkeletonText width="40ch" className="max-sm:hidden" />
        </p>
        <ul className="no-scrollbar mt-2 flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-hidden">
          {Array.from({ length: chips }, (_, i) => (
            <li key={i} className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted">
              <SkeletonText width="9ch" />
            </li>
          ))}
        </ul>
      </div>
      <IconButton icon={<ImageDown />} label={t('demand.makeImage')} variant="outline" disabled className="shrink-0 self-start" />
    </li>
  );
}

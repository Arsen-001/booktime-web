'use client';

/**
 * Колонки «Мест» (макет «Места для продаж», 03.10.2026): место с адресом и филиалами, сфера, район, мастеров,
 * «Запись сейчас» бейджем по группе, ссылки (запись, сайт, Instagram, источник) и общий телефон.
 * Ссылки и телефон работают прямо в строке и не открывают карточку; статус из визитов — у названия, если уже были.
 */
import type { MouseEvent } from 'react';
import { CalendarCheck, Camera, FileSearch, Globe } from 'lucide-react';
import { BOOKING_SYSTEM_TONE, PROSPECT_TONE } from '@/areas/platform/lib/tones';
import type { ProspectDistrict, ProspectRow } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { formatPhone } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { SkeletonText } from '@/ui/Skeleton';
import type { TableColumn } from '@/ui/Table';
import { Tooltip } from '@/ui/Tooltip';

const safeUrl = (u: string | undefined) => (u && /^https?:\/\//i.test(u) ? u : undefined);
/** Нажатие на ссылку в строке — только ссылка, карточка места не открывается */
const stop = (e: MouseEvent) => e.stopPropagation();

/** Ссылки места — значками 40×40 с подсказкой: в строке помещаются все четыре, и в каждую легко попасть */
function ProspectLinks({ p }: { p: ProspectRow }) {
  const t = useT('platform');
  const links = [
    { href: safeUrl(p.bookingUrl), label: t('prospects.link.booking'), Icon: CalendarCheck },
    { href: safeUrl(p.website), label: t('prospects.link.site'), Icon: Globe },
    { href: safeUrl(p.instagram), label: t('prospects.link.instagram'), Icon: Camera },
    { href: safeUrl(p.sourceUrls[0]), label: t('prospects.link.source'), Icon: FileSearch },
  ].filter((l) => Boolean(l.href));
  if (!links.length) return <span className="text-sm text-muted">{t('prospects.noLinks')}</span>;
  return (
    <span className="-mx-2 flex flex-wrap">
      {links.map(({ href, label, Icon }) => (
        <Tooltip key={label} content={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            aria-label={label}
            className="inline-flex size-10 items-center justify-center rounded-lg text-primary-text hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none max-md:size-11"
          >
            <Icon aria-hidden className="size-[18px]" />
          </a>
        </Tooltip>
      ))}
    </span>
  );
}

export function useProspectColumns(): TableColumn<ProspectRow>[] {
  const t = useT('platform');
  const tc = useT('common');
  const districtLabel = (d: ProspectDistrict) => (d === 'unknown' ? t('prospects.districtUnknown') : tc(`districts.${d}`));

  return [
    {
      id: 'name',
      header: t('prospects.col.name'),
      mobile: 'title',
      sortable: true,
      width: '16rem',
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium text-fg">
            <SkeletonText width="16ch" />
          </span>
          <span className="text-sm text-muted">
            <SkeletonText width="22ch" />
          </span>
        </span>
      ),
      cell: (p) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 font-medium break-words text-fg">{p.name}</span>
            {p.status !== 'new' && (
              <Badge size="sm" tone={PROSPECT_TONE[p.status]}>
                {t(`prospects.status.${p.status}`)}
              </Badge>
            )}
          </span>
          {(p.address || (p.branches ?? 1) > 1) && (
            <span className="line-clamp-2 text-sm font-normal text-muted">
              {[p.address, (p.branches ?? 1) > 1 ? t('prospects.branchesN', { n: p.branches ?? 1 }) : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'category',
      header: t('prospects.col.category'),
      mobile: 'subtitle',
      width: '8rem',
      skeletonWidth: '12ch',
      cell: (p) => <span className="text-fg">{t(`prospects.category.${p.category}`)}</span>,
    },
    {
      id: 'district',
      header: t('prospects.col.district'),
      mobile: 'meta',
      width: '7.5rem',
      skeletonWidth: '9ch',
      cell: (p) => <span className="text-fg">{districtLabel(p.district)}</span>,
    },
    {
      id: 'staff',
      header: t('prospects.col.staff'),
      mobile: 'meta',
      sortable: true,
      align: 'right',
      width: '6.5rem',
      skeletonWidth: '3ch',
      // Откуда оценка — в карточке места: в строке она обрезалась бы на полуслове
      cell: (p) => <span className="font-semibold text-fg tabular-nums">{p.staffEstimate ?? '—'}</span>,
    },
    {
      id: 'system',
      header: t('prospects.col.bookingNow'),
      mobile: 'badge',
      width: '10rem',
      cell: (p) => (
        <Badge size="sm" tone={BOOKING_SYSTEM_TONE[p.bookingSystem]}>
          {t(`prospects.system.${p.bookingSystem}`)}
        </Badge>
      ),
      skeleton: (
        <Badge size="sm" tone="neutral">
          <SkeletonText width="8ch" />
        </Badge>
      ),
    },
    {
      id: 'links',
      header: t('prospects.col.links'),
      mobile: 'meta',
      width: '10.5rem',
      skeletonWidth: '14ch',
      cell: (p) => <ProspectLinks p={p} />,
    },
    {
      id: 'phone',
      header: t('prospects.col.phone'),
      mobile: 'meta',
      width: '9.5rem',
      skeletonWidth: '13ch',
      cell: (p) =>
        p.phone ? (
          <a
            href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}
            onClick={stop}
            className="inline-flex min-h-10 items-center rounded-sm text-sm whitespace-nowrap text-fg tabular-nums select-all hover:text-primary-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {formatPhone(p.phone)}
          </a>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];
}

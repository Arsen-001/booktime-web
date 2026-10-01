'use client';

import { CalendarDays, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { MasterCard } from '@/api/client';
import { FavoriteButton } from '@/areas/client/favorites/FavoriteButton';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useCurrent } from '@/demo/hooks';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';

/**
 * Шапка мастера (ux-r1 №18, ux-r5 №15): фото, имя и ❤ в одной строке; под ролью одна строка «где · кого принимает»;
 * факты — одной строкой текста с иконками вместо шести бейджей четырёх стилей.
 */
export function MasterHeader({ card }: { card: MasterCard }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const { appUserId } = useCurrent();
  const { staff, business, regularsCount, starCount, onPlatformSince } = card;
  const where = business.kind === 'individual' ? t('master.individual') : nameOf(business.name);

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl leading-tight font-semibold text-fg">{nameOf(staff.name)}</h1>
            <FavoriteButton appUserId={appUserId} targetType="staff" targetId={staff.id} className="-mt-1 shrink-0" />
          </div>
          {staff.position && <p className="text-muted">{pickText(staff.position, locale)}</p>}
          <p className="mt-1 text-sm text-muted">
            {business.kind === 'individual' ? (
              where
            ) : (
              <Link href={`/places/${business.id}`} className="-my-3 inline-block py-3 font-medium text-primary-text hover:underline">
                {where}
              </Link>
            )}
            {staff.accepts !== 'all' ? ` · ${tc(`accepts.${staff.accepts}`).toLowerCase()}` : ''}
          </p>
        </div>
      </div>
      <ul data-f="F-00-117" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {regularsCount > 0 && (
          <li className="flex items-center gap-1.5">
            <Users aria-hidden className="size-4" />
            {t('master.factsRegulars', { count: regularsCount })}
          </li>
        )}
        {starCount > 0 && (
          <li data-f="F-00-116" className="flex items-center gap-1.5">
            <Star aria-hidden className="size-4 fill-current text-warning" />
            {t('master.starCount', { count: starCount })}
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <CalendarDays aria-hidden className="size-4" />
          {t('master.factsSince', { date: fmt.date(onPlatformSince, 'monthYearGenitive') })}
        </li>
      </ul>
    </header>
  );
}

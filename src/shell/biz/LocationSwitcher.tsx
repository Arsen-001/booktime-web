'use client';

import { MapPin, Plus } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { coreList } from '@/api/core';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { setLocationId } from '@/demo/store';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Tooltip } from '@/ui/Tooltip';
import { useMediaQuery } from '@/ui/hooks/useMediaQuery';

/** Значение-«команда» в списке филиалов — не id локации (F-15-014) */
const ADD_LOCATION_VALUE = '__add_location__';
/** С этой ширины (xl) в верхней полосе хватает места и на подпись «+ Добавить локацию» */
const WIDE_QUERY = '(min-width: 80rem)';

/** Переключатель филиала (F-01-006, F-00-049): у сети — «Все филиалы» и каждый; у одиночного — просто адрес.
 * «+ Добавить локацию» (F-15-014, owned by settings) ведёт на /biz/settings/add-location у любого владельца —
 * право на это действие в проекте отдельно не заведено (assumed), поэтому кнопка видна у всех персон бизнеса. */
export function LocationSwitcher({ className, inTopBar = false }: { className?: string; inTopBar?: boolean }) {
  const t = useT('common');
  const locale = useLocale();
  const router = useRouter();
  const { ready, persona, locationIds, locationId, networkId } = useCurrent();
  // Через api, а не из стора напрямую (arch-a1 S5): на бэкенде филиалов в браузере не будет
  const q = useApiQuery(
    ['core', 'locations', ...locationIds],
    () => coreList('locations', (l) => locationIds.includes(l.id)),
    { enabled: ready && locationIds.length > 0 },
  );
  const canAddLocation = persona === 'individual' || persona === 'owner' || persona === 'network';
  // В верхней полосе планшета (iPad) место делят адрес и поиск: адрес не сжимается (иначе от него оставалось «N…»),
  // а «+ Добавить локацию» до ширины xl — значком с подсказкой. Сжимается поиск — у него своя подсказка внутри
  const selectWidth = inTopBar ? 'w-48 shrink-0' : 'min-w-0 max-w-64';
  // Пока филиалы грузятся — то же место той же формы (адрес или выпадающий список сети), а не пусто: иначе поиск
  // в верхней полосе прыгает вправо, когда адрес появляется. Сеть — по персоне: филиалы ещё не прочитаны.
  if (!ready || !q.data) {
    if (ready && locationIds.length === 0) return null;
    return persona === 'network' ? (
      <Select aria-hidden disabled size="sm" className={cn(selectWidth, className)} options={[]} placeholder=" " />
    ) : (
      <LocationLine className={className} inTopBar={inTopBar} name={<SkeletonText width="80%" />} addLabel={canAddLocation ? t('shell.addLocation') : null} />
    );
  }
  if (locationIds.length === 0) return null;

  const mine = q.data;
  if (mine.length === 1) {
    return (
      <LocationLine
        className={className}
        inTopBar={inTopBar}
        name={pickText(mine[0].name, locale)}
        addLabel={canAddLocation ? t('shell.addLocation') : null}
        onAdd={() => router.push('/biz/settings/add-location')}
      />
    );
  }

  return (
    <Select
      data-f="F-15-014"
      aria-label={t('shell.location')}
      size="sm"
      className={cn(selectWidth, className)}
      value={locationId ?? mine[0]?.id}
      onValueChange={(v) => {
        if (v === ADD_LOCATION_VALUE) router.push('/biz/settings/add-location');
        else setLocationId(v);
      }}
      options={[
        ...(networkId ? [{ value: 'all', label: t('shell.allLocations') }] : []),
        ...mine.map((l) => ({ value: l.id, label: pickText(l.name, locale) })),
        ...(canAddLocation ? [{ value: ADD_LOCATION_VALUE, label: `+ ${t('shell.addLocation')}` }] : []),
      ]}
    />
  );
}

/** Адрес одиночного бизнеса и «+ Добавить локацию» — одна разметка у данных и у скелетона */
function LocationLine({
  name,
  addLabel,
  onAdd,
  className,
  inTopBar,
}: {
  name: ReactNode;
  addLabel: string | null;
  onAdd?: () => void;
  className?: string;
  inTopBar: boolean;
}) {
  const wide = useMediaQuery(WIDE_QUERY);
  // Подпись кнопки прячется только в верхней полосе уже xl; в меню телефона она видна всегда
  const iconOnly = inTopBar && !wide;
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted', inTopBar ? 'shrink-0' : 'min-w-0', className)} data-f="F-15-014">
      <MapPin aria-hidden className="size-4 shrink-0" />
      {/* Постоянная ширина: адрес приезжает после первого кадра, и поиск справа от него не должен сдвигаться */}
      <span className={cn('truncate', inTopBar ? 'w-36 shrink-0' : 'w-36')}>{name}</span>
      {addLabel !== null ? (
        <Tooltip content={addLabel} disabled={!iconOnly}>
          <button
            type="button"
            onClick={onAdd}
            disabled={!onAdd}
            aria-label={iconOnly ? addLabel : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full text-xs text-primary-text hover:bg-primary-soft',
              iconOnly ? 'size-8 justify-center' : 'px-1.5 py-0.5',
            )}
          >
            <Plus aria-hidden className={iconOnly ? 'size-4' : 'size-3.5'} />
            {!iconOnly && addLabel}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

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

/** Значение-«команда» в списке филиалов — не id локации (F-15-014) */
const ADD_LOCATION_VALUE = '__add_location__';

/** Переключатель филиала (F-01-006, F-00-049): у сети — «Все филиалы» и каждый; у одиночного — просто адрес.
 * «+ Добавить локацию» (F-15-014, owned by settings) ведёт на /biz/settings/add-location у любого владельца —
 * право на это действие в проекте отдельно не заведено (assumed), поэтому кнопка видна у всех персон бизнеса. */
export function LocationSwitcher({ className }: { className?: string }) {
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
  // Пока филиалы грузятся — то же место той же формы (адрес или выпадающий список сети), а не пусто: иначе поиск
  // в верхней полосе прыгает вправо, когда адрес появляется. Сеть — по персоне: филиалы ещё не прочитаны.
  if (!ready || !q.data) {
    if (ready && locationIds.length === 0) return null;
    return persona === 'network' ? (
      <Select aria-hidden disabled size="sm" className={cn('min-w-0 max-w-64', className)} options={[]} placeholder=" " />
    ) : (
      <LocationLine className={className} name={<SkeletonText width="80%" />} addLabel={canAddLocation ? t('shell.addLocation') : null} />
    );
  }
  if (locationIds.length === 0) return null;

  const mine = q.data;
  if (mine.length === 1) {
    return (
      <LocationLine
        className={className}
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
      className={cn('min-w-0 max-w-64', className)}
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
}: {
  name: ReactNode;
  addLabel: string | null;
  onAdd?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2 text-sm text-muted', className)} data-f="F-15-014">
      <MapPin aria-hidden className="size-4 shrink-0" />
      {/* Постоянная ширина: адрес приезжает после первого кадра, и поиск справа от него не должен сдвигаться */}
      <span className="w-36 truncate">{name}</span>
      {addLabel !== null ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={!onAdd}
          className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-primary-text hover:bg-primary-soft"
        >
          <Plus aria-hidden className="size-3.5" />
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

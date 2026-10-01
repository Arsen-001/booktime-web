'use client';

import { CalendarDays, LocateFixed, Sun } from 'lucide-react';
import type { SearchFilters } from '@/areas/client/search/searchState';
import { CLIENT_SPHERES, SPHERE_ICON } from '@/areas/client/ui/sphereIcons';
import type { SphereId } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { ScrollRow } from '@/ui/ScrollRow';

/**
 * Быстрые фильтры под строкой поиска (ux-r1 №11, ux-best-c1 №6): «Сегодня», «Завтра», «Рядом со мной», затем сферы.
 * Самый частый вопрос площадки «кто когда свободен» — одним касанием, без шторки.
 */
export function QuickFilters({
  filters,
  onChange,
  nearOn,
  onNear,
}: {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  nearOn: boolean;
  onNear: () => void;
}) {
  const t = useT('client');
  const tc = useT('common');
  const toggleDay = (day: 'today' | 'tomorrow') => onChange({ ...filters, day: filters.day === day ? undefined : day });
  const toggleSphere = (id: SphereId) => onChange({ ...filters, sphereId: filters.sphereId === id ? undefined : id });

  return (
    <div data-f="F-00-109 F-00-110">
    <ScrollRow bleed aria-label={t('search.quickLabel')}>
      <Chip selected={filters.day === 'today'} onClick={() => toggleDay('today')} icon={<Sun aria-hidden />}>
        {t('search.freeToday')}
      </Chip>
      <Chip selected={filters.day === 'tomorrow'} onClick={() => toggleDay('tomorrow')} icon={<CalendarDays aria-hidden />}>
        {t('search.freeTomorrow')}
      </Chip>
      <Chip selected={nearOn} onClick={onNear} icon={<LocateFixed aria-hidden />}>
        {t('search.nearMe')}
      </Chip>
      {CLIENT_SPHERES.map((id) => {
        const Icon = SPHERE_ICON[id];
        return (
          <Chip key={id} selected={filters.sphereId === id} onClick={() => toggleSphere(id)} icon={<Icon aria-hidden />}>
            {tc(`spheres.${id}`)}
          </Chip>
        );
      })}
    </ScrollRow>
    </div>
  );
}

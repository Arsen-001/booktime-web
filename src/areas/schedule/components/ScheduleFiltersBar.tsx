'use client';

import type { ScheduleFilters, ScheduleShowFilter } from '@/domain/schedule';
import { activeFilterCount, DEFAULT_FILTERS, scheduleShowValue, withShowValue } from '@/domain/schedule';
import { MultiSelectFilter, type MultiSelectOption } from '@/areas/schedule/components/MultiSelectFilter';
import { useT } from '@/i18n/useT';
import { FilterBar } from '@/ui/FilterBar';
import { Select } from '@/ui/Select';

export interface ScheduleFiltersBarProps {
  filters: ScheduleFilters;
  onChange: (next: ScheduleFilters) => void;
  positions: MultiSelectOption[];
  specializations: MultiSelectOption[];
}

/**
 * Фильтры таблицы (F-02-003): «Должность», «Специализация» и один «Показать» вместо трёх Select без подписей
 * (ux-r2 №2, ux-best-c1 №3). На телефоне FilterBar сам сворачивает их в «Фильтры (n)».
 */
export function ScheduleFiltersBar({ filters, onChange, positions, specializations }: ScheduleFiltersBarProps) {
  const t = useT('schedule');
  const show = scheduleShowValue(filters);
  return (
    <div data-f="F-02-003">
      <FilterBar
        activeCount={activeFilterCount(filters)}
        onReset={() => onChange(DEFAULT_FILTERS)}
        filters={[
          ...(positions.length > 0
            ? [
                {
                  id: 'positions',
                  label: t('filters.positions'),
                  node: (
                    <MultiSelectFilter
                      label={t('filters.positions')}
                      options={positions}
                      value={filters.positions}
                      onValueChange={(v) => onChange({ ...filters, positions: v })}
                    />
                  ),
                },
              ]
            : []),
          ...(specializations.length > 0
            ? [
                {
                  id: 'specializations',
                  label: t('filters.specializations'),
                  node: (
                    <MultiSelectFilter
                      label={t('filters.specializations')}
                      options={specializations}
                      value={filters.specializations}
                      onValueChange={(v) => onChange({ ...filters, specializations: v })}
                    />
                  ),
                },
              ]
            : []),
          {
            id: 'show',
            label: t('filters.show'),
            node: (
              <Select
                aria-label={t('filters.show')}
                value={show}
                onValueChange={(v) => onChange(withShowValue(filters, v as ScheduleShowFilter))}
                options={[
                  { value: 'active', label: t('filters.showActive') },
                  { value: 'with', label: t('filters.hasScheduleWith') },
                  { value: 'without', label: t('filters.hasScheduleWithout') },
                  { value: 'fired', label: t('filters.fired') },
                  { value: 'deleted', label: t('filters.deleted') },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

'use client';

/**
 * Поиск и фильтры каталога (У10): по названию, по мастеру (выпадающий с шевроном) и два чипа-исключения
 * «Не онлайн», «Без мастеров» с числом — то, что владельцу надо увидеть и поправить.
 */
import { GlobeLock, UserX } from 'lucide-react';
import type { Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { SearchInput } from '@/ui/SearchInput';
import { Select } from '@/ui/Select';

export interface CatalogFilters {
  search: string;
  staffId: string;
  notOnline: boolean;
  noStaff: boolean;
}

export const NO_FILTERS: CatalogFilters = {
  search: '',
  staffId: '',
  notOnline: false,
  noStaff: false,
};

export interface CatalogToolbarProps {
  value: CatalogFilters;
  onValueChange: (value: CatalogFilters) => void;
  staffList: Staff[];
  counts: { notOnline: number; noStaff: number };
}

export function CatalogToolbar({ value, onValueChange, staffList, counts }: CatalogToolbarProps) {
  const t = useT('services');
  const active = value.search.trim() !== '' || value.staffId !== '' || value.notOnline || value.noStaff;
  return (
    <div data-f="F-00-082" className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <SearchInput
        value={value.search}
        onValueChange={(search) => onValueChange({ ...value, search })}
        debounceMs={150}
        placeholder={t('searchPlaceholder')}
        className="md:max-w-sm md:flex-1"
      />
      <Select
        aria-label={t('filters.staff')}
        options={[{ value: '', label: t('filters.allStaff') }, ...staffList.map((s) => ({ value: s.id, label: s.name }))]}
        value={value.staffId}
        onValueChange={(staffId) => onValueChange({ ...value, staffId })}
        className="md:w-56"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          selected={value.notOnline}
          onClick={() => onValueChange({ ...value, notOnline: !value.notOnline })}
          icon={<GlobeLock aria-hidden />}
          count={counts.notOnline}
        >
          {t('list.notOnline')}
        </Chip>
        <Chip
          selected={value.noStaff}
          onClick={() => onValueChange({ ...value, noStaff: !value.noStaff })}
          icon={<UserX aria-hidden />}
          count={counts.noStaff}
        >
          {t('list.noStaff')}
        </Chip>
        {active && (
          <Button variant="ghost" size="sm" onClick={() => onValueChange(NO_FILTERS)}>
            {t('filters.reset')}
          </Button>
        )}
      </div>
    </div>
  );
}

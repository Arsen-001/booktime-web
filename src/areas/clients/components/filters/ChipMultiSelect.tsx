'use client';

/**
 * Множественный выбор чипами вместо столбика радиокнопок на два экрана (ux-r1 №12): статусы, мастера, услуги, категории.
 * Больше 12 вариантов — сверху поле «Найти», чтобы не листать.
 */
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { normalizeSearch } from '@/lib/text';
import { Chip } from '@/ui/Chip';
import { SearchInput } from '@/ui/SearchInput';

export interface ChipMultiSelectProps<T extends string> {
  options: { value: T; label: string }[];
  value?: T[];
  onChange: (v?: T[]) => void;
}

export function ChipMultiSelect<T extends string>({ options, value, onChange }: ChipMultiSelectProps<T>) {
  const t = useT('clients');
  const [query, setQuery] = useState('');
  const selected = new Set(value ?? []);
  const q = normalizeSearch(query);
  const shown = q ? options.filter((o) => selected.has(o.value) || normalizeSearch(o.label).includes(q)) : options;
  const toggle = (v: T) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next.size ? Array.from(next) : undefined);
  };
  if (options.length === 0) return <p className="text-sm text-muted">{t('filters.noOptions')}</p>;
  return (
    <div className="flex flex-col gap-2">
      {options.length > 12 && <SearchInput value={query} onValueChange={setQuery} placeholder={t('filters.findOption')} aria-label={t('filters.findOption')} />}
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => (
          <Chip key={o.value} selected={selected.has(o.value)} onClick={() => toggle(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

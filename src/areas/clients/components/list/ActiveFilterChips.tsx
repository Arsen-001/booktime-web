'use client';

/**
 * Активные группы конструктора фильтров — рядом со списком, не только числом на кнопке (DESIGN.md «Everything else»:
 * фильтры — в одну кнопку с шевроном или в Sheet, активные показаны съёмными чипами). Чип по группе: нажатие на
 * текст открывает конструктор (F-04-017), крестик снимает только эту группу, остальные условия не трогает.
 */
import type { ClientsFilterState, FilterGroupId } from '@/domain/clients';
import { isGroupActive } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { ScrollRow } from '@/ui/ScrollRow';

const GROUPS: FilterGroupId[] = ['clients', 'visits', 'sales'];

export interface ActiveFilterChipsProps {
  value: ClientsFilterState;
  onChange: (next: ClientsFilterState) => void;
  onOpen: () => void;
}

export function ActiveFilterChips({ value, onChange, onOpen }: ActiveFilterChipsProps) {
  const t = useT('clients');
  const active = GROUPS.filter((g) => isGroupActive(g, value));
  if (active.length === 0) return null;

  return (
    <ScrollRow bleed aria-label={t('filters.title')}>
      {active.map((group) => (
        <span key={group} className="shrink-0">
          <Chip onClick={onOpen} onRemove={() => onChange({ ...value, [group]: {} })} removeLabel={t('filters.clearGroup')}>
            {t(`filters.groups.${group}`)}
          </Chip>
        </span>
      ))}
    </ScrollRow>
  );
}

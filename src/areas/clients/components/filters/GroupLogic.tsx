'use client';

/** «Показывать, если выполняются: все условия / любое условие» (F-04-018) — вместо «Связка условий группы: И / Или» */
import type { FilterLogic } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { SegmentedControl } from '@/ui/SegmentedControl';

export function GroupLogic({ value, onChange }: { value: FilterLogic; onChange: (v: FilterLogic) => void }) {
  const t = useT('clients');
  return (
    <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between">
      <span className="text-sm font-medium text-fg">{t('filters.groupLogic')}</span>
      <SegmentedControl
        size="sm"
        value={value}
        onValueChange={(v) => onChange(v as FilterLogic)}
        options={[
          { value: 'and', label: t('filters.and') },
          { value: 'or', label: t('filters.or') },
        ]}
      />
    </div>
  );
}

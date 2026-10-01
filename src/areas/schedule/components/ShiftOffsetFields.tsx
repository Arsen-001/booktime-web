'use client';

import type { Id, ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays } from '@/lib/date';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';

export interface ShiftOffsetFieldsProps {
  staff: { id: Id; name: string }[];
  anchor: ISODate;
  /** Длина цикла (рабочие + выходные) */
  cycle: number;
  offsets: Record<Id, number>;
  onChange: (offsets: Record<Id, number>) => void;
}

/**
 * Г10: у каждого мастера свой первый рабочий день цикла — два мастера работают через смену (А работает, когда Б
 * отдыхает) одной правкой, без запоминания дат. «Через смену» ставит второму сдвиг на длину рабочих дней.
 */
export function ShiftOffsetFields({ staff, anchor, cycle, offsets, onChange }: ShiftOffsetFieldsProps) {
  const t = useT('schedule');
  const format = useFormat();
  if (staff.length === 0 || cycle < 2) return null;
  const options = Array.from({ length: cycle }, (_, i) => ({
    value: String(i),
    label: format.date(addDays(anchor, i), 'weekday'),
  }));
  return (
    <FormField label={t('shiftOffset.label')} hint={t('shiftOffset.hint')}>
      <ul className="flex flex-col gap-2" data-f="F-02-008">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{s.name}</span>
            <Select
              size="sm"
              className="w-auto min-w-40"
              aria-label={t('shiftOffset.for', { name: s.name })}
              value={String(Math.min(offsets[s.id] ?? 0, cycle - 1))}
              onValueChange={(v) => onChange({ ...offsets, [s.id]: Number(v) })}
              options={options}
            />
          </li>
        ))}
      </ul>
    </FormField>
  );
}

'use client';

import type { NetworkOffDayType } from '@/domain/network';
import type { DayTypeId } from '@/domain/schedule';
import { SYSTEM_DAY_TYPES } from '@/domain/schedule';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { Select } from '@/ui/Select';

export interface DayTypeSelectProps {
  value: DayTypeId;
  onValueChange: (value: DayTypeId) => void;
  /** «Нерабочий день» появляется в списке только после первого сохранения графика (F-02-010) */
  allowNotWorking?: boolean;
  disabled?: boolean;
  className?: string;
  /** F-02-011: свои типы нерабочих дней сети, отмеченные для текущей локации — идут следом за системными */
  customTypes?: NetworkOffDayType[];
}

/** Список типов дня (F-02-010) — шесть системных + «Нерабочий день» для удаления (F-02-014) + свои типы сети (F-02-011) */
export function DayTypeSelect({ value, onValueChange, allowNotWorking = false, disabled, className, customTypes }: DayTypeSelectProps) {
  const t = useT('schedule');
  const tDyn = useTDynamic();
  const types = SYSTEM_DAY_TYPES.filter((dt) => dt.id !== 'not_working' || allowNotWorking);
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as DayTypeId)}
      options={[
        ...types.map((dt) => ({ value: dt.id, label: tDyn(`schedule.${dt.labelKey}`) })),
        ...(customTypes ?? []).map((c) => ({ value: `custom:${c.id}`, label: c.name })),
      ]}
      disabled={disabled}
      aria-label={t('panel.type')}
      className={className}
    />
  );
}

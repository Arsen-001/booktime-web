'use client';

/** Строка дня в часах работы: переключатель «работает» и время «с — до» (или «Выходной»). */
import type { DayHours, TimeHM } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Switch } from '@/ui/Switch';
import { TimePicker } from '@/ui/TimePicker';

interface HoursDayRowProps {
  label: string;
  day: DayHours;
  onChange: (day: DayHours) => void;
}

export function HoursDayRow({ label, day, onChange }: HoursDayRowProps) {
  const t = useT('platform');
  const open = day.length > 0;
  const range = day[0];
  return (
    <div className="flex min-h-14 items-center gap-x-3 py-2">
      <Switch
        checked={open}
        onCheckedChange={(on) => onChange(on ? [{ from: '10:00', to: '19:00' }] : [])}
        label={<span className="inline-block w-8 font-medium text-fg capitalize">{label}</span>}
        aria-label={label}
      />
      {open && range ? (
        <div className="ml-auto flex items-center gap-1.5">
          <TimePicker size="sm" step={30} value={range.from} max={range.to} onValueChange={(from: TimeHM) => onChange([{ ...range, from }])} className="w-[6.25rem] sm:w-28" />
          <span aria-hidden className="text-muted">—</span>
          <TimePicker size="sm" step={30} value={range.to} min={range.from} onValueChange={(to: TimeHM) => onChange([{ ...range, to }])} className="w-[6.25rem] sm:w-28" />
        </div>
      ) : (
        <span className="ml-auto text-sm text-muted">{t('connect.dayOff')}</span>
      )}
    </div>
  );
}

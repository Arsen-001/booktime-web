'use client';

/**
 * Длительность часами и минутами с шагом 5 (У23): два выпадающих «ч» и «мин» вместо числа минут.
 * Значение — минуты; пусто (undefined) — если разрешено `optional` и оба поля пустые.
 */
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Select } from '@/ui/Select';

const HOURS = Array.from({ length: 13 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export interface DurationInputProps {
  value: number | undefined;
  onValueChange: (minutes: number | undefined) => void;
  optional?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export function DurationInput({
  value,
  onValueChange,
  optional,
  invalid,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: DurationInputProps) {
  const t = useT('services');
  const h = value == null ? undefined : Math.floor(value / 60);
  const m = value == null ? undefined : value % 60;
  const emit = (hours: number | undefined, minutes: number | undefined) => {
    if (hours == null && minutes == null) return onValueChange(undefined);
    onValueChange((hours ?? 0) * 60 + (minutes ?? 0));
  };
  return (
    <div className={cn('grid min-w-0 grid-cols-2 gap-2', className)}>
      <Select
        id={id}
        aria-label={ariaLabel ? `${ariaLabel}, ${t('durationInput.hours')}` : t('durationInput.hours')}
        options={[
          ...(optional ? [{ value: '', label: '—' }] : []),
          ...HOURS.map((x) => ({
            value: String(x),
            label: t('durationInput.h', { n: x }),
          })),
        ]}
        value={h == null ? '' : String(h)}
        onValueChange={(v) => emit(v === '' ? undefined : Number(v), v === '' ? undefined : (m ?? 0))}
        placeholder={t('durationInput.hours')}
        invalid={invalid}
        disabled={disabled}
      />
      <Select
        aria-label={ariaLabel ? `${ariaLabel}, ${t('durationInput.minutes')}` : t('durationInput.minutes')}
        options={[
          ...(optional ? [{ value: '', label: '—' }] : []),
          ...MINUTES.map((x) => ({
            value: String(x),
            label: t('durationInput.m', { n: x }),
          })),
        ]}
        value={m == null ? '' : String(m)}
        onValueChange={(v) => emit(v === '' ? undefined : (h ?? 0), v === '' ? undefined : Number(v))}
        placeholder={t('durationInput.minutes')}
        invalid={invalid}
        disabled={disabled}
      />
    </div>
  );
}

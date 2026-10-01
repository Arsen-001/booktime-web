'use client';

import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Chip } from '@/ui/Chip';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface WeekdayPickerProps {
  /** Выбранные дни: 0 = понедельник … 6 = воскресенье */
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  /** Быстрые «Будни» и «Каждый день» под рядом (по умолчанию да) */
  presets?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

const WEEKDAYS = [0, 1, 2, 3, 4];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Выбор дней недели: семь круглых переключателей в один ряд (график, шаблоны, правила записи, ресурсы) */
export function WeekdayPicker({
  value,
  defaultValue = [],
  onValueChange,
  presets = true,
  disabled = false,
  invalid = false,
  className,
  id,
  ...aria
}: WeekdayPickerProps) {
  const t = useT('ui');
  const fmt = useFormat();
  const [days, setDays] = useControllableState(value, defaultValue, onValueChange);
  const names = fmt.weekdaysShort();
  const sorted = (next: number[]) => [...next].sort((a, b) => a - b);

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div
        role="group"
        id={id}
        {...aria}
        className={cn(
          'flex max-w-md justify-between gap-1',
          invalid && 'rounded-full ring-2 ring-danger ring-offset-2 ring-offset-surface',
        )}
      >
        {names.map((name, i) => {
          const on = days.includes(i);
          const weekend = i >= 5;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => setDays(sorted(on ? days.filter((d) => d !== i) : [...days, i]))}
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 ease-out first-letter:uppercase',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-95',
                'disabled:cursor-not-allowed disabled:opacity-50',
                on
                  ? 'bg-primary text-primary-contrast shadow-sm hover:bg-primary-hover'
                  : cn(
                      'border border-border-strong/50 bg-surface hover:bg-surface-2',
                      weekend ? 'text-muted' : 'text-fg',
                    ),
              )}
            >
              <span className="first-letter:uppercase">{name}</span>
            </button>
          );
        })}
      </div>
      {presets && (
        <div className="flex flex-wrap gap-2">
          <Chip selected={same(days, WEEKDAYS)} disabled={disabled} onClick={() => setDays(WEEKDAYS)}>
            {t('weekdayPicker.weekdays')}
          </Chip>
          <Chip selected={same(days, EVERY_DAY)} disabled={disabled} onClick={() => setDays(EVERY_DAY)}>
            {t('weekdayPicker.everyDay')}
          </Chip>
        </div>
      )}
    </div>
  );
}

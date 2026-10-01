'use client';

import type { TimeHM } from '@/domain/core';
import { addMinutesHM } from '@/areas/schedule/lib/hours';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Switch } from '@/ui/Switch';
import { TimePicker } from '@/ui/TimePicker';

export interface DayRange {
  from: TimeHM;
  to: TimeHM;
}

export interface WeekdayHoursFieldsProps {
  /** Выбранные дни недели 0=пн…6=вс */
  weekdays: number[];
  /** Свои часы по дням; нет ключа — «как общие» */
  value: Partial<Record<number, DayRange>>;
  onChange: (value: Partial<Record<number, DayRange>>) => void;
  /** Общие часы (из поля «Рабочее время») — по умолчанию у каждого дня */
  base: DayRange | null;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
}

/**
 * Г10: «пн–пт 10–19, сб 10–16» — строка часов на каждый выбранный день недели. По умолчанию день берёт общие часы
 * (поле выше); перерыв общий, если попадает внутрь дня. Неверный день — красная подпись у строки.
 */
export function WeekdayHoursFields({ weekdays, value, onChange, base, enabled, onEnabledChange }: WeekdayHoursFieldsProps) {
  const t = useT('schedule');
  const format = useFormat();
  const names = format.weekdaysShort();
  const days = [...weekdays].sort((a, b) => a - b);
  const rangeOf = (wd: number): DayRange | null => value[wd] ?? base;
  const set = (wd: number, patch: Partial<DayRange>) => {
    const cur = rangeOf(wd) ?? { from: '10:00', to: '19:00' };
    onChange({ ...value, [wd]: { ...cur, ...patch } });
  };

  return (
    <div className="flex flex-col gap-3" data-f="F-02-007">
      <Switch checked={enabled} onCheckedChange={onEnabledChange} label={t('weekdayHours.toggle')} description={t('weekdayHours.hint')} />
      {enabled && (
        <ul className="flex flex-col gap-2">
          {days.map((wd) => {
            const r = rangeOf(wd);
            const bad = Boolean(r && r.to <= r.from);
            return (
              <li key={wd} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={cn('w-8 shrink-0 text-sm font-medium first-letter:uppercase', value[wd] ? 'text-fg' : 'text-muted')}>{names[wd]}</span>
                  <TimePicker
                    className="min-w-0 flex-1"
                    size="sm"
                    value={r?.from ?? null}
                    placeholder="—:—"
                    invalid={bad}
                    onValueChange={(v) => set(wd, { from: v })}
                  />
                  <span className="text-muted" aria-hidden>
                    –
                  </span>
                  <TimePicker
                    className="min-w-0 flex-1"
                    size="sm"
                    value={r?.to ?? null}
                    min={r?.from ? addMinutesHM(r.from, 15) : '00:15'}
                    max="24:00"
                    placeholder="—:—"
                    invalid={bad}
                    onValueChange={(v) => set(wd, { to: v })}
                  />
                </div>
                {bad && <p className="pl-10 text-sm text-danger">{t('panel.errEndBeforeStart')}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

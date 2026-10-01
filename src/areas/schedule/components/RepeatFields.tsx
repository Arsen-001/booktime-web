'use client';

import { NumberStepper } from '@/areas/schedule/components/NumberStepper';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { WeekdayPicker } from '@/ui/WeekdayPicker';

export interface RepeatFieldsProps {
  /** 'none' — только выбранные дни; 'weekdays' / 'shifts' — свои поля; id шаблона — только «на сколько недель» */
  choice: string;
  weekdays: number[];
  onWeekdaysChange: (v: number[]) => void;
  shiftWork: number;
  onShiftWorkChange: (v: number) => void;
  shiftOff: number;
  onShiftOffChange: (v: number) => void;
  weeks: number;
  onWeeksChange: (v: number) => void;
}

/** Г10: готовые циклы смен — одним нажатием вместо двух степперов */
const SHIFT_PRESETS: [number, number][] = [
  [5, 2],
  [2, 2],
  [3, 3],
  [1, 1],
];

/** «Как повторять» в панели графика (F-02-007, F-02-008, F-02-033): дни недели кружками, смены и недели — степпером */
export function RepeatFields(p: RepeatFieldsProps) {
  const t = useT('schedule');
  if (p.choice === 'none') return null;
  return (
    <div className="flex flex-col gap-6">
      {p.choice === 'weekdays' && (
        <div data-f="F-02-007 F-02-033 F-14-111">
          <FormField label={t('templates.weekdays')}>
            <WeekdayPicker value={p.weekdays} onValueChange={p.onWeekdaysChange} />
          </FormField>
        </div>
      )}
      {p.choice === 'shifts' && (
        <div className="flex flex-col gap-3" data-f="F-02-008">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('templates.shiftPresets')}>
            {SHIFT_PRESETS.map(([w, o]) => (
              <Chip
                key={`${w}/${o}`}
                selected={p.shiftWork === w && p.shiftOff === o}
                onClick={() => {
                  p.onShiftWorkChange(w);
                  p.onShiftOffChange(o);
                }}
              >
                {`${w}/${o}`}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            <FormField label={t('templates.shiftWork')}>
              <NumberStepper value={p.shiftWork} onValueChange={p.onShiftWorkChange} min={1} max={14} />
            </FormField>
            <FormField label={t('templates.shiftOff')}>
              <NumberStepper value={p.shiftOff} onValueChange={p.onShiftOffChange} min={0} max={14} />
            </FormField>
          </div>
        </div>
      )}
      <FormField label={t('templates.weeksAhead')}>
        <NumberStepper value={p.weeks} onValueChange={p.onWeeksChange} min={1} max={30} unitLabel={t('panel.weeksValue', { n: p.weeks })} />
      </FormField>
    </div>
  );
}

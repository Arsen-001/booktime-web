'use client';

import { Minus, Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/ui/IconButton';

export interface NumberStepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  /** Подпись значения для скринридера и под числом: «2 недели» */
  unitLabel?: string;
  id?: string;
}

/** Степпер «− 2 +» вместо голого поля number (ux-r2 m-10): «На сколько недель вперёд», «Рабочих дней подряд» */
export function NumberStepper({ value, onValueChange, min, max, unitLabel, id }: NumberStepperProps) {
  const t = useT('schedule');
  const set = (v: number) => onValueChange(Math.min(max, Math.max(min, v)));
  return (
    <div id={id} className="inline-flex items-center gap-2" role="group">
      <IconButton
        icon={<Minus aria-hidden />}
        label={t('panel.decrease')}
        variant="outline"
        disabled={value <= min}
        onClick={() => set(value - 1)}
      />
      <output aria-live="polite" className="min-w-16 text-center text-base font-semibold text-fg tabular-nums">
        {unitLabel ?? value}
      </output>
      <IconButton
        icon={<Plus aria-hidden />}
        label={t('panel.increase')}
        variant="outline"
        disabled={value >= max}
        onClick={() => set(value + 1)}
      />
    </div>
  );
}

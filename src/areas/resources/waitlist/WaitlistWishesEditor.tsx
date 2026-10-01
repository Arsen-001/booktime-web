'use client';

import { Clock, Plus, Trash2 } from 'lucide-react';
import type { WaitlistWishDraft } from '@/api/resources';
import type { TimeHM } from '@/domain/core';
import { today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { IconButton } from '@/ui/IconButton';
import { TimePicker } from '@/ui/TimePicker';

const DAY: { from: TimeHM; to: TimeHM } = { from: '09:00' as TimeHM, to: '18:00' as TimeHM };

/** F-16-153 / F-01-157: «когда ждёт» — дни (или любой день), в каждом «любое время» или интервалы */
export function WaitlistWishesEditor({ value, onChange, showErrors }: { value: WaitlistWishDraft[]; onChange: (next: WaitlistWishDraft[]) => void; showErrors: boolean }) {
  const t = useT('resources');
  const patch = (index: number, p: Partial<WaitlistWishDraft>) => onChange(value.map((s, i) => (i === index ? { ...s, ...p } : s)));

  return (
    <div data-f="F-16-153" className="flex flex-col gap-3">
      <span className="text-sm font-medium text-fg">{t('waitlist.form.slotsTitle')}</span>
      {value.map((slot, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <DatePicker value={slot.date} onValueChange={(d) => patch(index, { date: d ?? undefined })} min={today()} />
            {showErrors && !slot.date && !slot.anyTime && <span className="text-xs text-danger">{t('waitlist.form.dateRequired')}</span>}
            {value.length > 1 && (
              <IconButton
                icon={<Trash2 aria-hidden />}
                label={t('waitlist.form.removeDay')}
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              />
            )}
          </div>
          <Checkbox
            label={t('waitlist.form.anyTimeOfDay')}
            checked={slot.anyTime}
            // Сняли «любое время» — сразу один интервал, иначе заявка молча сохранялась бы «на любое время»
            onCheckedChange={(v) => patch(index, { anyTime: v, intervals: !v && slot.intervals.length === 0 ? [DAY] : slot.intervals })}
          />
          {!slot.anyTime && (
            <div className="flex flex-col gap-1.5">
              {slot.intervals.map((interval, i2) => (
                <div key={i2} className="flex items-center gap-2">
                  <TimePicker value={interval.from} onValueChange={(v) => patch(index, { intervals: slot.intervals.map((iv, j) => (j === i2 ? { ...iv, from: v } : iv)) })} />
                  <span className="text-muted">–</span>
                  <TimePicker value={interval.to} onValueChange={(v) => patch(index, { intervals: slot.intervals.map((iv, j) => (j === i2 ? { ...iv, to: v } : iv)) })} />
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    label={t('waitlist.form.removeInterval')}
                    size="sm"
                    variant="ghost"
                    onClick={() => patch(index, { intervals: slot.intervals.filter((_, j) => j !== i2) })}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" leftIcon={<Clock aria-hidden />} onClick={() => patch(index, { intervals: [...slot.intervals, DAY] })} className="w-fit">
                {t('waitlist.form.addTime')}
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" leftIcon={<Plus aria-hidden />} onClick={() => onChange([...value, { anyTime: true, intervals: [] }])} className="w-fit">
        {t('waitlist.form.addDay')}
      </Button>
    </div>
  );
}

'use client';

/** Шаг «Часы»: часы по дням; индивидуал обязательно выбирает режим календаря (F-00-052), салону — «всё свободно». */
import { CalendarCheck, CalendarX } from 'lucide-react';
import { HoursDayRow } from '@/areas/platform/connect/HoursDayRow';
import type { ConnectForm, StepErrors } from '@/areas/platform/connect/connectForm';
import { WEEK_DAYS, copyMondayToWeekdays } from '@/domain/platform';
import type { CalendarMode } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';

interface StepHoursProps {
  form: ConnectForm;
  errors: StepErrors;
  onChange: (patch: Partial<ConnectForm>) => void;
}

export function StepHours({ form, errors, onChange }: StepHoursProps) {
  const t = useT('platform');
  const fmt = useFormat();
  const labels = fmt.weekdaysShort();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col divide-y divide-border sm:rounded-xl sm:border sm:border-border sm:px-3">
        {WEEK_DAYS.map((d) => (
          <HoursDayRow key={d} label={labels[d]} day={form.hours[d]} onChange={(day) => onChange({ hours: { ...form.hours, [d]: day } })} />
        ))}
      </div>
      <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange({ hours: copyMondayToWeekdays(form.hours) })}>
        {t('connect.copyMonday')}
      </Button>
      {form.kind === 'individual' && (
        <FormField label={t('connect.calendarMode')} required error={errors.calendarMode ? t('connect.issue.calendarMode') : undefined}>
          <ChoiceGroup
            columns={2}
            value={form.calendarMode ?? ''}
            onValueChange={(v) => onChange({ calendarMode: v as CalendarMode })}
            options={[
              { value: 'free', title: t('connect.calendarModeFree'), description: t('connect.calendarModeFreeHint'), icon: <CalendarCheck aria-hidden /> },
              { value: 'busy', title: t('connect.calendarModeBusy'), description: t('connect.calendarModeBusyHint'), icon: <CalendarX aria-hidden /> },
            ]}
          />
        </FormField>
      )}
    </div>
  );
}

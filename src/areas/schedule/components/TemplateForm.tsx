'use client';

/**
 * Форма шаблона (F-02-009): тип (дни недели / смены), дни — кружками, часы с готовыми вариантами и перерывом.
 * Название подставляется само («Пн–Пт, 10:00–19:00»), поэтому «Сохранить» активна сразу (ux-r2 m-21).
 */
import { useState } from 'react';
import type { DayHours, Id } from '@/domain/core';
import type { ScheduleTemplate, TemplateKind } from '@/domain/schedule';
import { createTemplate, updateTemplate } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import { BreaksEditor } from '@/areas/schedule/components/BreaksEditor';
import { NumberStepper } from '@/areas/schedule/components/NumberStepper';
import { WeekdayHoursFields, type DayRange } from '@/areas/schedule/components/WeekdayHoursFields';
import { DEFAULT_HOURS, checkDraft, draftToHours, hoursToDraft, rangeAndBreaksToHours } from '@/areas/schedule/lib/hours';
import { templateAutoName } from '@/areas/schedule/lib/templateName';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useToast } from '@/ui/Toast';
import { WeekdayPicker } from '@/ui/WeekdayPicker';

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function TemplateForm({
  businessId,
  initial,
  editing,
  onSaved,
  onClose,
}: {
  businessId: Id;
  initial?: {
    kind: TemplateKind;
    weekdays?: number[];
    shiftWork?: number;
    shiftOff?: number;
    hours: DayHours;
    weekdayHours?: ScheduleTemplate['weekdayHours'];
  };
  editing?: ScheduleTemplate;
  onSaved?: (template: ScheduleTemplate) => void;
  onClose: () => void;
}) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<Exclude<TemplateKind, 'none'>>(editing?.kind ?? (initial?.kind === 'shifts' ? 'shifts' : 'weekdays'));
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? initial?.weekdays ?? [0, 1, 2, 3, 4]);
  const [shiftWork, setShiftWork] = useState(editing?.shiftWork ?? initial?.shiftWork ?? 2);
  const [shiftOff, setShiftOff] = useState(editing?.shiftOff ?? initial?.shiftOff ?? 2);
  const [draft, setDraft] = useState(hoursToDraft(editing?.hours ?? initial?.hours ?? DEFAULT_HOURS));
  const initialDays = editing?.weekdayHours ?? initial?.weekdayHours ?? {};
  const [dayRanges, setDayRanges] = useState<Partial<Record<number, DayRange>>>(() =>
    Object.fromEntries(Object.entries(initialDays).flatMap(([wd, h]) => (h?.length ? [[wd, { from: h[0].from, to: h[h.length - 1].to }]] : []))),
  );
  const [perDay, setPerDay] = useState(Object.keys(initialDays).length > 0);
  const [tried, setTried] = useState(false);
  const check = checkDraft(draft);
  const hours: DayHours = check.ok ? draftToHours(draft) : [];
  const daysValid = !perDay || Object.values(dayRanges).every((r) => !r || r.to > r.from);
  const create = useApiMutation(createTemplate);
  const update = useApiMutation((p: Parameters<typeof updateTemplate>[2]) => updateTemplate(businessId, editing?.id ?? '', p));

  const autoName = templateAutoName({ kind, weekdays, shiftWork, shiftOff, hours }, format.weekdaysShort(), (w, o) =>
    t('templates.shiftsName', { work: w, off: o }),
  );
  const daysError = tried && kind === 'weekdays' && weekdays.length === 0 ? t('templates.pickDays') : undefined;

  const save = async () => {
    setTried(true);
    if (!check.ok || !daysValid || (kind === 'weekdays' && weekdays.length === 0)) return;
    const weekdayHours: ScheduleTemplate['weekdayHours'] = {};
    if (kind === 'weekdays' && perDay)
      for (const [wd, r] of Object.entries(dayRanges))
        if (r && weekdays.includes(Number(wd)))
          weekdayHours[Number(wd) as Weekday] = rangeAndBreaksToHours({ from: r.from, to: r.to, breaks: draft.breaks });
    const payload = { name: name.trim(), kind, weekdays: weekdays as Weekday[], shiftWork, shiftOff, hours, weekdayHours };
    try {
      if (editing) {
        await update.mutate(payload);
        onSaved?.({ ...editing, ...payload });
      } else {
        const created = await create.mutate({ businessId, ...payload });
        onSaved?.(created);
      }
      toast.success(t('templates.saved'));
      onClose();
    } catch {
      toast.error(t('templates.saveFailed'));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <FormField label={t('templates.kind')}>
        <SegmentedControl
          fullWidth
          value={kind}
          onValueChange={(v) => setKind(v as Exclude<TemplateKind, 'none'>)}
          options={[
            { value: 'weekdays', label: t('templates.kindWeekdays') },
            { value: 'shifts', label: t('templates.kindShifts') },
          ]}
        />
      </FormField>

      {kind === 'weekdays' ? (
        <FormField label={t('templates.weekdays')} error={daysError}>
          <WeekdayPicker value={weekdays} onValueChange={setWeekdays} />
        </FormField>
      ) : (
        <div className="flex flex-wrap gap-6">
          <FormField label={t('templates.shiftWork')}>
            <NumberStepper value={shiftWork} onValueChange={setShiftWork} min={1} max={14} />
          </FormField>
          <FormField label={t('templates.shiftOff')}>
            <NumberStepper value={shiftOff} onValueChange={setShiftOff} min={0} max={14} />
          </FormField>
        </div>
      )}

      <BreaksEditor value={draft} onChange={setDraft} presets />
      {kind === 'weekdays' && (
        <WeekdayHoursFields
          weekdays={weekdays}
          value={dayRanges}
          onChange={setDayRanges}
          base={draft.from && draft.to ? { from: draft.from, to: draft.to } : null}
          enabled={perDay}
          onEnabledChange={setPerDay}
        />
      )}
      {tried && (!check.ok || !daysValid) && <p className="text-sm text-danger">{t('panel.fixErrors')}</p>}

      <FormField label={t('templates.name')} optional hint={t('templates.nameHint')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={autoName} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('panel.cancel')}
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {t('panel.save')}
        </Button>
      </div>
    </form>
  );
}

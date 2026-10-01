'use client';

/**
 * Панель «Настройка графика» (F-02-005…015, F-02-106). Немодальная шторка (ux-r2 M-2): таблица за ней видна, выбор
 * остаётся и после закрытия (Г4). Часы — черновиком с проверкой на месте (Г1, Г5); разные часы в выборе — пустые поля
 * (Г17). Шаблон ЗАМЕНЯЕТ график в периоде, дни отдыха снимают старые часы (Г2); итог считается по всему периоду тем же
 * расчётом, что и тост. Часы по дням недели и сдвиг цикла у каждого мастера (Г10). Правка — в выбранный филиал (Г6).
 * Несохранённое не теряется молча (Г8). Запись — одной мутацией applyPlan.
 */
import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import type { DayHours, Id, ISODate } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import type { DayTypeId, ScheduleTemplate } from '@/domain/schedule';
import { dayTypeById } from '@/domain/schedule';
import { applyPlan, getTemplates, hasSavedSchedule, previewPlan, type AffectedBooking, type PlanEntry, type ScheduleRow } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { addDays, today } from '@/lib/date';
import { AffectedBookingsNotice } from '@/areas/schedule/components/AffectedBookingsNotice';
import { BreaksEditor } from '@/areas/schedule/components/BreaksEditor';
import { DayTypeSelect } from '@/areas/schedule/components/DayTypeSelect';
import { RepeatFields } from '@/areas/schedule/components/RepeatFields';
import { ShiftOffsetFields } from '@/areas/schedule/components/ShiftOffsetFields';
import { TemplateFormModal } from '@/areas/schedule/components/TemplateFormModal';
import { WeekdayHoursFields, type DayRange } from '@/areas/schedule/components/WeekdayHoursFields';
import { DEFAULT_HOURS, checkDraft, draftToHours, hoursToDraft, rangeAndBreaksToHours, sameHours, type HoursDraft } from '@/areas/schedule/lib/hours';
import { templatePlan, type TemplateMode } from '@/areas/schedule/lib/plan';
import { usePlanText } from '@/areas/schedule/lib/usePlanText';
import { useUndoToast } from '@/areas/schedule/lib/useUndoToast';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { useConfirm, useToast } from '@/ui/Toast';

export interface SelectedCell {
  staffId: Id;
  date: ISODate;
}

export interface SchedulePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  selected: SelectedCell[];
  rows: ScheduleRow[];
  actorName: string;
  /** Сохранили — экран снимает выбор */
  onSaved: () => void;
  /** Клетки плана для пунктира в таблице (F-02-005): рабочие — синим, снимаемые дни отдыха — красным */
  onPreviewChange?: (entries: PlanEntry[]) => void;
  /** «Настроить график» без выбора ячеек: кто уже отмечен в «Кому» */
  defaultStaffIds?: Id[];
  /** F-02-011: свои типы нерабочих дней сети — появляются в «Тип» */
  customTypes?: NetworkOffDayType[];
  /** Г6: филиалы, в которые можно писать (больше одного — поле «Филиал») */
  locations: { id: Id; name: string }[];
  defaultLocationId?: Id;
}

type TemplateChoice = TemplateMode | Id;

/** Общие часы выбранных ячеек: одинаковые — они; все пустые — по умолчанию; разные — null (поля пустые, Г17) */
function commonHours(rows: ScheduleRow[], cells: SelectedCell[]): DayHours | null {
  const list = cells.map((c) => rows.find((r) => r.staff.id === c.staffId)?.cells.find((x) => x.date === c.date)?.hours ?? []);
  const working = list.filter((h) => h.length > 0);
  if (working.length === 0) return DEFAULT_HOURS;
  return working.every((h) => sameHours(h, working[0])) ? working[0] : null;
}

export function SchedulePanel({
  open,
  onOpenChange,
  businessId,
  selected,
  rows,
  actorName,
  onSaved,
  onPreviewChange,
  defaultStaffIds = [],
  customTypes,
  locations,
  defaultLocationId,
}: SchedulePanelProps) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const planText = usePlanText();
  const undoToast = useUndoToast();

  const [dirty, setDirty] = useState(false);
  const touch =
    <A,>(set: (v: A) => void) =>
    (v: A) => {
      setDirty(true);
      set(v);
    };

  // «Настроить график» без выбора: кого и с какого дня — прямо в панели
  const [pickedStaff, setPickedStaff] = useState<Id[]>(defaultStaffIds);
  const [startDate, setStartDate] = useState<ISODate>(addDays(today(), 1));
  const pickMode = selected.length === 0;
  const cells = useMemo<SelectedCell[]>(
    () => (pickMode ? pickedStaff.map((staffId) => ({ staffId, date: startDate })) : selected),
    [pickMode, pickedStaff, startDate, selected],
  );

  const [choice, setChoice] = useState<TemplateChoice>('none');
  const effectiveChoice: TemplateChoice = pickMode && choice === 'none' ? 'weekdays' : choice;
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [weeks, setWeeks] = useState(2);
  const [shiftWork, setShiftWork] = useState(2);
  const [shiftOff, setShiftOff] = useState(2);
  const [offsets, setOffsets] = useState<Record<Id, number>>({});
  const [typeId, setTypeId] = useState<DayTypeId>('work');
  const [draft, setDraft] = useState<HoursDraft | null>(null);
  const [perDay, setPerDay] = useState(false);
  const [dayRanges, setDayRanges] = useState<Partial<Record<number, DayRange>>>({});
  const [note, setNote] = useState<string | undefined>(undefined);
  const [locationId, setLocationId] = useState<Id | undefined>(defaultLocationId);
  const [templateModal, setTemplateModal] = useState(false);
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);

  const templatesQuery = useApiQuery(['schedule', 'templates', businessId], () => getTemplates(businessId), { enabled: open });
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const apply = useApiMutation(applyPlan);

  const staffIds = useMemo(() => Array.from(new Set(cells.map((c) => c.staffId))), [cells]);
  const anchor = useMemo(() => cells.map((c) => c.date).sort()[0] ?? today(), [cells]);

  // F-02-010: «Нерабочий день» — только для удаления уже поставленного дня
  const hasScheduleQuery = useApiQuery(['schedule', 'has-saved', staffIds.join(',')], () => hasSavedSchedule(staffIds), {
    enabled: open && staffIds.length > 0,
  });
  const allowNotWorking = hasScheduleQuery.data ?? false;
  const effectiveTypeId: DayTypeId = !allowNotWorking && typeId === 'not_working' ? 'work' : typeId;
  const dt = dayTypeById(effectiveTypeId);

  // Часы — из выбранных ячеек, пока человек их не менял (ux-r5 S-2); разные — пустые поля (Г17)
  const fromCells = commonHours(rows, cells);
  const baseDraft = draft ?? hoursToDraft(fromCells);
  const check = checkDraft(baseDraft);
  const base: DayRange | null = baseDraft.from && baseDraft.to ? { from: baseDraft.from, to: baseDraft.to } : null;
  const mode: TemplateMode = effectiveChoice === 'none' || effectiveChoice === 'weekdays' || effectiveChoice === 'shifts' ? effectiveChoice : 'none';
  const tpl = templates.find((x) => x.id === effectiveChoice);
  const planMode: TemplateMode = tpl ? tpl.kind : mode;
  const perDayOn = perDay && planMode === 'weekdays';
  const daysValid = !perDayOn || Object.values(dayRanges).every((r) => !r || r.to > r.from);
  const valid = !dt.working || (check.ok && daysValid);

  const entries = useMemo<PlanEntry[]>(() => {
    if (!valid || staffIds.length === 0) return [];
    const hours = dt.working ? draftToHours(baseDraft) : [];
    const weekdayHours: Partial<Record<number, DayHours>> = {};
    if (perDayOn)
      for (const [wd, r] of Object.entries(dayRanges))
        if (r) weekdayHours[Number(wd)] = rangeAndBreaksToHours({ from: r.from, to: r.to, breaks: baseDraft.breaks });
    return templatePlan({
      mode: planMode,
      staffIds,
      cells,
      anchor,
      weeks,
      weekdays: tpl?.weekdays ?? weekdays,
      weekdayHours,
      hours,
      shiftWork: tpl?.shiftWork ?? shiftWork,
      shiftOff: tpl?.shiftOff ?? shiftOff,
      offsets,
      typeId: effectiveTypeId,
      note: planMode === 'none' ? note : undefined,
    });
  }, [valid, staffIds, dt.working, baseDraft, perDayOn, dayRanges, planMode, cells, anchor, weeks, tpl, weekdays, shiftWork, shiftOff, offsets, effectiveTypeId, note]);

  const previewLocation = locations.length > 1 ? locationId : undefined;
  const previewQuery = useApiQuery(['schedule', 'plan-preview', previewLocation ?? '', entries], () => previewPlan(entries, previewLocation), {
    enabled: open && entries.length > 0,
    keepPrevious: true,
  });
  const counts = entries.length > 0 ? previewQuery.data : undefined;
  const nothingToChange = counts ? planText.nothing(counts) : false;

  // Пунктир в таблице — только когда план правда изменился (черновик часов пересоздаётся каждый рендер)
  const entriesKey = open ? JSON.stringify(entries) : '';
  useEffect(() => {
    onPreviewChange?.(entriesKey ? entries : []);
  }, [entriesKey]);

  const applyChoice = (value: TemplateChoice) => {
    setDirty(true);
    setChoice(value);
    setAffected(null);
    const chosen = templates.find((x) => x.id === value);
    if (chosen) {
      setDraft(hoursToDraft(chosen.hours));
      setTypeId('work');
      if (chosen.kind === 'weekdays') {
        setWeekdays(chosen.weekdays ?? [0, 1, 2, 3, 4]);
        const own = chosen.weekdayHours ?? {};
        const ranges: Partial<Record<number, DayRange>> = {};
        for (const [wd, h] of Object.entries(own)) if (h?.length) ranges[Number(wd)] = { from: h[0].from, to: h[h.length - 1].to };
        setDayRanges(ranges);
        setPerDay(Object.keys(ranges).length > 0);
      } else {
        setShiftWork(chosen.shiftWork ?? 2);
        setShiftOff(chosen.shiftOff ?? 2);
      }
    }
  };

  const requestClose = async () => {
    if (dirty && !apply.isPending) {
      const leave = await confirm({
        title: t('panel.leaveTitle'),
        description: t('panel.leaveText'),
        confirmLabel: t('panel.leave'),
        cancelLabel: t('panel.stay'),
        tone: 'danger',
      });
      if (!leave) return;
    }
    onOpenChange(false);
  };

  const save = async (force: boolean) => {
    if (entries.length === 0) return;
    try {
      const result = await apply.mutate({
        entries,
        locationId: previewLocation,
        actorName,
        historyAction: planMode === 'none' ? (effectiveTypeId === 'not_working' ? 'delete_days' : 'set_hours') : 'apply_template',
        force,
      });
      if (!result.ok) {
        setAffected(result.affected);
        return;
      }
      undoToast(planText.done(result), result.before);
      setDirty(false);
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  const summary = useMemo(() => {
    if (staffIds.length === 0) return t('panel.pickWho');
    const names = staffIds.map((id) => rows.find((r) => r.staff.id === id)?.staff.name ?? '');
    const dates = Array.from(new Set(cells.map((c) => c.date))).sort();
    const who = names.length === 1 ? names[0] : t('panel.staffCount', { n: names.length });
    const when = pickMode
      ? t('panel.fromDate', { date: format.date(startDate, 'weekday') })
      : dates.length === 1
        ? format.date(dates[0], 'weekday')
        : t('panel.daysCount', { n: dates.length });
    return `${who} · ${when}`;
  }, [staffIds, rows, cells, pickMode, startDate, format, t]);

  const deleting = effectiveTypeId === 'not_working';
  const footerText =
    staffIds.length === 0
      ? t('panel.pickWho')
      : !valid
        ? dt.working && check.range === 'missing'
          ? t('panel.pickHoursHint')
          : t('panel.fixErrors')
        : !counts
          ? t('panel.counting')
          : nothingToChange
            ? t('panel.nothingToChange')
            : planText.preview(counts);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? onOpenChange(o) : void requestClose())}
        title={t('panel.title')}
        description={summary}
        side="auto"
        size="md"
        modal={false}
        footer={
          <div className="flex flex-col gap-2" data-f="F-02-005">
            {affected ? (
              <p className="text-sm font-medium text-fg">{t('panel.confirmWithBookings')}</p>
            ) : (
              <p className="text-sm text-muted" aria-live="polite" data-plan-summary="">
                {footerText}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => void requestClose()}>
                {t('panel.cancel')}
              </Button>
              <Button
                data-f="F-00-061 F-02-032 F-02-034 F-02-014 F-02-035 F-14-110 F-14-112 F-14-113"
                variant={deleting || affected ? 'danger' : 'primary'}
                onClick={() => save(Boolean(affected?.length))}
                loading={apply.isPending}
                disabled={entries.length === 0 || (!affected?.length && (!counts || nothingToChange))}
              >
                {affected?.length ? t('panel.saveKeepBookings') : deleting ? t('panel.removeFromSchedule') : t('panel.save')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-6" data-f="F-02-005">
          {affected && (
            <AffectedBookingsNotice bookings={affected} onResolved={(id) => setAffected((list) => (list ?? []).filter((a) => a.booking.id !== id))} />
          )}

          {pickMode && (
            <>
              <FormField label={t('panel.whoLabel')}>
                <div className="flex flex-wrap gap-2" role="group">
                  {rows.map((r) => (
                    <Chip
                      key={r.staff.id}
                      selected={pickedStaff.includes(r.staff.id)}
                      onClick={() => touch(setPickedStaff)(pickedStaff.includes(r.staff.id) ? pickedStaff.filter((x) => x !== r.staff.id) : [...pickedStaff, r.staff.id])}
                    >
                      {r.staff.name}
                    </Chip>
                  ))}
                </div>
              </FormField>
              <FormField label={t('panel.startLabel')}>
                <DatePicker value={startDate} onValueChange={(d) => d && touch(setStartDate)(d)} min={today()} />
              </FormField>
            </>
          )}

          {locations.length > 1 && (
            <FormField label={t('panel.location')}>
              <Select
                value={locationId ?? ''}
                onValueChange={touch(setLocationId)}
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
                data-f="F-02-001"
              />
            </FormField>
          )}

          <div data-f="F-02-006 F-02-009" className="flex flex-col gap-2">
            <FormField label={t('panel.chooseTemplate')}>
              <Select
                value={effectiveChoice}
                onValueChange={(v) => applyChoice(v as TemplateChoice)}
                options={[
                  ...(pickMode ? [] : [{ value: 'none', label: t('templates.none') }]),
                  { value: 'weekdays', label: t('templates.kindWeekdays') },
                  { value: 'shifts', label: t('templates.kindShifts') },
                  ...templates.map((x) => ({ value: x.id, label: x.name })),
                ]}
              />
            </FormField>
            {effectiveChoice !== 'none' && (
              <Button type="button" variant="ghost" size="sm" leftIcon={<BookmarkPlus aria-hidden />} className="self-start" onClick={() => setTemplateModal(true)}>
                {t('templates.saveAsTemplate')}
              </Button>
            )}
          </div>

          <RepeatFields
            choice={effectiveChoice}
            weekdays={weekdays}
            onWeekdaysChange={touch(setWeekdays)}
            shiftWork={shiftWork}
            onShiftWorkChange={touch(setShiftWork)}
            shiftOff={shiftOff}
            onShiftOffChange={touch(setShiftOff)}
            weeks={weeks}
            onWeeksChange={touch(setWeeks)}
          />

          {planMode === 'shifts' && (
            <ShiftOffsetFields
              staff={staffIds.map((id) => ({ id, name: rows.find((r) => r.staff.id === id)?.staff.name ?? '' }))}
              anchor={anchor}
              cycle={(tpl?.shiftWork ?? shiftWork) + (tpl?.shiftOff ?? shiftOff)}
              offsets={offsets}
              onChange={touch(setOffsets)}
            />
          )}

          <div data-f="F-02-010 F-02-014 F-02-011">
            <FormField label={t('panel.type')}>
              <DayTypeSelect value={effectiveTypeId} onValueChange={touch(setTypeId)} allowNotWorking={allowNotWorking} customTypes={customTypes} />
            </FormField>
          </div>

          {dt.working && (
            <div data-f="F-02-012 F-02-013" className="flex flex-col gap-4">
              <BreaksEditor value={baseDraft} onChange={touch(setDraft)} presets />
              {planMode === 'weekdays' && (
                <WeekdayHoursFields
                  weekdays={tpl?.weekdays ?? weekdays}
                  value={dayRanges}
                  onChange={touch(setDayRanges)}
                  base={base}
                  enabled={perDay}
                  onEnabledChange={touch(setPerDay)}
                />
              )}
            </div>
          )}

          {planMode === 'none' && (
            <FormField label={t('note.label')} optional hint={t('note.hint')}>
              <Input value={note ?? ''} onChange={(e) => touch(setNote)(e.target.value)} placeholder={t('note.placeholder')} maxLength={80} />
            </FormField>
          )}
        </div>
      </Sheet>

      <TemplateFormModal
        open={templateModal}
        onOpenChange={setTemplateModal}
        businessId={businessId}
        initial={{
          kind: planMode === 'shifts' ? 'shifts' : 'weekdays',
          weekdays,
          shiftWork,
          shiftOff,
          hours: check.ok ? draftToHours(baseDraft) : DEFAULT_HOURS,
          weekdayHours: perDayOn
            ? Object.fromEntries(Object.entries(dayRanges).flatMap(([wd, r]) => (r ? [[wd, [{ from: r.from, to: r.to }]]] : [])))
            : undefined,
        }}
        onSaved={(saved: ScheduleTemplate) => applyChoice(saved.id)}
      />
    </>
  );
}

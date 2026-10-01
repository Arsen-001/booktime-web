'use client';

/**
 * Правка одного дня «Моего календаря» в шторке (ux-r5 №3, speed-k1 №4): «Работаю / Не работаю», часы и перерыв с
 * подписями, «Занятое время» (или «Открытое» в режиме «всё занято») с подписанными полями «С» / «До». Часы и тип дня
 * сохраняются кнопкой «Сохранить» с тостом «Отменить»; отметки — сразу, тоже с «Отменить».
 */
import { useState } from 'react';
import { CalendarCheck, Plus } from 'lucide-react';
import type { DayHours, Id, TimeHM } from '@/domain/core';
import type { DayTypeId } from '@/domain/schedule';
import { SYSTEM_DAY_TYPES, dayTypeById } from '@/domain/schedule';
import {
  markCalendarRange,
  openWholeDay,
  removeMarkWithUndo,
  restoreCells,
  saveCalendarDay,
  type AffectedBooking,
  type CalendarDay,
} from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import { AffectedBookingsNotice } from '@/areas/schedule/components/AffectedBookingsNotice';
import { BreaksEditor } from '@/areas/schedule/components/BreaksEditor';
import { useMarksUndo } from '@/areas/schedule/calendar/useMarksUndo';
import { capitalize, checkDraft, DEFAULT_HOURS, draftToHours, hoursToDraft, sameHours, type HoursDraft } from '@/areas/schedule/lib/hours';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { toMinutes } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { TimePicker } from '@/ui/TimePicker';
import { useConfirm, useToast } from '@/ui/Toast';

export interface CalendarDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: Id;
  day: CalendarDay;
  mode: 'free' | 'busy' | undefined;
  actorName: string;
  /** Можно менять часы и тип дня (schedule.edit) */
  canEditHours: boolean;
  /** Г6: филиал, в котором правим день */
  locationId?: Id;
}

const OFF_TYPES = SYSTEM_DAY_TYPES.filter((d) => !d.working);

export function CalendarDaySheet({ open, onOpenChange, staffId, day, mode, actorName, canEditHours, locationId }: CalendarDaySheetProps) {
  const t = useT('schedule');
  const tDyn = useTDynamic();
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const undoMarks = useMarksUndo(staffId);

  const initialWorking = day.hours.length > 0 && (day.typeId === null || dayTypeById(day.typeId).working);
  const [working, setWorking] = useState(initialWorking);
  const [offType, setOffType] = useState<DayTypeId>(day.typeId && !dayTypeById(day.typeId).working ? day.typeId : 'not_working');
  const [draft, setDraft] = useState<HoursDraft>(hoursToDraft(day.hours.length ? day.hours : DEFAULT_HOURS));
  const [note, setNote] = useState(day.note ?? '');
  const check = checkDraft(draft);
  const hours: DayHours = check.ok ? draftToHours(draft) : [];
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);
  const [markFrom, setMarkFrom] = useState<TimeHM | null>(null);
  const [markTo, setMarkTo] = useState<TimeHM | null>(null);
  const [tried, setTried] = useState(false);

  const save = useApiMutation(saveCalendarDay);
  const restore = useApiMutation(restoreCells);
  const addMark = useApiMutation((r: { from: TimeHM; to: TimeHM }) => markCalendarRange(staffId, day.date, r.from, r.to));
  const removeMark = useApiMutation(removeMarkWithUndo);
  const openDay = useApiMutation(() => openWholeDay(staffId, day.date));

  const kind = mode === 'busy' ? 'free' : 'busy';
  const marks = day.marks.filter((m) => m.kind === kind);
  const noteChanged = note.trim() !== (day.note ?? '');
  const changed =
    noteChanged ||
    working !== initialWorking ||
    (working ? !check.ok || !sameHours(hours, day.hours) : offType !== (day.typeId ?? 'not_working'));
  // Г8: несохранённое не теряется молча — «Выйти без сохранения?»
  const requestClose = async () => {
    if (changed && !save.isPending) {
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
  const bounds =
    working && hours.length ? { min: hours[0].from, max: hours[hours.length - 1].to } : { min: '00:00' as TimeHM, max: '24:00' as TimeHM };
  const rangeError =
    tried && (!markFrom || !markTo)
      ? t('calendar.markNeedBoth')
      : markFrom && markTo && toMinutes(markTo) <= toMinutes(markFrom)
        ? t('calendar.markEndAfterStart')
        : undefined;

  const doSave = async (force: boolean) => {
    if (working && !check.ok) return;
    try {
      const result = await save.mutate({
        staffId,
        date: day.date,
        typeId: working ? 'work' : offType,
        hours: working ? hours : [],
        actorName,
        force,
        note: noteChanged ? note.trim() : undefined,
        locationId,
      });
      if (!result.ok) {
        setAffected(result.affected);
        return;
      }
      const before = result.before;
      toast.show({
        title: working ? t('calendar.daySaved') : t('calendar.dayCancelled'),
        tone: 'success',
        durationMs: 5000,
        action: {
          label: t('panel.undo'),
          onClick: () =>
            void restore.mutate(before).then(
              () => toast.info(t('panel.undone')),
              () => toast.error(t('calendar.actionFailed')),
            ),
        },
      });
      onOpenChange(false);
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  const doAddMark = async () => {
    setTried(true);
    if (!markFrom || !markTo || toMinutes(markTo) <= toMinutes(markFrom)) return;
    try {
      const r = await addMark.mutate({ from: markFrom, to: markTo });
      const range = `${markFrom}–${markTo}`;
      undoMarks(kind === 'busy' ? t('calendar.hourBusy', { range }) : t('calendar.hourOpened', { range }), r);
      setMarkFrom(null);
      setMarkTo(null);
      setTried(false);
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doRemoveMark = async (id: Id, range: string) => {
    try {
      const r = await removeMark.mutate(id);
      undoMarks(t('calendar.hourFreed', { range }), r);
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doOpenDay = async () => {
    try {
      const r = await openDay.mutate(undefined);
      if (r.changed === 0) toast.info(t('calendar.dayAlreadyOpen'));
      else undoMarks(t('calendar.openedWholeDay'), r);
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(o) : void requestClose())}
      title={capitalize(format.date(day.date, 'weekdayLong'))}
      description={day.bookings > 0 ? t('calendar.bookingsCount', { n: day.bookings }) : undefined}
      side="auto"
      size="md"
      footer={
        canEditHours ? (
          <div className="flex flex-wrap justify-end gap-2">
            {affected ? (
              <LinkButton variant="ghost" href={`/biz/journal?date=${day.date}`}>
                {t('panel.openJournal')}
              </LinkButton>
            ) : (
              <Button variant="ghost" onClick={() => void requestClose()}>
                {t('panel.cancel')}
              </Button>
            )}
            <Button
              onClick={() => doSave(Boolean(affected?.length))}
              loading={save.isPending}
              disabled={(!changed && !affected) || (working && !check.ok)}
              variant={affected?.length ? 'danger' : 'primary'}
            >
              {affected?.length ? t('panel.saveKeepBookings') : t('panel.save')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6" data-f="F-00-053 F-02-027 F-02-035 F-14-113">
        {affected && (
          <AffectedBookingsNotice bookings={affected} onResolved={(id) => setAffected((list) => (list ?? []).filter((a) => a.booking.id !== id))} />
        )}

        {canEditHours && (
          <SegmentedControl
            fullWidth
            aria-label={t('panel.type')}
            value={working ? 'work' : 'off'}
            onValueChange={(v) => {
              setWorking(v === 'work');
              setAffected(null);
            }}
            options={[
              { value: 'work', label: t('calendar.working') },
              { value: 'off', label: t('calendar.notWorking') },
            ]}
          />
        )}

        {(working || !canEditHours) && (
          <SectionCard
            title={mode === 'busy' ? t('calendar.openTimeTitle') : t('calendar.busyTimeTitle')}
            description={mode === 'busy' ? t('calendar.openTimeHint') : t('calendar.busyTimeHint')}
            padding="sm"
            actions={
              mode === 'busy' && (
                <Button size="sm" variant="secondary" leftIcon={<CalendarCheck aria-hidden />} loading={openDay.isPending} onClick={doOpenDay}>
                  {t('calendar.openWholeDay')}
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-4" data-f="F-00-054">
              {marks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {marks.map((m) => {
                    const range = `${m.from}–${m.to}`;
                    return (
                      <Chip key={m.id} onRemove={() => doRemoveMark(m.id, range)} removeLabel={t('calendar.removeMarkFor', { range })}>
                        {range}
                      </Chip>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">{mode === 'busy' ? t('calendar.noOpenHours') : t('calendar.noBusyMarks')}</p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <FormField label={t('calendar.from')} className="min-w-28 flex-1">
                  <TimePicker value={markFrom} onValueChange={setMarkFrom} min={bounds.min} max={bounds.max} step={15} placeholder="—" />
                </FormField>
                <FormField label={t('calendar.to')} className="min-w-28 flex-1" error={rangeError}>
                  <TimePicker value={markTo} onValueChange={setMarkTo} min={markFrom ?? bounds.min} max={bounds.max} step={15} placeholder="—" />
                </FormField>
                <Button variant="outline" leftIcon={<Plus aria-hidden />} loading={addMark.isPending} onClick={doAddMark}>
                  {mode === 'busy' ? t('calendar.markOpen') : t('calendar.markBusy')}
                </Button>
              </div>
            </div>
          </SectionCard>
        )}

        {canEditHours && (
          <>
            {working ? (
              <div data-f="F-02-017">
                <BreaksEditor value={draft} onChange={setDraft} presets />
              </div>
            ) : (
              <FormField label={t('calendar.offReason')}>
                <Select
                  value={offType}
                  onValueChange={(v) => setOffType(v as DayTypeId)}
                  options={OFF_TYPES.map((d) => ({
                    value: d.id,
                    label: d.id === 'not_working' ? t('calendar.dayOff') : tDyn(`schedule.${d.labelKey}`),
                  }))}
                />
              </FormField>
            )}
            <FormField label={t('note.label')} optional hint={t('note.hint')}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('note.placeholder')} maxLength={80} />
            </FormField>
          </>
        )}
      </div>
    </Sheet>
  );
}

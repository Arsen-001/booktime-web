'use client';

import { CalendarCheck } from 'lucide-react';
import type { CalendarMark, DayHours, Id, ISODate, TimeHM } from '@/domain/core';
import { markCalendarRange, openWholeDay } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import { useMarksUndo } from '@/areas/schedule/calendar/useMarksUndo';
import { useT } from '@/i18n/useT';
import { fromMinutes, nowDateTime, toMinutes } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SlotButton } from '@/ui/SlotButton';
import { SlotRow } from '@/ui/SlotRow';
import { useToast } from '@/ui/Toast';

export interface TodayHoursStripProps {
  staffId: Id;
  date: ISODate;
  hours: DayHours;
  marks: CalendarMark[];
  mode: 'free' | 'busy' | undefined;
}

/**
 * «Занято сегодня» за одно нажатие (F-00-054 «провести пальцем по часам», speed-k1 №2, k3 №2): рабочие часы сегодня
 * кнопками по часу; нажатие — час занят (или открыт в режиме «всё занято»), повторное — снова свободен. Прошедшие часы
 * неактивны. Отклик — тост «Занято 16:00–17:00 · Отменить» (speed-k1 №3).
 */
export function TodayHoursStrip({ staffId, date, hours, marks, mode }: TodayHoursStripProps) {
  const t = useT('schedule');
  const toast = useToast();
  const undo = useMarksUndo(staffId);
  const mark = useApiMutation((r: { from: TimeHM; to: TimeHM }) => markCalendarRange(staffId, date, r.from, r.to));
  const openDay = useApiMutation(() => openWholeDay(staffId, date));
  const kind = mode === 'busy' ? 'free' : 'busy';
  const nowMin = toMinutes(nowDateTime().slice(11, 16) as TimeHM);

  if (hours.length === 0) return null;
  const start = Math.floor(toMinutes(hours[0].from) / 60) * 60;
  const end = toMinutes(hours[hours.length - 1].to);
  const slots: { from: TimeHM; to: TimeHM }[] = [];
  for (let m = start; m + 60 <= end; m += 60) slots.push({ from: fromMinutes(m), to: fromMinutes(m + 60) });
  const covered = (s: { from: TimeHM; to: TimeHM }) =>
    marks.some((m) => m.kind === kind && toMinutes(m.from) <= toMinutes(s.from) && toMinutes(m.to) >= toMinutes(s.to));

  const toggle = async (s: { from: TimeHM; to: TimeHM }) => {
    try {
      const r = await mark.mutate(s);
      const range = `${s.from}–${s.to}`;
      undo(
        r.removed
          ? t('calendar.hourFreed', { range })
          : kind === 'busy'
            ? t('calendar.hourBusy', { range })
            : t('calendar.hourOpened', { range }),
        r,
      );
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doOpenDay = async () => {
    try {
      const r = await openDay.mutate(undefined);
      if (r.changed === 0) toast.info(t('calendar.dayAlreadyOpen'));
      else undo(t('calendar.openedWholeDay'), r);
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4" data-f="F-00-054" data-tour="schedule-hours">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-fg">{mode === 'busy' ? t('calendar.todayOpenTitle') : t('calendar.todayBusyTitle')}</p>
          <p className="text-sm text-muted">{mode === 'busy' ? t('calendar.todayOpenHint') : t('calendar.todayBusyHint')}</p>
        </div>
        {mode === 'busy' && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<CalendarCheck aria-hidden />}
            loading={openDay.isPending}
            onClick={doOpenDay}
            data-tour="schedule-open-day"
          >
            {t('calendar.openWholeDay')}
          </Button>
        )}
      </div>
      <SlotRow>
        {slots.map((s) => {
          const past = toMinutes(s.to) <= nowMin;
          const on = covered(s);
          return (
            <SlotButton
              key={s.from}
              selected={on}
              disabled={past || mark.isPending}
              disabledReason={past ? t('calendar.hourPast') : undefined}
              onClick={() => toggle(s)}
              aria-label={`${s.from}–${s.to}: ${on ? (kind === 'busy' ? t('calendar.hourIsBusy') : t('calendar.hourIsOpen')) : t('calendar.hourIsFree')}`}
            >
              {s.from}
            </SlotButton>
          );
        })}
      </SlotRow>
    </Card>
  );
}

'use client';

/**
 * Г12 «Повторить неделю вперёд на N недель» — самое частое действие салона: неделя-образец (видимая в таблице)
 * повторяется день в день. Пунктир в таблице показывает, что изменится; итог — тем же расчётом, что и тост; «Отменить» 5 с.
 */
import { useEffect, useMemo, useState } from 'react';
import { Repeat } from 'lucide-react';
import type { Id, ISODate } from '@/domain/core';
import { applyPlan, previewPlan, snapshotCells, type AffectedBooking, type PlanEntry } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { AffectedBookingsNotice } from '@/areas/schedule/components/AffectedBookingsNotice';
import { NumberStepper } from '@/areas/schedule/components/NumberStepper';
import { repeatWeekPlan } from '@/areas/schedule/lib/plan';
import { usePlanText } from '@/areas/schedule/lib/usePlanText';
import { useUndoToast } from '@/areas/schedule/lib/useUndoToast';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays } from '@/lib/date';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

export interface RepeatWeekModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Чью неделю повторяем (один мастер из меню строки или все с графиком) */
  staffIds: Id[];
  whoLabel: string;
  weekStart: ISODate;
  locationId?: Id;
  actorName: string;
  onPreviewChange?: (entries: PlanEntry[]) => void;
}

export function RepeatWeekModal({ open, onOpenChange, staffIds, whoLabel, weekStart, locationId, actorName, onPreviewChange }: RepeatWeekModalProps) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const planText = usePlanText();
  const undoToast = useUndoToast();
  const [weeks, setWeeks] = useState(4);
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);
  const apply = useApiMutation(applyPlan);
  const until = addDays(weekStart, 7 * (weeks + 1) - 1);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const sourceQuery = useApiQuery(['schedule', 'week-source', staffIds.join(','), weekStart, locationId ?? ''], () => snapshotCells(staffIds, weekDates, locationId), {
    enabled: open && staffIds.length > 0,
  });
  const entries = useMemo(() => (sourceQuery.data ? repeatWeekPlan(sourceQuery.data, weekStart, until) : []), [sourceQuery.data, weekStart, until]);
  const previewQuery = useApiQuery(['schedule', 'plan-preview', locationId ?? '', entries], () => previewPlan(entries, locationId), {
    enabled: open && entries.length > 0,
    keepPrevious: true,
  });
  const counts = entries.length > 0 ? previewQuery.data : undefined;

  // Пунктир в таблице — только когда план правда изменился (черновик часов пересоздаётся каждый рендер)
  const entriesKey = open ? JSON.stringify(entries) : '';
  useEffect(() => {
    onPreviewChange?.(entriesKey ? entries : []);
  }, [entriesKey]);

  const run = async (force: boolean) => {
    if (entries.length === 0) return;
    try {
      const result = await apply.mutate({ entries, locationId, actorName, historyAction: 'copy_schedule', force });
      if (!result.ok) {
        setAffected(result.affected);
        return;
      }
      undoToast(planText.done(result), result.before);
      onOpenChange(false);
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('repeat.title')}
      description={t('repeat.hint', { who: whoLabel, week: `${format.date(weekStart, 'dayMonth')} – ${format.date(addDays(weekStart, 6), 'dayMonth')}` })}
      size="sm"
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted" aria-live="polite" data-plan-summary="">
            {counts ? (planText.nothing(counts) ? t('panel.nothingToChange') : planText.preview(counts)) : ' '}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('panel.cancel')}
            </Button>
            <Button
              leftIcon={<Repeat aria-hidden />}
              variant={affected?.length ? 'danger' : 'primary'}
              loading={apply.isPending}
              disabled={!counts || (planText.nothing(counts) && !affected?.length)}
              onClick={() => void run(Boolean(affected?.length))}
            >
              {affected?.length ? t('panel.saveKeepBookings') : t('repeat.apply')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-f="F-02-015 F-02-033">
        {affected && (
          <AffectedBookingsNotice bookings={affected} onResolved={(id) => setAffected((list) => (list ?? []).filter((a) => a.booking.id !== id))} />
        )}
        <FormField label={t('repeat.weeks')} hint={t('repeat.until', { date: format.date(until, 'dayMonth') })}>
          <NumberStepper
            value={weeks}
            onValueChange={(n) => {
              setWeeks(n);
              setAffected(null);
            }}
            min={1}
            max={26}
            unitLabel={t('panel.weeksValue', { n: weeks })}
          />
        </FormField>
      </div>
    </Modal>
  );
}

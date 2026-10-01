'use client';

/**
 * Г11 «Отсутствие»: отпуск, больничный, отгул… с «с — по» (можно с сегодня и заранее), с комментарием и проверкой
 * записей (Г3) — вместо «В отпуске до…» с одним полем и отпуском только с завтра. Г16 «Выходной салона»: даты и
 * название — закрывает всех мастеров, название видно заметкой в клетке и над колонкой журнала.
 */
import { useState } from 'react';
import { Plane, Store } from 'lucide-react';
import type { Id, ISODate } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import type { DayTypeId } from '@/domain/schedule';
import { SYSTEM_DAY_TYPES } from '@/domain/schedule';
import { previewPlan, setAbsence, type AffectedBooking } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { AffectedBookingsNotice } from '@/areas/schedule/components/AffectedBookingsNotice';
import { usePlanText } from '@/areas/schedule/lib/usePlanText';
import { useUndoToast } from '@/areas/schedule/lib/useUndoToast';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { eachDay, today } from '@/lib/date';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';

export interface AbsenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'absence' — отсутствие выбранных сотрудников; 'holiday' — выходной всего салона */
  kind: 'absence' | 'holiday';
  staffIds: Id[];
  /** Подпись «кому» — имя или «3 сотрудника» */
  whoLabel?: string;
  initialFrom?: ISODate;
  initialTo?: ISODate;
  locationId?: Id;
  actorName: string;
  customTypes?: NetworkOffDayType[];
  onSaved?: () => void;
}

const ABSENCE_TYPES = SYSTEM_DAY_TYPES.filter((d) => !d.working && d.id !== 'not_working');

export function AbsenceModal({
  open,
  onOpenChange,
  kind,
  staffIds,
  whoLabel,
  initialFrom,
  initialTo,
  locationId,
  actorName,
  customTypes,
  onSaved,
}: AbsenceModalProps) {
  const t = useT('schedule');
  const tDyn = useTDynamic();
  const toast = useToast();
  const planText = usePlanText();
  const undoToast = useUndoToast();
  const holiday = kind === 'holiday';
  const [typeId, setTypeId] = useState<DayTypeId>(holiday ? 'not_working' : 'vacation');
  const [from, setFrom] = useState<ISODate | null>(initialFrom ?? today());
  const [to, setTo] = useState<ISODate | null>(initialTo ?? initialFrom ?? (kind === 'holiday' ? today() : null));
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);
  const save = useApiMutation(setAbsence);

  const rangeOk = Boolean(from && to && to >= from);
  const nameOk = !holiday || note.trim().length > 0;
  const entries =
    rangeOk && from && to && staffIds.length > 0
      ? staffIds.flatMap((staffId) => eachDay(from, to).map((date) => ({ staffId, date, hours: null, typeId, note: note.trim() || undefined })))
      : [];
  const previewQuery = useApiQuery(['schedule', 'plan-preview', locationId ?? '', entries], () => previewPlan(entries, locationId), {
    enabled: open && entries.length > 0,
    keepPrevious: true,
  });

  const submit = async (force: boolean) => {
    setTried(true);
    if (!rangeOk || !nameOk || !from || !to) return;
    try {
      const result = await save.mutate({ staffIds, from, to, typeId, note: note.trim() || undefined, locationId, actorName, force });
      if (!result.ok) {
        setAffected(result.affected);
        return;
      }
      undoToast(planText.done(result), result.before);
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const counts = entries.length > 0 ? previewQuery.data : undefined;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={holiday ? t('absence.holidayTitle') : t('absence.title')}
      description={holiday ? t('absence.holidayHint') : whoLabel}
      size="md"
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted" aria-live="polite" data-plan-summary="">
            {counts ? planText.preview(counts) : ' '}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('panel.cancel')}
            </Button>
            <Button
              leftIcon={holiday ? <Store aria-hidden /> : <Plane aria-hidden />}
              variant={affected?.length ? 'danger' : 'primary'}
              loading={save.isPending}
              onClick={() => void submit(Boolean(affected?.length))}
            >
              {affected?.length ? t('panel.saveKeepBookings') : holiday ? t('absence.holidayApply') : t('absence.apply')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-f={holiday ? 'F-02-103' : 'F-02-010 F-00-054'}>
        {affected && (
          <AffectedBookingsNotice bookings={affected} onResolved={(id) => setAffected((list) => (list ?? []).filter((a) => a.booking.id !== id))} />
        )}
        {holiday ? (
          <FormField label={t('absence.holidayName')} error={tried && !nameOk ? t('absence.holidayNameNeeded') : undefined}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absence.holidayPlaceholder')} maxLength={60} />
          </FormField>
        ) : (
          <FormField label={t('absence.type')}>
            <Select
              value={typeId}
              onValueChange={(v) => {
                setTypeId(v as DayTypeId);
                setAffected(null);
              }}
              options={[
                ...ABSENCE_TYPES.map((d) => ({ value: d.id, label: tDyn(`schedule.${d.labelKey}`) })),
                ...(customTypes ?? []).map((c) => ({ value: `custom:${c.id}`, label: c.name })),
              ]}
            />
          </FormField>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <FormField label={t('absence.from')} className="flex-1" error={tried && !from ? t('absence.needDate') : undefined}>
            <DatePicker
              value={from}
              onValueChange={(d) => {
                setFrom(d);
                setAffected(null);
                if (d && (!to || to < d)) setTo(d);
              }}
              min={today()}
            />
          </FormField>
          <FormField
            label={t('absence.to')}
            className="flex-1"
            error={tried && !rangeOk ? (to ? t('absence.toBeforeFrom') : t('absence.needDate')) : undefined}
          >
            <DatePicker
              value={to}
              onValueChange={(d) => {
                setTo(d);
                setAffected(null);
              }}
              min={from ?? today()}
              placeholder={t('absence.toPlaceholder')}
            />
          </FormField>
        </div>
        {!holiday && (
          <FormField label={t('absence.comment')} optional>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absence.commentPlaceholder')} maxLength={80} />
          </FormField>
        )}
      </div>
    </Modal>
  );
}

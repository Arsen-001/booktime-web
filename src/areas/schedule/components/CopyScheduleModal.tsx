'use client';

import { useState } from 'react';
import type { Id, Staff } from '@/domain/core';
import { copySchedule, maxCopyToDate, previewCopy, type AffectedBooking } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { AffectedBookingsNotice } from '@/areas/schedule/components/AffectedBookingsNotice';
import { usePlanText } from '@/areas/schedule/lib/usePlanText';
import { useUndoToast } from '@/areas/schedule/lib/useUndoToast';
import { today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { SearchInput } from '@/ui/SearchInput';
import { useToast } from '@/ui/Toast';

export interface CopyScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStaff: Staff;
  staffList: Staff[];
  actorName: string;
  /** Г6: филиал, из которого копируем и в который пишем */
  locationId?: Id;
}

/**
 * «Скопировать график» (F-02-015): кому, период (до конца следующего месяца), перерывы. Г12: у каждого получателя —
 * сколько его дней перезапишется, после копирования «Отменить» 5 с; записи в задетых днях — список с действиями.
 */
export function CopyScheduleModal({ open, onOpenChange, fromStaff, staffList, actorName, locationId }: CopyScheduleModalProps) {
  const t = useT('schedule');
  const toast = useToast();
  const planText = usePlanText();
  const undoToast = useUndoToast();
  const [query, setQuery] = useState('');
  const [toIds, setToIds] = useState<Id[]>([]);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(maxCopyToDate());
  const [includeBreaks, setIncludeBreaks] = useState(true);
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);
  const copy = useApiMutation(copySchedule);

  const input = { fromStaffId: fromStaff.id, toStaffIds: toIds, from, to, includeBreaks, actorName, locationId };
  const previewQuery = useApiQuery(
    ['schedule', 'copy-preview', fromStaff.id, toIds.join(','), from, to, includeBreaks, locationId ?? ''],
    () => previewCopy(input),
    { enabled: open && toIds.length > 0, keepPrevious: true },
  );
  const preview = toIds.length > 0 ? previewQuery.data : undefined;
  const candidates = staffList.filter((s) => s.id !== fromStaff.id && s.name.toLowerCase().includes(query.toLowerCase()));

  const run = async (force: boolean) => {
    if (toIds.length === 0) return;
    try {
      const result = await copy.mutate({ ...input, force });
      if (!result.ok) {
        setAffected(result.affected);
        return;
      }
      undoToast(`${t('copy.done', { n: toIds.length })} · ${planText.done(result)}`, result.before);
      onOpenChange(false);
    } catch {
      toast.error(t('copy.failed'));
    }
  };

  const willChange = (id: Id) => {
    const c = preview?.perStaff[id];
    return c ? c.added + c.changed + c.removed : undefined;
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('copy.title', { name: fromStaff.name })}
      size="md"
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted" aria-live="polite" data-plan-summary="">
            {preview ? planText.preview(preview) : t('copy.pickWho')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('panel.cancel')}
            </Button>
            <Button
              onClick={() => void run(Boolean(affected?.length))}
              loading={copy.isPending}
              disabled={toIds.length === 0}
              variant={affected?.length ? 'danger' : 'primary'}
            >
              {affected?.length ? t('panel.saveKeepBookings') : t('copy.action')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-f="F-02-015">
        {affected && (
          <AffectedBookingsNotice bookings={affected} onResolved={(id) => setAffected((list) => (list ?? []).filter((a) => a.booking.id !== id))} />
        )}
        <FormField label={t('copy.to')} hint={t('copy.toHint')}>
          <SearchInput value={query} onValueChange={setQuery} placeholder={t('copy.searchPlaceholder')} />
        </FormField>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-2">
          {candidates.length === 0 && <p className="p-2 text-sm text-muted">{t('copy.noStaff')}</p>}
          {candidates.map((s) => {
            const n = toIds.includes(s.id) ? willChange(s.id) : undefined;
            return (
              <div key={s.id} className="flex items-center justify-between gap-2 pr-1">
                <Checkbox
                  label={s.name}
                  checked={toIds.includes(s.id)}
                  onCheckedChange={(checked) => {
                    setAffected(null);
                    setToIds(checked ? [...toIds, s.id] : toIds.filter((id) => id !== s.id));
                  }}
                />
                {n !== undefined && (
                  <span className="shrink-0 text-xs text-muted tabular-nums">{n > 0 ? t('copy.willChange', { n }) : t('copy.sameAlready')}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <FormField label={t('copy.from')} className="flex-1">
            <DatePicker value={from} onValueChange={(v) => v && setFrom(v)} min={today()} max={maxCopyToDate()} />
          </FormField>
          <FormField label={t('copy.periodTo')} className="flex-1">
            <DatePicker value={to} onValueChange={(v) => v && setTo(v)} min={from} max={maxCopyToDate()} />
          </FormField>
        </div>

        <Checkbox label={t('copy.includeBreaks')} checked={includeBreaks} onCheckedChange={setIncludeBreaks} />
      </div>
    </Modal>
  );
}

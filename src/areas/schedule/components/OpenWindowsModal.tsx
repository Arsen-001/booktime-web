'use client';

import { useState } from 'react';
import { setScheduleOpenUntil } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import type { Id, ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

/**
 * «Открыть окна до …» (владелец 17.11.2026, DESIGN.md №11): у мастера срок, после которого клиенты не видят окна
 * (WorkSchedule.openUntil, F-00-055) — в графике эти дни заштрихованы «клиенты не видят». Здесь срок двигают:
 * до выбранного дня или «Без срока».
 */
export function OpenWindowsModal({
  staff,
  onClose,
}: {
  staff: { id: Id; name: string; openUntil?: ISODate } | null;
  onClose: () => void;
}) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const [date, setDate] = useState<ISODate | null>(null);
  const save = useApiMutation((a: { staffId: Id; until: ISODate | undefined }) => setScheduleOpenUntil(a.staffId, a.until));
  const minDate = today();
  // Предложение по умолчанию — месяц вперёд от сегодня или от прежнего срока, что позже
  const suggested = addDays(staff?.openUntil && staff.openUntil > minDate ? staff.openUntil : minDate, 30);
  const value = date ?? suggested;

  const apply = async (until: ISODate | undefined) => {
    if (!staff) return;
    try {
      await save.mutate({ staffId: staff.id, until });
      toast.success(until ? t('openWindows.savedUntil', { date: format.date(until, 'long') }) : t('openWindows.savedNoLimit'));
      setDate(null);
      onClose();
    } catch {
      toast.error(t('openWindows.failed'));
    }
  };

  return (
    <Modal
      open={staff !== null}
      onOpenChange={(open) => {
        if (!open) {
          setDate(null);
          onClose();
        }
      }}
      size="sm"
      title={t('openWindows.title', { name: staff?.name ?? '' })}
      description={staff?.openUntil ? t('openWindows.current', { date: format.date(staff.openUntil, 'long') }) : undefined}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={save.isPending} onClick={() => void apply(undefined)}>
            {t('openWindows.noLimit')}
          </Button>
          <Button loading={save.isPending} onClick={() => void apply(value)}>
            {t('openWindows.openUntil', { date: format.date(value, 'short') })}
          </Button>
        </div>
      }
    >
      <FormField label={t('openWindows.dateLabel')} hint={t('openWindows.hint')}>
        <DatePicker value={value} min={minDate} onValueChange={(d) => setDate(d)} />
      </FormField>
    </Modal>
  );
}

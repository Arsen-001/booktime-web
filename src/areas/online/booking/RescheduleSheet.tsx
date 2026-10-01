'use client';

import { useState } from 'react';
import type { PlanQuery, PlanSlot } from '@/api/online';
import { SlotPicker } from '@/areas/online/booking/SlotPicker';
import type { Booking, ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

/**
 * О19: перенос — тот же экран времени, что при записи (отметки дней, «Утро/День/Вечер», ближайшая дата),
 * открывается на дате текущей записи, текущее время — отдельной пометкой. Мастер и услуги те же.
 */
export function RescheduleSheet({
  open,
  onOpenChange,
  booking,
  slug,
  rescheduleUntil,
  onConfirm,
  pending,
  hourCycle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  slug: string;
  rescheduleUntil: string | undefined;
  onConfirm: (start: string) => void;
  pending: boolean;
  hourCycle?: '24' | '12';
}) {
  const t = useT('online');
  const format = useFormat({ hourCycle });
  const [date, setDate] = useState<ISODate>(booking.start.slice(0, 10));
  const [slot, setSlot] = useState<PlanSlot | undefined>();
  const plan: PlanQuery = {
    businessId: booking.businessId,
    slug,
    locationId: booking.locationId,
    legs: [{ serviceIds: booking.services.map((l) => l.serviceId), staffIds: [booking.staffId], durationMin: booking.durationMin }],
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('confirmed.reschedule')}
      description={t('confirmed.rescheduleHint')}
      footer={
        <Button fullWidth disabled={!slot || slot.date !== date} loading={pending} onClick={() => slot && onConfirm(slot.start)}>
          {slot ? t('confirmed.rescheduleTo', { date: format.date(slot.start, 'weekday'), time: format.time(slot.start) }) : t('confirmed.rescheduleConfirm')}
        </Button>
      }
    >
      <SlotPicker
        plan={open ? plan : undefined}
        date={date}
        autoNearest={false}
        onDateChange={(d) => {
          setDate(d);
          setSlot(undefined);
        }}
        selectedStart={slot?.start}
        onSelect={setSlot}
        hourCycle={hourCycle}
        currentNote={
          <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-sm" data-f="F-03-099 F-03-066">
            <p className="text-fg">{t('confirmed.rescheduleCurrent', { date: format.date(booking.start, 'weekday'), time: format.time(booking.start) })}</p>
            {rescheduleUntil && <p className="text-muted">{t('confirmed.rescheduleUntil', { date: format.dateTime(rescheduleUntil) })}</p>}
          </div>
        }
      />
    </Sheet>
  );
}

'use client';

import { useState } from 'react';
import { CalendarX } from 'lucide-react';
import type { FreeSlot } from '@/api/schedule';
import type { BookingSlotDay } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today, addDays } from '@/lib/date';
import { EmptyState } from '@/ui/EmptyState';
import { ScrollRow } from '@/ui/ScrollRow';
import { Skeleton } from '@/ui/Skeleton';
import { SlotButton } from '@/ui/SlotButton';

/**
 * Шаг «Время» (F-00-092): дни — плитками «пт / 26» в ленте с затуханием края и стрелками на десктопе (ux-r2 №7–8),
 * время выбранного дня — кнопками SlotButton. Только окна, подходящие по длительности услуги (getBookingDays).
 * `current` — время текущей записи (перенос): отмечено на своём дне и недоступно.
 */
export function SlotPicker({
  days,
  loading,
  value,
  current,
  onSelect,
}: {
  days: BookingSlotDay[] | undefined;
  loading: boolean;
  value?: string;
  current?: string;
  onSelect: (slot: FreeSlot) => void;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const [pickedDate, setPickedDate] = useState<string | undefined>(undefined);

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="rect" className="h-16 w-16 shrink-0 rounded-xl" />
          ))}
        </div>
        <Skeleton variant="rect" className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!days?.length) {
    return <EmptyState compact icon={<CalendarX />} title={t('book.noSlots')} description={t('book.noSlotsHint')} />;
  }

  const fallbackDate = value ? days.find((d) => d.slots.some((s) => s.start === value))?.date : undefined;
  const active = days.find((d) => d.date === pickedDate) ?? days.find((d) => d.date === fallbackDate) ?? days[0];
  const t0 = today();
  const dayTop = (date: string) =>
    date === t0 ? t('book.dayToday') : date === addDays(t0, 1) ? t('book.dayTomorrow') : fmt.date(date, 'weekday').split(',')[0];

  return (
    <div className="flex flex-col gap-4">
      <ScrollRow aria-label={t('book.daysLabel')}>
        {days.map((d) => {
          const selected = d.date === active.date;
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={selected}
              onClick={() => setPickedDate(d.date)}
              className={cn(
                'relative flex min-h-16 min-w-16 flex-col items-center justify-center rounded-xl border px-2 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
                selected ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-surface text-fg hover:bg-surface-2',
              )}
            >
              <span className="text-xs text-muted first-letter:uppercase">{dayTop(d.date)}</span>
              <span className="text-base font-semibold tabular-nums">{Number(d.date.slice(8, 10))}</span>
              {current?.startsWith(d.date) && <span aria-hidden className="absolute bottom-1 size-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </ScrollRow>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {active.slots.map((slot) => (
          <SlotButton
            key={`${slot.locationId}-${slot.start}`}
            selected={slot.start === value}
            disabled={slot.start === current}
            disabledReason={slot.start === current ? t('reschedule.currentSlot') : undefined}
            onClick={() => onSelect(slot)}
            className="w-full"
          >
            {fmt.time(slot.start)}
          </SlotButton>
        ))}
      </div>
    </div>
  );
}

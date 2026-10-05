'use client';

/**
 * ⭐ Выбор времени выдачи на /o/<код> (06.10.2026): дни недели, где есть свободное время, и окна выбранного дня; одна
 * большая кнопка «Приду завтра в 15:30». Время заняли, пока выбирал, — тост и окна перечитываются. Часть PublicPickupCard.
 */
import { useState } from 'react';
import { CalendarX } from 'lucide-react';
import { bookPublicPickup } from '@/api/orders-public';
import { ApiError, useApiMutation } from '@/api/request';
import type { ISODateTime } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { usePickupSlots } from '@/areas/orders/lib/usePublicOrderData';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ScrollRow } from '@/ui/ScrollRow';
import { Skeleton } from '@/ui/Skeleton';
import { SlotButton } from '@/ui/SlotButton';
import { useToast } from '@/ui/Toast';

export function PickupPicker({
  code,
  current,
  onDone,
  onStale,
  dayText,
}: {
  code: string;
  current: ISODateTime | null;
  onDone: () => void;
  onStale: () => void;
  dayText: (v: string) => string;
}) {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const q = usePickupSlots(code, true);
  const bookM = useApiMutation(bookPublicPickup);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<ISODateTime | null>(null);
  const days = q.data?.days ?? [];
  const active = days.find((d) => d.date === day) ?? days[0];

  async function book() {
    if (!slot) return;
    try {
      await bookM.mutate({ code, start: slot });
      toast.success(t('public.pickup.doneToast', { day: dayText(slot), time: fmt.time(slot) }));
      setSlot(null);
      onDone();
    } catch (err) {
      const errCode = err instanceof ApiError ? err.code : '';
      if (errCode === 'slot_taken') {
        toast.error(t('public.pickup.taken'));
        setSlot(null);
        void q.refetch();
      } else if (errCode === 'pickup_disabled' || errCode === 'order_not_ready' || errCode === 'pickup_changed') {
        toast.error(t('public.pickup.unavailable'));
        onStale();
      } else {
        toast.error(t('public.pickup.failed'));
      }
    }
  }

  if (q.isLoading) {
    return (
      <div aria-busy className="mt-4 flex flex-col gap-3">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rect" className="h-11 w-24 rounded-full md:h-10" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rect" className="h-11 w-16 rounded-lg md:h-10" />
          ))}
        </div>
        <Skeleton variant="rect" className="h-12 w-full rounded-lg" />
      </div>
    );
  }
  if (q.isError) return <ErrorState className="mt-4" onRetry={q.refetch} />;
  if (!active) {
    return <EmptyState className="mt-4" icon={<CalendarX aria-hidden />} title={t('public.pickup.none')} description={t('public.pickup.noneHint')} />;
  }

  return (
    <div data-f="orders-pickup-picker" className="mt-4 flex flex-col gap-4">
      <ScrollRow aria-label={t('public.pickup.daysLabel')}>
        {days.map((d) => (
          <Chip
            key={d.date}
            selected={d.date === active.date}
            onClick={() => {
              setDay(d.date);
              setSlot(null);
            }}
          >
            <span className="first-letter:uppercase">{fmt.relativeDay(d.date)}</span>
          </Chip>
        ))}
      </ScrollRow>
      <div role="group" aria-label={t('public.pickup.slotsLabel', { day: dayText(active.date) })} className="flex flex-wrap gap-2">
        {active.slots.map((s) => (
          <SlotButton key={s} selected={s === slot || (!slot && s === current)} aria-pressed={s === slot} onClick={() => setSlot(s)}>
            {fmt.time(s)}
          </SlotButton>
        ))}
      </div>
      <Button size="lg" fullWidth disabled={!slot || slot === current} loading={bookM.isPending} onClick={() => void book()}>
        {slot ? t('public.pickup.confirm', { day: dayText(slot), time: fmt.time(slot) }) : t('public.pickup.choose')}
      </Button>
    </div>
  );
}

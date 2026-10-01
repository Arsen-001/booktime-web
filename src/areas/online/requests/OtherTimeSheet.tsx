'use client';

import { useState } from 'react';
import { offerOtherTimes, suggestOtherTimes } from '@/api/online';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { SlotButton } from '@/ui/SlotButton';
import { useToast } from '@/ui/Toast';

const MAX_OFFER = 3;

/**
 * О28 «Другое время»: ближайшие свободные окна того же мастера — мастер отмечает до трёх и отправляет клиенту
 * одним нажатием. Окна не бронируются: клиент выберет одно сам.
 */
export function OtherTimeSheet({ bookingId, onOpenChange }: { bookingId: string | undefined; onOpenChange: (open: boolean) => void }) {
  const t = useT('online');
  const format = useFormat();
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedFor, setPickedFor] = useState<string | undefined>(bookingId);
  if (pickedFor !== bookingId) {
    setPickedFor(bookingId);
    setPicked([]);
  }

  const slotsQ = useApiQuery(['online', 'request-other-times', bookingId], () => suggestOtherTimes(bookingId ?? ''), { enabled: Boolean(bookingId) });
  const offerMutation = useApiMutation((starts: string[]) => offerOtherTimes(bookingId ?? '', starts));

  const toggle = (start: string) =>
    setPicked((prev) => (prev.includes(start) ? prev.filter((s) => s !== start) : prev.length >= MAX_OFFER ? prev : [...prev, start]));

  const send = async () => {
    try {
      await offerMutation.mutate(picked);
      toast.success(t('requests.otherTime.sent', { count: picked.length }));
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'slot_taken') {
        // окна устарели (заняли или сменился график) — показать свежие и выбрать заново
        setPicked([]);
        void slotsQ.refetch();
        toast.error(t('requests.otherTime.slotTaken'));
      } else toast.error(t('requests.actionFailed'));
    }
  };

  return (
    <Sheet
      open={Boolean(bookingId)}
      onOpenChange={onOpenChange}
      title={t('requests.otherTime.title')}
      description={t('requests.otherTime.hint')}
      footer={
        <Button fullWidth disabled={picked.length === 0} loading={offerMutation.isPending} onClick={send}>
          {picked.length > 0 ? t('requests.otherTime.sendCount', { count: picked.length }) : t('requests.otherTime.send')}
        </Button>
      }
    >
      {slotsQ.isLoading ? (
        <div className="flex flex-wrap gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-11 w-36 rounded-lg" />
          ))}
        </div>
      ) : (slotsQ.data ?? []).length === 0 ? (
        <EmptyState compact title={t('requests.otherTime.emptyTitle')} description={t('requests.otherTime.emptyText')} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {(slotsQ.data ?? []).map((s) => (
            <SlotButton key={s} selected={picked.includes(s)} onClick={() => toggle(s)} aria-pressed={picked.includes(s)}>
              {format.date(s, 'weekday')}, {format.time(s)}
            </SlotButton>
          ))}
        </div>
      )}
    </Sheet>
  );
}

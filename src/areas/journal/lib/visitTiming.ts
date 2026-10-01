'use client';

/**
 * ⭐ Визит не по расписанию (29.09.2026, контроль рабочего дня) — два действия журнала, оба освобождают время в конце:
 *  - «Закончили раньше» (F-00-058, finishEarly): идущий визит укорачивается до отработанного, остаток — свободное окно;
 *  - «Пришёл раньше — начать сейчас»: клиент уже здесь, мастер свободен — запись встаёт на «сейчас» (шаг 5 мин) и
 *    сразу «Пришёл»; время после неё освобождается. Занято — причина тостом, запись на месте.
 * Тост «Освободилось 12:25–12:45» несёт «Предложить окно» — событие OFFER_GAP_EVENT, экран журнала открывает лист
 * ожидания (тот же путь, что «Можно заполнить окно» в «Требует внимания»).
 */
import { useMemo } from 'react';
import type { Booking } from '@/domain/core';
import { changeBookingStatus, updateBooking } from '@/api/core';
import { hasOverlap, syncArrivedConsequences } from '@/api/journal';
import { finishEarly } from '@/api/schedule';
import { ApiError } from '@/api/request';
import { startMinutes } from '@/areas/journal/lib/board';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addMinutes, fromMinutes, nowYerevan, today } from '@/lib/date';
import { useToast } from '@/ui/Toast';

/** Журнал открывает лист ожидания по этому событию (JournalScreen) */
export const OFFER_GAP_EVENT = 'journal:offer-gap';

const BEFORE: Booking['status'][] = ['scheduled', 'client_confirmed'];

function nowMinute(): number {
  const n = nowYerevan();
  return n.hour() * 60 + n.minute();
}

/** Идёт сейчас по времени и отмечен «Пришёл» — можно «Закончили раньше» */
export function canFinishEarly(b: Booking, nowMin: number | null): boolean {
  if (nowMin === null || b.deletedAt || b.groupEventId || b.status !== 'arrived') return false;
  const start = startMinutes(b);
  return start <= nowMin && nowMin < start + b.durationMin - 5;
}

/** Сегодняшняя запись ещё впереди (больше чем через 5 мин), клиента ждут — можно «Пришёл раньше» */
export function canStartNow(b: Booking, nowMin: number | null): boolean {
  if (nowMin === null || b.deletedAt || b.groupEventId || !BEFORE.includes(b.status)) return false;
  return startMinutes(b) > nowMin + 5;
}

export function useVisitTiming() {
  const t = useT('journal');
  const tc = useT('common');
  const toast = useToast();
  const format = useFormat({ hourCycle: useJournalHourFormat() });

  return useMemo(() => {
    const range = (from: string, to: string) => `${format.time(from)}–${format.time(to)}`;
    const offer = { label: t('board.timing.offer'), onClick: () => window.dispatchEvent(new Event(OFFER_GAP_EVENT)) };

    const finishNow = async (b: Booking): Promise<boolean> => {
      const oldEnd = addMinutes(b.start, b.durationMin);
      try {
        const updated = await finishEarly(b.id);
        const newEnd = addMinutes(updated.start, updated.durationMin);
        toast.success(t('board.timing.finished', { end: format.time(newEnd), gap: range(newEnd, oldEnd) }), {
          action: offer,
          durationMs: 8000,
        });
        return true;
      } catch (e) {
        toast.error(e instanceof ApiError && e.code === 'not_ongoing' ? t('board.timing.notOngoing') : tc('states.actionFailed'));
        return false;
      }
    };

    const startNow = async (b: Booking): Promise<boolean> => {
      if (b.start.slice(0, 10) !== today()) return false;
      const startMin = Math.floor(nowMinute() / 5) * 5;
      const start = `${b.start.slice(0, 10)}T${fromMinutes(startMin)}`;
      const prev = { start: b.start, status: b.status };
      try {
        if (await hasOverlap(b.staffId, start, b.durationMin, b.id)) {
          toast.error(t('board.timing.busy'));
          return false;
        }
        await updateBooking(b.id, { start });
        await changeBookingStatus(b.id, 'arrived', 'business');
        await syncArrivedConsequences(b.id, 'arrived');
        const newEnd = addMinutes(start, b.durationMin);
        const oldEnd = addMinutes(b.start, b.durationMin);
        toast.success(t('board.timing.started', { time: format.time(start), gap: range(newEnd, oldEnd) }), {
          action: offer,
          durationMs: 8000,
        });
        return true;
      } catch {
        // Не дошли до конца — вернуть как было, чтобы запись не осталась полу-перенесённой
        await updateBooking(b.id, prev).catch(() => {});
        toast.error(tc('states.actionFailed'));
        return false;
      }
    };

    return { finishNow, startNow };
  }, [t, tc, toast, format]);
}

export type VisitTiming = ReturnType<typeof useVisitTiming>;

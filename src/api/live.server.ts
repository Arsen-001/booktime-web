'use client';

/**
 * Живые изменения в режиме api (docs/backend/PLAN.md Р9, §7): чужие правки приходят событиями SSE /v1/live, и экран
 * перечитывает свои запросы. Слушаем каналы сотрудников своего бизнеса (staff:{id} — туда сервер шлёт booking.changed,
 * slots.changed) и по событию перечитываем зеркало записей/графика: запросы, читающие ядро браузера, обновятся сами
 * (их метки core.bookings / core.schedules). Несколько событий подряд — одно перечитывание.
 */
import { API_URL } from '@/api/http';
import { bookingsWindow, syncBookings, syncSchedule } from '@/api/mirror';
import type { Id } from '@/domain/core';
import { notifyDbChange, readDbUntracked } from '@/mock/db';

const MAX_CHANNELS = 20;
const DEBOUNCE_MS = 700;

export function startLive(businessId: Id, businessIds: Id[] = [businessId]): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => undefined;
  const staff = readDbUntracked()
    .core.staff.filter((s) => s.businessId === businessId && s.status !== 'fired')
    .slice(0, MAX_CHANNELS - 1)
    .map((s) => `staff:${s.id}`);
  const channels = ['me', ...staff].join(',');
  const source = new EventSource(`${API_URL}/v1/live?channels=${encodeURIComponent(channels)}`, { withCredentials: true });
  let bookingsTimer: ReturnType<typeof setTimeout> | undefined;
  let scheduleTimer: ReturnType<typeof setTimeout> | undefined;
  const changedIds = new Set<Id>();
  /**
   * Зеркало держит записи только около сегодня (src/api/mirror.ts, BOOKINGS_WINDOW): правка записи за краем окна его не
   * меняет — тогда будим читателей записей сами (журнал на дальнем дне, «Записи», карточка клиента перечитают сервер).
   */
  const resync = async () => {
    const ids = [...changedIds];
    changedIds.clear();
    await syncBookings(businessIds);
    const { from, to } = bookingsWindow();
    const bookings = readDbUntracked().core.bookings;
    const outside = ids.some((id) => {
      const day = bookings.find((b) => b.id === id)?.start.slice(0, 10);
      return !day || day < from || day > to;
    });
    if (outside) notifyDbChange('core.bookings');
  };
  const onBookings = (e: MessageEvent) => {
    try {
      const data = JSON.parse(String(e.data)) as { bookingIds?: Id[] };
      for (const id of data.bookingIds ?? []) changedIds.add(id);
    } catch {
      // событие без списка записей — только перечитать окно
    }
    clearTimeout(bookingsTimer);
    bookingsTimer = setTimeout(() => void resync().catch(() => undefined), DEBOUNCE_MS);
  };
  const onSchedule = () => {
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => void syncSchedule(businessId).catch(() => undefined), DEBOUNCE_MS);
  };
  source.addEventListener('booking.changed', onBookings);
  source.addEventListener('schedule.changed', onSchedule);
  source.addEventListener('mark.changed', onSchedule);
  return () => {
    clearTimeout(bookingsTimer);
    clearTimeout(scheduleTimer);
    source.close();
  };
}

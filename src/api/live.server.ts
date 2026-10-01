'use client';

/**
 * Живые изменения в режиме api (docs/backend/PLAN.md Р9, §7): чужие правки приходят событиями SSE /v1/live, и экран
 * перечитывает свои запросы. Слушаем каналы сотрудников своего бизнеса (staff:{id} — туда сервер шлёт booking.changed,
 * slots.changed) и по событию перечитываем зеркало записей/графика: запросы, читающие ядро браузера, обновятся сами
 * (их метки core.bookings / core.schedules). Несколько событий подряд — одно перечитывание.
 */
import { API_URL } from '@/api/http';
import { syncBookings, syncSchedule } from '@/api/mirror';
import type { Id } from '@/domain/core';
import { useDb } from '@/mock/db';

const MAX_CHANNELS = 20;
const DEBOUNCE_MS = 700;

export function startLive(businessId: Id, businessIds: Id[] = [businessId]): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => undefined;
  const staff = useDb
    .getState()
    .core.staff.filter((s) => s.businessId === businessId && s.status !== 'fired')
    .slice(0, MAX_CHANNELS - 1)
    .map((s) => `staff:${s.id}`);
  const channels = ['me', ...staff].join(',');
  const source = new EventSource(`${API_URL}/v1/live?channels=${encodeURIComponent(channels)}`, { withCredentials: true });
  let bookingsTimer: ReturnType<typeof setTimeout> | undefined;
  let scheduleTimer: ReturnType<typeof setTimeout> | undefined;
  const onBookings = () => {
    clearTimeout(bookingsTimer);
    bookingsTimer = setTimeout(() => void syncBookings(businessIds).catch(() => undefined), DEBOUNCE_MS);
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

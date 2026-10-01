'use client';

/**
 * ⭐ «Записать на следующий визит» (30.09.2026; перезапись при расчёте — главный показатель у Mangomint/Phorest):
 * после оплаты или у пришедшего клиента одна кнопка — тот же клиент, мастер и услуги через интервал повтора услуги
 * (Service.repeatIntervalDays, самый короткий; нет — через 4 недели), в ближайшее свободное окно у того же мастера,
 * как можно ближе к прежнему времени. Журнал открывает новую запись с этим окном — остаётся «Сохранить».
 *
 * Кнопки не знают про экран: шлют NEXT_VISIT_EVENT с id записи, JournalScreen ищет окно и открывает запись.
 */
import type { Booking, Service } from '@/domain/core';
import { getFreeSlots } from '@/api/schedule';
import { startMinutes } from '@/areas/journal/lib/board';
import { addDays, nowYerevan, today } from '@/lib/date';

export const NEXT_VISIT_EVENT = 'journal:next-visit';

/** Нет интервала у услуги — предлагаем через столько дней */
const DEFAULT_REPEAT_DAYS = 28;
/** Сколько дней после целевой даты искать окно */
const SEARCH_DAYS = 7;

export function openNextVisit(bookingId: string) {
  window.dispatchEvent(new CustomEvent(NEXT_VISIT_EVENT, { detail: bookingId }));
}

export function repeatDaysOf(b: Booking, services: Service[]): number {
  const days = b.services
    .map((l) => services.find((s) => s.id === l.serviceId)?.repeatIntervalDays)
    .filter((n): n is number => Boolean(n && n > 0));
  return days.length ? Math.min(...days) : DEFAULT_REPEAT_DAYS;
}

/** Ближайшее окно того же мастера от «визит + интервал»; ближе к прежнему времени дня. null — за неделю ничего */
export async function findNextVisitSlot(b: Booking, services: Service[]): Promise<{ date: string; time: string } | null> {
  const from = addDays(b.start.slice(0, 10), repeatDaysOf(b, services));
  const first = from < today() ? today() : from;
  const wantMin = startMinutes(b);
  // Дата — в теле цикла, не в «i++, date = addDays(…)»: сборщик (Turbopack) не переписывает импорт в update-части
  // for — в браузере было «addDays is not defined», и «Записать на следующий визит» молча ничего не открывало
  for (let i = 0; i < SEARCH_DAYS; i++) {
    const date = addDays(first, i);
    const slots = await getFreeSlots({
      staffId: b.staffId,
      date,
      durationMin: b.durationMin,
      locationId: b.locationId,
      serviceId: b.services[0]?.serviceId,
    }).catch(() => []);
    if (!slots.length) continue;
    const best = [...slots].sort(
      (x, y) => Math.abs(startMinutes(x) - wantMin) - Math.abs(startMinutes(y) - wantMin),
    )[0];
    return { date, time: best.start.slice(11, 16) };
  }
  return null;
}

/**
 * F-01-192 «Дублировать» (решение 01.10.2026): копия не встаёт на то же время к тому же мастеру — окно новой записи
 * получает ближайшее свободное окно мастера в тот же день (не в прошлом), как можно ближе к прежнему времени. null —
 * свободных окон в этот день нет, время выбирают сами.
 */
export async function findSameDaySlot(b: Booking): Promise<string | null> {
  const date = b.start.slice(0, 10);
  const slots = await getFreeSlots({
    staffId: b.staffId,
    date,
    durationMin: b.durationMin,
    locationId: b.locationId,
    serviceId: b.services[0]?.serviceId,
  }).catch(() => []);
  const n = nowYerevan();
  const nowMin = date === today() ? n.hour() * 60 + n.minute() : -1;
  const wantMin = startMinutes(b);
  const best = slots
    .filter((x) => startMinutes(x) > nowMin)
    .sort((x, y) => Math.abs(startMinutes(x) - wantMin) - Math.abs(startMinutes(y) - wantMin))[0];
  return best ? best.start.slice(11, 16) : null;
}

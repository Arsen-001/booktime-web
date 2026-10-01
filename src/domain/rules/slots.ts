/**
 * СВОБОДНЫЕ ОКНА — БАЗА расчёта (F-00-056/057, F-00-092, arch-a1 №2): часы (с режимом календаря) − занятость
 * (с запасами, домашними записями той же персоны, групповыми событиями, без просроченной предоплаты) − прошлое.
 * Строится на тех же функциях, что checkSlot() (rules/busy), поэтому показанное окно проходит проверку при записи.
 *
 * Хозяин окон — раздел schedule: его computeFreeSlots накладывает СВОИ правила поверх базы (сетка/плотность слотов,
 * «время до визита», недоступные дни, openUntil, ресурсы — F-02-04x…07x) и обязан брать занятость и часы из
 * busyIntervals()/staffWorkIntervals(), а не считать своими циклами. freeSlots() — для тех, кому правила слотов
 * не нужны (тесты, сервер, загрузка дня). Чистая функция: «сейчас» — параметр now ('YYYY-MM-DDTHH:mm', Ереван).
 */
import type { CoreData, ISODate, ISODateTime, Id, Minutes, Service, Workplace } from '@/domain/core';
import { addDays, datePart, toMinutes } from '@/lib/date';
import { atMinutes, busyIntervals, overlaps, staffWorkIntervals, type Interval } from '@/domain/rules/busy';
import { bookedDuration } from '@/domain/rules/pricing';

export interface SlotQuery {
  staffId: Id;
  date: ISODate;
  /** Бронируемая длительность, мин (для «от–до» — bookedDuration(service)) */
  durationMin: Minutes;
  /** Запас после услуги, мин */
  bufferAfterMin?: Minutes;
  locationId?: Id;
  workplace?: Workplace;
  /** Шаг начала окна, мин (по умолчанию 30) */
  stepMin?: Minutes;
}

export interface FreeSlot {
  staffId: Id;
  locationId: Id;
  workplace: Workplace;
  start: ISODateTime;
  end: ISODateTime;
}

export const DEFAULT_SLOT_STEP: Minutes = 30;

/** Параметры окна под услугу: длительность «от–до» бронирует верхнюю границу + запас услуги (F-00-057) */
export function slotNeedsForService(service: Pick<Service, 'durationMin' | 'durationMax' | 'bufferAfterMin'>): {
  durationMin: Minutes;
  bufferAfterMin: Minutes;
} {
  return { durationMin: bookedDuration(service), bufferAfterMin: service.bufferAfterMin ?? 0 };
}

/** Свободные окна мастера на дату: часы (с режимом календаря) − занятость (с запасами) − прошедшее время */
export function freeSlots(core: CoreData, q: SlotQuery, now: ISODateTime): FreeSlot[] {
  const step = q.stepMin ?? DEFAULT_SLOT_STEP;
  const need = q.durationMin + (q.bufferAfterMin ?? 0);
  const work = staffWorkIntervals(core, q.staffId, q.date, { locationId: q.locationId, workplace: q.workplace });
  if (!work.length) return [];
  const busy: Interval[] = busyIntervals(core, q.staffId, q.date, { now }).map((b) => [b.from, b.to] as const);
  const today = datePart(now);
  if (q.date < today) return [];
  const minStart = q.date === today ? toMinutes(now.slice(11, 16)) : 0;

  const seen = new Set<string>();
  const out: FreeSlot[] = [];
  for (const w of work) {
    let t = Math.ceil(Math.max(w.from, minStart) / step) * step;
    for (; t + need <= w.to; t += step) {
      const span: Interval = [t, t + need];
      if (busy.some((b) => overlaps(span, b))) continue;
      const key = `${t}|${w.locationId}|${w.workplace}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        staffId: q.staffId,
        locationId: w.locationId,
        workplace: w.workplace,
        start: atMinutes(q.date, t),
        end: atMinutes(q.date, t + q.durationMin),
      });
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start));
}

/** Ближайшие окна на days дней вперёд от сегодняшнего (по now), не больше limit */
export function nearestSlots(
  core: CoreData,
  q: Omit<SlotQuery, 'date'> & { days?: number; limit?: number },
  now: ISODateTime,
): FreeSlot[] {
  const days = q.days ?? 14;
  const limit = q.limit ?? 5;
  const out: FreeSlot[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    out.push(...freeSlots(core, { ...q, date: addDays(datePart(now), i) }, now));
  }
  return out.slice(0, limit);
}

/** Первый день с окнами начиная с from (до maxDays вперёд) — «ближайшая доступная дата» (F-03-085) */
export function nearestAvailableDate(
  core: CoreData,
  q: Omit<SlotQuery, 'date'>,
  from: ISODate,
  now: ISODateTime,
  maxDays = 60,
): ISODate | undefined {
  for (let i = 0; i < maxDays; i++) {
    const date = addDays(from, i);
    if (freeSlots(core, { ...q, date }, now).length) return date;
  }
  return undefined;
}

/**
 * ⭐ Ближайшие свободные начала того же мастера на ту же длительность (В-03): заявку сняли без ответа мастера или
 * мастер предлагает «другое время» — клиенту 3 окна, не больше двух в день, начиная с дня записи (или сегодня).
 */
export function nearestFreeStarts(
  core: CoreData,
  b: { staffId: Id; start: ISODateTime; durationMin: Minutes; locationId?: Id; workplace?: Workplace },
  now: ISODateTime,
  count = 3,
  days = 14,
): ISODateTime[] {
  const out: ISODateTime[] = [];
  let date = datePart(b.start) < datePart(now) ? datePart(now) : datePart(b.start);
  for (let i = 0; i < days && out.length < count; i++, date = addDays(date, 1)) {
    const slots = freeSlots(core, { staffId: b.staffId, date, durationMin: b.durationMin, locationId: b.locationId, workplace: b.workplace }, now);
    let perDay = 0;
    for (const sl of slots) {
      if (sl.start === b.start || sl.start <= now) continue;
      out.push(sl.start);
      if (++perDay >= 2 || out.length >= count) break;
    }
  }
  return out;
}

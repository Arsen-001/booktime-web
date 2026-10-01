import type { Booking, DayHours, Id, Minutes } from '@/domain/core';
import { freeGaps } from '@/areas/journal/lib/board';

/**
 * «Найти окно» (⭐ наше, 29.09.2026 — у Altegio свободное место ищут глазами по колонкам): под услугу нужной
 * длительности — все места дня у мастеров, которые её делают. Расчёт чистый, поверх freeGaps (тот же, что у счётчика
 * «N свободных окон»): промежуток между записями внутри рабочих часов, куда услуга помещается целиком.
 */
export interface SlotGap {
  staffId: Id;
  /** Промежуток, куда услуга помещается: начать можно с from до to − длительность */
  from: Minutes;
  to: Minutes;
}

export interface SlotSuggestion {
  staffId: Id;
  start: Minutes;
}

export function findSlotGaps(input: {
  staff: { id: Id; hours: DayHours }[];
  bookingsByStaff: Record<Id, Booking[]>;
  durationMin: Minutes;
  /** Сегодня — не раньше ближайшего шага от «сейчас» */
  notBefore?: Minutes;
  stepMin?: Minutes;
  /**
   * Ресурсы, без которых услугу не сделать (кресло, кабинет): у каждого — его экземпляры. Окно годится, только если
   * у КАЖДОГО такого ресурса найдётся экземпляр, свободный всё время услуги.
   */
  resources?: { instanceIds: Id[] }[];
  /** Занятость экземпляров ресурсов за день — по всем записям бизнеса */
  resourceBusy?: { instanceIds: Id[]; from: Minutes; to: Minutes }[];
}): SlotGap[] {
  const { staff, bookingsByStaff, durationMin, notBefore = 0, stepMin = 15, resources = [], resourceBusy = [] } = input;
  const instanceFree = (instanceId: Id, from: Minutes, to: Minutes) =>
    !resourceBusy.some((b) => b.instanceIds.includes(instanceId) && b.from < to && from < b.to);
  const resourcesFree = (from: Minutes) =>
    resources.every((r) => r.instanceIds.some((id) => instanceFree(id, from, from + durationMin)));
  const out: SlotGap[] = [];
  for (const s of staff) {
    for (const gap of freeGaps(s.hours, bookingsByStaff[s.id] ?? [], durationMin, notBefore)) {
      // Начало — по шагу сетки: 14:07 → 14:15
      const first = Math.ceil(gap.from / stepMin) * stepMin;
      if (resources.length === 0) {
        if (gap.to - first >= durationMin) out.push({ staffId: s.id, from: first, to: gap.to });
        continue;
      }
      // С ресурсами: проверяем каждое начало по шагу и склеиваем подряд идущие годные в один промежуток
      let runFrom: Minutes | undefined;
      let runLast: Minutes = first;
      for (let at = first; at + durationMin <= gap.to; at += stepMin) {
        if (resourcesFree(at)) {
          runFrom ??= at;
          runLast = at;
        } else if (runFrom !== undefined) {
          out.push({ staffId: s.id, from: runFrom, to: runLast + durationMin });
          runFrom = undefined;
        }
      }
      if (runFrom !== undefined) out.push({ staffId: s.id, from: runFrom, to: runLast + durationMin });
    }
  }
  return out;
}

/** Ближайшие окна: у каждого мастера — самое раннее, по времени; при равенстве — в порядке колонок */
export function nearestSlots(gaps: SlotGap[], staffOrder: Id[], limit = 8): SlotSuggestion[] {
  const firstByStaff = new Map<Id, SlotGap>();
  for (const g of gaps) {
    const prev = firstByStaff.get(g.staffId);
    if (!prev || g.from < prev.from) firstByStaff.set(g.staffId, g);
  }
  const order = new Map(staffOrder.map((id, i) => [id, i]));
  return [...firstByStaff.values()]
    .sort((a, b) => a.from - b.from || (order.get(a.staffId) ?? 0) - (order.get(b.staffId) ?? 0))
    .slice(0, limit)
    .map((g) => ({ staffId: g.staffId, start: g.from }));
}

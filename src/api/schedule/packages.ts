'use client';

/** Несколько услуг и пакеты одной записью (F-02-069): окна, где помещается вся цепочка */
import { mergeIntervals, staffWorkIntervals } from '@/domain/rules';
import type { CoreData, ISODate, ISODateTime, Id, Minutes } from '@/domain/core';
import { combine, datePart, fromMinutes } from '@/lib/date';
import { intersect, minutesOfDay, mutable, nowIso, subtract } from '@/api/schedule/shared';
import type { Interval } from '@/api/schedule/shared';
import { busyForSlots, effectiveBufferMin } from '@/api/schedule/slots';

export type PackageOrder = 'parallel' | 'sequential_one' | 'sequential_many';

export interface PackageServiceInput {
  serviceId: Id;
  staffId: Id;
  durationMin: Minutes;
  bufferAfterMin?: Minutes;
}

/** «Голая» свободность мастера на дату (часы ядра − занятость ядра), без сетки правил — для расчёта пакетов */
function staffFreeIntervals(core: CoreData, staffId: Id, locationId: Id, date: ISODate, now: ISODateTime): Interval[] {
  if (date < datePart(now)) return [];
  let free = mutable(mergeIntervals(staffWorkIntervals(core, staffId, date, { locationId }).map((w) => [w.from, w.to] as Interval)));
  for (const cut of busyForSlots(core, staffId, date, now)) free = subtract(free, cut);
  if (date === datePart(now)) free = intersect(free, [[minutesOfDay(now), 24 * 60]]);
  return free;
}

/**
 * Окно для нескольких услуг/пакета одной записью (F-02-069). Возвращает начала, где вся цепочка помещается:
 *  - 'parallel' — все мастера свободны ОДНОВРЕМЕННО, длительность = самая долгая услуга;
 *  - 'sequential_one' — один мастер (все services.staffId должны совпасть) свободен на СУММУ длительностей;
 *  - 'sequential_many' — услуги друг за другом, у каждой свой мастер (может быть один и тот же).
 * Ресурсы и правила слотов (сетка, шаг локации) здесь не участвуют — это движок физической занятости;
 * шаг перебора кандидатов — 5 минут (❓ Altegio не описывает точный алгоритм для sequential_many).
 */
// data-f="F-02-069"
export function computePackageSlots(
  core: CoreData,
  locationId: Id,
  date: ISODate,
  services: PackageServiceInput[],
  order: PackageOrder,
  nowArg?: Date | ISODateTime,
): { start: ISODateTime; end: ISODateTime }[] {
  const now = nowIso(nowArg);
  if (services.length === 0) return [];
  const STEP = 5;
  const out: { start: ISODateTime; end: ISODateTime }[] = [];

  if (order === 'parallel') {
    const need = Math.max(...services.map((s) => s.durationMin + (s.bufferAfterMin || effectiveBufferMin(s.staffId, locationId))));
    let common: Interval[] = [[0, 24 * 60]];
    for (const s of services) common = intersect(common, staffFreeIntervals(core, s.staffId, locationId, date, now));
    for (const [a, b] of common) {
      for (let t = a; t + need <= b; t += STEP)
        out.push({
          start: combine(date, fromMinutes(t)),
          end: combine(date, fromMinutes(t + Math.max(...services.map((s) => s.durationMin)))),
        });
    }
    return out;
  }

  if (order === 'sequential_one') {
    const staffId = services[0].staffId;
    if (!services.every((s) => s.staffId === staffId)) return []; // «сейчас только один мастер» (119203)
    const need = services.reduce((sum, s) => sum + s.durationMin + (s.bufferAfterMin || effectiveBufferMin(s.staffId, locationId)), 0);
    const free = staffFreeIntervals(core, staffId, locationId, date, now);
    const totalDuration = services.reduce((sum, s) => sum + s.durationMin, 0);
    for (const [a, b] of free) {
      for (let t = a; t + need <= b; t += STEP)
        out.push({
          start: combine(date, fromMinutes(t)),
          end: combine(date, fromMinutes(t + totalDuration)),
        });
    }
    return out;
  }

  // sequential_many: цепочка — каждый следующий начинается сразу после конца (+запас) предыдущего
  const perStaffFree = new Map<Id, Interval[]>();
  for (const s of services)
    if (!perStaffFree.has(s.staffId)) perStaffFree.set(s.staffId, staffFreeIntervals(core, s.staffId, locationId, date, now));
  const dayEnd = 24 * 60;
  const chainFits = (t0: number): number | null => {
    let t = t0;
    for (const s of services) {
      const free = perStaffFree.get(s.staffId) ?? [];
      const need = s.durationMin + (s.bufferAfterMin || effectiveBufferMin(s.staffId, locationId));
      if (!free.some(([a, b]) => t >= a && t + need <= b)) return null;
      t += need;
    }
    return t;
  };
  for (let t = 0; t < dayEnd; t += STEP) {
    const end = chainFits(t);
    if (end !== null)
      out.push({
        start: combine(date, fromMinutes(t)),
        end: combine(date, fromMinutes(end)),
      });
  }
  return out;
}

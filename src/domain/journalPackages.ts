/**
 * F-16-125, F-16-129, F-16-130: пакет услуг, добавленный в УЖЕ открытое окно записи.
 * Чистые правила (без React и стора): как состав пакета делится между «этой записью» и связанными
 * записями других мастеров и когда связанные записи начинаются. Сохранение — attachLinkedBookings()
 * в api/journal.ts, группа связанных записей — та же PackageGroup, что у PackageCreateModal.
 */
import type { Id, ISODateTime, Minutes, Money, TimeHM } from '@/domain/core';
import { combine, fromMinutes, toMinutes } from '@/lib/date';

export type PackageModeInBooking = 'parallel' | 'sequentialSame' | 'sequentialAny';

/** Входящая услуга пакета — уже с ценой после способа цены пакета (packagePrice → perService) */
export interface PackageItemRef {
  serviceId: Id;
  name: string;
  durationMin: Minutes;
  price: Money;
  /** Кто оказывает эту услугу */
  staffIds: Id[];
}

export interface PackageDraftLine {
  serviceId: Id;
  name: string;
  durationMin: Minutes;
  price: Money;
  /** Пакет, из которого пришла строка; нет — обычная услуга, добавленная к связанной записи (F-16-129) */
  packageId?: Id;
}

/** Связанная запись, которая будет создана при сохранении окна */
export interface LinkedBookingDraft {
  key: string;
  packageId: Id;
  staffId: Id;
  /** parallel — в то же время, что и эта запись; after — сразу после неё (последовательный пакет) */
  timing: 'parallel' | 'after';
  lines: PackageDraftLine[];
}

/** «Мастер, у которого нет ни одной услуги пакета, не видит пакет в своём списке» (119203) */
export function packageVisibleToStaff(items: { staffIds: Id[] }[], staffId: Id): boolean {
  return items.some((item) => item.staffIds.includes(staffId));
}

/**
 * Делит пакет между этой записью (мастер окна) и связанными записями (119203, F-16-129):
 * - последовательный — все услуги, которые умеет мастер окна, уходят ему; остальные — связанной записью
 *   сразу после этой (подряд идущие у одного мастера — одной записью);
 * - параллельный — мастер окна получает первую свою услугу пакета, каждая остальная — отдельной
 *   связанной записью в то же время у другого мастера (по возможности разные мастера; поменять — вручную).
 */
export function splitPackageForBooking(input: {
  packageId: Id;
  mode: PackageModeInBooking;
  items: PackageItemRef[];
  currentStaffId: Id;
  keyPrefix: string;
}): { own: PackageDraftLine[]; linked: LinkedBookingDraft[] } {
  const { packageId, mode, items, currentStaffId, keyPrefix } = input;
  const toLine = (item: PackageItemRef): PackageDraftLine => ({
    serviceId: item.serviceId,
    name: item.name,
    durationMin: item.durationMin,
    price: item.price,
    packageId,
  });
  const own: PackageDraftLine[] = [];
  const linked: LinkedBookingDraft[] = [];

  if (mode === 'parallel') {
    const ownIndex = items.findIndex((item) => item.staffIds.includes(currentStaffId));
    const used = new Set<Id>([currentStaffId]);
    items.forEach((item, index) => {
      if (index === ownIndex) {
        own.push(toLine(item));
        return;
      }
      const staffId = item.staffIds.find((id) => !used.has(id)) ?? item.staffIds.find((id) => id !== currentStaffId) ?? item.staffIds[0] ?? '';
      used.add(staffId);
      linked.push({ key: `${keyPrefix}:${index}`, packageId, staffId, timing: 'parallel', lines: [toLine(item)] });
    });
    return { own, linked };
  }

  items.forEach((item, index) => {
    if (item.staffIds.includes(currentStaffId)) {
      own.push(toLine(item));
      return;
    }
    const staffId = item.staffIds[0] ?? '';
    const last = linked[linked.length - 1];
    if (last && last.staffId === staffId) last.lines.push(toLine(item));
    else linked.push({ key: `${keyPrefix}:${index}`, packageId, staffId, timing: 'after', lines: [toLine(item)] });
  });
  return { own, linked };
}

export function linkedDuration(draft: Pick<LinkedBookingDraft, 'lines'>): Minutes {
  return draft.lines.reduce((sum, line) => sum + line.durationMin, 0);
}

/**
 * Начало каждой связанной записи: параллельные — вместе с этой записью; последовательные — одна за
 * другой сразу после её конца (длительность этой записи уже включает услуги пакета мастера окна).
 */
export function linkedStarts(mainStart: ISODateTime, mainDurationMin: Minutes, drafts: LinkedBookingDraft[]): ISODateTime[] {
  const day = mainStart.slice(0, 10);
  let cursor = toMinutes(mainStart.slice(11, 16) as TimeHM) + mainDurationMin;
  return drafts.map((draft) => {
    if (draft.timing === 'parallel') return mainStart;
    const start = combine(day, fromMinutes(Math.min(cursor, 1439)));
    cursor += linkedDuration(draft);
    return start;
  });
}

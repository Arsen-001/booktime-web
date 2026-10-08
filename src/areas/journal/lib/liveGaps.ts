/**
 * BookTime («Живой день», owner 08.10.2026): что показать на свободном окне мастера — сколько заявок листа ожидания
 * в него подходит (мастер, день, услуга помещается) и сколько можно заработать (самой выгодной за минуту услугой
 * мастера, сколько раз она помещается). Одна функция для сетки (DayGrid) и списка дня на телефоне (LiveAgenda).
 */
import type { ISODate, Service, Staff } from '@/domain/core';
import type { WaitlistEntry } from '@/api/resources';
import { computeWaitlistStatus, waitlistWantsDay } from '@/api/resources';
import type { Gap } from '@/areas/journal/lib/board';
import { today } from '@/lib/date';

export interface LiveGap extends Gap {
  /** Заявок листа ожидания, которым подходит окно */
  waiting: number;
  /** Сколько можно заработать в окне, драм (0 — у мастера нет помещающихся услуг) */
  potential: number;
}

export function liveGap(gap: Gap, staff: Staff, services: Service[], waitlist: WaitlistEntry[], date: ISODate): LiveGap {
  const len = gap.to - gap.from;
  const fitting = services.filter(
    (sv) => sv.kind !== 'intake' && sv.kind !== 'pickup' && (sv.staffIds.includes(staff.id) || staff.serviceIds.includes(sv.id)) && sv.durationMin <= len,
  );
  const fitIds = new Set(fitting.map((sv) => sv.id));
  const now = today();
  const waiting = waitlist.filter(
    (e) =>
      computeWaitlistStatus(e, now) === 'active' &&
      waitlistWantsDay(e, date) &&
      (e.staffIds.length === 0 || e.staffIds.includes(staff.id)) &&
      e.serviceIds.some((id) => fitIds.has(id)),
  ).length;
  const best = [...fitting].sort((a, b) => b.priceMin / b.durationMin - a.priceMin / a.durationMin)[0];
  const potential = best && best.durationMin > 0 ? Math.floor(len / best.durationMin) * best.priceMin : 0;
  return { ...gap, waiting, potential };
}

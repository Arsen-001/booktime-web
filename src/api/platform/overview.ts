'use client';

/** Обзор панели одним запросом: что требует действия сегодня и цифры недели (агрегаты считает «сервер», а не экран). */
import { isApiMode } from '@/api/http';
import { request } from '@/api/request';
import { readArea, readCore } from '@/api/area';
import { isCancelled } from '@/domain/rules';
import { callbackOverdueDays, callbackState, sortVisitsForWork, type OverviewSummary, type WaveNo } from '@/domain/platform';
import { addDays, today } from '@/lib/date';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/overview.server';

/** Заметки в плане (без функций) в прогресс не входят */
const isWaveNote = (item: { fids: string[]; id: string }) => item.fids.length === 0 && item.id.includes('_note_');

export function getOverview(): Promise<OverviewSummary> {
  if (isApiMode()) return S.getOverview();
  return request(() => {
    const t = today();
    const weekFrom = addDays(t, -6);
    const area = readArea(AREA);
    const core = readCore();

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
    const perDay = new Map(days.map((d) => [d, 0]));
    core.bookings.forEach((b) => {
      if (b.source !== 'app' || isCancelled(b)) return;
      const d = b.createdAt.slice(0, 10);
      if (perDay.has(d)) perDay.set(d, (perDay.get(d) ?? 0) + 1);
    });
    const appBookings = days.map((date) => ({ date, count: perDay.get(date) ?? 0 }));

    const callbacks = sortVisitsForWork(
      area.visits.filter((v) => ['overdue', 'today'].includes(callbackState(v, t))),
      t,
    ).map((v) => ({
      visitId: v.id,
      placeName: v.placeName,
      contactName: v.contactName,
      phone: v.phone,
      callbackDate: v.callbackDate ?? t,
      overdueDays: callbackOverdueDays(v.callbackDate ?? t, t),
    }));

    const waves = ([1, 2, 3] as WaveNo[]).map((wave) => {
      const items = area.waveItems.filter((w) => w.wave === wave && !isWaveNote(w));
      return { wave, passed: items.filter((w) => w.status === 'passed').length, total: items.length };
    });

    // «Ищут, а у нас нет»: запросы недели, у которых хотя бы в одном районе нет бизнеса этой сферы
    const offerDistricts = new Map<string, Set<string>>();
    core.businesses.forEach((b) => {
      const districts = core.locations.filter((l) => l.businessId === b.id).map((l) => l.district);
      b.sphereIds.forEach((s) => {
        const set = offerDistricts.get(s) ?? new Set<string>();
        districts.forEach((d) => set.add(d));
        offerDistricts.set(s, set);
      });
    });
    const withoutOffer = new Set<string>();
    area.demandEntries.forEach((e) => {
      const d = e.at.slice(0, 10);
      if (d < weekFrom || d > t) return;
      if (!e.sphereId || !offerDistricts.get(e.sphereId)?.has(e.district)) withoutOffer.add(e.query.trim().toLowerCase());
    });

    return {
      pendingModeration: area.moderationItems.filter((m) => m.status === 'pending').length,
      openTickets: area.supportTickets.filter((s) => s.status === 'open').length,
      connectedWeek: area.visits.filter((v) => v.status === 'connected' && v.updatedAt.slice(0, 10) >= weekFrom).length,
      demandWithoutOffer: withoutOffer.size,
      callbacks,
      appBookings,
      appBookingsTotal: appBookings.reduce((sum, d) => sum + d.count, 0),
      waves,
    };
  }, PANEL);
}

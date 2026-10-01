'use client';

/**
 * Раздел «platform»: спрос без предложения и «первый» на настоящем сервере (booktime-backend, PLAN.md §7,
 * этап 19 продолжение; docs/backend/02 §19). reportSearchDemand уже был переведён этапом 9 (client.server.ts
 * submitDemandLeadServer, `/v1/public/demand`) — здесь только панельная сторона (отчёт/кандидаты/выдача).
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id, SphereId } from '@/domain/core';
import type { DemandPeriod, DemandReport, FirstAward, FirstBadge, FirstCandidate } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const getDemandReport = (period: DemandPeriod = 'week') => read(() => http<DemandReport>('GET', '/v1/platform/demand', undefined, { query: { period } }));

export const listFirstCandidates = () => read(() => http<FirstCandidate[]>('GET', '/v1/platform/first-candidates'));

export const grantFirstAward = (businessId: Id, scope: FirstAward['scope'], sphereId: SphereId, district: string | undefined, freeDays: number, coins: number) =>
  write(() => http<FirstAward>('POST', '/v1/platform/first-awards', { businessId, scope, sphereId, district, freeDays, coins }));

/** Значок «первого» на карточке мастера — публично, только где (район/сфера) */
export const getFirstBadge = (businessId: Id) =>
  read(async () => (await http<{ badge: FirstBadge | null }>('GET', `/v1/public/places/${businessId}/first-badge`)).badge ?? undefined);

'use client';

/** Раздел «platform»: учёт визитов на настоящем сервере (booktime-backend, PLAN.md §7, этап 19; F-00-177). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { DistrictId, Id } from '@/domain/core';
import type { CallbackItem, Visit, VisitInput, VisitStatus } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listVisits = (filter?: { status?: VisitStatus; district?: DistrictId }) => read(() => http<Visit[]>('GET', '/v1/platform/visits', undefined, { query: { status: filter?.status, district: filter?.district } }));

export const getVisitCounts = () => read(() => http<Record<VisitStatus | 'all', number>>('GET', '/v1/platform/visits/counts'));

export const listCallbacks = () => read(() => http<CallbackItem[]>('GET', '/v1/platform/visits/callbacks-today'));

export const createVisit = (input: VisitInput) => write(() => http<Visit>('POST', '/v1/platform/visits', input));

export const updateVisit = (id: Id, patch: Partial<VisitInput>) => write(() => http<Visit>('PUT', `/v1/platform/visits/${id}`, patch));

export const completeCallback = (id: Id, note?: string) => write(() => http<Visit>('POST', `/v1/platform/visits/${id}/callback-done`, { note }));

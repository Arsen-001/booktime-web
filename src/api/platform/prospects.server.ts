'use client';

/** Раздел «platform»: «Места» на настоящем сервере (booktime-backend, /v1/platform/prospects, 03.10.2026). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type { ProspectCard, ProspectExport, ProspectFilter, ProspectImportReport, ProspectListQuery, ProspectListResult, ProspectPatch } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

function query(f: ProspectListQuery) {
  return {
    systems: f.systems?.length ? f.systems.join(',') : undefined,
    category: f.category,
    district: f.district,
    staffMin: f.staffMin,
    staffMax: f.staffMax,
    status: f.status,
    q: f.q?.trim() || undefined,
    sort: f.sort,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export const listProspects = (q: ProspectListQuery) => read(() => http<ProspectListResult>('GET', '/v1/platform/prospects', undefined, { query: query(q) }));

export const getProspect = (id: Id) => read(() => http<ProspectCard>('GET', `/v1/platform/prospects/${id}`));

export const updateProspect = (id: Id, patch: ProspectPatch, version?: number) => write(() => http<ProspectCard>('PUT', `/v1/platform/prospects/${id}`, patch, { version }));

export const deleteProspect = (id: Id) => write(() => http<{ ok: true }>('DELETE', `/v1/platform/prospects/${id}`));

export const importProspects = (rows: unknown[]) => write(() => http<ProspectImportReport>('POST', '/v1/platform/prospects/import', rows));

export const exportProspects = (f: ProspectFilter & { sort?: ProspectListQuery['sort'] }) =>
  read(() => http<ProspectExport>('GET', '/v1/platform/prospects/export', undefined, { query: query(f) }));

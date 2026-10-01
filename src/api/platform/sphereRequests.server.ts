'use client';

/** Раздел «platform»: заявки на сферы, наша сторона (booktime-backend, PLAN.md §7, этап 19; F-00-151/152). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { ISODate, Id } from '@/domain/core';
import type { SphereRequest, SphereRequestInput, SphereRequestKind, SphereRequestStatus, SphereRequestView } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}

export const listSphereRequests = (kind?: SphereRequestKind) => read(() => http<SphereRequestView[]>('GET', '/v1/platform/sphere-requests', undefined, { query: { kind } }));

export async function createSphereRequest(input: SphereRequestInput): Promise<SphereRequest> {
  const row = await http<SphereRequest>('POST', '/v1/platform/sphere-requests', input);
  notifyDbChange('areas.platform');
  return row;
}

export interface SphereRequestPatch {
  status?: SphereRequestStatus;
  needs?: string[];
  readyAt?: ISODate;
  note?: string;
}

export async function saveSphereRequest(id: Id, patch: SphereRequestPatch): Promise<SphereRequest> {
  const row = await http<SphereRequest>('PUT', `/v1/platform/sphere-requests/${id}`, patch);
  notifyDbChange('areas.platform');
  return row;
}

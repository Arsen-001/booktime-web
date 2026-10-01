'use client';

/**
 * Раздел «platform»: модерация на настоящем сервере (booktime-backend, PLAN.md §7, этап 19; docs/backend/06 §1).
 * Функции src/api/platform/moderation.ts в режиме `api` зовут эти; экран получает те же типы, что от мока.
 *
 * submit/status/visible используются ДРУГИМИ разделами (settings, client, services) уже сейчас — сигнатуры
 * держим стабильными. refId сам по себе ключ вызывающей стороны, поэтому статус/видимость читаются без
 * businessId в пути (`/v1/moderation/…`, любой вошедший сотрудник кабинета); submit — под businessId из
 * ModerationSubmitInput (`/v1/biz/{b}/moderation/submit`).
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type {
  ModerationCounts,
  ModerationItem,
  ModerationKind,
  ModerationStatus,
  ModerationSubmitInput,
  ModerationView,
  RejectReason,
} from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listModerationItems = (filter?: { status?: ModerationStatus; kind?: ModerationKind }) =>
  read(() => http<ModerationView[]>('GET', '/v1/platform/moderation', undefined, { query: { status: filter?.status, kind: filter?.kind } }));

export const getModerationCounts = () => read(() => http<ModerationCounts>('GET', '/v1/platform/moderation/counts'));

export const listRejectReasons = () => read(() => http<RejectReason[]>('GET', '/v1/platform/reject-reasons'));

export const saveRejectReason = (reason: Omit<RejectReason, 'id'> & { id?: Id }) => write(() => http<RejectReason>('PUT', '/v1/platform/reject-reasons', reason)).then(() => undefined);

export const hideRejectReason = (id: Id) => write(() => http<void>('POST', `/v1/platform/reject-reasons/${id}/hide`));

export const submitForModeration = (input: ModerationSubmitInput) => write(() => http<ModerationItem>('POST', `/v1/biz/${input.businessId}/moderation/submit`, input));

export const approveModerationItem = (id: Id) => write(() => http<ModerationItem>('POST', `/v1/platform/moderation/${id}/approve`));

export const rejectModerationItem = (id: Id, reasonId: Id, reasonNote?: string) => write(() => http<ModerationItem>('POST', `/v1/platform/moderation/${id}/reject`, { reasonId, note: reasonNote }));

export const reopenModerationItem = (id: Id) => write(() => http<ModerationItem>('POST', `/v1/platform/moderation/${id}/reopen`));

/** Пачка галочками в очереди — одна операция, а не N параллельных одиночных (этап 21, лейн rest) */
export const approveModerationItems = (ids: Id[]) => write(() => http<Id[]>('POST', '/v1/platform/moderation/bulk/approve', { ids }));

export const rejectModerationItems = (ids: Id[], reasonId: Id, reasonNote?: string) =>
  write(() => http<Id[]>('POST', '/v1/platform/moderation/bulk/reject', { ids, reasonId, note: reasonNote }));

export const reopenModerationItems = (ids: Id[]) => write(() => http<Id[]>('POST', '/v1/platform/moderation/bulk/reopen', { ids })).then(() => undefined);

/**
 * refId в теле, не в пути (этап 21, лейн rest): refId бывает data: URL фото (галерея) — как путь :refId он бьётся
 * об лимиты Express/длину пути. `status`/`visible` (GET) остаются на сервере для короткого refId, если понадобятся.
 */
export const getModerationStatus = (refId: Id) => read(() => http<ModerationItem | null>('POST', '/v1/moderation/status/lookup', { refId }).then((r) => r ?? undefined));

export const isVisibleToClients = (refId: Id) => read(() => http<{ visible: boolean }>('POST', '/v1/moderation/visible/lookup', { refId }).then((r) => r.visible));

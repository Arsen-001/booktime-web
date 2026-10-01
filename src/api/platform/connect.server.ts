'use client';

/** Подключение салона на визите за 10 минут на настоящем сервере (booktime-backend, PLAN.md §7, этап 19; F-00-176). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { GeoPoint, Id } from '@/domain/core';
import type { ConnectDraft, ConnectInvite, ConnectResult } from '@/domain/platform';
import type { ConnectDraftPatch } from './connect';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listConnectDrafts = () => read(() => http<ConnectDraft[]>('GET', '/v1/platform/connect-drafts'));

export const getConnectDraft = (id: Id) => read(() => http<ConnectDraft>('GET', `/v1/platform/connect-drafts/${id}`));

export const startConnectDraft = (input: { visitId?: Id } = {}) => write(() => http<ConnectDraft>('POST', '/v1/platform/connect-drafts', input));

export const saveConnectDraft = (id: Id, patch: ConnectDraftPatch) => write(() => http<ConnectDraft>('PUT', `/v1/platform/connect-drafts/${id}`, patch));

/** «Я сейчас на месте работы» — сервер сам ставит `coordsAt` на текущий момент, координаты не нужно метить временем */
export const markConnectHere = (id: Id, coords: GeoPoint) => write(() => http<ConnectDraft>('PUT', `/v1/platform/connect-drafts/${id}`, { coords }));

export const deleteConnectDraft = (id: Id) => write(() => http('DELETE', `/v1/platform/connect-drafts/${id}`)).then(() => undefined);

export const addConnectInvite = (draftId: Id, invite: Omit<ConnectInvite, 'id'>) => write(() => http<ConnectDraft>('POST', `/v1/platform/connect-drafts/${draftId}/invites`, invite));

export const removeConnectInvite = (draftId: Id, inviteId: Id) => write(() => http<ConnectDraft>('DELETE', `/v1/platform/connect-drafts/${draftId}/invites/${inviteId}`));

export const finishConnectDraft = (id: Id, patch: ConnectDraftPatch = {}) =>
  write(() => http<ConnectResult>('POST', `/v1/platform/connect-drafts/${id}/finish`, patch, { idempotencyKey: crypto.randomUUID() }));

export const getConnectResult = (businessId: Id) => read(() => http<ConnectResult>('GET', `/v1/platform/connect-result/${businessId}`));

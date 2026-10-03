'use client';

/** «Пользователи» нашей панели на настоящем сервере (booktime-backend, src/modules/platform/users.controller.ts, 03.10.2026). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type { PlatformUserCard, PlatformUsersPage, PlatformUsersQuery, PlatformUserStatus } from '@/domain/platform/types/users';

const TAG = 'areas.platform.users' as const;

/** Метка «люди изменились» — её же будит демо (users.ts): экраны, читавшие список и карточку, перечитаются */
export function notifyUsersChanged(): void {
  notifyDbChange(TAG);
}

export function listPlatformUsers(query: PlatformUsersQuery): Promise<PlatformUsersPage> {
  trackRead(TAG);
  return http<PlatformUsersPage>('GET', '/v1/platform/users', undefined, { query: { ...query } });
}

export function getPlatformUser(id: Id): Promise<PlatformUserCard> {
  trackRead(TAG);
  return http<PlatformUserCard>('GET', `/v1/platform/users/${encodeURIComponent(id)}`);
}

export async function setPlatformUserBlocked(id: Id, blocked: boolean, reason?: string): Promise<{ status: PlatformUserStatus; revokedSessions: number }> {
  const res = await http<{ status: PlatformUserStatus; revokedSessions: number }>('POST', `/v1/platform/users/${encodeURIComponent(id)}/block`, { blocked, reason });
  notifyDbChange(TAG);
  return res;
}

export async function revokePlatformUserSessions(id: Id): Promise<{ revoked: number }> {
  const res = await http<{ revoked: number }>('POST', `/v1/platform/users/${encodeURIComponent(id)}/sessions/revoke`);
  notifyDbChange(TAG);
  return res;
}

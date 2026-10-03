'use client';

/**
 * Чтения «Пользователей» нашей панели: один ключ = одна функция api (['platform', 'users', …], ['platform', 'user', id]).
 * Свой файл, а не usePlatformData.ts: раздел «Места» правит тот файл параллельно (03.10.2026).
 */
import { isApiMode } from '@/api/http';
import { getPlatformUser, listPlatformUsers } from '@/api/platform/users';
import { useApiQuery } from '@/api/request';
import { usePlatformSession } from '@/api/session';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { PlatformUsersQuery } from '@/domain/platform/types/users';

export const usePlatformUsers = (query: PlatformUsersQuery) =>
  useApiQuery(['platform', 'users', query], () => listPlatformUsers(query), { enabled: useCurrent().ready });

export const usePlatformUser = (id: Id) => useApiQuery(['platform', 'user', id], () => getPlatformUser(id), { enabled: useCurrent().ready && Boolean(id) });

/**
 * Можно ли блокировать и завершать сессии: на сервере — только роль admin команды платформы (reviewer — смотреть);
 * в демо персона «Наша панель» — администратор. selfId — свой аккаунт (себя не блокируем).
 */
export function useUserActionsAccess(): { canManage: boolean; selfId: Id | null } {
  const session = usePlatformSession();
  if (!isApiMode()) return { canManage: true, selfId: null };
  return { canManage: session.data?.role === 'admin', selfId: session.data?.user.id ?? null };
}

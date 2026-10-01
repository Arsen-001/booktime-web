'use client';

/**
 * «Кто я» на живом сайте (режим api, docs/backend/PLAN.md §8.2): бизнес, сотрудник, филиалы и права — из членства
 * в сессии сервера, а не из демо-персоны. Ставит SessionBridge; читают resolveDemoContext / usePermissions /
 * currentActor. В демо-сборке (mock) всегда null — там «кто я» задаёт демо-переключатель.
 */
import { create } from 'zustand';
import type { Permission } from '@/config/permissions';
import type { Id } from '@/domain/core';

export interface ApiIdentity {
  businessId: Id;
  staffId: Id;
  networkId?: Id;
  /** Доступные бизнесы (владельцу сети — все филиалы) */
  businessIds: Id[];
  locationIds: Id[];
  /** Итоговые права в выбранном бизнесе — считает сервер (шаблон роли + галочки владельца) */
  permissions: Permission[];
}

/** resolved — сессия сервера уже прочитана (до этого «кто я» неизвестен и экраны кабинета не грузят данные) */
export const useApiIdentity = create<{ identity: ApiIdentity | null; resolved: boolean }>(() => ({ identity: null, resolved: false }));

export function apiIdentity(): ApiIdentity | null {
  return useApiIdentity.getState().identity;
}

export function setApiIdentity(identity: ApiIdentity | null): void {
  const prev = useApiIdentity.getState();
  if (prev.resolved && JSON.stringify(prev.identity) === JSON.stringify(identity)) return;
  useApiIdentity.setState({ identity, resolved: true });
}

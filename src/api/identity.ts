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

/**
 * resolved — сессия сервера уже прочитана (до этого «кто я» неизвестен и экраны кабинета не грузят данные).
 * mirrored — бизнес, чьё зеркало (ядро, график, записи) уже лежит в базе браузера после входа: до него экраны кабинета
 * не начинают свои запросы, иначе каждая запись зеркала перечитывала их — таблица графика 4–5 раз, «Окна для записи»
 * 36 запросов на первое открытие (проход кабинета 17.11.2026).
 */
export const useApiIdentity = create<{ identity: ApiIdentity | null; resolved: boolean; mirrored: Id | null }>(() => ({
  identity: null,
  resolved: false,
  mirrored: null,
}));

export function setMirrored(businessId: Id): void {
  if (useApiIdentity.getState().mirrored !== businessId) useApiIdentity.setState({ mirrored: businessId });
}

export function apiIdentity(): ApiIdentity | null {
  return useApiIdentity.getState().identity;
}

export function setApiIdentity(identity: ApiIdentity | null): void {
  const prev = useApiIdentity.getState();
  if (prev.resolved && JSON.stringify(prev.identity) === JSON.stringify(identity)) return;
  useApiIdentity.setState({ identity, resolved: true });
}

/**
 * Подписка бизнеса заморожена (В-02, сервер отвечает 423 `frozen` на любую запись, кроме оплаты, настроек и статуса
 * записи): кабинет «только просмотр». Ставит FrozenBanner каркаса по /billing/warnings (один запрос на кабинет);
 * читают usePermissions (снимает права изменений) и экраны, которым нужна подпись «почему неактивно» (useReadOnly).
 */
export const useFrozenBusiness = create<{ businessId: Id | null }>(() => ({ businessId: null }));

export function setFrozenBusiness(businessId: Id, frozen: boolean): void {
  const cur = useFrozenBusiness.getState().businessId;
  if (frozen && cur !== businessId) useFrozenBusiness.setState({ businessId });
  if (!frozen && cur === businessId) useFrozenBusiness.setState({ businessId: null });
}

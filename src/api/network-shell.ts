'use client';

/**
 * Сеть — лёгкий вход для каркаса кабинета (07.10.2026, скорость): права пользователя сети режут меню на каждой
 * странице /biz (useNetworkAccess в BizShell). Здесь только это; в режиме api — запрос к серверу, в демо полный
 * '@/api/network' догружается отдельным куском (viaMock). Без этого каждая страница кабинета тянула весь API сети
 * и финансов. Те же имена реэкспортирует '@/api/network' — разделы импортируют оттуда, как раньше.
 */
import { isApiMode } from '@/api/http';
import { viaMock } from '@/api/request';
import type { Id } from '@/domain/core';
import type { NetworkPermissionKey } from '@/domain/network';

const network = () => import('@/api/network');

export const ALL_NETWORK_PERMISSIONS: NetworkPermissionKey[] = [
  'settings',
  'users',
  'clients',
  'records',
  'staff',
  'services',
  'goods',
  'loyalty',
  'accounts',
  'telephony',
  'plans',
  'analytics',
  'fields',
  'subdivisions',
  'migrations',
  'payroll',
];

export interface MyNetworkAccess {
  /** Может войти в кабинет сети: владелец (network.manage) или пользователь сети */
  member: boolean;
  /** Права в сети (F-11-029…035); у владельца — все */
  permissions: NetworkPermissionKey[];
}

/**
 * 01.10.2026 (решение владельца): права пользователя сети реально режут меню и экраны кабинета сети.
 * Владелец / network.manage — все права; пользователь сети — права своей строки по сетям, куда входит его бизнес.
 */
export function getMyNetworkAccess(staffId: Id | undefined, businessId: Id | undefined, canManage: boolean): Promise<MyNetworkAccess> {
  if (canManage) return Promise.resolve({ member: true, permissions: ALL_NETWORK_PERMISSIONS });
  if (isApiMode()) {
    if (!businessId) return Promise.resolve({ member: false, permissions: [] });
    return import('@/api/network.server')
      .then((Server) => Server.getMyNetworkAccess(businessId))
      .then((a) => ({ member: a.member, permissions: a.permissions }));
  }
  return viaMock(network, (m) => m.getMyNetworkAccessMock(staffId, businessId));
}

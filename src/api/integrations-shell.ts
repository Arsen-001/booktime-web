'use client';

/**
 * Приложения — лёгкий вход для каркаса кабинета (07.10.2026, скорость): счётчик подключённых приложений в меню виден
 * на каждой странице /biz. В режиме api — запрос к серверу; в демо полный '@/api/integrations' догружается отдельным
 * куском (viaMock). Ту же функцию реэкспортирует '@/api/integrations' — разделы импортируют оттуда, как раньше.
 */
import { isApiMode } from '@/api/http';
import * as Server from '@/api/integrations.server';
import { viaMock } from '@/api/request';
import type { Id } from '@/domain/core';

const integrations = () => import('@/api/integrations');

export function countInstalledForBusiness(businessId: Id): Promise<number> {
  if (isApiMode()) return Server.countInstalledForBusiness(businessId);
  return viaMock(integrations, (m) => m.countInstalledForBusinessMock(businessId));
}

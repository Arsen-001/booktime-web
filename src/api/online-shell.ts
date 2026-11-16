'use client';

/**
 * Онлайн-запись — лёгкий вход для каркаса кабинета (07.10.2026, скорость): счётчик «Заявки» в меню виден на каждой
 * странице /biz. В режиме api — запрос к серверу; в демо полный '@/api/online' догружается отдельным куском
 * (viaMock). Ту же функцию реэкспортирует '@/api/online' — разделы импортируют оттуда, как раньше.
 */
import { isApiMode } from '@/api/http';
import * as OnlineServer from '@/api/online.server';
import { viaMock } from '@/api/request';
import type { Id } from '@/domain/core';

const online = () => import('@/api/online');

/** Заявок, ждущих подтверждения мастера — для счётчика в меню и (когда фундамент отдаст inbox) в колокольчике (F-00-067) */
export function countPendingRequests(businessId: Id, staffId?: Id): Promise<number> {
  if (isApiMode()) return OnlineServer.countPendingRequestsServer(staffId);
  return viaMock(online, (m) => m.countPendingRequestsMock(businessId, staffId));
}

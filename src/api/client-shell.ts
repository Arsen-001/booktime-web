'use client';

/**
 * Приложение клиента — лёгкий вход для каркаса кабинета (07.10.2026, скорость): счётчик заявок на покупку
 * абонементов/сертификатов из приложения (меню «Лояльность») виден на каждой странице /biz. В режиме api — запрос
 * к серверу; в демо полный '@/api/client' догружается отдельным куском (viaMock). Ту же функцию реэкспортирует
 * '@/api/client' — разделы импортируют оттуда, как раньше.
 */
import * as CLX from '@/api/clientLoyalty.server';
import { isApiMode } from '@/api/http';
import { viaMock } from '@/api/request';
import type { Id } from '@/domain/core';

const client = () => import('@/api/client');

export function countPendingPurchaseRequests(businessId: Id): Promise<number> {
  if (isApiMode()) return CLX.biz(businessId, 'countPendingPurchaseRequests');
  return viaMock(client, (m) => m.countPendingPurchaseRequestsMock(businessId));
}

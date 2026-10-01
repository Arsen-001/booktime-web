'use client';

/**
 * Раздел «Лояльность» на настоящем сервере (docs/backend/PLAN.md этап 21, лейн loyalty). Расчётный слой
 * src/api/loyalty.ts (карты, акции, кэшбэк, сертификаты, абонементы, счета, оплата визита лояльностью, онлайн-
 * продажи) исполняется на сервере как есть — booktime-backend/src/modules/loyalty/port (копия этого файла,
 * `node scripts/sync-loyalty-port.mjs` в репозитории сервера после правки loyalty.ts). Поэтому обёртка одна на
 * все функции: имя функции и её аргументы. Первый аргумент — бизнес: сервер берёт его из пути и проверяет права
 * (booktime-backend/src/modules/loyalty/port/ops.ts).
 */
import { ApiError } from '@/api/request';
import { http } from '@/api/http';

/** Кабинет: POST /v1/biz/{businessId}/loyalty/x/{op} */
export function lx<T>(op: string, args: unknown[]): Promise<T> {
  const businessId = args[0];
  if (typeof businessId !== 'string' || !businessId) return Promise.reject(new ApiError('not_found'));
  return http<T>('POST', `/v1/biz/${encodeURIComponent(businessId)}/loyalty/x/${op}`, { args });
}

/** Клиент приложения (любой вошедший): POST /v1/me/loyalty/x/{op} — listMyLoyalty, getOnlineSalePayment */
export function lxMe<T>(op: string, args: unknown[]): Promise<T> {
  return http<T>('POST', `/v1/me/loyalty/x/${op}`, { args });
}

/** Страница записи без входа: POST /v1/public/loyalty/{businessId}/x/{op} — «нужен ли абонемент» (F-06-128) */
export function lxPublic<T>(op: string, args: unknown[]): Promise<T> {
  const businessId = args[0];
  if (typeof businessId !== 'string' || !businessId) return Promise.reject(new ApiError('not_found'));
  return http<T>('POST', `/v1/public/loyalty/${encodeURIComponent(businessId)}/x/${op}`, { args });
}

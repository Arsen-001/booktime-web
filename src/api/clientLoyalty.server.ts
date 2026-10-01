'use client';

/**
 * Абонементы, сертификаты и кэшбэк приложения клиента на настоящем сервере (docs/backend/PLAN.md этап 21, лейн
 * client-loyalty). Правила — фасад лояльности на сервере (booktime-backend/src/modules/loyalty/port/client-ops.ts
 * поверх port/logic.ts — копии src/api/loyalty.ts), заявки В-17 — строки этапа 11. Обёртка одна на функцию
 * src/api/client.ts: имя и аргументы БЕЗ appUserId/businessId — клиент берётся из сессии, бизнес — из пути.
 */
import { ApiError } from '@/api/request';
import { http } from '@/api/http';

/** Клиент приложения: POST /v1/me/loyalty/app/{op} — только своё */
export function me<T>(op: string, args: unknown[] = []): Promise<T> {
  return http<T>('POST', `/v1/me/loyalty/app/${op}`, { args });
}

/** Страница места без входа: POST /v1/public/loyalty/{businessId}/app/{op} — что продаётся */
export function pub<T>(businessId: string, op: string, args: unknown[] = []): Promise<T> {
  if (!businessId) return Promise.reject(new ApiError('not_found'));
  return http<T>('POST', `/v1/public/loyalty/${encodeURIComponent(businessId)}/app/${op}`, { args });
}

/** Кабинет: POST /v1/biz/{businessId}/loyalty/app/{op} — заявки, лояльность визита, показ кэшбэка */
export function biz<T>(businessId: string, op: string, args: unknown[] = []): Promise<T> {
  if (!businessId) return Promise.reject(new ApiError('not_found'));
  return http<T>('POST', `/v1/biz/${encodeURIComponent(businessId)}/loyalty/app/${op}`, { args });
}

/** Ответ сервера `null` («не найдено») → undefined, как у мок-ветки */
export function orUndefined<T>(p: Promise<T | null>): Promise<T | undefined> {
  return p.then((v) => (v === null ? undefined : v));
}

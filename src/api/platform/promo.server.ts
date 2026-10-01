'use client';

/**
 * Раздел «platform»: промокоды и бесплатные месяцы на настоящем сервере — уже построены этапом 18
 * (billing-платформа, `docs/backend/06 §2–4`, `billing-platform.controller.ts`) как часть денег подписки;
 * здесь только переключатель фасада на них (PLAN.md §7, этап 19 владеет экраном панели).
 *
 * redeemPromo НЕ переключён: докс (06 §4.2) явно решает — код применяется только в запросе регистрации
 * бизнеса или первой оплаты подписки, отдельного маршрута «ввести промокод» у бизнеса нет; мок-функция
 * `redeemPromo(code, businessId)` не имеет прямого серверного эквивалента вне этих двух мест.
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type { FreeMonthReason, PromoCheck, PromoCode, PromoInput, PromoView, VisitBusiness } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listPromoCodes = () => read(() => http<PromoView[]>('GET', '/v1/platform/promo-codes'));

export const createPromoCode = (input: PromoInput) => write(() => http<PromoCode>('POST', '/v1/platform/promo-codes', input));

export const revokePromoCode = (id: Id) => write(() => http<void>('POST', `/v1/platform/promo-codes/${id}/revoke`));

export const restorePromoCode = (id: Id) => write(() => http<void>('POST', `/v1/platform/promo-codes/${id}/restore`));

export const validatePromo = (codeText: string) => read(() => http<PromoCheck>('GET', '/v1/platform/promo-codes/check', undefined, { query: { code: codeText } }));

export const listVisitBusinesses = () => read(() => http<VisitBusiness[]>('GET', '/v1/platform/businesses/visit-connected'));

export const grantFreeMonth = (businessId: Id, days: number, reason: FreeMonthReason, note?: string) =>
  write(() => http<unknown>('POST', '/v1/platform/free-months', { businessId, days, reason, note })).then(() => undefined);

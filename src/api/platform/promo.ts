'use client';

/** Промокоды и бесплатные месяцы (F-00-178, F-00-020, F-00-019). */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { Id } from '@/domain/core';
import { promoStatus, type FreeMonthReason, type PromoCheck, type PromoCode, type PromoInput, type PromoView, type VisitBusiness } from '@/domain/platform';
import { addDays, nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { AREA, PANEL, businessNameOf } from '@/api/platform/shared';
import * as S from '@/api/platform/promo.server';

function toPromoView(p: PromoCode, core: ReturnType<typeof readCore>): PromoView {
  return {
    ...p,
    status: promoStatus(p, today()),
    issuedToBusinessName: businessNameOf(core, p.issuedTo?.businessId),
    usedByBusinessName: businessNameOf(core, p.usedByBusinessId),
  };
}

export function listPromoCodes(): Promise<PromoView[]> {
  if (isApiMode()) return S.listPromoCodes();
  return request(() => {
    const core = readCore();
    return readArea(AREA).promoCodes.map((p) => toPromoView(p, core)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, PANEL);
}

export function createPromoCode(input: PromoInput): Promise<PromoCode> {
  if (isApiMode()) return S.createPromoCode(input);
  return request(() => {
    const codeText = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,24}$/.test(codeText)) throw new ApiError('validation', 'code');
    if (readArea(AREA).promoCodes.some((p) => p.code === codeText)) throw new ApiError('duplicate');
    // F-00-019: бесплатный месяц — только лично тому, кого подключили на визите
    if (input.kind === 'freeMonth' && !input.personal) throw new ApiError('validation', 'personal');
    const now = nowDateTime();
    const code: PromoCode = {
      id: newId('promo'),
      code: codeText,
      kind: input.kind,
      tiers: input.kind === 'discount' ? input.tiers : [],
      freeDays: input.kind === 'freeMonth' ? input.freeDays : undefined,
      personal: input.personal,
      validUntil: input.validUntil,
      issuedTo: input.issuedTo,
      issuedAt: input.issuedTo ? now : undefined,
      note: input.note,
      createdAt: now,
    };
    mutateArea(AREA, (s) => {
      s.promoCodes.unshift(code);
    });
    return code;
  }, PANEL);
}

export function revokePromoCode(id: Id): Promise<void> {
  if (isApiMode()) return S.revokePromoCode(id);
  return request(() => {
    mutateArea(AREA, (s) => {
      const code = s.promoCodes.find((p) => p.id === id);
      if (!code) throw new ApiError('not_found');
      code.revokedAt = nowDateTime();
    });
  }, PANEL);
}

/** «Отменить» в тосте после отзыва */
export function restorePromoCode(id: Id): Promise<void> {
  if (isApiMode()) return S.restorePromoCode(id);
  return request(() => {
    mutateArea(AREA, (s) => {
      const code = s.promoCodes.find((p) => p.id === id);
      if (!code) throw new ApiError('not_found');
      code.revokedAt = undefined;
    });
  }, PANEL);
}

export function validatePromo(codeText: string): Promise<PromoCheck> {
  if (isApiMode()) return S.validatePromo(codeText);
  return request(() => {
    const code = readArea(AREA).promoCodes.find((p) => p.code === codeText.trim().toUpperCase());
    if (!code) return { ok: false, reason: 'notFound' };
    const status = promoStatus(code, today());
    if (status === 'used' || status === 'expired' || status === 'revoked') return { ok: false, reason: status };
    return { ok: true, promo: toPromoView(code, readCore()) };
  });
}

/**
 * НЕ переключено на сервер (этап 19, решение записано в docs/PROGRESS.md booktime-backend): 06 §4.2 явно
 * решает, что промокод применяется только внутри регистрации бизнеса или первой оплаты подписки — отдельного
 * маршрута «ввести промокод» сервер не строит, поэтому mock-путь остаётся для api-режима тоже.
 */
export function redeemPromo(codeText: string, businessId: Id): Promise<PromoCheck> {
  return request(() => {
    let result: PromoCheck = { ok: false, reason: 'notFound' };
    const core = readCore();
    mutateArea(AREA, (s) => {
      const code = s.promoCodes.find((p) => p.code === codeText.trim().toUpperCase());
      if (!code) return;
      if (code.personal && code.issuedTo?.businessId && code.issuedTo.businessId !== businessId) {
        result = { ok: false, reason: 'personal' };
        return;
      }
      const status = promoStatus(code, today());
      if (status === 'used' || status === 'expired' || status === 'revoked') {
        result = { ok: false, reason: status };
        return;
      }
      code.usedAt = nowDateTime();
      code.usedByBusinessId = businessId;
      result = { ok: true, promo: toPromoView(code, core) };
    });
    return result;
  });
}

/** Бизнесы, подключённые на визите, — только им можно выдать бесплатный месяц (F-00-019) */
export function listVisitBusinesses(): Promise<VisitBusiness[]> {
  if (isApiMode()) return S.listVisitBusinesses();
  return request(() => {
    const meta = readArea(AREA).bizMeta;
    return readCore()
      .businesses.filter((b) => meta[b.id]?.source === 'visit' && !meta[b.id]?.leftAt)
      .map((b) => ({ id: b.id, name: b.name, freeUntil: meta[b.id]?.freeUntil }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, PANEL);
}

export function grantFreeMonth(businessId: Id, days: number, reason: FreeMonthReason, note?: string): Promise<void> {
  if (isApiMode()) return S.grantFreeMonth(businessId, days, reason, note);
  return request(() => {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new ApiError('validation', 'days');
    mutateArea(AREA, (s) => {
      const meta = s.bizMeta[businessId];
      if (reason === 'manual' && meta?.source !== 'visit') throw new ApiError('forbidden', 'free month only for visit-connected');
      const base = meta?.freeUntil && meta.freeUntil > today() ? meta.freeUntil : today();
      s.bizMeta[businessId] = { ...(meta ?? { businessId, source: 'self' as const }), freeUntil: addDays(base, days), note: note ?? meta?.note };
    });
  }, PANEL);
}

'use client';

/**
 * «Пригласи подругу» на настоящем сервере (booktime-backend src/modules/loyalty/referral.controller.ts). Привязку
 * нового клиента сервер делает сам в едином потоке записи (поле referralCode у /v1/me/bookings и
 * /v1/public/b/{slug}/bookings) и проверяет правила: не себя, один пригласивший, только новый клиент.
 */
import { http } from '@/api/http';
import type { Id } from '@/domain/core';
import type { ClientReferralInfo, MyReferralBusiness, ReferralInvite, ReferralLanding } from '@/api/referral';

export function getMyReferralInvite(businessId: Id): Promise<ReferralInvite | null> {
  return http<ReferralInvite | null>('GET', `/v1/me/referrals/${encodeURIComponent(businessId)}`).then((r) => r ?? null);
}

export function listMyReferrals(): Promise<MyReferralBusiness[]> {
  return http('GET', '/v1/me/referrals');
}

export function getBookingReferralInvite(bookingId: Id, hash: string): Promise<ReferralInvite | null> {
  return http<ReferralInvite | null>('GET', `/v1/public/bookings/${encodeURIComponent(bookingId)}/referral`, undefined, { query: { h: hash } }).then((r) => r ?? null);
}

export function resolveReferralCode(slug: string, code: string): Promise<ReferralLanding | null> {
  return http<ReferralLanding | null>('GET', `/v1/public/b/${encodeURIComponent(slug)}/referral/${encodeURIComponent(code)}`).then((r) => r ?? null);
}

export function getClientReferralInfo(businessId: Id, clientId: Id): Promise<ClientReferralInfo> {
  return http('GET', `/v1/biz/${encodeURIComponent(businessId)}/clients/${encodeURIComponent(clientId)}/referral`);
}

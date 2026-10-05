'use client';

/**
 * «Приведи друга» для публичной страницы бизнеса (/b/<slug>?ref=…): только разбор кода приглашения. В режиме api —
 * запрос к серверу; в демо — полный '@/api/referral' догружается отдельным куском (viaMock). Ту же функцию
 * реэкспортирует '@/api/referral'.
 */
import { isApiMode } from '@/api/http';
import type { ReferralLanding } from '@/api/referral';
import * as RS from '@/api/referral.server';
import { viaMock } from '@/api/request';

const referral = () => import('@/api/referral');

/** Подруга открыла ссылку: кто пригласил и что ей положено. Код неизвестен или программа выключена — null */
export function resolveReferralCode(slug: string, rawCode: string): Promise<ReferralLanding | null> {
  if (isApiMode()) return RS.resolveReferralCode(slug, rawCode);
  return viaMock(referral, (m) => m.resolveReferralCodeMock(slug, rawCode));
}

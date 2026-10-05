'use client';

/**
 * «Пригласи подругу» (F-06-081…085 + наше решение 01.10.2026) — клиентская сторона рефералки салона: личная ссылка
 * клиента, привязка нового клиента при записи по ссылке, список приглашённых и бонусов. Правила — rules/referral,
 * настройки и награда — раздел loyalty (getReferralSettings, getReferralEligibility, оплата визита). Сервер —
 * booktime-backend src/modules/loyalty/referral.* (режим api, src/api/referral.server.ts).
 */
import { ApiError, request } from '@/api/request';
import { readArea, readCore } from '@/api/area';
import { coreTx } from '@/api/core';
import { isApiMode } from '@/api/http';
import * as RS from '@/api/referral.server';
import type { Business, Client, CoreData, ISODateTime, Id } from '@/domain/core';
import type { Promotion } from '@/domain/loyalty';
import {
  makeReferralCode,
  normalizeReferralCode,
  priorBookingsOf,
  referralDenied,
  referralInvitePath,
  referralInviteeStatus,
  referralPublicName,
  type ReferralDenied,
  type ReferralInviteeStatus,
} from '@/domain/rules/referral';
import { nowDateTime } from '@/lib/date';
// resolveReferralCode живёт в лёгком '@/api/referral-public' (страница бизнеса) — здесь демо-реализация
import { resolveReferralCode } from '@/api/referral-public';
export { resolveReferralCode };

/** Награда по акции рефералки: процент или фиксированная сумма */
export interface ReferralReward {
  valueType: 'percent' | 'fixed';
  value: number;
}

/** Личная ссылка клиента в одном салоне */
export interface ReferralInvite {
  businessId: Id;
  businessName: string;
  slug: string;
  code: string;
  /** '/b/<slug>?ref=<код>' — полный адрес собирает экран (origin) */
  path: string;
  /** Скидка приглашённой на первый визит */
  inviteeReward?: ReferralReward;
  /** Бонус пригласившей за визит подруги */
  referrerReward?: ReferralReward;
}

export interface ReferralInviteeRow {
  /** «Анна К.» — фамилию целиком не показываем */
  name: string;
  at: ISODateTime;
  status: ReferralInviteeStatus;
  /** Начислено пригласившей за эту подругу, ֏ бонусами */
  bonus: number;
}

export interface MyReferralBusiness extends ReferralInvite {
  invitees: ReferralInviteeRow[];
  bonusTotal: number;
}

/** Что видит подруга, открыв ссылку: кто пригласил и что ей положено */
export interface ReferralLanding {
  businessName: string;
  referrerName: string;
  inviteeReward?: ReferralReward;
}

/** Карточка клиента в кабинете: кто привёл и кого привёл он */
export interface ClientReferralInfo {
  referredBy?: { clientId: Id; name: string; at?: ISODateTime };
  invitees: { clientId: Id; name: string; at: ISODateTime; status: ReferralInviteeStatus; bonus: number }[];
}

// ─────────────────────────── внутреннее (мок) ───────────────────────────

function businessName(b: Business): string {
  return b.brandName || b.name;
}

function rewardOf(p: Promotion | undefined): ReferralReward | undefined {
  if (!p || !p.value) return undefined;
  return { valueType: p.valueType === 'percent' ? 'percent' : 'fixed', value: p.value };
}

/** Программа салона включена и настроена — иначе ссылку не показываем и не привязываем */
function programOf(businessId: Id): { active: boolean; inviteeReward?: ReferralReward; referrerReward?: ReferralReward } {
  const loyalty = readArea('loyalty');
  const settings = loyalty.referral[businessId];
  const active = Boolean(settings?.active && settings.inviteePromotionId && settings.referrerPromotionId);
  if (!active) return { active: false };
  const byId = (id: Id | undefined) => loyalty.promotions.find((p) => p.id === id);
  return { active, inviteeReward: rewardOf(byId(settings.inviteePromotionId)), referrerReward: rewardOf(byId(settings.referrerPromotionId)) };
}

/** Код карточки; нет — заводится (уникален во всей базе). Только внутри request() */
function ensureCodeTx(client: Client): string {
  if (client.referralCode) return client.referralCode;
  const taken = new Set(readCore().clients.map((c) => c.referralCode).filter(Boolean));
  let code = makeReferralCode();
  while (taken.has(code)) code = makeReferralCode();
  coreTx.update('clients', client.id, { referralCode: code });
  return code;
}

function inviteTx(core: CoreData, client: Client): ReferralInvite | null {
  const business = core.businesses.find((b) => b.id === client.businessId);
  if (!business) return null;
  const program = programOf(business.id);
  if (!program.active) return null;
  const code = ensureCodeTx(client);
  return {
    businessId: business.id,
    businessName: businessName(business),
    slug: business.slug,
    code,
    path: referralInvitePath(business.slug, code),
    inviteeReward: program.inviteeReward,
    referrerReward: program.referrerReward,
  };
}

/** Бонусы, начисленные пригласившему за записи подруги (referralAccrual по её визитам) */
function bonusFor(referrerId: Id, inviteeBookingIds: Set<Id>): number {
  return readArea('loyalty')
    .transactions.filter((tx) => tx.type === 'referralAccrual' && tx.clientId === referrerId && tx.bookingId && inviteeBookingIds.has(tx.bookingId))
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function inviteesOf(core: CoreData, referrer: Client) {
  return core.clients
    .filter((c) => c.referredByClientId === referrer.id && c.businessId === referrer.businessId && !c.deletedAt)
    .map((c) => {
      const own = core.bookings.filter((b) => b.clientId === c.id);
      const bonus = bonusFor(referrer.id, new Set(own.map((b) => b.id)));
      return { client: c, at: c.referredAt ?? c.createdAt, status: referralInviteeStatus(own, c.id, bonus > 0), bonus };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

function appUserCardsTx(appUserId: Id): Client[] {
  const core = readCore();
  const user = core.appUsers.find((u) => u.id === appUserId);
  return core.clients.filter((c) => !c.deletedAt && (c.appUserId === appUserId || (user && c.phone === user.phone)));
}

/**
 * Привязать нового клиента к пригласившему по коду из ссылки — ВНУТРИ request() записи (приложение, ссылка,
 * виджет): одна транзакция с самой записью. Отказ (код чужой, себя, не новый, уже привязан) запись не ломает.
 */
export function attachReferralTx(businessId: Id, inviteeClientId: Id, rawCode: string | undefined, bookingId: Id): ReferralDenied | null {
  const code = normalizeReferralCode(rawCode);
  if (!code) return 'unknown_code';
  const core = readCore();
  const invitee = core.clients.find((c) => c.id === inviteeClientId && c.businessId === businessId);
  if (!invitee) return 'unknown_code';
  const referrer = core.clients.find((c) => c.businessId === businessId && c.referralCode === code);
  const denied = referralDenied({
    programActive: programOf(businessId).active,
    referrer,
    invitee,
    priorBookings: priorBookingsOf(
      core.bookings.filter((b) => b.businessId === businessId),
      invitee.id,
      bookingId,
    ),
  });
  if (denied) return denied;
  coreTx.update('clients', invitee.id, { referredByClientId: referrer!.id, referredAt: nowDateTime() });
  return null;
}

// ─────────────────────────── api ───────────────────────────

/** Приложение клиента: моя ссылка в салоне (экран «Вы записаны»). Нет карточки или программы — null */
export function getMyReferralInvite(appUserId: Id, businessId: Id): Promise<ReferralInvite | null> {
  if (isApiMode()) return RS.getMyReferralInvite(businessId);
  return request(() => {
    const card = appUserCardsTx(appUserId).find((c) => c.businessId === businessId);
    return card ? inviteTx(readCore(), card) : null;
  });
}

/** Приложение клиента: все мои ссылки, приглашённые подруги и бонусы (профиль) */
export function listMyReferrals(appUserId: Id): Promise<MyReferralBusiness[]> {
  if (isApiMode()) return RS.listMyReferrals();
  return request(() => {
    const out: MyReferralBusiness[] = [];
    for (const card of appUserCardsTx(appUserId)) {
      const invite = inviteTx(readCore(), card);
      if (!invite) continue;
      const rows = inviteesOf(readCore(), card);
      out.push({
        ...invite,
        invitees: rows.map((r) => ({ name: referralPublicName(r.client.name), at: r.at, status: r.status, bonus: r.bonus })),
        bonusTotal: rows.reduce((sum, r) => sum + r.bonus, 0),
      });
    }
    // Сначала салоны, где уже кого-то пригласили
    return out.sort((a, b) => b.invitees.length - a.invitees.length || a.businessName.localeCompare(b.businessName));
  });
}

/** Страница «Вы записаны» без входа (ссылка/виджет): ссылка клиента этой записи — по хэшу записи */
export function getBookingReferralInvite(bookingId: Id, hash: string): Promise<ReferralInvite | null> {
  if (isApiMode()) return RS.getBookingReferralInvite(bookingId, hash);
  return request(() => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || !hash || meta.accessHash !== hash) throw new ApiError('not_found');
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId);
    const client = booking?.clientId ? core.clients.find((c) => c.id === booking.clientId && !c.deletedAt) : undefined;
    return client ? inviteTx(core, client) : null;
  });
}

/** Демо-реализация resolveReferralCode (сервер и обёртка — '@/api/referral-public') */
export function resolveReferralCodeMock(slug: string, rawCode: string): Promise<ReferralLanding | null> {
  return request(() => {
    const code = normalizeReferralCode(rawCode);
    const core = readCore();
    const business = core.businesses.find((b) => b.slug === slug);
    if (!code || !business) return null;
    const program = programOf(business.id);
    const referrer = core.clients.find((c) => c.businessId === business.id && c.referralCode === code && !c.deletedAt);
    if (!program.active || !referrer) return null;
    return { businessName: businessName(business), referrerName: referralPublicName(referrer.name), inviteeReward: program.inviteeReward };
  });
}

/** Кабинет, карточка клиента: «пришёл по приглашению …» и кого привёл он сам. Право clients.view */
export function getClientReferralInfo(businessId: Id, clientId: Id): Promise<ClientReferralInfo> {
  if (isApiMode()) return RS.getClientReferralInfo(businessId, clientId);
  return request(
    () => {
      const core = readCore();
      const client = core.clients.find((c) => c.id === clientId && c.businessId === businessId);
      if (!client) throw new ApiError('not_found');
      const by = client.referredByClientId ? core.clients.find((c) => c.id === client.referredByClientId) : undefined;
      return {
        referredBy: by ? { clientId: by.id, name: by.name, at: client.referredAt } : undefined,
        invitees: inviteesOf(core, client).map((r) => ({ clientId: r.client.id, name: r.client.name, at: r.at, status: r.status, bonus: r.bonus })),
      };
    },
    { permission: 'clients.view' },
  );
}

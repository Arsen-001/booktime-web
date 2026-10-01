/**
 * «Пригласи подругу» (F-06-081…085 + наше решение 01.10.2026): личная ссылка клиента салона, привязка нового
 * клиента к пригласившему при записи и что считать «новым». Чистые функции — сервер (booktime-backend
 * src/modules/loyalty/referral.service.ts) повторяет их как есть.
 *
 *  - Код — 6 знаков без похожих (0/O, 1/I/L), один на карточку клиента бизнеса; ссылка — `/b/<slug>?ref=<код>`.
 *  - Привязка ставится ОДИН раз и только новому клиенту: у него нет ни одной неотменённой записи в этом бизнесе
 *    (F-06-084, QUESTIONS: «впервые у этого владельца»), кроме той, что создаётся сейчас.
 *  - Себя пригласить нельзя: та же карточка, тот же номер или тот же пользователь приложения.
 *  - Неверный код или отказ не ломают запись — она создаётся без привязки.
 *  - Награда — по настройкам рефералки салона при оплате первого визита (LoyaltyPaymentPanel, payVisitWithLoyalty).
 */
import type { Booking, Client, Id } from '@/domain/core';
import { isCancelled } from '@/domain/rules/booking-status';

/** Без 0/O, 1/I/L — код читают вслух и переписывают с экрана */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 6;
/** Сколько дней браузер помнит код из ссылки, если подруга записалась не сразу */
export const REFERRAL_REMEMBER_DAYS = 30;
/** Параметр ссылки */
export const REFERRAL_QUERY_PARAM = 'ref';

/** Код из ссылки или поля: верхний регистр, без пробелов и дефисов; мусор — undefined */
export function normalizeReferralCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== REFERRAL_CODE_LENGTH) return undefined;
  for (const ch of code) if (!REFERRAL_CODE_ALPHABET.includes(ch)) return undefined;
  return code;
}

/** Новый код. random — для тестов; занятость кода проверяет тот, кто пишет в базу */
export function makeReferralCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) out += REFERRAL_CODE_ALPHABET[Math.floor(random() * REFERRAL_CODE_ALPHABET.length) % REFERRAL_CODE_ALPHABET.length];
  return out;
}

/** Путь личной ссылки: публичная страница салона с кодом */
export function referralInvitePath(slug: string, code: string): string {
  return `/b/${encodeURIComponent(slug)}?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`;
}

export type ReferralDenied =
  /** Программа салона выключена или не настроена */
  | 'inactive'
  /** Код не найден в этом бизнесе */
  | 'unknown_code'
  /** Пригласил сам себя */
  | 'self'
  /** У клиента уже есть пригласивший */
  | 'already_referred'
  /** Клиент уже записывался сюда раньше */
  | 'not_new';

type ReferralPerson = Pick<Client, 'id' | 'phone'> & { appUserId?: Id; deletedAt?: string };

export interface ReferralAttachCheck {
  programActive: boolean;
  /** Карточка пригласившего по коду; нет — код неизвестен */
  referrer?: ReferralPerson;
  /** Карточка нового клиента (уже найдена или только что заведена) */
  invitee: ReferralPerson & { referredByClientId?: Id };
  /** Сколько у нового клиента неотменённых записей в бизнесе, кроме создаваемой */
  priorBookings: number;
}

/** Можно ли привязать нового клиента к пригласившему; null — можно */
export function referralDenied(c: ReferralAttachCheck): ReferralDenied | null {
  if (!c.programActive) return 'inactive';
  if (!c.referrer || c.referrer.deletedAt) return 'unknown_code';
  const samePhone = Boolean(c.referrer.phone) && c.referrer.phone === c.invitee.phone;
  const sameUser = Boolean(c.referrer.appUserId) && c.referrer.appUserId === c.invitee.appUserId;
  if (c.referrer.id === c.invitee.id || samePhone || sameUser) return 'self';
  if (c.invitee.referredByClientId) return 'already_referred';
  if (c.priorBookings > 0) return 'not_new';
  return null;
}

/** Неотменённые записи клиента в бизнесе, кроме exceptBookingId: «был ли он уже здесь» */
export function priorBookingsOf(bookings: readonly Pick<Booking, 'id' | 'clientId' | 'status' | 'deletedAt'>[], clientId: Id, exceptBookingId?: Id): number {
  return bookings.filter((b) => b.clientId === clientId && b.id !== exceptBookingId && !b.deletedAt && !isCancelled(b.status)).length;
}

/** Что сейчас с приглашённой: записалась → пришла → пригласившему начислен бонус (или отменила) */
export type ReferralInviteeStatus = 'booked' | 'visited' | 'rewarded' | 'cancelled';

export function referralInviteeStatus(
  bookings: readonly Pick<Booking, 'clientId' | 'status' | 'deletedAt'>[],
  inviteeClientId: Id,
  rewarded: boolean,
): ReferralInviteeStatus {
  if (rewarded) return 'rewarded';
  const own = bookings.filter((b) => b.clientId === inviteeClientId && !b.deletedAt);
  if (own.some((b) => b.status === 'arrived')) return 'visited';
  if (own.length > 0 && own.every((b) => isCancelled(b.status) || b.status === 'no_show')) return 'cancelled';
  return 'booked';
}

/** Имя для чужих глаз: «Анна К.» — фамилию целиком приглашённым и пригласившему не показываем */
export function referralPublicName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}


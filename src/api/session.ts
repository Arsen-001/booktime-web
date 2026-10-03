'use client';

/**
 * Вход и сессия на сервере (docs/backend/PLAN.md этап 2, docs/backend/02 §1). Работает только в режиме `api`:
 * в демо-сборке (`mock`) «кто я» задаёт демо-персона (src/demo), и этих вызовов нет.
 */
import { http, isApiMode } from '@/api/http';
import { useApiQuery } from '@/api/request';
import { forgetNativePushToken } from '@/lib/native/push';

export type SessionApp = 'client' | 'business' | 'platform';
export type SessionMode = 'client' | 'business';

export interface SessionMembership {
  businessId: string;
  businessName: string;
  /** salon | individual */
  kind: string;
  networkId: string | null;
  staffId: string;
  /** owner | admin | master | network (владелец сети в филиале) */
  role: string;
  /** Филиалы бизнеса (владельцу сети — все филиалы сети) */
  locationIds: string[];
  /** Доступные бизнесы (владельцу сети — все филиалы) */
  businessIds: string[];
  /** Итоговые права — считает сервер */
  permissions: string[];
}

export interface SessionView {
  user: { id: string; name: string; phone: string | null; locale: 'ru' | 'hy' | 'en' };
  app: SessionApp;
  mode: SessionMode;
  activeBusinessId: string | null;
  memberships: SessionMembership[];
  /** Вход логином администратора — его логин */
  staffLogin: string | null;
  mustChangePassword: boolean;
  consent: boolean;
}

export interface SecondFactorChallenge {
  challengeId: string;
  phoneMasked: string;
  resendAfter: number;
  expiresIn: number;
  /** Куда код ушёл на самом деле — экран пишет «в Telegram / в WhatsApp / по SMS» */
  channel?: 'telegram' | 'whatsapp' | 'sms';
}

export interface PlatformSessionView {
  user: SessionView['user'];
  login: string;
  role: string;
}

export const SESSION_KEY = ['auth', 'session'] as const;
export const PLATFORM_SESSION_KEY = ['auth', 'platformSession'] as const;

export async function getSession(): Promise<SessionView | null> {
  const r = await http<{ session: SessionView | null }>('GET', '/v1/auth/session');
  return r.session;
}

/** Кто вошёл (только режим api; в демо — всегда undefined) */
export function useSession() {
  return useApiQuery(SESSION_KEY, getSession, { enabled: isApiMode() });
}

export async function logout(): Promise<void> {
  // В приложении — сначала убрать пуш-токен телефона, пока сессия ещё действует (src/lib/native/push.ts)
  await forgetNativePushToken();
  return http('POST', '/v1/auth/logout');
}

/** «Завершить все сеансы» (F-15-152): keepCurrent — кроме этого устройства */
export function logoutAll(keepCurrent = true): Promise<{ revoked: number }> {
  return http('POST', '/v1/auth/logout-all', { keepCurrent });
}

/** Переключатель «Я клиент / Мой бизнес» (В-21). Нет бизнеса — ApiError('no_business'). */
export function setSessionMode(mode: SessionMode, businessId?: string): Promise<SessionView> {
  return http('PUT', '/v1/auth/mode', { mode, businessId });
}

/** Второй шаг входа по паролю (F-15-159) */
export function verifySecondFactor(input: { challengeId: string; code: string }): Promise<SessionView> {
  return http('POST', '/v1/auth/second-factor', input);
}

// ─────────── команда платформы (Р11): логин + пароль + код ───────────

export function platformLogin(input: { login: string; password: string }): Promise<{ secondFactor: SecondFactorChallenge }> {
  return http('POST', '/v1/auth/platform/login', input);
}

export function platformVerify(input: { challengeId: string; code: string }): Promise<PlatformSessionView> {
  return http('POST', '/v1/auth/platform/verify', input);
}

export async function getPlatformSession(): Promise<PlatformSessionView | null> {
  const r = await http<{ session: PlatformSessionView | null }>('GET', '/v1/auth/platform/session');
  return r.session;
}

export function usePlatformSession() {
  return useApiQuery(PLATFORM_SESSION_KEY, getPlatformSession, { enabled: isApiMode() });
}

export function platformLogout(): Promise<void> {
  return http('POST', '/v1/auth/platform/logout');
}

// ─────────── аккаунт: /v1/me (docs/backend/02 §1) ───────────

export interface AccountView {
  id: string;
  name: string;
  phone: string | null;
  locale: 'ru' | 'hy' | 'en';
  twoFactorEnabled: boolean;
  sessionsRevokedAt: string | null;
  deleteRequestedAt: string | null;
  deletionAt: string | null;
  /** «Запрос на блокировку данных» подан и ждёт рассмотрения (F-15-155, этап 20) */
  dataBlockRequestedAt: string | null;
  profile: {
    gender: string;
    birthday: string | null;
    district: string | null;
    photoUrl: string | null;
    bigFont: boolean;
    timeFormat: string;
    consentAt: string | null;
  } | null;
  version: number;
}

export interface LoginEventRow {
  id: string;
  at: string;
  method: string;
  app: string;
  result: string;
  device: string;
  ip: string;
  current: boolean;
}

export function getAccount(): Promise<AccountView> {
  return http('GET', '/v1/me/account');
}

export function patchAccount(patch: Partial<Pick<AccountView, 'name' | 'locale'>> & Partial<NonNullable<AccountView['profile']>>, version?: number): Promise<AccountView> {
  return http('PATCH', '/v1/me/account', patch, { version });
}

export function setAccountTwoFactor(enabled: boolean): Promise<AccountView> {
  return http('PUT', '/v1/me/security/two-factor', { enabled });
}

export function requestMyAccountDeletion(): Promise<AccountView> {
  return http('POST', '/v1/me/account/delete');
}

export function cancelMyAccountDeletion(): Promise<AccountView> {
  return http('POST', '/v1/me/account/delete/cancel');
}

export function listLoginEvents(limit = 20): Promise<LoginEventRow[]> {
  return http('GET', '/v1/me/login-events', undefined, { query: { limit } });
}

// ─────────── этап 20: данные и удаление (F-15-154/155, docs/backend/06 §6) ───────────

export interface MyDataExportRow {
  id: string;
  requestedAt: string;
  ready: boolean;
}

/** «Выгрузить мои данные» (F-15-154) — не чаще раза в сутки, иначе ApiError('too_soon') */
export function requestMyDataExport(): Promise<MyDataExportRow> {
  return http('POST', '/v1/me/account/data-export');
}

export function listMyDataExports(): Promise<MyDataExportRow[]> {
  return http('GET', '/v1/me/account/data-exports');
}

/** «Запрос на блокировку данных» (F-15-155) — заявка, не мгновенное действие */
export function requestMyDataBlock(): Promise<AccountView> {
  return http('POST', '/v1/me/account/data-block');
}

export function sendPhoneChangeCodeApi(phone: string, channel: 'telegram' | 'whatsapp' | 'sms' = 'telegram'): Promise<unknown> {
  return http('POST', '/v1/me/account/phone/code', { phone, channel });
}

export function confirmPhoneChangeApi(input: { phone: string; code: string }): Promise<AccountView> {
  return http('POST', '/v1/me/account/phone/confirm', input);
}

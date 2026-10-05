'use client';

/**
 * Вход клиента и бизнеса (код, пароль администратора, Google, Apple) — лёгкий модуль для экрана входа и окна записи.
 * В режиме api — запрос к серверу; в демо — полный '@/api/client' догружается отдельным куском (viaMock), поэтому
 * страницы входа не тянут код кабинета. Те же функции реэкспортирует '@/api/client' — прочие экраны импортируют оттуда.
 */
import { http, isApiMode } from '@/api/http';
import { ApiError, viaMock } from '@/api/request';
import type { AdminLoginInput, AdminLoginResult, GoogleSignInResult, LoginChannel, LoginCodeSent, PendingGoogle, VerifiedAppUser, VerifyLoginInput } from '@/api/client';
import type { SecondFactorChallenge, SessionView } from '@/api/session';
import type { AppUser } from '@/domain/core';
import { nowDateTime } from '@/lib/date';

const client = () => import('@/api/client');

/** Сессия сервера → AppUser экранов (у человека на сервере нет пола/района — их знает профиль, этап 9) */
function appUserOfSession(session: SessionView): AppUser {
  return {
    id: session.user.id,
    phone: session.user.phone ?? '',
    name: session.user.name,
    gender: 'unknown',
    locale: session.user.locale,
    createdAt: nowDateTime(),
  };
}

/** Токен ожидающей привязки — в нужное поле verify: pendingGoogle или pendingApple */
export function pendingLinkTokens(pending: PendingGoogle | undefined): { pendingGoogle?: string; pendingApple?: string } {
  if (!pending) return {};
  return pending.provider === 'apple' ? { pendingApple: pending.token } : { pendingGoogle: pending.token };
}

/** Web Client ID из Google Cloud Console; без него на живом сайте кнопки «Войти через Google» нет */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** Показывать ли «Войти через Google»: живой сайт — если задан Client ID; демо — всегда (вход имитируется) */
export function googleSignInAvailable(): boolean {
  return isApiMode() ? Boolean(GOOGLE_CLIENT_ID) : true;
}

/** Куда можно прислать код — экран входа показывает выбор только из включённых каналов. В демо — все. */
export async function getLoginChannels(): Promise<LoginChannel[]> {
  if (isApiMode()) return (await http<{ channels: LoginChannel[] }>('GET', '/v1/auth/channels')).channels;
  return viaMock(client, (m) => m.getLoginChannelsMock());
}

/** Отправить код входа. В демо код всегда '0000' — показывается подсказкой на экране. */
export async function sendLoginCode(phone: string, channel: LoginChannel): Promise<LoginCodeSent> {
  if (isApiMode()) {
    // Сервер: 4 цифры, 5 минут, повтор через 60 с (ApiError code_resend_wait с retryAfter), только +374.
    // Канал не доставил (у номера нет Telegram) — сервер сам шлёт тот же код в следующий включённый канал.
    const sent = await http<LoginCodeSent>('POST', '/v1/auth/code', { phone, channel });
    return { channel: sent.channel, channels: sent.channels ?? [sent.channel], resendAfter: sent.resendAfter };
  }
  return viaMock(client, (m) => m.sendLoginCodeMock(phone, channel));
}

export async function verifyLoginCode(input: VerifyLoginInput): Promise<VerifiedAppUser> {
  if (isApiMode()) {
    const session = await http<SessionView & { googleLinked?: boolean; appleLinked?: boolean }>('POST', '/v1/auth/verify', {
      phone: input.phone,
      code: input.code,
      app: 'client',
      name: input.name,
      consent: input.consent,
      pendingGoogle: input.pendingGoogle,
      pendingApple: input.pendingApple,
    });
    return { ...appUserOfSession(session), googleLinked: session.googleLinked ?? session.appleLinked };
  }
  return viaMock(client, (m) => m.verifyLoginCodeMock(input));
}

/**
 * Войти через Google: idToken — от Google Identity Services. Сервер проверяет токен; привязан — сессия, нет — pending.
 * Демо (без настоящего Google): сразу вход демо-персоной — клиент по умолчанию или владелец салона.
 */
export async function signInWithGoogle(input: { idToken?: string; app: 'client' | 'business'; consent?: boolean }): Promise<GoogleSignInResult> {
  if (isApiMode()) {
    const r = await http<{ session: SessionView | null; pendingGoogle: (PendingGoogle & { expiresIn: number }) | null }>('POST', '/v1/auth/google', {
      idToken: input.idToken,
      app: input.app,
      consent: input.consent,
    });
    if (r.session) return { kind: 'signedIn', user: appUserOfSession(r.session), hasBusiness: r.session.memberships.length > 0 };
    if (r.pendingGoogle) return { kind: 'linkRequired', pending: { token: r.pendingGoogle.token, email: r.pendingGoogle.email, name: r.pendingGoogle.name } };
    throw new ApiError('google_invalid');
  }
  return viaMock(client, (m) => m.signInWithGoogleMock(input));
}

export async function verifyAdminLogin(input: AdminLoginInput): Promise<AdminLoginResult> {
  if (isApiMode()) {
    const r = await http<SessionView | { secondFactor: SecondFactorChallenge }>('POST', '/v1/auth/password', {
      login: input.login,
      password: input.password,
    });
    if ('secondFactor' in r) return { requirePasswordChange: false, secondFactor: r.secondFactor };
    return { requirePasswordChange: r.mustChangePassword };
  }
  return viaMock(client, (m) => m.verifyAdminLoginMock(input));
}

/** Новый пароль администратора после первого входа (F-00-034) */
export async function changeAdminPassword(login: string, newPassword: string, oldPassword?: string): Promise<void> {
  if (isApiMode()) {
    // Сервер знает вход из сессии; при первом входе (пароль выдан владельцем) старый пароль не нужен
    await http('POST', '/v1/auth/password/change', { newPassword, oldPassword: oldPassword || undefined });
    return;
  }
  return viaMock(client, (m) => m.changeAdminPasswordMock(login, newPassword, oldPassword));
}

/** hasBusiness: false — номер вошёл, но бизнеса у человека ещё нет (экран ведёт на регистрацию бизнеса) */
export async function verifyBusinessPhoneLogin(input: {
  phone: string;
  code: string;
  pendingGoogle?: string;
  pendingApple?: string;
}): Promise<{ hasBusiness: boolean; googleLinked?: boolean }> {
  if (isApiMode()) {
    const view = await http<SessionView & { googleLinked?: boolean; appleLinked?: boolean }>('POST', '/v1/auth/verify', {
      phone: input.phone,
      code: input.code,
      app: 'business',
      pendingGoogle: input.pendingGoogle,
      pendingApple: input.pendingApple,
    });
    return { hasBusiness: view.memberships.length > 0, googleLinked: view.googleLinked ?? view.appleLinked };
  }
  return viaMock(client, (m) => m.verifyBusinessPhoneLoginMock(input));
}

/**
 * «Войти через Apple» — только внутри приложения BookTime на iOS (правило App Store 4.8; кнопка — GoogleSignIn.tsx,
 * токен — нативное окно Apple, src/lib/native). Сервер проверяет identity token; привязан — сессия, нет — pending.
 * name — имя из Apple (его дают только при первом входе). authorizationCode — одноразовый код из того же ответа Apple:
 * сервер меняет его на refresh token, чтобы отозвать вход через Apple при удалении аккаунта (App Store 5.1.1(v)).
 * Демо — как Google: сразу вход демо-персоной.
 */
export async function signInWithApple(input: {
  identityToken?: string;
  authorizationCode?: string | null;
  name?: string | null;
  app: 'client' | 'business';
  consent?: boolean;
}): Promise<GoogleSignInResult> {
  if (isApiMode()) {
    const r = await http<{ session: SessionView | null; pendingApple: (PendingGoogle & { expiresIn: number }) | null }>('POST', '/v1/auth/apple', {
      identityToken: input.identityToken,
      authorizationCode: input.authorizationCode ?? undefined,
      app: input.app,
      consent: input.consent,
      name: input.name ?? undefined,
    });
    if (r.session) return { kind: 'signedIn', user: appUserOfSession(r.session), hasBusiness: r.session.memberships.length > 0 };
    if (r.pendingApple) {
      return { kind: 'linkRequired', pending: { token: r.pendingApple.token, email: r.pendingApple.email, name: r.pendingApple.name, provider: 'apple' } };
    }
    throw new ApiError('apple_invalid');
  }
  return viaMock(client, (m) => m.signInWithAppleMock(input));
}

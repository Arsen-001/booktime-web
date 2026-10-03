/**
 * Общие настройки Sentry для сайта (03.10.2026; организация BookTime, проект booktime-web, данные в ЕС).
 * Без NEXT_PUBLIC_SENTRY_DSN — выключен (разработка). Окружение: demo (мок-сборка demo.booktime.am) / production /
 * preview (staging). Личные данные не уходят: пользователь, cookie, заголовки и тело запроса вырезаются.
 */
import type { ErrorEvent } from '@sentry/nextjs';

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

export function sentryEnvironment(): string {
  if (process.env.NEXT_PUBLIC_DATA !== 'api') return 'demo';
  return process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}

export function stripPersonalData(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  return event;
}

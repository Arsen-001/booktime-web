// Мониторинг ошибок на сервере Next (Sentry): register — один раз при запуске, onRequestError — ошибки рендера и
// серверных обработчиков. Без DSN ничего не делает. Настройки — lib/sentry-options.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, sentryEnvironment, stripPersonalData } from '@/lib/sentry-options';

export function register() {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: sentryEnvironment(),
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    tracesSampleRate: 0,
    beforeSend: stripPersonalData,
  });
}

export const onRequestError = Sentry.captureRequestError;

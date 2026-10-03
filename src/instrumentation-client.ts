// Мониторинг ошибок в браузере (Sentry) — до запуска приложения; без DSN ничего не делает. Настройки — lib/sentry-options.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, sentryEnvironment, stripPersonalData } from '@/lib/sentry-options';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: sentryEnvironment(),
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    tracesSampleRate: 0,
    // Шум расширений браузера и обрывов сети — не наши ошибки
    ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', /^AbortError/, 'Load failed', 'Failed to fetch'],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
    beforeSend: stripPersonalData,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

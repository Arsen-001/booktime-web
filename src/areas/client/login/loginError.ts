import { HttpApiError } from '@/api/http';
import type { useT } from '@/i18n/useT';

type ClientT = ReturnType<typeof useT<'client'>>;

/**
 * Текст ошибки входа по коду ответа сервера (режим api). Ошибки мока и неизвестные коды — запасной текст экрана,
 * как было до сервера. Сервер отвечает кодами, переводит экран (PLAN.md Р12).
 */
export function loginErrorText(t: ClientT, error: unknown, fallback: string): string {
  if (!(error instanceof HttpApiError)) return fallback;
  const sec = error.retryAfter ?? 60;
  switch (error.code) {
    case 'code_resend_wait':
      return t('login.errors.resendWait', { sec });
    case 'code_not_delivered':
      return t('login.errors.notDelivered');
    case 'rate_limited':
      return t('login.errors.tooMany');
    case 'code_expired':
      return t('login.errors.expired');
    case 'code_attempts':
      return t('login.errors.attempts');
    case 'account_locked':
      return t('login.errors.locked', { min: Math.max(1, Math.ceil(sec / 60)) });
    case 'account_blocked':
      return t('login.errors.blocked');
    case 'weak_password':
      return t('login.errors.weakPassword');
    case 'network':
      return t('login.errors.network');
    default:
      return fallback;
  }
}

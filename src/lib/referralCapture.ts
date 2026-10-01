/**
 * «Пригласи подругу»: код из личной ссылки `/b/<slug>?ref=<код>` браузер помнит REFERRAL_REMEMBER_DAYS дней по
 * адресу салона — подруга может записаться не сразу и не с этой страницы (виджет, приложение). Запись отдаёт код
 * серверу (referralCode), он и решает, привязать ли. Хранилище может быть недоступно — тогда просто без кода.
 */
import { normalizeReferralCode, REFERRAL_REMEMBER_DAYS } from '@/domain/rules/referral';

const KEY = (slug: string) => `bt_ref:${slug}`;
/** Событие этой вкладки: код запомнили или забыли (storage-событие приходит только из других вкладок) */
export const REFERRAL_EVENT = 'bt-referral';

function notify(): void {
  try {
    window.dispatchEvent(new Event(REFERRAL_EVENT));
  } catch {
    // вне браузера — некого оповещать
  }
}

/** Подписка для useSyncExternalStore: изменения кода в этой и других вкладках */
export function subscribeReferral(onChange: () => void): () => void {
  window.addEventListener(REFERRAL_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(REFERRAL_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function rememberReferral(slug: string, rawCode: string | null | undefined): string | undefined {
  const code = normalizeReferralCode(rawCode);
  if (!code || !slug) return undefined;
  try {
    if (readReferral(slug) === code) return code;
    localStorage.setItem(KEY(slug), JSON.stringify({ code, at: Date.now() }));
  } catch {
    // приватное окно / запрет хранилища — запись пойдёт без кода
    return code;
  }
  notify();
  return code;
}

export function readReferral(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  try {
    const raw = localStorage.getItem(KEY(slug));
    if (!raw) return undefined;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > REFERRAL_REMEMBER_DAYS * 86_400_000) {
      localStorage.removeItem(KEY(slug));
      return undefined;
    }
    return normalizeReferralCode(code);
  } catch {
    return undefined;
  }
}

/** После записи код больше не нужен: привязка либо уже есть, либо этому клиенту не положена */
export function forgetReferral(slug: string | undefined): void {
  if (!slug) return;
  try {
    if (localStorage.getItem(KEY(slug)) === null) return;
    localStorage.removeItem(KEY(slug));
  } catch {
    // нет хранилища — нечего чистить
    return;
  }
  notify();
}

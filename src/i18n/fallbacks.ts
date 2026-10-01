import type { Locale } from '@/i18n/config';

/**
 * Какие ключи в текущем языке подставлены из ru. Модульное состояние (одно на вкладку браузера):
 * провайдер записывает, useT читает и пишет в консоль при первом использовании ключа на странице.
 *   hy → console.info  `[i18n:fallback-ru] hy ns.key`  (ожидаемо: армянский дозальём отдельным проходом)
 *   en → console.warn  `[i18n:no-en] ns.key`           (ошибка раздела: en пишется сразу)
 */
const state: { locale: Locale; keys: Set<string>; reported: Set<string> } = {
  locale: 'ru',
  keys: new Set(),
  reported: new Set(),
};

export function setFallbackKeys(locale: Locale, keys: string[]): void {
  if (state.locale === locale && state.keys.size === keys.length) return;
  state.locale = locale;
  state.keys = new Set(keys);
  state.reported = new Set();
}

export function reportIfFallback(fullKey: string): void {
  if (state.locale === 'ru' || !state.keys.has(fullKey) || state.reported.has(fullKey)) return;
  state.reported.add(fullKey);
  if (typeof window === 'undefined') return;
  if (state.locale === 'hy') console.info(`[i18n:fallback-ru] hy ${fullKey}`);
  else console.warn(`[i18n:no-en] ${fullKey}`);
}

import { CLIENT_LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n/config';

/**
 * Язык в адресе (SEO, 03.10.2026): публичные страницы живут по трём адресам — `/b/nuri` (ru, по умолчанию, без
 * префикса), `/hy/b/nuri`, `/en/b/nuri`, — чтобы поисковики индексировали армянскую, русскую и английскую версии
 * отдельно. proxy (src/proxy.ts) переписывает `/hy/<путь>` на `/<путь>` и передаёт язык заголовком
 * URL_LOCALE_HEADER (его читают getRequestLocale и getDemoSettings раньше cookie), а cookie `lang` обновляет —
 * дальше по приложению человек ходит на том же языке. Кабинет, панель, вход, запись, личное — без префикса:
 * `/hy/biz` перенаправляется на `/biz` (язык запоминается в cookie).
 *
 * Без импортов Next — файл читают proxy, серверные страницы, sitemap и клиентские компоненты.
 */

/** Заголовок запроса с языком из адреса (ставит proxy при переписывании `/hy/…`, `/en/…`) */
export const URL_LOCALE_HEADER = 'x-bt-lang';

/** Языки с префиксом в адресе: все клиентские, кроме языка по умолчанию */
export const PREFIXED_LOCALES: readonly Locale[] = CLIENT_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** Публичные страницы, у которых есть версии с языком в адресе (то же, что индексируют robots.txt и sitemap) */
const LOCALIZABLE: RegExp[] = [
  /^\/$/,
  /^\/search$/,
  /^\/register-business$/,
  /^\/business$/,
  /^\/b\/[^/]+$/,
  /^\/b\/[^/]+\/about$/,
  /^\/masters\/[^/]+$/,
];

/** Страница (путь без языка и без ?query) публичная и бывает с языком в адресе */
export function isLocalizablePath(pathname: string): boolean {
  return LOCALIZABLE.some((re) => re.test(pathname));
}

/** `/hy/b/nuri` → { locale: 'hy', pathname: '/b/nuri' }; `/hy` → '/'; без префикса — locale undefined */
export function splitLocalePrefix(pathname: string): { locale?: Locale; pathname: string } {
  const m = /^\/([a-z]{2})(?=\/|$)(.*)$/.exec(pathname);
  if (m && (PREFIXED_LOCALES as readonly string[]).includes(m[1])) {
    return { locale: m[1] as Locale, pathname: m[2] || '/' };
  }
  return { pathname };
}

/**
 * Адрес страницы на языке: localizedPath('/b/nuri', 'hy') → '/hy/b/nuri'; ('/', 'en') → '/en';
 * ('/search?sphere=nails', 'hy') → '/hy/search?sphere=nails'; ru и непубличные страницы — без префикса.
 * Уже префиксованный адрес сначала очищается.
 */
export function localizedPath(href: string, locale: Locale): string {
  const cut = href.search(/[?#]/);
  const rawPath = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);
  const { pathname } = splitLocalePrefix(rawPath || '/');
  if (!(PREFIXED_LOCALES as readonly string[]).includes(locale) || !isLocalizablePath(pathname)) return pathname + rest;
  return `/${locale}${pathname === '/' ? '' : pathname}${rest}`;
}

/** Адреса страницы на всех клиентских языках + x-default (= ru) — для hreflang и sitemap */
export function localeAlternates(href: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of CLIENT_LOCALES) out[l] = localizedPath(href, l);
  out['x-default'] = localizedPath(href, DEFAULT_LOCALE);
  return out;
}

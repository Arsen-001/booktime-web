import type { Locale } from '@/i18n/config';
import { isLocalizablePath, localizedPath, splitLocalePrefix } from '@/i18n/localePath';

/**
 * Смена языка на публичной странице (язык в адресе, 03.10.2026): адрес той же страницы на новом языке —
 * `/hy/b/nuri` → `/en/b/nuri` или `/b/nuri` (ru); `/b/nuri` → `/hy/b/nuri`. null — страница без языковых адресов
 * (кабинет, запись, личное) или адрес уже нужный: тогда язык живёт только в cookie.
 */
export function localeSwitchTarget(locale: Locale): string | null {
  if (typeof window === 'undefined') return null;
  const { pathname, search, hash } = window.location;
  const bare = splitLocalePrefix(pathname).pathname;
  if (!isLocalizablePath(bare)) return null;
  const next = localizedPath(bare, locale) + search + hash;
  return next === pathname + search + hash ? null : next;
}

/**
 * Перерисовать страницу на новом языке (cookie `lang` уже записан): на публичной странице сначала переходим на
 * адрес этого языка (иначе префикс /hy/ в адресе перебил бы cookie), затем router.refresh() — заново рисуются
 * и корневой layout (<html lang>, словари), и страница. Переход — router.replace, а не history.replaceState:
 * refresh встаёт в очередь роутера за переходом и берёт уже новый адрес (replaceState роутер видит с опозданием).
 */
export function refreshInLocale(router: { refresh(): void; replace(href: string, options?: { scroll?: boolean }): void }, locale: Locale): void {
  const target = localeSwitchTarget(locale);
  if (target) router.replace(target, { scroll: false });
  router.refresh();
}

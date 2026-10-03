'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { localizedPath, splitLocalePrefix } from '@/i18n/localePath';

/**
 * Язык в адресе (/hy/…, /en/…) для клиентских компонентов. На сервере usePathname() видит уже переписанный путь
 * (`/` вместо `/hy`), в браузере — настоящий, поэтому до гидрации берём язык, который сервер получил от proxy
 * (UrlLocaleProvider в корневом layout), а после — из адреса (он меняется при переходах без перезагрузки layout).
 */
const UrlLocaleContext = createContext<Locale | undefined>(undefined);

export function UrlLocaleProvider({ value, children }: { value: Locale | undefined; children: ReactNode }) {
  return <UrlLocaleContext.Provider value={value}>{children}</UrlLocaleContext.Provider>;
}

const noopSubscribe = () => () => {};

/** Язык из адреса страницы или undefined (адрес без префикса — ru или непубличная страница) */
export function useUrlLocale(): Locale | undefined {
  const initial = useContext(UrlLocaleContext);
  const fromPath = splitLocalePrefix(usePathname() ?? '/').locale;
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return hydrated ? fromPath : initial;
}

/**
 * Ссылка с публичной страницы на публичную сохраняет язык адреса (03.10.2026): на `/hy` ссылка `/search?sphere=nails`
 * → `/hy/search?sphere=nails`, `/masters/1` → `/hy/masters/1`. Без префикса в адресе и для непубличных страниц
 * (кабинет, запись, личное) — ссылка как есть: язык там держит cookie `lang`.
 */
export function useLocalizedHref(): (href: string) => string {
  const locale = useUrlLocale();
  return (href) => (locale ? localizedPath(href, locale) : href);
}

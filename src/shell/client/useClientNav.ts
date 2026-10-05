'use client';

import { usePathname } from 'next/navigation';
import { CLIENT_NAV } from '@/config/nav-client';
import { localizedPath, splitLocalePrefix } from '@/i18n/localePath';
import { useUrlLocale } from '@/i18n/useLocalizedHref';
import { useNavPending } from '@/ui/navigation/navPending';

/** Вкладки клиента с отметкой активной. Нажали вкладку — она активна сразу, не дожидаясь новой страницы (navPending) */
export function useClientNav() {
  const current = usePathname();
  const pending = useNavPending((s) => s.path);
  // Язык в адресе (/hy, /en/search): активная вкладка — по пути без языка, «Главная» и «Поиск» сохраняют язык
  const urlLocale = useUrlLocale();
  const pathname = splitLocalePrefix(pending ?? current).pathname;
  return CLIENT_NAV.map((item) => ({
    ...item,
    href: urlLocale ? localizedPath(item.href, urlLocale) : item.href,
    active: item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));
}

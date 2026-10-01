'use client';

import { usePathname } from 'next/navigation';
import { CLIENT_NAV } from '@/config/nav';
import { useNavPending } from '@/ui/navigation/navPending';

/** Вкладки клиента с отметкой активной. Нажали вкладку — она активна сразу, не дожидаясь новой страницы (navPending) */
export function useClientNav() {
  const current = usePathname();
  const pending = useNavPending((s) => s.path);
  const pathname = pending ?? current;
  return CLIENT_NAV.map((item) => ({
    ...item,
    active: item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));
}

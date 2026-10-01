'use client';

import { usePathname } from 'next/navigation';
import type { NavChild, NavItem } from '@/config/nav-types';
import { useNavPending } from '@/ui/navigation/navPending';

function matches(pathname: string, href: string): boolean {
  // Корень кабинета («Главная», /biz) — только сам адрес: иначе он «совпадал» бы с любой страницей кабинета
  if (href === '/biz') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Активный пункт и подпункт по адресу: побеждает самое длинное совпадение. Пока идёт переход (navPending) — по адресу,
 * куда человек нажал: пункт меню подсвечивается сразу, а не когда страница догрузится.
 */
export function useActiveNav(items: NavItem[]): { itemId?: string; childId?: string } {
  const current = usePathname();
  const pending = useNavPending((s) => s.path);
  const pathname = pending ?? current;
  let best: { itemId: string; childId?: string; len: number } | undefined;
  for (const item of items) {
    const candidates: { href: string; child?: NavChild }[] = [
      { href: item.href },
      ...(item.children ?? []).map((child) => ({ href: child.href, child })),
    ];
    for (const c of candidates) {
      if (!matches(pathname, c.href)) continue;
      if (!best || c.href.length > best.len || (c.href.length === best.len && c.child && !best.childId)) {
        best = { itemId: item.id, childId: c.child?.id, len: c.href.length };
      }
    }
  }
  return best ? { itemId: best.itemId, childId: best.childId } : {};
}

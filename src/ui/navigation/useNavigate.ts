'use client';

import { useRouter } from 'next/navigation';
import type { PrefetchOptions } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { startNavPending } from '@/ui/navigation/navPending';

// Вся страница, а не только каркас: у нас все адреса динамические (как prefetch у ссылок меню)
const FULL = { kind: 'full' } as unknown as PrefetchOptions;
const prefetched = new Set<string>();

/**
 * Переход из кода, который ощущается как ссылка: prefetch(href) при наведении грузит страницу заранее (в production —
 * нажатие открывает её сразу), go(href) сразу показывает полоску загрузки и подсветку меню (navPending) и переходит.
 *
 *   const nav = useNavigate();
 *   <tr onPointerEnter={() => nav.prefetch(href)} onClick={() => nav.go(href)}>
 */
export function useNavigate() {
  const router = useRouter();
  return {
    go(href: string) {
      startNavPending(href);
      router.push(href);
    },
    prefetch(href: string) {
      if (prefetched.has(href)) return;
      prefetched.add(href);
      router.prefetch(href, FULL);
    },
  };
}

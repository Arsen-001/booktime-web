'use client';

import { useEffect } from 'react';

/**
 * О1: плитки хаба ведут к нужному блоку (`/biz/online/settings#when`). Блок появляется после загрузки данных,
 * когда браузер уже отказался искать якорь, — поэтому прокручиваем сами один раз, как только `ready`.
 */
export function useScrollToHash(ready: boolean): void {
  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [ready]);
}

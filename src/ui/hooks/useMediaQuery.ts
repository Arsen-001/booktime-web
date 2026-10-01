'use client';

import { useSyncExternalStore } from 'react';
import { useViewportHint } from '@/ui/device/ViewportHintProvider';
import { matchesWidth } from '@/ui/device/viewportHint';

/**
 * Совпадает ли медиазапрос. На сервере и при гидрации — по ширине экрана, которую сервер знает заранее
 * (ViewportHintProvider: cookie или тип устройства), поэтому телефон с первого кадра в раскладке телефона.
 * Запрос не про ширину — на сервере false.
 *   const isMobile = useMediaQuery(MOBILE_QUERY);
 */
export function useMediaQuery(query: string): boolean {
  const hint = useViewportHint();
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => (hint === undefined ? false : (matchesWidth(query, hint) ?? false)),
  );
}

/** Телефон: уже 768px (граница md у Tailwind) */
export const MOBILE_QUERY = '(max-width: 767.98px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

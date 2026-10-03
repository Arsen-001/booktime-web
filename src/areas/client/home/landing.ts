'use client';

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/ui/hooks/useMediaQuery';

/** Пользователь просит без движения — живые сцены главной стоят в финальном кадре */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Элемент попал в экран (один раз) — для появления при прокрутке (.lp-rv) и запуска сцен.
 */
export function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null);
  // Без IntersectionObserver (старый WebView) — сразу «виден»
  const [inView, setInView] = useState(() => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** data-in для .lp-rv: атрибут есть — элемент на месте */
export const inAttr = (on: boolean) => (on ? { 'data-in': '' } : {});

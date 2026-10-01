'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { VIEWPORT_COOKIE } from '@/ui/device/viewportHint';

const ViewportHintContext = createContext<number | undefined>(undefined);

/** Ширина экрана, по которой нарисован первый кадр (сервер и гидрация); после гидрации — не нужна */
export function useViewportHint(): number | undefined {
  return useContext(ViewportHintContext);
}

/**
 * Даёт экранам ширину, с которой сервер рисовал страницу (useMediaQuery отвечает по ней в первом кадре), и держит
 * cookie с настоящей шириной окна — следующая страница с сервера придёт сразу в нужной раскладке.
 */
export function ViewportHintProvider({ width, children }: { width: number; children: ReactNode }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      document.cookie = `${VIEWPORT_COOKIE}=${Math.round(window.innerWidth)}; path=/; max-age=31536000; samesite=lax`;
    };
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(save, 300);
    };
    save();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return <ViewportHintContext.Provider value={width}>{children}</ViewportHintContext.Provider>;
}

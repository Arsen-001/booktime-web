'use client';

import { useEffect } from 'react';

let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

/** Блокирует прокрутку страницы, пока active (для модалок и шторок; вложенные считаются). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (locks === 0) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0 && saved) {
        body.style.overflow = saved.overflow;
        body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}

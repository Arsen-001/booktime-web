'use client';

import { useEffect, useRef } from 'react';

/** Стек открытых слоёв: Esc закрывает только верхний (поповер внутри модалки → сначала поповер). */
const stack: symbol[] = [];

export function useEscape(active: boolean, onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const token = Symbol('layer');
    stack.push(token);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || stack[stack.length - 1] !== token) return;
      event.stopPropagation();
      handlerRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [active]);
}

'use client';

import { useEffect, useRef } from 'react';

/** Нажатие вне всех переданных элементов → handler (пока active). */
export function useClickOutside(
  elements: (HTMLElement | null)[],
  handler: (event: PointerEvent) => void,
  active = true,
): void {
  const handlerRef = useRef(handler);
  const elementsRef = useRef(elements);
  useEffect(() => {
    handlerRef.current = handler;
    elementsRef.current = elements;
  });

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inside = elementsRef.current.some((el) => el?.contains(target));
      if (!inside) handlerRef.current(event);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);
}

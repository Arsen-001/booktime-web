'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface ScrollEdges {
  /** Слева есть скрытое содержимое */
  start: boolean;
  /** Справа есть скрытое содержимое */
  end: boolean;
}

/**
 * Есть ли у горизонтально прокручиваемого блока скрытое содержимое слева/справа.
 * Для затухания края (`fade-x-*` в polish.css): человек видит, что полосу можно листать.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: el.scrollLeft > 2, end: max - el.scrollLeft > 2 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Ширина содержимого меняется и без смены размера самого блока: подгрузился шрифт, пришли подписи или данные.
    // В WebView Android страница рисуется раньше, чем приходит шрифт, — без слежки за детьми край так и оставался
    // «без продолжения», хотя полосу можно листать.
    const ro = new ResizeObserver(update);
    const observeChildren = () => {
      ro.disconnect();
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    };
    observeChildren();
    const mo = new MutationObserver(() => {
      observeChildren();
      update();
    });
    mo.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);

  return edges;
}

/** Класс маски по краям: fade-x-start / fade-x-end / fade-x-both или ничего */
export function scrollEdgeClass({ start, end }: ScrollEdges): string | undefined {
  if (start && end) return 'fade-x-both';
  if (end) return 'fade-x-end';
  if (start) return 'fade-x-start';
  return undefined;
}

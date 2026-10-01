'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { DURATION, EASE } from '@/ui/motion';

/**
 * Скользящий индикатор (полоска вкладок, «пилюля» сегментов) без перерисовок React и без Motion:
 * индикатор — абсолютный элемент внутри того же позиционированного контейнера, что и кнопки. Хук пишет ему
 * width/transform прямо в DOM, а переезд играет Web Animations API (transform: translateX + scaleX, FLIP) — поток
 * композитора, 60 fps даже на слабом Android. Пока хук не отработал (SSR, до гидратации), выбранная кнопка
 * рисует себя сама; как только индикатор на месте, контейнер получает data-slide — по нему кнопка гасит свою подложку.
 *
 * Индикатору нужен класс `origin-left` (transform-origin: 0 0) и `left-0`.
 */
export function useSlidingIndicator(
  container: RefObject<HTMLElement | null>,
  indicator: RefObject<HTMLElement | null>,
  items: RefObject<(HTMLElement | null)[]>,
  activeIndex: number,
  /** Меняется состав кнопок (подписи, число) — пересчитать место */
  layoutKey = '',
): void {
  const prev = useRef<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const box = container.current;
    const ind = indicator.current;
    if (!box || !ind) return;

    const place = (animate: boolean) => {
      const el = activeIndex >= 0 ? items.current?.[activeIndex] : null;
      if (!el) {
        ind.style.setProperty('opacity', '0');
        box.removeAttribute('data-slide');
        prev.current = null;
        return;
      }
      const x = el.offsetLeft;
      const w = el.offsetWidth;
      const p = prev.current;
      ind.style.setProperty('width', `${w}px`);
      ind.style.setProperty('transform', `translateX(${x}px)`);
      ind.style.setProperty('opacity', '1');
      box.setAttribute('data-slide', '');
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (animate && p && (p.x !== x || p.w !== w) && !reduced && typeof ind.animate === 'function') {
        ind.animate(
          [{ transform: `translateX(${p.x}px) scaleX(${p.w / w})` }, { transform: `translateX(${x}px) scaleX(1)` }],
          { duration: DURATION.normal * 1000, easing: `cubic-bezier(${EASE.out.join(',')})` },
        );
      }
      prev.current = { x, w };
    };

    place(true);
    // Шрифт догрузился, ширина поменялась, счётчик во вкладке вырос — встать на место без анимации
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place(false)) : undefined;
    observer?.observe(box);
    const el = items.current?.[activeIndex];
    if (el) observer?.observe(el);
    return () => observer?.disconnect();
  }, [container, indicator, items, activeIndex, layoutKey]);
}

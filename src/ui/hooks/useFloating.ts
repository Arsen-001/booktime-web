'use client';

import { useLayoutEffect } from 'react';

export type FloatingSide = 'bottom' | 'top' | 'left' | 'right';
export type FloatingAlign = 'start' | 'center' | 'end';

export interface FloatingOptions {
  open: boolean;
  /** Якорь (кнопка). Передавайте элемент из useState-колбэка: ref={setAnchor} */
  anchor: HTMLElement | null;
  /** Плавающий элемент: ref={setFloating} */
  floating: HTMLElement | null;
  side?: FloatingSide;
  align?: FloatingAlign;
  /** Отступ от якоря, px */
  offset?: number;
  /** Ширина не меньше якоря */
  matchWidth?: boolean;
}

const MARGIN = 8;
/** Боковое поле страницы: панель не прилипает к краю экрана */
const EDGE = 16;

/**
 * Позиционирует плавающий элемент (position: fixed) относительно якоря: сторона bottom/top/left/right,
 * выравнивание start/center/end (для left/right — по вертикали), переворот у края экрана, сдвиг внутрь экрана, пересчёт при
 * прокрутке и изменении размера. Пишет стили прямо в DOM (без setState), пока элемент открыт.
 * Сам элемент рендерите с style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}.
 * Элементы берите через useState (const [anchor, setAnchor] = useState<HTMLElement | null>(null);
 * ref={setAnchor}) — так правило react-hooks/refs не ругается на чтение ref в рендере.
 */
export function useFloating({
  open,
  anchor,
  floating,
  side = 'bottom',
  align = 'start',
  offset = 6,
  matchWidth = false,
}: FloatingOptions): void {
  useLayoutEffect(() => {
    if (!open || !anchor || !floating) return;
    const update = () => {
      const a = anchor.getBoundingClientRect();
      if (matchWidth) floating.style.setProperty('min-width', `${a.width}px`);
      const f = floating.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const style = floating.style;

      if (side === 'left' || side === 'right') {
        // Сбоку: align — выравнивание по вертикали; переворот, если с этой стороны не хватает места
        const spaceRight = vw - a.right;
        const spaceLeft = a.left;
        let placeLeft = side === 'left';
        if (placeLeft && spaceLeft < f.width + offset && spaceRight > spaceLeft) placeLeft = false;
        if (!placeLeft && spaceRight < f.width + offset && spaceLeft > spaceRight) placeLeft = true;
        let left = placeLeft ? a.left - f.width - offset : a.right + offset;
        left = Math.max(MARGIN, Math.min(left, vw - f.width - MARGIN));
        let top = align === 'start' ? a.top : align === 'end' ? a.bottom - f.height : a.top + a.height / 2 - f.height / 2;
        top = Math.max(MARGIN, Math.min(top, vh - f.height - MARGIN));
        style.setProperty('top', `${Math.round(top)}px`);
        style.setProperty('left', `${Math.round(left)}px`);
        style.setProperty('max-height', `${vh - 2 * MARGIN}px`);
        style.setProperty('visibility', 'visible');
        floating.setAttribute('data-side', placeLeft ? 'left' : 'right');
        return;
      }

      const spaceBelow = vh - a.bottom;
      const spaceAbove = a.top;
      let placeTop = side === 'top';
      if (placeTop && spaceAbove < f.height + offset && spaceBelow > spaceAbove) placeTop = false;
      if (!placeTop && spaceBelow < f.height + offset && spaceAbove > spaceBelow) placeTop = true;

      let top = placeTop ? a.top - f.height - offset : a.bottom + offset;
      top = Math.max(MARGIN, Math.min(top, vh - f.height - MARGIN));

      let left = align === 'start' ? a.left : align === 'end' ? a.right - f.width : a.left + a.width / 2 - f.width / 2;
      // По горизонтали — не ближе поля страницы (16 px) к краю экрана, если панель помещается
      const edge = Math.max(MARGIN / 2, Math.min(EDGE, (vw - f.width) / 2));
      left = Math.max(edge, Math.min(left, vw - f.width - edge));

      style.setProperty('top', `${Math.round(top)}px`);
      style.setProperty('left', `${Math.round(left)}px`);
      style.setProperty('max-height', `${Math.max(160, (placeTop ? a.top : vh - a.bottom) - offset - MARGIN)}px`);
      style.setProperty('visibility', 'visible');
      floating.setAttribute('data-side', placeTop ? 'top' : 'bottom');
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    observer?.observe(floating);
    observer?.observe(anchor);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchor, floating, side, align, offset, matchWidth]);
}

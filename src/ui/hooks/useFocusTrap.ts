'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.offsetParent !== null,
  );
}

export interface FocusTrapOptions {
  /**
   * Куда поставить фокус при открытии, если нет [data-autofocus]:
   * first — первый фокусируемый (по умолчанию), container — сам контейнер (tabIndex=-1). Второе — для шторок:
   * первым в них идёт «✕», и его кольцо фокуса бросалось в глаза сразу при открытии.
   */
  initialFocus?: 'first' | 'container';
}

/**
 * Фокус внутри контейнера, пока active: при открытии — на первый элемент с [data-autofocus] или
 * первый фокусируемый (иначе на сам контейнер), Tab/Shift+Tab по кругу, при закрытии — назад.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  { initialFocus = 'first' }: FocusTrapOptions = {},
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;

    const initial =
      container.querySelector<HTMLElement>('[data-autofocus]') ??
      (initialFocus === 'container' ? container : getFocusable(container)[0]) ??
      container;
    initial.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active, initialFocus]);
}

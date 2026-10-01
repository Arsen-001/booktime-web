'use client';

import { useSyncExternalStore } from 'react';

/**
 * Элемент страницы по селектору — и тогда, когда он появится позже (данные ещё грузятся).
 * Следит за DOM через MutationObserver, пока `active`. Селектор обычно `[data-tour="journal-add"]`.
 * Возвращает null, если элемента нет или он скрыт (display: none).
 */
export function useTargetElement(selector: string | undefined, active: boolean): HTMLElement | null {
  return useSyncExternalStore(
    (onChange) => {
      if (!active || !selector) return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style'],
      });
      window.addEventListener('resize', onChange);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', onChange);
      };
    },
    () => (active && selector ? findVisible(selector) : null),
    () => null,
  );
}

function findVisible(selector: string): HTMLElement | null {
  let list: NodeListOf<HTMLElement>;
  try {
    list = document.querySelectorAll<HTMLElement>(selector);
  } catch {
    return null;
  }
  // Первый видимый: одна и та же кнопка часто есть и в мобильной, и в десктопной раскладке
  for (const el of list) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

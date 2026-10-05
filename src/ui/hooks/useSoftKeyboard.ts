'use client';

import { useSyncExternalStore } from 'react';

/** Поля, у которых нет экранной клавиатуры */
const NO_KEYBOARD_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden']);
/** Окно стало ниже на столько — значит, снизу выехала клавиатура (а не спряталась адресная строка браузера) */
const SHRINK_PX = 150;

function isTextEntry(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !el.readOnly && !el.disabled && !NO_KEYBOARD_TYPES.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

// Высота окна без клавиатуры — самая большая при этой ширине (поворот телефона — считаем заново)
let fullHeight = 0;
let fullWidth = 0;
function viewportShrunk(): boolean {
  const height = window.visualViewport?.height ?? window.innerHeight;
  if (window.innerWidth !== fullWidth) {
    fullWidth = window.innerWidth;
    fullHeight = height;
  }
  fullHeight = Math.max(fullHeight, height);
  return fullHeight - height > SHRINK_PX;
}

function snapshot(): boolean {
  if (!window.matchMedia('(pointer: coarse)').matches) return false;
  return isTextEntry(document.activeElement) || viewportShrunk();
}

function subscribe(onChange: () => void): () => void {
  // Фокус уходит с поля раньше, чем приходит на следующее, — ждём кадр, чтобы между полями ничего не мигало
  let frame = 0;
  const later = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onChange);
  };
  const vv = window.visualViewport;
  document.addEventListener('focusin', onChange);
  document.addEventListener('focusout', later);
  vv?.addEventListener('resize', onChange);
  window.addEventListener('resize', onChange);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('focusin', onChange);
    document.removeEventListener('focusout', later);
    vv?.removeEventListener('resize', onChange);
    window.removeEventListener('resize', onChange);
  };
}

/**
 * Открыта ли экранная клавиатура (только сенсорные экраны): в фокусе поле ввода или окно заметно стало ниже.
 * Android WebView при клавиатуре сжимает страницу, и всё, что прибито к низу (нижние вкладки), выезжает над
 * клавиатурой и закрывает поле, — такие полосы на это время прячут:
 *   const keyboard = useSoftKeyboardOpen();  <nav className={cn('fixed bottom-0', keyboard && 'hidden')}>
 * На сервере и в первом кадре — false.
 */
export function useSoftKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

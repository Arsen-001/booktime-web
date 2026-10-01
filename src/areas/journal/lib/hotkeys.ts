'use client';

/**
 * Горячие клавиши журнала (⭐ рабочий день №8, владелец 01.10.2026). Клавиши — ФИЗИЧЕСКИЕ (event.code), а не буквы
 * (event.key): N, F, T и «/» работают одинаково на английской, русской и армянской раскладке — на русской та же
 * клавиша печатает «т», «а», «е» и «.», но код у неё прежний (KeyN, KeyF, KeyT, Slash).
 *
 * Не срабатывают, когда человек печатает (поле ввода, textarea, select, contenteditable), когда открыто окно или
 * шторка (стек слоёв ui) и когда фокус внутри поповера/меню/списка. Esc — исключение лишь в том смысле, что окна
 * закрывают себя сами (useEscape в ui останавливает событие на document) — сюда Esc доходит, только если никакого
 * слоя нет, и тогда снимает подсветку «Найти окно».
 */
import { useEffect, useRef } from 'react';
import { useOverlayStackStore } from '@/ui/hooks/useOverlayStack';

export type JournalHotkey =
  | 'newBooking'
  | 'findSlot'
  | 'search'
  | 'today'
  | 'prevDay'
  | 'nextDay'
  | 'layout1'
  | 'layout2'
  | 'layout3'
  | 'layout4'
  | 'close'
  | 'help';

/** Подписи клавиш для списка «?» — в порядке показа. Значения — то, что нарисовано на клавише */
export type HotkeyListAction = 'newBooking' | 'findSlot' | 'search' | 'today' | 'days' | 'layouts' | 'close' | 'help';
export const HOTKEY_LIST: { action: HotkeyListAction; keys: string[] }[] = [
  { action: 'newBooking', keys: ['N'] },
  { action: 'findSlot', keys: ['F'] },
  { action: 'search', keys: ['/'] },
  { action: 'today', keys: ['T'] },
  { action: 'days', keys: ['←', '→'] },
  { action: 'layouts', keys: ['1', '2', '3', '4'] },
  { action: 'close', keys: ['Esc'] },
  { action: 'help', keys: ['?'] },
];

interface KeyLike {
  code: string;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

/** Какое действие у нажатия — чистая функция от кода клавиши (без раскладки). null — не наша клавиша */
export function hotkeyOf(e: KeyLike): JournalHotkey | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  // «?» — Shift + клавиша «/» (на русской раскладке это «,», код тот же — Slash)
  if (e.code === 'Slash' || e.code === 'NumpadDivide') return e.shiftKey && e.code === 'Slash' ? 'help' : 'search';
  if (e.code === 'Escape' || e.key === 'Escape') return 'close';
  if (e.shiftKey) return null;
  switch (e.code) {
    case 'KeyN':
      return 'newBooking';
    case 'KeyF':
      return 'findSlot';
    case 'KeyT':
      return 'today';
    case 'ArrowLeft':
      return 'prevDay';
    case 'ArrowRight':
      return 'nextDay';
    case 'Digit1':
    case 'Numpad1':
      return 'layout1';
    case 'Digit2':
    case 'Numpad2':
      return 'layout2';
    case 'Digit3':
    case 'Numpad3':
      return 'layout3';
    case 'Digit4':
    case 'Numpad4':
      return 'layout4';
    default:
      return null;
  }
}

/** Человек печатает или фокус в своём слое (поповер, меню, список) — клавиши журнала молчат */
function focusIsBusy(target: EventTarget | null): boolean {
  const el = (target instanceof Element ? target : null) ?? (typeof document !== 'undefined' ? document.activeElement : null);
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]')) return true;
  return Boolean(el.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="alertdialog"]'));
}

/** Открыто окно или шторка (стек слоёв ui) — клавиши принадлежат ему */
function overlayOpen(): boolean {
  if (useOverlayStackStore.getState().items.length > 0) return true;
  return typeof document !== 'undefined' && Boolean(document.querySelector('[aria-modal="true"]'));
}

/**
 * Подписка на клавиши журнала. handlers — что делать; нет обработчика — клавиша ничего не делает (например, «N» без права
 * создавать записи). Обработчики читаются из ref: смена их между рендерами не переподписывает слушатель.
 */
export function useJournalHotkeys(handlers: Partial<Record<JournalHotkey, () => void>>, enabled = true): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const action = hotkeyOf(e);
      if (!action) return;
      // Окна закрывают себя сами (Esc) и владеют остальными клавишами
      if (overlayOpen()) return;
      if (focusIsBusy(e.target)) return;
      // Стрелки внутри переключателя видов, вкладок, ползунка — их собственные стрелки
      if ((action === 'prevDay' || action === 'nextDay') && e.target instanceof Element && e.target.closest('[role="radiogroup"], [role="tablist"], [role="slider"], [role="grid"]'))
        return;
      // Держит палец на «N» — одна новая запись, а не десять; стрелки можно держать
      if (e.repeat && action !== 'prevDay' && action !== 'nextDay') return;
      const fn = ref.current[action];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    // window, всплытие: useEscape окон ловит Esc раньше, на document, и останавливает его
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

'use client';

/**
 * Стиль журнала — выбор каждого (owner 08.10.2026: «кто какой стиль захочет, тот и сделает»):
 *  - 'live'     — «Живой день» (owner 08.10.2026, по умолчанию): журнал сам показывает деньги и дыры в дне — прошедшее
 *                 приглушено, у идущего визита полоса «ещё N мин», свободные окна выделены точками с «Записать»,
 *                 у мастера кольцо загрузки, выручка и что он делает сейчас, сверху «пульс дня»;
 *  - 'booktime' — наш макет A2 (DESIGN.md → Journal): светлый тон лака, крупное время, белая карточка-сетка;
 *  - 'google'   — «как Google Calendar»: белая страница, события сплошным цветом услуги, мелкий текст;
 *  - 'ios'      — «1:1 как Календарь iOS» (owner 08.10.2026): подкраска цвета с полосой слева, красный акцент «сегодня»,
 *                 системный шрифт (на Apple — SF).
 * Хранится на устройстве (localStorage). Меняется в «⋯ Ещё» → «Сетка» (JournalGridSettings).
 *
 * Чистые функции сетки (lib/grid.pxPerMin, lib/board.bookingTone, cardSizes) читают стиль, которым журнал
 * ОТРИСОВАН сейчас (renderedJournalStyle): JournalScreen ставит его в начале рендера и перемонтирует доску по смене
 * стиля (key), поэтому раскладка всегда считается в одном стиле — и при оживлении страницы тоже.
 */
import { useSyncExternalStore } from 'react';

export type JournalStyle = 'live' | 'booktime' | 'google' | 'ios';

export const JOURNAL_STYLES: JournalStyle[] = ['live', 'booktime', 'google', 'ios'];

const KEY = 'bt-journal-style';
const DEFAULT: JournalStyle = 'live';

let stored: JournalStyle | null = null;
let rendered: JournalStyle = DEFAULT;
const listeners = new Set<() => void>();

function readStored(): JournalStyle {
  if (stored) return stored;
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(KEY);
  } catch {
    /* приватное окно — стиль по умолчанию */
  }
  stored = (JOURNAL_STYLES as string[]).includes(value ?? '') ? (value as JournalStyle) : DEFAULT;
  return stored;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Выбранный стиль; на сервере и при оживлении страницы — стиль по умолчанию */
export function useJournalStyle(): JournalStyle {
  return useSyncExternalStore(subscribe, readStored, () => DEFAULT);
}

export function setJournalStyle(style: JournalStyle) {
  stored = style;
  try {
    window.localStorage.setItem(KEY, style);
  } catch {
    /* не запомним — до перезагрузки */
  }
  listeners.forEach((l) => l());
}

/** Ставит JournalScreen в начале рендера: стиль, в котором сейчас рисуется доска */
export function setRenderedJournalStyle(style: JournalStyle) {
  rendered = style;
}

/** Стиль, в котором рисуется доска, — для чистых функций сетки */
export function renderedJournalStyle(): JournalStyle {
  return rendered;
}

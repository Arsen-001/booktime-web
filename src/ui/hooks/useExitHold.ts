'use client';

import { createContext, useContext, useState } from 'react';

/*
 * Окно, смонтированное условием (`{row && <Sheet open …/>}`), уходит без анимации: вместе с условием из дерева
 * пропадает и AnimatePresence внутри Modal/Sheet. useExitHold держит последнее значение, пока окно проигрывает уход:
 *
 *   const edit = useExitHold(editing);          // editing: Row | null
 *   {edit.mounted && (
 *     <EditSheet row={edit.value!} open={edit.open} onExitComplete={edit.onExitComplete} … />
 *   )}
 *
 * Если окно внутри компонента-обёртки открыто всегда (`<Sheet open …>`), удобнее <ExitHold> (src/ui/ExitHold.tsx):
 * он передаёт open/onExitComplete через контекст, и Modal/Sheet внутри берут их сами — обёртку менять не нужно.
 *
 * value должно быть стабильным между рендерами (состояние, данные запроса, элемент из них через find) — новое
 * значение запоминается прямо в рендере.
 */

export type ExitHoldValue<T> = T | null | undefined | false;

export interface ExitHold<T> {
  /** Текущее значение, а во время ухода — последнее непустое */
  value: T | undefined;
  /** Показывать окно: значение сейчас непустое */
  open: boolean;
  /** Держать окно в дереве: открыто или ещё уходит */
  mounted: boolean;
  /** Отдать в onExitComplete у Modal/Sheet: уход закончился — отпускаем значение */
  onExitComplete: () => void;
}

function present<T>(value: ExitHoldValue<T>): value is T {
  // Пустая строка — как в `{'' && …}`: ничего не открыто. Ноль — значение (день недели 0)
  return value !== null && value !== undefined && value !== false && value !== '';
}

export function useExitHold<T>(value: ExitHoldValue<T>): ExitHold<T> {
  const open = present(value);
  const [held, setHeld] = useState<{ v: T } | null>(open ? { v: value } : null);
  // Новое непустое значение — запоминаем (сравнение по ссылке, поэтому value должно быть стабильным)
  if (open && (held === null || !Object.is(held.v, value))) setHeld({ v: value });
  return {
    value: open ? value : held?.v,
    open,
    mounted: open || held !== null,
    onExitComplete: () => {
      if (!open) setHeld(null);
    },
  };
}

export interface OverlayPresence {
  open: boolean;
  onExitComplete: () => void;
}

/** Контекст <ExitHold>: Modal/Sheet внутри закрываются по нему и сообщают об окончании ухода. Внутри окна сброшен. */
export const OverlayPresenceContext = createContext<OverlayPresence | null>(null);

/** Для Modal/Sheet: открыто ли окно с учётом <ExitHold> снаружи, и кого звать по окончании ухода */
export function useOverlayPresence(open: boolean, onExitComplete: (() => void) | undefined) {
  const presence = useContext(OverlayPresenceContext);
  return {
    open: open && (presence?.open ?? true),
    onExitComplete: () => {
      onExitComplete?.();
      presence?.onExitComplete();
    },
  };
}

'use client';

import type { ReactNode } from 'react';
import { OverlayPresenceContext, useExitHold, type ExitHoldValue } from '@/ui/hooks/useExitHold';

export interface ExitHoldProps<T> {
  /** Что открыто: строка, true, id… Пусто (null/undefined/false) — окно уходит с анимацией и только потом размонтируется */
  value: ExitHoldValue<T>;
  /** Окно (или компонент с `<Modal open>`/`<Sheet open>` внутри); получает последнее непустое значение */
  children: (value: T) => ReactNode;
}

/**
 * Окно, которое раньше монтировалось условием, закрывается плавно:
 *
 *   {open && <BusinessSheet row={open} onClose={…} />}          // было: исчезает за кадр
 *   <ExitHold value={open}>{(row) => <BusinessSheet row={row} onClose={…} />}</ExitHold>
 *
 * Modal и Sheet внутри (в том числе с `open` всегда true) закрываются по value и сообщают, что уход кончился.
 */
export function ExitHold<T>({ value, children }: ExitHoldProps<T>) {
  const hold = useExitHold(value);
  if (!hold.mounted) return null;
  return (
    <OverlayPresenceContext.Provider value={{ open: hold.open, onExitComplete: hold.onExitComplete }}>
      {children(hold.value as T)}
    </OverlayPresenceContext.Provider>
  );
}

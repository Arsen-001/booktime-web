'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { OverlayPresenceContext } from '@/ui/hooks/useExitHold';

export interface HoldWhileClosingProps {
  /** Окно, пока оно открыто; null — закрыто */
  children: ReactElement | null;
}

/** Страховка: окно так и не сообщило об окончании ухода (например, его Modal не был отрисован) */
const RELEASE_AFTER_MS = 1200;

/**
 * Окна журнала, смонтированные условием (`{choice && <Modal open …/>}`, окно записи по адресу `?booking=`),
 * снимались в том же рендере, что и закрытие, — исчезали за один кадр (DESIGN.md → «Smooth open/close everywhere»).
 *
 * Здесь последний открытый ЭЛЕМЕНТ держится, пока Modal/Sheet внутри проигрывает уход: его закрывает контекст
 * `OverlayPresenceContext` (тот же, что у <ExitHold> из src/ui), и он же сообщает об окончании. В отличие от
 * <ExitHold>, держим готовый элемент, а не значение: у окна записи адрес уже сменился, и свежие пропсы описывали бы
 * «новую запись» — уезжать должно то окно, что было на экране, с теми же данными.
 */
export function HoldWhileClosing({ children }: HoldWhileClosingProps) {
  const [held, setHeld] = useState<ReactElement | null>(children);
  if (children && held !== children) setHeld(children);
  const open = Boolean(children);

  useEffect(() => {
    if (open || !held) return;
    const id = window.setTimeout(() => setHeld(null), RELEASE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [open, held]);

  const shown = children ?? held;
  if (!shown) return null;
  return (
    <OverlayPresenceContext.Provider
      value={{
        open,
        onExitComplete: () => {
          if (!open) setHeld(null);
        },
      }}
    >
      {shown}
    </OverlayPresenceContext.Provider>
  );
}

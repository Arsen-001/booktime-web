'use client';

import { useState } from 'react';
import { useTopOverlay } from '@/ui/hooks/useOverlayStack';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';
import type { TourCloseReason } from '@/ui/onboarding/Tour';

export interface UseTourOptions extends OnceOptions {
  /** Показать сам при первом заходе на экран (по умолчанию нет — только по кнопке) */
  autoStart?: boolean;
  /** Не запускать автоматически, пока false (например, пока грузятся данные или открыто окно) */
  when?: boolean;
  onClose?: (reason: TourCloseReason) => void;
}

export interface UseTourResult {
  /** Тур уже видели (закрыли или прошли) */
  seen: boolean;
  /** Запустить тур заново — для кнопки «Как это работает» */
  start: () => void;
  /** Разложить на <Tour>: open и onClose */
  props: { open: boolean; onClose: (reason: TourCloseReason) => void };
}

/**
 * Состояние тура: открыт ли, видели ли его, как повторить. Закрытие (пройден или пропущен) запоминается —
 * автоматически тур больше не покажется, только по `start()`.
 */
export function useTour(
  id: string,
  { autoStart = false, when = true, onClose, scope }: UseTourOptions = {},
): UseTourResult {
  const once = useOnce(`tour.${id}`, { scope });
  const [manual, setManual] = useState(false);
  const [closed, setClosed] = useState(false);
  // Правило «один обучающий слой за раз»: сам тур не стартует поверх открытого окна или шторки
  // (в том числе приветствия WelcomeDialog) — дождётся, пока его закроют
  const overlayOpen = useTopOverlay() !== null;
  const open = manual || (autoStart && when && !overlayOpen && once.ready && !once.seen && !closed);

  return {
    seen: once.seen,
    start: () => setManual(true),
    props: {
      open,
      onClose: (reason) => {
        once.markSeen();
        setManual(false);
        setClosed(true);
        onClose?.(reason);
      },
    },
  };
}

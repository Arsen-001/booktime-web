'use client';

import { createContext, use, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { Id } from '@/domain/core';
import { SharedTransition } from '@/ui/SharedTransition';

/**
 * Какая карточка сетки сейчас «перетекает» в окно записи (DESIGN.md → Motion, SharedTransition).
 *
 * Своё маленькое хранилище, а не состояние JournalScreen и не проп DayGrid: раньше клик по карточке перерисовывал весь
 * экран журнала и всю сетку дня (~60 мс на CPU×4 в кадре клика, qa/journal-redesign/open-window.mjs). Теперь при
 * клике перерисовываются только тонкие обёртки карточек.
 */
let sharedBookingId: Id | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSharedBookingId(): Id | null {
  return sharedBookingId;
}

export function setSharedBookingId(id: Id | null) {
  if (sharedBookingId === id) return;
  sharedBookingId = id;
  for (const listener of listeners) listener();
}

export function useSharedBookingId(): Id | null {
  return useSyncExternalStore(subscribe, getSharedBookingId, () => null);
}

/** Запись, окно которой сейчас открыто (из адреса `?booking=`): у её карточки имя перехода уже «переехало» на окно */
export const OpenBookingContext = createContext<Id | undefined>(undefined);

export interface SharedBookingSlotProps {
  bookingId: Id;
  /** Место и тон карточки в колонке (top/height/фон) — для «призрака», который перетекает в окно */
  ghostStyle: CSSProperties;
  children: ReactNode;
}

/**
 * Обёртка карточки в сетке. Имя общего элемента носит не сама карточка, а её «призрак» — пустой прямоугольник её
 * тона под ней (z-0, за карточкой не виден): переход «карточка → окно» требует, чтобы носитель имени ушёл из дерева,
 * и раньше уходила и заново монтировалась сама карточка (scripts/flicker.mjs, journal-open). Теперь монтируется и
 * уходит только призрак, карточка остаётся на месте нетронутой.
 */
export function SharedBookingSlot({ bookingId, ghostStyle, children }: SharedBookingSlotProps) {
  const sharedId = useSharedBookingId();
  const openId = use(OpenBookingContext);
  const active = sharedId === bookingId && openId !== bookingId;
  return (
    <>
      {active && (
        <SharedTransition name={`booking-${bookingId}`}>
          <div aria-hidden style={ghostStyle} className="pointer-events-none absolute inset-x-1 z-0 rounded-xl" />
        </SharedTransition>
      )}
      {children}
    </>
  );
}

export interface SharedWindowFrameProps {
  /** Запись открытого окна */
  bookingId: Id;
  className: string;
}

/** Второй конец общего элемента «карточка → окно»: невидимая рамка на месте окна записи */
export function SharedWindowFrame({ bookingId, className }: SharedWindowFrameProps) {
  const sharedId = useSharedBookingId();
  if (sharedId !== bookingId) return null;
  return (
    <SharedTransition name={`booking-${bookingId}`}>
      <div aria-hidden className={className} />
    </SharedTransition>
  );
}

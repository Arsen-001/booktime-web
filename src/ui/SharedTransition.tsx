'use client';

import { startTransition, ViewTransition, type ReactNode } from 'react';

export interface SharedTransitionProps {
  /**
   * Имя общего элемента — одинаковое у «было» и «стало» (карточка записи в журнале → окно записи):
   * `booking-${id}`. На странице в один момент — только один элемент с этим именем.
   */
  name: string;
  children: ReactNode;
}

/**
 * Общий элемент между двумя состояниями: браузер «перетекает» карточку в окно (позиция и размер), а не гасит одно и
 * рисует другое. Нативный View Transitions API через React <ViewTransition> — кадры считает браузер, JS не участвует.
 * Срабатывает только внутри transition: переход по ссылке (Next делает сам) или смена состояния через
 * startSharedTransition. Без поддержки в браузере — просто мгновенная смена.
 *
 *   // карточка в журнале
 *   <SharedTransition name={`booking-${b.id}`}><BookingCard … onClick={() => startSharedTransition(() => setOpen(b.id))} /></SharedTransition>
 *   // окно записи (тот же name — только пока открыто)
 *   <SharedTransition name={`booking-${id}`}><BookingWindow … /></SharedTransition>
 *
 * CSS: globals.css → ::view-transition-group(.shared) (длительность large, кривая ease-out).
 */
export function SharedTransition({ name, children }: SharedTransitionProps) {
  return (
    <ViewTransition name={name} share="shared" default="none">
      {children}
    </ViewTransition>
  );
}

/** Сменить состояние так, чтобы SharedTransition сыграл переход (обычный setState переходов не запускает) */
export function startSharedTransition(update: () => void): void {
  startTransition(update);
}

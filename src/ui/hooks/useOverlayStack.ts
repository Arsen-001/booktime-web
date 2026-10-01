'use client';

import { useEffect, useId } from 'react';
import { create } from 'zustand';

/** Открытый модальный слой: шторка сбоку/снизу или окно по центру */
export interface OverlayEntry {
  id: string;
  kind: 'sheet' | 'modal';
  side?: 'bottom' | 'right' | 'left';
  /** CSS-ширина боковой шторки на десктопе — чтобы тосты вставали левее неё, а не на её кнопки */
  width?: string;
}

interface OverlayStackStore {
  items: OverlayEntry[];
}

export const useOverlayStackStore = create<OverlayStackStore>(() => ({ items: [] }));

/**
 * Регистрирует открытый слой, пока active. Нужен ToastViewport: на телефоне при открытой шторке
 * тосты уходят наверх, на десктопе — левее правой шторки (иначе ложатся на «Сохранить»).
 */
export function useRegisterOverlay(active: boolean, entry: Omit<OverlayEntry, 'id'>): void {
  const id = useId();
  const { kind, side, width } = entry;
  useEffect(() => {
    if (!active) return;
    useOverlayStackStore.setState((s) => ({ items: [...s.items.filter((i) => i.id !== id), { id, kind, side, width }] }));
    return () => useOverlayStackStore.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  }, [active, id, kind, side, width]);
}

/** Верхний открытый слой или null */
export function useTopOverlay(): OverlayEntry | null {
  return useOverlayStackStore((s) => s.items[s.items.length - 1] ?? null);
}

'use client';

import { useSyncExternalStore } from 'react';

/**
 * Ревью 27.09 (И19): одна страна на весь каталог — «Работает в Армении» / «Все страны». Выбор на обзоре
 * сохраняется при переходе в категорию и обратно (раньше обзор держал свой переключатель, категория — свой
 * выпадающий список, и они не знали друг о друге). Живёт в памяти вкладки; по умолчанию — Армения (⭐ F-00-002).
 */
export type CatalogCountry = 'AM' | 'all';

let current: CatalogCountry = 'AM';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCatalogCountry(next: CatalogCountry): void {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

export function useCatalogCountry(): CatalogCountry {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'AM',
  );
}

'use client';

import { useSyncExternalStore } from 'react';

/**
 * F-00-201 «Работа без интернета»: календарь уже живёт в localStorage (zustand+persist,
 * @/mock/db), поэтому чтение и правка работают без сети сами по себе — единственное, чего
 * не хватало, это дать мастеру знать, что он сейчас офлайн, а не что что-то сломалось.
 * Конфликт «клиент записался в это же время, пока мастер был офлайн» не решаем (в 00-our-decisions
 * помечено ❓ не решено) — просто не глотаем обычную ошибку слота при следующей синхронизации.
 *
 * На сервере — всегда «в сети»: у Node свой глобальный navigator без onLine (undefined), и раньше сервер рисовал
 * полосу «Нет интернета» в первом кадре, она пропадала после гидрации и сдвигала весь журнал на 38 px.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine !== false,
    () => true,
  );
}

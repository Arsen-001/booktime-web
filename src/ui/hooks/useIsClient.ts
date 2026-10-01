'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** true только в браузере после гидрации; на сервере и в первом рендере гидрации — false. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * window.location.origin без расхождения серверного/клиентского рендера (тот же приём, что useHydrated
 * в api/request.ts): на сервере — '', сразу после гидратации React сам перерисует с настоящим origin —
 * без предупреждения «Hydration failed» (было на /biz/integrations/api, измерено b02).
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
}

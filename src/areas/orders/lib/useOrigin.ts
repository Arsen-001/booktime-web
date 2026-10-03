'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * Адрес сайта для ссылки клиенту (/o/<код>): window.location.origin — staging.booktime.am на staging, booktime.am в
 * production. На сервере — '', после гидратации React перерисует с настоящим адресом (без «Hydration failed»).
 */
export function useOrigin(): string {
  return useSyncExternalStore(noop, () => window.location.origin, () => '');
}

'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * window.location.origin без расхождения серверного/клиентского рендера (SSR не знает origin): сервер
 * получает '', сразу после гидратации React перерисует с настоящим origin. Нужен ссылке «Закрыть окно»
 * (F-00-107) — она уходит в текст клиента до всякого клика, поэтому не может ждать эффекта.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
}

'use client';

import { useSyncExternalStore } from 'react';
import { isApiMode } from '@/api/http';

const noopSubscribe = () => () => {};

/**
 * Режим данных для разметки: на сервере Next и при гидратации — «мок» (как отрисовал сервер), потом — настоящий.
 * Без этого cookie `bt_data=api` при разработке давал расхождение гидратации там, где разметка зависит от режима.
 */
export function useApiMode(): boolean {
  return useSyncExternalStore(noopSubscribe, isApiMode, () => false);
}

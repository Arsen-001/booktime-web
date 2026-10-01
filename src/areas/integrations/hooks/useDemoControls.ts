'use client';

import { useSyncExternalStore } from 'react';
import { dataMode } from '@/api/mode';

const noopSubscribe = () => () => {};

/**
 * Ревью 27.09 (И1): демо-кнопки («Партнёр активировал (демо)», «Оплатить подписку (демо)», «Оператор одобрил»)
 * видны только на моковой базе. На живом сервере активирует настоящий партнёр — кнопки-имитации там неуместны.
 * На сервере Next и в первом кадре — false, чтобы разметка совпала при гидратации.
 */
export function useDemoControls(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => dataMode() === 'mock',
    () => false,
  );
}

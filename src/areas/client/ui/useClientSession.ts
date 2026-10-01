'use client';

import { useCurrent, useDemo } from '@/demo/hooks';

/**
 * Кто смотрит приложение клиента — уже в первом кадре (DESIGN.md «The skeleton IS the page»). Пока база не поднята,
 * appUserId неизвестен, но персона известна и серверу: вошедшему клиенту сразу рисуем его раскладку (колокольчик,
 * «Ближайшие записи», скелетоны), гостю — гостевую. signedIn — «раскладка вошедшего», appUserId — для запросов.
 */
export function useClientSession() {
  const { ready, appUserId } = useCurrent();
  const { persona } = useDemo();
  const signedIn = ready ? Boolean(appUserId) : persona === 'client';
  return { ready, appUserId, signedIn };
}

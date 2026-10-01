'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/api/request';
import { useDemo } from '@/demo/hooks';
import { MotionProvider } from '@/ui/MotionProvider';

/** Включить панель запросов (только дев): в консоли localStorage.setItem('bp-devtools', '1') и обновить страницу */
const DEVTOOLS_KEY = 'bp-devtools';

const noSubscribe = () => () => {};

function devtoolsWanted(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEVTOOLS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Кэш запросов на всё приложение (TanStack Query, см. docs/STATE.md). Хуки src/api/request.ts берут
 * тот же клиент и без провайдера — он здесь для панели запросов и useQueryClient().
 * Панель по умолчанию выключена: её кнопка попадала бы на снимки замеров.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  // Другая персона или сфера — другой «пользователь»: кэш прежнего не показываем (часть ключей ещё без
  // businessId — qa/requests/arch-a1.md S6). Все запросы — заново, со скелетоном.
  const { persona, sphere } = useDemo();
  const scope = `${persona}|${sphere}`;
  const scopeRef = useRef(scope);
  useEffect(() => {
    if (scopeRef.current === scope) return;
    scopeRef.current = scope;
    void client.resetQueries();
  }, [scope, client]);
  // При гидратации — как на сервере (false), сразу после — из localStorage: без расхождения разметки
  const devtools = useSyncExternalStore(noSubscribe, devtoolsWanted, () => false);
  return (
    <QueryClientProvider client={client}>
      <MotionProvider>{children}</MotionProvider>
      {devtools && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
    </QueryClientProvider>
  );
}

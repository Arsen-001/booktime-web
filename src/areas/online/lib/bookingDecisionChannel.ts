'use client';

import { useEffect } from 'react';

/**
 * F-00-067 «клиент получает пуш о решении», доделка g2-2-fix2.
 *
 * Раньше (fix1) клиентские экраны просто раз в 15 с звали `q.refetch()` — но при подтверждении заявки
 * мастером в ДРУГОЙ вкладке (кабинет бизнеса) `refetch()` перечитывает тот же fetcher, а тот читает
 * моковую базу через `@/api/*` — а она в памяти этой вкладки не менялась: `refetch()` без источника
 * свежих данных просто гонял тот же устаревший ответ. Снаружи выглядело как «не приходит, пока не
 * перезагрузишь страницу» — именно так подтвердил проверяющий (g2-2-fix2).
 *
 * Прямо читать `@/mock/db` из area-файла запрещено ESLint'ом (`no-restricted-imports`, см.
 * `eslint.config.mjs`: «Данные — только через src/api/*») — и это не обходной путь, а сигнал, что
 * ре-гидратация чужого стора не мой файл. Правильный путь в своих файлах: `respondToRequest` в
 * `src/api/online.ts` (МОЙ файл) уже знает новый статус в момент решения — рассылаем его остальным
 * вкладкам напрямую через `BroadcastChannel` (стандартный Web API, между вкладками одного источника,
 * без бэкенда), а получатель мержит статус прямо в кэш react-query (`setQueriesData`), а не пытается
 * перечитать базу. Опрос раз в 15 с остаётся резервом (мобильные браузеры без BroadcastChannel).
 */
export interface BookingDecisionMessage {
  bookingId: string;
  status: 'scheduled' | 'cancelled_by_master';
}

const CHANNEL_NAME = 'bp-online-request-decisions';

/** Зовёт respondToRequest (src/api/online.ts) сразу после смены статуса. */
export function broadcastBookingDecision(msg: BookingDecisionMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(msg);
    channel.close();
  } catch {
    /* недоступен (старый webview) — опрос ниже остаётся резервом */
  }
}

/** Клиентские экраны (BookingConfirmedScreen, CabinetScreen) подписываются на решения мастера. */
export function useBookingDecisionBroadcast(onDecision: (msg: BookingDecisionMessage) => void): void {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const handler = (e: MessageEvent<BookingDecisionMessage>) => onDecision(e.data);
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

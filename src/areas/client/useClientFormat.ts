'use client';

/**
 * F-14-061: обёртка над useFormat() для приложения клиента — применяет Client.timeFormat (24ч/12ч)
 * через опцию { hourCycle } самого useFormat (фундамент, src/i18n/useFormat.ts уже её принимает —
 * своей копии форматирования времени тут больше нет). Добавляет только dateTime (день+время в одну
 * строку), которого в фундаменте нет. Читает через getClientProfile/useApiQuery (не readArea напрямую —
 * линтер запрещает прямой доступ к mock/db в компонентах), тем же ключом запроса, что /profile —
 * правка формата видна сразу везде.
 */
import { getClientProfile } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { ISODateTime } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';

export function useClientFormat() {
  const { ready, appUserId } = useCurrent();
  // Тот же ключ запроса, что и в /profile — правка формата там сразу видна здесь (точечная
  // перечитка по прочитанному пути базы, см. src/api/request.ts).
  const q = useApiQuery(['client-profile', appUserId ?? ''], () => getClientProfile(appUserId!), {
    enabled: ready && Boolean(appUserId),
  });
  const hourCycle = q.data?.timeFormat ?? '24';
  // 12 ч — AM/PM на любом языке делает сам useFormat (владелец, 01.10.2026)
  const format = useFormat({ hourCycle });

  const dateTime = (value: ISODateTime) => `${format.date(value, 'dayMonth')}, ${format.time(value)}`;

  return { ...format, dateTime };
}

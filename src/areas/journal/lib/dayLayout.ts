'use client';

import { useState } from 'react';
import { getDayLayout, setDayLayout } from '@/api/journal';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import type { DayLayout } from '@/domain/journal';

export const DAY_LAYOUTS: DayLayout[] = ['columns', 'overview', 'timeline', 'list'];

/**
 * Вид дня сотрудника (⭐ наше, 29.09.2026): «Колонки / Обзор / Лента / Список». Выбор личный и хранится в аккаунте
 * (src/api/journal — getDayLayout), переключение — сразу, без ожидания ответа.
 */
export function useDayLayout(staffId: Id | undefined): [DayLayout, (layout: DayLayout) => void, boolean] {
  const q = useApiQuery(['journal', 'day-layout', staffId], () => getDayLayout(staffId!), { enabled: Boolean(staffId) });
  const save = useApiMutation(setDayLayout);
  const [local, setLocal] = useState<DayLayout | null>(null);
  return [
    local ?? q.data ?? 'columns',
    (layout) => {
      setLocal(layout);
      if (staffId) save.mutate({ staffId, layout });
    },
    // Пока выбор не пришёл — журнал держит скелетон, чтобы не мелькнули «Колонки» перед сохранённым видом
    q.isLoading,
  ];
}

'use client';

/**
 * Мок задачи воркера «заказ ждёт вас» (04.10.2026): при открытии «Заказов» кабинет один раз прогоняет напоминания —
 * готовым заказам с наступившим сроком уходит строка журнала отправок, у заказа растёт счётчик (экран перечитается
 * сам). В режиме api напоминает сервер (jobs/orders-pickup-reminders.ts), runPickupReminders ничего не делает.
 */
import { useEffect, useEffectEvent } from 'react';
import { runPickupReminders } from '@/api/orders';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';

export function usePickupRemindersTick() {
  const { ready, businessId } = useCurrent();
  const run = useApiMutation(runPickupReminders);
  const tick = useEffectEvent(async (forBusinessId: string) => {
    try {
      await run.mutate({ businessId: forBusinessId });
    } catch {
      // Фоновая задача: сбой не мешает работать с заказами, следующий заход повторит
    }
  });
  useEffect(() => {
    if (!ready || !businessId) return;
    void tick(businessId);
  }, [ready, businessId]);
}

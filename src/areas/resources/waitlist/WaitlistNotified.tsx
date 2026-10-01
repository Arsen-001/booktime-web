'use client';

import { getWaitlistNotifications } from '@/api/resources';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';

/**
 * F-16-166: «Уведомлён · последний раз …» — одна история на заявку: её пишут «Уведомить лист ожидания», «Найти окно» →
 * «Предложить», «Свободно сегодня», отмена записи клиентом и раздача окна на сервере.
 */
export function WaitlistNotified({ entryId }: { entryId: Id }) {
  const t = useT('resources');
  const format = useFormat();
  const q = useApiQuery(['resources', 'waitlist-notified', entryId], () => getWaitlistNotifications(entryId));
  const notifiedAt = q.data ?? [];
  if (notifiedAt.length === 0) return null;
  const last = notifiedAt[notifiedAt.length - 1];
  return <p className="text-xs text-success">{t('waitlist.notifiedAt', { count: notifiedAt.length, date: format.date(last, 'short'), time: format.time(last) })}</p>;
}

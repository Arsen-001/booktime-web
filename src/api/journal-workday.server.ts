'use client';

/**
 * Рабочий день журнала на настоящем сервере (booktime-backend src/modules/workday): утренняя сводка, незакрытые
 * визиты, итоги дня. Чтения объявляют записи и доп. данные визита: отметка «Пришёл», «Не пришёл» и оплата
 * (зеркало записи и её оплаты в браузере) перечитывают их сами.
 */
import { http } from '@/api/http';
import { mirrorBookings } from '@/api/mirror';
import { trackRead } from '@/api/request';
import type { ISODate, Id } from '@/domain/core';
import type { DayCloseSummary, MorningSummary, UnclosedVisit } from '@/domain/journalWorkday';

const base = (businessId: Id) => `/v1/biz/${businessId}/journal/workday`;
const reads = () => trackRead('core.bookings', 'areas.journal.extras');

export async function unclosed(businessId: Id): Promise<UnclosedVisit[]> {
  reads();
  const rows = await http<UnclosedVisit[]>('GET', `${base(businessId)}/unclosed`);
  // Записи — в зеркало: «Пришёл» / «Оплатить» из списка находят бизнес записи, как из журнала
  mirrorBookings(rows.map((r) => r.booking));
  return rows;
}

export function morning(businessId: Id, date: ISODate): Promise<MorningSummary> {
  reads();
  trackRead('core.clients');
  return http<MorningSummary>('GET', `${base(businessId)}/morning`, undefined, { query: { date } });
}

export function dayClose(businessId: Id, date: ISODate): Promise<DayCloseSummary> {
  reads();
  return http<DayCloseSummary>('GET', `${base(businessId)}/day-close`, undefined, { query: { date } });
}

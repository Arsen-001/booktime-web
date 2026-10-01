/**
 * Выгрузка клиентов в Excel-совместимый CSV (F-04-009, F-04-130). Строки отдаёт api `exportClients` (право clients.export
 * проверяет оно), файл собирает общий `@/lib/csv` (core-rules, minor: своих копий CSV нет).
 */
import type { ClientRow } from '@/domain/clients';
import { toCsv } from '@/lib/csv';
import type { useT } from '@/i18n/useT';

type ClientsT = ReturnType<typeof useT<'clients'>>;

/** Даты — как есть (ГГГГ-ММ-ДД): для таблицы, которую откроют в Excel, это однозначнее «11 сент» */
export function clientsCsv(rows: ClientRow[], t: ClientsT): string {
  const headers = (['name', 'phone', 'email', 'sold', 'balance', 'visits', 'discount', 'lastVisit', 'firstVisit'] as const).map((id) =>
    t(`table.columns.${id}`),
  );
  return toCsv(
    rows.map((r) => [r.name, r.phone, r.email, r.sold, r.balance, r.visits, `${r.discount}%`, r.lastVisit, r.firstVisit]),
    headers,
  );
}

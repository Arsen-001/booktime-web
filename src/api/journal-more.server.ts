'use client';

/**
 * Этап 21, лейн «journal»: то, что src/api/journal.ts раньше считал по моковой базе браузера и в режиме `api`
 * теперь берёт с сервера (`/v1/biz/{b}/journal/…`, модуль journal-more бэкенда). Отдельный файл, а не
 * journal.server.ts: тот правят соседние лейны, свой файл им не мешает.
 */
import { apiIdentity } from '@/api/identity';
import { readDbUntracked } from '@/mock/db';
import type { JournalSearchQuery, JournalSearchResult, RecordsPage, RecordsQuery } from '@/domain/records';
import { http } from '@/api/http';
import { ApiError, trackRead } from '@/api/request';
import type { DayHours, ISODate, ISODateTime, Id, Money } from '@/domain/core';
import type {
  BookingLacquer,
  FavoriteSection,
  GoodsCatalogItem,
  JournalLedgerEntry,
  PackageOrderMode,
  QuickSaleRecord,
  WindowDraftSnapshot,
} from '@/domain/journal';

function sessionBiz(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}
const j = (businessId: Id = sessionBiz()) => `/v1/biz/${businessId}/journal`;
const reads = () => trackRead('core.bookings');

/** «Все филиалы» (F-01-006): первый бизнес — в пути, остальные — ?businessIds= (сервер проверит членство) */
function scope(businessIds?: Id[]): { path: string; others?: string } {
  const own = sessionBiz();
  const first = businessIds?.includes(own) ? own : (businessIds?.[0] ?? own);
  const others = (businessIds ?? []).filter((id) => id !== first);
  return { path: j(first), others: others.join(',') || undefined };
}

// ─────────── часы и загрузка ───────────

/**
 * Часы мастеров — у бизнеса каждого мастера (зеркало знает, чей он). Сеть: владелец выбрал другой филиал (Manana →
 * Шенгавит), а часы спрашивались у бизнеса сессии (Нор-Норк) — сервер отвечал пустыми днями, журнал писал «Расписание
 * не установлено» (проход кабинета 17.11.2026). Мастера разных филиалов — по запросу на филиал, ответы складываются.
 */
export async function staffHours(staffIds: Id[], from: ISODate, to: ISODate, locationId?: Id): Promise<Record<Id, Record<ISODate, DayHours>>> {
  if (!staffIds.length) return {};
  const staff = readDbUntracked().core.staff;
  const byBiz = new Map<Id, Id[]>();
  for (const id of staffIds) {
    const biz = staff.find((s) => s.id === id)?.businessId ?? sessionBiz();
    byBiz.set(biz, [...(byBiz.get(biz) ?? []), id]);
  }
  const parts = await Promise.all(
    [...byBiz].map(([biz, ids]) =>
      http<Record<Id, Record<ISODate, DayHours>>>('GET', `${j(biz)}/staff-hours`, undefined, { query: { staffIds: ids.join(','), from, to, locationId } }),
    ),
  );
  return Object.assign({}, ...parts);
}

export function rangeLoad(staffIds: Id[], from: ISODate, to: ISODate): Promise<Record<ISODate, { ratio: number; hasSchedule: boolean }>> {
  reads();
  return http('GET', `${j()}/range-load`, undefined, { query: { staffIds: staffIds.join(','), from, to } });
}

// ─────────── лаки ───────────

export function lacquersByIds(bookingIds: Id[]): Promise<Record<Id, BookingLacquer>> {
  reads();
  if (!bookingIds.length) return Promise.resolve({});
  return http('GET', `${j()}/lacquers`, undefined, { query: { ids: bookingIds.join(',') } });
}

export function lacquersByDay(businessIds: Id[], date: ISODate): Promise<Record<Id, BookingLacquer>> {
  reads();
  const s = scope(businessIds);
  return http('GET', `${s.path}/lacquers`, undefined, { query: { date, businessIds: s.others } });
}

// ─────────── клиент в окне записи ───────────

export function clientVisitStats(
  clientId: Id,
  businessIds: Id[],
): Promise<{ totalVisits: number; sold: Money; paid: Money; balance: Money; noShowCount: number; lastVisitAt?: ISODateTime }> {
  reads();
  const s = scope(businessIds);
  return http('GET', `${s.path}/client-visit-stats`, undefined, { query: { clientId, businessIds: s.others } });
}

export function frequentServiceIds(staffId: Id, limit: number): Promise<Id[]> {
  reads();
  return http('GET', `${j()}/frequent-services`, undefined, { query: { staffId, limit } });
}

export function daySummary(businessId: Id, date: ISODate): Promise<{
  cashIn: Money;
  cash: Money;
  cashless: Money;
  doneTotal: Money;
  bookedTotal: Money;
  loyaltyTotal: Money;
  goodsTotal: Money;
  clientsCount: number;
}> {
  reads();
  trackRead('areas.journal.extras');
  return http('GET', `${j(businessId)}/day-summary`, undefined, { query: { date } });
}

export function packageSlots(
  locationId: Id,
  date: ISODate,
  steps: { serviceId: Id; staffId: Id; durationMin: number; bufferAfterMin?: number }[],
  order: PackageOrderMode,
): Promise<{ start: ISODateTime; end: ISODateTime }[]> {
  reads();
  return http('POST', `${j()}/package-slots`, {
    locationId,
    date,
    order: order === 'parallel' ? 'parallel' : 'sequential_one',
    steps: steps.map((s) => ({ serviceId: s.serviceId, staffId: s.staffId, durationMin: s.durationMin, ...(s.bufferAfterMin ? { bufferAfterMin: s.bufferAfterMin } : {}) })),
  });
}

// ─────────── личное ───────────

export interface ServerJournalPrefs {
  pinnedFields?: string[];
  clientCardPins: string[];
  favorites: FavoriteSection[];
  waitlistPanelOpen: boolean;
}

export function prefs(userKey: Id): Promise<ServerJournalPrefs> {
  return http('GET', `${j()}/prefs/${encodeURIComponent(userKey)}`);
}

export function patchPrefs(userKey: Id, patch: Partial<ServerJournalPrefs>): Promise<ServerJournalPrefs> {
  return http('PATCH', `${j()}/prefs/${encodeURIComponent(userKey)}`, patch);
}

export function draft(key: string): Promise<WindowDraftSnapshot | undefined> {
  return http<{ draft: WindowDraftSnapshot | null }>('GET', `${j()}/draft`, undefined, { query: { key } }).then((r) => r.draft ?? undefined);
}

export function setDraft(key: string, data: WindowDraftSnapshot | null): Promise<void> {
  return http('PUT', `${j()}/draft`, { key, data });
}

// ─────────── продажа вне визита ───────────

export function goodsCatalog(locationId?: Id): Promise<GoodsCatalogItem[]> {
  trackRead('areas.stock');
  return http('GET', `${j()}/goods-catalog`, undefined, { query: { locationId } });
}

export function sell(input: {
  itemId: Id;
  qty: number;
  paymentMethod: 'cash' | 'card';
  code?: string;
  clientId?: Id;
  clientName?: string;
  locationId?: Id;
}): Promise<QuickSaleRecord> {
  return http('POST', `${j()}/quick-sales`, input);
}

export function cancelSale(saleId: Id): Promise<void> {
  return http('POST', `${j()}/quick-sales/${saleId}/cancel`);
}

// ─────────── «Новый платёж» ───────────

export function ledger(locationId: Id): Promise<JournalLedgerEntry[]> {
  return http('GET', `${j()}/ledger`, undefined, { query: { locationId } });
}

export function createLedger(input: Omit<JournalLedgerEntry, 'id'>): Promise<JournalLedgerEntry> {
  return http('POST', `${j()}/ledger`, input);
}

export function cancelLedger(entryId: Id): Promise<void> {
  return http('POST', `${j()}/ledger/${entryId}/cancel`);
}

// ─────────────────────────── «Записи» страницей и поиск журнала (скорость, 17.11.2026) ───────────────────────────

/** «Записи» (F-01-181): одна страница отбора и итоги «Показано / Выручка / Удалено» — считает сервер */
export async function recordsPage(businessId: Id, q: RecordsQuery): Promise<RecordsPage> {
  reads();
  trackRead('areas.journal.extras');
  trackRead('areas.finance');
  const page = await http<Omit<RecordsPage, 'clients'> & { clients: Record<Id, { id: Id; name: string; clientPhone: string }> }>('GET', `${j(businessId)}/records`, undefined, {
    query: {
      cancel: q.cancel,
      source: q.source,
      paid: q.paid,
      categoryId: q.categoryId,
      resourceId: q.resourceId,
      staffId: q.staffId,
      from: q.from,
      sort: q.sort,
      dir: q.sort ? q.dir : undefined,
      page: String(q.page),
      pageSize: String(q.pageSize),
    },
  });
  // В зеркало браузера не кладём: окно записи по «?booking=» берёт запись с сервера по id, а запись в зеркало
  // разбудила бы этот же запрос второй раз (он читает записи). Телефон клиента без права clients.phones — скрытым.
  return { ...page, clients: Object.fromEntries(Object.entries(page.clients).map(([id, c]) => [id, { id: c.id, name: c.name, phone: c.clientPhone }])) };
}

/** Поиск журнала (F-01-163): клиенты и их записи — сервер; телефон без права clients.phones приходит скрытым */
export async function journalSearch(q: JournalSearchQuery): Promise<JournalSearchResult> {
  reads();
  trackRead('areas.clients');
  const r = await http<Omit<JournalSearchResult, 'clients'> & { clients: { id: Id; name: string; clientPhone: string }[] }>('GET', `${j(q.businessId)}/search`, undefined, {
    query: { q: q.query, staffId: q.staffId, from: q.from, clientsLimit: String(q.clientsLimit) },
  });
  return { ...r, clients: r.clients.map((c) => ({ id: c.id, name: c.name, phone: c.clientPhone })) };
}

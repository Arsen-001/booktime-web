'use client';

/**
 * Этап 21, лейн «journal»: то, что src/api/journal.ts раньше считал по моковой базе браузера и в режиме `api`
 * теперь берёт с сервера (`/v1/biz/{b}/journal/…`, модуль journal-more бэкенда). Отдельный файл, а не
 * journal.server.ts: тот правят соседние лейны, свой файл им не мешает.
 */
import { apiIdentity } from '@/api/identity';
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

export function staffHours(staffIds: Id[], from: ISODate, to: ISODate, locationId?: Id): Promise<Record<Id, Record<ISODate, DayHours>>> {
  if (!staffIds.length) return Promise.resolve({});
  return http('GET', `${j()}/staff-hours`, undefined, { query: { staffIds: staffIds.join(','), from, to, locationId } });
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

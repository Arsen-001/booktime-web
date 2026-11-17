/**
 * «Записи» (/biz/records, F-01-181) страницей и поиск журнала (F-01-163): правила отбора и порядка — одни для мока
 * (src/api/journal.ts) и сервера (booktime-backend journal-more/records.service.ts — тот же отбор на своей стороне).
 * Скорость, 17.11.2026: экран больше не держит в браузере все записи бизнеса (574 КБ «Записи», 350 КБ поиск).
 */
import type { Booking, BookingStatus, Client, Id, ISODate, ISODateTime } from '@/domain/core';
import { localDigits } from '@/lib/phone';
import { normalizeSearch } from '@/lib/text';

export type RecordsCancelFilter = 'all' | 'notCancelled' | 'cancelled' | 'deleted';
export type RecordsSourceFilter = 'all' | 'online' | 'offline';
export type RecordsPaidFilter = 'all' | 'paid' | 'unpaid';
export type RecordsSortKey = 'when' | 'total';

export interface RecordsQuery {
  cancel: RecordsCancelFilter;
  source: RecordsSourceFilter;
  paid: RecordsPaidFilter;
  categoryId?: Id;
  resourceId?: Id;
  /** Без права видеть чужие записи — только записи этого сотрудника (F-01-178) */
  staffId?: Id;
  /** Окно истории (F-01-178): записи с этого дня */
  from?: ISODate;
  /** Колонка таблицы; нет — по времени, свежие первыми */
  sort?: RecordsSortKey;
  dir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface RecordsPage {
  items: Booking[];
  /** Клиенты строк страницы (имя, телефон) — старых записей нет в зеркале браузера */
  clients: Record<Id, Pick<Client, 'id' | 'name' | 'phone'>>;
  /** «Показано» — все записи отбора, не только эта страница */
  total: number;
  /** «Выручка» — сумма записей отбора без удалённых */
  revenue: number;
  /** «Удалено» — удалённые в отборе */
  deleted: number;
  page: number;
  pageSize: number;
}

/** Онлайн-источники записи (приложение, ссылка, виджет) */
export const ONLINE_SOURCES: ReadonlySet<string> = new Set(['app', 'link', 'widget']);
const CANCELLED_BY: ReadonlySet<BookingStatus> = new Set(['cancelled_by_client', 'cancelled_by_master']);

/** Данные к записи для отбора: оплачено, категории записи */
export interface RecordFacts {
  paidOf: (b: Booking) => number;
  categoryIdsOf: (b: Booking) => Id[];
  /** Экземпляры выбранного ресурса */
  resourceInstanceIds?: ReadonlySet<Id>;
}

/**
 * F-01-181: «Удалённые» — только мягко удалённые (deletedAt). «Отменённые» (01.10.2026) — ещё и отменённые статусом
 * («Отменил клиент/мастер»), иначе запись с «Верните клиенту …» не находилась никаким фильтром.
 */
export function matchesRecord(b: Booking, q: RecordsQuery, facts: RecordFacts): boolean {
  if (q.staffId && b.staffId !== q.staffId) return false;
  if (q.from && b.start.slice(0, 10) < q.from) return false;
  const isDeleted = Boolean(b.deletedAt);
  const isCancelled = isDeleted || CANCELLED_BY.has(b.status);
  if (q.cancel === 'deleted' && !isDeleted) return false;
  if (q.cancel === 'cancelled' && !isCancelled) return false;
  if (q.cancel === 'notCancelled' && isCancelled) return false;
  if (q.source !== 'all') {
    const isOnline = ONLINE_SOURCES.has(b.source);
    if (q.source === 'online' && !isOnline) return false;
    if (q.source === 'offline' && isOnline) return false;
  }
  if (q.paid !== 'all') {
    const paid = facts.paidOf(b);
    const isPaid = paid > 0 && paid >= b.total;
    if (q.paid === 'paid' && !isPaid) return false;
    if (q.paid === 'unpaid' && isPaid) return false;
  }
  if (q.categoryId && !facts.categoryIdsOf(b).includes(q.categoryId)) return false;
  if (q.resourceId && !b.resourceIds.some((id) => facts.resourceInstanceIds?.has(id))) return false;
  return true;
}

/** Порядок «Записей»: по времени, свежие первыми (одна минута — по id); колонка таблицы — поверх него */
export function compareRecords(q: Pick<RecordsQuery, 'sort' | 'dir'>): (a: Booking, b: Booking) => number {
  const base = (a: Booking, b: Booking) => b.start.localeCompare(a.start) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const dir = q.dir === 'asc' ? 1 : -1;
  return (a, b) => {
    if (q.sort === 'when') return a.start.localeCompare(b.start) * dir || base(a, b);
    if (q.sort === 'total') return (a.total - b.total) * dir || base(a, b);
    return base(a, b);
  };
}

/** Отбор → страница с итогами по всему отбору (страница за краем прижимается к последней) */
export function recordsPageOf(all: readonly Booking[], q: RecordsQuery, facts: RecordFacts, clientsOf: (ids: Id[]) => Pick<Client, 'id' | 'name' | 'phone'>[] = () => []): RecordsPage {
  const rows = all.filter((b) => matchesRecord(b, q, facts)).sort(compareRecords(q));
  const pageSize = Math.min(100, Math.max(1, q.pageSize));
  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, q.page), lastPage);
  const items = rows.slice((page - 1) * pageSize, page * pageSize);
  const clientIds = [...new Set(items.map((b) => b.clientId).filter((id): id is Id => Boolean(id)))];
  return {
    items,
    clients: Object.fromEntries(clientsOf(clientIds).map((c) => [c.id, { id: c.id, name: c.name, phone: c.phone }])),
    total: rows.length,
    revenue: rows.reduce((s, b) => (b.deletedAt ? s : s + b.total), 0),
    deleted: rows.filter((b) => b.deletedAt).length,
    page,
    pageSize,
  };
}

// ─────────────────────────── Поиск журнала (F-01-163) ───────────────────────────

/** Запрос → что сравнивать: слова имени (без регистра и ё) и цифры номера (без кода страны) */
export function parseJournalSearch(query: string): { text: string; digits: string } {
  const raw = query.replace(/\D/g, '');
  const digits = raw.startsWith('374') && raw.length > 3 ? raw.slice(3) : raw.startsWith('0') && raw.length > 1 ? raw.slice(1) : raw;
  const text = /\p{L}/u.test(query) ? normalizeSearch(query) : '';
  return { text, digits: digits.length >= 2 ? digits : '' };
}

export function isJournalSearchActive(query: string): boolean {
  const { text, digits } = parseJournalSearch(query);
  return text.length >= 2 || digits.length >= 2;
}

export function matchJournalClient(c: Pick<Client, 'name' | 'phone'>, text: string, digits: string): boolean {
  if (digits && localDigits(c.phone).includes(digits)) return true;
  if (text.length < 2) return false;
  const name = normalizeSearch(c.name);
  // Каждое слово запроса — в имени: «арам кар» находит «Арам Карамян»
  return text.split(/\s+/).every((w) => name.includes(w));
}

/** Запись в результатах поиска — только то, что видно в строке */
export interface JournalSearchBooking {
  id: Id;
  start: ISODateTime;
  staffId: Id;
  clientId: Id;
  clientName: string;
  status: BookingStatus;
}

export interface JournalSearchResult {
  /** Первые совпавшие клиенты (сначала — у кого слово имени начинается с запроса) */
  clients: { id: Id; name: string; phone: string }[];
  /** Сколько клиентов совпало всего */
  clientsTotal: number;
  /** Сначала будущие (ближайшая первой), потом прошедшие (свежая первой) */
  bookings: JournalSearchBooking[];
  upcoming: number;
  recent: number;
}

export interface JournalSearchQuery {
  businessId: Id;
  query: string;
  /** Без права видеть чужие записи — только свои */
  staffId?: Id;
  /** Окно истории: записи с этого дня */
  from?: ISODate;
  clientsLimit: number;
}

/** Поиск журнала по клиентам и записям бизнеса (мок; сервер считает так же) */
export function journalSearchOf(clients: readonly Client[], bookings: readonly Booking[], q: JournalSearchQuery, now: ISODateTime): JournalSearchResult {
  const { text, digits } = parseJournalSearch(q.query);
  const firstWord = text.split(/\s+/)[0] ?? '';
  const rank = (c: Client) => (text && normalizeSearch(c.name).split(/\s+/).some((w) => w.startsWith(firstWord)) ? 0 : 1);
  const matched = clients.filter((c) => c.businessId === q.businessId && !c.deletedAt && matchJournalClient(c, text, digits)).sort((a, b) => rank(a) - rank(b));
  const nameById = new Map(matched.map((c) => [c.id, c.name]));
  const found = bookings
    .filter(
      (b) =>
        b.businessId === q.businessId &&
        b.clientId &&
        nameById.has(b.clientId) &&
        !b.deletedAt &&
        !b.groupEventId &&
        (q.staffId === undefined || b.staffId === q.staffId) &&
        (!q.from || b.start.slice(0, 10) >= q.from),
    )
    .sort((a, b) => a.start.localeCompare(b.start) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((b) => ({ id: b.id, start: b.start, staffId: b.staffId, clientId: b.clientId!, clientName: nameById.get(b.clientId!) ?? '', status: b.status }));
  const upcoming = found.filter((b) => b.start >= now);
  const recent = found.filter((b) => b.start < now).reverse();
  return {
    clients: matched.slice(0, q.clientsLimit).map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    clientsTotal: matched.length,
    bookings: [...upcoming, ...recent],
    upcoming: upcoming.length,
    recent: recent.length,
  };
}

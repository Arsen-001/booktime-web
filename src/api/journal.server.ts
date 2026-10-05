'use client';

/**
 * Журнал и записи на настоящем сервере (docs/backend/PLAN.md этап 7, docs/backend/02 §4, 04 §4). Функции ядра
 * (src/api/core.ts: записи, статусы, групповые события, события записей) и раздела journal (src/api/journal.ts) в режиме
 * `api` зовут эти; экран получает те же типы, что от мока.
 *
 * Сервер держит правила записи: «замок на мастера» (двойная запись невозможна даже из двух бизнесов человека),
 * удержание окна на время подтверждения (В-03) и ручной предоплаты (В-05), поздняя отмена клиентом (В-04),
 * восстановление удалённой записи 7 дней, раздача освободившегося окна (В-18). Экран больше не считает их сам.
 *
 * Зеркало: каждая записанная сущность кладётся в ядро/срез journal браузера (src/api/mirror.ts) — разделы, ещё
 * живущие на моке (отчёты, финансы, онлайн-запись, приложение клиента), видят те же записи. Этап 21 его убирает.
 */
import { apiIdentity } from '@/api/identity';
import { HttpApiError, http } from '@/api/http';
import { mirrorBookings, mirrorClients, mirrorExtras, mirrorGroupEvents, mirrorPackageGroup, sameJson, syncBookings } from '@/api/mirror';
import { ApiError, trackRead } from '@/api/request';
import type { Booking, BookingEvent, BookingEventKind, BookingStatus, Client, GroupEvent, ISODate, ISODateTime, Id } from '@/domain/core';
import type {
  BookingExtras,
  BookingHistoryEntry,
  DataOpsLogEntry,
  JournalBlockRights,
  JournalSettings,
  MedicalCard,
  MedicalVisitNote,
  PackageGroup,
  PackageOrderMode,
  RecurrenceRule,
  RecurrenceTemplate,
  TreatmentPlan,
  WindowRights,
  BookingCategoryDef,
  CustomFieldDef,
  JournalZoomMin,
} from '@/domain/journal';
import type { PlaceBookingInput } from '@/domain/rules/booking-flow';
import type { StatusActor } from '@/domain/rules/booking-status';
import type { SeriesOccurrence, SeriesRule } from '@/domain/schedule';
import { useDb } from '@/mock/db';

// ─────────── чей бизнес ───────────

function sessionBiz(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

/** Бизнес записи — из зеркала, иначе из сессии */
export function bizOfBooking(bookingId: Id): Id {
  return useDb.getState().core.bookings.find((b) => b.id === bookingId)?.businessId ?? sessionBiz();
}
/** Бизнес мастера из зеркала, иначе из сессии (для фасадов других разделов, которым нельзя читать базу напрямую) */
export function bizOfStaffOrSession(staffId?: Id): Id {
  return bizOfStaff(staffId);
}
function bizOfStaff(staffId?: Id): Id {
  return (staffId ? useDb.getState().core.staff.find((s) => s.id === staffId)?.businessId : undefined) ?? sessionBiz();
}
function bizOfClient(clientId?: Id): Id {
  return (clientId ? useDb.getState().core.clients.find((c) => c.id === clientId)?.businessId : undefined) ?? sessionBiz();
}

const b = (businessId: Id) => `/v1/biz/${businessId}`;
/** Чтение записей зависит от записей зеркала; чтение доп. данных — от доп. данных (иначе одно будит другое по кругу) */
const reads = () => trackRead('core.bookings');
const readsExtras = () => trackRead('areas.journal.extras');

/** Запись сервера → зеркало (и её доп. данные, если пришли) */
function keep(booking: Booking): Booking {
  mirrorBookings([booking]);
  return booking;
}
function keepAll(list: Booking[]): Booking[] {
  mirrorBookings(list);
  return list;
}
function keepExtras(bookingId: Id, extras: BookingExtras): BookingExtras {
  mirrorExtras(bookingId, extras);
  return extras;
}

// ─────────── записи (ядро) ───────────

export interface ServerBookingQuery {
  businessId?: Id;
  businessIds?: Id[];
  locationId?: Id;
  staffId?: Id;
  clientId?: Id;
  appUserId?: Id;
  from?: ISODate;
  to?: ISODate;
  statuses?: BookingStatus[];
  includeDeleted?: boolean;
  groupEventId?: Id;
  seriesId?: Id;
  visitId?: Id;
}

export async function listBookings(q: ServerBookingQuery): Promise<Booking[]> {
  reads();
  const businessId = q.businessId ?? q.businessIds?.[0] ?? sessionBiz();
  const others = (q.businessIds ?? []).filter((id) => id !== businessId);
  const list = await http<Booking[]>('GET', `${b(businessId)}/bookings`, undefined, {
    query: {
      businessIds: others.join(',') || undefined,
      locationId: q.locationId,
      staffId: q.staffId,
      clientId: q.clientId,
      appUserId: q.appUserId,
      from: q.from,
      to: q.to,
      statuses: q.statuses?.join(','),
      includeDeleted: q.includeDeleted ? 'true' : undefined,
      groupEventId: q.groupEventId,
      seriesId: q.seriesId,
      visitId: q.visitId,
    },
  });
  return keepAll(list);
}

export async function getBooking(bookingId: Id): Promise<Booking> {
  reads();
  return keep(await http<Booking>('GET', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}`));
}

/** createBooking «как есть» — строки посчитаны окном; занятость проверяет замок на мастера */
export async function createBooking(input: Omit<Booking, 'id' | 'total' | 'durationMin' | 'createdAt' | 'updatedAt'> & { durationMin?: number }): Promise<Booking> {
  const body = { ...input, createdBy: input.createdBy === 'client' ? 'client' : input.createdBy };
  return keep(await http<Booking>('POST', `${b(input.businessId)}/bookings`, body, { idempotencyKey: crypto.randomUUID() }));
}

export async function placeBooking(input: PlaceBookingInput): Promise<{ booking: Booking; client?: Client }> {
  const res = await http<{ booking: Booking; client?: Client }>('POST', `${b(input.businessId)}/bookings/place`, input, { idempotencyKey: crypto.randomUUID() });
  if (res.client) mirrorClients([res.client]);
  keep(res.booking);
  return res;
}

/**
 * Правка записи. deletedAt в патче (как у ядра мока): дата — мягкое удаление, undefined — вернуть; остальное — PATCH
 * (сумму и длительность сервер считает по строкам услуг). expectedUpdatedAt — «побеждает первое» (F-01-033).
 */
export async function updateBooking(id: Id, patch: Partial<Omit<Booking, 'id'>>, expectedUpdatedAt?: ISODateTime): Promise<Booking> {
  const businessId = bizOfBooking(id);
  if ('deletedAt' in patch) {
    const { deletedAt, ...rest } = patch;
    const res = deletedAt ? await removeBooking(id) : await restoreBooking(id);
    return Object.keys(rest).length ? updateBooking(id, rest, expectedUpdatedAt) : res;
  }
  const { total: _total, createdAt: _c, updatedAt: _u, id: _id, businessId: _b, ...rest } = patch as Partial<Booking>;
  void _total;
  void _c;
  void _u;
  void _id;
  void _b;
  const body: Record<string, unknown> = { ...rest };
  for (const k of ['clientId', 'comment', 'visitorName', 'visitId', 'seriesId', 'groupEventId', 'staffAssignment', 'prepayment'] as const) {
    if (k in patch && patch[k] === undefined) body[k] = null;
  }
  if (expectedUpdatedAt) body.expectedUpdatedAt = expectedUpdatedAt;
  return keep(await http<Booking>('PATCH', `${b(businessId)}/bookings/${id}`, body));
}

export async function changeBookingStatus(id: Id, status: BookingStatus, actor: StatusActor = 'business'): Promise<Booking> {
  if (actor === 'client') {
    if (status === 'client_confirmed') return keep(await http<Booking>('POST', `/v1/me/bookings/${id}/confirm`));
    if (status === 'cancelled_by_client') return (await cancelAsClient(id)).booking;
    throw new ApiError('invalid_transition');
  }
  return keep(await http<Booking>('POST', `${b(bizOfBooking(id))}/bookings/${id}/status`, { status }));
}

export async function removeBooking(id: Id, opts: { byName?: string; byClient?: boolean } = {}): Promise<Booking> {
  const res = keep(await http<Booking>('DELETE', `${b(bizOfBooking(id))}/bookings/${id}`, opts));
  await refreshExtras(id);
  return res;
}

export async function restoreBooking(id: Id): Promise<Booking> {
  const res = keep(await http<Booking>('POST', `${b(bizOfBooking(id))}/bookings/${id}/restore`));
  await refreshExtras(id);
  return res;
}

export async function cancelAsClient(id: Id): Promise<{ booking: Booking; late: boolean }> {
  const res = await http<{ booking: Booking; late: boolean }>('POST', `/v1/me/bookings/${id}/cancel`);
  keep(res.booking);
  return res;
}

export async function rescheduleAsClient(id: Id, start: ISODateTime): Promise<Booking> {
  return keep(await http<Booking>('POST', `/v1/me/bookings/${id}/reschedule`, { start }));
}

export interface ServerEventQuery {
  businessId?: Id;
  businessIds?: Id[];
  staffId?: Id;
  bookingId?: Id;
  clientId?: Id;
  appUserId?: Id;
  kinds?: BookingEventKind[];
  since?: ISODateTime;
  freedOnly?: boolean;
}

export function listBookingEvents(q: ServerEventQuery): Promise<BookingEvent[]> {
  reads();
  const businessId = q.businessId ?? q.businessIds?.[0] ?? sessionBiz();
  return http<BookingEvent[]>('GET', `${b(businessId)}/booking-events`, undefined, {
    query: {
      businessIds: (q.businessIds ?? []).filter((id) => id !== businessId).join(',') || undefined,
      staffId: q.staffId,
      bookingId: q.bookingId,
      clientId: q.clientId,
      appUserId: q.appUserId,
      kinds: q.kinds?.join(','),
      since: q.since,
      freedOnly: q.freedOnly ? 'true' : undefined,
    },
  });
}

export function listClientEvents(opts: { since?: ISODateTime; kinds?: BookingEventKind[] } = {}): Promise<BookingEvent[]> {
  reads();
  return http<BookingEvent[]>('GET', `/v1/me/booking-events`, undefined, { query: { since: opts.since, kinds: opts.kinds?.join(',') } });
}

export function reportDelay(bookingId: Id, delayMin: number): Promise<BookingEvent> {
  return http<BookingEvent>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/delay`, { delayMin });
}

export async function finishEarly(bookingId: Id, actualDurationMin?: number): Promise<Booking> {
  return keep(await http<Booking>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/finished-early`, { actualDurationMin }));
}

export async function markArrived(bookingId: Id, amount?: number): Promise<Booking> {
  const res = keep(await http<Booking>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/arrived`, { amount }));
  await refreshExtras(bookingId);
  return res;
}

export async function confirmBooking(bookingId: Id): Promise<Booking> {
  return keep(await http<Booking>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/confirm`));
}

export async function refundDone(bookingId: Id): Promise<Booking> {
  return keep(await http<Booking>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/refund-done`));
}

export async function prepaymentReceived(bookingId: Id): Promise<Booking> {
  const res = keep(await http<Booking>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/prepayment-received`));
  await refreshExtras(bookingId);
  return res;
}

// ─────────── групповые события ───────────

export interface ServerGroupEventQuery {
  businessId?: Id;
  businessIds?: Id[];
  locationId?: Id;
  staffId?: Id;
  serviceId?: Id;
  from?: ISODate;
  to?: ISODate;
  statuses?: GroupEvent['status'][];
}

export async function listGroupEvents(q: ServerGroupEventQuery): Promise<GroupEvent[]> {
  trackRead('core.groupEvents');
  const businessId = q.businessId ?? q.businessIds?.[0] ?? sessionBiz();
  const list = await http<GroupEvent[]>('GET', `${b(businessId)}/events`, undefined, {
    query: {
      businessIds: (q.businessIds ?? []).filter((id) => id !== businessId).join(',') || undefined,
      locationId: q.locationId,
      staffId: q.staffId,
      serviceId: q.serviceId,
      from: q.from,
      to: q.to,
      statuses: q.statuses?.join(','),
    },
  });
  mirrorGroupEvents(list);
  return list;
}

export async function createGroupEvent(input: Omit<GroupEvent, 'id' | 'createdAt' | 'status'> & { status?: GroupEvent['status'] }): Promise<GroupEvent> {
  const { businessId, ...body } = input;
  const e = await http<GroupEvent>('POST', `${b(businessId)}/events`, body);
  mirrorGroupEvents([e]);
  return e;
}

export async function updateGroupEvent(id: Id, patch: Partial<Omit<GroupEvent, 'id' | 'createdAt'>>): Promise<GroupEvent> {
  const businessId = useDb.getState().core.groupEvents.find((e) => e.id === id)?.businessId ?? sessionBiz();
  const { businessId: _b, ...body } = patch;
  void _b;
  const e = await http<GroupEvent>('PATCH', `${b(businessId)}/events/${id}`, body);
  mirrorGroupEvents([e]);
  return e;
}

// ─────────── доп. данные визита ───────────

/**
 * Доп. данные одной записи. Экраны просят их по одной на строку (список «Записи» — сотни строк): запросы одного такта
 * собираются в один POST …/bookings/extras, каждый получает свой ответ.
 */
export function getExtras(bookingId: Id): Promise<BookingExtras> {
  readsExtras();
  return new Promise((resolve, reject) => {
    extrasBatch.push({ id: bookingId, resolve, reject });
    if (extrasBatch.length === 1) setTimeout(flushExtrasBatch, 0);
  });
}

const extrasBatch: { id: Id; resolve: (e: BookingExtras) => void; reject: (e: unknown) => void }[] = [];
const EMPTY_EXTRAS: BookingExtras = { categoryIds: [], customFieldValues: {}, goodsLines: [], serviceLineExtras: [], paidAmount: 0 };

async function flushExtrasBatch(): Promise<void> {
  const batch = extrasBatch.splice(0, extrasBatch.length);
  const byBiz = new Map<Id, Id[]>();
  for (const x of batch) {
    const biz = bizOfBooking(x.id);
    byBiz.set(biz, [...new Set([...(byBiz.get(biz) ?? []), x.id])]);
  }
  try {
    const all: Record<Id, BookingExtras> = {};
    for (const [biz, ids] of byBiz) {
      for (let i = 0; i < ids.length; i += 1000) Object.assign(all, await http<Record<Id, BookingExtras>>('POST', `${b(biz)}/bookings/extras`, { ids: ids.slice(i, i + 1000) }));
    }
    mirrorExtrasMany(all);
    for (const x of batch) {
      if (all[x.id]) x.resolve(all[x.id]);
      else x.reject(new ApiError('not_found', 'Booking not found'));
    }
  } catch (e) {
    for (const x of batch) x.reject(e);
  }
}

/** Пачка доп. данных — одной записью в срез (одно уведомление читателям, а не по одному на строку) */
function mirrorExtrasMany(all: Record<Id, BookingExtras>): void {
  const current = useDb.getState().areas.journal.extras;
  const changed = Object.entries(all).filter(([id, e]) => !sameJson(current[id] ?? EMPTY_EXTRAS, e));
  if (!changed.length) return;
  useDb.getState().setArea('journal', (area) => ({ ...area, extras: { ...area.extras, ...Object.fromEntries(changed) } }));
}

async function refreshExtras(bookingId: Id): Promise<void> {
  await getExtras(bookingId).catch(() => undefined);
}

export async function listExtrasByIds(ids: Id[]): Promise<Record<Id, BookingExtras>> {
  readsExtras();
  if (!ids.length) return {};
  const res = await http<Record<Id, BookingExtras>>('POST', `${b(bizOfBooking(ids[0]))}/bookings/extras`, { ids });
  mirrorExtrasMany(res);
  return res;
}

export async function setExtras(bookingId: Id, patch: Partial<BookingExtras>): Promise<BookingExtras> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'deletion') continue;
    body[k] = v === undefined ? null : v;
  }
  return keepExtras(bookingId, await http<BookingExtras>('PUT', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/extras`, body));
}

/**
 * Деньги окна «Оплата визита» (наличные / карта) идут через кассу: POST …/finance/bookings/:id/payments пишет приход
 * (FinOp «Оплата услуги»), строку платежа визита и строку extras.payments (id = группа платежа) — одной транзакцией.
 * Раньше журнал писал только extras: «Оплачено» в окне, а в кассе, «Финансах» и отчётах (выручка = полученные деньги)
 * — 0 (final-api.md). Строки лояльности (refId) и прочие способы — как раньше, в extras журнала.
 */
function isCashLine(l: { method: string; refId?: Id }): boolean {
  return (l.method === 'cash' || l.method === 'card') && !l.refId;
}
const fin = (bookingId: Id) => `${b(bizOfBooking(bookingId))}/finance`;
interface FinanceMoneyLine { id: Id; kind?: string; groupId?: Id; cancelled?: boolean }
async function financeMoneyGroups(bookingId: Id): Promise<Id[]> {
  const s = await http<{ due: number; moneyLines: FinanceMoneyLine[] }>('GET', `${fin(bookingId)}/bookings/${bookingId}/payments`);
  const seen = new Set<Id>();
  const ids: Id[] = [];
  for (const l of s.moneyLines) {
    if (l.cancelled || l.kind === 'discount') continue;
    const key = l.groupId ?? l.id;
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(l.id);
  }
  return ids;
}
async function freshExtras(bookingId: Id): Promise<BookingExtras> {
  const all = await http<Record<Id, BookingExtras>>('POST', `${b(bizOfBooking(bookingId))}/bookings/extras`, { ids: [bookingId] });
  const extras = all[bookingId];
  if (!extras) throw new ApiError('not_found', 'Booking not found');
  return keepExtras(bookingId, extras);
}
/** 404 кассы — строка не из кассы (старая строка журнала, предоплата) */
function isNotFound(e: unknown): boolean {
  return e instanceof HttpApiError && e.status === 404;
}

export async function payLines(bookingId: Id, lines: { method: string; amount: number; label: string; cashRegister?: string; refId?: Id }[]): Promise<BookingExtras> {
  const money = lines.filter(isCashLine);
  const rest = lines.filter((l) => !isCashLine(l));
  if (money.length > 0) {
    await http('POST', `${fin(bookingId)}/bookings/${bookingId}/payments`, { mode: 'split', parts: money.map((l) => ({ methodKey: l.method, amount: l.amount })) }, { idempotencyKey: crypto.randomUUID() });
  }
  if (rest.length === 0) return freshExtras(bookingId);
  return keepExtras(bookingId, await http<BookingExtras>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/payments`, { lines: rest }, { idempotencyKey: crypto.randomUUID() }));
}
/** «Оплатить» в «Списке» / всплывающей карточке: остаток наличными через кассу (как payThroughFinance мока) */
export async function instantPay(bookingId: Id, total: number, method: 'cash' | 'card' = 'cash'): Promise<BookingExtras> {
  void total; // остаток считает касса: сумма визита − платежи − полученная предоплата
  const s = await http<{ due: number }>('GET', `${fin(bookingId)}/bookings/${bookingId}/payments`);
  if (s.due > 0) await http('POST', `${fin(bookingId)}/bookings/${bookingId}/payments`, { mode: 'quick', methodKey: method }, { idempotencyKey: crypto.randomUUID() });
  return freshExtras(bookingId);
}
/** «Отменить оплату» целиком: платежи кассы отменяются (приходы снимаются), затем extras журнала очищаются */
export async function cancelPayments(bookingId: Id): Promise<BookingExtras> {
  for (const id of await financeMoneyGroups(bookingId)) await http('DELETE', `${fin(bookingId)}/payments/${id}`);
  return keepExtras(bookingId, await http<BookingExtras>('DELETE', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/payments`));
}
export async function cancelPaymentLine(bookingId: Id, lineId: Id): Promise<BookingExtras> {
  try {
    await http('DELETE', `${fin(bookingId)}/payments/${lineId}`);
    return freshExtras(bookingId);
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }
  return keepExtras(bookingId, await http<BookingExtras>('DELETE', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/payments/${lineId}`));
}
/**
 * Частичный возврат: платёж кассы — расходом «Возврат»; сервер в той же транзакции уменьшает paidAmount и строку окна
 * (решение владельца 01.10.2026: оплачено = платежи − возвраты, одно правило с моком). Строка не из кассы — как раньше.
 */
export async function refundPaymentLine(bookingId: Id, lineId: Id, amount: number): Promise<BookingExtras> {
  try {
    await http('POST', `${fin(bookingId)}/payments/${lineId}/refund`, { amount: Math.round(amount), reason: '' });
    return freshExtras(bookingId);
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }
  return keepExtras(bookingId, await http<BookingExtras>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/payments/${lineId}/refund`, { amount }));
}
export async function decidePrepayment(bookingId: Id, input: { kept: boolean; reason: 'late_reschedule' | 'no_show'; decidedBy: string; auto?: boolean }): Promise<void> {
  keepExtras(bookingId, await http<BookingExtras>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/prepayment-decision`, input));
}
export async function addGoodsLine(bookingId: Id, line: Record<string, unknown>): Promise<BookingExtras> {
  return keepExtras(bookingId, await http<BookingExtras>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/goods-lines`, line));
}
export async function patchGoodsLine(bookingId: Id, lineId: Id, patch: Record<string, unknown>): Promise<BookingExtras> {
  return keepExtras(bookingId, await http<BookingExtras>('PATCH', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/goods-lines/${lineId}`, patch));
}
export async function removeGoodsLine(bookingId: Id, lineId: Id): Promise<BookingExtras> {
  return keepExtras(bookingId, await http<BookingExtras>('DELETE', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/goods-lines/${lineId}`));
}

export function deletionImpact(bookingId: Id): Promise<{ paidAmount: number; consumablesReturned: boolean; subscriptionVisitReturned: boolean }> {
  readsExtras();
  return http('GET', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/deletion-impact`);
}

export async function duplicate(bookingId: Id): Promise<Booking> {
  const copy = keep(await http<Booking>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/duplicate`));
  await refreshExtras(copy.id);
  return copy;
}

export async function external(input: { businessId: Id; locationId?: Id; name: string; phone: string; serviceId: Id; staffId?: Id; start: ISODateTime }): Promise<Booking> {
  const { businessId, ...body } = input;
  return keep(await http<Booking>('POST', `${b(businessId)}/bookings/external`, body, { idempotencyKey: crypto.randomUUID() }));
}

// ─────────── история ───────────

export function history(bookingId: Id): Promise<BookingHistoryEntry[]> {
  trackRead('areas.journal.history');
  return http('GET', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/history`);
}

export async function logHistory(bookingId: Id, input: { authorName: string; action: BookingHistoryEntry['action']; summary: string }): Promise<BookingHistoryEntry> {
  const entry = await http<BookingHistoryEntry>('POST', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/history`, input);
  useDb.getState().setArea('journal', (area) => ({ ...area, history: { ...area.history, [bookingId]: [...(area.history[bookingId] ?? []), entry] } }));
  return entry;
}

// ─────────── настройки журнала ───────────

export interface JournalConfig {
  settings: JournalSettings;
  visitIntervalMin: number;
  bookingCategories: BookingCategoryDef[];
  customFieldDefs: CustomFieldDef[];
  recurrenceTemplates: RecurrenceTemplate[];
  staffJournalRights: Record<Id, Partial<JournalBlockRights>>;
  staffWindowRights: Record<Id, Partial<WindowRights>>;
  staffMarkupMin: Record<Id, number>;
  breakCombineMode: 'longest' | 'sum';
  splitByResourceEnabled: boolean;
  autoWriteoffServiceIds: Id[];
  hotDiscountPct: Record<Id, number>;
  // === этап 21 (лейн rest) ===
  zoomMin: JournalZoomMin;
  hiddenStatuses: string[];
  // === /этап 21 ===
}

/** Настройки журнала — в срез journal браузера: экраны и расчёты журнала читают их оттуда (то же — не трогаем) */
function mirrorConfig(c: JournalConfig): JournalConfig {
  const area = useDb.getState().areas.journal;
  const next = {
    settings: c.settings,
    visitIntervalMin: c.visitIntervalMin,
    bookingCategories: c.bookingCategories,
    customFieldDefs: c.customFieldDefs,
    recurrenceTemplates: c.recurrenceTemplates,
    staffJournalRights: c.staffJournalRights,
    staffWindowRights: c.staffWindowRights,
    autoWriteoffServiceIds: c.autoWriteoffServiceIds,
    prefs: {
      ...area.prefs,
      staffMarkupMin: c.staffMarkupMin as typeof area.prefs.staffMarkupMin,
      breakCombineMode: c.breakCombineMode,
      splitByResourceEnabled: c.splitByResourceEnabled,
      zoomMin: c.zoomMin,
      hiddenStatuses: c.hiddenStatuses,
    },
  };
  const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => !sameJson((area as unknown as Record<string, unknown>)[k], v)));
  if (Object.keys(changed).length) useDb.getState().setArea('journal', (a) => ({ ...a, ...changed }));
  return c;
}

export async function getConfig(): Promise<JournalConfig> {
  trackRead(
    'areas.journal.settings',
    'areas.journal.visitIntervalMin',
    'areas.journal.bookingCategories',
    'areas.journal.customFieldDefs',
    'areas.journal.recurrenceTemplates',
    'areas.journal.staffJournalRights',
    'areas.journal.staffWindowRights',
    'areas.journal.prefs',
  );
  return mirrorConfig(await http<JournalConfig>('GET', `${b(sessionBiz())}/journal/config`));
}

export async function patchConfig(patch: Partial<JournalConfig>): Promise<JournalConfig> {
  return mirrorConfig(await http<JournalConfig>('PATCH', `${b(sessionBiz())}/journal/config`, patch));
}

export async function addCategory(input: { name: string; colorIndex: number }): Promise<BookingCategoryDef> {
  const def = await http<BookingCategoryDef>('POST', `${b(sessionBiz())}/journal/categories`, input);
  await getConfig().catch(() => undefined);
  return def;
}

export async function addRecurrenceTemplate(name: string, rule: RecurrenceRule): Promise<RecurrenceTemplate> {
  const tpl = await http<RecurrenceTemplate>('POST', `${b(sessionBiz())}/journal/recurrence-templates`, { name, rule });
  await getConfig().catch(() => undefined);
  return tpl;
}

// ─────────── проверки занятости, визит ───────────

export interface CheckResult {
  overlap: boolean;
  withinHours: boolean;
  resourceFree: boolean;
  occupiedInstanceIds: Id[];
  /** Другая запись этого клиента в это время (передан clientId) */
  clientOverlap?: { start: ISODateTime; staffId: Id; serviceId?: Id };
  /** F-00-047: домашняя / выездная запись (передан workplace) попадает на смену в салоне с запретом — часы смены */
  homeShift?: { businessId: Id; date: string; from: string; to: string };
}

export function check(input: { staffId?: Id; start: ISODateTime; durationMin: number; excludeBookingId?: Id; resourceId?: Id; instanceId?: Id; locationId?: Id; clientId?: Id; workplace?: string }): Promise<CheckResult> {
  reads();
  const businessId = input.staffId ? bizOfStaff(input.staffId) : input.locationId ? (useDb.getState().core.locations.find((l) => l.id === input.locationId)?.businessId ?? sessionBiz()) : input.clientId ? bizOfClient(input.clientId) : sessionBiz();
  return http<CheckResult>('POST', `${b(businessId)}/journal/check`, input);
}

export async function visitIdFor(input: { clientId?: Id; start: ISODateTime; durationMin: number; excludeBookingId?: Id }): Promise<Id | undefined> {
  if (!input.clientId) return undefined;
  const res = await http<{ visitId: Id | null }>('POST', `${b(bizOfClient(input.clientId))}/journal/visit-id`, input);
  return res.visitId ?? undefined;
}

export async function syncVisitStatus(visitId: Id, status: BookingStatus, excludeId: Id): Promise<void> {
  const businessId = bizOfBooking(excludeId);
  await http('POST', `${b(businessId)}/visits/${visitId}/status`, { status, excludeId });
  await syncBookings([businessId]).catch(() => undefined);
}

// ─────────── повтор, серии ───────────

export async function createRecurrence(sourceId: Id, rule: RecurrenceRule, dates: ISODate[]): Promise<{ created: Booking[]; skipped: number; seriesId: Id }> {
  const res = await http<{ created: Booking[]; skipped: number; seriesId: Id }>('POST', `${b(bizOfBooking(sourceId))}/bookings/${sourceId}/recurrence`, { rule, dates });
  keepAll(res.created);
  return res;
}

export async function seriesBookings(seriesId: Id): Promise<Booking[]> {
  reads();
  return keepAll(await http<Booking[]>('GET', `${b(sessionBiz())}/series/${seriesId}/bookings`));
}

export async function deleteSeriesBookings(seriesId: Id, authorName: string): Promise<number> {
  const businessId = sessionBiz();
  const res = await http<{ deleted: number }>('POST', `${b(businessId)}/series/${seriesId}/delete-bookings`, { authorName });
  await syncBookings([businessId]).catch(() => undefined);
  return res.deleted;
}

export interface ServerSeriesResult {
  rule: SeriesRule;
  occurrences: SeriesOccurrence[];
  movedCount: number;
  skipped: number;
}

export async function createSeries(businessId: Id, input: Record<string, unknown>): Promise<ServerSeriesResult> {
  const res = await http<ServerSeriesResult>('POST', `${b(businessId)}/series`, input, { idempotencyKey: crypto.randomUUID() });
  await syncBookings([businessId]).catch(() => undefined);
  return res;
}

export function listSeries(businessId: Id, staffId?: Id): Promise<SeriesRule[]> {
  reads();
  return http<SeriesRule[]>('GET', `${b(businessId)}/series`, undefined, { query: { staffId } });
}

export function previewSeries(businessId: Id, input: Record<string, unknown>): Promise<{ firstDate: ISODate; count: number; offDays: number }> {
  return http('POST', `${b(businessId)}/series/preview`, input);
}

export async function seriesOccurrences(businessId: Id, seriesId: Id): Promise<Booking[]> {
  reads();
  return keepAll(await http<Booking[]>('GET', `${b(businessId)}/series/${seriesId}/occurrences`));
}

export async function extendSeries(businessId: Id, seriesId: Id, ifNeeded: boolean): Promise<ServerSeriesResult | null> {
  const res = await http<ServerSeriesResult | undefined>('POST', `${b(businessId)}/series/${seriesId}/extend`, undefined, { query: { ifNeeded: ifNeeded ? '1' : undefined } });
  if (res?.occurrences.length) await syncBookings([businessId]).catch(() => undefined);
  return res ?? null;
}

export async function extendDueSeries(businessId: Id): Promise<number> {
  const res = await http<{ added: number }>('POST', `${b(businessId)}/series/extend-due`);
  if (res.added) await syncBookings([businessId]).catch(() => undefined);
  return res.added;
}

export function setSeriesActive(businessId: Id, seriesId: Id, active: boolean): Promise<void> {
  return http('POST', `${b(businessId)}/series/${seriesId}/${active ? 'resume' : 'stop'}`);
}

// ─────────── пакеты ───────────

export async function createPackage(businessId: Id, input: Record<string, unknown>): Promise<{ groupId: Id; bookings: Booking[] }> {
  const res = await http<{ groupId: Id; bookings: Booking[] }>('POST', `${b(businessId)}/booking-packages`, input, { idempotencyKey: crypto.randomUUID() });
  keepAll(res.bookings);
  for (const bk of res.bookings) await refreshExtras(bk.id);
  const group = await http<PackageGroup | null>('GET', `${b(businessId)}/booking-packages/${res.groupId}`);
  if (group) mirrorPackageGroup(group);
  return res;
}

export async function getPackage(groupId: Id): Promise<PackageGroup | undefined> {
  trackRead('areas.journal');
  const g = await http<PackageGroup | null>('GET', `${b(sessionBiz())}/booking-packages/${groupId}`);
  if (g) mirrorPackageGroup(g);
  return g ?? undefined;
}

export async function packageSiblings(bookingId: Id): Promise<{ booking: Booking; staffName: string }[]> {
  reads();
  const res = await http<{ booking: Booking; staffName: string }[]>('GET', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/package-siblings`);
  keepAll(res.map((x) => x.booking));
  return res;
}

export async function transferPackage(bookingId: Id, deltaMin: number, authorName: string): Promise<void> {
  const businessId = bizOfBooking(bookingId);
  await http('POST', `${b(businessId)}/bookings/${bookingId}/package-transfer`, { deltaMin, authorName });
  await syncBookings([businessId]).catch(() => undefined);
}

export async function deletePackage(bookingId: Id, authorName: string): Promise<Id[]> {
  const businessId = bizOfBooking(bookingId);
  const ids = await http<Id[]>('POST', `${b(businessId)}/bookings/${bookingId}/package-delete`, { authorName });
  await syncBookings([businessId]).catch(() => undefined);
  return ids;
}

export function checkLinked(plans: { staffId: Id; start: ISODateTime; lines: { serviceId: Id; price: number; durationMin: number }[] }[]): Promise<{ staffId: Id; reason: 'busy' | 'offHours' }[]> {
  if (!plans.length) return Promise.resolve([]);
  return http('POST', `${b(bizOfStaff(plans[0].staffId))}/booking-packages/check-linked`, { plans });
}

export async function attachLinked(input: { mainBookingId: Id; businessId: Id; locationId: Id; clientId?: Id; createdBy: Id; order: PackageOrderMode; plans: unknown[] }): Promise<Id[]> {
  const { businessId, ...body } = input;
  const ids = await http<Id[]>('POST', `${b(businessId)}/booking-packages/attach`, body);
  await syncBookings([businessId]).catch(() => undefined);
  return ids;
}

// ─────────── лист ожидания — один на бизнес: /resources/waitlist, api/resources.server.ts (30.09.2026) ───────────

// ─────────── медицинские сферы ───────────

export async function medicalVisit(bookingId: Id): Promise<MedicalVisitNote | undefined> {
  return (await http<MedicalVisitNote | null>('GET', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/medical`)) ?? undefined;
}
export function setMedicalVisit(bookingId: Id, patch: Record<string, string>, authorName: string): Promise<MedicalVisitNote> {
  return http('PUT', `${b(bizOfBooking(bookingId))}/bookings/${bookingId}/medical`, { patch, authorName });
}
export async function medicalCard(clientId: Id): Promise<MedicalCard | undefined> {
  return (await http<MedicalCard | null>('GET', `${b(bizOfClient(clientId))}/clients/${clientId}/medical-card`)) ?? undefined;
}
export function setMedicalCard(clientId: Id, patch: Record<string, string>): Promise<MedicalCard> {
  return http('PUT', `${b(bizOfClient(clientId))}/clients/${clientId}/medical-card`, patch);
}
export function listPlans(clientId: Id): Promise<TreatmentPlan[]> {
  return http('GET', `${b(bizOfClient(clientId))}/clients/${clientId}/treatment-plans`);
}
export function refreshPlans(clientId: Id): Promise<void> {
  return http('POST', `${b(bizOfClient(clientId))}/clients/${clientId}/treatment-plans/refresh-prices`);
}
export function addPlan(clientId: Id, title: string, serviceIds: Id[]): Promise<TreatmentPlan> {
  return http('POST', `${b(bizOfClient(clientId))}/clients/${clientId}/treatment-plans`, { title, serviceIds });
}
export async function duplicatePlan(clientId: Id, planId: Id): Promise<TreatmentPlan | undefined> {
  return (await http<TreatmentPlan | null>('POST', `${b(bizOfClient(clientId))}/clients/${clientId}/treatment-plans/${planId}/duplicate`)) ?? undefined;
}
export function deletePlan(clientId: Id, planId: Id): Promise<void> {
  return http('DELETE', `${b(bizOfClient(clientId))}/clients/${clientId}/treatment-plans/${planId}`);
}

// ─────────── импорт, журнал выгрузок ───────────

export async function importRows(businessId: Id, locationId: Id, createdBy: Id, rows: unknown[]): Promise<{ createdCount: number; errorCount: number; errors: string[] }> {
  const res = await http<{ createdCount: number; errorCount: number; errors: string[] }>('POST', `${b(businessId)}/bookings-import`, { locationId, createdBy, rows });
  await syncBookings([businessId]).catch(() => undefined);
  return res;
}
export function logDataOp(kind: 'import' | 'export', count: number): Promise<DataOpsLogEntry> {
  return http('POST', `${b(sessionBiz())}/journal/data-ops`, { kind, count });
}
export function dataOps(): Promise<DataOpsLogEntry[]> {
  return http('GET', `${b(sessionBiz())}/journal/data-ops`);
}

// ─────────── «Закрыть окно» (F-00-107) ───────────

export function mintClaim(businessId: Id, input: { staffId: Id; serviceId?: Id; start: ISODateTime; clientName?: string; clientPhone?: string }): Promise<{ token: string }> {
  return http('POST', `${b(businessId)}/claims`, input);
}
export function getClaim<T>(token: string): Promise<T> {
  return http<T>('GET', `/v1/claims/${token}`);
}
export async function closeClaim(token: string): Promise<{ bookingId: Id }> {
  const res = await http<{ bookingId: Id }>('POST', `/v1/claims/${token}/close`);
  const businessId = apiIdentity()?.businessId;
  if (businessId) await syncBookings([businessId]).catch(() => undefined);
  return res;
}

// ─────────── клиент в окне записи (F-01-070) ───────────

export async function setClientTags(clientId: Id, tags: string[]): Promise<void> {
  await http('PUT', `${b(bizOfClient(clientId))}/clients/${clientId}/window-tags`, { tags });
  useDb.getState().setCore((core) => ({ ...core, clients: core.clients.map((c) => (c.id === clientId ? { ...c, tags } : c)) }));
}

export async function setClientNote(clientId: Id, note: string): Promise<void> {
  const C = await import('@/api/clients/clients.server');
  await C.updateClientNote(bizOfClient(clientId), clientId, note);
  useDb.getState().setCore((core) => ({ ...core, clients: core.clients.map((c) => (c.id === clientId ? { ...c, note } : c)) }));
}

/** F-01-032: перерыв под записью — в доп. данных записи на сервере и в prefs среза (его читает сетка) */
export async function setBreakOverride(bookingId: Id, minutes: number): Promise<void> {
  await setExtras(bookingId, { breakOverrideMin: minutes } as Partial<BookingExtras>);
  useDb.getState().setArea('journal', (area) => ({ ...area, prefs: { ...area.prefs, breakOverrideMin: { ...area.prefs.breakOverrideMin, [bookingId]: minutes } } }));
}

// ─────────── повтор записей ядра на сервере (core.withServerWrites) ───────────

type RecordedWrite =
  | { op: 'create'; collection: 'bookings' | 'groupEvents'; entity: Record<string, unknown> }
  | { op: 'update'; collection: 'bookings' | 'groupEvents'; id: Id; patch: Record<string, unknown> };

/**
 * Записи, которые логика раздела сделала в зеркале (coreTx), — по порядку на сервер. Созданное в зеркале с временным
 * id заменяется серверным (ссылки на него в следующих операциях переводятся). Сервер отказал — зеркало бизнеса
 * перечитывается с сервера (временные сущности уходят), ошибка — экрану.
 */
export async function replayCoreWrites(ops: RecordedWrite[]): Promise<void> {
  if (!ops.length) return;
  const idMap = new Map<Id, Id>();
  const m = (id: unknown) => (typeof id === 'string' ? (idMap.get(id) ?? id) : id);
  const dropLocal = (collection: 'bookings' | 'groupEvents', id: Id) =>
    useDb.getState().setCore((core) => ({ ...core, [collection]: (core[collection] as { id: Id }[]).filter((x) => x.id !== id) }));
  const businessIds = new Set<Id>();
  try {
    for (const op of ops) {
      if (op.op === 'create') {
        const { id, createdAt: _c, updatedAt: _u, total: _t, ...rest } = op.entity as Record<string, unknown> & { id: Id };
        void _c;
        void _u;
        void _t;
        businessIds.add(String(rest.businessId));
        if (op.collection === 'groupEvents') {
          const e = await createGroupEvent(rest as unknown as Parameters<typeof createGroupEvent>[0]);
          idMap.set(id, e.id);
          if (e.id !== id) dropLocal('groupEvents', id);
        } else {
          const bk = await createBooking({ ...(rest as unknown as Parameters<typeof createBooking>[0]), groupEventId: m(rest.groupEventId) as Id | undefined });
          idMap.set(id, bk.id);
          if (bk.id !== id) dropLocal('bookings', id);
        }
      } else {
        const patch: Record<string, unknown> = { ...op.patch };
        delete patch.updatedAt;
        delete patch.createdAt;
        if ('groupEventId' in patch) patch.groupEventId = m(patch.groupEventId);
        if (op.collection === 'groupEvents') await updateGroupEvent(String(m(op.id)), patch as Partial<GroupEvent>);
        else await updateBooking(String(m(op.id)), patch as Partial<Booking>);
      }
    }
  } catch (e) {
    const ids = [...businessIds].filter((x) => x && x !== 'undefined');
    await syncBookings(ids.length ? ids : [sessionBiz()]).catch(() => undefined);
    throw e;
  }
}

/** F-00-121: какие клиенты получают напоминания в Telegram (номер привязан к боту) */
export async function telegramLinkedClients(businessId: Id, clientIds: Id[]): Promise<Id[]> {
  if (!clientIds.length) return [];
  reads();
  const r = await http<{ clientIds: Id[] }>('GET', `${b(businessId)}/telegram/linked-clients`, undefined, { query: { clientIds: clientIds.join(',') } });
  return r.clientIds;
}

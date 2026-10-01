'use client';

/**
 * API ядра — чтение и запись общих сущностей (src/domain/core.ts). Файл фундамента.
 * Не хватает функции — просьба в qa/requests/<area>.md; пока ждёте — соберите нужное из
 * coreList/coreGet/coreCreate/coreUpdate/coreRemove.
 *
 * Два слоя:
 *  - async-функции (coreList, createBooking, placeBooking…) — «сетевые»: каждая = один request() = будущий эндпоинт;
 *  - coreTx.* — те же операции СИНХРОННО, только ВНУТРИ request() своей api-функции (arch-a1 №1): несколько записей
 *    в ядро одним запросом, без лишних задержек и без гонки между проверкой и записью:
 *      request(() => { const r = coreTx.placeBooking(input); mutateArea('online', …); return r; })
 *    Флаг «вне запроса» и откат при ошибке — в request() (архитектор состояния).
 *
 * Бизнес-правила здесь НЕ пишутся — они в src/domain/rules (чистые функции); здесь только чтение/запись.
 */
import type { Permission } from '@/config/permissions';
import { DEFAULT_DEMO, DEMO_COOKIES, isValidDemoValue, type PersonaId } from '@/demo/settings';
import { resolveDemoContext } from '@/demo/context';
import { apiIdentity } from '@/api/identity';
import { http, isApiMode } from '@/api/http';
import * as J from '@/api/journal.server';
import type {
  Booking,
  BookingEvent,
  BookingEventKind,
  BookingStatus,
  Business,
  Client,
  CoinMove,
  DataOperation,
  CoreCollection,
  CoreData,
  CoreEntity,
  GroupEvent,
  ISODate,
  ISODateTime,
  Id,
  SphereId,
} from '@/domain/core';
import { canTransition, isOnlineSource, noShowDelta, occupiesTime, type StatusActor } from '@/domain/rules/booking-status';
import {
  canReschedule,
  clientCancelOutcome,
  effectiveBookingRules,
  isPrepaymentExpired,
  confirmDeadlineOf,
  rescheduledStatus,
} from '@/domain/rules/booking-policy';
import { bookingBufferAfter, checkSlot } from '@/domain/rules/busy';
import { prepaidAmount } from '@/domain/rules/pricing';
import { nearestFreeStarts } from '@/domain/rules/slots';
import { resolveBookingResources, type ResourceBusyBooking } from '@/domain/resources';
import { planBooking, type PlaceBookingContext, type PlaceBookingInput } from '@/domain/rules/booking-flow';
import { canWith, permissionsOf, type PermissionContext } from '@/domain/rules/permissions';
import { hiddenByModeration } from '@/domain/rules/visibility';
import { readArea } from '@/api/area';
import { ApiError, request, trackRead, useApiQuery, type QueryOptions, type QueryResult } from '@/api/request';
import { addMinutes, datePart, nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { slugify } from '@/lib/text';
import { useDb } from '@/mock/db';

const ID_PREFIX: Record<CoreCollection, string> = {
  networks: 'net',
  businesses: 'biz',
  locations: 'loc',
  staff: 'st',
  serviceCategories: 'cat',
  services: 'sv',
  resources: 'res',
  clients: 'cl',
  appUsers: 'au',
  bookings: 'bk',
  groupEvents: 'ev',
  schedules: 'sch',
  calendarMarks: 'mk',
};

type Filter<T> = Partial<T> | ((item: T) => boolean);

function matches<T>(item: T, filter?: Filter<T>): boolean {
  if (!filter) return true;
  if (typeof filter === 'function') return filter(item);
  return (Object.keys(filter) as (keyof T)[]).every((k) => item[k] === filter[k]);
}

function core(): CoreData {
  return useDb.getState().core;
}

function setCore(recipe: (c: CoreData) => CoreData): void {
  useDb.getState().setCore(recipe);
}

// ─────────────────────────── Журнал событий записей (e2e-q1 №3) ───────────────────────────

/** Сколько последних событий хранить (localStorage не резиновый) */
const MAX_BOOKING_EVENTS = 1000;

type EventActor = BookingEvent['by'];

/** Кто делает запись: сотрудник кабинета, клиент или 'system' (наша панель, снятие по сроку) */
function eventActor(): EventActor {
  const actor = currentActor();
  if (actor.staffId) return actor.staffId;
  return actor.persona === 'platform' ? 'system' : 'client';
}

/** События перехода prev → next одной записи (prev нет — создана) */
function bookingEventsFor(prev: Booking | undefined, next: Booking, by: EventActor, at: ISODateTime): BookingEvent[] {
  const base = (kind: BookingEventKind): BookingEvent => ({
    id: newId('bev'),
    bookingId: next.id,
    businessId: next.businessId,
    staffId: next.staffId,
    ...(next.clientId ? { clientId: next.clientId } : {}),
    ...(next.appUserId ? { appUserId: next.appUserId } : {}),
    kind,
    start: next.start,
    by,
    at,
  });
  if (!prev) return [{ ...base('created'), to: next.status }];
  const freedSlot = { staffId: prev.staffId, locationId: prev.locationId, start: prev.start, durationMin: prev.durationMin };
  const wasBusy = occupiesTime(prev);
  if (next.deletedAt && !prev.deletedAt) return [{ ...base('deleted'), ...(wasBusy ? { freed: freedSlot } : {}) }];
  const out: BookingEvent[] = [];
  if (prev.status !== next.status) {
    out.push({
      ...base('status'),
      from: prev.status,
      to: next.status,
      ...(next.cancelledLate && !prev.cancelledLate ? { late: true } : {}),
      ...(next.cancelReason && !prev.cancelReason ? { reason: next.cancelReason } : {}),
      ...(wasBusy && !occupiesTime(next) ? { freed: freedSlot } : {}),
    });
  }
  if (prev.start !== next.start || prev.staffId !== next.staffId) {
    out.push({
      ...base('moved'),
      prevStart: prev.start,
      ...(prev.staffId !== next.staffId ? { prevStaffId: prev.staffId } : {}),
      ...(wasBusy && occupiesTime(next) ? { freed: freedSlot } : {}),
    });
  }
  return out;
}

/** Дописать события в журнал ядра (внутри того же request, что и сама запись) */
function appendBookingEvents(events: BookingEvent[]): void {
  if (!events.length) return;
  setCore((d) => {
    const list = [...(d.bookingEvents ?? []), ...events];
    return { ...d, bookingEvents: list.length > MAX_BOOKING_EVENTS ? list.slice(-MAX_BOOKING_EVENTS) : list };
  });
}

/** Записать события по изменённым записям: пары «до/после» (до нет — создана) */
function logBookingChanges(pairs: { prev?: Booking; next: Booking }[], by: EventActor = eventActor(), at: ISODateTime = nowDateTime()): void {
  appendBookingEvents(pairs.flatMap(({ prev, next }) => bookingEventsFor(prev, next, by, at)));
}

// ─────────────────────────── Режим api: записи ядра разделов, ещё написанных на coreTx ───────────────────────────

/**
 * Режим api (этап 7): записи и групповые события живут на сервере. Разделы, чья логика ещё написана синхронными
 * coreTx.* внутри request() (групповые события и участники раздела resources), оборачиваются в withServerWrites:
 * их записи в ядро запоминаются и после выполнения повторяются на сервере по порядку (там — замок на мастера,
 * места, права); сервер отказал — зеркало перечитывается с сервера, ошибка уходит экрану.
 */
export type RecordedCoreWrite =
  | { op: 'create'; collection: 'bookings' | 'groupEvents'; entity: Record<string, unknown> }
  | { op: 'update'; collection: 'bookings' | 'groupEvents'; id: Id; patch: Record<string, unknown> };

let writeRecorder: RecordedCoreWrite[] | undefined;

export async function withServerWrites<T>(run: () => Promise<T>): Promise<T> {
  if (!isApiMode()) return run();
  const prev = writeRecorder;
  const ops: RecordedCoreWrite[] = [];
  writeRecorder = ops;
  let result: T;
  try {
    result = await run();
  } finally {
    writeRecorder = prev;
  }
  await J.replayCoreWrites(ops);
  return result;
}

// ─────────────────────────── Синхронные операции (только внутри request) ───────────────────────────

function txList<C extends CoreCollection>(collection: C, filter?: Filter<CoreEntity<C>>): CoreEntity<C>[] {
  return (core()[collection] as CoreEntity<C>[]).filter((item) => matches(item, filter));
}

function txGet<C extends CoreCollection>(collection: C, id: Id): CoreEntity<C> {
  const found = (core()[collection] as CoreEntity<C>[]).find((item) => item.id === id);
  if (!found) throw new ApiError('not_found', `${collection}/${id} не найден`);
  return found;
}

function txCreate<C extends CoreCollection>(collection: C, data: Omit<CoreEntity<C>, 'id'> & { id?: Id }): CoreEntity<C> {
  const entity = { ...data, id: data.id ?? newId(ID_PREFIX[collection]) } as CoreEntity<C>;
  if (writeRecorder && (collection === 'bookings' || collection === 'groupEvents')) writeRecorder.push({ op: 'create', collection, entity: entity as unknown as Record<string, unknown> });
  setCore((c) => ({ ...c, [collection]: [...(c[collection] as CoreEntity<C>[]), entity] }));
  if (collection === 'bookings') logBookingChanges([{ next: entity as Booking }]);
  return entity;
}

function txUpdate<C extends CoreCollection>(collection: C, id: Id, patch: Partial<CoreEntity<C>>): CoreEntity<C> {
  const current = (core()[collection] as CoreEntity<C>[]).find((item) => item.id === id);
  if (!current) throw new ApiError('not_found', `${collection}/${id} не найден`);
  const updated = { ...current, ...patch, id } as CoreEntity<C>;
  if (writeRecorder && (collection === 'bookings' || collection === 'groupEvents')) writeRecorder.push({ op: 'update', collection, id, patch: patch as Record<string, unknown> });
  setCore((c) => ({
    ...c,
    [collection]: (c[collection] as CoreEntity<C>[]).map((item) => (item.id === id ? updated : item)),
  }));
  if (collection === 'bookings') logBookingChanges([{ prev: current as Booking, next: updated as Booking }]);
  return updated;
}

function txRemove<C extends CoreCollection>(collection: C, id: Id): void {
  setCore((c) => ({ ...c, [collection]: (c[collection] as CoreEntity<C>[]).filter((item) => item.id !== id) }));
}

/**
 * Карточка клиента бизнеса для пользователя приложения (F-00-128: ключ — телефон).
 * Ищет по appUserId, затем по номеру; нашлась по номеру — привязывает appUserId; нет — заводит новую
 * из профиля приложения. undefined — пользователя приложения нет.
 */
function txLinkClientForAppUser(businessId: Id, appUserId: Id, now: ISODateTime = nowDateTime()): Id | undefined {
  const c = core();
  const user = c.appUsers.find((u) => u.id === appUserId);
  const byUser = c.clients.find((cl) => cl.businessId === businessId && cl.appUserId === appUserId);
  if (byUser) return byUser.id;
  if (!user) return undefined;
  const phone = normalizePhone(user.phone) ?? user.phone;
  const byPhone = c.clients.find((cl) => cl.businessId === businessId && cl.phone === phone);
  if (byPhone) {
    if (!byPhone.appUserId) {
      setCore((d) => ({ ...d, clients: d.clients.map((cl) => (cl.id === byPhone.id ? { ...cl, appUserId } : cl)) }));
    }
    return byPhone.id;
  }
  const created: Client = {
    id: newId('cl'),
    businessId,
    phone,
    name: user.name,
    gender: user.gender,
    birthday: user.birthday,
    tags: [],
    appUserId,
    noShowCount: 0,
    createdAt: now,
  };
  setCore((d) => ({ ...d, clients: [...d.clients, created] }));
  return created.id;
}

function txFindClientByPhone(businessId: Id, phone: string): Client | undefined {
  const normalized = normalizePhone(phone);
  return core().clients.find((c) => c.businessId === businessId && c.phone === normalized);
}

function txCreateBooking(input: BookingInput): Booking {
  const now = nowDateTime();
  const clientId = input.clientId ?? (input.appUserId ? txLinkClientForAppUser(input.businessId, input.appUserId, now) : undefined);
  const booking: Booking = {
    ...input,
    ...(clientId ? { clientId } : {}),
    id: newId('bk'),
    total: input.services.reduce((sum, s) => sum + s.price * s.qty, 0),
    durationMin: input.durationMin ?? input.services.reduce((sum, s) => sum + s.durationMin * s.qty, 0),
    createdAt: now,
    updatedAt: now,
  };
  writeRecorder?.push({ op: 'create', collection: 'bookings', entity: booking as unknown as Record<string, unknown> });
  setCore((c) => ({ ...c, bookings: [...c.bookings, booking] }));
  logBookingChanges([{ next: booking }]);
  return booking;
}

/**
 * Ресурсы записи (F-16-011, F-16-012, F-16-013): выбранные экземпляры проверяются на занятость, привязанные к новым
 * услугам ресурсы берутся сами; не хватает — ApiError('resource_unavailable'). Без этого журнал ставил две записи
 * на единственный аппарат в одно время (createBooking ресурсы не смотрел, окно записи молча оставляло поле пустым).
 * Групповые участники (ресурс держит само событие), импорт истории и записи, не занимающие время, — не проверяются.
 */
function txResolveResources(
  b: Pick<Booking, 'businessId' | 'locationId' | 'start' | 'durationMin' | 'services' | 'resourceIds' | 'status' | 'deletedAt' | 'groupEventId' | 'source'>,
  opts: { excludeBookingId?: Id; requiredServiceIds: Id[] },
): Id[] {
  if (b.groupEventId || b.source === 'import' || !occupiesTime(b)) return b.resourceIds;
  const c = core();
  const resources = c.resources.filter((r) => r.businessId === b.businessId);
  if (!resources.length && !b.resourceIds.length) return b.resourceIds;
  const buffers = new Map(c.services.map((s) => [s.id, s.bufferAfterMin ?? 0] as const));
  const bufferOf = (x: Pick<Booking, 'services'>) => Math.max(0, ...x.services.map((l) => buffers.get(l.serviceId) ?? 0));
  const day = datePart(b.start);
  const bookings: ResourceBusyBooking[] = [];
  for (const o of c.bookings) {
    if (o.businessId !== b.businessId || !o.resourceIds.length) continue;
    // Запись дольше суток не бывает: соседние дни — только ради перерыва/ночных смен
    const d = datePart(o.start);
    if (d !== day && d !== datePart(addMinutes(b.start, -24 * 60)) && d !== datePart(addMinutes(b.start, 24 * 60))) continue;
    bookings.push({ id: o.id, start: o.start, durationMin: o.durationMin, resourceIds: o.resourceIds, occupiesTime: occupiesTime(o), bufferAfterMin: bufferOf(o) });
  }
  const events = c.groupEvents
    .filter((e) => e.businessId === b.businessId)
    .map((e) => ({ id: e.id, start: e.start, durationMin: e.durationMin, resourceIds: e.resourceIds, cancelled: e.status !== 'scheduled' }));
  const picked = resolveBookingResources({
    resources,
    locationId: b.locationId,
    requiredServiceIds: opts.requiredServiceIds,
    resourceIds: b.resourceIds,
    start: b.start,
    durationMin: b.durationMin + bufferOf(b),
    bookings,
    events,
    excludeBookingId: opts.excludeBookingId,
  });
  if (!picked) throw new ApiError('resource_unavailable');
  return picked;
}

/**
 * expectedUpdatedAt (F-01-033): окно записи передаёт updatedAt записи, которую загрузило. Если кто-то
 * успел сохранить эту же запись первым, updatedAt в базе уже другой — второе сохранение не затирает
 * первое, а падает с ApiError('conflict') (справка Altegio 360423/360420: «выигрывает первое»).
 * Без параметра (остальные вызовы — статусы, drag&drop и т. п.) проверка не идёт, как раньше.
 */
function txUpdateBooking(id: Id, patch: Partial<Omit<Booking, 'id'>>, expectedUpdatedAt?: ISODateTime): Booking {
  const current = core().bookings.find((b) => b.id === id);
  if (expectedUpdatedAt !== undefined && current && current.updatedAt !== expectedUpdatedAt) throw new ApiError('conflict');
  const now = nowDateTime();
  // В-03: запись заново попала на ответ мастера («Деньги пришли» при подтверждении после оплаты, перенос клиентом у мастера
  // «с подтверждением») — срок ответа отсчитывается с этого момента, а не с создания: иначе confirmDeadlineOf(createdAt)
  // уже прошёл, и releaseExpiredPrepayments тут же снимал бы заявку как «мастер не ответил» (full-test-0930 №2)
  if (current && patch.confirmDeadline === undefined) {
    const next = { ...current, ...patch };
    const entered = next.status === 'awaiting_confirmation' && (current.status !== 'awaiting_confirmation' || next.start !== current.start);
    if (entered) {
      const byWait = addMinutes(now, 120);
      const byStart = addMinutes(next.start, -60);
      patch = { ...patch, confirmDeadline: byWait < byStart ? byWait : byStart };
    }
  }
  return txUpdate('bookings', id, { ...patch, updatedAt: now });
}

/** Id, скрытые модерацией (F-00-168): всё, что не одобрено. Правила видимости получают это множество параметром */
export function moderationHiddenIds(): Set<Id> {
  const platform = readArea('platform') as { moderationItems?: { refId: Id; status: string }[] } | undefined;
  return hiddenByModeration(platform?.moderationItems ?? []);
}

/** Пауза онлайн-записи и отпуск мастера — пока живут в срезе online (F-03-142) */
function onlinePauses(businessId: Id, staffId: Id): { pauseUntil?: ISODate; vacationUntil?: ISODate } {
  const online = readArea('online') as
    | { businessRules?: Record<Id, { pauseUntil?: ISODate }>; staffRules?: Record<Id, { vacationUntil?: ISODate }> }
    | undefined;
  return { pauseUntil: online?.businessRules?.[businessId]?.pauseUntil, vacationUntil: online?.staffRules?.[staffId]?.vacationUntil };
}

export interface PlaceBookingResult {
  booking: Booking;
  /** Карточка клиента бизнеса (найдена или заведена); нет — запись без клиента */
  client?: Client;
}

/**
 * Создать запись по единому потоку (rules/booking-flow): все проверки + клиент + запись — одной записью в базу.
 * opts.isStartOffered — правила слотов раздела schedule для онлайн-записи (см. PlaceBookingContext).
 */
function txPlaceBooking(input: PlaceBookingInput, opts: Pick<PlaceBookingContext, 'isStartOffered'> = {}): PlaceBookingResult {
  const now = nowDateTime();
  const online = isOnlineSource(input.source);
  if (!online) assertCan('journal.create', { targetStaffId: input.staffId });
  const createdBy = online ? 'client' : (input.createdBy ?? currentActor().staffId ?? 'client');
  const c = core();
  const result = planBooking(
    c,
    { ...input, createdBy },
    { now, hiddenIds: moderationHiddenIds(), ...onlinePauses(input.businessId, input.staffId), ...opts },
  );
  if (!result.ok) throw new ApiError(result.code);
  const { plan } = result;

  let client: Client | undefined;
  let clientsPatch: ((list: Client[]) => Client[]) | undefined;
  if (plan.client.kind === 'new') {
    const created: Client = { ...plan.client.client, id: newId('cl') };
    client = created;
    clientsPatch = (list) => [...list, created];
  } else if (plan.client.kind === 'existing') {
    const link = plan.client;
    const found = c.clients.find((cl) => cl.id === link.clientId);
    client = found && link.setAppUserId ? { ...found, appUserId: link.setAppUserId } : found;
    if (link.setAppUserId) {
      clientsPatch = (list) => list.map((cl) => (cl.id === link.clientId ? { ...cl, appUserId: link.setAppUserId } : cl));
    }
  }
  const booking: Booking = {
    ...plan.booking,
    ...(client ? { clientId: client.id } : {}),
    id: newId('bk'),
    total: plan.lines.reduce((sum, l) => sum + l.price * l.qty, 0),
    createdAt: now,
    updatedAt: now,
  };
  // Одна запись в базу: клиент и запись появляются вместе или не появляются вовсе
  setCore((d) => ({ ...d, clients: clientsPatch ? clientsPatch(d.clients) : d.clients, bookings: [...d.bookings, booking] }));
  logBookingChanges([{ next: booking }], createdBy === 'client' ? 'client' : createdBy, now);
  return { booking, client };
}

export interface ClientCancelResult {
  booking: Booking;
  /** Позже срока бесплатной отмены — засчитана неявка (F-00-098) */
  late: boolean;
}

/** Отмена клиентом по правилам ядра (rules/booking-policy). Доступ (владелец записи, хэш ссылки) проверяет вызывающий */
function txCancelByClient(bookingId: Id): ClientCancelResult {
  const now = nowDateTime();
  const c = core();
  const b = c.bookings.find((x) => x.id === bookingId);
  if (!b) throw new ApiError('not_found');
  const rules = effectiveBookingRules(
    c.businesses.find((x) => x.id === b.businessId),
    c.staff.find((x) => x.id === b.staffId),
  );
  const out = clientCancelOutcome(b, rules, now);
  if (!out.allowed) throw new ApiError(out.reason);
  const updated: Booking = {
    ...b,
    status: out.status,
    ...(out.late ? { cancelledLate: true } : {}),
    // В-04: раньше срока предоплату возвращают (напоминание мастеру), позже — остаётся у мастера
    ...(b.prepayment && out.refund > 0 ? { prepayment: { ...b.prepayment, refundDue: out.refund } } : {}),
    updatedAt: now,
  };
  const inc = out.noShowIncrement;
  setCore((d) => ({
    ...d,
    bookings: d.bookings.map((x) => (x.id === b.id ? updated : x)),
    clients:
      inc && b.clientId ? d.clients.map((cl) => (cl.id === b.clientId ? { ...cl, noShowCount: cl.noShowCount + inc } : cl)) : d.clients,
  }));
  logBookingChanges([{ prev: b, next: updated }], 'client', now);
  return { booking: updated, late: out.late };
}

/** Перенос клиентом на другое окно того же мастера (F-00-099): срок, окно по тому же правилу, статус заново */
function txRescheduleByClient(bookingId: Id, newStart: ISODateTime): Booking {
  const now = nowDateTime();
  const c = core();
  const b = c.bookings.find((x) => x.id === bookingId);
  if (!b) throw new ApiError('not_found');
  const staff = c.staff.find((x) => x.id === b.staffId);
  if (!staff) throw new ApiError('not_found');
  const check = canReschedule(b, effectiveBookingRules(c.businesses.find((x) => x.id === b.businessId), staff), now);
  if (!check.allowed) throw new ApiError(check.reason);
  const slot = checkSlot(
    c,
    {
      staffId: b.staffId,
      start: newStart,
      durationMin: b.durationMin,
      bufferAfterMin: bookingBufferAfter(c, b),
      locationId: b.locationId,
      workplace: b.workplace,
      excludeBookingId: b.id,
    },
    now,
  );
  if (!slot.ok) throw new ApiError('slot_taken');
  return txUpdateBooking(b.id, { start: newStart, status: rescheduledStatus(b, staff) });
}

/** Смена статуса с проверкой перехода и счётчиком неявок (F-00-071) — одной записью */
function txChangeBookingStatus(bookingId: Id, status: BookingStatus, actor: StatusActor = 'business'): Booking {
  const c = core();
  const b = c.bookings.find((x) => x.id === bookingId);
  if (!b) throw new ApiError('not_found');
  if (b.status === status) return b;
  if (!canTransition(b.status, status, actor)) throw new ApiError('invalid_transition');
  if (actor === 'business') assertCan('journal.edit', { targetStaffId: b.staffId });
  const delta = noShowDelta(b.status, status);
  // Мастер отменил оплаченную запись — клиенту возвращают предоплату: «Верните клиенту …» (как сервер, bookings.service)
  const owesRefund = status === 'cancelled_by_master' && b.prepayment && prepaidAmount(b) > 0 && !b.prepayment.refundDue && !b.prepayment.refundedAt;
  const updated: Booking = {
    ...b,
    status,
    updatedAt: nowDateTime(),
    ...(owesRefund && b.prepayment ? { prepayment: { ...b.prepayment, refundDue: prepaidAmount(b) } } : {}),
  };
  setCore((d) => ({
    ...d,
    bookings: d.bookings.map((x) => (x.id === b.id ? updated : x)),
    clients:
      delta && b.clientId
        ? d.clients.map((cl) => (cl.id === b.clientId ? { ...cl, noShowCount: Math.max(0, cl.noShowCount + delta) } : cl))
        : d.clients,
  }));
  logBookingChanges([{ prev: b, next: updated }], actor === 'business' ? eventActor() : actor, updated.updatedAt);
  return updated;
}

/** Снять неоплаченные в срок записи (F-00-097): окно освобождается само. Возвращает id снятых */
function txReleaseExpiredPrepayments(filter?: { appUserId?: Id; businessId?: Id }): Id[] {
  const now = nowDateTime();
  const expired = core().bookings.filter(
    (b) =>
      isPrepaymentExpired(b, now) &&
      (!filter?.appUserId || b.appUserId === filter.appUserId) &&
      (!filter?.businessId || b.businessId === filter.businessId),
  );
  // В-03: мастер молчит до срока ответа — заявка снимается (как сервер: «Отменил мастер» + confirmation_expired),
  // клиенту сразу 3 ближайших окна того же мастера (Booking.alternativeStarts) — он записывается в одно нажатие
  const unanswered = core().bookings.filter(
    (b) =>
      !b.deletedAt &&
      b.status === 'awaiting_confirmation' &&
      now >= confirmDeadlineOf(b) &&
      (!filter?.appUserId || b.appUserId === filter.appUserId) &&
      (!filter?.businessId || b.businessId === filter.businessId),
  );
  if (!expired.length && !unanswered.length) return [];
  const ids = new Set(expired.map((b) => b.id));
  // Снята системой: клиенту — «предоплата не поступила вовремя», а не «Отменена вами» (e2e-q2 №1)
  const released = (b: Booking): Booking => ({ ...b, status: 'cancelled_by_client', cancelReason: 'prepayment_expired', updatedAt: now });
  const unansweredIds = new Set(unanswered.map((b) => b.id));
  // Оплаченную предоплату при снятии заявки клиенту возвращают полностью — в записи «Верните клиенту …» (как отмена мастером)
  const dropped = (b: Booking): Booking => ({
    ...b,
    status: 'cancelled_by_master',
    cancelReason: 'confirmation_expired',
    updatedAt: now,
    ...(b.prepayment && prepaidAmount(b) > 0 ? { prepayment: { ...b.prepayment, refundDue: prepaidAmount(b) } } : {}),
  });
  setCore((d) => ({ ...d, bookings: d.bookings.map((b) => (ids.has(b.id) ? released(b) : unansweredIds.has(b.id) ? dropped(b) : b)) }));
  // Окна считаем уже без снятых заявок: их время теперь свободно и тоже может подойти
  if (unanswered.length) {
    const after = core();
    const alt = new Map(unanswered.map((b) => [b.id, nearestFreeStarts(after, b, now)] as const));
    setCore((d) => ({ ...d, bookings: d.bookings.map((b) => (alt.has(b.id) ? { ...b, alternativeStarts: alt.get(b.id) } : b)) }));
  }
  logBookingChanges(
    [...expired.map((b) => ({ prev: b, next: released(b) })), ...unanswered.map((b) => ({ prev: b, next: dropped(b) }))],
    'system',
    now,
  );
  return [...ids, ...unansweredIds];
}

/**
 * «Задерживаюсь» (F-00-059): мастер опаздывает к этой записи на delayMin минут. Запись не меняется — ядро пишет событие
 * 'delayed', клиент видит его в своих уведомлениях (listClientEvents), кабинет — в listBookingEvents. Право — journal.edit
 * (на чужую запись — ещё journal.others).
 */
function txReportDelay(bookingId: Id, delayMin: number): BookingEvent {
  const b = core().bookings.find((x) => x.id === bookingId);
  if (!b || b.deletedAt) throw new ApiError('not_found');
  if (!occupiesTime(b)) throw new ApiError('invalid_transition');
  assertCan('journal.edit', { targetStaffId: b.staffId });
  const event: BookingEvent = {
    id: newId('bev'),
    bookingId: b.id,
    businessId: b.businessId,
    staffId: b.staffId,
    ...(b.clientId ? { clientId: b.clientId } : {}),
    ...(b.appUserId ? { appUserId: b.appUserId } : {}),
    kind: 'delayed',
    delayMin: Math.max(1, Math.round(delayMin)),
    start: b.start,
    by: eventActor(),
    at: nowDateTime(),
  };
  appendBookingEvents([event]);
  return event;
}

export interface BookingEventQuery {
  businessId?: Id;
  businessIds?: Id[];
  staffId?: Id;
  bookingId?: Id;
  clientId?: Id;
  appUserId?: Id;
  kinds?: BookingEventKind[];
  /** Только события позже этого момента (не включая), 'YYYY-MM-DDTHH:mm' */
  since?: ISODateTime;
  /** Только те, что освободили время («окно освободилось», F-00-101) */
  freedOnly?: boolean;
}

function txListBookingEvents(q: BookingEventQuery = {}): BookingEvent[] {
  return (core().bookingEvents ?? []).filter((e) => {
    if (q.businessId && e.businessId !== q.businessId) return false;
    if (q.businessIds && !q.businessIds.includes(e.businessId)) return false;
    if (q.staffId && e.staffId !== q.staffId && e.prevStaffId !== q.staffId) return false;
    if (q.bookingId && e.bookingId !== q.bookingId) return false;
    if (q.clientId && e.clientId !== q.clientId) return false;
    if (q.appUserId && e.appUserId !== q.appUserId) return false;
    if (q.kinds && !q.kinds.includes(e.kind)) return false;
    if (q.since && e.at <= q.since) return false;
    if (q.freedOnly && !e.freed) return false;
    return true;
  });
}

/** Что показать клиенту приложения из событий его записей (e2e-q2 №3б): всё, кроме созданного им самим */
const CLIENT_EVENT_KINDS: BookingEventKind[] = ['created', 'status', 'moved', 'deleted', 'delayed'];

function txListClientEvents(appUserId: Id, opts: { since?: ISODateTime; kinds?: BookingEventKind[] } = {}): BookingEvent[] {
  return txListBookingEvents({ appUserId, since: opts.since, kinds: opts.kinds ?? CLIENT_EVENT_KINDS })
    .filter((e) => e.by !== 'client')
    .reverse();
}

/**
 * Синхронные двойники функций ядра — ТОЛЬКО внутри request() своей api-функции (arch-a1 №1).
 * Бросают ApiError(code), как и async-версии.
 */
export const coreTx = {
  list: txList,
  get: txGet,
  create: txCreate,
  update: txUpdate,
  remove: txRemove,
  createBooking: txCreateBooking,
  updateBooking: txUpdateBooking,
  linkClientForAppUser: txLinkClientForAppUser,
  findClientByPhone: txFindClientByPhone,
  placeBooking: txPlaceBooking,
  cancelByClient: txCancelByClient,
  rescheduleByClient: txRescheduleByClient,
  changeBookingStatus: txChangeBookingStatus,
  releaseExpiredPrepayments: txReleaseExpiredPrepayments,
  reportDelay: txReportDelay,
  listClientEvents: txListClientEvents,
  businessBySlug: txBusinessBySlug,
  uniqueBusinessSlug: txUniqueBusinessSlug,
  listBookingEvents: txListBookingEvents,
  logDataOperation: txLogDataOperation,
  coinBalance: txCoinBalance,
  chargeCoins: txChargeCoins,
  grantCoins: txGrantCoins,
};

// ─────────────────────────── Общие операции ───────────────────────────

/** Список сущностей: coreList('staff', { businessId }) или coreList('bookings', (b) => …) */
export function coreList<C extends CoreCollection>(collection: C, filter?: Filter<CoreEntity<C>>): Promise<CoreEntity<C>[]> {
  return request(() => txList(collection, filter));
}

/** Одна сущность; нет — ApiError('not_found') */
export function coreGet<C extends CoreCollection>(collection: C, id: Id): Promise<CoreEntity<C>> {
  return request(() => txGet(collection, id));
}

export function coreCreate<C extends CoreCollection>(
  collection: C,
  data: Omit<CoreEntity<C>, 'id'> & { id?: Id },
): Promise<CoreEntity<C>> {
  // Режим api (этап 7): записи, групповые события и клиенты живут на сервере — создаются там, в ядро кладёт зеркало
  if (isApiMode() && collection === 'bookings') return J.createBooking(data as unknown as BookingInput) as Promise<CoreEntity<C>>;
  if (isApiMode() && collection === 'groupEvents') return J.createGroupEvent(data as unknown as GroupEventInput) as Promise<CoreEntity<C>>;
  if (isApiMode() && collection === 'clients') return apiCreateClient(data as unknown as Omit<Client, 'id'>) as Promise<CoreEntity<C>>;
  return request(() => txCreate(collection, data));
}

/** Клиент из окна записи/пакета (режим api): карточка на сервере (этап 5), в ядро — зеркало */
async function apiCreateClient(data: Omit<Client, 'id'>): Promise<Client> {
  const C = await import('@/api/clients/clients.server');
  try {
    const row = await C.createClient(data.businessId, { name: data.name, phone: data.phone, email: data.email, gender: data.gender, tags: data.tags ?? [], birthday: data.birthday });
    return core().clients.find((c) => c.id === row.id) ?? { ...data, id: row.id };
  } catch (e) {
    // Номер уже есть в базе (F-00-128) — окно записи ждёт найденного клиента, а не второй карточки
    const existingId = (e as { existingClientId?: Id }).existingClientId;
    if (existingId) {
      const row = await C.getClientRow(data.businessId, existingId);
      return core().clients.find((c) => c.id === row.id) ?? { ...data, id: row.id };
    }
    throw e;
  }
}

export function coreUpdate<C extends CoreCollection>(
  collection: C,
  id: Id,
  patch: Partial<CoreEntity<C>>,
): Promise<CoreEntity<C>> {
  if (isApiMode() && collection === 'bookings') return J.updateBooking(id, patch as Partial<Booking>) as Promise<CoreEntity<C>>;
  if (isApiMode() && collection === 'groupEvents') return J.updateGroupEvent(id, patch as Partial<GroupEvent>) as Promise<CoreEntity<C>>;
  return request(() => txUpdate(collection, id, patch));
}

export function coreRemove<C extends CoreCollection>(collection: C, id: Id): Promise<void> {
  return request(() => txRemove(collection, id));
}

// ─────────────────────────── Общие ключи чтения ядра (arch-a1 S1) ───────────────────────────

/** Фильтр-объект для ключа: только простые поля ({ businessId }, { staffId, status }) — функцию в ключ не положить */
export type CoreListFilter<C extends CoreCollection> = Partial<CoreEntity<C>>;

/**
 * Ключи чтения ядра — ОДНИ на всё приложение (docs/STATE.md: «один ключ = одна функция чтения»). Услуги бизнеса,
 * сотрудники, филиалы из журнала, графика и онлайн-записи — один кэш, а не три копии под ключами разделов.
 */
export const coreKeys = {
  list: <C extends CoreCollection>(collection: C, filter?: CoreListFilter<C>) => ['core', collection, 'list', filter ?? {}] as const,
  get: (collection: CoreCollection, id: Id | undefined) => ['core', collection, 'get', id ?? ''] as const,
};

/**
 * Список сущностей ядра в экране: const staff = useCoreList('staff', { businessId }, { enabled: Boolean(businessId) }).
 * Смена фильтра (другой бизнес) — без показа прежних данных (keepPrevious: false по умолчанию).
 */
export function useCoreList<C extends CoreCollection>(
  collection: C,
  filter?: CoreListFilter<C>,
  options?: QueryOptions,
): QueryResult<CoreEntity<C>[]> {
  return useApiQuery(coreKeys.list(collection, filter), () => coreList(collection, filter), { keepPrevious: false, ...options });
}

/** Одна сущность ядра: const q = useCoreGet('services', serviceId) — без id не грузится */
export function useCoreGet<C extends CoreCollection>(collection: C, id: Id | undefined, options?: QueryOptions): QueryResult<CoreEntity<C>> {
  return useApiQuery(coreKeys.get(collection, id), () => coreGet(collection, id ?? ''), {
    keepPrevious: false,
    ...options,
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}

// ─────────────────────────── Бизнес ───────────────────────────

/** Бизнес по адресу /b/<slug>. Принимает и закодированный адрес из params (кириллица → %D0…), и старый нелатинский slug */
export function getBusinessBySlug(slug: string): Promise<Business> {
  return request(() => {
    const found = txBusinessBySlug(slug);
    if (!found) throw new ApiError('not_found', `Бизнес «${slug}» не найден`);
    return found;
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function txBusinessBySlug(slug: string): Business | undefined {
  const decoded = safeDecode(slug);
  const list = core().businesses;
  return (
    list.find((b) => b.slug === slug || b.slug === decoded) ??
    // Салон, заведённый до slugify() с кириллицей в адресе: сравниваем латинские формы
    list.find((b) => slugify(b.slug) === slugify(decoded))
  );
}

/** Свободный адрес для нового бизнеса: slugify(name) + -2, -3… (e2e-q1 №9). Звать внутри request() */
function txUniqueBusinessSlug(name: string): string {
  const base = slugify(name) || 'business';
  const taken = new Set(core().businesses.map((b) => b.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Свободный латинский адрес /b/<slug> для нового бизнеса по названию */
export function uniqueBusinessSlug(name: string): Promise<string> {
  return request(() => txUniqueBusinessSlug(name));
}

// ─────────────────────────── Записи ───────────────────────────

export interface BookingQuery {
  businessId?: Id;
  businessIds?: Id[];
  locationId?: Id;
  staffId?: Id;
  clientId?: Id;
  appUserId?: Id;
  /** Дата начала включительно, 'YYYY-MM-DD' */
  from?: ISODate;
  /** Дата конца включительно */
  to?: ISODate;
  statuses?: BookingStatus[];
  includeDeleted?: boolean;
  /** Только участники этого группового события */
  groupEventId?: Id;
}

export function listBookings(q: BookingQuery = {}): Promise<Booking[]> {
  if (isApiMode()) return J.listBookings(q);
  return request(() =>
    core()
      .bookings.filter((b) => {
        if (!q.includeDeleted && b.deletedAt) return false;
        if (q.businessId && b.businessId !== q.businessId) return false;
        if (q.businessIds && !q.businessIds.includes(b.businessId)) return false;
        if (q.locationId && b.locationId !== q.locationId) return false;
        if (q.staffId && b.staffId !== q.staffId && !b.services.some((s) => s.staffId === q.staffId)) return false;
        if (q.clientId && b.clientId !== q.clientId) return false;
        if (q.appUserId && b.appUserId !== q.appUserId) return false;
        const day = datePart(b.start);
        if (q.from && day < q.from) return false;
        if (q.to && day > q.to) return false;
        if (q.statuses && !q.statuses.includes(b.status)) return false;
        if (q.groupEventId && b.groupEventId !== q.groupEventId) return false;
        return true;
      })
      .sort((a, b) => a.start.localeCompare(b.start)),
  );
}

export type BookingInput = Omit<Booking, 'id' | 'total' | 'durationMin' | 'createdAt' | 'updatedAt'> & {
  durationMin?: number;
};

/** Карточка клиента бизнеса для пользователя приложения — найти или завести (F-00-128) */
export function ensureClientForAppUser(businessId: Id, appUserId: Id): Promise<Client | undefined> {
  // Режим api: карточку клиента для пользователя приложения заводит сервер при записи (F-00-128) — здесь только зеркало
  if (isApiMode()) return Promise.resolve(core().clients.find((cl) => cl.businessId === businessId && cl.appUserId === appUserId));
  return request(() => {
    const id = txLinkClientForAppUser(businessId, appUserId);
    return id ? core().clients.find((cl) => cl.id === id) : undefined;
  });
}

/**
 * Создать запись «как есть»: сумма и длительность считаются по строкам услуг; из проверок — только ресурсы
 * (txResolveResources: занятый аппарат не отдаётся второй записи).
 * Для записи клиентом и из журнала — placeBooking() (все правила ядра). Есть appUserId без clientId —
 * запись сама привязывается к карточке клиента этого бизнеса по номеру (F-00-128, F-00-093).
 */
export function createBooking(input: BookingInput): Promise<Booking> {
  if (isApiMode()) return J.createBooking(input);
  return request(() => {
    const durationMin = input.durationMin ?? input.services.reduce((sum, s) => sum + s.durationMin * s.qty, 0);
    const resourceIds = txResolveResources({ ...input, durationMin }, { requiredServiceIds: input.services.map((l) => l.serviceId) });
    return txCreateBooking({ ...input, resourceIds });
  });
}

/**
 * ЕДИНЫЙ поток записи (arch-a1 №4) для приложения ('app'), ссылки/виджета ('link' | 'widget') и журнала
 * ('journal' | 'phone'): окно по длительности «от–до» и запасам, статус по правилам мастера (выезд — всегда
 * подтверждение), предоплата со сроком, клиент по номеру — одним запросом. Ошибки — ApiError(code), тексты —
 * common.bookingErrors.<code> (slot_taken, outside_hours, client_blocked, accepts_mismatch, online_paused…).
 * Журнал: нужно право journal.create (иначе 'forbidden').
 */
export function placeBooking(input: PlaceBookingInput): Promise<PlaceBookingResult> {
  if (isApiMode()) return J.placeBooking(input);
  return request(() => txPlaceBooking(input));
}

/**
 * expectedUpdatedAt (F-01-033): передайте updatedAt записи, которую окно загрузило, чтобы отловить
 * одновременное сохранение — вторым вызовом придёт ApiError('conflict') (common.bookingErrors.conflict).
 * Без параметра ведёт себя как раньше — последняя запись побеждает.
 */
export function updateBooking(id: Id, patch: Partial<Omit<Booking, 'id'>>, expectedUpdatedAt?: ISODateTime): Promise<Booking> {
  if (isApiMode()) return J.updateBooking(id, patch, expectedUpdatedAt);
  return request(() => {
    // Перенос, смена длительности, услуг или ресурсов — ресурсы на новое время проверяются (F-16-012); смена статуса — нет.
    // Сами берутся только ресурсы НОВЫХ услуг: старая запись не получает задним числом ресурс, привязанный позже (F-16-014).
    const current = core().bookings.find((b) => b.id === id);
    if (current && (patch.start !== undefined || patch.durationMin !== undefined || patch.services !== undefined || patch.resourceIds !== undefined)) {
      const next = { ...current, ...patch };
      const had = new Set(current.services.map((l) => l.serviceId));
      const requiredServiceIds = next.services.map((l) => l.serviceId).filter((sid) => !had.has(sid));
      const resourceIds = txResolveResources(next, { excludeBookingId: id, requiredServiceIds });
      if (resourceIds.length !== next.resourceIds.length || resourceIds.some((r, i) => r !== next.resourceIds[i])) patch = { ...patch, resourceIds };
    }
    return txUpdateBooking(id, patch, expectedUpdatedAt);
  });
}

/** Поставить статус без проверок (как раньше). С проверкой перехода и счётчиком неявок — changeBookingStatus() */
export function setBookingStatus(id: Id, status: BookingStatus): Promise<Booking> {
  return updateBooking(id, { status });
}

/**
 * Сменить статус по правилам ядра: допустимый переход (rules/booking-status canTransition), +1/−1 к неявкам клиента
 * при входе/выходе из «Не пришёл» (F-00-071). Сотрудник — право journal.edit (на чужую запись — ещё journal.others).
 */
export function changeBookingStatus(id: Id, status: BookingStatus, actor: StatusActor = 'business'): Promise<Booking> {
  if (isApiMode()) return J.changeBookingStatus(id, status, actor);
  return request(() => txChangeBookingStatus(id, status, actor));
}

/**
 * Клиент отменяет свою запись в приложении (F-00-098): раньше срока — бесплатно, позже — «Отменил клиент» + неявка.
 * Чужую запись — 'not_found'. Ссылка без входа (online) зовёт coreTx.cancelByClient после проверки хэша.
 */
export function cancelBookingAsClient(bookingId: Id, appUserId: Id): Promise<ClientCancelResult> {
  // Режим api: «только своя запись» и срок отмены (В-04) проверяет сервер по сессии
  if (isApiMode()) return J.cancelAsClient(bookingId);
  return request(() => {
    const b = core().bookings.find((x) => x.id === bookingId);
    if (!b || b.appUserId !== appUserId) throw new ApiError('not_found');
    return txCancelByClient(bookingId);
  });
}

/** Клиент переносит свою запись (F-00-099): до срока переноса, на свободное по правилам ядра окно */
export function rescheduleBookingAsClient(bookingId: Id, appUserId: Id, newStart: ISODateTime): Promise<Booking> {
  if (isApiMode()) return J.rescheduleAsClient(bookingId, newStart);
  return request(() => {
    const b = core().bookings.find((x) => x.id === bookingId);
    if (!b || b.appUserId !== appUserId) throw new ApiError('not_found');
    return txRescheduleByClient(bookingId, newStart);
  });
}

/** Снять просроченные неоплаченные записи (F-00-097). Звать перед чтением «Моих записей»/заявок */
export function releaseExpiredPrepayments(filter?: { appUserId?: Id; businessId?: Id }): Promise<Id[]> {
  // Режим api: снимает сервер — воркер каждую минуту (B13, В-03, В-05); экрану снимать нечего
  if (isApiMode()) return Promise.resolve([]);
  return request(() => txReleaseExpiredPrepayments(filter));
}

/** Мягкое удаление (F-01-119) */
export function deleteBooking(id: Id): Promise<Booking> {
  if (isApiMode()) return J.removeBooking(id);
  return updateBooking(id, { deletedAt: nowDateTime() });
}

/**
 * Журнал событий записей, старые → новые (e2e-q1 №3): создана / статус / перенесена / удалена, кто и когда,
 * и освободившееся время (freed). Для уведомлений («клиент не пришёл», «отмена»), колокольчика и листа ожидания:
 *   listBookingEvents({ businessId, kinds: ['status'], since })   // что нового с прошлого раза
 *   listBookingEvents({ businessId, freedOnly: true, since })     // какие окна освободились
 */
export function listBookingEvents(q: BookingEventQuery = {}): Promise<BookingEvent[]> {
  if (isApiMode()) return J.listBookingEvents(q);
  return request(() => txListBookingEvents(q));
}

/** Мастер задерживается к записи bookingId на delayMin минут (F-00-059) — событие 'delayed' для клиента и кабинета */
export function reportBookingDelay(bookingId: Id, delayMin: number): Promise<BookingEvent> {
  if (isApiMode()) return J.reportDelay(bookingId, delayMin);
  return request(() => txReportDelay(bookingId, delayMin));
}

/**
 * Лента клиента приложения из событий его записей, НОВЫЕ → старые (e2e-q2 №3б, F-00-059): салон подтвердил, отменил,
 * перенёс, удалил запись, мастер задерживается ('delayed', delayMin); снятие неоплаченной — status с reason
 * 'prepayment_expired'. Свои действия клиента (by 'client') не попадают. Слова — у раздела client.
 *   useApiQuery(['client', 'events', appUserId], () => listClientEvents(appUserId), { enabled: Boolean(appUserId) })
 */
export function listClientEvents(appUserId: Id, opts: { since?: ISODateTime; kinds?: BookingEventKind[] } = {}): Promise<BookingEvent[]> {
  if (isApiMode()) return J.listClientEvents(opts);
  return request(() => txListClientEvents(appUserId, opts));
}

/** Конец записи (то же — bookingEnd из @/domain/rules) */
export function bookingEnd(b: Pick<Booking, 'start' | 'durationMin'>): string {
  return addMinutes(b.start, b.durationMin);
}

// ─────────────────────────── Групповые события (F-01-035, F-01-193…200) ───────────────────────────

export interface GroupEventQuery {
  businessId?: Id;
  businessIds?: Id[];
  locationId?: Id;
  staffId?: Id;
  serviceId?: Id;
  /** Дата начала включительно, 'YYYY-MM-DD' */
  from?: ISODate;
  /** Дата конца включительно */
  to?: ISODate;
  /** По умолчанию отменённые тоже в списке — фильтруйте сами или передайте ['scheduled'] */
  statuses?: GroupEvent['status'][];
}

/** События по фильтру, по времени начала. Участники — listBookings({ groupEventId }) */
export function listGroupEvents(q: GroupEventQuery = {}): Promise<GroupEvent[]> {
  if (isApiMode()) return J.listGroupEvents(q);
  return request(() =>
    core()
      .groupEvents.filter((e) => {
        if (q.businessId && e.businessId !== q.businessId) return false;
        if (q.businessIds && !q.businessIds.includes(e.businessId)) return false;
        if (q.locationId && e.locationId !== q.locationId) return false;
        if (q.staffId && e.staffId !== q.staffId) return false;
        if (q.serviceId && e.serviceId !== q.serviceId) return false;
        const day = datePart(e.start);
        if (q.from && day < q.from) return false;
        if (q.to && day > q.to) return false;
        if (q.statuses && !q.statuses.includes(e.status)) return false;
        return true;
      })
      .sort((a, b) => a.start.localeCompare(b.start)),
  );
}

export type GroupEventInput = Omit<GroupEvent, 'id' | 'createdAt' | 'status'> & { status?: GroupEvent['status'] };

export function createGroupEvent(input: GroupEventInput): Promise<GroupEvent> {
  if (isApiMode()) return J.createGroupEvent(input);
  return request(() => {
    const event: GroupEvent = { ...input, status: input.status ?? 'scheduled', id: newId('ev'), createdAt: nowDateTime() };
    setCore((c) => ({ ...c, groupEvents: [...c.groupEvents, event] }));
    return event;
  });
}

export function updateGroupEvent(id: Id, patch: Partial<Omit<GroupEvent, 'id' | 'createdAt'>>): Promise<GroupEvent> {
  if (isApiMode()) return J.updateGroupEvent(id, patch);
  return coreUpdate('groupEvents', id, patch);
}

// ─────────────────────────── Клиенты ───────────────────────────

/** Клиент бизнеса по номеру (ключ — телефон, F-00-128) */
export function findClientByPhone(businessId: Id, phone: string): Promise<Client | undefined> {
  if (isApiMode()) return apiFindClientByPhone(businessId, phone);
  return request(() => txFindClientByPhone(businessId, phone));
}

/** Режим api: клиенты не все в зеркале (K8) — ищем на сервере (поиск CRM, этап 5), найденный кладётся в зеркало */
async function apiFindClientByPhone(businessId: Id, phone: string): Promise<Client | undefined> {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  const mirrored = core().clients.find((c) => c.businessId === businessId && c.phone === normalized && !c.deletedAt);
  if (mirrored) return mirrored;
  const C = await import('@/api/clients/clients.server');
  const page = await C.listClients({ businessId, search: normalized.slice(4), page: 1, pageSize: 20 } as Parameters<typeof C.listClients>[0]);
  const row = page.rows.find((r) => r.phone === normalized);
  return row ? core().clients.find((c) => c.id === row.id) : undefined;
}

// ─────────────────────────── Операции с данными (F-04-126, F-04-130, F-04-206) ───────────────────────────

const MAX_DATA_OPS = 500;

export type DataOperationInput = Omit<DataOperation, 'id' | 'by' | 'at'> & { by?: DataOperation['by'] };

/** Записать операцию в общий журнал — внутри того же request(), что и сама операция (импорт упал — записи не будет) */
function txLogDataOperation(input: DataOperationInput): DataOperation {
  const actor = currentActor();
  const op: DataOperation = { ...input, id: newId('dop'), by: input.by ?? actor.staffId ?? 'system', at: nowDateTime() };
  setCore((d) => {
    const list = [...(d.dataOps ?? []), op];
    return { ...d, dataOps: list.length > MAX_DATA_OPS ? list.slice(-MAX_DATA_OPS) : list };
  });
  return op;
}

/**
 * Отдельная запись в журнал — для выгрузки, которая сама в базу не пишет:
 *   await logDataOperation({ businessId, kind: 'export', area: 'clients', entity: 'clients', count: rows.length, fileName })
 * Импорт пишет в ТОМ ЖЕ request(): request(() => { …; coreTx.logDataOperation({ kind: 'import', … }); })
 */
export function logDataOperation(input: DataOperationInput): Promise<DataOperation> {
  return request(() => txLogDataOperation(input));
}

/** Журнал «Операции с данными» бизнеса, новые → старые; фильтр по виду и разделу */
export function listDataOperations(q: { businessId: Id; kinds?: DataOperation['kind'][]; area?: string }): Promise<DataOperation[]> {
  return request(() =>
    (core().dataOps ?? [])
      .filter((o) => o.businessId === q.businessId && (!q.kinds || q.kinds.includes(o.kind)) && (!q.area || o.area === q.area))
      .reverse(),
  );
}

// ─────────────────────────── Монеты бизнеса (e2e-q3 №3) ───────────────────────────

const MAX_COIN_MOVES = 2000;

export interface CoinMoveInput {
  businessId: Id;
  /** Сколько монет, положительное число (знак ставит функция) */
  amount: number;
  reason: string;
  area: string;
  refId?: Id;
}

function txCoinBalance(businessId: Id): number {
  return (core().coinLedger ?? []).reduce((sum, m) => (m.businessId === businessId ? sum + m.amount : sum), 0);
}

function appendCoinMove(input: CoinMoveInput, kind: CoinMove['kind'], sign: 1 | -1): CoinMove {
  const amount = Math.round(Math.abs(input.amount));
  if (!amount) throw new ApiError('invalid_amount');
  const move: CoinMove = {
    ...input,
    amount: sign * amount,
    kind,
    id: newId('coin'),
    by: currentActor().staffId ?? 'system',
    at: nowDateTime(),
  };
  setCore((d) => {
    const list = [...(d.coinLedger ?? []), move];
    return { ...d, coinLedger: list.length > MAX_COIN_MOVES ? list.slice(-MAX_COIN_MOVES) : list };
  });
  return move;
}

/** Списать монеты (покупка сторис, новости…): не хватает — ApiError('not_enough_coins'), текст common.coinErrors.* */
function txChargeCoins(input: CoinMoveInput): CoinMove {
  if (txCoinBalance(input.businessId) < Math.abs(input.amount)) throw new ApiError('not_enough_coins');
  return appendCoinMove(input, 'charge', -1);
}

/** Начислить монеты: пополнение ('topup'), возврат ('refund'), подарок платформы ('gift') */
function txGrantCoins(input: CoinMoveInput & { kind?: Exclude<CoinMove['kind'], 'charge'> }): CoinMove {
  const { kind = 'topup', ...rest } = input;
  return appendCoinMove(rest, kind, 1);
}

/** Баланс монет бизнеса = сумма журнала: useApiQuery(['coins', 'balance', businessId], () => getCoinBalance(businessId)) */
export function getCoinBalance(businessId: Id): Promise<number> {
  // Живой сайт (этап 18): журнал монет на сервере (06 §2.2) — баланс оттуда
  if (isApiMode()) {
    trackRead('areas.settings');
    return http<{ balance: number }>('GET', `/v1/biz/${businessId}/coins`).then((r) => r.balance);
  }
  return request(() => txCoinBalance(businessId));
}

/** Движения монет бизнеса, НОВЫЕ → старые; фильтр по разделу и виду */
export function listCoinMoves(q: { businessId: Id; area?: string; kinds?: CoinMove['kind'][] }): Promise<CoinMove[]> {
  if (isApiMode()) {
    trackRead('areas.settings');
    return http<CoinMove[]>('GET', `/v1/biz/${q.businessId}/coins/entries`, undefined, { query: { area: q.area, kinds: q.kinds?.join(',') } });
  }
  return request(() =>
    (core().coinLedger ?? [])
      .filter((m) => m.businessId === q.businessId && (!q.area || m.area === q.area) && (!q.kinds || q.kinds.includes(m.kind)))
      .reverse(),
  );
}

// ─────────────────────────── Права ───────────────────────────

/** Права, выставленные владельцем конкретному администратору; undefined — по умолчанию персоны */
export function getStaffPermissions(staffId: Id): Promise<Permission[] | undefined> {
  return request(() => useDb.getState().access.staffPermissions[staffId]);
}

export function setStaffPermissions(staffId: Id, permissions: Permission[]): Promise<void> {
  return request(() => {
    useDb.getState().setAccess((a) => ({ staffPermissions: { ...a.staffPermissions, [staffId]: permissions } }));
  });
}

/** Кто делает запрос (в демо — персона из cookie; на сервере — сессия) */
export interface Actor {
  persona: PersonaId;
  staffId?: Id;
  businessId?: Id;
  appUserId?: Id;
  permissions: ReadonlySet<Permission>;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pair = document.cookie.split('; ').find((p) => p.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

/** Текущий пользователь вне React — для проверки прав внутри request() (arch-a1 №8) */
export function currentActor(): Actor {
  const rawPersona = readCookie(DEMO_COOKIES.persona);
  const rawSphere = readCookie(DEMO_COOKIES.sphere);
  const persona = isValidDemoValue('persona', rawPersona) ? (rawPersona as PersonaId) : DEFAULT_DEMO.persona;
  const sphere = isValidDemoValue('sphere', rawSphere) ? (rawSphere as SphereId) : DEFAULT_DEMO.sphere;
  const ctx = resolveDemoContext(persona, sphere, core());
  const overrides = ctx.staffId ? useDb.getState().access.staffPermissions[ctx.staffId] : undefined;
  // Живой сайт: права вошедшего считает сервер (docs/backend/03 §2)
  const server = apiIdentity();
  const bizPersona = persona !== 'client' && persona !== 'guest' && persona !== 'platform';
  return {
    persona,
    staffId: ctx.staffId,
    businessId: ctx.businessId,
    appUserId: ctx.appUserId,
    permissions: server && bizPersona ? new Set(server.permissions) : permissionsOf(persona, overrides),
  };
}

/** Есть ли право у текущего пользователя (rules/permissions canWith) */
export function canNow(permission: Permission, ctx: Omit<PermissionContext, 'overrides' | 'actorStaffId'> = {}): boolean {
  const actor = currentActor();
  return canWith(actor.permissions, permission, { actorStaffId: actor.staffId, ...ctx });
}

/**
 * Проверка права ВНУТРИ request() api-функции: нет права — ApiError('forbidden') (текст — common.states.forbidden).
 *   export const exportClients = (businessId: Id) => request(() => { assertCan('clients.export'); … });
 */
export function assertCan(permission: Permission, ctx: Omit<PermissionContext, 'overrides' | 'actorStaffId'> = {}): void {
  if (!canNow(permission, ctx)) throw new ApiError('forbidden', `Нет права ${permission}`);
}

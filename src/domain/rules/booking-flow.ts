/**
 * ОДИН ПОТОК СОЗДАНИЯ ЗАПИСИ для приложения клиента, ссылки/виджета и журнала (F-00-092, F-03-093, F-01-024,
 * arch-a1 №4). Чистая часть: проверяет всё и собирает готовую запись; пишет в базу placeBooking() из src/api/core.ts
 * одним request() (атомарно). Сервер повторит это как есть.
 *
 * Что проверяется (порядок = порядок ошибок):
 *  1. мастер и бизнес существуют (not_found);
 *  2. услуги существуют, принадлежат бизнесу, активны; онлайн — ещё открыты для записи и назначены мастеру
 *     (service_unavailable);
 *  3. онлайн: видимость мастера (rules/visibility — модерация, выключенная онлайн-запись, пустой профиль) и
 *     canBookOnline (пауза, отпуск, блокировка клиента, «кого принимаю»);
 *  4. клиент: карточка по clientId → по appUserId → по номеру; номер неверный — invalid_phone;
 *  5. окно: длительность «от–до» по верхней границе + запас услуги (rules/pricing, rules/busy checkSlot);
 *     онлайн — часы, прошлое и занятость; журнал — только занятость (двойная запись невозможна, F-00-045),
 *     вне часов/в прошлом — можно (журнал предупреждает сам, F-01-215);
 *  6. групповое событие: окно не проверяется (время держит событие), но места считаются (group_full);
 *  7. статус — newBookingStatus (выезд всегда с подтверждением), предоплата с holdUntil.
 */
import type {
  AppUser,
  BookingForWhom,
  BookingServiceLine,
  BookingSource,
  BookingStatus,
  Client,
  CoreData,
  ISODate,
  ISODateTime,
  Id,
  Money,
  Workplace,
  Booking,
} from '@/domain/core';
import { datePart } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import { isOnlineSource, occupiesTime } from '@/domain/rules/booking-status';
import {
  canBookOnline,
  newBookingStatus,
  normalizeNoShowRule,
  prepaymentNeed,
  recentNoShows,
  requiresPrepayment,
  type OnlineBookingDenied,
} from '@/domain/rules/booking-policy';
import { bookingBufferAfter, checkSlot } from '@/domain/rules/busy';
import { canPayInFull, hasExactPrice, linesDuration, makeServiceLine, prepaymentAmount, prepaymentHoldUntil } from '@/domain/rules/pricing';
import { isOwnClient, isServiceBookableOnline, staffClientVisibility } from '@/domain/rules/visibility';
import { checkInstancesFree, pickFreeInstances, type ResourceBusyBooking, type ResourceBusyEvent } from '@/domain/resources';

export interface PlaceBookingLine {
  serviceId: Id;
  /** Мастер строки (по умолчанию — главный мастер записи) */
  staffId?: Id;
  qty?: number;
  discountPct?: number;
  /** Цена до скидки вручную (журнал); по умолчанию — нижняя граница «от–до» */
  unitPrice?: Money;
  /** ⭐ Допродажа: строка — сопутствующая к этой услуге (ставит api из addOns по списку услуги) */
  upsellOf?: Id;
}

export interface PlaceBookingClient {
  /** Карточка клиента бизнеса (журнал) */
  clientId?: Id;
  /** Пользователь приложения — карточка найдётся/заведётся по номеру (F-00-128) */
  appUserId?: Id;
  /** Номер и имя из формы виджета/журнала */
  phone?: string;
  name?: string;
}

export interface PlaceBookingInput {
  source: BookingSource;
  businessId: Id;
  staffId: Id;
  /** 'YYYY-MM-DDTHH:mm'; для группового события берётся начало события */
  start: ISODateTime;
  services: PlaceBookingLine[];
  locationId?: Id;
  /** Где оказывается услуга; нет — место из графика (обычно салон) */
  workplace?: Workplace;
  /** Нет — запись без клиента (только журнал, F-01-039) */
  client?: PlaceBookingClient;
  forWhom?: BookingForWhom;
  visitorName?: string;
  comment?: string;
  groupEventId?: Id;
  resourceIds?: Id[];
  staffAssignment?: Booking['staffAssignment'];
  /** Кто создал: id сотрудника; для онлайн-источников всегда 'client' */
  createdBy?: Id | 'client';
  /** Журнал: явный статус (например, «Пришёл» для записи задним числом); онлайн — игнорируется */
  status?: BookingStatus;
  seriesId?: Id;
  visitId?: Id;
  /** ⭐ Клиент выбрал «Оплатить всё сразу» вместо процента предоплаты мастера (онлайн) */
  payInFull?: boolean;
}

export interface PlaceBookingContext {
  now: ISODateTime;
  /** Скрытые модерацией id (rules/visibility hiddenByModeration) */
  hiddenIds?: ReadonlySet<Id>;
  /** Пауза онлайн-записи локации и отпуск мастера (срез online) */
  pauseUntil?: ISODate;
  vacationUntil?: ISODate;
  /**
   * Правила слотов раздела schedule (сетка, «время до визита», недоступные дни, ресурсы) — только для онлайн-записи:
   * «это начало вообще предлагалось клиенту?». Вызывающий передаёт, например,
   *   (q) => computeFreeSlots(readCore(), q).some((s) => s.start === q.start)
   * Нет — проверяются только правила ядра (часы, занятость, запасы, прошлое).
   */
  isStartOffered?: (q: OfferedSlotQuery) => boolean;
}

export interface OfferedSlotQuery {
  staffId: Id;
  date: ISODate;
  start: ISODateTime;
  durationMin: number;
  bufferAfterMin: number;
  locationId?: Id;
  serviceId?: Id;
}

export type PlaceBookingError =
  | 'not_found'
  | 'service_unavailable'
  | 'staff_hidden'
  | 'invalid_phone'
  | 'client_required'
  | 'slot_taken'
  | 'outside_hours'
  | 'group_full'
  | 'resource_unavailable'
  | OnlineBookingDenied;

/** Как привязать клиента при записи в базу */
export type ClientLink =
  | { kind: 'none' }
  | { kind: 'existing'; clientId: Id; setAppUserId?: Id }
  | { kind: 'new'; client: Omit<Client, 'id'> };

export interface BookingPlan {
  /** Запись без id/total/createdAt — их ставит ядро при записи */
  booking: Omit<Booking, 'id' | 'total' | 'createdAt' | 'updatedAt'>;
  client: ClientLink;
  lines: BookingServiceLine[];
}

export type PlaceBookingResult = { ok: true; plan: BookingPlan } | { ok: false; code: PlaceBookingError };

const fail = (code: PlaceBookingError): PlaceBookingResult => ({ ok: false, code });

/** Записи ядра, урезанные под движок занятости ресурсов (src/domain/resources.ts) */
function resourceBusyBookings(core: CoreData): ResourceBusyBooking[] {
  return core.bookings.map((b) => ({
    id: b.id,
    start: b.start,
    durationMin: b.durationMin,
    resourceIds: b.resourceIds,
    occupiesTime: occupiesTime(b),
    bufferAfterMin: bookingBufferAfter(core, b),
  }));
}

/** Групповые события ядра, урезанные под тот же движок */
function resourceBusyEvents(core: CoreData): ResourceBusyEvent[] {
  return core.groupEvents.map((e) => ({ id: e.id, start: e.start, durationMin: e.durationMin, resourceIds: e.resourceIds, cancelled: e.status !== 'scheduled' }));
}

/** Найти карточку клиента бизнеса (удалённые не считаются) */
function findClient(core: CoreData, businessId: Id, pred: (c: Client) => boolean): Client | undefined {
  return core.clients.find((c) => c.businessId === businessId && !c.deletedAt && pred(c));
}

/** Проверить запрос и собрать запись. Ничего не пишет. */
export function planBooking(core: CoreData, input: PlaceBookingInput, ctx: PlaceBookingContext): PlaceBookingResult {
  const online = isOnlineSource(input.source);
  const staff = core.staff.find((s) => s.id === input.staffId && s.businessId === input.businessId);
  const business = core.businesses.find((b) => b.id === input.businessId);
  if (!staff || !business) return fail('not_found');
  if (!input.services.length && !input.groupEventId) return fail('service_unavailable');

  // 2. Услуги
  const services = [];
  for (const line of input.services) {
    const svc = core.services.find((s) => s.id === line.serviceId && s.businessId === input.businessId);
    if (!svc || !svc.active) return fail('service_unavailable');
    if (online) {
      const lineStaff = line.staffId ?? staff.id;
      const assigned = svc.staffIds.includes(lineStaff) || core.staff.find((s) => s.id === lineStaff)?.serviceIds.includes(svc.id);
      if (!isServiceBookableOnline(svc, { hiddenIds: ctx.hiddenIds }) || !assigned) return fail('service_unavailable');
    }
    services.push({ svc, line });
  }

  // 4. Клиент
  let client: Client | undefined;
  let appUser: AppUser | undefined;
  let link: ClientLink = { kind: 'none' };
  const who = input.client;
  if (who?.clientId) {
    client = findClient(core, input.businessId, (c) => c.id === who.clientId);
    if (!client) return fail('not_found');
    link = { kind: 'existing', clientId: client.id };
  } else if (who?.appUserId) {
    appUser = core.appUsers.find((u) => u.id === who.appUserId);
    if (!appUser) return fail('not_found');
    const phone = normalizePhone(appUser.phone) ?? appUser.phone;
    client =
      findClient(core, input.businessId, (c) => c.appUserId === appUser!.id) ??
      findClient(core, input.businessId, (c) => c.phone === phone);
    link = client
      ? { kind: 'existing', clientId: client.id, ...(client.appUserId ? {} : { setAppUserId: appUser.id }) }
      : {
          kind: 'new',
          client: {
            businessId: input.businessId,
            phone,
            name: appUser.name,
            gender: appUser.gender,
            birthday: appUser.birthday,
            tags: [],
            appUserId: appUser.id,
            noShowCount: 0,
            createdAt: ctx.now,
          },
        };
  } else if (who?.phone) {
    const phone = normalizePhone(who.phone);
    if (!phone) return fail('invalid_phone');
    client = findClient(core, input.businessId, (c) => c.phone === phone);
    // Имя из формы не перетирает имя, заданное мастером (F-03-125): оно уходит в visitorName записи
    link = client
      ? { kind: 'existing', clientId: client.id }
      : {
          kind: 'new',
          client: {
            businessId: input.businessId,
            phone,
            name: who.name?.trim() || phone,
            gender: 'unknown',
            tags: [],
            noShowCount: 0,
            createdAt: ctx.now,
          },
        };
  } else if (online) {
    return fail('client_required');
  }

  // 3. Можно ли записаться онлайн
  const event = input.groupEventId ? core.groupEvents.find((e) => e.id === input.groupEventId) : undefined;
  if (input.groupEventId && (!event || event.status !== 'scheduled' || event.businessId !== input.businessId)) return fail('not_found');
  const start = event?.start ?? input.start;
  if (online) {
    const visibility = staffClientVisibility(core, staff, { hiddenIds: ctx.hiddenIds });
    const denied = canBookOnline({
      business,
      staff,
      client,
      appUser,
      date: datePart(start),
      pauseUntil: ctx.pauseUntil,
      vacationUntil: ctx.vacationUntil,
    });
    if (denied) return fail(denied);
    if (!visibility.link || !visibility.bookable) return fail('staff_hidden');
  }

  // 5–6. Окно или места группового события
  const lines = services.map(({ svc, line }) =>
    ({
      ...makeServiceLine(svc, line.staffId ?? staff.id, { qty: line.qty, discountPct: line.discountPct, unitPrice: line.unitPrice }),
      ...(line.upsellOf ? { upsellOf: line.upsellOf } : {}),
    }),
  );
  const bufferAfterMin = Math.max(0, ...services.map(({ svc }) => svc.bufferAfterMin ?? 0));
  let durationMin = linesDuration(lines);
  let locationId = input.locationId;
  let workplace = input.workplace;
  if (event) {
    const taken = core.bookings.filter((b) => b.groupEventId === event.id && occupiesTime(b)).reduce((n, b) => n + Math.max(1, b.services[0]?.qty ?? 1), 0);
    const seats = Math.max(1, input.services[0]?.qty ?? 1);
    if (taken + seats > event.capacity) return fail('group_full');
    durationMin = event.durationMin;
    locationId = event.locationId;
  } else {
    const slot = checkSlot(
      core,
      { staffId: staff.id, start, durationMin, bufferAfterMin, locationId, workplace, checkHours: online, checkPast: online },
      ctx.now,
    );
    if (!slot.ok) return fail(slot.reason === 'outside_hours' && !online ? 'outside_hours' : 'slot_taken');
    locationId = locationId ?? slot.locationId;
    workplace = workplace ?? slot.workplace;
    const offered =
      !online ||
      !ctx.isStartOffered ||
      ctx.isStartOffered({
        staffId: staff.id,
        date: datePart(start),
        start,
        durationMin,
        bufferAfterMin,
        locationId,
        serviceId: services[0]?.svc.id,
      });
    if (!offered) return fail('slot_taken');
  }
  locationId = locationId ?? staff.locationIds[0] ?? business.locationIds[0];
  if (!locationId) return fail('not_found');
  const place: Workplace = workplace ?? 'salon';

  // Ресурсы (F-16-011, F-16-012, F-16-013): групповое событие уже несёт свои ресурсы; для обычной записи —
  // ручной выбор администратора (input.resourceIds) проверяется на занятость, иначе система сама берёт по одному
  // свободному экземпляру каждого ресурса, привязанного к записанным услугам.
  // data-f="F-16-018" — единая точка создания записи для ЛЮБОГО источника (виджет, журнал, будущий бот/API,
  // BookingSource): проверка ресурса не обходится в зависимости от того, кто вызвал bookRequest.
  let resourceIds: Id[];
  if (event) {
    resourceIds = input.resourceIds ?? event.resourceIds ?? [];
  } else if (input.resourceIds && input.resourceIds.length > 0) {
    const busyBookings = resourceBusyBookings(core);
    const busyEvents = resourceBusyEvents(core);
    if (!checkInstancesFree(input.resourceIds, start, durationMin, busyBookings, busyEvents)) return fail('resource_unavailable');
    resourceIds = input.resourceIds;
  } else {
    const serviceIds = new Set(services.map(({ svc }) => svc.id));
    const required = core.resources.filter((r) => r.active && r.locationId === locationId && r.serviceIds.some((id) => serviceIds.has(id)));
    if (required.length > 0) {
      const instancesByResource = new Map(required.map((r) => [r.id, r.instances.map((i) => i.id)]));
      const busyBookings = resourceBusyBookings(core);
      const busyEvents = resourceBusyEvents(core);
      const picked = pickFreeInstances(
        required.map((r) => r.id),
        instancesByResource,
        start,
        durationMin + bufferAfterMin,
        busyBookings,
        busyEvents,
      );
      if (!picked) return fail('resource_unavailable');
      resourceIds = picked;
    } else {
      resourceIds = [];
    }
  }

  // 7. Статус и предоплата
  const own = staff.calendarVisibility === 'mine' ? isOwnClient(core, staff.id, { clientId: client?.id, appUserId: appUser?.id }) : true;
  // ⭐ Предоплата только от тех, кто не приходил: счётчик — у ЭТОГО мастера за период правила (В-07)
  const noShowRule = online && staff.prepayment?.onlyAfterNoShows ? normalizeNoShowRule(staff.prepayment.onlyAfterNoShows) : undefined;
  const clientNoShows = noShowRule
    ? recentNoShows(core.bookings, { staffId: staff.id, clientId: client?.id, appUserId: appUser?.id ?? client?.appUserId, now: ctx.now, months: noShowRule.months })
    : 0;
  const status = online || !input.status ? newBookingStatus({ source: input.source, staff, workplace: place, isOwnClient: own, clientNoShows }) : input.status;
  const need = online ? prepaymentNeed(staff.prepayment, clientNoShows) : undefined;
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  // Имя из формы (виджет/журнал) — на самой записи, карточку клиента не трогаем (F-03-125)
  // Отличается от имени НАЙДЕННОЙ карточки — это «другой посетитель» (F-01-127/F-16-051); для новой карточки
  // (client не найден, имя в форме = имя самой карточки) отдельного значка «другой посетитель» быть не должно.
  const visitorName =
    input.visitorName ?? (who?.phone && client && who.name?.trim() && who.name.trim() !== client.name ? who.name.trim() : undefined);
  const payInFull = Boolean(input.payInFull) && hasExactPrice(services.map(({ svc }) => svc)) && canPayInFull(staff.prepayment, total);
  const prepayment =
    status === 'awaiting_prepayment' && requiresPrepayment({ source: input.source, staff, clientNoShows }) && staff.prepayment
      ? {
          amount: prepaymentAmount(staff.prepayment, total, payInFull),
          paid: false,
          holdUntil: prepaymentHoldUntil(staff.prepayment, ctx.now),
          ...(payInFull ? { full: true } : {}),
          ...(need?.reason === 'no_shows' ? { reason: 'no_shows' as const, noShows: need.noShows, months: need.months } : {}),
        }
      : undefined;

  return {
    ok: true,
    plan: {
      lines,
      client: link,
      booking: {
        businessId: input.businessId,
        locationId,
        staffId: staff.id,
        ...(client ? { clientId: client.id } : {}),
        ...(appUser ? { appUserId: appUser.id } : client?.appUserId ? { appUserId: client.appUserId } : {}),
        start,
        durationMin,
        status,
        services: lines,
        resourceIds,
        workplace: place,
        source: input.source,
        createdBy: online ? 'client' : (input.createdBy ?? 'client'),
        forWhom: input.forWhom ?? 'self',
        ...(visitorName ? { visitorName } : {}),
        ...(input.comment ? { comment: input.comment } : {}),
        ...(prepayment ? { prepayment } : {}),
        ...(event ? { groupEventId: event.id } : {}),
        ...(input.seriesId ? { seriesId: input.seriesId } : {}),
        ...(input.visitId ? { visitId: input.visitId } : {}),
        ...(input.staffAssignment ? { staffAssignment: input.staffAssignment } : {}),
      },
    },
  };
}

/** Код ошибки записи → ключ текста в common.json: t(`bookingErrors.${code}`) */
export const PLACE_BOOKING_ERRORS: readonly PlaceBookingError[] = [
  'not_found',
  'service_unavailable',
  'staff_hidden',
  'invalid_phone',
  'client_required',
  'slot_taken',
  'outside_hours',
  'group_full',
  'resource_unavailable',
  'business_inactive',
  'staff_unavailable',
  'online_disabled',
  'online_paused',
  'staff_on_vacation',
  'client_blocked',
  'accepts_mismatch',
];

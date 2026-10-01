'use client';

/** Общее для функций раздела: строка клиента, деньги, бизнесы сети, проверка телефона, журнал изменений, настройки бизнеса. Не для экранов — только для src/api/clients/*. */
import type { ClientChangeAction, ClientChangeLogEntry, ClientProfile, ClientRow, ClientsBizSettings, FilterContext } from '@/domain/clients';
import { clientMoney, countNoShows, defaultBizSettings, emptyProfile, visitKey } from '@/domain/clients';
import type { Booking, Client, Id, LocaleCode } from '@/domain/core';
import { readArea, readCore, mutateArea } from '@/api/area';
import { coreTx, currentActor } from '@/api/core';
import { ApiError } from '@/api/request';
import { newId } from '@/lib/id';
import { addDays, nowDateTime, today } from '@/lib/date';
import { normalizePhone, PHONE_PREFIX } from '@/lib/phone';
import type { Subscription } from '@/domain/clients/program';
import { membershipDisplayStatus } from '@/domain/loyalty';

/**
 * Дубль номера при создании (F-00-128): вместо второй карточки открываем существующую —
 * несёт id найденного клиента, чтобы форма перенаправила на его карточку.
 */
export class DuplicatePhoneError extends ApiError {
  readonly existingClientId: Id;
  constructor(existingClientId: Id) {
    super('duplicate_phone', 'Клиент с таким номером уже есть в базе');
    this.existingClientId = existingClientId;
  }
}

export function toRow(client: Client, profile: ClientProfile | undefined, broadcastDates: string[], bookingsOfClient?: Booking[]): ClientRow {
  const own = bookingsOfClient ?? readCore().bookings.filter((b) => b.clientId === client.id && !b.deletedAt);
  const arrived = own.filter((b) => b.status === 'arrived');
  const dates = arrived.map((b) => b.start.slice(0, 10)).sort();
  const cancelCount = own.filter((b) => b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master').length;
  const p = profile ?? emptyProfile();
  // data-f="F-04-219" — продажи вне визита («Продать ▾» в журнале), привязанные к этому клиенту и не отменённые — идут
  // в его «Продано»/«Оплачено» наравне с визитами. Журнал — соседний раздел, читаем его срез только на чтение.
  const standaloneSold = readArea('journal').quickSales.reduce(
    (sum, sale) => (sale.clientId === client.id && !sale.cancelled ? sum + sale.totalPrice : sum),
    0,
  );
  // F-04-129/177: «Продано» из импорта прибавляется к визитам; «Оплачено» = оплаты визитов + внесённое сверх них
  const money = clientMoney(arrived, readArea('clients').manualVisitPayments, p.paidAmount, p.importedSold ?? 0, standaloneSold);
  return {
    id: client.id,
    businessId: client.businessId,
    name: client.name,
    phone: client.phone,
    email: client.email,
    gender: client.gender,
    birthday: client.birthday,
    note: client.note,
    tags: client.tags,
    appUserId: client.appUserId,
    noShowCount: countNoShows(own),
    cancelCount,
    blocked: client.blocked,
    createdAt: client.createdAt,
    cardNumber: p.cardNumber,
    discount: p.discountPercent,
    importanceClass: p.importanceClass,
    sold: money.sold,
    paid: money.paid,
    balance: money.balance,
    visits: new Set(arrived.map((b) => visitKey(b))).size,
    firstVisit: dates[0],
    lastVisit: dates[dates.length - 1],
    dueAt: dueAtOf(own),
    broadcastDates,
    lastName: p.lastName,
    middleName: p.middleName,
    additionalPhone: p.additionalPhone,
    avatar: p.avatar,
    nationalId: p.nationalId,
    consent: p.adConsent,
    birthdayGreetingOptOut: p.birthdayGreetingOptOut,
    locale: p.locale,
    preferredContact: p.preferredContact,
  };
}

/**
 * ⭐ «Пора снова» (F-00-084, F-00-119): последний визит «Пришёл» + самый короткий интервал повтора его услуг.
 * Уже есть будущая активная запись — не пора (клиент записан). Та же логика, что у клиента «Пора снова» (api/client).
 */
function dueAtOf(own: Booking[]): string | undefined {
  const now = nowDateTime();
  if (own.some((b) => b.start > now && ['scheduled', 'client_confirmed', 'awaiting_confirmation', 'awaiting_prepayment'].includes(b.status))) return undefined;
  const last = own.filter((b) => b.status === 'arrived').sort((a, b) => b.start.localeCompare(a.start))[0];
  if (!last) return undefined;
  const services = readCore().services;
  const intervals = last.services
    .map((l) => services.find((s) => s.id === l.serviceId)?.repeatIntervalDays)
    .filter((n): n is number => Boolean(n && n > 0));
  if (!intervals.length) return undefined;
  return addDays(last.start.slice(0, 10), Math.min(...intervals));
}

/** Записи бизнеса по клиенту — один проход по базе вместо фильтра на каждого клиента */
function bookingsByClient(businessIds: Id[]): Map<Id, Booking[]> {
  const map = new Map<Id, Booking[]>();
  readCore().bookings.forEach((b) => {
    if (!b.clientId || b.deletedAt || !businessIds.includes(b.businessId)) return;
    const list = map.get(b.clientId);
    if (list) list.push(b);
    else map.set(b.clientId, [b]);
  });
  return map;
}

/** Бизнесы выбранных филиалов (сеть, F-00-050); ничего не выбрано — сам бизнес */
export function businessIdsFor(businessId: Id, locationIds?: Id[]): Id[] {
  if (!locationIds?.length) return [businessId];
  const core = readCore();
  // Сеть15: только бизнесы СВОЕЙ сети (той, где состоит businessId), а не любой сети по переданным филиалам —
  // иначе чужой id филиала в запросе отдавал клиентов чужой сети.
  const own = core.businesses.find((b) => b.id === businessId);
  const allowed = new Set<Id>([businessId]);
  for (const n of core.networks) if (n.businessIds.includes(businessId)) for (const id of n.businessIds) allowed.add(id);
  if (own?.networkId) for (const b of core.businesses) if (b.networkId === own.networkId) allowed.add(b.id);
  const ids = core.businesses
    .filter((b) => allowed.has(b.id))
    .filter((b) => b.locationIds.some((l) => locationIds.includes(l)))
    .map((b) => b.id);
  return ids.length ? ids : [businessId];
}

export function rowsFor(businessIds: Id[]): ClientRow[] {
  const core = readCore();
  const state = readArea('clients');
  const byClient = bookingsByClient(businessIds);
  return core.clients
    .filter((c) => businessIds.includes(c.businessId) && !c.deletedAt)
    .map((c) => toRow(c, state.profiles[c.id], state.broadcastHistory[c.id] ?? [], byClient.get(c.id) ?? []));
}

/** Абонементы клиентов из раздела лояльности в форме подборок клиентов (статус — тот же, что видит «Абонементы») */
function loyaltySubscriptions(businessIds: Id[]): Subscription[] {
  const loyalty = readArea('loyalty');
  const typeName = new Map(loyalty.membershipTypes.map((t) => [t.id, t.name]));
  const todayIso = today();
  return loyalty.memberships
    .filter((m) => businessIds.includes(m.businessId))
    .map((m) => {
      const status = membershipDisplayStatus(m, todayIso);
      return {
        id: m.id,
        businessId: m.businessId,
        clientId: m.clientId,
        name: String(typeName.get(m.membershipTypeId) ?? ''),
        status: status === 'active' || status === 'frozen' ? 'active' : 'expired',
        frozen: status === 'frozen',
        soldAt: m.soldAt.slice(0, 10),
        expiresAt: m.expiresAt,
        totalVisits: m.totalVisits,
        remainingVisits: m.balanceVisits,
        code: m.code ?? '',
      };
    });
}

export function filterContext(businessIds: Id[], lostAfterDays: number): FilterContext {
  const core = readCore();
  const state = readArea('clients');
  return {
    bookings: core.bookings
      .filter((b) => businessIds.includes(b.businessId) && Boolean(b.clientId) && !b.deletedAt)
      .map((b) => ({
        clientId: b.clientId!,
        status: b.status,
        start: b.start,
        total: b.total,
        staffId: b.staffId,
        serviceIds: b.services.map((l) => l.serviceId),
      })),
    certificates: state.certificates.filter((c) => businessIds.includes(c.businessId)),
    subscriptions: state.subscriptions.filter((c) => businessIds.includes(c.businessId)),
    // Стык clients↔loyalty (28.09): «Заканчивается абонемент» — по абонементам раздела лояльности (как listMemberships)
    memberships: loyaltySubscriptions(businessIds),
    productPurchases: state.productPurchases.filter((c) => businessIds.includes(c.businessId)),
    lostAfterDays,
    today: today(),
  };
}

/**
 * Проверка телефона при сохранении (F-04-049): армянский номер — строго 8 цифр после +374;
 * другой код страны (F-04-047 «можно выбрать другой») — принимаем как есть, не короче 6 цифр.
 */
export function validatePhone(raw: string): string {
  // +374 — всегда строго 8 местных цифр (иначе номер набран не до конца)
  if (raw.startsWith(PHONE_PREFIX) || !raw.startsWith('+')) {
    const armenian = normalizePhone(raw);
    if (!armenian) throw new ApiError('invalid_phone', 'Укажите полный номер телефона');
    return armenian;
  }
  // другой код страны (F-04-047 «можно выбрать другой») — принимаем как есть, не короче 6 местных цифр
  const digitsAfterCode = raw.replace(/^\+\d{1,3}/, '').replace(/\D/g, '');
  if (digitsAfterCode.length < 6) throw new ApiError('invalid_phone', 'Укажите полный номер телефона');
  return raw;
}

export interface ClientFormFields {
  name: string;
  lastName?: string;
  middleName?: string;
  phone: string;
  additionalPhone?: string;
  email?: string;
  birthday?: string;
  gender?: Client['gender'];
  importanceClass?: ClientProfile['importanceClass'];
  cardNumber?: string;
  discountPercent?: number;
  blocked?: boolean;
  note?: string;
  tags?: string[];
  paidAmount?: number;
  /** F-07-056: «Продано» из формы «Добавить клиента» — перенос истории при переходе из другой программы;
   *  не трогает кассы, только баланс карточки */
  importedSold?: number;
  avatar?: string;
  customFieldValues?: Record<string, string>;
  /** F-04-192: необязательный национальный номер, 12 цифр */
  nationalId?: string;
  /** F-04-213 */
  birthdayGreetingOptOut?: boolean;
  /** F-04-228: только для клиента без приложения — у клиента из приложения язык берётся из appUser */
  locale?: LocaleCode;
  /** F-04-066 */
  preferredContact?: ClientProfile['preferredContact'];
}

/** F-04-192: «ИИН» принимает только 12 цифр — необязательное, но если заполнено, должно быть валидным */
export function validateNationalId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) throw new ApiError('invalid_national_id', 'Национальный номер — 12 цифр');
  return digits;
}

export interface CreateClientInput extends ClientFormFields {
  businessId: Id;
}

// ─────────────────────────── Журнал изменений (⭐ F-00-040 → F-04-137) ───────────────────────────

/** По businessId, а не clientId — запись об удалении/объединении не должна исчезать вместе с клиентом */
export function logChange(
  businessId: Id,
  entry: {
    clientId: Id;
    clientName: string;
    action: ClientChangeAction;
    changedFields?: string[];
    targetName?: string;
    authorId?: Id;
    authorName?: string;
  },
): void {
  mutateArea('clients', (s) => {
    const list = s.changeLog[businessId] ?? [];
    const item: ClientChangeLogEntry = {
      id: newId('cchg'),
      clientId: entry.clientId,
      clientName: entry.clientName,
      action: entry.action,
      authorId: entry.authorId ?? 'system',
      authorName: entry.authorName ?? 'Система',
      summary: entry.action === 'updated' ? (entry.changedFields ?? []).join(',') : entry.action === 'merged' ? (entry.targetName ?? '') : '',
      at: nowDateTime(),
    };
    s.changeLog[businessId] = [item, ...list].slice(0, 500);
  });
}

/** Мягкое удаление одного клиента внутри уже открытого request() — для карточки и массового удаления */
export function deleteClientTx(businessId: Id, clientId: Id, actorId?: Id, actorName?: string): void {
  const client = readCore().clients.find((c) => c.id === clientId && c.businessId === businessId && !c.deletedAt);
  if (!client) throw new ApiError('not_found', 'Клиент не найден');
  // Мягкое удаление (core-rules №2): записи и платежи клиента остаются под своим clientId, только
  // выбиты из статистики — списки и поиск клиента фильтруют !deletedAt (F-04-137, «Готово, когда»)
  coreTx.update('clients', clientId, { deletedAt: nowDateTime() });
  mutateArea('clients', (s) => {
    delete s.profiles[clientId];
    delete s.customFieldValues[clientId];
    delete s.comments[clientId];
    delete s.appActivity[clientId];
    delete s.broadcastHistory[clientId];
  });
  // ⭐ F-00-040 → F-04-137: удаление тоже правка, пишется в журнал изменений бизнеса
  logChange(businessId, { clientId, clientName: client.name, action: 'deleted', authorId: actorId, authorName: actorName });
}

// ─────────────────────────── Доп. поля клиента (F-04-060) ───────────────────────────

// ─────────────────────────── Настройки базы — по бизнесу (arch-a1 №2) ───────────────────────────

/** Бизнес по умолчанию — текущий (для вызовов из чужих экранов без businessId, например настройки журнала) */
export function bizOf(businessId?: Id): Id {
  return businessId ?? currentActor().businessId ?? '';
}

export function bizSettings(businessId: Id): ClientsBizSettings {
  return { ...defaultBizSettings(), ...readArea('clients').settings[businessId] };
}

export function patchBizSettings(businessId: Id, patch: Partial<ClientsBizSettings>): ClientsBizSettings {
  const state = mutateArea('clients', (s) => {
    s.settings[businessId] = { ...defaultBizSettings(), ...s.settings[businessId], ...patch };
  });
  return state.settings[businessId];
}

export function staffName(staffId: Id): string {
  return readCore().staff.find((s) => s.id === staffId)?.name ?? '—';
}

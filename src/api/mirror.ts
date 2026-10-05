'use client';

/**
 * Зеркало ядра в режиме api (docs/backend/PLAN.md §7 — переходный слой, пока разделы переезжают на сервер по этапам).
 * Бизнесы, филиалы, сети и сотрудники живут на сервере (этап 3); разделы, ещё работающие с моковой базой (журнал,
 * график, услуги…), читают их из ядра браузера. Зеркало кладёт туда ответ сервера: после входа — снимок своих бизнесов
 * (/v1/biz/{b}/core), после каждой записи раздела — изменённую сущность. Экран видит одно и то же в обоих местах.
 * В демо-сборке (mock) не вызывается.
 *
 * **Не убрано этапом 21 (было здесь такое обещание — не сбылось, поправлено самим этапом 21).** Аудит
 * `docs/PROGRESS.md` «Этап 21» нашёл, что «журнал, график, услуги» (и ещё восемь файлов — `staff.ts`,
 * `resources.ts`, `client.ts`, `schedule/*`, `settings.ts`) переехали на сервер только той частью функций,
 * что явно названа в `02-api.md` по каждому этапу; десятки других экспортов из тех же файлов (отзывы,
 * избранное, сторис, покупка абонемента/сертификата из приложения, Z-отчёт, аналитика, «прикреплённые
 * поля»…) — каждый честно отмечен «Осталось»/«Не строил» в своём этапе, но по сумме означает, что эти
 * экраны и сегодня работают только через ядро браузера, которое зеркало и держит живым. Плюс — `loyalty.ts`
 * (2900+ строк, весь Altegio-паритетный расчётный слой, этап 11) целиком на моке. Убрать зеркало можно
 * только когда у ВСЕХ этих функций появится серверная пара — это по объёму сравнимо с отдельным проходом
 * по каждому из перечисленных разделов, не однострочная правка. Список конкретных имён функций —
 * `docs/PROGRESS.md`, этап 21, раздел «Аудит фасадов».
 */
import { http } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import type { Booking, Business, CalendarMark, Client, CoreData, GroupEvent, Id, Location, Network, Resource, Service, ServiceCategory, Staff, WorkSchedule } from '@/domain/core';
import type { BookingExtras, PackageGroup } from '@/domain/journal';
import type { DayRecord, PlanningPeriodYears, ServiceSlotWindow, SlotRule, UnavailableRange } from '@/domain/schedule';
import { dbReady, notifyDbChange, useDb } from '@/mock/db';

export interface CoreSnapshot {
  businesses: Business[];
  locations: Location[];
  staff: Staff[];
  networks: Network[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  resources: Resource[];
}

type Mirrored = 'businesses' | 'locations' | 'staff' | 'networks' | 'serviceCategories' | 'services' | 'resources';

/**
 * Клиенты (этап 5) — намеренно НЕ часть `CoreSnapshot`/снимка при входе: бизнес может держать тысячи карточек
 * (K8 из `07-mock-only.md` — «иначе 10 000 клиентов не поместятся в ответ»), а разделы, ещё живущие на моке
 * (журнал, online, notify…), видят настоящих клиентов только по мере того, как раздел `clients` их коснулся —
 * так же ограниченно и опережающе, как staff/services ограничены самим бизнесом. `mirrorClients` зовут после
 * search/getClientRow/create/update, `unmirrorClient` — после мягкого удаления и объединения дубля.
 */
/** Одинаковые по содержимому (ответ сервера пришёл тот же — зеркало не меняется и не будит перечитывание) */
export function sameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * По id: есть — заменить, нет — добавить. Ничего не поменялось — возвращается ТОТ ЖЕ массив: запись в базу браузера
 * без изменений не должна будить запросы, которые её читают (иначе чтение → зеркало → перечитывание по кругу).
 */
function upsert<T extends { id: Id }>(list: T[], items: T[]): T[] {
  if (!items.length) return list;
  const byId = new Map(items.map((x) => [x.id, x]));
  let changed = false;
  const out = list.map((x) => {
    const next = byId.get(x.id);
    if (!next || sameJson(next, x)) return x;
    changed = true;
    return next;
  });
  const have = new Set(list.map((y) => y.id));
  for (const x of items) {
    if (have.has(x.id)) continue;
    out.push(x);
    changed = true;
  }
  return changed ? out : list;
}

/** Положить сущности сервера в ядро (по id: есть — заменить, нет — добавить) */
export function mirrorCore(part: Partial<Pick<CoreData, Mirrored>>): void {
  useDb.getState().setCore((core) => ({
    ...core,
    businesses: upsert(core.businesses, part.businesses ?? []),
    locations: upsert(core.locations, part.locations ?? []),
    staff: upsert(core.staff, part.staff ?? []),
    networks: upsert(core.networks, part.networks ?? []),
    serviceCategories: upsert(core.serviceCategories, part.serviceCategories ?? []),
    services: upsert(core.services, part.services ?? []),
    resources: upsert(core.resources, part.resources ?? []),
  }));
}

/** Убрать из зеркала (сотрудник/услуга/ресурс удалены на сервере) */
export function unmirror(collection: Mirrored, id: Id): void {
  useDb.getState().setCore((core) => ({ ...core, [collection]: (core[collection] as { id: Id }[]).filter((x) => x.id !== id) }));
}

/** Клиенты — по мере обращения раздела `clients` (см. комментарий выше), не в общем `mirrorCore`/`CoreSnapshot` */
export function mirrorClients(clients: Client[]): void {
  if (!clients.length) return;
  const core = useDb.getState().core;
  if (upsert(core.clients, clients) !== core.clients) useDb.getState().setCore((c) => ({ ...c, clients: upsert(c.clients, clients) }));
}

export function unmirrorClient(id: Id): void {
  useDb.getState().setCore((core) => ({ ...core, clients: core.clients.filter((c) => c.id !== id) }));
}

/**
 * Снимок бизнеса целиком: сотрудники/каталог этих бизнесов, которых нет на сервере (удалены), из ядра убираются.
 * Филиалы бизнеса заменяются полностью; прочие бизнесы ядра не трогаются.
 */
export function mirrorSnapshot(snap: CoreSnapshot): void {
  const ids = new Set(snap.businesses.map((b) => b.id));
  useDb.getState().setCore((core) => ({
    ...core,
    businesses: upsert(core.businesses, snap.businesses),
    locations: upsert(
      core.locations.filter((l) => !ids.has(l.businessId) || snap.locations.some((x) => x.id === l.id)),
      snap.locations,
    ),
    staff: upsert(
      core.staff.filter((s) => !ids.has(s.businessId) || snap.staff.some((x) => x.id === s.id)),
      snap.staff,
    ),
    networks: upsert(core.networks, snap.networks),
    serviceCategories: upsert(
      core.serviceCategories.filter((c) => !ids.has(c.businessId) || snap.serviceCategories.some((x) => x.id === c.id)),
      snap.serviceCategories,
    ),
    services: upsert(
      core.services.filter((s) => !ids.has(s.businessId) || snap.services.some((x) => x.id === s.id)),
      snap.services,
    ),
    resources: upsert(
      core.resources.filter((r) => !ids.has(r.businessId) || snap.resources.some((x) => x.id === r.id)),
      snap.resources,
    ),
  }));
}

export async function fetchCoreSnapshot(businessId: Id): Promise<CoreSnapshot> {
  return http<CoreSnapshot>('GET', `/v1/biz/${businessId}/core`);
}

/** Перечитать с сервера свой бизнес (и филиалы сети) и положить в ядро */
export async function syncCore(businessId: Id): Promise<CoreSnapshot> {
  const snap = await fetchCoreSnapshot(businessId);
  // База браузера поднимается по частям (src/mock/db.ts, bootDb): кладём ответ сервера после неё, иначе сид перезапишет
  await dbReady();
  mirrorSnapshot(snap);
  await syncSchedule(businessId).catch(() => undefined);
  // Записи своего бизнеса и (сеть) филиалов, доступных этому входу — «Все филиалы» журнала (F-01-006)
  const network = (apiIdentity()?.businessIds ?? []).filter((id) => id !== businessId);
  await syncBookings([businessId, ...network]).catch(() => undefined);
  return snap;
}

/** Ответ /v1/biz/{b}/schedule/mirror (этап 6) — графики, отметки, типы дня, правила окон и настройки бизнеса */
export interface ScheduleMirror {
  staffIds: Id[];
  schedules: WorkSchedule[];
  calendarMarks: CalendarMark[];
  days: DayRecord[];
  slotRules: Record<string, SlotRule[]>;
  slotMode: Record<Id, 'own'>;
  unavailableDays: Record<string, UnavailableRange[]>;
  bufferMin: Record<string, number>;
  serviceSlotWindows: Record<Id, ServiceSlotWindow>;
  settings: {
    anySpecialistAllowed: boolean;
    allowOnlineOverNoShow: boolean;
    planningPeriodYears: PlanningPeriodYears;
    notifyMasterOnScheduleChange: boolean;
    skipStaffSelection: Record<Id, boolean>;
    historyLimitDays: Record<Id, number>;
    includeInFillRate: Record<Id, boolean>;
    googleCalendar: Record<Id, { connected: boolean; shareClientNames: boolean }>;
  };
}

/**
 * График бизнеса (этап 6) — в ядро и срез schedule браузера: журнал, онлайн-запись и приложение клиента (этапы 7–9)
 * ещё считают окна у себя (computeFreeSlots над ядром) и должны видеть те же часы, отметки и правила, что сервер.
 * Строки этого бизнеса заменяются целиком (удалённое на сервере уходит и из ядра).
 */
export function mirrorSchedule(businessId: Id, m: ScheduleMirror): void {
  const staff = new Set(m.staffIds);
  const state = useDb.getState();
  const locations = new Set(state.core.locations.filter((l) => l.businessId === businessId).map((l) => l.id));
  const services = new Set(state.core.services.filter((sv) => sv.businessId === businessId).map((sv) => sv.id));
  const ours = (key: string) => {
    const [kind, id] = key.split(':');
    return kind === 'location' ? locations.has(id) : staff.has(id);
  };
  const keep = <T,>(rec: Record<string, T>, own: (k: string) => boolean, next: Record<string, T>) => ({
    ...Object.fromEntries(Object.entries(rec).filter(([k]) => !own(k))),
    ...next,
  });
  state.setCore((core) => ({
    ...core,
    schedules: [...core.schedules.filter((s) => !staff.has(s.staffId)), ...m.schedules],
    calendarMarks: [...core.calendarMarks.filter((x) => !staff.has(x.staffId)), ...m.calendarMarks],
  }));
  state.setArea('schedule', (area) => ({
    ...area,
    days: {
      ...Object.fromEntries(Object.entries(area.days).filter(([, d]) => !staff.has(d.staffId))),
      ...Object.fromEntries(m.days.map((d) => [`${d.staffId}|${d.date}`, d])),
    },
    slotRules: keep(area.slotRules, ours, m.slotRules),
    slotMode: keep(area.slotMode, (k) => staff.has(k), m.slotMode),
    unavailableDays: keep(area.unavailableDays, ours, m.unavailableDays),
    bufferMin: keep(area.bufferMin, ours, m.bufferMin),
    serviceSlotWindows: keep(area.serviceSlotWindows, (k) => services.has(k), m.serviceSlotWindows),
    anySpecialistAllowed: { ...area.anySpecialistAllowed, [businessId]: m.settings.anySpecialistAllowed },
    allowOnlineOverNoShow: { ...area.allowOnlineOverNoShow, [businessId]: m.settings.allowOnlineOverNoShow },
    planningPeriodYears: { ...area.planningPeriodYears, [businessId]: m.settings.planningPeriodYears },
    notifyMasterOnScheduleChange: { ...area.notifyMasterOnScheduleChange, [businessId]: m.settings.notifyMasterOnScheduleChange },
    skipStaffSelection: keep(area.skipStaffSelection, (k) => staff.has(k), m.settings.skipStaffSelection),
    historyLimitDays: keep(area.historyLimitDays, (k) => staff.has(k), m.settings.historyLimitDays),
    includeInFillRate: keep(area.includeInFillRate, (k) => staff.has(k), m.settings.includeInFillRate),
    googleCalendar: keep(area.googleCalendar, (k) => staff.has(k), m.settings.googleCalendar),
  }));
  notifyDbChange('core.schedules', 'core.calendarMarks', 'areas.schedule');
}

export async function syncSchedule(businessId: Id): Promise<void> {
  mirrorSchedule(businessId, await http<ScheduleMirror>('GET', `/v1/biz/${businessId}/schedule/mirror`));
}

// ─────────────────────────── Записи (этап 7) ───────────────────────────

/** Ответ /v1/biz/{b}/journal/mirror — записи, их доп. данные, групповые события, пакеты и клиенты этих записей */
export interface BookingsMirror {
  businessIds: Id[];
  from: string;
  to: string;
  bookings: Booking[];
  extras: Record<Id, BookingExtras>;
  groupEvents: GroupEvent[];
  packageGroups: PackageGroup[];
  clients: Client[];
}

/**
 * Записи бизнеса — в ядро браузера (этап 7): журнал на сервере, но отчёты, финансы, онлайн-запись, приложение клиента
 * и сводки CRM (этапы 8–16) ещё считают по ядру и должны видеть те же записи. Записи этих бизнесов заменяются целиком
 * (удалённое на сервере и демо-записи мока уходят), доп. данные визитов — в срез journal.
 */
export function mirrorBookingsSnapshot(m: BookingsMirror): void {
  const ids = new Set(m.businessIds);
  const state = useDb.getState();
  state.setCore((core) => ({
    ...core,
    bookings: [...core.bookings.filter((b) => !ids.has(b.businessId)), ...m.bookings],
    groupEvents: [...core.groupEvents.filter((e) => !ids.has(e.businessId)), ...m.groupEvents],
    clients: upsert(core.clients, m.clients),
  }));
  const own = new Set(m.bookings.map((b) => b.id));
  const breaks = Object.fromEntries(
    Object.entries(m.extras)
      .filter(([, e]) => typeof (e as { breakOverrideMin?: number }).breakOverrideMin === 'number')
      .map(([id, e]) => [id, (e as { breakOverrideMin?: number }).breakOverrideMin as number]),
  );
  state.setArea('journal', (area) => ({
    ...area,
    prefs: { ...area.prefs, breakOverrideMin: { ...area.prefs.breakOverrideMin, ...breaks } },
    extras: { ...Object.fromEntries(Object.entries(area.extras).filter(([id]) => !own.has(id))), ...m.extras },
    packageGroups: {
      ...Object.fromEntries(Object.entries(area.packageGroups).filter(([, g]) => !ids.has(g.businessId))),
      ...Object.fromEntries(m.packageGroups.map((g) => [g.id, g])),
    },
  }));
}

export async function syncBookings(businessIds: Id[]): Promise<void> {
  const [first, ...rest] = businessIds;
  if (!first) return;
  const d = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const from = iso(new Date(d.getTime() - 400 * 86_400_000));
  const to = iso(new Date(d.getTime() + 400 * 86_400_000));
  const m = await http<BookingsMirror>('GET', `/v1/biz/${first}/journal/mirror`, undefined, { query: { from, to, businessIds: rest.join(',') || undefined } });
  mirrorBookingsSnapshot(m);
}

/** Положить записи сервера в ядро (по id) — после каждой записи раздела */
export function mirrorBookings(bookings: Booking[]): void {
  if (!bookings.length) return;
  const core = useDb.getState().core;
  const next = upsert(core.bookings, bookings);
  if (next !== core.bookings) useDb.getState().setCore((c) => ({ ...c, bookings: upsert(c.bookings, bookings) }));
}

/** Доп. данные визита — в срез journal браузера (те же — не трогаем) */
export function mirrorExtras(bookingId: Id, extras: BookingExtras): void {
  if (sameJson(useDb.getState().areas.journal?.extras?.[bookingId], extras)) return;
  useDb.getState().setArea('journal', (area) => ({ ...area, extras: { ...area.extras, [bookingId]: extras } }));
}

export function mirrorGroupEvents(events: GroupEvent[]): void {
  if (!events.length) return;
  const core = useDb.getState().core;
  if (upsert(core.groupEvents, events) !== core.groupEvents) useDb.getState().setCore((c) => ({ ...c, groupEvents: upsert(c.groupEvents, events) }));
}

export function mirrorPackageGroup(group: PackageGroup): void {
  if (sameJson(useDb.getState().areas.journal?.packageGroups?.[group.id], group)) return;
  useDb.getState().setArea('journal', (area) => ({ ...area, packageGroups: { ...area.packageGroups, [group.id]: group } }));
}

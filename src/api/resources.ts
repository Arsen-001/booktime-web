'use client';

/**
 * API раздела «resources» (F-16). Ресурсы и групповые события — сущности ЯДРА (Resource, GroupEvent),
 * читаются/пишутся через coreList/coreCreate/coreUpdate/coreRemove (arch-a1: «не заводите свою коллекцию»).
 * Лист ожидания бизнеса — наш срез (core-rules/core-k2/core-k3: resources — владелец сущности), ОДИН на полный
 * экран /biz/waitlist и панель журнала (владелец, 30.09.2026) — см. src/domain/resources.ts.
 */
import type { Booking, Client, GroupEvent, Id, ISODate, ISODateTime, LocalizedText, Money, Resource, Service, ServicePackage, Staff } from '@/domain/core';
import { isApiMode } from '@/api/http';
import * as R from '@/api/resources.server';
import * as LX from '@/api/loyalty.server';
import { ApiError, request, useApiQuery, type QueryOptions, type QueryResult } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, coreList, coreTx, currentActor, placeBooking, withServerWrites } from '@/api/core';
import { occupiesTime } from '@/domain/rules/booking-status';
import { getFreeSlots, getNearestSlots } from '@/api/schedule/slots';
import {
  checkInstancesFree,
  defaultAssistantShares,
  defaultEventExtra,
  defaultGroupServicePaymentSettings,
  defaultPackageExtra,
  isPackageBroken,
  packageCanSequentialSame,
  packageDuration,
  packagePrice,
  packagePriceMethodsAvailable,
  packageUnconfiguredServiceIds,
  pickFreeInstances,
  repeatDates,
  seriesOccurrences,
  validatePackageComposition,
  DEFAULT_GROUP_SEATS_SETTINGS,
  type AssistantSettings,
  type AssistantShareRule,
  type BookingAssistant,
  type EventCategory,
  type EventExtra,
  type EventSeriesDef,
  type EventTemplate,
  type GroupSeatsSettings,
  type GroupServicePaymentSettings,
  type PackageExtra,
  type ParticipantExtraItem,
  type ParticipantExtraKind,
  type ParticipantPayment,
  type ParticipantPaymentMethod,
  type ResourcesFineRights,
  type PackageServiceLite,
  type RepeatEnd,
  type RepeatFreq,
  type ResourceBusyBooking,
  type ResourceBusyEvent,
  type ResourcesChangeAction,
  type ResourcesChangeEntity,
  type SeriesDayRule,
  type VisitScheduleEntry,
  pickWaitlistSlot,
  upcomingWish,
  waitlistFromLegacyApp,
  waitlistFromLegacyJournal,
  waitlistFromLegacyWidget,
  waitlistWantsDay,
  type LegacyAppWaitlistEntry,
  type LegacyJournalWaitlistEntry,
  type LegacyWidgetWaitlistEntry,
  type WaitlistEntry,
  type WaitlistSource,
  type WaitlistWish,
} from '@/domain/resources';
import { addDays, combine, datePart, nowDateTime, timePart, today, weekdayIndex } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';

export { computeWaitlistStatus, draftsToWishes, filterWaitlist, nextWish, upcomingWish, waitlistWantsDay, wishesToDrafts } from '@/domain/resources';
export type { AssistantShareRule, BookingAssistant, PackageAvailabilityWindow, PackageExtra, PackagePricingMethod } from '@/domain/resources';
export type { AssistantSettings, ResourcesFineRights } from '@/domain/resources';
export type { EventSeriesDef, EventTemplate, RepeatFreq, SeriesDayRule, VisitScheduleEntry, WaitlistEntry, WaitlistFilter, WaitlistRow, WaitlistSource, WaitlistStatus, WaitlistWish, WaitlistWishDraft } from '@/domain/resources';
export type { EventCategory, EventExtra, GroupSeatsSettings, GroupServicePaymentSettings, ParticipantExtraItem, ParticipantExtraKind, ParticipantPayment, ParticipantPaymentMethod } from '@/domain/resources';

// ─────────────────────────── Ключи чтения (docs/STATE.md: один ключ = одна функция чтения) ───────────────────────────

export const resourcesKeys = {
  waitlist: (businessId: Id | undefined) => ['resources', 'waitlist', businessId ?? ''] as const,
  futureUsage: (resourceId: Id | undefined) => ['resources', 'futureUsage', resourceId ?? ''] as const,
};

// ─────────────────────────── Ресурсы (Resource — ядро; description — надстройка своего среза) ───────────────────────────

export interface ResourceWithMeta extends Resource {
  description: string;
}

function withDescription(r: Resource): ResourceWithMeta {
  return { ...r, description: readArea('resources').descriptions[r.id] ?? '' };
}

/** F-16-016: «Разделять запись с услугами, которые используют разные ресурсы» — по бизнесу, по умолчанию включено */
export function getSplitByResource(businessId: Id): Promise<boolean> {
  if (isApiMode()) return R.getSplitByResource(businessId);
  return request(() => readArea('resources').splitByResource[businessId] ?? true);
}

export function setSplitByResource(businessId: Id, value: boolean): Promise<boolean> {
  if (isApiMode()) return R.setSplitByResource(businessId, value);
  return request(() => {
    mutateArea('resources', (s) => {
      s.splitByResource[businessId] = value;
    });
    return value;
  });
}

export function listResources(businessId: Id): Promise<ResourceWithMeta[]> {
  if (isApiMode()) return R.listResources(businessId);
  return request(() => readCore().resources.filter((r) => r.businessId === businessId).map(withDescription));
}

export function getResource(id: Id): Promise<ResourceWithMeta> {
  if (isApiMode()) return R.getResource(id);
  return request(() => withDescription(coreTx.get('resources', id)));
}

export interface ResourceInput {
  businessId: Id;
  locationId: Id;
  name: Resource['name'];
  description?: string;
  kind: Resource['kind'];
  serviceIds: Id[];
}

/** F-16-003: новый ресурс сразу получает первый экземпляр (F-16-004) */
export function createResource(input: ResourceInput): Promise<ResourceWithMeta> {
  if (isApiMode()) return R.createResource(input);
  return request(() => {
    const id = newId('res');
    const created = coreTx.create('resources', {
      id,
      businessId: input.businessId,
      locationId: input.locationId,
      name: input.name,
      kind: input.kind,
      serviceIds: input.serviceIds,
      instances: [{ id: `${id}_1`, name: '1' }],
      active: true,
    });
    if (input.description?.trim()) {
      mutateArea('resources', (s) => {
        s.descriptions[id] = input.description!.trim();
      });
    }
    logResourcesChange(input.businessId, 'resource', id, 'create', created.name.ru || created.name.en || id);
    return withDescription(created);
  });
}

export function updateResource(id: Id, patch: Partial<Omit<Resource, 'id' | 'businessId'>> & { description?: string }): Promise<ResourceWithMeta> {
  if (isApiMode()) return R.updateResource(id, patch);
  return request(() => {
    const { description, ...corePatch } = patch;
    const updated = Object.keys(corePatch).length ? coreTx.update('resources', id, corePatch) : coreTx.get('resources', id);
    if (description !== undefined) {
      mutateArea('resources', (s) => {
        if (description.trim()) s.descriptions[id] = description.trim();
        else delete s.descriptions[id];
      });
    }
    logResourcesChange(updated.businessId, 'resource', id, 'update', updated.name.ru || updated.name.en || id);
    return withDescription(updated);
  });
}

/** Сколько ещё не прошедших записей и событий держат ресурс — предупреждение перед удалением (F-16-005) */
export function countFutureUsage(resourceId: Id): Promise<number> {
  if (isApiMode()) return R.countFutureUsage(resourceId);
  return request(() => {
    const core = readCore();
    const resource = core.resources.find((r) => r.id === resourceId);
    if (!resource) return 0;
    const now = nowDateTime();
    const instanceIds = new Set(resource.instances.map((i) => i.id));
    const bookings = core.bookings.filter((b) => occupiesTime(b) && !b.groupEventId && b.start >= now && b.resourceIds.some((rid) => rid === resourceId || instanceIds.has(rid))).length;
    const events = core.groupEvents.filter((e) => e.status === 'scheduled' && e.start >= now && e.resourceIds.some((rid) => instanceIds.has(rid))).length;
    return bookings + events;
  });
}

export function useCountFutureUsage(resourceId: Id | undefined, options?: QueryOptions): QueryResult<number> {
  return useApiQuery(resourcesKeys.futureUsage(resourceId), () => countFutureUsage(resourceId ?? ''), { enabled: Boolean(resourceId), ...options });
}

/** F-16-005: удаление ресурса (будущие записи не трогаем — F-16-014, показать предупреждение до удаления) */
export function deleteResource(id: Id): Promise<void> {
  if (isApiMode()) return R.deleteResource(id);
  return request(() => {
    const resource = coreTx.get('resources', id);
    coreTx.remove('resources', id);
    mutateArea('resources', (s) => {
      delete s.descriptions[id];
    });
    logResourcesChange(resource.businessId, 'resource', id, 'delete', resource.name.ru || resource.name.en || id);
  });
}

/** Восстановить удалённый ресурс тем же id — для «Отменить» 5 секунд в тосте (F-00-061, у Resource нет deletedAt) */
export function restoreResource(resource: Resource, description: string): Promise<ResourceWithMeta> {
  if (isApiMode()) return R.restoreResource(resource, description);
  return request(() => {
    const created = coreTx.create('resources', resource);
    if (description) {
      mutateArea('resources', (s) => {
        s.descriptions[resource.id] = description;
      });
    }
    return withDescription(created);
  });
}

/** F-16-004: добавить экземпляр («Кресло 2», «Кабинет 3»…) */
export function addResourceInstance(resourceId: Id, name: string): Promise<Resource> {
  if (isApiMode()) return R.addResourceInstance(resourceId, name);
  return request(() => {
    const resource = coreTx.get('resources', resourceId);
    const n = resource.instances.length + 1;
    return coreTx.update('resources', resourceId, { instances: [...resource.instances, { id: newId('resinst'), name: name.trim() || String(n) }] });
  });
}

export function renameResourceInstance(resourceId: Id, instanceId: Id, name: string): Promise<Resource> {
  if (isApiMode()) return R.renameResourceInstance(resourceId, instanceId, name);
  return request(() => {
    const resource = coreTx.get('resources', resourceId);
    return coreTx.update('resources', resourceId, { instances: resource.instances.map((i) => (i.id === instanceId ? { ...i, name: name.trim() || i.name } : i)) });
  });
}

export function removeResourceInstance(resourceId: Id, instanceId: Id): Promise<Resource> {
  if (isApiMode()) return R.removeResourceInstance(resourceId, instanceId);
  return request(() => {
    const resource = coreTx.get('resources', resourceId);
    if (resource.instances.length <= 1) throw new ApiError('last_instance');
    return coreTx.update('resources', resourceId, { instances: resource.instances.filter((i) => i.id !== instanceId) });
  });
}

/** F-16-006/007: привязка ресурс↔услуга, двусторонняя (одна и та же коллекция) */
export function setResourceServices(resourceId: Id, serviceIds: Id[]): Promise<Resource> {
  if (isApiMode()) return R.setResourceServices(resourceId, serviceIds);
  return request(() => coreTx.update('resources', resourceId, { serviceIds }));
}

/** Вклад в карточку услуги (F-16-006): какие ресурсы сейчас привязаны к услуге */
export function listResourcesForService(businessId: Id, serviceId: Id): Promise<Resource[]> {
  if (isApiMode()) return R.listResourcesForService(businessId, serviceId);
  return request(() => readCore().resources.filter((r) => r.businessId === businessId && r.serviceIds.includes(serviceId)));
}

export function toggleServiceResource(resourceId: Id, serviceId: Id, linked: boolean): Promise<Resource> {
  if (isApiMode()) return R.toggleServiceResource(resourceId, serviceId, linked);
  return request(() => {
    const resource = coreTx.get('resources', resourceId);
    const serviceIds = linked ? Array.from(new Set([...resource.serviceIds, serviceId])) : resource.serviceIds.filter((id) => id !== serviceId);
    return coreTx.update('resources', resourceId, { serviceIds });
  });
}

// ─────────────────────────── Сохранение формы ресурса целиком (одна кнопка «Сохранить») ───────────────────────────

/** Экземпляр в черновике формы: id — у уже существующего, нет id — новый */
export interface ResourceInstanceDraft {
  id?: Id;
  name: string;
}

export interface ResourceSaveInput {
  name: LocalizedText;
  description: string;
  kind: Resource['kind'];
  locationId: Id;
  serviceIds: Id[];
  instances: ResourceInstanceDraft[];
}

function applyInstances(current: Resource['instances'], drafts: ResourceInstanceDraft[]): Resource['instances'] {
  if (!drafts.length) throw new ApiError('last_instance');
  const known = new Set(current.map((i) => i.id));
  return drafts.map((d, i) => ({
    id: d.id && known.has(d.id) ? d.id : newId('resinst'),
    name: d.name.trim() || String(i + 1),
  }));
}

/**
 * Создать ресурс со всеми экземплярами одним сохранением (F-16-003, F-16-004). Раньше экземпляры добавлялись только
 * после создания, по одному окну на каждый — «три кресла» было тремя лишними заходами.
 */
export async function createResourceFull(businessId: Id, input: ResourceSaveInput): Promise<ResourceWithMeta> {
  if (isApiMode()) {
    const created = await R.createResource({ businessId, locationId: input.locationId, name: input.name, description: input.description, kind: input.kind, serviceIds: input.serviceIds });
    const [first, ...rest] = input.instances;
    if (first && first.name.trim() && created.instances[0] && first.name.trim() !== created.instances[0].name) {
      await R.renameResourceInstance(created.id, created.instances[0].id, first.name.trim());
    }
    for (const inst of rest) await R.addResourceInstance(created.id, inst.name.trim());
    return R.getResource(created.id);
  }
  return request(() => {
    const id = newId('res');
    const created = coreTx.create('resources', {
      id,
      businessId,
      locationId: input.locationId,
      name: input.name,
      kind: input.kind,
      serviceIds: input.serviceIds,
      instances: applyInstances([], input.instances.length ? input.instances : [{ name: '1' }]),
      active: true,
    });
    if (input.description.trim()) {
      mutateArea('resources', (s) => {
        s.descriptions[id] = input.description.trim();
      });
    }
    logResourcesChange(businessId, 'resource', id, 'create', created.name.ru || created.name.en || id);
    return withDescription(created);
  });
}

/** Сохранить форму ресурса: поля, привязанные услуги и экземпляры — одной транзакцией (моки) */
export async function saveResourceFull(id: Id, input: ResourceSaveInput): Promise<ResourceWithMeta> {
  if (isApiMode()) {
    const before = await R.getResource(id);
    await R.updateResource(id, { name: input.name, description: input.description, kind: input.kind, locationId: input.locationId, serviceIds: input.serviceIds });
    if (!input.instances.length) throw new ApiError('last_instance');
    const keep = new Set(input.instances.map((i) => i.id).filter(Boolean));
    for (const inst of input.instances) {
      if (!inst.id) await R.addResourceInstance(id, inst.name.trim());
      else {
        const prev = before.instances.find((i) => i.id === inst.id);
        if (prev && inst.name.trim() && prev.name !== inst.name.trim()) await R.renameResourceInstance(id, inst.id, inst.name.trim());
      }
    }
    for (const prev of before.instances) if (!keep.has(prev.id)) await R.removeResourceInstance(id, prev.id);
    return R.getResource(id);
  }
  return request(() => {
    const resource = coreTx.get('resources', id);
    const updated = coreTx.update('resources', id, {
      name: input.name,
      kind: input.kind,
      locationId: input.locationId,
      serviceIds: input.serviceIds,
      instances: applyInstances(resource.instances, input.instances),
    });
    mutateArea('resources', (s) => {
      if (input.description.trim()) s.descriptions[id] = input.description.trim();
      else delete s.descriptions[id];
    });
    logResourcesChange(updated.businessId, 'resource', id, 'update', updated.name.ru || updated.name.en || id);
    return withDescription(updated);
  });
}

/**
 * В архив / из архива (Resource.active): архивный ресурс не занимается ни одной новой записью и не режет окна, но
 * остаётся в старых записях и в истории — в отличие от удаления, которое id ресурса теряет навсегда.
 */
export function setResourceActive(id: Id, active: boolean): Promise<ResourceWithMeta> {
  if (isApiMode()) return R.updateResource(id, { active });
  return request(() => {
    const updated = coreTx.update('resources', id, { active });
    logResourcesChange(updated.businessId, 'resource', id, 'update', updated.name.ru || updated.name.en || id);
    return withDescription(updated);
  });
}

/** Будущие записи и события по каждому экземпляру — предупреждение перед тем, как убрать экземпляр */
export function countFutureUsageByInstance(resourceId: Id): Promise<Record<Id, number>> {
  if (isApiMode()) return R.countFutureUsageByInstance(resourceId);
  return request(() => {
    const core = readCore();
    const resource = core.resources.find((r) => r.id === resourceId);
    const out: Record<Id, number> = {};
    if (!resource) return out;
    const now = nowDateTime();
    for (const inst of resource.instances) out[inst.id] = 0;
    for (const b of core.bookings) {
      if (!occupiesTime(b) || b.groupEventId || b.start < now) continue;
      for (const rid of b.resourceIds) if (rid in out) out[rid]++;
    }
    for (const e of core.groupEvents) {
      if (e.status !== 'scheduled' || e.start < now) continue;
      for (const rid of e.resourceIds) if (rid in out) out[rid]++;
    }
    return out;
  });
}

export interface ResourceDayItem {
  id: Id;
  kind: 'booking' | 'event';
  start: ISODateTime;
  durationMin: number;
  services: LocalizedText[];
  staffName?: string;
}

export interface ResourceDayLoad {
  instances: { id: Id; name: string; items: ResourceDayItem[] }[];
}

/** Занятость ресурса на день по экземплярам (F-16-019 — расписание ресурса без перехода в журнал) */
export function getResourceDayLoad(resourceId: Id, date: ISODate): Promise<ResourceDayLoad> {
  if (isApiMode()) return R.getResourceDayLoad<ResourceDayLoad>(resourceId, date);
  return request(() => {
    const core = readCore();
    const resource = core.resources.find((r) => r.id === resourceId);
    if (!resource) throw new ApiError('not_found');
    const serviceName = new Map(core.services.map((s) => [s.id, s.name] as const));
    const staffName = new Map(core.staff.map((s) => [s.id, s.name] as const));
    const byInstance = new Map(resource.instances.map((i) => [i.id, [] as ResourceDayItem[]] as const));
    for (const b of core.bookings) {
      if (b.businessId !== resource.businessId || !occupiesTime(b) || b.groupEventId || datePart(b.start) !== date) continue;
      for (const rid of b.resourceIds) {
        byInstance.get(rid)?.push({
          id: b.id,
          kind: 'booking',
          start: b.start,
          durationMin: b.durationMin,
          services: b.services.map((l) => serviceName.get(l.serviceId)).filter((n): n is LocalizedText => Boolean(n)),
          staffName: staffName.get(b.staffId),
        });
      }
    }
    for (const e of core.groupEvents) {
      if (e.businessId !== resource.businessId || e.status !== 'scheduled' || datePart(e.start) !== date) continue;
      for (const rid of e.resourceIds) {
        byInstance.get(rid)?.push({
          id: e.id,
          kind: 'event',
          start: e.start,
          durationMin: e.durationMin,
          services: [serviceName.get(e.serviceId)].filter((n): n is LocalizedText => Boolean(n)),
          staffName: staffName.get(e.staffId),
        });
      }
    }
    return {
      instances: resource.instances.map((i) => ({ id: i.id, name: i.name, items: (byInstance.get(i.id) ?? []).sort((a, b) => a.start.localeCompare(b.start)) })),
    };
  });
}

// ─────────────────────────── Занятость ресурсов (F-16-008…017) ───────────────────────────

/** F-16-016: строки записи с явным resourceId занимают ресурс только на своё окно, по порядку в массиве services */
function bookingLineWindows(b: Booking): { resourceId: Id; startOffsetMin: number; durationMin: number }[] | undefined {
  if (!b.services.some((line) => line.resourceId)) return undefined;
  let offset = 0;
  const out: { resourceId: Id; startOffsetMin: number; durationMin: number }[] = [];
  for (const line of b.services) {
    const durationMin = line.durationMin * Math.max(1, line.qty);
    if (line.resourceId) out.push({ resourceId: line.resourceId, startOffsetMin: offset, durationMin });
    offset += durationMin;
  }
  return out;
}

function toBusyBookings(core: ReturnType<typeof readCore>, excludeBookingId?: Id): ResourceBusyBooking[] {
  const bufferByService = new Map(core.services.map((s) => [s.id, s.bufferAfterMin ?? 0] as const));
  // Одна настройка на кабинет — «Разделять запись по ресурсам» журнала (F-01-132 = F-16-016): раньше у раздела была своя
  // копия с обратным умолчанием, и два переключателя в разных местах показывали разное.
  const splitByResource = Boolean((readArea('journal') as { prefs?: { splitByResourceEnabled?: boolean } }).prefs?.splitByResourceEnabled);
  return core.bookings
    .filter((b) => b.id !== excludeBookingId)
    .map((b) => ({
      id: b.id,
      start: b.start,
      durationMin: b.durationMin,
      resourceIds: b.resourceIds,
      occupiesTime: !b.deletedAt && !(['cancelled_by_client', 'cancelled_by_master', 'no_show'] as string[]).includes(b.status),
      bufferAfterMin: Math.max(0, ...b.services.map((line) => bufferByService.get(line.serviceId) ?? 0), 0),
      lineWindows: splitByResource ? bookingLineWindows(b) : undefined,
    }));
}

function toBusyEvents(core: ReturnType<typeof readCore>): ResourceBusyEvent[] {
  return core.groupEvents.map((e) => ({ id: e.id, start: e.start, durationMin: e.durationMin, resourceIds: e.resourceIds, cancelled: e.status !== 'scheduled' }));
}

/** По одному свободному экземпляру каждого ресурса услуги (F-16-011); чего-то не хватает — undefined (F-16-012) */
export function pickFreeResourceInstances(businessId: Id, serviceIds: Id[], start: ISODateTime, durationMin: number, excludeBookingId?: Id): Promise<Id[] | undefined> {
  if (isApiMode()) return R.pickFreeResourceInstances(businessId, serviceIds, start, durationMin, excludeBookingId);
  return request(() => {
    const core = readCore();
    const resources = core.resources.filter((r) => r.businessId === businessId && r.active && r.serviceIds.some((id) => serviceIds.includes(id)));
    if (!resources.length) return [];
    const byResource = new Map(resources.map((r) => [r.id, r.instances.map((i) => i.id)] as const));
    return pickFreeInstances(resources.map((r) => r.id), byResource, start, durationMin, toBusyBookings(core, excludeBookingId), toBusyEvents(core), excludeBookingId);
  });
}

/** Свободны ли именно эти экземпляры (ручной выбор в окне записи, F-16-013) */
export function checkResourceInstancesFree(instanceIds: Id[], start: ISODateTime, durationMin: number, excludeBookingId?: Id): Promise<boolean> {
  if (isApiMode()) return R.checkResourceInstancesFree(instanceIds, start, durationMin, excludeBookingId);
  return request(() => {
    const core = readCore();
    return checkInstancesFree(instanceIds, start, durationMin, toBusyBookings(core, excludeBookingId), toBusyEvents(core), excludeBookingId);
  });
}

export interface ResourceOption {
  resource: Resource;
  instances: { id: Id; name: string; busy: boolean }[];
}

/** Все активные ресурсы локации с отметкой занятых сейчас экземпляров — окно записи, F-16-013 */
export function listResourceOptions(businessId: Id, start: ISODateTime, durationMin: number, excludeBookingId?: Id): Promise<ResourceOption[]> {
  if (isApiMode()) return R.listResourceOptions(businessId, start, durationMin, excludeBookingId);
  return request(() => {
    const core = readCore();
    const bookings = toBusyBookings(core, excludeBookingId);
    const events = toBusyEvents(core);
    return core.resources
      .filter((r) => r.businessId === businessId && r.active)
      .map((r) => ({
        resource: r,
        instances: r.instances.map((i) => ({ id: i.id, name: i.name, busy: !checkInstancesFree([i.id], start, durationMin, bookings, events, excludeBookingId) })),
      }));
  });
}

// ─────────────────────────── Групповые услуги и события (GroupEvent — ядро) ───────────────────────────

export function listGroupServices(businessId: Id): Promise<Service[]> {
  return coreList('services', (s) => s.businessId === businessId && s.kind === 'group');
}

export interface EventParticipant {
  booking: Booking;
  client?: Client;
}

export function listEventParticipants(eventId: Id): Promise<EventParticipant[]> {
  if (isApiMode()) return R.listEventParticipants(eventId);
  return request(() => {
    const core = readCore();
    return core.bookings
      .filter((b) => b.groupEventId === eventId && !b.deletedAt)
      .map((b) => ({ booking: b, client: core.clients.find((c) => c.id === b.clientId) }))
      .sort((a, b) => a.booking.createdAt.localeCompare(b.booking.createdAt));
  });
}

/** Занятые места (F-16-044, F-16-047): отменённые/неявка брони места не держат — считаем только активные */
export function seatsTaken(participants: EventParticipant[]): number {
  return participants.reduce((n, p) => (occupiesTime(p.booking) ? n + Math.max(1, p.booking.services[0]?.qty ?? 1) : n), 0);
}

export interface AddParticipantInput {
  businessId: Id;
  locationId: Id;
  eventId: Id;
  staffId: Id;
  start: ISODateTime;
  name: string;
  phone: string;
  seats: number;
  visitorName?: string;
  comment?: string;
}

/** F-16-047/048/049: добавить участника; мест не хватает — ApiError('group_full') */
export function addParticipant(input: AddParticipantInput): Promise<Booking> {
  if (isApiMode()) return R.addParticipant(input);
  return request(async () => {
    const core = readCore();
    const event = core.groupEvents.find((e) => e.id === input.eventId);
    if (!event) throw new ApiError('not_found');
    const { booking } = await placeBooking({
      source: 'journal',
      businessId: input.businessId,
      locationId: input.locationId,
      staffId: input.staffId,
      start: input.start,
      services: [{ serviceId: event.serviceId, qty: Math.max(1, input.seats) }],
      groupEventId: input.eventId,
      client: { phone: input.phone, name: input.name },
      visitorName: input.visitorName,
      comment: input.comment,
    });
    return booking;
  });
}

/** F-16-048: снять участника — освобождает место */
export function removeParticipant(bookingId: Id): Promise<void> {
  if (isApiMode()) return R.removeParticipant(bookingId);
  return withServerWrites(() => request(() => {
    coreTx.update('bookings', bookingId, { deletedAt: nowDateTime() });
  }));
}

// ─────────────────────────── Лист ожидания бизнеса — ОДИН (F-16-149…168 + F-01-156…162) ───────────────────────────
//
// Владелец, 30.09.2026: у бизнеса один лист ожидания — срез resources.waitlist (на сервере — /v1/biz/{b}/resources/waitlist
// над таблицей waitlist_entries). В него пишут все входы: сотрудник (экран /biz/waitlist, панель журнала), клиент из
// приложения («Сообщить, когда освободится», api/client.ts) и из виджета записи (api/online.ts) — через waitlistTx ниже.
// Старые места в сохранённых базах (journal.waitlistEntries, client.waitlist, online.waitlistRequests) читаются вместе
// с листом и переносятся в него при первой записи (absorbLegacyWaitlist) — версии срезов не поднимаем, чтобы не стирать
// остальное; перенесённые id помним в waitlistImported, удалённая потом заявка из старого места не «воскресает».

type LegacyJournalHolder = { waitlistEntries?: unknown };
type LegacyClientHolder = { waitlist?: unknown };
type LegacyOnlineHolder = { waitlistRequests?: unknown };
type LegacyMoved = { entry: WaitlistEntry; notifiedAt?: ISODateTime };

const isObj = (e: unknown): e is Record<string, unknown> => Boolean(e) && typeof e === 'object';

/** Заявки старой панели журнала, ещё не перенесённые (только мок; в битой базе — пропускаем, не падаем) */
function legacyJournalWaitlist(skip: Set<Id>): WaitlistEntry[] {
  const raw = (readArea('journal') as unknown as LegacyJournalHolder | undefined)?.waitlistEntries;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return (raw as Partial<LegacyJournalWaitlistEntry>[]).flatMap((e) =>
    isObj(e) && e.id && e.businessId && typeof e.clientName === 'string' && !skip.has(e.id)
      ? [waitlistFromLegacyJournal({ locationId: '', clientName: '', clientPhone: '', createdAt: '', ...e } as LegacyJournalWaitlistEntry)]
      : [],
  );
}

/** «Сообщить, когда освободится» из приложения до 01.10.2026 (client.waitlist): бизнес и филиал — по мастеру, кто — по пользователю */
function legacyAppWaitlist(skip: Set<Id>): LegacyMoved[] {
  if (readArea('resources').waitlistLegacyDone) return [];
  const raw = (readArea('client') as unknown as LegacyClientHolder | undefined)?.waitlist;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const core = readCore();
  return (raw as Partial<LegacyAppWaitlistEntry>[]).flatMap((e): LegacyMoved[] => {
    if (!isObj(e) || !e.id || !e.appUserId || !e.staffId || !e.serviceId || skip.has(e.id)) return [];
    const staff = core.staff.find((x) => x.id === e.staffId);
    if (!staff) return [];
    const user = (core.appUsers ?? []).find((u) => u.id === e.appUserId);
    const locationId = staff.locationIds?.[0] ?? core.locations.find((l) => l.businessId === staff.businessId)?.id ?? '';
    const entry = waitlistFromLegacyApp({ date: 'any', createdAt: nowDateTime(), ...e } as LegacyAppWaitlistEntry, {
      businessId: staff.businessId,
      locationId,
      clientName: user?.name ?? '',
      clientPhone: user?.phone ?? '',
    });
    return [{ entry, notifiedAt: e.notifiedAt }];
  });
}

/** Заявки виджета записи до 01.10.2026 (online.waitlistRequests) */
function legacyWidgetWaitlist(skip: Set<Id>): LegacyMoved[] {
  if (readArea('resources').waitlistLegacyDone) return [];
  const raw = (readArea('online') as unknown as LegacyOnlineHolder | undefined)?.waitlistRequests;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return (raw as Partial<LegacyWidgetWaitlistEntry>[]).flatMap((e): LegacyMoved[] => {
    if (!isObj(e) || !e.id || !e.businessId || !e.staffId || !e.serviceId || !e.date || skip.has(e.id)) return [];
    const entry = waitlistFromLegacyWidget({ clientName: '', clientPhone: '', createdAt: nowDateTime(), ...e } as LegacyWidgetWaitlistEntry);
    return entry ? [{ entry }] : [];
  });
}

function legacySkipSet(): Set<Id> {
  const res = readArea('resources');
  return new Set([...(res.waitlist ?? []).map((w) => w.id), ...(res.waitlistImported ?? [])]);
}

/** Весь лист бизнеса (или всех бизнесов) — синхронно, внутри request(): его читают экран, панель журнала и «Предложить окно» */
export function waitlistEntriesSync(businessId?: Id): WaitlistEntry[] {
  const own = (readArea('resources').waitlist ?? []).map(withWaitlistDefaults);
  const skip = legacySkipSet();
  const legacy = [
    ...legacyJournalWaitlist(skip),
    ...legacyAppWaitlist(skip).map((m) => m.entry),
    ...legacyWidgetWaitlist(skip).map((m) => m.entry),
  ];
  const all = [...own, ...legacy];
  return businessId ? all.filter((w) => w.businessId === businessId) : all;
}

/** Перенос старых заявок в один лист — первым шагом каждой записи в лист (в том же request()) */
function absorbLegacyWaitlist(): void {
  const journal = readArea('journal') as unknown as LegacyJournalHolder | undefined;
  if (journal && 'waitlistEntries' in journal) {
    const legacy = legacyJournalWaitlist(legacySkipSet());
    if (legacy.length > 0) {
      mutateArea('resources', (s) => {
        s.waitlist = [...legacy, ...(s.waitlist ?? [])];
      });
    }
    mutateArea('journal', (s) => {
      delete (s as unknown as LegacyJournalHolder).waitlistEntries;
    });
  }
  // Приложение и виджет: старые массивы в чужих срезах не трогаем — помним перенесённые id
  if (readArea('resources').waitlistLegacyDone) return;
  const skip = legacySkipSet();
  const moved = [...legacyAppWaitlist(skip), ...legacyWidgetWaitlist(skip)];
  mutateArea('resources', (s) => {
    // Новых заявок в старых местах не бывает (их никто не пишет) — после переноса старые срезы больше не читаем
    s.waitlistLegacyDone = true;
    if (moved.length === 0) return;
    s.waitlist = [...moved.map((m) => m.entry), ...(s.waitlist ?? [])];
    s.waitlistImported = [...(s.waitlistImported ?? []), ...moved.map((m) => m.entry.id)];
    s.waitlistNotified ??= {};
    for (const m of moved) if (m.notifiedAt) s.waitlistNotified[m.entry.id] = [m.notifiedAt];
  });
}

export function listWaitlist(businessId: Id): Promise<WaitlistEntry[]> {
  if (isApiMode()) return R.listWaitlist(businessId).then((rows) => rows.map(withWaitlistDefaults));
  return request(() => waitlistEntriesSync(businessId));
}

/** Заявки, сохранённые до появления полей (старые демо-базы), дополняем пустыми списками — иначе экран падает на .length */
function withWaitlistDefaults(w: WaitlistEntry): WaitlistEntry {
  return { ...w, serviceIds: w.serviceIds ?? [], staffIds: w.staffIds ?? [], wishes: w.wishes ?? [], tags: w.tags ?? [] };
}

/** Один ключ на оба вида листа: заявка, созданная в панели журнала, сразу видна на /biz/waitlist и наоборот */
export function useWaitlist(businessId: Id | undefined, options?: QueryOptions): QueryResult<WaitlistEntry[]> {
  return useApiQuery(resourcesKeys.waitlist(businessId), () => listWaitlist(businessId ?? ''), { enabled: Boolean(businessId), ...options });
}

export interface WaitlistEntryInput {
  businessId: Id;
  locationId: Id;
  clientName: string;
  clientPhone: string;
  serviceIds: Id[];
  /** F-16-152: пусто — «любой специалист», можно указать нескольких */
  staffIds?: Id[];
  wishes: WaitlistWish[];
  comment?: string;
}

/** Одна вставка для всех входов: проверки, перенос старых данных, аудит */
function insertWaitlistEntry(input: WaitlistEntryInput, from: { source: WaitlistSource; appUserId?: Id }): WaitlistEntry {
  if (!input.clientName.trim()) throw new ApiError('name_required');
  const phone = normalizePhone(input.clientPhone);
  if (!phone) throw new ApiError('invalid_phone');
  if (!input.serviceIds.length) throw new ApiError('service_required');
  absorbLegacyWaitlist();
  const entry: WaitlistEntry = {
    id: newId('wl'),
    businessId: input.businessId,
    locationId: input.locationId,
    clientName: input.clientName.trim(),
    clientPhone: phone,
    source: from.source,
    ...(from.appUserId ? { appUserId: from.appUserId } : {}),
    serviceIds: input.serviceIds,
    staffIds: input.staffIds ?? [],
    wishes: input.wishes,
    comment: input.comment?.trim() || undefined,
    tags: [],
    createdAt: nowDateTime(),
  };
  mutateArea('resources', (s) => {
    s.waitlist = [entry, ...s.waitlist];
  });
  logResourcesChange(entry.businessId, 'waitlist', entry.id, 'create', entry.clientName);
  return entry;
}

/** F-16-149/F-16-150…154 и F-01-157 «+ Создать» — из экрана листа и из панели журнала */
export function addToWaitlist(input: WaitlistEntryInput): Promise<WaitlistEntry> {
  if (isApiMode()) return R.addToWaitlist(input);
  return request(() => insertWaitlistEntry(input, { source: 'staff' }));
}

/**
 * Лист ожидания для других разделов — синхронно, внутри СВОЕГО request() вызывающего (одна транзакция): приложение клиента
 * (api/client.ts), виджет записи (api/online.ts), раздача окна (api/journal-offers.ts). Свой список заявок они не держат.
 */
export const waitlistTx = {
  entries: waitlistEntriesSync,
  /** Клиент сам встал в лист (приложение, виджет) */
  add(input: WaitlistEntryInput, from: { source: Exclude<WaitlistSource, 'staff'>; appUserId?: Id }): WaitlistEntry {
    return insertWaitlistEntry(input, from);
  },
  /** Клиент сам убрал свою заявку из приложения (чужую — нет) */
  removeOwn(id: Id, appUserId: Id): void {
    absorbLegacyWaitlist();
    mutateArea('resources', (s) => {
      s.waitlist = s.waitlist.filter((w) => !(w.id === id && w.appUserId === appUserId));
    });
  },
  /** Удаление аккаунта приложения: его заявки уходят из листа */
  removeAllOf(appUserId: Id): void {
    absorbLegacyWaitlist();
    mutateArea('resources', (s) => {
      s.waitlist = s.waitlist.filter((w) => w.appUserId !== appUserId);
    });
  },
  /** Отметка «Уведомлён» — одна история на заявку (экран, панель, «Предложить окно», отмена клиентом) */
  markNotified(ids: Id[], at: ISODateTime): void {
    if (ids.length === 0) return;
    absorbLegacyWaitlist();
    mutateArea('resources', (s) => {
      s.waitlistNotified ??= {};
      for (const id of ids) s.waitlistNotified[id] = [...(s.waitlistNotified[id] ?? []), at];
    });
  },
  /** Последняя отметка «Уведомлён» — приложению клиента («Окно освобождалось») */
  lastNotifiedAt(id: Id): ISODateTime | undefined {
    const times = readArea('resources').waitlistNotified?.[id];
    return times?.[times.length - 1];
  },
};

/** F-16-164 / F-01-161: правит любую часть заявки (у закрытой в UI пункта «Изменить» нет — здесь тоже запрещаем) */
export function updateWaitlistEntry(
  id: Id,
  patch: Partial<Pick<WaitlistEntryInput, 'clientName' | 'clientPhone' | 'serviceIds' | 'staffIds' | 'wishes' | 'comment'>>,
): Promise<WaitlistEntry> {
  if (isApiMode()) return R.updateWaitlistEntry(id, patch);
  return request(() => {
    absorbLegacyWaitlist();
    const existing = readArea('resources').waitlist.find((w) => w.id === id);
    if (!existing) throw new ApiError('not_found');
    if (existing.closedBookingId) throw new ApiError('waitlist_entry_closed');
    if (patch.clientName !== undefined && !patch.clientName.trim()) throw new ApiError('name_required');
    const phone = patch.clientPhone !== undefined ? normalizePhone(patch.clientPhone) : undefined;
    if (patch.clientPhone !== undefined && !phone) throw new ApiError('invalid_phone');
    if (patch.serviceIds !== undefined && patch.serviceIds.length === 0) throw new ApiError('service_required');
    let next: WaitlistEntry = existing;
    mutateArea('resources', (s) => {
      s.waitlist = s.waitlist.map((w) => {
        if (w.id !== id) return w;
        next = {
          ...w,
          clientName: patch.clientName !== undefined ? patch.clientName.trim() : w.clientName,
          clientPhone: phone ?? w.clientPhone,
          serviceIds: patch.serviceIds ?? w.serviceIds,
          staffIds: patch.staffIds ?? w.staffIds,
          wishes: patch.wishes ?? w.wishes,
          comment: patch.comment !== undefined ? patch.comment.trim() || undefined : w.comment,
        };
        return next;
      });
    });
    logResourcesChange(existing.businessId, 'waitlist', id, 'update', next.clientName);
    return next;
  });
}

/** F-16-163 / F-01-159: «Записать» → сохранение записи → заявка «Закрытая» со ссылкой на запись (с экрана и из панели) */
export function closeWaitlistEntry(id: Id, bookingId: Id): Promise<void> {
  if (isApiMode()) return R.closeWaitlistEntry(id, bookingId);
  return request(() => {
    absorbLegacyWaitlist();
    if (!readArea('resources').waitlist.some((w) => w.id === id)) throw new ApiError('not_found');
    mutateArea('resources', (s) => {
      s.waitlist = s.waitlist.map((w) => (w.id === id ? { ...w, closedBookingId: bookingId } : w));
    });
  });
}

/** F-16-163/F-16-165: закрытую заявку можно только удалить; удаление безвозвратно, в аудит не пишется (344140) */
export function removeWaitlistEntry(id: Id): Promise<void> {
  if (isApiMode()) return R.removeWaitlistEntry(id);
  return request(() => {
    absorbLegacyWaitlist();
    mutateArea('resources', (s) => {
      s.waitlist = s.waitlist.filter((w) => w.id !== id);
      delete s.waitlistNotified?.[id];
    });
  });
}

export interface WaitlistBookingPlan {
  staffId?: Id;
  date: ISODate;
  /** Нет — свободного окна под заявку не нашли, время выберут в окне записи */
  time?: string;
  /**
   * Желаемое время заявки занято: окно записи открывается на ближайшем свободном времени мастера (с дня желания),
   * экран показывает подсказку «Желаемое время занято» (решение 01.10.2026)
   */
  wishBusy?: boolean;
}

/**
 * «Записать» из заявки (экран и панель журнала): мастер и ближайшее свободное время, которое заявка ждёт. Мастера — из
 * заявки, «любой» — те, кто делает услугу (и есть в журнале: `staffIds` передаёт вызывающий). Только чтения окон.
 */
export async function suggestWaitlistSlot(
  entry: WaitlistEntry,
  service: Pick<Service, 'id' | 'durationMin' | 'staffIds'> | undefined,
  journalStaffIds: Id[],
): Promise<WaitlistBookingPlan> {
  const day = today();
  const inJournal = new Set(journalStaffIds);
  const pool = (entry.staffIds.length ? entry.staffIds : (service?.staffIds ?? [])).filter((id) => inJournal.has(id));
  const wishDate = upcomingWish(entry, day)?.date;
  const fallback: WaitlistBookingPlan = { staffId: pool[0] ?? entry.staffIds[0], date: wishDate ?? day };
  if (!service || pool.length === 0) return fallback;
  const dated = [...new Set(entry.wishes.map((w) => w.date).filter((d): d is ISODate => Boolean(d) && d! >= day))].sort().slice(0, 5);
  const anyDay = entry.wishes.length === 0 || entry.wishes.some((w) => !w.date);
  const lists = await Promise.all(
    pool.flatMap((staffId) => [
      ...dated.map((date) => getFreeSlots({ staffId, date, durationMin: service.durationMin, serviceId: service.id }).catch(() => [])),
      ...(anyDay ? [getNearestSlots({ staffId, durationMin: service.durationMin, serviceId: service.id, days: 7, limit: 200 }).catch(() => [])] : []),
    ]),
  );
  const now = nowDateTime();
  const slot = pickWaitlistSlot(entry, lists.flat().filter((s) => s.start > now), day);
  if (slot) return { staffId: slot.staffId, date: slot.start.slice(0, 10), time: slot.start.slice(11, 16) };
  // Желаемое занято — ближайшее свободное у тех же мастеров, начиная с дня желания (раньше окно открывалось на занятом)
  const from = wishDate && wishDate > day ? wishDate : day;
  const days = Math.max(0, Math.round((Date.parse(from) - Date.parse(day)) / 86_400_000)) + 14;
  const nearest = await Promise.all(
    pool.map((staffId) => getNearestSlots({ staffId, durationMin: service.durationMin, serviceId: service.id, days, limit: 500 }).catch(() => [])),
  );
  const free = nearest.flat().filter((s) => s.start > now).sort((a, b) => a.start.localeCompare(b.start));
  const near = free.find((s) => s.start.slice(0, 10) >= from) ?? free[0];
  return near
    ? { staffId: near.staffId, date: near.start.slice(0, 10), time: near.start.slice(11, 16), wishBusy: true }
    : { ...fallback, wishBusy: true };
}

// ─────────────────────────── Повтор события по шаблону (F-16-064, F-16-065, F-16-101) ───────────────────────────

export function listEventTemplates(businessId: Id): Promise<EventTemplate[]> {
  if (isApiMode()) return R.listEventTemplates(businessId);
  return request(() => readArea('resources').eventTemplates.filter((t) => t.businessId === businessId));
}

export function saveEventTemplate(input: { businessId: Id; name: string; freq: RepeatFreq; weekIntervalWeeks?: number }): Promise<EventTemplate> {
  if (isApiMode()) return R.saveEventTemplate(input);
  return request(() => {
    const template: EventTemplate = { id: newId('evt'), businessId: input.businessId, name: input.name.trim(), freq: input.freq, weekIntervalWeeks: input.weekIntervalWeeks };
    mutateArea('resources', (s) => {
      s.eventTemplates = [...s.eventTemplates, template];
    });
    return template;
  });
}

export interface RepeatEventInput {
  eventId: Id;
  freq: RepeatFreq;
  weekIntervalWeeks?: number;
  startDate: string;
  end: RepeatEnd;
  /** «с записями и клиентами» — переносит участников исходного события в каждый повтор (F-16-064) */
  withClients: boolean;
  saveAsTemplateName?: string;
}

/**
 * F-16-064: копирует событие на будущие даты по шаблону. Повторы НЕ помечаются как серия — у GroupEvent.seriesId
 * остаётся пусто (147353: «у событий, созданных Повтором, особых отметок нет», в отличие от F-16-067 «Расписание»).
 * F-16-101: то же действие используется и «в приложении» — тот же вызов, другой экран не нужен (телефон = тот же UI).
 */
export function repeatEvent(input: RepeatEventInput): Promise<{ createdCount: number }> {
  if (isApiMode()) return R.repeatEvent(input);
  return withServerWrites(() => request(async () => {
    const core = readCore();
    const source = core.groupEvents.find((e) => e.id === input.eventId);
    if (!source) throw new ApiError('not_found');
    const time = timePart(source.start);
    const dates = repeatDates({ freq: input.freq, startDate: input.startDate, weekIntervalWeeks: input.weekIntervalWeeks, end: input.end });

    for (const date of dates) {
      const start = combine(date, time);
      const resourceIds = source.resourceIds.length ? ((await pickFreeResourceInstances(source.businessId, [source.serviceId], start, source.durationMin)) ?? []) : [];
      const created = coreTx.create('groupEvents', {
        id: newId('ev'),
        businessId: source.businessId,
        locationId: source.locationId,
        serviceId: source.serviceId,
        staffId: source.staffId,
        start,
        durationMin: source.durationMin,
        capacity: source.capacity,
        resourceIds,
        onlineUrl: source.onlineUrl,
        status: 'scheduled',
        createdAt: nowDateTime(),
      });
      if (input.withClients) {
        const participants = await listEventParticipants(source.id);
        for (const p of participants) {
          if (!occupiesTime(p.booking)) continue;
          try {
            await addParticipant({
              businessId: source.businessId,
              locationId: source.locationId,
              eventId: created.id,
              staffId: source.staffId,
              start,
              name: p.client?.name ?? p.booking.visitorName ?? '',
              phone: p.client?.phone ?? '',
              seats: Math.max(1, p.booking.services[0]?.qty ?? 1),
              visitorName: p.booking.visitorName,
              comment: p.booking.comment,
            });
          } catch {
            // мест могло не хватить (F-16-048) — повтор не должен падать целиком из-за одного участника
          }
        }
      }
    }

    if (input.saveAsTemplateName?.trim()) {
      mutateArea('resources', (s) => {
        s.eventTemplates = [
          ...s.eventTemplates,
          { id: newId('evt'), businessId: source.businessId, name: input.saveAsTemplateName!.trim(), freq: input.freq, weekIntervalWeeks: input.weekIntervalWeeks },
        ];
      });
    }
    return { createdCount: dates.length };
  }));
}

// ─────────────────────────── Расписание событий — серия (F-16-067…077) ───────────────────────────

function getSeriesDefOrThrow(seriesId: Id): EventSeriesDef {
  const def = readArea('resources').eventSeriesDefs[seriesId];
  if (!def) throw new ApiError('not_found');
  return def;
}

export function getSeriesDef(seriesId: Id | undefined): Promise<EventSeriesDef | undefined> {
  if (isApiMode()) return seriesId ? R.getSeriesDef(seriesId) : Promise.resolve(undefined);
  return request(() => (seriesId ? readArea('resources').eventSeriesDefs[seriesId] : undefined));
}

export function listSeriesEvents(seriesId: Id): Promise<GroupEvent[]> {
  if (isApiMode()) return R.listSeriesEvents(seriesId);
  return request(() => readCore().groupEvents.filter((e) => e.seriesId === seriesId).sort((a, b) => a.start.localeCompare(b.start)));
}

/**
 * F-16-042: сетка журнала показывает у события серии дату окончания расписания и значок «изменено
 * отдельно» — обоим нужен `EventSeriesDef` по `seriesId`, а не по одному событию. Точечная функция для
 * пачки событий на видимый день (не весь `eventSeriesDefs`, чтобы не тащить чужой бизнес).
 */
export function listEventSeriesDefsByIds(seriesIds: Id[]): Promise<Record<Id, EventSeriesDef>> {
  if (isApiMode()) return R.listEventSeriesDefsByIds(seriesIds);
  return request(() => {
    const all = readArea('resources').eventSeriesDefs;
    const out: Record<Id, EventSeriesDef> = {};
    for (const id of seriesIds) if (all[id]) out[id] = all[id];
    return out;
  });
}

/** Прошедшее событие серии — правок расписания нет (F-16-070) */
export function isPastEvent(event: Pick<GroupEvent, 'start'>): boolean {
  return datePart(event.start) < today();
}

function createSeriesEvent(source: GroupEvent, seriesId: Id, date: string, rule: SeriesDayRule): GroupEvent {
  return coreTx.create('groupEvents', {
    id: newId('ev'),
    businessId: source.businessId,
    locationId: source.locationId,
    serviceId: source.serviceId,
    staffId: source.staffId,
    start: combine(date, rule.startTime),
    durationMin: rule.durationMin,
    capacity: source.capacity,
    resourceIds: rule.resourceIds,
    seriesId,
    status: 'scheduled',
    createdAt: nowDateTime(),
  });
}

export interface CreateEventSeriesInput {
  sourceEventId: Id;
  days: SeriesDayRule[];
  endDate: string;
  /** ☐ «Добавить клиентов из текущего события» (F-16-067, F-16-078) */
  addClientsFromSource: boolean;
}

/**
 * F-16-067: создаёт расписание (серию) из уже существующего события. Исходное событие получает seriesId и
 * НЕ дублируется на свою же дату; остальные даты по правилу дней недели — новые события (F-16-068: здесь —
 * синхронно, без очереди «~100/мин» и значка «создаётся» — см. отчёт, partial).
 */
export function createEventSeries(input: CreateEventSeriesInput): Promise<{ seriesId: Id; createdCount: number }> {
  if (isApiMode()) return R.createEventSeries(input);
  return withServerWrites(() => request(async () => {
    const source = coreTx.get('groupEvents', input.sourceEventId);
    if (source.seriesId) throw new ApiError('already_series');
    const seriesId = newId('evs');
    const sourceDate = datePart(source.start);
    const occurrences = seriesOccurrences(input.days, sourceDate, input.endDate).filter((o) => !(o.date === sourceDate && o.rule.weekday === weekdayIndex(sourceDate)));
    const created: GroupEvent[] = [];
    for (const { date, rule } of occurrences) created.push(createSeriesEvent(source, seriesId, date, rule));
    coreTx.update('groupEvents', source.id, { seriesId });

    mutateArea('resources', (s) => {
      s.eventSeriesDefs = {
        ...s.eventSeriesDefs,
        [seriesId]: {
          id: seriesId,
          businessId: source.businessId,
          locationId: source.locationId,
          staffId: source.staffId,
          serviceId: source.serviceId,
          capacity: source.capacity,
          days: input.days,
          endDate: input.endDate,
          sourceEventId: source.id,
          uniqueEventIds: [],
          createdAt: nowDateTime(),
        },
      };
    });

    if (input.addClientsFromSource) {
      const participants = await listEventParticipants(source.id);
      const activeParticipants = participants.filter((p) => occupiesTime(p.booking));
      for (const event of created) {
        for (const p of activeParticipants) {
          try {
            await addParticipant({
              businessId: source.businessId,
              locationId: source.locationId,
              eventId: event.id,
              staffId: source.staffId,
              start: event.start,
              name: p.client?.name ?? p.booking.visitorName ?? '',
              phone: p.client?.phone ?? '',
              seats: Math.max(1, p.booking.services[0]?.qty ?? 1),
              visitorName: p.booking.visitorName,
              comment: p.booking.comment,
            });
          } catch {
            // мест могло не хватить — переносим остальных (F-16-048)
          }
        }
      }
      // F-16-078: каждому перенесённому клиенту сразу создаётся расписание посещений на все дни серии
      const weekdays = Array.from(new Set(input.days.map((d) => d.weekday)));
      mutateArea('resources', (s) => {
        s.visitSchedules = [
          ...s.visitSchedules,
          ...activeParticipants
            .filter((p) => Math.max(1, p.booking.services[0]?.qty ?? 1) === 1)
            .map((p): VisitScheduleEntry => ({
              id: newId('vsc'),
              seriesId,
              clientId: p.client?.id,
              clientName: p.client?.name ?? p.booking.visitorName ?? '',
              clientPhone: p.client?.phone ?? '',
              weekdays,
              createdAt: nowDateTime(),
            })),
        ];
      });
    }

    return { seriesId, createdCount: created.length };
  }));
}

/** F-16-071: продлить (создаёт недостающие события) или сократить (отменяет будущие сверх новой даты) серию */
export function extendOrShortenSeries(seriesId: Id, newEndDate: string): Promise<{ createdCount: number; cancelledCount: number }> {
  if (isApiMode()) return R.extendOrShortenSeries(seriesId, newEndDate);
  return withServerWrites(() => request(() => {
    const def = getSeriesDefOrThrow(seriesId);
    if (newEndDate < today()) throw new ApiError('invalid_end_date');
    let createdCount = 0;
    let cancelledCount = 0;
    if (newEndDate > def.endDate) {
      const occurrences = seriesOccurrences(def.days, addDays(def.endDate, 1), newEndDate);
      const source = coreTx.get('groupEvents', def.sourceEventId);
      for (const { date, rule } of occurrences) {
        createSeriesEvent(source, seriesId, date, rule);
        createdCount += 1;
      }
    } else if (newEndDate < def.endDate) {
      const core = readCore();
      const toCancel = core.groupEvents.filter((e) => e.seriesId === seriesId && e.status === 'scheduled' && datePart(e.start) > newEndDate);
      for (const e of toCancel) {
        coreTx.update('groupEvents', e.id, { status: 'cancelled' });
        cancelledCount += 1;
      }
    }
    mutateArea('resources', (s) => {
      s.eventSeriesDefs = { ...s.eventSeriesDefs, [seriesId]: { ...def, endDate: newEndDate } };
    });
    return { createdCount, cancelledCount };
  }));
}

/** F-16-072 (добавить день): создаёт будущие события этого дня недели до конца серии */
export function addSeriesWeekday(seriesId: Id, rule: SeriesDayRule): Promise<{ createdCount: number }> {
  if (isApiMode()) return R.addSeriesWeekday(seriesId, rule);
  return withServerWrites(() => request(() => {
    const def = getSeriesDefOrThrow(seriesId);
    const source = coreTx.get('groupEvents', def.sourceEventId);
    const occurrences = seriesOccurrences([rule], today(), def.endDate);
    for (const { date } of occurrences) createSeriesEvent(source, seriesId, date, rule);
    mutateArea('resources', (s) => {
      const days = [...def.days.filter((d) => d.weekday !== rule.weekday), rule];
      s.eventSeriesDefs = { ...s.eventSeriesDefs, [seriesId]: { ...def, days } };
    });
    return { createdCount: occurrences.length };
  }));
}

/** F-16-072 (удалить день): убирает ВСЕ будущие события серии этого дня недели (прошедшие остаются, F-16-070) */
export function removeSeriesWeekday(seriesId: Id, weekday: SeriesDayRule['weekday']): Promise<{ cancelledCount: number }> {
  if (isApiMode()) return R.removeSeriesWeekday(seriesId, weekday);
  return withServerWrites(() => request(() => {
    const def = getSeriesDefOrThrow(seriesId);
    const core = readCore();
    const now = today();
    const toCancel = core.groupEvents.filter((e) => e.seriesId === seriesId && e.status === 'scheduled' && datePart(e.start) >= now && weekdayIndex(datePart(e.start)) === weekday);
    for (const e of toCancel) coreTx.update('groupEvents', e.id, { status: 'cancelled' });
    mutateArea('resources', (s) => {
      s.eventSeriesDefs = { ...s.eventSeriesDefs, [seriesId]: { ...def, days: def.days.filter((d) => d.weekday !== weekday) } };
    });
    return { cancelledCount: toCancel.length };
  }));
}

/**
 * F-16-071 (время/длительность/ресурсы дня) и F-16-074 «Применить изменения к уникальным событиям»: правит
 * будущие события дня недели серии; событие, изменённое отдельно (F-16-075), пропускается, если
 * applyToUnique не отмечена. F-16-073: услугу этим путём не сменить — в типе patch её нет.
 */
export function editSeriesDayRule(
  seriesId: Id,
  weekday: SeriesDayRule['weekday'],
  patch: Partial<Pick<SeriesDayRule, 'startTime' | 'durationMin' | 'resourceIds'>>,
  applyToUnique: boolean,
): Promise<{ updatedCount: number; skippedUniqueCount: number }> {
  if (isApiMode()) return R.editSeriesDayRule(seriesId, weekday, patch, applyToUnique);
  return withServerWrites(() => request(() => {
    const def = getSeriesDefOrThrow(seriesId);
    const rule = def.days.find((d) => d.weekday === weekday);
    if (!rule) throw new ApiError('not_found');
    const nextRule: SeriesDayRule = { ...rule, ...patch };
    const core = readCore();
    const now = today();
    const dayEvents = core.groupEvents.filter((e) => e.seriesId === seriesId && e.status === 'scheduled' && datePart(e.start) >= now && weekdayIndex(datePart(e.start)) === weekday);
    let updatedCount = 0;
    let skippedUniqueCount = 0;
    for (const e of dayEvents) {
      if (def.uniqueEventIds.includes(e.id) && !applyToUnique) {
        skippedUniqueCount += 1;
        continue;
      }
      coreTx.update('groupEvents', e.id, {
        start: combine(datePart(e.start), nextRule.startTime),
        durationMin: nextRule.durationMin,
        resourceIds: nextRule.resourceIds,
      });
      updatedCount += 1;
    }
    mutateArea('resources', (s) => {
      s.eventSeriesDefs = { ...s.eventSeriesDefs, [seriesId]: { ...def, days: def.days.map((d) => (d.weekday === weekday ? nextRule : d)) } };
    });
    return { updatedCount, skippedUniqueCount };
  }));
}

/** F-16-076 «Удалить серию»: отменяет все будущие события серии, прошедшие остаются в отчётах (F-16-070) */
export function deleteSeries(seriesId: Id): Promise<{ cancelledCount: number }> {
  if (isApiMode()) return R.deleteSeries(seriesId);
  return withServerWrites(() => request(() => {
    getSeriesDefOrThrow(seriesId);
    const core = readCore();
    const now = today();
    const toCancel = core.groupEvents.filter((e) => e.seriesId === seriesId && e.status === 'scheduled' && datePart(e.start) >= now);
    for (const e of toCancel) coreTx.update('groupEvents', e.id, { status: 'cancelled' });
    mutateArea('resources', (s) => {
      const rest = { ...s.eventSeriesDefs };
      delete rest[seriesId];
      s.eventSeriesDefs = rest;
    });
    return { cancelledCount: toCancel.length };
  }));
}

/**
 * F-16-066 «Массовое удаление лишних событий»: отменяет разом несколько будущих событий (лишние повторы,
 * группы, которые не набрались) с одной кнопки — на списке `/biz/groups`. Прошедшие события не трогает,
 * пишет в общий журнал операций (F-00-040), 5-секундное «Отменить» — на самом экране (toast).
 */
export function deleteGroupEvents(businessId: Id, eventIds: Id[]): Promise<{ cancelledCount: number }> {
  if (isApiMode()) return R.deleteGroupEvents(businessId, eventIds);
  return withServerWrites(() => request(() => {
    const now = today();
    const core = readCore();
    const toCancel = core.groupEvents.filter(
      (e) => eventIds.includes(e.id) && e.businessId === businessId && e.status === 'scheduled' && datePart(e.start) >= now,
    );
    for (const e of toCancel) coreTx.update('groupEvents', e.id, { status: 'cancelled' });
    coreTx.logDataOperation({ businessId, kind: 'delete', area: 'resources', entity: 'groupEvents', count: toCancel.length });
    return { cancelledCount: toCancel.length };
  }));
}

/** Отмена «Массового удаления» (F-16-066): возвращает переданные события в «Запланировано» */
export function restoreGroupEvents(eventIds: Id[]): Promise<{ restoredCount: number }> {
  if (isApiMode()) return R.restoreGroupEvents(eventIds);
  return withServerWrites(() => request(() => {
    let restoredCount = 0;
    for (const id of eventIds) {
      const e = coreTx.get('groupEvents', id);
      if (e.status === 'cancelled') {
        coreTx.update('groupEvents', id, { status: 'scheduled' });
        restoredCount += 1;
      }
    }
    return { restoredCount };
  }));
}

/**
 * F-16-075: правка/удаление ОДНОГО события серии помечает его «уникальным» — правки серии больше его не трогают (F-16-074).
 *
 * Этап 21 (лейн «resources+helpers»): сам патч события (`coreTx.update('groupEvents', …)`) уже реально долетает
 * до сервера через `withServerWrites` → `J.replayCoreWrites` (этап 7, покрывает `bookings`/`groupEvents`) — это
 * общий `PATCH .../events/:id` (journal-модуль), одинаковый в обоих режимах. Пометка «уникальное» раньше была
 * только в `mutateArea('resources', …)` (своя area, replay её не знает) — в режиме api теперь пишется на сервер
 * отдельным маршрутом (`POST .../events/:id/mark-series-unique`, `ResourcesEventsService.markEventUniqueInSeries`),
 * тем же приёмом, что уже применяют `saveEventParams`/`editSeriesDayRule`.
 */
export function updateSeriesEvent(eventId: Id, patch: Partial<Omit<GroupEvent, 'id' | 'createdAt'>>): Promise<GroupEvent> {
  return withServerWrites(() => request(async () => {
    const event = coreTx.get('groupEvents', eventId);
    const updated = coreTx.update('groupEvents', eventId, patch);
    if (event.seriesId) {
      if (isApiMode()) {
        await R.markEventUniqueInSeries(eventId);
      } else {
        mutateArea('resources', (s) => {
          const def = s.eventSeriesDefs[event.seriesId!];
          if (def && !def.uniqueEventIds.includes(eventId)) {
            s.eventSeriesDefs = { ...s.eventSeriesDefs, [event.seriesId!]: { ...def, uniqueEventIds: [...def.uniqueEventIds, eventId] } };
          }
        });
      }
    }
    return updated;
  }));
}

/**
 * F-16-096 «перенос события меняет время у всех участников»: пишет параметры события (сотрудник/время/
 * длительность/услуга/мест) и переносит АКТИВНЫХ участников на новое время/сотрудника той же операцией — иначе
 * бронь участника молча остаётся на старом часе после переноса события. Событие в серии заодно помечается
 * «уникальным» (F-16-075), как обычная правка параметров.
 */
export function saveEventParams(eventId: Id, patch: { staffId: string; start: ISODateTime; durationMin: number; serviceId: string; capacity: number }): Promise<GroupEvent> {
  if (isApiMode()) return R.saveEventParams(eventId, patch);
  return withServerWrites(() => request(() => {
    const event = coreTx.get('groupEvents', eventId);
    const timeChanged = patch.start !== event.start || patch.staffId !== event.staffId || patch.durationMin !== event.durationMin;
    const updated = coreTx.update('groupEvents', eventId, patch);
    if (timeChanged) {
      const core = readCore();
      for (const b of core.bookings) {
        if (b.groupEventId !== eventId || b.deletedAt || !occupiesTime(b)) continue;
        coreTx.update('bookings', b.id, { start: patch.start, staffId: patch.staffId, durationMin: patch.durationMin });
      }
    }
    if (event.seriesId) {
      mutateArea('resources', (s) => {
        const def = s.eventSeriesDefs[event.seriesId!];
        if (def && !def.uniqueEventIds.includes(eventId)) {
          s.eventSeriesDefs = { ...s.eventSeriesDefs, [event.seriesId!]: { ...def, uniqueEventIds: [...def.uniqueEventIds, eventId] } };
        }
      });
    }
    return updated;
  }));
}

// ─────────────────────────── Расписание посещений клиента (F-16-078…080) ───────────────────────────

export function listVisitSchedules(seriesId: Id): Promise<VisitScheduleEntry[]> {
  if (isApiMode()) return R.listVisitSchedules(seriesId);
  return request(() => readArea('resources').visitSchedules.filter((v) => v.seriesId === seriesId));
}

function futureSeriesEventsOnWeekdays(seriesId: Id, weekdays: number[]): GroupEvent[] {
  const core = readCore();
  const now = today();
  return core.groupEvents.filter((e) => e.seriesId === seriesId && e.status === 'scheduled' && datePart(e.start) >= now && weekdays.includes(weekdayIndex(datePart(e.start))));
}

export interface CreateVisitScheduleInput {
  seriesId: Id;
  clientId?: Id;
  clientName: string;
  clientPhone: string;
  weekdays: number[];
  /** F-16-080: клиент, записывающий на свой номер больше одного места, недоступен для расписания посещений */
  seats: number;
}

export function createVisitSchedule(input: CreateVisitScheduleInput): Promise<{ entry: VisitScheduleEntry; createdCount: number }> {
  if (isApiMode()) return R.createVisitSchedule(input);
  return request(async () => {
    if (input.seats > 1) throw new ApiError('multi_seat_no_schedule');
    if (!input.weekdays.length) throw new ApiError('weekday_required');
    const def = getSeriesDefOrThrow(input.seriesId);
    const events = futureSeriesEventsOnWeekdays(input.seriesId, input.weekdays);
    let createdCount = 0;
    for (const event of events) {
      try {
        await addParticipant({
          businessId: def.businessId,
          locationId: def.locationId,
          eventId: event.id,
          staffId: event.staffId,
          start: event.start,
          name: input.clientName,
          phone: input.clientPhone,
          seats: 1,
        });
        createdCount += 1;
      } catch {
        // мест не хватило в этой конкретной дате — остальные даты всё равно создаются (F-16-080 ❓, наш вывод)
      }
    }
    const entry: VisitScheduleEntry = {
      id: newId('vsc'),
      seriesId: input.seriesId,
      clientId: input.clientId,
      clientName: input.clientName,
      clientPhone: normalizePhone(input.clientPhone) || input.clientPhone,
      weekdays: input.weekdays,
      createdAt: nowDateTime(),
    };
    mutateArea('resources', (s) => {
      s.visitSchedules = [...s.visitSchedules, entry];
    });
    return { entry, createdCount };
  });
}

function findParticipantBooking(eventId: Id, phone: string): Booking | undefined {
  const core = readCore();
  return core.bookings.find((b) => b.groupEventId === eventId && !b.deletedAt && core.clients.find((c) => c.id === b.clientId)?.phone === phone);
}

/** F-16-079: снятие дня недели убирает клиента только из будущих событий этого дня; прошедшие остаются в истории */
export function updateVisitSchedule(id: Id, weekdays: number[]): Promise<VisitScheduleEntry> {
  if (isApiMode()) return R.updateVisitSchedule(id, weekdays);
  return request(async () => {
    const entry = readArea('resources').visitSchedules.find((v) => v.id === id);
    if (!entry) throw new ApiError('not_found');
    const removedDays = entry.weekdays.filter((d) => !weekdays.includes(d));
    const addedDays = weekdays.filter((d) => !entry.weekdays.includes(d));
    if (removedDays.length) {
      for (const event of futureSeriesEventsOnWeekdays(entry.seriesId, removedDays)) {
        const booking = findParticipantBooking(event.id, entry.clientPhone);
        if (booking) await removeParticipant(booking.id);
      }
    }
    if (addedDays.length) {
      const def = getSeriesDefOrThrow(entry.seriesId);
      for (const event of futureSeriesEventsOnWeekdays(entry.seriesId, addedDays)) {
        try {
          await addParticipant({
            businessId: def.businessId,
            locationId: def.locationId,
            eventId: event.id,
            staffId: event.staffId,
            start: event.start,
            name: entry.clientName,
            phone: entry.clientPhone,
            seats: 1,
          });
        } catch {
          // мест не хватило — пропускаем эту дату
        }
      }
    }
    const updated: VisitScheduleEntry = { ...entry, weekdays };
    mutateArea('resources', (s) => {
      s.visitSchedules = s.visitSchedules.map((v) => (v.id === id ? updated : v));
    });
    return updated;
  });
}

/** F-16-079 «Удалить»: снимает клиента со всего будущего расписания (прошедшие визиты остаются в истории) */
export function deleteVisitSchedule(id: Id): Promise<void> {
  if (isApiMode()) return R.deleteVisitSchedule(id);
  return request(async () => {
    const entry = readArea('resources').visitSchedules.find((v) => v.id === id);
    if (!entry) return;
    for (const event of futureSeriesEventsOnWeekdays(entry.seriesId, entry.weekdays)) {
      const booking = findParticipantBooking(event.id, entry.clientPhone);
      if (booking) await removeParticipant(booking.id);
    }
    mutateArea('resources', (s) => {
      s.visitSchedules = s.visitSchedules.filter((v) => v.id !== id);
    });
  });
}

// ─────────────────────────── Онлайн-занятия: присоединиться и уведомить (F-16-081…083) ───────────────────────────

export interface EventJoinInfo {
  url: string;
  instructions: string;
  sentAt: ISODateTime[];
}

export function getEventJoin(eventId: Id): Promise<EventJoinInfo | undefined> {
  if (isApiMode()) return R.getEventJoin(eventId);
  return request(() => readArea('resources').eventJoin[eventId]);
}

/** F-16-081: ссылка и текст инструкции для участников онлайн-занятия */
export function saveEventJoin(eventId: Id, input: { url: string; instructions: string }): Promise<EventJoinInfo> {
  if (isApiMode()) return R.saveEventJoin(eventId, input);
  return withServerWrites(() => request(() => {
    const info: EventJoinInfo = { url: input.url.trim(), instructions: input.instructions.trim(), sentAt: readArea('resources').eventJoin[eventId]?.sentAt ?? [] };
    mutateArea('resources', (s) => {
      s.eventJoin = { ...s.eventJoin, [eventId]: info };
    });
    coreTx.update('groupEvents', eventId, { onlineUrl: info.url || undefined });
    return info;
  }));
}

/**
 * F-16-082: рассылает ссылку всем текущим участникам; можно вызывать повторно. ⭐ У нас — пуш в приложении
 * клиента (F-00-120), а не email (F-16-083: у Altegio — только email; решение зафиксировано в ТЗ).
 */
export function sendEventJoinNotifications(eventId: Id): Promise<{ notifiedCount: number }> {
  if (isApiMode()) return R.sendEventJoinNotifications(eventId);
  return request(async () => {
    const info = readArea('resources').eventJoin[eventId];
    if (!info?.url) throw new ApiError('no_join_link');
    const participants = await listEventParticipants(eventId);
    const notifiedCount = participants.filter((p) => occupiesTime(p.booking)).length;
    mutateArea('resources', (s) => {
      const current = s.eventJoin[eventId];
      if (current) s.eventJoin = { ...s.eventJoin, [eventId]: { ...current, sentAt: [...current.sentAt, nowDateTime()] } };
    });
    return { notifiedCount };
  });
}

// ─────────────────────────── Удаление групповой услуги (F-16-170, вклад в «Услуги») ───────────────────────────

/** Сколько будущих событий этой услуги — предупреждение перед удалением групповой услуги (F-16-170) */
export function countFutureGroupEventsForService(serviceId: Id): Promise<number> {
  if (isApiMode()) return R.countFutureGroupEventsForService(serviceId);
  return request(() => {
    const now = nowDateTime();
    return readCore().groupEvents.filter((e) => e.serviceId === serviceId && e.status === 'scheduled' && e.start >= now).length;
  });
}

// ─────────────────────────── Предоплата и абонемент у групповой услуги (F-16-031) ───────────────────────────

export function getGroupServicePayment(serviceId: Id): Promise<GroupServicePaymentSettings> {
  if (isApiMode()) return R.getGroupServicePayment(serviceId);
  return request(() => readArea('resources').groupServicePayment[serviceId] ?? defaultGroupServicePaymentSettings(serviceId));
}

export function setGroupServicePayment(serviceId: Id, patch: Partial<Pick<GroupServicePaymentSettings, 'onlinePrepaymentEnabled' | 'membershipBookingEnabled'>>): Promise<GroupServicePaymentSettings> {
  if (isApiMode()) return R.setGroupServicePayment(serviceId, patch);
  return request(() => {
    assertCan('services.edit');
    let next!: GroupServicePaymentSettings;
    mutateArea('resources', (s) => {
      const current = s.groupServicePayment[serviceId] ?? defaultGroupServicePaymentSettings(serviceId);
      next = { ...current, ...patch };
      s.groupServicePayment[serviceId] = next;
    });
    return next;
  });
}

// ─────────────────────────── Журнал изменений (F-16-171) ───────────────────────────

function actorDisplayName(): string {
  const actor = currentActor();
  if (!actor.staffId) return 'system';
  return readCore().staff.find((s) => s.id === actor.staffId)?.name ?? 'system';
}

/**
 * Этап 21 (лейн «resources+helpers»): в режиме api — no-op. Каждый вызывающий мутатор этого файла (ресурс/
 * пакет/лист ожидания создать-изменить-удалить) в api-режиме идёт через `R.*`, а сервер уже пишет ту же строку
 * сам, в той же транзакции, что и саму правку (`AuditService.record`, `resources.service.ts`/
 * `resources-events.service.ts`) — второй `mutateArea` здесь задвоил бы запись только в локальном мок-зеркале,
 * которое `listResourcesChangelog` в api-режиме не читает. Единственный вызывающий, у которого раньше не было
 * серверной записи (`createEventCategory` — JSON-настройка, не Prisma-строка с готовым `audit.record`), теперь
 * пишет её сам (`ResourcesService.createEventCategory`, `entityType:'event'`).
 */
export function logResourcesChange(businessId: Id, entity: ResourcesChangeEntity, entityId: Id, action: ResourcesChangeAction, summary: string): void {
  if (isApiMode()) return;
  mutateArea('resources', (s) => {
    s.changelog.unshift({ id: newId('rlog'), businessId, entity, entityId, action, actorName: actorDisplayName(), at: nowDateTime(), summary });
    if (s.changelog.length > 500) s.changelog.length = 500;
  });
}

export function listResourcesChangelog(businessId: Id): Promise<import('@/domain/resources').ResourcesChangeLogEntry[]> {
  return request(() => readArea('resources').changelog.filter((e) => e.businessId === businessId));
}

// ─────────────────────────── Пакеты услуг (F-16-107…124, 133…135) ───────────────────────────

export interface PackageWithMeta extends Service {
  extra: PackageExtra;
}

function withPackageExtra(service: Service): PackageWithMeta {
  return { ...service, extra: readArea('resources').packages[service.id] ?? defaultPackageExtra(service.id) };
}

/** Услуги пакета — id + количество, вместе с их сервисами ядра (F-16-110…114) */
export function toPackageServiceLite(services: Service[]): Map<Id, PackageServiceLite> {
  return new Map(
    services.map((s) => [s.id, { id: s.id, kind: s.kind, durationMin: s.durationMin, durationMax: s.durationMax, priceMin: s.priceMin, priceMax: s.priceMax, staffIds: s.staffIds }]),
  );
}

export function listPackages(businessId: Id): Promise<PackageWithMeta[]> {
  if (isApiMode()) return R.listPackages(businessId);
  return request(() => readCore().services.filter((s) => s.businessId === businessId && s.servicePackage).map(withPackageExtra));
}

export function getPackage(id: Id): Promise<PackageWithMeta> {
  if (isApiMode()) return R.getPackage(id);
  return request(() => {
    const service = coreTx.get('services', id);
    if (!service.servicePackage) throw new ApiError('not_found');
    return withPackageExtra(service);
  });
}

export interface CreatePackageInput {
  businessId: Id;
  categoryId: Id;
  sphereId: Service['sphereId'];
  name: Service['name'];
}

/** Пакет создаётся как обычная услуга ядра (kind остаётся 'individual', F-16-107/108) со своим servicePackage */
export function createPackage(input: CreatePackageInput): Promise<PackageWithMeta> {
  if (isApiMode()) return R.createPackage(input);
  return request(() => {
    assertCan('resources.manage');
    const id = newId('pkg');
    const servicePackage: ServicePackage = { items: [], mode: 'sequentialAny' };
    const created = coreTx.create('services', {
      id,
      businessId: input.businessId,
      categoryId: input.categoryId,
      sphereId: input.sphereId,
      name: input.name,
      kind: 'individual',
      durationMin: 0,
      priceMin: 0,
      photos: [],
      materials: [],
      staffIds: [],
      workplaces: ['salon'],
      onlineBookable: false,
      active: true,
      order: Date.now(),
      servicePackage,
    });
    mutateArea('resources', (s) => {
      s.packages[id] = defaultPackageExtra(id);
    });
    logResourcesChange(input.businessId, 'package', id, 'create', created.name.ru || created.name.en || id);
    return withPackageExtra(created);
  });
}

export interface SavePackageInput {
  name?: Service['name'];
  categoryId?: Id;
  items?: ServicePackage['items'];
  mode?: ServicePackage['mode'];
  onlineBookable?: boolean;
  description?: Service['description'];
  photos?: string[];
  extra?: Partial<PackageExtra>;
}

export function savePackage(id: Id, patch: SavePackageInput): Promise<PackageWithMeta> {
  if (isApiMode()) return R.savePackage(id, patch);
  return request(() => {
    assertCan('resources.manage');
    const current = coreTx.get('services', id);
    if (!current.servicePackage) throw new ApiError('not_found');
    const corePatch: Partial<Service> = {};
    if (patch.name) corePatch.name = patch.name;
    if (patch.categoryId) corePatch.categoryId = patch.categoryId;
    if (patch.onlineBookable !== undefined) corePatch.onlineBookable = patch.onlineBookable;
    if (patch.description !== undefined) corePatch.description = patch.description;
    if (patch.photos) corePatch.photos = patch.photos;
    if (patch.items || patch.mode) {
      corePatch.servicePackage = { items: patch.items ?? current.servicePackage.items, mode: patch.mode ?? current.servicePackage.mode };
    }
    const updated = Object.keys(corePatch).length ? coreTx.update('services', id, corePatch) : current;
    if (patch.extra) {
      mutateArea('resources', (s) => {
        s.packages[id] = { ...(s.packages[id] ?? defaultPackageExtra(id)), ...patch.extra };
      });
    }
    logResourcesChange(updated.businessId, 'package', id, 'update', updated.name.ru || updated.name.en || id);
    return withPackageExtra(updated);
  });
}

/** Сколько ещё не прошедших записей на пакет — показать перед удалением (F-16-172 «⭐ число будущих записей») */
export function countFuturePackageBookings(serviceId: Id): Promise<number> {
  if (isApiMode()) return R.countFuturePackageBookings(serviceId);
  return request(() => {
    const now = nowDateTime();
    return readCore().bookings.filter((b) => !b.deletedAt && b.start >= now && b.services.some((line) => line.serviceId === serviceId)).length;
  });
}

/** Слово подтверждения удаления пакета/услуги (F-16-172, как у клиентской базы — «удаление необратимо») */
export const PACKAGE_DELETE_WORD = 'УДАЛИТЬ';

export function deletePackage(id: Id): Promise<void> {
  if (isApiMode()) return R.deletePackage(id);
  return request(() => {
    assertCan('resources.manage');
    const service = coreTx.get('services', id);
    coreTx.remove('services', id);
    mutateArea('resources', (s) => {
      delete s.packages[id];
    });
    logResourcesChange(service.businessId, 'package', id, 'delete', service.name.ru || service.name.en || id);
  });
}

export function computePackageDuration(items: { serviceId: Id; qty: number }[], mode: ServicePackage['mode'], servicesById: Map<Id, PackageServiceLite>) {
  return packageDuration(items, servicesById, mode);
}
export function computePackagePrice(
  items: { serviceId: Id; qty: number }[],
  method: PackageExtra['pricingMethod'],
  manualPrice: Money | undefined,
  discountPercent: number | undefined,
  servicesById: Map<Id, PackageServiceLite>,
) {
  return packagePrice(items, servicesById, method, manualPrice, discountPercent);
}
export {
  isPackageBroken,
  packageCanSequentialSame,
  packageDuration,
  packagePrice,
  packagePriceMethodsAvailable,
  packageUnconfiguredServiceIds,
  validatePackageComposition,
};

/** Три готовых рецепта пакета (F-16-134) — подсказывают режим и способ цены; услуги подбирает сам администратор */
export const PACKAGE_TEMPLATES = [
  { id: 'fourHandsManicurePedicure', mode: 'parallel' as const, pricingMethod: 'sumServices' as const },
  { id: 'polishManicureShellac', mode: 'sequentialAny' as const, pricingMethod: 'discountPercent' as const },
  { id: 'rfLiftingFourHands', mode: 'parallel' as const, pricingMethod: 'sumServices' as const },
];

// ─────────────────────────── Ассистенты (F-16-136, 142…144) ───────────────────────────

export function getAssistantSettings(businessId: Id): Promise<AssistantSettings> {
  if (isApiMode()) return R.getAssistantSettings(businessId);
  return request(() => readArea('resources').assistantSettings[businessId] ?? { compensationEnabled: false, allowMultiple: false, shareRule: 'split' });
}

export function saveAssistantSettings(businessId: Id, patch: Partial<AssistantSettings>): Promise<AssistantSettings> {
  if (isApiMode()) return R.saveAssistantSettings(businessId, patch);
  return request(() => {
    assertCan('resources.manage');
    return mutateArea('resources', (s) => {
      s.assistantSettings[businessId] = { ...(s.assistantSettings[businessId] ?? { compensationEnabled: false, allowMultiple: false, shareRule: 'split' }), ...patch };
    }).assistantSettings[businessId];
  });
}

export interface AssistantEligibleStaff {
  id: Id;
  name: string;
  eligible: boolean;
}

/** Сотрудники бизнеса и их флаг «Доступен для ассистирования» (F-16-138 — правит staff, здесь читаем свой оверлей) */
export function listAssistantStaff(businessId: Id): Promise<AssistantEligibleStaff[]> {
  if (isApiMode()) return R.listAssistantStaff(businessId);
  return request(() => {
    const eligible = readArea('resources').staffAssistantEligible;
    return readCore()
      .staff.filter((s) => s.businessId === businessId)
      .map((s) => ({ id: s.id, name: s.name, eligible: eligible[s.id] ?? false }));
  });
}

export function setStaffAssistantEligible(staffId: Id, value: boolean): Promise<boolean> {
  if (isApiMode()) return R.setStaffAssistantEligible(staffId, value);
  return request(() => {
    assertCan('resources.manage');
    return mutateArea('resources', (s) => {
      s.staffAssistantEligible = { ...s.staffAssistantEligible, [staffId]: value };
    }).staffAssistantEligible[staffId]!;
  });
}

/**
 * F-09-044/F-16-137/139 «Заведение отдельного ассистента»: заводит помощника, который не ведёт своих записей —
 * без графика (`hiddenInJournal: true`, в журнале не показывается → F-16-139), не платное место подписки
 * (`assistantOnly: true`, роль «Только просмотр» без лицензии — F-09-044) и сразу «Доступен для
 * ассистирования» (F-16-138). Полноценная форма «Добавить сотрудника» с ролями и приглашением — territoria
 * staff (qa/requests/resources.md); здесь — короткий путь для минимального помощника.
 */
export function createAssistant(businessId: Id, locationId: Id, name: string, phone: string): Promise<Staff> {
  if (isApiMode()) return R.createAssistant(businessId, locationId, name, phone);
  return request(() => {
    assertCan('resources.manage');
    const staff = coreTx.create('staff', {
      businessId,
      locationIds: [locationId],
      name,
      phone,
      role: 'master',
      sphereIds: [],
      photos: [],
      materials: [],
      workplaces: ['salon'],
      accepts: 'all',
      calendarVisibility: 'all',
      calendarMode: 'free',
      confirmMode: 'instant',
      colorIndex: 1,
      serviceIds: [],
      status: 'active',
      hiredAt: today(),
      hiddenInJournal: true,
      assistantOnly: true,
    });
    mutateArea('resources', (s) => {
      s.staffAssistantEligible = { ...s.staffAssistantEligible, [staff.id]: true };
    });
    return staff;
  });
}

function assistantLineKey(bookingId: Id, serviceIndex: number): string {
  return `${bookingId}:${serviceIndex}`;
}

export function getBookingAssistants(bookingId: Id, serviceIndex: number): Promise<BookingAssistant[]> {
  if (isApiMode()) return R.getBookingAssistants(bookingId, serviceIndex);
  return request(() => readArea('resources').bookingAssistants[assistantLineKey(bookingId, serviceIndex)] ?? []);
}

/** Сохраняет ассистентов строки записи (F-16-142/143); доли при «делится» — только из defaultAssistantShares */
export function setBookingAssistants(bookingId: Id, serviceIndex: number, assistants: BookingAssistant[], shareRule: AssistantShareRule): Promise<BookingAssistant[]> {
  if (isApiMode()) return R.setBookingAssistants(bookingId, serviceIndex, assistants, shareRule);
  return request(() => {
    const normalized = shareRule === 'split' ? defaultAssistantShares(assistants.map((a) => a.staffId), 'split') : assistants;
    return mutateArea('resources', (s) => {
      s.bookingAssistants = { ...s.bookingAssistants, [assistantLineKey(bookingId, serviceIndex)]: normalized };
    }).bookingAssistants[assistantLineKey(bookingId, serviceIndex)];
  });
}

// ─────────────────────────── Тонкие права раздела (F-16-026, F-16-144, F-16-169) ───────────────────────────

const DEFAULT_FINE_RIGHTS: ResourcesFineRights = {
  viewResources: true,
  editServiceResources: true,
  viewWaitlist: true,
  addAssistants: true,
  editAssistantShare: true,
};

export function getStaffResourcesRights(staffId: Id): Promise<Partial<ResourcesFineRights> | undefined> {
  if (isApiMode()) return R.getStaffResourcesRights(staffId);
  return request(() => readArea('resources').staffRights[staffId]);
}

export function setStaffResourcesRights(staffId: Id, rights: Partial<ResourcesFineRights>): Promise<Partial<ResourcesFineRights>> {
  if (isApiMode()) return R.setStaffResourcesRights(staffId, rights);
  return request(() => {
    assertCan('resources.manage');
    return mutateArea('resources', (s) => {
      s.staffRights[staffId] = { ...(s.staffRights[staffId] ?? {}), ...rights };
    }).staffRights[staffId]!;
  });
}

export function defaultResourcesFineRights(): ResourcesFineRights {
  return { ...DEFAULT_FINE_RIGHTS };
}

// ─────────────────────────── Уведомления листа ожидания (F-16-166…168) ───────────────────────────

/**
 * Освободившееся окно предлагается следующим в листе ожидания (⭐ F-00-101/102): находит активные заявки
 * на эту услугу (мастер не важен или совпадает) без желаний в прошлом, ставит пуш-отметку. Вызывается
 * вручную кнопкой «Проверить лист ожидания» на своём экране — журнал отмены записи не наш путь, настоящий
 * автотриггер на отмену просит хук у journal (qa/requests/resources.md).
 */
export function notifyWaitlistForFreedSlot(businessId: Id, serviceId: Id, date: string, staffId?: Id): Promise<{ notifiedIds: Id[] }> {
  if (isApiMode()) return R.notifyWaitlistForFreedSlot(businessId, serviceId, date, staffId);
  return request(() => {
    absorbLegacyWaitlist();
    const entries = waitlistEntriesSync(businessId).filter(
      (e) => e.serviceIds.includes(serviceId) && (e.staffIds.length === 0 || !staffId || e.staffIds.includes(staffId)) && !e.closedBookingId,
    );
    // Окно на `date` подходит заявке «любое время» или с желанием именно на этот день (раньше — любое будущее желание:
    // окно на 30.09 «уведомляло» тех, кто ждёт 5.10, qa/full-test-0930/resources.md)
    const matching = date < today() ? [] : entries.filter((e) => waitlistWantsDay(e, date));
    const notifiedIds = matching.map((e) => e.id);
    mutateArea('resources', (s) => {
      s.waitlistNotified ??= {};
      for (const id of notifiedIds) s.waitlistNotified[id] = [...(s.waitlistNotified[id] ?? []), nowDateTime()];
    });
    return { notifiedIds };
  });
}

export function getWaitlistNotifications(entryId: Id): Promise<ISODateTime[]> {
  if (isApiMode()) return R.getWaitlistNotifications(entryId);
  return request(() => readArea('resources').waitlistNotified?.[entryId] ?? []);
}

// ─────────────────────────── Категории событий (F-16-043) ───────────────────────────

export function listEventCategories(businessId: Id): Promise<EventCategory[]> {
  if (isApiMode()) return R.listEventCategories(businessId);
  return request(() => readArea('resources').eventCategories.filter((c) => c.businessId === businessId));
}

export function createEventCategory(businessId: Id, name: string, colorIndex: number): Promise<EventCategory> {
  if (isApiMode()) return R.createEventCategory(businessId, name, colorIndex);
  return request(() => {
    assertCan('resources.manage');
    const category: EventCategory = { id: newId('evc'), businessId, name: name.trim(), colorIndex };
    mutateArea('resources', (s) => {
      s.eventCategories.push(category);
    });
    logResourcesChange(businessId, 'event', category.id, 'create', `Категория события «${category.name}»`);
    return category;
  });
}

export function updateEventCategory(id: Id, patch: { name: string; colorIndex: number }): Promise<EventCategory> {
  if (isApiMode()) return R.updateEventCategory(id, patch);
  return request(() => {
    assertCan('resources.manage');
    let updated: EventCategory | undefined;
    mutateArea('resources', (s) => {
      const category = s.eventCategories.find((c) => c.id === id);
      if (!category) throw new ApiError('not_found');
      category.name = patch.name.trim();
      category.colorIndex = patch.colorIndex;
      updated = category;
    });
    return updated!;
  });
}

/** Удаление категории снимает её со всех событий, где она стояла (F-16-043); в api-режиме событие/`eventExtras`
 * ещё на моке (см. docstring файла) — сервер чистит только сам список категорий бизнеса */
export function deleteEventCategory(id: Id): Promise<void> {
  if (isApiMode()) return R.deleteEventCategory(id);
  return request(() => {
    assertCan('resources.manage');
    mutateArea('resources', (s) => {
      s.eventCategories = s.eventCategories.filter((c) => c.id !== id);
      for (const key of Object.keys(s.eventExtras)) {
        s.eventExtras[key] = { ...s.eventExtras[key], categoryIds: s.eventExtras[key].categoryIds.filter((cid) => cid !== id) };
      }
    });
  });
}

// ─────────────────────────── Детали события: ресурсы, цвет, категории, комментарий (F-16-039) ───────────────────────────

export function getEventExtra(eventId: Id): Promise<EventExtra> {
  if (isApiMode()) return R.getEventExtra(eventId);
  return request(() => readArea('resources').eventExtras[eventId] ?? defaultEventExtra(eventId));
}

export function saveEventExtra(eventId: Id, patch: { colorIndex?: number; categoryIds: Id[]; comment?: string }): Promise<EventExtra> {
  if (isApiMode()) return R.saveEventExtra(eventId, patch);
  return request(() => {
    const extra: EventExtra = { eventId, colorIndex: patch.colorIndex, categoryIds: patch.categoryIds, comment: patch.comment?.trim() || undefined };
    mutateArea('resources', (s) => {
      s.eventExtras[eventId] = extra;
    });
    const event = readCore().groupEvents.find((e) => e.id === eventId);
    if (event) logResourcesChange(event.businessId, 'event', eventId, 'update', 'Детали события изменены');
    return extra;
  });
}

// ─────────────────────────── Несколько мест для клиента (F-16-049) ───────────────────────────

export function getGroupSeatsSettings(businessId: Id): Promise<GroupSeatsSettings> {
  if (isApiMode()) return R.getGroupSeatsSettings(businessId);
  return request(() => readArea('resources').groupSeatsSettings[businessId] ?? DEFAULT_GROUP_SEATS_SETTINGS);
}

export function saveGroupSeatsSettings(businessId: Id, patch: GroupSeatsSettings): Promise<GroupSeatsSettings> {
  if (isApiMode()) return R.saveGroupSeatsSettings(businessId, patch);
  return request(() => {
    assertCan('resources.manage');
    mutateArea('resources', (s) => {
      s.groupSeatsSettings[businessId] = patch;
    });
    return patch;
  });
}

// ─────────────────────────── Перенос брони в другое событие (F-16-055) ───────────────────────────

/** Другие будущие события той же услуги — кандидаты для переноса участника (F-16-055) */
export function listTransferTargets(serviceId: Id, excludeEventId: Id): Promise<GroupEvent[]> {
  if (isApiMode()) return R.listTransferTargets(serviceId, excludeEventId);
  return request(() => {
    const now = nowDateTime();
    return readCore()
      .groupEvents.filter((e) => e.serviceId === serviceId && e.id !== excludeEventId && e.status === 'scheduled' && e.start >= now)
      .sort((a, b) => a.start.localeCompare(b.start));
  });
}

/** Перенос запрещён в заполненное событие (F-16-055, F-16-048) */
export function transferParticipant(bookingId: Id, targetEventId: Id): Promise<Booking> {
  if (isApiMode()) return R.transferParticipant(bookingId, targetEventId);
  return withServerWrites(() => request(async () => {
    assertCan('journal.reschedule');
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId);
    const target = core.groupEvents.find((e) => e.id === targetEventId);
    if (!booking || !target) throw new ApiError('not_found');
    const participants = await listEventParticipants(targetEventId);
    const taken = seatsTaken(participants);
    const seats = Math.max(1, booking.services[0]?.qty ?? 1);
    if (taken + seats > target.capacity) throw new ApiError('group_full');
    return coreTx.update('bookings', bookingId, { groupEventId: targetEventId, staffId: target.staffId, start: target.start });
  }));
}

// ─────────────────────────── Автосписание с абонемента в событии (F-16-062) ───────────────────────────

export interface BookingAutoChargeInfo {
  /** Настройка услуги (F-06-127) выключена — автосписание к этой брони не относится */
  applicable: boolean;
  freeCancelHours: number;
  status: 'pending' | 'charged' | 'not_charged';
  membershipId?: Id;
}

/**
 * F-16-062: «Настройка услуги действует и на групповые события» — читаем ту же настройку loyalty
 * (F-06-127), что и у индивидуальной услуги, применяем её к участнику события. Статус хранится в своём
 * срезе по id брони (ядро полей статуса автосписания не заводит — событие в этом проекте не поднимает
 * периодических задач, поэтому «списание в момент начала» здесь — ручное действие администратора
 * («Списать сейчас»), а не фоновый крон; см. assumed в отчёте).
 *
 * Этап 21 (лейн «loyalty»): в режиме api — сервер (booktime-backend …/loyalty/port/extra-ops.ts): статус
 * хранится рядом с настройкой услуги в настройках лояльности, списание и статус — одной транзакцией.
 */
export async function getBookingAutoCharge(businessId: Id, bookingId: Id, serviceId: Id, _clientId: Id | undefined): Promise<BookingAutoChargeInfo> {
  if (isApiMode()) return LX.lx('getBookingAutoCharge', [businessId, bookingId, serviceId]);
  const { getServiceAutoCharge } = await import('@/api/loyalty');
  const setting = await getServiceAutoCharge(businessId, serviceId);
  if (!setting.enabled) return { applicable: false, freeCancelHours: setting.freeCancelHours, status: 'pending' };
  const saved = readArea('resources').autoChargeStatus[bookingId];
  if (saved) return { applicable: true, freeCancelHours: setting.freeCancelHours, status: saved.status, membershipId: saved.membershipId };
  return { applicable: true, freeCancelHours: setting.freeCancelHours, status: 'pending' };
}

/**
 * Списывает одно посещение с абонемента клиента, применимого к услуге (F-16-062: «из нескольких — с того,
 * что истекает раньше» — getLoyaltyBookingSummary уже сортирует по этому правилу через applicable+balance).
 * Не хватило подходящего абонемента — статус «Не списано», доплата — вне этой функции (F-16-062 «сумма к доплате»).
 */
export function chargeBookingAutoDebit(businessId: Id, bookingId: Id, serviceId: Id, clientId: Id): Promise<BookingAutoChargeInfo> {
  if (isApiMode()) return LX.lx('chargeBookingAutoDebit', [businessId, bookingId, serviceId, clientId]);
  return request(async () => {
    const { getLoyaltyBookingSummary, adjustMembership } = await import('@/api/loyalty');
    const summary = await getLoyaltyBookingSummary(businessId, clientId, [serviceId]);
    const usable = summary.memberships.find((m) => m.applicable && m.balanceVisits > 0);
    let result: BookingAutoChargeInfo;
    if (usable) {
      await adjustMembership(businessId, usable.id, { balanceVisits: usable.balanceVisits - 1 });
      result = { applicable: true, freeCancelHours: 0, status: 'charged', membershipId: usable.id };
    } else {
      result = { applicable: true, freeCancelHours: 0, status: 'not_charged' };
    }
    mutateArea('resources', (s) => {
      s.autoChargeStatus[bookingId] = { status: result.status as 'charged' | 'not_charged', membershipId: result.membershipId, at: nowDateTime() };
    });
    return result;
  });
}

// ─────────────────────────── Продажа товара/абонемента/сертификата участнику (F-16-059) ───────────────────────────

export function listParticipantExtras(bookingId: Id): Promise<ParticipantExtraItem[]> {
  if (isApiMode()) return R.listParticipantExtras(bookingId);
  return request(() => readArea('resources').participantExtras[bookingId] ?? []);
}

export function addParticipantExtra(bookingId: Id, kind: ParticipantExtraKind, name: string, price: Money): Promise<ParticipantExtraItem> {
  if (isApiMode()) return R.addParticipantExtra(bookingId, kind, name, price);
  return request(() => {
    assertCan('finance.edit');
    const item: ParticipantExtraItem = { id: newId('pex'), bookingId, kind, name: name.trim(), price };
    mutateArea('resources', (s) => {
      s.participantExtras[bookingId] = [...(s.participantExtras[bookingId] ?? []), item];
    });
    return item;
  });
}

export function removeParticipantExtra(bookingId: Id, itemId: Id): Promise<void> {
  if (isApiMode()) return R.removeParticipantExtra(bookingId, itemId);
  return request(() => {
    mutateArea('resources', (s) => {
      s.participantExtras[bookingId] = (s.participantExtras[bookingId] ?? []).filter((i) => i.id !== itemId);
    });
  });
}

// ─────────────────────────── Оплата участника (F-16-060/061) ───────────────────────────

export function getParticipantPayment(bookingId: Id): Promise<ParticipantPayment | undefined> {
  if (isApiMode()) return R.getParticipantPayment(bookingId);
  return request(() => readArea('resources').participantPayments[bookingId]);
}

/**
 * Быстрая оплата участника (F-16-060, F-16-061): сумма = услуга + проданные товары/абонементы этой брони.
 * Наличные и карта — настоящая оплата визита в финансах (payBookingQuick: касса, «Касса за день», отчёты, зарплата;
 * сервер — тот же BookingPaymentsService.pay). «Другое» — только способ и «Оплачено» (F-00-126).
 *
 * F-06-072 (точечная правка, qa/requests/loyalty.md 2026-09-26): способ «Абонемент» — не просто метка, как
 * card/cash/other — реально списывает одно посещение с абонемента клиента, применимого к услуге участника
 * (тот же движок, что и автосписание F-16-062: getLoyaltyBookingSummary + adjustMembership). Нет клиента у
 * брони или нет подходящего действующего абонемента — оплата отклоняется (`no_membership`), UI показывает
 * тост вместо того, чтобы молча пометить «оплачено».
 */
export function payParticipant(bookingId: Id, method: ParticipantPaymentMethod): Promise<Booking> {
  if (isApiMode()) return R.payParticipant(bookingId, method);
  return withServerWrites(() => request(async () => {
    assertCan('finance.edit');
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('not_found');
    if (method === 'membership') {
      if (!booking.clientId) throw new ApiError('no_membership');
      const { getLoyaltyBookingSummary, adjustMembership } = await import('@/api/loyalty');
      const serviceId = booking.services[0]?.serviceId;
      const summary = await getLoyaltyBookingSummary(booking.businessId, booking.clientId, serviceId ? [serviceId] : []);
      const usable = summary.memberships.find((m) => m.applicable && m.balanceVisits > 0);
      if (!usable) throw new ApiError('no_membership');
      await adjustMembership(booking.businessId, usable.id, { balanceVisits: usable.balanceVisits - 1 });
    }
    if (method === 'cash' || method === 'card') {
      // Деньги наличными и картой — настоящая оплата визита в финансах (как «Оплатить» в журнале, payBookingQuick):
      // операция попадает в кассу, «Касса за день» и отчёты. Раньше ставилось prepayment.paid — как будто перевод
      // мастеру мимо кассы, и касса оставалась пустой (finance.md «Вне раздела»).
      const { payBookingQuick } = await import('@/api/finance');
      await payBookingQuick(booking.businessId, bookingId, method);
      mutateArea('resources', (s) => {
        s.participantPayments[bookingId] = { method, at: nowDateTime() };
      });
      return readCore().bookings.find((b) => b.id === bookingId) ?? booking;
    }
    const extrasTotal = (readArea('resources').participantExtras[bookingId] ?? []).reduce((n, i) => n + i.price, 0);
    mutateArea('resources', (s) => {
      s.participantPayments[bookingId] = { method, at: nowDateTime() };
    });
    return coreTx.update('bookings', bookingId, { prepayment: { amount: booking.total + extrasTotal, paid: true } });
  }));
}

/** Отмена оплаты одного участника не трогает других (F-16-060) */
export function cancelParticipantPayment(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return R.cancelParticipantPayment(bookingId);
  return withServerWrites(() => request(async () => {
    assertCan('finance.edit');
    const paid = readArea('resources').participantPayments[bookingId];
    if (paid && (paid.method === 'cash' || paid.method === 'card')) {
      // Оплата прошла через финансы — отменяем её там же (операция уходит из кассы), prepayment не трогаем
      const booking = readCore().bookings.find((b) => b.id === bookingId);
      if (!booking) throw new ApiError('not_found');
      const { getBookingPaymentSummary, removeBookingPaymentLine } = await import('@/api/finance');
      const summary = await getBookingPaymentSummary(booking.businessId, bookingId);
      const groups = new Set<string>();
      for (const line of summary.payments) {
        if (line.cancelled || line.kind !== 'money' || line.methodKey !== paid.method) continue;
        const key = line.groupId ?? line.id;
        if (groups.has(key)) continue;
        groups.add(key);
        await removeBookingPaymentLine(booking.businessId, line.id);
      }
      mutateArea('resources', (s) => {
        delete s.participantPayments[bookingId];
      });
      return readCore().bookings.find((b) => b.id === bookingId) ?? booking;
    }
    mutateArea('resources', (s) => {
      delete s.participantPayments[bookingId];
    });
    return coreTx.update('bookings', bookingId, { prepayment: undefined });
  }));
}

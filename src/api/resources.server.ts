'use client';

/**
 * Раздел «resources» на настоящем сервере (docs/backend/PLAN.md этап 4, docs/backend/02 §9): ресурсы (кресла,
 * кабинеты, аппараты), пакеты «Комплекс» (та же таблица services на сервере), окно записи (подбор/проверка
 * свободных экземпляров — этап 21, по-настоящему через resource_busy, не по мок-расчёту), ассистенты, тонкие
 * права раздела, «несколько мест», шаблоны и категории событий, предоплата/абонемент групповой услуги, а также
 * (этап 21, повторный заход лейна «resources») групповые события: участники, лист ожидания СВОЕГО экрана,
 * серии по дням недели, расписание посещений, перенос участника, ассистенты/товары/оплата участника. Функции
 * src/api/resources.ts в режиме `api` зовут эти. Групповые события/лист листа ожидания серверную модель уже
 * получили (`EventSeriesDef`/`VisitScheduleEntry`/лист ожидания — с 30.09.2026 один на бизнес, таблица
 * waitlist_entries), кроме автосписания за групповую услугу (`getBookingAutoCharge`/
 * `chargeBookingAutoDebit`, `updateSeriesEvent`, `restoreGroupEvents`) — те зависят от ещё не перенесённых на
 * сервер функций лояльности (`getServiceAutoCharge`/`adjustMembership`/`getLoyaltyBookingSummary` в
 * src/api/loyalty.ts — территория своего лейна) либо от общей правки GroupEvent, которой на сервере нет ещё
 * отдельного маршрута; остаются на моке (см. docstring resources.ts).
 */
import { http } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import { mirrorCore, unmirror } from '@/api/mirror';
import { ApiError, trackRead } from '@/api/request';
import { bizOf as bizOfStaff } from '@/api/staff.server';
import type { Booking, GroupEvent, Id, LocalizedText, Resource, Service, SphereId, Staff } from '@/domain/core';
import type {
  AssistantSettings,
  BookingAssistant,
  EventCategory,
  EventExtra,
  EventSeriesDef,
  EventTemplate,
  GroupSeatsSettings,
  GroupServicePaymentSettings,
  PackageExtra,
  ParticipantExtraItem,
  ParticipantExtraKind,
  ParticipantPayment,
  ParticipantPaymentMethod,
  RepeatFreq,
  ResourcesChangeLogEntry,
  ResourcesFineRights,
  SeriesDayRule,
  VisitScheduleEntry,
  WaitlistEntry,
} from '@/domain/resources';
import { useDb, notifyDbChange } from '@/mock/db';
import type {
  AddParticipantInput,
  AssistantEligibleStaff,
  CreateEventSeriesInput,
  CreateVisitScheduleInput,
  EventJoinInfo,
  EventParticipant,
  PackageWithMeta,
  RepeatEventInput,
  ResourceInput,
  ResourceOption,
  ResourceWithMeta,
  SavePackageInput,
  WaitlistEntryInput,
} from '@/api/resources';

function bizOfResource(resourceId?: Id): Id {
  const fromMirror = resourceId ? useDb.getState().core.resources.find((r) => r.id === resourceId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}
function bizOfPackage(serviceId?: Id): Id {
  const fromMirror = serviceId ? useDb.getState().core.services.find((s) => s.id === serviceId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

const base = (businessId: Id) => `/v1/biz/${businessId}/resources`;

function withDescription(r: Resource): ResourceWithMeta {
  return { ...r, description: (r as ResourceWithMeta).description ?? '' };
}
function changedResource(resource?: Resource): ResourceWithMeta | undefined {
  if (resource) mirrorCore({ resources: [resource] });
  notifyDbChange('areas.resources', 'core.resources');
  return resource ? withDescription(resource) : undefined;
}
function changedPackage(service?: Service): void {
  if (service) mirrorCore({ services: [service] });
  notifyDbChange('areas.resources', 'core.services');
}

// ─────────── «Разделять запись с услугами, использующими разные ресурсы» (F-16-016) ───────────

export function getSplitByResource(businessId: Id): Promise<boolean> {
  return http<{ value: boolean }>('GET', `${base(businessId)}/split-by-resource`).then((r) => r.value);
}
export async function setSplitByResource(businessId: Id, value: boolean): Promise<boolean> {
  const res = await http<{ value: boolean }>('PUT', `${base(businessId)}/split-by-resource`, { value });
  return res.value;
}

// ─────────── ресурсы (F-16-001…026) ───────────

export function listResources(businessId: Id): Promise<ResourceWithMeta[]> {
  trackRead('core.resources', 'areas.resources');
  return http<ResourceWithMeta[]>('GET', base(businessId));
}

export function getResource(id: Id): Promise<ResourceWithMeta> {
  trackRead('core.resources', 'areas.resources');
  return http<ResourceWithMeta>('GET', `${base(bizOfResource(id))}/${id}`);
}

export async function createResource(input: ResourceInput): Promise<ResourceWithMeta> {
  const resource = await http<Resource>('POST', base(input.businessId), input);
  return changedResource(resource)!;
}

export async function updateResource(id: Id, patch: Partial<Omit<Resource, 'id' | 'businessId'>> & { description?: string }): Promise<ResourceWithMeta> {
  const businessId = bizOfResource(id);
  const resource = await http<Resource>('PATCH', `${base(businessId)}/${id}`, patch);
  return changedResource(resource)!;
}

export function countFutureUsage(resourceId: Id): Promise<number> {
  const businessId = bizOfResource(resourceId);
  return http<{ count: number }>('GET', `${base(businessId)}/${resourceId}/future-usage`).then((r) => r.count);
}

export async function deleteResource(id: Id): Promise<void> {
  const businessId = bizOfResource(id);
  await http('DELETE', `${base(businessId)}/${id}`);
  unmirror('resources', id);
  notifyDbChange('areas.resources', 'core.resources');
}

/** «Отменить» (F-00-061), у Resource нет deletedAt — восстанавливает тем же id */
export async function restoreResource(resource: Resource, description: string): Promise<ResourceWithMeta> {
  const businessId = resource.businessId;
  const restored = await http<Resource>('POST', `${base(businessId)}/restore`, { resource, description });
  return changedResource(restored)!;
}

export async function addResourceInstance(resourceId: Id, name: string): Promise<Resource> {
  const businessId = bizOfResource(resourceId);
  const resource = await http<Resource>('POST', `${base(businessId)}/${resourceId}/instances`, { name });
  return changedResource(resource)!;
}
export async function renameResourceInstance(resourceId: Id, instanceId: Id, name: string): Promise<Resource> {
  const businessId = bizOfResource(resourceId);
  const resource = await http<Resource>('PATCH', `${base(businessId)}/${resourceId}/instances/${instanceId}`, { name });
  return changedResource(resource)!;
}
export async function removeResourceInstance(resourceId: Id, instanceId: Id): Promise<Resource> {
  const businessId = bizOfResource(resourceId);
  const resource = await http<Resource>('DELETE', `${base(businessId)}/${resourceId}/instances/${instanceId}`);
  return changedResource(resource)!;
}

export async function setResourceServices(resourceId: Id, serviceIds: Id[]): Promise<Resource> {
  const businessId = bizOfResource(resourceId);
  const resource = await http<Resource>('PUT', `${base(businessId)}/${resourceId}/services`, { serviceIds });
  return changedResource(resource)!;
}

export function listResourcesForService(businessId: Id, serviceId: Id): Promise<Resource[]> {
  return http('GET', `${base(businessId)}/for-service/${serviceId}`);
}

export async function toggleServiceResource(resourceId: Id, serviceId: Id, linked: boolean): Promise<Resource> {
  const businessId = bizOfResource(resourceId);
  const resource = await http<Resource>('PUT', `${base(businessId)}/${resourceId}/services/${serviceId}`, { linked });
  return changedResource(resource)!;
}

// ─────────── журнал изменений (F-16-171) ───────────

export function listResourcesChangelog(businessId: Id): Promise<ResourcesChangeLogEntry[]> {
  return http('GET', `${base(businessId)}/changelog`);
}

// ─────────── пакеты «Комплекс» (F-16-107…135) — та же таблица services на сервере ───────────

export function listPackages(businessId: Id): Promise<PackageWithMeta[]> {
  trackRead('core.services', 'areas.resources');
  return http<PackageWithMeta[]>('GET', `/v1/biz/${businessId}/packages`);
}

export function getPackage(id: Id): Promise<PackageWithMeta> {
  const businessId = bizOfPackage(id);
  return http<PackageWithMeta>('GET', `/v1/biz/${businessId}/packages/${id}`);
}

export interface ServerCreatePackageInput {
  businessId: Id;
  categoryId: Id;
  sphereId: SphereId;
  name: LocalizedText;
}
export async function createPackage(input: ServerCreatePackageInput): Promise<PackageWithMeta> {
  const pkg = await http<PackageWithMeta>('POST', `/v1/biz/${input.businessId}/packages`, input);
  changedPackage(pkg);
  return pkg;
}

export async function savePackage(id: Id, patch: SavePackageInput): Promise<PackageWithMeta> {
  const businessId = bizOfPackage(id);
  const pkg = await http<PackageWithMeta>('PATCH', `/v1/biz/${businessId}/packages/${id}`, patch);
  changedPackage(pkg);
  return pkg;
}

export function countFuturePackageBookings(serviceId: Id): Promise<number> {
  const businessId = bizOfPackage(serviceId);
  return http<{ count: number }>('GET', `/v1/biz/${businessId}/packages/${serviceId}/future-bookings`).then((r) => r.count);
}

export async function deletePackage(id: Id): Promise<void> {
  const businessId = bizOfPackage(id);
  await http('DELETE', `/v1/biz/${businessId}/packages/${id}`);
  unmirror('services', id);
  notifyDbChange('areas.resources', 'core.services');
}

// ─────────── окно записи — подбор/проверка свободных экземпляров (F-16-011…013, этап 21: по-настоящему из resource_busy) ───────────

export function pickFreeResourceInstances(businessId: Id, serviceIds: Id[], start: string, durationMin: number, excludeBookingId?: Id): Promise<Id[] | undefined> {
  return http<Id[] | undefined>('POST', `${base(businessId)}/free-instances`, { serviceIds, start, durationMin, excludeBookingId });
}

export function checkResourceInstancesFree(instanceIds: Id[], start: string, durationMin: number, excludeBookingId?: Id): Promise<boolean> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http<{ value: boolean }>('POST', `${base(businessId)}/check-instances-free`, { instanceIds, start, durationMin, excludeBookingId }).then((r) => r.value);
}

export function listResourceOptions(businessId: Id, start: string, durationMin: number, excludeBookingId?: Id): Promise<ResourceOption[]> {
  return http<ResourceOption[]>('POST', `${base(businessId)}/options`, { start, durationMin, excludeBookingId });
}

// ─────────── ассистенты (F-16-136…144, этап 21) ───────────

export function getAssistantSettings(businessId: Id): Promise<AssistantSettings> {
  return http<AssistantSettings>('GET', `${base(businessId)}/assistant-settings`);
}
export function saveAssistantSettings(businessId: Id, patch: Partial<AssistantSettings>): Promise<AssistantSettings> {
  return http<AssistantSettings>('PUT', `${base(businessId)}/assistant-settings`, patch);
}

export function listAssistantStaff(businessId: Id): Promise<AssistantEligibleStaff[]> {
  return http<AssistantEligibleStaff[]>('GET', `${base(businessId)}/assistant-staff`);
}
export function setStaffAssistantEligible(staffId: Id, value: boolean): Promise<boolean> {
  const businessId = bizOfStaff(staffId);
  return http<{ value: boolean }>('PUT', `${base(businessId)}/assistant-staff/${staffId}`, { value }).then((r) => r.value);
}

/** F-09-044/F-16-137/139: короткий путь для минимального ассистента без графика (см. resources.ts фронта) */
export async function createAssistant(businessId: Id, locationId: Id, name: string, phone: string): Promise<Staff> {
  const staff = await http<Staff>('POST', `${base(businessId)}/create-assistant`, { locationId, name, phone });
  mirrorCore({ staff: [staff] });
  notifyDbChange('areas.resources', 'core.staff');
  return staff;
}

// ─────────── тонкие права раздела (F-16-026, F-16-144, F-16-169, этап 21) ───────────

export function getStaffResourcesRights(staffId: Id): Promise<Partial<ResourcesFineRights> | undefined> {
  const businessId = bizOfStaff(staffId);
  return http<Partial<ResourcesFineRights> | undefined>('GET', `${base(businessId)}/staff-rights/${staffId}`);
}
export function setStaffResourcesRights(staffId: Id, rights: Partial<ResourcesFineRights>): Promise<Partial<ResourcesFineRights>> {
  const businessId = bizOfStaff(staffId);
  return http<Partial<ResourcesFineRights>>('PUT', `${base(businessId)}/staff-rights/${staffId}`, rights);
}

// ─────────── «несколько мест для клиента» (F-16-049, этап 21) ───────────

export function getGroupSeatsSettings(businessId: Id): Promise<GroupSeatsSettings> {
  return http<GroupSeatsSettings>('GET', `${base(businessId)}/group-seats-settings`);
}
export function saveGroupSeatsSettings(businessId: Id, patch: GroupSeatsSettings): Promise<GroupSeatsSettings> {
  return http<GroupSeatsSettings>('PUT', `${base(businessId)}/group-seats-settings`, patch);
}

// ─────────── шаблоны повтора события (F-16-064/065/101, этап 21) ───────────

export function listEventTemplates(businessId: Id): Promise<EventTemplate[]> {
  return http<EventTemplate[]>('GET', `${base(businessId)}/event-templates`);
}
export function saveEventTemplate(input: { businessId: Id; name: string; freq: RepeatFreq; weekIntervalWeeks?: number }): Promise<EventTemplate> {
  return http<EventTemplate>('POST', `${base(input.businessId)}/event-templates`, { name: input.name, freq: input.freq, weekIntervalWeeks: input.weekIntervalWeeks });
}

// ─────────── категории событий (F-16-043, этап 21) ───────────
// PATCH/DELETE не получают businessId от экрана (та же сигнатура, что у мока) — берём его из кеша,
// заполненного последним listEventCategories(businessId); тот же приём, что bizOfResource/bizOf(staff) —
// «из зеркала, иначе текущий бизнес сессии» (см. docstring выше файла).

const categoryBizCache = new Map<Id, Id>();

export async function listEventCategories(businessId: Id): Promise<EventCategory[]> {
  const list = await http<EventCategory[]>('GET', `${base(businessId)}/event-categories`);
  for (const c of list) categoryBizCache.set(c.id, c.businessId);
  return list;
}
export async function createEventCategory(businessId: Id, name: string, colorIndex: number): Promise<EventCategory> {
  const category = await http<EventCategory>('POST', `${base(businessId)}/event-categories`, { name, colorIndex });
  categoryBizCache.set(category.id, businessId);
  return category;
}
function bizOfCategory(id: Id): Id {
  const businessId = categoryBizCache.get(id) ?? apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return businessId;
}
export function updateEventCategory(id: Id, patch: { name: string; colorIndex: number }): Promise<EventCategory> {
  return http<EventCategory>('PATCH', `${base(bizOfCategory(id))}/event-categories/${id}`, patch);
}
export async function deleteEventCategory(id: Id): Promise<void> {
  await http('DELETE', `${base(bizOfCategory(id))}/event-categories/${id}`);
  categoryBizCache.delete(id);
}

// ─────────── предоплата и абонемент у групповой услуги (F-16-031, этап 21) ───────────

export function getGroupServicePayment(serviceId: Id): Promise<GroupServicePaymentSettings> {
  return http<GroupServicePaymentSettings>('GET', `${base(bizOfPackage(serviceId))}/group-service-payment/${serviceId}`);
}
export function setGroupServicePayment(
  serviceId: Id,
  patch: Partial<Pick<GroupServicePaymentSettings, 'onlinePrepaymentEnabled' | 'membershipBookingEnabled'>>,
): Promise<GroupServicePaymentSettings> {
  return http<GroupServicePaymentSettings>('PUT', `${base(bizOfPackage(serviceId))}/group-service-payment/${serviceId}`, patch);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Групповые события: участники, лист ожидания СВОЕГО экрана, серии по дням недели, расписание
// посещений, перенос участника, ассистенты/товары/оплата участника — этап 21 (лейн «resources»,
// повторный заход): всё, чего не было на сервере (GroupEvent/Booking/старый WaitlistEntry журнала —
// уже были, этап 7). businessId у большинства этих функций мок не носит — берём из readCore()
// (событие/бронь) там, где есть, иначе из активной сессии (эти сущности не бывают чужого бизнеса).
// ─────────────────────────────────────────────────────────────────────────────────────────────

function bizOfEvent(eventId?: Id): Id {
  const fromMirror = eventId ? useDb.getState().core.groupEvents?.find((e) => e.id === eventId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}
function bizOfBooking(bookingId?: Id): Id {
  const fromMirror = bookingId ? useDb.getState().core.bookings?.find((b) => b.id === bookingId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}
/** Серии/расписания посещений/заявки листа ожидания не мирятся на клиенте (нет своей area в api-режиме) — они
 * всегда принадлежат активному бизнесу сессии (экраны этого среза не открывают чужой бизнес по id). */
function bizOfActive(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

// ─────────── участники группового события (F-16-044…049) ───────────

export function listEventParticipants(eventId: Id): Promise<EventParticipant[]> {
  return http<EventParticipant[]>('GET', `${base(bizOfEvent(eventId))}/events/${eventId}/participants`);
}
export function addParticipant(input: AddParticipantInput): Promise<Booking> {
  return http('POST', `${base(input.businessId)}/events/${input.eventId}/participants`, {
    locationId: input.locationId,
    staffId: input.staffId,
    start: input.start,
    name: input.name,
    phone: input.phone,
    seats: input.seats,
    visitorName: input.visitorName,
    comment: input.comment,
  });
}
export function removeParticipant(bookingId: Id): Promise<void> {
  return http('DELETE', `${base(bizOfBooking(bookingId))}/participants/${bookingId}`);
}

// ─────────── повтор события / массовое удаление (F-16-064/065/066/101) ───────────

export function repeatEvent(input: RepeatEventInput): Promise<{ createdCount: number }> {
  return http('POST', `${base(bizOfEvent(input.eventId))}/events/repeat`, input);
}
export function deleteGroupEvents(businessId: Id, eventIds: Id[]): Promise<{ cancelledCount: number }> {
  return http('POST', `${base(businessId)}/events/bulk-delete`, { eventIds });
}
/** Отмена «Массового удаления» (F-16-066) — сигнатура мока businessId не несёт, серии/события всегда активного бизнеса */
export function restoreGroupEvents(eventIds: Id[]): Promise<{ restoredCount: number }> {
  return http('POST', `${base(bizOfActive())}/events/bulk-restore`, { eventIds });
}

// ─────────── параметры события (F-16-096), детали (F-16-039), присоединение (F-16-081/082) ───────────

export function saveEventParams(eventId: Id, patch: { staffId: string; start: string; durationMin: number; serviceId: string; capacity: number }): Promise<GroupEvent> {
  return http('PATCH', `${base(bizOfEvent(eventId))}/events/${eventId}/params`, patch);
}
/** F-16-075 (этап 21, лейн «resources+helpers»): после общего `PATCH .../events/:id` (journal, уже реален) —
 * пометить событие «уникальным» в его серии, если оно в серии; вне серии сервер тихо ничего не делает. */
export function markEventUniqueInSeries(eventId: Id): Promise<void> {
  return http('POST', `${base(bizOfEvent(eventId))}/events/${eventId}/mark-series-unique`);
}
export function countFutureGroupEventsForService(serviceId: Id): Promise<number> {
  return http<{ count: number }>('GET', `${base(bizOfPackage(serviceId))}/events/count-future/${serviceId}`).then((r) => r.count);
}
export function getEventExtra(eventId: Id): Promise<EventExtra> {
  return http('GET', `${base(bizOfEvent(eventId))}/events/${eventId}/extra`);
}
export function saveEventExtra(eventId: Id, patch: { colorIndex?: number; categoryIds: Id[]; comment?: string }): Promise<EventExtra> {
  return http('PUT', `${base(bizOfEvent(eventId))}/events/${eventId}/extra`, patch);
}
export function getEventJoin(eventId: Id): Promise<EventJoinInfo | undefined> {
  return http('GET', `${base(bizOfEvent(eventId))}/events/${eventId}/join`);
}
export function saveEventJoin(eventId: Id, input: { url: string; instructions: string }): Promise<EventJoinInfo> {
  return http('PUT', `${base(bizOfEvent(eventId))}/events/${eventId}/join`, input);
}
export function sendEventJoinNotifications(eventId: Id): Promise<{ notifiedCount: number }> {
  return http('POST', `${base(bizOfEvent(eventId))}/events/${eventId}/join/notify`);
}

// ─────────── расписание серии по дням недели (F-16-067…077) ───────────

export function getSeriesDef(seriesId: Id): Promise<EventSeriesDef | undefined> {
  return http('GET', `${base(bizOfActive())}/series/${seriesId}`);
}
export function listSeriesEvents(seriesId: Id): Promise<GroupEvent[]> {
  return http('GET', `${base(bizOfActive())}/series/${seriesId}/events`);
}
export function listEventSeriesDefsByIds(seriesIds: Id[]): Promise<Record<Id, EventSeriesDef>> {
  if (!seriesIds.length) return Promise.resolve({});
  return http('POST', `${base(bizOfActive())}/series/by-ids`, { ids: seriesIds });
}
export function createEventSeries(input: CreateEventSeriesInput): Promise<{ seriesId: Id; createdCount: number }> {
  return http('POST', `${base(bizOfEvent(input.sourceEventId))}/series`, input);
}
export function extendOrShortenSeries(seriesId: Id, newEndDate: string): Promise<{ createdCount: number; cancelledCount: number }> {
  return http('POST', `${base(bizOfActive())}/series/${seriesId}/extend`, { newEndDate });
}
export function addSeriesWeekday(seriesId: Id, rule: SeriesDayRule): Promise<{ createdCount: number }> {
  return http('POST', `${base(bizOfActive())}/series/${seriesId}/weekday`, rule);
}
export function removeSeriesWeekday(seriesId: Id, weekday: number): Promise<{ cancelledCount: number }> {
  return http('DELETE', `${base(bizOfActive())}/series/${seriesId}/weekday/${weekday}`);
}
export function editSeriesDayRule(
  seriesId: Id,
  weekday: number,
  patch: Partial<Pick<SeriesDayRule, 'startTime' | 'durationMin' | 'resourceIds'>>,
  applyToUnique: boolean,
): Promise<{ updatedCount: number; skippedUniqueCount: number }> {
  return http('PATCH', `${base(bizOfActive())}/series/${seriesId}/day-rule/${weekday}`, { patch, applyToUnique });
}
export function deleteSeries(seriesId: Id): Promise<{ cancelledCount: number }> {
  return http('DELETE', `${base(bizOfActive())}/series/${seriesId}`);
}

// ─────────── расписание посещений клиента (F-16-078…080) ───────────

export function listVisitSchedules(seriesId: Id): Promise<VisitScheduleEntry[]> {
  return http('GET', `${base(bizOfActive())}/visit-schedules/${seriesId}`);
}
export function createVisitSchedule(input: CreateVisitScheduleInput): Promise<{ entry: VisitScheduleEntry; createdCount: number }> {
  return http('POST', `${base(bizOfActive())}/visit-schedules`, input);
}
export function updateVisitSchedule(id: Id, weekdays: number[]): Promise<VisitScheduleEntry> {
  return http('PATCH', `${base(bizOfActive())}/visit-schedules/${id}`, { weekdays });
}
export function deleteVisitSchedule(id: Id): Promise<void> {
  return http('DELETE', `${base(bizOfActive())}/visit-schedules/${id}`);
}

// ─────────── лист ожидания бизнеса — один на /biz/waitlist и панель журнала (30.09.2026): единственный адрес ───────────

export function listWaitlist(businessId: Id): Promise<WaitlistEntry[]> {
  return http('GET', `${base(businessId)}/waitlist`);
}
export function addToWaitlist(input: WaitlistEntryInput): Promise<WaitlistEntry> {
  return http('POST', `${base(input.businessId)}/waitlist`, input);
}
export function updateWaitlistEntry(
  id: Id,
  patch: Partial<Pick<WaitlistEntryInput, 'clientName' | 'clientPhone' | 'serviceIds' | 'staffIds' | 'wishes' | 'comment'>>,
): Promise<WaitlistEntry> {
  return http('PATCH', `${base(bizOfActive())}/waitlist/${id}`, patch);
}
export function closeWaitlistEntry(id: Id, bookingId: Id): Promise<void> {
  return http('POST', `${base(bizOfActive())}/waitlist/${id}/close`, { bookingId }).then(() => undefined);
}
export function removeWaitlistEntry(id: Id): Promise<void> {
  return http('DELETE', `${base(bizOfActive())}/waitlist/${id}`);
}
export function notifyWaitlistForFreedSlot(businessId: Id, serviceId: Id, date: string, staffId?: Id): Promise<{ notifiedIds: Id[] }> {
  return http('POST', `${base(businessId)}/waitlist/notify`, { serviceId, date, staffId });
}
export function getWaitlistNotifications(entryId: Id): Promise<string[]> {
  return http('GET', `${base(bizOfActive())}/waitlist/${entryId}/notifications`);
}

// ─────────── перенос брони в другое событие (F-16-055) ───────────

export function listTransferTargets(serviceId: Id, excludeEventId: Id): Promise<GroupEvent[]> {
  return http('GET', `${base(bizOfPackage(serviceId))}/transfer-targets?serviceId=${serviceId}&excludeEventId=${excludeEventId}`);
}
export function transferParticipant(bookingId: Id, targetEventId: Id): Promise<Booking> {
  return http('POST', `${base(bizOfBooking(bookingId))}/participants/${bookingId}/transfer`, { targetEventId });
}

// ─────────── ассистенты строки записи (F-16-142/143) ───────────

export function getBookingAssistants(bookingId: Id, serviceIndex: number): Promise<BookingAssistant[]> {
  return http('GET', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/assistants/${serviceIndex}`);
}
export function setBookingAssistants(bookingId: Id, serviceIndex: number, assistants: BookingAssistant[], shareRule: 'full' | 'split'): Promise<BookingAssistant[]> {
  return http('PUT', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/assistants/${serviceIndex}`, { assistants, shareRule });
}

// ─────────── товар/абонемент/сертификат участника (F-16-059) ───────────

export function listParticipantExtras(bookingId: Id): Promise<ParticipantExtraItem[]> {
  return http('GET', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/extras`);
}
export function addParticipantExtra(bookingId: Id, kind: ParticipantExtraKind, name: string, price: number): Promise<ParticipantExtraItem> {
  return http('POST', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/extras`, { kind, name, price });
}
export function removeParticipantExtra(bookingId: Id, itemId: Id): Promise<void> {
  return http('DELETE', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/extras/${itemId}`);
}

// ─────────── оплата участника (F-16-060/061) ───────────

export function getParticipantPayment(bookingId: Id): Promise<ParticipantPayment | undefined> {
  return http('GET', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/payment`);
}
export function payParticipant(bookingId: Id, method: ParticipantPaymentMethod): Promise<Booking> {
  return http('POST', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/payment`, { method });
}
export function cancelParticipantPayment(bookingId: Id): Promise<Booking> {
  return http('DELETE', `${base(bizOfBooking(bookingId))}/bookings/${bookingId}/payment`);
}

export type { PackageExtra };

// ─────────── этап 21 (сдача, попытка 4): по экземплярам ресурса ───────────

export function countFutureUsageByInstance(resourceId: Id): Promise<Record<Id, number>> {
  trackRead('core.bookings', 'core.resources');
  return http<Record<Id, number>>('GET', `${base(bizOfResource(resourceId))}/${resourceId}/future-usage-by-instance`);
}

export function getResourceDayLoad<T>(resourceId: Id, date: string): Promise<T> {
  trackRead('core.bookings', 'core.resources');
  return http<T>('GET', `${base(bizOfResource(resourceId))}/${resourceId}/day-load`, undefined, { query: { date } });
}

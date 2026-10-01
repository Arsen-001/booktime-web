'use client';

/**
 * Раздел «services» на настоящем сервере (docs/backend/PLAN.md этап 4, docs/backend/02 §8). Функции
 * src/api/services.ts в режиме `api` зовут эти; экран получает те же типы, что от мока. Права проверяет сервер.
 *
 * Перечитывание: как у staff.server.ts — зеркалит изменённые категории/услуги в ядро браузера (core.serviceCategories
 * / core.services), чтобы разделы, ещё живущие на моке (журнал, график, клиент, online), видели тот же каталог.
 */
import { http } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import { mirrorCore, unmirror } from '@/api/mirror';
import { ApiError, trackRead } from '@/api/request';
import { bizOf } from '@/api/staff.server';
import type { Id, LocalizedText, Service, ServiceCategory, Staff } from '@/domain/core';
import type { ServiceExtra, StaffServiceTerm, TechBreakMode } from '@/domain/services';
import { useDb, notifyDbChange } from '@/mock/db';

/** Этап 21 «network», попытка 3: экспортирован — `network.server.ts` резолвит бизнес услуги по её id
 * (`getServiceNetworkInfo(serviceId)`: мок несёт только serviceId, без businessId). */
export function bizOfService(serviceId?: Id): Id {
  const fromMirror = serviceId ? useDb.getState().core.services.find((s) => s.id === serviceId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}
function bizOfCategory(categoryId?: Id): Id {
  const fromMirror = categoryId ? useDb.getState().core.serviceCategories.find((c) => c.id === categoryId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

const base = (businessId: Id) => `/v1/biz/${businessId}`;

function changedService(service?: Service | Service[]): void {
  if (service) mirrorCore({ services: Array.isArray(service) ? service : [service] });
  notifyDbChange('areas.services', 'core.services');
}
function changedCategory(category?: ServiceCategory): void {
  if (category) mirrorCore({ serviceCategories: [category] });
  notifyDbChange('areas.services', 'core.serviceCategories');
}
/** Фото/материалы мастера меняются здесь, но карточка сотрудника — core.staff (как в staff.server.ts::changed) */
function changedStaff(staff?: Staff): void {
  if (staff) mirrorCore({ staff: [staff] });
  notifyDbChange('areas.services', 'core.staff');
}

// ─────────── категории ───────────

export function listCategories(businessId: Id): Promise<ServiceCategory[]> {
  trackRead('core.serviceCategories', 'areas.services');
  return http<ServiceCategory[]>('GET', `${base(businessId)}/categories`);
}

export function getCategory(id: Id): Promise<ServiceCategory> {
  trackRead('core.serviceCategories', 'areas.services');
  return http<ServiceCategory>('GET', `${base(bizOfCategory(id))}/categories/${id}`);
}

export interface ServerCategoryInput {
  name: LocalizedText;
  onlineNameEnabled: boolean;
  onlineName?: LocalizedText;
}

export async function createCategory(businessId: Id, input: ServerCategoryInput): Promise<ServiceCategory> {
  const category = await http<ServiceCategory>('POST', `${base(businessId)}/categories`, input);
  changedCategory(category);
  return category;
}

export async function updateCategory(id: Id, businessId: Id, input: ServerCategoryInput): Promise<ServiceCategory> {
  const category = await http<ServiceCategory>('PATCH', `${base(businessId)}/categories/${id}`, input);
  changedCategory(category);
  return category;
}

export function categoryOnlineName(id: Id): Promise<{ onlineNameEnabled: boolean; onlineName?: LocalizedText }> {
  return http('GET', `${base(bizOfCategory(id))}/categories/${id}/online-name`);
}

export function categoryDeleteImpact(id: Id): Promise<{ serviceCount: number }> {
  return http('GET', `${base(bizOfCategory(id))}/categories/${id}/delete-impact`);
}

export async function deleteCategory(id: Id, businessId: Id): Promise<void> {
  await http('DELETE', `${base(businessId)}/categories/${id}`);
  unmirror('serviceCategories', id);
  notifyDbChange('areas.services', 'core.serviceCategories');
}

// ─────────── услуги ───────────

export interface ServerServiceInput {
  categoryId: Id;
  name: LocalizedText;
  description?: LocalizedText;
  kind: Service['kind'];
  capacity?: number;
  durationMin: number;
  durationMax?: number;
  priceMin: number;
  priceMax?: number;
  techBreak: TechBreakMode;
  techBreakMin?: number;
  repeatIntervalDays?: number;
  photos: string[];
  onlineBookable: boolean;
  shadeChoice?: 'required' | 'preferred';
}

export function listServices(businessId: Id, kind?: Service['kind']): Promise<Service[]> {
  trackRead('core.services', 'areas.services');
  return http<Service[]>('GET', `${base(businessId)}/services`, undefined, { query: { kind } });
}

export interface ServerServiceRow {
  service: Service;
  extra: ServiceExtra | undefined;
  staffTerms: StaffServiceTerm[];
}

export function listServiceRows(businessId: Id): Promise<ServerServiceRow[]> {
  trackRead('core.services', 'areas.services');
  return http<ServerServiceRow[]>('GET', `${base(businessId)}/service-rows`);
}

export function getService(id: Id): Promise<Service> {
  trackRead('core.services', 'areas.services');
  return http<Service>('GET', `${base(bizOfService(id))}/services/${id}`);
}

export async function createService(businessId: Id, sphereId: string, input: ServerServiceInput): Promise<Service> {
  const service = await http<Service>('POST', `${base(businessId)}/services`, { ...input, sphereId });
  changedService(service);
  return service;
}

export async function updateService(id: Id, businessId: Id, input: ServerServiceInput, version?: number): Promise<Service> {
  const service = await http<Service>('PATCH', `${base(businessId)}/services/${id}`, input, { version });
  changedService(service);
  return service;
}

export async function setServiceActive(id: Id, businessId: Id, active: boolean): Promise<Service> {
  const service = await http<Service>('PUT', `${base(businessId)}/services/${id}/active`, { active });
  changedService(service);
  return service;
}

export async function reorderServices(ids: Id[]): Promise<void> {
  if (!ids.length) return;
  const businessId = bizOfService(ids[0]);
  await http('PUT', `${base(businessId)}/services/order`, { ids });
  notifyDbChange('areas.services', 'core.services');
}

export async function setServiceTechBreak(id: Id, businessId: Id, mode: TechBreakMode, min?: number): Promise<Service> {
  const service = await http<Service>('PUT', `${base(businessId)}/services/${id}/tech-break`, { mode, min });
  changedService(service);
  return service;
}

export interface ServerTechBreakExportRow {
  id: Id;
  name: string;
  seconds: number | 'Default';
}
export function listTechBreakExportRows(businessId: Id): Promise<ServerTechBreakExportRow[]> {
  return http('GET', `${base(businessId)}/services/tech-break/export`);
}

export interface ServerTechBreakImportResult {
  applied: number;
  failed: { name: string; reason: string }[];
}
export async function importTechBreaks(businessId: Id, rows: { id: Id; name: string; raw: string }[]): Promise<ServerTechBreakImportResult> {
  const res = await http<ServerTechBreakImportResult>('POST', `${base(businessId)}/services/tech-break/import`, { rows });
  notifyDbChange('areas.services', 'core.services');
  return res;
}

export interface ServerServiceDeleteImpact {
  staffCount: number;
  futureBookings: number;
  futureEvents: number;
  packagesUsing: number;
}
export function getServiceDeleteImpact(id: Id): Promise<ServerServiceDeleteImpact> {
  return http('GET', `${base(bizOfService(id))}/services/${id}/delete-impact`);
}

export async function deleteService(id: Id, businessId: Id): Promise<Service> {
  const service = await http<Service>('DELETE', `${base(businessId)}/services/${id}`);
  unmirror('services', id);
  notifyDbChange('areas.services', 'core.services');
  return service;
}

/** «Отменить» (F-00-061): экран держит снимок удалённой услуги и вызывает это в те же 5 с */
export async function restoreService(service: Service): Promise<Service> {
  const restored = await http<Service>('POST', `${base(service.businessId)}/services/restore`, service);
  changedService(restored);
  return restored;
}

// ─────────── мастера услуги (F-10-156, F-02-058, F-16-030) ───────────

export function listServiceStaff(serviceId: Id, businessId: Id): Promise<{ staff: Staff; term?: StaffServiceTerm }[]> {
  return http('GET', `${base(businessId)}/services/${serviceId}/staff`);
}

export async function assignStaffToService(serviceId: Id, staffId: Id, businessId: Id): Promise<void> {
  await http('POST', `${base(businessId)}/services/${serviceId}/staff/${staffId}`);
  notifyDbChange('areas.services', 'areas.staff', 'core.services', 'core.staff');
}

export async function removeStaffFromService(serviceId: Id, staffId: Id, businessId: Id): Promise<void> {
  await http('DELETE', `${base(businessId)}/services/${serviceId}/staff/${staffId}`);
  notifyDbChange('areas.services', 'areas.staff', 'core.services', 'core.staff');
}

export async function setStaffServiceTerm(serviceId: Id, staffId: Id, price: number | undefined, durationMin: number | undefined): Promise<StaffServiceTerm> {
  const businessId = bizOfService(serviceId);
  const term = await http<StaffServiceTerm>('PUT', `${base(businessId)}/services/${serviceId}/staff/${staffId}/term`, { price, durationMin });
  notifyDbChange('areas.services');
  return term;
}

export function getStaffServiceTerms(serviceId: Id, staffId: Id): Promise<{ price: number; priceMax?: number; durationMin: number; durationMax?: number }> {
  const businessId = bizOfService(serviceId);
  return http('GET', `${base(businessId)}/services/${serviceId}/staff/${staffId}/term`);
}

export function listStaffServices(staffId: Id, businessId: Id): Promise<{ category: ServiceCategory; services: { service: Service; term?: StaffServiceTerm }[] }[]> {
  return http('GET', `${base(businessId)}/staff/${staffId}/service-groups`);
}

export function listAssignableStaff(serviceId: Id, businessId: Id): Promise<Staff[]> {
  return http('GET', `${base(businessId)}/services/${serviceId}/assignable-staff`);
}

export function listAssignableServices(staffId: Id, businessId: Id): Promise<Service[]> {
  return http('GET', `${base(businessId)}/staff/${staffId}/assignable-services`);
}

// ─────────── языки, чек, выбор при записи (F-03-115, F-15-141, F-07-149) ───────────

export function getServiceExtra(id: Id): Promise<ServiceExtra | undefined> {
  return http('GET', `${base(bizOfService(id))}/services/${id}/extra`);
}

export async function updateServiceExtra(id: Id, patch: ServiceExtra): Promise<ServiceExtra> {
  const businessId = bizOfService(id);
  const extra = await http<ServiceExtra>('PUT', `${base(businessId)}/services/${id}/extra`, patch);
  notifyDbChange('areas.services');
  return extra;
}

export function getReceiptName(serviceId: Id): Promise<LocalizedText | undefined> {
  return http('GET', `${base(bizOfService(serviceId))}/services/${serviceId}/receipt-name`);
}

export function getServiceTranslations(serviceId: Id): Promise<LocalizedText> {
  return http('GET', `${base(bizOfService(serviceId))}/services/${serviceId}/translations`);
}

// ─────────── пакеты «Комплекс» (F-16-107…135, лейн client стадии 21) ───────────

export interface ServerPackageCreateInput {
  categoryId: Id;
  sphereId: string;
  name: LocalizedText;
}

export async function createPackage(businessId: Id, input: ServerPackageCreateInput): Promise<Service> {
  const service = await http<Service>('POST', `${base(businessId)}/packages`, input);
  changedService(service);
  return service;
}

export interface ServerPackageSaveInput {
  name?: LocalizedText;
  categoryId?: Id;
  items?: { serviceId: Id; order: number }[];
  mode?: 'parallel' | 'sequentialSame' | 'sequentialAny';
  onlineBookable?: boolean;
  description?: LocalizedText;
  photos?: string[];
}

export async function savePackage(id: Id, businessId: Id, input: ServerPackageSaveInput): Promise<Service> {
  const service = await http<Service>('PATCH', `${base(businessId)}/packages/${id}`, input);
  changedService(service);
  return service;
}

// ─────────── стадия 21 (лейн services+rest): порядок категорий (У25) ───────────

export async function reorderCategories(businessId: Id, ids: Id[]): Promise<void> {
  await http('PUT', `${base(businessId)}/categories/order`, { ids });
  notifyDbChange('areas.services');
}

// ─────────── фото работ мастера: свободные места (F-00-085/086), привязка к услуге ───────────

export interface ServerPhotoSlotsInfo {
  used: number;
  base: number;
  extra: number;
  total: number;
  priceCoins: number;
}

export function getPhotoSlots(staffId: Id): Promise<ServerPhotoSlotsInfo> {
  return http('GET', `${base(bizOf(staffId))}/staff/${staffId}/photo-slots`);
}

export function getPhotoServiceLinks(businessId: Id, urls: string[]): Promise<Record<string, Id | undefined>> {
  if (!urls.length) return Promise.resolve({});
  return http('GET', `${base(businessId)}/services/photo-links`, undefined, { query: { urls: urls.join(',') } });
}

export async function savePhotoProfile(staffId: Id, photos: string[], links: Record<string, Id | undefined>): Promise<Staff> {
  const businessId = bizOf(staffId);
  const staff = await http<Staff>('PUT', `${base(businessId)}/staff/${staffId}/photo-profile`, { photos, links });
  changedStaff(staff);
  return staff;
}

/** Место сверх 6 — за монеты (F-00-086); списание и место — одной серверной транзакцией (billing.buyPhotoSlot) */
export async function buyPhotoSlot(businessId: Id, staffId: Id): Promise<ServerPhotoSlotsInfo> {
  await http('POST', `${base(businessId)}/photo-slots`, { staffId });
  return getPhotoSlots(staffId);
}

// ─────────── дипломы и сертификаты — проверяем мы (F-00-088) ───────────

export interface ServerStaffDocument {
  id: Id;
  staffId: Id;
  businessId: Id;
  imageUrl: string;
  fileName?: string;
  uploadedAt: string;
  moderationId?: Id;
}

export function listStaffDocuments(staffId: Id): Promise<ServerStaffDocument[]> {
  return http('GET', `${base(bizOf(staffId))}/staff/${staffId}/documents`);
}

export function addStaffDocument(staffId: Id, businessId: Id, imageUrl: string, fileName: string | undefined, moderationId: Id | undefined): Promise<ServerStaffDocument> {
  return http('POST', `${base(businessId)}/staff/${staffId}/documents`, { imageUrl, fileName, moderationId });
}

export function removeStaffDocument(businessId: Id, id: Id): Promise<void> {
  return http('DELETE', `${base(businessId)}/services/documents/${id}`);
}

export function restoreStaffDocument(businessId: Id, doc: ServerStaffDocument): Promise<void> {
  return http('POST', `${base(businessId)}/services/documents/restore`, doc);
}

// ─────────── материалы (F-00-089) и стерилизация (F-00-090) ───────────

export function getSterilization(staffId: Id): Promise<unknown> {
  return http('GET', `${base(bizOf(staffId))}/staff/${staffId}/sterilization`);
}

export async function saveMaterialsProfile(
  staffId: Id,
  materials: { presetIds: string[]; custom: string[] },
  sterilization: unknown,
): Promise<void> {
  const businessId = bizOf(staffId);
  await http('PUT', `${base(businessId)}/staff/${staffId}/materials-profile`, { materials, sterilization });
  const staff = await http<Staff>('GET', `${base(businessId)}/staff/${staffId}`);
  changedStaff(staff);
}

export interface ServerServiceMaterialsView {
  staffLabels: string[];
  staffCustom: string[];
  stockItems: { id: Id; name: string; brand?: string }[];
}

export function getServiceMaterials(serviceId: Id, locationIds: Id[]): Promise<ServerServiceMaterialsView> {
  const businessId = bizOfService(serviceId);
  return http('GET', `${base(businessId)}/services/${serviceId}/materials`, undefined, { query: { locationIds: locationIds.join(',') } });
}

// ─────────── что есть у мастера: фото, документы, материалы (У28) ───────────

export function listStaffContentCounts(businessId: Id): Promise<Record<Id, { photos: number; documents: number; materials: number }>> {
  return http('GET', `${base(businessId)}/staff-content-counts`);
}

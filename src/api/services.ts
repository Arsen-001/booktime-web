'use client';

/**
 * API раздела «services». Принадлежит разделу.
 * Каталог услуг, категории, шаблоны, мастера услуги, языки/чек/выбор при записи — свой срез поверх Service/
 * ServiceCategory ядра. Каждая правка пишется в общий журнал через logChange() (⭐ F-00-040).
 */
import { coreGet, coreTx } from '@/api/core';
import { isApiMode } from '@/api/http';
import * as S from '@/api/services.server';
import { logChange } from '@/api/staff';
import { mutateArea, readArea, readCore } from '@/api/area';
import { ApiError, request } from '@/api/request';
import type { Id, LocalizedText, Service, ServiceCategory, ServiceKind, Staff } from '@/domain/core';
import type { ServiceSlotWindow } from '@/domain/schedule';
import type {
  CatalogImportRow,
  ServiceExtra,
  ServiceOnlineWindow,
  ServiceStaffEntry,
  ServiceTemplateItem,
  StaffServiceTerm,
  TechBreakMode,
  TemplatePick,
} from '@/domain/services';
import {
  MATERIAL_TAG_IDS,
  PHOTO_BASE_SLOTS,
  PHOTO_EXTRA_SLOT_PRICE_COINS,
  type ReportContentInput,
  type StaffDocument,
  type SterilizationInfo,
} from '@/domain/services';
import { SERVICE_TEMPLATES } from '@/areas/services/templates.data';
import type { SphereId } from '@/domain/core';
import { getModerationStatus, submitForModeration } from '@/api/platform/moderation';
import { spendCoins } from '@/api/settings';
import { listClientMaterials, type ClientMaterialRow } from '@/api/stock';
import { apiIdentity } from '@/api/identity';
import { getStaff as serverGetStaff, listStaff as serverListStaff } from '@/api/staff.server';
import { newId } from '@/lib/id';
import { nowDateTime } from '@/lib/date';
import { isOrderService } from '@/domain/ordersPickup';
// Публичные функции (карточка мастера в приложении клиента) живут в лёгком '@/api/services-public' — здесь их
// демо-реализации (*Mock), а сами функции реэкспортируются: экраны кабинета импортируют их отсюда, как раньше
import { getSterilization, hasVerifiedDocuments, reportContent } from '@/api/services-public';
export { getSterilization, hasVerifiedDocuments, reportContent };

/** Бизнес текущей сессии — для функций раздела, у которых нет businessId в подписи (стадия 21, лейн services+rest) */
function currentBusinessId(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

// ─────────────────────────── Каталог ───────────────────────────

export interface ServiceRow {
  service: Service;
  extra: ServiceExtra | undefined;
  staffTerms: StaffServiceTerm[];
}

/**
 * ⭐ «Приём заказа» (kind 'intake', запись на сдачу 05.10.2026) и «Выдача заказа» (kind 'pickup', выдача по времени
 * 06.10.2026) — услуги раздела «Заказы», их настраивают там: в каталоге
 * услуг, выборе услуг мастера и шаблонах её нет (без явного kind).
 */
const notIntake = (s: Pick<Service, 'kind'>) => !isOrderService(s);

export function listServices(businessId: Id, q: { kind?: ServiceKind } = {}): Promise<Service[]> {
  if (isApiMode()) return S.listServices(businessId, q.kind).then((rows) => (q.kind ? rows : rows.filter(notIntake)));
  return request(() =>
    coreTx.list('services', (s) => s.businessId === businessId && (q.kind ? s.kind === q.kind : notIntake(s))).sort((a, b) => a.order - b.order),
  );
}

export function listServiceRows(businessId: Id): Promise<ServiceRow[]> {
  if (isApiMode()) return S.listServiceRows(businessId).then((rows) => rows.filter((r) => notIntake(r.service)));
  return request(() => {
    const list = coreTx
      .list('services', (s) => s.businessId === businessId && notIntake(s))
      .sort((a, b) => a.order - b.order);
    const extra = readArea('services').serviceExtra;
    const terms = readArea('services').staffTerms;
    return list.map((service) => ({
      service,
      extra: extra[service.id],
      staffTerms: terms.filter((t) => t.serviceId === service.id),
    }));
  });
}

export function listCategories(businessId: Id): Promise<ServiceCategory[]> {
  if (isApiMode()) return S.listCategories(businessId);
  return request(() => coreTx.list('serviceCategories', (c) => c.businessId === businessId).sort((a, b) => a.order - b.order));
}

export function getService(id: Id): Promise<Service> {
  if (isApiMode()) return S.getService(id);
  return coreGet('services', id);
}

export function getCategory(id: Id): Promise<ServiceCategory> {
  if (isApiMode()) return S.getCategory(id);
  return coreGet('serviceCategories', id);
}

export interface ServiceInput {
  categoryId: Id;
  name: LocalizedText;
  description?: LocalizedText;
  kind: ServiceKind;
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

function techBreakToBuffer(mode: TechBreakMode, min?: number): number | undefined {
  if (mode === 'shared') return undefined;
  if (mode === 'none') return 0;
  return min ?? 15;
}

export function bufferToTechBreak(bufferAfterMin?: number): { mode: TechBreakMode; min?: number } {
  if (bufferAfterMin == null) return { mode: 'shared' };
  if (bufferAfterMin === 0) return { mode: 'none' };
  return { mode: 'custom', min: bufferAfterMin };
}

export function createService(businessId: Id, sphereId: SphereId, input: ServiceInput): Promise<Service> {
  if (isApiMode()) return S.createService(businessId, sphereId, input);
  return request(() => {
    const list = coreTx.list('services', (s) => s.businessId === businessId);
    const service = coreTx.create('services', {
      businessId,
      categoryId: input.categoryId,
      sphereId,
      name: input.name,
      description: input.description,
      kind: input.kind,
      capacity: input.kind === 'group' ? input.capacity : undefined,
      durationMin: input.durationMin,
      durationMax: input.durationMax,
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      bufferAfterMin: techBreakToBuffer(input.techBreak, input.techBreakMin),
      repeatIntervalDays: input.repeatIntervalDays,
      photos: input.photos,
      materials: [],
      staffIds: [],
      workplaces: [],
      onlineBookable: input.onlineBookable,
      active: true,
      order: list.length,
      shadeChoice: input.shadeChoice,
    } as Omit<Service, 'id'>);
    writeAudit(businessId, service.id, 'created', undefined, service);
    return service;
  }, { permission: 'services.edit' });
}

export function updateService(id: Id, businessId: Id, input: ServiceInput): Promise<Service> {
  if (isApiMode()) return S.updateService(id, businessId, input);
  return request(() => {
    const before = coreTx.get('services', id);
    const service = coreTx.update('services', id, {
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      kind: input.kind,
      capacity: input.kind === 'group' ? input.capacity : undefined,
      durationMin: input.durationMin,
      durationMax: input.durationMax,
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      bufferAfterMin: techBreakToBuffer(input.techBreak, input.techBreakMin),
      repeatIntervalDays: input.repeatIntervalDays,
      photos: input.photos,
      onlineBookable: input.onlineBookable,
      shadeChoice: input.shadeChoice,
    });
    writeAudit(businessId, id, 'updated', before, service);
    return service;
  }, { permission: 'services.edit' });
}

export function setServiceActive(id: Id, businessId: Id, active: boolean): Promise<Service> {
  if (isApiMode()) return S.setServiceActive(id, businessId, active);
  return request(() => {
    const service = coreTx.update('services', id, { active });
    writeAudit(businessId, id, active ? 'activated' : 'deactivated', undefined, undefined);
    return service;
  }, { permission: 'services.edit' });
}

export function reorderServices(ids: Id[]): Promise<void> {
  if (isApiMode()) return S.reorderServices(ids);
  return request(() => {
    ids.forEach((id, order) => coreTx.update('services', id, { order }));
  }, { permission: 'services.edit' });
}

export function setServiceTechBreak(id: Id, businessId: Id, mode: TechBreakMode, min?: number): Promise<Service> {
  if (isApiMode()) return S.setServiceTechBreak(id, businessId, mode, min);
  return request(() => {
    const service = coreTx.update('services', id, { bufferAfterMin: techBreakToBuffer(mode, min) });
    writeAudit(businessId, id, 'techBreakChanged', undefined, undefined);
    return service;
  }, { permission: 'services.edit' });
}

// ─────────────────────────── Технический перерыв через Excel (F-02-063) ───────────────────────────

const TECH_BREAK_IMPORT_LIMIT = 500;

export interface TechBreakExportRow {
  id: Id;
  name: string;
  /** «Tech. break» в секундах; `'Default'` — без своего значения (общая настройка локации) */
  seconds: number | 'Default';
}

/** Строки для «Выгрузить в Excel»: колонка Tech. break в секундах, `Default` — общая настройка (171382) */
export function listTechBreakExportRows(businessId: Id): Promise<TechBreakExportRow[]> {
  if (isApiMode()) return S.listTechBreakExportRows(businessId);
  return request(() =>
    coreTx
      .list('services', (s) => s.businessId === businessId)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        name: s.name.ru ?? '',
        seconds: s.bufferAfterMin == null ? ('Default' as const) : s.bufferAfterMin * 60,
      })),
  );
}

/** Разбор ячейки «Tech. break»: `0` — без перерыва, `Default` — общая настройка, иначе целое число секунд,
 * кратное 300 (5 мин), не больше 3600 (1 ч); всё остальное — ошибка строки (171382). */
export function parseTechBreakSeconds(raw: string): { mode: TechBreakMode; min?: number } | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (/^default$/i.test(value)) return { mode: 'shared' };
  if (!/^\d+$/.test(value)) return undefined;
  const seconds = Number(value);
  if (seconds === 0) return { mode: 'none' };
  if (seconds % 300 !== 0 || seconds > 3600) return undefined;
  return { mode: 'custom', min: seconds / 60 };
}

export interface TechBreakImportRow {
  id: Id;
  name: string;
  raw: string;
}

export interface TechBreakImportResult {
  applied: number;
  failed: { name: string; reason: string }[];
}

/** «Загрузить из Excel»: применяет колонку Tech. break к перечисленным услугам одной операцией; максимум
 * 500 строк за раз (02 §Список), каждая строка проверяется правилом `parseTechBreakSeconds`. */
export function importTechBreaks(businessId: Id, rows: TechBreakImportRow[]): Promise<TechBreakImportResult> {
  if (isApiMode()) return S.importTechBreaks(businessId, rows);
  return request(() => {
    if (rows.length > TECH_BREAK_IMPORT_LIMIT) throw new ApiError('validation', 'too many rows');
    const failed: { name: string; reason: string }[] = [];
    let applied = 0;
    for (const row of rows) {
      const parsed = parseTechBreakSeconds(row.raw);
      if (!parsed) {
        failed.push({ name: row.name, reason: row.raw });
        continue;
      }
      const service = coreTx.list('services', (s) => s.businessId === businessId && s.id === row.id)[0];
      if (!service) {
        failed.push({ name: row.name, reason: 'not_found' });
        continue;
      }
      coreTx.update('services', row.id, { bufferAfterMin: techBreakToBuffer(parsed.mode, parsed.min) });
      applied += 1;
    }
    coreTx.logDataOperation({
      businessId,
      kind: 'import',
      area: 'services',
      entity: 'services',
      count: applied,
      failed: failed.length || undefined,
    });
    return { applied, failed };
  }, { permission: 'services.edit' });
}

/** Что пострадает при удалении услуги — показать перед подтверждением (F-16-170) */
export interface ServiceDeleteImpact {
  staffCount: number;
  futureBookings: number;
  futureEvents: number;
  packagesUsing: number;
}

export function getServiceDeleteImpact(id: Id): Promise<ServiceDeleteImpact> {
  if (isApiMode()) return S.getServiceDeleteImpact(id);
  return request(() => {
    const core = readCore();
    const service = core.services.find((s) => s.id === id);
    const now = new Date().toISOString();
    return {
      staffCount: service?.staffIds.length ?? 0,
      futureBookings: core.bookings.filter((b) => b.services.some((l) => l.serviceId === id) && b.start > now).length,
      futureEvents: core.groupEvents.filter((e) => e.serviceId === id && e.start > now).length,
      packagesUsing: core.services.filter((s) => s.servicePackage?.items.some((it) => it.serviceId === id)).length,
    };
  });
}

/** Удаляет сразу; отменить (F-00-061) собирает вызывающий экран, храня снимок и вызывая restoreService */
export function deleteService(id: Id, businessId: Id): Promise<Service> {
  if (isApiMode()) return S.deleteService(id, businessId);
  return request(() => {
    const service = coreTx.get('services', id);
    // Снять услугу у мастеров и из пакетов, которые её используют (просьба resources — своя строка)
    readCore().staff
      .filter((st) => st.serviceIds.includes(id))
      .forEach((st) => coreTx.update('staff', st.id, { serviceIds: st.serviceIds.filter((x) => x !== id) }));
    coreTx.remove('services', id);
    writeAudit(businessId, id, 'deleted', service, undefined);
    return service;
  }, { permission: 'services.edit' });
}

export function restoreService(service: Service): Promise<Service> {
  if (isApiMode()) return S.restoreService(service);
  return request(() => coreTx.create('services', service));
}

// ─────────────────────────── Категории ───────────────────────────

export interface CategoryInput {
  name: LocalizedText;
  onlineNameEnabled: boolean;
  onlineName?: LocalizedText;
}

export function createCategory(businessId: Id, input: CategoryInput): Promise<ServiceCategory> {
  if (isApiMode()) return S.createCategory(businessId, input);
  return request(() => {
    const list = coreTx.list('serviceCategories', (c) => c.businessId === businessId);
    const category = coreTx.create('serviceCategories', { businessId, name: input.name, order: list.length });
    if (input.onlineNameEnabled) {
      mutateArea('services', (s) => {
        s.categoryExtra[category.id] = { onlineNameEnabled: true, onlineName: input.onlineName };
      });
    }
    writeAudit(businessId, category.id, 'created', undefined, category);
    return category;
  }, { permission: 'services.edit' });
}

export function updateCategory(id: Id, businessId: Id, input: CategoryInput): Promise<ServiceCategory> {
  if (isApiMode()) return S.updateCategory(id, businessId, input);
  return request(() => {
    const category = coreTx.update('serviceCategories', id, { name: input.name });
    mutateArea('services', (s) => {
      s.categoryExtra[id] = { onlineNameEnabled: input.onlineNameEnabled, onlineName: input.onlineName };
    });
    writeAudit(businessId, id, 'updated', undefined, category);
    return category;
  }, { permission: 'services.edit' });
}

export interface CategoryDeleteImpact {
  serviceCount: number;
}

export function getCategoryDeleteImpact(id: Id): Promise<CategoryDeleteImpact> {
  if (isApiMode()) return S.categoryDeleteImpact(id);
  return request(() => ({ serviceCount: readCore().services.filter((s) => s.categoryId === id).length }));
}

export function deleteCategory(id: Id, businessId: Id): Promise<void> {
  if (isApiMode()) return S.deleteCategory(id, businessId);
  return request(() => {
    coreTx.remove('serviceCategories', id);
    mutateArea('services', (s) => {
      delete s.categoryExtra[id];
    });
    writeAudit(businessId, id, 'deleted', undefined, undefined);
  }, { permission: 'services.edit' });
}

export function getCategoryOnlineName(id: Id): Promise<{ onlineNameEnabled: boolean; onlineName?: LocalizedText }> {
  if (isApiMode()) return S.categoryOnlineName(id);
  return request(() => {
    const extra = readArea('services').categoryExtra[id];
    return { onlineNameEnabled: extra?.onlineNameEnabled ?? false, onlineName: extra?.onlineName };
  });
}

// ─────────────────────────── Шаблоны (F-00-083, F-00-173) ───────────────────────────

export function listTemplates(sphereId: SphereId): Promise<ServiceTemplateItem[]> {
  return request(() => SERVICE_TEMPLATES[sphereId] ?? SERVICE_TEMPLATES.general);
}

/** Готовые услуги сферы — категория ищется/заводится по имени, услуга создаётся тем же createCategory/createService,
 * которые в api-режиме уже идут на сервер (шаблоны сами остаются локальным статическим справочником — F-00-173). */
/** Выбор шаблонов: старый вызов — список id (settings, platform), новый — с правками цены/длительности/категории/мастеров (У25) */
function normalizePicks(sphereId: SphereId, picks: string[] | TemplatePick[]): { tpl: ServiceTemplateItem; pick: TemplatePick }[] {
  const all = SERVICE_TEMPLATES[sphereId] ?? SERVICE_TEMPLATES.general;
  const list: TemplatePick[] = picks.map((p) => {
    if (typeof p !== 'string') return p;
    const tpl = all.find((x) => x.id === p);
    return { templateId: p, priceMin: tpl?.priceMin ?? 0, durationMin: tpl?.durationMin ?? 60, staffIds: [] };
  });
  return list.flatMap((pick) => {
    const tpl = all.find((x) => x.id === pick.templateId);
    return tpl ? [{ tpl, pick }] : [];
  });
}

async function addFromTemplatesApi(businessId: Id, sphereId: SphereId, picks: string[] | TemplatePick[]): Promise<Service[]> {
  const categories = await listCategories(businessId);
  const created: Service[] = [];
  const active = await listStaffForPicker(businessId);
  const soleStaff = active.length === 1 ? [active[0].id] : [];
  for (const { tpl, pick } of normalizePicks(sphereId, picks)) {
    let category = pick.categoryId ? categories.find((c) => c.id === pick.categoryId) : categories.find((c) => c.name.ru === tpl.categoryName.ru);
    if (!category) {
      category = await createCategory(businessId, { name: tpl.categoryName, onlineNameEnabled: false });
      categories.push(category);
    }
    const service = await createService(businessId, sphereId, {
      categoryId: category.id,
      name: tpl.name,
      kind: tpl.kind ?? 'individual',
      durationMin: pick.durationMin,
      priceMin: pick.priceMin,
      techBreak: 'shared',
      photos: [],
      onlineBookable: true,
    });
    for (const staffId of pick.staffIds.length ? pick.staffIds : soleStaff) await S.assignStaffToService(service.id, staffId, businessId);
    created.push(service);
  }
  return created;
}

export function addFromTemplates(businessId: Id, sphereId: SphereId, picks: string[] | TemplatePick[]): Promise<Service[]> {
  if (isApiMode()) return addFromTemplatesApi(businessId, sphereId, picks);
  return request(() => {
    const categories = readCore().serviceCategories.filter((c) => c.businessId === businessId);
    const created: Service[] = [];
    // Один мастер (индивидуал, новый салон) — услуги шаблона сразу его, иначе онлайн-запись не опубликовать
    const active = readCore().staff.filter((st) => st.businessId === businessId && st.status !== 'fired');
    const soleStaff = active.length === 1 ? [active[0].id] : [];
    normalizePicks(sphereId, picks).forEach(({ tpl, pick }) => {
      let category = pick.categoryId
        ? categories.find((c) => c.id === pick.categoryId)
        : categories.find((c) => c.name.ru === tpl.categoryName.ru);
      if (!category) {
        category = coreTx.create('serviceCategories', { businessId, name: tpl.categoryName, order: categories.length });
        categories.push(category);
      }
      const list = coreTx.list('services', (s) => s.businessId === businessId);
      const service = coreTx.create('services', {
        businessId,
        categoryId: category.id,
        sphereId,
        name: tpl.name,
        kind: tpl.kind ?? 'individual',
        durationMin: pick.durationMin,
        priceMin: pick.priceMin,
        photos: [],
        materials: [],
        staffIds: [],
        workplaces: [],
        onlineBookable: true,
        active: true,
        order: list.length,
      } as Omit<Service, 'id'>);
      created.push(applyStaffIds(service.id, pick.staffIds.length ? pick.staffIds : soleStaff));
    });
    created.forEach((s) => writeAudit(businessId, s.id, 'created', undefined, s));
    return created;
  }, { permission: 'services.edit' });
}

// ─────────────────────────── Мастера услуги (F-10-156, F-02-058, F-16-030) ───────────────────────────

export function listServiceStaff(serviceId: Id, businessId: Id): Promise<{ staff: Staff; term?: StaffServiceTerm }[]> {
  if (isApiMode()) return S.listServiceStaff(serviceId, businessId);
  return request(() => {
    const service = readCore().services.find((s) => s.id === serviceId);
    const staffList = readCore().staff.filter((s) => s.businessId === businessId && (service?.staffIds.includes(s.id) ?? false));
    const terms = readArea('services').staffTerms.filter((t) => t.serviceId === serviceId);
    return staffList.map((staff) => ({ staff, term: terms.find((t) => t.staffId === staff.id) }));
  });
}

export function assignStaffToService(serviceId: Id, staffId: Id, businessId: Id): Promise<void> {
  if (isApiMode()) return S.assignStaffToService(serviceId, staffId, businessId);
  return request(() => {
    const service = coreTx.get('services', serviceId);
    const staff = coreTx.get('staff', staffId);
    if (!service.staffIds.includes(staffId)) coreTx.update('services', serviceId, { staffIds: [...service.staffIds, staffId] });
    if (!staff.serviceIds.includes(serviceId)) coreTx.update('staff', staffId, { serviceIds: [...staff.serviceIds, serviceId] });
    writeAudit(businessId, serviceId, 'staffAssigned', undefined, { staffId });
  }, { permission: 'services.edit' });
}

export function removeStaffFromService(serviceId: Id, staffId: Id, businessId: Id): Promise<void> {
  if (isApiMode()) return S.removeStaffFromService(serviceId, staffId, businessId);
  return request(() => {
    const service = coreTx.get('services', serviceId);
    const staff = coreTx.get('staff', staffId);
    coreTx.update('services', serviceId, { staffIds: service.staffIds.filter((id) => id !== staffId) });
    coreTx.update('staff', staffId, { serviceIds: staff.serviceIds.filter((id) => id !== serviceId) });
    mutateArea('services', (s) => {
      s.staffTerms = s.staffTerms.filter((t) => !(t.serviceId === serviceId && t.staffId === staffId));
    });
    writeAudit(businessId, serviceId, 'staffRemoved', undefined, { staffId });
  }, { permission: 'services.edit' });
}

export function setStaffServiceTerm(serviceId: Id, staffId: Id, price?: number, durationMin?: number): Promise<StaffServiceTerm> {
  if (isApiMode()) return S.setStaffServiceTerm(serviceId, staffId, price, durationMin);
  return request(() => {
    let result!: StaffServiceTerm;
    mutateArea('services', (s) => {
      const idx = s.staffTerms.findIndex((t) => t.serviceId === serviceId && t.staffId === staffId);
      const term: StaffServiceTerm = { serviceId, staffId, price, durationMin };
      if (idx >= 0) s.staffTerms[idx] = term;
      else s.staffTerms.push(term);
      result = term;
    });
    return result;
  }, { permission: 'services.edit' });
}

/** Итоговая цена/длительность мастера по услуге — читают schedule и journal */
export function getStaffServiceTerms(serviceId: Id, staffId: Id): Promise<{ price: number; priceMax?: number; durationMin: number; durationMax?: number }> {
  if (isApiMode()) return S.getStaffServiceTerms(serviceId, staffId);
  return request(() => {
    const service = readCore().services.find((s) => s.id === serviceId);
    if (!service) throw new Error('not_found');
    const term = readArea('services').staffTerms.find((t) => t.serviceId === serviceId && t.staffId === staffId);
    return {
      price: term?.price ?? service.priceMin,
      priceMax: service.priceMax,
      durationMin: term?.durationMin ?? service.durationMin,
      durationMax: service.durationMax,
    };
  });
}

/** Услуги мастера по категориям — вклад «Услуги» в карточку сотрудника (F-10-027) */
export function listStaffServices(staffId: Id, businessId: Id): Promise<{ category: ServiceCategory; services: { service: Service; term?: StaffServiceTerm }[] }[]> {
  if (isApiMode()) return S.listStaffServices(staffId, businessId);
  return request(() => {
    const staff = readCore().staff.find((s) => s.id === staffId);
    const categories = readCore().serviceCategories.filter((c) => c.businessId === businessId).sort((a, b) => a.order - b.order);
    const terms = readArea('services').staffTerms.filter((t) => t.staffId === staffId);
    return categories
      .map((category) => ({
        category,
        services: readCore()
          .services.filter((s) => s.businessId === businessId && s.categoryId === category.id && (staff?.serviceIds.includes(s.id) ?? false))
          .map((service) => ({ service, term: terms.find((t) => t.serviceId === service.id) })),
      }))
      .filter((g) => g.services.length > 0);
  });
}

/** Сотрудники, ещё не назначенные на услугу — для вкладки «Мастера» (F-10-156) */
export function listAssignableStaff(serviceId: Id, businessId: Id): Promise<Staff[]> {
  if (isApiMode()) return S.listAssignableStaff(serviceId, businessId);
  return request(() => {
    const service = readCore().services.find((s) => s.id === serviceId);
    return readCore().staff.filter((s) => s.businessId === businessId && s.status !== 'fired' && !(service?.staffIds.includes(s.id) ?? false));
  });
}

export function listAssignableServices(staffId: Id, businessId: Id): Promise<Service[]> {
  if (isApiMode()) return S.listAssignableServices(staffId, businessId).then((rows) => rows.filter(notIntake));
  return request(() => {
    const staff = readCore().staff.find((s) => s.id === staffId);
    return readCore().services.filter((s) => s.businessId === businessId && notIntake(s) && !(staff?.serviceIds.includes(s.id) ?? false));
  });
}

// ─────────────────────────── Языки, чек, выбор при записи (F-03-115, F-15-141, F-07-149, F-00-094) ───────────────────────────

export function getServiceExtra(id: Id): Promise<ServiceExtra | undefined> {
  if (isApiMode()) return S.getServiceExtra(id);
  return request(() => readArea('services').serviceExtra[id]);
}

export function updateServiceExtra(id: Id, patch: ServiceExtra): Promise<ServiceExtra> {
  if (isApiMode()) return S.updateServiceExtra(id, patch);
  return request(() => {
    let result!: ServiceExtra;
    mutateArea('services', (s) => {
      result = { ...s.serviceExtra[id], ...patch };
      s.serviceExtra[id] = result;
    });
    return result;
  }, { permission: 'services.edit' });
}

export function getReceiptName(serviceId: Id): Promise<LocalizedText | undefined> {
  if (isApiMode()) return S.getReceiptName(serviceId);
  return request(() => readArea('services').serviceExtra[serviceId]?.receipt?.receiptName);
}

export function getServiceTranslations(serviceId: Id): Promise<LocalizedText> {
  if (isApiMode()) return S.getServiceTranslations(serviceId);
  return request(() => {
    const service = readCore().services.find((s) => s.id === serviceId);
    if (!service) throw new Error('not_found');
    return service.name;
  });
}

function writeAudit(businessId: Id, entityId: Id, action: string, before: unknown, after: unknown): void {
  void logChange({ businessId, entity: 'service', entityId, action, before, after });
}

// ─────────────────────────── Мастера для выбора на экранах раздела (фото/документы/материалы) ───────────────────────────

/** Активные сотрудники бизнеса — для селектора «чей профиль» на /biz/services/{photos,documents,materials} */
export function listStaffForPicker(businessId: Id): Promise<Staff[]> {
  if (isApiMode()) return serverListStaff(businessId).then((rows) => rows.map((r) => r.staff).filter((s) => s.status !== 'fired'));
  return request(() => readCore().staff.filter((s) => s.businessId === businessId && s.status !== 'fired'));
}

// ─────────────────────────── Фото работ: 6 мест на мастера (F-00-085, F-00-086) ───────────────────────────

export interface PhotoSlotsInfo {
  used: number;
  base: number;
  extra: number;
  total: number;
  priceCoins: number;
}

export function getPhotoSlots(staffId: Id): Promise<PhotoSlotsInfo> {
  if (isApiMode()) return S.getPhotoSlots(staffId);
  return request(() => {
    const staff = coreTx.get('staff', staffId);
    const extra = readArea('services').photoExtraSlots[staffId] ?? 0;
    return { used: staff.photos.length, base: PHOTO_BASE_SLOTS, extra, total: PHOTO_BASE_SLOTS + extra, priceCoins: PHOTO_EXTRA_SLOT_PRICE_COINS };
  });
}

export function getStaffPhotos(staffId: Id): Promise<string[]> {
  return request(() => coreTx.get('staff', staffId).photos);
}

/**
 * Сохраняет фото работ мастера (6 мест всего, галерея и фото к услугам вместе — F-00-085). Новые фото (не бывшие
 * в прошлом значении) уходят на проверку платформы (F-00-168); при удалении место освобождается само —
 * `photos.length` меньше.
 */
/** api-режим: новые снимки — на проверку (F-00-168), сохранение — одним запросом, отдающим Staff свежим */
async function setStaffPhotosApi(staffId: Id, businessId: Id, photos: string[], links: Record<string, Id | undefined>): Promise<Staff> {
  const before = coreTx.get('staff', staffId).photos;
  const { extra } = await S.getPhotoSlots(staffId);
  if (photos.length > PHOTO_BASE_SLOTS + extra) throw new ApiError('validation', 'Нет свободных мест');
  const added = photos.filter((url) => !before.includes(url));
  for (const url of added) {
    await submitForModeration({ kind: 'staffPhoto', businessId, staffId, refId: url, imageUrl: url });
  }
  return S.savePhotoProfile(staffId, photos, links);
}

export function setStaffPhotos(staffId: Id, businessId: Id, photos: string[]): Promise<Staff> {
  if (isApiMode()) return (async () => setStaffPhotosApi(staffId, businessId, photos, await S.getPhotoServiceLinks(businessId, photos)))();
  return request(async () => {
    const before = coreTx.get('staff', staffId).photos;
    const extra = readArea('services').photoExtraSlots[staffId] ?? 0;
    if (photos.length > PHOTO_BASE_SLOTS + extra) throw new ApiError('validation', 'Нет свободных мест');
    const added = photos.filter((url) => !before.includes(url));
    const staff = coreTx.update('staff', staffId, { photos });
    for (const url of added) {
      await submitForModeration({ kind: 'staffPhoto', businessId, staffId, refId: url, imageUrl: url });
    }
    mutateArea('services', (s) => {
      const removed = before.filter((url) => !photos.includes(url));
      removed.forEach((url) => delete s.photoServiceLinks[url]);
    });
    writeAudit(businessId, staffId, 'staffPhotosChanged', before.length, photos.length);
    return staff;
  }, { permission: 'services.edit' });
}

export function getPhotoServiceLink(url: string): Promise<Id | undefined> {
  return request(() => readArea('services').photoServiceLinks[url]);
}

export function setPhotoServiceLink(url: string, serviceId: Id | undefined): Promise<void> {
  return request(() => {
    mutateArea('services', (s) => {
      if (serviceId) s.photoServiceLinks[url] = serviceId;
      else delete s.photoServiceLinks[url];
    });
  }, { permission: 'services.edit' });
}

/** Привязки всех фото мастера одним запросом (вместо запроса на каждое фото) */
export function getPhotoServiceLinks(urls: string[]): Promise<Record<string, Id | undefined>> {
  if (isApiMode()) return S.getPhotoServiceLinks(currentBusinessId(), urls);
  return request(() => {
    const links = readArea('services').photoServiceLinks;
    return Object.fromEntries(urls.map((u) => [u, links[u]]));
  });
}

/**
 * «Сохранить» на экране фото работ (У3): снимки и их привязка к услугам — одной операцией. Новые снимки уходят на
 * проверку (F-00-168), у удалённых снимается привязка.
 */
export function savePhotoProfile(staffId: Id, businessId: Id, photos: string[], links: Record<string, Id | undefined>): Promise<Staff> {
  if (isApiMode()) return setStaffPhotosApi(staffId, businessId, photos, links);
  return request(async () => {
    const before = coreTx.get('staff', staffId).photos;
    const extra = readArea('services').photoExtraSlots[staffId] ?? 0;
    if (photos.length > PHOTO_BASE_SLOTS + extra) throw new ApiError('validation', 'Нет свободных мест');
    const added = photos.filter((url) => !before.includes(url));
    const staff = coreTx.update('staff', staffId, { photos });
    for (const url of added) {
      await submitForModeration({ kind: 'staffPhoto', businessId, staffId, refId: url, imageUrl: url });
    }
    mutateArea('services', (s) => {
      before.filter((url) => !photos.includes(url)).forEach((url) => delete s.photoServiceLinks[url]);
      photos.forEach((url) => {
        if (links[url]) s.photoServiceLinks[url] = links[url];
        else delete s.photoServiceLinks[url];
      });
    });
    writeAudit(businessId, staffId, 'staffPhotosChanged', before.length, photos.length);
    return staff;
  }, { permission: 'services.edit' });
}

/** Место сверх 6 — за монеты, покупается один раз (F-00-086); нет средств → ApiError('not_enough_coins') */
export function buyPhotoSlot(staffId: Id, businessId: Id): Promise<PhotoSlotsInfo> {
  if (isApiMode()) return S.buyPhotoSlot(businessId, staffId);
  return request(async () => {
    await spendCoins({ businessId, amount: PHOTO_EXTRA_SLOT_PRICE_COINS, reason: 'servicesPhotoSlot', area: 'services', refId: staffId });
    mutateArea('services', (s) => {
      s.photoExtraSlots[staffId] = (s.photoExtraSlots[staffId] ?? 0) + 1;
    });
    writeAudit(businessId, staffId, 'photoSlotPurchased', undefined, undefined);
    return getPhotoSlots(staffId);
  });
}

// ─────────────────────────── Дипломы и сертификаты — проверяем мы (F-00-088) ───────────────────────────

export function listStaffDocuments(staffId: Id): Promise<StaffDocument[]> {
  if (isApiMode()) return S.listStaffDocuments(staffId);
  return request(() => readArea('services').documents.filter((d) => d.staffId === staffId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
}

export function addStaffDocument(staffId: Id, businessId: Id, imageUrl: string, fileName?: string): Promise<StaffDocument> {
  if (isApiMode()) {
    return (async () => {
      const moderation = await submitForModeration({ kind: 'diploma', businessId, staffId, refId: imageUrl, imageUrl, label: fileName });
      return S.addStaffDocument(staffId, businessId, imageUrl, fileName, moderation.id);
    })();
  }
  return request(async () => {
    const moderation = await submitForModeration({ kind: 'diploma', businessId, staffId, refId: imageUrl, imageUrl, label: fileName });
    const doc: StaffDocument = { id: newId('doc'), staffId, businessId, imageUrl, fileName, uploadedAt: nowDateTime(), moderationId: moderation.id };
    mutateArea('services', (s) => {
      s.documents.unshift(doc);
    });
    writeAudit(businessId, staffId, 'documentAdded', undefined, { fileName });
    return doc;
  }, { permission: 'services.edit' });
}

export function removeStaffDocument(id: Id): Promise<void> {
  if (isApiMode()) return S.removeStaffDocument(currentBusinessId(), id);
  return request(() => {
    mutateArea('services', (s) => {
      s.documents = s.documents.filter((d) => d.id !== id);
    });
  }, { permission: 'services.edit' });
}

/** «Отменить» после удаления документа — возвращается тот же документ с тем же статусом проверки (У26) */
export function restoreStaffDocument(doc: StaffDocument): Promise<void> {
  if (isApiMode()) return S.restoreStaffDocument(doc.businessId, doc);
  return request(() => {
    mutateArea('services', (s) => {
      if (!s.documents.some((d) => d.id === doc.id)) s.documents.unshift(doc);
    });
  }, { permission: 'services.edit' });
}

/** Демо-реализация hasVerifiedDocuments (сервер и обёртка — '@/api/services-public') */
export function hasVerifiedDocumentsMock(staffId: Id): Promise<boolean> {
  return request(() => {
    const docs = readArea('services').documents.filter((d) => d.staffId === staffId);
    const moderation = readModerationSnapshot();
    return docs.some((d) => {
      const item = moderation.find((m) => m.refId === d.imageUrl);
      return item?.status === 'approved' || item?.status === 'auto';
    });
  });
}

export type ContentModerationStatus = 'pending' | 'approved' | 'rejected' | 'auto';

export function getDocumentStatus(imageUrl: string): Promise<ContentModerationStatus | undefined> {
  if (isApiMode()) return getModerationStatus(imageUrl).then((m) => m?.status as ContentModerationStatus | undefined);
  return request(() => readModerationSnapshot().find((m) => m.refId === imageUrl)?.status);
}

/** Статус проверки конкретного фото работы (F-00-085/F-00-168) — для значка на /biz/services/photos */
export function getPhotoStatus(url: string): Promise<ContentModerationStatus | undefined> {
  if (isApiMode()) return getModerationStatus(url).then((m) => m?.status as ContentModerationStatus | undefined);
  return request(() => readModerationSnapshot().find((m) => m.refId === url)?.status);
}

export function getPhotoStatuses(urls: string[]): Promise<Record<string, ContentModerationStatus | undefined>> {
  if (isApiMode()) {
    return (async () => {
      const entries = await Promise.all(urls.map(async (u) => [u, (await getModerationStatus(u))?.status as ContentModerationStatus | undefined] as const));
      return Object.fromEntries(entries);
    })();
  }
  return request(() => {
    const snapshot = readModerationSnapshot();
    return Object.fromEntries(urls.map((u) => [u, snapshot.find((m) => m.refId === u)?.status]));
  });
}

/** Причины отказа по фото и документам (F-00-170): мастер видит не только «Отклонено», но и почему */
export function getRejectReasons(refIds: string[]): Promise<Record<string, { label?: LocalizedText; note?: string }>> {
  if (isApiMode()) {
    return (async () => {
      const out: Record<string, { label?: LocalizedText; note?: string }> = {};
      await Promise.all(
        refIds.map(async (id) => {
          const m = (await getModerationStatus(id)) as { status?: string; reasonNote?: string; reasonLabel?: LocalizedText } | undefined;
          if (m?.status === 'rejected') out[id] = { label: m.reasonLabel, note: m.reasonNote };
        }),
      );
      return out;
    })();
  }
  return request(() => {
    const platform = readArea('platform');
    const out: Record<string, { label?: LocalizedText; note?: string }> = {};
    refIds.forEach((id) => {
      const m = platform.moderationItems.find((x) => x.refId === id);
      if (m?.status !== 'rejected') return;
      out[id] = { label: platform.rejectReasons.find((r) => r.id === m.reasonId)?.label, note: m.reasonNote };
    });
    return out;
  });
}

// ─────────────────────────── Материалы (F-00-089) и стерилизация (F-00-090) ───────────────────────────

export { MATERIAL_TAG_IDS };

/** Метки материалов мастера: пресеты из MATERIAL_TAG_IDS живут вперемешку со свободным текстом в Staff.materials */
export function getStaffMaterials(staffId: Id): Promise<{ presetIds: string[]; custom: string[] }> {
  const split = (list: string[]) => ({
    presetIds: list.filter((m) => (MATERIAL_TAG_IDS as readonly string[]).includes(m)),
    custom: list.filter((m) => !(MATERIAL_TAG_IDS as readonly string[]).includes(m)),
  });
  if (isApiMode()) return serverGetStaff(staffId).then((staff) => split(staff.materials));
  return request(() => split(coreTx.get('staff', staffId).materials));
}

export function setStaffMaterials(staffId: Id, businessId: Id, presetIds: string[], custom: string[]): Promise<Staff> {
  return request(() => {
    const staff = coreTx.update('staff', staffId, { materials: [...presetIds, ...custom] });
    writeAudit(businessId, staffId, 'materialsChanged', undefined, undefined);
    return staff;
  }, { permission: 'services.edit' });
}

/** «Сохранить» на экране материалов (У3): метки и стерилизация одной операцией */
export function saveMaterialsProfile(
  staffId: Id,
  businessId: Id,
  materials: { presetIds: string[]; custom: string[] },
  sterilization: SterilizationInfo,
): Promise<void> {
  if (isApiMode()) return S.saveMaterialsProfile(staffId, materials, sterilization);
  return request(() => {
    coreTx.update('staff', staffId, { materials: [...materials.presetIds, ...materials.custom] });
    mutateArea('services', (s) => {
      s.sterilization[staffId] = sterilization;
    });
    writeAudit(businessId, staffId, 'materialsChanged', undefined, sterilization);
  }, { permission: 'services.edit' });
}

/** Демо-реализация getSterilization (сервер и обёртка — '@/api/services-public') */
export function getSterilizationMock(staffId: Id): Promise<SterilizationInfo | undefined> {
  return request(() => readArea('services').sterilization[staffId]);
}

export function setSterilization(staffId: Id, businessId: Id, info: SterilizationInfo): Promise<void> {
  return request(() => {
    mutateArea('services', (s) => {
      s.sterilization[staffId] = info;
    });
    writeAudit(businessId, staffId, 'sterilizationChanged', undefined, info);
  }, { permission: 'services.edit' });
}

/** Материалы, видные на карточке услуги: сплав меток мастеров услуги + товары склада «показывать клиентам» */
export interface ServiceMaterialsView {
  staffLabels: string[];
  staffCustom: string[];
  stockItems: ClientMaterialRow[];
}

export function getServiceMaterials(serviceId: Id, locationIds: Id[]): Promise<ServiceMaterialsView> {
  if (isApiMode()) return S.getServiceMaterials(serviceId, locationIds);
  return request(async () => {
    const service = readCore().services.find((s) => s.id === serviceId);
    const staff = service ? readCore().staff.filter((s) => service.staffIds.includes(s.id)) : [];
    const presetSet = new Set<string>();
    const customSet = new Set<string>();
    staff.forEach((s) => {
      s.materials.forEach((m) => {
        if ((MATERIAL_TAG_IDS as readonly string[]).includes(m)) presetSet.add(m);
        else customSet.add(m);
      });
    });
    const perLocation = await Promise.all(locationIds.map((locId) => listClientMaterials(service?.businessId ?? '', locId)));
    const stockItems = new Map<Id, ClientMaterialRow>();
    perLocation.flat().forEach((row) => stockItems.set(row.id, row));
    return { staffLabels: [...presetSet], staffCustom: [...customSet], stockItems: [...stockItems.values()] };
  });
}

// ─────────────────────────── Жалоба на контент (F-00-091) ───────────────────────────
// data-f="F-00-091"

/**
 * Клиент жалуется на чужое фото/сторис/карточку мастера — попадает в общую очередь проверки платформы.
 * Кнопку «Пожаловаться» ставят экраны client и online (см. qa/requests/services.md); здесь — сам механизм.
 * Экраны зовут reportContent (лёгкий '@/api/services-public' догружает этот модуль по нажатию).
 */
export function reportContentNow(input: ReportContentInput): Promise<void> {
  return request(async () => {
    await submitForModeration({
      kind: 'complaint',
      businessId: input.businessId,
      refId: `complaint:${newId('rep')}`,
      staffId: input.staffId,
      text: input.reason,
      targetItemId: input.refId,
    });
  });
}

// ─────────────────────────── Каталог: правки прямо из списка, массовые действия (У5, У10) ───────────────────────────

/** Поля, которые меняются в строке таблицы каталога и массово */
export type ServicePatch = Partial<Pick<Service, 'priceMin' | 'priceMax' | 'durationMin' | 'durationMax' | 'onlineBookable' | 'categoryId' | 'bufferAfterMin'>>;

function serviceToInput(s: Service): ServiceInput {
  const tb = bufferToTechBreak(s.bufferAfterMin);
  return {
    categoryId: s.categoryId,
    name: s.name,
    description: s.description,
    kind: s.kind,
    capacity: s.capacity,
    durationMin: s.durationMin,
    durationMax: s.durationMax,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    techBreak: tb.mode,
    techBreakMin: tb.min,
    repeatIntervalDays: s.repeatIntervalDays,
    photos: s.photos,
    onlineBookable: s.onlineBookable,
    shadeChoice: s.shadeChoice,
  };
}

async function patchServiceApi(id: Id, businessId: Id, patch: ServicePatch): Promise<Service> {
  const merged = { ...(await S.getService(id)), ...patch };
  return S.updateService(id, businessId, serviceToInput(merged));
}

/** Одна ячейка строки: цена, длительность, перерыв, онлайн, категория. `undefined` в patch — очистить поле («до») */
export function patchService(id: Id, businessId: Id, patch: ServicePatch): Promise<Service> {
  if (isApiMode()) return patchServiceApi(id, businessId, patch);
  return request(() => {
    const service = coreTx.update('services', id, patch);
    writeAudit(businessId, id, 'updated', undefined, patch);
    return service;
  }, { permission: 'services.edit' });
}

/** Массово: «Онлайн вкл/выкл», «Перенести в категорию» */
export function bulkPatchServices(ids: Id[], businessId: Id, patch: ServicePatch): Promise<number> {
  if (isApiMode()) return Promise.all(ids.map((id) => patchServiceApi(id, businessId, patch))).then((r) => r.length);
  return request(() => {
    ids.forEach((id) => coreTx.update('services', id, patch));
    ids.forEach((id) => writeAudit(businessId, id, 'updated', undefined, patch));
    return ids.length;
  }, { permission: 'services.edit' });
}

/** Массовое удаление — снимки для «Отменить» (restoreServices) */
export function bulkDeleteServices(ids: Id[], businessId: Id): Promise<Service[]> {
  if (isApiMode()) {
    return (async () => {
      const out: Service[] = [];
      for (const id of ids) out.push(await S.deleteService(id, businessId));
      return out;
    })();
  }
  return request(() => {
    const snapshots = ids.map((id) => coreTx.get('services', id));
    readCore()
      .staff.filter((st) => st.serviceIds.some((x) => ids.includes(x)))
      .forEach((st) => coreTx.update('staff', st.id, { serviceIds: st.serviceIds.filter((x) => !ids.includes(x)) }));
    ids.forEach((id) => coreTx.remove('services', id));
    snapshots.forEach((s) => writeAudit(businessId, s.id, 'deleted', s, undefined));
    coreTx.logDataOperation({ businessId, kind: 'delete', area: 'services', entity: 'services', count: ids.length });
    return snapshots;
  }, { permission: 'services.edit' });
}

/** «Отменить» после удаления: услуги возвращаются вместе с назначением мастерам */
export function restoreServices(snapshots: Service[]): Promise<void> {
  if (isApiMode()) {
    return (async () => {
      for (const s of snapshots) await S.restoreService(s);
    })();
  }
  return request(() => {
    snapshots.forEach((s) => {
      coreTx.create('services', s);
      s.staffIds.forEach((staffId) => {
        const st = readCore().staff.find((x) => x.id === staffId);
        if (st && !st.serviceIds.includes(s.id)) coreTx.update('staff', staffId, { serviceIds: [...st.serviceIds, s.id] });
      });
    });
  }, { permission: 'services.edit' });
}

/** Порядок категорий (перетаскивание ⠿) */
export function reorderCategories(ids: Id[]): Promise<void> {
  if (isApiMode()) return S.reorderCategories(currentBusinessId(), ids);
  return request(() => {
    ids.forEach((id, order) => coreTx.update('serviceCategories', id, { order }));
  }, { permission: 'services.edit' });
}

/** Внутри request(): мастера услуги = staffIds; у снятых стираются свои цены. Возвращает свежую услугу */
function applyStaffIds(serviceId: Id, staffIds: Id[]): Service {
  const service = coreTx.get('services', serviceId);
  const removed = service.staffIds.filter((id) => !staffIds.includes(id));
  readCore()
    .staff.filter((st) => staffIds.includes(st.id) || removed.includes(st.id))
    .forEach((st) => {
      const has = st.serviceIds.includes(serviceId);
      const want = staffIds.includes(st.id);
      if (want && !has) coreTx.update('staff', st.id, { serviceIds: [...st.serviceIds, serviceId] });
      if (!want && has) coreTx.update('staff', st.id, { serviceIds: st.serviceIds.filter((x) => x !== serviceId) });
    });
  if (removed.length) {
    mutateArea('services', (s) => {
      s.staffTerms = s.staffTerms.filter((t) => !(t.serviceId === serviceId && removed.includes(t.staffId)));
    });
  }
  return coreTx.update('services', serviceId, { staffIds });
}

async function setServiceStaffIdsApi(serviceId: Id, businessId: Id, staffIds: Id[]): Promise<void> {
  const current = (await S.listServiceStaff(serviceId, businessId)).map((r) => r.staff.id);
  for (const id of staffIds.filter((x) => !current.includes(x))) await S.assignStaffToService(serviceId, id, businessId);
  for (const id of current.filter((x) => !staffIds.includes(x))) await S.removeStaffFromService(serviceId, id, businessId);
}

/** Мастера услуги из ячейки списка (галочки) */
export function setServiceStaffIds(serviceId: Id, businessId: Id, staffIds: Id[]): Promise<void> {
  if (isApiMode()) return setServiceStaffIdsApi(serviceId, businessId, staffIds);
  return request(() => {
    applyStaffIds(serviceId, staffIds);
    writeAudit(businessId, serviceId, 'staffChanged', undefined, { staffIds });
  }, { permission: 'services.edit' });
}

export interface SaveServiceFormArgs {
  /** нет — новая услуга */
  id?: Id;
  businessId: Id;
  sphereId: SphereId;
  input: ServiceInput;
  /** Мастера и их цены; нет — не трогать */
  staff?: ServiceStaffEntry[];
  extra?: ServiceExtra;
}

/** У24: окно формы услуги → окно движка слотов; выключено — undefined (ограничения нет) */
function toSlotWindow(serviceId: Id, w: ServiceOnlineWindow): ServiceSlotWindow | undefined {
  if (!w.enabled) return undefined;
  return {
    serviceId,
    from: w.dateFrom || undefined,
    to: w.dateTo || undefined,
    hoursFrom: (w.timeFrom || undefined) as ServiceSlotWindow['hoursFrom'],
    hoursTo: (w.timeTo || undefined) as ServiceSlotWindow['hoursTo'],
    days: 'any',
    weekdays: w.weekdays?.length ? w.weekdays : undefined,
  };
}

/** «Сохранить» формы услуги (У3): поля, мастера со своими ценами и доп. поля — одной операцией */
export function saveServiceForm(args: SaveServiceFormArgs): Promise<Service> {
  const { id, businessId, sphereId, input, staff, extra } = args;
  if (isApiMode()) {
    return (async () => {
      const saved = id ? await S.updateService(id, businessId, input) : await S.createService(businessId, sphereId, input);
      if (staff) {
        await setServiceStaffIdsApi(saved.id, businessId, staff.map((e) => e.staffId));
        for (const e of staff) await S.setStaffServiceTerm(saved.id, e.staffId, e.price, e.durationMin);
      }
      if (extra) await S.updateServiceExtra(saved.id, extra);
      if (extra?.onlineWindow) {
        // У24: окно «ограниченное время» формы услуги — то же, что читает движок слотов (онлайн и приложение клиента)
        const slots = await import('@/api/schedule/slots');
        const w = toSlotWindow(saved.id, extra.onlineWindow);
        await (w ? slots.setServiceSlotWindow(w) : slots.clearServiceSlotWindow(saved.id));
      }
      return saved;
    })();
  }
  return request(() => {
    const before = id ? coreTx.get('services', id) : undefined;
    const fields = {
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      kind: input.kind,
      capacity: input.kind === 'group' ? input.capacity : undefined,
      durationMin: input.durationMin,
      durationMax: input.durationMax,
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      bufferAfterMin: techBreakToBuffer(input.techBreak, input.techBreakMin),
      repeatIntervalDays: input.repeatIntervalDays,
      photos: input.photos,
      onlineBookable: input.onlineBookable,
      shadeChoice: input.shadeChoice,
    };
    let service = id
      ? coreTx.update('services', id, fields)
      : coreTx.create('services', {
          ...fields,
          businessId,
          sphereId,
          materials: [],
          staffIds: [],
          workplaces: [],
          active: true,
          order: coreTx.list('services', (s) => s.businessId === businessId).length,
        } as Omit<Service, 'id'>);
    if (staff) {
      service = applyStaffIds(service.id, staff.map((e) => e.staffId));
      const sid = service.id;
      mutateArea('services', (s) => {
        s.staffTerms = s.staffTerms.filter((t) => t.serviceId !== sid);
        staff
          .filter((e) => e.price != null || e.durationMin != null)
          .forEach((e) => s.staffTerms.push({ serviceId: sid, staffId: e.staffId, price: e.price, durationMin: e.durationMin }));
      });
    }
    if (extra) {
      const sid = service.id;
      mutateArea('services', (s) => {
        s.serviceExtra[sid] = { ...s.serviceExtra[sid], ...extra };
      });
      if (extra.onlineWindow) {
        // У24 (28.09): окно формы услуги пишем туда, где его читает движок слотов (schedule.serviceSlotWindows) —
        // онлайн-запись и приложение клиента строят окна через computeFreeSlots
        const w = toSlotWindow(sid, extra.onlineWindow);
        mutateArea('schedule', (d) => {
          if (w) d.serviceSlotWindows[sid] = w;
          else delete d.serviceSlotWindows[sid];
        });
      }
    }
    writeAudit(businessId, service.id, id ? 'updated' : 'created', before, service);
    return service;
  }, { permission: 'services.edit' });
}

/** Переименовать категорию из строки списка (У1) */
export function renameCategory(id: Id, businessId: Id, name: LocalizedText): Promise<ServiceCategory> {
  if (isApiMode()) {
    return (async () => {
      const online = await S.categoryOnlineName(id);
      return S.updateCategory(id, businessId, { name, onlineNameEnabled: online.onlineNameEnabled, onlineName: online.onlineName });
    })();
  }
  return request(() => {
    const category = coreTx.update('serviceCategories', id, { name });
    writeAudit(businessId, id, 'renamed', undefined, { name });
    return category;
  }, { permission: 'services.edit' });
}

export interface CategorySnapshot {
  category: ServiceCategory;
  services: Service[];
}

/** Удалить категорию вместе с её услугами — снимок для «Отменить» 5 с */
export function deleteCategoryWithServices(id: Id, businessId: Id): Promise<CategorySnapshot> {
  if (isApiMode()) {
    return (async () => {
      const category = await S.getCategory(id);
      const services = (await S.listServices(businessId)).filter((s) => s.categoryId === id);
      for (const s of services) await S.deleteService(s.id, businessId);
      await S.deleteCategory(id, businessId);
      return { category, services };
    })();
  }
  return request(() => {
    const category = coreTx.get('serviceCategories', id);
    const services = coreTx.list('services', (s) => s.categoryId === id);
    const ids = services.map((s) => s.id);
    readCore()
      .staff.filter((st) => st.serviceIds.some((x) => ids.includes(x)))
      .forEach((st) => coreTx.update('staff', st.id, { serviceIds: st.serviceIds.filter((x) => !ids.includes(x)) }));
    ids.forEach((sid) => coreTx.remove('services', sid));
    coreTx.remove('serviceCategories', id);
    writeAudit(businessId, id, 'deleted', category, undefined);
    return { category, services };
  }, { permission: 'services.edit' });
}

export function restoreCategory(snapshot: CategorySnapshot): Promise<void> {
  if (isApiMode()) {
    return (async () => {
      const cat = await S.createCategory(snapshot.category.businessId, { name: snapshot.category.name, onlineNameEnabled: false });
      for (const s of snapshot.services) await S.restoreService({ ...s, categoryId: cat.id });
    })();
  }
  return request(() => {
    coreTx.create('serviceCategories', snapshot.category);
    snapshot.services.forEach((s) => {
      coreTx.create('services', s);
      s.staffIds.forEach((staffId) => {
        const st = readCore().staff.find((x) => x.id === staffId);
        if (st && !st.serviceIds.includes(s.id)) coreTx.update('staff', staffId, { serviceIds: [...st.serviceIds, s.id] });
      });
    });
  }, { permission: 'services.edit' });
}

// ─────────────────────────── Прайс из Excel (У11): категория, название, цена от–до, длительность ───────────────────────────

export const CATALOG_IMPORT_LIMIT = 500;

export interface CatalogImportResult {
  created: number;
  categoriesCreated: number;
}

export function importCatalog(businessId: Id, sphereId: SphereId, rows: CatalogImportRow[]): Promise<CatalogImportResult> {
  if (rows.length > CATALOG_IMPORT_LIMIT) return Promise.reject(new ApiError('validation', 'too many rows'));
  if (isApiMode()) {
    return (async () => {
      const categories = await listCategories(businessId);
      let categoriesCreated = 0;
      for (const row of rows) {
        let cat = categories.find((c) => c.name.ru.trim().toLowerCase() === row.category.trim().toLowerCase());
        if (!cat) {
          cat = await createCategory(businessId, { name: { ru: row.category.trim() }, onlineNameEnabled: false });
          categories.push(cat);
          categoriesCreated += 1;
        }
        await createService(businessId, sphereId, {
          categoryId: cat.id,
          name: { ru: row.name.trim() },
          kind: 'individual',
          durationMin: row.durationMin,
          priceMin: row.priceMin,
          priceMax: row.priceMax,
          techBreak: 'shared',
          photos: [],
          onlineBookable: true,
        });
      }
      return { created: rows.length, categoriesCreated };
    })();
  }
  return request(() => {
    const categories = coreTx.list('serviceCategories', (c) => c.businessId === businessId);
    let categoriesCreated = 0;
    let order = coreTx.list('services', (s) => s.businessId === businessId).length;
    rows.forEach((row) => {
      let cat = categories.find((c) => c.name.ru.trim().toLowerCase() === row.category.trim().toLowerCase());
      if (!cat) {
        cat = coreTx.create('serviceCategories', { businessId, name: { ru: row.category.trim() }, order: categories.length });
        categories.push(cat);
        categoriesCreated += 1;
      }
      coreTx.create('services', {
        businessId,
        categoryId: cat.id,
        sphereId,
        name: { ru: row.name.trim() },
        kind: 'individual',
        durationMin: row.durationMin,
        priceMin: row.priceMin,
        priceMax: row.priceMax,
        photos: [],
        materials: [],
        staffIds: [],
        workplaces: [],
        onlineBookable: true,
        active: true,
        order: order++,
      } as Omit<Service, 'id'>);
    });
    coreTx.logDataOperation({ businessId, kind: 'import', area: 'services', entity: 'services', count: rows.length });
    return { created: rows.length, categoriesCreated };
  }, { permission: 'services.edit' });
}

// ─────────────────────────── Что есть у мастера: фото, документы, материалы (У28) ───────────────────────────

export interface StaffContentCounts {
  photos: number;
  documents: number;
  materials: number;
}

export function listStaffContentCounts(businessId: Id): Promise<Record<Id, StaffContentCounts>> {
  if (isApiMode()) return S.listStaffContentCounts(businessId);
  return request(() => {
    const docs = readArea('services').documents;
    const out: Record<Id, StaffContentCounts> = {};
    readCore()
      .staff.filter((s) => s.businessId === businessId && s.status !== 'fired')
      .forEach((s) => {
        out[s.id] = { photos: s.photos.length, documents: docs.filter((d) => d.staffId === s.id).length, materials: s.materials.length };
      });
    return out;
  });
}

// ─────────────────────────── Внутреннее ───────────────────────────

function readModerationSnapshot(): { refId: Id; status: 'pending' | 'approved' | 'rejected' | 'auto' }[] {
  return readArea('platform').moderationItems;
}

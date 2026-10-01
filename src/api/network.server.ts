'use client';

/**
 * «Сеть» на настоящем сервере (docs/backend/PLAN.md этап 15, `02-api.md` §15). Устройство сети и филиалов
 * (создание/переименование/добавление-вывод/удаление) уже идёт через ядро — этап 3 (`ensureNetwork`,
 * `createNetwork` и соседи в `network.ts` сами зовут `http()`). Этот файл добавляет то, что заведено этапом 15:
 * поля записи/клиента сети (F-11-126…134) и срок «потерянного клиента» сети (F-11-072) — оба контракта совпадают
 * с моком буквально, поэтому переключены на сервер здесь.
 *
 * Пользователи сети (F-11-024…036, этап 21 «network+reports» попытка 2) — закрыты ниже: владелец решил
 * переиспользовать вход логином+паролем StaffLogin (businessId=null/staffId=null), а не заводить телефон+код.
 *
 * НЕ покрыто (сервер построен и проверен curl'ом — `booktime-backend/docs/PROGRESS.md` §15 «Не строил (фронт)»,
 * фасад остаётся на моке): общая база клиентов
 * (мок — десяток тонких фильтров, сервер — поиск+пагинация), рассылки, аналитика/планы, сетевые услуги/товары/
 * должности (сервер группирует услуги/товары по ИМЕНИ, ключ — не тот `id`, что уже держат экраны). Прямые
 * эндпоинты уже есть (`/v1/net/{id}/users`, `/clients/search`, `/broadcasts`, `/reports/summary`, `/plans`,
 * `/service-categories`, `/services`, `/goods…`, `/positions`, `/staff`) — переключение экрана на них требует
 * либо переписать сами экраны под новый контракт, либо расширить сервер под мок; отдельный проход.
 */
import { HttpApiError, http } from '@/api/http';
import { ApiError } from '@/api/request';
import { bizOf as bizOfStaff, addStaff, patchStaff, dismiss as dismissStaff, restore as restoreStaff, remove as removeStaffForever, undelete as undeleteStaff } from '@/api/staff.server';
import { bizOfService } from '@/api/services.server';
import { today } from '@/lib/date';
import type {
  CreateNetworkUserInput,
  NetworkAnalyticsBreakdown,
  NetworkAnalyticsSummary,
  NetworkBranchDailyStat,
  NetworkCategoryRow,
  NetworkClientCard,
  NetworkClientFilters,
  NetworkClientRow,
  NetworkClientVisit,
  NetworkDailyDetailRow,
  NetworkFinanceRow,
  NetworkGoodsArchiveRow,
  NetworkFieldInput,
  NetworkGoodsProductRow,
  NetworkGoodsStockRow,
  NetworkHrReportFilters,
  NetworkHrReportRow,
  NetworkLocationDetailRow,
  NetworkLocationRow,
  NetworkParamMetric,
  NetworkPackageRow,
  NetworkParamSeriesRow,
  NetworkPositionInput,
  NetworkRecordFilters,
  NetworkServiceCategoryDetail,
  NetworkServiceDetail,
  NetworkServiceFormInput,
  NetworkServiceReportRow,
  NetworkServiceSaveRow,
  NetworkStaffDetail,
  NetworkStaffFilters,
  NetworkStaffFormInput,
  NetworkStaffReportRow,
  NetworkUserPricingInfo,
  ServiceCardNetworkInfo,
  ServiceMigrationRow,
  StaffCardNetworkInfo,
} from '@/api/network';
import type { Good } from '@/domain/stock';
import type { Booking, Id, ISODate, LocalizedText, Network, Service, Staff } from '@/domain/core';
import type {
  NetworkAnalyticsSettings,
  NetworkAuditEntry,
  NetworkField,
  NetworkFieldKind,
  NetworkGoodsCategory,
  NetworkOffDayType,
  NetworkPayrollRun,
  NetworkPermissionKey,
  NetworkPosition,
  NetworkSubdivision,
  NetworkBroadcastLogEntry,
  NetworkCallRecord,
  NetworkExportLogEntry,
  NetworkPlanCell,
  NetworkPlanKind,
  NetworkTelephony,
  NetworkTelephonyRoute,
  NetworkTelephonyRule,
  NetworkUser,
} from '@/domain/network';
import type { LogMessage } from '@/domain/notify';
import type { PlanEmailSchedule } from '@/domain/reports';

const n = (networkId: Id) => `/v1/net/${networkId}`;
const bizNet = (businessId: Id) => `/v1/biz/${businessId}/network`;

/** Этап 21 «network+reports»: сеть ЭТОГО бизнеса, если есть (0 или 1 — Business.networkId один) */
export function listMyNetworks(businessId: Id): Promise<Network[]> {
  return http('GET', `${bizNet(businessId)}/mine`);
}

export function getNetwork(networkId: Id): Promise<Network> {
  return http('GET', n(networkId));
}

/** F-11-082: id услуг ЭТОГО бизнеса, цена которых заблокирована сетью — экран «Услуги» филиала */
export function listPriceLockedServiceIds(businessId: Id): Promise<Id[]> {
  return http('GET', `${bizNet(businessId)}/service-price-locks`);
}

export function listNetworkFields(networkId: Id, kind?: NetworkFieldKind): Promise<NetworkField[]> {
  return http<NetworkField[]>('GET', `${n(networkId)}/fields`, undefined, { query: kind ? { kind } : undefined });
}

export function saveNetworkField(networkId: Id, input: NetworkFieldInput, id?: Id): Promise<NetworkField> {
  return id ? http<NetworkField>('PATCH', `${n(networkId)}/fields/${id}`, input) : http<NetworkField>('POST', `${n(networkId)}/fields`, input);
}

export function deleteNetworkField(networkId: Id, id: Id): Promise<void> {
  return http<void>('DELETE', `${n(networkId)}/fields/${id}`);
}

export function getNetworkAnalyticsSettings(networkId: Id): Promise<NetworkAnalyticsSettings> {
  return http<NetworkAnalyticsSettings>('GET', `${n(networkId)}/analytics/settings`);
}

export function setNetworkLostClientDays(networkId: Id, days: number): Promise<void> {
  return http<NetworkAnalyticsSettings>('PATCH', `${n(networkId)}/analytics/settings`, { days }).then(() => undefined);
}

/**
 * Этап 21 «network+reports», заход 2: остаток каталога сети, для которого прямой эндпоинт УЖЕ есть
 * (`network-catalog.controller.ts`) и контракт совпадает 1:1 или composable без нового бэкенда. Кластеры,
 * требующие новую модель данных (пользователи сети — другой вход, товарный архив, сетевые должности
 * F-11-104…106 с requirements/servicesMode) — см. `booktime-backend/docs/PROGRESS.md`, не здесь.
 */

/** F-11-097: сотрудники сети — фильтры применяются на сервере (см. `NetworkCatalogService.listStaff`) */
export function listNetworkStaff(networkId: Id, filters: NetworkStaffFilters = {}): Promise<Staff[]> {
  return http<Staff[]>('GET', `${n(networkId)}/staff`, undefined, {
    query: { status: filters.status, fired: filters.fired, positionId: filters.positionId },
  });
}

/** F-11-097: список должностей — те же, что фактически носят сотрудники сети (нет своего справочника здесь) */
export async function listNetworkPositions(networkId: Id): Promise<string[]> {
  const staff = await listNetworkStaff(networkId, { status: 'all', fired: 'all' });
  const set = new Set<string>();
  for (const s of staff) {
    const ru = s.position?.ru;
    if (ru) set.add(ru);
  }
  return Array.from(set);
}

/** F-11-100: порядок сотрудников сети — своя таблица `NetworkStaffOrder` */
export function getNetworkStaffOrder(networkId: Id): Promise<string[]> {
  return http<string[]>('GET', `${n(networkId)}/staff-order`);
}

export function reorderNetworkStaffOrder(networkId: Id, orderedKeys: string[]): Promise<void> {
  return http('PUT', `${n(networkId)}/staff-order`, { orderedKeys }).then(() => undefined);
}

/**
 * F-11-088/091: «Добавить в филиалы» — мок копирует услугу ТОЛЬКО в отмеченные, не удаляя её из остальных.
 * Сервер завёл `services/:key/sync` для F-11-090 «Синхронизировать» (состав становится РОВНО businessIds,
 * удаляет отсутствующие) — вызываем его с businessIds = уже существующие ∪ новые, тогда удалений не будет.
 */
export async function addServiceToLocations(networkId: Id, key: string, targetBusinessIds: Id[]): Promise<void> {
  if (!targetBusinessIds.length) throw new ApiError('validation', 'no locations');
  const current = await http<{ businessIds: Id[] }>('GET', `${n(networkId)}/services/${encodeURIComponent(key)}`);
  const merged = Array.from(new Set([...current.businessIds, ...targetBusinessIds]));
  await http('POST', `${n(networkId)}/services/${encodeURIComponent(key)}/sync`, { businessIds: merged });
}

// ─────────────────────────── Товары сети (F-11-111…118) ───────────────────────────

export function listNetworkGoodsCategories(networkId: Id): Promise<NetworkGoodsCategory[]> {
  return http<NetworkGoodsCategory[]>('GET', `${n(networkId)}/goods-categories`);
}

export function getNetworkGoodsCategoryDetail(
  networkId: Id,
  id: Id,
): Promise<(NetworkGoodsCategory & { businessIds: Id[] }) | undefined> {
  return http<NetworkGoodsCategory & { businessIds: Id[] }>('GET', `${n(networkId)}/goods-categories/${id}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function saveNetworkGoodsCategory(
  networkId: Id,
  input: { id?: Id; name: string; parentId?: Id; businessIds: Id[] },
): Promise<NetworkGoodsCategory> {
  return http<NetworkGoodsCategory>('POST', `${n(networkId)}/goods-categories`, input);
}

export function getNetworkGoodsProduct(
  networkId: Id,
  groupId: Id,
): Promise<{ key: Id; good: Good; businessIds: Id[] } | undefined> {
  return http<{ key: Id; good: Good; businessIds: Id[] }>('GET', `${n(networkId)}/goods/${groupId}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function migrateGoodsToNetwork(networkId: Id, fromBusinessId: Id, goodIds: Id[] | 'all'): Promise<{ moved: number }> {
  return http<{ moved: number }>('POST', `${n(networkId)}/goods/migrate`, { fromBusinessId, goodIds });
}

// ─────────────────────────── Подразделения (F-11-080) ───────────────────────────

export function listNetworkSubdivisions(networkId: Id): Promise<NetworkSubdivision[]> {
  return http<NetworkSubdivision[]>('GET', `${n(networkId)}/subdivisions`);
}

export function createNetworkSubdivision(networkId: Id, name: string): Promise<NetworkSubdivision> {
  return http<NetworkSubdivision>('POST', `${n(networkId)}/subdivisions`, { name });
}

// ─────────────────────────── Типы нерабочих дней сети (F-11-108) ───────────────────────────

export function listNetworkOffDayTypes(networkId: Id): Promise<NetworkOffDayType[]> {
  return http<NetworkOffDayType[]>('GET', `${n(networkId)}/off-day-types`);
}

export function saveNetworkOffDayType(
  networkId: Id,
  input: { name: string; comment?: string; colorIndex: number; businessIds: Id[] },
  id?: Id,
): Promise<NetworkOffDayType> {
  return id
    ? http<NetworkOffDayType>('PATCH', `${n(networkId)}/off-day-types/${id}`, input)
    : http<NetworkOffDayType>('POST', `${n(networkId)}/off-day-types`, input);
}

export function deleteNetworkOffDayType(networkId: Id, id: Id): Promise<void> {
  return http('DELETE', `${n(networkId)}/off-day-types/${id}`).then(() => undefined);
}

// ─────────────────────── Пользователи сети (F-11-024…036), этап 21 «network+reports» попытка 2 ───────────────────────
// Решение владельца (PROGRESS.md, functional-map 28.09): вход логином+паролем переиспользует модель StaffLogin
// (businessId=null/staffId=null — та же, что у администратора без телефона), а не телефон+код — сервер этапа 21
// заводит `NetworkUser.staffLoginId`+`User` без телефона (`network-users.controller.ts::addWithPassword`) и логин
// проходит через уже существующий общий `POST /v1/auth/password` (никакой новой авторизации не строили).
// `businessIds` (доступ по филиалам, «Сеть7») сервер хранит (01.10.2026): нет поля — все филиалы. Сотрудник филиала
// вне списка пользователя сеть не видит (`NetworkAccessService.inAllowedBranch`, `my-access`).

export function listNetworkUsers(networkId: Id): Promise<NetworkUser[]> {
  return http('GET', `${n(networkId)}/users`);
}

/** мок `searchNetworkGoods` — построчный поиск товаров сети по имени/SKU/штрихкоду (не группа по имени) */
export function searchNetworkGoods(networkId: Id, query: string): Promise<Good[]> {
  return http('GET', `${n(networkId)}/goods/search`, undefined, { query: { q: query } });
}

export function getNetworkUserPricing(networkId: Id): Promise<NetworkUserPricingInfo> {
  return http('GET', `${n(networkId)}/users/pricing`);
}

export function inviteNetworkUser(networkId: Id, phone: string): Promise<NetworkUser> {
  return http('POST', `${n(networkId)}/users/invite-by-phone`, { phone });
}

export function createNetworkUser(networkId: Id, input: CreateNetworkUserInput): Promise<NetworkUser> {
  return http('POST', `${n(networkId)}/users/password`, input);
}

export function updateNetworkUser(networkId: Id, id: Id, patch: { name: string; phone?: string; email?: string }): Promise<NetworkUser> {
  return http('PATCH', `${n(networkId)}/users/${id}`, patch);
}

export function removeNetworkUser(networkId: Id, id: Id): Promise<void> {
  return http('DELETE', `${n(networkId)}/users/${id}`).then(() => undefined);
}

/** `businessIds`: нет — не менять; все филиалы сети сервер сам хранит как «без ограничения» */
export function setNetworkUserPermissions(networkId: Id, id: Id, permissions: NetworkPermissionKey[], businessIds?: Id[]): Promise<NetworkUser> {
  return http('PATCH', `${n(networkId)}/users/${id}/permissions`, { permissions, ...(businessIds ? { businessIds } : {}) });
}

/** Мои права в сети этого филиала (меню и экраны кабинета сети, «Данные сети» в окне записи) */
export function getMyNetworkAccess(businessId: Id): Promise<{ networkId?: Id; member: boolean; permissions: NetworkPermissionKey[]; businessIds?: Id[] }> {
  return http('GET', `${bizNet(businessId)}/my-access`);
}

// ─────────── Этап 21 «network+reports», попытка 3 ───────────

/** F-11-016/017: список «Локации» настроек сети, в сохранённом порядке — своя таблица `NetworkLocationOrder` */
export function listNetworkLocations(networkId: Id): Promise<NetworkLocationRow[]> {
  return http<NetworkLocationRow[]>('GET', `${n(networkId)}/locations`);
}

export function reorderNetworkLocations(networkId: Id, orderedBusinessIds: Id[]): Promise<void> {
  return http('PUT', `${n(networkId)}/locations/order`, { orderedIds: orderedBusinessIds }).then(() => undefined);
}

/** F-11-075: записи сети, построчно (мок `listNetworkRecords`) */
export function listNetworkRecords(networkId: Id, filters: NetworkRecordFilters = {}): Promise<Booking[]> {
  return http<Booking[]>('GET', `${n(networkId)}/records`, undefined, {
    query: { businessId: filters.businessId, onlineOnly: filters.onlineOnly, cancelled: filters.cancelled, from: filters.from, to: filters.to },
  });
}

/** F-11-062/063: сводка сети с дельтами к прошлому периоду (мок `getNetworkAnalyticsSummary`) */
export function getNetworkAnalyticsSummary(networkId: Id, from: ISODate, to: ISODate): Promise<NetworkAnalyticsSummary> {
  return http<NetworkAnalyticsSummary>('GET', `${n(networkId)}/analytics/summary-v2`, undefined, { query: { from, to } });
}

/** F-11-064…073: клиенты новые/вернувшиеся/потерянные, разбивка записей (мок `getNetworkAnalyticsBreakdown`) */
export function getNetworkAnalyticsBreakdown(networkId: Id, from: ISODate, to: ISODate): Promise<NetworkAnalyticsBreakdown> {
  return http<NetworkAnalyticsBreakdown>('GET', `${n(networkId)}/analytics/breakdown`, undefined, { query: { from, to } });
}

/** F-11-087: таблица «Услуга / Доступно в локациях» (мок `listServiceMigrationRows`) */
export function listServiceMigrationRows(networkId: Id): Promise<ServiceMigrationRow[]> {
  return http<ServiceMigrationRow[]>('GET', `${n(networkId)}/service-migration`);
}

/** F-11-102: «Перенести всех»/одного мастера из филиала в сеть (мок `migrateStaffToNetwork`) */
export function migrateStaffToNetwork(networkId: Id, fromBusinessId: Id, staffIds: Id[] | 'all'): Promise<{ moved: number }> {
  return http('POST', `${n(networkId)}/staff/migrate`, { fromBusinessId, staffIds });
}

/** F-11-103: объединить дубли сотрудников сети (мок `mergeNetworkStaff`) */
export function mergeNetworkStaff(networkId: Id, keys: string[], primaryKey: string): Promise<{ key: string }> {
  return http('POST', `${n(networkId)}/staff/merge`, { keys, primaryKey });
}

/** F-11-104…106: сетевые должности, полная форма — своя таблица `NetworkPositionDef`, не `Position.networkId` */
export function listNetworkPositionEntities(networkId: Id): Promise<NetworkPosition[]> {
  return http<NetworkPosition[]>('GET', `${n(networkId)}/position-defs`);
}

export function saveNetworkPosition(networkId: Id, input: NetworkPositionInput, positionId?: Id): Promise<NetworkPosition> {
  return positionId
    ? http<NetworkPosition>('PATCH', `${n(networkId)}/position-defs/${positionId}`, input)
    : http<NetworkPosition>('POST', `${n(networkId)}/position-defs`, input);
}

export function deleteNetworkPosition(networkId: Id, positionId: Id): Promise<void> {
  return http('DELETE', `${n(networkId)}/position-defs/${positionId}`).then(() => undefined);
}

// ─────────────────────── Архив товаров сети (F-11-114/117/118) ───────────────────────

export function addAllGoodsToLocation(networkId: Id, targetBusinessId: Id): Promise<{ added: number }> {
  return http('POST', `${n(networkId)}/goods/add-all-to-location`, { targetBusinessId });
}

export function archiveNetworkGoods(networkId: Id, groupIds: Id[]): Promise<void> {
  return http('POST', `${n(networkId)}/goods/archive`, { groupIds }).then(() => undefined);
}

export function listNetworkGoodsArchive(networkId: Id): Promise<NetworkGoodsArchiveRow[]> {
  return http<NetworkGoodsArchiveRow[]>('GET', `${n(networkId)}/goods/archive`);
}

export function restoreNetworkGoods(networkId: Id, name: string): Promise<void> {
  return http('POST', `${n(networkId)}/goods/archive/restore`, { name }).then(() => undefined);
}

export function deleteNetworkGoodsArchiveEntry(networkId: Id, id: Id): Promise<void> {
  return http('DELETE', `${n(networkId)}/goods/archive/${id}`).then(() => undefined);
}

export function mergeGoodIntoNetworkGroup(networkId: Id, localGoodId: Id, networkGroupId: Id): Promise<void> {
  return http('POST', `${n(networkId)}/goods/merge`, { localGoodId, networkGroupId }).then(() => undefined);
}

// ─────────── этап 21 (сдача, попытка 4): планы, письмо плана, телефония (NetworkSetting) ───────────

export function listNetworkPlans(networkId: Id): Promise<NetworkPlanCell[]> {
  return http<Omit<NetworkPlanCell, 'networkId'>[]>('GET', `${n(networkId)}/plans`).then((rows) => rows.map((r) => ({ ...r, networkId })));
}

export function setNetworkPlanCell(input: NetworkPlanCell): Promise<void> {
  const { networkId, ...body } = input;
  return http('POST', `${n(networkId)}/plans`, body).then(() => undefined);
}

export function getPlanEmailSchedule(networkId: Id): Promise<PlanEmailSchedule> {
  return http<{ schedule: PlanEmailSchedule }>('GET', `${n(networkId)}/plan-email-schedule`).then((r) => r.schedule);
}

export function setPlanEmailSchedule(networkId: Id, schedule: PlanEmailSchedule): Promise<PlanEmailSchedule> {
  return http<{ schedule: PlanEmailSchedule }>('PUT', `${n(networkId)}/plan-email-schedule`, { schedule }).then((r) => r.schedule);
}

export function getNetworkTelephony(networkId: Id): Promise<NetworkTelephony> {
  return http<NetworkTelephony>('GET', `${n(networkId)}/telephony`);
}

export function connectNetworkTelephony(networkId: Id): Promise<void> {
  return http('POST', `${n(networkId)}/telephony/connect`).then(() => undefined);
}

export function listNetworkTelephonyRoutes(networkId: Id): Promise<NetworkTelephonyRoute[]> {
  return http<NetworkTelephonyRoute[]>('GET', `${n(networkId)}/telephony/routes`);
}

export function saveNetworkTelephonyRoute(
  networkId: Id,
  input: { name: string; userIds: Id[]; businessIds: Id[]; historyStorage: NetworkTelephonyRoute['historyStorage'] },
  id?: Id,
): Promise<NetworkTelephonyRoute> {
  return id
    ? http<NetworkTelephonyRoute>('PATCH', `${n(networkId)}/telephony/routes/${id}`, input)
    : http<NetworkTelephonyRoute>('POST', `${n(networkId)}/telephony/routes`, input);
}

export function listNetworkTelephonyRules(networkId: Id): Promise<NetworkTelephonyRule[]> {
  return http<NetworkTelephonyRule[]>('GET', `${n(networkId)}/telephony/rules`);
}

export function saveNetworkTelephonyRule(networkId: Id, input: { kind: 'phone' | 'sip'; identifier: string; routeId: Id }): Promise<NetworkTelephonyRule> {
  return http<NetworkTelephonyRule>('POST', `${n(networkId)}/telephony/rules`, input);
}

export function deleteNetworkTelephonyRule(networkId: Id, id: Id): Promise<void> {
  return http('DELETE', `${n(networkId)}/telephony/rules/${id}`).then(() => undefined);
}

/** Р19: чужая АТС, обмена нет — сервер звонков не знает (пустой список) */
export function listNetworkCalls(networkId: Id): Promise<NetworkCallRecord[]> {
  return http<NetworkCallRecord[]>('GET', `${n(networkId)}/telephony/calls`);
}

// ─────────── этап 21 (сдача, попытка 4): общая база клиентов сети ───────────

export function listNetworkClients(networkId: Id, filters: NetworkClientFilters): Promise<NetworkClientRow[]> {
  return http<NetworkClientRow[]>('POST', `${n(networkId)}/clients/list`, filters);
}

export function getNetworkClientCard(networkId: Id, phone: string): Promise<NetworkClientCard> {
  return http<NetworkClientCard>('GET', `${n(networkId)}/clients/${encodeURIComponent(phone)}/view`);
}

export function getNetworkClientHistory(networkId: Id, phone: string): Promise<NetworkClientVisit[]> {
  return http<NetworkClientVisit[]>('GET', `${n(networkId)}/clients/${encodeURIComponent(phone)}/history`);
}

// ─────────── этап 21 (сдача, попытка 4): рассылки сети ───────────

interface ServerSmsStatus {
  connected: boolean;
  mainBusinessName: string;
  balance: number;
}

export function getNetworkSmsStatus(networkId: Id): Promise<ServerSmsStatus> {
  return http<ServerSmsStatus>('GET', `${n(networkId)}/sms-status`);
}

export function listNetworkBroadcastLog(networkId: Id): Promise<NetworkBroadcastLogEntry[]> {
  return http<NetworkBroadcastLogEntry[]>('GET', `${n(networkId)}/broadcasts`);
}

export function sendNetworkBroadcast(input: { networkId: Id; channel: 'sms' | 'push'; scope: 'selected' | 'found'; phones: string[]; text: string }): Promise<NetworkBroadcastLogEntry> {
  const { networkId, ...body } = input;
  return http<NetworkBroadcastLogEntry>('POST', `${n(networkId)}/broadcasts`, body);
}

export function getNetworkPlanExecution(networkId: Id, month: string, kind: NetworkPlanKind): Promise<Array<{ businessId: Id; value: number; actual: number }>> {
  return http<Array<{ businessId: Id; value: number; actual: number }>>('GET', `${n(networkId)}/plans/execution`, undefined, { query: { month, kind } });
}

export function requestLocationDeletion(networkId: Id, businessId: Id): Promise<void> {
  return http('POST', `${n(networkId)}/location-deletions/${businessId}`).then(() => undefined);
}

export function listLocationDeletionRequests(networkId: Id): Promise<Record<Id, string>> {
  return http<Record<Id, string>>('GET', `${n(networkId)}/location-deletions`);
}

export function listNetworkExportLog(networkId: Id): Promise<NetworkExportLogEntry[]> {
  return http<NetworkExportLogEntry[]>('GET', `${n(networkId)}/exports`);
}

export function exportNetworkClients(input: { networkId: Id; scope: 'found' | 'all'; count: number; authorName: string; kind?: 'clients' | 'records' | 'staff' }): Promise<NetworkExportLogEntry> {
  const { networkId, ...body } = input;
  return http<NetworkExportLogEntry>('POST', `${n(networkId)}/exports`, body);
}

// ─────────── этап 21 (лейн network): журнал изменений, сообщения клиенту, согласие на рекламу ───────────

export function listNetworkAuditLog(networkId: Id): Promise<NetworkAuditEntry[]> {
  return http<NetworkAuditEntry[]>('GET', `${n(networkId)}/audit-log`);
}

export function getNetworkClientMessages(networkId: Id, phone: string): Promise<Array<{ businessId: Id; businessName: string; message: LogMessage }>> {
  return http<Array<{ businessId: Id; businessName: string; message: LogMessage }>>('GET', `${n(networkId)}/clients/${encodeURIComponent(phone)}/messages`);
}

export function listNetworkMarketingOptOut(networkId: Id): Promise<string[]> {
  return http<string[]>('GET', `${n(networkId)}/marketing-opt-out`);
}

/** Фасад (`src/api/network.ts::setNetworkMarketingOptOut`) не несёт networkId — маршрут ПО ФИЛИАЛУ действующего сотрудника */
export function setNetworkMarketingOptOut(businessId: Id, phone: string, optOut: boolean): Promise<void> {
  return http('PATCH', `/v1/biz/${businessId}/network/marketing-opt-out`, { phone, optOut }).then(() => undefined);
}

// ─────────── этап 21 (лейн network, попытка 2): 7 «глубоких» отчётов сети + статистика филиала за день ───────────

export function getNetworkLocationsDetail(networkId: Id, from: ISODate, to: ISODate, subdivisionId?: Id): Promise<NetworkLocationDetailRow[]> {
  return http<NetworkLocationDetailRow[]>('GET', `${n(networkId)}/reports/locations-detail`, undefined, { query: { from, to, subdivisionId } });
}

export function getNetworkDailyDetail(networkId: Id, from: ISODate, to: ISODate): Promise<NetworkDailyDetailRow[]> {
  return http<NetworkDailyDetailRow[]>('GET', `${n(networkId)}/reports/daily-detail`, undefined, { query: { from, to } });
}

export function getNetworkParamSeries(
  networkId: Id,
  metric: NetworkParamMetric,
  groupBy: 'day' | 'month' | 'year',
  from: ISODate,
  to: ISODate,
): Promise<NetworkParamSeriesRow[]> {
  return http<NetworkParamSeriesRow[]>('GET', `${n(networkId)}/reports/param-series`, undefined, { query: { metric, groupBy, from, to } });
}

export function getNetworkServicesReport(networkId: Id, from: ISODate, to: ISODate, filters: { businessId?: Id; staffId?: Id } = {}): Promise<NetworkServiceReportRow[]> {
  return http<NetworkServiceReportRow[]>('GET', `${n(networkId)}/reports/services`, undefined, { query: { from, to, ...filters } });
}

export function getNetworkStaffReport(networkId: Id, from: ISODate, to: ISODate, businessId?: Id): Promise<NetworkStaffReportRow[]> {
  return http<NetworkStaffReportRow[]>('GET', `${n(networkId)}/reports/staff`, undefined, { query: { from, to, businessId } });
}

export function getNetworkHrReport(networkId: Id, filters: NetworkHrReportFilters = {}): Promise<NetworkHrReportRow[]> {
  return http<NetworkHrReportRow[]>('GET', `${n(networkId)}/reports/hr`, undefined, { query: { ...filters } });
}

export function getNetworkFinanceSummary(networkId: Id, from: ISODate, to: ISODate): Promise<NetworkFinanceRow[]> {
  return http<NetworkFinanceRow[]>('GET', `${n(networkId)}/reports/finance-summary`, undefined, { query: { from, to } });
}

/** Фасад (`src/api/network.ts::getNetworkBranchDailyStats`) не несёт businessId/networkId — маршрут ПО ФИЛИАЛУ
 * вызывающего сотрудника (первый businessId запроса), как `setNetworkMarketingOptOut` рядом (F-11-156). */
export function getNetworkBranchDailyStats(businessId: Id, businessIds: Id[], date: ISODate): Promise<NetworkBranchDailyStat[]> {
  return http<NetworkBranchDailyStat[]>('GET', `${bizNet(businessId)}/branch-daily-stats`, undefined, { query: { businessIds: businessIds.join(','), date } });
}

// ═══════════════════ Этап 21 «network», попытка 3 ═══════════════════
// Услуги/категории сети (F-11-079…093): `network-catalog.controller.ts` уже несёт service-categories/services
// один-в-один по контракту (попытка 1 лейна «network+reports» это отметила, но фасад не звал — см. PROGRESS.md
// «Этап 21 — Сдача, попытка 4», предупреждение «backend ГОРАЗДО готовее»); только превью/слияние были новыми.

export function listNetworkServiceCategories(networkId: Id): Promise<NetworkCategoryRow[]> {
  return http<NetworkCategoryRow[]>('GET', `${n(networkId)}/service-categories`);
}

export function getNetworkServiceCategory(networkId: Id, key: string): Promise<NetworkServiceCategoryDetail | undefined> {
  return http<NetworkServiceCategoryDetail>('GET', `${n(networkId)}/service-categories/${encodeURIComponent(key)}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function saveNetworkServiceCategory(
  networkId: Id,
  input: { key?: string; name: LocalizedText; onlineName?: LocalizedText; subdivisionId?: Id; businessIds: Id[] },
): Promise<{ key: string }> {
  return http<{ key: string }>('POST', `${n(networkId)}/service-categories`, input);
}

interface ServerNetworkServiceDetail {
  key: string;
  name: LocalizedText;
  description?: LocalizedText;
  priceMin: number;
  priceMax?: number;
  durationMin: number;
  capacity?: number;
  kind: 'individual' | 'group';
  businessIds: Id[];
  priceLocked: boolean;
  descriptionLocked: boolean;
  onlineName?: string;
}

/**
 * F-11-081: карточка сетевой услуги. Сервер не отдаёт `Service` целиком (ключ группирует НЕСКОЛЬКО настоящих
 * строк по имени — единого id нет), а `ServiceFormScreen` читает только name/description/kind/durationMin/
 * priceMin/priceMax/capacity — остальные поля `Service` (id/businessId/categoryId/…) экран отсюда не смотрит,
 * заполнены безопасными плейсхолдерами, чтобы собрать совместимый объект без второго контракта на фронте.
 */
export async function getNetworkService(networkId: Id, key: string): Promise<NetworkServiceDetail | undefined> {
  const row = await http<ServerNetworkServiceDetail>('GET', `${n(networkId)}/services/${encodeURIComponent(key)}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
  if (!row) return undefined;
  const service: Service = {
    id: row.key,
    businessId: row.businessIds[0] ?? '',
    categoryId: '',
    sphereId: 'general',
    name: row.name,
    description: row.description,
    kind: row.kind,
    durationMin: row.durationMin,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    capacity: row.capacity,
    photos: [],
    materials: [],
    staffIds: [],
    workplaces: ['salon'],
    onlineBookable: true,
    active: true,
    order: 0,
  };
  return { key: row.key, service, businessIds: row.businessIds, priceLocked: row.priceLocked, descriptionLocked: row.descriptionLocked, onlineName: row.onlineName };
}

export function saveNetworkService(networkId: Id, input: NetworkServiceFormInput): Promise<{ key: string }> {
  return http<{ key: string }>('POST', `${n(networkId)}/services`, input);
}

/** Сеть4: `previewNetworkServiceSave` — что сделает запись ДО сохранения, по каждому филиалу (F-11-081…083) */
export function previewNetworkServiceSave(
  networkId: Id,
  input: Pick<NetworkServiceFormInput, 'key' | 'categoryKey' | 'businessIds'>,
): Promise<NetworkServiceSaveRow[]> {
  return http<NetworkServiceSaveRow[]>('POST', `${n(networkId)}/services/preview`, input);
}

/** F-11-090: «Синхронизировать» — состав филиалов услуги становится РОВНО businessIds */
export function syncServiceToLocations(networkId: Id, key: string, businessIds: Id[]): Promise<{ removedFrom: Id[]; addedTo: Id[] }> {
  return http('POST', `${n(networkId)}/services/${encodeURIComponent(key)}/sync`, { businessIds });
}

/** F-11-089: «Удалить из филиалов» — сервер не несёт отдельный «только удалить» маршрут, переиспользуем `sync`
 * (F-11-090): целевой набор = текущий минус удаляемые, значит `sync` только удаляет, ничего не создаёт заново. */
export async function removeServiceFromLocations(networkId: Id, key: string, businessIds: Id[]): Promise<void> {
  const current = await http<{ businessIds: Id[] }>('GET', `${n(networkId)}/services/${encodeURIComponent(key)}`);
  const target = current.businessIds.filter((id) => !businessIds.includes(id));
  await http('POST', `${n(networkId)}/services/${encodeURIComponent(key)}/sync`, { businessIds: target });
}

/** F-11-093: «Объединить» — 2+ сетевые услуги (разные имена) сливаются в одну под новым именем */
export function mergeNetworkServices(networkId: Id, keys: string[], newName: LocalizedText): Promise<{ key: string }> {
  return http<{ key: string }>('POST', `${n(networkId)}/services/merge`, { keys, name: newName });
}

/** F-11-113: создать/дополнить сетевой товар — контракт совпадает 1:1 с телом `saveGoodsProduct` сервера */
export function saveNetworkGoodsProduct(
  networkId: Id,
  input: { groupId?: Id; name: string; categoryId: Id; salePrice: number; costPrice: number; comment?: string; businessIds: Id[] },
): Promise<NetworkGoodsProductRow> {
  return http<NetworkGoodsProductRow>('POST', `${n(networkId)}/goods`, input);
}

// ─────────────────────────── Сетевые сотрудники (F-11-097…101), этап 21 «network», попытка 3 ───────────────────────────
// Нет отдельной «сетевой» таблицы сотрудников — как и мок, группируем обычных `Staff` разных филиалов по имени
// и пишем через уже готовый `staff.server.ts` (тот же путь, что карточка сотрудника одного филиала).

function staffKeyOf(s: Pick<Staff, 'name' | 'id'>): string {
  return s.name.trim() || s.id;
}

export async function getNetworkStaffMember(networkId: Id, key: string): Promise<NetworkStaffDetail | undefined> {
  const rows = await listNetworkStaff(networkId, { status: 'all', fired: 'all' });
  const matching = rows.filter((s) => staffKeyOf(s) === key);
  if (!matching.length) return undefined;
  return { key, staff: matching[0]!, businessIds: matching.map((s) => s.businessId) };
}

/**
 * F-11-098/099: создание/правка сетевого сотрудника — по каждому отмеченному филиалу вызывает обычный
 * `staff.server.ts` (add/patch), тем же путём, что карточка одного сотрудника; филиал, где сотрудника с этим
 * именем реально держали и сняли галочку — «Удалить» (F-10-155, `remove`), как и мок (`coreRemove`, безвозвратно).
 * `position` в этой форме — `LocalizedText` (сетевая форма мока), у настоящего `Staff.position` — просто строка
 * названия должности; берём `.ru`, как остальной каталог сети берёт `name.ru` за ключ.
 */
export async function saveNetworkStaffMember(networkId: Id, input: NetworkStaffFormInput): Promise<{ key: string }> {
  const rows = await listNetworkStaff(networkId, { status: 'all', fired: 'all' });
  const existing = input.key ? rows.filter((s) => staffKeyOf(s) === input.key) : [];
  const existingByBusiness = new Map(existing.map((s) => [s.businessId, s]));
  const locations = await listNetworkLocations(networkId);
  let newKey = input.key ?? '';
  for (const businessId of input.businessIds) {
    const found = existingByBusiness.get(businessId);
    if (found) {
      const updated = await patchStaff(found.id, {
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        position: input.position?.ru ?? null,
        bio: input.bio ?? null,
      });
      newKey = staffKeyOf(updated);
    } else {
      const loc = locations.find((l) => l.business.id === businessId)?.location;
      const created = await addStaff({
        businessId,
        locationIds: loc ? [loc.id] : [],
        name: input.name,
        role: 'master',
        phone: input.phone,
        email: input.email,
        position: input.position?.ru,
        sphereIds: [],
      });
      newKey = staffKeyOf(created);
    }
  }
  for (const s of existing) {
    if (!input.businessIds.includes(s.businessId)) await removeStaffForever(s.id);
  }
  return { key: newKey };
}

/**
 * F-11-101: уволить/удалить/восстановить сетевого сотрудника во всех филиалах, где он есть — маршруты названы
 * по буквальному смыслу мока, каждый уже существует у `staff.server.ts` для одного филиала:
 * 'fire' → `dismiss` (F-10-040), 'delete' → `remove` (мягкое удаление, F-10-155), 'restore' → `undelete`
 * (снять мягкое удаление), 'reinstate' → `restore` сервера (вернуть уволенного; тот несёт правило «до 24 ч — сразу,
 * до 30 дней — нельзя», F-10-044 — мок этого правила не знал вовсе, сервер здесь строже намеренно).
 */
export async function setNetworkStaffLifecycle(networkId: Id, key: string, action: 'fire' | 'delete' | 'restore' | 'reinstate'): Promise<void> {
  const rows = await listNetworkStaff(networkId, { status: 'all', fired: 'all' });
  const matching = rows.filter((s) => staffKeyOf(s) === key);
  for (const s of matching) {
    if (action === 'fire') await dismissStaff(s.id, { date: today(), reason: '' });
    else if (action === 'delete') await removeStaffForever(s.id);
    else if (action === 'restore') await undeleteStaff(bizOfStaff(s.id), s.id);
    else await restoreStaff(s.id);
  }
}

// ─────────────────────────── b03fix1: network в serviceCard/staffCard, этап 21 «network», попытка 3 ───────────────────────────

/** F-11-082/083: «сетевой ли этот локальный сервис» — контекст ЭТОГО бизнеса (мок несёт только serviceId) */
export function getServiceNetworkInfo(serviceId: Id): Promise<ServiceCardNetworkInfo | undefined> {
  const businessId = bizOfService(serviceId);
  return http<ServiceCardNetworkInfo>(`GET`, `${bizNet(businessId)}/service-info/${serviceId}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

/** F-11-099: «сетевой ли этот локальный сотрудник» — контекст ЭТОГО бизнеса (мок несёт только staffId) */
export function getStaffNetworkInfo(staffId: Id): Promise<StaffCardNetworkInfo | undefined> {
  const businessId = bizOfStaff(staffId);
  return http<StaffCardNetworkInfo>(`GET`, `${bizNet(businessId)}/staff-info/${staffId}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

// ─────────────────────────── Зарплата сети (F-11-109), этап 21 «network», попытка 3 ───────────────────────────
// Сам расчёт/начисление уже идёт по-настоящему (фронт зовёт `finance.createSettlementSheet` в цикле по каждому
// сотруднику каждого выбранного филиала — та функция уже несёт ветку `isApiMode()`, docs/PROGRESS.md §21). Не
// хватало журнала запусков («Ведомости сети») — своя область `NetworkSetting`, без новой таблицы (как `exportLog`).

export function listNetworkPayrollRuns(networkId: Id): Promise<NetworkPayrollRun[]> {
  return http<NetworkPayrollRun[]>('GET', `${n(networkId)}/payroll-runs`);
}

export function addNetworkPayrollRun(
  networkId: Id,
  input: { from: ISODate; to: ISODate; businessIds: Id[]; staffCount: number; authorName: string },
): Promise<NetworkPayrollRun> {
  return http<NetworkPayrollRun>('POST', `${n(networkId)}/payroll-runs`, input);
}

// ─────────────── Этап 21 «Сдача» (28.09): пакеты сети, остатки товаров сети, перенос филиала, CSV услуг ───────────────

/** F-11-095: сетевые пакеты по имени — `GET /v1/net/{id}/packages` */
export function listNetworkPackages(networkId: Id): Promise<NetworkPackageRow[]> {
  return http<NetworkPackageRow[]>('GET', `${n(networkId)}/packages`);
}

/** F-11-095: пакет из 2–10 сетевых услуг в отмеченных филиалах */
export function createNetworkPackage(
  networkId: Id,
  input: { name: LocalizedText; itemKeys: string[]; mode: 'parallel' | 'sequentialSame' | 'sequentialAny'; businessIds: Id[] },
): Promise<{ key: string }> {
  return http<{ key: string }>('POST', `${n(networkId)}/packages`, input);
}

/** F-11-120: остатки сетевых товаров по филиалам одним запросом */
export function getNetworkGoodsStock(networkId: Id): Promise<NetworkGoodsStockRow[]> {
  return http<NetworkGoodsStockRow[]>('GET', `${n(networkId)}/goods-stock`);
}

/** F-11-009: услуги и товары филиала → другой филиал сети (сотрудников фасад копирует сам) */
export function copyBranchServicesAndGoods(
  networkId: Id,
  input: { fromBusinessId: Id; toBusinessId: Id; services: boolean; goods: boolean },
): Promise<{ servicesCopied: number; goodsCopied: number }> {
  return http<{ servicesCopied: number; goodsCopied: number }>('POST', `${n(networkId)}/copy-branch`, input);
}

/** F-11-010: импорт услуг из CSV в филиал — по кабинету филиала, не по панели сети */
export async function importBusinessServicesCsv(
  businessId: Id,
  rows: { name: string; category: string; price: number; duration: number }[],
): Promise<number> {
  const res = await http<{ created: number }>('POST', `${bizNet(businessId)}/services-csv-import`, { rows });
  return res.created;
}

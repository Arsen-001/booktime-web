'use client';

/**
 * «Склад» на настоящем сервере (docs/backend/PLAN.md этап 13, `02-api.md` §13). Покрывает склады, категории,
 * каталог товаров, приход/списание/перемещение/продажу, техкарты + автосписание визита (на сервере, без
 * фасада — см. `BookingsService.changeStatus` бэкенда), инвентаризацию (базовый цикл), оборудование, настройки
 * склада и «пора заказывать». НЕ покрывает (остаётся на моке — честная дыра этого этапа, см.
 * `booktime-backend/docs/PROGRESS.md` §13 «Не строил»): журнал операций построчно с «остатком после» —
 * `listOperations`/`OperationRow` (нужна дорогая историческая агрегация, которую сервер пока не строит),
 * покупки клиента (F-08-151), панель расходников визита (`getBookingConsumables*` — сервер списывает сам,
 * но не отдаёт предпросмотр), Excel/ценники/мелкие права раздела/сетевое копирование/поставщики-реклама,
 * `updateSaleOperation`, вспомогательные функции инвентаризации (`incrementInventoryActual` и т.п. — обходятся
 * через тот же `setLines`; `updateInventoryMeta` — свой PATCH `inventories/:id`, этап 21).
 */
import { http } from '@/api/http';
import { getBooking } from '@/api/journal.server';
import type { Id, Money } from '@/domain/core';
import {
  unitById,
  type Category,
  type CustomReminder,
  type EquipmentItem,
  type Good,
  type HistoryEntry,
  type Inventory,
  type OperationDoc,
  type OperationType,
  type OrderSupplier,
  type PriceTagLayout,
  type SalePaymentMethod,
  type StockReminder,
  type StockSettings,
  type StockStaffPermissions,
  type TechCard,
  type TechCardLine,
  type Warehouse,
} from '@/domain/stock';
import type {
  BookingConsumableLine,
  BookingConsumables,
  BookingConsumableServiceLine,
  ClientMaterialRow,
  ClientPaletteShade,
  ClientPurchaseSearchRow,
  ClientPurchaseSummary,
  ConsumablesAnalysisRow,
  ImportGoodsRowResult,
  ListOperationsResult,
  MassEditRow,
  MovementReportRow,
  OperationFilters,
  ReceiptData,
  SupplierOffer,
  CategoryInput,
  CategoryNode,
  CreateInventoryInput,
  CreateSaleInput,
  EquipmentInput,
  GoodInput,
  GoodRow,
  IncomeInput,
  InventoryDetail,
  InventoryLineRow,
  InventoryRow,
  ListGoodsParams,
  ListGoodsResult,
  MoveOperationInput,
  OperationDocDetail,
  OperationDocPatch,
  OrderCandidate,
  ProductSaleRow,
  SaleDocPatch,
  StockLevel,
  TechCardInput,
  TechCardLineRow,
  TechCardRow,
  UpdateInventoryMetaInput,
  WarehouseInput,
  WriteoffInput,
} from '@/api/stock';

const b = (businessId: Id) => `/v1/biz/${businessId}`;
const sb = (businessId: Id) => `${b(businessId)}/stock`;

// ─────────────────────────── Склады ───────────────────────────

export function listWarehouses(businessId: Id, locationId: Id): Promise<(Warehouse & { goodsCount: number })[]> {
  return http('GET', `${sb(businessId)}/warehouses`, undefined, { query: { locationId } });
}

export function getWarehouse(businessId: Id, id: Id): Promise<Warehouse | undefined> {
  return http('GET', `${sb(businessId)}/warehouses/${id}`);
}

export function createWarehouse(businessId: Id, locationId: Id, input: WarehouseInput): Promise<Warehouse> {
  return http('POST', `${sb(businessId)}/warehouses`, { ...input, locationId });
}

export function updateWarehouse(businessId: Id, id: Id, input: WarehouseInput): Promise<Warehouse> {
  return http('PATCH', `${sb(businessId)}/warehouses/${id}`, input);
}

export async function deleteWarehouse(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/warehouses/${id}`);
}

export async function reorderWarehouses(businessId: Id, locationId: Id, orderedIds: Id[]): Promise<void> {
  await http('POST', `${sb(businessId)}/warehouses/reorder`, { orderedIds }, { query: { locationId } });
}

export function goodStockAt(businessId: Id, goodId: Id, warehouseId: Id): Promise<number> {
  return http<StockLevel[]>('GET', `${sb(businessId)}/balances`, undefined, { query: { goodId } }).then((levels) => levels.find((l) => l.warehouseId === warehouseId)?.qty ?? 0);
}

// ─────────────────────────── Категории ───────────────────────────

export function listCategoryTree(businessId: Id, locationId: Id): Promise<CategoryNode[]> {
  return http('GET', `${sb(businessId)}/product-categories`, undefined, { query: { locationId, tree: 1 } });
}

export function listCategoriesFlat(businessId: Id, locationId: Id, includeArchived = false): Promise<Category[]> {
  return http('GET', `${sb(businessId)}/product-categories`, undefined, { query: { locationId, includeArchived: includeArchived ? 1 : undefined } });
}

export function createCategory(businessId: Id, locationId: Id, input: CategoryInput): Promise<Category> {
  return http('POST', `${sb(businessId)}/product-categories`, { ...input, locationId });
}

export function updateCategory(businessId: Id, id: Id, input: CategoryInput): Promise<Category> {
  return http('PATCH', `${sb(businessId)}/product-categories/${id}`, input);
}

export async function archiveCategory(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/product-categories/${id}/archive`);
}

export async function restoreCategory(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/product-categories/${id}/restore`);
}

export function restoreCategories(businessId: Id, ids: Id[]): Promise<{ restored: Id[]; skipped: Id[] }> {
  return http('POST', `${sb(businessId)}/product-categories/restore`, { ids });
}

export async function deleteCategory(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/product-categories/${id}`);
}

// ─────────────────────────── Товары ───────────────────────────

export function listGoods(businessId: Id, locationId: Id, params: ListGoodsParams = {}): Promise<ListGoodsResult> {
  return http('GET', `${sb(businessId)}/products`, undefined, {
    query: { locationId, categoryId: params.categoryId, search: params.search, includeArchived: params.includeArchived ? 1 : undefined, page: params.page, pageSize: params.pageSize },
  });
}

export function searchGoods(businessId: Id, locationId: Id, query: string, limit = 20): Promise<GoodRow[]> {
  return http('GET', `${sb(businessId)}/products/search`, undefined, { query: { locationId, q: query, limit } });
}

export function getGood(businessId: Id, id: Id): Promise<(GoodRow & { levels: StockLevel[] }) | undefined> {
  return http('GET', `${sb(businessId)}/products/${id}`);
}

export function listGoodHistory(businessId: Id, goodId: Id): Promise<HistoryEntry[]> {
  return http('GET', `${sb(businessId)}/products/${goodId}/history`);
}

export function createGood(businessId: Id, locationId: Id, input: GoodInput): Promise<Good> {
  return http('POST', `${sb(businessId)}/products`, { ...input, locationId });
}

export function updateGood(businessId: Id, id: Id, input: GoodInput): Promise<Good> {
  return http('PATCH', `${sb(businessId)}/products/${id}`, input);
}

export async function archiveGood(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/products/${id}/archive`);
}

export function archiveGoods(businessId: Id, ids: Id[]): Promise<{ archived: Id[]; skipped: Id[] }> {
  return http('POST', `${sb(businessId)}/products/archive`, { ids });
}

export async function quickUpdateGoods(businessId: Id, ids: Id[], patch: { salePrice?: number; criticalStock?: number; desiredStock?: number }): Promise<void> {
  await http('POST', `${sb(businessId)}/products/quick-update`, { ids, ...patch });
}

export async function restoreGood(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/products/${id}/restore`);
}

export function restoreGoods(businessId: Id, ids: Id[], markRestored = false): Promise<{ restored: Id[]; skipped: Id[] }> {
  return http('POST', `${sb(businessId)}/products/restore`, { ids, markRestored });
}

export async function deleteGood(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/products/${id}`);
}

// ─────────────────────────── «Заказать» (⭐ F-00-137) ───────────────────────────

export function listOrderCandidates(businessId: Id, locationId: Id): Promise<OrderCandidate[]> {
  return http('GET', `${sb(businessId)}/to-order`, undefined, { query: { locationId } });
}

/** Тот же критерий, что и `listOrderCandidates` (criticalStock>0 && остаток<=critical) — отдельного эндпоинта не заводили, просто длина */
export function countBelowCritical(businessId: Id, locationId: Id): Promise<number> {
  return listOrderCandidates(businessId, locationId).then((rows) => rows.length);
}

/** F-08-058/F-00-140: товары с истёкшим сроком и ненулевым остатком — фильтр над уже вычисленным `listGoods` (без нового эндпоинта) */
export async function listExpiredGoods(businessId: Id, locationId: Id): Promise<GoodRow[]> {
  const { items } = await listGoods(businessId, locationId, { pageSize: 1000 });
  return items.filter((r) => r.expiry === 'expired' && r.totalStock > 0);
}

// ─────────────────────────── Приход, списание, перемещение, документ ───────────────────────────

function docView(doc: OperationDocDetail): OperationDocDetail {
  // Сервер отдаёт то же имя полей, что OperationDoc/OperationDocDetail мока (docView бэкенда собран по этому контракту) — без переформовки.
  return doc;
}

export function createIncomeOperation(businessId: Id, locationId: Id, input: IncomeInput): Promise<OperationDoc> {
  const paymentMethod: 'cash' | 'card' = input.paymentMethod === 'card' ? 'card' : 'cash';
  return http('POST', `${sb(businessId)}/stock-ops/income`, { ...input, locationId, paymentMethod });
}

export function createWriteoffOperation(businessId: Id, locationId: Id, input: WriteoffInput): Promise<OperationDoc> {
  return http('POST', `${sb(businessId)}/stock-ops/writeoff`, { ...input, locationId });
}

export function createMoveOperationMulti(businessId: Id, locationId: Id, input: MoveOperationInput): Promise<OperationDoc> {
  return http('POST', `${sb(businessId)}/stock-ops/move`, { ...input, locationId });
}

export async function getOperationDoc(businessId: Id, docId: Id): Promise<OperationDocDetail | undefined> {
  const doc = await http<OperationDocDetail | undefined>('GET', `${sb(businessId)}/stock-ops/${docId}`);
  return doc && docView(doc);
}

export function updateOperationDoc(businessId: Id, docId: Id, patch: OperationDocPatch): Promise<OperationDoc> {
  return http('PATCH', `${sb(businessId)}/stock-ops/${docId}`, patch);
}

export async function deleteOperationLine(businessId: Id, docId: Id, goodId: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/stock-ops/${docId}/lines/${goodId}`);
}

export async function deleteOperationDoc(businessId: Id, docId: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/stock-ops/${docId}`);
}

export function cancelMoveOperation(businessId: Id, docId: Id): Promise<void> {
  return http('POST', `${sb(businessId)}/stock-ops/${docId}/cancel-move`);
}

export function listOperationHistory(businessId: Id, docId: Id): Promise<HistoryEntry[]> {
  return http('GET', `${sb(businessId)}/stock-ops/${docId}/history`);
}

// ─────────────────────────── Продажа товара ───────────────────────────

export function createSaleOperation(businessId: Id, locationId: Id, input: CreateSaleInput): Promise<OperationDoc> {
  // date/extraLines — вне мандата этапа 13 (абонементы/сертификаты продаёт loyalty, дата продажи всегда «сейчас»)
  const { date: _date, extraLines: _extraLines, ...rest } = input;
  return http('POST', `${sb(businessId)}/sales`, { ...rest, locationId });
}

export async function cancelSaleOperation(businessId: Id, docId: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/sales/${docId}/cancel`);
}

/** ⭐ Не строено на сервере (правка товарных строк продажи, F-08-077) — отменить и продать заново в api-режиме */
export function updateSaleOperation(_businessId: Id, _docId: Id, _patch: SaleDocPatch): Promise<OperationDoc> {
  return Promise.reject(new Error('updateSaleOperation: not implemented on server (stage 13) — cancel and re-sell instead'));
}

// ─────────────────────────── Оборудование (⭐ F-00-141) ───────────────────────────

export function listEquipment(businessId: Id, locationId: Id, includeArchived = false): Promise<EquipmentItem[]> {
  return http('GET', `${sb(businessId)}/equipment`, undefined, { query: { locationId, includeArchived: includeArchived ? 1 : undefined } });
}

export function getEquipment(businessId: Id, id: Id): Promise<EquipmentItem | undefined> {
  return http('GET', `${sb(businessId)}/equipment/${id}`);
}

export function createEquipment(businessId: Id, locationId: Id, input: EquipmentInput): Promise<EquipmentItem> {
  return http('POST', `${sb(businessId)}/equipment`, { ...input, locationId });
}

export function updateEquipment(businessId: Id, id: Id, input: EquipmentInput): Promise<EquipmentItem> {
  return http('PATCH', `${sb(businessId)}/equipment/${id}`, input);
}

export async function deleteEquipment(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/equipment/${id}`);
}

// ─────────────────────────── Инвентаризация (базовый цикл) ───────────────────────────

async function enrichInventory(businessId: Id, locationId: Id, inv: Inventory): Promise<InventoryRow> {
  const [warehouses, categories] = await Promise.all([listWarehouses(businessId, locationId), listCategoriesFlat(businessId, locationId, true)]);
  return { ...inv, warehouseName: warehouses.find((w) => w.id === inv.warehouseId)?.name ?? '', categoryName: inv.categoryId ? categories.find((c) => c.id === inv.categoryId)?.name : undefined, goodsCount: inv.lines.length };
}

export async function listInventories(businessId: Id, locationId: Id): Promise<InventoryRow[]> {
  const rows = await http<Inventory[]>('GET', `${sb(businessId)}/inventories`, undefined, { query: { locationId } });
  return Promise.all(rows.map((r) => enrichInventory(businessId, locationId, r)));
}

export async function getInventory(businessId: Id, id: Id): Promise<InventoryDetail | undefined> {
  const inv = await http<Inventory | undefined>('GET', `${sb(businessId)}/inventories/${id}`);
  if (!inv) return undefined;
  const row = await enrichInventory(businessId, inv.locationId, inv);
  const goods = await Promise.all(inv.lines.map((l) => getGood(businessId, l.goodId)));
  const lineRows: InventoryLineRow[] = inv.lines.map((l, i) => {
    const g = goods[i];
    return { ...l, goodName: g?.name ?? '', sku: g?.sku, unit: g?.saleUnit ?? 'pcs', massNetG: g?.massNetG, massGrossG: g?.massGrossG, diff: (l.actualQty ?? l.calcQty) - l.calcQty };
  });
  return { ...row, lineRows };
}

export function createInventory(businessId: Id, locationId: Id, input: CreateInventoryInput): Promise<Inventory> {
  // barcodeCounts/missingBehavior — сканер штрихкодов при создании (F-08-081), вне мандата этапа 13
  return http('POST', `${sb(businessId)}/inventories`, { locationId, warehouseId: input.warehouseId, categoryId: input.categoryId, comment: input.comment });
}

export async function setInventoryActual(businessId: Id, id: Id, goodId: Id, actualQty: number): Promise<void> {
  await http('PATCH', `${sb(businessId)}/inventories/${id}/lines`, { lines: [{ goodId, actualQty: Math.max(0, actualQty) }] });
}

export async function incrementInventoryActual(businessId: Id, id: Id, goodId: Id): Promise<number> {
  const inv = await http<Inventory>('GET', `${sb(businessId)}/inventories/${id}`);
  const line = inv.lines.find((l) => l.goodId === goodId);
  const next = (line?.actualQty ?? line?.calcQty ?? 0) + 1;
  await setInventoryActual(businessId, id, goodId, next);
  return next;
}

export async function resetInventoryActual(businessId: Id, id: Id): Promise<void> {
  const inv = await http<Inventory>('GET', `${sb(businessId)}/inventories/${id}`);
  await http('PATCH', `${sb(businessId)}/inventories/${id}/lines`, { lines: inv.lines.map((l) => ({ goodId: l.goodId, actualQty: 0 })) });
}

export async function calculateInventoryActual(businessId: Id, id: Id): Promise<void> {
  const inv = await http<Inventory>('GET', `${sb(businessId)}/inventories/${id}`);
  await http('PATCH', `${sb(businessId)}/inventories/${id}/lines`, { lines: inv.lines.map((l) => ({ goodId: l.goodId, actualQty: l.calcQty })) });
}

export async function finalizeInventory(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/inventories/${id}/complete`);
}

export async function deleteInventory(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/inventories/${id}`);
}

// ─────────────────────────── Технологические карты ───────────────────────────

function techCardRowView(row: TechCard & { serviceName: string; staffName: string; lineDetails: (TechCardLine & { goodName: string; writeoffUnitCode: string; warehouseName: string })[] }): TechCardRow {
  return {
    ...row,
    lineDetails: row.lineDetails.map((l): TechCardLineRow => ({ ...l, unitShort: unitById(l.writeoffUnitCode).short.ru })),
  };
}

export async function listTechCards(businessId: Id, locationId: Id): Promise<TechCardRow[]> {
  const rows = await http<Parameters<typeof techCardRowView>[0][]>('GET', `${sb(businessId)}/tech-cards`, undefined, { query: { locationId } });
  return rows.map(techCardRowView);
}

export async function listTechCardsForService(businessId: Id, serviceId: Id): Promise<TechCardRow[]> {
  const rows = await http<Parameters<typeof techCardRowView>[0][]>('GET', `${sb(businessId)}/tech-cards/by-service/${serviceId}`);
  return rows.map(techCardRowView);
}

export async function getTechCard(businessId: Id, id: Id): Promise<TechCardRow | undefined> {
  const row = await http<Parameters<typeof techCardRowView>[0] | undefined>('GET', `${sb(businessId)}/tech-cards/${id}`);
  return row && techCardRowView(row);
}

export function saveTechCard(businessId: Id, locationId: Id, input: TechCardInput): Promise<TechCard> {
  return http('PUT', `${sb(businessId)}/staff/${input.staffId}/services/${input.serviceId}/tech-card`, { locationId, lines: input.lines });
}

export async function deleteTechCard(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${sb(businessId)}/tech-cards/${id}`);
}

// ─────────────────────────── Настройки склада ───────────────────────────

export function getStockSettings(businessId: Id): Promise<StockSettings> {
  return http('GET', `${sb(businessId)}/settings`);
}

export function updateStockSettings(businessId: Id, patch: Partial<Pick<StockSettings, 'costMethod' | 'expiryWarningDays' | 'forbidOnShortage' | 'adsOptIn'>>): Promise<StockSettings> {
  return http('PATCH', `${sb(businessId)}/settings`, patch);
}

// ─────────────────────────── Этап 21, лейн «finance+stock» — остаток раздела на сервере ───────────────────────────
// Бэкенд: `StockExtController`/`StockExtService` (порт логики мока над таблицами сервера).

const unitShort = (code: string | undefined) => unitById(code ?? 'pcs').short.ru;

export function listOperationRows(businessId: Id, locationId: Id, filters: OperationFilters = {}): Promise<ListOperationsResult> {
  return http('GET', `${sb(businessId)}/journal`, undefined, { query: { locationId, ...filters } });
}

export function getMovementReport(businessId: Id, locationId: Id, dateFrom: string, dateTo: string, warehouseId?: Id): Promise<MovementReportRow[]> {
  return http('GET', `${sb(businessId)}/reports/movement`, undefined, { query: { locationId, dateFrom, dateTo, warehouseId } });
}

export function getConsumablesAnalysis(businessId: Id, locationId: Id, dateFrom: string, dateTo: string): Promise<ConsumablesAnalysisRow[]> {
  return http('GET', `${sb(businessId)}/reports/consumables`, undefined, { query: { locationId, dateFrom, dateTo } });
}

export async function getCostPriceAt(businessId: Id, goodId: Id, atDate: string): Promise<Money> {
  const r = await http<{ value: Money }>('GET', `${sb(businessId)}/cost-price-at`, undefined, { query: { goodId, at: atDate } });
  return r.value;
}

export function getClientPurchaseSummary(businessId: Id, clientId: Id): Promise<ClientPurchaseSummary> {
  return http('GET', `${sb(businessId)}/clients/${clientId}/purchases`);
}

export function searchClientsForPurchases(businessId: Id, query: string): Promise<ClientPurchaseSearchRow[]> {
  return http('GET', `${sb(businessId)}/clients/search`, undefined, { query: { q: query } });
}

export async function getPackageTechCardLines(businessId: Id, packageServiceId: Id, staffId: Id): Promise<TechCardLineRow[]> {
  const rows = await http<(TechCardLine & { goodName: string; writeoffUnitCode: string; warehouseName: string })[]>('GET', `${sb(businessId)}/package-tech-card`, undefined, { query: { packageServiceId, staffId } });
  return rows.map(({ writeoffUnitCode, ...r }) => ({ ...r, unitShort: unitShort(writeoffUnitCode) }));
}

export async function getBookingConsumables(businessId: Id, bookingId: Id): Promise<BookingConsumables> {
  const r = await http<{ docId?: Id; arrived: boolean; lines: (Omit<BookingConsumableLine, 'unitShort'> & { writeoffUnitCode: string })[] }>('GET', `${sb(businessId)}/bookings/${bookingId}/consumables`);
  return { ...r, lines: r.lines.map(({ writeoffUnitCode, ...l }) => ({ ...l, unitShort: unitShort(writeoffUnitCode) })) };
}

export async function getBookingConsumablesByService(businessId: Id, bookingId: Id): Promise<BookingConsumableServiceLine[]> {
  const rows = await http<(Omit<BookingConsumableServiceLine, 'goods'> & { goods: { goodId: Id; goodName: string; qtyWriteoff: number; writeoffUnitCode: string }[] })[]>('GET', `${sb(businessId)}/bookings/${bookingId}/consumables/by-service`);
  return rows.map((r) => ({ ...r, goods: r.goods.map(({ writeoffUnitCode, ...g }) => ({ ...g, unitShort: unitShort(writeoffUnitCode) })) }));
}

export async function addBookingConsumableLine(businessId: Id, locationId: Id, bookingId: Id, goodId: Id, qtyWriteoff: number): Promise<void> {
  await http('POST', `${sb(businessId)}/bookings/${bookingId}/consumables`, { locationId, goodId, qtyWriteoff });
}

export async function setBookingConsumableQty(businessId: Id, bookingId: Id, goodId: Id, qtyWriteoff: number): Promise<void> {
  await http('PUT', `${sb(businessId)}/bookings/${bookingId}/consumables/${goodId}`, { qtyWriteoff });
}

export function getReceiptData(businessId: Id, docId: Id): Promise<ReceiptData | undefined> {
  return http('GET', `${sb(businessId)}/stock-ops/${docId}/receipt`);
}

export async function saveMassEdit(businessId: Id, rows: MassEditRow[]): Promise<number> {
  const r = await http<{ changed: number }>('POST', `${sb(businessId)}/products/mass-edit`, { rows });
  return r.changed;
}

export async function deleteGoods(businessId: Id, ids: Id[]): Promise<void> {
  await http('POST', `${sb(businessId)}/products/delete`, { ids });
}

export function importGoodsRows(businessId: Id, locationId: Id, categoryId: Id, rows: { row: number; name: string; patch: Partial<Good> }[]): Promise<ImportGoodsRowResult[]> {
  return http('POST', `${sb(businessId)}/products/import`, { locationId, categoryId, rows });
}

export function copyGoodToLocationsNetworked(businessId: Id, goodId: Id, targetLocationIds: Id[]): Promise<Good[]> {
  return http('POST', `${sb(businessId)}/products/${goodId}/copy-networked`, { targetLocationIds });
}

export async function getStoredStockPermissions(businessId: Id, staffId: Id): Promise<StockStaffPermissions | null> {
  const r = await http<{ stored: StockStaffPermissions | null }>('GET', `${sb(businessId)}/permissions/${staffId}`);
  return r.stored;
}

export function setStockPermissions(businessId: Id, staffId: Id, patch: Partial<StockStaffPermissions>, base: StockStaffPermissions): Promise<StockStaffPermissions> {
  return http('PUT', `${sb(businessId)}/permissions/${staffId}`, { permissions: patch, base });
}

export function replaceStockPermissions(businessId: Id, staffId: Id, permissions: StockStaffPermissions, source: { label?: string; fromStaffId?: Id }): Promise<StockStaffPermissions> {
  return http('POST', `${sb(businessId)}/permissions/${staffId}/replace`, { permissions, ...source });
}

export function listPermissionHistory(businessId: Id, staffId: Id): Promise<HistoryEntry[]> {
  return http('GET', `${sb(businessId)}/permissions/${staffId}/history`);
}

export async function getStoredPriceTagLayout(businessId: Id): Promise<PriceTagLayout | null> {
  const r = await http<{ stored: PriceTagLayout | null }>('GET', `${sb(businessId)}/price-tag-layout`);
  return r.stored;
}

export function updatePriceTagLayout(businessId: Id, patch: Partial<Omit<PriceTagLayout, 'businessId'>>, base: PriceTagLayout): Promise<PriceTagLayout> {
  return http('PUT', `${sb(businessId)}/price-tag-layout`, { patch, base });
}

export function listReminders(businessId: Id, locationId: Id, staffId?: Id): Promise<StockReminder[]> {
  return http('GET', `${sb(businessId)}/reminders/summary`, undefined, { query: { locationId, staffId } });
}

export function createCustomReminder(businessId: Id, locationId: Id, input: { text: string; date: string; staffId?: Id }): Promise<CustomReminder> {
  return http('POST', `${sb(businessId)}/reminders`, { locationId, text: input.text.trim(), date: input.date, staffId: input.staffId });
}

export async function completeCustomReminder(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${sb(businessId)}/reminders/${id}/toggle`, { done: true });
}

export function listClientMaterials(businessId: Id, locationId: Id): Promise<ClientMaterialRow[]> {
  return http('GET', `${sb(businessId)}/client-materials`, undefined, { query: { locationId } });
}

export function listClientPalette(businessId: Id, locationId: Id): Promise<ClientPaletteShade[]> {
  return http('GET', `${sb(businessId)}/client-palette`, undefined, { query: { locationId } });
}

export async function getSupplierOfferForGood(businessId: Id, productName: string): Promise<SupplierOffer | undefined> {
  const r = await http<{ offer: SupplierOffer | null }>('GET', `${sb(businessId)}/supplier-offer`, undefined, { query: { productName } });
  return r.offer ?? undefined;
}

/** Продажа товаров визита на складе (Ск3) — сервер сводит документ «Продажа товара» с товарами и оплатой визита */
export async function syncVisitGoodsSale(bookingId: Id): Promise<void> {
  const booking = await getBooking(bookingId);
  await http('POST', `${sb(booking.businessId)}/bookings/${bookingId}/goods-sale/sync`);
}

export type { CustomReminder, OperationType, SalePaymentMethod, Money };

// Ск15: запомненный поставщик «Заказать» — один на бизнес (этап 21, лейн finance+stock)

export async function getOrderSupplier(businessId: Id): Promise<OrderSupplier | null> {
  return (await http<{ supplier: OrderSupplier | null }>('GET', `${sb(businessId)}/order-supplier`)).supplier;
}

export async function saveOrderSupplier(businessId: Id, supplier: OrderSupplier): Promise<void> {
  await http('PUT', `${sb(businessId)}/order-supplier`, { counterpartyId: supplier.counterpartyId, name: supplier.name, phone: supplier.phone });
}

// ── Этап 21, лейн finance+stock: хвост фасадов без вызовов с экранов (закрыты, чтобы режим api не читал мок) ──

/** F-08-017: простая копия товара в другие филиалы (без связи сети — у сетевой своя `copyGoodToLocationsNetworked`) */
export function copyGoodToLocations(businessId: Id, goodId: Id, targetLocationIds: Id[]): Promise<Good[]> {
  return http('POST', `${sb(businessId)}/products/${goodId}/copy`, { targetLocationIds });
}

/** F-08-137: товары, проданные клиенту документом «Продажа» — те же строки, что «Покупки» карточки клиента */
export async function listProductSales(businessId: Id, clientId: Id): Promise<ProductSaleRow[]> {
  const summary = await getClientPurchaseSummary(businessId, clientId);
  return summary.rows
    .map((r) => ({ docId: r.docId, bookingId: r.bookingId, date: r.date, goodName: r.goodName, qty: r.qty, unitPrice: r.unitPrice, discountPct: r.discountPct, total: r.total, paid: r.paid }))
    .sort((a, c) => c.date.localeCompare(a.date));
}

/** F-08-088: комментарий/дата/категория черновика инвентаризации (`categoryId` нет — «Все категории», как в моке) */
export async function updateInventoryMeta(businessId: Id, id: Id, patch: UpdateInventoryMetaInput): Promise<void> {
  await http('PATCH', `${sb(businessId)}/inventories/${id}`, { categoryId: patch.categoryId ?? null, comment: patch.comment, date: patch.date });
}

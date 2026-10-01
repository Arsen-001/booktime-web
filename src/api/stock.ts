'use client';

/**
 * API раздела «stock» (пачка b01 — каркас: склады, категории, каталог товаров, карточка товара,
 * журнал складских операций (список), оборудование). Принадлежит разделу.
 * Функции — async поверх request(); свой срез — readArea/mutateArea; сущности ядра — только чтение
 * через readCore()/coreList (создание операций «приход/списание/перемещение» — пачка b02).
 */
import { ApiError, request } from '@/api/request';
import { assertCan, currentActor } from '@/api/core';
import { mutateArea, readArea, readCore } from '@/api/area';
import { recordOperation as recordFinanceOperation, cancelOperation as cancelFinanceOperation } from '@/api/finance';
import { trackAdClick, trackAdImpression } from '@/api/platform/ads';
import * as Server from '@/api/stock.server';
import { isApiMode } from '@/api/http';
import type { OperationMethod as FinanceOperationMethod } from '@/domain/finance';
import type { Id, LocaleCode, Money } from '@/domain/core';
import { applyDiscount } from '@/domain/rules/pricing';
import {
  ORDER_WA_GREETING,
  ROOT_CATEGORY_NAME,
  newGoodDefaults,
  inventoryDiff,
  defaultStockSettings,
  defaultPriceTagLayout,
  defaultStockPermissions,
  NETWORK_LOCAL_FIELDS,
  type Category,
  type CustomReminder,
  type EquipmentItem,
  type ExpiryFlag,
  type Good,
  type HistoryEntityType,
  type Inventory,
  type InventoryLine,
  type NetworkLocalField,
  type OperationDoc,
  type OrderSupplier,
  type OperationLine,
  type OperationType,
  type PriceTagLayout,
  type SalePaymentMethod,
  type StockReminder,
  type StockSettings,
  type StockStaffPermissions,
  type TechCard,
  type TechCardLine,
  type Warehouse,
  type SaleExtraLine,
  type WriteoffReason,
  type StockRoleTemplateId,
  OPERATION_TYPE_LABELS,
  UNIT_OPTIONS,
  expiryFlag as computeExpiryFlag,
  stockPermissionsForRoleTemplate,
  unitById,
} from '@/domain/stock';
import { newId } from '@/lib/id';
import { toCsv, parseCsv } from '@/lib/csv';
import { nowDateTime, today as todayISO } from '@/lib/date';
import { pickText } from '@/lib/text';

export type { OrderSupplier, SaleExtraLine, SalePaymentMethod, StockReminder, StockRoleTemplateId, StockSettings, StockStaffPermissions, TechCard, TechCardLine };

const AREA = 'stock' as const;

function actorName(): string {
  const actor = currentActor();
  const staff = readCore().staff.find((s) => s.id === actor.staffId);
  return staff?.name ?? 'Система';
}

function pushHistory(businessId: Id, entityType: HistoryEntityType, entityId: Id, summary: string) {
  mutateArea(AREA, (s) => {
    s.history.push({ id: newId('hs'), businessId, entityType, entityId, staffName: actorName(), at: nowDateTime(), summary });
  });
}

// ─────────────────────────── Касса (F-00-138/F-08-057/F-08-070/F-08-073): мост к finance ───────────────────────────

/** Касса, привязанная к складу-локации: если бизнес ещё не создал ни одной — заводим стандартные (как открытие кассы) */
function resolveFinanceAccountId(businessId: Id, locationId: Id, method: SalePaymentMethod | 'other'): Id {
  const finance = readArea('finance');
  let accounts = finance.accounts.filter((a) => a.businessId === businessId && a.locationId === locationId);
  if (!accounts.length) {
    accounts = finance.accounts.filter((a) => a.businessId === businessId);
  }
  const wantCard = method === 'card';
  const byKind = accounts.find((a) => a.kind === (wantCard ? 'card' : 'cash'));
  return (byKind ?? accounts[0])?.id ?? '';
}

function resolveFinanceItemId(businessId: Id, key: 'goodsSale' | 'goodsPurchase'): Id | undefined {
  return readArea('finance').itemBySystemKey[businessId]?.[key];
}

function toFinanceMethod(method: SalePaymentMethod | undefined): FinanceOperationMethod {
  if (method === 'card') return 'card';
  if (method === 'cash') return 'cash';
  return 'other'; // 'loyalty' — списание с депозита/подарочной карты, деньгами кассу не двигает — но операция всё равно должна попасть в выручку
}

/**
 * Одна операция кассы под складской документ (продажа/оплаченный приход) — единственное место, откуда
 * stock зовёт finance.recordOperation (F-00-138): «одна бизнес-операция — один вызов».
 */
async function recordStockFinanceOperation(params: {
  businessId: Id;
  locationId: Id;
  docId: Id;
  docNumber: string;
  kind: 'income' | 'expense';
  itemKey: 'goodsSale' | 'goodsPurchase';
  amount: Money;
  method: SalePaymentMethod | undefined;
  clientId?: Id;
  clientName?: string;
  /** Ск16: поставщик прихода — получатель денег в кассе */
  counterpartyId?: Id;
  counterpartyName?: string;
  comment?: string;
}): Promise<Id | undefined> {
  const itemId = resolveFinanceItemId(params.businessId, params.itemKey);
  const accountId = resolveFinanceAccountId(params.businessId, params.locationId, params.method ?? 'other');
  if (!itemId || !accountId || params.amount <= 0) return undefined;
  const party = params.clientId
    ? { partyType: 'client' as const, partyId: params.clientId, partyName: params.clientName }
    : params.counterpartyId || params.counterpartyName
      ? { partyType: 'counterparty' as const, partyId: params.counterpartyId, partyName: params.counterpartyName }
      : { partyType: 'none' as const, partyId: undefined, partyName: undefined };
  const op = await recordFinanceOperation(params.businessId, {
    locationId: params.locationId,
    accountId,
    itemId,
    kind: params.kind,
    amount: params.amount,
    date: nowDateTime(),
    method: toFinanceMethod(params.method),
    ...party,
    comment: params.comment,
    source: 'sale',
    refId: params.docId,
    docNumber: params.docNumber,
    lineLabel: params.kind === 'income' ? `Продажа № ${params.docNumber}` : `Приход № ${params.docNumber}`,
  });
  return op.id;
}

/** Сумма документа для кассы: строки товаров (+ абонементы/сертификаты у продажи) */
function docFinanceAmount(doc: OperationDoc): Money {
  const lines = doc.lines.reduce((sum, l) => sum + Math.abs(l.costTotal), 0);
  const extras = (doc.extraLines ?? []).reduce((sum, e) => sum + e.price, 0);
  return lines + extras;
}

/**
 * Ск6: касса всегда повторяет документ. Правка суммы/способа/поставщика, снятая или поставленная
 * «Оплачено», удалённая строка или весь документ — старая операция кассы отменяется (как возврат в
 * finance, с историей), и, если документ по-прежнему оплачен, пишется новая на актуальную сумму.
 * Ничего не поменялось — касса не трогается.
 */
async function resyncDocFinance(businessId: Id, docId: Id, opts: { deleted?: boolean } = {}): Promise<void> {
  const doc = readArea(AREA).operations.find((o) => o.id === docId && o.businessId === businessId);
  const prevId = doc?.financeOperationId;
  if (!doc) return;
  const kind: 'income' | 'expense' | undefined = doc.type === 'sale' ? 'income' : doc.type === 'income' && !doc.inventoryId && !doc.cancelsDocId ? 'expense' : undefined;
  const amount = docFinanceAmount(doc);
  const wanted = !opts.deleted && Boolean(kind) && doc.paid && !doc.cancelledAt && amount > 0;
  const method = doc.paymentMethod ?? (doc.type === 'income' ? 'cash' : undefined);
  const prev = prevId ? readArea('finance').operations.find((o) => o.id === prevId) : undefined;
  const partyId = doc.type === 'sale' ? doc.clientId : doc.counterpartyId;
  const same =
    wanted && prev && !prev.cancelled && prev.amount === amount && prev.method === toFinanceMethod(method) && (prev.partyId ?? undefined) === (partyId ?? undefined);
  if (same) return;
  if (!wanted && !prevId) return;
  if (prevId && prev && !prev.cancelled) await cancelFinanceOperation(businessId, prevId);
  let nextId: Id | undefined;
  if (wanted && kind) {
    const clientName = doc.clientId ? readCore().clients.find((c) => c.id === doc.clientId)?.name : undefined;
    nextId = await recordStockFinanceOperation({
      businessId,
      locationId: doc.locationId,
      docId: doc.id,
      docNumber: doc.number,
      kind,
      itemKey: kind === 'income' ? 'goodsSale' : 'goodsPurchase',
      amount,
      method,
      clientId: doc.type === 'sale' ? doc.clientId : undefined,
      clientName,
      counterpartyId: doc.type === 'income' ? doc.counterpartyId : undefined,
      counterpartyName: doc.type === 'income' ? doc.counterpartyName : undefined,
      comment: doc.type === 'income' ? doc.counterpartyName : undefined,
    });
  }
  if (opts.deleted) return;
  mutateArea(AREA, (s) => {
    const saved = s.operations.find((o) => o.id === docId);
    if (saved) saved.financeOperationId = nextId;
  });
}

// ─────────────────────────── Остатки (используются каталогом и карточкой) ───────────────────────────

export interface StockLevel {
  warehouseId: Id;
  qty: number;
}

/** Дробные остатки (0.1 флакона × 3) копят хвосты вроде 0.30000000000000004 — режем до 6 знаков */
export function roundQty(qty: number): number {
  return Math.round(qty * 1e6) / 1e6;
}

/**
 * Ск19: карта остатков «товар → склад → количество» строится ОДИН раз на состояние журнала операций
 * (ключ — ссылка на массив operations: запись в срез меняет ссылку, чтение без записи — нет), а не
 * проходом по всем операциям на каждый товар (было O(товары × операции) на каждый экран).
 */
const levelsIndexCache = new WeakMap<OperationDoc[], Map<Id, Map<Id, Map<Id, number>>>>();

function levelsIndex(businessId: Id): Map<Id, Map<Id, number>> {
  const operations = readArea(AREA).operations;
  let byBusiness = levelsIndexCache.get(operations);
  if (!byBusiness) {
    byBusiness = new Map();
    levelsIndexCache.set(operations, byBusiness);
  }
  const cached = byBusiness.get(businessId);
  if (cached) return cached;
  const index = new Map<Id, Map<Id, number>>();
  const add = (goodId: Id, warehouseId: Id, qty: number) => {
    let byWarehouse = index.get(goodId);
    if (!byWarehouse) {
      byWarehouse = new Map();
      index.set(goodId, byWarehouse);
    }
    byWarehouse.set(warehouseId, (byWarehouse.get(warehouseId) ?? 0) + qty);
  };
  for (const op of operations) {
    if (op.businessId !== businessId) continue;
    for (const l of op.lines) {
      add(l.goodId, op.warehouseId, l.qtySale);
      if (op.type === 'move' && op.toWarehouseId) add(l.goodId, op.toWarehouseId, Math.abs(l.qtySale));
    }
  }
  byBusiness.set(businessId, index);
  return index;
}

/** Остаток товара по всем складам, в единицах продажи — из истории операций (F-08-026, F-08-047) */
export function computeLevels(businessId: Id, goodId: Id): StockLevel[] {
  if (isApiMode()) return apiLevelsCache.get(goodId) ?? []; // api: остатки с сервера (getGood().levels), синхронный хелпер отдаёт их кэш
  const byWarehouse = levelsIndex(businessId).get(goodId);
  if (!byWarehouse) return [];
  return Array.from(byWarehouse.entries())
    .map(([warehouseId, qty]) => ({ warehouseId, qty: roundQty(qty) }))
    .filter((l) => l.qty !== 0);
}

function levelAt(businessId: Id, goodId: Id, warehouseId: Id): number {
  return roundQty(levelsIndex(businessId).get(goodId)?.get(warehouseId) ?? 0);
}

function totalStock(businessId: Id, goodId: Id): number {
  const byWarehouse = levelsIndex(businessId).get(goodId);
  if (!byWarehouse) return 0;
  let sum = 0;
  for (const qty of byWarehouse.values()) sum += qty;
  return roundQty(sum);
}

// ─────────────────────────── Склады (F-08-004…009, F-00-133) ───────────────────────────

export function listWarehouses(businessId: Id, locationId: Id): Promise<(Warehouse & { goodsCount: number })[]> {
  if (isApiMode()) return Server.listWarehouses(businessId, locationId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    return state.warehouses
      .filter((w) => w.businessId === businessId && w.locationId === locationId)
      .sort((a, b) => a.order - b.order)
      .map((w) => ({ ...w, goodsCount: state.goods.filter((g) => g.locationId === locationId && !g.archived && totalStock(businessId, g.id) > 0 && computeLevels(businessId, g.id).some((l) => l.warehouseId === w.id)).length }));
  });
}

export function getWarehouse(businessId: Id, id: Id): Promise<Warehouse | undefined> {
  if (isApiMode()) return Server.getWarehouse(businessId, id);
  return request(() => readArea(AREA).warehouses.find((w) => w.id === id && w.businessId === businessId));
}

export interface WarehouseInput {
  name: string;
  type: Warehouse['type'];
  comment?: string;
}

export function createWarehouse(businessId: Id, locationId: Id, input: WarehouseInput): Promise<Warehouse> {
  if (isApiMode()) return Server.createWarehouse(businessId, locationId, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    const state = readArea(AREA);
    const maxOrder = Math.max(0, ...state.warehouses.filter((w) => w.locationId === locationId).map((w) => w.order));
    const warehouse: Warehouse = {
      id: newId('wh'),
      businessId,
      locationId,
      name: input.name.trim(),
      type: input.type,
      comment: input.comment?.trim() || undefined,
      order: maxOrder + 1,
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.warehouses.push(warehouse);
    });
    pushHistory(businessId, 'warehouse', warehouse.id, `Склад «${warehouse.name}» создан`);
    return warehouse;
  });
}

export function updateWarehouse(businessId: Id, id: Id, input: WarehouseInput): Promise<Warehouse> {
  if (isApiMode()) return Server.updateWarehouse(businessId, id, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    let updated: Warehouse | undefined;
    mutateArea(AREA, (s) => {
      const w = s.warehouses.find((x) => x.id === id && x.businessId === businessId);
      if (!w) throw new ApiError('not_found');
      w.name = input.name.trim();
      w.type = input.type;
      w.comment = input.comment?.trim() || undefined;
      updated = w;
    });
    if (!updated) throw new ApiError('not_found');
    pushHistory(businessId, 'warehouse', id, `Склад «${updated.name}» изменён`);
    return updated;
  });
}

/** F-08-008: удалить можно только склад без остатков — последствия для остатка нигде в Altegio не описаны, решение своё */
export function deleteWarehouse(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteWarehouse(businessId, id);
  return request(() => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    const state = readArea(AREA);
    const warehouse = state.warehouses.find((w) => w.id === id && w.businessId === businessId);
    if (!warehouse) throw new ApiError('not_found');
    const hasStock = state.goods.some((g) => g.locationId === warehouse.locationId && computeLevels(businessId, g.id).some((l) => l.warehouseId === id && l.qty !== 0));
    if (hasStock) throw new ApiError('warehouse_has_stock');
    const others = state.warehouses.filter((w) => w.locationId === warehouse.locationId);
    if (others.length <= 1) throw new ApiError('last_warehouse');
    mutateArea(AREA, (s) => {
      s.warehouses = s.warehouses.filter((w) => w.id !== id);
    });
    pushHistory(businessId, 'warehouse', id, `Склад «${warehouse.name}» удалён`);
  });
}

export function reorderWarehouses(businessId: Id, locationId: Id, orderedIds: Id[]): Promise<void> {
  if (isApiMode()) return Server.reorderWarehouses(businessId, locationId, orderedIds);
  return request(() => {
    assertCan('stock.edit');
    mutateArea(AREA, (s) => {
      orderedIds.forEach((id, index) => {
        const w = s.warehouses.find((x) => x.id === id && x.businessId === businessId && x.locationId === locationId);
        if (w) w.order = index;
      });
    });
  });
}

/** Остаток товара на конкретном складе, в единицах продажи — для формы перемещения (F-08-005/059) */
export function goodStockAt(businessId: Id, goodId: Id, warehouseId: Id): Promise<number> {
  if (isApiMode()) return Server.goodStockAt(businessId, goodId, warehouseId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    return levelAt(businessId, goodId, warehouseId);
  });
}

function nextOperationNumber(businessId: Id): string {
  const state = readArea(AREA);
  const max = state.operations.filter((op) => op.businessId === businessId).reduce((m, op) => Math.max(m, Number(op.number) || 0), 100000);
  return String(max + 1);
}

export interface MoveGoodsInput {
  fromWarehouseId: Id;
  toWarehouseId: Id;
  goodId: Id;
  qty: number;
  comment?: string;
}

/** F-08-005/F-08-048/F-08-059: «Переместить товары» — документ типа move, доступен со страницы «Склады» */
export function createMoveOperation(businessId: Id, locationId: Id, input: MoveGoodsInput): Promise<void> {
  if (isApiMode()) return Server.createMoveOperationMulti(businessId, locationId, { date: nowDateTime(), fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, lines: [{ goodId: input.goodId, qty: input.qty }], comment: input.comment?.trim() || undefined }).then(() => undefined);
  return request(() => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    if (input.fromWarehouseId === input.toWarehouseId) throw new ApiError('validation');
    if (!(input.qty > 0)) throw new ApiError('validation');
    const state = readArea(AREA);
    const good = state.goods.find((g) => g.id === input.goodId && g.businessId === businessId);
    if (!good) throw new ApiError('not_found');
    // F-08-099: без «Запретить операции при нехватке» остаток может уйти в минус (F-08-061 — показывается красным)
    const shortageSettings = state.settings[businessId] ?? defaultStockSettings(businessId);
    const available = computeLevels(businessId, input.goodId).find((l) => l.warehouseId === input.fromWarehouseId)?.qty ?? 0;
    if (shortageSettings.forbidOnShortage && input.qty > available) {
      const warehouseName = state.warehouses.find((w) => w.id === input.fromWarehouseId)?.name ?? '';
      throw new ApiError('insufficient_stock', JSON.stringify({ goodName: good.name, warehouseName, available }));
    }
    const number = nextOperationNumber(businessId);
    const now = nowDateTime();
    mutateArea(AREA, (s) => {
      s.operations.push({
        id: newId('op'),
        businessId,
        locationId,
        number,
        type: 'move',
        date: now,
        warehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        staffId: currentActor().staffId,
        paid: true,
        comment: input.comment?.trim() || undefined,
        lines: [{ goodId: input.goodId, qtySale: -input.qty, unitPrice: good.costPrice, costTotal: -input.qty * good.costPrice }],
        createdAt: now,
      });
    });
    pushHistory(businessId, 'good', input.goodId, `Перемещено ${input.qty} ${unitById(good.saleUnit).short.ru} · № ${number}`);
    const docId = readArea(AREA).operations.find((op) => op.businessId === businessId && op.number === number)?.id;
    if (docId) pushHistory(businessId, 'operation', docId, `Документ № ${number} создан`);
  });
}

/** F-08-047: «История изменений» → «Показать» у строки журнала операций */
export function listOperationHistory(businessId: Id, docId: Id) {
  if (isApiMode()) return Server.listOperationHistory(businessId, docId);
  return request(() =>
    readArea(AREA)
      .history.filter((h) => h.businessId === businessId && h.entityType === 'operation' && h.entityId === docId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

// ─────────────────────────── Приход, списание, документ (F-08-049…061, F-08-146, F-00-135, F-00-137) ───────────────────────────

export interface OperationLineInput {
  goodId: Id;
  qtySale: number;
  unitPrice: Money;
  discountPct?: number;
}

// Итог строки — через правило ядра @/domain/rules/pricing (единый источник округления скидки),
// не своя формула (state-s1 п.2, arch-a1 №3).
function lineTotal(line: OperationLineInput): Money {
  return Math.round(applyDiscount(line.unitPrice, line.discountPct) * line.qtySale);
}

/** Ск7: количество в строке — строго больше нуля; 0 и минус раньше проходили (−3 сохранялось как +3) */
function assertPositiveQty(lines: { qtySale?: number; qty?: number }[]): void {
  for (const l of lines) {
    const qty = l.qtySale ?? l.qty;
    if (!(typeof qty === 'number' && Number.isFinite(qty) && qty > 0)) throw new ApiError('invalid_qty');
  }
}

export interface IncomeInput {
  date: string;
  warehouseId: Id;
  counterpartyName?: string;
  /** Ск16: поставщик из справочника контрагентов финансов */
  counterpartyId?: Id;
  paid: boolean;
  /** F-08-057: как оплачен приход поставщику — кассу трогает только когда «Оплачено» отмечено; по умолчанию наличными */
  paymentMethod?: SalePaymentMethod;
  comment?: string;
  lines: OperationLineInput[];
}

/** F-08-054…057: приход товара — увеличивает остаток, цена строки = «цена поставки» (не обязательно себестоимость); «Оплачено» пишет расход в кассу (F-08-057) */
export function createIncomeOperation(businessId: Id, locationId: Id, input: IncomeInput): Promise<OperationDoc> {
  if (isApiMode()) return Server.createIncomeOperation(businessId, locationId, input);
  return request(async () => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    if (!input.lines.length) throw new ApiError('validation');
    if (!input.warehouseId) throw new ApiError('validation');
    assertPositiveQty(input.lines);
    const number = nextOperationNumber(businessId);
    const doc: OperationDoc = {
      id: newId('op'),
      businessId,
      locationId,
      number,
      type: 'income',
      date: input.date,
      warehouseId: input.warehouseId,
      counterpartyName: input.counterpartyName?.trim() || undefined,
      counterpartyId: input.counterpartyId || undefined,
      staffId: currentActor().staffId,
      paid: input.paid,
      paymentMethod: input.paid ? (input.paymentMethod ?? 'cash') : undefined,
      comment: input.comment?.trim() || undefined,
      lines: input.lines.map((l) => ({ goodId: l.goodId, qtySale: Math.abs(l.qtySale), unitPrice: l.unitPrice, discountPct: l.discountPct, costTotal: lineTotal(l) })),
      createdAt: nowDateTime(),
    };
    const settings = readArea(AREA).settings[businessId] ?? defaultStockSettings(businessId);
    mutateArea(AREA, (s) => {
      s.operations.push(doc);
      // F-08-054/F-08-097: приход обновляет себестоимость — «последняя цена» или средневзвешенная по настройке
      doc.lines.forEach((line) => {
        const good = s.goods.find((g) => g.id === line.goodId);
        if (!good) return;
        if (settings.costMethod === 'fromGoodSettings') {
          // F-08-097 «Брать из настроек товара»: приход не трогает себестоимость, она задаётся вручную в карточке товара.
          return;
        }
        if (settings.costMethod === 'average') {
          const priorQty = computeLevels(businessId, line.goodId).reduce((sum, l) => sum + l.qty, 0);
          const totalQty = priorQty + line.qtySale;
          good.costPrice = totalQty > 0 ? Math.round((priorQty * good.costPrice + line.qtySale * line.unitPrice) / totalQty) : line.unitPrice;
        } else {
          good.costPrice = line.unitPrice;
        }
      });
    });
    pushHistory(businessId, 'operation', doc.id, `Приход № ${number} создан`);
    await resyncDocFinance(businessId, doc.id);
    return readArea(AREA).operations.find((o) => o.id === doc.id) ?? doc;
  });
}

export interface WriteoffInput {
  date: string;
  warehouseId: Id;
  reason: WriteoffReason;
  comment?: string;
  lines: OperationLineInput[];
}

/** F-08-058: списание — цена строки = себестоимость за единицу списания из карточки товара */
export function createWriteoffOperation(businessId: Id, locationId: Id, input: WriteoffInput): Promise<OperationDoc> {
  if (isApiMode()) return Server.createWriteoffOperation(businessId, locationId, input);
  return request(() => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    if (!input.lines.length) throw new ApiError('validation');
    assertPositiveQty(input.lines);
    // F-08-099: списание в минус запрещено только при включённой настройке
    const shortageState = readArea(AREA);
    const shortageSettings = shortageState.settings[businessId] ?? defaultStockSettings(businessId);
    if (shortageSettings.forbidOnShortage) {
      for (const line of input.lines) {
        const available = computeLevels(businessId, line.goodId).find((l) => l.warehouseId === input.warehouseId)?.qty ?? 0;
        if (Math.abs(line.qtySale) > available) {
          const good = shortageState.goods.find((g) => g.id === line.goodId);
          const warehouseName = shortageState.warehouses.find((w) => w.id === input.warehouseId)?.name ?? '';
          throw new ApiError('insufficient_stock', JSON.stringify({ goodName: good?.name ?? '', warehouseName, available }));
        }
      }
    }
    const number = nextOperationNumber(businessId);
    const doc: OperationDoc = {
      id: newId('op'),
      businessId,
      locationId,
      number,
      type: 'writeoffProduct',
      date: input.date,
      warehouseId: input.warehouseId,
      staffId: currentActor().staffId,
      paid: true,
      reason: input.reason,
      comment: input.comment?.trim() || undefined,
      lines: input.lines.map((l) => ({ goodId: l.goodId, qtySale: -Math.abs(l.qtySale), unitPrice: l.unitPrice, costTotal: -Math.abs(lineTotal(l)) })),
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.operations.push(doc);
    });
    pushHistory(businessId, 'operation', doc.id, `Списание № ${number} создано`);
    return doc;
  });
}

export interface MoveLineInput {
  goodId: Id;
  qty: number;
}

export interface MoveOperationInput {
  date: string;
  fromWarehouseId: Id;
  toWarehouseId: Id;
  lines: MoveLineInput[];
  comment?: string;
}

/** F-08-059: перемещение — несколько товаров одной операцией (форма /operations/new/move) */
export function createMoveOperationMulti(businessId: Id, locationId: Id, input: MoveOperationInput): Promise<OperationDoc> {
  if (isApiMode()) return Server.createMoveOperationMulti(businessId, locationId, input);
  return request(() => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    if (input.fromWarehouseId === input.toWarehouseId) throw new ApiError('validation');
    if (!input.lines.length) throw new ApiError('validation');
    assertPositiveQty(input.lines);
    const state = readArea(AREA);
    const fromWarehouseName = state.warehouses.find((w) => w.id === input.fromWarehouseId)?.name ?? '';
    // F-08-099: гейтится настройкой; по умолчанию перемещение в минус разрешено (F-08-061)
    const shortageSettings = state.settings[businessId] ?? defaultStockSettings(businessId);
    if (shortageSettings.forbidOnShortage) {
      input.lines.forEach((l) => {
        const available = computeLevels(businessId, l.goodId).find((s) => s.warehouseId === input.fromWarehouseId)?.qty ?? 0;
        if (l.qty > available) {
          const goodName = state.goods.find((g) => g.id === l.goodId)?.name ?? '';
          throw new ApiError('insufficient_stock', JSON.stringify({ goodName, warehouseName: fromWarehouseName, available }));
        }
      });
    }
    const number = nextOperationNumber(businessId);
    const doc: OperationDoc = {
      id: newId('op'),
      businessId,
      locationId,
      number,
      type: 'move',
      date: input.date,
      warehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      staffId: currentActor().staffId,
      paid: true,
      comment: input.comment?.trim() || undefined,
      lines: input.lines.map((l) => {
        const good = state.goods.find((g) => g.id === l.goodId);
        const cost = good?.costPrice ?? 0;
        return { goodId: l.goodId, qtySale: -l.qty, unitPrice: cost, costTotal: -l.qty * cost };
      }),
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.operations.push(doc);
    });
    pushHistory(businessId, 'operation', doc.id, `Перемещение № ${number} создано`);
    return doc;
  });
}

/** F-08-058: быстрое списание всего просроченного на складе (F-00-140) */
export function listExpiredGoods(businessId: Id, locationId: Id): Promise<GoodRow[]> {
  if (isApiMode()) return Server.listExpiredGoods(businessId, locationId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const categories = state.categories.filter((c) => c.locationId === locationId);
    return state.goods
      .filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived)
      .map((g) => toRow(businessId, g, categories))
      .filter((r) => r.expiry === 'expired' && r.totalStock > 0);
  });
}

export interface OperationDocDetail extends OperationDoc {
  warehouseName: string;
  toWarehouseName?: string;
  lineDetails: (OperationLine & { goodName: string; saleUnit: string })[];
}

/** F-08-049: документ операции целиком */
export function getOperationDoc(businessId: Id, docId: Id): Promise<OperationDocDetail | undefined> {
  if (isApiMode()) return Server.getOperationDoc(businessId, docId);
  return request(() => {
    const state = readArea(AREA);
    const doc = state.operations.find((op) => op.id === docId && op.businessId === businessId);
    if (!doc) return undefined;
    const warehouse = state.warehouses.find((w) => w.id === doc.warehouseId);
    const toWarehouse = doc.toWarehouseId ? state.warehouses.find((w) => w.id === doc.toWarehouseId) : undefined;
    return {
      ...doc,
      warehouseName: warehouse?.name ?? '',
      toWarehouseName: toWarehouse?.name,
      lineDetails: doc.lines.map((l) => {
        const good = state.goods.find((g) => g.id === l.goodId);
        return { ...l, goodName: good?.name ?? '', saleUnit: good?.saleUnit ?? 'pcs' };
      }),
    };
  });
}

export interface OperationDocPatch {
  date: string;
  warehouseId: Id;
  counterpartyName?: string;
  /** Ск16: поставщик из справочника контрагентов */
  counterpartyId?: Id;
  paid: boolean;
  /** Ск16: способ оплаты прихода (для списаний не используется) */
  paymentMethod?: SalePaymentMethod;
  reason?: WriteoffReason;
  comment?: string;
  lines: OperationLineInput[];
}

/**
 * F-08-050/F-08-146: правка прихода/списания/продажи — тип и перемещение не редактируются.
 * Ск6: касса повторяет документ целиком — сумма, способ, поставщик, «Оплачено» (resyncDocFinance).
 */
export function updateOperationDoc(businessId: Id, docId: Id, patch: OperationDocPatch): Promise<OperationDoc> {
  if (isApiMode()) return Server.updateOperationDoc(businessId, docId, patch);
  return request(async () => {
    assertCan('stock.edit');
    if (!patch.lines.length) throw new ApiError('validation');
    assertPositiveQty(patch.lines);
    let updated: OperationDoc | undefined;
    mutateArea(AREA, (s) => {
      const doc = s.operations.find((op) => op.id === docId && op.businessId === businessId);
      if (!doc) throw new ApiError('not_found');
      if (doc.type === 'move') throw new ApiError('move_not_editable');
      const sign = doc.type === 'income' ? 1 : -1;
      doc.date = patch.date;
      doc.warehouseId = patch.warehouseId;
      doc.counterpartyName = patch.counterpartyName?.trim() || undefined;
      doc.counterpartyId = patch.counterpartyId || undefined;
      doc.paid = patch.paid;
      if (doc.type === 'income') doc.paymentMethod = patch.paid ? (patch.paymentMethod ?? doc.paymentMethod ?? 'cash') : undefined;
      doc.reason = patch.reason;
      doc.comment = patch.comment?.trim() || undefined;
      doc.lines = patch.lines.map((l) => ({ goodId: l.goodId, qtySale: sign * Math.abs(l.qtySale), unitPrice: l.unitPrice, discountPct: l.discountPct, costTotal: sign * Math.abs(lineTotal(l)) }));
      doc.updatedAt = nowDateTime();
      updated = doc;
    });
    if (!updated) throw new ApiError('not_found');
    pushHistory(businessId, 'operation', docId, `Документ № ${updated.number} изменён`);
    await resyncDocFinance(businessId, docId);
    return readArea(AREA).operations.find((o) => o.id === docId) ?? updated;
  });
}

/**
 * F-08-051: удалить одну строку. Последняя строка — документ удаляется целиком (пустой документ-призрак
 * по прямому адресу никому не нужен); возвращает true, если документа больше нет.
 * Ск6: сумма в кассе пересчитывается (старая операция отменяется, новая — на остаток документа).
 */
export function deleteOperationLine(businessId: Id, docId: Id, goodId: Id): Promise<boolean> {
  if (isApiMode()) return Server.deleteOperationLine(businessId, docId, goodId).then(() => false);
  return request(async () => {
    assertCan('stock.edit');
    const current = readArea(AREA).operations.find((op) => op.id === docId && op.businessId === businessId);
    if (!current) throw new ApiError('not_found');
    if (current.type === 'move') throw new ApiError('move_not_editable');
    const remaining = current.lines.filter((l) => l.goodId !== goodId);
    if (!remaining.length && !(current.extraLines ?? []).length) {
      await resyncDocFinance(businessId, docId, { deleted: true });
      mutateArea(AREA, (s) => {
        s.operations = s.operations.filter((op) => op.id !== docId);
      });
      pushHistory(businessId, 'operation', docId, `Документ № ${current.number} удалён (убрана последняя строка)`);
      return true;
    }
    mutateArea(AREA, (s) => {
      const doc = s.operations.find((op) => op.id === docId);
      if (!doc) return;
      doc.lines = doc.lines.filter((l) => l.goodId !== goodId);
      doc.updatedAt = nowDateTime();
    });
    pushHistory(businessId, 'operation', docId, `Строка удалена из документа № ${current.number}`);
    await resyncDocFinance(businessId, docId);
    return false;
  });
}

/** ⭐ F-08-051: «Удалить документ» целиком (наше добавление к 1:1, с журналом); Ск6: операция кассы отменяется */
export function deleteOperationDoc(businessId: Id, docId: Id): Promise<void> {
  if (isApiMode()) return Server.deleteOperationDoc(businessId, docId);
  return request(async () => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const doc = state.operations.find((op) => op.id === docId && op.businessId === businessId);
    if (!doc) throw new ApiError('not_found');
    await resyncDocFinance(businessId, docId, { deleted: true });
    mutateArea(AREA, (s) => {
      s.operations = s.operations.filter((op) => op.id !== docId);
    });
    pushHistory(businessId, 'operation', docId, `Документ № ${doc.number} удалён`);
  });
}

/** F-08-060: перемещение не редактируется — только отмена: разворотная операция move обратно */
export function cancelMoveOperation(businessId: Id, docId: Id): Promise<void> {
  if (isApiMode()) return Server.cancelMoveOperation(businessId, docId);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const doc = state.operations.find((op) => op.id === docId && op.businessId === businessId);
    if (!doc) throw new ApiError('not_found');
    if (doc.type !== 'move' || !doc.toWarehouseId) throw new ApiError('validation');
    if (doc.cancelledByDocId) throw new ApiError('already_cancelled');
    const number = nextOperationNumber(businessId);
    const reverse: OperationDoc = {
      id: newId('op'),
      businessId,
      locationId: doc.locationId,
      number,
      type: 'move',
      date: nowDateTime(),
      warehouseId: doc.toWarehouseId,
      toWarehouseId: doc.warehouseId,
      staffId: currentActor().staffId,
      paid: true,
      comment: `Отмена перемещения № ${doc.number}`,
      lines: doc.lines.map((l) => ({ goodId: l.goodId, qtySale: l.qtySale, unitPrice: l.unitPrice, costTotal: l.costTotal })),
      cancelsDocId: doc.id,
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.operations.push(reverse);
      const original = s.operations.find((op) => op.id === docId);
      if (original) original.cancelledByDocId = reverse.id;
    });
    pushHistory(businessId, 'operation', docId, `Перемещение № ${doc.number} отменено (№ ${number})`);
  });
}

/** F-08-053: выгрузка журнала складских операций в CSV (Excel) — у нас сразу файлом, без почты (обсудить) */
export function exportOperationsCsv(businessId: Id, locationId: Id, filters: OperationFilters = {}): Promise<string> {
  return request(async () => {
    const { items } = await listOperations(businessId, locationId, { ...filters, page: 1, pageSize: 10000 });
    return toCsv(
      items.map((r) => [r.number, r.date, OPERATION_TYPE_LABELS[r.type].ru, r.warehouseName, r.goodName, r.qtySale, r.saleUnit, r.costTotal, r.counterpartyOrClient, r.paid ? 'Да' : 'Нет', r.comment ?? '']),
      ['№', 'Дата', 'Тип', 'Склад', 'Товар', 'Количество', 'Единица', 'Сумма', 'Контрагент/клиент', 'Оплачено', 'Комментарий'],
    );
  });
}

// ─────────────────────────── «Заказать» (⭐ F-00-137) ───────────────────────────

export interface OrderCandidate {
  goodId: Id;
  name: string;
  sku?: string;
  unit: string;
  totalStock: number;
  criticalStock: number;
  desiredStock: number;
  /** Сколько заказать, чтобы дойти до желаемого остатка */
  toOrder: number;
}

/** ⭐ F-00-137: товары ниже критичного остатка — рабочий список «Заказать» */
export function listOrderCandidates(businessId: Id, locationId: Id): Promise<OrderCandidate[]> {
  if (isApiMode()) return Server.listOrderCandidates(businessId, locationId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    return state.goods
      .filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived && g.criticalStock > 0)
      .map((g) => ({ good: g, stock: totalStock(businessId, g.id) }))
      .filter(({ good, stock }) => stock <= good.criticalStock)
      .map(({ good, stock }) => ({
        goodId: good.id,
        name: good.name,
        sku: good.sku,
        unit: good.saleUnit,
        totalStock: stock,
        criticalStock: good.criticalStock,
        desiredStock: good.desiredStock,
        // QA 30.09: заказываем целыми единицами продажи — «8.02 флак.» поставщику не закажешь
        toOrder: Math.max(Math.ceil(roundQty(good.desiredStock - stock)), good.criticalStock > 0 ? 1 : 0),
      }));
  });
}

/** Ск15: запомненный поставщик «Заказать» (мок — в настройках склада; режим api — сервер, один на бизнес) */
export function getOrderSupplier(businessId: Id): Promise<OrderSupplier | null> {
  if (isApiMode()) return Server.getOrderSupplier(businessId);
  return request(() => readArea(AREA).settings[businessId]?.orderSupplier ?? null);
}

export function saveOrderSupplier(businessId: Id, supplier: OrderSupplier): Promise<void> {
  if (isApiMode()) return Server.saveOrderSupplier(businessId, supplier);
  return request(() => {
    const current = readArea(AREA).settings[businessId]?.orderSupplier;
    if (current && current.phone === supplier.phone && current.counterpartyId === supplier.counterpartyId && current.name === supplier.name) return;
    mutateArea(AREA, (s) => {
      s.settings[businessId] = { ...(s.settings[businessId] ?? defaultStockSettings(businessId)), orderSupplier: supplier };
    });
  });
}

/** ⭐ F-00-137: ссылка wa.me с готовым текстом заказа поставщику */
export function buildOrderWhatsAppUrl(phone: string, items: OrderCandidate[], lang: LocaleCode = 'ru'): string {
  // Владелец 01.10.2026: текст — на языке поставщика (Counterparty.messageLang; по умолчанию — язык кабинета)
  const digits = phone.replace(/\D/g, '');
  const lines = items.map((i) => `• ${i.name}${i.sku ? ` (${i.sku})` : ''} — ${i.toOrder} ${pickText(unitById(i.unit).short, lang)}`);
  const text = [pickText(ORDER_WA_GREETING, lang), ...lines].join('\n');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// ─────────────────────────── Категории (F-08-010…014) ───────────────────────────

export interface CategoryNode extends Category {
  children: CategoryNode[];
  goodsCount: number;
}

function buildTree(categories: Category[], goods: Good[], parentId: Id | undefined): CategoryNode[] {
  return categories
    .filter((c) => c.parentId === parentId && !c.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({
      ...c,
      goodsCount: goods.filter((g) => g.categoryId === c.id && !g.archived).length,
      children: buildTree(categories, goods, c.id),
    }));
}

export function listCategoryTree(businessId: Id, locationId: Id): Promise<CategoryNode[]> {
  if (isApiMode()) return Server.listCategoryTree(businessId, locationId);
  return request(() => {
    const state = readArea(AREA);
    const own = state.categories.filter((c) => c.businessId === businessId && c.locationId === locationId);
    const goods = state.goods.filter((g) => g.businessId === businessId && g.locationId === locationId);
    return buildTree(own, goods, undefined);
  });
}

export function listCategoriesFlat(businessId: Id, locationId: Id, includeArchived = false): Promise<Category[]> {
  if (isApiMode()) return Server.listCategoriesFlat(businessId, locationId, includeArchived);
  return request(() =>
    readArea(AREA)
      .categories.filter((c) => c.businessId === businessId && c.locationId === locationId && (includeArchived || !c.archived))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export interface CategoryInput {
  name: string;
  parentId?: Id;
  sku?: string;
  comment?: string;
}

export function createCategory(businessId: Id, locationId: Id, input: CategoryInput): Promise<Category> {
  if (isApiMode()) return Server.createCategory(businessId, locationId, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    const category: Category = {
      id: newId('cat'),
      businessId,
      locationId,
      name: input.name.trim(),
      parentId: input.parentId,
      sku: input.sku?.trim() || undefined,
      comment: input.comment?.trim() || undefined,
      archived: false,
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.categories.push(category);
    });
    pushHistory(businessId, 'category', category.id, `Категория «${category.name}» создана`);
    return category;
  });
}

export function updateCategory(businessId: Id, id: Id, input: CategoryInput): Promise<Category> {
  if (isApiMode()) return Server.updateCategory(businessId, id, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    // Категория не может стать собственным родителем и родителем своего предка (замкнутый цикл дерева)
    if (input.parentId === id) throw new ApiError('validation');
    let updated: Category | undefined;
    mutateArea(AREA, (s) => {
      const cat = s.categories.find((c) => c.id === id && c.businessId === businessId);
      if (!cat) throw new ApiError('not_found');
      cat.name = input.name.trim();
      cat.parentId = input.parentId;
      cat.sku = input.sku?.trim() || undefined;
      cat.comment = input.comment?.trim() || undefined;
      updated = cat;
    });
    if (!updated) throw new ApiError('not_found');
    pushHistory(businessId, 'category', id, `Категория «${updated.name}» изменена`);
    return updated;
  });
}

/** F-08-012: архивировать нельзя единственную категорию и категорию с активными подкатегориями/товарами */
export function archiveCategory(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.archiveCategory(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const cat = state.categories.find((c) => c.id === id && c.businessId === businessId);
    if (!cat) throw new ApiError('not_found');
    const siblings = state.categories.filter((c) => c.locationId === cat.locationId && !c.archived);
    if (siblings.length <= 1) throw new ApiError('last_category');
    const hasChildren = state.categories.some((c) => c.parentId === id && !c.archived);
    const hasGoods = state.goods.some((g) => g.categoryId === id && !g.archived);
    if (hasChildren || hasGoods) throw new ApiError('category_not_empty');
    mutateArea(AREA, (s) => {
      const c = s.categories.find((x) => x.id === id);
      if (c) c.archived = true;
    });
    pushHistory(businessId, 'category', id, `Категория «${cat.name}» отправлена в архив`);
  });
}

/** F-08-013: нельзя вернуть категорию из архива, пока её родитель тоже в архиве (или удалён) */
export function restoreCategory(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.restoreCategory(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const cat = state.categories.find((x) => x.id === id && x.businessId === businessId);
    if (!cat) throw new ApiError('not_found');
    if (cat.parentId) {
      const parent = state.categories.find((x) => x.id === cat.parentId);
      if (!parent || parent.archived) throw new ApiError('parent_archived');
    }
    mutateArea(AREA, (s) => {
      const c = s.categories.find((x) => x.id === id);
      if (c) c.archived = false;
    });
    pushHistory(businessId, 'category', id, `Категория «${cat.name}» восстановлена из архива`);
  });
}

/** F-08-013: восстановить пачкой — только те, чей родитель не в архиве, остальные пропускает молча (список решает, что показать) */
export function restoreCategories(businessId: Id, ids: Id[]): Promise<{ restored: Id[]; skipped: Id[] }> {
  if (isApiMode()) return Server.restoreCategories(businessId, ids);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const restored: Id[] = [];
    const skipped: Id[] = [];
    ids.forEach((id) => {
      const cat = state.categories.find((x) => x.id === id && x.businessId === businessId);
      if (!cat) return;
      const parentOk = !cat.parentId || !state.categories.find((x) => x.id === cat.parentId)?.archived;
      if (parentOk) restored.push(id);
      else skipped.push(id);
    });
    mutateArea(AREA, (s) => {
      restored.forEach((id) => {
        const c = s.categories.find((x) => x.id === id);
        if (c) c.archived = false;
      });
    });
    if (restored.length) pushHistory(businessId, 'category', restored[0], `Из архива восстановлено ${restored.length} категорий`);
    return { restored, skipped };
  });
}

/** F-08-014: нельзя удалить категорию с товарами; последнюю категорию удалить нельзя */
export function deleteCategory(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteCategory(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const cat = state.categories.find((c) => c.id === id && c.businessId === businessId);
    if (!cat) throw new ApiError('not_found');
    const siblings = state.categories.filter((c) => c.locationId === cat.locationId);
    if (siblings.length <= 1) throw new ApiError('last_category');
    const hasGoods = state.goods.some((g) => g.categoryId === id);
    if (hasGoods) throw new ApiError('category_not_empty');
    mutateArea(AREA, (s) => {
      s.categories = s.categories.filter((c) => c.id !== id);
    });
    pushHistory(businessId, 'category', id, `Категория «${cat.name}» удалена`);
  });
}

// ─────────────────────────── Товары (F-08-015…027, F-00-134, F-00-140, F-00-144) ───────────────────────────

export interface GoodRow extends Good {
  categoryName: string;
  totalStock: number;
  /** Ск8/Ск9: остаток по складам (в режиме api сервер может не прислать — тогда только totalStock) */
  levels?: StockLevel[];
  belowCritical: boolean;
  expiry: ExpiryFlag;
}

export interface ListGoodsParams {
  categoryId?: Id;
  search?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListGoodsResult {
  items: GoodRow[];
  total: number;
}

function toRow(businessId: Id, g: Good, categories: Category[]): GoodRow {
  const stock = totalStock(businessId, g.id);
  return {
    ...g,
    categoryName: categories.find((c) => c.id === g.categoryId)?.name ?? '',
    totalStock: stock,
    levels: computeLevels(businessId, g.id),
    belowCritical: g.criticalStock > 0 && stock <= g.criticalStock,
    expiry: computeExpiryFlag(g.expiryDate, todayISO()),
  };
}

function inSubtree(categories: Category[], rootId: Id, id: Id): boolean {
  if (id === rootId) return true;
  const cat = categories.find((c) => c.id === id);
  if (!cat?.parentId) return false;
  return inSubtree(categories, rootId, cat.parentId);
}

/** F-08-015/016: список «Все товары» — поиск по названию, штрихкоду, артикулу; фильтр по категории (с подкатегориями) */
export function listGoods(businessId: Id, locationId: Id, params: ListGoodsParams = {}): Promise<ListGoodsResult> {
  if (isApiMode()) return Server.listGoods(businessId, locationId, params);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const categories = state.categories.filter((c) => c.locationId === locationId);
    let items = state.goods.filter((g) => g.businessId === businessId && g.locationId === locationId && (params.includeArchived || !g.archived));
    if (params.categoryId) {
      items = items.filter((g) => inSubtree(categories, params.categoryId!, g.categoryId));
    }
    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      items = items.filter((g) => g.name.toLowerCase().includes(q) || g.barcode?.includes(q) || g.sku?.toLowerCase().includes(q));
    }
    const rows = items.map((g) => toRow(businessId, g, categories)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = rows.length;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    return { items: rows.slice(start, start + pageSize), total };
  });
}

/** Быстрый поиск товара по названию/артикулу/штрихкоду — для строк операций, техкарт, продажи, вклада в окно записи (F-08-016) */
export function searchGoods(businessId: Id, locationId: Id, query: string, limit = 20): Promise<GoodRow[]> {
  if (isApiMode()) return Server.searchGoods(businessId, locationId, query, limit);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const categories = state.categories.filter((c) => c.locationId === locationId);
    const q = query.trim().toLowerCase();
    const items = state.goods.filter(
      (g) =>
        g.businessId === businessId &&
        g.locationId === locationId &&
        !g.archived &&
        (!q || g.name.toLowerCase().includes(q) || g.barcode?.includes(q) || g.sku?.toLowerCase().includes(q)),
    );
    return items.slice(0, limit).map((g) => toRow(businessId, g, categories));
  });
}

export function getGood(businessId: Id, id: Id): Promise<(GoodRow & { levels: StockLevel[] }) | undefined> {
  if (isApiMode()) return Server.getGood(businessId, id).then((g) => (g && apiLevelsCache.set(g.id, g.levels), g));
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const good = state.goods.find((g) => g.id === id && g.businessId === businessId);
    if (!good) return undefined;
    const categories = state.categories.filter((c) => c.locationId === good.locationId);
    return { ...toRow(businessId, good, categories), levels: computeLevels(businessId, id) };
  });
}

export function listGoodHistory(businessId: Id, goodId: Id) {
  if (isApiMode()) return Server.listGoodHistory(businessId, goodId);
  return request(() =>
    readArea(AREA)
      .history.filter((h) => h.businessId === businessId && h.entityType === 'good' && h.entityId === goodId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

export type GoodInput = Omit<Good, 'id' | 'businessId' | 'locationId' | 'archived' | 'createdAt' | 'updatedAt'>;

/** F-08-019, решение F-08-147: штрихкод уникален в пределах бизнеса — иначе поиск сканом находит не тот товар */
function assertBarcodeFree(businessId: Id, barcode: string | undefined, excludeGoodId?: Id) {
  if (!barcode) return;
  const dupe = readArea(AREA).goods.find((g) => g.businessId === businessId && g.id !== excludeGoodId && g.barcode === barcode);
  if (dupe) throw new ApiError('barcode_in_use');
}

export function createGood(businessId: Id, locationId: Id, input: GoodInput): Promise<Good> {
  if (isApiMode()) return Server.createGood(businessId, locationId, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    assertBarcodeFree(businessId, input.barcode);
    const good: Good = { ...newGoodDefaults(), ...input, id: newId('gd'), businessId, locationId, name: input.name.trim(), archived: false, createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.goods.push(good);
    });
    pushHistory(businessId, 'good', good.id, `Товар «${good.name}» создан`);
    return good;
  });
}

export function updateGood(businessId: Id, id: Id, input: GoodInput): Promise<Good> {
  if (isApiMode()) return Server.updateGood(businessId, id, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    assertBarcodeFree(businessId, input.barcode, id);
    let updated: Good | undefined;
    const changedFields: string[] = [];
    mutateArea(AREA, (s) => {
      const good = s.goods.find((g) => g.id === id && g.businessId === businessId);
      if (!good) throw new ApiError('not_found');
      if (good.salePrice !== input.salePrice) changedFields.push('цена продажи');
      if (good.costPrice !== input.costPrice) changedFields.push('себестоимость');
      Object.assign(good, input, { name: input.name.trim(), updatedAt: nowDateTime() });
      updated = good;
    });
    if (!updated) throw new ApiError('not_found');
    // ⭐ F-00-040: каждая правка (особенно цены) — строкой в журнал изменений
    pushHistory(businessId, 'good', id, changedFields.length ? `Изменено: ${changedFields.join(', ')}` : `Товар «${updated.name}» изменён`);
    return updated;
  });
}

/** F-08-028: архивировать нельзя товар, входящий в техкарту или продажу абонемента/сертификата (техкарты — b03, здесь не проверяем) */
/** F-08-028: товар в чьей-то техкарте не архивируется молча — как deleteGood, бросает `good_in_use` (причина видна в диалоге) */
export function archiveGood(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.archiveGood(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const usedInTechCard = state.techCards.some((c) => c.lines.some((l) => l.goodId === id));
    if (usedInTechCard) throw new ApiError('good_in_use');
    let name = '';
    mutateArea(AREA, (s) => {
      const good = s.goods.find((g) => g.id === id && g.businessId === businessId);
      if (!good) throw new ApiError('not_found');
      good.archived = true;
      name = good.name;
    });
    pushHistory(businessId, 'good', id, `Товар «${name}» отправлен в архив`);
  });
}

/** F-08-015/F-08-028: «Архивировать выбранные» — та же операция сразу для отмеченных строк; товары из техкарт пропускаются (не архивируются молча) */
export function archiveGoods(businessId: Id, ids: Id[]): Promise<{ archived: Id[]; skipped: Id[] }> {
  if (isApiMode()) return Server.archiveGoods(businessId, ids);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const skipped = ids.filter((id) => state.techCards.some((c) => c.lines.some((l) => l.goodId === id)));
    const archived = ids.filter((id) => !skipped.includes(id));
    mutateArea(AREA, (s) => {
      archived.forEach((id) => {
        const good = s.goods.find((g) => g.id === id && g.businessId === businessId);
        if (good) good.archived = true;
      });
    });
    if (archived.length) pushHistory(businessId, 'good', archived[0], `В архив отправлено ${archived.length} товаров`);
    return { archived, skipped };
  });
}

/** F-08-015: «Быстрое управление» — правит одно-два поля у всех отмеченных сразу, остальные не трогает */
export function quickUpdateGoods(businessId: Id, ids: Id[], patch: { salePrice?: number; criticalStock?: number; desiredStock?: number }): Promise<void> {
  if (isApiMode()) return Server.quickUpdateGoods(businessId, ids, patch);
  return request(() => {
    assertCan('stock.edit');
    mutateArea(AREA, (s) => {
      ids.forEach((id) => {
        const good = s.goods.find((g) => g.id === id && g.businessId === businessId);
        if (!good) return;
        if (patch.salePrice !== undefined) good.salePrice = patch.salePrice;
        if (patch.criticalStock !== undefined) good.criticalStock = patch.criticalStock;
        if (patch.desiredStock !== undefined) good.desiredStock = patch.desiredStock;
        good.updatedAt = nowDateTime();
      });
    });
    pushHistory(businessId, 'good', ids[0] ?? '', `Быстрое управление применено к ${ids.length} товарам`);
  });
}

/** F-08-029: не восстановить товар, пока его категория в архиве; при совпадении названия с активным товаром — метка «[Восстановлено]» */
export function restoreGood(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.restoreGood(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const good = state.goods.find((g) => g.id === id && g.businessId === businessId);
    if (!good) throw new ApiError('not_found');
    const category = state.categories.find((c) => c.id === good.categoryId);
    if (category?.archived) throw new ApiError('category_archived');
    const nameTaken = state.goods.some((g) => g.id !== id && !g.archived && g.locationId === good.locationId && g.name === good.name);
    mutateArea(AREA, (s) => {
      const g = s.goods.find((x) => x.id === id);
      if (!g) return;
      g.archived = false;
      if (nameTaken && !g.name.endsWith('[Восстановлено]')) g.name = `${g.name} [Восстановлено]`;
    });
    pushHistory(businessId, 'good', id, `Товар «${good.name}» восстановлен из архива`);
  });
}

/**
 * F-08-029: восстановить пачкой — товары с архивной категорией пропускаются. `markRestored` — переключатель
 * окна восстановления: false (по умолчанию, «Не добавлять») ставит суффикс только при реальном конфликте
 * названия с активным товаром; true («Добавлять [Восстановлено] в название») ставит его у всех восстановленных.
 */
export function restoreGoods(businessId: Id, ids: Id[], markRestored = false): Promise<{ restored: Id[]; skipped: Id[] }> {
  if (isApiMode()) return Server.restoreGoods(businessId, ids, markRestored);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const restored: Id[] = [];
    const skipped: Id[] = [];
    ids.forEach((id) => {
      const good = state.goods.find((g) => g.id === id && g.businessId === businessId);
      if (!good) return;
      const category = state.categories.find((c) => c.id === good.categoryId);
      if (category?.archived) skipped.push(id);
      else restored.push(id);
    });
    mutateArea(AREA, (s) => {
      restored.forEach((id) => {
        const g = s.goods.find((x) => x.id === id);
        if (!g) return;
        const nameTaken = s.goods.some((o) => o.id !== id && !o.archived && o.locationId === g.locationId && o.name === g.name);
        g.archived = false;
        if ((markRestored || nameTaken) && !g.name.endsWith('[Восстановлено]')) g.name = `${g.name} [Восстановлено]`;
      });
    });
    if (restored.length) pushHistory(businessId, 'good', restored[0], `Из архива восстановлено ${restored.length} товаров`);
    return { restored, skipped };
  });
}

/**
 * F-08-030: удаление товара необратимо — подтверждение вводом слова делает экран (⭐ F-00-061). Товар,
 * используемый в чьей-то техкарте, не удаляется — только архивируется (решение проверки 1, F-08-147).
 */
export function deleteGood(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteGood(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const good = state.goods.find((g) => g.id === id && g.businessId === businessId);
    if (!good) throw new ApiError('not_found');
    const usedInTechCard = state.techCards.some((c) => c.lines.some((l) => l.goodId === id));
    if (usedInTechCard) throw new ApiError('good_in_use');
    mutateArea(AREA, (s) => {
      s.goods = s.goods.filter((g) => g.id !== id);
    });
    pushHistory(businessId, 'good', id, `Товар «${good.name}» удалён насовсем`);
  });
}

/** F-08-019: генерация штрихкода EAN-13 (собственный товарный код 2 + случайные 10 цифр + контрольная цифра) */
export function generateBarcode(): string {
  const body = '2' + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
  const digits = body.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return body + check;
}

/** F-08-017 §Логика: копирование товара в другие локации сети (видна только когда есть >1 локация) */
export function copyGoodToLocations(businessId: Id, goodId: Id, targetLocationIds: Id[]): Promise<Good[]> {
  if (isApiMode()) return Server.copyGoodToLocations(businessId, goodId, targetLocationIds);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const source = state.goods.find((g) => g.id === goodId && g.businessId === businessId);
    if (!source) throw new ApiError('not_found');
    const created: Good[] = [];
    mutateArea(AREA, (s) => {
      targetLocationIds.forEach((locationId) => {
        // Категория с тем же названием в целевой локации, иначе — «Основные товары» этой локации
        const targetCategory =
          s.categories.find((c) => c.locationId === locationId && c.name === source.name) ??
          s.categories.find((c) => c.locationId === locationId && c.name === ROOT_CATEGORY_NAME) ??
          s.categories.find((c) => c.locationId === locationId);
        if (!targetCategory) return;
        const copy: Good = { ...source, id: newId('gd'), locationId, categoryId: targetCategory.id, createdAt: nowDateTime(), updatedAt: undefined };
        s.goods.push(copy);
        created.push(copy);
      });
    });
    return created;
  });
}

// ─────────────────────────── Журнал складских операций (F-08-046…048) ───────────────────────────

export interface OperationFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: OperationType;
  warehouseId?: Id;
  search?: string;
  counterparty?: string;
  clientSearch?: string;
  docNumber?: string;
  /** F-08-046: «Услуга с расходником» — только списания, относящиеся к этой услуге */
  serviceId?: Id;
  paid?: 'paid' | 'unpaid';
  /** Ск2: «Движение товара» — строки только этого товара */
  goodId?: Id;
  page?: number;
  pageSize?: number;
}

export interface OperationRow {
  docId: Id;
  number: string;
  type: OperationType;
  date: string;
  warehouseId: Id;
  warehouseName: string;
  toWarehouseName?: string;
  counterpartyOrClient: string;
  comment?: string;
  goodId: Id;
  goodName: string;
  qtySale: number;
  saleUnit: string;
  costTotal: Money;
  /** Ск14: себестоимость строки на дату операции (qty × цена последнего прихода до неё) — у продажи costTotal это выручка */
  costValue: Money;
  stockAfter: number;
  clientId?: Id;
  bookingId?: Id;
  paid: boolean;
}

export interface ListOperationsResult {
  items: OperationRow[];
  total: number;
}

export function listOperations(businessId: Id, locationId: Id, filters: OperationFilters = {}): Promise<ListOperationsResult> {
  if (isApiMode()) return Server.listOperationRows(businessId, locationId, filters);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const core = readCore();
    const goods = state.goods.filter((g) => g.locationId === locationId);
    const warehouses = state.warehouses.filter((w) => w.locationId === locationId);
    const docs = state.operations
      .filter((op) => op.businessId === businessId && op.locationId === locationId)
      .filter((op) => (filters.type ? op.type === filters.type : true))
      .filter((op) => (filters.warehouseId ? op.warehouseId === filters.warehouseId || op.toWarehouseId === filters.warehouseId : true))
      .filter((op) => (filters.dateFrom ? op.date >= filters.dateFrom : true))
      .filter((op) => (filters.dateTo ? op.date <= filters.dateTo + 'T23:59' : true))
      .filter((op) => (filters.docNumber ? op.number.includes(filters.docNumber.trim()) : true))
      .filter((op) => (filters.paid === 'paid' ? op.paid : filters.paid === 'unpaid' ? !op.paid : true))
      .filter((op) => (filters.serviceId ? op.serviceId === filters.serviceId : true))
      .filter((op) => (filters.counterparty ? (op.counterpartyName ?? '').toLowerCase().includes(filters.counterparty.toLowerCase()) : true));

    // Хронологический остаток по товару/складу — для колонки «Остаток на складе после операции» (F-08-047)
    const runningByGoodWarehouse = new Map<string, number>();
    const allDocsSorted = [...state.operations.filter((op) => op.businessId === businessId)].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const stockAfterMap = new Map<string, number>();
    // Ск14: себестоимость на дату — цена последнего прихода к этому моменту, иначе себестоимость из карточки
    const lastIncomePrice = new Map<Id, Money>();
    const unitCostAt = new Map<string, Money>();
    allDocsSorted.forEach((op) => {
      op.lines.forEach((l) => {
        if (op.type === 'income' && !op.inventoryId && !op.cancelsDocId) lastIncomePrice.set(l.goodId, applyDiscount(l.unitPrice, l.discountPct));
        unitCostAt.set(`${op.id}__${l.goodId}`, lastIncomePrice.get(l.goodId) ?? state.goods.find((g) => g.id === l.goodId)?.costPrice ?? 0);
        const key = `${l.goodId}__${op.warehouseId}`;
        const next = (runningByGoodWarehouse.get(key) ?? 0) + l.qtySale;
        runningByGoodWarehouse.set(key, next);
        stockAfterMap.set(`${op.id}__${l.goodId}`, next);
        if (op.type === 'move' && op.toWarehouseId) {
          const toKey = `${l.goodId}__${op.toWarehouseId}`;
          const toNext = (runningByGoodWarehouse.get(toKey) ?? 0) + Math.abs(l.qtySale);
          runningByGoodWarehouse.set(toKey, toNext);
        }
      });
    });

    let rows: OperationRow[] = [];
    docs.forEach((op) => {
      const warehouse = warehouses.find((w) => w.id === op.warehouseId);
      const toWarehouse = op.toWarehouseId ? warehouses.find((w) => w.id === op.toWarehouseId) : undefined;
      const client = op.clientId ? core.clients.find((c) => c.id === op.clientId) : undefined;
      op.lines.forEach((line) => {
        const good = goods.find((g) => g.id === line.goodId);
        if (!good) return;
        if (filters.goodId && good.id !== filters.goodId) return;
        if (filters.search?.trim()) {
          const q = filters.search.trim().toLowerCase();
          if (!good.name.toLowerCase().includes(q) && !good.sku?.toLowerCase().includes(q)) return;
        }
        if (filters.clientSearch?.trim()) {
          const q = filters.clientSearch.trim().toLowerCase();
          const matches = client && (client.name.toLowerCase().includes(q) || client.phone.includes(q));
          if (!matches) return;
        }
        rows.push({
          docId: op.id,
          number: op.number,
          type: op.type,
          date: op.date,
          warehouseId: op.warehouseId,
          warehouseName: warehouse?.name ?? '',
          toWarehouseName: toWarehouse?.name,
          counterpartyOrClient: client?.name ?? op.counterpartyName ?? '',
          comment: op.comment,
          goodId: good.id,
          goodName: good.name,
          qtySale: line.qtySale,
          saleUnit: good.saleUnit,
          costTotal: line.costTotal,
          costValue: Math.round(Math.abs(line.qtySale) * (unitCostAt.get(`${op.id}__${good.id}`) ?? good.costPrice)),
          stockAfter: roundQty(stockAfterMap.get(`${op.id}__${good.id}`) ?? 0),
          clientId: op.clientId,
          bookingId: op.bookingId,
          paid: op.paid,
        });
      });
    });
    rows = rows.sort((a, b) => b.date.localeCompare(a.date) || Number(b.number) - Number(a.number));
    const total = rows.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    return { items: rows.slice(start, start + pageSize), total };
  });
}

// ─────────────────────────── Ск14: движение за период и расход против нормы техкарт ───────────────────────────

export interface MovementReportRow {
  goodId: Id;
  name: string;
  sku?: string;
  unit: string;
  /** Остаток на начало периода (все операции до dateFrom) */
  startQty: number;
  /** Пришло за период: приходы, излишки инвентаризации, возвраты */
  incomeQty: number;
  /** Ушло за период: продажи, списания, расход по услугам */
  outQty: number;
  endQty: number;
  /** Конечный остаток в деньгах по себестоимости */
  endValue: Money;
}

/**
 * Ск14 «движение за период»: начало / приход / расход / конец по каждому товару локации. Перемещения
 * между складами одной локации в сумме нулевые — не считаются ни приходом, ни расходом (если склад
 * выбран — считаются: пришло на него / ушло с него).
 */
export function getMovementReport(businessId: Id, locationId: Id, dateFrom: string, dateTo: string, warehouseId?: Id): Promise<MovementReportRow[]> {
  if (isApiMode()) return Server.getMovementReport(businessId, locationId, dateFrom, dateTo, warehouseId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const to = `${dateTo}T23:59`;
    const acc = new Map<Id, { start: number; income: number; out: number }>();
    const touch = (goodId: Id) => {
      let entry = acc.get(goodId);
      if (!entry) {
        entry = { start: 0, income: 0, out: 0 };
        acc.set(goodId, entry);
      }
      return entry;
    };
    state.operations
      .filter((op) => op.businessId === businessId && op.locationId === locationId && op.date <= to)
      .forEach((op) => {
        const before = op.date < dateFrom;
        op.lines.forEach((l) => {
          const entry = touch(l.goodId);
          const legs: { warehouseId: Id; qty: number }[] =
            op.type === 'move' && op.toWarehouseId
              ? [
                  { warehouseId: op.warehouseId, qty: -Math.abs(l.qtySale) },
                  { warehouseId: op.toWarehouseId, qty: Math.abs(l.qtySale) },
                ]
              : [{ warehouseId: op.warehouseId, qty: l.qtySale }];
          legs.forEach((leg) => {
            if (warehouseId && leg.warehouseId !== warehouseId) return;
            if (!warehouseId && op.type === 'move') return;
            if (before) entry.start += leg.qty;
            else if (leg.qty > 0) entry.income += leg.qty;
            else entry.out += -leg.qty;
          });
        });
      });
    return state.goods
      .filter((g) => g.businessId === businessId && g.locationId === locationId && acc.has(g.id))
      .map((g) => {
        const e = acc.get(g.id)!;
        const startQty = roundQty(e.start);
        const incomeQty = roundQty(e.income);
        const outQty = roundQty(e.out);
        const endQty = roundQty(startQty + incomeQty - outQty);
        return { goodId: g.id, name: g.name, sku: g.sku, unit: g.saleUnit, startQty, incomeQty, outQty, endQty, endValue: Math.round(endQty * g.costPrice) };
      })
      .filter((r) => r.startQty !== 0 || r.incomeQty !== 0 || r.outQty !== 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export interface ConsumablesAnalysisRow {
  goodId: Id;
  name: string;
  /** Единица списания (мл, г…) — в ней и норма, и факт */
  writeoffUnit: string;
  /** Сколько положено по техкартам мастеров за визиты «пришёл» в периоде */
  normQty: number;
  /** Сколько реально списано документами «Списание расходников» (норма + ручные правки) */
  actualQty: number;
  /** факт − норма: плюс — перерасход */
  diffQty: number;
  actualCost: Money;
}

/** Ск14 «Анализ расхода»: факт списания расходников против нормы техкарт за период, в единицах списания */
export function getConsumablesAnalysis(businessId: Id, locationId: Id, dateFrom: string, dateTo: string): Promise<ConsumablesAnalysisRow[]> {
  if (isApiMode()) return Server.getConsumablesAnalysis(businessId, locationId, dateFrom, dateTo);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const core = readCore();
    const to = `${dateTo}T23:59`;
    const inRange = (date: string) => date >= dateFrom && date <= to;
    const norm = new Map<Id, number>();
    core.bookings
      .filter((b) => b.businessId === businessId && b.locationId === locationId && !b.deletedAt && b.status === 'arrived' && inRange(b.start))
      .forEach((b) => {
        b.services.forEach((line) => {
          const card = state.techCards.find((c) => c.businessId === businessId && c.serviceId === line.serviceId && c.staffId === line.staffId);
          card?.lines.forEach((tl) => norm.set(tl.goodId, (norm.get(tl.goodId) ?? 0) + tl.qtyWriteoff * line.qty));
        });
      });
    const actual = new Map<Id, { qty: number; cost: number }>();
    state.operations
      .filter((op) => op.businessId === businessId && op.locationId === locationId && op.type === 'writeoffService' && inRange(op.date))
      .forEach((op) => {
        op.lines.forEach((l) => {
          const good = state.goods.find((g) => g.id === l.goodId);
          const ratio = good?.unitRatio || 1;
          const entry = actual.get(l.goodId) ?? { qty: 0, cost: 0 };
          entry.qty += Math.abs(l.qtySale) * ratio;
          entry.cost += Math.abs(l.costTotal);
          actual.set(l.goodId, entry);
        });
      });
    const ids = new Set([...norm.keys(), ...actual.keys()]);
    return Array.from(ids)
      .map((goodId) => {
        const good = state.goods.find((g) => g.id === goodId);
        const normQty = roundQty(norm.get(goodId) ?? 0);
        const actualQty = roundQty(actual.get(goodId)?.qty ?? 0);
        return {
          goodId,
          name: good?.name ?? '',
          writeoffUnit: good?.writeoffUnit ?? 'pcs',
          normQty,
          actualQty,
          diffQty: roundQty(actualQty - normQty),
          actualCost: Math.round(actual.get(goodId)?.cost ?? 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Товар, проданный клиенту одной продажей (F-08-137, F-14-024) — источник для приложения клиента */
export interface ProductSaleRow {
  docId: Id;
  bookingId?: Id;
  date: string;
  goodName: string;
  qty: number;
  unitPrice: Money;
  discountPct?: number;
  total: Money;
  paid: boolean;
}

/**
 * F-08-137 (⭐ решение 00 §12/19): товары, купленные клиентом через окно продажи (документ type='sale'), — то,
 * что должно показывать приложение клиента в оплаченном визите. Проданное из журнала без визита или складской
 * операцией (не продажа) клиент не видит (1545) — здесь и не появляется, тип фильтруется строго.
 */
export function listProductSales(businessId: Id, clientId: Id): Promise<ProductSaleRow[]> {
  if (isApiMode()) return Server.listProductSales(businessId, clientId);
  return request(() => {
    const state = readArea(AREA);
    const rows: ProductSaleRow[] = [];
    state.operations
      .filter((op) => op.businessId === businessId && op.type === 'sale' && op.clientId === clientId)
      .forEach((op) => {
        op.lines.forEach((line) => {
          const good = state.goods.find((g) => g.id === line.goodId);
          if (!good) return;
          rows.push({
            docId: op.id,
            bookingId: op.bookingId,
            date: op.date,
            goodName: good.name,
            qty: Math.abs(line.qtySale),
            unitPrice: line.unitPrice,
            discountPct: line.discountPct,
            total: Math.abs(line.costTotal),
            paid: op.paid,
          });
        });
      });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });
}

// ─────────────────────────── Покупки клиента (F-08-151) ───────────────────────────

/** Строка покупки товара клиентом — как `ProductSaleRow`, но без фильтра по визиту (⭐ решение ниже) */
export interface ClientPurchaseRow {
  docId: Id;
  bookingId?: Id;
  /** ⭐ F-08-151: продажа без визита (нет bookingId) — панель продажи, не окно записи */
  standalone: boolean;
  date: string;
  goodName: string;
  qty: number;
  unitPrice: Money;
  discountPct?: number;
  total: Money;
  paid: boolean;
}

export interface ClientPurchaseSummary {
  /** «Продано, ֏» карточки клиента (⭐ решение F-08-151, см. ниже) */
  totalSold: Money;
  /** «Оплачено в кассу, ֏» */
  totalPaid: Money;
  /** Визитов с продажей товара (продажа без визита визитом не считается — CYCLE-09) */
  visitCount: number;
  rows: ClientPurchaseRow[];
}

/**
 * F-08-151 «покупки товара видны в карточке клиента (Продано + история)» + ❓ «входит ли продажа без визита
 * в „Продано”». ⭐ Наше решение (прогон CYCLE-09/CYCLE-REPORT показал, что входит: «Продано 3 734» = визит
 * 734 + товар 3 000 без визита): да, `getClientPurchaseSummary.totalSold` включает продажи без визита —
 * `listProductSales` (F-08-137, приложение клиента) их сознательно НЕ показывает (1545), это отдельная,
 * более узкая выборка только для клиента, здесь трогать нельзя.
 * Владеет экраном `clients` (карточка клиента) — пары `clientCard`/`stock` в фундаменте ещё нет
 * (qa/requests/stock.md), поэтому здесь же временный экран `/biz/stock/clients` для владельца/админа.
 */
export function getClientPurchaseSummary(businessId: Id, clientId: Id): Promise<ClientPurchaseSummary> {
  if (isApiMode()) return Server.getClientPurchaseSummary(businessId, clientId);
  return request(() => {
    const state = readArea(AREA);
    const rows: ClientPurchaseRow[] = [];
    const bookingIds = new Set<Id>();
    state.operations
      .filter((op) => op.businessId === businessId && op.type === 'sale' && op.clientId === clientId)
      .forEach((op) => {
        if (op.bookingId) bookingIds.add(op.bookingId);
        op.lines.forEach((line) => {
          const good = state.goods.find((g) => g.id === line.goodId);
          if (!good) return;
          rows.push({
            docId: op.id,
            bookingId: op.bookingId,
            standalone: !op.bookingId,
            date: op.date,
            goodName: good.name,
            qty: Math.abs(line.qtySale),
            unitPrice: line.unitPrice,
            discountPct: line.discountPct,
            total: Math.abs(line.costTotal),
            paid: op.paid,
          });
        });
      });
    rows.sort((a, b) => b.date.localeCompare(a.date));
    const totalSold = rows.reduce((sum, r) => sum + r.total, 0);
    const totalPaid = rows.filter((r) => r.paid).reduce((sum, r) => sum + r.total, 0);
    return { totalSold, totalPaid, visitCount: bookingIds.size, rows };
  });
}

export interface ClientPurchaseSearchRow {
  id: Id;
  name: string;
  phone: string;
}

/** Поиск клиента по имени/телефону (F-08-151 — поиск клиента в журнале нужен той же формы; здесь — свой временный) */
export function searchClientsForPurchases(businessId: Id, query: string): Promise<ClientPurchaseSearchRow[]> {
  if (isApiMode()) return Server.searchClientsForPurchases(businessId, query);
  return request(() => {
    const q = query.trim().toLowerCase();
    const list = readCore().clients.filter((c) => c.businessId === businessId && !c.deletedAt);
    const filtered = q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : list;
    return filtered.slice(0, 25).map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  });
}

// ─────────────────────────── Оборудование (F-00-141) ───────────────────────────

export function listEquipment(businessId: Id, locationId: Id, includeArchived = false): Promise<EquipmentItem[]> {
  if (isApiMode()) return Server.listEquipment(businessId, locationId, includeArchived);
  return request(() =>
    readArea(AREA)
      .equipment.filter((e) => e.businessId === businessId && e.locationId === locationId && (includeArchived || !e.archived))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function getEquipment(businessId: Id, id: Id): Promise<EquipmentItem | undefined> {
  if (isApiMode()) return Server.getEquipment(businessId, id);
  return request(() => readArea(AREA).equipment.find((e) => e.id === id && e.businessId === businessId));
}

export type EquipmentInput = Omit<EquipmentItem, 'id' | 'businessId' | 'locationId' | 'archived' | 'createdAt'>;

export function createEquipment(businessId: Id, locationId: Id, input: EquipmentInput): Promise<EquipmentItem> {
  if (isApiMode()) return Server.createEquipment(businessId, locationId, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    const item: EquipmentItem = { ...input, id: newId('eq'), businessId, locationId, name: input.name.trim(), archived: false, createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.equipment.push(item);
    });
    pushHistory(businessId, 'equipment', item.id, `Оборудование «${item.name}» добавлено`);
    return item;
  });
}

export function updateEquipment(businessId: Id, id: Id, input: EquipmentInput): Promise<EquipmentItem> {
  if (isApiMode()) return Server.updateEquipment(businessId, id, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.name.trim()) throw new ApiError('validation');
    let updated: EquipmentItem | undefined;
    mutateArea(AREA, (s) => {
      const item = s.equipment.find((e) => e.id === id && e.businessId === businessId);
      if (!item) throw new ApiError('not_found');
      Object.assign(item, input, { name: input.name.trim() });
      updated = item;
    });
    if (!updated) throw new ApiError('not_found');
    pushHistory(businessId, 'equipment', id, `Оборудование «${updated.name}» изменено`);
    return updated;
  });
}

export function deleteEquipment(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteEquipment(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const item = state.equipment.find((e) => e.id === id && e.businessId === businessId);
    if (!item) throw new ApiError('not_found');
    mutateArea(AREA, (s) => {
      s.equipment = s.equipment.filter((e) => e.id !== id);
    });
    pushHistory(businessId, 'equipment', id, `Оборудование «${item.name}» удалено`);
  });
}

// ─────────────────────────── F-08-024/025: сводка для «пора заказывать» (используется каталогом) ───────────────────────────

export function countBelowCritical(businessId: Id, locationId: Id): Promise<number> {
  if (isApiMode()) return Server.countBelowCritical(businessId, locationId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    return state.goods.filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived && g.criticalStock > 0 && totalStock(businessId, g.id) <= g.criticalStock).length;
  });
}

// ─────────────────────────── Инвентаризация (F-08-079…089, F-00-135) ───────────────────────────

function nextInventoryNumber(businessId: Id): string {
  const state = readArea(AREA);
  const max = state.inventories.filter((i) => i.businessId === businessId).reduce((m, i) => Math.max(m, Number(i.number) || 0), 500000);
  return String(max + 1);
}

/** Товары в области инвентаризации (склад + категория) с остатком именно на этом складе */
function scopeGoodIds(state: ReturnType<typeof readArea<typeof AREA>>, businessId: Id, warehouseId: Id, categoryId?: Id): { good: Good; calcQty: number }[] {
  const categories = state.categories.filter((c) => c.businessId === businessId);
  return state.goods
    .filter((g) => g.businessId === businessId && !g.archived && (!categoryId || inSubtree(categories, categoryId, g.categoryId)))
    .map((g) => ({ good: g, calcQty: computeLevels(businessId, g.id).find((l) => l.warehouseId === warehouseId)?.qty ?? 0 }))
    .filter(({ calcQty }) => calcQty !== 0);
}

export interface InventoryRow extends Inventory {
  warehouseName: string;
  categoryName?: string;
  goodsCount: number;
}

/** F-08-079: список инвентаризаций */
export function listInventories(businessId: Id, locationId: Id): Promise<InventoryRow[]> {
  if (isApiMode()) return Server.listInventories(businessId, locationId);
  return request(() => {
    const state = readArea(AREA);
    return state.inventories
      .filter((i) => i.businessId === businessId && i.locationId === locationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({
        ...i,
        warehouseName: state.warehouses.find((w) => w.id === i.warehouseId)?.name ?? '',
        categoryName: i.categoryId ? state.categories.find((c) => c.id === i.categoryId)?.name : undefined,
        goodsCount: i.lines.length,
      }));
  });
}

export interface InventoryLineRow extends InventoryLine {
  goodName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  /** Ск12: единица списания и сколько её в единице продажи — ввод факта «в мл» для вскрытого флакона */
  writeoffUnit?: string;
  unitRatio?: number;
  massNetG?: number;
  massGrossG?: number;
  diff: number;
}

export interface InventoryDetail extends InventoryRow {
  lineRows: InventoryLineRow[];
}

export function getInventory(businessId: Id, id: Id): Promise<InventoryDetail | undefined> {
  if (isApiMode()) return Server.getInventory(businessId, id);
  return request(() => {
    const state = readArea(AREA);
    const found = state.inventories.find((i) => i.id === id && i.businessId === businessId);
    if (!found) return undefined;
    // Ск4: пока ведомость не проведена, «Расчёт» живой — текущий остаток склада, а не снимок при создании
    if (found.status === 'draft') syncAutoWriteoffs(businessId);
    const inv: Inventory =
      found.status === 'draft' ? { ...found, lines: found.lines.map((l) => ({ ...l, calcQty: levelAt(businessId, l.goodId, found.warehouseId) })) } : found;
    return {
      ...inv,
      warehouseName: state.warehouses.find((w) => w.id === inv.warehouseId)?.name ?? '',
      categoryName: inv.categoryId ? state.categories.find((c) => c.id === inv.categoryId)?.name : undefined,
      goodsCount: inv.lines.length,
      lineRows: inv.lines.map((l) => {
        const good = state.goods.find((g) => g.id === l.goodId);
        return {
          ...l,
          goodName: good?.name ?? '',
          sku: good?.sku,
          barcode: good?.barcode,
          unit: good?.saleUnit ?? 'pcs',
          writeoffUnit: good?.writeoffUnit,
          unitRatio: good?.unitRatio,
          massNetG: good?.massNetG,
          massGrossG: good?.massGrossG,
          diff: inventoryDiff(l),
        };
      }),
    };
  });
}

export interface CreateInventoryInput {
  warehouseId: Id;
  categoryId?: Id;
  comment?: string;
  /** F-08-081: штрихкод → сколько раз встретился в файле = фактический остаток */
  barcodeCounts?: Record<string, number>;
  missingBehavior?: 'zero' | 'calc';
}

/** F-08-080/081: новая инвентаризация — снимок расчётного остатка на текущий момент */
export function createInventory(businessId: Id, locationId: Id, input: CreateInventoryInput): Promise<Inventory> {
  if (isApiMode()) return Server.createInventory(businessId, locationId, input);
  return request(() => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    if (!input.warehouseId) throw new ApiError('validation');
    const state = readArea(AREA);
    const scoped = scopeGoodIds(state, businessId, input.warehouseId, input.categoryId);
    const barcodeCounts = input.barcodeCounts;
    const lines: InventoryLine[] = scoped.map(({ good, calcQty }) => {
      if (!barcodeCounts) return { goodId: good.id, calcQty };
      const count = good.barcode ? barcodeCounts[good.barcode] : undefined;
      const actualQty = count ?? (input.missingBehavior === 'calc' ? calcQty : 0);
      return { goodId: good.id, calcQty, actualQty };
    });
    const number = nextInventoryNumber(businessId);
    const inv: Inventory = {
      id: newId('inv'),
      businessId,
      locationId,
      number,
      warehouseId: input.warehouseId,
      categoryId: input.categoryId,
      date: nowDateTime(),
      comment: input.comment?.trim() || undefined,
      status: 'draft',
      lines,
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.inventories.push(inv);
    });
    pushHistory(businessId, 'operation', inv.id, `Инвентаризация № ${number} создана`);
    return inv;
  });
}

function requireDraftInventory(businessId: Id, id: Id) {
  const state = readArea(AREA);
  const inv = state.inventories.find((i) => i.id === id && i.businessId === businessId);
  if (!inv) throw new ApiError('not_found');
  if (inv.status === 'done') throw new ApiError('inventory_done');
  return inv;
}

/** F-08-082/086: ввод фактического остатка одной строки; undefined — «ещё не считали» (Ск11: пусто ≠ 0) */
export function setInventoryActual(businessId: Id, id: Id, goodId: Id, actualQty: number | undefined): Promise<void> {
  if (isApiMode()) return Server.setInventoryActual(businessId, id, goodId, actualQty ?? 0);
  return request(() => {
    assertCan('stock.edit');
    requireDraftInventory(businessId, id);
    if (actualQty !== undefined && !(Number.isFinite(actualQty) && actualQty >= 0)) throw new ApiError('validation');
    mutateArea(AREA, (s) => {
      const inv = s.inventories.find((i) => i.id === id);
      const line = inv?.lines.find((l) => l.goodId === goodId);
      if (line) line.actualQty = actualQty === undefined ? undefined : roundQty(actualQty);
      if (inv) inv.updatedAt = nowDateTime();
    });
  });
}

/** F-08-086: Enter по найденному товару — +1 к фактическому остатку */
export function incrementInventoryActual(businessId: Id, id: Id, goodId: Id): Promise<number> {
  if (isApiMode()) return Server.incrementInventoryActual(businessId, id, goodId);
  return request(() => {
    assertCan('stock.edit');
    requireDraftInventory(businessId, id);
    let next = 0;
    mutateArea(AREA, (s) => {
      const inv = s.inventories.find((i) => i.id === id);
      const line = inv?.lines.find((l) => l.goodId === goodId);
      if (line) {
        // Ск12: считаем сканами с нуля — первый скан = 1, каждый следующий +1 (а не «расчёт + 1»)
        next = roundQty((line.actualQty ?? 0) + 1);
        line.actualQty = next;
      }
      if (inv) inv.updatedAt = nowDateTime();
    });
    return next;
  });
}

/** F-08-087: «Обнулить фактические остатки» — подтверждение спрашивает экран */
export function resetInventoryActual(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.resetInventoryActual(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    requireDraftInventory(businessId, id);
    mutateArea(AREA, (s) => {
      const inv = s.inventories.find((i) => i.id === id);
      inv?.lines.forEach((l) => {
        l.actualQty = 0;
      });
      if (inv) inv.updatedAt = nowDateTime();
    });
  });
}

/** F-08-087: «Рассчитать фактические остатки» — факт = расчётный остаток */
export function calculateInventoryActual(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.calculateInventoryActual(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    requireDraftInventory(businessId, id);
    mutateArea(AREA, (s) => {
      const inv = s.inventories.find((i) => i.id === id);
      inv?.lines.forEach((l) => {
        l.actualQty = levelAt(businessId, l.goodId, inv.warehouseId);
      });
      if (inv) inv.updatedAt = nowDateTime();
    });
  });
}

export interface UpdateInventoryMetaInput {
  categoryId?: Id;
  comment?: string;
  date?: string;
}

/** F-08-088: правка комментария/даты/категории, пока инвентаризация не проведена */
export function updateInventoryMeta(businessId: Id, id: Id, patch: UpdateInventoryMetaInput): Promise<void> {
  if (isApiMode()) return Server.updateInventoryMeta(businessId, id, patch);
  return request(() => {
    assertCan('stock.edit');
    requireDraftInventory(businessId, id);
    mutateArea(AREA, (s) => {
      const inv = s.inventories.find((i) => i.id === id);
      if (!inv) return;
      if (patch.date) inv.date = patch.date;
      inv.categoryId = patch.categoryId;
      inv.comment = patch.comment?.trim() || undefined;
      inv.updatedAt = nowDateTime();
    });
  });
}

/**
 * F-08-084: «Провести» — недостача создаёт списание, излишек создаёт приход, статус становится «завершена».
 * Ск4: расхождение считается от остатка НА МОМЕНТ ПРОВЕДЕНИЯ, а не от снимка при создании — иначе продажа
 * или списание между созданием и проведением учитывались дважды (факт уже без них, а расчёт — с ними).
 * В строки записывается итоговый расчёт, чтобы проведённая ведомость показывала то, по чему провели.
 * Ск5: номера документов берутся ДО записи — внутри mutateArea readArea видит старое состояние, и
 * списание с приходом получали один и тот же номер.
 */
export function finalizeInventory(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.finalizeInventory(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    syncAutoWriteoffs(businessId);
    const inv = requireDraftInventory(businessId, id);
    const state = readArea(AREA);
    const writeoffLines: OperationLine[] = [];
    const incomeLines: OperationLine[] = [];
    const finalLines: InventoryLine[] = inv.lines.map((l) => ({ ...l, calcQty: levelAt(businessId, l.goodId, inv.warehouseId) }));
    finalLines.forEach((l) => {
      const diff = roundQty(inventoryDiff(l));
      if (diff === 0) return;
      const good = state.goods.find((g) => g.id === l.goodId);
      const cost = good?.costPrice ?? 0;
      if (diff < 0) writeoffLines.push({ goodId: l.goodId, qtySale: diff, unitPrice: cost, costTotal: Math.round(diff * cost) });
      else incomeLines.push({ goodId: l.goodId, qtySale: diff, unitPrice: cost, costTotal: Math.round(diff * cost) });
    });
    const now = nowDateTime();
    let seq = Number(nextOperationNumber(businessId));
    const writeoffDoc: OperationDoc | undefined = writeoffLines.length
      ? {
          id: newId('op'),
          businessId,
          locationId: inv.locationId,
          number: String(seq++),
          type: 'writeoffProduct',
          date: now,
          warehouseId: inv.warehouseId,
          staffId: currentActor().staffId,
          paid: true,
          reason: 'manual',
          comment: `Инвентаризация № ${inv.number} — недостача`,
          lines: writeoffLines,
          inventoryId: inv.id,
          createdAt: now,
        }
      : undefined;
    const incomeDoc: OperationDoc | undefined = incomeLines.length
      ? {
          id: newId('op'),
          businessId,
          locationId: inv.locationId,
          number: String(seq++),
          type: 'income',
          date: now,
          warehouseId: inv.warehouseId,
          counterpartyName: `Инвентаризация № ${inv.number}`,
          staffId: currentActor().staffId,
          paid: true,
          comment: `Инвентаризация № ${inv.number} — излишек`,
          lines: incomeLines,
          inventoryId: inv.id,
          createdAt: now,
        }
      : undefined;
    mutateArea(AREA, (s) => {
      if (writeoffDoc) s.operations.push(writeoffDoc);
      if (incomeDoc) s.operations.push(incomeDoc);
      const target = s.inventories.find((i) => i.id === id);
      if (target) {
        target.status = 'done';
        target.lines = finalLines;
        target.writeoffDocId = writeoffDoc?.id;
        target.incomeDocId = incomeDoc?.id;
        target.updatedAt = now;
      }
    });
    pushHistory(businessId, 'operation', id, `Инвентаризация № ${inv.number} проведена`);
  });
}

/** F-08-088: удаление инвентаризации удаляет её списания и приходы, остатки возвращаются */
export function deleteInventory(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteInventory(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const inv = state.inventories.find((i) => i.id === id && i.businessId === businessId);
    if (!inv) throw new ApiError('not_found');
    mutateArea(AREA, (s) => {
      s.operations = s.operations.filter((op) => op.id !== inv.writeoffDocId && op.id !== inv.incomeDocId);
      s.inventories = s.inventories.filter((i) => i.id !== id);
    });
    pushHistory(businessId, 'operation', id, `Инвентаризация № ${inv.number} удалена`);
  });
}

/** F-08-089: выгрузка ведомости пересчёта в CSV (Excel) */
export function exportInventoryCsv(businessId: Id, id: Id): Promise<string> {
  return request(async () => {
    const inv = await getInventory(businessId, id);
    if (!inv) throw new ApiError('not_found');
    return toCsv(
      inv.lineRows.map((l) => [l.goodName, l.sku ?? '', l.calcQty, l.actualQty ?? '', l.diff]),
      ['Товар', 'Артикул', 'Расчёт', 'Факт', 'Расхождение'],
    );
  });
}

// ─────────────────────────── Технологические карты (F-08-036…045, F-08-136, F-00-136) ───────────────────────────

export interface TechCardLineRow extends TechCardLine {
  goodName: string;
  unitShort: string;
  warehouseName: string;
}

export interface TechCardRow extends TechCard {
  serviceName: string;
  staffName: string;
  lineDetails: TechCardLineRow[];
}

function toTechCardRow(card: TechCard): TechCardRow {
  const state = readArea(AREA);
  const core = readCore();
  const service = core.services.find((sv) => sv.id === card.serviceId);
  const staff = core.staff.find((s) => s.id === card.staffId);
  return {
    ...card,
    serviceName: service ? pickText(service.name, 'ru') : '',
    staffName: staff?.name ?? '',
    lineDetails: card.lines.map((l) => {
      const good = state.goods.find((g) => g.id === l.goodId);
      const warehouse = state.warehouses.find((w) => w.id === l.warehouseId);
      return { ...l, goodName: good?.name ?? '', unitShort: unitById(good?.writeoffUnit ?? 'pcs').short.ru, warehouseName: warehouse?.name ?? '' };
    }),
  };
}

/** F-08-036: список технологических карт склада (все услуги, все мастера) */
export function listTechCards(businessId: Id, locationId: Id): Promise<TechCardRow[]> {
  if (isApiMode()) return Server.listTechCards(businessId, locationId);
  return request(() =>
    readArea(AREA)
      .techCards.filter((c) => c.businessId === businessId && c.locationId === locationId)
      .map(toTechCardRow)
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName) || a.staffName.localeCompare(b.staffName)),
  );
}

/** F-08-039: техкарты одной услуги (по каждому мастеру) — читает вклад в карточку услуги */
export function listTechCardsForService(businessId: Id, serviceId: Id): Promise<TechCardRow[]> {
  if (isApiMode()) return Server.listTechCardsForService(businessId, serviceId);
  return request(() =>
    readArea(AREA)
      .techCards.filter((c) => c.businessId === businessId && c.serviceId === serviceId)
      .map(toTechCardRow),
  );
}

export function getTechCard(businessId: Id, id: Id): Promise<TechCardRow | undefined> {
  if (isApiMode()) return Server.getTechCard(businessId, id);
  return request(() => {
    const card = readArea(AREA).techCards.find((c) => c.id === id && c.businessId === businessId);
    return card ? toTechCardRow(card) : undefined;
  });
}

export interface TechCardInput {
  serviceId: Id;
  staffId: Id;
  lines: TechCardLine[];
}

/** F-08-037: пара (услуга, мастер) — одна техкарта; повторное сохранение той же пары обновляет существующую */
export function saveTechCard(businessId: Id, locationId: Id, input: TechCardInput): Promise<TechCard> {
  if (isApiMode()) return Server.saveTechCard(businessId, locationId, input);
  return request(() => {
    assertCan('stock.edit');
    if (!input.serviceId || !input.staffId) throw new ApiError('validation');
    if (!input.lines.length || input.lines.some((l) => !l.goodId || !(l.qtyWriteoff > 0))) throw new ApiError('validation');
    let saved: TechCard | undefined;
    mutateArea(AREA, (s) => {
      const existing = s.techCards.find((c) => c.businessId === businessId && c.serviceId === input.serviceId && c.staffId === input.staffId);
      if (existing) {
        existing.lines = input.lines;
        existing.updatedAt = nowDateTime();
        saved = existing;
      } else {
        const card: TechCard = { id: newId('tc'), businessId, locationId, serviceId: input.serviceId, staffId: input.staffId, lines: input.lines, createdAt: nowDateTime() };
        s.techCards.push(card);
        saved = card;
      }
    });
    pushHistory(businessId, 'techCard', saved!.id, 'Техкарта сохранена');
    return saved!;
  });
}

/** F-08-038: удаление техкарты — привязка снимается, прошлые списания в журнале остаются как есть */
export function deleteTechCard(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteTechCard(businessId, id);
  return request(() => {
    assertCan('stock.edit');
    const exists = readArea(AREA).techCards.some((c) => c.id === id && c.businessId === businessId);
    if (!exists) throw new ApiError('not_found');
    mutateArea(AREA, (s) => {
      s.techCards = s.techCards.filter((c) => c.id !== id);
    });
    pushHistory(businessId, 'techCard', id, 'Техкарта удалена');
  });
}

/** F-08-040: техкарта пакета услуг — сумма техкарт входящих услуг того же мастера (по товарам) */
export function getPackageTechCardLines(businessId: Id, packageServiceId: Id, staffId: Id): Promise<TechCardLineRow[]> {
  if (isApiMode()) return Server.getPackageTechCardLines(businessId, packageServiceId, staffId);
  return request(() => {
    const core = readCore();
    const pkg = core.services.find((sv) => sv.id === packageServiceId);
    const includedIds = pkg?.servicePackage?.items.map((i) => i.serviceId) ?? [];
    if (!includedIds.length) return [];
    const state = readArea(AREA);
    const byGood = new Map<Id, { qtyWriteoff: number; warehouseId: Id }>();
    includedIds.forEach((sid) => {
      const card = state.techCards.find((c) => c.businessId === businessId && c.serviceId === sid && c.staffId === staffId);
      card?.lines.forEach((l) => {
        const acc = byGood.get(l.goodId);
        byGood.set(l.goodId, { qtyWriteoff: (acc?.qtyWriteoff ?? 0) + l.qtyWriteoff, warehouseId: acc?.warehouseId ?? l.warehouseId });
      });
    });
    return Array.from(byGood.entries()).map(([goodId, { qtyWriteoff, warehouseId }]) => {
      const good = state.goods.find((g) => g.id === goodId);
      const warehouse = state.warehouses.find((w) => w.id === warehouseId);
      return { goodId, warehouseId, qtyWriteoff, goodName: good?.name ?? '', unitShort: unitById(good?.writeoffUnit ?? 'pcs').short.ru, warehouseName: warehouse?.name ?? '' };
    });
  });
}

// ─────────────────────────── Автосписание расходников визита (F-08-041…045, ⭐ F-00-136) ───────────────────────────

/**
 * Идемпотентно синхронизирует автосписания: у каждой записи ядра в статусе «пришёл» — ровно один документ
 * «Списание расходников» (autoWriteoff=true, bookingId); у прочих статусов, удалённых и отменённых записей
 * документа быть не должно (F-08-042 «откат»). Дешёвая операция — безопасно звать при открытии экранов,
 * которые её касаются (журнал операций, вкладка визита); просьбы к journal не нужно (план b03).
 */
export function ensureAutoWriteoffs(businessId: Id, _locationId?: Id): Promise<void> {
  // Режим api: автосписание ведёт сервер сам на смене статуса записи («Пришёл»/«Не пришёл» — TechCardsService.deductForBooking/revertForBooking)
  if (isApiMode()) return Promise.resolve();
  return request(() => {
    syncAutoWriteoffs(businessId);
  });
}

/**
 * Ск1: единая точка синхронизации автосписаний. Раньше документы создавались только когда кто-то
 * открывал журнал операций или окно визита — и остаток товара зависел от того, какую страницу открыли
 * первой (каталог показывал 3, после «Приход и расход» — −26). Теперь её зовёт КАЖДОЕ чтение остатков
 * (каталог, карточка, склады, «Заказать», просрочка, инвентаризация, отчёты, журнал) и каждая запись,
 * проверяющая нехватку, — синхронно, внутри того же request(). Пишет в срез только когда есть что
 * менять, поэтому повторные вызовы бесплатны и не будят перечитывания.
 */
function syncAutoWriteoffs(businessId: Id): void {
  const core = readCore();
  const state = readArea(AREA);
  const arrived = core.bookings.filter((b) => b.businessId === businessId && !b.deletedAt && b.status === 'arrived');
  const arrivedIds = new Set(arrived.map((b) => b.id));
  const staleIds = new Set(
    state.operations.filter((op) => op.businessId === businessId && op.autoWriteoff && op.bookingId && !arrivedIds.has(op.bookingId)).map((op) => op.id),
  );
  const existingBookingIds = new Set(state.operations.filter((op) => op.businessId === businessId && op.autoWriteoff && op.bookingId).map((op) => op.bookingId));
  const pending = arrived.filter((b) => !existingBookingIds.has(b.id));
  if (!staleIds.size && !pending.length) return;
  let seq = Number(nextOperationNumber(businessId));
  const toCreate: OperationDoc[] = [];
  // Старые визиты первыми — номера идут в том же порядке, что и даты (Ск5: «нумерация задним числом»)
  pending
    .sort((a, b) => a.start.localeCompare(b.start))
    .forEach((booking) => {
      // Запасной склад для старых техкарт без warehouseId в строке (данные до F-08-037 «Склад» в строке).
      const fallbackWarehouse = state.warehouses.find((w) => w.businessId === businessId && w.locationId === booking.locationId && w.type === 'writeoff');
      // F-08-041/F-08-037: списание идёт со склада, указанного в строке техкарты — группируем по складу,
      // если расходники одной услуги лежат на разных складах, создаём отдельный документ на каждый.
      const linesByWarehouse = new Map<Id, OperationLine[]>();
      booking.services.forEach((line) => {
        const card = state.techCards.find((c) => c.businessId === businessId && c.serviceId === line.serviceId && c.staffId === line.staffId);
        card?.lines.forEach((tl) => {
          const good = state.goods.find((g) => g.id === tl.goodId);
          if (!good) return;
          const warehouseId = tl.warehouseId ?? fallbackWarehouse?.id;
          if (!warehouseId) return;
          const qtyWriteoffTotal = tl.qtyWriteoff * line.qty;
          const qtySale = roundQty(good.unitRatio ? qtyWriteoffTotal / good.unitRatio : qtyWriteoffTotal);
          const lines = linesByWarehouse.get(warehouseId) ?? [];
          linesByWarehouse.set(warehouseId, lines);
          const existingLine = lines.find((l) => l.goodId === tl.goodId);
          if (existingLine) {
            existingLine.qtySale = roundQty(existingLine.qtySale - qtySale);
            existingLine.costTotal -= Math.round(qtySale * good.costPrice);
          } else {
            lines.push({ goodId: tl.goodId, qtySale: -qtySale, unitPrice: good.costPrice, costTotal: -Math.round(qtySale * good.costPrice) });
          }
        });
      });
      const now = nowDateTime();
      linesByWarehouse.forEach((lines, warehouseId) => {
        if (!lines.length) return;
        toCreate.push({
          id: newId('op'),
          businessId,
          locationId: booking.locationId,
          number: String(seq++),
          type: 'writeoffService',
          date: booking.start,
          warehouseId,
          reason: 'norm',
          staffId: booking.staffId,
          clientId: booking.clientId,
          bookingId: booking.id,
          autoWriteoff: true,
          paid: true,
          lines,
          createdAt: now,
        });
      });
    });
  if (!staleIds.size && !toCreate.length) return;
  mutateArea(AREA, (s) => {
    if (staleIds.size) s.operations = s.operations.filter((op) => !staleIds.has(op.id));
    toCreate.forEach((doc) => s.operations.push(doc));
  });
}

export interface BookingConsumableLine extends OperationLine {
  goodName: string;
  /** Единица СПИСАНИЯ (мл, г) — в ней и qtyWriteoff */
  unitShort: string;
  /** Ск13: списано в единицах списания (qtySale — в единицах продажи: 0.1 флакона = 10 мл) */
  qtyWriteoff: number;
}

export interface BookingConsumables {
  docId?: Id;
  lines: BookingConsumableLine[];
  /** Визит в статусе «Клиент пришёл» — только тогда расходники списываются и правятся вручную */
  arrived: boolean;
}

/** F-08-043: вкладка визита «Списание расходников» — фактический документ (авто + ручные правки поверх) */
export function getBookingConsumables(businessId: Id, bookingId: Id): Promise<BookingConsumables> {
  if (isApiMode()) return Server.getBookingConsumables(businessId, bookingId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const booking = readCore().bookings.find((b) => b.id === bookingId && b.businessId === businessId);
    const arrived = Boolean(booking && !booking.deletedAt && booking.status === 'arrived');
    const doc = state.operations.find((op) => op.businessId === businessId && op.bookingId === bookingId && op.autoWriteoff);
    if (!doc) return { lines: [], arrived };
    return {
      arrived,
      docId: doc.id,
      lines: doc.lines.map((l) => {
        const good = state.goods.find((g) => g.id === l.goodId);
        return {
          ...l,
          goodName: good?.name ?? '',
          unitShort: unitById(good?.writeoffUnit ?? 'pcs').short.ru,
          qtyWriteoff: roundQty(Math.abs(l.qtySale) * (good?.unitRatio || 1)),
        };
      }),
    };
  });
}

export interface BookingConsumableServiceLine {
  serviceId: Id;
  serviceName: string;
  staffId: Id;
  lineIndex: number;
  goods: { goodId: Id; goodName: string; qtyWriteoff: number; unitShort: string }[];
}

/** F-08-044: расходники по каждой строке визита отдельно — несколько одинаковых услуг не сливаются в одну строку */
export function getBookingConsumablesByService(businessId: Id, bookingId: Id): Promise<BookingConsumableServiceLine[]> {
  if (isApiMode()) return Server.getBookingConsumablesByService(businessId, bookingId);
  return request(() => {
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId && b.businessId === businessId);
    if (!booking) return [];
    const state = readArea(AREA);
    return booking.services.map((line, lineIndex) => {
      const service = core.services.find((sv) => sv.id === line.serviceId);
      const card = state.techCards.find((c) => c.businessId === businessId && c.serviceId === line.serviceId && c.staffId === line.staffId);
      const goods = (card?.lines ?? []).map((tl) => {
        const good = state.goods.find((g) => g.id === tl.goodId);
        return { goodId: tl.goodId, goodName: good?.name ?? '', qtyWriteoff: tl.qtyWriteoff * line.qty, unitShort: unitById(good?.writeoffUnit ?? 'pcs').short.ru };
      });
      return { serviceId: line.serviceId, serviceName: service ? pickText(service.name, 'ru') : '', staffId: line.staffId, lineIndex, goods };
    });
  });
}

/** F-08-043/F-08-117: ручная правка расходников визита — добавить/увеличить строку (право stock.edit) */
export function addBookingConsumableLine(businessId: Id, locationId: Id, bookingId: Id, goodId: Id, qtyWriteoff: number): Promise<void> {
  if (isApiMode()) return Server.addBookingConsumableLine(businessId, locationId, bookingId, goodId, qtyWriteoff);
  return request(() => {
    assertCan('stock.edit');
    if (!(qtyWriteoff > 0)) throw new ApiError('invalid_qty');
    // Ск13: расходники списываются по факту визита — пока клиент не пришёл, документа нет, и ручная строка
    // исчезла бы при следующей синхронизации (откат автосписания, F-08-042). Сначала — синхронизация, чтобы
    // ручная строка легла ПОВЕРХ нормы, а не вместо неё.
    const booking = readCore().bookings.find((b) => b.id === bookingId && b.businessId === businessId);
    if (!booking || booking.deletedAt || booking.status !== 'arrived') throw new ApiError('not_arrived');
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const good = state.goods.find((g) => g.id === goodId && g.businessId === businessId);
    if (!good) throw new ApiError('not_found');
    const writeoffWarehouse = state.warehouses.find((w) => w.businessId === businessId && w.locationId === locationId && w.type === 'writeoff');
    if (!writeoffWarehouse) throw new ApiError('validation');
    const existingDoc = state.operations.find((op) => op.businessId === businessId && op.bookingId === bookingId && op.autoWriteoff);
    const qtySale = roundQty(good.unitRatio ? qtyWriteoff / good.unitRatio : qtyWriteoff);
    const number = existingDoc ? existingDoc.number : nextOperationNumber(businessId);
    mutateArea(AREA, (s) => {
      let doc = existingDoc ? s.operations.find((op) => op.id === existingDoc.id) : undefined;
      if (!doc) {
        doc = {
          id: newId('op'),
          businessId,
          locationId,
          number,
          type: 'writeoffService',
          date: booking.start,
          warehouseId: writeoffWarehouse.id,
          reason: 'manual',
          staffId: booking.staffId,
          clientId: booking.clientId,
          bookingId,
          autoWriteoff: true,
          paid: true,
          lines: [],
          createdAt: nowDateTime(),
        };
        s.operations.push(doc);
      }
      const existingLine = doc.lines.find((l) => l.goodId === goodId);
      if (existingLine) {
        existingLine.qtySale = roundQty(existingLine.qtySale - qtySale);
        existingLine.costTotal = -Math.round(Math.abs(existingLine.qtySale) * good.costPrice);
      } else {
        doc.lines.push({ goodId, qtySale: -qtySale, unitPrice: good.costPrice, costTotal: -Math.round(qtySale * good.costPrice) });
      }
    });
  });
}

/**
 * Ск13: задать итоговое количество расходника визита (в единицах списания). 0 — убрать строку. Нужна,
 * чтобы «убрать добавленное вручную» вернуло строку к норме техкарты, а не стёрло и норму тоже.
 */
export function setBookingConsumableQty(businessId: Id, bookingId: Id, goodId: Id, qtyWriteoff: number): Promise<void> {
  if (isApiMode()) return Server.setBookingConsumableQty(businessId, bookingId, goodId, qtyWriteoff);
  return request(() => {
    assertCan('stock.edit');
    if (!(qtyWriteoff >= 0)) throw new ApiError('invalid_qty');
    const good = readArea(AREA).goods.find((g) => g.id === goodId && g.businessId === businessId);
    if (!good) throw new ApiError('not_found');
    const qtySale = roundQty(good.unitRatio ? qtyWriteoff / good.unitRatio : qtyWriteoff);
    mutateArea(AREA, (s) => {
      const doc = s.operations.find((op) => op.businessId === businessId && op.bookingId === bookingId && op.autoWriteoff);
      if (!doc) return;
      if (qtySale === 0) {
        doc.lines = doc.lines.filter((l) => l.goodId !== goodId);
        return;
      }
      const line = doc.lines.find((l) => l.goodId === goodId);
      if (line) {
        line.qtySale = -qtySale;
        line.costTotal = -Math.round(qtySale * good.costPrice);
      } else {
        doc.lines.push({ goodId, qtySale: -qtySale, unitPrice: good.costPrice, costTotal: -Math.round(qtySale * good.costPrice) });
      }
    });
  });
}

/** F-08-043: убрать строку расходника из документа визита */
export function removeBookingConsumableLine(businessId: Id, bookingId: Id, goodId: Id): Promise<void> {
  // api: на сервере «убрать строку» = количество 0 (StockExtService.setBookingConsumableQty удаляет строку)
  if (isApiMode()) return Server.setBookingConsumableQty(businessId, bookingId, goodId, 0);
  return request(() => {
    assertCan('stock.edit');
    mutateArea(AREA, (s) => {
      const doc = s.operations.find((op) => op.businessId === businessId && op.bookingId === bookingId && op.autoWriteoff);
      if (!doc) return;
      doc.lines = doc.lines.filter((l) => l.goodId !== goodId);
    });
  });
}

// ─────────────────────────── Продажа товара (F-08-062…077, F-08-092, F-00-138) ───────────────────────────

export interface SaleLineInput {
  goodId: Id;
  qtySale: number;
  unitPrice: Money;
  discountPct?: number;
  /** З9: продавец строки (зарплата «% с продаж»); нет — продавец документа */
  sellerId?: Id;
}

export interface CreateSaleInput {
  date: string;
  warehouseId: Id;
  clientId?: Id;
  bookingId?: Id;
  comment?: string;
  paymentMethod: SalePaymentMethod;
  paid: boolean;
  lines: SaleLineInput[];
  extraLines?: SaleExtraLine[];
}

/** F-08-062…066, F-08-070, F-00-138: продажа — уменьшает остаток продающего склада; сумма — выручка бизнеса (касса — F-00-138/F-08-070) */
export function createSaleOperation(businessId: Id, locationId: Id, input: CreateSaleInput): Promise<OperationDoc> {
  if (isApiMode()) return Server.createSaleOperation(businessId, locationId, input);
  return request(async () => {
    syncAutoWriteoffs(businessId);
    assertCan('stock.edit');
    if (!input.lines.length && !input.extraLines?.length) throw new ApiError('validation');
    if (!input.warehouseId) throw new ApiError('validation');
    assertPositiveQty(input.lines);
    const state = readArea(AREA);
    // F-08-099: по умолчанию (галочка выключена) продажа больше остатка проходит — остаток уйдёт в минус (F-08-061)
    const shortageSettings = state.settings[businessId] ?? defaultStockSettings(businessId);
    if (shortageSettings.forbidOnShortage) {
      for (const line of input.lines) {
        const available = computeLevels(businessId, line.goodId).find((l) => l.warehouseId === input.warehouseId)?.qty ?? 0;
        if (line.qtySale > available) {
          const good = state.goods.find((g) => g.id === line.goodId);
          const warehouseName = state.warehouses.find((w) => w.id === input.warehouseId)?.name ?? '';
          throw new ApiError('insufficient_stock', JSON.stringify({ goodName: good?.name ?? '', warehouseName, available }));
        }
      }
    }
    const number = nextOperationNumber(businessId);
    const doc: OperationDoc = {
      id: newId('op'),
      businessId,
      locationId,
      number,
      type: 'sale',
      date: input.date,
      warehouseId: input.warehouseId,
      clientId: input.clientId,
      bookingId: input.bookingId,
      staffId: currentActor().staffId,
      paid: input.paid,
      paymentMethod: input.paymentMethod,
      comment: input.comment?.trim() || undefined,
      lines: input.lines.map((l) => ({ goodId: l.goodId, qtySale: -Math.abs(l.qtySale), unitPrice: l.unitPrice, discountPct: l.discountPct, costTotal: -Math.abs(lineTotal(l)), sellerId: l.sellerId })),
      extraLines: input.extraLines?.length ? input.extraLines : undefined,
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.operations.push(doc);
    });
    pushHistory(businessId, 'operation', doc.id, `Продажа № ${number} создана`);
    await resyncDocFinance(businessId, doc.id);
    return readArea(AREA).operations.find((o) => o.id === doc.id) ?? doc;
  });
}

export interface SaleDocPatch {
  date: string;
  warehouseId: Id;
  clientId?: Id;
  paymentMethod: SalePaymentMethod;
  paid: boolean;
  comment?: string;
  lines: SaleLineInput[];
}

/** F-08-077: правка продажи (товарные строки) — абонементы/сертификаты в ней не редактируются отсюда; Ск6: касса следом */
export function updateSaleOperation(businessId: Id, docId: Id, patch: SaleDocPatch): Promise<OperationDoc> {
  if (isApiMode()) return Server.updateSaleOperation(businessId, docId, patch);
  return request(async () => {
    assertCan('stock.edit');
    if (!patch.lines.length) throw new ApiError('validation');
    assertPositiveQty(patch.lines);
    let updated: OperationDoc | undefined;
    mutateArea(AREA, (s) => {
      const doc = s.operations.find((op) => op.id === docId && op.businessId === businessId);
      if (!doc || doc.type !== 'sale') throw new ApiError('not_found');
      if (doc.cancelledAt) throw new ApiError('already_cancelled');
      doc.date = patch.date;
      doc.warehouseId = patch.warehouseId;
      doc.clientId = patch.clientId;
      doc.paymentMethod = patch.paymentMethod;
      doc.paid = patch.paid;
      doc.comment = patch.comment?.trim() || undefined;
      doc.lines = patch.lines.map((l) => ({ goodId: l.goodId, qtySale: -Math.abs(l.qtySale), unitPrice: l.unitPrice, discountPct: l.discountPct, costTotal: -Math.abs(lineTotal(l)) }));
      doc.updatedAt = nowDateTime();
      updated = doc;
    });
    if (!updated) throw new ApiError('not_found');
    pushHistory(businessId, 'operation', docId, `Продажа № ${updated.number} изменена`);
    await resyncDocFinance(businessId, docId);
    return readArea(AREA).operations.find((o) => o.id === docId) ?? updated;
  });
}

/** F-08-073/F-08-077: отмена продажи — товар возвращается на склад отдельным документом прихода, выручка в кассе снимается (F-08-073) */
export function cancelSaleOperation(businessId: Id, docId: Id): Promise<void> {
  if (isApiMode()) return Server.cancelSaleOperation(businessId, docId);
  return request(async () => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const doc = state.operations.find((op) => op.id === docId && op.businessId === businessId);
    if (!doc || doc.type !== 'sale') throw new ApiError('not_found');
    if (doc.cancelledAt) throw new ApiError('already_cancelled');
    const number = nextOperationNumber(businessId);
    const now = nowDateTime();
    const returnDoc: OperationDoc = {
      id: newId('op'),
      businessId,
      locationId: doc.locationId,
      number,
      type: 'income',
      date: now,
      warehouseId: doc.warehouseId,
      comment: `Возврат по продаже № ${doc.number}`,
      paid: true,
      lines: doc.lines.map((l) => ({ goodId: l.goodId, qtySale: Math.abs(l.qtySale), unitPrice: l.unitPrice, costTotal: Math.abs(l.costTotal) })),
      cancelsDocId: doc.id,
      createdAt: now,
    };
    mutateArea(AREA, (s) => {
      s.operations.push(returnDoc);
      const original = s.operations.find((op) => op.id === docId);
      if (original) {
        original.cancelledAt = now;
        original.cancelledByDocId = returnDoc.id;
      }
    });
    pushHistory(businessId, 'operation', docId, `Продажа № ${doc.number} отменена, товар возвращён (№ ${number})`);
    // F-08-073: если продажа создала операцию в кассе — снимаем выручку той же отменой, что использует finance для возврата
    if (doc.financeOperationId) {
      await cancelFinanceOperation(businessId, doc.financeOperationId);
    }
  });
}

export interface ReceiptData {
  doc: OperationDocDetail;
  businessName: string;
  clientName?: string;
  clientPhone?: string;
  staffName: string;
  total: Money;
}

/** F-08-072: данные для чека продажи (страница печати /biz/stock/operations/[docId]/receipt) */
export function getReceiptData(businessId: Id, docId: Id): Promise<ReceiptData | undefined> {
  if (isApiMode()) return Server.getReceiptData(businessId, docId);
  return request(() => {
    const state = readArea(AREA);
    const core = readCore();
    const doc = state.operations.find((op) => op.id === docId && op.businessId === businessId);
    if (!doc) return undefined;
    const business = core.businesses.find((b) => b.id === businessId);
    const client = doc.clientId ? core.clients.find((c) => c.id === doc.clientId) : undefined;
    const staff = core.staff.find((s) => s.id === doc.staffId);
    const warehouse = state.warehouses.find((w) => w.id === doc.warehouseId);
    const linesTotal = doc.lines.reduce((sum, l) => sum + Math.abs(l.costTotal), 0);
    const extraTotal = (doc.extraLines ?? []).reduce((sum, e) => sum + e.price, 0);
    return {
      doc: {
        ...doc,
        warehouseName: warehouse?.name ?? '',
        lineDetails: doc.lines.map((l) => {
          const good = state.goods.find((g) => g.id === l.goodId);
          return { ...l, goodName: good?.receiptName?.trim() || good?.name || '', saleUnit: good?.saleUnit ?? 'pcs' };
        }),
      },
      businessName: business?.brandName?.trim() || business?.name || '',
      clientName: client?.name,
      clientPhone: client?.phone,
      staffName: staff?.name ?? '',
      total: linesTotal + extraTotal,
    };
  });
}

// ─────────────────────────── Настройки склада (F-08-096…100) ───────────────────────────

export function getStockSettings(businessId: Id): Promise<StockSettings> {
  if (isApiMode()) return Server.getStockSettings(businessId);
  return request(() => readArea(AREA).settings[businessId] ?? defaultStockSettings(businessId));
}

export function updateStockSettings(businessId: Id, patch: Partial<Pick<StockSettings, 'costMethod' | 'expiryWarningDays' | 'forbidOnShortage' | 'adsOptIn'>>): Promise<StockSettings> {
  if (isApiMode()) return Server.updateStockSettings(businessId, patch);
  return request(() => {
    // Владелец 01.10: администратор ведёт склад (stock.edit), но настройки склада — только с settings.manage
    assertCan('settings.manage');
    let updated: StockSettings | undefined;
    mutateArea(AREA, (s) => {
      const current = s.settings[businessId] ?? defaultStockSettings(businessId);
      const next = { ...current, ...patch };
      s.settings[businessId] = next;
      updated = next;
    });
    return updated!;
  });
}

// ─────────────────────────── Предложения поставщиков у товара на исходе (F-00-165, В-26) ───────────────────────────

/** DTO рекламы поставщика для карточки товара — только то, что нужно показать и на что кликнуть/нажать «×» */
export interface SupplierOffer {
  id: Id;
  title: string;
  text?: string;
  imageUrl?: string;
  ctaUrl?: string;
  advertiser: { name: string; contact: string };
}

/**
 * Предложение поставщика рядом с товаром на исходе — только у мастеров, включивших «Получать предложения
 * поставщиков» (тумблер в /biz/stock/settings), и только по совпадению ключевого слова из названия товара.
 * Место `pl_stock` и сами объявления — общий каталог рекламы платформы (читаем срез `platform` напрямую,
 * это разрешено правилом «чужой срез можно читать» — CONVENTIONS §6); согласие держим в своих настройках
 * склада, а не в `platform.bizMeta[...].adsOptIn`, потому что писать туда может только наша панель
 * (`platform.access`) — см. запрос в qa/requests/stock.md.
 */
export function getSupplierOfferForGood(businessId: Id, productName: string): Promise<SupplierOffer | undefined> {
  if (isApiMode()) return Server.getSupplierOfferForGood(businessId, productName);
  return request(() => {
    const settings = readArea(AREA).settings[businessId] ?? defaultStockSettings(businessId);
    if (!settings.adsOptIn) return undefined;
    const t = todayISO();
    const name = productName.toLowerCase();
    const ad = readArea('platform').ads.find(
      (a) => a.placementId === 'pl_stock' && !a.paused && a.startDate <= t && a.endDate >= t && a.productKeywords.some((k) => name.includes(k.toLowerCase())),
    );
    if (!ad) return undefined;
    return { id: ad.id, title: ad.title, text: ad.text, imageUrl: ad.imageUrl, ctaUrl: ad.ctaUrl, advertiser: ad.advertiser };
  });
}

/** Показ/клик по предложению поставщика — через api платформы (owner статистики), не своим счётчиком */
export const reportSupplierOfferShown = (id: Id): Promise<void> => trackAdImpression(id);
export const reportSupplierOfferClicked = (id: Id): Promise<void> => trackAdClick(id);

/**
 * F-08-098/F-08-100: себестоимость на дату операции (⭐ упрощение — последняя цена прихода на/до этой даты
 * или раньше; при методе «средняя» это тоже приближение, честный пересчёт задним числом не делаем — assumed).
 */
export function costPriceAt(businessId: Id, goodId: Id, atDate: string): Money {
  if (isApiMode()) return apiCostCache.get(`${goodId}:${atDate}`) ?? 0; // api: цена с сервера (getCostPriceAt), синхронный хелпер отдаёт её кэш
  const state = readArea(AREA);
  const incomes = state.operations
    .filter((op) => op.businessId === businessId && op.type === 'income' && op.date <= atDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const op of incomes) {
    const line = op.lines.find((l) => l.goodId === goodId);
    if (line) return line.unitPrice;
  }
  return state.goods.find((g) => g.id === goodId)?.costPrice ?? 0;
}

export function getCostPriceAt(businessId: Id, goodId: Id, atDate: string): Promise<Money> {
  if (isApiMode()) return Server.getCostPriceAt(businessId, goodId, atDate).then((v) => (apiCostCache.set(`${goodId}:${atDate}`, v), v));
  return request(() => costPriceAt(businessId, goodId, atDate));
}

// ─────────────────────────── b04: Архив, Excel, ценники, права, сеть, клиент, напоминания ───────────────────────────

// ── Этап 21, лейн «finance+stock»: помощники режима api (сервер — StockExtController бэкенда) ──

/** Остатки и себестоимость на дату, уже полученные с сервера — для синхронных `computeLevels`/`costPriceAt` в режиме api */
const apiLevelsCache = new Map<Id, StockLevel[]>();
const apiCostCache = new Map<string, Money>();
/** Права раздела, уже прочитанные с сервера (`getStockPermissions`), — для синхронного `myStockPermissionsSync` в режиме api */
const apiStockPermsCache = new Map<string, StockStaffPermissions>();

/** Права по умолчанию, пока владелец не сохранил свои, — то же правило, что у мока `getStockPermissions` */
function defaultPermissionsFor(staffId: Id): StockStaffPermissions {
  const actor = currentActor();
  const isSelf = actor.staffId === staffId;
  const edit = isSelf ? actor.permissions.has('stock.edit') : true;
  const view = isSelf ? actor.permissions.has('stock.view') : true;
  // Владелец 01.10: администратор по умолчанию ведёт склад по шаблону «Администратор» (F-08-149) — товары,
  // приход, продажа, списание, перемещение, инвентаризация; без удаления документов и правки техкарт
  const role = readCore().staff.find((st) => st.id === staffId)?.role;
  if (edit && role === 'admin') return stockPermissionsForRoleTemplate('admin');
  return defaultStockPermissions({ edit, view });
}

async function apiGoodsWithCategories(businessId: Id, locationId: Id, categoryId?: Id): Promise<{ items: GoodRow[]; categories: Category[] }> {
  const [goods, categories] = await Promise.all([Server.listGoods(businessId, locationId, { pageSize: 100000 }), Server.listCategoriesFlat(businessId, locationId, true)]);
  let items = goods.items.filter((g) => !g.archived);
  if (categoryId) items = items.filter((g) => inSubtree(categories, categoryId, g.categoryId));
  return { items, categories };
}

async function apiMassEditGoods(businessId: Id, locationId: Id, categoryId?: Id): Promise<MassEditRow[]> {
  const { items } = await apiGoodsWithCategories(businessId, locationId, categoryId);
  return items
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ id: g.id, name: g.name, sku: g.sku, barcode: g.barcode, salePrice: g.salePrice, costPrice: g.costPrice, massNetG: g.massNetG, massGrossG: g.massGrossG }));
}

async function apiExportGoodsCsv(businessId: Id, locationId: Id, categoryId?: Id): Promise<string> {
  const { items, categories } = await apiGoodsWithCategories(businessId, locationId, categoryId);
  const rows = items.map((g) => [
    g.name,
    g.receiptName ?? '',
    categories.find((c) => c.id === g.categoryId)?.name ?? '',
    g.sku ?? '',
    g.barcode ?? '',
    unitById(g.saleUnit).short.ru,
    unitById(g.writeoffUnit).short.ru,
    g.unitRatio,
    g.salePrice,
    g.costPrice,
    g.criticalStock,
    g.desiredStock,
    g.brand ?? '',
    g.shade ?? '',
    g.expiryDate ?? '',
    g.showToClients ? 'Да' : 'Нет',
  ]);
  return toCsv(rows, [...GOODS_CSV_HEADERS]);
}

/** Разбор CSV — тот же, что у мока `importGoodsCsv`; поиск существующего и запись — на сервере */
async function apiImportGoodsCsv(businessId: Id, locationId: Id, categoryId: Id, csvText: string): Promise<ImportGoodsRowResult[]> {
  const table = parseCsv(csvText);
  const dataRows = table[0]?.some((h) => h.toLowerCase().includes('назв')) ? table.slice(1) : table;
  if (dataRows.length > 500) throw new ApiError('too_many_rows');
  const unitByShort = (label: string) => UNIT_OPTIONS.find((u) => u.short.ru === label || u.label.ru === label)?.id ?? 'pcs';
  const toNumber = (v: string | undefined) => {
    const n = Number((v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const rows = dataRows.map((cells, i) => {
    const name = (cells[0] ?? '').trim();
    const patch: Partial<Good> = {
      receiptName: cells[1]?.trim() || undefined,
      sku: cells[3]?.trim() || undefined,
      barcode: cells[4]?.trim() || undefined,
      saleUnit: unitByShort(cells[5] ?? ''),
      writeoffUnit: unitByShort(cells[6] ?? cells[5] ?? ''),
      unitRatio: toNumber(cells[7]) || 1,
      salePrice: toNumber(cells[8]),
      costPrice: toNumber(cells[9]),
      criticalStock: toNumber(cells[10]),
      desiredStock: toNumber(cells[11]),
      brand: cells[12]?.trim() || undefined,
      shade: cells[13]?.trim() || undefined,
      expiryDate: cells[14]?.trim() || undefined,
      showToClients: (cells[15] ?? '').trim().toLowerCase() === 'да',
    };
    return { row: i + 1, name, patch };
  });
  return Server.importGoodsRows(businessId, locationId, categoryId, rows);
}

// ── Архив (F-08-013, F-08-029) — списки для /biz/stock/archive ──

export interface ArchivedGoodRow extends Good {
  categoryName: string;
}

export function listArchivedCategories(businessId: Id, locationId: Id): Promise<Category[]> {
  if (isApiMode()) return Server.listCategoriesFlat(businessId, locationId, true).then((cs) => cs.filter((c) => c.archived).sort((a, b) => a.name.localeCompare(b.name)));
  return request(() =>
    readArea(AREA)
      .categories.filter((c) => c.businessId === businessId && c.locationId === locationId && c.archived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export function listArchivedGoods(businessId: Id, locationId: Id): Promise<ArchivedGoodRow[]> {
  if (isApiMode()) return Server.listGoods(businessId, locationId, { includeArchived: true, pageSize: 100000 }).then((r) => r.items.filter((g) => g.archived).sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)));
  return request(() => {
    const state = readArea(AREA);
    const categories = state.categories.filter((c) => c.locationId === locationId);
    return state.goods
      .filter((g) => g.businessId === businessId && g.locationId === locationId && g.archived)
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
      .map((g) => ({ ...g, categoryName: categories.find((c) => c.id === g.categoryId)?.name ?? '' }));
  });
}

/** F-08-029: удалить архивный товар насовсем (та же необратимость, что и F-08-030) */
export function deleteGoods(businessId: Id, ids: Id[]): Promise<void> {
  if (isApiMode()) return Server.deleteGoods(businessId, ids);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const inUse = new Set(state.techCards.flatMap((c) => c.lines.map((l) => l.goodId)));
    const names = ids.filter((id) => !inUse.has(id)).map((id) => state.goods.find((g) => g.id === id)?.name ?? '');
    mutateArea(AREA, (s) => {
      s.goods = s.goods.filter((g) => !(ids.includes(g.id) && !inUse.has(g.id)));
    });
    if (names.length) pushHistory(businessId, 'good', ids[0] ?? '', `Удалено насовсем: ${names.length} товаров`);
  });
}

// ── Быстрое управление (F-08-031) ──

export interface MassEditRow {
  id: Id;
  name: string;
  sku?: string;
  barcode?: string;
  salePrice: Money;
  costPrice: Money;
  massNetG?: number;
  massGrossG?: number;
}

export function listMassEditGoods(businessId: Id, locationId: Id, categoryId?: Id): Promise<MassEditRow[]> {
  if (isApiMode()) return apiMassEditGoods(businessId, locationId, categoryId);
  return request(() => {
    const state = readArea(AREA);
    const categories = state.categories.filter((c) => c.locationId === locationId);
    let items = state.goods.filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived);
    if (categoryId) items = items.filter((g) => inSubtree(categories, categoryId, g.categoryId));
    return items
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ id: g.id, name: g.name, sku: g.sku, barcode: g.barcode, salePrice: g.salePrice, costPrice: g.costPrice, massNetG: g.massNetG, massGrossG: g.massGrossG }));
  });
}

/** F-08-031: сохраняет таблицу «Быстрого управления» — только реально изменённые строки, каждая — в историю */
export function saveMassEdit(businessId: Id, rows: MassEditRow[]): Promise<number> {
  if (isApiMode()) return Server.saveMassEdit(businessId, rows);
  return request(() => {
    assertCan('stock.edit');
    let changed = 0;
    mutateArea(AREA, (s) => {
      rows.forEach((row) => {
        const good = s.goods.find((g) => g.id === row.id && g.businessId === businessId);
        if (!good) return;
        const isChanged =
          good.sku !== (row.sku || undefined) ||
          good.barcode !== (row.barcode || undefined) ||
          good.salePrice !== row.salePrice ||
          good.costPrice !== row.costPrice ||
          good.massNetG !== row.massNetG ||
          good.massGrossG !== row.massGrossG;
        if (!isChanged) return;
        good.sku = row.sku || undefined;
        good.barcode = row.barcode || undefined;
        good.salePrice = row.salePrice;
        good.costPrice = row.costPrice;
        good.massNetG = row.massNetG;
        good.massGrossG = row.massGrossG;
        good.updatedAt = nowDateTime();
        changed += 1;
      });
    });
    if (changed) pushHistory(businessId, 'good', rows[0]?.id ?? '', `Быстрое управление: изменено полей у ${changed} товаров`);
    return changed;
  });
}

// ── Excel: выгрузка / загрузка / обновление (F-08-032…034) ──

const GOODS_CSV_HEADERS = [
  'Название', 'Название в чеке', 'Категория', 'Артикул', 'Штрихкод', 'Единица продажи', 'Единица списания', 'Коэффициент',
  'Цена продажи', 'Себестоимость', 'Критичный остаток', 'Желаемый остаток', 'Бренд', 'Оттенок', 'Срок годности', 'Показывать клиентам',
] as const;

/** F-08-032: выгрузка каталога — все товары локации или одна категория (со всеми полями карточки, кроме служебных id) */
export function exportGoodsCsv(businessId: Id, locationId: Id, categoryId?: Id): Promise<string> {
  if (isApiMode()) return apiExportGoodsCsv(businessId, locationId, categoryId);
  return request(() => {
    const state = readArea(AREA);
    const categories = state.categories.filter((c) => c.locationId === locationId);
    let items = state.goods.filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived);
    if (categoryId) items = items.filter((g) => inSubtree(categories, categoryId, g.categoryId));
    const rows = items.map((g) => [
      g.name,
      g.receiptName ?? '',
      categories.find((c) => c.id === g.categoryId)?.name ?? '',
      g.sku ?? '',
      g.barcode ?? '',
      unitById(g.saleUnit).short.ru,
      unitById(g.writeoffUnit).short.ru,
      g.unitRatio,
      g.salePrice,
      g.costPrice,
      g.criticalStock,
      g.desiredStock,
      g.brand ?? '',
      g.shade ?? '',
      g.expiryDate ?? '',
      g.showToClients ? 'Да' : 'Нет',
    ]);
    return toCsv(rows, [...GOODS_CSV_HEADERS]);
  });
}

export interface ImportGoodsRowResult {
  row: number;
  name: string;
  status: 'created' | 'updated' | 'skipped';
  reason?: string;
}

/**
 * F-08-033/034: разбирает CSV (та же выгрузка F-08-032 — тот же порядок колонок) и заводит/обновляет
 * товары категории. Существующий товар находят по названию + артикулу/штрихкоду (F-08-034: по «Название»,
 * если артикул и штрихкод пусты у обоих). Неизвестная единица → «Штука» (Готово, когда — п.2). Лимит 500 строк.
 */
export function importGoodsCsv(businessId: Id, locationId: Id, categoryId: Id, csvText: string): Promise<ImportGoodsRowResult[]> {
  if (isApiMode()) return apiImportGoodsCsv(businessId, locationId, categoryId, csvText);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const category = state.categories.find((c) => c.id === categoryId && c.locationId === locationId);
    if (!category) throw new ApiError('not_found');
    const table = parseCsv(csvText);
    const dataRows = table[0]?.some((h) => h.toLowerCase().includes('назв')) ? table.slice(1) : table;
    if (dataRows.length > 500) throw new ApiError('too_many_rows');
    const results: ImportGoodsRowResult[] = [];
    const unitByShort = (label: string) => UNIT_OPTIONS.find((u) => u.short.ru === label || u.label.ru === label)?.id ?? 'pcs';
    const toNumber = (v: string | undefined) => {
      const n = Number((v ?? '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    mutateArea(AREA, (s) => {
      dataRows.forEach((cells, i) => {
        const name = (cells[0] ?? '').trim();
        if (!name) {
          results.push({ row: i + 1, name: '', status: 'skipped', reason: 'Пустое название' });
          return;
        }
        const sku = cells[3]?.trim() || undefined;
        const barcode = cells[4]?.trim() || undefined;
        const existing = s.goods.find(
          (g) => g.businessId === businessId && g.locationId === locationId && !g.archived && ((sku && g.sku === sku) || (barcode && g.barcode === barcode) || (!sku && !barcode && g.name === name)),
        );
        const patch: Partial<Good> = {
          name,
          receiptName: cells[1]?.trim() || undefined,
          sku,
          barcode,
          saleUnit: unitByShort(cells[5] ?? ''),
          writeoffUnit: unitByShort(cells[6] ?? cells[5] ?? ''),
          unitRatio: toNumber(cells[7]) || 1,
          salePrice: toNumber(cells[8]),
          costPrice: toNumber(cells[9]),
          criticalStock: toNumber(cells[10]),
          desiredStock: toNumber(cells[11]),
          brand: cells[12]?.trim() || undefined,
          shade: cells[13]?.trim() || undefined,
          expiryDate: cells[14]?.trim() || undefined,
          showToClients: (cells[15] ?? '').trim().toLowerCase() === 'да',
          updatedAt: nowDateTime(),
        };
        if (existing) {
          Object.assign(existing, patch);
          results.push({ row: i + 1, name, status: 'updated' });
        } else {
          const good: Good = {
            ...newGoodDefaults(),
            ...patch,
            id: newId('gd'),
            businessId,
            locationId,
            categoryId,
            name,
            archived: false,
            createdAt: nowDateTime(),
          } as Good;
          s.goods.push(good);
          results.push({ row: i + 1, name, status: 'created' });
        }
      });
    });
    const created = results.filter((r) => r.status === 'created').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    pushHistory(businessId, 'good', '', `Загрузка из Excel: создано ${created}, обновлено ${updated}`);
    return results;
  });
}

// ── Ценники (F-08-093…095) ──

export function getPriceTagLayout(businessId: Id): Promise<PriceTagLayout> {
  if (isApiMode()) return Server.getStoredPriceTagLayout(businessId).then((s) => s ?? defaultPriceTagLayout(businessId));
  return request(() => readArea(AREA).priceTagLayout[businessId] ?? defaultPriceTagLayout(businessId));
}

export function updatePriceTagLayout(businessId: Id, patch: Partial<Omit<PriceTagLayout, 'businessId'>>): Promise<PriceTagLayout> {
  if (isApiMode()) return Server.updatePriceTagLayout(businessId, patch, defaultPriceTagLayout(businessId));
  return request(() => {
    assertCan('stock.edit');
    let updated: PriceTagLayout | undefined;
    mutateArea(AREA, (s) => {
      const current = s.priceTagLayout[businessId] ?? defaultPriceTagLayout(businessId);
      const next = { ...current, ...patch };
      s.priceTagLayout[businessId] = next;
      updated = next;
    });
    return updated!;
  });
}

// ── Права раздела (F-08-109…118) — читает staff, храним у себя, пока нет места в ядре ──

export function getStockPermissions(businessId: Id, staffId: Id): Promise<StockStaffPermissions> {
  if (isApiMode())
    return Server.getStoredStockPermissions(businessId, staffId).then((s) => {
      const perms = s ?? defaultPermissionsFor(staffId);
      apiStockPermsCache.set(`${businessId}:${staffId}`, perms);
      return perms;
    });
  return request(() => {
    const stored = readArea(AREA).permissions[businessId]?.[staffId];
    if (stored) return stored;
    return defaultPermissionsFor(staffId);
  });
}

/** Галочки рисует staff (F-10-079); здесь только хранение и чтение */
export function setStockPermissions(businessId: Id, staffId: Id, patch: Partial<StockStaffPermissions>): Promise<StockStaffPermissions> {
  if (isApiMode()) return Server.setStockPermissions(businessId, staffId, patch, defaultStockPermissions({ edit: true, view: true }));
  return request(() => {
    assertCan('staff.manage');
    let updated: StockStaffPermissions | undefined;
    mutateArea(AREA, (s) => {
      const current = s.permissions[businessId]?.[staffId] ?? defaultStockPermissions({ edit: true, view: true });
      const next = { ...current, ...patch };
      s.permissions[businessId] = { ...(s.permissions[businessId] ?? {}), [staffId]: next };
      updated = next;
    });
    const staffName = readCore().staff.find((s) => s.id === staffId)?.name ?? staffId;
    pushHistory(businessId, 'permissions', staffId, `Права на склад сотрудника «${staffName}» изменены`);
    return updated!;
  });
}

/**
 * F-08-149 «выбор шаблона роли ставит его набор прав склада»: применяет решённый у нас состав
 * (`stockPermissionsForRoleTemplate`, @/domain/stock) и пишет строку в историю прав с именем шаблона —
 * дальше владелец правит галочками как обычной правкой (setStockPermissions).
 */
export function applyStockRoleTemplate(businessId: Id, staffId: Id, templateId: StockRoleTemplateId, templateLabel: string): Promise<StockStaffPermissions> {
  if (isApiMode()) return Server.replaceStockPermissions(businessId, staffId, stockPermissionsForRoleTemplate(templateId), { label: templateLabel });
  return request(() => {
    assertCan('staff.manage');
    const next = stockPermissionsForRoleTemplate(templateId);
    mutateArea(AREA, (s) => {
      s.permissions[businessId] = { ...(s.permissions[businessId] ?? {}), [staffId]: next };
    });
    const staffName = readCore().staff.find((s) => s.id === staffId)?.name ?? staffId;
    pushHistory(businessId, 'permissions', staffId, `Шаблон роли «${templateLabel}» применён к правам на склад сотрудника «${staffName}»`);
    return next;
  });
}

/** F-08-149 «права склада копируются с другого сотрудника одной кнопкой» */
export function copyStockPermissions(businessId: Id, fromStaffId: Id, toStaffId: Id): Promise<StockStaffPermissions> {
  if (isApiMode()) return Server.getStoredStockPermissions(businessId, fromStaffId).then((src) => Server.replaceStockPermissions(businessId, toStaffId, src ?? defaultStockPermissions({ edit: true, view: true }), { fromStaffId }));
  return request(() => {
    assertCan('staff.manage');
    const source = readArea(AREA).permissions[businessId]?.[fromStaffId] ?? defaultStockPermissions({ edit: true, view: true });
    mutateArea(AREA, (s) => {
      s.permissions[businessId] = { ...(s.permissions[businessId] ?? {}), [toStaffId]: source };
    });
    const staff = readCore().staff;
    const fromName = staff.find((s) => s.id === fromStaffId)?.name ?? fromStaffId;
    const toName = staff.find((s) => s.id === toStaffId)?.name ?? toStaffId;
    pushHistory(businessId, 'permissions', toStaffId, `Права на склад скопированы с «${fromName}» сотруднику «${toName}»`);
    return source;
  });
}

/** F-08-149 «каждая смена прав видна в истории прав с автором и временем» */
export function listPermissionHistory(businessId: Id, staffId: Id) {
  if (isApiMode()) return Server.listPermissionHistory(businessId, staffId);
  return request(() =>
    readArea(AREA)
      .history.filter((h) => h.businessId === businessId && h.entityType === 'permissions' && h.entityId === staffId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

/** Мои права в разделе «Товары» прямо сейчас (для гейтов в UI, без обхода API-запроса) */
export function myStockPermissionsSync(): StockStaffPermissions {
  const actor = currentActor();
  if (isApiMode()) return (actor.staffId && apiStockPermsCache.get(`${actor.businessId ?? ''}:${actor.staffId}`)) || defaultPermissionsFor(actor.staffId ?? '');
  if (!actor.staffId) return defaultStockPermissions({ edit: actor.permissions.has('stock.edit'), view: actor.permissions.has('stock.view') });
  const stored = readArea(AREA).permissions[actor.businessId ?? '']?.[actor.staffId];
  if (stored) return stored;
  return defaultStockPermissions({ edit: actor.permissions.has('stock.edit'), view: actor.permissions.has('stock.view') });
}

export function warehouseAllowed(perm: StockStaffPermissions, warehouseId: Id): boolean {
  return perm.warehouseAccess === 'all' || perm.warehouseAccess.includes(warehouseId);
}

export function historyCutoffDate(perm: StockStaffPermissions): string | undefined {
  if (perm.movementHistoryDays === 'all') return undefined;
  if (perm.movementHistoryDays === 'none') return todayISO();
  return addDaysIso(todayISO(), -perm.movementHistoryDays);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Что можно менять у сетевого товара + копирование (F-08-130, F-08-135) ──

export { NETWORK_LOCAL_FIELDS };
export type { NetworkLocalField };

export function isNetworkFieldLocked(good: Pick<Good, 'networkGroupId' | 'isNetworkSource'>, field: keyof Good): boolean {
  if (!good.networkGroupId || good.isNetworkSource) return false;
  return !(NETWORK_LOCAL_FIELDS as readonly string[]).includes(field as string);
}

/** F-08-135: копирование в другие локации — копии делят networkGroupId с источником (F-08-130 заперт у копий) */
export function copyGoodToLocationsNetworked(businessId: Id, goodId: Id, targetLocationIds: Id[]): Promise<Good[]> {
  if (isApiMode()) return Server.copyGoodToLocationsNetworked(businessId, goodId, targetLocationIds);
  return request(() => {
    assertCan('stock.edit');
    const state = readArea(AREA);
    const source = state.goods.find((g) => g.id === goodId && g.businessId === businessId);
    if (!source) throw new ApiError('not_found');
    const groupId = source.networkGroupId ?? source.id;
    const created: Good[] = [];
    mutateArea(AREA, (s) => {
      const src = s.goods.find((g) => g.id === goodId)!;
      src.networkGroupId = groupId;
      src.isNetworkSource = true;
      targetLocationIds.forEach((locationId) => {
        const targetCategory =
          s.categories.find((c) => c.locationId === locationId && c.name === src.name) ??
          s.categories.find((c) => c.locationId === locationId && c.name === ROOT_CATEGORY_NAME) ??
          s.categories.find((c) => c.locationId === locationId);
        if (!targetCategory) return;
        const existing = s.goods.find((g) => g.locationId === locationId && g.networkGroupId === groupId);
        if (existing) return; // уже скопирован раньше — не дублируем
        const copy: Good = { ...src, id: newId('gd'), locationId, categoryId: targetCategory.id, networkGroupId: groupId, isNetworkSource: false, createdAt: nowDateTime(), updatedAt: undefined };
        s.goods.push(copy);
        created.push(copy);
      });
    });
    pushHistory(businessId, 'good', goodId, `Скопирован в ${targetLocationIds.length} филиал(ов)`);
    return created;
  });
}

// ── Материалы и палитра для клиента (⭐ F-00-143, F-00-144, F-08-142) ──

export interface ClientMaterialRow {
  id: Id;
  name: string;
  brand?: string;
}

/** F-00-144: товар с «Показывать клиентам» — без остатка (просьба: показ у client/services/online, готов только api) */
export function listClientMaterials(businessId: Id, locationId: Id): Promise<ClientMaterialRow[]> {
  if (isApiMode()) return Server.listClientMaterials(businessId, locationId);
  return request(() =>
    readArea(AREA)
      .goods.filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived && g.showToClients)
      .map((g) => ({ id: g.id, name: (g.clientName?.ru || g.name), brand: g.brand })),
  );
}

export interface ClientPaletteShade {
  id: Id;
  name: string;
  brand?: string;
  shade: string;
  colorIndex?: number;
}

/**
 * F-00-143: палитра из остатков склада — только оттенки с остатком > 0 и без просрочки (F-00-140, F-08-147:
 * товар с истёкшим сроком не предлагается клиенту, даже если остаток есть — сферы с palette фильтрует
 * вызывающий по useSphere).
 */
export function listClientPalette(businessId: Id, locationId: Id): Promise<ClientPaletteShade[]> {
  if (isApiMode()) return Server.listClientPalette(businessId, locationId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const now = todayISO();
    return state.goods
      .filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived && g.shade)
      .filter((g) => computeExpiryFlag(g.expiryDate, now) !== 'expired')
      .map((g) => ({ id: g.id, name: g.name, brand: g.brand, shade: g.shade!, colorIndex: g.shadeColorIndex, stock: totalStock(businessId, g.id) }))
      .filter((g) => g.stock > 0)
      .map(({ stock: _stock, ...rest }) => rest);
  });
}

// ── Напоминания (⭐ F-00-142) ──

/** Сводка напоминаний салона (staffId не передан) или конкретного мастера: заканчивается, срок годности, оборудование */
export function listReminders(businessId: Id, locationId: Id, staffId?: Id): Promise<StockReminder[]> {
  if (isApiMode()) return Server.listReminders(businessId, locationId, staffId);
  return request(() => {
    syncAutoWriteoffs(businessId);
    const state = readArea(AREA);
    const settings = state.settings[businessId] ?? defaultStockSettings(businessId);
    const goods = state.goods.filter((g) => g.businessId === businessId && g.locationId === locationId && !g.archived);
    const now = todayISO();
    const reminders: StockReminder[] = [];
    goods.forEach((g) => {
      const stock = totalStock(businessId, g.id);
      if (g.criticalStock > 0 && stock <= g.criticalStock) {
        reminders.push({ id: `low_${g.id}`, kind: 'lowStock', title: g.name, goodId: g.id, severity: 'danger' });
      }
      const flag = computeExpiryFlag(g.expiryDate, now, settings.expiryWarningDays);
      if (flag === 'expired') reminders.push({ id: `exp_${g.id}`, kind: 'expired', title: g.name, date: g.expiryDate, goodId: g.id, severity: 'danger' });
      else if (flag === 'expiring') reminders.push({ id: `expwarn_${g.id}`, kind: 'expiring', title: g.name, date: g.expiryDate, goodId: g.id, severity: 'warning' });
    });
    state.equipment
      .filter((e) => e.businessId === businessId && e.locationId === locationId && !e.archived)
      .forEach((e) => {
        if (e.replaceReminderDate && e.replaceReminderDate <= now) {
          reminders.push({ id: `eqrepl_${e.id}`, kind: 'equipmentReplace', title: e.name, date: e.replaceReminderDate, equipmentId: e.id, severity: 'warning' });
        }
      });
    const custom = state.customReminders.filter((r) => r.businessId === businessId && r.locationId === locationId && !r.done && (staffId ? r.staffId === staffId : true));
    custom.forEach((r) => reminders.push({ id: r.id, kind: 'custom', title: r.text, date: r.date, staffId: r.staffId, severity: 'info' }));
    return reminders.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });
}

// ── ⭐ F-00-137: «Заканчивается» и сроки годности — в колокольчике кабинета (владелец, 01.10.2026) ──

export interface StockBellAlert {
  /** Стабильный id группы + «отпечаток» товаров: новый товар ниже минимума делает строку снова непрочитанной */
  id: string;
  kind: 'lowStock' | 'expiring';
  count: number;
  names: string[];
  href: string;
  unread: boolean;
}

/** Прочитанные строки колокольчика (id с отпечатком) — в памяти вкладки; мок — ещё и в срезе */
const bellSeenMemory = new Set<string>();

export async function listStockBellAlerts(businessId: Id, locationId: Id): Promise<StockBellAlert[]> {
  const reminders = await listReminders(businessId, locationId);
  // Чтение мок-базы — только внутри request() (иначе предупреждение [mock-db] на каждой странице с колокольчиком)
  const stored = isApiMode() ? [] : await request(() => readArea(AREA).bellSeen?.[businessId] ?? []);
  const seen = new Set<string>([...bellSeenMemory, ...stored]);
  const group = (kind: StockBellAlert['kind'], items: StockReminder[], href: string): StockBellAlert | undefined => {
    if (!items.length) return undefined;
    const id = `stock_${kind}_${locationId}:${items.map((r) => r.id).sort().join(',')}`;
    return { id, kind, count: items.length, names: items.map((r) => r.title), href, unread: !seen.has(id) };
  };
  return [
    group('lowStock', reminders.filter((r) => r.kind === 'lowStock'), '/biz/stock/order'),
    group('expiring', reminders.filter((r) => r.kind === 'expired' || r.kind === 'expiring'), '/biz/stock/reminders'),
  ].filter((a): a is StockBellAlert => Boolean(a));
}

export function markStockBellAlertsRead(businessId: Id, ids: string[]): Promise<void> {
  ids.forEach((id) => bellSeenMemory.add(id));
  if (isApiMode()) return Promise.resolve();
  return request(() => {
    mutateArea(AREA, (s) => {
      const prev = s.bellSeen?.[businessId] ?? [];
      s.bellSeen = { ...(s.bellSeen ?? {}), [businessId]: Array.from(new Set([...prev, ...ids])).slice(-50) };
    });
  });
}

export function createCustomReminder(businessId: Id, locationId: Id, input: { text: string; date: string; staffId?: Id }): Promise<CustomReminder> {
  if (isApiMode()) return Server.createCustomReminder(businessId, locationId, input);
  return request(() => {
    if (!input.text.trim()) throw new ApiError('validation');
    const reminder: CustomReminder = { id: newId('rem'), businessId, locationId, staffId: input.staffId, text: input.text.trim(), date: input.date, done: false, createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.customReminders.push(reminder);
    });
    return reminder;
  });
}

export function completeCustomReminder(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.completeCustomReminder(businessId, id);
  return request(() => {
    mutateArea(AREA, (s) => {
      const r = s.customReminders.find((x) => x.id === id && x.businessId === businessId);
      if (r) r.done = true;
    });
  });
}

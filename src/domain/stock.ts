/**
 * Типы раздела «stock» (склад, препараты, оборудование). Пачка b01 — каркас: склады, категории,
 * каталог товаров, карточка товара, журнал складских операций (список), оборудование.
 * F-08-*, F-00-133…144 (00-our-decisions.md §12). Ссылки на ядро — по Id.
 */
import type { Id, ISODate, ISODateTime, LocalizedText, Money } from '@/domain/core';

// ─────────────────────────── Склады (F-08-004…009) ───────────────────────────

/** «Для списания расходных материалов» / «Для продажи товаров» (F-08-009) */
export type WarehouseType = 'writeoff' | 'sale';

export interface Warehouse {
  id: Id;
  businessId: Id;
  locationId: Id;
  name: string;
  type: WarehouseType;
  comment?: string;
  /** Порядок перетаскиванием (F-08-006) — меньше = выше */
  order: number;
  /** ⭐ F-08-005: выдача мастеру — отдельный склад мастера (F-00-135) */
  ownerStaffId?: Id;
  createdAt: ISODateTime;
}

export function defaultWarehouseSeed(locationId: Id, businessId: Id, order: number): Omit<Warehouse, 'id' | 'createdAt'>[] {
  return [
    { businessId, locationId, name: 'Расходники', type: 'writeoff', comment: 'Для учёта расходных материалов', order },
    { businessId, locationId, name: 'Товары', type: 'sale', comment: 'Для учёта продаж в магазине', order: order + 1 },
  ];
}

// ─────────────────────────── Категории (F-08-010…014) ───────────────────────────

export interface Category {
  id: Id;
  businessId: Id;
  locationId: Id;
  name: string;
  parentId?: Id;
  sku?: string;
  comment?: string;
  archived: boolean;
  createdAt: ISODateTime;
}

export const ROOT_CATEGORY_NAME = 'Основные товары';

// ─────────────────────────── Единицы измерения (F-08-020, F-08-145) ───────────────────────────

export interface UnitOption {
  id: string;
  label: LocalizedText;
  short: LocalizedText;
}

/** Справочник единиц — представительный набор (ТЗ называет ~37-38, полный список не решён — assumed) */
export const UNIT_OPTIONS: UnitOption[] = [
  { id: 'pcs', label: { ru: 'Штука', en: 'Piece' }, short: { ru: 'шт.', en: 'pc', hy: 'հատ' } },
  { id: 'ml', label: { ru: 'Миллилитр', en: 'Millilitre' }, short: { ru: 'мл', en: 'ml', hy: 'մլ' } },
  { id: 'l', label: { ru: 'Литр', en: 'Litre' }, short: { ru: 'л', en: 'l', hy: 'լ' } },
  { id: 'g', label: { ru: 'Грамм', en: 'Gram' }, short: { ru: 'г', en: 'g', hy: 'գ' } },
  { id: 'kg', label: { ru: 'Килограмм', en: 'Kilogram' }, short: { ru: 'кг', en: 'kg', hy: 'կգ' } },
  { id: 'bottle', label: { ru: 'Флакон', en: 'Bottle' }, short: { ru: 'флак.', en: 'btl', hy: 'շիշ' } },
  { id: 'tube', label: { ru: 'Тюбик', en: 'Tube' }, short: { ru: 'тюб.', en: 'tube', hy: 'տուբ' } },
  { id: 'jar', label: { ru: 'Банка', en: 'Jar' }, short: { ru: 'банк.', en: 'jar', hy: 'բանկա' } },
  { id: 'pack', label: { ru: 'Упаковка', en: 'Pack' }, short: { ru: 'уп.', en: 'pack', hy: 'փաթեթ' } },
  { id: 'box', label: { ru: 'Коробка', en: 'Box' }, short: { ru: 'кор.', en: 'box', hy: 'տուփ' } },
  { id: 'set', label: { ru: 'Набор', en: 'Set' }, short: { ru: 'наб.', en: 'set', hy: 'հավաքածու' } },
  { id: 'pair', label: { ru: 'Пара', en: 'Pair' }, short: { ru: 'пар.', en: 'pair', hy: 'զույգ' } },
  { id: 'roll', label: { ru: 'Рулон', en: 'Roll' }, short: { ru: 'рул.', en: 'roll', hy: 'գլան' } },
  { id: 'ampoule', label: { ru: 'Ампула', en: 'Ampoule' }, short: { ru: 'амп.', en: 'amp', hy: 'սրվակ' } },
  { id: 'capsule', label: { ru: 'Капсула', en: 'Capsule' }, short: { ru: 'капс.', en: 'cap', hy: 'պատիճ' } },
  { id: 'dose', label: { ru: 'Доза', en: 'Dose' }, short: { ru: 'доз.', en: 'dose', hy: 'դեղաչափ' } },
  { id: 'syringe', label: { ru: 'Шприц', en: 'Syringe' }, short: { ru: 'шпр.', en: 'syr', hy: 'ներարկիչ' } },
  { id: 'portion', label: { ru: 'Порция', en: 'Portion' }, short: { ru: 'порц.', en: 'ptn', hy: 'բաժին' } },
  { id: 'procedure', label: { ru: 'Процедура', en: 'Procedure' }, short: { ru: 'проц.', en: 'proc', hy: 'պրոց.' } },
  { id: 'cm', label: { ru: 'Сантиметр', en: 'Centimetre' }, short: { ru: 'см', en: 'cm', hy: 'սմ' } },
  { id: 'm', label: { ru: 'Метр', en: 'Metre' }, short: { ru: 'м', en: 'm', hy: 'մ' } },
  { id: 'other', label: { ru: 'Другое', en: 'Other' }, short: { ru: '—', en: '—', hy: '—' } },
];

/**
 * ⭐ F-00-137 (владелец, 01.10.2026): приветствие заказа поставщику в WhatsApp — на языке поставщика
 * (Counterparty.messageLang), а не кабинета, поэтому не через словарь интерфейса.
 */
export const ORDER_WA_GREETING: LocalizedText = {
  ru: 'Здравствуйте! Хотим заказать:',
  en: 'Hello! We would like to order:',
  hy: 'Բարև Ձեզ։ Ցանկանում ենք պատվիրել՝',
};

export function unitById(id: string): UnitOption {
  return UNIT_OPTIONS.find((u) => u.id === id) ?? UNIT_OPTIONS[0];
}

// ─────────────────────────── Налог (F-08-023) ───────────────────────────

export type TaxSystem = 'default' | 'general';
export type TaxRate = 'default' | 'rate20' | 'none';

// ─────────────────────────── Товар (F-08-015…027, F-00-134, F-00-140, F-00-144) ───────────────────────────

export interface Good {
  id: Id;
  businessId: Id;
  locationId: Id;
  categoryId: Id;
  name: string;
  /** «Название в чеке» (F-08-018) — пусто ⇒ при печати берётся name */
  receiptName?: string;
  sku?: string;
  barcode?: string;
  markingCode?: string;
  saleUnit: string;
  writeoffUnit: string;
  /** «Равно»: сколько единиц списания в одной единице продажи (F-08-020) */
  unitRatio: number;
  massNetG?: number;
  massGrossG?: number;
  salePrice: Money;
  costPrice: Money;
  taxSystem: TaxSystem;
  taxRate: TaxRate;
  /** В единицах продажи, по умолчанию 0 (F-08-024) */
  criticalStock: number;
  /** В единицах продажи, по умолчанию 0 (F-08-025) */
  desiredStock: number;
  /** ⭐ F-00-134 наши поля */
  brand?: string;
  shade?: string;
  shadeColorIndex?: number;
  expiryDate?: ISODate;
  purchaseDate?: ISODate;
  shelfLifeAfterOpenDays?: number;
  /** ⭐ F-00-144 */
  showToClients: boolean;
  /** ⭐ F-00-172: название для клиента на трёх языках, если showToClients */
  clientName?: LocalizedText;
  /**
   * F-08-130/135: товары, скопированные из одного через «Копировать в другие филиалы», делят один
   * networkGroupId — в филиале у такого товара правится только цена, себестоимость, налог, пороги
   * остатка и комментарий (остальные поля — общие для сети, меняются на «исходном» товаре).
   */
  networkGroupId?: Id;
  /** Товар, с которого начата сеть (networkGroupId совпадает с его id) — там разрешены все поля */
  isNetworkSource?: boolean;
  comment?: string;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

/** F-08-130: поля, которые остаются редактируемыми у сетевого товара в филиале-получателе */
export const NETWORK_LOCAL_FIELDS = ['salePrice', 'costPrice', 'taxSystem', 'taxRate', 'criticalStock', 'desiredStock', 'comment'] as const;
export type NetworkLocalField = (typeof NETWORK_LOCAL_FIELDS)[number];

export function newGoodDefaults(): Pick<
  Good,
  'saleUnit' | 'writeoffUnit' | 'unitRatio' | 'criticalStock' | 'desiredStock' | 'taxSystem' | 'taxRate' | 'showToClients' | 'archived'
> {
  return {
    saleUnit: 'pcs',
    writeoffUnit: 'pcs',
    unitRatio: 1,
    criticalStock: 0,
    desiredStock: 0,
    taxSystem: 'default',
    taxRate: 'default',
    showToClients: false,
    archived: false,
  };
}

/** F-00-140: за сколько дней предупреждать об истечении срока (не решено в ТЗ — assumed 14) */
export const EXPIRY_WARNING_DAYS = 14;

export type ExpiryFlag = 'ok' | 'expiring' | 'expired';

/** warningDays — настраиваемо (StockSettings.expiryWarningDays, F-08-099-b04); по умолчанию EXPIRY_WARNING_DAYS */
export function expiryFlag(expiryDate: ISODate | undefined, today: ISODate, warningDays: number = EXPIRY_WARNING_DAYS): ExpiryFlag {
  if (!expiryDate) return 'ok';
  if (expiryDate < today) return 'expired';
  const days = (Date.parse(expiryDate) - Date.parse(today)) / 86_400_000;
  return days <= warningDays ? 'expiring' : 'ok';
}

// ─────────────────────────── Складские операции (F-08-046…048) ───────────────────────────

export type OperationType = 'income' | 'sale' | 'writeoffService' | 'writeoffProduct' | 'move';

/** ⭐ F-08-058/F-00-135: причина списания — по норме с услуги / вручную / брак / просрочка (F-00-140) */
export type WriteoffReason = 'norm' | 'manual' | 'defect' | 'expired';

export const WRITEOFF_REASON_LABELS: Record<WriteoffReason, LocalizedText> = {
  norm: { ru: 'По норме с услуги', en: 'By service norm' },
  manual: { ru: 'Вручную', en: 'Manual' },
  defect: { ru: 'Брак', en: 'Defect' },
  expired: { ru: 'Просрочка', en: 'Expired' },
};

export interface OperationLine {
  goodId: Id;
  /** Количество в единицах продажи; расход — отрицательное (F-08-047) */
  qtySale: number;
  unitPrice: Money;
  /** Скидка в процентах (F-08-056, только приход/списание) */
  discountPct?: number;
  /** Себестоимость строки = qty × costPrice (F-08-047 «Себестоимость — сумма по строке») */
  costTotal: Money;
  /** З9 (28.09): продавец строки продажи (товар визита — BookingGoodsLine.sellerId); нет — продавец документа (staffId) */
  sellerId?: Id;
}

/** F-08-070: способ оплаты продажи — только запись (⭐ F-00-126, деньги через нас не проходят) */
export type SalePaymentMethod = 'cash' | 'card' | 'loyalty' | 'unpaid';

/** F-08-075…077: строка продажи абонемента/сертификата — не товар склада, ссылается на сущность loyalty */
export interface SaleExtraLine {
  kind: 'certificate' | 'membership';
  /** Id проданного Certificate / Membership (loyalty) */
  refId: Id;
  typeName: string;
  code?: string;
  price: Money;
}

export interface OperationDoc {
  id: Id;
  businessId: Id;
  locationId: Id;
  number: string;
  type: OperationType;
  date: ISODateTime;
  warehouseId: Id;
  /** Только для перемещения */
  toWarehouseId?: Id;
  counterpartyName?: string;
  /** Ск16: поставщик из справочника «Контрагенты» финансов (counterpartyName — имя на момент документа) */
  counterpartyId?: Id;
  clientId?: Id;
  staffId?: Id;
  serviceId?: Id;
  bookingId?: Id;
  paid: boolean;
  /** F-08-070: способ оплаты продажи; Ск16: и оплаченного прихода поставщику */
  paymentMethod?: SalePaymentMethod;
  /** F-08-075…077: абонементы/сертификаты в этой продаже (продаются через api loyalty) */
  extraLines?: SaleExtraLine[];
  /** F-08-041/042: этот документ — автосписание по норме (bookingId обязателен), идемпотентность по паре (bookingId) */
  autoWriteoff?: boolean;
  /** F-08-073: продажа отменена/возвращена — товар вернулся на склад отдельным документом */
  cancelledAt?: ISODateTime;
  /** F-00-138/F-08-057/F-08-070/F-08-073: касса — id операции finance, которую создал этот документ (продажа/оплаченный приход) */
  financeOperationId?: Id;
  /** F-08-058 */
  reason?: WriteoffReason;
  comment?: string;
  lines: OperationLine[];
  /** F-08-084: этой инвентаризацией создан этот документ */
  inventoryId?: Id;
  /** F-08-060: перемещение отменено — ссылка на документ-разворот */
  cancelledByDocId?: Id;
  /** F-08-060: этот документ — разворот отменённого перемещения */
  cancelsDocId?: Id;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

export const OPERATION_TYPE_LABELS: Record<OperationType, LocalizedText> = {
  income: { ru: 'Приход товара', en: 'Stock income' },
  sale: { ru: 'Продажа товара', en: 'Product sale' },
  writeoffService: { ru: 'Списание расходников', en: 'Consumables write-off' },
  writeoffProduct: { ru: 'Списание товара', en: 'Product write-off' },
  move: { ru: 'Перемещение товара', en: 'Stock transfer' },
};

export function docLineTotal(doc: OperationDoc): Money {
  return doc.lines.reduce((sum, l) => sum + l.costTotal, 0);
}

// ─────────────────────────── Оборудование (F-00-141) ───────────────────────────

export interface EquipmentItem {
  id: Id;
  businessId: Id;
  locationId: Id;
  name: string;
  category?: string;
  purchaseDate: ISODate;
  warrantyUntil?: ISODate;
  serviceIntervalMonths?: number;
  lastServiceDate?: ISODate;
  /** «через год поменять» — дата напоминания о замене */
  replaceReminderDate?: ISODate;
  comment?: string;
  archived: boolean;
  createdAt: ISODateTime;
}

// ─────────────────────────── Инвентаризация (F-08-079…089, F-00-135) ───────────────────────────

export type InventoryStatus = 'draft' | 'done';

export interface InventoryLine {
  goodId: Id;
  /** Расчётный остаток на момент создания/пересчёта, в единицах продажи (F-08-082) */
  calcQty: number;
  /** Фактический остаток, введённый вручную или сканером; не заполнено = ещё не считали (F-08-082) */
  actualQty?: number;
}

export interface Inventory {
  id: Id;
  businessId: Id;
  locationId: Id;
  number: string;
  warehouseId: Id;
  /** Пусто = «Все категории» (F-08-080) */
  categoryId?: Id;
  date: ISODateTime;
  comment?: string;
  status: InventoryStatus;
  lines: InventoryLine[];
  /** F-08-084: документы, созданные при проведении */
  writeoffDocId?: Id;
  incomeDocId?: Id;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

/** F-08-082: расхождение факт − расчёт; отрицательное — к списанию, положительное — в приход */
export function inventoryDiff(line: InventoryLine): number {
  return (line.actualQty ?? line.calcQty) - line.calcQty;
}

// ─────────────────────────── Технологические карты (F-08-036…045, F-00-136) ───────────────────────────

export interface TechCardLine {
  goodId: Id;
  /** Склад, с которого спишется расходник (F-08-037, F-08-009) */
  warehouseId: Id;
  /** В единицах списания товара (F-08-037) */
  qtyWriteoff: number;
}

/** Техкарта — у КАЖДОГО мастера своя (F-08-039); пакет услуг считает сумму входящих (F-08-040) */
export interface TechCard {
  id: Id;
  businessId: Id;
  locationId: Id;
  serviceId: Id;
  staffId: Id;
  lines: TechCardLine[];
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

// ─────────────────────────── Настройки склада (F-08-096…100) ───────────────────────────

/** F-08-097: алгоритм себестоимости — три варианта из ТЗ */
export type CostMethod = 'lastPurchase' | 'average' | 'fromGoodSettings';

export interface StockSettings {
  businessId: Id;
  costMethod: CostMethod;
  /** F-08-099 (b04): запрет операций при нехватке остатка — поле уже здесь, включение — следующая пачка */
  forbidOnShortage: boolean;
  /** F-00-140 (b04): за сколько дней предупреждать об истечении срока, настраиваемо */
  expiryWarningDays: number;
  /**
   * F-00-165 (В-26): «получать предложения поставщиков рядом с товаром на исходе» — переключатель мастера.
   * Настоящий источник согласия — `platform.bizMeta[businessId].adsOptIn` (F-00-164, наша панель), но там
   * писать может только платформа (`platform.access`). Пока не заведён бизнес-доступный сеттер (см. запрос
   * в qa/requests/stock.md), склад держит своё согласие тут и подбирает объявления `pl_stock` сам —
   * qa/requests/stock.md 2026-09-26 «Бизнес-доступный setAdsOptIn».
   */
  adsOptIn: boolean;
  /** Ск15: последний поставщик экрана «Заказать» — чтобы не выбирать его каждый раз */
  orderSupplier?: OrderSupplier;
}

export interface OrderSupplier {
  /** Контрагент из справочника финансов, если выбран оттуда */
  counterpartyId?: Id;
  name?: string;
  phone: string;
}

export function defaultStockSettings(businessId: Id): StockSettings {
  return { businessId, costMethod: 'lastPurchase', forbidOnShortage: false, expiryWarningDays: EXPIRY_WARNING_DAYS, adsOptIn: false };
}

// ─────────────────────────── История изменений (⭐ F-00-040) ───────────────────────────

export type HistoryEntityType = 'good' | 'warehouse' | 'category' | 'equipment' | 'operation' | 'techCard' | 'permissions';

export interface HistoryEntry {
  id: Id;
  businessId: Id;
  entityType: HistoryEntityType;
  entityId: Id;
  staffName: string;
  at: ISODateTime;
  summary: string;
}

// ─────────────────────────── Ценники (F-08-093…095) ───────────────────────────

export type PriceTagSize = 'small' | 'medium' | 'large';
export type PriceTagOrientation = 'portrait' | 'landscape';

export interface PriceTagLayout {
  businessId: Id;
  size: PriceTagSize;
  orientation: PriceTagOrientation;
  showBarcode: boolean;
  showSku: boolean;
  showBrand: boolean;
  /** Копий по умолчанию для каждого выбранного товара (F-08-094) */
  copiesDefault: number;
}

export function defaultPriceTagLayout(businessId: Id): PriceTagLayout {
  return { businessId, size: 'medium', orientation: 'portrait', showBarcode: true, showSku: false, showBrand: true, copiesDefault: 1 };
}

export const PRICE_TAG_SIZE_MM: Record<PriceTagSize, { w: number; h: number }> = {
  small: { w: 30, h: 20 },
  medium: { w: 58, h: 40 },
  large: { w: 90, h: 50 },
};

// ─────────────────────────── Права раздела (F-08-109…118) ───────────────────────────

/** ⭐ мелкое право «Товары» — детальнее ядровых stock.view/stock.edit; хранится в своём срезе по staffId,
 * пока в ядре нет места для прав раздела (просьба фундаменту — qa/requests/stock.md). Галочки рисует staff. */
export type MovementHistoryDepth = 7 | 30 | 90 | 180 | 'all' | 'none';

export interface StockStaffPermissions {
  warehouseAccess: 'all' | Id[];
  viewCost: boolean;
  movementHistoryDays: MovementHistoryDepth;
  canCreateOps: boolean;
  canEditOps: boolean;
  canDeleteOps: boolean;
  canMoveOps: boolean;
  excelExport: boolean;
  inventoryView: boolean;
  inventoryCreate: boolean;
  inventoryEdit: boolean;
  inventoryDelete: boolean;
  manageGoods: boolean;
  /** F-08-117: правка расходников/цены товара в окне записи */
  bookingWindowEdit: boolean;
  /** F-08-118: правка техкарты у услуги */
  techCardEdit: boolean;
}

/** База по умолчанию: полный доступ ⇒ всё включено; только «Просмотр» ⇒ смотреть, не менять; ни одного ⇒ ничего (раздел скрыт выше по дереву прав) */
export function defaultStockPermissions(base: { edit: boolean; view: boolean }): StockStaffPermissions {
  const full = base.edit;
  const some = base.edit || base.view;
  return {
    warehouseAccess: 'all',
    viewCost: full,
    movementHistoryDays: full ? 'all' : 30,
    canCreateOps: full,
    canEditOps: full,
    canDeleteOps: full,
    canMoveOps: full,
    excelExport: full,
    inventoryView: some,
    inventoryCreate: full,
    inventoryEdit: full,
    inventoryDelete: full,
    manageGoods: full,
    bookingWindowEdit: full,
    techCardEdit: full,
  };
}

// ─────────────────────────── Шаблоны ролей → права на склад (F-08-149) ───────────────────────────

/**
 * F-08-149: «состав прав склада в каждом шаблоне — решить» (❓ в ТЗ не записано нигде, кроме владельца).
 * ⭐ Наше решение: 8 шаблонов ролей уже строит `staff` (`StaffRoleTemplateId`, `ROLE_TEMPLATES` —
 * `@/domain/staff`); здесь — что из блока «Товары» получает каждый шаблон по умолчанию. Выбор шаблона
 * ставит это как стартовый набор, дальше владелец правит галочками как обычно (ничего не запирает).
 * Логика по «Готово, когда»: специалист (мастер со своими материалами) — сам приход/списание,
 * без себестоимости и инвентаризации (справка 1417); колл-центр и «только просмотр» — минимум;
 * бухгалтер — только цифры (себестоимость, выгрузка, вся история), без операций; менеджер/владелец —
 * полный доступ; администратор — товары и операции без удаления документов и правки техкарт (владелец, 01.10.2026).
 */
export const STOCK_ROLE_TEMPLATE_IDS = [
  'owner',
  'manager',
  'admin',
  'accountant',
  'callCenter',
  'specialist',
  'systemManager',
  'viewer',
] as const;

export type StockRoleTemplateId = (typeof STOCK_ROLE_TEMPLATE_IDS)[number];

export function stockPermissionsForRoleTemplate(templateId: StockRoleTemplateId): StockStaffPermissions {
  switch (templateId) {
    case 'owner':
    case 'manager':
      return defaultStockPermissions({ edit: true, view: true });
    case 'admin':
      return {
        ...defaultStockPermissions({ edit: true, view: true }),
        canDeleteOps: false,
        inventoryDelete: false,
        // Владелец 01.10.2026: администратор ведёт товары (карточки), приход, продажу и списание
        techCardEdit: false,
      };
    case 'accountant':
      return {
        ...defaultStockPermissions({ edit: false, view: true }),
        viewCost: true,
        excelExport: true,
        movementHistoryDays: 'all',
        inventoryView: true,
      };
    case 'callCenter':
      return {
        ...defaultStockPermissions({ edit: false, view: true }),
        viewCost: false,
        inventoryView: false,
        movementHistoryDays: 30,
        bookingWindowEdit: false,
      };
    case 'specialist':
      return {
        ...defaultStockPermissions({ edit: false, view: true }),
        canCreateOps: true,
        canMoveOps: true,
        viewCost: false,
        inventoryView: false,
        bookingWindowEdit: true,
        movementHistoryDays: 30,
      };
    case 'systemManager':
      return defaultStockPermissions({ edit: false, view: true });
    case 'viewer':
      return { ...defaultStockPermissions({ edit: false, view: true }), viewCost: false, movementHistoryDays: 7 };
    default:
      return defaultStockPermissions({ edit: false, view: true });
  }
}

// ─────────────────────────── Напоминания (⭐ F-00-142) ───────────────────────────

export type ReminderKind = 'lowStock' | 'expiring' | 'expired' | 'equipmentService' | 'equipmentReplace' | 'custom';

export interface StockReminder {
  id: Id;
  kind: ReminderKind;
  title: string;
  date?: ISODate;
  goodId?: Id;
  equipmentId?: Id;
  /** Кому адресовано: конкретный мастер или весь салон (undefined) */
  staffId?: Id;
  severity: 'info' | 'warning' | 'danger';
}

/** Свой текстовый напоминалка «своими словами» (❓ открыто, делаем лёгкий дополнительный тип — F-00-142) */
export interface CustomReminder {
  id: Id;
  businessId: Id;
  locationId: Id;
  staffId?: Id;
  text: string;
  date: ISODate;
  done: boolean;
  createdAt: ISODateTime;
}

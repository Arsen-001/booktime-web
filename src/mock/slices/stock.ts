import type { Business, CoreData, Id, ISODateTime } from '@/domain/core';
import {
  defaultPriceTagLayout,
  defaultStockSettings,
  newGoodDefaults,
  type Category,
  type CustomReminder,
  type EquipmentItem,
  type Good,
  type HistoryEntry,
  type Inventory,
  type OperationDoc,
  type PriceTagLayout,
  type StockSettings,
  type StockStaffPermissions,
  type TechCard,
  type Warehouse,
} from '@/domain/stock';
import { dayjs, toISODate, toISODateTime } from '@/lib/date';
import { defineSlice } from '@/mock/slice';
import { BIZ } from '@/mock/seed';

/**
 * Срез моковой базы раздела «stock». Принадлежит разделу.
 * Меняете форму данных — поднимите version (срез пересоздастся из seed, остальное не тронется).
 */
export interface StockState {
  warehouses: Warehouse[];
  categories: Category[];
  goods: Good[];
  operations: OperationDoc[];
  equipment: EquipmentItem[];
  history: HistoryEntry[];
  inventories: Inventory[];
  techCards: TechCard[];
  settings: Record<Id, StockSettings>;
  /** F-08-093/094/095 */
  priceTagLayout: Record<Id, PriceTagLayout>;
  /** F-08-109…118: мелкие права по сотруднику — businessId → staffId → права (пусто = дефолт от stock.view/stock.edit) */
  permissions: Record<Id, Record<Id, StockStaffPermissions>>;
  /** ⭐ F-00-142: свои текстовые напоминания */
  customReminders: CustomReminder[];
  /** ⭐ F-00-137: прочитанные строки склада в колокольчике — businessId → id с отпечатком (необязательное, без пересева) */
  bellSeen?: Record<Id, string[]>;
}

/** Бизнесы-черновики (F-00-133/F-08-002): своих складов и товаров нет — экраны раздела показывают пустое состояние */
const EMPTY_BUSINESS_IDS = new Set<Id>([BIZ.empty, BIZ.emptySolo]);

/** Каталог товаров по сфере (⭐ упрощённый представительный набор, не весь ассортимент) */
const CATALOG_BY_SPHERE: Record<string, { category: string; items: { name: string; brand?: string; shade?: string; unit: string; sale: number; cost: number }[] }[]> = {
  nails: [
    {
      category: 'Гель-лаки',
      items: [
        { name: 'Гель-лак «Розовый нюд»', brand: 'OPI', shade: 'нюд', unit: 'bottle', sale: 3000, cost: 1500 },
        { name: 'Гель-лак «Красный классик»', brand: 'OPI', shade: 'красный', unit: 'bottle', sale: 3000, cost: 1500 },
        { name: 'Гель-лак «Бордо»', brand: 'CND', shade: 'бордовый', unit: 'bottle', sale: 3200, cost: 1600 },
        { name: 'Топовое покрытие', brand: 'CND', unit: 'bottle', sale: 3500, cost: 1700 },
      ],
    },
    { category: 'Расходники для маникюра', items: [
      { name: 'Пилка одноразовая 180/240', unit: 'pcs', sale: 300, cost: 120 },
      { name: 'Обезжириватель', unit: 'ml', sale: 2500, cost: 1200 },
    ] },
  ],
  barber: [
    { category: 'Уход', items: [
      { name: 'Воск для укладки', brand: 'Barbicide', unit: 'jar', sale: 4500, cost: 2200 },
      { name: 'Машинка для стрижки (масло)', unit: 'ml', sale: 2000, cost: 900 },
    ] },
    { category: 'Расходники', items: [
      { name: 'Одноразовые бритвы', unit: 'pack', sale: 1500, cost: 700 },
      { name: 'Полотенце одноразовое', unit: 'pack', sale: 2500, cost: 1200 },
    ] },
  ],
  dental: [
    { category: 'Материалы', items: [
      { name: 'Анестетик (карпула)', unit: 'ampoule', sale: 0, cost: 900 },
      { name: 'Пломбировочный материал', unit: 'g', sale: 0, cost: 1400 },
    ] },
    { category: 'Расходники', items: [
      { name: 'Перчатки нитриловые', unit: 'pack', sale: 0, cost: 3500 },
      { name: 'Маски одноразовые', unit: 'pack', sale: 0, cost: 1800 },
    ] },
  ],
  general: [
    { category: 'Расходники', items: [
      { name: 'Салфетки косметические', unit: 'pack', sale: 800, cost: 350 },
      { name: 'Перчатки одноразовые', unit: 'pack', sale: 1200, cost: 600 },
    ] },
    { category: 'Товары для продажи', items: [
      { name: 'Подарочная свеча', unit: 'pcs', sale: 5000, cost: 2200 },
    ] },
  ],
};

/** Тот же хеш, что в src/mock/slices/finance.ts (hashId) — чтобы выбрать тот же визит продажи шампуня */
function financeHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function catalogFor(business: Business): (typeof CATALOG_BY_SPHERE)['general'] {
  const sphere = business.sphereIds[0] ?? 'general';
  return CATALOG_BY_SPHERE[sphere] ?? CATALOG_BY_SPHERE.general;
}

function seed(core: CoreData, now: Date): StockState {
  const warehouses: Warehouse[] = [];
  const categories: Category[] = [];
  const goods: Good[] = [];
  const operations: OperationDoc[] = [];
  const equipment: EquipmentItem[] = [];
  const history: HistoryEntry[] = [];
  const techCards: TechCard[] = [];
  const settings: Record<Id, StockSettings> = {};
  const priceTagLayout: Record<Id, PriceTagLayout> = {};
  const permissions: Record<Id, Record<Id, StockStaffPermissions>> = {};
  const customReminders: CustomReminder[] = [];
  const today = dayjs(now);

  let docSeq = 100000;

  core.businesses.forEach((business) => {
    const locationIds = business.locationIds.length ? business.locationIds : [business.id];
    const isEmpty = EMPTY_BUSINESS_IDS.has(business.id);
    const ownerStaff = core.staff.find((s) => s.id === business.ownerStaffId);
    settings[business.id] = defaultStockSettings(business.id);
    priceTagLayout[business.id] = defaultPriceTagLayout(business.id);
    permissions[business.id] = {};

    locationIds.forEach((locationId, li) => {
      // Склады «Расходники» / «Товары» — у каждого филиала (F-08-004); пустые бизнесы их тоже получают
      // (F-08-002: пустое состояние показывается на складах без товаров, а не на кабинете без складов).
      const wOrderBase = li * 10;
      const wWriteoff: Warehouse = {
        id: `wh_${locationId}_writeoff`,
        businessId: business.id,
        locationId,
        name: 'Расходники',
        type: 'writeoff',
        comment: 'Для учёта расходных материалов',
        order: wOrderBase,
        createdAt: toISODateTime(today.subtract(90, 'day')),
      };
      const wSale: Warehouse = {
        id: `wh_${locationId}_sale`,
        businessId: business.id,
        locationId,
        name: 'Товары',
        type: 'sale',
        comment: 'Для учёта продаж в магазине',
        order: wOrderBase + 1,
        createdAt: toISODateTime(today.subtract(90, 'day')),
      };
      warehouses.push(wWriteoff, wSale);

      if (isEmpty) return;

      // Категория по умолчанию (F-08-010)
      const rootCat: Category = {
        id: `cat_${locationId}_root`,
        businessId: business.id,
        locationId,
        name: 'Основные товары',
        archived: false,
        createdAt: toISODateTime(today.subtract(90, 'day')),
      };
      categories.push(rootCat);

      const catalog = catalogFor(business);
      catalog.forEach((group, gi) => {
        const cat: Category = {
          id: `cat_${locationId}_${gi}`,
          businessId: business.id,
          locationId,
          name: group.category,
          parentId: rootCat.id,
          archived: false,
          createdAt: toISODateTime(today.subtract(80 - gi, 'day')),
        };
        categories.push(cat);

        group.items.forEach((item, ii) => {
          const goodId = `gd_${locationId}_${gi}_${ii}`;
          const critical = ii === 0 ? 2 : 0;
          const desired = ii === 0 ? 10 : 0;
          const warehouseFor = item.sale > 0 && gi === 0 ? wSale : wWriteoff;
          const good: Good = {
            ...newGoodDefaults(),
            id: goodId,
            businessId: business.id,
            locationId,
            categoryId: cat.id,
            name: item.name,
            sku: `SKU-${gi}${ii}-${locationId.slice(-4)}`,
            barcode: `29000000${String(1000 + gi * 10 + ii).padStart(4, '0')}`,
            // F-08-020: флакон продаётся целиком, но списывается миллилитрами (пример из ТЗ) — показывает остаток в обеих единицах
            saleUnit: item.unit,
            writeoffUnit: item.unit === 'bottle' ? 'ml' : item.unit,
            unitRatio: item.unit === 'bottle' ? 10 : 1,
            salePrice: item.sale,
            costPrice: item.cost,
            criticalStock: critical,
            desiredStock: desired,
            brand: item.brand,
            shade: item.shade,
            shadeColorIndex: item.shade ? (ii % 8) + 1 : undefined,
            expiryDate: gi === 0 && ii === 0 ? toISODate(today.add(10, 'day')) : gi === 0 && ii === 1 ? toISODate(today.subtract(3, 'day')) : undefined,
            purchaseDate: toISODate(today.subtract(60, 'day')),
            showToClients: Boolean(item.shade),
            createdAt: toISODateTime(today.subtract(75 - ii, 'day')),
          };
          goods.push(good);

          // Приход — устанавливает начальный остаток (F-08-048, журнал операций b01 — список)
          const incomeQty = 5 + ii * 2;
          docSeq += 1;
          const incomeDate = today.subtract(20 - ii, 'day');
          operations.push({
            id: `op_${goodId}_income`,
            businessId: business.id,
            locationId,
            number: String(docSeq),
            type: 'income',
            date: toISODateTime(incomeDate),
            warehouseId: warehouseFor.id,
            counterpartyName: 'Поставщик ' + (gi + 1),
            paid: true,
            lines: [{ goodId, qtySale: incomeQty, unitPrice: item.cost, costTotal: item.cost * incomeQty }],
            createdAt: toISODateTime(incomeDate),
          });

          // Одна операция расхода для первого товара группы — чтобы список и остаток не были однообразны
          if (ii === 0) {
            docSeq += 1;
            const outDate = today.subtract(5, 'day');
            // QA 30.09: остаётся 1 при критичном 2 — «Заказать» и «Ниже критичного» видны в демо (F-00-137)
            const outQty = incomeQty - 1;
            operations.push({
              id: `op_${goodId}_out`,
              businessId: business.id,
              locationId,
              number: String(docSeq),
              type: warehouseFor.type === 'sale' ? 'sale' : 'writeoffService',
              date: toISODateTime(outDate),
              warehouseId: warehouseFor.id,
              staffId: ownerStaff?.id,
              paid: true,
              lines: [{ goodId, qtySale: -outQty, unitPrice: item.sale || item.cost, costTotal: -(item.cost * outQty) }],
              createdAt: toISODateTime(outDate),
            });
          }
        });
      });
    });

    if (!isEmpty) {
      // Техкарты (F-08-036…045, F-00-136): по одной-две услуги бизнеса, расходники — первые товары локации,
      // у каждого мастера услуги — своя техкарта (F-08-039).
      const businessServices = core.services.filter((sv) => sv.businessId === business.id && sv.staffIds.length > 0).slice(0, 2);
      businessServices.forEach((service, si) => {
        const locationId = locationIds[0];
        const locationGoods = goods.filter((g) => g.locationId === locationId);
        const consumable = locationGoods[si % Math.max(locationGoods.length, 1)];
        if (!consumable) return;
        // QA 30.09: норма и склад строки — как в жизни. Раньше списывался целый флакон (10 мл) с «Расходников»,
        // а товар лежал на «Товарах» — после ~40 пришедших визитов демо показывало «−34 флак.».
        const cardWarehouseId = operations.find((op) => op.id === `op_${consumable.id}_income`)?.warehouseId ?? `wh_${locationId}_writeoff`;
        const cardQty = consumable.writeoffUnit === consumable.saleUnit ? 1 : 0.3;
        const usedByArrived = core.bookings.filter(
          (b) => b.businessId === business.id && b.status === 'arrived' && b.services.some((l) => l.serviceId === service.id && service.staffIds.slice(0, 3).includes(l.staffId)),
        ).length;
        const topUp = Math.ceil((usedByArrived * cardQty) / (consumable.unitRatio || 1));
        if (usedByArrived > 0) {
          docSeq += 1;
          const topUpDate = today.subtract(40, 'day');
          operations.push({
            id: `op_${consumable.id}_income_card`,
            businessId: business.id,
            locationId,
            number: String(docSeq),
            type: 'income',
            date: toISODateTime(topUpDate),
            warehouseId: cardWarehouseId,
            counterpartyName: 'Поставщик 1',
            paid: true,
            lines: [{ goodId: consumable.id, qtySale: topUp, unitPrice: consumable.costPrice, costTotal: consumable.costPrice * topUp }],
            createdAt: toISODateTime(topUpDate),
          });
        }
        service.staffIds.slice(0, 3).forEach((staffId, sti) => {
          const cardId = `tc_${service.id}_${staffId}`;
          techCards.push({
            id: cardId,
            businessId: business.id,
            locationId,
            serviceId: service.id,
            staffId,
            lines: [{ goodId: consumable.id, warehouseId: cardWarehouseId, qtyWriteoff: cardQty }],
            createdAt: toISODateTime(today.subtract(30 - sti, 'day')),
          });
        });
      });

      // QA 01.10 (просьба finance): у двух продаж товара из сида финансов (src/mock/slices/finance.ts, блок
      // «Продажи товара/абонемента/сертификата») — шампунь 6 500 ֏ в визите (наличные) и крем 9 800 ֏ без визита
      // (картой) — теперь есть складской документ «Продажа товара», и остаток списан. Визит и клиент подобраны тем же
      // правилом, что в finance (secondArrived). financeOperationId — постоянный id операции из сида финансов.
      const saleLoc = core.locations.find((l) => l.businessId === business.id);
      const saleWarehouseId = saleLoc ? `wh_${saleLoc.id}_sale` : undefined;
      if (saleLoc && saleWarehouseId && warehouses.some((w) => w.id === saleWarehouseId)) {
        const nowIso = toISODateTime(today);
        const pastArrived = core.bookings
          .filter((b) => b.businessId === business.id && b.status === 'arrived' && !b.deletedAt && b.total > 0)
          .filter((b) => b.start < nowIso && dayjs(b.start).isAfter(today.subtract(14, 'day')))
          .sort((a, b) => (a.start < b.start ? 1 : -1));
        const unpaidExamples = new Set(
          pastArrived
            .filter((b) => dayjs(b.start).isAfter(today.subtract(13, 'day')) && !b.prepayment?.paid)
            .sort((a, b) => financeHash(a.id) - financeHash(b.id))
            .slice(0, 5)
            .map((b) => b.id),
        );
        const secondArrived = pastArrived.filter((b) => !unpaidExamples.has(b.id))[1];
        const saleClientId = secondArrived?.clientId ?? core.clients[0]?.id;
        const careCat: Category = {
          id: `cat_${saleLoc.id}_homecare`,
          businessId: business.id,
          locationId: saleLoc.id,
          name: 'Уход для дома',
          parentId: `cat_${saleLoc.id}_root`,
          archived: false,
          createdAt: toISODateTime(today.subtract(70, 'day')),
        };
        categories.push(careCat);
        const soldGoods = [
          { key: 'shampoo', name: 'Шампунь для домашнего ухода', sale: 6500, cost: 3200, at: today.subtract(4, 'day').hour(16).minute(10), method: 'cash' as const, bookingId: secondArrived?.id, needsBooking: true },
          { key: 'cream', name: 'Крем для рук', sale: 9800, cost: 4800, at: today.subtract(2, 'day').hour(12).minute(45), method: 'card' as const, bookingId: undefined, needsBooking: false },
        ];
        soldGoods.forEach((item, idx) => {
          const goodId = `gd_${saleLoc.id}_${item.key}`;
          goods.push({
            ...newGoodDefaults(),
            id: goodId,
            businessId: business.id,
            locationId: saleLoc.id,
            categoryId: careCat.id,
            name: item.name,
            sku: `SKU-HC${idx}-${saleLoc.id.slice(-4)}`,
            barcode: `29000000${String(2000 + idx).padStart(4, '0')}`,
            saleUnit: 'pcs',
            writeoffUnit: 'pcs',
            unitRatio: 1,
            salePrice: item.sale,
            costPrice: item.cost,
            purchaseDate: toISODate(today.subtract(30, 'day')),
            showToClients: false,
            createdAt: toISODateTime(today.subtract(30, 'day')),
          });
          docSeq += 1;
          operations.push({
            id: `op_${goodId}_income`,
            businessId: business.id,
            locationId: saleLoc.id,
            number: String(docSeq),
            type: 'income',
            date: toISODateTime(today.subtract(30, 'day')),
            warehouseId: saleWarehouseId,
            counterpartyName: 'Поставщик 1',
            paid: true,
            lines: [{ goodId, qtySale: 6, unitPrice: item.cost, costTotal: item.cost * 6 }],
            createdAt: toISODateTime(today.subtract(30, 'day')),
          });
          if (item.needsBooking && !item.bookingId) return; // в finance этой продажи тоже нет
          docSeq += 1;
          operations.push({
            id: `op_${goodId}_sale`,
            businessId: business.id,
            locationId: saleLoc.id,
            number: String(docSeq),
            type: 'sale',
            date: toISODateTime(item.at),
            warehouseId: saleWarehouseId,
            clientId: saleClientId,
            bookingId: item.bookingId,
            staffId: ownerStaff?.id,
            paid: true,
            paymentMethod: item.method,
            // Операция кассы из сида финансов — у неё постоянный id (op_goods_<бизнес>_<товар>)
            financeOperationId: `op_goods_${business.id}_${item.key}`,
            lines: [{ goodId, qtySale: -1, unitPrice: item.sale, costTotal: -item.cost }],
            createdAt: toISODateTime(item.at),
          });
        });
      }

      // Оборудование (F-00-141) — по одному-два предмета на бизнес
      const eq1: EquipmentItem = {
        id: `eq_${business.id}_1`,
        businessId: business.id,
        locationId: locationIds[0],
        name: business.kind === 'individual' ? 'Стерилизатор' : 'Кресло мастера',
        purchaseDate: toISODate(today.subtract(200, 'day')),
        warrantyUntil: toISODate(today.add(165, 'day')),
        serviceIntervalMonths: 6,
        lastServiceDate: toISODate(today.subtract(20, 'day')),
        replaceReminderDate: toISODate(today.add(165, 'day')),
        archived: false,
        createdAt: toISODateTime(today.subtract(200, 'day')),
      };
      equipment.push(eq1);
      history.push({
        id: `hs_${eq1.id}`,
        businessId: business.id,
        entityType: 'equipment',
        entityId: eq1.id,
        staffName: ownerStaff?.name ?? 'Система',
        at: eq1.createdAt,
        summary: 'Оборудование добавлено',
      });
    }
  });

  return { warehouses, categories, goods, operations, equipment, history, inventories: [], techCards, settings, priceTagLayout, permissions, customReminders };
}

export const stockSlice = defineSlice<StockState>({
  version: 10,
  seed,
});

// Переэкспорт для api-функций (избегаем циклического импорта типов из '@/domain/stock' в api-файле напрямую).
export type { ISODateTime };

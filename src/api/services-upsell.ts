'use client';

/**
 * ⭐ Допродажа при записи (владелец, 01.10.2026). Карточка услуги хранит «Сопутствующие услуги и товары»
 * (ServiceExtra.upsell, пишет saveServiceForm). Клиент при онлайн-записи (виджет, ссылка, приложение, каталог)
 * видит их одним блоком: услуга продлевает запись у того же мастера и предлагается, только если мастер её делает и
 * продлённое время свободно; товар — строка «товары визита» к оплате на месте (обычная продажа склада после оплаты),
 * предлагается, только если на складе продаж филиала есть остаток сверх отложенного к будущим записям.
 * Окно записи показывает те же подсказки для быстрого добавления. Сервер (режим api) повторяет эти правила сам.
 *
 * Синхронные `*Tx` — для api других разделов внутри их request() (одна операция = одна транзакция мока).
 */
import { readArea, readCore } from '@/api/area';
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { computeFreeSlots } from '@/api/schedule';
import * as U from '@/api/services-upsell.server';
import { computeLevels } from '@/api/stock';
import type { CoreData, Id, Service } from '@/domain/core';
import type { BookingGoodsLine } from '@/domain/journal';
import type {
  ServiceUpsell,
  UpsellCandidates,
  UpsellOffers,
  UpsellOffersQuery,
  UpsellProductOffer,
  UpsellServiceOffer,
  UpsellStats,
} from '@/domain/services';
import { addDays, nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';

const CANCELLED = new Set(['cancelled_by_client', 'cancelled_by_master', 'no_show']);
const upper = (s: Pick<Service, 'durationMin' | 'durationMax'>) => (s.durationMax && s.durationMax > s.durationMin ? s.durationMax : s.durationMin);

/** Сопутствующие услуги (мок): нет поля — пусто */
export function upsellOfTx(serviceId: Id): ServiceUpsell {
  const u = readArea('services').serviceExtra[serviceId]?.upsell;
  return { serviceIds: u?.serviceIds ?? [], productIds: u?.productIds ?? [] };
}

/** Кандидат → основная услуга записи (первая, у которой он в списке) */
function parentMap(mainIds: Id[]): { services: Map<Id, Id>; products: Map<Id, Id> } {
  const services = new Map<Id, Id>();
  const products = new Map<Id, Id>();
  for (const id of mainIds) {
    const cfg = upsellOfTx(id);
    for (const x of cfg.serviceIds) if (!services.has(x)) services.set(x, id);
    for (const x of cfg.productIds) if (!products.has(x)) products.set(x, id);
  }
  return { services, products };
}

/** Остаток на складах продаж филиала минус отложенное к будущим неоплаченным записям (товары-допродажи) */
function productLeft(core: CoreData, businessId: Id, locationId: Id, productIds: Id[]): Map<Id, number> {
  const out = new Map<Id, number>();
  if (!productIds.length) return out;
  const stock = readArea('stock');
  const saleIds = new Set(stock.warehouses.filter((w) => w.businessId === businessId && w.locationId === locationId && w.type === 'sale').map((w) => w.id));
  for (const id of productIds) out.set(id, computeLevels(businessId, id).filter((l) => saleIds.has(l.warehouseId)).reduce((s, l) => s + l.qty, 0));
  const now = nowDateTime();
  const extras = readArea('journal').extras;
  for (const b of core.bookings) {
    if (b.businessId !== businessId || b.locationId !== locationId || b.deletedAt || b.start < now || CANCELLED.has(b.status)) continue;
    const e = extras[b.id];
    if (!e || (e.paidAmount ?? 0) > 0) continue;
    for (const l of e.goodsLines ?? []) if (l.upsellOf && out.has(l.itemId)) out.set(l.itemId, (out.get(l.itemId) ?? 0) - Math.max(1, l.qty || 1));
  }
  return out;
}

/** Что предложить к услугам записи в это время у этого мастера — чистый расчёт для request() */
export function upsellOffersTx(q: UpsellOffersQuery): UpsellOffers {
  const core = readCore();
  const empty: UpsellOffers = { services: [], products: [] };
  const staff = core.staff.find((s) => s.id === q.staffId);
  if (!staff || !q.serviceIds.length || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(q.start)) return empty;
  const mains = q.serviceIds.map((id) => core.services.find((s) => s.id === id && s.businessId === staff.businessId && s.active)).filter((s): s is Service => Boolean(s));
  if (!mains.length) return empty;
  const map = parentMap(mains.map((s) => s.id));
  const added = (q.added ?? []).filter((id) => map.services.has(id));
  const taken = new Set([...q.serviceIds, ...added]);
  const base = [...mains, ...added.map((id) => core.services.find((s) => s.id === id)).filter((s): s is Service => Boolean(s))];
  const baseMin = base.reduce((a, s) => a + s.durationMin, 0);
  const baseMax = base.reduce((a, s) => a + upper(s), 0);
  const baseBuf = Math.max(0, ...base.map((s) => s.bufferAfterMin ?? 0));
  const locationId = q.locationId ?? staff.locationIds[0];
  const date = q.start.slice(0, 10);

  const services: UpsellServiceOffer[] = [];
  for (const [id, parent] of map.services) {
    if (taken.has(id)) continue;
    const c = core.services.find((s) => s.id === id && s.businessId === staff.businessId);
    if (!c || !c.active || !c.onlineBookable || c.kind !== 'individual' || c.servicePackage) continue;
    if (!(c.staffIds.includes(staff.id) || staff.serviceIds.includes(c.id))) continue;
    const min = baseMin + c.durationMin;
    const max = baseMax + upper(c);
    const fits = computeFreeSlots(core, {
      staffId: staff.id,
      date,
      durationMin: min,
      durationMax: max > min ? max : undefined,
      bufferAfterMin: Math.max(baseBuf, c.bufferAfterMin ?? 0),
      locationId,
      serviceId: mains[0].id,
    }).some((s) => s.start === q.start);
    if (!fits) continue;
    services.push({
      serviceId: c.id,
      parentServiceId: parent,
      name: c.name,
      durationMin: c.durationMin,
      ...(c.durationMax && c.durationMax > c.durationMin ? { durationMax: c.durationMax } : {}),
      priceMin: c.priceMin,
      ...(c.priceMax && c.priceMax > c.priceMin ? { priceMax: c.priceMax } : {}),
    });
  }

  const products: UpsellProductOffer[] = [];
  if (locationId && map.products.size) {
    const goods = readArea('stock').goods.filter((g) => map.products.has(g.id) && g.businessId === staff.businessId && g.locationId === locationId && !g.archived);
    const left = productLeft(core, staff.businessId, locationId, goods.map((g) => g.id));
    for (const g of goods) {
      const n = Math.floor(left.get(g.id) ?? 0);
      if (n <= 0 || g.salePrice <= 0) continue;
      products.push({ productId: g.id, parentServiceId: map.products.get(g.id)!, name: g.clientName?.ru ? g.clientName : { ru: g.name }, price: g.salePrice, left: n });
    }
  }
  const order = [...map.services.keys()];
  const pOrder = [...map.products.keys()];
  services.sort((a, b) => order.indexOf(a.serviceId) - order.indexOf(b.serviceId));
  products.sort((a, b) => pOrder.indexOf(a.productId) - pOrder.indexOf(b.productId));
  return { services, products };
}

/** Публично: сопутствующие к записи (виджет, ссылка, приложение, каталог) */
export function getUpsellOffers(q: UpsellOffersQuery): Promise<UpsellOffers> {
  if (isApiMode()) return U.getUpsellOffersServer(q);
  return request(() => upsellOffersTx(q));
}

/**
 * Строки сопутствующих услуг для записи: каждая — из списка одной из основных услуг. Мастер, онлайн и время
 * проверяет сам поток записи (как у любой строки). Ошибка — ApiError('upsell_unavailable').
 */
export function upsellServiceLinesTx(mainServiceIds: Id[], addOnIds: Id[] | undefined): { serviceId: Id; upsellOf: Id }[] {
  const ids = [...new Set(addOnIds ?? [])].filter((id) => !mainServiceIds.includes(id));
  if (!ids.length) return [];
  const map = parentMap(mainServiceIds);
  return ids.map((id) => {
    const parent = map.services.get(id);
    if (!parent) throw new ApiError('upsell_unavailable', 'Эту услугу нельзя добавить к записи');
    return { serviceId: id, upsellOf: parent };
  });
}

/** Товарные строки визита из выбранных клиентом товаров: цена склада, продавец — мастер, остаток проверен */
export function upsellGoodsLinesTx(args: { businessId: Id; locationId: Id; staffId: Id; mainServiceIds: Id[]; productIds: Id[] | undefined }): BookingGoodsLine[] {
  const ids = [...new Set(args.productIds ?? [])];
  if (!ids.length) return [];
  const map = parentMap(args.mainServiceIds);
  const goods = readArea('stock').goods;
  const left = productLeft(readCore(), args.businessId, args.locationId, ids);
  return ids.map((id) => {
    const g = goods.find((x) => x.id === id && x.businessId === args.businessId && x.locationId === args.locationId && !x.archived);
    const parent = map.products.get(id);
    if (!g || !parent || (left.get(id) ?? 0) < 1) throw new ApiError('upsell_unavailable', 'Этот товар закончился');
    return { id: newId('gl'), itemId: id, qty: 1, price: g.salePrice, discountPct: 0, sellerId: args.staffId, upsellOf: parent };
  });
}

/** Карточка услуги: из чего выбирать сопутствующие */
export function listUpsellCandidates(businessId: Id): Promise<UpsellCandidates> {
  if (isApiMode()) return U.listUpsellCandidatesServer(businessId);
  return request(() => {
    const core = readCore();
    const locations = core.locations.filter((l) => l.businessId === businessId);
    const multi = locations.length > 1;
    return {
      services: core.services
        .filter((s) => s.businessId === businessId && s.active && s.kind === 'individual' && !s.servicePackage)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId, durationMin: s.durationMin, priceMin: s.priceMin, ...(s.priceMax && s.priceMax > s.priceMin ? { priceMax: s.priceMax } : {}) })),
      products: readArea('stock')
        .goods.filter((g) => g.businessId === businessId && !g.archived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ id: g.id, name: g.name, price: g.salePrice, locationId: g.locationId, ...(multi ? { locationName: locations.find((l) => l.id === g.locationId)?.name } : {}) })),
    };
  });
}

/** «Допродано»: сколько сопутствующих взяли к этой услуге за 90 дней (без отменённых записей) */
export function getUpsellStats(businessId: Id, serviceId: Id): Promise<UpsellStats> {
  if (isApiMode()) return U.getUpsellStatsServer(businessId, serviceId);
  return request(() => {
    const days = 90;
    const since = `${addDays(today(), -days)}T00:00`;
    const extras = readArea('journal').extras;
    let services = 0;
    let products = 0;
    let revenue = 0;
    for (const b of readCore().bookings) {
      if (b.businessId !== businessId || b.deletedAt || b.start < since || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master') continue;
      for (const l of b.services) if (l.upsellOf === serviceId) { const n = Math.max(1, l.qty || 1); services += n; revenue += l.price * n; }
      for (const g of extras[b.id]?.goodsLines ?? []) if (g.upsellOf === serviceId) { const n = Math.max(1, g.qty || 1); products += n; revenue += g.price * n; }
    }
    return { days, accepted: services + products, services, products, revenue };
  });
}

/** Окно записи: сопутствующие всех услуг бизнеса — подсказки «Предложить клиенту» (только непустые) */
export function listUpsellConfigs(businessId: Id): Promise<Record<Id, ServiceUpsell>> {
  if (isApiMode()) return U.listUpsellConfigsServer(businessId);
  return request(() => {
    const out: Record<Id, ServiceUpsell> = {};
    const extra = readArea('services').serviceExtra;
    for (const s of readCore().services) {
      if (s.businessId !== businessId || !s.active) continue;
      const u = extra[s.id]?.upsell;
      if (u && (u.serviceIds.length || u.productIds.length)) out[s.id] = u;
    }
    return out;
  });
}

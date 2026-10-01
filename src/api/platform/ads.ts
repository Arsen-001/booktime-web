'use client';

/**
 * Реклама (F-00-163…166): баннеры и предложения поставщиков ставим только мы, поставщик — имя и контакт без аккаунта,
 * отчёт — только показы и нажатия. Места сторис (F-00-160): фиксированное число мест и очередь по цене.
 */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { DistrictId, ISODate, Id } from '@/domain/core';
import {
  adState,
  storyPriceForTaken,
  storyQueuePrice,
  type Ad,
  type AdContext,
  type AdInput,
  type AdPlacement,
  type AdReach,
  type AdSize,
  type AdView,
  type StoryBoard,
  type StoryBooking,
  type StoryPlacesConfig,
  type StoryPlacesInfo,
  type StoryQuote,
} from '@/domain/platform';
import { addDays, nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { AREA, PANEL, businessNameOf } from '@/api/platform/shared';
import * as S from '@/api/platform/ads.server';

/** Места показа рекламы (справочник) */
const PLACEMENTS: AdPlacement[] = [
  { id: 'pl_banner_home', kind: 'banner', audience: 'client', name: { ru: 'Главная приложения, вверху', en: 'App home, top' }, pricePerDay: 5000, active: true },
  { id: 'pl_banner_search', kind: 'banner', audience: 'client', name: { ru: 'Поиск, над результатами', en: 'Search, above results' }, pricePerDay: 4000, active: true },
  { id: 'pl_supplier_masters', kind: 'supplier', audience: 'business', name: { ru: 'Кабинет мастера: предложения', en: 'Business workspace: offers' }, pricePerDay: 3000, active: true },
  { id: 'pl_stock', kind: 'supplier', audience: 'business', name: { ru: 'Склад: рядом с товаром на исходе', en: 'Stock: next to a running-low item' }, pricePerDay: 2000, active: true },
];

function toAdView(ad: Ad): AdView {
  const totals = Object.values(ad.stats).reduce((acc, d) => ({ views: acc.views + d.views, clicks: acc.clicks + d.clicks }), { views: 0, clicks: 0 });
  return { ...ad, state: adState(ad, today()), views: totals.views, clicks: totals.clicks, placementName: PLACEMENTS.find((p) => p.id === ad.placementId)?.name };
}

export function listAdPlacements(): Promise<AdPlacement[]> {
  if (isApiMode()) return S.listAdPlacements();
  return request(() => PLACEMENTS);
}

export function listAds(filter?: { kind?: Ad['kind'] }): Promise<AdView[]> {
  if (isApiMode()) return S.listAds(filter);
  return request(
    () =>
      readArea(AREA)
        .ads.filter((a) => !filter?.kind || a.kind === filter.kind)
        .map(toAdView)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    PANEL,
  );
}

export function createAd(input: AdInput): Promise<Ad> {
  if (isApiMode()) return S.createAd(input);
  return request(() => {
    if (!input.title.trim() || !input.placementId) throw new ApiError('validation');
    if (input.endDate < input.startDate) throw new ApiError('validation', 'dates');
    const ad: Ad = { ...input, title: input.title.trim(), id: newId('ad'), paused: input.paused ?? false, stats: {}, createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.ads.unshift(ad);
    });
    return ad;
  }, PANEL);
}

export function setAdPaused(id: Id, paused: boolean): Promise<Ad> {
  if (isApiMode()) return S.setAdPaused(id, paused);
  return request(() => {
    let result: Ad | undefined;
    mutateArea(AREA, (s) => {
      const ad = s.ads.find((a) => a.id === id);
      if (!ad) throw new ApiError('not_found');
      ad.paused = paused;
      result = ad;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

function businessAdSize(core: ReturnType<typeof readCore>, businessId: Id): AdSize {
  const business = core.businesses.find((b) => b.id === businessId);
  if (!business) return 'any';
  if (business.kind === 'individual') return 'individual';
  const staffCount = core.staff.filter((s) => s.businessId === businessId && s.status === 'active').length;
  return staffCount > 3 ? 'salonLarge' : 'salonSmall';
}

/** Для приложения клиента и кабинета: объявления места на дату. Поставщик — только тем, кто сам согласился (F-00-164). */
export function getActiveAds(placementId: Id, ctx: AdContext = {}): Promise<AdView[]> {
  if (isApiMode()) return S.getActiveAds(placementId, ctx);
  return request(() => {
    const t = ctx.date ?? today();
    const area = readArea(AREA);
    const placement = PLACEMENTS.find((p) => p.id === placementId);
    if (placement?.audience === 'business' && ctx.businessId && !area.bizMeta[ctx.businessId]?.adsOptIn) return [];
    const size = ctx.businessId ? businessAdSize(readCore(), ctx.businessId) : undefined;
    return area.ads
      .filter((a) => a.placementId === placementId && !a.paused && a.startDate <= t && a.endDate >= t)
      .filter((a) => !ctx.sphereId || a.target.sphereIds.length === 0 || a.target.sphereIds.includes(ctx.sphereId))
      .filter((a) => !ctx.district || a.target.districts.length === 0 || a.target.districts.includes(ctx.district))
      .filter((a) => !size || a.target.size === 'any' || a.target.size === size)
      .map(toAdView);
  });
}

/** F-00-165: предложение поставщика у товара на исходе — только в даты объявления, по ключевым словам, и только согласившимся */
export function getStockOffer(businessId: Id, productName: string): Promise<AdView | undefined> {
  if (isApiMode()) return S.getStockOffer(businessId, productName);
  return request(() => {
    const area = readArea(AREA);
    if (!area.bizMeta[businessId]?.adsOptIn) return undefined;
    const t = today();
    const name = productName.toLowerCase();
    const ad = area.ads.find(
      (a) => a.placementId === 'pl_stock' && !a.paused && a.startDate <= t && a.endDate >= t && a.productKeywords.some((k) => name.includes(k.toLowerCase())),
    );
    return ad ? toAdView(ad) : undefined;
  });
}

function trackAd(id: Id, field: 'views' | 'clicks'): Promise<void> {
  return request(() => {
    mutateArea(AREA, (s) => {
      const ad = s.ads.find((a) => a.id === id);
      if (!ad) return;
      const d = today();
      const day = ad.stats[d] ?? { views: 0, clicks: 0 };
      ad.stats[d] = { ...day, [field]: day[field] + 1 };
    });
  });
}

export const trackAdImpression = (id: Id) => (isApiMode() ? S.trackAdImpression(id) : trackAd(id, 'views'));
export const trackAdClick = (id: Id) => (isApiMode() ? S.trackAdClick(id) : trackAd(id, 'clicks'));

/** Охват рекламы поставщиков: сколько бизнесов её увидит (только согласившиеся, F-00-164) — до отправки, а не после */
export function getAdReach(): Promise<AdReach> {
  if (isApiMode()) return S.getAdReach();
  return request(() => {
    const businesses = readCore().businesses;
    const meta = readArea(AREA).bizMeta;
    return { businesses: businesses.length, optedIn: businesses.filter((b) => meta[b.id]?.adsOptIn).length };
  }, PANEL);
}

// ─────────────────────────── Места сторис (F-00-160, F-00-162) ───────────────────────────

export function saveStoryConfig(config: StoryPlacesConfig): Promise<StoryPlacesConfig> {
  if (isApiMode()) return S.saveStoryConfig(config);
  return request(() => {
    if (config.pricePerDay < 0 || config.lastPlacesCount < 0 || config.lastPlacesCount > config.places) throw new ApiError('validation');
    mutateArea(AREA, (s) => {
      s.storyConfig = config;
    });
    return config;
  }, PANEL);
}

/** Настройка «район/город» решает, что считаем «занятым местом» на дату */
function storyBookingsFor(bookings: StoryBooking[], config: StoryPlacesConfig, date: ISODate, district?: DistrictId) {
  return bookings.filter((b) => b.date === date && b.status === 'active' && (config.scope === 'city' || !district || b.district === district));
}

function placesInfo(bookings: StoryBooking[], config: StoryPlacesConfig, date: ISODate, district?: DistrictId): StoryPlacesInfo {
  const day = storyBookingsFor(bookings, config, date, district);
  const taken = day.filter((b) => b.mode === 'place').length;
  return { date, district, total: config.places, taken, queued: day.length - taken, price: storyPriceForTaken(config, taken), queuePrice: storyQueuePrice(config) };
}

export function getStoryBoard(days = 10, district?: DistrictId): Promise<StoryBoard> {
  if (isApiMode()) return S.getStoryBoard(days, district);
  return request(() => {
    const s = readArea(AREA);
    const core = readCore();
    const config = s.storyConfig;
    return {
      config,
      days: Array.from({ length: days }, (_, i) => addDays(today(), i)).map((date) => {
        let queuePosition = 0;
        return {
          ...placesInfo(s.storyBookings, config, date, district),
          bookings: storyBookingsFor(s.storyBookings, config, date, district).map((b) => ({
            ...b,
            businessName: businessNameOf(core, b.businessId) ?? '',
            shown: b.mode === 'place',
            queuePosition: b.mode === 'queue' ? (queuePosition += 1) : undefined,
          })),
        };
      }),
    };
  }, PANEL);
}

/** Для кабинета бизнеса: сколько мест на дату и ближайшие дни со свободными местами */
export function getStoryPlaces(date: ISODate, district?: DistrictId): Promise<StoryQuote> {
  if (isApiMode()) return S.getStoryPlaces(date, district);
  return request(() => {
    const s = readArea(AREA);
    const config = s.storyConfig;
    const info = placesInfo(s.storyBookings, config, date, district);
    const available = info.taken < config.places;
    const alternatives = available
      ? []
      : Array.from({ length: 5 }, (_, i) => placesInfo(s.storyBookings, config, addDays(date, i + 1), district))
          .filter((d) => d.taken < d.total)
          .slice(0, 3);
    return { available, info, alternatives };
  });
}

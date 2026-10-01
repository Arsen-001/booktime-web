'use client';

/**
 * Раздел «platform»: реклама и сторис на настоящем сервере (booktime-backend, PLAN.md §7, этап 19 продолжение;
 * docs/backend/02 §19, 06 §2.3). Функции src/api/platform/ads.ts в режиме `api` зовут эти.
 *
 * getActiveAds/trackAdImpression/trackAdClick/getStockOffer — публичные (без сессии): их зовут AdBanner.tsx
 * (клиент) и stock.ts (кабинет, F-00-165) уже сейчас, сигнатуры держим стабильными.
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { DistrictId, Id, ISODate } from '@/domain/core';
import type { Ad, AdContext, AdInput, AdPlacement, AdReach, AdView, StoryBoard, StoryPlacesConfig, StoryQuote } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listAdPlacements = () => read(() => http<AdPlacement[]>('GET', '/v1/platform/ad-placements'));

export const listAds = (filter?: { kind?: Ad['kind'] }) => read(() => http<AdView[]>('GET', '/v1/platform/ads', undefined, { query: { kind: filter?.kind } }));

export const createAd = (input: AdInput) => write(() => http<AdView>('POST', '/v1/platform/ads', input));

export const setAdPaused = (id: Id, paused: boolean) => write(() => http<AdView>('PUT', `/v1/platform/ads/${id}/pause`, { paused }));

export const getAdReach = () => read(() => http<AdReach>('GET', '/v1/platform/ads/reach'));

export const getActiveAds = (placementId: Id, ctx: AdContext = {}) =>
  read(() => http<AdView[]>('GET', '/v1/public/ads', undefined, { query: { placement: placementId, date: ctx.date, businessId: ctx.businessId, district: ctx.district, sphere: ctx.sphereId } }));

export const getStockOffer = (businessId: Id, productName: string) =>
  read(() => http<AdView | null>('GET', '/v1/public/ads/stock-offer', undefined, { query: { businessId, product: productName } }).then((r) => r ?? undefined));

export const trackAdImpression = (id: Id) => http<void>('POST', `/v1/public/ads/${id}/impression`);
export const trackAdClick = (id: Id) => http<void>('POST', `/v1/public/ads/${id}/click`);

export const saveStoryConfig = (config: StoryPlacesConfig) => write(() => http<StoryPlacesConfig>('PUT', '/v1/platform/story-config', config));

export const getStoryBoard = (days = 10, district?: DistrictId) => read(() => http<StoryBoard>('GET', '/v1/platform/story-board', undefined, { query: { days, district } }));

export const getStoryPlaces = (date: ISODate, district?: DistrictId) => read(() => http<StoryQuote>('GET', '/v1/platform/story-places', undefined, { query: { date, district } }));

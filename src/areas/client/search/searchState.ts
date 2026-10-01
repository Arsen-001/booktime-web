import { DISTRICT_IDS } from '@/config/districts';
import type { AcceptsWhom, DistrictId, SphereId, Workplace } from '@/domain/core';

/** Фильтры поиска клиента — одно состояние экрана (черновик UI, не в базе — CONVENTIONS §18 п.8) */
export interface SearchFilters {
  sphereId?: SphereId;
  district?: DistrictId;
  workplace?: Workplace;
  accepts?: AcceptsWhom;
  material?: string;
  day?: 'today' | 'tomorrow';
  /** Цена «до», ֏ — по цене услуги, под которую показаны окна */
  priceMax?: number;
  /** Время суток окна: утро до 12:00, день 12–17, вечер с 17:00 */
  timeOfDay?: TimeOfDay;
}

export type TimeOfDay = 'morning' | 'day' | 'evening';
export const TIMES_OF_DAY: TimeOfDay[] = ['morning', 'day', 'evening'];
export const PRICE_STEPS = [5000, 10000, 20000, 40000] as const;

/** Окно попадает во время суток (час по Еревану из ISO-строки окна) */
export function inTimeOfDay(start: string, tod: TimeOfDay): boolean {
  const h = Number(start.slice(11, 13));
  return tod === 'morning' ? h < 12 : tod === 'day' ? h >= 12 && h < 17 : h >= 17;
}

/** Фильтры → строка адреса (/search?…): «Назад» с карточки мастера возвращает тот же выбор */
export function filtersToParams(f: SearchFilters, search: string): URLSearchParams {
  const p = new URLSearchParams();
  if (search) p.set('q', search);
  if (f.sphereId) p.set('sphere', f.sphereId);
  if (f.day) p.set('free', f.day);
  if (f.district) p.set('district', f.district);
  if (f.workplace) p.set('where', f.workplace);
  if (f.accepts) p.set('accepts', f.accepts);
  if (f.material) p.set('mat', f.material);
  if (f.priceMax) p.set('price', String(f.priceMax));
  if (f.timeOfDay) p.set('time', f.timeOfDay);
  return p;
}

/** Строка адреса → фильтры (сфера и день проверяет страница; здесь — остальное) */
export function filtersFromParams(sp: Record<string, string | string[] | undefined>): Omit<SearchFilters, 'sphereId' | 'day'> {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const price = Number(one('price'));
  const time = one('time') as TimeOfDay | undefined;
  const where = one('where');
  const accepts = one('accepts');
  const district = one('district');
  return {
    district: DISTRICT_IDS.includes(district as DistrictId) ? (district as DistrictId) : undefined,
    workplace: where === 'salon' || where === 'home' || where === 'visit' ? where : undefined,
    accepts: accepts === 'women' || accepts === 'men' ? accepts : undefined,
    material: one('mat') || undefined,
    priceMax: (PRICE_STEPS as readonly number[]).includes(price) ? price : undefined,
    timeOfDay: time && TIMES_OF_DAY.includes(time) ? time : undefined,
  };
}

/** Последний адрес поиска — куда ведёт «Назад» с карточки мастера и места */
export const LAST_SEARCH_KEY = 'client.lastSearch';

export const EMPTY_FILTERS: SearchFilters = {};

export function countFilters(f: SearchFilters): number {
  return [f.sphereId, f.district, f.workplace, f.accepts, f.material, f.day, f.priceMax, f.timeOfDay].filter(Boolean).length;
}

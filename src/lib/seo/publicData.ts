import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { CatalogEntry, MasterCard, PlaceCard } from '@/api/client';
import { DATA_COOKIE, resolveDataMode } from '@/api/mode';
import type { PublicBusinessData } from '@/api/online';

/**
 * Публичные данные для поисковиков (SEO, 03.10.2026): заголовки, описание, JSON-LD, sitemap и первая отрисовка
 * страницы салона на сервере. Только режим `api` — в моковой сборке данные живут в браузере (демо и так закрыто
 * от индексации). Сервер недоступен или ответил ошибкой — `undefined`/пустой список: страница и sitemap не падают.
 *
 * Кэш Next (fetch + revalidate): страница салона/мастера/места — 5 минут, sitemap — 10 минут (как кэш сервера).
 * Экран всё равно перечитывает данные в браузере, так что кэш влияет только на то, что видят поисковик и первая
 * отрисовка, — и поисковый робот, листающий сотни страниц, не превращается в сотни запросов к API (04.10.2026).
 *
 * 🔴 Только общие для всех данные: запросы идут БЕЗ cookie и заголовков посетителя (fetch на сервере их и не
 * добавляет), поэтому ответ один и тот же для любого человека и его можно делить через кэш. Личное (вошедший
 * человек, «мои записи», избранное) сюда не добавлять — его читает экран в браузере со своей сессией.
 *
 * SSR_SHARED_SECRET (только сервер, docs/DEPLOY.md): заголовок X-BT-SSR — сервер API узнаёт наш SSR и даёт ему
 * повышенный лимит запросов (все посетители сайта приходят к API с нескольких адресов Vercel).
 */

// Тот же адрес, что у src/api/http.ts (тот файл тянет клиентский request.ts — на сервере не импортируем)
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010').replace(/\/$/, '');
const PAGE_REVALIDATE_SEC = 300;
const SITEMAP_REVALIDATE_SEC = 600;
const TIMEOUT_MS = 5000;

/** Заголовки запроса к API с сервера сайта: без cookie посетителя, с секретом SSR, если он задан */
function serverHeaders(): HeadersInit {
  const secret = process.env.SSR_SHARED_SECRET?.trim();
  return { Accept: 'application/json', ...(secret && { 'X-BT-SSR': secret }) };
}

/** Ответ публичного API: данные, «нет такого» (404 — честный 404 странице) или «не знаем» (сеть, 5xx) */
export type Fetched<T> = { ok: true; data: T } | { ok: false; notFound: boolean };

async function getPublic<T>(path: string, revalidate: number): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: serverHeaders(),
      next: { revalidate },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, notFound: res.status === 404 };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, notFound: false };
  }
}

/** Режим данных этого запроса: env сборки, при разработке — ещё cookie ?data=api (как src/proxy.ts) */
async function requestIsApi(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_DATA === 'api') return true;
  if (process.env.NODE_ENV !== 'development') return false;
  return resolveDataMode((await cookies()).get(DATA_COOKIE)?.value) === 'api';
}

const OFF = { ok: false, notFound: false } as const;

/** Всё для публичной страницы /b/<slug> — тот же ответ, что читает экран (getPublicBusinessData) */
export const getPublicBusinessForSeo = cache(async (slug: string): Promise<Fetched<PublicBusinessData>> => {
  if (!(await requestIsApi())) return OFF;
  return getPublic<PublicBusinessData>(`/v1/public/b/${encodeURIComponent(slug)}`, PAGE_REVALIDATE_SEC);
});

/** Карточка мастера /masters/<id> */
export const getMasterForSeo = cache(async (staffId: string): Promise<Fetched<MasterCard>> => {
  if (!(await requestIsApi())) return OFF;
  return getPublic<MasterCard>(`/v1/public/masters/${encodeURIComponent(staffId)}`, PAGE_REVALIDATE_SEC);
});

/** Карточка места /places/<id> — нужна только ради canonical на /b/<slug> */
export const getPlaceForSeo = cache(async (businessId: string): Promise<Fetched<PlaceCard>> => {
  if (!(await requestIsApi())) return OFF;
  return getPublic<PlaceCard>(`/v1/public/places/${encodeURIComponent(businessId)}`, PAGE_REVALIDATE_SEC);
});

/** Бизнес в sitemap — ответ `GET /v1/public/sitemap` сервера (booktime-api, client/sitemap.service.ts) */
export interface SitemapBusiness {
  slug: string;
  kind: 'salon' | 'individual';
  sphereIds: string[];
  districts: string[];
  images: string[];
  updatedAt?: string;
}

export interface SitemapData {
  businesses: SitemapBusiness[];
  /** Мастера салонов (у мастера-одиночки своя страница — /b/<slug>) */
  masters: { id: string; businessSlug?: string; updatedAt?: string }[];
}

const EMPTY_SITEMAP: SitemapData = { businesses: [], masters: [] };

/** Старый сервер без /v1/public/sitemap: тот же список из каталога (тяжелее — сервер считает окна каждому мастеру) */
function sitemapFromCatalog(catalog: CatalogEntry[]): SitemapData {
  const businesses = new Map<string, SitemapBusiness>();
  const masters = new Map<string, SitemapData['masters'][number]>();
  for (const e of catalog) {
    const slug = e.business.slug;
    const b = businesses.get(slug) ?? {
      slug,
      kind: e.business.kind === 'individual' ? 'individual' : 'salon',
      sphereIds: [],
      districts: [],
      images: e.business.photos.filter((p) => /^https?:\/\//.test(p)).slice(0, 5),
    };
    b.sphereIds = [...new Set([...b.sphereIds, ...e.business.sphereIds])];
    const district = e.location?.district;
    if (district && !b.districts.includes(district)) b.districts.push(district);
    businesses.set(slug, b);
    if (b.kind !== 'individual') masters.set(e.staff.id, { id: e.staff.id, businessSlug: slug });
  }
  return { businesses: [...businesses.values()], masters: [...masters.values()] };
}

/**
 * Источник sitemap: опубликованные бизнесы и мастера, которых показывает поиск (без «только мои», «по ссылке» и
 * пустых профилей), — лёгкий список сервера `GET /v1/public/sitemap` (04.10.2026, без расчёта окон, кэш 10 мин на
 * сервере и здесь). Режим — только по env сборки (sitemap кэшируется, cookie не читаем).
 */
export async function listSitemapData(): Promise<SitemapData> {
  if (process.env.NEXT_PUBLIC_DATA !== 'api') return EMPTY_SITEMAP;
  const r = await getPublic<SitemapData>('/v1/public/sitemap', SITEMAP_REVALIDATE_SEC);
  if (r.ok && Array.isArray(r.data?.businesses) && Array.isArray(r.data?.masters)) return r.data;
  if (r.ok || !r.notFound) return EMPTY_SITEMAP;
  const old = await getPublic<CatalogEntry[]>('/v1/public/catalog', SITEMAP_REVALIDATE_SEC);
  return old.ok && Array.isArray(old.data) ? sitemapFromCatalog(old.data) : EMPTY_SITEMAP;
}

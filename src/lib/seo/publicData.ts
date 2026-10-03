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
 * Кэш Next (fetch + revalidate): страница салона — 5 минут, sitemap — час. Экран всё равно перечитывает данные
 * в браузере, так что кэш влияет только на то, что видят поисковик и первая отрисовка.
 */

// Тот же адрес, что у src/api/http.ts (тот файл тянет клиентский request.ts — на сервере не импортируем)
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010').replace(/\/$/, '');
const PAGE_REVALIDATE_SEC = 300;
const SITEMAP_REVALIDATE_SEC = 3600;
const TIMEOUT_MS = 5000;

/** Ответ публичного API: данные, «нет такого» (404 — честный 404 странице) или «не знаем» (сеть, 5xx) */
export type Fetched<T> = { ok: true; data: T } | { ok: false; notFound: boolean };

async function getPublic<T>(path: string, revalidate: number): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
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

/**
 * Каталог «кто когда свободен» без фильтров — источник sitemap: опубликованные бизнесы и мастера, которых
 * показывает поиск (без «только мои» и пустых профилей). Режим — только по env сборки (sitemap кэшируется,
 * cookie не читаем). Отдельного лёгкого эндпоинта для sitemap у сервера пока нет — см. отчёт SEO в DESIGN.md.
 */
export async function listCatalogForSitemap(): Promise<CatalogEntry[]> {
  if (process.env.NEXT_PUBLIC_DATA !== 'api') return [];
  const r = await getPublic<CatalogEntry[]>('/v1/public/catalog', SITEMAP_REVALIDATE_SEC);
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

/**
 * Поисковики (SEO, 03.10.2026): какую сборку можно индексировать и её адрес.
 *
 * Индексируется ТОЛЬКО booktime.am: сборка с настоящим сервером (NEXT_PUBLIC_DATA=api) в production-окружении Vercel.
 * demo.booktime.am (моковая сборка), staging.booktime.am и превью-сборки — Disallow: / в robots.txt и
 * `<meta name="robots" content="noindex">` на каждой странице (root layout).
 *
 * Без импортов Next — файл читают robots.ts, sitemap.ts, layout и серверные страницы.
 */

/** Можно ли этой сборке попадать в поиск */
export function isIndexable(): boolean {
  return process.env.NEXT_PUBLIC_DATA === 'api' && process.env.VERCEL_ENV === 'production';
}

/** Боевой адрес сайта */
export const PRODUCTION_SITE_URL = 'https://booktime.am';

/**
 * Адрес этой сборки без «/» на конце — для canonical, sitemap, og:url. NEXT_PUBLIC_SITE_URL перебивает всё
 * (например, staging.booktime.am); production — booktime.am; превью Vercel — свой адрес; локально — :3710.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (isIndexable()) return PRODUCTION_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3710}`;
}

/** Полный адрес страницы: absoluteUrl('/b/nuri') → https://booktime.am/b/nuri */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

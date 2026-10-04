import type { MetadataRoute } from 'next';
import { CLIENT_SPHERES } from '@/areas/client/ui/sphereIcons';
import type { DistrictId, SphereId } from '@/domain/core';
import { CLIENT_LOCALES } from '@/i18n/config';
import { localeAlternates, localizedPath } from '@/i18n/localePath';
import { listSitemapData } from '@/lib/seo/publicData';
import { searchPath } from '@/lib/seo/searchPath';
import { absoluteUrl, siteUrl } from '@/lib/seo/site';

/**
 * sitemap.xml (SEO, 03.10.2026): главная, «Для бизнеса» (/business, 04.10.2026), юридические страницы (/privacy, /terms,
 * /account-deletion, 04.10.2026), поиск, поиск по сфере и «сфера × район» (только где есть кого показать),
 * страница каждого опубликованного салона/мастера-одиночки /b/<slug> и карточки мастеров салонов /masters/<id>.
 * Источник — лёгкий список сервера `GET /v1/public/sitemap` (04.10.2026: slug, сферы, районы, фото, дата изменения —
 * без расчёта окон, как было через каталог), кэш 10 минут. Сервер недоступен — только статические страницы.
 *
 * Демо (моковая сборка) получает только статические адреса; staging — свои, но обе закрыты в robots.txt.
 * Язык в адресе (03.10.2026, src/i18n/localePath.ts): каждая страница — три адреса (/…, /hy/…, /en/…), у каждого
 * hreflang-альтернативы на все три языка + x-default (ru).
 */
export const revalidate = 600;

/** Строка sitemap → по строке на каждый язык, у каждой — альтернативы всех языков */
function withLocales(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return entries.flatMap((e) => {
    const path = e.url.slice(origin.length) || '/';
    const languages = Object.fromEntries(Object.entries(localeAlternates(path)).map(([l, p]) => [l, absoluteUrl(p)]));
    return CLIENT_LOCALES.map((l) => ({ ...e, url: absoluteUrl(localizedPath(path, l)), alternates: { languages } }));
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/search'), changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/business'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/register-business'), changeFrequency: 'monthly', priority: 0.4 },
    // юридические страницы (04.10.2026)
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/account-deletion'), changeFrequency: 'yearly', priority: 0.2 },
  ];
  const { businesses, masters } = await listSitemapData();
  const spheres = new Set<SphereId>();
  const pairs = new Set<string>();
  for (const b of businesses) {
    for (const s of b.sphereIds as SphereId[]) {
      if (!CLIENT_SPHERES.includes(s)) continue;
      spheres.add(s);
      for (const d of b.districts) pairs.add(`${s}|${d}`);
    }
  }
  const lastModified = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? { lastModified: new Date(iso) } : {});

  for (const s of CLIENT_SPHERES) {
    if (spheres.has(s)) entries.push({ url: absoluteUrl(searchPath(s)), changeFrequency: 'daily', priority: 0.7 });
  }
  for (const key of [...pairs].sort()) {
    const [s, d] = key.split('|') as [SphereId, DistrictId];
    entries.push({ url: absoluteUrl(searchPath(s, d)), changeFrequency: 'daily', priority: 0.6 });
  }
  const seen = new Set<string>();
  for (const b of businesses) {
    if (seen.has(b.slug)) continue;
    seen.add(b.slug);
    const images = b.images.filter((p) => /^https?:\/\//.test(p)).slice(0, 5);
    entries.push({ url: absoluteUrl(`/b/${b.slug}`), changeFrequency: 'weekly', priority: 0.9, ...lastModified(b.updatedAt), ...(images.length > 0 && { images }) });
  }
  // У мастера-одиночки своя страница — /b/<slug>; сервер отдаёт только мастеров салонов
  for (const m of new Map(masters.map((x) => [x.id, x])).values()) {
    entries.push({ url: absoluteUrl(`/masters/${m.id}`), changeFrequency: 'weekly', priority: 0.5, ...lastModified(m.updatedAt) });
  }
  return withLocales(entries);
}

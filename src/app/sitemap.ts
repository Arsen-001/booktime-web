import type { MetadataRoute } from 'next';
import { CLIENT_SPHERES } from '@/areas/client/ui/sphereIcons';
import type { DistrictId, SphereId } from '@/domain/core';
import { listCatalogForSitemap } from '@/lib/seo/publicData';
import { searchPath } from '@/lib/seo/searchPath';
import { absoluteUrl } from '@/lib/seo/site';

/**
 * sitemap.xml (SEO, 03.10.2026): главная, поиск, поиск по сфере и «сфера × район» (только где есть кого показать),
 * страница каждого опубликованного салона/мастера-одиночки /b/<slug> и карточки мастеров салонов /masters/<id>.
 * Источник — публичный каталог сервера, кэш на час. Сервер недоступен — только статические страницы.
 *
 * Демо (моковая сборка) получает только статические адреса; staging — свои, но обе закрыты в robots.txt.
 * Альтернатив hreflang нет: язык сайта — в cookie, адрес у всех языков один (см. DESIGN.md «Поисковики»).
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/search'), changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/register-business'), changeFrequency: 'monthly', priority: 0.4 },
  ];
  const catalog = await listCatalogForSitemap();
  const spheres = new Set<SphereId>();
  const pairs = new Set<string>();
  const businesses = new Map<string, string[]>();
  const masters = new Set<string>();
  for (const e of catalog) {
    const district = e.location?.district;
    for (const s of e.business.sphereIds) {
      if (!CLIENT_SPHERES.includes(s)) continue;
      spheres.add(s);
      if (district) pairs.add(`${s}|${district}`);
    }
    if (!businesses.has(e.business.slug)) {
      businesses.set(e.business.slug, e.business.photos.filter((p) => /^https?:\/\//.test(p)).slice(0, 5));
    }
    // У мастера-одиночки своя страница — /b/<slug>; карточки отдельно — только у мастеров салонов
    if (e.business.kind !== 'individual') masters.add(e.staff.id);
  }

  for (const s of CLIENT_SPHERES) {
    if (spheres.has(s)) entries.push({ url: absoluteUrl(searchPath(s)), changeFrequency: 'daily', priority: 0.7 });
  }
  for (const key of [...pairs].sort()) {
    const [s, d] = key.split('|') as [SphereId, DistrictId];
    entries.push({ url: absoluteUrl(searchPath(s, d)), changeFrequency: 'daily', priority: 0.6 });
  }
  for (const [slug, images] of businesses) {
    entries.push({ url: absoluteUrl(`/b/${slug}`), changeFrequency: 'weekly', priority: 0.9, ...(images.length > 0 && { images }) });
  }
  for (const id of masters) {
    entries.push({ url: absoluteUrl(`/masters/${id}`), changeFrequency: 'weekly', priority: 0.5 });
  }
  return entries;
}

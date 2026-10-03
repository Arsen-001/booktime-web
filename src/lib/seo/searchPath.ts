import type { DistrictId, SphereId } from '@/domain/core';

/**
 * Адрес поиска по сфере и району — один и тот же в sitemap и canonical страницы /search (порядок параметров важен:
 * поисковик сравнивает адреса посимвольно).
 */
export function searchPath(sphere?: SphereId, district?: DistrictId): string {
  const p = new URLSearchParams();
  if (sphere) p.set('sphere', sphere);
  if (district) p.set('district', district);
  const qs = p.toString();
  return qs ? `/search?${qs}` : '/search';
}

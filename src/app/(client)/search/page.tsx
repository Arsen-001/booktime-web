import type { Metadata } from 'next';
import { SearchScreen } from '@/areas/client/search/SearchScreen';
import { filtersFromParams } from '@/areas/client/search/searchState';
import { CLIENT_SPHERES } from '@/areas/client/ui/sphereIcons';
import type { SphereId } from '@/domain/core';
import { districtLabel, seoContext } from '@/lib/seo/describe';
import { pageMetadata } from '@/lib/seo/meta';
import { searchPath } from '@/lib/seo/searchPath';

function sphereFrom(sp: Record<string, string | string[] | undefined>): SphereId | undefined {
  return typeof sp.sphere === 'string' && CLIENT_SPHERES.includes(sp.sphere as SphereId) ? (sp.sphere as SphereId) : undefined;
}

// SEO (03.10.2026): «Маникюр — Кентрон, Ереван…» по сфере и району; canonical — только сфера и район (остальные
// фильтры и «свободно сегодня» — варианты той же страницы). Те же адреса перечисляет sitemap.
export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const sp = await searchParams;
  const ctx = await seoContext();
  const { t, locale } = ctx;
  const sphere = sphereFrom(sp);
  const district = sphere ? filtersFromParams(sp).district : undefined;
  const path = searchPath(sphere, district);
  if (!sphere) return pageMetadata({ title: t('seo.search.title'), description: t('seo.search.description'), path, locale });
  const service = t(`seo.services.${sphere}`);
  const districtName = districtLabel(ctx, district);
  return districtName
    ? pageMetadata({
        title: t('seo.search.sphereDistrictTitle', { service, district: districtName }),
        description: t('seo.search.sphereDistrictDescription', { service, district: districtName }),
        path,
        locale,
      })
    : pageMetadata({ title: t('seo.search.sphereTitle', { service }), description: t('seo.search.sphereDescription', { service }), path, locale });
}

// /search?sphere=nails&free=today|tomorrow&q=…&focus=1 — с главной: сфера, «свободно сегодня», фокус в поле;
// &district=&where=&accepts=&mat=&price=&time= — остальные фильтры (экран пишет их в адрес — «Назад» их не теряет)
export default async function Page({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams;
  const sphere = sphereFrom(sp);
  const free = sp.free === 'today' || sp.free === 'tomorrow' ? sp.free : undefined;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  return <SearchScreen initialSphere={sphere} initialDay={free} initialQuery={q} initialFilters={filtersFromParams(sp)} autoFocus={sp.focus === '1'} />;
}

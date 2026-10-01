import { SearchScreen } from '@/areas/client/search/SearchScreen';
import { filtersFromParams } from '@/areas/client/search/searchState';
import { CLIENT_SPHERES } from '@/areas/client/ui/sphereIcons';
import type { SphereId } from '@/domain/core';

// /search?sphere=nails&free=today|tomorrow&q=…&focus=1 — с главной: сфера, «свободно сегодня», фокус в поле;
// &district=&where=&accepts=&mat=&price=&time= — остальные фильтры (экран пишет их в адрес — «Назад» их не теряет)
export default async function Page({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams;
  const sphere = typeof sp.sphere === 'string' && CLIENT_SPHERES.includes(sp.sphere as SphereId) ? (sp.sphere as SphereId) : undefined;
  const free = sp.free === 'today' || sp.free === 'tomorrow' ? sp.free : undefined;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  return <SearchScreen initialSphere={sphere} initialDay={free} initialQuery={q} initialFilters={filtersFromParams(sp)} autoFocus={sp.focus === '1'} />;
}

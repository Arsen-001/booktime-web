'use client';

import { useEffect, useState } from 'react';
import { useFormat } from '@/i18n/useFormat';
import { MapPin } from 'lucide-react';
import type { CatalogQuery } from '@/api/client';
import { listCatalog } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { track } from '@/lib/analytics';
import { CatalogEntryCard, CatalogEntryCardSkeleton } from '@/areas/client/catalog/CatalogEntryCard';
import { QuickFilters } from '@/areas/client/search/QuickFilters';
import { SearchEmptyResult } from '@/areas/client/search/SearchEmptyResult';
import {
  LAST_SEARCH_KEY,
  PRICE_STEPS,
  TIMES_OF_DAY,
  countFilters,
  filtersToParams,
  inTimeOfDay,
  type SearchFilters,
  type TimeOfDay,
} from '@/areas/client/search/searchState';
import { AdBanner } from '@/areas/client/ui/AdBanner';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { CLIENT_SPHERES } from '@/areas/client/ui/sphereIcons';
import { DISTRICT_IDS } from '@/config/districts';
import { useCurrent } from '@/demo/hooks';
import type { AcceptsWhom, DistrictId, SphereId, Workplace } from '@/domain/core';
import { localizedPath, splitLocalePrefix } from '@/i18n/localePath';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { PermissionPrimer } from '@/ui/onboarding/PermissionPrimer';

const WORKPLACES: Workplace[] = ['salon', 'home', 'visit'];
const ACCEPTS: AcceptsWhom[] = ['women', 'men'];
const PAGE = 10;

export interface SearchScreenProps {
  initialSphere?: SphereId;
  initialDay?: 'today' | 'tomorrow';
  initialQuery?: string;
  /** Остальные фильтры из адреса (вернулись «Назад» с карточки мастера) */
  initialFilters?: Omit<SearchFilters, 'sphereId' | 'day'>;
  /** Пришли с поля поиска на главной — сразу фокус и клавиатура (speed-k1 №2) */
  autoFocus?: boolean;
}

type GeoState = 'off' | 'ask' | 'on' | 'denied';

/** Поиск: кто когда свободен — быстрые фильтры, фильтры с подписями, «рядом со мной» (F-00-108…F-00-112) */
export function SearchScreen({ initialSphere, initialDay, initialQuery = '', initialFilters, autoFocus = false }: SearchScreenProps) {
  const t = useT('client');
  const tc = useT('common');
  const { appUserId } = useCurrent();
  const [search, setSearch] = useState(initialQuery);
  const fmt = useFormat();
  const [filters, setFilters] = useState<SearchFilters>({ ...initialFilters, sphereId: initialSphere, day: initialDay });
  // Материал набирают по буквам — в запрос он уходит после паузы, а не на каждую букву
  const [materialDraft, setMaterialDraft] = useState(initialFilters?.material ?? '');
  const [near, setNear] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [geo, setGeo] = useState<GeoState>('off');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    if (!autoFocus) return;
    document.querySelector<HTMLInputElement>('[data-search-screen] input[type="search"]')?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const value = materialDraft.trim() || undefined;
    if (value === filters.material) return;
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, material: value }));
      setShown(PAGE);
    }, 350);
    return () => clearTimeout(id);
  }, [materialDraft, filters.material]);

  // Выбор живёт в адресе (без перехода и запроса к серверу): «Назад» с карточки мастера возвращает те же фильтры
  useEffect(() => {
    const qs = filtersToParams(filters, search).toString();
    const url = `/search${qs ? `?${qs}` : ''}`;
    // /hy/search, /en/search — язык в адресе сохраняем (src/i18n/localePath.ts)
    const urlLocale = splitLocalePrefix(location.pathname).locale;
    const address = urlLocale ? localizedPath(url, urlLocale) : url;
    if (`${location.pathname}${location.search}` !== address) window.history.replaceState(window.history.state, '', address);
    try {
      sessionStorage.setItem(LAST_SEARCH_KEY, url);
    } catch {
      /* хранилище закрыто — «Назад» просто ведёт на /search */
    }
  }, [filters, search]);

  const query: CatalogQuery = {
    search: search || undefined,
    sphereId: filters.sphereId,
    district: filters.district,
    workplace: filters.workplace,
    accepts: filters.accepts,
    material: filters.material,
    freeToday: filters.day === 'today' || undefined,
    freeTomorrow: filters.day === 'tomorrow' || undefined,
    near,
  };
  const resultsQ = useApiQuery(clientKeys.catalog(query), () => listCatalog(query));
  // Аналитика: поиск — длина запроса (не текст) и сколько нашлось; после паузы, чтобы не слать каждую букву
  const searchResults = resultsQ.data?.length;
  useEffect(() => {
    if (searchResults === undefined) return;
    const id = setTimeout(() => {
      track('search', { query_length: search?.trim().length ?? 0, results: searchResults, sphere: filters.sphereId, district: filters.district });
    }, 1500);
    return () => clearTimeout(id);
  }, [searchResults, search, filters.sphereId, filters.district]);

  const update = (next: SearchFilters) => {
    setFilters(next);
    if (next.material !== filters.material) setMaterialDraft(next.material ?? '');
    setShown(PAGE);
  };

  const askGeo = () => {
    if (!('geolocation' in navigator)) {
      setGeo('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo('on');
      },
      () => setGeo('denied'),
    );
  };

  const toggleNear = () => {
    if (geo === 'on') {
      setNear(undefined);
      setGeo('off');
    } else setGeo('ask');
  };

  const districtSelect = (
    <Select
      value={filters.district ?? ''}
      onValueChange={(v) => update({ ...filters, district: (v || undefined) as DistrictId | undefined })}
      placeholder={t('search.filters.anyDistrict')}
      options={DISTRICT_IDS.map((id) => ({ value: id, label: tc(`districts.${id}`) }))}
    />
  );

  // Цена и время суток — поверх ответа каталога: окна другого времени убираем, мастер без подходящих окон уходит
  const list = (resultsQ.data ?? []).flatMap((entry) => {
    if (filters.priceMax && entry.service && entry.service.priceMin > filters.priceMax) return [];
    const tod = filters.timeOfDay;
    if (!tod) return [entry];
    const slots = entry.nearestSlots.filter((s) => inTimeOfDay(s.start, tod));
    return slots.length ? [{ ...entry, nearestSlots: slots }] : [];
  });
  const activeCount = countFilters(filters);
  const skeletonCount = useSkeletonCount('search-results', {
    loading: resultsQ.isLoading,
    count: resultsQ.data ? Math.min(list.length, shown) : undefined,
    fallback: PAGE,
    max: PAGE,
  });

  return (
    <div data-search-screen="" className="flex flex-col gap-4">
      <PageHeader title={t('search.title')} description={t('search.subtitle')} />

      <div data-f="F-00-110 F-00-111" className="flex flex-col gap-3">
        <FilterBar
          search={{ value: search, onValueChange: setSearch, placeholder: t('search.placeholder'), debounceMs: 250 }}
          activeCount={activeCount}
          onReset={() => update({})}
          filters={[
            {
              id: 'sphere',
              label: t('search.filters.sphere'),
              node: (
                <Select
                  value={filters.sphereId ?? ''}
                  onValueChange={(v) => update({ ...filters, sphereId: (v || undefined) as SphereId | undefined })}
                  placeholder={t('search.filters.anySphere')}
                  options={CLIENT_SPHERES.map((id) => ({ value: id, label: tc(`spheres.${id}`) }))}
                />
              ),
            },
            { id: 'district', label: t('search.filters.district'), node: districtSelect },
            {
              id: 'workplace',
              label: t('search.filters.workplace'),
              node: (
                <Select
                  value={filters.workplace ?? ''}
                  onValueChange={(v) => update({ ...filters, workplace: (v || undefined) as Workplace | undefined })}
                  placeholder={t('search.filters.anyWorkplace')}
                  options={WORKPLACES.map((id) => ({ value: id, label: tc(`workplace.${id}`) }))}
                />
              ),
            },
            {
              id: 'accepts',
              label: t('search.filters.accepts'),
              node: (
                <Select
                  value={filters.accepts ?? ''}
                  onValueChange={(v) => update({ ...filters, accepts: (v || undefined) as AcceptsWhom | undefined })}
                  placeholder={t('search.filters.acceptsAny')}
                  options={ACCEPTS.map((id) => ({ value: id, label: tc(`accepts.${id}`) }))}
                />
              ),
            },
            {
              id: 'material',
              label: t('search.filters.material'),
              node: (
                <Input
                  value={materialDraft}
                  onChange={(e) => setMaterialDraft(e.target.value)}
                  placeholder={t('search.filters.materialPlaceholder')}
                />
              ),
            },
            {
              id: 'price',
              label: t('search.filters.price'),
              node: (
                <Select
                  value={filters.priceMax ? String(filters.priceMax) : ''}
                  onValueChange={(v) => update({ ...filters, priceMax: v ? Number(v) : undefined })}
                  placeholder={t('search.filters.anyPrice')}
                  options={PRICE_STEPS.map((p) => ({ value: String(p), label: t('search.filters.priceUpTo', { price: fmt.money(p) }) }))}
                />
              ),
            },
            {
              id: 'time',
              label: t('search.filters.time'),
              node: (
                <Select
                  value={filters.timeOfDay ?? ''}
                  onValueChange={(v) => update({ ...filters, timeOfDay: (v || undefined) as TimeOfDay | undefined })}
                  placeholder={t('search.filters.anyTime')}
                  options={TIMES_OF_DAY.map((id) => ({ value: id, label: t(`search.filters.timeOfDay.${id}`) }))}
                />
              ),
            },
          ]}
        />
        <QuickFilters filters={filters} onChange={update} nearOn={geo === 'on'} onNear={toggleNear} />
      </div>

      {(geo === 'ask' || geo === 'denied') && (
        <div data-f="F-00-109" className="flex flex-col gap-3">
          <PermissionPrimer
            id="client.geoPrimer"
            state={geo === 'denied' ? 'denied' : 'ask'}
            icon={<MapPin />}
            title={t('search.geo.title')}
            description={t('search.geo.text')}
            allowLabel={t('search.geo.allow')}
            onAllow={askGeo}
            alternativeLabel={t('search.geo.pickDistrict')}
            onAlternative={() => setGeo('denied')}
            deniedText={t('search.nearMeDenied')}
          />
          {geo === 'denied' && <div className="max-w-xs">{districtSelect}</div>}
        </div>
      )}

      <AdBanner placementId="pl_banner_search" district={filters.district} sphereId={filters.sphereId} />

      <div data-f="F-00-108 F-00-001 F-00-031" aria-live="polite" className="flex flex-col gap-3">
        {resultsQ.isLoading ? (
          // Та же раскладка до данных: строка «Найдено …» и карточки каталога (столько, сколько было, до страницы)
          <>
            <p className="text-sm text-muted">
              <SkeletonText width="12ch" />
            </p>
            <ul className="grid gap-3 lg:grid-cols-2" aria-busy="true">
              {Array.from({ length: skeletonCount }, (_, i) => (
                <CatalogEntryCardSkeleton key={i} />
              ))}
            </ul>
          </>
        ) : resultsQ.isError ? (
          <ErrorState onRetry={resultsQ.refetch} />
        ) : !list.length ? (
          <SearchEmptyResult
            query={search}
            sphereId={filters.sphereId}
            district={filters.district}
            appUserId={appUserId}
            onReset={activeCount ? () => update({}) : undefined}
          />
        ) : (
          <>
            <p className="text-sm text-muted">{t('search.resultsCount', { count: list.length })}</p>
            <ul className={cn('grid gap-3 transition-opacity lg:grid-cols-2', resultsQ.isPlaceholderData && 'opacity-60')}>
              {list.slice(0, shown).map((entry) => (
                <CatalogEntryCard key={entry.staff.id} entry={entry} />
              ))}
            </ul>
            {list.length > shown && (
              <Button variant="secondary" className="self-center" onClick={() => setShown((n) => n + PAGE)}>
                {t('search.showMore', { count: Math.min(PAGE, list.length - shown) })}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

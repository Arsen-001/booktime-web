'use client';

/**
 * /biz/integrations — витрина маркетплейса (F-13-001, F-13-002, F-13-003, F-13-027).
 * Поиск, переключатель «Армения / Все страны», блоки непустых категорий, «Разместите своё приложение».
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PackagePlus, Puzzle } from 'lucide-react';
import { listApps, listCategoryCounts, listFeaturedApps } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { CatalogSearchResults } from '@/areas/integrations/components/CatalogSearchResults';
import { CategoryOverviewBlock, CategoryOverviewBlockSkeleton } from '@/areas/integrations/components/CategoryOverviewBlock';
import { CountrySwitch } from '@/areas/integrations/components/CountrySwitch';
import { CATEGORY_ICON, selectOverviewCategories } from '@/areas/integrations/catalog';
import { useCatalogCountry } from '@/areas/integrations/hooks/useCatalogCountry';
import { useInstallStatuses } from '@/areas/integrations/hooks/useInstallStatuses';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { VISIBLE_CATEGORY_IDS } from '@/domain/integrations';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LinkButton } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { ScrollRow } from '@/ui/ScrollRow';
import { Chip } from '@/ui/Chip';
import { SearchInput } from '@/ui/SearchInput';

export function IntegrationsScreen() {
  const t = useT('integrations');
  const router = useRouter();
  const { ready } = useCurrent();
  const [q, setQ] = useState('');
  const country = useCatalogCountry();
  const statuses = useInstallStatuses();

  // Ревью 27.09 (М): смена страны и поиск держат прежние карточки, пока грузятся новые — без скелетона
  // на весь каталог (было: 9 вспышек, удалено 478 из 664 узлов).
  const countsQ = useApiQuery(['integrations', 'categoryCounts', country], () => listCategoryCounts(country), { enabled: ready, keepPrevious: true });
  const searchQ = useApiQuery(['integrations', 'apps', 'search', q, country], () => listApps({ q, country }), {
    enabled: ready && q.trim().length > 0,
    keepPrevious: true,
  });
  // Обзор не выключается на время поиска: пока первые результаты не пришли, на экране остаётся он, а не скелетон
  const blocksAppsQ = useApiQuery(['integrations', 'apps', 'overviewBlocks', country], () => listApps({ country }), { enabled: ready, keepPrevious: true });
  const featuredQ = useApiQuery(['integrations', 'apps', 'featured', country], () => listFeaturedApps(country), { enabled: ready, keepPrevious: true });

  const overviewCategories = useMemo(() => selectOverviewCategories(countsQ.data ?? [], 8), [countsQ.data]);
  const installedCount = statuses ? Object.values(statuses).filter((s) => s !== 'disconnected').length : 0;

  if (countsQ.isError) return <ErrorState onRetry={() => countsQ.refetch()} />;
  if (blocksAppsQ.isError) return <ErrorState onRetry={() => blocksAppsQ.refetch()} />;

  const isSearching = q.trim().length > 0 && (searchQ.data !== undefined || searchQ.isError);

  return (
    <div data-f="F-13-001 F-13-027" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('hub.title')}
        description={t('hub.subtitle')}
        actions={
          <LinkButton href="/biz/integrations/installed" variant="secondary" leftIcon={<Puzzle aria-hidden />}>
            {t('nav.installed')}
          </LinkButton>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-f="F-13-002">
        <SearchInput
          aria-label={t('search.label')}
          placeholder={t('search.placeholder')}
          value={q}
          onValueChange={setQ}
          debounceMs={250}
          className="sm:max-w-sm"
        />
        <CountrySwitch />
      </div>

      <ScrollRow gap="sm" data-f="F-13-004">
        {/* Пока статусы грузятся — чип «Установлено» уже на месте (число — полосой): остальные чипы не съезжают вправо */}
        {(statuses === undefined || installedCount > 0) && (
          <Chip
            icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
            count={statuses === undefined ? undefined : installedCount}
            countLoading={statuses === undefined}
            onClick={() => router.push('/biz/integrations/installed')}
          >
            {t('hub.installedChip')}
          </Chip>
        )}
        {VISIBLE_CATEGORY_IDS.map((categoryId) => {
          const Icon = CATEGORY_ICON[categoryId];
          const count = countsQ.data?.find((c) => c.categoryId === categoryId)?.count ?? 0;
          return (
            <Chip
              key={categoryId}
              icon={<Icon className="h-3.5 w-3.5" aria-hidden />}
              count={count || undefined}
              countLoading={!countsQ.data}
              onClick={() => router.push(`/biz/integrations/category/${categoryId}`)}
            >
              {t(`category.${categoryId}.title` as never)}
            </Chip>
          );
        })}
      </ScrollRow>

      {/* Поиск не подменяет страницу: витрина и баннер остаются в дереве (скрыты), результаты встают на их место.
          Выход из поиска показывает ту же витрину без пересборки, а баннер не съезжает, когда приходят результаты. */}
      {isSearching && (
        <CatalogSearchResults items={searchQ.data} loading={searchQ.isLoading} error={searchQ.isError} onRetry={() => searchQ.refetch()} statuses={statuses} onReset={() => setQ('')} />
      )}
      <div hidden={isSearching} className="flex flex-col gap-6">
        {!blocksAppsQ.data || !countsQ.data || !featuredQ.data ? (
          // Скелетон — те же блоки обзора: «Начните с этого» и категории, по 4 плитки
          <div className="flex flex-col gap-8">
            <CategoryOverviewBlockSkeleton title={t('hub.featuredTitle')} withSeeAll={false} />
            {Array.from({ length: 3 }, (_, i) => (
              <CategoryOverviewBlockSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8" data-f="F-13-003">
            <CategoryOverviewBlock title={t('hub.featuredTitle')} apps={featuredQ.data ?? []} statuses={statuses} />
            {overviewCategories.map(({ categoryId, count }) => (
              <CategoryOverviewBlock
                key={categoryId}
                categoryId={categoryId}
                apps={(blocksAppsQ.data ?? []).filter((a) => a.categoryId === categoryId).slice(0, 4)}
                count={count}
                statuses={statuses}
              />
            ))}
            {overviewCategories.length === 0 && (
              <EmptyState icon={<Puzzle aria-hidden />} title={t('hub.emptyTitle')} description={t('hub.emptyText')} />
            )}
          </div>
        )}

        <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between" data-f="F-13-001">
          <div>
            <p className="text-sm font-semibold text-fg">{t('placeYourApp.title')}</p>
            <p className="text-sm text-muted">{t('placeYourApp.text')}</p>
          </div>
          <LinkButton href="/biz/integrations/developers" variant="secondary" leftIcon={<PackagePlus aria-hidden />}>
            {t('placeYourApp.cta')}
          </LinkButton>
        </Card>
      </div>
    </div>
  );
}

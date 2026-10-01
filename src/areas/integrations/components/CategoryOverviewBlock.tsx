'use client';

/**
 * F-13-003: блок категории на «Обзоре» — заголовок, «Смотреть все (N)» и первые карточки.
 * Ревью 27.09 (И18): на телефоне карточки идут горизонтальной лентой (листаются пальцем), а не столбиком —
 * иначе обзор вытягивался почти на 5 000 px. С sm — обычная сетка.
 */
import { AppTile, AppTileSkeleton } from '@/areas/integrations/components/AppTile';
import type { Id } from '@/domain/core';
import type { CatalogApp, InstallStatus, IntegrationCategoryId } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { buttonClasses, LinkButton } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';

export interface CategoryOverviewBlockProps {
  categoryId?: IntegrationCategoryId;
  /** Свой заголовок вместо названия категории (блок «Начните с этого») */
  title?: string;
  apps: CatalogApp[];
  count?: number;
  statuses?: Record<Id, InstallStatus>;
}

export function CategoryOverviewBlock({ categoryId, title, apps, count, statuses }: CategoryOverviewBlockProps) {
  const t = useT('integrations');
  if (!apps || apps.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" data-overview-block={categoryId ?? 'featured'}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fg">{title ?? t(`category.${categoryId}.title` as never)}</h2>
        {categoryId && count !== undefined && (
          <LinkButton href={`/biz/integrations/category/${categoryId}`} variant="ghost" size="sm">
            {t('hub.seeAll', { count })}
          </LinkButton>
        )}
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app) => (
          <AppTile key={app.id} app={app} status={statuses?.[app.id]} className="w-[82%] shrink-0 snap-start sm:w-auto" />
        ))}
      </ul>
    </section>
  );
}

/**
 * Скелетон блока обзора — та же разметка: заголовок, «Смотреть все (N)» (место кнопки), лента/сетка из `tiles` плиток.
 * `title` — известный заранее заголовок («Начните с этого»), иначе полоса.
 */
export function CategoryOverviewBlockSkeleton({ title, withSeeAll = true, tiles = 4 }: { title?: string; withSeeAll?: boolean; tiles?: number }) {
  return (
    <section className="flex flex-col gap-3" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fg">{title ?? <SkeletonText width="16ch" />}</h2>
        {withSeeAll && (
          <span className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            <SkeletonText width="12ch" />
          </span>
        )}
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <AppTileSkeleton key={i} nameLines={title ? 1 : 2} className="w-[82%] shrink-0 snap-start sm:w-auto" />
        ))}
      </ul>
    </section>
  );
}

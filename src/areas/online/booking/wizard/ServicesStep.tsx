'use client';

import { useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Users } from 'lucide-react';
import type { PublicBusinessData } from '@/api/online';
import { computePackageDurationRange, computePackagePriceRange } from '@/api/online-public';
import type { Service } from '@/domain/core';
import type { OnlinePackage } from '@/domain/online';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { SearchInput } from '@/ui/SearchInput';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/** С какого числа услуг сверху появляется поиск по названию (О13) */
const SEARCH_FROM = 10;

/**
 * Шаг «Услуги» (F-03-088, F-03-020, F-03-115). О13: в «Все категории» услуги идут группами с подзаголовками, как на
 * странице салона, а не одной лентой вперемешку. О4: если выбранные услуги делают разные мастера — сразу говорим,
 * что запишем подряд к разным (а не показываем тупик на следующем шаге).
 */
export function ServicesStep({
  categories,
  services,
  serviceConfigs,
  selectedIds,
  categoryDisplay = 'tags',
  hidePrice,
  hideDuration,
  onToggle,
  packages,
  selectedPackageId,
  onSelectPackage,
  onClearPackage,
  chainNotice,
}: {
  categories: PublicBusinessData['categories'];
  services: Service[];
  serviceConfigs: PublicBusinessData['serviceConfigs'];
  selectedIds: string[];
  categoryDisplay?: 'tags' | 'list';
  hidePrice?: boolean;
  hideDuration?: boolean;
  onToggle: (id: string) => void;
  packages: OnlinePackage[];
  selectedPackageId: string | undefined;
  onSelectPackage: (pkg: OnlinePackage) => void;
  onClearPackage: () => void;
  /** Выбранные услуги делают разные мастера — покажем подсказку «запишем подряд» */
  chainNotice: boolean;
}) {
  const t = useT('online');
  const format = useFormat();
  const locale = useLocale();
  const [activeTag, setActiveTag] = useState<string>('all');
  const [search, setSearch] = useState('');
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const usedCategories = categories.filter((c) => services.some((s) => s.categoryId === c.id)).sort((a, b) => a.order - b.order);

  // F-03-130: онлайн — один пакет за раз, без доп. услуг и других пакетов (F-03-089)
  if (selectedPackage) {
    const pkgServices = services.filter((s) => selectedPackage.serviceIds.includes(s.id));
    const price = computePackagePriceRange(pkgServices);
    const duration = computePackageDurationRange(pkgServices, selectedPackage.mode);
    return (
      <div className="flex flex-col gap-3" data-f="F-03-130 F-16-132">
        <Card padding="md" className="flex flex-col gap-2">
          <p className="font-medium text-fg">
            {selectedPackage.onlineName ? pickText(selectedPackage.onlineName, locale) : pickText(selectedPackage.name, locale)}
          </p>
          <p className="text-sm text-muted">{pkgServices.map((s) => pickText(s.name, locale)).join(' + ')}</p>
          <p className="text-sm text-muted">
            {format.moneyRange(price.min, price.max)} · {format.durationRange(duration.min, duration.max)}
          </p>
          <Button variant="secondary" size="sm" onClick={onClearPackage}>
            {t('linkSettings.packages.clear')}
          </Button>
        </Card>
      </div>
    );
  }

  const nameOf = (s: Service) => {
    const config = serviceConfigs[s.id];
    return config?.onlineName ? pickText(config.onlineName, locale) : pickText(s.name, locale);
  };
  const query = search.trim().toLocaleLowerCase();
  const matches = (s: Service) => !query || nameOf(s).toLocaleLowerCase().includes(query);

  const packageRow = (p: OnlinePackage) => {
    const pkgServices = services.filter((s) => p.serviceIds.includes(s.id));
    if (pkgServices.length === 0) return null;
    const price = computePackagePriceRange(pkgServices);
    const duration = computePackageDurationRange(pkgServices, p.mode);
    return (
      <li key={p.id}>
        <button
          type="button"
          onClick={() => onSelectPackage(p)}
          className="flex min-h-16 w-full items-start gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3 text-left hover:bg-surface-3"
        >
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL моковой загрузки
            <img src={p.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-fg">{p.onlineName ? pickText(p.onlineName, locale) : pickText(p.name, locale)}</span>
            <span className="mt-0.5 block text-sm text-muted">{pkgServices.map((s) => pickText(s.name, locale)).join(' + ')}</span>
            <span className="mt-0.5 block text-sm text-muted">
              {format.moneyRange(price.min, price.max)} · {format.durationRange(duration.min, duration.max)}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const serviceRow = (s: Service) => {
    const checked = selectedIds.includes(s.id);
    // F-03-129: «Название для онлайн-записи» — пока не задано вручную, показываем основное название
    const config = serviceConfigs[s.id];
    const serviceLabel = nameOf(s);
    const description = config?.description ? pickText(config.description, locale) : s.description ? pickText(s.description, locale) : undefined;
    const meta: string[] = [];
    if (!hideDuration) meta.push(format.durationRange(s.durationMin, s.durationMax));
    if (!hidePrice) meta.push(format.moneyRange(s.priceMin, s.priceMax));
    return (
      <li key={s.id}>
        {/* не label: Checkbox уже рендерит собственный <label> — строка кликабельна через onClick (F-03-088) */}
        <div className="flex min-h-16 cursor-pointer items-start gap-3 py-3" onClick={() => onToggle(s.id)}>
          <span onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={checked} onCheckedChange={() => onToggle(s.id)} aria-label={serviceLabel} />
          </span>
          {config?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL моковой загрузки
            <img src={config.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-fg">{serviceLabel}</span>
            {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
            {meta.length > 0 && <span className="mt-0.5 block text-sm text-muted">{meta.join(' · ')}</span>}
            {config?.subscriptionOnly && (
              <span className="mt-1 inline-block" data-f="F-03-096">
                <Badge tone="primary" size="sm" variant="soft">
                  {t('booking.services.subscriptionOnly')}
                </Badge>
              </span>
            )}
          </span>
        </div>
      </li>
    );
  };

  /** Категории с подзаголовками — одинаково для «Все категории» и вертикального списка */
  const grouped = (cats: typeof usedCategories) => {
    const blocks = cats
      .map((c) => ({ c, items: services.filter((s) => s.categoryId === c.id && matches(s)).sort((a, b) => a.order - b.order) }))
      .filter((b) => b.items.length > 0);
    const orphans = services.filter((s) => !usedCategories.some((c) => c.id === s.categoryId) && matches(s));
    if (blocks.length === 0 && orphans.length === 0) {
      return (
        <EmptyState
          title={t('booking.services.nothingFound')}
          action={
            <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
              {t('booking.services.resetSearch')}
            </Button>
          }
        />
      );
    }
    return (
      <div className="flex flex-col gap-5">
        {blocks.map(({ c, items }) => (
          <div key={c.id} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-muted">{pickText(c.name, locale)}</h3>
            <ul className="divide-y divide-border">{items.map(serviceRow)}</ul>
          </div>
        ))}
        {orphans.length > 0 && <ul className="divide-y divide-border">{orphans.map(serviceRow)}</ul>}
      </div>
    );
  };

  const packagesBlock = packages.length > 0 && (
    <div data-f="F-03-130">
      <h3 className="mb-1 text-sm font-semibold text-muted">{t('linkSettings.packages.sectionTitle')}</h3>
      <ul className="flex flex-col gap-2">{packages.map(packageRow)}</ul>
    </div>
  );

  const notice = chainNotice && (
    <p className="flex animate-fade-in items-start gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-fg" role="status">
      <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
      {t('booking.services.chainNotice')}
    </p>
  );

  const searchBox = services.length > SEARCH_FROM && (
    <SearchInput value={search} onValueChange={setSearch} placeholder={t('booking.services.searchPlaceholder')} aria-label={t('booking.services.searchPlaceholder')} />
  );

  if (categoryDisplay === 'tags') {
    const activeCats = activeTag === 'all' ? usedCategories : usedCategories.filter((c) => c.id === activeTag);
    return (
      <div className="flex flex-col gap-4" data-f="F-03-088 F-03-020 F-03-115">
        {packagesBlock}
        {searchBox}
        {usedCategories.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <TagChip selected={activeTag === 'all'} onClick={() => setActiveTag('all')}>
              {t('booking.services.allCategories')}
            </TagChip>
            {usedCategories.map((c) => (
              <TagChip key={c.id} selected={activeTag === c.id} onClick={() => setActiveTag(c.id)}>
                {pickText(c.name, locale)}
              </TagChip>
            ))}
          </div>
        )}
        {notice}
        {grouped(activeCats)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-f="F-03-088 F-03-020 F-03-115">
      {packagesBlock}
      {searchBox}
      {notice}
      {grouped(usedCategories)}
    </div>
  );
}

function TagChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors',
        selected ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface text-fg hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Скелетон шага «Услуги» — та же разметка, что ServicesStep в виде «метки» (так у ссылок по умолчанию): пакет, поиск,
 * метки категорий, подзаголовок категории и строки услуг с галочкой (название, описание, «длительность · цена»).
 */
/** Строк описания у услуг в скелетоне — как у типичного прайса (короткие и длинные вперемешку) */
const DESCRIPTION_LINES = [2, 3, 3, 2, 2, 2];
/** То же на широком экране — строки длиннее */
const DESCRIPTION_LINES_WIDE = [1, 1, 2, 2, 1, 1];

/** n строк текста полосами (одна строка — SkeletonText в 1lh, несколько — Skeleton lines) */
function TextLines({ n, className }: { n: number; className?: string }) {
  return n > 1 ? <Skeleton lines={n} className={className} /> : <SkeletonText width="70%" className={className} />;
}

export function ServicesStepSkeleton() {
  const t = useT('online');
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-muted">{t('linkSettings.packages.sectionTitle')}</h3>
        <ul className="flex flex-col gap-2">
          <li className="flex min-h-16 w-full items-start gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">
                {/* Название пакета: на телефоне две строки, шире — одна */}
                <Skeleton lines={2} className="sm:hidden" />
                <SkeletonText width="60%" className="max-sm:hidden" />
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                <SkeletonText width="30ch" />
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                <SkeletonText width="16ch" />
              </span>
            </span>
          </li>
        </ul>
      </div>
      <SearchInput value="" onValueChange={() => undefined} disabled placeholder={t('booking.services.searchPlaceholder')} aria-label={t('booking.services.searchPlaceholder')} />
      <div className="-mx-4 flex gap-2 overflow-x-hidden px-4 pb-1">
        <span className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-primary bg-primary px-3 text-sm font-medium text-primary-contrast">
          {t('booking.services.allCategories')}
        </span>
        {['8.2ch', '7.9ch', '20.7ch'].map((w, i) => (
          <span key={i} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-border bg-surface px-3 text-sm font-medium text-fg">
            <SkeletonText width={w} />
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-muted">
          <SkeletonText width="9ch" />
        </h3>
        <ul className="divide-y divide-border">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <div className="flex min-h-16 items-start gap-3 py-3">
                <span>
                  <Checkbox checked={false} disabled onCheckedChange={() => undefined} aria-label="" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-fg">
                    <SkeletonText width={i % 2 ? '16ch' : '20ch'} />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    <TextLines n={DESCRIPTION_LINES[i % DESCRIPTION_LINES.length]} className="sm:hidden" />
                    <TextLines n={DESCRIPTION_LINES_WIDE[i % DESCRIPTION_LINES_WIDE.length]} className="max-sm:hidden" />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    <SkeletonText width="14ch" />
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

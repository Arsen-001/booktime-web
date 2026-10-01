'use client';

/**
 * Заглушка каталога в форме содержимого (DESIGN.md «Nothing blinks»): те же плитки цифр, та же карточка категории
 * с шапкой 56 px и строками 56 px (таблица) / 64 px (компактно) — при появлении данных ничего не сдвигается.
 */
import { ChevronDown, Globe, GripVertical, LayoutGrid, Plus, Tag } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { CATALOG_GRID } from '@/areas/services/catalog/grid';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Switch } from '@/ui/Switch';

/** Цифры каталога до загрузки — та же строка на телефоне и те же три плитки (подписи и значки известны) */
export function SummarySkeleton() {
  const t = useT('services');
  return (
    <>
      <p className="text-sm text-muted md:hidden">
        <SkeletonText width="30ch" />
      </p>
      <div className="grid grid-cols-3 gap-3 max-md:hidden">
        <StatCard loading label={t('stats.total')} value={null} icon={<Tag aria-hidden />} />
        <StatCard loading label={t('stats.categories')} value={null} icon={<LayoutGrid aria-hidden />} />
        <StatCard loading label={t('stats.online')} value={null} icon={<Globe aria-hidden />} />
      </div>
    </>
  );
}

/**
 * Каталог до загрузки — те же карточки категорий и те же строки, что у CategoryGroup/SortableRow: шапка категории
 * (⠿, ☐, название с числом, «Добавить услугу», ⋯), строки таблицы по той же сетке (⠿ · ☐ · имя · онлайн · цена ·
 * длительность · перерыв · мастера · ⋯) или компактные строки (☐ · имя и строка «цена · длительность» · ⋯).
 * Число строк — как в демо (7 и 3).
 */
export function CatalogSkeleton({ table, canEdit = true }: { table: boolean; canEdit?: boolean }) {
  const t = useT('services');
  const noop = () => {};
  return (
    <div aria-busy className="flex flex-col gap-3">
      {table && (
        <div role="presentation" className={cn(CATALOG_GRID, 'px-2.5 text-xs font-medium text-muted')}>
          <span />
          <span />
          <span>{t('list.colName')}</span>
          <span className="text-center">{t('list.colOnline')}</span>
          <span className="px-2 text-right">{t('list.colPrice')}</span>
          <span className="px-2 text-right">{t('list.colDuration')}</span>
          <span className="px-2">{t('list.colBreak')}</span>
          <span className="px-2">{t('list.colStaff')}</span>
          <span />
        </div>
      )}
      {[7, 3].map((n, g) => (
        <section key={g} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="flex min-h-14 items-center gap-1 bg-surface-2/60 py-1.5 pr-1.5 pl-1 sm:gap-2 sm:pl-2">
            {canEdit && (
              <span className="flex h-10 w-7 shrink-0 items-center justify-center text-muted sm:w-8">
                <GripVertical aria-hidden className="size-4" />
              </span>
            )}
            {canEdit && (
              <span className="flex size-10 shrink-0 items-center justify-center">
                <Checkbox checked={false} disabled onCheckedChange={noop} aria-hidden tabIndex={-1} />
              </span>
            )}
            <span className="flex min-h-10 min-w-0 flex-1 items-center gap-2 px-1.5">
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="truncate font-semibold text-fg">
                <SkeletonText width={g ? '10ch' : '8.6ch'} />
              </span>
              <Badge tone="neutral" size="sm">
                <SkeletonText width="1ch" />
              </Badge>
            </span>
            {canEdit && (
              <Button size="sm" variant="ghost" leftIcon={<Plus aria-hidden />} className="shrink-0 max-sm:px-2" disabled>
                <span className="max-sm:sr-only">{t('list.addService')}</span>
              </Button>
            )}
            {canEdit && <span aria-hidden className="size-10 shrink-0 md:size-9" />}
          </header>
          <ul>
            {Array.from({ length: n }, (_, i) =>
              table ? (
                <li key={i} className={cn('border-t border-border bg-surface', CATALOG_GRID, 'min-h-14 px-2 py-1.5')}>
                  {canEdit ? (
                    <span className="flex size-8 shrink-0 items-center justify-center text-muted">
                      <GripVertical aria-hidden className="size-4" />
                    </span>
                  ) : (
                    <span />
                  )}
                  {canEdit ? <Checkbox checked={false} disabled onCheckedChange={noop} aria-hidden tabIndex={-1} /> : <span />}
                  <span className="flex min-w-0 items-center gap-2 font-medium text-fg">
                    <SkeletonText width={i % 2 ? '18ch' : '24ch'} />
                  </span>
                  <span className="flex justify-center">
                    <Switch checked disabled aria-hidden tabIndex={-1} />
                  </span>
                  <span className="px-2 text-right text-sm font-semibold tabular-nums text-fg">
                    <SkeletonText width="8ch" />
                  </span>
                  <span className="px-2 text-right text-sm tabular-nums text-fg">
                    <SkeletonText width="6ch" />
                  </span>
                  <Select size="sm" aria-hidden options={[{ value: 'shared', label: t('techBreak.shared') }]} value="shared" onValueChange={noop} disabled />
                  <span className="flex h-10 items-center px-2">
                    <Skeleton variant="circle" className="size-6 shrink-0" />
                    <Skeleton variant="circle" className="-ml-1.5 size-6 shrink-0" />
                    <Skeleton variant="circle" className="-ml-1.5 size-6 shrink-0" />
                  </span>
                  {canEdit ? <span aria-hidden className="size-10 md:size-9" /> : <span />}
                </li>
              ) : (
                <li key={i} className="flex min-h-16 items-center gap-1 border-t border-border bg-surface py-2 pr-1 pl-1">
                  {canEdit && (
                    <span className="flex h-11 w-7 shrink-0 items-center justify-center text-muted">
                      <GripVertical aria-hidden className="size-4" />
                    </span>
                  )}
                  {canEdit && (
                    <span className="flex size-9 shrink-0 items-center justify-center">
                      <Checkbox checked={false} disabled onCheckedChange={noop} aria-hidden tabIndex={-1} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
                    <span className="truncate font-medium text-fg">
                      <SkeletonText width={i % 2 ? '16ch' : '22ch'} />
                    </span>
                    <span className="flex min-w-0 items-center gap-x-2 text-[13px] text-muted">
                      <SkeletonText width="24ch" />
                    </span>
                  </span>
                  {canEdit && <span aria-hidden className="size-11 shrink-0 md:size-10" />}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

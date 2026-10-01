'use client';

/**
 * /biz/stock/price-tags — «Печать товарных ценников» (F-08-001, F-08-093, F-08-094): макет ценника
 * (размер, поля, ориентация — меняет превью сразу), «Выбрать товары» + число копий, печать средствами
 * браузера кабинета (наш кабинет не рисует свою типографику для печати — только превью, см. F-08-072).
 */
import { useUnitShort } from '@/areas/stock/warehouse.utils';
import { useState } from 'react';
import { Printer, Tag } from 'lucide-react';
import { getPriceTagLayout, listGoods, updatePriceTagLayout, type GoodRow } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { PRICE_TAG_SIZE_MM, type PriceTagOrientation, type PriceTagSize } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SearchInput } from '@/ui/SearchInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';

const SIZE_OPTIONS: { value: PriceTagSize; label: string }[] = [
  { value: 'small', label: '30×20 мм' },
  { value: 'medium', label: '58×40 мм' },
  { value: 'large', label: '90×50 мм' },
];

export function PriceTagsScreen() {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const format = useFormat();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Id[]>([]);
  const [copies, setCopies] = useState<Record<Id, number>>({});

  const q = useApiQuery(['stock', 'goods', businessId, locationId, 'priceTags', search], () => listGoods(businessId!, locationId!, { search, pageSize: 200 }), { enabled });
  const layoutQ = useApiQuery(['stock', 'priceTagLayout', businessId], () => getPriceTagLayout(businessId!), { enabled: Boolean(businessId) });
  const layoutMutation = useApiMutation((patch: Parameters<typeof updatePriceTagLayout>[1]) => updatePriceTagLayout(businessId!, patch));

  // Постранично — только список выбора товаров; превью и печать — все выбранные (DESIGN.md → Long lists)
  const { pageItems: itemsPage, pager } = usePagedList(q.data?.items ?? [], { resetKey: search });

  const skeletonRows = useSkeletonCount('priceTagGoods', { loading: q.isLoading, count: itemsPage.length, fallback: 6, max: 10 });

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const items = q.data?.items ?? [];
  const selectedGoods: GoodRow[] = items.filter((g) => selected.includes(g.id));
  const layout = layoutQ.data;

  const toggle = (id: Id, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  const copiesFor = (id: Id) => copies[id] ?? layout?.copiesDefault ?? 1;

  const doPrint = () => {
    if (typeof print === 'function') print();
  };

  const size = PRICE_TAG_SIZE_MM[layout?.size ?? 'medium'];
  const isLandscape = layout?.orientation === 'landscape';

  return (
    <div data-f="F-08-001 F-08-093 F-08-094" className="flex w-full flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title={t('priceTags.title')}
          description={t('priceTags.subtitle')}
          actions={
            <div className="flex items-center gap-2">
              <HelpArticleButton titleKey="help.priceTags.title" bodyKey="help.priceTags.body" />
              <Button leftIcon={<Printer aria-hidden />} onClick={doPrint} disabled={selectedGoods.length === 0}>
                {t('priceTags.printSelected', { count: selectedGoods.length })}
              </Button>
            </div>
          }
        />
      </div>

      {/* Макет виден сразу: пока настройки грузятся — те же поля, неактивные и пустые */}
      {(layout || layoutQ.isLoading) && (
        <SectionCard title={t('priceTags.layoutTitle')} className="print:hidden">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label={t('priceTags.size')}>
              <Select value={layout?.size} onValueChange={(v) => layoutMutation.mutate({ size: v as PriceTagSize })} options={SIZE_OPTIONS} disabled={!layout} placeholder={layout ? undefined : ''} />
            </FormField>
            <FormField label={t('priceTags.orientation')}>
              <Select
                value={layout?.orientation}
                disabled={!layout}
                placeholder={layout ? undefined : ''}
                onValueChange={(v) => layoutMutation.mutate({ orientation: v as PriceTagOrientation })}
                options={[
                  { value: 'portrait', label: t('priceTags.orientationPortrait') },
                  { value: 'landscape', label: t('priceTags.orientationLandscape') },
                ]}
              />
            </FormField>
            <div className="flex items-end gap-4">
              <Checkbox checked={layout?.showBarcode ?? false} disabled={!layout} onCheckedChange={(v) => layoutMutation.mutate({ showBarcode: v })} label={t('priceTags.showBarcode')} />
            </div>
            <div className="flex items-end gap-4">
              <Checkbox checked={layout?.showSku ?? false} disabled={!layout} onCheckedChange={(v) => layoutMutation.mutate({ showSku: v })} label={t('priceTags.showSku')} />
            </div>
            <div className="flex items-end gap-4">
              <Checkbox checked={layout?.showBrand ?? false} disabled={!layout} onCheckedChange={(v) => layoutMutation.mutate({ showBrand: v })} label={t('priceTags.showBrand')} />
            </div>
          </div>
        </SectionCard>
      )}

      <div className="print:hidden">
        <SearchInput value={search} onValueChange={setSearch} placeholder={t('priceTags.searchPlaceholder')} className="max-w-md" />
      </div>

      {q.isLoading ? (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden>
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2">
              {Array.from({ length: skeletonRows }, (_, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={false}
                    disabled
                    label={
                      <span className="flex flex-1 items-center justify-between gap-2 text-sm">
                        <span className="text-fg">
                          <SkeletonText width={i % 2 ? '18ch' : '14ch'} />
                        </span>
                        <span className="text-muted">
                          <SkeletonText width="6ch" />
                        </span>
                      </span>
                    }
                    className="w-full rounded-lg px-2 py-2.5"
                  />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-fg">{t('priceTags.previewTitle', { count: 0 })}</p>
            <EmptyState compact icon={<Tag aria-hidden />} title={t('priceTags.previewEmpty')} />
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState kind={search ? 'search' : 'default'} icon={<Tag aria-hidden />} title={t('priceTags.emptyTitle')} description={t('priceTags.emptyText')} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem] print:block">
          <div className="flex flex-col gap-4 print:hidden">
            <ul className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2">
              {itemsPage.map((g) => (
                <li key={g.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selected.includes(g.id)}
                    onCheckedChange={(on) => toggle(g.id, on)}
                    label={
                      <span className="flex flex-1 items-center justify-between gap-2 text-sm">
                        <span className="text-fg">{g.name}</span>
                        <span className="text-muted">{g.salePrice ? format.money(g.salePrice) : '—'}</span>
                      </span>
                    }
                    className="w-full rounded-lg px-2 py-2.5 hover:bg-surface-2"
                  />
                  {selected.includes(g.id) && (
                    <Input
                      type="number"
                      min={1}
                      value={String(copiesFor(g.id))}
                      onChange={(e) => setCopies((prev) => ({ ...prev, [g.id]: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-16 shrink-0 text-right"
                      aria-label={t('priceTags.copies')}
                    />
                  )}
                </li>
              ))}
            </ul>
            {pager}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-fg print:hidden">{t('priceTags.previewTitle', { count: selectedGoods.length })}</p>
            {selectedGoods.length === 0 ? (
              <EmptyState compact icon={<Tag aria-hidden />} title={t('priceTags.previewEmpty')} />
            ) : (
              <div className="flex flex-wrap gap-2 print:gap-1">
                {selectedGoods.flatMap((g) =>
                  Array.from({ length: copiesFor(g.id) }, (_, i) => (
                    <div
                      key={`${g.id}_${i}`}
                      className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border-strong bg-surface p-2 text-center print:border-solid"
                      style={{ width: `${(isLandscape ? size.h : size.w) * 3}px`, minHeight: `${(isLandscape ? size.w : size.h) * 3}px` }}
                    >
                      {layout?.showBrand && g.brand && <p className="text-[10px] text-muted">{g.brand}</p>}
                      <p className="max-w-full truncate text-xs font-semibold text-fg">{g.receiptName || g.name}</p>
                      <p className="text-base font-bold text-fg">{g.salePrice ? format.money(g.salePrice) : '—'}</p>
                      {layout?.showSku && g.sku && <p className="text-[10px] text-muted">{g.sku}</p>}
                      {layout?.showBarcode && g.barcode && <p className="font-mono text-[10px] tracking-widest text-muted">{g.barcode}</p>}
                      <p className="text-[9px] text-muted">{unitShort(g.saleUnit)}</p>
                    </div>
                  )),
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

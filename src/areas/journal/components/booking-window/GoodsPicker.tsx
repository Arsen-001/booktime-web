'use client';

/**
 * F-01-055 (вкладка «Товары» + поиск), F-01-060 / F-01-211 (каталог товаров, абонементов, сертификатов).
 */
import { useMemo, useState } from 'react';
import type { GoodsCatalogItem } from '@/domain/journal';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { normalizeSearch } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { SearchInput } from '@/ui/SearchInput';

export interface GoodsPickerProps {
  catalog: GoodsCatalogItem[];
  onAdd: (item: GoodsCatalogItem) => void;
}

export function GoodsPicker({ catalog, onAdd }: GoodsPickerProps) {
  const t = useT('journal');
  const format = useFormat();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return q ? catalog.filter((i) => normalizeSearch(i.name).includes(q)) : catalog;
  }, [catalog, query]);

  return (
    <div data-f="F-01-055 F-01-060 F-01-211 F-08-068" className="flex flex-col gap-3">
      <SearchInput value={query} onValueChange={setQuery} placeholder={t('window.center.searchGoods')} />
      <p className="text-xs font-medium text-muted">{t('window.center.goodsCatalogTitle')}</p>
      {/* Ск3: подсказка «добавьте на склад» — только когда товаров склада в каталоге нет */}
      {!catalog.some((i) => i.kind === 'product') && <p className="text-xs text-muted">{t('window.center.goodsEmpty')}</p>}
      <div className="flex flex-col gap-1">
        {filtered.map((item) => {
          const outOfStock = item.kind === 'product' && item.stock <= 0;
          return (
            <button
              key={item.id}
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(item)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{item.name}</span>
                {item.kind !== 'product' && (
                  <Badge tone={item.kind === 'subscription' ? 'accent' : 'info'} size="sm">
                    {item.kind === 'subscription' ? t('window.goodsLine.kindSubscription') : t('window.goodsLine.kindCertificate')}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 text-muted">{outOfStock ? t('window.goodsLine.outOfStock') : format.money(item.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

/**
 * Сохранённая карточка товара (F-08-026): остатки по складам + журнал изменений (⭐ F-00-040).
 * ⭐ F-00-143: если у товара задан оттенок, показываем — виден ли он сейчас клиенту в палитре записи
 * (палитра берёт оттенки с остатком > 0, api listClientPalette).
 */
import { Archive, ArrowRightLeft, Printer } from 'lucide-react';
import { listClientPalette, type StockLevel } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { type HistoryEntry, type Warehouse } from '@/domain/stock';
import { cn } from '@/lib/cn';
import { formatQty, warehouseLabel, useUnitShort } from '@/areas/stock/warehouse.utils';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { KeyValueList } from '@/ui/KeyValueList';
import { SectionCard } from '@/ui/SectionCard';

export function GoodSavedPanel({
  levels,
  warehouses,
  history,
  goodId,
  businessId,
  locationId,
  shade,
  archived,
  saleUnit,
}: {
  levels: StockLevel[];
  warehouses: Warehouse[];
  history: HistoryEntry[];
  goodId: Id;
  businessId: Id;
  locationId: Id;
  shade?: string;
  archived: boolean;
  saleUnit: string;
}) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const format = useFormat();
  const paletteQ = useApiQuery(['stock', 'clientPalette', businessId, locationId], () => listClientPalette(businessId, locationId), { enabled: Boolean(shade) });
  const inPalette = Boolean(shade) && (paletteQ.data ?? []).some((p) => p.id === goodId);
  const total = Math.round(levels.reduce((sum, l) => sum + l.qty, 0) * 1e6) / 1e6;

  return (
    <>
      <SectionCard
        title={t('goodForm.section.stockLevels')}
        actions={
          // F-08-095: «Ценник в PDF» — страница для печати одного товара
          <LinkButton href={`/biz/stock/goods/${goodId}/price-tag`} variant="secondary" size="sm" leftIcon={<Printer aria-hidden />}>
            {t('goodForm.priceTagPdf')}
          </LinkButton>
        }
      >
        {archived && (
          <div className="mb-3">
            <Badge tone="neutral" size="sm">
              <Archive aria-hidden className="mr-1 inline size-3.5" />
              {t('goodForm.archivedBadge')}
            </Badge>
          </div>
        )}
        {Boolean(shade) && !paletteQ.isLoading && (
          <div className="mb-3" data-f="F-08-142 F-00-143 F-00-144">
            <Badge tone={inPalette ? 'success' : 'neutral'} size="sm">
              {inPalette ? t('goodForm.inPaletteYes') : t('goodForm.inPaletteNo')}
            </Badge>
          </div>
        )}
        {/* Ск2: все склады локации (0 — тоже строка), минус — красным, итог и переход к движению товара */}
        {warehouses.length === 0 && levels.length === 0 ? (
          <EmptyState compact title={t('goodForm.noStockYet')} description={t('goodForm.noStockYetText')} />
        ) : (
          <div className="flex flex-col gap-3">
            <KeyValueList
              items={[
                ...warehouses.map((w) => ({ id: w.id, label: warehouseLabel(w, t) })),
                // Остаток на складе другой локации/удалённом складе — тоже показываем, а не прячем
                ...levels.filter((l) => !warehouses.some((w) => w.id === l.warehouseId)).map((l) => ({ id: l.warehouseId, label: t('goodForm.otherWarehouse') })),
              ].map((w) => {
                const qty = levels.find((l) => l.warehouseId === w.id)?.qty ?? 0;
                return {
                  key: goodId + w.id,
                  label: w.label,
                  value: (
                    <span className={cn('tabular-nums', qty < 0 ? 'font-semibold text-danger' : qty === 0 ? 'text-muted' : 'text-fg')}>
                      {formatQty(qty)} {unitShort(saleUnit)}
                    </span>
                  ),
                };
              })}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-sm text-muted">
                {t('goodForm.totalStock')}:{' '}
                <span className={cn('font-semibold tabular-nums', total < 0 ? 'text-danger' : 'text-fg')}>
                  {formatQty(total)} {unitShort(saleUnit)}
                </span>
              </span>
              <LinkButton href={`/biz/stock/operations?good=${goodId}`} variant="secondary" size="sm" leftIcon={<ArrowRightLeft aria-hidden />}>
                {t('goodForm.movementLink')}
              </LinkButton>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('goodForm.section.history')}>
        {history.length === 0 ? (
          <EmptyState compact title={t('goodForm.noHistory')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {history.slice(0, 10).map((h) => (
              <li key={h.id} className="flex flex-col gap-0.5 text-sm">
                <span className="text-fg">{h.summary}</span>
                <span className="text-xs text-muted">
                  {h.staffName} · {format.date(h.at, 'long')} {format.time(h.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

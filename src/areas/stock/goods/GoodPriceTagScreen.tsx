'use client';

/**
 * /biz/stock/goods/[goodId]/price-tag — «Ценник в PDF» из карточки товара (F-08-095): быстрый ценник
 * одного товара, страница для печати (PDF-пакета нет — системный диалог печати браузера, см. F-08-072).
 */
import { useUnitShort } from '@/areas/stock/warehouse.utils';
import { Package, Printer } from 'lucide-react';
import { getGood, getPriceTagLayout } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { PRICE_TAG_SIZE_MM } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

export function GoodPriceTagScreen({ goodId }: { goodId: Id }) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const goodQ = useApiQuery(['stock', 'good', businessId, goodId], () => getGood(businessId!, goodId), { enabled: ready && Boolean(businessId) });
  const layoutQ = useApiQuery(['stock', 'priceTagLayout', businessId], () => getPriceTagLayout(businessId!), { enabled: ready && Boolean(businessId) });

  if (goodQ.isError) return <ErrorState onRetry={goodQ.refetch} />;
  if (!ready || goodQ.isLoading || layoutQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={4} />
      </div>
    );
  }
  const good = goodQ.data;
  if (!good) return <EmptyState icon={<Package aria-hidden />} title={t('goodForm.notFound')} />;
  const layout = layoutQ.data ?? { size: 'medium' as const, showBarcode: true, showSku: false, showBrand: true };
  const size = PRICE_TAG_SIZE_MM[layout.size];

  return (
    <div data-f="F-08-095" className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4 print:max-w-full print:p-0">
      <div className="print:hidden">
        <PageHeader
          title={t('goodForm.priceTagPdf')}
          back={{ href: `/biz/stock/goods/${goodId}` }}
          actions={
            <Button leftIcon={<Printer className="size-4" aria-hidden />} onClick={() => { if (typeof print === 'function') print(); }}>
              {t('receipt.print')}
            </Button>
          }
        />
      </div>

      <div
        className="mx-auto flex flex-col items-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface p-4 text-center print:border-solid"
        style={{ width: `${size.w * 3}px`, minHeight: `${size.h * 3}px` }}
      >
        {layout.showBrand && good.brand && <p className="text-xs text-muted">{good.brand}</p>}
        <p className="text-sm font-semibold text-fg">{good.receiptName || good.name}</p>
        <p className="text-2xl font-bold text-fg">{format.money(good.salePrice)}</p>
        {layout.showSku && good.sku && <p className="text-xs text-muted">{t('priceTags.sku')}: {good.sku}</p>}
        {layout.showBarcode && good.barcode && <p className="font-mono text-xs tracking-widest text-muted">{good.barcode}</p>}
        <p className="text-[10px] text-muted">{unitShort(good.saleUnit)}</p>
      </div>
    </div>
  );
}

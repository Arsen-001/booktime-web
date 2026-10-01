'use client';

/**
 * F-00-165 (В-26): предложение поставщика рядом с товаром на исходе — только у мастеров, включивших
 * «Получать предложения поставщиков» в /biz/stock/settings. Место `pl_stock`, подбор — getSupplierOfferForGood
 * (api/stock.ts, читает каталог рекламы платформы напрямую). Показ и клик считает платформа (её own статистика),
 * поэтому reportSupplierOfferShown/Clicked зовут её api, а не свой счётчик.
 */
import { useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import { getSupplierOfferForGood, reportSupplierOfferClicked, reportSupplierOfferShown } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';

export function SupplierOfferCard({ businessId, productName }: { businessId: Id; productName: string }) {
  const t = useT('stock');
  const q = useApiQuery(['stock', 'supplierOffer', businessId, productName], () => getSupplierOfferForGood(businessId, productName), {
    enabled: Boolean(businessId) && Boolean(productName),
  });
  const offer = q.data;

  useEffect(() => {
    if (offer) void reportSupplierOfferShown(offer.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- считать показ только на смену самого объявления
  }, [offer?.id]);

  if (!offer) return null;

  const onClick = () => {
    void reportSupplierOfferClicked(offer.id);
  };

  return (
    <a
      href={offer.ctaUrl ?? '#'}
      target={offer.ctaUrl ? '_blank' : undefined}
      rel={offer.ctaUrl ? 'noopener' : undefined}
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-3 transition hover:bg-surface-3"
    >
      <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Badge tone="neutral" size="sm">
            {t('order.offerBadge')}
          </Badge>
          <span className="truncate text-xs text-muted">{offer.advertiser.name}</span>
        </div>
        <p className="truncate text-sm font-medium text-fg">{offer.title}</p>
        {offer.text && <p className="truncate text-xs text-muted">{offer.text}</p>}
      </div>
    </a>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { getActiveAds, trackAdClick, trackAdImpression } from '@/api/platform/ads';
import { useApiQuery } from '@/api/request';
import type { DistrictId, SphereId } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';

/**
 * Рекламное место (F-00-163): баннер ставит только наша панель (`/platform/ads`); здесь читаем активное объявление места
 * и считаем показ/клик. Нет объявления — блока нет вовсе (не пунктирная рамка). Район и сфера — для таргетинга панели.
 */
export function AdBanner({ placementId, district, sphereId }: { placementId: string; district?: DistrictId; sphereId?: SphereId }) {
  const t = useT('client');
  const q = useApiQuery(['client', 'ad', placementId, district ?? '', sphereId ?? ''], () =>
    getActiveAds(placementId, { district, sphereId }),
  );
  const ad = q.data?.[0];
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (ad && shown.current !== ad.id) {
      shown.current = ad.id;
      void trackAdImpression(ad.id);
    }
  }, [ad]);
  if (!ad) return null;

  const body = (
    <>
      {ad.imageUrl && (
        <Image src={ad.imageUrl} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-lg object-cover" />
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 font-medium text-fg">{ad.title}</span>
        {ad.text && <span className="line-clamp-1 text-sm text-muted">{ad.text}</span>}
      </span>
      <Badge tone="neutral" variant="outline" size="sm">
        {t('home.adBadge')}
      </Badge>
    </>
  );
  if (!ad.ctaUrl) {
    return (
      <Card data-f="F-00-163" padding="md" className="flex items-center gap-3">
        {body}
      </Card>
    );
  }
  return (
    <Card data-f="F-00-163" href={ad.ctaUrl} padding="md" className="flex items-center gap-3" onClick={() => void trackAdClick(ad.id)}>
      {body}
    </Card>
  );
}

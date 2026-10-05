'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { SalonConsentBanner } from '@/areas/online/public/SalonConsentBanner';
import type { BookingLink } from '@/domain/online';
import {
  loadSalonCounters,
  salonConsentSnapshot,
  salonCounterIds,
  salonPageView,
  subscribeSalonConsent,
  writeSalonConsent,
  type SalonConsent,
} from '@/lib/salonCounters';

/**
 * Счётчики салона (F-03-118 Meta Pixel, F-03-119 GA4) на /b/<slug> и в записи: подключаются только после согласия
 * посетителя (src/lib/salonCounters.ts). Нет ID у ссылки — ничего не рисует и не спрашивает. Согласие — на этот салон;
 * решение запоминается, баннер больше не показывается. Без решения скрипты не грузятся (по умолчанию — приватно).
 */
export function SalonCounters({ businessId, businessName, link }: { businessId: string; businessName: string; link: BookingLink | undefined }) {
  const ids = salonCounterIds(link);
  const consent = useSyncExternalStore<SalonConsent | 'unknown' | 'server'>(
    subscribeSalonConsent,
    () => salonConsentSnapshot(businessId),
    () => 'server',
  );
  const metaPixelId = ids?.metaPixelId;
  const ga4StreamId = ids?.ga4StreamId;

  // Разрешено — подключить и отметить просмотр (каждый показ страницы салона или записи)
  useEffect(() => {
    if (consent !== 'granted' || (!metaPixelId && !ga4StreamId)) return;
    loadSalonCounters({ metaPixelId, ga4StreamId });
    salonPageView();
  }, [consent, metaPixelId, ga4StreamId]);

  if (!ids || consent !== 'unknown') return null;
  return <SalonConsentBanner businessName={businessName} onDecide={(v) => writeSalonConsent(businessId, v)} />;
}

'use client';

/**
 * ⭐ Допродажа при записи (01.10.2026) на настоящем сервере: модуль journal бэкенда (UpsellService). Сопутствующие
 * хранятся в Service.extra.upsell — пишет их `updateServiceExtra` (services.server.ts), здесь только чтения.
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import type { Id } from '@/domain/core';
import type { ServiceUpsell, UpsellCandidates, UpsellOffers, UpsellOffersQuery, UpsellStats } from '@/domain/services';

export function getUpsellOffersServer(q: UpsellOffersQuery): Promise<UpsellOffers> {
  trackRead('core.bookings', 'areas.services');
  return http('GET', '/v1/public/upsell-offers', undefined, {
    query: { staffId: q.staffId, serviceIds: q.serviceIds.join(','), start: q.start, added: q.added?.length ? q.added.join(',') : undefined, locationId: q.locationId },
  });
}

export function listUpsellCandidatesServer(businessId: Id): Promise<UpsellCandidates> {
  trackRead('core.services', 'areas.services');
  return http('GET', `/v1/biz/${businessId}/upsell/candidates`);
}

export function getUpsellStatsServer(businessId: Id, serviceId: Id): Promise<UpsellStats> {
  trackRead('core.bookings');
  return http('GET', `/v1/biz/${businessId}/services/${serviceId}/upsell-stats`);
}

export function listUpsellConfigsServer(businessId: Id): Promise<Record<Id, ServiceUpsell>> {
  trackRead('core.services', 'areas.services');
  return http('GET', `/v1/biz/${businessId}/upsell/configs`);
}

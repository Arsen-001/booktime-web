'use client';

/**
 * Раздел «platform»: обзор на настоящем сервере (booktime-backend, PLAN.md §7, этап 19).
 * demandWithoutOffer и waves сервер этого прохода честно отдаёт 0 / [] — спрос/first-awards и план запуска не
 * входят в этот проход (см. docs/PROGRESS.md booktime-backend, этап 19).
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import type { OverviewSummary } from '@/domain/platform';

export const getOverview = () => {
  trackRead('areas.platform');
  return http<OverviewSummary>('GET', '/v1/platform/overview');
};

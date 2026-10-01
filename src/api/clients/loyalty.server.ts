'use client';

/**
 * «Программа лояльности» локации на настоящем сервере (docs/backend/PLAN.md этап 11, `02-api.md` §11 —
 * `…/loyalty/program`). Это старый, отдельный движок автоскидок/классов/категорий (F-04-114…122) — не
 * путать с сетевой лояльностью раздела 06 (карты/акции/сертификаты/абонементы/счета), которая на экранах
 * пока не построена (широкий Altegio-паритет `src/api/loyalty.ts`, 2900+ строк — см. `PROGRESS.md` этапа 11,
 * «Решено по ходу»: тот же приём, что этап 10 оставил 88-типовой каталог уведомлений на моке).
 */
import type { LoyaltyProgram, LoyaltyRecalcChange, LoyaltyRecalcTrigger } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { http } from '@/api/http';

export function getLoyaltyProgram(businessId: Id): Promise<LoyaltyProgram> {
  return http('GET', `/v1/biz/${businessId}/loyalty/program`);
}

export function saveLoyaltyProgram(businessId: Id, program: LoyaltyProgram): Promise<{ program: LoyaltyProgram; recalculated: number }> {
  return http('PUT', `/v1/biz/${businessId}/loyalty/program`, program);
}

export function recalcClientLoyalty(businessId: Id, clientId: Id, _trigger: LoyaltyRecalcTrigger): Promise<LoyaltyRecalcChange | null> {
  // Сервер сам решает, каким триггером считать ручной вызов с экрана (F-04-073 «ручной пересчёт»);
  // автоматические моменты (сохранение программы, «пришёл»/«не пришёл») сервер уже вызывает сам изнутри
  // (LoyaltyProgramService.save, BookingsService.changeStatus) — со стороны экрана их дублировать не нужно.
  return http('POST', `/v1/biz/${businessId}/loyalty/clients/${clientId}/program/recalculate`);
}

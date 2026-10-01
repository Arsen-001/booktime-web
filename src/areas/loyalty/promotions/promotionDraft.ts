/**
 * Общий черновик формы акции — используется и мастером создания (/biz/loyalty/promotions/new,
 * F-06-032…F-06-047), и правкой (/biz/loyalty/promotions/[promotionId], F-06-050): те же поля, разное
 * представление (по шагам / все секции сразу).
 */
import type { Id } from '@/domain/core';
import type { PromotionInput } from '@/api/loyalty';
import { ACCUMULATING_KINDS, defaultPromotionNotify, defaultPromotionSchedule, FREQUENCY_LIMIT_KINDS, SUM_BASIS_KINDS, type Promotion, type PromotionKind, type PromotionNotify, type PromotionSchedule, type PromotionSourceScope, type PromotionSumBasis, type PromotionThreshold, type PromotionValueType, type ScopeLimitMode, type ServiceScope } from '@/domain/loyalty';

/** F-06-033: скидки — четыре вида, бонусы — четыре вида; шаг 1 выбирает только семью */
export type PromotionFamily = 'discount' | 'bonus';

export const DISCOUNT_KINDS: PromotionKind[] = ['discountFixed', 'discountAccumVisits', 'discountAccumSum', 'discountConditional'];
export const BONUS_KINDS: PromotionKind[] = ['cashbackFixed', 'cashbackAccumVisits', 'cashbackAccumSum', 'cashbackVisit'];

export function familyOf(kind: PromotionKind): PromotionFamily {
  return kind.startsWith('discount') ? 'discount' : 'bonus';
}

export function isAccumulating(kind: PromotionKind): boolean {
  return (ACCUMULATING_KINDS as PromotionKind[]).includes(kind);
}

export function needsSumBasis(kind: PromotionKind): boolean {
  return (SUM_BASIS_KINDS as PromotionKind[]).includes(kind);
}

export function needsFrequencyLimit(kind: PromotionKind): boolean {
  return (FREQUENCY_LIMIT_KINDS as PromotionKind[]).includes(kind);
}

/** F-06-035: фиксированная скидка — единственный вид без правил отмены/сгорания на шаге 4 */
export function needsCancelBurn(kind: PromotionKind): boolean {
  return kind !== 'discountFixed';
}

export interface PromotionDraft {
  name: string;
  family: PromotionFamily;
  kind: PromotionKind;
  valueType: PromotionValueType;
  value: number;
  thresholds: PromotionThreshold[];
  conditionCount: number;
  conditionServiceIds: Id[];
  sourceScope: PromotionSourceScope;
  historyStartDate: string;
  sumBasis: PromotionSumBasis;
  applyFrequency: number;
  applyLimit: number;
  cancelEnabled: boolean;
  cancelDays: number;
  burnEnabled: boolean;
  burnDays: number;
  serviceLimitMode: ScopeLimitMode;
  serviceScope: ServiceScope;
  productLimitMode: ScopeLimitMode;
  cardTypeIds: Id[];
  locationIds: Id[];
  notifyEnabled: boolean;
  notify: PromotionNotify;
  /** F-06-183 — расписание по дням недели/часам */
  schedule: PromotionSchedule;
  /** F-06-183 — период действия акции (ISODate); пусто = бессрочно */
  validFrom: string;
  validTo: string;
}

export function defaultDraft(): PromotionDraft {
  return {
    name: '',
    family: 'discount',
    kind: 'discountFixed',
    valueType: 'percent',
    value: 0,
    thresholds: [{ from: 0, value: 5 }],
    conditionCount: 5,
    conditionServiceIds: [],
    sourceScope: 'activeLocations',
    historyStartDate: '',
    sumBasis: 'afterDiscounts',
    applyFrequency: 1,
    applyLimit: 0,
    cancelEnabled: false,
    cancelDays: 90,
    burnEnabled: false,
    burnDays: 90,
    serviceLimitMode: 'all',
    serviceScope: { categoryIds: [], serviceIds: [] },
    productLimitMode: 'all',
    cardTypeIds: [],
    locationIds: [],
    notifyEnabled: false,
    notify: defaultPromotionNotify(),
    schedule: defaultPromotionSchedule(),
    validFrom: '',
    validTo: '',
  };
}

export function draftFromPromotion(p: Promotion): PromotionDraft {
  const base = defaultDraft();
  return {
    ...base,
    name: p.name,
    family: familyOf(p.kind),
    kind: p.kind,
    valueType: p.valueType,
    value: p.value,
    thresholds: p.thresholds?.length ? p.thresholds : base.thresholds,
    conditionCount: p.conditionCount ?? base.conditionCount,
    conditionServiceIds: p.conditionServiceIds ?? [],
    sourceScope: p.sourceScope ?? base.sourceScope,
    historyStartDate: p.historyStartDate ?? '',
    sumBasis: p.sumBasis ?? base.sumBasis,
    applyFrequency: p.applyFrequency ?? 1,
    applyLimit: p.applyLimit ?? 0,
    cancelEnabled: Boolean(p.cancelAfterDays),
    cancelDays: p.cancelAfterDays ?? base.cancelDays,
    burnEnabled: Boolean(p.burnAfterDays),
    burnDays: p.burnAfterDays ?? base.burnDays,
    serviceLimitMode: p.serviceScope && (p.serviceScope.categoryIds.length || p.serviceScope.serviceIds.length) ? 'some' : 'all',
    serviceScope: p.serviceScope ?? base.serviceScope,
    productLimitMode: p.productLimitMode ?? 'all',
    cardTypeIds: p.cardTypeIds,
    locationIds: p.locationIds ?? [],
    notifyEnabled: p.notifyEnabled ?? false,
    notify: p.notify ?? base.notify,
    schedule: p.schedule ?? base.schedule,
    validFrom: p.validFrom ?? '',
    validTo: p.validTo ?? '',
  };
}

export function draftToInput(d: PromotionDraft): PromotionInput {
  const accumulating = isAccumulating(d.kind);
  return {
    name: d.name,
    kind: d.kind,
    cardTypeIds: d.cardTypeIds,
    valueType: d.valueType,
    value: d.value,
    thresholds: accumulating ? d.thresholds : undefined,
    conditionCount: d.kind === 'discountConditional' ? d.conditionCount : undefined,
    conditionServiceIds: d.kind === 'discountConditional' ? d.conditionServiceIds : undefined,
    sourceScope: accumulating ? d.sourceScope : undefined,
    historyStartDate: accumulating && d.historyStartDate ? d.historyStartDate : undefined,
    sumBasis: needsSumBasis(d.kind) ? d.sumBasis : undefined,
    applyFrequency: needsFrequencyLimit(d.kind) ? d.applyFrequency : undefined,
    applyLimit: needsFrequencyLimit(d.kind) ? d.applyLimit : undefined,
    cancelAfterDays: needsCancelBurn(d.kind) && d.cancelEnabled ? d.cancelDays : undefined,
    burnAfterDays: needsCancelBurn(d.kind) && d.burnEnabled ? d.burnDays : undefined,
    notifyEnabled: d.notifyEnabled,
    notify: d.notifyEnabled ? d.notify : undefined,
    locationIds: d.locationIds,
    serviceScope: d.serviceLimitMode === 'some' ? d.serviceScope : { categoryIds: [], serviceIds: [] },
    productLimitMode: d.productLimitMode,
    schedule: d.schedule.enabled ? d.schedule : undefined,
    validFrom: d.validFrom || undefined,
    validTo: d.validTo || undefined,
  };
}

import type { PlanLeg, PlanQuery } from '@/api/online';
import type { Id, Service, Staff, Workplace } from '@/domain/core';
import type { OnlinePackage } from '@/domain/online';
import { ANY_STAFF } from '@/areas/online/booking/wizard/useWizardUrl';

/**
 * Как записать выбранные услуги (О4):
 *  - 'single' — есть мастер(а), который делает ВСЕ услуги: одна запись, мастер выбранный или «любой» (О8);
 *  - 'chain'  — такого нет (или пакет «последовательно несколькими мастерами»): разные мастера подряд, на
 *    каждую услугу свой мастер или «любой», время подбирается цепочкой. Клиент никогда не упирается в тупик.
 */
export type VisitMode = 'single' | 'chain';

export interface VisitPlan {
  mode: VisitMode;
  /** Мастера, которые делают все услуги (single) */
  allEligible: Staff[];
  /** По каждой услуге — кто её делает (chain) */
  perService: { service: Service; eligible: Staff[] }[];
  /** Готовый запрос окон — undefined, пока не хватает выбора (мастер не выбран) */
  query: PlanQuery | undefined;
  /** Мастер на весь визит (single): выбранный или undefined для «любого»/невыбранного */
  staffId: Id | undefined;
  anyStaff: boolean;
}

const booked = (s: Service) => s.durationMax ?? s.durationMin;

export function buildVisitPlan(args: {
  services: Service[];
  staff: Staff[];
  /** Мастера, которых можно назначить «любым» (у мастера не выключено) */
  anyPool: (list: Staff[]) => Staff[];
  pkg: OnlinePackage | undefined;
  staffParam: string | undefined;
  legStaff: Record<string, string>;
  businessId: Id;
  slug: string;
  locationId: Id | undefined;
  workplace: Workplace | undefined;
  maxDate: string | undefined;
  /** Мастер зафиксирован ссылкой (F-03-070/F-03-005) */
  forcedStaffId: Id | undefined;
}): VisitPlan {
  const { services, staff, pkg, staffParam, legStaff } = args;
  const perService = services.map((service) => ({ service, eligible: staff.filter((s) => s.serviceIds.includes(service.id)) }));
  const allEligible = staff.filter((s) => services.length === 0 || services.every((sv) => s.serviceIds.includes(sv.id)));
  const base = { businessId: args.businessId, slug: args.slug, locationId: args.locationId, workplace: args.workplace, maxDate: args.maxDate };
  const chain = services.length > 1 && !args.forcedStaffId && (pkg?.mode === 'sequentialMulti' || allEligible.length === 0);

  if (chain) {
    const legs: PlanLeg[] = [];
    let complete = true;
    for (const { service, eligible } of perService) {
      const pick = legStaff[service.id] ?? ANY_STAFF;
      const staffIds = pick === ANY_STAFF ? args.anyPool(eligible).map((s) => s.id) : eligible.some((s) => s.id === pick) ? [pick] : [];
      if (staffIds.length === 0) complete = false;
      legs.push({ serviceIds: [service.id], staffIds, durationMin: service.durationMin, durationMax: booked(service) });
    }
    return { mode: 'chain', allEligible, perService, query: complete && legs.length ? { ...base, legs } : undefined, staffId: undefined, anyStaff: false };
  }

  const forced = args.forcedStaffId && allEligible.some((s) => s.id === args.forcedStaffId) ? args.forcedStaffId : undefined;
  const chosen = forced ?? staffParam;
  const anyStaff = chosen === ANY_STAFF;
  const staffIds = anyStaff ? args.anyPool(allEligible).map((s) => s.id) : chosen && allEligible.some((s) => s.id === chosen) ? [chosen] : [];
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
  const durationMax = services.reduce((sum, s) => sum + booked(s), 0);
  const leg: PlanLeg = { serviceIds: services.map((s) => s.id), staffIds, durationMin, durationMax };
  return {
    mode: 'single',
    allEligible,
    perService,
    query: staffIds.length && services.length ? { ...base, legs: [leg] } : undefined,
    staffId: !anyStaff && staffIds.length === 1 ? staffIds[0] : undefined,
    anyStaff,
  };
}

/** Ключ кэша для окон плана — только то, от чего зависят окна */
export function planKey(q: PlanQuery | undefined): unknown {
  if (!q) return null;
  return { l: q.legs.map((l) => [l.serviceIds.join('+'), l.staffIds.join('+'), l.durationMin, l.durationMax ?? 0]), loc: q.locationId ?? '', wp: q.workplace ?? '', max: q.maxDate ?? '' };
}

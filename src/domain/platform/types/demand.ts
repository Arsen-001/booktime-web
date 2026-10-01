/** Типы раздела «platform»: demand. */
import type { DistrictId, ISODate, ISODateTime, Id, SphereId } from '@/domain/core';
import type { DemandQueryGroup } from '@/domain/platform/types/dto';

// ─────────────────────────── Спрос (F-00-180, F-00-202, F-00-181) ───────────────────────────

/** Один запрос «кого ищете» из пустого поиска клиента (F-00-112) */
export interface DemandEntry {
  id: Id;
  query: string;
  sphereId?: SphereId;
  district: DistrictId;
  appUserId: Id;
  at: ISODateTime;
  /** Попросил «сообщить, когда появится» */
  notify: boolean;
}

export type DemandPeriod = 'week' | 'prevWeek' | 'month';

/** Строка отчёта: что ищут в районе, сколько разных людей, есть ли у нас предложение */
export interface DemandRow {
  key: string;
  query: string;
  sphereId?: SphereId;
  district: DistrictId;
  people: number;
  requests: number;
  notify: number;
  /** Бизнесов этой сферы в районе */
  offerInDistrict: number;
  /** Бизнесов этой сферы в городе */
  offerInCity: number;
}

export interface DemandSphereRow {
  key: string;
  query: string;
  sphereId?: SphereId;
  people: number;
  districts: DistrictId[];
}

export interface DemandReport {
  period: DemandPeriod;
  from: ISODate;
  to: ISODate;
  /** Один запрос — одна строка, районы внутри; сначала те, где предложения нет, по числу людей */
  groups: DemandQueryGroup[];
  /** Что ищут, а сферы/предложения нет во всём городе (F-00-153) */
  noSphere: DemandSphereRow[];
  totalPeople: number;
  /** Запросов, у которых хотя бы в одном районе нет предложения */
  withoutOffer: number;
}

export type FirstScope = 'sphere' | 'district';

export interface FirstAward {
  id: Id;
  businessId: Id;
  scope: FirstScope;
  sphereId: SphereId;
  district?: DistrictId;
  freeDays: number;
  coins: number;
  at: ISODateTime;
}

/** Что видит клиент на карточке мастера: где «первый» (без дней и монет награды) */
export type FirstBadge = Pick<FirstAward, 'scope' | 'sphereId' | 'district'>;

export interface FirstCandidate {
  key: string;
  businessId: Id;
  businessName: string;
  scope: FirstScope;
  sphereId: SphereId;
  district?: DistrictId;
  awarded?: FirstAward;
}

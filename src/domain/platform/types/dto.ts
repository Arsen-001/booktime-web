/** Типы раздела «platform»: dto. */
import type { BusinessKind, DistrictId, ISODate, Id, Money, SphereId } from '@/domain/core';
import type { WaveNo } from '@/domain/platform/types/plan';
import type { BizMeta } from '@/domain/platform/types/promo';

// ─────────────────────────── Ответы для экранов панели (DTO) ───────────────────────────

/** Кому перезвонить: просроченные и сегодняшние «перезвонить» из визитов */
export interface CallbackItem {
  visitId: Id;
  placeName: string;
  contactName?: string;
  phone?: string;
  callbackDate: ISODate;
  /** 0 — сегодня, больше 0 — на сколько дней просрочено */
  overdueDays: number;
}

/** Обзор панели одним ответом: что требует действия сегодня и цифры недели */
export interface OverviewSummary {
  pendingModeration: number;
  openTickets: number;
  connectedWeek: number;
  /** Запросов клиентов, у которых хотя бы в одном районе нет предложения */
  demandWithoutOffer: number;
  callbacks: CallbackItem[];
  /** Записи через приложение по дням за 7 дней (последний — сегодня) */
  appBookings: { date: ISODate; count: number }[];
  appBookingsTotal: number;
  waves: { wave: WaveNo; passed: number; total: number }[];
}

/** Один запрос клиентов по всем районам — строка отчёта спроса */
export interface DemandQueryGroup {
  key: string;
  query: string;
  sphereId?: SphereId;
  /** Разных людей по всем районам */
  people: number;
  requests: number;
  notify: number;
  /** Бизнесов этой сферы в городе */
  offerInCity: number;
  districts: { district: DistrictId; people: number; offerInDistrict: number }[];
  /** В скольких районах, где искали, предложения нет */
  districtsWithoutOffer: number;
}

/** Итог подключения салона — для экрана «передать владельцу» */
export interface ConnectResult {
  businessId: Id;
  name: string;
  slug: string;
  kind: BusinessKind;
  ownerPhone: string;
  freeUntil?: ISODate;
  services: number;
  staff: number;
  photos: number;
  promoCode?: string;
  /** Виден ли салон в каталоге клиента (правило ядра staffClientVisibility) и чего не хватает */
  inCatalog: boolean;
  catalogReasons: string[];
}

/** Что не даёт закончить подключение (коды — ключи connect.issue.* в словаре) */
export type ConnectIssue = 'name' | 'sphere' | 'ownerPhone' | 'services' | 'calendarMode';

/** Результат расчёта окупаемости (F-00-206) */
export interface PaybackResult {
  avgSalonRevenue: Money;
  avgIndividualRevenue: Money;
  breakevenSalons: number;
  breakevenIndividuals: number;
  totalNeeded: Money;
  salonsNeeded: number;
  individualsNeeded: number;
  totalInUsd: number;
  totalInEur: number;
}

/** Строка очереди бизнесов в панели */
export interface BusinessOverviewRow {
  id: Id;
  name: string;
  kind: BusinessKind;
  sphereIds: SphereId[];
  district?: DistrictId;
  status: 'active' | 'frozen' | 'left';
  staffCount: number;
  meta?: BizMeta;
}

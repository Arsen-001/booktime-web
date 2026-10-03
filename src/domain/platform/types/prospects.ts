/** Типы раздела «platform»: «Места» — база заведений Еревана для отдела продаж (03.10.2026). */
import type { DistrictId, ISODate, ISODateTime, Id } from '@/domain/core';
import type { VisitStatus } from '@/domain/platform/types/visits';

export type ProspectCategory = 'beauty' | 'nails' | 'barber' | 'hair' | 'brows_lashes' | 'cosmetology' | 'massage_spa' | 'clinic' | 'dental' | 'other';

/** Чем место ведёт запись сейчас — главный признак для продаж («кого переманиваем») */
export type BookingSystem =
  | 'emly'
  /** Страница на Emly есть, онлайн-запись выключена — главный кандидат */
  | 'emly_off'
  | 'booker'
  | 'sonline'
  | 'altegio'
  | 'fresha'
  | 'dikidi'
  | 'booksy'
  | 'own_site'
  | 'other_online'
  | 'medical_platform'
  | 'phone_whatsapp'
  | 'instagram'
  | 'unknown';

export type ProspectDistrict = DistrictId | 'unknown';

/** Выводится из визитов: не были / думает / подключили / отказ / работает в BookTime (есть бизнес) */
export type ProspectStatus = 'new' | VisitStatus | 'live';

export type ProspectSort = 'staff_desc' | 'staff_asc' | 'name_asc' | 'name_desc' | 'reviews_desc';

export interface ProspectReviews {
  rating?: number;
  count?: number;
  text?: string;
}

export interface Prospect {
  id: Id;
  name: string;
  category: ProspectCategory;
  district: ProspectDistrict;
  address?: string;
  branches?: number;
  staffEstimate?: number;
  /** Откуда оценка числа мастеров */
  staffSource?: string;
  bookingSystem: BookingSystem;
  bookingUrl?: string;
  website?: string;
  instagram?: string;
  /** Общий телефон заведения */
  phone?: string;
  reviews?: ProspectReviews;
  sourceUrls: string[];
  note?: string;
  tags?: string[];
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProspectLastVisit {
  id: Id;
  visitedAt: ISODate;
  status: VisitStatus;
}

/** Строка списка: место + статус из визитов */
export interface ProspectRow extends Prospect {
  status: ProspectStatus;
  lastVisit?: ProspectLastVisit;
  visitCount: number;
}

export interface ProspectVisitBrief {
  id: Id;
  visitedAt: ISODate;
  status: VisitStatus;
  responsibleId: Id;
  note?: string;
  businessId?: Id;
}

export interface ProspectCard extends ProspectRow {
  visits: ProspectVisitBrief[];
}

export interface ProspectFilter {
  systems?: BookingSystem[];
  category?: ProspectCategory;
  district?: ProspectDistrict;
  staffMin?: number;
  staffMax?: number;
  status?: ProspectStatus;
  q?: string;
}

export interface ProspectListQuery extends ProspectFilter {
  sort?: ProspectSort;
  page?: number;
  pageSize?: number;
}

export interface ProspectListResult {
  items: ProspectRow[];
  total: number;
  /** Сколько мест на каждой системе записи — при всех фильтрах, кроме системы */
  systemCounts: Record<BookingSystem, number>;
  /** Всего мест в базе */
  totalAll: number;
}

export type ProspectPatch = Partial<
  Pick<Prospect, 'name' | 'category' | 'district' | 'address' | 'staffSource' | 'bookingSystem' | 'bookingUrl' | 'website' | 'instagram' | 'phone' | 'sourceUrls' | 'note' | 'tags'>
> & { branches?: number | null; staffEstimate?: number | null; reviews?: ProspectReviews | null };

export interface ProspectImportReport {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: { index: number; reason: string }[];
}

export interface ProspectExport {
  fileName: string;
  csv: string;
  rows: number;
}

/** Место в моковой базе — с ключом дедупликации «имя|адрес» (как столбец dedup_key на сервере) */
export interface StoredProspect extends Prospect {
  dedupKey: string;
}

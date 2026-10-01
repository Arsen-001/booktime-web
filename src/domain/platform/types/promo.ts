/** Типы раздела «platform»: promo. */
import type { ISODate, ISODateTime, Id } from '@/domain/core';

// ─────────────────────────── Промокоды и бесплатные месяцы (F-00-178, F-00-020, F-00-019) ───────────────────────────

export type PromoKind = 'discount' | 'freeMonth';
export type PromoMonths = 1 | 3 | 6 | 12;

export interface PromoTier {
  months: PromoMonths;
  percent: number;
}

/** Состояние считается из полей: new — не выдан; issued — выдан; used; expired; revoked */
export type PromoStatus = 'new' | 'issued' | 'used' | 'expired' | 'revoked';

export interface PromoIssue {
  name: string;
  phone?: string;
  visitId?: Id;
  businessId?: Id;
}

export interface PromoCode {
  id: Id;
  code: string;
  kind: PromoKind;
  tiers: PromoTier[];
  /** Для «бесплатного месяца»: сколько дней */
  freeDays?: number;
  /** Личный на салон: принять может только он */
  personal: boolean;
  validUntil?: ISODate;
  issuedTo?: PromoIssue;
  issuedAt?: ISODateTime;
  usedAt?: ISODateTime;
  usedByBusinessId?: Id;
  usedMonths?: PromoMonths;
  revokedAt?: ISODateTime;
  note?: string;
  createdAt: ISODateTime;
}

export interface PromoView extends PromoCode {
  status: PromoStatus;
  /** Название бизнеса из ядра (одно название везде, а не текст из заявки) */
  issuedToBusinessName?: string;
  usedByBusinessName?: string;
}

/** Бизнес, подключённый на визите, — ему можно выдать бесплатный месяц (F-00-019) */
export interface VisitBusiness {
  id: Id;
  name: string;
  freeUntil?: ISODate;
}

export type PromoInput = Pick<PromoCode, 'code' | 'kind' | 'tiers' | 'freeDays' | 'personal' | 'validUntil' | 'note'> & {
  issuedTo?: PromoIssue;
};

export type PromoCheck =
  | { ok: true; promo: PromoView }
  | { ok: false; reason: 'notFound' | 'used' | 'expired' | 'revoked' | 'personal' };

export type FreeMonthReason = 'visit' | 'first' | 'promo' | 'manual';

export interface FreeMonthGrant {
  id: Id;
  businessId: Id;
  days: number;
  reason: FreeMonthReason;
  at: ISODateTime;
  note?: string;
}

/** Наши сведения о бизнесе (ключ — businessId) */
export interface BizMeta {
  businessId: Id;
  /** visit — подключили мы на визите; self — зарегистрировался сам */
  source: 'visit' | 'self';
  /** Бесплатно до (включительно) */
  freeUntil?: ISODate;
  responsibleId?: Id;
  promoCodeId?: Id;
  /** Ушёл от нас */
  leftAt?: ISODate;
  /** Данные выданы при уходе */
  dataHandedAt?: ISODateTime;
  note?: string;
  /** F-00-164: сам разрешил присылать ему предложения поставщиков (по умолчанию — нет) */
  adsOptIn?: boolean;
}

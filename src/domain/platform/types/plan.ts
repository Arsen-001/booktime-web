/** Типы раздела «platform»: plan. */
import type { ISODateTime, Id, LocalizedText, Money } from '@/domain/core';

// ─────────────────────────── План запуска (F-00-203…208) ───────────────────────────

export type WaveNo = 1 | 2 | 3;
export type WaveItemStatus = 'todo' | 'building' | 'passed';

export interface WaveItem {
  id: Id;
  wave: WaveNo;
  fids: string[];
  title: LocalizedText;
  status: WaveItemStatus;
  note?: string;
}

export type PrelaunchStatus = 'open' | 'decided' | 'done';

export interface PrelaunchItem {
  id: Id;
  order: number;
  title: LocalizedText;
  hint: LocalizedText;
  status: PrelaunchStatus;
  /** Решение пользователя */
  decision: string;
  note: string;
  updatedAt?: ISODateTime;
}

export interface PaybackInputs {
  /** Расходы в месяц, драм */
  monthlyCosts: Money;
  individualPrice: Money;
  salonPerMaster: Money;
  avgMasters: number;
  /** Доля платящих со скидкой, % */
  discountShare: number;
  discountPercent: number;
  /** Цель «чистыми» в месяц (сверх расходов) */
  targetNet: Money;
  usdRate: number;
  eurRate: number;
}

/** F-00-206: «сейчас платят» — считаем от реальных бизнесов (не в бесплатном периоде, не ушли), не вводим руками. */
export interface PayingNow {
  salons: number;
  individuals: number;
}

export type NameCheck = 'unknown' | 'ok' | 'bad';
export type DomainStatus = 'unknown' | 'free' | 'taken' | 'bought';

export interface NameCandidate {
  id: Id;
  name: string;
  /** Как пишется на трёх языках */
  spelling: { ru: string; hy: string; en: string };
  checks: { ru: NameCheck; hy: NameCheck; en: NameCheck };
  domain: string;
  domainStatus: DomainStatus;
  note: string;
}

export interface BrandState {
  chosenId?: Id;
  decidedAt?: ISODateTime;
}

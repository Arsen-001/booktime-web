import type { Locale } from '@/i18n/config';

/**
 * Юридические страницы (04.10.2026): /privacy, /terms, /account-deletion — публичные адреса, которые требуют
 * App Store и Google Play (политика конфиденциальности, условия, «как удалить аккаунт»).
 *
 * Тексты длинные и меняются только вместе с юристом, поэтому лежат не в messages/*.json (их грузит каждая страница),
 * а здесь — по файлу на документ, все три языка рядом. В тексте можно писать {company}, {address}, {email} —
 * подставляются реквизиты из operator.ts.
 */
export interface LegalSection {
  /** Якорь в адресе (#rights) — одинаковый на всех языках */
  id: string;
  heading: string;
  /** Абзацы */
  p?: string[];
  /** Список после абзацев */
  list?: string[];
  /** Список — шаги по порядку (нумерованный) */
  ordered?: boolean;
  /** Абзацы после списка */
  after?: string[];
}

export interface LegalDoc {
  /** Заголовок страницы и <title> (без « | BookTime») */
  title: string;
  /** Описание для поисковиков (≤ 160 знаков) */
  description: string;
  /** «Действует с 4 октября 2026 г.» */
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

export type LegalDocs = Record<Locale, LegalDoc>;

export type LegalKind = 'privacy' | 'terms' | 'account-deletion';

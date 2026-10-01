'use client';

/** Короткое описание промокода словами: «0 / 10 / 15 / 25% · до 31 окт» или «30 дней бесплатно». */
import type { PromoView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';

export function usePromoText() {
  const t = useT('platform');
  const fmt = useFormat();
  return {
    terms: (p: PromoView) => (p.kind === 'freeMonth' ? t('promocodes.freeDaysText', { n: p.freeDays ?? 30 }) : t('promocodes.tiersText', { tiers: p.tiers.map((x) => x.percent).join(' / ') })),
    until: (p: PromoView) => (p.validUntil ? t('promocodes.untilText', { date: fmt.date(p.validUntil, 'dayMonth') }) : undefined),
    who: (p: PromoView) => p.issuedToBusinessName ?? p.issuedTo?.name ?? (p.personal ? t('promocodes.personalNoBusiness') : t('promocodes.forEveryone')),
    used: (p: PromoView) => (p.usedAt ? t('promocodes.usedText', { date: fmt.date(p.usedAt, 'dayMonth'), name: p.usedByBusinessName ?? '' }) : undefined),
  };
}

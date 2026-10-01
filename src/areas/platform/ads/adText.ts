'use client';

/** Объявление словами: «Главная, вверху · 20 сент – 5 окт», «Маникюр · Арабкир · любой размер». */
import { useLocale } from 'next-intl';
import type { LocaleCode } from '@/domain/core';
import type { AdView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';

export function useAdText() {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const locale = useLocale() as LocaleCode;
  const period = (a: Pick<AdView, 'startDate' | 'endDate'>) => `${fmt.date(a.startDate, 'dayMonth')} – ${fmt.date(a.endDate, 'dayMonth')}`;
  return {
    period,
    where: (a: AdView) => (a.placementName ? pickText(a.placementName, locale) : '—'),
    audience: (a: AdView) =>
      [
        a.target.sphereIds.length ? a.target.sphereIds.map((s) => tc(`spheres.${s}`)).join(', ') : t('ads.allSpheres'),
        a.target.districts.length ? a.target.districts.map((d) => tc(`districts.${d}`)).join(', ') : t('ads.allCity'),
        a.target.size !== 'any' ? t(`ads.size.${a.target.size}`) : undefined,
        a.target.minStars ? t('ads.minStarsText', { n: a.target.minStars }) : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
  };
}

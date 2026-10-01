'use client';

import type { PublicBusiness, PublicLocation } from '@/api/client';
import { useT } from '@/i18n/useT';

/**
 * Подпись места одной строкой без повторов (ux-r1 №3, text-q1 №2, demo-q2): у филиала сети район уже в названии
 * («Manana Beauty · Шенгавит»), у частного мастера название бизнеса = его имя — вместо него «Частный мастер · район».
 */
export function usePlaceLine() {
  const t = useT('client');
  const tc = useT('common');
  return (business: Pick<PublicBusiness, 'name' | 'kind' | 'networkId'>, location?: Pick<PublicLocation, 'district'>): string => {
    const district = location ? tc(`districts.${location.district}`) : undefined;
    if (business.kind === 'individual') return district ? `${t('master.individual')} · ${district}` : t('master.individual');
    if (business.networkId || !district || business.name.toLowerCase().includes(district.toLowerCase())) return business.name;
    return `${business.name} · ${district}`;
  };
}

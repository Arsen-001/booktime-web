'use client';

import type { PublicBusiness, PublicLocation } from '@/api/client';
import { useT } from '@/i18n/useT';
import { shownDistrict } from '@/lib/text';

/**
 * Подпись места одной строкой без повторов (ux-r1 №3, text-q1 №2, demo-q2): у филиала сети район уже в названии
 * («Manana Beauty · Шенгавит»), у частного мастера название бизнеса = его имя — вместо него «Частный мастер · район».
 */
export function usePlaceLine() {
  const t = useT('client');
  const tc = useT('common');
  return (business: Pick<PublicBusiness, 'name' | 'kind' | 'networkId'>, location?: Pick<PublicLocation, 'district' | 'address'>): string => {
    // Район — только у места с адресом (17.11.2026): без адреса «Кентрон» по умолчанию — неправда
    const shown = shownDistrict(location);
    const district = shown ? tc(`districts.${shown}`) : undefined;
    if (business.kind === 'individual') return district ? `${t('master.individual')} · ${district}` : t('master.individual');
    if (business.networkId || !district || business.name.toLowerCase().includes(district.toLowerCase())) return business.name;
    return `${business.name} · ${district}`;
  };
}

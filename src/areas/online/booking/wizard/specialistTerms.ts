'use client';

import { useLocale } from 'next-intl';
import type { SphereId } from '@/domain/core';
import { SPHERES } from '@/config/spheres';
import { useTerms } from '@/demo/hooks';
import { useT } from '@/i18n/useT';

/** Сферы, где приём ведут только для людей — «Питомец» в «Для кого запись» там не показываем (F-00-145) */
const HUMAN_ONLY_SPHERES = new Set<SphereId>(['nails', 'barber', 'hair', 'cosmetology', 'dental', 'massage']);

export function sphereIdsShowPet(sphereIds: SphereId[] | undefined): boolean {
  if (!sphereIds || sphereIds.length === 0) return true;
  return sphereIds.some((id) => !HUMAN_ONLY_SPHERES.has(id));
}

/** type, не interface: передаётся в t() как параметры, а у interface нет индексной сигнатуры */
export type SpecialistTerms = {
  master: string;
  masters: string;
  masterLower: string;
  masterGenitive: string;
};

/**
 * Слово «специалист» по сфере БИЗНЕСА, которого записывают (F-00-148, F-03-021 ⭐ наше решение: падежи не
 * заводим отдельным полем — слово и его формы идут из сферы). Пока карточка бизнеса не загрузилась — из
 * демо-персоны, чтобы не менять порядок хуков. Родительный падеж по-русски — «форма + а» (мастера, врача…).
 */
export function useSpecialistTerms(sphereIds?: SphereId[]): SpecialistTerms {
  const demo = useTerms();
  const tc = useT('common');
  const locale = useLocale();
  const set = sphereIds?.[0] ? SPHERES[sphereIds[0]].terms : undefined;
  const master = set ? tc(`terms.${set}.master`) : demo.master;
  const masters = set ? tc(`terms.${set}.masters`) : demo.masters;
  const masterLower = master.charAt(0).toLowerCase() + master.slice(1);
  const masterGenitive = locale === 'ru' ? `${masterLower}а` : masterLower;
  return { master, masters, masterLower, masterGenitive };
}

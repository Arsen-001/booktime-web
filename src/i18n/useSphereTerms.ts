'use client';

import { useTranslations } from 'next-intl';
import { SPHERES, type SphereConfig } from '@/config/spheres';
import type { BookingStatus, SphereId } from '@/domain/core';

type TermsSet = SphereConfig['terms'];

/** Слова сферы с падежами (F-00-148, F-03-021) */
export interface SphereTerms {
  /** «Клиент» / «Пациент» */
  client: string;
  clients: string;
  /** «Мастер» / «Врач» / «Тренер» — с большой буквы, для заголовков и подписей */
  master: string;
  masters: string;
  /** «мастер» — внутри фразы */
  masterLower: string;
  /** Родительный/винительный: «Выберите мастера», «без врача» (en — как masterLower) */
  masterGen: string;
  /** Дательный: «Записаться к мастеру», «к тренеру» */
  masterDat: string;
}

/**
 * Слова сферы КОНКРЕТНОГО бизнеса (публичная страница, виджет, уведомления): «Выберите врача» в стоматологии,
 * «Записаться к тренеру» в фитнесе. sphereId — обычно Business.sphereIds[0]. Для «своей» сферы кабинета есть
 * useTerms() из @/demo/hooks (без падежей).
 *   const terms = useSphereTerms(business?.sphereIds[0]);  t('pickStaff', { master: terms.masterGen })
 * В словаре раздела — ICU-параметр: "pickStaff": "Выберите {master}".
 */
export function useSphereTerms(sphereId: SphereId | undefined): SphereTerms {
  // Хук фундамента: ключ собирается по сфере, поэтому прямой useTranslations (разделам — useT)
  const t = useTranslations('common.terms');
  const set: TermsSet = sphereId ? SPHERES[sphereId].terms : 'default';
  return {
    client: t(`${set}.client`),
    clients: t(`${set}.clients`),
    master: t(`${set}.master`),
    masters: t(`${set}.masters`),
    masterLower: t(`${set}.masterLower`),
    masterGen: t(`${set}.masterGen`),
    masterDat: t(`${set}.masterDat`),
  };
}

/** Статусы, у которых в сфере свои слова («Отменил врач», «Пациент подтвердил») — common.bookingStatusTerms.<набор> */
const STATUS_TERM_OVERRIDES: Record<TermsSet, readonly BookingStatus[]> = {
  default: [],
  medical: ['client_confirmed', 'cancelled_by_client', 'cancelled_by_master'],
  fitness: ['cancelled_by_master'],
  carwash: ['cancelled_by_master'],
  barber: ['cancelled_by_master'],
};

/**
 * Полный ключ подписи статуса записи для кабинета с учётом сферы (e2e-q1 №7):
 * 'common.bookingStatusTerms.medical.cancelled_by_master' («Отменил врач») или 'common.bookingStatus.<status>'.
 * Переводить через useTDynamic(); подписи от лица клиента — ui.bookingStatusClient.* (без слова сферы).
 */
export function bookingStatusLabelKey(status: BookingStatus, sphereId: SphereId | undefined): string {
  const set: TermsSet = sphereId ? SPHERES[sphereId].terms : 'default';
  return STATUS_TERM_OVERRIDES[set].includes(status)
    ? `common.bookingStatusTerms.${set}.${status}`
    : `common.bookingStatus.${status}`;
}

'use client';

/**
 * Услуги и мастер для публичных страниц (карточка мастера, допродажа в окне записи): только то, что зовут эти
 * страницы. В режиме api — запрос к серверу; в демо — полный модуль раздела догружается отдельным куском (viaMock).
 * Те же функции реэкспортируют '@/api/services' и '@/api/services-upsell'.
 */
import { isApiMode } from '@/api/http';
import { getModerationStatus } from '@/api/platform/moderation.server';
import { viaMock } from '@/api/request';
import * as S from '@/api/services.server';
import * as U from '@/api/services-upsell.server';
import type { Id } from '@/domain/core';
import type { ReportContentInput, SterilizationInfo, UpsellOffers, UpsellOffersQuery } from '@/domain/services';

const services = () => import('@/api/services');
const upsell = () => import('@/api/services-upsell');

/**
 * Клиент жалуется на чужое фото/сторис/карточку мастера — попадает в общую очередь проверки платформы (F-00-091).
 * Сам механизм — reportContentNow в '@/api/services' (в обоих режимах через request()); догружается по нажатию.
 */
export function reportContent(input: ReportContentInput): Promise<void> {
  return viaMock(services, (m) => m.reportContentNow(input));
}

export function getSterilization(staffId: Id): Promise<SterilizationInfo | undefined> {
  if (isApiMode()) return S.getSterilization(staffId) as Promise<SterilizationInfo | undefined>;
  return viaMock(services, (m) => m.getSterilizationMock(staffId));
}

/** «Документы проверены» — хотя бы один диплом прошёл проверку (читают staff card, client, online) */
export function hasVerifiedDocuments(staffId: Id): Promise<boolean> {
  if (isApiMode()) {
    return (async () => {
      const docs = await S.listStaffDocuments(staffId);
      const statuses = await Promise.all(docs.map((d) => getModerationStatus(d.imageUrl)));
      return statuses.some((m) => m?.status === 'approved' || m?.status === 'auto');
    })();
  }
  return viaMock(services, (m) => m.hasVerifiedDocumentsMock(staffId));
}

/** Публично: сопутствующие к записи (виджет, ссылка, приложение, каталог) */
export function getUpsellOffers(q: UpsellOffersQuery): Promise<UpsellOffers> {
  if (isApiMode()) return U.getUpsellOffersServer(q);
  return viaMock(upsell, (m) => m.getUpsellOffersMock(q));
}

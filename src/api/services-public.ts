'use client';

/**
 * Услуги и мастер для публичных страниц (карточка мастера, допродажа в окне записи): только то, что зовут эти
 * страницы. В режиме api — запрос к серверу; в демо — полный модуль раздела догружается отдельным куском (viaMock).
 * Те же функции реэкспортируют '@/api/services' и '@/api/services-upsell'.
 */
import { http, isApiMode } from '@/api/http';
import { viaMock } from '@/api/request';
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
  // Режим api: публичная ручка — кабинетная /v1/biz/…/moderation/submit клиенту и гостю закрыта (16.11.2026: жалоба падала)
  if (isApiMode() && input.kind === 'staff' && input.staffId) {
    return http<void>('POST', `/v1/public/masters/${encodeURIComponent(input.staffId)}/report`, { reason: input.reason }).then(() => undefined);
  }
  return viaMock(services, (m) => m.reportContentNow(input));
}

/** Доверие на карточке мастера одним публичным запросом (документы проверены + стерилизация) */
interface MasterTrust {
  docsVerified: boolean;
  sterilization: SterilizationInfo | null;
}
const trustOf = (staffId: Id) => http<MasterTrust>('GET', `/v1/public/masters/${encodeURIComponent(staffId)}/trust`);

export function getSterilization(staffId: Id): Promise<SterilizationInfo | undefined> {
  if (isApiMode()) return trustOf(staffId).then((r) => r.sterilization ?? undefined);
  return viaMock(services, (m) => m.getSterilizationMock(staffId));
}

/** «Документы проверены» — хотя бы один диплом прошёл проверку (читают staff card, client, online) */
export function hasVerifiedDocuments(staffId: Id): Promise<boolean> {
  if (isApiMode()) return trustOf(staffId).then((r) => r.docsVerified);
  return viaMock(services, (m) => m.hasVerifiedDocumentsMock(staffId));
}

/** Публично: сопутствующие к записи (виджет, ссылка, приложение, каталог) */
export function getUpsellOffers(q: UpsellOffersQuery): Promise<UpsellOffers> {
  if (isApiMode()) return U.getUpsellOffersServer(q);
  return viaMock(upsell, (m) => m.getUpsellOffersMock(q));
}

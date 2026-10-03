'use client';

/**
 * Раздел «online» на настоящем сервере (docs/backend/PLAN.md этап 8, docs/backend/02 §3). Функции
 * src/api/online.ts в режиме `api` зовут эти; экран получает те же типы, что от мока.
 *
 * Публичная страница/виджет/создание записи/«моя запись» по хэшу — без сессии (анонимный посетитель), поэтому
 * никакого `apiIdentity()`/мирора здесь не нужно. Ссылки и правила (кабинет бизнеса) читают текущий бизнес из
 * `apiIdentity()` — эти экраны никогда не редактируют чужой бизнес, поэтому лишний lookup-по-мирору не нужен
 * (тот же приём упрощения, что у `staff.server.ts`/`services.server.ts` для businessId-фолбэка).
 */
import { http } from '@/api/http';
import type { TelegramLinkInfo } from '@/domain/client';
import { apiIdentity } from '@/api/identity';
import { ApiError } from '@/api/request';
import type { FreeSlot } from '@/api/schedule';
import type { Id, ISODate } from '@/domain/core';
import type { BookingLink, BusinessOnlineRules, OnlineBookingMeta, StaffOnlineRules } from '@/domain/online';
import type {
  CancelWindowInfo,
  CreateLinkInput,
  CreateOnlineBookingInput,
  MonthAvailabilityOptions,
  NearestAvailableOptions,
  OnlineBookingResult,
  OnlineBookingView,
  PublicBusinessData,
  UpdateLinkPatch,
  WidgetSlotQuery,
} from '@/api/online';

function biz(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

// ─────────────────────────── публичная страница, окна, код, запись (без сессии) ───────────────────────────

export function getPublicBusinessDataServer(slug: string, formId?: string): Promise<PublicBusinessData> {
  return http('GET', `/v1/public/b/${slug}${formId ? `/f/${formId}` : ''}`);
}

export function getWidgetFreeSlotsServer(slug: string, q: WidgetSlotQuery): Promise<FreeSlot[]> {
  return http('GET', `/v1/public/b/${slug}/slots`, undefined, {
    query: { staffId: q.staffId, date: q.date, durationMin: q.durationMin, durationMax: q.durationMax, serviceId: q.serviceId, locationId: q.locationId, workplace: q.workplace },
  });
}

export function getNearestAvailableDateServer(slug: string, staffId: Id, durationMin: number, from: ISODate, opts: NearestAvailableOptions): Promise<ISODate | undefined> {
  return http<{ date?: string }>('GET', `/v1/public/b/${slug}/nearest-date`, undefined, {
    query: { staffId, from, durationMin, durationMax: opts.durationMax, serviceId: opts.serviceId, locationId: opts.locationId, workplace: opts.workplace },
  }).then((r) => r.date);
}

export function getMonthAvailabilityServer(slug: string, staffId: Id, durationMin: number, monthStart: ISODate, opts: MonthAvailabilityOptions): Promise<Record<ISODate, boolean>> {
  return http('GET', `/v1/public/b/${slug}/month`, undefined, {
    query: { staffId, month: monthStart.slice(0, 7), durationMin, durationMax: opts.durationMax, serviceId: opts.serviceId, locationId: opts.locationId, workplace: opts.workplace },
  });
}

export interface SendOnlineCodeInput {
  slug: string;
  phone: string;
  channel?: 'telegram' | 'whatsapp' | 'sms';
}

export type OnlineCodeChannel = NonNullable<SendOnlineCodeInput['channel']>;

/** Код ушёл: куда на самом деле (сервер мог отправить в запасной канал) и какие каналы ещё можно предложить */
export interface OnlineCodeSent {
  demoCode?: string;
  channel: OnlineCodeChannel;
  channels: OnlineCodeChannel[];
}

/** F-00-007, B2: код перед записью без входа — доставляет сервер в выбранный канал, не показывает его */
export function sendOnlineBookingCodeServer(input: SendOnlineCodeInput): Promise<OnlineCodeSent> {
  return http<OnlineCodeSent>('POST', `/v1/public/b/${input.slug}/code`, { phone: input.phone, channel: input.channel ?? 'telegram' }).then((r) => ({
    channel: r.channel,
    channels: r.channels,
  }));
}

/** ⭐ О28: запись в окно, которое предложили вместо записи (мастер «Другое время» / не ответил), одним вызовом по хэшу */
export function bookAlternativeTimeServer(bookingId: Id, hash: string, start: string): Promise<OnlineBookingResult> {
  return http('POST', `/v1/public/bookings/${encodeURIComponent(bookingId)}/alternative`, { start }, { query: { h: hash } });
}

export function createOnlineBookingServer(slug: string, input: CreateOnlineBookingInput & { code: string }): Promise<OnlineBookingResult> {
  return http('POST', `/v1/public/b/${slug}/bookings`, {
    businessId: input.businessId,
    locationId: input.locationId,
    staffId: input.staffId,
    start: input.start,
    services: input.services,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    code: input.code,
    comment: input.comment,
    forWhom: input.forWhom,
    linkId: input.linkId,
    formId: input.formId,
    source: input.source,
    device: input.device,
    workplace: input.workplace,
    visitAddress: input.visitAddress,
    reminderMinutesBefore: input.reminderMinutesBefore,
    anySpecialist: input.anySpecialist,
    email: input.email,
    lastName: input.lastName,
    patronymic: input.patronymic,
    customFieldValues: input.customFieldValues,
    payInFull: input.payInFull,
    referralCode: input.referralCode,
    addOns: input.addOns && (input.addOns.serviceIds.length || input.addOns.productIds.length) ? input.addOns : undefined,
  });
}

export function getOnlineBookingServer(bookingId: Id, hash: string): Promise<OnlineBookingView> {
  return http('GET', `/v1/public/bookings/${bookingId}`, undefined, { query: { h: hash } });
}

export function getCancelWindowServer(bookingId: Id, hash: string): Promise<CancelWindowInfo> {
  return http('GET', `/v1/public/bookings/${bookingId}/cancel-window`, undefined, { query: { h: hash } });
}

export function cancelOnlineBookingServer(bookingId: Id, hash: string) {
  return http('POST', `/v1/public/bookings/${bookingId}/cancel`, undefined, { query: { h: hash } });
}

// ─────────────────────────── ссылки (кабинет бизнеса, F-03-003…037) ───────────────────────────

export function listLinksServer(): Promise<BookingLink[]> {
  return http('GET', `/v1/biz/${biz()}/links`);
}

export function getLinkServer(id: Id): Promise<BookingLink> {
  return http('GET', `/v1/biz/${biz()}/links/${id}`);
}

export async function getLinkByFormIdServer(formId: string): Promise<BookingLink> {
  const links = await listLinksServer();
  const found = links.find((l) => l.formId === formId);
  if (!found) throw new ApiError('not_found', `Форма ${formId} не найдена`);
  return found;
}

export function createLinkServer(input: CreateLinkInput): Promise<BookingLink> {
  return http('POST', `/v1/biz/${input.businessId}/links`, input);
}

export function updateLinkServer(id: Id, patch: UpdateLinkPatch): Promise<BookingLink> {
  return http('PATCH', `/v1/biz/${biz()}/links/${id}`, patch);
}

export function deleteLinkServer(id: Id): Promise<void> {
  return http('DELETE', `/v1/biz/${biz()}/links/${id}`).then(() => undefined);
}

export function setPrimaryLinkServer(id: Id): Promise<BookingLink> {
  return http('POST', `/v1/biz/${biz()}/links/${id}/primary`);
}

// ─────────────────────────── правила мастера/бизнеса (F-00-066, F-03-079) ───────────────────────────

export function getStaffRulesServer(staffId: Id): Promise<StaffOnlineRules> {
  return http('GET', `/v1/biz/${biz()}/staff/${staffId}/client-rules`);
}

export function updateStaffRulesServer(staffId: Id, patch: Partial<Omit<StaffOnlineRules, 'staffId'>>): Promise<StaffOnlineRules> {
  return http('PUT', `/v1/biz/${biz()}/staff/${staffId}/client-rules`, patch);
}

export function getBusinessRulesServer(): Promise<BusinessOnlineRules> {
  return http('GET', `/v1/biz/${biz()}/online/rules`);
}

export function updateBusinessRulesServer(patch: Partial<Omit<BusinessOnlineRules, 'businessId'>>): Promise<BusinessOnlineRules> {
  return http('PUT', `/v1/biz/${biz()}/online/rules`, patch);
}

// ─────────────────────────── источник записи в кабинете (F-03-123) ───────────────────────────

export function getBookingMetaServer(bookingId: Id): Promise<OnlineBookingMeta | undefined> {
  return http('GET', `/v1/biz/${biz()}/bookings/${bookingId}/online-meta`);
}

// ═══════════════════════ стадия 21 (лейн client+online): кабинет заявок и настроек ═══════════════════════

export function isSubdomainAvailableServer(subdomain: string, excludeLinkId?: Id): Promise<boolean> {
  return http<{ available: boolean }>('GET', `/v1/biz/${biz()}/online/subdomain-available`, undefined, { query: { subdomain, excludeLinkId } }).then((r) => r.available);
}

export function getPlacesDataServer(staffId: Id, locationId: Id | undefined): Promise<import('@/api/online').PlacesData> {
  return http('GET', `/v1/biz/${biz()}/online/staff/${staffId}/places`, undefined, { query: { locationId } });
}

export function getBusinessListabilityServer(): Promise<{ staff: import('@/domain/core').Staff; check: import('@/api/online').ListableCheck }[]> {
  return http('GET', `/v1/biz/${biz()}/online/listability`);
}

export function getClientFieldsConfigServer(): Promise<import('@/domain/online').ClientFieldsConfig> {
  return http('GET', `/v1/biz/${biz()}/online/client-fields`);
}

export function updateClientFieldsConfigServer(patch: Partial<Omit<import('@/domain/online').ClientFieldsConfig, 'businessId'>>): Promise<import('@/domain/online').ClientFieldsConfig> {
  return http('PATCH', `/v1/biz/${biz()}/online/client-fields`, patch);
}

export function addCustomClientFieldServer(field: Omit<import('@/domain/online').CustomClientField, 'id' | 'order'>): Promise<import('@/domain/online').ClientFieldsConfig> {
  return http('POST', `/v1/biz/${biz()}/online/client-fields/fields`, field);
}

export function removeCustomClientFieldServer(fieldId: Id): Promise<import('@/domain/online').ClientFieldsConfig> {
  return http('DELETE', `/v1/biz/${biz()}/online/client-fields/fields/${fieldId}`);
}

export function moveCustomClientFieldServer(fieldId: Id, direction: -1 | 1): Promise<import('@/domain/online').ClientFieldsConfig> {
  return http('POST', `/v1/biz/${biz()}/online/client-fields/fields/${fieldId}/move`, { direction });
}

export function getClientCustomFieldAnswersServer(clientId: Id): Promise<{ label: string; value: string }[]> {
  return http('GET', `/v1/biz/${biz()}/online/clients/${clientId}/field-answers`);
}

export function listOnlineRequestsServer(staffId?: Id): Promise<import('@/domain/online').OnlineRequestView[]> {
  return http('GET', `/v1/biz/${biz()}/online/requests`, undefined, { query: { staffId } });
}

export function countPendingRequestsServer(staffId?: Id): Promise<number> {
  return http<{ count: number }>('GET', `/v1/biz/${biz()}/online/requests/count`, undefined, { query: { staffId } }).then((r) => r.count);
}

export function getBookingStatusLogServer(bookingId: Id): Promise<{ status: string; at: string; by: 'client' | 'staff' }[]> {
  return http('GET', `/v1/biz/${biz()}/online/requests/${bookingId}/status-log`);
}

export function respondToRequestServer(bookingId: Id, action: 'confirm' | 'decline'): Promise<import('@/domain/core').Booking> {
  return http('POST', `/v1/biz/${biz()}/online/requests/${bookingId}/respond`, { action });
}

export function suggestOtherTimesServer(bookingId: Id, limit?: number): Promise<import('@/domain/core').ISODateTime[]> {
  return http('GET', `/v1/biz/${biz()}/online/requests/${bookingId}/suggest-times`, undefined, { query: { limit } });
}

export function offerOtherTimesServer(bookingId: Id, starts: import('@/domain/core').ISODateTime[]): Promise<import('@/domain/core').ISODateTime[]> {
  return http('POST', `/v1/biz/${biz()}/online/requests/${bookingId}/offer-times`, { starts });
}

// ═══════════════ стадия 21 (лейн client+online), попытка 2 ═══════════════

export function getServiceOnlineConfigServer(serviceId: Id): Promise<import('@/domain/online').ServiceOnlineConfig | undefined> {
  return http('GET', `/v1/biz/${biz()}/online/services/${serviceId}/config`);
}

export function updateServiceOnlineConfigServer(serviceId: Id, patch: Partial<Omit<import('@/domain/online').ServiceOnlineConfig, 'serviceId'>>): Promise<import('@/domain/online').ServiceOnlineConfig> {
  return http('PATCH', `/v1/biz/${biz()}/online/services/${serviceId}/config`, patch);
}

export function getStaffServiceOnlineFlagsServer(): Promise<import('@/domain/online').StaffServiceOnlineFlags> {
  return http('GET', `/v1/biz/${biz()}/online/staff-service-flags`);
}

export function setStaffServiceOnlineServer(staffId: Id, serviceId: Id, online: boolean): Promise<import('@/domain/online').StaffServiceOnlineFlags> {
  return http('PUT', `/v1/biz/${biz()}/online/staff-service-flags`, { staffId, serviceId, online });
}

export function listOnlinePackagesServer(): Promise<import('@/domain/online').OnlinePackage[]> {
  return http('GET', `/v1/biz/${biz()}/online/packages`);
}

export function createOnlinePackageServer(input: { name: string; serviceIds: Id[]; mode: import('@/domain/online').PackageMode }): Promise<import('@/domain/online').OnlinePackage> {
  return http('POST', `/v1/biz/${biz()}/online/packages`, input);
}

export function updateOnlinePackageServer(packageId: Id, patch: Partial<Omit<import('@/domain/online').OnlinePackage, 'id' | 'businessId' | 'createdAt'>>): Promise<import('@/domain/online').OnlinePackage> {
  return http('PATCH', `/v1/biz/${biz()}/online/packages/${packageId}`, patch);
}

export function deleteOnlinePackageServer(packageId: Id): Promise<void> {
  return http('DELETE', `/v1/biz/${biz()}/online/packages/${packageId}`).then(() => undefined);
}

export function listPromoBlocksServer(): Promise<import('@/domain/online').PromoBlock[]> {
  return http('GET', `/v1/biz/${biz()}/online/promo-blocks`);
}

export function createPromoBlockServer(input: Omit<import('@/domain/online').PromoBlock, 'id' | 'createdAt' | 'status' | 'enabled' | 'reasonNote'>): Promise<import('@/domain/online').PromoBlock> {
  return http('POST', `/v1/biz/${biz()}/online/promo-blocks`, input);
}

export function updatePromoBlockServer(id: Id, patch: Partial<Omit<import('@/domain/online').PromoBlock, 'id' | 'businessId' | 'createdAt'>>): Promise<import('@/domain/online').PromoBlock> {
  return http('PATCH', `/v1/biz/${biz()}/online/promo-blocks/${id}`, patch);
}

export function deletePromoBlockServer(id: Id): Promise<void> {
  return http('DELETE', `/v1/biz/${biz()}/online/promo-blocks/${id}`).then(() => undefined);
}

export function getStarCountServer(businessId: Id, target: import('@/domain/online').ReviewTarget, targetId: Id): Promise<number> {
  return http<{ count: number }>('GET', `/v1/biz/${businessId}/online/reviews/${target}/${targetId}/count`).then((r) => r.count);
}

/** Звёздочка по ссылке без входа — как отмена и «Я оплатил», только с хэшем ссылки (?h=) */
export function addReviewServer(input: {
  businessId: Id;
  target: import('@/domain/online').ReviewTarget;
  targetId: Id;
  bookingId: Id;
  clientId: Id;
  hash: string;
}): Promise<import('@/domain/online').Review> {
  return http(
    'POST',
    `/v1/public/bookings/${input.bookingId}/reviews`,
    { target: input.target, targetId: input.targetId, clientId: input.clientId },
    { query: { h: input.hash } },
  );
}

export function hasReviewedServer(bookingId: Id, target: import('@/domain/online').ReviewTarget, hash: string): Promise<boolean> {
  return http<{ reviewed: boolean }>('GET', `/v1/public/bookings/${bookingId}/reviews/${target}`, undefined, { query: { h: hash } }).then((r) => r.reviewed);
}

export function trackWidgetEventServer(linkId: Id | undefined, businessId: Id, type: import('@/domain/online').WidgetEventType): Promise<void> {
  return http('POST', `/v1/public/track`, { linkId, businessId, type }).then(() => undefined);
}

export function listWidgetEventsServer(linkId: Id): Promise<import('@/domain/online').WidgetEvent[]> {
  return http('GET', `/v1/biz/${biz()}/online/links/${linkId}/widget-events`);
}

/** Читаем всегда через публичный маршрут (числа не секретные) — так работает и из кабинета, и из виджета без входа */
export function getGroupBookingRulesServer(linkId: Id): Promise<import('@/domain/online').GroupBookingRules> {
  return http('GET', `/v1/public/links/${linkId}/group-rules`);
}

export function updateGroupBookingRulesServer(linkId: Id, patch: Partial<Omit<import('@/domain/online').GroupBookingRules, 'linkId'>>): Promise<import('@/domain/online').GroupBookingRules> {
  return http('PUT', `/v1/biz/${biz()}/online/links/${linkId}/group-rules`, patch);
}

export function getMobileAppLinksServer(): Promise<import('@/domain/online').MobileAppLinks> {
  return http('GET', `/v1/biz/${biz()}/online/mobile-app`);
}

export function updateMobileAppLinksServer(patch: Partial<Omit<import('@/domain/online').MobileAppLinks, 'businessId'>>): Promise<import('@/domain/online').MobileAppLinks> {
  return http('PUT', `/v1/biz/${biz()}/online/mobile-app`, patch);
}

export function listIntegrationsServer(): Promise<import('@/domain/online').IntegrationConnection[]> {
  return http('GET', `/v1/biz/${biz()}/online/integrations`);
}

export function setIntegrationConnectedServer(id: import('@/domain/online').IntegrationId, connected: boolean): Promise<import('@/domain/online').IntegrationConnection> {
  return http('PUT', `/v1/biz/${biz()}/online/integrations/${id}`, { connected });
}

export function getApiCredentialsServer(): Promise<import('@/domain/online').ApiCredentials> {
  return http('GET', `/v1/biz/${biz()}/online/api-credentials`);
}

export function generateApiKeyServer(): Promise<import('@/domain/online').ApiCredentials> {
  return http('POST', `/v1/biz/${biz()}/online/api-credentials/generate`, {});
}

export function revokeApiKeyServer(): Promise<void> {
  return http('POST', `/v1/biz/${biz()}/online/api-credentials/revoke`, {}).then(() => undefined);
}

export function joinOnlineWaitlistServer(input: import('@/api/online').JoinWaitlistInput): Promise<import('@/domain/online').WaitlistRequest> {
  const { businessId, ...rest } = input;
  return http('POST', `/v1/public/businesses/${businessId}/waitlist`, rest);
}

export function markPrepaymentPaidServer(bookingId: Id, hash: string): Promise<import('@/domain/core').Booking> {
  return http('POST', `/v1/public/bookings/${bookingId}/prepayment-paid`, undefined, { query: { h: hash } });
}

export function listPublicGroupEventsServer(businessId: Id, serviceId?: Id): Promise<import('@/api/online').PublicGroupEvent[]> {
  return http('GET', `/v1/public/businesses/${businessId}/group-events`, undefined, { query: { serviceId } });
}

export function createGroupOnlineBookingServer(input: import('@/api/online').CreateGroupOnlineBookingInput): Promise<import('@/api/online').OnlineBookingResult> {
  const { businessId, ...rest } = input;
  return http('POST', `/v1/public/businesses/${businessId}/group-bookings`, rest);
}

export function getCabinetDataServer(businessId: Id, phone: string): Promise<import('@/api/online').CabinetData> {
  return http('GET', `/v1/public/businesses/${businessId}/cabinet`, undefined, { query: { phone } });
}

export function getSlotCandidatesServer(businessId: Id, staffId: Id, days?: number): Promise<import('@/api/online').SlotCandidate[]> {
  return http('GET', `/v1/biz/${biz()}/online/slot-candidates/${staffId}`, undefined, { query: { days } });
}

export function firstStaffWithCandidatesServer(businessId: Id, staffIds: Id[]): Promise<Id | undefined> {
  return http<{ staffId?: Id }>('GET', `/v1/biz/${biz()}/online/slot-candidates/first`, undefined, { query: { staffIds: staffIds.join(',') } }).then((r) => r.staffId);
}

export function inviteToSlotServer(businessId: Id, candidate: import('@/api/online').SlotCandidate, message: string): Promise<import('@/domain/online').SlotInvite> {
  return http('POST', `/v1/biz/${biz()}/online/slot-invites`, { candidate, message });
}

export function listSlotInvitesServer(_businessId: Id): Promise<import('@/domain/online').SlotInvite[]> {
  return http('GET', `/v1/biz/${biz()}/online/slot-invites`);
}

export function bookingTelegramLinkServer(bookingId: Id, hash: string): Promise<TelegramLinkInfo> {
  return http('POST', `/v1/public/bookings/${bookingId}/telegram-link`, undefined, { query: { h: hash } });
}

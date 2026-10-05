'use client';

/**
 * Раздел «client» на настоящем сервере (docs/backend/PLAN.md этап 9, docs/backend/02 §2). Функции src/api/client.ts
 * в режиме `api` зовут эти; экран получает те же типы, что от мока. Каталог/карточки/окна — без сессии; «мои
 * записи»/лист ожидания/избранное/звёздочка/дневник/лента/поддержка — сессия сервера уже несёт appUserId
 * (`ctx.session.userId`), поэтому явный параметр `appUserId` мока здесь не передаётся, а только определяет,
 * что вызывающий экран уже вошёл (иначе `/v1/me/*` ответит 401 раньше, чем эта функция вообще позвала бы http()).
 */
import { apiIdentity } from '@/api/identity';
import { http } from '@/api/http';
import type { TelegramLinkInfo } from '@/domain/client';
import { ApiError } from '@/api/request';
import type { FreeSlot } from '@/api/schedule';
import type {
  AddDiaryEntryInput,
  BookAppointmentInput,
  BookAppointmentResult,
  BookingDetail,
  BookingSlotDay,
  CallbackInput,
  CatalogEntry,
  CatalogQuery,
  ClientBookingsResult,
  DailyReportMetrics,
  DemandLeadInput,
  DiaryRow,
  EnrichedBooking,
  FavoriteEntry,
  MasterCard,
  MyWaitlistEntry,
  NotificationEntry,
  PlaceCard,
  ShadeStepInfo,
  WaitlistInput,
} from '@/api/client';
import type { Booking, Id, ISODate, ISODateTime, Money, Staff, Workplace } from '@/domain/core';
import type { DiaryEntry, FavoriteTargetType, LocationReview, StaffReview, StarRating, WaitlistEntry } from '@/domain/client';

// ─────────────────────────── каталог, карточки, окна (без сессии) ───────────────────────────

export function listCatalogServer(q: CatalogQuery): Promise<CatalogEntry[]> {
  return http('GET', '/v1/public/catalog', undefined, {
    query: {
      search: q.search,
      sphere: q.sphereId,
      district: q.district,
      workplace: q.workplace,
      accepts: q.accepts,
      material: q.material,
      freeToday: q.freeToday,
      freeTomorrow: q.freeTomorrow,
      lat: q.near?.lat,
      lng: q.near?.lng,
      businessId: q.businessId,
      limit: q.limit,
    },
  });
}

export function getMasterCardServer(staffId: Id, serviceId?: Id): Promise<MasterCard> {
  return http('GET', `/v1/public/masters/${staffId}`, undefined, serviceId ? { query: { service: serviceId } } : undefined);
}

export function getPlaceCardServer(businessId: Id): Promise<PlaceCard> {
  return http('GET', `/v1/public/places/${businessId}`);
}

export function getBookingDaysServer(staffId: Id, serviceId: Id, workplace: Workplace | undefined, days: number): Promise<BookingSlotDay[]> {
  return http('GET', `/v1/public/masters/${staffId}/days`, undefined, { query: { serviceId, workplace, days } });
}

export function getSlotsServer(staffId: Id, date: string, serviceId?: Id, workplace?: Workplace): Promise<FreeSlot[]> {
  return http('GET', `/v1/public/masters/${staffId}/slots`, undefined, { query: { date, serviceId, workplace } });
}

export function getShadeOptionsServer(serviceId: Id): Promise<ShadeStepInfo> {
  return http('GET', `/v1/public/services/${serviceId}/shades`);
}

export function getCancelWindowHoursServer(staffId: Id): Promise<number> {
  return http<{ cancelWindowHours: number }>('GET', `/v1/public/masters/${staffId}/cancel-window`).then((r) => r.cancelWindowHours);
}

export function submitDemandLeadServer(input: DemandLeadInput): Promise<void> {
  return http('POST', '/v1/public/demand', { query: input.query, sphereId: input.sphereId, district: input.district, phone: input.phone }).then(() => undefined);
}

export function requestCallbackServer(input: CallbackInput): Promise<void> {
  return http('POST', '/v1/public/callback', input).then(() => undefined);
}

// ─────────────────────────── мои записи (F-00-031, F-14-011) ───────────────────────────

/**
 * `shade`/`storyId`/`membershipId` мока не отправляются — оттенок ждёт склад (этап 13), сторис — свою постройку
 * (этап 19), абонемент — лояльность (этап 11); сервер честно не знает их, см. docs/backend решения этапа 9.
 */
export function bookAppointmentServer(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  return http<{ booking: Booking }>('POST', '/v1/me/bookings', {
    staffId: input.staffId,
    serviceId: input.serviceId,
    start: input.start,
    locationId: input.locationId,
    workplace: input.workplace,
    visitAddress: input.visitAddress,
    forWhom: input.forWhom,
    visitorName: input.visitorName,
    seats: input.seats,
    groupEventId: input.groupEventId,
    comment: input.comment,
    payInFull: input.payInFull,
    referralCode: input.referralCode,
    addOns: input.addOns && (input.addOns.serviceIds.length || input.addOns.productIds.length) ? input.addOns : undefined,
  }).then((r) => ({ booking: r.booking }));
}

export function listMyBookingsServer(): Promise<ClientBookingsResult> {
  return http('GET', '/v1/me/bookings');
}

export async function listMyBookingsInBusinessServer(businessId: Id): Promise<EnrichedBooking[]> {
  const r = await http<ClientBookingsResult>('GET', '/v1/me/bookings', undefined, { query: { businessId } });
  return [...r.upcoming, ...r.past, ...r.cancelled];
}

export function getBookingServer(bookingId: Id): Promise<BookingDetail> {
  return http('GET', `/v1/me/bookings/${bookingId}`);
}

export function confirmBookingByClientServer(bookingId: Id): Promise<Booking> {
  return http('POST', `/v1/me/bookings/${bookingId}/confirm`);
}

export function markPrepaymentPaidServer(bookingId: Id): Promise<Booking> {
  return http('POST', `/v1/me/bookings/${bookingId}/paid`);
}

export async function cancelBookingByClientServer(bookingId: Id): Promise<Booking> {
  const r = await http<{ booking: Booking; late: boolean }>('POST', `/v1/me/bookings/${bookingId}/cancel`);
  return r.booking;
}

export function rescheduleBookingByClientServer(bookingId: Id, newStart: ISODateTime): Promise<Booking> {
  return http('POST', `/v1/me/bookings/${bookingId}/reschedule`, { start: newStart });
}

// ─────────────────────────── лист ожидания «от себя» (F-00-101/102) ───────────────────────────

export function addToWaitlistServer(input: WaitlistInput): Promise<WaitlistEntry> {
  return http('POST', '/v1/me/waitlist', { staffId: input.staffId, serviceId: input.serviceId, date: input.date });
}

export function listMyWaitlistServer(): Promise<MyWaitlistEntry[]> {
  return http('GET', '/v1/me/waitlist');
}

export function removeFromWaitlistServer(id: Id): Promise<void> {
  return http('DELETE', `/v1/me/waitlist/${id}`).then(() => undefined);
}

// ─────────────────────────── «Мои мастера» (F-00-118) ───────────────────────────

export function listBookedMastersServer(limit: number): Promise<Staff[]> {
  return http('GET', '/v1/me/masters', undefined, { query: { limit } });
}

// ─────────────────────────── ❤ избранное (F-00-113/115) ───────────────────────────

export function isFavoritedServer(targetType: FavoriteTargetType, targetId: Id): Promise<boolean> {
  return http<{ favorited: boolean }>('GET', '/v1/me/favorites/check', undefined, { query: { targetType, targetId } }).then((r) => r.favorited);
}

export function toggleFavoriteServer(targetType: FavoriteTargetType, targetId: Id): Promise<boolean> {
  return http<{ subscribed: boolean }>('POST', '/v1/me/favorites', { targetType, targetId }).then((r) => r.subscribed);
}

export function setFavoriteNewsMutedServer(id: Id, muted: boolean): Promise<void> {
  return http('POST', `/v1/me/favorites/${id}/mute`, { muted }).then(() => undefined);
}

export function listFavoritesServer(): Promise<FavoriteEntry[]> {
  return http('GET', '/v1/me/favorites');
}

// ─────────────────────────── ★ звёздочка (F-00-116) ───────────────────────────

export function getMyStarServer(staffId: Id): Promise<StarRating | undefined> {
  return http<StarRating | null>('GET', `/v1/me/ratings/${staffId}`).then((r) => r ?? undefined);
}

/** F-14-013: можно оценить только свой визит со статусом «пришёл» — тот же вход, что примет `PUT ratings/{staffId}` */
export function canRateBookingServer(bookingId: Id): Promise<boolean> {
  return http<{ booking: { status: string } }>('GET', `/v1/me/bookings/${bookingId}`)
    .then((r) => r.booking.status === 'arrived')
    .catch(() => false);
}

export function rateStaffServer(staffId: Id, bookingId: Id): Promise<void> {
  return http('PUT', `/v1/me/ratings/${staffId}`, { bookingId }).then(() => undefined);
}

export function unrateStaffServer(staffId: Id): Promise<void> {
  return http('DELETE', `/v1/me/ratings/${staffId}`).then(() => undefined);
}

// ─────────────────────────── оценка 1–5 + текст (В-24, F-14-013) — этап 21, лейн client ───────────────────────────

export function getMyStaffReviewServer(staffId: Id): Promise<StaffReview | undefined> {
  return http<StaffReview | null>('GET', `/v1/me/reviews/staff/${staffId}`).then((r) => r ?? undefined);
}

export function submitStaffReviewServer(staffId: Id, businessId: Id, bookingId: Id, rating: 1 | 2 | 3 | 4 | 5, text?: string): Promise<StaffReview> {
  return http('PUT', `/v1/me/reviews/staff/${staffId}`, { businessId, bookingId, rating, text });
}

// ─────────────────────────── отзыв о месте (F-14-014) ───────────────────────────

export function getMyLocationReviewServer(bookingId: Id): Promise<LocationReview | undefined> {
  return http<LocationReview | null>('GET', `/v1/me/reviews/location/${bookingId}`).then((r) => r ?? undefined);
}

export function listLocationReviewsServer(businessId: Id): Promise<LocationReview[]> {
  return http('GET', `/v1/public/places/${businessId}/reviews`);
}

export function submitLocationReviewServer(businessId: Id, bookingId: Id, text: string): Promise<LocationReview> {
  return http('PUT', `/v1/me/reviews/location/${bookingId}`, { businessId, text });
}

// ─────────────────────────── дневник (F-00-122) ───────────────────────────

export function listDiaryEntriesServer(): Promise<DiaryRow[]> {
  return http('GET', '/v1/me/diary');
}

export function addDiaryEntryServer(input: AddDiaryEntryInput): Promise<DiaryEntry> {
  return http('POST', '/v1/me/diary', { serviceName: input.serviceName, masterName: input.masterName, date: input.date, amount: input.amount });
}

export function removeDiaryEntryServer(id: Id): Promise<void> {
  return http('DELETE', `/v1/me/diary/${id}`).then(() => undefined);
}

// ─────────────────────────── лента (F-14-055) ───────────────────────────

export function listNotificationsServer(): Promise<NotificationEntry[]> {
  return http('GET', '/v1/me/inbox');
}

export function markNotificationReadServer(id: Id): Promise<void> {
  return http('POST', `/v1/me/inbox/${id}/read`).then(() => undefined);
}

export function markAllNotificationsReadServer(): Promise<void> {
  return http('POST', '/v1/me/inbox/read-all').then(() => undefined);
}

// ─────────────────────────── обращение к нам (F-00-182) ───────────────────────────

export function submitSupportServer(subject: string, message: string, phone?: string): Promise<void> {
  return http('POST', '/v1/me/support', { subject, message, phone }).then(() => undefined);
}

// ─────────────────────────── отчёты вкладки «Приложение» (этап 21, лейн client, попытка 5, F-14-123…129) ───────────────────────────

export function getDailyReportServer(businessId: Id, date: ISODate): Promise<{ today: DailyReportMetrics; yesterday: DailyReportMetrics }> {
  return http('GET', `/v1/biz/${businessId}/apps/reports/daily`, undefined, { query: { date } });
}

export function getPeriodReportServer(businessId: Id, from: ISODate, to: ISODate): Promise<DailyReportMetrics & { days: number }> {
  return http('GET', `/v1/biz/${businessId}/apps/reports/period`, undefined, { query: { from, to } });
}

export function getMyAnalyticsServer(businessId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<{ revenue: number; bookingsCount: number }> {
  return http('GET', `/v1/biz/${businessId}/apps/reports/my-analytics`, undefined, { query: { staffId, from, to } });
}

/** businessId — из сессии (F-14-129 всегда «сеть текущего бизнеса»), не второй параметр — сигнатуру мока не меняю */
export function getNetworkDayStatsServer(locationIds: Id[], date: ISODate): Promise<Array<{ businessId: Id; name: string; metrics: DailyReportMetrics }>> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('GET', `/v1/biz/${businessId}/apps/reports/network`, undefined, { query: { locationIds: locationIds.join(','), date } });
}

// ─────────────────────────── b06: своё (брендированное) приложение (этап 21, лейн client+online, F-14-142…170) ───────────────────────────

export function getBrandedAppRequestServer(businessId: Id): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('GET', `/v1/biz/${businessId}/branded-app`);
}

export function saveBrandedAppLinksServer(businessId: Id, links: { iosLink?: string; androidLink?: string }): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('PUT', `/v1/biz/${businessId}/branded-app/links`, links);
}

export function setBrandedAppOwnerTypeServer(businessId: Id, ownerType: import('@/domain/client').BrandedAppOwnerType): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('PUT', `/v1/biz/${businessId}/branded-app/owner-type`, { ownerType });
}

export function setBrandedAppAccessMethodServer(businessId: Id, method: import('@/domain/client').BrandedAppAccessMethod): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('PUT', `/v1/biz/${businessId}/branded-app/access-method`, { method });
}

export function setBrandedAppExtraLocationsServer(businessId: Id, extraLocations: number): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('PUT', `/v1/biz/${businessId}/branded-app/extra-locations`, { extraLocations });
}

export function saveBrandedAppMaterialsServer(businessId: Id, patch: Partial<import('@/domain/client').BrandedAppMaterials>): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('PATCH', `/v1/biz/${businessId}/branded-app/materials`, patch);
}

export function toggleBrandedAppDocServer(businessId: Id, key: keyof import('@/domain/client').BrandedAppRequest['docs'], value: boolean): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('PUT', `/v1/biz/${businessId}/branded-app/docs`, { key, value });
}

export function submitBrandedAppRequestServer(businessId: Id, contact: { name: string; phone?: string }): Promise<import('@/domain/client').BrandedAppRequest> {
  return http('POST', `/v1/biz/${businessId}/branded-app/submit`, contact);
}

// ─────────────────────────── мелкие настройки профиля (этап 21, лейн client+online, попытка 2) ───────────────────────────

/** appUserId мока — сессия сервера уже несёт userId, второй параметр не передаём (сигнатуру фасада не меняю) */
export function getNewsPushOptOutServer(): Promise<boolean> {
  return http<{ optOut: boolean }>('GET', '/v1/me/news-push-opt-out').then((r) => r.optOut);
}

export function setNewsPushOptOutServer(optOut: boolean): Promise<void> {
  return http('PUT', '/v1/me/news-push-opt-out', { optOut }).then(() => undefined);
}

export function getDefaultNetworkLocationServer(networkId: Id): Promise<Id | undefined> {
  return http<{ businessId: Id | null }>('GET', `/v1/me/network-default-location/${networkId}`).then((r) => r.businessId ?? undefined);
}

export function setDefaultNetworkLocationServer(networkId: Id, businessId: Id): Promise<void> {
  return http('PUT', `/v1/me/network-default-location/${networkId}`, { businessId }).then(() => undefined);
}

export function getClientProfileServer(): Promise<import('@/api/client').ClientProfile> {
  return http('GET', '/v1/me/client-profile');
}

// ─────────────────────────── автоперевод (F-00-174) — этап 21, лейн client+online, попытка 2 ───────────────────────────

type TranslationOwner = 'staff' | 'business' | 'service';

export function getTranslationOverrideServer(owner: TranslationOwner, ownerId: Id, field: string): Promise<string | undefined> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http<{ text: string | null }>('GET', `/v1/biz/${businessId}/translations/override`, undefined, { query: { owner, ownerId, field } }).then((r) => r.text ?? undefined);
}

export function listTranslatableServer(
  businessId: Id,
): Promise<{ owner: TranslationOwner; ownerId: Id; field: string; label: string; ru: string; override?: string }[]> {
  return http('GET', `/v1/biz/${businessId}/translations`);
}

export function setTranslationOverrideServer(owner: TranslationOwner, ownerId: Id, field: string, text: string): Promise<void> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('PUT', `/v1/biz/${businessId}/translations/override`, { owner, ownerId, field, text }).then(() => undefined);
}

// ─────────────────────────── «Приложение» кабинета — сотрудники, Z-отчёт, зарплата (F-14-116…129) — этап 21, лейн client+online, попытка 2 ───────────────────────────

export function listAppStaffServer(businessId: Id, includeFired: boolean): Promise<import('@/api/client').AppStaffRow[]> {
  return http('GET', `/v1/biz/${businessId}/app-staff`, undefined, { query: { includeFired } });
}

export function setEmployeeAppAccessServer(staffId: Id, patch: Partial<import('@/domain/client').EmployeeAppAccess>): Promise<import('@/domain/client').EmployeeAppAccess> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('PATCH', `/v1/biz/${businessId}/app-staff/${staffId}/access`, patch);
}

export function getDayZReportServer(
  businessId: Id,
  date: ISODate,
  staffId?: Id,
): Promise<{ rows: import('@/api/client').VisitReportRow[]; total: number; byMethod: Record<import('@/domain/client').VisitPaymentMethod, number> }> {
  return http('GET', `/v1/biz/${businessId}/app-staff/z-report`, undefined, { query: { date, staffId } });
}

export function getAppPayrollCalculationServer(businessId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<import('@/api/client').AppPayrollCalculation> {
  return http('GET', `/v1/biz/${businessId}/app-staff/${staffId}/payroll-calculation`, undefined, { query: { from, to } });
}

export function getAppPayrollPayoutsServer(businessId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<import('@/api/client').AppPayrollPayouts> {
  return http('GET', `/v1/biz/${businessId}/app-staff/${staffId}/payroll-payouts`, undefined, { query: { from, to } });
}

export function recordPayrollPayoutServer(staffId: Id, amount: number): Promise<number> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http<number>('POST', `/v1/biz/${businessId}/app-staff/${staffId}/payroll-payouts`, { amount });
}

/** F-14-074: businessId — из сессии кабинета (сигнатуру мока не меняю) */
export function sendOneOffPushServer(input: { appUserId: Id; bookingId?: Id; text: string }): Promise<import('@/domain/client').NotificationItem> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('POST', `/v1/biz/${businessId}/app-staff/messages`, input);
}

// ─────────────────────────── визит-микрокасса (F-14-092…098) — этап 21, лейн client+online, попытка 4 ───────────────────────────

export function listNoAppRemindersTomorrowServer(businessId: Id): Promise<import('@/api/client').NoAppReminderRow[]> {
  return http('GET', `/v1/biz/${businessId}/visit-cash/no-app-reminders-tomorrow`);
}

/** Кассы визита — настоящие кассы «Финансов» (наличные), с bookingId — его филиала */
export function listVisitCashDesksServer(businessId: Id, bookingId?: Id): Promise<import('@/domain/client').VisitCashDesk[]> {
  return http('GET', `/v1/biz/${businessId}/visit-cash/cash-desks`, undefined, { query: { bookingId } });
}

export function listVisitCandidatesServer(businessId: Id, viewerStaffId?: Id): Promise<import('@/api/client').VisitCandidate[]> {
  return http('GET', `/v1/biz/${businessId}/visit-cash/candidates`, undefined, { query: { staffId: viewerStaffId } });
}

export function getVisitDetailServer(bookingId: Id): Promise<import('@/api/client').VisitDetail | undefined> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http<import('@/api/client').VisitDetail>('GET', `/v1/biz/${businessId}/visit-cash/${bookingId}`).catch((e) => (e instanceof ApiError && e.code === 'not_found' ? undefined : Promise.reject(e)));
}

export function sendVisitReceiptServer(input: { bookingId: Id; appUserId: Id; businessId: Id; total: Money }): Promise<import('@/domain/client').NotificationItem> {
  return http('POST', `/v1/biz/${input.businessId}/visit-cash/${input.bookingId}/receipt`, { appUserId: input.appUserId, total: input.total });
}

export function isVisitReceiptSentServer(bookingId: Id): Promise<boolean> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('GET', `/v1/biz/${businessId}/visit-cash/${bookingId}/receipt-sent`);
}

export function addVisitSaleLineServer(input: import('@/api/client').AddSaleLineInput): Promise<import('@/domain/client').VisitSaleLine> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  const { bookingId, ...body } = input;
  return http('POST', `/v1/biz/${businessId}/visit-cash/${bookingId}/sale-lines`, body);
}

export function removeVisitSaleLineServer(id: Id): Promise<void> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('DELETE', `/v1/biz/${businessId}/visit-cash/sale-lines/${id}`).then(() => undefined);
}

export function addVisitPaymentServer(input: import('@/api/client').AddPaymentInput): Promise<import('@/domain/client').VisitPaymentLine> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  const { bookingId, ...body } = input;
  return http('POST', `/v1/biz/${businessId}/visit-cash/${bookingId}/payments`, body);
}

export function removeVisitPaymentServer(id: Id): Promise<void> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('DELETE', `/v1/biz/${businessId}/visit-cash/payments/${id}`).then(() => undefined);
}

export function refundVisitPaymentServer(id: Id): Promise<void> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  return http('POST', `/v1/biz/${businessId}/visit-cash/payments/${id}/refund`).then(() => undefined);
}

// ═══════════════════ Этап 21 (сдача, попытка 6): сторис, новости подписчикам, продвижение (b05) ═══════════════════

type StoryRow = import('@/domain/client').Story;
type StoryWithBusiness = StoryRow & { business: import('@/domain/core').Business };

export function getStorySlotsInfoServer(): Promise<{ used: number; max: number }> {
  return http('GET', '/v1/public/stories/slots');
}

export function listHomeStoriesServer(): Promise<StoryWithBusiness[]> {
  return http('GET', '/v1/public/stories/home');
}

export function getStoryServer(storyId: Id): Promise<StoryWithBusiness | undefined> {
  return http<StoryWithBusiness | null | undefined>('GET', `/v1/public/stories/${encodeURIComponent(storyId)}`).then((v) => v ?? undefined);
}

export function recordStoryViewServer(storyId: Id): Promise<void> {
  return http('POST', `/v1/public/stories/${encodeURIComponent(storyId)}/view`).then(() => undefined);
}

export function recordStoryClickServer(storyId: Id): Promise<void> {
  return http('POST', `/v1/public/stories/${encodeURIComponent(storyId)}/click`).then(() => undefined);
}

export function listBusinessPromoStoriesServer(businessId: Id): Promise<StoryRow[]> {
  return http('GET', `/v1/public/stories/business/${businessId}`);
}

export function listBusinessStoriesServer(businessId: Id): Promise<StoryRow[]> {
  return http('GET', `/v1/biz/${businessId}/promo/stories`);
}

/** «Снять сторис»: своё — автору, любую — с billing.manage (сервер, 01.10.2026) */
export async function deleteStoryServer(storyId: Id): Promise<void> {
  const businessId = apiIdentity()?.businessId;
  if (!businessId) throw new ApiError('forbidden', 'No business in session');
  await http('DELETE', `/v1/biz/${businessId}/promo/stories/${encodeURIComponent(storyId)}`);
}

export function purchaseStoryServer(input: import('@/api/client').PurchaseStoryInput): Promise<StoryRow> {
  const { businessId, ...body } = input;
  return http('POST', `/v1/biz/${businessId}/promo/stories`, body);
}

export function listNewsPostsServer(businessId: Id): Promise<import('@/domain/client').NewsPost[]> {
  return http('GET', `/v1/biz/${businessId}/promo/news`);
}

export function getNewsWeekStatusServer(businessId: Id): Promise<{ used: number; free: number }> {
  return http('GET', `/v1/biz/${businessId}/promo/news/week`);
}

export function createNewsPostServer(input: { businessId: Id; text: string; photoUrl?: string }): Promise<import('@/domain/client').NewsPost> {
  return http('POST', `/v1/biz/${input.businessId}/promo/news`, { text: input.text, photoUrl: input.photoUrl });
}

export function getPromotionSettingsServer(businessId: Id): Promise<import('@/domain/client').PromotionSettings> {
  return http('GET', `/v1/biz/${businessId}/promo/settings`);
}

export function setHotSlotDiscountServer(businessId: Id, percent: number | undefined): Promise<void> {
  return http('PUT', `/v1/biz/${businessId}/promo/hot-slot`, { percent: percent ?? null }).then(() => undefined);
}

export function purchaseBoostServer(businessId: Id, kind: 'search' | 'home'): Promise<void> {
  return http('POST', `/v1/biz/${businessId}/promo/boost`, { kind }).then(() => undefined);
}

export function myTelegramLinkServer(): Promise<TelegramLinkInfo> {
  return http('POST', '/v1/me/telegram-link');
}

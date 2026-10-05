'use client';

/**
 * Приложение клиента для публичных страниц (главная, поиск, карточка места, избранное): только то, что зовут эти
 * страницы. В режиме api — запрос к серверу; в демо — полный '@/api/client' догружается отдельным куском (viaMock),
 * поэтому главная и поиск не тянут код кабинета и моковой базы разделов. Те же функции реэкспортирует '@/api/client' —
 * остальные экраны импортируют оттуда, как раньше.
 */
import * as CS from '@/api/client.server';
import * as CLX from '@/api/clientLoyalty.server';
import { isApiMode } from '@/api/http';
import { ApiError, viaMock } from '@/api/request';
import { getNearestSlots } from '@/api/schedule/schedule.server';
import type { FreeSlot } from '@/api/schedule';
import type {
  CatalogEntry,
  CatalogQuery,
  ClientBookingsResult,
  ClientProfile,
  DemandLeadInput,
  EnrichedBooking,
  MembershipWithBusiness,
  NotificationEntry,
  PlaceCard,
  RepeatSuggestion,
} from '@/api/client';
import type { CashbackCard, CertificateTemplate, FavoriteTargetType, GiftCertificate, LocationReview, Membership, MembershipTemplate, Story } from '@/domain/client';
import type { Id, Staff } from '@/domain/core';
import { ACTIVE_STATUSES } from '@/domain/rules/booking-status';
import { toPublicBusiness, type PublicBusiness } from '@/domain/rules/public';

const client = () => import('@/api/client');

/** «Кто когда свободен»: каталог мастеров с ближайшими окнами (F-00-001, F-00-108…F-00-112) */
export function listCatalog(q: CatalogQuery = {}): Promise<CatalogEntry[]> {
  if (isApiMode()) return CS.listCatalogServer(q);
  return viaMock(client, (m) => m.listCatalogMock(q));
}

/**
 * Кэшбэк-карта клиента для одной компании (F-14-048…053) — правило выбора: видимая карта с наибольшим
 * балансом, при равенстве — последняя выданная (последняя в списке); карты без бонусной программы (нет
 * earnRules) и невидимые (`visible: false`) не участвуют.
 */
export function getCashbackForBusiness(appUserId: Id | undefined, businessId: Id): Promise<CashbackCard | undefined> {
  if (isApiMode()) return appUserId ? CLX.orUndefined(CLX.me<CashbackCard | null>('getCashbackForBusiness', [businessId])) : Promise.resolve(undefined);
  return viaMock(client, (m) => m.getCashbackForBusinessMock(appUserId, businessId));
}

/** Филиал сети, выбранный клиентом по умолчанию — undefined, если ещё не выбирал (тогда берётся основная локация) */
export function getDefaultNetworkLocation(appUserId: Id | undefined, networkId: Id): Promise<Id | undefined> {
  if (isApiMode()) return appUserId ? CS.getDefaultNetworkLocationServer(networkId) : Promise.resolve(undefined);
  return viaMock(client, (m) => m.getDefaultNetworkLocationMock(appUserId, networkId));
}

/**
 * Карточка места/компании (F-14-028, F-14-030, F-00-024/108: заморожен → 404). В «Мастерах» — те же, что в каталоге
 * (decision-c3 №16: «Только мои» и администраторы не наполняют карточку), у каждого ближайшее окно.
 */
export function getPlaceCard(businessId: Id): Promise<PlaceCard | undefined> {
  if (isApiMode()) return CS.getPlaceCardServer(businessId).catch((e) => (e instanceof ApiError && e.code === 'not_found' ? undefined : Promise.reject(e)));
  return viaMock(client, (m) => m.getPlaceCardMock(businessId));
}

/** Отзывы о месте для карточки бизнеса (F-14-028) — новые сверху */
export function listLocationReviews(businessId: Id): Promise<LocationReview[]> {
  if (isApiMode()) return CS.listLocationReviewsServer(businessId);
  return viaMock(client, (m) => m.listLocationReviewsMock(businessId));
}

/** Записи клиента в одной компании (F-14-026) — ближайшая предстоящая первой, потом прошедшие по убыванию */
export function listMyBookingsInBusiness(appUserId: Id, businessId: Id): Promise<EnrichedBooking[]> {
  if (isApiMode()) return CS.listMyBookingsInBusinessServer(businessId);
  return viaMock(client, (m) => m.listMyBookingsInBusinessMock(appUserId, businessId));
}

/** Сертификаты этого места, доступные к покупке — пусто, если продавать нечего (F-14-044) */
export function listPurchasableCertificates(businessId: Id): Promise<CertificateTemplate[]> {
  if (isApiMode()) return CLX.pub(businessId, 'listPurchasableCertificates');
  return viaMock(client, (m) => m.listPurchasableCertificatesMock(businessId));
}

/** Абонементы этого места, доступные к покупке — пусто, если продавать нечего (F-14-044) */
export function listPurchasableMemberships(businessId: Id): Promise<MembershipTemplate[]> {
  if (isApiMode()) return CLX.pub(businessId, 'listPurchasableMemberships');
  return viaMock(client, (m) => m.listPurchasableMembershipsMock(businessId));
}

/** Купить сертификат (F-14-043) — та же схема оплаты и заявки, что покупка абонемента (В-17) */
export function purchaseCertificate(appUserId: Id, templateId: Id): Promise<GiftCertificate> {
  if (isApiMode()) return CLX.me('purchaseCertificate', [templateId]);
  return viaMock(client, (m) => m.purchaseCertificateMock(appUserId, templateId));
}

/**
 * Купить абонемент (F-14-043, F-14-045): оплата — по нашему решению отложена (F-00-028), сейчас
 * альтернативным способом — по реквизитам бизнеса, как ручная предоплата записи (F-00-097). «Купить»
 * создаёт заявку 'pendingConfirmation' — визиты недоступны, пока бизнес не подтвердит оплату (В-17).
 */
export function purchaseMembership(appUserId: Id, templateId: Id): Promise<Membership> {
  if (isApiMode()) return CLX.me('purchaseMembership', [templateId]);
  return viaMock(client, (m) => m.purchaseMembershipMock(appUserId, templateId));
}

/** Клиент сети выбирает филиал по умолчанию (F-14-163); переживает перезагрузку */
export function setDefaultNetworkLocation(appUserId: Id, networkId: Id, businessId: Id): Promise<void> {
  if (isApiMode()) return CS.setDefaultNetworkLocationServer(networkId, businessId);
  return viaMock(client, (m) => m.setDefaultNetworkLocationMock(appUserId, networkId, businessId));
}

/**
 * Лента уведомлений клиента (F-14-055): «новости» (broadcast) от бизнеса, у которого приглушены —
 * не показываем (F-00-115/F-14-058 — тот же переключатель, что в избранном); напоминания и статусы
 * записи этим не глушатся.
 */
export function listNotifications(appUserId: Id): Promise<NotificationEntry[]> {
  if (isApiMode()) return CS.listNotificationsServer();
  return viaMock(client, (m) => m.listNotificationsMock(appUserId));
}

/**
 * Абонементы клиента, которые скоро заканчиваются и напоминание о которых он ещё не видел (F-14-046):
 * ≤5 дней до конца или последний визит. Одно напоминание за раз — экран показывает первое из списка.
 */
export function listPendingMembershipReminders(appUserId: Id): Promise<Array<MembershipWithBusiness & { renewTemplateId?: Id }>> {
  if (isApiMode()) return CLX.me('listPendingMembershipReminders');
  return viaMock(client, (m) => m.listPendingMembershipRemindersMock(appUserId));
}

/** Клиент увидел напоминание — не показывать снова, следующее (если есть) покажется позже (F-14-046) */
export function markMembershipReminderSeen(membershipId: Id): Promise<void> {
  if (isApiMode()) return CLX.me<null>('markMembershipReminderSeen', [membershipId]).then(() => undefined);
  return viaMock(client, (m) => m.markMembershipReminderSeenMock(membershipId));
}

/**
 * Мастера клиента: «Мои мастера» — только те, к кому клиент сам записался через приложение или веб
 * (F-14-009, F-00-118, черновик до F-00-113 в b03). Мастера, у которых клиент есть только в CRM бизнеса
 * (записан администратором в журнале, по телефону и т. п.), сюда не попадают — иначе клиенту стало бы
 * видно, что его завели в чужой CRM (F-00-010, F-00-130).
 */
export function listBookedMasters(appUserId: Id, limit = 6): Promise<Staff[]> {
  if (isApiMode()) return CS.listBookedMastersServer(limit);
  return viaMock(client, (m) => m.listBookedMastersMock(appUserId, limit));
}

/**
 * «Снова к Ани?» на главной (ux-best-c2 №3, speed-k2 №2): последний состоявшийся визит, если к этому мастеру нет
 * предстоящей записи, и его ближайшее окно на ту же услугу — повтор в 2 нажатия.
 */
export function getRepeatSuggestion(appUserId: Id): Promise<RepeatSuggestion | undefined> {
  if (isApiMode()) {
    return (async () => {
      const r = await listMyBookings(appUserId);
      // Последний визит, к чьему мастеру нет предстоящей записи: самый свежий визит мог уже иметь «следующий раз»
      const last = [...r.past, ...r.upcoming]
        .filter((b) => b.status === 'arrived')
        .sort((a, b) => b.start.localeCompare(a.start))
        .find((b) => !r.upcoming.some((u) => u.staffId === b.staffId && ACTIVE_STATUSES.includes(u.status)));
      if (!last) return undefined;
      const nextSlots = await getNearestSlots({
        staffId: last.staffId,
        durationMin: last.durationMin,
        serviceId: last.services[0]?.serviceId,
        limit: 1,
      }).catch(() => [] as FreeSlot[]);
      return { booking: last, nextSlot: nextSlots[0] };
    })();
  }
  return viaMock(client, (m) => m.getRepeatSuggestionMock(appUserId));
}

/** Сторис вверху главной приложения клиента, видят ВСЕ (F-00-159): сначала подписки клиента, потом остальные (F-00-161, порядок — предл.) */
export function listHomeStories(appUserId: Id | undefined): Promise<Array<Story & { business: PublicBusiness }>> {
  if (isApiMode()) return CS.listHomeStoriesServer().then((rows) => rows.map((r) => ({ ...r, business: toPublicBusiness(r.business) })));
  return viaMock(client, (m) => m.listHomeStoriesMock(appUserId));
}

/** Ближайшие активные записи клиента для главной — та же строка, что в «Моих записях» (ux-r2 №47) */
export function listUpcomingBookings(appUserId: Id, limit = 3): Promise<EnrichedBooking[]> {
  if (isApiMode()) {
    return listMyBookings(appUserId).then((r) => r.upcoming.filter((b) => ACTIVE_STATUSES.includes(b.status)).slice(0, limit));
  }
  return viaMock(client, (m) => m.listUpcomingBookingsMock(appUserId, limit));
}

/**
 * «Сообщить, когда появится» (F-00-112): своя заявка (чтобы клиенту написать, когда мастер появится) и — у вошедшего
 * с выбранным районом — строка в отчёте спроса нашей панели (decision-c1 №14: раньше до панели не доходило).
 */
export async function submitDemandLead(input: DemandLeadInput): Promise<void> {
  if (isApiMode()) return CS.submitDemandLeadServer(input);
  return viaMock(client, (m) => m.submitDemandLeadMock(input));
}

export function getClientProfile(appUserId: Id): Promise<ClientProfile | undefined> {
  if (isApiMode()) return CS.getClientProfileServer();
  return viaMock(client, (m) => m.getClientProfileMock(appUserId));
}

/** Правка мастера к автопереводу его текста на en, если есть (F-00-174) */
export function getTranslationOverride(owner: 'staff' | 'business' | 'service', ownerId: Id, field: string): Promise<string | undefined> {
  if (isApiMode()) return CS.getTranslationOverrideServer(owner, ownerId, field);
  return viaMock(client, (m) => m.getTranslationOverrideMock(owner, ownerId, field));
}

/** Подписан ли клиент на мастера/место — для кнопки ❤ на карточке (F-00-113) */
export function isFavorited(appUserId: Id, targetType: FavoriteTargetType, targetId: Id): Promise<boolean> {
  if (isApiMode()) return CS.isFavoritedServer(targetType, targetId);
  return viaMock(client, (m) => m.isFavoritedMock(appUserId, targetType, targetId));
}

/** ❤ — подписаться/отписаться одной кнопкой (F-00-113); возвращает новое состояние */
export function toggleFavorite(input: { appUserId: Id; targetType: FavoriteTargetType; targetId: Id }): Promise<boolean> {
  if (isApiMode()) return CS.toggleFavoriteServer(input.targetType, input.targetId);
  return viaMock(client, (m) => m.toggleFavoriteMock(input));
}

/** Показ акций на карточке места и мастера (F-14-032, F-14-033) — только активные сторис этого бизнеса, новая первой */
export function listBusinessPromoStories(businessId: Id): Promise<Story[]> {
  if (isApiMode()) return CS.listBusinessPromoStoriesServer(businessId);
  return viaMock(client, (m) => m.listBusinessPromoStoriesMock(businessId));
}

/** Три списка записей клиента (F-14-011): предстоящие / прошедшие / отменённые. Просроченные предоплаты снимает ядро */
export function listMyBookings(appUserId: Id): Promise<ClientBookingsResult> {
  if (isApiMode()) return CS.listMyBookingsServer();
  return viaMock(client, (m) => m.listMyBookingsMock(appUserId));
}

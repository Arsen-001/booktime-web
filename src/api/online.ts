'use client';

/**
 * API раздела «online». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area';
 * сущности ядра — функции '@/api/core'. Экраны зовут эти функции через useApiQuery/useApiMutation.
 */
import { readArea, readCore, mutateArea } from '@/api/area';
import { coreCreate, coreGet, coreList, coreTx, coreUpdate, createBooking, findClientByPhone, listBookings, listGroupEvents, moderationHiddenIds, updateBooking } from '@/api/core';
import { getClientLoyalty } from '@/api/clients';
import { isApiMode } from '@/api/http';
import * as OnlineServer from '@/api/online.server';
import type { OnlineCodeSent } from '@/api/online.server';
import { pickFreeResourceInstances, waitlistTx } from '@/api/resources';
import { findSameWaitlistRequest, wishesForDay, type WaitlistEntry as BusinessWaitlistEntry } from '@/domain/resources';
import { ApiError, request } from '@/api/request';
import { attachReferralTx } from '@/api/referral';
import { broadcastBookingDecision } from '@/areas/online/lib/bookingDecisionChannel';
import type {
  Booking,
  BookingForWhom,
  BookingServiceLine,
  BookingSource,
  BookingStatus,
  Business,
  Client,
  CoreData,
  DistrictId,
  GroupEvent,
  Id,
  ISODate,
  ISODateTime,
  LocalizedText,
  Location,
  Service,
  ServiceCategory,
  Staff,
  Workplace,
  PrepaymentRule,
} from '@/domain/core';
import type {
  ApiCredentials,
  BookingDevice,
  BookingLink,
  BusinessOnlineRules,
  ClientFieldsConfig,
  CustomClientField,
  GroupBookingRules,
  IntegrationConnection,
  IntegrationId,
  LinkBookingType,
  LinkKind,
  MobileAppLinks,
  NetworkExtraField,
  OnlineBookingMeta,
  OnlinePackage,
  OnlineRequestView,
  PromoBlock,
  PromoScreen,
  Review,
  ReviewTarget,
  ServiceOnlineConfig,
  SlotInvite,
  StaffOnlineRules,
  StaffServiceOnlineFlags,
  WaitlistRequest,
  WidgetEventType,
} from '@/domain/online';
import {
  DEFAULT_CLIENT_FIELDS,
  DEFAULT_CONSENT_TEXT,
  DEFAULT_GROUP_BOOKING_RULES,
  DEFAULT_STAFF_ONLINE_RULES,
  DEFAULT_MAX_DAYS_AHEAD,
  DEFAULT_WEBSITE_BUTTON,
  INTEGRATION_CATALOG,
  staffServicePairKey,
} from '@/domain/online';
import { addDays, addMinutes, nowDateTime, toISODate, today, weekdayIndex } from '@/lib/date';
import * as StaffServer from '@/api/staff.server';
import type { TelegramLinkInfo } from '@/domain/client';
import { attachUpsellGoodsTx, recordPrepaymentLineSync } from '@/api/journal';
import { upsellGoodsLinesTx, upsellServiceLinesTx } from '@/api/services-upsell';
import type { BookingAddOns } from '@/domain/services';
import { recordPrepaymentReceivedSync } from '@/api/finance';
import * as JournalServer from '@/api/journal.server';
import {
  canCancelFree as isFreeCancelNow,
  canPayInFull,
  canReschedule,
  effectiveBookingRules,
  hasExactPrice,
  isSlotFree,
  normalizeNoShowRule,
  prepaymentAmount,
  prepaymentNeed,
  recentNoShows,
  scheduleHours,
  type EffectiveBookingRules,
} from '@/domain/rules';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { computeFreeSlots, effectiveBufferMin, type FreeSlot } from '@/api/schedule';

// ─────────────────────────── Ссылки (F-03-003…F-03-014) ───────────────────────────


/**
 * Н5 (28.09): формат времени — один источник, «Системные» (= JournalSettings.hourFormat, см. getSystemSettings).
 * Прежнее поле правил онлайна hourCycle — только запасной вариант для старых баз.
 */
/** У24 (28.09): период «с — по» окна услуги из её формы (движок слотов) — вне периода услуга в виджете не видна */
function inServiceWindowPeriod(serviceId: Id, date: ISODate): boolean {
  const w = readArea('schedule').serviceSlotWindows?.[serviceId];
  if (!w) return true;
  if (w.to && date > w.to) return false;
  return true;
}

function sharedHourCycle(legacy: '24' | '12' | undefined): '24' | '12' {
  return readArea('journal').settings?.hourFormat ?? legacy ?? '24';
}

export function listLinks(businessId: Id): Promise<BookingLink[]> {
  if (isApiMode()) return OnlineServer.listLinksServer();
  return request(() => readArea('online').links.filter((l) => l.businessId === businessId));
}

export function getLink(id: Id): Promise<BookingLink> {
  if (isApiMode()) return OnlineServer.getLinkServer(id);
  return request(() => {
    const found = readArea('online').links.find((l) => l.id === id);
    if (!found) throw new ApiError('not_found', `Ссылка ${id} не найдена`);
    return found;
  });
}

/** Ссылка бизнеса по номеру формы (адрес /b/<slug>/f/<formId>) — F-03-009 */
export function getLinkByFormId(businessId: Id, formId: string): Promise<BookingLink> {
  if (isApiMode()) return OnlineServer.getLinkByFormIdServer(formId);
  return request(() => {
    const found = readArea('online').links.find((l) => l.businessId === businessId && l.formId === formId);
    if (!found) throw new ApiError('not_found', `Форма ${formId} не найдена`);
    return found;
  });
}

export interface CreateLinkInput {
  businessId: Id;
  locationId?: Id;
  name: string;
  description?: string;
  kind: LinkKind;
  bookingType: LinkBookingType;
  defaultLocale: BookingLink['defaultLocale'];
  staffId?: Id;
  primary?: boolean;
}

/** «Новая ссылка» (F-03-005, F-03-006) */
export function createLink(input: CreateLinkInput): Promise<BookingLink> {
  if (isApiMode()) return OnlineServer.createLinkServer(input);
  return request(() => {
    // F-03-008: сетевая ссылка берёт сеть у самого бизнеса (у нас у филиала одна сеть — Business.networkId,
    // выбирать её незачем); нет сети — сетевую ссылку не создать (кабинет одиночного мастера/салона).
    const business = readCore().businesses.find((b) => b.id === input.businessId);
    if (input.kind === 'network' && !business?.networkId) {
      throw new ApiError('no_network', 'Этот бизнес не состоит в сети');
    }
    const link: BookingLink = {
      id: newId('lnk'),
      businessId: input.businessId,
      locationId: input.locationId,
      name: input.name,
      description: input.description,
      kind: input.kind,
      bookingType: input.bookingType,
      defaultLocale: input.defaultLocale,
      staffId: input.staffId,
      networkId: input.kind === 'network' ? business?.networkId : undefined,
      primary: false,
      formId: String(1_500_000 + Math.floor(Math.random() * 899_999)),
      createdAt: nowDateTime(),
      // Новая ссылка из приложения бизнеса — по умолчанию «Меню» (F-03-015, 1432).
      bookingFlow: 'menu',
      stepOrder: ['service', 'staff', 'time'],
      stepHidden: {},
      stepLabels: {},
      staffDisplayField: 'specialty',
      categoryDisplay: 'tags',
      theme: 'light',
      widgetButtonColor: '#3b32c9', // tokens-ok — цвет кнопки виджета — данные настройки бизнеса
      websiteButton: { ...DEFAULT_WEBSITE_BUTTON },
    };
    mutateArea('online', (s) => {
      s.links.push(link);
    });
    if (input.primary) void setPrimaryLink(input.businessId, link.id);
    return link;
  });
}

export type UpdateLinkPatch = Partial<
  Omit<BookingLink, 'id' | 'businessId' | 'createdAt' | 'formId' | 'primary' | 'kind'>
>;

export function updateLink(id: Id, patch: UpdateLinkPatch): Promise<BookingLink> {
  if (isApiMode()) return OnlineServer.updateLinkServer(id, patch);
  return request(() => {
    let updated: BookingLink | undefined;
    mutateArea('online', (s) => {
      s.links = s.links.map((l) => {
        if (l.id !== id) return l;
        updated = { ...l, ...patch };
        return updated;
      });
    });
    if (!updated) throw new ApiError('not_found', `Ссылка ${id} не найдена`);
    return updated;
  });
}

// ─────────────────────────── Дизайн: контраст цвета кнопок (F-03-024) ───────────────────────────

/**
 * Относительная яркость по WCAG — упрощённый, но настоящий расчёт контраста к белому фону виджета.
 * Порог в справке Altegio не назван (F-03-024, «понятно?»); ⭐ по нашему решению берём порог WCAG AA
 * для крупного текста/иконок (3:1) — assumed.
 */
export function contrastRatioToWhite(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return 21; // невалидный HEX — не блокируем здесь, форма проверяет отдельно
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel((num >> 16) & 0xff);
  const g = channel((num >> 8) & 0xff);
  const b = channel(num & 0xff);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1 + 0.05) / (luminance + 0.05);
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export const MIN_CONTRAST = 1.6;

// ─────────────────────────── Персональный домен (F-03-037) ───────────────────────────

export function isSubdomainAvailable(subdomain: string, excludeLinkId?: Id): Promise<boolean> {
  if (isApiMode()) return OnlineServer.isSubdomainAvailableServer(subdomain, excludeLinkId);
  return request(() => {
    const clean = subdomain.trim().toLowerCase();
    return !readArea('online').links.some((l) => l.id !== excludeLinkId && l.subdomain?.toLowerCase() === clean);
  });
}

/** «Сделать ссылку основной» (F-03-007) — снимает флажок с прежней основной той же локации */
export function setPrimaryLink(businessId: Id, id: Id): Promise<BookingLink> {
  if (isApiMode()) return OnlineServer.setPrimaryLinkServer(id);
  return request(() => {
    let updated: BookingLink | undefined;
    mutateArea('online', (s) => {
      s.links = s.links.map((l) => {
        if (l.businessId !== businessId) return l;
        const next = { ...l, primary: l.id === id };
        if (next.primary) updated = next;
        return next;
      });
    });
    if (!updated) throw new ApiError('not_found', `Ссылка ${id} не найдена`);
    return updated;
  });
}

/** Удаление ссылки (F-03-010) — основную удалить нельзя, у бизнеса всегда остаётся хотя бы одна */
export function deleteLink(id: Id): Promise<void> {
  if (isApiMode()) return OnlineServer.deleteLinkServer(id);
  return request(() => {
    const link = readArea('online').links.find((l) => l.id === id);
    if (!link) throw new ApiError('not_found', `Ссылка ${id} не найдена`);
    if (link.primary) throw new ApiError('cannot_delete_primary', 'Основную ссылку нельзя удалить');
    mutateArea('online', (s) => {
      s.links = s.links.filter((l) => l.id !== id);
    });
  });
}

// ─────────────────────────── Видимость мастера онлайн (F-03-134) ───────────────────────────

/**
 * Мастер доступен на публичной странице /b/<slug> (доступ уже «по ссылке»), только если: активен, у него
 * есть график работы и хотя бы одна назначенная услуга, открытая для онлайн-записи.
 *
 * F-00-065 (исправлено): режим «Только мои клиенты» (calendarVisibility === 'mine') раньше убирал мастера
 * из getPublicBusinessData ЦЕЛИКОМ — по прямой ссылке на него не мог записаться вообще никто, ни свой
 * клиент, ни чужой. Режим «mine» значит «не в каталоге и поиске» (это фильтрует другой раздел — приложение
 * клиента), а НЕ «недоступен по своей же ссылке»: страница по прямой ссылке — и есть тот самый канал для
 * «своих», через который чужой попадает в заявку (see createOnlineBooking: `mine`-мастеру чужой клиент
 * получает статус «ждёт подтверждения», свой — обычную запись).
 * ⭐ по нашему решению калькулятор online-видимости мастера использует уже имеющиеся поля
 * (Staff.calendarVisibility, Service.onlineBookable) вместо отдельного флажка «онлайн-запись включена»
 * (в ядре его нет) — assumed.
 */
export function isStaffOnlineVisible(staff: Staff, services: Service[], hasSchedule: boolean): boolean {
  if (staff.status !== 'active') return false;
  // Отдельный тумблер «включена онлайн-запись у мастера» (ядро добавило 25.09) — нет поля значит можно
  if (staff.onlineBookingEnabled === false) return false;
  if (!hasSchedule) return false;
  const own = services.filter((s) => staff.serviceIds.includes(s.id));
  return own.some((s) => s.active && s.onlineBookable);
}

export interface PublicBusinessData {
  business: Business;
  location: Location | undefined;
  categories: ServiceCategory[];
  services: Service[];
  staff: Staff[];
  link: BookingLink | undefined;
  /** «Постоянные клиенты» вместо оценки 1–5 (F-00-116/117 — «плохие отзывы и оценка» сняты) */
  regularsCount: number;
  /** Онлайн-настройки услуг: название/описание/картинка/ограничение по времени (F-03-129) — ключ Service.id */
  serviceConfigs: Record<Id, ServiceOnlineConfig>;
  /** Пары «мастер × услуга» с выключенной онлайн-записью (F-03-133) */
  staffServiceOnline: StaffServiceOnlineFlags;
  /** Ссылка вела на мастера, который больше не виден онлайн (уволен/удалён/выключен) — F-03-143 */
  linkStaffGone: boolean;
  /** Промоблоки для экрана «меню» (F-03-106) */
  promoBlocks: PromoBlock[];
  /** Звёздочка бизнеса (F-03-105) */
  businessStars: number;
  /** Сеть, если у ссылки kind==='network' и локация ещё не выбрана (F-03-008, F-03-083) */
  networkBranches: Business[] | undefined;
  /** Пакеты (комплексы), включённые для онлайн-записи и доступные прямо сейчас (F-03-130) */
  packages: OnlinePackage[];
  /** F-03-116: формат времени локации для дат/времени в виджете */
  hourCycle: '24' | '12';
  /**
   * Точный адрес скрыт до подтверждённой записи (F-00-077): мастер принимает только дома (workplaces=['home']),
   * своего салона у него нет. location.district всё равно виден, address клиенту показывать нельзя.
   */
  addressHidden: boolean;
  /** О8/О25: «Любой специалист» разрешён (по умолчанию — да). Нет поля (api) — да */
  anyStaffAllowed?: boolean;
  /** О1: на сколько дней вперёд открыт календарь клиента. Нет поля — DEFAULT_MAX_DAYS_AHEAD */
  maxDaysAhead?: number;
  /**
   * О22: часы работы сегодня — самые ранние и поздние часы филиала (или мастеров, если часов филиала нет).
   * null — сегодня закрыто; нет поля — не знаем (api), блок не показываем.
   */
  todayHours?: { from: string; to: string } | null;
}

/**
 * Доступна ли услуга онлайн ПРЯМО СЕЙЧАС по её ограничению «доступна ограниченное время» (F-03-129):
 * период с–по, часы, дни недели. Нет конфигурации или ограничения — доступна всегда.
 */
export function isServiceCurrentlyBookable(config: ServiceOnlineConfig | undefined, date: ISODate = today()): boolean {
  const a = config?.availability;
  if (!a) return true;
  if (a.periodFrom && date < a.periodFrom) return false;
  if (a.periodTo && date > a.periodTo) return false;
  if (a.days === 'any' || !a.days) return true;
  if (a.days === 'custom') return (a.customDates ?? []).includes(date);
  const dow = new Date(date).getDay(); // 0=вс..6=сб
  const isWeekend = dow === 0 || dow === 6;
  return a.days === 'weekends' ? isWeekend : !isWeekend;
}

/** Пара «мастер × услуга» включена для онлайн-записи (F-03-133) — нет ключа значит включена */
export function isStaffServicePairOnline(flags: StaffServiceOnlineFlags, staffId: Id, serviceId: Id): boolean {
  return flags[staffServicePairKey(staffId, serviceId)] !== false;
}

/** От скольких визитов клиент считается постоянным — тот же порог, что у карточки мастера в приложении клиента */
const REGULAR_VISITS_THRESHOLD = 3;

/** Сколько клиентов бизнеса — постоянные (F-00-117), без учёта отменённых визитов */
function countBusinessRegulars(core: CoreData, businessId: Id): number {
  const perClient = new Map<Id, number>();
  for (const b of core.bookings) {
    if (b.deletedAt || !b.clientId || b.businessId !== businessId) continue;
    if (b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master') continue;
    perClient.set(b.clientId, (perClient.get(b.clientId) ?? 0) + 1);
  }
  return [...perClient.values()].filter((n) => n >= REGULAR_VISITS_THRESHOLD).length;
}

/**
 * Убирает из мастера данные, не предназначенные для публики до записи (F-00-077, F-00-010): точный
 * домашний адрес (только район, `homeDistrict`, остаётся), логин администратора и часы звонков — их
 * знает только сам бизнес. Личный телефон/контакты оставляем — их отдаёт клиенту после подтверждённой
 * записи отдельный экран (BookingConfirmedScreen), а до записи их всё равно не показывает ни один экран;
 * здесь режем только то, что раньше уезжало в сетевом ответе целиком (видно в devtools, не только в JSX).
 */
function sanitizePublicStaff(s: Staff): Staff {
  const { homeAddress: _homeAddress, login: _login, callHours: _callHours, ...rest } = s;
  return rest as Staff;
}

/** Всё для публичной страницы /b/<slug>[/f/<formId>] — только видимое онлайн (F-03-134, F-03-140) */
export function getPublicBusinessData(slug: string, formId?: string): Promise<PublicBusinessData> {
  if (isApiMode()) return OnlineServer.getPublicBusinessDataServer(slug, formId);
  return request(() => {
    const core = readCore();
    const business = core.businesses.find((b) => b.slug === slug);
    if (!business) throw new ApiError('not_found', `Бизнес «${slug}» не найден`);
    // О24: черновик/модерация — не «опечатка в ссылке», а «запись скоро откроется» (экран берёт телефон через getUnpublishedContact)
    if (business.status !== 'active') throw new ApiError('not_published', `Бизнес «${slug}» ещё не опубликован`);
    const location = core.locations.find((l) => l.businessId === business.id && l.id === business.locationIds[0]);
    // F-00-077: мастер принимает только на дому — точный адрес виден клиенту лишь после подтверждённой записи.
    const ownerStaffForAddress = core.staff.find((s) => s.id === business.ownerStaffId);
    const addressHidden = Boolean(
      ownerStaffForAddress && ownerStaffForAddress.workplaces.includes('home') && !ownerStaffForAddress.workplaces.some((w) => w === 'salon' || w === 'gym'),
    );
    const hiddenPhotoIds = moderationHiddenIds();
    const visiblePhotos = business.photos.filter((p) => !hiddenPhotoIds.has(p));
    const online = readArea('online');
    const serviceConfigs = online.serviceConfigs ?? {};
    const today0 = today();
    const services = core.services.filter(
      (s) => s.businessId === business.id && s.active && s.onlineBookable && isServiceCurrentlyBookable(serviceConfigs[s.id], today0) && inServiceWindowPeriod(s.id, today0),
    );
    const categories = core.serviceCategories.filter((c) => c.businessId === business.id);
    const staff = core.staff
      .filter((s) => {
        if (s.businessId !== business.id) return false;
        const hasSchedule = core.schedules.some((sch) => sch.staffId === s.id);
        return isStaffOnlineVisible(s, services, hasSchedule);
      })
      .map(sanitizePublicStaff)
      .map((s) => (s.photos.some((p) => hiddenPhotoIds.has(p)) ? { ...s, photos: s.photos.filter((p) => !hiddenPhotoIds.has(p)) } : s));
    const links = readArea('online').links.filter((l) => l.businessId === business.id);
    let link = formId ? links.find((l) => l.formId === formId) : links.find((l) => l.primary) ?? links[0];
    if (formId && !link) throw new ApiError('not_found', `Форма ${formId} не найдена`);

    // F-03-143: ссылка вела на конкретного мастера (персональная или предвыбор), а его больше не видно
    // онлайн (уволен/удалён/выключен) — открываем страницу бизнеса без этого мастера вместо ошибки.
    let linkStaffGone = false;
    if (link) {
      const pinnedId = link.staffId;
      const preselectedId = link.preselectedStaffId !== 'any' ? link.preselectedStaffId : undefined;
      const stillVisible = (id: Id | undefined) => !id || staff.some((s) => s.id === id);
      if (!stillVisible(pinnedId) || !stillVisible(preselectedId)) {
        linkStaffGone = true;
        link = { ...link, staffId: stillVisible(pinnedId) ? pinnedId : undefined, preselectedStaffId: stillVisible(preselectedId) ? preselectedId : undefined };
      }
      // О25: «Сотрудник для всех онлайн-записей» теперь общий для бизнеса («Правила записи»); своя настройка ссылки главнее
      const bizStaffForAll = online.businessRules[business.id]?.staffForAllBookings;
      if (!link.staffForAllBookings && bizStaffForAll && staff.some((s) => s.id === bizStaffForAll)) {
        link = { ...link, staffForAllBookings: bizStaffForAll };
      }
    }

    // F-03-008/083: сетевая ссылка без выбранной локации — сначала выбор филиала.
    let networkBranches: Business[] | undefined;
    if (link?.kind === 'network' && link.networkId) {
      networkBranches = core.businesses.filter((b) => b.networkId === link!.networkId && b.status === 'active');
    }

    const promoBlocksAll = online.promoBlocks?.[business.id] ?? [];
    // F-03-106: «на одном экране виден один блок» — самый старый подходящий, а не все сразу.
    const promoBlocks = pickOnePromoBlockForScreen(promoBlocksAll, 'menu');
    const businessStars = (online.reviews ?? []).filter((r) => r.businessId === business.id && r.target === 'business').length;
    // F-03-130: пакет виден, только если включён, доступен «прямо сейчас» и все его услуги ещё существуют онлайн.
    const packages = (online.packages ?? []).filter(
      (p) => p.businessId === business.id && p.online && isServiceCurrentlyBookable({ serviceId: p.id, availability: p.availability }, today0) && p.serviceIds.every((id) => services.some((s) => s.id === id)),
    );

    return {
      business: visiblePhotos.length === business.photos.length ? business : { ...business, photos: visiblePhotos },
      location,
      categories,
      services,
      staff,
      link,
      regularsCount: countBusinessRegulars(core, business.id),
      serviceConfigs,
      staffServiceOnline: online.staffServiceOnline ?? {},
      linkStaffGone,
      promoBlocks,
      businessStars,
      networkBranches,
      hourCycle: sharedHourCycle(online.businessRules[business.id]?.hourCycle),
      packages,
      addressHidden,
      anyStaffAllowed: online.businessRules[business.id]?.allowAnyStaffForAllLinks ?? true,
      maxDaysAhead: online.businessRules[business.id]?.maxDaysAhead ?? DEFAULT_MAX_DAYS_AHEAD,
      todayHours: todayOpenHours(core, location, staff, today0),
    };
  });
}

/** О22: «Сегодня открыто до 21:00» — часы филиала, иначе объединение часов мастеров на сегодня; null — выходной */
function todayOpenHours(core: CoreData, location: Location | undefined, staff: Staff[], date: ISODate): { from: string; to: string } | null {
  let ranges: { from: string; to: string }[] = [];
  if (location?.openHours) {
    ranges = location.openHours[weekdayIndex(date)] ?? [];
  } else {
    for (const st of staff) {
      for (const sch of core.schedules.filter((x) => x.staffId === st.id && (!location || x.locationId === location.id))) {
        ranges = ranges.concat(scheduleHours(sch, date));
      }
    }
  }
  if (ranges.length === 0) return null;
  const from = ranges.map((r) => r.from).sort()[0];
  const to = ranges.map((r) => r.to).sort().reverse()[0];
  return { from, to };
}

/** О24: имя и телефон неопубликованного бизнеса — для экрана «Онлайн-запись скоро откроется» */
export function getUnpublishedContact(slug: string): Promise<{ name: string; phone: string } | undefined> {
  if (isApiMode()) return Promise.resolve(undefined);
  return request(() => {
    const business = readCore().businesses.find((b) => b.slug === slug);
    if (!business || business.status === 'active') return undefined;
    return { name: business.name, phone: business.phone };
  });
}

// ─────────────────────────── Свободные окна виджета (F-03-065, F-03-084, F-03-085) ───────────────────────────

export interface WidgetSlotQuery {
  /**
   * Адрес страницы бизнеса (`Business.slug`) — только для режима `api` (сервер публичных окон живёт по слагу,
   * F-03-134). Мок его не читает: свободные окна публичной страницы всегда есть у виджета/шага «Ссылка»
   * (страница уже загрузила `getPublicBusinessData(slug)`); экраны, ещё не передающие его (F-16, «Комплекс»
   * последовательно несколькими мастерами), в `api` продолжают считать окна по зеркалу ядра — приближённо, не 0.
   */
  slug?: Id;
  staffId: Id;
  date: ISODate;
  durationMin: number;
  /** Верхняя граница «от–до» услуги (F-00-057) — бронирует её, если задана; иначе берётся durationMin */
  durationMax?: number;
  /** Услуга — чтобы учесть занятость привязанных ресурсов (F-02-070), как делает SlotQuery */
  serviceId?: Id;
  /** Филиал — на сетевых бизнесах у мастера может идти график по нескольким локациям */
  locationId?: Id;
  /**
   * Место оказания услуги, выбранное клиентом (F-00-073…081): «в салоне» / «дома» и т.д. — окна с других
   * мест работы того же мастера в один день (например, «дома» по воскресеньям) не показываются, чтобы
   * не предлагать время, недоступное там, где клиент выбрал записаться. «Выезд» физически идёт из базового
   * графика мастера (нет отдельного графика «на выезде») — по нему окна не фильтруются (⭐ assumed).
   */
  workplace?: Workplace;
}

/**
 * Оставляет только окна выбранного места работы (F-00-073…081): например, чтобы «дому» одного мастера
 * по воскресеньям не подмешивались к «в салоне» на будни того же дня. Строгий фильтр — нет графика этого
 * места работы в этот день, значит день недоступен для него, а не «покажем другое место вместо».
 */
function filterByWorkplace(slots: FreeSlot[], workplace: Workplace | undefined): FreeSlot[] {
  if (!workplace || workplace === 'visit') return slots;
  return slots.filter((s) => s.workplace === workplace);
}

/**
 * F-00-080: «время на дорогу» мастера, настроенное в местах работы, само закрывает календарь ДО и ПОСЛЕ
 * каждого выезда — раздел schedule ничего не знает про travelTimeMin, поэтому буфер считаем здесь и режем
 * уже посчитанные окна поверх computeFreeSlots (не трогаем чужой src/api/schedule.ts). Пример из ТЗ: выезд
 * на 15:00 с дорогой 30 минут закрывает 14:30–(конец услуги + 30 мин).
 */
function visitTravelBuffers(core: CoreData, staffId: Id, date: ISODate): { from: ISODateTime; to: ISODateTime }[] {
  const travelTimeMin = readArea('online').staffRules[staffId]?.travelTimeMin;
  if (!travelTimeMin) return [];
  return core.bookings
    .filter(
      (b) =>
        !b.deletedAt &&
        b.staffId === staffId &&
        b.workplace === 'visit' &&
        b.status !== 'cancelled_by_client' &&
        b.status !== 'cancelled_by_master' &&
        b.start.slice(0, 10) === date,
    )
    .map((b) => ({ from: addMinutes(b.start, -travelTimeMin), to: addMinutes(b.start, b.durationMin + travelTimeMin) }));
}

function filterByTravelBuffer(slots: FreeSlot[], core: CoreData, staffId: Id, date: ISODate): FreeSlot[] {
  const buffers = visitTravelBuffers(core, staffId, date);
  if (buffers.length === 0) return slots;
  return slots.filter((s) => !buffers.some((b) => s.start < b.to && s.end > b.from));
}

/** Свободные окна с учётом онлайн-правил (F-03-065, F-03-084, F-03-085) */
export function getWidgetFreeSlots(q: WidgetSlotQuery): Promise<FreeSlot[]> {
  if (isApiMode() && q.slug) return OnlineServer.getWidgetFreeSlotsServer(q.slug, q);
  return request(async () => {
    // F-03-094: истёкшая «ждёт предоплату» без «Я оплатил» освобождает слот сама — проверяем перед расчётом окон
    const owner = readCore().staff.find((s) => s.id === q.staffId)?.businessId;
    if (owner) await releaseExpiredPrepayments(owner);
    const core = readCore();
    const slots = computeFreeSlots(core, {
      staffId: q.staffId,
      date: q.date,
      durationMin: q.durationMin,
      durationMax: q.durationMax,
      serviceId: q.serviceId,
      locationId: q.locationId,
    });
    return filterByWorkplace(filterByTravelBuffer(slots, core, q.staffId, q.date), q.workplace);
  });
}

export interface NearestAvailableOptions {
  /** См. `WidgetSlotQuery.slug` — только для `api` */
  slug?: Id;
  durationMax?: number;
  serviceId?: Id;
  locationId?: Id;
  workplace?: Workplace;
  maxDays?: number;
}

/** Ближайший день с окнами вперёд — F-03-085 «Ближайшая доступная дата» */
export function getNearestAvailableDate(staffId: Id, durationMin: number, from: ISODate, opts: NearestAvailableOptions = {}): Promise<ISODate | undefined> {
  if (isApiMode() && opts.slug) return OnlineServer.getNearestAvailableDateServer(opts.slug, staffId, durationMin, from, opts);
  return request(() => {
    const core = readCore();
    let cursor = from;
    for (let i = 0; i < (opts.maxDays ?? 60); i++) {
      const slots = filterByWorkplace(
        filterByTravelBuffer(
          computeFreeSlots(core, { staffId, date: cursor, durationMin, durationMax: opts.durationMax, serviceId: opts.serviceId, locationId: opts.locationId }),
          core,
          staffId,
          cursor,
        ),
        opts.workplace,
      );
      if (slots.length > 0) return cursor;
      cursor = toISODate(new Date(new Date(cursor).getTime() + 86400000));
    }
    return undefined;
  });
}

export interface MonthAvailabilityOptions {
  /** См. `WidgetSlotQuery.slug` — только для `api` */
  slug?: Id;
  durationMax?: number;
  serviceId?: Id;
  locationId?: Id;
  workplace?: Workplace;
}

/** Есть ли окна в каждый день видимого месяца — для серых/жирных дней календаря (F-03-084) */
export function getMonthAvailability(
  staffId: Id,
  durationMin: number,
  monthStart: ISODate,
  opts: MonthAvailabilityOptions = {},
): Promise<Record<ISODate, boolean>> {
  if (isApiMode() && opts.slug) return OnlineServer.getMonthAvailabilityServer(opts.slug, staffId, durationMin, monthStart, opts);
  return request(() => {
    const core = readCore();
    const start = new Date(monthStart);
    const out: Record<ISODate, boolean> = {};
    for (let i = 0; i < 42; i++) {
      const d = toISODate(new Date(start.getTime() + i * 86400000));
      if (d.slice(0, 7) !== monthStart.slice(0, 7)) continue;
      const slots = filterByWorkplace(
        filterByTravelBuffer(
          computeFreeSlots(core, { staffId, date: d, durationMin, durationMax: opts.durationMax, serviceId: opts.serviceId, locationId: opts.locationId }),
          core,
          staffId,
          d,
        ),
        opts.workplace,
      );
      out[d] = slots.length > 0;
    }
    return out;
  });
}

// ─────────────────────────── Лист ожидания из виджета (F-03-086, наше решение F-00-101/102) ───────────────────────────

export interface JoinWaitlistInput {
  businessId: Id;
  locationId?: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate;
  clientName: string;
  clientPhone: string;
  comment?: string;
}

/** Заявка листа → вид виджета («вы в листе ожидания на этот день») */
function widgetWaitlistView(e: BusinessWaitlistEntry, input: Pick<JoinWaitlistInput, 'staffId' | 'serviceId' | 'date'>): WaitlistRequest {
  return {
    id: e.id,
    businessId: e.businessId,
    ...(e.locationId ? { locationId: e.locationId } : {}),
    staffId: e.staffIds[0] ?? input.staffId,
    serviceId: e.serviceIds[0] ?? input.serviceId,
    date: input.date,
    clientName: e.clientName,
    clientPhone: e.clientPhone,
    ...(e.comment ? { comment: e.comment } : {}),
    status: e.closedBookingId ? 'booked' : 'pending',
    createdAt: e.createdAt,
  };
}

/**
 * Клиент сам встаёт в лист ожидания на пустой день или у занятого мастера (F-03-086, ⭐ F-00-101/102) — в ОДИН лист
 * ожидания бизнеса (resources.waitlist, владелец 30.09.2026): его видят /biz/waitlist и панель журнала, ему уходит
 * «Освободилось время». Тот же номер на тот же день и услугу второй раз не встаёт — вернём уже стоящую заявку.
 */
export function joinOnlineWaitlist(input: JoinWaitlistInput): Promise<WaitlistRequest> {
  if (isApiMode()) return OnlineServer.joinOnlineWaitlistServer(input);
  return request(() => {
    const normalizedPhone = normalizePhone(input.clientPhone);
    if (!normalizedPhone) throw new ApiError('invalid_phone', 'Проверьте номер телефона');
    if (!input.clientName.trim()) throw new ApiError('invalid_input', 'Укажите имя');
    const same = findSameWaitlistRequest(
      waitlistTx.entries(input.businessId),
      { businessId: input.businessId, staffId: input.staffId, serviceId: input.serviceId, date: input.date, phone: normalizedPhone },
      today(),
    );
    if (same) return widgetWaitlistView(same, input);
    const entry = waitlistTx.add(
      {
        businessId: input.businessId,
        locationId: input.locationId ?? '',
        clientName: input.clientName.trim(),
        clientPhone: normalizedPhone,
        serviceIds: [input.serviceId],
        staffIds: [input.staffId],
        wishes: wishesForDay(input.date),
        comment: input.comment,
      },
      { source: 'widget' },
    );
    return widgetWaitlistView(entry, input);
  });
}

/** Уже стоит ли этот номер в листе ожидания на этот день/услугу/мастера — не даём встать дважды */
export function findWaitlistEntry(businessId: Id, staffId: Id, serviceId: Id, date: ISODate, phone: string): Promise<WaitlistRequest | undefined> {
  // Сервер сам не ставит дважды (joinOnlineWaitlist вернёт уже стоящую заявку) — отдельной проверки там нет
  if (isApiMode()) return Promise.resolve(undefined);
  return request(() => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return undefined;
    const same = findSameWaitlistRequest(waitlistTx.entries(businessId), { businessId, staffId, serviceId, date, phone: normalizedPhone }, today());
    return same ? widgetWaitlistView(same, { staffId, serviceId, date }) : undefined;
  });
}

// ─────────────────────────── Создание записи из виджета (F-03-091…F-03-098, F-03-123, F-03-125, F-03-139) ───────────────────────────

export interface OnlineBookingLineInput {
  serviceId: Id;
}

export interface CreateOnlineBookingInput {
  /** `Business.slug` — только для `api` (сервер создаёт запись по слагу, F-03-134); мок его не читает */
  slug?: Id;
  businessId: Id;
  locationId: Id;
  staffId: Id;
  start: string;
  services: OnlineBookingLineInput[];
  clientName: string;
  clientPhone: string;
  /** Код, отправленный `sendOnlineBookingCode` (F-00-007, B2) — сервер проверяет его сам; мок не читает */
  code?: string;
  comment?: string;
  forWhom?: BookingForWhom;
  linkId?: Id;
  formId?: string;
  source: BookingSource;
  device: BookingDevice;
  /** Где оказывается услуга (F-00-073…081); нет поля — «в салоне» */
  workplace?: Workplace;
  visitDistrict?: DistrictId;
  visitAddress?: string;
  reminderMinutesBefore?: number;
  phoneVerified?: boolean;
  /** Мастера назначила система по режиму «Любой специалист» (F-03-069) */
  anySpecialist?: boolean;
  email?: string;
  lastName?: string;
  patronymic?: string;
  customFieldValues?: Record<string, string>;
  /**
   * О4 (цепочка разных мастеров подряд): вторая и следующие записи начинаются ровно в конце предыдущей, не по
   * сетке окон — проверяем «свободно ли это время» (isSlotFree), а не «есть ли такое окно». Только мок.
   */
  exactTime?: boolean;
  /** О4: общий id связанных записей цепочки (как у пакета) — «Вы записаны» покажет их вместе */
  chainGroupId?: Id;
  /** ⭐ Клиент выбрал «Оплатить всё сразу» вместо процента предоплаты мастера */
  payInFull?: boolean;
  /** ⭐ Допродажа: сопутствующие услуги и товары из карточки услуги (у цепочки — к последней части визита) */
  addOns?: BookingAddOns;
  /**
   * О28: клиент взял окно, которое мастер сам предложил вместо заявки («Другое время»): заявка с этим id (и хэшем её
   * ссылки) снимается, а новая запись не ждёт второго подтверждения — время мастер уже согласовал. Только мок: сервер
   * этих полей пока не принимает (online.server не передаёт).
   */
  replacesBookingId?: Id;
  replacesHash?: string;
  /** «Пригласи подругу»: код из личной ссылки (lib/referralCapture); сервер сам решает, привязать ли */
  referralCode?: string;
}

export interface OnlineBookingResult {
  booking: Booking;
  client: Client;
  accessHash: string;
}

/** Простой неугадываемый хэш для ссылки «моя запись без входа» (F-03-098) — только демо-стойкость */
function makeAccessHash(): string {
  return `${newId('h').slice(2)}${Math.random().toString(36).slice(2, 10)}`;
}

export interface SendOnlineCodeInput {
  slug: Id;
  phone: string;
  channel?: 'telegram' | 'whatsapp' | 'sms';
}

export type { OnlineCodeChannel, OnlineCodeSent } from '@/api/online.server';

/**
 * F-00-007, B2: код перед записью без входа — в `api` доставляет сервер в выбранный канал (Telegram / WhatsApp / SMS);
 * не доставил — сам шлёт в следующий включённый, ответ говорит куда.
 */
export function sendOnlineBookingCode(input: SendOnlineCodeInput): Promise<OnlineCodeSent> {
  if (isApiMode()) return OnlineServer.sendOnlineBookingCodeServer(input);
  return request(() => {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    // О9: код привязан к номеру, на который ушёл; запись сверяет пару «номер + код»
    const phone = normalizePhone(input.phone);
    if (phone) sentDemoCodes.set(phone, code);
    return { demoCode: code, channel: input.channel ?? 'telegram', channels: ['telegram', 'whatsapp'] };
  });
}

/** О9 (мок): последний код, отправленный на номер. Сервер в режиме api хранит пару сам. */
const sentDemoCodes = new Map<string, string>();

/**
 * О14: вошедший в этом браузере клиент (или уже подтверждавший номер) не вводит код заново — только в моке;
 * в режиме api сервер требует код на каждую запись без входа (B2), поэтому поле кода остаётся.
 */
export function rememberedPhoneSkipsCode(): boolean {
  return !isApiMode();
}

/** «Записаться»: проверки, клиент по номеру, создание записи (F-03-093, F-03-125) */
export function createOnlineBooking(input: CreateOnlineBookingInput): Promise<OnlineBookingResult> {
  if (isApiMode() && input.slug) {
    if (!input.code) throw new ApiError('code_required', 'Подтвердите номер телефона кодом');
    return OnlineServer.createOnlineBookingServer(input.slug, input as CreateOnlineBookingInput & { code: string });
  }
  return request(async () => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === input.staffId);
    if (!staff) throw new ApiError('not_found', 'Мастер не найден');
    // ⭐ Допродажа: сопутствующие из карточки услуги — строками той же записи (upsellOf); мастер должен их делать,
    // окно ниже проверяется под общую длительность — как у любой записи из нескольких услуг
    const addOnLines = upsellServiceLinesTx(input.services.map((l) => l.serviceId), input.addOns?.serviceIds);
    const allLines: { serviceId: Id; upsellOf?: Id }[] = [...input.services.map((l) => ({ serviceId: l.serviceId })), ...addOnLines];
    const svcs = allLines.map((line) => {
      const svc = core.services.find((s) => s.id === line.serviceId);
      if (!svc) throw new ApiError('not_found', 'Услуга не найдена');
      if (line.upsellOf && !(svc.active && svc.onlineBookable && (svc.staffIds.includes(staff.id) || staff.serviceIds.includes(svc.id))))
        throw new ApiError('upsell_unavailable', 'Эту услугу нельзя добавить к записи');
      return svc;
    });
    const lines: BookingServiceLine[] = svcs.map((svc, i) => ({
      serviceId: svc.id,
      staffId: input.staffId,
      price: svc.priceMin,
      durationMin: svc.durationMin,
      qty: 1,
      ...(allLines[i].upsellOf ? { upsellOf: allLines[i].upsellOf } : {}),
    }));
    const durationMin = lines.reduce((sum, l) => sum + l.durationMin * l.qty, 0);
    // Верхняя граница «от–до» (F-00-057) — бронируем её, если у услуги задан диапазон
    const durationMax = svcs.reduce((sum, s) => sum + (s.durationMax ?? s.durationMin), 0);
    const date = toISODate(new Date(input.start));

    // Повторная проверка окна прямо перед созданием — F-03-093 «окно уже заняли»; F-00-080: тот же буфер
    // «время на дорогу» вокруг чужих выездов, что видел клиент в виджете, чтобы обход валидации на клиенте
    // не создал запись внутри чужого «на дороге».
    const free = filterByTravelBuffer(
      computeFreeSlots(core, {
        staffId: input.staffId,
        date,
        durationMin,
        durationMax: durationMax > durationMin ? durationMax : undefined,
        locationId: input.locationId,
        // Несколько услуг в одной записи — ресурс проверяем по первой (⭐ assumed, F-02-070 рассчитан на одну услугу за слот)
        serviceId: svcs[0]?.id,
      }),
      core,
      input.staffId,
      date,
    );
    const stillFree = input.exactTime
      ? isSlotFree(
          core,
          { staffId: input.staffId, start: input.start, durationMin: Math.max(durationMin, durationMax), bufferAfterMin: effectiveBufferMin(input.staffId, input.locationId), locationId: input.locationId },
          nowDateTime(),
        )
      : free.some((f) => f.start === input.start);
    if (!stillFree) throw new ApiError('slot_taken', 'Это время уже заняли — выберите другое');

    // ⭐ Наши решения перед созданием: пауза всей локации (F-03-142), «в отпуске» у мастера (F-03-142),
    // выезд — всегда с подтверждением (F-00-079).
    const businessRules = readArea('online').businessRules[input.businessId];
    if (businessRules?.pauseUntil && businessRules.pauseUntil >= date) {
      throw new ApiError('online_paused', 'Онлайн-запись сейчас приостановлена');
    }
    const staffRules = readArea('online').staffRules[input.staffId] ?? { ...DEFAULT_STAFF_ONLINE_RULES };
    if (staffRules.vacationUntil && staffRules.vacationUntil >= date) {
      throw new ApiError('staff_on_vacation', 'Мастер сейчас в отпуске');
    }

    const normalizedPhone = normalizePhone(input.clientPhone);
    if (!normalizedPhone) throw new ApiError('invalid_phone', 'Проверьте номер телефона');

    // ⭐ Наше решение F-03-077: код при записи обязателен всегда — без подтверждённого номера запись не создаётся,
    // даже если клиент обошёл проверку на клиенте.
    if (!input.phoneVerified) throw new ApiError('phone_not_verified', 'Подтвердите номер телефона кодом');
    // О9: код сверяется с номером, на который он ушёл — сменили номер после кода, старый код не подходит
    if (input.code && sentDemoCodes.get(normalizedPhone) !== input.code) throw new ApiError('wrong_code', 'Код не подходит к этому номеру');

    let client = await findClientByPhone(input.businessId, normalizedPhone);
    // Запрет онлайн-записи конкретному клиенту (F-03-135) — ставит раздел clients через Client.blocked
    if (client?.blocked) throw new ApiError('client_blocked', 'Этому номеру закрыта онлайн-запись');
    if (!client) {
      client = await coreCreate('clients', {
        businessId: input.businessId,
        phone: normalizedPhone,
        name: input.clientName,
        gender: 'unknown',
        tags: [],
        noShowCount: 0,
        createdAt: nowDateTime(),
      });
    }

    // F-03-096: услуга «Запретить онлайн-запись без абонемента» — проверяем ПОСЛЕ поиска клиента (нужен номер),
    // до отметки предоплаты (1:1: для индивидуальных — либо предоплата, либо абонемент, не оба).
    // (добавлено проверкой 1): несколько услуг могут требовать РАЗНЫЕ абонементы — каждая проверяется своим
    // subscriptionPlanName, запись создаётся, только если у клиента есть все нужные.
    const serviceConfigs = readArea('online').serviceConfigs;
    const subscriptionOnlyServices = svcs.filter((s) => serviceConfigs[s.id]?.subscriptionOnly);
    let usedSubscription = false;
    for (const svc of subscriptionOnlyServices) {
      const check = await checkSubscriptionForService(input.businessId, normalizedPhone, serviceConfigs[svc.id]?.subscriptionPlanName);
      if (!check.valid) throw new ApiError('subscription_required', 'Абонемент не подходит или истёк');
      usedSubscription = true;
    }

    // F-00-065: у мастера «Только мои клиенты» чужой человек, пришедший по ссылке, может только подать
    // заявку — «свой» узнаётся по уже бывшей у него (не отменённой) записи именно к этому мастеру.
    const isOwnClientOfStaff =
      staff.calendarVisibility !== 'mine' ||
      core.bookings.some(
        (b) =>
          !b.deletedAt &&
          b.clientId === client.id &&
          b.staffId === staff.id &&
          b.status !== 'cancelled_by_client' &&
          b.status !== 'cancelled_by_master',
      );

    const workplace: Workplace = input.workplace ?? 'salon';
    // F-00-080: без выбранного района клиент вне зоны выезда не должен попасть в запись —
    // повторная проверка на сервере, чтобы обход клиентской валидации не создал такую запись.
    if (workplace === 'visit' && !input.visitDistrict) {
      throw new ApiError('visit_district_required', 'Выберите район выезда');
    }
    // Выезд — всегда ждёт подтверждения мастера, что бы ни было настроено в confirmMode (F-00-079)
    let status: BookingStatus =
      workplace === 'visit' || staff.confirmMode === 'manual' || !isOwnClientOfStaff ? 'awaiting_confirmation' : 'scheduled';
    // О28: окно из «Другое время» мастера — мастер уже согласен, второй раз заявку не шлём; исходную заявку снимем ниже
    const replaced = input.replacesBookingId ? core.bookings.find((b) => b.id === input.replacesBookingId) : undefined;
    const acceptsOffer = Boolean(
      replaced &&
        readArea('online').bookingMeta[replaced.id]?.accessHash === input.replacesHash &&
        replaced.status === 'awaiting_confirmation' &&
        replaced.staffId === input.staffId &&
        replaced.alternativeStarts?.includes(input.start),
    );
    if (acceptsOffer) status = 'scheduled';
    // О6: запомнить, что без предоплаты запись ждала бы мастера — после «Деньги пришли» она пойдёт к нему в «Заявки»
    const confirmAfterPayment = status === 'awaiting_confirmation';
    // F-00-097/F-03-094: ручная предоплата мастера — «сначала ручная по реквизитам», а не оба сразу с абонементом (1155)
    // ⭐ Мастер берёт предоплату только с тех, кто не приходил: счётчик у ЭТОГО мастера за период правила (В-07)
    const noShowRule = staff.prepayment?.onlyAfterNoShows ? normalizeNoShowRule(staff.prepayment.onlyAfterNoShows) : undefined;
    const clientNoShows = noShowRule
      ? recentNoShows(core.bookings, { staffId: staff.id, clientId: client.id, appUserId: client.appUserId, now: nowDateTime(), months: noShowRule.months })
      : 0;
    const need = usedSubscription ? undefined : prepaymentNeed(staff.prepayment, clientNoShows);
    const prepaymentRule = need ? staff.prepayment : undefined;
    // F-03-095: депозит — своя, необязательная-в-принципе политика, отдельная от F-03-094; действует,
    // только если мастер не потребовал полную предоплату и абонемент не покрыл запись. ⭐ Без эквайринга
    // депозит держится тем же ручным «ждёт предоплату», просто на частичную сумму; «гарантия картой» у
    // нас демо — не требует оплаты, поэтому статус записи не трогает.
    const depositRule = !usedSubscription && !prepaymentRule ? readArea('online').staffRules[input.staffId] : undefined;
    const depositAmount = depositRule?.depositPolicyKind === 'deposit' ? depositRule.depositAmount : undefined;
    if (prepaymentRule) status = 'awaiting_prepayment';
    else if (depositAmount) status = 'awaiting_prepayment';
    // F-00-080: доплата за выезд — часть суммы, которую хранит сама запись (отчёты, касса), не только
    // текст на шаге «Место». Кладём в первую строку услуг — своей строки под «доплату» у Booking нет.
    const travelFee = workplace === 'visit' ? (staffRules.travelFee ?? 0) : 0;
    const pricedLines: BookingServiceLine[] = travelFee && lines[0] ? [{ ...lines[0], price: lines[0].price + travelFee }, ...lines.slice(1)] : lines;
    const bookingTotal = pricedLines.reduce((sum, l) => sum + l.price * (l.qty ?? 1), 0);
    // «Всё сразу» — только при точной цене: у «от–до» итог станет известен на визите
    const payInFull = Boolean(input.payInFull) && hasExactPrice(svcs) && canPayInFull(staff.prepayment, bookingTotal);
    // F-16-011/012, data-f="F-03-137": по одному свободному экземпляру каждого ресурса, привязанного к записанным
    // услугам — повторная проверка прямо перед записью (обход клиентской валидации не должен занять чужой ресурс).
    const resourceIds = await pickFreeResourceInstances(
      input.businessId,
      svcs.map((s) => s.id),
      input.start,
      durationMin,
    );
    if (resourceIds === undefined) throw new ApiError('resource_unavailable', 'Ресурс, нужный для этой услуги, сейчас занят — выберите другое время');
    const booking = await createBooking({
      businessId: input.businessId,
      locationId: input.locationId,
      staffId: input.staffId,
      clientId: client.id,
      // Номер уже есть в приложении — запись сразу в «Моих записях» этого человека (иначе привяжется при входе)
      appUserId: client.appUserId ?? core.appUsers.find((u) => u.phone === normalizedPhone)?.id,
      start: input.start,
      durationMin,
      status,
      services: pricedLines,
      resourceIds,
      workplace,
      source: input.source,
      createdBy: 'client',
      forWhom: input.forWhom ?? 'self',
      // Имя, введённое клиентом в виджете, — на самой записи; карточку клиента (Client.name) не трогаем,
      // если она уже существовала (F-03-125: имя из виджета не перезаписывает имя, заданное мастером).
      visitorName: input.clientName,
      comment: input.comment,
      // F-03-069: метка «Специалист не важен» должна долетать до ядра (Журнал показывает/переназначает
      // по Booking.staffAssignment) — раньше жила только в срезе online.bookingMeta.
      staffAssignment: input.anySpecialist ? 'any' : 'specific',
      prepayment: prepaymentRule
        ? {
            amount: prepaymentAmount(prepaymentRule, bookingTotal, payInFull),
            paid: false,
            holdUntil: addMinutes(nowDateTime(), prepaymentRule.timeoutMin),
            ...(payInFull ? { full: true } : {}),
            ...(need?.reason === 'no_shows' ? { reason: 'no_shows' as const, noShows: need.noShows, months: need.months } : {}),
          }
        : depositAmount
          ? { amount: depositAmount, paid: false, holdUntil: addMinutes(nowDateTime(), 15) }
          : undefined,
    });
    // ⭐ Допродажа: товары — строки «товары визита» к оплате на месте (цена склада, остаток проверен)
    if (input.addOns?.productIds.length) {
      attachUpsellGoodsTx(
        booking.id,
        upsellGoodsLinesTx({
          businessId: input.businessId,
          locationId: booking.locationId,
          staffId: input.staffId,
          mainServiceIds: input.services.map((l) => l.serviceId),
          productIds: input.addOns.productIds,
        }),
      );
    }

    const accessHash = makeAccessHash();
    const meta: OnlineBookingMeta = {
      bookingId: booking.id,
      linkId: input.linkId,
      formId: input.formId,
      widgetGen: 'new',
      device: input.device,
      accessHash,
      reminderMinutesBefore: input.reminderMinutesBefore,
      phoneVerified: input.phoneVerified,
      visitAddress: workplace === 'visit' ? input.visitAddress : undefined,
      anySpecialist: input.anySpecialist,
      email: input.email,
      lastName: input.lastName,
      patronymic: input.patronymic,
      customFieldValues: input.customFieldValues,
      submittedAt: nowDateTime(),
      confirmAfterPayment: status === 'awaiting_prepayment' ? confirmAfterPayment : undefined,
      packageGroupId: input.chainGroupId,
    };
    mutateArea('online', (s) => {
      s.bookingMeta[booking.id] = meta;
    });
    logBookingStatus(booking.id, status, 'client');
    // О28: исходная заявка больше не нужна — у мастера не остаётся двух заявок на одного клиента
    if (acceptsOffer && replaced) {
      // Не «Отменил клиент», а «Перенесена на …» (решение 01.10): без неявки, с новым временем
      await updateBooking(replaced.id, { status: 'cancelled_by_client', cancelReason: 'rescheduled', rescheduledTo: booking.start, alternativeStarts: undefined });
      logBookingStatus(replaced.id, 'rescheduled', 'client');
      // Старая ссылка из переписки ведёт к новой записи, а не в тупик «Запись отменена»
      mutateArea('online', (st) => {
        const m = st.bookingMeta[replaced.id];
        // Только id и время: сырой токен новой ссылки в данных отменённой заявки не храним (final-fix 01.10) —
        // ссылку к новой записи собирает getOnlineBooking, когда клиент открыл старую по её же токену
        if (m) m.replacedBy = { bookingId: booking.id, start: booking.start };
      });
    }
    // Email — в карточку клиента (F-03-071); не затираем то, что уже было заполнено мастером.
    if (input.email && !client.email) {
      await coreUpdate('clients', client.id, { email: input.email });
    }
    // «Пригласи подругу»: пришла по личной ссылке — пригласившая запоминается на карточке (rules/referral)
    if (input.referralCode) attachReferralTx(input.businessId, client.id, input.referralCode, booking.id);

    return { booking, client, accessHash };
  });
}

/**
 * Пакет в режиме «последовательно несколькими мастерами» (F-03-130): создаёт по одной связанной записи
 * на каждую услугу пакета, друг за другом (следующая начинается сразу после конца предыдущей), помечает
 * все общим `packageGroupId`. Возвращает их в порядке создания — последняя удобна для редиректа на
 * «Вы записаны» (BookingConfirmedScreen сама подтягивает соседей по группе).
 */
export function createSequentialPackageBookings(
  base: Omit<CreateOnlineBookingInput, 'services' | 'staffId' | 'start'>,
  packageId: Id,
  assignments: { serviceId: Id; staffId: Id }[],
  firstStart: string,
): Promise<OnlineBookingResult[]> {
  return request(async () => {
    if (assignments.length === 0) throw new ApiError('not_found', 'В пакете нет услуг');
    const core = readCore();
    const groupId = newId('pkgb');
    const results: OnlineBookingResult[] = [];
    let start = firstStart;
    for (const a of assignments) {
      const svc = core.services.find((s) => s.id === a.serviceId);
      if (!svc) throw new ApiError('not_found', 'Услуга не найдена');
      const res = await createOnlineBooking({ ...base, services: [{ serviceId: a.serviceId }], staffId: a.staffId, start });
      mutateArea('online', (s) => {
        const meta = s.bookingMeta[res.booking.id];
        if (meta) {
          meta.packageId = packageId;
          meta.packageGroupId = groupId;
        }
      });
      results.push(res);
      start = addMinutes(start, svc.durationMax ?? svc.durationMin);
    }
    return results;
  });
}

/** Записи той же группы пакета (F-03-130) — для показа «связанные записи» на «Вы записаны» */
export function listPackageGroupBookings(groupId: Id): Promise<Booking[]> {
  return request(() => {
    const online = readArea('online');
    const ids = Object.values(online.bookingMeta)
      .filter((m) => m.packageGroupId === groupId)
      .map((m) => m.bookingId);
    return readCore().bookings.filter((b) => ids.includes(b.id)).sort((a, b) => a.start.localeCompare(b.start));
  });
}

/** Данные источника записи для вклада bookingWindow (F-03-123, F-03-139) */
export function getBookingMeta(bookingId: Id): Promise<OnlineBookingMeta | undefined> {
  if (isApiMode()) return OnlineServer.getBookingMetaServer(bookingId);
  return request(() => readArea('online').bookingMeta[bookingId]);
}

export interface OnlineBookingView {
  booking: Booking;
  business: Business;
  location: Location | undefined;
  staff: Staff | undefined;
  services: Service[];
  meta: OnlineBookingMeta | undefined;
  /** F-03-116: формат времени локации — чтобы экран показывал время так, как настроил бизнес */
  hourCycle: '24' | '12';
  /** ⭐ Допродажа: товары визита к оплате на месте */
  goods?: { name: LocalizedText; price: number; qty: number }[];
}

/** Запись по ссылке без входа (F-03-098) — только по правильному хэшу, иначе «не найдено» */
export function getOnlineBooking(bookingId: Id, hash: string): Promise<OnlineBookingView> {
  if (isApiMode()) return OnlineServer.getOnlineBookingServer(bookingId, hash);
  return request(async () => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    // Клиент открыл свою запись — сначала снять просроченное (В-03: заявка без ответа мастера → 3 окна), как сервер
    const own = readCore().bookings.find((b) => b.id === bookingId);
    if (own) await releaseExpiredPrepayments(own.businessId);
    const booking = await coreGet('bookings', bookingId);
    const core = readCore();
    const business = core.businesses.find((b) => b.id === booking.businessId);
    if (!business) throw new ApiError('not_found', 'Бизнес не найден');
    const location = core.locations.find((l) => l.id === booking.locationId);
    const staff = core.staff.find((s) => s.id === booking.staffId);
    const services = booking.services.map((line) => core.services.find((s) => s.id === line.serviceId)).filter((s): s is Service => Boolean(s));
    const hourCycle = sharedHourCycle(readArea('online').businessRules[booking.businessId]?.hourCycle);
    const replacedHash = meta.replacedBy ? readArea('online').bookingMeta[meta.replacedBy.bookingId]?.accessHash : undefined;
    const shownMeta = meta.replacedBy ? { ...meta, replacedBy: { ...meta.replacedBy, hash: replacedHash } } : meta;
    // ⭐ Допродажа: товары визита (название для клиента, цена строки, количество)
    const stockGoods = readArea('stock').goods;
    const goods = (readArea('journal').extras[booking.id]?.goodsLines ?? []).flatMap((g) => {
      const p = stockGoods.find((x) => x.id === g.itemId);
      return p ? [{ name: p.clientName?.ru ? p.clientName : { ru: p.name }, price: g.price, qty: Math.max(1, g.qty || 1) }] : [];
    });
    return { booking, business, location, staff, services, meta: shownMeta, hourCycle, ...(goods.length ? { goods } : {}) };
  });
}

// ─────────────────────────── Места работы и выезд (F-00-073…081) ───────────────────────────

export interface PlacesData {
  staff: Staff;
  location: Location | undefined;
  rules: StaffOnlineRules;
}

export function getPlacesData(staffId: Id, locationId: Id | undefined): Promise<PlacesData> {
  if (isApiMode()) return OnlineServer.getPlacesDataServer(staffId, locationId);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    if (!staff) throw new ApiError('not_found', 'Мастер не найден');
    const location = core.locations.find((l) => l.id === (locationId ?? staff.locationIds[0]));
    const rules = readArea('online').staffRules[staffId] ?? { staffId, ...DEFAULT_STAFF_ONLINE_RULES };
    return { staff, location, rules };
  });
}

/** Места работы мастера: салон / дома / выезд / зал / онлайн (F-00-073, F-00-077, F-00-078) */
export function updateStaffPlaces(
  staffId: Id,
  patch: Partial<Pick<Staff, 'workplaces' | 'homeAddress' | 'homeDistrict' | 'visitDistricts'>>,
): Promise<Staff> {
  return coreUpdate('staff', staffId, patch);
}

/** Ссылка на Яндекс Карты и точка «я сейчас на месте» (F-00-074, F-00-075) и район филиала (F-00-076) */
export function updateLocationPlace(
  locationId: Id,
  patch: Partial<Pick<Location, 'yandexMapsUrl' | 'coords' | 'district'>>,
): Promise<Location> {
  return coreUpdate('locations', locationId, patch);
}

// ─────────────────────────── Правила мастера и локации (F-00-066/067, F-03-066/067, F-03-079/142) ───────────────────────────

/** Правила мастера — есть всегда: если записи в срезе нет, отдаём дефолты (F-00-066) */
export function getStaffRules(staffId: Id): Promise<StaffOnlineRules> {
  if (isApiMode()) return OnlineServer.getStaffRulesServer(staffId);
  return request(() => readArea('online').staffRules[staffId] ?? { staffId, ...DEFAULT_STAFF_ONLINE_RULES });
}

export function listStaffRules(staffIds: Id[]): Promise<Record<Id, StaffOnlineRules>> {
  if (isApiMode()) {
    return Promise.all(staffIds.map((id) => OnlineServer.getStaffRulesServer(id))).then((rows) => {
      const out: Record<Id, StaffOnlineRules> = {};
      staffIds.forEach((id, i) => (out[id] = rows[i]!));
      return out;
    });
  }
  return request(() => {
    const stored = readArea('online').staffRules;
    const out: Record<Id, StaffOnlineRules> = {};
    staffIds.forEach((id) => {
      out[id] = stored[id] ?? { staffId: id, ...DEFAULT_STAFF_ONLINE_RULES };
    });
    return out;
  });
}

/**
 * F-00-066/067, F-03-066/067 (e2e-q2 №1): срок отмены/переноса раньше жил ТОЛЬКО в срезе online и не был
 * виден журналу и приложению клиента, у которых свои проверки читают `Staff.bookingRules` ядра. Пишем в оба
 * места одним запросом: своё (депозит, выезд, отпуск — их в ядре нет) и зеркало в `Staff.bookingRules` того,
 * что ядро уже умеет проверять само (rules/booking-policy).
 */
export function updateStaffRules(staffId: Id, patch: Partial<Omit<StaffOnlineRules, 'staffId'>>): Promise<StaffOnlineRules> {
  if (isApiMode()) return OnlineServer.updateStaffRulesServer(staffId, patch);
  return request(() => {
    let updated: StaffOnlineRules | undefined;
    mutateArea('online', (s) => {
      const current = s.staffRules[staffId] ?? { staffId, ...DEFAULT_STAFF_ONLINE_RULES };
      updated = { ...current, ...patch };
      s.staffRules[staffId] = updated;
    });
    const next = updated!;
    // Синхронно, в этом же request() (arch-a1 №1) — не звать coreGet/coreUpdate (свой request() = своя
    // задержка и снапшот, нельзя вкладывать).
    const staff = coreTx.get('staff', staffId);
    coreTx.update('staff', staffId, {
      bookingRules: {
        ...staff.bookingRules,
        allowCancel: next.allowCancel ?? true,
        allowReschedule: next.allowReschedule ?? true,
        cancelWindowMin: next.cancelWindowHours * 60,
        rescheduleWindowMin: next.rescheduleWindowHours * 60,
        allowCancelPrepaid: next.allowCancelPrepaid ?? true,
        allowReschedulePrepaid: next.allowReschedulePrepaid ?? false,
        keepPrepaymentOnLateCancel: next.keepPrepaymentOnLateCancel ?? true,
      },
    });
    return next;
  });
}

export function getBusinessRules(businessId: Id): Promise<BusinessOnlineRules> {
  if (isApiMode()) return OnlineServer.getBusinessRulesServer();
  return request(() => readArea('online').businessRules[businessId] ?? { businessId, consentText: DEFAULT_CONSENT_TEXT });
}

export function updateBusinessRules(businessId: Id, patch: Partial<Omit<BusinessOnlineRules, 'businessId'>>): Promise<BusinessOnlineRules> {
  if (isApiMode()) return OnlineServer.updateBusinessRulesServer(patch);
  return request(() => {
    let updated: BusinessOnlineRules | undefined;
    mutateArea('online', (s) => {
      const current = s.businessRules[businessId] ?? { businessId, consentText: DEFAULT_CONSENT_TEXT };
      updated = { ...current, ...patch };
      s.businessRules[businessId] = updated;
    });
    return updated!;
  });
}

/**
 * Поля сети, которые показываются в виджете этой локации (F-03-074): сначала общие поля бизнеса
 * (F-03-071…073), затем — сетевые, отмеченные «в виджете» и включающие эту локацию в свой список.
 * Кабинет сети пока не даёт их создавать (см. qa/requests/online.md) — читаем демо-набор из среза.
 */
export function getWidgetExtraFields(locationId: Id | undefined): Promise<CustomClientField[]> {
  // Стадия 21 (лейн client+online): кабинет сети пока не даёт создавать сетевые поля НИГДЕ, даже в моке (см.
  // докстринг NetworkExtraField) — на сервере их взять неоткуда, поэтому api-режим честно отдаёт пусто вместо
  // выдуманного стенд-ина; когда раздел network заведёт создание — здесь появится настоящий запрос.
  if (isApiMode()) return Promise.resolve([]);
  return request(() => {
    if (!locationId) return [];
    const core = readCore();
    const business = core.businesses.find((b) => b.locationIds.includes(locationId));
    if (!business?.networkId) return [];
    const fields = readArea('online').networkExtraFields[business.networkId] ?? [];
    return fields
      .filter((f): f is NetworkExtraField => f.showInWidget && f.locationIds.includes(locationId))
      .map(({ locationIds: _locationIds, showInWidget: _showInWidget, apiKey: _apiKey, editableByUser: _editableByUser, showInAdminUi: _showInAdminUi, alwaysShowInEditWindow: _alwaysShowInEditWindow, requiredOnArrived: _requiredOnArrived, ...field }) => field);
  });
}

// ─────────────────────────── Экран данных клиента (F-03-071…075, F-03-104) ───────────────────────────

export function getClientFieldsConfig(businessId: Id): Promise<ClientFieldsConfig> {
  if (isApiMode()) return OnlineServer.getClientFieldsConfigServer();
  return request(() => readArea('online').clientFields[businessId] ?? { businessId, ...DEFAULT_CLIENT_FIELDS });
}

/**
 * Ответы клиента на свои поля с «Сохранять в карточку: Карточка клиента» (F-03-073) — последнее
 * заполненное значение по каждому такому полю среди всех записей клиента по всем бизнесам, где он
 * записывался онлайн. Карточка клиента показывает их вкладом src/areas/online/extensions/ClientCard.tsx.
 */
export function getClientCustomFieldAnswers(clientId: Id): Promise<{ label: string; value: string }[]> {
  if (isApiMode()) return OnlineServer.getClientCustomFieldAnswersServer(clientId);
  return request(async () => {
    const core = readCore();
    const bookings = core.bookings
      .filter((b) => b.clientId === clientId)
      .sort((a, b) => (a.start < b.start ? 1 : -1));
    const area = readArea('online');
    const byField = new Map<string, string>();
    for (const booking of bookings) {
      const meta = area.bookingMeta[booking.id];
      if (!meta?.customFieldValues) continue;
      const config = area.clientFields[booking.businessId] ?? { businessId: booking.businessId, ...DEFAULT_CLIENT_FIELDS };
      for (const field of config.customFields) {
        if (field.target !== 'client') continue;
        const value = meta.customFieldValues[field.id];
        if (value && !byField.has(field.label)) byField.set(field.label, value);
      }
    }
    return [...byField.entries()].map(([label, value]) => ({ label, value }));
  });
}

export function updateClientFieldsConfig(
  businessId: Id,
  patch: Partial<Omit<ClientFieldsConfig, 'businessId'>>,
): Promise<ClientFieldsConfig> {
  if (isApiMode()) return OnlineServer.updateClientFieldsConfigServer(patch);
  return request(() => {
    let updated: ClientFieldsConfig | undefined;
    mutateArea('online', (s) => {
      const current = s.clientFields[businessId] ?? { businessId, ...DEFAULT_CLIENT_FIELDS };
      updated = { ...current, ...patch };
      s.clientFields[businessId] = updated;
    });
    return updated!;
  });
}

/** «+ Добавить поле» (F-03-073) */
export function addCustomClientField(businessId: Id, field: Omit<CustomClientField, 'id' | 'order'>): Promise<ClientFieldsConfig> {
  if (isApiMode()) return OnlineServer.addCustomClientFieldServer(field);
  return request(() => {
    let updated: ClientFieldsConfig | undefined;
    mutateArea('online', (s) => {
      const current = s.clientFields[businessId] ?? { businessId, ...DEFAULT_CLIENT_FIELDS };
      const next: CustomClientField = { ...field, id: newId('cf'), order: current.customFields.length };
      updated = { ...current, customFields: [...current.customFields, next] };
      s.clientFields[businessId] = updated;
    });
    return updated!;
  });
}

export function removeCustomClientField(businessId: Id, fieldId: Id): Promise<ClientFieldsConfig> {
  if (isApiMode()) return OnlineServer.removeCustomClientFieldServer(fieldId);
  return request(() => {
    let updated: ClientFieldsConfig | undefined;
    mutateArea('online', (s) => {
      const current = s.clientFields[businessId] ?? { businessId, ...DEFAULT_CLIENT_FIELDS };
      updated = { ...current, customFields: current.customFields.filter((f) => f.id !== fieldId) };
      s.clientFields[businessId] = updated;
    });
    return updated!;
  });
}

/** Перестановка своих полей (перетаскивание, F-03-073): direction -1 — вверх, +1 — вниз */
export function moveCustomClientField(businessId: Id, fieldId: Id, direction: -1 | 1): Promise<ClientFieldsConfig> {
  if (isApiMode()) return OnlineServer.moveCustomClientFieldServer(fieldId, direction);
  return request(() => {
    let updated: ClientFieldsConfig | undefined;
    mutateArea('online', (s) => {
      const current = s.clientFields[businessId] ?? { businessId, ...DEFAULT_CLIENT_FIELDS };
      const list = [...current.customFields].sort((a, b) => a.order - b.order);
      const i = list.findIndex((f) => f.id === fieldId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= list.length) {
        updated = current;
      } else {
        [list[i], list[j]] = [list[j], list[i]];
        const reordered = list.map((f, idx) => ({ ...f, order: idx }));
        updated = { ...current, customFields: reordered };
      }
      s.clientFields[businessId] = updated;
    });
    return updated!;
  });
}

// ─────────────────────────── Пустые профили в каталоге (F-00-072) ───────────────────────────

export interface ListableCheck {
  listable: boolean;
  missing: ('services' | 'photo' | 'schedule')[];
}

/** ⭐ «пустой» профиль не показываем клиентам: нет онлайн-услуг, фото или графика (F-00-072, assumed) */
export function isListable(staff: Staff, services: Service[], hasSchedule: boolean): ListableCheck {
  const own = services.filter((s) => staff.serviceIds.includes(s.id) && s.active && s.onlineBookable);
  const missing: ListableCheck['missing'] = [];
  if (own.length === 0) missing.push('services');
  if (!staff.avatarUrl && staff.photos.length === 0) missing.push('photo');
  if (!hasSchedule) missing.push('schedule');
  return { listable: missing.length === 0, missing };
}

export function getBusinessListability(businessId: Id): Promise<{ staff: Staff; check: ListableCheck }[]> {
  if (isApiMode()) return OnlineServer.getBusinessListabilityServer();
  return request(() => {
    const core = readCore();
    const services = core.services.filter((s) => s.businessId === businessId);
    return core.staff
      .filter((s) => s.businessId === businessId && s.status === 'active')
      .map((s) => {
        const hasSchedule = core.schedules.some((sch) => sch.staffId === s.id);
        return { staff: s, check: isListable(s, services, hasSchedule) };
      });
  });
}

// ─────────────────────────── Публикация нового бизнеса (F-03-001, сц. 5 полного теста) ───────────────────────────

export interface OnlineReadiness {
  /** Статус бизнеса: 'draft' — страница ещё не открыта клиентам («Онлайн-запись скоро откроется») */
  status: Business['status'];
  /** Сколько мастеров клиент сможет выбрать онлайн (активен, есть онлайн-услуги и график) */
  bookableCount: number;
  /** Приглашённые мастера, которые ещё не приняли приглашение — онлайн к ним записаться нельзя, пока не примут */
  invitedNames: string[];
}

/** Готова ли онлайн-запись к открытию: статус, к кому можно записаться, кто ещё не принял приглашение */
export async function getOnlineReadiness(businessId: Id): Promise<OnlineReadiness> {
  const [businesses, staff, services, schedules] = await Promise.all([
    coreList('businesses', { id: businessId }),
    coreList('staff', (s) => s.businessId === businessId),
    coreList('services', (s) => s.businessId === businessId),
    coreList('schedules'),
  ]);
  const staffIds = new Set(staff.map((st) => st.id));
  const withSchedule = new Set(schedules.filter((sch) => staffIds.has(sch.staffId)).map((sch) => sch.staffId));
  return {
    status: businesses[0]?.status ?? 'active',
    bookableCount: staff.filter((st) => isStaffOnlineVisible(st, services, withSchedule.has(st.id))).length,
    invitedNames: staff.filter((st) => st.status === 'invited').map((st) => st.name),
  };
}

export type StaffHiddenReason = 'disabled' | 'noSchedule' | 'noServices';

/**
 * Почему активного сотрудника не видно клиентам в онлайн-записи (то же правило, что isStaffOnlineVisible): онлайн
 * выключен в карточке сотрудника, нет графика, нет услуг с онлайн-записью. Пустой список — виден.
 */
export async function getStaffHiddenReasons(businessId: Id): Promise<Record<Id, StaffHiddenReason[]>> {
  const [staff, services, schedules] = await Promise.all([
    coreList('staff', (s) => s.businessId === businessId && s.status === 'active'),
    coreList('services', (s) => s.businessId === businessId),
    coreList('schedules'),
  ]);
  const out: Record<Id, StaffHiddenReason[]> = {};
  for (const st of staff) {
    const reasons: StaffHiddenReason[] = [];
    if (st.onlineBookingEnabled === false) reasons.push('disabled');
    if (!schedules.some((sch) => sch.staffId === st.id)) reasons.push('noSchedule');
    if (!services.some((sv) => st.serviceIds.includes(sv.id) && sv.active && sv.onlineBookable)) reasons.push('noServices');
    out[st.id] = reasons;
  }
  return out;
}

/**
 * «Опубликовать» (сц. 5): новый бизнес из черновика открывается клиентам — как после регистрации (api/client
 * registerBusiness ставит 'active'). «Заморожен» и «на проверке» решаем мы в своей панели, отсюда их не снять.
 * В api бизнес создаётся сразу активным — черновиков там нет, кнопка не показывается.
 */
export function publishBusiness(businessId: Id): Promise<Business> {
  if (isApiMode()) return Promise.reject(new ApiError('not_allowed', 'В api бизнес открыт с регистрации'));
  return request(() => {
    const business = coreTx.get('businesses', businessId);
    if (business.status !== 'draft') throw new ApiError('invalid_transition', 'Опубликовать можно только черновик');
    return coreTx.update('businesses', businessId, { status: 'active' });
  });
}

// ─────────────────────────── Очередь заявок (F-00-067, F-00-071, F-03-127) ───────────────────────────

/**
 * Заявки, ждущие подтверждения мастера — созданные онлайн (link/widget), включая выезд (F-00-079).
 * `staffId` фильтрует, чьи заявки вернуть (не задан — все, как видит владелец/админ с `online.manage`).
 *
 * F-00-080: «адрес клиента видит только мастер, только после подтверждения» — эта очередь целиком состоит
 * из ЕЩЁ НЕ подтверждённых заявок, так что точный адрес здесь не отдаём НИКОМУ, даже своему мастеру
 * (до решения он видит только район — этого достаточно, чтобы понять, ехать в принципе туда или нет;
 * точный дом/подъезд открывается в окне записи журнала сразу после «Подтвердить», см. respondToRequest).
 */
export function listOnlineRequests(businessId: Id, staffId?: Id, _viewerStaffId?: Id): Promise<OnlineRequestView[]> {
  if (isApiMode()) return OnlineServer.listOnlineRequestsServer(staffId);
  return request(() => {
    const core = readCore();
    const meta = readArea('online').bookingMeta;
    const bookings = core.bookings.filter((b) => isOnlineRequest(b, meta) && b.businessId === businessId && (!staffId || b.staffId === staffId));
    return bookings
      .map((b): OnlineRequestView => {
        const client = core.clients.find((c) => c.id === b.clientId);
        const location = core.locations.find((l) => l.id === b.locationId);
        return {
          bookingId: b.id,
          staffId: b.staffId,
          clientId: b.clientId,
          clientName: b.visitorName || client?.name || '—',
          clientPhone: client?.phone ?? '',
          clientNoShowCount: client?.noShowCount ?? 0,
          clientBlocked: client?.blocked ?? false,
          start: b.start,
          durationMin: b.durationMin,
          serviceNames: b.services
            .map((line) => core.services.find((sv) => sv.id === line.serviceId)?.name.ru)
            .filter((n): n is string => Boolean(n)),
          workplace: b.workplace,
          district: b.workplace === 'visit' ? location?.district : undefined,
          // F-00-080: точный адрес не отдаём в заявке — только после подтверждения (см. докстринг функции)
          address: undefined,
          submittedAt: meta[b.id]?.submittedAt,
          // О28: «новый / был N раз» — прошедшие визиты этого клиента в бизнесе
          clientVisits: b.clientId
            ? core.bookings.filter((x) => !x.deletedAt && x.id !== b.id && x.clientId === b.clientId && x.businessId === businessId && x.status === 'arrived').length
            : 0,
          comment: b.comment,
          prepaymentNoShows:
            b.status === 'awaiting_prepayment' && b.prepayment?.reason === 'no_shows'
              ? { noShows: b.prepayment.noShows ?? 0, months: b.prepayment.months ?? 12 }
              : undefined,
          prepaymentReported:
            b.status === 'awaiting_prepayment' && meta[b.id]?.prepaymentReportedAt
              ? { amount: b.prepayment?.amount ?? 0, at: meta[b.id]!.prepaymentReportedAt! }
              : undefined,
          offeredStarts: meta[b.id]?.offeredStarts,
        };
      })
      // Очередь: кто ждёт дольше — выше (F-00-067), без submittedAt (старые демо) — по времени начала записи
      .sort((a, b) => (a.submittedAt ?? a.start).localeCompare(b.submittedAt ?? b.start));
  });
}

/** Заявок, ждущих подтверждения мастера — для счётчика в меню и (когда фундамент отдаст inbox) в колокольчике (F-00-067) */
export function countPendingRequests(businessId: Id, staffId?: Id): Promise<number> {
  if (isApiMode()) return OnlineServer.countPendingRequestsServer(staffId);
  return request(() => {
    const core = readCore();
    const meta = readArea('online').bookingMeta;
    return core.bookings.filter((b) => isOnlineRequest(b, meta) && b.businessId === businessId && (!staffId || b.staffId === staffId)).length;
  });
}

/**
 * Что попадает в «Заявки»: онлайн-запись ждёт мастера (awaiting_confirmation) ИЛИ клиент сообщил об оплате и
 * салон должен сверить деньги (awaiting_prepayment + prepaymentReportedAt, О6).
 */
function isOnlineRequest(b: Booking, meta: Record<Id, OnlineBookingMeta>): boolean {
  if (b.deletedAt) return false;
  const reportedPaid = b.status === 'awaiting_prepayment' && Boolean(meta[b.id]?.prepaymentReportedAt) && !b.prepayment?.paid;
  // В-05: запись из приложения клиента тоже ждёт сверки «Деньги пришли» (client.markPrepaymentPaid) — только эта часть;
  // её заявки на подтверждение мастер видит в журнале («Требует внимания»)
  if (b.source === 'app') return reportedPaid;
  if (b.source !== 'link' && b.source !== 'widget') return false;
  return b.status === 'awaiting_confirmation' || reportedPaid;
}

/**
 * ⭐ F-00-097: предоплата мастера процентом (Staff.prepayment) — своя настройка мастера в «Правилах записи».
 * undefined — мастер выключил предоплату. В `api` — PATCH сотрудника (null снимает правило).
 */
export function saveStaffPrepayment(staffId: Id, rule: PrepaymentRule | undefined): Promise<Staff> {
  if (isApiMode()) return StaffServer.patchStaff(staffId, { prepayment: rule ?? null });
  return coreUpdate('staff', staffId, { prepayment: rule });
}

/**
 * О6 «Деньги пришли»: салон сверил предоплату, о которой сообщил клиент. Запись становится подтверждённой —
 * или идёт мастеру на подтверждение, если без предоплаты она бы его ждала (meta.confirmAfterPayment).
 * В `api` — POST …/prepayment-received (bookings.service prepaymentReceived).
 */
export function confirmPrepaymentReceived(bookingId: Id): Promise<Booking> {
  // Сервер: та же отметка, что «Предоплата получена» в журнале — статус, снятие удержания, строка оплаты
  if (isApiMode()) return JournalServer.prepaymentReceived(bookingId);
  return request(async () => {
    const booking = await coreGet('bookings', bookingId);
    if (booking.status !== 'awaiting_prepayment' || !booking.prepayment) throw new ApiError('not_awaiting_prepayment', 'Эта запись не ждёт предоплату');
    const meta = readArea('online').bookingMeta[bookingId];
    const status: BookingStatus = meta?.confirmAfterPayment ? 'awaiting_confirmation' : 'scheduled';
    // В-03: срок ответа мастера ядро (txUpdateBooking) отсчитывает от этого момента, а не от создания заявки
    const updated = await updateBooking(bookingId, { prepayment: { ...booking.prepayment, paid: true }, status });
    // Как на сервере: полученная предоплата — строка оплаты визита в журнале, на визите берут только остаток
    recordPrepaymentLineSync(bookingId, booking.prepayment.amount);
    // Решение владельца 01.10.2026: полученная предоплата — своя операция в финансах (приход «перевод на реквизиты»)
    recordPrepaymentReceivedSync(bookingId);
    logBookingStatus(bookingId, status, 'staff');
    if (status === 'scheduled') broadcastBookingDecision({ bookingId, status });
    return updated;
  });
}

/**
 * О28 «Другое время»: ближайшие свободные окна того же мастера на ту же длительность (до `limit`), начиная
 * с дня заявки — мастер выбирает 2–3 и отправляет клиенту (`offerOtherTimes`).
 */
export function suggestOtherTimes(bookingId: Id, limit = 6): Promise<ISODateTime[]> {
  if (isApiMode()) return OnlineServer.suggestOtherTimesServer(bookingId, limit);
  return request(() => {
    const core = readCore();
    const b = core.bookings.find((x) => x.id === bookingId);
    if (!b) throw new ApiError('not_found', 'Запись не найдена');
    const out: ISODateTime[] = [];
    let cursor = today() > b.start.slice(0, 10) ? today() : b.start.slice(0, 10);
    for (let i = 0; i < 14 && out.length < limit; i++) {
      const slots = computeFreeSlots(core, { staffId: b.staffId, date: cursor, durationMin: b.durationMin, locationId: b.locationId, serviceId: b.services[0]?.serviceId });
      for (const sl of slots) {
        if (sl.start === b.start || sl.start < nowDateTime()) continue;
        // не больше двух окон в день — клиенту нужен выбор по дням, а не 6 соседних четвертей часа
        if (out.filter((x) => x.slice(0, 10) === cursor).length >= 2) break;
        out.push(sl.start);
        if (out.length >= limit) break;
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  });
}

/** О28: отправить клиенту выбранные окна вместо запрошенного времени (демо — сохраняем предложение у записи) */
export function offerOtherTimes(bookingId: Id, starts: ISODateTime[]): Promise<ISODateTime[]> {
  if (isApiMode()) return OnlineServer.offerOtherTimesServer(bookingId, starts);
  return request(() => {
    if (starts.length === 0) throw new ApiError('invalid_input', 'Выберите хотя бы одно окно');
    // Как сервер: предлагать можно только свободное окно в графике мастера (final-fix 01.10) — иначе клиент нажимал
    // окно и получал «Это время уже заняли»
    const core = readCore();
    const b = core.bookings.find((x) => x.id === bookingId);
    if (!b) throw new ApiError('not_found', 'Запись не найдена');
    for (const start of starts.slice(0, 3)) {
      const free = start >= nowDateTime() && computeFreeSlots(core, { staffId: b.staffId, date: start.slice(0, 10), durationMin: b.durationMin, locationId: b.locationId, serviceId: b.services[0]?.serviceId }).some((sl) => sl.start === start);
      if (!free) throw new ApiError('slot_taken', 'Это время занято или вне графика мастера');
    }
    mutateArea('online', (s) => {
      const m = s.bookingMeta[bookingId];
      if (m) m.offeredStarts = starts.slice(0, 3);
    });
    // Клиент видит предложенные окна кнопками на странице записи и в приложении (Booking.alternativeStarts)
    coreTx.updateBooking(bookingId, { alternativeStarts: starts.slice(0, 3) });
    logBookingStatus(bookingId, 'time_offered', 'staff');
    return starts.slice(0, 3);
  });
}

/** История смены статуса записи (F-00-068) — своя, пока в ядре Booking нет createdAt/лога переходов */
function logBookingStatus(bookingId: Id, status: string, by: 'client' | 'staff'): void {
  mutateArea('online', (s) => {
    const log = s.bookingStatusLog[bookingId] ?? [];
    s.bookingStatusLog[bookingId] = [...log, { status, at: nowDateTime(), by }];
  });
}

export function getBookingStatusLog(bookingId: Id): Promise<{ status: string; at: string; by: 'client' | 'staff' }[]> {
  if (isApiMode()) return OnlineServer.getBookingStatusLogServer(bookingId);
  return request(() => readArea('online').bookingStatusLog[bookingId] ?? []);
}

/**
 * Подтвердить/отклонить заявку одним нажатием (F-00-067). «Клиент получает пуш о решении» (fix2):
 * этот вызов обычно идёт из ДРУГОЙ вкладки, чем та, где клиент открыл свою запись — сообщаем ей решение
 * через BroadcastChannel сразу же, подробности и почему не через ре-гидратацию базы — в
 * src/areas/online/lib/bookingDecisionChannel.ts.
 */
export function respondToRequest(bookingId: Id, action: 'confirm' | 'decline'): Promise<Booking> {
  if (isApiMode()) return OnlineServer.respondToRequestServer(bookingId, action);
  return request(async () => {
    const status: BookingStatus = action === 'confirm' ? 'scheduled' : 'cancelled_by_master';
    const updated = await updateBooking(bookingId, { status });
    logBookingStatus(bookingId, status, 'staff');
    if (status === 'scheduled' || status === 'cancelled_by_master') {
      broadcastBookingDecision({ bookingId, status });
    }
    return updated;
  });
}

// ─────────────────────────── Перенос и отмена клиентом (F-03-066/067, F-03-099/100) ───────────────────────────

export interface CancelWindowInfo {
  canCancelFree: boolean;
  canReschedule: boolean;
  cancelWindowHours: number;
  rescheduleWindowHours: number;
  /** Сколько клиент уже заплатил предоплатой (мастер отметил «получена»); 0 — нечего возвращать */
  prepaidAmount?: number;
  /** ⭐ В-04: при отмене позже срока предоплата остаётся мастеру */
  keepPrepaymentOnLateCancel?: boolean;
  /**
   * Мастер запретил клиентам отменять оплаченные записи (prepaid_locked) — окно отмены говорит это ДО нажатия.
   * Нет поля (сервер пока не отдаёт) — считаем, что разрешено, и сервер ответит prepaid_locked при нажатии.
   */
  allowCancelPrepaid?: boolean;
}

/** Действующие правила записи — те же, что у ядра и сервера: по умолчанию ← бизнес ← мастер (Staff.bookingRules) */
function bookingRulesOf(booking: Booking): EffectiveBookingRules {
  const core = readCore();
  return effectiveBookingRules(
    core.businesses.find((b) => b.id === booking.businessId),
    core.staff.find((s) => s.id === booking.staffId),
  );
}

/** Может ли клиент сам перенести/отменить бесплатно прямо сейчас (F-03-066, F-03-067) */
export function getCancelWindow(bookingId: Id, hash: string): Promise<CancelWindowInfo> {
  if (isApiMode()) return OnlineServer.getCancelWindowServer(bookingId, hash);
  return request(() => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    const booking = readCore().bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('not_found', 'Запись не найдена');
    // Одно правило с отменой (coreTx.cancelByClient) и по ереванскому времени (nowDateTime), а не по поясу браузера
    const rules = bookingRulesOf(booking);
    const now = nowDateTime();
    return {
      canCancelFree: isFreeCancelNow(booking, rules, now),
      // Как ядро (canReschedule): оплаченную запись сам клиент не переносит, если мастер не разрешил
      canReschedule: canReschedule(booking, rules, now).allowed,
      cancelWindowHours: rules.cancelWindowMin / 60,
      rescheduleWindowHours: rules.rescheduleWindowMin / 60,
      prepaidAmount: booking.prepayment?.paid ? booking.prepayment.amount : 0,
      keepPrepaymentOnLateCancel: rules.keepPrepaymentOnLateCancel,
      allowCancelPrepaid: rules.allowCancelPrepaid,
    };
  });
}

/**
 * Отмена своей записи по ссылке без входа (F-03-100): после проверки хэша — отмена ядра (coreTx.cancelByClient), как в
 * приложении и на сервере: прошедшую/отменённую не отменить, оплаченную — если мастер разрешил (prepaid_locked); позже
 * срока — неявка (+1 к неявкам клиента), предоплата остаётся мастеру или идёт «Верните клиенту» (В-04, F-03-067).
 */
export function cancelOnlineBooking(bookingId: Id, hash: string, reason?: string): Promise<Booking> {
  if (isApiMode()) return OnlineServer.cancelOnlineBookingServer(bookingId, hash) as Promise<Booking>;
  return request(async () => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    const { booking: updated } = coreTx.cancelByClient(bookingId);
    logBookingStatus(bookingId, 'cancelled_by_client', 'client');
    // О4: визит из нескольких частей подряд отменяется целиком — без первой части вторая теряет смысл
    if (meta.packageGroupId) {
      const online = readArea('online');
      const siblings = readCore().bookings.filter(
        (b) =>
          b.id !== bookingId &&
          online.bookingMeta[b.id]?.packageGroupId === meta.packageGroupId &&
          b.status !== 'cancelled_by_client' &&
          b.status !== 'cancelled_by_master',
      );
      for (const b of siblings) {
        await updateBooking(b.id, { status: 'cancelled_by_client' });
        logBookingStatus(b.id, 'cancelled_by_client', 'client');
      }
    }
    if (reason?.trim()) {
      mutateArea('online', (st) => {
        const m = st.bookingMeta[bookingId];
        if (m) m.cancelReasonText = reason.trim().slice(0, 200);
      });
    }
    return updated;
  });
}

/**
 * ⭐ В-03/О28 «запись в одно нажатие»: клиент нажал окно на странице своей заявки — мастер не успел ответить или сам
 * предложил «Другое время». Новая запись к тому же мастеру на те же услуги с теми же именем и телефоном (ссылка с
 * хэшем уже подтверждает, что это он), без формы и кода. Окно, предложенное мастером, не ждёт второго подтверждения,
 * а исходная заявка снимается (createOnlineBooking, replacesBookingId). В api — POST /v1/public/bookings/:id/alternative?h=.
 */
export function bookAlternativeTime(bookingId: Id, hash: string, start: ISODateTime): Promise<OnlineBookingResult> {
  if (isApiMode()) return OnlineServer.bookAlternativeTimeServer(bookingId, hash, start);
  return request(async () => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    const core = readCore();
    const orig = core.bookings.find((b) => b.id === bookingId);
    if (!orig) throw new ApiError('not_found', 'Запись не найдена');
    if (!(orig.alternativeStarts ?? []).includes(start)) throw new ApiError('slot_taken', 'Это время уже недоступно');
    const client = core.clients.find((c) => c.id === orig.clientId);
    if (!client) throw new ApiError('client_required', 'Нет имени и телефона');
    return createOnlineBooking({
      businessId: orig.businessId,
      locationId: orig.locationId,
      staffId: orig.staffId,
      start,
      services: orig.services.map((l) => ({ serviceId: l.serviceId })),
      clientName: orig.visitorName ?? client.name,
      clientPhone: client.phone,
      forWhom: orig.forWhom,
      linkId: meta.linkId,
      formId: meta.formId,
      source: orig.source === 'link' ? 'link' : 'widget',
      device: meta.device,
      workplace: orig.workplace,
      reminderMinutesBefore: meta.reminderMinutesBefore,
      phoneVerified: true,
      email: meta.email,
      replacesBookingId: orig.id,
      replacesHash: hash,
    });
  });
}

/**
 * Перенос своей записи по ссылке без входа на другое окно того же мастера (F-03-099) — перенос ядра
 * (coreTx.rescheduleByClient): срок, запрет для оплаченных, свободное окно — те же правила, что в приложении.
 * **В `api` не строился намеренно** (B8, `08-open-questions.md`, принятое предложение владельца): по ссылке
 * без входа — только просмотр и отмена, перенос не даём (риск злоупотребления анонимной ссылкой). Экран
 * (`BookingConfirmedScreen`) скрывает кнопку переноса в режиме `api`, поэтому сюда там не попадают; ошибка —
 * подстраховка на случай прямого вызова.
 */
export function rescheduleOnlineBooking(bookingId: Id, hash: string, newStart: string): Promise<Booking> {
  if (isApiMode()) return Promise.reject(new ApiError('not_allowed', 'Перенос по ссылке без входа не предусмотрен (B8)'));
  return request(() => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    return coreTx.rescheduleByClient(bookingId, newStart);
  });
}

// ─────────────────────────── Услуга/пакет в виджете (F-03-129, F-03-130) ───────────────────────────

export function getServiceOnlineConfig(serviceId: Id): Promise<ServiceOnlineConfig | undefined> {
  if (isApiMode()) return OnlineServer.getServiceOnlineConfigServer(serviceId);
  return request(() => readArea('online').serviceConfigs[serviceId]);
}

export function updateServiceOnlineConfig(serviceId: Id, patch: Partial<Omit<ServiceOnlineConfig, 'serviceId'>>): Promise<ServiceOnlineConfig> {
  if (isApiMode()) return OnlineServer.updateServiceOnlineConfigServer(serviceId, patch);
  return request(() => {
    let updated!: ServiceOnlineConfig;
    mutateArea('online', (s) => {
      const prev = s.serviceConfigs[serviceId] ?? { serviceId };
      updated = { ...prev, ...patch };
      s.serviceConfigs[serviceId] = updated;
    });
    return updated;
  });
}

// ─────────────────────────── Пакеты услуг / комплексы (F-03-130) ───────────────────────────

export function listOnlinePackages(businessId: Id): Promise<OnlinePackage[]> {
  if (isApiMode()) return OnlineServer.listOnlinePackagesServer();
  return request(() => (readArea('online').packages ?? []).filter((p) => p.businessId === businessId));
}

export function getOnlinePackage(packageId: Id): Promise<OnlinePackage | undefined> {
  return request(() => (readArea('online').packages ?? []).find((p) => p.id === packageId));
}

export function updateOnlinePackage(packageId: Id, patch: Partial<Omit<OnlinePackage, 'id' | 'businessId' | 'createdAt'>>): Promise<OnlinePackage> {
  if (isApiMode()) return OnlineServer.updateOnlinePackageServer(packageId, patch);
  return request(() => {
    let updated!: OnlinePackage;
    mutateArea('online', (s) => {
      const list = s.packages ?? (s.packages = []);
      const idx = list.findIndex((p) => p.id === packageId);
      if (idx === -1) throw new ApiError('not_found', 'Пакет не найден');
      updated = { ...list[idx], ...patch };
      list[idx] = updated;
    });
    return updated;
  });
}

export interface CreateOnlinePackageInput {
  businessId: Id;
  name: string;
  serviceIds: Id[];
  mode: OnlinePackage['mode'];
}

/**
 * F-03-130 (исправлено): раньше пакеты можно было только редактировать, ни создать, ни удалить из кабинета
 * было нельзя («это заведёт раздел „Услуги“ вместе с самой сущностью»). Сущность уже наша (временно, до
 * переезда — см. докстринг OnlinePackage в domain/online.ts), поэтому по тому же образцу, что и
 * WaitlistRequest/SlotInvite, заводим CRUD здесь; переезд в «Услуги» ничего не сломает — тот же API.
 */
export function createOnlinePackage(input: CreateOnlinePackageInput): Promise<OnlinePackage> {
  if (isApiMode()) return OnlineServer.createOnlinePackageServer(input);
  return request(() => {
    if (input.serviceIds.length < 2 || input.serviceIds.length > 10) {
      throw new ApiError('invalid_input', 'В пакете должно быть 2–10 услуг');
    }
    let created!: OnlinePackage;
    mutateArea('online', (s) => {
      const list = s.packages ?? (s.packages = []);
      created = {
        id: newId('pkg'),
        businessId: input.businessId,
        name: { ru: input.name, en: input.name, hy: input.name },
        serviceIds: input.serviceIds,
        mode: input.mode,
        online: false,
        createdAt: nowDateTime(),
      };
      list.push(created);
    });
    return created;
  });
}

export function deleteOnlinePackage(packageId: Id): Promise<void> {
  if (isApiMode()) return OnlineServer.deleteOnlinePackageServer(packageId);
  return request(() => {
    mutateArea('online', (s) => {
      s.packages = (s.packages ?? []).filter((p) => p.id !== packageId);
    });
  });
}

/** Диапазон цены пакета (F-03-130): сумма минимумов – сумма максимумов включённых услуг */
export function computePackagePriceRange(services: Service[]): { min: number; max?: number } {
  const min = services.reduce((sum, s) => sum + s.priceMin, 0);
  const hasRange = services.some((s) => s.priceMax && s.priceMax > s.priceMin);
  const max = hasRange ? services.reduce((sum, s) => sum + (s.priceMax ?? s.priceMin), 0) : undefined;
  return { min, max };
}

/** Диапазон длительности пакета (F-03-130): одновременно — от max(min) до max(max); последовательно — суммы */
export function computePackageDurationRange(services: Service[], mode: OnlinePackage['mode']): { min: number; max?: number } {
  const withDur = services.filter((s) => s.durationMin > 0);
  if (mode === 'simultaneous') {
    const min = Math.max(0, ...withDur.map((s) => s.durationMin));
    const maxCandidates = withDur.map((s) => s.durationMax ?? s.durationMin);
    const max = Math.max(0, ...maxCandidates);
    return { min, max: max > min ? max : undefined };
  }
  const min = withDur.reduce((sum, s) => sum + s.durationMin, 0);
  const hasRange = withDur.some((s) => s.durationMax && s.durationMax > s.durationMin);
  const max = hasRange ? withDur.reduce((sum, s) => sum + (s.durationMax ?? s.durationMin), 0) : undefined;
  return { min, max };
}

// ─────────────────────────── Пара «мастер × услуга» (F-03-133) ───────────────────────────

export function getStaffServiceOnlineFlags(businessId: Id): Promise<StaffServiceOnlineFlags> {
  if (isApiMode()) return OnlineServer.getStaffServiceOnlineFlagsServer();
  return request(() => {
    void businessId; // флаги хранятся плоским списком, businessId — для единообразия вызова из UI
    return readArea('online').staffServiceOnline;
  });
}

export function setStaffServiceOnline(staffId: Id, serviceId: Id, online: boolean): Promise<StaffServiceOnlineFlags> {
  if (isApiMode()) return OnlineServer.setStaffServiceOnlineServer(staffId, serviceId, online);
  return request(() => {
    let result!: StaffServiceOnlineFlags;
    mutateArea('online', (s) => {
      const key = staffServicePairKey(staffId, serviceId);
      if (online) delete s.staffServiceOnline[key];
      else s.staffServiceOnline[key] = false;
      result = s.staffServiceOnline;
    });
    return result;
  });
}

// ─────────────────────────── Промоблок в виджете (F-03-106) ───────────────────────────

export function listPromoBlocks(businessId: Id): Promise<PromoBlock[]> {
  if (isApiMode()) return OnlineServer.listPromoBlocksServer();
  return request(() => readArea('online').promoBlocks[businessId] ?? []);
}

export function createPromoBlock(input: Omit<PromoBlock, 'id' | 'createdAt' | 'status' | 'enabled' | 'reasonNote'>): Promise<PromoBlock> {
  if (isApiMode()) return OnlineServer.createPromoBlockServer(input);
  return request(() => {
    // ⭐ F-00-168/F-03-106: новые тексты и картинки клиентам видны только после нашей проверки — тот же
    // pending/approved, что у heroImageUrl ссылки. Отдельной очереди «наша панель → модерация» на промоблоки
    // пока нет (платформенный ModerationKind их не знает, см. qa/requests/online.md) — «На проверке» здесь
    // держится своим статусом на PromoBlock, не через src/api/platform/moderation.ts.
    const block: PromoBlock = { ...input, id: newId('promo'), status: 'pending', enabled: true, createdAt: nowDateTime() };
    mutateArea('online', (s) => {
      s.promoBlocks[input.businessId] = [...(s.promoBlocks[input.businessId] ?? []), block];
    });
    return block;
  });
}

export function updatePromoBlock(businessId: Id, id: Id, patch: Partial<Omit<PromoBlock, 'id' | 'businessId' | 'createdAt'>>): Promise<PromoBlock> {
  if (isApiMode()) return OnlineServer.updatePromoBlockServer(id, patch);
  return request(() => {
    let updated: PromoBlock | undefined;
    mutateArea('online', (s) => {
      s.promoBlocks[businessId] = (s.promoBlocks[businessId] ?? []).map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, ...patch };
        return updated;
      });
    });
    if (!updated) throw new ApiError('not_found', 'Промоблок не найден');
    return updated;
  });
}

export function deletePromoBlock(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return OnlineServer.deletePromoBlockServer(id);
  return request(() => {
    mutateArea('online', (s) => {
      s.promoBlocks[businessId] = (s.promoBlocks[businessId] ?? []).filter((p) => p.id !== id);
    });
  });
}

/** F-03-106: «на одном экране виден один блок» — из всех подходящих берём самый старый (createdAt). */
function pickOnePromoBlockForScreen(blocks: PromoBlock[], screen: PromoScreen): PromoBlock[] {
  const eligible = blocks
    .filter((p) => p.enabled && p.status === 'approved' && p.screens.includes(screen))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return eligible.length > 0 ? [eligible[0]] : [];
}

/** Промоблоки, которые нужно показать на конкретном экране виджета (F-03-106) — не более одного. */
export function getPromoBlocksForScreen(businessId: Id, screen: PromoScreen): Promise<PromoBlock[]> {
  return request(() => pickOnePromoBlockForScreen(readArea('online').promoBlocks[businessId] ?? [], screen));
}

export function trackPromoClick(businessId: Id, promoId: Id): Promise<void> {
  return request(() => {
    void businessId;
    void promoId; // ⭐ assumed: клики по промоблоку идут тем же журналом, что и `clicked_promo_link` (F-03-121)
  });
}

// ─────────────────────────── Звёздочка вместо отзывов (F-00-116/117, F-03-105) ───────────────────────────

/** Число поставивших звёздочку — бизнесу или конкретному мастеру, без текста и оценки 1–5 (F-03-105) */
export function getStarCount(businessId: Id, target: ReviewTarget, targetId: Id): Promise<number> {
  if (isApiMode()) return OnlineServer.getStarCountServer(businessId, target, targetId);
  return request(() => readArea('online').reviews.filter((r) => r.businessId === businessId && r.target === target && r.targetId === targetId).length);
}

/** Клиент ставит звёздочку после визита (F-00-116) — только когда «пришёл», одна звёздочка на запись */
export function addReview(input: { businessId: Id; target: ReviewTarget; targetId: Id; bookingId: Id; clientId: Id; hash: string }): Promise<Review> {
  if (isApiMode()) return OnlineServer.addReviewServer(input);
  return request(() => {
    // Только по ссылке этой записи (хэш), как отмена и «Я оплатил»
    if (readArea('online').bookingMeta[input.bookingId]?.accessHash !== input.hash) throw new ApiError('not_found', 'Запись не найдена');
    const { hash: _hash, ...fields } = input;
    const already = readArea('online').reviews.some((r) => r.bookingId === input.bookingId && r.target === input.target);
    if (already) throw new ApiError('already_rated', 'Вы уже поставили звёздочку за эту запись');
    const review: Review = { ...fields, id: newId('rv'), createdAt: nowDateTime() };
    mutateArea('online', (s) => {
      s.reviews.push(review);
    });
    return review;
  });
}

/** Уже ли клиент поставил звёздочку за эту запись (кнопка на «Вы записаны» / «Мои записи») */
export function hasReviewed(bookingId: Id, target: ReviewTarget, hash: string): Promise<boolean> {
  if (isApiMode()) return OnlineServer.hasReviewedServer(bookingId, target, hash);
  return request(() => {
    if (readArea('online').bookingMeta[bookingId]?.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    return readArea('online').reviews.some((r) => r.bookingId === bookingId && r.target === target);
  });
}

// ─────────────────────────── События виджета для аналитики (F-03-117…122) ───────────────────────────

const MAX_WIDGET_EVENTS = 200;

/** Отправляет событие в подключённые счётчики (F-03-118…120: демо, реальных сетевых вызовов нет) и в журнал ссылки */
export function trackWidgetEvent(linkId: Id | undefined, businessId: Id, type: WidgetEventType): Promise<void> {
  if (isApiMode()) return OnlineServer.trackWidgetEventServer(linkId, businessId, type);
  return request(() => {
    if (!linkId) return;
    mutateArea('online', (s) => {
      s.widgetEvents.push({ id: newId('we'), linkId, businessId, type, at: nowDateTime() });
      if (s.widgetEvents.length > MAX_WIDGET_EVENTS * 4) {
        s.widgetEvents = s.widgetEvents.slice(-MAX_WIDGET_EVENTS * 4);
      }
    });
  });
}

/** Журнал последних событий этой ссылки — «Блок «Аналитика»» в настройке ссылки (F-03-121) */
export function listWidgetEvents(linkId: Id): Promise<import('@/domain/online').WidgetEvent[]> {
  if (isApiMode()) return OnlineServer.listWidgetEventsServer(linkId);
  return request(() =>
    readArea('online')
      .widgetEvents.filter((e) => e.linkId === linkId)
      .slice(-MAX_WIDGET_EVENTS)
      .reverse(),
  );
}

// ─────────────────────────── Сеть: выбор филиала (F-03-008, F-03-083) ───────────────────────────

export interface NetworkBranch {
  business: Business;
  location: Location | undefined;
}

/** Филиалы сети, видные клиенту в сетевой ссылке (F-03-083) — только активные */
export function getNetworkBranches(networkId: Id): Promise<NetworkBranch[]> {
  return request(() => {
    const core = readCore();
    return core.businesses
      .filter((b) => b.networkId === networkId && b.status === 'active')
      .map((b) => ({ business: b, location: core.locations.find((l) => l.businessId === b.id && l.id === b.locationIds[0]) }));
  });
}

// ─────────────────────────── Групповая запись: несколько мест и несколько событий (F-03-076, F-03-101, F-03-102) ───────────────────────────

export function getGroupBookingRules(linkId: Id): Promise<GroupBookingRules> {
  if (isApiMode()) return OnlineServer.getGroupBookingRulesServer(linkId);
  return request(() => readArea('online').groupBookingRules[linkId] ?? { linkId, ...DEFAULT_GROUP_BOOKING_RULES });
}

export function updateGroupBookingRules(linkId: Id, patch: Partial<Omit<GroupBookingRules, 'linkId'>>): Promise<GroupBookingRules> {
  if (isApiMode()) return OnlineServer.updateGroupBookingRulesServer(linkId, patch);
  return request(() => {
    let updated!: GroupBookingRules;
    mutateArea('online', (s) => {
      const prev = s.groupBookingRules[linkId] ?? { linkId, ...DEFAULT_GROUP_BOOKING_RULES };
      updated = { ...prev, ...patch };
      s.groupBookingRules[linkId] = updated;
    });
    return updated;
  });
}

export interface PublicGroupEvent {
  event: GroupEvent;
  service: Service | undefined;
  staff: Staff | undefined;
  seatsTaken: number;
  seatsLeft: number;
}

/**
 * Групповые события, доступные клиенту в виджете (F-03-101): только будущие, услуга открыта онлайн.
 * data-f="F-16-029" — у групповой услуги нет тумблера онлайн-записи по сотруднику (StaffCard хранит только
 * общий Staff.onlineBookingEnabled), включение/выключение — только на уровне Service.onlineBookable целиком;
 * выключение сразу прячет все её события отсюда. Значение по умолчанию у новой услуги — true (mock/seed/services.ts).
 */
export function listPublicGroupEvents(businessId: Id, serviceId?: Id): Promise<PublicGroupEvent[]> {
  if (isApiMode()) return OnlineServer.listPublicGroupEventsServer(businessId, serviceId);
  return request(async () => {
    const core = readCore();
    const events = await listGroupEvents({ businessId, statuses: ['scheduled'] });
    const future = events.filter((e) => e.start >= nowDateTime());
    const withService = serviceId ? future.filter((e) => e.serviceId === serviceId) : future;
    const result: PublicGroupEvent[] = [];
    for (const event of withService) {
      const service = core.services.find((s) => s.id === event.serviceId);
      if (!service || !service.active || !service.onlineBookable) continue;
      const participants = await listBookings({ groupEventId: event.id, statuses: ['scheduled', 'awaiting_confirmation', 'client_confirmed', 'arrived'] });
      const seatsTaken = participants.length;
      result.push({
        event,
        service,
        staff: core.staff.find((s) => s.id === event.staffId),
        seatsTaken,
        seatsLeft: Math.max(0, event.capacity - seatsTaken),
      });
    }
    return result.sort((a, b) => a.event.start.localeCompare(b.event.start));
  });
}

export interface CreateGroupOnlineBookingInput {
  businessId: Id;
  locationId: Id;
  groupEventId: Id;
  /** Мест сразу в одной записи (F-03-076) — 1, если настройка «доп. места» выключена */
  seats: number;
  clientName: string;
  clientPhone: string;
  comment?: string;
  linkId?: Id;
  formId?: string;
  source: BookingSource;
  device: BookingDevice;
  phoneVerified: boolean;
  /** F-16-090: тумблер «оплатить абонементом» проверен и подтверждён на стороне виджета до вызова */
  payByMembership?: boolean;
}

/** Запись на групповое событие с местами (F-03-076, F-03-101) — все места на телефон одного клиента (147353) */
export function createGroupOnlineBooking(input: CreateGroupOnlineBookingInput): Promise<OnlineBookingResult> {
  if (isApiMode()) return OnlineServer.createGroupOnlineBookingServer(input);
  return request(async () => {
    const core = readCore();
    const event = core.groupEvents.find((e) => e.id === input.groupEventId);
    if (!event) throw new ApiError('not_found', 'Событие не найдено');
    const service = core.services.find((s) => s.id === event.serviceId);
    if (!service) throw new ApiError('not_found', 'Услуга не найдена');
    const participants = await listBookings({ groupEventId: event.id, statuses: ['scheduled', 'awaiting_confirmation', 'client_confirmed', 'arrived'] });
    if (participants.length + input.seats > event.capacity) throw new ApiError('slot_taken', 'Свободных мест не осталось');
    if (!input.phoneVerified) throw new ApiError('phone_not_verified', 'Подтвердите номер телефона кодом');
    const normalizedPhone = normalizePhone(input.clientPhone);
    if (!normalizedPhone) throw new ApiError('invalid_phone', 'Проверьте номер телефона');
    let client = await findClientByPhone(input.businessId, normalizedPhone);
    if (client?.blocked) throw new ApiError('client_blocked', 'Этому номеру закрыта онлайн-запись');
    if (!client) {
      client = await coreCreate('clients', {
        businessId: input.businessId,
        phone: normalizedPhone,
        name: input.clientName,
        gender: 'unknown',
        tags: [],
        noShowCount: 0,
        createdAt: nowDateTime(),
      });
    }
    // F-16-090: списание идёт визитом абонемента, а не деньгами — цена строки обнуляется, как и у обычной
    // оплаты абонементом в кабинете (журнал считает такую запись «оплаченной», не «ждёт оплату»).
    const line: BookingServiceLine = {
      serviceId: service.id,
      staffId: event.staffId,
      price: input.payByMembership ? 0 : service.priceMin,
      durationMin: service.durationMin,
      qty: input.seats,
    };
    const staff = core.staff.find((s) => s.id === event.staffId);
    const status: BookingStatus = staff?.confirmMode === 'manual' ? 'awaiting_confirmation' : 'scheduled';
    const booking = await createBooking({
      businessId: input.businessId,
      locationId: input.locationId,
      staffId: event.staffId,
      clientId: client.id,
      start: event.start,
      durationMin: event.durationMin,
      status,
      services: [line],
      resourceIds: event.resourceIds,
      workplace: 'salon',
      source: input.source,
      createdBy: 'client',
      forWhom: 'self',
      visitorName: input.clientName,
      comment: input.comment,
      groupEventId: event.id,
    });
    const accessHash = makeAccessHash();
    mutateArea('online', (s) => {
      s.bookingMeta[booking.id] = {
        bookingId: booking.id,
        linkId: input.linkId,
        formId: input.formId,
        widgetGen: 'new',
        device: input.device,
        accessHash,
        phoneVerified: true,
        paidByMembership: input.payByMembership,
      };
    });
    return { booking, client, accessHash };
  });
}

// ─────────────────────────── Абонемент (F-03-096) ───────────────────────────

export interface SubscriptionCheck {
  valid: boolean;
  remainingVisits?: number;
}

/**
 * Проверка абонемента по номеру телефона (F-03-096) — ⭐ assumed/simplified: `Subscription` (раздел
 * clients, «лишняя копия» до переезда в loyalty — см. AREAS.md) не хранит список услуг, которые он
 * покрывает, поэтому точной проверки «эта услуга входит в этот абонемент» здесь по-настоящему нет (просьба
 * добавить `serviceIds`/`planId` к самой сущности абонемента — в qa/requests/online.md).
 *
 * ИСПРАВЛЕНО: раньше это означало «годится любой активный абонемент», что подходило к любой услуге сразу.
 * Временная мера до общего поля — сверяем НАЗВАНИЕ (Subscription.name) с тем, что владелец вписал в
 * настройке услуги («Онлайн-запись» → «Название абонемента» рядом с «Запретить онлайн-запись без
 * абонемента», ServiceOnlineConfig.subscriptionPlanName): совпадает без учёта регистра — годится; настройка
 * пуста — прежнее поведение (годится любой активный), чтобы не ломать уже работающие ссылки задним числом.
 */
export async function checkSubscriptionForService(businessId: Id, phone: string, planName?: string): Promise<SubscriptionCheck> {
  const normalized = normalizePhone(phone);
  if (!normalized) return { valid: false };
  const client = await findClientByPhone(businessId, normalized);
  if (!client) return { valid: false };
  const { subscriptions } = await getClientLoyalty(businessId, client.id);
  const now = today();
  const wantedName = planName?.trim().toLocaleLowerCase();
  const active = subscriptions.find(
    (s) =>
      s.status === 'active' &&
      !s.frozen &&
      s.remainingVisits > 0 &&
      s.expiresAt >= now &&
      (!wantedName || s.name.trim().toLocaleLowerCase() === wantedName),
  );
  return active ? { valid: true, remainingVisits: active.remainingVisits } : { valid: false };
}

// ─────────────────────────── Оплата в виджете: ручная предоплата (F-00-097, F-03-094, F-03-095) ───────────────────────────

/**
 * Просроченные «ждёт предоплату» без отметки «Я оплатил» освобождают слот сами (F-03-094) — проверяем
 * лениво (нет фонового таймера в моке) при каждом чтении окон и записи клиента, как и у других разделов.
 */
async function releaseExpiredPrepayments(businessId: Id): Promise<void> {
  // Одно правило ядра (как журнал и приложение клиента): неоплаченная в срок — «Снята: предоплата не поступила
  // вовремя» (cancelReason 'prepayment_expired' + событие клиенту), заявка без ответа мастера до срока — с 3 окнами
  // (В-03). Своя петля раньше ставила «Отменена» без причины — клиент видел «вы отменили», а не «не пришла оплата».
  // О6: «Я оплатил» снимает holdUntil (markPrepaymentPaid), поэтому оплату на проверке ядро по таймеру не трогает.
  coreTx.releaseExpiredPrepayments({ businessId });
}

/**
 * «Я оплатил» — клиент СООБЩАЕТ о ручной предоплате по реквизитам (F-00-097, F-03-094). О6: это не оплата —
 * деньги проверяет салон. Запись остаётся «ждёт предоплату» с пометкой «оплата на проверке»
 * (`meta.prepaymentReportedAt`), попадает в «Заявки» с кнопкой «Деньги пришли» (`confirmPrepaymentReceived`),
 * слот больше не снимается по таймеру. Раньше статус сразу становился «Вы записаны» мимо мастера и салона.
 */
export function markPrepaymentPaid(bookingId: Id, hash: string): Promise<Booking> {
  if (isApiMode()) return OnlineServer.markPrepaymentPaidServer(bookingId, hash);
  return request(async () => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    const booking = await coreGet('bookings', bookingId);
    if (booking.status !== 'awaiting_prepayment') throw new ApiError('not_awaiting_prepayment', 'Эта запись не ждёт предоплату');
    if (booking.prepayment?.holdUntil && booking.prepayment.holdUntil < nowDateTime() && !meta.prepaymentReportedAt) {
      throw new ApiError('prepayment_expired', 'Время на оплату истекло — окно уже освободилось');
    }
    if (!meta.prepaymentReportedAt) {
      mutateArea('online', (s) => {
        const m = s.bookingMeta[bookingId];
        if (m) m.prepaymentReportedAt = nowDateTime();
      });
      logBookingStatus(bookingId, 'prepayment_reported', 'client');
    }
    // Таймер снятия стоп (как сервер и приложение клиента): оплата на проверке — общее снятие просроченных
    // (core.releaseExpiredPrepayments, его зовёт и журнал) такую запись не трогает
    if (booking.prepayment?.holdUntil) {
      const { holdUntil: _hold, ...rest } = booking.prepayment;
      return updateBooking(bookingId, { prepayment: rest });
    }
    return booking;
  });
}

// ─────────────────────────── Личный кабинет клиента в виджете (F-03-109…112) ───────────────────────────

export interface CabinetData {
  client: Client;
  upcoming: Booking[];
  past: Booking[];
  services: Record<Id, Service>;
  staffNames: Record<Id, string>;
  loyalty: { certificates: Awaited<ReturnType<typeof getClientLoyalty>>['certificates']; subscriptions: Awaited<ReturnType<typeof getClientLoyalty>>['subscriptions'] };
  /** О20: ссылка «управлять записью» — отмена и перенос по правилам на странице записи, а не кнопкой в списке */
  accessHashes: Record<Id, string>;
}

/** Вход по номеру и коду (демо — код виден на экране, как и при записи, F-03-077) — те же данные, что при онлайн-записи */
export async function getCabinetData(businessId: Id, phone: string): Promise<CabinetData> {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new ApiError('invalid_phone', 'Проверьте номер телефона');
  if (isApiMode()) return OnlineServer.getCabinetDataServer(businessId, normalized);
  return request(async () => {
    const client = await findClientByPhone(businessId, normalized);
    if (!client) throw new ApiError('not_found', 'С этим номером ещё нет записей');
    await releaseExpiredPrepayments(businessId);
    const core = readCore();
    // F-03-110 (добавлено проверкой 2): «Предстоящие» — все записи клиента по номеру, включая внесённые администратором
    const all = core.bookings.filter((b) => !b.deletedAt && b.businessId === businessId && b.clientId === client.id);
    const now = nowDateTime();
    const upcoming = all.filter((b) => b.start >= now && b.status !== 'cancelled_by_client' && b.status !== 'cancelled_by_master').sort((a, b) => a.start.localeCompare(b.start));
    const past = all.filter((b) => b.start < now || b.status === 'arrived' || b.status === 'no_show').sort((a, b) => b.start.localeCompare(a.start));
    const services: Record<Id, Service> = {};
    const staffNames: Record<Id, string> = {};
    for (const b of all) {
      for (const line of b.services) {
        const svc = core.services.find((s) => s.id === line.serviceId);
        if (svc) services[svc.id] = svc;
      }
      const st = core.staff.find((s) => s.id === b.staffId);
      if (st) staffNames[st.id] = st.name;
    }
    const loyalty = await getClientLoyalty(businessId, client.id);
    const metaAll = readArea('online').bookingMeta;
    const accessHashes: Record<Id, string> = {};
    for (const b of all) if (metaAll[b.id]?.accessHash) accessHashes[b.id] = metaAll[b.id].accessHash;
    return { client, upcoming, past, services, staffNames, loyalty, accessHashes };
  });
}

// ─────────────────────────── Другие каналы записи (F-03-036…046, F-03-048) ───────────────────────────

/** Каталог + демо-состояние подключения (F-03-036, F-03-039…043, F-03-046) */
export function listIntegrations(businessId: Id): Promise<IntegrationConnection[]> {
  if (isApiMode()) return OnlineServer.listIntegrationsServer();
  return request(() => {
    const stored = readArea('online').integrations[businessId] ?? [];
    const byId = new Map(stored.map((i) => [i.id, i] as const));
    return INTEGRATION_CATALOG.map((c) => byId.get(c.id) ?? { id: c.id, connected: false });
  });
}

/** Подключить/отключить демо-канал записи. Для каналов, недоступных в Армении по справке, — отказ (F-03-040, F-03-042) */
export function setIntegrationConnected(businessId: Id, id: IntegrationId, connected: boolean): Promise<IntegrationConnection> {
  if (isApiMode()) return OnlineServer.setIntegrationConnectedServer(id, connected);
  return request(() => {
    const entry = INTEGRATION_CATALOG.find((c) => c.id === id);
    if (connected && entry && !entry.availableInArmenia) {
      throw new ApiError('integration_unavailable', 'Пока недоступно в Армении по справке партнёра');
    }
    let updated: IntegrationConnection | undefined;
    mutateArea('online', (s) => {
      const list = s.integrations[businessId] ?? (s.integrations[businessId] = []);
      const idx = list.findIndex((i) => i.id === id);
      updated = { id, connected, connectedAt: connected ? nowDateTime() : undefined };
      if (idx >= 0) list[idx] = updated;
      else list.push(updated);
    });
    return updated!;
  });
}

/** Демо-ключ своего API — «Готово, когда» F-03-036 читаем как «ключ выдан, разработчик может его использовать» */
export function getApiCredentials(businessId: Id): Promise<ApiCredentials> {
  if (isApiMode()) return OnlineServer.getApiCredentialsServer();
  return request(() => readArea('online').apiCredentials[businessId] ?? { businessId });
}

export function generateApiKey(businessId: Id): Promise<ApiCredentials> {
  if (isApiMode()) return OnlineServer.generateApiKeyServer();
  return request(() => {
    const key = `bp_live_${newId('key').replace(/[^a-z0-9]/gi, '').slice(0, 24)}`;
    const creds: ApiCredentials = { businessId, apiKey: key, createdAt: nowDateTime() };
    mutateArea('online', (s) => {
      s.apiCredentials[businessId] = creds;
    });
    return creds;
  });
}

export function revokeApiKey(businessId: Id): Promise<void> {
  if (isApiMode()) return OnlineServer.revokeApiKeyServer();
  return request(() => {
    mutateArea('online', (s) => {
      s.apiCredentials[businessId] = { businessId };
    });
  });
}

/** «Мобильные приложения»: свои ссылки + заявка на консультацию (F-03-048) */
export function getMobileAppLinks(businessId: Id): Promise<MobileAppLinks> {
  if (isApiMode()) return OnlineServer.getMobileAppLinksServer();
  return request(() => readArea('online').mobileApps[businessId] ?? { businessId });
}

export function updateMobileAppLinks(businessId: Id, patch: Partial<Omit<MobileAppLinks, 'businessId'>>): Promise<MobileAppLinks> {
  if (isApiMode()) return OnlineServer.updateMobileAppLinksServer(patch);
  return request(() => {
    let updated: MobileAppLinks | undefined;
    mutateArea('online', (s) => {
      const current = s.mobileApps[businessId] ?? { businessId };
      updated = { ...current, ...patch };
      s.mobileApps[businessId] = updated;
    });
    return updated!;
  });
}

export function requestBrandedAppConsult(businessId: Id): Promise<MobileAppLinks> {
  return updateMobileAppLinks(businessId, { consultRequestedAt: nowDateTime() });
}

// ─────────────────────────── «Кого позвать» (F-03-052) ───────────────────────────

export interface SlotCandidate {
  slotStart: string;
  staffId: Id;
  clientId: Id;
  clientName: string;
  clientPhone: string;
  reason: 'regular' | 'dueAgain';
  serviceId?: Id;
}

/**
 * Свободные окна ближайших дней с подобранными клиентами (⭐ F-03-052 по-нашему): «обычно ходит в это
 * время» — были записи к этому мастеру в тот же час ± 1ч в последние 90 дней; «пора снова» — прошёл интервал
 * повтора услуги с последнего визита «Пришёл» к мастеру, и новой записи нет (как «Пора записать» в «Клиентах»). Не более одного кандидата на окно, не
 * более 8 окон, чтобы список помещался на карточке и не листался бесконечно.
 */
export function getSlotCandidates(businessId: Id, staffId: Id, days = 3): Promise<SlotCandidate[]> {
  if (isApiMode()) return OnlineServer.getSlotCandidatesServer(businessId, staffId, days);
  return request(() => slotCandidatesOf(readCore(), businessId, staffId, days));
}

/**
 * О28 «Кого позвать»: по умолчанию — первый мастер (из `staffIds`, по порядку), у которого есть кого звать;
 * нет ни у кого — первый в списке.
 */
export function firstStaffWithCandidates(businessId: Id, staffIds: Id[]): Promise<Id | undefined> {
  if (isApiMode()) return OnlineServer.firstStaffWithCandidatesServer(businessId, staffIds);
  return request(() => {
    const core = readCore();
    return staffIds.find((id) => slotCandidatesOf(core, businessId, id, 3).length > 0) ?? staffIds[0];
  });
}

function slotCandidatesOf(core: CoreData, businessId: Id, staffId: Id, days: number): SlotCandidate[] {
  {
    const staff = core.staff.find((s) => s.id === staffId);
    if (!staff) return [];
    const bookings = core.bookings.filter((b) => !b.deletedAt && b.businessId === businessId && b.staffId === staffId);
    const clientsById = new Map(core.clients.filter((c) => c.businessId === businessId && !c.blocked && !c.deletedAt).map((c) => [c.id, c] as const));
    const out: SlotCandidate[] = [];
    const since90 = addDays(today(), -90);
    for (let d = 0; d < days && out.length < 8; d++) {
      const date = addDays(today(), d); // дни по Еревану, не по поясу устройства
      const slots = computeFreeSlots(core, { staffId, date, durationMin: 30 });
      for (const slot of slots) {
        if (out.length >= 8) break;
        const hour = Number(slot.start.slice(11, 13));
        // Один клиент — одно предложение: иначе «Кого позвать» звал одного и того же человека в 4 окна подряд
        const regular = bookings.find((b) => {
          // «Обычно ходит»: визит «Пришёл» за последние 90 дней — отменённые и неявки не в счёт
          if (b.status !== 'arrived' || b.start < since90) return false;
          const c = clientsById.get(b.clientId ?? '');
          if (!c || out.some((o) => o.clientId === c.id)) return false;
          const bh = Number(b.start.slice(11, 13));
          return Math.abs(bh - hour) <= 1;
        });
        if (regular?.clientId) {
          const c = clientsById.get(regular.clientId);
          if (c) {
            out.push({ slotStart: slot.start, staffId, clientId: c.id, clientName: c.name, clientPhone: c.phone, reason: 'regular', serviceId: regular.services[0]?.serviceId });
            continue;
          }
        }
      }
    }
    // «Пора снова» (⭐ по ритму клиента) — то же правило, что «Пора записать» в «Клиентах» и «Пора снова» в приложении
    // (dueAtOf, api/clients/shared): последний визит «Пришёл» к этому мастеру + самый короткий интервал повтора его
    // услуг (Service.repeatIntervalDays); у услуги нет интервала — срока нет; есть будущая активная запись в салоне —
    // не звать. Отменённые и неявки визитом не считаются. Самые «просроченные» — первыми.
    if (out.length < 8) {
      const nowIso = nowDateTime();
      const todayIso = today();
      const ACTIVE_AHEAD = ['scheduled', 'client_confirmed', 'awaiting_confirmation', 'awaiting_prepayment'];
      const hasFuture = new Set(
        core.bookings
          .filter((b) => !b.deletedAt && b.businessId === businessId && b.clientId && b.start > nowIso && ACTIVE_AHEAD.includes(b.status))
          .map((b) => b.clientId!),
      );
      const lastVisit = new Map<Id, Booking>();
      for (const b of bookings) {
        if (!b.clientId || b.status !== 'arrived') continue;
        const prev = lastVisit.get(b.clientId);
        if (!prev || b.start > prev.start) lastVisit.set(b.clientId, b);
      }
      const dueAtOf = (b: Booking): ISODate | undefined => {
        const days = b.services.map((l) => core.services.find((sv) => sv.id === l.serviceId)?.repeatIntervalDays).filter((n): n is number => Boolean(n && n > 0));
        return days.length ? addDays(b.start.slice(0, 10), Math.min(...days)) : undefined;
      };
      const dueAgain = [...lastVisit.entries()]
        .filter(([clientId]) => clientsById.has(clientId) && !hasFuture.has(clientId) && !out.some((o) => o.clientId === clientId))
        .map(([clientId, last]) => ({ clientId, dueAt: dueAtOf(last) }))
        .filter((x): x is { clientId: Id; dueAt: ISODate } => Boolean(x.dueAt && x.dueAt <= todayIso))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .map((x) => clientsById.get(x.clientId)!);
      const usedSlots = new Set(out.map((o) => o.slotStart));
      outer: for (let d = 0; d < days; d++) {
        const date = addDays(today(), d); // дни по Еревану, не по поясу устройства
        const slots = computeFreeSlots(core, { staffId, date, durationMin: 30 });
        for (const slot of slots) {
          if (out.length >= 8) break outer;
          if (usedSlots.has(slot.start)) continue;
          const client = dueAgain.shift();
          if (!client) break outer;
          out.push({ slotStart: slot.start, staffId, clientId: client.id, clientName: client.name, clientPhone: client.phone, reason: 'dueAgain' });
          usedSlots.add(slot.start);
        }
      }
    }
    return out;
  }
}

/** Приглашение одним нажатием: текст готов заранее, запись создаётся сразу в это окно (F-03-052) */
export function inviteToSlot(businessId: Id, candidate: SlotCandidate, message: string): Promise<SlotInvite> {
  if (isApiMode()) return OnlineServer.inviteToSlotServer(businessId, candidate, message);
  return request(async () => {
    const invite: SlotInvite = {
      id: newId('inv'),
      businessId,
      staffId: candidate.staffId,
      clientId: candidate.clientId,
      clientName: candidate.clientName,
      slotStart: candidate.slotStart,
      serviceId: candidate.serviceId,
      message,
      sentAt: nowDateTime(),
    };
    mutateArea('online', (s) => {
      s.slotInvites.push(invite);
    });
    return invite;
  });
}

export function listSlotInvites(businessId: Id): Promise<SlotInvite[]> {
  if (isApiMode()) return OnlineServer.listSlotInvitesServer(businessId);
  return request(() => readArea('online').slotInvites.filter((i) => i.businessId === businessId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
}

// ─────────────────────────── План визита: «любой мастер» и несколько мастеров подряд (О4, О8) ───────────────────────────

/**
 * Одна часть визита: услуги, которые делает один мастер подряд, и кто может их сделать. Один кандидат — клиент
 * выбрал мастера; несколько — «любой» (мастер назначается уже по выбранному времени, О8).
 */
export interface PlanLeg {
  serviceIds: Id[];
  staffIds: Id[];
  durationMin: number;
  /** Верхняя граница «от–до» (F-00-057) — бронируется она */
  durationMax?: number;
}

export interface PlanQuery {
  /** `Business.slug` — только для api */
  slug?: string;
  businessId: Id;
  locationId?: Id;
  workplace?: Workplace;
  /** Части визита по порядку. Одна часть — обычная запись; несколько — разные мастера подряд (О4) */
  legs: PlanLeg[];
  /** О1: дальше этой даты запись не открыта */
  maxDate?: ISODate;
}

export interface PlanLegSlot {
  staffId: Id;
  serviceIds: Id[];
  start: ISODateTime;
  durationMin: number;
}

/** Окно визита: когда начинается и кто что делает. Хранит дату — «Продолжить» сверяет её с выбранным днём (М1) */
export interface PlanSlot {
  date: ISODate;
  start: ISODateTime;
  end: ISODateTime;
  legs: PlanLegSlot[];
}

const bookedLegDuration = (leg: PlanLeg) => Math.max(leg.durationMin, leg.durationMax ?? leg.durationMin);

/** Сколько записей у мастера в этот день — при равенстве «любого» назначаем менее загруженного (О8) */
function staffDayLoad(core: CoreData, staffId: Id, date: ISODate): number {
  return core.bookings.filter(
    (b) => !b.deletedAt && b.staffId === staffId && b.start.slice(0, 10) === date && b.status !== 'cancelled_by_client' && b.status !== 'cancelled_by_master',
  ).length;
}

/**
 * Окна плана на день (мок). Первая часть — по сетке окон мастера (как у одиночной записи), следующие — ровно в конце
 * предыдущей: «свободно ли это время» у кандидата (сначала тот же мастер, что делал прошлую часть, потом менее
 * загруженный). `firstOnly` — хватит одного окна (отметки календаря).
 */
function planSlotsForDay(core: CoreData, q: PlanQuery, date: ISODate, firstOnly: boolean): PlanSlot[] {
  if (q.legs.length === 0 || (q.maxDate && date > q.maxDate)) return [];
  const now = nowDateTime();
  const [first, ...rest] = q.legs;
  const loads = new Map<Id, number>();
  const load = (id: Id) => {
    if (!loads.has(id)) loads.set(id, staffDayLoad(core, id, date));
    return loads.get(id)!;
  };
  const byStart = new Map<ISODateTime, Id[]>();
  for (const staffId of first.staffIds) {
    const slots = filterByWorkplace(
      filterByTravelBuffer(
        computeFreeSlots(core, {
          staffId,
          date,
          durationMin: first.durationMin,
          durationMax: first.durationMax && first.durationMax > first.durationMin ? first.durationMax : undefined,
          serviceId: first.serviceIds[0],
          locationId: q.locationId,
        }),
        core,
        staffId,
        date,
      ),
      q.workplace,
    );
    for (const sl of slots) byStart.set(sl.start, [...(byStart.get(sl.start) ?? []), staffId]);
  }
  const out: PlanSlot[] = [];
  for (const start of [...byStart.keys()].sort()) {
    const candidates = [...byStart.get(start)!].sort((a, b) => load(a) - load(b));
    for (const s0 of candidates) {
      const legs: PlanLegSlot[] = [{ staffId: s0, serviceIds: first.serviceIds, start, durationMin: bookedLegDuration(first) }];
      let t = addMinutes(start, bookedLegDuration(first));
      let ok = true;
      for (const leg of rest) {
        const prev = legs[legs.length - 1].staffId;
        const order = [...leg.staffIds].sort((a, b) => (a === prev ? -1 : b === prev ? 1 : load(a) - load(b)));
        const dur = bookedLegDuration(leg);
        const pick = order.find((staffId) =>
          isSlotFree(
            core,
            {
              staffId,
              start: t,
              durationMin: dur,
              bufferAfterMin: effectiveBufferMin(staffId, q.locationId),
              locationId: q.locationId,
              workplace: q.workplace && q.workplace !== 'visit' ? q.workplace : undefined,
            },
            now,
          ),
        );
        if (!pick) {
          ok = false;
          break;
        }
        legs.push({ staffId: pick, serviceIds: leg.serviceIds, start: t, durationMin: dur });
        t = addMinutes(t, dur);
      }
      if (!ok) continue;
      out.push({ date, start, end: t, legs });
      break;
    }
    if (firstOnly && out.length > 0) break;
  }
  return out;
}

/** То же для режима api: окна мастеров берём у сервера, следующие части — по его сетке (приближённо) */
async function planSlotsForDayApi(q: PlanQuery, date: ISODate, firstOnly: boolean): Promise<PlanSlot[]> {
  if (!q.slug || q.legs.length === 0 || (q.maxDate && date > q.maxDate)) return [];
  const slug = q.slug;
  const perLeg = await Promise.all(
    q.legs.map((leg) =>
      Promise.all(
        leg.staffIds.map((staffId) =>
          OnlineServer.getWidgetFreeSlotsServer(slug, {
            staffId,
            date,
            durationMin: leg.durationMin,
            durationMax: leg.durationMax,
            serviceId: leg.serviceIds[0],
            locationId: q.locationId,
            workplace: q.workplace,
          }).then((slots) => ({ staffId, starts: new Set(slots.map((x) => x.start)) })),
        ),
      ),
    ),
  );
  const starts = [...new Set(perLeg[0].flatMap((x) => [...x.starts]))].sort();
  const out: PlanSlot[] = [];
  for (const start of starts) {
    for (const c0 of perLeg[0].filter((x) => x.starts.has(start))) {
      const legs: PlanLegSlot[] = [{ staffId: c0.staffId, serviceIds: q.legs[0].serviceIds, start, durationMin: bookedLegDuration(q.legs[0]) }];
      let t = addMinutes(start, bookedLegDuration(q.legs[0]));
      let ok = true;
      for (let k = 1; k < q.legs.length; k++) {
        const prev = legs[legs.length - 1].staffId;
        const cand = [...perLeg[k]].sort((a, b) => (a.staffId === prev ? -1 : b.staffId === prev ? 1 : 0)).find((x) => x.starts.has(t));
        if (!cand) {
          ok = false;
          break;
        }
        legs.push({ staffId: cand.staffId, serviceIds: q.legs[k].serviceIds, start: t, durationMin: bookedLegDuration(q.legs[k]) });
        t = addMinutes(t, bookedLegDuration(q.legs[k]));
      }
      if (!ok) continue;
      out.push({ date, start, end: t, legs });
      break;
    }
    if (firstOnly && out.length > 0) break;
  }
  return out;
}

/** Окна визита на день — одиночный мастер, «любой» (объединение окон всех подходящих, О8) и цепочка мастеров (О4) */
export function getPlanSlots(q: PlanQuery, date: ISODate): Promise<PlanSlot[]> {
  if (isApiMode() && q.slug) return planSlotsForDayApi(q, date, false);
  return request(async () => {
    await releaseExpiredPrepayments(q.businessId);
    return planSlotsForDay(readCore(), q, date, false);
  });
}

/** Отметки «есть время» на каждый день месяца для плана (О11: считаются по ПОКАЗАННОМУ месяцу) */
export function getPlanMonthAvailability(q: PlanQuery, monthStart: ISODate): Promise<Record<ISODate, boolean>> {
  const first = monthStart.slice(0, 8) + '01';
  const days: ISODate[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d);
  if (isApiMode() && q.slug) {
    const slug = q.slug;
    const leg = q.legs[0];
    if (!leg) return Promise.resolve({});
    // Один кандидат/несколько — объединение месячных карт мастеров первой части (для цепочки — приближённо)
    return Promise.all(
      leg.staffIds.map((staffId) =>
        OnlineServer.getMonthAvailabilityServer(slug, staffId, leg.durationMin, first, {
          durationMax: leg.durationMax,
          serviceId: leg.serviceIds[0],
          locationId: q.locationId,
          workplace: q.workplace,
        }),
      ),
    ).then((maps) => {
      const out: Record<ISODate, boolean> = {};
      for (const d of days) out[d] = (!q.maxDate || d <= q.maxDate) && maps.some((m) => m[d]);
      return out;
    });
  }
  return request(() => {
    const core = readCore();
    const from = today();
    const out: Record<ISODate, boolean> = {};
    for (const d of days) out[d] = d >= from && planSlotsForDay(core, q, d, true).length > 0;
    return out;
  });
}

/** Ближайший день с окнами для плана (О8, О12): «любой» — самый ранний у всех подходящих мастеров */
export function getPlanNearestDate(q: PlanQuery, from: ISODate, maxDays = 60): Promise<ISODate | undefined> {
  const limit = q.maxDate && q.maxDate < addDays(from, maxDays) ? q.maxDate : addDays(from, maxDays);
  if (isApiMode() && q.slug) {
    return (async () => {
      for (let d = from; d <= limit; d = addDays(d, 1)) {
        if ((await planSlotsForDayApi(q, d, true)).length > 0) return d;
      }
      return undefined;
    })();
  }
  return request(() => {
    const core = readCore();
    for (let d = from; d <= limit; d = addDays(d, 1)) {
      if (planSlotsForDay(core, q, d, true).length > 0) return d;
    }
    return undefined;
  });
}

/**
 * О4: визит из нескольких частей — по записи на каждую часть, подряд, общим id группы (как пакет F-03-130), чтобы
 * «Вы записаны» показала их вместе. Одна часть — обычная запись. Все проверки — в createOnlineBooking.
 */
export function createPlanBookings(
  base: Omit<CreateOnlineBookingInput, 'services' | 'staffId' | 'start' | 'exactTime' | 'chainGroupId'>,
  planLegs: PlanLegSlot[],
): Promise<OnlineBookingResult[]> {
  // Подряд у одного и того же мастера — одна запись с несколькими услугами (иначе вторая часть «наезжает» на
  // запас после первой и не проходит проверку «свободно ли»)
  const legs: PlanLegSlot[] = [];
  for (const leg of planLegs) {
    const last = legs[legs.length - 1];
    if (last && last.staffId === leg.staffId && addMinutes(last.start, last.durationMin) === leg.start) {
      legs[legs.length - 1] = { ...last, serviceIds: [...last.serviceIds, ...leg.serviceIds], durationMin: last.durationMin + leg.durationMin };
    } else legs.push(leg);
  }
  if (legs.length === 1) {
    const [leg] = legs;
    return createOnlineBooking({ ...base, staffId: leg.staffId, start: leg.start, services: leg.serviceIds.map((serviceId) => ({ serviceId })) }).then((r) => [r]);
  }
  if (isApiMode()) {
    // ⭐ На сервере нет команды «цепочка записей»: создаём по одной (код проверяется на первой — дальше как повезёт)
    return (async () => {
      const out: OnlineBookingResult[] = [];
      for (const [i, leg] of legs.entries()) {
        // ⭐ Допродажа — к последней части визита (продление в конце не сдвигает следующие части)
        const addOns = i === legs.length - 1 ? base.addOns : undefined;
        out.push(await createOnlineBooking({ ...base, addOns, staffId: leg.staffId, start: leg.start, services: leg.serviceIds.map((serviceId) => ({ serviceId })) }));
      }
      return out;
    })();
  }
  return request(async () => {
    const groupId = newId('chain');
    const out: OnlineBookingResult[] = [];
    for (const [i, leg] of legs.entries()) {
      out.push(
        await createOnlineBooking({
          ...base,
          addOns: i === legs.length - 1 ? base.addOns : undefined,
          staffId: leg.staffId,
          start: leg.start,
          services: leg.serviceIds.map((serviceId) => ({ serviceId })),
          exactTime: i > 0,
          chainGroupId: groupId,
        }),
      );
    }
    return out;
  });
}

/** О4: все части визита (разные мастера подряд) — для «Вы записаны»; в api пока одна запись */
export interface VisitPart {
  bookingId: Id;
  start: ISODateTime;
  durationMin: number;
  staffName: string;
  serviceNames: LocalizedText[];
}

export function getVisitParts(bookingId: Id, hash: string): Promise<VisitPart[]> {
  if (isApiMode()) return Promise.resolve([]);
  return request(() => {
    const online = readArea('online');
    const meta = online.bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash || !meta.packageGroupId) return [];
    const core = readCore();
    const ids = Object.values(online.bookingMeta)
      .filter((m) => m.packageGroupId === meta.packageGroupId)
      .map((m) => m.bookingId);
    return core.bookings
      .filter((b) => ids.includes(b.id) && !b.deletedAt)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => ({
        bookingId: b.id,
        start: b.start,
        durationMin: b.durationMin,
        staffName: core.staff.find((st) => st.id === b.staffId)?.name ?? '',
        serviceNames: b.services.map((l) => core.services.find((sv) => sv.id === l.serviceId)?.name).filter((n): n is LocalizedText => Boolean(n)),
      }));
  });
}

/** B8: по ссылке без входа перенос даёт только мок; на сервере по ссылке — просмотр и отмена */
export function reschedulesByLink(): boolean {
  return !isApiMode();
}

// ─────────────────────────── ⭐ Напоминания в Telegram (30.09.2026) ───────────────────────────

/** Имя бота в демо — настоящего бота нет, ссылка в демо не открывается (см. connectBookingTelegramDemo) */
export const DEMO_TELEGRAM_BOT = 'booktime_bot';

/** Ссылка на бота для этой записи (клиент по ссылке без входа, F-03-098) и подключён ли уже его номер */
export function getBookingTelegramLink(bookingId: Id, hash: string): Promise<TelegramLinkInfo> {
  if (isApiMode()) return OnlineServer.bookingTelegramLinkServer(bookingId, hash);
  return request(() => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    const phone = bookingPhone(bookingId);
    // Как сервер: без телефона привязывать нечего — карточка на странице записи не показывается
    if (!phone) throw new ApiError('phone_required', 'У записи нет телефона');
    return { url: `https://t.me/${DEMO_TELEGRAM_BOT}?start=demo`, botUsername: DEMO_TELEGRAM_BOT, linked: Boolean(readArea('client').telegramLinked[phone]) };
  });
}

/** Демо: «клиент нажал Старт в боте» — номер записи отмечается подключённым (в api это делает сам бот) */
export function connectBookingTelegramDemo(bookingId: Id, hash: string): Promise<TelegramLinkInfo> {
  return request(() => {
    const meta = readArea('online').bookingMeta[bookingId];
    if (!meta || meta.accessHash !== hash) throw new ApiError('not_found', 'Запись не найдена');
    const phone = bookingPhone(bookingId);
    if (phone) mutateArea('client', (s) => void (s.telegramLinked[phone] = nowDateTime()));
    return { url: `https://t.me/${DEMO_TELEGRAM_BOT}?start=demo`, botUsername: DEMO_TELEGRAM_BOT, linked: Boolean(phone) };
  });
}

function bookingPhone(bookingId: Id): string | undefined {
  const core = readCore();
  const b = core.bookings.find((x) => x.id === bookingId);
  return b?.clientId ? core.clients.find((c) => c.id === b.clientId)?.phone : undefined;
}

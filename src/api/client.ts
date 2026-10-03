'use client';

/**
 * API раздела «client». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area';
 * сущности ядра — функции '@/api/core'. Экраны зовут эти функции через useApiQuery/useApiMutation.
 */
import {
  assertCan,
  canNow,
  coreCreate,
  coreRemove,
  coreTx,
  coreUpdate,
  createGroupEvent,
  currentActor,
  listGroupEvents,
  moderationHiddenIds,
  updateGroupEvent,
} from '@/api/core';
import { mutateArea, readArea, readCore } from '@/api/area';
import * as CS from '@/api/client.server';
import * as CLX from '@/api/clientLoyalty.server';
import { http, isApiMode } from '@/api/http';
import * as J from '@/api/journal.server';
import * as ST from '@/api/staff.server';
import * as SV from '@/api/services.server';
import * as SETS from '@/api/settings.server';
import { mirrorSnapshot, type CoreSnapshot as ServerCoreSnapshot } from '@/api/mirror';
import { ApiError, request } from '@/api/request';
import { attachReferralTx } from '@/api/referral';
import { getAccount, patchAccount, requestMyAccountDeletion } from '@/api/session';
import type { AccountView, SecondFactorChallenge, SessionView } from '@/api/session';
import { computeFreeSlots, getNearestSlots, type FreeSlot } from '@/api/schedule';
import { upsellGoodsLinesTx, upsellServiceLinesTx } from '@/api/services-upsell';
import { attachUpsellGoodsTx } from '@/api/journal';
import { waitlistTx } from '@/api/resources';
import {
  computeWaitlistStatus,
  findSameWaitlistRequest,
  waitlistDayOf,
  waitlistWantsSlot,
  wishesForDay,
  type WaitlistEntry as BusinessWaitlistEntry,
} from '@/domain/resources';
import type { BookingAddOns } from '@/domain/services';
import { submitForModeration } from '@/api/platform/moderation';
import { redeemPromo, validatePromo } from '@/api/platform/promo';
import { reportSearchDemand } from '@/api/platform/demand';
import {
  canCancelFree,
  canReschedule,
  clientCancelOutcome,
  effectiveBookingRules,
  freeCancelUntil,
  normalizeNoShowRule,
  prepaymentNeed,
  recentNoShows,
} from '@/domain/rules/booking-policy';
import { ACTIVE_STATUSES, isCancelled } from '@/domain/rules/booking-status';
import { busyIntervals, hasBookingOverlap, staffDayHours } from '@/domain/rules/busy';
import { roundMoney } from '@/domain/payroll';
import { bookedDuration } from '@/domain/rules/pricing';
import { isStaffBookableOnline, isStaffInCatalog, visibleServices } from '@/domain/rules/visibility';
import {
  canCallNow,
  canSeeHomeAddress,
  toPublicBusiness,
  toPublicLocation,
  toPublicService,
  toPublicStaff,
  type PublicBusiness,
  type PublicLocation,
  type PublicService,
  type PublicStaff,
} from '@/domain/rules/public';
import { BIZ } from '@/mock/seed/ids';
import { bookingPaymentBreakdown } from '@/domain/client';
import type {
  BookingPaymentBreakdown,
  BrandedAppAccessMethod,
  BrandedAppMaterials,
  BrandedAppOwnerType,
  BrandedAppRequest,
  CashbackCard,
  CertificateTemplate,
  DiaryEntry,
  EmployeeAppAccess,
  Favorite,
  FavoriteTargetType,
  GiftCertificate,
  LocationReview,
  Membership,
  MembershipTemplate,
  NetworkLocationsInfo,
  NewsPost,
  NotificationItem,
  NotificationKind,
  PromotionSettings,
  PurchaseStatus,
  ShadeChoice,
  ShadeMode,
  ShadeRequirement,
  StaffContacts,
  StaffReview,
  StarRating,
  Story,
  StoryLang,
  TimeFormat,
  VisitCashDesk,
  VisitPaymentLine,
  VisitPaymentMethod,
  VisitSaleLine,
  WaitlistEntry,
  TelegramLinkInfo,
} from '@/domain/client';
import { BRANDED_APP_DOCS_EMPTY, BRANDED_APP_MATERIALS_EMPTY, checkBrandedAppText, generateStoryImage } from '@/domain/client';
import { createSupportTicket } from '@/api/platform/support';
import type {
  AcceptsWhom,
  AppUser,
  Booking,
  BookingForWhom,
  Business,
  BookingSource,
  DistrictId,
  GroupEvent,
  ISODate,
  Id,
  ISODateTime,
  Location,
  LocalizedText,
  Minutes,
  Money,
  Network,
  Service,
  ServiceCategory,
  SphereId,
  Staff,
  StaffRole,
  TimeHM,
  StaffStatus,
  Workplace,
} from '@/domain/core';
import { addDays, addMinutes, dayjs, diffMinutes, eachDay, nowDateTime, today, toISODate, toISODateTime, toMinutes } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone, waLink } from '@/lib/phone';
import { normalizeSearch, pickText } from '@/lib/text';

/** Публичные DTO ядра, в которых экраны клиента получают мастера, место и услугу (arch-a1 №6) */
export type { PublicBusiness, PublicLocation, PublicService, PublicStaff } from '@/domain/rules/public';

/** Синонимы поиска «что ищете?» на трёх языках → сфера (F-00-110). Черновик, пока нет решения по полному списку. */
const SPHERE_SYNONYMS: Partial<Record<SphereId, string[]>> = {
  nails: ['ноготь', 'ногти', 'маникюр', 'педикюр', 'гель лак', 'nail', 'nails', 'manicure', 'pedicure', 'եղունգ'],
  barber: ['барбер', 'стрижка', 'борода', 'barber', 'haircut', 'beard', 'մորուք'],
  hair: ['волос', 'парикмахер', 'окрашивание', 'hair', 'hairdresser', 'մազ'],
  cosmetology: ['косметолог', 'чистка лица', 'cosmetology', 'facial', 'կոսմետոլոգ'],
  massage: ['массаж', 'massage', 'մերսում'],
  dental: ['зуб', 'стоматолог', 'dental', 'teeth', 'ատամ'],
  fitness: ['тренер', 'фитнес', 'fitness', 'trainer', 'ֆիթնես'],
  carwash: ['мойка', 'автомойка', 'carwash', 'car wash', 'լվացում'],
};

const CATALOG_DAYS = 14;
const CATALOG_SLOT_LIMIT = 3;
/** Длительность по умолчанию для расчёта окон в каталоге, когда услуги у мастера нет */
const CATALOG_DEFAULT_DURATION = 30;
/** От скольких состоявшихся визитов клиент считается «постоянным» (F-00-117) — решения нет, черновик */
const REGULAR_VISITS_THRESHOLD = 3;
/** Сколько ближайших окон показать на карточке мастера */
const MASTER_SLOT_LIMIT = 8;

/**
 * Строка каталога — только публичные DTO (arch-a1 №6, core-rules №5): без телефона, логина и домашнего адреса мастера.
 * `service` — услуга, под которую посчитаны окна: найденная поиском, иначе самая короткая у мастера (demo-q3/q4:
 * по самой долгой услуге сегодняшние окна пропадали). Ссылка окна сразу несёт эту услугу — запись в 2 нажатия.
 */
export interface CatalogEntry {
  staff: PublicStaff;
  business: PublicBusiness;
  location?: PublicLocation;
  service?: PublicService;
  nearestSlots: FreeSlot[];
  /** Горящее окно — свободно сегодня (F-00-103) */
  hotToday: boolean;
  /** Скидка на горящее окно, если мастер её задал (F-00-103) */
  hotDiscountPercent?: number;
  /** Бизнес продвигается «выше в поиске» за монеты (F-00-167) */
  boosted?: boolean;
  /** Расстояние до места, км — только при «Рядом со мной» */
  distanceKm?: number;
}

export interface CatalogQuery {
  search?: string;
  sphereId?: SphereId;
  district?: DistrictId;
  workplace?: Workplace;
  accepts?: AcceptsWhom;
  material?: string;
  freeToday?: boolean;
  /** Только с окнами завтра */
  freeTomorrow?: boolean;
  near?: { lat: number; lng: number };
  /** Ограничить список конкретным бизнесом (карточка места) */
  businessId?: Id;
  limit?: number;
}

/** У мастера с несколькими графиками на один филиал (переходный период) окна могут повториться */
function dedupeSlots(slots: FreeSlot[]): FreeSlot[] {
  const seen = new Set<string>();
  return slots.filter((s) => {
    const key = `${s.locationId}-${s.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

type CoreSnapshot = ReturnType<typeof readCore>;

/** Ближайшие окна мастера под длительность услуги — одинаково для каталога и карточки мастера (demo-q3: они расходились) */
function nearestSlotsFor(core: CoreSnapshot, staffId: Id, service: Service | undefined, limit: number): FreeSlot[] {
  const out: FreeSlot[] = [];
  for (let i = 0; i < CATALOG_DAYS && out.length < limit; i++) {
    out.push(
      ...computeFreeSlots(core, {
        staffId,
        date: addDays(today(), i),
        durationMin: service?.durationMin ?? CATALOG_DEFAULT_DURATION,
        bufferAfterMin: service?.bufferAfterMin,
      }),
    );
  }
  return dedupeSlots(out).slice(0, limit);
}

/** Самая короткая из услуг — под неё окон больше всего («для услуг от 45 мин») */
function shortestService(services: Service[]): Service | undefined {
  return services.reduce<Service | undefined>((best, s) => (!best || s.durationMin < best.durationMin ? s : best), undefined);
}

/** «Кто когда свободен»: каталог мастеров с ближайшими окнами (F-00-001, F-00-108…F-00-112) */
export function listCatalog(q: CatalogQuery = {}): Promise<CatalogEntry[]> {
  if (isApiMode()) return CS.listCatalogServer(q);
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    const todayIso = today();
    const tomorrowIso = addDays(todayIso, 1);
    const hiddenIds = moderationHiddenIds();
    const search = q.search ? normalizeSearch(q.search) : '';
    const searchSpheres = search
      ? (Object.keys(SPHERE_SYNONYMS) as SphereId[]).filter((sphere) =>
          SPHERE_SYNONYMS[sphere]!.some(
            (word) => normalizeSearch(word).includes(search) || search.includes(normalizeSearch(word)),
          ),
        )
      : [];

    const out: CatalogEntry[] = [];
    // Насколько запись подходит под поиск: 0 — услуга называется ровно так («Стрижка»), 1 — слово в названии услуги
    // («Мужская стрижка»), 2 — совпали только сфера, имя или салон. Сначала точные — потом по времени (сценарии 30.09)
    const relevance = new Map<CatalogEntry, number>();
    // Сколько раз мастер делал услугу за 90 дней — какую из найденных услуг показать (только когда есть поиск)
    const popularity = new Map<string, number>();
    if (search) {
      const since = addDays(todayIso, -90);
      for (const b of core.bookings) {
        if (b.deletedAt || b.start < since) continue;
        for (const l of b.services) {
          const key = `${l.staffId ?? b.staffId}|${l.serviceId}`;
          popularity.set(key, (popularity.get(key) ?? 0) + 1);
        }
      }
    }
    for (const staff of core.staff) {
      // Кого видно в каталоге — одно правило ядра: «По ссылке» и «Только мои» не в поиске, модерация, пауза, пустой профиль
      if (!isStaffInCatalog(core, staff, { hiddenIds })) continue;
      const business = core.businesses.find((b) => b.id === staff.businessId);
      if (!business) continue;
      if (q.businessId && business.id !== q.businessId) continue;
      if (q.sphereId && !staff.sphereIds.includes(q.sphereId)) continue;
      if (searchSpheres.length && !staff.sphereIds.some((sp) => searchSpheres.includes(sp))) continue;
      if (q.accepts && staff.accepts !== 'all' && staff.accepts !== q.accepts) continue;
      if (q.workplace && !staff.workplaces.includes(q.workplace)) continue;
      if (q.material && !staff.materials.some((m) => normalizeSearch(m).includes(normalizeSearch(q.material!)))) continue;

      const locations = core.locations.filter((l) => business.locationIds.includes(l.id));
      const services = visibleServices(core, staff, { hiddenIds });
      // Услуги по названию ищем всегда — и когда слово совпало со сферой: «стрижка» ведёт в барбер, но окна и ссылка
      // должны быть про стрижку, а не про самую короткую услугу мастера («Укладка», сценарии 30.09). Основа слова —
      // без последней буквы у длинных слов: «стрижка» находит и «Стрижки».
      const stem = search.length >= 5 ? search.slice(0, -1) : search;
      const nameHit = (text: string | undefined) => (text ? normalizeSearch(text).includes(stem) : false);
      const matched: Service[] = search ? services.filter((s) => nameHit(s.name.ru) || nameHit(s.name.en) || nameHit(s.name.hy)) : [];
      if (search && !searchSpheres.length) {
        // Салон по названию — клиент чаще всего ищет место, которое ему назвали (e2e-q2 №5)
        const placeHit =
          normalizeSearch(business.name).includes(search) ||
          locations.some((l) => normalizeSearch(l.name.ru).includes(search) || (l.name.en ? normalizeSearch(l.name.en).includes(search) : false));
        if (!normalizeSearch(staff.name).includes(search) && !matched.length && !placeHit) continue;
      }
      if (q.district && !locations.some((l) => l.district === q.district)) continue;

      const exact = matched.filter((s) => [s.name.ru, s.name.en, s.name.hy].some((n) => (n ? normalizeSearch(n) === search : false)));
      // Из найденных — та, что мастер делает чаще всего («Мужская стрижка», а не «Детская стрижка до 12 лет»), при равенстве —
      // название ближе к запросу (короче), потом короче по времени
      const closest = (list: Service[]) =>
        list.reduce<Service | undefined>((best, s) => {
          if (!best) return s;
          const p = (popularity.get(`${staff.id}|${s.id}`) ?? 0) - (popularity.get(`${staff.id}|${best.id}`) ?? 0);
          const d = s.name.ru.length - best.name.ru.length;
          return p > 0 || (p === 0 && (d < 0 || (d === 0 && s.durationMin < best.durationMin))) ? s : best;
        }, undefined);
      const service = exact.length ? shortestService(exact) : matched.length ? closest(matched) : shortestService(services);
      const nearest = nearestSlotsFor(core, staff.id, service, CATALOG_SLOT_LIMIT);
      if (!nearest.length) continue; // «пустые» — тоже не показываем (F-00-072)
      const hotToday = nearest.some((s) => s.start.startsWith(todayIso));
      if (q.freeToday && !hotToday) continue;
      if (q.freeTomorrow && !nearest.some((s) => s.start.startsWith(tomorrowIso))) continue;

      const location = locations.find((l) => l.id === nearest[0]?.locationId) ?? locations[0];
      const promo = readArea('client').promotionSettings[business.id];
      const boosted = Boolean(promo?.boostSearch?.active && promo.boostSearch.expiresAt > now);
      const entry: CatalogEntry = {
        staff: toPublicStaff(staff, { hiddenIds }),
        business: toPublicBusiness(business, { hiddenIds }),
        location: location ? toPublicLocation(location) : undefined,
        service: service ? toPublicService(service, { hiddenIds }) : undefined,
        nearestSlots: nearest,
        hotToday,
        hotDiscountPercent: hotToday ? promo?.hotSlotDiscountPercent : undefined,
        boosted,
        distanceKm: q.near && location?.coords ? haversineKm(q.near, location.coords) : undefined,
      };
      relevance.set(entry, exact.length ? 0 : matched.length ? 1 : 2);
      out.push(entry);
    }

    const rank = (e: CatalogEntry) => relevance.get(e) ?? 2;
    if (q.near) {
      out.sort((a, b) => rank(a) - rank(b) || (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));
    } else {
      out.sort((a, b) => rank(a) - rank(b) || a.nearestSlots[0].start.localeCompare(b.nearestSlots[0].start));
      // Продвижение «выше в поиске» (F-00-167): одно купленное место первым, остальные — по времени (ux-best-c3 №5:
      // три «Реклама» подряд ничего не выделяют). Реклама не обгоняет более точное совпадение с поиском.
      const topRank = out.length ? rank(out[0]) : 0;
      const firstBoosted = out.findIndex((e) => e.boosted && rank(e) === topRank);
      if (firstBoosted > 0) out.unshift(...out.splice(firstBoosted, 1));
    }
    return q.limit ? out.slice(0, q.limit) : out;
  });
}

/** Постоянные клиенты мастера — только по состоявшимся визитам (recheck-c1: будущие и неявки не считаются) */
function countRegulars(core: CoreSnapshot, staffId: Id): number {
  const perClient = new Map<Id, number>();
  for (const b of core.bookings) {
    if (b.deletedAt || !b.clientId || b.status !== 'arrived') continue;
    if (b.staffId !== staffId && !b.services.some((s) => s.staffId === staffId)) continue;
    perClient.set(b.clientId, (perClient.get(b.clientId) ?? 0) + 1);
  }
  return [...perClient.values()].filter((n) => n >= REGULAR_VISITS_THRESHOLD).length;
}

/** Каналы связи мастера: поле ядра Staff.contacts (пишет staff), пока его нет — черновик в срезе */
function staffContactsFor(staff: Staff): StaffContacts {
  const fromCore = staff.contacts;
  if (fromCore) {
    return {
      whatsapp: Boolean(fromCore.whatsapp),
      telegram: fromCore.telegram,
      instagram: fromCore.instagram,
      callMode: fromCore.callMode ?? 'messages',
    };
  }
  return readArea('client').contacts[staff.id] ?? { whatsapp: true, callMode: 'always' };
}

export interface MasterContactsView extends StaffContacts {
  /** Номер мастера — только если открыт звонок или WhatsApp (F-00-104, DTO без телефона по умолчанию) */
  phone?: string;
  /** Звонок открыт прямо сейчас (правило ядра canCallNow) */
  callOpenNow: boolean;
}

/** Место, где принимает мастер: «дома» до подтверждённой записи — только район (F-00-077) */
export interface MasterPlace extends PublicLocation {
  isHome: boolean;
}

export interface MasterCard {
  staff: PublicStaff;
  business: PublicBusiness;
  locations: MasterPlace[];
  services: PublicService[];
  contacts: MasterContactsView;
  regularsCount: number;
  /** Сколько клиентов поставили ★ (F-00-116) — без имён и текста */
  starCount: number;
  /** С какого месяца бизнес на платформе (F-00-117 «в приложении с …» — не дата найма) */
  onPlatformSince: ISODate;
  /** Ближайшие окна и услуга, под которую они посчитаны */
  nearestSlots: FreeSlot[];
  slotService?: PublicService;
  /** Токен «Закрыть окно» (F-00-107) на nearestSlots[0] — есть, только если ближайшее окно нашлось */
  claimToken?: Id;
}

/** Карточка мастера для клиента (F-00-123, F-00-108: не отдаём скрытого/замороженного — по ссылке тоже) */
export function getMasterCard(staffId: Id, viewerAppUserId?: Id, serviceId?: Id): Promise<MasterCard | undefined> {
  if (isApiMode()) return CS.getMasterCardServer(staffId, serviceId).catch((e) => (e instanceof ApiError && e.code === 'not_found' ? undefined : Promise.reject(e)));
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    if (!staff) return undefined;
    const business = core.businesses.find((b) => b.id === staff.businessId);
    if (!business) return undefined;
    const hiddenIds = moderationHiddenIds();
    if (!isStaffBookableOnline(core, staff, { hiddenIds })) return undefined;
    const now = nowDateTime();
    const revealHome = canSeeHomeAddress(core, staff.id, { appUserId: viewerAppUserId });
    const homeOnly = business.kind === 'individual' && staff.workplaces.length === 1 && staff.workplaces[0] === 'home';
    const locations: MasterPlace[] = core.locations
      .filter((l) => business.locationIds.includes(l.id) && staff.locationIds.includes(l.id))
      .map((l) => {
        const pub = toPublicLocation(l);
        // Студия «дома» у частного мастера — до подтверждённой записи только район (F-00-077)
        return homeOnly && !revealHome ? { ...pub, address: { ru: '' }, yandexMapsUrl: undefined, isHome: true } : { ...pub, isHome: homeOnly };
      });
    const services = visibleServices(core, staff, { hiddenIds });
    // Пришли из поиска («стрижка») — окна под найденную услугу; иначе под самую короткую (окон под неё больше всего)
    const slotService = services.find((s) => s.id === serviceId) ?? shortestService(services);
    const contacts = staffContactsFor(staff);
    const phoneOpen = contacts.whatsapp || contacts.callMode !== 'messages';
    const busy = busyIntervals(core, staff.id, today(), { now }).map((b) => ({ from: b.from, to: b.to }));
    const nearestSlots = nearestSlotsFor(core, staff.id, slotService, MASTER_SLOT_LIMIT);
    const next = nearestSlots[0];
    // F-00-107: свитч мастера — /biz/online/settings, StaffOnlineRules.addClaimLinkToMessage (нет записи/поля — включено)
    const onlineStaffRules = (readArea('online') as { staffRules?: Record<Id, { addClaimLinkToMessage?: boolean }> }).staffRules?.[staff.id];
    const claimLinkEnabled = onlineStaffRules?.addClaimLinkToMessage ?? true;
    return {
      staff: toPublicStaff(staff, { hiddenIds, revealHomeAddress: revealHome }),
      business: toPublicBusiness(business, { hiddenIds }),
      locations,
      services: services.map((s) => toPublicService(s, { hiddenIds })),
      contacts: {
        ...contacts,
        phone: phoneOpen ? staff.phone : undefined,
        callOpenNow: canCallNow({ contacts: { callMode: contacts.callMode }, callHours: staff.callHours }, now, busy),
      },
      regularsCount: countRegulars(core, staffId),
      starCount: readArea('client').starRatings.filter((r) => r.staffId === staffId).length,
      onPlatformSince: business.createdAt.slice(0, 10),
      nearestSlots,
      slotService: slotService ? toPublicService(slotService, { hiddenIds }) : undefined,
      claimToken:
        next && claimLinkEnabled
          ? ensureClaimToken({ businessId: business.id, staffId: staff.id, serviceId: slotService?.id, start: next.start, appUserId: viewerAppUserId })
          : undefined,
    };
  });
}

export interface PlaceStaffRow {
  staff: PublicStaff;
  nextSlot?: FreeSlot;
}

export interface PlaceCard {
  business: PublicBusiness;
  locations: PublicLocation[];
  categories: ServiceCategory[];
  services: PublicService[];
  staff: PlaceStaffRow[];
  regularsCount: number;
  /** Сеть места, если у неё больше одного филиала (F-14-163) */
  network?: NetworkLocationsInfo;
}

/**
 * Карточка места/компании (F-14-028, F-14-030, F-00-024/108: заморожен → 404). В «Мастерах» — те же, что в каталоге
 * (decision-c3 №16: «Только мои» и администраторы не наполняют карточку), у каждого ближайшее окно.
 */
export function getPlaceCard(businessId: Id): Promise<PlaceCard | undefined> {
  if (isApiMode()) return CS.getPlaceCardServer(businessId).catch((e) => (e instanceof ApiError && e.code === 'not_found' ? undefined : Promise.reject(e)));
  return request(() => {
    const core = readCore();
    const business = core.businesses.find((b) => b.id === businessId);
    if (!business || business.status !== 'active') return undefined;
    const hiddenIds = moderationHiddenIds();
    const locations = core.locations.filter((l) => business.locationIds.includes(l.id));
    const categories = core.serviceCategories.filter((c) => c.businessId === businessId);
    const staffList = core.staff.filter((s) => s.businessId === businessId && isStaffInCatalog(core, s, { hiddenIds }));
    const visibleStaffIds = new Set(staffList.map((s) => s.id));
    const services = core.services.filter(
      (s) => s.businessId === businessId && s.active && s.onlineBookable && !hiddenIds.has(s.id) && s.staffIds.some((id) => visibleStaffIds.has(id)),
    );
    const regularsCount = staffList.reduce((sum, s) => sum + countRegulars(core, s.id), 0);
    const net = businessNetwork(core, business);
    return {
      business: toPublicBusiness(business, { hiddenIds }),
      locations: locations.map(toPublicLocation),
      categories,
      services: services.map((s) => toPublicService(s, { hiddenIds, visibleStaffIds })),
      staff: staffList.map((s) => ({
        staff: toPublicStaff(s, { hiddenIds }),
        nextSlot: nearestSlotsFor(core, s.id, shortestService(visibleServices(core, s, { hiddenIds })), 1)[0],
      })),
      regularsCount,
      network: net ? networkLocationsInfo(core, net) : undefined,
    };
  });
}

// ─────────────────────────── Филиал сети по умолчанию (F-14-163) ───────────────────────────

function defaultNetworkLocationKey(appUserId: Id, networkId: Id): string {
  return `${appUserId}:${networkId}`;
}

/** Филиал сети, выбранный клиентом по умолчанию — undefined, если ещё не выбирал (тогда берётся основная локация) */
export function getDefaultNetworkLocation(appUserId: Id | undefined, networkId: Id): Promise<Id | undefined> {
  if (isApiMode()) return appUserId ? CS.getDefaultNetworkLocationServer(networkId) : Promise.resolve(undefined);
  return request(() => (appUserId ? readArea('client').defaultNetworkLocation[defaultNetworkLocationKey(appUserId, networkId)] : undefined));
}

/** Клиент сети выбирает филиал по умолчанию (F-14-163); переживает перезагрузку */
export function setDefaultNetworkLocation(appUserId: Id, networkId: Id, businessId: Id): Promise<void> {
  if (isApiMode()) return CS.setDefaultNetworkLocationServer(networkId, businessId);
  return request(() => {
    mutateArea('client', (s) => {
      s.defaultNetworkLocation[defaultNetworkLocationKey(appUserId, networkId)] = businessId;
    });
  });
}

/** Источники записи, которые считаются «клиент записался сам через приложение или веб» (F-14-009, F-00-118) */
const SELF_BOOKED_SOURCES: BookingSource[] = ['app', 'link', 'widget'];

/**
 * Мастера клиента: «Мои мастера» — только те, к кому клиент сам записался через приложение или веб
 * (F-14-009, F-00-118, черновик до F-00-113 в b03). Мастера, у которых клиент есть только в CRM бизнеса
 * (записан администратором в журнале, по телефону и т. п.), сюда не попадают — иначе клиенту стало бы
 * видно, что его завели в чужой CRM (F-00-010, F-00-130).
 */
export function listBookedMasters(appUserId: Id, limit = 6): Promise<Staff[]> {
  if (isApiMode()) return CS.listBookedMastersServer(limit);
  return request(() => {
    const core = readCore();
    const staffIds = new Set(
      core.bookings
        .filter((b) => b.appUserId === appUserId && !b.deletedAt && SELF_BOOKED_SOURCES.includes(b.source))
        .map((b) => b.staffId),
    );
    return core.staff.filter((s) => staffIds.has(s.id)).slice(0, limit);
  });
}

// ─────────────────────────── Связь с мастером (F-00-104…F-00-106) ───────────────────────────

export interface CallbackInput {
  staffId: Id;
  phone: string;
  name?: string;
}

export function requestCallback(input: CallbackInput): Promise<void> {
  if (isApiMode()) return CS.requestCallbackServer(input);
  return request(() => {
    mutateArea('client', (s) => {
      s.callbackRequests.push({
        id: newId('cbr'),
        createdAt: nowDateTime(),
        ...input,
      });
    });
  });
}

// ─────────────────────────── Закрыть окно ссылкой из переписки (F-00-107) ───────────────────────────
// Идея владельца, 26.09.2026: готовый текст (F-00-104) несёт ссылку <origin>/claim/<token> на ближайшее
// окно; мастер открывает её в переписке и закрывает окно без входа в журнал. Токен минтится вместе с
// карточкой мастера (getMasterCard) — к моменту, когда клиент реально нажмёт «Написать», ссылка уже
// готова и не требует лишнего сетевого шага перед window.open (см. ContactBlock).
//
// ⚠️ Переключатель «Добавлять ссылку в текст клиента» (сценарий, п. 4) владеет online
// (/biz/online/settings — чужой путь). Пока просьба не выполнена (qa/requests/client.md), ссылка
// добавляется всегда — как «включено по умолчанию».

const CLAIM_EXPIRY_DAYS = 7;

function isClaimExpired(claim: { start: ISODateTime; createdAt: ISODateTime }, now: ISODateTime): boolean {
  return claim.start < now || diffMinutes(claim.createdAt, now) >= CLAIM_EXPIRY_DAYS * 24 * 60;
}

interface EnsureClaimTokenInput {
  businessId: Id;
  staffId: Id;
  serviceId?: Id;
  start: ISODateTime;
  appUserId?: Id;
}

/** Найти уже выданный на то же окно и того же клиента живой токен — иначе завести новый (F-00-107) */
function ensureClaimToken(input: EnsureClaimTokenInput): Id {
  const now = nowDateTime();
  const appUser = input.appUserId ? readCore().appUsers.find((u) => u.id === input.appUserId) : undefined;
  const existing = readArea('client').claims.find(
    (c) =>
      c.status === 'pending' &&
      !isClaimExpired(c, now) &&
      c.businessId === input.businessId &&
      c.staffId === input.staffId &&
      c.serviceId === input.serviceId &&
      c.start === input.start &&
      (c.clientPhone ?? '') === (appUser?.phone ?? ''),
  );
  if (existing) return existing.token;
  const token = newId('clm');
  mutateArea('client', (s) => {
    s.claims.push({
      token,
      businessId: input.businessId,
      staffId: input.staffId,
      serviceId: input.serviceId,
      start: input.start,
      clientName: appUser?.name,
      clientPhone: appUser?.phone,
      createdAt: now,
      status: 'pending',
    });
  });
  return token;
}

export type ClaimViewStatus = 'ready' | 'wrong_actor' | 'expired' | 'used' | 'taken';

export interface ClaimView {
  status: ClaimViewStatus;
  /** Заполнено, только если это действительно мастер этого окна (иначе wrong_actor ничего не раскрывает) */
  staffName?: string;
  businessName?: string;
  serviceName?: LocalizedText;
  start?: ISODateTime;
  clientName?: string;
  clientPhone?: string;
  usedBookingId?: Id;
}

/**
 * Карточка ссылки «Закрыть окно» (F-00-107). Право на это окно — то же, что у журнала (`journal.create` на
 * `targetStaffId`): свой мастер, а также владелец/администратор с правом «чужие записи» — так же, как они
 * создают запись в журнале за любого сотрудника. Не мастер этого окна и не вошёл вовсе — 'wrong_actor',
 * без деталей окна (F-00-107: «клиенту по ней — ничего»).
 */
export function getClaimByToken(token: string): Promise<ClaimView> {
  // Режим api (этап 7): ссылка живёт на сервере; «мастер ли это окна» — по сессии (journal.create на мастера окна)
  if (isApiMode()) return J.getClaim<ClaimView>(token);
  return request(() => {
    const claim = readArea('client').claims.find((c) => c.token === token);
    if (!claim || !canNow('journal.create', { targetStaffId: claim.staffId })) return { status: 'wrong_actor' };
    const core = readCore();
    const staff = core.staff.find((s) => s.id === claim.staffId);
    const business = core.businesses.find((b) => b.id === claim.businessId);
    const service = claim.serviceId ? core.services.find((s) => s.id === claim.serviceId) : undefined;
    const shared = { start: claim.start, staffName: staff?.name, businessName: business?.name, serviceName: service?.name };
    if (claim.status === 'used') return { status: 'used', ...shared, usedBookingId: claim.usedBookingId };
    const now = nowDateTime();
    if (isClaimExpired(claim, now)) return { status: 'expired', ...shared };
    const duration = service ? bookedDuration(service) : 30;
    if (hasBookingOverlap(core, claim.staffId, claim.start, duration)) return { status: 'taken', ...shared };
    return { status: 'ready', ...shared, clientName: claim.clientName, clientPhone: claim.clientPhone };
  });
}

/**
 * «Закрыть окно» (F-00-107): создаёт запись — единый поток ядра coreTx.placeBooking (окно, занятость,
 * право journal.create — та же проверка, что и у getClaimByToken выше), source: 'phone' (готового отдельного
 * «по мессенджеру» источника у ядра нет — ближайший существующий, common.bookingSource.phone; см.
 * qa/requests/client.md). Занято другим — ApiError('slot_taken') из самого planBooking (проверка окна ядра,
 * не своя копия).
 */
export function closeSlotFromClaim(token: string): Promise<{ bookingId: Id }> {
  if (isApiMode()) return J.closeClaim(token);
  return request(() => {
    const claim = readArea('client').claims.find((c) => c.token === token);
    if (!claim) throw new ApiError('not_found');
    if (!canNow('journal.create', { targetStaffId: claim.staffId })) throw new ApiError('forbidden');
    if (claim.status === 'used') throw new ApiError('already_used');
    if (isClaimExpired(claim, nowDateTime())) throw new ApiError('expired');
    const { booking } = coreTx.placeBooking({
      source: 'phone',
      businessId: claim.businessId,
      staffId: claim.staffId,
      start: claim.start,
      services: claim.serviceId ? [{ serviceId: claim.serviceId }] : [],
      client: claim.clientPhone ? { phone: claim.clientPhone, name: claim.clientName } : undefined,
      staffAssignment: 'specific',
    });
    mutateArea('client', (s) => {
      const c = s.claims.find((x) => x.token === token);
      if (c) {
        c.status = 'used';
        c.usedBookingId = booking.id;
      }
    });
    return { bookingId: booking.id };
  });
}

// ─────────────────────────── «Не нашли?» (F-00-112) ───────────────────────────

export interface DemandLeadInput {
  query: string;
  sphereId?: SphereId;
  district?: DistrictId;
  phone?: string;
  /** Вошедший клиент — номер известен, заявка уходит и в отчёт спроса нашей панели (F-00-180) */
  appUserId?: Id;
}

/**
 * «Сообщить, когда появится» (F-00-112): своя заявка (чтобы клиенту написать, когда мастер появится) и — у вошедшего
 * с выбранным районом — строка в отчёте спроса нашей панели (decision-c1 №14: раньше до панели не доходило).
 */
export async function submitDemandLead(input: DemandLeadInput): Promise<void> {
  if (isApiMode()) return CS.submitDemandLeadServer(input);
  await request(() => {
    mutateArea('client', (s) => {
      s.demandLeads.push({ id: newId('lead'), createdAt: nowDateTime(), query: input.query, sphereId: input.sphereId, district: input.district, phone: input.phone });
    });
  });
  if (input.appUserId && input.district) {
    await reportSearchDemand({ query: input.query, sphereId: input.sphereId, district: input.district, appUserId: input.appUserId, notify: true });
  }
}

// ─────────────────────────── Вход клиента (F-00-032, F-14-006…F-14-008) ───────────────────────────

export type LoginChannel = 'whatsapp' | 'telegram' | 'sms';

/** Порядок каналов кода, как на сервере: Telegram (дешёвый) → WhatsApp → SMS (дорогой, запасной) */
export const LOGIN_CHANNELS: readonly LoginChannel[] = ['telegram', 'whatsapp', 'sms'];

/** Код ушёл: куда на самом деле (сервер мог отправить в запасной канал) и какие каналы ещё можно предложить */
export interface LoginCodeSent {
  channel: LoginChannel;
  channels: LoginChannel[];
  /** Через сколько секунд можно попросить новый код (в любой канал) */
  resendAfter: number;
}

/** Демо: повтор через 30 с (сервер — 60 с, он сам присылает resendAfter) */
const DEMO_RESEND_AFTER_SEC = 30;

/** Куда можно прислать код — экран входа показывает выбор только из включённых каналов. В демо — все. */
export async function getLoginChannels(): Promise<LoginChannel[]> {
  if (isApiMode()) return (await http<{ channels: LoginChannel[] }>('GET', '/v1/auth/channels')).channels;
  return request(() => [...LOGIN_CHANNELS]);
}

/** Отправить код входа. В демо код всегда '0000' — показывается подсказкой на экране. */
export async function sendLoginCode(phone: string, channel: LoginChannel): Promise<LoginCodeSent> {
  if (isApiMode()) {
    // Сервер: 4 цифры, 5 минут, повтор через 60 с (ApiError code_resend_wait с retryAfter), только +374.
    // Канал не доставил (у номера нет Telegram) — сервер сам шлёт тот же код в следующий включённый канал.
    const sent = await http<LoginCodeSent>('POST', '/v1/auth/code', { phone, channel });
    return { channel: sent.channel, channels: sent.channels ?? [sent.channel], resendAfter: sent.resendAfter };
  }
  return request(() => {
    if (!normalizePhone(phone)) throw new ApiError('invalid_phone');
    // Демо не отправляет настоящих сообщений — канал только определяет подсказку на экране
    return { channel, channels: [...LOGIN_CHANNELS], resendAfter: DEMO_RESEND_AFTER_SEC };
  });
}

export interface VerifyLoginInput {
  name: string;
  phone: string;
  code: string;
  /** Принято пользовательское соглашение и разрешена обработка данных (F-14-008) — без него вход не завершается */
  consent: boolean;
  /** «Войти через Google» с непривязанным аккаунтом: верный код привяжет этот Google к номеру (03.10.2026) */
  pendingGoogle?: string;
}

/** Вошли по коду; с pendingGoogle — привязался ли Google (false — ожидание истекло или этот Google уже у другого) */
export type VerifiedAppUser = AppUser & { googleLinked?: boolean };

const DEMO_CODE = '0000';

/**
 * Проверить код и войти: найти клиента приложения по номеру или завести нового (F-14-007, F-14-008) — одна операция,
 * вместе с отметкой согласия. Экран после успеха зовёт apply({ persona: 'client', appUser: user.id }).
 */
/** Сессия сервера → AppUser экранов (у человека на сервере нет пола/района — их знает профиль, этап 9) */
function appUserOfSession(session: SessionView): AppUser {
  return {
    id: session.user.id,
    phone: session.user.phone ?? '',
    name: session.user.name,
    gender: 'unknown',
    locale: session.user.locale,
    createdAt: nowDateTime(),
  };
}

export async function verifyLoginCode(input: VerifyLoginInput): Promise<VerifiedAppUser> {
  if (isApiMode()) {
    const session = await http<SessionView & { googleLinked?: boolean }>('POST', '/v1/auth/verify', {
      phone: input.phone,
      code: input.code,
      app: 'client',
      name: input.name,
      consent: input.consent,
      pendingGoogle: input.pendingGoogle,
    });
    return { ...appUserOfSession(session), googleLinked: session.googleLinked };
  }
  return request(() => {
    if (!input.consent) throw new ApiError('consent_required');
    if (input.code !== DEMO_CODE) throw new ApiError('wrong_code');
    const normalized = normalizePhone(input.phone);
    if (!normalized) throw new ApiError('invalid_phone');
    const now = nowDateTime();
    const user =
      readCore().appUsers.find((u) => u.phone === normalized) ??
      coreTx.create('appUsers', { phone: normalized, name: input.name.trim() || normalized, gender: 'unknown', locale: 'ru', createdAt: now });
    mutateArea('client', (s) => {
      s.consents[user.id] = now;
    });
    return user;
  });
}

/** Клиент принял соглашение при входе (F-14-008)? Читается для решения, показывать ли личные разделы. */
export async function hasLoginConsent(appUserId: Id | undefined): Promise<boolean> {
  if (isApiMode()) {
    if (!appUserId) return false;
    const r = await http<{ accepted: boolean }>('GET', '/v1/me/consent').catch(() => ({ accepted: false }));
    return r.accepted;
  }
  return request(() => Boolean(appUserId && readArea('client').consents[appUserId]));
}

// ─────────────────────────── Вход бизнеса и регистрация (F-00-033…F-00-035) ───────────────────────────

/** Вход мастера/индивидуала/владельца по номеру телефона и коду — тем же демо-кодом, что у клиента (F-00-033) */
/** hasBusiness: false — номер вошёл, но бизнеса у человека ещё нет (экран ведёт на регистрацию бизнеса) */
export async function verifyBusinessPhoneLogin(input: {
  phone: string;
  code: string;
  pendingGoogle?: string;
}): Promise<{ hasBusiness: boolean; googleLinked?: boolean }> {
  if (isApiMode()) {
    const view = await http<SessionView & { googleLinked?: boolean }>('POST', '/v1/auth/verify', {
      phone: input.phone,
      code: input.code,
      app: 'business',
      pendingGoogle: input.pendingGoogle,
    });
    return { hasBusiness: view.memberships.length > 0, googleLinked: view.googleLinked };
  }
  return request(() => {
    if (input.code !== DEMO_CODE) throw new ApiError('wrong_code');
    if (!normalizePhone(input.phone)) throw new ApiError('invalid_phone');
    return { hasBusiness: true };
  });
}

// ─────────────────────────── «Войти через Google» (03.10.2026) ───────────────────────────

/** Google-аккаунт ещё не привязан: номер и код один раз, token — в verify (pendingGoogle) */
export interface PendingGoogle {
  token: string;
  email: string;
  name: string | null;
}

export type GoogleSignInResult =
  /** Google привязан к номеру — вошли. user — клиент приложения (null в демо: демо-клиент по умолчанию) */
  | { kind: 'signedIn'; user: AppUser | null; hasBusiness: boolean }
  /** Не привязан — экран просит номер и код, «привяжем Google к номеру» */
  | { kind: 'linkRequired'; pending: PendingGoogle };

/** Web Client ID из Google Cloud Console; без него на живом сайте кнопки «Войти через Google» нет */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** Показывать ли «Войти через Google»: живой сайт — если задан Client ID; демо — всегда (вход имитируется) */
export function googleSignInAvailable(): boolean {
  return isApiMode() ? Boolean(GOOGLE_CLIENT_ID) : true;
}

/**
 * Войти через Google: idToken — от Google Identity Services. Сервер проверяет токен; привязан — сессия, нет — pending.
 * Демо (без настоящего Google): сразу вход демо-персоной — клиент по умолчанию или владелец салона.
 */
export async function signInWithGoogle(input: { idToken?: string; app: 'client' | 'business'; consent?: boolean }): Promise<GoogleSignInResult> {
  if (isApiMode()) {
    const r = await http<{ session: SessionView | null; pendingGoogle: (PendingGoogle & { expiresIn: number }) | null }>('POST', '/v1/auth/google', {
      idToken: input.idToken,
      app: input.app,
      consent: input.consent,
    });
    if (r.session) return { kind: 'signedIn', user: appUserOfSession(r.session), hasBusiness: r.session.memberships.length > 0 };
    if (r.pendingGoogle) return { kind: 'linkRequired', pending: { token: r.pendingGoogle.token, email: r.pendingGoogle.email, name: r.pendingGoogle.name } };
    throw new ApiError('google_invalid');
  }
  // Демо: клиент — демо-клиент по умолчанию (как resolveDemoContext), бизнес — владелец салона
  return request(() => ({ kind: 'signedIn' as const, user: input.app === 'client' ? (readCore().appUsers[0] ?? null) : null, hasBusiness: true }));
}

/** Профиль: привязан ли Google (email) и включён ли вход через Google на сервере */
export interface GoogleLinkStatus {
  enabled: boolean;
  email: string | null;
}

export function getGoogleLink(appUserId: Id): Promise<GoogleLinkStatus> {
  if (isApiMode()) return http<GoogleLinkStatus>('GET', '/v1/auth/google/link');
  return request(() => ({ enabled: true, email: readArea('client').googleLinked?.[appUserId] ?? null }));
}

/** Привязать Google к вошедшему (прежний заменяется). Демо — без настоящего Google: почта из имени клиента */
export function linkGoogle(appUserId: Id, idToken?: string): Promise<GoogleLinkStatus> {
  if (isApiMode()) return http<GoogleLinkStatus>('POST', '/v1/auth/google/link', { idToken });
  return request(() => {
    const user = readCore().appUsers.find((u) => u.id === appUserId);
    const local = (user?.name ?? 'client').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'client';
    const email = `${local}@gmail.com`;
    mutateArea('client', (s) => void ((s.googleLinked ??= {})[appUserId] = email));
    return { enabled: true, email };
  });
}

export function unlinkGoogle(appUserId: Id): Promise<GoogleLinkStatus> {
  if (isApiMode()) return http<GoogleLinkStatus>('DELETE', '/v1/auth/google/link');
  return request(() => {
    mutateArea('client', (s) => void delete s.googleLinked?.[appUserId]);
    return { enabled: true, email: null };
  });
}

export interface AdminLoginInput {
  login: string;
  password: string;
}

function loginKey(login: string): string {
  return login.trim().toLowerCase();
}

/**
 * Вход администратора логином и паролем, которые выдал владелец (F-00-034). Настоящих учёток нет — демо принимает
 * пароль от 4 символов; логин === пароль — «первый вход» (просим сменить). После смены пароль запоминается: старый
 * больше не подходит, окно «Придумайте пароль» не показывается (recheck-c3 F-00-034).
 */
export interface AdminLoginResult {
  requirePasswordChange: boolean;
  /** Включена двухэтапная проверка (F-15-159): нужен код с телефона — verifySecondFactor */
  secondFactor?: SecondFactorChallenge;
}

export async function verifyAdminLogin(input: AdminLoginInput): Promise<AdminLoginResult> {
  if (isApiMode()) {
    const r = await http<SessionView | { secondFactor: SecondFactorChallenge }>('POST', '/v1/auth/password', {
      login: input.login,
      password: input.password,
    });
    if ('secondFactor' in r) return { requirePasswordChange: false, secondFactor: r.secondFactor };
    return { requirePasswordChange: r.mustChangePassword };
  }
  return request(() => {
    const key = loginKey(input.login);
    if (!key) throw new ApiError('bad_login');
    if (input.password.length < 4) throw new ApiError('wrong_password');
    const saved = readArea('client').adminPasswords[key];
    if (saved !== undefined) {
      if (saved !== input.password) throw new ApiError('wrong_password');
      return { requirePasswordChange: false };
    }
    return { requirePasswordChange: input.password.toLowerCase() === key };
  });
}

/** Новый пароль администратора после первого входа (F-00-034) */
export async function changeAdminPassword(login: string, newPassword: string, oldPassword?: string): Promise<void> {
  if (isApiMode()) {
    // Сервер знает вход из сессии; при первом входе (пароль выдан владельцем) старый пароль не нужен
    await http('POST', '/v1/auth/password/change', { newPassword, oldPassword: oldPassword || undefined });
    return;
  }
  return request(() => {
    const key = loginKey(login);
    if (!key) throw new ApiError('bad_login');
    if (newPassword.length < 6 || newPassword.toLowerCase() === key) throw new ApiError('weak_password');
    mutateArea('client', (s) => {
      s.adminPasswords[key] = newPassword;
    });
  });
}

export type RegisterBusinessType = 'individual' | 'salon';

export interface RegisterBusinessInput {
  type: RegisterBusinessType;
  sphereIds: SphereId[];
  promoCode?: string;
  name: string;
  phone: string;
}

export interface RegisterBusinessResult {
  persona: 'individual' | 'owner';
  businessId: Id;
  /** Промокод принят и погашен (F-00-020) */
  promoApplied: boolean;
}

/** Проверить промокод на шаге «Промокод» (F-00-020): код уже использован / истёк / выдан другому — ошибкой под полем */
export function checkRegistrationPromo(code: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  return validatePromo(code).then((r) => (r.ok ? { ok: true as const } : { ok: false as const, reason: r.reason }));
}

/**
 * Регистрация бизнеса: тип, сфера(ы), промокод, название и телефон (F-00-035). Демо без бэкенда — новый бизнес
 * занимает пустой демо-бизнес («Новый салон / Новый мастер — пусто»): ядро получает введённые название, сферы и
 * телефон, экран переключает персону на него (recheck-c3: раньше открывался чужой наполненный Nuri). Промокод
 * гасится командой нашей панели redeemPromo — второй раз тот же код не примется (decision-c3 №10).
 */
export async function registerBusiness(input: RegisterBusinessInput): Promise<RegisterBusinessResult> {
  if (isApiMode()) {
    // Сервер (этап 3): бизнес + филиал + владелец, сессия переходит в «Мой бизнес». Промокод сохраняется на бизнесе и
    // применяется разделом подписки (этап 18) — до него promoApplied = false. Бизнес зеркалится в ядро браузера.
    const res = await http<RegisterBusinessResult & { core: ServerCoreSnapshot }>(
      'POST',
      '/v1/biz',
      { kind: input.type, name: input.name, sphereIds: input.sphereIds, phone: input.phone, promoCode: input.promoCode?.trim() || undefined },
      { idempotencyKey: crypto.randomUUID() },
    );
    mirrorSnapshot(res.core);
    return { persona: res.persona, businessId: res.businessId, promoApplied: res.promoApplied };
  }
  const phone = normalizePhone(input.phone);
  const promo = input.promoCode?.trim();
  // Код проверяем ДО записи в ядро: неверный код не должен оставить полусозданный бизнес
  if (promo) {
    const check = await validatePromo(promo);
    if (!check.ok) throw new ApiError(`promo_${check.reason}`);
  }
  const businessId = await request(() => {
    if (!phone) throw new ApiError('invalid_phone');
    if (!input.name.trim()) throw new ApiError('bad_name');
    if (input.sphereIds.length === 0) throw new ApiError('bad_sphere');
    const id = input.type === 'individual' ? BIZ.emptySolo : BIZ.empty;
    const business = readCore().businesses.find((b) => b.id === id);
    if (!business) throw new ApiError('not_found');
    const slug = coreTx.uniqueBusinessSlug(input.name);
    coreTx.update('businesses', id, { name: input.name.trim(), phone, sphereIds: input.sphereIds, slug, status: 'active' });
    if (business.ownerStaffId) coreTx.update('staff', business.ownerStaffId, { phone, sphereIds: input.sphereIds });
    // Единственный филиал нового бизнеса называется, как сам бизнес (settings.md: оставался «Новый салон» из демо)
    const locations = readCore().locations.filter((l) => business.locationIds.includes(l.id));
    if (locations.length === 1) {
      const title = input.name.trim();
      coreTx.update('locations', locations[0].id, { name: { ru: title, en: title, hy: title } });
    }
    return id;
  });
  let promoApplied = false;
  if (promo) {
    const res = await redeemPromo(promo, businessId);
    if (!res.ok) throw new ApiError(`promo_${res.reason}`);
    promoApplied = true;
  }
  return { persona: input.type === 'individual' ? 'individual' : 'owner', businessId, promoApplied };
}

// ─────────────────────────── Запись из карточки мастера (F-00-031, F-00-108) ───────────────────────────

export interface BookAppointmentInput {
  appUserId: Id;
  staffId: Id;
  serviceId: Id;
  /** Начало окна, взятое из ближайших свободных окон */
  start: ISODateTime;
  comment?: string;
  locationId?: Id;
  /** Где оказывается услуга: у окна свой (FreeSlot.workplace), у выезда — всегда «выезд» (F-00-073, F-00-079) */
  workplace?: Workplace;
  /** Адрес для выезда к клиенту (F-00-080) */
  visitAddress?: string;
  /** Для кого запись (F-00-125) */
  forWhom?: BookingForWhom;
  /** Имя ребёнка/питомца/другого посетителя, если forWhom !== 'self' (F-00-125) */
  visitorName?: string;
  /** Выбор оттенка/варианта (F-00-094…096) */
  shade?: ShadeChoice;
  /** Число мест группового события (F-14-023) */
  seats?: number;
  groupEventId?: Id;
  /** Пришёл со «Записаться» в сторис (F-00-162, F-14-035) — считает bookingCount той сторис */
  storyId?: Id;
  /** Списать визит с этого абонемента (F-14-165) — только если он покрывает услугу */
  membershipId?: Id;
  /** ⭐ «Оплатить всё сразу» вместо предоплаты мастера */
  payInFull?: boolean;
  /** «Пригласи подругу»: код из личной ссылки (lib/referralCapture) — привязку решает attachReferralTx */
  referralCode?: string;
  /** ⭐ Допродажа: сопутствующие услуги (продлевают запись) и товары (к оплате на визите) из карточки услуги */
  addOns?: BookingAddOns;
}

/** Какой ответ ждёт клиента после записи — экран «Готово» пишет это словами (ux-r2 улучшение 1) */
export interface BookAppointmentResult {
  booking: Booking;
  /** Списано с абонемента: сколько визитов осталось */
  membershipLeft?: { left: number; total: number };
}

/** Абонемент покрывает услугу, только если услуга названа в нём явно (ux-best-c3 №1: «массажи» не списываются за маникюр) */
function membershipCovers(m: Membership, service: Service | undefined, todayIso: ISODate): boolean {
  return (
    m.active &&
    !m.frozen &&
    m.visitsLeft > 0 &&
    m.validUntil >= todayIso &&
    Boolean(service) &&
    m.serviceNames.length > 0 &&
    m.serviceNames.includes(service!.name.ru)
  );
}

/**
 * Создать запись клиента приложения (F-00-031, F-00-108, F-00-092/093/097) — ОДНА операция, один request():
 * окно, статус (сразу / с подтверждением / выезд — всегда с подтверждением), предоплата, клиент по номеру решает
 * единый поток ядра coreTx.placeBooking; следом в той же транзакции — оттенок, счётчик сторис и списание абонемента.
 * Ошибка — ApiError(code) (тексты common.bookingErrors.<code>).
 */
export function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  if (isApiMode()) return CS.bookAppointmentServer(input);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === input.staffId);
    if (!staff) throw new ApiError('not_found');
    const service = core.services.find((s) => s.id === input.serviceId);
    // Выезд — только на услугу, которая его предлагает; иначе место берётся из окна графика
    const workplace: Workplace | undefined =
      input.workplace ?? (service && service.workplaces.length === 1 ? service.workplaces[0] : undefined);
    const { booking } = coreTx.placeBooking(
      {
        // F-00-093: запись из клиентского приложения помечается источником 'app' — карточку и статистику
        // по источнику показывают журнал/финансы/панель (не наши пути), здесь — только простановка метки
        source: 'app',
        businessId: staff.businessId,
        staffId: staff.id,
        start: input.start,
        // ⭐ Допродажа: сопутствующие — строками той же записи у того же мастера (окно проверяется под всю длительность)
        services: [{ serviceId: input.serviceId, qty: input.seats ?? 1 }, ...(input.groupEventId ? [] : upsellServiceLinesTx([input.serviceId], input.addOns?.serviceIds))],
        locationId: input.locationId,
        workplace,
        client: { appUserId: input.appUserId },
        forWhom: input.forWhom,
        visitorName: input.visitorName,
        comment: input.comment,
        groupEventId: input.groupEventId,
        staffAssignment: 'specific',
        payInFull: input.payInFull,
      },
      {
        isStartOffered: (q) => computeFreeSlots(readCore(), q).some((s) => s.start === q.start),
      },
    );
    // «Пригласи подругу»: новый клиент по личной ссылке — пригласившая запоминается на его карточке (rules/referral)
    if (input.referralCode && booking.clientId) attachReferralTx(booking.businessId, booking.clientId, input.referralCode, booking.id);
    // ⭐ Допродажа: товары — строки «товары визита» филиала записи (цена склада, остаток проверен)
    if (!input.groupEventId && input.addOns?.productIds.length) {
      attachUpsellGoodsTx(
        booking.id,
        upsellGoodsLinesTx({ businessId: staff.businessId, locationId: booking.locationId, staffId: staff.id, mainServiceIds: [input.serviceId], productIds: input.addOns.productIds }),
      );
    }
    let membershipLeft: BookAppointmentResult['membershipLeft'];
    mutateArea('client', (s) => {
      if (input.shade) s.bookingShade[booking.id] = input.shade;
      // Адрес выезда — мастеру после подтверждения (F-00-080); у записи ядра такого поля нет, храним по id записи
      if (booking.workplace === 'visit' && input.visitAddress?.trim()) s.visitAddress[booking.id] = input.visitAddress.trim();
      // Реальная запись из сторис — единственный источник bookingCount (F-14-035)
      if (input.storyId) {
        const story = s.stories.find((x) => x.id === input.storyId);
        if (story) story.bookingCount += 1;
      }
      if (input.membershipId) {
        const m = s.memberships.find((x) => x.id === input.membershipId && x.appUserId === input.appUserId);
        if (m && membershipCovers(m, service, today()) && !s.membershipUsedForBooking[booking.id]) {
          m.visitsLeft -= 1;
          s.membershipUsedForBooking[booking.id] = m.id;
          membershipLeft = { left: m.visitsLeft, total: m.visitsTotal };
        }
      }
    });
    const { comment: _comment, ...clientSafe } = booking;
    return { booking: clientSafe as Booking, membershipLeft };
  });
}

// ─────────────────────────── Оттенок/вариант при записи (F-00-094…096) ───────────────────────────

export interface ShadeOption {
  value: string;
  mode: ShadeMode;
  /** Только для mode === 'material' */
  material?: string;
}

export interface ShadeStepInfo {
  requirement: ShadeRequirement | 'none';
  options: ShadeOption[];
}

/**
 * Варианты при записи (F-00-094, F-00-096): спрашиваем, только если услуга просит выбор (Service.shadeChoice, пишет
 * services). Остаток и «под заказ» не показываем, пока склад не отдаёт палитру (e2e-q4 №4: «В наличии» ничего не значило).
 */
export function getShadeOptions(serviceId: Id): Promise<ShadeStepInfo> {
  if (isApiMode()) return CS.getShadeOptionsServer(serviceId);
  return request(() => {
    const service = readCore().services.find((s) => s.id === serviceId);
    if (!service || !service.shadeChoice || service.materials.length === 0) return { requirement: 'none', options: [] };
    const options: ShadeOption[] = [
      ...service.materials.map((material) => ({ value: material, mode: 'material' as const, material })),
      { value: '__master__', mode: 'master' },
      { value: '__own__', mode: 'own' },
    ];
    return { requirement: service.shadeChoice, options };
  });
}

// ─────────────────────────── Окна для потока записи (F-00-092, F-14-012) ───────────────────────────

export interface BookingSlotDay {
  date: ISODate;
  slots: FreeSlot[];
}

/**
 * Окна мастера на N дней вперёд под длительность услуги, по дням (шаг «Время» в /book, F-00-092). Для выезда — окна
 * графика выезда, если он у мастера есть (decision-c3 №1).
 */
export function getBookingDays(staffId: Id, serviceId: Id, workplace?: Workplace, days = 14): Promise<BookingSlotDay[]> {
  if (isApiMode()) return CS.getBookingDaysServer(staffId, serviceId, workplace, days);
  return request(() => {
    const core = readCore();
    const service = core.services.find((s) => s.id === serviceId);
    if (!service) return [];
    const onlyPlace = workplace && core.schedules.some((sch) => sch.staffId === staffId && sch.workplace === workplace) ? workplace : undefined;
    const out: BookingSlotDay[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(today(), i);
      const slots = dedupeSlots(
        computeFreeSlots(core, {
          staffId,
          date,
          durationMin: service.durationMin,
          bufferAfterMin: service.bufferAfterMin,
          serviceId,
        }),
      ).filter((s) => !onlyPlace || s.workplace === onlyPlace);
      if (slots.length) out.push({ date, slots });
    }
    return out;
  });
}

/**
 * Какие услуги мастера помещаются в выбранное окно (ux-r1 №32, ux-r2 №2): остальные на шаге «Услуга» недоступны
 * с подсказкой «не помещается — выберите другое время».
 */
export function listServicesFittingSlot(staffId: Id, start: ISODateTime): Promise<Id[]> {
  if (isApiMode()) {
    return (async () => {
      const card = await CS.getMasterCardServer(staffId).catch(() => undefined);
      if (!card) return [];
      const date = start.slice(0, 10);
      const hits = await Promise.all(
        card.services.map(async (svc) => {
          const slots = await CS.getSlotsServer(staffId, date, svc.id).catch(() => []);
          return slots.some((s) => s.start === start) ? svc.id : undefined;
        }),
      );
      return hits.filter((id): id is Id => Boolean(id));
    })();
  }
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    if (!staff) return [];
    return visibleServices(core, staff, { hiddenIds: moderationHiddenIds() })
      .filter((svc) =>
        computeFreeSlots(core, { staffId, date: start.slice(0, 10), durationMin: svc.durationMin, bufferAfterMin: svc.bufferAfterMin, serviceId: svc.id }).some(
          (s) => s.start === start,
        ),
      )
      .map((svc) => svc.id);
  });
}

/** Абонемент клиента, которым можно оплатить эту услугу здесь (F-14-165) — только если покрывает её явно */
/**
 * Визит по абонементу возвращается, если запись снята без вины клиента или вовремя (qa 30.09: заявку сняли по сроку
 * ответа мастера, а визит оставался списанным): отменил мастер, мастер не ответил, не пришла предоплата, клиент
 * отменил до срока бесплатной отмены. Поздняя отмена клиентом — визит сгорает, как предоплата. Только внутри request().
 */
function returnMembershipVisitsOfCancelled(appUserId: Id): void {
  const used = readArea('client').membershipUsedForBooking;
  const ids = Object.keys(used);
  if (!ids.length) return;
  const bookings = readCore().bookings;
  const refundable = ids.filter((id) => {
    const b = bookings.find((x) => x.id === id);
    return Boolean(b && b.appUserId === appUserId && (b.deletedAt || isCancelled(b)) && !b.cancelledLate);
  });
  if (!refundable.length) return;
  mutateArea('client', (s) => {
    for (const id of refundable) {
      const m = s.memberships.find((x) => x.id === s.membershipUsedForBooking[id]);
      if (m) m.visitsLeft = Math.min(m.visitsTotal, m.visitsLeft + 1);
      delete s.membershipUsedForBooking[id];
    }
  });
}

/** ⭐ Почему мастер просит у меня предоплату: не пришёл `noShows` раз за `months` месяцев при пороге `count` */
export interface MyPrepaymentNeed {
  noShows: number;
  count: number;
  months: number;
}

/**
 * ⭐ Нужна ли мне предоплата у этого мастера из-за пропущенных визитов (владелец, 01.10.2026) — шаг «Подтверждение»
 * говорит об этом ДО записи. Только про себя; счётчик — у этого мастера (В-07). null — по этой причине не нужна.
 * Сервер: GET /v1/me/prepayment-need; запись всё равно проверяет единый поток place() / planBooking.
 */
export function getMyPrepaymentNeed(appUserId: Id, staffId: Id): Promise<MyPrepaymentNeed | null> {
  if (isApiMode()) return http<MyPrepaymentNeed | null>('GET', `/v1/me/prepayment-need?staffId=${encodeURIComponent(staffId)}`);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    const rule = staff?.prepayment;
    if (!staff || !rule?.onlyAfterNoShows) return null;
    const { months } = normalizeNoShowRule(rule.onlyAfterNoShows);
    const card = core.clients.find((c) => c.businessId === staff.businessId && c.appUserId === appUserId && !c.deletedAt);
    const noShows = recentNoShows(core.bookings, { staffId, clientId: card?.id, appUserId, now: nowDateTime(), months });
    const need = prepaymentNeed(rule, noShows);
    return need?.reason === 'no_shows' ? { noShows: need.noShows, count: need.count, months: need.months } : null;
  });
}

export function getBookingMembershipOption(appUserId: Id, businessId: Id, serviceId: Id): Promise<Membership | undefined> {
  if (isApiMode()) return appUserId ? CLX.orUndefined(CLX.me<Membership | null>('getBookingMembershipOption', [businessId, serviceId])) : Promise.resolve(undefined);
  return request(() => {
    returnMembershipVisitsOfCancelled(appUserId);
    const service = readCore().services.find((s) => s.id === serviceId);
    const todayIso = today();
    return readArea('client').memberships.find(
      (m) => m.appUserId === appUserId && m.businessId === businessId && membershipCovers(m, service, todayIso),
    );
  });
}

// ─────────────────────────── Мои записи (F-14-011…F-14-057, F-00-092…102, 107, 118, 125) ───────────────────────────

/** Запись клиента для списков: публичные мастер/место, район, без заметки администратора (F-00-130) */
export interface EnrichedBooking extends Omit<Booking, 'comment'> {
  staff: PublicStaff;
  business: PublicBusiness;
  service?: PublicService;
  location?: PublicLocation;
  /** Визит списан с абонемента самим клиентом при записи (не выдумка по хэшу — e2e-q4 №1) */
  byMembership: boolean;
}

function enrichBooking(core: CoreSnapshot, b: Booking): EnrichedBooking | undefined {
  const staff = core.staff.find((s) => s.id === b.staffId);
  const business = core.businesses.find((biz) => biz.id === b.businessId);
  if (!staff || !business) return undefined;
  const service = core.services.find((s) => s.id === b.services[0]?.serviceId);
  const location = core.locations.find((l) => l.id === b.locationId);
  // `comment` — заметка администратора в CRM, клиенту не показываем НИЧЕГО из неё (F-00-130, F-00-010).
  const { comment: _comment, ...clientSafeBooking } = b;
  return {
    ...clientSafeBooking,
    staff: toPublicStaff(staff),
    business: toPublicBusiness(business),
    service: service ? toPublicService(service) : undefined,
    location: location ? toPublicLocation(location) : undefined,
    byMembership: Boolean(readArea('client').membershipUsedForBooking[b.id]),
  };
}

export interface ClientBookingsResult {
  upcoming: EnrichedBooking[];
  past: EnrichedBooking[];
  cancelled: EnrichedBooking[];
}

function bookingEndsAfter(b: Booking, now: ISODateTime): boolean {
  return addMinutes(b.start, b.durationMin) > now;
}

/** Три списка записей клиента (F-14-011): предстоящие / прошедшие / отменённые. Просроченные предоплаты снимает ядро */
export function listMyBookings(appUserId: Id): Promise<ClientBookingsResult> {
  if (isApiMode()) return CS.listMyBookingsServer();
  return request(() => {
    coreTx.releaseExpiredPrepayments({ appUserId });
    returnMembershipVisitsOfCancelled(appUserId);
    const core = readCore();
    const now = nowDateTime();
    const all = core.bookings.filter((b) => b.appUserId === appUserId && !b.deletedAt).sort((a, b) => b.start.localeCompare(a.start));
    const enrich = (list: Booking[]) => list.map((b) => enrichBooking(core, b)).filter((b): b is EnrichedBooking => Boolean(b));
    return {
      upcoming: enrich(all.filter((b) => !isCancelled(b) && bookingEndsAfter(b, now)).reverse()),
      past: enrich(all.filter((b) => !isCancelled(b) && !bookingEndsAfter(b, now))),
      cancelled: enrich(all.filter((b) => isCancelled(b))),
    };
  });
}

/** Ближайшие активные записи клиента для главной — та же строка, что в «Моих записях» (ux-r2 №47) */
export function listUpcomingBookings(appUserId: Id, limit = 3): Promise<EnrichedBooking[]> {
  if (isApiMode()) {
    return listMyBookings(appUserId).then((r) => r.upcoming.filter((b) => ACTIVE_STATUSES.includes(b.status)).slice(0, limit));
  }
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    return core.bookings
      .filter((b) => b.appUserId === appUserId && !b.deletedAt && ACTIVE_STATUSES.includes(b.status) && bookingEndsAfter(b, now))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, limit)
      .map((b) => enrichBooking(core, b))
      .filter((b): b is EnrichedBooking => Boolean(b));
  });
}

export interface RepeatSuggestion {
  booking: EnrichedBooking;
  /** Ближайшее окно того же мастера под ту же услугу */
  nextSlot?: FreeSlot;
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
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    const mine = core.bookings.filter((b) => b.appUserId === appUserId && !b.deletedAt);
    const today = now.slice(0, 10);
    // Кандидаты — визиты, к чьему мастеру нет предстоящей записи и мастера можно записать онлайн; первыми те, у кого
    // срок повтора услуги (repeatIntervalDays) уже наступил («Пора снова»), потом самые свежие
    const candidates = mine
      .filter((b) => b.status === 'arrived')
      .filter((b) => !mine.some((m) => m.staffId === b.staffId && ACTIVE_STATUSES.includes(m.status) && bookingEndsAfter(m, now)))
      .filter((b) => {
        const st = core.staff.find((s) => s.id === b.staffId);
        return Boolean(st && isStaffBookableOnline(core, st, { hiddenIds: moderationHiddenIds() }));
      });
    const isDue = (b: Booking): boolean => {
      const days = b.services.map((l) => core.services.find((sv) => sv.id === l.serviceId)?.repeatIntervalDays).filter((n): n is number => Boolean(n && n > 0));
      return days.length > 0 && addMinutes(b.start, Math.min(...days) * 24 * 60).slice(0, 10) <= today;
    };
    const last = candidates.sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || b.start.localeCompare(a.start))[0];
    if (!last) return undefined;
    const staff = core.staff.find((s) => s.id === last.staffId);
    if (!staff) return undefined;
    const booking = enrichBooking(core, last);
    if (!booking) return undefined;
    const service = core.services.find((s) => s.id === last.services[0]?.serviceId);
    return { booking, nextSlot: nearestSlotsFor(core, staff.id, service, 1)[0] };
  });
}

/** Записи клиента в одной компании (F-14-026) — ближайшая предстоящая первой, потом прошедшие по убыванию */
export function listMyBookingsInBusiness(appUserId: Id, businessId: Id): Promise<EnrichedBooking[]> {
  if (isApiMode()) return CS.listMyBookingsInBusinessServer(businessId);
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    const mine = core.bookings.filter((b) => b.appUserId === appUserId && b.businessId === businessId && !b.deletedAt);
    const upcoming = mine.filter((b) => !isCancelled(b) && bookingEndsAfter(b, now)).sort((a, b) => a.start.localeCompare(b.start));
    const rest = mine.filter((b) => !upcoming.includes(b)).sort((a, b) => b.start.localeCompare(a.start));
    return [...upcoming, ...rest].map((b) => enrichBooking(core, b)).filter((b): b is EnrichedBooking => Boolean(b));
  });
}

export interface BookingDetail {
  booking: Omit<Booking, 'comment'>;
  staff: PublicStaff;
  business: PublicBusiness;
  service?: PublicService;
  location?: PublicLocation;
  shade?: ShadeChoice;
  /** До какого момента держится предоплата (F-00-097) */
  prepaymentDeadline?: ISODateTime;
  /** Куда перевести предоплату — реквизиты из правила мастера (Staff.prepayment.requisites), только владельцу записи */
  prepaymentRequisites?: string;
  /** Клиент нажал «Я оплатил» — ждём, пока мастер сверит деньги (В-05) */
  prepaymentReported?: boolean;
  /** Срок бесплатной отмены и можно ли ещё отменить без последствий — решает сервер, не часы телефона (arch-a1 №8) */
  freeCancelUntil: ISODateTime;
  canCancelFree: boolean;
  /** Клиент может отменить сам (мастер не запретил отмену / отмену оплаченной, визит не начался). Нет поля — можно */
  canCancel?: boolean;
  /** ⭐ В-04: при отмене позже срока внесённая предоплата остаётся мастеру (нет поля — остаётся) */
  keepPrepaymentOnLateCancel?: boolean;
  /** Перенос разрешён правилами мастера сейчас */
  canReschedule: boolean;
  /** Визит списан с абонемента самим клиентом */
  byMembership: boolean;
  /** Адрес выезда, который клиент указал при записи (F-00-080) */
  visitAddress?: string;
  /** Списания лояльности, выгода абонемента, начисленный кэшбэк, товары (F-14-019…024) */
  payment: BookingPaymentBreakdown;
}

/**
 * Детали одной записи клиента (F-14-011…F-14-057). Отдаётся только владельцу (F-00-092, decision-c1 block №1):
 * по прямой ссылке /bookings/[id] чужая запись не видна и не управляется.
 */
export function getBooking(bookingId: Id, viewerAppUserId: Id | undefined): Promise<BookingDetail | undefined> {
  if (isApiMode()) return CS.getBookingServer(bookingId).catch((e) => (e instanceof ApiError && e.code === 'not_found' ? undefined : Promise.reject(e)));
  return request(() => {
    if (!viewerAppUserId) return undefined;
    coreTx.releaseExpiredPrepayments({ appUserId: viewerAppUserId });
    returnMembershipVisitsOfCancelled(viewerAppUserId);
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId && !b.deletedAt);
    if (!booking || booking.appUserId !== viewerAppUserId) return undefined;
    const staff = core.staff.find((s) => s.id === booking.staffId);
    const business = core.businesses.find((b) => b.id === booking.businessId);
    if (!staff || !business) return undefined;
    const service = core.services.find((s) => s.id === booking.services[0]?.serviceId);
    const location = core.locations.find((l) => l.id === booking.locationId);
    const area = readArea('client');
    const rules = effectiveBookingRules(business, staff);
    const now = nowDateTime();
    const { comment: _comment, ...clientSafeBooking } = booking;
    const usedMembershipId = area.membershipUsedForBooking[booking.id];
    const usedMembership = usedMembershipId ? area.memberships.find((m) => m.id === usedMembershipId) : undefined;
    const seats = booking.services[0]?.qty ?? 1;
    return {
      booking: clientSafeBooking,
      staff: toPublicStaff(staff, { revealHomeAddress: canSeeHomeAddress(core, staff.id, { appUserId: viewerAppUserId }) }),
      business: toPublicBusiness(business),
      service: service ? toPublicService(service) : undefined,
      location: location ? toPublicLocation(location) : undefined,
      shade: area.bookingShade[booking.id],
      prepaymentDeadline: booking.prepayment?.holdUntil,
      prepaymentRequisites: booking.prepayment ? staff.prepayment?.requisites : undefined,
      prepaymentReported: Boolean(readArea('online').bookingMeta[booking.id]?.prepaymentReportedAt),
      freeCancelUntil: freeCancelUntil(booking, rules),
      canCancelFree: canCancelFree(booking, rules, now),
      canCancel: clientCancelOutcome(booking, rules, now).allowed,
      keepPrepaymentOnLateCancel: rules.keepPrepaymentOnLateCancel,
      canReschedule: canReschedule(booking, rules, now).allowed,
      byMembership: Boolean(usedMembershipId),
      visitAddress: area.visitAddress[booking.id],
      payment: bookingPaymentBreakdown({
        bookingId: booking.id,
        total: booking.total,
        status: booking.status,
        seats,
        paidByMembership: Boolean(usedMembershipId),
        membershipTotalPrice: usedMembership?.price,
        membershipVisits: usedMembership?.visitsTotal,
      }),
    };
  });
}

/** Запись принадлежит этому клиенту приложения? (F-00-092) — только внутри request() */
function ownBookingOrThrow(bookingId: Id, viewerAppUserId: Id | undefined): Booking {
  const booking = readCore().bookings.find((b) => b.id === bookingId && !b.deletedAt);
  if (!booking) throw new ApiError('not_found');
  if (!viewerAppUserId || booking.appUserId !== viewerAppUserId) throw new ApiError('forbidden');
  return booking;
}

/** Клиент подтвердил, что придёт (F-14-057) — переход статуса по правилу ядра */
export function confirmBookingByClient(bookingId: Id, viewerAppUserId: Id | undefined): Promise<Booking> {
  if (isApiMode()) return CS.confirmBookingByClientServer(bookingId);
  return request(() => {
    ownBookingOrThrow(bookingId, viewerAppUserId);
    return coreTx.changeBookingStatus(bookingId, 'client_confirmed', 'client');
  });
}

/**
 * «Оплата отправлена» по ручной предоплате (F-00-097, В-05) — таймер останавливается, дальше решает мастер: запись
 * попадает в «Заявки» с кнопкой «Деньги пришли» (online.confirmPrepaymentReceived), как у записи из виджета. Раньше
 * отметка сразу ставила «оплачено» — мастер не сверял деньги, а на визите их считали полученными.
 */
export function markPrepaymentPaid(bookingId: Id, viewerAppUserId: Id | undefined): Promise<Booking> {
  if (isApiMode()) return CS.markPrepaymentPaidServer(bookingId);
  return request(() => {
    const booking = ownBookingOrThrow(bookingId, viewerAppUserId);
    if (!booking.prepayment) throw new ApiError('not_allowed');
    if (booking.prepayment.paid) return booking;
    const now = nowDateTime();
    mutateArea('online', (s) => {
      const meta = s.bookingMeta[bookingId];
      if (meta) meta.prepaymentReportedAt ??= now;
      else s.bookingMeta[bookingId] = { bookingId, widgetGen: 'new', device: 'mobile', accessHash: '', submittedAt: booking.createdAt, prepaymentReportedAt: now };
    });
    // Таймер снятия стоп: клиент сообщил об оплате — окно держится, пока мастер не сверит (как сервер: holdUntil снят)
    const { holdUntil: _hold, ...rest } = booking.prepayment;
    // Как сервер: отметка «клиент сообщил об оплате» — по ней статус у клиента «Ждёт мастера» (владелец, 01.10.2026)
    return coreTx.updateBooking(bookingId, { prepayment: { ...rest, clientMarkedPaidAt: rest.clientMarkedPaidAt ?? now } });
  });
}

/**
 * Освободившееся окно (F-00-101): один лист ожидания бизнеса (resources, 30.09.2026) — заявки, которые ждут это время,
 * получают отметку «Уведомлён», а вставшие из приложения — «Освободилось время» в ленту. Только внутри request().
 */
function notifyWaitlist(freed: Booking): void {
  const serviceId = freed.services[0]?.serviceId ?? '';
  const target = { businessId: freed.businessId, staffId: freed.staffId, serviceId, date: freed.start.slice(0, 10), time: freed.start.slice(11, 16) as TimeHM };
  const day = today();
  const matched = waitlistTx.entries(freed.businessId).filter((e) => e.appUserId !== freed.appUserId && waitlistWantsSlot(e, target, day));
  if (matched.length === 0) return;
  const now = nowDateTime();
  waitlistTx.markNotified(matched.map((e) => e.id), now);
  pushWaitlistSlotTx(matched.flatMap((e) => (e.appUserId ? [e.appUserId] : [])), target, now);
}

/**
 * «Освободилось время» в ленту приложения (kind 'waitlist_slot', с временем и услугой — кнопка «Записаться» сразу на это
 * окно). Только внутри request(); зовут отмена/перенос клиентом и «Уведомить» листа ожидания.
 */
export function pushWaitlistSlotTx(appUserIds: Id[], t: { businessId: Id; staffId: Id; serviceId: Id; date: ISODate; time: string }, at: ISODateTime = nowDateTime()): void {
  const users = [...new Set(appUserIds)];
  if (users.length === 0) return;
  mutateArea('client', (s) => {
    for (const appUserId of users) {
      s.notifications.push({
        id: newId('ntf'),
        appUserId,
        kind: 'waitlist_slot',
        businessId: t.businessId,
        staffId: t.staffId,
        params: { date: t.date, time: t.time, serviceId: t.serviceId },
        createdAt: at,
      });
    }
  });
}

/**
 * Отмена клиентом (F-00-098): срок и последствие (без потерь / «Отменил клиент» + неявка) решает ядро
 * (coreTx.cancelByClient → clientCancelOutcome) — одна транзакция вместе с листом ожидания.
 */
export function cancelBookingByClient(bookingId: Id, viewerAppUserId: Id | undefined): Promise<Booking> {
  if (isApiMode()) return CS.cancelBookingByClientServer(bookingId);
  return request(() => {
    const before = ownBookingOrThrow(bookingId, viewerAppUserId);
    const { booking } = coreTx.cancelByClient(bookingId);
    returnMembershipVisitsOfCancelled(viewerAppUserId!);
    notifyWaitlist(before);
    return booking;
  });
}

/**
 * Перенос клиентом на окно того же мастера и услуги (F-00-099): окно, срок и статус решает ядро
 * (coreTx.rescheduleByClient) — вместе с листом ожидания одной транзакцией.
 */
export function rescheduleBookingByClient(bookingId: Id, newStart: ISODateTime, viewerAppUserId: Id | undefined): Promise<Booking> {
  if (isApiMode()) return CS.rescheduleBookingByClientServer(bookingId, newStart);
  return request(() => {
    const before = ownBookingOrThrow(bookingId, viewerAppUserId);
    const updated = coreTx.rescheduleByClient(bookingId, newStart);
    notifyWaitlist(before);
    return updated;
  });
}

// ─────────────────────────── Лист ожидания (F-00-101, F-00-102) ───────────────────────────
// «Сообщить, когда освободится» — заявка в ОДИН лист ожидания бизнеса (resources.waitlist, на сервере waitlist_entries):
// её видят сотрудники на /biz/waitlist и в панели журнала, ей приходит «Освободилось время». Своего списка у приложения нет.

export interface WaitlistInput {
  appUserId: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate | 'any';
}

/** Заявка листа → вид приложения клиента: мастер, услуга, день (или «любой»), когда приходило «Освободилось время» */
function myWaitlistView(e: BusinessWaitlistEntry): WaitlistEntry {
  const notifiedAt = waitlistTx.lastNotifiedAt(e.id);
  return {
    id: e.id,
    appUserId: e.appUserId ?? '',
    staffId: e.staffIds[0] ?? '',
    serviceId: e.serviceIds[0] ?? '',
    date: waitlistDayOf(e),
    createdAt: e.createdAt,
    ...(notifiedAt ? { notifiedAt } : {}),
  };
}

export function addToWaitlist(input: WaitlistInput): Promise<WaitlistEntry> {
  if (isApiMode()) return CS.addToWaitlistServer(input);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((x) => x.id === input.staffId);
    const user = core.appUsers.find((u) => u.id === input.appUserId);
    if (!staff || !user) throw new ApiError('not_found');
    const same = findSameWaitlistRequest(
      waitlistTx.entries(staff.businessId),
      { businessId: staff.businessId, staffId: staff.id, serviceId: input.serviceId, date: input.date, appUserId: user.id },
      today(),
    );
    if (same) return myWaitlistView(same);
    const entry = waitlistTx.add(
      {
        businessId: staff.businessId,
        locationId: staff.locationIds[0] ?? core.locations.find((l) => l.businessId === staff.businessId)?.id ?? '',
        clientName: user.name,
        clientPhone: user.phone,
        serviceIds: [input.serviceId],
        staffIds: [staff.id],
        wishes: wishesForDay(input.date),
      },
      { source: 'app', appUserId: user.id },
    );
    return myWaitlistView(entry);
  });
}

export interface MyWaitlistEntry extends WaitlistEntry {
  staff: Staff;
  service?: Service;
}

/** Мой лист ожидания (показывается во вкладке /bookings) — активные заявки, которые клиент поставил сам */
export function listMyWaitlist(appUserId: Id): Promise<MyWaitlistEntry[]> {
  if (isApiMode()) return CS.listMyWaitlistServer();
  return request(() => {
    const core = readCore();
    const day = today();
    return waitlistTx
      .entries()
      .filter((e) => e.appUserId === appUserId && computeWaitlistStatus(e, day) === 'active')
      .map(myWaitlistView)
      .map((e) => ({
        ...e,
        staff: core.staff.find((s) => s.id === e.staffId)!,
        service: core.services.find((s) => s.id === e.serviceId),
      }))
      .filter((e) => e.staff)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export function removeFromWaitlist(id: Id, appUserId: Id): Promise<void> {
  if (isApiMode()) return CS.removeFromWaitlistServer(id);
  return request(() => waitlistTx.removeOwn(id, appUserId));
}

// ─────────────────────────── ❤ Избранное (F-00-113, F-00-115, F-14-027, F-14-031) — b03 ───────────────────────────

/** Подписан ли клиент на мастера/место — для кнопки ❤ на карточке (F-00-113) */
export function isFavorited(appUserId: Id, targetType: FavoriteTargetType, targetId: Id): Promise<boolean> {
  if (isApiMode()) return CS.isFavoritedServer(targetType, targetId);
  return request(() =>
    readArea('client').favorites.some((f) => f.appUserId === appUserId && f.targetType === targetType && f.targetId === targetId),
  );
}

/** ❤ — подписаться/отписаться одной кнопкой (F-00-113); возвращает новое состояние */
export function toggleFavorite(input: { appUserId: Id; targetType: FavoriteTargetType; targetId: Id }): Promise<boolean> {
  if (isApiMode()) return CS.toggleFavoriteServer(input.targetType, input.targetId);
  return request(() => {
    let subscribed = false;
    mutateArea('client', (s) => {
      const idx = s.favorites.findIndex(
        (f) => f.appUserId === input.appUserId && f.targetType === input.targetType && f.targetId === input.targetId,
      );
      if (idx >= 0) {
        s.favorites.splice(idx, 1);
        subscribed = false;
      } else {
        s.favorites.push({
          id: newId('fav'),
          appUserId: input.appUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          newsMuted: false,
          createdAt: nowDateTime(),
        });
        subscribed = true;
      }
    });
    return subscribed;
  });
}

/** «Приглушить новости», не отписываясь (F-00-115) — тот же переключатель на /favorites и /profile/notifications (F-14-058) */
export function setFavoriteNewsMuted(id: Id, muted: boolean): Promise<void> {
  if (isApiMode()) return CS.setFavoriteNewsMutedServer(id, muted);
  return request(() => {
    mutateArea('client', (s) => {
      const f = s.favorites.find((x) => x.id === id);
      if (f) f.newsMuted = muted;
    });
  });
}

/** Пуш о новостях нашего продукта пользователю кабинета — свой переключатель, не путать с «новости компании» (F-14-136) */
export function getNewsPushOptOut(appUserId: Id): Promise<boolean> {
  if (isApiMode()) return CS.getNewsPushOptOutServer();
  return request(() => Boolean(readArea('client').newsPushOptOut[appUserId]));
}

export function setNewsPushOptOut(appUserId: Id, optOut: boolean): Promise<void> {
  if (isApiMode()) return CS.setNewsPushOptOutServer(optOut);
  return request(() => {
    mutateArea('client', (s) => {
      s.newsPushOptOut[appUserId] = optOut;
    });
  });
}

export interface FavoriteEntry {
  favorite: Favorite;
  staff?: Staff;
  business: Business;
}

/** Список избранного клиента (F-14-031) — мастер приносит и свой бизнес (для подписи «в салоне …») */
export function listFavorites(appUserId: Id): Promise<FavoriteEntry[]> {
  if (isApiMode()) return CS.listFavoritesServer();
  return request(() => {
    const core = readCore();
    const out: FavoriteEntry[] = [];
    for (const f of readArea('client').favorites.filter((x) => x.appUserId === appUserId)) {
      if (f.targetType === 'staff') {
        const staff = core.staff.find((s) => s.id === f.targetId);
        const business = staff && core.businesses.find((b) => b.id === staff.businessId);
        if (staff && business) out.push({ favorite: f, staff, business });
      } else {
        const business = core.businesses.find((b) => b.id === f.targetId);
        if (business) out.push({ favorite: f, business });
      }
    }
    return out.sort((a, b) => b.favorite.createdAt.localeCompare(a.favorite.createdAt));
  });
}

// ─────────────────────────── ★ Звёздочка (F-00-116, F-14-013, F-14-014) — b03 ───────────────────────────

/** Мою звёздочку этому мастеру, если стоит */
export function getMyStar(appUserId: Id, staffId: Id): Promise<StarRating | undefined> {
  if (isApiMode()) return CS.getMyStarServer(staffId);
  return request(() => readArea('client').starRatings.find((r) => r.appUserId === appUserId && r.staffId === staffId));
}

/** Можно ли оценить запись (F-14-013): только визит со статусом «пришёл», только свой */
export function canRateBooking(bookingId: Id, appUserId: Id): Promise<boolean> {
  if (isApiMode()) return CS.canRateBookingServer(bookingId);
  return request(() => {
    const b = readCore().bookings.find((x) => x.id === bookingId);
    return Boolean(b && b.appUserId === appUserId && b.status === 'arrived');
  });
}

/** Поставить ★ (одна на клиента на мастера — повторный вызов молча не дублирует) */
export function rateStaff(input: { appUserId: Id; staffId: Id; bookingId: Id }): Promise<void> {
  if (isApiMode()) return CS.rateStaffServer(input.staffId, input.bookingId);
  return request(() => {
    const booking = readCore().bookings.find((b) => b.id === input.bookingId);
    if (!booking || booking.appUserId !== input.appUserId || booking.status !== 'arrived') {
      throw new ApiError('not_allowed', 'Оценить можно только визит со статусом «пришёл»');
    }
    mutateArea('client', (s) => {
      if (s.starRatings.some((r) => r.appUserId === input.appUserId && r.staffId === input.staffId)) return;
      s.starRatings.push({ id: newId('str'), appUserId: input.appUserId, staffId: input.staffId, bookingId: input.bookingId, createdAt: nowDateTime() });
    });
  });
}

/** Снять свою ★ */
export function unrateStaff(appUserId: Id, staffId: Id): Promise<void> {
  if (isApiMode()) return CS.unrateStaffServer(staffId);
  return request(() => {
    mutateArea('client', (s) => {
      s.starRatings = s.starRatings.filter((r) => !(r.appUserId === appUserId && r.staffId === staffId));
    });
  });
}

// ─────────────────────────── Оценка 1–5 + текст (В-24, F-14-013 1:1) — когда online.reviewMode = 'text' ───────────────────────────

/** Мою оценку этому мастеру, если оставлена */
export function getMyStaffReview(appUserId: Id, staffId: Id): Promise<StaffReview | undefined> {
  if (isApiMode()) return CS.getMyStaffReviewServer(staffId);
  return request(() => readArea('client').staffReviews.find((r) => r.appUserId === appUserId && r.staffId === staffId));
}

/**
 * Поставить/изменить оценку 1–5 и текст (одна на клиента на мастера, как ★ — F-14-013). Текст (если есть)
 * отдельным шагом уходит на модерацию платформы — рейтинг виден сразу, текст только после одобрения
 * (getMyStaffReview.text локально виден автору сразу; публично — через isVisibleToClients(review.id)).
 */
export async function submitStaffReview(input: { appUserId: Id; staffId: Id; businessId: Id; bookingId: Id; rating: 1 | 2 | 3 | 4 | 5; text?: string }): Promise<StaffReview> {
  if (isApiMode()) return CS.submitStaffReviewServer(input.staffId, input.businessId, input.bookingId, input.rating, input.text);
  const booking = readCore().bookings.find((b) => b.id === input.bookingId);
  if (!booking || booking.appUserId !== input.appUserId || booking.status !== 'arrived') {
    throw new ApiError('not_allowed', 'Оценить можно только визит со статусом «пришёл»');
  }
  const text = input.text?.trim() || undefined;
  const review = await request(() => {
    let result: StaffReview | undefined;
    mutateArea('client', (s) => {
      const existing = s.staffReviews.find((r) => r.appUserId === input.appUserId && r.staffId === input.staffId);
      if (existing) {
        existing.rating = input.rating;
        existing.text = text;
        existing.updatedAt = nowDateTime();
        result = existing;
      } else {
        const created: StaffReview = {
          id: newId('srv'),
          appUserId: input.appUserId,
          staffId: input.staffId,
          businessId: input.businessId,
          bookingId: input.bookingId,
          rating: input.rating,
          text,
          createdAt: nowDateTime(),
        };
        s.staffReviews.push(created);
        result = created;
      }
    });
    return result!;
  });
  if (text) {
    const staffName = readCore().staff.find((s) => s.id === input.staffId)?.name;
    await submitForModeration({ kind: 'review', businessId: input.businessId, staffId: input.staffId, refId: review.id, text, label: staffName });
  }
  return review;
}

// ─────────────────────────── Отзыв о месте (F-14-014) — b03 ───────────────────────────

/** Мой отзыв об этом визите, если оставлен */
export function getMyLocationReview(appUserId: Id, bookingId: Id): Promise<LocationReview | undefined> {
  if (isApiMode()) return CS.getMyLocationReviewServer(bookingId);
  return request(() => readArea('client').locationReviews.find((r) => r.appUserId === appUserId && r.bookingId === bookingId));
}

/** Отзывы о месте для карточки бизнеса (F-14-028) — новые сверху */
export function listLocationReviews(businessId: Id): Promise<LocationReview[]> {
  if (isApiMode()) return CS.listLocationReviewsServer(businessId);
  return request(() =>
    readArea('client')
      .locationReviews.filter((r) => r.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/** Оставить/изменить отзыв о месте — только у своего визита со статусом «пришёл», один на визит */
export function submitLocationReview(input: { appUserId: Id; businessId: Id; bookingId: Id; text: string }): Promise<LocationReview> {
  if (isApiMode()) return CS.submitLocationReviewServer(input.businessId, input.bookingId, input.text);
  return request(() => {
    const text = input.text.trim();
    if (!text) throw new ApiError('validation', 'Текст отзыва не может быть пустым');
    const booking = readCore().bookings.find((b) => b.id === input.bookingId);
    if (!booking || booking.appUserId !== input.appUserId || booking.status !== 'arrived') {
      throw new ApiError('not_allowed', 'Отзыв о месте можно оставить только после визита со статусом «пришёл»');
    }
    let saved!: LocationReview;
    mutateArea('client', (s) => {
      const existing = s.locationReviews.find((r) => r.appUserId === input.appUserId && r.bookingId === input.bookingId);
      if (existing) {
        existing.text = text;
        existing.updatedAt = nowDateTime();
        saved = existing;
      } else {
        saved = { id: newId('lrv'), appUserId: input.appUserId, businessId: input.businessId, bookingId: input.bookingId, text, createdAt: nowDateTime() };
        s.locationReviews.push(saved);
      }
    });
    return saved;
  });
}

// ─────────────────────────── Лента уведомлений (F-14-055…070) — b03 ───────────────────────────

export interface NotificationEntry extends NotificationItem {
  business: Business;
  staff?: Staff;
  booking?: Booking;
  service?: Service;
}

/**
 * Лента уведомлений клиента (F-14-055): «новости» (broadcast) от бизнеса, у которого приглушены —
 * не показываем (F-00-115/F-14-058 — тот же переключатель, что в избранном); напоминания и статусы
 * записи этим не глушатся.
 */
export function listNotifications(appUserId: Id): Promise<NotificationEntry[]> {
  if (isApiMode()) return CS.listNotificationsServer();
  return request(() => {
    deliverApprovedNews();
    materializeBookingReminders(appUserId);
    const core = readCore();
    const area = readArea('client');
    const mutedBusinessIds = new Set(area.favorites.filter((f) => f.newsMuted).map((f) => favoriteBusinessId(core, f)).filter(Boolean));
    const out: NotificationEntry[] = [];
    for (const n of area.notifications.filter((x) => x.appUserId === appUserId)) {
      if (n.kind === 'broadcast' && mutedBusinessIds.has(n.businessId)) continue;
      const business = core.businesses.find((b) => b.id === n.businessId);
      if (!business) continue;
      const staff = n.staffId ? core.staff.find((s) => s.id === n.staffId) : undefined;
      const rawBooking = n.bookingId ? core.bookings.find((b) => b.id === n.bookingId) : undefined;
      // `comment` — заметка администратора в CRM, клиенту не показываем НИЧЕГО из неё (F-00-130, F-00-010).
      const booking = rawBooking ? (({ comment: _comment, ...rest }) => rest as Booking)(rawBooking) : undefined;
      // Услуга — из записи; у «Освободилось время» записи ещё нет — из params окна
      const serviceId = booking ? booking.services[0]?.serviceId : n.params?.serviceId ? String(n.params.serviceId) : undefined;
      const service = serviceId ? core.services.find((s) => s.id === serviceId) : undefined;
      out.push({ ...n, business, staff, booking, service });
    }
    out.push(...synthesizeRepeatInvites(core, appUserId, area.notifications, area.eventsSeenAt[appUserId]));
    out.push(...eventNotifications(core, appUserId, area.eventsSeenAt[appUserId]));
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/**
 * События записей клиента из журнала ядра (core-k3 №3, e2e-q3 №10): салон подтвердил, перенёс, отменил, удалил запись;
 * мастер задерживается; не пришла предоплата. Свои копии «уведомлений о записи» не храним — читаем журнал.
 * Прочитано — всё, что старше отметки «видел ленту» (eventsSeenAt).
 */
function eventNotifications(core: CoreSnapshot, appUserId: Id, seenAt: ISODateTime | undefined): NotificationEntry[] {
  const out: NotificationEntry[] = [];
  for (const e of coreTx.listClientEvents(appUserId)) {
    let kind: NotificationKind | undefined;
    if (e.kind === 'delayed') kind = 'master_delayed';
    else if (e.kind === 'moved') kind = 'salon_moved';
    else if (e.kind === 'deleted') kind = 'salon_deleted';
    // В-03: заявку сняли по сроку ответа — клиенту не «мастер отменил», а «не успел ответить» + окна
    else if (e.kind === 'status' && e.to === 'cancelled_by_master' && e.reason === 'confirmation_expired') kind = 'confirmation_expired';
    else if (e.kind === 'status' && e.to === 'cancelled_by_master') kind = 'cancelled_by_master';
    else if (e.kind === 'status' && e.reason === 'prepayment_expired') kind = 'prepayment_expired';
    else if (e.kind === 'status' && e.to === 'scheduled' && e.from === 'awaiting_confirmation') kind = 'salon_confirmed';
    else if (e.kind === 'created') kind = 'booking_created';
    if (!kind) continue;
    const business = core.businesses.find((b) => b.id === e.businessId);
    if (!business) continue;
    const staff = core.staff.find((s) => s.id === e.staffId);
    const rawBooking = core.bookings.find((b) => b.id === e.bookingId);
    const booking = rawBooking ? ({ ...rawBooking, comment: undefined } as Booking) : undefined;
    const service = booking ? core.services.find((s) => s.id === booking.services[0]?.serviceId) : undefined;
    out.push({
      id: `ev-${e.id}`,
      appUserId,
      kind,
      businessId: e.businessId,
      staffId: e.staffId,
      bookingId: kind === 'salon_deleted' ? undefined : e.bookingId,
      params: { delayMin: e.delayMin ?? 0, start: e.start ?? rawBooking?.start ?? '' },
      createdAt: e.at,
      readAt: seenAt && e.at <= seenAt ? e.at : undefined,
      business,
      staff,
      booking,
      service,
    });
  }
  return out;
}

/** Время напоминания по умолчанию, когда клиент не выбирал своё (F-00-120) */
const REMINDER_WINDOW_HOURS = 24;
const ACTIVE_BOOKING_STATUSES: Booking['status'][] = ['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'];

/**
 * Пуш-напоминание перед визитом (F-00-120): как только запись входит в окно напоминания — заводим
 * настоящую запись в ленте (один раз на бронирование), а не рисуем её только для одного примера из сида.
 * F-05-083: у записи может быть свой выбор клиента (notify.bookingOverrides) — «не отправлять» вообще
 * гасит напоминание, иначе окно берётся из pushTimingHours записи, а не из общего умолчания.
 */
function materializeBookingReminders(appUserId: Id): void {
  const core = readCore();
  const now = nowDateTime();
  const overrides = readArea('notify').bookingOverrides;
  const already = new Set(readArea('client').notifications.filter((n) => n.kind === 'booking_reminder').map((n) => n.bookingId));
  const due = core.bookings.filter((b) => {
    if (
      b.appUserId !== appUserId ||
      b.deletedAt ||
      !ACTIVE_BOOKING_STATUSES.includes(b.status) ||
      already.has(b.id) ||
      b.start <= now
    )
      return false;
    const override = overrides[b.id];
    if (override && !override.pushEnabled) return false;
    const windowHours = override?.pushEnabled ? override.pushTimingHours : REMINDER_WINDOW_HOURS;
    return addMinutes(b.start, -windowHours * 60) <= now;
  });
  if (!due.length) return;
  mutateArea('client', (s) => {
    for (const b of due) {
      s.notifications.push({ id: newId('ntf'), appUserId, kind: 'booking_reminder', businessId: b.businessId, staffId: b.staffId, bookingId: b.id, createdAt: now });
    }
  });
}

/**
 * «Пора снова» (F-00-119): считаем по-настоящему от интервала услуги (`Service.repeatIntervalDays`),
 * а не только из готовых строк среза — через N дней после визита с таким интервалом клиент должен
 * получить пуш, если не записался к этому мастеру снова. Не сохраняется в базу — считается при чтении.
 */
function synthesizeRepeatInvites(
  core: ReturnType<typeof readCore>,
  appUserId: Id,
  existing: NotificationItem[],
  seenAt: ISODateTime | undefined,
): NotificationEntry[] {
  const now = nowDateTime();
  const lastArrivedByStaff = new Map<Id, Booking>();
  for (const b of core.bookings) {
    if (b.appUserId !== appUserId || b.status !== 'arrived' || b.deletedAt) continue;
    const current = lastArrivedByStaff.get(b.staffId);
    if (!current || b.start > current.start) lastArrivedByStaff.set(b.staffId, b);
  }
  const out: NotificationEntry[] = [];
  for (const [staffId, last] of lastArrivedByStaff) {
    const service = core.services.find((s) => s.id === last.services[0]?.serviceId);
    if (!service?.repeatIntervalDays) continue;
    const dueAt = addMinutes(last.start, service.repeatIntervalDays * 24 * 60);
    if (now < dueAt) continue;
    const bookedAgain = core.bookings.some(
      (b) => b.appUserId === appUserId && b.staffId === staffId && b.start > last.start && !['cancelled_by_client', 'cancelled_by_master'].includes(b.status),
    );
    if (bookedAgain) continue;
    if (existing.some((n) => n.bookingId === last.id && n.kind === 'repeat_invite')) continue;
    const business = core.businesses.find((b) => b.id === last.businessId);
    const staff = core.staff.find((s) => s.id === staffId);
    if (!business || !staff) continue;
    out.push({
      id: `repeat-${last.id}`,
      appUserId,
      kind: 'repeat_invite',
      businessId: business.id,
      staffId,
      bookingId: last.id,
      createdAt: dueAt,
      // Считается заново при каждом чтении (не хранится); прочитана — как события записей: «отметить всё прочитанным»
      // двигает eventsSeenAt, и всё, что наступило до него, уже не новое. Раньше была прочитанной сразу — значка не было
      readAt: seenAt && dueAt <= seenAt ? dueAt : undefined,
      business,
      staff,
      booking: last,
      service,
    });
  }
  return out;
}

function favoriteBusinessId(core: ReturnType<typeof readCore>, f: Favorite): Id | undefined {
  if (f.targetType === 'business') return f.targetId;
  return core.staff.find((s) => s.id === f.targetId)?.businessId;
}

export function markNotificationRead(id: Id): Promise<void> {
  if (isApiMode()) return CS.markNotificationReadServer(id);
  return request(() => {
    mutateArea('client', (s) => {
      const n = s.notifications.find((x) => x.id === id);
      if (n && !n.readAt) n.readAt = nowDateTime();
    });
  });
}

export function markAllNotificationsRead(appUserId: Id): Promise<void> {
  if (isApiMode()) return CS.markAllNotificationsReadServer();
  return request(() => {
    const now = nowDateTime();
    mutateArea('client', (s) => {
      for (const n of s.notifications) if (n.appUserId === appUserId && !n.readAt) n.readAt = now;
      s.eventsSeenAt[appUserId] = now;
    });
  });
}

// ─────────────────────────── Дневник клиента (F-00-122) — b03 ───────────────────────────

export interface DiaryRow {
  id: Id;
  source: 'app' | 'manual';
  date: ISODate;
  amount: Money;
  removable: boolean;
  service?: Service;
  staff?: Staff;
  serviceName?: string;
  masterName?: string;
}

/** Дневник (F-00-122): визиты «пришёл» через приложение — сами, ручные расходы — из своего среза */
export function listDiaryEntries(appUserId: Id): Promise<DiaryRow[]> {
  if (isApiMode()) return CS.listDiaryEntriesServer();
  return request(() => {
    const core = readCore();
    const rows: DiaryRow[] = [];
    for (const b of core.bookings) {
      if (b.appUserId !== appUserId || b.status !== 'arrived' || b.deletedAt) continue;
      rows.push({
        id: b.id,
        source: 'app',
        date: toISODate(dayjs(b.start)),
        amount: b.total,
        removable: false,
        staff: core.staff.find((s) => s.id === b.staffId),
        service: core.services.find((s) => s.id === b.services[0]?.serviceId),
      });
    }
    for (const e of readArea('client').diaryEntries.filter((x) => x.appUserId === appUserId)) {
      rows.push({
        id: e.id,
        source: 'manual',
        date: e.date,
        amount: e.amount,
        removable: true,
        serviceName: e.serviceName,
        masterName: e.masterName,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });
}

export interface AddDiaryEntryInput {
  appUserId: Id;
  serviceName: string;
  masterName: string;
  date: ISODate;
  amount: Money;
}

export function addDiaryEntry(input: AddDiaryEntryInput): Promise<DiaryEntry> {
  if (isApiMode()) return CS.addDiaryEntryServer(input);
  return request(() => {
    const entry: DiaryEntry = { id: newId('dry'), createdAt: nowDateTime(), ...input };
    mutateArea('client', (s) => {
      s.diaryEntries.push(entry);
    });
    return entry;
  });
}

export function removeDiaryEntry(id: Id): Promise<void> {
  if (isApiMode()) return CS.removeDiaryEntryServer(id);
  return request(() => {
    mutateArea('client', (s) => {
      s.diaryEntries = s.diaryEntries.filter((e) => e.id !== id);
    });
  });
}

// ─────────────────────────── Профиль клиента (F-14-059…062, F-00-124) — b03 ───────────────────────────

export interface ClientProfile {
  appUser: AppUser;
  photoUrl?: string;
  timeFormat: TimeFormat;
  /** Свои неявки (В-07): считаем по своим записям (Booking.appUserId), не по общей базе платформы */
  noShowCount: number;
}

export function getClientProfile(appUserId: Id): Promise<ClientProfile | undefined> {
  if (isApiMode()) return CS.getClientProfileServer();
  return request(() => {
    const core = readCore();
    const appUser = core.appUsers.find((u) => u.id === appUserId);
    if (!appUser) return undefined;
    const area = readArea('client');
    const noShowCount = core.bookings.filter((b) => b.appUserId === appUserId && b.status === 'no_show').length;
    return { appUser, photoUrl: appUser.photoUrl, timeFormat: area.timeFormat[appUserId] ?? '24', noShowCount };
  });
}

/**
 * `AccountView` сервера (`/v1/me/account`, этап 2/20) → `AppUser` ядра, каким его знает экран профиля: сервер
 * не хранит поле `createdAt`/`gender` отдельно от мока, поэтому недостающее берётся из уже смирoренной записи
 * (иначе апдейт правильно ушёл бы на сервер, но временно «забыл» бы поля экрана до следующего входа).
 */
function accountToAppUser(appUserId: Id, account: AccountView): AppUser {
  const existing = readCore().appUsers.find((u) => u.id === appUserId);
  return {
    id: appUserId,
    phone: account.phone ?? existing?.phone ?? '',
    name: account.name,
    gender: (existing?.gender ?? 'unspecified') as AppUser['gender'],
    birthday: existing?.birthday,
    district: existing?.district,
    locale: account.locale,
    createdAt: existing?.createdAt ?? nowDateTime(),
    photoUrl: account.profile?.photoUrl ?? undefined,
  };
}

/** Имя в профиле приложения (F-14-059) — не синхронизируется с карточкой клиента в CRM мастера (F-00-130) */
export function updateProfileName(appUserId: Id, name: string): Promise<AppUser> {
  if (isApiMode()) {
    return (async () => {
      const current = await getAccount();
      const updated = await patchAccount({ name }, current.version);
      return accountToAppUser(appUserId, updated);
    })();
  }
  return coreUpdate('appUsers', appUserId, { name });
}

/** Фото профиля (F-14-059) — в AppUser.photoUrl (ядро), как у Staff.avatarUrl. */
export function setProfilePhoto(appUserId: Id, photoUrl: string | undefined): Promise<AppUser> {
  if (isApiMode()) {
    return (async () => {
      const current = await getAccount();
      const updated = await patchAccount({ photoUrl: photoUrl ?? null }, current.version);
      return accountToAppUser(appUserId, updated);
    })();
  }
  return coreUpdate('appUsers', appUserId, { photoUrl: photoUrl ?? undefined });
}

export function setTimeFormat(appUserId: Id, format: TimeFormat): Promise<void> {
  if (isApiMode()) {
    return (async () => {
      const current = await getAccount();
      await patchAccount({ timeFormat: format === '24' ? '24h' : '12h' }, current.version);
    })();
  }
  return request(() => {
    mutateArea('client', (s) => {
      s.timeFormat[appUserId] = format;
    });
  });
}

/** Ключ правки автоперевода (F-00-174) — владелец текста + поле */
export function translationKey(owner: 'staff' | 'business' | 'service', ownerId: Id, field: string): string {
  return `${owner}:${ownerId}:${field}`;
}

/** Правка мастера к автопереводу его текста на en, если есть (F-00-174) */
export function getTranslationOverride(owner: 'staff' | 'business' | 'service', ownerId: Id, field: string): Promise<string | undefined> {
  if (isApiMode()) return CS.getTranslationOverrideServer(owner, ownerId, field);
  return request(() => readArea('client').translationOverrides[translationKey(owner, ownerId, field)]);
}

/** Список текстов мастера, ждущих проверки перевода (для /biz/apps/translations) */
export function listTranslatable(businessId: Id): Promise<
  { owner: 'staff' | 'business' | 'service'; ownerId: Id; field: string; label: string; ru: string; override?: string }[]
> {
  if (isApiMode()) return CS.listTranslatableServer(businessId);
  return request(() => {
    const core = readCore();
    const { translationOverrides } = readArea('client');
    const rows: { owner: 'staff' | 'business' | 'service'; ownerId: Id; field: string; label: string; ru: string; override?: string }[] = [];
    core.businesses
      .filter((b) => b.id === businessId && b.description?.ru && !b.description.en?.trim())
      .forEach((b) => {
        rows.push({
          owner: 'business',
          ownerId: b.id,
          field: 'description',
          label: b.name,
          ru: b.description!.ru,
          override: translationOverrides[translationKey('business', b.id, 'description')],
        });
      });
    core.staff
      .filter((s) => s.businessId === businessId && s.bio?.ru && !s.bio.en?.trim())
      .forEach((s) => {
        rows.push({
          owner: 'staff',
          ownerId: s.id,
          field: 'bio',
          label: s.name,
          ru: s.bio!.ru,
          override: translationOverrides[translationKey('staff', s.id, 'bio')],
        });
      });
    core.services
      .filter((sv) => sv.businessId === businessId && sv.description?.ru && !sv.description.en?.trim())
      .forEach((sv) => {
        rows.push({
          owner: 'service',
          ownerId: sv.id,
          field: 'description',
          label: sv.name.ru,
          ru: sv.description!.ru,
          override: translationOverrides[translationKey('service', sv.id, 'description')],
        });
      });
    return rows;
  });
}

/** Мастер поправил перевод на en (F-00-174) — клиент увидит исправленный текст */
export function setTranslationOverride(owner: 'staff' | 'business' | 'service', ownerId: Id, field: string, text: string): Promise<void> {
  if (isApiMode()) return CS.setTranslationOverrideServer(owner, ownerId, field, text);
  return request(() => {
    mutateArea('client', (s) => {
      const key = translationKey(owner, ownerId, field);
      if (text.trim()) s.translationOverrides[key] = text;
      else delete s.translationOverrides[key];
    });
  });
}

// ─────────────────────────── Абонементы, сертификаты, кэшбэк (b04, F-14-018…054) ───────────────────────────

export interface MembershipWithBusiness extends Membership {
  businessName: string;
  businessLogoUrl?: string;
  network?: NetworkLocationsInfo;
}

/** Сеть бизнеса, если у неё больше одного филиала (F-14-042, F-14-044, F-14-163) */
function businessNetwork(core: ReturnType<typeof readCore>, business: Business | undefined): Network | undefined {
  if (!business?.networkId) return undefined;
  const net = core.networks.find((n) => n.id === business.networkId);
  return net && net.businessIds.length > 1 ? net : undefined;
}

/** Основная локация сети (первая в Network.businessIds) — источник логотипа карт лояльности (F-14-042) */
function networkMainBusiness(core: ReturnType<typeof readCore>, net: Network): Business | undefined {
  return core.businesses.find((b) => b.id === net.businessIds[0]);
}

function networkLocationsInfo(core: ReturnType<typeof readCore>, net: Network): NetworkLocationsInfo {
  return {
    networkId: net.id,
    networkName: net.name,
    locations: net.businessIds
      .map((id) => core.businesses.find((b) => b.id === id))
      .filter((b): b is Business => Boolean(b))
      .map((b) => ({ businessId: b.id, name: b.name })),
  };
}

function attachBusiness<T extends { businessId: Id }>(
  core: ReturnType<typeof readCore>,
  item: T,
): T & { businessName: string; businessLogoUrl?: string; network?: NetworkLocationsInfo } {
  const business = core.businesses.find((b) => b.id === item.businessId);
  const net = businessNetwork(core, business);
  // Сеть — логотип карт всегда берётся с основной локации (F-14-042), даже если у своей есть другой
  const businessLogoUrl = net ? networkMainBusiness(core, net)?.logoUrl ?? business?.logoUrl : business?.logoUrl;
  return {
    ...item,
    businessName: business?.name ?? '',
    businessLogoUrl,
    network: net ? networkLocationsInfo(core, net) : undefined,
  };
}

/** Абонементы клиента — действующие, каруселью и списком (F-14-037) */
export function listMemberships(appUserId: Id): Promise<MembershipWithBusiness[]> {
  if (isApiMode()) return CLX.me('listMemberships');
  return request(() => {
    returnMembershipVisitsOfCancelled(appUserId);
    const core = readCore();
    return readArea('client')
      .memberships.filter((m) => m.appUserId === appUserId && (m.active || m.purchaseStatus !== 'confirmed'))
      .map((m) => attachBusiness(core, m));
  });
}

/** Абонемент по id — доступен и израсходованный, для перехода из строки оплаты (F-14-019, F-14-037) */
export function getMembership(id: Id, viewerAppUserId: Id | undefined): Promise<MembershipWithBusiness | undefined> {
  if (isApiMode()) return viewerAppUserId ? CLX.orUndefined(CLX.me<MembershipWithBusiness | null>('getMembership', [id])) : Promise.resolve(undefined);
  return request(() => {
    const item = readArea('client').memberships.find((m) => m.id === id);
    if (!item || !viewerAppUserId || item.appUserId !== viewerAppUserId) return undefined;
    return attachBusiness(readCore(), item);
  });
}

/** Заморозить/разморозить абонемент, если тип разрешает (F-14-038) */
export function toggleMembershipFreeze(id: Id, appUserId: Id): Promise<Membership> {
  if (isApiMode()) return CLX.me('toggleMembershipFreeze', [id]);
  return request(() => {
    let updated: Membership | undefined;
    mutateArea('client', (s) => {
      const item = s.memberships.find((m) => m.id === id && m.appUserId === appUserId);
      if (!item) throw new Error('membership_not_found');
      if (!item.frozen && item.freezeDaysAvailable === undefined) throw new Error('freeze_not_allowed');
      item.frozen = !item.frozen;
      updated = item;
    });
    if (!updated) throw new Error('membership_not_found');
    return updated;
  });
}

/**
 * Включить/выключить автопродление (F-14-047) — 🔒 демо: списание с карты требует оплаты через нас,
 * отложено (F-00-028), поэтому реального списания нет — только статус «действует до конца срока».
 */
export function toggleMembershipAutoRenew(id: Id, appUserId: Id): Promise<Membership> {
  if (isApiMode()) return CLX.me('toggleMembershipAutoRenew', [id]);
  return request(() => {
    let updated: Membership | undefined;
    mutateArea('client', (s) => {
      const item = s.memberships.find((m) => m.id === id && m.appUserId === appUserId);
      if (!item) throw new Error('membership_not_found');
      item.autoRenew = !item.autoRenew;
      updated = item;
    });
    if (!updated) throw new Error('membership_not_found');
    return updated;
  });
}

export interface GiftCertificateWithBusiness extends GiftCertificate {
  businessName: string;
  businessLogoUrl?: string;
  network?: NetworkLocationsInfo;
}

/** Сертификаты клиента — действующие (F-14-040) */
export function listCertificates(appUserId: Id): Promise<GiftCertificateWithBusiness[]> {
  if (isApiMode()) return CLX.me('listCertificates');
  return request(() => {
    const core = readCore();
    return readArea('client')
      .certificates.filter((c) => c.appUserId === appUserId && (c.active || c.purchaseStatus !== 'confirmed'))
      .map((c) => attachBusiness(core, c));
  });
}

/** Сертификат по id — доступен и израсходованный (F-14-019, F-14-040) */
export function getCertificate(id: Id, viewerAppUserId: Id | undefined): Promise<GiftCertificateWithBusiness | undefined> {
  if (isApiMode()) return viewerAppUserId ? CLX.orUndefined(CLX.me<GiftCertificateWithBusiness | null>('getCertificate', [id])) : Promise.resolve(undefined);
  return request(() => {
    const item = readArea('client').certificates.find((c) => c.id === id);
    if (!item || !viewerAppUserId || item.appUserId !== viewerAppUserId) return undefined;
    return attachBusiness(readCore(), item);
  });
}

export interface LoyaltyCardRow extends CashbackCard {
  businessName: string;
  businessLogoUrl?: string;
  network?: NetworkLocationsInfo;
}

/** Карты лояльности клиента — вкладка «Loyalty cards» (F-14-054) */
export function listLoyaltyCards(appUserId: Id): Promise<LoyaltyCardRow[]> {
  if (isApiMode()) return CLX.me('listLoyaltyCards');
  return request(() => {
    const core = readCore();
    return readArea('client')
      .cashbackCards.filter((c) => c.appUserId === appUserId)
      .map((c) => attachBusiness(core, c));
  });
}

function pickCashbackCard(cards: CashbackCard[]): CashbackCard | undefined {
  if (!cards.length) return undefined;
  return cards.reduce((best, c) => (c.balance >= best.balance ? c : best));
}

/**
 * Кэшбэк-карта клиента для одной компании (F-14-048…053) — правило выбора: видимая карта с наибольшим
 * балансом, при равенстве — последняя выданная (последняя в списке); карты без бонусной программы (нет
 * earnRules) и невидимые (`visible: false`) не участвуют.
 */
export function getCashbackForBusiness(appUserId: Id | undefined, businessId: Id): Promise<CashbackCard | undefined> {
  if (isApiMode()) return appUserId ? CLX.orUndefined(CLX.me<CashbackCard | null>('getCashbackForBusiness', [businessId])) : Promise.resolve(undefined);
  return request(() => {
    if (!appUserId) return undefined;
    const cards = readArea('client').cashbackCards.filter(
      (c) => c.appUserId === appUserId && c.businessId === businessId && c.visible && c.earnRules.length > 0,
    );
    return pickCashbackCard(cards);
  });
}

// ─────────────────────────── Покупка абонементов и сертификатов (F-14-043…047) ───────────────────────────

/**
 * Чьи онлайн-продажи показывать в этом месте (F-14-044). Настоящей настройки «Онлайн-запись → Ссылки →
 * Настроить → Продажа абонементов и сертификатов» в кабинете пока нет (её строит раздел online/network —
 * см. qa/requests/client.md), поэтому источник продаж выводится автоматически: в сети — первый филиал
 * (по порядку Network.businessIds), у которого включены онлайн-продажи хотя бы одного типа; если ни у
 * кого не включены — основная локация сети; вне сети — сам бизнес.
 */
function resolveSalesSourceBusinessId(core: ReturnType<typeof readCore>, businessId: Id): Id {
  const business = core.businesses.find((b) => b.id === businessId);
  const net = businessNetwork(core, business);
  if (!net) return businessId;
  const area = readArea('client');
  const hasOnSale = (id: Id) =>
    area.membershipTemplates.some((t) => t.businessId === id && t.onSale) ||
    area.certificateTemplates.some((t) => t.businessId === id && t.onSale);
  return net.businessIds.find(hasOnSale) ?? net.businessIds[0] ?? businessId;
}

/** Абонементы этого места, доступные к покупке — пусто, если продавать нечего (F-14-044) */
export function listPurchasableMemberships(businessId: Id): Promise<MembershipTemplate[]> {
  if (isApiMode()) return CLX.pub(businessId, 'listPurchasableMemberships');
  return request(() => {
    const core = readCore();
    const sourceId = resolveSalesSourceBusinessId(core, businessId);
    return readArea('client').membershipTemplates.filter((t) => t.businessId === sourceId && t.onSale);
  });
}

/** Сертификаты этого места, доступные к покупке — пусто, если продавать нечего (F-14-044) */
export function listPurchasableCertificates(businessId: Id): Promise<CertificateTemplate[]> {
  if (isApiMode()) return CLX.pub(businessId, 'listPurchasableCertificates');
  return request(() => {
    const core = readCore();
    const sourceId = resolveSalesSourceBusinessId(core, businessId);
    return readArea('client').certificateTemplates.filter((t) => t.businessId === sourceId && t.onSale);
  });
}

/**
 * Купить абонемент (F-14-043, F-14-045): оплата — по нашему решению отложена (F-00-028), сейчас
 * альтернативным способом — по реквизитам бизнеса, как ручная предоплата записи (F-00-097). «Купить»
 * создаёт заявку 'pendingConfirmation' — визиты недоступны, пока бизнес не подтвердит оплату (В-17).
 */
export function purchaseMembership(appUserId: Id, templateId: Id): Promise<Membership> {
  if (isApiMode()) return CLX.me('purchaseMembership', [templateId]);
  return request(() => {
    const tpl = readArea('client').membershipTemplates.find((t) => t.id === templateId);
    if (!tpl) throw new Error('template_not_found');
    const membership: Membership = {
      id: newId('mem'),
      appUserId,
      businessId: tpl.businessId,
      title: tpl.title,
      number: `AB-${Math.floor(Math.random() * 9000 + 1000)}`,
      visitsTotal: tpl.visitsTotal,
      visitsLeft: tpl.visitsTotal,
      price: tpl.price,
      validUntil: toISODate(dayjs().add(tpl.validDays, 'day')),
      frozen: false,
      freezeDaysAvailable: 14,
      serviceNames: tpl.serviceNames,
      imageUrl: tpl.imageUrl,
      onSale: true,
      autoRenew: false,
      purchasedAt: nowDateTime(),
      active: false,
      purchaseStatus: 'pendingConfirmation',
    };
    mutateArea('client', (s) => {
      s.memberships.push(membership);
    });
    return membership;
  });
}

/** Купить сертификат (F-14-043) — та же схема оплаты и заявки, что покупка абонемента (В-17) */
export function purchaseCertificate(appUserId: Id, templateId: Id): Promise<GiftCertificate> {
  if (isApiMode()) return CLX.me('purchaseCertificate', [templateId]);
  return request(() => {
    const tpl = readArea('client').certificateTemplates.find((t) => t.id === templateId);
    if (!tpl) throw new Error('template_not_found');
    const certificate: GiftCertificate = {
      id: newId('gft'),
      appUserId,
      businessId: tpl.businessId,
      number: `GC-${Math.floor(Math.random() * 9000 + 1000)}`,
      faceValue: tpl.faceValue,
      balance: tpl.faceValue,
      usesLimit: tpl.usesLimit,
      validUntil: toISODate(dayjs().add(tpl.validDays, 'day')),
      appliesTo: tpl.appliesTo,
      purchasedAt: nowDateTime(),
      active: false,
      purchaseStatus: 'pendingConfirmation',
    };
    mutateArea('client', (s) => {
      s.certificates.push(certificate);
    });
    return certificate;
  });
}

function ownMembershipOrThrow(id: Id, appUserId: Id | undefined): Membership {
  const item = readArea('client').memberships.find((m) => m.id === id);
  if (!item || !appUserId || item.appUserId !== appUserId) throw new ApiError('forbidden');
  return item;
}

function ownCertificateOrThrow(id: Id, appUserId: Id | undefined): GiftCertificate {
  const item = readArea('client').certificates.find((c) => c.id === id);
  if (!item || !appUserId || item.appUserId !== appUserId) throw new ApiError('forbidden');
  return item;
}

/** «Я оплатил» на заявке абонемента (В-17, как ручная предоплата F-00-097) — дальше решает бизнес */
export function markMembershipPaymentSent(id: Id, appUserId: Id | undefined): Promise<Membership> {
  if (isApiMode()) return CLX.me('markMembershipPaymentSent', [id]);
  return request(() => {
    const item = ownMembershipOrThrow(id, appUserId);
    if (item.purchaseStatus !== 'pendingConfirmation') throw new ApiError('not_allowed');
    let updated: Membership | undefined;
    mutateArea('client', (s) => {
      const m = s.memberships.find((x) => x.id === id);
      if (!m) return;
      m.paymentSentAt = nowDateTime();
      updated = m;
    });
    if (!updated) throw new Error('membership_not_found');
    return updated;
  });
}

/** «Я оплатил» на заявке сертификата (В-17) */
export function markCertificatePaymentSent(id: Id, appUserId: Id | undefined): Promise<GiftCertificate> {
  if (isApiMode()) return CLX.me('markCertificatePaymentSent', [id]);
  return request(() => {
    const item = ownCertificateOrThrow(id, appUserId);
    if (item.purchaseStatus !== 'pendingConfirmation') throw new ApiError('not_allowed');
    let updated: GiftCertificate | undefined;
    mutateArea('client', (s) => {
      const c = s.certificates.find((x) => x.id === id);
      if (!c) return;
      c.paymentSentAt = nowDateTime();
      updated = c;
    });
    if (!updated) throw new Error('certificate_not_found');
    return updated;
  });
}

/**
 * Заявки на покупку абонемента/сертификата в приложении, ждущие решения бизнеса (В-17) — для раздела
 * loyalty («Заявки на покупку», кнопки «Подтвердить оплату» / «Отклонить»).
 */
export interface PurchaseRequest {
  id: Id;
  kind: 'membership' | 'certificate';
  businessId: Id;
  itemName: string;
  price: Money;
  clientName: string;
  clientPhone?: string;
  status: PurchaseStatus;
  purchasedAt: ISODateTime;
  paymentSentAt?: ISODateTime;
}

function appUserLabel(core: ReturnType<typeof readCore>, appUserId: Id): { clientName: string; clientPhone?: string } {
  const user = core.appUsers.find((u) => u.id === appUserId);
  return { clientName: user?.name ?? appUserId, clientPhone: user?.phone };
}

/** Список заявок бизнеса — по умолчанию только «ждут решения», статусом можно попросить все (loyalty) */
export function listPurchaseRequests(businessId: Id, status: 'pendingConfirmation' | 'all' = 'pendingConfirmation'): Promise<PurchaseRequest[]> {
  if (isApiMode()) return CLX.biz(businessId, 'listPurchaseRequests', [status]);
  return request(() => {
    const core = readCore();
    const s = readArea('client');
    const memberships: PurchaseRequest[] = s.memberships
      .filter((m) => m.businessId === businessId && (status === 'all' || m.purchaseStatus === status))
      .map((m) => ({
        id: m.id,
        kind: 'membership' as const,
        businessId: m.businessId,
        itemName: pickText(m.title, 'ru'),
        price: m.price,
        status: m.purchaseStatus,
        purchasedAt: m.purchasedAt,
        paymentSentAt: m.paymentSentAt,
        ...appUserLabel(core, m.appUserId),
      }));
    const certificates: PurchaseRequest[] = s.certificates
      .filter((c) => c.businessId === businessId && (status === 'all' || c.purchaseStatus === status))
      .map((c) => ({
        id: c.id,
        kind: 'certificate' as const,
        businessId: c.businessId,
        itemName: c.number,
        price: c.faceValue,
        status: c.purchaseStatus,
        purchasedAt: c.purchasedAt,
        paymentSentAt: c.paymentSentAt,
        ...appUserLabel(core, c.appUserId),
      }));
    return [...memberships, ...certificates].sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1));
  });
}

/** Сколько заявок ждёт решения — счётчик у пункта меню loyalty (В-17, как online.requests) */
export function countPendingPurchaseRequests(businessId: Id): Promise<number> {
  if (isApiMode()) return CLX.biz(businessId, 'countPendingPurchaseRequests');
  return request(() => {
    const s = readArea('client');
    const pending = (list: { businessId: Id; purchaseStatus: PurchaseStatus }[]) =>
      list.filter((x) => x.businessId === businessId && x.purchaseStatus === 'pendingConfirmation').length;
    return pending(s.memberships) + pending(s.certificates);
  });
}

/** Подтвердить оплату заявки (В-17) — абонемент/сертификат становится активным */
export function confirmMembershipPurchase(businessId: Id, id: Id): Promise<Membership> {
  if (isApiMode()) return CLX.biz(businessId, 'confirmMembershipPurchase', [id]);
  return request(() => {
    let updated: Membership | undefined;
    mutateArea('client', (s) => {
      const m = s.memberships.find((x) => x.id === id && x.businessId === businessId);
      if (!m) return;
      m.purchaseStatus = 'confirmed';
      m.active = true;
      updated = m;
    });
    if (!updated) throw new Error('membership_not_found');
    return updated;
  });
}

export function confirmCertificatePurchase(businessId: Id, id: Id): Promise<GiftCertificate> {
  if (isApiMode()) return CLX.biz(businessId, 'confirmCertificatePurchase', [id]);
  return request(() => {
    let updated: GiftCertificate | undefined;
    mutateArea('client', (s) => {
      const c = s.certificates.find((x) => x.id === id && x.businessId === businessId);
      if (!c) return;
      c.purchaseStatus = 'confirmed';
      c.active = true;
      updated = c;
    });
    if (!updated) throw new Error('certificate_not_found');
    return updated;
  });
}

/** Отклонить заявку (В-17) — запись остаётся видна клиенту как отклонённая, визитами/балансом не пользуется */
export function rejectMembershipPurchase(businessId: Id, id: Id): Promise<Membership> {
  if (isApiMode()) return CLX.biz(businessId, 'rejectMembershipPurchase', [id]);
  return request(() => {
    let updated: Membership | undefined;
    mutateArea('client', (s) => {
      const m = s.memberships.find((x) => x.id === id && x.businessId === businessId);
      if (!m) return;
      m.purchaseStatus = 'rejected';
      m.active = false;
      updated = m;
    });
    if (!updated) throw new Error('membership_not_found');
    return updated;
  });
}

export function rejectCertificatePurchase(businessId: Id, id: Id): Promise<GiftCertificate> {
  if (isApiMode()) return CLX.biz(businessId, 'rejectCertificatePurchase', [id]);
  return request(() => {
    let updated: GiftCertificate | undefined;
    mutateArea('client', (s) => {
      const c = s.certificates.find((x) => x.id === id && x.businessId === businessId);
      if (!c) return;
      c.purchaseStatus = 'rejected';
      c.active = false;
      updated = c;
    });
    if (!updated) throw new Error('certificate_not_found');
    return updated;
  });
}

/**
 * Тип абонемента, которым можно продлить конкретный абонемент клиента (F-14-045 «Renew») — тот же
 * businessId/title в текущих доступных к продаже; undefined — абонемент снят с продажи (F-14-045).
 */
export function findRenewTemplate(businessId: Id, title: LocalizedText): Promise<MembershipTemplate | undefined> {
  if (isApiMode()) return CLX.orUndefined(CLX.pub<MembershipTemplate | null>(businessId, 'findRenewTemplate', [title]));
  return request(() =>
    readArea('client').membershipTemplates.find((t) => t.businessId === businessId && t.title.ru === title.ru && t.onSale),
  );
}

/**
 * Абонементы клиента, которые скоро заканчиваются и напоминание о которых он ещё не видел (F-14-046):
 * ≤5 дней до конца или последний визит. Одно напоминание за раз — экран показывает первое из списка.
 */
export function listPendingMembershipReminders(appUserId: Id): Promise<Array<MembershipWithBusiness & { renewTemplateId?: Id }>> {
  if (isApiMode()) return CLX.me('listPendingMembershipReminders');
  return request(() => {
    const core = readCore();
    const area = readArea('client');
    const now = dayjs(nowDateTime());
    return area.memberships
      .filter((m) => m.appUserId === appUserId && m.active && !area.membershipRemindersSeen.includes(m.id))
      .filter((m) => m.visitsLeft <= 1 || dayjs(m.validUntil).diff(now, 'day') <= 5)
      .map((m) => ({
        ...attachBusiness(core, m),
        // Тем же типом можно продлить, только если он ещё продаётся (F-14-045)
        renewTemplateId: area.membershipTemplates.find((t) => t.businessId === m.businessId && t.title.ru === m.title.ru && t.onSale)?.id,
      }));
  });
}

/** Клиент увидел напоминание — не показывать снова, следующее (если есть) покажется позже (F-14-046) */
export function markMembershipReminderSeen(membershipId: Id): Promise<void> {
  if (isApiMode()) return CLX.me<null>('markMembershipReminderSeen', [membershipId]).then(() => undefined);
  return request(() => {
    mutateArea('client', (s) => {
      if (!s.membershipRemindersSeen.includes(membershipId)) s.membershipRemindersSeen.push(membershipId);
    });
  });
}

/** Сотрудники бизнеса для выбора на картинке сторис (F-00-157) — только имя и id, без чувствительного */
export function listStaffBrief(businessId: Id): Promise<Array<{ id: Id; name: string }>> {
  if (isApiMode()) {
    return ST.listStaff(businessId).then((rows) => {
      const core = readCore();
      return rows.filter((r) => isStaffBookableOnline(core, r.staff)).map((r) => ({ id: r.staff.id, name: r.staff.name }));
    });
  }
  return request(() => {
    const core = readCore();
    // Только мастера, к которым записываются (e2e-q3 №18: администратор и владелец без услуг — не в «Чьи окна показать»)
    return core.staff
      .filter((s) => s.businessId === businessId && isStaffBookableOnline(core, s))
      .map((s) => ({ id: s.id, name: s.name }));
  });
}

// ─────────────────────────── Сторис, новости, продвижение (b05) ───────────────────────────

/** Фиксированное число мест для платных сторис вверху главной одновременно (F-00-160) — решения по числу нет, черновик */
export const STORY_MAX_ACTIVE_SLOTS = 6;
/** Базовая цена сторис на 24 ч, монет (F-14-172 — цена в справке не найдена, у нас не решена) */
export const STORY_BASE_PRICE = 1500;
/** Цена в очереди, когда мест не осталось (F-00-160) */
export const STORY_QUEUE_PRICE = 2500;
/** Бесплатных новостей подписчикам в неделю (F-00-114) */
export const NEWS_FREE_PER_WEEK = 3;
/** Цена новости сверх бесплатного лимита, монет (F-00-027, предл.) */
export const NEWS_EXTRA_PRICE = 300;
/** На сколько дней покупается «выше в поиске» / «место на главной» за один раз (F-00-167, черновик) */
export const BOOST_DAYS = 7;
export const BOOST_PRICE: Record<'search' | 'home', Money> = { search: 2000, home: 3000 };

function countActiveStorySlots(now: string): number {
  return readArea('client').stories.filter((s) => s.status === 'active' && (!s.expiresAt || s.expiresAt > now)).length;
}

export function getStorySlotsInfo(): Promise<{ used: number; max: number }> {
  if (isApiMode()) return CS.getStorySlotsInfoServer();
  return request(() => ({ used: countActiveStorySlots(nowDateTime()), max: STORY_MAX_ACTIVE_SLOTS }));
}

/**
 * Монеты бизнеса — один журнал ядра (core-k4 №1). Начальные балансы демо ещё лежат в срезе (`coinBalances`) — при первой
 * трате они переносятся в журнал ядра одной строкой «начальный баланс», дальше срез не используется.
 */
function ensureCoinsInLedger(businessId: Id): void {
  const legacy = readArea('client').coinBalances[businessId] ?? 0;
  if (legacy <= 0) return;
  coreTx.grantCoins({ businessId, amount: legacy, reason: 'openingBalance', area: 'client', kind: 'topup' });
  mutateArea('client', (s) => {
    s.coinBalances[businessId] = 0;
  });
}

/** Списать монеты за покупку раздела (сторис, новость, продвижение) — одной строкой журнала ядра */
function chargeCoins(businessId: Id, amount: number, reason: string, refId?: Id): void {
  ensureCoinsInLedger(businessId);
  coreTx.chargeCoins({ businessId, amount, reason, area: 'client', refId });
}

export function getCoinBalance(businessId: Id): Promise<number> {
  // api: баланс монет бизнеса — тот же журнал монет сервера, что у «Монет» настроек (этап 18)
  if (isApiMode()) return SETS.getCoinBalance(businessId);
  return request(() => coreTx.coinBalance(businessId) + (readArea('client').coinBalances[businessId] ?? 0));
}

/** Сторис вверху главной приложения клиента, видят ВСЕ (F-00-159): сначала подписки клиента, потом остальные (F-00-161, порядок — предл.) */
export function listHomeStories(appUserId: Id | undefined): Promise<Array<Story & { business: PublicBusiness }>> {
  if (isApiMode()) return CS.listHomeStoriesServer().then((rows) => rows.map((r) => ({ ...r, business: toPublicBusiness(r.business) })));
  return request(() => {
    const core = readCore();
    const area = readArea('client');
    const now = nowDateTime();
    const subscribed = new Set(
      appUserId
        ? area.favorites.filter((f) => f.appUserId === appUserId).map((f) => favoriteBusinessId(core, f)).filter(Boolean)
        : [],
    );
    const list = area.stories
      .filter((s) => storyLiveStatus(s, now) === 'active')
      .map((s) => {
        const business = core.businesses.find((b) => b.id === s.businessId);
        return { ...s, business: business ? toPublicBusiness(business) : undefined };
      })
      .filter((s): s is Story & { business: PublicBusiness } => Boolean(s.business));
    return list.sort((a, b) => {
      const aSub = subscribed.has(a.businessId);
      const bSub = subscribed.has(b.businessId);
      if (aSub !== bSub) return aSub ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  });
}

/** Одна сторис для просмотра (F-00-162, F-14-035) */
export function getStory(storyId: Id): Promise<(Story & { business: PublicBusiness }) | undefined> {
  if (isApiMode()) return CS.getStoryServer(storyId).then((r) => (r ? { ...r, business: toPublicBusiness(r.business) } : undefined));
  return request(() => {
    const core = readCore();
    const story = readArea('client').stories.find((s) => s.id === storyId);
    // По прямому адресу — только действующая сторис (decision-c3 №17): на проверке, отклонённая и истёкшая не видны
    if (!story || storyLiveStatus(story, nowDateTime()) !== 'active') return undefined;
    const business = core.businesses.find((b) => b.id === story.businessId);
    if (!business) return undefined;
    return { ...story, business: toPublicBusiness(business) };
  });
}

export function recordStoryView(storyId: Id): Promise<void> {
  if (isApiMode()) return CS.recordStoryViewServer(storyId);
  return request(() => {
    mutateArea('client', (s) => {
      const story = s.stories.find((x) => x.id === storyId);
      if (story) story.viewCount += 1;
    });
  });
}

export function recordStoryClick(storyId: Id): Promise<void> {
  if (isApiMode()) return CS.recordStoryClickServer(storyId);
  return request(() => {
    mutateArea('client', (s) => {
      const story = s.stories.find((x) => x.id === storyId);
      if (story) story.clickCount += 1;
    });
  });
}

/** Показ акций на карточке места и мастера (F-14-032, F-14-033) — только активные сторис этого бизнеса, новая первой */
export function listBusinessPromoStories(businessId: Id): Promise<Story[]> {
  if (isApiMode()) return CS.listBusinessPromoStoriesServer(businessId);
  return request(() => {
    const now = nowDateTime();
    return readArea('client')
      .stories.filter((s) => s.businessId === businessId && storyLiveStatus(s, now) === 'active')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/**
 * Сторис от лица мастера (владелец, 01.10.2026): с billing.manage — сторис салона, видны и удаляются все; без него
 * сотрудник публикует только свои (о своих работах, от своего профиля) и видит только свои. Не сотрудник — нельзя.
 */
function storyAuthorScope(): { all: true } | { all: false; staffId: Id } {
  if (canNow('billing.manage')) return { all: true };
  const staffId = currentActor().staffId;
  if (!staffId) throw new ApiError('forbidden');
  return { all: false, staffId };
}

/** Все сторис бизнеса, любых статусов — экран «Сторис» в кабинете (F-00-155…163, F-14-172); статус — с решением панели */
export function listBusinessStories(businessId: Id): Promise<Story[]> {
  if (isApiMode()) return CS.listBusinessStoriesServer(businessId);
  return request(() => {
    const now = nowDateTime();
    const scope = storyAuthorScope();
    return readArea('client')
      .stories.filter((s) => s.businessId === businessId && (scope.all || s.authorStaffId === scope.staffId))
      .map((s) => ({ ...s, status: storyLiveStatus(s, now) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/**
 * Статус сторис с учётом нашей модерации (F-00-168): своя фотография ждёт в очереди панели; одобрили — сторис идёт
 * 24 ч с момента решения, отклонили — «отклонена». Шаблон выходит сразу.
 */
function storyLiveStatus(story: Story, now: ISODateTime): Story['status'] {
  if (story.status === 'pending_review') {
    const item = moderationItemFor(story.id);
    if (!item || item.status === 'pending') return 'pending_review';
    if (item.status === 'rejected') return 'rejected';
    const from = item.decidedAt ?? story.createdAt;
    return toISODateTime(dayjs(from).add(24, 'hour')) > now ? 'active' : 'expired';
  }
  if (story.status === 'active' && story.expiresAt && story.expiresAt <= now) return 'expired';
  return story.status;
}

/** Решение нашей панели по материалу (читаем чужой срез только внутри своей api-функции, CONVENTIONS §6) */
function moderationItemFor(refId: Id): { status: string; decidedAt?: ISODateTime } | undefined {
  const platform = readArea('platform') as { moderationItems?: { refId: Id; status: string; decidedAt?: ISODateTime }[] } | undefined;
  return platform?.moderationItems?.find((m) => m.refId === refId);
}

export interface GenerateStoryInput {
  businessId: Id;
  lang: StoryLang[];
  showStaffNames: boolean;
  /** Мастера, чьи окна показать (пусто — весь бизнес одной строкой); F-00-157 */
  staffIds: Id[];
  period: 'today' | 'tomorrow';
}

/** Одна кнопка → готовая картинка (F-00-155, F-00-156) — без сохранения, только предпросмотр перед покупкой */
/** Подпись «свободно сегодня/завтра» на языках картинки (F-00-156, F-00-158) — до двух сразу, через « / » */
const FREE_TODAY_LABEL: Record<StoryLang, string> = { ru: 'Свободно сегодня', hy: 'Ազատ է այսօր', en: 'Free today' };
const FREE_TOMORROW_LABEL: Record<StoryLang, string> = { ru: 'Свободно завтра', hy: 'Ազատ է վաղը', en: 'Free tomorrow' };

export function generateStoryPreview(input: GenerateStoryInput): Promise<{ imageUrl: string; windows: StorySlotWindowPreview[] }> {
  if (isApiMode()) return generateStoryPreviewApi(input);
  return request(() => {
    const core = readCore();
    const business = core.businesses.find((b) => b.id === input.businessId);
    if (!business) throw new ApiError('not_found');
    const langs = input.lang.length ? input.lang : (['ru'] as StoryLang[]);
    const labels = input.period === 'today' ? FREE_TODAY_LABEL : FREE_TOMORROW_LABEL;
    const dateLabel = langs.map((l) => labels[l]).join(' / ');
    const targetDate = input.period === 'today' ? toISODate(dayjs()) : toISODate(dayjs().add(1, 'day'));
    // Только те, к кому записываются: без администратора и владельца без услуг (demo-q4, e2e-q3 №18)
    const bookable = core.staff.filter((s) => s.businessId === input.businessId && isStaffBookableOnline(core, s, { hiddenIds: moderationHiddenIds() }));
    // Мастер без billing.manage — сторис только со своими окнами
    const scope = storyAuthorScope();
    const staffIds = scope.all ? input.staffIds : [scope.staffId];
    const staffList = staffIds.length ? bookable.filter((s) => staffIds.includes(s.id)) : bookable;
    const windows: StorySlotWindowPreview[] = staffList
      .slice(0, 6)
      .map((staff) => {
        // Окна — как в «Свободно сегодня» (e2e-q4 №5): под самую короткую услугу, сегодня — от текущего времени
        const service = shortestService(visibleServices(core, staff));
        const slots = dedupeSlots(
          computeFreeSlots(core, { staffId: staff.id, date: targetDate, durationMin: service?.durationMin ?? CATALOG_DEFAULT_DURATION, bufferAfterMin: service?.bufferAfterMin }),
        ).slice(0, 3);
        return { staffId: staff.id, staffName: input.showStaffNames ? staff.name : undefined, times: slots.map((s) => s.start.slice(11, 16)) };
      })
      // Мастера без единого свободного окна в эту картинку не попадают (пустая строка «—» не нужна никому)
      .filter((w) => w.times.length > 0)
      .slice(0, 4);
    const lines = [
      dateLabel,
      ...windows.map((w) => (w.staffName ? `${w.staffName} · ${w.times.join(', ')}` : w.times.join(', '))),
    ];
    const imageUrl = generateStoryImage({ businessName: business.name, lines, lang: langs.join('+') });
    return { imageUrl, windows };
  });
}

/**
 * Этап 21 (сдача, попытка 6): предпросмотр сторис в режиме api — окна мастеров считает сервер (те же свободные окна,
 * что карточка мастера, `GET /v1/public/masters/{id}/slots` под самую короткую услугу), картинку собирает
 * та же чистая функция `generateStoryImage`. Мастера и услуги — зеркало сервера (mirror.ts).
 */
async function generateStoryPreviewApi(input: GenerateStoryInput): Promise<{ imageUrl: string; windows: StorySlotWindowPreview[] }> {
  const core = readCore();
  const business = core.businesses.find((b) => b.id === input.businessId);
  if (!business) throw new ApiError('not_found');
  const langs = input.lang.length ? input.lang : (['ru'] as StoryLang[]);
  const labels = input.period === 'today' ? FREE_TODAY_LABEL : FREE_TOMORROW_LABEL;
  const dateLabel = langs.map((l) => labels[l]).join(' / ');
  const targetDate = input.period === 'today' ? toISODate(dayjs()) : toISODate(dayjs().add(1, 'day'));
  const bookable = await listStaffBrief(input.businessId);
  const picked = (input.staffIds.length ? bookable.filter((s) => input.staffIds.includes(s.id)) : bookable).slice(0, 6);
  const rows = await Promise.all(
    picked.map(async (brief) => {
      const staff = core.staff.find((s) => s.id === brief.id);
      const service = staff ? shortestService(visibleServices(core, staff)) : undefined;
      const slots = dedupeSlots(await CS.getSlotsServer(brief.id, targetDate, service?.id)).slice(0, 3);
      return { staffId: brief.id, staffName: input.showStaffNames ? brief.name : undefined, times: slots.map((x) => x.start.slice(11, 16)) };
    }),
  );
  const windows = rows.filter((w) => w.times.length > 0).slice(0, 4);
  const lines = [dateLabel, ...windows.map((w) => (w.staffName ? `${w.staffName} · ${w.times.join(', ')}` : w.times.join(', ')))];
  return { imageUrl: generateStoryImage({ businessName: business.name, lines, lang: langs.join('+') }), windows };
}

export interface StorySlotWindowPreview {
  staffId: Id;
  staffName?: string;
  times: string[];
}

export interface PurchaseStoryInput {
  businessId: Id;
  kind: 'generated' | 'photo';
  imageUrl: string;
  lang: StoryLang[];
  showStaffNames: boolean;
  windows: StorySlotWindowPreview[];
  bookingTarget?: { staffId?: Id; serviceId?: Id };
  /** Подпись миниатюры своей фотографии — до 70 символов (F-14-034) */
  caption?: string;
}

/**
 * Покупка сторис (F-00-159, F-00-160): шаблон — сразу активна (F-00-168/169), своя фотография — ждёт
 * ручной проверки platform. Мест не осталось — встаёт в очередь по более дорогой цене (F-00-160).
 */
export async function purchaseStory(input: PurchaseStoryInput): Promise<Story> {
  if (isApiMode()) return CS.purchaseStoryServer(input);
  const story = await request(() => {
    const scope = storyAuthorScope();
    const now = nowDateTime();
    const full = countActiveStorySlots(now) >= STORY_MAX_ACTIVE_SLOTS;
    const price = full ? STORY_QUEUE_PRICE : STORY_BASE_PRICE;
    const id = newId('sty');
    chargeCoins(input.businessId, price, input.kind === 'photo' ? 'storyPhoto' : 'storyPlace', id);
    let story!: Story;
    mutateArea('client', (s) => {
      story = {
        id,
        businessId: input.businessId,
        kind: input.kind,
        imageUrl: input.imageUrl,
        lang: input.lang,
        showStaffNames: input.showStaffNames,
        // Мастер — только свои окна и запись к себе
        windows: input.windows
          .filter((w) => scope.all || w.staffId === scope.staffId)
          .map((w) => ({ staffId: w.staffId, staffName: w.staffName, label: w.times.join(', ') })),
        bookingTarget: scope.all ? input.bookingTarget : { ...input.bookingTarget, staffId: scope.staffId },
        authorStaffId: scope.all ? undefined : scope.staffId,
        caption: input.caption?.slice(0, 70),
        status: input.kind === 'photo' ? 'pending_review' : full ? 'queued' : 'active',
        price,
        createdAt: now,
        expiresAt: input.kind === 'photo' || full ? undefined : toISODateTime(dayjs(now).add(24, 'hour')),
        viewCount: 0,
        clickCount: 0,
        bookingCount: 0,
      };
      s.stories.push(story);
    });
    return story;
  });
  // Своя фотография — в очередь нашей панели (decision-c3 №8, e2e-q3 №6): одобрят — выйдет, отклонят — монеты вернут
  if (input.kind === 'photo') {
    await submitForModeration({
      kind: 'story',
      businessId: input.businessId,
      refId: story.id,
      imageUrl: input.imageUrl,
      text: input.caption,
      paidCoins: story.price,
    });
  }
  return story;
}

/** Снять сторис: свою — автору, любую — с billing.manage (владелец, 01.10.2026). Монеты за показ не возвращаются */
export function deleteStory(storyId: Id): Promise<void> {
  if (isApiMode()) return CS.deleteStoryServer(storyId);
  return request(() => {
    const story = readArea('client').stories.find((s) => s.id === storyId);
    if (!story) throw new ApiError('not_found');
    const scope = storyAuthorScope();
    if (!scope.all && story.authorStaffId !== scope.staffId) throw new ApiError('forbidden');
    mutateArea('client', (s) => {
      s.stories = s.stories.filter((x) => x.id !== storyId);
    });
  });
}

// ─────────────────────────── Новости подписчикам (F-00-114) ───────────────────────────

function newsWeekCount(businessId: Id, now: string): number {
  const weekAgo = toISODateTime(dayjs(now).subtract(7, 'day'));
  return readArea('client').newsPosts.filter((p) => p.businessId === businessId && p.createdAt > weekAgo).length;
}

export function listNewsPosts(businessId: Id): Promise<NewsPost[]> {
  if (isApiMode()) return CS.listNewsPostsServer(businessId);
  return request(() => {
    deliverApprovedNews();
    return readArea('client')
      .newsPosts.filter((p) => p.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export function getNewsWeekStatus(businessId: Id): Promise<{ used: number; free: number }> {
  if (isApiMode()) return CS.getNewsWeekStatusServer(businessId);
  return request(() => ({ used: newsWeekCount(businessId, nowDateTime()), free: NEWS_FREE_PER_WEEK }));
}

/**
 * Новость подписчикам (F-00-114): до 3 бесплатных в неделю, дальше — монеты. Уходит только подписчикам,
 * приглушившим новости (F-00-115) — не уходит: используем ту же фан-аут ленту `notifications`, что и
 * F-14-055, поэтому «Новости» на карточке продолжают работать как выключатель без изменений там.
 */
export async function createNewsPost(input: { businessId: Id; text: string; photoUrl?: string }): Promise<NewsPost> {
  if (isApiMode()) return CS.createNewsPostServer(input);
  const post = await request(() => {
    assertCan('notify.mailings');
    const now = nowDateTime();
    const used = newsWeekCount(input.businessId, now);
    const paidWithCoins = used >= NEWS_FREE_PER_WEEK;
    const id = newId('nws');
    if (paidWithCoins) chargeCoins(input.businessId, NEWS_EXTRA_PRICE, 'newsExtra', id);
    let post!: NewsPost;
    mutateArea('client', (s) => {
      // Текст и своё фото — только после нашей проверки (F-00-168, decision-c3 №7): подписчикам уходит после одобрения
      post = { id, businessId: input.businessId, text: input.text, photoUrl: input.photoUrl, createdAt: now, paidWithCoins, status: 'pending_review' };
      s.newsPosts.push(post);
    });
    return post;
  });
  await submitForModeration({
    kind: 'text',
    businessId: input.businessId,
    refId: post.id,
    text: input.text,
    imageUrl: input.photoUrl,
    paidCoins: post.paidWithCoins ? NEWS_EXTRA_PRICE : undefined,
  });
  return post;
}

/**
 * Разослать одобренные новости подписчикам (F-00-114): новость уходит в ленту только после одобрения нашей панелью;
 * рассылка идёт один раз — при первом чтении после решения. Только внутри request().
 */
function deliverApprovedNews(): void {
  const area = readArea('client');
  const ready = area.newsPosts.filter((p) => p.status === 'pending_review' && moderationItemFor(p.id)?.status === 'approved');
  const rejected = area.newsPosts.filter((p) => p.status === 'pending_review' && moderationItemFor(p.id)?.status === 'rejected');
  if (!ready.length && !rejected.length) return;
  const core = readCore();
  const now = nowDateTime();
  mutateArea('client', (s) => {
    for (const p of ready) {
      const post = s.newsPosts.find((x) => x.id === p.id);
      if (!post) continue;
      post.status = 'sent';
      post.sentAt = now;
      // Подписчики бизнеса и любого его мастера, не приглушившие новости (F-00-115), без повторов
      const staffIds = new Set(core.staff.filter((st) => st.businessId === post.businessId).map((st) => st.id));
      const recipients = new Set(
        s.favorites.filter((f) => !f.newsMuted && (f.targetId === post.businessId || staffIds.has(f.targetId))).map((f) => f.appUserId),
      );
      for (const appUserId of recipients) {
        s.notifications.push({ id: newId('ntf'), appUserId, kind: 'broadcast', businessId: post.businessId, params: { text: post.text }, createdAt: now });
      }
    }
    for (const p of rejected) {
      const post = s.newsPosts.find((x) => x.id === p.id);
      if (post) post.status = 'rejected';
    }
  });
}

/** Число подписчиков бизнеса — предупредить, что новость некому отправлять (recheck-c3, новые находки) */
export function countNewsSubscribers(businessId: Id): Promise<number> {
  return request(() => {
    const core = readCore();
    const staffIds = new Set(core.staff.filter((st) => st.businessId === businessId).map((st) => st.id));
    return new Set(
      readArea('client')
        .favorites.filter((f) => !f.newsMuted && (f.targetId === businessId || staffIds.has(f.targetId)))
        .map((f) => f.appUserId),
    ).size;
  });
}

// ─────────────────────────── Продвижение: горящие окна, выше в поиске (F-00-103, F-00-167) ───────────────────────────

export function getPromotionSettings(businessId: Id): Promise<PromotionSettings> {
  if (isApiMode()) return CS.getPromotionSettingsServer(businessId);
  return request(() => readArea('client').promotionSettings[businessId] ?? {});
}

export function setHotSlotDiscount(businessId: Id, percent: number | undefined): Promise<void> {
  if (isApiMode()) return CS.setHotSlotDiscountServer(businessId, percent);
  return request(() => {
    assertCan('billing.manage');
    mutateArea('client', (s) => {
      s.promotionSettings[businessId] = { ...s.promotionSettings[businessId], hotSlotDiscountPercent: percent };
    });
  });
}

/** «Выше в поиске» / «место на главной» за монеты — решения нет, черновик (F-00-167) */
export function purchaseBoost(businessId: Id, kind: 'search' | 'home'): Promise<void> {
  if (isApiMode()) return CS.purchaseBoostServer(businessId, kind);
  return request(() => {
    assertCan('billing.manage');
    const price = BOOST_PRICE[kind];
    const now = nowDateTime();
    chargeCoins(businessId, price, kind === 'search' ? 'boostSearch' : 'boostHome');
    mutateArea('client', (s) => {
      const key = kind === 'search' ? 'boostSearch' : 'boostHome';
      s.promotionSettings[businessId] = {
        ...s.promotionSettings[businessId],
        [key]: { active: true, expiresAt: toISODateTime(dayjs(now).add(BOOST_DAYS, 'day')) },
      };
    });
  });
}

// ─────────────────────────── Клиенты без приложения: «Напомнить» (F-00-121) ───────────────────────────

export interface NoAppReminderRow {
  bookingId: Id;
  clientName: string;
  phone: string;
  /** Название по-русски (текст WhatsApp мастера и сервер); экран берёт serviceTitle по языку */
  serviceName: string;
  serviceTitle?: LocalizedText;
  time: ISODateTime;
  whatsappUrl: string;
}

/** «Завтра N клиентов без приложения» + готовый текст в WhatsApp мастера (F-00-121) */
export function listNoAppRemindersTomorrow(businessId: Id): Promise<NoAppReminderRow[]> {
  if (isApiMode()) return CS.listNoAppRemindersTomorrowServer(businessId);
  return request(() => {
    assertCan('clients.phones');
    const core = readCore();
    const tomorrow = toISODate(dayjs().add(1, 'day'));
    const rows: NoAppReminderRow[] = [];
    for (const b of core.bookings) {
      if (b.businessId !== businessId || b.deletedAt || !b.start.startsWith(tomorrow)) continue;
      if (!['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'].includes(b.status)) continue;
      const client = b.clientId ? core.clients.find((c) => c.id === b.clientId) : undefined;
      if (!client || client.appUserId) continue; // с приложением — напоминаем пушем (F-00-120), не сюда
      const service = core.services.find((s) => s.id === b.services[0]?.serviceId);
      const time = b.start.slice(11, 16);
      const text = `Здравствуйте, ${client.name}! Напоминаю о записи завтра в ${time}${service ? ` на «${service.name.ru}»` : ''}. Ждём вас!`;
      rows.push({ bookingId: b.id, clientName: client.name, phone: client.phone, serviceName: service?.name.ru ?? '', serviceTitle: service?.name, time: b.start, whatsappUrl: waLink(client.phone, text) });
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  });
}

// ─────────────────────────── b06: своё приложение салона (F-14-142…170) ───────────────────────────

function readBrandedApp(businessId: Id): BrandedAppRequest {
  const existing = readArea('client').brandedApp[businessId];
  if (existing) return existing;
  return { businessId, stage: 'draft', materials: { ...BRANDED_APP_MATERIALS_EMPTY }, docs: { ...BRANDED_APP_DOCS_EMPTY }, extraLocations: 0 };
}

export function getBrandedAppRequest(businessId: Id): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.getBrandedAppRequestServer(businessId);
  return request(() => readBrandedApp(businessId));
}

function mutateBrandedApp(businessId: Id, apply: (r: BrandedAppRequest) => void): void {
  mutateArea('client', (s) => {
    const current = s.brandedApp[businessId] ?? {
      businessId,
      stage: 'draft',
      materials: { ...BRANDED_APP_MATERIALS_EMPTY },
      docs: { ...BRANDED_APP_DOCS_EMPTY },
      extraLocations: 0,
    };
    apply(current);
    s.brandedApp[businessId] = current;
  });
}

/** Ссылки на уже опубликованные приложения бизнеса — предлагаются клиенту после записи (F-14-144) */
export function saveBrandedAppLinks(businessId: Id, links: { iosLink?: string; androidLink?: string }): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.saveBrandedAppLinksServer(businessId, links);
  return request(() => {
    assertCan('billing.manage');
    mutateBrandedApp(businessId, (r) => {
      r.iosLink = links.iosLink?.trim() || undefined;
      r.androidLink = links.androidLink?.trim() || undefined;
    });
    return readBrandedApp(businessId);
  });
}

/** На кого регистрировать аккаунт Apple Developer (F-14-153) */
export function setBrandedAppOwnerType(businessId: Id, ownerType: BrandedAppOwnerType): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.setBrandedAppOwnerTypeServer(businessId, ownerType);
  return request(() => {
    assertCan('billing.manage');
    mutateBrandedApp(businessId, (r) => {
      r.ownerType = ownerType;
    });
    return readBrandedApp(businessId);
  });
}

/** Как передавать Altegio доступ к аккаунтам (F-14-157) */
export function setBrandedAppAccessMethod(businessId: Id, method: BrandedAppAccessMethod): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.setBrandedAppAccessMethodServer(businessId, method);
  return request(() => {
    assertCan('billing.manage');
    mutateBrandedApp(businessId, (r) => {
      r.accessMethod = method;
    });
    return readBrandedApp(businessId);
  });
}

/** Число дополнительных филиалов сверх первого — влияет на годовую цену (F-14-168, F-14-169) */
export function setBrandedAppExtraLocations(businessId: Id, extraLocations: number): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.setBrandedAppExtraLocationsServer(businessId, extraLocations);
  return request(() => {
    assertCan('billing.manage');
    mutateBrandedApp(businessId, (r) => {
      r.extraLocations = Math.max(0, Math.round(extraLocations));
    });
    return readBrandedApp(businessId);
  });
}

/** Материалы: заставка, логотип, названия, описания, картинка Featured (F-14-148…152) */
export function saveBrandedAppMaterials(businessId: Id, patch: Partial<BrandedAppMaterials>): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.saveBrandedAppMaterialsServer(businessId, patch);
  return request(() => {
    assertCan('billing.manage');
    mutateBrandedApp(businessId, (r) => {
      r.materials = { ...r.materials, ...patch };
    });
    return readBrandedApp(businessId);
  });
}

/** Отметка в чеклисте документов и доступов (F-14-147, «добавлено проверкой 1») */
export function toggleBrandedAppDoc(businessId: Id, key: keyof BrandedAppRequest['docs'], value: boolean): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.toggleBrandedAppDocServer(businessId, key, value);
  return request(() => {
    assertCan('billing.manage');
    mutateBrandedApp(businessId, (r) => {
      r.docs = { ...r.docs, [key]: value };
    });
    return readBrandedApp(businessId);
  });
}

/** Что мешает отправить заявку (F-14-147, F-14-151) — экран показывает список и держит кнопку выключенной */
export function getBrandedAppBlockers(r: BrandedAppRequest): string[] {
  const blockers: string[] = [];
  if (!r.materials.fullName.trim()) blockers.push('fullName');
  if (!r.materials.shortName.trim()) blockers.push('shortName');
  if (!r.materials.shortDescription.trim()) blockers.push('shortDescription');
  if (!r.materials.logoUrl) blockers.push('logo');
  if (!r.materials.splashUrl) blockers.push('splash');
  if (!r.docs.appleDeveloperAccess) blockers.push('appleDeveloperAccess');
  if (!r.docs.googlePlayAccess) blockers.push('googlePlayAccess');
  if (!r.docs.registrationDoc) blockers.push('registrationDoc');
  if (!r.docs.trademarkDoc) blockers.push('trademarkDoc');
  if (checkBrandedAppText(r.materials.shortDescription).length > 0) blockers.push('shortDescriptionText');
  if (checkBrandedAppText(r.materials.longDescription).length > 0) blockers.push('longDescriptionText');
  return blockers;
}

/**
 * Заявка через менеджера (F-14-145): создаёт обращение в очередь поддержки platform и переводит
 * заявку в статус «отправлена». Пока не собраны материалы и документы — не отправляется (F-14-147).
 */
export function submitBrandedAppRequest(businessId: Id, contact: { name: string; phone?: string }): Promise<BrandedAppRequest> {
  if (isApiMode()) return CS.submitBrandedAppRequestServer(businessId, contact);
  return request(() => {
    assertCan('billing.manage');
    const core = readCore();
    const business = core.businesses.find((b) => b.id === businessId);
    if (!business) throw new ApiError('validation');
    const current = readBrandedApp(businessId);
    if (getBrandedAppBlockers(current).length > 0) throw new ApiError('validation');
    createSupportTicket({
      from: 'business',
      businessId,
      name: contact.name,
      phone: contact.phone,
      channel: 'cabinet',
      section: 'clientApp',
      topic: 'other',
      text: `Заявка на своё (брендированное) приложение «${current.materials.fullName}». Тип аккаунта Apple: ${current.ownerType ?? 'не выбран'}. Доп. филиалов: ${current.extraLocations}.`,
    });
    mutateBrandedApp(businessId, (r) => {
      r.stage = 'submitted';
      r.submittedAt = nowDateTime();
    });
    return readBrandedApp(businessId);
  });
}

// ─────────────────────────── Визит и оплата в приложении (F-14-092…098, F-14-102) ───────────────────────────

export interface VisitCandidate {
  booking: Booking;
  clientName: string;
}

/**
 * Визиты бизнеса сегодня, доступные для открытия в приложении — «Пришёл» и «Ожидание» (F-14-093, F-14-094).
 * `viewerStaffId` — сотрудник, который открыл приложение: если у него включено «Только свои записи»
 * (F-14-119), список сужается до его собственных визитов — здесь единственное место в разделе `client`,
 * где этот доступ реально на что-то влияет (тот же список в журнале — раздел `journal`, не мой; см.
 * `qa/requests/client.md`).
 */
export function listVisitCandidates(businessId: Id, viewerStaffId?: Id): Promise<VisitCandidate[]> {
  if (isApiMode()) return CS.listVisitCandidatesServer(businessId, viewerStaffId);
  return request(async () => {
    const core = readCore();
    const today = toISODate(dayjs());
    const access = viewerStaffId ? readArea('client').employeeAppAccess[viewerStaffId] : undefined;
    const onlyOwn = Boolean(access?.onlyOwnBookings);
    return core.bookings
      .filter((b) => b.businessId === businessId && !b.deletedAt && toISODate(dayjs(b.start)) === today)
      .filter((b) => ['arrived', 'scheduled', 'client_confirmed', 'awaiting_confirmation'].includes(b.status))
      .filter((b) => !onlyOwn || b.staffId === viewerStaffId)
      // Те же права, что в журнале: чужие визиты — только с journal.others (мастер видит свои)
      .filter((b) => canNow('journal.view', { targetStaffId: b.staffId }))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((booking) => {
        const client = core.clients.find((c) => c.id === booking.clientId);
        // Без имени — пусто: подпись «Гость» ставит экран на языке пользователя (F-14-168)
        return { booking, clientName: booking.visitorName ?? client?.name ?? '' };
      });
  });
}

export interface VisitDetail {
  booking: Booking;
  clientName: string;
  /** Только в режиме api (сервер отдаёт сразу — там нет readCore() для buildVisitReceiptText, F-14-095) */
  businessName?: string;
  saleLines: VisitSaleLine[];
  payments: VisitPaymentLine[];
  salesTotal: Money;
  dueTotal: Money;
  paidTotal: Money;
  remaining: Money;
}

export function getVisitDetail(bookingId: Id): Promise<VisitDetail | undefined> {
  if (isApiMode()) return CS.getVisitDetailServer(bookingId);
  return request(async () => {
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId);
    if (!booking) return undefined;
    assertCan('journal.view', { targetStaffId: booking.staffId });
    const client = core.clients.find((c) => c.id === booking.clientId);
    const area = readArea('client');
    const saleLines = area.visitSaleLines.filter((l) => l.bookingId === bookingId);
    // Возвращённые оплаты остаются в списке с пометкой «возвращена» (F-14-095/097), в «Оплачено» не идут
    const payments = area.visitPayments.filter((p) => p.bookingId === bookingId);
    const salesTotal = saleLines.reduce((sum, l) => sum + Math.max(0, l.price - l.discount), 0);
    const dueTotal = booking.total + salesTotal;
    const paidTotal = payments.filter((p) => !p.refundedAt).reduce((sum, p) => sum + p.amount, 0);
    return {
      booking,
      clientName: booking.visitorName ?? client?.name ?? '',
      saleLines,
      payments,
      salesTotal,
      dueTotal,
      paidTotal,
      remaining: Math.max(0, dueTotal - paidTotal),
    };
  });
}

/**
 * Квитанция об оплате визита — итог, услуги/товары и способ оплаты одним текстом (F-14-095).
 * PDF в демо не рендерим файлом: текст квитанции отдаём как есть, экран сам собирает из него .txt для скачивания
 * (реальный PDF — на бэкенде, здесь бэкенда нет).
 */
export function buildVisitReceiptText(detail: VisitDetail): string {
  const lines: string[] = [];
  const businessName = isApiMode() ? (detail.businessName ?? 'Квитанция') : (readCore().businesses.find((b) => b.id === detail.booking.businessId)?.name ?? 'Квитанция');
  lines.push(businessName);
  lines.push(`№ ${detail.booking.id.slice(-6).toUpperCase()} · ${toISODate(dayjs(detail.booking.start))}`);
  lines.push('—');
  for (const line of detail.saleLines) {
    lines.push(`${line.title} · ${line.price - line.discount} ֏`);
  }
  lines.push(`Итого: ${detail.dueTotal} ֏`);
  for (const p of detail.payments.filter((x) => !x.refundedAt)) {
    lines.push(`Оплачено (${p.method}): ${p.amount} ֏`);
  }
  return lines.join('\n');
}

/** Отправить клиенту квитанцию об оплате визита — пушем в ленту (F-14-095) */
export function sendVisitReceipt(input: { bookingId: Id; appUserId: Id; businessId: Id; total: Money }): Promise<NotificationItem> {
  if (isApiMode()) return CS.sendVisitReceiptServer(input);
  return request(() => {
    const item: NotificationItem = {
      id: newId('ntf'),
      appUserId: input.appUserId,
      businessId: input.businessId,
      bookingId: input.bookingId,
      kind: 'receipt',
      params: { amount: input.total },
      createdAt: nowDateTime(),
    };
    mutateArea('client', (s) => {
      s.notifications.push(item);
      s.visitReceiptSentAt[input.bookingId] = item.createdAt;
    });
    return item;
  });
}

export function isVisitReceiptSent(bookingId: Id): Promise<boolean> {
  if (isApiMode()) return CS.isVisitReceiptSentServer(bookingId);
  return request(() => Boolean(readArea('client').visitReceiptSentAt[bookingId]));
}

/** Демо-кассы бизнеса (F-14-096) — три кассы показывают «Все кассы» у наличных; настоящие кассы живут
 *  в разделе finance и сюда не проброшены (см. qa/requests/client.md). */
export const DEMO_CASH_DESKS: VisitCashDesk[] = [
  { id: 'desk-1', name: 'Касса 1' },
  { id: 'desk-2', name: 'Касса 2' },
  { id: 'desk-3', name: 'Касса 3' },
];

export function listCashDesks(): Promise<VisitCashDesk[]> {
  return request(() => DEMO_CASH_DESKS);
}

export function generateSaleCode(): Promise<string> {
  return request(() => String(Math.floor(100000 + Math.random() * 900000)));
}

export interface AddSaleLineInput {
  bookingId: Id;
  kind: VisitSaleLine['kind'];
  title: string;
  price: Money;
  discount?: number;
  sellerStaffId?: Id;
  code?: string;
}

/** Правка визита из приложения — те же права, что оплата в журнале: journal.edit, чужой визит — с journal.others */
function assertVisitEdit(bookingId: Id | undefined): void {
  const booking = bookingId ? readCore().bookings.find((b) => b.id === bookingId) : undefined;
  if (!booking) throw new ApiError('not_found');
  assertCan('journal.edit', { targetStaffId: booking.staffId });
}

/** «+ Add sale»: продажа товара, абонемента или сертификата в визите (F-14-092) */
export function addVisitSaleLine(input: AddSaleLineInput): Promise<VisitSaleLine> {
  if (isApiMode()) return CS.addVisitSaleLineServer(input);
  return request(() => {
    assertVisitEdit(input.bookingId);
    const line: VisitSaleLine = {
      id: newId('vsl'),
      bookingId: input.bookingId,
      kind: input.kind,
      title: input.title,
      price: input.price,
      discount: input.discount ?? 0,
      sellerStaffId: input.sellerStaffId,
      code: input.code,
    };
    mutateArea('client', (s) => {
      s.visitSaleLines.push(line);
    });
    return line;
  });
}

/** Корзина у товара в «Products and memberships» — удаляет продажу (F-14-092) */
export function removeVisitSaleLine(id: Id): Promise<void> {
  if (isApiMode()) return CS.removeVisitSaleLineServer(id);
  return request(() => {
    assertVisitEdit(readArea('client').visitSaleLines.find((l) => l.id === id)?.bookingId);
    mutateArea('client', (s) => {
      s.visitSaleLines = s.visitSaleLines.filter((l) => l.id !== id);
    });
  });
}

/** Комиссия банка по карте — процент настроен заранее в способах оплаты (F-14-095); демо-ставка по бренду */
export const CARD_COMMISSION_PERCENT: Record<NonNullable<VisitPaymentLine['cardBrand']>, number> = {
  visa: 2.5,
  mastercard: 2.5,
  arca: 1.5,
};

export interface AddPaymentInput {
  bookingId: Id;
  method: VisitPaymentMethod;
  amount: Money;
  cashDeskId?: Id;
  cardBrand?: VisitPaymentLine['cardBrand'];
}

/** Способ оплаты визита: наличные/карта/лояльность, доступна частями («Split», F-14-094, F-14-097) */
export function addVisitPayment(input: AddPaymentInput): Promise<VisitPaymentLine> {
  if (isApiMode()) return CS.addVisitPaymentServer(input);
  return request(() => {
    assertVisitEdit(input.bookingId);
    if (input.amount <= 0) throw new ApiError('validation');
    const commissionPercent = input.method === 'card' && input.cardBrand ? CARD_COMMISSION_PERCENT[input.cardBrand] : undefined;
    const line: VisitPaymentLine = {
      id: newId('vpay'),
      bookingId: input.bookingId,
      method: input.method,
      amount: input.amount,
      cashDeskId: input.method === 'cash' ? input.cashDeskId : undefined,
      cardBrand: input.method === 'card' ? input.cardBrand : undefined,
      commissionPercent,
      createdAt: nowDateTime(),
    };
    mutateArea('client', (s) => {
      s.visitPayments.push(line);
    });
    return line;
  });
}

/** Корзина рядом с суммой — удаляет проведённую оплату (F-14-097) */
export function removeVisitPayment(id: Id): Promise<void> {
  if (isApiMode()) return CS.removeVisitPaymentServer(id);
  return request(() => {
    assertVisitEdit(readArea('client').visitPayments.find((p) => p.id === id)?.bookingId);
    mutateArea('client', (s) => {
      s.visitPayments = s.visitPayments.filter((p) => p.id !== id);
    });
  });
}

/** «Make a refund» — не стирает оплату, помечает возвращённой, чек остаётся в истории (F-14-095) */
export function refundVisitPayment(id: Id): Promise<void> {
  if (isApiMode()) return CS.refundVisitPaymentServer(id);
  return request(() => {
    assertVisitEdit(readArea('client').visitPayments.find((p) => p.id === id)?.bookingId);
    mutateArea('client', (s) => {
      s.visitPayments = s.visitPayments.map((p) => (p.id === id ? { ...p, refundedAt: nowDateTime() } : p));
    });
  });
}

/** Число программ лояльности, доступных визиту — на кнопке «Loyalty» (F-14-098) */
export function countVisitLoyaltyOptions(appUserId: Id | undefined, businessId: Id): Promise<number> {
  if (isApiMode()) return appUserId ? CLX.biz(businessId, 'countVisitLoyaltyOptions', [appUserId]) : Promise.resolve(0);
  return request(() => {
    if (!appUserId) return 0;
    const area = readArea('client');
    const memberships = area.memberships.filter((m) => m.appUserId === appUserId && m.businessId === businessId).length;
    const certificates = area.certificates.filter((c) => c.appUserId === appUserId && c.businessId === businessId && c.active).length;
    const cashback = area.cashbackCards.some((c) => c.appUserId === appUserId && c.businessId === businessId && c.visible) ? 1 : 0;
    return memberships + certificates + cashback;
  });
}

/** «+» в «Customer loyalty»: выдать карту, номер генерируется, если не введён (F-14-102) */
export function issueLoyaltyCard(appUserId: Id, businessId: Id, cardNumber?: string): Promise<CashbackCard> {
  if (isApiMode()) return CLX.biz(businessId, 'issueLoyaltyCard', [appUserId, cardNumber]);
  return request(() => {
    const card: CashbackCard = {
      id: newId('cbk'),
      appUserId,
      businessId,
      cardNumber: cardNumber?.trim() || String(Math.floor(100000000 + Math.random() * 900000000)),
      balance: 0,
      visible: true,
      spendScope: 'anything',
      earnRules: [{ kind: 'per_visit_spend', rate: 5, isPercent: true }],
    };
    mutateArea('client', (s) => {
      s.cashbackCards.push(card);
    });
    return card;
  });
}

export interface LoyaltyCodeMatch {
  kind: 'certificate' | 'cashback';
  id: Id;
  code: string;
  appUserId: Id;
  clientName: string;
  /** Остаток на сертификате / балансе карты */
  balance: Money;
}

/**
 * Поиск программы лояльности по коду — не привязанной к текущему клиенту визита: сертификат или карта могли быть
 * выданы другому человеку (например, подарок) и предъявляются по номеру (F-14-098).
 */
export function findLoyaltyByCode(businessId: Id, code: string): Promise<LoyaltyCodeMatch | undefined> {
  if (isApiMode()) return CLX.orUndefined(CLX.biz<LoyaltyCodeMatch | null>(businessId, 'findLoyaltyByCode', [code]));
  return request(() => {
    const query = code.trim().toLowerCase();
    if (!query) return undefined;
    const area = readArea('client');
    const core = readCore();
    const clientName = (appUserId: Id) => core.appUsers.find((u) => u.id === appUserId)?.name ?? '—';

    const cert = area.certificates.find(
      (c) => c.businessId === businessId && c.active && c.number.toLowerCase() === query,
    );
    if (cert) {
      return { kind: 'certificate', id: cert.id, code: cert.number, appUserId: cert.appUserId, clientName: clientName(cert.appUserId), balance: cert.balance };
    }
    const card = area.cashbackCards.find((c) => c.businessId === businessId && c.cardNumber.toLowerCase() === query);
    if (card) {
      return { kind: 'cashback', id: card.id, code: card.cardNumber, appUserId: card.appUserId, clientName: clientName(card.appUserId), balance: card.balance };
    }
    return undefined;
  });
}

/** Настройка типа карты «показывать кэшбэк в приложении клиента» (F-14-053) — переключает все карты бизнеса разом,
 *  у нас нет отдельного каталога типов карт (демо: одна виртуальная линейка на бизнес). */
export function setCashbackVisibleForBusiness(businessId: Id, visible: boolean): Promise<void> {
  if (isApiMode()) return CLX.biz<null>(businessId, 'setCashbackVisibleForBusiness', [visible]).then(() => undefined);
  return request(() => {
    assertCan('loyalty.rules');
    mutateArea('client', (s) => {
      s.cashbackCards = s.cashbackCards.map((c) => (c.businessId === businessId ? { ...c, visible } : c));
    });
  });
}

export function getCashbackVisibleForBusiness(businessId: Id): Promise<boolean> {
  if (isApiMode()) return CLX.biz(businessId, 'getCashbackVisibleForBusiness');
  return request(() => {
    const cards = readArea('client').cashbackCards.filter((c) => c.businessId === businessId);
    return cards.length ? cards.every((c) => c.visible) : true;
  });
}

// ─────────────────────────── Разовый пуш клиенту из записи (F-14-074) ───────────────────────────

/**
 * «Отправить сообщение» из записи — свободный текст лично этому клиенту (kind 'direct'). Не рассылка: выключенные
 * «Новости» мастера или салона его не глушат (F-14-074), иначе владелец видит «Отправлено», а клиент — ничего.
 */
export function sendOneOffPush(input: { appUserId: Id; businessId: Id; bookingId?: Id; text: string }): Promise<NotificationItem> {
  if (isApiMode()) return CS.sendOneOffPushServer(input);
  return request(() => {
    const text = input.text.trim();
    if (!text) throw new ApiError('validation');
    const item: NotificationItem = {
      id: newId('ntf'),
      appUserId: input.appUserId,
      businessId: input.businessId,
      bookingId: input.bookingId,
      kind: 'direct',
      params: { text },
      createdAt: nowDateTime(),
    };
    mutateArea('client', (s) => {
      s.notifications.push(item);
      s.oneOffPushSentAt[input.bookingId ?? input.appUserId] = item.createdAt;
    });
    return item;
  });
}

// ─────────────────────────── Групповые события в приложении (F-14-106…109) ───────────────────────────

export interface AppGroupEvent {
  event: GroupEvent;
  service?: Service;
  staff?: Staff;
  participants: Booking[];
  /** Номер доп. места по id записи (1, 2…); у основного места нет (F-14-107) */
  extraSeats: Record<Id, number>;
  seatsLeft: number;
}

export function listAppGroupEvents(businessId: Id): Promise<AppGroupEvent[]> {
  return request(async () => {
    const events = await listGroupEvents({ businessId });
    const scheduled = events.filter((e) => e.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start));
    // Этап 21, лейн client: обогащение раньше читало readCore().services/staff/bookings напрямую — bookings
    // не входят в CoreSnapshot при входе (mirror.ts), поэтому в api-режиме участники события были бы всегда
    // пустыми, если раздел «Журнал» ещё не был открыт в этой сессии. services/staff в CoreSnapshot есть
    // (свой бизнес зеркалится при входе), но берём их тем же серверным вызовом, что и остальные функции этого
    // файла (SV.listServices/ST.listStaff) — без разницы в свежести между полями одной карточки.
    if (isApiMode()) {
      const [services, staffRows] = await Promise.all([SV.listServices(businessId), ST.listStaff(businessId)]);
      const staffList = staffRows.map((r) => r.staff);
      const out: AppGroupEvent[] = [];
      for (const event of scheduled) {
        const service = services.find((s) => s.id === event.serviceId);
        const staff = staffList.find((s) => s.id === event.staffId);
        const participants = (await J.listBookings({ businessId, groupEventId: event.id })).filter(
          (b) => !['cancelled_by_client', 'cancelled_by_master'].includes(b.status),
        );
        const seatsTaken = participants.reduce((sum, b) => sum + (b.services[0]?.staffId ? 1 : 1), 0);
        // Номер доп. места хранит сервер (booking.extraSeat, 01.10.2026) — как eventExtraSeat мока
        const extraSeats: Record<Id, number> = {};
        for (const b of participants) {
          const seat = (b as Booking & { extraSeat?: number }).extraSeat;
          if (seat) extraSeats[b.id] = seat;
        }
        out.push({ event, service, staff, participants, extraSeats, seatsLeft: Math.max(0, event.capacity - seatsTaken) });
      }
      return out;
    }
    const core = readCore();
    return scheduled.map((event) => {
      const service = core.services.find((s) => s.id === event.serviceId);
      const staff = core.staff.find((s) => s.id === event.staffId);
      const participants = core.bookings.filter(
        (b) => b.groupEventId === event.id && !['cancelled_by_client', 'cancelled_by_master'].includes(b.status),
      );
      const seatsTaken = participants.reduce((sum, b) => sum + (b.services[0]?.staffId ? 1 : 1), 0);
      const extraSeats = readArea('client').eventExtraSeat ?? {};
      return { event, service, staff, participants, extraSeats, seatsLeft: Math.max(0, event.capacity - seatsTaken) };
    });
  });
}

export interface CreateAppGroupEventInput {
  businessId: Id;
  locationId: Id;
  serviceId: Id;
  staffId: Id;
  start: ISODateTime;
  durationMin: number;
  capacity: number;
  resourceIds?: Id[];
  onlineUrl?: string;
  repeat?: { weeks: number };
}

/** Создание события с одной услугой, вместимостью и ресурсом; длительность подставляется из услуги (F-14-106, F-14-109) */
export async function createAppGroupEvent(input: CreateAppGroupEventInput): Promise<GroupEvent[]> {
  const base = {
    businessId: input.businessId,
    locationId: input.locationId,
    serviceId: input.serviceId,
    staffId: input.staffId,
    durationMin: input.durationMin,
    capacity: Math.max(1, input.capacity),
    resourceIds: input.resourceIds ?? [],
    onlineUrl: input.onlineUrl,
  };
  const weeks = input.repeat?.weeks ?? 1;
  const seriesId = weeks > 1 ? newId('evs') : undefined;
  const created: GroupEvent[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = toISODateTime(dayjs(input.start).add(i * 7, 'day'));
    const event = await createGroupEvent({ ...base, start, seriesId });
    created.push(event);
  }
  return created;
}

export function updateAppGroupEvent(id: Id, patch: Partial<Pick<GroupEvent, 'capacity' | 'resourceIds' | 'durationMin' | 'onlineUrl'>>): Promise<GroupEvent> {
  return updateGroupEvent(id, patch);
}

export interface SignUpForEventInput {
  eventId: Id;
  clientId?: Id;
  visitorName?: string;
  seats: number;
  price: Money;
}

/** Запись клиента в событие с несколькими местами и посетитель на его имя (F-14-107) */
export async function signUpForAppGroupEvent(input: SignUpForEventInput): Promise<Booking[]> {
  // Этап 21, лейн client: groupEvents не входит в CoreSnapshot при входе (mirror.ts) — раньше эта функция
  // молча зависела от того, что listAppGroupEvents уже был вызван в этой же сессии и успел зеркалить событие
  // (J.listGroupEvents → mirrorGroupEvents). В api-режиме перечитываем событие с сервера явно, чтобы запись
  // работала и когда экран открыт напрямую (F-14-107 — «Записать клиента» может быть вызвана без предварительного
  // списка, например из уведомления/deeplink).
  const event = isApiMode()
    ? (await J.listGroupEvents({})).find((e) => e.id === input.eventId)
    : readCore().groupEvents.find((e) => e.id === input.eventId);
  if (!event) throw new ApiError('not_found');
  const created: Booking[] = [];
  for (let i = 0; i < Math.max(1, input.seats); i++) {
    const booking = await coreCreate('bookings', {
      businessId: event.businessId,
      locationId: event.locationId,
      staffId: event.staffId,
      clientId: input.clientId,
      start: event.start,
      durationMin: event.durationMin,
      status: 'scheduled',
      services: [{ serviceId: event.serviceId, staffId: event.staffId, durationMin: event.durationMin, price: input.price, qty: 1 }],
      total: input.price,
      resourceIds: event.resourceIds,
      workplace: 'salon',
      source: 'app',
      createdBy: 'client',
      forWhom: 'self',
      // Имя — как ввели; номер доп. места — отдельно (eventExtraSeat), подпись переводит экран (без «Гость +1» в данных)
      visitorName: input.visitorName,
      groupEventId: event.id,
      createdAt: nowDateTime(),
      updatedAt: nowDateTime(),
      // в api номер доп. места сохраняет сервер (extras.extraSeat); в моке — срез client ниже
      ...(i > 0 && isApiMode() ? { extraSeat: i } : {}),
    } as Parameters<typeof coreCreate<'bookings'>>[1]);
    created.push(booking);
    if (i > 0 && !isApiMode()) {
      await request(() =>
        mutateArea('client', (s) => {
          s.eventExtraSeat = { ...s.eventExtraSeat, [booking.id]: i };
        }),
      );
    }
  }
  return created;
}

/** У участника события правятся его данные и цена, но не время и услуга (F-14-108) */
export function updateEventParticipant(bookingId: Id, patch: { visitorName?: string; total?: Money }): Promise<Booking> {
  return coreUpdate('bookings', bookingId, patch);
}

export function cancelAppGroupEvent(id: Id): Promise<GroupEvent> {
  return updateGroupEvent(id, { status: 'cancelled' });
}

// ─────────────────────────── Сотрудник в приложении (F-14-116…120, F-14-125) ───────────────────────────

export interface AppStaffRow {
  staff: Staff;
  services: { service: Service; durationMin: number }[];
  bookingsCount: number;
  revenue: Money;
  access: EmployeeAppAccess;
}

const DEFAULT_ACCESS: EmployeeAppAccess = {
  onlyOwnBookings: false,
  hideClientContacts: false,
  analyticsAllowed: true,
  pushEnabledByOwner: false,
  pushTypesAllowed: [],
  pushTypesOn: [],
  hideClientDataInPush: false,
  payrollAccess: 'self',
  payrollCurrentDayOnly: false,
  twoStepLoginEnabled: false,
};

export function listAppStaff(businessId: Id, includeFired = true): Promise<AppStaffRow[]> {
  if (isApiMode()) return CS.listAppStaffServer(businessId, includeFired);
  return request(() => {
    const core = readCore();
    const access = readArea('client').employeeAppAccess;
    // Без staff.view (мастер) — только своя строка: свой доступ к ЗП и свои пуши, без выручки коллег
    const actorStaffId = canNow('staff.view') ? undefined : (currentActor().staffId ?? '-');
    return core.staff
      .filter((s) => s.businessId === businessId && (includeFired || s.status !== 'fired'))
      .filter((s) => !actorStaffId || s.id === actorStaffId)
      .map((staff) => {
        const services = staff.serviceIds
          .map((id) => core.services.find((sv) => sv.id === id))
          .filter((sv): sv is Service => Boolean(sv))
          .map((service) => ({ service, durationMin: service.durationMin }));
        const bookings = core.bookings.filter((b) => b.businessId === businessId && b.staffId === staff.id && !b.deletedAt);
        const revenue = bookings.filter((b) => b.status === 'arrived').reduce((sum, b) => sum + b.total, 0);
        return { staff, services, bookingsCount: bookings.length, revenue, access: access[staff.id] ?? DEFAULT_ACCESS };
      });
  });
}

export interface CreateAppStaffInput {
  businessId: Id;
  locationId: Id;
  name: string;
  phone: string;
  role: StaffRole;
}

/**
 * Права «Команды» в приложении — как в разделе «Сотрудники»: список — staff.view (без него — только своя строка),
 * действия — staff.manage. Владельца из приложения не увольняют, не удаляют и не меняют ему доступ (F-14-118):
 * передача и снятие владельца — только в вебе (раздел staff, правило «последнего владельца»).
 */
function assertStaffManage(staffId?: Id): void {
  assertCan('staff.manage');
  if (!staffId) return;
  const staff = readCore().staff.find((s) => s.id === staffId);
  if (!staff) throw new ApiError('not_found');
  if (staff.role === 'owner') throw new ApiError('forbidden', 'Владельца нельзя менять из приложения');
}

/** Сотрудник создаётся с телефона, ему выдаётся роль и доступ (F-14-116) */
export function createAppStaff(input: CreateAppStaffInput): Promise<Staff> {
  if (isApiMode()) {
    return ST.addStaff({
      businessId: input.businessId,
      locationIds: [input.locationId],
      name: input.name,
      phone: input.phone,
      role: input.role,
      sphereIds: [],
    });
  }
  const phone = normalizePhone(input.phone);
  return request(() => {
    assertStaffManage();
    if (input.role === 'owner') throw new ApiError('forbidden', 'Владельца из приложения не добавляют');
    if (!input.name.trim() || !phone) throw new ApiError('validation');
    return createAppStaffRecord({ ...input, phone });
  });
}

function createAppStaffRecord(input: CreateAppStaffInput): Promise<Staff> {
  return coreCreate('staff', {
    businessId: input.businessId,
    locationIds: [input.locationId],
    name: input.name,
    phone: input.phone,
    role: input.role,
    sphereIds: [],
    photos: [],
    materials: [],
    workplaces: ['salon'],
    accepts: 'all',
    calendarVisibility: 'all',
    calendarMode: 'free',
    // В-03: у нового мастера по умолчанию «с подтверждением» — переключает сам
    confirmMode: 'manual',
    colorIndex: 1,
    serviceIds: [],
    status: 'active',
    hiredAt: toISODate(dayjs()),
  });
}

export function setStaffServiceDurations(staffId: Id, serviceIds: Id[]): Promise<Staff> {
  if (isApiMode()) return ST.patchStaff(staffId, { serviceIds });
  return request(() => {
    assertCan('staff.manage');
    return coreUpdate('staff', staffId, { serviceIds });
  });
}

/**
 * «Fire» — уволить: статус меняется, статистика сохраняется, пропадает из активного журнала (F-14-118).
 * В api-режиме зовёт настоящий `POST .../fire` (staff.server::dismiss) — сервер сам считает окно
 * восстановления 24ч/30 дней (F-10-044) от своей метки `firedAt`, поэтому локальную `staffFiredAt` (демо-метку,
 * которую читает `canRestoreStaff` ниже — он остаётся на моке, см. docs/PROGRESS.md «Осталось») в api-режиме не
 * пишем: два источника окна расходились бы. `canRestoreStaff` в api-режиме окажется разрешающим (нет своей
 * метки), а настоящую границу всё равно проверит сервер при вызове `restoreStaff` — не тихая дыра, а известное
 * упрощение экрана до отдельного решения.
 */
export function setStaffStatus(staffId: Id, status: StaffStatus): Promise<Staff> {
  if (isApiMode()) {
    if (status === 'fired') return ST.dismiss(staffId, { date: toISODate(dayjs()), reason: '' });
    return ST.patchStaff(staffId, { status });
  }
  return request(async () => {
    assertStaffManage(staffId);
    const updated = await coreUpdate('staff', staffId, { status });
    if (status === 'fired') {
      mutateArea('client', (s) => {
        s.staffFiredAt[staffId] = nowDateTime();
      });
    } else {
      mutateArea('client', (s) => {
        delete s.staffFiredAt[staffId];
      });
    }
    return updated;
  });
}

/** Восстановление по правилам 24 часа/30 дней — здесь окно фиксировано демо-константой (F-14-118) */
export const STAFF_RESTORE_WINDOW_DAYS = 30;

/** Уволенного можно восстановить только в пределах окна — считаем по своей метке времени увольнения (F-14-118) */
export function canRestoreStaff(staff: Staff): boolean {
  if (staff.status !== 'fired') return false;
  // Стадия 21 (лейн client+online): в api-режиме отметка увольнения приходит прямо на Staff (staff.firedAt,
  // сервер уже пишет её при увольнении, раздел staff F-10-044) — второй запрос не нужен, staff уже на руках
  // у вызывающего экрана (listAppStaff).
  const firedAt = isApiMode() ? staff.firedAt : readArea('client').staffFiredAt[staff.id];
  if (!firedAt) return true; // уволен до появления метки (демо-сид) — разрешаем
  return dayjs().diff(dayjs(firedAt), 'day') <= STAFF_RESTORE_WINDOW_DAYS;
}

export function restoreStaff(staffId: Id): Promise<Staff> {
  if (isApiMode()) return ST.restore(staffId);
  return request(async () => {
    assertStaffManage(staffId);
    const updated = await coreUpdate('staff', staffId, { status: 'active' });
    mutateArea('client', (s) => {
      delete s.staffFiredAt[staffId];
    });
    return updated;
  });
}

/**
 * Удалить — только для приглашённых, не начавших работать (демо-правило) (F-14-118). В api-режиме это
 * `staff.server::remove` — то же мягкое удаление (C4: клиенты и записи остаются бизнесу), что использует
 * основной раздел «Сотрудники» (staff.ts), не второе, отдельное правило только для этого экрана.
 */
export function deleteAppStaff(staffId: Id): Promise<void> {
  if (isApiMode()) return ST.remove(staffId);
  return request(() => {
    assertStaffManage(staffId);
    return coreRemove('staff', staffId);
  });
}

export function setEmployeeAppAccess(staffId: Id, patch: Partial<EmployeeAppAccess>): Promise<EmployeeAppAccess> {
  if (isApiMode()) return CS.setEmployeeAppAccessServer(staffId, patch);
  return request(() => {
    // Сам сотрудник включает и выключает свои пуши в пределах разрешённого (F-14-132); остальное — staff.manage
    const selfPushOnly = currentActor().staffId === staffId && Object.keys(patch).every((k) => k === 'pushTypesOn');
    if (!selfPushOnly) assertStaffManage(staffId);
    let next: EmployeeAppAccess = DEFAULT_ACCESS;
    mutateArea('client', (s) => {
      const current = s.employeeAppAccess[staffId] ?? DEFAULT_ACCESS;
      next = { ...current, ...patch };
      s.employeeAppAccess[staffId] = next;
    });
    return next;
  });
}

// ─────────────────────────── Отчёты в приложении (F-14-122…124, F-14-126, F-14-129) ───────────────────────────

export interface VisitReportRow {
  booking: Booking;
  clientName: string;
  staffName: string;
  total: Money;
  paidTotal: Money;
}

/** Z-отчёт (закрытие смены): сводка денег за день с разбивкой по визитам и фильтром по мастеру (F-14-122) */
export function getDayZReport(businessId: Id, date: ISODate, staffId?: Id): Promise<{ rows: VisitReportRow[]; total: Money; byMethod: Record<VisitPaymentMethod, Money> }> {
  if (isApiMode()) return CS.getDayZReportServer(businessId, date, staffId);
  return request(() => {
    // Z-отчёт — деньги салона за смену: как «Финансы» в вебе
    assertCan('finance.view');
    const core = readCore();
    const area = readArea('client');
    const bookings = core.bookings.filter(
      (b) => b.businessId === businessId && toISODate(dayjs(b.start)) === date && b.status === 'arrived' && (!staffId || b.staffId === staffId),
    );
    const rows: VisitReportRow[] = bookings.map((booking) => {
      const client = core.clients.find((c) => c.id === booking.clientId);
      const staff = core.staff.find((s) => s.id === booking.staffId);
      const recorded = area.visitPayments.filter((p) => p.bookingId === booking.id && !p.refundedAt);
      // Визит из сида (ещё не проведён через оплату в приложении) — своих строк оплаты у него нет; чтобы
      // разбивка по кассам и по визитам сходилась с «Итого», считаем его полностью оплаченным наличными (F-14-122)
      const paidTotal = recorded.length ? recorded.reduce((s, p) => s + p.amount, 0) : booking.total;
      return { booking, clientName: client?.name ?? booking.visitorName ?? '', staffName: staff?.name ?? '—', total: booking.total, paidTotal };
    });
    const byMethod: Record<VisitPaymentMethod, Money> = { cash: 0, card: 0, loyalty: 0 };
    for (const b of bookings) {
      const recorded = area.visitPayments.filter((p) => p.bookingId === b.id && !p.refundedAt);
      if (recorded.length) {
        for (const p of recorded) byMethod[p.method] += p.amount;
      } else {
        byMethod.cash += b.total;
      }
    }
    return { rows, total: rows.reduce((s, r) => s + r.total, 0), byMethod };
  });
}

export interface DailyReportMetrics {
  revenue: Money;
  bookingsCount: Money;
  newClients: Money;
  cancelledCount: Money;
  noShowCount: Money;
  avgCheck: Money;
}

function dayMetrics(businessId: Id, date: ISODate): DailyReportMetrics {
  const core = readCore();
  const bookings = core.bookings.filter((b) => b.businessId === businessId && toISODate(dayjs(b.start)) === date);
  const arrived = bookings.filter((b) => b.status === 'arrived');
  const revenue = arrived.reduce((s, b) => s + b.total, 0);
  const newClients = core.clients.filter((c) => c.businessId === businessId && toISODate(dayjs(c.createdAt)) === date).length;
  return {
    revenue,
    bookingsCount: bookings.length,
    newClients,
    cancelledCount: bookings.filter((b) => b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master').length,
    noShowCount: bookings.filter((b) => b.status === 'no_show').length,
    avgCheck: arrived.length ? Math.round(revenue / arrived.length) : 0,
  };
}

/** Дневной отчёт: 6 показателей и изменение к вчера (F-14-123) */
export function getDailyReport(businessId: Id, date: ISODate): Promise<{ today: DailyReportMetrics; yesterday: DailyReportMetrics }> {
  if (isApiMode()) return CS.getDailyReportServer(businessId, date);
  return request(() => {
    assertCan('reports.view');
    return {
      today: dayMetrics(businessId, date),
      yesterday: dayMetrics(businessId, toISODate(dayjs(date).subtract(1, 'day'))),
    };
  });
}

/** Отчёт за период, по умолчанию — прошлая неделя (F-14-124) */
export function getPeriodReport(businessId: Id, from: ISODate, to: ISODate): Promise<DailyReportMetrics & { days: number }> {
  if (isApiMode()) return CS.getPeriodReportServer(businessId, from, to);
  return request(() => {
    assertCan('reports.view');
    const core = readCore();
    const bookings = core.bookings.filter((b) => b.businessId === businessId && toISODate(dayjs(b.start)) >= from && toISODate(dayjs(b.start)) <= to);
    const arrived = bookings.filter((b) => b.status === 'arrived');
    const revenue = arrived.reduce((s, b) => s + b.total, 0);
    return {
      revenue,
      bookingsCount: bookings.length,
      newClients: core.clients.filter((c) => c.businessId === businessId && toISODate(dayjs(c.createdAt)) >= from && toISODate(dayjs(c.createdAt)) <= to).length,
      cancelledCount: bookings.filter((b) => b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master').length,
      noShowCount: bookings.filter((b) => b.status === 'no_show').length,
      avgCheck: arrived.length ? Math.round(revenue / arrived.length) : 0,
      days: dayjs(to).diff(dayjs(from), 'day') + 1,
    };
  });
}

/** «Моя аналитика» администратора: только свои показатели за период (F-14-126) */
export function getMyAnalytics(businessId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<{ revenue: Money; bookingsCount: number }> {
  if (isApiMode()) return CS.getMyAnalyticsServer(businessId, staffId, from, to);
  return request(() => {
    // Свои показатели — любому сотруднику; чужие (карточка в «Команде») — с правом на отчёты
    if (currentActor().staffId !== staffId) assertCan('reports.view');
    const core = readCore();
    const bookings = core.bookings.filter(
      (b) => b.businessId === businessId && b.staffId === staffId && toISODate(dayjs(b.start)) >= from && toISODate(dayjs(b.start)) <= to,
    );
    const revenue = bookings.filter((b) => b.status === 'arrived').reduce((s, b) => s + b.total, 0);
    return { revenue, bookingsCount: bookings.length };
  });
}

/** Показатели дня по каждому филиалу сети — переключение филиалов владельцем (F-14-129) */
export function getNetworkDayStats(locationIds: Id[], date: ISODate): Promise<Array<{ businessId: Id; name: string; metrics: DailyReportMetrics }>> {
  if (isApiMode()) return CS.getNetworkDayStatsServer(locationIds, date);
  return request(() => {
    assertCan('reports.view');
    const core = readCore();
    return locationIds.map((id) => {
      const business = core.businesses.find((b) => b.id === id);
      return { businessId: id, name: business?.name ?? id, metrics: dayMetrics(id, date) };
    });
  });
}

/** Услуги бизнеса — для форм в приложении (создание события, назначение сотруднику) */
export function listAppServices(businessId: Id): Promise<Service[]> {
  if (isApiMode()) return SV.listServices(businessId);
  return request(() => readCore().services.filter((s) => s.businessId === businessId));
}

/** `Service` → вход сервера (F-14-114): «Тех.перерыв» из мока — просто `bufferAfterMin`, у приложения нет своего режима */
function serviceToServerInput(s: Service): SV.ServerServiceInput {
  return {
    categoryId: s.categoryId,
    name: s.name,
    description: s.description,
    kind: s.kind,
    capacity: s.capacity,
    durationMin: s.durationMin,
    durationMax: s.durationMax,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    techBreak: s.bufferAfterMin ? 'custom' : 'none',
    techBreakMin: s.bufferAfterMin,
    repeatIntervalDays: s.repeatIntervalDays,
    photos: s.photos,
    onlineBookable: s.onlineBookable,
    shadeChoice: s.shadeChoice,
  };
}

// ─────────────────────────── Зарплата в приложении (F-14-127, F-14-128) ───────────────────────────

export interface AppPayrollCalculation {
  /** По сегодняшний день включительно */
  daysWorked: number;
  hoursWorked: number;
  /** График после сегодня в периоде — только подпись (нет у сервера старой сборки) */
  scheduledAheadDays?: number;
  scheduledAheadHours?: number;
  servicesCount: number;
  servicesValue: Money;
  productsCount: number;
  productsValue: Money;
  total: Money;
}

/**
 * Расчёт ЗП — как в вебе: свой видит любой сотрудник («Моя зарплата», /biz/payroll/me — без отдельного права),
 * чужой — только с payroll.manage.
 */
function assertPayrollAccess(staffId: Id): void {
  if (currentActor().staffId !== staffId) assertCan('payroll.manage');
}

/** «Calculation»: отработано, оказанные услуги и проданные товары за период (F-14-127) */
export function getAppPayrollCalculation(businessId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<AppPayrollCalculation> {
  if (isApiMode()) return CS.getAppPayrollCalculationServer(businessId, staffId, from, to);
  return request(() => {
    assertPayrollAccess(staffId);
    const core = readCore();
    const area = readArea('client');
    const bookings = core.bookings.filter(
      (b) =>
        b.businessId === businessId &&
        b.staffId === staffId &&
        b.status === 'arrived' &&
        toISODate(dayjs(b.start)) >= from &&
        toISODate(dayjs(b.start)) <= to,
    );
    // «Отработано» — одно правило с «Расчётом» и «Моей зарплатой»: дни и часы графика за период (final-fix 01.10;
    // было — длительность визитов «пришёл», 3 ч против 8 ч графика)
    // Только по сегодня включительно; график после сегодня — отдельной подписью (решение владельца 01.10)
    let daysWorked = 0;
    let hoursWorked = 0;
    let scheduledAheadDays = 0;
    let scheduledAheadHours = 0;
    const todayDate = today();
    for (const date of eachDay(from, to)) {
      const minutes = staffDayHours(core, staffId, date).reduce((sum, r) => sum + Math.max(0, toMinutes(r.to) - toMinutes(r.from)), 0);
      const hours = roundMoney(minutes / 60);
      if (date > todayDate) {
        if (hours > 0) scheduledAheadDays += 1;
        scheduledAheadHours = roundMoney(scheduledAheadHours + hours);
        continue;
      }
      if (hours > 0) daysWorked += 1;
      hoursWorked = roundMoney(hoursWorked + hours);
    }
    const servicesValue = bookings.reduce((s, b) => s + b.total, 0);
    const bookingIds = new Set(bookings.map((b) => b.id));
    const productLines = area.visitSaleLines.filter((l) => l.kind === 'product' && bookingIds.has(l.bookingId));
    const productsValue = productLines.reduce((s, l) => s + Math.max(0, l.price - l.discount), 0);
    return {
      daysWorked,
      hoursWorked,
      scheduledAheadDays,
      scheduledAheadHours,
      servicesCount: bookings.length,
      servicesValue,
      productsCount: productLines.length,
      productsValue,
      total: servicesValue + productsValue,
    };
  });
}

export interface AppPayrollPayouts {
  earned: Money;
  paid: Money;
  remaining: Money;
}

/** «Payouts»: заработано / выплачено / осталось — своя демо-копилка выплат (F-14-127) */
export function getAppPayrollPayouts(businessId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<AppPayrollPayouts> {
  if (isApiMode()) return CS.getAppPayrollPayoutsServer(businessId, staffId, from, to);
  return request(async () => {
    const { total } = await getAppPayrollCalculation(businessId, staffId, from, to);
    const paid = Math.min(readArea('client').payrollPaid[staffId] ?? 0, total);
    return { earned: total, paid, remaining: Math.max(0, total - paid) };
  });
}

/** Владелец/менеджер отмечает выплату сотруднику (демо-накопитель, реальных денег нет) (F-14-127) */
export function recordPayrollPayout(staffId: Id, amount: Money): Promise<number> {
  if (isApiMode()) return CS.recordPayrollPayoutServer(staffId, amount);
  return request(() => {
    assertCan('payroll.manage');
    if (amount <= 0) throw new ApiError('validation');
    let next = 0;
    mutateArea('client', (s) => {
      next = (s.payrollPaid[staffId] ?? 0) + amount;
      s.payrollPaid[staffId] = next;
    });
    return next;
  });
}

// ─────────────────────────── Услуги и категории в приложении (F-14-114, F-14-115) ───────────────────────────

export function listAppServiceCategories(businessId: Id): Promise<ServiceCategory[]> {
  if (isApiMode()) return SV.listCategories(businessId).then((rows) => [...rows].sort((a, b) => a.order - b.order));
  return request(() => readCore().serviceCategories.filter((c) => c.businessId === businessId).sort((a, b) => a.order - b.order));
}

export function createAppServiceCategory(businessId: Id, name: string): Promise<ServiceCategory> {
  if (isApiMode()) {
    if (!name.trim()) return Promise.reject(new ApiError('validation'));
    return SV.createCategory(businessId, { name: { ru: name.trim() }, onlineNameEnabled: false });
  }
  return request(() => {
    assertCan('services.edit');
    if (!name.trim()) throw new ApiError('validation');
    const order = readCore().serviceCategories.filter((c) => c.businessId === businessId).length;
    return coreCreate('serviceCategories', { businessId, name: { ru: name.trim() }, order });
  });
}

export function renameAppServiceCategory(id: Id, name: string): Promise<ServiceCategory> {
  if (isApiMode()) {
    if (!name.trim()) return Promise.reject(new ApiError('validation'));
    return (async () => {
      const [current, onlineName] = await Promise.all([SV.getCategory(id), SV.categoryOnlineName(id)]);
      return SV.updateCategory(id, current.businessId, {
        name: { ...current.name, ru: name.trim() },
        onlineNameEnabled: onlineName.onlineNameEnabled,
        onlineName: onlineName.onlineName,
      });
    })();
  }
  return request(() => {
    assertCan('services.edit');
    if (!name.trim()) throw new ApiError('validation');
    return coreUpdate('serviceCategories', id, { name: { ru: name.trim() } });
  });
}

export function deleteAppServiceCategory(id: Id): Promise<void> {
  if (isApiMode()) {
    return SV.getCategory(id).then((c) => SV.deleteCategory(id, c.businessId));
  }
  return request(() => {
    assertCan('services.edit');
    return coreRemove('serviceCategories', id);
  });
}

export interface CreateAppServiceInput {
  businessId: Id;
  categoryId: Id;
  sphereId: SphereId;
  name: string;
  description?: string;
  priceMin: Money;
  priceMax?: Money;
  durationMin: Minutes;
  onlineBookable: boolean;
}

/** Создание услуги из приложения — «от–до» цена и длительность, описание для онлайн-записи (F-14-114) */
export function createAppService(input: CreateAppServiceInput): Promise<Service> {
  if (isApiMode()) {
    if (!input.name.trim() || input.priceMin <= 0 || input.durationMin <= 0) return Promise.reject(new ApiError('validation'));
    return SV.createService(input.businessId, input.sphereId, {
      categoryId: input.categoryId,
      name: { ru: input.name.trim() },
      description: input.description?.trim() ? { ru: input.description.trim() } : undefined,
      kind: 'individual',
      durationMin: input.durationMin,
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      techBreak: 'none',
      photos: [],
      onlineBookable: input.onlineBookable,
    });
  }
  return request(() => {
    assertCan('services.edit');
    if (!input.name.trim() || input.priceMin <= 0 || input.durationMin <= 0) throw new ApiError('validation');
    const order = readCore().services.filter((s) => s.businessId === input.businessId).length;
    return coreCreate('services', {
      businessId: input.businessId,
      categoryId: input.categoryId,
      sphereId: input.sphereId,
      name: { ru: input.name.trim() },
      description: input.description?.trim() ? { ru: input.description.trim() } : undefined,
      kind: 'individual',
      durationMin: input.durationMin,
      durationMax: undefined,
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      photos: [],
      materials: [],
      staffIds: [],
      workplaces: ['salon'],
      onlineBookable: input.onlineBookable,
      active: true,
      order,
    });
  });
}

export function updateAppService(id: Id, patch: Partial<CreateAppServiceInput> & { active?: boolean }): Promise<Service> {
  if (isApiMode()) {
    return (async () => {
      const current = await SV.getService(id);
      const merged: Service = {
        ...current,
        ...(patch.name !== undefined ? { name: { ru: patch.name } } : {}),
        ...(patch.description !== undefined ? { description: patch.description ? { ru: patch.description } : undefined } : {}),
        ...(patch.priceMin !== undefined ? { priceMin: patch.priceMin } : {}),
        ...(patch.priceMax !== undefined ? { priceMax: patch.priceMax } : {}),
        ...(patch.durationMin !== undefined ? { durationMin: patch.durationMin } : {}),
        ...(patch.onlineBookable !== undefined ? { onlineBookable: patch.onlineBookable } : {}),
        ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      };
      const updated = await SV.updateService(id, current.businessId, serviceToServerInput(merged));
      if (patch.active !== undefined && patch.active !== current.active) {
        return SV.setServiceActive(id, current.businessId, patch.active);
      }
      return updated;
    })();
  }
  return request(() => {
    assertCan('services.edit');
    const { name, description, priceMin, priceMax, durationMin, onlineBookable, categoryId, active } = patch;
    return coreUpdate('services', id, {
      ...(name !== undefined ? { name: { ru: name } } : {}),
      ...(description !== undefined ? { description: description ? { ru: description } : undefined } : {}),
      ...(priceMin !== undefined ? { priceMin } : {}),
      ...(priceMax !== undefined ? { priceMax } : {}),
      ...(durationMin !== undefined ? { durationMin } : {}),
      ...(onlineBookable !== undefined ? { onlineBookable } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(active !== undefined ? { active } : {}),
    });
  });
}

export function deleteAppService(id: Id): Promise<void> {
  if (isApiMode()) return SV.getService(id).then((s) => SV.deleteService(id, s.businessId)).then(() => undefined);
  return request(() => {
    assertCan('services.edit');
    return coreRemove('services', id);
  });
}

export interface CreateAppServicePackageInput {
  businessId: Id;
  categoryId: Id;
  sphereId: SphereId;
  name: string;
  itemServiceIds: Id[];
  mode: 'parallel' | 'sequentialSame' | 'sequentialAny';
}

/**
 * Пакет из 2–10 услуг (F-14-115) — цена и длительность на сервере считает `servicePackage`/`packageExtra`
 * (`sumServices` по умолчанию), в моке — сумма входящих услуг здесь же. В api-режиме сервер уже строил маршрут
 * `POST/PATCH .../packages` этапом 4 (лейн services+rest); не хватало только этой ветки во фронте: создаём
 * пустой пакет, затем тем же PATCH кладём состав и режим (тот же приём в два запроса, что уже описан для
 * категорий).
 */
export function createAppServicePackage(input: CreateAppServicePackageInput): Promise<Service> {
  if (isApiMode()) {
    if (!input.name.trim() || input.itemServiceIds.length < 2 || input.itemServiceIds.length > 10) return Promise.reject(new ApiError('validation'));
    return (async () => {
      const created = await SV.createPackage(input.businessId, {
        categoryId: input.categoryId,
        sphereId: input.sphereId,
        name: { ru: input.name.trim() },
      });
      return SV.savePackage(created.id, input.businessId, {
        items: input.itemServiceIds.map((serviceId, order) => ({ serviceId, order })),
        mode: input.mode,
      });
    })();
  }
  return request(() => {
    assertCan('services.edit');
    if (!input.name.trim() || input.itemServiceIds.length < 2 || input.itemServiceIds.length > 10) throw new ApiError('validation');
    const core = readCore();
    const items = input.itemServiceIds
      .map((id) => core.services.find((s) => s.id === id))
      .filter((s): s is Service => Boolean(s));
    const priceMin = items.reduce((s, sv) => s + sv.priceMin, 0);
    const durationMin = items.reduce((s, sv) => s + sv.durationMin, 0);
    const order = core.services.filter((s) => s.businessId === input.businessId).length;
    return coreCreate('services', {
      businessId: input.businessId,
      categoryId: input.categoryId,
      sphereId: input.sphereId,
      name: { ru: input.name.trim() },
      kind: 'individual',
      durationMin,
      priceMin,
      photos: [],
      materials: [],
      staffIds: [],
      workplaces: ['salon'],
      onlineBookable: true,
      active: true,
      order,
      servicePackage: { items: input.itemServiceIds.map((serviceId, order) => ({ serviceId, order })), mode: input.mode },
    });
  });
}

// ─────────────────────────── Удаление аккаунта клиентом (В-34, F-14-062) ───────────────────────────

/**
 * Клиент удаляет свой аккаунт в профиле (В-34, магазины приложений этого требуют). Стираем профиль, избранное,
 * дневник, лист ожидания, ленту уведомлений; звёздочки и отзывы обезличиваем (число у мастера остаётся).
 * Карточки в CRM мастеров и их записи остаются у мастеров, но без связи с аккаунтом.
 * Режим api — запрос на удаление аккаунта на сервере (там срок отмены и стирание).
 */
export async function deleteMyClientAccount(appUserId: Id): Promise<void> {
  if (isApiMode()) {
    await requestMyAccountDeletion();
    return;
  }
  return request(() => {
    if (!readCore().appUsers.some((u) => u.id === appUserId)) throw new ApiError('not_found');
    waitlistTx.removeAllOf(appUserId);
    mutateArea('client', (s) => {
      s.favorites = s.favorites.filter((f) => f.appUserId !== appUserId);
      s.diaryEntries = s.diaryEntries.filter((d) => d.appUserId !== appUserId);
      s.notifications = s.notifications.filter((n) => n.appUserId !== appUserId);
      for (const r of s.starRatings) if (r.appUserId === appUserId) r.appUserId = '';
      for (const r of s.staffReviews) if (r.appUserId === appUserId) r.appUserId = '';
      for (const r of s.locationReviews) if (r.appUserId === appUserId) r.appUserId = '';
      delete s.consents[appUserId];
      delete s.timeFormat[appUserId];
      delete s.eventsSeenAt[appUserId];
    });
    const core = readCore();
    for (const c of core.clients) if (c.appUserId === appUserId) coreTx.update('clients', c.id, { appUserId: undefined });
    for (const b of core.bookings) if (b.appUserId === appUserId) coreTx.update('bookings', b.id, { appUserId: undefined });
    coreTx.remove('appUsers', appUserId);
  });
}

// ─────────────────────────── ⭐ Напоминания в Telegram (30.09.2026) ───────────────────────────

/** Ссылка на бота для номера пользователя приложения и подключён ли он (в демо — отметка в срезе) */
export function getMyTelegramLink(appUserId: Id | undefined): Promise<TelegramLinkInfo> {
  if (isApiMode()) return CS.myTelegramLinkServer();
  return request(() => {
    const phone = readCore().appUsers.find((u) => u.id === appUserId)?.phone;
    return { url: 'https://t.me/booktime_bot?start=demo', botUsername: 'booktime_bot', linked: Boolean(phone && readArea('client').telegramLinked[phone]) };
  });
}

/** Демо: «нажал Старт в боте» — номер пользователя отмечается подключённым */
export function connectMyTelegramDemo(appUserId: Id | undefined): Promise<TelegramLinkInfo> {
  return request(() => {
    const phone = readCore().appUsers.find((u) => u.id === appUserId)?.phone;
    if (phone) mutateArea('client', (s) => void (s.telegramLinked[phone] = nowDateTime()));
    return { url: 'https://t.me/booktime_bot?start=demo', botUsername: 'booktime_bot', linked: Boolean(phone) };
  });
}

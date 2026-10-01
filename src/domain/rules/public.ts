/**
 * ПУБЛИЧНЫЕ DTO — что уходит в приложение клиента и на публичную страницу /b/<slug> (F-00-077/104/105/130,
 * docs/backend/03-access-privacy.md, arch-a1 №5). Клиентским и публичным маршрутам сущности ядра целиком НЕ отдаём.
 *
 * Никогда не уходит клиенту: логин сотрудника, роль/статус/дата найма, настройки календаря и журнала, реквизиты
 * предоплаты до записи, запас после услуги, CRM (карточка Client: заметки, теги, неявки, суммы — F-00-130).
 * Телефон мастера — только как канал «Позвонить», если мастер его открыл (Staff.contacts, F-00-104/105;
 * «скрытие номера» снято — показанный номер остаётся у клиента). Домашний адрес — только после подтверждённой
 * записи этого клиента к мастеру (F-00-077), до этого — район.
 */
import type {
  Business,
  CoreData,
  DistrictId,
  ISODateTime,
  Id,
  Location,
  LocalizedText,
  Minutes,
  Money,
  Service,
  SocialLinks,
  SphereId,
  Staff,
  StaffContactChannels,
  TimeRange,
  Workplace,
  AcceptsWhom,
  ConfirmMode,
  CalendarVisibility,
  BookingRules,
  Client,
} from '@/domain/core';
import { toMinutes } from '@/lib/date';
import { maskPhone } from '@/lib/phone';
import { CONFIRMED_STATUSES } from '@/domain/rules/booking-status';

export interface PublicStaff {
  id: Id;
  businessId: Id;
  locationIds: Id[];
  name: string;
  position?: LocalizedText;
  sphereIds: SphereId[];
  avatarUrl?: string;
  bio?: LocalizedText;
  photos: string[];
  materials: string[];
  workplaces: Workplace[];
  homeDistrict?: DistrictId;
  /** Только после подтверждённой записи этого клиента (F-00-077) */
  homeAddress?: string;
  visitDistricts?: DistrictId[];
  accepts: AcceptsWhom;
  confirmMode: ConfirmMode;
  /** Нужен клиенту, чтобы понять «запись» или «заявка» */
  calendarVisibility: CalendarVisibility;
  colorIndex: number;
  serviceIds: Id[];
  callHours?: TimeRange;
  /** Каналы связи, которые мастер открыл; phone — только если открыт звонок или WhatsApp */
  contacts?: StaffContactChannels & { phone?: string };
  /** Предоплата без реквизитов — реквизиты клиент видит в своей записи */
  /** onlyAfterNoShows — ⭐ предоплата не со всех, а только с тех, кто не приходил (порог виден клиенту) */
  prepayment?: { amount: Money; percent?: number; timeoutMin: Minutes; onlyAfterNoShows?: { count: number; months: number } };
  bookingRules?: BookingRules;
}

export interface PublicBusiness {
  id: Id;
  kind: Business['kind'];
  name: string;
  slug: string;
  sphereIds: SphereId[];
  networkId?: Id;
  locationIds: Id[];
  description?: LocalizedText;
  logoUrl?: string;
  photos: string[];
  socials?: SocialLinks;
  /** Телефон салона; у индивидуала номер — это номер мастера, он уходит только через PublicStaff.contacts */
  phone?: string;
  bookingRules?: BookingRules;
}

export interface PublicService {
  id: Id;
  businessId: Id;
  categoryId: Id;
  sphereId: SphereId;
  name: LocalizedText;
  description?: LocalizedText;
  kind: Service['kind'];
  durationMin: Minutes;
  durationMax?: Minutes;
  priceMin: Money;
  priceMax?: Money;
  repeatIntervalDays?: number;
  capacity?: number;
  photos: string[];
  materials: string[];
  staffIds: Id[];
  workplaces: Workplace[];
  order: number;
  shadeChoice?: Service['shadeChoice'];
}

export interface PublicLocation {
  id: Id;
  businessId: Id;
  name: LocalizedText;
  address: LocalizedText;
  district: DistrictId;
  yandexMapsUrl?: string;
  coords?: Location['coords'];
  phone?: string;
  openHours?: Location['openHours'];
}

export interface PublicOptions {
  hiddenIds?: ReadonlySet<Id>;
}

const visiblePhotos = (photos: readonly string[], hidden?: ReadonlySet<Id>) =>
  photos.filter((p) => !hidden?.has(p));

/** Можно ли клиенту видеть домашний адрес мастера: есть подтверждённая запись этого клиента к мастеру (F-00-077) */
export function canSeeHomeAddress(
  core: Pick<CoreData, 'bookings'>,
  staffId: Id,
  who: { clientId?: Id; appUserId?: Id },
): boolean {
  if (!who.clientId && !who.appUserId) return false;
  return core.bookings.some(
    (b) =>
      !b.deletedAt &&
      CONFIRMED_STATUSES.includes(b.status) &&
      b.workplace === 'home' &&
      (b.staffId === staffId ||
        b.services.some((l) => l.staffId === staffId)) &&
      ((who.clientId && b.clientId === who.clientId) ||
        (who.appUserId && b.appUserId === who.appUserId)),
  );
}

/** Мастер для клиента: без логина, служебных полей и, по умолчанию, без телефона и домашнего адреса */
export function toPublicStaff(
  staff: Staff,
  opts: PublicOptions & { revealHomeAddress?: boolean } = {},
): PublicStaff {
  const c = staff.contacts;
  const phoneOpen = Boolean(
    c && (c.whatsapp || (c.callMode && c.callMode !== 'messages')),
  );
  return {
    id: staff.id,
    businessId: staff.businessId,
    locationIds: [...staff.locationIds],
    name: staff.name,
    position: staff.position,
    sphereIds: [...staff.sphereIds],
    avatarUrl:
      staff.avatarUrl && !opts.hiddenIds?.has(staff.avatarUrl)
        ? staff.avatarUrl
        : undefined,
    bio: staff.bio,
    photos: visiblePhotos(staff.photos, opts.hiddenIds),
    materials: [...staff.materials],
    workplaces: [...staff.workplaces],
    homeDistrict: staff.homeDistrict,
    homeAddress: opts.revealHomeAddress ? staff.homeAddress : undefined,
    visitDistricts: staff.visitDistricts
      ? [...staff.visitDistricts]
      : undefined,
    accepts: staff.accepts,
    confirmMode: staff.confirmMode,
    calendarVisibility: staff.calendarVisibility,
    colorIndex: staff.colorIndex,
    serviceIds: [...staff.serviceIds],
    callHours: staff.callHours ? { ...staff.callHours } : undefined,
    contacts: c
      ? { ...c, ...(phoneOpen ? { phone: staff.phone } : {}) }
      : undefined,
    prepayment: staff.prepayment
      ? {
          amount: staff.prepayment.amount,
          percent: staff.prepayment.percent,
          timeoutMin: staff.prepayment.timeoutMin,
          ...(staff.prepayment.onlyAfterNoShows ? { onlyAfterNoShows: { ...staff.prepayment.onlyAfterNoShows } } : {}),
        }
      : undefined,
    bookingRules: staff.bookingRules,
  };
}

export function toPublicBusiness(
  business: Business,
  opts: PublicOptions = {},
): PublicBusiness {
  return {
    id: business.id,
    kind: business.kind,
    // F-15-100/103: клиент видит имя из «Бренда» (Business.brandName), пусто — внутреннее Business.name (F-15-114)
    name: business.brandName?.trim() || business.name,
    slug: business.slug,
    sphereIds: [...business.sphereIds],
    networkId: business.networkId,
    locationIds: [...business.locationIds],
    description: business.description,
    logoUrl: business.logoUrl,
    photos: visiblePhotos(business.photos, opts.hiddenIds),
    socials: business.socials,
    phone: business.kind === 'salon' ? business.phone : undefined,
    bookingRules: business.bookingRules,
  };
}

export function toPublicService(
  service: Service,
  opts: PublicOptions & { visibleStaffIds?: ReadonlySet<Id> } = {},
): PublicService {
  return {
    id: service.id,
    businessId: service.businessId,
    categoryId: service.categoryId,
    sphereId: service.sphereId,
    name: service.name,
    description: service.description,
    kind: service.kind,
    durationMin: service.durationMin,
    durationMax: service.durationMax,
    priceMin: service.priceMin,
    priceMax: service.priceMax,
    repeatIntervalDays: service.repeatIntervalDays,
    capacity: service.capacity,
    photos: visiblePhotos(service.photos, opts.hiddenIds),
    materials: [...service.materials],
    staffIds: opts.visibleStaffIds
      ? service.staffIds.filter((id) => opts.visibleStaffIds!.has(id))
      : [...service.staffIds],
    workplaces: [...service.workplaces],
    order: service.order,
    shadeChoice: service.shadeChoice,
  };
}

export function toPublicLocation(location: Location): PublicLocation {
  return {
    id: location.id,
    businessId: location.businessId,
    name: location.name,
    address: location.address,
    district: location.district,
    yandexMapsUrl: location.yandexMapsUrl,
    coords: location.coords,
    phone: location.phone,
    openHours: location.openHours,
  };
}

// ─────────────────────────── Звонок мастеру (F-00-105) ───────────────────────────

/**
 * Открыта ли сейчас кнопка «Позвонить»: «всегда»; «по часам» — внутри Staff.callHours; «не во время записей» — не в
 * занятом интервале (busy — минуты от полуночи, rules/busy busyIntervals); «только сообщения» — никогда.
 */
export function canCallNow(
  staff: Pick<Staff, 'contacts' | 'callHours'>,
  now: ISODateTime,
  busy: readonly { from: Minutes; to: Minutes }[] = [],
): boolean {
  const mode = staff.contacts?.callMode;
  if (!mode || mode === 'messages') return false;
  const m = toMinutes(now.slice(11, 16));
  if (mode === 'hours') {
    if (!staff.callHours) return false;
    return (
      toMinutes(staff.callHours.from) <= m && m < toMinutes(staff.callHours.to)
    );
  }
  if (mode === 'busy') return !busy.some((b) => b.from <= m && m < b.to);
  return true;
}

// ─────────────────────────── Клиент в кабинете (право clients.phones) ───────────────────────────

/** Карточка клиента для сотрудника: без права «видеть телефоны» номер маскируется (F-00-039, clients.phones) */
export function clientForStaff<C extends Pick<Client, 'phone'>>(
  client: C,
  canSeePhones: boolean,
): C {
  return canSeePhones ? client : { ...client, phone: maskPhone(client.phone) };
}

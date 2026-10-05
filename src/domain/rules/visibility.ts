/**
 * КОГО ВИДНО КЛИЕНТУ — единый источник правды (F-00-024/065/072, F-03-134/140, arch-a1 №5).
 * Заменяет client.listCatalog (inline), online.isStaffOnlineVisible и online.isListable.
 *
 * Режимы видимости мастера (Staff.calendarVisibility, F-00-065):
 *  - 'all'  — в каталоге и поиске, по ссылке, записывается сразу (по правилу подтверждения);
 *  - 'link' — НЕ в каталоге, по ссылке виден и записывается;
 *  - 'mine' — НЕ в каталоге; по ссылке «свой» клиент записывается как обычно, чужой — только заявкой
 *             (статус «Ждёт подтверждения», newBookingStatus с isOwnClient: false).
 * Скрыто всем: мастер не активен, бизнес не активен (заморожен — F-00-024), онлайн-запись выключена
 * (Staff.onlineBookingEnabled === false, F-03-134), мастер или его материал скрыт модерацией.
 * В каталог не попадает «пустой» профиль (F-00-072): нет онлайн-услуг, графика или фото.
 *
 * Модерация приходит параметром hiddenIds (id сущностей, не прошедших проверку) — правило не зависит от api platform.
 * В api ядра множество собирает moderationHiddenIds() (src/api/core.ts).
 */
import type { CoreData, Id, Service, Staff } from '@/domain/core';
import { occupiesTime } from '@/domain/rules/booking-status';

export interface VisibilityOptions {
  /** Id, скрытые модерацией (мастер, услуга, бизнес, фото…) */
  hiddenIds?: ReadonlySet<Id>;
}

export type VisibilityReason =
  | 'staff_inactive'
  | 'business_inactive'
  | 'online_disabled'
  | 'moderation'
  | 'no_services'
  | 'no_schedule'
  | 'no_photo'
  | 'link_only'
  | 'mine_only';

export interface StaffClientVisibility {
  /** Показывать в каталоге и поиске приложения */
  catalog: boolean;
  /** Открывается по ссылке / на публичной странице бизнеса */
  link: boolean;
  /** Можно записаться онлайн (есть онлайн-услуги и график) */
  bookable: boolean;
  /** Запись для чужого клиента — только заявкой (режим «Только мои клиенты») */
  requestOnly: boolean;
  /** Почему не везде виден — для подсказки мастеру «что заполнить» */
  reasons: VisibilityReason[];
}

const NOTHING = (reasons: VisibilityReason[]): StaffClientVisibility => ({
  catalog: false,
  link: false,
  bookable: false,
  requestOnly: false,
  reasons,
});

/** Услуги, которые клиент может выбрать онлайн: активны, открыты для онлайн-записи и не скрыты модерацией */
export function isServiceBookableOnline(service: Pick<Service, 'id' | 'active' | 'onlineBookable'>, opts: VisibilityOptions = {}): boolean {
  return service.active && service.onlineBookable && !opts.hiddenIds?.has(service.id);
}

/**
 * Онлайн-услуги мастера (услуга назначена мастеру: Staff.serviceIds или Service.staffIds) — для каталога и приложения.
 * ⭐ «Приём заказа» мастерской (kind 'intake', запись на сдачу 05.10.2026) — не услуга каталога: записываются на него только
 * кнопкой «Записаться на сдачу» на странице мастерской.
 */
export function visibleServices(
  core: Pick<CoreData, 'services'>,
  staff: Pick<Staff, 'id' | 'businessId' | 'serviceIds'>,
  opts: VisibilityOptions = {},
): Service[] {
  return core.services.filter(
    (s) =>
      s.businessId === staff.businessId &&
      (staff.serviceIds.includes(s.id) || s.staffIds.includes(staff.id)) &&
      s.kind !== 'intake' &&
      isServiceBookableOnline(s, opts),
  );
}

/** Онлайн-услуги бизнеса (публичная страница). Услуга без мастеров клиенту не видна: записаться не к кому (services У8) */
export function visibleBusinessServices(core: Pick<CoreData, 'services'>, businessId: Id, opts: VisibilityOptions = {}): Service[] {
  return core.services.filter((s) => s.businessId === businessId && s.staffIds.length > 0 && s.kind !== 'intake' && isServiceBookableOnline(s, opts));
}

/** Видимость мастера клиентам — одна функция для каталога, публичной страницы, виджета и записи */
export function staffClientVisibility(core: CoreData, staff: Staff, opts: VisibilityOptions = {}): StaffClientVisibility {
  if (staff.status !== 'active') return NOTHING(['staff_inactive']);
  const business = core.businesses.find((b) => b.id === staff.businessId);
  if (!business || business.status !== 'active') return NOTHING(['business_inactive']);
  if (opts.hiddenIds?.has(staff.id) || opts.hiddenIds?.has(business.id)) return NOTHING(['moderation']);
  if (staff.onlineBookingEnabled === false) return NOTHING(['online_disabled']);

  const reasons: VisibilityReason[] = [];
  const hasServices = visibleServices(core, staff, opts).length > 0;
  const hasSchedule = core.schedules.some((s) => s.staffId === staff.id);
  const hasPhoto = Boolean(staff.avatarUrl) || staff.photos.length > 0;
  if (!hasServices) reasons.push('no_services');
  if (!hasSchedule) reasons.push('no_schedule');
  if (!hasPhoto) reasons.push('no_photo');
  if (staff.calendarVisibility === 'link') reasons.push('link_only');
  if (staff.calendarVisibility === 'mine') reasons.push('mine_only');

  const bookable = hasServices && hasSchedule;
  return {
    catalog: bookable && hasPhoto && staff.calendarVisibility === 'all',
    link: true,
    bookable,
    requestOnly: staff.calendarVisibility === 'mine',
    reasons,
  };
}

/** Мастер в каталоге и поиске приложения */
export function isStaffInCatalog(core: CoreData, staff: Staff, opts: VisibilityOptions = {}): boolean {
  return staffClientVisibility(core, staff, opts).catalog;
}

/** К мастеру можно записаться онлайн (по ссылке/виджету/из приложения) */
export function isStaffBookableOnline(core: CoreData, staff: Staff, opts: VisibilityOptions = {}): boolean {
  const v = staffClientVisibility(core, staff, opts);
  return v.link && v.bookable;
}

/**
 * «Свой» клиент мастера (F-00-065, режим «Только мои клиенты»): у клиента была неотменённая запись к этому мастеру.
 * Карточка в CRM без визита «своим» не делает (F-00-130: по номеру из CRM мастер клиенту не раскрывается).
 */
export function isOwnClient(core: Pick<CoreData, 'bookings'>, staffId: Id, who: { clientId?: Id; appUserId?: Id }): boolean {
  if (!who.clientId && !who.appUserId) return false;
  return core.bookings.some(
    (b) =>
      occupiesTime(b) &&
      (b.staffId === staffId || b.services.some((l) => l.staffId === staffId)) &&
      ((who.clientId && b.clientId === who.clientId) || (who.appUserId && b.appUserId === who.appUserId)),
  );
}

/** Множество скрытых модерацией id по элементам проверки (F-00-168): всё, что не одобрено и не авто-одобрено */
export function hiddenByModeration(items: readonly { refId: Id; status: string }[]): Set<Id> {
  const out = new Set<Id>();
  for (const item of items) if (item.status !== 'approved' && item.status !== 'auto') out.add(item.refId);
  return out;
}

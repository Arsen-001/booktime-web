/**
 * ⭐ Запись на сдачу по времени (05.10.2026): детейлинг, приём техники, ателье, химчистка. Мастерская включает «Запись на
 * сдачу» — клиент на /b/<slug> выбирает короткое окно, когда принесёт вещь, оставляет номер (код, как у обычной записи)
 * и пару слов о вещи. Это обычная запись журнала на скрытую услугу «Приём заказа» (Service.kind = 'intake'); описание —
 * комментарий записи. Пришёл — «Принять заказ» одним нажатием: форма заказа уже с клиентом и вещью (Order.bookingId).
 * Настройка — сама услуга: вкл/выкл = active + onlineBookable, окно = durationMin, кто принимает = staffIds.
 * Те же правила, что у сервера (booktime-backend: modules/orders/order-rules.ts). Экраны импортируют из '@/domain/orders'.
 */
import type { Booking, BookingStatus, Id, ISODateTime, LocalizedText, Service } from '@/domain/core';

/** Длина окна приёма, мин — выбор в настройках заказов */
export const INTAKE_SLOT_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
export const DEFAULT_INTAKE_SLOT_MIN = 15;

/** Название скрытой услуги — его видят клиент (в записи и напоминаниях) и журнал */
export const INTAKE_SERVICE_NAME: LocalizedText = { ru: 'Приём заказа', hy: 'Պատվերի ընդունում', en: 'Order drop-off' };

/** Описание вещи в записи — не длиннее (поле комментария записи) */
export const INTAKE_DESCRIPTION_MAX = 150;

export interface IntakeSettings {
  enabled: boolean;
  /** Длина окна приёма, мин */
  slotMin: number;
  /** Кто принимает; пусто — ещё не настраивали */
  staffIds: Id[];
  /** Услуга «Приём заказа»; null — ещё не включали */
  serviceId: Id | null;
}

export interface IntakeSettingsInput {
  enabled: boolean;
  slotMin: number;
  /** Пусто — все активные сотрудники */
  staffIds?: Id[];
}

/** Запись на сдачу за день — для «Сдают сегодня» в заказах и вкладки «Заказ» окна записи */
export interface IntakeBooking {
  bookingId: Id;
  start: ISODateTime;
  durationMin: number;
  status: BookingStatus;
  staffId: Id;
  clientId: Id | null;
  clientName: string;
  clientPhone: string;
  /** Что сдают — комментарий клиента к записи */
  description: string | null;
  /** Заказ по этой записи уже принят */
  orderId: Id | null;
  orderNumber: number | null;
}

/** Скрытая услуга «Приём заказа» — не показывать в каталоге, поиске, выборе услуг и в услугах кабинета */
export function isIntakeService(s: Pick<Service, 'kind'> | undefined | null): boolean {
  return s?.kind === 'intake';
}

/** Длина окна: из списка, иначе ближайшая разрешённая */
export function intakeSlotOf(min: number | null | undefined): number {
  if (!min || !Number.isFinite(min)) return DEFAULT_INTAKE_SLOT_MIN;
  return [...INTAKE_SLOT_OPTIONS].sort((a, b) => Math.abs(a - min) - Math.abs(b - min) || a - b)[0];
}

/** Настройки из строки услуги (нет услуги — выключено, окно по умолчанию) */
export function intakeSettingsOf(svc: Pick<Service, 'id' | 'active' | 'onlineBookable' | 'durationMin' | 'staffIds'> | undefined): IntakeSettings {
  return {
    enabled: Boolean(svc && svc.active && svc.onlineBookable),
    slotMin: svc ? intakeSlotOf(svc.durationMin) : DEFAULT_INTAKE_SLOT_MIN,
    staffIds: svc?.staffIds ?? [],
    serviceId: svc?.id ?? null,
  };
}

/** Запись — «Приём заказа»: среди строк записи есть услуга мастерской intake */
export function isIntakeBooking(booking: Pick<Booking, 'services'>, intakeServiceId: Id | null | undefined): boolean {
  return Boolean(intakeServiceId) && booking.services.some((l) => l.serviceId === intakeServiceId);
}

/** По отменённой записи заказ не принимают (опоздал после «не пришёл» — можно) */
export const INTAKE_CLOSED_STATUSES: readonly BookingStatus[] = ['cancelled_by_client', 'cancelled_by_master'];

/** Адрес записи на сдачу на публичной странице: сразу шаг «Время», мастер — любой из принимающих */
export function intakeBookHref(slug: string, serviceId: Id): string {
  return `/b/${slug}/book?s=${encodeURIComponent(serviceId)}&m=any&step=time`;
}

/**
 * Запись на сдачу на странице мастерской (публичная /b/<slug> и карточка места в приложении): услуга «Приём заказа»
 * включена, «Заказы» включены и её принимает хотя бы один видимый онлайн сотрудник. Иначе — undefined.
 */
export function dropOffOf(
  slug: string,
  data: {
    ordersEnabled?: boolean;
    services: readonly Pick<Service, 'id' | 'kind' | 'staffIds' | 'durationMin'>[];
    staff: readonly { id: Id; serviceIds: readonly Id[] }[];
  },
): { href: string; slotMin: number } | undefined {
  if (!data.ordersEnabled) return undefined;
  const svc = data.services.find(isIntakeService);
  if (!svc || !data.staff.some((m) => svc.staffIds.includes(m.id) || m.serviceIds.includes(svc.id))) return undefined;
  return { href: intakeBookHref(slug, svc.id), slotMin: svc.durationMin || DEFAULT_INTAKE_SLOT_MIN };
}

import type {
  BrandedAppRequest,
  CallbackRequest,
  CallMode,
  CashbackCard,
  CertificateTemplate,
  ClaimToken,
  CoinBalances,
  DemandLead,
  DiaryEntry,
  EmployeeAppAccess,
  Favorite,
  GiftCertificate,
  LocationReview,
  Membership,
  MembershipTemplate,
  MembershipUsedForBooking,
  NewsPost,
  NotificationItem,
  PromotionSettings,
  ShadeChoice,
  StaffContacts,
  StaffReview,
  StarRating,
  Story,
  TimeFormat,
  VisitPaymentLine,
  VisitSaleLine,
} from '@/domain/client';
import { BRANDED_APP_DOCS_EMPTY, BRANDED_APP_MATERIALS_EMPTY, generateStoryImage } from '@/domain/client';
import type { Id, ISODateTime } from '@/domain/core';
import { dayjs, toISODate, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { EMPTY_BIZ_IDS } from '@/mock/seed/ids';
import { freeSlots } from '@/domain/rules/slots';
import { defineSlice } from '@/mock/slice';

/** Демо-картинка типа абонемента/сертификата (F-14-041) — инлайн SVG, без внешней сети */
function cardImage(from: string, to: string, label?: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="184">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="288" height="184" fill="url(#g)"/>` +
    `<circle cx="240" cy="40" r="60" fill="#ffffff" opacity="0.12"/>` + // tokens-ok — демо-обложка SVG: цвет внутри картинки
    `<circle cx="30" cy="150" r="46" fill="#ffffff" opacity="0.1"/>` + // tokens-ok — демо-обложка SVG: цвет внутри картинки
    (label
      ? `<text x="24" y="100" font-family="sans-serif" font-size="22" fill="#fff" font-weight="600">${label}</text>` // tokens-ok
      : '') +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
// Без текста — иллюстрация решётки абонементов не должна зависеть от языка (F-14-038)
const CARD_IMAGE_MEMBERSHIP = cardImage('#6D5EF5', '#9B8CFF'); // tokens-ok
const CARD_IMAGE_CERTIFICATE = cardImage('#F5A623', '#FFC96B', 'Gift card'); // tokens-ok

/**
 * Срез моковой базы раздела «client». Принадлежит разделу.
 * Храните здесь свои данные (ключ — id сущностей ядра). Меняете форму — поднимите version.
 */
export interface ClientState {
  /** Каналы связи и режим звонка по мастеру (F-00-104, F-00-105) — черновик до настроек в staff */
  contacts: Record<Id, StaffContacts>;
  /** «Попросить перезвонить» (F-00-106) — раздел notify читает это отсюда, когда строит доставку */
  callbackRequests: CallbackRequest[];
  /** Ссылки «Закрыть окно» из готового текста клиента (F-00-107) — минтятся вместе с карточкой мастера */
  claims: ClaimToken[];
  /** «Не нашли? Сообщить, когда появится» (F-00-112) */
  demandLeads: DemandLead[];
  /** Когда клиент принял пользовательское соглашение и разрешил обработку данных при входе (F-14-008); ключ — AppUser.id */
  consents: Record<Id, ISODateTime>;
  // Лист ожидания (F-00-102) — с 01.10.2026 не здесь: один лист бизнеса resources.waitlist (старые данные переносит api/resources.ts)
  /** Выбор оттенка/варианта у записи (F-00-094…096); ключ — id записи */
  bookingShade: Record<Id, ShadeChoice>;
  /** ❤ подписки = избранное (F-00-113, F-14-031) */
  favorites: Favorite[];
  /** ★ звёздочки мастерам (F-00-116) — используются, пока online.reviewMode бизнеса = 'star' */
  starRatings: StarRating[];
  /** Оценка 1–5 + текст мастеру (В-24) — используются, когда online.reviewMode бизнеса = 'text' */
  staffReviews: StaffReview[];
  /** Отзывы о месте (F-14-014) */
  locationReviews: LocationReview[];
  /** Лента уведомлений (F-14-055) */
  notifications: NotificationItem[];
  /** Дневник клиента — только ручные расходы (F-00-122); визиты приложения добавляются на лету */
  diaryEntries: DiaryEntry[];
  /** Формат времени клиента (F-14-061); ключ — id клиента приложения */
  timeFormat: Record<Id, TimeFormat>;
  /**
   * Правки мастера к автопереводу его текста на en (F-00-174); ключ — `${owner}:${ownerId}:${field}`,
   * например `staff:s1:bio` или `service:sv3:description`.
   */
  translationOverrides: Record<string, string>;
  /** Абонементы клиента (F-14-037…039, F-14-045…047) */
  memberships: Membership[];
  /** Заморозки, добавленные клиентом сверх сида — ключ id абонемента, значение — до какой даты */
  membershipFreeze: Record<Id, ISODateTime>;
  /** Сертификаты клиента (F-14-040) */
  certificates: GiftCertificate[];
  /** Карты лояльности/кэшбэка клиента (F-14-048…054) */
  cashbackCards: CashbackCard[];
  /** Абонементы, напоминание о конце которых клиент уже видел (F-14-046) — не показывать повторно */
  membershipRemindersSeen: Id[];
  /** Типы абонементов, доступные к покупке в приложении (F-14-043, F-14-044) */
  membershipTemplates: MembershipTemplate[];
  /** Типы сертификатов, доступные к покупке в приложении (F-14-043, F-14-044) */
  certificateTemplates: CertificateTemplate[];
  /**
   * Филиал сети, выбранный клиентом «по умолчанию» (F-14-163) — ключ `${appUserId}:${networkId}`,
   * значение — id бизнеса-филиала. Нет записи — по умолчанию считается основная локация сети
   * (Network.businessIds[0]).
   */
  defaultNetworkLocation: Record<string, Id>;
  /** Платные сторис вверху главной (F-00-159…162, F-14-033…036) */
  stories: Story[];
  /** Новости подписчикам (F-00-114) */
  newsPosts: NewsPost[];
  /** Скидка на горящее окно, продвижение в поиске/на главной (F-00-103, F-00-167); ключ — id бизнеса */
  promotionSettings: Record<Id, PromotionSettings>;
  /**
   * Начальные балансы монет демо — переносятся в журнал монет ядра (core.coinLedger) при первой трате и обнуляются
   * (core-k4 №1). Удалить, когда демо-помощник засеет начальные балансы в ядро.
   */
  coinBalances: CoinBalances;
  /** Пароли администраторов после смены при первом входе (F-00-034, демо); ключ — логин в нижнем регистре */
  adminPasswords: Record<string, string>;
  /** Заявка на своё брендированное приложение (b06, F-14-142…170); ключ — id бизнеса */
  brandedApp: Record<Id, BrandedAppRequest>;
  /** Запись по абонементу списывает визит сразу в приложении (F-14-165); ключ — id записи */
  membershipUsedForBooking: MembershipUsedForBooking;
  /** Проданные в визите товар/абонемент/сертификат — окно оплаты в приложении (F-14-092) */
  visitSaleLines: VisitSaleLine[];
  /** Принятые оплаты визита в приложении, частями (F-14-094…097) */
  visitPayments: VisitPaymentLine[];
  /** Доступ сотрудника в приложении: только свои записи, скрытие контактов, аналитика (F-14-119, F-14-120, F-14-125); ключ — id сотрудника */
  employeeAppAccess: Record<Id, EmployeeAppAccess>;
  /** Разовые пуш-сообщения клиенту из записи (F-14-074) — попадают в его ленту уведомлений как 'broadcast' */
  oneOffPushSentAt: Record<Id, ISODateTime>;
  /** Адрес выезда к клиенту, указанный при записи из приложения (F-00-080); ключ — id записи */
  visitAddress: Record<Id, string>;
  /** До какого момента клиент видел события своих записей из ядра (лента уведомлений); ключ — id клиента приложения */
  eventsSeenAt: Record<Id, ISODateTime>;
  /**
   * ⭐ Клиент подключил напоминания в Telegram-боте (30.09.2026): ключ — номер (+374…), значение — когда. В демо бот не
   * настоящий — подключение отмечается по нажатию «Подключить»; в режиме api связь хранит сервер (TelegramLink).
   */
  telegramLinked: Record<string, ISODateTime>;
  /** «Вход через Google» привязан (03.10.2026): ключ — id клиента приложения, значение — почта Google (демо) */
  googleLinked: Record<Id, string>;
  /** Когда клиенту отправлена квитанция об оплате визита (F-14-095); ключ — id записи */
  visitReceiptSentAt: Record<Id, ISODateTime>;
  /** Пользователь выключил пуши о новостях нашего продукта (F-14-136); ключ — id клиента приложения */
  newsPushOptOut: Record<Id, boolean>;
  /** Сколько уже выплачено сотруднику по зарплате в приложении, демо-накопитель (F-14-127); ключ — id сотрудника */
  payrollPaid: Record<Id, number>;
  /** Когда сотрудник уволен из приложения (F-14-118) — своя метка времени, у Staff (ядро) поля нет; ключ — id сотрудника */
  staffFiredAt: Record<Id, ISODateTime>;
  /**
   * Доп. место в групповом событии (F-14-107): ключ — id записи, значение — номер места (1, 2…). Имя хранится
   * как есть, подпись «+1 место» ставит экран на языке пользователя. Необязательное — без сброса старых данных.
   */
  eventExtraSeat?: Record<Id, number>;
}

const CALL_MODES: CallMode[] = ['always', 'hours', 'busy', 'messages'];

export const clientSlice = defineSlice<ClientState>({
  version: 16,
  seed: (core, now) => {
    const contacts: Record<Id, StaffContacts> = {};
    core.staff.forEach((s, i) => {
      contacts[s.id] = {
        whatsapp: i % 5 !== 0,
        telegram: i % 3 !== 0 ? `${s.id}` : undefined,
        instagram: i % 4 !== 0 ? `${s.id}` : undefined,
        // У мастеров с явными часами звонков (Staff.callHours) — режим «по часам», иначе перебор режимов демо
        callMode: s.callHours ? 'hours' : CALL_MODES[i % CALL_MODES.length],
      };
    });
    // Демо-клиент приложения (au_01, см. mock/seed/bookings.ts §3) — немного истории, чтобы экраны b03
    // не выглядели пустыми при первом входе: подписки, звёздочка, уведомления, ручная запись дневника.
    const appUserId = core.appUsers[0]?.id;
    const myBookings = appUserId ? core.bookings.filter((b) => b.appUserId === appUserId) : [];
    const arrived = myBookings.filter((b) => b.status === 'arrived');
    const today = dayjs(now);
    const at = (daysAgo: number) => toISODateTime(today.subtract(daysAgo, 'day'));

    const favorites: Favorite[] = [];
    const starRatings: StarRating[] = [];
    const staffReviews: StaffReview[] = [];
    const locationReviews: LocationReview[] = [];
    const notifications: NotificationItem[] = [];
    const diaryEntries: DiaryEntry[] = [];

    // ★ от клиентов приложения за ~70 % состоявшихся визитов (demo-q2/q4: иначе звёздочка была у одного мастера)
    const starred = new Set<string>();
    core.bookings.forEach((b, i) => {
      if (!b.appUserId || b.status !== 'arrived' || b.deletedAt || i % 10 >= 7) return;
      const key = `${b.appUserId}:${b.staffId}`;
      if (starred.has(key)) return;
      starred.add(key);
      starRatings.push({ id: newId('str'), appUserId: b.appUserId, staffId: b.staffId, bookingId: b.id, createdAt: b.start });
    });

    if (appUserId) {
      const arrivedStaffIds = Array.from(new Set(arrived.map((b) => b.staffId)));
      arrivedStaffIds.slice(0, 2).forEach((staffId, i) => {
        favorites.push({
          id: newId('fav'),
          appUserId,
          targetType: 'staff',
          targetId: staffId,
          newsMuted: i === 1,
          createdAt: at(20 - i * 5),
        });
      });
      const firstBusinessId = arrived[0]?.businessId ?? myBookings[0]?.businessId;
      if (firstBusinessId) {
        favorites.push({
          id: newId('fav'),
          appUserId,
          targetType: 'business',
          targetId: firstBusinessId,
          newsMuted: false,
          createdAt: at(18),
        });
      }

      const starBooking = arrived[0];
      if (starBooking) {
        locationReviews.push({
          id: newId('lrv'),
          appUserId,
          businessId: starBooking.businessId,
          bookingId: starBooking.id,
          text: 'Уютное место, всё по записи вовремя, обязательно вернусь ещё.',
          createdAt: at(9),
        });
      }

      // Напоминание — только о записи в ближайшие сутки (qa 30.09: «Напоминаем о записи — 12 октября» приходило сегодня);
      // остальные напоминания создаёт listNotifications по окну напоминания (materializeBookingReminders)
      const nowIso = toISODateTime(today);
      const dayAhead = toISODateTime(today.add(1, 'day'));
      const upcoming = myBookings
        .filter((b) => (b.status === 'awaiting_confirmation' || b.status === 'scheduled') && b.start > nowIso && b.start <= dayAhead)
        .sort((x, y) => x.start.localeCompare(y.start))[0];
      const confirmNeeded = myBookings.find((b) => b.status === 'awaiting_confirmation');
      const cancelledByMaster = myBookings.find((b) => b.status === 'cancelled_by_master');
      if (arrived[1]) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'booking_created',
          businessId: arrived[1].businessId,
          staffId: arrived[1].staffId,
          bookingId: arrived[1].id,
          createdAt: at(14),
          readAt: at(14),
        });
      }
      if (confirmNeeded) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'confirm_request',
          businessId: confirmNeeded.businessId,
          staffId: confirmNeeded.staffId,
          bookingId: confirmNeeded.id,
          createdAt: at(1),
        });
      }
      if (upcoming) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'booking_reminder',
          businessId: upcoming.businessId,
          staffId: upcoming.staffId,
          bookingId: upcoming.id,
          createdAt: at(0),
        });
      }
      if (cancelledByMaster) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'cancelled_by_master',
          businessId: cancelledByMaster.businessId,
          staffId: cancelledByMaster.staffId,
          bookingId: cancelledByMaster.id,
          createdAt: at(3),
          readAt: at(2),
        });
      }
      if (arrived[0]) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'come_again',
          businessId: arrived[0].businessId,
          staffId: arrived[0].staffId,
          bookingId: arrived[0].id,
          createdAt: at(2),
        });
      }
      if (favorites[0]) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'broadcast',
          businessId: favorites[0].targetType === 'business' ? favorites[0].targetId : (arrived[0]?.businessId ?? ''),
          createdAt: at(6),
          params: { text: 'Новинка недели — весенняя коллекция гель-лаков' },
        });
      }
      if (arrived[0]) {
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'birthday_greeting',
          businessId: arrived[0].businessId,
          staffId: arrived[0].staffId,
          createdAt: at(30),
          readAt: at(29),
          params: { discountPercent: 10 },
        });
      }
      if (favorites[0]) {
        const discountBusinessId = favorites[0].targetType === 'business' ? favorites[0].targetId : (arrived[0]?.businessId ?? '');
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'discount_new',
          businessId: discountBusinessId,
          createdAt: at(10),
          params: { discountPercent: 15 },
        });
        notifications.push({
          id: newId('ntf'),
          appUserId,
          kind: 'discount_ending',
          businessId: discountBusinessId,
          createdAt: at(4),
          readAt: at(3),
          params: { days: 2 },
        });
      }

      diaryEntries.push({
        id: newId('dry'),
        appUserId,
        serviceName: 'Брови: коррекция и окрашивание',
        masterName: 'Своя запись',
        date: today.subtract(25, 'day').format('YYYY-MM-DD'),
        amount: 6000,
        createdAt: at(25),
      });
    }

    // Абонементы, сертификаты и кэшбэк-карты (b04, F-14-037…054) — берём бизнесы, где у клиента уже есть
    // визиты (арендуем список из arrived/myBookings выше), иначе первые бизнесы ядра, чтобы демо не было пустым.
    const memberships: Membership[] = [];
    const certificates: GiftCertificate[] = [];
    const cashbackCards: CashbackCard[] = [];
    if (appUserId) {
      const businessIds = Array.from(new Set(arrived.map((b) => b.businessId)));
      const pick = (i: number) => businessIds[i] ?? core.businesses[i]?.id;
      const b0 = pick(0);
      const b1 = pick(1);
      const b2 = pick(2);
      const serviceNamesFor = (businessId: Id | undefined) =>
        core.services.filter((s) => s.businessId === businessId).slice(0, 3).map((s) => s.name.ru);

      if (b0) {
        // Действующий абонемент с несколькими визитами в запасе
        memberships.push({
          id: newId('mem'),
          appUserId,
          businessId: b0,
          title: { ru: 'Абонемент на 10 визитов', en: 'Membership: 10 visits' },
          number: `AB-${1000 + arrived.length}`,
          visitsTotal: 10,
          visitsLeft: 4,
          price: 45000,
          validUntil: toISODate(today.add(40, 'day')),
          frozen: false,
          freezeDaysAvailable: 14,
          serviceNames: serviceNamesFor(b0),
          imageUrl: CARD_IMAGE_MEMBERSHIP,
          onSale: true,
          autoRenew: false,
          purchasedAt: at(60),
          active: true,
          purchaseStatus: 'confirmed',
        });
      }
      if (b1) {
        // Абонемент, который скоро истекает (последний визит) — должен зажечь 🔥 и напоминание (F-14-046)
        memberships.push({
          id: newId('mem'),
          appUserId,
          businessId: b1,
          // Название — по услугам, на которые он действует (serviceNamesFor): «массажи» на маникюр путали клиента в /book
          title: { ru: 'Абонемент на 5 визитов', en: 'Membership: 5 visits' },
          number: `AB-${2000 + arrived.length}`,
          visitsTotal: 5,
          visitsLeft: 1,
          price: 30000,
          validUntil: toISODate(today.add(3, 'day')),
          frozen: false,
          serviceNames: serviceNamesFor(b1),
          onSale: true,
          autoRenew: true,
          purchasedAt: at(80),
          active: true,
          purchaseStatus: 'confirmed',
        });
        // Полностью израсходованный — не должен появляться в списке (F-14-037), но открывается из записи оплаты
        const usedUp = arrived.find((b) => b.businessId === b1);
        memberships.push({
          id: newId('mem'),
          appUserId,
          businessId: b1,
          title: { ru: 'Абонемент на 3 визита', en: 'Membership: 3 visits' },
          number: `AB-${3000 + arrived.length}`,
          visitsTotal: 3,
          visitsLeft: 0,
          price: 15000,
          validUntil: toISODate(today.subtract(2, 'day')),
          frozen: false,
          serviceNames: serviceNamesFor(b1),
          onSale: false,
          autoRenew: false,
          purchasedAt: at(120),
          active: false,
          purchaseStatus: 'confirmed',
        });
        void usedUp;
      }

      // Абонемент, действующий в сети из нескольких филиалов (F-14-039, F-14-042, F-14-163) — не завязан на
      // "arrived", чтобы сценарий сети было видно в демо независимо от истории визитов конкретной персоны.
      const networkBusiness = core.businesses.find((b) => {
        if (!b.networkId) return false;
        const net = core.networks.find((n) => n.id === b.networkId);
        return Boolean(net && net.businessIds.length > 1);
      });
      if (networkBusiness) {
        memberships.push({
          id: newId('mem'),
          appUserId,
          businessId: networkBusiness.id,
          title: { ru: 'Абонемент «Стрижка и укладка»', en: 'Membership: Haircut & styling' },
          number: 'AB-4001',
          visitsTotal: 6,
          visitsLeft: 3,
          price: 36000,
          validUntil: toISODate(today.add(60, 'day')),
          frozen: false,
          freezeDaysAvailable: 10,
          serviceNames: serviceNamesFor(networkBusiness.id),
          imageUrl: CARD_IMAGE_MEMBERSHIP,
          onSale: true,
          autoRenew: false,
          purchasedAt: at(30),
          active: true,
          purchaseStatus: 'confirmed',
        });
      }

      if (b0) {
        certificates.push({
          id: newId('gft'),
          appUserId,
          businessId: b0,
          number: `GC-${5000 + arrived.length}`,
          faceValue: 20000,
          balance: 12000,
          usesLimit: 'multiple',
          validUntil: toISODate(today.add(90, 'day')),
          appliesTo: 'anything',
          purchasedAt: at(15),
          active: true,
          purchaseStatus: 'confirmed',
          imageUrl: CARD_IMAGE_CERTIFICATE,
        });
        // Израсходованный сертификат — скрыт из блока, но должен открываться из строки оплаты записи
        certificates.push({
          id: newId('gft'),
          appUserId,
          businessId: b0,
          number: `GC-${6000 + arrived.length}`,
          faceValue: 10000,
          balance: 0,
          usesLimit: 'once',
          validUntil: toISODate(today.add(30, 'day')),
          appliesTo: 'services',
          purchasedAt: at(40),
          active: false,
          purchaseStatus: 'confirmed',
        });
        // Заявка «ждёт подтверждения» (В-17) — купил в приложении, реквизиты показаны, бизнес ещё не подтвердил
        certificates.push({
          id: newId('gft'),
          appUserId,
          businessId: b0,
          number: `GC-${6500 + arrived.length}`,
          faceValue: 15000,
          balance: 15000,
          usesLimit: 'multiple',
          validUntil: toISODate(today.add(180, 'day')),
          appliesTo: 'anything',
          purchasedAt: at(0.2),
          active: false,
          purchaseStatus: 'pendingConfirmation',
        });
      }

      if (b1) {
        // Заявка на абонемент, ещё не подтверждённая бизнесом (В-17)
        memberships.push({
          id: newId('mem'),
          appUserId,
          businessId: b1,
          title: { ru: 'Абонемент «8 маникюров»', en: 'Membership: 8 manicures' },
          number: `AB-${9000 + arrived.length}`,
          visitsTotal: 8,
          visitsLeft: 8,
          price: 40000,
          validUntil: toISODate(today.add(150, 'day')),
          frozen: false,
          serviceNames: serviceNamesFor(b1),
          onSale: true,
          autoRenew: false,
          purchasedAt: at(0.1),
          active: false,
          purchaseStatus: 'pendingConfirmation',
        });
      }

      if (b0) {
        cashbackCards.push({
          id: newId('csh'),
          appUserId,
          businessId: b0,
          cardNumber: `LC-${7000 + arrived.length}`,
          balance: 3400,
          visible: true,
          spendScope: 'anything',
          spendLimitPercent: 50,
          earnRules: [
            { kind: 'fixed', rate: 5, isPercent: true },
            { kind: 'per_visit_count', rate: 10, isPercent: true, toNextLevel: 2 },
          ],
          discountText: 'Скидка 5% постоянным клиентам',
        });
      }
      if (b1) {
        // Нулевой баланс, но карта действует — должна показать «как заработать» (F-14-049)
        cashbackCards.push({
          id: newId('csh'),
          appUserId,
          businessId: b1,
          cardNumber: `LC-${8000 + arrived.length}`,
          balance: 0,
          visible: true,
          spendScope: 'services',
          spendLimitMoney: 5000,
          earnRules: [{ kind: 'per_spend_sum', rate: 3, isPercent: true, toNextLevel: 15000 }],
        });
      }
      if (b2) {
        // Карта с полностью запрещённым списанием — «уточните у администратора» (F-14-050)
        cashbackCards.push({
          id: newId('csh'),
          appUserId,
          businessId: b2,
          cardNumber: `LC-${9000 + arrived.length}`,
          balance: 1200,
          visible: true,
          spendScope: 'blocked',
          earnRules: [{ kind: 'fixed', rate: 200, isPercent: false }],
        });
      }
    }

    // Типы абонементов/сертификатов на продажу в приложении (F-14-043, F-14-044) — только у каждого
    // второго бизнеса, чтобы демо показывало и «есть что купить», и «блока покупок нет» (F-14-044)
    const membershipTemplates: MembershipTemplate[] = [];
    const certificateTemplates: CertificateTemplate[] = [];
    core.businesses.forEach((b, i) => {
      if (i % 2 !== 0) return;
      const names = core.services.filter((s) => s.businessId === b.id).slice(0, 3).map((s) => s.name.ru);
      membershipTemplates.push({
        id: newId('mtp'),
        businessId: b.id,
        title: { ru: 'Абонемент на 10 визитов', en: 'Membership: 10 visits' },
        visitsTotal: 10,
        price: 45000,
        validDays: 120,
        serviceNames: names,
        onSale: true,
      });
      certificateTemplates.push({
        id: newId('ctp'),
        businessId: b.id,
        faceValue: 20000,
        validDays: 180,
        usesLimit: 'multiple',
        appliesTo: 'anything',
        onSale: true,
      });
    });

    // Платные сторис, новости, продвижение и монеты (b05: F-00-103, F-00-114, F-00-159…167) — несколько
    // бизнесов на разных статусах, чтобы демо показывало и «сторис активна», и «ждёт проверки», и «истекла».
    const stories: Story[] = [];
    const newsPosts: NewsPost[] = [];
    const promotionSettings: Record<Id, PromotionSettings> = {};
    const coinBalances: CoinBalances = {};
    core.businesses.forEach((b, i) => {
      // Первый бизнес (обычно демо-персона owner) всегда с монетами — иначе экраны продвижения
      // сразу упираются в «не хватает монет» без единого способа пополнить в этой пачке.
      coinBalances[b.id] = i === 0 ? 8000 : i % 4 === 0 ? 0 : 1200 * ((i % 5) + 1);
      if (i % 3 === 0) {
        promotionSettings[b.id] = { hotSlotDiscountPercent: 10 };
      }
      if (i === 1) {
        promotionSettings[b.id] = { ...promotionSettings[b.id], boostSearch: { active: true, expiresAt: toISODateTime(today.add(2, 'day')) } };
      }
      // Только мастера с услугами, без администратора и владельца-не-мастера (demo-q4); время — настоящие свободные окна
      // сегодня по правилу ядра, мастер без окон в сторис не попадает
      const nowIso = toISODateTime(today);
      const staffWindows = core.staff
        .filter((s) => s.businessId === b.id && s.status === 'active' && s.role !== 'admin' && s.serviceIds.length > 0)
        .map((s) => {
          const shortest = core.services
            .filter((sv) => sv.staffIds.includes(s.id) && sv.active)
            .reduce<number | undefined>((m, sv) => (m === undefined || sv.durationMin < m ? sv.durationMin : m), undefined);
          const times = freeSlots(core, { staffId: s.id, date: toISODate(today), durationMin: shortest ?? 30 }, nowIso)
            .slice(0, 2)
            .map((slot) => slot.start.slice(11, 16));
          return { staff: s, label: times.join(', ') };
        })
        .filter((w) => w.label)
        .slice(0, 2);
      const showNames = b.kind !== 'individual';
      if (i % 3 === 0 && staffWindows.length) {
        stories.push({
          id: newId('sty'),
          businessId: b.id,
          kind: 'generated',
          imageUrl: generateStoryImage({
            businessName: b.name,
            lines: ['Свободно сегодня', ...staffWindows.map((w) => (showNames ? `${w.staff.name} · ${w.label}` : w.label))],
            lang: 'ru',
          }),
          lang: ['ru'],
          showStaffNames: showNames,
          windows: staffWindows.map((w) => ({ staffId: w.staff.id, staffName: showNames ? w.staff.name : undefined, label: w.label })),
          status: 'active',
          price: 1500,
          createdAt: at(0),
          expiresAt: toISODateTime(today.add(1, 'day')),
          viewCount: 340 + i * 12,
          clickCount: 28 + i,
          bookingCount: i % 2,
        });
      }
      if (i === 2) {
        // Своя фотография — ждёт ручной проверки platform (F-00-168, F-14-034)
        stories.push({
          id: newId('sty'),
          businessId: b.id,
          kind: 'photo',
          imageUrl: b.photos[0] ?? generateStoryImage({ businessName: b.name, lines: ['Новая коллекция'], lang: 'ru' }),
          lang: ['ru'],
          showStaffNames: false,
          windows: [],
          status: 'pending_review',
          price: 1500,
          createdAt: at(0),
          viewCount: 0,
          clickCount: 0,
          bookingCount: 0,
        });
      }
      if (i === 4) {
        stories.push({
          id: newId('sty'),
          businessId: b.id,
          kind: 'generated',
          imageUrl: generateStoryImage({ businessName: b.name, lines: ['Было вчера'], lang: 'ru' }),
          lang: ['ru'],
          showStaffNames: showNames,
          windows: [],
          status: 'expired',
          price: 1500,
          createdAt: at(3),
          expiresAt: toISODateTime(today.subtract(2, 'day')),
          viewCount: 512,
          clickCount: 61,
          bookingCount: 3,
        });
      }
      // Пустые демо-бизнесы (owner-empty, individual-empty) должны быть пусты во ВСЕХ функциях —
      // без сгенерированной новости, даже когда индекс совпал с условием ниже.
      if (i % 4 === 1 && !EMPTY_BIZ_IDS.includes(b.id)) {
        newsPosts.push({
          id: newId('nws'),
          businessId: b.id,
          text: 'Новый оттенок гель-лака уже в наличии — приходите на обновление!',
          createdAt: at(2),
          paidWithCoins: false,
        });
      }
    });

    // Заявка на своё приложение (b06, F-14-142…170) — три бизнеса на разных этапах, чтобы демо показывало
    // и черновик без материалов, и отправленную заявку, и «уже в разработке»; у остальных — пустой черновик.
    const brandedApp: Record<Id, BrandedAppRequest> = {};
    core.businesses.forEach((b, i) => {
      brandedApp[b.id] = {
        businessId: b.id,
        stage: 'draft',
        materials: { ...BRANDED_APP_MATERIALS_EMPTY },
        docs: { ...BRANDED_APP_DOCS_EMPTY },
        extraLocations: 0,
      };
      if (i === 0) {
        brandedApp[b.id] = {
          businessId: b.id,
          stage: 'submitted',
          ownerType: 'organization',
          accessMethod: 'portal_invite',
          materials: {
            fullName: b.name.slice(0, 30),
            shortName: b.name.slice(0, 11),
            shortDescription: 'Онлайн-запись в один тап, история визитов и напоминания.',
            longDescription:
              'Записывайтесь к нам в пару нажатий: выбирайте мастера, услугу и удобное время, следите за своими визитами и абонементами прямо в приложении.',
            keywords: 'запись, салон, красота, мастер, услуги',
            logoUrl: b.photos[0],
          },
          docs: { appleDeveloperAccess: true, googlePlayAccess: true, registrationDoc: true, trademarkDoc: true },
          extraLocations: 0,
          submittedAt: at(5),
        };
      }
      if (i === 3) {
        brandedApp[b.id] = {
          businessId: b.id,
          stage: 'in_development',
          ownerType: 'individual',
          accessMethod: 'password_shared',
          materials: {
            fullName: b.name.slice(0, 30),
            shortName: b.name.slice(0, 11),
            shortDescription: 'Ваша запись — теперь в своём приложении.',
            longDescription: 'Своё приложение для клиентов: запись, абонементы и push-напоминания под нашим брендом.',
            keywords: 'бьюти, запись, мастер',
            logoUrl: b.photos[0],
            splashUrl: b.photos[0],
          },
          docs: { appleDeveloperAccess: true, googlePlayAccess: true, registrationDoc: true, trademarkDoc: true },
          extraLocations: 1,
          submittedAt: at(20),
        };
      }
    });

    return {
      contacts,
      stories,
      newsPosts,
      promotionSettings,
      coinBalances,
      adminPasswords: {},
      brandedApp,
      membershipUsedForBooking: {},
      callbackRequests: [],
      claims: [],
      demandLeads: [],
      consents: {},
      bookingShade: {},
      favorites,
      starRatings,
      staffReviews,
      locationReviews,
      notifications: notifications.filter((n) => n.businessId),
      diaryEntries,
      timeFormat: {},
      translationOverrides: {},
      memberships,
      membershipFreeze: {},
      certificates,
      cashbackCards,
      membershipRemindersSeen: [],
      membershipTemplates,
      certificateTemplates,
      defaultNetworkLocation: {},
      visitSaleLines: [],
      visitPayments: [],
      employeeAppAccess: {},
      oneOffPushSentAt: {},
      visitReceiptSentAt: {},
      eventsSeenAt: {},
      telegramLinked: {},
      googleLinked: {},
      visitAddress: {},
      newsPushOptOut: {},
      payrollPaid: {},
      staffFiredAt: {},
    };
  },
});

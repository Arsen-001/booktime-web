/**
 * Типы раздела «client». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 */
import type { DistrictId, ISODate, Id, ISODateTime, LocalizedText, Money, SphereId } from '@/domain/core';

/**
 * Как клиент может связаться с мастером (F-00-104, F-00-105). Раздел staff пока не даёт мастеру
 * управлять этим сам — черновик живёт здесь до просьбы в staff; ключ — id мастера.
 */
/**
 * ⭐ Напоминания в Telegram-боте (30.09.2026): ссылка на бота с кодом привязки номера и подключён ли уже этот номер.
 * Сервер: POST /v1/public/bookings/:id/telegram-link?h= (виджет) и POST /v1/me/telegram-link (приложение).
 */
export interface TelegramLinkInfo {
  url: string;
  botUsername: string;
  linked: boolean;
}

export type CallMode =
  /** Кнопка звонка видна всегда */
  | 'always'
  /** Только в часы из Staff.callHours */
  | 'hours'
  /** Закрыта на время каждой текущей записи мастера */
  | 'busy'
  /** Звонка нет вовсе — только сообщения */
  | 'messages';

export interface StaffContacts {
  whatsapp: boolean;
  /** Юзернейм/ссылка Telegram — если мастер её указал */
  telegram?: string;
  /** Ссылка/юзернейм Instagram — если мастер её указал */
  instagram?: string;
  callMode: CallMode;
}

/** «Попросить перезвонить», когда кнопка звонка закрыта (F-00-106) */
export interface CallbackRequest {
  id: Id;
  staffId: Id;
  phone: string;
  name?: string;
  createdAt: ISODateTime;
}

/**
 * Ссылка «Закрыть окно» в готовом тексте клиента (F-00-107, связано с F-00-104): мастер нажимает её
 * в переписке — окно занято без входа в журнал. Токен без входа не открывает ничего чужого — карточка
 * `/claim/[token]` требует, чтобы вошедший мастер сам был `staffId` этого окна (иначе — «Ссылка для мастера»).
 */
export type ClaimTokenStatus = 'pending' | 'used';

export interface ClaimToken {
  token: Id;
  businessId: Id;
  staffId: Id;
  serviceId?: Id;
  /** Начало окна, 'YYYY-MM-DDTHH:mm' (Ереван) — то же значение, что было в готовом тексте */
  start: ISODateTime;
  /** Имя и телефон клиента (из карточки приложения, если он вошёл) — уходят в запись при закрытии окна, «если есть» */
  clientName?: string;
  clientPhone?: string;
  createdAt: ISODateTime;
  status: ClaimTokenStatus;
  /** Какой записью ядра закрылось окно — ссылка «Перейти к записи» на экране «Готово» */
  usedBookingId?: Id;
}

/** «Не нашли? Сообщить, когда появится» (F-00-112) */
export interface DemandLead {
  id: Id;
  query: string;
  sphereId?: SphereId;
  district?: DistrictId;
  phone?: string;
  createdAt: ISODateTime;
}

/**
 * Соцсети и сайт компании на карточке места (F-14-028). У ядра (Business) таких полей нет — это
 * настройка «Бренд/Контакты» онлайн-записи (см. F-03-044), раздел online её пока не завёл. Черновик
 * живёт здесь до просьбы (qa/requests/client.md); ключ — id бизнеса.
 */
export interface BusinessSocials {
  website?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: boolean;
}

// ─────────────────────────── Запись клиентом (b02: F-00-092…F-00-102, F-14-011…F-14-057) ───────────────────────────

/**
 * Лист ожидания (F-00-101, F-00-102) глазами клиента: он встаёт в очередь на день (или «любой день») и услугу у
 * мастера; при освобождении подходящего окна видит уведомление в /bookings. Это ВИД заявки единого листа бизнеса
 * (WaitlistEntry в domain/resources, владелец 30.09.2026) — отдельно не хранится; id — id заявки листа.
 */
export interface WaitlistEntry {
  id: Id;
  appUserId: Id;
  staffId: Id;
  serviceId: Id;
  /** Конкретный день или «любой день» */
  date: ISODate | 'any';
  createdAt: ISODateTime;
  /** Подходящее окно освободилось — когда именно (F-00-101) */
  notifiedAt?: ISODateTime;
}

/** Обязательность выбора оттенка (F-00-095) — черновик, у услуги в ядре такого поля нет */
export type ShadeRequirement = 'required' | 'preferred';

export type ShadeMode = 'material' | 'master' | 'own';

/** Выбор оттенка/варианта клиентом при записи (F-00-094…096) — хранится по id записи */
export interface ShadeChoice {
  mode: ShadeMode;
  /** Материал из Service.materials, когда mode === 'material' */
  material?: string;
  requirement: ShadeRequirement;
}

/**
 * Ручная предоплата (F-00-097) — черновик правила мастера, пока нет настроек в разделе staff/online.
 * Ключ — id мастера: у него либо нет предоплаты, либо она требуется по всем его услугам.
 */
export interface PrepaymentPolicy {
  amount: Money;
  /** Сколько минут держится окно, пока клиент не нажал «Я оплатил» */
  timeoutMin: number;
  requisites: string;
}

// ─────────────────────────── Избранное, звёздочка, уведомления, дневник, профиль (b03) ───────────────────────────

/** Что можно добавить в избранное (F-00-113, F-14-031): мастера или салон целиком */
export type FavoriteTargetType = 'staff' | 'business';

/** ❤ подписка = избранное + новости (F-00-113); приглушить новости, не отписываясь (F-00-115) */
export interface Favorite {
  id: Id;
  appUserId: Id;
  targetType: FavoriteTargetType;
  targetId: Id;
  /** «Новости» выкл — подписка остаётся, напоминания о записи этим не глушатся (F-00-115) */
  newsMuted: boolean;
  createdAt: ISODateTime;
}

/** ★ звёздочка мастеру (F-00-116): по одной на клиента на мастера, только после визита «пришёл», можно снять */
export interface StarRating {
  id: Id;
  appUserId: Id;
  staffId: Id;
  /** Визит, после которого поставили звёздочку — по нему проверяем право (F-14-013) */
  bookingId: Id;
  createdAt: ISODateTime;
}

/**
 * Отзыв о месте (F-14-014): текстовый отзыв о салоне целиком, отдельно от звёздочки мастеру
 * (F-00-116). Решение по умолчанию (пункт «Готово, когда» этой функции числится открытым у владельца,
 * qa/questions/client.md не заведён — вопрос уже записан как открытый в самом ТЗ): отдельная оценка
 * салона в звёздах НЕ заводим (её нет и у мастера — только звезда/не звезда), берём один текстовый
 * отзыв на визит, виден всем на карточке места. По одному отзыву на визит «пришёл», можно
 * отредактировать текст, пока не удалил.
 */
export interface LocationReview {
  id: Id;
  appUserId: Id;
  businessId: Id;
  /** Визит, после которого оставили отзыв — по нему проверяем право (как F-14-013 у звёздочки) */
  bookingId: Id;
  text: string;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

/**
 * Оценка мастера, когда бизнес выбрал «оценка и текст» вместо звёздочки (В-24, F-14-013 1:1 с Altegio):
 * 1–5 звёзд и необязательный текст, по одной на визит «пришёл», можно менять, пока не удалил. Заменяет
 * StarRating для этого бизнеса — какую из двух форм показать клиенту решает online.reviewMode (F-03-105).
 * Текст (если есть) уходит на модерацию платформы (submitForModeration, kind 'review') — до одобрения не
 * виден другим клиентам; рейтинг виден сразу. Бизнес может скрыть отзыв из записи (hiddenByBusiness), не
 * удаляя его — см. reports.hideStaffReview/unhideStaffReview (F-12-069).
 */
export interface StaffReview {
  id: Id;
  appUserId: Id;
  staffId: Id;
  businessId: Id;
  bookingId: Id;
  rating: 1 | 2 | 3 | 4 | 5;
  text?: string;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
  hiddenByBusiness?: boolean;
}

/**
 * Типы пушей клиенту (F-14-063 — перечень 1:1 + наши дополнительные из «У нас»). Готовый текст не
 * храним — строка собирается в словаре client.notifications.kind.<kind> из params при показе (F-00-174,
 * F-14-065 — имя отправителя подставляется отдельно из business/staff).
 */
export type NotificationKind =
  | 'booking_created'
  | 'confirm_request'
  | 'client_confirmed_echo'
  | 'booking_reminder'
  | 'repeat_invite'
  | 'cancelled_by_master'
  | 'waitlist_slot'
  | 'come_again'
  /** «Понравилось? ★» после визита «Пришёл» (F-05-033, F-00-116) — кнопка «Подробнее» ведёт к звёздочке в записи */
  | 'review_request'
  | 'broadcast'
  /** Личное сообщение клиенту из визита (F-14-074): не рассылка — «Новости» мастера/салона его не глушат */
  | 'direct'
  | 'birthday_greeting'
  | 'discount_new'
  | 'discount_ending'
  /** Квитанция об оплате визита отправлена клиенту (F-14-095) */
  | 'receipt'
  /** Из журнала событий ядра (listClientEvents, core-k3 №3): салон подтвердил, перенёс, удалил запись, мастер задерживается */
  | 'salon_confirmed'
  | 'salon_moved'
  | 'salon_deleted'
  | 'master_delayed'
  | 'prepayment_expired'
  /** В-03: мастер не ответил на заявку вовремя — не «отменил»: клиенту ближайшие окна того же мастера */
  | 'confirmation_expired';

/**
 * Старые записи доп. мест события хранили подпись в имени: «Анна +1», «Гость +2» (F-14-107). Разбираем при показе,
 * данные не трогаем: «Гость» — пустое имя (подпись ставит экран), номер места — отдельно.
 */
export function splitLegacySeatName(name: string | undefined): { name: string; seat?: number } {
  const m = name?.match(/^(.*?)\s\+(\d+)$/);
  if (!m) return { name: name ?? '' };
  return { name: m[1] === 'Гость' ? '' : m[1], seat: Number(m[2]) };
}

/** Одно уведомление в ленте (F-14-055) */
export interface NotificationItem {
  id: Id;
  appUserId: Id;
  kind: NotificationKind;
  businessId: Id;
  staffId?: Id;
  bookingId?: Id;
  /** Параметры для строки перевода: имя, дата, время… */
  params?: Record<string, string | number>;
  createdAt: ISODateTime;
  readAt?: ISODateTime;
}

/**
 * Запись дневника клиента (F-00-122): визиты через приложение попадают сюда сами (`listDiaryEntries`
 * добавляет их из записей «пришёл» на лету, не дублируя тут) — здесь только ручные расходы.
 */
export interface DiaryEntry {
  id: Id;
  appUserId: Id;
  serviceName: string;
  masterName: string;
  date: ISODate;
  amount: Money;
  createdAt: ISODateTime;
}

/** Формат времени в профиле клиента (F-14-061) */
export type TimeFormat = '24' | '12';

/**
 * Локации сети, к которой относится бизнес (F-14-042, F-14-044, F-14-163) — приложено к карте
 * абонемента/сертификата/карты лояльности и к карточке места, когда сеть больше одного филиала.
 * Первый id в `locations` — основная локация сети (её логотип берётся для карт лояльности, F-14-042).
 */
export interface NetworkLocationsInfo {
  networkId: Id;
  networkName: string;
  locations: { businessId: Id; name: string }[];
}

/**
 * Покупка абонемента/сертификата в приложении (В-17): «Купить» не выпускает актив сразу — заявка ждёт
 * ручной оплаты по реквизитам и подтверждения бизнесом, как ручная предоплата записи (В-05, F-00-097).
 * `confirmed` — старое поведение (в т.ч. вся демо-затравка) и обычный путь после подтверждения.
 */
export type PurchaseStatus = 'pendingConfirmation' | 'confirmed' | 'rejected';

/**
 * Абонемент клиента (F-14-037…039, F-14-045…047, F-00-197). Ядро (Business/Service) абонементов пока не
 * знает — тип живёт здесь как черновик до появления модели в разделе loyalty (см. qa/requests/client.md).
 */
export interface Membership {
  id: Id;
  appUserId: Id;
  businessId: Id;
  /** Название типа абонемента, например «10 визитов к барберу» — показывать через pickText */
  title: LocalizedText;
  /** Номер абонемента — показывается клиенту, не редактируется */
  number: string;
  visitsTotal: number;
  visitsLeft: number;
  /** Стоимость абонемента целиком — нужна для формулы «выгоды» (F-14-020) */
  price: Money;
  validUntil: ISODate;
  /** Заморожен сейчас? (❄️, F-14-038) */
  frozen: boolean;
  /** На сколько дней можно заморозить ещё — undefined, если тип абонемента не разрешает заморозку */
  freezeDaysAvailable?: number;
  /** Названия услуг, на которые действует абонемент */
  serviceNames: string[];
  imageUrl?: string;
  /** Продаётся ли этот тип абонемента сейчас (F-14-045: «Renew» ведёт на список, если снят с продажи) */
  onSale: boolean;
  autoRenew: boolean;
  purchasedAt: ISODateTime;
  /** Абонемент полностью израсходован (0 визитов) — из общего списка скрывается (F-14-037) */
  active: boolean;
  /** В-17: заявка на покупку до подтверждения оплаты бизнесом — не даёт визитов, пока не 'confirmed' */
  purchaseStatus: PurchaseStatus;
  /** В-17: клиент нажал «Я оплатил» — таймер/ожидание останавливается, дальше решает бизнес */
  paymentSentAt?: ISODateTime;
}

/** Подарочный сертификат клиента (F-14-040, F-00-196) */
export type CertificateAppliesTo = 'anything' | 'services' | 'products';

export interface GiftCertificate {
  id: Id;
  appUserId: Id;
  businessId: Id;
  number: string;
  /** Номинал сертификата */
  faceValue: Money;
  /** Остаток — только для многоразового списания; для одноразового равен faceValue до использования */
  balance: Money;
  usesLimit: 'once' | 'multiple';
  validUntil: ISODate;
  appliesTo: CertificateAppliesTo;
  imageUrl?: string;
  purchasedAt: ISODateTime;
  /** Полностью израсходован — из списка «Gift cards» скрывается, но открывается из записи (F-14-040) */
  active: boolean;
  /** В-17: заявка на покупку до подтверждения оплаты бизнесом — списывать нельзя, пока не 'confirmed' */
  purchaseStatus: PurchaseStatus;
  /** В-17: клиент нажал «Я оплатил» */
  paymentSentAt?: ISODateTime;
}

/** Правило начисления кэшбэка, привязанное к карте лояльности (F-14-051) */
export type CashbackEarnKind = 'fixed' | 'per_visit_count' | 'per_spend_sum' | 'per_visit_spend';

export interface CashbackEarnRule {
  kind: CashbackEarnKind;
  /** Текущий процент/сумма начисления */
  rate: number;
  isPercent: boolean;
  /** Сколько визитов/суммы нужно ещё до следующего уровня — только для накопительных видов */
  toNextLevel?: number;
  /** Ограничение: конкретные услуги (undefined — без ограничения) */
  limitedToServiceNames?: string[];
  limitedToProducts?: boolean;
}

/** На что можно потратить кэшбэк (F-14-050) */
export type CashbackSpendScope = 'anything' | 'services' | 'products' | 'blocked';

export interface CashbackCard {
  id: Id;
  appUserId: Id;
  businessId: Id;
  cardNumber: string;
  balance: Money;
  /** Показывать ли кэшбэк этой карты в приложении — настройка типа карты (F-14-053), здесь черновик-флаг */
  visible: boolean;
  spendScope: CashbackSpendScope;
  spendLimitedToServiceNames?: string[];
  /** Лимит оплаты баллами: фиксированной суммой или процентом чека — одно из двух */
  spendLimitMoney?: Money;
  spendLimitPercent?: number;
  earnRules: CashbackEarnRule[];
  /** Текстовая скидка/акция карты, показывается в блоке «Discounts» (F-14-054) */
  discountText?: string;
}

/** Строка списания лояльности в оплате записи (F-14-019) */
export type PaymentLineKind = 'discount' | 'personal_account' | 'gift_card' | 'cashback' | 'membership';

export interface BookingPaymentLine {
  kind: PaymentLineKind;
  label: string;
  amount: Money;
  /** Куда ведёт нажатие — сертификат/абонемент/кэшбэк, id из соответствующего списка */
  linkTo?: { type: 'certificate' | 'membership' | 'cashback'; id: Id };
}

/** Товар, проданный клиенту во время визита (F-14-024, F-00-138) — название локализовано через ключ i18n */
export interface BookingProductLine {
  nameKey: 'homeCareProduct';
  price: Money;
}

/** Расчёт оплаты записи целиком (F-14-018…025) — считается из мока детерминированно по id записи */
export interface BookingPaymentBreakdown {
  total: Money;
  paid: Money;
  lines: BookingPaymentLine[];
  /** Выгода от оплаты абонементом (F-14-020) — не показывается, если выгоды нет */
  membershipSavings?: Money;
  cashbackEarned: Money;
  products: BookingProductLine[];
  /** Запись оплачена абонементом (F-14-025) */
  paidByMembership: boolean;
}

/** Детерминированный хеш строки в целое (для мокового расчёта, без рандома при каждом рендере) */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Расчёт оплаты записи для клиента (F-14-019…024): списания лояльности отдельными строками, выгода
 * абонемента, начисленный кэшбэк, купленные товары, правила «Оплачено» у отменённой/«не пришёл».
 * Считается детерминированно из id записи — стабильно между рендерами одной и той же записи.
 */
export function bookingPaymentBreakdown(input: {
  bookingId: Id;
  total: Money;
  status: 'scheduled' | 'awaiting_confirmation' | 'awaiting_prepayment' | 'client_confirmed' | 'arrived' | 'no_show' | 'cancelled_by_client' | 'cancelled_by_master';
  seats: number;
  paidByMembership: boolean;
  membershipTotalPrice?: Money;
  membershipVisits?: number;
}): BookingPaymentBreakdown {
  const h = hashId(input.bookingId);
  const isCancelled = input.status === 'cancelled_by_client' || input.status === 'cancelled_by_master';
  const isPastVisit = input.status === 'arrived' || input.status === 'no_show';

  const lines: BookingPaymentLine[] = [];
  let membershipSavings: Money | undefined;
  let cashbackEarned: Money = 0;
  const products: BookingProductLine[] = [];

  // F-14-022: у отменённой оплаченной записи «Оплачено 0» — списания и начисления не показываются
  if (!isCancelled && isPastVisit) {
    if (input.paidByMembership && input.membershipTotalPrice && input.membershipVisits) {
      const perVisit = input.membershipTotalPrice / input.membershipVisits;
      const savings = input.total - perVisit;
      if (savings > 0) membershipSavings = Math.round(savings);
      lines.push({ kind: 'membership', label: '', amount: perVisit, linkTo: { type: 'membership', id: input.bookingId } });
    } else {
      // строки списаний — мокаются по хешу, чтобы часть записей была «без лояльности» (F-14-019 §Готово когда)
      if (h % 5 === 0) lines.push({ kind: 'discount', label: '', amount: Math.round(input.total * 0.1) });
      if (h % 7 === 0) lines.push({ kind: 'personal_account', label: '', amount: Math.min(input.total, 500) });
      if (h % 6 === 0) lines.push({ kind: 'gift_card', label: '', amount: Math.round(input.total * 0.3), linkTo: { type: 'certificate', id: input.bookingId } });
      if (h % 4 === 0) lines.push({ kind: 'cashback', label: '', amount: Math.min(input.total, 200), linkTo: { type: 'cashback', id: input.bookingId } });
    }
    // F-14-021: начисленный кэшбэк за визит — одной строкой, только у прошедшего оплаченного визита
    if (h % 3 !== 0) cashbackEarned = Math.round(input.total * 0.03);
    // F-14-024: товары, проданные во время визита — только оплаченного визита, из окна визита
    if (h % 8 === 0) products.push({ nameKey: 'homeCareProduct', price: 3500 });
  }

  const linesTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const paid = isCancelled ? 0 : Math.max(0, input.total - linesTotal);

  return {
    total: input.total * input.seats,
    paid,
    lines,
    membershipSavings,
    cashbackEarned,
    products,
    paidByMembership: input.paidByMembership,
  };
}

/**
 * Тип абонемента, доступный к покупке в приложении (F-14-043, F-14-044). Раздел loyalty ещё не
 * завёл каталог типов абонементов — черновик здесь до появления настоящего каталога (см. qa/requests/client.md).
 */
export interface MembershipTemplate {
  id: Id;
  businessId: Id;
  /** Показывать через pickText */
  title: LocalizedText;
  visitsTotal: number;
  price: Money;
  validDays: number;
  serviceNames: string[];
  imageUrl?: string;
  onSale: boolean;
}

/** Тип сертификата, доступный к покупке в приложении (F-14-043, F-14-044) */
export interface CertificateTemplate {
  id: Id;
  businessId: Id;
  faceValue: Money;
  validDays: number;
  usesLimit: 'once' | 'multiple';
  appliesTo: CertificateAppliesTo;
  onSale: boolean;
}

// ─────────────────────────── Сторис, новости, продвижение (b05: F-00-103, F-00-114, F-00-121, F-00-155…167, F-14-032…036, F-14-172) ───────────────────────────

/** Язык картинки сторис — до двух сразу (F-00-158) */
export type StoryLang = 'ru' | 'hy' | 'en';

/** Откуда картинка сторис (F-00-155, F-14-034): шаблон — без проверки (F-00-168/169); своя фотография — ждёт ручной проверки platform */
export type StoryKind = 'generated' | 'photo';

export type StoryStatus =
  /** Своя фотография ждёт ручной проверки (F-00-168) */
  | 'pending_review'
  /** Показывается сейчас */
  | 'active'
  /** Отклонена на проверке — монеты возвращены (F-14-036) */
  | 'rejected'
  /** Срок показа истёк */
  | 'expired'
  /** Куплена, когда все места были заняты — ждёт свободного места (F-00-160) */
  | 'queued';

/** Одна картинка/окно на генерируемой сторис (F-00-156, F-00-157) — салон может показать несколько мастеров сразу */
export interface StorySlotWindow {
  staffId?: Id;
  /** Имя мастера — только если showStaffNames включён (F-00-157) */
  staffName?: string;
  label: string;
}

/**
 * Платная сторис вверху главной приложения клиента (F-00-159): за монеты, показывается ВСЕМ, а не только
 * подписчикам. Фиксированное число мест одновременно (F-00-160); дороже вставшим в очередь. Своя картинка
 * ждёт проверки (F-14-034), шаблон — сразу (F-00-168/169).
 */
export interface Story {
  id: Id;
  businessId: Id;
  kind: StoryKind;
  /** Готовая картинка (data: URL) — сгенерированная 1080×1920 или своя загруженная */
  imageUrl: string;
  lang: StoryLang[];
  /** У салона — окна по мастерам с именами; у индивидуала по умолчанию имя не показывается (F-00-157) */
  showStaffNames: boolean;
  windows: StorySlotWindow[];
  /** Ссылка на запись из кнопки «Записаться» — своя форма или конкретный мастер/услуга (F-14-035) */
  bookingTarget?: { staffId?: Id; serviceId?: Id };
  /** Подпись миниатюры своей фотографии — необязательна, до 70 символов, поверх картинки (F-14-034) */
  caption?: string;
  /** Мастер салона опубликовал от своего профиля (владелец, 01.10.2026); нет — сторис салона */
  authorStaffId?: Id;
  /** Пометка «Реклама» видна всегда — сторис платная и показывается всем (F-00-162) */
  status: StoryStatus;
  price: Money;
  createdAt: ISODateTime;
  /** Когда показ закончится (обычно +24 ч от активации) — исчезает сама (F-00-159) */
  expiresAt?: ISODateTime;
  viewCount: number;
  clickCount: number;
  bookingCount: number;
}

/** Новость подписчикам (F-00-114) — фан-аут в ленту (`NotificationItem.kind = 'broadcast'`) хранится отдельно от текста поста, чтобы считать «до 3 в неделю» по постам, а не по числу подписчиков */
export interface NewsPost {
  id: Id;
  businessId: Id;
  text: string;
  photoUrl?: string;
  createdAt: ISODateTime;
  /** Сверх лимита 3/нед — оплачено монетами (F-00-027, предл.) */
  paidWithCoins: boolean;
  /**
   * Проверка нашей панелью (F-00-168): pending_review — ждёт, sent — одобрена и разослана подписчикам, rejected — отклонена.
   * Нет поля — старая новость, уже разосланная.
   */
  status?: 'pending_review' | 'sent' | 'rejected';
  sentAt?: ISODateTime;
}

/**
 * Продвижение бизнеса (F-00-103 скидка на горящее окно; F-00-167 «выше в поиске» / «место на главной» —
 * черновик, решения нет). Ключ — id бизнеса.
 */
export interface PromotionSettings {
  /** Скидка на горящее окно — свободное окно на сегодня (F-00-103); не решено, есть ли скидка вообще */
  hotSlotDiscountPercent?: number;
  boostSearch?: { active: boolean; expiresAt: ISODateTime };
  boostHome?: { active: boolean; expiresAt: ISODateTime };
}

/**
 * Монеты бизнеса — черновик кошелька (у settings/coins пока только заглушка, см. qa/requests/client.md):
 * тратятся на сторис сверх лимита, новости сверх 3/нед, «выше в поиске». Ключ — id бизнеса.
 */
export type CoinBalances = Record<Id, number>;

/**
 * Готовая картинка сторис 1080×1920 (F-00-155, F-00-156) — SVG инлайн, без внешней сети. Чистая функция
 * (без React/api/mock) — зовётся и из seed (mock/slices/client.ts), и из api/client.ts при генерации.
 * 05.10.2026 (скриншоты для магазинов): на главной клиента сторис — карточка шириной ~110 px, текст 44 px из
 * 1080 там был не виден. Теперь крупно: заголовок («Свободно сегодня») до 170 px, время — белыми «таблетками»,
 * имя мастера над ними; главное — в верхних 60 % (низ карточки закрыт подписью «Реклама» и именем салона).
 * Строки ещё лежат в <desc> — по ним картинку пересобирает relocalizeStoryImage (демо-данные на языке интерфейса).
 */
export function generateStoryImage(input: { businessName: string; lines: string[]; lang: string }): string {
  const W = 1080;
  const PAD = 80;
  const INNER = W - PAD * 2;
  /** Средняя ширина знака в долях кегля — с запасом для армянского */
  const CHAR = 0.6;
  const FONT = `font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Armenian', sans-serif"`;
  const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fit = (text: string, max: number) => Math.max(28, Math.min(max, Math.floor(INNER / (Math.max(1, Array.from(text).length) * CHAR))));
  const TIMES = /^\d{1,2}:\d{2}(?:,\s*\d{1,2}:\d{2})*$/;
  const out: string[] = [];

  // Название салона
  const nameSize = fit(input.businessName, 76);
  out.push(`<text x="${PAD}" y="230" ${FONT} font-size="${nameSize}" font-weight="700" fill="#fff" fill-opacity="0.92">${escapeXml(input.businessName)}</text>`); // tokens-ok
  out.push(`<rect x="${PAD}" y="290" width="120" height="12" rx="6" fill="#fff" fill-opacity="0.55"/>`); // tokens-ok

  // Заголовок — по словам в строки, кегль до 170 так, чтобы самое длинное слово влезло
  const [head = '', ...rest] = input.lines;
  const words = head.split(/\s+/).filter(Boolean);
  const longest = words.reduce((m, w) => Math.max(m, Array.from(w).length), 1);
  const headSize = Math.min(170, Math.floor(INNER / (longest * CHAR)));
  const perLine = Math.max(1, Math.floor(INNER / (headSize * CHAR)));
  const headLines: string[] = [];
  for (const w of words) {
    const last = headLines[headLines.length - 1];
    if (last !== undefined && Array.from(`${last} ${w}`).length <= perLine) headLines[headLines.length - 1] = `${last} ${w}`;
    else headLines.push(w);
  }
  let y = 380;
  headLines.slice(0, 3).forEach((line) => {
    y += Math.round(headSize * 1.02);
    out.push(`<text x="${PAD}" y="${y}" ${FONT} font-size="${headSize}" font-weight="800" fill="#fff">${escapeXml(line)}</text>`); // tokens-ok
  });
  y += 70;

  // Окна: «Мастер · 10:00, 10:30» → имя и время «таблетками»; прочие строки — просто текстом
  const PILL_H = 116;
  const PILL_FONT = 76;
  for (const line of rest) {
    if (y > 1500) break;
    const sep = line.lastIndexOf(' · ');
    const tail = sep >= 0 ? line.slice(sep + 3) : line;
    const label = sep >= 0 ? line.slice(0, sep) : '';
    if (!TIMES.test(tail)) {
      const size = fit(line, 72);
      y += size;
      out.push(`<text x="${PAD}" y="${y}" ${FONT} font-size="${size}" font-weight="600" fill="#fff">${escapeXml(line)}</text>`); // tokens-ok
      y += 40;
      continue;
    }
    if (label) {
      const size = fit(label, 62);
      y += size;
      out.push(`<text x="${PAD}" y="${y}" ${FONT} font-size="${size}" font-weight="600" fill="#fff" fill-opacity="0.92">${escapeXml(label)}</text>`); // tokens-ok
      y += 28;
    }
    let x = PAD;
    for (const time of tail.split(/,\s*/)) {
      const w = Math.round(time.length * PILL_FONT * CHAR + 72);
      if (x > PAD && x + w > W - PAD) {
        x = PAD;
        y += PILL_H + 20;
      }
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${PILL_H}" rx="${PILL_H / 2}" fill="#fff"/>`); // tokens-ok
      out.push(`<text x="${x + w / 2}" y="${y + 84}" text-anchor="middle" ${FONT} font-size="${PILL_FONT}" font-weight="800" fill="#3B32C9">${escapeXml(time)}</text>`); // tokens-ok
      x += w + 20;
    }
    y += PILL_H + 48;
  }

  const desc = escapeXml(JSON.stringify({ businessName: input.businessName, lines: input.lines, lang: input.lang }));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">` +
    `<desc>bt-story:${desc}</desc>` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#7B6CFF"/><stop offset="0.55" stop-color="#5546E0"/><stop offset="1" stop-color="#2F2A6B"/></linearGradient></defs>` + // tokens-ok
    `<rect width="1080" height="1920" fill="url(#g)"/>` +
    `<circle cx="960" cy="180" r="340" fill="#fff" fill-opacity="0.08"/>` + // tokens-ok
    `<circle cx="80" cy="1560" r="420" fill="#fff" fill-opacity="0.06"/>` + // tokens-ok
    out.join('') +
    // Instagram safe-zone для сторис — ≥250px от нижнего края (1920) (F-00-156)
    `<text x="${PAD}" y="1650" ${FONT} font-size="40" font-weight="700" fill="#fff" fill-opacity="0.6">BookTime</text>` + // tokens-ok
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const STORY_DATA_PREFIX = 'data:image/svg+xml;utf8,';

/**
 * Та же сгенерированная сторис с переведёнными строками (демо-данные на языке интерфейса, mock/seed/demoLocale.ts):
 * строки берутся из <desc>, каждая проходит через translate. Не сторис или переводить нечего — та же строка.
 */
export function relocalizeStoryImage(url: string, translate: (line: string) => string): string {
  if (!url.startsWith(STORY_DATA_PREFIX)) return url;
  let svg: string;
  try {
    svg = decodeURIComponent(url.slice(STORY_DATA_PREFIX.length));
  } catch {
    return url;
  }
  const m = /<desc>bt-story:([^<]*)<\/desc>/.exec(svg);
  if (!m) return url;
  let input: { businessName: string; lines: string[]; lang: string };
  try {
    input = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  } catch {
    return url;
  }
  const businessName = translate(input.businessName);
  const lines = input.lines.map((l) => translate(l));
  if (businessName === input.businessName && lines.every((l, i) => l === input.lines[i])) return url;
  return generateStoryImage({ businessName, lines, lang: input.lang });
}

// ─────────────────────────── b06: своё приложение салона (F-14-142…170) ───────────────────────────
// ⭐ по решению пользователя: делаем ли брендированное приложение под салон — не решено (В-29, F-14-142);
// экран строится как заявка/демо по правилу «1:1» — заявка реальная (уходит в поддержку platform),
// но материалы и статус разработки живут только в этом срезе, ничего не публикуется по-настоящему.

/** На кого регистрировать аккаунт Apple Developer (F-14-153) */
export type BrandedAppOwnerType = 'organization' | 'individual';

/** Как передавать доступ к аккаунтам Altegio (F-14-157) — выбираем безопасный: приглашение в портал */
export type BrandedAppAccessMethod = 'portal_invite' | 'password_shared';

/** Этап заявки на своё приложение (F-14-144…146) */
export type BrandedAppStage = 'draft' | 'submitted' | 'in_development' | 'published';

/**
 * Материалы для публикации (F-14-148…152): заставка, логотип-иконка, названия, описания, картинка Featured.
 * Ограничения по длине символов и требуемые размеры картинок — проверяются на экране до отправки.
 */
export interface BrandedAppMaterials {
  /** 2208×2208 PNG без прозрачности (F-14-148) */
  splashUrl?: string;
  /** 1024×1024 PNG без прозрачности (F-14-149) */
  logoUrl?: string;
  /** 1024×500, только для Google Play (F-14-152) */
  featuredImageUrl?: string;
  /** ≤30 символов (F-14-150) */
  fullName: string;
  /** ≤11 символов (F-14-150) */
  shortName: string;
  /** ≤80 символов (F-14-151) */
  shortDescription: string;
  /** ≤4000 символов (F-14-151) */
  longDescription: string;
  /** ≤100 символов (F-14-151) */
  keywords: string;
}

/** Документы и доступы, без которых заявка не уходит в работу (F-14-147, «добавлено проверкой 1») */
export interface BrandedAppDocsChecklist {
  appleDeveloperAccess: boolean;
  googlePlayAccess: boolean;
  registrationDoc: boolean;
  trademarkDoc: boolean;
}

/** Заявка на брендированное приложение — черновик до отправки, дальше read-only «в работе» (ключ — id бизнеса) */
export interface BrandedAppRequest {
  businessId: Id;
  stage: BrandedAppStage;
  ownerType?: BrandedAppOwnerType;
  accessMethod?: BrandedAppAccessMethod;
  materials: BrandedAppMaterials;
  docs: BrandedAppDocsChecklist;
  /** Ссылки на уже опубликованные приложения бизнеса — предлагаются клиенту после записи (F-14-144) */
  iosLink?: string;
  androidLink?: string;
  /** Число дополнительных филиалов сверх первого — для расчёта годовой цены (F-14-168, F-14-169) */
  extraLocations: number;
  submittedAt?: ISODateTime;
}

export const BRANDED_APP_MATERIALS_EMPTY: BrandedAppMaterials = {
  fullName: '',
  shortName: '',
  shortDescription: '',
  longDescription: '',
  keywords: '',
};

export const BRANDED_APP_DOCS_EMPTY: BrandedAppDocsChecklist = {
  appleDeveloperAccess: false,
  googlePlayAccess: false,
  registrationDoc: false,
  trademarkDoc: false,
};

/** Требования к материалам (F-14-148…152) — используются и на экране, и при проверке перед отправкой */
export const BRANDED_APP_LIMITS = {
  fullName: 30,
  shortName: 11,
  shortDescription: 80,
  longDescription: 4000,
  keywords: 100,
} as const;

/**
 * Годовая цена брендированного приложения (F-14-168 Армения/СНГ, F-14-170 Apple) — ⭐ решение пользователя
 * не принято (В-29); цифры взяты из справки Altegio 1:1 и показаны как демо-ориентир, не утверждённая цена.
 * Курс драма для показа в AMD — демо-оценка (assumed), не курс ЦБ.
 */
export const BRANDED_APP_PRICE_USD = 500;
export const BRANDED_APP_PRICE_PER_LOCATION_USD = 50;
export const BRANDED_APP_APPLE_FEE_USD = 100;
/** Демо-курс для показа цены в драмах на этом экране (assumed) — не привязан к настоящему курсу валют */
export const BRANDED_APP_DEMO_USD_TO_AMD = 400;

/**
 * Запись по абонементу в приложении (F-14-165): визит списывается сразу при подтверждении записи.
 * Ключ — id записи, значение — id абонемента, с которого списали (не даёт списать дважды).
 */
export type MembershipUsedForBooking = Record<Id, Id>;

/** Запрещённое в описаниях (F-14-151): ссылки, телефоны, крупные бренды — простая проверка на экране */
export function checkBrandedAppText(text: string): ('link' | 'phone' | 'brand')[] {
  const issues: ('link' | 'phone' | 'brand')[] = [];
  if (/https?:\/\/|www\./i.test(text)) issues.push('link');
  if (/\+?\d[\d\s()-]{6,}\d/.test(text)) issues.push('phone');
  if (/\b(apple|google|samsung|meta|instagram|facebook|whatsapp|telegram)\b/i.test(text)) issues.push('brand');
  return issues;
}

// ─────────────────────────── Визит, оплата и доступ сотрудника в приложении (F-14-092…098, F-14-116…120) ───────────────────────────

/** Касса для оплаты наличными в визите (F-14-096) — настоящая касса раздела finance (Account вида «наличные»); в моке у
 *  бизнеса без касс — демо «Касса 1–3» (listCashDesks в @/api/client). */
export interface VisitCashDesk {
  id: Id;
  name: string;
}

export type VisitPaymentMethod = 'cash' | 'card' | 'loyalty';

/** Товар/абонемент/сертификат, проданный в визите из приложения (F-14-092) */
export interface VisitSaleLine {
  id: Id;
  bookingId: Id;
  kind: 'product' | 'membership' | 'certificate';
  title: string;
  price: Money;
  discount: number;
  sellerStaffId?: Id;
  /** Код абонемента/сертификата — сгенерирован или введён вручную */
  code?: string;
}

/** Оплата визита в приложении, частями (F-14-094…097) */
export interface VisitPaymentLine {
  id: Id;
  bookingId: Id;
  method: VisitPaymentMethod;
  amount: Money;
  cashDeskId?: Id;
  cardBrand?: 'visa' | 'mastercard' | 'arca';
  commissionPercent?: number;
  createdAt: ISODateTime;
  refundedAt?: ISODateTime;
}

/** Типы пушей команде в приложении (F-14-131, F-14-132) */
export type StaffPushType = 'bookings' | 'calls' | 'reviews' | 'payroll' | 'news';

export const STAFF_PUSH_TYPES: StaffPushType[] = ['bookings', 'calls', 'reviews', 'payroll', 'news'];

/** Доступ сотрудника к расчёту ЗП в приложении (F-14-127, F-14-128) */
export type PayrollAppAccess = 'none' | 'self' | 'all';

/**
 * Доступ сотрудника в приложении: только свои записи, скрытие контактов клиента, право на аналитику
 * (F-14-119, F-14-120, F-14-125); пуши команде (F-14-131, F-14-132); доступ к зарплате (F-14-127, F-14-128);
 * двухэтапный вход (F-14-135).
 */
export interface EmployeeAppAccess {
  onlyOwnBookings: boolean;
  hideClientContacts: boolean;
  analyticsAllowed: boolean;
  /** Владелец включил пуши сотруднику в кабинете — без этого сотрудник не может включить их сам (F-14-131) */
  pushEnabledByOwner: boolean;
  /** Какие типы пушей владелец разрешил (кабинет) — сотрудник переключает только внутри этого набора (F-14-131) */
  pushTypesAllowed: StaffPushType[];
  /** Какие из разрешённых типов сотрудник включил себе сам (F-14-132) */
  pushTypesOn: StaffPushType[];
  /** Не отправлять сотруднику имя и телефон клиента в уведомлениях (F-14-131) */
  hideClientDataInPush: boolean;
  /** Доступ к расчёту ЗП в приложении: скрыт / только свой / все сотрудники (F-14-128) */
  payrollAccess: PayrollAppAccess;
  /** Ограничение «только текущий день» — без недельного календаря и периода (F-14-128) */
  payrollCurrentDayOnly: boolean;
  /** Двухэтапная проверка входа пушем/письмом включена сотруднику (F-14-135) */
  twoStepLoginEnabled: boolean;
}

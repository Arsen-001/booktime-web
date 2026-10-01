/**
 * Типы раздела «settings» — подписка, монеты, биллинг, быстрый старт, настройки компании.
 * Файл принадлежит разделу. Цены и сроки — движок в src/api/settings.ts.
 */
import type {
  BusinessKind,
  Id,
  ISODate,
  ISODateTime,
  Money,
} from '@/domain/core';

/** Способ последней оплаты подписки (⭐ F-00-018/145…): всё моковое, реального биллинга нет */
export type SubscriptionPaymentMethod =
  'card' | 'promo' | 'freeMonth' | 'platform';
export type SubscriptionPaymentStatus = 'success' | 'failed' | 'pending';

/** Запись «Истории лицензии» (F-15-072) */
export interface SubscriptionPayment {
  id: Id;
  businessId: Id;
  date: ISODateTime;
  periodMonths: number;
  amount: Money;
  method: SubscriptionPaymentMethod;
  status: SubscriptionPaymentStatus;
  /** Счёт/чек этой оплаты (F-15-073) — «Открыть чек» ведёт на /biz/billing/invoices/[invoiceId] */
  invoiceId?: Id;
}

export type InvoicePurpose = 'subscription' | 'coins' | 'ads';
export type InvoiceStatus = 'paid' | 'unpaid' | 'cancelled';

/** Выставленный счёт (F-15-087) */
export interface Invoice {
  id: Id;
  businessId: Id;
  number: string;
  purpose: InvoicePurpose;
  amount: Money;
  status: InvoiceStatus;
  date: ISODateTime;
  /** Период подписки, который покрывает счёт (F-15-088) */
  periodFrom?: ISODate;
  periodTo?: ISODate;
  method?: SubscriptionPaymentMethod;
  /** Реквизиты плательщика на момент выставления (F-15-088) — снимок, не ссылка на текущие данные компании */
  payer?: InvoicePayer;
}

/**
 * Подписка бизнеса — одна на businessId (⭐ F-15-044: у сети своя подписка на каждый филиал, тоже
 * ключ businessId, потому что филиал = отдельный Business). Цена и занятые места СЧИТАЮТСЯ, не хранятся —
 * quotePrice()/getSeats() в api/settings.ts. Здесь — только то, что не выводится из ядра.
 */
export interface Subscription {
  businessId: Id;
  /** Оплачено до (F-15-070/091) */
  paidUntil: ISODate;
  autoRenew: boolean;
  /** Заморожен за неоплату (F-00-024) */
  frozen: boolean;
  /** Бесплатный месяц от подключения на визите (F-00-019, F-15-058) — до какой даты */
  freeMonthUntil?: ISODate;
  /** Пробный период 7 дней у бизнеса, зарегистрированного самостоятельно (F-00-019, решение владельца 01.10.2026) */
  trialUntil?: ISODate;
  /** Личный одноразовый промокод, применённый при регистрации (⭐ Снято 16 — скидка только так) */
  promoApplied?: string;
  /** Скидка промокода в процентах (10/15/25) — только пока не потрачена (F-15-062/063, F-00-021) */
  promoDiscountPercent?: number;
  /** Промокод уже потрачен на одну оплату — дальше цена обычная (F-00-021) */
  promoUsed?: boolean;
  /** Сохранённый способ оплаты для автопродления (F-15-082) */
  savedPaymentMethod?: SavedPaymentMethod;
  /** «Документы об оплате на почту» (F-15-093) — по умолчанию включено, право billing.manage */
  paymentDocsEmail?: boolean;
}

/** Способ оплаты подписки (F-00-022, F-15-083/084) */
export type BillingPaymentMethod = 'card' | 'idram' | 'telcell' | 'invoice';

/** Сохранённый способ оплаты — маска карты/номера, доступность (F-15-082/090) */
export interface SavedPaymentMethod {
  method: BillingPaymentMethod;
  label: string;
  /** Способ временно недоступен (например банк отключил приём) — предупреждение перед оплатой (F-15-090) */
  unavailable?: boolean;
}

/** Реквизиты и адрес плательщика для счёта (F-15-088) */
export interface InvoicePayer {
  name: string;
  address: string;
  taxId?: string;
}

/** Язык сообщений и интерфейса — только три (⭐ F-00-172) */
export type SettingsLang = 'ru' | 'hy' | 'en';

/** Ключ моментального снимка поля бренда/фото на проверке (F-00-168) — 'brand' | 'logo' | url фото галереи */
export type ModerationRefKey = string;

/** Сущность, о событиях которой можно слать вебхук (F-15-119) */
export type WebhookEntity =
  | 'location'
  | 'staff'
  | 'goods'
  | 'services'
  | 'serviceCategories'
  | 'clients'
  | 'bookings'
  | 'loyaltyEvents'
  | 'goodsSales';

/**
 * «Для разработчиков» (F-15-119) — решение «дадим ли мы вебхуки» ещё не принято (00-decisions: ❓), поэтому
 * экран — демо-интерфейс на моках 1:1 с Altegio, без реальной отправки. Одна запись на businessId.
 */
export interface WebhookSettings {
  businessId: Id;
  enabled: boolean;
  url?: string;
  entities: WebhookEntity[];
}

/** Основные («системные») настройки компании (F-15-113…117, F-15-030, F-15-136) — одна запись на businessId */
export interface SystemSettings {
  businessId: Id;
  /** Город (F-15-115) — Yerevan по умолчанию */
  city: string;
  /** Формат даты и времени (F-15-116) — 24ч по умолчанию (⭐ Армения) */
  dateTimeFormat: '24' | '12';
  /** Язык автосообщений клиентам (F-15-136) — один на локацию, не язык интерфейса сотрудника (F-15-134) */
  messageLanguage: SettingsLang;
  /** Уточнение вида деятельности внутри сферы (F-15-030) — свободный текст */
  sphereSubtype?: string;
}

/** Системная (несъёмная) категория записи (F-15-122) */
export type SystemRecordCategoryKey =
  'fullPrepay' | 'partialPrepay' | 'specialistImportant' | 'anySpecialist';

/** Категория записи — 4 системных (нельзя править/удалить) + свои (F-15-121…124) */
export interface RecordCategory {
  id: Id;
  businessId: Id;
  name: string;
  /** Индекс токена chart-N (см. ColorPicker), 1..8 */
  colorIndex: number;
  /** Имя иконки lucide (см. src/shell/icons.ts) — только у своих категорий */
  icon?: string;
  system?: boolean;
  systemKey?: SystemRecordCategoryKey;
}

/** Пакет монет на /biz/coins (F-00-026); цены пока не решены владельцем — пометка на экране */
export interface CoinPackage {
  id: string;
  coins: number;
  price: Money;
  /** Бонусный процент монет у большого пакета */
  bonusPercent?: number;
  popular?: boolean;
}

/** Тип плательщика (F-15-112) */
export type LegalEntityType = 'legalEntity' | 'soleProprietor';

/** Юридические реквизиты компании (F-15-112, F-15-085/086) — подставляются в счёт на подписку и в чек клиенту */
export interface LegalInfo {
  entityType?: LegalEntityType;
  companyName?: string;
  /** ՀՎՀՀ — 8 цифр (F-15-085, армянский аналог НДС-номера) */
  taxId?: string;
  legalAddress?: string;
  /** Адрес для счёта, если отличается от юридического (F-15-088) */
  billingAddress?: string;
  bankName?: string;
  bankAccount?: string;
  correspondentAccount?: string;
  /** Налоговые данные плательщика для Nota Fiscal — только Бразилия, демо (F-07-179) */
  payerTax?: PayerTaxInfo;
}

/** Тип плательщика Nota Fiscal (F-07-179): компания платит CNPJ, по умолчанию */
export type PayerTaxType = 'business' | 'individual';

/**
 * Данные плательщика для бразильской Nota Fiscal при оплате подписки Altegio (F-07-179, демо —
 * функция видна только в бразильском кабинете на странице оплаты подписки). Адрес — отдельными
 * полями по ТЗ, не одной строкой.
 */
export interface PayerTaxInfo {
  type: PayerTaxType;
  /** 14 цифр — только при type === 'business' */
  cnpj?: string;
  /** 11 цифр — только при type === 'individual' */
  cpf?: string;
  /** Имя физлица; для CNPJ используется LegalInfo.companyName */
  fullName?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** Шаги чек-листа быстрого старта (F-15-022) — порядок важен, порядок = порядок в UI */
export type OnboardingStepId =
  'services' | 'staff' | 'staffServices' | 'schedule' | 'online' | 'profile';

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
  href: string;
}

/** Одно поле в расчёте заполненности профиля (F-15-023) */
export interface ProfileField {
  id: 'name' | 'description' | 'logo' | 'contacts' | 'photos' | 'legal';
  done: boolean;
}

export interface CompanyProfileSummary {
  businessId: Id;
  kind: BusinessKind;
  fields: ProfileField[];
  /** 0–100 */
  percent: number;
}

/** Суффикс settings.billing.seatReason.* — почему место платное/бесплатное */
export type SeatReason =
  | 'individual'
  | 'ownerAsMaster'
  | 'ownerFree'
  | 'adminFirstFree'
  | 'adminExtra'
  | 'master'
  /** F-09-044: отдельный ассистент («Только просмотр», без графика) — бесплатное место */
  | 'assistantFree'
  /** С9 обзора «Сотрудники»: приглашённый мастер не платный, пока не принял приглашение */
  | 'invitedPending';

/** Одно место в расчёте цены (F-15-033/034/045/047, F-00-013/014/016) */
export interface SeatLine {
  staffId: Id;
  name: string;
  role: 'owner' | 'admin' | 'master';
  paid: boolean;
  price: Money;
  reasonKey: SeatReason;
}

/** Ключ строки разбивки — суффикс settings.billing.breakdown.* (F-15-033/041) */
export type PriceBreakdownKey =
  | 'billing.breakdown.individual'
  | 'billing.breakdown.masters'
  | 'billing.breakdown.minimum'
  | 'billing.breakdown.admins';

/** Разбивка суммы подписки на «из чего складывается» (F-15-033/041) */
export interface PriceBreakdownLine {
  labelKey: PriceBreakdownKey;
  count: number;
  unitPrice: Money;
  amount: Money;
}

export interface PriceQuote {
  businessId: Id;
  kind: BusinessKind;
  months: number;
  seats: SeatLine[];
  breakdown: PriceBreakdownLine[];
  monthlyTotal: Money;
  /** Итог без скидки (F-00-021 «дальше — по полной цене») */
  regularTotal: Money;
  /** Итог со скидкой промокода, если он ещё не потрачен (F-15-062/063) */
  total: Money;
  discountPercent?: number;
  discountAmount?: Money;
  /** Остаток пробного (бесплатного) срока в днях, прибавляемый к купленному (F-15-059) */
  freeMonthDaysCarried?: number;
}

export type SubscriptionWarningLevel = 'info' | 'warning' | 'danger';

/** Полоса предупреждений об окончании подписки (F-00-023, F-15-064/058) */
export interface SubscriptionWarning {
  level: SubscriptionWarningLevel;
  daysLeft: number;
  messageKey: 'billing.warning.frozen' | 'billing.warning.endingSoon';
}

/** Тема обращения в поддержку (F-15-001) */
export type HelpRequestTopic =
  'billing' | 'settings' | 'staff' | 'bug' | 'other';
export type HelpRequestStatus = 'open' | 'answered' | 'closed';

/** Обращение в поддержку — вход «из любого экрана кабинета» (F-15-001). Полноценная переписка — b05. */
export interface HelpRequest {
  id: Id;
  businessId: Id;
  authorStaffId: Id;
  topic: HelpRequestTopic;
  message: string;
  createdAt: ISODateTime;
  status: HelpRequestStatus;
}

/**
 * Заявка на консультацию по своему брендированному приложению салона (F-03-048, F-14-164, F-14-171, В-29):
 * своё приложение в App Store и Google Play — будущая платная услуга, пока только «оставить заявку»,
 * отвечает менеджер. Тот же статус, что у обращений в поддержку.
 */
export interface MobileAppOrderRequest {
  id: Id;
  businessId: Id;
  authorStaffId: Id;
  createdAt: ISODateTime;
  status: HelpRequestStatus;
}

/** Заявка «Моей сферы нет» (F-15-005, F-00-145…148) — свободный текст, отвечает поддержка; тот же статус, что у обращений */
export interface SphereRequest {
  id: Id;
  businessId: Id;
  authorStaffId: Id;
  name: string;
  message?: string;
  createdAt: ISODateTime;
  status: HelpRequestStatus;
  /** «Что нужно», чтобы сфера появилась (F-00-152) — заполняется, когда заявку принимают в работу (status = answered) */
  checklist?: SphereRequestChecklistItem[];
  /** Срок готовности (F-00-152), заполняется вместе с чек-листом */
  etaDate?: ISODate;
  /** Сфера готова — годовая подписка на неё начинается с этого дня (F-00-152) */
  readyAt?: ISODateTime;
}

/** Раздел общих настроек компании, который правили (F-15-180) — суффикс settings.history.section.* */
export type SettingsChangeSection =
  'brand' | 'contacts' | 'gallery' | 'legal' | 'system' | 'categories';

/** Одна запись журнала изменений настроек компании (F-15-180) — «кто, когда, было → стало» */
export interface SettingsChangeLogEntry {
  id: Id;
  businessId: Id;
  section: SettingsChangeSection;
  /** Ключ поля — суффикс settings.history.field.* (например 'name', 'phone', 'dateTimeFormat') */
  fieldKey: string;
  before: string;
  after: string;
  staffId: Id;
  staffName: string;
  at: ISODateTime;
}

/** Одно изменение правил оплаты подписки (F-15-048/056/066) — объявляется заранее, действует с новой покупки */
export interface PriceRuleChange {
  id: Id;
  /** Дата, с которой действуют новые условия (F-15-048) */
  effectiveFrom: ISODate;
  /** Дата объявления (заранее — правило анонса, F-15-056) */
  announcedAt: ISODate;
  /** Ключ описания — суффикс settings.terms.priceChange.* */
  descriptionKey: string;
  oldPrice: Money;
  newPrice: Money;
  /** Ещё не наступило — можно продлить по старой цене до effectiveFrom (F-15-066) */
  upcoming?: boolean;
}

/** «Что нужно», чтобы открыть заказанную сферу (F-00-152) — свободный шаг чек-листа платформы */
export interface SphereRequestChecklistItem {
  id: string;
  /** Ключ шага — суффикс settings.sphereRequest.checklistStep.* (например 'catalog', 'terms', 'icons') */
  labelKey: string;
  done: boolean;
}

/** Кому шлётся приглашение по ссылке (F-15-146): мастер — по номеру и коду, администратор — логином/паролем от владельца */
export type OnboardingInviteRole = 'admin' | 'master';
/** ⭐ демо-признак «получатель уже был у нас»: определяет, какую форму открывает ссылка (регистрация / вход) */
export type OnboardingInviteAudience = 'new' | 'existing';
export type OnboardingInviteStatus = 'pending' | 'accepted' | 'revoked';

/**
 * Приглашение в локацию по ссылке (F-15-146). Пока это свой, упрощённый мок раздела settings — постоянная
 * привязка к настоящему приглашению сотрудника (`StaffInvite`, `src/api/staff.ts`) не сделана, см.
 * `qa/requests/settings.md`.
 */
export interface OnboardingInvite {
  token: Id;
  businessId: Id;
  businessName: string;
  role: OnboardingInviteRole;
  audience: OnboardingInviteAudience;
  phone?: string;
  email?: string;
  status: OnboardingInviteStatus;
  createdAt: ISODateTime;
}

// ─────────────────────────── Личный кабинет пользователя (F-15-147…158, b05) ───────────────────────────
// Аккаунт человека, не карточка сотрудника: почта/телефон-логин, письма, приватность, стартовая страница,
// удаление. Пока один Staff = один аккаунт (по одному businessId) — межбизнесовый общий аккаунт не сделан,
// см. qa/requests/settings.md.

/** Три письма/пуша, которыми управляет пользователь (F-15-153); служебные — не отключаются этим блоком */
export interface NotificationPrefs {
  news: boolean;
  marketing: boolean;
  system: boolean;
}

/** Куда попадает человек сразу после входа (F-15-157) */
export type StartPage = 'journal' | 'clients' | 'analytics' | 'settings';

/** Один запрос на выгрузку своих данных (F-15-154) — не чаще раза в сутки, готовность до 24 часов */
export interface DataExportRequest {
  id: Id;
  requestedAt: ISODateTime;
  /** Готова ли ссылка (в демо — сразу true, чтобы можно было показать результат) */
  ready: boolean;
}

/** Один вход в кабинет — для журнала входов (F-15-159) */
export interface LoginEvent {
  id: Id;
  at: ISODateTime;
  device: string;
  /** Город по IP (демо — из локации сотрудника) */
  location: string;
  current?: boolean;
}

/** Личные настройки человека — одна запись на staffId (F-15-147…158) */
export interface PersonalAccount {
  staffId: Id;
  notificationPrefs: NotificationPrefs;
  /** Двухэтапная проверка входа email/пуш-кодом (F-15-159) — у мастера/владельца вход уже по коду (F-00-033) */
  twoFactorEnabled?: boolean;
  /** Журнал входов: кто, когда, с какого устройства (F-15-159) — последние сверху */
  loginHistory: LoginEvent[];
  /** Почта подтверждена переходом по ссылке (F-15-150) */
  emailVerified: boolean;
  /** Письмо подтверждения отправлено, ссылку ещё не открывали (демо: кнопка «Я перешёл по ссылке») */
  emailConfirmSentAt?: ISODateTime;
  /** «Завершить все сеансы» — все сессии кроме текущей закрыты после этого момента (F-15-152) */
  sessionsTerminatedAt?: ISODateTime;
  dataExportRequests: DataExportRequest[];
  /** Запрос на блокировку данных подан и ждёт рассмотрения (F-15-155) */
  dataBlockRequestedAt?: ISODateTime;
  /** Аккаунт поставлен на удаление — наступит через 25 дней, можно отменить (F-15-158) */
  deletionRequestedAt?: ISODateTime;
  /** Стартовая локация и страница после входа (F-15-157) — нет значения, локация/сеть одна или страница = «Журнал» */
  startLocationId?: Id;
  startPage?: StartPage;
}

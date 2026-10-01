/**
 * Типы раздела «integrations» (F-13-*, пачка b01 — каркас, витрина, «Установлено», карточка приложения,
 * подключение/отключение). Файл принадлежит разделу. Ссылки на ядро — по Id (import type { Id } from '@/domain/core').
 *
 * Раздел — ТОЛЬКО интерфейс: ни одного настоящего подключения или запроса наружу (qa/plan/integrations.md).
 */
import type { Id, ISODateTime } from '@/domain/core';
import { addMinutes } from '@/lib/date';

// ─────────────────────────── Категории (F-13-004) ───────────────────────────

/** 11 видимых категорий + 2 скрытые (чат-боты, чаевые) — открываются только прямой ссылкой */
export type IntegrationCategoryId =
  | 'notifications'
  | 'telephony'
  | 'marketing'
  | 'social'
  | 'widgets'
  | 'analytics'
  | 'accounting'
  | 'maps'
  | 'payments'
  | 'fiscal'
  | 'other'
  | 'chatbots'
  | 'tips'
  // b04: F-13-106 «ИИ-боты и ассистенты», F-13-178…181 «CRM», F-13-183 «Персонал» — новые видимые категории
  | 'aiAssistants'
  | 'crm'
  | 'personnel';

export const VISIBLE_CATEGORY_IDS: IntegrationCategoryId[] = [
  'notifications',
  'telephony',
  'marketing',
  'social',
  'widgets',
  'analytics',
  'accounting',
  'maps',
  'payments',
  'fiscal',
  'aiAssistants',
  'crm',
  'personnel',
  'other',
];

/** F-13-004: открываются только по прямой ссылке — в витрину и общий список категорий не попадают */
export const HIDDEN_CATEGORY_IDS: IntegrationCategoryId[] = [
  'chatbots',
  'tips',
];

export const ALL_CATEGORY_IDS: IntegrationCategoryId[] = [
  ...VISIBLE_CATEGORY_IDS,
  ...HIDDEN_CATEGORY_IDS,
];

/** F-13-184/F-13-203, ⭐ F-00-028/F-00-025: в Армении пока «Скоро» */
export function isCategoryComingSoon(
  categoryId: IntegrationCategoryId,
): boolean {
  return categoryId === 'payments' || categoryId === 'fiscal';
}

// ─────────────────────────── Цена (F-13-009) ───────────────────────────

export type PriceModel =
  | 'free'
  | 'fromPrice'
  | 'freeTier'
  | 'trialDays'
  | 'testPeriod'
  | 'comingSoon'
  | 'perMessage'
  | 'none';

export interface AppPrice {
  model: PriceModel;
  /** ֏ / $ / € в зависимости от currency — используется у fromPrice и perMessage */
  amount?: number;
  currency?: 'AMD' | 'USD' | 'EUR';
  trialDays?: number;
}

// ─────────────────────────── Каналы и страны ───────────────────────────

export type AppChannel =
  | 'sms'
  | 'whatsapp'
  | 'waba'
  | 'telegram'
  | 'viber'
  | 'email'
  | 'voice'
  | 'other';

export const APP_CHANNELS: AppChannel[] = [
  'sms',
  'whatsapp',
  'waba',
  'telegram',
  'viber',
  'email',
  'voice',
  'other',
];

/** b03, F-13-154/F-13-166: пара приложений в каталоге — только зарубежные партнёры без карточки в армянском кабинете */
export type CountryCode = 'AM' | 'RU' | 'US' | 'EU' | 'UA' | 'KZ' | 'GLOBAL';

// ─────────────────────────── Каталог приложения ───────────────────────────

export interface AppFaq {
  q: string;
  a: string;
}

export interface AppPlan {
  name: string;
  price: number;
  currency: 'AMD' | 'USD' | 'EUR';
  period: 'month' | 'year' | 'once';
  features: string[];
}

/** Разделы, которые просит приложение (F-13-014, ⭐ F-00-010) — понятными словами через messages */
export type RequestedScope =
  | 'schedule'
  | 'clients'
  | 'bookings'
  | 'money'
  | 'staff'
  | 'services'
  | 'catalog'
  | 'reports';

export const REQUESTED_SCOPES: RequestedScope[] = [
  'schedule',
  'clients',
  'bookings',
  'money',
  'staff',
  'services',
  'catalog',
  'reports',
];

/** F-13-140: «Тип приложения» в фильтре витрины категории «Уведомления» */
export type NotifyAppKind = 'chatbot' | 'smsAggregator' | 'other';

export const NOTIFY_APP_KINDS: NotifyAppKind[] = [
  'chatbot',
  'smsAggregator',
  'other',
];

/** F-13-140: «Возможности» — сужают список каналов-приложений по тому, что они умеют */
export type NotifyCapability =
  | 'bulk'
  | 'transactional'
  | 'cascade'
  | 'bookingConfirm'
  | 'retentionCampaigns'
  | 'rfm'
  | 'reviewsOnMaps'
  | 'negativeReviewIntercept'
  | 'reportsAnalytics'
  | 'taskManagement';

export const NOTIFY_CAPABILITIES: NotifyCapability[] = [
  'bulk',
  'transactional',
  'cascade',
  'bookingConfirm',
  'retentionCampaigns',
  'rfm',
  'reviewsOnMaps',
  'negativeReviewIntercept',
  'reportsAnalytics',
  'taskManagement',
];

export interface CatalogApp {
  id: Id;
  /** Прямая ссылка вида mp_<номер>_<имя> (F-13-013) */
  code: string;
  categoryId: IntegrationCategoryId;
  name: string;
  subtitle: string;
  description?: string;
  developer: string;
  legalInfo?: string;
  policyUrl?: string;
  websiteUrl?: string;
  rating: number;
  reviewsCount: number;
  installsCount: number;
  price: AppPrice;
  channels?: AppChannel[];
  countries: CountryCode[];
  /** F-13-212, ⭐ F-00-019: работает ли на пробном/бесплатном месяце */
  worksOnTrial: boolean;
  /** F-13-023: подключает только владелец */
  ownerOnly: boolean;
  requestedScopes: RequestedScope[];
  registrationMode: 'website' | 'form';
  /** F-13-015: можно подключить сразу к нескольким филиалам */
  multiLocation: boolean;
  /** ⭐ F-00-001/F-00-155/ux-best-c2: наше встроенное — не «стороннее», без цены партнёра */
  builtin?: boolean;
  builtinHref?: string;
  features: string[];
  plans?: AppPlan[];
  faq?: AppFaq[];
  relatedIds?: Id[];
  /** F-13-201: провайдер платежей отмечен «для Армении» (ручная предоплата, не через платформу) */
  armeniaManualNote?: boolean;
  /** F-13-140: тип приложения — фильтр «Тип приложения» у категории «Уведомления» */
  notifyAppKind?: NotifyAppKind;
  /** F-13-140: возможности — фильтр «Возможности» у категории «Уведомления» */
  notifyCapabilities?: NotifyCapability[];
  /** F-13-163: подключает только поддержка Altegio — в карточке кнопка «Подключить» заменяется на «Написать в поддержку» */
  connectedBySupport?: boolean;
  /** F-13-141: приложение считает сообщения деньгами — показываем блок баланса и «Пополнить» в «Настройках» */
  billsPerMessage?: boolean;
  /** F-13-155: общее подключение SMS-агрегатора — «Ключ авторизации» + «Имя отправителя SMS» с одобрением */
  smsAggregatorAuth?: boolean;
  /** F-13-142/F-13-143: при подключении можно выбрать номер отправителя WhatsApp (по умолчанию / свой) */
  whatsappNumberChoice?: boolean;
  /** F-13-174/F-13-175/F-13-176/F-13-211: карта лояльности в Apple/Google Wallet — вкладка «Настройки» получает демо-симулятор визита */
  walletLoyaltyDemo?: boolean;
  /** F-13-172: конструктор промоблоков виджета записи вместо общего блока настроек */
  promoBlockBuilder?: boolean;
  // ─────────────────────────── b04: карточки каталога (аналитика, ИИ-боты, продвижение, CRM, персонал) ───────────────────────────
  /** F-13-182: скрытая карточка — не попадает ни в одну категорию/поиск, только по прямой ссылке */
  hiddenFromCatalog?: boolean;
  /** F-13-079/F-13-080: Google Analytics — вкладка «Настройки» получает управление потоками данных */
  gaStreamsApp?: boolean;
  /** F-13-085: Power BI (Smart-Metrika) — отдельный пользователь «только просмотр» и демо-выгрузка */
  viewerOnlyAnalytics?: boolean;
  /** F-13-110/F-13-111: Beauty AI — GPT — вкладка «Кого позвать» вместо общей заглушки */
  whoToCallDemo?: boolean;
  /** F-13-178: Kommo/amoCRM — режим синхронизации статусов сделки и записи */
  kommoSettings?: boolean;
  /** F-13-181: FastSign — демо-заполнение анкеты клиентом */
  fastSignDemo?: boolean;
  /** F-13-137: 2GIS/Earlyone/DOQ.kz — вместо «Подключить» кнопка «Оставить заявку партнёру» */
  partnerApplicationOnly?: boolean;
  // ─────────────────────────── b05: телефония, монетизация, редкие карточки ───────────────────────────
  /** F-13-099…F-13-105: карточка АТС — добавляет «Проверить звонок» (F-13-093) в «Настройки» */
  telephonyPbx?: boolean;
  /** F-13-200: скрытая карточка «Чаевые» — пометка «обсудить в Армении» под ценой */
  tipsQuestionNote?: boolean;
  /** Ревью 27.09 (И10): «начните с этого» — порядок в блоке рекомендуемых и первым в своей категории (меньше — выше) */
  featuredRank?: number;
}

// ─────────────────────────── b04: Google Analytics — потоки данных (F-13-079, F-13-080) ───────────────────────────

export interface GaDataStream {
  id: Id;
  /** формат GA4: G-XXXXXXXXXX */
  streamId: string;
  /** «одна форма — один поток» (F-13-079 «Готово, когда») */
  formLabel: string;
  createdAt: ISODateTime;
}

/** F-13-079: формат идентификатора потока GA4 (префикс G-, 6–10 букв/цифр) */
const GA_STREAM_ID_RE = /^G-[A-Z0-9]{6,10}$/;

export function isValidGaStreamId(value: string): boolean {
  return GA_STREAM_ID_RE.test(value.trim().toUpperCase());
}

/** F-13-079 «Готово, когда»: второй поток на ту же форму не добавляется */
export function canAddGaStream(
  existing: GaDataStream[],
  formLabel: string,
  editingId?: Id,
): boolean {
  return !existing.some((s) => s.id !== editingId && s.formLabel === formLabel);
}

// ─────────────────────────── b04: «Кого позвать» — Beauty AI — GPT (F-13-110, F-13-111) ───────────────────────────

export type WhoToCallReason = 'usualTime' | 'dueForService';

export interface WhoToCallCandidate {
  clientId: Id;
  clientName: string;
  staffName: string;
  slotTime: ISODateTime;
  reason: WhoToCallReason;
  message: string;
}

/** F-13-111 «Готово, когда»: готовый текст «Привет, Алина! У Марины завтра свободно в 15:00. Записать вас?» */
export function buildWhoToCallMessage(
  clientFirstName: string,
  staffName: string,
  timeLabel: string,
): string {
  return `Привет, ${clientFirstName}! У ${staffName} завтра свободно в ${timeLabel}. Записать вас?`;
}

export const WHO_TO_CALL_MAX = 10;
export const WHO_TO_CALL_HORIZON_DAYS = 7;

// ─────────────────────────── b04: Kommo / amoCRM (F-13-178) ───────────────────────────

export type KommoSyncMode = 'conditional' | 'unconditional' | 'none';
export const KOMMO_SYNC_MODES: KommoSyncMode[] = [
  'conditional',
  'unconditional',
  'none',
];

// ─────────────────────────── Подключение по филиалу ───────────────────────────

export type InstallStatus =
  | 'pendingActivation'
  | 'connected'
  | 'error'
  | 'disconnected'
  | 'autoDisconnected';

export interface AppInstall {
  id: Id;
  appId: Id;
  businessId: Id;
  locationId: Id;
  status: InstallStatus;
  grantedScopes: RequestedScope[];
  connectedAt: ISODateTime;
  /** F-13-018: окно «ждём активации партнёром» — 1 час от connectedAt */
  activatesBy?: ISODateTime;
  activatedAt?: ISODateTime;
  disconnectedAt?: ISODateTime;
  /** F-13-021: подписка партнёра оплачена до — просрочка → autoDisconnected */
  paidUntil?: ISODateTime;
  systemUserId?: Id;
  errorText?: string;
  // ─── b03: настройки конкретных приложений (AppSettingsTab, F-13-141, F-13-155, F-13-142/143, F-13-174…176/211) ───
  /** F-13-141/F-13-155: баланс сообщений в ֏, отдельно на каждый филиал (install уже ключуется по locationId) */
  messageBalanceAmd?: number;
  /** F-13-155: «Ключ авторизации» SMS-агрегатора */
  authKey?: string;
  /** F-13-155: «Имя отправителя SMS» — до одобрения оператором рассылки недоступны */
  senderName?: string;
  senderNameStatus?: 'none' | 'pending' | 'approved';
  /** F-13-142/F-13-143: номер, с которого уходят сообщения */
  whatsappNumberMode?: 'default' | 'own';
  /** F-13-142: пока Meta не одобрила 3 базовых шаблона — интеграция не активна */
  metaTemplatesApproved?: boolean;
  /** F-13-174/F-13-175/F-13-176/F-13-211: демо-симулятор — сколько штампов/визитов накопил тестовый клиент */
  demoLoyaltyStamps?: number;
  // ─── b04: Google Analytics, Kommo, FastSign ───
  /** F-13-080: связки «поток GA — форма записи» */
  gaStreams?: GaDataStream[];
  /** F-13-178: как смена статуса записи двигает сделку Kommo по воронке */
  kommoSyncMode?: KommoSyncMode;
  /** F-13-178: искать дубли сделок при повторной записи того же клиента */
  kommoDedupe?: boolean;
  /** F-13-181: сколько демо-анкет клиент «заполнил» — заполненная анкета обновляет карточку клиента */
  fastSignFilledCount?: number;
  // ─── b05: история оплат подписки партнёра (F-13-043, F-13-044) ───
  paymentHistory?: PartnerPaymentEntry[];
  // ─── f2: приложения-чат-боты категории «Уведомления» с notifyAppKind === 'chatbot' ───
  /** F-13-146/F-13-147: порядок каскада (первый канал пробуют первым, при отказе — следующий) */
  cascadeOrder?: AppChannel[];
  /** F-13-152: низкие оценки уходят владельцу вместо публикации на картах */
  negativeReviewIntercept?: boolean;
  /** F-13-144/145/148/149/150/151/153: последняя демо-проверка канала/подтверждения */
  lastChatbotTest?: ChatbotTestResult;
  /** F-13-152: сколько демо-отзывов с низкой оценкой перехвачено вместо публикации */
  interceptedReviewsCount?: number;
  /** F-13-147/152: сколько «уснувших» клиентов задело последнее демо-возврата */
  lastRetentionRunCount?: number;
  // ─── ревью 27.09 (И2): «работает ли» — последнее событие, ошибки, проверка ───
  /** Когда приложение последний раз обменялось данными с платформой (событие/синхронизация) */
  lastEventAt?: ISODateTime;
  /** Что это было: синхронизация, отправленное сообщение, запись от партнёра */
  lastEventKind?: InstallEventKind;
  /** Ошибки обмена с причиной (хранятся за 30 дней, экран показывает 7) */
  recentErrors?: InstallErrorEntry[];
  /** Последняя проверка «Отправить тест» */
  lastTest?: InstallTestResult;
}

export type InstallEventKind = 'sync' | 'message' | 'booking';

export type InstallErrorReason = 'partnerTimeout' | 'invalidCredentials' | 'rateLimited' | 'recipientBlocked' | 'partnerRejected';

export interface InstallErrorEntry {
  id: Id;
  at: ISODateTime;
  reason: InstallErrorReason;
}

export interface InstallTestResult {
  at: ISODateTime;
  ok: boolean;
  reason?: InstallErrorReason;
}

/** И2: ошибки за последние `days` дней, новые сверху */
export function recentInstallErrors(install: Pick<AppInstall, 'recentErrors'>, nowIso: ISODateTime, days = 7): InstallErrorEntry[] {
  const from = addMinutes(nowIso, -days * 24 * 60);
  return (install.recentErrors ?? []).filter((e) => e.at >= from).sort((a, b) => b.at.localeCompare(a.at));
}

/** И11: строка «платите напрямую партнёру» — только у платных моделей, не у бесплатных и встроенных */
export function paysPartnerDirectly(app: Pick<CatalogApp, 'builtin' | 'price'>): boolean {
  if (app.builtin) return false;
  return app.price.model === 'fromPrice' || app.price.model === 'perMessage' || app.price.model === 'trialDays' || app.price.model === 'freeTier' || app.price.model === 'testPeriod';
}

/** И1: у приложения есть свои настройки — только тогда в карточке есть вкладка «Настройки» */
export function appHasOwnSettings(app: CatalogApp): boolean {
  return Boolean(
    app.promoBlockBuilder ||
      app.smsAggregatorAuth ||
      app.billsPerMessage ||
      app.whatsappNumberChoice ||
      app.walletLoyaltyDemo ||
      app.gaStreamsApp ||
      app.viewerOnlyAnalytics ||
      app.whoToCallDemo ||
      app.kommoSettings ||
      app.fastSignDemo ||
      app.notifyAppKind === 'chatbot',
  );
}

/** F-13-146/149/151/153: результат демо-проверки доставки/подтверждения у чат-бота уведомлений */
export interface ChatbotTestResult {
  at: ISODateTime;
  /** канал, которым в итоге «доставилось» сообщение (после каскада) */
  deliveredVia: AppChannel;
  /** F-13-144/148/150/153: клиент «ответил да» — демо подтверждает запись одним кликом */
  confirmed: boolean;
}

/** F-13-043/F-13-044: одна оплата подписки партнёра (имитация через API) — с ней же живёт возврат */
export interface PartnerPaymentEntry {
  id: Id;
  amount: number;
  currency: 'AMD' | 'USD' | 'EUR';
  paidUntil: ISODateTime;
  createdAt: ISODateTime;
  refundedAt?: ISODateTime;
}

/**
 * F-13-019/F-13-059: системный пользователь интеграции — техническая учётка, под которой подключённое
 * приложение читает и пишет данные локации. Существует ровно пока `AppInstall.status === 'connected'`
 * (появляется при активации, исчезает при отключении — F-13-019 «Готово, когда»); бесплатен, если
 * приложение подключено через маркетплейс, платно — если это своя интеграция (F-13-059).
 *
 * Раздел «staff» показывает список системных пользователей на вкладке «Cистемные пользователи» (F-10-010);
 * это раздел «Готово, когда» F-13-019 просит из карточки сотрудников, поэтому мы только отдаём готовый
 * список через `listSystemUsers()` (см. `src/api/integrations.ts`) — просьба переключить их вкладку на
 * него записана в `qa/requests/integrations.md`.
 */
export interface IntegrationSystemUser {
  id: Id;
  appId: Id;
  appName: string;
  installId: Id;
  businessId: Id;
  locationId: Id;
  grantedScopes: RequestedScope[];
  connectedAt: ISODateTime;
  /** F-13-059: маркетплейс — бесплатно; своя интеграция (тестовая установка разработчиком у себя) — платно */
  billedInSubscription: boolean;
}

export type ReviewAuthorRole = 'owner' | 'admin' | 'staff';

export interface AppReview {
  id: Id;
  appId: Id;
  businessId: Id;
  /** QA 30.09: кто оставил — ключ роли, подпись переводится при показе (reviews.author.*). */
  authorRole?: ReviewAuthorRole;
  /** Имя автора, если его прислал сервер; при authorRole не показывается */
  authorName?: string;
  rating: number;
  text: string;
  createdAt: ISODateTime;
}

/** F-13-005: подписка «сообщать о новых интеграциях» на пустую/скорую категорию */
export interface CategorySubscription {
  businessId: Id;
  categoryId: IntegrationCategoryId;
  createdAt: ISODateTime;
}

// ─────────────────────────── Чистые правила (F-13-018, F-13-021) ───────────────────────────

const ACTIVATION_WINDOW_MINUTES = 60;

/** F-13-018: было new Date().toISOString() (UTC) сравниваемое лексикографически с nowDateTime() (Asia/Yerevan,
 * без Z) — на +4 поясе дедлайн казался в прошлом почти сразу после подключения. Считаем в том же формате,
 * что и «сейчас» в проекте. */
export function activationDeadline(fromIso: ISODateTime): ISODateTime {
  return addMinutes(fromIso, ACTIVATION_WINDOW_MINUTES);
}

export function isActivationOverdue(
  install: Pick<AppInstall, 'status' | 'activatesBy'>,
  nowIso: ISODateTime,
): boolean {
  return (
    install.status === 'pendingActivation' &&
    !!install.activatesBy &&
    install.activatesBy < nowIso
  );
}

const PARTNER_SUBSCRIPTION_MONTH_MINUTES = 30 * 24 * 60;

/** F-13-021: «оплатили подписку партнёра» (имитация) — на сколько продлить paidUntil */
export function extendPaidUntil(fromIso: ISODateTime): ISODateTime {
  return addMinutes(fromIso, PARTNER_SUBSCRIPTION_MONTH_MINUTES);
}

/** F-13-044 «Готово, когда»: возврат доступен только для последней ещё не возвращённой оплаты */
export function canRefundLastPayment(history: PartnerPaymentEntry[] | undefined): boolean {
  const last = history?.at(-1);
  return Boolean(last && !last.refundedAt);
}

export function isInstallLive(status: InstallStatus): boolean {
  return status === 'connected' || status === 'pendingActivation';
}

/** F-13-006: округлённый рейтинг на плитку (★ 4.5) */
export function ratingLabel(rating: number): string {
  return rating.toFixed(1);
}

/** F-13-023: приложения «только владелец» подключает только владелец (по персоне, не по праву) */
export function canPersonaConnect(
  app: Pick<CatalogApp, 'ownerOnly'>,
  persona: string,
): boolean {
  return !app.ownerOnly || persona === 'owner';
}

// ═══════════════════════════ Кабинет разработчика (F-13-028…046, пачка b02) ═══════════════════════════
// Кабинет виден только тому staffId, кто его завёл (F-13-028 «Готово, когда»), поэтому DeveloperAccount и
// DevApp ключуются по ownerStaffId, а не только businessId — иначе второй администратор того же бизнеса
// увидел бы чужой кабинет.

export interface DeveloperAccount {
  businessId: Id;
  ownerStaffId: Id;
  companyName: string;
  purpose: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactWebsite?: string;
  partnerBearer?: string;
  createdAt: ISODateTime;
}

export type DevAppStatus = 'draft' | 'review' | 'published' | 'rejected';

export interface DevAppFaqItem {
  q: string;
  a: string;
}

export type DevAppLocale = 'ru' | 'en' | 'hy';
export const DEV_APP_LOCALES: DevAppLocale[] = ['ru', 'en', 'hy'];

export interface DevAppAboutText {
  description: string;
  features: string[];
  faq: DevAppFaqItem[];
}

export interface DevAppAbout {
  galleryCount: number;
  videoUrl?: string;
  byLocale: Partial<Record<DevAppLocale, DevAppAboutText>>;
}

export interface DevAppDevSettings {
  registrationUrl: string;
  callbackUrl?: string;
  webhookUrl?: string;
  passUserData: boolean;
  iframeMode: boolean;
  allowMultiLocation: boolean;
}

export interface DevAppApiAccess {
  systemUserId?: string;
  permissions: string[];
  userToken?: string;
}

// ─────────────────────────── b05: монетизация приложения разработчика (F-13-037, F-13-038) ───────────────────────────

export interface DevAppMonetization {
  isPaid: boolean;
  priceAmount?: number;
  currency?: 'AMD' | 'USD' | 'EUR';
  trialDays?: number;
  /** F-13-038: сетка тарифов, «загруженная» из Excel — демо-разбор без реального парсинга файла */
  tariffPlans?: AppPlan[];
  tariffSheetUploadedAt?: ISODateTime;
  tariffSheetFileName?: string;
}

export function emptyDevAppMonetization(): DevAppMonetization {
  return { isPaid: false };
}

/** F-13-037 «Готово, когда»: платное приложение без цены не считается настроенным */
export function isDevAppMonetizationValid(m: DevAppMonetization): boolean {
  if (!m.isPaid) return true;
  return typeof m.priceAmount === 'number' && m.priceAmount > 0 && Boolean(m.currency);
}

// ─────────────────────────── b05: журнал событий приложения разработчика (F-13-045) ───────────────────────────

export type DevAppEventType = 'testInstalled' | 'testUninstalled' | 'disabled' | 'submitted' | 'published' | 'rejected';

export interface DevAppEvent {
  id: Id;
  type: DevAppEventType;
  at: ISODateTime;
}

// ─────────────────────────── b05: модерация — чек-лист публикации (F-13-047, F-13-048) ───────────────────────────

export interface DevAppPublicationTexts {
  connectInstructions: string;
  paymentInstructions: string;
}

export function emptyDevAppPublicationTexts(): DevAppPublicationTexts {
  return { connectInstructions: '', paymentInstructions: '' };
}

export interface DevAppChecklistItem {
  key: 'created' | 'registrationUrl' | 'description' | 'connectInstructions' | 'paymentInstructions' | 'apiAccess';
  done: boolean;
  required: boolean;
}

type ChecklistApp = Pick<DevApp, 'devSettings' | 'about' | 'apiAccess' | 'publication'>;

/** F-13-047 «Готово, когда»: чек-лист того, что готовят к модерации — «Приложение создано» отмечается само,
 * доступ к API необязателен, остальное обязательно. F-13-048: тот же список — что проверяет модератор. */
export function devAppPublishChecklist(app: ChecklistApp): DevAppChecklistItem[] {
  return [
    { key: 'created', done: true, required: true },
    { key: 'registrationUrl', done: app.devSettings.registrationUrl.trim().length > 0, required: true },
    { key: 'description', done: (app.about.byLocale.ru?.description.trim().length ?? 0) > 0, required: true },
    { key: 'connectInstructions', done: app.publication.connectInstructions.trim().length > 0, required: true },
    { key: 'paymentInstructions', done: app.publication.paymentInstructions.trim().length > 0, required: true },
    { key: 'apiAccess', done: Boolean(app.apiAccess.systemUserId), required: false },
  ];
}

export function canSendToModeration(app: ChecklistApp): boolean {
  return devAppPublishChecklist(app).every((i) => !i.required || i.done);
}

export interface DevApp {
  id: Id;
  ownerStaffId: Id;
  businessId: Id;
  name: string;
  appCode: string;
  categoryId: IntegrationCategoryId;
  isPrivate: boolean;
  status: DevAppStatus;
  about: DevAppAbout;
  devSettings: DevAppDevSettings;
  apiAccess: DevAppApiAccess;
  monetization: DevAppMonetization;
  publication: DevAppPublicationTexts;
  events: DevAppEvent[];
  createdAt: ISODateTime;
  rejectReason?: string;
  testInstalledAt?: ISODateTime;
}

/** F-13-034: галерея — до 5 картинок; тексты — до лимитов знаков; FAQ — вопрос/ответ до лимитов */
export const DEV_APP_GALLERY_MAX = 5;
export const DEV_APP_DESCRIPTION_MAX = 3000;
export const DEV_APP_FAQ_QUESTION_MAX = 100;
export const DEV_APP_FAQ_ANSWER_MAX = 1000;

export function emptyDevAppAbout(): DevAppAbout {
  return { galleryCount: 0, byLocale: {} };
}

export function emptyDevAppDevSettings(): DevAppDevSettings {
  return {
    registrationUrl: '',
    passUserData: false,
    iframeMode: false,
    allowMultiLocation: false,
  };
}

/** F-13-035/F-13-047 «Готово, когда»: «Отправить на модерацию» активна только когда заполнены обязательные
 * пункты чек-листа (Registration Redirect Url, «Об интеграции», обе инструкции). */
export function canSubmitDevAppForReview(app: ChecklistApp): boolean {
  return canSendToModeration(app);
}

// ─────────────────────────── API-ключи, User token, ИИ-токен (F-13-052, F-13-053, F-13-072) ───────────────────────────

export interface PartnerApiKey {
  id: Id;
  businessId: Id;
  token: string;
  createdAt: ISODateTime;
  revokedAt?: ISODateTime;
}

export interface UserApiToken {
  id: Id;
  businessId: Id;
  label: string;
  token: string;
  createdAt: ISODateTime;
  revokedAt?: ISODateTime;
}

export type AiTokenScope = 'read' | 'readWrite';

export interface AiAssistantToken {
  id: Id;
  businessId: Id;
  scope: AiTokenScope;
  token: string;
  createdAt: ISODateTime;
  revokedAt?: ISODateTime;
}

/** Демо-токен: не настоящий секрет, только для показа один раз в интерфейсе (arch-a1) */
export function generateDemoToken(prefix: string): string {
  const body = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join('');
  return `${prefix}_${body}`;
}

export function maskToken(token: string): string {
  const tail = token.slice(-4);
  return `••••••••${tail}`;
}

// ─────────────────────────── Вебхуки (F-13-062…070) ───────────────────────────

/** F-13-063: 16 сущностей (первый обход насчитал 14 — недостающие две достроены нами до круглого числа,
 *  см. qa/questions/integrations.md) */
export type WebhookEntity =
  | 'location'
  | 'staff'
  | 'goods'
  | 'services'
  | 'serviceCategories'
  | 'clients'
  | 'records'
  | 'loyaltyCards'
  | 'goodsSales'
  | 'goodsArrival'
  | 'goodsWriteOff'
  | 'goodsConsumables'
  | 'goodsTransfer'
  | 'transactions'
  | 'certificates'
  | 'subscriptions';

export const WEBHOOK_ENTITIES: WebhookEntity[] = [
  'location',
  'staff',
  'goods',
  'services',
  'serviceCategories',
  'clients',
  'records',
  'loyaltyCards',
  'goodsSales',
  'goodsArrival',
  'goodsWriteOff',
  'goodsConsumables',
  'goodsTransfer',
  'transactions',
  'certificates',
  'subscriptions',
];

export interface WebhookAddress {
  id: Id;
  url: string;
  createdAt: ISODateTime;
  /** F-13-065: адреса, заданные до блокировки, продолжают работать */
  legacy: boolean;
  /** И13: секрет подписи (HMAC) — целиком показывается один раз при создании, дальше только маска */
  signingSecret?: string;
  /** И13: адрес ответил на проверочный запрос */
  verifiedAt?: ISODateTime;
}

/** И13: адрес вебхука — только https и с именем хоста */
export function isValidWebhookUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(v)) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

export type WebhookFailReason = 'timeout' | 'http4xx' | 'http5xx' | 'tls';

export interface WebhookConfig {
  businessId: Id;
  enabled: boolean;
  addresses: WebhookAddress[];
  entities: WebhookEntity[];
}

export function defaultWebhookConfig(businessId: Id): WebhookConfig {
  return { businessId, enabled: false, addresses: [], entities: [] };
}

export type WebhookEventAction = 'create' | 'update' | 'delete';

export interface WebhookDelivery {
  id: Id;
  businessId: Id;
  entity: WebhookEntity;
  action: WebhookEventAction;
  objectLabel: string;
  address: string;
  status: 'delivered' | 'failed';
  createdAt: ISODateTime;
  /** И13: почему не доставилось */
  failReason?: WebhookFailReason;
  /** И13: сколько попыток было (с повторами) */
  attempts?: number;
}

/** F-13-065: новый адрес в настройках больше не добавляется — только через непубличное приложение (F-13-066) */
export const WEBHOOK_NEW_ADDRESS_BLOCKED = true;

// ─────────────────────────── Идентификаторы для внешних систем (F-13-056) ───────────────────────────

// ─────────────────────────── b03: правила «Уведомлений» (F-13-141, F-13-155, F-13-156) ───────────────────────────

/** F-13-155 «Готово, когда»: до одобрения имени отправителя рассылка недоступна */
export function canSendBulkSms(
  install: Pick<AppInstall, 'senderNameStatus'>,
): boolean {
  return install.senderNameStatus === 'approved';
}

/** F-13-141 «Готово, когда»: без баланса сообщение не уходит — статус «Недостаточно средств» */
export type MessageSendOutcome = 'sent' | 'insufficientFunds';

export function estimateSendOutcome(
  balanceAmd: number | undefined,
  pricePerMessageAmd: number,
): MessageSendOutcome {
  return (balanceAmd ?? 0) >= pricePerMessageAmd ? 'sent' : 'insufficientFunds';
}

// ─────────────────────────── b03: промоблок в виджете записи (F-13-172) ───────────────────────────

export type PromoBlockPlacement =
  'menu' | 'serviceSelect' | 'staffSelect' | 'successScreen';

export const PROMO_BLOCK_PLACEMENTS: PromoBlockPlacement[] = [
  'menu',
  'serviceSelect',
  'staffSelect',
  'successScreen',
];

export const PROMO_BLOCK_HEADLINE_MAX = 50;
export const PROMO_BLOCK_DESCRIPTION_MAX = 220;
export const PROMO_BLOCK_BUTTON_TEXT_MAX = 20;
export const PROMO_BLOCK_IMAGE_MAX_MB = 12;

export type PromoBlockIcon =
  'gift' | 'megaphone' | 'star' | 'percent' | 'share2' | 'sparkles';
export const PROMO_BLOCK_ICONS: PromoBlockIcon[] = [
  'gift',
  'megaphone',
  'star',
  'percent',
  'share2',
  'sparkles',
];

export interface PromoBlock {
  id: Id;
  businessId: Id;
  locationId: Id;
  headline: string;
  description: string;
  hasImage: boolean;
  icon: PromoBlockIcon;
  buttonText?: string;
  buttonHref?: string;
  placements: PromoBlockPlacement[];
  enabled: boolean;
  createdAt: ISODateTime;
}

export interface PromoBlockDraft {
  headline: string;
  description: string;
  hasImage: boolean;
  icon: PromoBlockIcon;
  buttonText: string;
  buttonHref: string;
  placements: PromoBlockPlacement[];
}

export function emptyPromoBlockDraft(): PromoBlockDraft {
  return {
    headline: '',
    description: '',
    hasImage: false,
    icon: 'gift',
    buttonText: '',
    buttonHref: '',
    placements: ['menu'],
  };
}

/** F-13-172 «Готово, когда»: заголовок длиннее 50 знаков не сохраняется (и остальные лимиты) */
export function isValidPromoBlockDraft(draft: PromoBlockDraft): boolean {
  const headline = draft.headline.trim();
  if (!headline || headline.length > PROMO_BLOCK_HEADLINE_MAX) return false;
  if (draft.description.trim().length > PROMO_BLOCK_DESCRIPTION_MAX)
    return false;
  if (draft.buttonText.trim().length > PROMO_BLOCK_BUTTON_TEXT_MAX)
    return false;
  if (draft.buttonText.trim() && !draft.buttonHref.trim()) return false;
  if (draft.placements.length === 0) return false;
  return true;
}

/** F-13-172 «Готово, когда»: на экране выбора услуги виден ровно один промоблок */
export function promoBlockForPlacement(
  blocks: PromoBlock[],
  placement: PromoBlockPlacement,
): PromoBlock | undefined {
  return blocks.find((b) => b.enabled && b.placements.includes(placement));
}

/** доп. поле «Ключ-значение для API»: только латиница, цифры, «.», «-», «_» */
const API_FIELD_KEY_RE = /^[a-zA-Z0-9._-]+$/;

export function isValidApiFieldKey(value: string): boolean {
  return value.trim().length > 0 && API_FIELD_KEY_RE.test(value.trim());
}

// ─────────────────────────── b04: заявка партнёру напрямую, без листа подключения (F-13-137) ───────────────────────────

export interface PartnerApplication {
  id: Id;
  appId: Id;
  businessId: Id;
  createdAt: ISODateTime;
}

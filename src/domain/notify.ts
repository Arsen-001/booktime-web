/**
 * Типы раздела «notify» (F-05: реестр уведомлений, каналы, рассылки, журнал отправок, центр уведомлений).
 * Файл принадлежит разделу — пишите сюда свои сущности. Ссылайтесь на сущности ядра по id
 * (import type { Id } from '@/domain/core').
 */
import type { Id, ISODateTime, LocalizedText } from '@/domain/core';

// ─────────────────────────── Каналы ───────────────────────────

/**
 * push — наш бесплатный канал клиенту (аналог Altegio.me, ⭐ F-00-120, главный канал клиента);
 * adminApp — приложение администратора/мастера (пуш сотруднику);
 * whatsapp, telegram — код входа клиента (⭐ F-00-032): основной путь, SMS — запасной канал;
 * email, sms, brandedApp — 1:1 с Altegio как механизм (brandedApp у нас — общее приложение клиента, F-00-001).
 */
export type NotifyChannel = 'push' | 'adminApp' | 'email' | 'sms' | 'brandedApp' | 'whatsapp' | 'telegram';

export const NOTIFY_CHANNELS: readonly NotifyChannel[] = [
  'push',
  'adminApp',
  'email',
  'sms',
  'brandedApp',
  'whatsapp',
  'telegram',
];

export type NotifyRecipient = 'client' | 'admin' | 'staff' | 'adminStaff';

/** Подгруппы клиентских типов (F-05-002) */
export type NotifyClientGroup = 'attendance' | 'quality' | 'retention' | 'other';

/** «Не отправлять» / «Всегда отправлять» / «Если предыдущий канал не доставлен» (только sms и brandedApp, F-05-007) */
export type NotifyScenario = 'off' | 'always' | 'fallback';

export interface NotifyChannelSetting {
  channel: NotifyChannel;
  scenario: NotifyScenario;
}

/** Постоянный номер типа (F-05-004): 1…88, сплошная у нас нумерация не нужна — держим оригинальные коды Altegio */
export type NotifyTypeCode = number;

export interface NotificationType {
  id: Id;
  code: NotifyTypeCode;
  recipient: NotifyRecipient;
  /** Только у recipient === 'client' */
  group?: NotifyClientGroup;
  name: LocalizedText;
  description: LocalizedText;
  /** Тумблер типа целиком (F-05-003); выключение не стирает каналы и шаблоны */
  enabled: boolean;
  /** Какие каналы вообще применимы к этому типу (F-05-006) */
  availableChannels: NotifyChannel[];
  /** Настроенный сценарий каждого доступного канала */
  channels: NotifyChannelSetting[];
  /** Текст шаблона на каждый канал, по языку клиента (F-05-010) — ru обязателен, hy/en опциональны */
  templates: Partial<Record<NotifyChannel, LocalizedText>>;
  /** «Дополнительная информация в Email» (F-05-015) — свой текст/картинка/видео/ссылка над письмом */
  emailExtra?: EmailExtra;
  /** Условия отправки, специфичные для этого типа (F-05-024…F-05-040) — набор полей зависит от code */
  conditions?: TypeConditions;
  /** Служебный тип без своей страницы настройки (15, 22 — F-05-004) */
  system?: boolean;
  /** Тумблер нельзя выключить (тип 7 — код входа клиента всегда работает) */
  alwaysOn?: boolean;
  /** Шаблон задан системой, править нельзя (типы 7, 19, 43 — F-05-020) */
  systemLocked?: boolean;
}

/** «Дополнительная информация в Email» (F-05-015) */
export interface EmailExtra {
  enabled: boolean;
  /** Показывать текст с отступом */
  indent: boolean;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
}

/**
 * Условия конкретного типа (F-05-024…F-05-040) — необязательные поля, набор зависит от `code`;
 * читайте только те, что относятся к вашему типу (см. TypeConditionsFields.tsx).
 */
export interface TypeConditions {
  /** «Отправлять за N часов до визита» (типы 1, 28→73, 29 использует то же поле) */
  timingHours?: number;
  /** Своё время для Email (тип 1, F-05-029) — если задано, Email уходит по нему, а не по timingHours */
  emailTimingHours?: number;
  /** «Отправлять в выбранное время» вместо «за N часов» (тип 73) */
  useSpecificTime?: boolean;
  /** «HH:mm», когда useSpecificTime (тип 73) */
  specificTime?: string;
  /** Порог сдвига, который считается изменением (тип 74); -1 = «Любое» */
  rescheduleThresholdMinutes?: number;
  /** Кто должен изменить запись, чтобы уведомление ушло (тип 74) */
  rescheduleSource?: 'client' | 'staff' | 'all';
  /** «Когда отправлять» приглашение недошедшим — через N часов (тип 72) */
  inviteAfterHours?: number;
  /** Статус записи, при котором шлём приглашение (тип 72) */
  inviteStatusFilter?: 'cancelled' | 'noShow' | 'all';
  /** Через N минут после визита — запрос отзыва (типы 6, 20) */
  reviewDelayMinutes?: number;
  /** Услуги, при которых запрос отзыва не шлём (типы 6, 20) */
  reviewExcludeServiceIds?: Id[];
  reviewExcludeIfReviewed?: { location?: boolean; staff?: boolean; service?: boolean };
  /** «В день рождения» или «за N дней» (тип 3) */
  birthdayMode?: 'onDay' | 'daysBefore';
  birthdayDaysBefore?: number;
  /** «HH:mm» часового пояса локации (тип 3) */
  birthdayTimeOfDay?: string;
  /** «Уведомлять за N дней» до сгорания скидки (тип 17) */
  discountExpiryDaysBefore?: number;
  /** «Напоминать через» N дней после визита без новой записи на эту услугу (тип 55) */
  winbackAfterDays?: number;
  /**
   * Своё время напоминания для отдельной услуги (тип 1, Ув15): id услуги → «за N часов до визита». Пишет экран
   * услуги (раздел services) через setServiceReminderHours из @/api/notify; нет записи — общий timingHours типа.
   */
  serviceTimingHours?: Record<Id, number>;
}

/** Язык, на котором клиент получает автоматические сообщения (F-05-010) — отдельно от языка интерфейса кабинета */
export type NotifyLanguage = 'ru' | 'hy' | 'en';
export const NOTIFY_LANGUAGES: readonly NotifyLanguage[] = ['ru', 'hy', 'en'];

/** Формат даты и времени в переменных сообщений (F-05-011) */
export type NotifyDateFormat = '24h' | '12h';

/**
 * Тихие часы (Ув12): автоматические сообщения клиенту, выпавшие на ночь, не уходят ночью, а переносятся на утро
 * (на `to`). Код входа (тип 7) и сообщения администратору/мастеру тихие часы не задерживают.
 */
export interface NotifyQuietHours {
  enabled: boolean;
  /** «HH:mm» — с какого времени не отправлять */
  from: string;
  /** «HH:mm» — до какого времени; на это время переносятся отложенные сообщения */
  to: string;
}

export const DEFAULT_QUIET_HOURS: NotifyQuietHours = { enabled: true, from: '22:00', to: '09:00' };

export interface NotifySettings {
  language: NotifyLanguage;
  dateFormat: NotifyDateFormat;
  /** Нет поля — DEFAULT_QUIET_HOURS (включены, 22:00–09:00) */
  quietHours?: NotifyQuietHours;
}

/**
 * Ручная правка уведомлений ОДНОЙ записи (F-05-082, плитка «Уведомления о визите» в окне записи) —
 * держит, какой канал напоминания включён и за сколько часов до визита слать; закрывает F-05-009:
 * запись живёт по настройкам, действовавшим на момент её создания, а поменять их для уже созданной
 * записи можно только тут, а не на странице типа.
 */
export interface BookingNotifyOverride {
  /** Отправить детали записи сразу после сохранения */
  sendOnSave: boolean;
  /** ⭐ F-00-120: напоминание клиенту — только пуш; SMS/Email ниже — платные ручные каналы для этой записи. */
  pushEnabled: boolean;
  pushTimingHours: number;
  smsEnabled: boolean;
  smsTimingHours: number;
  emailEnabled: boolean;
  emailTimingHours: number;
  /**
   * ⭐ 30.09: напоминания в Telegram-бот (за 24 ч и за 2 ч, как сервер telegram-reminders.ts) — клиенту без приложения,
   * подключившему бота. Время фиксированное; здесь только выключатель для этой записи. Нет поля — включено.
   */
  telegramEnabled?: boolean;
}

// ─────────────────────────── Каналы отправки локации ───────────────────────────

export interface ChannelConnection {
  channel: NotifyChannel;
  connected: boolean;
}

export interface EmailChannelSettings {
  /** «Email для ответов» — куда придёт ответ клиента (F-05-066) */
  replyEmail: string;
}

export interface SmsChannelSettings {
  connected: boolean;
  apiKey?: string;
  senderName?: string;
}

// ─────────────────────────── Массовые рассылки ───────────────────────────

export type MailingChannel = 'sms' | 'pushOwnApp' | 'pushClientApp';
export type MailingStatus = 'sent' | 'sending' | 'failed' | 'scheduled';

/**
 * F-05-118: тариф SMS по сети — с главной локации (`Network.mainBusinessId`, ядро k3). У нас нет
 * отдельного общего понятия «баланс уведомлений» (F-05-115 не построен ни в settings, ни в finance —
 * см. qa/requests/notify.md) — 🔒 держим свой черновой баланс главной локации в срезе notify
 * (`NotifyState.networkSmsBalanceAmd`), демо-цифрами, до появления настоящего поля в биллинге.
 */
export const NETWORK_SMS_RATE_AMD = 25;
/** Сид-баланс демо-сети — хватает примерно на 120 сообщений, чтобы обе ветки (хватает/не хватает) были видны. */
export const NETWORK_SMS_BALANCE_SEED_AMD = 3000;

export interface Mailing {
  id: Id;
  businessId: Id;
  createdAt: ISODateTime;
  channel: MailingChannel;
  text: string;
  /** Человеческое описание отбора получателей (F-05-096) */
  audienceLabel: string;
  recipientsCount: number;
  status: MailingStatus;
  /** По сети (F-05-097) — рассылка ушла по всем филиалам сразу */
  network?: boolean;
  /** Кто фактически получил (F-05-096: фильтр «получал рассылку за период» ищет по этим id) */
  recipientClientIds?: Id[];
  /** Отправка по расписанию (Ув13): до этого момента статус 'scheduled' */
  scheduledAt?: ISODateTime;
  /** Сколько стоила (SMS: части × тариф × получатели), ֏ (Ув13) */
  costAmd?: number;
}

// ─────────────────────────── Журнал отправок ───────────────────────────

export type LogStatus =
  | 'sent'
  | 'delivered'
  | 'notDelivered'
  | 'sending'
  | 'read'
  | 'rejected'
  | 'insufficientFunds'
  | 'rejectedByOperator'
  | 'rejectedByRateLimiter';

export const LOG_STATUSES: readonly LogStatus[] = [
  'sent',
  'delivered',
  'notDelivered',
  'sending',
  'read',
  'rejected',
  'insufficientFunds',
  'rejectedByOperator',
  'rejectedByRateLimiter',
];

export type LogChannel = NotifyChannel;

export interface LogMessage {
  id: Id;
  businessId: Id;
  /** Когда ушло (или уйдёт — у `scheduled`) */
  createdAt: ISODateTime;
  /** Настраиваемый тип (F-05-004) — нет у служебных сообщений (пароль, приглашение…) */
  typeCode?: NotifyTypeCode;
  /** Название типа в журнале (F-05-130): и настраиваемые, и служебные */
  typeLabel: LocalizedText;
  channel: LogChannel;
  status: LogStatus;
  /** Телефон или email получателя */
  contact: string;
  text: LocalizedText;
  clientId?: Id;
  staffId?: Id;
  /** Запись, к которой относится сообщение — «Открыть запись» из журнала (Ув11) */
  bookingId?: Id;
  /**
   * На каком языке сообщение фактически ушло (Ув16): журнал показывает `text[sentLanguage]`, а не текст на языке
   * кабинета. Нет поля — сообщение ушло на ru (ранние строки и то, что владелец ввёл сам).
   */
  sentLanguage?: NotifyLanguage;
  /** Цена отправки, ֏ (Ув11): SMS — части × тариф, WhatsApp — за сообщение; пуш и Email — 0 */
  costAmd?: number;
  /** Сколько SMS-частей заняло сообщение (только канал sms) */
  smsParts?: number;
  /** Ещё не ушло: момент отправки в будущем (Ув11 «Запланировано») или отложено тихими часами (Ув12) */
  scheduled?: boolean;
  /** Перенесено тихими часами: исходный момент отправки (Ув12) */
  deferredFrom?: ISODateTime;
}

// ─────────────────────────── Чат с клиентом через партнёра (F-05-087) ───────────────────────────

/**
 * Сообщение переписки с клиентом через подключённого партнёра-бота (F-05-087). Работает только при
 * активном PartnerConnection на приложение type='chatBot' — иначе показываем промо-карточку.
 */
export interface ChatMessage {
  id: Id;
  businessId: Id;
  /** Телефон собеседника — переписка ищется по номеру, как в Altegio (клиент может быть ещё не создан) */
  phone: string;
  clientId?: Id;
  direction: 'in' | 'out';
  text: string;
  /** F-05-087 (проверка 1): в чат отправляются документы и изображения — храним только имя файла (демо) */
  attachmentName?: string;
  createdAt: ISODateTime;
}

// ─────────────────────────── Центр уведомлений (F-05-061/062/132) ───────────────────────────

export interface NewsItem {
  id: Id;
  title: string;
  text: string;
  date: ISODateTime;
}

export interface InboxBookingEvent {
  id: Id;
  bookingId: Id;
  kind: 'created' | 'onlineCreated' | 'deleted' | 'rescheduled';
  createdAt: ISODateTime;
  read: boolean;
}

// ─────────────────────────── Настройки уведомлений клиента (F-05-090/091/098) ───────────────────────────

/**
 * 12 отключаемых клиентских типов вкладки «Уведомления» карточки клиента (F-05-090) — коды из реестра.
 * Типов 74, 73, 75, 85, 7, 65 в списке нет по описанию ТЗ (их клиенту отключить нельзя).
 */
export const CLIENT_DISABLEABLE_TYPES: readonly number[] = [1, 6, 20, 2, 8, 3, 9, 4, 16, 17, 55, 72];

export interface ClientNotifyPrefs {
  /** «Рекламные рассылки» → «Не отправлять» (F-05-090); исключает и из массовых рассылок (F-05-098) */
  marketingOptOut: boolean;
  /** «Доступные каналы» — ограничивают и разовое сообщение (F-05-084), и массовые рассылки (F-05-090) */
  channels: { push: boolean; sms: boolean; email: boolean };
  /** Отключённые клиентом типы из CLIENT_DISABLEABLE_TYPES (F-05-090) */
  disabledTypeCodes: number[];
}

export const DEFAULT_CLIENT_NOTIFY_PREFS: ClientNotifyPrefs = {
  marketingOptOut: false,
  channels: { push: true, sms: true, email: true },
  disabledTypeCodes: [],
};

/** Разовое сообщение из карточки клиента / окна записи (F-05-084) */
export type OneOffSource = 'clientCard' | 'bookingWindow';

/** «Уведомления в Web-версии» (F-05-058) — по бизнесу, пока нет отдельной вкладки у сотрудника (просьба фундаменту) */
export interface WebPopupSettings {
  bookingOps: boolean;
  incomingCalls: boolean;
  /**
   * ⭐ «Закрыт день» (владелец, 01.10.2026): владельцу в колокольчик — итог кассы, когда администратор закрывает смену.
   * Нет поля (сохранено раньше) — включено.
   */
  dayClose?: boolean;
}

export const DEFAULT_WEB_POPUP_SETTINGS: WebPopupSettings = { bookingOps: true, incomingCalls: false, dayClose: true };

// ─────────────────────────── Каталог каналов и партнёрских приложений (F-05-069, F-05-070, F-05-075) ───────────────────────────

/** Тип приложения в каталоге «Уведомления» (F-05-070) */
export type PartnerAppType = 'smsAggregator' | 'chatBot';

/** Фильтр «Каналы отправки» карточки маркетплейса (F-05-070) */
export type PartnerChannelKind = 'sms' | 'push' | 'email' | 'whatsapp' | 'telegram' | 'viber' | 'voice' | 'waba' | 'other';
export const PARTNER_CHANNEL_KINDS: readonly PartnerChannelKind[] = [
  'sms',
  'push',
  'email',
  'whatsapp',
  'telegram',
  'viber',
  'voice',
  'waba',
  'other',
];

/**
 * Фильтр «Возможности» карточки маркетплейса (F-05-070). Снято №9, №10: у нас нет запроса отзыва
 * (вместо него — «понравилось? ★» только после «Клиент пришёл») и перехвата негативных отзывов —
 * эти два пункта каталога убраны, чтобы не выглядеть как то, что мы сами строим или продвигаем.
 */
export type PartnerCapability = 'massMailing' | 'serviceNotify' | 'cascade' | 'bookingConfirm' | 'winback' | 'rfm' | 'reports' | 'tasks';
export const PARTNER_CAPABILITIES: readonly PartnerCapability[] = [
  'massMailing',
  'serviceNotify',
  'cascade',
  'bookingConfirm',
  'winback',
  'rfm',
  'reports',
  'tasks',
];

/**
 * Карточка приложения-канала (F-05-069 SMS-агрегаторы, F-05-070 маркетплейс, F-05-075 боты-партнёры) —
 * статический каталог, общий для всех бизнесов (не по businessId; подключение — в PartnerConnection).
 */
export interface PartnerApp {
  id: Id;
  name: string;
  type: PartnerAppType;
  channels: PartnerChannelKind[];
  capabilities: PartnerCapability[];
  /** Страны/регионы простым текстом (как в справке) — каталог информационный, не гео-логика */
  countries: LocalizedText;
  developer: string;
  rating: number;
  installs: number;
  priceNote: LocalizedText;
  freeTrialDays?: number;
  description: LocalizedText;
  /** F-05-119: что провайдер обязан уметь — только у smsAggregator */
  requirements?: LocalizedText;
  /** F-05-074: официальный API нельзя держать номер в приложении одновременно; QR — можно, но не рекомендовано Meta */
  connectionKind?: 'officialApi' | 'qr';
}

export type PartnerSubscriptionStatus = 'trial' | 'active' | 'expired' | 'autoDisconnected';

/** Подключение приложения-канала к бизнесу (F-05-122 несколько локаций, F-05-123 статус подписки) */
export interface PartnerConnection {
  appId: Id;
  /** F-05-122: одно подключение сразу на несколько локаций */
  businessIds: Id[];
  status: PartnerSubscriptionStatus;
  connectedAt: ISODateTime;
  trialEndsAt?: ISODateTime;
  /** F-05-117/F-05-122: служебный пользователь приложения — не занимает платное место в лицензии */
  systemUserLabel: string;
}

// ─────────────────────────── WhatsApp через Altegio (F-05-071, F-05-072, F-05-073) ───────────────────────────

export type AltegioWhatsAppMode = 'none' | 'notificationSender' | 'embeddedSignup' | 'coexistence';

export interface AltegioWhatsAppSettings {
  mode: AltegioWhatsAppMode;
  /** F-05-071: пробный период Altegio ничего не шлёт — нужны одобренные шаблоны и платная подписка */
  templatesApproved: boolean;
  /** F-05-072/073: свой номер (Embedded Signup или Coexistence); пусто — общий номер Altegio */
  ownNumber?: string;
  companyName?: string;
}

export const DEFAULT_ALTEGIO_WHATSAPP: AltegioWhatsAppSettings = { mode: 'none', templatesApproved: false };

/** F-05-071/F-05-116: €0,04 по курсу 1€ = 416 ֏ (⭐ F-00-206) — цена сообщения WhatsApp Notification Sender */
export const WHATSAPP_MESSAGE_PRICE_AMD = 17;

// ─────────────────────────── Баланс уведомлений (F-05-115) ───────────────────────────

/** Баланс на платные каналы (WhatsApp Notification Sender) — свой на каждый филиал (F-05-071) */
export interface NotifyBalance {
  amountAmd: number;
}

export const NOTIFY_BALANCE_LOW_THRESHOLD_AMD = 500;
export const NOTIFY_BALANCE_SEED_AMD = 2000;
export const NOTIFY_BALANCE_TOPUP_OPTIONS_AMD: readonly number[] = [1000, 3000, 5000, 10000];

// ─────────────────────────── Внешние системы: вебхуки и флаги агента (F-05-120, F-05-121) ───────────────────────────

export type WebhookEntity =
  | 'location'
  | 'staff'
  | 'clients'
  | 'bookings'
  | 'loyaltyCards'
  | 'services'
  | 'products'
  | 'sales';

export const WEBHOOK_ENTITIES: readonly WebhookEntity[] = [
  'location',
  'staff',
  'clients',
  'bookings',
  'loyaltyCards',
  'services',
  'products',
  'sales',
];

export interface Webhook {
  id: Id;
  url: string;
  entities: WebhookEntity[];
  active: boolean;
  createdAt: ISODateTime;
}

/** F-05-121: что шлёт САМ Altegio, если внешний агент/бот передал флаг при создании записи по API */
export interface AgentNotifyFlags {
  sendToClient: boolean;
  sendToAdmin: boolean;
}

export const DEFAULT_AGENT_NOTIFY_FLAGS: AgentNotifyFlags = { sendToClient: true, sendToAdmin: true };

// ─────────────────────────── Инструменты партнёров бизнесу (F-05-124, F-05-125, F-05-126) ───────────────────────────

export interface PartnerSummarySettings {
  telegramEnabled: boolean;
  telegramChatLabel: string;
  emailEnabled: boolean;
  /** Integrilla-стиль: бот следит за состоянием подключения WhatsApp/канала */
  connectionWatchdog: boolean;
}

export const DEFAULT_PARTNER_SUMMARY: PartnerSummarySettings = {
  telegramEnabled: false,
  telegramChatLabel: '',
  emailEnabled: false,
  connectionWatchdog: false,
};

export interface OpenSlotsScheduleSettings {
  enabled: boolean;
  sendMorningToday: boolean;
  sendEveningTomorrow: boolean;
  timeMorning: string;
  timeEvening: string;
}

export const DEFAULT_OPEN_SLOTS_SCHEDULE: OpenSlotsScheduleSettings = {
  enabled: false,
  sendMorningToday: true,
  sendEveningTomorrow: true,
  timeMorning: '09:00',
  timeEvening: '19:00',
};

/** Свободное окно журнала, предложенное «Open Slots» / «Кого позвать» (F-05-124, F-05-125) — считается на лету */
export interface SuggestedOpenSlot {
  staffId: Id;
  staffName: string;
  date: string;
  time: string;
}

/** Клиент, подобранный под конкретное окно (F-05-125), с готовым текстом */
export interface WhoToInviteSuggestion {
  clientId: Id;
  clientName: string;
  clientPhone: string;
  slot: SuggestedOpenSlot;
  messageText: string;
}

// ─────────────────────────── Прочие сообщения клиенту (F-05-127) ───────────────────────────

export interface GiftShowcaseSettings {
  enabled: boolean;
  partnerName: string;
}

export const DEFAULT_GIFT_SHOWCASE: GiftShowcaseSettings = { enabled: false, partnerName: 'Flocktory' };

// ─────────────────────────── Лояльность, абонементы, письма (F-05-081, F-05-100…F-05-106, F-05-128, F-05-136) ───────────────────────────

/**
 * Эти события живут в других разделах Altegio (Лояльность → карты/акции/абонементы, Онлайн-продажи) —
 * у нас лояльность и абонементы не построены (F-00-197 не подтверждено), поэтому держим свой компактный
 * набор правил с шаблонами прямо в notify (свой экран `/biz/notifications/loyalty`), а не в общем
 * TYPE_REGISTRY (тот воспроизводит нумерацию типов Altegio 1:1 и трогать его чужим кодом нельзя).
 */
export type LoyaltyNotifyEventCode =
  | 'cardIssued'
  | 'pointsEarned'
  | 'pointsSpent'
  | 'promoDiscountChanged'
  | 'promoDiscountEndingSoon'
  | 'promoCashbackEarned'
  | 'promoBonusBurningSoon'
  | 'subscriptionEndingSoon'
  | 'subscriptionCharge'
  | 'onlinePurchaseReceipt'
  | 'autoRenewalCharged'
  | 'autoRenewalCancelled'
  | 'autoRenewalUpcoming'
  | 'autoRenewalFailed'
  | 'formLinkAfterBooking';

export interface LoyaltyNotifyTemplateOption {
  id: string;
  text: LocalizedText;
}

export interface LoyaltyNotifyRule {
  code: LoyaltyNotifyEventCode;
  enabled: boolean;
  channel: 'sms' | 'push' | 'email';
  presets: LoyaltyNotifyTemplateOption[];
  selectedPresetId: string;
  customText: string;
  /** F-05-101/F-05-102: «за сколько до» события — дней */
  daysBefore?: number;
  /** F-05-102: второй триггер — остаток визитов по абонементу */
  visitsLeftTrigger?: number;
  /** F-05-127/F-05-128: реально только в одном регионе Altegio — у нас всегда доступно, помечено демо-бейджем */
  regionOnly?: 'KZ' | 'BR';
}

// ─────────────────────────── Служебные баннеры в кабинете (F-05-135) ───────────────────────────

/**
 * Полоса/плашка с кнопкой действия — идёт мимо «Типов уведомлений», не видна в журнале отправок и не
 * выключается тумблерами (F-05-135 «Логика»). У нас — своя витрина внутри раздела notify (полосы
 * фундамента типа «лимит лицензии» строит settings/billing, здесь — свои, из области notify).
 */
export type ServiceBannerTone = 'promo' | 'warning' | 'danger';

export interface ServiceBannerDef {
  id: string;
  tone: ServiceBannerTone;
  title: LocalizedText;
  text: LocalizedText;
  actionLabel: LocalizedText;
  actionHref: string;
  /** Можно закрыть крестиком (F-05-135 ❓: возвращается ли после перезагрузки — у нас нет, закрытие постоянно) */
  dismissible: boolean;
  /** Срок, до которого нужно действовать — показываем дату явно (F-05-135 «Готово, когда») */
  deadline?: ISODateTime;
}

// ──────────────────── Уведомления сотрудника (F-05-055…057, F-05-060, F-05-063) ────────────────────

/** F-05-055: какие типы приходят сотруднику — «на основе прав» пересчитывается из Staff.role на лету */
export type StaffNotifyView = 'admin' | 'staff' | 'byAccess' | 'off';
export const STAFF_NOTIFY_VIEWS: readonly StaffNotifyView[] = ['byAccess', 'admin', 'staff', 'off'];

/** F-05-056: события таблицы «Тип уведомления × каналы»; «cancelledByAdmin» — отдельная строка ТЗ */
export type StaffNotifyEvent =
  | 'createdByClient'
  | 'createdByAdmin'
  | 'deleted'
  | 'moved'
  | 'cancelledByAdmin'
  | 'licenseExpiring'
  | 'billingDocs';

export const STAFF_NOTIFY_EVENTS: readonly StaffNotifyEvent[] = [
  'createdByClient',
  'createdByAdmin',
  'deleted',
  'moved',
  'cancelledByAdmin',
  'licenseExpiring',
  'billingDocs',
];

/** Каналы, которыми сотрудник может получать событие — SMS/Email добавляются только тут (F-05-056) */
export type StaffNotifyChannel = 'sms' | 'email' | 'push';
export const STAFF_NOTIFY_CHANNELS: readonly StaffNotifyChannel[] = ['sms', 'email', 'push'];

export type StaffNotifyMatrix = Record<StaffNotifyEvent, Record<StaffNotifyChannel, boolean>>;

export interface StaffNotifyPrefs {
  staffId: Id;
  view: StaffNotifyView;
  matrix: StaffNotifyMatrix;
  /** F-05-057: без галочки — SMS/Email/пуш сотруднику приходят без имени и телефона клиента */
  sendClientContacts: boolean;
}

/**
 * 06.10.2026: пуш о записях мастера включён по умолчанию (SMS и Email платные — выключены). У Altegio все галочки
 * выключены (F-05-056), и мастер не узнаёт о записях, пока владелец не настроит карточку; у нас — сразу. Тот же список
 * на сервере (modules/notify/notify-more.service.ts::defaultStaffPushOn) — по нему же уходят пуши персоналу.
 */
export const STAFF_PUSH_DEFAULT_ON: readonly StaffNotifyEvent[] = ['createdByClient', 'createdByAdmin', 'deleted', 'moved', 'cancelledByAdmin'];

function emptyStaffNotifyMatrix(): StaffNotifyMatrix {
  return STAFF_NOTIFY_EVENTS.reduce((acc, code) => {
    acc[code] = { sms: false, email: false, push: STAFF_PUSH_DEFAULT_ON.includes(code) };
    return acc;
  }, {} as StaffNotifyMatrix);
}

/** Галочки по умолчанию: SMS/Email выключены (F-05-056), пуш о записях — включён (см. STAFF_PUSH_DEFAULT_ON) */
export function defaultStaffNotifyPrefs(staffId: Id): StaffNotifyPrefs {
  return { staffId, view: 'byAccess', matrix: emptyStaffNotifyMatrix(), sendClientContacts: false };
}

// ──────────────────── Приглашение сотрудника в систему (F-05-063) ────────────────────

export type StaffInviteStatus = 'none' | 'pending' | 'accepted' | 'revoked';

export interface StaffInvite {
  staffId: Id;
  status: StaffInviteStatus;
  /** Телефон или email, на который отправлено приглашение */
  target: string;
  token: string;
  sentAt: ISODateTime;
}

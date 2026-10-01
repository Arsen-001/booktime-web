/**
 * Типы раздела «online». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 */
import type { DistrictId, Id, ISODate, ISODateTime, LocaleCode, LocalizedText, Money, Minutes, TimeHM, Workplace } from '@/domain/core';

/** Тип ссылки (F-03-005): общая — клиент сам выбирает мастера; сетевая — одна форма на все филиалы */
export type LinkKind = 'normal' | 'network';

/** Какие услуги доступны по ссылке (F-03-006) */
export type LinkBookingType = 'individual' | 'group' | 'mixed';

/** Поколение виджета, которым сделана запись (F-03-139) — у нас всегда одно актуальное, храним на будущее */
export type WidgetGeneration = 'new';

/** Устройство, с которого пришла запись (F-03-123) */
export type BookingDevice = 'mobile' | 'desktop';

/**
 * Дополнительные данные онлайн-записи о конкретной записи ядра (Booking.source уже 'link' | 'widget',
 * но откуда именно — какая ссылка/форма, каким устройством, версией виджета — храним здесь: ключ Booking.id).
 */
export interface OnlineBookingMeta {
  bookingId: Id;
  linkId?: Id;
  formId?: string;
  widgetGen: WidgetGeneration;
  device: BookingDevice;
  /** Неугадываемый хэш для страницы «моя запись» без входа (F-03-098) */
  accessHash: string;
  /** Когда клиент захотел получить пуш-напоминание (F-03-092). Нет поля — напоминание по умолчанию */
  reminderMinutesBefore?: number;
  /** Номер подтверждён кодом (F-03-077, F-03-078) */
  phoneVerified?: boolean;
  /** Адрес клиента для записи на выезд (F-00-080) — своё поле, в ядре Booking адреса выезда нет */
  visitAddress?: string;
  /** Мастера назначила система по режиму «Любой специалист» (F-03-069) — метка «Специалист не важен» */
  anySpecialist?: boolean;
  /** Когда клиент отправил запись (F-00-067) — для «ждёт N мин» в /biz/online/requests, пока в ядре Booking нет своего createdAt */
  submittedAt?: ISODateTime;
  /** Email клиента, если поле не скрыто (F-03-071) */
  email?: string;
  lastName?: string;
  patronymic?: string;
  /** Ответы своих полей экрана данных (F-03-073) — ключ CustomClientField.id */
  customFieldValues?: Record<string, string>;
  /** Запись — часть пакета (F-03-130): OnlinePackage.id и общий id группы связанных записей */
  packageId?: Id;
  packageGroupId?: Id;
  /** F-16-090: клиент записался на групповое событие по действующему абонементу — визит без оплаты */
  paidByMembership?: boolean;
  /**
   * О6: клиент нажал «Я оплатил» — оплата «на проверке» у салона (статус остаётся awaiting_prepayment,
   * слот держится, запись видна в «Заявках» с кнопкой «Деньги пришли»). Нет поля — клиент ещё не сообщал.
   */
  prepaymentReportedAt?: ISODateTime;
  /**
   * О6: без предоплаты запись ждала бы подтверждения мастера (confirmMode 'manual', выезд, «только мои клиенты») —
   * после «Деньги пришли» она идёт в awaiting_confirmation, а не сразу в scheduled.
   */
  confirmAfterPayment?: boolean;
  /** О20: причина отмены, которую клиент выбрал сам (необязательно) */
  cancelReasonText?: string;
  /** О28: клиент взял предложенное мастером окно — эта заявка снята, новая запись (id и хэш ссылки) */
  /** Заявку заменила новая запись (О28). `hash` — ссылка к ней: не хранится, его добавляет чтение по ссылке старой заявки */
  replacedBy?: { bookingId: Id; hash?: string; start: string };
  /** О28: «Другое время» — окна, которые мастер предложил клиенту вместо запрошенного (время начала) */
  offeredStarts?: ISODateTime[];
}

/**
 * ⭐ Наши правила мастера для онлайн-записи (F-00-066, F-00-067, F-03-066, F-03-067, F-00-079, F-00-080):
 * своих полей в ядре нет (Staff уже несёт confirmMode/accepts/workplaces/districts), поэтому то, что
 * специфично онлайн-записи — сроки самостоятельного переноса/отмены, доплату и время на дорогу для
 * выезда, «в отпуске до» — храним в своём срезе, ключ Staff.id. Нет записи — действуют дефолты ниже.
 */
export interface StaffOnlineRules {
  staffId: Id;
  /** За сколько часов до начала клиент ещё может сам перенести запись (F-03-066) */
  rescheduleWindowHours: number;
  /** За сколько часов до начала клиент ещё может бесплатно отменить запись (F-03-067) */
  cancelWindowHours: number;
  /** Разрешён ли клиенту самостоятельный перенос онлайн (F-03-066). По умолчанию — да */
  allowReschedule?: boolean;
  /** Разрешена ли клиенту самостоятельная отмена онлайн (F-03-067). По умолчанию — да */
  allowCancel?: boolean;
  /** Разрешить перенос ЗАПИСИ С ПРЕДОПЛАТОЙ — отдельное разрешение, по умолчанию НЕТ (F-03-066) */
  allowReschedulePrepaid?: boolean;
  /**
   * Разрешить отмену ЗАПИСИ С ПРЕДОПЛАТОЙ (F-03-067). ⭐ По умолчанию — ДА (владелец, 29.09.2026): до срока мастера
   * предоплата возвращается, позже — остаётся мастеру (keepPrepaymentOnLateCancel). У Altegio по умолчанию нет.
   */
  allowCancelPrepaid?: boolean;
  /**
   * ⭐ В-04: клиент отменил позже срока бесплатной отмены — предоплата остаётся мастеру (время уже не занять).
   * По умолчанию — да; раньше срока предоплата возвращается всегда.
   */
  keepPrepaymentOnLateCancel?: boolean;
  /** Доплата за выезд, ֏ (F-00-080) */
  travelFee?: Money;
  /** Время на дорогу, мин — закладывается перед окном выезда (F-00-080) */
  travelTimeMin?: Minutes;
  /** «В отпуске до» — своя пауза онлайн-записи для одного мастера (F-03-142) */
  vacationUntil?: ISODate;
  /** «Пропуск выбора сотрудника» — участвует в подборе при режиме «Любой специалист» (F-03-069). По умолчанию — да */
  allowAnyStaffAssignment?: boolean;
  /**
   * Политика оплаты — депозит или гарантия картой (F-03-095). ⭐ По нашему решению — без онлайн-эквайринга:
   * «депозит» здесь означает ручную частичную предоплату по реквизитам (тот же механизм, что и
   * обязательная 100% F-03-094/Staff.prepayment, но частичная сумма и НЕ обязательная сама по себе —
   * применяется как отдельная политика отмены/гарантии); «гарантия картой» у нас демо-текстом — карту
   * не привязываем и не проверяем (эквайринга нет). Нет значения или 'none' — политики нет.
   */
  depositPolicyKind?: 'deposit' | 'cardGuarantee';
  /** Сумма депозита, ֏ — обязательна при `depositPolicyKind === 'deposit'` */
  depositAmount?: Money;
  /** Штраф за неявку сверх депозита/гарантии, ֏ — 0/нет значения = штрафа сверх депозита нет */
  noShowPenalty?: Money;
  /**
   * «Добавлять ссылку „Закрыть окно“ в готовый текст клиента» (F-00-107, решение владельца 26.09.2026):
   * готовый текст для WhatsApp/Telegram (F-00-104, client) несёт `<origin>/claim/<token>` на ближайшее
   * окно этого мастера, только когда включено. По умолчанию — да (нет поля = включено, как и у остальных
   * булевых правил здесь).
   */
  addClaimLinkToMessage?: boolean;
}

export const DEFAULT_STAFF_ONLINE_RULES: Omit<StaffOnlineRules, 'staffId'> = {
  rescheduleWindowHours: 3,
  cancelWindowHours: 3,
  allowReschedule: true,
  allowCancel: true,
  allowReschedulePrepaid: false,
  allowCancelPrepaid: true,
  allowAnyStaffAssignment: true,
  addClaimLinkToMessage: true,
};

/** ⭐ Правила онлайн-записи всей локации бизнеса — своё поле, храним в срезе (F-03-079, F-03-142) */
export interface BusinessOnlineRules {
  businessId: Id;
  /** Текст согласия на обработку персональных данных, на трёх языках (F-03-079) */
  consentText: LocalizedText;
  /** «Приостановить онлайн-запись до…» для всей локации (F-03-142) */
  pauseUntil?: ISODate;
  /** «Разрешить запись к любому специалисту» для всех ссылок бизнеса (F-03-069, первая галочка) */
  allowAnyStaffForAllLinks?: boolean;
  /**
   * Формат времени в виджете и уведомлениях (F-03-116). ⭐ По нашему решению страна/город/пояс не
   * настраиваются — рынок фиксирован (Армения, Ереван, UTC+4, +374, F-00-002) и не меняется из кабинета;
   * настраивается только цикл часов. Нет значения — 24 ч (формат даты всегда «ДД.ММ.ГГГГ»).
   */
  hourCycle?: '24' | '12';
  /**
   * Отзывы: «только звёздочка» (наше решение, по умолчанию) или «оценка 1–5 и текст» — 1:1 с Altegio, с
   * платформенной модерацией текста (В-24, F-00-116, F-03-105, F-12-068/069, F-14-013/014). Нет значения — 'star'.
   */
  reviewMode?: ReviewMode;
  /**
   * О1 «Когда можно записаться»: на сколько дней вперёд открыт календарь клиента (7/14/30/60/90).
   * Нет значения — DEFAULT_MAX_DAYS_AHEAD.
   */
  maxDaysAhead?: number;
  /**
   * О1/О25 «Сотрудник для всех онлайн-записей» — общее для бизнеса (раньше жило в одной ссылке). Ссылка со своим
   * `staffForAllBookings` главнее; нет обоих — клиент выбирает специалиста сам.
   */
  staffForAllBookings?: Id;
}

/** О1: горизонт записи по умолчанию — 60 дней вперёд */
export const DEFAULT_MAX_DAYS_AHEAD = 60;

/** Отзывы: только звёздочка (наше, по умолчанию) или оценка 1–5 + текст (1:1 с Altegio) — В-24 */
export type ReviewMode = 'star' | 'text';

export function reviewModeOf(rules: Pick<BusinessOnlineRules, 'reviewMode'>): ReviewMode {
  return rules.reviewMode ?? 'star';
}

/** Часовой пояс рынка — фиксирован (F-03-116, ⭐ F-00-002): весь виджет и напоминания считаются по нему */
export const MARKET_TIMEZONE_LABEL = 'Ереван (UTC+4)';

export const DEFAULT_CONSENT_TEXT: LocalizedText = {
  ru: 'Записываясь, вы соглашаетесь на обработку персональных данных (имя, телефон) для организации записи на услугу.',
  en: 'By booking, you agree to the processing of your personal data (name, phone) to arrange the appointment.',
  hy: 'Ամրագրելով՝ դուք համաձայն եք անձնական տվյալների (անուն, հեռախոս) մշակմանը՝ ծառայության գրանցումը կազմակերպելու համար։',
};

// ─────────────────────────── b03: формат записи, шаги, дизайн ссылки ───────────────────────────

/** Сценарий прохождения записи клиентом (F-03-015) */
export type BookingFlow = 'stepwise' | 'shortStepwise' | 'menu';

/** Шаги пути записи, которые можно переставлять/переименовывать/скрывать (F-03-016…020) */
export type StepKey = 'staff' | 'service' | 'time';

export const STEP_KEYS: StepKey[] = ['service', 'staff', 'time'];

/**
 * Порядок шагов в формате «Короткий пошаговый» — фиксирован, менять нельзя (F-03-015):
 * всегда услуги → сотрудник → дата и время.
 */
export const SHORT_STEPWISE_ORDER: StepKey[] = ['service', 'staff', 'time'];

/** Что показывать у мастера на шаге выбора (F-03-017) */
export type StaffDisplayField = 'specialty' | 'position';

/** Вид категорий услуг на шаге услуг (F-03-020) */
export type CategoryDisplay = 'tags' | 'list';

/** Тема виджета (F-03-023) */
export type WidgetTheme = 'light' | 'dark';

/** Угол плавающей кнопки на сайте (F-03-028) */
export type ButtonCorner = 'br' | 'tr' | 'bl' | 'tl';

/** Сторона, с которой выезжает панель виджета (F-03-028) */
export type WidgetSide = 'right' | 'left';

export interface WebsiteButtonConfig {
  show: boolean;
  position: ButtonCorner;
  widgetSide: WidgetSide;
  /** HEX — цвет как данные, не токен темы (F-03-028; отдельно от цвета кнопок внутри виджета F-03-024) */
  color: string;
  animation: boolean;
}

export const DEFAULT_WEBSITE_BUTTON: WebsiteButtonConfig = {
  show: true,
  position: 'br',
  widgetSide: 'right',
  color: '#3b32c9', // tokens-ok — цвет виджета по умолчанию — данные настройки
  animation: true,
};

/** Домены для персональной ссылки (F-03-037) — ⭐ имя продукта не выбрано (F-00-208), placeholder, наш домен (не копия Altegio) */
/** О29: адреса ссылок — только наш домен (booktime.am, В-35); чужие zapis.link / rsrv.link убраны */
export const LINK_DOMAINS = ['booktime.am'] as const;
export type LinkDomain = (typeof LINK_DOMAINS)[number];

export interface BookingLink {
  id: Id;
  businessId: Id;
  locationId?: Id;
  /** Сеть, чьи филиалы клиент выбирает первым шагом — только при kind==='network' (F-03-008) */
  networkId?: Id;
  /** Видно только сотрудникам кабинета, не клиентам (F-03-006) */
  name: string;
  description?: string;
  kind: LinkKind;
  bookingType: LinkBookingType;
  defaultLocale: LocaleCode;
  /** Ссылка «для сотрудника» (F-03-005) — ведёт сразу к нему, шаг выбора мастера пропускается */
  staffId?: Id;
  primary: boolean;
  /** Короткий номер формы: часть адреса /b/<slug>/f/<formId> и кода кнопки (F-03-009) */
  formId: string;
  createdAt: ISODateTime;

  // ── формат и шаги (F-03-015…021) ──
  bookingFlow: BookingFlow;
  stepOrder: StepKey[];
  stepHidden: Partial<Record<StepKey, boolean>>;
  stepLabels: Partial<Record<StepKey, string>>;
  /** Предвыбранный мастер шага; 'any' = режим «Любой специалист» (F-03-017, F-03-069) */
  preselectedStaffId?: Id | 'any';
  preselectedServiceId?: Id;
  staffDisplayField: StaffDisplayField;
  categoryDisplay: CategoryDisplay;
  /** «Сотрудник для онлайн-записи»: все записи локации — к нему; нет значения = «Любой» (F-03-070) */
  staffForAllBookings?: Id;

  // ── дизайн (F-03-022…025) ──
  theme: WidgetTheme;
  /** HEX — цвет кнопок и иконок внутри виджета, данные (F-03-024). Дефолт из справки — #060F07 */
  widgetButtonColor: string;
  hidePrice?: boolean;
  hideDuration?: boolean;
  /** Переименование кнопки «Записаться» (F-03-022) */
  submitButtonLabel?: string;
  heroImageUrl?: string;
  /** Картинка первого экрана видна клиентам только после нашей проверки (F-00-168, F-03-025) */
  heroImageStatus?: 'pending' | 'approved';

  // ── кнопка на сайте (F-03-028) ──
  websiteButton: WebsiteButtonConfig;

  // ── персональный домен (F-03-037) ──
  subdomain?: string;
  domain?: LinkDomain;

  // ── аналитика (F-03-117…120) ──
  metaPixelId?: string;
  ga4StreamId?: string;
  passClientId?: boolean;
  /** Индекс пользовательского параметра GA, куда пишем Client ID (F-03-120) */
  gaClientIdParamIndex?: string;

  // ── онлайн-продажи абонементов и сертификатов (F-03-107) ──
  /** Id сети, чьи настройки продаж используются, или отсутствует/'none' — «Нет продажи» (по умолчанию) */
  onlineSalesNetworkId?: Id;
}

/** Заявка на подтверждение мастера — запись из очереди /biz/online/requests (F-00-067, F-03-127) */
export interface OnlineRequestView {
  bookingId: Id;
  staffId: Id;
  clientId: Id | undefined;
  clientName: string;
  clientPhone: string;
  clientNoShowCount: number;
  clientBlocked: boolean;
  start: ISODateTime;
  durationMin: Minutes;
  serviceNames: string[];
  workplace: Workplace;
  district?: DistrictId;
  address?: string;
  /** Когда клиент отправил заявку (F-00-067) — нет данных (старые демо-записи) → undefined, бейдж «ждёт N мин» не показываем */
  submittedAt?: ISODateTime;
  /** О28: сколько прошлых визитов у клиента в этом бизнесе (без этой заявки и отменённых) — 0 = «новый клиент» */
  clientVisits: number;
  /** О28: комментарий клиента к записи */
  comment?: string;
  /** О6: клиент нажал «Я оплатил» — сумма и когда; заявка ждёт «Деньги пришли», а не «Подтвердить» */
  prepaymentReported?: { amount: number; at: ISODateTime };
  /** О28: мастер уже предложил клиенту другие окна (время начала) */
  offeredStarts?: ISODateTime[];
  /** ⭐ Предоплата нужна, потому что клиент не пришёл к этому мастеру `noShows` раз за `months` месяцев (Booking.prepayment.reason) */
  prepaymentNoShows?: { noShows: number; months: number };
}

// ─────────────────────────── b03: экран данных клиента (F-03-071…075) ───────────────────────────

export type ClientFieldType = 'text' | 'number' | 'date' | 'select';
export type ClientFieldTarget = 'client' | 'booking';

export interface CustomClientField {
  id: Id;
  label: string;
  type: ClientFieldType;
  target: ClientFieldTarget;
  required: boolean;
  /** Значения через запятую (тип «Выбор значений из списка», F-03-073) */
  options?: string[];
  order: number;
}

/**
 * Дополнительное поле СЕТИ (F-03-074) — общее для всех локаций сети, настраивается в кабинете сети
 * («Настройки → Дополнительные поля»), а не в настройке онлайн-записи одного бизнеса, поэтому у него
 * своя настройка видимости по локациям вместо привязки к одному businessId.
 * ⭐ по нашему решению кабинет сети (раздел network) пока не даёт создавать эти поля — до тех пор online
 * читает демо-набор из среза (см. qa/requests/online.md); тип «Дата и время» не поддерживается нигде в
 * `ClientFieldType`, поэтому его технически нельзя завести (F-03-074, второй пункт «Готово, когда»).
 */
export interface NetworkExtraField extends CustomClientField {
  /** Ключ-значение для API (F-03-074) — сейчас не используется online, показываем в кабинете сети */
  apiKey: string;
  editableByUser: boolean;
  showInAdminUi: boolean;
  alwaysShowInEditWindow: boolean;
  requiredOnArrived: boolean;
  /** «Отображать поле в виджете на экране ввода данных» */
  showInWidget: boolean;
  /** «Доступно в локациях» — обязательно выбрать хотя бы одну, иначе поле нигде не работает (1579) */
  locationIds: Id[];
}

/**
 * ⭐ Наши настройки экрана данных клиента — своё поле, храним по бизнесу (в вебе у Altegio это уровень
 * локации; у нас один экран настроек онлайн-записи, поэтому — по бизнесу, F-03-071…075).
 */
export interface ClientFieldsConfig {
  businessId: Id;
  commentHidden: boolean;
  commentRequired: boolean;
  /** Своя подпись поля «Комментарий», до 60 символов (F-03-071) */
  commentLabel: string;
  emailHidden: boolean;
  emailRequired: boolean;
  /**
   * ❓ по ТЗ обязательность фамилии/отчества зависит от их включения в Настройках → Цифровой журнал
   * (раздел «Журнал») — этого переключателя у нас пока нет, поэтому «показывать» держим здесь же
   * (assumed, см. qa/requests/online.md: точнее было бы читать флаг из раздела «Журнал»).
   */
  lastNameEnabled: boolean;
  lastNameRequired: boolean;
  patronymicEnabled: boolean;
  patronymicRequired: boolean;
  customFields: CustomClientField[];
  /** «Текст в виджете» — свои правила посещения и т.п. на экране данных (F-03-075) */
  widgetText: LocalizedText;
  /** Бренды партнёров на странице записи (F-03-104) */
  partnerBrands: string[];
}

export const DEFAULT_CLIENT_FIELDS: Omit<ClientFieldsConfig, 'businessId'> = {
  commentHidden: false,
  commentRequired: false,
  commentLabel: 'Комментарий к записи',
  emailHidden: false,
  emailRequired: false,
  lastNameEnabled: false,
  lastNameRequired: false,
  patronymicEnabled: false,
  patronymicRequired: false,
  customFields: [],
  widgetText: { ru: '', en: '', hy: '' },
  partnerBrands: [],
};

// ─────────────────────────── b04: карточки услуги/сотрудника, сеть, групповые, оплата, кабинет, аналитика ───────────────────────────

/** Дни, доступные для онлайн-записи услуги/пакета (F-03-129, F-03-130) */
export type ServiceAvailabilityDays = 'any' | 'weekdays' | 'weekends' | 'custom';

export interface ServiceAvailability {
  /** «В какой период доступна запись»: период с–по (включительно). Нет полей — без ограничения */
  periodFrom?: ISODate;
  periodTo?: ISODate;
  /** «В какое время доступна запись», граница включительная (F-03-129: 12:00–15:00 → последняя запись в 15:00) */
  hoursFrom?: TimeHM;
  hoursTo?: TimeHM;
  days: ServiceAvailabilityDays;
  /** Даты при `days: 'custom'` */
  customDates?: ISODate[];
}

/**
 * ⭐ Наши настройки онлайн-записи услуги (F-03-129) и пакета (F-03-130) — своих полей в `Service` ядра
 * нет (только `onlineBookable`), поэтому онлайн-название/описание/картинку/ограничение по времени храним
 * здесь, ключ Service.id. Нет записи — «Название для онлайн-записи» = Service.name (F-03-129, п. «Готово, когда»).
 */
export interface ServiceOnlineConfig {
  serviceId: Id;
  onlineName?: LocalizedText;
  description?: LocalizedText;
  imageUrl?: string;
  availability?: ServiceAvailability;
  /** «Запретить онлайн-запись без абонемента» (F-03-096) — для групповых («Запись по абонементу») то же поле */
  subscriptionOnly?: boolean;
  /**
   * F-03-096 (исправлено): раньше «любой активный абонемент» подходил к любой такой услуге — без привязки
   * к конкретному типу. `Subscription` (раздел clients) не хранит список услуг, которые он покрывает (см.
   * qa/requests/online.md — просьба добавить `serviceIds`/`planId` в саму сущность абонемента); пока этого
   * нет, привязываем по НАЗВАНИЮ абонемента, которое владелец сам вводит здесь и которое должно совпадать с
   * названием, под которым абонемент продают в разделе «Клиенты» (например «Абонемент на маникюр»). Пусто —
   * прежнее поведение (годится любой активный абонемент) — assumed, временная мера до общего поля.
   */
  subscriptionPlanName?: string;
}

/**
 * Пакет услуг (комплекс), F-03-130. ⭐ По ТЗ (00-our-decisions.md, «оставлены себе») пакеты СОЗДАЁТ раздел
 * «Услуги»/resources, у нас только выбор и запись в виджете — но пока там нет ни экрана, ни сущности
 * (просьба записана в qa/requests/online.md), сущность и минимальная настройка живут здесь, своим ключом
 * (`pkg_…`, не Service.id), чтобы путь записи /b/[slug]/book и вкладка карточки услуги были рабочими на
 * моках. Когда раздел построит настоящие пакеты — эти данные переносятся туда без смены API виджета
 * (getOnlinePackages/getOnlinePackage у online.ts останутся, начнут читать чужой срез).
 */
export type PackageMode = 'simultaneous' | 'sequentialSame' | 'sequentialMulti';

export interface OnlinePackage {
  id: Id;
  businessId: Id;
  /** Основное название (видно и в кабинете, и как дефолт в виджете — как у Service.name) */
  name: LocalizedText;
  /** 2–10 услуг пакета (Service.id ядра) */
  serviceIds: Id[];
  mode: PackageMode;
  online: boolean;
  onlineName?: LocalizedText;
  description?: LocalizedText;
  imageUrl?: string;
  availability?: ServiceAvailability;
  createdAt: ISODateTime;
}

/** Мастера, выбранные клиентом на каждую услугу пакета при `mode: 'sequentialMulti'` (F-03-130) — ключ Service.id */
export type PackageStaffPicks = Record<Id, Id>;

/**
 * ⭐ По нашему решению (F-00-101, F-00-102) клиент сам встаёт в лист ожидания на пустой день или у занятого
 * мастера прямо в виджете (F-03-086) — у Altegio эта функция закрыта, ведёт только администратор. Заявка ложится в ОДИН
 * лист ожидания бизнеса (resources.waitlist / waitlist_entries, владелец 30.09.2026) — экран /biz/waitlist и панель журнала.
 * Это ВИД заявки для виджета («вы в листе на этот день»), отдельно не хранится.
 */
export interface WaitlistRequest {
  id: Id;
  businessId: Id;
  locationId?: Id;
  staffId: Id;
  serviceId: Id;
  /** День, на который клиент хочет запись — «любое время в течение дня» (C-05) */
  date: ISODate;
  clientName: string;
  clientPhone: string;
  comment?: string;
  status: 'pending' | 'notified' | 'booked' | 'cancelled';
  createdAt: ISODateTime;
}

/**
 * Пара «мастер × услуга»: отдельный переключатель онлайн-записи (F-03-133) — своего поля в ядре нет
 * (`Staff.serviceIds` — просто список назначенных услуг, без online-флага на пару). Ключ — `${staffId}:${serviceId}`.
 * Нет записи — включено (услугу мастера можно записать онлайн). У ГРУППОВЫХ услуг переключателя по мастеру
 * нет — включается только целиком у услуги (F-03-133, добавлено проверкой 2).
 */
export type StaffServiceOnlineFlags = Record<string, boolean>;

export function staffServicePairKey(staffId: Id, serviceId: Id): string {
  return `${staffId}:${serviceId}`;
}

/** Экраны, где может показаться промоблок (F-03-106) */
export type PromoScreen = 'menu' | 'service' | 'staff' | 'success';

export interface PromoBlock {
  id: Id;
  businessId: Id;
  /** До 50 символов, обязательно */
  title: string;
  /** До 220 символов */
  description?: string;
  imageUrl?: string;
  /** До 20 символов */
  buttonText?: string;
  buttonLink?: string;
  screens: PromoScreen[];
  /** Новые тексты и картинки — только после нашей проверки (F-00-168, F-03-106) */
  status: 'pending' | 'approved' | 'rejected';
  /** Причина отказа — видна владельцу в кабинете, только при status === 'rejected' */
  reasonNote?: string;
  enabled: boolean;
  createdAt: ISODateTime;
}

/** Звёздочка вместо отзывов (F-00-116/117, F-03-105) — только число, без текста и оценки 1–5 */
export type ReviewTarget = 'business' | 'staff';

export interface Review {
  id: Id;
  businessId: Id;
  target: ReviewTarget;
  /** Id мастера при target==='staff'; для 'business' совпадает с businessId */
  targetId: Id;
  bookingId: Id;
  clientId: Id;
  createdAt: ISODateTime;
}

/** Событие пути записи для аналитики (F-03-121) — последние ~200 на ссылку, для журнала в настройке ссылки */
export type WidgetEventType =
  | 'widget_loaded'
  | 'service_selected'
  | 'master_selected'
  | 'date_selected'
  | 'time_selected'
  | 'booked'
  | 'clicked_promo_link'
  // F-16-093: шаги групповой/смешанной записи — отдельные от индивидуальных, чтобы в GA/Pixel можно
  // было завести цель именно на групповую запись (справка 1246).
  | 'activity_type_showed'
  | 'individual_booking_selected'
  | 'group_activity_selected'
  | 'group_events_date_clicked'
  | 'group_personal_data_filled'
  | 'group_sms_code_confirmed'
  | 'group_record_created';

export interface WidgetEvent {
  id: Id;
  linkId: Id;
  businessId: Id;
  type: WidgetEventType;
  at: ISODateTime;
}

// ─────────────────────────── b04: другие каналы записи (F-03-036…046, F-03-048, F-03-052) ───────────────────────────

/**
 * ⭐ Внешние каналы записи и API — за пределами кабинета (F-03-036, «Понятно?» 🔒: работа этих каналов
 * не проверялась ни у Altegio, ни в нашем демо), у нас показываем карточками «подключить» с демо-состоянием:
 * подключение переключает флаг в своём срезе, реального похода во внешний сервис нет — пометка «демо» в тексте.
 */
export type IntegrationId = 'ownApi' | 'metaBookNow' | 'googleReserve' | 'yandexMaps' | 'twoGis' | 'earlyone' | 'doqKz' | 'thirdPartyBots';

export interface IntegrationCatalogEntry {
  id: IntegrationId;
  /** По справке недоступно в Армении на момент постройки (F-03-040 Google, F-03-042 2GIS) — подключить нельзя, только карточка «на будущее» */
  availableInArmenia: boolean;
  /** Нужна оплаченная лицензия, на пробном периоде нельзя (F-03-041 Яндекс.Карты) */
  requiresPaidLicense?: boolean;
}

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  { id: 'ownApi', availableInArmenia: true },
  { id: 'metaBookNow', availableInArmenia: true },
  { id: 'googleReserve', availableInArmenia: false },
  { id: 'yandexMaps', availableInArmenia: true, requiresPaidLicense: true },
  { id: 'twoGis', availableInArmenia: false },
  { id: 'earlyone', availableInArmenia: true },
  { id: 'doqKz', availableInArmenia: false },
  { id: 'thirdPartyBots', availableInArmenia: true },
];

export interface IntegrationConnection {
  id: IntegrationId;
  connected: boolean;
  connectedAt?: ISODateTime;
}

/** Свой ключ API для F-03-036 «Свой виджет на API» — демо-ключ, генерируется владельцем один раз */
export interface ApiCredentials {
  businessId: Id;
  apiKey?: string;
  createdAt?: ISODateTime;
}

/** «Мобильные приложения» (F-03-048): свои ссылки клиенту + заявка на брендированное приложение Altegio */
export interface MobileAppLinks {
  businessId: Id;
  iosUrl?: string;
  androidUrl?: string;
  consultRequestedAt?: ISODateTime;
}

/**
 * ⭐ «Кого позвать» (F-03-052) по нашему решению — своя реализация поверх свободных окон виджета
 * (getWidgetFreeSlots) и истории записей клиента, без стороннего ИИ-бота: список записан здесь,
 * чтобы под ним не завести бесконечно растущий журнал одинаковых приглашений на одно и то же окно.
 */
export interface SlotInvite {
  id: Id;
  businessId: Id;
  staffId: Id;
  clientId: Id;
  clientName: string;
  slotStart: ISODateTime;
  serviceId?: Id;
  message: string;
  sentAt: ISODateTime;
}

/** Групповая запись: сколько мест сразу и «Записаться ещё» (F-03-076, F-03-102) — своя настройка ссылки */
export interface GroupBookingRules {
  linkId: Id;
  /** «Добавлять дополнительные места в групповые услуги» + максимум мест в одной записи (F-03-076) */
  allowExtraSeats: boolean;
  maxSeatsPerBooking: number;
  /** «Разрешить клиентам записываться на несколько событий» + максимум за раз, 1–10 (F-03-102) */
  allowMultiEvent: boolean;
  maxEventsPerBooking: number;
}

export const DEFAULT_GROUP_BOOKING_RULES: Omit<GroupBookingRules, 'linkId'> = {
  allowExtraSeats: false,
  maxSeatsPerBooking: 1,
  allowMultiEvent: false,
  maxEventsPerBooking: 3,
};

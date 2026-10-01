import type {
  AiAssistantToken,
  AppInstall,
  AppReview,
  CatalogApp,
  CategorySubscription,
  DeveloperAccount,
  DevApp,
  IntegrationCategoryId,
  PartnerApiKey,
  PartnerApplication,
  PromoBlock,
  RequestedScope,
  UserApiToken,
  WebhookConfig,
  WebhookDelivery,
} from '@/domain/integrations';
import { activationDeadline } from '@/domain/integrations';
import type { CoreData } from '@/domain/core';
import { dayjs, toISODateTime } from '@/lib/date';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «integrations» (F-13-*, пачки b01 + b02 — кабинет разработчика, API-ключи,
 * вебхуки, MCP). Принадлежит разделу. Каталог — данные (без картинок и запросов наружу), подключения —
 * по businessId + locationId. Кабинет разработчика и его приложения — по ownerStaffId (F-13-028: виден
 * только тому, кто завёл). Меняете форму данных — поднимите version.
 */
export interface IntegrationsState {
  apps: CatalogApp[];
  installs: AppInstall[];
  reviews: AppReview[];
  subscriptions: CategorySubscription[];
  developerAccounts: DeveloperAccount[];
  devApps: DevApp[];
  partnerApiKeys: PartnerApiKey[];
  userApiTokens: UserApiToken[];
  aiTokens: AiAssistantToken[];
  webhookConfigs: WebhookConfig[];
  webhookDeliveries: WebhookDelivery[];
  /** b03, F-13-172: промоблоки в виджете онлайн-записи */
  promoBlocks: PromoBlock[];
  /** b04, F-13-137: заявки партнёру напрямую (2GIS, Earlyone, DOQ.kz — без листа подключения) */
  partnerApplications: PartnerApplication[];
}

// ─────────────────────────── Каталог (F-13-210): 40 карточек армянского каталога + зарубежные + встроенные ───────────────────────────

type Row = [
  category: IntegrationCategoryId,
  name: string,
  subtitle: string,
  developer: string,
  priceModel: CatalogApp['price']['model'],
  amount?: number,
  currency?: 'AMD' | 'USD' | 'EUR',
  channels?: CatalogApp['channels'],
  /** b03: поля конкретных приложений, которых нет в общей раскладке (F-13-140…F-13-176) */
  extra?: Partial<CatalogApp>,
];

// Армянский каталог — 40 строк. Названия и цены партнёров — данные каталога (свои, не Altegio).
const AM_ROWS: Row[] = [
  // notifications — 7 общих + 18 из пачки b03 (F-13-139…F-13-166) — свои названия, функции Altegio 1:1
  [
    'notifications',
    'АрМ СМС Шлюз',
    'SMS-напоминания клиентам через агрегатора',
    'ООО «АрМ Телеком»',
    'perMessage',
    9,
    'AMD',
    ['sms'],
    {
      notifyAppKind: 'smsAggregator',
      notifyCapabilities: ['transactional', 'cascade'],
      smsAggregatorAuth: true,
    }, // F-13-155
  ],
  [
    'notifications',
    'ВатсЧат для бизнеса',
    'Рассылки и напоминания в WhatsApp с номера платформы',
    'WaConnect LLC',
    'perMessage',
    18,
    'AMD',
    ['whatsapp', 'waba'],
    {
      notifyAppKind: 'other',
      notifyCapabilities: ['transactional', 'bookingConfirm'],
      billsPerMessage: true,
    }, // F-13-141
  ],
  [
    'notifications',
    'Вайбер для бизнеса',
    'Официальные сообщения Viber Business',
    'Rakuten Viber',
    'freeTier',
    undefined,
    undefined,
    ['viber'],
  ],
  [
    'notifications',
    'Телеграм-бот уведомлений',
    'Бесплатные напоминания в Telegram',
    'BotStudio AM',
    'free',
    undefined,
    undefined,
    ['telegram'],
  ],
  [
    'notifications',
    'Почтальон — email-рассылки',
    'Письма клиентам и сводки бизнесу',
    'MailFlow',
    'freeTier',
    undefined,
    undefined,
    ['email'],
  ],
  [
    'notifications',
    'АвтоЗвонок',
    'Голосовой обзвон напоминаниями',
    'VoiceLine AM',
    'perMessage',
    25,
    'AMD',
    ['voice'],
  ],
  [
    'notifications',
    'WABA-шлюз «Ани» — свой номер',
    'Один номер для ручной переписки WhatsApp Business и для авторассылок Altegio',
    'Ani Cloud',
    'free',
    undefined,
    undefined,
    ['waba', 'whatsapp'],
    {
      notifyAppKind: 'other',
      notifyCapabilities: ['transactional', 'bookingConfirm'],
      whatsappNumberChoice: true,
      worksOnTrial: false,
    }, // F-13-142/F-13-143
  ],
  [
    'notifications',
    'Диалог+ — омниканальный чат-бот',
    '8 каналов сразу: WhatsApp, Telegram, Viber, SMS с каскадом',
    'DialogPlus AM',
    'fromPrice',
    10,
    'EUR',
    ['whatsapp', 'telegram', 'viber', 'sms', 'waba'],
    {
      notifyAppKind: 'chatbot',
      notifyCapabilities: [
        'cascade',
        'bookingConfirm',
        'reviewsOnMaps',
        'taskManagement',
      ],
    }, // F-13-144/145/148/150
  ],
  [
    'notifications',
    'ОтменаНоль — бот подтверждения записи',
    'Клиент подтверждает или переносит визит одним ответом',
    'ZeroNoShow AM',
    'fromPrice',
    5,
    'EUR',
    ['telegram', 'whatsapp'],
    {
      notifyAppKind: 'chatbot',
      notifyCapabilities: ['bookingConfirm', 'cascade'],
    }, // F-13-146/149/151/153
  ],
  [
    'notifications',
    'ВозвратКлиента — рассылки и карты отзывов',
    'Возврат «уснувших» клиентов и сбор отзывов на картах',
    'ReturnFlow AM',
    'fromPrice',
    50,
    'USD',
    ['whatsapp', 'telegram'],
    {
      notifyAppKind: 'chatbot',
      notifyCapabilities: [
        'retentionCampaigns',
        'rfm',
        'reviewsOnMaps',
        'negativeReviewIntercept',
      ],
    }, // F-13-147/152
  ],
  [
    'notifications',
    'КонтактЦентр Pro',
    'Общий ящик диалогов для команды: WhatsApp, Telegram, Viber, соцсети',
    'ContactCenter AM',
    'fromPrice',
    37,
    'USD',
    ['whatsapp', 'telegram', 'viber', 'waba', 'email'],
    {
      notifyAppKind: 'chatbot',
      notifyCapabilities: [
        'reportsAnalytics',
        'taskManagement',
        'bookingConfirm',
      ],
    }, // F-13-150
  ],
  [
    'notifications',
    'ГлобалSMS — SMS по 200+ странам',
    'Международный SMS-шлюз, оплата в валюте страны бизнеса',
    'GlobalSMS Gateway',
    'perMessage',
    12,
    'AMD',
    ['sms'],
    {
      notifyAppKind: 'smsAggregator',
      notifyCapabilities: ['transactional'],
      smsAggregatorAuth: true,
      countries: ['AM', 'GLOBAL'],
    }, // F-13-157/158/159/160/161/162/164
  ],
  [
    'notifications',
    'РегионSMS — местный агрегатор',
    'SMS у местного оператора; договор и ключ выдаёт поддержка',
    'RegionTelecom Partners',
    'perMessage',
    7,
    'AMD',
    ['sms'],
    {
      notifyAppKind: 'smsAggregator',
      notifyCapabilities: ['transactional'],
      connectedBySupport: true,
    }, // F-13-163
  ],
  [
    'notifications',
    'Фоновая музыка для салона',
    'Легальная лицензионная музыка с управлением со смартфона',
    'SalonSound AM',
    'trialDays',
    undefined,
    undefined,
    undefined,
    { notifyAppKind: 'other', countries: ['UA'] }, // F-13-166 — намеренно лежит не по смыслу категории, как у Altegio; только Украина, в армянском каталоге нет
  ],
  // telephony — 4
  [
    'telephony',
    'ОблакоТел АТС',
    'Виртуальная АТС для приёма звонков',
    'CloudTel',
    'fromPrice',
    12000,
    'AMD',
  ],
  [
    'telephony',
    'ЗвонМонитор',
    'Запись и прослушивание звонков',
    'CallRec',
    'freeTier',
  ],
  [
    'telephony',
    'РекламаЗвон — коллтрекинг',
    'Из какой рекламы пришёл звонок',
    'AdTrack AM',
    'fromPrice',
    9900,
    'AMD',
  ],
  [
    'telephony',
    'ТелСвязь IP',
    'IP-телефония для сотрудников',
    'TelSvyaz',
    'trialDays',
    undefined,
    undefined,
    undefined,
  ],
  // b05, F-13-099: виртуальная АТС Viva-MTS — первый кандидат телефонии для Армении
  [
    'telephony',
    'Viva-MTS Виртуальная АТС',
    'Приём звонков клиентов через сеть Viva-MTS',
    'Viva-MTS',
    'fromPrice',
    15000,
    'AMD',
    ['voice'],
    {
      telephonyPbx: true,
      features: [
        'Токен сети возьмите в «Сеть» → «Телефония» и вставьте здесь',
        'Статус подключения читается из настроек сети — если сеть не подключила АТС, карточка покажет «нет токена»',
        'После подключения входящий звонок открывает всплывающую карточку клиента в кабинете',
      ],
    },
  ],
  // marketing — 5
  [
    'marketing',
    'МаркетПочта',
    'Email-цепочки для возврата клиентов',
    'MarketPost',
    'freeTier',
  ],
  [
    'marketing',
    'РекламаБот',
    'Автоматические объявления в соцсетях',
    'AdBot',
    'fromPrice',
    19900,
    'AMD',
  ],
  [
    'marketing',
    'ОтзывыПро',
    'Сбор и публикация отзывов',
    'ReviewsPro AM',
    'free',
  ],
  [
    'marketing',
    'ПромоКод',
    'Купоны и промокоды для акций',
    'PromoCode',
    'free',
  ],
  // F-13-009: без явной цены — плитка без блока «Цена», карточка только с кнопкой «Подключить»
  [
    'marketing',
    'QR-визитка',
    'QR-код филиала для витрины и афиш',
    'QrCard',
    'none',
  ],
  // marketing → «Лояльность» (у нас без отдельной категории, ⭐ решение b03): промоблок виджета + Wallet-карты
  [
    'marketing',
    'Промоблок в виджете записи',
    'Акции, напоминание перед визитом, ссылка на соцсети — прямо в форме записи',
    'Наша платформа',
    'free',
    undefined,
    undefined,
    undefined,
    {
      promoBlockBuilder: true,
      requestedScopes: ['bookings', 'catalog'],
      multiLocation: true,
      worksOnTrial: true,
    }, // F-13-172
  ],
  [
    'marketing',
    'Штамп-карта в кошельке',
    'Электронные карты лояльности в Apple/Google Wallet — «10 визитов — 11-й бесплатно»',
    'StampWallet',
    'freeTier',
    undefined,
    undefined,
    undefined,
    { walletLoyaltyDemo: true, requestedScopes: ['clients', 'bookings'] }, // F-13-174
  ],
  [
    'marketing',
    'КартаБаланс Wallet',
    'Карта лояльности в Wallet: кэшбэк и скидки остаются в наших правилах',
    'BalanceCard.am',
    'freeTier',
    undefined,
    undefined,
    undefined,
    { walletLoyaltyDemo: true, requestedScopes: ['clients', 'money'] }, // F-13-175
  ],
  [
    'marketing',
    'LoyalPass — карта и Telegram-бот',
    'Карта в Wallet, пуши о балансе, гео-уведомления, запись через Telegram-бота',
    'LoyalPass',
    'fromPrice',
    15,
    'EUR',
    ['telegram'],
    { walletLoyaltyDemo: true, requestedScopes: ['clients', 'bookings'] }, // F-13-176
  ],
  [
    'marketing',
    'Карта клиента — базовая',
    'Именная карта клиента в кошельке телефона без печати пластика',
    'Наша платформа',
    'none',
    undefined,
    undefined,
    undefined,
    { walletLoyaltyDemo: true, requestedScopes: ['clients'] }, // F-13-211
  ],
  // F-06-192: фоновая музыка для салона (сенсорный маркетинг) — партнёр для Армении не выбран (❓),
  // поэтому карточка своя (не FireBrands) и явно демо: подключение открывает форму партнёра, а не
  // настоящий сервис. Раздел «Интеграции» — общий (не мой путь loyalty), правится по CONVENTIONS §1
  // третий проход: экран функции лояльности живёт здесь целиком, точечная правка каталога.
  [
    'marketing',
    'Атмосфера — музыка для салона (демо)',
    'Фоновые плейлисты под тип бизнеса, лицензия и авторские отчисления на стороне партнёра',
    'партнёр не выбран',
    'fromPrice',
    5000,
    'AMD',
    undefined,
    { requestedScopes: ['schedule'] }, // первый месяц бесплатно — как у партнёра в справке
  ],
  // social — 4
  [
    'social',
    'Директ-бот Instagram',
    'Автоответы и запись из Direct',
    'SocBot',
    'fromPrice',
    6900,
    'AMD',
  ],
  [
    'social',
    'Messenger-бот Facebook',
    'Запись прямо в переписке',
    'SocBot',
    'fromPrice',
    6900,
    'AMD',
  ],
  [
    'social',
    'Отзывы Google (импорт)',
    'Показывать отзывы Google на витрине',
    'ReviewsPro AM',
    'free',
  ],
  [
    'social',
    'TikTok-виджет записи',
    'Кнопка записи в шапке профиля',
    'SocBot',
    'testPeriod',
  ],
  // widgets — 4
  [
    'widgets',
    'ВебЗапись — виджет на сайт',
    'Онлайн-запись прямо на сайте бизнеса',
    'WebWidgets',
    'freeTier',
  ],
  [
    'widgets',
    'Кнопка WhatsApp на сайт',
    'Быстрый переход в чат с сайта',
    'WaConnect LLC',
    'free',
  ],
  [
    'widgets',
    'ЧатПлюс — онлайн-чат',
    'Чат на сайте с уведомлением в приложение',
    'ChatPlus',
    'fromPrice',
    5900,
    'AMD',
  ],
  [
    'widgets',
    'Виджет отзывов на сайт',
    'Лента отзывов на сайте бизнеса',
    'ReviewsPro AM',
    'free',
  ],
  // analytics — 3
  [
    'analytics',
    'Яндекс.Метрика',
    'Счётчик посещений публичной страницы',
    'Яндекс',
    'free',
  ],
  [
    'analytics',
    'Google Analytics',
    'Аналитика посещений и конверсий',
    'Google',
    'free',
  ],
  [
    'analytics',
    'ЗвонОтчёт — сквозная аналитика',
    'Откуда приходят клиенты и сколько платят',
    'AdTrack AM',
    'fromPrice',
    24900,
    'AMD',
  ],
  // accounting — 3
  [
    'accounting',
    '1С:Бухгалтерия — коннектор',
    'Выгрузка продаж и зарплат в 1С',
    '1С-Франчайзи Ани',
    'fromPrice',
    15000,
    'AMD',
  ],
  [
    'accounting',
    'АрмСофт Учёт',
    'Учёт для бухгалтерии Армении',
    'ArmSoft',
    'fromPrice',
    9900,
    'AMD',
  ],
  [
    'accounting',
    'Экспорт в Excel Про',
    'Автовыгрузка отчётов по расписанию',
    'ExportPro',
    'free',
  ],
  // maps — 2
  [
    'maps',
    'Google Business Profile',
    'Синхронизация часов работы и отзывов',
    'Google',
    'free',
  ],
  [
    'maps',
    'Яндекс Карты — синхронизация',
    'Часы работы и телефон на карте',
    'Яндекс',
    'free',
  ],
  // payments — 2 (Скоро)
  ['payments', 'Idram', 'Приём платежей Idram', 'Idram CJSC', 'comingSoon'],
  [
    'payments',
    'Telcell Wallet',
    'Приём платежей Telcell',
    'Telcell',
    'comingSoon',
  ],
  // fiscal — 1 (Скоро)
  [
    'fiscal',
    'ՀՀ e-Invoice синхронизация',
    'Электронные чеки по требованиям РА',
    'GovTech AM',
    'comingSoon',
  ],
  // other — 2
  [
    'other',
    'Zapier-мост',
    'Связать с тысячами других сервисов',
    'Zapier',
    'fromPrice',
    19,
    'USD',
  ],
  [
    'other',
    'Экспорт данных по расписанию',
    'Выгрузка в облако по расписанию',
    'ExportPro',
    'free',
  ],
  // chatbots — скрытая категория, 2
  [
    'chatbots',
    'Чат-бот записи для сайта',
    'Отвечает на вопросы и записывает сам',
    'BotStudio AM',
    'fromPrice',
    14900,
    'AMD',
  ],
  [
    'chatbots',
    'WhatsApp-бот с ИИ',
    'Записывает и напоминает в WhatsApp',
    'WaConnect LLC',
    'fromPrice',
    24900,
    'AMD',
    ['whatsapp'],
  ],
  // tips — скрытая категория, 1
  [
    'tips',
    'Чаевые мастеру онлайн',
    'QR на кассе — чаевые картой',
    'TipMe AM',
    'freeTier',
  ],
  // ─── b04: аналитика (F-13-079, F-13-080, F-13-085) ───
  [
    'analytics',
    'Гугл Аналитика',
    'Шлёт события виджета записи в GA4',
    'Наша платформа',
    'free',
    undefined,
    undefined,
    undefined,
    { gaStreamsApp: true },
  ],
  [
    'analytics',
    'Бизнес-аналитика Metrika360',
    'Ежедневная выгрузка данных в облачные дашборды',
    'Metrika360',
    'fromPrice',
    50,
    'USD',
    undefined,
    {
      viewerOnlyAnalytics: true,
      features: [
        'Общий дашборд, когортный анализ, отклонения',
        'Свободные и занятые слоты по мастерам',
        'RFM, ABC, план-факт, прогноз следующего визита',
        'Доступен тестовый период',
      ],
    },
  ],
  // ─── b04: ИИ-боты и ассистенты, доступные в Армении (F-13-106…F-13-120) ───
  [
    'aiAssistants',
    'НейроПространство',
    'Ночной и выходной ИИ-администратор в мессенджерах',
    'ABS&JP LLC',
    'fromPrice',
    44,
    'USD',
    ['whatsapp', 'telegram', 'other'],
    { features: ['Отвечает вечером, ночью и в выходные', '7 дней пробно', 'Ведёт клиента до записи'] },
  ],
  [
    'aiAssistants',
    'ЧатРекс',
    'Конструктор ИИ-ботов и виртуальный менеджер',
    'Rubikon',
    'fromPrice',
    40,
    'USD',
    ['whatsapp', 'telegram'],
    { features: ['Отвечает за 3–10 секунд', 'Записывает, переносит, отменяет', 'Своя связь с amoCRM'] },
  ],
  [
    'aiAssistants',
    'AI Beauty Bot',
    '24/7 ИИ-ресепшн для салонов красоты',
    'AI Beauty Bot Inc',
    'fromPrice',
    79,
    'USD',
    ['whatsapp', 'telegram', 'other'],
    { worksOnTrial: false, features: ['WhatsApp, Telegram, Instagram, звонок голосом', 'Пробно 3 дня без карты', 'Помнит любимого мастера клиента'] },
  ],
  [
    'aiAssistants',
    'Beauty AI — GPT',
    'Telegram-бот владельца: цифры и «кого позвать»',
    'Flowsell.me',
    'free',
    undefined,
    undefined,
    ['telegram'],
    { whoToCallDemo: true, features: ['Спросите бота «выручка за сегодня»', 'Модуль «Кого позвать» на пустые окна', 'Сам не записывает — готовит текст'] },
  ],
  [
    'aiAssistants',
    'ChatPlug',
    'ИИ-ассистент в WhatsApp и Telegram',
    'IA Operators',
    'fromPrice',
    19,
    'USD',
    ['waba', 'telegram'],
    { features: ['Записывает, подтверждает, переносит, отменяет', '7 дней без карты', 'Сообщения без лимита'] },
  ],
  [
    'aiAssistants',
    'Solwees AI',
    'Принимает звонки и сообщения 24/7',
    'SMYADGT LTD',
    'fromPrice',
    39,
    'EUR',
    ['voice', 'whatsapp', 'telegram'],
    { features: ['Телефон, WhatsApp, Instagram, Telegram, веб-чат', '14 дней пробно, карта обязательна', 'Предоплата «Smart» — только клиентам с отменами'] },
  ],
  [
    'aiAssistants',
    'Стаффоно ИИ',
    '«Виртуальные сотрудники»: переписка и запись',
    'Staffono LLC',
    'fromPrice',
    9,
    'USD',
    ['whatsapp', 'telegram'],
    { features: ['Проект создаётся сам после подключения', '7 дней пробно', 'Пауза автоответов при вмешательстве сотрудника'] },
  ],
  // ─── b04: продвижение (F-13-131…F-13-136) ───
  [
    'marketing',
    'Constant Contact',
    'Email-маркетинг: формы подписки, 300+ шаблонов',
    'Hexa Pagamentos Ltda',
    'comingSoon',
    undefined,
    undefined,
    undefined,
    { features: ['Постинг в соцсети и отчёты', 'Автописьма на день рождения'] },
  ],
  [
    'marketing',
    'Мультиссылка для соцсетей',
    'Мини-лендинг с кнопкой записи и контактами',
    'Hipolink.net',
    'none',
    undefined,
    undefined,
    undefined,
    { features: ['20 тем оформления, до 25 фото в галерее', 'Кнопка записи ведёт на вашу ссылку записи', 'Форма лидов с уведомлением в Telegram'] },
  ],
  [
    'social',
    'Кнопка «Забронировать»',
    'Кнопка записи в Instagram и Facebook',
    'Meta',
    'free',
    undefined,
    undefined,
    undefined,
    { features: ['Нужен бизнес-аккаунт Facebook', 'Заявки идут прямо в журнал и базу клиентов'] },
  ],
  [
    'maps',
    'Яндекс Карты',
    'Кнопка «Записаться онлайн» прямо в Картах',
    'Яндекс',
    'free',
    undefined,
    undefined,
    undefined,
    { countries: ['AM', 'RU'], features: ['Клиент записывается, отменяет и переносит запись в Картах', 'Источник записи — «Яндекс Карты»'] },
  ],
  // ─── b04: CRM (F-13-178…F-13-181) ───
  [
    'crm',
    'Интеграция с Kommo / amoCRM',
    'Запись из сделки и движение сделок по статусу',
    'Rubikon Technologies',
    'fromPrice',
    21,
    'USD',
    undefined,
    { kommoSettings: true, features: ['Запись прямо из сделки Kommo', 'Синхронизация статусов «с условиями»/«без условий»'] },
  ],
  [
    'crm',
    'Kommo с бонусом',
    'Продажа лицензий Kommo CRM с кэшбэком',
    'Rubikon Technologies',
    'fromPrice',
    15,
    'USD',
    undefined,
    { features: ['Кэшбэк до 15% и до 3 месяцев в подарок', 'Контакты, сделки, воронки, телефония'] },
  ],
  [
    'crm',
    'Message.Help CRM',
    'Бесплатная CRM, синхронная с журналом',
    'Message.Help',
    'freeTier',
    undefined,
    undefined,
    ['whatsapp', 'telegram'],
    { features: ['Диалоги прямо в журнале записи', 'Смена этапа сделки меняет статус визита', 'Платят только за отправленные сообщения'] },
  ],
  [
    'crm',
    'FastSign — анкеты по QR',
    'Брендированные анкеты и согласия по ссылке',
    'Alt Technologies',
    'fromPrice',
    8,
    'USD',
    undefined,
    { fastSignDemo: true, features: ['QR на ресепшене или прямая ссылка', 'Ответы пишутся в карточку клиента', 'PDF с подписью клиента', '3 дня пробно'] },
  ],
  // ─── b04: персонал (F-13-183) ───
  [
    'personnel',
    'Auto-Payroll',
    'Считает зарплату по данным журнала, готовит ведомости',
    'Asgard Software Development',
    'fromPrice',
    39,
    'USD',
    undefined,
    { features: ['Синхронизация записей, услуг, продаж в реальном времени', 'Промокод NEWSALON30 — скидка 30%', '14 дней без карты, деньги не переводит'] },
  ],
  // ─── ревью 27.09 (И7): эквайринг ArCa армянских банков — «Скоро», как Idram/Telcell (новые id в конце — старые не сдвигаются) ───
  ...(['Ameriabank', 'Inecobank', 'Evocabank', 'ACBA Bank'] as const).map(
    (bank): Row => [
      'payments',
      `${bank} — эквайринг ArCa`,
      'Оплата картами ArCa, Visa и Mastercard при онлайн-записи',
      bank,
      'comingSoon',
      undefined,
      undefined,
      undefined,
      {
        features: ['Карты ArCa, Visa, Mastercard', 'Деньги приходят на расчётный счёт в этом банке', 'Нужен договор эквайринга с банком'],
      },
    ],
  ),
  // ─── ревью 27.09 (И10): Google Календарь — первым в армянском каталоге ───
  [
    'other',
    'Google Календарь',
    'Двусторонняя синхронизация: записи — в календарь мастера, занятость из календаря закрывает окна',
    'Google',
    'free',
    undefined,
    undefined,
    undefined,
    {
      featuredRank: 1,
      countries: ['AM', 'GLOBAL'],
      requestedScopes: ['schedule', 'bookings', 'staff'],
      registrationMode: 'website',
      websiteUrl: 'https://calendar.google.com',
      features: [
        'Новая запись сразу появляется в Google Календаре мастера',
        'Личное событие в календаре закрывает это время для онлайн-записи',
        'Каждый мастер подключает свой календарь входом в Google',
      ],
    },
  ],
];

const FOREIGN_ROWS: Row[] = [
  [
    'marketing',
    'Mailchimp',
    'Email-маркетинг для малого бизнеса',
    'Intuit Mailchimp',
    'freeTier',
  ],
  [
    'other',
    'Zoom-звонки',
    'Видеоконсультации по ссылке из записи',
    'Zoom',
    'fromPrice',
    15,
    'USD',
  ],
  [
    'widgets',
    'Calendly Sync',
    'Двусторонняя синхронизация календаря',
    'Calendly',
    'fromPrice',
    12,
    'USD',
  ],
  // F-13-154: Wahelp — в армянском каталоге карточки нет, находится через «Все страны» или поиском
  [
    'notifications',
    'Wahelp',
    'Боты WhatsApp, Instagram, Telegram, Viber: запись, подтверждение, отзывы, ДР, баланс бонусов',
    'Wahelp',
    'fromPrice',
    40,
    'EUR',
    ['whatsapp', 'telegram', 'viber'],
    {
      notifyAppKind: 'chatbot',
      notifyCapabilities: ['bookingConfirm', 'retentionCampaigns'],
    },
  ],
  // F-13-164: WAxSMS — в армянском каталоге карточки нет, находится поиском «WAxSMS»
  [
    'notifications',
    'WAxSMS',
    'WhatsApp и SMS без оплаты за сообщение: SMS через телефон-шлюз, WhatsApp по QR, каскад',
    'WAxSMS',
    'trialDays',
    undefined,
    undefined,
    ['sms', 'whatsapp'],
    {
      notifyAppKind: 'smsAggregator',
      notifyCapabilities: ['cascade', 'bulk'],
      smsAggregatorAuth: true,
    },
  ],
  // ─── b04: ИИ-боты, которых нет в армянском кабинете (F-13-113, F-13-117, F-13-118) ───
  [
    'aiAssistants',
    'Monobot CX',
    'Голосовой и чат-агент: сайт, Telegram, Instagram, SIP',
    'Monobot.Ai',
    'none',
    undefined,
    undefined,
    undefined,
    { countries: ['GLOBAL'], features: ['Один агент — одна локация', 'Данные синхронизируются раз в сутки', 'Оплата за ответ или за минуту голоса'] },
  ],
  [
    'aiAssistants',
    'Stiker.AI',
    'ИИ-агенты в WhatsApp/Telegram/Instagram со своей CRM',
    'Stiker.AI',
    'fromPrice',
    40,
    'USD',
    ['whatsapp', 'telegram'],
    { countries: ['KZ'], features: ['Счёт на предоплату через Kaspi прямо в чате', 'Свой мини-сайт имя.stiker.ai', '7 дней пробно'] },
  ],
  [
    'aiAssistants',
    'ZiFlow',
    'ИИ-сотрудник: запись, напоминания, возврат «уснувших»',
    'ZiFlow',
    'fromPrice',
    24,
    'USD',
    ['whatsapp', 'telegram'],
    { countries: ['KZ'], features: ['Напоминания за 24 ч и 2 ч', 'Дайджест владельцу в Telegram', 'Оплата в чате (Kaspi Pay)'] },
  ],
  // ─── b04: продвижение и площадки записи вне армянского кабинета (F-13-132, F-13-136, F-13-137, F-13-177) ───
  [
    'marketing',
    'Yandex Business',
    'Реклама из профиля компании в Картах, Поиске, соцсетях',
    'Яндекс',
    'free',
    undefined,
    undefined,
    undefined,
    { countries: ['RU', 'KZ'], features: ['Стандартная кампания — 90 дней', 'Промокод от менеджера — 30 дней рекламы бесплатно'] },
  ],
  [
    'maps',
    'Запись через Google',
    'Кнопка «Записаться» в Google Поиске и Картах',
    'Google',
    'free',
    undefined,
    undefined,
    undefined,
    {
      // И10: работает и в Армении — видна в армянском каталоге, вторая в рекомендуемых
      countries: ['AM', 'GLOBAL'],
      featuredRank: 2,
      websiteUrl: 'https://business.google.com',
      features: ['Сферы красота, спорт, авто', 'Услуги и свободное время обновляются раз в сутки', 'Услуга без описания не выгружается'],
    },
  ],
  [
    'maps',
    '2GIS — кнопка записи',
    'Кнопка записи в карточке компании 2GIS',
    '2GIS',
    'free',
    undefined,
    undefined,
    undefined,
    { countries: ['KZ'], partnerApplicationOnly: true, features: ['Одна ссылка должна быть основной', 'Кнопка появится за 1–2 дня', 'Источник записи — «переход из 2GIS»'] },
  ],
  [
    'maps',
    'Earlyone',
    'Каталог мастеров с бесплатными наклейками QR',
    'Earlyone',
    'free',
    undefined,
    undefined,
    undefined,
    { countries: ['GLOBAL'], partnerApplicationOnly: true, features: ['Бесплатно для бизнеса', 'Все услуги видны в приложении'] },
  ],
  [
    'maps',
    'DOQ.kz',
    'Поиск врачей и специалистов в 5 городах Казахстана',
    'DOQ.kz',
    'perMessage',
    3190,
    'USD',
    undefined,
    { countries: ['KZ'], partnerApplicationOnly: true, features: ['Подключение бесплатно', 'Плата за пришедшего пациента', 'Расписание берётся из журнала'] },
  ],
  [
    'marketing',
    'Flocktory',
    'Витрина подарочных купонов партнёров для клиентов',
    'Flocktory',
    'free',
    undefined,
    undefined,
    undefined,
    { countries: ['KZ'], features: ['Кнопка-подарок после онлайн-записи', 'Работает по умолчанию, без настроек'] },
  ],
  // ─── b05: карточки-инструкции виртуальных АТС за пределами Армении (F-13-100…F-13-104) ───
  [
    'telephony',
    'Beeline Виртуальная АТС',
    'Приём звонков клиентов через сеть Beeline',
    'Beeline',
    'fromPrice',
    9,
    'USD',
    ['voice'],
    {
      countries: ['GLOBAL'],
      telephonyPbx: true,
      features: [
        'Кыргызстан: токен сети возьмите в личном кабинете Beeline Бизнес',
        'Вставьте токен в «Сеть» → «Телефония» — статус подключения появится там же',
        'Входящий звонок открывает всплывающую карточку клиента в кабинете',
      ],
    },
  ],
  [
    'telephony',
    'Kcell Виртуальная АТС',
    'Приём звонков клиентов через сеть Kcell',
    'Kcell',
    'fromPrice',
    12,
    'USD',
    ['voice'],
    {
      countries: ['KZ'],
      telephonyPbx: true,
      features: [
        'Казахстан: токен сети — в кабинете Kcell Business',
        'Вставьте токен в «Сеть» → «Телефония»',
        'Входящий звонок открывает всплывающую карточку клиента в кабинете',
      ],
    },
  ],
  [
    'telephony',
    'Moldcell Виртуальная АТС',
    'Приём звонков клиентов через сеть Moldcell',
    'Moldcell',
    'fromPrice',
    10,
    'USD',
    ['voice'],
    {
      countries: ['GLOBAL'],
      telephonyPbx: true,
      features: [
        'Молдова: токен сети — в личном кабинете Moldcell Business',
        'Вставьте токен в «Сеть» → «Телефония»',
        'Входящий звонок открывает всплывающую карточку клиента в кабинете',
      ],
    },
  ],
  [
    'telephony',
    'Phonet',
    'IP-телефония и виртуальная АТС для украинского бизнеса',
    'Phonet',
    'fromPrice',
    8,
    'USD',
    ['voice'],
    {
      countries: ['UA'],
      telephonyPbx: true,
      features: [
        'Украина: понадобятся ID сети и ID филиала из личного кабинета Phonet',
        'Вставьте оба ID в «Сеть» → «Телефония»',
        'Входящий звонок открывает всплывающую карточку клиента в кабинете',
      ],
    },
  ],
  [
    'telephony',
    'KOMPaaS',
    'Облачная телефония как платформа — коробочное решение для сетей салонов',
    'KOMPaaS',
    'fromPrice',
    30,
    'USD',
    ['voice'],
    {
      countries: ['GLOBAL'],
      telephonyPbx: true,
      multiLocation: true,
      features: [
        'Подключается прямо из каталога — без обращения к сети',
        'Годится для сетей с несколькими филиалами и общим номером',
        'Входящий звонок открывает всплывающую карточку клиента в кабинете',
      ],
    },
  ],
  // ─── b05: зарубежные платёжные провайдеры (F-13-189…F-13-200) — карточки-каталог, метки стран ───
  [
    'payments',
    'Adyen',
    'Приём платежей картой и локальными методами для крупного бизнеса',
    'Adyen N.V.',
    'fromPrice',
    0.6,
    'EUR',
    undefined,
    { countries: ['EU'], ownerOnly: true, armeniaManualNote: false, features: ['Подключает только владелец бизнеса', 'Перед первым платежом — проверка бизнеса провайдером (1–3 дня)', 'Комиссия зависит от метода оплаты'] },
  ],
  [
    'payments',
    'TipTop Pay',
    'Приём платежей картой для интернет-эквайринга',
    'TipTop Pay',
    'fromPrice',
    2.2,
    'USD',
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, features: ['Подключает только владелец бизнеса', 'Эквайринг картой и рассрочка'] },
  ],
  [
    'payments',
    'MonoBank',
    'Приём платежей через MonoBank Acquiring',
    'MonoBank',
    'fromPrice',
    1.4,
    'USD',
    undefined,
    { countries: ['UA'], ownerOnly: true, armeniaManualNote: false, features: ['Украина: подключает только владелец бизнеса', 'Деньги приходят на счёт MonoBank в течение дня'] },
  ],
  [
    'payments',
    'LiqPay',
    'Приём платежей картой от Приватбанка',
    'LiqPay',
    'fromPrice',
    2.7,
    'USD',
    undefined,
    { countries: ['UA'], ownerOnly: true, armeniaManualNote: false, features: ['Украина: подключает только владелец бизнеса', 'Поддерживает Apple Pay и Google Pay'] },
  ],
  [
    'payments',
    'Pagar.me',
    'Приём платежей картой и Pix для бразильского бизнеса',
    'Pagar.me',
    'fromPrice',
    2.9,
    'USD',
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, features: ['Бразилия: подключает только владелец бизнеса', 'Карта, бойлет и Pix в одном подключении'] },
  ],
  [
    'payments',
    'Pix по ключу',
    'Мгновенные переводы Pix напрямую на ключ бизнеса',
    'ZOOP',
    'free',
    undefined,
    undefined,
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, features: ['Бразилия: без посредника — деньги идут прямо на ключ Pix бизнеса', '⭐ для Армении аналог — ручная предоплата по реквизитам (см. блок выше)'] },
  ],
  [
    'payments',
    'Uzum Bank Эквайринг',
    'Приём платежей картой Uzcard/Humo и Uzum',
    'Uzum Bank',
    'fromPrice',
    1.9,
    'USD',
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, features: ['Узбекистан: подключает только владелец бизнеса', 'Локальные карты Uzcard и Humo'] },
  ],
  [
    'payments',
    'MaxPay',
    'Приём платежей картой для казахстанского бизнеса',
    'MaxPay',
    'fromPrice',
    2.1,
    'USD',
    undefined,
    { countries: ['KZ'], ownerOnly: true, armeniaManualNote: false, features: ['Казахстан: подключает только владелец бизнеса', 'Поддерживает Kaspi Pay'] },
  ],
  [
    'payments',
    'AltPay',
    'Автопродление абонементов и подписок картой',
    'AltPay',
    'fromPrice',
    3.4,
    'USD',
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, partnerApplicationOnly: true, features: ['Бразилия: подключение — заявка партнёру, не автоматический лист', 'Автосписание за абонемент день в день'] },
  ],
  [
    'payments',
    'Qton и другие провайдеры',
    'Справочная карточка: ещё несколько платёжных провайдеров из каталога партнёра',
    'Qton и другие',
    'none',
    undefined,
    undefined,
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, features: ['Qton, PayMe, Click и другие — по регионам присутствия партнёра', 'Условия и тарифы — на сайте провайдера', 'Список пополняется вместе с каталогом партнёра'] },
  ],
  // ─── b05: чаевые — скрытая категория (F-13-200) ───
  [
    'tips',
    'EasyTip',
    'Чаевые, депозиты и оплата по QR — для рынка ОАЭ',
    'EasyTip',
    'fromPrice',
    5,
    'USD',
    undefined,
    { countries: ['GLOBAL'], tipsQuestionNote: true, features: ['ОАЭ: чаевые, депозиты и обычная оплата по одному QR', 'В Армении вопрос про чаевые ещё не решён — карточка справочная'] },
  ],
  // ─── b05: зарубежные фискальные приложения (F-13-204…F-13-206) ───
  [
    'fiscal',
    'VERIFAC',
    'Электронное выставление счетов по требованиям VERIFACTU',
    'VERIFAC',
    'fromPrice',
    15,
    'EUR',
    undefined,
    { countries: ['EU'], ownerOnly: true, armeniaManualNote: false, features: ['Испания: соответствие требованиям VERIFACTU', 'Счета отправляются в налоговую автоматически'] },
  ],
  [
    'fiscal',
    'eNotas',
    'Электронные чеки Nota Fiscal для бразильского бизнеса',
    'eNotas',
    'fromPrice',
    20,
    'USD',
    undefined,
    { countries: ['GLOBAL'], ownerOnly: true, armeniaManualNote: false, features: ['Бразилия: выпуск Nota Fiscal при каждой продаже', 'Хранит архив чеков за прошлые периоды'] },
  ],
  [
    'fiscal',
    'Cashalot ПРРО',
    'Регистратор расчётных операций для украинского бизнеса',
    'Cashalot',
    'fromPrice',
    9,
    'USD',
    undefined,
    { countries: ['UA'], ownerOnly: true, armeniaManualNote: false, features: ['Украина: фискализация чека при продаже', 'Настройки самой кассы — в разделе «Финансы»'] },
  ],
  [
    'fiscal',
    'Checkbox ПРРО',
    'Регистратор расчётных операций для украинского бизнеса',
    'Checkbox',
    'fromPrice',
    9,
    'USD',
    undefined,
    { countries: ['UA'], ownerOnly: true, armeniaManualNote: false, features: ['Украина: фискализация чека при продаже', 'Настройки самой кассы — в разделе «Финансы»'] },
  ],
  [
    'fiscal',
    'Cashdesk ПРРО',
    'Регистратор расчётных операций для украинского бизнеса',
    'Cashdesk',
    'fromPrice',
    9,
    'USD',
    undefined,
    { countries: ['UA'], ownerOnly: true, armeniaManualNote: false, features: ['Украина: фискализация чека при продаже', 'Настройки самой кассы — в разделе «Финансы»'] },
  ],
  // ─── b04: скрытая карточка, только по прямой ссылке (F-13-182) ───
  [
    'other',
    'МИС «Жетісу»',
    'Передача визитов в медицинскую систему Казахстана',
    'МИС Жетісу',
    'none',
    undefined,
    undefined,
    undefined,
    {
      countries: ['KZ'],
      hiddenFromCatalog: true,
      code: 'mp_2224_mis_booking',
      features: ['Передаёт визиты при создании, изменении, отмене', 'Поиск пациента по ИИН', 'История до подключения не выгружается'],
    },
  ],
];

const SCOPES_BY_CATEGORY: Partial<
  Record<IntegrationCategoryId, RequestedScope[]>
> = {
  notifications: ['schedule', 'bookings', 'clients'],
  telephony: ['clients', 'bookings'],
  marketing: ['clients', 'catalog'],
  social: ['bookings', 'catalog'],
  widgets: ['bookings', 'catalog', 'services'],
  analytics: ['bookings', 'reports'],
  accounting: ['money', 'reports', 'staff'],
  maps: ['catalog'],
  payments: ['money', 'bookings'],
  fiscal: ['money'],
  other: ['reports'],
  chatbots: ['bookings', 'clients', 'catalog'],
  tips: ['money', 'staff'],
  aiAssistants: ['schedule', 'bookings', 'clients', 'catalog'],
  crm: ['bookings', 'clients', 'services'],
  personnel: ['staff', 'money', 'reports'],
};

const FAQ_BY_CATEGORY: Partial<
  Record<IntegrationCategoryId, { q: string; a: string }[]>
> = {
  notifications: [
    {
      q: 'Кто платит за отправку?',
      a: 'Бизнес платит партнёру напрямую по его тарифу — платформа сообщения не тарифицирует.',
    },
    {
      q: 'Можно подключить к нескольким филиалам?',
      a: 'Да, на шаге подключения выберите все нужные филиалы сети.',
    },
  ],
  payments: [
    {
      q: 'Когда заработает в Армении?',
      a: 'После согласования с юристом — сейчас доступна ручная предоплата по реквизитам.',
    },
  ],
};

function priceAmountAndCurrency(
  model: CatalogApp['price']['model'],
  amount?: number,
  currency?: 'AMD' | 'USD' | 'EUR',
) {
  if (model === 'fromPrice' || model === 'perMessage')
    return { amount, currency };
  if (model === 'trialDays') return { trialDays: 14 };
  return {};
}

function buildApp(
  row: Row,
  idx: number,
  prefix: string,
  countries: CatalogApp['countries'],
): CatalogApp {
  const [
    categoryId,
    name,
    subtitle,
    developer,
    priceModel,
    amount,
    currency,
    channels,
    extra,
  ] = row;
  const seedNum = idx + 1;
  const slug = name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return {
    id: `${prefix}_${seedNum}`,
    code: `mp_${seedNum}_${slug || 'app'}`,
    categoryId,
    name,
    subtitle,
    description: `${subtitle}. Подключается за пару минут, все данные — только внутри вашего аккаунта.`,
    developer,
    legalInfo: `${developer}, партнёр каталога`,
    policyUrl: 'https://example.com/policy',
    websiteUrl: 'https://example.com',
    // F-13-011: rating/reviewsCount раньше были случайными независимо от массива reviews (карточка
    // показывала «4.9 · 56 отзывов», а вкладка «Отзывы» — пусто). Держим 0 отзывов здесь и досчитываем
    // реальные значения в seed() из фактически засеянных reviews — так карточка и вкладка совпадают.
    rating: Math.round((3.6 + ((seedNum * 37) % 14) / 10) * 10) / 10,
    reviewsCount: 0,
    installsCount: (seedNum * 53) % 940,
    price: {
      model: priceModel,
      ...priceAmountAndCurrency(priceModel, amount, currency),
    },
    channels,
    countries,
    // И11: бесплатное не может «не работать на пробном» — ограничение бывает только у платных тарифов
    worksOnTrial: priceModel === 'free' || priceModel === 'none' || priceModel === 'comingSoon' || seedNum % 4 !== 0,
    ownerOnly:
      categoryId === 'payments' ||
      categoryId === 'fiscal' ||
      categoryId === 'accounting',
    requestedScopes: SCOPES_BY_CATEGORY[categoryId] ?? ['bookings'],
    registrationMode: seedNum % 3 === 0 ? 'form' : 'website',
    multiLocation: true,
    features: [
      subtitle,
      `Работает с текущим расписанием и клиентами филиала`,
      `Отключается в один клик`,
    ],
    faq: FAQ_BY_CATEGORY[categoryId],
    plans:
      priceModel === 'fromPrice'
        ? [
            {
              name: 'Базовый',
              price: amount ?? 0,
              currency: currency ?? 'AMD',
              period: 'month',
              features: ['До 500 сообщений', 'Один филиал'],
            },
            {
              name: 'Расширенный',
              price: Math.round((amount ?? 0) * 2.2),
              currency: currency ?? 'AMD',
              period: 'month',
              features: ['Без ограничения сообщений', 'Все филиалы сети'],
            },
          ]
        : undefined,
    armeniaManualNote: categoryId === 'payments',
    ...extra,
  };
}

function builtinApps(): CatalogApp[] {
  return [
    {
      id: 'ia_builtin_client',
      code: 'mp_1000_client-app',
      categoryId: 'marketing',
      name: 'Наше приложение для клиентов',
      subtitle: 'Клиенты находят вас и записываются сами',
      developer: 'Наша платформа',
      rating: 4.9,
      reviewsCount: 0,
      installsCount: 0,
      price: { model: 'free' },
      countries: ['AM'],
      worksOnTrial: true,
      ownerOnly: false,
      requestedScopes: ['bookings', 'catalog'],
      registrationMode: 'website',
      multiLocation: true,
      builtin: true,
      builtinHref: '/biz/online',
      features: [
        'Всегда включено вместе с аккаунтом',
        'Видимость салона настраивается отдельно',
      ],
    },
    {
      id: 'ia_builtin_openslots',
      code: 'mp_1001_open-slots',
      categoryId: 'marketing',
      name: 'Картинка свободных окон',
      subtitle: 'Готовая картинка для сторис каждое утро',
      developer: 'Наша платформа',
      rating: 4.8,
      reviewsCount: 0,
      installsCount: 0,
      price: { model: 'free' },
      countries: ['AM'],
      worksOnTrial: true,
      ownerOnly: false,
      requestedScopes: ['schedule'],
      registrationMode: 'website',
      multiLocation: true,
      builtin: true,
      // F-13-121: открывает встроенную функцию сторис, без отдельной регистрации и без Telegram (⭐ F-00-155)
      builtinHref: '/biz/apps/stories',
      features: [
        'Обновляется сама каждый день',
        'Скачать и выложить в сторис за один тап',
      ],
    },
    {
      id: 'ia_builtin_wa',
      code: 'mp_1002_wa-direct',
      categoryId: 'social',
      name: 'WhatsApp с номера мастера',
      subtitle: 'Клиент пишет напрямую мастеру',
      developer: 'Наша платформа',
      rating: 4.7,
      reviewsCount: 0,
      installsCount: 0,
      price: { model: 'free' },
      countries: ['AM'],
      worksOnTrial: true,
      ownerOnly: false,
      requestedScopes: ['staff'],
      registrationMode: 'website',
      multiLocation: true,
      builtin: true,
      builtinHref: '/biz/online',
      features: [
        'Ссылка на витрине мастера',
        'Без сторонних сервисов и комиссий',
      ],
    },
    // ревью 27.09 (И10): перенос базы из другой программы — встроенный процесс, а не подключение партнёра
    ...(
      [
        ['ia_builtin_import_altegio', 'mp_1003_import-altegio', 'Altegio', 3],
        ['ia_builtin_import_dikidi', 'mp_1004_import-dikidi', 'DIKIDI', 4],
      ] as const
    ).map(
      ([id, code, source, rank]): CatalogApp => ({
        id,
        code,
        categoryId: 'other',
        name: `Перенос из ${source}`,
        subtitle: 'Клиенты, услуги и будущие записи — одним файлом, без ручного ввода',
        developer: 'Наша платформа',
        rating: 0,
        reviewsCount: 0,
        installsCount: 0,
        price: { model: 'free' },
        countries: ['AM'],
        worksOnTrial: true,
        ownerOnly: true,
        requestedScopes: ['clients', 'services', 'bookings'],
        registrationMode: 'form',
        multiLocation: false,
        builtin: true,
        builtinHref: '/biz/clients/import',
        featuredRank: rank,
        features: [
          `1. В ${source} выгрузите клиентов, услуги и записи в Excel (раздел отчётов или «Экспорт»)`,
          '2. Загрузите файл в «Клиенты» → «Импорт» — мы покажем, что распознали, до сохранения',
          '3. Проверьте совпадения и нажмите «Загрузить» — дубли по телефону не создаются',
          'Перед загрузкой выключите вебхуки и уведомления, чтобы клиенты не получили сообщения о старых записях',
        ],
      }),
    ),
  ];
}

/** Ревью 27.09 (И14): дубли и карточки чужих рынков — прячем из каталога, id не сдвигаем (на них ссылаются подключения сервера) */
const RETIRED_NAMES = new Set([
  'Google Analytics',
  'Яндекс Карты — синхронизация',
  'Фоновая музыка для салона',
  'Stiker.AI',
  'ZiFlow',
  'Yandex Business',
  '2GIS — кнопка записи',
  'DOQ.kz',
  'Flocktory',
  'Kcell Виртуальная АТС',
  'Phonet',
  'MonoBank',
  'LiqPay',
  'Pagar.me',
  'Pix по ключу',
  'Uzum Bank Эквайринг',
  'MaxPay',
  'AltPay',
  'eNotas',
  'Cashalot ПРРО',
  'Checkbox ПРРО',
  'Cashdesk ПРРО',
]);

function retire(app: CatalogApp): CatalogApp {
  return RETIRED_NAMES.has(app.name) ? { ...app, hiddenFromCatalog: true } : app;
}

function seedCatalog(): CatalogApp[] {
  return [
    ...AM_ROWS.map((r, i) => buildApp(r, i, 'ia', ['AM'])),
    ...FOREIGN_ROWS.map((r, i) =>
      buildApp(r, i, 'ia_f', ['GLOBAL', 'US', 'EU']),
    ),
    ...builtinApps(),
  ].map(retire).map((app) =>
    // И14: «Гугл Аналитика» (потоки GA4) — единственная карточка GA; имя как у Google, без кальки
    app.gaStreamsApp ? { ...app, name: 'Google Analytics 4' } : app,
  );
}

const SEEDED_BUSINESSES = 6;

function seed(core: CoreData, now: Date): IntegrationsState {
  const apps = seedCatalog();
  const installs: AppInstall[] = [];
  const reviews: AppReview[] = [];
  const today = dayjs(now);

  const allBusinessesWithLocations = core.businesses.filter(
    (b) => b.locationIds.length > 0,
  );
  // Демо-подключения (app1/app2/app3 ниже) — только у первых N бизнесов, чтобы не заваливать
  // каталог случайными статусами. Встроенные приложения сидируются у ВСЕХ бизнесов с филиалами —
  // это поведение платформы по умолчанию, а не демо-данные (F-13-007: новая/пустая локация тоже
  // должна получить встроенное «Наше приложение для клиентов» без EmptyState).
  const businessesWithLocations = allBusinessesWithLocations.slice(
    0,
    SEEDED_BUSINESSES,
  );

  // Встроенное приложение для клиентов — «подключено» у каждого филиала по умолчанию (F-13-007, F-13-173, ⭐ F-00-001/F-00-065)
  const builtinClient = apps.find((a) => a.id === 'ia_builtin_client')!;
  const builtinOpenSlots = apps.find((a) => a.id === 'ia_builtin_openslots')!;

  allBusinessesWithLocations.forEach((business, bi) => {
    business.locationIds.forEach((locationId, li) => {
      installs.push({
        id: `iai_${locationId}_${builtinClient.id}`,
        appId: builtinClient.id,
        businessId: business.id,
        locationId,
        status: 'connected',
        grantedScopes: builtinClient.requestedScopes,
        connectedAt: toISODateTime(today.subtract(90, 'day')),
        activatedAt: toISODateTime(today.subtract(90, 'day')),
      });
      if ((bi + li) % 2 === 0) {
        installs.push({
          id: `iai_${locationId}_${builtinOpenSlots.id}`,
          appId: builtinOpenSlots.id,
          businessId: business.id,
          locationId,
          status: 'connected',
          grantedScopes: builtinOpenSlots.requestedScopes,
          connectedAt: toISODateTime(today.subtract(40, 'day')),
          activatedAt: toISODateTime(today.subtract(40, 'day')),
        });
      }
    });
  });

  businessesWithLocations.forEach((business, bi) => {
    // Первый филиал первых бизнесов — несколько демонстрационных подключений в разных статусах
    const firstLocationId = business.locationIds[0];
    if (!firstLocationId) return;
    const pool = apps.filter(
      (a) => !a.builtin && !a.hiddenFromCatalog && a.price.model !== 'comingSoon',
    );
    const app1 = pool[bi % pool.length];
    const app2 = pool[(bi + 5) % pool.length];
    const app3 = pool[(bi + 11) % pool.length];

    if (app1 && bi % 3 !== 2) {
      installs.push({
        id: `iai_${firstLocationId}_${app1.id}`,
        appId: app1.id,
        businessId: business.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: app1.requestedScopes,
        connectedAt: toISODateTime(today.subtract(20, 'day')),
        activatedAt: toISODateTime(today.subtract(20, 'day')),
        paidUntil: toISODateTime(today.add(10, 'day')),
        systemUserId: `iasu_${app1.id}_${firstLocationId}`,
      });
    }
    if (app2 && bi % 2 === 0) {
      const connectedAt = toISODateTime(today);
      installs.push({
        id: `iai_${firstLocationId}_${app2.id}`,
        appId: app2.id,
        businessId: business.id,
        locationId: firstLocationId,
        status: 'pendingActivation',
        grantedScopes: app2.requestedScopes,
        connectedAt,
        activatesBy: activationDeadline(connectedAt),
      });
    }
    if (app3 && bi === 1) {
      installs.push({
        id: `iai_${firstLocationId}_${app3.id}_off`,
        appId: app3.id,
        businessId: business.id,
        locationId: firstLocationId,
        status: 'autoDisconnected',
        grantedScopes: app3.requestedScopes,
        connectedAt: toISODateTime(today.subtract(60, 'day')),
        activatedAt: toISODateTime(today.subtract(60, 'day')),
        paidUntil: toISODateTime(today.subtract(5, 'day')),
        errorText: 'partnerSubscriptionUnpaid',
      });
    }

    // Пара отзывов на самое установленное приложение — видно на карточке (F-13-011)
    if (bi === 0 && app1) {
      reviews.push(
        {
          id: `iarev_${app1.id}_1`,
          appId: app1.id,
          businessId: business.id,
          authorRole: 'admin',
          rating: 5,
          text: 'Подключили за 5 минут, клиенты стали чаще подтверждать запись.',
          createdAt: toISODateTime(today.subtract(15, 'day')),
        },
        {
          id: `iarev_${app1.id}_2`,
          appId: app1.id,
          businessId: business.id,
          authorRole: 'owner',
          rating: 4,
          text: 'Работает стабильно, хотелось бы более гибкие шаблоны текста.',
          createdAt: toISODateTime(today.subtract(6, 'day')),
        },
      );
    }
  });

  // F-13-011: пересчитать rating/reviewsCount карточки из реально засеянных отзывов — иначе цифра
  // на плитке («4.9 · 56 отзывов») расходится с пустой вкладкой «Отзывы».
  const reviewsByApp = new Map<string, AppReview[]>();
  reviews.forEach((r) =>
    reviewsByApp.set(r.appId, [...(reviewsByApp.get(r.appId) ?? []), r]),
  );
  apps.forEach((app) => {
    const appReviews = reviewsByApp.get(app.id);
    if (appReviews?.length) {
      app.reviewsCount = appReviews.length;
      app.rating =
        Math.round(
          (appReviews.reduce((sum, r) => sum + r.rating, 0) /
            appReviews.length) *
            10,
        ) / 10;
    }
  });

  // F-13-062/065: у первого демо-бизнеса — «старый» адрес вебхука, заданный до блокировки новых (12 сентября),
  // он продолжает работать и получать события (журнал доставок ниже) — показывает оба правила сразу.
  const webhookConfigs: WebhookConfig[] = [];
  const webhookDeliveries: WebhookDelivery[] = [];
  const firstBiz = businessesWithLocations[0];
  if (firstBiz) {
    const legacyAddrId = `iwha_${firstBiz.id}_legacy`;
    webhookConfigs.push({
      businessId: firstBiz.id,
      enabled: true,
      addresses: [
        {
          id: legacyAddrId,
          url: 'https://legacy.example-crm.am/hooks/booking',
          createdAt: toISODateTime(today.subtract(120, 'day')),
          legacy: true,
          signingSecret: 'whsec_demo_4f81c2a9e07b',
          verifiedAt: toISODateTime(today.subtract(120, 'day')),
        },
      ],
      entities: ['records', 'clients', 'staff'],
    });
    webhookDeliveries.push(
      {
        id: `iwhd_${firstBiz.id}_1`,
        businessId: firstBiz.id,
        entity: 'records',
        action: 'create',
        objectLabel: 'Запись №5821',
        address: 'legacy.example-crm.am',
        status: 'delivered',
        createdAt: toISODateTime(today.subtract(1, 'day').hour(10).minute(15)),
      },
      {
        id: `iwhd_${firstBiz.id}_2`,
        businessId: firstBiz.id,
        entity: 'clients',
        action: 'update',
        objectLabel: 'Клиент «Анна Саргсян»',
        address: 'legacy.example-crm.am',
        status: 'delivered',
        createdAt: toISODateTime(today.subtract(1, 'day').hour(9).minute(2)),
      },
      {
        id: `iwhd_${firstBiz.id}_3`,
        businessId: firstBiz.id,
        entity: 'records',
        action: 'update',
        objectLabel: 'Запись №5799',
        address: 'legacy.example-crm.am',
        status: 'failed',
        failReason: 'timeout',
        attempts: 3,
        createdAt: toISODateTime(today.subtract(2, 'day').hour(18).minute(40)),
      },
    );
  }

  // ─── b03: демо-подключения приложений «Уведомлений»/«Лояльности» у первого демо-бизнеса (F-13-141,
  // F-13-155, F-13-172, F-13-174) — чтобы вкладка «Настройки» и виджет были видны не только пустыми.
  const promoBlocks: PromoBlock[] = [];
  if (firstBiz) {
    const firstLocationId = firstBiz.locationIds[0];
    const smsAggregatorApp = apps.find((a) => a.name === 'АрМ СМС Шлюз');
    const senderApp = apps.find((a) => a.name === 'ВатсЧат для бизнеса');
    const stampApp = apps.find((a) => a.name === 'Штамп-карта в кошельке');
    const promoApp = apps.find((a) => a.promoBlockBuilder);

    if (firstLocationId && smsAggregatorApp) {
      installs.push({
        id: `iai_${firstLocationId}_${smsAggregatorApp.id}`,
        appId: smsAggregatorApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: smsAggregatorApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(3, 'day')),
        activatedAt: toISODateTime(today.subtract(3, 'day')),
        authKey: 'demo-key-7f2a91',
        senderName: 'MYBUSINESS',
        senderNameStatus: 'pending',
      });
    }
    if (firstLocationId && senderApp) {
      installs.push({
        id: `iai_${firstLocationId}_${senderApp.id}`,
        appId: senderApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: senderApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(9, 'day')),
        activatedAt: toISODateTime(today.subtract(9, 'day')),
        messageBalanceAmd: 640,
      });
    }
    if (firstLocationId && stampApp) {
      installs.push({
        id: `iai_${firstLocationId}_${stampApp.id}`,
        appId: stampApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: stampApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(30, 'day')),
        activatedAt: toISODateTime(today.subtract(30, 'day')),
        demoLoyaltyStamps: 3,
      });
    }
    if (firstLocationId && promoApp) {
      installs.push({
        id: `iai_${firstLocationId}_${promoApp.id}`,
        appId: promoApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: promoApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(45, 'day')),
        activatedAt: toISODateTime(today.subtract(45, 'day')),
      });
      promoBlocks.push({
        id: `ipb_${firstBiz.id}_1`,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        headline: 'Скидка 15% в будни',
        description:
          'Запишитесь на вторник или среду и получите скидку на все услуги филиала.',
        hasImage: true,
        icon: 'percent',
        buttonText: 'Подробнее',
        buttonHref: 'https://example.com/promo',
        placements: ['serviceSelect'],
        enabled: true,
        createdAt: toISODateTime(today.subtract(10, 'day')),
      });
    }

    // ─── b04: демо-подключения GA (F-13-080), Kommo (F-13-178), FastSign (F-13-181) ───
    const gaApp = apps.find((a) => a.gaStreamsApp);
    const kommoApp = apps.find((a) => a.kommoSettings);
    const fastSignApp = apps.find((a) => a.fastSignDemo);

    if (firstLocationId && gaApp) {
      installs.push({
        id: `iai_${firstLocationId}_${gaApp.id}`,
        appId: gaApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: gaApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(20, 'day')),
        activatedAt: toISODateTime(today.subtract(20, 'day')),
        gaStreams: [
          {
            id: `igs_${firstLocationId}_1`,
            streamId: 'G-DEMO12345',
            formLabel: 'Основная форма записи',
            createdAt: toISODateTime(today.subtract(20, 'day')),
          },
        ],
      });
    }
    if (firstLocationId && kommoApp) {
      installs.push({
        id: `iai_${firstLocationId}_${kommoApp.id}`,
        appId: kommoApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: kommoApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(15, 'day')),
        activatedAt: toISODateTime(today.subtract(15, 'day')),
        kommoSyncMode: 'conditional',
        kommoDedupe: true,
      });
    }
    if (firstLocationId && fastSignApp) {
      installs.push({
        id: `iai_${firstLocationId}_${fastSignApp.id}`,
        appId: fastSignApp.id,
        businessId: firstBiz.id,
        locationId: firstLocationId,
        status: 'connected',
        grantedScopes: fastSignApp.requestedScopes,
        connectedAt: toISODateTime(today.subtract(6, 'day')),
        activatedAt: toISODateTime(today.subtract(6, 'day')),
        fastSignFilledCount: 2,
      });
    }
  }

  // Одно приложение в одном филиале — одно подключение: случайные демо-подключения выше (app1/app2/app3) могли
  // совпасть с приложениями b03/b04, и в базе лежали два подключения с одним id — экран брал первое, пустое
  // (без ключа SMS, потоков GA…). Оставляем последнее, настроенное.
  const byId = new Map<string, AppInstall>();
  installs.forEach((i) => byId.set(i.id, i));
  installs.splice(0, installs.length, ...byId.values());

  // Ревью 27.09 (И2): «работает ли» — последнее событие и ошибки за неделю у живых подключений партнёров.
  // Детерминированно по номеру подключения: у части — свежий обмен без ошибок, у части — пара ошибок с причиной.
  const REASONS = ['partnerTimeout', 'invalidCredentials', 'rateLimited', 'recipientBlocked', 'partnerRejected'] as const;
  const KINDS = ['sync', 'message', 'booking'] as const;
  installs.forEach((install, i) => {
    if (install.status !== 'connected' || install.appId.startsWith('ia_builtin')) return;
    install.lastEventAt = toISODateTime(today.subtract(7 + ((i * 37) % 300), 'minute'));
    install.lastEventKind = KINDS[i % KINDS.length];
    if (i % 3 === 1) {
      install.recentErrors = [
        { id: `iaerr_${install.id}_1`, at: toISODateTime(today.subtract(1, 'day').hour(11).minute(20)), reason: REASONS[i % REASONS.length] },
        { id: `iaerr_${install.id}_2`, at: toISODateTime(today.subtract(4, 'day').hour(16).minute(5)), reason: REASONS[(i + 2) % REASONS.length] },
      ];
    }
  });

  return {
    apps,
    installs,
    reviews,
    subscriptions: [],
    developerAccounts: [],
    devApps: [],
    partnerApiKeys: [],
    userApiTokens: [],
    aiTokens: [],
    webhookConfigs,
    webhookDeliveries,
    promoBlocks,
    partnerApplications: [],
  };
}

export const integrationsSlice = defineSlice<IntegrationsState>({
  // v7 (QA 30.09): отзывы хранят authorRole вместо русской подписи authorName
  version: 7,
  seed,
});

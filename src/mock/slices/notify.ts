import type {
  AgentNotifyFlags,
  AltegioWhatsAppSettings,
  BookingNotifyOverride,
  ChannelConnection,
  ChatMessage,
  ClientNotifyPrefs,
  EmailChannelSettings,
  GiftShowcaseSettings,
  LogMessage,
  LoyaltyNotifyRule,
  Mailing,
  NewsItem,
  NotificationType,
  NotifyBalance,
  NotifySettings,
  OpenSlotsScheduleSettings,
  PartnerConnection,
  PartnerSummarySettings,
  SmsChannelSettings,
  StaffInvite,
  StaffNotifyPrefs,
  Webhook,
  WebPopupSettings,
} from '@/domain/notify';
import type { DayCloseNotice } from '@/domain/journalWorkday';
import {
  DEFAULT_AGENT_NOTIFY_FLAGS,
  DEFAULT_ALTEGIO_WHATSAPP,
  DEFAULT_GIFT_SHOWCASE,
  DEFAULT_OPEN_SLOTS_SCHEDULE,
  DEFAULT_PARTNER_SUMMARY,
  DEFAULT_QUIET_HOURS,
  NETWORK_SMS_BALANCE_SEED_AMD,
  NOTIFY_BALANCE_SEED_AMD,
  NOTIFY_CHANNELS,
} from '@/domain/notify';
import { PARTNER_APPS } from '@/areas/notify/lib/partnerCatalog';
import { LOYALTY_NOTIFY_DEFS } from '@/areas/notify/lib/loyaltyNotify';
import type { CoreData, Id, ISODateTime } from '@/domain/core';
import { buildTypes } from '@/areas/notify/lib/registry';
import type { ShortLink } from '@/areas/notify/lib/shortLink';
import { defineSlice } from '@/mock/slice';
import { dayjs, toISODateTime } from '@/lib/date';

// Реэкспорт для тестов движка (F-05-043, liveLog.test.ts) — тесту нельзя импортировать mock/slices/*
// напрямую (no-restricted-imports), а сид базы ниже и тест обязаны строить ОДНИ И ТЕ ЖЕ типы.
export { buildTypes } from '@/areas/notify/lib/registry';

/**
 * Срез моковой базы раздела «notify». Принадлежит разделу.
 * Всё ключуется id бизнеса (Business.id), кроме news (сервисные новости — общие на всю платформу).
 */
export interface NotifyState {
  types: Record<Id, NotificationType[]>;
  channels: Record<Id, ChannelConnection[]>;
  emailSettings: Record<Id, EmailChannelSettings>;
  smsSettings: Record<Id, SmsChannelSettings>;
  mailings: Record<Id, Mailing[]>;
  log: Record<Id, LogMessage[]>;
  /** id сообщений журнала, уже прочитанных в центре уведомлений (F-05-061) — по бизнесу */
  inboxRead: Record<Id, string[]>;
  /** Язык и формат уведомлений клиенту (F-05-010, F-05-011) — своё умолчание, пока settings не даёт поле */
  settings: Record<Id, NotifySettings>;
  /** Ручная правка уведомлений одной записи (F-05-009, F-05-082) — по id записи (Booking.id) */
  bookingOverrides: Record<Id, BookingNotifyOverride>;
  /** Индивидуальные настройки уведомлений клиента (F-05-090/091/098) — по id клиента (Client.id) */
  clientPrefs: Record<Id, ClientNotifyPrefs>;
  /** «Уведомления в Web-версии» (F-05-058) — по бизнесу */
  webPopups: Record<Id, WebPopupSettings>;
  /** ⭐ «Закрыт день» владельцу в колокольчик (01.10.2026): снимок итога дня на бизнес и день (пишет закрытие смены) */
  dayCloseNotices?: DayCloseNotice[];
  /**
   * F-05-118: баланс на сетевую SMS-рассылку, ֏ — ключ: id ГЛАВНОЙ локации сети (`Network.mainBusinessId`).
   * 🔒 черновой баланс (нет общего поля биллинга — см. комментарий у `NETWORK_SMS_RATE_AMD`).
   */
  networkSmsBalanceAmd: Record<Id, number>;
  news: NewsItem[];
  /** F-05-122/F-05-123: чем подключено приложение-канал из каталога, по businessId одной из его локаций */
  partnerConnections: Record<Id, PartnerConnection[]>;
  /** F-05-071/072/073: режим WhatsApp через Altegio, по бизнесу */
  altegioWhatsApp: Record<Id, AltegioWhatsAppSettings>;
  /** F-05-115: баланс на платные каналы (WhatsApp Notification Sender), по бизнесу (своя локация) */
  notifyBalanceAmd: Record<Id, NotifyBalance>;
  /** F-05-120: вебхуки внешним системам, по бизнесу */
  webhooks: Record<Id, Webhook[]>;
  /** F-05-121: что сам Altegio шлёт при записи через внешнего агента, по бизнесу */
  agentFlags: Record<Id, AgentNotifyFlags>;
  /** F-05-126: сводки/оповещения бизнесу от партнёров, по бизнесу */
  partnerSummary: Record<Id, PartnerSummarySettings>;
  /** F-05-124: расписание картинки свободных окон в Telegram, по бизнесу */
  openSlotsSchedule: Record<Id, OpenSlotsScheduleSettings>;
  /** F-05-127: витрина подарков партнёра в уведомлении о записи, по бизнесу */
  giftShowcase: Record<Id, GiftShowcaseSettings>;
  /** F-05-081/F-05-100…106/F-05-128/F-05-136: правила лояльности/абонементов/писем, по бизнесу */
  loyaltyNotify: Record<Id, LoyaltyNotifyRule[]>;
  /** F-05-135: id закрытых крестиком служебных баннеров, по бизнесу — условие показа считается на лету */
  serviceBannerDismissed: Record<Id, string[]>;
  /** F-05-087: переписка с клиентом через подключённого партнёра-чата, по бизнесу, дальше по телефону */
  chatMessages: Record<Id, ChatMessage[]>;
  /** F-05-089: демо-ссылка на оплату визита (у нас — ручная предоплата, ссылка не платёжная), по bookingId */
  paymentLinks: Record<Id, { bookingId: Id; url: string; createdAt: string }>;
  /** F-05-088: непрочитанные входящие чата, по бизнесу — красная точка и всплывашка, сброс при открытии чата */
  chatUnread: Record<Id, number>;
  /** F-05-055…057: вид уведомлений, таблица тип×каналы, «отправлять контакты клиента» — по staffId */
  staffNotifyPrefs: Record<Id, StaffNotifyPrefs>;
  /** F-05-063: приглашение сотрудника в систему — по staffId */
  staffInvites: Record<Id, StaffInvite>;
  /** 28.09: короткие ссылки SMS `booktime.am/s/<code>` — по коду (общие на платформу, код уникален глобально) */
  shortLinks: Record<string, ShortLink>;
}

const DEFAULT_NOTIFY_SETTINGS: NotifySettings = { language: 'ru', dateFormat: '24h', quietHours: { ...DEFAULT_QUIET_HOURS } };

const DEFAULT_CHANNEL_CONNECTIONS: ChannelConnection[] = NOTIFY_CHANNELS.map((channel) => ({
  channel,
  // ⭐ бесплатные каналы включены сразу: пуш клиенту, приложение администратора, email
  connected: channel === 'push' || channel === 'adminApp' || channel === 'email',
}));

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '.')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * Строки записи (создание/отмена/напоминание/…) больше НЕ сеются статично здесь — b02 (замер b01) нашёл их
 * оторванными от настоящих действий (журнал/онлайн-запись), потому что 27 моковых строк не менялись, что бы
 * ни делал сотрудник. Реальные строки теперь выводятся на лету из ядра (bookingEvents/bookings/clients +
 * настройки типов) функцией `deriveLiveLogEntries` (src/areas/notify/lib/liveLog.ts), вызываемой из
 * `listLog()` в src/api/notify.ts — так строка в журнале появляется именно тогда, когда действие
 * произошло по-настоящему, и переживает перезагрузку без отдельного хранения. Здесь остаются только
 * служебные сообщения без своей записи (смена пароля, приглашение сотрудника).
 */
function serviceLogEntries(businessId: Id, now: Date): LogMessage[] {
  const iso = toISODateTime(now);
  return [
    {
      // F-05-133: у нас пароля нет (вход по коду в WhatsApp/Telegram/SMS, F-00-033) — код первого входа
      // тоже свой служебный тип журнала, а не «письмо с паролем» Altegio.
      id: `lg_${businessId}_signup`,
      businessId,
      createdAt: toISODateTime(dayjs(now).subtract(30, 'day')),
      typeLabel: { ru: 'Код для первого входа', en: 'First sign-in code' },
      channel: 'sms',
      status: 'delivered',
      contact: '+374 00 100 000',
      text: {
        ru: 'Код для входа в кабинет: 482913. Пароль не нужен — входите по номеру и коду.',
        en: 'Your workspace sign-in code: 482913. No password needed — sign in with your phone and this code.',
      },
    },
    {
      id: `lg_${businessId}_pwd`,
      businessId,
      createdAt: iso,
      typeLabel: { ru: 'Изменение пароля', en: 'Password changed' },
      channel: 'email',
      status: 'delivered',
      contact: 'owner@example.com',
      text: { ru: 'Пароль от кабинета изменён.', en: 'The workspace password was changed.' },
    },
    {
      id: `lg_${businessId}_invite`,
      businessId,
      createdAt: iso,
      typeLabel: { ru: 'Приглашение сотрудников с доступом', en: 'Staff access invitation' },
      channel: 'sms',
      status: 'sent',
      contact: '+374 55 000 000',
      text: {
        ru: 'Вас пригласили в кабинет. Перейдите по ссылке, чтобы войти.',
        en: 'You were invited to the workspace. Follow the link to sign in.',
      },
    },
    {
      // F-05-131: демо-строка, чтобы тип был виден в журнале и через фильтр «Тип» без ожидания реальной
      // выгрузки — сама кнопка «Выгрузить в Excel» зовёт sendDataExportEmail() у хозяина (reports).
      id: `lg_${businessId}_export`,
      businessId,
      createdAt: toISODateTime(dayjs(now).subtract(2, 'day')),
      typeLabel: { ru: 'Выгрузка данных (ссылка на email)', en: 'Data export (email link)' },
      channel: 'email',
      status: 'sent',
      contact: 'owner@example.com',
      text: {
        ru: 'Ваша выгрузка «Клиентская база» готова: export.demo/clients-2026-09-24.xlsx',
        en: 'Your export "Client base" is ready: export.demo/clients-2026-09-24.xlsx',
      },
    },
    {
      // F-05-129: демо-строка (Украина/Checkbox — не наш регион, но тип обязан быть виден в реестре журнала).
      id: `lg_${businessId}_fiscal`,
      businessId,
      createdAt: toISODateTime(dayjs(now).subtract(1, 'day')),
      typeLabel: { ru: 'Фискальный чек', en: 'Fiscal receipt' },
      channel: 'email',
      status: 'sent',
      contact: 'client-demo@example.com',
      text: {
        ru: 'Фискальный чек по визиту: receipt.demo/9821',
        en: 'Fiscal receipt for your visit: receipt.demo/9821',
      },
    },
    {
      // F-05-134: демо-строка отчёта «Выполнение плана» по расписанию (сеть) — расписание хранит network.
      id: `lg_${businessId}_planreport`,
      businessId,
      createdAt: toISODateTime(dayjs(now).subtract(7, 'day')),
      typeLabel: { ru: 'Отчёт «Выполнение плана» (по расписанию)', en: 'Plan progress report (scheduled)' },
      channel: 'email',
      status: 'sent',
      contact: 'network-owner@example.com',
      text: {
        ru: 'Отчёт «Выполнение плана»: plan-report.demo/2026-09.xlsx',
        en: 'Plan progress report: plan-report.demo/2026-09.xlsx',
      },
    },
  ];
}

function seed(core: CoreData, now: Date): NotifyState {
  const types: Record<Id, NotificationType[]> = {};
  const channels: Record<Id, ChannelConnection[]> = {};
  const emailSettings: Record<Id, EmailChannelSettings> = {};
  const smsSettings: Record<Id, SmsChannelSettings> = {};
  const mailings: Record<Id, Mailing[]> = {};
  const log: Record<Id, LogMessage[]> = {};
  const settings: Record<Id, NotifySettings> = {};

  core.businesses.forEach((business, index) => {
    types[business.id] = buildTypes(business.id);
    channels[business.id] = DEFAULT_CHANNEL_CONNECTIONS.map((c) => ({ ...c }));
    emailSettings[business.id] = { replyEmail: `${slug(business.name) || 'salon'}@mail.am` };
    smsSettings[business.id] = { connected: false };
    settings[business.id] = { ...DEFAULT_NOTIFY_SETTINGS };

    log[business.id] = serviceLogEntries(business.id, now);

    const businessClientIds = core.clients.filter((c) => c.businessId === business.id && !c.deletedAt).map((c) => c.id);
    const clientsCount = businessClientIds.length;
    const daysAgo = (n: number): ISODateTime => toISODateTime(dayjs(now).subtract(n, 'day'));
    if (index % 2 === 0 && clientsCount > 0) {
      // recipientClientIds — чтобы F-05-096 «получал/не получал рассылку за период» находил их в фильтре.
      const recentIds = businessClientIds.slice(0, Math.max(1, Math.round(clientsCount * 0.7)));
      const oldIds = businessClientIds.slice(0, Math.max(1, Math.round(clientsCount * 0.4)));
      mailings[business.id] = [
        {
          id: `ml_${business.id}_1`,
          businessId: business.id,
          createdAt: daysAgo(10),
          channel: 'pushClientApp',
          text: 'Скидка 15% на маникюр всю неделю — успейте записаться!',
          audienceLabel: 'Все клиенты',
          recipientsCount: recentIds.length,
          status: 'sent',
          recipientClientIds: recentIds,
        },
        {
          id: `ml_${business.id}_2`,
          businessId: business.id,
          createdAt: daysAgo(28),
          channel: 'sms',
          text: 'Мы обновили расписание — новые окна уже открыты.',
          audienceLabel: 'Постоянные клиенты',
          recipientsCount: oldIds.length,
          status: 'sent',
          recipientClientIds: oldIds,
        },
      ];
    } else {
      mailings[business.id] = [];
    }
  });

  const news: NewsItem[] = [
    {
      id: 'news_1',
      title: 'Обновление платформы',
      text: 'Добавили журнал отправок и центр уведомлений — теперь видно судьбу каждого сообщения.',
      date: toISODateTime(dayjs(now).subtract(2, 'day')),
    },
    {
      id: 'news_2',
      title: 'Готовим брендированное приложение',
      text: 'Скоро можно будет заказать своё мобильное приложение с пушами клиентам.',
      date: toISODateTime(dayjs(now).subtract(9, 'day')),
    },
  ];

  // F-05-118: сеет баланс только главным локациям сетей — у остальных бизнесов сетевой рассылки нет.
  const networkSmsBalanceAmd: Record<Id, number> = {};
  core.networks.forEach((network) => {
    const mainId = network.mainBusinessId ?? network.businessIds[0];
    if (mainId) networkSmsBalanceAmd[mainId] = NETWORK_SMS_BALANCE_SEED_AMD;
  });

  const partnerConnections: Record<Id, PartnerConnection[]> = {};
  const altegioWhatsApp: Record<Id, AltegioWhatsAppSettings> = {};
  const notifyBalanceAmd: Record<Id, NotifyBalance> = {};
  const webhooks: Record<Id, Webhook[]> = {};
  const agentFlags: Record<Id, AgentNotifyFlags> = {};
  const partnerSummary: Record<Id, PartnerSummarySettings> = {};
  const openSlotsSchedule: Record<Id, OpenSlotsScheduleSettings> = {};
  const giftShowcase: Record<Id, GiftShowcaseSettings> = {};
  const loyaltyNotify: Record<Id, LoyaltyNotifyRule[]> = {};
  const chatMessages: Record<Id, ChatMessage[]> = {};
  const chatBotApp = PARTNER_APPS.find((app) => app.type === 'chatBot');

  core.businesses.forEach((business, index) => {
    partnerConnections[business.id] = [];
    altegioWhatsApp[business.id] = { ...DEFAULT_ALTEGIO_WHATSAPP };
    notifyBalanceAmd[business.id] = { amountAmd: NOTIFY_BALANCE_SEED_AMD };
    webhooks[business.id] = [];
    agentFlags[business.id] = { ...DEFAULT_AGENT_NOTIFY_FLAGS };
    partnerSummary[business.id] = { ...DEFAULT_PARTNER_SUMMARY };
    openSlotsSchedule[business.id] = { ...DEFAULT_OPEN_SLOTS_SCHEDULE };
    giftShowcase[business.id] = { ...DEFAULT_GIFT_SHOWCASE };
    loyaltyNotify[business.id] = LOYALTY_NOTIFY_DEFS.map((def) => ({
      code: def.code,
      enabled: def.enabledDefault,
      channel: def.channel,
      presets: def.presets,
      selectedPresetId: def.presets[0]?.id ?? 'custom',
      customText: '',
      daysBefore: def.daysBeforeDefault,
      visitsLeftTrigger: def.visitsLeftDefault,
      regionOnly: def.regionOnly,
    }));
    // F-05-069/070/075: одна демо-связка сразу подключена (нечётный индекс бизнеса), чтобы «Каталог» и
    // «Готово, когда» проверялись и на подключённом, и на неподключённом состоянии.
    if (index % 2 === 1 && PARTNER_APPS[0]) {
      partnerConnections[business.id] = [
        {
          appId: PARTNER_APPS[0].id,
          businessIds: [business.id],
          status: 'trial',
          connectedAt: toISODateTime(dayjs(now).subtract(3, 'day')),
          trialEndsAt: toISODateTime(dayjs(now).add(11, 'day')),
          systemUserLabel: `${PARTNER_APPS[0].name} bot`,
        },
      ];
    }

    // F-05-087: у того же демо-бизнеса ещё и чат-бот подключён (kind='chatBot') — иначе «Чат Beta» в
    // окне визита нечем проверить; для остальных бизнесов остаётся промо-карточка «Подключить чат».
    if (index % 2 === 1 && chatBotApp) {
      partnerConnections[business.id] = [
        ...partnerConnections[business.id],
        {
          appId: chatBotApp.id,
          businessIds: [business.id],
          status: 'active',
          connectedAt: toISODateTime(dayjs(now).subtract(20, 'day')),
          systemUserLabel: `${chatBotApp.name} bot`,
        },
      ];

      const firstClient = core.clients.find((c) => c.businessId === business.id && !c.deletedAt && c.phone);
      if (firstClient?.phone) {
        chatMessages[business.id] = [
          {
            id: `chat_${business.id}_1`,
            businessId: business.id,
            phone: firstClient.phone,
            clientId: firstClient.id,
            direction: 'in',
            text: 'Здравствуйте! Можно перенести завтрашнюю запись на вечер?',
            createdAt: toISODateTime(dayjs(now).subtract(2, 'hour')),
          },
          {
            id: `chat_${business.id}_2`,
            businessId: business.id,
            phone: firstClient.phone,
            clientId: firstClient.id,
            direction: 'out',
            text: 'Добрый день! Да, есть окно в 18:30, подойдёт?',
            createdAt: toISODateTime(dayjs(now).subtract(1, 'hour').subtract(50, 'minute')),
          },
          {
            id: `chat_${business.id}_3`,
            businessId: business.id,
            phone: firstClient.phone,
            clientId: firstClient.id,
            direction: 'in',
            text: 'Отлично, подходит, спасибо!',
            createdAt: toISODateTime(dayjs(now).subtract(1, 'hour').subtract(40, 'minute')),
          },
        ];
      }
    } else {
      chatMessages[business.id] = chatMessages[business.id] ?? [];
    }
  });

  return {
    types,
    channels,
    emailSettings,
    smsSettings,
    mailings,
    log,
    inboxRead: {},
    settings,
    bookingOverrides: {},
    clientPrefs: {},
    webPopups: {},
    dayCloseNotices: [],
    networkSmsBalanceAmd,
    news,
    partnerConnections,
    altegioWhatsApp,
    notifyBalanceAmd,
    webhooks,
    agentFlags,
    partnerSummary,
    openSlotsSchedule,
    giftShowcase,
    loyaltyNotify,
    serviceBannerDismissed: {},
    chatMessages,
    paymentLinks: {},
    chatUnread: {},
    staffNotifyPrefs: {},
    staffInvites: {},
    shortLinks: {},
  };
}

export const notifySlice = defineSlice<NotifyState>({
  version: 13,
  seed,
});

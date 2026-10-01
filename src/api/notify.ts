'use client';

/**
 * API раздела «notify». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area';
 * сущности ядра — функции '@/api/core'. Экраны зовут эти функции через useApiQuery/useApiMutation.
 */
import type {
  AgentNotifyFlags,
  AltegioWhatsAppMode,
  AltegioWhatsAppSettings,
  BookingNotifyOverride,
  ChannelConnection,
  ChatMessage,
  ClientNotifyPrefs,
  EmailChannelSettings,
  EmailExtra,
  GiftShowcaseSettings,
  LogMessage,
  LoyaltyNotifyEventCode,
  Mailing,
  MailingChannel,
  NotificationType,
  NotifyChannel,
  NotifyChannelSetting,
  NotifyScenario,
  NotifySettings,
  OneOffSource,
  OpenSlotsScheduleSettings,
  PartnerConnection,
  PartnerSummarySettings,
  ServiceBannerDef,
  StaffInvite,
  StaffNotifyChannel,
  StaffNotifyEvent,
  StaffNotifyPrefs,
  StaffNotifyView,
  SuggestedOpenSlot,
  TypeConditions,
  Webhook,
  WebhookEntity,
  WebPopupSettings,
  WhoToInviteSuggestion,
} from '@/domain/notify';
import {
  DEFAULT_AGENT_NOTIFY_FLAGS,
  DEFAULT_ALTEGIO_WHATSAPP,
  DEFAULT_CLIENT_NOTIFY_PREFS,
  DEFAULT_GIFT_SHOWCASE,
  DEFAULT_OPEN_SLOTS_SCHEDULE,
  DEFAULT_PARTNER_SUMMARY,
  DEFAULT_WEB_POPUP_SETTINGS,
  DEFAULT_QUIET_HOURS,
  defaultStaffNotifyPrefs,
  NETWORK_SMS_RATE_AMD,
} from '@/domain/notify';
import type { BookingStatus, Client, Id, ISODateTime, LocalizedText } from '@/domain/core';
import { mutateArea, readArea, readCore } from '@/api/area';
import { changeBookingStatus, coreCreate, currentActor } from '@/api/core';
import { isApiMode } from '@/api/http';
import * as N from '@/api/notify.server';
import { dayCloseNoticesForSync } from '@/api/notify-dayclose';
import { dayCloseInboxId } from '@/domain/journalWorkday';
import { getMessageLanguage } from '@/api/settings';
import { ApiError, request } from '@/api/request';
import { dayjs, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { deriveLiveLogEntries } from '@/areas/notify/lib/liveLog';
import { upgradeSmsDefaults } from '@/areas/notify/lib/registry';
import { isSafeTarget, isShortCode, shortCodeFor, type ShortLink } from '@/areas/notify/lib/shortLink';
import { countSms } from '@/areas/notify/lib/sms';
import { PARTNER_APPS } from '@/areas/notify/lib/partnerCatalog';
import { LOYALTY_NOTIFY_DEFS } from '@/areas/notify/lib/loyaltyNotify';

/**
 * Журнал отправок (`s.log[businessId]`) копится `unshift`-ом на каждое тестовое/симулированное сообщение
 * без потолка — за долгую демо-сессию это и раздувало `bp-mock-db` в localStorage до QuotaExceededError
 * (не только у notify — тот же диагноз ловили payroll/loyalty/stock, `qa/requests/notify.md` g3-1-m0):
 * запись переставала сохраняться, а тумблеры/настройки откатывались на reload. Новых записей всё равно
 * не больше NEW_LOG_ROWS_PER_ACTION за раз, поэтому потолок в разы больше одной сессии интерфейса —
 * хвост журнала теряется, только если реально прислать тысячи тестовых сообщений подряд.
 */
const MAX_LOG_PER_BUSINESS = 500;

/** Свежие записи впереди (`unshift`), лишний хвост — долой, чтобы `s.log[businessId]` не рос без предела */
function capLog(log: LogMessage[]): LogMessage[] {
  return log.length > MAX_LOG_PER_BUSINESS ? log.slice(0, MAX_LOG_PER_BUSINESS) : log;
}

/** Тот же потолок для рассылок (новые впереди, `unshift`) — тот же класс неограниченного роста */
function capMailings(list: Mailing[]): Mailing[] {
  return list.length > MAX_LOG_PER_BUSINESS ? list.slice(0, MAX_LOG_PER_BUSINESS) : list;
}

/** И для переписки чата (новые в конце, `push`) — держим хвост, а не голову */
function capChat(list: ChatMessage[]): ChatMessage[] {
  return list.length > MAX_LOG_PER_BUSINESS ? list.slice(list.length - MAX_LOG_PER_BUSINESS) : list;
}

function types(businessId: Id): NotificationType[] {
  // 28.09: прежний полный SMS-текст по умолчанию читается как короткий; свои тексты салона не трогаем
  return upgradeSmsDefaults(readArea('notify').types[businessId] ?? []);
}

export const listTypes = (businessId: Id) => {
  if (isApiMode()) return N.listTypes(businessId);
  return request(() => types(businessId));
};

export const getType = (businessId: Id, code: number) => {
  if (isApiMode()) return N.getType(businessId, code);
  return request(() => types(businessId).find((t) => t.code === code));
};

export interface TypePatch {
  enabled?: boolean;
  channels?: NotifyChannelSetting[];
  /** Патч по каналу — {ru?,hy?,en?} мержится ПОВЕРХ текущего (не перетирает другие языки того же канала) */
  templates?: Partial<Record<NotifyChannel, Partial<LocalizedText>>>;
  emailExtra?: EmailExtra;
  conditions?: TypeConditions;
}

export const updateType = (input: { businessId: Id; code: number; patch: TypePatch }): Promise<NotificationType> => {
  if (isApiMode()) return N.updateType(input);
  return request<NotificationType>(() => {
    // Возврат — сам обновлённый тип, не весь `NotifyState` (mutateArea) — иначе тип расходится с api-веткой
    // (та же ловушка, что чинили попыткой 2 у 7 других функций этого файла — tsc не видит несовпадение, пока
    // рядом не появится типизированная серверная ветка).
    mutateArea('notify', (s) => {
      const list = s.types[input.businessId];
      if (!list) return;
      const type = list.find((t) => t.code === input.code);
      if (!type) return;
      if (input.patch.enabled !== undefined) type.enabled = input.patch.enabled;
      if (input.patch.channels) type.channels = input.patch.channels;
      if (input.patch.templates) {
        const nextTemplates = { ...type.templates };
        for (const [channel, patch] of Object.entries(input.patch.templates) as [NotifyChannel, Partial<LocalizedText>][]) {
          const current = nextTemplates[channel] ?? { ru: '' };
          nextTemplates[channel] = { ...current, ...patch, ru: patch.ru ?? current.ru };
        }
        type.templates = nextTemplates;
      }
      if (input.patch.emailExtra) type.emailExtra = input.patch.emailExtra;
      if (input.patch.conditions) type.conditions = { ...type.conditions, ...input.patch.conditions };
    });
    const updated = types(input.businessId).find((t) => t.code === input.code);
    if (!updated) throw new ApiError('not_found', 'Notification type not found');
    return updated;
  });
};

export const setTypeChannelScenario = (input: { businessId: Id; code: number; channel: NotifyChannel; scenario: NotifyScenario }) =>
  request(() =>
    mutateArea('notify', (s) => {
      const type = s.types[input.businessId]?.find((t) => t.code === input.code);
      if (!type) return;
      const existing = type.channels.find((c) => c.channel === input.channel);
      if (existing) existing.scenario = input.scenario;
      else type.channels.push({ channel: input.channel, scenario: input.scenario });
    }),
  );

// ─────────────────── Своё время напоминания для услуги (Ув15) ───────────────────

/**
 * Время напоминания (тип 1) для отдельной услуги: «за N часов до визита». Экран услуги (раздел services) зовёт
 * getServiceReminderHours/setServiceReminderHours — хранится в условиях типа 1 (`serviceTimingHours`), движок
 * журнала (liveLog) берёт его вместо общего времени типа. null — снять своё время (действует общее).
 */
export const getServiceReminderHours = (input: { businessId: Id; serviceId: Id }) => {
  if (isApiMode()) return N.getServiceReminderHours(input);
  return request<number | null>(
    () => types(input.businessId).find((t) => t.code === 1)?.conditions?.serviceTimingHours?.[input.serviceId] ?? null,
  );
};

export const setServiceReminderHours = (input: { businessId: Id; serviceId: Id; hours: number | null }) => {
  if (isApiMode()) return N.setServiceReminderHours(input);
  return request(() => {
    mutateArea('notify', (s) => {
      const type = s.types[input.businessId]?.find((t) => t.code === 1);
      if (!type) return;
      const map = { ...(type.conditions?.serviceTimingHours ?? {}) };
      if (input.hours === null) delete map[input.serviceId];
      else map[input.serviceId] = Math.max(0, input.hours);
      type.conditions = { ...type.conditions, serviceTimingHours: map };
    });
  });
};

// ─────────────────────────── Язык и формат уведомлений (F-05-010, F-05-011) ───────────────────────────

const DEFAULT_NOTIFY_SETTINGS: NotifySettings = { language: 'ru', dateFormat: '24h', quietHours: DEFAULT_QUIET_HOURS };

/** Настройки уведомлений бизнеса; тихие часы (Ув12) — всегда заполнены (нет поля — умолчание 22:00–09:00) */
export const getNotifySettings = async (businessId: Id): Promise<NotifySettings> => {
  if (isApiMode()) return N.getNotifySettings(businessId);
  const [stored, language] = await Promise.all([
    request<NotifySettings>(() => {
      const own = readArea('notify').settings[businessId] ?? DEFAULT_NOTIFY_SETTINGS;
      return { ...own, quietHours: own.quietHours ?? DEFAULT_QUIET_HOURS };
    }),
    getMessageLanguage(businessId).catch(() => undefined),
  ]);
  // Н5 (28.09): язык сообщений клиентам — один источник, «Системные» (settings.messageLanguage); своё поле — запасное
  return { ...stored, language: language ?? stored.language };
};

/** Синхронное чтение того же единого языка — для живого журнала отправок внутри request() */
function messageLanguageOf(businessId: Id, fallback: NotifySettings['language']): NotifySettings['language'] {
  return readArea('settings').systemSettings[businessId]?.messageLanguage ?? fallback;
}

export const updateNotifySettings = (input: { businessId: Id; settings: NotifySettings }) => {
  if (isApiMode()) return N.updateNotifySettings(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.settings[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

// ─────────────────────── Ручная правка уведомлений записи (F-05-009, F-05-082) ───────────────────────

/**
 * Умолчание для записи без своей правки. ⭐ F-00-120: напоминание — только пуш, включён по умолчанию;
 * SMS/Email — платные ручные каналы, по умолчанию выключены (были включены — прямое нарушение решения).
 */
export const DEFAULT_BOOKING_NOTIFY_OVERRIDE: BookingNotifyOverride = {
  sendOnSave: true,
  pushEnabled: true,
  pushTimingHours: 1,
  smsEnabled: false,
  smsTimingHours: 1,
  emailEnabled: false,
  emailTimingHours: 12,
  telegramEnabled: true,
};

export const getBookingNotifyOverride = (bookingId: Id) => {
  if (isApiMode()) return N.getBookingNotifyOverride(currentBusinessIdForNotify(), bookingId);
  return request(() => readArea('notify').bookingOverrides[bookingId] ?? DEFAULT_BOOKING_NOTIFY_OVERRIDE);
};

export const updateBookingNotifyOverride = (input: { bookingId: Id; override: BookingNotifyOverride }) => {
  if (isApiMode()) return N.updateBookingNotifyOverride(currentBusinessIdForNotify(), input.bookingId, input.override);
  return request(() => {
    mutateArea('notify', (s) => {
      s.bookingOverrides[input.bookingId] = input.override;
    });
    return input.override;
  });
};

// ─────────────────────────── Каналы отправки ───────────────────────────

export const listChannels = (businessId: Id) => {
  if (isApiMode()) return N.listChannels(businessId);
  return request(() => readArea('notify').channels[businessId] ?? []);
};

export const setChannelConnected = (input: { businessId: Id; channel: NotifyChannel; connected: boolean }) => {
  if (isApiMode()) return N.setChannelConnected(input);
  return request(() => {
    mutateArea('notify', (s) => {
      const list: ChannelConnection[] = s.channels[input.businessId] ?? [];
      const row = list.find((c) => c.channel === input.channel);
      if (row) row.connected = input.connected;
      else list.push({ channel: input.channel, connected: input.connected });
      s.channels[input.businessId] = list;
    });
    return { channel: input.channel, connected: input.connected };
  });
};

export const getEmailSettings = (businessId: Id) => {
  if (isApiMode()) return N.getEmailSettings(businessId);
  return request(() => readArea('notify').emailSettings[businessId] ?? { replyEmail: '' });
};

export const updateEmailSettings = (input: { businessId: Id; settings: EmailChannelSettings }) => {
  if (isApiMode()) return N.updateEmailSettings(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.emailSettings[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

export const getSmsSettings = (businessId: Id) => {
  if (isApiMode()) return N.getSmsSettings(businessId);
  return request(() => readArea('notify').smsSettings[businessId] ?? { connected: false });
};

export const connectSms = (input: { businessId: Id; apiKey: string; senderName: string }) => {
  if (isApiMode()) return N.connectSms(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.smsSettings[input.businessId] = { connected: true, apiKey: input.apiKey, senderName: input.senderName };
      const list: ChannelConnection[] = s.channels[input.businessId] ?? [];
      const row = list.find((c) => c.channel === 'sms');
      if (row) row.connected = true;
      else list.push({ channel: 'sms', connected: true });
      s.channels[input.businessId] = list;
    });
  });
};

export const disconnectSms = (businessId: Id) => {
  if (isApiMode()) return N.disconnectSms(businessId);
  return request(() => {
    mutateArea('notify', (s) => {
      s.smsSettings[businessId] = { connected: false };
      const row = s.channels[businessId]?.find((c) => c.channel === 'sms');
      if (row) row.connected = false;
    });
  });
};

// ─────────────────────────── Рассылки ───────────────────────────

/** Рассылка по расписанию, чьё время прошло, — уже отправлена (Ув13); храним как была, статус выводим при чтении */
function effectiveMailing(m: Mailing, now: string): Mailing {
  return m.status === 'scheduled' && m.scheduledAt && m.scheduledAt <= now ? { ...m, status: 'sent' } : m;
}

export const listMailings = (businessId: Id) =>
  isApiMode()
    ? N.listMailings(businessId)
    : request(() => {
    const now = toISODateTime(new Date());
    return (readArea('notify').mailings[businessId] ?? [])
      .map((m) => effectiveMailing(m, now))
      .sort((a, b) => ((a.scheduledAt ?? a.createdAt) < (b.scheduledAt ?? b.createdAt) ? 1 : -1));
  });

/** ⭐ F-00-114 / F-05-095: не больше стольки бесплатных пушей подписчикам в неделю на бизнес */
export const WEEKLY_PUSH_LIMIT = 3;

function recentAppPushCount(businessId: Id): number {
  const weekAgo = dayjs().subtract(7, 'day');
  return (readArea('notify').mailings[businessId] ?? []).filter(
    (m) => m.channel === 'pushClientApp' && dayjs(m.createdAt).isAfter(weekAgo),
  ).length;
}

/** Сколько пушей своим подписчикам ушло за последние 7 дней (F-05-095: лимит 3 в неделю, F-00-114) */
export const countRecentAppPushes = (businessId: Id) =>
  isApiMode() ? N.countRecentAppPushes(businessId) : request(() => recentAppPushCount(businessId));

export const NOTIFY_NETWORK_SMS_RATE_AMD = NETWORK_SMS_RATE_AMD;

export interface CreateMailingInput {
  businessId: Id;
  /** Все филиалы-получатели (сеть, F-05-097) или один businessId */
  businessIds: Id[];
  channel: MailingChannel;
  text: string;
  audienceLabel: string;
  filter: AudienceFilter;
  network?: boolean;
  /** Отправить позже (Ув13), 'YYYY-MM-DDTHH:mm'; нет — сразу */
  scheduledAt?: ISODateTime;
}

/** Подстановка переменных рассылки (Ув13) для одного получателя: {clientName}, {companyName}, {bookingLink}… */
export function fillMailingText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/** Переменные рассылки, общие для всех получателей бизнеса (название, ссылка на запись, телефон) */
export function mailingBusinessVars(businessId: Id): Record<string, string> {
  const business = readCore().businesses.find((b) => b.id === businessId);
  const slug = business?.slug;
  return {
    companyName: business?.brandName || business?.name || '',
    bookingLink: slug ? `booktime.am/b/${slug}/book` : '',
    companyPhone: business?.phone ?? '',
  };
}

function mailingRecipientVars(businessId: Id, client: Client): Record<string, string> {
  const [first, ...rest] = client.name.trim().split(/\s+/);
  return { ...mailingBusinessVars(businessId), clientName: first ?? '', clientLastName: rest.join(' ') };
}

/** Цена SMS-рассылки (Ув13): части самого длинного персонального текста × тариф × получатели */
function mailingCostAmd(input: { businessId: Id; channel: MailingChannel; text: string }, recipients: Client[]): number {
  if (input.channel !== 'sms') return 0;
  return recipients.reduce(
    (sum, c) => sum + Math.max(1, countSms(fillMailingText(input.text, mailingRecipientVars(input.businessId, c))).parts) * NETWORK_SMS_RATE_AMD,
    0,
  );
}

export const createMailing = (input: CreateMailingInput) =>
  isApiMode()
    ? N.createMailing(input)
    : request(() => {
    // ⭐ F-00-114 / F-05-095: лимит проверяем ЗДЕСЬ, а не только кнопкой на экране — иначе его
    // обходит любой второй вызов API (b02 нашла: canSend в NewMailingScreen — единственная защита).
    if (input.channel === 'pushClientApp' && recentAppPushCount(input.businessId) >= WEEKLY_PUSH_LIMIT) {
      throw new Error('notify/weekly-push-limit');
    }
    // Список реальных получателей считаем здесь же (не доверяем счётчику с экрана) — он же ложится
    // в recipientClientIds, по которым F-05-096 находит «получал рассылку за период».
    const recipients = audienceClients(input.businessIds, input.filter);

    const now = toISODateTime(new Date());
    const scheduled = !!input.scheduledAt && input.scheduledAt > now;
    const costAmd = mailingCostAmd(input, recipients);
    const mailing: Mailing = {
      id: newId('ml'),
      businessId: input.businessId,
      createdAt: now,
      channel: input.channel,
      text: input.text,
      audienceLabel: input.audienceLabel,
      recipientsCount: recipients.length,
      status: recipients.length === 0 ? 'failed' : scheduled ? 'scheduled' : 'sent',
      network: input.network,
      recipientClientIds: recipients.map((c) => c.id),
      scheduledAt: scheduled ? input.scheduledAt : undefined,
      costAmd,
    };
    mutateArea('notify', (s) => {
      s.mailings[input.businessId] = capMailings([mailing, ...(s.mailings[input.businessId] ?? [])]);
      // Рассылка по расписанию (Ув13) в журнал отправок попадает, когда уйдёт — до того она в «Запланировано»
      if (scheduled) return;
      const log = s.log[input.businessId] ?? [];
      // Служебные типы журнала без своей страницы настройки (F-05-004: 15 — сообщение из карточки
      // клиента, 22 — сетевая рассылка); обычная рассылка локации — без кода, она настраиваемого типа
      // «Mass mailing» ещё не имеет (F-05-099 — просто ссылка на канал в этой же функции).
      log.unshift({
        id: newId('lg'),
        businessId: input.businessId,
        createdAt: mailing.createdAt,
        typeCode: input.network ? 22 : undefined,
        // Название типа — наш ярлык (переводим); текст рассылки — то, что реально ввёл владелец
        // бизнеса (обычно по-русски) — не выдумываем перевод, en просто покажет ru (LocalizedText).
        typeLabel: input.network
          ? { ru: 'Сетевая рассылка', en: 'Network mailing', hy: 'Ցանցային առաքում' }
          : { ru: 'Рассылка', en: 'Mailing', hy: 'Առաքում' },
        channel: input.channel === 'sms' ? 'sms' : 'push',
        status: 'sent',
        contact: String(recipients.length),
        text: { ru: input.text },
        costAmd,
      });
      s.log[input.businessId] = capLog(log);
    });
    return mailing;
  });

/**
 * «Отправить тест себе» (Ув13): одно сообщение на телефон бизнеса с переменными, заполненными как у клиента
 * (имя — имя владельца). Пишется в журнал отправок отдельным служебным типом «Тестовая рассылка».
 */
export const sendTestMailing = (input: { businessId: Id; channel: MailingChannel; text: string }) =>
  isApiMode()
    ? N.sendTestMailing(input)
    : request(() => {
    const core = readCore();
    const business = core.businesses.find((b) => b.id === input.businessId);
    const owner = core.staff.find((st) => st.id === business?.ownerStaffId);
    const phone = owner?.phone || business?.phone || '';
    if (!phone) throw new ApiError('notify/no-test-phone');
    const [first] = (owner?.name ?? '').trim().split(/\s+/);
    const text = fillMailingText(input.text, { ...mailingBusinessVars(input.businessId), clientName: first ?? '', clientLastName: '' });
    const channel: NotifyChannel = input.channel === 'sms' ? 'sms' : 'push';
    const parts = channel === 'sms' ? Math.max(1, countSms(text).parts) : undefined;
    const row: LogMessage = {
      id: newId('lg'),
      businessId: input.businessId,
      createdAt: toISODateTime(new Date()),
      typeLabel: { ru: 'Тестовая рассылка', en: 'Test mailing', hy: 'Փորձնական առաքում' },
      channel,
      status: 'sent',
      contact: phone,
      text: { ru: text },
      costAmd: parts ? parts * NETWORK_SMS_RATE_AMD : 0,
      smsParts: parts,
      staffId: owner?.id,
    };
    mutateArea('notify', (s) => {
      s.log[input.businessId] = capLog([row, ...(s.log[input.businessId] ?? [])]);
    });
    return { phone };
  });

/** «Получал / не получал рассылку за N дней» (F-05-096, поле «По клиентам») */
export interface ReceivedMailingFilter {
  status: 'received' | 'notReceived';
  days: number;
}

/** Аудитория рассылки по клиентской базе бизнеса (F-05-096) — простой набор фильтров ядра */
export interface AudienceFilter {
  onlyWithApp?: boolean;
  onlyBirthdayMonth?: boolean;
  excludeBlocked?: boolean;
  receivedMailing?: ReceivedMailingFilter;
  /** Ув13 «давно не был»: последний визит («пришёл») раньше N дней назад (и хотя бы один визит был) */
  lastVisitOlderThanDays?: number;
  /** Ув13: был на этой услуге */
  serviceId?: Id;
  /** Ув13: был у этого мастера */
  staffId?: Id;
  /** Ув13: новые (0–1 визит) / повторные (2 и больше) */
  visitKind?: 'new' | 'returning';
}

/** Кто получал рассылку любого из businessIds за последние `days` дней */
function recentMailingRecipients(businessIds: Id[], days: number): Set<Id> {
  const since = dayjs().subtract(days, 'day');
  const mailingsByBusiness = readArea('notify').mailings;
  const ids = new Set<Id>();
  businessIds.forEach((bId) => {
    (mailingsByBusiness[bId] ?? []).forEach((m) => {
      if (!dayjs(m.createdAt).isAfter(since)) return;
      (m.recipientClientIds ?? []).forEach((id) => ids.add(id));
    });
  });
  return ids;
}

/** Настройки клиента (F-05-090) — умолчание, если своих ещё нет */
function clientPrefs(clientId: Id): ClientNotifyPrefs {
  return readArea('notify').clientPrefs[clientId] ?? DEFAULT_CLIENT_NOTIFY_PREFS;
}

/** Визиты «пришёл» по клиенту — для сегментов «давно не был», «по услуге/мастеру», «новые/повторные» (Ув13) */
function arrivedVisitsByClient(businessIds: Id[]): Map<Id, { start: string; serviceIds: Id[]; staffId: Id }[]> {
  const map = new Map<Id, { start: string; serviceIds: Id[]; staffId: Id }[]>();
  readCore().bookings.forEach((b) => {
    if (!b.clientId || b.deletedAt || b.status !== 'arrived' || !businessIds.includes(b.businessId)) return;
    const list = map.get(b.clientId) ?? [];
    list.push({ start: b.start, serviceIds: b.services.map((l) => l.serviceId), staffId: b.staffId });
    map.set(b.clientId, list);
  });
  return map;
}

function audienceClients(businessIds: Id[], filter: AudienceFilter): Client[] {
  const now = dayjs();
  const received = filter.receivedMailing ? recentMailingRecipients(businessIds, filter.receivedMailing.days) : null;
  const needsVisits = filter.lastVisitOlderThanDays !== undefined || !!filter.serviceId || !!filter.staffId || !!filter.visitKind;
  const visits = needsVisits ? arrivedVisitsByClient(businessIds) : null;
  const staleBefore = filter.lastVisitOlderThanDays !== undefined ? toISODateTime(now.subtract(filter.lastVisitOlderThanDays, 'day')) : null;
  const matches = readCore().clients.filter((c) => {
    if (visits) {
      const list = visits.get(c.id) ?? [];
      if (staleBefore !== null && (list.length === 0 || list.some((v) => v.start > staleBefore))) return false;
      if (filter.serviceId && !list.some((v) => v.serviceIds.includes(filter.serviceId!))) return false;
      if (filter.staffId && !list.some((v) => v.staffId === filter.staffId)) return false;
      if (filter.visitKind === 'new' && list.length > 1) return false;
      if (filter.visitKind === 'returning' && list.length < 2) return false;
    }
    if (!businessIds.includes(c.businessId) || c.deletedAt) return false;
    if (filter.excludeBlocked !== false && c.blocked) return false;
    // F-05-090/098: клиент, исключивший себя из рекламных рассылок, ни в одну массовую не попадает.
    if (clientPrefs(c.id).marketingOptOut) return false;
    if (filter.onlyWithApp && !c.appUserId) return false;
    if (filter.onlyBirthdayMonth && (!c.birthday || dayjs(c.birthday).month() !== now.month())) return false;
    if (received) {
      const has = received.has(c.id);
      if (filter.receivedMailing!.status === 'received' && !has) return false;
      if (filter.receivedMailing!.status === 'notReceived' && has) return false;
    }
    return true;
  });
  // F-05-097: клиент нескольких филиалов сети — один и тот же человек по номеру телефона,
  // рассылка ему уходит один раз, а не по разу за каждый филиал.
  const seenPhones = new Set<string>();
  return matches.filter((c) => {
    if (seenPhones.has(c.phone)) return false;
    seenPhones.add(c.phone);
    return true;
  });
}

export const countAudience = (input: { businessIds: Id[]; filter: AudienceFilter }) =>
  isApiMode() ? N.countAudience(input) : request(() => audienceClients(input.businessIds, input.filter).length);

// ─────────────────────────── Журнал отправок ───────────────────────────

export const listLog = (businessId: Id) =>
  isApiMode()
    ? N.listLog(businessId)
    : request(() => {
    // Служебные строки (смена пароля, приглашение сотрудника, рассылки — createMailing выше) хранятся
    // в срезе как есть; всё, что реально «уходит клиенту по действию записи», выводится заново на каждый
    // вызов из ядра (bookingEvents/bookings/clients) — deriveLiveLogEntries — b02: b01 нашла раздел
    // отключённым от реальных действий журнала/онлайн-записи, а трогать их файлы разделу не положено.
    const stored = (readArea('notify').log[businessId] ?? []).filter((m) => !m.scheduled || m.createdAt <= toISODateTime(new Date()));
    // F-05-010/F-05-011: язык/формат бизнеса передаются в движок (liveEntries) — иначе всё было бы на ru и DD.MM.YYYY.
    const live = liveEntries(businessId);
    const now = toISODateTime(new Date());
    // Рассылки по расписанию, чьё время наступило (Ув13), — строкой журнала в момент отправки
    const dueMailings = (readArea('notify').mailings[businessId] ?? [])
      .filter((m) => m.status === 'scheduled' && m.scheduledAt && m.scheduledAt <= now)
      .map<LogMessage>((m) => ({
        id: `lg_ml_${m.id}`,
        businessId,
        createdAt: m.scheduledAt!,
        typeCode: m.network ? 22 : undefined,
        typeLabel: m.network ? { ru: 'Сетевая рассылка', en: 'Network mailing', hy: 'Ցանցային առաքում' } : { ru: 'Рассылка', en: 'Mailing', hy: 'Առաքում' },
        channel: m.channel === 'sms' ? 'sms' : 'push',
        status: 'sent',
        contact: String(m.recipientsCount),
        text: { ru: m.text },
        costAmd: m.costAmd ?? 0,
      }));
    // Ув11: «Запланировано» (момент отправки ещё не наступил, в т.ч. перенесённое тихими часами) — отдельный список,
    // в журнале отправок только то, что уже ушло.
    return [...stored, ...dueMailings, ...live.filter((m) => !m.scheduled)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });

function withSharedLanguage(businessId: Id, settings: NotifySettings): NotifySettings {
  return { ...settings, language: messageLanguageOf(businessId, settings.language) };
}

function liveEntries(businessId: Id): LogMessage[] {
  const known = readArea('notify').shortLinks ?? {};
  const fresh = new Map<string, ShortLink>();
  const entries = deriveLiveLogEntries({
    businessId,
    core: readCore(),
    types: types(businessId),
    overrides: readArea('notify').bookingOverrides,
    clientPrefs: readArea('notify').clientPrefs,
    settings: withSharedLanguage(businessId, readArea('notify').settings[businessId] ?? DEFAULT_NOTIFY_SETTINGS),
    now: new Date(),
    accessHashes: accessHashesOf(businessId),
    telegramLinked: readArea('client').telegramLinked,
    shorten: (target) => shortCodeOf(businessId, target, known, fresh),
  });
  persistShortLinks(fresh);
  return entries;
}

// ─────────────────────────── Короткие ссылки SMS (28.09) ───────────────────────────

/**
 * Хэш «моя запись без входа» по id записи (online.bookingMeta; синхронное чтение внутри request(), как
 * `messageLanguageOf` выше) — без него ссылка из сообщения открывала «Запись не найдена».
 */
function accessHashesOf(businessId: Id): Record<Id, string> {
  const meta = readArea('online').bookingMeta ?? {};
  const own = new Set(readCore().bookings.filter((b) => b.businessId === businessId).map((b) => b.id));
  const out: Record<Id, string> = {};
  for (const [id, m] of Object.entries(meta)) if (own.has(id) && m.accessHash) out[id] = m.accessHash;
  return out;
}

/** Код короткой ссылки: уже есть на этот путь — тот же; нет — детерминированный (совпадение кода — соль +1) */
function shortCodeOf(businessId: Id, target: string, known: Record<string, ShortLink>, fresh: Map<string, ShortLink>): string {
  for (let salt = 0; salt < 8; salt++) {
    const code = shortCodeFor(businessId, target, salt);
    const taken = known[code] ?? fresh.get(code);
    if (!taken) {
      fresh.set(code, { code, target, businessId, createdAt: toISODateTime(new Date()) });
      return code;
    }
    if (taken.target === target && taken.businessId === businessId) return code;
  }
  throw new ApiError('conflict', 'short link collision');
}

/** Новые коды — одним изменением среза и только если они есть: повторное чтение журнала ничего не пишет */
function persistShortLinks(fresh: Map<string, ShortLink>): void {
  if (!fresh.size) return;
  mutateArea('notify', (s) => {
    s.shortLinks = { ...(s.shortLinks ?? {}), ...Object.fromEntries(fresh) };
  });
}

/** Куда ведёт короткая ссылка `/s/<code>` — путь на нашем домене; нет, истекла или небезопасна — not_found */
export const resolveShortLink = (code: string): Promise<{ target: string }> => {
  if (isApiMode()) return N.resolveShortLink(code);
  return request(() => {
    const link = isShortCode(code) ? readArea('notify').shortLinks?.[code] : undefined;
    const expired = link?.expiresAt ? link.expiresAt < toISODateTime(new Date()) : false;
    if (!link || expired || !isSafeTarget(link.target)) throw new ApiError('not_found', 'Ссылка не найдена');
    return { target: link.target };
  });
};

/** Ув11: что уйдёт в ближайшую неделю (напоминания, запросы подтверждения, отложенное тихими часами) — раньше первым */
export const listScheduledLog = (businessId: Id) =>
  isApiMode()
    ? N.listScheduledLog(businessId)
    : request(() => {
    const planned = liveEntries(businessId).filter((m) => m.scheduled);
    const mailings = (readArea('notify').mailings[businessId] ?? [])
      .filter((m) => m.status === 'scheduled' && m.scheduledAt && m.scheduledAt > toISODateTime(new Date()))
      .map<LogMessage>((m) => ({
        id: `lg_sched_${m.id}`,
        businessId,
        createdAt: m.scheduledAt!,
        typeLabel: { ru: 'Рассылка', en: 'Mailing', hy: 'Առաքում' },
        channel: m.channel === 'sms' ? 'sms' : 'push',
        status: 'sending',
        contact: String(m.recipientsCount),
        text: { ru: m.text },
        costAmd: m.costAmd ?? 0,
        scheduled: true,
      }));
    return [...planned, ...mailings].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  });

// ─────────────────────────── Центр уведомлений ───────────────────────────

export const listInboxRead = (businessId: Id) => request(() => readArea('notify').inboxRead[businessId] ?? []);

export const markInboxRead = (input: { businessId: Id; ids: Id[] }) => {
  // Возврат каллеру не важен (просто триггерит перечитывание) — но тип должен остаться тем же, что у мока
  // (вся область `notify`), а не Promise<void>, иначе useApiMutation типизируется по-разному в двух режимах.
  if (isApiMode()) return N.markInboxRead(input).then(() => readArea('notify'));
  return request(() =>
    mutateArea('notify', (s) => {
      const current = new Set(s.inboxRead[input.businessId] ?? []);
      input.ids.forEach((id) => current.add(id));
      s.inboxRead[input.businessId] = Array.from(current);
    }),
  );
};

export const listNews = () => {
  if (isApiMode()) return N.listPlatformNews(currentActor().businessId!);
  return request(() => readArea('notify').news);
};

/**
 * Те же события, что рисует `InboxScreen` (колокольчик в шапке кабинета читает их же — F-05-061,
 * qa/requests/notify.md, ответ хранителя дизайна r5).
 *
 * Раньше (core-k2/core-k4, замечание хранителя ядра №1 в обоих) события строились самодельно из
 * `readCore().bookings` — «удалена» узнавалась только по `deletedAt`, поэтому обычная отмена
 * (`status → cancelled_by_client/cancelled_by_master`, запись остаётся в базе) не попадала в центр
 * уведомлений вовсе, а перенос и «мастер опаздывает» не показывались никак. Источник истины для этого —
 * журнал ядра (`readCore().bookingEvents`, тот же `listBookingEvents` из `@/api/core`), своих копий
 * заводить не нужно.
 */
export type InboxEventKind = 'created' | 'onlineCreated' | 'cancelled' | 'moved' | 'deleted' | 'delayed' | 'awaitingReminder' | 'dayClosed';

/** ⭐ «Закрыт день» (01.10.2026): итог кассы дня владельцу — кто закрыл, выручка, наличные, излишек/недостача */
export interface InboxDayClose {
  closedByName: string;
  revenue: number;
  cash: number;
  /** Посчитали − должно быть: плюс — излишек, минус — недостача, 0 — сошлось */
  discrepancy: number;
}

export interface InboxEvent {
  /** id события ядра — читай/отмечай прочитанным по нему, не по id записи */
  id: Id;
  /** Запись, к которой относится событие (у 'dayClosed' — нет: строка ведёт в «Итоги дня») */
  bookingId?: Id;
  createdAt: ISODateTime;
  /** Дата визита (для перехода в журнал на нужный день) — 'YYYY-MM-DD' */
  date: string;
  kind: InboxEventKind;
  /**
   * Ув10: чтобы строка была понятна без перехода — кто, на что и когда. Необязательные: сервер (NEXT_PUBLIC_DATA=api)
   * пока их не отдаёт — строка тогда показывает только событие и время, как раньше.
   */
  clientName?: string;
  service?: LocalizedText;
  /** Начало визита 'YYYY-MM-DDTHH:mm' */
  start?: ISODateTime;
  /** 'awaitingReminder': срок ответа на заявку — «ответьте до HH:MM» */
  deadline?: ISODateTime;
  /** 'dayClosed': итог дня (date — закрытый день) */
  dayClose?: InboxDayClose;
}

const CANCELLED_STATUSES = new Set<BookingStatus>(['cancelled_by_client', 'cancelled_by_master']);

function inboxEvents(businessId: Id): InboxEvent[] {
  // F-05-058: галочки «Уведомления в Web-версии» — «Операции с записями» и ⭐ «Закрытие дня» — гасят свои строки ленты
  const popups = { ...DEFAULT_WEB_POPUP_SETTINGS, ...readArea('notify').webPopups[businessId] };
  const events: InboxEvent[] = [];
  if (popups.dayClose !== false) {
    const viewer = currentActor().staffId;
    for (const n of dayCloseNoticesForSync(businessId, viewer)) {
      events.push({
        id: dayCloseInboxId(n, viewer!),
        createdAt: n.at,
        date: n.date,
        kind: 'dayClosed',
        dayClose: { closedByName: n.closedByName, revenue: n.revenue, cash: n.cash, discrepancy: n.discrepancy },
      });
    }
  }
  if (!popups.bookingOps) return events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
  const bookingsById = new Map(readCore().bookings.filter((b) => b.businessId === businessId).map((b) => [b.id, b]));
  const clientsById = new Map(readCore().clients.filter((c) => c.businessId === businessId).map((c) => [c.id, c]));
  const servicesById = new Map(readCore().services.filter((sv) => sv.businessId === businessId).map((sv) => [sv.id, sv]));
  for (const e of readCore().bookingEvents ?? []) {
    if (e.businessId !== businessId) continue;
    let kind: InboxEventKind | undefined;
    if (e.kind === 'created') {
      const source = bookingsById.get(e.bookingId)?.source;
      kind = source === 'app' || source === 'widget' || source === 'link' ? 'onlineCreated' : 'created';
    } else if (e.kind === 'status' && e.to && CANCELLED_STATUSES.has(e.to)) kind = 'cancelled';
    else if (e.kind === 'moved') kind = 'moved';
    else if (e.kind === 'deleted') kind = 'deleted';
    else if (e.kind === 'delayed') kind = 'delayed';
    if (!kind) continue; // прочие переходы статуса (подтверждена, пришла…) в центр уведомлений не идут
    // Поле start появилось у события в k4 — у событий, записанных раньше (уже лежащих в localStorage), его нет,
    // тогда берём время визита из самой записи, а нет и её (запись потом стёрли) — день события как есть.
    const booking = bookingsById.get(e.bookingId);
    const visitStart = e.start ?? booking?.start ?? e.at;
    const client = booking?.clientId ? clientsById.get(booking.clientId) : undefined;
    const firstServiceId = booking?.services[0]?.serviceId;
    events.push({
      id: e.id,
      bookingId: e.bookingId,
      createdAt: e.at,
      date: visitStart.slice(0, 10),
      kind,
      clientName: booking?.visitorName || client?.name || undefined,
      service: firstServiceId ? servicesById.get(firstServiceId)?.name : undefined,
      start: e.start ?? booking?.start,
    });
  }
  // ⭐ 29.09.2026: повторные напоминания о заявке без ответа (api/journal-offers → remindPendingRequests) — пока заявка
  // ждёт; ответили — напоминание из ленты уходит (и из счётчика непрочитанных)
  for (const r of readArea('journal').requestReminders ?? []) {
    const booking = r.businessId === businessId ? bookingsById.get(r.bookingId) : undefined;
    if (!booking || booking.status !== 'awaiting_confirmation' || booking.deletedAt) continue;
    const client = booking.clientId ? clientsById.get(booking.clientId) : undefined;
    const firstServiceId = booking.services[0]?.serviceId;
    events.push({
      id: r.id,
      bookingId: r.bookingId,
      createdAt: r.at,
      date: booking.start.slice(0, 10),
      kind: 'awaitingReminder',
      clientName: booking.visitorName || client?.name || undefined,
      service: firstServiceId ? servicesById.get(firstServiceId)?.name : undefined,
      start: booking.start,
      // Срок ответа уже прошёл к моменту напоминания — без «до HH:MM» (иначе «ответьте до 12:04» в 15:51)
      deadline: r.deadline > r.at ? r.deadline : undefined,
    });
  }
  return events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
}

export const countUnreadInbox = (businessId: Id) => {
  if (isApiMode()) return N.countUnreadInbox(businessId);
  return request(() => {
    const readSet = new Set(readArea('notify').inboxRead[businessId] ?? []);
    return inboxEvents(businessId).filter((e) => !readSet.has(e.id)).length;
  });
};

export interface InboxPreviewItem extends InboxEvent {
  unread: boolean;
}

export const listInboxPreview = (businessId: Id, limit = 5) => {
  if (isApiMode()) return N.listInboxPreview(businessId, limit);
  return request<InboxPreviewItem[]>(() => {
    const readSet = new Set(readArea('notify').inboxRead[businessId] ?? []);
    return inboxEvents(businessId)
      .slice(0, limit)
      .map((e) => ({ ...e, unread: !readSet.has(e.id) }));
  });
};

/** Полная вкладка «Записи» центра уведомлений (F-05-061/062) — та же лента, что и превью колокольчика */
export const listInboxEvents = (businessId: Id) => {
  if (isApiMode()) return N.listInboxEvents(businessId);
  return request<InboxPreviewItem[]>(() => {
    const readSet = new Set(readArea('notify').inboxRead[businessId] ?? []);
    return inboxEvents(businessId).map((e) => ({ ...e, unread: !readSet.has(e.id) }));
  });
};

// ─────────────────────────── Настройки уведомлений клиента (F-05-090/091) ───────────────────────────

/** Фасад несёт только clientId (сигнатуру менять нельзя) — businessId берём из текущего кабинета, как requireBusinessId() в integrations.ts */
function currentBusinessIdForNotify(): Id {
  const { businessId } = currentActor();
  if (!businessId) throw new ApiError('not_found');
  return businessId;
}

export const getClientNotifyPrefs = (clientId: Id) => {
  if (isApiMode()) return N.getClientNotifyPrefs(currentBusinessIdForNotify(), clientId);
  return request(() => clientPrefs(clientId));
};

export const updateClientNotifyPrefs = (input: { clientId: Id; prefs: ClientNotifyPrefs }) => {
  if (isApiMode()) return N.updateClientNotifyPrefs(currentBusinessIdForNotify(), input.clientId, input.prefs);
  return request(() => {
    mutateArea('notify', (s) => {
      s.clientPrefs[input.clientId] = input.prefs;
    });
    return input.prefs;
  });
};

// ─────────────────────────── Разовое сообщение (F-05-084, F-05-109) ───────────────────────────

export interface SendOneOffInput {
  businessId: Id;
  clientId: Id;
  text: string;
  channels: NotifyChannel[];
  source: OneOffSource;
}

/** Служебный тип 15 «сообщение из карточки клиента» / «из окна записи» (F-05-004, F-05-084) — без своей страницы */
export const ONE_OFF_TYPE_CODE = 15;

export const sendOneOffMessage = (input: SendOneOffInput) =>
  isApiMode()
    ? N.sendOneOffMessage(input)
    : request(() => {
    const client = readCore().clients.find((c) => c.id === input.clientId);
    if (!client) throw new Error('client not found');
    const prefs = clientPrefs(input.clientId);
    // F-05-084 п.1: уходит только по каналам, разрешённым клиенту в его карточке (F-05-090).
    const allowed = input.channels.filter((ch) => {
      if (ch === 'push' || ch === 'brandedApp') return prefs.channels.push;
      if (ch === 'sms') return prefs.channels.sms;
      if (ch === 'email') return prefs.channels.email;
      return true;
    });
    if (allowed.length === 0) throw new Error('no allowed channel');
    const now = toISODateTime(new Date());
    mutateArea('notify', (s) => {
      const log = s.log[input.businessId] ?? [];
      allowed.forEach((channel) => {
        log.unshift({
          id: newId('lg'),
          businessId: input.businessId,
          createdAt: now,
          typeCode: ONE_OFF_TYPE_CODE,
          typeLabel:
            input.source === 'bookingWindow'
              ? { ru: 'Сообщение из окна записи', en: 'Message from the booking window' }
              : { ru: 'Сообщение из карточки клиента', en: 'Message from the client card' },
          channel,
          status: 'sent',
          contact: channel === 'email' ? client.email || client.phone : client.phone,
          text: { ru: input.text },
          clientId: input.clientId,
        });
      });
      s.log[input.businessId] = capLog(log);
    });
    return { sentChannels: allowed };
  });

// ─────────────────────────── Уведомления в Web-версии (F-05-058) ───────────────────────────

export const getWebPopupSettings = (businessId: Id) => {
  if (isApiMode()) return N.getWebPopupSettings(businessId);
  return request<WebPopupSettings>(() => ({ ...DEFAULT_WEB_POPUP_SETTINGS, ...readArea('notify').webPopups[businessId] }));
};

export const updateWebPopupSettings = (input: { businessId: Id; settings: WebPopupSettings }) => {
  if (isApiMode()) return N.updateWebPopupSettings(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.webPopups[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

// ─────────────────────────── Служебные баннеры (F-05-135) ───────────────────────────

/**
 * Живой список: идут мимо «Типов уведомлений», условие показа считается на лету (не хранится статично),
 * закрытые крестиком не возвращаются после перезагрузки (F-05-135 «Логика» — своё решение вместо ❓ из ТЗ).
 */
function computeServiceBanners(businessId: Id): ServiceBannerDef[] {
  const business = readCore().businesses.find((b) => b.id === businessId);
  const out: ServiceBannerDef[] = [];
  if (business) {
    const deadline = toISODateTime(dayjs(business.createdAt).add(7, 'day'));
    if (dayjs().isBefore(deadline)) {
      out.push({
        id: 'promo_hello30',
        tone: 'promo',
        title: { ru: 'Скидка 30% для новых клиентов', en: '30% off for new businesses' },
        text: { ru: 'Промокод HELLO30 — оплатите подписку в течение 7 дней с регистрации.', en: 'Promo code HELLO30 — pay for your subscription within 7 days of signing up.' },
        actionLabel: { ru: 'Оплатить сейчас', en: 'Pay now' },
        actionHref: '/biz/billing',
        dismissible: true,
        deadline,
      });
    }
  }
  const dismissed = new Set(readArea('notify').serviceBannerDismissed[businessId] ?? []);
  return out.filter((b) => !b.dismissible || !dismissed.has(b.id));
}

export const listServiceBanners = (businessId: Id) => {
  if (isApiMode()) return N.listServiceBanners(businessId);
  return request(() => computeServiceBanners(businessId));
};

export const dismissServiceBanner = (input: { businessId: Id; bannerId: string }) => {
  if (isApiMode()) return N.dismissServiceBanner(input);
  return request(() => {
    mutateArea('notify', (s) => {
      const current = new Set(s.serviceBannerDismissed[input.businessId] ?? []);
      current.add(input.bannerId);
      s.serviceBannerDismissed[input.businessId] = Array.from(current);
    });
  });
};

// ─────────────── Каталог каналов и партнёрских приложений (F-05-069/070/075/117/119/122/123) ───────────────

export const listPartnerApps = () => request(() => PARTNER_APPS);

export const listPartnerConnections = (businessId: Id) => {
  if (isApiMode()) return N.listPartnerConnections(businessId);
  return request(() => readArea('notify').partnerConnections[businessId] ?? []);
};

/** F-05-122: подключение сразу к нескольким локациям одним действием */
export interface ConnectPartnerAppInput {
  appId: Id;
  businessIds: Id[];
}

function newPartnerConnection(input: ConnectPartnerAppInput): PartnerConnection {
  const app = PARTNER_APPS.find((a) => a.id === input.appId);
  if (!app) throw new Error('notify/partner-app-not-found');
  if (input.businessIds.length === 0) throw new Error('notify/partner-app-no-locations');
  const now = toISODateTime(new Date());
  // F-05-117/F-05-122: служебный пользователь приложения — свой на каждую локацию, не занимает лицензию.
  return {
    appId: input.appId,
    businessIds: input.businessIds,
    status: 'trial',
    connectedAt: now,
    trialEndsAt: toISODateTime(dayjs(now).add(app.freeTrialDays ?? 14, 'day')),
    systemUserLabel: `${app.name} — service user`,
  };
}

export const connectPartnerApp = (input: ConnectPartnerAppInput) => {
  if (isApiMode()) return Promise.resolve().then(() => N.connectPartnerApp(newPartnerConnection(input)));
  return request(() => {
    const connection = newPartnerConnection(input);
    mutateArea('notify', (s) => {
      input.businessIds.forEach((bId) => {
        const list = (s.partnerConnections[bId] ?? []).filter((c) => c.appId !== input.appId);
        list.push(connection);
        s.partnerConnections[bId] = list;
      });
    });
    return connection;
  });
};

/** F-05-123: отключение вручную — стирает настройки приложения в филиале, партнёру «уходит» вебхук отключения */
export const disconnectPartnerApp = (input: { businessId: Id; appId: Id }) => {
  if (isApiMode()) return N.disconnectPartnerApp(input.businessId, input.appId);
  return request(() =>
    mutateArea('notify', (s) => {
      s.partnerConnections[input.businessId] = (s.partnerConnections[input.businessId] ?? []).filter((c) => c.appId !== input.appId);
    }),
  ).then(() => undefined);
};

/** F-05-123 демо: «оплата пришла после автоотключения» — канал включается обратно */
export const reactivatePartnerApp = (input: { businessId: Id; appId: Id }) => {
  if (isApiMode()) return N.setPartnerAppStatus(input.businessId, input.appId, 'active');
  return request(() =>
    mutateArea('notify', (s) => {
      const row = (s.partnerConnections[input.businessId] ?? []).find((c) => c.appId === input.appId);
      if (row) row.status = 'active';
    }),
  ).then(() => undefined);
};

/** F-05-123 демо: «нет данных об оплате к концу периода» — канал отключается сам (в реальности — в течение суток) */
export const expirePartnerApp = (input: { businessId: Id; appId: Id }) => {
  if (isApiMode()) return N.setPartnerAppStatus(input.businessId, input.appId, 'autoDisconnected');
  return request(() =>
    mutateArea('notify', (s) => {
      const row = (s.partnerConnections[input.businessId] ?? []).find((c) => c.appId === input.appId);
      if (row) row.status = 'autoDisconnected';
    }),
  ).then(() => undefined);
};

// ─────────────────────────── Ссылка на оплату визита (F-05-089) ───────────────────────────

/**
 * ⭐ по нашему решению (F-05-089): онлайн-оплаты нет — ручная предоплата по реквизитам (F-00-097).
 * Ссылка — демо-заглушка (детерминирована от bookingId, чтобы не менялась между открытиями), заводим
 * её один раз в mock/db, чтобы «открыл → визит заблокирован на 15 минут» было видно как отметка времени.
 */
export const getPaymentLink = (bookingId: Id) =>
  isApiMode()
    ? N.getPaymentLink(currentBusinessIdForNotify(), bookingId)
    : request(() => {
    const state = readArea('notify');
    const existing = state.paymentLinks?.[bookingId];
    if (existing) return existing;
    const link = { bookingId, url: `pay.demo/${bookingId}`, createdAt: toISODateTime(new Date()) };
    mutateArea('notify', (s) => {
      s.paymentLinks = s.paymentLinks ?? {};
      s.paymentLinks[bookingId] = link;
    });
    return link;
  });

export interface SendPaymentLinkInput {
  businessId: Id;
  bookingId: Id;
  clientId: Id;
  channels: NotifyChannel[];
}

/** F-05-089: «Отправить ссылку» — тип 85, шаблон с {paymentLink}, канал WhatsApp — только если подключён. */
export const sendPaymentLink = (input: SendPaymentLinkInput) =>
  isApiMode()
    ? N.sendPaymentLink(input)
    : request(async () => {
    const link = await getPaymentLink(input.bookingId);
    const wa = readArea('notify').altegioWhatsApp[input.businessId];
    const channels = input.channels.filter((ch) => ch !== 'whatsapp' || (wa && wa.mode !== 'none'));
    if (channels.length === 0) throw new Error('no allowed channel');
    return sendOneOffMessage({
      businessId: input.businessId,
      clientId: input.clientId,
      text: `Оплатите визит по ссылке: ${link.url}`,
      channels,
      source: 'bookingWindow',
    });
  });

// ─────────────────────────── Чат с клиентом через партнёра (F-05-087) ───────────────────────────

/** Подключён ли рабочий (status='active'|'trial') чат-бот — иначе окну визита показывать нечего (промо) */
export function hasActiveChatPartner(businessId: Id): boolean {
  const connections = readArea('notify').partnerConnections[businessId] ?? [];
  return connections.some((c) => {
    const app = PARTNER_APPS.find((a) => a.id === c.appId);
    return app?.type === 'chatBot' && (c.status === 'active' || c.status === 'trial');
  });
}

export const getChatPartnerStatus = (businessId: Id) => request(() => hasActiveChatPartner(businessId));

/** F-05-088: счётчик непрочитанных — красная точка на вкладке «Чат» / кнопке доп. опций, даже если всплывашки выключены */
export const getChatUnread = (businessId: Id) =>
  isApiMode() ? N.getChatUnread(businessId) : request(() => readArea('notify').chatUnread[businessId] ?? 0);

export const clearChatUnread = (businessId: Id) =>
  isApiMode()
    ? N.clearChatUnread(businessId)
    : request(() =>
    mutateArea('notify', (s) => {
      s.chatUnread = s.chatUnread ?? {};
      s.chatUnread[businessId] = 0;
    }),
  );

export const listChatMessages = (businessId: Id, phone: string) =>
  isApiMode()
    ? N.listChatMessages(businessId, phone)
    : request(() =>
    (readArea('notify').chatMessages[businessId] ?? [])
      .filter((m) => m.phone === phone)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
  );

export interface SendChatMessageInput {
  businessId: Id;
  phone: string;
  clientId?: Id;
  text: string;
  attachmentName?: string;
}

/** Администратор отвечает в чате из окна визита (F-05-087) — сообщение уходящее (direction='out') */
export const sendChatMessage = (input: SendChatMessageInput) =>
  isApiMode()
    ? N.sendChatMessage(input)
    : request(() => {
    if (!input.text.trim() && !input.attachmentName) throw new Error('notify/chat-message-empty');
    const message: ChatMessage = {
      id: newId('chat'),
      businessId: input.businessId,
      phone: input.phone,
      clientId: input.clientId,
      direction: 'out',
      text: input.text.trim(),
      attachmentName: input.attachmentName,
      createdAt: toISODateTime(new Date()),
    };
    mutateArea('notify', (s) => {
      const list = s.chatMessages[input.businessId] ?? [];
      list.push(message);
      s.chatMessages[input.businessId] = capChat(list);
    });
    return message;
  });

/**
 * F-05-088 «Готово, когда» п.2: собеседник без визитов, впервые написавший в чат, сам попадает в базу
 * с тегом «Лид из чата» — нет своего поля «категория» в ядре (Client.tags общий), тег — ближайший 1:1
 * аналог без правки core.ts. Уже известный по телефону клиент — не трогаем.
 */
async function autoSaveChatLead(businessId: Id, phone: string): Promise<Id | undefined> {
  const existing = readCore().clients.find((c) => c.businessId === businessId && c.phone === phone && !c.deletedAt);
  if (existing) return existing.id;
  const created = await coreCreate('clients', {
    businessId,
    phone,
    name: 'Без имени',
    gender: 'unknown',
    tags: ['Лид из чата'],
    noShowCount: 0,
    createdAt: toISODateTime(new Date()),
  });
  return created.id;
}

/**
 * Демо: «клиент написал» — для проверки, что переписка появляется и без ответа с нашей стороны, и что
 * новый собеседник сам попадает в базу как «Лид из чата» (F-05-088). В реальном боте это был бы вебхук
 * партнёра — здесь единственная точка входа входящих сообщений, поэтому автосохранение и лента новых
 * сообщений подключены прямо здесь.
 */
export const simulateIncomingChatMessage = (input: { businessId: Id; phone: string; clientId?: Id; text: string }) =>
  isApiMode()
    ? N.simulateIncomingChatMessage(input)
    : request(async () => {
    const clientId = input.clientId ?? (await autoSaveChatLead(input.businessId, input.phone));
    const message: ChatMessage = {
      id: newId('chat'),
      businessId: input.businessId,
      phone: input.phone,
      clientId,
      direction: 'in',
      text: input.text.trim() || 'Здравствуйте!',
      createdAt: toISODateTime(new Date()),
    };
    mutateArea('notify', (s) => {
      const list = s.chatMessages[input.businessId] ?? [];
      list.push(message);
      s.chatMessages[input.businessId] = capChat(list);
      s.chatUnread = s.chatUnread ?? {};
      s.chatUnread[input.businessId] = (s.chatUnread[input.businessId] ?? 0) + 1;
    });
    return message;
  });

/**
 * F-05-076 «Готово, когда»: внешний бот-партнёр меняет статус записи через API — сам Altegio такой логики
 * не имеет (кроме типа 73), это делает партнёр. Демо: подтверждает ближайшую запись в статусе «ожидает
 * подтверждения» тем же путём (changeBookingStatus), которым воспользовался бы партнёр.
 *
 * Actor — 'business', а не 'system': партнёрское приложение работает через API Altegio с теми же правами,
 * что сотрудник в кабинете (любой статус в любой, кроме «ждёт предоплату», см. canTransition()); 'system' —
 * это только автоматика самого Altegio (истёк срок предоплаты) и не разрешает переход
 * awaiting_confirmation → client_confirmed вовсе, поэтому демо гарантированно падало.
 */
export const simulatePartnerConfirmBooking = (businessId: Id) =>
  isApiMode()
    ? N.simulatePartnerConfirmBooking(businessId)
    : request(async () => {
    const target = readCore().bookings.find((b) => b.businessId === businessId && !b.deletedAt && b.status === 'awaiting_confirmation');
    if (!target) return { confirmed: false as const };
    await changeBookingStatus(target.id, 'client_confirmed', 'business');
    mutateArea('notify', (s) => {
      const log = s.log[businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId,
        createdAt: toISODateTime(new Date()),
        typeCode: 73,
        typeLabel: { ru: 'Подтверждение через бота-партнёра', en: 'Confirmed via a partner bot' },
        channel: 'whatsapp',
        status: 'sent',
        contact: '—',
        text: { ru: 'Запись подтверждена ботом-партнёром через API.', en: 'The booking was confirmed by a partner bot via the API.' },
      });
      s.log[businessId] = capLog(log);
    });
    return { confirmed: true as const };
  });

// ─────────────────────── WhatsApp через Altegio (F-05-071, F-05-072, F-05-073) ───────────────────────

export const getAltegioWhatsApp = (businessId: Id) => {
  if (isApiMode()) return N.getAltegioWhatsApp(businessId);
  return request(() => readArea('notify').altegioWhatsApp[businessId] ?? DEFAULT_ALTEGIO_WHATSAPP);
};

export const updateAltegioWhatsApp = (input: { businessId: Id; settings: AltegioWhatsAppSettings }) => {
  if (isApiMode()) return N.updateAltegioWhatsApp(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.altegioWhatsApp[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

export const setAltegioWhatsAppMode = (input: { businessId: Id; mode: AltegioWhatsAppMode }) => {
  if (isApiMode()) return N.setAltegioWhatsAppMode(input);
  return request(() => {
    let next: AltegioWhatsAppSettings = DEFAULT_ALTEGIO_WHATSAPP;
    mutateArea('notify', (s) => {
      const cur = s.altegioWhatsApp[input.businessId] ?? { ...DEFAULT_ALTEGIO_WHATSAPP };
      next = { ...cur, mode: input.mode };
      s.altegioWhatsApp[input.businessId] = next;
    });
    return next;
  });
};

export const approveWhatsAppTemplates = (businessId: Id) => {
  if (isApiMode()) return N.approveWhatsAppTemplates(businessId);
  return request(() => {
    let next: AltegioWhatsAppSettings = DEFAULT_ALTEGIO_WHATSAPP;
    mutateArea('notify', (s) => {
      const cur = s.altegioWhatsApp[businessId] ?? { ...DEFAULT_ALTEGIO_WHATSAPP };
      next = { ...cur, templatesApproved: true };
      s.altegioWhatsApp[businessId] = next;
    });
    return next;
  });
};

// ─────────────────────────── WhatsApp-сообщения клиентам — бесплатно ───────────────────────────
// Снято №11 / В-08 б: мы НЕ продаём WhatsApp-сообщения клиентам со своего баланса — клиент получает
// бесплатный пуш в приложение, WhatsApp здесь только канал-механизм (подключение номера, шаблоны).
// Раньше это списывало `notifyBalanceAmd` и требовало платного пополнения (F-05-115) — оба убраны.

/** F-05-071 «Готово, когда»: демо-кнопка — уходит, если канал подключён и шаблоны одобрены */
export const sendTestWhatsAppMessage = (businessId: Id) =>
  isApiMode()
    ? N.sendTestWhatsAppMessage(businessId)
    : request(() => {
    const wa = readArea('notify').altegioWhatsApp[businessId];
    const sent = Boolean(wa && wa.mode !== 'none' && wa.templatesApproved);
    mutateArea('notify', (s) => {
      const log = s.log[businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId,
        createdAt: toISODateTime(new Date()),
        typeLabel: { ru: 'Тест WhatsApp', en: 'WhatsApp test' },
        channel: 'whatsapp',
        status: sent ? 'sent' : 'rejected',
        contact: '+374 00 100 000',
        text: {
          ru: 'Тестовое сообщение WhatsApp.',
          en: 'WhatsApp test message.',
        },
      });
      s.log[businessId] = capLog(log);
    });
    return { sent };
  });

// ─────────────────────── Вебхуки и флаги внешнего агента (F-05-120, F-05-121) ───────────────────────

export const listWebhooks = (businessId: Id) => {
  if (isApiMode()) return N.listWebhooks(businessId);
  return request(() => readArea('notify').webhooks[businessId] ?? []);
};

export const createWebhook = (input: { businessId: Id; url: string; entities: WebhookEntity[] }) => {
  if (isApiMode()) return N.createWebhook(input);
  return request(() => {
    if (!/^https?:\/\/.+/i.test(input.url.trim())) throw new Error('notify/webhook-invalid-url');
    if (input.entities.length === 0) throw new Error('notify/webhook-no-entities');
    const webhook: Webhook = {
      id: newId('wh'),
      url: input.url.trim(),
      entities: input.entities,
      active: true,
      createdAt: toISODateTime(new Date()),
    };
    mutateArea('notify', (s) => {
      s.webhooks[input.businessId] = [...(s.webhooks[input.businessId] ?? []), webhook];
    });
    return webhook;
  });
};

export const setWebhookActive = (input: { businessId: Id; webhookId: Id; active: boolean }) => {
  if (isApiMode()) return N.setWebhookActive(input);
  return request(() => {
    mutateArea('notify', (s) => {
      const row = (s.webhooks[input.businessId] ?? []).find((w) => w.id === input.webhookId);
      if (row) row.active = input.active;
    });
  });
};

export const deleteWebhook = (input: { businessId: Id; webhookId: Id }) => {
  if (isApiMode()) return N.deleteWebhook(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.webhooks[input.businessId] = (s.webhooks[input.businessId] ?? []).filter((w) => w.id !== input.webhookId);
    });
  });
};

export const getAgentNotifyFlags = (businessId: Id) => {
  if (isApiMode()) return N.getAgentNotifyFlags(businessId);
  return request(() => readArea('notify').agentFlags[businessId] ?? DEFAULT_AGENT_NOTIFY_FLAGS);
};

export const updateAgentNotifyFlags = (input: { businessId: Id; flags: AgentNotifyFlags }) => {
  if (isApiMode()) return N.updateAgentNotifyFlags(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.agentFlags[input.businessId] = input.flags;
    });
    return input.flags;
  });
};

/** F-05-121 «Готово, когда»: демо — внешний агент создаёт запись с флагом → обычное уведомление типа 2 в журнал */
export const simulateAgentBooking = (input: { businessId: Id; clientPhone: string; sendToClient: boolean }) =>
  isApiMode()
    ? N.simulateAgentBooking(input)
    : request(() => {
    const flags = readArea('notify').agentFlags[input.businessId] ?? DEFAULT_AGENT_NOTIFY_FLAGS;
    const willSend = input.sendToClient && flags.sendToClient;
    mutateArea('notify', (s) => {
      const log = s.log[input.businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId: input.businessId,
        createdAt: toISODateTime(new Date()),
        typeCode: 2,
        typeLabel: { ru: 'Запись через внешнего агента', en: 'Booking created by an external agent' },
        channel: 'push',
        status: willSend ? 'sent' : 'rejected',
        contact: input.clientPhone,
        text: {
          ru: willSend ? 'Вы записаны через внешнего помощника.' : 'Не отправлено: флаг уведомления не передан агентом.',
          en: willSend ? 'You are booked via an external assistant.' : 'Not sent: the agent did not pass the notify flag.',
        },
      });
      s.log[input.businessId] = capLog(log);
    });
    return { sent: willSend };
  });

// ─────────────────────── Сводки и оповещения от партнёров (F-05-126) ───────────────────────

export const getPartnerSummarySettings = (businessId: Id) => {
  if (isApiMode()) return N.getPartnerSummarySettings(businessId);
  return request(() => readArea('notify').partnerSummary[businessId] ?? DEFAULT_PARTNER_SUMMARY);
};

export const updatePartnerSummarySettings = (input: { businessId: Id; settings: PartnerSummarySettings }) => {
  if (isApiMode()) return N.updatePartnerSummarySettings(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.partnerSummary[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

// ─────────────────────── Open Slots и «Кого позвать» (F-05-124, F-05-125) ───────────────────────
// Расписание — своя настройка бизнеса (закрыто, этап 21 попытка 3); listOpenSlots/listWhoToInvite
// (вычисление окон и подбор клиентов) остаются на моке — нужна отдельная довязка к AvailabilityService.

export const getOpenSlotsSchedule = (businessId: Id) => {
  if (isApiMode()) return N.getOpenSlotsSchedule(businessId);
  return request(() => readArea('notify').openSlotsSchedule[businessId] ?? DEFAULT_OPEN_SLOTS_SCHEDULE);
};

export const updateOpenSlotsSchedule = (input: { businessId: Id; settings: OpenSlotsScheduleSettings }) => {
  if (isApiMode()) return N.updateOpenSlotsSchedule(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.openSlotsSchedule[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

const WEEKDAY_MON0 = (d: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 => (((d.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6);

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Часы работы мастера в дату: сначала override, иначе шаблон недели (F-02: расписание — чужой раздел, читаем только) */
function staffRangesOn(staffId: Id, dateISO: string): { from: string; to: string }[] {
  const schedule = readCore().schedules.find((s) => s.staffId === staffId);
  if (!schedule) return [];
  if (schedule.overrides[dateISO]) return schedule.overrides[dateISO];
  return schedule.week[WEEKDAY_MON0(new Date(`${dateISO}T00:00:00`))] ?? [];
}

/** F-05-124: свободные получасовые окна мастера в дату, за пределами уже занятых записей */
function freeSlotsForStaffOnDate(businessId: Id, staffId: Id, dateISO: string): string[] {
  const ranges = staffRangesOn(staffId, dateISO);
  if (ranges.length === 0) return [];
  const busy = readCore()
    .bookings.filter(
      (b) =>
        b.businessId === businessId &&
        b.staffId === staffId &&
        !b.deletedAt &&
        b.status !== 'cancelled_by_client' &&
        b.status !== 'cancelled_by_master' &&
        dayjs(b.start).format('YYYY-MM-DD') === dateISO,
    )
    .map((b) => ({ from: hhmmToMin(dayjs(b.start).format('HH:mm')), to: hhmmToMin(dayjs(b.start).format('HH:mm')) + b.durationMin }));
  const slots: string[] = [];
  ranges.forEach((range) => {
    for (let t = hhmmToMin(range.from); t + 30 <= hhmmToMin(range.to); t += 30) {
      const overlaps = busy.some((b) => t < b.to && t + 30 > b.from);
      if (!overlaps) slots.push(minToHHMM(t));
    }
  });
  return slots;
}

/** F-05-124 «Готово, когда»: свободные окна на сегодня и/или на завтра — для картинки и для скачивания вручную */
export const listOpenSlots = (input: { businessId: Id; day: 'today' | 'tomorrow' }) => {
  if (isApiMode()) return N.listOpenSlots(input);
  return request<SuggestedOpenSlot[]>(() => {
    const dateISO = dayjs()
      .add(input.day === 'tomorrow' ? 1 : 0, 'day')
      .format('YYYY-MM-DD');
    const staff = readCore().staff.filter((s) => s.businessId === input.businessId && s.status === 'active');
    const out: SuggestedOpenSlot[] = [];
    staff.forEach((st) => {
      freeSlotsForStaffOnDate(input.businessId, st.id, dateISO).forEach((time) => {
        out.push({ staffId: st.id, staffName: st.name, date: dateISO, time });
      });
    });
    return out.sort((a, b) => (a.time < b.time ? -1 : 1));
  });
};

/** F-05-125 «Готово, когда»: до 10 клиентов на каждое из свободных окон ближайших 7 дней + готовый текст */
export const listWhoToInvite = (businessId: Id) => {
  if (isApiMode()) return N.listWhoToInvite(businessId);
  return request<WhoToInviteSuggestion[]>(() => {
    const core = readCore();
    const staff = core.staff.filter((s) => s.businessId === businessId && s.status === 'active');
    const clients = core.clients.filter((c) => c.businessId === businessId && !c.deletedAt && !c.blocked);
    const out: WhoToInviteSuggestion[] = [];
    for (let dayOffset = 0; dayOffset < 7 && out.length < 30; dayOffset += 1) {
      const dateISO = dayjs().add(dayOffset, 'day').format('YYYY-MM-DD');
      for (const st of staff) {
        const free = freeSlotsForStaffOnDate(businessId, st.id, dateISO);
        if (free.length === 0) continue;
        const time = free[0];
        // Клиенты, обычно ходившие к этому мастеру (по прошлым записям) — до 10 «тёплых» контактов на окно.
        const pastClientIds = new Set(
          core.bookings.filter((b) => b.businessId === businessId && b.staffId === st.id && !b.deletedAt && b.clientId).map((b) => b.clientId as Id),
        );
        const candidates = clients.filter((c) => pastClientIds.has(c.id)).slice(0, 10);
        candidates.forEach((c) => {
          out.push({
            clientId: c.id,
            clientName: c.name,
            clientPhone: c.phone,
            slot: { staffId: st.id, staffName: st.name, date: dateISO, time },
            messageText: `${c.name}, у ${st.name} освободилось окно ${dayjs(dateISO).format('DD.MM')} в ${time} — записать вас?`,
          });
        });
      }
    }
    return out.slice(0, 30);
  });
};

// ─────────────────────── Витрина подарков партнёра (F-05-127) ───────────────────────

export const getGiftShowcase = (businessId: Id) => {
  if (isApiMode()) return N.getGiftShowcase(businessId);
  return request(() => readArea('notify').giftShowcase[businessId] ?? DEFAULT_GIFT_SHOWCASE);
};

export const updateGiftShowcase = (input: { businessId: Id; settings: GiftShowcaseSettings }) => {
  if (isApiMode()) return N.updateGiftShowcase(input);
  return request(() => {
    mutateArea('notify', (s) => {
      s.giftShowcase[input.businessId] = input.settings;
    });
    return input.settings;
  });
};

// ─────────── Лояльность, абонементы, письма (F-05-081, F-05-100…106, F-05-127, F-05-128, F-05-136) ───────────

/** Режим api (этап 21 «Сдача»): каталог событий — LOYALTY_NOTIFY_DEFS фронта, правки владельца — с сервера */
async function apiLoyaltyNotifyRules(businessId: Id) {
  const patches = await N.getLoyaltyNotifyPatches(businessId);
  return LOYALTY_NOTIFY_DEFS.map((def) => ({
    code: def.code,
    enabled: def.enabledDefault,
    channel: def.channel,
    presets: def.presets,
    selectedPresetId: def.presets[0]?.id ?? 'custom',
    customText: '',
    daysBefore: def.daysBeforeDefault,
    visitsLeftTrigger: def.visitsLeftDefault,
    regionOnly: def.regionOnly,
    ...(patches[def.code] ?? {}),
  }));
}

export const listLoyaltyNotifyRules = (businessId: Id) => {
  if (isApiMode()) return apiLoyaltyNotifyRules(businessId);
  return request(() => {
    const stored = readArea('notify').loyaltyNotify[businessId];
    if (stored && stored.length === LOYALTY_NOTIFY_DEFS.length) return stored;
    // Бизнес создан до появления этого блока (версия среза без него) — досеиваем на лету.
    return LOYALTY_NOTIFY_DEFS.map((def) => ({
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
  });
};

export interface LoyaltyNotifyRulePatch {
  enabled?: boolean;
  selectedPresetId?: string;
  customText?: string;
  daysBefore?: number;
  visitsLeftTrigger?: number;
}

export const updateLoyaltyNotifyRule = (input: { businessId: Id; code: LoyaltyNotifyEventCode; patch: LoyaltyNotifyRulePatch }) => {
  if (isApiMode()) return N.patchLoyaltyNotifyRule(input.businessId, input.code, input.patch).then(() => undefined);
  return request(() =>
    mutateArea('notify', (s) => {
      let list = s.loyaltyNotify[input.businessId];
      if (!list || list.length !== LOYALTY_NOTIFY_DEFS.length) {
        list = LOYALTY_NOTIFY_DEFS.map((def) => ({
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
      }
      const row = list.find((r) => r.code === input.code);
      if (row) Object.assign(row, input.patch);
      s.loyaltyNotify[input.businessId] = list;
    }),
  );
};

// ─────────────────────── Уведомления сотрудника (F-05-055…057, F-05-060) ───────────────────────

/** F-05-055: «на основе прав» — root-доступ к чужим записям делает вид «администратор», иначе «сотрудник» */
export function effectiveStaffNotifyView(prefs: StaffNotifyPrefs, staffRole: string): Exclude<StaffNotifyView, 'byAccess'> {
  if (prefs.view !== 'byAccess') return prefs.view;
  return staffRole === 'master' ? 'staff' : 'admin';
}

export const getStaffNotifyPrefs = (staffId: Id) => {
  if (isApiMode()) return N.getStaffNotifyPrefs(currentActor().businessId!, staffId);
  return request(() => readArea('notify').staffNotifyPrefs[staffId] ?? defaultStaffNotifyPrefs(staffId));
};

/** F-05-059, шаг 4: хотя бы один сотрудник реально настроен во вкладке «Уведомления» карточки */
export const anyStaffNotifyConfigured = (staffIds: Id[]) => {
  if (isApiMode()) return N.anyStaffNotifyConfigured(currentActor().businessId!, staffIds);
  return request(() => {
    const stored = readArea('notify').staffNotifyPrefs;
    return staffIds.some((id) => {
      const p = stored[id];
      if (!p) return false;
      if (p.view !== 'byAccess') return true;
      return Object.values(p.matrix).some((row) => Object.values(row).some(Boolean));
    });
  });
};

export const updateStaffNotifyPrefs = (input: { staffId: Id; patch: Partial<StaffNotifyPrefs> }): Promise<StaffNotifyPrefs> => {
  if (isApiMode()) return N.updateStaffNotifyPrefs(currentActor().businessId!, input.staffId, input.patch);
  // Возврат — сами обновлённые настройки этого сотрудника, не весь `NotifyState` (та же ловушка, что чинили
  // попыткой 2 у других функций этого файла — tsc не видел несовпадение, пока рядом не появилась api-ветка).
  return request<StaffNotifyPrefs>(() => {
    mutateArea('notify', (s) => {
      const current = s.staffNotifyPrefs[input.staffId] ?? defaultStaffNotifyPrefs(input.staffId);
      s.staffNotifyPrefs[input.staffId] = { ...current, ...input.patch };
    });
    return readArea('notify').staffNotifyPrefs[input.staffId] ?? defaultStaffNotifyPrefs(input.staffId);
  });
};

export const setStaffNotifyMatrixCell = (input: {
  staffId: Id;
  event: StaffNotifyEvent;
  channel: StaffNotifyChannel;
  value: boolean;
}): Promise<StaffNotifyPrefs> => {
  if (isApiMode()) return N.setStaffNotifyMatrixCell(currentActor().businessId!, input.staffId, input.event, input.channel, input.value);
  return request<StaffNotifyPrefs>(() => {
    mutateArea('notify', (s) => {
      const current = s.staffNotifyPrefs[input.staffId] ?? defaultStaffNotifyPrefs(input.staffId);
      current.matrix[input.event][input.channel] = input.value;
      s.staffNotifyPrefs[input.staffId] = { ...current };
    });
    return readArea('notify').staffNotifyPrefs[input.staffId] ?? defaultStaffNotifyPrefs(input.staffId);
  });
};

// ─────────────────────── Приглашение сотрудника в систему (F-05-063) ───────────────────────

export const INVITE_TYPE_LABEL: LocalizedText = { ru: 'Приглашение сотрудника с доступом', en: 'Staff access invite' };

export const getStaffInvite = (staffId: Id) => request(() => readArea('notify').staffInvites[staffId]);

function inviteLink(token: string): string {
  return `https://booking.am/invite/${token}`;
}

export interface SendStaffInviteInput {
  businessId: Id;
  staffId: Id;
  /** Телефон или email — по телефону приглашение доходит, только если подключён SMS/чат-канал (ТЗ «Логика») */
  target: string;
}

export const sendStaffInvite = (input: SendStaffInviteInput) => {
  if (isApiMode()) return N.sendStaffInvite(input);
  return request(() => {
    const staff = readCore().staff.find((s) => s.id === input.staffId);
    if (!staff) throw new Error('staff not found');
    const byPhone = /^\+?\d[\d\s()-]{5,}$/.test(input.target.trim());
    const smsReady = (readArea('notify').channels[input.businessId] ?? []).some((c) => c.channel === 'sms' && c.connected);
    const canReachByPhone = byPhone && smsReady;
    const token = newId('inv').replace(/^inv[_-]?/, '');
    const now = toISODateTime(new Date());
    let invite: StaffInvite | undefined;
    mutateArea('notify', (s) => {
      invite = { staffId: input.staffId, status: 'pending', target: input.target.trim(), token, sentAt: now };
      s.staffInvites[input.staffId] = invite;
      const log = s.log[input.businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId: input.businessId,
        createdAt: now,
        typeLabel: INVITE_TYPE_LABEL,
        channel: byPhone ? 'sms' : 'email',
        status: byPhone && !canReachByPhone ? 'notDelivered' : 'sent',
        contact: input.target.trim(),
        text: {
          ru: `Приглашение в кабинет для ${staff.name}: ${inviteLink(token)}`,
          en: `Invite to the workspace for ${staff.name}: ${inviteLink(token)}`,
        },
        staffId: input.staffId,
      });
      s.log[input.businessId] = capLog(log);
    });
    return { ...invite!, link: inviteLink(token), reachableByPhone: !byPhone || canReachByPhone };
  });
};

export const resendStaffInvite = (input: { businessId: Id; staffId: Id }) =>
  request(() => {
    const current = readArea('notify').staffInvites[input.staffId];
    if (!current) throw new Error('no invite to resend');
    return sendStaffInvite({ businessId: input.businessId, staffId: input.staffId, target: current.target });
  });

export const revokeStaffInvite = (staffId: Id) =>
  request(() =>
    mutateArea('notify', (s) => {
      const current = s.staffInvites[staffId];
      if (current) s.staffInvites[staffId] = { ...current, status: 'revoked' };
    }),
  );

// ─────────────────────────── Служебные письма для других разделов (F-05-129, F-05-131, F-05-134) ───────────────────────────
//
// Три функции ниже — готовые точки входа для разделов-хозяев: сам процесс (фискализация оплаты, кнопка
// «Выгрузить в Excel», расписание отчёта «Выполнение плана» в сети) строит хозяин; отправку письма и
// запись в «Отчёты → Сообщения» (F-05-107/130) делает notify — так же, как sendStaffInvite делает это для
// staff. Хозяин зовёт функцию, сам email/канал notify не трогает.

/** F-05-129: фискальный чек клиенту на email — только если email указан; язык темы/письма не наш (юр. требование страны). */
export const sendFiscalReceiptEmail = (input: { businessId: Id; clientId: Id; receiptUrl: string; email: string }) => {
  if (isApiMode()) return N.sendFiscalReceiptEmail(input);
  return request(() => {
    if (!input.email) throw new Error('client has no email');
    const now = toISODateTime(new Date());
    mutateArea('notify', (s) => {
      const log = s.log[input.businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId: input.businessId,
        createdAt: now,
        typeLabel: { ru: 'Фискальный чек', en: 'Fiscal receipt' },
        channel: 'email',
        status: 'sent',
        contact: input.email,
        text: { ru: `Фискальный чек по визиту: ${input.receiptUrl}`, en: `Fiscal receipt for your visit: ${input.receiptUrl}` },
        clientId: input.clientId,
      });
      s.log[input.businessId] = capLog(log);
    });
    return { sent: true };
  });
};

/** F-05-131: крупная выгрузка не скачивается сразу — ссылка на файл письмом; факт отправки виден в журнале. */
export const sendDataExportEmail = (input: { businessId: Id; toEmail: string; reportLabel: LocalizedText; downloadUrl: string; staffId?: Id }) => {
  if (isApiMode()) return N.sendDataExportEmail(input);
  return request(() => {
    const now = toISODateTime(new Date());
    mutateArea('notify', (s) => {
      const log = s.log[input.businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId: input.businessId,
        createdAt: now,
        typeLabel: { ru: 'Выгрузка данных (ссылка на email)', en: 'Data export (email link)' },
        channel: 'email',
        status: 'sent',
        contact: input.toEmail,
        text: {
          ru: `Ваша выгрузка «${input.reportLabel.ru}» готова: ${input.downloadUrl}`,
          en: `Your export "${input.reportLabel.en ?? input.reportLabel.ru}" is ready: ${input.downloadUrl}`,
        },
        staffId: input.staffId,
      });
      s.log[input.businessId] = capLog(log);
    });
    return { sent: true };
  });
};

/** F-05-134: отчёт «Выполнение плана» сети — ссылка на Excel по расписанию, которое хозяин (сеть) хранит сам. */
export type PlanReportFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export const sendPlanReportEmail = (input: { businessId: Id; toEmail: string; downloadUrl: string; frequency: PlanReportFrequency }) => {
  if (isApiMode()) return N.sendPlanReportEmail(input);
  return request(() => {
    if (input.frequency === 'off') throw new Error('scheduling is off');
    const now = toISODateTime(new Date());
    mutateArea('notify', (s) => {
      const log = s.log[input.businessId] ?? [];
      log.unshift({
        id: newId('lg'),
        businessId: input.businessId,
        createdAt: now,
        typeLabel: { ru: 'Отчёт «Выполнение плана» (по расписанию)', en: 'Plan progress report (scheduled)' },
        channel: 'email',
        status: 'sent',
        contact: input.toEmail,
        text: { ru: `Отчёт «Выполнение плана»: ${input.downloadUrl}`, en: `Plan progress report: ${input.downloadUrl}` },
      });
      s.log[input.businessId] = capLog(log);
    });
    return { sent: true };
  });
};

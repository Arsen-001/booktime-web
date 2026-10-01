'use client';

/**
 * Раздел «notify» на настоящем сервере (docs/backend/PLAN.md этап 10, docs/backend/02-api.md §10) — колокольчик
 * кабинета (F-05-061): та же лента, что сервер строит из booking_events, сервер и считает.
 *
 * Этап 21 «notify+integrations», попытка 2: добавлены куски, форма которых НЕ расходится (web-popup, email
 * «для ответов», служебные баннеры, обзор каналов, клиентские настройки уведомлений, приглашение сотрудника).
 *
 * Попытка 3 (28.09) — решение владельца: каталог типов уведомлений (listTypes/getType/updateType) строим ПОД
 * экран, а не наоборот — 29 настраиваемых + 2 служебных типа (НЕ 88 — то была верхняя граница нумерации Altegio,
 * не количество). Сервер держит реестр статично (порт `TYPE_REGISTRY`) + правку бизнеса поверх. Плюс: настройки/
 * тихие часы, витрина подарков, Open Slots расписание/вычисление (настоящий AvailabilityService), сводки
 * партнёров, WhatsApp через Altegio (статус/настройки, Р19), флаги агента, время напоминания на услугу, свои
 * вебхуки, письма, правка уведомлений записи, богатая матрица уведомлений сотрудника (`nsp:<staffId>` в
 * BusinessSetting — своя модель, НЕ внутренний `StaffNotifyPref`, тот питает настоящую отправку и не тронут).
 * Лейн notify-log+mailings (28.09): журнал отправок (постранично), «Запланировано», рассылки с сегментами и по
 * расписанию, аудитория, разовое сообщение, ссылка на оплату — на сервере (внизу файла).
 * Остаётся на моке: чат с клиентом через партнёра и демо-кнопки `simulate*` (Р19 — чужие, без настоящего обмена) — см. `booktime-backend/docs/PROGRESS.md`,
 * этап 21, лейн notify+integrations, за полный разбор.
 */
import type { Id, LocalizedText } from '@/domain/core';
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { InboxEventKind, InboxPreviewItem } from '@/api/notify';
import type { LoyaltyNotifyRulePatch, TypePatch } from '@/api/notify';
import type { AudienceFilter, CreateMailingInput, SendOneOffInput, SendPaymentLinkInput } from '@/api/notify';
import type { LogMessage, Mailing, MailingChannel } from '@/domain/notify';
import type {
  AgentNotifyFlags,
  AltegioWhatsAppMode,
  AltegioWhatsAppSettings,
  BookingNotifyOverride,
  ChannelConnection,
  ClientNotifyPrefs,
  EmailChannelSettings,
  GiftShowcaseSettings,
  NewsItem,
  NotificationType,
  NotifyChannel,
  NotifySettings,
  OpenSlotsScheduleSettings,
  PartnerConnection,
  PartnerSummarySettings,
  ServiceBannerDef,
  StaffInvite,
  StaffNotifyChannel,
  StaffNotifyEvent,
  StaffNotifyPrefs,
  SuggestedOpenSlot,
  Webhook,
  WebhookEntity,
  WebPopupSettings,
  WhoToInviteSuggestion,
} from '@/domain/notify';

export function listInboxPreview(businessId: Id, limit = 5): Promise<InboxPreviewItem[]> {
  return http('GET', `/v1/biz/${businessId}/inbox`, undefined, { query: { preview: limit } });
}

export function listInboxEvents(businessId: Id): Promise<InboxPreviewItem[]> {
  return http('GET', `/v1/biz/${businessId}/inbox`);
}

export function countUnreadInbox(businessId: Id): Promise<number> {
  return http<{ value: number }>('GET', `/v1/biz/${businessId}/inbox/unread-count`).then((r) => r.value);
}

export function markInboxRead(input: { businessId: Id; ids: Id[] }): Promise<void> {
  return http('POST', `/v1/biz/${input.businessId}/inbox/read`, { ids: input.ids }).then(() => undefined);
}

export type { InboxEventKind };

// ─────────────────────────── Уведомления в Web-версии (F-05-058) ───────────────────────────

export function getWebPopupSettings(businessId: Id): Promise<WebPopupSettings> {
  return http('GET', `/v1/biz/${businessId}/notify/web-popup`);
}

export function updateWebPopupSettings(input: { businessId: Id; settings: WebPopupSettings }): Promise<WebPopupSettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/web-popup`, input.settings);
}

// ─────────────────────────── Email «для ответов» (F-05-066) ───────────────────────────

export function getEmailSettings(businessId: Id): Promise<EmailChannelSettings> {
  return http('GET', `/v1/biz/${businessId}/notify/email`);
}

export function updateEmailSettings(input: { businessId: Id; settings: EmailChannelSettings }): Promise<EmailChannelSettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/email`, input.settings);
}

// ─────────────────────────── Свой SMS-провайдер (В-08) ───────────────────────────

interface BusinessMessengerSettings {
  connected: boolean;
  channel: 'sms' | 'whatsapp';
  senderName?: string;
  apiKey?: string;
}

export function getSmsSettings(businessId: Id): Promise<{ connected: boolean; apiKey?: string; senderName?: string }> {
  return http<BusinessMessengerSettings>('GET', `/v1/biz/${businessId}/notify/channels`).then((r) =>
    r.channel === 'sms' ? { connected: r.connected, apiKey: r.apiKey, senderName: r.senderName } : { connected: false },
  );
}

export function connectSms(input: { businessId: Id; apiKey: string; senderName: string }): Promise<void> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/channels`, { channel: 'sms', apiKey: input.apiKey, senderName: input.senderName }).then(() => undefined);
}

export function disconnectSms(businessId: Id): Promise<void> {
  return http('POST', `/v1/biz/${businessId}/notify/channels/disconnect`).then(() => undefined);
}

// ─────────────────────────── Обзор каналов (F-05-065) ───────────────────────────

export function listChannels(businessId: Id): Promise<ChannelConnection[]> {
  return http('GET', `/v1/biz/${businessId}/notify/channels/overview`);
}

export function setChannelConnected(input: { businessId: Id; channel: NotifyChannel; connected: boolean }): Promise<ChannelConnection> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/channels/overview`, { channel: input.channel, connected: input.connected });
}

// ─────────────────────────── Служебные баннеры (F-05-135) ───────────────────────────

export function listServiceBanners(businessId: Id): Promise<ServiceBannerDef[]> {
  return http('GET', `/v1/biz/${businessId}/notify/banners`);
}

export function dismissServiceBanner(input: { businessId: Id; bannerId: string }): Promise<void> {
  return http('POST', `/v1/biz/${input.businessId}/notify/banners/dismiss`, { bannerId: input.bannerId }).then(() => undefined);
}

// ─────────────────────────── Настройки уведомлений клиента (F-05-090/091) ───────────────────────────

export function getClientNotifyPrefs(businessId: Id, clientId: Id): Promise<ClientNotifyPrefs> {
  return http('GET', `/v1/biz/${businessId}/clients/${clientId}/notify`);
}

export function updateClientNotifyPrefs(businessId: Id, clientId: Id, prefs: ClientNotifyPrefs): Promise<ClientNotifyPrefs> {
  return http('PUT', `/v1/biz/${businessId}/clients/${clientId}/notify`, prefs);
}

// ─────────────────────── Приглашение сотрудника в систему (F-05-063) ───────────────────────

export function sendStaffInvite(input: { businessId: Id; staffId: Id; target: string }): Promise<StaffInvite & { link: string; reachableByPhone: boolean }> {
  return http('POST', `/v1/biz/${input.businessId}/staff/${input.staffId}/notify-invite`, { target: input.target });
}

// ─────────────────────── Этап 21, попытка 3 ───────────────────────
// ── Ручная правка уведомлений ОДНОЙ записи (F-05-009/082) ──

export function getBookingNotifyOverride(businessId: Id, bookingId: Id): Promise<BookingNotifyOverride> {
  return http('GET', `/v1/biz/${businessId}/bookings/${bookingId}/notify-override`);
}

export function updateBookingNotifyOverride(businessId: Id, bookingId: Id, override: BookingNotifyOverride): Promise<BookingNotifyOverride> {
  return http('PUT', `/v1/biz/${businessId}/bookings/${bookingId}/notify-override`, override);
}

// ── Язык/формат/тихие часы (F-05-010/011) ──

export function getNotifySettings(businessId: Id): Promise<NotifySettings> {
  return http('GET', `/v1/biz/${businessId}/notify/settings`);
}

export function updateNotifySettings(input: { businessId: Id; settings: NotifySettings }): Promise<NotifySettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/settings`, input.settings);
}

// ── Витрина подарков партнёра (F-05-127) ──

export function getGiftShowcase(businessId: Id): Promise<GiftShowcaseSettings> {
  return http('GET', `/v1/biz/${businessId}/notify/gift-showcase`);
}

export function updateGiftShowcase(input: { businessId: Id; settings: GiftShowcaseSettings }): Promise<GiftShowcaseSettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/gift-showcase`, input.settings);
}

// ── Правила уведомлений лояльности (F-05-100…106), этап 21 «Сдача» — сервер хранит правки по коду события ──

export function getLoyaltyNotifyPatches(businessId: Id): Promise<Record<string, LoyaltyNotifyRulePatch>> {
  trackRead('areas.notify');
  return http('GET', `/v1/biz/${businessId}/notify/loyalty-rules`);
}

export async function patchLoyaltyNotifyRule(businessId: Id, code: string, patch: LoyaltyNotifyRulePatch): Promise<Record<string, LoyaltyNotifyRulePatch>> {
  const res = await http<Record<string, LoyaltyNotifyRulePatch>>('PATCH', `/v1/biz/${businessId}/notify/loyalty-rules/${encodeURIComponent(code)}`, patch);
  notifyDbChange('areas.notify');
  return res;
}

// ── Подключения партнёрских приложений (F-05-117/122/123), этап 21 «Сдача» — Р19: статус без обмена ──

export function listPartnerConnections(businessId: Id): Promise<PartnerConnection[]> {
  trackRead('areas.notify');
  return http('GET', `/v1/biz/${businessId}/notify/partner-connections`);
}

export async function connectPartnerApp(connection: PartnerConnection): Promise<PartnerConnection> {
  // F-05-122: одно подключение на несколько локаций — строка в каждой (права проверяются по каждому филиалу)
  for (const businessId of connection.businessIds) {
    await http('PUT', `/v1/biz/${businessId}/notify/partner-connections/${encodeURIComponent(connection.appId)}`, connection);
  }
  notifyDbChange('areas.notify');
  return connection;
}

export async function disconnectPartnerApp(businessId: Id, appId: Id): Promise<void> {
  await http('POST', `/v1/biz/${businessId}/notify/partner-connections/${encodeURIComponent(appId)}/delete`);
  notifyDbChange('areas.notify');
}

export async function setPartnerAppStatus(businessId: Id, appId: Id, status: PartnerConnection['status']): Promise<void> {
  await http('POST', `/v1/biz/${businessId}/notify/partner-connections/${encodeURIComponent(appId)}/status`, { status });
  notifyDbChange('areas.notify');
}

// ── Open Slots — расписание (F-05-124) ──

export function getOpenSlotsSchedule(businessId: Id): Promise<OpenSlotsScheduleSettings> {
  return http('GET', `/v1/biz/${businessId}/notify/open-slots-schedule`);
}

export function updateOpenSlotsSchedule(input: { businessId: Id; settings: OpenSlotsScheduleSettings }): Promise<OpenSlotsScheduleSettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/open-slots-schedule`, input.settings);
}

// ── Сводки и оповещения партнёров (F-05-126) ──

export function getPartnerSummarySettings(businessId: Id): Promise<PartnerSummarySettings> {
  return http('GET', `/v1/biz/${businessId}/notify/partner-summary`);
}

export function updatePartnerSummarySettings(input: { businessId: Id; settings: PartnerSummarySettings }): Promise<PartnerSummarySettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/partner-summary`, input.settings);
}

// ── WhatsApp через Altegio (F-05-071…073) ──

export function getAltegioWhatsApp(businessId: Id): Promise<AltegioWhatsAppSettings> {
  return http('GET', `/v1/biz/${businessId}/notify/altegio-whatsapp`);
}

export function updateAltegioWhatsApp(input: { businessId: Id; settings: AltegioWhatsAppSettings }): Promise<AltegioWhatsAppSettings> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/altegio-whatsapp`, input.settings);
}

export function setAltegioWhatsAppMode(input: { businessId: Id; mode: AltegioWhatsAppMode }): Promise<AltegioWhatsAppSettings> {
  return http('POST', `/v1/biz/${input.businessId}/notify/altegio-whatsapp/mode`, { mode: input.mode });
}

export function approveWhatsAppTemplates(businessId: Id): Promise<AltegioWhatsAppSettings> {
  return http('POST', `/v1/biz/${businessId}/notify/altegio-whatsapp/approve-templates`);
}

// ── Флаги внешнего агента (F-05-121) ──

export function getAgentNotifyFlags(businessId: Id): Promise<AgentNotifyFlags> {
  return http('GET', `/v1/biz/${businessId}/notify/agent-flags`);
}

export function updateAgentNotifyFlags(input: { businessId: Id; flags: AgentNotifyFlags }): Promise<AgentNotifyFlags> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/agent-flags`, input.flags);
}

// ── Своё время напоминания на услугу (Ув15) ──

export function getServiceReminderHours(input: { businessId: Id; serviceId: Id }): Promise<number | null> {
  return http<{ hours: number | null }>('GET', `/v1/biz/${input.businessId}/notify/service-reminder-hours/${input.serviceId}`).then((r) => r.hours);
}

export function setServiceReminderHours(input: { businessId: Id; serviceId: Id; hours: number | null }): Promise<void> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/service-reminder-hours/${input.serviceId}`, { hours: input.hours }).then(() => undefined);
}

// ── Свои вебхуки (F-05-120) ──

export function listWebhooks(businessId: Id): Promise<Webhook[]> {
  return http('GET', `/v1/biz/${businessId}/notify/webhooks`);
}

export function createWebhook(input: { businessId: Id; url: string; entities: WebhookEntity[] }): Promise<Webhook> {
  return http('POST', `/v1/biz/${input.businessId}/notify/webhooks`, { url: input.url, entities: input.entities });
}

export function setWebhookActive(input: { businessId: Id; webhookId: Id; active: boolean }): Promise<void> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/webhooks/${input.webhookId}/active`, { active: input.active }).then(() => undefined);
}

export function deleteWebhook(input: { businessId: Id; webhookId: Id }): Promise<void> {
  return http('POST', `/v1/biz/${input.businessId}/notify/webhooks/${input.webhookId}/delete`).then(() => undefined);
}

// ── Письма от разделов-хозяев (F-05-129/131/134) ──

export function sendFiscalReceiptEmail(input: { businessId: Id; clientId: Id; receiptUrl: string; email: string }): Promise<{ sent: boolean }> {
  return http('POST', `/v1/biz/${input.businessId}/notify/send/fiscal-receipt`, { clientId: input.clientId, receiptUrl: input.receiptUrl, email: input.email });
}

export function sendDataExportEmail(input: { businessId: Id; toEmail: string; reportLabel: LocalizedText; downloadUrl: string; staffId?: Id }): Promise<{ sent: boolean }> {
  return http('POST', `/v1/biz/${input.businessId}/notify/send/data-export`, { toEmail: input.toEmail, reportLabel: input.reportLabel, downloadUrl: input.downloadUrl, staffId: input.staffId });
}

export function sendPlanReportEmail(input: { businessId: Id; toEmail: string; downloadUrl: string; frequency: 'off' | 'daily' | 'weekly' | 'monthly' }): Promise<{ sent: boolean }> {
  return http('POST', `/v1/biz/${input.businessId}/notify/send/plan-report`, { toEmail: input.toEmail, downloadUrl: input.downloadUrl, frequency: input.frequency });
}

// ── Каталог типов уведомлений (F-05-001…023) — решение владельца 28.09: сервер строит ПОД экран ──

export function listTypes(businessId: Id): Promise<NotificationType[]> {
  return http('GET', `/v1/biz/${businessId}/notify/types`);
}

export function getType(businessId: Id, code: number): Promise<NotificationType> {
  return http('GET', `/v1/biz/${businessId}/notify/types/${code}`);
}

export function updateType(input: { businessId: Id; code: number; patch: TypePatch }): Promise<NotificationType> {
  return http('PUT', `/v1/biz/${input.businessId}/notify/types`, { code: input.code, patch: input.patch });
}

/** 28.09: короткая ссылка SMS `/s/<code>` → путь на нашем домене (публично, без сессии) */
export function resolveShortLink(code: string): Promise<{ target: string }> {
  return http('GET', `/v1/public/s/${encodeURIComponent(code)}`);
}

// ── Open Slots на сегодня/завтра (F-05-124) / Кого позвать (F-05-125), этап 21 попытка 4 — настоящий движок ──

export function listOpenSlots(input: { businessId: Id; day: 'today' | 'tomorrow' }): Promise<SuggestedOpenSlot[]> {
  return http('GET', `/v1/biz/${input.businessId}/notify/open-slots`, undefined, { query: { day: input.day } });
}

export function listWhoToInvite(businessId: Id): Promise<WhoToInviteSuggestion[]> {
  return http('GET', `/v1/biz/${businessId}/notify/who-to-invite`);
}

// ── Уведомления сотрудника — богатая матрица (F-05-055…060), НЕ внутренний StaffNotifyPref ──

export function getStaffNotifyPrefs(businessId: Id, staffId: Id): Promise<StaffNotifyPrefs> {
  return http('GET', `/v1/biz/${businessId}/staff/${staffId}/notify-prefs-rich`);
}

export function anyStaffNotifyConfigured(businessId: Id, staffIds: Id[]): Promise<boolean> {
  return http<{ value: boolean }>('POST', `/v1/biz/${businessId}/staff/notify-prefs-rich/any-configured`, { staffIds }).then((r) => r.value);
}

export function updateStaffNotifyPrefs(businessId: Id, staffId: Id, patch: Partial<StaffNotifyPrefs>): Promise<StaffNotifyPrefs> {
  return http('PUT', `/v1/biz/${businessId}/staff/${staffId}/notify-prefs-rich`, patch);
}

export function setStaffNotifyMatrixCell(businessId: Id, staffId: Id, event: StaffNotifyEvent, channel: StaffNotifyChannel, value: boolean): Promise<StaffNotifyPrefs> {
  return http('POST', `/v1/biz/${businessId}/staff/${staffId}/notify-prefs-rich/cell`, { event, channel, value });
}

// ── Лента новостей платформы (F-05-061/062) ──

export function listPlatformNews(businessId: Id): Promise<NewsItem[]> {
  return http('GET', `/v1/biz/${businessId}/notify/news-feed`);
}

// ── Журнал отправок, рассылки, разовое сообщение, ссылка на оплату (этап 21, лейн notify-log+mailings) ──

/** Журнал на сервере постраничный (курсор, индекс по дате); фасад отдаёт экрану свежие строки как мок — до 2000 */
const LOG_PAGE = 500;
const LOG_MAX = 2000;

export async function listLog(businessId: Id): Promise<LogMessage[]> {
  trackRead('areas.notify');
  const out: LogMessage[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: LogMessage[]; nextCursor: string | null } = await http('GET', `/v1/biz/${businessId}/notify/send-log`, undefined, {
      query: cursor ? { limit: LOG_PAGE, cursor } : { limit: LOG_PAGE },
    });
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && out.length < LOG_MAX);
  return out;
}

export function listScheduledLog(businessId: Id): Promise<LogMessage[]> {
  trackRead('areas.notify');
  return http('GET', `/v1/biz/${businessId}/notify/send-log/scheduled`);
}

export function listMailings(businessId: Id): Promise<Mailing[]> {
  trackRead('areas.notify');
  return http('GET', `/v1/biz/${businessId}/notify/mailings`);
}

export function countRecentAppPushes(businessId: Id): Promise<number> {
  trackRead('areas.notify');
  return http<{ value: number }>('GET', `/v1/biz/${businessId}/notify/mailings/push-count`).then((r) => r.value);
}

export async function createMailing(input: CreateMailingInput): Promise<Mailing> {
  const res = await http<Mailing>('POST', `/v1/biz/${input.businessId}/notify/mailings`, {
    businessIds: input.businessIds,
    channel: input.channel,
    text: input.text,
    audienceLabel: input.audienceLabel,
    filter: input.filter,
    network: input.network,
    scheduledAt: input.scheduledAt,
  });
  notifyDbChange('areas.notify');
  return res;
}

export async function sendTestMailing(input: { businessId: Id; channel: MailingChannel; text: string }): Promise<{ phone: string }> {
  const res = await http<{ phone: string }>('POST', `/v1/biz/${input.businessId}/notify/mailings/test`, { channel: input.channel, text: input.text });
  notifyDbChange('areas.notify');
  return res;
}

/** Аудитория считается у бизнеса-отправителя (первый из списка); сервер проверяет, что остальные — его сеть */
export function countAudience(input: { businessIds: Id[]; filter: AudienceFilter }): Promise<number> {
  const [businessId] = input.businessIds;
  if (!businessId) return Promise.resolve(0);
  return http<{ value: number }>('POST', `/v1/biz/${businessId}/notify/mailings/audience-count`, { businessIds: input.businessIds, filter: input.filter }).then((r) => r.value);
}

export async function sendOneOffMessage(input: SendOneOffInput): Promise<{ sentChannels: SendOneOffInput['channels'] }> {
  const res = await http<{ sentChannels: SendOneOffInput['channels'] }>('POST', `/v1/biz/${input.businessId}/notify/one-off`, {
    clientId: input.clientId,
    text: input.text,
    channels: input.channels,
    source: input.source,
  });
  notifyDbChange('areas.notify');
  return res;
}

export function getPaymentLink(businessId: Id, bookingId: Id): Promise<{ bookingId: Id; url: string; createdAt: string }> {
  return http('GET', `/v1/biz/${businessId}/bookings/${bookingId}/notify-payment-link`);
}

export async function sendPaymentLink(input: SendPaymentLinkInput): Promise<{ sentChannels: SendPaymentLinkInput['channels'] }> {
  const res = await http<{ sentChannels: SendPaymentLinkInput['channels'] }>('POST', `/v1/biz/${input.businessId}/bookings/${input.bookingId}/notify-payment-link/send`, {
    clientId: input.clientId,
    channels: input.channels,
  });
  notifyDbChange('areas.notify');
  return res;
}

// ═══════════════════ Этап 21 (сдача, попытка 6): чат через партнёра и демо-кнопки (Р19) ═══════════════════

const nb = (businessId: Id) => `/v1/biz/${businessId}/notify`;

export function getChatUnread(businessId: Id): Promise<number> {
  return http<{ count: number }>('GET', `${nb(businessId)}/chat/unread`).then((r) => r.count);
}

export function clearChatUnread(businessId: Id): Promise<void> {
  return http('POST', `${nb(businessId)}/chat/unread/clear`).then(() => undefined);
}

export function listChatMessages(businessId: Id, phone: string): Promise<import('@/domain/notify').ChatMessage[]> {
  return http('GET', `${nb(businessId)}/chat/messages`, undefined, { query: { phone } });
}

export function sendChatMessage(input: import('@/api/notify').SendChatMessageInput): Promise<import('@/domain/notify').ChatMessage> {
  const { businessId, ...body } = input;
  return http('POST', `${nb(businessId)}/chat/messages`, body);
}

export function simulateIncomingChatMessage(input: { businessId: Id; phone: string; clientId?: Id; text: string }): Promise<import('@/domain/notify').ChatMessage> {
  const { businessId, ...body } = input;
  return http('POST', `${nb(businessId)}/chat/simulate-incoming`, body);
}

export function simulatePartnerConfirmBooking(businessId: Id): Promise<{ confirmed: boolean }> {
  return http('POST', `${nb(businessId)}/chat/simulate-partner-confirm`);
}

export function sendTestWhatsAppMessage(businessId: Id): Promise<{ sent: boolean }> {
  return http('POST', `${nb(businessId)}/whatsapp/test-message`);
}

export function simulateAgentBooking(input: { businessId: Id; clientPhone: string; sendToClient: boolean }): Promise<{ sent: boolean }> {
  const { businessId, ...body } = input;
  return http('POST', `${nb(businessId)}/agent/simulate-booking`, body);
}

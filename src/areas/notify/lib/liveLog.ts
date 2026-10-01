/**
 * Живой журнал отправок (F-05-024…040, F-05-107/108/130) — связывает реальные действия других разделов
 * (журнал, онлайн-запись, статусы записей) с уведомлениями клиенту БЕЗ правки чужих файлов: ядро уже
 * пишет каждое изменение записи в `bookingEvents` (src/domain/core.ts, «Журнал событий записей» —
 * «читают… уведомления (notify)»), это единственный канал, из которого разделу положено брать факты.
 *
 * Функция чистая: на каждый вызов заново выводит список «что реально ушло бы» из текущего состояния
 * ядра + настроек типов, поэтому переживает перезагрузку страницы без отдельного хранения (сами
 * bookingEvents и bookings уже персистентны — see mock/db.ts).
 */
import type { Booking, BookingEvent, Client, CoreData, Id, ISODateTime, LocalizedText, Staff } from '@/domain/core';
import type {
  BookingNotifyOverride,
  ClientNotifyPrefs,
  LogMessage,
  LogStatus,
  NotificationType,
  NotifyChannel,
  NotifyLanguage,
  NotifyQuietHours,
  NotifySettings,
} from '@/domain/notify';
import { DEFAULT_CLIENT_NOTIFY_PREFS, DEFAULT_QUIET_HOURS, NOTIFY_LANGUAGES, WHATSAPP_MESSAGE_PRICE_AMD } from '@/domain/notify';
import { previewDelivery } from '@/areas/notify/lib/engine';
import { formatNotifyClock } from '@/areas/notify/lib/registry';
import { ownPathOf, shortUrl } from '@/areas/notify/lib/shortLink';
import { countSms, SMS_PART_PRICE_AMD } from '@/areas/notify/lib/sms';
import { dayjs } from '@/lib/date';

const DEFAULT_LIVE_LOG_SETTINGS: NotifySettings = { language: 'ru', dateFormat: '24h' };

/** Публичный адрес страниц салона — ссылки {link}/{bookingLink}/{reviewLink} ведут на /b/<slug> (Ув5, Ув6) */
const PUBLIC_HOST = 'booktime.am';

const TODAY_WORD: Record<NotifyLanguage, string> = { ru: 'сегодня', en: 'today', hy: 'այսօր' };
const TOMORROW_WORD: Record<NotifyLanguage, string> = { ru: 'завтра', en: 'tomorrow', hy: 'վաղը' };

/**
 * F-05-010/F-05-011: дата и время сообщения по языку и формату из «Настроек» бизнеса, а не жёсткий
 * ru + DD.MM.YYYY — раньше значение уходило одинаковым для всех бизнесов и языков (recheck-c3 major).
 * «Сегодня»/«завтра» — по text-q3 №1, иначе короткое «D MMM».
 */
function formatDateVars(
  startISO: ISODateTime,
  now: Date,
  settings: NotifySettings,
  lang: NotifyLanguage,
): { date: string; time: string; dateTime: string } {
  const start = dayjs(startISO);
  const diffDays = start.startOf('day').diff(dayjs(now).startOf('day'), 'day');
  const hh = start.hour();
  const mm = start.minute();
  const time = formatNotifyClock(hh, mm, settings.dateFormat);
  const date = diffDays === 0 ? TODAY_WORD[lang] : diffDays === 1 ? TOMORROW_WORD[lang] : start.format('DD.MM.YYYY');
  const dateTime = diffDays === 0 || diffDays === 1 ? `${date}, ${time}` : `${date} ${time}`;
  return { date, time, dateTime };
}

const LOG_STATUS_CYCLE: LogStatus[] = ['delivered', 'sent', 'read'];
/**
 * Каналы, которым в жизни свойственно иногда не дойти (телефон офлайн, пуш выключен в системе,
 * оператор SMS отклонил). До этой правки цикл статусов был жёстко ['delivered','sent','read'] —
 * ни одна живая строка журнала никогда не получала «Не доставлено»/«Отклонено», поэтому кнопка
 * «Напомнить через WhatsApp» (F-05-008, ⭐ F-00-121) физически не могла появиться ни у одного
 * бизнеса демо-данных: фильтр по статусу честно показывал пустое состояние. Добавляем этим
 * каналам статус notDelivered в цикл — детерминированно (по хешу id), без случайности между
 * перезагрузками.
 */
const FAILURE_PRONE_CHANNELS: readonly NotifyChannel[] = ['push', 'brandedApp', 'sms', 'whatsapp'];
// 1 из 4 — не тонкая правка «для галочки»: с 4–7 живыми строками на бизнес (типичный демо-салон)
// цикл 1-к-8 в среднем ни разу не давал notDelivered на весь список — F-05-008 нельзя было проверить
// живым кликом ни на одном бизнесе (см. отчёт notify-g2-1-fix1). 1-к-4 делает «Не доставлено» видимым
// почти на каждом бизнесе, не превращая журнал в стену ошибок (доставлено/прочитано всё ещё большинство).
const LOG_STATUS_CYCLE_WITH_FAILURES: LogStatus[] = ['delivered', 'sent', 'read', 'notDelivered'];

function statusFor(seed: string, channel?: NotifyChannel): LogStatus {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const cycle = channel && FAILURE_PRONE_CHANNELS.includes(channel) ? LOG_STATUS_CYCLE_WITH_FAILURES : LOG_STATUS_CYCLE;
  return cycle[hash % cycle.length];
}

/**
 * Подставляет переменные (Ув6): значения на языке сообщения. Незаполненная переменная (нет данных у салона) не
 * оставляет пустое место посреди фразы — убираем её вместе с подписью «Адрес: » / висячей пунктуацией.
 */
function fillTemplate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
    .replace(/[^.։:!?\n]*[:՝]\s*(?=[.։]|$)[.։]?/g, '')
    .replace(/\(\s*,?\s*\)/g, '')
    .replace(/\s+([,.։])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[:․]\s*/, '')
    .trim();
}

/** Переменные на каждом языке — `vars` строит их для ru/hy/en отдельно (дата «сегодня»/«այսօր», название услуги…) */
type VarsByLang = Record<NotifyLanguage, Record<string, string>>;

// ─────────────────────────── Тихие часы (Ув12) ───────────────────────────

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function quietHoursOf(ctx: LiveLogContext): NotifyQuietHours {
  return ctx.settings?.quietHours ?? DEFAULT_QUIET_HOURS;
}

/**
 * Момент отправки с учётом тихих часов: попал в окно «с from до to» — переносится на ближайшее `to` (утро).
 * Окно через полночь (22:00–09:00) и в пределах дня (13:00–14:00) — оба поддержаны. Возвращает ISO «YYYY-MM-DDTHH:mm».
 */
export function quietShift(quiet: NotifyQuietHours, at: ISODateTime): ISODateTime {
  if (!quiet.enabled) return at;
  const t = dayjs(at);
  const m = t.hour() * 60 + t.minute();
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  if (from === to) return at;
  const inside = from > to ? m >= from || m < to : m >= from && m < to;
  if (!inside) return at;
  let end = t.hour(Math.floor(to / 60)).minute(to % 60).second(0);
  if (!end.isAfter(t)) end = end.add(1, 'day');
  return end.format('YYYY-MM-DDTHH:mm');
}

/**
 * Текст на всех трёх языках (Ув2, Ув16): каждый язык — свой шаблон и свои значения. Нет шаблона на языке — ru
 * (так же уйдёт и клиенту: пустым сообщение не бывает).
 */
function localize(source: LocalizedText | undefined, vars: VarsByLang, fallback: LocalizedText): LocalizedText {
  const base = source ?? fallback;
  const pick = (lang: NotifyLanguage) => base[lang] || fallback[lang] || base.ru;
  return {
    ru: fillTemplate(pick('ru'), vars.ru),
    en: fillTemplate(pick('en'), vars.en),
    hy: fillTemplate(pick('hy'), vars.hy),
  };
}

interface LiveLogContext {
  businessId: Id;
  core: CoreData;
  types: NotificationType[];
  overrides: Record<Id, BookingNotifyOverride>;
  /** Настройки уведомлений клиента (F-05-090) — по id клиента; нет записи = умолчание (все включено) */
  clientPrefs?: Record<Id, ClientNotifyPrefs>;
  /** Язык и формат даты/времени бизнеса (F-05-010, F-05-011) — нет записи = ru + 24ч */
  settings?: NotifySettings;
  now: Date;
  /**
   * 28.09: хэш доступа «моя запись без входа» (online.bookingMeta.accessHash) — по id записи. Без него ссылка
   * {link} открывала «Запись не найдена»: страница записи пускает только с ?h=.
   */
  accessHashes?: Record<Id, string>;
  /** ⭐ 30.09: телефоны клиентов, подключивших Telegram-бота (срез client.telegramLinked). Нет — не подключён никто. */
  telegramLinked?: Record<string, unknown>;
  /** 28.09: выдать код короткой ссылки на путь нашего домена (SMS). Нет — в SMS уходят полные ссылки. */
  shorten?: (targetPath: string) => string;
}

const SMS_LINK_KEYS = ['link', 'reviewLink', 'bookingLink', 'paymentLink'] as const;

/**
 * Переменные для SMS (28.09): ссылки нашего домена — короткие `booktime.am/s/<код>`, дата — «ДД.ММ» без года.
 * Остальные каналы (пуш, Email, WhatsApp) получают значения как есть — полные ссылки и полную дату.
 */
function forChannel(ctx: LiveLogContext, channel: NotifyChannel, vars: VarsByLang): VarsByLang {
  if (channel !== 'sms') return vars;
  const one = (v: Record<string, string>): Record<string, string> => {
    const out = { ...v };
    for (const key of SMS_LINK_KEYS) {
      const path = out[key] ? ownPathOf(out[key]) : null;
      if (path && ctx.shorten) out[key] = shortUrl(ctx.shorten(path));
    }
    if (out.date) out.date = out.date.replace(/^(\d{2}\.\d{2})\.\d{4}$/, '$1');
    if (out.dateTime) out.dateTime = out.dateTime.replace(/^(\d{2}\.\d{2})\.\d{4}/, '$1');
    return out;
  };
  return { ru: one(vars.ru), en: one(vars.en), hy: one(vars.hy) };
}

function pickChannel(type: NotificationType | undefined, hasApp: boolean, hasTelegram = false): NotifyChannel | undefined {
  if (!type) return undefined;
  return previewDelivery(type, hasApp, hasTelegram).willSend[0];
}

/** ⭐ 30.09: клиент подключил Telegram-бота (client.telegramLinked по телефону) — без этого в Telegram ничего не уходит */
function telegramLinked(ctx: LiveLogContext, client: Client): boolean {
  return !!client.phone && !!ctx.telegramLinked?.[client.phone];
}

/** F-05-090: клиент отключил себе этот тип, или канал недоступен в его карточке — сообщения не будет */
function clientAllows(ctx: LiveLogContext, clientId: Id, code: number, channel: NotifyChannel): boolean {
  const prefs = ctx.clientPrefs?.[clientId] ?? DEFAULT_CLIENT_NOTIFY_PREFS;
  if (prefs.disabledTypeCodes.includes(code)) return false;
  if ((channel === 'push' || channel === 'brandedApp') && !prefs.channels.push) return false;
  if (channel === 'sms' && !prefs.channels.sms) return false;
  if (channel === 'email' && !prefs.channels.email) return false;
  return true;
}

function businessVars(ctx: LiveLogContext, lang: NotifyLanguage, locationId?: Id): Record<string, string> {
  const business = ctx.core.businesses.find((b) => b.id === ctx.businessId);
  const location = locationId
    ? ctx.core.locations.find((l) => l.id === locationId)
    : ctx.core.locations.find((l) => l.businessId === ctx.businessId);
  const slug = business?.slug ?? '';
  return {
    companyName: business?.brandName || business?.name || '',
    bookingLink: slug ? `${PUBLIC_HOST}/b/${slug}/book` : '',
    address: (location && (location.address[lang] || location.address.ru)) ?? '',
    companyPhone: location?.phone || business?.phone || '',
    website: (business?.socials?.website ?? '').replace(/^https?:\/\//, ''),
    mapsLink: location?.yandexMapsUrl ?? '',
  };
}

function clientVars(client: Client | undefined): Record<string, string> {
  const [first, ...rest] = (client?.name ?? '').trim().split(/\s+/);
  return {
    clientName: first ?? '',
    clientLastName: rest.join(' '),
    clientPhone: client?.phone ?? '',
  };
}

/** Все переменные записи (Ув6) — ни одна из VARIABLES не уходит пустой, если у салона/записи есть данные */
function bookingVarsFor(
  ctx: LiveLogContext,
  booking: Booking,
  client: Client | undefined,
  lang: NotifyLanguage,
  at: Date,
): Record<string, string> {
  const staff = ctx.core.staff.find((s) => s.id === booking.staffId);
  const settings = ctx.settings ?? DEFAULT_LIVE_LOG_SETTINGS;
  const serviceNames = booking.services
    .map((line) => ctx.core.services.find((s) => s.id === line.serviceId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    // F-05-010: название услуги — на языке сообщения, а не всегда ru.
    .map((s) => s.name[lang] || s.name.ru);
  // «Сегодня/завтра» — относительно момента ОТПРАВКИ, а не момента, когда журнал открыли (Ув1): напоминание, ушедшее
  // вчера про сегодняшний визит, в журнале по-прежнему говорит «завтра» — как его и прочёл клиент.
  const { date, time, dateTime } = formatDateVars(booking.start, at, settings, lang);
  const business = ctx.core.businesses.find((b) => b.id === ctx.businessId);
  const slug = business?.slug ?? '';
  const accessHash = ctx.accessHashes?.[booking.id];
  const accessQuery = accessHash ? `?h=${encodeURIComponent(accessHash)}` : '';
  const minutesLeft = Math.max(0, dayjs(booking.start).diff(dayjs(at), 'minute'));
  const unitH: Record<NotifyLanguage, string> = { ru: 'ч', en: 'h', hy: 'ժ' };
  const unitM: Record<NotifyLanguage, string> = { ru: 'мин', en: 'min', hy: 'ր' };
  const timeLeft = minutesLeft >= 60 ? `${Math.round(minutesLeft / 60)} ${unitH[lang]}` : `${minutesLeft} ${unitM[lang]}`;
  return {
    ...businessVars(ctx, lang, booking.locationId),
    ...clientVars(client),
    date,
    time,
    dateTime,
    timeLeft,
    staff: staff?.name ?? '',
    service: serviceNames[0] ?? '',
    visitServices: serviceNames.join(', '),
    link: slug ? `${PUBLIC_HOST}/b/${slug}/booking/${booking.id}${accessQuery}` : '',
    reviewLink: slug ? `${PUBLIC_HOST}/b/${slug}/booking/${booking.id}${accessQuery ? `${accessQuery}&` : '?'}review=1` : '',
    paymentLink: slug ? `${PUBLIC_HOST}/b/${slug}/booking/${booking.id}${accessQuery ? `${accessQuery}&` : '?'}pay=1` : '',
    amount: String(booking.total ?? ''),
    discount: '',
    days: '',
    code: '',
  };
}

/** `at` — момент отправки сообщения (ISO или Date); от него считаются «сегодня/завтра» и «осталось N ч» */
function bookingVars(ctx: LiveLogContext, booking: Booking, client: Client | undefined, at: ISODateTime | Date): VarsByLang {
  const moment = typeof at === 'string' ? dayjs(at).toDate() : at;
  return {
    ru: bookingVarsFor(ctx, booking, client, 'ru', moment),
    en: bookingVarsFor(ctx, booking, client, 'en', moment),
    hy: bookingVarsFor(ctx, booking, client, 'hy', moment),
  };
}

/** Один клиент — одна запись «Название типа» (F-05-130) из его настроек в реестре типов, иначе резервный ярлык */
function typeLabel(type: NotificationType | undefined, fallback: LocalizedText): LocalizedText {
  return type?.name ?? fallback;
}

/**
 * F-05-139 «Понятно?»: подставляем в «Имя клиента» имя ЗАПИСАВШЕГО (получателя сообщения — у посетителя
 * нет своего телефона), но добавляем отдельную строку с именем посетителя, чтобы в тексте было видно,
 * на кого запись — без переписывания приветствия в каждом шаблоне.
 */
function appendVisitorNote(text: LocalizedText, booking: Booking | undefined, client: Client | undefined, channel: NotifyChannel): LocalizedText {
  if (!booking?.visitorName) return text;
  // 28.09: запись «для себя» — посетитель и есть клиент, строка лишняя; в SMS не пишем никогда — это вторая часть
  // (+25 ֏), а кто придёт, видно по ссылке на запись
  if (channel === 'sms') return text;
  if (client && booking.visitorName.trim().toLowerCase() === client.name.trim().toLowerCase()) return text;
  const note = { ru: `Посетитель: ${booking.visitorName}`, en: `Visitor: ${booking.visitorName}`, hy: `Այցելու՝ ${booking.visitorName}` };
  return {
    ru: `${text.ru}\n${note.ru}`,
    en: text.en ? `${text.en}\n${note.en}` : undefined,
    hy: text.hy ? `${text.hy}\n${note.hy}` : undefined,
  };
}

function pushEntry(
  out: LogMessage[],
  ctx: LiveLogContext,
  opts: {
    idSuffix: string;
    createdAt: ISODateTime;
    type: NotificationType | undefined;
    channel: NotifyChannel;
    client: Client | undefined;
    booking?: Booking;
    text: LocalizedText;
    fallbackLabel: LocalizedText;
    /** Будущая отправка (Ув11 «Запланировано»); не указано — считается по createdAt относительно «сейчас» */
    scheduled?: boolean;
    /** Исходный момент, если тихие часы перенесли отправку на утро (Ув12) */
    deferredFrom?: ISODateTime;
  },
): void {
  const scheduled = opts.scheduled ?? dayjs(opts.createdAt).isAfter(ctx.now);
  const text = appendVisitorNote(opts.text, opts.booking, opts.client, opts.channel);
  const sentLanguage = sendLanguage(ctx);
  out.push({
    id: `lg_live_${opts.idSuffix}`,
    businessId: ctx.businessId,
    createdAt: opts.createdAt,
    typeCode: opts.type?.code,
    typeLabel: typeLabel(opts.type, opts.fallbackLabel),
    channel: opts.channel,
    status: scheduled ? 'sending' : statusFor(opts.idSuffix, opts.channel),
    contact: opts.channel === 'email' ? opts.client?.email || opts.client?.phone || '—' : opts.client?.phone ?? '—',
    text,
    clientId: opts.client?.id,
    staffId: opts.booking?.staffId,
    bookingId: opts.booking?.id,
    sentLanguage,
    ...costOf(opts.channel, text[sentLanguage] || text.ru),
    scheduled: scheduled || undefined,
    deferredFrom: opts.deferredFrom && opts.deferredFrom !== opts.createdAt ? opts.deferredFrom : undefined,
  });
}

/** Язык, на котором сообщение уходит клиенту (F-05-010) — из «Настроек» уведомлений бизнеса */
function sendLanguage(ctx: LiveLogContext): NotifyLanguage {
  const lang = (ctx.settings ?? DEFAULT_LIVE_LOG_SETTINGS).language;
  return NOTIFY_LANGUAGES.includes(lang) ? lang : 'ru';
}

/** Цена отправки (Ув11): SMS — части × тариф, WhatsApp — за сообщение, пуш/Email/приложение — бесплатно */
export function costOf(channel: NotifyChannel, text: string): { costAmd: number; smsParts?: number } {
  if (channel === 'sms') {
    const parts = Math.max(1, countSms(text).parts);
    return { costAmd: parts * SMS_PART_PRICE_AMD, smsParts: parts };
  }
  if (channel === 'whatsapp') return { costAmd: WHATSAPP_MESSAGE_PRICE_AMD };
  return { costAmd: 0 };
}

/**
 * Уведомления, привязанные к событиям записи (создание/статус/перенос/удаление) — F-05-024…032,
 * data-f="F-03-126" (колокольчик и уведомления о записях из виджета — ветка viaWidget ниже).
 * `events` — уже отфильтрованный по бизнесу `core.bookingEvents` (см. listBookingEvents в src/api/core.ts).
 */
function eventDrivenEntries(ctx: LiveLogContext, events: BookingEvent[]): LogMessage[] {
  const out: LogMessage[] = [];
  const type2 = ctx.types.find((t) => t.code === 2);
  const type8 = ctx.types.find((t) => t.code === 8);
  const type9 = ctx.types.find((t) => t.code === 9);
  const type4 = ctx.types.find((t) => t.code === 4);
  const type74 = ctx.types.find((t) => t.code === 74);
  const type75 = ctx.types.find((t) => t.code === 75);

  events.forEach((event) => {
    const booking = ctx.core.bookings.find((b) => b.id === event.bookingId);
    if (!booking) return;
    const client = booking.clientId ? ctx.core.clients.find((c) => c.id === booking.clientId) : undefined;
    // F-05-025 п.2: запись без телефона (и без карточки клиента вовсе) сообщения не даёт.
    if (!client?.phone) return;
    const hasApp = !!client.appUserId;
    // Ув12: событие ночью (запись создана в 23:10) — клиенту уходит утром, в конце тихих часов
    const sendAt = quietShift(quietHoursOf(ctx), event.at);
    const vars = bookingVars(ctx, booking, client, sendAt);
    // Ув14: запись задним числом (визит уже начался к моменту события) — «вы записаны»/«подтверждена»/«изменена»
    // клиенту не шлём: запись на сегодня 10:00, созданная в 22:41, давала пуш о прошедшем визите.
    const visitAlreadyStarted = booking.start <= sendAt;

    if (event.kind === 'created') {
      if (visitAlreadyStarted) return;
      const override = ctx.overrides[booking.id];
      // F-05-025 п.3: снятая галочка «Отправить детали записи сразу после сохранения» отменяет отправку.
      if (override && override.sendOnSave === false) return;
      const viaWidget = booking.source === 'app' || booking.source === 'link' || booking.source === 'widget';
      const type = viaWidget ? type2 : type8;
      if (!type?.enabled) return;
      const channel = pickChannel(type, hasApp);
      if (!channel) return; // F-05-024 прогон: нет доступного канала — сообщения нет, строки в журнале нет
      pushEntry(out, ctx, {
        idSuffix: `ev_${event.id}`,
        createdAt: sendAt,
        deferredFrom: event.at,
        type,
        channel,
        client,
        booking,
        text: localize(type.templates[channel], forChannel(ctx, channel, vars), {
          ru: `Вы записаны: ${vars.ru.service} ${vars.ru.date} в ${vars.ru.time}.`,
          en: `You are booked: ${vars.en.service} on ${vars.en.date} at ${vars.en.time}.`,
        }),
        fallbackLabel: { ru: 'Детали записи', en: 'Booking details' },
      });
      return;
    }

    if (event.kind === 'status') {
      if (event.to === 'client_confirmed' || (event.from === 'awaiting_confirmation' && event.to === 'scheduled')) {
        if (visitAlreadyStarted) return;
        // F-05-026 п.2: подтверждение уходит и при выключенном типе — это отдельная явная кнопка «Подтвердить запись».
        const channel = pickChannel(type9, hasApp) ?? (hasApp ? 'push' : undefined);
        if (!channel) return;
        pushEntry(out, ctx, {
          idSuffix: `ev_${event.id}`,
          createdAt: sendAt,
        deferredFrom: event.at,
          type: type9,
          channel,
          client,
          booking,
          text: localize(type9?.templates[channel], forChannel(ctx, channel, vars), {
            ru: `Ваша запись на ${vars.ru.date} в ${vars.ru.time} подтверждена.`,
            en: `Your booking on ${vars.en.date} at ${vars.en.time} is confirmed.`,
          }),
          fallbackLabel: { ru: 'Подтверждение записи', en: 'Booking confirmed' },
        });
        return;
      }
      if (event.to === 'cancelled_by_client' || event.to === 'cancelled_by_master') {
        if (!type4?.enabled) return;
        const channel = pickChannel(type4, hasApp);
        if (!channel) return;
        pushEntry(out, ctx, {
          idSuffix: `ev_${event.id}`,
          createdAt: sendAt,
        deferredFrom: event.at,
          type: type4,
          channel,
          client,
          booking,
          text: localize(type4.templates[channel], forChannel(ctx, channel, vars), {
            ru: `Ваша запись на ${vars.ru.date} в ${vars.ru.time} отменена.`,
            en: `Your booking on ${vars.en.date} at ${vars.en.time} was cancelled.`,
          }),
          fallbackLabel: { ru: 'Отмена записи', en: 'Booking cancelled' },
        });
        return;
      }
      if (event.to === 'no_show') {
        // F-05-031 п.2: статус, поставленный ПОСЛЕ начала визита, клиенту уже ничего не шлёт.
        if (event.at > booking.start) return;
        if (!type75?.enabled) return;
        const channel = pickChannel(type75, hasApp);
        if (!channel) return;
        pushEntry(out, ctx, {
          idSuffix: `ev_${event.id}`,
          createdAt: sendAt,
        deferredFrom: event.at,
          type: type75,
          channel,
          client,
          booking,
          text: localize(type75.templates[channel], forChannel(ctx, channel, vars), {
            ru: `Вы не пришли на запись ${vars.ru.date} в ${vars.ru.time}.`,
            en: `You missed your booking on ${vars.en.date} at ${vars.en.time}.`,
          }),
          fallbackLabel: { ru: 'Не пришёл', en: 'No-show' },
        });
      }
      return;
    }

    if (event.kind === 'moved') {
      if (!type74?.enabled || visitAlreadyStarted) return;
      const conditions = type74.conditions;
      const thresholdMin = conditions?.rescheduleThresholdMinutes ?? -1;
      const diffMin = event.prevStart ? Math.abs(dayjs(booking.start).diff(dayjs(event.prevStart), 'minute')) : 0;
      if (thresholdMin >= 0 && diffMin < thresholdMin) return;
      const source = conditions?.rescheduleSource ?? 'all';
      const actorIsClient = event.by === 'client';
      if (source === 'client' && !actorIsClient) return;
      if (source === 'staff' && actorIsClient) return;
      const channel = pickChannel(type74, hasApp);
      if (!channel) return;
      pushEntry(out, ctx, {
        idSuffix: `ev_${event.id}`,
        createdAt: sendAt,
        deferredFrom: event.at,
        type: type74,
        channel,
        client,
        booking,
        text: localize(type74.templates[channel], forChannel(ctx, channel, vars), {
          ru: `Запись изменена: теперь ${vars.ru.date} в ${vars.ru.time}.`,
          en: `Booking changed: now ${vars.en.date} at ${vars.en.time}.`,
        }),
        fallbackLabel: { ru: 'Изменение записи', en: 'Booking changed' },
      });
      return;
    }

    if (event.kind === 'deleted') {
      // F-05-030 п.1: удаление записи кем угодно тоже шлёт отмену.
      if (!type4?.enabled) return;
      const channel = pickChannel(type4, hasApp);
      if (!channel) return;
      pushEntry(out, ctx, {
        idSuffix: `ev_${event.id}`,
        createdAt: sendAt,
        deferredFrom: event.at,
        type: type4,
        channel,
        client,
        booking,
        text: localize(type4.templates[channel], forChannel(ctx, channel, vars), {
          ru: `Ваша запись на ${vars.ru.date} в ${vars.ru.time} отменена.`,
          en: `Your booking on ${vars.en.date} at ${vars.en.time} was cancelled.`,
        }),
        fallbackLabel: { ru: 'Отмена записи', en: 'Booking cancelled' },
      });
    }
  });

  return out;
}

/** Насколько вперёд показываем «Запланировано» (Ув11) */
const SCHEDULED_HORIZON_DAYS = 7;

const ACTIVE_STATUSES = new Set(['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed']);

/** ⭐ 30.09: напоминания в Telegram-бот — за сутки и за 2 часа до визита (сервер: telegram-reminders.ts, reminder24h/2h) */
const TELEGRAM_REMINDER_HOURS = [24, 2] as const;

/** Напоминание (тип 1, F-05-029) и запрос подтверждения (тип 73, F-05-028) — считаются от текущего времени */
function timeBasedBookingEntries(ctx: LiveLogContext): LogMessage[] {
  const out: LogMessage[] = [];
  const type1 = ctx.types.find((t) => t.code === 1);
  const type73 = ctx.types.find((t) => t.code === 73);

  ctx.core.bookings
    .filter((b) => b.businessId === ctx.businessId && !b.deletedAt && ACTIVE_STATUSES.has(b.status))
    .forEach((booking) => {
      const client = booking.clientId ? ctx.core.clients.find((c) => c.id === booking.clientId) : undefined;
      if (!client?.phone) return;
      const hasApp = !!client.appUserId;
      const override = ctx.overrides[booking.id];
      // Ув15: своё время напоминания у отдельной услуги (первая услуга записи) — важнее общего времени типа,
      // но слабее ручной правки этой записи (F-05-082). Пишет экран услуги через setServiceReminderHours.
      const firstServiceId = booking.services[0]?.serviceId;
      const serviceHours = firstServiceId !== undefined ? type1?.conditions?.serviceTimingHours?.[firstServiceId] : undefined;

      // Напоминание (тип 1) — F-05-029: своё время для Email, время меняется на конкретную запись
      if (type1?.enabled) {
        // Одно напоминание выбранным каналом за hoursBefore часов до визита
        const remind = (channel: NotifyChannel, hoursBefore: number, idSuffix: string) => {
          const plannedAt = dayjs(booking.start).subtract(hoursBefore, 'hour');
          // Ув12: напоминание на 07:30 перед визитом в 08:30 уходит в 09:00? — нет: после начала визита оно бессмысленно,
          // поэтому перенос тихими часами, упирающийся в начало визита, сообщение отменяет.
          const sendAt = dayjs(quietShift(quietHoursOf(ctx), plannedAt.format('YYYY-MM-DDTHH:mm')));
          const quietKilled = !sendAt.isBefore(dayjs(booking.start));
          // F-05-029 (проверка 2): запись создана позже момента напоминания — сообщение не создаётся вовсе
          // (то же правило, что у типа 73 в F-05-043). Момент напоминания и, при переносе, sendAt пересчитываются
          // от актуального booking.start на каждый рендер — движок стейтless, «уже запланированного» напоминания
          // не существует, поэтому перенос визита автоматически сдвигает напоминание на новое время (⚠ открытый
          // вопрос ТЗ закрыт этим решением: см. assumed в отчёте).
          const createdAfterReminderMoment = dayjs(booking.createdAt).isAfter(plannedAt);
          // Ув11: момент ещё не наступил — то же сообщение попадает в «Запланировано» (в пределах недели вперёд)
          const scheduled = sendAt.isAfter(ctx.now);
          if (
            quietKilled ||
            createdAfterReminderMoment ||
            (scheduled && !sendAt.isBefore(dayjs(ctx.now).add(SCHEDULED_HORIZON_DAYS, 'day'))) ||
            !sendAt.isAfter(dayjs(booking.start).subtract(48, 'hour'))
          )
            return;
          const vars = bookingVars(ctx, booking, client, sendAt.toDate());
          pushEntry(out, ctx, {
            idSuffix,
            createdAt: sendAt.format('YYYY-MM-DDTHH:mm'),
            deferredFrom: plannedAt.format('YYYY-MM-DDTHH:mm'),
            type: type1,
            channel,
            client,
            booking,
            scheduled,
            text: localize(type1.templates[channel], forChannel(ctx, channel, vars), {
              ru: `Напоминаем: ${vars.ru.date} в ${vars.ru.time} у вас ${vars.ru.service}.`,
              en: `Reminder: ${vars.en.date} at ${vars.en.time} you have ${vars.en.service}.`,
            }),
            fallbackLabel: { ru: 'Напоминание', en: 'Reminder' },
          });
        };

        // ⭐ 30.09: Telegram — только клиенту БЕЗ приложения, подключившему бота, за 24 ч и за 2 ч (как сервер
        // telegram-reminders.ts); с приложением ему уходит пуш, и в Telegram ничего не дублируется. Выключатель
        // Telegram у записи (override.telegramEnabled) — свой, не SMS; выключен — действует обычный порядок каналов.
        const telegramScenario = type1.availableChannels.includes('telegram')
          ? (type1.channels.find((c) => c.channel === 'telegram')?.scenario ?? 'off')
          : 'off';
        const viaTelegram = !hasApp && telegramScenario !== 'off' && telegramLinked(ctx, client) && override?.telegramEnabled !== false;
        if (viaTelegram) {
          for (const hours of TELEGRAM_REMINDER_HOURS) remind('telegram', hours, `rm_tg${hours}_${booking.id}`);
        } else {
          const channel = pickChannel(type1, hasApp, false);
          if (channel) {
            const typeHours = serviceHours ?? type1.conditions?.timingHours ?? 1;
            const hoursBefore =
              channel === 'email'
                ? (override?.emailTimingHours ?? serviceHours ?? type1.conditions?.emailTimingHours ?? typeHours)
                : channel === 'push' || channel === 'brandedApp'
                  ? (override?.pushTimingHours ?? typeHours)
                  : (override?.smsTimingHours ?? typeHours);
            // ⭐ F-00-120: пуш выключается своей ручкой (override.pushEnabled), не общим смс-выключателем.
            const channelOff =
              (channel === 'sms' && override?.smsEnabled === false) ||
              (channel === 'email' && override?.emailEnabled === false) ||
              ((channel === 'push' || channel === 'brandedApp') && override?.pushEnabled === false);
            if (!channelOff) remind(channel, hoursBefore, `rm_${booking.id}`);
          }
        }
      }

      // Запрос подтверждения (тип 73) — F-05-028: только записям в статусе «Ожидание»
      if (type73?.enabled && booking.status === 'awaiting_confirmation') {
        const channel = pickChannel(type73, hasApp, telegramLinked(ctx, client));
        if (channel) {
          const conditions = type73.conditions;
          const plannedAt = conditions?.useSpecificTime && conditions.specificTime
            ? dayjs(booking.start).subtract(1, 'day').hour(Number(conditions.specificTime.slice(0, 2))).minute(Number(conditions.specificTime.slice(3, 5)))
            : dayjs(booking.start).subtract(conditions?.timingHours ?? 24, 'hour');
          const sendAt = dayjs(quietShift(quietHoursOf(ctx), plannedAt.format('YYYY-MM-DDTHH:mm')));
          const scheduled = sendAt.isAfter(ctx.now);
          const createdAfterMoment = dayjs(booking.createdAt).isAfter(plannedAt);
          if (
            !createdAfterMoment &&
            sendAt.isBefore(dayjs(booking.start)) &&
            (!scheduled || sendAt.isBefore(dayjs(ctx.now).add(SCHEDULED_HORIZON_DAYS, 'day'))) &&
            sendAt.isAfter(dayjs(booking.start).subtract(72, 'hour'))
          ) {
            const vars = bookingVars(ctx, booking, client, sendAt.toDate());
            pushEntry(out, ctx, {
              idSuffix: `cf_${booking.id}`,
              createdAt: sendAt.format('YYYY-MM-DDTHH:mm'),
              deferredFrom: plannedAt.format('YYYY-MM-DDTHH:mm'),
              type: type73,
              channel,
              client,
              booking,
              scheduled,
              text: localize(type73.templates[channel], forChannel(ctx, channel, vars), {
                ru: `Подтвердите визит ${vars.ru.date} в ${vars.ru.time}.`,
                en: `Please confirm your visit on ${vars.en.date} at ${vars.en.time}.`,
              }),
              fallbackLabel: { ru: 'Запрос подтверждения', en: 'Confirmation requested' },
            });
          }
        }
      }
    });

  return out;
}

/** Приглашение недошедшим (тип 72, F-05-032) — после отмены/неявки без будущей записи */
function invitesForMissed(ctx: LiveLogContext, events: BookingEvent[]): LogMessage[] {
  const out: LogMessage[] = [];
  const type72 = ctx.types.find((t) => t.code === 72);
  if (!type72?.enabled) return out;
  const conditions = type72.conditions;
  const statusFilter = conditions?.inviteStatusFilter ?? 'all';
  const afterHours = conditions?.inviteAfterHours ?? 0;

  events
    .filter((e) => e.kind === 'status' && (e.to === 'cancelled_by_client' || e.to === 'cancelled_by_master' || e.to === 'no_show'))
    .forEach((event) => {
      const isNoShow = event.to === 'no_show';
      if (statusFilter === 'cancelled' && isNoShow) return;
      if (statusFilter === 'noShow' && !isNoShow) return;
      const booking = ctx.core.bookings.find((b) => b.id === event.bookingId);
      if (!booking?.clientId) return;
      const client = ctx.core.clients.find((c) => c.id === booking.clientId);
      if (!client?.phone) return;
      const plannedAt = dayjs(event.at).add(afterHours, 'hour');
      const sendAt = dayjs(quietShift(quietHoursOf(ctx), plannedAt.format('YYYY-MM-DDTHH:mm')));
      if (sendAt.isAfter(ctx.now)) return;
      // Клиенту с будущей записью приглашение не уходит (F-05-032 п.2)
      const hasFutureBooking = ctx.core.bookings.some(
        (b) => b.clientId === client.id && b.businessId === ctx.businessId && !b.deletedAt && b.id !== booking.id && b.start > ctx.now.toISOString().slice(0, 16) && ACTIVE_STATUSES.has(b.status),
      );
      if (hasFutureBooking) return;
      const hasApp = !!client.appUserId;
      const channel = pickChannel(type72, hasApp);
      if (!channel) return;
      pushEntry(out, ctx, {
        idSuffix: `inv_${event.id}`,
        createdAt: sendAt.format('YYYY-MM-DDTHH:mm'),
        deferredFrom: plannedAt.format('YYYY-MM-DDTHH:mm'),
        type: type72,
        channel,
        client,
        booking,
        text: localize(type72.templates[channel], forChannel(ctx, channel, bookingVars(ctx, booking, client, sendAt.toDate())), {
          ru: 'Заметили, что вы не смогли прийти. Запишитесь снова.',
          en: 'We noticed you could not make it. Book again.',
        }),
        fallbackLabel: { ru: 'Приглашение', en: 'Invite' },
      });
    });

  return out;
}

/**
 * Приглашение на повторный визит (тип 55, F-05-037) — через N дней после визита «пришёл» на ту же
 * услугу. Проверка идёт по каждой услуге отдельно (своего срока у услуги пока нет — см.
 * `qa/requests/notify.md`, «services — срок повторного визита у услуги», поэтому все услуги визита
 * используют общий срок локации/записи), но если у клиента в один день «созрели» сразу НЕСКОЛЬКО
 * визитов (разные услуги, разные посещения), это ОДНО сообщение с перечнем услуг, а не N разных —
 * группируем по (клиент, дата срабатывания).
 */
function winbackEntries(ctx: LiveLogContext): LogMessage[] {
  const out: LogMessage[] = [];
  const type55 = ctx.types.find((t) => t.code === 55);
  if (!type55?.enabled) return out;
  const days = type55.conditions?.winbackAfterDays ?? 14;

  const arrived = ctx.core.bookings.filter((b) => b.businessId === ctx.businessId && b.status === 'arrived' && !b.deletedAt);
  interface Due {
    booking: Booking;
    client: Client;
    dueAt: ReturnType<typeof dayjs>;
    serviceNames: LocalizedText[];
  }
  const due: Due[] = [];
  arrived.forEach((booking) => {
    if (!booking.clientId) return;
    const client = ctx.core.clients.find((c) => c.id === booking.clientId);
    if (!client?.phone) return;
    const dueAt = dayjs(booking.start).add(days, 'day');
    if (dueAt.isAfter(ctx.now)) return;
    const serviceIds = new Set(booking.services.map((l) => l.serviceId));
    const rebooked = ctx.core.bookings.some(
      (b) =>
        b.clientId === client.id &&
        b.id !== booking.id &&
        !b.deletedAt &&
        b.start > booking.start &&
        b.services.some((l) => serviceIds.has(l.serviceId)),
    );
    if (rebooked) return;
    const serviceNames = booking.services
      .map((l) => ctx.core.services.find((s) => s.id === l.serviceId)?.name)
      .filter((n): n is LocalizedText => Boolean(n));
    due.push({ booking, client, dueAt, serviceNames });
  });

  // Группируем по клиенту и дню срабатывания (F-05-037 «совпали сроки двух услуг → одно сообщение с обеими»)
  const groups = new Map<string, Due[]>();
  due.forEach((d) => {
    const key = `${d.client.id}_${d.dueAt.format('YYYY-MM-DD')}`;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  });

  groups.forEach((group) => {
    const first = group[0];
    const client = first.client;
    const dueAt = group.reduce((min, d) => (d.dueAt.isBefore(min) ? d.dueAt : min), first.dueAt);
    const servicesIn = (lang: NotifyLanguage) =>
      Array.from(new Set(group.flatMap((d) => d.serviceNames.map((n) => n[lang] || n.ru)))).join(', ');
    const services = servicesIn('ru');
    const hasApp = !!client.appUserId;
    const channel = pickChannel(type55, hasApp);
    if (!channel) return;
    const base = bookingVars(ctx, first.booking, client, dueAt.toDate());
    const vars: VarsByLang = {
      ru: { ...base.ru, service: servicesIn('ru') || base.ru.service },
      en: { ...base.en, service: servicesIn('en') || base.en.service },
      hy: { ...base.hy, service: servicesIn('hy') || base.hy.service },
    };
    const text = localize(type55.templates[channel], forChannel(ctx, channel, vars), {
      ru: `Давно вас не было! Ждём снова${services ? ` на ${services}` : ''}.`,
      en: `It has been a while! Come back soon${services ? ` for ${services}` : ''}.`,
    });
    const sentLanguage = sendLanguage(ctx);
    out.push({
      id: `lg_live_wb_${client.id}_${dueAt.format('YYYY-MM-DD')}`,
      businessId: ctx.businessId,
      createdAt: quietShift(quietHoursOf(ctx), dueAt.format('YYYY-MM-DDTHH:mm')),
      typeCode: type55.code,
      typeLabel: type55.name,
      channel,
      status: statusFor(`wb_${client.id}_${dueAt.format('YYYY-MM-DD')}`, channel),
      contact: channel === 'email' ? client.email || client.phone : client.phone,
      text,
      clientId: client.id,
      bookingId: first.booking.id,
      sentLanguage,
      ...costOf(channel, text[sentLanguage] || text.ru),
    });
  });

  return out;
}

/** Поздравление с днём рождения (тип 3, F-05-034) */
function birthdayEntries(ctx: LiveLogContext): LogMessage[] {
  const out: LogMessage[] = [];
  const type3 = ctx.types.find((t) => t.code === 3);
  if (!type3?.enabled) return out;
  const conditions = type3.conditions;
  const daysBefore = conditions?.birthdayMode === 'daysBefore' ? (conditions.birthdayDaysBefore ?? 3) : 0;
  const [hh, mm] = (conditions?.birthdayTimeOfDay ?? '10:00').split(':').map(Number);

  ctx.core.clients
    .filter((c) => c.businessId === ctx.businessId && c.birthday && !c.deletedAt)
    .forEach((client) => {
      const bday = dayjs(client.birthday);
      const occurrence = bday.year(ctx.now.getFullYear()).subtract(daysBefore, 'day').hour(hh || 0).minute(mm || 0);
      const sendAt = occurrence.isAfter(ctx.now) ? occurrence.subtract(1, 'year') : occurrence;
      // Показываем только последнее случившееся поздравление (не копим историю прошлых лет)
      if (dayjs(ctx.now).diff(sendAt, 'day') > 3) return;
      const hasApp = !!client.appUserId;
      const channel = pickChannel(type3, hasApp);
      if (!channel) return;
      const varsOf = (lang: NotifyLanguage) => ({ ...businessVars(ctx, lang), ...clientVars(client) });
      const text = localize(type3.templates[channel], forChannel(ctx, channel, { ru: varsOf('ru'), en: varsOf('en'), hy: varsOf('hy') }), {
        ru: `С днём рождения, ${client.name}!`,
        en: `Happy birthday, ${client.name}!`,
      });
      const sentLanguage = sendLanguage(ctx);
      out.push({
        id: `lg_live_bd_${client.id}_${sendAt.year()}`,
        businessId: ctx.businessId,
        createdAt: quietShift(quietHoursOf(ctx), sendAt.format('YYYY-MM-DDTHH:mm')),
        typeCode: type3.code,
        typeLabel: type3.name,
        channel,
        status: statusFor(`bd_${client.id}`, channel),
        contact: channel === 'email' ? client.email || client.phone : client.phone,
        text,
        clientId: client.id,
        sentLanguage,
        ...costOf(channel, text[sentLanguage] || text.ru),
      });
    });

  return out;
}

const ADMIN_ROLES = new Set<Staff['role']>(['owner', 'admin']);

/** Администратор локации, не равный исполнителю действия (F-05-045: сама создавшая администратор не получает) */
function pickAdmin(ctx: LiveLogContext, locationId: Id, excludeStaffId?: Id): Staff | undefined {
  return ctx.core.staff.find(
    (s) => s.businessId === ctx.businessId && s.locationIds.includes(locationId) && ADMIN_ROLES.has(s.role) && s.id !== excludeStaffId,
  );
}

function staffTemplate(
  ctx: LiveLogContext,
  code: number,
  vars: VarsByLang,
  fallback: LocalizedText,
): { type: NotificationType | undefined; text: LocalizedText } {
  const type = ctx.types.find((t) => t.code === code);
  const channel: NotifyChannel = 'adminApp';
  return { type, text: localize(type?.templates[channel], vars, fallback) };
}

/**
 * Уведомления администратору (типы 10, 56, 41, 12) и мастеру (типы 11, 57, 42, 13, 76) — F-05-044…053,
 * F-05-138. Канал — «Приложение администратора» (пуш в приложение для бизнеса), как у Altegio по
 * умолчанию; SMS/Email этим типам в демо не считаем (агрегатор не подключён — F-05-048/054 то же).
 */
function adminStaffEntries(ctx: LiveLogContext, events: BookingEvent[]): LogMessage[] {
  const out: LogMessage[] = [];

  events.forEach((event) => {
    const booking = ctx.core.bookings.find((b) => b.id === event.bookingId);
    if (!booking) return;
    const client = booking.clientId ? ctx.core.clients.find((c) => c.id === booking.clientId) : undefined;
    const baseVars = bookingVars(ctx, booking, client, event.at);
    const viaWidget = booking.source === 'app' || booking.source === 'link' || booking.source === 'widget';
    const actorIsClient = event.by === 'client';
    const masterName = ctx.core.staff.find((s) => s.id === booking.staffId)?.name ?? '';
    // F-05-139: сообщения уходят на контакты записавшего клиента, но в тексте виден и посетитель, если он есть.
    const clientDisplayName = booking.visitorName ? `${client?.name ?? ''} → ${booking.visitorName}` : (client?.name ?? '');
    const contactLabel = client ? `${clientDisplayName} (${client.phone})` : masterName;
    // Администратору и мастеру — полное имя клиента (и посетителя), а не только имя, как в приветствии клиенту
    const withClient = (v: Record<string, string>) => ({ ...v, clientName: clientDisplayName || '—' });
    const vars: VarsByLang = { ru: withClient(baseVars.ru), en: withClient(baseVars.en), hy: withClient(baseVars.hy) };
    const sentLanguage = sendLanguage(ctx);

    const pushToAdmin = (code: number, fallback: LocalizedText, exclude?: Id) => {
      const admin = pickAdmin(ctx, booking.locationId, exclude);
      if (!admin) return; // нет второго администратора локации — некому уходить (F-05-045)
      const { type, text } = staffTemplate(ctx, code, vars, fallback);
      if (type && !type.enabled) return;
      out.push({
        id: `lg_live_adm_${code}_${event.id}`,
        businessId: ctx.businessId,
        createdAt: event.at,
        typeCode: code,
        typeLabel: type?.name ?? fallback,
        channel: 'adminApp',
        status: statusFor(`adm_${code}_${event.id}`),
        contact: admin.phone,
        text,
        staffId: admin.id,
        bookingId: booking.id,
        sentLanguage,
        costAmd: 0,
      });
    };

    const pushToStaff = (code: number, fallback: LocalizedText) => {
      const staff = ctx.core.staff.find((s) => s.id === booking.staffId);
      if (!staff) return;
      const { type, text } = staffTemplate(ctx, code, vars, fallback);
      if (type && !type.enabled) return;
      out.push({
        id: `lg_live_stf_${code}_${event.id}`,
        businessId: ctx.businessId,
        createdAt: event.at,
        typeCode: code,
        typeLabel: type?.name ?? fallback,
        channel: 'adminApp',
        status: statusFor(`stf_${code}_${event.id}`),
        contact: staff.phone,
        text,
        staffId: staff.id,
        bookingId: booking.id,
        sentLanguage,
        costAmd: 0,
      });
    };

    if (event.kind === 'created') {
      if (viaWidget) {
        // F-05-044 (тип 10) и F-05-049 (тип 11): онлайн-запись — администратору и мастеру.
        pushToAdmin(10, { ru: `Новая запись: ${contactLabel}, ${vars.ru.service}, ${vars.ru.date} ${vars.ru.time}.`, en: `New booking: ${contactLabel}, ${vars.en.service}, ${vars.en.date} ${vars.en.time}.` });
        pushToStaff(11, { ru: `Новая запись: ${contactLabel}, ${vars.ru.service}, ${vars.ru.date} ${vars.ru.time}.`, en: `New booking: ${contactLabel}, ${vars.en.service}, ${vars.en.date} ${vars.en.time}.` });
      } else if (!actorIsClient) {
        // F-05-045 (тип 56) и F-05-050 (тип 57): запись в журнале — другим администраторам и мастеру.
        pushToAdmin(
          56,
          { ru: `Новая запись: ${contactLabel}, ${vars.ru.service}, ${vars.ru.date} ${vars.ru.time}.`, en: `New booking: ${contactLabel}, ${vars.en.service}, ${vars.en.date} ${vars.en.time}.` },
          event.by as Id,
        );
        if (booking.staffId !== event.by) {
          pushToStaff(57, { ru: `Новая запись: ${contactLabel}, ${vars.ru.service}, ${vars.ru.date} ${vars.ru.time}.`, en: `New booking: ${contactLabel}, ${vars.en.service}, ${vars.en.date} ${vars.en.time}.` });
        }
      }
      return;
    }

    if (event.kind === 'moved') {
      // F-05-046 (тип 41) — только запись, изначально созданная через виджет; F-05-051 (тип 42) — всегда.
      if (viaWidget) {
        pushToAdmin(41, { ru: `Запись перенесена: ${contactLabel}, ${vars.ru.date} ${vars.ru.time}.`, en: `Booking rescheduled: ${contactLabel}, ${vars.en.date} ${vars.en.time}.` });
      }
      pushToStaff(42, { ru: `Запись перенесена: ${contactLabel}, ${vars.ru.date} ${vars.ru.time}.`, en: `Booking rescheduled: ${contactLabel}, ${vars.en.date} ${vars.en.time}.` });
      return;
    }

    if (event.kind === 'deleted' || (event.kind === 'status' && (event.to === 'cancelled_by_client' || event.to === 'cancelled_by_master'))) {
      // F-05-047 (тип 12) — отменил клиент через виджет; F-05-052 (тип 13) — отменил кто угодно.
      if (actorIsClient) {
        pushToAdmin(12, { ru: `Запись удалена клиентом: ${contactLabel}, ${vars.ru.date} ${vars.ru.time}.`, en: `Booking cancelled by client: ${contactLabel}, ${vars.en.date} ${vars.en.time}.` });
      }
      pushToStaff(13, { ru: `Запись удалена: ${contactLabel}, ${vars.ru.date} ${vars.ru.time}.`, en: `Booking removed: ${contactLabel}, ${vars.en.date} ${vars.en.time}.` });
      return;
    }

    if (event.kind === 'status' && event.to === 'no_show') {
      // F-05-053 (тип 76) — мастеру: слот освободился.
      pushToStaff(76, { ru: `Клиент не пришёл — слот ${vars.ru.date} ${vars.ru.time} свободен.`, en: `Client no-show — the ${vars.en.date} ${vars.en.time} slot is free.` });
    }
  });

  return out;
}

/** Собрать все выведенные (не хранимые отдельно) записи журнала для бизнеса — вызывается из listLog() */
export function deriveLiveLogEntries(ctx: LiveLogContext): LogMessage[] {
  const events = (ctx.core.bookingEvents ?? []).filter((e) => e.businessId === ctx.businessId);
  const entries = [
    ...eventDrivenEntries(ctx, events),
    ...timeBasedBookingEntries(ctx),
    ...invitesForMissed(ctx, events),
    ...winbackEntries(ctx),
    ...birthdayEntries(ctx),
    ...adminStaffEntries(ctx, events),
  ];
  // F-05-090: применяем настройки клиента разом ко всем клиентским строкам (проще и надёжнее, чем
  // разбрасывать проверку по каждой из функций выше) — не трогает строки без clientId (админу/сотруднику).
  return entries.filter((e) => {
    if (!e.clientId || e.typeCode === undefined) return true;
    return clientAllows(ctx, e.clientId, e.typeCode, e.channel);
  });
}

export type { LiveLogContext };

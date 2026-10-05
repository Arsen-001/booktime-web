'use client';

/**
 * «Предложить окно» прямо из «Найти окно» и повторное напоминание о заявке без ответа (⭐ 29.09.2026). Раздел journal.
 *
 * Предложение окна собирает тех, кто уже ждёт такое время:
 *   · лист ожидания бизнеса — ОДИН (владелец, 30.09.2026): заявки сотрудников, «Сообщить, когда освободится» из приложения
 *     клиента (F-00-101/102) и из виджета (F-03-086) — услуга, мастер («любой» тоже), день и время заявки; заявка получает
 *     отметку «Уведомлён», вставший из приложения — пуш «Освободилось время» в ленту, остальные — SMS;
 *   · горящее окно (F-00-103) — пуш подписчикам мастера и салона в приложении (как новость, F-00-115), только на сегодня,
 *     со скидкой из «Продвижения», если она задана.
 * Люди без повторов по телефону / аккаунту. Каждое сообщение — строкой в журнале уведомлений (/biz/notifications/log,
 * тот же `s.log`, что пишет sendOneOffMessage), само предложение — в `journal.slotOffers` («уже предлагали в HH:MM»).
 *
 * Напоминание о заявке: заявка (awaiting_confirmation) ждёт ответа REQUEST_REMINDER_AFTER_MIN минут — мастеру приходит
 * повторное уведомление в колокольчик, дальше не чаще раза в N минут и не больше REQUEST_REMINDER_MAX раз. Журнал
 * опрашивает remindPendingRequests раз в 20 с (как снятие неоплаченных, F-01-205); запись идемпотентна — шаг
 * напоминания по заявке считается от предыдущего, повтор опроса ничего не пишет.
 *
 * Режим api (06.10.2026): напоминания ставит воркер сервера (jobs/notify-staff-request-reminders.ts — то же правило:
 * 30 мин, до 3 раз; пуш мастеру и администраторам, строка в колокольчике); remindPendingRequests тут ничего не пишет,
 * «напомнили в HH:MM» читается с сервера (listRequestReminders). Предложение окна — пока на моке.
 */
import type { Id, ISODate, ISODateTime, LocalizedText, TimeHM } from '@/domain/core';
import type { LogMessage } from '@/domain/notify';
import type { RequestReminder, SlotOffer, SlotOfferChannel } from '@/domain/journal';
import { waitlistWantsSlot } from '@/domain/resources';
import { mutateArea, readArea, readCore } from '@/api/area';
import { http, isApiMode } from '@/api/http';
import { pushWaitlistSlotTx } from '@/api/client';
import { waitlistTx } from '@/api/resources';
import { request } from '@/api/request';
import { confirmDeadlineOf } from '@/areas/journal/lib/confirmDeadline';
import { costOf } from '@/areas/notify/lib/liveLog';
import { dayjs, diffMinutes, nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';

/** Через сколько минут без ответа напомнить о заявке (и шаг между повторами) — своей настройки в «Цифровом журнале» нет */
export const REQUEST_REMINDER_AFTER_MIN = 30;
/** Больше трёх напоминаний на одну заявку — уже шум в колокольчике */
export const REQUEST_REMINDER_MAX = 3;

export interface SlotOfferTarget {
  businessId: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate;
  time: TimeHM;
  /**
   * Длина свободного окна, минут (от `time`). Есть — предложение получает только тот, чья услуга в окно помещается
   * (сценарии 30.09: окно 30 мин ушло ждавшей услугу на 45 мин). Нет — окно считается подобранным под услугу.
   */
  freeMin?: number;
}

export interface SlotOfferPreview {
  /** Сколько человек получит предложение по каждому каналу (без повторов: сначала лист ожидания, потом «сообщить», потом подписчики) */
  counts: Record<SlotOfferChannel, number>;
  /** Горящее окно — только на сегодня (F-00-103: «свободно сегодня») */
  hotAvailable: boolean;
  hotDiscountPercent?: number;
  /** Это окно уже предлагали — когда (последний раз) */
  offeredAt?: ISODateTime;
}

interface Recipient {
  channel: SlotOfferChannel;
  /** Какое окно человек получает — самое раннее из подходящих ему (одно сообщение на человека) */
  target: SlotOfferTarget;
  name: string;
  phone?: string;
  appUserId?: Id;
  /** Откуда человек: заявка листа ожидания (отметить «Уведомлён») или подписчик */
  ref: { kind: 'waitlist'; id: Id } | { kind: 'subscriber' };
}

/**
 * Все, кому уйдут предложения окон, без повторов — чистое чтение срезов (внутри request()). Окна — по времени, раньше
 * первым: человек, которому подходят несколько окон, получает одно сообщение про самое раннее.
 */
function collectRecipients(targets: SlotOfferTarget[]): Recipient[] {
  const seenPhones = new Set<string>();
  const seenUsers = new Set<Id>();
  const seenRefs = new Set<Id>();
  const out: Recipient[] = [];
  const takePhone = (phone: string | undefined) => {
    const key = normalizePhone(phone ?? '') ?? phone ?? '';
    if (key && seenPhones.has(key)) return false;
    if (key) seenPhones.add(key);
    return true;
  };
  const businessWaitlist = waitlistTx.entries();
  const day = today();
  const core = readCore();
  const durationOf = (serviceId: Id): number => core.services.find((x) => x.id === serviceId)?.durationMin ?? 0;
  for (const t of targets) {
    // Окно короче услуги — никому его не предлагаем: записаться в него всё равно нельзя
    if (t.freeMin !== undefined && durationOf(t.serviceId) > t.freeMin) continue;
    for (const e of businessWaitlist) {
      if (seenRefs.has(e.id) || !waitlistWantsSlot(e, t, day)) continue;
      if (e.appUserId && seenUsers.has(e.appUserId)) continue;
      if (!takePhone(e.clientPhone)) continue;
      seenRefs.add(e.id);
      if (e.appUserId) seenUsers.add(e.appUserId);
      out.push({ channel: 'waitlist', target: t, name: e.clientName, phone: e.clientPhone, appUserId: e.appUserId, ref: { kind: 'waitlist', id: e.id } });
    }
  }
  const hotTarget = targets.find((t) => t.date === today());
  if (hotTarget) {
    // Подписчики мастера и салона, не приглушившие новости (F-00-115), — как у countNewsSubscribers
    const staffIds = new Set(readCore().staff.filter((s) => s.businessId === hotTarget.businessId).map((s) => s.id));
    for (const f of readArea('client').favorites ?? []) {
      if (f.newsMuted || !(f.targetId === hotTarget.businessId || staffIds.has(f.targetId)) || seenUsers.has(f.appUserId)) continue;
      seenUsers.add(f.appUserId);
      out.push({ channel: 'hot', target: hotTarget, name: '', appUserId: f.appUserId, ref: { kind: 'subscriber' } });
    }
  }
  return out;
}

const byTime = (a: SlotOfferTarget, b: SlotOfferTarget) => (a.date + a.time).localeCompare(b.date + b.time);

/** Кому уйдёт предложение окон — для подтверждения «отправим N людям» */
export function previewSlotOffer(targets: SlotOfferTarget[]): Promise<SlotOfferPreview> {
  return request(() => {
    const sorted = targets.slice().sort(byTime);
    const counts: Record<SlotOfferChannel, number> = { waitlist: 0, hot: 0 };
    for (const r of collectRecipients(sorted)) counts[r.channel] += 1;
    const offers = readArea('journal').slotOffers ?? [];
    const offeredAt = offers.find((o) => sorted.some((t) => o.businessId === t.businessId && o.staffId === t.staffId && o.date === t.date && o.time === t.time))?.createdAt;
    const businessId = sorted[0]?.businessId ?? '';
    return {
      counts,
      hotAvailable: sorted.some((t) => t.date === today()),
      hotDiscountPercent: readArea('client').promotionSettings?.[businessId]?.hotSlotDiscountPercent,
      offeredAt,
    };
  });
}

/** Когда предлагали окна дня: `${staffId}|${time}` → время последнего предложения (отметка «предложено» в «Найти окно») */
export function listSlotOffers(businessId: Id, date: ISODate): Promise<Record<string, ISODateTime>> {
  return request(() => {
    const out: Record<string, ISODateTime> = {};
    for (const o of readArea('journal').slotOffers ?? []) {
      if (o.businessId !== businessId || o.date !== date) continue;
      const key = `${o.staffId}|${o.time}`;
      if (!out[key] || o.createdAt > out[key]) out[key] = o.createdAt;
    }
    return out;
  });
}

export interface OfferSlotResult {
  offers: SlotOffer[];
  /** Сколько человек получили предложение */
  sent: number;
}

/**
 * Предложить окна выбранным каналам: сообщения в журнал уведомлений, пуши в приложение, отметки «уведомлён»,
 * след каждого окна в slotOffers. Одно окно — массив из одного.
 */
export function offerSlots(targets: SlotOfferTarget[], channels: SlotOfferChannel[]): Promise<OfferSlotResult> {
  return request(() => {
    const sorted = targets.slice().sort(byTime);
    const businessId = sorted[0]?.businessId ?? '';
    const core = readCore();
    const staffName = (id: Id) => core.staff.find((s) => s.id === id)?.name ?? '';
    const serviceText = (id: Id, lang: 'ru' | 'en') => {
      const name = core.services.find((s) => s.id === id)?.name;
      return (name?.[lang] || name?.ru) ?? '';
    };
    const wanted = new Set(channels);
    const recipients = collectRecipients(sorted).filter((r) => wanted.has(r.channel));
    const discount = wanted.has('hot') ? readArea('client').promotionSettings?.[businessId]?.hotSlotDiscountPercent : undefined;
    const now = nowDateTime();

    const log: LogMessage[] = [];
    const personal = recipients.filter((r) => r.channel !== 'hot');
    for (const r of personal) {
      const t = r.target;
      const channel = r.appUserId ? 'push' : 'sms';
      const day = dayjs(t.date).format('DD.MM');
      const text: LocalizedText = {
        ru: `${r.name ? `${r.name}, у` : 'У'} ${staffName(t.staffId)} освободилось окно ${day} в ${t.time} — ${serviceText(t.serviceId, 'ru')}. Записать вас?`,
        en: `${r.name ? `${r.name}, ` : ''}${staffName(t.staffId)} has a free slot on ${day} at ${t.time} — ${serviceText(t.serviceId, 'en')}. Shall we book you?`,
      };
      log.push({
        id: newId('lg'),
        businessId,
        createdAt: now,
        typeLabel: { ru: 'Предложение окна', en: 'Slot offer' },
        channel,
        status: 'sent',
        contact: r.phone ?? '',
        text,
        staffId: t.staffId,
        ...costOf(channel, text.ru),
      });
    }
    // Горящие окна — одним пушем подписчикам: сегодняшние времена по порядку (до пяти), скидка из «Продвижения»
    const subscribers = recipients.filter((r) => r.channel === 'hot');
    const hotSlots = sorted.filter((t) => t.date === today());
    const hotList = (lang: 'ru' | 'en') =>
      hotSlots
        .slice(0, 5)
        .map((t) => `${t.time} ${serviceText(t.serviceId, lang)} · ${staffName(t.staffId)}`)
        .join('; ');
    const hotText: LocalizedText = {
      ru: `Горящ${hotSlots.length > 1 ? 'ие окна' : 'ее окно'} сегодня: ${hotList('ru')}${discount ? ` — скидка ${discount}%` : ''}`,
      en: `Hot slot${hotSlots.length > 1 ? 's' : ''} today: ${hotList('en')}${discount ? ` — ${discount}% off` : ''}`,
    };
    if (subscribers.length > 0) {
      // Одна строка на пуш подписчикам — как «Рассылка» в журнале: получатель — число людей
      log.push({
        id: newId('lg'),
        businessId,
        createdAt: now,
        typeLabel: { ru: 'Горящее окно', en: 'Hot slot' },
        channel: 'push',
        status: 'sent',
        contact: String(subscribers.length),
        text: hotText,
        costAmd: 0,
      });
    }

    const offers: SlotOffer[] = sorted.map((t) => ({
      id: newId('so'),
      businessId,
      staffId: t.staffId,
      serviceId: t.serviceId,
      date: t.date,
      time: t.time,
      channels,
      recipients: recipients.filter((r) => r.target === t || (r.channel === 'hot' && t.date === today())).length,
      hotDiscountPercent: discount,
      createdAt: now,
    }));

    if (log.length > 0) {
      mutateArea('notify', (s) => {
        s.log[businessId] = [...log, ...(s.log[businessId] ?? [])].slice(0, 500);
      });
    }
    // Отметка «Уведомлён» — одна на заявку, видна и на /biz/waitlist, и в панели журнала, и у клиента в приложении
    waitlistTx.markNotified(personal.flatMap((r) => (r.ref.kind === 'waitlist' ? [r.ref.id] : [])), now);
    // Вставшим из приложения — «Освободилось время» в ленту (с временем и услугой: кнопка «Записаться» сразу на это окно)
    for (const r of personal) if (r.appUserId) pushWaitlistSlotTx([r.appUserId], r.target, now);
    if (subscribers.length > 0) {
      mutateArea('client', (s) => {
        for (const r of subscribers) {
          if (!r.appUserId) continue;
          s.notifications.push({ id: newId('ntf'), appUserId: r.appUserId, kind: 'broadcast', businessId, params: { text: hotText.ru }, createdAt: now });
        }
      });
    }
    mutateArea('journal', (s) => {
      s.slotOffers = [...offers, ...(s.slotOffers ?? [])].slice(0, 200);
    });
    return { offers, sent: recipients.length };
  });
}

// ─────────────────────────── Напоминание о заявке без ответа ───────────────────────────

/**
 * Поставить напоминания по заявкам, которые ждут ответа дольше N минут (от создания или от прошлого напоминания).
 * Возвращает только НОВЫЕ напоминания — журнал показывает по ним тост; нечего напоминать — срез не трогается.
 */
export function remindPendingRequests(businessId: Id): Promise<RequestReminder[]> {
  if (isApiMode()) return Promise.resolve([]);
  return request(() => {
    const now = nowDateTime();
    const existing = (readArea('journal').requestReminders ?? []).filter((r) => r.businessId === businessId);
    const fresh: RequestReminder[] = [];
    for (const b of readCore().bookings) {
      if (b.businessId !== businessId || b.deletedAt || b.status !== 'awaiting_confirmation') continue;
      if (b.start <= now) continue; // визит уже начался — напоминать поздно
      const mine = existing.filter((r) => r.bookingId === b.id);
      const last = mine.reduce<RequestReminder | undefined>((a, r) => (!a || r.step > a.step ? r : a), undefined);
      if (last && last.step >= REQUEST_REMINDER_MAX) continue;
      if (diffMinutes(last?.at ?? b.createdAt, now) < REQUEST_REMINDER_AFTER_MIN) continue;
      fresh.push({ id: newId('rr'), businessId, bookingId: b.id, step: (last?.step ?? 0) + 1, at: now, deadline: confirmDeadlineOf(b) });
    }
    if (fresh.length > 0) {
      mutateArea('journal', (s) => {
        s.requestReminders = [...fresh, ...(s.requestReminders ?? [])].slice(0, 300);
      });
    }
    return fresh;
  });
}

/** Когда последний раз напомнили о каждой заявке бизнеса: bookingId → время (строка панели «напомнили в HH:MM») */
export function listRequestReminders(businessId: Id): Promise<Record<Id, ISODateTime>> {
  // Режим api: напоминания ставит воркер сервера (jobs/notify-staff-request-reminders.ts) — читаем его отметки
  if (isApiMode()) return http('GET', `/v1/biz/${businessId}/notify/request-reminders`);
  return request(() => {
    const out: Record<Id, ISODateTime> = {};
    for (const r of readArea('journal').requestReminders ?? []) {
      if (r.businessId === businessId && (!out[r.bookingId] || r.at > out[r.bookingId])) out[r.bookingId] = r.at;
    }
    return out;
  });
}

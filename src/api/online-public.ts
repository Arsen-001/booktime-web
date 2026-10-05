'use client';

/**
 * Онлайн-запись для публичных страниц (/b/<slug>, окно записи, карточка места в приложении клиента): только то,
 * что зовут эти страницы. В режиме api — запрос к серверу; в демо — полный '@/api/online' догружается отдельным
 * куском (viaMock), поэтому страница клиента не тянет код кабинета и моковой базы разделов. Те же функции
 * реэкспортирует '@/api/online' — экраны кабинета импортируют оттуда, как раньше.
 */
import { isApiMode } from '@/api/http';
import * as OnlineServer from '@/api/online.server';
import type { OnlineCodeSent } from '@/api/online.server';
import { ApiError, viaMock } from '@/api/request';
import type {
  CreateGroupOnlineBookingInput,
  CreateOnlineBookingInput,
  JoinWaitlistInput,
  OnlineBookingResult,
  PlanLeg,
  PlanLegSlot,
  PlanQuery,
  PlanSlot,
  PublicBusinessData,
  PublicGroupEvent,
  SendOnlineCodeInput,
} from '@/api/online';
import type { Id, ISODate, Service } from '@/domain/core';
import type {
  BusinessOnlineRules,
  ClientFieldsConfig,
  CustomClientField,
  GroupBookingRules,
  OnlinePackage,
  StaffOnlineRules,
  WaitlistRequest,
  WidgetEventType,
} from '@/domain/online';
import { addDays, addMinutes } from '@/lib/date';

const online = () => import('@/api/online');

/** Всё для публичной страницы /b/<slug>[/f/<formId>] — только видимое онлайн (F-03-134, F-03-140) */
export function getPublicBusinessData(slug: string, formId?: string): Promise<PublicBusinessData> {
  if (isApiMode()) return OnlineServer.getPublicBusinessDataServer(slug, formId);
  return viaMock(online, (m) => m.getPublicBusinessDataMock(slug, formId));
}

/** Отправляет событие в подключённые счётчики (F-03-118…120: демо, реальных сетевых вызовов нет) и в журнал ссылки */
export function trackWidgetEvent(linkId: Id | undefined, businessId: Id, type: WidgetEventType): Promise<void> {
  if (isApiMode()) return OnlineServer.trackWidgetEventServer(linkId, businessId, type);
  return viaMock(online, (m) => m.trackWidgetEventMock(linkId, businessId, type));
}

export function getBusinessRules(businessId: Id): Promise<BusinessOnlineRules> {
  if (isApiMode()) return OnlineServer.getBusinessRulesServer();
  return viaMock(online, (m) => m.getBusinessRulesMock(businessId));
}

export function getClientFieldsConfig(businessId: Id): Promise<ClientFieldsConfig> {
  if (isApiMode()) return OnlineServer.getClientFieldsConfigServer();
  return viaMock(online, (m) => m.getClientFieldsConfigMock(businessId));
}

/**
 * Групповые события, доступные клиенту в виджете (F-03-101): только будущие, услуга открыта онлайн.
 * data-f="F-16-029" — у групповой услуги нет тумблера онлайн-записи по сотруднику (StaffCard хранит только
 * общий Staff.onlineBookingEnabled), включение/выключение — только на уровне Service.onlineBookable целиком;
 * выключение сразу прячет все её события отсюда. Значение по умолчанию у новой услуги — true (mock/seed/services.ts).
 */
export function listPublicGroupEvents(businessId: Id, serviceId?: Id): Promise<PublicGroupEvent[]> {
  if (isApiMode()) return OnlineServer.listPublicGroupEventsServer(businessId, serviceId);
  return viaMock(online, (m) => m.listPublicGroupEventsMock(businessId, serviceId));
}

export function listStaffRules(staffIds: Id[]): Promise<Record<Id, StaffOnlineRules>> {
  if (isApiMode()) {
    return Promise.all(staffIds.map((id) => OnlineServer.getStaffRulesServer(id))).then((rows) => {
      const out: Record<Id, StaffOnlineRules> = {};
      staffIds.forEach((id, i) => (out[id] = rows[i]!));
      return out;
    });
  }
  return viaMock(online, (m) => m.listStaffRulesMock(staffIds));
}

/**
 * F-00-007, B2: код перед записью без входа — в `api` доставляет сервер в выбранный канал (Telegram / WhatsApp / SMS);
 * не доставил — сам шлёт в следующий включённый, ответ говорит куда.
 */
export function sendOnlineBookingCode(input: SendOnlineCodeInput): Promise<OnlineCodeSent> {
  if (isApiMode()) return OnlineServer.sendOnlineBookingCodeServer(input);
  return viaMock(online, (m) => m.sendOnlineBookingCodeMock(input));
}

/** Правила мастера — есть всегда: если записи в срезе нет, отдаём дефолты (F-00-066) */
export function getStaffRules(staffId: Id): Promise<StaffOnlineRules> {
  if (isApiMode()) return OnlineServer.getStaffRulesServer(staffId);
  return viaMock(online, (m) => m.getStaffRulesMock(staffId));
}

/** Запись на групповое событие с местами (F-03-076, F-03-101) — все места на телефон одного клиента (147353) */
export function createGroupOnlineBooking(input: CreateGroupOnlineBookingInput): Promise<OnlineBookingResult> {
  if (isApiMode()) return OnlineServer.createGroupOnlineBookingServer(input);
  return viaMock(online, (m) => m.createGroupOnlineBookingMock(input));
}

export function getGroupBookingRules(linkId: Id): Promise<GroupBookingRules> {
  if (isApiMode()) return OnlineServer.getGroupBookingRulesServer(linkId);
  return viaMock(online, (m) => m.getGroupBookingRulesMock(linkId));
}

/**
 * Клиент сам встаёт в лист ожидания на пустой день или у занятого мастера (F-03-086, ⭐ F-00-101/102) — в ОДИН лист
 * ожидания бизнеса (resources.waitlist, владелец 30.09.2026): его видят /biz/waitlist и панель журнала, ему уходит
 * «Освободилось время». Тот же номер на тот же день и услугу второй раз не встаёт — вернём уже стоящую заявку.
 */
export function joinOnlineWaitlist(input: JoinWaitlistInput): Promise<WaitlistRequest> {
  if (isApiMode()) return OnlineServer.joinOnlineWaitlistServer(input);
  return viaMock(online, (m) => m.joinOnlineWaitlistMock(input));
}

/** О24: имя и телефон неопубликованного бизнеса — для экрана «Онлайн-запись скоро откроется» */
export function getUnpublishedContact(slug: string): Promise<{ name: string; phone: string } | undefined> {
  if (isApiMode()) return Promise.resolve(undefined);
  return viaMock(online, (m) => m.getUnpublishedContactMock(slug));
}

/**
 * Стадия 21 (лейн client+online): кабинет сети пока не даёт создавать сетевые поля НИГДЕ, даже в моке (см.
 * докстринг NetworkExtraField) — на сервере их взять неоткуда, поэтому api-режим честно отдаёт пусто вместо
 * выдуманного стенд-ина; когда раздел network заведёт создание — здесь появится настоящий запрос.
 */
export function getWidgetExtraFields(locationId: Id | undefined): Promise<CustomClientField[]> {
  if (isApiMode()) return Promise.resolve([]);
  return viaMock(online, (m) => m.getWidgetExtraFieldsMock(locationId));
}

/**
 * О14: вошедший в этом браузере клиент (или уже подтверждавший номер) не вводит код заново — только в моке;
 * в режиме api сервер требует код на каждую запись без входа (B2), поэтому поле кода остаётся.
 */
export function rememberedPhoneSkipsCode(): boolean {
  return !isApiMode();
}

/** «Записаться»: проверки, клиент по номеру, создание записи (F-03-093, F-03-125) */
export function createOnlineBooking(input: CreateOnlineBookingInput): Promise<OnlineBookingResult> {
  if (isApiMode() && input.slug) {
    if (!input.code) throw new ApiError('code_required', 'Подтвердите номер телефона кодом');
    return OnlineServer.createOnlineBookingServer(input.slug, input as CreateOnlineBookingInput & { code: string });
  }
  return viaMock(online, (m) => m.createOnlineBookingMock(input));
}

/** Диапазон цены пакета (F-03-130): сумма минимумов – сумма максимумов включённых услуг */
export function computePackagePriceRange(services: Service[]): { min: number; max?: number } {
  const min = services.reduce((sum, s) => sum + s.priceMin, 0);
  const hasRange = services.some((s) => s.priceMax && s.priceMax > s.priceMin);
  const max = hasRange ? services.reduce((sum, s) => sum + (s.priceMax ?? s.priceMin), 0) : undefined;
  return { min, max };
}

/** Диапазон длительности пакета (F-03-130): одновременно — от max(min) до max(max); последовательно — суммы */
export function computePackageDurationRange(services: Service[], mode: OnlinePackage['mode']): { min: number; max?: number } {
  const withDur = services.filter((s) => s.durationMin > 0);
  if (mode === 'simultaneous') {
    const min = Math.max(0, ...withDur.map((s) => s.durationMin));
    const maxCandidates = withDur.map((s) => s.durationMax ?? s.durationMin);
    const max = Math.max(0, ...maxCandidates);
    return { min, max: max > min ? max : undefined };
  }
  const min = withDur.reduce((sum, s) => sum + s.durationMin, 0);
  const hasRange = withDur.some((s) => s.durationMax && s.durationMax > s.durationMin);
  const max = hasRange ? withDur.reduce((sum, s) => sum + (s.durationMax ?? s.durationMin), 0) : undefined;
  return { min, max };
}

// ─────────────────────────── План визита: «любой мастер» и несколько мастеров подряд (О4, О8) ───────────────────────────

/** Сколько бронируется на часть визита: верх «от–до» (F-00-057) */
export const bookedLegDuration = (leg: PlanLeg) => Math.max(leg.durationMin, leg.durationMax ?? leg.durationMin);

/** То же для режима api: окна мастеров берём у сервера, следующие части — по его сетке (приближённо) */
async function planSlotsForDayApi(q: PlanQuery, date: ISODate, firstOnly: boolean): Promise<PlanSlot[]> {
  if (!q.slug || q.legs.length === 0 || (q.maxDate && date > q.maxDate)) return [];
  const slug = q.slug;
  const perLeg = await Promise.all(
    q.legs.map((leg) =>
      Promise.all(
        leg.staffIds.map((staffId) =>
          OnlineServer.getWidgetFreeSlotsServer(slug, {
            staffId,
            date,
            durationMin: leg.durationMin,
            durationMax: leg.durationMax,
            serviceId: leg.serviceIds[0],
            locationId: q.locationId,
            workplace: q.workplace,
          }).then((slots) => ({ staffId, starts: new Set(slots.map((x) => x.start)) })),
        ),
      ),
    ),
  );
  const starts = [...new Set(perLeg[0].flatMap((x) => [...x.starts]))].sort();
  const out: PlanSlot[] = [];
  for (const start of starts) {
    for (const c0 of perLeg[0].filter((x) => x.starts.has(start))) {
      const legs: PlanLegSlot[] = [{ staffId: c0.staffId, serviceIds: q.legs[0].serviceIds, start, durationMin: bookedLegDuration(q.legs[0]) }];
      let t = addMinutes(start, bookedLegDuration(q.legs[0]));
      let ok = true;
      for (let k = 1; k < q.legs.length; k++) {
        const prev = legs[legs.length - 1].staffId;
        const cand = [...perLeg[k]].sort((a, b) => (a.staffId === prev ? -1 : b.staffId === prev ? 1 : 0)).find((x) => x.starts.has(t));
        if (!cand) {
          ok = false;
          break;
        }
        legs.push({ staffId: cand.staffId, serviceIds: q.legs[k].serviceIds, start: t, durationMin: bookedLegDuration(q.legs[k]) });
        t = addMinutes(t, bookedLegDuration(q.legs[k]));
      }
      if (!ok) continue;
      out.push({ date, start, end: t, legs });
      break;
    }
    if (firstOnly && out.length > 0) break;
  }
  return out;
}

/** Окна визита на день — одиночный мастер, «любой» (объединение окон всех подходящих, О8) и цепочка мастеров (О4) */
export function getPlanSlots(q: PlanQuery, date: ISODate): Promise<PlanSlot[]> {
  if (isApiMode() && q.slug) return planSlotsForDayApi(q, date, false);
  return viaMock(online, (m) => m.getPlanSlotsMock(q, date));
}

/** Отметки «есть время» на каждый день месяца для плана (О11: считаются по ПОКАЗАННОМУ месяцу) */
export function getPlanMonthAvailability(q: PlanQuery, monthStart: ISODate): Promise<Record<ISODate, boolean>> {
  const first = monthStart.slice(0, 8) + '01';
  const days: ISODate[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d);
  if (isApiMode() && q.slug) {
    const slug = q.slug;
    const leg = q.legs[0];
    if (!leg) return Promise.resolve({});
    // Один кандидат/несколько — объединение месячных карт мастеров первой части (для цепочки — приближённо)
    return Promise.all(
      leg.staffIds.map((staffId) =>
        OnlineServer.getMonthAvailabilityServer(slug, staffId, leg.durationMin, first, {
          durationMax: leg.durationMax,
          serviceId: leg.serviceIds[0],
          locationId: q.locationId,
          workplace: q.workplace,
        }),
      ),
    ).then((maps) => {
      const out: Record<ISODate, boolean> = {};
      for (const d of days) out[d] = (!q.maxDate || d <= q.maxDate) && maps.some((m) => m[d]);
      return out;
    });
  }
  return viaMock(online, (m) => m.getPlanMonthAvailabilityMock(q, days));
}

/** Ближайший день с окнами для плана (О8, О12): «любой» — самый ранний у всех подходящих мастеров */
export function getPlanNearestDate(q: PlanQuery, from: ISODate, maxDays = 60): Promise<ISODate | undefined> {
  const limit = q.maxDate && q.maxDate < addDays(from, maxDays) ? q.maxDate : addDays(from, maxDays);
  if (isApiMode() && q.slug) {
    return (async () => {
      for (let d = from; d <= limit; d = addDays(d, 1)) {
        if ((await planSlotsForDayApi(q, d, true)).length > 0) return d;
      }
      return undefined;
    })();
  }
  return viaMock(online, (m) => m.getPlanNearestDateMock(q, from, limit));
}

/**
 * О4: визит из нескольких частей — по записи на каждую часть, подряд, общим id группы (как пакет F-03-130), чтобы
 * «Вы записаны» показала их вместе. Одна часть — обычная запись. Все проверки — в createOnlineBooking.
 */
export function createPlanBookings(
  base: Omit<CreateOnlineBookingInput, 'services' | 'staffId' | 'start' | 'exactTime' | 'chainGroupId'>,
  planLegs: PlanLegSlot[],
): Promise<OnlineBookingResult[]> {
  // Подряд у одного и того же мастера — одна запись с несколькими услугами (иначе вторая часть «наезжает» на
  // запас после первой и не проходит проверку «свободно ли»)
  const legs: PlanLegSlot[] = [];
  for (const leg of planLegs) {
    const last = legs[legs.length - 1];
    if (last && last.staffId === leg.staffId && addMinutes(last.start, last.durationMin) === leg.start) {
      legs[legs.length - 1] = { ...last, serviceIds: [...last.serviceIds, ...leg.serviceIds], durationMin: last.durationMin + leg.durationMin };
    } else legs.push(leg);
  }
  if (legs.length === 1) {
    const [leg] = legs;
    return createOnlineBooking({ ...base, staffId: leg.staffId, start: leg.start, services: leg.serviceIds.map((serviceId) => ({ serviceId })) }).then((r) => [r]);
  }
  if (isApiMode()) {
    // ⭐ На сервере нет команды «цепочка записей»: создаём по одной (код проверяется на первой — дальше как повезёт)
    return (async () => {
      const out: OnlineBookingResult[] = [];
      for (const [i, leg] of legs.entries()) {
        // ⭐ Допродажа — к последней части визита (продление в конце не сдвигает следующие части)
        const addOns = i === legs.length - 1 ? base.addOns : undefined;
        out.push(await createOnlineBooking({ ...base, addOns, staffId: leg.staffId, start: leg.start, services: leg.serviceIds.map((serviceId) => ({ serviceId })) }));
      }
      return out;
    })();
  }
  return viaMock(online, (m) => m.createPlanBookingsMock(base, legs));
}

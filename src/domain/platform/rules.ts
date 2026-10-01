/**
 * Правила раздела «platform» — чистые функции без React, стора и 'use client' (переедут на сервер как есть).
 * Общие правила продукта (статусы записей, видимость, права) — в src/domain/rules, здесь только правила панели.
 */
import type { ISODate, WeekTemplate } from '@/domain/core';
import { addDays, parse, toISODate } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import type {
  Ad,
  AdState,
  ConnectDraft,
  ConnectIssue,
  ModerationSource,
  ModerationStatus,
  PaybackInputs,
  PaybackResult,
  PromoCode,
  PromoStatus,
  StoryPlacesConfig,
  SupportStatus,
  Visit,
} from '@/domain/platform/types/index';

// ─────────────────────────── Подключение салона (F-00-176, F-00-052) ───────────────────────────

/** Часы по умолчанию: пн–пт 10–19, сб 11–17, вс выходной. Нумерация ядра: 0 = понедельник … 6 = воскресенье. */
export function defaultConnectWeek(): WeekTemplate {
  const workday = () => [{ from: '10:00', to: '19:00' }];
  return { 0: workday(), 1: workday(), 2: workday(), 3: workday(), 4: workday(), 5: [{ from: '11:00', to: '17:00' }], 6: [] };
}

/** Индексы дней недели в порядке показа (с понедельника) */
export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/** Скопировать часы понедельника на остальные будни (вт–пт) */
export function copyMondayToWeekdays(week: WeekTemplate): WeekTemplate {
  const monday = week[0];
  return { ...week, 1: monday.map((r) => ({ ...r })), 2: monday.map((r) => ({ ...r })), 3: monday.map((r) => ({ ...r })), 4: monday.map((r) => ({ ...r })) };
}

/**
 * Чего не хватает, чтобы подключить салон. Пустой список — можно «Подключить».
 * Сфера обязательна (от неё зависят услуги), хотя бы одна услуга (пустые профили в каталог не попадают, F-00-072),
 * телефон владельца (по нему он войдёт), индивидуал обязательно выбирает режим календаря (F-00-052).
 */
export function connectIssues(draft: Pick<ConnectDraft, 'name' | 'sphereId' | 'ownerPhone' | 'services' | 'kind' | 'calendarMode'>): ConnectIssue[] {
  const issues: ConnectIssue[] = [];
  if (!draft.name.trim()) issues.push('name');
  if (!draft.sphereId) issues.push('sphere');
  if (!normalizePhone(draft.ownerPhone)) issues.push('ownerPhone');
  if (!draft.services.some((s) => s.selected)) issues.push('services');
  if (draft.kind === 'individual' && !draft.calendarMode) issues.push('calendarMode');
  return issues;
}

/** На каком шаге мастера исправлять проблему */
export const CONNECT_ISSUE_STEP: Record<ConnectIssue, number> = { name: 0, sphere: 0, ownerPhone: 0, services: 4, calendarMode: 5 };

// ─────────────────────────── Проверка (F-00-168, F-00-169) ───────────────────────────

/** Без очереди проходят только шаблон, снятое нами на визите и повтор уже одобренного (F-00-169) */
export function moderationStatusFor(source: ModerationSource, reuseSourceApproved: boolean): ModerationStatus {
  if (source === 'template' || source === 'visit') return 'auto';
  if (source === 'reuse' && reuseSourceApproved) return 'auto';
  return 'pending';
}

// ─────────────────────────── Визиты (F-00-177) ───────────────────────────

export type CallbackState = 'overdue' | 'today' | 'later' | 'none';

/** Состояние «перезвонить»: только у тех, кто думает и у кого стоит дата */
export function callbackState(visit: Pick<Visit, 'status' | 'callbackDate'>, today: ISODate): CallbackState {
  if (visit.status !== 'thinking' || !visit.callbackDate) return 'none';
  if (visit.callbackDate < today) return 'overdue';
  if (visit.callbackDate === today) return 'today';
  return 'later';
}

/** На сколько дней просрочен перезвон (0 — сегодня) */
export function callbackOverdueDays(callbackDate: ISODate, today: ISODate): number {
  return Math.max(0, parse(today).diff(parse(callbackDate), 'day'));
}

const CALLBACK_RANK: Record<CallbackState, number> = { overdue: 0, today: 1, later: 2, none: 3 };

/** Порядок работы: просроченные → сегодня → позже → без даты; внутри — по дате перезвона, потом свежие визиты выше */
export function sortVisitsForWork<T extends Pick<Visit, 'status' | 'callbackDate' | 'createdAt'>>(visits: readonly T[], today: ISODate): T[] {
  return [...visits].sort((a, b) => {
    const ra = CALLBACK_RANK[callbackState(a, today)];
    const rb = CALLBACK_RANK[callbackState(b, today)];
    if (ra !== rb) return ra - rb;
    if (a.callbackDate && b.callbackDate && a.callbackDate !== b.callbackDate) return a.callbackDate.localeCompare(b.callbackDate);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Быстрые даты «перезвонить»: завтра, через 3 дня, через неделю */
export function callbackPresets(today: ISODate): { id: 'tomorrow' | 'in3' | 'week'; date: ISODate }[] {
  return [
    { id: 'tomorrow', date: addDays(today, 1) },
    { id: 'in3', date: addDays(today, 3) },
    { id: 'week', date: addDays(today, 7) },
  ];
}

// ─────────────────────────── Промокоды (F-00-178, F-00-020) ───────────────────────────

export function promoStatus(p: Pick<PromoCode, 'revokedAt' | 'usedAt' | 'validUntil' | 'issuedAt'>, today: ISODate): PromoStatus {
  if (p.revokedAt) return 'revoked';
  if (p.usedAt) return 'used';
  if (p.validUntil && p.validUntil < today) return 'expired';
  if (p.issuedAt) return 'issued';
  return 'new';
}

/** Промокод ещё можно использовать */
export const isPromoActive = (status: PromoStatus) => status === 'new' || status === 'issued';

/** F-00-020: скидка 10–25%; 0% («без скидки») допустим только для 1 месяца */
export function clampTierPercent(months: number, raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const value = Math.round(raw);
  return months === 1 ? Math.min(25, value) : Math.min(25, Math.max(10, value));
}

/** Код-подсказка «SALON-7K2Q» по названию и случайному хвосту (хвост передаётся снаружи — функция чистая) */
export function suggestPromoCode(prefix: string, tail: string): string {
  const head = prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'SALON';
  return `${head}-${tail.toUpperCase().slice(0, 4)}`;
}

// ─────────────────────────── Реклама и сторис (F-00-166, F-00-160) ───────────────────────────

export function adState(ad: Pick<Ad, 'paused' | 'startDate' | 'endDate'>, today: ISODate): AdState {
  if (ad.paused) return 'paused';
  if (ad.endDate < today) return 'finished';
  if (ad.startDate > today) return 'scheduled';
  return 'running';
}

/** Цена места сторис: последние `lastPlacesCount` мест дороже на `lastPlacesMarkup` % */
export function storyPriceForTaken(config: StoryPlacesConfig, takenBefore: number): number {
  const onLastPlaces = takenBefore >= Math.max(0, config.places - config.lastPlacesCount);
  return onLastPlaces ? Math.round(config.pricePerDay * (1 + config.lastPlacesMarkup / 100)) : config.pricePerDay;
}

export function storyQueuePrice(config: StoryPlacesConfig): number {
  return Math.round(config.pricePerDay * (1 + config.queueMarkup / 100));
}

/** Доля нажатий от показов, % с одним знаком */
export function clickRate(views: number, clicks: number): number {
  return views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0;
}

// ─────────────────────────── Поддержка (F-00-182) ───────────────────────────

const SUPPORT_RANK: Record<SupportStatus, number> = { open: 0, waiting: 1, closed: 2 };

/** Очередь: ждут нас → ждём ответа → закрыто; внутри — свежие выше */
export function sortSupportQueue<T extends { status: SupportStatus; updatedAt: string }>(tickets: readonly T[]): T[] {
  return [...tickets].sort((a, b) => SUPPORT_RANK[a.status] - SUPPORT_RANK[b.status] || b.updatedAt.localeCompare(a.updatedAt));
}

// ─────────────────────────── Заявки на сферы (F-00-152) ───────────────────────────

/** Год подписки считается с дня готовности сферы, а не с оплаты */
export function sphereSubscriptionUntil(readyAt: ISODate): ISODate {
  return toISODate(parse(readyAt).add(1, 'year'));
}

// ─────────────────────────── Окупаемость (F-00-206, F-00-013) ───────────────────────────

/**
 * Сколько салонов или индивидуалов нужно, чтобы выйти в ноль и заработать цель «чистыми».
 * Салон платит минимум за двух мастеров (F-00-013); скидка действует на долю платящих.
 */
export function computePayback(v: PaybackInputs): PaybackResult {
  const discountFactor = 1 - (v.discountShare / 100) * (v.discountPercent / 100);
  const avgSalonRevenue = Math.round(v.salonPerMaster * Math.max(v.avgMasters, 2) * discountFactor);
  const avgIndividualRevenue = Math.round(v.individualPrice * discountFactor);
  const need = (total: number, per: number) => (per > 0 ? Math.ceil(total / per) : 0);
  const totalNeeded = v.monthlyCosts + v.targetNet;
  return {
    avgSalonRevenue,
    avgIndividualRevenue,
    breakevenSalons: need(v.monthlyCosts, avgSalonRevenue),
    breakevenIndividuals: need(v.monthlyCosts, avgIndividualRevenue),
    totalNeeded,
    salonsNeeded: need(totalNeeded, avgSalonRevenue),
    individualsNeeded: need(totalNeeded, avgIndividualRevenue),
    totalInUsd: v.usdRate > 0 ? Math.round(totalNeeded / v.usdRate) : 0,
    totalInEur: v.eurRate > 0 ? Math.round(totalNeeded / v.eurRate) : 0,
  };
}

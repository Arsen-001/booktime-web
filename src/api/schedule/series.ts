'use client';

/**
 * Повторяющиеся записи (F-00-064): правило, генерация одним запросом, продление, отмена одной записи.
 */
import { ApiError, request } from '@/api/request';
import { isApiMode } from '@/api/http';
import * as S from '@/api/journal.server';
import { mutateArea, readArea, readCore } from '@/api/area';
import { canNow, coreTx, currentActor } from '@/api/core';
import { checkSlot, staffDayHours } from '@/domain/rules';
import type { Booking, CoreData, ISODate, Id, TimeRange } from '@/domain/core';
import type { SeriesOccurrence, SeriesRule, SeriesRuleKind } from '@/domain/schedule';
import { SERIES_HORIZON_WEEKS, SERIES_MAX_SHIFT_DAYS, SERIES_REFILL_WEEKS } from '@/domain/schedule';
import { newId } from '@/lib/id';
import { addDays, combine, datePart, eachDay, nowDateTime, parse, today, toISODate, toMinutes, weekdayIndex } from '@/lib/date';
import { quickBookingInput } from '@/api/schedule/shared';
import { effectiveBufferMin } from '@/api/schedule/slots';

function occurrenceDates(rule: Pick<SeriesRule, 'kind' | 'intervalDays' | 'weekday' | 'startDate'>, from: ISODate, to: ISODate): ISODate[] {
  const dates: ISODate[] = [];
  if (rule.kind === 'weekly') {
    for (const d of eachDay(from < rule.startDate ? rule.startDate : from, to)) {
      if (weekdayIndex(d) === rule.weekday) dates.push(d);
    }
    return dates;
  }
  const interval = Math.max(1, rule.intervalDays ?? 7);
  let d = rule.startDate;
  while (d < from) d = addDays(d, interval);
  while (d <= to) {
    dates.push(d);
    d = addDays(d, interval);
  }
  return dates;
}

/**
 * Первый свободный день начиная с расчётной даты — выходной или занято сдвигают вперёд (F-00-064). Проверка —
 * checkSlot() ядра, та же, что делает placeBooking (с тем же запасом), поэтому «свободно» тут = «запишется».
 */
function txResolveOccurrence(core: CoreData, rule: SeriesRule, date: ISODate, bufferAfterMin: number): ISODate | null {
  const startMin = toMinutes(rule.time as TimeRange['from']);
  for (let i = 0; i <= SERIES_MAX_SHIFT_DAYS; i++) {
    const d = addDays(date, i);
    const hours = staffDayHours(core, rule.staffId, d, rule.locationId);
    const fits = hours.some((h) => toMinutes(h.from) <= startMin && toMinutes(h.to) - startMin >= rule.durationMin);
    if (!fits) continue;
    const ok = checkSlot(
      core,
      {
        staffId: rule.staffId,
        start: combine(d, rule.time as TimeRange['from']),
        durationMin: rule.durationMin,
        bufferAfterMin,
        locationId: rule.locationId,
        checkHours: false,
        checkPast: false,
      },
      nowDateTime(),
    ).ok;
    if (ok) return d;
  }
  return null;
}

/**
 * Записи серии на даты from…to — ВСЁ в одном request() (core-k3 №2: раньше каждый повтор платил задержку «сети»).
 * Дата, которую занял кто-то ещё, пропускается к следующему свободному дню; исчерпали сдвиг — пропуск.
 */
function txGenerateOccurrences(
  rule: SeriesRule,
  from: ISODate,
  to: ISODate,
  createdBy: Id | 'client',
): { occurrences: SeriesOccurrence[]; movedCount: number; skipped: number } {
  const dates = occurrenceDates(rule, from, to);
  const service = readCore().services.find((s) => s.id === rule.serviceId);
  const bufferAfterMin = service?.bufferAfterMin || effectiveBufferMin(rule.staffId, rule.locationId);
  const occurrences: SeriesOccurrence[] = [];
  let movedCount = 0;
  let skipped = 0;
  for (const original of dates) {
    let searchFrom = original;
    let created: SeriesOccurrence | null = null;
    for (let attempt = 0; attempt <= SERIES_MAX_SHIFT_DAYS && !created; attempt++) {
      const resolved = txResolveOccurrence(readCore(), rule, searchFrom, bufferAfterMin);
      if (!resolved) break;
      try {
        const result = coreTx.placeBooking(
          quickBookingInput({
            businessId: rule.businessId,
            locationId: rule.locationId,
            staffId: rule.staffId,
            start: combine(resolved, rule.time as TimeRange['from']),
            serviceId: rule.serviceId,
            durationMin: rule.durationMin,
            clientId: rule.clientId,
            clientName: rule.clientName,
            clientPhone: rule.clientPhone,
            createdBy,
            seriesId: rule.id,
          }),
        );
        created = {
          bookingId: result.booking.id,
          date: resolved,
          time: rule.time,
          moved: resolved !== original,
        };
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        searchFrom = addDays(resolved, 1);
      }
    }
    if (!created) skipped += 1;
    else {
      if (created.moved) movedCount += 1;
      occurrences.push(created);
    }
  }
  return { occurrences, movedCount, skipped };
}

/** Обратная связь по прогрессу генерации серии (done — сколько дат уже обработано, total — сколько всего) */
export type SeriesProgressCallback = (done: number, total: number) => void;

export interface CreateSeriesInput {
  businessId: Id;
  locationId: Id;
  staffId: Id;
  serviceId: Id;
  durationMin: number;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  kind: SeriesRuleKind;
  intervalDays?: number;
  weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time: string;
  startDate: ISODate;
  createdByName: string;
  createdBy: Id | 'client';
}

export interface CreateSeriesResult {
  rule: SeriesRule;
  occurrences: SeriesOccurrence[];
  movedCount: number;
  skipped: number;
}

/** Первая дата серии: для «по дню недели» — ближайшая дата этого дня недели не раньше startDate (R-2) */
export function seriesFirstDate(kind: SeriesRuleKind, startDate: ISODate, weekday?: number): ISODate {
  if (kind !== 'weekly' || weekday === undefined) return startDate;
  let d = startDate;
  for (let i = 0; i < 7 && weekdayIndex(d) !== weekday; i++) d = addDays(d, 1);
  return d;
}

/** Даты, которые создаст серия на горизонт SERIES_HORIZON_WEEKS — для строки-итога до сохранения (R-2) */
export function previewSeriesDates(input: Pick<CreateSeriesInput, 'kind' | 'intervalDays' | 'weekday' | 'startDate'>): ISODate[] {
  const start = seriesFirstDate(input.kind, input.startDate, input.weekday);
  const horizonEnd = toISODate(parse(start).add(SERIES_HORIZON_WEEKS, 'week'));
  return occurrenceDates({ ...input, startDate: start }, start, horizonEnd);
}

/** Итог серии до сохранения (R-2): даты на горизонт и сколько из них мастер не работает в это время */
export interface SeriesPreview {
  firstDate: ISODate;
  count: number;
  /** Даты, где в это время у мастера нет рабочих часов — такие записи переедут на ближайший свободный день */
  offDays: number;
}

export function previewSeries(input: {
  staffId: Id;
  locationId: Id;
  kind: SeriesRuleKind;
  intervalDays?: number;
  weekday?: number;
  time: string;
  startDate: ISODate;
  durationMin: number;
}): Promise<SeriesPreview> {
  if (isApiMode()) return S.previewSeries(seriesBiz(input.staffId), input);
  return request(() => {
    const core = readCore();
    const dates = previewSeriesDates({
      ...input,
      weekday: input.weekday as SeriesRule['weekday'],
    });
    const startMin = toMinutes(input.time as TimeRange['from']);
    const offDays = dates.filter(
      (d) =>
        !staffDayHours(core, input.staffId, d, input.locationId).some(
          (h) => toMinutes(h.from) <= startMin && toMinutes(h.to) - startMin >= input.durationMin,
        ),
    ).length;
    return {
      firstDate: dates[0] ?? input.startDate,
      count: dates.length,
      offDays,
    };
  });
}

/** Продлить все активные серии бизнеса, которые подошли к концу горизонта (F-00-064 «продлевает сама»). Один запрос. */
export function extendDueSeries(businessId: Id): Promise<number> {
  if (isApiMode()) return S.extendDueSeries(businessId);
  return request(() => {
    let added = 0;
    for (const rule of (readArea('schedule').seriesRules[businessId] ?? []).filter((r) => r.active)) {
      if (!canNow('journal.create', { targetStaffId: rule.staffId })) continue;
      added += txExtend(rule, true)?.occurrences.length ?? 0;
    }
    return added;
  });
}

/** Создаёт правило и сразу генерирует записи на SERIES_HORIZON_WEEKS вперёд (F-00-064). Один запрос. */
export function createSeries(input: CreateSeriesInput, onProgress?: SeriesProgressCallback): Promise<CreateSeriesResult> {
  if (isApiMode()) return S.createSeries(input.businessId, { ...input, businessId: undefined }).then((r) => { onProgress?.(r.occurrences.length + r.skipped, r.occurrences.length + r.skipped); return r; });
  return request(() => {
    const startDate = seriesFirstDate(input.kind, input.startDate, input.weekday);
    const rule: SeriesRule = {
      id: newId('scser'),
      businessId: input.businessId,
      locationId: input.locationId,
      staffId: input.staffId,
      serviceId: input.serviceId,
      durationMin: input.durationMin,
      clientId: input.clientId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      kind: input.kind,
      intervalDays: input.intervalDays,
      weekday: input.weekday,
      time: input.time as SeriesRule['time'],
      startDate,
      active: true,
      createdAt: nowDateTime(),
      createdByName: input.createdByName,
    };
    mutateArea('schedule', (draft) => {
      draft.seriesRules[rule.businessId] = [...(draft.seriesRules[rule.businessId] ?? []), rule];
    });
    const horizonEnd = toISODate(parse(rule.startDate).add(SERIES_HORIZON_WEEKS, 'week'));
    const result = txGenerateOccurrences(rule, rule.startDate, horizonEnd, input.createdBy);
    onProgress?.(result.occurrences.length + result.skipped, result.occurrences.length + result.skipped);
    return { rule, ...result };
  });
}

export function listSeries(businessId: Id, staffId?: Id): Promise<SeriesRule[]> {
  if (isApiMode()) return S.listSeries(businessId, staffId);
  return request(() => {
    const all = readArea('schedule').seriesRules[businessId] ?? [];
    return staffId ? all.filter((r) => r.staffId === staffId) : all;
  });
}

function txSeriesOccurrences(seriesId: Id): Booking[] {
  return readCore()
    .bookings.filter((b) => !b.deletedAt && b.seriesId === seriesId)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Будущие записи серии, отсортированные по дате — для списка «Ближайшие визиты» и отмены одной (F-00-064) */
export function getSeriesOccurrences(seriesId: Id): Promise<Booking[]> {
  if (isApiMode()) return S.seriesOccurrences(seriesBiz(), seriesId);
  return request(() => txSeriesOccurrences(seriesId));
}

function txExtend(rule: SeriesRule, onlyIfNeeded: boolean): CreateSeriesResult | null {
  if (onlyIfNeeded && !rule.active) return null;
  const occurrences = txSeriesOccurrences(rule.id);
  const lastDate = occurrences.length ? datePart(occurrences[occurrences.length - 1].start) : rule.startDate;
  if (onlyIfNeeded) {
    const refillFrom = toISODate(parse(today()).add(SERIES_REFILL_WEEKS, 'week'));
    if (lastDate >= refillFrom) return null;
  }
  // Записей ещё нет — начинаем с самой даты первого визита, иначе — со следующего дня после последней
  const from = occurrences.length ? addDays(lastDate, 1) : rule.startDate;
  const to = toISODate(parse(from).add(SERIES_HORIZON_WEEKS, 'week'));
  const result = txGenerateOccurrences(rule, from, to, currentActor().staffId ?? 'client');
  if (onlyIfNeeded && result.occurrences.length === 0) return null;
  return { rule, ...result };
}

/** Если до конца сгенерированного горизонта осталось меньше SERIES_REFILL_WEEKS — сама продлевает ещё на SERIES_HORIZON_WEEKS */
export function extendSeriesIfNeeded(rule: SeriesRule): Promise<CreateSeriesResult | null> {
  if (isApiMode()) return S.extendSeries(rule.businessId, rule.id, true);
  return request(() => txExtend(rule, true));
}

/** Продлить руками, не дожидаясь автопродления (кнопка «Продлить ещё») */
export function extendSeries(rule: SeriesRule): Promise<CreateSeriesResult> {
  if (isApiMode()) return S.extendSeries(rule.businessId, rule.id, false).then((r) => r ?? { rule, occurrences: [], movedCount: 0, skipped: 0 });
  return request(() => txExtend(rule, false) as CreateSeriesResult);
}

/** Останавливает серию — уже созданные записи остаются, новые больше не генерируются */
export function stopSeries(businessId: Id, ruleId: Id): Promise<void> {
  if (isApiMode()) return S.setSeriesActive(businessId, ruleId, false);
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.seriesRules[businessId] = (draft.seriesRules[businessId] ?? []).map((r) => (r.id === ruleId ? { ...r, active: false } : r));
    });
  });
}

/** Возвращает остановленную серию — для «Отменить» 5 с после stopSeries (F-00-061) */
export function resumeSeries(businessId: Id, ruleId: Id): Promise<void> {
  if (isApiMode()) return S.setSeriesActive(businessId, ruleId, true);
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.seriesRules[businessId] = (draft.seriesRules[businessId] ?? []).map((r) => (r.id === ruleId ? { ...r, active: true } : r));
    });
  });
}

/** Отменяет одну запись серии — остальные не трогает (F-00-064 «отмена одной не трогает серию») */
export function cancelSeriesOccurrence(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return S.removeBooking(bookingId);
  return request(() => coreTx.updateBooking(bookingId, { deletedAt: nowDateTime() }));
}

/** Возвращает отменённую запись серии — для «Отменить» 5 с после cancelSeriesOccurrence (F-00-061) */
export function restoreSeriesOccurrence(bookingId: Id): Promise<Booking> {
  if (isApiMode()) return S.restoreBooking(bookingId);
  return request(() => coreTx.updateBooking(bookingId, { deletedAt: undefined }));
}

/** Режим api (этап 7): серии живут на сервере (booking_series, продление ночью) — бизнес мастера или из сессии */
function seriesBiz(staffId?: Id): Id {
  return S.bizOfStaffOrSession(staffId);
}

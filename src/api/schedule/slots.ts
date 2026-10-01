'use client';

/**
 * Свободные окна (F-02-041…080): база — ядро (staffWorkIntervals / busyIntervals), поверх — правила слотов раздела,
 * недоступные дни, запас, ресурсы, «Любой мастер». Пакеты — packages.ts, учебная запись — demo.ts.
 */
import { isApiMode } from '@/api/http';
import * as S from '@/api/schedule/schedule.server';
import { request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { busyIntervals, mergeIntervals, occupiesTime, scheduleHours, staffWorkIntervals } from '@/domain/rules';
import type { CoreData, DayHours, ISODate, ISODateTime, Id, Minutes, TimeRange, Workplace } from '@/domain/core';
import type { HistoryDetails, ServiceSlotWindow, SlotRule, SlotScopeKind, UnavailableRange } from '@/domain/schedule';
import { newSlotRule, scopeKey } from '@/domain/schedule';
import { newId } from '@/lib/id';
import { addDays, addMinutes, combine, datePart, fromMinutes, nowDateTime, toMinutes, weekdayIndex } from '@/lib/date';
import { historyActor, intersect, minutesOfDay, mutable, nowIso, pushHistory, rangesToIntervals, subtract } from '@/api/schedule/shared';
import type { Interval } from '@/api/schedule/shared';

/**
 * F-02-078: у Altegio можно выбрать время раньше услуги — тогда окна на «самую короткую услугу», и длинная услуга
 * может не поместиться на уже выбранное время. По нашему решению порядок всегда «мастер → услуга → окно»
 * (F-00-056, F-00-092) — окна без длительности услуги не запрашиваются, `durationMin` обязателен, и вопрос
 * «что если выбрать время раньше услуги» у нас не возникает: такого шага в интерфейсе нет.
 */
// data-f="F-02-078"
export interface SlotQuery {
  staffId: Id;
  date: ISODate;
  /** Длительность услуги, мин (нижняя граница «от–до») */
  durationMin: Minutes;
  /** Верхняя граница «от–до» (F-00-057) — бронируется она, если задана */
  durationMax?: Minutes;
  /** Запас после услуги, мин */
  bufferAfterMin?: Minutes;
  locationId?: Id;
  /** Шаг начала окна, мин — переопределяет правило слотов (по умолчанию — из правила, иначе 30) */
  stepMin?: Minutes;
  /** Услуга — нужна, чтобы учесть привязанные ресурсы (F-02-070) */
  serviceId?: Id;
}

export interface FreeSlot {
  staffId: Id;
  locationId: Id;
  workplace: Workplace;
  start: ISODateTime;
  end: ISODateTime;
  /** F-02-047: слот появился как дополнительный (конец записи/перерыва не по сетке), не из основной сетки */
  extra?: boolean;
}

const DEFAULT_BASE_RULE = newSlotRule('scr_default', { isBase: true });

/** По чьим правилам строятся окна сотрудника (F-02-041): «Общее по локации» или «Персонально» */
function slotModeOf(staffId: Id): 'location' | 'staff' {
  return (readArea('schedule').slotMode[staffId] ?? 'location') === 'own' ? 'staff' : 'location';
}

function slotRulesFor(kind: SlotScopeKind, id: Id): SlotRule[] {
  const rules = readArea('schedule').slotRules[scopeKey(kind, id)];
  return rules && rules.length > 0 ? rules : [DEFAULT_BASE_RULE];
}

/** Действующее правило слотов сотрудника на дату — исключение по дню недели, иначе основное (F-02-054) */
function resolveSlotRule(staffId: Id, locationId: Id, date: ISODate): SlotRule {
  const scope = slotModeOf(staffId);
  const rules = slotRulesFor(scope, scope === 'staff' ? staffId : locationId);
  const wd = weekdayIndex(date);
  return rules.find((r) => !r.isBase && r.weekdays.includes(wd)) ?? rules.find((r) => r.isBase) ?? DEFAULT_BASE_RULE;
}

/**
 * F-02-067: услуга «доступна ограниченное время» — окно проверяется по дате, часу начала (граница включительная:
 * 12:00–15:00 → последний старт 15:00) и дням недели («Только будни» = Пн–Пт, «Только выходные» = Сб–Вс; ❓ жёстко,
 * без учёта графика сотрудника — в справке не определено).
 */
function passesServiceWindow(window: ServiceSlotWindow | undefined, date: ISODate, startMin: number): boolean {
  if (!window) return true;
  if (window.from && date < window.from) return false;
  if (window.to && date > window.to) return false;
  if (window.hoursFrom && startMin < toMinutes(window.hoursFrom)) return false;
  if (window.hoursTo && startMin > toMinutes(window.hoursTo)) return false;
  const wd = weekdayIndex(date);
  if (window.days === 'weekdays' && wd >= 5) return false;
  if (window.days === 'weekends' && wd < 5) return false;
  if (window.days === 'custom' && !(window.customDates ?? []).includes(date)) return false;
  if (window.weekdays?.length && !window.weekdays.includes(wd)) return false;
  return true;
}

/** F-02-067: окно доступности услуги/пакета для онлайн-записи — нет записи, ограничения нет */
export function getServiceSlotWindow(serviceId: Id): Promise<ServiceSlotWindow | undefined> {
  if (isApiMode()) return S.getServiceSlotWindow(serviceId);
  return request(() => readArea('schedule').serviceSlotWindows[serviceId]);
}

/** F-02-067: сохранить окно доступности услуги/пакета (карточка услуги — область online/services) */
export function setServiceSlotWindow(window: ServiceSlotWindow): Promise<void> {
  if (isApiMode()) return S.setServiceSlotWindow(window);
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.serviceSlotWindows[window.serviceId] = window;
    });
  });
}

/** F-02-067: снять ограничение «доступна ограниченное время» */
export function clearServiceSlotWindow(serviceId: Id): Promise<void> {
  if (isApiMode()) return S.clearServiceSlotWindow(serviceId);
  return request(() => {
    mutateArea('schedule', (draft) => {
      delete draft.serviceSlotWindows[serviceId];
    });
  });
}

/** Недоступные дни для онлайн-записи — локации И сотрудника действуют вместе (F-02-042, F-02-043) */
function isOnlineUnavailable(staffId: Id, locationId: Id, date: ISODate): boolean {
  const area = readArea('schedule');
  const ranges = [
    ...(area.unavailableDays[scopeKey('location', locationId)] ?? []),
    ...(area.unavailableDays[scopeKey('staff', staffId)] ?? []),
  ];
  return ranges.some((r) => date >= r.from && date <= r.to);
}

/** Сетка кандидатов начала по правилу и типу слотов (F-02-046…050, F-02-053) */
function candidateStarts(
  rule: SlotRule,
  free: Interval[],
  shiftStartMin: number,
  need: number,
  stepOverride?: number,
): { starts: number[]; extra: Set<number> } {
  const step = stepOverride ?? rule.stepMin;
  const extra = new Set<number>();

  if (rule.density === 'dynamic') {
    const starts: number[] = [];
    for (const [a, b] of free) {
      let t = a;
      while (t + need <= b) {
        starts.push(t);
        t += step;
      }
    }
    return { starts, extra };
  }

  const anchor = rule.startMode === 'from_shift_start' ? shiftStartMin : toMinutes(rule.windowFrom);
  const windowEnd = rule.startMode === 'from_shift_start' ? 24 * 60 : toMinutes(rule.windowTo);
  const grid = new Set<number>();
  for (let t = anchor; t < windowEnd; t += step) {
    if (free.some(([a, b]) => t >= a && t + need <= b)) grid.add(t);
  }

  if (rule.density === 'optimal') {
    for (const [a, b] of free) {
      if (a + need <= b && !grid.has(a)) {
        grid.add(a);
        extra.add(a);
      }
    }
  }

  // Ручное включение/выключение — только «Фиксированный»/«Оптимальный» + «От времени онлайн-записи» (F-02-053)
  if (rule.startMode === 'from_window' && rule.disabledSlots.length > 0) {
    const disabled = new Set(rule.disabledSlots);
    for (const t of [...grid]) if (disabled.has(fromMinutes(t))) grid.delete(t);
  }

  return { starts: [...grid].sort((a, b) => a - b), extra };
}

function allowOverNoShowFor(businessId: Id): boolean {
  return readArea('schedule').allowOnlineOverNoShow[businessId] ?? true;
}

/**
 * Занятость мастера на дату — ТОЛЬКО из ядра (busyIntervals: записи всех его карточек, запасы после услуг,
 * групповые события, просроченная предоплата по holdUntil — core-rules №1/№4, e2e-q3 №1). Поверх — одно правило
 * раздела: F-02-066 «онлайн-запись поверх „Не пришёл“» (по умолчанию включено) освобождает время таких записей.
 * Групповые события занимают мастера иначе, чем обычная запись (F-02-073): длительность события целиком, без
 * запаса на клиента — ядро отдаёт их отдельным интервалом (`kind: 'group'`), здесь просто попадают в busy.
 */
// data-f="F-02-073", data-f="F-03-136", data-f="F-04-159" (F-02-066 — время «Не пришёл» снова видно в виджете по умолчанию)
export function busyForSlots(core: CoreData, staffId: Id, date: ISODate, now: ISODateTime): Interval[] {
  const staff = core.staff.find((s) => s.id === staffId);
  const overNoShow = staff ? allowOverNoShowFor(staff.businessId) : false;
  const noShow = overNoShow ? new Set(core.bookings.filter((b) => b.status === 'no_show').map((b) => b.id)) : undefined;
  return busyIntervals(core, staffId, date, { now })
    .filter((b) => !(b.bookingId && noShow?.has(b.bookingId)))
    .map((b) => [b.from, b.to] as Interval);
}

/** Свободные экземпляры ресурсов, привязанных к услуге, на интервал (F-02-064, F-02-070, data-f="F-03-137") */
function resourcesAvailable(
  core: CoreData,
  serviceId: Id | undefined,
  locationId: Id,
  date: ISODate,
  start: number,
  end: number,
  overNoShow: boolean,
): boolean {
  if (!serviceId) return true;
  const resources = core.resources.filter((r) => r.active && r.locationId === locationId && r.serviceIds.includes(serviceId));
  if (resources.length === 0) return true;
  for (const res of resources) {
    // Запись держит ЭКЗЕМПЛЯРЫ ресурса (placeBooking/createBooking кладут id экземпляров); id самого ресурса — старые
    // данные сида. Раньше считался только id ресурса: запись из журнала или виджета не закрывала окно, и клиенту
    // предлагалось время на единственном занятом аппарате (F-16-012).
    const instanceIds = new Set(res.instances.map((i) => i.id));
    const held = (ids: Id[]) => ids.reduce((n, id) => n + (id === res.id || instanceIds.has(id) ? 1 : 0), 0);
    let used = 0;
    for (const b of core.bookings) {
      if (!occupiesTime(b) || datePart(b.start) !== date || b.groupEventId) continue;
      if (overNoShow && b.status === 'no_show') continue;
      const n = held(b.resourceIds);
      if (!n) continue;
      const bStart = minutesOfDay(b.start);
      if (bStart < end && bStart + b.durationMin > start) used += n;
    }
    // Групповое событие держит зал/кабинет само (его участники — не отдельные занятия ресурса)
    for (const e of core.groupEvents) {
      if (e.status !== 'scheduled' || datePart(e.start) !== date) continue;
      const n = held(e.resourceIds);
      if (!n) continue;
      const eStart = minutesOfDay(e.start);
      if (eStart < end && eStart + e.durationMin > start) used += n;
    }
    if (used >= res.instances.length) return false;
  }
  return true;
}

/**
 * Чистый расчёт окон мастера на дату (без задержки) — для использования внутри request().
 * База — ядро: часы с режимом календаря и отметками (staffWorkIntervals), занятость (busyForSlots);
 * раздел добавляет правила слотов, недоступные дни, запас мастера/филиала, «время до визита» и ресурсы.
 * «Сейчас» — Ереван (`nowDateTime()`); параметр now оставлен для тестов. Также сужает окна услуги/пакета с
 * «доступна ограниченное время» (F-02-067, serviceSlotWindows) — переключатель ставит карточка услуги.
 */
// data-f="F-02-067"
export function computeFreeSlots(core: CoreData, q: SlotQuery, now?: Date | ISODateTime): FreeSlot[] {
  const nowAt = nowIso(now);
  const staff = core.staff.find((s) => s.id === q.staffId);
  if (!staff || staff.status !== 'active' || staff.onlineBookingEnabled === false) return [];
  const todayIso = datePart(nowAt);
  if (q.date < todayIso) return [];

  const work = staffWorkIntervals(core, q.staffId, q.date, {
    locationId: q.locationId,
  });
  if (work.length === 0) return [];

  const explicitNeed = q.durationMax ?? q.durationMin;
  const busy = busyForSlots(core, q.staffId, q.date, nowAt);
  const overNoShow = allowOverNoShowFor(staff.businessId);
  // F-02-067: «услуга доступна ограниченное время» — сужает окна этой услуги/пакета
  const serviceWindow = q.serviceId ? readArea('schedule').serviceSlotWindows[q.serviceId] : undefined;
  const isToday = q.date === todayIso;
  // «Сейчас» — вверх до 5 минут: окно «сегодня, 10:56» не по сетке клиенту не предлагаем (e2e-q3 №6)
  const nowMin = Math.ceil(minutesOfDay(nowAt) / 5) * 5;
  const out: FreeSlot[] = [];

  // Группы по месту работы: у каждого графика (салон / дома / филиал сети) свои правила слотов
  const groups = new Map<string, { locationId: Id; workplace: Workplace; free: Interval[] }>();
  for (const w of work) {
    const key = `${w.locationId}|${w.workplace}`;
    const g = groups.get(key) ?? {
      locationId: w.locationId,
      workplace: w.workplace,
      free: [],
    };
    g.free.push([w.from, w.to]);
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    // F-02-042/043: недоступный день для онлайн-записи — график не трогается, но окон нет
    if (isOnlineUnavailable(q.staffId, g.locationId, q.date)) continue;
    // F-02-059/F-00-057: у услуги нет своего перерыва (0/не задан) → берём запас мастера/локации
    const buffer = q.bufferAfterMin || effectiveBufferMin(q.staffId, g.locationId);
    const need = explicitNeed + buffer;

    let free = mutable(mergeIntervals(g.free));
    for (const cut of busy) free = subtract(free, cut);
    if (isToday) free = intersect(free, [[nowMin, 24 * 60]]);
    if (free.length === 0) continue;

    const schedule = core.schedules.find((s) => s.staffId === q.staffId && s.locationId === g.locationId && s.workplace === g.workplace);
    const hours = schedule ? scheduleHours(schedule, q.date) : [];
    const rule = resolveSlotRule(q.staffId, g.locationId, q.date);
    const shiftStartMin = hours.length > 0 ? toMinutes(hours[0].from) : free[0][0];
    const { starts, extra } = candidateStarts(rule, free, shiftStartMin, need, q.stepMin);

    // F-02-052: время до начала визита — отсекаются слоты раньше «сейчас + N»
    const leadCutoff = rule.leadTimeMin ? addMinutes(nowAt, rule.leadTimeMin) : null;

    for (const t of starts) {
      const start = combine(q.date, fromMinutes(t));
      if (leadCutoff && start < leadCutoff) continue;
      if (!passesServiceWindow(serviceWindow, q.date, t)) continue;
      if (!resourcesAvailable(core, q.serviceId, g.locationId, q.date, t, t + need, overNoShow)) continue;
      out.push({
        staffId: q.staffId,
        locationId: g.locationId,
        workplace: g.workplace,
        start,
        end: combine(q.date, fromMinutes(t + explicitNeed)),
        extra: extra.has(t) || undefined,
      });
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start));
}

/** Свободные окна мастера на дату */
export function getFreeSlots(q: SlotQuery): Promise<FreeSlot[]> {
  if (isApiMode()) return S.getFreeSlots(q);
  return request(() => computeFreeSlots(readCore(), q));
}

/** Ближайшие окна мастера на N дней вперёд (для каталога «кто когда свободен») */
export function getNearestSlots(q: Omit<SlotQuery, 'date'> & { days?: number; limit?: number }): Promise<FreeSlot[]> {
  if (isApiMode()) return S.getNearestSlots(q);
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    const out: FreeSlot[] = [];
    const days = q.days ?? 14;
    for (let i = 0; i < days && out.length < (q.limit ?? 5); i++) {
      const date = addDays(datePart(now), i);
      out.push(...computeFreeSlots(core, { ...q, date }, now));
    }
    return out.slice(0, q.limit ?? 5);
  });
}

//

/** Запись в историю правок про правила онлайн-записи (recheck-c3: правила окон тоже видны в «Истории правок») */
function logRules(
  kind: SlotScopeKind,
  id: Id,
  what: NonNullable<HistoryDetails['what']>,
  before?: string,
  after?: string,
  dates: ISODate[] = [],
): void {
  const actor = historyActor();
  pushHistory({
    action: 'slot_rules',
    targetStaffIds: kind === 'staff' ? [id] : [],
    dates,
    summary: '',
    details: { what, role: actor.role, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) },
    actorName: actor.actorName,
    actorStaffId: actor.actorStaffId,
  });
}

export function getSlotMode(staffId: Id): Promise<'location' | 'own'> {
  if (isApiMode()) return S.getSlotMode(staffId);
  return request(() => (slotModeOf(staffId) === 'staff' ? 'own' : 'location'));
}

/** Переключение «Общее по локации» / «Персонально» (F-02-041). При первом включении «Персонально»
 * копирует текущие правила локации — ❓ у Altegio не решено, начинаем с копии, чтобы окна не пропали. */
export function setSlotMode(staffId: Id, locationId: Id, mode: 'location' | 'own'): Promise<void> {
  if (isApiMode()) return S.setSlotMode(staffId, locationId, mode);
  return request(() => {
    logRules('staff', staffId, 'own_rules', undefined, mode);
    const area = readArea('schedule');
    if (mode === 'own' && !area.slotRules[scopeKey('staff', staffId)]) {
      const fromLocation = slotRulesFor('location', locationId).map((r) => ({
        ...r,
        id: newId('scr'),
      }));
      mutateArea('schedule', (draft) => {
        draft.slotRules[scopeKey('staff', staffId)] = fromLocation;
      });
    }
    mutateArea('schedule', (draft) => {
      draft.slotMode[staffId] = mode;
    });
  });
}

export function getSlotRules(kind: SlotScopeKind, id: Id): Promise<SlotRule[]> {
  if (isApiMode()) return S.getSlotRules(kind, id);
  return request(() => slotRulesFor(kind, id));
}

/** Действующее правило на конкретную дату (для превью «Пример поведения слотов») */
export function getEffectiveSlotRule(staffId: Id, locationId: Id, date: ISODate): Promise<SlotRule> {
  if (isApiMode()) return S.getEffectiveSlotRule(staffId, locationId, date);
  return request(() => resolveSlotRule(staffId, locationId, date));
}

/** Сохраняет основное правило или создаёт/обновляет исключение по дням недели (F-02-045, F-02-054) */
export function saveSlotRule(kind: SlotScopeKind, id: Id, rule: SlotRule): Promise<SlotRule> {
  if (isApiMode()) return S.saveSlotRule(kind, id, rule);
  return request(() => {
    logRules(kind, id, 'rule');
    const key = scopeKey(kind, id);
    let saved = rule;
    mutateArea('schedule', (draft) => {
      const list = draft.slotRules[key] ?? [{ ...DEFAULT_BASE_RULE }];
      const idx = list.findIndex((r) => r.id === rule.id);
      saved = idx >= 0 ? rule : { ...rule, id: rule.id || newId('scr') };
      draft.slotRules[key] = idx >= 0 ? list.map((r, i) => (i === idx ? saved : r)) : [...list, saved];
    });
    return saved;
  });
}

/** Удаляет исключение (F-02-055). Основное правило удалить нельзя — «оно всегда остаётся». */
export function deleteSlotRule(kind: SlotScopeKind, id: Id, ruleId: Id): Promise<void> {
  if (isApiMode()) return S.deleteSlotRule(kind, id, ruleId);
  return request(() => {
    logRules(kind, id, 'rule');
    mutateArea('schedule', (draft) => {
      const key = scopeKey(kind, id);
      const list = draft.slotRules[key] ?? [];
      draft.slotRules[key] = list.filter((r) => r.id !== ruleId || r.isBase);
    });
  });
}

/** Ручное включение/выключение одного времени в правиле (F-02-053) */
export function toggleRuleSlot(kind: SlotScopeKind, id: Id, ruleId: Id, time: string): Promise<void> {
  if (isApiMode()) return S.toggleRuleSlot(kind, id, ruleId, time);
  return request(() => {
    logRules(kind, id, 'slot', undefined, time);
    mutateArea('schedule', (draft) => {
      const key = scopeKey(kind, id);
      const list = draft.slotRules[key] ?? [];
      draft.slotRules[key] = list.map((r) => {
        if (r.id !== ruleId) return r;
        const has = r.disabledSlots.includes(time);
        return {
          ...r,
          disabledSlots: has ? r.disabledSlots.filter((t) => t !== time) : [...r.disabledSlots, time],
        };
      });
    });
  });
}

/** Включает/выключает разом всю часть дня — «Утро»/«День»/«Вечер» (F-02-053) */
export function toggleRulePart(kind: SlotScopeKind, id: Id, ruleId: Id, times: string[], enable: boolean): Promise<void> {
  if (isApiMode()) return S.toggleRulePart(kind, id, ruleId, times, enable);
  return request(() => {
    logRules(kind, id, 'slot');
    mutateArea('schedule', (draft) => {
      const key = scopeKey(kind, id);
      const list = draft.slotRules[key] ?? [];
      draft.slotRules[key] = list.map((r) => {
        if (r.id !== ruleId) return r;
        const set = new Set(r.disabledSlots);
        for (const t of times) {
          if (enable) set.delete(t);
          else set.add(t);
        }
        return { ...r, disabledSlots: [...set] };
      });
    });
  });
}

/** Сетка слотов «Утро/День/Вечер» правила на конкретную дату — для F-02-044/053 (для превью, без записей) */
export interface RuleSlotPreview {
  time: string;
  enabled: boolean;
  extra: boolean;
}

export function previewRuleGrid(rule: SlotRule, dayHours: DayHours): RuleSlotPreview[] {
  const free = rangesToIntervals(dayHours.length > 0 ? dayHours : [{ from: '00:00', to: '24:00' }]);
  const shiftStart = dayHours.length > 0 ? toMinutes(dayHours[0].from) : 0;
  const { starts, extra } = candidateStarts(rule, free, shiftStart, rule.stepMin);
  const disabled = new Set(rule.disabledSlots);
  return starts.map((t) => ({
    time: fromMinutes(t),
    enabled: !disabled.has(fromMinutes(t)),
    extra: extra.has(t),
  }));
}

/**
 * Рабочие часы филиала (или сотрудника) — от самого раннего начала до самого позднего конца по шаблонам недели.
 * Сетка окон на экране правил показывает только их, а не ночные 00:00–24:00 (ux-r5 L-1). Нет графиков — null.
 */
export function getWorkRange(kind: SlotScopeKind, id: Id): Promise<TimeRange | null> {
  if (isApiMode()) return S.getWorkRange(kind, id);
  return request(() => {
    const list = readCore().schedules.filter((s) => (kind === 'staff' ? s.staffId === id : s.locationId === id));
    let from = 24 * 60;
    let to = 0;
    for (const s of list)
      for (const day of [...Object.values(s.week), ...Object.values(s.overrides)])
        for (const r of day) {
          from = Math.min(from, toMinutes(r.from));
          to = Math.max(to, toMinutes(r.to));
        }
    return to > from ? { from: fromMinutes(from), to: fromMinutes(to) } : null;
  });
}

export function getUnavailableDays(kind: SlotScopeKind, id: Id): Promise<UnavailableRange[]> {
  if (isApiMode()) return S.getUnavailableDays(kind, id);
  return request(() => readArea('schedule').unavailableDays[scopeKey(kind, id)] ?? []);
}

export function addUnavailableRange(kind: SlotScopeKind, id: Id, range: Omit<UnavailableRange, 'id'>): Promise<UnavailableRange> {
  if (isApiMode()) return S.addUnavailableRange(kind, id, range);
  return request(() => {
    logRules(kind, id, 'closed_days', undefined, undefined, [range.from, range.to]);
    const created: UnavailableRange = { ...range, id: newId('scun') };
    mutateArea('schedule', (draft) => {
      const key = scopeKey(kind, id);
      draft.unavailableDays[key] = [...(draft.unavailableDays[key] ?? []), created];
    });
    return created;
  });
}

export function removeUnavailableRange(kind: SlotScopeKind, id: Id, rangeId: Id): Promise<void> {
  if (isApiMode()) return S.removeUnavailableRange(kind, id, rangeId);
  return request(() => {
    logRules(kind, id, 'closed_days');
    mutateArea('schedule', (draft) => {
      const key = scopeKey(kind, id);
      draft.unavailableDays[key] = (draft.unavailableDays[key] ?? []).filter((r) => r.id !== rangeId);
    });
  });
}

export function getAnySpecialistAllowed(businessId: Id): Promise<boolean> {
  if (isApiMode()) return S.getSettings(businessId).then((s) => s.anySpecialistAllowed);
  return request(() => readArea('schedule').anySpecialistAllowed[businessId] ?? false);
}

export function setAnySpecialistAllowed(businessId: Id, allowed: boolean): Promise<void> {
  if (isApiMode()) return S.patchSettings(businessId, { anySpecialistAllowed: allowed });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.anySpecialistAllowed[businessId] = allowed;
    });
  });
}

export function getSkipStaffSelection(staffId: Id): Promise<boolean> {
  if (isApiMode()) return S.staffSettings(staffId).then((s) => s.skipStaffSelection[staffId] ?? false);
  return request(() => readArea('schedule').skipStaffSelection[staffId] ?? false);
}

export function setSkipStaffSelection(staffId: Id, value: boolean): Promise<void> {
  if (isApiMode()) return S.patchStaffSettings(staffId, { skipStaffSelection: { [staffId]: value } });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.skipStaffSelection[staffId] = value;
    });
  });
}

export interface AnySpecialistSlot extends FreeSlot {
  /** Мастер назначен случайно из пула (F-02-079: «создана на случайного незанятого специалиста») */
  candidateIds: Id[];
}

/** Подбор свободного мастера из пула «Пропуск выбора сотрудника» (F-02-079) */
export function computeAnySpecialistSlots(
  core: CoreData,
  input: {
    businessId: Id;
    locationId: Id;
    date: ISODate;
    durationMin: Minutes;
    durationMax?: Minutes;
    bufferAfterMin?: Minutes;
    stepMin?: Minutes;
    serviceId?: Id;
  },
  now?: Date | ISODateTime,
): AnySpecialistSlot[] {
  const area = readArea('schedule');
  if (!(area.anySpecialistAllowed[input.businessId] ?? false)) return [];
  const pool = core.staff.filter(
    (s) =>
      s.businessId === input.businessId &&
      s.locationIds.includes(input.locationId) &&
      s.status === 'active' &&
      s.onlineBookingEnabled !== false &&
      (area.skipStaffSelection[s.id] ?? false) &&
      (!input.serviceId || s.serviceIds.includes(input.serviceId)),
  );
  const byTime = new Map<string, FreeSlot[]>();
  for (const staff of pool) {
    const slots = computeFreeSlots(
      core,
      {
        staffId: staff.id,
        date: input.date,
        durationMin: input.durationMin,
        durationMax: input.durationMax,
        bufferAfterMin: input.bufferAfterMin,
        locationId: input.locationId,
        stepMin: input.stepMin,
        serviceId: input.serviceId,
      },
      now,
    );
    for (const slot of slots) byTime.set(slot.start, [...(byTime.get(slot.start) ?? []), slot]);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, candidates]) => ({
      ...candidates[Math.floor(Math.random() * candidates.length)],
      candidateIds: candidates.map((c) => c.staffId),
    }));
}

export function getAnySpecialistSlots(input: {
  businessId: Id;
  locationId: Id;
  date: ISODate;
  durationMin: Minutes;
  durationMax?: Minutes;
  bufferAfterMin?: Minutes;
  stepMin?: Minutes;
  serviceId?: Id;
}): Promise<AnySpecialistSlot[]> {
  if (isApiMode()) return S.getAnySpecialistSlots(input);
  return request(() => computeAnySpecialistSlots(readCore(), input));
}

export function getAllowOnlineOverNoShow(businessId: Id): Promise<boolean> {
  if (isApiMode()) return S.getSettings(businessId).then((s) => s.allowOnlineOverNoShow);
  return request(() => readArea('schedule').allowOnlineOverNoShow[businessId] ?? true);
}

export function setAllowOnlineOverNoShow(businessId: Id, value: boolean): Promise<void> {
  if (isApiMode()) return S.patchSettings(businessId, { allowOnlineOverNoShow: value });
  return request(() => {
    mutateArea('schedule', (draft) => {
      draft.allowOnlineOverNoShow[businessId] = value;
    });
  });
}

/** 0 — «Без перерыва» (по умолчанию, если ничего не задано) */
export function getBufferMin(kind: SlotScopeKind, id: Id): Promise<number> {
  if (isApiMode()) return S.getBufferMin(kind, id);
  return request(() => readArea('schedule').bufferMin[scopeKey(kind, id)] ?? 0);
}

export function setBufferMin(kind: SlotScopeKind, id: Id, minutes: number): Promise<void> {
  if (isApiMode()) return S.setBufferMin(kind, id, minutes);
  return request(() => {
    logRules(kind, id, 'buffer', String(readArea('schedule').bufferMin[scopeKey(kind, id)] ?? 0), String(minutes));
    mutateArea('schedule', (draft) => {
      draft.bufferMin[scopeKey(kind, id)] = minutes;
    });
  });
}

/**
 * Действующий запас для мастера в конкретной локации (F-02-059): свой (staff) важнее общего локации,
 * общий локации — если у мастера явно ничего не выбрано. Читает CoreData, поэтому — внутри request()
 * вызывающей стороны (тот же приём, что resolveSlotRule).
 */
export function effectiveBufferMin(staffId: Id, locationId?: Id): number {
  const area = readArea('schedule');
  const own = area.bufferMin[scopeKey('staff', staffId)];
  if (own !== undefined) return own;
  if (locationId) return area.bufferMin[scopeKey('location', locationId)] ?? 0;
  return 0;
}

export interface StaffSlotUtilization {
  staffId: Id;
  /** Свободные окна по расчёту слотов (durationMin=30 — базовая единица отчёта, F-02-094) */
  freeCount: number;
  /** Занятые интервалы (записи, техперерывы, групповые события — busyForSlots) */
  busyCount: number;
}

/**
 * F-02-094: «Свободные и занятые слоты по мастерам» за период (интеграция Power BI/Smart-Metrika — раздел
 * integrations строит подключение и вид отчёта, здесь только сам подсчёт по нашим же формулам, F-02-057).
 * Единица подсчёта — получасовой слот (F-02-044 умолчание «Оптимальный», шаг 30) для сопоставимости между
 * мастерами с разными правилами; getFreeSlots/busyForSlots остаются источником истины.
 */
// data-f="F-02-094"
export function getSlotUtilizationReport(staffIds: Id[], from: ISODate, to: ISODate, locationId?: Id): Promise<StaffSlotUtilization[]> {
  if (isApiMode()) return S.getSlotUtilizationReport(staffIds, from, to, locationId);
  return request(() => {
    const core = readCore();
    const nowAt = nowIso();
    return staffIds.map((staffId) => {
      let freeCount = 0;
      let busyCount = 0;
      for (let d = from; d <= to; d = addDays(d, 1)) {
        freeCount += computeFreeSlots(core, { staffId, date: d, durationMin: 30, locationId }, nowAt).length;
        busyCount += busyForSlots(core, staffId, d, nowAt).length;
      }
      return { staffId, freeCount, busyCount };
    });
  });
}

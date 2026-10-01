/**
 * Типы раздела «schedule». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 *
 * Рабочие часы и графики (WorkSchedule/overrides), отметки календаря (CalendarMark) и режим
 * (Staff.calendarMode) живут в ядре (src/domain/core.ts) — это F-02-001: без них журналу и
 * онлайн-записи не на что опереться. Здесь — то, что принадлежит только разделу: типы дня,
 * шаблоны графика, вид таблицы, история правок.
 */
import type { DayHours, Id, ISODate, TimeHM } from '@/domain/core';

/** Системные типы дня (F-02-010). 'not_working' появляется только после первого сохранения — им удаляют день. */
export type SystemDayTypeId = 'work' | 'sick' | 'vacation' | 'unpaid_leave' | 'absence' | 'paid_day_off' | 'not_working';
/** Свой тип нерабочего дня из сети (F-02-011) — строится разделом network, здесь только формат ссылки. */
export type DayTypeId = SystemDayTypeId | `custom:${string}`;

export interface DayType {
  id: DayTypeId;
  /** Ключ в messages/{lang}/schedule.json → dayTypes.* */
  labelKey: string;
  /** Токен палитры chart-1..chart-8 (F-02-010: «у каждого типа свой цвет») */
  color: `chart-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  system: boolean;
  /** Рабочий тип дня или нет — от этого зависит доступность поля «Рабочее время» */
  working: boolean;
}

export const SYSTEM_DAY_TYPES: DayType[] = [
  {
    id: 'work',
    labelKey: 'dayTypes.work',
    color: 'chart-3',
    system: true,
    working: true,
  },
  {
    id: 'sick',
    labelKey: 'dayTypes.sick',
    color: 'chart-5',
    system: true,
    working: false,
  },
  {
    id: 'vacation',
    labelKey: 'dayTypes.vacation',
    color: 'chart-1',
    system: true,
    working: false,
  },
  {
    id: 'unpaid_leave',
    labelKey: 'dayTypes.unpaidLeave',
    color: 'chart-6',
    system: true,
    working: false,
  },
  {
    id: 'absence',
    labelKey: 'dayTypes.absence',
    color: 'chart-8',
    system: true,
    working: false,
  },
  {
    id: 'paid_day_off',
    labelKey: 'dayTypes.paidDayOff',
    color: 'chart-4',
    system: true,
    working: false,
  },
  {
    id: 'not_working',
    labelKey: 'dayTypes.notWorking',
    color: 'chart-7',
    system: true,
    working: false,
  },
];

/**
 * F-02-011: id `custom:<...>` — свой тип нерабочего дня сети. Здесь неизвестны его настоящее имя и цвет
 * (это данные network) — генерик-нерабочий фолбэк, чтобы день НИКОГДА не считался рабочим по ошибке;
 * настоящее имя/цвет подставляют компоненты, у которых есть network-хук `useCustomDayTypes`.
 */
function isCustomDayTypeId(id: DayTypeId): boolean {
  return id.startsWith('custom:');
}

const CUSTOM_DAY_TYPE_FALLBACK: DayType = {
  id: 'work',
  labelKey: 'dayTypes.custom',
  color: 'chart-2',
  system: false,
  working: false,
};

export function dayTypeById(id: DayTypeId): DayType {
  if (isCustomDayTypeId(id)) return { ...CUSTOM_DAY_TYPE_FALLBACK, id };
  return SYSTEM_DAY_TYPES.find((t) => t.id === id) ?? SYSTEM_DAY_TYPES[0];
}

// ─────────────────────────── Шаблоны графика (F-02-006…009, F-02-033) ───────────────────────────

export type TemplateKind = 'none' | 'weekdays' | 'shifts';

export interface ScheduleTemplate {
  id: Id;
  businessId: Id;
  name: string;
  kind: Exclude<TemplateKind, 'none'>;
  /** kind='weekdays': 0=пн…6=вс */
  weekdays?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
  /** kind='shifts': N рабочих подряд */
  shiftWork?: number;
  /** kind='shifts': M выходных подряд */
  shiftOff?: number;
  /** Рабочие часы + перерывы (несколько интервалов = перерывы между ними) */
  hours: DayHours;
  /**
   * Г10: kind='weekdays' — свои часы на отдельные дни недели («пн–пт 10–19, сб 10–16»). Нет ключа — день берёт hours.
   */
  weekdayHours?: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>>;
  createdAt: string;
}

// ─────────────────────────── Ячейки графика: тип дня по датам (F-02-010, F-02-014) ───────────────────────────

export interface DayRecord {
  staffId: Id;
  date: ISODate;
  typeId: DayTypeId;
  /** «В отпуске до…» (F-00-054/F-02-010) — держит непрерывный диапазон одним намерением */
  vacationUntil?: ISODate;
  /** Г16: заметка к дню («учёба», «замена за Сону», «Новый год») — видна уголком в клетке и над колонкой в журнале */
  note?: string;
}

/**
 * Г14: кто вообще стоит в графике — ОДНО правило для таблицы графика и колонок журнала (раньше журнал брал
 * уволенных и не брал приглашённых, а таблица наоборот — «Лала в журнале, Евы нет»). Уволенный и отключённый
 * в графике не стоят; их записи журнал всё равно показывает колонкой с пометкой (Г3).
 */
export function isScheduleStaff(staff: { status: 'active' | 'invited' | 'disabled' | 'fired' }): boolean {
  return staff.status === 'active' || staff.status === 'invited';
}

export function dayKey(staffId: Id, date: ISODate): string {
  return `${staffId}|${date}`;
}

// ─────────────────────────── Вид таблицы (F-02-004) ───────────────────────────

export interface ScheduleViewConfig {
  showShiftTotals: boolean;
  showHeadcount: boolean;
}

export const DEFAULT_VIEW_CONFIG: ScheduleViewConfig = {
  showShiftTotals: true,
  showHeadcount: true,
};

// ─────────────────────────── Фильтры (F-02-003) ───────────────────────────

export type HasScheduleFilter = 'all' | 'with' | 'without';

/** 'active' — по умолчанию («Неудалённые» / «Неуволенные»), 'only' — показать только их (F-02-003) */
export type PresenceFilter = 'active' | 'only';

export interface ScheduleFilters {
  staffIds: Id[];
  positions: string[];
  /** id категорий услуг, которые оказывает сотрудник — проекция «Специализации» (своей сущности нет) */
  specializations: string[];
  hasSchedule: HasScheduleFilter;
  /** В нашей модели персонала нет мягкого удаления — «удалён» проецируется на staff.status === 'disabled' */
  deleted: PresenceFilter;
  fired: PresenceFilter;
}

export const DEFAULT_FILTERS: ScheduleFilters = {
  staffIds: [],
  positions: [],
  specializations: [],
  hasSchedule: 'all',
  deleted: 'active',
  fired: 'active',
};

/**
 * Один фильтр «Показать» вместо трёх Select без подписей (ux-r2 №2, ux-best-c1 №3): кого из сотрудников
 * показывать в таблице. Проекция на поля ScheduleFilters (fired / deleted / hasSchedule).
 */
export type ScheduleShowFilter = 'active' | 'with' | 'without' | 'fired' | 'deleted';

export function scheduleShowValue(f: ScheduleFilters): ScheduleShowFilter {
  if (f.fired === 'only') return 'fired';
  if (f.deleted === 'only') return 'deleted';
  if (f.hasSchedule === 'with') return 'with';
  if (f.hasSchedule === 'without') return 'without';
  return 'active';
}

export function withShowValue(f: ScheduleFilters, v: ScheduleShowFilter): ScheduleFilters {
  return {
    ...f,
    fired: v === 'fired' ? 'only' : 'active',
    deleted: v === 'deleted' ? 'only' : 'active',
    hasSchedule: v === 'with' ? 'with' : v === 'without' ? 'without' : 'all',
  };
}

/** Сколько фильтров изменено против умолчания — для «Фильтры (n)» и «Сбросить» */
export function activeFilterCount(f: ScheduleFilters): number {
  return (f.positions.length ? 1 : 0) + (f.specializations.length ? 1 : 0) + (scheduleShowValue(f) !== 'active' ? 1 : 0);
}

// ─────────────────────────── История правок (F-02-102) ───────────────────────────

export type HistoryAction =
  | 'set_hours'
  | 'apply_template'
  | 'delete_days'
  | 'copy_schedule'
  | 'set_mode'
  | 'toggle_mark'
  | 'set_column_config'
  /** Правила онлайн-записи: правило окон, окно вручную, запас, закрытые дни, «свои правила» (recheck-c3 F-02-102) */
  | 'slot_rules';

export interface HistoryEntry {
  id: Id;
  at: string;
  actorStaffId: Id | null;
  actorName: string;
  action: HistoryAction;
  /** Кого затронуло (staffId графика) */
  targetStaffIds: Id[];
  /** Даты, которых коснулась правка */
  dates: ISODate[];
  /** Старые записи истории — готовый текст; новые пишут details, а текст собирает экран через словарь */
  summary: string;
  /** Что именно поменяли — для строки «Ани Саргсян · 10:00–19:00 → 10:00–22:00» на любом языке (recheck-c2, ux-r5 H-1) */
  details?: HistoryDetails;
}

export interface HistoryDetails {
  typeId?: DayTypeId;
  /** Сколько дней и сотрудников затронуто */
  days?: number;
  staff?: number;
  /** Часы до и после («10:00–19:00», «—» — выходной) — для правки одного дня */
  before?: string;
  after?: string;
  /** Режим календаря после правки */
  mode?: 'free' | 'busy';
  /** Что поменяли в правилах онлайн-записи */
  what?: 'rule' | 'slot' | 'buffer' | 'closed_days' | 'own_rules';
  /** Роль автора без своей карточки сотрудника — подпись вместо имени */
  role?: 'owner' | 'admin' | 'master';
}

export type { TimeHM };

// ─────────────────────────── Правила слотов онлайн-записи (b02: F-02-041…080) ───────────────────────────
//
// Часы и записи (WorkSchedule/Booking) остаются в ядре — здесь только ПРАВИЛА, которые решают, что из
// свободного времени клиент видит онлайн. computeFreeSlots (src/api/schedule.ts) читает и то, и другое.

/** Тип слотов (F-02-046…048) */
export type SlotDensity = 'fixed' | 'optimal' | 'dynamic';
/** Начало онлайн-записи (F-02-049/050); недоступно при density='dynamic' */
export type SlotStartMode = 'from_window' | 'from_shift_start';
/** F-02-041: по чьим правилам строятся окна сотрудника */
export type SlotScopeKind = 'location' | 'staff';

export function scopeKey(kind: SlotScopeKind, id: Id): string {
  return `${kind}:${id}`;
}

/** Правило слотов (основное — на всю неделю, или исключение — на часть дней, F-02-054) */
export interface SlotRule {
  id: Id;
  /** Основное правило: одно на scope, всегда на все 7 дней, нельзя удалить (F-02-055) */
  isBase: boolean;
  /** К каким дням недели относится (0=пн…6=вс). У основного — все семь. */
  weekdays: (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
  density: SlotDensity;
  /** Действует только при density !== 'dynamic' */
  startMode: SlotStartMode;
  /** Окно «с — по» при startMode='from_window'; '24:00' — до конца дня */
  windowFrom: TimeHM;
  windowTo: TimeHM;
  /** Шаг записи, мин: 5…420 с шагом 5 (F-02-051) */
  stepMin: number;
  /** «Не выбрано» — undefined (F-02-052) */
  leadTimeMin?: number;
  /** Ручное выключение времени (F-02-053); только при fixed/optimal + from_window */
  disabledSlots: TimeHM[];
  name?: string;
}

export const SLOT_STEP_MIN = 5;
export const SLOT_STEP_MAX = 420;

export function newSlotRule(id: Id, overrides: Partial<SlotRule> = {}): SlotRule {
  return {
    id,
    isBase: false,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    density: 'optimal',
    startMode: 'from_window',
    // F-02-049 «у нас: 1:1» — умолчание Altegio «Онлайн-запись с 00:00 до 24:00» (справка 1135, 195130).
    // Прежний дефолт 10:00–22:00 был отступлением от 1:1 без нашего решения — снят проверкой (25.09.2026).
    windowFrom: '00:00',
    windowTo: '24:00',
    stepMin: 30,
    leadTimeMin: undefined,
    disabledSlots: [],
    ...overrides,
  };
}

/** «Утро / День / Вечер» — границы 12:00 и 18:00 (F-02-044, снято по снимкам виджета) */
export type DayPart = 'morning' | 'day' | 'evening';

export function partOfDay(time: TimeHM): DayPart {
  if (time < '12:00') return 'morning';
  if (time < '18:00') return 'day';
  return 'evening';
}

/** Недоступные дни для онлайн-записи — локации или сотрудника (F-02-042, F-02-043) */
export interface UnavailableRange {
  id: Id;
  from: ISODate;
  to: ISODate;
  note?: string;
}

// ─────────────────────────── b03: период планирования графика (F-02-030) ───────────────────────────

/** Altegio: 1 / 1.5 / 2 / 3 / 4 / 5 лет — горизонт, на который вообще можно ставить и видеть график */
export const PLANNING_PERIOD_YEARS = [1, 1.5, 2, 3, 4, 5] as const;
export type PlanningPeriodYears = (typeof PLANNING_PERIOD_YEARS)[number];
export const DEFAULT_PLANNING_PERIOD_YEARS: PlanningPeriodYears = 1;

// ─────────────────────────── b03: повторяющиеся записи (F-00-064) ───────────────────────────

export type SeriesRuleKind = 'every_n_days' | 'weekly';

/**
 * Сколько недель вперёд генерируем и на сколько продлеваем при подходе к концу. A11 (08-open-questions, принято
 * владельцем, PLAN §6 №6): 8 недель вперёд, продление ночью — сервер (booking_series) считает так же.
 */
export const SERIES_HORIZON_WEEKS = 8;
/** Когда до конца сгенерированного горизонта остаётся меньше этого — продлеваем ещё на SERIES_HORIZON_WEEKS */
export const SERIES_REFILL_WEEKS = 2;
/** Насколько далеко вперёд ищем свободное время при переносе с выходного/занятого (F-00-064 «переезжает») */
export const SERIES_MAX_SHIFT_DAYS = 14;

export interface SeriesRule {
  id: Id;
  businessId: Id;
  locationId: Id;
  staffId: Id;
  serviceId: Id;
  durationMin: number;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  kind: SeriesRuleKind;
  /** kind='every_n_days': шаг в днях, 1…60 */
  intervalDays?: number;
  /** kind='weekly': 0=пн…6=вс */
  weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time: TimeHM;
  /** Дата первого визита серии — от неё считаются все следующие */
  startDate: ISODate;
  active: boolean;
  createdAt: string;
  createdByName: string;
}

/** Одна запись серии, порождённая правилом — что показать в списке и как отменить (F-00-064) */
export interface SeriesOccurrence {
  bookingId: Id;
  date: ISODate;
  time: TimeHM;
  /** Перенесена относительно расчётного дня правила (выходной/занято → ближайшее свободное) */
  moved: boolean;
}

// ─────────────────────────── b03: «задерживаюсь» (F-00-059) ───────────────────────────

export interface DelayNotice {
  bookingId: Id;
  minutes: number;
  nextBookingId?: Id;
  sentAt: string;
}

// ─────────────────────────── b02: «услуга доступна ограниченное время» (F-02-067) ───────────────────────────

/** Какие дни недели входят в окно услуги — F-02-067 */
export type ServiceSlotWindowDays = 'any' | 'weekdays' | 'weekends' | 'custom';

/**
 * F-02-067: услуга (или пакет) доступна онлайн только в части часов/дней/периода. Переключатель и форма живут
 * на карточке услуги (раздел «online»/«services» — 02 §Онлайн-запись), здесь только хранение и расчёт в движке
 * (computeFreeSlots читает через getServiceSlotWindow). Нет записи — ограничения нет, окна как обычно.
 */
export interface ServiceSlotWindow {
  serviceId: Id;
  /** Период «с — по»; нет поля — без ограничения по датам */
  from?: ISODate;
  to?: ISODate;
  /** Часы «с — по», включительно (12:00–15:00 → последний старт 15:00); нет поля — 00:00–24:00 */
  hoursFrom?: TimeHM;
  hoursTo?: TimeHM;
  /** Дни недели: 'weekdays' — жёстко Пн–Сб (❓ у страны выходной может быть другим), 'weekends' — Вс, 'custom' — customDates */
  days: ServiceSlotWindowDays;
  /** Для days:'custom' — конкретные даты, доступные для записи (❓ один месяц или несколько — держим список без ограничения) */
  customDates?: ISODate[];
  /** У24 (28.09): конкретные дни недели из формы услуги, 0 — пн … 6 — вс; пусто — все (поверх days) */
  weekdays?: number[];
}

import type { CoreData, Id } from '@/domain/core';
import { defineSlice } from '@/mock/slice';
import { BIZ, LOC, ST } from '@/mock/seed/ids';
import { dayjs, toISODate, toISODateTime, weekdayIndex } from '@/lib/date';
import type {
  DayRecord,
  DelayNotice,
  HistoryEntry,
  PlanningPeriodYears,
  ScheduleFilters,
  ScheduleTemplate,
  ScheduleViewConfig,
  SeriesRule,
  ServiceSlotWindow,
  SlotRule,
  UnavailableRange,
} from '@/domain/schedule';
import { DEFAULT_FILTERS, DEFAULT_PLANNING_PERIOD_YEARS, DEFAULT_VIEW_CONFIG, newSlotRule, scopeKey } from '@/domain/schedule';

/**
 * Срез моковой базы раздела «schedule». Принадлежит разделу.
 *   templates      — свои шаблоны графика (F-02-009), ключ businessId
 *   days           — тип дня по (staffId, date) — ключ dayKey(); F-02-010, F-02-014
 *   viewConfig     — настройка вида таблицы (F-02-004), ключ businessId
 *   filters        — последние фильтры таблицы (F-02-003), ключ businessId
 *   history        — журнал правок графика (F-02-102), последние сверху
 *   slotRules      — правила слотов онлайн-записи (b02), ключ scopeKey('location'|'staff', id); первое
 *                    правило в списке — всегда «основное» (isBase), остальные — исключения по дням недели
 *   slotMode       — F-02-041: у кого свои правила («own»), у кого — от локации («location», по умолчанию)
 *   unavailableDays — F-02-042/043: недоступные дни для онлайн-записи, тот же scopeKey
 *   anySpecialistAllowed — F-02-079: «Разрешить запись к любому специалисту» по бизнесу
 *   skipStaffSelection   — F-02-079: у кого включён «Пропуск выбора сотрудника» (в пуле «Любой»)
 *   bufferMin      — F-02-059/F-00-057: «запас между клиентами» (технический перерыв), тот же scopeKey
 *                    (location|staff); нет ключа — 0 («Без перерыва»). Перерыв услуги (Service.bufferAfterMin)
 *                    важнее и подменяет собой это значение при расчёте окон (F-02-060) — читает движок в
 *                    computeFreeSlots/computePackageSlots/computeAnySpecialistSlots (src/api/schedule.ts).
 * Часы (WorkSchedule.overrides) и отметки (CalendarMark) пишутся в ядро через src/api/core.ts —
 * здесь дублируется только typeId для цвета/подсказки и для F-02-014 (маркер явного удаления).
 */
export interface ScheduleState {
  templates: Record<string, ScheduleTemplate[]>;
  days: Record<string, DayRecord>;
  viewConfig: Record<string, ScheduleViewConfig>;
  filters: Record<string, ScheduleFilters>;
  history: HistoryEntry[];
  slotRules: Record<string, SlotRule[]>;
  slotMode: Record<Id, 'location' | 'own'>;
  unavailableDays: Record<string, UnavailableRange[]>;
  anySpecialistAllowed: Record<Id, boolean>;
  skipStaffSelection: Record<Id, boolean>;
  /** F-02-059/F-00-057: технический перерыв после каждой записи, ключ scopeKey('location'|'staff', id) */
  bufferMin: Record<string, number>;
  /** F-02-030: горизонт планирования графика, по бизнесу */
  planningPeriodYears: Record<Id, PlanningPeriodYears>;
  /** F-02-105: уведомлять ли мастера, когда его график меняет кто-то другой (по умолчанию — нет, как у Altegio) */
  notifyMasterOnScheduleChange: Record<Id, boolean>;
  /** F-00-064: правила повторяющихся записей, по бизнесу */
  seriesRules: Record<Id, SeriesRule[]>;
  /** F-00-059: последнее «задерживаюсь» по записи, ключ — bookingId, для баннера в календаре */
  delayNotices: Record<Id, DelayNotice>;
  /**
   * F-02-085: «Ограничить доступ к истории расписания и записей», по staffId, в днях назад от сегодня.
   * Нет ключа — не ограничено; 0 — прошлое не открывается совсем. Владелец задаёт значение на карточке
   * сотрудника (вклад schedule в staffCard — ScheduleStaffCard, data-f="F-02-085"), enforcement — здесь,
   * в графике и истории (ScheduleScreen/HistoryScreen читают через isDateBeyondHistoryLimit).
   */
  historyLimitDays: Record<Id, number>;
  /**
   * F-02-066: «Разрешить онлайн-запись поверх записей со статусом „Не пришел“» — по бизнесу.
   * Нет ключа — включено (в пробном кабинете Altegio флажок включён по умолчанию). Читает движок в
   * computeFreeSlots/computeAnySpecialistSlots/computePackageSlots (src/api/schedule.ts): при включённом
   * флаге записи со статусом no_show не занимают окно, при выключенном — занимают как обычно.
   */
  allowOnlineOverNoShow: Record<Id, boolean>;
  /**
   * F-02-081: «Учитывать сотрудника в заполненности» — по staffId. Нет ключа — включено (по умолчанию, как
   * у Altegio). Владелец задаёт на карточке сотрудника («Настройки» → «Статистика»); читает раздел «reports»
   * при расчёте % заполненности (F-02-084) — здесь только хранение и переключатель.
   */
  includeInFillRate: Record<Id, boolean>;
  /**
   * F-02-090: «Синхронизация с Google Календарём» сотрудника — демо (вход через Google не выполняем).
   * Нет ключа — не подключено. Только Altegio → Google, обратно не влияет на окна (см. api/schedule.ts).
   */
  googleCalendar: Record<Id, { connected: boolean; shareClientNames: boolean }>;
  /**
   * F-02-067: «Услуга доступна ограниченное время» — ключ serviceId, тот же для пакета (packageId). Нет ключа —
   * без ограничения. Переключатель и форма — карточка услуги/пакета (online/services); здесь хранение, читает
   * движок в computeFreeSlots (src/api/schedule/slots.ts).
   */
  serviceSlotWindows: Record<Id, ServiceSlotWindow>;
}

/** Названия шаблонов из демо пустые — экран строит их на языке человека («Пн–Пт, 10:00–19:00», text-q3 №8) */
function seedTemplates(now: Date): Record<string, ScheduleTemplate[]> {
  const createdAt = toISODateTime(dayjs(now));
  return {
    [BIZ.nuri]: [
      {
        id: 'sctpl_nuri_5x2',
        businessId: BIZ.nuri,
        name: '',
        kind: 'weekdays',
        weekdays: [0, 1, 2, 3, 4],
        hours: [
          { from: '10:00', to: '14:00' },
          { from: '15:00', to: '19:00' },
        ],
        createdAt,
      },
      {
        id: 'sctpl_nuri_2x2',
        businessId: BIZ.nuri,
        name: '',
        kind: 'shifts',
        shiftWork: 2,
        shiftOff: 2,
        hours: [{ from: '10:00', to: '21:00' }],
        createdAt,
      },
    ],
    [BIZ.kaytsak]: [
      {
        id: 'sctpl_kaytsak_6x1',
        businessId: BIZ.kaytsak,
        name: '',
        kind: 'weekdays',
        weekdays: [1, 2, 3, 4, 5, 6],
        hours: [{ from: '11:00', to: '20:00' }],
        createdAt,
      },
    ],
  };
}

/** Основное правило слотов по умолчанию для каждого филиала: «Оптимальный», 00:00–24:00, шаг 30 мин (F-02-044) */
function seedSlotRules(core: CoreData): Record<string, SlotRule[]> {
  const out: Record<string, SlotRule[]> = {};
  for (const loc of core.locations) {
    out[scopeKey('location', loc.id)] = [newSlotRule(`scr_base_${loc.id}`, { isBase: true })];
  }
  return out;
}

function seedSkipStaffSelection(core: CoreData): Record<Id, boolean> {
  const out: Record<Id, boolean> = {};
  for (const s of core.staff) out[s.id] = true;
  return out;
}

function seedAnySpecialistAllowed(core: CoreData): Record<Id, boolean> {
  const out: Record<Id, boolean> = {};
  for (const b of core.businesses) out[b.id] = true;
  return out;
}

function seedPlanningPeriodYears(core: CoreData): Record<Id, PlanningPeriodYears> {
  const out: Record<Id, PlanningPeriodYears> = {};
  for (const b of core.businesses) out[b.id] = DEFAULT_PLANNING_PERIOD_YEARS;
  return out;
}

/** История правок в демо (ux-r5 H-1): 6 записей за неделю от разных людей — экран и фильтр по автору видны сразу */
function seedHistory(now: Date): HistoryEntry[] {
  const at = (daysAgo: number, time: string) => `${toISODate(dayjs(now).subtract(daysAgo, 'day'))}T${time}`;
  const d = (days: number) => toISODate(dayjs(now).add(days, 'day'));
  return [
    {
      id: 'scha_seed_1',
      at: at(0, '09:40'),
      actorStaffId: ST.nuriOwner,
      actorName: 'Нарине Акопян',
      action: 'set_hours',
      targetStaffIds: [ST.nuriAni],
      dates: [d(2)],
      summary: '',
      details: { typeId: 'work', days: 1, staff: 1, before: '10:00–19:00', after: '10:00–20:00' },
    },
    {
      id: 'scha_seed_2',
      at: at(1, '18:05'),
      actorStaffId: ST.nuriMariam,
      actorName: 'Мариам Петросян',
      action: 'set_mode',
      targetStaffIds: [ST.nuriMariam],
      dates: [],
      summary: '',
      details: { mode: 'busy' },
    },
    {
      id: 'scha_seed_3',
      at: at(2, '12:30'),
      actorStaffId: ST.nuriAdmin,
      actorName: 'Лилит Мкртчян',
      action: 'delete_days',
      targetStaffIds: [ST.nuriSona],
      dates: [d(3)],
      summary: '',
      details: { typeId: 'not_working', days: 1, staff: 1, before: '12:00–21:00', after: '—' },
    },
    {
      id: 'scha_seed_4',
      at: at(3, '10:15'),
      actorStaffId: ST.nuriOwner,
      actorName: 'Нарине Акопян',
      action: 'copy_schedule',
      targetStaffIds: [ST.nuriGayane, ST.nuriEva],
      dates: [d(0), d(6)],
      summary: '',
      details: { days: 7, staff: 1 },
    },
    {
      id: 'scha_seed_5',
      at: at(4, '16:50'),
      actorStaffId: ST.nuriAdmin,
      actorName: 'Лилит Мкртчян',
      action: 'set_hours',
      targetStaffIds: [ST.nuriEva],
      dates: [d(1), d(2), d(3), d(4), d(5)],
      summary: '',
      details: { typeId: 'work', days: 5, staff: 1 },
    },
    {
      id: 'scha_seed_6',
      at: at(6, '11:00'),
      actorStaffId: ST.nuriAni,
      actorName: 'Ани Саргсян',
      action: 'set_hours',
      targetStaffIds: [ST.nuriAni],
      dates: [d(-1)],
      summary: '',
      details: { typeId: 'vacation', days: 1, staff: 1, before: '10:00–19:00', after: '—' },
    },
  ];
}

/**
 * Две серии у Nuri Nail Studio (ux-r5 R-3): еженедельная и «каждые 21 день». Записи серии создаёт само продление при
 * открытии экрана «Регулярные записи» (extendDueSeries) — сид среза не пишет в ядро.
 */
function seedSeries(core: CoreData, now: Date): Record<Id, SeriesRule[]> {
  const ani = core.staff.find((s) => s.id === ST.nuriAni);
  const service = core.services.find((sv) => ani?.serviceIds.includes(sv.id) && sv.active);
  const clients = core.clients.filter((c) => c.businessId === BIZ.nuri && !c.deletedAt).slice(0, 2);
  if (!ani || !service || clients.length < 2) return {};
  // Первый визит — ближайший вторник (у Ани рабочий день), чтобы серия не переезжала на другие дни
  let start = toISODate(dayjs(now).add(1, 'day'));
  while (weekdayIndex(start) !== 1) start = toISODate(dayjs(start).add(1, 'day'));
  const createdAt = toISODateTime(dayjs(now).subtract(3, 'day'));
  const base = {
    businessId: BIZ.nuri,
    locationId: LOC.nuri,
    staffId: ani.id,
    serviceId: service.id,
    durationMin: service.durationMin,
    active: true,
    createdAt,
    createdByName: 'Нарине Акопян',
  };
  return {
    [BIZ.nuri]: [
      {
        ...base,
        id: 'scser_seed_weekly',
        clientId: clients[0].id,
        clientName: clients[0].name,
        kind: 'weekly',
        weekday: weekdayIndex(start),
        time: '11:00',
        startDate: start,
      },
      {
        ...base,
        id: 'scser_seed_21',
        clientId: clients[1].id,
        clientName: clients[1].name,
        kind: 'every_n_days',
        intervalDays: 21,
        time: '15:00',
        startDate: start,
      },
    ],
  };
}

export const scheduleSlice = defineSlice<ScheduleState>({
  version: 9,
  seed: (core: CoreData, now: Date) => ({
    templates: seedTemplates(now),
    days: {},
    viewConfig: {},
    filters: {},
    history: seedHistory(now),
    slotRules: seedSlotRules(core),
    slotMode: {},
    unavailableDays: {},
    anySpecialistAllowed: seedAnySpecialistAllowed(core),
    skipStaffSelection: seedSkipStaffSelection(core),
    bufferMin: {},
    planningPeriodYears: seedPlanningPeriodYears(core),
    notifyMasterOnScheduleChange: {},
    seriesRules: seedSeries(core, now),
    delayNotices: {},
    historyLimitDays: {},
    allowOnlineOverNoShow: {},
    includeInFillRate: {},
    googleCalendar: {},
    serviceSlotWindows: {},
  }),
});

export { DEFAULT_FILTERS, DEFAULT_VIEW_CONFIG };

import type { CalendarMark, DayHours, Staff, WeekTemplate, WorkSchedule, Workplace } from '@/domain/core';
import { LOC, ST } from '@/mock/seed/ids';
import { h, sameDays, week, type SeedClock } from '@/mock/seed/helpers';
import type { Rng } from '@/mock/seed/random';
import { fromMinutes, toMinutes, weekdayIndex } from '@/lib/date';

interface ScheduleDraft {
  workplace: Workplace;
  locationId: string;
  week: WeekTemplate;
  /** Смещения дней от сегодня → часы (пусто = выходной) */
  overrides?: [number, DayHours][];
  /** До какого дня открыт график (смещение от сегодня) */
  openUntil?: number;
}

const WEEKDAYS: (0 | 1 | 2 | 3 | 4 | 5)[] = [0, 1, 2, 3, 4, 5];
const lunch = (from: string, to: string, breakFrom: string, breakTo: string): DayHours => [h(from, breakFrom), h(breakTo, to)];

/** Графики мастеров и смены администраторов (пн = 0 … вс = 6). Владелец сети без услуг графика не имеет. */
const PLAN: Record<string, ScheduleDraft[]> = {
  // Nuri: салон ежедневно 10–21, у мастеров по 1–2 выходных
  [ST.nuriAni]: [
    { workplace: 'salon', locationId: LOC.nuri, week: sameDays([0, 1, 2, 3, 4], lunch('10:00', '19:00', '14:00', '15:00')) },
    // «Принимаю и дома» — по воскресеньям у себя
    { workplace: 'home', locationId: LOC.nuri, week: week({ 6: [h('11:00', '16:00')] }) },
  ],
  [ST.nuriMariam]: [{ workplace: 'salon', locationId: LOC.nuri, week: sameDays([1, 2, 3, 4, 5], [h('11:00', '20:00')]) }],
  [ST.nuriSona]: [
    {
      workplace: 'salon',
      locationId: LOC.nuri,
      // Воскресенье — самый плотный день маникюра: Сона выходит и в него (у салона в вс иначе один мастер)
      week: sameDays([0, 1, 3, 4, 5, 6], lunch('12:00', '21:00', '16:00', '16:30')),
      // Отпуск через 5 дней
      overrides: [[5, []], [6, []], [7, []], [8, []], [9, []]],
    },
  ],
  [ST.nuriGayane]: [{ workplace: 'salon', locationId: LOC.nuri, week: sameDays([0, 2, 3, 4, 5, 6], [h('10:00', '18:00')]), openUntil: 5 }],
  [ST.nuriEva]: [{ workplace: 'salon', locationId: LOC.nuri, week: sameDays([0, 1, 2, 3, 4], [h('10:00', '18:00')]) }],
  // Уволена, а график на месяц вперёд остался открытым (F-02-023) — записей к ней нет, окна клиенту не видны
  [ST.nuriFired]: [{ workplace: 'salon', locationId: LOC.nuri, week: sameDays([1, 3, 5], [h('11:00', '19:00')]) }],

  // Kaytsak: барбершоп открыт без выходных (демо в понедельник не должно показывать пустой журнал);
  // в понедельник работают Нарек и Эрик, в пятницу, субботу и воскресенье — по три барбера (самые плотные дни)
  [ST.kaytsakOwner]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([1, 2, 3, 4, 5], [h('11:00', '20:00')]) }],
  [ST.kaytsakDavid]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([1, 2, 4, 5, 6], lunch('10:00', '21:00', '15:00', '15:30')) }],
  [ST.kaytsakNarek]: [
    {
      workplace: 'salon',
      locationId: LOC.kaytsak,
      week: sameDays([0, 1, 3, 5, 6], [h('12:00', '21:00')]),
      overrides: [[-2, []], [3, [h('15:00', '21:00')]]],
    },
  ],
  // Суббота — в Kaytsak выходят все 15 мастеров (самый плотный день; нужен, чтобы видеть журнал на 15 колонок)
  [ST.kaytsakErik]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 2, 3, 4, 5, 6], [h('10:00', '19:00')]) }],
  [ST.kaytsakVahe]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 1, 3, 4, 5], [h('12:00', '21:00')]) }],
  [ST.kaytsakSamvel]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([1, 2, 3, 5, 6], lunch('10:00', '20:00', '14:00', '15:00')) }],
  [ST.kaytsakGevorg]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 2, 4, 5, 6], [h('11:00', '20:00')]) }],
  [ST.kaytsakLevon]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([1, 2, 3, 4, 5, 6], [h('10:00', '19:00')]) }],
  [ST.kaytsakArtur]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 2, 3, 4, 5, 6], [h('12:00', '21:00')]) }],
  [ST.kaytsakGarik]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 1, 3, 4, 5, 6], [h('10:00', '19:00')]) }],
  [ST.kaytsakRuben]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 1, 2, 4, 5, 6], [h('12:00', '21:00')]) }],
  [ST.kaytsakGor]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 1, 2, 3, 4, 5], [h('10:00', '19:00')]) }],
  [ST.kaytsakSuren]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([1, 2, 3, 4, 5, 6], [h('12:00', '21:00')]) }],
  [ST.kaytsakAndranik]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 2, 3, 4, 5, 6], [h('10:00', '19:00')]) }],
  [ST.kaytsakMher]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([0, 1, 3, 4, 5, 6], [h('12:00', '21:00')]) }],

  // Atam: пн–пт с обедом, в субботу дежурит главный врач
  [ST.atamOwner]: [
    {
      workplace: 'salon',
      locationId: LOC.atam,
      week: week({ 0: lunch('09:00', '17:00', '13:00', '14:00'), 1: lunch('09:00', '17:00', '13:00', '14:00'), 3: lunch('09:00', '17:00', '13:00', '14:00'), 5: [h('10:00', '15:00')] }),
    },
  ],
  [ST.atamKaren]: [
    {
      workplace: 'salon',
      locationId: LOC.atam,
      week: sameDays([0, 1, 2, 3, 4], lunch('09:00', '18:00', '13:00', '14:00')),
      // Сокращённый день послезавтра
      overrides: [[2, [h('10:00', '14:00')]]],
    },
  ],
  [ST.atamSeda]: [{ workplace: 'salon', locationId: LOC.atam, week: sameDays([0, 1, 2, 3, 4], [h('09:00', '16:00')]) }],
  [ST.atamAshot]: [{ workplace: 'salon', locationId: LOC.atam, week: sameDays([1, 2, 4], lunch('10:00', '18:00', '13:00', '14:00')) }],

  // Manana Нор-Норк / Шенгавит
  [ST.mananaArpi]: [{ workplace: 'salon', locationId: LOC.mananaNN, week: sameDays([0, 1, 2, 3, 4, 5], [h('10:00', '19:00')]) }],
  [ST.mananaNane]: [{ workplace: 'salon', locationId: LOC.mananaNN, week: sameDays([1, 2, 3, 4, 5, 6], [h('11:00', '20:00')]) }],
  [ST.mananaAnna]: [{ workplace: 'salon', locationId: LOC.mananaNN, week: sameDays([0, 2, 4, 5], lunch('10:00', '19:00', '14:00', '15:00')) }],
  [ST.mananaGor]: [{ workplace: 'salon', locationId: LOC.mananaSH, week: sameDays([0, 1, 2, 3, 4], [h('11:00', '20:00')]) }],
  [ST.mananaTamara]: [{ workplace: 'salon', locationId: LOC.mananaSH, week: sameDays([1, 3, 5], [h('10:00', '18:00')]) }],
  [ST.mananaAstghik]: [
    {
      workplace: 'salon',
      locationId: LOC.mananaSH,
      week: sameDays([0, 1, 2, 4, 5], [h('10:00', '19:00')]),
      overrides: [[1, [h('10:00', '15:00')]]],
    },
  ],

  // Индивидуалы
  [ST.lusine]: [
    { workplace: 'home', locationId: LOC.lusine, week: week({ 0: [h('11:00', '19:00')], 2: [h('11:00', '19:00')], 4: [h('11:00', '19:00')], 5: [h('11:00', '16:00')] }) },
    { workplace: 'visit', locationId: LOC.lusine, week: week({ 1: [h('12:00', '19:00')], 3: [h('12:00', '19:00')] }) },
  ],
  [ST.arman]: [
    { workplace: 'gym', locationId: LOC.arman, week: sameDays(WEEKDAYS, [h('08:00', '13:00'), h('17:00', '20:30')]) },
    { workplace: 'online', locationId: LOC.arman, week: week({ 0: [h('21:00', '22:30')], 2: [h('21:00', '22:30')] }) },
  ],
  [ST.mariam]: [
    { workplace: 'home', locationId: LOC.mariam, week: week({ 0: [h('10:00', '18:00')], 2: [h('10:00', '18:00')], 4: [h('10:00', '18:00')], 5: [h('10:00', '16:00')] }) },
    { workplace: 'visit', locationId: LOC.mariam, week: week({ 1: [h('11:00', '19:00')], 3: [h('11:00', '19:00')] }) },
  ],
  [ST.davit]: [{ workplace: 'visit', locationId: LOC.davit, week: sameDays(WEEKDAYS, lunch('09:00', '19:00', '13:30', '14:30')) }],

  // Vard Beauty Lounge: салон ежедневно 10–20
  [ST.vardLiana]: [{ workplace: 'salon', locationId: LOC.vard, week: sameDays([0, 1, 2, 4, 5], lunch('10:00', '19:00', '14:00', '14:30')) }],
  [ST.vardInessa]: [{ workplace: 'salon', locationId: LOC.vard, week: sameDays([1, 2, 3, 4, 5], [h('10:00', '20:00')]) }],
  [ST.vardKarine]: [
    {
      workplace: 'salon',
      locationId: LOC.vard,
      week: sameDays([0, 2, 3, 5], lunch('10:00', '19:00', '14:00', '15:00')),
      overrides: [[4, [h('10:00', '15:00')]]],
    },
  ],
  [ST.vardEdgar]: [{ workplace: 'salon', locationId: LOC.vard, week: sameDays([0, 1, 3, 4, 5, 6], [h('11:00', '20:00')]) }],
  // Выходные Зары — пн и чт: в пятницу в салоне четыре мастера, как и положено перед выходными
  [ST.vardZara]: [{ workplace: 'salon', locationId: LOC.vard, week: sameDays([1, 2, 4, 5, 6], [h('10:00', '18:00')]) }],

  // Новые индивидуалы
  [ST.hayk]: [{ workplace: 'home', locationId: LOC.hayk, week: week({ 1: [h('11:00', '20:00')], 2: [h('11:00', '20:00')], 3: [h('11:00', '20:00')], 4: [h('11:00', '20:00')], 5: [h('11:00', '20:00')], 6: [h('12:00', '17:00')] }) }],
  [ST.meline]: [{ workplace: 'home', locationId: LOC.meline, week: week({ 0: [h('10:00', '19:00')], 1: [h('10:00', '19:00')], 2: [h('10:00', '19:00')], 3: [h('10:00', '19:00')], 4: [h('10:00', '19:00')], 5: [h('10:00', '16:00')] }) }],
  [ST.shushan]: [
    { workplace: 'home', locationId: LOC.shushan, week: week({ 0: [h('10:00', '19:00')], 1: [h('10:00', '19:00')], 3: [h('10:00', '19:00')], 4: [h('10:00', '19:00')] }) },
    // Выезд к невестам — по выходным с утра
    { workplace: 'visit', locationId: LOC.shushan, week: week({ 5: [h('08:00', '14:00')], 6: [h('08:00', '13:00')] }) },
  ],

  // Администраторы — смены на ресепшене (payroll.md F-09-036: без графика «8 000 за день» давало 0). Услуг у них нет,
  // в журнале колонкой не показываются (hiddenInJournal в сиде сотрудников), записи к ним не создаются
  [ST.nuriAdmin]: [{ workplace: 'salon', locationId: LOC.nuri, week: sameDays([0, 1, 2, 3, 4], [h('10:00', '19:00')]) }],
  [ST.kaytsakAdmin]: [{ workplace: 'salon', locationId: LOC.kaytsak, week: sameDays([1, 2, 3, 4, 5], [h('11:00', '20:00')]) }],
  [ST.atamAdmin]: [{ workplace: 'salon', locationId: LOC.atam, week: sameDays([0, 1, 2, 3, 4], [h('09:00', '17:00')]) }],
  [ST.mananaNNAdmin]: [{ workplace: 'salon', locationId: LOC.mananaNN, week: sameDays([0, 1, 2, 3, 4], [h('10:00', '19:00')]) }],
  [ST.mananaSHAdmin]: [{ workplace: 'salon', locationId: LOC.mananaSH, week: sameDays([1, 2, 3, 4, 5], [h('10:00', '19:00')]) }],
  [ST.vardAdmin]: [{ workplace: 'salon', locationId: LOC.vard, week: sameDays([0, 1, 2, 3, 4], [h('10:00', '19:00')]) }],
};

export function buildSchedules(staff: Staff[], clock: SeedClock): WorkSchedule[] {
  const out: WorkSchedule[] = [];
  let n = 0;
  for (const s of staff) {
    const drafts = PLAN[s.id];
    if (!drafts) continue;
    for (const d of drafts) {
      n++;
      const overrides: Record<string, DayHours> = {};
      d.overrides?.forEach(([offset, hours]) => {
        // «Сокращённый день» ставим только на рабочий день мастера: иначе, если «послезавтра» выпало на выходной,
        // стоматолог выходил в воскресенье при закрытой клинике. Сдвигаем на ближайший рабочий день вперёд.
        let day = offset;
        if (hours.length > 0) {
          while (day < offset + 7 && d.week[weekdayIndex(clock.day(day))].length === 0) day++;
        }
        overrides[clock.day(day)] = hours;
      });
      out.push({
        id: `sch_${String(n).padStart(2, '0')}`,
        staffId: s.id,
        locationId: d.locationId,
        workplace: d.workplace,
        week: d.week,
        overrides,
        openUntil: clock.day(d.openUntil ?? 30),
      });
    }
  }
  return out;
}

/** Часы графика на дату (с учётом исключений) */
export function hoursOn(schedule: WorkSchedule, date: string): DayHours {
  return schedule.overrides[date] ?? schedule.week[weekdayIndex(date)];
}

/**
 * Отметки календаря (F-00-051):
 *  — мастерам в режиме «всё занято» открываем окна ('free') на 2 недели вперёд;
 *  — нескольким мастерам в режиме «всё свободно» ставим 'busy' (личные дела, учёба).
 */
export function buildMarks(staff: Staff[], schedules: WorkSchedule[], rng: Rng, clock: SeedClock): CalendarMark[] {
  const marks: CalendarMark[] = [];
  let n = 0;
  const push = (m: Omit<CalendarMark, 'id'>) => marks.push({ ...m, id: `mk_${String(++n).padStart(3, '0')}` });

  for (const s of staff.filter((x) => x.calendarMode === 'busy' && x.status === 'active')) {
    for (const sch of schedules.filter((x) => x.staffId === s.id)) {
      for (let d = 0; d < 14; d++) {
        const date = clock.day(d);
        for (const r of hoursOn(sch, date)) {
          let t = toMinutes(r.from);
          const end = toMinutes(r.to);
          // Мастер открывает не всё: окна по 2–4 часа с промежутками
          if (rng.chance(0.25)) t += rng.pick([60, 90]);
          while (t + 60 <= end) {
            const len = Math.min(rng.pick([120, 150, 180, 240]), end - t);
            push({ staffId: s.id, date, from: fromMinutes(t), to: fromMinutes(t + len), kind: 'free', workplace: sch.workplace });
            t += len + rng.pick([60, 90, 120]);
          }
        }
      }
    }
  }

  const busy: [string, number, string, string, string][] = [
    [ST.nuriAni, 0, '13:00', '14:00', 'Личное'],
    [ST.kaytsakDavid, 2, '16:00', '18:00', 'Учёба: курс по фейдам'],
    [ST.mananaGor, 1, '15:00', '16:00', 'Врач'],
    [ST.atamSeda, 4, '09:00', '11:00', 'Конференция'],
    [ST.davit, 3, '09:00', '12:00', 'Техобслуживание машины'],
    [ST.lusine, 6, '11:00', '13:00', 'Семейное'],
    [ST.vardInessa, 3, '10:00', '12:00', 'Обучение: новая палитра'],
    [ST.hayk, 2, '15:00', '16:00', 'Личное'],
  ];
  busy.forEach(([staffId, offset, from, to, note]) => push({ staffId, date: clock.day(offset), from, to, kind: 'busy', note }));
  return marks;
}

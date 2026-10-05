import type { CoreData, Id } from '@/domain/core';
import { estimateTotalOf, type Order, type OrderEstimate, type OrderHistoryEntry, type OrderItem, type OrderStatus, type OrdersSettings } from '@/domain/orders';
import { dayjs, toISODate } from '@/lib/date';
import { BIZ, LOC, ST } from '@/mock/seed/ids';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «Заказы» (03.10.2026). Принадлежит разделу.
 * orders — все заказы всех бизнесов (номер — свой у каждого бизнеса, с 1001); settings — «Заказы» вкл/выкл по
 * businessId (нет записи — по сфере бизнеса: defaultOrdersEnabled). Демо — мастерская FixPoint (сфера repair).
 * Меняете форму — поднимите version.
 */
export interface OrdersState {
  orders: Order[];
  settings: Record<Id, OrdersSettings>;
}

/** Публичный код заказа «Готов» в демо — для замеров и ссылки из отчёта: /o/fxpt7k2m9q */
export const DEMO_READY_ORDER_CODE = 'fxpt7k2m9q';
/** Заказ, где смета ждёт ответа клиента: /o/v3xd7nh9ga и /biz/orders/ord_fix_1020 */
export const DEMO_ESTIMATE_ORDER_CODE = 'v3xd7nh9ga';

interface Plan {
  n: number;
  code: string;
  client: [Id | null, string, string];
  items: OrderItem[];
  staff: Id | null;
  /** Путь статусов: [статус, дней назад, время] */
  path: [OrderStatus, number, string][];
  /** Срок: дней от сегодня (null — без срока) */
  due: number | null;
  price: number;
  prepaid: number;
  comment?: string;
  /** Авто-напоминания «заказ ждёт вас», уже ушедшие: [дней назад, время] */
  reminders?: [number, string][];
  /** ⭐ Смета (05.10.2026): строки, комментарий, когда отправили и что ответил клиент */
  estimate?: {
    lines: [string, number][];
    comment?: string;
    sent: [number, string];
    decided?: { status: 'approved' | 'declined'; at: [number, string]; note?: string };
  };
}

const PLANS: Plan[] = [
  {
    // Готов 9 дней назад и не забран — клиенту уже дважды напомнили (3-й и 7-й день): «Напомнили клиенту: 2 раза»
    n: 1011, code: 'g8mz3wq6tr', client: ['cl_fix_02', 'Давид Саркисян', '+37400170002'],
    items: [{ title: 'Samsung Galaxy Tab S7 — замена гнезда зарядки', qty: 1 }],
    staff: ST.fixNarek, path: [['received', 22, '12:40'], ['in_progress', 21, '10:15'], ['ready', 9, '15:20']],
    due: -10, price: 16000, prepaid: 5000, comment: 'Гнездо ждали от поставщика две недели', reminders: [[6, '15:20'], [2, '15:20']],
  },
  {
    n: 1012, code: 'k4qz8m2wte', client: ['cl_fix_02', 'Давид Саркисян', '+37400170002'],
    items: [{ title: 'iPhone 12 — замена экрана', qty: 1, note: 'Трещина по диагонали, Face ID работает' }],
    staff: ST.fixTigran, path: [['received', 21, '11:20'], ['in_progress', 20, '10:05'], ['ready', 19, '16:40'], ['issued', 18, '18:10']],
    due: -19, price: 38000, prepaid: 10000,
  },
  {
    n: 1013, code: 'p9wr3xv7ha', client: ['cl_fix_03', 'Лилит Аветисян', '+37400170003'],
    items: [{ title: 'Samsung A52 — не заряжается', qty: 1 }, { title: 'Зарядный кабель', qty: 1 }],
    staff: ST.fixNarek, path: [['received', 16, '13:00'], ['in_progress', 15, '11:30'], ['ready', 13, '15:15'], ['issued', 12, '12:45']],
    due: -13, price: 12000, prepaid: 0,
  },
  {
    // Смета после диагностики — клиент отказался по ссылке, ноутбук выдали без ремонта
    n: 1014, code: 'm3jt6yb2rk', client: ['cl_fix_04', 'Карен Манукян', '+37400170004'],
    items: [{ title: 'MacBook Air — залит чаем', qty: 1, note: 'Не включается' }],
    staff: ST.fixTigran, path: [['received', 12, '17:30'], ['issued', 10, '12:00']],
    due: -7, price: 5000, prepaid: 0, comment: 'Клиент отказался от ремонта после диагностики',
    estimate: {
      lines: [['Замена материнской платы', 165000], ['Чистка после залития', 10000], ['Работа мастера', 15000]],
      sent: [11, '13:10'],
      decided: { status: 'declined', at: [11, '18:40'], note: 'Дорого, куплю новый' },
    },
  },
  {
    n: 1015, code: 'w2hn5ce8ud', client: [null, 'Сона Карапетян', '+37400170011'],
    items: [{ title: 'iPad 9 — замена стекла', qty: 1 }],
    staff: ST.fixNarek, path: [['received', 9, '10:40'], ['in_progress', 9, '14:00'], ['ready', 7, '17:20'], ['issued', 6, '11:05']],
    due: -7, price: 25000, prepaid: 5000,
  },
  {
    n: 1016, code: 'r8ky4tq3nb', client: ['cl_fix_05', 'Мери Петросян', '+37400170005'],
    items: [{ title: 'Xiaomi Redmi Note 11 — аккумулятор', qty: 1 }],
    staff: ST.fixTigran, path: [['received', 6, '12:15'], ['in_progress', 5, '10:00'], ['ready', 4, '13:30'], ['issued', 3, '19:00']],
    due: -4, price: 9000, prepaid: 0,
  },
  {
    n: 1017, code: 'c6ev9pz4xm', client: ['cl_fix_06', 'Гор Хачатрян', '+37400170006'],
    items: [{ title: 'iPhone 13 Pro — замена камеры', qty: 1, note: 'Царапина на корпусе была при приёме' }],
    staff: ST.fixNarek, path: [['received', 5, '15:40'], ['in_progress', 4, '11:10']],
    due: -1, price: 42000, prepaid: 15000, comment: 'Ждём модуль камеры от поставщика',
    estimate: {
      lines: [['Модуль камеры iPhone 13 Pro', 34000], ['Работа мастера', 8000]],
      sent: [4, '10:20'],
      decided: { status: 'approved', at: [4, '11:10'], note: 'Делайте, жду' },
    },
  },
  {
    n: 1018, code: 'h7ub2rs5kw', client: [null, 'Эдгар Мартиросян', '+37400170012'],
    items: [{ title: 'PlayStation 5 — чистка и термопаста', qty: 1 }, { title: 'Геймпад DualSense — дрифт стика', qty: 2 }],
    staff: ST.fixTigran, path: [['received', 3, '18:20'], ['in_progress', 2, '10:30']],
    due: 1, price: 27000, prepaid: 10000,
  },
  {
    n: 1019, code: 'b5tm8wq2je', client: ['cl_fix_07', 'Ануш Григорян', '+37400170007'],
    items: [{ title: 'Apple Watch S7 — замена стекла', qty: 1 }],
    staff: ST.fixNarek, path: [['received', 2, '11:50'], ['in_progress', 1, '12:00'], ['ready', 0, '10:15']],
    due: 0, price: 18000, prepaid: 0,
  },
  {
    // Смета отправлена — ждём ответа клиента (DEMO_ESTIMATE_ORDER_CODE)
    n: 1020, code: 'v3xd7nh9ga', client: ['cl_fix_08', 'Артур Мкртчян', '+37400170008'],
    items: [{ title: 'Ноутбук Lenovo — не видит Wi-Fi', qty: 1 }],
    staff: ST.fixTigran, path: [['received', 1, '17:05']],
    due: 3, price: 3000, prepaid: 0, comment: 'Сначала диагностика, цену уточним',
    estimate: {
      lines: [['Замена модуля Wi-Fi', 9000], ['Работа мастера', 5000]],
      comment: 'Модуль есть в наличии — сделаем за день',
      sent: [1, '18:30'],
    },
  },
  {
    n: 1021, code: 'f2kq6ty8ws', client: [null, 'Нарине Оганесян', '+37400170013'],
    items: [{ title: 'Samsung S21 — замена разъёма', qty: 1 }],
    staff: ST.fixTigran, path: [['received', 0, '10:30']],
    due: 2, price: 11000, prepaid: 3000,
  },
  {
    n: 1022, code: 'n9re4bm3tc', client: ['cl_fix_03', 'Лилит Аветисян', '+37400170003'],
    items: [{ title: 'Наушники AirPods Pro — хрип в левом', qty: 1 }],
    staff: ST.fixNarek, path: [['received', 0, '11:45'], ['in_progress', 0, '12:30']],
    due: 4, price: 15000, prepaid: 0,
  },
  {
    n: 1023, code: 'q7wp2hx5ld', client: [null, 'Ваграм Саакян', '+37400170014'],
    items: [{ title: 'iPhone 11 — замена аккумулятора', qty: 1 }],
    staff: ST.fixTigran, path: [['received', 4, '16:00'], ['in_progress', 3, '10:20']],
    due: -2, price: 14000, prepaid: 0,
  },
  {
    n: 1024, code: DEMO_READY_ORDER_CODE, client: ['cl_fix_01', 'Ани Мелкумян', '+37400160001'],
    items: [
      { title: 'iPhone 14 — замена экрана', qty: 1, note: 'Оригинальный дисплей' },
      { title: 'Защитное стекло', qty: 1 },
    ],
    staff: ST.fixTigran, path: [['received', 2, '12:10'], ['in_progress', 1, '10:00'], ['ready', 0, '14:30']],
    due: 0, price: 52000, prepaid: 20000,
  },
];

/** Смета из плана: события в истории (перед сменой статуса в ту же минуту) и сама смета */
function seedEstimate(p: Plan, statuses: OrderHistoryEntry[], at: (d: number, time: string) => string): { history: OrderHistoryEntry[]; estimate: OrderEstimate | null } {
  if (!p.estimate) return { history: statuses, estimate: null };
  const e = p.estimate;
  const lines = e.lines.map(([title, price]) => ({ title, price }));
  const total = estimateTotalOf(lines);
  const statusAt = (when: string) => [...statuses].reverse().find((h) => h.at <= when)?.status ?? 'received';
  const sentAt = at(...e.sent);
  const events: OrderHistoryEntry[] = [{ at: sentAt, status: statusAt(sentAt), by: p.staff ?? ST.fixOwner, event: 'estimate_sent', amount: total }];
  const decidedAt = e.decided ? at(...e.decided.at) : null;
  if (e.decided && decidedAt) {
    const event = e.decided.status === 'approved' ? 'estimate_approved' : 'estimate_declined';
    events.push({ at: decidedAt, status: statusAt(decidedAt) === 'in_progress' && e.decided.status === 'approved' ? 'received' : statusAt(decidedAt), by: null, event, ...(e.decided.note ? { note: e.decided.note } : {}) });
  }
  // События сметы — перед сменой статуса в ту же минуту («согласился» → «взяли в работу»)
  const history = [...statuses, ...events].sort((a, b) => a.at.localeCompare(b.at) || (a.event ? 0 : 1) - (b.event ? 0 : 1));
  return {
    history,
    estimate: {
      status: e.decided?.status ?? 'pending',
      version: 1,
      lines,
      total,
      comment: e.comment ?? null,
      sentAt,
      remindedAt: null,
      decidedAt,
      decidedBy: e.decided ? 'client' : null,
      clientComment: e.decided?.note ?? null,
    },
  };
}

export const ordersSlice = defineSlice<OrdersState>({
  version: 3,
  seed: (core: CoreData, now: Date) => {
    if (!core.businesses.some((b) => b.id === BIZ.fixpoint)) return { orders: [], settings: {} };
    const at = (daysAgo: number, time: string) => `${toISODate(dayjs(now).subtract(daysAgo, 'day'))}T${time}`;
    const day = (offset: number) => toISODate(dayjs(now).add(offset, 'day'));
    const orders = PLANS.map((p): Order => {
      const statuses: OrderHistoryEntry[] = p.path.map(([status, d, time]) => ({ at: at(d, time), status, by: status === 'received' ? ST.fixOwner : p.staff ?? ST.fixOwner }));
      const last = statuses[statuses.length - 1];
      const ready = [...statuses].reverse().find((h) => h.status === 'ready');
      const issued = statuses.find((h) => h.status === 'issued');
      const { history, estimate } = seedEstimate(p, statuses, at);
      return {
        id: `ord_fix_${p.n}`,
        businessId: BIZ.fixpoint,
        locationId: LOC.fixpoint,
        number: p.n,
        code: p.code,
        clientId: p.client[0],
        clientName: p.client[1],
        clientPhone: p.client[2],
        items: p.items,
        photos: [],
        staffId: p.staff,
        status: last.status,
        dueDate: p.due === null ? null : day(p.due),
        price: p.price,
        prepaid: p.prepaid,
        comment: p.comment ?? null,
        history,
        readyNotifiedAt: ready ? ready.at : null,
        issuedAt: issued ? issued.at : null,
        pickupReminderCount: p.reminders?.length ?? 0,
        pickupRemindedAt: p.reminders?.length ? at(...p.reminders[p.reminders.length - 1]) : null,
        estimate,
        createdAt: history[0].at,
        updatedAt: last.at,
      };
    });
    return { orders: orders.reverse(), settings: {} };
  },
});

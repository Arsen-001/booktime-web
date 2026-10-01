import type {
  Booking,
  BookingForWhom,
  BookingSource,
  BookingStatus,
  Business,
  CalendarMark,
  Client,
  GroupEvent,
  Resource,
  Service,
  SphereId,
  Staff,
  WorkSchedule,
  Workplace,
} from '@/domain/core';
import { dayjs, fromMinutes, toMinutes, weekdayIndex } from '@/lib/date';
import type { SeedClock } from '@/mock/seed/helpers';
import { BIZ, ST } from '@/mock/seed/ids';
import { FEMALE_NAMES, MALE_NAMES } from '@/mock/seed/names';
import type { Rng } from '@/mock/seed/random';
import { hoursOn } from '@/mock/seed/schedules';

export interface BookingSeedInput {
  rng: Rng;
  clock: SeedClock;
  businesses: Business[];
  staff: Staff[];
  services: Service[];
  clients: Client[];
  resources: Resource[];
  schedules: WorkSchedule[];
  marks: CalendarMark[];
}

type Interval = [number, number];

interface DayInterval {
  a: number;
  b: number;
  workplace: Workplace;
  locationId: string;
}

const DAYS_BACK = 30;
const DAYS_AHEAD = 30;

/** Вероятность «занять» очередной промежуток по удалённости дня от сегодня */
function fillChance(offset: number): number {
  if (offset < 0) return 0.2;
  if (offset === 0) return 0.55;
  if (offset <= 3) return 0.36;
  if (offset <= 7) return 0.24;
  if (offset <= 14) return 0.13;
  return 0.06;
}

/** Комментарии к записи: общие (без рода — клиент бывает и мужчиной) + по сфере бизнеса */
const COMMENTS_COMMON = [
  'Напомнить за день',
  'Первый визит',
  'Может опоздать на 10 минут',
  'Оплата картой',
  'Перенос с прошлой недели',
  'Подарочный сертификат',
  'Нужен чек для работы',
  'Запись после сторис со свободным окном',
  'Хочет к тому же мастеру, что в прошлый раз',
];

const COMMENTS_BY_SPHERE: Partial<Record<SphereId, string[]>> = {
  nails: ['Тот же оттенок, что в прошлый раз', 'Покажет фото дизайна', 'Снять старое покрытие'],
  barber: ['Как в прошлый раз: фейд, сверху 4 см', 'Бороду подровнять, не коротко', 'Покажет фото стрижки'],
  hair: ['Тот же оттенок, что в прошлый раз', 'Покажет фото желаемого результата', 'Укладка к свадьбе сестры'],
  cosmetology: ['Прийти без макияжа', 'Покажет фото бровей, которые нравятся'],
  dental: ['Болит справа внизу', 'Принесёт прошлый снимок', 'Нужна справка для работы'],
  massage: ['Болит поясница', 'Без ароматических масел'],
  fitness: ['Цель — минус 5 кг', 'После травмы колена'],
};

const commentsFor = (spheres: SphereId[] | undefined): string[] => [
  ...(spheres ?? []).flatMap((sp) => COMMENTS_BY_SPHERE[sp] ?? []),
  ...COMMENTS_COMMON,
];

const VISIT_COMMENTS = [
  'Адрес: ул. Бабаяна, 14, подъезд 2, код 45',
  'Адрес: пр. Маштоца, 33, 5 этаж, домофон 17',
  'Адрес: ул. Орбели, 8 — парковка во дворе',
  'Адрес: ул. Раффи, 101, частный дом, ворота зелёные',
];

const CAR_COMMENTS = [
  'Toyota Camry, белая, 45 KK 707',
  'BMW X5, чёрный, 01 BB 808',
  'Kia Rio, серая, 35 AA 101',
  'Toyota Prius, белая, 10 OO 202',
  'Hyundai Sonata, чёрная, 77 LL 303',
  'Lada Niva, зелёная, 21 SS 404',
  'Nissan Leaf, синяя, 55 XX 505',
  'Mercedes E, серебристая, 99 MM 606',
];

export function buildBookings(input: BookingSeedInput): { bookings: Booking[]; groupEvents: GroupEvent[] } {
  const { rng, clock, staff, services, clients, resources, schedules, marks, businesses } = input;
  const bookings: Booking[] = [];
  const groupEvents: GroupEvent[] = [];
  const occ = new Map<string, Interval[]>();
  const resOcc = new Map<string, Interval[]>();
  const instOcc = new Map<string, Interval[]>();
  const resourceById = new Map(resources.map((r) => [r.id, r] as const));

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const businessById = new Map(businesses.map((b) => [b.id, b]));
  const clientsByBusiness = new Map<string, Client[]>();
  clients.forEach((c) => clientsByBusiness.set(c.businessId, [...(clientsByBusiness.get(c.businessId) ?? []), c]));
  const adminOf = new Map<string, string>();
  staff.filter((s) => s.role === 'admin' && s.status === 'active').forEach((s) => adminOf.set(s.businessId, s.id));

  const occKey = (staffId: string, date: string) => `${staffId}|${date}`;
  const overlaps = (list: Interval[] | undefined, a: number, b: number) => list?.find(([x, y]) => a < y && b > x);
  const reserve = (map: Map<string, Interval[]>, key: string, a: number, b: number) => {
    const list = map.get(key) ?? [];
    list.push([a, b]);
    map.set(key, list);
  };
  const resourcesOf = (svc: Service) => resources.filter((r) => r.active && r.serviceIds.includes(svc.id));
  const resourcesFree = (list: Resource[], date: string, a: number, b: number) =>
    list.every((r) => {
      const used = (resOcc.get(`${r.id}|${date}`) ?? []).filter(([x, y]) => a < y && b > x).length;
      return used < r.instances.length;
    });

  const pickPrice = (svc: Service) =>
    svc.priceMax && svc.priceMax > svc.priceMin ? svc.priceMin + 500 * rng.int(0, Math.floor((svc.priceMax - svc.priceMin) / 500)) : svc.priceMin;
  const pickDuration = (svc: Service) =>
    svc.durationMax && svc.durationMax > svc.durationMin
      ? svc.durationMin + 15 * rng.int(0, Math.floor((svc.durationMax - svc.durationMin) / 15))
      : svc.durationMin;
  const ceil15 = (m: number) => Math.ceil(m / 15) * 15;

  /** Редкие услуги (детские, снятие, укладка, снимок) выбираются реже основных */
  const serviceWeight = (svc: Service) =>
    /kids/.test(svc.id) ? 0.2 : /remove|style|xray|fluor|design|plan/.test(svc.id) ? 0.5 : 1;
  const pickServices = (list: Service[], n: number): Service[] => {
    const pool = [...list];
    const out: Service[] = [];
    while (pool.length && out.length < n) {
      const svc = rng.weighted(pool.map((x) => [x, serviceWeight(x)] as const));
      out.push(svc);
      pool.splice(pool.indexOf(svc), 1);
    }
    return out;
  };

  /** Прошло ли время (дата + минуты) относительно «сейчас» */
  const isPast = (date: string, minute: number) => date < clock.today || (date === clock.today && minute <= clock.nowMin);

  const pickStatus = (date: string, a: number, b: number, s: Staff, total: number): BookingStatus => {
    const r = rng.next();
    if (isPast(date, b)) {
      if (r < 0.8) return 'arrived';
      if (r < 0.86) return 'no_show';
      if (r < 0.95) return 'cancelled_by_client';
      return 'cancelled_by_master';
    }
    if (isPast(date, a)) return 'arrived';
    if (s.confirmMode === 'manual' && r < 0.35) return 'awaiting_confirmation';
    if (total >= 15000 && r > 0.9) return 'awaiting_prepayment';
    if (r < 0.06) return 'cancelled_by_client';
    return r < 0.55 ? 'scheduled' : 'client_confirmed';
  };

  const createdAtFor = (offset: number) => {
    const back = rng.int(0, 12);
    const candidate = clock.at(offset - back, `${String(rng.int(8, 22)).padStart(2, '0')}:${rng.pick(['04', '12', '27', '39', '51'])}`);
    const nowStr = clock.minutesFromNow(0);
    return candidate < nowStr ? candidate : clock.minutesFromNow(-rng.int(20, 900));
  };

  let seq = 0;
  /**
   * Записи демо-клиента au_01 (шаг 3) получают постоянные номера bk_0080… — на них ссылаются сквозные проверки
   * и сценарии (qa/e2e, qa/scenarios); остальные записи эти номера пропускают, сколько бы их ни было до шага 3.
   */
  const DEMO_FIRST_SEQ = 80;
  const DEMO_PLAN_SIZE = 7;
  const bookingId = (n: number) => `bk_${String(n).padStart(4, '0')}`;
  const nextSeqId = () => {
    do ++seq;
    while (seq >= DEMO_FIRST_SEQ && seq < DEMO_FIRST_SEQ + DEMO_PLAN_SIZE);
    return bookingId(seq);
  };
  /** «Любой сотрудник» (F-01-028) — у пары будущих онлайн-записей салона, у остальных онлайн — «этот специалист» */
  let anyStaffLeft = 2;
  interface PlaceOptions {
    staff: Staff;
    offset: number;
    date: string;
    a: number;
    lines: { svc: Service; dur: number; price: number }[];
    workplace: Workplace;
    locationId: string;
    client?: Client;
    source?: BookingSource;
    appUserId?: string;
    status?: BookingStatus;
    seriesId?: string;
    groupEventId?: string;
    resourceIds?: string[];
    forWhom?: BookingForWhom;
    visitorName?: string;
    comment?: string;
    id?: string;
  }

  const place = (o: PlaceOptions): Booking => {
    const duration = o.lines.reduce((sum, l) => sum + l.dur, 0);
    const b = o.a + duration;
    const total = o.lines.reduce((sum, l) => sum + l.price, 0);
    const status = o.status ?? pickStatus(o.date, o.a, b, o.staff, total);

    let source: BookingSource;
    let createdBy: string;
    let appUserId = o.appUserId;
    if (o.source) {
      source = o.source;
      createdBy = source === 'app' || source === 'link' || source === 'widget' ? 'client' : adminOf.get(o.staff.businessId) ?? o.staff.id;
    } else if (o.client?.appUserId && rng.chance(0.55)) {
      source = 'app';
      createdBy = 'client';
      appUserId = o.client.appUserId;
    } else {
      source = rng.weighted<BookingSource>([
        ['journal', 45],
        ['phone', 25],
        ['link', 18],
        ['widget', 12],
      ]);
      const admin = adminOf.get(o.staff.businessId);
      createdBy = source === 'link' || source === 'widget' ? 'client' : admin && rng.chance(0.6) ? admin : o.staff.id;
    }
    if (source === 'app' && !appUserId) appUserId = o.client?.appUserId;

    const heldResources = o.resourceIds ?? [...new Set(o.lines.flatMap((l) => resourcesOf(l.svc).map((r) => r.id)))];
    heldResources.forEach((r) => reserve(resOcc, `${r}|${o.date}`, o.a, b));
    // Запись держит ЭКЗЕМПЛЯР ресурса («Кресло 2»), как её создал бы placeBooking — не id самого ресурса: иначе движок
    // занятости (он сверяет экземпляры) не видел сидовых записей, и журнал/виджет отдавали занятое кресло второй записи.
    const resourceIds = heldResources.map((rid) => {
      const res = resourceById.get(rid);
      if (!res || !res.instances.length) return rid;
      const inst = res.instances.find((i) => !overlaps(instOcc.get(`${i.id}|${o.date}`), o.a, b)) ?? res.instances[0];
      reserve(instOcc, `${inst.id}|${o.date}`, o.a, b);
      return inst.id;
    });
    if (!o.groupEventId) reserve(occ, occKey(o.staff.id, o.date), o.a, b);

    let prepayment: Booking['prepayment'];
    if (status === 'awaiting_prepayment') prepayment = { amount: Math.max(2000, Math.round((total * 0.3) / 1000) * 1000), paid: false };
    else if (total >= 30000 && rng.chance(0.3)) prepayment = { amount: Math.round((total * 0.3) / 1000) * 1000, paid: true };

    const createdAt = createdAtFor(o.offset);
    const online = source === 'app' || source === 'link' || source === 'widget';
    let staffAssignment: Booking['staffAssignment'];
    if (online) {
      const salon = businessById.get(o.staff.businessId)?.kind === 'salon';
      const pickAny = salon && anyStaffLeft > 0 && o.offset > 0 && !o.groupEventId && (bookings.length + 1) % 7 === 0;
      if (pickAny) anyStaffLeft--;
      staffAssignment = pickAny ? 'any' : 'specific';
    }
    const booking: Booking = {
      id: o.id ?? nextSeqId(),
      businessId: o.staff.businessId,
      locationId: o.locationId,
      staffId: o.staff.id,
      clientId: o.client?.id,
      appUserId: source === 'app' ? appUserId : undefined,
      start: `${o.date}T${fromMinutes(o.a)}`,
      durationMin: duration,
      status,
      services: o.lines.map((l) => ({ serviceId: l.svc.id, staffId: o.staff.id, price: l.price, durationMin: l.dur, qty: 1 })),
      total,
      resourceIds,
      workplace: o.workplace,
      source,
      createdBy,
      forWhom: o.forWhom ?? 'self',
      visitorName: o.visitorName,
      comment: o.comment,
      prepayment,
      groupEventId: o.groupEventId,
      seriesId: o.seriesId,
      staffAssignment,
      createdAt,
      updatedAt: createdAt,
    };
    bookings.push(booking);
    return booking;
  };

  const schedulesOf = (staffId: string) => schedules.filter((s) => s.staffId === staffId);
  const servicesOf = (s: Staff, workplace: Workplace) =>
    services.filter((x) => x.active && x.kind === 'individual' && x.staffIds.includes(s.id) && x.workplaces.includes(workplace));

  /** Рабочие промежутки мастера на дату (график или открытые окна) минус отметки «занято» */
  const dayIntervals = (s: Staff, offset: number): DayInterval[] => {
    const date = clock.day(offset);
    const out: DayInterval[] = [];
    for (const sch of schedulesOf(s.id)) {
      if (offset >= 0 && sch.openUntil && date > sch.openUntil) continue;
      const ranges =
        s.calendarMode === 'busy' && offset >= 0
          ? marks.filter((m) => m.staffId === s.id && m.date === date && m.kind === 'free' && (m.workplace ?? sch.workplace) === sch.workplace)
          : hoursOn(sch, date);
      ranges.forEach((r) => out.push({ a: toMinutes(r.from), b: toMinutes(r.to), workplace: sch.workplace, locationId: sch.locationId }));
    }
    const busy = marks.filter((m) => m.staffId === s.id && m.date === date && m.kind === 'busy');
    busy.forEach((m) => reserve(occ, occKey(s.id, date), toMinutes(m.from), toMinutes(m.to)));
    return out.sort((x, y) => x.a - y.a);
  };

  // Демо-персона «Клиент» (au_01) получает только свои запланированные записи — «Мои записи» остаются обозримыми
  /**
   * Профиль клиента по истории визитов (ux-clients №2, F-04-014): ~15% новых (первый визит за последние 30 дней),
   * ~25% потерянных (последний визит больше 90 дней назад), остальные — постоянные с историей до 18 месяцев.
   * Клиенты приложения — постоянные.
   */
  const profileOf = new Map<string, 'new' | 'lost' | 'regular'>();
  for (const list of clientsByBusiness.values()) {
    list.forEach((c, i) => {
      const k = i % 20;
      profileOf.set(c.id, c.appUserId ? 'regular' : k < 3 ? 'new' : k < 8 ? 'lost' : 'regular');
    });
  }
  const lostIds = new Set([...profileOf].filter(([, p]) => p === 'lost').map(([id]) => id));

  /**
   * «Свои» клиенты мастера: ~40% базы бизнеса поделены между его мастерами и получают ~60% записей.
   * Так в демо появляются постоянные клиенты (F-00-117), а не равномерный шум по всей базе.
   */
  const regularsOf = new Map<string, Client[]>();
  for (const [businessId, list] of clientsByBusiness) {
    const masters = staff.filter((s) => s.businessId === businessId && s.status === 'active' && services.some((x) => x.staffIds.includes(s.id)));
    if (!masters.length) continue;
    const eligible = rng.shuffle(list.filter((c) => c.appUserId !== 'au_01' && !c.blocked && profileOf.get(c.id) === 'regular'));
    eligible.slice(0, Math.round(list.length * 0.4)).forEach((c, i) => {
      const m = masters[i % masters.length].id;
      regularsOf.set(m, [...(regularsOf.get(m) ?? []), c]);
    });
  }

  const pickClient = (businessId: string, future: boolean, staffId?: string): Client | undefined => {
    const list = (clientsByBusiness.get(businessId) ?? []).filter(
      (c) => c.appUserId !== 'au_01' && !(future && c.blocked) && !lostIds.has(c.id),
    );
    if (!list.length || rng.chance(0.02)) return undefined;
    const own = staffId ? regularsOf.get(staffId) : undefined;
    if (own?.length && rng.chance(0.6)) return rng.pick(own);
    return rng.pick(list);
  };

  const extras = (s: Staff, svc: Service, client: Client | undefined, workplace: Workplace) => {
    let forWhom: BookingForWhom = 'self';
    let visitorName: string | undefined;
    if (svc.id.includes('kids')) {
      forWhom = 'child';
      // Имя и «дочь/сын» — одного пола (третий вызов ГПСЧ оставлен, чтобы остальной сид не сдвинулся)
      // В барбершоп детей приводят стричь сыновей
      const girl = rng.chance(0.5) && !businessById.get(s.businessId)?.sphereIds.includes('barber');
      const childName = rng.pick(girl ? FEMALE_NAMES : MALE_NAMES);
      rng.next();
      visitorName = `${childName} (${girl ? 'дочь' : 'сын'})`;
    } else if (client && rng.chance(0.01)) {
      forWhom = 'other';
      visitorName = `${rng.pick(client.gender === 'male' ? FEMALE_NAMES : MALE_NAMES)} — записывает ${client.name.split(' ')[0]}`;
    }
    let comment: string | undefined;
    const business = businessById.get(s.businessId);
    if (business?.sphereIds.includes('carwash')) comment = rng.chance(0.7) ? rng.pick(CAR_COMMENTS) : undefined;
    else if (workplace === 'visit') comment = rng.chance(0.5) ? rng.pick(VISIT_COMMENTS) : undefined;
    else if (rng.chance(0.1)) comment = rng.pick(commentsFor(business?.sphereIds));
    return { forWhom, visitorName, comment };
  };

  /** Найти ближайший рабочий день (начиная с offset, шаг dir) и свободное время для услуги */
  const findSlot = (s: Staff, offset: number, preferred: string, svc: Service, dir: 1 | -1 = 1) => {
    for (let k = 0; k < 10; k++) {
      const off = offset + k * dir;
      const date = clock.day(off);
      const ivs = dayIntervals(s, off).filter((iv) => svc.workplaces.includes(iv.workplace));
      const want = toMinutes(preferred);
      const candidates: number[] = [want];
      for (const iv of ivs) for (let t = ceil15(iv.a); t + svc.durationMin <= iv.b; t += 30) candidates.push(t);
      for (const t of candidates) {
        const iv = ivs.find((x) => t >= x.a && t + svc.durationMin <= x.b);
        if (!iv) continue;
        if (overlaps(occ.get(occKey(s.id, date)), t, t + svc.durationMin)) continue;
        if (!resourcesFree(resourcesOf(svc), date, t, t + svc.durationMin)) continue;
        return { offset: off, date, a: t, iv };
      }
    }
    return undefined;
  };

  // ─────────── 1. Групповые занятия тренера (F-00-185), участники — записи с groupEventId
  const arman = staffById.get(ST.arman);
  const funcSvc = serviceById.get('sv_arm_group_func');
  const stretchSvc = serviceById.get('sv_arm_group_stretch');
  const armanClients = (clientsByBusiness.get(BIZ.arman) ?? []).filter((c) => !c.blocked);
  if (arman && funcSvc && stretchSvc) {
    let onlineDone = false;
    let ev = 0;
    for (let d = -14; d <= 14; d++) {
      const date = clock.day(d);
      const wd = weekdayIndex(date);
      const svc: Service | undefined = wd === 1 || wd === 3 ? funcSvc : wd === 5 ? stretchSvc : undefined;
      if (!svc) continue;
      const time = svc === funcSvc ? '19:00' : '11:00';
      const a = toMinutes(time);
      const online = svc === stretchSvc && d > 0 && !onlineDone;
      if (online) onlineDone = true;
      const event: GroupEvent = {
        id: `ev_${String(++ev).padStart(2, '0')}`,
        businessId: BIZ.arman,
        locationId: arman.locationIds[0],
        serviceId: svc.id,
        staffId: arman.id,
        start: `${date}T${time}`,
        durationMin: svc.durationMin,
        capacity: svc.capacity ?? 8,
        resourceIds: online ? [] : ['res_arman_hall_1'],
        onlineUrl: online ? 'https://meet.example.com/arman-stretching' : undefined,
        seriesId: svc === funcSvc ? 'ser_arman_func' : 'ser_arman_stretch',
        status: 'scheduled',
        createdAt: clock.at(-20, '10:00'),
      };
      groupEvents.push(event);
      reserve(occ, occKey(arman.id, date), a, a + svc.durationMin);
      const participants = rng.sample(armanClients, rng.int(4, Math.min(event.capacity - 1, armanClients.length)));
      participants.forEach((client) => {
        const r = rng.next();
        const past = isPast(date, a + svc.durationMin);
        const status: BookingStatus = past
          ? r < 0.85 ? 'arrived' : r < 0.95 ? 'no_show' : 'cancelled_by_client'
          : r < 0.05 ? 'cancelled_by_client' : r < 0.55 ? 'scheduled' : 'client_confirmed';
        place({
          staff: arman,
          offset: d,
          date,
          a,
          lines: [{ svc, dur: svc.durationMin, price: svc.priceMin }],
          workplace: online ? 'online' : 'gym',
          locationId: arman.locationIds[0],
          client,
          status,
          groupEventId: event.id,
          resourceIds: event.resourceIds.length ? ['res_arman_hall'] : [],
        });
      });
    }
  }

  // ─────────── 2. Серии повторов (F-01-100) и план лечения (F-00-150)
  const series: { staffId: string; svcId: string; weekday: number; time: string; every: number; seriesId: string; clientIndex: number }[] = [
    { staffId: ST.lusine, svcId: 'sv_lus_classic', weekday: 0, time: '12:00', every: 7, seriesId: 'ser_lusine_course', clientIndex: 1 },
    { staffId: ST.kaytsakDavid, svcId: 'sv_kay_combo', weekday: 5, time: '11:00', every: 14, seriesId: 'ser_kaytsak_regular', clientIndex: 3 },
    { staffId: ST.atamAshot, svcId: 'sv_atam_crown', weekday: 1, time: '10:00', every: 14, seriesId: 'ser_atam_plan', clientIndex: 5 },
  ];
  for (const sr of series) {
    const s = staffById.get(sr.staffId);
    const svc = serviceById.get(sr.svcId);
    if (!s || !svc) continue;
    const client = (clientsByBusiness.get(s.businessId) ?? []).filter((c) => !c.blocked)[sr.clientIndex];
    let first = true;
    for (let d = -DAYS_BACK + 2; d <= DAYS_AHEAD; d++) {
      const date = clock.day(d);
      if (weekdayIndex(date) !== sr.weekday) continue;
      if (!first && (d + DAYS_BACK) % sr.every >= 7) continue;
      first = false;
      const a = toMinutes(sr.time);
      const iv = dayIntervals(s, d).find((x) => a >= x.a && a + svc.durationMin <= x.b && svc.workplaces.includes(x.workplace));
      if (!iv || overlaps(occ.get(occKey(s.id, date)), a, a + svc.durationMin)) continue;
      if (!resourcesFree(resourcesOf(svc), date, a, a + svc.durationMin)) continue;
      place({ staff: s, offset: d, date, a, lines: [{ svc, dur: svc.durationMin, price: pickPrice(svc) }], workplace: iv.workplace, locationId: iv.locationId, client, seriesId: sr.seriesId, source: 'journal' });
    }
  }

  // ─────────── 3. Демо-персона «Клиент» (appUsers[0]): записи через приложение в 4 местах
  const demoPlan: { staffId: string; svcId: string; offset: number; time: string }[] = [
    { staffId: ST.nuriAni, svcId: 'sv_nuri_gel', offset: -12, time: '11:00' },
    { staffId: ST.nuriAni, svcId: 'sv_nuri_gel', offset: 3, time: '15:00' },
    { staffId: ST.atamSeda, svcId: 'sv_atam_clean', offset: -20, time: '10:00' },
    { staffId: ST.atamKaren, svcId: 'sv_atam_consult', offset: 9, time: '11:00' },
    { staffId: ST.mananaArpi, svcId: 'sv_mnn_cut', offset: -6, time: '12:00' },
    { staffId: ST.mananaArpi, svcId: 'sv_mnn_style', offset: 12, time: '16:00' },
    { staffId: ST.lusine, svcId: 'sv_lus_back', offset: 1, time: '17:00' },
  ];
  if (demoPlan.length !== DEMO_PLAN_SIZE) throw new Error('seed: DEMO_PLAN_SIZE не совпадает с планом au_01');
  for (const [i, p] of demoPlan.entries()) {
    const s = staffById.get(p.staffId);
    const svc = serviceById.get(p.svcId);
    if (!s || !svc) continue;
    const client = clients.find((c) => c.businessId === s.businessId && c.appUserId === 'au_01');
    const slot = findSlot(s, p.offset, p.time, svc, p.offset < 0 ? -1 : 1);
    if (!slot) continue;
    const past = isPast(slot.date, slot.a + svc.durationMin);
    place({
      staff: s,
      offset: slot.offset,
      date: slot.date,
      a: slot.a,
      lines: [{ svc, dur: svc.durationMin, price: pickPrice(svc) }],
      workplace: slot.iv.workplace,
      locationId: slot.iv.locationId,
      client,
      source: 'app',
      appUserId: 'au_01',
      status: past ? 'arrived' : rng.chance(0.5) ? 'scheduled' : 'client_confirmed',
      id: bookingId(DEMO_FIRST_SEQ + i),
    });
  }

  // Контрпример F-14-009: au_01 есть в базе Atam, но к Ашоту её записал администратор вручную (без приложения) —
  // в «Моих мастерах» Ашот появляться не должен: запись без appUserId, source 'journal', createdBy — администратор.
  {
    const s = staffById.get(ST.atamAshot);
    const svc = s && services.find((x) => x.active && x.kind === 'individual' && x.staffIds.includes(s.id));
    const client = clients.find((c) => c.businessId === BIZ.atam && c.appUserId === 'au_01');
    const slot = s && svc ? findSlot(s, -16, '12:00', svc, -1) : undefined;
    if (s && svc && client && slot) {
      place({
        staff: s,
        offset: slot.offset,
        date: slot.date,
        a: slot.a,
        lines: [{ svc, dur: svc.durationMin, price: svc.priceMin }],
        workplace: slot.iv.workplace,
        locationId: slot.iv.locationId,
        client,
        source: 'journal',
        status: 'arrived',
        comment: 'Записали по звонку',
      });
    }
  }

  // ─────────── 4. Остальные записи: ±30 дней, плотнее к сегодняшнему дню
  const providers = staff.filter((s) => s.status === 'active' && services.some((x) => x.kind === 'individual' && x.staffIds.includes(s.id)));
  for (let d = -DAYS_BACK; d <= DAYS_AHEAD; d++) {
    const date = clock.day(d);
    for (const s of providers) {
      const factor = 0.85 + rng.next() * 0.3;
      const p = Math.min(0.9, fillChance(d) * factor);
      for (const iv of dayIntervals(s, d)) {
        const candidates = servicesOf(s, iv.workplace);
        if (!candidates.length) continue;
        let t = ceil15(iv.a);
        while (t + 15 <= iv.b) {
          const busy = overlaps(occ.get(occKey(s.id, date)), t, t + 15);
          if (busy) {
            t = ceil15(busy[1]);
            continue;
          }
          if (!rng.chance(p)) {
            t += rng.pick([15, 30, 30, 45, 60]);
            continue;
          }
          let placed = false;
          for (const svc of pickServices(candidates, 3)) {
            const lines = [{ svc, dur: pickDuration(svc), price: pickPrice(svc) }];
            // Визит из нескольких услуг (F-01-130)
            if (rng.chance(0.12)) {
              const second = rng.pick(candidates.filter((x) => x.id !== svc.id && x.durationMin <= 60));
              if (second) lines.push({ svc: second, dur: pickDuration(second), price: pickPrice(second) });
            }
            const dur = lines.reduce((sum, l) => sum + l.dur, 0);
            const end = t + dur;
            if (end > iv.b || overlaps(occ.get(occKey(s.id, date)), t, end)) continue;
            if (!lines.every((l) => resourcesFree(resourcesOf(l.svc), date, t, end))) continue;
            const client = pickClient(s.businessId, d >= 0, s.id);
            place({ staff: s, offset: d, date, a: t, lines, workplace: iv.workplace, locationId: iv.locationId, client, ...extras(s, svc, client, iv.workplace) });
            const buffer = Math.max(...lines.map((l) => l.svc.bufferAfterMin ?? 0));
            t = ceil15(end + buffer);
            placed = true;
            break;
          }
          if (!placed) t += 15;
        }
      }
    }
  }

  // ─────────── 4.5. Плотный день у «сегодня» (owner 27.09.2026, docs/design/mockups/A2-*.png): что бы ни было
  // «сегодня» на календаре (даже воскресенье), журнал не должен выглядеть тусклее макета — у каждого работающего
  // в эти дни мастера гарантирован минимум записей (по длине смены), а не только вероятность из fillChance.
  // Идёт ПОСЛЕ шага 4 и не меняет уже расставленные записи — только дополняет свободные минуты.
  {
    const DENSE_OFFSETS = [0, 1, -1, 2];
    for (const d of DENSE_OFFSETS) {
      const date = clock.day(d);
      for (const s of providers) {
        const ivs = dayIntervals(s, d).filter((iv) => servicesOf(s, iv.workplace).length > 0);
        if (!ivs.length) continue;
        const workMinutes = ivs.reduce((sum, iv) => sum + (iv.b - iv.a), 0);
        const target = Math.min(8, Math.max(2, Math.round(workMinutes / 55)));
        let guard = 0;
        while ((occ.get(occKey(s.id, date))?.length ?? 0) < target && guard < 60) {
          guard++;
          const iv = rng.pick(ivs);
          const candidates = servicesOf(s, iv.workplace);
          const free: number[] = [];
          for (let t = ceil15(iv.a); t + 15 <= iv.b; t += 15) if (!overlaps(occ.get(occKey(s.id, date)), t, t + 15)) free.push(t);
          if (!free.length) continue;
          const t0 = rng.pick(free);
          for (const svc of pickServices(candidates, 3)) {
            const dur = pickDuration(svc);
            const end = t0 + dur;
            if (end > iv.b || overlaps(occ.get(occKey(s.id, date)), t0, end)) continue;
            if (!resourcesFree(resourcesOf(svc), date, t0, end)) continue;
            const client = pickClient(s.businessId, d >= 0, s.id);
            place({
              staff: s,
              offset: d,
              date,
              a: t0,
              lines: [{ svc, dur, price: pickPrice(svc) }],
              workplace: iv.workplace,
              locationId: iv.locationId,
              client,
              ...extras(s, svc, client, iv.workplace),
            });
            break;
          }
        }
      }
    }

    // Хотя бы «1 ждёт подтверждения» на бизнес сегодня — иначе жёлтый сегмент итогов дня (DESIGN.md → Journal 2)
    // никогда не виден именно в день, на который чаще всего смотрит владелец.
    const todayStr = clock.day(0);
    const todayByBusiness = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!b.start.startsWith(todayStr)) continue;
      todayByBusiness.set(b.businessId, [...(todayByBusiness.get(b.businessId) ?? []), b]);
    }
    for (const list of todayByBusiness.values()) {
      if (list.some((b) => b.status === 'awaiting_confirmation')) continue;
      const upcoming = list.filter((b) => {
        const minute = toMinutes(b.start.slice(11, 16));
        return !isPast(todayStr, minute) && (b.status === 'scheduled' || b.status === 'client_confirmed');
      });
      // Начало не раньше чем через 1,5 ч: срок ответа (начало − 1 ч) ещё не прошёл, заявку успевают подтвердить
      const later = upcoming.filter((b) => toMinutes(b.start.slice(11, 16)) > clock.nowMin + 90);
      if (upcoming.length) rng.pick(later.length ? later : upcoming).status = 'awaiting_confirmation';
    }

    // Срок ответа на заявку — min(создание + 2 ч, начало − 1 ч) (confirmDeadlineOf). Заявки, созданные до 12 дней назад,
    // снимались «Отменил мастер» через минуту после открытия журнала (journal.md). Ждущие ответа — созданы в последний час;
    // минуты — от id записи, а не из rng: остальной сид от этого не меняется
    for (const b of bookings) {
      if (b.status !== 'awaiting_confirmation' || isPast(b.start.slice(0, 10), toMinutes(b.start.slice(11, 16)))) continue;
      const minutesAgo = 5 + ([...b.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 50);
      b.createdAt = clock.minutesFromNow(-minutesAgo);
      b.updatedAt = b.createdAt;
    }
  }

  // ─────────── 5. Давняя история: визиты от 5 недель до 18 месяцев назад (до окна ±30 дней)
  // Без неё почти вся база салона, открытого год назад, выглядела «новой», а «потерянных» не было вовсе.
  // Постоянные — с 35 дней, потерянные — с 95 (их нет в окне ±30 дней), новые — без истории. Не раньше найма
  // мастера. Идёт последним, поэтому окно ±30 дней (журнал, свободные окна) не меняется.
  const masterOf = new Map<string, string>();
  regularsOf.forEach((list, staffId) => list.forEach((c) => masterOf.set(c.id, staffId)));
  const today = dayjs(clock.today);
  for (const client of clients) {
    const profile = profileOf.get(client.id) ?? 'regular';
    if (client.appUserId === 'au_01' || profile === 'new') continue;
    const masters = providers.filter((s) => s.businessId === client.businessId);
    if (!masters.length) continue;
    const visits = profile === 'lost' ? rng.int(1, 2) : rng.int(1, 3);
    const minBack = profile === 'lost' ? 95 : 35;
    for (let v = 0; v < visits; v++) {
      const own = masterOf.get(client.id);
      const s = (own && rng.chance(0.75) ? staffById.get(own) : undefined) ?? rng.pick(masters);
      const sch = schedulesOf(s.id)[0];
      if (!sch) continue;
      const svc = pickServices(servicesOf(s, sch.workplace), 1)[0];
      if (!svc) continue;
      const maxBack = Math.min(540, today.diff(dayjs(s.hiredAt), 'day') - 3);
      if (maxBack <= minBack) continue;
      const offset = -rng.int(minBack, maxBack);
      const time = `${String(rng.int(10, 18)).padStart(2, '0')}:${rng.pick(['00', '30'])}`;
      const slot = findSlot(s, offset, time, svc, -1);
      if (!slot || slot.date < s.hiredAt) continue;
      place({
        staff: s,
        offset: slot.offset,
        date: slot.date,
        a: slot.a,
        lines: [{ svc, dur: svc.durationMin, price: pickPrice(svc) }],
        workplace: slot.iv.workplace,
        locationId: slot.iv.locationId,
        client,
        ...extras(s, svc, client, slot.iv.workplace),
      });
    }
  }

  bookings.sort((x, y) => x.start.localeCompare(y.start) || x.id.localeCompare(y.id));
  // ─────────── 6. «Пора снова» у демо-клиента (F-00-119): маникюр у Гаянэ месяц назад (повтор через 21 день), новой
  // записи к ней нет — в уведомлениях клиента появляется приглашение записаться ещё раз. Последним шагом: rng остального
  // сида не сдвигается, постоянный id
  {
    const s = staffById.get(ST.nuriGayane);
    const svc = serviceById.get('sv_nuri_classic');
    const client = clients.find((c) => c.businessId === BIZ.nuri && c.appUserId === 'au_01');
    const slot = s && svc ? findSlot(s, -30, '12:00', svc, -1) : undefined;
    if (s && svc && client && slot) {
      place({
        staff: s,
        offset: slot.offset,
        date: slot.date,
        a: slot.a,
        lines: [{ svc, dur: svc.durationMin, price: svc.priceMin }],
        workplace: slot.iv.workplace,
        locationId: slot.iv.locationId,
        client,
        source: 'app',
        appUserId: 'au_01',
        status: 'arrived',
        id: 'bk_au01_repeat',
      });
    }
  }

  return { bookings, groupEvents };
}

import type { Booking, Business, Client, Location, Service, ServiceCategory, Staff, WorkSchedule } from '@/domain/core';
import { INTAKE_SERVICE_NAME } from '@/domain/ordersIntake';
import { PICKUP_SERVICE_NAME } from '@/domain/ordersPickup';
import { h, lt, sameDays, week, yandexLink, type SeedClock } from '@/mock/seed/helpers';
import { logoPhoto, workPhotos } from '@/mock/seed/photos';

/**
 * ⭐ Демо детейлинга (06.10.2026): студия GlossLab (сфера detailing, Давташен) — у персоны `?demo=owner&sphere=detailing`
 * своя мастерская вместо салона маникюра. Детейлинг работает и записями (мойка, химчистка, полировка, керамика — работы
 * на полдня и день), и заказами (машину оставили — «Готово» — клиент сам выбирает, когда заберёт): включены «Запись на
 * сдачу» и выдача по времени, в журнале — долгие записи, сдача и выдача, в «Заказах» — пять заказов (срез orders).
 * Шагом ПОСЛЕ основного сида и без ГПСЧ: остальные люди, записи и время в демо не сдвигаются.
 */
export const GL = {
  biz: 'biz_glosslab',
  loc: 'loc_glosslab',
  owner: 'st_gl_owner',
  vahe: 'st_gl_vahe',
  taron: 'st_gl_taron',
  category: 'cat_gl_main',
  wash: 'sv_gl_wash',
  interior: 'sv_gl_interior',
  polish: 'sv_gl_polish',
  ceramic: 'sv_gl_ceramic',
  film: 'sv_gl_film',
  intake: 'sv_gl_intake',
  pickup: 'sv_gl_pickup',
  /** Запись на выдачу готового заказа №1003 (срез orders → pickupBookingId) */
  pickupBooking: 'bk_gl_pickup_1',
} as const;

/** Клиенты GlossLab — постоянные, без ГПСЧ */
const CLIENTS: [id: string, name: string, gender: Client['gender'], phone: string, daysAgo: number][] = [
  ['cl_gl_01', 'Гор Бадалян', 'male', '+37400180001', 140],
  ['cl_gl_02', 'Мери Давтян', 'female', '+37400180002', 96],
  ['cl_gl_03', 'Карен Минасян', 'male', '+37400180003', 60],
  ['cl_gl_04', 'Арман Казарян', 'male', '+37400180004', 33],
  ['cl_gl_05', 'Лилит Петросян', 'female', '+37400180005', 21],
  ['cl_gl_06', 'Эдгар Асатрян', 'male', '+37400180006', 7],
];

export interface DetailingSeedTarget {
  businesses: Business[];
  locations: Location[];
  staff: Staff[];
  categories: ServiceCategory[];
  services: Service[];
  clients: Client[];
  schedules: WorkSchedule[];
  bookings: Booking[];
}

export function addDetailingDemo(clock: SeedClock, d: DetailingSeedTarget): void {
  const masters: string[] = [GL.vahe, GL.taron];
  const address = lt('ул. Арзуманяна, 21', 'Արզումանյան փ., 21', '21 Arzumanyan St');
  // Пн–сб 9–20, вс 10–18: машины оставляют на день, забирают вечером
  const hours = week({ ...sameDays([0, 1, 2, 3, 4, 5], [h('09:00', '20:00')]), 6: [h('10:00', '18:00')] });

  d.businesses.push({
    id: GL.biz,
    kind: 'salon',
    name: 'GlossLab',
    slug: 'glosslab',
    sphereIds: ['detailing'],
    ownerStaffId: GL.owner,
    locationIds: [GL.loc],
    phone: '+37400101717',
    description: lt(
      'Детейлинг в Давташене: мойка, химчистка салона, полировка и керамика. Оставьте машину утром — сообщим, когда готово, и вы сами выберете, когда забрать.',
      'Դիթեյլինգ Դավթաշենում՝ լվացում, սրահի քիմմաքրում, փայլեցում և կերամիկա։ Թողեք մեքենան առավոտյան՝ կհայտնենք, երբ պատրաստ լինի, և դուք ինքներդ կընտրեք՝ երբ վերցնել։',
      'Detailing in Davtashen: wash, interior cleaning, polishing and ceramic coating. Leave your car in the morning — we’ll tell you when it’s ready, and you choose when to pick it up.',
    ),
    logoUrl: logoPhoto('GL', ['#E8F1F8', '#CFE0EE'], '#2F5D86'),
    photos: workPhotos('carwash', 4),
    status: 'active',
    createdAt: clock.at(-160, '11:00'),
  });

  d.locations.push({
    id: GL.loc,
    businessId: GL.biz,
    name: { ru: 'GlossLab' },
    address,
    district: 'davtashen',
    yandexMapsUrl: yandexLink(address.ru),
    coords: { lat: 40.2268, lng: 44.4932 },
    phone: '+37400101717',
    openHours: hours,
  });

  const person = (id: string, name: string, phone: string, role: Staff['role'], position: Staff['position'], colorIndex: number, photos: string[], hiredDaysAgo: number): Staff => ({
    id,
    businessId: GL.biz,
    locationIds: [GL.loc],
    name,
    phone,
    role,
    position,
    sphereIds: ['detailing'],
    workplaces: ['salon'],
    accepts: 'all',
    calendarVisibility: 'all',
    calendarMode: 'free',
    confirmMode: 'instant',
    colorIndex,
    photos,
    materials: [],
    status: 'active',
    serviceIds: [],
    hiredAt: clock.day(-hiredDaysAgo),
  });
  const owner = lt('Владелец студии', 'Ստուդիայի սեփականատեր', 'Studio owner');
  const master = lt('Мастер детейлинга', 'Դիթեյլինգի վարպետ', 'Detailing specialist');
  const staff: Staff[] = [
    person(GL.owner, 'Рубен Гаспарян', '+37400170101', 'owner', owner, 3, [], 160),
    person(GL.vahe, 'Ваге Арзуманян', '+37400170102', 'master', master, 5, workPhotos('carwash', 3, 1), 150),
    person(GL.taron, 'Тарон Саакян', '+37400170103', 'master', master, 1, workPhotos('carwash', 3, 2), 120),
  ];

  d.categories.push({ id: GL.category, businessId: GL.biz, name: lt('Детейлинг', 'Դիթեյլինգ', 'Detailing'), order: 0 });

  const svc = (id: string, order: number, name: Service['name'], durationMin: number, priceMin: number, extra: Partial<Service> = {}): Service => ({
    id,
    businessId: GL.biz,
    categoryId: GL.category,
    sphereId: 'detailing',
    name,
    kind: 'individual',
    durationMin,
    priceMin,
    bufferAfterMin: 0,
    photos: [],
    materials: [],
    staffIds: masters,
    workplaces: ['salon'],
    onlineBookable: true,
    active: true,
    order,
    ...extra,
  });
  const services: Service[] = [
    svc(GL.wash, 1, lt('Комплексная мойка', 'Համալիր լվացում', 'Full wash'), 60, 8000, {
      description: lt('Кузов, диски, коврики и пылесос салона.', 'Թափք, անվահեծեր, գորգեր և սրահի փոշեկուլ։', 'Body, wheels, mats and interior vacuum.'),
    }),
    svc(GL.interior, 2, lt('Химчистка салона', 'Սրահի քիմմաքրում', 'Interior deep cleaning'), 240, 35000, {
      priceMax: 45000,
      description: lt('Сиденья, потолок, ковёр и пластик. Машину оставляете на полдня.', 'Նստատեղեր, առաստաղ, գորգ և պլաստիկ։ Մեքենան թողնում եք կես օրով։', 'Seats, headliner, carpet and trim. Leave the car for half a day.'),
    }),
    svc(GL.polish, 3, lt('Полировка кузова', 'Թափքի փայլեցում', 'Paint polishing'), 300, 60000, {
      durationMax: 360,
      description: lt('Убираем мелкие царапины и голограммы, возвращаем блеск.', 'Հեռացնում ենք մանր քերծվածքները և վերադարձնում փայլը։', 'We remove swirls and light scratches and bring back the gloss.'),
    }),
    svc(GL.ceramic, 4, lt('Керамическое покрытие', 'Կերամիկական ծածկույթ', 'Ceramic coating'), 480, 150000, {
      priceMax: 220000,
      description: lt('Полировка и керамика в два слоя — машина у нас на день.', 'Փայլեցում և երկշերտ կերամիկա՝ մեքենան մեզ մոտ է մեկ օր։', 'Polishing plus two layers of ceramic — the car stays with us for a day.'),
    }),
    svc(GL.film, 5, lt('Защитная плёнка на фары', 'Լուսարձակների պաշտպանիչ թաղանթ', 'Headlight protection film'), 120, 25000),
    // Запись на сдачу и выдачу по времени (заказы): окна по 30 минут, принимают и выдают оба мастера
    { ...svc(GL.intake, 0, { ...INTAKE_SERVICE_NAME }, 30, 0, { kind: 'intake', bufferAfterMin: 0, categoryId: '' }) },
    { ...svc(GL.pickup, 0, { ...PICKUP_SERVICE_NAME }, 30, 0, { kind: 'pickup', bufferAfterMin: 0, categoryId: '', onlineBookable: false }) },
  ];
  for (const s of staff) {
    // «Выдача заказа» мастеру не назначается (как сервер): её окна и записи — только по ссылке заказа
    if (masters.includes(s.id)) s.serviceIds = services.filter((x) => x.kind !== 'pickup').map((x) => x.id);
  }
  d.staff.push(...staff);
  d.services.push(...services);

  masters.forEach((staffId, i) =>
    d.schedules.push({ id: `sch_gl_${i + 1}`, staffId, locationId: GL.loc, workplace: 'salon', week: hours, overrides: {}, openUntil: clock.day(30) }),
  );

  for (const [id, name, gender, phone, daysAgo] of CLIENTS) {
    d.clients.push({ id, businessId: GL.biz, phone, name, gender, tags: [], noShowCount: 0, createdAt: clock.at(-daysAgo, '12:00') });
  }

  const byId = new Map(services.map((s) => [s.id, s]));
  const plan: [id: string, offset: number, time: string, staffId: string, clientId: string, serviceId: string, status: Booking['status'], comment?: string][] = [
    ['bk_gl_1', -2, '11:00', GL.vahe, 'cl_gl_03', GL.wash, 'arrived'],
    ['bk_gl_2', -1, '10:00', GL.taron, 'cl_gl_02', GL.interior, 'arrived'],
    ['bk_gl_3', 0, '09:00', GL.vahe, 'cl_gl_01', GL.polish, 'arrived'],
    ['bk_gl_4', 0, '10:00', GL.taron, 'cl_gl_04', GL.interior, 'arrived'],
    ['bk_gl_5', 0, '15:00', GL.taron, 'cl_gl_03', GL.wash, 'scheduled'],
    ['bk_gl_6', 0, '16:00', GL.vahe, 'cl_gl_06', GL.film, 'client_confirmed'],
    [GL.pickupBooking, 0, '18:00', GL.taron, 'cl_gl_05', GL.pickup, 'scheduled', '№1003 · Kia Sportage — полировка и керамика'],
    ['bk_gl_drop_1', 1, '09:00', GL.vahe, 'cl_gl_06', GL.intake, 'scheduled', 'BMW X5 — керамика, приеду к открытию'],
    ['bk_gl_7', 1, '10:00', GL.taron, 'cl_gl_02', GL.ceramic, 'scheduled'],
    ['bk_gl_8', 2, '12:00', GL.vahe, 'cl_gl_04', GL.wash, 'scheduled'],
  ];
  for (const [id, offset, time, staffId, clientId, serviceId, status, comment] of plan) {
    const s = byId.get(serviceId)!;
    const durationMin = s.durationMax ?? s.durationMin;
    const createdAt = clock.at(Math.min(offset, 0) - 2, '19:10');
    d.bookings.push({
      id,
      businessId: GL.biz,
      locationId: GL.loc,
      staffId,
      clientId,
      start: clock.at(offset, time),
      durationMin,
      status,
      services: [{ serviceId, staffId, price: s.priceMin, durationMin, qty: 1 }],
      total: s.priceMin,
      resourceIds: [],
      workplace: 'salon',
      source: s.kind === 'individual' ? 'phone' : 'link',
      createdBy: s.kind === 'individual' ? GL.owner : 'client',
      forWhom: 'self',
      ...(comment ? { comment } : {}),
      ...(s.kind === 'individual' ? {} : { staffAssignment: 'any' as const }),
      createdAt,
      updatedAt: createdAt,
    });
  }
  d.bookings.sort((x, y) => x.start.localeCompare(y.start) || x.id.localeCompare(y.id));
}

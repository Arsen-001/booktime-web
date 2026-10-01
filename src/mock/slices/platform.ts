import type { CoreData, DistrictId, Id, SphereId } from '@/domain/core';
import { defineSlice } from '@/mock/slice';
import { interiorPhotos, workPhotos } from '@/mock/seed/photos';
import type {
  Ad,
  BackupCopy,
  BizMeta,
  BrandState,
  CoinEntry,
  ConnectDraft,
  DemandEntry,
  ExportLogEntry,
  FirstAward,
  Idea,
  ModerationItem,
  NameCandidate,
  PaybackInputs,
  PrelaunchItem,
  PromoCode,
  RejectReason,
  SphereRequest,
  StoryBooking,
  StoryPlacesConfig,
  SupportTicket,
  TeamMember,
  Visit,
  WaveItem,
} from '@/domain/platform';

export interface PlatformState {
  team: TeamMember[];
  rejectReasons: RejectReason[];
  moderationItems: ModerationItem[];
  coinEntries: CoinEntry[];
  connectDrafts: ConnectDraft[];
  visits: Visit[];
  promoCodes: PromoCode[];
  bizMeta: Record<Id, BizMeta>;
  supportTickets: SupportTicket[];
  demandEntries: DemandEntry[];
  firstAwards: FirstAward[];
  ads: Ad[];
  storyConfig: StoryPlacesConfig;
  storyBookings: StoryBooking[];
  backupCopies: BackupCopy[];
  exportLog: ExportLogEntry[];
  waveItems: WaveItem[];
  prelaunchItems: PrelaunchItem[];
  paybackInputs: PaybackInputs;
  nameCandidates: NameCandidate[];
  brand: BrandState;
  ideas: Idea[];
  sphereRequests: SphereRequest[];
}

function iso(now: Date, deltaDays: number, h = 10, m = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + deltaDays);
  d.setHours(h, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isoDate(now: Date, deltaDays: number): string {
  return iso(now, deltaDays).slice(0, 10);
}

const DISTRICTS: DistrictId[] = [
  'kentron',
  'arabkir',
  'davtashen',
  'malatia-sebastia',
  'nor-nork',
  'achapnyak',
  'shengavit',
  'avan',
  'erebuni',
  'kanaker-zeytun',
];

const REASON_LABELS: { ru: string; en: string }[] = [
  { ru: 'Плохое качество фото', en: 'Poor photo quality' },
  { ru: 'Чужая или найденная в интернете фотография', en: "Not the business’s own photo" },
  { ru: 'В тексте есть контакты или ссылка на сторонний сервис', en: 'Text contains outside contacts or links' },
  { ru: 'Услуга не подходит для сферы салона', en: "Service does not match the business’s sphere" },
  { ru: 'Оскорбительное или запрещённое содержание', en: 'Offensive or prohibited content' },
  { ru: 'Диплом не читается или выдан не на это имя', en: 'Diploma is unreadable or issued to another name' },
];

function buildStats(baseNow: Date, fromDelta: number, days: number): Record<string, { views: number; clicks: number }> {
  const out: Record<string, { views: number; clicks: number }> = {};
  for (let d = 0; d < days; d += 1) {
    const date = isoDate(baseNow, fromDelta + d);
    const views = 40 + ((d * 13) % 90);
    out[date] = { views, clicks: Math.round(views * (0.02 + (d % 5) * 0.01)) };
  }
  return out;
}

export const platformSlice = defineSlice<PlatformState>({
  version: 10,
  seed: (core: CoreData, now: Date): PlatformState => {
    const team: TeamMember[] = [
      { id: 'team_anna', name: 'Анна Григорян' },
      { id: 'team_vahe', name: 'Ваге Саргсян' },
    ];

    const rejectReasons: RejectReason[] = REASON_LABELS.map((label, i) => ({
      id: `rr_${i + 1}`,
      label: { ru: label.ru, en: label.en },
      active: true,
      order: i + 1,
    }));

    const businesses = core.businesses;
    const staffByBiz = (bizId: Id) => core.staff.filter((s) => s.businessId === bizId);

    // ── Очередь проверки (F-00-168, F-00-179). Фото на проверке ссылаются на НАСТОЯЩИЕ фото ядра (refId = строка фото,
    // как в Staff.photos / Business.photos): пока материал не одобрен, клиент его не видит (moderationHiddenIds ядра),
    // «Одобрить» делает фото видимым. Отклонённые и прочие виды — отдельные материалы (refId не из ядра), чтобы не
    // прятать демо-фото других разделов. Картинка есть у всего, что проверяем глазами.
    const moderationItems: ModerationItem[] = [];
    let mi = 0;
    const bizAt = (i: number) => businesses[i % businesses.length];
    const staffWithPhotos = (bizId: Id) => staffByBiz(bizId).find((st) => st.photos.length > 1);
    const lastPhoto = (list: string[]) => list[list.length - 1];
    const pushItem = (item: Omit<ModerationItem, 'id' | 'history' | 'submittedAt' | 'decidedAt'>, daysAgo: number, hour: number) => {
      mi += 1;
      const submittedAt = iso(now, -daysAgo, hour);
      const decided = item.status !== 'pending';
      const decidedAt = decided ? iso(now, -daysAgo, hour + 2) : undefined;
      const decisionKind = item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'auto';
      moderationItems.push({
        ...item,
        id: `mod_${mi}`,
        submittedAt,
        decidedAt,
        history: [
          ...(item.status === 'auto' ? [] : [{ id: `${mi}_h1`, at: submittedAt, kind: 'submitted' as const }]),
          ...(decided ? [{ id: `${mi}_h2`, at: decidedAt ?? submittedAt, kind: decisionKind as 'approved' | 'rejected' | 'auto', note: item.reasonNote }] : []),
          ...(item.status === 'rejected' && item.paidCoins ? [{ id: `${mi}_h3`, at: decidedAt ?? submittedAt, kind: 'refund' as const, coins: item.paidCoins }] : []),
        ],
      });
    };
    const kindSphere = (bizId: Id) => core.businesses.find((b) => b.id === bizId)?.sphereIds[0] ?? 'general';

    // На проверке — самые старые сверху (очередь)
    const b0 = bizAt(0);
    const s0 = staffWithPhotos(b0.id);
    // Прежние фото этих мастеров уже прошли проверку — у каждого фото мастера есть статус, новое ждёт своей очереди
    const approvedEarlier = (staff: { id: Id; name: string; photos: string[] }, bizId: Id) =>
      staff.photos.slice(0, -1).forEach((url, i) => pushItem({ kind: 'staffPhoto', businessId: bizId, staffId: staff.id, refId: url, imageUrl: url, label: staff.name, status: 'approved', source: 'user' }, 30 + i, 11));
    if (s0) pushItem({ kind: 'staffPhoto', businessId: b0.id, staffId: s0.id, refId: lastPhoto(s0.photos), imageUrl: lastPhoto(s0.photos), label: s0.name, status: 'pending', source: 'user' }, 3, 10);
    const b1 = bizAt(1);
    if (b1.photos.length) pushItem({ kind: 'salonPhoto', businessId: b1.id, refId: lastPhoto(b1.photos), imageUrl: lastPhoto(b1.photos), status: 'pending', source: 'user' }, 2, 11);
    const b2 = bizAt(2);
    pushItem({ kind: 'service', businessId: b2.id, refId: `svc_new_${b2.id}`, label: kindSphere(b2.id) === 'dental' ? 'Отбеливание зубов' : 'Уход за кожей рук', text: kindSphere(b2.id) === 'dental' ? '60 мин · 25 000 ֏ — отбеливание за один визит, с защитой дёсен' : '45 мин · 7 000 ֏ — скраб, маска и массаж рук', status: 'pending', source: 'user' }, 2, 15);
    const b3 = bizAt(3);
    const s3 = staffWithPhotos(b3.id);
    if (s3) pushItem({ kind: 'servicePhoto', businessId: b3.id, staffId: s3.id, refId: lastPhoto(s3.photos), imageUrl: lastPhoto(s3.photos), label: s3.name, status: 'pending', source: 'user' }, 1, 9);
    const b4 = bizAt(4);
    pushItem({ kind: 'story', businessId: b4.id, refId: `story_${b4.id}`, imageUrl: b4.photos[0] ?? workPhotos('nails', 1, 2)[0], text: 'Скидка 15% на первое посещение до конца недели', paidCoins: 2000, status: 'pending', source: 'user' }, 1, 12);
    const b5 = bizAt(5);
    pushItem({ kind: 'text', businessId: b5.id, refId: `text_${b5.id}`, text: 'Работаем с 2015 года. Стерильные инструменты, одноразовые пилки. Пишите в WhatsApp +374 99 123 456 — ответим быстрее!', status: 'pending', source: 'user' }, 1, 16);
    const b6 = bizAt(6);
    const s6 = staffByBiz(b6.id)[0];
    pushItem({ kind: 'diploma', businessId: b6.id, staffId: s6?.id, refId: `diploma_${s6?.id ?? b6.id}`, label: s6?.name ?? b6.name, text: 'Сертификат курса повышения квалификации, 2024', status: 'pending', source: 'user' }, 0, 9);
    const b7 = bizAt(7);
    pushItem({ kind: 'complaint', businessId: b7.id, refId: `complaint_${b7.id}`, imageUrl: b7.photos[0], text: 'Клиент пишет: «Это фото не их работы — видела его у другого салона в Instagram»', status: 'pending', source: 'user' }, 0, 11);

    // Решённые
    const b8 = bizAt(8);
    if (b8.photos.length) pushItem({ kind: 'salonPhoto', businessId: b8.id, refId: b8.photos[0], imageUrl: b8.photos[0], status: 'approved', source: 'user' }, 5, 10);
    const s9 = staffWithPhotos(bizAt(9).id);
    if (s9) pushItem({ kind: 'staffPhoto', businessId: bizAt(9).id, staffId: s9.id, refId: lastPhoto(s9.photos), imageUrl: lastPhoto(s9.photos), label: s9.name, status: 'pending', source: 'user' }, 0, 8);
    pushItem({ kind: 'text', businessId: bizAt(10).id, refId: `text_${bizAt(10).id}`, text: 'Уютная студия у метро, парковка во дворе. Запись онлайн — без звонков.', status: 'approved', source: 'user' }, 7, 12);
    pushItem({ kind: 'staffPhoto', businessId: bizAt(2).id, refId: `rejected_photo_${bizAt(2).id}`, imageUrl: workPhotos('hair', 1, 1)[0], status: 'rejected', source: 'user', reasonId: rejectReasons[1].id, reasonNote: 'Такое же фото есть в интернете' }, 4, 14);
    pushItem({ kind: 'story', businessId: bizAt(3).id, refId: `story_rejected_${bizAt(3).id}`, imageUrl: workPhotos('massage', 1, 0)[0], text: 'Звоните по номеру в профиле Instagram', paidCoins: 2000, status: 'rejected', source: 'user', reasonId: rejectReasons[2].id }, 5, 11);
    pushItem({ kind: 'story', businessId: bizAt(5).id, refId: `story_tpl_${bizAt(5).id}`, imageUrl: workPhotos('barber', 1, 0)[0], text: 'Свободно сегодня: 15:00, 17:30', status: 'auto', source: 'template' }, 2, 10);
    const s11 = staffWithPhotos(bizAt(11).id);
    if (s11) pushItem({ kind: 'staffPhoto', businessId: bizAt(11).id, staffId: s11.id, refId: `reuse_${s11.id}`, imageUrl: s11.photos[0], label: s11.name, status: 'auto', source: 'reuse' }, 3, 17);

    if (s0) approvedEarlier(s0, b0.id);
    if (s3) approvedEarlier(s3, b3.id);
    if (s9) approvedEarlier(s9, bizAt(9).id);

    // F-00-171: фото, снятые нами на визите, — без очереди
    for (let i = 0; i < 3; i += 1) {
      const biz = bizAt(i);
      if (biz.photos[0]) pushItem({ kind: 'salonPhoto', businessId: biz.id, refId: `visit_${biz.id}`, imageUrl: biz.photos[0], status: 'auto', source: 'visit' }, 20 + i, 15);
    }

    const coinEntries: CoinEntry[] = moderationItems
      .filter((m) => m.status === 'rejected' && m.paidCoins)
      .map((m, i) => ({
        id: `coin_${i + 1}`,
        businessId: m.businessId,
        kind: 'refund' as const,
        amount: m.paidCoins ?? 0,
        reason: 'moderationReject' as const,
        refId: m.id,
        at: m.decidedAt ?? iso(now, -1),
      }));

    // ── Визиты ──
    const visitorNames = [
      'Nail Studio Ева', 'Barbershop Гарни', 'Salon de Paris', 'Lash & Brow VIP', 'Студия «Артур»',
      'Мойка «Блеск»', 'Dental Smile', 'FitZone', 'Маникюр у Сирануш', 'Барбер «Мужской разговор»',
      'Studio Lilit', 'Nur Beauty', 'Клиника «Улыбка»', 'Мойка Аванс', 'Fit Life',
      'Салон «Гаяне»', 'Barber Point', 'SPA Ноян', 'Nail Bar 21', 'Стоматология Плюс',
    ];
    const visitStatuses: Visit['status'][] = ['connected', 'thinking', 'refused'];
    const spheres: SphereId[] = ['nails', 'barber', 'hair', 'cosmetology', 'massage', 'dental', 'fitness', 'carwash'];
    const visits: Visit[] = visitorNames.map((name, i) => {
      const status = visitStatuses[i % visitStatuses.length];
      const visitedAt = isoDate(now, -(i % 25));
      const createdAt = iso(now, -(i % 25), 11);
      const businessId = status === 'connected' && i % 4 === 0 ? businesses[i % businesses.length].id : undefined;
      // Перезвоны: один сегодня (i=1), один просрочен на 2 дня (i=10), остальные — через 3–6 дней
      const callbackDelta = i === 1 ? 0 : i === 10 ? -2 : 3 + (i % 4);
      const history: Visit['history'] = [{ id: `v${i}_h1`, at: createdAt, kind: 'created', status }];
      if (status === 'connected') history.push({ id: `v${i}_h2`, at: createdAt, kind: 'connected' });
      return {
        id: `visit_${i + 1}`,
        placeName: name,
        contactName: ['Арам', 'Нунэ', 'Тигран', 'Сона', 'Давид', 'Анаит'][i % 6],
        phone: `+37400${(100000 + i * 37).toString().slice(0, 6)}`,
        district: DISTRICTS[i % DISTRICTS.length],
        address: `ул. Абовяна, ${10 + i}`,
        sphereId: spheres[i % spheres.length],
        status,
        visitedAt,
        callbackDate: status === 'thinking' ? isoDate(now, callbackDelta) : undefined,
        refusalReason: status === 'refused' ? ['Уже используют другой сервис', 'Нет времени разбираться', 'Не видят пользы'][i % 3] : undefined,
        note: i % 3 === 0 ? 'Хозяин на месте только по вечерам' : undefined,
        currentTool: (['whatsapp', 'notebook', 'dikidi', 'altegio', 'nothing'] as const)[i % 5],
        willingToPay: i % 4 === 0 ? 8000 + (i % 3) * 2000 : undefined,
        responsibleId: team[i % team.length].id,
        businessId,
        history,
        createdAt,
        updatedAt: createdAt,
      };
    });

    // ── Промокоды ──
    const promoCodes: PromoCode[] = [
      // F-00-019: бесплатный месяц выдаём только тому, к кому пришли сами — код на бесплатный месяц
      // всегда личный (привязан к конкретному салону), иначе его мог бы ввести кто угодно без визита.
      { id: 'promo_1', code: 'VISIT30', kind: 'freeMonth', tiers: [], freeDays: 30, personal: true, issuedTo: { name: 'Nail Studio Ева', businessId: businesses[4]?.id }, issuedAt: iso(now, -40), createdAt: iso(now, -40), note: 'Выдан на визите' },
      { id: 'promo_2', code: 'NURI-10', kind: 'discount', tiers: [{ months: 1, percent: 0 }, { months: 3, percent: 10 }, { months: 6, percent: 15 }, { months: 12, percent: 25 }], personal: true, issuedTo: { name: 'Nuri Nails', businessId: businesses[0]?.id }, issuedAt: iso(now, -15), validUntil: isoDate(now, 15), createdAt: iso(now, -15) },
      { id: 'promo_3', code: 'FRIEND25', kind: 'discount', tiers: [{ months: 12, percent: 25 }], personal: false, validUntil: isoDate(now, 30), createdAt: iso(now, -10) },
      { id: 'promo_4', code: 'BARBER-KAYTSAK', kind: 'freeMonth', tiers: [], freeDays: 30, personal: true, issuedTo: { name: 'Барбершоп Kaytsak', businessId: businesses[1]?.id }, issuedAt: iso(now, -60), usedAt: iso(now, -55), usedByBusinessId: businesses[1]?.id, createdAt: iso(now, -60) },
      { id: 'promo_5', code: 'EXPIRED-15', kind: 'discount', tiers: [{ months: 6, percent: 15 }], personal: false, validUntil: isoDate(now, -5), createdAt: iso(now, -90) },
      { id: 'promo_6', code: 'DENTAL-ATAM', kind: 'discount', tiers: [{ months: 3, percent: 10 }, { months: 12, percent: 25 }], personal: true, issuedTo: { name: 'Стоматология Atam', businessId: businesses[2]?.id }, issuedAt: iso(now, -5), createdAt: iso(now, -5) },
      { id: 'promo_7', code: 'REVOKED-1', kind: 'discount', tiers: [{ months: 1, percent: 0 }], personal: false, revokedAt: iso(now, -2), createdAt: iso(now, -20) },
      // F-00-019: бесплатный месяц — только тем, к кому пришли на визите; общий («на всех») код на
      // бесплатный месяц нарушал бы это решение, поэтому NEWSALON — скидочный код для самостоятельной
      // регистрации (F-00-020), а не freeMonth.
      { id: 'promo_8', code: 'NEWSALON', kind: 'discount', tiers: [{ months: 1, percent: 0 }, { months: 3, percent: 10 }, { months: 6, percent: 15 }, { months: 12, percent: 25 }], personal: false, validUntil: isoDate(now, 60), createdAt: iso(now, -3) },
    ];

    const bizMeta: Record<Id, BizMeta> = {};
    businesses.forEach((biz, i) => {
      bizMeta[biz.id] = {
        businessId: biz.id,
        source: i % 3 === 0 ? 'self' : 'visit',
        // Бесплатный период: у части ещё идёт, у части закончился — оба случая видны в «Бизнесах»
        freeUntil: i % 3 !== 0 ? isoDate(now, [22, -5, 12, 30, -30, 8][i % 6]) : undefined,
        responsibleId: i % 3 !== 0 ? team[i % team.length].id : undefined,
        promoCodeId: i === 0 ? 'promo_2' : i === 1 ? 'promo_4' : undefined,
        leftAt: i === businesses.length - 1 ? isoDate(now, -10) : undefined,
        dataHandedAt: i === businesses.length - 1 ? iso(now, -9) : undefined,
        // F-00-164: предложения поставщиков — только тем, кто сам согласился; в сиде часть согласилась.
        adsOptIn: i % 5 < 2,
      };
    });

    // ── Поддержка ──
    const topics: SupportTicket['topic'][] = ['help', 'billing', 'bug', 'newSphere', 'banner', 'ads', 'other'];
    const channels: SupportTicket['channel'][] = ['cabinet', 'app', 'whatsapp', 'phone', 'telegram', 'email'];
    const sections: SupportTicket['section'][] = ['journal', 'schedule', 'clients', 'online', 'services', 'staff', 'billing'];
    // Текст обращения — по теме; все даты в прошлом (очередь не показывает «завтра»)
    const TOPIC_TEXT: Record<SupportTicket['topic'], string> = {
      help: 'Не получается сохранить изменения в графике — подскажите, что не так?',
      billing: 'Хочу оплатить сразу за полгода, где это сделать?',
      bug: 'В журнале запись на 15:00 показывается дважды.',
      newSphere: 'Я делаю татуировки — можно ли добавить такую сферу?',
      banner: 'Хотим баннер на главной на неделю перед праздниками. Сколько стоит?',
      ads: 'Как отключить предложения поставщиков в кабинете?',
      other: 'Как поменять название салона на странице для клиентов?',
    };
    const supportTickets: SupportTicket[] = Array.from({ length: 12 }, (_, i) => {
      const from: SupportTicket['from'] = i % 4 === 0 ? 'client' : 'business';
      const status: SupportTicket['status'] = i % 5 === 0 ? 'closed' : i % 3 === 0 ? 'waiting' : 'open';
      const biz = from === 'business' ? businesses[i % businesses.length] : undefined;
      const topic = topics[i % topics.length];
      const dayAgo = (i % 10) + 1;
      const createdAt = iso(now, -dayAgo, 9 + (i % 8));
      const msgs: SupportTicket['messages'] = [{ id: `t${i}_m1`, author: 'them', text: TOPIC_TEXT[topic], at: createdAt }];
      if (status !== 'open') msgs.push({ id: `t${i}_m2`, author: 'us', text: 'Здравствуйте! Проверили — уже должно работать, попробуйте ещё раз.', at: iso(now, -dayAgo, 11 + (i % 8)) });
      return {
        id: `ticket_${i + 1}`,
        number: 1000 + i,
        from,
        businessId: biz?.id,
        appUserId: from === 'client' ? core.appUsers[i % core.appUsers.length]?.id : undefined,
        name: biz?.name ?? core.appUsers[i % core.appUsers.length]?.name ?? 'Гость',
        phone: biz?.phone ?? core.appUsers[i % core.appUsers.length]?.phone,
        channel: channels[i % channels.length],
        section: from === 'business' ? sections[i % sections.length] : 'clientApp',
        topic,
        status,
        messages: msgs,
        createdAt,
        updatedAt: msgs[msgs.length - 1].at,
      };
    });

    // ── Спрос ──
    const queries = ['наращивание ресниц', 'массаж лица', 'детская стрижка', 'чистка лица', 'йога', 'мойка кузова', 'брекеты', 'депиляция', 'маникюр гель', 'барбер борода'];
    const demandEntries: DemandEntry[] = [];
    let de = 0;
    for (let w = 0; w < 4; w += 1) {
      queries.forEach((q, qi) => {
        const peopleThisWeek = 2 + ((qi + w) % 5);
        for (let p = 0; p < peopleThisWeek; p += 1) {
          de += 1;
          demandEntries.push({
            id: `demand_${de}`,
            query: q,
            sphereId: spheres[qi % spheres.length],
            district: DISTRICTS[(qi + p) % DISTRICTS.length],
            appUserId: core.appUsers[(de * 3) % core.appUsers.length]?.id ?? 'app_unknown',
            at: iso(now, -(w * 7 + (p % 7)), 14),
            notify: p % 3 === 0,
          });
        }
      });
    }

    const firstAwards: FirstAward[] = [
      { id: 'first_1', businessId: businesses[3]?.id ?? businesses[0].id, scope: 'district', sphereId: 'massage', district: 'avan', freeDays: 30, coins: 1000, at: iso(now, -12) },
    ];

    // ── Реклама ──
    const ads: Ad[] = [
      {
        id: 'ad_1', kind: 'banner', title: 'Скидка 20% на первую запись в приложении', text: undefined,
        imageUrl: interiorPhotos('blush')[0], ctaUrl: '/', advertiser: { name: 'BookTime (мы)', contact: '' },
        placementId: 'pl_banner_home', target: { sphereIds: [], districts: [], size: 'any' }, productKeywords: [],
        startDate: isoDate(now, -5), endDate: isoDate(now, 10), price: 50000, paused: false,
        stats: buildStats(now, -5, 5), createdAt: iso(now, -6),
      },
      {
        id: 'ad_2', kind: 'supplier', title: 'Гель-лак OPI — оптовая поставка', text: 'Скидка 15% при заказе от 30 флаконов', imageUrl: workPhotos('nails', 1, 0)[0],
        advertiser: { name: 'ООО «Бьюти Снаб»', contact: '+374 91 112233' }, placementId: 'pl_supplier_masters',
        target: { sphereIds: ['nails'], districts: [], size: 'any', minStars: 4 }, productKeywords: ['гель-лак', 'OPI'],
        startDate: isoDate(now, -10), endDate: isoDate(now, 20), price: 30000, paused: false,
        stats: buildStats(now, -10, 10), createdAt: iso(now, -11),
      },
      {
        id: 'ad_3', kind: 'supplier', title: 'Расходники для барбершопов заканчиваются — довезём за день', text: 'Бритвенные станки, крем для бритья',
        advertiser: { name: 'BarberSupply AM', contact: '+374 55 998877' }, placementId: 'pl_stock',
        target: { sphereIds: ['barber'], districts: [], size: 'any' }, productKeywords: ['крем для бритья', 'станки'],
        startDate: isoDate(now, -2), endDate: isoDate(now, 28), price: 20000, paused: false,
        stats: buildStats(now, -2, 2), createdAt: iso(now, -3),
      },
      {
        id: 'ad_4', kind: 'banner', title: 'Новые салоны района Арабкир', imageUrl: interiorPhotos('sage')[0], advertiser: { name: 'BookTime (мы)', contact: '' },
        placementId: 'pl_banner_search', target: { sphereIds: [], districts: ['arabkir'], size: 'any' }, productKeywords: [],
        startDate: isoDate(now, 3), endDate: isoDate(now, 17), price: 40000, paused: false, stats: {}, createdAt: iso(now, -1),
      },
      {
        id: 'ad_5', kind: 'supplier', title: 'Массажные масла премиум', advertiser: { name: 'SPA Wholesale', contact: '+374 77 445566' },
        placementId: 'pl_supplier_masters', target: { sphereIds: ['massage'], districts: [], size: 'any' }, productKeywords: ['масло'],
        startDate: isoDate(now, -30), endDate: isoDate(now, -3), price: 15000, paused: true, stats: buildStats(now, -30, 27), createdAt: iso(now, -31),
      },
    ];

    const storyConfig: StoryPlacesConfig = {
      places: 6,
      scope: 'city',
      pricePerDay: 2000,
      lastPlacesCount: 2,
      lastPlacesMarkup: 50,
      queueMarkup: 30,
      daysAhead: 14,
    };
    const storyBookings: StoryBooking[] = businesses.slice(0, 7).map((biz, i) => ({
      id: `story_${i + 1}`,
      businessId: biz.id,
      date: isoDate(now, i % 3),
      district: i % 2 === 0 ? DISTRICTS[i % DISTRICTS.length] : undefined,
      mode: i < 6 ? ('place' as const) : ('queue' as const),
      price: i >= storyConfig.places - storyConfig.lastPlacesCount && i < storyConfig.places
        ? Math.round(storyConfig.pricePerDay * (1 + storyConfig.lastPlacesMarkup / 100))
        : storyConfig.pricePerDay,
      status: 'active' as const,
      source: i % 3 === 0 ? ('template' as const) : ('photo' as const),
      createdAt: iso(now, -(i + 1)),
      // F-00-162: статистика конкретной сторис — только у мест «place» (реально показанные), очередь ещё не шла в эфир.
      views: i < 6 ? 180 + i * 47 : 0,
      clicks: i < 6 ? 6 + i * 3 : 0,
      bookingsFromStory: i < 6 ? Math.max(0, i - 1) : 0,
    }));

    // ── Копии и выгрузка ──
    const backupCopies: BackupCopy[] = businesses.flatMap((biz, bi) =>
      [0, 7, 14].map((d, k) => ({
        id: `backup_${bi}_${k}`,
        businessId: biz.id,
        at: iso(now, -d, 3),
        kind: (k === 0 ? 'manual' : 'auto') as 'manual' | 'auto',
        counts: {
          clients: core.clients.filter((c) => c.businessId === biz.id).length,
          bookings: core.bookings.filter((b) => b.businessId === biz.id).length,
          services: core.services.filter((s) => s.businessId === biz.id).length,
          staff: core.staff.filter((s) => s.businessId === biz.id).length,
        },
        sizeKb: 80 + bi * 12 + k * 4,
      })),
    );
    const exportLog: ExportLogEntry[] = [
      { id: 'exp_1', businessId: businesses[businesses.length - 1].id, what: 'clients', rows: core.clients.filter((c) => c.businessId === businesses[businesses.length - 1].id).length, at: iso(now, -9) },
      { id: 'exp_2', businessId: businesses[businesses.length - 1].id, what: 'bookings', rows: core.bookings.filter((b) => b.businessId === businesses[businesses.length - 1].id).length, at: iso(now, -9, 10) },
    ];

    // ── План запуска (F-00-203…205: состав волн — предложение из 00-our-decisions.md §19, не подтверждено
    // пользователем; порядок явно не решён). Пункты с пустым fids — заметки, в счёт прогресса не входят
    // (см. PlanScreen). «Прошла» ставится только когда «Готово, когда» функции реально выполняется.
    const waveItems: WaveItem[] = [
      { id: 'w1_1', wave: 1, fids: ['F-00-051', 'F-00-065'], title: { ru: 'Календарь и расписание', en: 'Calendar & schedule' }, status: 'building', note: 'Ждём правок режима календаря и видимости мастера' },
      // F-00-203/204: было 'passed' без проверки «Готово, когда» — правка нарушения, не подтверждение готовности
      // (эти fids не в зоне platform; статус снижен до 'building', пока их разделы не подтвердят прохождение).
      { id: 'w1_2', wave: 1, fids: ['F-00-011'], title: { ru: 'Услуги, цены, фото (до 6), роли салона', en: 'Services, prices, up to 6 photos, salon roles' }, status: 'building' },
      { id: 'w1_3', wave: 1, fids: [], title: { ru: 'Запись клиентом и карточки CRM', en: 'Client booking & CRM cards' }, status: 'building' },
      { id: 'w1_4', wave: 1, fids: [], title: { ru: 'Клиентский поиск, запись, напоминания, избранное и звёздочки', en: 'Client search, booking, reminders, favourites and stars' }, status: 'building' },
      { id: 'w1_5', wave: 1, fids: ['F-00-155'], title: { ru: 'Картинка сторис со свободными окнами', en: 'Story image with free slots' }, status: 'todo' },
      { id: 'w1_6', wave: 1, fids: ['F-00-020', 'F-00-021'], title: { ru: 'Подписка, промокоды, заморозка', en: 'Subscription, promo codes, freeze' }, status: 'building', note: 'Промокоды готовы; экран подписки делает команда настроек' },
      { id: 'w1_7', wave: 1, fids: ['F-00-179', 'F-00-168', 'F-00-170'], title: { ru: 'Наша панель: проверка контента', en: 'Our panel: content moderation' }, status: 'building', note: 'Очередь и решения готовы; осталось подключить отправку на проверку из кабинета' },
      { id: 'w1_8', wave: 1, fids: ['F-00-176'], title: { ru: 'Наша панель: подключение салона на визите', en: 'Our panel: connect a salon on a visit' }, status: 'building' },
      { id: 'w1_9', wave: 1, fids: ['F-00-177'], title: { ru: 'Наша панель: учёт визитов', en: 'Our panel: visit log' }, status: 'building' },
      { id: 'w1_10', wave: 1, fids: [], title: { ru: 'Сферы: маникюр и барберы', en: 'Spheres: nails & barbers' }, status: 'building' },

      { id: 'w2_1', wave: 2, fids: [], title: { ru: 'Отчёты владельца', en: 'Owner reports' }, status: 'todo' },
      { id: 'w2_2', wave: 2, fids: [], title: { ru: 'Склад, препараты, палитра, сроки годности', en: 'Stock, materials, palette, expiry dates' }, status: 'todo' },
      { id: 'w2_3', wave: 2, fids: [], title: { ru: 'Повторяющиеся записи', en: 'Recurring bookings' }, status: 'todo' },
      { id: 'w2_4', wave: 2, fids: [], title: { ru: 'Выезд и места работы', en: 'House calls & work places' }, status: 'todo' },
      { id: 'w2_5', wave: 2, fids: [], title: { ru: 'Ручная предоплата, отмена и перенос записи', en: 'Manual prepayment, cancel & reschedule' }, status: 'todo' },
      { id: 'w2_6', wave: 2, fids: ['F-00-159'], title: { ru: 'Монеты и сторис в приложении', en: 'Coins & in-app stories' }, status: 'todo', note: 'Покупку сторис делает команда приложения клиента' },
      { id: 'w2_7', wave: 2, fids: ['F-00-182'], title: { ru: 'Наша панель: поддержка бизнеса', en: 'Our panel: business support' }, status: 'building' },
      // F-00-204: 'passed' стояло при открытых major у F-00-180/F-00-202 (canvas сторис пуст до клика,
      // «не нашли» у клиента не зовёт reportSearchDemand) — статус приведён к фактическому.
      { id: 'w2_8', wave: 2, fids: ['F-00-180', 'F-00-202'], title: { ru: 'Наша панель: отчёт спроса', en: 'Our panel: demand report' }, status: 'building' },
      { id: 'w2_9', wave: 2, fids: ['F-00-181'], title: { ru: 'Наша панель: награда первому', en: 'Our panel: first-mover award' }, status: 'building' },
      { id: 'w2_10', wave: 2, fids: ['F-00-160', 'F-00-166'], title: { ru: 'Наша панель: места сторис и заведение рекламы', en: 'Our panel: story slots & setting up ads' }, status: 'building' },

      { id: 'w3_1', wave: 3, fids: ['F-00-164', 'F-00-165'], title: { ru: 'Реклама поставщиков (в т.ч. у склада)', en: 'Supplier ads (incl. at stock)' }, status: 'building' },
      { id: 'w3_2', wave: 3, fids: ['F-00-163'], title: { ru: 'Баннеры — только через саппорт', en: 'Banners — support-only' }, status: 'todo' },
      { id: 'w3_3', wave: 3, fids: [], title: { ru: 'Новые сферы: стоматологи и фитнес', en: 'New spheres: dentists & fitness' }, status: 'todo' },
      { id: 'w3_4', wave: 3, fids: ['F-00-174'], title: { ru: 'Автоперевод текстов мастера', en: 'Auto-translate master texts' }, status: 'todo' },
      { id: 'w3_5', wave: 3, fids: [], title: { ru: 'Запись голосом', en: 'Voice booking' }, status: 'todo' },
      { id: 'w3_6', wave: 3, fids: ['F-00-183'], title: { ru: 'Наша панель: копии данных и выгрузка', en: 'Our panel: data backups & export' }, status: 'building' },
      { id: 'w3_note_wallet', wave: 3, fids: [], title: { ru: 'Кошелёк клиента и 5% комиссии — отложено, не в ближайших волнах', en: 'Client wallet & 5% fee — deferred, not in the next waves' }, status: 'todo' },
    ];
    // F-00-207: «ни один пункт не подтверждён» — сид не должен выдумывать решения, статус только 'open'.
    const prelaunchItems: PrelaunchItem[] = [
      { id: 'pre_1', order: 1, title: { ru: 'Макет салонам для показа на визите', en: 'Mockup to show salons on a visit' }, hint: { ru: 'Несколько экранов, чтобы владелец увидел результат сразу', en: 'A few screens so the owner sees the result right away' }, status: 'open', decision: '', note: '' },
      { id: 'pre_2', order: 2, title: { ru: 'Юридическое оформление', en: 'Legal setup' }, hint: { ru: 'ИП или ООО, договор оферты', en: 'Sole proprietor or LLC, offer agreement' }, status: 'open', decision: '', note: '' },
      { id: 'pre_3', order: 3, title: { ru: 'Время на поход по салонам', en: 'Time for visiting salons' }, hint: { ru: 'Кто идёт, сколько салонов в день', en: 'Who goes, how many salons per day' }, status: 'open', decision: '', note: '' },
      { id: 'pre_4', order: 4, title: { ru: 'Копии данных перед стартом', en: 'Data backups before launch' }, hint: { ru: 'Проверить, что выгрузка правда работает', en: 'Check the export actually works' }, status: 'open', decision: '', note: '' },
      { id: 'pre_5', order: 5, title: { ru: 'Расходы на старт', en: 'Launch costs' }, hint: { ru: 'Хостинг, SMS/пуши, дорога', en: 'Hosting, SMS/push, travel' }, status: 'open', decision: '', note: '' },
      { id: 'pre_6', order: 6, title: { ru: 'Пробные аккаунты DIKIDI / Altegio / Rez', en: 'Trial accounts: DIKIDI / Altegio / Rez' }, hint: { ru: 'Посмотреть их цены и подключение изнутри', en: 'See their pricing and onboarding from the inside' }, status: 'open', decision: '', note: '' },
    ];
    // F-00-013: решено 4 000 драм за мастера (не 3 000); F-00-206: курс — решённые 363 (не 400).
    const paybackInputs: PaybackInputs = {
      monthlyCosts: 800000,
      individualPrice: 5000,
      salonPerMaster: 4000,
      avgMasters: 4,
      discountShare: 30,
      discountPercent: 15,
      targetNet: 500000,
      usdRate: 363,
      eurRate: 430,
    };
    // F-00-208: «ничего не проверено» — сид не должен выдумывать проверки имён или статус доменов.
    const nameCandidates: NameCandidate[] = [
      { id: 'name_1', name: 'Zham', spelling: { ru: 'Жам', hy: 'Ժամ', en: 'Zham' }, checks: { ru: 'unknown', hy: 'unknown', en: 'unknown' }, domain: 'zham.am', domainStatus: 'unknown', note: 'Значит «час/время» — понятно армянам (предложение, не проверено)' },
      { id: 'name_2', name: 'Slotik', spelling: { ru: 'Слотик', hy: 'Սլոթիկ', en: 'Slotik' }, checks: { ru: 'unknown', hy: 'unknown', en: 'unknown' }, domain: 'slotik.am', domainStatus: 'unknown', note: 'Предложение, не проверено' },
      { id: 'name_3', name: 'Азат', spelling: { ru: 'Азат', hy: 'Ազատ', en: 'Azat' }, checks: { ru: 'unknown', hy: 'unknown', en: 'unknown' }, domain: 'azat.am', domainStatus: 'unknown', note: 'Предложение, не проверено' },
      { id: 'name_4', name: 'Окошко', spelling: { ru: 'Окошко', hy: 'Օկոշկո', en: 'Okoshko' }, checks: { ru: 'unknown', hy: 'unknown', en: 'unknown' }, domain: 'okoshko.am', domainStatus: 'unknown', note: 'Рабочее название, не финал' },
      { id: 'name_5', name: 'Nrani', spelling: { ru: 'Нрани', hy: 'Նռանի', en: 'Nrani' }, checks: { ru: 'unknown', hy: 'unknown', en: 'unknown' }, domain: 'nrani.am', domainStatus: 'unknown', note: 'Предложение, не проверено' },
    ];
    const brand: BrandState = { chosenId: undefined };

    // ── Идеи (F-00-009, наша очередь) — «Предложить идею» ставится в кабинете бизнеса (раздел client);
    // здесь только очередь с голосами и статусом, и отметка «уведомили автора» при «сделано».
    const ideaAuthors = businesses.slice(0, 6);
    const ideas: Idea[] = [
      { id: 'idea_1', businessId: ideaAuthors[0].id, authorName: ideaAuthors[0].name, text: 'Повторяющиеся записи — чтобы не создавать одну и ту же запись каждую неделю вручную', votes: 14, voterIds: businesses.slice(0, 14).map((b) => b.id), status: 'inProgress', createdAt: iso(now, -21) },
      { id: 'idea_2', businessId: ideaAuthors[1].id, authorName: ideaAuthors[1].name, text: 'Напоминание клиенту за час до записи, а не только за день', votes: 9, voterIds: businesses.slice(0, 9).map((b) => b.id), status: 'considering', createdAt: iso(now, -15) },
      { id: 'idea_3', businessId: ideaAuthors[2].id, authorName: ideaAuthors[2].name, text: 'Список ожидания — если клиент отменил запись, предложить окно следующему в очереди', votes: 21, voterIds: businesses.slice(0, Math.min(21, businesses.length)).map((b) => b.id), status: 'inProgress', createdAt: iso(now, -30) },
      { id: 'idea_4', businessId: ideaAuthors[3].id, authorName: ideaAuthors[3].name, text: 'Своя палитра оттенков лака в карточке услуги маникюра', votes: 5, voterIds: businesses.slice(0, 5).map((b) => b.id), status: 'considering', createdAt: iso(now, -6) },
      { id: 'idea_5', businessId: ideaAuthors[4].id, authorName: ideaAuthors[4].name, text: 'Кнопка «Повторить запись» в карточке клиента — та же услуга и мастер', votes: 27, voterIds: businesses.map((b) => b.id), status: 'done', createdAt: iso(now, -60), decidedAt: iso(now, -3), notifiedAt: iso(now, -3) },
      { id: 'idea_6', businessId: ideaAuthors[5].id, authorName: ideaAuthors[5].name, text: 'Фильтр клиентов «не были больше 60 дней» для рассылки', votes: 3, voterIds: businesses.slice(0, 3).map((b) => b.id), status: 'considering', createdAt: iso(now, -2) },
    ];

    // ── Заявки на сферы (F-00-151, F-00-152) — регистрация «моей сферы нет» и оплата года ведёт settings;
    // здесь только очередь заявок, которые видит наша панель.
    const sphereRequests: SphereRequest[] = [
      { id: 'sreq_1', kind: 'noSphere', businessId: businesses[6]?.id, masterName: 'Артур Оганесян', phone: '+37455123456', sphereName: 'Мойщик машин', needs: [], status: 'open', createdAt: iso(now, -4) },
      { id: 'sreq_2', kind: 'noSphere', masterName: 'Лилит Хачатрян', phone: '+37477234567', sphereName: 'Тату-мастер', needs: [], status: 'agreed', createdAt: iso(now, -18), note: 'Работает на общем шаблоне, ждёт функции тату-сферы' },
      { id: 'sreq_3', kind: 'newSphere', businessId: businesses[7]?.id, masterName: 'Норайр Мкртчян', phone: '+37493345678', sphereName: 'Ветеринария', needs: ['Карточка питомца', 'Прививки и напоминания о них', 'Приём на дому'], status: 'inProgress', createdAt: iso(now, -40), readyAt: undefined },
      { id: 'sreq_4', kind: 'newSphere', masterName: 'Сона Абрамян', phone: '+37441456789', sphereName: 'Фитнес-тренер', needs: ['Групповые занятия', 'Абонементы на количество тренировок'], status: 'done', createdAt: iso(now, -90), readyAt: isoDate(now, -20), decidedAt: iso(now, -20) },
      { id: 'sreq_5', kind: 'noSphere', masterName: 'Геворг Саакян', phone: '+37499567890', sphereName: 'Клининг на дому', needs: [], status: 'open', createdAt: iso(now, -1) },
    ];

    return {
      team,
      rejectReasons,
      moderationItems,
      coinEntries,
      connectDrafts: [],
      visits,
      promoCodes,
      bizMeta,
      supportTickets,
      demandEntries,
      firstAwards,
      ads,
      storyConfig,
      storyBookings,
      backupCopies,
      exportLog,
      waveItems,
      prelaunchItems,
      paybackInputs,
      nameCandidates,
      brand,
      ideas,
      sphereRequests,
    };
  },
});


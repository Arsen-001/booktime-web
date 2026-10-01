import { toISODate, toISODateTime } from '@/lib/date';
import { defineSlice } from '@/mock/slice';
import { BIZ, LOC, ST } from '@/mock/seed/ids';
import type {
  AssistantSettings,
  BookingAssistant,
  EventCategory,
  EventExtra,
  EventSeriesDef,
  EventTemplate,
  GroupSeatsSettings,
  GroupServicePaymentSettings,
  PackageExtra,
  ParticipantExtraItem,
  ParticipantPayment,
  ResourcesChangeLogEntry,
  ResourcesFineRights,
  VisitScheduleEntry,
  WaitlistEntry,
} from '@/domain/resources';
import type { CoreData, Id, ISODateTime } from '@/domain/core';

/**
 * Срез моковой базы раздела «resources». Ресурсы и групповые события — сущности ЯДРА (Resource, GroupEvent,
 * уже сидированы в src/mock/seed/resources.ts и src/mock/seed/bookings.ts) — здесь их нет, читаем/пишем через
 * src/api/core.ts. Здесь только лист ожидания (наши демо-данные — core-rules: resources владеет сущностью).
 */
/** Ссылка и инструкция «Присоединиться к событию» (F-16-081) + журнал отправок (F-16-082) — надстройка над GroupEvent */
export interface EventJoinInfo {
  url: string;
  instructions: string;
  sentAt: ISODateTime[];
}

export interface ResourcesState {
  waitlist: WaitlistEntry[];
  /**
   * Описание ресурса (F-16-003): Resource (ядро) не хранит description — метаданные-надстройка в своём
   * срезе, ключ — id ресурса ядра, как categoryColors у clients. Просьба добавить поле в ядро — qa/requests/resources.md.
   */
  descriptions: Record<string, string>;
  /** Шаблоны повтора события (F-16-064) */
  eventTemplates: EventTemplate[];
  /** Расписание (серия) событий — правило по дням недели + дата окончания (F-16-067…077); ключ = GroupEvent.seriesId */
  eventSeriesDefs: Record<Id, EventSeriesDef>;
  /** Расписание посещений клиента по серии (F-16-078…080) */
  visitSchedules: VisitScheduleEntry[];
  /** Онлайн-занятие: ссылка/инструкция/отправки (F-16-081…083); ключ = id события */
  eventJoin: Record<Id, EventJoinInfo>;
  /** Надстройка пакета услуг (F-16-107…122) — ключ = Service.id (услуга-пакет ядра) */
  packages: Record<Id, PackageExtra>;
  /** Тонкие права по сотруднику (F-16-026, F-16-144, F-16-169); нет записи — умолчание по роли (lib/rights.ts) */
  staffRights: Record<Id, Partial<ResourcesFineRights>>;
  /** Настройки компенсации ассистентам, ключ = businessId (F-16-140/141) */
  assistantSettings: Record<Id, AssistantSettings>;
  /** Кто из сотрудников доступен для ассистирования (F-16-138), ключ = staffId */
  staffAssistantEligible: Record<Id, boolean>;
  /** Ассистенты строки записи (F-16-142/143) — ключ = `${bookingId}:${serviceIndex}` */
  bookingAssistants: Record<string, BookingAssistant[]>;
  /** Кому из заявок листа ожидания уже отправлен пуш об освободившемся окне (F-16-166), ключ = id заявки */
  waitlistNotified: Record<Id, ISODateTime[]>;
  /**
   * Id старых заявок приложения (client.waitlist) и виджета (online.waitlistRequests), уже перенесённых в этот лист
   * (01.10.2026): перенос при первой записи в лист, удалённая потом заявка не «воскресает» из старого места
   */
  waitlistImported?: Id[];
  /** Старые заявки приложения и виджета уже перенесены — их срезы больше не читаем (лишние перечитывания листа) */
  waitlistLegacyDone?: boolean;
  /** Журнал изменений: ресурсы, события, заявки, пакеты — с автором и временем (F-16-171) */
  changelog: ResourcesChangeLogEntry[];
  /** Категории событий (F-16-043) */
  eventCategories: EventCategory[];
  /** «Детали события» (F-16-039): ресурсы читает GroupEvent.resourceIds, здесь — цвет/категории/комментарий; ключ = id события */
  eventExtras: Record<Id, EventExtra>;
  /** Настройка «несколько мест» по бизнесу (F-16-049) */
  groupSeatsSettings: Record<Id, GroupSeatsSettings>;
  /** Товары/абонементы/сертификаты, проданные участнику события (F-16-059), ключ = id брони */
  participantExtras: Record<Id, ParticipantExtraItem[]>;
  /** Быстрая оплата участника события (F-16-060/061), ключ = id брони */
  participantPayments: Record<Id, ParticipantPayment>;
  /**
   * Автосписание с абонемента (F-16-062, движок настройки — loyalty F-06-127): статус брони на конкретное
   * событие/визит, ключ = id брони. Нет записи — «не применялось» (услуга без автосписания или клиент без
   * абонемента). Пишет getBookingAutoCharge/chargeBookingAutoDebit в api/resources.ts.
   */
  autoChargeStatus: Record<Id, { status: 'charged' | 'not_charged'; membershipId?: Id; at: ISODateTime }>;
  /**
   * «Разделять запись с услугами, которые используют разные ресурсы» (F-16-016) — по бизнесу; выключено —
   * ресурсы всех услуг визита заняты на всё время записи, включено — каждый ресурс занят только на время своей
   * услуги. В пробном кабинете Altegio включено по умолчанию (ТЗ) — здесь по той же причине true.
   */
  splitByResource: Record<Id, boolean>;
  /** Предоплата и абонемент у групповой услуги (F-16-031), ключ = Service.id */
  groupServicePayment: Record<Id, GroupServicePaymentSettings>;
}

function seedWaitlist(core: CoreData, now: Date): WaitlistEntry[] {
  const explicit = seedExplicitWaitlist(now);
  // Одна активная демо-заявка у бизнеса без своих примеров (раньше её сеял срез journal — лист теперь один, 30.09.2026):
  // панель журнала и /biz/waitlist непустые сразу. Пустым демо (нет клиента/услуги) собрать заявку не из чего.
  const withEntries = new Set(explicit.map((e) => e.businessId));
  const fallback = core.businesses.flatMap((business): WaitlistEntry[] => {
    if (withEntries.has(business.id)) return [];
    const location = core.locations.find((l) => l.businessId === business.id);
    const client = core.clients.find((c) => c.businessId === business.id);
    const service = core.services.find((sv) => sv.businessId === business.id && sv.active);
    if (!location || !client || !service) return [];
    const inTwoDays = new Date(now);
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    return [
      {
        id: `wl_demo_${business.id}`,
        businessId: business.id,
        locationId: location.id,
        clientName: client.name,
        clientPhone: client.phone,
        serviceIds: [service.id],
        staffIds: [],
        wishes: [{ date: toISODate(inTwoDays) }],
        tags: [],
        createdAt: toISODateTime(now),
      },
    ];
  });
  return [...explicit, ...seedSelfJoined(core, now), ...fallback];
}

/**
 * Заявки, которые клиенты поставили сами (один лист для всех входов, 01.10.2026): демо-клиент приложения —
 * «Сообщить, когда освободится» (он же видит её у себя в «Мои записи»), и гость виджета онлайн-записи.
 */
function seedSelfJoined(core: CoreData, now: Date): WaitlistEntry[] {
  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  };
  const user = core.appUsers?.[0];
  const out: WaitlistEntry[] = [];
  if (user) {
    out.push({
      id: 'wl_nuri_app',
      businessId: BIZ.nuri,
      locationId: LOC.nuri,
      clientName: user.name,
      clientPhone: user.phone,
      source: 'app',
      appUserId: user.id,
      serviceIds: ['sv_nuri_gel'],
      staffIds: [ST.nuriAni],
      wishes: [{ date: inDays(2) }],
      tags: [],
      createdAt: toISODateTime(new Date(now.getTime() - 3 * 3_600_000)),
    });
  }
  out.push({
    id: 'wl_nuri_widget',
    businessId: BIZ.nuri,
    locationId: LOC.nuri,
    clientName: 'Нарине Саргсян',
    clientPhone: '+37491778899',
    source: 'widget',
    serviceIds: ['sv_nuri_classic'],
    staffIds: [ST.nuriEva],
    wishes: [{ date: inDays(1) }],
    comment: 'Можно после 17:00',
    tags: [],
    createdAt: toISODateTime(new Date(now.getTime() - 26 * 3_600_000)),
  });
  return out;
}

function seedExplicitWaitlist(now: Date): WaitlistEntry[] {
  const at = (daysAgo: number, hm: string) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return `${d.toISOString().slice(0, 10)}T${hm}`;
  };
  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const agoDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  return [
    // Nuri (nails) — активные заявки с разными желаниями
    {
      id: 'wl_nuri_1',
      businessId: BIZ.nuri,
      locationId: LOC.nuri,
      clientName: 'Анна Симонян',
      clientPhone: '+37493112233',
      serviceIds: ['sv_nuri_gel'],
      staffIds: [ST.nuriAni],
      // F-16-153: два дня, во втором — два интервала («+ Добавить время»)
      wishes: [
        { date: inDays(3), time: '18:00' },
        {
          date: inDays(5),
          intervals: [
            { from: '10:00', to: '12:00' },
            { from: '16:00', to: '18:00' },
          ],
        },
      ],
      comment: 'Хочет именно к Ани, вечером после работы',
      tags: [],
      createdAt: at(1, '11:20'),
    },
    {
      id: 'wl_nuri_2',
      businessId: BIZ.nuri,
      locationId: LOC.nuri,
      clientName: 'Мариам Акопян',
      clientPhone: '+37494223344',
      serviceIds: ['sv_nuri_pedi_spa'],
      // F-16-152: клиент готов к любому из двух мастеров
      staffIds: [ST.nuriGayane, ST.nuriEva],
      wishes: [{ date: inDays(1) }],
      tags: ['vip'],
      createdAt: at(0, '09:05'),
    },
    // Просроченная — все желания в прошлом
    {
      id: 'wl_nuri_3',
      businessId: BIZ.nuri,
      locationId: LOC.nuri,
      clientName: 'Лилит Петросян',
      clientPhone: '+37495334455',
      serviceIds: ['sv_nuri_classic', 'sv_nuri_design'],
      staffIds: [],
      wishes: [{ date: agoDays(2), time: '14:00' }],
      comment: 'Звонила, но так и не дозвонились',
      tags: [],
      createdAt: at(6, '16:40'),
    },
    // Закрытая — уже записана
    {
      id: 'wl_nuri_4',
      businessId: BIZ.nuri,
      locationId: LOC.nuri,
      clientName: 'Гоар Давтян',
      clientPhone: '+37496445566',
      serviceIds: ['sv_nuri_ext'],
      staffIds: [],
      wishes: [{ date: inDays(2) }],
      tags: [],
      createdAt: at(3, '10:15'),
      closedBookingId: 'seed_wl_closed',
    },
    // Kaytsak (barber)
    {
      id: 'wl_kay_1',
      businessId: BIZ.kaytsak,
      locationId: LOC.kaytsak,
      clientName: 'Ваге Мкртчян',
      clientPhone: '+37497556677',
      serviceIds: ['sv_kay_combo'],
      staffIds: [ST.kaytsakDavid],
      wishes: [
        { date: inDays(1), time: '19:00' },
        { date: inDays(2), time: '19:00' },
      ],
      comment: 'Только вечером, после 18:00',
      tags: [],
      createdAt: at(0, '13:00'),
    },
    {
      id: 'wl_kay_2',
      businessId: BIZ.kaytsak,
      locationId: LOC.kaytsak,
      clientName: 'Тигран Арутюнян',
      clientPhone: '+37498667788',
      serviceIds: ['sv_kay_shave'],
      staffIds: [],
      // F-16-153: заявка без конкретной даты — «любое время», разрешено (см. ❓ в ТЗ — трактуем как «да»)
      wishes: [],
      comment: 'Любое время, звонить заранее',
      tags: [],
      createdAt: at(2, '08:30'),
    },
    // Atam (dental)
    {
      id: 'wl_atam_1',
      businessId: BIZ.atam,
      locationId: LOC.atam,
      clientName: 'Диана Костанян',
      clientPhone: '+37499778899',
      serviceIds: ['sv_atam_clean'],
      staffIds: [],
      wishes: [{ date: inDays(7) }],
      tags: [],
      createdAt: at(1, '17:50'),
    },
    // Vard (hair / colour / skin salon)
    {
      id: 'wl_vard_1',
      businessId: BIZ.vard,
      locationId: LOC.vard,
      clientName: 'Ануш Карапетян',
      clientPhone: '+37491223344',
      serviceIds: ['sv_vard_airtouch'],
      staffIds: [ST.vardInessa],
      wishes: [{ date: inDays(4), time: '17:00' }],
      tags: [],
      createdAt: at(1, '10:00'),
    },
    {
      id: 'wl_vard_2',
      businessId: BIZ.vard,
      locationId: LOC.vard,
      clientName: 'Сюзанна Товмасян',
      clientPhone: '+37495667788',
      serviceIds: ['sv_vard_face', 'sv_vard_peel'],
      staffIds: [ST.vardKarine],
      wishes: [
        {
          date: inDays(2),
          intervals: [
            { from: '11:00', to: '13:00' },
            { from: '15:00', to: '17:00' },
          ],
        },
      ],
      comment: 'Чувствительная кожа, предупредить мастера',
      tags: [],
      createdAt: at(0, '09:40'),
    },
    // Просроченная — желание в прошлом
    {
      id: 'wl_vard_3',
      businessId: BIZ.vard,
      locationId: LOC.vard,
      clientName: 'Норайр Даниелян',
      clientPhone: '+37499112244',
      serviceIds: ['sv_vard_cut_m'],
      staffIds: [ST.vardEdgar],
      wishes: [{ date: agoDays(4), time: '12:00' }],
      tags: [],
      createdAt: at(7, '14:20'),
    },
    // Manana Beauty · Нор-Норк
    {
      id: 'wl_mnn_1',
      businessId: BIZ.mananaNN,
      locationId: LOC.mananaNN,
      clientName: 'Милена Абрамян',
      clientPhone: '+37491332255',
      serviceIds: ['sv_mnn_color'],
      staffIds: [ST.mananaNane],
      wishes: [{ date: inDays(3), time: '16:00' }],
      tags: [],
      createdAt: at(1, '12:10'),
    },
    {
      id: 'wl_mnn_2',
      businessId: BIZ.mananaNN,
      locationId: LOC.mananaNN,
      clientName: 'Нуне Казарян',
      clientPhone: '+37455443322',
      serviceIds: ['sv_mnn_face'],
      staffIds: [],
      wishes: [],
      comment: 'Любое время, работает посменно — звонить и уточнять',
      tags: [],
      createdAt: at(2, '11:00'),
    },
    // Закрытая — уже записана
    {
      id: 'wl_mnn_3',
      businessId: BIZ.mananaNN,
      locationId: LOC.mananaNN,
      clientName: 'Тагуи Мелконян',
      clientPhone: '+37493998877',
      serviceIds: ['sv_mnn_style'],
      staffIds: [ST.mananaArpi],
      wishes: [{ date: inDays(1) }],
      tags: [],
      createdAt: at(3, '15:30'),
      closedBookingId: 'seed_wl_closed_mnn',
    },
    // Manana Beauty · Шенгавит
    {
      id: 'wl_msh_1',
      businessId: BIZ.mananaSH,
      locationId: LOC.mananaSH,
      clientName: 'Рипсиме Оганесян',
      clientPhone: '+37494112288',
      serviceIds: ['sv_msh_color'],
      staffIds: [ST.mananaAstghik],
      wishes: [{ date: inDays(5), time: '13:00' }],
      tags: [],
      createdAt: at(0, '10:50'),
    },
    {
      id: 'wl_msh_2',
      businessId: BIZ.mananaSH,
      locationId: LOC.mananaSH,
      clientName: 'Артур Бабаян',
      clientPhone: '+37477112233',
      serviceIds: ['sv_msh_cut_m'],
      staffIds: [ST.mananaGor],
      wishes: [{ date: inDays(2), intervals: [{ from: '18:00', to: '20:00' }] }],
      comment: 'Только после работы, до 20:00',
      tags: [],
      createdAt: at(1, '08:15'),
    },
    // Просроченная — желание в прошлом
    {
      id: 'wl_msh_3',
      businessId: BIZ.mananaSH,
      locationId: LOC.mananaSH,
      clientName: 'Ашхен Гукасян',
      clientPhone: '+37499223311',
      serviceIds: ['sv_msh_face'],
      staffIds: [ST.mananaTamara],
      wishes: [{ date: agoDays(5), time: '11:00' }],
      tags: [],
      createdAt: at(9, '09:00'),
    },
    // Лусине · массаж
    {
      id: 'wl_lus_1',
      businessId: BIZ.lusine,
      locationId: LOC.lusine,
      clientName: 'Мгер Саакян',
      clientPhone: '+37491556677',
      serviceIds: ['sv_lus_sport'],
      staffIds: [ST.lusine],
      wishes: [{ date: inDays(2), time: '19:00' }],
      tags: [],
      createdAt: at(0, '14:00'),
    },
    {
      id: 'wl_lus_2',
      businessId: BIZ.lusine,
      locationId: LOC.lusine,
      clientName: 'Кристине Егиазарян',
      clientPhone: '+37495998877',
      serviceIds: ['sv_lus_relax'],
      staffIds: [],
      wishes: [{ date: inDays(6) }],
      comment: 'До и после родов, нужна мягкая техника',
      tags: ['vip'],
      createdAt: at(1, '16:45'),
    },
    // Закрытая — уже записана
    {
      id: 'wl_lus_3',
      businessId: BIZ.lusine,
      locationId: LOC.lusine,
      clientName: 'Ваагн Мартиросян',
      clientPhone: '+37498112255',
      serviceIds: ['sv_lus_classic'],
      staffIds: [ST.lusine],
      wishes: [{ date: inDays(3) }],
      tags: [],
      createdAt: at(4, '10:30'),
      closedBookingId: 'seed_wl_closed_lus',
    },
    // Арман · фитнес
    {
      id: 'wl_arm_1',
      businessId: BIZ.arman,
      locationId: LOC.arman,
      clientName: 'Геворг Асатрян',
      clientPhone: '+37491778899',
      serviceIds: ['sv_arm_personal'],
      staffIds: [ST.arman],
      wishes: [{ date: inDays(1), time: '08:00' }],
      tags: [],
      createdAt: at(0, '07:30'),
    },
    {
      id: 'wl_arm_2',
      businessId: BIZ.arman,
      locationId: LOC.arman,
      clientName: 'Лаура Погосян',
      clientPhone: '+37496778811',
      serviceIds: ['sv_arm_group_stretch'],
      staffIds: [],
      wishes: [
        {
          date: inDays(4),
          intervals: [
            { from: '18:00', to: '19:00' },
            { from: '20:00', to: '21:00' },
          ],
        },
      ],
      comment: 'Группа обычно вечером, гибко по времени',
      tags: [],
      createdAt: at(2, '13:20'),
    },
    // Просроченная — желание в прошлом
    {
      id: 'wl_arm_3',
      businessId: BIZ.arman,
      locationId: LOC.arman,
      clientName: 'Самвел Азарян',
      clientPhone: '+37497332211',
      serviceIds: ['sv_arm_online'],
      staffIds: [ST.arman],
      wishes: [{ date: agoDays(2), time: '20:00' }],
      tags: [],
      createdAt: at(5, '19:10'),
    },
    // Мариам · маникюр
    {
      id: 'wl_mar_1',
      businessId: BIZ.mariam,
      locationId: LOC.mariam,
      clientName: 'Ева Тадевосян',
      clientPhone: '+37491889900',
      serviceIds: ['sv_mar_gel'],
      staffIds: [ST.mariam],
      wishes: [{ date: inDays(3), time: '15:00' }],
      tags: [],
      createdAt: at(1, '09:15'),
    },
    {
      id: 'wl_mar_2',
      businessId: BIZ.mariam,
      locationId: LOC.mariam,
      clientName: 'Сирануш Шахбазян',
      clientPhone: '+37455889900',
      serviceIds: ['sv_mar_pedi'],
      staffIds: [],
      wishes: [],
      comment: 'Гибкий график, звонить с утра',
      tags: [],
      createdAt: at(2, '08:00'),
    },
    // Закрытая — уже записана
    {
      id: 'wl_mar_3',
      businessId: BIZ.mariam,
      locationId: LOC.mariam,
      clientName: 'Мелине Есаян',
      clientPhone: '+37494667799',
      serviceIds: ['sv_mar_visit'],
      staffIds: [ST.mariam],
      wishes: [{ date: inDays(2) }],
      tags: [],
      createdAt: at(3, '11:40'),
      closedBookingId: 'seed_wl_closed_mar',
    },
    // Давит · автомойка
    {
      id: 'wl_dav_1',
      businessId: BIZ.davit,
      locationId: LOC.davit,
      clientName: 'Артём Чилингарян',
      clientPhone: '+37491445566',
      serviceIds: ['sv_dav_full'],
      staffIds: [ST.davit],
      wishes: [{ date: inDays(1), time: '10:00' }],
      tags: [],
      createdAt: at(0, '08:50'),
    },
    {
      id: 'wl_dav_2',
      businessId: BIZ.davit,
      locationId: LOC.davit,
      clientName: 'Вардан Папоян',
      clientPhone: '+37499445577',
      serviceIds: ['sv_dav_polish'],
      staffIds: [],
      wishes: [
        {
          date: inDays(5),
          intervals: [
            { from: '09:00', to: '11:00' },
            { from: '14:00', to: '16:00' },
          ],
        },
      ],
      comment: 'Машина под гаражом, нужен выезд с утра или после обеда',
      tags: [],
      createdAt: at(1, '17:30'),
    },
    // Просроченная — желание в прошлом
    {
      id: 'wl_dav_3',
      businessId: BIZ.davit,
      locationId: LOC.davit,
      clientName: 'Мигран Алексанян',
      clientPhone: '+37496445588',
      serviceIds: ['sv_dav_express'],
      staffIds: [ST.davit],
      wishes: [{ date: agoDays(3), time: '09:00' }],
      tags: [],
      createdAt: at(6, '12:00'),
    },
    // Айк · барбершоп
    {
      id: 'wl_hayk_1',
      businessId: BIZ.hayk,
      locationId: LOC.hayk,
      clientName: 'Тарон Минасян',
      clientPhone: '+37491667700',
      serviceIds: ['sv_hayk_combo'],
      staffIds: [ST.hayk],
      wishes: [{ date: inDays(2), time: '18:30' }],
      tags: [],
      createdAt: at(0, '12:15'),
    },
    {
      id: 'wl_hayk_2',
      businessId: BIZ.hayk,
      locationId: LOC.hayk,
      clientName: 'Врам Григорян',
      clientPhone: '+37455667700',
      serviceIds: ['sv_hayk_beard'],
      staffIds: [],
      wishes: [],
      comment: 'Работает сменами — звонить и договариваться',
      tags: [],
      createdAt: at(1, '10:00'),
    },
    // Закрытая — уже записана
    {
      id: 'wl_hayk_3',
      businessId: BIZ.hayk,
      locationId: LOC.hayk,
      clientName: 'Андраник Варданян',
      clientPhone: '+37498556611',
      serviceIds: ['sv_hayk_cut'],
      staffIds: [ST.hayk],
      wishes: [{ date: inDays(1) }],
      tags: [],
      createdAt: at(2, '09:20'),
      closedBookingId: 'seed_wl_closed_hayk',
    },
    // Мелине · брови и ресницы
    {
      id: 'wl_mel_1',
      businessId: BIZ.meline,
      locationId: LOC.meline,
      clientName: 'Ануш Аветисян',
      clientPhone: '+37491778811',
      serviceIds: ['sv_mel_lami'],
      staffIds: [ST.meline],
      wishes: [{ date: inDays(4), time: '14:30' }],
      tags: [],
      createdAt: at(0, '11:05'),
    },
    {
      id: 'wl_mel_2',
      businessId: BIZ.meline,
      locationId: LOC.meline,
      clientName: 'Нелли Мкртчян',
      clientPhone: '+37497889911',
      serviceIds: ['sv_mel_combo'],
      staffIds: [],
      wishes: [{ date: inDays(6), intervals: [{ from: '10:00', to: '12:00' }] }],
      comment: 'В декрете, удобно только утром',
      tags: [],
      createdAt: at(1, '09:50'),
    },
    // Просроченная — желание в прошлом
    {
      id: 'wl_mel_3',
      businessId: BIZ.meline,
      locationId: LOC.meline,
      clientName: 'Кристине Ованнисян',
      clientPhone: '+37499778822',
      serviceIds: ['sv_mel_arch'],
      staffIds: [ST.meline],
      wishes: [{ date: agoDays(4), time: '16:00' }],
      tags: [],
      createdAt: at(8, '13:15'),
    },
    // Шушан · парикмахер с выездом
    {
      id: 'wl_shu_1',
      businessId: BIZ.shushan,
      locationId: LOC.shushan,
      clientName: 'Сона Карапетян',
      clientPhone: '+37491990011',
      serviceIds: ['sv_shu_color'],
      staffIds: [ST.shushan],
      wishes: [{ date: inDays(3), time: '12:00' }],
      tags: [],
      createdAt: at(0, '10:30'),
    },
    {
      id: 'wl_shu_2',
      businessId: BIZ.shushan,
      locationId: LOC.shushan,
      clientName: 'Гор Мелкумян',
      clientPhone: '+37496990022',
      serviceIds: ['sv_shu_bride'],
      staffIds: [ST.shushan],
      wishes: [{ date: inDays(20) }],
      comment: 'Свадьба в конце месяца, дата ещё может сдвинуться на день-два',
      tags: ['vip'],
      createdAt: at(2, '18:00'),
    },
    // Закрытая — уже записана
    {
      id: 'wl_shu_3',
      businessId: BIZ.shushan,
      locationId: LOC.shushan,
      clientName: 'Нарине Оганесян',
      clientPhone: '+37494990033',
      serviceIds: ['sv_shu_cut_w'],
      staffIds: [ST.shushan],
      wishes: [{ date: inDays(2) }],
      tags: [],
      createdAt: at(3, '09:10'),
      closedBookingId: 'seed_wl_closed_shu',
    },
  ];
}

function seedDescriptions(): Record<string, string> {
  return {
    res_nuri_pedi: 'Специальное кресло с ванночкой для педикюра',
    res_kaytsak_chair: 'Барберские кресла в основном зале',
    res_atam_room: 'Стоматологические кабинеты первого этажа',
    res_atam_xray: 'Панорамный рентген-аппарат',
    res_mnn_cabinet: 'Кабинет для косметологических процедур',
    res_msh_cabinet: 'Кабинет для косметологических процедур',
    res_vard_cabinet: 'Кабинет для косметологических процедур',
    res_arman_hall: 'Зал для групповых тренировок и растяжки',
  };
}

function seedEventTemplates(): EventTemplate[] {
  return [
    { id: 'evt_mon_wed_fri', businessId: BIZ.arman, name: 'Пн Ср Пт', freq: 'monWedFri' },
    { id: 'evt_weekly', businessId: BIZ.arman, name: 'Каждую неделю', freq: 'weekly', weekIntervalWeeks: 1 },
  ];
}

/**
 * Пакеты — надстройка над Service ядра (servicePackage); ни один демо-бизнес пока не заведён с пакетом в
 * seed услуг (не наш путь — src/mock/seed/services.ts), поэтому здесь пусто: первый пакет создаёт сам
 * тестировщик через «Создать» на /biz/resources/packages (пустое состояние объясняет, что это и зачем).
 */
function seedAssistantSettings(core: { businesses: { id: Id }[] }): Record<Id, AssistantSettings> {
  const out: Record<Id, AssistantSettings> = {};
  for (const b of core.businesses) out[b.id] = { compensationEnabled: b.id === BIZ.nuri, allowMultiple: true, shareRule: 'split' };
  return out;
}

/** F-16-049: одна общая настройка на бизнес (мы решили не заводить отдельно «журнал»/«онлайн», см. assumed в отчёте) */
function seedGroupSeatsSettings(core: { businesses: { id: Id }[] }): Record<Id, GroupSeatsSettings> {
  const out: Record<Id, GroupSeatsSettings> = {};
  for (const b of core.businesses) out[b.id] = { allowMultiSeat: true, maxSeats: 6 };
  return out;
}

/** F-16-016: как в пробном кабинете Altegio — включено по умолчанию у всех бизнесов */
function seedSplitByResource(core: { businesses: { id: Id }[] }): Record<Id, boolean> {
  const out: Record<Id, boolean> = {};
  for (const b of core.businesses) out[b.id] = true;
  return out;
}

/** F-16-043: демо-категории событий у бизнеса с групповыми занятиями (Арман — зал тренировок) */
function seedEventCategories(): EventCategory[] {
  return [
    { id: 'evc_trial', businessId: BIZ.arman, name: 'Пробное', colorIndex: 3 },
    { id: 'evc_intensive', businessId: BIZ.arman, name: 'Интенсив', colorIndex: 6 },
    { id: 'evc_kids', businessId: BIZ.arman, name: 'Для детей', colorIndex: 5 },
  ];
}

export const resourcesSlice = defineSlice<ResourcesState>({
  version: 7,
  seed: (core, now) => ({
    waitlist: seedWaitlist(core, now),
    descriptions: seedDescriptions(),
    eventTemplates: seedEventTemplates(),
    eventSeriesDefs: {},
    visitSchedules: [],
    eventJoin: {},
    packages: {},
    staffRights: {},
    assistantSettings: seedAssistantSettings(core),
    staffAssistantEligible: { [ST.nuriAni]: true, [ST.kaytsakDavid]: true },
    bookingAssistants: {},
    waitlistNotified: {},
    waitlistImported: [],
    waitlistLegacyDone: false,
    changelog: [],
    eventCategories: seedEventCategories(),
    eventExtras: {},
    groupSeatsSettings: seedGroupSeatsSettings(core),
    participantExtras: {},
    participantPayments: {},
    autoChargeStatus: {},
    splitByResource: seedSplitByResource(core),
    groupServicePayment: {},
  }),
});

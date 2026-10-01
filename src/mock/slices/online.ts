import type { Id } from '@/domain/core';
import type {
  ApiCredentials,
  BookingLink,
  BusinessOnlineRules,
  ClientFieldsConfig,
  GroupBookingRules,
  IntegrationConnection,
  MobileAppLinks,
  NetworkExtraField,
  OnlineBookingMeta,
  OnlinePackage,
  PromoBlock,
  Review,
  ServiceOnlineConfig,
  SlotInvite,
  StaffOnlineRules,
  StaffServiceOnlineFlags,
  WidgetEvent,
} from '@/domain/online';
import { DEFAULT_CLIENT_FIELDS, DEFAULT_CONSENT_TEXT, DEFAULT_STAFF_ONLINE_RULES, DEFAULT_WEBSITE_BUTTON } from '@/domain/online';
import { toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «online». Принадлежит разделу.
 * Храните здесь свои данные (ключ — id сущностей ядра). Меняете форму — поднимите version.
 */
export interface OnlineState {
  links: BookingLink[];
  /** Ключ — Booking.id */
  bookingMeta: Record<Id, OnlineBookingMeta>;
  /** Наши правила мастера (F-00-066…081, F-03-066/067) — ключ Staff.id. Нет записи — действуют дефолты */
  staffRules: Record<Id, StaffOnlineRules>;
  /** Наши правила локации (F-03-079, F-03-142) — ключ Business.id */
  businessRules: Record<Id, BusinessOnlineRules>;
  /** Настройки экрана данных клиента (F-03-071…075, F-03-104) — ключ Business.id */
  clientFields: Record<Id, ClientFieldsConfig>;
  /**
   * Дополнительные поля сети (F-03-074) — ключ Network.id. Кабинет сети пока не даёт их создавать
   * (см. qa/requests/online.md), поэтому здесь демо-набор: online только ЧИТАЕТ и показывает их
   * в виджете тем локациям, что выбраны в `NetworkExtraField.locationIds`.
   */
  networkExtraFields: Record<Id, NetworkExtraField[]>;
  /** Пары «мастер × услуга» с выключенной онлайн-записью (F-03-133) — нет ключа значит включено */
  staffServiceOnline: StaffServiceOnlineFlags;
  /** Онлайн-название/описание/картинка/ограничение услуги и пакета (F-03-129, F-03-130) — ключ Service.id */
  serviceConfigs: Record<Id, ServiceOnlineConfig>;
  /** Промоблоки в виджете (F-03-106) — ключ Business.id */
  promoBlocks: Record<Id, PromoBlock[]>;
  /** Звёздочки (F-03-105) — плоский список, читаем через getStarStats() */
  reviews: Review[];
  /** Журнал событий виджета для аналитики (F-03-121) — последние ~200 на ссылку */
  widgetEvents: WidgetEvent[];
  /** Групповая запись — мест сразу и «Записаться ещё» (F-03-076, F-03-102) — ключ Link.id */
  groupBookingRules: Record<Id, GroupBookingRules>;
  /** Пакеты услуг / комплексы (F-03-130) — стенд-ин, пока не построил раздел «Услуги»/resources */
  packages: OnlinePackage[];
  // «Встать в лист ожидания» из виджета (F-03-086) — с 01.10.2026 в одном листе бизнеса resources.waitlist (перенос старых — api/resources.ts)
  /** Внешние каналы записи (F-03-036…046) — демо-подключение, ключ Business.id */
  integrations: Record<Id, IntegrationConnection[]>;
  /** Демо-ключ своего API (F-03-036) — ключ Business.id */
  apiCredentials: Record<Id, ApiCredentials>;
  /** «Мобильные приложения» (F-03-048) — ключ Business.id */
  mobileApps: Record<Id, MobileAppLinks>;
  /** Приглашения «Кого позвать» на свободные окна (F-03-052) */
  slotInvites: SlotInvite[];
  /**
   * История смены статуса записи (F-00-068) — ключ Booking.id, добавляем запись при каждом переходе, который
   * делает раздел online (подтверждение/отклонение заявки, перенос и отмена клиентом). Переходы из журнала/CRM
   * (не online) сюда не попадают — своя история статуса в ядре Booking пока не заведена (qa/requests/online.md).
   */
  bookingStatusLog: Record<Id, BookingStatusLogEntry[]>;
}

export interface BookingStatusLogEntry {
  status: string;
  at: string;
  /** Кто изменил: 'client' — сам клиент онлайн, 'staff' — мастер/администратор */
  by: 'client' | 'staff';
}

export const onlineSlice = defineSlice<OnlineState>({
  version: 12,
  seed: (core, now) => {
    // Основная ссылка сразу у каждого бизнеса (F-03-004): «Форма компании», не сетевая, все услуги.
    // По ТЗ у ссылки, созданной в приложении бизнеса, формат по умолчанию «Меню» (1432); у первой
    // (пробной) ссылки — «Пошаговый» (05) — держим так же, остальные заводим «Меню».
    const links: BookingLink[] = core.businesses.map((b, i) => ({
      id: newId('lnk'),
      businessId: b.id,
      locationId: b.locationIds[0],
      name: 'Форма компании',
      kind: 'normal',
      bookingType: 'mixed',
      defaultLocale: 'ru',
      primary: true,
      formId: String(1400000 + i),
      createdAt: toISODateTime(now),
      bookingFlow: i === 0 ? 'stepwise' : 'menu',
      stepOrder: ['service', 'staff', 'time'],
      stepHidden: {},
      stepLabels: {},
      staffDisplayField: 'specialty',
      categoryDisplay: 'tags',
      theme: 'light',
      widgetButtonColor: '#3b32c9', // tokens-ok — демо-данные: цвет кнопки виджета
      websiteButton: { ...DEFAULT_WEBSITE_BUTTON },
    }));

    // Дефолтные правила у каждого мастера, у части — доплата/время на дорогу, если он берёт выезд (F-00-080).
    const staffRules: Record<Id, StaffOnlineRules> = {};
    core.staff.forEach((s) => {
      const takesVisits = s.workplaces.includes('visit');
      staffRules[s.id] = {
        staffId: s.id,
        ...DEFAULT_STAFF_ONLINE_RULES,
        ...(takesVisits ? { travelFee: 1500, travelTimeMin: 30 } : {}),
      };
    });

    const businessRules: Record<Id, BusinessOnlineRules> = {};
    const clientFields: Record<Id, ClientFieldsConfig> = {};
    core.businesses.forEach((b) => {
      businessRules[b.id] = { businessId: b.id, consentText: DEFAULT_CONSENT_TEXT };
      clientFields[b.id] = { businessId: b.id, ...DEFAULT_CLIENT_FIELDS };
    });

    // F-03-074: демо-поля сети — на каждую сеть с ≥1 локацией одно поле «в виджете» (видно на всех её
    // локациях) и одно выключенное (доказывает, что фильтр по showInWidget/locationIds действует).
    const networkExtraFields: Record<Id, NetworkExtraField[]> = {};
    core.networks.forEach((net) => {
      const locationIds = core.businesses.filter((b) => b.networkId === net.id).flatMap((b) => b.locationIds);
      if (locationIds.length === 0) return;
      networkExtraFields[net.id] = [
        {
          id: newId('nef'),
          label: 'Как узнали о нас',
          type: 'select',
          target: 'booking',
          required: false,
          options: ['Instagram', 'Друзья', 'Прохожу мимо', 'Другое'],
          order: 0,
          apiKey: 'lead_source',
          editableByUser: true,
          showInAdminUi: true,
          alwaysShowInEditWindow: false,
          requiredOnArrived: false,
          showInWidget: true,
          locationIds,
        },
        {
          id: newId('nef'),
          label: 'Внутренний код клиента (CRM сети)',
          type: 'text',
          target: 'client',
          required: false,
          order: 1,
          apiKey: 'crm_code',
          editableByUser: false,
          showInAdminUi: true,
          alwaysShowInEditWindow: true,
          requiredOnArrived: false,
          showInWidget: false,
          locationIds,
        },
      ];
    });

    // F-03-008: у первой сети — сетевая ссылка на всю сеть, показывает выбор филиала (F-03-083).
    const firstNetwork = core.networks[0];
    if (firstNetwork && firstNetwork.businessIds.length > 1) {
      const owner = core.businesses.find((b) => b.networkId === firstNetwork.id);
      if (owner) {
        links.push({
          id: newId('lnk'),
          businessId: owner.id,
          networkId: firstNetwork.id,
          name: 'Сетевая ссылка',
          kind: 'network',
          bookingType: 'individual',
          defaultLocale: 'ru',
          primary: false,
          formId: String(1400000 + core.businesses.length + 1),
          createdAt: toISODateTime(now),
          bookingFlow: 'menu',
          stepOrder: ['service', 'staff', 'time'],
          stepHidden: {},
          stepLabels: {},
          staffDisplayField: 'specialty',
          categoryDisplay: 'tags',
          theme: 'light',
          widgetButtonColor: '#3b32c9', // tokens-ok — демо-данные: цвет кнопки виджета
          websiteButton: { ...DEFAULT_WEBSITE_BUTTON },
        } as BookingLink);
      }
    }

    // F-03-106: демо-промоблоки на первый бизнес — один уже одобрен и виден в виджете, второй ждёт проверки
    // (не показывается, пока не approved), третий отклонён с причиной — все три состояния видны в кабинете.
    const promoBlocks: Record<Id, PromoBlock[]> = {};
    const firstBusiness = core.businesses[0];
    if (firstBusiness) {
      promoBlocks[firstBusiness.id] = [
        {
          id: newId('promo'),
          businessId: firstBusiness.id,
          title: '−15% на первую запись онлайн',
          description: 'Запишитесь через сайт или ссылку — скидка применится при оплате визита.',
          // Заголовок + описание + картинка → кликабельный блок открывает окно (F-03-106, «Логика»);
          // картинка — уже готовое фото интерьера бизнеса, ссылка — на его же публичную страницу.
          imageUrl: firstBusiness.photos[0],
          buttonText: 'Подробнее',
          buttonLink: `/b/${firstBusiness.slug}`,
          screens: ['menu', 'success'],
          status: 'approved',
          enabled: true,
          createdAt: toISODateTime(now),
        },
        {
          id: newId('promo'),
          businessId: firstBusiness.id,
          title: 'Подарок на день рождения',
          description: 'Расскажем в WhatsApp за неделю — не пропустите скидку.',
          screens: ['menu'],
          status: 'pending',
          enabled: true,
          createdAt: toISODateTime(now),
        },
        {
          id: newId('promo'),
          businessId: firstBusiness.id,
          title: 'Приведи подругу',
          buttonText: 'Подробнее',
          buttonLink: 'https://instagram.com',
          screens: ['menu'],
          status: 'rejected',
          reasonNote: 'Ссылка ведёт не на наш сайт и не на нашу страницу — уточните адрес',
          enabled: true,
          createdAt: toISODateTime(now),
        },
      ];
    }

    // F-03-105: демо-звёздочки — немного отметок на первого бизнеса и первого мастера, чтобы число не было 0.
    const reviews: Review[] = [];
    if (firstBusiness) {
      const firstStaff = core.staff.find((s) => s.businessId === firstBusiness.id);
      for (let i = 0; i < 6; i++) {
        reviews.push({
          id: newId('rv'),
          businessId: firstBusiness.id,
          target: 'business',
          targetId: firstBusiness.id,
          bookingId: 'seed',
          clientId: 'seed',
          createdAt: toISODateTime(now),
        });
      }
      if (firstStaff) {
        for (let i = 0; i < 4; i++) {
          reviews.push({
            id: newId('rv'),
            businessId: firstBusiness.id,
            target: 'staff',
            targetId: firstStaff.id,
            bookingId: 'seed',
            clientId: 'seed',
            createdAt: toISODateTime(now),
          });
        }
      }
    }

    // F-03-130: демо-пакет из 2 услуг первого бизнеса — доказывает, что выбор пакета в виджете и
    // ограничение «один пакет за раз» работают на реальных данных, а не на пустом списке.
    const packages: OnlinePackage[] = [];
    if (firstBusiness) {
      const bizServices = core.services.filter((sv) => sv.businessId === firstBusiness.id && sv.kind === 'individual');
      if (bizServices.length >= 2) {
        const picked = bizServices.slice(0, 2);
        packages.push({
          id: newId('pkg'),
          businessId: firstBusiness.id,
          name: { ru: `Комплекс: ${picked.map((s) => s.name.ru).join(' + ')}`, en: `Combo: ${picked.map((s) => s.name.en).join(' + ')}`, hy: picked.map((s) => s.name.ru).join(' + ') },
          serviceIds: picked.map((s) => s.id),
          mode: 'sequentialMulti',
          online: true,
          description: { ru: 'Две услуги одной записью — выберите мастера на каждую.', en: 'Two services in one booking — pick a specialist for each.', hy: '' },
          createdAt: toISODateTime(now),
        });
      }
    }

    // F-03-139: сидовые записи, пришедшие с источником 'link'/'widget' (заводит src/mock/seed/bookings.ts —
    // ~30% журнала), раньше не получали bookingMeta вовсе → вклад online в окно записи не мог показать
    // бейдж версии/формы (и бейдж устройства) на всей демо-истории, только на записях, созданных живьём
    // через createOnlineBooking. Достраиваем метаданные тем же способом, каким их заполняет живое создание.
    const bookingMeta: Record<Id, OnlineBookingMeta> = {};
    core.bookings.forEach((b) => {
      if (b.source !== 'link' && b.source !== 'widget') return;
      const bizLinks = links.filter((l) => l.businessId === b.businessId);
      const link = bizLinks.find((l) => l.primary) ?? bizLinks[0];
      bookingMeta[b.id] = {
        bookingId: b.id,
        linkId: link?.id,
        formId: link?.formId,
        widgetGen: 'new',
        device: b.id.length % 2 === 0 ? 'mobile' : 'desktop',
        accessHash: `${newId('h').slice(2)}${b.id.slice(-8)}`,
        phoneVerified: true,
      };
    });

    return {
      links,
      bookingMeta,
      staffRules,
      businessRules,
      clientFields,
      networkExtraFields,
      staffServiceOnline: {},
      serviceConfigs: {},
      promoBlocks,
      reviews,
      widgetEvents: [],
      groupBookingRules: {},
      packages,
      integrations: {},
      apiCredentials: {},
      mobileApps: {},
      slotInvites: [],
      bookingStatusLog: {},
    };
  },
});

import {
  defaultCardTypeNotify,
  defaultMembershipNotify,
  defaultOnlineSale,
  type AccountOperation,
  type DiscountNotifySettings,
  type AccountType,
  type AutoApplySettings,
  type CardType,
  type Certificate,
  type CertificateType,
  type ClientAccount,
  type LoyaltyCard,
  type LoyaltyTransaction,
  type Membership,
  type MembershipType,
  type OnlineOrder,
  type OnlineSalePaymentSettings,
  type OnlineSaleWidgetSettings,
  type Promotion,
  type ReferralSettings,
} from '@/domain/loyalty';
import type { CoreData, Id, ISODateTime } from '@/domain/core';
import { dayjs, toISODate, toISODateTime } from '@/lib/date';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «loyalty». Принадлежит разделу.
 * Меняете форму данных — поднимите version (срез пересоздастся из seed, остальное не тронется).
 */
export interface LoyaltyState {
  cardTypes: CardType[];
  cards: LoyaltyCard[];
  promotions: Promotion[];
  transactions: LoyaltyTransaction[];
  autoApply: Record<Id, AutoApplySettings>;
  referral: Record<Id, ReferralSettings>;
  certificateTypes: CertificateType[];
  certificates: Certificate[];
  membershipTypes: MembershipType[];
  memberships: Membership[];
  accountTypes: AccountType[];
  accounts: ClientAccount[];
  accountOperations: AccountOperation[];
  /** F-06-127: «Автоматическое списание с абонементов» — своя настройка услуги (по serviceId ядра) */
  serviceAutoCharge: Record<Id, { enabled: boolean; freeCancelHours: number }>;
  /**
   * F-06-128: «Онлайн-запись только по абонементу» — тумблер услуги (по serviceId ядра), как и
   * serviceAutoCharge выше. true — онлайн-записаться на услугу может только клиент с подходящим
   * действующим абонементом (проверка по телефону в online.md).
   */
  onlineRequireMembership: Record<Id, boolean>;
  /** F-06-062…067/074/123: записи, у которых уже проведена оплата лояльностью (идемпотентность и «Отменить оплату») */
  paidBookingIds: Id[];
  /** F-06-148/149: настройки онлайн-продаж по businessId (владелец сети — одна запись на сеть) */
  onlineSalePayment: Record<Id, OnlineSalePaymentSettings>;
  onlineSaleWidget: Record<Id, OnlineSaleWidgetSettings>;
  /** F-06-151/152: заказы витрины онлайн-продаж */
  onlineOrders: OnlineOrder[];
  /** F-06-015/016/017: уведомления «Новая скидка» / «Окончание действия скидки», по businessId */
  discountNotify: Record<Id, DiscountNotifySettings>;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const CARD_TYPE_NAMES = ['Постоянный гость', 'VIP', 'Первый визит'];
const CERT_TYPE_NAMES = [
  { name: 'Подарочный сертификат 15 000 ֏', nominal: 15000 },
  { name: 'Подарочный сертификат 30 000 ֏', nominal: 30000 },
];
const MEMBERSHIP_TYPE_NAMES = ['Маникюр × 5', 'Стрижка × 8', 'Безлимит на месяц'];
const ACCOUNT_TYPE_NAMES = ['Депозит'];

/** Демо-данные строим только для первых 3 бизнесов с клиентами — остальные (включая «пустой» демо-бизнес) остаются пустыми */
// demo-q4.md (major): показ на 5 демо-салонах требовал сертификатов у каждого — 3 давали пустые
// таблицы половине показа. Не «все бизнесы» специально — сид не бесконечный, а первых N достаточно.
const SEEDED_BUSINESSES = 6;

function seed(core: CoreData, now: Date): LoyaltyState {
  const cardTypes: CardType[] = [];
  const cards: LoyaltyCard[] = [];
  const promotions: Promotion[] = [];
  const transactions: LoyaltyTransaction[] = [];
  const autoApply: Record<Id, AutoApplySettings> = {};
  const referral: Record<Id, ReferralSettings> = {};
  const certificateTypes: CertificateType[] = [];
  const certificates: Certificate[] = [];
  const membershipTypes: MembershipType[] = [];
  const memberships: Membership[] = [];
  const accountTypes: AccountType[] = [];
  const accounts: ClientAccount[] = [];
  const accountOperations: AccountOperation[] = [];

  const today = dayjs(now);
  const businessesWithClients = core.businesses.filter((b) => core.clients.some((c) => c.businessId === b.id)).slice(0, SEEDED_BUSINESSES);

  businessesWithClients.forEach((business, bi) => {
    const businessClients = core.clients.filter((c) => c.businessId === business.id && !c.deletedAt);
    if (businessClients.length === 0) return;
    const locationIds = business.locationIds.length ? business.locationIds : [business.id];

    // Автоприменение и рефералка: настройки существуют для каждого посеянного бизнеса, выключены по умолчанию
    autoApply[business.id] = {
      businessId: business.id,
      enabled: bi === 0,
      online: { when: 'firstOnly', scope: 'any' },
      journal: { when: 'firstOnly' },
    };
    referral[business.id] = { businessId: business.id, active: true };

    // Типы карт (1-3 на бизнес)
    const typesForBusiness = CARD_TYPE_NAMES.slice(0, 1 + (bi % CARD_TYPE_NAMES.length));
    const businessCardTypeIds: Id[] = [];
    typesForBusiness.forEach((name, ti) => {
      const id = `lct_${business.id}_${ti}`;
      businessCardTypeIds.push(id);
      cardTypes.push({
        id,
        businessId: business.id,
        name,
        locationIds,
        sourceScope: 'activeLocations',
        autoIssueMode: ti === 0 ? 'anyLocation' : 'none',
        burnDays: ti === 1 ? 365 : undefined,
        serviceLimitMode: 'all',
        productLimitMode: 'all',
        paymentLimitFixed: 0,
        paymentLimitPercent: 50,
        cashbackVisibleInApp: true,
        notify: defaultCardTypeNotify(),
        createdAt: toISODateTime(today.subtract(60 - ti * 5, 'day')),
      });
      autoApply[business.id].online.promotionId = undefined; // выбрано ниже, после создания акций
    });

    // Акции — фиксированная скидка на первый тип карты, кэшбэк на второй (если есть)
    const promoDiscountId = `lp_${business.id}_disc`;
    promotions.push({
      id: promoDiscountId,
      businessId: business.id,
      name: 'Скидка постоянному гостю',
      kind: 'discountFixed',
      cardTypeIds: [businessCardTypeIds[0]],
      valueType: 'percent',
      value: 10,
      createdAt: toISODateTime(today.subtract(50, 'day')),
    });
    let promoCashbackId: string | undefined;
    if (businessCardTypeIds[1]) {
      promoCashbackId = `lp_${business.id}_cb`;
      promotions.push({
        id: promoCashbackId,
        businessId: business.id,
        name: 'Кэшбэк 5%',
        kind: 'cashbackAccumSum',
        cardTypeIds: [businessCardTypeIds[1]],
        valueType: 'percent',
        value: 5,
        thresholds: [
          { from: 0, value: 3 },
          { from: 50000, value: 5 },
          { from: 150000, value: 8 },
        ],
        sourceScope: 'activeLocations',
        sumBasis: 'afterDiscounts',
        applyFrequency: 1,
        applyLimit: 0,
        createdAt: toISODateTime(today.subtract(40, 'day')),
      });
    }
    autoApply[business.id].online.promotionId = promoDiscountId;
    autoApply[business.id].journal.promotionId = promoDiscountId;
    referral[business.id].inviteePromotionId = promoDiscountId;
    referral[business.id].referrerPromotionId = promoCashbackId ?? promoDiscountId;

    // Карты клиентам — примерно каждому второму клиенту
    businessClients.forEach((client, ci) => {
      const h = hashId(client.id);
      if (h % 2 !== 0) return;
      const typeId = businessCardTypeIds[h % businessCardTypeIds.length];
      const cardId = `lc_${client.id}`;
      const balance = (h % 12) * 500;
      cards.push({
        id: cardId,
        businessId: business.id,
        cardTypeId: typeId,
        clientId: client.id,
        number: `${1000 + bi * 1000 + ci}`,
        balance,
        maxPercentDiscount: 50,
        createdAt: toISODateTime(today.subtract(30 - (ci % 25), 'day')),
      });
      if (balance > 0) {
        transactions.push({
          id: `ltx_${cardId}_accr`,
          businessId: business.id,
          locationId: locationIds[h % locationIds.length],
          type: 'loyaltyAccrual',
          clientId: client.id,
          cardId,
          promotionId: typeId === businessCardTypeIds[1] ? promoCashbackId : undefined,
          amount: balance,
          createdAt: toISODateTime(today.subtract(20 - (ci % 15), 'day')),
        });
      }
      {
        // Гарантированно ненулевая скидка/списание — «Продано/Оплачено» (F-06-041) расходятся у каждой
        // выданной карты, а не только у доли, зависящей от хеша клиента.
        transactions.push({
          id: `ltx_${cardId}_disc`,
          businessId: business.id,
          locationId: locationIds[h % locationIds.length],
          type: 'promoDiscount',
          clientId: client.id,
          cardId,
          promotionId: promoDiscountId,
          amount: -(((h % 8) + 1) * 300),
          createdAt: toISODateTime(today.subtract(10 - (ci % 8), 'day')),
        });
      }
    });

    // Сертификаты
    const certTypeIds: Id[] = [];
    CERT_TYPE_NAMES.forEach((def, ti) => {
      const id = `lctt_${business.id}_${ti}`;
      certTypeIds.push(id);
      certificateTypes.push({
        id,
        businessId: business.id,
        name: def.name,
        nominal: def.nominal,
        chargeType: ti === 0 ? 'single' : 'multiple',
        category: ti === 0 ? 'gift' : 'none',
        applyServicesMode: 'all',
        applyProductsAllowed: true,
        expiryMode: 'fixedPeriod',
        expiryPeriodValue: 12,
        expiryPeriodUnit: 'month',
        allowNoCode: false,
        editLocationsMode: bi === 0 ? 'saleLocation' : 'none',
        onlineSale: defaultOnlineSale(),
        locationIds,
        createdAt: toISODateTime(today.subtract(70, 'day')),
      });
    });
    businessClients.slice(0, 6).forEach((client, ci) => {
      const h = hashId(client.id + 'cert');
      const typeIdx = h % certTypeIds.length;
      const def = CERT_TYPE_NAMES[typeIdx];
      const soldAt = today.subtract(45 - ci * 5, 'day');
      const expiresAt = soldAt.add(12, 'month');
      const status: Certificate['status'] = ci === 0 ? 'used' : expiresAt.isBefore(today) ? 'expired' : 'active';
      const balance = status === 'used' ? 0 : status === 'expired' ? def.nominal : def.nominal - (h % 3) * 3000;
      certificates.push({
        id: `lcert_${business.id}_${ci}`,
        businessId: business.id,
        certTypeId: certTypeIds[typeIdx],
        code: `CERT-${1000 + ci}`,
        nominal: def.nominal,
        balance: Math.max(0, balance),
        status,
        clientId: client.id,
        locationId: locationIds[h % locationIds.length],
        // Использован часто в другом филиале, чем куплен, — иначе колонка «Место использования» не отличалась бы от продажи
        usedLocationId: status === 'used' ? locationIds[(h + 1) % locationIds.length] : undefined,
        soldAt: toISODateTime(soldAt),
        expiresAt: toISODate(expiresAt),
        usedAt: status === 'used' ? toISODateTime(soldAt.add(5, 'day')) : undefined,
      });
      if (status !== 'active' || balance < def.nominal) {
        transactions.push({
          id: `ltx_cert_${business.id}_${ci}`,
          businessId: business.id,
          locationId: locationIds[h % locationIds.length],
          type: 'certificateCharge',
          clientId: client.id,
          certificateId: `lcert_${business.id}_${ci}`,
          amount: -(def.nominal - balance),
          createdAt: toISODateTime(soldAt.add(5, 'day')),
        });
      }
    });

    // Типы абонементов + проданные абонементы
    const businessServices = core.services.filter((s) => s.businessId === business.id);
    const membershipTypeIds: Id[] = [];
    MEMBERSHIP_TYPE_NAMES.forEach((name, ti) => {
      const id = `lmt_${business.id}_${ti}`;
      membershipTypeIds.push(id);
      const isShared = ti === MEMBERSHIP_TYPE_NAMES.length - 1;
      const svc = businessServices[ti % Math.max(1, businessServices.length)];
      const svc2 = businessServices[(ti + 1) % Math.max(1, businessServices.length)];
      membershipTypes.push({
        id,
        businessId: business.id,
        name,
        archived: ti === MEMBERSHIP_TYPE_NAMES.length - 1 && bi === 0,
        balanceMode: isShared ? 'shared' : 'separate',
        services:
          !isShared && svc
            ? svc2 && svc2.id !== svc.id
              ? [
                  { serviceId: svc.id, visits: 5 },
                  { serviceId: svc2.id, visits: 3 },
                ]
              : [{ serviceId: svc.id, visits: 5 }]
            : [],
        sharedVisits: isShared ? 8 : undefined,
        price: (isShared ? 8 : svc2 && svc2.id !== svc?.id ? 8 : 5) * 4000,
        durationValue: 1,
        durationUnit: 'month',
        activationMode: ti % 2 === 0 ? 'firstVisit' : 'onSale',
        autoActivateEnabled: ti % 2 === 0,
        autoActivateDays: ti % 2 === 0 ? 30 : undefined,
        editLocationsMode: bi === 0 ? 'saleLocation' : 'none',
        freezeAllowed: ti !== MEMBERSHIP_TYPE_NAMES.length - 1,
        allowNoCode: false,
        recalcPriceOnPay: ti === 0,
        renewalKind: 'standard',
        onlineSale: defaultOnlineSale(),
        locationIds,
        notify: defaultMembershipNotify(),
        createdAt: toISODateTime(today.subtract(80, 'day')),
      });
    });
    businessClients.slice(0, 5).forEach((client, ci) => {
      const h = hashId(client.id + 'memb');
      const typeIdx = h % membershipTypeIds.length;
      const totalVisits = 5 + (h % 3) * 3;
      const soldAt = today.subtract(35 - ci * 6, 'day');
      const expiresAt = soldAt.add(3, 'month');
      const balanceVisits = Math.max(0, totalVisits - (h % (totalVisits + 1)));
      let status: Membership['status'] = 'active';
      if (expiresAt.isBefore(today)) status = 'expired';
      else if (h % 7 === 0) status = 'frozen';
      else if (balanceVisits === totalVisits && h % 3 === 0) status = 'issued';
      const membershipId = `lm_${business.id}_${ci}`;
      memberships.push({
        id: membershipId,
        businessId: business.id,
        membershipTypeId: membershipTypeIds[typeIdx],
        clientId: client.id,
        status,
        balanceVisits,
        totalVisits,
        price: totalVisits * 4000,
        locationId: locationIds[h % locationIds.length],
        soldAt: toISODateTime(soldAt),
        expiresAt: toISODate(expiresAt),
        // F-06-113/F-06-122/F-06-123: код продажи — как у сертификата (у него CERT-100X); без кода
        // «чужой абонемент по коду» было структурно непроверяемо (findLoyaltyByCode ищет по нему).
        code: `MEMB-${1000 + ci}`,
        frozenDays: status === 'frozen' ? 7 : 0,
        freezeHistory:
          status === 'frozen'
            ? [
                {
                  at: toISODateTime(today.subtract(3, 'day')),
                  days: 7,
                  action: 'freeze',
                },
              ]
            : [],
      });
      if (balanceVisits < totalVisits) {
        transactions.push({
          id: `ltx_memb_${membershipId}`,
          businessId: business.id,
          locationId: locationIds[h % locationIds.length],
          type: 'membershipUse',
          clientId: client.id,
          membershipId,
          amount: -(totalVisits - balanceVisits) * 4000,
          createdAt: toISODateTime(today.subtract(5, 'day')),
        });
      }
    });

    // Типы счетов + счета + операции
    const accountTypeId = `lat_${business.id}_0`;
    accountTypes.push({
      id: accountTypeId,
      businessId: business.id,
      name: ACCOUNT_TYPE_NAMES[0],
      locationIds,
      allowNegative: bi === 0,
      negativeLimit: bi === 0 ? 20000 : 0,
      createdAt: toISODateTime(today.subtract(90, 'day')),
    });
    businessClients.slice(0, 4).forEach((client, ci) => {
      const h = hashId(client.id + 'acct');
      const accountId = `lacc_${business.id}_${ci}`;
      const topup = 10000 + (h % 5) * 5000;
      const charge = (h % 3) * 3000;
      accounts.push({
        id: accountId,
        businessId: business.id,
        accountTypeId,
        clientId: client.id,
        locationId: locationIds[h % locationIds.length],
        balance: topup - charge,
        createdAt: toISODateTime(today.subtract(25 - ci * 3, 'day')),
      });
      const openAt: ISODateTime = toISODateTime(today.subtract(25 - ci * 3, 'day'));
      accountOperations.push({
        id: `lao_${accountId}_open`,
        businessId: business.id,
        accountId,
        type: 'open',
        amount: 0,
        createdAt: openAt,
      });
      accountOperations.push({
        id: `lao_${accountId}_topup`,
        businessId: business.id,
        accountId,
        type: 'topup',
        amount: topup,
        authorStaffId: business.ownerStaffId,
        createdAt: toISODateTime(today.subtract(24 - ci * 3, 'day')),
      });
      if (charge > 0) {
        accountOperations.push({
          id: `lao_${accountId}_charge`,
          businessId: business.id,
          accountId,
          type: 'charge',
          amount: -charge,
          createdAt: toISODateTime(today.subtract(10 - ci, 'day')),
        });
        transactions.push({
          id: `ltx_acc_${accountId}`,
          businessId: business.id,
          locationId: locationIds[h % locationIds.length],
          type: 'accountCharge',
          clientId: client.id,
          accountId,
          amount: -charge,
          createdAt: toISODateTime(today.subtract(10 - ci, 'day')),
        });
      }
    });
  });

  return {
    cardTypes,
    cards,
    promotions,
    transactions,
    autoApply,
    referral,
    certificateTypes,
    certificates,
    membershipTypes,
    memberships,
    accountTypes,
    accounts,
    accountOperations,
    serviceAutoCharge: {},
    onlineRequireMembership: {},
    paidBookingIds: [],
    onlineSalePayment: {},
    onlineSaleWidget: {},
    onlineOrders: [],
    discountNotify: {},
  };
}

export const loyaltySlice = defineSlice<LoyaltyState>({
  // 8: F-06-123/F-06-124 — абонементам добавлен code (MEMB-100X), иначе «чужой абонемент по коду»
  // структурно непроверяем (findLoyaltyByCode всегда «не найдено»).
  // 9: добавлены типы транзакций возврата (certificateRefund/membershipRefund/accountRefund, F-06-101/132/144)
  // и discountNotify (F-06-015/016/017) — новые поля не требуют миграции старых данных.
  version: 9,
  seed,
});

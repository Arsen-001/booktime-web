import type {
  Account,
  AccountType,
  AdyenConnection,
  AdyenTransaction,
  BookingPaymentLine,
  CashShift,
  BookingPolicySnapshot,
  ClientAccountTopUp,
  Counterparty,
  FiscalSettings,
  FinanceDocument,
  FinanceItem,
  FinanceRights,
  ManualOnlineOrder,
  Operation,
  OperationHistoryEntry,
  OnlineLinkSettings,
  OnlinePaymentSettings,
  PaymentLink,
  PaymentMethodsSettings,
  PaymentNotificationsSettings,
  PaymentPolicy,
  PaymentPolicyServiceOverride,
  PolicyAccountEntry,
  PrepaymentSettings,
  ReceiptSettings,
  SettlementEntry,
  ServicePrepayment,
  StaffPrepayment,
} from '@/domain/finance';
import { DEFAULT_ORG_REQUISITES, DEFAULT_PAYMENT_NOTIFICATIONS, DEFAULT_POLICY_CARD_GUARANTEE, defaultPaymentPolicy, DEFAULT_RECEIPT_REQUISITES, FINANCE_RIGHTS_FULL, FINANCE_RIGHTS_MASTER, policyAmountValue, policyFreeCancellationDeadline, SYSTEM_ITEM_KEYS, SYSTEM_ITEM_GROUP, FINANCE_ITEM_GROUPS } from '@/domain/finance';
import type { CoreData, Id, ISODateTime, Money } from '@/domain/core';
import { EMPTY_BIZ_IDS } from '@/mock/seed/ids';
import { dayjs, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «finance». Принадлежит разделу.
 * Меняете форму данных — поднимите version (срез пересоздастся из seed, остальное не тронется).
 */
export interface FinanceState {
  accounts: Account[];
  items: FinanceItem[];
  itemBySystemKey: Record<Id, Record<string, Id>>;
  counterparties: Counterparty[];
  operations: Operation[];
  documents: FinanceDocument[];
  /** Настройки методов оплаты и комиссии (F-07-025…030, 032) — по одной записи на бизнес */
  paymentMethods: Record<Id, PaymentMethodsSettings>;
  /** Платежи визитов по строкам (F-07-181) */
  bookingPayments: BookingPaymentLine[];
  /** Комментарий к оплате визита (F-07-047), businessId+bookingId → текст */
  bookingPaymentNotes: Record<string, string>;
  /** Баланс счёта клиента (⭐ демо-минимум для F-07-061/062, полный учёт — b03) */
  clientAccountBalances: Record<Id, Record<Id, Money>>;
  clientAccountTopUps: ClientAccountTopUp[];
  /** Взаиморасчёты с сотрудниками (F-07-159…162) */
  settlementEntries: SettlementEntry[];
  /** Настройки нефискального чека (F-07-147/158), одна запись на бизнес */
  receiptSettings: Record<Id, ReceiptSettings>;
  /** ⭐ демо-права раздела «Финансы» по сотруднику (F-07-166…168) — полный редактор ролей появится в staff */
  financeRights: Record<Id, FinanceRights>;
  // ── b04: онлайн-платежи (F-07-076…157) ──
  onlinePaymentSettings: Record<Id, OnlinePaymentSettings>;
  onlineLinkSettings: Record<Id, OnlineLinkSettings>;
  paymentLinks: PaymentLink[];
  prepaymentSettings: Record<Id, PrepaymentSettings>;
  /** staffPrepayment[businessId][staffId] (F-07-095) */
  staffPrepayment: Record<Id, Record<Id, StaffPrepayment>>;
  /** servicePrepayment[businessId][serviceId] (F-07-094) — своя % / сумма у услуги, переопределяет общую */
  servicePrepayment: Record<Id, Record<Id, ServicePrepayment>>;
  fiscalSettings: Record<Id, FiscalSettings>;
  /** `${businessId}:${bookingId}` → категория «Полная/Частичная онлайн-оплата» (F-07-098) */
  bookingOnlineCategory: Record<string, 'onlineFull' | 'onlinePartial'>;
  // ── b05: политика оплаты (F-07-101…137) ──
  /** Одна запись на бизнес (F-07-101/110) */
  paymentPolicy: Record<Id, PaymentPolicy>;
  /** Переопределение политики у отдельной услуги (F-07-106): businessId → serviceId → override */
  policyServiceOverrides: Record<Id, Record<Id, PaymentPolicyServiceOverride>>;
  /** Журнал счёта «Payment Policy» (F-07-112) */
  policyAccountEntries: PolicyAccountEntry[];
  /** Снимок политики на записи (F-07-113/114): bookingId → snapshot */
  bookingPolicySnapshots: Record<Id, BookingPolicySnapshot>;
  /** Подключение Adyen (F-07-104/135) — одна запись на бизнес */
  adyenConnections: Record<Id, AdyenConnection>;
  adyenTransactions: AdyenTransaction[];
  /** Типы личных счетов клиентов (F-07-058, кабинет сети) */
  accountTypes: Record<Id, AccountType[]>;
  /** Заказы «Другим способом» из виджета онлайн-продаж (F-07-132), возврат — F-07-073 */
  manualOnlineOrders: Record<Id, ManualOnlineOrder[]>;
  /** Три типа уведомлений об оплате, завязанных на деньги (F-07-084/085/086) */
  paymentNotifications: Record<Id, PaymentNotificationsSettings>;
  /** Кассовые смены наличных касс (fin-review Ф1): открытие с разменом, закрытие с пересчётом, Z-отчёт */
  cashShifts: CashShift[];
}

// Набор статей по умолчанию 1:1 со спекой (F-07-007): 13 штук из ТЗ + «Удержанный депозит» (F-07-129, наше решение —
// движения депозита нужна своя статья, отдельная от штрафа, чтобы попадать в отчёт и P&L отдельной строкой).
const SYSTEM_ITEMS: { key: (typeof SYSTEM_ITEM_KEYS)[number]; ru: string; kind: 'income' | 'expense' }[] = [
  { key: 'materialsPurchase', ru: 'Закупка материалов', kind: 'expense' },
  { key: 'goodsPurchase', ru: 'Закупка товаров', kind: 'expense' },
  { key: 'staffPayroll', ru: 'Зарплата персонала', kind: 'expense' },
  { key: 'taxes', ru: 'Налоги и сборы', kind: 'expense' },
  { key: 'servicePayment', ru: 'Оказание услуг', kind: 'income' },
  { key: 'membershipSale', ru: 'Продажа абонементов', kind: 'income' },
  { key: 'goodsSale', ru: 'Продажа товаров', kind: 'income' },
  { key: 'otherIncome', ru: 'Прочие доходы', kind: 'income' },
  { key: 'otherExpense', ru: 'Прочие расходы', kind: 'expense' },
  { key: 'accountTopUp', ru: 'Пополнение счета', kind: 'income' },
  { key: 'acquiringFee', ru: 'Комиссия за эквайринг', kind: 'expense' },
  { key: 'certificateSale', ru: 'Продажа сертификатов', kind: 'income' },
  { key: 'penaltyCharge', ru: 'Списание штрафа', kind: 'income' },
  { key: 'depositRetained', ru: 'Удержанный депозит', kind: 'income' },
  { key: 'refund', ru: 'Возврат', kind: 'expense' },
];

const COUNTERPARTY_NAMES: { name: string; type: Counterparty['type'] }[] = [
  { name: 'ООО «Арт-Косметикс»', type: 'supplier' },
  { name: 'ИП Саргсян — расходники', type: 'supplier' },
  { name: 'Арендодатель «Норк Плаза»', type: 'company' },
  { name: 'Электросети Армении', type: 'company' },
  { name: 'ООО «Профи-Химия»', type: 'supplier' },
  { name: 'Рекламное агентство «Луйс»', type: 'company' },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function historyEntry(at: ISODateTime, by: string, action: OperationHistoryEntry['action']): OperationHistoryEntry {
  return { at, by, action };
}

/** Визиты за столько дней — подробно: своя операция на визит, документ, комиссия эквайринга */
const FULL_PAYMENT_DAYS = 3;
/** Операции «Оплата визитов за день» для более старых визитов — чтобы касса и отчёты прошлого месяца были полными */
const HISTORY_OPS_DAYS = 35;

function roundLine(n: number): number {
  return Math.round(n);
}

function seed(core: CoreData, now: Date): FinanceState {
  const accounts: Account[] = [];
  const items: FinanceItem[] = [];
  const itemBySystemKey: Record<Id, Record<string, Id>> = {};
  const counterparties: Counterparty[] = [];
  const operations: Operation[] = [];
  const documents: FinanceDocument[] = [];
  const paymentMethods: Record<Id, PaymentMethodsSettings> = {};
  const bookingPayments: BookingPaymentLine[] = [];
  const bookingPaymentNotes: Record<string, string> = {};
  const clientAccountBalances: Record<Id, Record<Id, Money>> = {};
  const clientAccountTopUps: ClientAccountTopUp[] = [];
  const settlementEntries: SettlementEntry[] = [];
  const receiptSettings: Record<Id, ReceiptSettings> = {};
  const financeRights: Record<Id, FinanceRights> = {};
  const onlinePaymentSettings: Record<Id, OnlinePaymentSettings> = {};
  const onlineLinkSettings: Record<Id, OnlineLinkSettings> = {};
  const paymentLinks: PaymentLink[] = [];
  const prepaymentSettings: Record<Id, PrepaymentSettings> = {};
  const staffPrepayment: Record<Id, Record<Id, StaffPrepayment>> = {};
  const servicePrepayment: Record<Id, Record<Id, ServicePrepayment>> = {};
  const fiscalSettings: Record<Id, FiscalSettings> = {};
  const bookingOnlineCategory: Record<string, 'onlineFull' | 'onlinePartial'> = {};
  const paymentPolicy: Record<Id, PaymentPolicy> = {};
  const policyServiceOverrides: Record<Id, Record<Id, PaymentPolicyServiceOverride>> = {};
  const policyAccountEntries: PolicyAccountEntry[] = [];
  const bookingPolicySnapshots: Record<Id, BookingPolicySnapshot> = {};
  const adyenConnections: Record<Id, AdyenConnection> = {};
  const adyenTransactions: AdyenTransaction[] = [];
  const accountTypes: Record<Id, AccountType[]> = {};
  const manualOnlineOrders: Record<Id, ManualOnlineOrder[]> = {};
  const paymentNotifications: Record<Id, PaymentNotificationsSettings> = {};
  const cashShifts: CashShift[] = [];

  const businesses = core.businesses.filter((b) => !EMPTY_BIZ_IDS.includes(b.id));

  for (const business of businesses) {
    const locations = core.locations.filter((l) => l.businessId === business.id);
    if (locations.length === 0) continue;

    // 13 статей на бизнес (F-07-007)
    const itemMap: Record<string, Id> = {};
    for (const def of SYSTEM_ITEMS) {
      const id = newId('fit');
      const group = SYSTEM_ITEM_GROUP[def.key];
      items.push({ id, businessId: business.id, name: def.ru, kind: def.kind, system: true, ...(group && FINANCE_ITEM_GROUPS[def.kind].includes(group) ? { group } : {}), createdAt: toISODateTime(dayjs(now).subtract(60, 'day')) });
      itemMap[def.key] = id;
    }
    itemBySystemKey[business.id] = itemMap;

    // Своя статья бизнеса поверх системных 13 (F-07-008) — показывает, что список расширяем
    const rentItemId = newId('fit');
    items.push({ id: rentItemId, businessId: business.id, name: 'Аренда', kind: 'expense', system: false, createdAt: toISODateTime(dayjs(now).subtract(50, 'day')) });

    // По 2 кассы на филиал (F-07-002)
    const accountsByLocation: Record<Id, Id[]> = {};
    locations.forEach((loc, idx) => {
      const cashId = newId('acc');
      const cardId = newId('acc');
      accounts.push({
        id: cashId,
        businessId: business.id,
        locationId: loc.id,
        name: 'Основная касса',
        kind: 'cash',
        openingBalance: 50000 + (hashId(loc.id) % 5) * 10000,
        order: idx * 2,
        createdAt: toISODateTime(dayjs(now).subtract(60, 'day')),
      });
      accounts.push({
        id: cardId,
        businessId: business.id,
        locationId: loc.id,
        name: 'Расчётный счёт',
        kind: 'card',
        // fin-review Ф2: остаток на начало, с которого аренда и закупки не уводят счёт в минус (было 0 → −68 339 ֏)
        openingBalance: 300000 + (hashId(loc.id) % 4) * 25000,
        order: idx * 2 + 1,
        createdAt: toISODateTime(dayjs(now).subtract(60, 'day')),
      });
      accountsByLocation[loc.id] = [cashId, cardId];
    });

    // Методы оплаты и комиссии (F-07-025…030, 032) — армянский кабинет: один карточный метод (F-07-028)
    const anyCashId = accountsByLocation[locations[0].id][0];
    const anyCardId = accountsByLocation[locations[0].id][1];
    const feePct = 1.5 + (hashId(business.id) % 3) * 0.5; // 1.5 / 2 / 2.5 %
    paymentMethods[business.id] = {
      businessId: business.id,
      cash: { accountId: anyCashId, cashierMode: 'default' },
      card: { perBrand: false, feePct, brands: [], accountId: anyCardId, settlementDays: 1 },
      installment: { enabled: hashId(business.id) % 2 === 0, plans: [{ id: newId('ipl'), months: 3, feePct: 3 }, { id: newId('ipl'), months: 6, feePct: 5 }] },
      custom: [{ id: newId('cpm'), name: 'Idram', feePct: 0, accountId: anyCardId, active: true }],
      feeShare: 'business',
      updatedAt: toISODateTime(dayjs(now).subtract(20, 'day')),
    };

    // Счета клиентов — демо-минимум (⭐ F-07-061/062, полный учёт b03): у первых двух клиентов бизнеса есть баланс
    const bizClients = core.clients.filter((c) => c.businessId === business.id);
    clientAccountBalances[business.id] = {};
    bizClients.slice(0, 2).forEach((client, idx) => {
      const amount = idx === 0 ? 15000 : 8000;
      clientAccountBalances[business.id][client.id] = amount;
      const at = toISODateTime(dayjs(now).subtract(15, 'day'));
      const topUpOpId = newId('op');
      operations.push({
        id: topUpOpId,
        businessId: business.id,
        locationId: locations[0].id,
        accountId: accountsByLocation[locations[0].id][0],
        itemId: itemMap.accountTopUp,
        kind: 'income',
        amount,
        date: at,
        method: 'cash',
        partyType: 'client',
        partyId: client.id,
        partyName: client.name,
        source: 'account',
        createdBy: business.ownerStaffId,
        createdAt: at,
        history: [historyEntry(at, business.ownerStaffId, 'created')],
      });
      clientAccountTopUps.push({ id: newId('cat'), businessId: business.id, clientId: client.id, amount, operationId: topUpOpId, createdAt: at, createdBy: business.ownerStaffId });
    });

    // Взаиморасчёты с сотрудниками (⭐ демо F-07-159…162) — ведомость + премия у первого мастера бизнеса
    const bizStaff = core.staff.filter((s) => s.businessId === business.id && s.status !== 'fired');
    const settlementStaff = bizStaff.find((s) => s.role === 'master') ?? bizStaff[0];
    if (settlementStaff) {
      const sheetAt = toISODateTime(dayjs(now).subtract(20, 'day'));
      // payroll-review: сумма — не выручка, а зарплата по схеме; досчитывается при первом чтении (seedRecalc)
      const sheetTotal = 0;
      settlementEntries.push({
        id: newId('set'),
        businessId: business.id,
        staffId: settlementStaff.id,
        kind: 'sheet',
        amount: sheetTotal,
        label: `Расчётная ведомость · ${dayjs(sheetAt).format('DD.MM')}–${dayjs(now).subtract(5, 'day').format('DD.MM')}`,
        periodFrom: sheetAt,
        periodTo: toISODateTime(dayjs(now).subtract(5, 'day')),
        status: 'accrued',
        seedRecalc: true,
        createdAt: sheetAt,
        createdBy: business.ownerStaffId,
      });
      const bonusAt = toISODateTime(dayjs(now).subtract(4, 'day'));
      settlementEntries.push({
        id: newId('set'),
        businessId: business.id,
        staffId: settlementStaff.id,
        kind: 'bonus',
        amount: 15000,
        label: 'Премия · За результат месяца',
        comment: 'Перевыполнение плана по визитам',
        createdAt: bonusAt,
        createdBy: business.ownerStaffId,
      });
    }

    // Настройки нефискального чека (F-07-147/158) — по умолчанию, НДС ОАЭ выключен
    receiptSettings[business.id] = {
      businessId: business.id,
      format: 'thermal58',
      clientName: true,
      clientPhone: true,
      clientEmail: false,
      requisites: { ...DEFAULT_RECEIPT_REQUISITES },
      // F-07-150 — реквизиты организации: демо-значения, чтобы чек и правки в настройках не были пустышкой
      orgType: 'legal',
      orgRequisites: {
        ...DEFAULT_ORG_REQUISITES,
        legalName: `ООО «${business.name}»`,
        legalAddress: 'Ереван, ул. Туманяна, 10',
        actualAddress: 'Ереван, ул. Туманяна, 10',
        inn: '02534819',
        kpp: '',
        bik: '',
        bankName: 'АКБА Банк',
        correspondentAccount: '',
        settlementAccount: '2470100000000000',
      },
      taxPerLine: false,
      extraInfoEnabled: false,
      extraInfoText: '',
      showComment: true,
      vatIncludedEnabled: false,
      vatIncludedPct: 20,
      updatedAt: toISODateTime(dayjs(now).subtract(60, 'day')),
    };

    // ⭐ Права раздела «Финансы» по сотруднику (F-07-166…168) — владелец полные, мастера свои взаиморасчёты
    for (const staffMember of bizStaff) {
      financeRights[staffMember.id] = staffMember.role === 'owner' ? { ...FINANCE_RIGHTS_FULL } : staffMember.role === 'master' ? { ...FINANCE_RIGHTS_MASTER } : { ...FINANCE_RIGHTS_FULL, allAccounts: false, allowedAccountIds: [accountsByLocation[locations[0].id][0]], viewDepth: 'm1', createDepth: 'm1', canManageKkm: false };
    }

    // Контрагенты (5-6 на бизнес)
    const cps = COUNTERPARTY_NAMES.slice(0, 5 + (hashId(business.id) % 2)).map((c) => ({
      id: newId('cpt'),
      businessId: business.id,
      type: c.type,
      name: c.name,
      phone: '+37400' + String(100000 + (hashId(business.id + c.name) % 900000)).slice(0, 6),
      createdAt: toISODateTime(dayjs(now).subtract(45, 'day')),
    }));
    counterparties.push(...cps);

    // Операции из визитов «Клиент пришёл» — короче окно и потолок на бизнес, чтобы не переполнять localStorage
    // (block, замер b02-m0/b03-m2/b04-m2 25.09: 5,86М символов на запись, QuotaExceededError). Список в интерфейсе
    // читает пагинацию (OperationsScreen), поэтому урезанный сид не теряет функциональность — только демо-объём.
    // Владелец, 01.10.2026: каждый прошедший визит «Пришёл» оплачен, кроме ~5 свежих примеров на бизнес (экран
    // «Не оплачены»). Подробно (своя операция, документ, комиссия) — визиты последних FULL_PAYMENT_DAYS дней; старше —
    // компактно ниже (historyPayments). Всё подробно не помещается: срез finance пишется в localStorage ОДНИМ ключом
    // вместе с ключом bookings при оплате, 31 день подробно давал 2,5 млн символов + 2,7 млн bookings — выше квоты
    // (~5 млн). Документы и комиссия — у первых 18. Полученная мастером предоплата (F-00-097) — своя операция, визит
    // добирает остаток.
    const nowIso = toISODateTime(dayjs(now));
    const fullFrom = dayjs(now).subtract(FULL_PAYMENT_DAYS, 'day').format('YYYY-MM-DD');
    const recentArrived = core.bookings
      .filter((b) => b.businessId === business.id && b.status === 'arrived' && !b.deletedAt && b.total > 0)
      .filter((b) => b.start < nowIso && dayjs(b.start).isAfter(dayjs(now).subtract(13, 'day')));
    // Неоплаченные примеры — из 2 недель (окно «Не оплачены»), а не только из подробных дней: иначе в тихий день все
    // визиты попадали в примеры и «Остатки по дням» показывали день без единого прихода
    const unpaidExamples = new Set(
      recentArrived
        .filter((b) => !b.prepayment?.paid)
        .sort((a, b) => hashId(a.id) - hashId(b.id))
        .slice(0, 5)
        .map((b) => b.id),
    );
    const arrivedBookings = recentArrived
      .filter((b) => b.start >= fullFrom && !unpaidExamples.has(b.id))
      .sort((a, b) => (a.start < b.start ? 1 : -1));
    let prepaymentAccountId: Id | undefined;

    arrivedBookings.forEach((booking, i) => {
      const accs = accountsByLocation[booking.locationId] ?? accounts.filter((a) => a.businessId === business.id).map((a) => a.id);
      const method: 'cash' | 'card' = hashId(booking.id) % 2 === 0 ? 'cash' : 'card';
      const accountId = method === 'cash' ? accs[0] : accs[1];
      const client = booking.clientId ? core.clients.find((c) => c.id === booking.clientId) : undefined;
      const at = toISODateTime(dayjs(booking.start).add(booking.durationMin, 'minute'));
      // Оплата визита ложится одним номером документа на все услуги визита (F-07-011)
      const docNumber = String(700000000 + (hashId(booking.id) % 99999999));
      const lineLabel = booking.services
        .map((line) => core.services.find((s) => s.id === line.serviceId)?.name.ru)
        .filter((n): n is string => Boolean(n))
        .join(', ');
      const prepaid = booking.prepayment?.paid && !booking.prepayment.refundedAt ? Math.min(booking.prepayment.amount, booking.total) : 0;
      if (prepaid > 0) {
        if (!prepaymentAccountId) {
          prepaymentAccountId = newId('acc');
          accounts.push({
            id: prepaymentAccountId,
            businessId: business.id,
            locationId: booking.locationId,
            name: 'Предоплата на реквизиты',
            kind: 'other',
            openingBalance: 0,
            order: accounts.filter((a) => a.businessId === business.id).length,
            systemGenerated: true,
            systemKey: 'prepayment',
            createdAt: toISODateTime(dayjs(now).subtract(60, 'day')),
          });
        }
        const pAt = toISODateTime(dayjs(booking.start).subtract(1, 'day').hour(12).minute(0));
        operations.push({
          id: newId('op'),
          businessId: business.id,
          locationId: booking.locationId,
          accountId: prepaymentAccountId,
          itemId: itemMap.servicePayment,
          kind: 'income',
          amount: prepaid,
          date: pAt,
          method: 'transfer',
          partyType: client ? 'client' : 'none',
          partyId: client?.id,
          partyName: client?.name,
          comment: 'Предоплата переводом на реквизиты мастера',
          source: 'booking',
          refId: booking.id,
          lineLabel: 'Предоплата',
          createdBy: booking.staffId,
          createdAt: pAt,
          history: [historyEntry(pAt, booking.staffId, 'created')],
        });
      }
      const payAmount = booking.total - prepaid;
      if (payAmount <= 0) return;
      const visitOpId = newId('op');
      operations.push({
        id: visitOpId,
        businessId: business.id,
        locationId: booking.locationId,
        accountId,
        itemId: itemMap.servicePayment,
        kind: 'income',
        amount: payAmount,
        date: at,
        method,
        partyType: client ? 'client' : 'none',
        partyId: client?.id,
        partyName: client?.name,
        source: 'booking',
        refId: booking.id,
        docNumber: i < 18 ? docNumber : undefined,
        lineLabel: lineLabel || undefined,
        createdBy: booking.staffId,
        createdAt: at,
        history: [historyEntry(at, booking.staffId, 'created')],
      });
      // Документ визита (F-07-024) — вид «Визит», содержимое «С услугами»
      if (i < 18) documents.push({
        id: newId('doc'),
        businessId: business.id,
        number: docNumber,
        date: at,
        type: 'visit',
        contentKind: 'services',
        amount: payAmount,
        refOperationId: visitOpId,
        refBookingId: booking.id,
        note: lineLabel || undefined,
        createdAt: at,
      });
      // Платёж по строкам визита (F-07-181) — одна оплата целиком, разнесена по строкам (сначала первые), без предоплаты
      let left = payAmount;
      booking.services.forEach((line, idx) => {
        const lineTotal = Math.min(roundLine(line.price * line.qty), left);
        if (lineTotal <= 0) return;
        left -= lineTotal;
        bookingPayments.push({
          id: newId('bpl'),
          businessId: business.id,
          bookingId: booking.id,
          serviceIndex: idx,
          kind: 'money',
          methodKey: method,
          methodLabel: method === 'cash' ? 'Наличные' : 'Банковская карта',
          accountId,
          amount: lineTotal,
          operationId: visitOpId,
          groupId: visitOpId,
          createdAt: at,
          createdBy: booking.staffId,
        });
      });
      // Комиссия эквайринга при оплате картой (F-07-033)
      if (method === 'card' && i < 18) {
        const feeAmount = Math.round(payAmount * 0.025);
        if (feeAmount > 0) {
          operations.push({
            id: newId('op'),
            businessId: business.id,
            locationId: booking.locationId,
            accountId,
            itemId: itemMap.acquiringFee,
            kind: 'expense',
            amount: feeAmount,
            date: at,
            method: 'other',
            partyType: 'none',
            source: 'booking',
            refId: booking.id,
            createdBy: 'system',
            createdAt: at,
            history: [historyEntry(at, 'system', 'created')],
          });
        }
      }
      void i;
    });

    // 03.10.2026: визиты старше FULL_PAYMENT_DAYS — тоже оплачены. Раньше их не было вовсе: «Расчёт за период» за
    // прошлый месяц показывал ~100 неоплаченных визитов и зарплату мастеров около нуля, а сводка журнала — десятки
    // «должников» (долг считается за год). Компактно, ~230 символов на визит: строки оплаты по услугам (по ним
    // считают зарплата, долги, «Не оплачены», окно оплаты; возврат берёт кассу из accountId строки) без своей
    // операции. Касса и отчёты за прошлый месяц получают одну операцию «Оплата визитов за день» на филиал и способ
    // (до HISTORY_OPS_DAYS дней назад; раньше — история до подключения кассы, деньги уже в начальном остатке).
    const historyOpsFrom = dayjs(now).subtract(HISTORY_OPS_DAYS, 'day').format('YYYY-MM-DD');
    const dayTotals = new Map<string, { locationId: Id; accountId: Id; method: 'cash' | 'card'; day: string; amount: number }>();
    for (const booking of core.bookings) {
      if (booking.businessId !== business.id || booking.status !== 'arrived' || booking.deletedAt || booking.total <= 0) continue;
      if (booking.start >= fullFrom || unpaidExamples.has(booking.id)) continue;
      const prepaid = booking.prepayment?.paid && !booking.prepayment.refundedAt ? Math.min(booking.prepayment.amount, booking.total) : 0;
      const payAmount = booking.total - prepaid;
      if (payAmount <= 0) continue;
      const accs = accountsByLocation[booking.locationId] ?? accounts.filter((a) => a.businessId === business.id).map((a) => a.id);
      const method: 'cash' | 'card' = hashId(booking.id) % 2 === 0 ? 'cash' : 'card';
      const accountId = method === 'cash' ? accs[0] : accs[1];
      const at = toISODateTime(dayjs(booking.start).add(booking.durationMin, 'minute'));
      let left = payAmount;
      let groupId: Id | undefined;
      booking.services.forEach((line, idx) => {
        const lineTotal = idx === booking.services.length - 1 ? left : Math.min(roundLine(line.price * line.qty), left);
        if (lineTotal <= 0) return;
        left -= lineTotal;
        const id = `bpl_h${booking.id.replace(/^bk_/, '')}_${idx}`;
        if (booking.services.length > 1) groupId ??= id;
        bookingPayments.push({
          id,
          businessId: business.id,
          bookingId: booking.id,
          serviceIndex: idx,
          kind: 'money',
          methodKey: method,
          methodLabel: method === 'cash' ? 'Наличные' : 'Банковская карта',
          accountId,
          amount: lineTotal,
          ...(groupId ? { groupId } : {}),
          createdAt: at,
          createdBy: booking.staffId,
        });
      });
      const day = booking.start.slice(0, 10);
      if (day < historyOpsFrom || !accountId) continue;
      const key = `${booking.locationId}|${day}|${method}`;
      const cur = dayTotals.get(key);
      if (cur) cur.amount += payAmount;
      else dayTotals.set(key, { locationId: booking.locationId, accountId, method, day, amount: payAmount });
    }
    for (const t of dayTotals.values()) {
      const at = `${t.day}T21:00`;
      operations.push({
        id: `op_h${hashId(`${t.locationId}|${t.day}|${t.method}`).toString(36)}`,
        businessId: business.id,
        locationId: t.locationId,
        accountId: t.accountId,
        itemId: itemMap.servicePayment,
        kind: 'income',
        amount: t.amount,
        date: at,
        method: t.method,
        partyType: 'none',
        source: 'booking',
        comment: 'Оплата визитов за день',
        createdBy: business.ownerStaffId,
        createdAt: at,
        history: [historyEntry(at, business.ownerStaffId, 'created')],
      });
    }

    // Немного ручных расходов и один перевод, один отменённый платёж
    const firstLoc = locations[0];
    const firstAccs = accountsByLocation[firstLoc.id];
    const rentAt = toISODateTime(dayjs(now).subtract(5, 'day').hour(11).minute(0));
    operations.push({
      id: newId('op'),
      businessId: business.id,
      locationId: firstLoc.id,
      accountId: firstAccs[1],
      itemId: rentItemId,
      kind: 'expense',
      amount: 180000,
      date: rentAt,
      method: 'transfer',
      partyType: 'counterparty',
      partyId: cps[2]?.id,
      partyName: cps[2]?.name,
      source: 'manual',
      createdBy: business.ownerStaffId,
      createdAt: rentAt,
      history: [historyEntry(rentAt, business.ownerStaffId, 'created')],
    });

    const purchaseAt = toISODateTime(dayjs(now).subtract(8, 'day').hour(15).minute(30));
    const purchaseOpId = newId('op');
    operations.push({
      id: purchaseOpId,
      businessId: business.id,
      locationId: firstLoc.id,
      accountId: firstAccs[0],
      itemId: itemMap.materialsPurchase,
      kind: 'expense',
      amount: 64000,
      date: purchaseAt,
      method: 'cash',
      partyType: 'counterparty',
      partyId: cps[0]?.id,
      partyName: cps[0]?.name,
      source: 'manual',
      comment: 'Закупка расходников на месяц',
      createdBy: business.ownerStaffId,
      createdAt: purchaseAt,
      history: [historyEntry(purchaseAt, business.ownerStaffId, 'created')],
    });
    documents.push({
      id: newId('doc'),
      businessId: business.id,
      number: `АКТ-${1000 + (hashId(business.id) % 900)}`,
      date: purchaseAt,
      type: 'supply',
      contentKind: 'consumables',
      amount: 64000,
      refOperationId: purchaseOpId,
      createdAt: purchaseAt,
    });

    if (firstAccs.length >= 2) {
      const transferAt = toISODateTime(dayjs(now).subtract(3, 'day').hour(19).minute(0));
      const groupId = newId('trg');
      operations.push({
        id: newId('op'),
        businessId: business.id,
        locationId: firstLoc.id,
        accountId: firstAccs[0],
        itemId: itemMap.otherExpense,
        kind: 'transfer_out',
        amount: 40000,
        date: transferAt,
        method: 'transfer',
        partyType: 'none',
        source: 'transfer',
        transferGroupId: groupId,
        comment: 'Инкассация в расчётный счёт',
        createdBy: business.ownerStaffId,
        createdAt: transferAt,
        history: [historyEntry(transferAt, business.ownerStaffId, 'created')],
      });
      operations.push({
        id: newId('op'),
        businessId: business.id,
        locationId: firstLoc.id,
        accountId: firstAccs[1],
        itemId: itemMap.otherExpense,
        kind: 'transfer_in',
        amount: 40000,
        date: transferAt,
        method: 'transfer',
        partyType: 'none',
        source: 'transfer',
        transferGroupId: groupId,
        comment: 'Инкассация в расчётный счёт',
        createdBy: business.ownerStaffId,
        createdAt: transferAt,
        history: [historyEntry(transferAt, business.ownerStaffId, 'created')],
      });
    }

    // Одна отменённая операция — для фильтра «Отменённые» (F-07-015)
    if (arrivedBookings[0]) {
      const b = arrivedBookings[0];
      const cancelAt = toISODateTime(dayjs(now).subtract(12, 'day').hour(10).minute(0));
      operations.push({
        id: newId('op'),
        businessId: business.id,
        locationId: b.locationId,
        accountId: firstAccs[0],
        itemId: itemMap.penaltyCharge,
        kind: 'income',
        amount: 5000,
        date: cancelAt,
        method: 'cash',
        partyType: 'client',
        partyId: b.clientId,
        partyName: core.clients.find((c) => c.id === b.clientId)?.name,
        comment: 'Ошибочно проведён дважды',
        source: 'manual',
        cancelled: true,
        cancelledAt: toISODateTime(dayjs(now).subtract(11, 'day')),
        createdBy: business.ownerStaffId,
        createdAt: cancelAt,
        history: [historyEntry(cancelAt, business.ownerStaffId, 'created'), historyEntry(toISODateTime(dayjs(now).subtract(11, 'day')), business.ownerStaffId, 'cancelled')],
      });
    }

    // Продажи товара/абонемента/сертификата — чтобы «Возврат» (F-07-068/069/071/072) было на чём демонстрировать
    const secondArrived = arrivedBookings[1];
    const saleClient = secondArrived ? core.clients.find((c) => c.id === secondArrived.clientId) : core.clients[0];
    if (itemMap.goodsSale && secondArrived) {
      // F-07-068 — товар продан В ВИЗИТЕ (refId = визит), оплата услуги отдельной операцией (servicePaymentId) не трогается
      const at = toISODateTime(dayjs(now).subtract(4, 'day').hour(16).minute(10));
      operations.push({
        // Постоянный id: складской документ «Продажа товара» (src/mock/slices/stock.ts) ссылается на него financeOperationId
        id: `op_goods_${business.id}_shampoo`,
        businessId: business.id,
        locationId: secondArrived.locationId,
        accountId: firstAccs[0],
        itemId: itemMap.goodsSale,
        kind: 'income',
        amount: 6500,
        date: at,
        method: 'cash',
        partyType: 'client',
        partyId: secondArrived.clientId,
        partyName: saleClient?.name,
        comment: 'Шампунь для домашнего ухода',
        source: 'booking',
        refId: secondArrived.id,
        createdBy: business.ownerStaffId,
        createdAt: at,
        history: [historyEntry(at, business.ownerStaffId, 'created')],
      });
    }
    if (itemMap.goodsSale) {
      // F-07-069 — товар продан ВНЕ визита (без refId)
      const at = toISODateTime(dayjs(now).subtract(2, 'day').hour(12).minute(45));
      operations.push({
        id: `op_goods_${business.id}_cream`,
        businessId: business.id,
        locationId: firstLoc.id,
        accountId: firstAccs[1] ?? firstAccs[0], // Ф19: оплата картой — на безналичный счёт, не в наличный ящик
        itemId: itemMap.goodsSale,
        kind: 'income',
        amount: 9800,
        date: at,
        method: 'card',
        partyType: 'client',
        partyId: saleClient?.id,
        partyName: saleClient?.name,
        comment: 'Крем без записи на услугу',
        source: 'sale',
        createdBy: business.ownerStaffId,
        createdAt: at,
        history: [historyEntry(at, business.ownerStaffId, 'created')],
      });
    }
    if (itemMap.membershipSale) {
      // F-07-071 — продажа абонемента (⭐ остаток посещений — домен loyalty, здесь только денежная часть)
      const at = toISODateTime(dayjs(now).subtract(20, 'day').hour(10).minute(0));
      operations.push({
        id: newId('op'),
        businessId: business.id,
        locationId: firstLoc.id,
        accountId: firstAccs[1] ?? firstAccs[0], // Ф19: оплата картой — на безналичный счёт, не в наличный ящик
        itemId: itemMap.membershipSale,
        kind: 'income',
        amount: 45000,
        date: at,
        method: 'card',
        partyType: 'client',
        partyId: saleClient?.id,
        partyName: saleClient?.name,
        comment: 'Абонемент на 5 посещений',
        source: 'sale',
        createdBy: business.ownerStaffId,
        createdAt: at,
        history: [historyEntry(at, business.ownerStaffId, 'created')],
      });
    }
    if (itemMap.certificateSale) {
      // F-07-072 — продажа сертификата (⭐ баланс сертификата — домен loyalty, здесь только денежная часть)
      const at = toISODateTime(dayjs(now).subtract(6, 'day').hour(17).minute(30));
      operations.push({
        id: newId('op'),
        businessId: business.id,
        locationId: firstLoc.id,
        accountId: firstAccs[0],
        itemId: itemMap.certificateSale,
        kind: 'income',
        amount: 20000,
        date: at,
        method: 'cash',
        partyType: 'client',
        partyId: saleClient?.id,
        partyName: saleClient?.name,
        comment: 'Подарочный сертификат 20 000 ֏',
        source: 'sale',
        createdBy: business.ownerStaffId,
        createdAt: at,
        history: [historyEntry(at, business.ownerStaffId, 'created')],
      });
    }

    // ── b04: онлайн-платежи (F-07-076…157) ──

    // F-07-183 — системная касса, куда садятся онлайн-деньги (ссылки, будущие онлайн-продажи)
    const onlineAccountId = newId('acc');
    accounts.push({
      id: onlineAccountId,
      businessId: business.id,
      locationId: firstLoc.id,
      name: 'Онлайн-платежи',
      kind: 'other',
      openingBalance: 0,
      order: (accounts.filter((a) => a.businessId === business.id).length),
      createdAt: toISODateTime(dayjs(now).subtract(60, 'day')),
      systemGenerated: true,
    });

    onlinePaymentSettings[business.id] = {
      businessId: business.id,
      // bizIndex 0 держит активный режим «Депозит» (F-07-101) — без подключённой платёжной системы политику
      // нельзя ни включить, ни сохранить, поэтому демо-провайдер на способ предоплаты подключён и у него
      providerByWay: { link: null, widgetPrepayment: businesses.indexOf(business) === 0 ? 'arca' : null, onlineSales: null },
      updatedAt: toISODateTime(dayjs(now).subtract(20, 'day')),
    };

    onlineLinkSettings[business.id] = {
      businessId: business.id,
      requisitesText: `Карта на имя ${business.name} · перевод по номеру телефона мастера`,
      waitMinutes: 30,
      staticQrEnabled: true,
      updatedAt: toISODateTime(dayjs(now).subtract(20, 'day')),
    };

    prepaymentSettings[business.id] = {
      businessId: business.id,
      mode: 'optional',
      amountType: 'percent',
      amountValue: 30,
      waitMinutes: 15,
      requiredServiceIds: [],
      requiredAllServices: false,
      requiredStaffIds: [],
      updatedAt: toISODateTime(dayjs(now).subtract(20, 'day')),
    };

    // Мастер, который сам включил обязательную 100% предоплату (⭐ F-00-066/F-00-095)
    const firstStaff = core.staff.find((s) => s.businessId === business.id && s.role !== 'owner');
    if (firstStaff) {
      staffPrepayment[business.id] = {
        [firstStaff.id]: { staffId: firstStaff.id, enabled: true, amountType: 'percent', amountValue: 100 },
      };
    } else {
      staffPrepayment[business.id] = {};
    }

    // F-07-094 — демо: первая услуга бизнеса со своей предоплатой (50%, отличается от общей 30%)
    const firstService = core.services.find((s) => s.businessId === business.id);
    servicePrepayment[business.id] = firstService
      ? { [firstService.id]: { serviceId: firstService.id, amountType: 'percent', amountValue: 50 } }
      : {};

    fiscalSettings[business.id] = {
      businessId: business.id,
      ukraine: { proRroConnected: false, cashierName: '', cardReceiptMode: 'single' },
      hungary: { billingoConnected: false },
      brazil: { notaFiscalConnected: false },
      updatedAt: toISODateTime(dayjs(now).subtract(20, 'day')),
    };

    // Демо-ссылки на оплату — одна ждёт оплату, одна оплачена, одна истекла (F-07-080)
    const upcoming = core.bookings
      .filter((b) => b.businessId === business.id && !b.deletedAt && b.total > 0 && dayjs(b.start).isAfter(now))
      .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
    const linkTargets = upcoming.slice(0, 2);
    if (linkTargets[0]) {
      const b = linkTargets[0];
      const createdAt = toISODateTime(dayjs(now).subtract(3, 'hour'));
      paymentLinks.push({
        id: newId('plk'),
        businessId: business.id,
        targetKind: 'booking',
        bookingId: b.id,
        amount: Math.round(b.total * 0.3),
        remainingBefore: b.total,
        status: 'pending',
        createdAt,
        createdBy: business.ownerStaffId,
        expiresAt: toISODateTime(dayjs(createdAt).add(onlineLinkSettings[business.id].waitMinutes, 'minute').isAfter(now) ? dayjs(now).add(20, 'minute') : dayjs(now).subtract(1, 'minute')),
        requisitesText: onlineLinkSettings[business.id].requisitesText,
      });
    }
    if (linkTargets[1]) {
      const b = linkTargets[1];
      const createdAt = toISODateTime(dayjs(now).subtract(2, 'day'));
      paymentLinks.push({
        id: newId('plk'),
        businessId: business.id,
        targetKind: 'booking',
        bookingId: b.id,
        amount: Math.round(b.total * 0.3),
        remainingBefore: b.total,
        status: 'paid',
        createdAt,
        createdBy: business.ownerStaffId,
        expiresAt: toISODateTime(dayjs(createdAt).add(30, 'minute')),
        paidAt: toISODateTime(dayjs(createdAt).add(12, 'minute')),
        requisitesText: onlineLinkSettings[business.id].requisitesText,
      });
      bookingOnlineCategory[`${business.id}:${b.id}`] = 'onlinePartial';
    }
    // Продажа сертификата по ссылке вне визита, ссылка истекла — никто не оплатил (F-07-082)
    const expiredCreatedAt = toISODateTime(dayjs(now).subtract(5, 'day'));
    paymentLinks.push({
      id: newId('plk'),
      businessId: business.id,
      targetKind: 'sale',
      saleLabel: 'Подарочный сертификат 15 000 ֏',
      amount: 15000,
      remainingBefore: 15000,
      status: 'expired',
      createdAt: expiredCreatedAt,
      createdBy: business.ownerStaffId,
      expiresAt: toISODateTime(dayjs(expiredCreatedAt).add(30, 'minute')),
      requisitesText: onlineLinkSettings[business.id].requisitesText,
    });

    // ── b05: политика оплаты (F-07-101…130), Adyen (F-07-104/135…137) ──
    // Демо-распределение по бизнесам: первый — «Депозит» без Adyen (обычная армянская схема), второй —
    // «Гарантия картой» с подключённым Adyen (чтобы Adyen Dashboard и режим карты было видно живьём);
    // остальные — «No payment policy» (по умолчанию, F-07-101).
    const bizIndex = businesses.indexOf(business);
    const policyUpdatedAt = toISODateTime(dayjs(now).subtract(10, 'day'));
    const policy = defaultPaymentPolicy(business.id, policyUpdatedAt);
    const adyen: AdyenConnection = { businessId: business.id, status: 'notConnected' };

    if (bizIndex === 0) {
      policy.mode = 'deposit';
      policy.deposit = { paymentDeadlineMin: 15, amount: { mode: 'percent', value: 20 }, creditDepositOnCancel: false, freeCancellationWindowHours: 24, allowReceptionistNotCharge: true };
      policy.activatedAt = policyUpdatedAt;
      policy.lastSnapshot = { mode: 'deposit', depositAmountLabel: '20%', freeCancellationWindowHours: 24, deadlineMin: 15, clientScope: 'all', savedAt: policyUpdatedAt };
    } else if (bizIndex === 1) {
      policy.mode = 'cardGuarantee';
      policy.cardGuarantee = { ...DEFAULT_POLICY_CARD_GUARANTEE };
      policy.activatedAt = policyUpdatedAt;
      policy.lastSnapshot = { mode: 'cardGuarantee', lateCancellationFeeLabel: '50%', noShowFeeLabel: '100%', freeCancellationWindowHours: 24, deadlineMin: 15, clientScope: 'all', savedAt: policyUpdatedAt };
      adyen.status = 'connected';
      adyen.legalEntityName = business.name;
      adyen.country = 'AM';
      adyen.shopperStatement = 'BOOKING*' + business.name.slice(0, 10).toUpperCase();
      adyen.connectedAt = toISODateTime(dayjs(now).subtract(30, 'day'));
    }
    paymentPolicy[business.id] = policy;
    adyenConnections[business.id] = adyen;
    policyServiceOverrides[business.id] = {};

    // ── Уведомления об оплате (F-07-084/085/086) — армянский кабинет: ссылка на оплату включена, Email нельзя ──
    paymentNotifications[business.id] = { businessId: business.id, ...DEFAULT_PAYMENT_NOTIFICATIONS, updatedAt: policyUpdatedAt };

    // ── Типы счетов клиентов (F-07-058, кабинет сети) — первый бизнес с примером, остальные пустые ──
    accountTypes[business.id] = [];
    if (bizIndex === 0) {
      accountTypes[business.id].push({
        id: newId('atp'),
        businessId: business.id,
        name: 'Депозит на визиты',
        locationIds: locations.map((l) => l.id),
        allowNegative: false,
        negativeLimit: 0,
        createdAt: policyUpdatedAt,
        updatedAt: policyUpdatedAt,
      });
    }

    // ── Онлайн-продажи «Другим способом» (F-07-132) — один ожидает подтверждения, один уже оплачен ──
    manualOnlineOrders[business.id] = [];
    if (bizIndex === 0 || bizIndex === 1) {
      const pendingAt = toISODateTime(dayjs(now).subtract(2, 'hour'));
      manualOnlineOrders[business.id].push({
        id: newId('mor'),
        businessId: business.id,
        locationId: locations[0].id,
        kind: 'certificate',
        typeName: 'Подарочный сертификат 10 000 ֏',
        amount: 10000,
        clientName: 'Заказ из виджета продаж',
        clientPhone: '+374 77 123456',
        status: 'pendingPayment',
        createdAt: pendingAt,
      });
      const paidAt = toISODateTime(dayjs(now).subtract(3, 'day'));
      manualOnlineOrders[business.id].push({
        id: newId('mor'),
        businessId: business.id,
        locationId: locations[0].id,
        kind: 'membership',
        typeName: 'Абонемент на 5 визитов',
        amount: 40000,
        clientName: 'Онлайн-заказ',
        clientEmail: 'client@example.com',
        status: 'paid',
        createdAt: paidAt,
        decidedAt: toISODateTime(dayjs(paidAt).add(1, 'hour')),
        decidedBy: business.ownerStaffId,
        code: '4821',
      });
    }

    if (adyen.status === 'connected') {
      const methods = ['Visa •••• 4242', 'Mastercard •••• 5588', 'Apple Pay'];
      for (let i = 0; i < 6; i++) {
        const gross = 8000 + (i % 3) * 4500;
        const netAmount = roundLine(gross * 0.985);
        adyenTransactions.push({
          id: newId('ady'),
          businessId: business.id,
          date: toISODateTime(dayjs(now).subtract(i * 4, 'day')),
          method: methods[i % methods.length],
          type: i === 4 ? 'refund' : 'payment',
          netAmount: i === 4 ? -netAmount : netAmount,
          grossAmount: i === 4 ? -gross : gross,
          pspReference: String(881000000000 + hashId(business.id + String(i)) % 999999999),
          refunded: i === 1,
        });
      }
    }

    // Счёт «Payment Policy» и снимки записей — только у бизнеса с активной политикой (F-07-112/113/114)
    if (policy.mode !== 'none' && bizClients.length > 0) {
      const client0 = bizClients[0];
      const client1 = bizClients[1] ?? bizClients[0];

      if (policy.mode === 'deposit') {
        // Клиент 0: депозит зарезервирован и удержан (Reserved → Held until decision) под будущую запись
        const upcomingForPolicy = upcoming[0];
        const depositAmount = upcomingForPolicy ? Math.max(2000, roundLine(upcomingForPolicy.total * 0.2)) : 2000;
        if (upcomingForPolicy) {
          const reservedAt = toISODateTime(dayjs(upcomingForPolicy.start).subtract(1, 'day'));
          policyAccountEntries.push({
            id: newId('pae'),
            businessId: business.id,
            clientId: client0.id,
            kind: 'topUp',
            amount: depositAmount,
            balanceAfter: depositAmount,
            inHoldAfter: depositAmount,
            source: 'widget',
            bookingId: upcomingForPolicy.id,
            createdAt: reservedAt,
            createdBy: 'system',
          });
          bookingPolicySnapshots[upcomingForPolicy.id] = {
            bookingId: upcomingForPolicy.id,
            businessId: business.id,
            clientId: client0.id,
            mode: 'deposit',
            depositAmount,
            freeCancellationWindowHours: policy.deposit.freeCancellationWindowHours,
            freeCancellationDeadline: policyFreeCancellationDeadline(upcomingForPolicy.start, policy.deposit.freeCancellationWindowHours),
            allowReceptionistNotCharge: policy.deposit.allowReceptionistNotCharge,
            status: 'clientAccepted',
            createdAt: reservedAt,
          };
        }
        // Клиент 1: прошлый визит — депозит зачтён в оплату при закрытии (Confirmed at checkout)
        const pastArrived = core.bookings.find((b) => b.businessId === business.id && b.clientId === client1.id && b.status === 'arrived' && b.total > 0);
        if (pastArrived) {
          const confirmedAt = toISODateTime(dayjs(pastArrived.start).add(pastArrived.durationMin, 'minute'));
          const depAmount = Math.min(pastArrived.total, 2500);
          policyAccountEntries.push(
            { id: newId('pae'), businessId: business.id, clientId: client1.id, kind: 'topUp', amount: depAmount, balanceAfter: depAmount, inHoldAfter: depAmount, source: 'widget', bookingId: pastArrived.id, createdAt: toISODateTime(dayjs(confirmedAt).subtract(3, 'day')), createdBy: 'system' },
            { id: newId('pae'), businessId: business.id, clientId: client1.id, kind: 'holdConfirm', amount: -depAmount, balanceAfter: 0, inHoldAfter: 0, source: 'checkout', bookingId: pastArrived.id, createdAt: confirmedAt, createdBy: pastArrived.staffId },
          );
        }
        // Клиент 1: неудачное списание штрафа при пустом счёте — уходит в минус без ограничения (F-07-122)
        policyAccountEntries.push(
          { id: newId('pae'), businessId: business.id, clientId: client1.id, kind: 'topUp', amount: 1000, balanceAfter: 1000, inHoldAfter: 1000, source: 'widget', createdAt: toISODateTime(dayjs(now).subtract(6, 'day')), createdBy: 'system' },
          { id: newId('pae'), businessId: business.id, clientId: client1.id, kind: 'feeCharge', amount: -3500, balanceAfter: -2500, inHoldAfter: 0, source: 'noShow', createdAt: toISODateTime(dayjs(now).subtract(5, 'day')), createdBy: 'system' },
        );
        const feeOpAt = toISODateTime(dayjs(now).subtract(5, 'day'));
        operations.push({
          id: newId('op'),
          businessId: business.id,
          locationId: locations[0].id,
          // fin-review Ф15: штраф списан со счёта политики (деньги внесены онлайн) — в системную кассу онлайн-денег,
          // а не приходом в наличный ящик «Основной кассы»
          accountId: onlineAccountId,
          itemId: itemMap.penaltyCharge,
          kind: 'income',
          amount: 3500,
          date: feeOpAt,
          method: 'other',
          partyType: 'client',
          partyId: client1.id,
          partyName: client1.name,
          source: 'account',
          createdBy: 'system',
          createdAt: feeOpAt,
          history: [historyEntry(feeOpAt, 'system', 'created')],
        });
      } else if (policy.mode === 'cardGuarantee') {
        const upcomingForPolicy = upcoming[0];
        if (upcomingForPolicy) {
          const acceptedAt = toISODateTime(dayjs(upcomingForPolicy.start).subtract(2, 'day'));
          bookingPolicySnapshots[upcomingForPolicy.id] = {
            bookingId: upcomingForPolicy.id,
            businessId: business.id,
            clientId: client0.id,
            mode: 'cardGuarantee',
            lateCancellationFee: policyAmountValue(policy.cardGuarantee.lateCancellationFee, upcomingForPolicy.total),
            noShowFee: policyAmountValue(policy.cardGuarantee.noShowFee, upcomingForPolicy.total),
            freeCancellationWindowHours: policy.cardGuarantee.freeCancellationWindowHours,
            freeCancellationDeadline: policyFreeCancellationDeadline(upcomingForPolicy.start, policy.cardGuarantee.freeCancellationWindowHours),
            allowReceptionistNotCharge: policy.cardGuarantee.allowReceptionistNotCharge,
            status: 'clientAccepted',
            createdAt: acceptedAt,
          };
        }
      }
    }
  }

  return {
    accounts,
    items,
    itemBySystemKey,
    counterparties,
    operations,
    documents,
    paymentMethods,
    bookingPayments,
    bookingPaymentNotes,
    clientAccountBalances,
    clientAccountTopUps,
    settlementEntries,
    receiptSettings,
    financeRights,
    onlinePaymentSettings,
    onlineLinkSettings,
    paymentLinks,
    prepaymentSettings,
    staffPrepayment,
    servicePrepayment,
    fiscalSettings,
    bookingOnlineCategory,
    paymentPolicy,
    policyServiceOverrides,
    policyAccountEntries,
    bookingPolicySnapshots,
    adyenConnections,
    adyenTransactions,
    accountTypes,
    manualOnlineOrders,
    paymentNotifications,
    cashShifts,
  };
}

export const financeSlice = defineSlice<FinanceState>({
  version: 15,
  seed,
});

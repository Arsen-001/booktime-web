/**
 * Типы и движок расчёта раздела «payroll». Файл принадлежит разделу.
 *
 * Модель — «упрощённая» схема Altegio (F-09-002): у каждого сотрудника своя схема из шести
 * независимых блоков (F-09-011), у локации — «Основные настройки» (F-09-004). Движок здесь —
 * чистые функции без React и стора (arch-a1 №1): экраны и api зовут их, сами не пересчитывают.
 *
 * ⭐ Основа расчёта — отметка «пришёл · сумма» (F-00-127): в расчёт идут только визиты
 * status === 'arrived', база — сумма строки услуги, а не прайс (F-09-017). Оплаты, комиссия банка,
 * лояльность и склад пока не отдают данные (finance/loyalty/stock не построены) — эти части схемы
 * появятся в следующих пачках, см. qa/plan/payroll.md.
 */
import type {
  Booking,
  BookingEvent,
  BookingServiceLine,
  CoreData,
  GroupEvent,
  Id,
  ISODate,
  Service,
  Staff,
} from "@/domain/core";
import { staffDayHours } from "@/domain/rules";
import { toMinutes } from "@/lib/date";

// ─────────────────────────── Ставка (% или сумма) ───────────────────────────

export type PayoutUnit = "percent" | "amount";

export interface PayoutValue {
  unit: PayoutUnit;
  value: number;
}

export const DEFAULT_PAYOUT: PayoutValue = { unit: "percent", value: 0 };

/** Допустимые диапазоны ставок (F-09-106: ❓ у Altegio не описано — наше решение) */
export const MAX_PERCENT = 100;
export const MAX_AMOUNT = 1_000_000;

export interface PayoutValueError {
  valid: boolean;
  /** Ключ словаря payroll.scheme.errors.<reasonKey> */
  reasonKey?: "negative" | "percentMax" | "amountMax" | "notNumber";
}

export function checkPayoutValue(v: PayoutValue): PayoutValueError {
  if (!Number.isFinite(v.value))
    return { valid: false, reasonKey: "notNumber" };
  if (v.value < 0) return { valid: false, reasonKey: "negative" };
  if (v.unit === "percent" && v.value > MAX_PERCENT)
    return { valid: false, reasonKey: "percentMax" };
  if (v.unit === "amount" && v.value > MAX_AMOUNT)
    return { valid: false, reasonKey: "amountMax" };
  return { valid: true };
}

/**
 * F-09-106: суммы — дробные (40% от 234 = 93.6), не округляются до целого драма; округляем только
 * до сотых, чтобы не копить погрешность плавающей точки.
 */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Ставка → сумма от базы; F-09-026: выплата по одной позиции не уходит в минус — обрезаем до 0 */
export function applyPayout(base: number, payout: PayoutValue): number {
  const raw =
    payout.unit === "percent" ? (base * payout.value) / 100 : payout.value;
  return roundMoney(Math.max(0, raw));
}

// ─────────────────────────── Схема сотрудника: шесть блоков ───────────────────────────

export type OverrideTargetType = "category" | "item";

export interface PayoutOverride {
  targetType: OverrideTargetType;
  targetId: Id;
  payout: PayoutValue;
}

/** F-09-008/F-09-015: три ставки за личные услуги при включённом ассистировании */
export interface AssistRates {
  withoutAssistant: PayoutValue;
  /** Не задано → мастер получает «без ассистента» минус выплаты ассистентам (F-09-047) */
  withAssistant?: PayoutValue;
  asAssistant: PayoutValue;
}

export function defaultAssistRates(): AssistRates {
  return {
    withoutAssistant: { ...DEFAULT_PAYOUT },
    asAssistant: { ...DEFAULT_PAYOUT },
  };
}

/** F-09-024/025: способ списания расходников с выплаты мастера */
export type ConsumablesMode = "off" | "full" | "proportional";

export interface ConsumablesSettings {
  mode: ConsumablesMode;
  /** F-09-025: применять ли скидку клиента к стоимости расходников перед вычетом (по умолч. — нет) */
  applyClientDiscount: boolean;
}

export function defaultConsumablesSettings(): ConsumablesSettings {
  return { mode: "off", applyClientDiscount: false };
}

/** F-09-020: отдельная ставка выплаты по конкретной акции (список акций читает loyalty api) */
export interface PromotionPayoutOverride {
  promotionId: Id;
  payout: PayoutValue;
}

/**
 * F-09-018…022: корректировка базы процента для программ лояльности и скидок — общая для услуг
 * (F-09-018…022) и товаров (F-09-033). Выключено (enabled=false) → база = после всех скидок и оплат
 * лояльностью (как раньше, F-09-017/031); включено → шесть галочек решают, какие части возвращаются
 * в базу (F-09-019), плюс отдельная ставка «от суммы по акции» (F-09-020).
 * 🔒 Пять из шести галочек (бонусы/абонемент/счёт клиента/сертификат/акции) хранятся и готовы к
 * расчёту, но реально меняют сумму только «скидка клиента» — она уже есть на BookingServiceLine
 * (price/unitPrice/discountPct); суммы, оплаченные бонусами/абонементом/сертификатом/счётом/по акции,
 * появятся, когда finance/loyalty начнут их отдавать (F-09-021 формула SP/LP/SR/PR — см.
 * personalServiceLoyaltyPayout ниже — готова и ждёт LP; qa/requests/payroll.md).
 */
export interface LoyaltyAdjustmentBlock {
  enabled: boolean;
  includeDiscount: boolean;
  includeBonus: boolean;
  includeMembership: boolean;
  /** F-09-022: сумма, оплаченная со счёта клиента (в т.ч. в долг) */
  includeClientAccount: boolean;
  includeCertificate: boolean;
  includePromotion: boolean;
  /** F-09-020: общая ставка «от суммы, оплаченной по акции» — используется, если для акции нет своего значения */
  promoPayout: PayoutValue;
  promoOverrides: PromotionPayoutOverride[];
}

export function defaultLoyaltyAdjustment(): LoyaltyAdjustmentBlock {
  return {
    enabled: false,
    includeDiscount: false,
    includeBonus: false,
    includeMembership: false,
    includeClientAccount: false,
    includeCertificate: false,
    includePromotion: false,
    promoPayout: { ...DEFAULT_PAYOUT },
    promoOverrides: [],
  };
}

export type GroupAttendeeMode = "none" | "each" | "aboveThreshold";

/** F-09-028/029/030: оплата за групповые события (тренер/ведущий) */
export interface GroupEventsBlock {
  enabled: boolean;
  /** F-09-028: минимальная выплата, даже если никто не пришёл */
  minPayoutOn: boolean;
  minPayout: PayoutValue;
  /** F-09-029: выплата, если пришёл хотя бы один клиент (не умножается на число участников) */
  atLeastOneOn: boolean;
  atLeastOnePayout: PayoutValue;
  /** F-09-030 */
  perAttendeeMode: GroupAttendeeMode;
  /** Порог для 'aboveThreshold' — доплата с (threshold+1)-го участника */
  threshold: number;
}

export function defaultGroupEvents(): GroupEventsBlock {
  return {
    enabled: false,
    minPayoutOn: false,
    minPayout: { ...DEFAULT_PAYOUT },
    atLeastOneOn: false,
    atLeastOnePayout: { ...DEFAULT_PAYOUT },
    perAttendeeMode: "none",
    threshold: 0,
  };
}

/** F-09-014, F-09-016, F-09-017, F-09-026, F-09-015, F-09-018…022, F-09-024/025, F-09-028…030 */
export interface PersonalServicesBlock {
  enabled: boolean;
  defaultPayout: PayoutValue;
  /** Индивидуальные значения для категории услуг или отдельной услуги (F-09-016) */
  overrides: PayoutOverride[];
  /**
   * 🔒 F-09-024/110 демо: стоимость расходников как % от суммы строки услуги (заменяет техкарту,
   * которую пока не отдаёт stock, — см. F-09-110 и qa/requests/payroll.md). Само списание этой суммы
   * из выплаты включает/выключает и настраивает consumables (mode/applyClientDiscount).
   * 0 или не задано — расходников у услуги нет.
   */
  demoConsumablesPercent?: number;
  consumables: ConsumablesSettings;
  /** F-09-008/F-09-015: видны в интерфейсе только когда в «Основных настройках» включено ассистирование */
  assistRates: AssistRates;
  loyaltyAdjustment: LoyaltyAdjustmentBlock;
  groupEvents: GroupEventsBlock;
}

/** F-09-034: учёт себестоимости товара — платить с наценки, а не с полной цены */
export type ProductCostOrder = "discountFirst" | "costFirst";

export interface ProductCostBasis {
  enabled: boolean;
  order: ProductCostOrder;
}

export function defaultProductCostBasis(): ProductCostBasis {
  return { enabled: false, order: "discountFirst" };
}

/**
 * F-09-031, F-09-032, F-09-105. У товаров в нашей базе пока нет категорий (владелец сущности — раздел
 * stock, каталог сейчас временно в journal, см. qa/requests/payroll.md) — индивидуальные значения на
 * отдельный товар (targetType='item'), плюс два наших синтетических «псевдо-категории» targetId
 * 'kind:subscription' / 'kind:certificate' (⭐ решение F-09-105: продажа абонемента/сертификата
 * оплачивается как обычный товар, но можно задать своё значение для всей категории — см.
 * payoutForProduct ниже).
 */
export interface ProductSalesBlock {
  enabled: boolean;
  defaultPayout: PayoutValue;
  overrides: PayoutOverride[];
  /** 🔒 демо-себестоимость как % от цены товара — заменяет алгоритм склада, пока stock не отдаёт данные */
  demoCostPercent?: number;
  costBasis: ProductCostBasis;
  loyaltyAdjustment: LoyaltyAdjustmentBlock;
}

export type WorkdayPeriod = "hour" | "day" | "month";

export type GuaranteedMinimumPeriod = "month" | "day";

/** F-09-038: гарантированный минимум за день или за месяц */
export interface GuaranteedMinimum {
  enabled: boolean;
  amount: number;
  period: GuaranteedMinimumPeriod;
}

export function defaultGuaranteedMinimum(): GuaranteedMinimum {
  return { enabled: false, amount: 0, period: "month" };
}

/** F-09-036, F-09-037 (месячный оклад — три условия), F-09-038 (гарантированный минимум) */
export interface WorkdayBlock {
  enabled: boolean;
  baseAmount: number;
  basePeriod: WorkdayPeriod;
  guaranteedMinimum: GuaranteedMinimum;
}

/** F-09-039/040: вознаграждение за каждую услугу в созданной записи, с индивидуальными значениями */
export interface RecordsBlock {
  enabled: boolean;
  /**
   * F-09-039 (QA 30.09): фиксированная сумма (֏) один раз за каждую созданную запись — отдельно от ставки
   * за услугу. Необязательное: у сохранённых раньше схем поля нет — считается 0.
   */
  perRecordAmount?: number;
  /** F-09-040: ставка за каждую услугу в записи, которую сотрудник СОЗДАЛ (др или %) */
  perServicePayout: PayoutValue;
  perServiceOverrides: PayoutOverride[];
  /** F-09-041: включает вознаграждение за услугу в записи, закрытой из онлайн-виджета */
  onlineWidgetEnabled: boolean;
  onlineWidgetPayout: PayoutValue;
}

export type ExtraRevenueBase = "turnover" | "profit";

/** F-09-042 / F-09-043 */
export interface ExtraRevenueBlock {
  enabled: boolean;
  percent: number;
  base: ExtraRevenueBase;
}

export interface PayrollScheme {
  staffId: Id;
  personalServices: PersonalServicesBlock;
  productSales: ProductSalesBlock;
  workday: WorkdayBlock;
  records: RecordsBlock;
  extraServiceRevenue: ExtraRevenueBlock;
  extraProductRevenue: ExtraRevenueBlock;
  /**
   * F-09-037 условие 3 («схема действует для сотрудника с начала месяца»): дата первого сохранения
   * схемы — в нашей упрощённой схеме нет отдельной даты начала, вывод ТЗ («❓ в упрощённой схеме нет
   * даты начала — вывод: по дате сохранения схемы») применён буквально. Не меняется при последующих
   * правках схемы (только updatedAt).
   */
  createdAt: string;
  /** Схема сохранена (F-09-010/013): нет схемы у сотрудника = не настроена, а не «все блоки off» */
  updatedAt: string;
  /**
   * З6 (зарплата-ревью 27.09): «Действует с» — с какого дня визиты считаются по этой версии схемы. Нет даты —
   * версия действует «всегда» (старые схемы до ревью): правка ставки больше не пересчитывает прошлое.
   */
  effectiveFrom?: ISODate;
  /** З6: прежние версии схемы (без своей истории), от старой к новой — расчёт берёт версию на дату визита */
  history?: PayrollScheme[];
  /** F-09-027: «Учёт себестоимости» — только у схемы, собранной из правила классики (ruleAsScheme) */
  serviceCostBasis?: ServiceCostBasis;
}

export function emptyScheme(staffId: Id, now: string): PayrollScheme {
  return {
    staffId,
    personalServices: {
      enabled: false,
      defaultPayout: { ...DEFAULT_PAYOUT },
      overrides: [],
      demoConsumablesPercent: 0,
      consumables: defaultConsumablesSettings(),
      assistRates: defaultAssistRates(),
      loyaltyAdjustment: defaultLoyaltyAdjustment(),
      groupEvents: defaultGroupEvents(),
    },
    productSales: {
      enabled: false,
      defaultPayout: { ...DEFAULT_PAYOUT },
      overrides: [],
      demoCostPercent: 0,
      costBasis: defaultProductCostBasis(),
      loyaltyAdjustment: defaultLoyaltyAdjustment(),
    },
    workday: {
      enabled: false,
      baseAmount: 0,
      basePeriod: "day",
      guaranteedMinimum: defaultGuaranteedMinimum(),
    },
    records: {
      enabled: false,
      perRecordAmount: 0,
      perServicePayout: { ...DEFAULT_PAYOUT },
      perServiceOverrides: [],
      onlineWidgetEnabled: false,
      onlineWidgetPayout: { ...DEFAULT_PAYOUT },
    },
    extraServiceRevenue: { enabled: false, percent: 0, base: "turnover" },
    extraProductRevenue: { enabled: false, percent: 0, base: "turnover" },
    createdAt: now,
    updatedAt: now,
  };
}

/** Схема «пустая» (сохранена со всеми выключенными блоками) — отличать от «не настроена» (F-09-011) */
export function isSchemeBlank(scheme: PayrollScheme): boolean {
  return (
    !scheme.personalServices.enabled &&
    !scheme.productSales.enabled &&
    !scheme.workday.enabled &&
    !scheme.records.enabled &&
    !scheme.extraServiceRevenue.enabled &&
    !scheme.extraProductRevenue.enabled
  );
}

/**
 * Короткие факты о схеме для фразы-итога над формой («Ани получает 40% с услуг · минимум 150 000 ֏
 * в месяц»), а не стены тумблеров — приём соперника, перенятый под наши тексты (qa/measure/payroll/
 * ux-best-c1.md §1). Строки форматирует вызывающая сторона (нужен t()/formatMoney).
 */
export interface SchemeSummaryFact {
  kind:
    | "personalServices"
    | "productSales"
    | "guaranteedMin"
    | "workday"
    | "records";
  payout?: PayoutValue;
  guaranteedMin?: GuaranteedMinimum;
  workdayAmount?: number;
  workdayPeriod?: WorkdayPeriod;
}

export function summarizeScheme(scheme: PayrollScheme): SchemeSummaryFact[] {
  const facts: SchemeSummaryFact[] = [];
  if (scheme.personalServices.enabled) {
    facts.push({
      kind: "personalServices",
      payout: scheme.personalServices.defaultPayout,
    });
  }
  if (scheme.productSales.enabled) {
    facts.push({
      kind: "productSales",
      payout: scheme.productSales.defaultPayout,
    });
  }
  if (scheme.workday.enabled) {
    facts.push({
      kind: "workday",
      workdayAmount: scheme.workday.baseAmount,
      workdayPeriod: scheme.workday.basePeriod,
    });
    if (scheme.workday.guaranteedMinimum.enabled) {
      facts.push({
        kind: "guaranteedMin",
        guaranteedMin: scheme.workday.guaranteedMinimum,
      });
    }
  }
  if (scheme.records.enabled) {
    facts.push({ kind: "records", payout: scheme.records.perServicePayout });
  }
  return facts;
}

// ─────────────────────────── Основные настройки локации ───────────────────────────

/** F-09-005 */
export type AccrualDateBasis = "visit" | "received";

/** F-09-007 — пять вариантов деления комиссии эквайринга (следующая пачка считает саму сумму) */
export type BankCommissionSplit =
  | "staffAssistBusiness"
  | "staffBusiness"
  | "staffAssist"
  | "staffOnly"
  | "businessOnly";

/** F-09-009: как несколько ассистентов на одну услугу делят свою комиссию */
export type AssistantSplitRule = "fullEach" | "shared";

export interface GeneralSettings {
  locationId: Id;
  accrualDateBasis: AccrualDateBasis;
  bankCommissionSplit: BankCommissionSplit;
  /** F-09-008 — компенсация ассистентам; открывает три ставки (F-09-015) в схеме сотрудника */
  assistCompensationEnabled: boolean;
  /** F-09-009: разрешено ли больше одного ассистента на услугу */
  multipleAssistantsAllowed: boolean;
  /** F-09-009: правило деления — полная ставка каждому / делится между всеми по их доле */
  assistantSplitRule: AssistantSplitRule;
  /**
   * F-09-002: упрощённая (по умолчанию) или классическая модель — классическая открывает в меню
   * «Правила», «Критерии», «Схемы расчёта» (F-09-049…056); ассистирование — только в упрощённой.
   */
  payrollModel: PayrollModel;
  /** F-09-100: включает согласование ведомости (проверено → одобрено → подписано) до отметки «выплачено» */
  statementApprovalEnabled: boolean;
  /** F-09-101: целевая доля фонда оплаты труда в обороте, % — выше warnPct показывается предупреждение */
  payrollFundTargetPct: number;
  payrollFundWarnPct: number;
  /**
   * З11: период закрыт по этот день включительно — схемы и ведомости с этой даты и раньше не меняются;
   * правка задним числом уходит корректировкой в следующий период.
   */
  closedThrough?: ISODate;
  updatedAt: string;
}

export function defaultGeneralSettings(
  locationId: Id,
  now: string,
): GeneralSettings {
  return {
    locationId,
    accrualDateBasis: "visit",
    bankCommissionSplit: "businessOnly",
    assistCompensationEnabled: false,
    multipleAssistantsAllowed: false,
    assistantSplitRule: "shared",
    payrollModel: "simplified",
    statementApprovalEnabled: false,
    payrollFundTargetPct: 30,
    payrollFundWarnPct: 40,
    updatedAt: now,
  };
}

// ─────────────────────────── F-09-047: доли мастера и ассистентов ───────────────────────────

export interface AssistantShare {
  staffId: Id;
  /** Доля 0–100 (F-09-009: при «делится» — считается сама, при «полной каждому» — по умолчанию 100) */
  sharePct: number;
}

export interface AssistSplitResult {
  masterAmount: number;
  assistants: { staffId: Id; amount: number }[];
}

/**
 * F-09-047 (чистая функция — данные о том, кто ассистировал в записи, отдаёт раздел «resources»,
 * которого ещё нет; см. qa/requests/payroll.md; UI и «Готово когда» проверяются вызовом напрямую).
 * Ассистент = его ставка «как ассистент» × доля. Мастер: если задана ставка «с ассистентом» — берёт её
 * целиком; иначе — «без ассистента» минус сумма выплат ассистентам (не ниже нуля, F-09-026).
 */
export function computeAssistSplit(
  serviceTotal: number,
  rates: AssistRates,
  assistants: AssistantShare[],
): AssistSplitResult {
  const assistantAmounts = assistants.map((a) => ({
    staffId: a.staffId,
    amount: roundMoney(
      (applyPayout(serviceTotal, rates.asAssistant) * a.sharePct) / 100,
    ),
  }));
  const assistantsSum = roundMoney(
    assistantAmounts.reduce((sum, a) => sum + a.amount, 0),
  );
  const masterAmount = rates.withAssistant
    ? applyPayout(serviceTotal, rates.withAssistant)
    : roundMoney(
        Math.max(
          0,
          applyPayout(serviceTotal, rates.withoutAssistant) - assistantsSum,
        ),
      );
  return { masterAmount, assistants: assistantAmounts };
}

// ─────────────────────────── Движок: расчёт за день ───────────────────────────

export interface PayoutLine {
  kind: "service" | "product";
  refId: Id;
  label: string;
  amount: number;
  /** F-09-026: расходники обрезали выплату по этой строке до нуля (демо-механизм, см. блок «Оплата за лично оказанные услуги») */
  clippedByConsumables?: boolean;
  /** З3: доля строки в неоплаченном остатке визита — эта часть не входит в базу процента */
  unpaid?: number;
  /**
   * F-09-062: фактическая цена строки (сумма визита клиенту), НЕ выплата мастеру — они разные,
   * когда ставка < 100% или расходники срезают выплату до нуля. Расчёт за период показывает оба:
   * «Стоимость услуг» (эта сумма) и «Зарплата» (amount, посчитанный по схеме).
   */
  revenue: number;
}

/** Одна операция в расчёте за день — визит или продажа (F-09-058/059) */
export interface DayOperation {
  time: string;
  bookingId?: Id;
  label: string;
  amount: number;
  /** Сумма revenue всех строк — см. PayoutLine.revenue */
  revenue: number;
  /** З3: сколько из суммы визита (доля этого сотрудника) не оплачено — не входит в базу процента */
  unpaid?: number;
  lines: PayoutLine[];
}

export interface StaffDayResult {
  staffId: Id;
  configured: boolean;
  operations: DayOperation[];
  servicesAmount: number;
  productsAmount: number;
  workdayAmount: number;
  recordsAmount: number;
  extraAmount: number;
  total: number;
}

export interface DayComputation {
  date: ISODate;
  /** Хотя бы у одного сотрудника есть схема (F-09-061) */
  anyConfigured: boolean;
  staff: StaffDayResult[];
  locationServicesTurnover: number;
}

/** Действующая ставка блока для конкретной позиции: своё значение → значение категории → по умолчанию (F-09-016) */
export function payoutForTarget(
  block: { defaultPayout: PayoutValue; overrides: PayoutOverride[] },
  itemId: Id,
  categoryId?: Id,
): PayoutValue {
  const itemOverride = block.overrides.find(
    (o) => o.targetType === "item" && o.targetId === itemId,
  );
  if (itemOverride) return itemOverride.payout;
  if (categoryId) {
    const catOverride = block.overrides.find(
      (o) => o.targetType === "category" && o.targetId === categoryId,
    );
    if (catOverride) return catOverride.payout;
  }
  return block.defaultPayout;
}

/**
 * F-09-105 (⭐ решение): абонемент и сертификат оплачиваются продавцу как обычный товар, но им можно
 * задать своё значение «для всей категории» — у нас в базе нет категорий товаров (см. комментарий у
 * ProductSalesBlock), поэтому это синтетический targetId, не настоящая сущность категории.
 */
export function pseudoCategoryForGoodsKind(
  kind: "subscription" | "certificate" | "product",
): Id | undefined {
  return kind === "product" ? undefined : `kind:${kind}`;
}

/**
 * F-09-019: сколько из цены строки закрыто каждым из пяти видов лояльности (finance/loyalty теперь
 * отдают эти данные — `loyaltyPaidForBooking` в api/payroll.ts, читает `readArea('loyalty')`). Суммы —
 * доля этой строки от общей суммы визита, закрытой этим способом (F-09-105/F-09-019).
 */
export interface LoyaltyPaidBreakdown {
  bonus: number;
  membership: number;
  clientAccount: number;
  certificate: number;
  promotion: number;
}

export const EMPTY_LOYALTY_PAID: LoyaltyPaidBreakdown = {
  bonus: 0,
  membership: 0,
  clientAccount: 0,
  certificate: 0,
  promotion: 0,
};

/**
 * F-09-018/019: база процента личной услуги — после скидки (как раньше) или полная цена, когда
 * корректировка включена и галочка «скидка клиента» отмечена; дальше из базы вычитается сумма,
 * закрытая КАЖДЫМ из пяти видов лояльности, у которых галочка «включать в расчёт» снята (F-09-019:
 * «отмеченная галочка — эта часть цены входит в базу; снятая — вычитается»).
 */
export function personalServiceBase(
  line: Pick<BookingServiceLine, "price" | "unitPrice" | "qty">,
  adjustment: LoyaltyAdjustmentBlock,
  loyaltyPaid?: LoyaltyPaidBreakdown,
): number {
  const afterDiscount = roundMoney(line.price * line.qty);
  if (!adjustment.enabled) return afterDiscount;
  let base = adjustment.includeDiscount
    ? roundMoney((line.unitPrice ?? line.price) * line.qty)
    : afterDiscount;
  if (loyaltyPaid) {
    if (!adjustment.includeBonus) base = roundMoney(base - loyaltyPaid.bonus);
    if (!adjustment.includeMembership)
      base = roundMoney(base - loyaltyPaid.membership);
    if (!adjustment.includeClientAccount)
      base = roundMoney(base - loyaltyPaid.clientAccount);
    if (!adjustment.includeCertificate)
      base = roundMoney(base - loyaltyPaid.certificate);
    if (!adjustment.includePromotion)
      base = roundMoney(base - loyaltyPaid.promotion);
  }
  return Math.max(0, base);
}

/**
 * F-09-021: формула лояльности из справки — (цена − оплачено лояльностью) × ставка + оплачено
 * лояльностью × ставка акции; галочка «учитывать сумму, оплаченную бонусами» решает первое слагаемое.
 * Чистая функция для «Готово когда» (пример 1600/50%/80/22% → 777.6 и 817.6) — LP пока всегда 0 в
 * реальном расчёте, см. комментарий выше у personalServiceBase.
 */
export function personalServiceLoyaltyPayout(
  price: number,
  loyaltyPaid: number,
  rate: PayoutValue,
  promoRate: PayoutValue,
  includeLoyaltyPaid: boolean,
): number {
  const base = includeLoyaltyPaid ? price : roundMoney(price - loyaltyPaid);
  return roundMoney(
    applyPayout(base, rate) + applyPayout(loyaltyPaid, promoRate),
  );
}

/**
 * F-09-024/025/110: сумма расходников, вычитаемая из выплаты за услугу. `realCost` — настоящая
 * себестоимость по техкарте пары «услуга × мастер» (F-09-110: `techCardCost` в api/payroll.ts, читает
 * `readArea('stock')` и `costPriceAt()`); когда техкарты нет, откатывается на `demoConsumablesPercent`
 * как % от ПОЛНОЙ цены строки (до скидки клиента) — устойчивый ориентир, не зависящий от акций. `rate`
 * — ставка, применённая к этой услуге (для режима 'proportional').
 */
export function consumablesDeduction(
  fullLineTotal: number,
  discountPct: number,
  block: Pick<PersonalServicesBlock, "demoConsumablesPercent" | "consumables">,
  rate: PayoutValue,
  realCost?: number,
): number {
  if (block.consumables.mode === "off") return 0;
  let cost: number;
  if (realCost !== undefined) {
    cost = roundMoney(realCost);
  } else {
    const pct = block.demoConsumablesPercent ?? 0;
    if (pct <= 0) return 0;
    cost = roundMoney((fullLineTotal * pct) / 100);
  }
  if (cost <= 0) return 0;
  if (block.consumables.applyClientDiscount && discountPct > 0) {
    cost = roundMoney(cost * (1 - discountPct / 100));
  }
  if (block.consumables.mode === "full") return cost;
  // 'proportional': доля мастера в его ставке; при фиксированной сумме (❓ F-09-024 не описывает) — не уменьшаем
  const sharePct = rate.unit === "percent" ? rate.value : 100;
  return roundMoney((cost * sharePct) / 100);
}

// ─────────────────────────── F-09-028…030: оплата за групповые события ───────────────────────────

/**
 * F-09-028/029/030, F-16-106/145/147: платит ведущему группового события, отдельно от начислений за
 * личные услуги и БЕЗ ассистентов (F-16-147 — в групповых событиях ассистентам не платят, поэтому сюда
 * их доли не передаются никогда). Две базы цены (F-09-028/029, F-09-030 — разное «откуда цена»):
 * `settingsPrice` — цена из настроек услуги, без скидок и правок администратора (минимум и «хотя бы
 * один»); `visitPrice` — цена из карточки визита участника (доплата за каждого, «по обычным правилам
 * оплаты услуг» — ставка `perAttendeeRate`); нет своей цены визита — берётся `settingsPrice`.
 */
export function computeGroupEventPayout(
  attendeesCount: number,
  settingsPrice: number,
  block: GroupEventsBlock,
  perAttendeeRate: PayoutValue,
  visitPrice: number = settingsPrice,
): number {
  if (!block.enabled) return 0;
  let total = 0;
  if (block.minPayoutOn)
    total = roundMoney(total + applyPayout(settingsPrice, block.minPayout));
  if (attendeesCount > 0 && block.atLeastOneOn)
    total = roundMoney(
      total + applyPayout(settingsPrice, block.atLeastOnePayout),
    );
  if (block.perAttendeeMode === "each") {
    total = roundMoney(
      total + applyPayout(visitPrice, perAttendeeRate) * attendeesCount,
    );
  } else if (block.perAttendeeMode === "aboveThreshold") {
    const extra = Math.max(0, attendeesCount - block.threshold);
    total = roundMoney(
      total + applyPayout(visitPrice, perAttendeeRate) * extra,
    );
  }
  return total;
}

// ─────────────────────────── F-09-034: себестоимость товара ───────────────────────────

/** F-09-034: два порядка корректировки дают разный итог при скидке клиенту */
export function productSaleBase(
  price: number,
  discountPct: number,
  costPercentOfPrice: number,
  costBasis: ProductCostBasis,
): number {
  const priceAfterDiscount = roundMoney(price * (1 - discountPct / 100));
  if (!costBasis.enabled) return priceAfterDiscount;
  const cost = roundMoney((price * costPercentOfPrice) / 100);
  if (costBasis.order === "discountFirst")
    return roundMoney(Math.max(0, priceAfterDiscount - cost));
  // 'costFirst': сначала вычитается себестоимость из полной цены, потом применяется скидка
  const afterCost = roundMoney(Math.max(0, price - cost));
  return roundMoney(afterCost * (1 - discountPct / 100));
}

/** F-09-112: услугу засчитывают тому, кто указан в строке (BookingServiceLine.staffId), а не главному мастеру записи */
function lineLabel(
  service: Service | undefined,
  line: BookingServiceLine,
): string {
  return service
    ? service.name.ru || service.name.en || service.name.hy || ""
    : line.serviceId;
}

export interface ComputeDayInput {
  date: ISODate;
  locationId: Id;
  staffIds: Id[];
  bookings: readonly Booking[];
  /** F-16-106/F-09-028…030: события дня — считать «минимум/хотя бы один» даже без пришедших нужно ЗНАТЬ,
   * что событие вообще было; для этого не хватает одних bookings (без участников бронь не создаётся). */
  groupEvents?: readonly GroupEvent[];
  services: readonly Service[];
  schemes: ReadonlyMap<Id, PayrollScheme>;
  /** F-09-019: доля визита, закрытая каждым видом лояльности (api/payroll.ts, читает readArea('loyalty')) */
  loyaltyPaidForBooking?: (bookingId: Id) => LoyaltyPaidBreakdown | undefined;
  /** F-09-046/047: ассистенты строки услуги и их доли (api/payroll.ts, читает readArea('resources')) */
  assistantsForLine?: (
    bookingId: Id,
    serviceIndex: number,
  ) => AssistantShare[];
  /** F-09-110: реальная себестоимость расходников техкарты «услуга × мастер», на одну услугу (× qty ниже) */
  techCardCost?: (
    serviceId: Id,
    staffId: Id,
    atDate: ISODate,
  ) => number | undefined;
  /**
   * F-09-007/107: сумма комиссии эквайринга по визиту (только карточные оплаты, api/payroll.ts,
   * читает readArea('finance')) и вариант её деления из «Основных настроек».
   */
  cardCommissionForBooking?: (bookingId: Id) => number;
  bankCommissionSplit?: BankCommissionSplit;
  /**
   * F-09-006: сколько из суммы визита ещё НЕ оплачено (полный/частичный возврат, отмена одного
   * платежа) — `readArea('finance').bookingPayments` минус активные строки, api/payroll.ts. Отличается
   * от лояльности (F-09-019, которая решает входит ли ОПЛАЧЕННАЯ лояльностью часть в базу): здесь речь о
   * деньгах, которых визит вообще не получил — они не входят в базу процента ни при каком раскладе.
   */
  unpaidForBooking?: (bookingId: Id) => number;
  /**
   * F-09-005 (QA 01.10): «Дата поступления средств на счёт» — день, которым визит попадает в зарплату
   * (последняя оплата + срок зачисления карты). Не передано или undefined — дата визита (по умолчанию).
   */
  accrualDateForBooking?: (bookingId: Id) => ISODate | undefined;
}

/**
 * F-09-058/059/017/026/112. Часть схемы «Оплата за лично оказанные услуги» по всем сотрудникам
 * дня. Товары (F-09-031/032) сюда не входят — у нас пока нет данных, кто продал товар
 * (QuickSaleRecord без staffId/locationId, см. qa/requests/payroll.md); оплату за рабочий день и
 * за записи считает вызывающая сторона отдельно (нужны все записи бизнеса, не только визиты дня).
 */
export function computeServicesForDay(
  input: ComputeDayInput,
): Map<Id, DayOperation[]> {
  const byService = new Map(input.services.map((s) => [s.id, s]));
  const result = new Map<Id, DayOperation[]>();
  for (const staffId of input.staffIds) result.set(staffId, []);

  // F-09-006: удалённый визит (deletedAt) не должен попадать в начисление, даже если статус остался
  // «arrived» — удаление и смена статуса это разные действия ядра (b.status не трогается при delete).
  // F-09-005: групповые события всегда по дате события (участники считаются событием целиком)
  const accrualDate = (b: Booking): ISODate =>
    (b.groupEventId
      ? undefined
      : input.accrualDateForBooking?.(b.id)) ?? (b.start.slice(0, 10) as ISODate);
  const dayBookings = input.bookings.filter(
    (b) =>
      b.locationId === input.locationId &&
      b.status === "arrived" &&
      !b.deletedAt &&
      accrualDate(b) === input.date,
  );

  // F-16-106/F-09-028…030, F-16-147: участник группового события не проходит обычную «Оплату за лично
  // оказанные услуги» — платят отдельно ведущему события (ниже), и БЕЗ ассистентов (их доли сюда не
  // передаются вовсе — F-16-147 «в групповых событиях ассистентам не платят»).
  const individualBookings = dayBookings.filter((b) => !b.groupEventId);

  for (const booking of individualBookings) {
    const byStaff = new Map<
      Id,
      { lines: PayoutLine[]; sum: number; revenueSum: number }
    >();
    // F-09-019: доля визита, закрытая лояльностью — на все строки визита пропорционально их доле
    // в сумме визита (LoyaltyTransaction в finance/loyalty не хранит номер строки).
    const loyaltyPaid = input.loyaltyPaidForBooking?.(booking.id);
    const bookingLineTotal =
      roundMoney(booking.services.reduce((s, l) => s + l.price * l.qty, 0)) ||
      1;
    let serviceIndex = -1;
    for (const line of booking.services) {
      serviceIndex++;
      const scheme = input.schemes.get(line.staffId);
      const service = byService.get(line.serviceId);
      const lineTotal = roundMoney(line.price * line.qty);
      let amount = 0;
      let clippedByConsumables = false;
      let lineUnpaid = 0;
      if (scheme?.personalServices.enabled) {
        const payout = payoutForTarget(
          scheme.personalServices,
          line.serviceId,
          service?.categoryId,
        );
        const lineShare = lineTotal / bookingLineTotal;
        const lineLoyaltyPaid: LoyaltyPaidBreakdown | undefined = loyaltyPaid
          ? {
              bonus: roundMoney(loyaltyPaid.bonus * lineShare),
              membership: roundMoney(loyaltyPaid.membership * lineShare),
              clientAccount: roundMoney(loyaltyPaid.clientAccount * lineShare),
              certificate: roundMoney(loyaltyPaid.certificate * lineShare),
              promotion: roundMoney(loyaltyPaid.promotion * lineShare),
            }
          : undefined;
        // F-09-018/019: база — после скидки, полная цена при включённой корректировке лояльности,
        // минус доля визита, закрытая видами лояльности с СНЯТОЙ галочкой «включать в расчёт»
        const baseBeforeUnpaid = personalServiceBase(
          line,
          scheme.personalServices.loyaltyAdjustment,
          lineLoyaltyPaid,
        );
        // F-09-006: визит вернули (частично/полностью) или отменили один платёж — доля этой строки в
        // неоплаченном остатке визита не входит в базу процента, независимо от настроек лояльности выше.
        const unpaidForBooking = input.unpaidForBooking?.(booking.id) ?? 0;
        const unpaidLineShare =
          unpaidForBooking > 0 ? roundMoney(unpaidForBooking * lineShare) : 0;
        const base =
          unpaidLineShare > 0
            ? Math.max(0, roundMoney(baseBeforeUnpaid - unpaidLineShare))
            : baseBeforeUnpaid;
        lineUnpaid = unpaidLineShare;
        // F-09-024/025/110: расходники списываются с выплаты за эту услугу и обрезают её до нуля
        // (F-09-026); минус не переносится на другие услуги. Реальная себестоимость техкарты
        // «услуга × мастер» — приоритет над демо-процентом.
        const fullLineTotal = roundMoney(
          (line.unitPrice ?? line.price) * line.qty,
        );
        const techCost = input.techCardCost?.(
          line.serviceId,
          line.staffId,
          input.date,
        );
        const realCost =
          techCost !== undefined ? roundMoney(techCost * line.qty) : undefined;
        let consumables = consumablesDeduction(
          fullLineTotal,
          line.discountPct ?? 0,
          scheme.personalServices,
          payout,
          realCost,
        );
        // F-09-027 (QA 01.10): правило классики «Учёт себестоимости» — процент считается с разницы цены и
        // себестоимости (техкарта мастера; нет техкарты — демо-процент расходников), порядок скидки — из
        // правила. Себестоимость тогда уменьшает БАЗУ, поэтому отдельного вычета расходников нет (иначе
        // одни и те же материалы вычлись бы дважды).
        let effBase = base;
        const costBasis = scheme.serviceCostBasis;
        if (costBasis?.enabled) {
          const pct = scheme.personalServices.demoConsumablesPercent ?? 0;
          const cost =
            realCost ?? (pct > 0 ? roundMoney((fullLineTotal * pct) / 100) : 0);
          const disc = line.discountPct ?? 0;
          effBase =
            costBasis.order === "discountFirst"
              ? Math.max(0, roundMoney(base - cost))
              : Math.max(
                  0,
                  roundMoney(
                    Math.max(0, fullLineTotal - cost) * (1 - disc / 100) -
                      unpaidLineShare,
                  ),
                );
          consumables = 0;
        }
        // F-09-024/026 (QA 30.09): расходники вычитаются из ВЫПЛАТЫ за услугу — «100%» вычитает всю
        // стоимость (материалы 10 → −10), «пропорционально» — стоимость × ставку (consumablesDeduction:
        // 60% → −6); минус обрезается до 0 только по этой услуге (40% от 500 = 200 − 300 → 0). Прежняя
        // ветка для «100%» считала (цена − стоимость) × ставку — это «пропорционально», а не 100%;
        // «цена минус себестоимость» (F-09-027) — отдельное правило классики, serviceCostBasisPayout.
        const raw = applyPayout(effBase, payout);
        amount = roundMoney(raw - consumables);
        if (amount < 0) {
          amount = 0;
          clippedByConsumables = true;
        }
        // F-09-046/047: ассистенты этой строки услуги (данные — resources, api/payroll.ts) делят
        // выплату по своей доле; мастер получает остаток (или ставку «с ассистентом», если задана).
        const assistantsOfLine =
          input.assistantsForLine?.(booking.id, serviceIndex) ?? [];
        if (assistantsOfLine.length > 0) {
          const split = computeAssistSplit(
            effBase,
            scheme.personalServices.assistRates,
            assistantsOfLine,
          );
          // F-09-024/047: расходники вычитаются только у мастера (с ассистента — никогда), и не ниже 0
          amount = Math.max(0, roundMoney(split.masterAmount - consumables));
          clippedByConsumables =
            consumables > 0 && split.masterAmount - consumables < 0;
          for (const a of split.assistants) {
            if (a.amount <= 0) continue;
            const assistBucket = byStaff.get(a.staffId) ?? {
              lines: [],
              sum: 0,
              revenueSum: 0,
            };
            assistBucket.lines.push({
              kind: "service",
              refId: `assist:${line.serviceId}`,
              label: lineLabel(service, line),
              amount: a.amount,
              revenue: 0,
            });
            assistBucket.sum = roundMoney(assistBucket.sum + a.amount);
            byStaff.set(a.staffId, assistBucket);
          }
        }
      }
      const bucket = byStaff.get(line.staffId) ?? {
        lines: [],
        sum: 0,
        revenueSum: 0,
      };
      bucket.lines.push({
        kind: "service",
        refId: line.serviceId,
        label: lineLabel(service, line),
        amount,
        clippedByConsumables,
        unpaid: lineUnpaid > 0 ? lineUnpaid : undefined,
        revenue: lineTotal,
      });
      bucket.sum = roundMoney(bucket.sum + amount);
      bucket.revenueSum = roundMoney(bucket.revenueSum + lineTotal);
      byStaff.set(line.staffId, bucket);
    }
    // F-09-007/107: комиссия эквайринга по визиту делится между сотрудниками, у которых есть выплата
    // за этот визит, пропорционально их доле в сумме визита, и дальше — по варианту F-09-007 между
    // мастером и бизнесом (без данных об ассистентах на визите доля ассистентов всегда 0, F-09-047).
    const bookingCommission = input.cardCommissionForBooking?.(booking.id);
    if (bookingCommission && bookingCommission > 0 && byStaff.size > 0) {
      const variant = input.bankCommissionSplit ?? "businessOnly";
      const staffRevenueTotal =
        Array.from(byStaff.values()).reduce((s, b) => s + b.revenueSum, 0) || 1;
      for (const [, bucket] of byStaff) {
        const staffShare = bucket.revenueSum / staffRevenueTotal;
        const staffCommission = roundMoney(bookingCommission * staffShare);
        if (staffCommission <= 0) continue;
        // З8: «доля мастера» — его выплата от цены строк (40% → 40% комиссии), а не 100%: при «специалист
        // и бизнес» комиссия делится по ставке, а не ложится на мастера целиком.
        const masterRatePct =
          bucket.revenueSum > 0
            ? Math.min(100, roundMoney((bucket.sum / bucket.revenueSum) * 100))
            : 0;
        const split = splitBankCommission(
          {
            commissionAmount: staffCommission,
            masterRatePct,
            assistantRatesPct: [],
          },
          variant,
        );
        if (split.master > 0) {
          bucket.sum = Math.max(0, roundMoney(bucket.sum - split.master));
          bucket.lines.push({
            kind: "service",
            refId: `commission:${booking.id}`,
            label: "commission",
            amount: -split.master,
            revenue: 0,
          });
        }
      }
    }
    for (const [staffId, bucket] of byStaff) {
      if (!result.has(staffId)) result.set(staffId, []);
      const opUnpaid = roundMoney(
        bucket.lines.reduce((s, l) => s + (l.unpaid ?? 0), 0),
      );
      result.get(staffId)!.push({
        time: booking.start.slice(11, 16),
        bookingId: booking.id,
        label: booking.start.slice(11, 16),
        amount: bucket.sum,
        revenue: bucket.revenueSum,
        unpaid: opUnpaid > 0 ? opUnpaid : undefined,
        lines: bucket.lines,
      });
    }
  }

  // F-16-106/F-09-028…030: оплата ведущему группового события — отдельно от строк выше, по числу
  // РЕАЛЬНО пришедших участников (арендует те же "arrived"-брони, но не по одной, а событием целиком),
  // и по «Оплате за групповые события» схемы ведущего (event.staffId). Событие без единого участника не
  // создаёт ни одной Booking, поэтому его нужно брать из input.groupEvents, а не из dayBookings.
  const dayGroupEvents = (input.groupEvents ?? []).filter(
    (e) =>
      e.locationId === input.locationId &&
      e.status === "scheduled" &&
      e.start.slice(0, 10) === input.date,
  );
  for (const event of dayGroupEvents) {
    const scheme = input.schemes.get(event.staffId);
    if (!scheme?.personalServices.enabled) continue;
    const groupEvents = scheme.personalServices.groupEvents;
    if (!groupEvents.enabled) continue;
    const service = byService.get(event.serviceId);
    const settingsPrice = service?.priceMin ?? 0;
    // F-09-029/030: «пришёл» — та же отметка «arrived», что и у личных услуг (⭐ F-00-127); отменённые
    // и неявки места не занимают и участниками не считаются (F-16-044/047, как в seatsTaken resources).
    const attendeeBookings = dayBookings.filter(
      (b) => b.groupEventId === event.id,
    );
    const attendeesCount = attendeeBookings.reduce(
      (n, b) => n + Math.max(1, b.services[0]?.qty ?? 1),
      0,
    );
    const perAttendeeRate = payoutForTarget(
      scheme.personalServices,
      event.serviceId,
      service?.categoryId,
    );
    // F-09-030: доплата за каждого — «от цены из карточки визита», не из настроек услуги.
    const visitPrice =
      attendeesCount > 0
        ? roundMoney(
            attendeeBookings.reduce(
              (s, b) =>
                s + (b.services[0]?.price ?? 0) * Math.max(1, b.services[0]?.qty ?? 1),
              0,
            ) / attendeesCount,
          )
        : settingsPrice;
    const amount = computeGroupEventPayout(
      attendeesCount,
      settingsPrice,
      groupEvents,
      perAttendeeRate,
      visitPrice,
    );
    if (amount <= 0) continue;
    const label = service
      ? service.name.ru || service.name.en || service.name.hy || ""
      : event.serviceId;
    if (!result.has(event.staffId)) result.set(event.staffId, []);
    result.get(event.staffId)!.push({
      time: event.start.slice(11, 16),
      bookingId: event.id,
      label,
      amount,
      revenue: roundMoney(attendeeBookings.reduce((s, b) => s + b.total, 0)),
      lines: [
        {
          kind: "service",
          refId: `group:${event.id}`,
          label,
          amount,
          revenue: 0,
        },
      ],
    });
  }

  for (const ops of result.values())
    ops.sort((a, b) => a.time.localeCompare(b.time));
  return result;
}

export function locationServicesTurnover(
  bookings: readonly Booking[],
  locationId: Id,
  date: ISODate,
): number {
  return roundMoney(
    bookings
      .filter(
        (b) =>
          b.locationId === locationId &&
          b.status === "arrived" &&
          !b.deletedAt &&
          b.start.slice(0, 10) === date,
      )
      .reduce((sum, b) => sum + b.total, 0),
  );
}

/** F-09-036: часы графика в этот день (не часы с клиентами — по решению ТЗ, добавлено проверкой 2) */
export function staffWorkedHoursOnDay(
  core: Pick<CoreData, "schedules">,
  staffId: Id,
  date: ISODate,
  locationId: Id,
): number {
  const ranges = staffDayHours(core, staffId, date, locationId);
  const minutes = ranges.reduce(
    (sum, r) => sum + Math.max(0, toMinutes(r.to) - toMinutes(r.from)),
    0,
  );
  return roundMoney(minutes / 60);
}

/** F-09-039/040: вознаграждение за запись и за КАЖДУЮ услугу в записи, которую сотрудник создал, — днём визита «пришёл» */
export function recordsRewardForDay(
  bookings: readonly Booking[],
  staffId: Id,
  date: ISODate,
  block: RecordsBlock,
  services: readonly Service[],
  /** QA 30.09: только записи этого филиала — иначе у сотрудника двух филиалов запись считалась дважды */
  locationId?: Id,
): number {
  if (!block.enabled) return 0;
  const byService = new Map(services.map((s) => [s.id, s]));
  let total = 0;
  for (const b of bookings) {
    if (
      b.deletedAt ||
      // Решение владельца 01.10.2026: платим только за состоявшиеся записи («Клиент пришел»), не за
      // отмены клиентом, неявки и ещё не прошедшие
      b.status !== "arrived" ||
      b.createdBy !== staffId ||
      // Решение владельца 01.10.2026: начисляется днём визита (когда запись состоялась), а не днём создания —
      // иначе сумма за записи «догоняла» уже закрытый период
      b.start.slice(0, 10) !== date ||
      (locationId !== undefined && b.locationId !== locationId)
    )
      continue;
    // F-09-039: сумма за саму запись — один раз, сколько бы услуг в ней ни было
    total = roundMoney(total + Math.max(0, block.perRecordAmount ?? 0));
    for (const line of b.services) {
      const service = byService.get(line.serviceId);
      const payout = payoutForTarget(
        {
          defaultPayout: block.perServicePayout,
          overrides: block.perServiceOverrides,
        },
        line.serviceId,
        service?.categoryId,
      );
      total = roundMoney(
        total + applyPayout(roundMoney(line.price * line.qty), payout),
      );
    }
  }
  return total;
}

/**
 * F-09-041: вознаграждение за услугу в записи, закрытой из онлайн-виджета. «Закрыта» — статус
 * «Клиент пришел» (F-09-041 логика); платят тому, кто ПЕРВЫМ поставил этот статус (⭐ решение — у
 * онлайн-записи создателя-сотрудника нет, её создаёт клиент, F-01-098/F-00-093), а не создателю записи.
 * `events` — `listBookingEvents()` из '@/api/core' (kind 'status', отсортирован по времени добавления).
 */
export function onlineWidgetRewardForDay(
  bookings: readonly Booking[],
  events: readonly Pick<BookingEvent, "bookingId" | "kind" | "to" | "by">[],
  staffId: Id,
  date: ISODate,
  block: RecordsBlock,
  services: readonly Service[],
  locationId?: Id,
): number {
  if (!block.enabled || !block.onlineWidgetEnabled) return 0;
  const byService = new Map(services.map((s) => [s.id, s]));
  let total = 0;
  for (const b of bookings) {
    if (b.deletedAt || b.status !== "arrived" || b.source === "journal")
      continue;
    if (b.start.slice(0, 10) !== date) continue;
    if (locationId !== undefined && b.locationId !== locationId) continue;
    const firstArrived = events.find(
      (e) => e.bookingId === b.id && e.kind === "status" && e.to === "arrived",
    );
    if (!firstArrived || firstArrived.by !== staffId) continue;
    for (const line of b.services) {
      const service = byService.get(line.serviceId);
      void service; // резерв под индивидуальные значения по услуге, если понадобятся позже
      total = roundMoney(
        total +
          applyPayout(
            roundMoney(line.price * line.qty),
            block.onlineWidgetPayout,
          ),
      );
    }
  }
  return total;
}

// ─────────────────────────── F-09-037/038: месячный оклад и гарантированный минимум ───────────────────────────

function monthIndex(y: number, m: number): number {
  return y * 12 + (m - 1);
}
function monthFromIndex(idx: number): { y: number; m: number } {
  return { y: Math.floor(idx / 12), m: (((idx % 12) + 12) % 12) + 1 };
}
function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * F-09-037 условие 1: месяцы, за которые оклад может начислиться в этом периоде — период должен
 * включать 1-е число СЛЕДУЮЩЕГО месяца. Пример ТЗ: 01.09–30.09 → [«2026-08»]; 02.09–01.10 → [«2026-09»].
 */
export function qualifyingMonthlySalaryMonths(
  from: ISODate,
  to: ISODate,
): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const startIdx = monthIndex(fy, fm) - 1;
  const endIdx = monthIndex(ty, tm);
  const months: string[] = [];
  for (let idx = startIdx; idx <= endIdx; idx++) {
    const cur = monthFromIndex(idx);
    const next = monthFromIndex(idx + 1);
    const firstOfNext = `${next.y}-${String(next.m).padStart(2, "0")}-01`;
    if (firstOfNext >= from && firstOfNext <= to)
      months.push(monthKey(cur.y, cur.m));
  }
  return months;
}

/** F-09-037 условия 2 и 3: хотя бы час в графике этого месяца, и схема действует с начала месяца */
export function monthlySalaryQualifies(
  month: string,
  workedHoursInMonth: number,
  schemeCreatedAt: string,
): boolean {
  if (workedHoursInMonth <= 0) return false;
  return schemeCreatedAt.slice(0, 10) <= `${month}-01`;
}

/** F-09-038: [from,to] — ровно один календарный месяц целиком (минимум за месяц не дробится по частям) */
export function periodIsWholeMonth(from: ISODate, to: ISODate): boolean {
  const [y, m] = from.split("-").map(Number);
  if (from.slice(8, 10) !== "01") return false;
  const next = monthFromIndex(monthIndex(y, m) + 1);
  const lastDay = new Date(Date.UTC(next.y, next.m - 1, 0)).getUTCDate();
  const expectedTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return to === expectedTo;
}

/**
 * Доля месяца, отработанная по графику (решение владельца 01.10.2026): часы графика по сегодня включительно / часы
 * графика за весь календарный месяц. Оклад месяца и минимум месяца умножаются на неё — 1 октября не весь оклад.
 */
export function monthWorkShare(workedHours: number, monthHours: number): number {
  if (monthHours <= 0) return workedHours > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, workedHours / monthHours));
}

/** Последний день месяца 'YYYY-MM' */
export function monthLastDay(month: string): ISODate {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

/** F-09-038: применяет гарантированный минимум за месяц, только если период — ровно этот месяц целиком */
export function applyMonthlyGuaranteedMinimum(
  computedTotal: number,
  min: GuaranteedMinimum,
  from: ISODate,
  to: ISODate,
): number {
  if (!min.enabled || min.amount <= 0 || min.period !== "month")
    return computedTotal;
  if (!periodIsWholeMonth(from, to)) return computedTotal;
  return Math.max(computedTotal, min.amount);
}

/** F-09-038: минимум за день — сравнивает итог ЭТОГО дня (расчёт за день) с минимумом */
export function applyDailyGuaranteedMinimum(
  dayTotal: number,
  min: GuaranteedMinimum,
): number {
  if (!min.enabled || min.amount <= 0 || min.period !== "day") return dayTotal;
  return Math.max(dayTotal, min.amount);
}

// ─────────────────────────── F-09-007/107: деление комиссии эквайринга ───────────────────────────

export interface CommissionShareInput {
  commissionAmount: number;
  masterRatePct: number;
  assistantRatesPct: number[];
}

export interface CommissionShareResult {
  master: number;
  assistants: number[];
  business: number;
}

/**
 * F-09-007 (чистая функция — сама сумма комиссии придёт из finance, F-09-107, ещё не построен; онлайн-
 * оплата у нас отложена, F-00-028, поэтому комиссия возникает только у карт, принятых терминалом
 * салона). «Доля» каждого — его ставка процента зарплаты за услугу (вывод ТЗ).
 */
export function splitBankCommission(
  input: CommissionShareInput,
  variant: BankCommissionSplit,
): CommissionShareResult {
  const { commissionAmount: c, masterRatePct, assistantRatesPct } = input;
  switch (variant) {
    case "staffAssistBusiness": {
      const master = roundMoney((c * masterRatePct) / 100);
      const assistants = assistantRatesPct.map((r) =>
        roundMoney((c * r) / 100),
      );
      const business = roundMoney(
        Math.max(0, c - master - assistants.reduce((s, a) => s + a, 0)),
      );
      return { master, assistants, business };
    }
    case "staffBusiness": {
      const master = roundMoney((c * masterRatePct) / 100);
      return {
        master,
        assistants: assistantRatesPct.map(() => 0),
        business: roundMoney(Math.max(0, c - master)),
      };
    }
    case "staffAssist": {
      const totalPct =
        masterRatePct + assistantRatesPct.reduce((s, r) => s + r, 0) || 1;
      const master = roundMoney((c * masterRatePct) / totalPct);
      const assistants = assistantRatesPct.map((r) =>
        roundMoney((c * r) / totalPct),
      );
      return { master, assistants, business: 0 };
    }
    case "staffOnly":
      return {
        master: c,
        assistants: assistantRatesPct.map(() => 0),
        business: 0,
      };
    case "businessOnly":
    default:
      return {
        master: 0,
        assistants: assistantRatesPct.map(() => 0),
        business: c,
      };
  }
}

/**
 * 🔒 F-09-042/043 демо: настоящих расходов пока нет (finance/stock их не отдают), поэтому «прибыль»
 * — оборот минус демо-доля расходов DEMO_EXPENSE_RATIO (пример ТЗ: оборот 10 000, расходы 7 000,
 * прибыль 3 000 → ratio 0.7). Заменить точной формулой, когда finance начнёт отдавать расходы
 * (не правка чужого файла — наше решение на время стройки, см. qa/requests/payroll.md).
 */
export const DEMO_EXPENSE_RATIO = 0.7;

export function extraRevenueAmount(
  turnover: number,
  block: ExtraRevenueBlock,
  /**
   * Решение владельца 01.10.2026: настоящие расходы дня из финансов (или себестоимость проданного для
   * товаров). undefined — расходов в финансах не заведено: тогда условно DEMO_EXPENSE_RATIO, и экран
   * подписывает сумму «условно — расходы не заведены» (PayBreakdown.extraProfitAssumed).
   */
  expenses?: number,
): number {
  if (!block.enabled || block.percent <= 0) return 0;
  const base =
    block.base === "profit"
      ? expenses !== undefined
        ? Math.max(0, roundMoney(turnover - expenses))
        : roundMoney(turnover * (1 - DEMO_EXPENSE_RATIO))
      : turnover;
  return roundMoney((base * block.percent) / 100);
}

export function sumDayResult(
  r: Pick<
    StaffDayResult,
    | "servicesAmount"
    | "productsAmount"
    | "workdayAmount"
    | "recordsAmount"
    | "extraAmount"
  >,
): number {
  return roundMoney(
    r.servicesAmount +
      r.productsAmount +
      r.workdayAmount +
      r.recordsAmount +
      r.extraAmount,
  );
}

// ─────────────────────────── Движок: расчёт за период ───────────────────────────

export interface PeriodRow {
  staffId: Id;
  /** «Отработано» — дни и часы графика по сегодняшний день включительно (решение владельца 01.10.2026) */
  workDays: number;
  workHours: number;
  /** Дни и часы графика после сегодня в этом периоде — только подпись, в зарплату не идут */
  scheduledAheadDays?: number;
  scheduledAheadHours?: number;
  servicesCount: number;
  servicesAmount: number;
  productsCount: number;
  productsAmount: number;
  /** Итоговая стоимость услуг + товаров */
  totalAmount: number;
  /** З3: итоговая стоимость минус неоплаченное (визиты «пришёл», за которые деньги в кассу не пришли) */
  paidAmount: number;
  salary: number;
  /** З2/З7/З10: из чего сложилась зарплата — нет у ответа сервера (режим api), экраны тогда показывают только итог */
  breakdown?: PayBreakdown;
}

/** З2/З7/З10: одна раскладка зарплаты на все экраны — период, ведомость, взаиморасчёты, аналитика ФОТ */
export interface PayBreakdown {
  services: number;
  products: number;
  workday: number;
  records: number;
  extra: number;
  /** Доплата до гарантированного минимума (0 — минимум не нужен или не применяется к этому периоду) */
  minimumTopUp: number;
  /** Зарплата по схеме = services + products + workday + records + extra + minimumTopUp */
  salary: number;
  /** Премии и внеочередные начисления за период (взаиморасчёты) */
  bonuses: number;
  penalties: number;
  /** К выплате = salary + bonuses − penalties */
  toPay: number;
  /** З3: визиты «пришёл» без полной оплаты — их неоплаченная часть не входит в процент */
  unpaidVisits: number;
  unpaidAmount: number;
  /** З10: оплата за рабочий день включена, а часов в графике за период нет */
  workdayNoSchedule: boolean;
  /** З2: гарантированный минимум схемы и применился ли он к этому периоду */
  minimum?: {
    amount: number;
    period: GuaranteedMinimumPeriod;
    applied: boolean;
    wholeMonth: boolean;
    /** Решение 01.10.2026: минимум месяца пропорционален отработанному — amount × workedHours / monthHours */
    proratedAmount?: number;
    /** Часы графика по сегодня включительно / за весь месяц */
    workedHours?: number;
    monthHours?: number;
  };
  /** З9: % с продаж включён, но продажа пока не привязана к мастеру — начислится 0 */
  productsNotLinked: boolean;
  /** Решение владельца 01.10.2026: «доп. от прибыли» посчитано условно — расходов в финансах нет */
  extraProfitAssumed?: boolean;
}

export function emptyPayBreakdown(): PayBreakdown {
  return {
    services: 0,
    products: 0,
    workday: 0,
    records: 0,
    extra: 0,
    minimumTopUp: 0,
    salary: 0,
    bonuses: 0,
    penalties: 0,
    toPay: 0,
    unpaidVisits: 0,
    unpaidAmount: 0,
    workdayNoSchedule: false,
    productsNotLinked: false,
  };
}

export interface PeriodComputation {
  from: ISODate;
  to: ISODate;
  anyConfigured: boolean;
  rows: PeriodRow[];
}

export function isStaffActiveOnList(staff: Pick<Staff, "status">): boolean {
  return staff.status !== "fired";
}

// ─────────────────────────── Справочник «Премии и штрафы» (F-09-072) ───────────────────────────

export type BonusPenaltyKind = "bonus" | "penalty";

export interface BonusPenaltyType {
  id: Id;
  businessId: Id;
  kind: BonusPenaltyKind;
  name: string;
  /** Стандартная сумма — подставляется при выборе, её можно поменять (F-09-072/073) */
  defaultAmount: number;
  createdAt: string;
}

// ─────────────────────────── Ведомость: операции за период, для «страницы ведомости» ───────────────────────────

/** Одна строка «расчётной ведомости» (F-09-067) — визит одного дня с датой, для отображения на странице ведомости */
export interface StatementOperation extends DayOperation {
  date: ISODate;
}

export interface StatementComputation {
  staffId: Id;
  from: ISODate;
  to: ISODate;
  operations: StatementOperation[];
  /** Сумма всех payout-строк (без премий/штрафов — те приходят из взаиморасчётов, F-09-068) */
  total: number;
  /** З2: полная раскладка — та же, что в «Расчёте за период» (нет у ответа сервера в режиме api) */
  breakdown?: PayBreakdown;
  workDays?: number;
  workHours?: number;
  scheduledAheadDays?: number;
  scheduledAheadHours?: number;
  /** Зарплата по схеме за период — та же, что в строке «Расчёта» (рабочий день, оклад, минимум); нет — total */
  salary?: number;
}

// ─────────────────────────── b04: права на зарплату (F-09-085…089) ───────────────────────────

/** «Без ограничения» / «только текущий день» (F-09-086/087, справка 1377/1562) */
export type PayrollScopeAccess = "none" | "today" | "all";

/**
 * Права раздела «payroll», по сотруднику. Фундамент пока даёт только `payroll.view`/`payroll.manage`
 * (плоские права); отдельные права по справке (F-09-085…088) запрошены в qa/requests/payroll.md —
 * пока это свой флаг раздела поверх базового `payroll.view`/`payroll.manage` (владелец/сеть — всегда
 * полный доступ; overrides ниже сужают его для конкретного администратора/мастера).
 */
export interface PayrollStaffRights {
  staffId: Id;
  /** F-09-085: доступ к схемам расчёта и справочнику премий/штрафов (создавать и менять) */
  schemesAccess: boolean;
  /** F-09-086: доступ к расчёту (смотреть «за день»/«за период») */
  calcAccess: PayrollScopeAccess;
  /** F-09-087: доступ к начислению (создавать ведомости) */
  accrueAccess: PayrollScopeAccess;
  /** F-09-088: «только конкретный сотрудник» — видит расчёт/взаиморасчёты только по этому staffId */
  ownOnlyStaffId?: Id;
  updatedAt: string;
}

export function defaultPayrollStaffRights(
  staffId: Id,
  now: string,
): PayrollStaffRights {
  return {
    staffId,
    schemesAccess: false,
    calcAccess: "none",
    accrueAccess: "none",
    updatedAt: now,
  };
}

// ─────────────────────────── b04: классическая модель (F-09-002, F-09-049…056) ───────────────────────────

export type PayrollModel = "simplified" | "classic";

/** F-09-027: учёт себестоимости услуги — правило классической модели (в упрощённой схеме — списание расходников F-09-024) */
export type ServiceCostOrder = "discountFirst" | "costFirst";

export interface ServiceCostBasis {
  enabled: boolean;
  order: ServiceCostOrder;
}

export function defaultServiceCostBasis(): ServiceCostBasis {
  return { enabled: false, order: "discountFirst" };
}

/**
 * F-09-027: база процента мастера = цена минус себестоимость (а не сама выплата, в отличие от
 * consumablesDeduction). Пример ТЗ: цена 1000, себестоимость 300, 40% → 280.
 */
export function serviceCostBasisPayout(
  price: number,
  discountPct: number,
  cost: number,
  basis: ServiceCostBasis,
  rate: PayoutValue,
): number {
  if (!basis.enabled)
    return applyPayout(roundMoney(price * (1 - discountPct / 100)), rate);
  const priceAfterDiscount = roundMoney(price * (1 - discountPct / 100));
  if (basis.order === "discountFirst") {
    return applyPayout(
      Math.max(0, roundMoney(priceAfterDiscount - cost)),
      rate,
    );
  }
  // 'costFirst': сначала вычитается себестоимость из полной цены, потом скидка
  const afterCost = Math.max(0, roundMoney(price - cost));
  return applyPayout(roundMoney(afterCost * (1 - discountPct / 100)), rate);
}

/** F-09-050: правило классической модели — те же блоки, что у упрощённой схемы, плюс себестоимость услуги */
export interface PayrollRule {
  id: Id;
  businessId: Id;
  name: string;
  personalServices: PersonalServicesBlock;
  serviceCostBasis: ServiceCostBasis;
  productSales: ProductSalesBlock;
  workday: WorkdayBlock;
  records: RecordsBlock;
  extraServiceRevenue: ExtraRevenueBlock;
  extraProductRevenue: ExtraRevenueBlock;
  createdAt: string;
  updatedAt: string;
}

export function emptyRule(
  id: Id,
  businessId: Id,
  name: string,
  now: string,
): PayrollRule {
  const scheme = emptyScheme("" as Id, now);
  return {
    id,
    businessId,
    name,
    personalServices: scheme.personalServices,
    serviceCostBasis: defaultServiceCostBasis(),
    productSales: scheme.productSales,
    workday: scheme.workday,
    records: scheme.records,
    extraServiceRevenue: scheme.extraServiceRevenue,
    extraProductRevenue: scheme.extraProductRevenue,
    createdAt: now,
    updatedAt: now,
  };
}

/** F-09-052: «критерий расчёта» — условие плана, по которому плановая схема выбирает правило */
export type CriterionPeriod = "month" | "day";
export type CriterionMetric = "turnover" | "profit" | "count";
export type CriterionScope = "staff" | "location";

export interface PayrollCriterion {
  id: Id;
  businessId: Id;
  name: string;
  period: CriterionPeriod;
  metric: CriterionMetric;
  scope: CriterionScope;
  byServices: boolean;
  byProducts: boolean;
  /** Порог: сумма (валюта) для оборота/прибыли, штуки для количества */
  threshold: number;
  /** F-09-052: «с учётом скидок» клиента и оплат бонусами/сертификатами, или без */
  includeDiscounts: boolean;
  /** «ДЛЯ ЧЕГО» — при metric='count': категории и/или отдельные услуги/товары, которые считаются */
  countCategoryIds: Id[];
  countItemIds: Id[];
  createdAt: string;
  updatedAt: string;
}

export function emptyCriterion(
  id: Id,
  businessId: Id,
  name: string,
  now: string,
): PayrollCriterion {
  return {
    id,
    businessId,
    name,
    period: "month",
    metric: "turnover",
    scope: "staff",
    byServices: true,
    byProducts: false,
    threshold: 0,
    includeDiscounts: true,
    countCategoryIds: [],
    countItemIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** F-09-052: пример ТЗ — «оборот сотрудника по услугам за месяц больше 500 000» срабатывает при 510 000, не при 490 000 */
export function evaluateCriterion(
  criterion: Pick<PayrollCriterion, "threshold">,
  actualValue: number,
): boolean {
  return actualValue > criterion.threshold;
}

/** F-09-054: строка плановой схемы — «критерий → правило», проверяется сверху вниз */
export interface PayrollChartPlanRow {
  criterionId: Id;
  ruleId: Id;
}

export type PayrollChartType = "standard" | "planned";

export interface PayrollChart {
  id: Id;
  businessId: Id;
  name: string;
  type: PayrollChartType;
  /** Стандартная схема: всегда это правило. Плановая: применяется, если ни один критерий не выполнен */
  standardRuleId: Id | undefined;
  /** Плановая схема: строки сверху вниз, первая с выполненным критерием побеждает (F-09-054) */
  planRows: PayrollChartPlanRow[];
  createdAt: string;
  updatedAt: string;
}

export function emptyChart(
  id: Id,
  businessId: Id,
  name: string,
  now: string,
): PayrollChart {
  return {
    id,
    businessId,
    name,
    type: "standard",
    standardRuleId: undefined,
    planRows: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** F-09-054: плановая схема — первый выполненный критерий сверху; если ни один — стандартное правило */
export function pickRuleForChart(
  chart: Pick<PayrollChart, "type" | "standardRuleId" | "planRows">,
  criterionMet: (criterionId: Id) => boolean,
): Id | undefined {
  if (chart.type === "standard") return chart.standardRuleId;
  for (const row of chart.planRows) {
    if (criterionMet(row.criterionId)) return row.ruleId;
  }
  return chart.standardRuleId;
}

/** F-09-055: назначение схемы сотруднику с датой начала */
export interface PayrollChartAssignment {
  id: Id;
  chartId: Id;
  staffId: Id;
  /** День, с которого зарплата сотрудника считается по этой схеме */
  startDate: ISODate;
  createdAt: string;
}

/**
 * F-09-055/099: у сотрудника действует назначение с наибольшей startDate ≤ date (F-09-037: смена ставки
 * с 01.10 не меняет сентябрь — расчёт за прошлый период берёт назначение, действовавшее НА ТУ дату).
 */
export function resolveActiveChartAssignment(
  assignments: readonly PayrollChartAssignment[],
  staffId: Id,
  date: ISODate,
): PayrollChartAssignment | undefined {
  const forStaff = assignments.filter(
    (a) => a.staffId === staffId && a.startDate <= date,
  );
  if (forStaff.length === 0) return undefined;
  return forStaff.reduce((best, a) =>
    a.startDate > best.startDate ? a : best,
  );
}

/**
 * F-09-002/054/099: правило классической схемы («Правила расчёта») имеет те же расчётные блоки, что
 * и упрощённая схема сотрудника (F-09-002: «компания с критериями продолжает работать с правилами,
 * критериями и схемами») — приводим его к форме `PayrollScheme`, чтобы движок расчёта (`computeServicesForDay`
 * и весь `computeDay`/`computePeriod`) считал классику ТЕМИ ЖЕ формулами, без отдельной копии логики.
 * `serviceCostBasis` правила (F-09-027) передаётся дальше — движок считает процент с «цена − себестоимость»
 * и тогда не вычитает расходники отдельно (QA 01.10).
 */
export function ruleAsScheme(
  rule: PayrollRule,
  staffId: Id,
  now: string,
): PayrollScheme {
  return {
    staffId,
    personalServices: rule.personalServices,
    productSales: rule.productSales,
    workday: rule.workday,
    records: rule.records,
    extraServiceRevenue: rule.extraServiceRevenue,
    extraProductRevenue: rule.extraProductRevenue,
    serviceCostBasis: rule.serviceCostBasis,
    createdAt: rule.createdAt,
    updatedAt: now,
  };
}

/**
 * F-09-052/054: критерий плановой схемы срабатывает по реальному обороту/количеству сотрудника или
 * филиала за период (месяц/день) — «оборот сотрудника по услугам за месяц > 500 000» при 510 000,
 * не при 490 000. Только `metric: 'turnover'` (сумма цены строк услуг/товаров визита сотрудника за
 * период, с учётом `byServices`/`byProducts`) — `'profit'`/`'count'` не подключены к реальным данным
 * (🔒 qa/requests/payroll.md), считаются невыполненными (не блокирует «стандартное правило» — F-09-054).
 */
export function evaluateCriterionForStaff(
  criterion: PayrollCriterion,
  bookings: readonly Booking[],
  staffId: Id,
  locationId: Id,
  periodFrom: ISODate,
  periodTo: ISODate,
): boolean {
  if (criterion.metric !== "turnover") return false;
  if (criterion.scope === "staff") {
    let turnover = 0;
    for (const b of bookings) {
      if (b.locationId !== locationId || b.deletedAt) continue;
      if (b.status !== "arrived") continue;
      const day = b.start.slice(0, 10);
      if (day < periodFrom || day > periodTo) continue;
      for (const line of b.services) {
        if (line.staffId !== staffId) continue;
        if (!criterion.byServices) continue;
        turnover = roundMoney(turnover + line.price * line.qty);
      }
    }
    return evaluateCriterion(criterion, turnover);
  }
  // 'location' — оборот всего филиала за период, без фильтра по сотруднику
  let turnover = 0;
  for (const b of bookings) {
    if (b.locationId !== locationId || b.deletedAt) continue;
    if (b.status !== "arrived") continue;
    const day = b.start.slice(0, 10);
    if (day < periodFrom || day > periodTo) continue;
    if (!criterion.byServices) continue;
    for (const line of b.services)
      turnover = roundMoney(turnover + line.price * line.qty);
  }
  return evaluateCriterion(criterion, turnover);
}

// ─────────────────────────── b04: пакетная услуга «4 руки» (F-09-108) ───────────────────────────

export type PackageType = "parallel" | "sequentialSame" | "sequentialDifferent";
export type PackagePriceMethod = "sumServices" | "manual" | "discountPercent";

export interface PackageServiceInput {
  id: Id;
  staffId: Id;
  /** Цена этой услуги в прайсе (до правки метода расчёта пакета) */
  price: number;
}

export interface PackageServiceBase {
  serviceId: Id;
  staffId: Id;
  /** База процента ЭТОГО мастера внутри пакета (F-09-108: «с какой цены платить каждому») */
  base: number;
}

/**
 * F-09-108: база процента каждого мастера внутри пакетной услуги («Комплекс», type=New).
 * - sumServices (по умолчанию): база каждого = его цена в пакете, без изменений.
 * - manual: разница между суммой услуг и ценой пакета распределяется между услугами ПРОПОРЦИОНАЛЬНО,
 *   итоговые цены округляются до целых (119203).
 * - discountPercent: скидка в процентах применяется к КАЖДОЙ услуге отдельно.
 */
export function packageServiceStaffBases(
  services: readonly PackageServiceInput[],
  method: PackagePriceMethod,
  options: { manualPrice?: number; discountPct?: number } = {},
): PackageServiceBase[] {
  const sumOfServices =
    roundMoney(services.reduce((s, x) => s + x.price, 0)) || 1;
  if (method === "sumServices") {
    return services.map((s) => ({
      serviceId: s.id,
      staffId: s.staffId,
      base: roundMoney(s.price),
    }));
  }
  if (method === "discountPercent") {
    const pct = options.discountPct ?? 0;
    return services.map((s) => ({
      serviceId: s.id,
      staffId: s.staffId,
      base: Math.round(s.price * (1 - pct / 100)),
    }));
  }
  // 'manual': разница распределяется пропорционально цене каждой услуги, округление до целых
  const manualPrice = options.manualPrice ?? sumOfServices;
  const diff = manualPrice - sumOfServices;
  return services.map((s) => {
    const share = s.price / sumOfServices;
    return {
      serviceId: s.id,
      staffId: s.staffId,
      base: Math.round(s.price + diff * share),
    };
  });
}

// ─────────────────────────── b04: согласование ведомости (F-09-100) ───────────────────────────

export type StatementApprovalStatus =
  "pendingReview" | "reviewed" | "approved" | "sentToStaff" | "signed" | "paid";

export const STATEMENT_APPROVAL_ORDER: StatementApprovalStatus[] = [
  "pendingReview",
  "reviewed",
  "approved",
  "sentToStaff",
  "signed",
  "paid",
];

export interface StatementApproval {
  /** Ключ — id «ведомости» (F-09-067) = id записи взаиморасчётов kind='sheet', finance's SettlementEntry.id */
  sheetId: Id;
  status: StatementApprovalStatus;
  history: { status: StatementApprovalStatus; at: string; by?: Id }[];
}

export function nextApprovalStatus(
  current: StatementApprovalStatus,
): StatementApprovalStatus | undefined {
  const idx = STATEMENT_APPROVAL_ORDER.indexOf(current);
  return idx >= 0 && idx < STATEMENT_APPROVAL_ORDER.length - 1
    ? STATEMENT_APPROVAL_ORDER[idx + 1]
    : undefined;
}

/** F-09-100: «выплачено» отметить нельзя, пока не одобрено владельцем и не подписано сотрудником (если так настроено) */
export function canMarkPaid(
  status: StatementApprovalStatus,
  approvalEnabled: boolean,
): boolean {
  if (!approvalEnabled) return true;
  return status === "signed";
}

// ─────────────────────────── З6: версии схемы («Действует с») ───────────────────────────

/** Схема без своей истории — одна версия */
function stripHistory(scheme: PayrollScheme): PayrollScheme {
  const { history: _history, ...rest } = scheme;
  void _history;
  return rest;
}

/** Все версии схемы от старой к новой (последняя — текущая) */
export function schemeVersions(scheme: PayrollScheme): PayrollScheme[] {
  return [...(scheme.history ?? []), stripHistory(scheme)];
}

/**
 * З6: версия схемы, действующая на дату визита — с наибольшей «Действует с» ≤ date. Дата раньше всех версий —
 * самая старая версия (так схемы, сохранённые до появления «Действует с», считают прошлое как раньше).
 */
export function schemeAtDate(scheme: PayrollScheme, date: ISODate): PayrollScheme {
  if (!scheme.history?.length) return scheme;
  const versions = schemeVersions(scheme);
  let best: PayrollScheme | undefined;
  for (const v of versions) {
    const from = v.effectiveFrom ?? "";
    if (from <= date && (!best || from >= (best.effectiveFrom ?? ""))) best = v;
  }
  return best ?? versions[0];
}

/** Блоки двух версий совпадают (даты и история не в счёт) */
export function schemeBlocksEqual(a: PayrollScheme, b: PayrollScheme): boolean {
  const pick = (s: PayrollScheme) =>
    JSON.stringify([
      s.personalServices,
      s.productSales,
      s.workday,
      s.records,
      s.extraServiceRevenue,
      s.extraProductRevenue,
    ]);
  return pick(a) === pick(b);
}

export type SchemeVersionErrorKey = "overlap" | "closed";

/**
 * З6/З11: сохранить новую версию. Та же дата «Действует с» — правка текущей версии; более поздняя — прежняя
 * уходит в историю; более ранняя, чем у текущей версии, — пересечение (отказ); дата в закрытом периоде при
 * изменённых ставках — отказ (правка задним числом идёт корректировкой в следующий период).
 */
export function applySchemeVersion(
  existing: PayrollScheme | undefined,
  next: PayrollScheme,
  closedThrough?: ISODate,
): { scheme: PayrollScheme } | { error: SchemeVersionErrorKey } {
  const nextVersion = stripHistory(next);
  if (!existing) {
    if (closedThrough && nextVersion.effectiveFrom && nextVersion.effectiveFrom <= closedThrough)
      return { error: "closed" };
    return { scheme: nextVersion };
  }
  const history = existing.history ?? [];
  const changed = !schemeBlocksEqual(existing, nextVersion);
  const from = nextVersion.effectiveFrom ?? existing.effectiveFrom;
  if (changed && closedThrough && (from ?? "") <= closedThrough) return { error: "closed" };
  const prevFrom = history.length ? (history[history.length - 1].effectiveFrom ?? "") : undefined;
  if (!changed || from === existing.effectiveFrom) {
    // Правка текущей версии: дата не может уйти раньше предыдущей версии
    if (prevFrom !== undefined && (from ?? "") <= prevFrom) return { error: "overlap" };
    return { scheme: { ...nextVersion, effectiveFrom: from, history: history.length ? history : undefined } };
  }
  if ((from ?? "") < (existing.effectiveFrom ?? "")) return { error: "overlap" };
  return {
    scheme: { ...nextVersion, effectiveFrom: from, history: [...history, stripHistory(existing)] },
  };
}

// ─────────────────────────── З4: проверка схемы перед сохранением ───────────────────────────

export type SchemeIssueReason =
  | PayoutValueError["reasonKey"]
  | "percentRange"
  | "amountNegative";

export interface SchemeIssue {
  /** Путь поля — совпадает с data-scheme-field у поля формы (для прокрутки к ошибке) */
  field: string;
  reasonKey: NonNullable<SchemeIssueReason>;
}

function checkPercent(value: number | undefined): SchemeIssue["reasonKey"] | undefined {
  const v = value ?? 0;
  if (!Number.isFinite(v)) return "notNumber";
  if (v < 0 || v > MAX_PERCENT) return "percentRange";
  return undefined;
}

function checkAmount(value: number): SchemeIssue["reasonKey"] | undefined {
  if (!Number.isFinite(value)) return "notNumber";
  if (value < 0) return "amountNegative";
  if (value > MAX_AMOUNT) return "amountMax";
  return undefined;
}

/**
 * З4: ставки 0–100%, суммы ≥ 0 — только во включённых блоках (выключенный блок в расчёт не идёт, его поля
 * скрыты и исправить их нельзя). Пустой список — схему можно сохранять.
 */
export function validateScheme(
  scheme: Pick<PayrollScheme, "personalServices" | "productSales" | "workday" | "records" | "extraServiceRevenue" | "extraProductRevenue">,
): SchemeIssue[] {
  const issues: SchemeIssue[] = [];
  const payout = (field: string, v: PayoutValue) => {
    const c = checkPayoutValue(v);
    if (!c.valid && c.reasonKey) issues.push({ field, reasonKey: c.reasonKey });
  };
  const ps = scheme.personalServices;
  if (ps.enabled) {
    payout("personalServices.defaultPayout", ps.defaultPayout);
    ps.overrides.forEach((o, i) => payout(`personalServices.overrides.${i}`, o.payout));
    payout("personalServices.assist.withoutAssistant", ps.assistRates.withoutAssistant);
    if (ps.assistRates.withAssistant) payout("personalServices.assist.withAssistant", ps.assistRates.withAssistant);
    payout("personalServices.assist.asAssistant", ps.assistRates.asAssistant);
    if (ps.loyaltyAdjustment.enabled) payout("personalServices.loyalty.promoPayout", ps.loyaltyAdjustment.promoPayout);
    const cons = checkPercent(ps.demoConsumablesPercent);
    if (cons) issues.push({ field: "personalServices.consumablesPercent", reasonKey: cons });
    if (ps.groupEvents.enabled) {
      if (ps.groupEvents.minPayoutOn) payout("personalServices.group.minPayout", ps.groupEvents.minPayout);
      if (ps.groupEvents.atLeastOneOn) payout("personalServices.group.atLeastOne", ps.groupEvents.atLeastOnePayout);
      if (!Number.isFinite(ps.groupEvents.threshold) || ps.groupEvents.threshold < 0)
        issues.push({ field: "personalServices.group.threshold", reasonKey: "amountNegative" });
    }
  }
  const pr = scheme.productSales;
  if (pr.enabled) {
    payout("productSales.defaultPayout", pr.defaultPayout);
    pr.overrides.forEach((o, i) => payout(`productSales.overrides.${i}`, o.payout));
    const cost = checkPercent(pr.demoCostPercent);
    if (cost) issues.push({ field: "productSales.costPercent", reasonKey: cost });
    if (pr.loyaltyAdjustment.enabled) payout("productSales.loyalty.promoPayout", pr.loyaltyAdjustment.promoPayout);
  }
  const wd = scheme.workday;
  if (wd.enabled) {
    const base = checkAmount(wd.baseAmount);
    if (base) issues.push({ field: "workday.baseAmount", reasonKey: base });
    if (wd.guaranteedMinimum.enabled) {
      const min = checkAmount(wd.guaranteedMinimum.amount);
      if (min) issues.push({ field: "workday.minAmount", reasonKey: min });
    }
  }
  const rec = scheme.records;
  if (rec.enabled) {
    payout("records.perServicePayout", rec.perServicePayout);
    rec.perServiceOverrides.forEach((o, i) => payout(`records.overrides.${i}`, o.payout));
    if (rec.onlineWidgetEnabled) payout("records.onlineWidgetPayout", rec.onlineWidgetPayout);
  }
  for (const [key, block] of [
    ["extraServiceRevenue", scheme.extraServiceRevenue],
    ["extraProductRevenue", scheme.extraProductRevenue],
  ] as const) {
    if (!block.enabled) continue;
    const pct = checkPercent(block.percent);
    if (pct) issues.push({ field: `${key}.percent`, reasonKey: pct });
  }
  return issues;
}

// ─────────────────────────── З12: шаблоны схем ───────────────────────────

export type SchemeTemplateId = "master40" | "master50Min" | "adminSalary" | "trainee";

/** З12: готовые шаблоны — применяются к черновику или сразу к нескольким сотрудникам (с подтверждением) */
export function schemeFromTemplate(templateId: SchemeTemplateId, staffId: Id, now: string): PayrollScheme {
  const s = emptyScheme(staffId, now);
  switch (templateId) {
    case "master40":
      s.personalServices = { ...s.personalServices, enabled: true, defaultPayout: { unit: "percent", value: 40 } };
      break;
    case "master50Min":
      s.personalServices = { ...s.personalServices, enabled: true, defaultPayout: { unit: "percent", value: 50 } };
      s.workday = { ...s.workday, enabled: true, baseAmount: 0, basePeriod: "day", guaranteedMinimum: { enabled: true, amount: 150_000, period: "month" } };
      break;
    case "adminSalary":
      s.workday = { ...s.workday, enabled: true, baseAmount: 200_000, basePeriod: "month" };
      s.records = { ...s.records, enabled: true, perServicePayout: { unit: "percent", value: 3 } };
      break;
    case "trainee":
      s.personalServices = { ...s.personalServices, enabled: true, defaultPayout: { unit: "percent", value: 25 } };
      s.workday = { ...s.workday, enabled: true, baseAmount: 5_000, basePeriod: "day" };
      break;
  }
  return s;
}

export const SCHEME_TEMPLATE_IDS: SchemeTemplateId[] = ["master40", "master50Min", "adminSalary", "trainee"];

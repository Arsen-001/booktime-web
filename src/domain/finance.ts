/**
 * Типы раздела «finance» (Финансы и оплаты). Файл принадлежит разделу.
 * Ссылки на ядро — по id (import type { Id, ISODateTime, Money } from '@/domain/core').
 * Полный обзор раздела — booking-research/functional-map/07-finance-payments.md,
 * наши решения по деньгам — qa/plan/finance.md.
 */
import type { Id, ISODateTime, Money } from '@/domain/core';

// ─────────────────────────── Кассы и счета (F-07-001…006) ───────────────────────────

export type AccountKind = 'cash' | 'card' | 'other';

export interface Account {
  id: Id;
  businessId: Id;
  locationId: Id;
  name: string;
  kind: AccountKind;
  /** Начальный баланс на момент создания кассы; дальше баланс — сумма операций поверх него */
  openingBalance: Money;
  note?: string;
  /** Порядок в списке и в окне оплаты (F-07-005) */
  order: number;
  /** Кассу создала система (например, под онлайн-деньги, F-07-183) — не показывать «Удалить» */
  systemGenerated?: boolean;
  /** Системная касса с особым назначением: 'prepayment' — предоплаты, переведённые на реквизиты мастера (⭐ F-00-097) */
  systemKey?: 'prepayment';
  createdAt: ISODateTime;
}

export type AccountInput = Omit<Account, 'id' | 'businessId' | 'order' | 'createdAt' | 'systemGenerated' | 'systemKey'>;

// ─────────────────────────── Статьи (F-07-007…009) ───────────────────────────

export type FinanceItemKind = 'income' | 'expense';

export interface FinanceItem {
  id: Id;
  businessId: Id;
  name: string;
  kind: FinanceItemKind;
  comment?: string;
  /** Статья по умолчанию (13 штук) — нельзя удалить, можно переименовать */
  system?: boolean;
  /** Строка отчёта о прибылях и убытках (fin-review Ф26) — как «Тип статьи» у Altegio; нет поля — по виду статьи */
  group?: FinanceItemGroup;
  createdAt: ISODateTime;
}

/** Группа статьи для P&L: выручка, себестоимость, коммерческие, персонал, админ.-хоз., налоги, прочие */
export type FinanceItemGroup = 'revenue' | 'costOfSales' | 'commercial' | 'staff' | 'admin' | 'taxes' | 'other';

export const FINANCE_ITEM_GROUPS: Record<FinanceItemKind, FinanceItemGroup[]> = {
  income: ['revenue', 'other'],
  expense: ['costOfSales', 'commercial', 'staff', 'admin', 'taxes', 'other'],
};

/** Группа статьи: заданная или по умолчанию для её вида */
export function financeItemGroup(item: Pick<FinanceItem, 'kind' | 'group'>): FinanceItemGroup {
  if (item.group && FINANCE_ITEM_GROUPS[item.kind].includes(item.group)) return item.group;
  return item.kind === 'income' ? 'revenue' : 'other';
}

export type FinanceItemInput = Pick<FinanceItem, 'name' | 'kind' | 'comment' | 'group'>;

/** Группа P&L системных статей по умолчанию (Ф26) — ставит сид; своя статья выбирает группу в форме */
export const SYSTEM_ITEM_GROUP: Partial<Record<string, FinanceItemGroup>> = {
  materialsPurchase: 'costOfSales',
  goodsPurchase: 'costOfSales',
  staffPayroll: 'staff',
  taxes: 'taxes',
  acquiringFee: 'commercial',
  refund: 'revenue',
  servicePayment: 'revenue',
  membershipSale: 'revenue',
  goodsSale: 'revenue',
  certificateSale: 'revenue',
  otherIncome: 'other',
  otherExpense: 'other',
  accountTopUp: 'other',
  penaltyCharge: 'other',
  depositRetained: 'other',
};

/** Ключи системных статей — на них ссылается движок (оплата визита, комиссия, зарплата…) */
export const SYSTEM_ITEM_KEYS = [
  'materialsPurchase',
  'goodsPurchase',
  'staffPayroll',
  'taxes',
  'servicePayment',
  'membershipSale',
  'goodsSale',
  'otherIncome',
  'otherExpense',
  'accountTopUp',
  'acquiringFee',
  'certificateSale',
  'penaltyCharge',
  /** «Удержанный депозит» (F-07-129) — депозит, оставшийся бизнесу при неявке/поздней отмене (не зачёт в визит) */
  'depositRetained',
  /** «Возврат» (F-07-008, используется F-07-070/072 — возврат со счёта/сертификата без искажения выручки дня продажи) */
  'refund',
] as const;
export type SystemItemKey = (typeof SYSTEM_ITEM_KEYS)[number];

// ─────────────────────────── Контрагенты (F-07-019…023) ───────────────────────────

export type CounterpartyType = 'supplier' | 'company' | 'person' | 'other';

export interface Counterparty {
  id: Id;
  businessId: Id;
  type: CounterpartyType;
  name: string;
  inn?: string;
  phone?: string;
  email?: string;
  contact?: string;
  note?: string;
  /** Владелец 01.10.2026: язык сообщений поставщику (заказ со склада в WhatsApp); пусто / null — язык кабинета */
  messageLang?: 'hy' | 'ru' | 'en' | null;
  createdAt: ISODateTime;
}

export type CounterpartyInput = Omit<Counterparty, 'id' | 'businessId' | 'createdAt'>;

// ─────────────────────────── Операции (F-07-010…018) ───────────────────────────

export type OperationKind = 'income' | 'expense' | 'transfer_out' | 'transfer_in';

export type OperationMethod = 'cash' | 'card' | 'transfer' | 'other';

export type OperationPartyType = 'counterparty' | 'client' | 'staff' | 'none';

/** Откуда взялась операция (F-07-018) — показывается меткой источника в списке */
export type OperationSource = 'manual' | 'booking' | 'transfer' | 'import' | 'sale' | 'payroll' | 'account';

export interface OperationHistoryEntry {
  at: ISODateTime;
  by: string;
  action: 'created' | 'edited' | 'cancelled' | 'imported' | 'refunded';
  field?: string;
  from?: string;
  to?: string;
}

export interface Operation {
  id: Id;
  businessId: Id;
  locationId: Id;
  accountId: Id;
  itemId: Id;
  kind: OperationKind;
  amount: Money;
  /** 'YYYY-MM-DDTHH:mm' — момент операции (может отличаться от createdAt при ручном вводе задним числом) */
  date: ISODateTime;
  method: OperationMethod;
  partyType: OperationPartyType;
  partyId?: Id;
  /** Имя получателя/плательщика на момент операции (переживает удаление контрагента/клиента) */
  partyName?: string;
  comment?: string;
  source: OperationSource;
  /** Ссылка на визит (bookingId) для операций из журнала */
  refId?: Id;
  /** № документа (F-07-011) — есть у оплаты визита/продажи, у ручной операции нет (F-07-012) */
  docNumber?: string;
  /** Колонка «Услуга/Товар» (F-07-011) — что именно оплачено; денормализовано на момент операции */
  lineLabel?: string;
  /** Пара операции перевода между кассами (F-07-006) — у обеих одинаковый transferGroupId */
  transferGroupId?: Id;
  /** Комиссия эквайринга, привязанная к этой операции (F-07-033/034) */
  feeOperationId?: Id;
  /** Эта операция — комиссия другой (F-07-034) */
  feeOfOperationId?: Id;
  cancelled?: boolean;
  cancelledAt?: ISODateTime;
  /**
   * Сколько уже возвращено расходными операциями «Возврат» без отмены исходной продажи (F-07-068/069/071/072,
   * вариант 2 — касса дня продажи не искажается, F-07-072). Не путать с `cancelled` (вариант 1 — полная отмена).
   */
  refundedAmount?: Money;
  createdBy: string;
  createdAt: ISODateTime;
  history: OperationHistoryEntry[];
}

export interface OperationInput {
  locationId: Id;
  accountId: Id;
  itemId: Id;
  kind: Extract<OperationKind, 'income' | 'expense'>;
  amount: Money;
  date: ISODateTime;
  method: OperationMethod;
  partyType: OperationPartyType;
  partyId?: Id;
  partyName?: string;
  comment?: string;
  source?: OperationSource;
  refId?: Id;
  docNumber?: string;
  lineLabel?: string;
}

export interface OperationFilter {
  locationIds?: Id[];
  accountId?: Id;
  itemId?: Id;
  kind?: OperationKind;
  method?: OperationMethod;
  partyType?: OperationPartyType;
  partyId?: Id;
  cancelled?: boolean;
  dateFrom?: ISODateTime;
  dateTo?: ISODateTime;
  search?: string;
}

// ─────────────────────────── Документы (F-07-024) ───────────────────────────

export type DocumentType = 'sale' | 'refund' | 'supply' | 'payment' | 'visit' | 'other';

/** Фильтр «Виды содержимого» (F-07-024) — что в документе: услуги, товары или расходники */
export type DocumentContentKind = 'services' | 'goods' | 'consumables';

export interface FinanceDocument {
  id: Id;
  businessId: Id;
  number: string;
  date: ISODateTime;
  type: DocumentType;
  contentKind?: DocumentContentKind;
  amount: Money;
  refOperationId?: Id;
  refBookingId?: Id;
  note?: string;
  createdAt: ISODateTime;
}

export interface DocumentFilter {
  search?: string;
  type?: DocumentType;
  contentKind?: DocumentContentKind;
  dateFrom?: ISODateTime;
  dateTo?: ISODateTime;
}

// ─────────────────────────── Вычисления (чистые функции, F-07-001/185) ───────────────────────────

/** Знак суммы операции для баланса кассы: доход/приход перевода — плюс, расход/исход перевода — минус */
export function operationSign(kind: OperationKind): 1 | -1 {
  return kind === 'income' || kind === 'transfer_in' ? 1 : -1;
}

/** Баланс кассы: начальный + сумма непогашенных операций (отменённые не считаются) */
export function accountBalance(account: Pick<Account, 'openingBalance'>, ops: Pick<Operation, 'kind' | 'amount' | 'cancelled'>[]): Money {
  return ops.reduce((sum, op) => (op.cancelled ? sum : sum + operationSign(op.kind) * op.amount), account.openingBalance);
}

/**
 * Остаток кассы «после этой операции» (F-07-011, колонка «Остаток в кассе») для каждой операции кассы —
 * принимает операции ОДНОЙ кассы в хронологическом порядке (по возрастанию даты); отменённые остаток не двигают.
 */
export function accountRunningBalances(openingBalance: Money, opsAscending: Pick<Operation, 'id' | 'kind' | 'amount' | 'cancelled'>[]): Map<Id, Money> {
  const map = new Map<Id, Money>();
  let balance = openingBalance;
  for (const op of opsAscending) {
    if (!op.cancelled) balance += operationSign(op.kind) * op.amount;
    map.set(op.id, balance);
  }
  return map;
}

/** Сальдо расчётов с контрагентом: приход контрагенту — плюс салону (контрагент нам должен), расход — минус */
export function counterpartyBalance(ops: Pick<Operation, 'kind' | 'amount' | 'cancelled'>[]): Money {
  return ops.reduce((sum, op) => (op.cancelled ? sum : sum + operationSign(op.kind) * op.amount), 0);
}

/** Округление суммы операции до целого драма (F-07-185: дробей в деньгах у нас нет) */
export function roundToDram(amount: number): Money {
  return Math.round(amount);
}

// ─────────────────────────── Методы оплаты и комиссии (F-07-025…030, 032) ───────────────────────────

/** Выбор кассы наличными: всегда дефолтная / спросить при оплате / наличные недоступны (F-07-026) */
export type CashCashierMode = 'default' | 'choose' | 'disabled';

export interface CashMethodSettings {
  accountId: Id | null;
  cashierMode: CashCashierMode;
}

export interface CardBrandFee {
  brand: 'visa' | 'mastercard' | 'arca';
  feePct: number;
}

export interface CardMethodSettings {
  /** ☐ «Комиссии для различных карт» (F-07-027) */
  perBrand: boolean;
  /** Комиссия за транзакцию, % — используется при !perBrand */
  feePct: number;
  /** Комиссии по брендам — используется при perBrand (F-07-028: для Армении один вид «Банковская карта») */
  brands: CardBrandFee[];
  accountId: Id | null;
  /** «Время обработки платежа», календарные дни (F-07-027) */
  settlementDays: number;
}

export interface InstallmentPlan {
  id: Id;
  months: number;
  feePct: number;
}

export interface InstallmentSettings {
  enabled: boolean;
  plans: InstallmentPlan[];
}

export interface CustomPaymentMethod {
  id: Id;
  name: string;
  feePct: number;
  accountId: Id | null;
  /** «Подключено» — метод виден в оплате визита */
  active: boolean;
}

export type CustomPaymentMethodInput = Pick<CustomPaymentMethod, 'name' | 'feePct' | 'accountId'>;

/** Кто платит комиссию банка в зарплате (F-07-035) — используется разделом «Зарплата» */
export type AcquiringFeeShareMode = 'proportional' | 'staffAndBusiness' | 'staffAndAssistants' | 'staffOnly' | 'business';

export interface PaymentMethodsSettings {
  businessId: Id;
  cash: CashMethodSettings;
  card: CardMethodSettings;
  installment: InstallmentSettings;
  custom: CustomPaymentMethod[];
  /** Касса по умолчанию для мгновенной оплаты в один клик (F-07-032) — равна кассам методов выше */
  feeShare: AcquiringFeeShareMode;
  updatedAt: ISODateTime;
}

export type PaymentMethodsSettingsPatch = Partial<{
  cash: Partial<CashMethodSettings>;
  card: Partial<CardMethodSettings>;
  installment: Partial<InstallmentSettings>;
  feeShare: AcquiringFeeShareMode;
}>;

/** Комиссия банка за оплату картой (F-07-027/028) — по бренду, если включено, иначе общий процент */
export function cardFeePct(card: CardMethodSettings, brand?: CardBrandFee['brand']): number {
  if (card.perBrand && brand) {
    return card.brands.find((b) => b.brand === brand)?.feePct ?? 0;
  }
  return card.feePct;
}

/** Сумма комиссии эквайринга по операции (F-07-033), округлена до драма */
export function calcAcquiringFee(amount: Money, feePct: number): Money {
  if (feePct <= 0) return 0;
  return roundToDram((amount * feePct) / 100);
}

/** Одна «плитка» способа оплаты в окне визита — общий вид для наличных, карты, рассрочки и своих методов */
export interface PaymentMethodTile {
  /** 'cash' | 'card' | 'installment:<planId>' | custom.id */
  key: string;
  kind: 'cash' | 'card' | 'installment' | 'custom';
  label: string;
  accountId: Id | null;
  feePct: number;
  cashierMode?: CashCashierMode;
}

/** Список плиток способов оплаты, доступных в окне визита, из настроек (F-07-025…030) */
export function paymentMethodTiles(settings: PaymentMethodsSettings): PaymentMethodTile[] {
  const tiles: PaymentMethodTile[] = [];
  if (settings.cash.cashierMode !== 'disabled') {
    tiles.push({ key: 'cash', kind: 'cash', label: 'Наличные', accountId: settings.cash.accountId, feePct: 0, cashierMode: settings.cash.cashierMode });
  }
  tiles.push({ key: 'card', kind: 'card', label: 'Банковская карта', accountId: settings.card.accountId, feePct: settings.card.perBrand ? (settings.card.brands[0]?.feePct ?? 0) : settings.card.feePct });
  if (settings.installment.enabled) {
    for (const plan of settings.installment.plans) {
      tiles.push({ key: `installment:${plan.id}`, kind: 'installment', label: `Рассрочка · ${plan.months} мес.`, accountId: settings.card.accountId, feePct: plan.feePct });
    }
  }
  for (const custom of settings.custom) {
    if (custom.active) tiles.push({ key: custom.id, kind: 'custom', label: custom.name, accountId: custom.accountId, feePct: custom.feePct });
  }
  return tiles;
}

// ─────────────────────────── Оплата визита по строкам (F-07-036…050, 181, 184) ───────────────────────────

/** Строка платежа визита — привязана к конкретной услуге/товару визита (F-07-181) либо ко всему визиту (скидка) */
export type BookingPaymentKind = 'money' | 'discount' | 'account';

export interface BookingPaymentLine {
  id: Id;
  businessId: Id;
  bookingId: Id;
  /** Индекс строки визита (booking.services[i]); нет поля — платёж относится ко всему визиту (скидка по акции) */
  serviceIndex?: number;
  kind: BookingPaymentKind;
  /** 'cash' | 'card' | 'installment:<id>' | id своего метода | 'account' */
  methodKey: string;
  methodLabel: string;
  accountId?: Id;
  amount: Money;
  /** Ссылка на финансовую операцию (нет у скидки — она не создаёт денежной операции) */
  operationId?: Id;
  /**
   * Оплата товаров визита (serviceIndex — после услуг). Операции в кассе finance нет: выручку товаров кладёт в кассу
   * документ продажи склада (journal.syncVisitGoodsSale), отмена/возврат этого платежа отменяют тот документ.
   */
  goods?: boolean;
  cancelled?: boolean;
  cancelledAt?: ISODateTime;
  /** Оплата со счёта клиента увела баланс в минус (F-07-062) — красная метка в истории визитов */
  debt?: boolean;
  /**
   * Сколько из этой строки уже вернули клиенту (fin-review Ф7/Ф8). Строка остаётся в силе — визит закрыт и не
   * становится долгом, а деньги ушли из кассы отдельной расходной операцией «Возврат» в день возврата.
   */
  refundedAmount?: Money;
  /** Операции «Возврат» по этой строке — в финансовых операциях они видны отдельными строками */
  refundOperationIds?: Id[];
  /**
   * Один платёж (одно нажатие «Оплатить» одним способом) — один groupId у всех его строк по услугам (fin-review Ф11).
   * В окне и в чеке это одна строка на всю сумму; отмена и возврат действуют на весь платёж.
   */
  groupId?: Id;
  /**
   * Оплата со счёта клиента из раздела «Лояльность» (единый источник счетов, loyalty-review): деньги списаны там
   * (chargeAccount), finance только записывает строку и НЕ трогает свой старый баланс clientAccountBalances.
   */
  loyaltyAccountId?: Id;
  createdAt: ISODateTime;
  createdBy: string;
}

/** Сколько по строке осталось у бизнеса после возвратов */
export function paymentLineNet(line: Pick<BookingPaymentLine, 'amount' | 'refundedAmount'>): Money {
  return roundToDram(Math.max(0, line.amount - (line.refundedAmount ?? 0)));
}

/** Ключ платежа: строки одного нажатия «Оплатить» (старые данные без groupId — по операции, иначе строка сама по себе) */
export function paymentGroupKey(line: Pick<BookingPaymentLine, 'id' | 'groupId' | 'operationId'>): string {
  return line.groupId ?? line.operationId ?? line.id;
}

/** Платёж визита для окна и чека — строки по услугам собраны в одну (fin-review Ф11) */
export interface BookingPaymentGroup {
  key: string;
  /** Любая строка платежа — по ней отменяют и возвращают весь платёж */
  firstLineId: Id;
  kind: BookingPaymentKind;
  methodKey: string;
  methodLabel: string;
  accountId?: Id;
  operationId?: Id;
  amount: Money;
  refunded: Money;
  debt: boolean;
  createdAt: ISODateTime;
  lineIds: Id[];
  /** Счёт лояльности, с которого списали (см. BookingPaymentLine.loyaltyAccountId) */
  loyaltyAccountId?: Id;
}

/** Собирает строки платежей визита в платежи (без отменённых), в порядке оплаты */
export function groupBookingPayments(lines: BookingPaymentLine[]): BookingPaymentGroup[] {
  const groups = new Map<string, BookingPaymentGroup>();
  for (const l of lines) {
    if (l.cancelled) continue;
    const key = paymentGroupKey(l);
    const g = groups.get(key);
    if (g) {
      g.amount = roundToDram(g.amount + l.amount);
      g.refunded = roundToDram(g.refunded + (l.refundedAmount ?? 0));
      g.debt = g.debt || Boolean(l.debt);
      g.lineIds.push(l.id);
    } else {
      groups.set(key, {
        key,
        firstLineId: l.id,
        kind: l.kind,
        methodKey: l.methodKey,
        methodLabel: l.methodLabel,
        accountId: l.accountId,
        operationId: l.operationId,
        amount: l.amount,
        refunded: l.refundedAmount ?? 0,
        debt: Boolean(l.debt),
        createdAt: l.createdAt,
        lineIds: [l.id],
        loyaltyAccountId: l.loyaltyAccountId,
      });
    }
  }
  return [...groups.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** Возврат по визиту: нет / часть денег вернули / вернули всё, что клиент заплатил деньгами и со счёта (Ф7/Ф8) */
export type BookingRefundState = 'none' | 'partial' | 'full';

export function bookingRefundState(lines: Pick<BookingPaymentLine, 'kind' | 'amount' | 'refundedAmount' | 'cancelled'>[]): { refunded: Money; state: BookingRefundState } {
  let paid = 0;
  let refunded = 0;
  for (const l of lines) {
    if (l.cancelled || l.kind === 'discount') continue;
    paid += l.amount;
    refunded += l.refundedAmount ?? 0;
  }
  refunded = roundToDram(refunded);
  if (refunded <= 0) return { refunded: 0, state: 'none' };
  return { refunded, state: refunded >= roundToDram(paid) ? 'full' : 'partial' };
}

/** Лимит минуса на счёте клиента для демо-оплаты в долг (F-07-062) — полные типы счетов и их лимиты строит b03 */
export const CLIENT_ACCOUNT_DEBT_LIMIT: Money = 5000;

/**
 * Часть оплаты визита для правил «К оплате» / статуса / разнесения. Решение владельца 01.10.2026 (одно правило для
 * мока и сервера): оплачено = платежи − возвраты. Частичный возврат делает визит частично оплаченным (к оплате —
 * возвращённая часть), полный — неоплаченным; повторная оплата ложится на ту же услугу.
 */
type PaidPart = Pick<BookingPaymentLine, 'amount' | 'cancelled'> & Partial<Pick<BookingPaymentLine, 'serviceIndex' | 'refundedAmount'>>;
function paidPartNet(p: PaidPart): Money {
  return Math.max(0, p.amount - (p.refundedAmount ?? 0));
}

/** Остаток к оплате по каждой строке визита (F-07-181) — quantity×price минус непогашенные платежи (за вычетом возвратов) */
export function remainingByLine(lineTotals: Money[], payments: PaidPart[]): Money[] {
  const remaining = [...lineTotals];
  for (const p of payments) {
    if (p.cancelled || p.serviceIndex === undefined) continue;
    if (remaining[p.serviceIndex] !== undefined) remaining[p.serviceIndex] = roundToDram(remaining[p.serviceIndex] - paidPartNet(p));
  }
  return remaining;
}

/**
 * Разносит одну сумму по строкам визита по порядку — первая непогашенная строка получает деньги первой,
 * остаток уходит следующей (F-07-181: правило разнесения записано как «по порядку строк», решение по
 * умолчанию до ответа владельца — см. qa/questions/finance.md).
 */
export function allocateAmountToLines(lineTotals: Money[], payments: PaidPart[], amount: Money): { serviceIndex: number; amount: Money }[] {
  const remaining = remainingByLine(lineTotals, payments);
  const result: { serviceIndex: number; amount: Money }[] = [];
  let left = amount;
  for (let i = 0; i < remaining.length && left > 0; i++) {
    if (remaining[i] <= 0) continue;
    const take = Math.min(remaining[i], left);
    result.push({ serviceIndex: i, amount: roundToDram(take) });
    left = roundToDram(left - take);
  }
  return result;
}

/** Сумма визита минус все непогашенные скидки/платежи деньгами и лояльностью (за вычетом возвратов) — «К оплате» (F-07-039/181) */
export function bookingAmountDue(total: Money, payments: PaidPart[]): Money {
  const paid = payments.reduce((sum, p) => (p.cancelled ? sum : sum + paidPartNet(p)), 0);
  return roundToDram(Math.max(0, total - paid));
}

/** Статус оплаты визита из строк платежей (F-07-045) */
export type BookingPaymentStatus = 'unpaid' | 'partial' | 'paid';

export function bookingPaymentStatus(total: Money, payments: PaidPart[]): BookingPaymentStatus {
  const due = bookingAmountDue(total, payments);
  if (due <= 0 && total > 0) return 'paid';
  const paidSoFar = payments.reduce((sum, p) => (p.cancelled ? sum : sum + paidPartNet(p)), 0);
  if (paidSoFar > 0) return 'partial';
  return 'unpaid';
}

// ─────────────────────────── Типы счетов клиентов (F-07-058, кабинет сети) ───────────────────────────

/** Вид личного счёта, на который клиент вносит деньги заранее (депозит) — настраивается в кабинете сети */
export interface AccountType {
  id: Id;
  businessId: Id;
  name: string;
  /** Локации, где счёт этого типа можно открыть и пополнить (F-07-058) */
  locationIds: Id[];
  allowNegative: boolean;
  /** Обязателен при allowNegative — «Оплата в минус» без лимита не сохраняется (F-07-058) */
  negativeLimit: Money;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AccountTypeInput = Pick<AccountType, 'name' | 'locationIds' | 'allowNegative' | 'negativeLimit'>;

/** Валидирует форму типа счёта перед сохранением (F-07-058 «Готово, когда») */
export function validateAccountTypeInput(input: AccountTypeInput): string | undefined {
  if (!input.name.trim()) return 'nameRequired';
  if (input.allowNegative && (!input.negativeLimit || input.negativeLimit <= 0)) return 'negativeLimitRequired';
  return undefined;
}

// ─────────────────────────── Счета клиентов (⭐ демо-минимум для F-07-061/062, полный F-07-058…065 — b03) ───────────────────────────

// ─────────────────────────── Баланс клиента: продано/оплачено (F-07-055…057) ───────────────────────────

export interface ClientMoneySummary {
  /** Стоимость услуг и товаров всех визитов «Клиент пришёл» (F-07-055) */
  sold: Money;
  /** Все непогашенные платежи по этим визитам + ручные приходы («Новый платёж» на клиента) */
  paid: Money;
  /** paid − sold: отрицательный = долг клиента, положительный = переплата (F-07-055) */
  balance: Money;
  visitCount: number;
}

/** «Продано / Оплачено / Баланс» клиента (F-07-055) — из визитов «пришёл» + платежей по ним + ручных операций на клиента */
export function computeClientMoneySummary(
  arrivedBookingTotals: Money[],
  bookingPaymentsAmount: Money,
  manualClientOperations: Pick<Operation, 'kind' | 'amount' | 'cancelled'>[],
): ClientMoneySummary {
  const sold = arrivedBookingTotals.reduce((s, v) => s + v, 0);
  const manual = manualClientOperations.reduce((s, op) => (op.cancelled ? s : s + operationSign(op.kind) * op.amount), 0);
  const paid = roundToDram(bookingPaymentsAmount + manual);
  return { sold: roundToDram(sold), paid, balance: roundToDram(paid - sold), visitCount: arrivedBookingTotals.length };
}

/** Фильтр «Визиты с долгом» (F-07-057) */
export type DebtVisitFilter = 'all' | 'unpaid' | 'accountDebt';

// ─────────────────────────── Штрафы клиентам (F-07-075, F-07-175) ───────────────────────────

/** Сводка видов штрафов клиента (F-07-175) — что легло в таблицу спеки, для карточки клиента */
export interface PenaltyKindInfo {
  key: 'manual' | 'depositPolicy' | 'cardGuarantee' | 'membership';
  labelKey: string;
}
export const PENALTY_KINDS: PenaltyKindInfo[] = [
  { key: 'manual', labelKey: 'penalty.kind.manual' },
  { key: 'depositPolicy', labelKey: 'penalty.kind.depositPolicy' },
  { key: 'cardGuarantee', labelKey: 'penalty.kind.cardGuarantee' },
  { key: 'membership', labelKey: 'penalty.kind.membership' },
];

// ─────────────────────────── Счёт клиента: пополнения и возвраты (F-07-064, F-07-070) ───────────────────────────

export interface ClientAccountTopUp {
  id: Id;
  businessId: Id;
  clientId: Id;
  amount: Money;
  operationId?: Id;
  /** Отменено (F-07-064) — ошибочное или возвращаемое пополнение */
  cancelled?: boolean;
  cancelledAt?: ISODateTime;
  createdAt: ISODateTime;
  createdBy: string;
}

// ─────────────────────────── Взаиморасчёты с сотрудниками (F-07-159…162) ───────────────────────────

export type SettlementEntryKind = 'sheet' | 'bonus' | 'penalty' | 'adjustment' | 'payout';

export interface SettlementEntry {
  id: Id;
  businessId: Id;
  staffId: Id;
  kind: SettlementEntryKind;
  /** Сумма всегда положительная; знак вклада в баланс — settlementEntrySign() */
  amount: Money;
  label: string;
  comment?: string;
  periodFrom?: ISODateTime;
  periodTo?: ISODateTime;
  /** Связанная кассовая операция — только у выплаты (F-07-160) */
  operationId?: Id;
  /**
   * F-09-069: ведомость (`kind: 'sheet'`) созданная как черновик не входит в баланс, пока её не начислили
   * («Сохранить и начислить» / «Сохранить как черновик»). Нет поля → запись всегда была начисленной
   * (обратная совместимость со старыми записями и другими kind, у которых черновика не бывает).
   */
  status?: 'draft' | 'accrued';
  /**
   * Демо-ведомость из сида: сумма считается расчётом зарплаты раздела «Зарплата» при первом чтении (payroll-review З5 —
   * сид не может посчитать схему: срез зарплаты ему недоступен). После пересчёта флаг снимается.
   */
  seedRecalc?: boolean;
  createdAt: ISODateTime;
  createdBy: string;
}

/** Начисление (ведомость/премия/внеочередное) — плюс к балансу; штраф и выплата — минус (F-07-159/161) */
export function settlementEntrySign(kind: SettlementEntryKind): 1 | -1 {
  return kind === 'penalty' || kind === 'payout' ? -1 : 1;
}

/** Баланс взаиморасчётов сотрудника — сколько ещё не выдано (F-07-159); черновик ведомости не считается (F-09-069) */
export function settlementBalance(entries: Pick<SettlementEntry, 'kind' | 'amount' | 'status'>[]): Money {
  return roundToDram(
    entries.reduce((sum, e) => (e.status === 'draft' ? sum : sum + settlementEntrySign(e.kind) * e.amount), 0),
  );
}

// ─────────────────────────── Чеки: настройки, печать, НДС (F-07-147/148/149/150/158) ───────────────────────────

export type ReceiptFormat = 'a4' | 'thermal80' | 'thermal58';

export interface ReceiptRequisiteFlags {
  legalName: boolean;
  legalAddress: boolean;
  actualAddress: boolean;
  inn: boolean;
  kpp: boolean;
  bik: boolean;
  bankName: boolean;
  correspondentAccount: boolean;
  settlementAccount: boolean;
}

export const DEFAULT_RECEIPT_REQUISITES: ReceiptRequisiteFlags = {
  legalName: true,
  legalAddress: true,
  actualAddress: false,
  inn: true,
  kpp: false,
  bik: false,
  bankName: false,
  correspondentAccount: false,
  settlementAccount: false,
};

/** Тип плательщика (F-07-150) — армянский кабинет: «Юридическое лицо» / «Индивидуальный предприниматель» */
export type OrgLegalType = 'legal' | 'individual';

/** Реквизиты организации (F-07-150) — сами значения; какие из них печатать в чеке решают флаги ReceiptRequisiteFlags */
export type OrgRequisiteValues = Record<keyof ReceiptRequisiteFlags, string>;

/**
 * Реквизиты, которых в Армении нет (fin-review Ф4): КПП, БИК и корсчёт — российские. Поля в данных остаются (старые
 * настройки не теряются), но в форме и в чеке не показываются. ИНН в Армении — ՀՎՀՀ.
 */
export const FOREIGN_REQUISITE_KEYS: ReadonlySet<string> = new Set(['kpp', 'bik', 'correspondentAccount']);

export function isArmenianRequisite(key: string): boolean {
  return !FOREIGN_REQUISITE_KEYS.has(key);
}

export const DEFAULT_ORG_REQUISITES: OrgRequisiteValues = {
  legalName: '',
  legalAddress: '',
  actualAddress: '',
  inn: '',
  kpp: '',
  bik: '',
  bankName: '',
  correspondentAccount: '',
  settlementAccount: '',
};

export interface ReceiptSettings {
  businessId: Id;
  format: ReceiptFormat;
  clientName: boolean;
  clientPhone: boolean;
  clientEmail: boolean;
  requisites: ReceiptRequisiteFlags;
  /** F-07-150 */
  orgType: OrgLegalType;
  /** F-07-150 */
  orgRequisites: OrgRequisiteValues;
  taxPerLine: boolean;
  extraInfoEnabled: boolean;
  extraInfoText: string;
  showComment: boolean;
  /** ОАЭ (F-07-158): НДС уже включён в цену, печатать по формуле цена/(100+ставка)×ставка */
  vatIncludedEnabled: boolean;
  vatIncludedPct: number;
  updatedAt: ISODateTime;
}

export type ReceiptSettingsPatch = Partial<Omit<ReceiptSettings, 'businessId' | 'updatedAt' | 'requisites' | 'orgRequisites'>> & {
  requisites?: Partial<ReceiptRequisiteFlags>;
  orgRequisites?: Partial<OrgRequisiteValues>;
};

/** НДС, уже включённый в цену (F-07-158): цена 105, ставка 5% → НДС 5 */
export function vatIncludedInPrice(price: Money, vatPct: number): Money {
  if (vatPct <= 0) return 0;
  return roundToDram((price / (100 + vatPct)) * vatPct);
}

// ─────────────────────────── Права блока «Финансы» (F-07-166…168) ───────────────────────────

/** Глубина просмотра/создания операций назад по времени — одна шкала на несколько прав (F-07-166) */
export type FinanceDepth = 'unlimited' | 'today' | 'd15' | 'm1' | 'm2' | 'm3' | 'm6' | 'none';

export const FINANCE_DEPTH_DAYS: Record<FinanceDepth, number | null> = {
  unlimited: null,
  today: 0,
  d15: 15,
  m1: 30,
  m2: 60,
  m3: 90,
  m6: 180,
  none: -1,
};

/** ⭐ демо-набор прав финансов — компактная версия таблицы из 36 строк (F-07-166), покрывает «Готово когда»
 * этой функции и F-07-167/168; полный список 1:1 — когда появится редактор ролей в staff (см. qa/requests/finance.md). */
export interface FinanceRights {
  /** Доступ ко всем кассам (true) или только к перечисленным в allowedAccountIds (false) */
  allAccounts: boolean;
  allowedAccountIds: Id[];
  /** «Просмотр движений средств» — открывает операции/документы; глубина назад */
  viewDepth: FinanceDepth;
  /** «Создание транзакций» — период назад, когда можно завести платёж */
  createDepth: FinanceDepth;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canViewBalance: boolean;
  canManageCounterparties: boolean;
  canManageItems: boolean;
  canManageKkm: boolean;
  canViewPayrollPeriod: boolean;
  canAccruePayroll: boolean;
  /** Только этого сотрудника — F-07-159 «мастер видит только свои» */
  payrollOwnStaffOnly: boolean;
  // ── F-07-167: окно записи и журнал ──
  canPay: boolean;
  canPayFromAccount: boolean;
  canEditServicePrice: boolean;
  canEditServiceDiscount: boolean;
  canEditArrivedBooking: boolean;
  canDeletePaidBooking: boolean;
  canSeeNetworkClientData: boolean;
  canSeeJournalStats: boolean;
  // ── F-07-168: деньги клиента ──
  canOpenClientAccount: boolean;
  canTopUpClientAccount: boolean;
  canViewClientAccountHistory: boolean;
  canApplyLoyaltyNoCode: boolean;
  canWaivePolicyPenalty: boolean;
}

/** Права по умолчанию у владельца/сети — 34 из 36 включено (F-07-166: две выключены у владельца) */
export const FINANCE_RIGHTS_FULL: FinanceRights = {
  allAccounts: true,
  allowedAccountIds: [],
  viewDepth: 'unlimited',
  createDepth: 'unlimited',
  canEdit: true,
  canDelete: true,
  canExport: true,
  canViewBalance: true,
  canManageCounterparties: true,
  canManageItems: true,
  canManageKkm: true,
  canViewPayrollPeriod: true,
  canAccruePayroll: true,
  payrollOwnStaffOnly: false,
  canPay: true,
  canPayFromAccount: true,
  canEditServicePrice: true,
  canEditServiceDiscount: true,
  canEditArrivedBooking: true,
  canDeletePaidBooking: true,
  canSeeNetworkClientData: false,
  canSeeJournalStats: true,
  canOpenClientAccount: true,
  canTopUpClientAccount: true,
  canViewClientAccountHistory: true,
  canApplyLoyaltyNoCode: true,
  canWaivePolicyPenalty: true,
};

/** Права мастера по умолчанию — свои взаиморасчёты, оплата с телефона, без чужих касс и без удаления оплаченных */
export const FINANCE_RIGHTS_MASTER: FinanceRights = {
  ...FINANCE_RIGHTS_FULL,
  allAccounts: false,
  allowedAccountIds: [],
  viewDepth: 'today',
  createDepth: 'today',
  canEdit: false,
  canDelete: false,
  canExport: false,
  canManageCounterparties: false,
  canManageItems: false,
  canManageKkm: false,
  canAccruePayroll: false,
  payrollOwnStaffOnly: true,
  canDeletePaidBooking: false,
  canWaivePolicyPenalty: false,
};

/** Операция доступна праву по глубине назад от текущего момента (F-07-166: «за какой период назад») */
export function withinDepth(date: ISODateTime, depth: FinanceDepth, now: ISODateTime): boolean {
  const days = FINANCE_DEPTH_DAYS[depth];
  if (days === null) return true;
  if (days < 0) return false;
  const diffMs = new Date(now).getTime() - new Date(date).getTime();
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

// ───────────── b04 — онлайн-платежи, ссылка на оплату и QR, предоплата, фискализация (F-07-076…157) ─────────────
// ⭐ F-00-028: приём денег онлайн отложен, но не снят — эти экраны строятся целиком на моках с видимой
// пометкой «приём денег онлайн пока не подключён»; сейчас реально работает только ручная предоплата
// по реквизитам (F-00-097, карта/Idram мастера — свои способы оплаты F-07-030).

/**
 * Платёжная система для онлайн-приёма (F-07-134/138/140/087). fin-review Ф4: в списке — армянские ArCa (карты через
 * банк-эквайер), Idram и Telcell; интеграций пока нет, это план. Старые ключи-образцы (stripe…pix) остаются в типе,
 * чтобы сохранённые раньше настройки читались, но в выбор больше не попадают.
 */
export type OnlineProviderKey = 'arca' | 'idram' | 'telcell' | 'stripe' | 'vivaWallet' | 'wayForPay' | 'pix';

export interface OnlineProviderInfo {
  key: OnlineProviderKey;
  /** Рынок — чисто информационная подпись */
  country: 'am' | 'global' | 'ua' | 'br';
  /** Можно ли уже подключить — пока нет ни одной интеграции (план) */
  availableHere: boolean;
}

export const ONLINE_PROVIDERS: OnlineProviderInfo[] = [
  { key: 'arca', country: 'am', availableHere: false },
  { key: 'idram', country: 'am', availableHere: false },
  { key: 'telcell', country: 'am', availableHere: false },
];

/** Способ онлайн-приёма денег (F-07-076/077) — платёжная система выбирается на способ, а не глобально */
export type OnlinePaymentWay = 'link' | 'widgetPrepayment' | 'onlineSales';

export interface OnlinePaymentSettings {
  businessId: Id;
  /** Платёжная система, выбранная для способа (F-07-077); комиссия платформы — ноль, комиссия провайдера не вводится руками */
  providerByWay: Record<OnlinePaymentWay, OnlineProviderKey | null>;
  updatedAt: ISODateTime;
}

// ── Ссылка на оплату и QR (F-07-078…083, 156, 183) ──

export type PaymentLinkStatus = 'pending' | 'paid' | 'expired' | 'cancelled';
export type PaymentLinkTargetKind = 'booking' | 'sale';

export interface PaymentLink {
  id: Id;
  businessId: Id;
  targetKind: PaymentLinkTargetKind;
  bookingId?: Id;
  /** Для продажи вне визита (F-07-082) — свободная подпись «Абонемент 5 посещений» и т.п. */
  saleLabel?: string;
  amount: Money;
  /** Остаток к оплате в момент создания ссылки (F-07-081 — частичная оплата по ссылке: сумма < остатка) */
  remainingBefore: Money;
  status: PaymentLinkStatus;
  createdAt: ISODateTime;
  createdBy: Id;
  expiresAt: ISODateTime;
  paidAt?: ISODateTime;
  cancelledAt?: ISODateTime;
  /** Реквизиты, показанные клиенту при создании (снимок настроек — F-07-078) */
  requisitesText: string;
  operationId?: Id;
}

export interface PaymentLinkInput {
  targetKind: PaymentLinkTargetKind;
  bookingId?: Id;
  saleLabel?: string;
  amount: Money;
  remainingBefore: Money;
}

/** Ссылка «живая» (можно платить), если она ждёт оплаты и время ожидания не вышло (F-07-080) */
export function paymentLinkIsLive(link: PaymentLink, now: ISODateTime): boolean {
  if (link.status !== 'pending') return false;
  return new Date(link.expiresAt).getTime() > new Date(now).getTime();
}

/** Статус ссылки с учётом истечения времени — вычисляется при чтении, не мутирует хранилище (F-07-080) */
export function effectivePaymentLinkStatus(link: PaymentLink, now: ISODateTime): PaymentLinkStatus {
  if (link.status === 'pending' && new Date(link.expiresAt).getTime() <= new Date(now).getTime()) return 'expired';
  return link.status;
}

// ── Онлайн-продажи «Другим способом»: заказы вручную (F-07-132) и их возврат (F-07-073) ──

export type ManualOnlineOrderKind = 'membership' | 'certificate';
export type ManualOnlineOrderStatus = 'pendingPayment' | 'paid' | 'rejected' | 'refunded';

/** Заказ абонемента/сертификата в виджете продаж без платёжной системы — клиент платит переводом по
 *  реквизитам, администратор подтверждает вручную (F-07-132). «Оплачено» создаёт продажу (F-07-052);
 *  возврат (F-07-073) удаляет её операции, деньги клиенту возвращают вручную вне системы. */
export interface ManualOnlineOrder {
  id: Id;
  businessId: Id;
  locationId: Id;
  kind: ManualOnlineOrderKind;
  typeName: string;
  amount: Money;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  status: ManualOnlineOrderStatus;
  createdAt: ISODateTime;
  decidedAt?: ISODateTime;
  decidedBy?: string;
  operationId?: Id;
  code?: string;
}

// ── Уведомления об онлайн-оплате (F-07-084 · тип 85, F-07-085 · тип 65, F-07-086 · QR) ──

/** Демо-минимум: раздел «Уведомления» — не наш путь, поэтому здесь только состояние трёх типов,
 *  завязанных на деньги, и текст предпросмотра с переменными — используется на страницах онлайн-оплаты. */
export interface PaymentNotificationsSettings {
  businessId: Id;
  /** F-07-084 · тип 85 «Клиенту со ссылкой на оплату» — включён по умолчанию в армянском кабинете */
  linkToPayEnabled: boolean;
  /** F-07-085 · тип 65 «Клиенту об успешной онлайн-оплате» — Email нельзя, только push из приложения */
  successPaidEnabled: boolean;
  /** F-07-086 «Сотруднику об оплате по QR» — веб-версия кабинета */
  staffQrPaidEnabled: boolean;
  updatedAt: ISODateTime;
}

export const DEFAULT_PAYMENT_NOTIFICATIONS: Omit<PaymentNotificationsSettings, 'businessId' | 'updatedAt'> = {
  linkToPayEnabled: true,
  successPaidEnabled: false,
  staffQrPaidEnabled: true,
};

export interface OnlineLinkSettings {
  businessId: Id;
  /** Текст реквизитов для ручной предоплаты (карта / Idram мастера, F-00-097) — показывается в ссылке и QR */
  requisitesText: string;
  /** Сколько минут ссылка ждёт оплату, прежде чем истечь (F-07-093 — общее время ожидания оплаты) */
  waitMinutes: number;
  /** «QR на кассу» включён (F-07-083) — статический QR с реквизитами, не привязан к записи */
  staticQrEnabled: boolean;
  updatedAt: ISODateTime;
}

// ── Предоплата в виджете (F-07-088…098) ──

export type PrepaymentMode = 'off' | 'optional' | 'required';
export type PrepaymentAmountType = 'percent' | 'fixed';

export interface PrepaymentSettings {
  businessId: Id;
  mode: PrepaymentMode;
  amountType: PrepaymentAmountType;
  amountValue: number;
  /** Минуты ожидания оплаты в окне «ждёт предоплату» (⭐ F-00-097) */
  waitMinutes: number;
  /** Обязательная предоплата — по услугам (пусто + requiredAllServices=false ⇒ ни одна) (F-07-089) */
  requiredServiceIds: Id[];
  requiredAllServices: boolean;
  /** Обязательная предоплата — по сотрудникам (F-07-090) */
  requiredStaffIds: Id[];
  updatedAt: ISODateTime;
}

/** Настройка предоплаты у конкретного мастера — переопределяет общую (F-07-095, ⭐ по желанию мастера F-00-066) */
export interface StaffPrepayment {
  staffId: Id;
  enabled: boolean;
  amountType: PrepaymentAmountType;
  amountValue: number;
}

/** Размер предоплаты у конкретной услуги — переопределяет общий % / сумму, когда услуга в обязательном списке
 * (F-07-094: «у каждой услуги — размер предоплаты: % или фиксированная сумма»). Нет записи ⇒ действует общая
 * настройка (`PrepaymentSettings.amountType`/`amountValue`). */
export interface ServicePrepayment {
  serviceId: Id;
  amountType: PrepaymentAmountType;
  amountValue: number;
}

export interface PrepaymentCalcInput {
  serviceIds: Id[];
  staffId?: Id;
  anyStaff?: boolean;
  /** Цены услуг для расчёта суммы «от минимальной цены» (F-07-092) */
  servicePrices: Record<Id, Money>;
  /** Пакет из нескольких услуг/визитов или групповая запись — предоплата только 100% (F-07-097) */
  isPackageOrGroup?: boolean;
  /** Переопределения суммы по услуге (F-07-094) — serviceId → % / сумма своя для этой услуги */
  servicePrepayment?: Record<Id, Pick<ServicePrepayment, 'amountType' | 'amountValue'>>;
}

export interface PrepaymentCalcResult {
  required: boolean;
  /** Предоплата доступна, но необязательна (F-07-091) */
  optional: boolean;
  amount: Money;
  waitMinutes: number;
}

/** Приоритет настроек предоплаты и расчёт суммы (F-07-092): мастер (если включена и не запрещена ограничением)
 * важнее общей настройки услуг; сумма — по минимальной цене выбранных услуг; F-07-097 — пакет/несколько
 * событий/групповая запись и предоплата у мастера считаются только как 100%. */
export function calcPrepayment(
  general: PrepaymentSettings,
  staffOverride: StaffPrepayment | undefined,
  input: PrepaymentCalcInput
): PrepaymentCalcResult {
  const total = input.serviceIds.reduce((sum, id) => sum + (input.servicePrices[id] ?? 0), 0);
  const forcedFull = Boolean(input.isPackageOrGroup) || Boolean(staffOverride?.enabled);

  if (staffOverride?.enabled) {
    const amount = forcedFull ? total : calcPrepaymentAmount(total, staffOverride.amountType, staffOverride.amountValue);
    return { required: true, optional: false, amount: roundToDram(amount), waitMinutes: general.waitMinutes };
  }

  const requiredByService = general.requiredAllServices || input.serviceIds.some((id) => general.requiredServiceIds.includes(id));
  const requiredByStaff = Boolean(input.staffId) && general.requiredStaffIds.includes(input.staffId as Id);

  if (general.mode === 'required' && requiredByService) {
    // F-07-094: у обязательной по услугам каждая услуга может иметь свой % / сумму — считаем по её цене,
    // не по сумме всех выбранных услуг, иначе своя настройка одной услуги влияла бы на чужую.
    const amount = forcedFull
      ? total
      : input.serviceIds.reduce((sum, id) => {
          const price = input.servicePrices[id] ?? 0;
          const override = input.servicePrepayment?.[id];
          const type = override?.amountType ?? general.amountType;
          const value = override?.amountValue ?? general.amountValue;
          return sum + calcPrepaymentAmount(price, type, value);
        }, 0);
    return { required: true, optional: false, amount: roundToDram(amount), waitMinutes: general.waitMinutes };
  }

  if (general.mode === 'required' && requiredByStaff) {
    const amount = forcedFull ? total : calcPrepaymentAmount(total, general.amountType, general.amountValue);
    return { required: true, optional: false, amount: roundToDram(amount), waitMinutes: general.waitMinutes };
  }

  if (general.mode !== 'off') {
    const amount = forcedFull ? total : calcPrepaymentAmount(total, general.amountType, general.amountValue);
    return { required: false, optional: true, amount: roundToDram(amount), waitMinutes: general.waitMinutes };
  }

  return { required: false, optional: false, amount: 0, waitMinutes: general.waitMinutes };
}

function calcPrepaymentAmount(total: Money, type: PrepaymentAmountType, value: number): number {
  if (type === 'fixed') return Math.min(value, total);
  return (total * value) / 100;
}

// ── Категории записи «Полная/Частичная онлайн-оплата» (F-07-098) — системные, не удаляются ──

export type BookingOnlineCategory = 'onlineFull' | 'onlinePartial';

export const BOOKING_ONLINE_CATEGORIES: { key: BookingOnlineCategory; color: string }[] = [
  { key: 'onlineFull', color: '#16a34a' }, // tokens-ok — цвет категории записи — данные справочника (как цвет категории)
  { key: 'onlinePartial', color: '#d97706' }, // tokens-ok — цвет категории записи — данные справочника (как цвет категории)
];

// ── Фискализация стран — образцы 1:1, для Армении недоступны (F-07-152…157) ──

export interface FiscalUkraineSettings {
  proRroConnected: boolean;
  cashierName: string;
  /** Один чек при оплате картой или два — сначала эквайринговый, потом фискальный (F-07-154) */
  cardReceiptMode: 'single' | 'double';
}

export interface FiscalHungarySettings {
  billingoConnected: boolean;
}

export interface FiscalBrazilSettings {
  notaFiscalConnected: boolean;
}

/**
 * Армения — фискальный чек ՀԴՄ (e-HDM) (fin-review Ф4). Интеграции с кассовым аппаратом/e-HDM у нас нет — это план;
 * пока храним только то, что помогает кассиру: напоминание пробить чек на своём аппарате и его регистрационный номер.
 * Требования закона не проверялись — в интерфейсе нейтрально, «уточните у бухгалтера».
 */
export interface FiscalArmeniaSettings {
  remindToPrint: boolean;
  /** Регистрационный номер ՀԴՄ / e-HDM салона — как у налоговой, для сверки */
  hdmRegNumber: string;
}

export interface FiscalSettings {
  businessId: Id;
  /** Нет поля — старые данные: по умолчанию напоминания нет */
  armenia?: FiscalArmeniaSettings;
  ukraine: FiscalUkraineSettings;
  hungary: FiscalHungarySettings;
  brazil: FiscalBrazilSettings;
  updatedAt: ISODateTime;
}

// ─────────────────────────── b05 — политика оплаты: депозит, гарантия картой (F-07-101…130) ───────────────────────────
// ⭐ F-00-028: приём денег онлайн отложен, но не снят — весь блок строится на моках с пометкой «демо».

export type PaymentPolicyMode = 'none' | 'deposit' | 'cardGuarantee';
export type PolicyAmountMode = 'percent' | 'fixed';

export interface PolicyAmount {
  mode: PolicyAmountMode;
  /** percent: 0..100; fixed: драмы. Ноль запрещён валидацией на сохранении (F-07-102). */
  value: number;
}

export interface PaymentPolicyDepositSettings {
  /** Сколько держится предварительная запись, пока клиент платит в виджете, минут (F-07-102) */
  paymentDeadlineMin: number;
  amount: PolicyAmount;
  /** «Credit the deposit to the client balance when booking is cancelled» — выкл. по умолчанию (F-07-103) */
  creditDepositOnCancel: boolean;
  /** «Free cancellation window», 1..72 часов — виден и хранится только при creditDepositOnCancel (F-07-103) */
  freeCancellationWindowHours: number;
  /** «Allow receptionist not to charge and credit deposit to client balance in case of no-show or late cancellation» */
  allowReceptionistNotCharge: boolean;
  /** Штраф за неявку выше депозита — только при подключённом Adyen; без него штраф всегда равен депозиту */
  noShowFeeAboveDeposit?: Money;
}

export interface PaymentPolicyCardGuaranteeSettings {
  deadlineMin: number;
  chargeLateCancellationFee: boolean;
  lateCancellationFee: PolicyAmount;
  allowFreeCancellation: boolean;
  freeCancellationWindowHours: number;
  chargeNoShowFee: boolean;
  noShowFee: PolicyAmount;
  allowReceptionistNotCharge: boolean;
}

export const DEFAULT_POLICY_DEPOSIT: PaymentPolicyDepositSettings = {
  paymentDeadlineMin: 15,
  amount: { mode: 'percent', value: 20 },
  creditDepositOnCancel: false,
  freeCancellationWindowHours: 24,
  allowReceptionistNotCharge: true,
};

export const DEFAULT_POLICY_CARD_GUARANTEE: PaymentPolicyCardGuaranteeSettings = {
  deadlineMin: 15,
  chargeLateCancellationFee: true,
  lateCancellationFee: { mode: 'percent', value: 50 },
  allowFreeCancellation: true,
  freeCancellationWindowHours: 24,
  chargeNoShowFee: true,
  noShowFee: { mode: 'percent', value: 100 },
  allowReceptionistNotCharge: true,
};

export type PolicyClientScope = 'all' | 'new' | 'existing';

export interface PaymentPolicyConditions {
  /** Охват услуг — все, кроме этих (F-07-105); бесплатные услуги исключены логикой, не списком */
  excludedServiceIds: Id[];
  /** Охват сотрудников — все активные, кроме этих (F-07-107) */
  excludedStaffIds: Id[];
  clientScope: PolicyClientScope;
  /** «Apply the default policy to clients with outstanding balances» (F-07-108) */
  applyToDebtors: boolean;
  minVisitAmountEnabled: boolean;
  minVisitAmount: Money;
  /** F-07-099: клиент сам может отменить/перенести запись, за которую уже внёс депозит или привязал карту.
   *  Выключено — отмену/перенос предоплаченной записи делает только администратор. */
  allowClientSelfCancelPrepaid: boolean;
  allowClientSelfReschedulePrepaid: boolean;
}

export const DEFAULT_POLICY_CONDITIONS: PaymentPolicyConditions = {
  excludedServiceIds: [],
  excludedStaffIds: [],
  clientScope: 'all',
  applyToDebtors: false,
  minVisitAmountEnabled: false,
  minVisitAmount: 0,
  allowClientSelfCancelPrepaid: true,
  allowClientSelfReschedulePrepaid: true,
};

/** Своя политика услуги — переопределяет общую (F-07-106); отсутствие записи = живёт по общим правилам */
export interface PaymentPolicyServiceOverride {
  serviceId: Id;
  mode: Extract<PaymentPolicyMode, 'deposit' | 'cardGuarantee'>;
  deposit?: PaymentPolicyDepositSettings;
  cardGuarantee?: PaymentPolicyCardGuaranteeSettings;
}

/** Снимок для карточки «Activated» (F-07-110) — фиксируется при каждом Save, числа как их увидит клиент */
export interface PaymentPolicySnapshotCard {
  mode: PaymentPolicyMode;
  depositAmountLabel?: string;
  noShowFeeLabel?: string;
  lateCancellationFeeLabel?: string;
  freeCancellationWindowHours?: number;
  minVisitAmount?: number;
  deadlineMin?: number;
  clientScope: PolicyClientScope;
  savedAt: ISODateTime;
}

export interface PaymentPolicy {
  businessId: Id;
  mode: PaymentPolicyMode;
  deposit: PaymentPolicyDepositSettings;
  cardGuarantee: PaymentPolicyCardGuaranteeSettings;
  conditions: PaymentPolicyConditions;
  /** Момент последнего Save с режимом ≠ none — политика действует только на записи, созданные после (F-07-101/110) */
  activatedAt?: ISODateTime;
  lastSnapshot?: PaymentPolicySnapshotCard;
  updatedAt: ISODateTime;
}

export function defaultPaymentPolicy(businessId: Id, updatedAt: ISODateTime): PaymentPolicy {
  return {
    businessId,
    mode: 'none',
    deposit: { ...DEFAULT_POLICY_DEPOSIT },
    cardGuarantee: { ...DEFAULT_POLICY_CARD_GUARANTEE },
    conditions: { ...DEFAULT_POLICY_CONDITIONS },
    updatedAt,
  };
}

/** Сумма депозита или штрафа числом — клиенту всегда показывается сумма, не процент (F-07-102/124) */
export function policyAmountValue(amount: PolicyAmount, visitTotal: Money): Money {
  return amount.mode === 'percent' ? roundToDram((visitTotal * amount.value) / 100) : roundToDram(amount.value);
}

/** Штраф за неявку без Adyen = депозит; с Adyen может быть выше (F-07-102/113/118) */
export function policyNoShowFee(deposit: PaymentPolicyDepositSettings, visitTotal: Money, adyenConnected: boolean): Money {
  const base = policyAmountValue(deposit.amount, visitTotal);
  if (!adyenConnected || deposit.noShowFeeAboveDeposit === undefined) return base;
  return Math.max(base, roundToDram(deposit.noShowFeeAboveDeposit));
}

/** Контекст для проверки охвата политики одной записью (F-07-105…109, 126) */
export interface PolicyApplicabilityContext {
  serviceIds: Id[];
  freeServiceIds: Id[];
  staffId?: Id;
  isNewClient: boolean;
  isDebtor: boolean;
  hasActiveMembershipForService: boolean;
  visitTotal: Money;
}

/** true — записи нужен депозит/карта; false — один из случаев F-07-126 (без списка полей, каждый — отдельная причина) */
export function policyApplies(policy: PaymentPolicy, conditions: PaymentPolicyConditions, ctx: PolicyApplicabilityContext): boolean {
  if (policy.mode === 'none') return false;
  if (ctx.hasActiveMembershipForService) return false; // действующий абонемент главнее
  if (conditions.minVisitAmountEnabled && ctx.visitTotal < conditions.minVisitAmount) return false;
  const payableServices = ctx.serviceIds.filter((id) => !ctx.freeServiceIds.includes(id));
  if (payableServices.length === 0) return false; // цена 0 — вне охвата сама
  const inScope = payableServices.some((id) => !conditions.excludedServiceIds.includes(id));
  if (!inScope) return false;
  if (ctx.staffId && conditions.excludedStaffIds.includes(ctx.staffId)) return false;
  if (conditions.applyToDebtors && ctx.isDebtor) return true; // должник — политика всегда, тип клиента не важен
  if (conditions.clientScope === 'new' && !ctx.isNewClient) return false;
  if (conditions.clientScope === 'existing' && ctx.isNewClient) return false;
  return true;
}

// ─────────────────────────── Счёт клиента «Payment Policy» (F-07-112, F-07-113, F-07-122, F-07-129) ───────────────────────────

export type PolicyAccountEntryKind = 'topUp' | 'holdRelease' | 'holdConfirm' | 'feeCharge';

export const POLICY_ACCOUNT_ENTRY_KINDS: PolicyAccountEntryKind[] = ['topUp', 'holdRelease', 'holdConfirm', 'feeCharge'];

export interface PolicyAccountEntry {
  id: Id;
  businessId: Id;
  clientId: Id;
  kind: PolicyAccountEntryKind;
  /** Подписанная сумма: topUp/holdRelease растят Balance, holdConfirm/feeCharge — списывают (уже с минусом) */
  amount: Money;
  balanceAfter: Money;
  inHoldAfter: Money;
  /** Откуда движение: 'widget' | 'checkout' | 'noShow' | 'lateCancel' | 'manual' */
  source: string;
  bookingId?: Id;
  createdAt: ISODateTime;
  createdBy: string;
}

export interface PolicyAccountSummary {
  balance: Money;
  inHold: Money;
  available: Money;
  topUps: Money;
  debits: Money;
  fees: Money;
}

/** Счёт «только для чтения», может уходить в минус без лимита (F-07-112) */
export function computePolicyAccountSummary(entries: PolicyAccountEntry[]): PolicyAccountSummary {
  let balance = 0;
  let inHold = 0;
  let topUps = 0;
  let debits = 0;
  let fees = 0;
  for (const e of entries) {
    balance = roundToDram(balance + e.amount);
    if (e.kind === 'topUp') {
      inHold = roundToDram(inHold + e.amount);
      topUps = roundToDram(topUps + e.amount);
    } else if (e.kind === 'holdRelease') {
      inHold = roundToDram(inHold - Math.abs(e.amount));
    } else if (e.kind === 'holdConfirm') {
      inHold = roundToDram(inHold - Math.abs(e.amount));
      debits = roundToDram(debits + Math.abs(e.amount));
    } else if (e.kind === 'feeCharge') {
      fees = roundToDram(fees + Math.abs(e.amount));
    }
  }
  inHold = Math.max(0, inHold);
  return { balance, inHold, available: roundToDram(balance - inHold), topUps, debits, fees };
}

/** Должник (F-07-123) — метка нигде не видна, влияет только на policyApplies при applyToDebtors */
export function isPolicyDebtor(summary: PolicyAccountSummary, otherAccountsBalance: Money): boolean {
  return roundToDram(summary.balance + otherAccountsBalance) < 0;
}

// ─────────────────────────── Снимок политики на записи (F-07-113, F-07-114, F-07-117…122) ───────────────────────────

/**
 * Статусы политики записи (F-07-113/121, названия — по 360423): clientAccepted (Reserved/Held until decision —
 * деньги удержаны, решение не принято) → confirmedAtCheckout (депозит зачтён в оплату визита) | creditedToBalance
 * (депозит остался на балансе клиента) | appliedCharged (штраф/депозит взят бизнесу — Applied/Charged) |
 * appliedWaived (штраф прощён — Waived) | expired (не оплатил/не привязал карту в срок, запись снята).
 */
export type BookingPolicyStatus = 'clientAccepted' | 'confirmedAtCheckout' | 'creditedToBalance' | 'appliedCharged' | 'appliedWaived' | 'expired';

export interface BookingPolicySnapshot {
  bookingId: Id;
  businessId: Id;
  clientId: Id;
  mode: Extract<PaymentPolicyMode, 'deposit' | 'cardGuarantee'>;
  depositAmount?: Money;
  lateCancellationFee?: Money;
  noShowFee?: Money;
  freeCancellationWindowHours: number;
  freeCancellationDeadline: ISODateTime;
  allowReceptionistNotCharge: boolean;
  status: BookingPolicyStatus;
  decidedAt?: ISODateTime;
  decidedBy?: string;
  chargedAmount?: Money;
  createdAt: ISODateTime;
}

/** Крайний срок бесплатной отмены = начало визита минус длина окна (F-07-114/360423) */
export function policyFreeCancellationDeadline(bookingStart: ISODateTime, windowHours: number): ISODateTime {
  return new Date(new Date(bookingStart).getTime() - windowHours * 60 * 60 * 1000).toISOString();
}

// ─────────────────────────── Adyen (F-07-104, F-07-135…137) ───────────────────────────

export type AdyenStatus = 'notConnected' | 'onboarding' | 'connected';

export interface AdyenConnection {
  businessId: Id;
  status: AdyenStatus;
  legalEntityName?: string;
  country?: string;
  shopperStatement?: string;
  onboardingStartedAt?: ISODateTime;
  /** Даётся 1 час на онбординг (F-07-135) */
  onboardingDeadline?: ISODateTime;
  connectedAt?: ISODateTime;
}

export type AdyenTxnType = 'payment' | 'refund' | 'transfer' | 'chargeback' | 'correction' | 'atm' | 'capital' | 'other';

export interface AdyenTransaction {
  id: Id;
  businessId: Id;
  date: ISODateTime;
  method: string;
  type: AdyenTxnType;
  /** После комиссии Adyen */
  netAmount: Money;
  /** Списано с клиента */
  grossAmount: Money;
  pspReference: string;
  refunded?: boolean;
}

// ─────────────────────────── Порядок операций кассы (fin-review Ф18) ───────────────────────────

/**
 * Один порядок операций для остатка и для списка: по времени; при одинаковом времени — сначала приход, потом его
 * комиссия (иначе остаток на миг уходит в минус), затем по моменту создания и id. Список показывает обратный порядок.
 */
export function compareOperationsAsc(
  a: Pick<Operation, 'id' | 'date' | 'createdAt' | 'feeOfOperationId' | 'kind'>,
  b: Pick<Operation, 'id' | 'date' | 'createdAt' | 'feeOfOperationId' | 'kind'>,
): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.feeOfOperationId === b.id) return 1;
  if (b.feeOfOperationId === a.id) return -1;
  const rank = (op: Pick<Operation, 'kind' | 'feeOfOperationId'>) => (op.feeOfOperationId ? 2 : op.kind === 'income' || op.kind === 'transfer_in' ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ─────────────────────────── Кассовая смена и Z-отчёт (fin-review Ф1) ───────────────────────────

export type CashShiftStatus = 'open' | 'closed';

/** Смена наличной кассы: открыли с разменом, закрыли с пересчётом ящика; расхождение — операцией-поправкой */
export interface CashShift {
  id: Id;
  businessId: Id;
  accountId: Id;
  status: CashShiftStatus;
  openedAt: ISODateTime;
  openedBy: string;
  /** Сколько наличных в ящике на открытии — пересчитал кассир */
  openingCash: Money;
  /** Остаток кассы по учёту на момент открытия */
  expectedAtOpen: Money;
  closedAt?: ISODateTime;
  closedBy?: string;
  /** Сколько насчитали в ящике на закрытии */
  countedCash?: Money;
  /** Сколько должно быть по учёту на закрытии (до поправки) */
  expectedAtClose?: Money;
  /** Поправки на расхождение при открытии и закрытии (недостача — расход, излишек — приход) */
  adjustmentOperationIds?: Id[];
  comment?: string;
}

export interface ZReport {
  openingBalance: Money;
  income: Money;
  expense: Money;
  refunds: Money;
  transfersIn: Money;
  transfersOut: Money;
  /** Приход по способам оплаты */
  incomeByMethod: Record<OperationMethod, Money>;
  operationsCount: number;
  /** Должно быть в кассе: остаток на открытии + приход − расход ± переводы */
  expected: Money;
}

/** Z-отчёт смены: операции кассы за смену (без отменённых), остаток на открытии, id статьи «Возврат» */
export function buildZReport(openingBalance: Money, ops: Pick<Operation, 'kind' | 'amount' | 'cancelled' | 'method' | 'itemId'>[], refundItemId?: Id): ZReport {
  const report: ZReport = {
    openingBalance,
    income: 0,
    expense: 0,
    refunds: 0,
    transfersIn: 0,
    transfersOut: 0,
    incomeByMethod: { cash: 0, card: 0, transfer: 0, other: 0 },
    operationsCount: 0,
    expected: openingBalance,
  };
  for (const op of ops) {
    if (op.cancelled) continue;
    report.operationsCount += 1;
    if (op.kind === 'income') {
      report.income += op.amount;
      report.incomeByMethod[op.method] += op.amount;
    } else if (op.kind === 'expense') {
      report.expense += op.amount;
      if (refundItemId && op.itemId === refundItemId) report.refunds += op.amount;
    } else if (op.kind === 'transfer_in') report.transfersIn += op.amount;
    else report.transfersOut += op.amount;
  }
  report.expected = roundToDram(openingBalance + report.income - report.expense + report.transfersIn - report.transfersOut);
  return report;
}

/** Расхождение ящика с учётом: плюс — излишек, минус — недостача */
export function cashDiscrepancy(counted: Money, expected: Money): Money {
  return roundToDram(counted - expected);
}

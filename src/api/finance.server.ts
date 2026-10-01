'use client';

/**
 * «Финансы и касса» на настоящем сервере (docs/backend/PLAN.md этап 12, `02-api.md` §12). Покрывает ровно то,
 * что стоит в таблице §12 — кассы, статьи, методы оплаты (упрощённо, без брендов карт/рассрочки/долевой
 * комиссии), контрагенты, документы, операции, возвраты/штрафы, отчёты и денежная (kind='money') часть оплаты
 * визита. Всё остальное 2986-строчного `src/api/finance.ts` (Adyen, платёжные ссылки, депозит/гарантия картой,
 * реквизиты чека/ОФД, взаиморасчёты с сотрудниками) явно не строится этим этапом (02-api.md §12: «Онлайн-платежи
 * клиентов, политика оплаты… чаевые — не строим сейчас») или ждёт раздела «Зарплата» (этап 14) — остаётся на
 * моке, см. PROGRESS.md этапа 12.
 *
 * Путь оплаты визита — `/finance/bookings/:id/payments`, НЕ буквальный `/bookings/:id/payments` из 02-api.md:
 * тот путь уже занят стопгапом этапа 7 (`payLines`/`instantPay` в journal.server.ts, экран `PaymentSheet.tsx`) —
 * см. PROGRESS.md этапа 12, «решено по ходу».
 */
import * as ClientsServer from '@/api/clients/clients.server';
import { currentActor } from '@/api/core';
import { getBooking } from '@/api/journal.server';
import { http } from '@/api/http';
import { ApiError } from '@/api/request';
import * as ServicesServer from '@/api/services.server';
import * as StaffServer from '@/api/staff.server';
import { dayjs, nowDateTime, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import {
  calcPrepayment as calcPrepaymentPure,
  computeClientMoneySummary,
  computePolicyAccountSummary,
  DEFAULT_ORG_REQUISITES,
  isPolicyDebtor,
  policyAmountValue,
  policyApplies,
  policyNoShowFee,
  type BookingOnlineCategory,
  DEFAULT_PAYMENT_NOTIFICATIONS,
  DEFAULT_RECEIPT_REQUISITES,
  defaultPaymentPolicy,
  effectivePaymentLinkStatus,
  FINANCE_RIGHTS_FULL,
  policyFreeCancellationDeadline,
  roundToDram,
  validateAccountTypeInput,
  vatIncludedInPrice,
  type AccountType,
  type AccountTypeInput,
  type AdyenConnection,
  type AdyenTransaction,
  type BookingPolicySnapshot,
  type BookingPolicyStatus,
  type ClientAccountTopUp,
  type ClientMoneySummary,
  type CustomPaymentMethodInput,
  type DebtVisitFilter,
  type FinanceRights,
  type FiscalSettings,
  type ManualOnlineOrder,
  type OnlineLinkSettings,
  type OnlinePaymentSettings,
  type OnlinePaymentWay,
  type OnlineProviderKey,
  type OrgRequisiteValues,
  type PaymentLink,
  type PaymentLinkInput,
  type PaymentMethodsSettings,
  type PaymentMethodsSettingsPatch,
  type PaymentNotificationsSettings,
  type PaymentPolicy,
  type PaymentPolicyServiceOverride,
  type PolicyAccountEntry,
  type PolicyAccountSummary,
  type PrepaymentCalcInput,
  type PrepaymentCalcResult,
  type PrepaymentSettings,
  type ReceiptRequisiteFlags,
  type ReceiptSettings,
  type ReceiptSettingsPatch,
  type ServicePrepayment,
  type StaffPrepayment,
} from '@/domain/finance';
import type {
  AdyenTransactionFilter,
  DayMoneySummary,
  DebtVisitRow,
  FiscalSettingsPatch,
  OnlineLinkSettingsPatch,
  PaymentPolicyPatch,
  PolicyDecision,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
  PrepaymentSettingsPatch,
  ReceiptData,
  SaleRefundMode,
} from '@/api/finance';
import type { Id, ISODateTime, Money } from '@/domain/core';
import type {
  Account,
  AccountInput,
  BookingPaymentLine,
  BookingPaymentStatus,
  Counterparty,
  CounterpartyInput,
  DocumentFilter,
  FinanceDocument,
  FinanceItem,
  FinanceItemInput,
  Operation,
  OperationFilter,
  OperationInput,
} from '@/domain/finance';
import type { AccountWithBalance, BookingPaymentSummary, CashShiftView, OperationUpdate, SplitPaymentPart, TransferFundsInput, UnpaidVisitRow } from '@/api/finance';

const b = (businessId: Id) => `/v1/biz/${businessId}`;
const fb = (businessId: Id) => `${b(businessId)}/finance`;
const csv = (ids?: Id[]) => (ids && ids.length > 0 ? ids.join(',') : undefined);

// ─────────────────────────── Кассы и счета ───────────────────────────

export function listAccounts(businessId: Id, locationIds?: Id[]): Promise<Account[]> {
  return http('GET', `${fb(businessId)}/cash-registers`, undefined, { query: { locationIds: csv(locationIds) } });
}

export function listAccountsWithBalance(businessId: Id, locationIds?: Id[]): Promise<AccountWithBalance[]> {
  return http('GET', `${fb(businessId)}/cash-registers`, undefined, { query: { locationIds: csv(locationIds), withBalance: 1 } });
}

export function createAccount(businessId: Id, input: AccountInput): Promise<Account> {
  return http('POST', `${fb(businessId)}/cash-registers`, input);
}

export function updateAccount(businessId: Id, id: Id, patch: Partial<AccountInput>): Promise<Account> {
  return http('PATCH', `${fb(businessId)}/cash-registers/${id}`, patch);
}

export async function removeAccount(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${fb(businessId)}/cash-registers/${id}`);
}

export async function reorderAccounts(businessId: Id, orderedIds: Id[]): Promise<void> {
  await http('POST', `${fb(businessId)}/cash-registers/reorder`, { orderedIds });
}

export function transferFunds(businessId: Id, input: TransferFundsInput): Promise<Operation[]> {
  return http('POST', `${fb(businessId)}/cash-registers/transfer`, input);
}

// ─────────────────────────── Статьи ───────────────────────────

export function listItems(businessId: Id): Promise<FinanceItem[]> {
  return http('GET', `${fb(businessId)}/items`);
}

export function createItem(businessId: Id, input: FinanceItemInput): Promise<FinanceItem> {
  return http('POST', `${fb(businessId)}/items`, input);
}

export function updateItem(businessId: Id, id: Id, patch: Partial<FinanceItemInput>): Promise<FinanceItem> {
  return http('PATCH', `${fb(businessId)}/items/${id}`, patch);
}

export async function removeItem(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${fb(businessId)}/items/${id}`);
}

// ─────────────────────────── Операции ───────────────────────────

function opQuery(filter?: OperationFilter) {
  return {
    locationIds: csv(filter?.locationIds),
    accountId: filter?.accountId,
    itemId: filter?.itemId,
    kind: filter?.kind,
    method: filter?.method,
    partyType: filter?.partyType,
    partyId: filter?.partyId,
    cancelled: filter?.cancelled,
    dateFrom: filter?.dateFrom,
    dateTo: filter?.dateTo,
    search: filter?.search,
  };
}

export function listOperations(businessId: Id, filter?: OperationFilter): Promise<Operation[]> {
  return http('GET', `${fb(businessId)}/fin-ops`, undefined, { query: opQuery(filter) });
}

export function getOperation(businessId: Id, id: Id): Promise<Operation> {
  return http('GET', `${fb(businessId)}/fin-ops/${id}`);
}

export function recordOperation(businessId: Id, input: OperationInput): Promise<Operation> {
  return http('POST', `${fb(businessId)}/fin-ops`, input, { idempotencyKey: crypto.randomUUID() });
}

export function updateOperation(businessId: Id, id: Id, patch: OperationUpdate): Promise<Operation> {
  return http('PATCH', `${fb(businessId)}/fin-ops/${id}`, patch);
}

export async function cancelOperation(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${fb(businessId)}/fin-ops/${id}/cancel`);
}

export function importOperations(businessId: Id, rows: OperationInput[]): Promise<Operation[]> {
  return http('POST', `${fb(businessId)}/fin-ops/import`, { rows });
}

// ─────────────────────────── Контрагенты ───────────────────────────

export function listCounterparties(businessId: Id): Promise<Counterparty[]> {
  return http('GET', `${fb(businessId)}/counterparties`);
}

export function createCounterparty(businessId: Id, input: CounterpartyInput): Promise<Counterparty> {
  return http('POST', `${fb(businessId)}/counterparties`, input);
}

export function updateCounterparty(businessId: Id, id: Id, patch: Partial<CounterpartyInput>): Promise<Counterparty> {
  return http('PATCH', `${fb(businessId)}/counterparties/${id}`, patch);
}

export async function removeCounterparty(businessId: Id, id: Id): Promise<void> {
  await http('DELETE', `${fb(businessId)}/counterparties/${id}`);
}

export function importCounterparties(businessId: Id, rows: CounterpartyInput[]): Promise<Counterparty[]> {
  return http('POST', `${fb(businessId)}/counterparties/import`, { rows });
}

// ─────────────────────────── Документы ───────────────────────────

export function listDocuments(businessId: Id, filter?: DocumentFilter): Promise<FinanceDocument[]> {
  return http('GET', `${fb(businessId)}/documents`, undefined, { query: { type: filter?.type, contentKind: filter?.contentKind, dateFrom: filter?.dateFrom, dateTo: filter?.dateTo, search: filter?.search } });
}

export function getDocument(businessId: Id, id: Id): Promise<FinanceDocument> {
  return http('GET', `${fb(businessId)}/documents/${id}`);
}

export function updateDocument(businessId: Id, id: Id, patch: { note?: string }): Promise<FinanceDocument> {
  return http('PATCH', `${fb(businessId)}/documents/${id}`, patch);
}

// ─────────────────────────── Возвраты и штрафы ───────────────────────────

export function chargeClientPenalty(businessId: Id, locationId: Id, accountId: Id, clientId: Id, amount: Money, comment?: string): Promise<Operation> {
  return http('POST', `${fb(businessId)}/fines`, { locationId, accountId, clientId, amount, comment });
}

// ─────────────────────────── Отчёты ───────────────────────────

export function getDayCashSummary(businessId: Id, date: string, locationIds?: Id[]): Promise<{ income: number; expense: number; cash: number; card: number }> {
  return http('GET', `${fb(businessId)}/reports/cash-day`, undefined, { query: { date, locationIds: csv(locationIds) } });
}

// ─────────────────────────── Плитки способа оплаты визита (упрощённо) ───────────────────────────

interface PaymentMethodRow {
  key: string;
  label: string;
  kind: 'cash' | 'card' | 'custom';
  feePercent: number;
  accountId?: Id;
  active: boolean;
}

export async function listBookingPaymentTiles(businessId: Id): Promise<{ key: string; kind: 'cash' | 'card' | 'custom'; label: string; accountId: Id | null; feePct: number }[]> {
  const rows = await http<PaymentMethodRow[]>('GET', `${fb(businessId)}/payment-methods`);
  return rows.filter((r) => r.active).map((r) => ({ key: r.key, kind: r.kind, label: r.label, accountId: r.accountId ?? null, feePct: r.feePercent }));
}

// ─────────────────────────── Оплата визита (kind='money' — F-07-036…050/181/184) ───────────────────────────

interface ServerBookingPaymentSummary {
  bookingId: Id;
  total: Money;
  paidAmount: Money;
  due: Money;
  status: BookingPaymentStatus;
  lineTotals: Money[];
  moneyLines: { id: Id; serviceIndex?: number; kind?: 'money' | 'discount' | 'account'; methodKey: string; methodLabel: string; accountId?: Id; amount: Money; operationId?: Id; goods?: boolean; debt?: boolean; loyaltyAccountId?: Id; groupId?: Id; refundedAmount?: Money; cancelled?: boolean; cancelledAt?: ISODateTime; createdAt: ISODateTime; createdBy: string }[];
  note?: string;
  /** Этап 21: услуги + товары визита (нет — старый сервер, только услуги) */
  payableTotal?: Money;
  goods?: { name: string; qty: number; price: Money; total: Money }[];
}

async function toSummary(businessId: Id, bookingId: Id, s: ServerBookingPaymentSummary): Promise<BookingPaymentSummary> {
  const booking = await getBooking(bookingId);
  const payments: BookingPaymentLine[] = s.moneyLines.map((l) => ({
    id: l.id,
    businessId,
    bookingId,
    serviceIndex: l.serviceIndex,
    kind: l.kind ?? 'money',
    goods: l.goods,
    debt: l.debt,
    loyaltyAccountId: l.loyaltyAccountId,
    groupId: l.groupId,
    refundedAmount: l.refundedAmount,
    methodKey: l.methodKey,
    methodLabel: l.methodLabel,
    accountId: l.accountId,
    amount: l.amount,
    operationId: l.operationId,
    cancelled: l.cancelled,
    cancelledAt: l.cancelledAt,
    createdAt: l.createdAt,
    createdBy: l.createdBy,
  }));
  return { booking, lineTotals: s.lineTotals, payments, due: s.due, status: s.status, note: s.note, goods: s.goods, total: s.payableTotal };
}

export async function getBookingPaymentSummary(businessId: Id, bookingId: Id): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('GET', `${fb(businessId)}/bookings/${bookingId}/payments`);
  return toSummary(businessId, bookingId, s);
}

export async function getBookingPaymentStatus(businessId: Id, bookingId: Id): Promise<BookingPaymentStatus> {
  const s = await http<ServerBookingPaymentSummary>('GET', `${fb(businessId)}/bookings/${bookingId}/payments`);
  return s.status;
}

export async function payBookingQuick(businessId: Id, bookingId: Id, methodKey: string, accountIdOverride?: Id): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('POST', `${fb(businessId)}/bookings/${bookingId}/payments`, { mode: 'quick', methodKey, accountId: accountIdOverride }, { idempotencyKey: crypto.randomUUID() });
  return toSummary(businessId, bookingId, s);
}

export async function payBookingSplit(businessId: Id, bookingId: Id, parts: SplitPaymentPart[]): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>(
    'POST',
    `${fb(businessId)}/bookings/${bookingId}/payments`,
    { mode: 'split', parts: parts.map((p) => ({ methodKey: p.methodKey, amount: p.amount, accountId: p.accountId })) },
    { idempotencyKey: crypto.randomUUID() },
  );
  return toSummary(businessId, bookingId, s);
}

export async function removeBookingPaymentLine(businessId: Id, paymentLineId: Id): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('DELETE', `${fb(businessId)}/payments/${paymentLineId}`);
  return toSummary(businessId, s.bookingId, s);
}

export async function setBookingPaymentNote(businessId: Id, bookingId: Id, note: string): Promise<void> {
  await http('PUT', `${fb(businessId)}/bookings/${bookingId}/payments/note`, { note });
}

export async function refundBookingFull(businessId: Id, bookingId: Id, reason: string): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('POST', `${fb(businessId)}/bookings/${bookingId}/payments/refund-full`, { reason });
  return toSummary(businessId, bookingId, s);
}

export function getBookingReceiptData(businessId: Id, bookingId: Id) {
  return http('GET', `${fb(businessId)}/bookings/${bookingId}/receipt`);
}

// ═══════════════════════ Этап 21, лейн «finance+stock» — остаток раздела на сервере ═══════════════════════
// Бэкенд: `FinanceExtController`/`FinanceExtService` + расширенный `BookingPaymentsService`. Настройки раздела —
// JSON по ключам (`/finance/settings/:key`, F4 этапа 18); демо-документы онлайн-платежей без провайдера (Р14,
// F-00-028: ссылки, снимки/счёт политики, Adyen, заказы «другим способом») — `/finance/records`; деньги — FinOp и
// строки оплаты визита на сервере. Логика настроек/политики — та же, что у мока (src/api/finance.ts), только
// состояние живёт на сервере.

// ── Настройки раздела ──

async function setting<T>(businessId: Id, key: string): Promise<T | null> {
  const r = await http<{ stored: T | null }>('GET', `${fb(businessId)}/settings/${key}`);
  return r.stored;
}

function putSetting<T>(businessId: Id, key: string, value: T): Promise<T> {
  return http('PUT', `${fb(businessId)}/settings/${key}`, { value });
}

async function patchSetting<T>(businessId: Id, key: string, fallback: () => T, apply: (current: T) => T): Promise<T> {
  const current = (await setting<T>(businessId, key)) ?? fallback();
  const next = apply(current);
  await putSetting(businessId, key, next);
  return next;
}

const now = () => nowDateTime();

// Методы оплаты (F-07-025…030)

async function defaultPaymentMethods(businessId: Id): Promise<PaymentMethodsSettings> {
  const accs = (await listAccounts(businessId)).sort((a, b) => a.order - b.order);
  const cash = accs.find((a) => a.kind === 'cash')?.id ?? null;
  const card = accs.find((a) => a.kind === 'card')?.id ?? cash;
  return {
    businessId,
    cash: { accountId: cash, cashierMode: 'default' },
    card: { perBrand: false, feePct: 0, brands: [], accountId: card, settlementDays: 0 },
    installment: { enabled: false, plans: [] },
    custom: [],
    feeShare: 'business',
    updatedAt: now(),
  };
}

export async function getPaymentMethodsSettings(businessId: Id): Promise<PaymentMethodsSettings> {
  return (await setting<PaymentMethodsSettings>(businessId, 'paymentMethods')) ?? defaultPaymentMethods(businessId);
}

async function patchPaymentMethods(businessId: Id, apply: (c: PaymentMethodsSettings) => PaymentMethodsSettings): Promise<PaymentMethodsSettings> {
  const current = await getPaymentMethodsSettings(businessId);
  return putSetting(businessId, 'paymentMethods', { ...apply(current), updatedAt: now() });
}

export function savePaymentMethodsSettings(businessId: Id, patch: PaymentMethodsSettingsPatch): Promise<PaymentMethodsSettings> {
  return patchPaymentMethods(businessId, (current) => ({
    ...current,
    cash: { ...current.cash, ...patch.cash },
    card: { ...current.card, ...patch.card, brands: patch.card?.brands ?? current.card.brands },
    installment: { ...current.installment, ...patch.installment, plans: patch.installment?.plans ?? current.installment.plans },
    feeShare: patch.feeShare ?? current.feeShare,
  }));
}

export function addCustomPaymentMethod(businessId: Id, input: CustomPaymentMethodInput): Promise<PaymentMethodsSettings> {
  return patchPaymentMethods(businessId, (current) => ({ ...current, custom: [...current.custom, { id: newId('cpm'), name: input.name, feePct: input.feePct, accountId: input.accountId, active: true }] }));
}

export async function updateCustomPaymentMethod(businessId: Id, id: Id, patch: Partial<CustomPaymentMethodInput & { active: boolean }>): Promise<PaymentMethodsSettings> {
  if (!(await setting<PaymentMethodsSettings>(businessId, 'paymentMethods'))) throw new Error('settings_not_found');
  return patchPaymentMethods(businessId, (current) => ({ ...current, custom: current.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

// Нефискальный чек (F-07-147/148/158)

function defaultReceipt(businessId: Id): ReceiptSettings {
  return {
    businessId,
    format: 'thermal58',
    clientName: true,
    clientPhone: true,
    clientEmail: false,
    requisites: { ...DEFAULT_RECEIPT_REQUISITES },
    orgType: 'legal',
    orgRequisites: { ...DEFAULT_ORG_REQUISITES },
    taxPerLine: false,
    extraInfoEnabled: false,
    extraInfoText: '',
    showComment: true,
    vatIncludedEnabled: false,
    vatIncludedPct: 20,
    updatedAt: now(),
  };
}

export async function getReceiptSettings(businessId: Id): Promise<ReceiptSettings> {
  return (await setting<ReceiptSettings>(businessId, 'receipt')) ?? defaultReceipt(businessId);
}

export function saveReceiptSettings(businessId: Id, patch: ReceiptSettingsPatch): Promise<ReceiptSettings> {
  return patchSetting<ReceiptSettings>(businessId, 'receipt', () => defaultReceipt(businessId), (current) => {
    const { requisites, orgRequisites, ...rest } = patch;
    return {
      ...current,
      ...rest,
      requisites: { ...current.requisites, ...(requisites as Partial<ReceiptRequisiteFlags> | undefined) },
      orgRequisites: { ...current.orgRequisites, ...(orgRequisites as Partial<OrgRequisiteValues> | undefined) },
      updatedAt: now(),
    };
  });
}

interface ServerReceiptInputs {
  settings: Partial<ReceiptSettings> | null;
  businessName: string;
  client?: { name: string; phone: string; email?: string | null };
  docNumber?: string;
  date: string;
  serviceLines: { label: string; amount: Money }[];
  goodsLines: { label: string; amount: Money }[];
  paymentLines: { label: string; amount: Money; kind: 'money' | 'discount' | 'account' }[];
  total: Money;
  note?: string;
}

export async function getBookingReceiptDataApi(businessId: Id, bookingId: Id): Promise<ReceiptData> {
  const r = await http<ServerReceiptInputs>('GET', `${fb(businessId)}/bookings/${bookingId}/receipt-data`);
  const s = { ...defaultReceipt(businessId), ...(r.settings ?? {}) };
  const vat = (amount: Money) => (s.vatIncludedEnabled ? vatIncludedInPrice(amount, s.vatIncludedPct) : undefined);
  return {
    businessName: r.businessName,
    requisites: s.requisites,
    orgRequisites: s.orgRequisites,
    format: s.format,
    clientName: s.clientName ? r.client?.name : undefined,
    clientPhone: s.clientPhone ? r.client?.phone : undefined,
    clientEmail: s.clientEmail ? (r.client?.email ?? undefined) : undefined,
    docNumber: r.docNumber,
    date: r.date,
    lines: [...r.serviceLines, ...r.goodsLines].map((l) => ({ label: l.label, amount: l.amount, vat: vat(l.amount) })),
    paymentLines: r.paymentLines,
    total: r.total,
    comment: s.showComment ? r.note : undefined,
    extraInfoText: s.extraInfoEnabled ? s.extraInfoText : undefined,
  };
}

// Права раздела «Финансы» (F-07-166…168) — карта staffId → права, одна на бизнес

export async function getFinanceRights(businessId: Id, staffId: Id): Promise<FinanceRights> {
  return (await setting<Record<Id, FinanceRights>>(businessId, 'rights'))?.[staffId] ?? FINANCE_RIGHTS_FULL;
}

export async function listFinanceRightsByStaff(businessId: Id): Promise<Record<Id, FinanceRights>> {
  return (await setting<Record<Id, FinanceRights>>(businessId, 'rights')) ?? {};
}

export async function saveFinanceRights(businessId: Id, staffId: Id, patch: Partial<FinanceRights>): Promise<FinanceRights> {
  const map = await patchSetting<Record<Id, FinanceRights>>(businessId, 'rights', () => ({}), (m) => ({ ...m, [staffId]: { ...(m[staffId] ?? { ...FINANCE_RIGHTS_FULL }), ...patch } }));
  return map[staffId]!;
}

// Онлайн-платежи: провайдер на способ, ссылка на оплату (F-07-076…083)

const defaultOnlinePayment = (businessId: Id): OnlinePaymentSettings => ({ businessId, providerByWay: { link: null, widgetPrepayment: null, onlineSales: null }, updatedAt: now() });
const defaultOnlineLink = (businessId: Id): OnlineLinkSettings => ({ businessId, requisitesText: '', waitMinutes: 30, staticQrEnabled: true, updatedAt: now() });

export async function getOnlinePaymentSettings(businessId: Id): Promise<OnlinePaymentSettings> {
  return (await setting<OnlinePaymentSettings>(businessId, 'onlinePayment')) ?? defaultOnlinePayment(businessId);
}

export function setOnlinePaymentProvider(businessId: Id, way: OnlinePaymentWay, provider: OnlineProviderKey | null): Promise<OnlinePaymentSettings> {
  return patchSetting(businessId, 'onlinePayment', () => defaultOnlinePayment(businessId), (c) => ({ ...c, providerByWay: { ...c.providerByWay, [way]: provider }, updatedAt: now() }));
}

export async function getOnlineLinkSettings(businessId: Id): Promise<OnlineLinkSettings> {
  return (await setting<OnlineLinkSettings>(businessId, 'onlineLink')) ?? defaultOnlineLink(businessId);
}

export function saveOnlineLinkSettings(businessId: Id, patch: OnlineLinkSettingsPatch): Promise<OnlineLinkSettings> {
  return patchSetting(businessId, 'onlineLink', () => defaultOnlineLink(businessId), (c) => ({ ...c, ...patch, updatedAt: now() }));
}

export async function getPaymentLinkForBooking(businessId: Id, bookingId: Id): Promise<PaymentLink | null> {
  const r = await http<{ link: PaymentLink | null }>('GET', `${fb(businessId)}/bookings/${bookingId}/payment-link`);
  return r.link ? { ...r.link, status: effectivePaymentLinkStatus(r.link, now()) } : null;
}

export function createPaymentLink(businessId: Id, input: PaymentLinkInput): Promise<PaymentLink> {
  return http('POST', `${fb(businessId)}/payment-links`, { targetKind: input.targetKind, bookingId: input.bookingId, saleLabel: input.saleLabel, amount: input.amount, remainingBefore: input.remainingBefore });
}

export function markPaymentLinkPaid(businessId: Id, id: Id): Promise<PaymentLink> {
  return http('POST', `${fb(businessId)}/payment-links/${id}/paid`);
}

export async function cancelPaymentLink(businessId: Id, id: Id): Promise<void> {
  await http('POST', `${fb(businessId)}/payment-links/${id}/cancel`);
}

// Предоплата в виджете (F-07-088…098)

const defaultPrepayment = (businessId: Id): PrepaymentSettings => ({ businessId, mode: 'off', amountType: 'percent', amountValue: 30, waitMinutes: 15, requiredServiceIds: [], requiredAllServices: false, requiredStaffIds: [], updatedAt: now() });

export async function getPrepaymentSettings(businessId: Id): Promise<PrepaymentSettings> {
  return (await setting<PrepaymentSettings>(businessId, 'prepayment')) ?? defaultPrepayment(businessId);
}

export function savePrepaymentSettings(businessId: Id, patch: PrepaymentSettingsPatch): Promise<PrepaymentSettings> {
  return patchSetting(businessId, 'prepayment', () => defaultPrepayment(businessId), (c) => ({ ...c, ...patch, updatedAt: now() }));
}

export async function listStaffPrepayment(businessId: Id): Promise<StaffPrepayment[]> {
  return Object.values((await setting<Record<Id, StaffPrepayment>>(businessId, 'staffPrepayment')) ?? {});
}

export async function setStaffPrepayment(businessId: Id, staffId: Id, patch: Partial<Omit<StaffPrepayment, 'staffId'>>): Promise<StaffPrepayment> {
  const map = await patchSetting<Record<Id, StaffPrepayment>>(businessId, 'staffPrepayment', () => ({}), (m) => ({ ...m, [staffId]: { ...(m[staffId] ?? { staffId, enabled: false, amountType: 'percent', amountValue: 100 }), ...patch, staffId } }));
  return map[staffId]!;
}

export async function listServicePrepayment(businessId: Id): Promise<ServicePrepayment[]> {
  return Object.values((await setting<Record<Id, ServicePrepayment>>(businessId, 'servicePrepayment')) ?? {});
}

export async function setServicePrepayment(businessId: Id, serviceId: Id, patch: Partial<Omit<ServicePrepayment, 'serviceId'>>): Promise<ServicePrepayment> {
  const map = await patchSetting<Record<Id, ServicePrepayment>>(businessId, 'servicePrepayment', () => ({}), (m) => ({ ...m, [serviceId]: { ...(m[serviceId] ?? { serviceId, amountType: 'percent', amountValue: 100 }), ...patch, serviceId } }));
  return map[serviceId]!;
}

export async function calcPrepayment(businessId: Id, input: PrepaymentCalcInput): Promise<PrepaymentCalcResult> {
  const [general, staffMap, serviceMap] = await Promise.all([
    getPrepaymentSettings(businessId),
    setting<Record<Id, StaffPrepayment>>(businessId, 'staffPrepayment'),
    setting<Record<Id, ServicePrepayment>>(businessId, 'servicePrepayment'),
  ]);
  const staffOverride = input.staffId ? (staffMap?.[input.staffId] ?? undefined) : undefined;
  return calcPrepaymentPure(general, staffOverride, { ...input, servicePrepayment: input.servicePrepayment ?? serviceMap ?? {} });
}

// Фискализация стран (F-07-152…157)

const defaultFiscal = (businessId: Id): FiscalSettings => ({
  businessId,
  ukraine: { proRroConnected: false, cashierName: '', cardReceiptMode: 'single' },
  hungary: { billingoConnected: false },
  brazil: { notaFiscalConnected: false },
  updatedAt: now(),
});

export async function getFiscalSettings(businessId: Id): Promise<FiscalSettings> {
  return (await setting<FiscalSettings>(businessId, 'fiscal')) ?? defaultFiscal(businessId);
}

export function saveFiscalSettings(businessId: Id, patch: FiscalSettingsPatch): Promise<FiscalSettings> {
  return patchSetting(businessId, 'fiscal', () => defaultFiscal(businessId), (c) => ({
    ...c,
    armenia: { remindToPrint: false, hdmRegNumber: '', ...c.armenia, ...patch.armenia },
    ukraine: { ...c.ukraine, ...patch.ukraine },
    hungary: { ...c.hungary, ...patch.hungary },
    brazil: { ...c.brazil, ...patch.brazil },
    updatedAt: now(),
  }));
}

// Уведомления об оплате (F-07-084…086)

export async function getPaymentNotificationsSettings(businessId: Id): Promise<PaymentNotificationsSettings> {
  return (await setting<PaymentNotificationsSettings>(businessId, 'paymentNotifications')) ?? { businessId, ...DEFAULT_PAYMENT_NOTIFICATIONS, updatedAt: now() };
}

export function savePaymentNotificationsSettings(businessId: Id, patch: Partial<Pick<PaymentNotificationsSettings, 'linkToPayEnabled' | 'successPaidEnabled' | 'staffQrPaidEnabled'>>): Promise<PaymentNotificationsSettings> {
  return patchSetting(businessId, 'paymentNotifications', () => ({ businessId, ...DEFAULT_PAYMENT_NOTIFICATIONS, updatedAt: now() }), (c) => ({ ...c, ...patch, updatedAt: now() }));
}

// Типы счетов клиентов (F-07-058)

export async function listAccountTypes(businessId: Id): Promise<AccountType[]> {
  return (await setting<AccountType[]>(businessId, 'accountTypes')) ?? [];
}

export async function createAccountType(businessId: Id, input: AccountTypeInput): Promise<AccountType> {
  const error = validateAccountTypeInput(input);
  if (error) throw new ApiError('validation', error);
  const at = now();
  const created: AccountType = { ...input, id: newId('atp'), businessId, createdAt: at, updatedAt: at };
  await patchSetting<AccountType[]>(businessId, 'accountTypes', () => [], (list) => [...list, created]);
  return created;
}

export async function updateAccountType(businessId: Id, id: Id, input: AccountTypeInput): Promise<AccountType> {
  const error = validateAccountTypeInput(input);
  if (error) throw new ApiError('validation', error);
  const list = await listAccountTypes(businessId);
  const row = list.find((a) => a.id === id);
  if (!row) throw new ApiError('not_found', 'Тип счёта не найден');
  const saved: AccountType = { ...row, ...input, updatedAt: now() };
  await putSetting(businessId, 'accountTypes', list.map((a) => (a.id === id ? saved : a)));
  return saved;
}

export async function removeAccountType(businessId: Id, id: Id): Promise<void> {
  const { inUse } = await http<{ inUse: boolean }>('GET', `${fb(businessId)}/client-accounts/in-use`);
  if (inUse) throw new ApiError('validation', 'По этому типу у клиентов есть деньги или долг — сначала закройте их счета');
  await patchSetting<AccountType[]>(businessId, 'accountTypes', () => [], (list) => list.filter((a) => a.id !== id));
}

// ── Оплата визита: скидка по акции, личный счёт клиента ──

export async function addBookingPromoDiscount(businessId: Id, bookingId: Id, label: string, amount: Money, options?: { exactLabel?: boolean }): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('POST', `${fb(businessId)}/bookings/${bookingId}/payments/discount`, { label, amount: Math.round(amount), exactLabel: options?.exactLabel });
  return toSummary(businessId, bookingId, s);
}

export async function payBookingFromClientAccount(businessId: Id, bookingId: Id, clientId: Id, amount: Money, loyalty?: { accountId: Id; debt: boolean }): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('POST', `${fb(businessId)}/bookings/${bookingId}/payments/account`, { clientId, amount: Math.round(amount), loyaltyAccountId: loyalty?.accountId, debt: loyalty?.debt });
  return toSummary(businessId, bookingId, s);
}

async function clientAccount(businessId: Id, clientId: Id) {
  return http<{ balance: Money; topUps: ClientAccountTopUp[] }>('GET', `${fb(businessId)}/clients/${clientId}/account`);
}

export async function getClientAccountBalance(businessId: Id, clientId: Id): Promise<Money> {
  return (await clientAccount(businessId, clientId)).balance;
}

export async function listClientAccountTopUps(businessId: Id, clientId: Id): Promise<ClientAccountTopUp[]> {
  return (await clientAccount(businessId, clientId)).topUps;
}

export function topUpClientAccount(businessId: Id, clientId: Id, clientName: string | undefined, accountId: Id, amount: Money, method: 'cash' | 'card' | 'other'): Promise<{ topUp: ClientAccountTopUp; balance: Money }> {
  if (!Number.isFinite(amount) || amount <= 0) return Promise.reject(new ApiError('invalid_amount'));
  return http('POST', `${fb(businessId)}/clients/${clientId}/account/topup`, { accountId, amount: Math.round(amount), method, clientName });
}

export async function cancelClientAccountTopUp(businessId: Id, topUpId: Id): Promise<void> {
  await http('POST', `${fb(businessId)}/account-topups/${topUpId}/cancel`);
}

export async function refundClientAccountPartial(businessId: Id, clientId: Id, accountId: Id, amount: Money, comment?: string): Promise<Money> {
  const r = await http<{ balance: Money }>('POST', `${fb(businessId)}/clients/${clientId}/account/refund`, { accountId, amount: Math.round(amount), comment });
  return r.balance;
}

// ── Клиент: продано/оплачено, визиты с долгом; сводка дня ──

export async function getClientMoneySummary(businessId: Id, clientId: Id): Promise<ClientMoneySummary> {
  const r = await http<{ totals: Money[]; paidFromBookings: Money; manualOps: Pick<Operation, 'kind' | 'amount' | 'cancelled'>[] }>('GET', `${fb(businessId)}/clients/${clientId}/money`);
  return computeClientMoneySummary(r.totals, r.paidFromBookings, r.manualOps);
}

export async function listClientDebtVisits(businessId: Id, clientId: Id, filter: DebtVisitFilter = 'all'): Promise<DebtVisitRow[]> {
  const rows = await http<DebtVisitRow[]>('GET', `${fb(businessId)}/clients/${clientId}/debt-visits`);
  if (filter === 'unpaid') return rows.filter((r) => r.due > 0);
  if (filter === 'accountDebt') return rows.filter((r) => r.debt);
  return rows;
}

export function getDayMoneySummary(businessId: Id, date: string, locationIds?: Id[]): Promise<DayMoneySummary> {
  return http('GET', `${fb(businessId)}/reports/day-money`, undefined, { query: { date, locationIds: csv(locationIds) } });
}

// ── Возврат по продаже (F-07-068/069/071/072), статьи-продажи ──

const REFUNDABLE_KEYS = ['goodsSale', 'membershipSale', 'certificateSale'] as const;
/** Статьи бизнеса с ключом системной статьи — для синхронных isRefundableSaleItemKey/getRefundableSaleKind */
export const itemSystemKeyCache = new Map<Id, string>();

export async function listItemsRemembering(businessId: Id): Promise<FinanceItem[]> {
  const items = await listItems(businessId);
  for (const it of items as (FinanceItem & { systemKey?: string })[]) if (it.systemKey) itemSystemKeyCache.set(it.id, it.systemKey);
  return items;
}

export function refundableSaleKindCached(itemId: Id): (typeof REFUNDABLE_KEYS)[number] | undefined {
  const key = itemSystemKeyCache.get(itemId);
  return REFUNDABLE_KEYS.find((k) => k === key);
}

export async function refundSaleOperation(businessId: Id, operationId: Id, input: { amount: Money; mode: SaleRefundMode; comment?: string }): Promise<Operation> {
  const [op] = await Promise.all([getOperation(businessId, operationId), listItemsRemembering(businessId)]);
  if (op.cancelled) throw new Error('operation_cancelled');
  if (op.kind !== 'income') throw new Error('not_a_sale');
  if (!refundableSaleKindCached(op.itemId)) throw new Error('not_a_refundable_sale');
  const remaining = roundToDram(op.amount - (op.refundedAmount ?? 0));
  if (remaining <= 0) throw new Error('nothing_to_refund');
  const amount = roundToDram(Math.min(Math.max(0, input.amount), remaining));
  if (amount <= 0) throw new Error('nothing_to_refund');
  if (input.mode === 'cancel' && amount >= remaining) {
    await cancelOperation(businessId, operationId);
  } else {
    await http('POST', `${fb(businessId)}/refunds`, { finOpId: operationId, amount, comment: input.comment?.trim() || undefined });
  }
  return getOperation(businessId, operationId);
}

export async function cancelSalaryPayout(businessId: Id, entryId: Id): Promise<void> {
  await http('POST', `${fb(businessId)}/salary-payouts/${entryId}/cancel`);
}

// ── Справочники для настроек предоплаты (F-07-089/090) ──

export async function listServicesBrief(businessId: Id): Promise<{ id: Id; name: string; free: boolean }[]> {
  const rows = await ServicesServer.listServices(businessId);
  return rows.map((s) => ({ id: s.id, name: s.name.ru, free: !s.priceMin || s.priceMin <= 0 }));
}

export async function listStaffBriefFinance(businessId: Id): Promise<{ id: Id; name: string }[]> {
  const rows = await StaffServer.listStaff(businessId);
  return rows.map((r) => r.staff).filter((s) => s.role !== 'owner').map((s) => ({ id: s.id, name: s.name }));
}

// ═══ Демо-документы: политика оплаты, Adyen, заказы «другим способом» (fin_records) ═══

type RecordKind = 'policySnapshot' | 'policyEntry' | 'adyenTxn' | 'manualOrder';

function records<T>(businessId: Id, kind: RecordKind, filter: { refId?: Id; clientId?: Id } = {}): Promise<(T & { id: Id })[]> {
  return http('GET', `${fb(businessId)}/records`, undefined, { query: { kind, refId: filter.refId, clientId: filter.clientId } });
}

function createRecord<T>(businessId: Id, kind: RecordKind, data: T, refs: { refId?: Id; clientId?: Id } = {}): Promise<T & { id: Id }> {
  return http('POST', `${fb(businessId)}/records`, { kind, refId: refs.refId, clientId: refs.clientId, data });
}

function patchRecord<T>(businessId: Id, id: Id, data: Partial<T>): Promise<T & { id: Id }> {
  return http('PATCH', `${fb(businessId)}/records/${id}`, { data });
}

// Политика оплаты (F-07-101…130)

async function adyenConnected(businessId: Id): Promise<boolean> {
  return (await getAdyenConnection(businessId)).status === 'connected';
}

export async function getPaymentPolicy(businessId: Id): Promise<PaymentPolicy> {
  return (await setting<PaymentPolicy>(businessId, 'policy')) ?? defaultPaymentPolicy(businessId, now());
}

export async function savePaymentPolicy(businessId: Id, patch: PaymentPolicyPatch): Promise<PaymentPolicy> {
  const [current, adyenOn, online] = await Promise.all([getPaymentPolicy(businessId), adyenConnected(businessId), getOnlinePaymentSettings(businessId)]);
  const next: PaymentPolicy = {
    ...current,
    ...patch,
    deposit: patch.deposit ? { ...current.deposit, ...patch.deposit } : current.deposit,
    cardGuarantee: patch.cardGuarantee ? { ...current.cardGuarantee, ...patch.cardGuarantee } : current.cardGuarantee,
    conditions: patch.conditions ? { ...current.conditions, ...patch.conditions } : current.conditions,
  };
  const anySystem = adyenOn || Object.values(online.providerByWay).some((p) => p !== null);
  if (next.mode === 'cardGuarantee' && !adyenOn) throw new ApiError('validation', 'Гарантия картой недоступна без подключённого Adyen');
  if (next.mode === 'deposit' && !anySystem) throw new ApiError('validation', 'Депозит недоступен без подключённой платёжной системы');
  if (next.mode === 'deposit' && (!next.deposit.amount.value || next.deposit.amount.value <= 0)) throw new ApiError('validation', 'Депозит не может быть равен нулю');
  if (next.deposit.creditDepositOnCancel && (next.deposit.freeCancellationWindowHours < 1 || next.deposit.freeCancellationWindowHours > 72)) throw new ApiError('validation', 'Окно бесплатной отмены — от 1 до 72 часов');
  if (next.cardGuarantee.allowFreeCancellation && (next.cardGuarantee.freeCancellationWindowHours < 1 || next.cardGuarantee.freeCancellationWindowHours > 72)) throw new ApiError('validation', 'Окно бесплатной отмены — от 1 до 72 часов');
  if (!adyenOn) next.deposit = { ...next.deposit, noShowFeeAboveDeposit: undefined };
  next.updatedAt = now();
  if (next.mode !== 'none') {
    next.activatedAt = now();
    const label = (a: { mode: string; value: number }) => (a.mode === 'percent' ? `${a.value}%` : `${a.value} ֏`);
    next.lastSnapshot =
      next.mode === 'deposit'
        ? {
            mode: 'deposit',
            depositAmountLabel: label(next.deposit.amount),
            noShowFeeLabel: next.deposit.noShowFeeAboveDeposit ? `${next.deposit.noShowFeeAboveDeposit} ֏` : undefined,
            freeCancellationWindowHours: next.deposit.creditDepositOnCancel ? next.deposit.freeCancellationWindowHours : undefined,
            deadlineMin: next.deposit.paymentDeadlineMin,
            clientScope: next.conditions.clientScope,
            savedAt: next.updatedAt,
          }
        : {
            mode: 'cardGuarantee',
            lateCancellationFeeLabel: next.cardGuarantee.chargeLateCancellationFee ? label(next.cardGuarantee.lateCancellationFee) : undefined,
            noShowFeeLabel: next.cardGuarantee.chargeNoShowFee ? label(next.cardGuarantee.noShowFee) : undefined,
            freeCancellationWindowHours: next.cardGuarantee.allowFreeCancellation ? next.cardGuarantee.freeCancellationWindowHours : undefined,
            deadlineMin: next.cardGuarantee.deadlineMin,
            clientScope: next.conditions.clientScope,
            savedAt: next.updatedAt,
          };
  }
  return putSetting(businessId, 'policy', next);
}

export async function listServicePolicyOverrides(businessId: Id): Promise<PaymentPolicyServiceOverride[]> {
  return Object.values((await setting<Record<Id, PaymentPolicyServiceOverride>>(businessId, 'policyServiceOverrides')) ?? {});
}

export async function setServicePolicyOverride(businessId: Id, serviceId: Id, override: PaymentPolicyServiceOverride | null): Promise<void> {
  await patchSetting<Record<Id, PaymentPolicyServiceOverride>>(businessId, 'policyServiceOverrides', () => ({}), (m) => {
    const next = { ...m };
    if (override) next[serviceId] = override;
    else delete next[serviceId];
    return next;
  });
}

// Adyen: подключение, транзакции, возврат (F-07-104/135…137) — только владелец (persona owner/network/individual)

const ownerLike = () => ['owner', 'network', 'individual'].includes(currentActor().persona);

export async function getAdyenConnection(businessId: Id): Promise<AdyenConnection> {
  return (await setting<AdyenConnection>(businessId, 'adyen')) ?? { businessId, status: 'notConnected' };
}

export function startAdyenOnboarding(businessId: Id, input: { legalEntityName: string; country: string; shopperStatement: string }): Promise<AdyenConnection> {
  if (!ownerLike()) return Promise.reject(new ApiError('forbidden', 'Подключить Adyen может только владелец'));
  const startedAt = now();
  return putSetting<AdyenConnection>(businessId, 'adyen', { businessId, status: 'onboarding', legalEntityName: input.legalEntityName, country: input.country, shopperStatement: input.shopperStatement, onboardingStartedAt: startedAt, onboardingDeadline: toISODateTime(dayjs(startedAt).add(60, 'minute')) });
}

export async function completeAdyenOnboarding(businessId: Id): Promise<AdyenConnection> {
  if (!ownerLike()) throw new ApiError('forbidden', 'Только владелец завершает онбординг Adyen');
  const current = await getAdyenConnection(businessId);
  if (current.status !== 'onboarding') throw new ApiError('validation', 'Онбординг Adyen не начат');
  if (current.onboardingDeadline && current.onboardingDeadline < now()) throw new ApiError('validation', 'Час на онбординг истёк — выпустите ссылку заново');
  return putSetting<AdyenConnection>(businessId, 'adyen', { ...current, status: 'connected', connectedAt: now() });
}

export async function listAdyenTransactions(businessId: Id, filter: AdyenTransactionFilter = {}): Promise<AdyenTransaction[]> {
  let rows = await records<AdyenTransaction>(businessId, 'adyenTxn');
  if (filter.type) rows = rows.filter((t) => t.type === filter.type);
  if (filter.pspReference) rows = rows.filter((t) => t.pspReference.includes(filter.pspReference!.trim()));
  if (filter.from) rows = rows.filter((t) => t.date >= filter.from!);
  if (filter.to) rows = rows.filter((t) => t.date <= filter.to!);
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function refundAdyenTransaction(businessId: Id, transactionId: Id): Promise<AdyenTransaction> {
  if (!ownerLike()) throw new ApiError('forbidden', 'Возврат в Adyen Dashboard доступен только владельцу');
  const original = (await records<AdyenTransaction>(businessId, 'adyenTxn')).find((t) => t.id === transactionId);
  if (!original) throw new ApiError('not_found', 'Транзакция не найдена');
  if (original.refunded) throw new ApiError('validation', 'Уже возвращено');
  await patchRecord<AdyenTransaction>(businessId, transactionId, { refunded: true });
  return createRecord<Omit<AdyenTransaction, 'id'>>(businessId, 'adyenTxn', { businessId, date: now(), method: original.method, type: 'refund', netAmount: -original.netAmount, grossAmount: -original.grossAmount, pspReference: original.pspReference });
}

// Счёт «Payment Policy» клиента (F-07-112, 122, 123) и снимок записи

export async function listPolicyAccountEntries(businessId: Id, clientId: Id): Promise<PolicyAccountEntry[]> {
  const rows = await records<PolicyAccountEntry>(businessId, 'policyEntry', { clientId });
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPolicyAccountSummary(businessId: Id, clientId: Id): Promise<PolicyAccountSummary> {
  return computePolicyAccountSummary(await records<PolicyAccountEntry>(businessId, 'policyEntry', { clientId }));
}

async function pushPolicyEntry(businessId: Id, clientId: Id, kind: PolicyAccountEntry['kind'], amount: Money, source: string, bookingId: Id | undefined, by: string): Promise<void> {
  const prev = computePolicyAccountSummary(await records<PolicyAccountEntry>(businessId, 'policyEntry', { clientId }));
  let inHoldAfter = prev.inHold;
  if (kind === 'topUp') inHoldAfter = roundToDram(inHoldAfter + amount);
  else if (kind === 'holdRelease' || kind === 'holdConfirm') inHoldAfter = Math.max(0, roundToDram(inHoldAfter - Math.abs(amount)));
  await createRecord<Omit<PolicyAccountEntry, 'id'>>(businessId, 'policyEntry', { businessId, clientId, kind, amount: roundToDram(amount), balanceAfter: roundToDram(prev.balance + amount), inHoldAfter, source, bookingId, createdAt: now(), createdBy: by }, { clientId, refId: bookingId });
}

async function snapshotRecord(businessId: Id, bookingId: Id): Promise<(BookingPolicySnapshot & { id: Id }) | undefined> {
  return (await records<BookingPolicySnapshot>(businessId, 'policySnapshot', { refId: bookingId }))[0];
}

async function saveSnapshot(businessId: Id, rec: BookingPolicySnapshot & { id: Id }, next: BookingPolicySnapshot): Promise<BookingPolicySnapshot> {
  const { id: _id, ...saved } = await patchRecord<BookingPolicySnapshot>(businessId, rec.id, next);
  return saved as BookingPolicySnapshot;
}

export async function getBookingPolicySnapshot(businessId: Id, bookingId: Id): Promise<BookingPolicySnapshot | null> {
  const rec = await snapshotRecord(businessId, bookingId);
  if (!rec) return null;
  const { id: _id, ...snap } = rec;
  return snap;
}

/** Касса, куда падают деньги политики (F-07-183, fin-review Ф15): системная онлайн-касса, иначе безналичная */
async function policyChargeAccount(businessId: Id): Promise<Account | undefined> {
  const accounts = await listAccounts(businessId);
  return accounts.find((a) => a.systemGenerated && a.kind === 'card') ?? accounts.find((a) => a.kind === 'card') ?? accounts.find((a) => a.kind !== 'cash');
}

async function itemIdOf(businessId: Id, key: string): Promise<Id | undefined> {
  const items = (await listItemsRemembering(businessId)) as (FinanceItem & { systemKey?: string })[];
  return items.find((i) => i.systemKey === key)?.id;
}

async function policyOperation(businessId: Id, clientId: Id, itemKey: 'penaltyCharge' | 'depositRetained' | 'servicePayment', amount: Money, comment: string, refId?: Id, accountIdOverride?: Id, locationIdOverride?: Id): Promise<void> {
  if (amount <= 0) return;
  const [itemId, account] = await Promise.all([itemIdOf(businessId, itemKey), accountIdOverride ? listAccounts(businessId).then((a) => a.find((x) => x.id === accountIdOverride)) : policyChargeAccount(businessId)]);
  if (!itemId || !account) return;
  const client = await ClientsServer.getClientRow(businessId, clientId).catch(() => undefined);
  await recordOperation(businessId, {
    locationId: locationIdOverride ?? account.locationId,
    accountId: account.id,
    itemId,
    kind: 'income',
    amount: roundToDram(amount),
    date: now(),
    method: 'other',
    partyType: client ? 'client' : 'none',
    partyId: client ? clientId : undefined,
    partyName: client?.name,
    comment,
    source: 'account',
    refId,
  });
}

function actorId(): string {
  return currentActor().staffId ?? 'system';
}

export async function applyPolicyDepositAtCheckout(businessId: Id, bookingId: Id): Promise<{ applied: Money; refundedToBalance: Money } | null> {
  const rec = await snapshotRecord(businessId, bookingId);
  if (!rec || rec.mode !== 'deposit' || rec.status !== 'clientAccepted' || !rec.depositAmount) return null;
  const booking = await getBooking(bookingId).catch(() => undefined);
  const total = booking?.total ?? rec.depositAmount;
  const applied = Math.min(rec.depositAmount, total);
  const refundedToBalance = roundToDram(rec.depositAmount - applied);
  await pushPolicyEntry(businessId, rec.clientId, 'holdConfirm', -rec.depositAmount, 'checkout', bookingId, actorId());
  if (refundedToBalance > 0) await pushPolicyEntry(businessId, rec.clientId, 'topUp', refundedToBalance, 'checkout', bookingId, 'system');
  if (booking) {
    const accounts = await listAccounts(businessId);
    const acc = accounts.find((a) => a.locationId === booking.locationId && a.kind === 'card') ?? accounts[0];
    await policyOperation(businessId, rec.clientId, 'servicePayment', applied, 'Депозит по политике оплаты — зачёт в оплату визита', bookingId, acc?.id, booking.locationId);
  }
  await saveSnapshot(businessId, rec, { ...rec, status: 'confirmedAtCheckout', chargedAmount: applied, decidedAt: now(), decidedBy: actorId() });
  return { applied, refundedToBalance };
}

async function applyPenaltyDecision(businessId: Id, snap: BookingPolicySnapshot, decision: PolicyDecision, reason: 'lateCancel' | 'noShow', by: string): Promise<BookingPolicySnapshot> {
  let chargedAmount = 0;
  let nextStatus: BookingPolicyStatus = 'appliedCharged';
  if (snap.mode === 'deposit') {
    const amount = reason === 'noShow' ? (snap.noShowFee ?? snap.depositAmount ?? 0) : (snap.depositAmount ?? 0);
    if (decision === 'credit') {
      await pushPolicyEntry(businessId, snap.clientId, 'holdRelease', 0, reason, snap.bookingId, by);
      nextStatus = 'creditedToBalance';
    } else {
      await pushPolicyEntry(businessId, snap.clientId, 'holdConfirm', -(snap.depositAmount ?? 0), reason, snap.bookingId, by);
      await policyOperation(businessId, snap.clientId, 'depositRetained', snap.depositAmount ?? 0, reason === 'noShow' ? 'Удержан депозит — клиент не пришёл (политика оплаты)' : 'Удержан депозит — поздняя отмена (политика оплаты)');
      chargedAmount = amount;
    }
  } else {
    const amount = reason === 'noShow' ? (snap.noShowFee ?? 0) : (snap.lateCancellationFee ?? 0);
    if (decision === 'waive') {
      nextStatus = 'appliedWaived';
    } else {
      await pushPolicyEntry(businessId, snap.clientId, 'feeCharge', -amount, reason, snap.bookingId, by);
      await policyOperation(businessId, snap.clientId, 'penaltyCharge', amount, reason === 'noShow' ? 'Штраф — клиент не пришёл (политика оплаты)' : 'Штраф за позднюю отмену (политика оплаты)');
      chargedAmount = amount;
    }
  }
  return { ...snap, status: nextStatus, decidedAt: now(), decidedBy: by, chargedAmount: chargedAmount || undefined };
}

export async function resolvePolicyDecision(businessId: Id, bookingId: Id, decision: PolicyDecision, reason: 'lateCancel' | 'noShow'): Promise<BookingPolicySnapshot> {
  const rec = await snapshotRecord(businessId, bookingId);
  if (!rec) throw new ApiError('not_found', 'Снимок политики не найден');
  if (rec.status !== 'clientAccepted') throw new ApiError('validation', 'Решение уже принято — его нельзя изменить');
  if ((decision === 'credit' || decision === 'waive') && !rec.allowReceptionistNotCharge) throw new ApiError('forbidden', 'Прощение выключено в настройках политики');
  return saveSnapshot(businessId, rec, await applyPenaltyDecision(businessId, rec, decision, reason, actorId()));
}

export async function resolvePolicyReschedule(businessId: Id, bookingId: Id, newBookingStart: ISODateTime, decision?: 'charge' | 'forgive'): Promise<BookingPolicySnapshot | null> {
  const rec = await snapshotRecord(businessId, bookingId);
  if (!rec || rec.status !== 'clientAccepted') return null;
  if (now() < rec.freeCancellationDeadline) {
    return saveSnapshot(businessId, rec, { ...rec, freeCancellationDeadline: policyFreeCancellationDeadline(newBookingStart, rec.freeCancellationWindowHours) });
  }
  if (!decision) throw new ApiError('validation', 'После окна бесплатной отмены нужно решение: взять или простить');
  if (decision === 'forgive' && !rec.allowReceptionistNotCharge) throw new ApiError('forbidden', 'Прощение выключено в настройках политики');
  const mapped: PolicyDecision = decision === 'charge' ? 'charge' : rec.mode === 'deposit' ? 'credit' : 'waive';
  return saveSnapshot(businessId, rec, await applyPenaltyDecision(businessId, rec, mapped, 'lateCancel', actorId()));
}

export async function clientCancelBookingWithPolicy(businessId: Id, bookingId: Id): Promise<BookingPolicySnapshot | null> {
  const rec = await snapshotRecord(businessId, bookingId);
  if (!rec || rec.status !== 'clientAccepted') return null;
  const policy = await setting<PaymentPolicy>(businessId, 'policy');
  if (policy && !policy.conditions.allowClientSelfCancelPrepaid) throw new ApiError('forbidden', 'Самостоятельная отмена оплаченной записи выключена — обратитесь в салон');
  if (now() < rec.freeCancellationDeadline) {
    if (rec.mode === 'deposit' && rec.depositAmount) await pushPolicyEntry(businessId, rec.clientId, 'holdRelease', 0, 'clientCancel', bookingId, 'client');
    return saveSnapshot(businessId, rec, { ...rec, status: 'creditedToBalance', decidedAt: now(), decidedBy: 'client' });
  }
  return saveSnapshot(businessId, rec, await applyPenaltyDecision(businessId, rec, 'charge', 'lateCancel', 'client'));
}

export async function clientRescheduleBookingWithPolicy(businessId: Id, bookingId: Id, newBookingStart: ISODateTime): Promise<BookingPolicySnapshot | null> {
  const rec = await snapshotRecord(businessId, bookingId);
  if (!rec || rec.status !== 'clientAccepted') return null;
  const policy = await setting<PaymentPolicy>(businessId, 'policy');
  if (policy && !policy.conditions.allowClientSelfReschedulePrepaid) throw new ApiError('forbidden', 'Самостоятельный перенос оплаченной записи выключен — обратитесь в салон');
  if (now() < rec.freeCancellationDeadline) {
    return saveSnapshot(businessId, rec, { ...rec, freeCancellationDeadline: policyFreeCancellationDeadline(newBookingStart, rec.freeCancellationWindowHours) });
  }
  return saveSnapshot(businessId, rec, await applyPenaltyDecision(businessId, rec, 'charge', 'lateCancel', 'client'));
}

// Онлайн-продажи «Другим способом»: заказы вручную (F-07-132, возврат F-07-073)

export async function listManualOnlineOrders(businessId: Id): Promise<ManualOnlineOrder[]> {
  const rows = await records<ManualOnlineOrder>(businessId, 'manualOrder');
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function manualOrder(businessId: Id, orderId: Id): Promise<ManualOnlineOrder> {
  const order = (await records<ManualOnlineOrder>(businessId, 'manualOrder')).find((o) => o.id === orderId);
  if (!order) throw new ApiError('not_found', 'Заказ не найден');
  return order;
}

export async function confirmManualOnlineOrder(businessId: Id, orderId: Id, accountId: Id): Promise<ManualOnlineOrder> {
  const order = await manualOrder(businessId, orderId);
  if (order.status !== 'pendingPayment') throw new ApiError('validation', 'Заказ уже обработан');
  const account = (await listAccounts(businessId)).find((a) => a.id === accountId);
  if (!account) throw new ApiError('validation', 'Выберите кассу');
  const itemId = await itemIdOf(businessId, order.kind === 'membership' ? 'membershipSale' : 'certificateSale');
  if (!itemId) throw new ApiError('validation', 'Нет статьи для продажи — обратитесь в поддержку');
  const op = await recordOperation(businessId, { locationId: order.locationId, accountId, itemId, kind: 'income', amount: order.amount, date: now(), method: 'other', partyType: 'none', partyName: order.clientName, comment: `Онлайн-заказ «${order.typeName}» — оплачен другим способом`, source: 'sale' });
  return patchRecord<ManualOnlineOrder>(businessId, orderId, { status: 'paid', decidedAt: now(), decidedBy: actorId(), operationId: op.id, code: order.code ?? String(1000 + Math.floor(Math.random() * 9000)) });
}

export async function rejectManualOnlineOrder(businessId: Id, orderId: Id): Promise<ManualOnlineOrder> {
  const order = await manualOrder(businessId, orderId);
  if (order.status !== 'pendingPayment') throw new ApiError('validation', 'Заказ уже обработан');
  return patchRecord<ManualOnlineOrder>(businessId, orderId, { status: 'rejected', decidedAt: now(), decidedBy: actorId() });
}

export async function refundManualOnlineOrder(businessId: Id, orderId: Id): Promise<ManualOnlineOrder> {
  const order = await manualOrder(businessId, orderId);
  if (order.status !== 'paid') throw new ApiError('validation', 'Возврат доступен только у оплаченного заказа');
  if (order.operationId) await cancelOperation(businessId, order.operationId).catch(() => undefined);
  return patchRecord<ManualOnlineOrder>(businessId, orderId, { status: 'refunded', decidedAt: now(), decidedBy: actorId() });
}

// ─────────── Этап 21, лейн finance+stock: кассовая смена, возврат по платежу, «пришли, но не оплатили» ───────────

export function listCashShifts(businessId: Id, accountId: Id): Promise<CashShiftView[]> {
  return http('GET', `${fb(businessId)}/cash-registers/${accountId}/shifts`);
}

export function openCashShift(businessId: Id, accountId: Id, openingCash: Money, comment?: string): Promise<CashShiftView> {
  return http('POST', `${fb(businessId)}/cash-registers/${accountId}/shifts`, { amount: Math.round(openingCash), comment });
}

export function closeCashShift(businessId: Id, shiftId: Id, countedCash: Money, comment?: string): Promise<CashShiftView> {
  return http('POST', `${fb(businessId)}/cash-shifts/${shiftId}/close`, { amount: Math.round(countedCash), comment });
}

export async function refundBookingPayment(businessId: Id, paymentLineId: Id, amount: Money, reason: string): Promise<BookingPaymentSummary> {
  const s = await http<ServerBookingPaymentSummary>('POST', `${fb(businessId)}/payments/${paymentLineId}/refund`, { amount: Math.round(amount), reason });
  return toSummary(businessId, s.bookingId, s);
}

export function listUnpaidVisits(businessId: Id, locationIds?: Id[], days = 14): Promise<UnpaidVisitRow[]> {
  return http('GET', `${fb(businessId)}/reports/unpaid-visits`, undefined, { query: { locationIds: csv(locationIds), days } });
}

// ═══ Этап 21, лейн finance+stock: хвост фасадов соседей (journal/online/network), которые ещё читали мок ═══

/** F-07-002: кассы филиала — сервер заводит «Основную»/«Расчётный счёт» сам, лениво на чтении (ensureDefaults) */
export async function ensureDefaultAccounts(businessId: Id, locationId: Id): Promise<Account[]> {
  return (await listAccounts(businessId)).filter((a) => a.locationId === locationId);
}

/** F-07-050: платежи удалённой записи стираются целиком (сервер принимает только уже удалённую запись) */
export async function deleteBookingPaymentsHard(businessId: Id, bookingId: Id): Promise<void> {
  await http('DELETE', `${fb(businessId)}/bookings/${bookingId}/payments`);
}

/** F-07-080: все ссылки на оплату бизнеса со статусом на сейчас, новые сверху */
export async function listPaymentLinks(businessId: Id): Promise<PaymentLink[]> {
  const rows = await http<(PaymentLink & { id: Id })[]>('GET', `${fb(businessId)}/records`, undefined, { query: { kind: 'paymentLink' } });
  const at = now();
  return rows.map((l) => ({ ...l, status: effectivePaymentLinkStatus(l, at) })).sort((a, c) => (a.createdAt < c.createdAt ? 1 : -1));
}

/** F-07-098: онлайн-категория записи — ставится оплатой по ссылке (markPaymentLinkPaid пишет onlineCategory в ссылку) */
export async function getBookingOnlineCategory(businessId: Id, bookingId: Id): Promise<BookingOnlineCategory | null> {
  const rows = await http<(PaymentLink & { onlineCategory?: BookingOnlineCategory })[]>('GET', `${fb(businessId)}/records`, undefined, { query: { kind: 'paymentLink', refId: bookingId } });
  const paid = rows.filter((l) => l.status === 'paid' && l.onlineCategory).sort((a, c) => ((a.paidAt ?? '') < (c.paidAt ?? '') ? 1 : -1));
  return paid[0]?.onlineCategory ?? null;
}

export async function getStaffPrepayment(businessId: Id, staffId: Id): Promise<StaffPrepayment | null> {
  return (await listStaffPrepayment(businessId)).find((p) => p.staffId === staffId) ?? null;
}

export async function isPolicyActive(businessId: Id): Promise<boolean> {
  return (await getPaymentPolicy(businessId)).mode !== 'none';
}

export async function isClientPolicyDebtor(businessId: Id, clientId: Id): Promise<boolean> {
  const [summary, otherBalance] = await Promise.all([getPolicyAccountSummary(businessId, clientId), getClientAccountBalance(businessId, clientId)]);
  return isPolicyDebtor(summary, otherBalance);
}

function policyCtx(input: PolicyEvaluationInput) {
  return {
    serviceIds: input.serviceIds,
    freeServiceIds: input.freeServiceIds ?? [],
    staffId: input.staffId,
    isNewClient: input.isNewClient,
    isDebtor: input.isDebtor,
    hasActiveMembershipForService: input.hasActiveMembershipForService ?? false,
    visitTotal: input.visitTotal,
  };
}

export async function evaluatePolicyForBooking(businessId: Id, input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
  const [policy, adyenOn] = await Promise.all([getPaymentPolicy(businessId), adyenConnected(businessId)]);
  const applies = policyApplies(policy, policy.conditions, policyCtx(input));
  if (!applies || policy.mode === 'none') return { applies: false, mode: 'none', freeCancellationWindowHours: 0, deadlineMin: 0 };
  if (policy.mode === 'deposit') {
    return {
      applies: true,
      mode: 'deposit',
      depositAmount: policyAmountValue(policy.deposit.amount, input.visitTotal),
      noShowFee: policyNoShowFee(policy.deposit, input.visitTotal, adyenOn),
      freeCancellationWindowHours: policy.deposit.creditDepositOnCancel ? policy.deposit.freeCancellationWindowHours : 0,
      deadlineMin: policy.deposit.paymentDeadlineMin,
    };
  }
  return {
    applies: true,
    mode: 'cardGuarantee',
    lateCancellationFee: policy.cardGuarantee.chargeLateCancellationFee ? policyAmountValue(policy.cardGuarantee.lateCancellationFee, input.visitTotal) : undefined,
    noShowFee: policy.cardGuarantee.chargeNoShowFee ? policyAmountValue(policy.cardGuarantee.noShowFee, input.visitTotal) : undefined,
    freeCancellationWindowHours: policy.cardGuarantee.allowFreeCancellation ? policy.cardGuarantee.freeCancellationWindowHours : 0,
    deadlineMin: policy.cardGuarantee.deadlineMin,
  };
}

/** F-07-124/125: клиент принял условия — снимок записи (fin_records) и резерв депозита на счёте «Payment Policy» */
export async function createBookingPolicySnapshot(businessId: Id, bookingId: Id, clientId: Id, bookingStart: string, input: PolicyEvaluationInput): Promise<BookingPolicySnapshot | null> {
  const [policy, adyenOn] = await Promise.all([getPaymentPolicy(businessId), adyenConnected(businessId)]);
  if (policy.mode === 'none') return null;
  if (!policyApplies(policy, policy.conditions, policyCtx(input))) return null;
  const windowHours = policy.mode === 'deposit' ? (policy.deposit.creditDepositOnCancel ? policy.deposit.freeCancellationWindowHours : 0) : policy.cardGuarantee.allowFreeCancellation ? policy.cardGuarantee.freeCancellationWindowHours : 0;
  const snapshot: BookingPolicySnapshot = {
    bookingId,
    businessId,
    clientId,
    mode: policy.mode,
    depositAmount: policy.mode === 'deposit' ? policyAmountValue(policy.deposit.amount, input.visitTotal) : undefined,
    noShowFee: policy.mode === 'deposit' ? policyNoShowFee(policy.deposit, input.visitTotal, adyenOn) : policy.cardGuarantee.chargeNoShowFee ? policyAmountValue(policy.cardGuarantee.noShowFee, input.visitTotal) : undefined,
    lateCancellationFee: policy.mode === 'cardGuarantee' && policy.cardGuarantee.chargeLateCancellationFee ? policyAmountValue(policy.cardGuarantee.lateCancellationFee, input.visitTotal) : undefined,
    freeCancellationWindowHours: windowHours,
    freeCancellationDeadline: policyFreeCancellationDeadline(bookingStart, windowHours || 0),
    allowReceptionistNotCharge: policy.mode === 'deposit' ? policy.deposit.allowReceptionistNotCharge : policy.cardGuarantee.allowReceptionistNotCharge,
    status: 'clientAccepted',
    createdAt: now(),
  };
  const existing = await snapshotRecord(businessId, bookingId);
  if (existing) await saveSnapshot(businessId, existing, snapshot);
  else await createRecord<BookingPolicySnapshot>(businessId, 'policySnapshot', snapshot, { refId: bookingId, clientId });
  if (policy.mode === 'deposit' && snapshot.depositAmount) await pushPolicyEntry(businessId, clientId, 'topUp', snapshot.depositAmount, 'widget', bookingId, 'client');
  return snapshot;
}

/** F-07-116: разделение визита — доля депозита сверх оставшейся на исходной записи уходит на доступный баланс */
export async function onBookingSplit(businessId: Id, sourceBookingId: Id, retainedShare: Money): Promise<void> {
  const snap = await snapshotRecord(businessId, sourceBookingId);
  if (!snap || snap.mode !== 'deposit' || !snap.depositAmount || snap.status !== 'clientAccepted') return;
  if (retainedShare >= snap.depositAmount) return;
  const refundToBalance = roundToDram(snap.depositAmount - Math.max(0, retainedShare));
  if (refundToBalance > 0) await pushPolicyEntry(businessId, snap.clientId, 'topUp', refundToBalance, 'split', sourceBookingId, 'system');
}

async function activeSnapshotsOf(businessId: Id, bookingIds: Id[]) {
  const recs = await Promise.all(bookingIds.map((id) => snapshotRecord(businessId, id)));
  return recs.filter((r): r is BookingPolicySnapshot & { id: Id } => r !== undefined && r.status === 'clientAccepted');
}

const MERGE_POLICY_ERROR = 'Нельзя объединить записи — у нескольких из них своя политика оплаты (депозит/гарантия картой)';

export async function assertBookingMergeAllowed(businessId: Id, bookingIds: Id[]): Promise<void> {
  if ((await activeSnapshotsOf(businessId, bookingIds)).length > 1) throw new ApiError('validation', MERGE_POLICY_ERROR);
}

/** F-07-116: объединение — единственный активный снимок переезжает на итоговую запись (refId записи документа) */
export async function onBookingMerge(businessId: Id, bookingIds: Id[], targetBookingId: Id): Promise<void> {
  const active = await activeSnapshotsOf(businessId, bookingIds);
  if (active.length > 1) throw new ApiError('validation', MERGE_POLICY_ERROR);
  const rec = active[0];
  if (!rec || rec.bookingId === targetBookingId) return;
  await http('PATCH', `${fb(businessId)}/records/${rec.id}`, { data: { bookingId: targetBookingId }, refId: targetBookingId });
}

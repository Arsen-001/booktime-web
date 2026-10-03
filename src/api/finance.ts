'use client';

/**
 * API раздела «finance». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area'.
 * Контракт для соседей описан в qa/plan/finance.md → «API для соседей»; сигнатуры, отмеченные ниже,
 * держим стабильными (journal, stock, loyalty, payroll, reports, clients, online, client их зовут).
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, canNow, coreTx, currentActor, listBookings } from '@/api/core';
import * as Server from '@/api/finance.server';
import { isApiMode } from '@/api/http';
import { recordDayCloseNoticeSync } from '@/api/notify-dayclose';
import * as PayrollServer from '@/api/payroll.server';
import { ApiError, request } from '@/api/request';
import type { Booking, Id, ISODateTime, Money } from '@/domain/core';
import { prepaidAmount } from '@/domain/rules';
import { EMPTY_BOOKING_EXTRAS, type JournalPaymentLine } from '@/domain/journal';
import type {
  Account,
  AccountInput,
  AccountType,
  AccountTypeInput,
  AdyenConnection,
  AdyenTransaction,
  BookingOnlineCategory,
  BookingPaymentLine,
  BookingPaymentStatus,
  BookingPolicySnapshot,
  BookingPolicyStatus,
  CashShift,
  ZReport,
  ClientAccountTopUp,
  ClientMoneySummary,
  Counterparty,
  CounterpartyInput,
  CustomPaymentMethodInput,
  DebtVisitFilter,
  DocumentFilter,
  FinanceDocument,
  FinanceItem,
  FinanceItemInput,
  FinanceRights,
  FiscalSettings,
  ManualOnlineOrder,
  Operation,
  OperationFilter,
  OperationInput,
  OnlineLinkSettings,
  OnlinePaymentSettings,
  OnlinePaymentWay,
  OnlineProviderKey,
  PaymentLink,
  PaymentLinkInput,
  PaymentMethodsSettings,
  PaymentMethodsSettingsPatch,
  PaymentMethodTile,
  SystemItemKey,
  PaymentNotificationsSettings,
  PaymentPolicy,
  PaymentPolicyServiceOverride,
  PolicyAccountEntry,
  PolicyAccountSummary,
  PolicyApplicabilityContext,
  PrepaymentCalcInput,
  PrepaymentCalcResult,
  PrepaymentSettings,
  OrgRequisiteValues,
  ReceiptRequisiteFlags,
  ReceiptSettings,
  ReceiptSettingsPatch,
  SettlementEntry,
  SettlementEntryKind,
  ServicePrepayment,
  StaffPrepayment,
} from '@/domain/finance';
import {
  accountBalance,
  allocateAmountToLines,
  bookingAmountDue,
  bookingPaymentStatus,
  bookingRefundState,
  buildZReport,
  cashDiscrepancy,
  compareOperationsAsc,
  groupBookingPayments,
  type BookingRefundState,
  paymentGroupKey,
  paymentLineNet,
  calcAcquiringFee,
  calcPrepayment as calcPrepaymentPure,
  CLIENT_ACCOUNT_DEBT_LIMIT,
  computeClientMoneySummary,
  computePolicyAccountSummary,
  defaultPaymentPolicy,
  DEFAULT_ORG_REQUISITES,
  DEFAULT_PAYMENT_NOTIFICATIONS,
  DEFAULT_RECEIPT_REQUISITES,
  effectivePaymentLinkStatus,
  FINANCE_RIGHTS_FULL,
  isPolicyDebtor,
  paymentMethodTiles,
  paymentLinkIsLive,
  policyAmountValue,
  policyApplies,
  policyFreeCancellationDeadline,
  policyNoShowFee,
  roundToDram,
  settlementBalance,
  validateAccountTypeInput,
  vatIncludedInPrice,
} from '@/domain/finance';
import { dayjs, nowDateTime, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizeSearch } from '@/lib/text';

/** Кассовая смена (владелец, 01.10.2026): открыть/закрыть — finance.shift (администратор-кассир) или finance.edit */
function assertCanShift(): void {
  if (!canNow('finance.shift') && !canNow('finance.edit')) throw new ApiError('forbidden', 'Нет права finance.shift');
}

function currentActorId(): string {
  return currentActor().staffId ?? 'system';
}

// ─────────────────────────── Кассы и счета ───────────────────────────

export function listAccounts(businessId: Id, locationIds?: Id[]): Promise<Account[]> {
  if (isApiMode()) return Server.listAccounts(businessId, locationIds);
  return request(() => {
    const all = readArea('finance').accounts.filter((a) => a.businessId === businessId);
    const filtered = locationIds && locationIds.length > 0 ? all.filter((a) => locationIds.includes(a.locationId)) : all;
    return [...filtered].sort((a, b) => a.order - b.order);
  });
}

export interface AccountWithBalance extends Account {
  balance: number;
}

/** Кассы вместе с посчитанным балансом (начальный + операции, без отменённых) */
export function listAccountsWithBalance(businessId: Id, locationIds?: Id[]): Promise<AccountWithBalance[]> {
  if (isApiMode()) return Server.listAccountsWithBalance(businessId, locationIds);
  return request(() => {
    const area = readArea('finance');
    const all = area.accounts.filter((a) => a.businessId === businessId);
    const filtered = locationIds && locationIds.length > 0 ? all.filter((a) => locationIds.includes(a.locationId)) : all;
    return [...filtered]
      .sort((a, b) => a.order - b.order)
      .map((acc) => ({ ...acc, balance: accountBalance(acc, area.operations.filter((op) => op.accountId === acc.id)) }));
  });
}

export function createAccount(businessId: Id, input: AccountInput): Promise<Account> {
  if (isApiMode()) return Server.createAccount(businessId, input);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const maxOrder = Math.max(-1, ...area.accounts.filter((a) => a.businessId === businessId).map((a) => a.order));
    const account: Account = { ...input, id: newId('acc'), businessId, order: maxOrder + 1, createdAt: nowDateTime() };
    mutateArea('finance', (s) => {
      s.accounts.push(account);
    });
    return account;
  });
}

export function updateAccount(businessId: Id, id: Id, patch: Partial<AccountInput>): Promise<Account> {
  if (isApiMode()) return Server.updateAccount(businessId, id, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: Account | undefined;
    mutateArea('finance', (s) => {
      const acc = s.accounts.find((a) => a.id === id && a.businessId === businessId);
      if (acc) {
        Object.assign(acc, patch);
        updated = acc;
      }
    });
    if (!updated) throw new Error('account_not_found');
    return updated;
  });
}

export function removeAccount(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.removeAccount(businessId, id);
  return request(() => {
    assertCan('finance.edit');
    // F-07-004: касса, куда «Методы оплаты» кладут деньги, не удаляется молча — иначе оплата визита уходит в
    // несуществующую кассу и пропадает из остатков (full-test-0930). Сначала выбрать другую кассу у метода.
    const pm = readArea('finance').paymentMethods[businessId];
    if (pm && [pm.cash.accountId, pm.card.accountId, ...pm.custom.filter((c) => c.active).map((c) => c.accountId)].includes(id)) throw new ApiError('account_in_use');
    mutateArea('finance', (s) => {
      s.accounts = s.accounts.filter((a) => !(a.id === id && a.businessId === businessId));
    });
  });
}

export function reorderAccounts(businessId: Id, orderedIds: Id[]): Promise<void> {
  if (isApiMode()) return Server.reorderAccounts(businessId, orderedIds);
  return request(() => {
    assertCan('finance.edit');
    mutateArea('finance', (s) => {
      orderedIds.forEach((id, i) => {
        const acc = s.accounts.find((a) => a.id === id && a.businessId === businessId);
        if (acc) acc.order = i;
      });
    });
  });
}

/** Кассы «по умолчанию» для нового филиала (F-07-002) — соседи (network) зовут при создании филиала */
export function ensureDefaultAccounts(businessId: Id, locationId: Id): Promise<Account[]> {
  if (isApiMode()) return Server.ensureDefaultAccounts(businessId, locationId);
  return request(() => {
    const area = readArea('finance');
    const existing = area.accounts.filter((a) => a.locationId === locationId);
    if (existing.length > 0) return existing;
    const maxOrder = Math.max(-1, ...area.accounts.filter((a) => a.businessId === businessId).map((a) => a.order));
    const cash: Account = { id: newId('acc'), businessId, locationId, name: 'Основная касса', kind: 'cash', openingBalance: 0, order: maxOrder + 1, createdAt: nowDateTime() };
    const card: Account = { id: newId('acc'), businessId, locationId, name: 'Расчётный счёт', kind: 'card', openingBalance: 0, order: maxOrder + 2, createdAt: nowDateTime() };
    mutateArea('finance', (s) => {
      s.accounts.push(cash, card);
    });
    return [cash, card];
  });
}

export interface TransferFundsInput {
  fromAccountId: Id;
  toAccountId: Id;
  amount: number;
  comment?: string;
  date?: string;
  /** Безналичный счёт можно увести в минус (овердрафт) — только после явного «да» в окне (fin-review Ф2) */
  allowOverdraft?: boolean;
}

/**
 * Хватает ли денег на счёте для расхода/перевода (fin-review Ф2). Наличный ящик в минус не уходит никогда —
 * `insufficient_funds` (столько наличных физически нет). Безналичный счёт может (овердрафт), но только если окно
 * спросило и человек согласился: иначе `overdraft` — окно показывает вопрос и повторяет вызов с allowOverdraft.
 * Только внутри request().
 */
function assertAccountCovers(accountId: Id, amount: Money, allowOverdraft: boolean | undefined): void {
  const area = readArea('finance');
  const account = area.accounts.find((a) => a.id === accountId);
  if (!account) return;
  const balance = accountBalance(account, area.operations.filter((o) => o.accountId === accountId));
  if (balance >= amount) return;
  if (account.kind === 'cash') throw new ApiError('insufficient_funds', String(Math.max(0, balance)));
  if (!allowOverdraft) throw new ApiError('overdraft', String(balance));
}

export function transferFunds(businessId: Id, input: TransferFundsInput): Promise<Operation[]> {
  if (isApiMode()) return Server.transferFunds(businessId, input);
  return request(() => {
    assertCan('finance.edit');
    if (input.fromAccountId === input.toAccountId) throw new Error('same_account');
    const area = readArea('finance');
    const from = area.accounts.find((a) => a.id === input.fromAccountId && a.businessId === businessId);
    const to = area.accounts.find((a) => a.id === input.toAccountId && a.businessId === businessId);
    if (!from || !to) throw new Error('account_not_found');
    const itemId = area.itemBySystemKey[businessId]?.otherExpense;
    if (!itemId) throw new Error('item_not_found');
    const amount = roundToDram(input.amount);
    if (!(amount > 0)) throw new ApiError('invalid_amount');
    assertAccountCovers(from.id, amount, input.allowOverdraft);
    const date = input.date ?? nowDateTime();
    const groupId = newId('trg');
    const by = currentActorId();
    const out: Operation = {
      id: newId('op'),
      businessId,
      locationId: from.locationId,
      accountId: from.id,
      itemId,
      kind: 'transfer_out',
      amount,
      date,
      method: 'transfer',
      partyType: 'none',
      comment: input.comment,
      source: 'transfer',
      transferGroupId: groupId,
      createdBy: by,
      createdAt: nowDateTime(),
      history: [{ at: nowDateTime(), by, action: 'created' }],
    };
    const inOp: Operation = { ...out, id: newId('op'), locationId: to.locationId, accountId: to.id, kind: 'transfer_in' };
    mutateArea('finance', (s) => {
      s.operations.push(out, inOp);
    });
    return [out, inOp];
  });
}

// ─────────────────────────── Кассовая смена и Z-отчёт (fin-review Ф1) ───────────────────────────
// Режим api — сервер (этап 21, лейн finance+stock: CashShift, cash-shifts.service.ts).

export function isCashShiftSupported(): boolean {
  return true;
}

export interface CashShiftView {
  shift: CashShift;
  report: ZReport;
  /** Расхождение на закрытии: плюс — излишек, минус — недостача (нет у открытой смены) */
  discrepancy?: Money;
  /** Сколько сейчас должно быть в ящике по учёту (у открытой смены) */
  expectedNow: Money;
}

function shiftViewSync(shift: CashShift): CashShiftView {
  const area = readArea('finance');
  const account = area.accounts.find((a) => a.id === shift.accountId);
  const adjustments = new Set(shift.adjustmentOperationIds ?? []);
  const until = shift.closedAt ?? '9999';
  // Смена — то, что ПРОВЕЛИ за смену (createdAt), а не дата операции: приход «задним числом» во время смены тоже в ящике,
  // и Z «Должно быть» совпадает с «По учёту» при закрытии (full-test-0930: было 189 000 против 192 000)
  const ops = area.operations.filter((o) => {
    const at = o.createdAt ?? o.date;
    return o.accountId === shift.accountId && at >= shift.openedAt && at <= until && !adjustments.has(o.id);
  });
  const report = buildZReport(shift.openingCash, ops, area.itemBySystemKey[shift.businessId]?.refund);
  const expectedNow = account ? accountBalance(account, area.operations.filter((o) => o.accountId === shift.accountId)) : report.expected;
  return {
    shift,
    report,
    discrepancy: shift.countedCash !== undefined && shift.expectedAtClose !== undefined ? cashDiscrepancy(shift.countedCash, shift.expectedAtClose) : undefined,
    expectedNow,
  };
}

/** Смены наличной кассы — новые сверху; открытая (если есть) первой */
export function listCashShifts(businessId: Id, accountId: Id): Promise<CashShiftView[]> {
  if (isApiMode()) return Server.listCashShifts(businessId, accountId);
  return request(() =>
    (readArea('finance').cashShifts ?? [])
      .filter((sh) => sh.businessId === businessId && sh.accountId === accountId)
      .sort((a, b) => (a.status !== b.status ? (a.status === 'open' ? -1 : 1) : a.openedAt < b.openedAt ? 1 : -1))
      .map(shiftViewSync),
  );
}

/** Поправка кассы на расхождение ящика с учётом — отдельной операцией, чтобы остаток сошёлся с пересчётом */
function pushShiftAdjustmentSync(businessId: Id, accountId: Id, diff: Money, comment: string, at: ISODateTime, by: string): Id | undefined {
  if (diff === 0) return undefined;
  const area = readArea('finance');
  const account = area.accounts.find((a) => a.id === accountId);
  const keys = area.itemBySystemKey[businessId] ?? {};
  const itemId = diff > 0 ? keys.otherIncome : keys.otherExpense;
  if (!account || !itemId) throw new ApiError('item_not_found');
  const id = newId('op');
  mutateArea('finance', (s) => {
    s.operations.push({
      id,
      businessId,
      locationId: account.locationId,
      accountId,
      itemId,
      kind: diff > 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      date: at,
      method: 'cash',
      partyType: 'none',
      comment,
      source: 'manual',
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    });
  });
  return id;
}

/** Открыть смену: кассир пересчитал ящик (размен). Не сошлось с учётом — поправка операцией, остаток = пересчёт */
export function openCashShift(businessId: Id, accountId: Id, openingCash: Money, comment?: string): Promise<CashShiftView> {
  if (isApiMode()) return Server.openCashShift(businessId, accountId, openingCash, comment);
  return request(() => {
    assertCanShift();
    const area = readArea('finance');
    const account = area.accounts.find((a) => a.id === accountId && a.businessId === businessId);
    if (!account || account.kind !== 'cash') throw new ApiError('not_cash_account');
    if ((area.cashShifts ?? []).some((sh) => sh.accountId === accountId && sh.status === 'open')) throw new ApiError('shift_already_open');
    const counted = roundToDram(openingCash);
    if (counted < 0) throw new ApiError('invalid_amount');
    const expected = accountBalance(account, area.operations.filter((o) => o.accountId === accountId));
    const by = currentActorId();
    const at = nowDateTime();
    const adj = pushShiftAdjustmentSync(businessId, accountId, cashDiscrepancy(counted, expected), 'Расхождение при открытии смены', at, by);
    const shift: CashShift = {
      id: newId('shf'),
      businessId,
      accountId,
      status: 'open',
      openedAt: at,
      openedBy: by,
      openingCash: counted,
      expectedAtOpen: expected,
      adjustmentOperationIds: adj ? [adj] : [],
      comment: comment?.trim() || undefined,
    };
    mutateArea('finance', (s) => {
      s.cashShifts = [...(s.cashShifts ?? []), shift];
    });
    return shiftViewSync(shift);
  });
}

/** Закрыть смену: пересчёт ящика; недостача/излишек — поправка операцией; результат — Z-отчёт смены */
export function closeCashShift(businessId: Id, shiftId: Id, countedCash: Money, comment?: string): Promise<CashShiftView> {
  if (isApiMode()) return Server.closeCashShift(businessId, shiftId, countedCash, comment);
  return request(() => {
    assertCanShift();
    const area = readArea('finance');
    const shift = (area.cashShifts ?? []).find((sh) => sh.id === shiftId && sh.businessId === businessId);
    if (!shift || shift.status !== 'open') throw new ApiError('shift_not_open');
    const account = area.accounts.find((a) => a.id === shift.accountId);
    if (!account) throw new ApiError('account_not_found');
    const counted = roundToDram(countedCash);
    if (counted < 0) throw new ApiError('invalid_amount');
    const expected = accountBalance(account, area.operations.filter((o) => o.accountId === shift.accountId));
    const by = currentActorId();
    const at = nowDateTime();
    const adj = pushShiftAdjustmentSync(businessId, shift.accountId, cashDiscrepancy(counted, expected), 'Расхождение при закрытии смены', at, by);
    let closed: CashShift | undefined;
    mutateArea('finance', (s) => {
      const target = (s.cashShifts ?? []).find((sh) => sh.id === shiftId);
      if (!target) return;
      target.status = 'closed';
      target.closedAt = at;
      target.closedBy = by;
      target.countedCash = counted;
      target.expectedAtClose = expected;
      if (adj) target.adjustmentOperationIds = [...(target.adjustmentOperationIds ?? []), adj];
      if (comment?.trim()) target.comment = [target.comment, comment.trim()].filter(Boolean).join(' · ');
      closed = target;
    });
    if (!closed) throw new ApiError('shift_not_open');
    // ⭐ «Закрыт день» владельцу в колокольчик (01.10.2026): снимок итога дня, без изменений — не дублирует
    recordDayCloseNoticeSync(businessId, at, by);
    return shiftViewSync(closed);
  });
}

// ─────────────────────────── Статьи ───────────────────────────

export function listItems(businessId: Id): Promise<FinanceItem[]> {
  if (isApiMode()) return Server.listItemsRemembering(businessId);
  return request(() => readArea('finance').items.filter((i) => i.businessId === businessId));
}

export function createItem(businessId: Id, input: FinanceItemInput): Promise<FinanceItem> {
  if (isApiMode()) return Server.createItem(businessId, input);
  return request(() => {
    assertCan('finance.edit');
    const item: FinanceItem = { ...input, id: newId('fit'), businessId, createdAt: nowDateTime() };
    mutateArea('finance', (s) => {
      s.items.push(item);
    });
    return item;
  });
}

export function updateItem(businessId: Id, id: Id, patch: Partial<FinanceItemInput>): Promise<FinanceItem> {
  if (isApiMode()) return Server.updateItem(businessId, id, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: FinanceItem | undefined;
    mutateArea('finance', (s) => {
      const item = s.items.find((i) => i.id === id && i.businessId === businessId);
      if (item) {
        Object.assign(item, patch);
        updated = item;
      }
    });
    if (!updated) throw new Error('item_not_found');
    return updated;
  });
}

export function removeItem(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.removeItem(businessId, id);
  return request(() => {
    const area = readArea('finance');
    const item = area.items.find((i) => i.id === id && i.businessId === businessId);
    if (item?.system) throw new Error('system_item_locked');
    mutateArea('finance', (s) => {
      s.items = s.items.filter((i) => !(i.id === id && i.businessId === businessId));
    });
  });
}

// ─────────────────────────── Операции ───────────────────────────

function matchesFilter(op: Operation, filter?: OperationFilter): boolean {
  if (!filter) return true;
  if (filter.locationIds && filter.locationIds.length > 0 && !filter.locationIds.includes(op.locationId)) return false;
  if (filter.accountId && op.accountId !== filter.accountId) return false;
  if (filter.itemId && op.itemId !== filter.itemId) return false;
  if (filter.kind && op.kind !== filter.kind) return false;
  if (filter.method && op.method !== filter.method) return false;
  if (filter.partyType && op.partyType !== filter.partyType) return false;
  if (filter.partyId && op.partyId !== filter.partyId) return false;
  if (filter.cancelled !== undefined && Boolean(op.cancelled) !== filter.cancelled) return false;
  if (filter.dateFrom && op.date < filter.dateFrom) return false;
  if (filter.dateTo && op.date > filter.dateTo) return false;
  if (filter.search) {
    const q = normalizeSearch(filter.search);
    const hay = normalizeSearch(`${op.partyName ?? ''} ${op.comment ?? ''}`);
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function listOperations(businessId: Id, filter?: OperationFilter): Promise<Operation[]> {
  if (isApiMode()) return Server.listOperations(businessId, filter);
  return request(() => {
    const ops = readArea('finance').operations.filter((op) => op.businessId === businessId && matchesFilter(op, filter));
    // fin-review Ф18: один порядок и для списка, и для «Остатка в кассе» — новые сверху (обратный compareOperationsAsc)
    return [...ops].sort((a, b) => compareOperationsAsc(b, a));
  });
}

export function getOperation(businessId: Id, id: Id): Promise<Operation> {
  if (isApiMode()) return Server.getOperation(businessId, id);
  return request(() => {
    const op = readArea('finance').operations.find((o) => o.id === id && o.businessId === businessId);
    // fin-review Ф24: демо-база пересоздаётся с новыми id — старая ссылка ведёт в «не найдено», а не в ошибку сервера
    if (!op) throw new ApiError('not_found', 'operation_not_found');
    return op;
  });
}

/**
 * Одна ручная (или системная — вызывается соседями) операция (F-07-012/018). ОДНА бизнес-операция —
 * ОДИН вызов; соседи (journal, stock, loyalty, payroll) зовут её из своих api, а не собирают запись сами.
 */
export function recordOperation(businessId: Id, input: OperationInput, options?: { allowOverdraft?: boolean; checkFunds?: boolean }): Promise<Operation> {
  if (isApiMode()) return Server.recordOperation(businessId, input);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const account = area.accounts.find((a) => a.id === input.accountId && a.businessId === businessId);
    if (!account) throw new Error('account_not_found');
    // fin-review Ф2: расход не уводит наличную кассу в минус, безналичный счёт — только с согласия
    // Проверка — по просьбе вызывающего (форма «Новый платёж»): склад и другие соседи проводят свои документы как раньше
    if (input.kind === 'expense' && options?.checkFunds) assertAccountCovers(account.id, roundToDram(input.amount), options.allowOverdraft);
    const by = currentActorId();
    const op: Operation = {
      id: newId('op'),
      businessId,
      locationId: input.locationId,
      accountId: input.accountId,
      itemId: input.itemId,
      kind: input.kind,
      amount: roundToDram(input.amount),
      date: input.date,
      method: input.method,
      partyType: input.partyType,
      partyId: input.partyId,
      partyName: input.partyName,
      comment: input.comment,
      source: input.source ?? 'manual',
      refId: input.refId,
      lineLabel: input.lineLabel,
      createdBy: by,
      createdAt: nowDateTime(),
      history: [{ at: nowDateTime(), by, action: 'created' }],
    };
    mutateArea('finance', (s) => {
      s.operations.push(op);
      // F-09-109: ручной «Новый платёж» со статьёй «Зарплата персонала» и сотрудником-получателем —
      // это тоже выплата зарплаты, не только кнопка «Выдать зарплату» (F-07-160/F-09-078). Должна
      // попасть в его взаиморасчёты так же, как через кнопку — иначе баланс там не видит эти деньги.
      if (op.itemId === area.itemBySystemKey[businessId]?.staffPayroll && op.kind === 'expense' && op.partyType === 'staff' && op.partyId) {
        s.settlementEntries.push({
          id: newId('set'),
          businessId,
          staffId: op.partyId,
          kind: 'payout',
          amount: op.amount,
          label: op.lineLabel || 'Выплата зарплаты',
          comment: op.comment,
          operationId: op.id,
          createdAt: op.createdAt,
          createdBy: op.createdBy,
        });
      }
    });
    return op;
  });
}

export type OperationUpdate = Partial<Pick<Operation, 'accountId' | 'itemId' | 'amount' | 'date' | 'method' | 'partyType' | 'partyId' | 'partyName' | 'comment'>>;

export function updateOperation(businessId: Id, id: Id, patch: OperationUpdate): Promise<Operation> {
  if (isApiMode()) return Server.updateOperation(businessId, id, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: Operation | undefined;
    const by = currentActorId();
    mutateArea('finance', (s) => {
      const op = s.operations.find((o) => o.id === id && o.businessId === businessId);
      if (!op) return;
      if (op.cancelled) throw new Error('operation_cancelled');
      // F-07-014: оплату визита и пополнение счёта правят там, где провели (окно визита, карточка клиента)
      if (op.source === 'booking' || op.source === 'account') throw new ApiError('operation_linked');
      const entries: typeof op.history = [];
      (Object.keys(patch) as (keyof OperationUpdate)[]).forEach((key) => {
        const next = patch[key];
        if (next === undefined) return;
        const prev = op[key];
        if (prev === next) return;
        entries.push({ at: nowDateTime(), by, action: 'edited', field: key, from: String(prev ?? ''), to: String(next ?? '') });
        (op as unknown as Record<string, unknown>)[key] = next;
      });
      op.history.push(...entries);
      updated = op;
    });
    if (!updated) throw new Error('operation_not_found');
    return updated;
  });
}

/** Отмена операции (F-07-015) — удаления нет; отменяет и связанную комиссию/перевод-пару (F-07-034) */
export function cancelOperation(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.cancelOperation(businessId, id);
  return request(() => {
    assertCan('finance.edit');
    const by = currentActorId();
    mutateArea('finance', (s) => {
      const op = s.operations.find((o) => o.id === id && o.businessId === businessId);
      if (!op || op.cancelled) return;
      if (op.source === 'booking' || op.source === 'account') throw new ApiError('operation_linked');
      const toCancel = [op];
      if (op.feeOperationId) {
        const fee = s.operations.find((o) => o.id === op.feeOperationId);
        if (fee) toCancel.push(fee);
      }
      if (op.transferGroupId) {
        const pair = s.operations.filter((o) => o.transferGroupId === op.transferGroupId && o.id !== op.id);
        toCancel.push(...pair);
      }
      toCancel.forEach((o) => {
        o.cancelled = true;
        o.cancelledAt = nowDateTime();
        o.history.push({ at: nowDateTime(), by, action: 'cancelled' });
      });
      // F-09-109: отмена операции возвращает сумму в баланс взаиморасчётов сотрудника — не только для
      // «Выдать зарплату» (payoutSalary/cancelSalaryPayout), но и для выплаты через обычный «Новый платёж».
      const cancelledIds = new Set(toCancel.map((o) => o.id));
      s.settlementEntries = s.settlementEntries.filter((e) => !(e.businessId === businessId && e.operationId && cancelledIds.has(e.operationId)));
    });
  });
}

// ─────────────────────────── Контрагенты ───────────────────────────

export function listCounterparties(businessId: Id): Promise<Counterparty[]> {
  if (isApiMode()) return Server.listCounterparties(businessId);
  return request(() => readArea('finance').counterparties.filter((c) => c.businessId === businessId));
}

export function createCounterparty(businessId: Id, input: CounterpartyInput): Promise<Counterparty> {
  if (isApiMode()) return Server.createCounterparty(businessId, input);
  return request(() => {
    assertCan('finance.edit');
    const cp: Counterparty = { ...input, id: newId('cpt'), businessId, createdAt: nowDateTime() };
    mutateArea('finance', (s) => {
      s.counterparties.push(cp);
    });
    return cp;
  });
}

export function updateCounterparty(businessId: Id, id: Id, patch: Partial<CounterpartyInput>): Promise<Counterparty> {
  if (isApiMode()) return Server.updateCounterparty(businessId, id, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: Counterparty | undefined;
    mutateArea('finance', (s) => {
      const cp = s.counterparties.find((c) => c.id === id && c.businessId === businessId);
      if (cp) {
        Object.assign(cp, patch);
        updated = cp;
      }
    });
    if (!updated) throw new Error('counterparty_not_found');
    return updated;
  });
}

export function removeCounterparty(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.removeCounterparty(businessId, id);
  return request(() => {
    assertCan('finance.edit');
    mutateArea('finance', (s) => {
      s.counterparties = s.counterparties.filter((c) => !(c.id === id && c.businessId === businessId));
    });
  });
}

/** Импорт контрагентов из Excel/CSV (F-07-022) — строки уже разобраны и проверены экраном */
export function importCounterparties(businessId: Id, rows: CounterpartyInput[]): Promise<Counterparty[]> {
  if (isApiMode()) return Server.importCounterparties(businessId, rows);
  return request(() => {
    assertCan('finance.edit');
    const created = rows.map((r) => ({ ...r, id: newId('cpt'), businessId, createdAt: nowDateTime() }) satisfies Counterparty);
    mutateArea('finance', (s) => {
      s.counterparties.push(...created);
    });
    return created;
  });
}

/** Импорт операций из Excel (F-07-017) — строки уже разобраны и проверены экраном */
export function importOperations(businessId: Id, rows: OperationInput[]): Promise<Operation[]> {
  if (isApiMode()) return Server.importOperations(businessId, rows);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const by = currentActorId();
    const created: Operation[] = [];
    for (const input of rows) {
      const account = area.accounts.find((a) => a.id === input.accountId && a.businessId === businessId);
      if (!account) continue;
      created.push({
        id: newId('op'),
        businessId,
        locationId: input.locationId,
        accountId: input.accountId,
        itemId: input.itemId,
        kind: input.kind,
        amount: roundToDram(input.amount),
        date: input.date,
        method: input.method,
        partyType: input.partyType,
        partyId: input.partyId,
        partyName: input.partyName,
        comment: input.comment,
        source: 'import',
        createdBy: by,
        createdAt: nowDateTime(),
        history: [{ at: nowDateTime(), by, action: 'imported' }],
      });
    }
    mutateArea('finance', (s) => {
      s.operations.push(...created);
    });
    return created;
  });
}

// ─────────────────────────── Документы ───────────────────────────

function matchesDocumentFilter(doc: FinanceDocument, filter?: DocumentFilter): boolean {
  if (!filter) return true;
  if (filter.type && doc.type !== filter.type) return false;
  if (filter.contentKind && doc.contentKind !== filter.contentKind) return false;
  if (filter.dateFrom && doc.date < filter.dateFrom) return false;
  if (filter.dateTo && doc.date > filter.dateTo) return false;
  if (filter.search) {
    const q = normalizeSearch(filter.search);
    if (!normalizeSearch(doc.number).includes(q)) return false;
  }
  return true;
}

export function listDocuments(businessId: Id, filter?: DocumentFilter): Promise<FinanceDocument[]> {
  if (isApiMode()) return Server.listDocuments(businessId, filter);
  return request(() => {
    const docs = readArea('finance').documents.filter((d) => d.businessId === businessId && matchesDocumentFilter(d, filter));
    return [...docs].sort((a, b) => (a.date < b.date ? 1 : -1));
  });
}

export function getDocument(businessId: Id, id: Id): Promise<FinanceDocument> {
  if (isApiMode()) return Server.getDocument(businessId, id);
  return request(() => {
    const doc = readArea('finance').documents.find((d) => d.id === id && d.businessId === businessId);
    if (!doc) throw new Error('document_not_found');
    return doc;
  });
}

export function updateDocument(businessId: Id, id: Id, patch: { note?: string }): Promise<FinanceDocument> {
  if (isApiMode()) return Server.updateDocument(businessId, id, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: FinanceDocument | undefined;
    mutateArea('finance', (s) => {
      const doc = s.documents.find((d) => d.id === id && d.businessId === businessId);
      if (doc) {
        Object.assign(doc, patch);
        updated = doc;
      }
    });
    if (!updated) throw new Error('document_not_found');
    return updated;
  });
}

// ─────────────────────────── Помощники для соседей (стабильный контракт) ───────────────────────────

/** Список способов оплаты с кассой по умолчанию — временно (до b02) равен списку касс */
export function listPaymentMethods(businessId: Id): Promise<Account[]> {
  return listAccounts(businessId);
}

/** Сводка дня для журнала (F-01-011): приход/расход, разбивка по способам */
export function getDayCashSummary(businessId: Id, date: string, locationIds?: Id[]): Promise<{ income: number; expense: number; cash: number; card: number }> {
  if (isApiMode()) return Server.getDayCashSummary(businessId, date, locationIds);
  return request(() => {
    const area = readArea('finance');
    const ops = area.accounts
      .filter((a) => a.businessId === businessId && (!locationIds?.length || locationIds.includes(a.locationId)))
      .flatMap((a) => area.operations.filter((op) => op.accountId === a.id));
    const dayOps = ops.filter((op) => !op.cancelled && dayjs(op.date).format('YYYY-MM-DD') === date);
    const income = dayOps.filter((o) => o.kind === 'income').reduce((s, o) => s + o.amount, 0);
    const expense = dayOps.filter((o) => o.kind === 'expense').reduce((s, o) => s + o.amount, 0);
    const cash = dayOps.filter((o) => o.method === 'cash').reduce((s, o) => s + (o.kind === 'income' ? o.amount : -o.amount), 0);
    const card = dayOps.filter((o) => o.method === 'card').reduce((s, o) => s + (o.kind === 'income' ? o.amount : -o.amount), 0);
    return { income, expense, cash, card };
  });
}

export interface DayMoneySummary {
  clientsCount: number;
  cashIn: Money;
  cardIn: Money;
  totalIn: Money;
  doneTotal: Money;
  recordsTotal: Money;
  loyaltyTotal: Money;
  goodsTotal: Money;
}

/** Сводка денег за день в журнале (F-07-046) — «поступлений в кассы», «оплата наличными/безналом»,
 *  «выполнено/записей/лояльностью/товаров на сумму». Право «Показывать статистику» проверяет вызывающий
 *  экран (canFinanceViewStats). */
export function getDayMoneySummary(businessId: Id, date: string, locationIds?: Id[]): Promise<DayMoneySummary> {
  if (isApiMode()) return Server.getDayMoneySummary(businessId, date, locationIds);
  return request(() => {
    const area = readArea('finance');
    const core = readCore();
    const locIds = locationIds?.length ? locationIds : core.locations.filter((l) => l.businessId === businessId).map((l) => l.id);
    const accIds = new Set(area.accounts.filter((a) => a.businessId === businessId && locIds.includes(a.locationId)).map((a) => a.id));
    const dayOps = area.operations.filter((op) => !op.cancelled && accIds.has(op.accountId) && dayjs(op.date).format('YYYY-MM-DD') === date);
    const cashIn = dayOps.filter((o) => o.method === 'cash' && o.kind === 'income').reduce((s, o) => s + o.amount, 0);
    const cardIn = dayOps.filter((o) => o.method !== 'cash' && o.kind === 'income').reduce((s, o) => s + o.amount, 0);
    const totalIn = cashIn + cardIn;
    const goodsItemId = area.itemBySystemKey[businessId]?.goodsSale;
    const goodsTotal = goodsItemId ? dayOps.filter((o) => o.kind === 'income' && o.itemId === goodsItemId).reduce((s, o) => s + o.amount, 0) : 0;

    const dayBookings = core.bookings.filter((b) => b.businessId === businessId && locIds.includes(b.locationId) && dayjs(b.start).format('YYYY-MM-DD') === date);
    const recordsTotal = dayBookings.reduce((s, b) => s + b.total, 0);
    const doneTotal = dayBookings.filter((b) => b.status === 'arrived').reduce((s, b) => s + b.total, 0);
    const dayBookingIds = new Set(dayBookings.map((b) => b.id));
    const loyaltyTotal = area.bookingPayments.filter((p) => p.businessId === businessId && !p.cancelled && dayBookingIds.has(p.bookingId) && (p.kind === 'account' || p.kind === 'discount')).reduce((s, p) => s + p.amount, 0);
    const clientsCount = new Set(dayBookings.map((b) => b.clientId).filter(Boolean)).size;

    return { clientsCount, cashIn, cardIn, totalIn, doneTotal, recordsTotal, loyaltyTotal, goodsTotal };
  });
}

// ─────────────────────────── Методы оплаты и комиссии (F-07-025…030, 032, 033, 035) ───────────────────────────

function defaultPaymentMethodsSettings(businessId: Id, cashAccountId: Id | null, cardAccountId: Id | null): PaymentMethodsSettings {
  return {
    businessId,
    cash: { accountId: cashAccountId, cashierMode: 'default' },
    card: { perBrand: false, feePct: 0, brands: [], accountId: cardAccountId, settlementDays: 0 },
    installment: { enabled: false, plans: [] },
    custom: [],
    feeShare: 'business',
    updatedAt: nowDateTime(),
  };
}

/** Синхронный двойник getPaymentMethodsSettings — только внутри request() (§16.2/§18.7) */
function paymentMethodsSettingsSync(businessId: Id): PaymentMethodsSettings {
  const area = readArea('finance');
  const existing = area.paymentMethods[businessId];
  if (existing) return existing;
  const accs = area.accounts.filter((a) => a.businessId === businessId).sort((a, b) => a.order - b.order);
  const cash = accs.find((a) => a.kind === 'cash')?.id ?? null;
  const card = accs.find((a) => a.kind === 'card')?.id ?? cash;
  const created = defaultPaymentMethodsSettings(businessId, cash, card);
  mutateArea('finance', (s) => {
    s.paymentMethods[businessId] = created;
  });
  return created;
}

/** Настройки методов оплаты (F-07-025) — если бизнес завёлся без сида, создаёт настройки по умолчанию */
export function getPaymentMethodsSettings(businessId: Id): Promise<PaymentMethodsSettings> {
  if (isApiMode()) return Server.getPaymentMethodsSettings(businessId);
  return request(() => paymentMethodsSettingsSync(businessId));
}

/** Сохранение методов оплаты и комиссии (F-07-025) — действует сразу на новые оплаты, старые не пересчитывает */
export function savePaymentMethodsSettings(businessId: Id, patch: PaymentMethodsSettingsPatch): Promise<PaymentMethodsSettings> {
  if (isApiMode()) return Server.savePaymentMethodsSettings(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: PaymentMethodsSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.paymentMethods[businessId] ?? defaultPaymentMethodsSettings(businessId, null, null);
      const next: PaymentMethodsSettings = {
        ...current,
        cash: { ...current.cash, ...patch.cash },
        card: { ...current.card, ...patch.card, brands: patch.card?.brands ?? current.card.brands },
        installment: { ...current.installment, ...patch.installment, plans: patch.installment?.plans ?? current.installment.plans },
        feeShare: patch.feeShare ?? current.feeShare,
        updatedAt: nowDateTime(),
      };
      s.paymentMethods[businessId] = next;
      updated = next;
    });
    if (!updated) throw new Error('settings_not_found');
    return updated;
  });
}

/** Добавить свой способ оплаты (F-07-030) — сразу «Подключено» и виден в окне оплаты */
export function addCustomPaymentMethod(businessId: Id, input: CustomPaymentMethodInput): Promise<PaymentMethodsSettings> {
  if (isApiMode()) return Server.addCustomPaymentMethod(businessId, input);
  return request(() => {
    assertCan('finance.edit');
    let updated: PaymentMethodsSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.paymentMethods[businessId] ?? defaultPaymentMethodsSettings(businessId, null, null);
      const next: PaymentMethodsSettings = {
        ...current,
        custom: [...current.custom, { id: newId('cpm'), name: input.name, feePct: input.feePct, accountId: input.accountId, active: true }],
        updatedAt: nowDateTime(),
      };
      s.paymentMethods[businessId] = next;
      updated = next;
    });
    if (!updated) throw new Error('settings_not_found');
    return updated;
  });
}

/** Правка своего способа оплаты — имя, комиссия, касса, «Подключено/Отключено» */
export function updateCustomPaymentMethod(businessId: Id, id: Id, patch: Partial<CustomPaymentMethodInput & { active: boolean }>): Promise<PaymentMethodsSettings> {
  if (isApiMode()) return Server.updateCustomPaymentMethod(businessId, id, patch);
  return request(() => {
    assertCan('finance.edit');
    let updated: PaymentMethodsSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.paymentMethods[businessId];
      if (!current) return;
      const next: PaymentMethodsSettings = { ...current, custom: current.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)), updatedAt: nowDateTime() };
      s.paymentMethods[businessId] = next;
      updated = next;
    });
    if (!updated) throw new Error('settings_not_found');
    return updated;
  });
}

/** Плитки способов оплаты для окна визита (F-07-025…030) — из сохранённых настроек */
export function listBookingPaymentTiles(businessId: Id): Promise<PaymentMethodTile[]> {
  if (isApiMode()) return Server.listBookingPaymentTiles(businessId);
  return getPaymentMethodsSettings(businessId).then((settings) => paymentMethodTiles(settings));
}

// ─────────────────────────── Оплата визита (F-07-036…050, 181, 184) ───────────────────────────

function requireBooking(businessId: Id, bookingId: Id): Promise<Booking> {
  return listBookings({ businessId, includeDeleted: true }).then((all) => {
    const b = all.find((x) => x.id === bookingId);
    if (!b) throw new Error('booking_not_found');
    return b;
  });
}

/** Синхронный двойник requireBooking — только внутри request() (§16.2/§18.7) */
function requireBookingSync(businessId: Id, bookingId: Id): Booking {
  const b = readCore().bookings.find((x) => x.id === bookingId && x.businessId === businessId);
  if (!b) throw new Error('booking_not_found');
  return b;
}

/** Товар визита в окне оплаты: строка журнала, которую продаёт склад (только товары склада, qty > 0) */
export interface BookingGoodsDueLine {
  name: string;
  qty: number;
  price: Money;
  total: Money;
}

/**
 * Товары визита (строки журнала extras.goodsLines, которые склад продаёт документом «Продажа товара»). Их деньги
 * входят в «К оплате», но в кассу finance НЕ идут — выручку товаров кладёт в кассу документ продажи склада
 * (journal.syncVisitGoodsSale), иначе был бы двойной счёт. Сумма — как у journal (сводка дня): round(price×qty×(1−скидка)).
 */
function goodsLinesOf(booking: Booking): BookingGoodsDueLine[] {
  const lines = readArea('journal').extras[booking.id]?.goodsLines ?? [];
  if (lines.length === 0) return [];
  const goods = readArea('stock').goods.filter((g) => g.businessId === booking.businessId);
  const result: BookingGoodsDueLine[] = [];
  for (const l of lines) {
    const good = goods.find((g) => g.id === l.itemId);
    if (!good || !(l.qty > 0)) continue;
    result.push({ name: good.name, qty: l.qty, price: l.price, total: Math.round(l.price * l.qty * (1 - (l.discountPct ?? 0) / 100)) });
  }
  return result;
}

/** Строки к оплате: сначала услуги визита (индексы booking.services), за ними — его товары (индексы после услуг) */
function lineTotalsOf(booking: Booking): Money[] {
  return [...booking.services.map((s) => roundToDram(s.price * s.qty)), ...goodsLinesOf(booking).map((g) => g.total)];
}

/** Сумма к оплате визита: услуги (booking.total) + товары */
function payableTotalOf(booking: Booking): Money {
  return roundToDram(booking.total + goodsLinesOf(booking).reduce((sum, g) => sum + g.total, 0));
}

/** ⭐ F-00-097: предоплата, которую мастер отметил «получена» (перевод мимо кассы), — уже оплаченная часть визита.
 * Возвращённая («Вернул», F-00-100) больше не оплата. */
function prepaidOf(booking: Booking): Money {
  if (booking.prepayment?.refundedAt) return 0;
  return Math.min(prepaidAmount(booking), payableTotalOf(booking));
}

const PREPAYMENT_LINE_LABEL = 'Предоплата';

/** Касса «Предоплата на реквизиты» филиала (заводится при первой предоплате) — деньги у мастера, не в ящике салона */
function prepaymentAccountSync(businessId: Id, locationId: Id): Id {
  const area = readArea('finance');
  const existing = area.accounts.find((a) => a.businessId === businessId && a.locationId === locationId && a.systemKey === 'prepayment');
  if (existing) return existing.id;
  const id = newId('acc');
  const order = Math.max(-1, ...area.accounts.filter((a) => a.businessId === businessId).map((a) => a.order)) + 1;
  mutateArea('finance', (s) => {
    s.accounts.push({ id, businessId, locationId, name: 'Предоплата на реквизиты', kind: 'other', openingBalance: 0, order, systemGenerated: true, systemKey: 'prepayment', createdAt: nowDateTime() });
  });
  return id;
}

function prepaymentOpsOf(businessId: Id, bookingId: Id): Operation[] {
  return readArea('finance').operations.filter((o) => o.businessId === businessId && o.refId === bookingId && o.lineLabel === PREPAYMENT_LINE_LABEL && !o.cancelled);
}

/**
 * ⭐ F-00-097 (решение владельца 01.10.2026): мастер подтвердил «Деньги пришли» — предоплата, переведённая на его
 * реквизиты, становится своей операцией в финансах (приход «Оказание услуг», способ «перевод», касса «Предоплата на
 * реквизиты», привязана к записи). На визите касса берёт только остаток (amountDueOf), поэтому деньги дня сходятся
 * ровно один раз. Только внутри request() вызывающего (online.confirmPrepaymentReceived), повтор — без дубля.
 */
export function recordPrepaymentReceivedSync(bookingId: Id): void {
  const booking = readCore().bookings.find((b) => b.id === bookingId);
  const amount = booking?.prepayment?.amount ?? 0;
  if (!booking || amount <= 0) return;
  if (prepaymentOpsOf(booking.businessId, booking.id).some((o) => o.kind === 'income')) return;
  const itemId = readArea('finance').itemBySystemKey[booking.businessId]?.servicePayment;
  if (!itemId) return;
  const accountId = prepaymentAccountSync(booking.businessId, booking.locationId);
  const client = booking.clientId ? readCore().clients.find((c) => c.id === booking.clientId) : undefined;
  const by = currentActorId();
  const at = nowDateTime();
  mutateArea('finance', (s) => {
    s.operations.push({
      id: newId('op'),
      businessId: booking.businessId,
      locationId: booking.locationId,
      accountId,
      itemId,
      kind: 'income',
      amount: roundToDram(amount),
      date: at,
      method: 'transfer',
      partyType: client ? 'client' : 'none',
      partyId: client?.id,
      partyName: client?.name,
      comment: booking.prepayment?.full ? 'Оплата всей суммы переводом на реквизиты мастера' : 'Предоплата переводом на реквизиты мастера',
      source: 'booking',
      refId: booking.id,
      lineLabel: PREPAYMENT_LINE_LABEL,
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    });
  });
}

/**
 * ⭐ F-00-100: мастер нажал «Вернул» — обратная операция на ту же сумму (расход «Возврат» из кассы «Предоплата на
 * реквизиты»). Только внутри request() вызывающего (journal.markPrepaymentRefunded); повтор — без дубля.
 */
export function recordPrepaymentRefundSync(bookingId: Id): void {
  const booking = readCore().bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  const ops = prepaymentOpsOf(booking.businessId, booking.id);
  const received = ops.find((o) => o.kind === 'income');
  if (!received || ops.some((o) => o.kind === 'expense')) return;
  const itemId = readArea('finance').itemBySystemKey[booking.businessId]?.refund ?? received.itemId;
  const by = currentActorId();
  const at = nowDateTime();
  mutateArea('finance', (s) => {
    s.operations.push({
      ...received,
      id: newId('op'),
      itemId,
      kind: 'expense',
      date: at,
      comment: 'Возврат предоплаты клиенту',
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    });
    const src = s.operations.find((o) => o.id === received.id);
    if (src) {
      src.refundedAmount = received.amount;
      src.history.push({ at, by, action: 'refunded' });
    }
  });
}

/**
 * Остаток к оплате визита — ОДНО правило для сводки и для проведения денег: сумма визита минус платежи и полученная
 * предоплата. Без предоплаты в расчёте «Быстрая оплата» проводила всю сумму, хотя окно просило остаток (full-test-0930).
 */
function amountDueOf(booking: Booking, lines: Pick<BookingPaymentLine, 'amount' | 'cancelled'>[]): Money {
  const prepaid = prepaidOf(booking);
  return bookingAmountDue(payableTotalOf(booking), prepaid > 0 ? [...lines, { amount: prepaid, cancelled: false }] : lines);
}

function serviceLabel(booking: Booking, index: number): string {
  const line = booking.services[index];
  if (!line) return '';
  const core = readCore();
  return core.services.find((s) => s.id === line.serviceId)?.name.ru ?? 'Услуга';
}

export interface BookingPaymentSummary {
  booking: Booking;
  lineTotals: Money[];
  payments: BookingPaymentLine[];
  due: Money;
  status: BookingPaymentStatus;
  note?: string;
  /** Сколько клиенту вернули (деньгами и на счёт) — возвращённое снова к оплате (решение владельца 01.10.2026) */
  refunded?: Money;
  /** Возвращено всё / часть / ничего — «Возвращено», «Частично возвращено» в окне оплаты */
  refundState?: BookingRefundState;
  /**
   * Платежи-зеркала строк лояльности (бонусы, сертификат, абонемент — loyalty пишет их сюда скидкой): отменять их
   * можно только во вкладке «Лояльность», иначе бонусы/сертификат клиенту не вернутся (loyalty-review)
   */
  loyaltyGroupKeys?: string[];
  /** Товары визита — входят в «К оплате» (сервер api-режима их пока не отдаёт) */
  goods?: BookingGoodsDueLine[];
  /** Сумма визита к оплате: услуги + товары (нет — booking.total) */
  total?: Money;
  /** Предоплата, полученная мастером переводом (F-00-097), — уже вычтена из due */
  prepaid?: Money;
}

/** Сводка по уже прочитанным данным — одна для синхронного и асинхронного пути */
function buildBookingPaymentSummary(businessId: Id, booking: Booking): BookingPaymentSummary {
  const area = readArea('finance');
  const lineTotals = lineTotalsOf(booking);
  const goods = goodsLinesOf(booking);
  const total = payableTotalOf(booking);
  const payments = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === booking.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const active = payments.filter((p) => !p.cancelled);
  // ⭐ F-00-097: предоплата, которую мастер отметил «получена» (перевод на его реквизиты, мимо кассы), — уже
  // оплаченная часть визита: к оплате только остаток, «всю сумму сразу» — визит оплачен
  const prepaid = prepaidOf(booking);
  const counted = prepaid > 0 ? [...active, { amount: prepaid, cancelled: false }] : active;
  const due = bookingAmountDue(total, counted);
  const status = bookingPaymentStatus(total, counted);
  const refund = bookingRefundState(active);
  const mirrored = new Set(
    (readArea('loyalty').transactions ?? []).filter((tx) => tx.businessId === businessId && tx.bookingId === booking.id && tx.financeLineId).map((tx) => tx.financeLineId as Id),
  );
  const loyaltyGroupKeys = [...new Set(payments.filter((p) => mirrored.has(p.id)).map(paymentGroupKey))];
  return { booking, lineTotals, payments, due, status, note: area.bookingPaymentNotes[`${businessId}:${booking.id}`], refunded: refund.refunded, refundState: refund.state, loyaltyGroupKeys, goods, total, prepaid: prepaid || undefined };
}

/** Синхронный двойник getBookingPaymentSummary — только внутри request() (§16.2/§18.7), чтобы оплата и её сводка были ОДНОЙ транзакцией (defect-1, F-07-039/045) */
function bookingPaymentSummarySync(businessId: Id, bookingId: Id): BookingPaymentSummary {
  return buildBookingPaymentSummary(businessId, requireBookingSync(businessId, bookingId));
}

/** Всё для окна оплаты визита за один запрос: строки, платежи, остаток, статус, примечание (F-07-039/181/045/047) */
export function getBookingPaymentSummary(businessId: Id, bookingId: Id): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.getBookingPaymentSummary(businessId, bookingId);
  // Одним request(): поиск записи (те же условия, что listBookings({ businessId, includeDeleted }) — без своих прав)
  // и сводка с товарами визита читают базу внутри запроса — без второй задержки и без [mock-db] «вне request()»
  return request(() => bookingPaymentSummarySync(businessId, bookingId));
}

/** Коротко об оплате визита — для списков, где нужна только строка «оплачено / к оплате» */
export interface BookingPaymentBrief {
  /** Сумма визита к оплате: услуги + товары */
  total: Money;
  /** Осталось оплатить (предоплата переводом уже вычтена) */
  due: Money;
  /** Оплачено: total − due — деньги, счёт, скидки и полученная предоплата */
  paid: Money;
  status: BookingPaymentStatus;
}

function briefOf(summary: BookingPaymentSummary): BookingPaymentBrief {
  const total = summary.total ?? summary.booking.total;
  return { total, due: summary.due, paid: Math.max(0, total - summary.due), status: summary.status };
}

/** «Оплачено / к оплате» синхронно — только внутри request() соседа (журнал: незакрытые визиты, сводки дня) */
export function bookingPaymentBriefSync(businessId: Id, booking: Booking): BookingPaymentBrief {
  return briefOf(buildBookingPaymentSummary(businessId, booking));
}

/**
 * «Оплачено» по многим записям одним запросом (journal.md: «Список» и «Записи» брали «оплачено» из extras журнала —
 * второй источник, расходившийся с кассой). Один источник — та же сводка, что у окна оплаты визита. Записи другого
 * бизнеса и удалённые пропускаются.
 */
export function listBookingPaymentSummaries(businessId: Id, bookingIds: Id[]): Promise<Record<Id, BookingPaymentBrief>> {
  if (isApiMode()) {
    return Promise.all(
      bookingIds.map((id) =>
        Server.getBookingPaymentSummary(businessId, id).then(
          (s) => [id, briefOf(s)] as const,
          () => undefined,
        ),
      ),
    ).then((rows) => Object.fromEntries(rows.filter((r): r is readonly [Id, BookingPaymentBrief] => Boolean(r))));
  }
  return request(() => {
    const wanted = new Set(bookingIds);
    const out: Record<Id, BookingPaymentBrief> = {};
    for (const b of readCore().bookings) {
      if (!wanted.has(b.id) || b.businessId !== businessId) continue;
      out[b.id] = briefOf(buildBookingPaymentSummary(businessId, b));
    }
    return out;
  });
}

/** Статус оплаты визита (F-07-045) — контракт для journal и других соседей */
export function getBookingPaymentStatus(businessId: Id, bookingId: Id): Promise<BookingPaymentStatus> {
  return getBookingPaymentSummary(businessId, bookingId).then((s) => s.status);
}

function operationMethodOf(kind: PaymentMethodTile['kind']): Operation['method'] {
  if (kind === 'cash') return 'cash';
  if (kind === 'card' || kind === 'installment') return 'card';
  return 'other';
}

/** Переводит визит из «Ожидания» / «Подтвердил» в «Пришёл» при первой оплате (F-07-036) — coreTx, только внутри request() (§16.2, CONVENTIONS §17) */
function markArrivedIfNeededSync(booking: Booking): void {
  if (['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'].includes(booking.status)) {
    coreTx.changeBookingStatus(booking.id, 'arrived', 'business');
  }
}

/**
 * Мок как сервер (booking-payments.service pushExtrasLine): денежный платёж визита — ещё и строка оплаты окна записи
 * журнала (extras.payments, id строки = ключ платежа paymentGroupKey). Так «Оплата визита» журнала и вкладка «Оплата»
 * показывают одни и те же деньги: оплата добавляет строку, возврат уменьшает её (до нуля — строка уходит), отмена
 * платежа убирает. paidAmount журнала = сумма строк (решение владельца 01.10: оплачено = платежи − возвраты).
 * Только внутри request().
 */
type JournalMirrorChange =
  | { kind: 'add'; key: string; method: JournalPaymentLine['method']; amount: Money; label: string; at: ISODateTime }
  | { kind: 'refund'; key: string; amount: Money }
  | { kind: 'remove'; key: string };
function mirrorToJournalSync(bookingId: Id, change: JournalMirrorChange): void {
  mutateArea('journal', (s) => {
    const current = s.extras[bookingId] ?? EMPTY_BOOKING_EXTRAS;
    let payments = current.payments ?? [];
    if (change.kind === 'add') {
      if (change.amount <= 0 || payments.some((l) => l.id === change.key)) return;
      payments = [...payments, { id: change.key, method: change.method, amount: change.amount, label: change.label, at: change.at }];
    } else if (change.kind === 'refund') {
      if (!payments.some((l) => l.id === change.key)) return;
      payments = payments
        .map((l) => (l.id === change.key ? { ...l, amount: roundToDram(Math.max(0, l.amount - change.amount)) } : l))
        .filter((l) => l.id !== change.key || l.amount > 0);
    } else {
      if (!payments.some((l) => l.id === change.key)) return;
      payments = payments.filter((l) => l.id !== change.key);
    }
    s.extras[bookingId] = { ...current, payments, paidAmount: roundToDram(payments.reduce((sum, l) => sum + l.amount, 0)) };
  });
}

interface ApplyMoneyResult {
  lines: BookingPaymentLine[];
  feeAmount: Money;
}

/**
 * Один платёж — ОДНА финансовая операция на всю сумму (fin-review Ф11: карта 5 000 больше не дробится на 2 × 2 500 ни в
 * окне, ни в чеке). Разнесение по услугам (F-07-181) остаётся в строках платежа — у всех общий groupId и operationId;
 * в колонке «Услуга/Товар» операции — все оплаченные услуги через запятую.
 */
function applyMoneyToBooking(businessId: Id, booking: Booking, lineTotals: Money[], existingPayments: BookingPaymentLine[], amount: Money, tile: PaymentMethodTile): ApplyMoneyResult {
  if (amount <= 0) throw new Error('amount_must_be_positive');
  const allocations = allocateAmountToLines(lineTotals, existingPayments, amount);
  if (allocations.length === 0) throw new Error('nothing_to_pay');
  const area = readArea('finance');
  const itemId = area.itemBySystemKey[businessId]?.servicePayment;
  if (!itemId || !tile.accountId) throw new Error('payment_setup_incomplete');
  const by = currentActor().staffId ?? 'system';
  const at = nowDateTime();
  const docNumber = String(700000000 + Math.floor(Math.random() * 99999999));
  const method = operationMethodOf(tile.kind);
  const client = booking.clientId ? readCore().clients.find((c) => c.id === booking.clientId) : undefined;
  const createdLines: BookingPaymentLine[] = [];
  // Товары визита (индексы после услуг) в кассу finance не идут — их выручку кладёт документ продажи склада
  const serviceCount = booking.services.length;
  const serviceAllocs = allocations.filter((a) => a.serviceIndex < serviceCount);
  const goodsAllocs = allocations.filter((a) => a.serviceIndex >= serviceCount);
  const opId = serviceAllocs.length > 0 ? newId('op') : undefined;
  const firstOperationId: Id | undefined = opId;
  const total = roundToDram(serviceAllocs.reduce((sum, a) => sum + a.amount, 0));
  const labels = [...new Set(serviceAllocs.map((a) => serviceLabel(booking, a.serviceIndex)).filter(Boolean))];
  const goodsGroupId = newId('bpg');
  mutateArea('finance', (s) => {
    if (opId) s.operations.push({
      id: opId,
      businessId,
      locationId: booking.locationId,
      accountId: tile.accountId!,
      itemId,
      kind: 'income',
      amount: total,
      date: at,
      method,
      partyType: client ? 'client' : 'none',
      partyId: client?.id,
      partyName: client?.name,
      source: 'booking',
      refId: booking.id,
      docNumber,
      lineLabel: labels.join(', '),
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    });
    for (const alloc of serviceAllocs) {
      const line: BookingPaymentLine = {
        id: newId('bpl'),
        businessId,
        bookingId: booking.id,
        serviceIndex: alloc.serviceIndex,
        kind: 'money',
        methodKey: tile.key,
        methodLabel: tile.label,
        accountId: tile.accountId!,
        amount: alloc.amount,
        operationId: opId,
        groupId: opId,
        createdAt: at,
        createdBy: by,
      };
      s.bookingPayments.push(line);
      createdLines.push(line);
    }
    // Товары — своим платежом без операции: отмена/возврат не трогают кассу finance (кассу правит склад)
    for (const alloc of goodsAllocs) {
      const line: BookingPaymentLine = {
        id: newId('bpl'),
        businessId,
        bookingId: booking.id,
        serviceIndex: alloc.serviceIndex,
        kind: 'money',
        methodKey: tile.key,
        methodLabel: tile.label,
        accountId: tile.accountId!,
        amount: alloc.amount,
        goods: true,
        groupId: goodsGroupId,
        createdAt: at,
        createdBy: by,
      };
      s.bookingPayments.push(line);
      createdLines.push(line);
    }
  });
  const journalMethod: JournalPaymentLine['method'] = tile.kind === 'cash' ? 'cash' : 'card';
  if (opId) mirrorToJournalSync(booking.id, { kind: 'add', key: opId, method: journalMethod, amount: total, label: tile.label, at });
  const goodsTotal = roundToDram(goodsAllocs.reduce((sum, a) => sum + a.amount, 0));
  if (goodsTotal > 0) mirrorToJournalSync(booking.id, { kind: 'add', key: goodsGroupId, method: journalMethod, amount: goodsTotal, label: tile.label, at });
  // Комиссия эквайринга (F-07-033) — одной операцией на всю сумму платежа, привязана к первой строке (F-07-034)
  let feeAmount = 0;
  if (tile.feePct > 0) {
    feeAmount = calcAcquiringFee(amount, tile.feePct);
    if (feeAmount > 0) {
      const feeItemId = area.itemBySystemKey[businessId]?.acquiringFee;
      if (feeItemId) {
        mutateArea('finance', (s) => {
          const feeOp: Operation = {
            id: newId('op'),
            businessId,
            locationId: booking.locationId,
            accountId: tile.accountId!,
            itemId: feeItemId,
            kind: 'expense',
            amount: feeAmount,
            date: at,
            method: 'other',
            partyType: 'none',
            source: 'booking',
            refId: booking.id,
            comment: `Комиссия за эквайринг · ${tile.label}`,
            feeOfOperationId: firstOperationId,
            createdBy: 'system',
            createdAt: at,
            history: [{ at, by: 'system', action: 'created' }],
          };
          s.operations.push(feeOp);
          const src = firstOperationId ? s.operations.find((o) => o.id === firstOperationId) : undefined;
          if (src) src.feeOperationId = feeOp.id;
        });
      }
    }
  }
  return { lines: createdLines, feeAmount };
}

/** Быстрая оплата (F-07-037) — вся сумма одним способом в один клик. Один request(): чтение брони, оплата и перевод в «Пришёл» —
 * одна транзакция, сводка возвращается свежей без ручного refetch у вызывающего окна (defect-1, F-07-039/045, CONVENTIONS §16.2/§18.2) */
export function payBookingQuick(businessId: Id, bookingId: Id, methodKey: string, accountIdOverride?: Id): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.payBookingQuick(businessId, bookingId, methodKey, accountIdOverride);
  return request(() => {
    assertCan('journal.edit');
    const booking = requireBookingSync(businessId, bookingId);
    if (booking.status === 'no_show') throw new Error('booking_no_show');
    const settings = paymentMethodsSettingsSync(businessId);
    const tile = paymentMethodTiles(settings).find((t) => t.key === methodKey);
    if (!tile) throw new Error('method_not_found');
    if (accountIdOverride) tile.accountId = accountIdOverride;
    const lineTotals = lineTotalsOf(booking);
    const area = readArea('finance');
    const existing = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled);
    const due = amountDueOf(booking, existing);
    if (due <= 0) throw new Error('already_paid');
    applyMoneyToBooking(businessId, booking, lineTotals, existing, due, tile);
    markArrivedIfNeededSync(booking);
    return bookingPaymentSummarySync(businessId, bookingId);
  });
}

export interface SplitPaymentPart {
  methodKey: string;
  amount: Money;
  accountId?: Id;
  /** Часть «Личный счёт клиента», уже списанная в «Лояльности» (единый источник счетов) */
  loyaltyAccountId?: Id;
  debt?: boolean;
}

/** Раздельная (детализированная) оплата (F-07-038) — несколько частей разными способами, одна транзакция (§16.2/§18.2).
 * Часть `methodKey: 'account'` — со счёта клиента (fin-review Ф12): в той же транзакции, что и остальные части, —
 * если счёт уводит в минус сверх лимита, не проходит НИ одна часть. Спросить «уйти в минус?» — дело окна до вызова. */
export function payBookingSplit(businessId: Id, bookingId: Id, parts: SplitPaymentPart[]): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.payBookingSplit(businessId, bookingId, parts);
  return request(() => {
    assertCan('journal.edit');
    const booking = requireBookingSync(businessId, bookingId);
    if (booking.status === 'no_show') throw new Error('booking_no_show');
    const settings = paymentMethodsSettingsSync(businessId);
    const tiles = paymentMethodTiles(settings);
    const lineTotals = lineTotalsOf(booking);
    const positive = parts.filter((p) => p.amount > 0);
    const requested = roundToDram(positive.reduce((sum, p) => sum + p.amount, 0));
    const dueBefore = amountDueOf(booking, readArea('finance').bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled));
    if (requested > dueBefore) throw new ApiError('amount_exceeds_due');
    // Сначала счёт клиента (лояльность и счета — первыми, F-07-040), потом деньги
    const ordered = [...positive.filter((p) => p.methodKey === 'account'), ...positive.filter((p) => p.methodKey !== 'account')];
    // request() откатывает базу целиком, если любая часть бросит ошибку, — одна транзакция
    for (const part of ordered) {
      const area = readArea('finance');
      const existing = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled);
      const due = amountDueOf(booking, existing);
      const amount = Math.min(part.amount, due);
      if (amount <= 0) continue;
      if (part.methodKey === 'account') {
        if (!booking.clientId) throw new ApiError('no_client');
        applyAccountToBookingSync(businessId, booking, booking.clientId, amount, part.loyaltyAccountId ? { accountId: part.loyaltyAccountId, debt: Boolean(part.debt) } : undefined);
        continue;
      }
      const tile = tiles.find((t) => t.key === part.methodKey);
      if (!tile) throw new Error('method_not_found');
      if (part.accountId) tile.accountId = part.accountId;
      applyMoneyToBooking(businessId, booking, lineTotals, existing, amount, tile);
    }
    markArrivedIfNeededSync(booking);
    return bookingPaymentSummarySync(businessId, bookingId);
  });
}

/** Скидка по акции — строкой оплаты, не денежной (F-07-041) */
/**
 * Скидка по акции — строкой оплаты, не денежной (F-07-041). `options.exactLabel` — подпись как есть (соседям:
 * loyalty пишет сюда «Списание бонусов», а не «Скидка по акции «Списание бонусов»»).
 */
export function addBookingPromoDiscount(businessId: Id, bookingId: Id, label: string, amount: Money, options?: { exactLabel?: boolean }): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.addBookingPromoDiscount(businessId, bookingId, label, amount, options);
  return request(async () => {
    assertCan('journal.edit');
    const booking = await requireBooking(businessId, bookingId);
    const lineTotals = lineTotalsOf(booking);
    const area = readArea('finance');
    const existing = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled);
    const due = amountDueOf(booking, existing);
    const applied = Math.min(amount, due);
    if (applied <= 0) throw new Error('nothing_to_discount');
    const allocations = allocateAmountToLines(lineTotals, existing, applied);
    const by = currentActor().staffId ?? 'system';
    const at = nowDateTime();
    const groupId = newId('bpg');
    mutateArea('finance', (s) => {
      for (const alloc of allocations) {
        s.bookingPayments.push({
          id: newId('bpl'),
          businessId,
          bookingId,
          serviceIndex: alloc.serviceIndex,
          kind: 'discount',
          methodKey: 'promo',
          methodLabel: options?.exactLabel ? label : `Скидка по акции «${label}»`,
          amount: alloc.amount,
          groupId,
          createdAt: at,
          createdBy: by,
        });
      }
    });
    return getBookingPaymentSummary(businessId, bookingId);
  });
}

/**
 * Списание со счёта клиента в визит — только внутри request(): одна транзакция с остальной оплатой (Ф12).
 * `loyalty` — деньги уже списаны со счёта в разделе «Лояльность» (единый источник счетов): свой старый баланс и его
 * лимит не трогаем, только пишем строки; долг — по ответу лояльности.
 */
function applyAccountToBookingSync(businessId: Id, booking: Booking, clientId: Id, amount: Money, loyalty?: { accountId: Id; debt: boolean }): void {
  const lineTotals = lineTotalsOf(booking);
  const area = readArea('finance');
  const existing = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === booking.id && !p.cancelled);
  const due = amountDueOf(booking, existing);
  const applied = Math.min(amount, due);
  if (applied <= 0) throw new Error('nothing_to_pay');
  const balance = area.clientAccountBalances[businessId]?.[clientId] ?? 0;
  const nextBalance = roundToDram(balance - applied);
  if (!loyalty && nextBalance < -CLIENT_ACCOUNT_DEBT_LIMIT) throw new Error('debt_limit_exceeded');
  const debt = loyalty ? loyalty.debt : nextBalance < 0;
  const allocations = allocateAmountToLines(lineTotals, existing, applied);
  const by = currentActor().staffId ?? 'system';
  const at = nowDateTime();
  const groupId = newId('bpg');
  mutateArea('finance', (s) => {
    if (!loyalty) s.clientAccountBalances[businessId] = { ...(s.clientAccountBalances[businessId] ?? {}), [clientId]: nextBalance };
    for (const alloc of allocations) {
      s.bookingPayments.push({
        id: newId('bpl'),
        businessId,
        bookingId: booking.id,
        serviceIndex: alloc.serviceIndex,
        kind: 'account',
        methodKey: 'account',
        methodLabel: 'Личный счёт клиента',
        amount: alloc.amount,
        debt,
        groupId,
        loyaltyAccountId: loyalty?.accountId,
        createdAt: at,
        createdBy: by,
      });
    }
  });
}

/** Оплата со счёта клиента, в том числе в долг (F-07-061/062) — не создаёт денежную операцию, меняет баланс счёта */
export function payBookingFromClientAccount(businessId: Id, bookingId: Id, clientId: Id, amount: Money, loyalty?: { accountId: Id; debt: boolean }): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.payBookingFromClientAccount(businessId, bookingId, clientId, amount, loyalty);
  return request(() => {
    assertCan('journal.edit');
    const booking = requireBookingSync(businessId, bookingId);
    applyAccountToBookingSync(businessId, booking, clientId, amount, loyalty);
    markArrivedIfNeededSync(booking);
    return bookingPaymentSummarySync(businessId, bookingId);
  });
}

/** Баланс личного счёта клиента (⭐ демо-минимум F-07-061/062; полный учёт счетов — b03) */
export function getClientAccountBalance(businessId: Id, clientId: Id): Promise<Money> {
  if (isApiMode()) return Server.getClientAccountBalance(businessId, clientId);
  return request(() => readArea('finance').clientAccountBalances[businessId]?.[clientId] ?? 0);
}

/**
 * Отмена ошибочного платежа визита — деньгами, скидкой или счётом (F-07-042/181). Отменяет ВЕСЬ платёж (все его строки
 * по услугам, Ф11) и его операцию. Это исправление ошибки кассира, а не возврат клиенту: возврат — refundBookingPayment.
 * Решение владельца 01.10.2026: если по платежу уже были возвраты, отмена снимает и приход, и связанные расходы
 * «Возврат» — итог по кассе 0 (раньше отмена отказывала, а на сервере расходы оставались).
 */
export function removeBookingPaymentLine(businessId: Id, paymentLineId: Id): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.removeBookingPaymentLine(businessId, paymentLineId);
  return request(() => {
    assertCan('journal.edit');
    const area = readArea('finance');
    const line = area.bookingPayments.find((p) => p.id === paymentLineId && p.businessId === businessId);
    if (!line) throw new Error('payment_not_found');
    const key = paymentGroupKey(line);
    const by = currentActor().staffId ?? 'system';
    const at = nowDateTime();
    mutateArea('finance', (s) => {
      const targets = s.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === line.bookingId && !p.cancelled && paymentGroupKey(p) === key);
      const opIds = new Set<Id>();
      for (const target of targets) {
        target.cancelled = true;
        target.cancelledAt = at;
        if (target.operationId) opIds.add(target.operationId);
        // расходы «Возврат» по этому платежу отменяются вместе с приходом — касса 0
        for (const refundOpId of target.refundOperationIds ?? []) opIds.add(refundOpId);
        if (target.kind === 'account' && !target.loyaltyAccountId) {
          // возвращаем деньги на счёт клиента при отмене оплаты счётом (клиент известен по визиту); счёт лояльности
          // пополняет окно оплаты через раздел «Лояльность»
          const booking = readCore().bookings.find((b) => b.id === target.bookingId);
          if (booking?.clientId) {
            const current = s.clientAccountBalances[businessId]?.[booking.clientId] ?? 0;
            // возвращённое на счёт уже вернули при возврате — отмена возвращает только остаток
            s.clientAccountBalances[businessId] = { ...(s.clientAccountBalances[businessId] ?? {}), [booking.clientId]: roundToDram(current + paymentLineNet(target)) };
          }
        }
      }
      for (const opId of opIds) {
        const op = s.operations.find((o) => o.id === opId);
        if (!op || op.cancelled) continue;
        op.cancelled = true;
        op.cancelledAt = at;
        op.history.push({ at, by, action: 'cancelled' });
        if (op.feeOperationId) {
          const fee = s.operations.find((o) => o.id === op.feeOperationId);
          if (fee) {
            fee.cancelled = true;
            fee.cancelledAt = at;
          }
        }
      }
    });
    mirrorToJournalSync(line.bookingId, { kind: 'remove', key });
    return bookingPaymentSummarySync(businessId, line.bookingId);
  });
}

/**
 * Удаление оплаченной записи (F-07-050) — её платежи не остаются даже в «Отменённые» (в отличие от обычной
 * отмены операции) и не видны на странице операции. Зовёт journal из своего обработчика удаления записи —
 * своей кнопки удаления записи у finance нет (запись и её удаление — файлы journal).
 */
export function deleteBookingPaymentsHard(businessId: Id, bookingId: Id): Promise<void> {
  if (isApiMode()) return Server.deleteBookingPaymentsHard(businessId, bookingId);
  return request(() => {
    mutateArea('finance', (s) => {
      const toRemoveOpIds = new Set(s.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && p.operationId).map((p) => p.operationId));
      s.bookingPayments = s.bookingPayments.filter((p) => !(p.businessId === businessId && p.bookingId === bookingId));
      s.operations = s.operations.filter((op) => !(op.businessId === businessId && (op.refId === bookingId || toRemoveOpIds.has(op.id)) && op.source === 'booking'));
    });
  });
}

/**
 * Примечание к оплате визита (F-07-047) — виден в колонке «Комментарий» его операций-оплат. Операции «Возврат»
 * не трогает: у них своя причина (fin-review Ф14).
 */
export function setBookingPaymentNote(businessId: Id, bookingId: Id, note: string): Promise<void> {
  if (isApiMode()) return Server.setBookingPaymentNote(businessId, bookingId, note);
  return request(() => {
    assertCan('journal.edit');
    mutateArea('finance', (s) => {
      s.bookingPaymentNotes[`${businessId}:${bookingId}`] = note;
      const opIds = new Set(s.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled && p.operationId).map((p) => p.operationId));
      for (const op of s.operations) if (opIds.has(op.id)) op.comment = note;
    });
  });
}

/**
 * Возврат денег по платежу визита (fin-review Ф7/Ф8) — ОТДЕЛЬНАЯ операция, исходная оплата остаётся:
 *  - деньгами: расходная операция статьёй «Возврат» датой возврата, с той же кассы тем же способом, комментарий — причина;
 *    у исходной операции растёт refundedAmount и в истории — «возврат»;
 *  - со счёта клиента: деньги возвращаются на счёт, кассы это не касается;
 *  - скидку вернуть нельзя — это не деньги.
 * Решение владельца 01.10.2026 (одно правило с сервером): оплачено = платежи − возвраты — частичный возврат делает
 * визит частично оплаченным (к оплате — возвращённая часть), полный — неоплаченным; в окне ещё и «Частично возвращено» /
 * «Возвращено». Строка оплаты окна журнала уменьшается на ту же сумму.
 * Только внутри request().
 */
function refundPaymentGroupSync(businessId: Id, booking: Booking, key: string, amount: Money, reason: string): Money {
  const area = readArea('finance');
  const lines = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === booking.id && !p.cancelled && paymentGroupKey(p) === key);
  if (lines.length === 0) throw new Error('payment_not_found');
  const kind = lines[0].kind;
  if (kind === 'discount') throw new ApiError('discount_not_refundable');
  const net = roundToDram(lines.reduce((sum, l) => sum + paymentLineNet(l), 0));
  const take = roundToDram(Math.min(Math.max(0, amount), net));
  if (take <= 0) return 0;
  const by = currentActorId();
  const at = nowDateTime();
  const comment = reason.trim() || undefined;
  let refundOpId: Id | undefined;
  // Платёж за товары визита: операции в кассе finance у него нет — деньги из кассы снимает отмена документа
  // продажи склада (journal.syncVisitGoodsSale), тут только отмечаем возврат в строках
  const goodsOnly = lines.every((l) => l.goods);
  if (kind === 'money' && !goodsOnly) {
    const itemId = area.itemBySystemKey[businessId]?.refund;
    if (!itemId) throw new ApiError('refund_item_missing');
    const source = area.operations.find((o) => o.id === lines[0].operationId);
    const accountId = lines[0].accountId ?? source?.accountId;
    if (!accountId) throw new ApiError('payment_setup_incomplete');
    const account = area.accounts.find((a) => a.id === accountId);
    if (account?.kind === 'cash') {
      // наличными можно отдать только то, что есть в ящике (fin-review Ф2)
      const balance = accountBalance(account, area.operations.filter((o) => o.accountId === accountId));
      if (balance < take) throw new ApiError('insufficient_cash');
    }
    const client = booking.clientId ? readCore().clients.find((c) => c.id === booking.clientId) : undefined;
    refundOpId = newId('op');
    const opId = refundOpId;
    mutateArea('finance', (s) => {
      s.operations.push({
        id: opId,
        businessId,
        locationId: booking.locationId,
        accountId,
        itemId,
        kind: 'expense',
        amount: take,
        date: at,
        method: source?.method ?? (account?.kind === 'cash' ? 'cash' : 'card'),
        partyType: client ? 'client' : 'none',
        partyId: client?.id,
        partyName: client?.name,
        comment,
        source: 'booking',
        refId: booking.id,
        docNumber: source?.docNumber,
        lineLabel: source?.lineLabel,
        createdBy: by,
        createdAt: at,
        history: [{ at, by, action: 'created' }],
      });
      const src = source ? s.operations.find((o) => o.id === source.id) : undefined;
      if (src) {
        src.refundedAmount = roundToDram((src.refundedAmount ?? 0) + take);
        src.history.push({ at, by, action: 'refunded' });
      }
    });
  } else if (kind !== 'money' && booking.clientId && !lines[0].loyaltyAccountId) {
    // счёт лояльности возвращает окно оплаты через «Лояльность» (topupAccount); тут — только старый баланс finance
    const clientId = booking.clientId;
    mutateArea('finance', (s) => {
      const current = s.clientAccountBalances[businessId]?.[clientId] ?? 0;
      s.clientAccountBalances[businessId] = { ...(s.clientAccountBalances[businessId] ?? {}), [clientId]: roundToDram(current + take) };
    });
  }
  // Разносим возврат по строкам платежа с последней услуги к первой
  mutateArea('finance', (s) => {
    let left = take;
    const targets = s.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === booking.id && !p.cancelled && paymentGroupKey(p) === key).reverse();
    for (const line of targets) {
      if (left <= 0) break;
      const part = Math.min(paymentLineNet(line), left);
      if (part <= 0) continue;
      line.refundedAmount = roundToDram((line.refundedAmount ?? 0) + part);
      if (refundOpId) line.refundOperationIds = [...(line.refundOperationIds ?? []), refundOpId];
      left = roundToDram(left - part);
    }
  });
  if (kind === 'money') mirrorToJournalSync(booking.id, { kind: 'refund', key, amount: take });
  return take;
}

/** Частичный (или полный) возврат по одному платежу визита — отдельной операцией «Возврат» (fin-review Ф8) */
export function refundBookingPayment(businessId: Id, paymentLineId: Id, amount: Money, reason: string): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.refundBookingPayment(businessId, paymentLineId, amount, reason);
  return request(() => {
    assertCan('journal.edit');
    const line = readArea('finance').bookingPayments.find((p) => p.id === paymentLineId && p.businessId === businessId);
    if (!line) throw new Error('payment_not_found');
    const booking = requireBookingSync(businessId, line.bookingId);
    if (roundToDram(amount) <= 0) throw new ApiError('invalid_amount');
    refundPaymentGroupSync(businessId, booking, paymentGroupKey(line), amount, reason);
    return bookingPaymentSummarySync(businessId, booking.id);
  });
}

/**
 * Полный возврат визита (F-07-066, fin-review Ф7) — возвращает клиенту ВСЁ, что он заплатил деньгами и со счёта,
 * отдельными операциями «Возврат» (по одной на платёж) с причиной в комментарии. Исходные оплаты остаются: касса
 * дня оплаты не меняется задним числом. Визит — «Возвращено» и снова неоплачен (оплачено = платежи − возвраты,
 * решение владельца 01.10.2026). Примечание к оплате не трогает.
 */
export function refundBookingFull(businessId: Id, bookingId: Id, reason: string): Promise<BookingPaymentSummary> {
  if (isApiMode()) return Server.refundBookingFull(businessId, bookingId, reason);
  return request(() => {
    assertCan('journal.edit');
    const booking = requireBookingSync(businessId, bookingId);
    const lines = readArea('finance').bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled && p.kind !== 'discount');
    const keys = [...new Set(lines.map(paymentGroupKey))];
    // request() откатит все возвраты, если хоть один не прошёл (например, в ящике не хватает наличных)
    let total = 0;
    for (const key of keys) total += refundPaymentGroupSync(businessId, booking, key, Number.MAX_SAFE_INTEGER, reason);
    if (total <= 0) throw new ApiError('nothing_to_refund');
    return bookingPaymentSummarySync(businessId, bookingId);
  });
}

// ─────────────────────────── Баланс клиента: продано/оплачено/визиты с долгом (F-07-055/057) ───────────────────────────

/** «Продано / Оплачено / Баланс» клиента (F-07-055) — по всем визитам «пришёл» и ручным операциям на него */
export function getClientMoneySummary(businessId: Id, clientId: Id): Promise<ClientMoneySummary> {
  if (isApiMode()) return Server.getClientMoneySummary(businessId, clientId);
  return request(() => {
    const bookings = readCore().bookings.filter((b) => b.businessId === businessId && b.clientId === clientId && b.status === 'arrived' && !b.deletedAt);
    // Товары визита (28.09) — тоже «Продано»: платежи за них (goods) уже входят в оплаченное ниже
    const totals = bookings.map((b) => payableTotalOf(b));
    const bookingIds = new Set(bookings.map((b) => b.id));
    const area = readArea('finance');
    // + полученная мастером предоплата (F-00-097): она оплачена мимо кассы, но клиент её заплатил
    const paidFromBookings =
      area.bookingPayments.filter((p) => p.businessId === businessId && bookingIds.has(p.bookingId) && !p.cancelled && p.kind !== 'discount').reduce((s, p) => s + paymentLineNet(p), 0) +
      bookings.reduce((s, b) => s + prepaidOf(b), 0);
    const manualOps = area.operations.filter((op) => op.businessId === businessId && op.partyType === 'client' && op.partyId === clientId && op.source === 'manual' && !op.refId);
    return computeClientMoneySummary(totals, paidFromBookings, manualOps);
  });
}

export interface DebtVisitRow {
  bookingId: Id;
  start: string;
  staffId: Id;
  serviceLabel: string;
  total: Money;
  paid: Money;
  due: Money;
  method: string;
  debt: boolean;
}

/** «Визиты с долгом» клиента (F-07-057) — фильтр «Все / Неоплаченные / Счётом клиента в долг» */
export function listClientDebtVisits(businessId: Id, clientId: Id, filter: DebtVisitFilter = 'all'): Promise<DebtVisitRow[]> {
  if (isApiMode()) return Server.listClientDebtVisits(businessId, clientId, filter);
  return request(() => {
    const bookings = readCore().bookings.filter((b) => b.businessId === businessId && b.clientId === clientId && !b.deletedAt && (b.status === 'arrived' || b.status === 'no_show'));
    const area = readArea('finance');
    const rows: DebtVisitRow[] = bookings.map((b) => {
      const lines = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === b.id && !p.cancelled);
      // Полученная мастером предоплата (F-00-097) — тоже оплачено: иначе визит с предоплатой висит «долгом»
      const paid = roundToDram(lines.reduce((s, p) => s + p.amount, 0) + prepaidOf(b));
      // Долг визита — по сумме к оплате (услуги + товары), как в окне оплаты
      const total = payableTotalOf(b);
      const due = roundToDram(Math.max(0, total - paid));
      const debtLine = lines.find((l) => l.debt);
      const serviceLabel = b.services
        .map((l) => readCore().services.find((s) => s.id === l.serviceId)?.name.ru)
        .filter((n): n is string => Boolean(n))
        .join(', ');
      return { bookingId: b.id, start: b.start, staffId: b.staffId, serviceLabel: serviceLabel || '—', total, paid, due, method: lines[0]?.methodLabel ?? '—', debt: Boolean(debtLine) };
    });
    if (filter === 'unpaid') return rows.filter((r) => r.due > 0);
    if (filter === 'accountDebt') return rows.filter((r) => r.debt);
    return rows;
  });
}

export interface UnpaidVisitRow {
  bookingId: Id;
  start: string;
  clientName?: string;
  serviceLabel: string;
  total: Money;
  paid: Money;
  due: Money;
}

/**
 * «Пришли, но не оплатили» (fin-review Ф20): визиты «Клиент пришёл» за последние `days` дней, по которым в кассу
 * пришло меньше суммы визита. Выручка журнала считает сделанное, касса — полученное; этот список — их разница.
 */
export function listUnpaidVisits(businessId: Id, locationIds?: Id[], days = 14): Promise<UnpaidVisitRow[]> {
  if (isApiMode()) return Server.listUnpaidVisits(businessId, locationIds, days);
  return request(() => {
    const core = readCore();
    const from = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    const today = nowDateTime();
    const area = readArea('finance');
    const rows: UnpaidVisitRow[] = [];
    for (const b of core.bookings) {
      if (b.businessId !== businessId || b.status !== 'arrived' || b.deletedAt) continue;
      if (locationIds && locationIds.length > 0 && !locationIds.includes(b.locationId)) continue;
      if (b.start < from || b.start > today) continue;
      // Сумма визита — услуги + товары (28.09): неоплаченный товар визита тоже «не оплатили»
      const total = payableTotalOf(b);
      if (total <= 0) continue;
      const lines = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === b.id && !p.cancelled);
      const due = amountDueOf(b, lines);
      if (due <= 0) continue;
      const serviceLabel = b.services
        .map((l) => core.services.find((sv) => sv.id === l.serviceId)?.name.ru)
        .filter((n): n is string => Boolean(n))
        .join(', ');
      rows.push({
        bookingId: b.id,
        start: b.start,
        clientName: b.clientId ? core.clients.find((c) => c.id === b.clientId)?.name : undefined,
        serviceLabel: serviceLabel || '—',
        total,
        paid: roundToDram(total - due),
        due,
      });
    }
    return rows.sort((a, b) => (a.start < b.start ? 1 : -1));
  });
}

// ─────────────────────────── Счёт клиента: отмена пополнения и возврат (F-07-064, F-07-070) ───────────────────────────

export function listClientAccountTopUps(businessId: Id, clientId: Id): Promise<ClientAccountTopUp[]> {
  if (isApiMode()) return Server.listClientAccountTopUps(businessId, clientId);
  return request(() => readArea('finance').clientAccountTopUps.filter((t) => t.businessId === businessId && t.clientId === clientId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
}

// ─────────────────────────── Продажи лояльности в кассу (loyalty.md, 01.10.2026) ───────────────────────────

export interface LoyaltySaleInput {
  /** Что продали: абонемент, сертификат или пополнение счёта клиента — задаёт статью */
  kind: 'membership' | 'certificate' | 'accountTopUp';
  locationId: Id;
  amount: Money;
  /** Способ оплаты — ключ плитки из listBookingPaymentTiles ('cash', 'card', свой способ): касса и вид операции */
  methodKey: string;
  clientId?: Id;
  clientName?: string;
  /** id проданного абонемента / сертификата / транзакции счёта — связь для отмены и отчётов */
  refId?: Id;
  /** Подпись в колонке «Услуга/Товар», например «Абонемент «10 занятий»» */
  label?: string;
}

const LOYALTY_SALE_ITEM: Record<LoyaltySaleInput['kind'], SystemItemKey> = { membership: 'membershipSale', certificate: 'certificateSale', accountTopUp: 'accountTopUp' };

/**
 * Деньги за продажу лояльности — приход в кассу (статья «Продажа абонементов» / «Продажа сертификатов» /
 * «Пополнение счёта»). Синхронный вариант — внутри request() раздела «Лояльность», чтобы выдача абонемента и приход
 * были одной транзакцией. Пополнение счёта (source 'account') отменяют в «Лояльности», не на странице операции.
 */
export function recordLoyaltySaleSync(businessId: Id, input: LoyaltySaleInput): Operation {
  const amount = roundToDram(input.amount);
  if (!(amount > 0)) throw new ApiError('invalid_amount');
  const area = readArea('finance');
  const itemId = area.itemBySystemKey[businessId]?.[LOYALTY_SALE_ITEM[input.kind]];
  const tile = paymentMethodTiles(paymentMethodsSettingsSync(businessId)).find((t) => t.key === input.methodKey);
  if (!tile) throw new ApiError('method_not_found');
  if (!itemId || !tile.accountId) throw new ApiError('payment_setup_incomplete');
  const by = currentActorId();
  const at = nowDateTime();
  const op: Operation = {
    id: newId('op'),
    businessId,
    locationId: input.locationId,
    accountId: tile.accountId,
    itemId,
    kind: 'income',
    amount,
    date: at,
    method: operationMethodOf(tile.kind),
    partyType: input.clientId ? 'client' : 'none',
    partyId: input.clientId,
    partyName: input.clientName,
    source: input.kind === 'accountTopUp' ? 'account' : 'sale',
    refId: input.refId,
    lineLabel: input.label,
    createdBy: by,
    createdAt: at,
    history: [{ at, by, action: 'created' }],
  };
  mutateArea('finance', (s) => {
    s.operations.push(op);
  });
  return op;
}

function loyaltySaleOpsSync(businessId: Id, refIds: Id[]): Operation[] {
  const ids = new Set(refIds);
  return readArea('finance').operations.filter((o) => o.businessId === businessId && o.kind === 'income' && !o.cancelled && o.refId !== undefined && ids.has(o.refId) && (o.source === 'sale' || o.source === 'account'));
}

/**
 * Отмена продажи лояльности (отмена продажи сертификата/абонемента, отмена пополнения счёта): приход в кассу
 * отменяется — остаток кассы как до продажи, операция остаётся в «Отменённых». Нет прихода (продажа без оплаты,
 * импорт) — ничего. Только внутри request() раздела «Лояльность».
 */
export function cancelLoyaltySaleSync(businessId: Id, refId: Id): number {
  const targets = new Set(loyaltySaleOpsSync(businessId, [refId]).map((o) => o.id));
  if (targets.size === 0) return 0;
  const by = currentActorId();
  const at = nowDateTime();
  mutateArea('finance', (s) => {
    for (const o of s.operations) {
      if (!targets.has(o.id)) continue;
      o.cancelled = true;
      o.cancelledAt = at;
      o.history.push({ at, by, action: 'cancelled' });
    }
  });
  return targets.size;
}

export interface LoyaltyRefundInput {
  /** Продажа, за которую возвращают: id сертификата/абонемента или id операций пополнения счёта (любой из них) */
  refId: Id | Id[];
  amount: Money;
  /** Способ возврата — ключ плитки; нет — той же кассой и способом, что был приход */
  methodKey?: string;
  comment?: string;
}

/**
 * Частичный/полный возврат денег за продажу лояльности — расход «Возврат» из кассы (исходный приход не трогаем:
 * выручка дня продажи не меняется, fin-review Ф7). Нет ни прихода, ни способа — ничего (вернули без кассы).
 */
export function refundLoyaltySaleSync(businessId: Id, input: LoyaltyRefundInput): Operation | undefined {
  const amount = roundToDram(input.amount);
  if (!(amount > 0)) throw new ApiError('invalid_amount');
  const refIds = Array.isArray(input.refId) ? input.refId : [input.refId];
  const source = loyaltySaleOpsSync(businessId, refIds).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const tile = input.methodKey ? paymentMethodTiles(paymentMethodsSettingsSync(businessId)).find((t) => t.key === input.methodKey) : undefined;
  const accountId = tile?.accountId ?? source?.accountId;
  if (!accountId) return undefined;
  const itemId = readArea('finance').itemBySystemKey[businessId]?.refund ?? source?.itemId;
  if (!itemId) throw new ApiError('payment_setup_incomplete');
  const account = readArea('finance').accounts.find((a) => a.id === accountId);
  const by = currentActorId();
  const at = nowDateTime();
  const op: Operation = {
    id: newId('op'),
    businessId,
    locationId: account?.locationId ?? source?.locationId ?? '',
    accountId,
    itemId,
    kind: 'expense',
    amount,
    date: at,
    method: tile ? operationMethodOf(tile.kind) : (source?.method ?? 'cash'),
    partyType: source?.partyType ?? 'none',
    partyId: source?.partyId,
    partyName: source?.partyName,
    comment: input.comment ?? (source?.lineLabel ? `Возврат · ${source.lineLabel}` : 'Возврат клиенту'),
    source: source?.source ?? 'sale',
    refId: source?.refId ?? refIds[0],
    lineLabel: source?.lineLabel,
    createdBy: by,
    createdAt: at,
    history: [{ at, by, action: 'created' }],
  };
  mutateArea('finance', (s) => {
    s.operations.push(op);
    const src = source ? s.operations.find((o) => o.id === source.id) : undefined;
    if (src) {
      src.refundedAmount = roundToDram((src.refundedAmount ?? 0) + amount);
      src.history.push({ at, by, action: 'refunded' });
    }
  });
  return op;
}

export function recordLoyaltySale(businessId: Id, input: LoyaltySaleInput): Promise<Operation> {
  if (isApiMode()) return Server.recordLoyaltySale(businessId, input);
  // Права — у продажи в «Лояльности» (администратор продаёт абонемент без права править финансы)
  return request(() => recordLoyaltySaleSync(businessId, input));
}

/**
 * Пополнение счёта клиента (F-07-059 при первом пополнении открывает счёт «по факту», F-07-060) — создаёт
 * операцию «Пополнение счета» в выбранную кассу и увеличивает баланс счёта клиента на ту же сумму; право
 * «Счета: Пополнить счет» — пока общим `finance.edit` (F-07-166: детальные права финансов не заведены,
 * см. qa/requests/finance.md).
 */
export function topUpClientAccount(businessId: Id, clientId: Id, clientName: string | undefined, accountId: Id, amount: Money, method: 'cash' | 'card' | 'other'): Promise<{ topUp: ClientAccountTopUp; balance: Money }> {
  if (isApiMode()) return Server.topUpClientAccount(businessId, clientId, clientName, accountId, amount, method);
  return request(() => {
    assertCan('finance.edit');
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('invalid_amount');
    const area = readArea('finance');
    const account = area.accounts.find((a) => a.id === accountId && a.businessId === businessId);
    if (!account) throw new ApiError('not_found');
    const topUpItemId = area.itemBySystemKey[businessId]?.accountTopUp;
    if (!topUpItemId) throw new ApiError('not_found');
    const by = currentActorId();
    const at = nowDateTime();
    const rounded = roundToDram(amount);
    const opId = newId('op');
    const balance = roundToDram((area.clientAccountBalances[businessId]?.[clientId] ?? 0) + rounded);
    let topUp!: ClientAccountTopUp;
    mutateArea('finance', (s) => {
      s.operations.push({
        id: opId,
        businessId,
        locationId: account.locationId,
        accountId,
        itemId: topUpItemId,
        kind: 'income',
        amount: rounded,
        date: at,
        method,
        partyType: 'client',
        partyId: clientId,
        partyName: clientName,
        source: 'account',
        createdBy: by,
        createdAt: at,
        history: [{ at, by, action: 'created' }],
      });
      s.clientAccountBalances[businessId] = { ...(s.clientAccountBalances[businessId] ?? {}), [clientId]: balance };
      topUp = { id: newId('cat'), businessId, clientId, amount: rounded, operationId: opId, createdAt: at, createdBy: by };
      s.clientAccountTopUps = [topUp, ...s.clientAccountTopUps];
    });
    return { topUp, balance };
  });
}

/** Отмена пополнения счёта (F-07-064) — уменьшает баланс счёта и кассу на ту же сумму */
export function cancelClientAccountTopUp(businessId: Id, topUpId: Id): Promise<void> {
  if (isApiMode()) return Server.cancelClientAccountTopUp(businessId, topUpId);
  return request(() => {
    assertCan('finance.edit');
    const by = currentActorId();
    const at = nowDateTime();
    mutateArea('finance', (s) => {
      const topUp = s.clientAccountTopUps.find((t) => t.id === topUpId && t.businessId === businessId);
      if (!topUp || topUp.cancelled) return;
      topUp.cancelled = true;
      topUp.cancelledAt = at;
      const balance = s.clientAccountBalances[businessId]?.[topUp.clientId] ?? 0;
      s.clientAccountBalances[businessId] = { ...(s.clientAccountBalances[businessId] ?? {}), [topUp.clientId]: roundToDram(balance - topUp.amount) };
      if (topUp.operationId) {
        const op = s.operations.find((o) => o.id === topUp.operationId);
        if (op && !op.cancelled) {
          op.cancelled = true;
          op.cancelledAt = at;
          op.history.push({ at, by, action: 'cancelled' });
        }
      }
    });
  });
}

/**
 * Частичный возврат со счёта клиента (F-07-070) — прямого способа у Altegio нет (обходной путь «продажей»
 * условного товара, ❓ открытый вопрос спеки); у нас — расходная операция статьёй «Возврат» уменьшает и
 * счёт, и кассу на сумму возврата без искажения выручки (решение по умолчанию, см. assumed в отчёте пачки).
 */
export function refundClientAccountPartial(businessId: Id, clientId: Id, accountId: Id, amount: Money, comment?: string): Promise<Money> {
  if (isApiMode()) return Server.refundClientAccountPartial(businessId, clientId, accountId, amount, comment);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const balance = area.clientAccountBalances[businessId]?.[clientId] ?? 0;
    const applied = roundToDram(Math.min(amount, balance));
    if (applied <= 0) throw new Error('nothing_to_refund');
    const refundItemId = area.itemBySystemKey[businessId]?.refund;
    if (!refundItemId) throw new Error('refund_item_missing');
    const account = area.accounts.find((a) => a.id === accountId && a.businessId === businessId);
    if (!account) throw new Error('account_not_found');
    const by = currentActorId();
    const at = nowDateTime();
    const nextBalance = roundToDram(balance - applied);
    mutateArea('finance', (s) => {
      s.clientAccountBalances[businessId] = { ...(s.clientAccountBalances[businessId] ?? {}), [clientId]: nextBalance };
      s.operations.push({
        id: newId('op'),
        businessId,
        locationId: account.locationId,
        accountId,
        itemId: refundItemId,
        kind: 'expense',
        amount: applied,
        date: at,
        method: 'other',
        partyType: 'client',
        partyId: clientId,
        comment: comment?.trim() || undefined,
        source: 'account',
        createdBy: by,
        createdAt: at,
        history: [{ at, by, action: 'created' }],
      });
    });
    return nextBalance;
  });
}

// ─────────────────────────── Возврат по продаже (F-07-068/069/071/072) ───────────────────────────

export type SaleRefundMode = 'cancel' | 'expense';

/** Статьи-продажи, к которым применим общий «Возврат» (F-07-068 товар из визита, F-07-069 товар вне визита, F-07-071 абонемент, F-07-072 сертификат) */
const REFUNDABLE_SALE_KEYS = ['goodsSale', 'membershipSale', 'certificateSale'] as const;

export function isRefundableSaleItemKey(businessId: Id, itemId: Id): boolean {
  if (isApiMode()) return Boolean(Server.refundableSaleKindCached(itemId)); // api: ключи статей с сервера (listItems)
  const area = readArea('finance');
  const byKey = area.itemBySystemKey[businessId] ?? {};
  return REFUNDABLE_SALE_KEYS.some((k) => byKey[k] === itemId);
}

/** Какая из трёх продаж-статей это — определяет F-id и подпись возврата (F-07-068/069/071/072) */
export function getRefundableSaleKind(businessId: Id, itemId: Id): (typeof REFUNDABLE_SALE_KEYS)[number] | undefined {
  if (isApiMode()) return Server.refundableSaleKindCached(itemId); // api: ключи статей с сервера (listItems)
  const area = readArea('finance');
  const byKey = area.itemBySystemKey[businessId] ?? {};
  return REFUNDABLE_SALE_KEYS.find((k) => byKey[k] === itemId);
}

/**
 * Возврат по продаже — общий для товара из визита (F-07-068, оплата услуги в визите не трогается: это
 * отдельная операция), товара вне визита (F-07-069), абонемента (F-07-071) и сертификата (F-07-072).
 * Два варианта (174913):
 *  - `cancel` — отменяет исходную операцию целиком (variant 1): касса дня ПРОДАЖИ меняется задним числом;
 *  - `expense` — заводит отдельную расходную операцию статьёй «Возврат» датой ВОЗВРАТА, исходная остаётся
 *    (variant 2, F-07-072): касса дня продажи не искажается, возврат виден отдельной строкой.
 * Остаток товара на складе / посещений абонемента / баланс сертификата — домен stock/loyalty, не finance
 * (см. qa/requests/finance.md); здесь закрывается только денежная часть «Готово, когда».
 */
export function refundSaleOperation(businessId: Id, operationId: Id, input: { amount: Money; mode: SaleRefundMode; comment?: string }): Promise<Operation> {
  if (isApiMode()) return Server.refundSaleOperation(businessId, operationId, input);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const op = area.operations.find((o) => o.id === operationId && o.businessId === businessId);
    if (!op) throw new Error('operation_not_found');
    if (op.cancelled) throw new Error('operation_cancelled');
    if (op.kind !== 'income') throw new Error('not_a_sale');
    if (!isRefundableSaleItemKey(businessId, op.itemId)) throw new Error('not_a_refundable_sale');
    const already = op.refundedAmount ?? 0;
    const remaining = roundToDram(op.amount - already);
    if (remaining <= 0) throw new Error('nothing_to_refund');
    const amount = roundToDram(Math.min(Math.max(0, input.amount), remaining));
    if (amount <= 0) throw new Error('nothing_to_refund');

    const by = currentActorId();
    const at = nowDateTime();

    if (input.mode === 'cancel' && amount >= remaining) {
      let cancelled: Operation | undefined;
      mutateArea('finance', (s) => {
        const target = s.operations.find((o) => o.id === operationId);
        if (!target) return;
        target.cancelled = true;
        target.cancelledAt = at;
        target.history.push({ at, by, action: 'cancelled' });
        cancelled = target;
      });
      if (!cancelled) throw new Error('operation_not_found');
      return cancelled;
    }

    const refundItemId = area.itemBySystemKey[businessId]?.refund;
    if (!refundItemId) throw new Error('refund_item_missing');
    let result: Operation | undefined;
    mutateArea('finance', (s) => {
      const target = s.operations.find((o) => o.id === operationId);
      if (!target) return;
      target.refundedAmount = roundToDram((target.refundedAmount ?? 0) + amount);
      target.history.push({ at, by, action: 'refunded' });
      s.operations.push({
        id: newId('op'),
        businessId,
        locationId: target.locationId,
        accountId: target.accountId,
        itemId: refundItemId,
        kind: 'expense',
        amount,
        date: at,
        method: target.method,
        partyType: target.partyType,
        partyId: target.partyId,
        partyName: target.partyName,
        comment: input.comment?.trim() || undefined,
        source: target.source,
        refId: target.id,
        createdBy: by,
        createdAt: at,
        history: [{ at, by, action: 'created' }],
      });
      result = target;
    });
    if (!result) throw new Error('operation_not_found');
    return result;
  });
}

// ─────────────────────────── Штраф клиенту (F-07-075) ───────────────────────────

/** Ручной штраф клиенту (F-07-075) — статья «Списание штрафа», приход в кассу, выручка, «Оплачено» клиента */
export function chargeClientPenalty(businessId: Id, locationId: Id, accountId: Id, clientId: Id, clientName: string | undefined, amount: Money, comment?: string): Promise<Operation> {
  if (isApiMode()) return Server.chargeClientPenalty(businessId, locationId, accountId, clientId, amount, comment);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const itemId = area.itemBySystemKey[businessId]?.penaltyCharge;
    if (!itemId) throw new Error('penalty_item_missing');
    const by = currentActorId();
    const at = nowDateTime();
    const op: Operation = {
      id: newId('op'),
      businessId,
      locationId,
      accountId,
      itemId,
      kind: 'income',
      amount: roundToDram(amount),
      date: at,
      method: 'cash',
      partyType: 'client',
      partyId: clientId,
      partyName: clientName,
      comment: comment?.trim() || undefined,
      source: 'manual',
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    };
    mutateArea('finance', (s) => {
      s.operations.push(op);
    });
    return op;
  });
}

// ─────────────────────────── Взаиморасчёты с сотрудниками (F-07-159…162) ───────────────────────────

/**
 * Досчитать демо-ведомости сида тем же расчётом зарплаты, что «Создать ведомость» (payroll-review: сид писал выручку
 * «08.09–23.09 +190 000 ֏», а зарплата по схеме другая). Один раз: флаг seedRecalc снимается. Только внутри request().
 */
async function recalcSeedSheets(businessId: Id, staffId: Id): Promise<void> {
  const pending = readArea('finance').settlementEntries.filter((e) => e.businessId === businessId && e.staffId === staffId && e.seedRecalc && e.kind === 'sheet');
  if (pending.length === 0) return;
  const { staffSalaryForSheetSync } = await import('@/api/payroll');
  const amounts = new Map(pending.map((e) => [e.id, staffSalaryForSheetSync(businessId, staffId, (e.periodFrom ?? e.createdAt).slice(0, 10), (e.periodTo ?? e.createdAt).slice(0, 10))]));
  mutateArea('finance', (s) => {
    for (const e of s.settlementEntries) {
      const amount = amounts.get(e.id);
      if (amount === undefined) continue;
      e.amount = amount;
      delete e.seedRecalc;
    }
  });
}

export function listSettlementEntries(businessId: Id, staffId: Id, periodFrom?: string, periodTo?: string): Promise<SettlementEntry[]> {
  if (isApiMode()) return PayrollServer.listSettlements(businessId, staffId, periodFrom, periodTo) as Promise<SettlementEntry[]>;
  return request(async () => {
    await recalcSeedSheets(businessId, staffId);
    const all = readArea('finance').settlementEntries.filter((e) => e.businessId === businessId && e.staffId === staffId);
    const filtered = periodFrom && periodTo ? all.filter((e) => e.createdAt >= periodFrom && e.createdAt <= periodTo) : all;
    return [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  });
}

export function getSettlementBalance(businessId: Id, staffId: Id): Promise<Money> {
  if (isApiMode()) return PayrollServer.getStaffBalance(businessId, staffId).then((b) => b.remaining);
  return request(async () => {
    await recalcSeedSheets(businessId, staffId);
    return settlementBalance(readArea('finance').settlementEntries.filter((e) => e.businessId === businessId && e.staffId === staffId));
  });
}

/**
 * Создать расчётную ведомость (F-07-162) — сумма = зарплата мастера за период по его схеме (раздел «Зарплата»,
 * staffSalaryForSheetSync), та же, что в «Расчёте за период» и «Расчётной ведомости».
 */
/**
 * F-09-069: `draft: true` — «Сохранить как черновик» (не входит в баланс, доступен «Начислить» позже,
 * см. `accrueSettlementSheet`); по умолчанию — «Сохранить и начислить», как раньше.
 */
export function createSettlementSheet(businessId: Id, staffId: Id, periodFrom: string, periodTo: string, comment?: string, draft?: boolean): Promise<SettlementEntry> {
  if (isApiMode()) return PayrollServer.createSheet(businessId, staffId, periodFrom.slice(0, 10), periodTo.slice(0, 10), comment, draft) as Promise<SettlementEntry>;
  return request(async () => {
    assertCan('finance.edit');
    const from = periodFrom.slice(0, 10);
    const to = periodTo.slice(0, 10);
    // зарплата-ревью З1: сумма ведомости — ЗАРПЛАТА по схеме (тот же расчёт, что «Расчёт за период» раздела
    // «Зарплата»: строки услуг этого мастера, ставки, минимум, филиалы), а не выручка его визитов. Ленивый
    // импорт — api/payroll сам импортирует этот файл.
    const { staffSalaryForSheetSync } = await import('@/api/payroll');
    const amount = staffSalaryForSheetSync(businessId, staffId, from, to);
    const by = currentActorId();
    const at = nowDateTime();
    const entry: SettlementEntry = {
      id: newId('set'),
      businessId,
      staffId,
      kind: 'sheet',
      amount,
      label: `${dayjs(periodFrom).format('DD.MM.YYYY')}–${dayjs(periodTo).format('DD.MM.YYYY')}`,
      comment: comment?.trim() || undefined,
      periodFrom,
      periodTo,
      status: draft ? 'draft' : 'accrued',
      createdAt: at,
      createdBy: by,
    };
    mutateArea('finance', (s) => {
      s.settlementEntries.push(entry);
    });
    return entry;
  });
}

/** F-09-069: превращает черновик ведомости в начисленную — сумма входит в баланс с этого момента */
export function accrueSettlementSheet(businessId: Id, entryId: Id): Promise<SettlementEntry> {
  if (isApiMode()) return PayrollServer.accrueSheet(businessId, entryId) as Promise<SettlementEntry>;
  return request(() => {
    assertCan('finance.edit');
    let updated: SettlementEntry | undefined;
    mutateArea('finance', (s) => {
      const entry = s.settlementEntries.find((e) => e.id === entryId && e.businessId === businessId && e.kind === 'sheet');
      if (!entry) return;
      entry.status = 'accrued';
      updated = entry;
    });
    if (!updated) throw new Error('settlement_entry_not_found');
    return updated;
  });
}

/** Премия / штраф / внеочередное начисление сотруднику (F-07-161) */
export function createSettlementEntry(businessId: Id, staffId: Id, kind: Extract<SettlementEntryKind, 'bonus' | 'penalty' | 'adjustment'>, label: string, amount: Money, comment?: string): Promise<SettlementEntry> {
  if (isApiMode()) return PayrollServer.createEntry(businessId, staffId, kind, label, amount, comment) as Promise<SettlementEntry>;
  return request(() => {
    assertCan('finance.edit');
    const by = currentActorId();
    const at = nowDateTime();
    const entry: SettlementEntry = { id: newId('set'), businessId, staffId, kind, amount: roundToDram(Math.abs(amount)), label, comment: comment?.trim() || undefined, createdAt: at, createdBy: by };
    mutateArea('finance', (s) => {
      s.settlementEntries.push(entry);
    });
    return entry;
  });
}

/** Удалить ведомость, премию, штраф или внеочередное начисление (F-07-159) — убирает начисление из баланса */
export function deleteSettlementEntry(businessId: Id, entryId: Id): Promise<void> {
  if (isApiMode()) return PayrollServer.deleteEntry(businessId, entryId);
  return request(() => {
    assertCan('finance.edit');
    mutateArea('finance', (s) => {
      const entry = s.settlementEntries.find((e) => e.id === entryId && e.businessId === businessId);
      if (!entry || entry.kind === 'payout') return;
      s.settlementEntries = s.settlementEntries.filter((e) => e.id !== entryId);
    });
  });
}

/** «Выдать зарплату» (F-07-160) — расходная операция «Зарплата персонала» + строка выплаты во взаиморасчётах */
/**
 * Выдать зарплату (F-07-160). payroll-review З5: способ выплаты и дата выбираются в окне (раньше всегда «наличные» и
 * «сейчас»); из наличного ящика нельзя выдать больше, чем в нём есть, безналичный счёт — только с allowOverdraft.
 * Выплата сверх начисленного — решение окна (оно спрашивает), здесь не запрещается: аванс бывает.
 */
export function payoutSalary(
  businessId: Id,
  locationId: Id,
  staffId: Id,
  accountId: Id,
  amount: Money,
  comment?: string,
  options?: { method?: Operation['method']; date?: ISODateTime; allowOverdraft?: boolean },
): Promise<SettlementEntry> {
  if (isApiMode()) return PayrollServer.payout(businessId, locationId, staffId, accountId, amount, comment) as Promise<SettlementEntry>;
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const itemId = area.itemBySystemKey[businessId]?.staffPayroll;
    const account = area.accounts.find((a) => a.id === accountId && a.businessId === businessId);
    if (!itemId || !account) throw new Error('payroll_item_missing');
    if (!(roundToDram(amount) > 0)) throw new ApiError('invalid_amount');
    assertAccountCovers(accountId, roundToDram(amount), options?.allowOverdraft);
    const staffMember = readCore().staff.find((s) => s.id === staffId);
    const by = currentActorId();
    const at = options?.date ?? nowDateTime();
    const method = options?.method ?? (account.kind === 'cash' ? 'cash' : 'transfer');
    const opId = newId('op');
    const entry: SettlementEntry = { id: newId('set'), businessId, staffId, kind: 'payout', amount: roundToDram(amount), label: 'Выплата зарплаты', comment: comment?.trim() || undefined, operationId: opId, createdAt: at, createdBy: by };
    mutateArea('finance', (s) => {
      s.operations.push({
        id: opId,
        businessId,
        locationId,
        accountId,
        itemId,
        kind: 'expense',
        amount: roundToDram(amount),
        date: at,
        method,
        partyType: 'staff',
        partyId: staffId,
        partyName: staffMember?.name,
        comment: comment?.trim() || undefined,
        source: 'payroll',
        createdBy: by,
        createdAt: at,
        history: [{ at, by, action: 'created' }],
      });
      s.settlementEntries.push(entry);
    });
    return entry;
  });
}

/**
 * Отмена выплаты зарплаты (добавлено проверкой 2, F-07-160) — возвращает сумму и в кассу (через отмену
 * операции), и в баланс взаиморасчётов (убирая саму строку выплаты — решение поведения по умолчанию).
 */
export function cancelSalaryPayout(businessId: Id, entryId: Id): Promise<void> {
  if (isApiMode()) return Server.cancelSalaryPayout(businessId, entryId);
  return request(async () => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const entry = area.settlementEntries.find((e) => e.id === entryId && e.businessId === businessId && e.kind === 'payout');
    if (!entry) return;
    if (entry.operationId) await cancelOperation(businessId, entry.operationId);
    mutateArea('finance', (s) => {
      s.settlementEntries = s.settlementEntries.filter((e) => e.id !== entryId);
    });
  });
}

// ─────────────────────────── Настройки нефискального чека (F-07-147/148/158) ───────────────────────────

export function getReceiptSettings(businessId: Id): Promise<ReceiptSettings> {
  if (isApiMode()) return Server.getReceiptSettings(businessId);
  return request(() => {
    const existing = readArea('finance').receiptSettings[businessId];
    // Записи, сохранённые до появления полей, дополняем умолчаниями — иначе экран падает на Object.keys(undefined)
    if (existing) return withReceiptDefaults(existing);
    const fallback: ReceiptSettings = {
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
      updatedAt: nowDateTime(),
    };
    return fallback;
  });
}

/** Старые сохранённые настройки чека без новых полей — дополнить умолчаниями */
function withReceiptDefaults(r: ReceiptSettings): ReceiptSettings {
  return {
    ...r,
    requisites: { ...DEFAULT_RECEIPT_REQUISITES, ...(r.requisites ?? {}) },
    orgType: r.orgType ?? 'legal',
    orgRequisites: { ...DEFAULT_ORG_REQUISITES, ...(r.orgRequisites ?? {}) },
  };
}

export function saveReceiptSettings(businessId: Id, patch: ReceiptSettingsPatch): Promise<ReceiptSettings> {
  if (isApiMode()) return Server.saveReceiptSettings(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: ReceiptSettings | undefined;
    mutateArea('finance', (s) => {
      const stored = s.receiptSettings[businessId];
      const current = stored ? withReceiptDefaults(stored) : {
        businessId,
        format: 'thermal58' as const,
        clientName: true,
        clientPhone: true,
        clientEmail: false,
        requisites: { ...DEFAULT_RECEIPT_REQUISITES },
        orgType: 'legal' as const,
        orgRequisites: { ...DEFAULT_ORG_REQUISITES },
        taxPerLine: false,
        extraInfoEnabled: false,
        extraInfoText: '',
        showComment: true,
        vatIncludedEnabled: false,
        vatIncludedPct: 20,
        updatedAt: nowDateTime(),
      };
      const { requisites, orgRequisites, ...rest } = patch;
      const next: ReceiptSettings = {
        ...current,
        ...rest,
        requisites: { ...current.requisites, ...(requisites as Partial<ReceiptRequisiteFlags> | undefined) },
        orgRequisites: { ...current.orgRequisites, ...(orgRequisites as Partial<OrgRequisiteValues> | undefined) },
        updatedAt: nowDateTime(),
      };
      s.receiptSettings[businessId] = next;
      saved = next;
    });
    if (!saved) throw new Error('save_failed');
    return saved;
  });
}

export interface ReceiptLine {
  label: string;
  amount: Money;
  vat?: Money;
}

export interface ReceiptData {
  businessName: string;
  requisites: ReceiptRequisiteFlags;
  /** F-07-150 — настоящие значения реквизитов организации, попадают в чек по флагам requisites */
  orgRequisites: OrgRequisiteValues;
  format: ReceiptSettings['format'];
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  docNumber?: string;
  date: string;
  lines: ReceiptLine[];
  /** kind различает деньгами / скидкой / со счёта клиента — F-07-169 показывает скидку и счёт минусом */
  paymentLines: { label: string; amount: Money; kind: 'money' | 'discount' | 'account' }[];
  total: Money;
  comment?: string;
  extraInfoText?: string;
}

/** Данные нефискального чека визита (F-07-148) — что показывать/скачивать, по настройкам F-07-147/158 */
export function getBookingReceiptData(businessId: Id, bookingId: Id): Promise<ReceiptData> {
  if (isApiMode()) return Server.getBookingReceiptDataApi(businessId, bookingId);
  return request(() => {
    const core = readCore();
    const booking = core.bookings.find((b) => b.id === bookingId && b.businessId === businessId);
    if (!booking) throw new Error('booking_not_found');
    const business = core.businesses.find((b) => b.id === businessId);
    const client = booking.clientId ? core.clients.find((c) => c.id === booking.clientId) : undefined;
    const storedSettings = readArea('finance').receiptSettings[businessId];
    const settings = storedSettings ?? {
      requisites: DEFAULT_RECEIPT_REQUISITES,
      orgRequisites: DEFAULT_ORG_REQUISITES,
      format: 'thermal58',
      taxPerLine: false,
      vatIncludedEnabled: false,
      vatIncludedPct: 20,
      extraInfoEnabled: false,
      extraInfoText: '',
    };
    const area = readArea('finance');
    const payments = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === bookingId && !p.cancelled);
    const firstOp = payments.find((p) => p.operationId)?.operationId;
    const lines: ReceiptLine[] = booking.services.map((line) => {
      const svc = core.services.find((s) => s.id === line.serviceId);
      const amount = roundToDram(line.price * line.qty);
      return { label: svc?.name.ru ?? '—', amount, vat: settings.vatIncludedEnabled ? vatIncludedInPrice(amount, settings.vatIncludedPct) : undefined };
    });
    // Товары визита (28.09): тем же счётом, что «К оплате» (goodsLinesOf) — чек показывает весь визит, а не только услуги
    for (const g of goodsLinesOf(booking)) {
      lines.push({
        label: g.qty > 1 ? `${g.name} × ${g.qty}` : g.name,
        amount: g.total,
        vat: settings.vatIncludedEnabled ? vatIncludedInPrice(g.total, settings.vatIncludedPct) : undefined,
      });
    }
    return {
      businessName: business?.name ?? '—',
      // старые сохранённые настройки без этих полей — дополнить умолчаниями
      requisites: { ...DEFAULT_RECEIPT_REQUISITES, ...(settings.requisites ?? {}) },
      orgRequisites: { ...DEFAULT_ORG_REQUISITES, ...(settings.orgRequisites ?? {}) },
      format: settings.format,
      clientName: settings.clientName ? client?.name : undefined,
      clientPhone: settings.clientPhone ? client?.phone : undefined,
      clientEmail: settings.clientEmail ? client?.email : undefined,
      docNumber: firstOp ? area.operations.find((o) => o.id === firstOp)?.docNumber : undefined,
      date: booking.start,
      lines,
      // Один платёж — одна строка чека, как бы он ни разнёсся по услугам (fin-review Ф11); возврат — отдельной строкой
      // ⭐ F-00-097: предоплата, полученная мастером переводом, — первой строкой: иначе в чеке «Итого» больше оплаченного
      paymentLines: [
        ...(prepaidOf(booking) > 0 ? [{ label: 'Предоплата', amount: prepaidOf(booking), kind: 'money' as const }] : []),
        ...groupBookingPayments(payments).flatMap((g) => [
          { label: g.methodLabel, amount: g.amount, kind: g.kind },
          ...(g.refunded > 0 ? [{ label: `Возврат · ${g.methodLabel}`, amount: -g.refunded, kind: 'money' as const }] : []),
        ]),
      ],
      total: payableTotalOf(booking),
      comment: settings.showComment ? area.bookingPaymentNotes[`${businessId}:${bookingId}`] : undefined,
      extraInfoText: settings.extraInfoEnabled ? settings.extraInfoText : undefined,
    };
  });
}

// ─────────────────────────── Права раздела «Финансы» (F-07-166…168) ───────────────────────────

export function getFinanceRights(_businessId: Id, staffId: Id): Promise<FinanceRights> {
  if (isApiMode()) return Server.getFinanceRights(_businessId, staffId);
  return request(() => readArea('finance').financeRights[staffId] ?? FINANCE_RIGHTS_FULL);
}

export function listFinanceRightsByStaff(businessId: Id): Promise<Record<Id, FinanceRights>> {
  if (isApiMode()) return Server.listFinanceRightsByStaff(businessId);
  return request(() => {
    const all = readArea('finance').financeRights;
    const staffIds = new Set(readCore().staff.filter((s) => s.businessId === businessId).map((s) => s.id));
    const result: Record<Id, FinanceRights> = {};
    for (const [staffId, rights] of Object.entries(all)) {
      if (staffIds.has(staffId)) result[staffId] = rights;
    }
    return result;
  });
}

export function saveFinanceRights(businessId: Id, staffId: Id, patch: Partial<FinanceRights>): Promise<FinanceRights> {
  if (isApiMode()) return Server.saveFinanceRights(businessId, staffId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: FinanceRights | undefined;
    mutateArea('finance', (s) => {
      const current = s.financeRights[staffId] ?? { ...FINANCE_RIGHTS_FULL };
      const next = { ...current, ...patch };
      s.financeRights[staffId] = next;
      saved = next;
    });
    if (!saved) throw new Error('save_failed');
    return saved;
  });
}

// ═══════════════════════════ b04 — онлайн-платежи (F-07-076…157) ═══════════════════════════
// ⭐ F-00-028: деньги через продукт мы не принимаем — эти функции только ИМИТИРУЮТ жизненный цикл
// онлайн-платежа на моках (создать ссылку → клиент «оплатил» вручную по реквизитам → мы подтверждаем).

const ONLINE_PROVIDER_KEYS: OnlineProviderKey[] = ['arca', 'idram', 'telcell'];

function defaultOnlinePaymentSettings(businessId: Id): OnlinePaymentSettings {
  return { businessId, providerByWay: { link: null, widgetPrepayment: null, onlineSales: null }, updatedAt: nowDateTime() };
}

export function getOnlinePaymentSettings(businessId: Id): Promise<OnlinePaymentSettings> {
  if (isApiMode()) return Server.getOnlinePaymentSettings(businessId);
  return request(() => readArea('finance').onlinePaymentSettings[businessId] ?? defaultOnlinePaymentSettings(businessId));
}

/** F-07-077 — платёжная система на способ; ни одна недоступна в Армении, выбор чисто демонстрационный */
export function setOnlinePaymentProvider(businessId: Id, way: OnlinePaymentWay, provider: OnlineProviderKey | null): Promise<OnlinePaymentSettings> {
  if (isApiMode()) return Server.setOnlinePaymentProvider(businessId, way, provider);
  return request(() => {
    assertCan('finance.edit');
    let saved: OnlinePaymentSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.onlinePaymentSettings[businessId] ?? defaultOnlinePaymentSettings(businessId);
      const next: OnlinePaymentSettings = { ...current, providerByWay: { ...current.providerByWay, [way]: provider }, updatedAt: nowDateTime() };
      s.onlinePaymentSettings[businessId] = next;
      saved = next;
    });
    return saved!;
  });
}

export function listOnlineProviderKeys(): OnlineProviderKey[] {
  return ONLINE_PROVIDER_KEYS;
}

// ── Ссылка на оплату, QR и жизненный цикл (F-07-078…083, 156, 183) ──

function defaultOnlineLinkSettings(businessId: Id): OnlineLinkSettings {
  return { businessId, requisitesText: '', waitMinutes: 30, staticQrEnabled: true, updatedAt: nowDateTime() };
}

export function getOnlineLinkSettings(businessId: Id): Promise<OnlineLinkSettings> {
  if (isApiMode()) return Server.getOnlineLinkSettings(businessId);
  return request(() => readArea('finance').onlineLinkSettings[businessId] ?? defaultOnlineLinkSettings(businessId));
}

export type OnlineLinkSettingsPatch = Partial<Pick<OnlineLinkSettings, 'requisitesText' | 'waitMinutes' | 'staticQrEnabled'>>;

export function saveOnlineLinkSettings(businessId: Id, patch: OnlineLinkSettingsPatch): Promise<OnlineLinkSettings> {
  if (isApiMode()) return Server.saveOnlineLinkSettings(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: OnlineLinkSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.onlineLinkSettings[businessId] ?? defaultOnlineLinkSettings(businessId);
      const next: OnlineLinkSettings = { ...current, ...patch, updatedAt: nowDateTime() };
      s.onlineLinkSettings[businessId] = next;
      saved = next;
    });
    return saved!;
  });
}

/** Ссылки видимые сейчас — со статусом, пересчитанным относительно текущего времени (F-07-080), новые сверху */
export function listPaymentLinks(businessId: Id): Promise<PaymentLink[]> {
  if (isApiMode()) return Server.listPaymentLinks(businessId);
  return request(() => {
    const now = nowDateTime();
    return readArea('finance')
      .paymentLinks.filter((l) => l.businessId === businessId)
      .map((l) => ({ ...l, status: effectivePaymentLinkStatus(l, now) }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });
}

/** Ссылка визита, если есть живая или последняя выданная (для вкладки «Оплата», F-07-079/080) */
export function getPaymentLinkForBooking(businessId: Id, bookingId: Id): Promise<PaymentLink | null> {
  if (isApiMode()) return Server.getPaymentLinkForBooking(businessId, bookingId);
  return request(() => {
    const now = nowDateTime();
    const links = readArea('finance')
      .paymentLinks.filter((l) => l.businessId === businessId && l.bookingId === bookingId)
      .map((l) => ({ ...l, status: effectivePaymentLinkStatus(l, now) }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return links[0] ?? null;
  });
}

/** Создать ссылку на оплату визита или продажи вне визита (F-07-079/081/082) — сумма может быть меньше остатка */
export function createPaymentLink(businessId: Id, input: PaymentLinkInput): Promise<PaymentLink> {
  if (isApiMode()) return Server.createPaymentLink(businessId, input);
  return request(async () => {
    assertCan('journal.edit');
    if (input.amount <= 0) throw new Error('amount_must_be_positive');
    if (input.amount > input.remainingBefore) throw new Error('amount_exceeds_due');
    const settings = await getOnlineLinkSettings(businessId);
    const by = currentActorId();
    const link: PaymentLink = {
      id: newId('plk'),
      businessId,
      targetKind: input.targetKind,
      bookingId: input.bookingId,
      saleLabel: input.saleLabel,
      amount: roundToDram(input.amount),
      remainingBefore: input.remainingBefore,
      status: 'pending',
      createdAt: nowDateTime(),
      createdBy: by,
      expiresAt: toISODateTimeAdd(settings.waitMinutes),
      requisitesText: settings.requisitesText,
    };
    mutateArea('finance', (s) => {
      s.paymentLinks.push(link);
    });
    return link;
  });
}

function toISODateTimeAdd(minutes: number): string {
  return dayjs(nowDateTime()).add(minutes, 'minute').toISOString();
}

/** Клиент нажал «Я оплатил» — переводит ссылку в «Оплачен» и заводит деньги на кассу онлайн-платежей.
 * Для ссылки на визит создаёт платёж по строкам (частичная — F-07-081) и метку категории (F-07-098). */
export function markPaymentLinkPaid(businessId: Id, id: Id): Promise<PaymentLink> {
  if (isApiMode()) return Server.markPaymentLinkPaid(businessId, id);
  return request(async () => {
    assertCan('journal.edit');
    const area = readArea('finance');
    const link = area.paymentLinks.find((l) => l.id === id && l.businessId === businessId);
    if (!link) throw new Error('link_not_found');
    const now = nowDateTime();
    if (!paymentLinkIsLive(link, now)) throw new Error('link_not_live');

    const onlineAccount = area.accounts.find((a) => a.businessId === businessId && a.systemGenerated && !a.systemKey);
    if (!onlineAccount) throw new Error('online_account_missing');

    let operationId: Id | undefined;
    if (link.targetKind === 'booking' && link.bookingId) {
      const booking = await requireBooking(businessId, link.bookingId);
      const lineTotals = lineTotalsOf(booking);
      const existing = area.bookingPayments.filter((p) => p.businessId === businessId && p.bookingId === booking.id && !p.cancelled);
      const tile: PaymentMethodTile = { key: 'onlineLink', kind: 'custom', label: 'Оплата по ссылке', accountId: onlineAccount.id, feePct: 0 };
      const amount = Math.min(link.amount, amountDueOf(booking, existing));
      if (amount > 0) {
        const result = applyMoneyToBooking(businessId, booking, lineTotals, existing, amount, tile);
        operationId = result.lines[0]?.operationId;
      }
      mutateArea('finance', (s) => {
        s.bookingOnlineCategory[`${businessId}:${booking.id}`] = amount + prepaidOf(booking) >= payableTotalOf(booking) ? 'onlineFull' : 'onlinePartial';
      });
    } else {
      const itemId = area.itemBySystemKey[businessId]?.otherIncome;
      if (itemId) {
        const by = currentActorId();
        const opId = newId('op');
        mutateArea('finance', (s) => {
          s.operations.push({
            id: opId,
            businessId,
            locationId: onlineAccount.locationId,
            accountId: onlineAccount.id,
            itemId,
            kind: 'income',
            amount: link.amount,
            date: now,
            method: 'other',
            partyType: 'none',
            comment: link.saleLabel,
            source: 'sale',
            createdBy: by,
            createdAt: now,
            history: [{ at: now, by, action: 'created' }],
          });
        });
        operationId = opId;
      }
    }

    let saved: PaymentLink | undefined;
    mutateArea('finance', (s) => {
      const l = s.paymentLinks.find((x) => x.id === id);
      if (!l) return;
      l.status = 'paid';
      l.paidAt = now;
      l.operationId = operationId;
      saved = l;
    });
    if (!saved) throw new Error('link_not_found');
    return saved;
  });
}

export function cancelPaymentLink(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.cancelPaymentLink(businessId, id);
  return request(() => {
    assertCan('journal.edit');
    mutateArea('finance', (s) => {
      const link = s.paymentLinks.find((l) => l.id === id && l.businessId === businessId);
      if (!link || link.status !== 'pending') return;
      link.status = 'cancelled';
      link.cancelledAt = nowDateTime();
    });
  });
}

/** Онлайн-категория записи для журнала (F-07-098, значки F-01-028) — системная метка, читает-только сосед */
export function getBookingOnlineCategory(businessId: Id, bookingId: Id): Promise<BookingOnlineCategory | null> {
  if (isApiMode()) return Server.getBookingOnlineCategory(businessId, bookingId);
  return request(() => readArea('finance').bookingOnlineCategory[`${businessId}:${bookingId}`] ?? null);
}

// ── Предоплата в виджете (F-07-088…098) ──

function defaultPrepaymentSettings(businessId: Id): PrepaymentSettings {
  return { businessId, mode: 'off', amountType: 'percent', amountValue: 30, waitMinutes: 15, requiredServiceIds: [], requiredAllServices: false, requiredStaffIds: [], updatedAt: nowDateTime() };
}

export function getPrepaymentSettings(businessId: Id): Promise<PrepaymentSettings> {
  if (isApiMode()) return Server.getPrepaymentSettings(businessId);
  return request(() => readArea('finance').prepaymentSettings[businessId] ?? defaultPrepaymentSettings(businessId));
}

export type PrepaymentSettingsPatch = Partial<Omit<PrepaymentSettings, 'businessId' | 'updatedAt'>>;

export function savePrepaymentSettings(businessId: Id, patch: PrepaymentSettingsPatch): Promise<PrepaymentSettings> {
  if (isApiMode()) return Server.savePrepaymentSettings(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: PrepaymentSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.prepaymentSettings[businessId] ?? defaultPrepaymentSettings(businessId);
      const next: PrepaymentSettings = { ...current, ...patch, updatedAt: nowDateTime() };
      s.prepaymentSettings[businessId] = next;
      saved = next;
    });
    return saved!;
  });
}

export function listStaffPrepayment(businessId: Id): Promise<StaffPrepayment[]> {
  if (isApiMode()) return Server.listStaffPrepayment(businessId);
  return request(() => Object.values(readArea('finance').staffPrepayment[businessId] ?? {}));
}

export function getStaffPrepayment(businessId: Id, staffId: Id): Promise<StaffPrepayment | null> {
  if (isApiMode()) return Server.getStaffPrepayment(businessId, staffId);
  return request(() => readArea('finance').staffPrepayment[businessId]?.[staffId] ?? null);
}

/** ⭐ F-00-066/F-00-097 — мастер сам включает у себя обязательную предоплату (по умолчанию — 100%) */
export function setStaffPrepayment(businessId: Id, staffId: Id, patch: Partial<Omit<StaffPrepayment, 'staffId'>>): Promise<StaffPrepayment> {
  if (isApiMode()) return Server.setStaffPrepayment(businessId, staffId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: StaffPrepayment | undefined;
    mutateArea('finance', (s) => {
      s.staffPrepayment[businessId] = s.staffPrepayment[businessId] ?? {};
      const current = s.staffPrepayment[businessId][staffId] ?? { staffId, enabled: false, amountType: 'percent' as const, amountValue: 100 };
      const next: StaffPrepayment = { ...current, ...patch, staffId };
      s.staffPrepayment[businessId][staffId] = next;
      saved = next;
    });
    return saved!;
  });
}

/** Приоритет мастер → услуги/сотрудники общей настройки → выключено; сумма — от минимальной цены (F-07-092/097) */
export function calcPrepayment(businessId: Id, input: PrepaymentCalcInput): Promise<PrepaymentCalcResult> {
  if (isApiMode()) return Server.calcPrepayment(businessId, input);
  return request(() => {
    const general = readArea('finance').prepaymentSettings[businessId] ?? defaultPrepaymentSettings(businessId);
    const staffOverride = input.staffId ? (readArea('finance').staffPrepayment[businessId]?.[input.staffId] ?? undefined) : undefined;
    const servicePrepayment = readArea('finance').servicePrepayment[businessId] ?? {};
    return calcPrepaymentPure(general, staffOverride, { ...input, servicePrepayment: input.servicePrepayment ?? servicePrepayment });
  });
}

export function listServicePrepayment(businessId: Id): Promise<ServicePrepayment[]> {
  if (isApiMode()) return Server.listServicePrepayment(businessId);
  return request(() => Object.values(readArea('finance').servicePrepayment[businessId] ?? {}));
}

/** ⭐ F-07-094 — своя % / сумма у конкретной услуги, переопределяет общую настройку предоплаты */
export function setServicePrepayment(businessId: Id, serviceId: Id, patch: Partial<Omit<ServicePrepayment, 'serviceId'>>): Promise<ServicePrepayment> {
  if (isApiMode()) return Server.setServicePrepayment(businessId, serviceId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: ServicePrepayment | undefined;
    mutateArea('finance', (s) => {
      s.servicePrepayment[businessId] = s.servicePrepayment[businessId] ?? {};
      const current = s.servicePrepayment[businessId][serviceId] ?? { serviceId, amountType: 'percent' as const, amountValue: 100 };
      const next: ServicePrepayment = { ...current, ...patch, serviceId };
      s.servicePrepayment[businessId][serviceId] = next;
      saved = next;
    });
    return saved!;
  });
}

/** Услуги и мастера бизнеса для выбора в настройке обязательной предоплаты (F-07-089/090) */
export function listServicesBrief(businessId: Id): Promise<{ id: Id; name: string; free: boolean }[]> {
  if (isApiMode()) return Server.listServicesBrief(businessId);
  return request(() =>
    readCore()
      .services.filter((s) => s.businessId === businessId)
      .map((s) => ({ id: s.id, name: s.name.ru, free: !s.priceMin || s.priceMin <= 0 }))
  );
}

export function listStaffBriefFinance(businessId: Id): Promise<{ id: Id; name: string }[]> {
  if (isApiMode()) return Server.listStaffBriefFinance(businessId);
  return request(() => readCore().staff.filter((s) => s.businessId === businessId && s.role !== 'owner').map((s) => ({ id: s.id, name: s.name })));
}

// ── Фискализация стран — образцы 1:1, недоступны в Армении (F-07-152…157) ──

function defaultFiscalSettings(businessId: Id): FiscalSettings {
  return {
    businessId,
    ukraine: { proRroConnected: false, cashierName: '', cardReceiptMode: 'single' },
    hungary: { billingoConnected: false },
    brazil: { notaFiscalConnected: false },
    updatedAt: nowDateTime(),
  };
}

export function getFiscalSettings(businessId: Id): Promise<FiscalSettings> {
  if (isApiMode()) return Server.getFiscalSettings(businessId);
  return request(() => readArea('finance').fiscalSettings[businessId] ?? defaultFiscalSettings(businessId));
}

export type FiscalSettingsPatch = Partial<{ armenia: Partial<NonNullable<FiscalSettings['armenia']>>; ukraine: Partial<FiscalSettings['ukraine']>; hungary: Partial<FiscalSettings['hungary']>; brazil: Partial<FiscalSettings['brazil']> }>;

export function saveFiscalSettings(businessId: Id, patch: FiscalSettingsPatch): Promise<FiscalSettings> {
  if (isApiMode()) return Server.saveFiscalSettings(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: FiscalSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.fiscalSettings[businessId] ?? defaultFiscalSettings(businessId);
      const next: FiscalSettings = {
        ...current,
        armenia: { remindToPrint: false, hdmRegNumber: '', ...current.armenia, ...patch.armenia },
        ukraine: { ...current.ukraine, ...patch.ukraine },
        hungary: { ...current.hungary, ...patch.hungary },
        brazil: { ...current.brazil, ...patch.brazil },
        updatedAt: nowDateTime(),
      };
      s.fiscalSettings[businessId] = next;
      saved = next;
    });
    return saved!;
  });
}

// ═══════════════════════ b05 — Политика оплаты: депозит, гарантия картой (F-07-101…130) ═══════════════════════
// ⭐ F-00-028: приём денег онлайн отложен — весь блок работает на моках, помечен «демо» в интерфейсе.
// API для соседей (journal): isPolicyActive, policyAppliesToDraft, createBookingPolicySnapshot,
// getBookingPolicySnapshot — сигнатуры стабильны, см. qa/requests/finance.md.

function isAdyenConnectedSync(businessId: Id): boolean {
  return readArea('finance').adyenConnections[businessId]?.status === 'connected';
}

/** F-07-101: «Deposit» принимает любую подключённую платёжную систему — Adyen или любой онлайн-провайдер способа оплаты */
function isAnyPaymentSystemConnectedSync(businessId: Id): boolean {
  if (isAdyenConnectedSync(businessId)) return true;
  const settings = readArea('finance').onlinePaymentSettings[businessId];
  if (!settings) return false;
  return Object.values(settings.providerByWay).some((provider) => provider !== null);
}

export function getPaymentPolicy(businessId: Id): Promise<PaymentPolicy> {
  if (isApiMode()) return Server.getPaymentPolicy(businessId);
  return request(() => readArea('finance').paymentPolicy[businessId] ?? defaultPaymentPolicy(businessId, nowDateTime()));
}

/** Активна ли политика прямо сейчас (F-07-101) — для соседей (journal, online) */
export function isPolicyActive(businessId: Id): Promise<boolean> {
  if (isApiMode()) return Server.isPolicyActive(businessId);
  return request(() => (readArea('finance').paymentPolicy[businessId]?.mode ?? 'none') !== 'none');
}

export type PaymentPolicyPatch = Partial<Pick<PaymentPolicy, 'mode' | 'deposit' | 'cardGuarantee' | 'conditions'>>;

/** Save — F-07-101…110: валидирует режим/Adyen/суммы, ставит activatedAt и снимок «Activated» */
export function savePaymentPolicy(businessId: Id, patch: PaymentPolicyPatch): Promise<PaymentPolicy> {
  if (isApiMode()) return Server.savePaymentPolicy(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const current = area.paymentPolicy[businessId] ?? defaultPaymentPolicy(businessId, nowDateTime());
    const next: PaymentPolicy = {
      ...current,
      ...patch,
      deposit: patch.deposit ? { ...current.deposit, ...patch.deposit } : current.deposit,
      cardGuarantee: patch.cardGuarantee ? { ...current.cardGuarantee, ...patch.cardGuarantee } : current.cardGuarantee,
      conditions: patch.conditions ? { ...current.conditions, ...patch.conditions } : current.conditions,
    };
    if (next.mode === 'cardGuarantee' && !isAdyenConnectedSync(businessId)) {
      throw new ApiError('validation', 'Гарантия картой недоступна без подключённого Adyen');
    }
    if (next.mode === 'deposit' && !isAnyPaymentSystemConnectedSync(businessId)) {
      throw new ApiError('validation', 'Депозит недоступен без подключённой платёжной системы');
    }
    if (next.mode === 'deposit' && (!next.deposit.amount.value || next.deposit.amount.value <= 0)) {
      throw new ApiError('validation', 'Депозит не может быть равен нулю');
    }
    if (next.deposit.creditDepositOnCancel && (next.deposit.freeCancellationWindowHours < 1 || next.deposit.freeCancellationWindowHours > 72)) {
      throw new ApiError('validation', 'Окно бесплатной отмены — от 1 до 72 часов');
    }
    if (next.cardGuarantee.allowFreeCancellation && (next.cardGuarantee.freeCancellationWindowHours < 1 || next.cardGuarantee.freeCancellationWindowHours > 72)) {
      throw new ApiError('validation', 'Окно бесплатной отмены — от 1 до 72 часов');
    }
    if (!isAdyenConnectedSync(businessId)) {
      next.deposit = { ...next.deposit, noShowFeeAboveDeposit: undefined };
    }
    next.updatedAt = nowDateTime();
    if (next.mode !== 'none') {
      next.activatedAt = nowDateTime();
      next.lastSnapshot =
        next.mode === 'deposit'
          ? {
              mode: 'deposit',
              depositAmountLabel: next.deposit.amount.mode === 'percent' ? `${next.deposit.amount.value}%` : `${next.deposit.amount.value} ֏`,
              noShowFeeLabel: next.deposit.noShowFeeAboveDeposit ? `${next.deposit.noShowFeeAboveDeposit} ֏` : undefined,
              freeCancellationWindowHours: next.deposit.creditDepositOnCancel ? next.deposit.freeCancellationWindowHours : undefined,
              deadlineMin: next.deposit.paymentDeadlineMin,
              clientScope: next.conditions.clientScope,
              savedAt: next.updatedAt,
            }
          : {
              mode: 'cardGuarantee',
              lateCancellationFeeLabel: next.cardGuarantee.chargeLateCancellationFee ? (next.cardGuarantee.lateCancellationFee.mode === 'percent' ? `${next.cardGuarantee.lateCancellationFee.value}%` : `${next.cardGuarantee.lateCancellationFee.value} ֏`) : undefined,
              noShowFeeLabel: next.cardGuarantee.chargeNoShowFee ? (next.cardGuarantee.noShowFee.mode === 'percent' ? `${next.cardGuarantee.noShowFee.value}%` : `${next.cardGuarantee.noShowFee.value} ֏`) : undefined,
              freeCancellationWindowHours: next.cardGuarantee.allowFreeCancellation ? next.cardGuarantee.freeCancellationWindowHours : undefined,
              deadlineMin: next.cardGuarantee.deadlineMin,
              clientScope: next.conditions.clientScope,
              savedAt: next.updatedAt,
            };
    }
    // «No payment policy» выключает без удаления настроек (F-07-110) — deposit/cardGuarantee/conditions сохраняются
    mutateArea('finance', (s) => {
      s.paymentPolicy[businessId] = next;
    });
    return next;
  });
}

// ─────────────────────────── Своя политика услуги (F-07-106) ───────────────────────────

export function listServicePolicyOverrides(businessId: Id): Promise<PaymentPolicyServiceOverride[]> {
  if (isApiMode()) return Server.listServicePolicyOverrides(businessId);
  return request(() => Object.values(readArea('finance').policyServiceOverrides[businessId] ?? {}));
}

export function setServicePolicyOverride(businessId: Id, serviceId: Id, override: PaymentPolicyServiceOverride | null): Promise<void> {
  if (isApiMode()) return Server.setServicePolicyOverride(businessId, serviceId, override);
  return request(() => {
    assertCan('finance.edit');
    mutateArea('finance', (s) => {
      s.policyServiceOverrides[businessId] = s.policyServiceOverrides[businessId] ?? {};
      if (override) s.policyServiceOverrides[businessId][serviceId] = override;
      else delete s.policyServiceOverrides[businessId][serviceId];
    });
  });
}

// ─────────────────────────── Adyen: подключение (F-07-104/135), Dashboard (F-07-136), возвраты (F-07-137) ───────────────────────────

export function getAdyenConnection(businessId: Id): Promise<AdyenConnection> {
  if (isApiMode()) return Server.getAdyenConnection(businessId);
  return request(() => readArea('finance').adyenConnections[businessId] ?? { businessId, status: 'notConnected' });
}

/** F-07-135: «только владелец локации» — включает мастера-индивидуала (владелец своего бизнеса) и сеть */
function isOwnerLikePersona(persona: string): boolean {
  return persona === 'owner' || persona === 'network' || persona === 'individual';
}

/** Только владелец локации может начать подключение (F-07-135) */
export function startAdyenOnboarding(businessId: Id, input: { legalEntityName: string; country: string; shopperStatement: string }): Promise<AdyenConnection> {
  if (isApiMode()) return Server.startAdyenOnboarding(businessId, input);
  return request(() => {
    const actor = currentActor();
    if (!isOwnerLikePersona(actor.persona)) throw new ApiError('forbidden', 'Подключить Adyen может только владелец');
    const startedAt = nowDateTime();
    const next: AdyenConnection = {
      businessId,
      status: 'onboarding',
      legalEntityName: input.legalEntityName,
      country: input.country,
      shopperStatement: input.shopperStatement,
      onboardingStartedAt: startedAt,
      onboardingDeadline: toISODateTimeShift(startedAt, 60),
    };
    mutateArea('finance', (s) => {
      s.adyenConnections[businessId] = next;
    });
    return next;
  });
}

/** Демо: завершает онбординг Adyen (в реальности — вебхук от Adyen) — доступно, пока не истёк час */
export function completeAdyenOnboarding(businessId: Id): Promise<AdyenConnection> {
  if (isApiMode()) return Server.completeAdyenOnboarding(businessId);
  return request(() => {
    const actor = currentActor();
    if (!isOwnerLikePersona(actor.persona)) throw new ApiError('forbidden', 'Только владелец завершает онбординг Adyen');
    const current = readArea('finance').adyenConnections[businessId];
    if (!current || current.status !== 'onboarding') throw new ApiError('validation', 'Онбординг Adyen не начат');
    if (current.onboardingDeadline && current.onboardingDeadline < nowDateTime()) throw new ApiError('validation', 'Час на онбординг истёк — выпустите ссылку заново');
    const next: AdyenConnection = { ...current, status: 'connected', connectedAt: nowDateTime() };
    mutateArea('finance', (s) => {
      s.adyenConnections[businessId] = next;
    });
    return next;
  });
}

export interface AdyenTransactionFilter {
  type?: AdyenTransaction['type'];
  pspReference?: string;
  from?: string;
  to?: string;
}

export function listAdyenTransactions(businessId: Id, filter: AdyenTransactionFilter = {}): Promise<AdyenTransaction[]> {
  if (isApiMode()) return Server.listAdyenTransactions(businessId, filter);
  return request(() => {
    let rows = readArea('finance').adyenTransactions.filter((t) => t.businessId === businessId);
    if (filter.type) rows = rows.filter((t) => t.type === filter.type);
    if (filter.pspReference) rows = rows.filter((t) => t.pspReference.includes(filter.pspReference!.trim()));
    if (filter.from) rows = rows.filter((t) => t.date >= filter.from!);
    if (filter.to) rows = rows.filter((t) => t.date <= filter.to!);
    return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  });
}

/** Возврат из Adyen Dashboard — только владелец (F-07-137) */
export function refundAdyenTransaction(businessId: Id, transactionId: Id): Promise<AdyenTransaction> {
  if (isApiMode()) return Server.refundAdyenTransaction(businessId, transactionId);
  return request(() => {
    const actor = currentActor();
    if (!isOwnerLikePersona(actor.persona)) throw new ApiError('forbidden', 'Возврат в Adyen Dashboard доступен только владельцу');
    const original = readArea('finance').adyenTransactions.find((t) => t.id === transactionId && t.businessId === businessId);
    if (!original) throw new ApiError('not_found', 'Транзакция не найдена');
    if (original.refunded) throw new ApiError('validation', 'Уже возвращено');
    const refundTxn: AdyenTransaction = {
      id: newId('ady'),
      businessId,
      date: nowDateTime(),
      method: original.method,
      type: 'refund',
      netAmount: -original.netAmount,
      grossAmount: -original.grossAmount,
      pspReference: original.pspReference,
    };
    mutateArea('finance', (s) => {
      const row = s.adyenTransactions.find((t) => t.id === transactionId);
      if (row) row.refunded = true;
      s.adyenTransactions.push(refundTxn);
    });
    return refundTxn;
  });
}

function toISODateTimeShift(iso: string, minutes: number): string {
  return toISODateTime(dayjs(iso).add(minutes, 'minute'));
}

// ─────────────────────────── Счёт клиента «Payment Policy» (F-07-112, F-07-122, F-07-123) ───────────────────────────

export function listPolicyAccountEntries(businessId: Id, clientId: Id): Promise<PolicyAccountEntry[]> {
  if (isApiMode()) return Server.listPolicyAccountEntries(businessId, clientId);
  return request(() => {
    const rows = readArea('finance').policyAccountEntries.filter((e) => e.businessId === businessId && e.clientId === clientId);
    return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });
}

export function getPolicyAccountSummary(businessId: Id, clientId: Id): Promise<PolicyAccountSummary> {
  if (isApiMode()) return Server.getPolicyAccountSummary(businessId, clientId);
  return request(() => computePolicyAccountSummary(readArea('finance').policyAccountEntries.filter((e) => e.businessId === businessId && e.clientId === clientId)));
}

/** Должник (F-07-123) — метка нигде не видна игроку, используется только охватом политики */
export function isClientPolicyDebtor(businessId: Id, clientId: Id): Promise<boolean> {
  if (isApiMode()) return Server.isClientPolicyDebtor(businessId, clientId);
  return request(() => {
    const area = readArea('finance');
    const summary = computePolicyAccountSummary(area.policyAccountEntries.filter((e) => e.businessId === businessId && e.clientId === clientId));
    const otherBalance = area.clientAccountBalances[businessId]?.[clientId] ?? 0;
    return isPolicyDebtor(summary, otherBalance);
  });
}

function pushPolicyEntry(businessId: Id, clientId: Id, kind: PolicyAccountEntry['kind'], amount: Money, source: string, bookingId: Id | undefined, by: string): PolicyAccountEntry {
  const area = readArea('finance');
  const prevSummary = computePolicyAccountSummary(area.policyAccountEntries.filter((e) => e.businessId === businessId && e.clientId === clientId));
  let inHoldAfter = prevSummary.inHold;
  if (kind === 'topUp') inHoldAfter = roundToDram(inHoldAfter + amount);
  else if (kind === 'holdRelease' || kind === 'holdConfirm') inHoldAfter = Math.max(0, roundToDram(inHoldAfter - Math.abs(amount)));
  const entry: PolicyAccountEntry = {
    id: newId('pae'),
    businessId,
    clientId,
    kind,
    amount: roundToDram(amount),
    balanceAfter: roundToDram(prevSummary.balance + amount),
    inHoldAfter,
    source,
    bookingId,
    createdAt: nowDateTime(),
    createdBy: by,
  };
  mutateArea('finance', (s) => {
    s.policyAccountEntries.push(entry);
  });
  return entry;
}

// ─────────────────────────── Оценка охвата и снимок записи (F-07-105…109, 113, 114, 124…127) ───────────────────────────

export interface PolicyEvaluationInput {
  serviceIds: Id[];
  freeServiceIds?: Id[];
  staffId?: Id;
  isNewClient: boolean;
  isDebtor: boolean;
  hasActiveMembershipForService?: boolean;
  visitTotal: Money;
}

export interface PolicyEvaluationResult {
  applies: boolean;
  mode: PaymentPolicy['mode'];
  depositAmount?: Money;
  noShowFee?: Money;
  lateCancellationFee?: Money;
  freeCancellationWindowHours: number;
  deadlineMin: number;
}

/** Оценка охвата для черновика записи (F-07-124…127) — соседи (journal, online) считают, показывать ли шаг оплаты */
export function evaluatePolicyForBooking(businessId: Id, input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
  if (isApiMode()) return Server.evaluatePolicyForBooking(businessId, input);
  return request(() => {
    const policy = readArea('finance').paymentPolicy[businessId] ?? defaultPaymentPolicy(businessId, nowDateTime());
    const ctx: PolicyApplicabilityContext = {
      serviceIds: input.serviceIds,
      freeServiceIds: input.freeServiceIds ?? [],
      staffId: input.staffId,
      isNewClient: input.isNewClient,
      isDebtor: input.isDebtor,
      hasActiveMembershipForService: input.hasActiveMembershipForService ?? false,
      visitTotal: input.visitTotal,
    };
    const applies = policyApplies(policy, policy.conditions, ctx);
    const adyenOn = isAdyenConnectedSync(businessId);
    if (!applies || policy.mode === 'none') {
      return { applies: false, mode: 'none', freeCancellationWindowHours: 0, deadlineMin: 0 };
    }
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
  });
}

export function getBookingPolicySnapshot(businessId: Id, bookingId: Id): Promise<BookingPolicySnapshot | null> {
  if (isApiMode()) return Server.getBookingPolicySnapshot(businessId, bookingId);
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[bookingId];
    return snap && snap.businessId === businessId ? snap : null;
  });
}

/**
 * Клиент принял условия в виджете (F-07-124/125) — демо-кнопка на снимке записи создаёт снимок и, для депозита,
 * сразу резервирует деньги на счёте «Payment Policy» (Reserved → Held until decision, F-07-113).
 */
export function createBookingPolicySnapshot(businessId: Id, bookingId: Id, clientId: Id, bookingStart: string, input: PolicyEvaluationInput): Promise<BookingPolicySnapshot | null> {
  if (isApiMode()) return Server.createBookingPolicySnapshot(businessId, bookingId, clientId, bookingStart, input);
  return request(() => {
    const policy = readArea('finance').paymentPolicy[businessId] ?? defaultPaymentPolicy(businessId, nowDateTime());
    if (policy.mode === 'none') return null;
    const evalResult = policyApplies(policy, policy.conditions, {
      serviceIds: input.serviceIds,
      freeServiceIds: input.freeServiceIds ?? [],
      staffId: input.staffId,
      isNewClient: input.isNewClient,
      isDebtor: input.isDebtor,
      hasActiveMembershipForService: input.hasActiveMembershipForService ?? false,
      visitTotal: input.visitTotal,
    });
    if (!evalResult) return null;
    const adyenOn = isAdyenConnectedSync(businessId);
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
      createdAt: nowDateTime(),
    };
    mutateArea('finance', (s) => {
      s.bookingPolicySnapshots[bookingId] = snapshot;
    });
    if (policy.mode === 'deposit' && snapshot.depositAmount) {
      pushPolicyEntry(businessId, clientId, 'topUp', snapshot.depositAmount, 'widget', bookingId, 'client');
    }
    return snapshot;
  });
}

/** Закрытие визита с депозитом (F-07-115) — целиком, не делится; излишек уходит на доступный баланс клиента */
export function applyPolicyDepositAtCheckout(businessId: Id, bookingId: Id): Promise<{ applied: Money; refundedToBalance: Money } | null> {
  if (isApiMode()) return Server.applyPolicyDepositAtCheckout(businessId, bookingId);
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[bookingId];
    if (!snap || snap.businessId !== businessId || snap.mode !== 'deposit' || snap.status !== 'clientAccepted' || !snap.depositAmount) return null;
    const booking = readCore().bookings.find((b) => b.id === bookingId);
    const total = booking?.total ?? snap.depositAmount;
    const applied = Math.min(snap.depositAmount, total);
    const refundedToBalance = roundToDram(snap.depositAmount - applied);
    pushPolicyEntry(businessId, snap.clientId, 'holdConfirm', -snap.depositAmount, 'checkout', bookingId, currentActorId());
    if (refundedToBalance > 0) {
      // излишек возвращается на доступный баланс — новое пополнение того же счёта (не удержание)
      pushPolicyEntry(businessId, snap.clientId, 'topUp', refundedToBalance, 'checkout', bookingId, 'system');
    }
    // F-07-129: зачёт депозита в оплату визита — тоже финансовая операция, не только запись на счёте политики
    if (booking) {
      const area = readArea('finance');
      const itemId = area.itemBySystemKey[businessId]?.servicePayment;
      const accountId = area.accounts.find((a) => a.businessId === businessId && a.locationId === booking.locationId && a.kind === 'card')?.id ?? area.accounts.find((a) => a.businessId === businessId)?.id;
      const client = readCore().clients.find((c) => c.id === snap.clientId);
      if (itemId && accountId) {
        const at = nowDateTime();
        const by = currentActorId();
        mutateArea('finance', (s) => {
          s.operations.push({
            id: newId('op'),
            businessId,
            locationId: booking.locationId,
            accountId,
            itemId,
            kind: 'income',
            amount: applied,
            date: at,
            method: 'other',
            partyType: client ? 'client' : 'none',
            partyId: client?.id,
            partyName: client?.name,
            comment: 'Депозит по политике оплаты — зачёт в оплату визита',
            source: 'account',
            refId: bookingId,
            createdBy: by,
            createdAt: at,
            history: [{ at, by, action: 'created' }],
          });
        });
      }
    }
    mutateArea('finance', (s) => {
      const row = s.bookingPolicySnapshots[bookingId];
      if (row) {
        row.status = 'confirmedAtCheckout';
        row.chargedAmount = applied;
        row.decidedAt = nowDateTime();
        row.decidedBy = currentActorId();
      }
    });
    return { applied, refundedToBalance };
  });
}

/**
 * Поздняя отмена/перенос администратором (F-07-117/119/121) и решение по неявке (F-07-118/121) — один вход:
 * decision 'charge' — депозит/штраф бизнесу (Applied/Charged); 'credit' — только депозит, остаётся на балансе
 * клиента (нужны allowReceptionistNotCharge и право canWaivePolicyPenalty); 'waive' — гарантия картой прощена.
 * Решение окончательное — повторный вызов на уже решённом снимке бросает ошибку (F-07-121).
 */
export type PolicyDecision = 'charge' | 'credit' | 'waive';

export function resolvePolicyDecision(businessId: Id, bookingId: Id, decision: PolicyDecision, reason: 'lateCancel' | 'noShow'): Promise<BookingPolicySnapshot> {
  if (isApiMode()) return Server.resolvePolicyDecision(businessId, bookingId, decision, reason);
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[bookingId];
    if (!snap || snap.businessId !== businessId) throw new ApiError('not_found', 'Снимок политики не найден');
    if (snap.status !== 'clientAccepted') throw new ApiError('validation', 'Решение уже принято — его нельзя изменить');
    if ((decision === 'credit' || decision === 'waive') && !snap.allowReceptionistNotCharge) {
      throw new ApiError('forbidden', 'Прощение выключено в настройках политики');
    }
    assertCan('finance.edit');
    const updated = applyPolicyPenaltyDecisionSync(businessId, snap, decision, reason, currentActorId());
    mutateArea('finance', (s) => {
      s.bookingPolicySnapshots[bookingId] = updated;
    });
    return updated;
  });
}

/** Общее ядро решения по штрафу/депозиту — переиспользуется ресепшеном (resolvePolicyDecision), поздним переносом
 *  администратора (F-07-119) и автоматической отменой/переносом клиента онлайн (F-07-120). Не пишет в стор сама —
 *  вызывающая сторона решает, что делать со снимком дальше (обычный терминальный статус или снятие политики). */
function applyPolicyPenaltyDecisionSync(businessId: Id, snap: BookingPolicySnapshot, decision: PolicyDecision, reason: 'lateCancel' | 'noShow', by: string): BookingPolicySnapshot {
  let chargedAmount = 0;
  let nextStatus: BookingPolicyStatus = 'appliedCharged';
  if (snap.mode === 'deposit') {
    const amount = reason === 'noShow' ? (snap.noShowFee ?? snap.depositAmount ?? 0) : (snap.depositAmount ?? 0);
    if (decision === 'credit') {
      // депозит остаётся на балансе клиента — удержание снимается, деньги доступны
      pushPolicyEntry(businessId, snap.clientId, 'holdRelease', 0, reason, snap.bookingId, by);
      nextStatus = 'creditedToBalance';
    } else {
      pushPolicyEntry(businessId, snap.clientId, 'holdConfirm', -(snap.depositAmount ?? 0), reason, snap.bookingId, by);
      chargeClientDepositRetainedOperation(businessId, snap.clientId, snap.depositAmount ?? 0, reason);
      chargedAmount = amount;
      nextStatus = 'appliedCharged';
    }
  } else {
    const amount = reason === 'noShow' ? (snap.noShowFee ?? 0) : (snap.lateCancellationFee ?? 0);
    if (decision === 'waive') {
      nextStatus = 'appliedWaived';
    } else {
      // Штраф гарантии картой списывается со счёта «Payment Policy» — до 3 попыток с Adyen, все неудачны → в минус (F-07-122)
      pushPolicyEntry(businessId, snap.clientId, 'feeCharge', -amount, reason, snap.bookingId, by);
      chargeClientPenaltyOperation(businessId, snap.clientId, amount, reason);
      chargedAmount = amount;
      nextStatus = 'appliedCharged';
    }
  }
  return { ...snap, status: nextStatus, decidedAt: nowDateTime(), decidedBy: by, chargedAmount: chargedAmount || undefined };
}

/**
 * F-07-119 · Перенос администратором записи с политикой (роль: администратор, окно визита → «Reschedule»).
 * В окне бесплатной отмены — без штрафа, крайний срок сдвигается под новое время записи. После окна — нужно
 * явное решение: 'charge' (депозит бизнесу / штраф с карты) или 'forgive' (ничего, нужны allowReceptionistNotCharge
 * и право finance.edit — проверяется как и в resolvePolicyDecision). В любом случае после позднего переноса
 * запись едет БЕЗ политики: снимок переходит в терминальный статус, isPolicyActive/евалюация для неё больше не считают её под политикой.
 */
export function resolvePolicyReschedule(businessId: Id, bookingId: Id, newBookingStart: ISODateTime, decision?: 'charge' | 'forgive'): Promise<BookingPolicySnapshot | null> {
  if (isApiMode()) return Server.resolvePolicyReschedule(businessId, bookingId, newBookingStart, decision);
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[bookingId];
    if (!snap || snap.businessId !== businessId || snap.status !== 'clientAccepted') return null;
    const withinWindow = nowDateTime() < snap.freeCancellationDeadline;
    if (withinWindow) {
      // окно бесплатной отмены — без денег, крайний срок сдвигается под новое время (F-07-119)
      const updated: BookingPolicySnapshot = { ...snap, freeCancellationDeadline: policyFreeCancellationDeadline(newBookingStart, snap.freeCancellationWindowHours) };
      mutateArea('finance', (s) => {
        s.bookingPolicySnapshots[bookingId] = updated;
      });
      return updated;
    }
    if (!decision) throw new ApiError('validation', 'После окна бесплатной отмены нужно решение: взять или простить');
    if (decision === 'forgive' && !snap.allowReceptionistNotCharge) {
      throw new ApiError('forbidden', 'Прощение выключено в настройках политики');
    }
    assertCan('finance.edit');
    const mapped: PolicyDecision = decision === 'charge' ? 'charge' : snap.mode === 'deposit' ? 'credit' : 'waive';
    const updated = applyPolicyPenaltyDecisionSync(businessId, snap, mapped, 'lateCancel', currentActorId());
    mutateArea('finance', (s) => {
      s.bookingPolicySnapshots[bookingId] = updated;
    });
    return updated;
  });
}

/**
 * F-07-120 · Отмена и перенос клиентом онлайн (роль: клиент, наш виджет/приложение клиента). В окне — без денег:
 * депозит освобождается на баланс клиента в этом бизнесе, карту не трогают. После окна — списывается автоматически,
 * выбора у клиента нет (депозит бизнесу / штраф с карты); повторные попытки списания — F-07-122, здесь пишем как
 * успешное списание (демо — Adyen всегда отвечает успехом). Перенос в окне — без денег, крайний срок сдвигается;
 * перенос после окна — как отмена, и запись едет без политики.
 */
export function clientCancelBookingWithPolicy(businessId: Id, bookingId: Id): Promise<BookingPolicySnapshot | null> {
  if (isApiMode()) return Server.clientCancelBookingWithPolicy(businessId, bookingId);
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[bookingId];
    if (!snap || snap.businessId !== businessId || snap.status !== 'clientAccepted') return null;
    // F-07-099: выключенная галочка — клиент не может сам отменить предоплаченную запись, только администратор
    const policy = readArea('finance').paymentPolicy[businessId];
    if (policy && !policy.conditions.allowClientSelfCancelPrepaid) {
      throw new ApiError('forbidden', 'Самостоятельная отмена оплаченной записи выключена — обратитесь в салон');
    }
    const withinWindow = nowDateTime() < snap.freeCancellationDeadline;
    const by = 'client';
    let updated: BookingPolicySnapshot;
    if (withinWindow) {
      if (snap.mode === 'deposit' && snap.depositAmount) {
        pushPolicyEntry(businessId, snap.clientId, 'holdRelease', 0, 'clientCancel', bookingId, by);
      }
      updated = { ...snap, status: 'creditedToBalance', decidedAt: nowDateTime(), decidedBy: by };
    } else {
      const mapped: PolicyDecision = 'charge';
      updated = applyPolicyPenaltyDecisionSync(businessId, snap, mapped, 'lateCancel', by);
    }
    mutateArea('finance', (s) => {
      s.bookingPolicySnapshots[bookingId] = updated;
    });
    return updated;
  });
}

export function clientRescheduleBookingWithPolicy(businessId: Id, bookingId: Id, newBookingStart: ISODateTime): Promise<BookingPolicySnapshot | null> {
  if (isApiMode()) return Server.clientRescheduleBookingWithPolicy(businessId, bookingId, newBookingStart);
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[bookingId];
    if (!snap || snap.businessId !== businessId || snap.status !== 'clientAccepted') return null;
    // F-07-099: выключенная галочка — клиент не может сам перенести предоплаченную запись
    const policy = readArea('finance').paymentPolicy[businessId];
    if (policy && !policy.conditions.allowClientSelfReschedulePrepaid) {
      throw new ApiError('forbidden', 'Самостоятельный перенос оплаченной записи выключен — обратитесь в салон');
    }
    const withinWindow = nowDateTime() < snap.freeCancellationDeadline;
    if (withinWindow) {
      const updated: BookingPolicySnapshot = { ...snap, freeCancellationDeadline: policyFreeCancellationDeadline(newBookingStart, snap.freeCancellationWindowHours) };
      mutateArea('finance', (s) => {
        s.bookingPolicySnapshots[bookingId] = updated;
      });
      return updated;
    }
    const updated = applyPolicyPenaltyDecisionSync(businessId, snap, 'charge', 'lateCancel', 'client');
    mutateArea('finance', (s) => {
      s.bookingPolicySnapshots[bookingId] = updated;
    });
    return updated;
  });
}

/**
 * F-07-116 · Особые случаи депозита: разделение/объединение/копирование визита (роль: система, вызывается журналом).
 * Разделение: политика остаётся на исходной записи; если её доля меньше депозита — разница уходит на доступный
 * баланс клиента, остальные новые записи — без политики (у них просто никогда не будет снимка на их id).
 * Объединение: два и более активных снимка — ошибка; ровно один — снимок переезжает на итоговую запись,
 * применяется как обычно при закрытии визита (applyPolicyDepositAtCheckout). Копирование/повтор серии — новая
 * запись получает новый id, на который снимка не существует, то есть копия по конструкции без депозита; здесь —
 * явная защита на случай, если вызывающий код по ошибке передаст тот же id.
 */
export function onBookingSplit(businessId: Id, sourceBookingId: Id, retainedShare: Money): Promise<void> {
  if (isApiMode()) return Server.onBookingSplit(businessId, sourceBookingId, retainedShare);
  // data-f="F-07-116"
  return request(() => {
    const snap = readArea('finance').bookingPolicySnapshots[sourceBookingId];
    if (!snap || snap.businessId !== businessId || snap.mode !== 'deposit' || !snap.depositAmount || snap.status !== 'clientAccepted') return;
    if (retainedShare >= snap.depositAmount) return;
    const refundToBalance = roundToDram(snap.depositAmount - Math.max(0, retainedShare));
    if (refundToBalance > 0) {
      pushPolicyEntry(businessId, snap.clientId, 'topUp', refundToBalance, 'split', sourceBookingId, 'system');
    }
  });
}

export function assertBookingMergeAllowed(businessId: Id, bookingIds: Id[]): Promise<void> {
  if (isApiMode()) return Server.assertBookingMergeAllowed(businessId, bookingIds);
  // data-f="F-07-116"
  return request(() => {
    const snapshots = readArea('finance').bookingPolicySnapshots;
    const active = bookingIds.filter((id) => snapshots[id] && snapshots[id]!.businessId === businessId && snapshots[id]!.status === 'clientAccepted');
    if (active.length > 1) {
      throw new ApiError('validation', 'Нельзя объединить записи — у нескольких из них своя политика оплаты (депозит/гарантия картой)');
    }
  });
}

export function onBookingMerge(businessId: Id, bookingIds: Id[], targetBookingId: Id): Promise<void> {
  if (isApiMode()) return Server.onBookingMerge(businessId, bookingIds, targetBookingId);
  // data-f="F-07-116"
  return request(() => {
    const area = readArea('finance');
    const active = bookingIds.filter((id) => area.bookingPolicySnapshots[id] && area.bookingPolicySnapshots[id]!.businessId === businessId && area.bookingPolicySnapshots[id]!.status === 'clientAccepted');
    if (active.length > 1) {
      throw new ApiError('validation', 'Нельзя объединить записи — у нескольких из них своя политика оплаты (депозит/гарантия картой)');
    }
    if (active.length === 1 && active[0] !== targetBookingId) {
      const sourceId = active[0];
      mutateArea('finance', (s) => {
        const snap = s.bookingPolicySnapshots[sourceId];
        if (snap) {
          s.bookingPolicySnapshots[targetBookingId] = { ...snap, bookingId: targetBookingId };
          delete s.bookingPolicySnapshots[sourceId];
        }
      });
    }
  });
}

/** Явная защита копии/повтора (F-07-116): если по ошибке передан тот же id, что у источника — не копируем снимок. */
export function onBookingCopy(_businessId: Id, sourceBookingId: Id, newBookingId: Id): Promise<void> {
  // data-f="F-07-116"
  return request(() => {
    if (newBookingId === sourceBookingId) return;
    // конструктивно у newBookingId не может быть снимка — ключ снимков это bookingId, а он новый; ничего не делаем
  });
}

/**
 * Касса для денег, списанных со счёта политики оплаты (штраф, удержанный депозит): депозит клиент вносил онлайн,
 * поэтому это системная касса онлайн-денег (F-07-183), затем безналичная — но никогда не наличный ящик,
 * иначе остаток «Основной кассы» расходится с пересчётом (fin-review Ф15).
 */
function policyChargeAccountId(businessId: Id): Id | undefined {
  const accounts = readArea('finance').accounts.filter((a) => a.businessId === businessId);
  return (accounts.find((a) => a.systemGenerated && !a.systemKey) ?? accounts.find((a) => a.kind === 'card') ?? accounts.find((a) => a.kind !== 'cash'))?.id;
}

/** Пишет финансовую операцию по статье «Списание штрафа» — каждое движение штрафа видно в Финансовых операциях (F-07-129) */
function chargeClientPenaltyOperation(businessId: Id, clientId: Id, amount: Money, reason: string): void {
  const core = readCore();
  const client = core.clients.find((c) => c.id === clientId);
  const location = core.locations.find((l) => l.businessId === businessId);
  const area = readArea('finance');
  const itemId = area.itemBySystemKey[businessId]?.penaltyCharge;
  // fin-review Ф15: штраф списан со счёта политики (деньги пришли онлайн) — в наличный ящик они не попадали
  const accountId = policyChargeAccountId(businessId);
  if (!itemId || !accountId || !location) return;
  const at = nowDateTime();
  const by = currentActorId();
  mutateArea('finance', (s) => {
    s.operations.push({
      id: newId('op'),
      businessId,
      locationId: location.id,
      accountId,
      itemId,
      kind: 'income',
      amount: roundToDram(amount),
      date: at,
      method: 'other',
      partyType: client ? 'client' : 'none',
      partyId: client?.id,
      partyName: client?.name,
      comment: reason === 'noShow' ? 'Штраф — клиент не пришёл (политика оплаты)' : 'Штраф за позднюю отмену (политика оплаты)',
      source: 'account',
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    });
  });
}

/**
 * Пишет финансовую операцию по статье «Удержанный депозит» (F-07-129) — депозит, оставшийся бизнесу при неявке
 * или поздней отмене (не зачёт в оплату визита — тот идёт по статье «Оказание услуг», см. applyPolicyDepositAtCheckout).
 * Своя статья, отдельная от «Списание штрафа», чтобы депозиты были видны отдельной строкой в отчёте и P&L.
 */
function chargeClientDepositRetainedOperation(businessId: Id, clientId: Id, amount: Money, reason: string): void {
  if (amount <= 0) return;
  const core = readCore();
  const client = core.clients.find((c) => c.id === clientId);
  const location = core.locations.find((l) => l.businessId === businessId);
  const area = readArea('finance');
  const itemId = area.itemBySystemKey[businessId]?.depositRetained;
  const accountId = policyChargeAccountId(businessId);
  if (!itemId || !accountId || !location) return;
  const at = nowDateTime();
  const by = currentActorId();
  mutateArea('finance', (s) => {
    s.operations.push({
      id: newId('op'),
      businessId,
      locationId: location.id,
      accountId,
      itemId,
      kind: 'income',
      amount: roundToDram(amount),
      date: at,
      method: 'other',
      partyType: client ? 'client' : 'none',
      partyId: client?.id,
      partyName: client?.name,
      comment: reason === 'noShow' ? 'Удержан депозит — клиент не пришёл (политика оплаты)' : 'Удержан депозит — поздняя отмена (политика оплаты)',
      source: 'account',
      createdBy: by,
      createdAt: at,
      history: [{ at, by, action: 'created' }],
    });
  });
}

// ─────────────────────────── Типы счетов клиентов (F-07-058, кабинет сети) ───────────────────────────

export function listAccountTypes(businessId: Id): Promise<AccountType[]> {
  if (isApiMode()) return Server.listAccountTypes(businessId);
  return request(() => readArea('finance').accountTypes[businessId] ?? []);
}

export function createAccountType(businessId: Id, input: AccountTypeInput): Promise<AccountType> {
  if (isApiMode()) return Server.createAccountType(businessId, input);
  return request(() => {
    const error = validateAccountTypeInput(input);
    if (error) throw new ApiError('validation', error);
    assertCan('finance.edit');
    const at = nowDateTime();
    const created: AccountType = { ...input, id: newId('atp'), businessId, createdAt: at, updatedAt: at };
    mutateArea('finance', (s) => {
      (s.accountTypes[businessId] ??= []).push(created);
    });
    return created;
  });
}

export function updateAccountType(businessId: Id, id: Id, input: AccountTypeInput): Promise<AccountType> {
  if (isApiMode()) return Server.updateAccountType(businessId, id, input);
  return request(() => {
    const error = validateAccountTypeInput(input);
    if (error) throw new ApiError('validation', error);
    assertCan('finance.edit');
    let saved: AccountType | undefined;
    mutateArea('finance', (s) => {
      const list = s.accountTypes[businessId] ?? [];
      const row = list.find((a) => a.id === id);
      if (!row) throw new ApiError('not_found', 'Тип счёта не найден');
      Object.assign(row, input, { updatedAt: nowDateTime() });
      saved = row;
    });
    if (!saved) throw new ApiError('not_found', 'Тип счёта не найден');
    return saved;
  });
}

/** Удаляет тип счёта (F-07-058, добавлено проверкой 2) — отказывает, если по нему уже открыты счета с деньгами
 *  или долгом у клиентов этого бизнеса, чтобы не потерять их баланс молча. */
export function removeAccountType(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.removeAccountType(businessId, id);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const inUse = Object.values(area.clientAccountBalances[businessId] ?? {}).some((v) => v !== 0);
    if (inUse) throw new ApiError('validation', 'По этому типу у клиентов есть деньги или долг — сначала закройте их счета');
    mutateArea('finance', (s) => {
      s.accountTypes[businessId] = (s.accountTypes[businessId] ?? []).filter((a) => a.id !== id);
    });
  });
}

// ─────────────────────────── Онлайн-продажи «Другим способом»: заказы вручную (F-07-132, возврат F-07-073) ───────────────────────────

export function listManualOnlineOrders(businessId: Id): Promise<ManualOnlineOrder[]> {
  if (isApiMode()) return Server.listManualOnlineOrders(businessId);
  return request(() => (readArea('finance').manualOnlineOrders[businessId] ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
}

/** Подтверждает заказ, ожидающий оплаты по реквизитам, — создаёт продажу в кассе выбранной локации (F-07-132) */
export function confirmManualOnlineOrder(businessId: Id, orderId: Id, accountId: Id): Promise<ManualOnlineOrder> {
  if (isApiMode()) return Server.confirmManualOnlineOrder(businessId, orderId, accountId);
  return request(() => {
    assertCan('finance.edit');
    const area = readArea('finance');
    const order = (area.manualOnlineOrders[businessId] ?? []).find((o) => o.id === orderId);
    if (!order) throw new ApiError('not_found', 'Заказ не найден');
    if (order.status !== 'pendingPayment') throw new ApiError('validation', 'Заказ уже обработан');
    const account = area.accounts.find((a) => a.id === accountId && a.businessId === businessId);
    if (!account) throw new ApiError('validation', 'Выберите кассу');
    const systemKey: 'membershipSale' | 'certificateSale' = order.kind === 'membership' ? 'membershipSale' : 'certificateSale';
    const itemId = area.itemBySystemKey[businessId]?.[systemKey];
    if (!itemId) throw new ApiError('validation', 'Нет статьи для продажи — обратитесь в поддержку');
    const at = nowDateTime();
    const by = currentActorId();
    const operationId = newId('op');
    let saved: ManualOnlineOrder | undefined;
    mutateArea('finance', (s) => {
      s.operations.push({
        id: operationId,
        businessId,
        locationId: order.locationId,
        accountId,
        itemId,
        kind: 'income',
        amount: order.amount,
        date: at,
        method: 'other',
        partyType: 'none',
        partyName: order.clientName,
        comment: `Онлайн-заказ «${order.typeName}» — оплачен другим способом`,
        source: 'sale',
        createdBy: by,
        createdAt: at,
        history: [{ at, by, action: 'created' }],
      });
      const row = (s.manualOnlineOrders[businessId] ?? []).find((o) => o.id === orderId)!;
      row.status = 'paid';
      row.decidedAt = at;
      row.decidedBy = by;
      row.operationId = operationId;
      if (!row.code) row.code = String(1000 + Math.floor(Math.random() * 9000));
      saved = row;
    });
    if (!saved) throw new ApiError('not_found', 'Заказ не найден');
    return saved;
  });
}

/** Отклоняет заказ, ожидающий оплаты, — деньги не приходили, операций не создаётся (F-07-132) */
export function rejectManualOnlineOrder(businessId: Id, orderId: Id): Promise<ManualOnlineOrder> {
  if (isApiMode()) return Server.rejectManualOnlineOrder(businessId, orderId);
  return request(() => {
    assertCan('finance.edit');
    let saved: ManualOnlineOrder | undefined;
    mutateArea('finance', (s) => {
      const row = (s.manualOnlineOrders[businessId] ?? []).find((o) => o.id === orderId);
      if (!row) throw new ApiError('not_found', 'Заказ не найден');
      if (row.status !== 'pendingPayment') throw new ApiError('validation', 'Заказ уже обработан');
      row.status = 'rejected';
      row.decidedAt = nowDateTime();
      row.decidedBy = currentActorId();
      saved = row;
    });
    if (!saved) throw new ApiError('not_found', 'Заказ не найден');
    return saved;
  });
}

/**
 * Возврат оплаченного онлайн-заказа (F-07-073, F-07-132) — удаляет операцию продажи; деньги клиенту
 * бизнес возвращает вручную вне системы (по справке — так же, как у платёжных систем без интеграции).
 */
export function refundManualOnlineOrder(businessId: Id, orderId: Id): Promise<ManualOnlineOrder> {
  if (isApiMode()) return Server.refundManualOnlineOrder(businessId, orderId);
  return request(() => {
    assertCan('finance.edit');
    let saved: ManualOnlineOrder | undefined;
    mutateArea('finance', (s) => {
      const row = (s.manualOnlineOrders[businessId] ?? []).find((o) => o.id === orderId);
      if (!row) throw new ApiError('not_found', 'Заказ не найден');
      if (row.status !== 'paid') throw new ApiError('validation', 'Возврат доступен только у оплаченного заказа');
      if (row.operationId) {
        const op = s.operations.find((o) => o.id === row.operationId);
        if (op && !op.cancelled) {
          op.cancelled = true;
          op.history.push({ at: nowDateTime(), by: currentActorId(), action: 'cancelled' });
        }
      }
      row.status = 'refunded';
      row.decidedAt = nowDateTime();
      row.decidedBy = currentActorId();
      saved = row;
    });
    if (!saved) throw new ApiError('not_found', 'Заказ не найден');
    return saved;
  });
}

// ─────────────────────────── Уведомления об оплате (F-07-084 · тип 85, F-07-085 · тип 65, F-07-086) ───────────────────────────

export function getPaymentNotificationsSettings(businessId: Id): Promise<PaymentNotificationsSettings> {
  if (isApiMode()) return Server.getPaymentNotificationsSettings(businessId);
  return request(() => readArea('finance').paymentNotifications[businessId] ?? { businessId, ...DEFAULT_PAYMENT_NOTIFICATIONS, updatedAt: nowDateTime() });
}

export function savePaymentNotificationsSettings(businessId: Id, patch: Partial<Pick<PaymentNotificationsSettings, 'linkToPayEnabled' | 'successPaidEnabled' | 'staffQrPaidEnabled'>>): Promise<PaymentNotificationsSettings> {
  if (isApiMode()) return Server.savePaymentNotificationsSettings(businessId, patch);
  return request(() => {
    assertCan('finance.edit');
    let saved: PaymentNotificationsSettings | undefined;
    mutateArea('finance', (s) => {
      const current = s.paymentNotifications[businessId] ?? { businessId, ...DEFAULT_PAYMENT_NOTIFICATIONS, updatedAt: nowDateTime() };
      const next: PaymentNotificationsSettings = { ...current, ...patch, updatedAt: nowDateTime() };
      s.paymentNotifications[businessId] = next;
      saved = next;
    });
    if (!saved) throw new ApiError('not_found', 'Настройки не найдены');
    return saved;
  });
}

'use client';

/**
 * API раздела «reports». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area';
 * сущности ядра — функции '@/api/core'. Экраны зовут эти функции через useApiQuery/useApiMutation.
 *
 * Расчёты следуют F-12-006 (общие правила) и F-12-121 (статус записи → куда он попадает):
 *   считаются только записи «Клиент пришел» (status === 'arrived'); запись без телефона клиента
 *   не увеличивает число клиентов (F-12-006); проценты динамики — к предыдущему периоду той же длины (F-12-017).
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, canNow, changeBookingStatus, coreTx, createBooking, currentActor, deleteBooking, findClientByPhone, listBookings, listBookingEvents } from '@/api/core';
import { rowsFor as clientRowsFor } from '@/api/clients/shared';
import { listAccounts as listFinanceAccounts, listAccountsWithBalance as listFinanceAccountsWithBalance, listItems as listFinanceItems, listOperations as listFinanceOperations } from '@/api/finance';
import { isApiMode } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import { listPromotions } from '@/api/loyalty';
import { getNetworkTelephony, listNetworkCalls } from '@/api/network';
import { computeDay, getStaffBalance } from '@/api/payroll';
import { ApiError, request } from '@/api/request';
import * as Server from '@/api/reports.server';
import * as NetServer from '@/api/network.server';
import { costPriceAt } from '@/api/stock';
import type { Booking, BookingStatus, Client, Id, ISODate, Staff, WorkSchedule } from '@/domain/core';
import { operationSign } from '@/domain/finance';
import type { Account, FinanceItem, Operation, OperationFilter, SystemItemKey } from '@/domain/finance';
import { ACCUMULATING_KINDS } from '@/domain/loyalty';
import type {
  ActivityEntry,
  ActivityFilter,
  AppointmentRow,
  AppointmentsFilters,
  AppointmentsResult,
  AttendanceBlockData,
  CallsReportRow,
  CashDayReportData,
  CashDaySummary,
  CashDayTile,
  CashOperationRow,
  CashRegisterKind,
  CashRegisterRow,
  DashboardFilters,
  DataChangeEntry,
  DashboardExtras,
  DataChangesFilters,
  DataExportFilters,
  DataExportLogEntry,
  DataExportOperationType,
  DataExportType,
  EventRow,
  EventsReportData,
  EventsReportTotals,
  FinanceReportColumn,
  FinanceReportData,
  FinanceReportFilters,
  FinanceReportRow,
  MainDashboardData,
  MessagesReportFilters,
  MessagesReportResult,
  MessagesReportRow,
  MetricValue,
  MyAnalyticsData,
  OccupancyBlockData,
  PayrollDetailMode,
  PnlData,
  PnlRow,
  PromotionNotReturnedRow,
  PromotionsFilters,
  PromotionsReportData,
  ReportDateRange,
  ReportFavorite,
  ReportsStaffPermissions,
  RetentionReportData,
  RetentionRow,
  ReviewRow,
  ReviewsFilters,
  StaffRatingSummaryRow,
  StaffStarSummaryRow,
  SalesBlockData,
  SalesByClientRow,
  SalesByClientsData,
  SalesByServiceRow,
  SalesByServicesData,
  SalesByStaffData,
  SalesByStaffRow,
  StaffDynamicsData,
  StaffDynamicsMonth,
  StockBalanceFilters,
  StockBalanceRow,
  StockOrderRow,
  StockSalesAnalysisRow,
  StockTurnoverRow,
  StockUsageAnalysisRow,
  StockWriteOffFilters,
  StockWriteOffRow,
  VisitRow,
  VisitsDay,
  WorkloadReportData,
  WorkloadRow,
  HomeClientRow,
  MailingReturn,
  OwnerHomeData,
} from '@/domain/reports';
import {
  CHURN_DAYS_DEFAULT,
  HOME_LIST_LIMIT,
  MAILING_RETURN_WINDOW_DAYS,
  PLAN_EMAIL_SCHEDULE_DEFAULT,
  WEEKLY_REPORT_DEFAULT,
  defaultReportsPermissions,
  withinRecordsDepth,
  type PlanEmailSchedule,
  type RecordsHistoryDepth,
  type WeeklyReportSettings,
} from '@/domain/reports';
import { addDays, dayjs, eachDay, today, toISODate } from '@/lib/date';
import type { AreaStates } from '@/mock/slices';

const INCOMPLETE: BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'];
const CANCELLED: BookingStatus[] = ['no_show', 'cancelled_by_client', 'cancelled_by_master'];

/** Бизнес текущей сессии — для функций раздела, у которых нет businessId в подписи (стадия 21, лейн services+rest) */
function currentBusinessId(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

function churnDaysOf(state: AreaStates['reports'], businessId: Id): number {
  return state.churnDaysByBusiness[businessId] ?? CHURN_DAYS_DEFAULT;
}

// ─────────────────────────── F-12-024: период потери клиента ───────────────────────────

export function getChurnDays(businessId: Id): Promise<number> {
  if (isApiMode()) return Server.getChurnDays(businessId);
  return request(() => churnDaysOf(readArea('reports'), businessId));
}

// ────────────────── F-12-081: расписание отчёта «Выполнение плана» на почту (сеть) ──────────────────

export function getPlanEmailSchedule(networkId: Id): Promise<PlanEmailSchedule> {
  if (isApiMode()) return NetServer.getPlanEmailSchedule(networkId);
  return request(() => readArea('reports').planEmailScheduleByNetwork[networkId] ?? PLAN_EMAIL_SCHEDULE_DEFAULT);
}

export function setPlanEmailSchedule(networkId: Id, schedule: PlanEmailSchedule): Promise<PlanEmailSchedule> {
  if (isApiMode()) return NetServer.setPlanEmailSchedule(networkId, schedule);
  return request(() => {
    mutateArea('reports', (s) => {
      s.planEmailScheduleByNetwork[networkId] = schedule;
    });
    return schedule;
  });
}

export function setChurnDays(businessId: Id, days: number): Promise<number> {
  if (isApiMode()) return Server.setChurnDays(businessId, days);
  return request(() => {
    mutateArea('reports', (s) => {
      s.churnDaysByBusiness[businessId] = days;
    });
    return days;
  });
}

// ────────────────── F-12-083: «еженедельный отчёт» — сводка владельцу раз в неделю ──────────────────

export function getWeeklyReportSettings(businessId: Id): Promise<WeeklyReportSettings> {
  if (isApiMode()) return Server.getWeeklyReportSettings(businessId);
  return request(() => readArea('reports').weeklyReportByBusiness[businessId] ?? WEEKLY_REPORT_DEFAULT);
}

export function setWeeklyReportEnabled(businessId: Id, enabled: boolean): Promise<WeeklyReportSettings> {
  if (isApiMode()) return Server.setWeeklyReportEnabled(businessId, enabled);
  return request(() => {
    assertCan('reports.view');
    let updated: WeeklyReportSettings | undefined;
    mutateArea('reports', (s) => {
      const current = s.weeklyReportByBusiness[businessId] ?? WEEKLY_REPORT_DEFAULT;
      updated = { ...current, enabled, lastSentAt: enabled ? new Date().toISOString() : current.lastSentAt };
      s.weeklyReportByBusiness[businessId] = updated;
    });
    return updated!;
  });
}

// ─────────────────────────── F-12-003: избранное отчётов (локально разделу, см. domain/reports.ts) ───────────────────────────
// Этап 21 (лейн services+rest): сервер завёл favorites per-сотрудник под /v1/biz/{b}/reports/favorites
// (нужен businessId в пути, BizGuard), а сигнатура здесь несёт только staffId. Прежний вывод («экран не
// знает businessId в этой точке») не годится как причина не строить сервер — businessId берём из сессии
// (apiIdentity(), тот же приём, что currentBusinessId() в services.ts), а не меняем сигнатуру вызовов.
// staffId продолжает приходить от вызывающего экрана как есть — сервер сам берёт его из ctx.member (свой,
// не чужой сотрудник), поэтому параметр в api-режиме не участвует в запросе, только используется в моке.

export function listFavoriteReports(staffId: Id): Promise<ReportFavorite[]> {
  if (isApiMode()) return Server.listFavoriteReports(currentBusinessId());
  return request(() => readArea('reports').favoritesByStaff[staffId] ?? []);
}

export function toggleFavoriteReport(staffId: Id, slug: string): Promise<ReportFavorite[]> {
  if (isApiMode()) return Server.toggleFavoriteReport(currentBusinessId(), slug);
  return request(() =>
    mutateArea('reports', (s) => {
      const list = s.favoritesByStaff[staffId] ?? (s.favoritesByStaff[staffId] = []);
      const idx = list.findIndex((f) => f.slug === slug);
      if (idx >= 0) list.splice(idx, 1);
      else list.push({ slug, addedAt: new Date().toISOString() });
    }).favoritesByStaff[staffId] ?? [],
  );
}

// ─────────────────────────── помощники расчёта ───────────────────────────

function previousRange(range: ReportDateRange): ReportDateRange {
  const days = dayjs(range.to).diff(dayjs(range.from), 'day') + 1;
  return { from: toISODate(dayjs(range.from).subtract(days, 'day')), to: toISODate(dayjs(range.from).subtract(1, 'day')) };
}

function metric(current: number, previous: number): MetricValue {
  // Отч6: прежнее значение едет вместе с процентом — «+788%» без «было 12 000 ֏» ничего не говорит
  if (previous === 0) return { value: current, previous, isNew: current > 0 };
  return { value: current, previous, deltaPct: Math.round(((current - previous) / previous) * 1000) / 10 };
}

/** Отч11: деньги в отчётах — целые драмы (раньше Math.round(x*100)/100 давал «4 333,33 ֏») */
function dram(x: number): number {
  return Math.round(x);
}

function inRange(booking: Booking, range: ReportDateRange): boolean {
  const d = booking.start.slice(0, 10);
  return d >= range.from && d <= range.to;
}

function positionOf(s: Staff | undefined): string | undefined {
  return s?.position?.ru ?? s?.position?.en;
}

function matchesFilters(b: Booking, staffId: Id[], filters: DashboardFilters, staffById: Map<Id, Staff>): boolean {
  if (!staffId.includes(b.staffId)) return false;
  if (filters.staffId && b.staffId !== filters.staffId) return false;
  if (filters.position && positionOf(staffById.get(b.staffId)) !== filters.position) return false;
  return true;
}

/** F-01-041: несколько записей одного клиента за день = один визит; нет visitId — booking сам себе визит */
function visitKeyOf(b: Booking): string {
  return b.visitId ?? b.id;
}

/** Группировка по дню одним проходом (Отч7: за год фильтр «на каждый день по всем записям» — 365 × N) */
function groupByDay<T>(items: readonly T[], dayOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const d = dayOf(item);
    const list = out.get(d);
    if (list) list.push(item);
    else out.set(d, [item]);
  }
  return out;
}

/**
 * Кто «принимает клиентов» для загрузки и заполненности: мастера салона, а у мастера-индивидуала — он сам (его роль —
 * owner; раньше индивидуал видел «Загруженность» пустой). Одно правило для дашборда, «Загруженности» и главной.
 */
function takesClients(s: Staff, businessKind: string | undefined): boolean {
  return s.role === 'master' || businessKind === 'individual';
}

/** Минуты смены по расписанию на день (переопределение дня важнее недели) */
function shiftMinutes(sched: WorkSchedule | undefined, date: string): number {
  if (!sched) return 0;
  const weekdayIdx = (dayjs(date).isoWeekday() - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const ranges = sched.overrides[date] ?? sched.week[weekdayIdx];
  let mins = 0;
  for (const r of ranges ?? []) {
    const [fh, fm] = r.from.split(':').map(Number);
    const [th, tm] = r.to.split(':').map(Number);
    mins += th * 60 + tm - (fh * 60 + fm);
  }
  return mins;
}

// ─────────────────────────── F-12-009…018: «Основные показатели» ───────────────────────────

export interface DashboardQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
  filters: DashboardFilters;
}

type ProductSaleOp = AreaStates['stock']['operations'][number];

function saleAmount(o: ProductSaleOp): number {
  return o.lines.reduce((s, l) => s + Math.abs(l.qtySale) * l.unitPrice, 0);
}

/**
 * ⭐ Решение владельца 01.10.2026 (F-12-006, F-12-125): выручка аналитики — деньги, которые правда получены, те же,
 * что в «Кассе за день» и «Финансовом отчёте». Услуги — приходы «Оказание услуг» (в том числе предоплата переводом:
 * своя операция, визит берёт только остаток — считается один раз) минус возвраты клиенту по визиту; скидка, оплата
 * абонементом и со счёта клиента операций не создают — в выручку не входят. Товары — оплаченные продажи склада
 * (без оплаты «со счёта/лояльностью») и приходы «Продажа товаров» без документа склада. Абонементы, сертификаты и
 * пополнения счетов — не продажи (F-12-012). Сумма «по цене записи» остаётся отдельной строкой «Записано на сумму».
 */
interface ReceivedMoney {
  kind: 'services' | 'products';
  date: ISODate;
  amount: number;
  /** Штук товара (у прихода «Продажа товаров» без документа склада — 1) */
  qty: number;
  staffId?: Id;
  clientId?: Id;
  bookingId?: Id;
  /** Чек товара: документ склада или операция кассы */
  saleId?: Id;
}

function receivedMoneyMock(businessId: Id, locationIds: Id[], from: ISODate, to: ISODate, bookingById: Map<Id, Booking>): ReceivedMoney[] {
  const fin = readArea('finance');
  const stock = readArea('stock');
  const keys = fin.itemBySystemKey[businessId] ?? {};
  const inWindow = (d: string) => d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const out: ReceivedMoney[] = [];
  const opsWithStockDoc = new Set(stock.operations.filter((o) => o.businessId === businessId && o.financeOperationId).map((o) => o.financeOperationId!));
  for (const o of fin.operations) {
    if (o.businessId !== businessId || o.cancelled || !locationIds.includes(o.locationId) || !inWindow(o.date)) continue;
    const booking = o.refId ? bookingById.get(o.refId) : undefined;
    const base = { date: o.date.slice(0, 10), bookingId: booking?.id, staffId: booking?.staffId, clientId: booking?.clientId ?? (o.partyType === 'client' ? o.partyId : undefined) };
    if (o.kind === 'income' && o.itemId === keys.servicePayment) out.push({ ...base, kind: 'services', amount: o.amount, qty: 0 });
    else if (o.kind === 'expense' && o.itemId === keys.refund && o.source === 'booking' && booking) out.push({ ...base, kind: 'services', amount: -o.amount, qty: 0 });
    else if (o.kind === 'income' && o.itemId === keys.goodsSale && !opsWithStockDoc.has(o.id)) out.push({ ...base, kind: 'products', amount: o.amount, qty: 1, saleId: o.id });
  }
  for (const s of stock.operations) {
    if (s.businessId !== businessId || s.type !== 'sale' || !s.paid || s.cancelledAt || s.paymentMethod === 'loyalty' || !locationIds.includes(s.locationId) || !inWindow(s.date)) continue;
    for (const l of s.lines) {
      out.push({ kind: 'products', date: s.date.slice(0, 10), amount: Math.abs(l.qtySale) * l.unitPrice, qty: Math.abs(l.qtySale), staffId: l.sellerId ?? s.staffId, clientId: s.clientId, bookingId: s.bookingId, saleId: s.id });
    }
  }
  return out;
}

function sumMoney(items: readonly ReceivedMoney[]): number {
  return items.reduce((s, m) => s + m.amount, 0);
}

/**
 * Отч13 «Доля перезаписи» — одно правило для «Основных показателей» и главной владельца: из клиентов, пришедших в
 * периоде, у кого уже есть следующая запись (не отменённая, день позже последнего визита периода).
 */
function rebookingOf(inScope: readonly Booking[], completed: readonly Booking[]): { lastVisitInPeriod: Map<Id, string>; rebookedIds: Set<Id> } {
  const nextBookingByClient = new Map<Id, Booking[]>();
  for (const b of inScope) {
    if (!b.clientId || b.deletedAt || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master') continue;
    const list = nextBookingByClient.get(b.clientId);
    if (list) list.push(b);
    else nextBookingByClient.set(b.clientId, [b]);
  }
  const lastVisitInPeriod = new Map<Id, string>();
  for (const b of completed) {
    if (!b.clientId) continue;
    const prevStart = lastVisitInPeriod.get(b.clientId);
    if (!prevStart || b.start > prevStart) lastVisitInPeriod.set(b.clientId, b.start);
  }
  const rebookedIds = new Set<Id>();
  for (const [cid, lastStart] of lastVisitInPeriod) {
    if ((nextBookingByClient.get(cid) ?? []).some((b) => b.start.slice(0, 10) > lastStart.slice(0, 10))) rebookedIds.add(cid);
  }
  return { lastVisitInPeriod, rebookedIds };
}

export function getMainDashboard(q: DashboardQuery): Promise<MainDashboardData> {
  if (isApiMode()) return Server.getMainDashboard(q);
  return request(async () => {
    const core = readCore();
    const staffIds = core.staff.filter((s) => q.locationIds.some((l) => s.locationIds.includes(l))).map((s) => s.id);
    const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
    const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
    const days = eachDay(q.range.from, q.range.to);

    const all = await listBookings({ businessId: q.businessId, includeDeleted: true });
    const inScope = all.filter((b) => q.locationIds.includes(b.locationId) && matchesFilters(b, staffIds, q.filters, staffById));

    const period = inScope.filter((b) => inRange(b, q.range));
    const prevRange = previousRange(q.range);
    const prevPeriod = inScope.filter((b) => inRange(b, prevRange));

    // Полученные деньги за оба периода — один проход по кассе и складу (решение владельца 01.10.2026, см. receivedMoneyMock).
    // Фильтры «Сотрудник»/«Должности» режут деньги по мастеру визита или продавцу товара; деньги без сотрудника
    // (приход без визита) остаются только в «все сотрудники».
    const bookingById = new Map(all.map((b) => [b.id, b] as const));
    const staffOk = (id: Id | undefined) =>
      (!q.filters.staffId && !q.filters.position) ||
      (!!id && (!q.filters.staffId || id === q.filters.staffId) && (!q.filters.position || positionOf(staffById.get(id)) === q.filters.position));
    const moneyAll = receivedMoneyMock(q.businessId, q.locationIds, prevRange.from, q.range.to, bookingById).filter((m) => staffOk(m.staffId));
    const moneyIn = (from: ISODate, to: ISODate) => moneyAll.filter((m) => m.date >= from && m.date <= to);

    // Отч5: одно определение визита на весь экран — записи «Клиент пришел», склеенные в визит (F-01-041),
    // без условия «есть телефон» (оно только для «Клиентов», F-12-006). Средний чек делится на те же визиты
    // плюс отдельные продажи товаров (каждая — свой чек), и подсказка это говорит.
    const computeSales = (bookings: Booking[], money: ReceivedMoney[]) => {
      const arrived = bookings.filter((b) => b.status === 'arrived' && !b.deletedAt);
      const services = money.filter((m) => m.kind === 'services');
      const products = money.filter((m) => m.kind === 'products');
      const servicesRevenue = sumMoney(services);
      // Счётчик услуг — оказанные услуги визитов «пришёл», в том числе со скидкой и по абонементу (F-12-010)
      const servicesCount = arrived.reduce((sum, b) => sum + b.services.length, 0);
      const productsRevenue = sumMoney(products);
      const productsCount = products.reduce((sum, m) => sum + m.qty, 0);
      const saleIds = new Set(products.map((m) => m.saleId));
      const standaloneSalesCount = new Set(products.filter((m) => !m.bookingId).map((m) => m.saleId)).size;
      const visits = new Set(arrived.map(visitKeyOf)).size;
      const bookedServices = arrived.reduce((sum, b) => sum + b.total, 0);
      return {
        servicesRevenue,
        servicesCount,
        productsRevenue,
        productsCount,
        visits,
        receipts: visits + standaloneSalesCount,
        totalRevenue: servicesRevenue + productsRevenue,
        // Решение владельца 01.10.2026 (F-12-010): «операции» = оказанные услуги + проданные штуки товара
        totalCount: servicesCount + productsCount,
        avgVisit: (servicesRevenue + productsRevenue) / Math.max(1, visits + standaloneSalesCount),
        avgService: servicesRevenue / Math.max(1, servicesCount),
        avgProduct: productsRevenue / Math.max(1, saleIds.size),
        bookedServices,
        bookedTotal: bookedServices + productsRevenue,
      };
    };

    const curMoney = moneyIn(q.range.from, q.range.to);
    const cur = computeSales(period, curMoney);
    const prev = computeSales(prevPeriod, moneyIn(prevRange.from, prevRange.to));

    const moneyByDay = groupByDay(curMoney, (m) => m.date);

    const sales: SalesBlockData = {
      total: { ...metric(dram(cur.totalRevenue), dram(prev.totalRevenue)), count: cur.totalCount },
      services: { ...metric(dram(cur.servicesRevenue), dram(prev.servicesRevenue)), count: cur.servicesCount },
      products: { ...metric(dram(cur.productsRevenue), dram(prev.productsRevenue)), count: cur.productsCount },
      avgVisit: { ...metric(dram(cur.avgVisit), dram(prev.avgVisit)), count: cur.receipts },
      avgService: metric(dram(cur.avgService), dram(prev.avgService)),
      avgProduct: metric(dram(cur.avgProduct), dram(prev.avgProduct)),
      booked: { total: dram(cur.bookedTotal), services: dram(cur.bookedServices) },
      byDay: days.map((date) => {
        const day = moneyByDay.get(date) ?? [];
        const dayServices = sumMoney(day.filter((m) => m.kind === 'services'));
        const dayProducts = sumMoney(day.filter((m) => m.kind === 'products'));
        return { date, total: dram(dayServices + dayProducts), services: dram(dayServices), products: dram(dayProducts) };
      }),
    };

    // ── Посещаемость (F-12-013, F-12-014) ──
    const arrivedWithPhone = (bs: Booking[]) => bs.filter((b) => b.status === 'arrived' && !b.deletedAt && !!clientById.get(b.clientId ?? '')?.phone);
    const curArrived = arrivedWithPhone(period);
    const prevArrived = arrivedWithPhone(prevPeriod);
    const curClients = new Set(curArrived.map((b) => b.clientId!));
    const prevClients = new Set(prevArrived.map((b) => b.clientId!));

    const firstArrivalOf = new Map<Id, Booking>();
    const lastArrivalOf = new Map<Id, string>();
    for (const b of all) {
      if (b.status !== 'arrived' || b.deletedAt || !b.clientId) continue;
      const d = b.start.slice(0, 10);
      const last = lastArrivalOf.get(b.clientId);
      if (!last || d > last) lastArrivalOf.set(b.clientId, d);
      if (!clientById.get(b.clientId)?.phone) continue;
      const first = firstArrivalOf.get(b.clientId);
      if (!first || b.start < first.start) firstArrivalOf.set(b.clientId, b);
    }
    const isNewIn = (cid: Id, from: string, to: string) => {
      const first = firstArrivalOf.get(cid)?.start.slice(0, 10);
      return Boolean(first && first >= from && first <= to);
    };
    let newClients = 0;
    let returningClients = 0;
    for (const cid of curClients) {
      if (isNewIn(cid, q.range.from, q.range.to)) newClients += 1;
      else returningClients += 1;
    }
    let prevNew = 0;
    for (const cid of prevClients) if (isNewIn(cid, prevRange.from, prevRange.to)) prevNew += 1;

    const churnDays = churnDaysOf(readArea('reports'), q.businessId);
    const cutoff = addDays(today(), -churnDays);
    let lostClients = 0;
    for (const [cid, last] of lastArrivalOf) {
      const c = clientById.get(cid);
      if (c?.phone && !c.deletedAt && last < cutoff) lostClients += 1;
    }

    const curArrivedByDay = groupByDay(curArrived, (b) => b.start.slice(0, 10));
    const attendance: AttendanceBlockData = {
      clients: metric(curClients.size, prevClients.size),
      visits: metric(cur.visits, prev.visits),
      appointments: metric(period.length, prevPeriod.length),
      newClients: metric(newClients, prevNew),
      returningClients: metric(returningClients, prevClients.size - prevNew),
      lostClients: { value: lostClients },
      byDay: days.map((date) => {
        let n = 0;
        let r = 0;
        for (const b of curArrivedByDay.get(date) ?? []) {
          if (firstArrivalOf.get(b.clientId!)?.start.slice(0, 10) === date) n += 1;
          else r += 1;
        }
        return { date, newClients: n, returningClients: r };
      }),
    };

    // ── Заполненность (F-12-016) ── Отч9: «Не пришёл» отдельно от отмен — доля неявок своя плитка
    const completed = period.filter((b) => b.status === 'arrived' && !b.deletedAt);
    const incomplete = period.filter((b) => INCOMPLETE.includes(b.status) && !b.deletedAt);
    const noShow = period.filter((b) => b.status === 'no_show' && !b.deletedAt);
    const cancelled = period.filter((b) => b.deletedAt || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master');
    const totalForPct = Math.max(1, completed.length + incomplete.length + noShow.length + cancelled.length);
    const share = (n: number) => Math.round((n / totalForPct) * 100);

    // F-12-008: галочка «Учитывать сотрудника в заполненности» — снятая убирает его часы из знаменателя.
    const excludedFromWorkload = new Set(readArea('reports').workloadExcludedStaffIds[q.businessId] ?? []);
    const relevantStaff = core.staff.filter(
      (s) =>
        staffIds.includes(s.id) &&
        (!q.filters.staffId || s.id === q.filters.staffId) &&
        // знаменатель заполненности — те же люди, что в числителе (фильтр «Должности»)
        (!q.filters.position || positionOf(s) === q.filters.position) &&
        takesClients(s, core.businesses.find((b) => b.id === q.businessId)?.kind) &&
        !excludedFromWorkload.has(s.id),
    );
    const schedOf = new Map(relevantStaff.map((s) => [s.id, core.schedules.find((w) => w.staffId === s.id)] as const));
    const workedByDay = new Map<string, number>();
    for (const date of days) {
      let dayWorked = 0;
      for (const s of relevantStaff) dayWorked += shiftMinutes(schedOf.get(s.id), date);
      workedByDay.set(date, dayWorked);
    }
    const workedMinutes = [...workedByDay.values()].reduce((a, b) => a + b, 0);
    const bookedMinutes = completed.reduce((sum, b) => sum + b.durationMin, 0);
    const avgOccupancyPct = workedMinutes > 0 ? Math.round((bookedMinutes / workedMinutes) * 1000) / 10 : 0;
    const completedByDay = groupByDay(completed, (b) => b.start.slice(0, 10));

    const occupancy: OccupancyBlockData = {
      completed: { count: completed.length, sharePct: share(completed.length) },
      incomplete: { count: incomplete.length, sharePct: share(incomplete.length) },
      cancelled: { count: cancelled.length, sharePct: share(cancelled.length) },
      noShow: { count: noShow.length, sharePct: share(noShow.length) },
      avgOccupancyPct,
      byDay: days.map((date) => {
        const dayBooked = (completedByDay.get(date) ?? []).reduce((s, b) => s + b.durationMin, 0);
        const dayWorked = workedByDay.get(date) ?? 0;
        return { date, occupancyPct: dayWorked > 0 ? Math.round((dayBooked / dayWorked) * 1000) / 10 : 0 };
      }),
    };

    // ── Отч13: что ещё владелец спрашивает у отчётов ──
    // Доля перезаписи: из пришедших в периоде клиентов — у скольких уже есть следующая запись (создана до конца
    // периода и позже визита, не отменена). Выручка на час по графику: продажи ÷ часы смен мастеров.
    // Источник клиентов: откуда пришла первая запись у новых клиентов периода.
    const { lastVisitInPeriod, rebookedIds } = rebookingOf(inScope, completed);
    const rebooked = rebookedIds.size;
    const sourceCounts = new Map<Booking['source'], number>();
    for (const cid of curClients) {
      if (!isNewIn(cid, q.range.from, q.range.to)) continue;
      const src = firstArrivalOf.get(cid)?.source;
      if (src) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    }

    const extras: DashboardExtras = {
      rebookingPct: lastVisitInPeriod.size > 0 ? Math.round((rebooked / lastVisitInPeriod.size) * 100) : null,
      rebookedClients: rebooked,
      visitedClients: lastVisitInPeriod.size,
      noShowPct: completed.length + noShow.length > 0 ? Math.round((noShow.length / (completed.length + noShow.length)) * 100) : null,
      revenuePerScheduledHour: workedMinutes > 0 ? dram(cur.totalRevenue / (workedMinutes / 60)) : null,
      scheduledHours: Math.round(workedMinutes / 60),
      newClientSources: [...sourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    };

    return { sales, attendance, occupancy, extras, isEmpty: all.length === 0 };
  });
}

// ─────────────────────────── F-12-029…032, 038: «Визиты» ───────────────────────────

export interface VisitsQuery {
  businessId: Id;
  locationIds: Id[];
  tab: 'upcoming' | 'past';
  canSeePhones: boolean;
}

export function getVisits(q: VisitsQuery): Promise<{ days: VisitsDay[]; count: number }> {
  if (isApiMode()) return Server.getVisits(q);
  return request(async () => {
    const core = readCore();
    const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
    const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
    const serviceById = new Map(core.services.map((s) => [s.id, s] as const));
    const nowD = today();
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const scoped = all.filter((b) => q.locationIds.includes(b.locationId));
    const picked = scoped.filter((b) => {
      // Отменённая запись — не визит: у строки нет статуса, и после «Отменить» в ленте она оставалась в «Предстоящих»
      if (b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master') return false;
      const d = b.start.slice(0, 10);
      return q.tab === 'upcoming' ? d >= nowD : d < nowD;
    });
    const byDay = new Map<string, Booking[]>();
    for (const b of picked) {
      const d = b.start.slice(0, 10);
      const list = byDay.get(d) ?? [];
      list.push(b);
      byDay.set(d, list);
    }
    const dates = [...byDay.keys()].sort((a, b) => (q.tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
    const days: VisitsDay[] = dates.map((date) => ({
      date,
      rows: (byDay.get(date) ?? [])
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((b) => {
          const client = clientById.get(b.clientId ?? '');
          return {
            bookingId: b.id,
            date,
            time: b.start.slice(11, 16),
            durationMin: b.durationMin,
            clientName: b.visitorName ?? client?.name,
            clientPhone: q.canSeePhones ? client?.phone : client?.phone ? '•••' : undefined,
            visitorName: b.visitorName,
            services: b.services.map((l) => serviceById.get(l.serviceId)?.name.ru ?? serviceById.get(l.serviceId)?.name.en ?? ''),
            staffName: staffById.get(b.staffId)?.name ?? '',
            canConfirm: b.status === 'scheduled' || b.status === 'awaiting_confirmation',
          } satisfies VisitRow;
        }),
    }));
    return { days, count: picked.length };
  });
}

/** F-12-031: галочка «Подтвердить запись» — статус → client_confirmed (уведомление шлёт notify, F-05-026) */
export function confirmVisit(bookingId: Id): Promise<Booking> {
  return changeBookingStatus(bookingId, 'client_confirmed', 'business');
}

// ─────────────────────────── F-12-030, F-12-038: «Лента активности по записям» ───────────────────────────

const SOURCE_LABEL: Record<Booking['source'], string> = {
  journal: 'journal',
  app: 'app',
  link: 'link',
  widget: 'widget',
  phone: 'phone',
  import: 'import',
  external: 'external',
};
const ONLINE_SOURCES = new Set<Booking['source']>(['app', 'link', 'widget']);

// ─────────────────────────── F-12-033…039: отчёт «Записи» ───────────────────────────

export interface AppointmentsQuery {
  businessId: Id;
  locationIds: Id[];
  filters: AppointmentsFilters;
  canSeePhones: boolean;
  historyDepth: RecordsHistoryDepth;
  page: number;
}

/**
 * F-12-033/034: все записи в диапазоне «Дата создания», включая удалённые (мягкое удаление, F-01-119); ещё
 * фильтруются по дате визита, сотруднику, автору, статусу, отменённости, источнику, наличию услуг и поиску.
 * F-12-085: глубина истории права режет диапазон снизу так же, как в остальных отчётах раздела.
 */
export function listAppointmentsReport(q: AppointmentsQuery): Promise<AppointmentsResult> {
  if (isApiMode()) return Server.listAppointmentsReport(q);
  return request(async () => {
    const core = readCore();
    const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
    const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
    const serviceById = new Map(core.services.map((s) => [s.id, s] as const));
    const todayISO = today();

    const all = await listBookings({ businessId: q.businessId, includeDeleted: true });
    const rows = all.filter((b) => {
      if (!q.locationIds.includes(b.locationId)) return false;
      const createdDate = b.createdAt.slice(0, 10);
      if (!withinRecordsDepth(createdDate, q.historyDepth, todayISO)) return false;
      if (createdDate < q.filters.createdFrom || createdDate > q.filters.createdTo) return false;
      if (q.filters.visitFrom || q.filters.visitTo) {
        const visitDate = b.start.slice(0, 10);
        if (q.filters.visitFrom && visitDate < q.filters.visitFrom) return false;
        if (q.filters.visitTo && visitDate > q.filters.visitTo) return false;
      }
      if (q.filters.staffId && b.staffId !== q.filters.staffId) return false;
      if (q.filters.createdBy && b.createdBy !== q.filters.createdBy) return false;
      const cancelled = Boolean(b.deletedAt) || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master';
      if (q.filters.cancelled === 'cancelled' && !cancelled) return false;
      if (q.filters.cancelled === 'notCancelled' && cancelled) return false;
      if (q.filters.status && b.status !== q.filters.status) return false;
      if (q.filters.source !== 'all') {
        const online = ONLINE_SOURCES.has(b.source);
        if (q.filters.source === 'online' && !online) return false;
        if (q.filters.source === 'offline' && online) return false;
      }
      if (q.filters.hasServices === 'with' && b.services.length === 0) return false;
      if (q.filters.hasServices === 'without' && b.services.length > 0) return false;
      if (q.filters.search) {
        const needle = q.filters.search.trim().toLowerCase();
        const client = clientById.get(b.clientId ?? '');
        const haystack = `${b.visitorName ?? client?.name ?? ''} ${client?.phone ?? ''}`.toLowerCase();
        if (needle && !haystack.includes(needle)) return false;
      }
      return true;
    });
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = rows.length;
    const pageRows = rows.slice(0, q.filters.pageSize);

    const canEditEach = q.filters.cancelled !== 'cancelled';
    const result: AppointmentRow[] = pageRows.map((b) => {
      const staff = staffById.get(b.staffId);
      const client = clientById.get(b.clientId ?? '');
      const cancelledRow = Boolean(b.deletedAt) || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master';
      return {
        id: b.id,
        staffId: b.staffId,
        staffName: staff?.name ?? '—',
        staffSpecialty: staff?.specialty?.ru ?? staff?.position?.ru,
        staffFired: staff?.status === 'fired',
        servicesLabel: b.services.map((l) => serviceById.get(l.serviceId)?.name.ru ?? serviceById.get(l.serviceId)?.name.en ?? '').filter(Boolean).join('; ') || '—',
        clientId: b.clientId,
        clientName: b.visitorName ?? client?.name ?? '—',
        clientPhone: q.canSeePhones ? client?.phone : client?.phone ? '•••' : undefined,
        visitStart: b.start,
        createdByLabel: b.createdBy === 'client' ? 'client' : (staffById.get(b.createdBy)?.name ?? '—'),
        createdAt: b.createdAt,
        status: b.status,
        isCancelledRow: cancelledRow,
        sourceLabel: SOURCE_LABEL[b.source],
        deleted: Boolean(b.deletedAt),
        deletedAt: b.deletedAt,
        canEdit: canEditEach && !b.deletedAt,
        canDelete: !b.deletedAt,
      } satisfies AppointmentRow;
    });
    return { rows: result, total };
  });
}

/** F-12-035: удалить одну или несколько записей сразу — мягкое удаление ядра (deleteBooking), одним циклом */
export function bulkDeleteAppointments(ids: Id[]): Promise<number> {
  return request(async () => {
    let count = 0;
    for (const id of ids) {
      await deleteBooking(id);
      count++;
    }
    return count;
  });
}

/**
 * F-12-036: пределы и адрес выгрузки — как у остальных отчётов раздела (F-12-078…080): пишем в общий журнал
 * «Операции с данными» под area 'reports' / entity 'appointments' (совпадает с типом в F-12-074/075).
 */
export function logAppointmentsExport(businessId: Id, count: number, fileName: string): Promise<void> {
  return request(() => {
    coreTx.logDataOperation({ businessId, kind: 'export', area: 'reports', entity: 'appointments', count, fileName });
  });
}

export interface AppointmentImportRow {
  staffName: string;
  clientName: string;
  clientPhone: string;
  visitStart: string;
  durationMin: number;
  serviceNames: string[];
  status: BookingStatus;
  comment?: string;
}

/**
 * F-12-037: загрузка «как есть», без правил ядра (та же логика, что у placeBooking, здесь не нужна — это
 * перенос прошлого, не новая запись клиента). Строка с неизвестным сотрудником или услугой отбраковывается —
 * экран показывает её как ошибку до отправки (тот же приём, что ImportOperationsSheet в finance).
 */
export function importAppointments(businessId: Id, locationId: Id, rows: AppointmentImportRow[]): Promise<{ created: number; failed: number }> {
  if (isApiMode()) return Server.importAppointments(businessId, locationId, rows);
  return request(async () => {
    let created = 0;
    const core = readCore();
    const staffByName = new Map(core.staff.map((s) => [s.name.trim().toLowerCase(), s] as const));
    const serviceByName = new Map(core.services.map((s) => [(s.name.ru || s.name.en || '').trim().toLowerCase(), s] as const));
    for (const row of rows) {
      const staff = staffByName.get(row.staffName.trim().toLowerCase());
      if (!staff) continue;
      const lines = row.serviceNames
        .map((n) => serviceByName.get(n.trim().toLowerCase()))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({ serviceId: s.id, staffId: staff.id, price: s.priceMin, durationMin: s.durationMin, qty: 1 }));
      const client = row.clientPhone ? await findClientByPhone(businessId, row.clientPhone) : undefined;
      await createBooking({
        businessId,
        locationId,
        staffId: staff.id,
        clientId: client?.id,
        start: row.visitStart,
        durationMin: row.durationMin || 15,
        status: row.status,
        services: lines,
        resourceIds: [],
        workplace: 'salon',
        source: 'import',
        createdBy: staff.id,
        forWhom: 'self',
        visitorName: client ? undefined : row.clientName,
        comment: row.comment,
      });
      created++;
    }
    if (created > 0) {
      coreTx.logDataOperation({ businessId, kind: 'import', area: 'reports', entity: 'appointmentsImport', count: created, failed: rows.length - created });
    }
    return { created, failed: rows.length - created };
  });
}

export function getActivityFeed(q: {
  businessId: Id;
  locationIds: Id[];
  filter: ActivityFilter;
  canSeePhones: boolean;
}): Promise<ActivityEntry[]> {
  if (isApiMode()) return Server.getActivityFeed(q);
  return request(async () => {
    const core = readCore();
    const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
    const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
    const serviceById = new Map(core.services.map((s) => [s.id, s] as const));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: true });
    const scoped = all
      .filter((b) => q.locationIds.includes(b.locationId))
      .filter((b) => {
        if (q.filter === 'all' || q.filter === 'newOnline') return true;
        const online = ONLINE_SOURCES.has(b.source);
        return q.filter === 'online' ? online : !online;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);

    const allEvents = await listBookingEvents({ businessId: q.businessId });
    const entries: ActivityEntry[] = [];
    for (const b of scoped) {
      const history = allEvents
        .filter((e) => e.bookingId === b.id)
        .sort((a, c) => a.at.localeCompare(c.at))
        .map((e) => ({
          id: e.id,
          authorName: e.by === 'client' ? 'client' : e.by === 'system' ? 'system' : (staffById.get(e.by)?.name ?? '—'),
          action: (e.kind === 'created'
            ? 'created'
            : e.kind === 'deleted'
              ? 'deleted'
              : e.kind === 'status'
                ? 'statusChanged'
                : e.kind === 'moved'
                  ? 'moved'
                  : 'updated') as ActivityEntry['history'][number]['action'],
          summary:
            e.kind === 'status'
              ? `${e.from ?? ''} → ${e.to ?? ''}`
              : e.kind === 'created'
                ? 'created'
                : e.kind === 'delayed'
                  ? `+${e.delayMin ?? 0}`
                  : 'updated',
          // F-12-030: реальное «было → стало» для переноса времени/мастера, а не жёсткая строка
          ...(e.kind === 'moved'
            ? {
                moved: {
                  prevStart: e.prevStart,
                  start: e.start ?? b.start,
                  ...(e.prevStaffId ? { prevStaffName: staffById.get(e.prevStaffId)?.name ?? '—' } : {}),
                  ...(e.prevStaffId ? { staffName: staffById.get(b.staffId)?.name ?? '—' } : {}),
                },
              }
            : {}),
          at: e.at,
        }));
      const client = clientById.get(b.clientId ?? '');
      entries.push({
        bookingId: b.id,
        date: b.start.slice(0, 10),
        sourceLabel: SOURCE_LABEL[b.source],
        online: ONLINE_SOURCES.has(b.source),
        serviceNames: b.services.map((l) => serviceById.get(l.serviceId)?.name.ru ?? '').join(', '),
        time: b.start.slice(11, 16),
        staffName: staffById.get(b.staffId)?.name ?? '',
        // ux-best-c2 №4: удалённый клиент — без имени и телефона, но запись остаётся в ленте
        clientName: client?.deletedAt ? undefined : (b.visitorName ?? client?.name),
        clientPhone: client?.deletedAt ? undefined : q.canSeePhones ? client?.phone : undefined,
        clientDeleted: Boolean(client?.deletedAt),
        durationMin: b.durationMin,
        history,
      });
    }
    return entries;
  });
}

export function cancelActivityBooking(bookingId: Id): Promise<Booking> {
  return changeBookingStatus(bookingId, 'cancelled_by_master', 'business');
}

// ─────────────────────────── F-12-032: сведения о салоне для поддержки ───────────────────────────

export function getSupportInfo(businessId: Id): Promise<{ businessId: Id }> {
  return request(() => ({ businessId }));
}

// ─────────────────────────── помощники b02: график, склад, финансы (кросс-чтение, как в дашборде) ───────────────────────────

function scheduledMinutesOf(staffIds: Id[], from: ISODate, to: ISODate): Map<Id, Map<string, number>> {
  const core = readCore();
  const days = eachDay(from, to);
  const byStaffByDay = new Map<Id, Map<string, number>>();
  for (const staffId of staffIds) {
    const sched = core.schedules.find((w) => w.staffId === staffId);
    const byDay = new Map<string, number>();
    if (sched) for (const date of days) byDay.set(date, shiftMinutes(sched, date));
    byStaffByDay.set(staffId, byDay);
  }
  return byStaffByDay;
}

// ─────────────────────────── F-12-019…023,026,028: «Возвращаемость клиентов» ───────────────────────────

export interface RetentionQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
  serviceId?: Id;
}

export function getRetentionReport(q: RetentionQuery): Promise<RetentionReportData> {
  if (isApiMode()) return Server.getRetentionReport(q);
  return request(async () => {
    const core = readCore();
    const churnDays = churnDaysOf(readArea('reports'), q.businessId);
    const staffList = core.staff.filter((s) => q.locationIds.some((l) => s.locationIds.includes(l)));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const scoped = all.filter(
      (b) =>
        b.status === 'arrived' &&
        q.locationIds.includes(b.locationId) &&
        (!q.serviceId || b.services.some((l) => l.serviceId === q.serviceId)),
    );

    // Прошлое окно F-12-023: churnDays дней, примыкающих к началу текущего периода
    const priorTo = toISODate(dayjs(q.range.from).subtract(1, 'day'));
    const priorFrom = toISODate(dayjs(q.range.from).subtract(churnDays, 'day'));

    const rows: RetentionRow[] = [];
    const allUniqueClients = new Set<Id>();
    for (const s of staffList) {
      const staffBookings = scoped.filter((b) => b.staffId === s.id && !!b.clientId);
      const periodBookings = staffBookings.filter((b) => inRange(b, q.range));
      const periodClients = new Set(periodBookings.map((b) => b.clientId!));
      if (periodClients.size === 0) continue;
      periodClients.forEach((c) => allUniqueClients.add(c));

      // F-12-021: «новый» у этого мастера — не встречался у него раньше начала периода
      const priorStaffClients = new Set(staffBookings.filter((b) => b.start.slice(0, 10) < q.range.from).map((b) => b.clientId!));
      let newCount = 0;
      let returningCount = 0;
      for (const c of periodClients) {
        if (priorStaffClients.has(c)) returningCount++;
        else newCount++;
      }

      // F-12-023: клиентов мастера в прошлом окне (churnDays до начала периода) и сколько из них вернулись
      const priorWindowClients = new Set(
        staffBookings.filter((b) => b.start.slice(0, 10) >= priorFrom && b.start.slice(0, 10) <= priorTo).map((b) => b.clientId!),
      );
      let priorWindowReturned = 0;
      priorWindowClients.forEach((c) => {
        if (periodClients.has(c)) priorWindowReturned += 1;
      });

      const total = periodClients.size;
      rows.push({
        staffId: s.id,
        staffName: s.name,
        total,
        newCount,
        newPct: total > 0 ? Math.round((newCount / total) * 100) : 0,
        returningCount,
        returningPct: total > 0 ? Math.round((returningCount / total) * 100) : 0,
        priorWindowClients: priorWindowClients.size,
        priorWindowReturned,
        retentionPct: priorWindowClients.size > 0 ? Math.round((priorWindowReturned / priorWindowClients.size) * 100) : null,
      });
    }
    return { rows, totalUniqueClients: allUniqueClients.size, churnDays };
  });
}

// ─────────────────────────── F-12-041…042: «Загруженность сотрудников» ───────────────────────────

export interface WorkloadQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
}

export function getWorkloadReport(q: WorkloadQuery): Promise<WorkloadReportData> {
  if (isApiMode()) return Server.getWorkloadReport(q);
  return request(async () => {
    const core = readCore();
    const kind = core.businesses.find((b) => b.id === q.businessId)?.kind;
    const staffList = core.staff.filter((s) => q.locationIds.some((l) => s.locationIds.includes(l)) && takesClients(s, kind));
    // F-12-008: строка сотрудника остаётся видна, галочка только выводит его часы из знаменателя итога/среднего.
    const excludedFromWorkload = new Set(readArea('reports').workloadExcludedStaffIds[q.businessId] ?? []);
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const scoped = all.filter((b) => q.locationIds.includes(b.locationId));
    const scheduledByStaff = scheduledMinutesOf(staffList.map((s) => s.id), q.range.from, q.range.to);
    const futureFrom = toISODate(dayjs(q.range.to).add(1, 'day'));
    const days = eachDay(q.range.from, q.range.to);

    const rows: WorkloadRow[] = staffList.map((s) => {
      const arrived = scoped.filter((b) => b.staffId === s.id && b.status === 'arrived' && inRange(b, q.range));
      const arrivedByDay = groupByDay(arrived, (b) => b.start.slice(0, 10));
      const workedMinutes = arrived.reduce((sum, b) => sum + b.durationMin, 0);
      const workedDays = arrivedByDay.size;
      const schedByDay = scheduledByStaff.get(s.id) ?? new Map();
      const hasAnySchedule = [...schedByDay.values()].some((m) => m > 0);
      const scheduledMinutes = [...schedByDay.values()].reduce((a, b) => a + b, 0);
      const scheduledHours = hasAnySchedule ? Math.round((scheduledMinutes / 60) * 10) / 10 : null;
      const workedHours = Math.round((workedMinutes / 60) * 10) / 10;
      const futureBookings = scoped.filter((b) => b.staffId === s.id && b.start.slice(0, 10) >= futureFrom && b.status !== 'cancelled_by_client' && b.status !== 'cancelled_by_master' && b.status !== 'no_show' && !b.deletedAt).length;
      return {
        staffId: s.id,
        staffName: s.name,
        workedDays,
        scheduledHours,
        workedHours,
        idleHours: scheduledHours !== null ? Math.round((scheduledHours - workedHours) * 10) / 10 : null,
        occupancyPct: scheduledHours && scheduledHours > 0 ? Math.round((workedHours / scheduledHours) * 1000) / 10 : scheduledHours === 0 ? 0 : null,
        futureBookings,
        byDay: days.map((date) => {
          const dayWorked = (arrivedByDay.get(date) ?? []).reduce((s2, b) => s2 + b.durationMin, 0);
          const dayScheduled = schedByDay.get(date) ?? 0;
          return { date, occupancyPct: dayScheduled > 0 ? Math.round((dayWorked / dayScheduled) * 1000) / 10 : 0 };
        }),
        includedInAverage: !excludedFromWorkload.has(s.id),
      } satisfies WorkloadRow;
    });

    const forAverage = rows.filter((r) => r.includedInAverage);
    return {
      rows,
      totalWorkedHours: Math.round(forAverage.reduce((s, r) => s + r.workedHours, 0) * 10) / 10,
      totalScheduledHours: Math.round(forAverage.reduce((s, r) => s + (r.scheduledHours ?? 0), 0) * 10) / 10,
    };
  });
}

/** F-12-008: включить/исключить сотрудника из знаменателя средней заполненности (карточка → «Статистика»). */
export function setWorkloadIncluded(businessId: Id, staffId: Id, included: boolean): Promise<void> {
  if (isApiMode()) return Server.setWorkloadIncluded(businessId, staffId, included);
  return request(() => {
    assertCan('reports.view');
    mutateArea('reports', (s) => {
      const list = s.workloadExcludedStaffIds[businessId] ?? (s.workloadExcludedStaffIds[businessId] = []);
      const idx = list.indexOf(staffId);
      if (included && idx >= 0) list.splice(idx, 1);
      if (!included && idx < 0) list.push(staffId);
    });
  });
}

// ─────────────────────────── F-12-040: «События» (групповые записи) ───────────────────────────

export interface EventsQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
  serviceId?: Id;
  staffId?: Id;
  status?: 'all' | 'cancelled' | 'notCancelled';
}

export function getEventsReport(q: EventsQuery): Promise<EventsReportData> {
  if (isApiMode()) return Server.getEventsReport(q);
  return request(async () => {
    const core = readCore();
    const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
    const serviceById = new Map(core.services.map((s) => [s.id, s] as const));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: true });

    const events = (core.groupEvents ?? []).filter(
      (e) =>
        q.locationIds.includes(e.locationId) &&
        e.start.slice(0, 10) >= q.range.from &&
        e.start.slice(0, 10) <= q.range.to &&
        (!q.serviceId || e.serviceId === q.serviceId) &&
        (!q.staffId || e.staffId === q.staffId) &&
        (q.status === 'cancelled' ? e.status === 'cancelled' : q.status === 'notCancelled' ? e.status !== 'cancelled' : true),
    );

    const rows: EventRow[] = events.map((e) => {
      const bookings = all.filter((b) => b.groupEventId === e.id && !b.deletedAt && b.status !== 'cancelled_by_client' && b.status !== 'cancelled_by_master');
      const arrived = bookings.filter((b) => b.status === 'arrived');
      const paid = bookings.filter((b) => b.total > 0);
      return {
        groupEventId: e.id,
        staffName: staffById.get(e.staffId)?.name ?? '—',
        serviceName: serviceById.get(e.serviceId)?.name.ru ?? serviceById.get(e.serviceId)?.name.en ?? '—',
        date: e.start.slice(0, 10),
        time: e.start.slice(11, 16),
        durationMin: e.durationMin,
        capacity: e.capacity,
        bookingsCount: bookings.length,
        arrivedCount: arrived.length,
        paidCount: paid.length,
        paidAmount: paid.reduce((s, b) => s + b.total, 0),
        createdByLabel: 'staff',
        cancelled: e.status === 'cancelled',
      } satisfies EventRow;
    });

    const cap = Math.max(1, rows.reduce((s, r) => s + r.capacity, 0));
    const totals: EventsReportTotals = {
      bookedPct: Math.round((rows.reduce((s, r) => s + r.bookingsCount, 0) / cap) * 100),
      arrivedPct: Math.round((rows.reduce((s, r) => s + r.arrivedCount, 0) / cap) * 100),
      paidPct: Math.round((rows.reduce((s, r) => s + r.paidCount, 0) / cap) * 100),
      avgFillPct: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.arrivedCount / Math.max(1, r.capacity)) * 100, 0) / rows.length) : 0,
    };
    return { rows, totals };
  });
}

// ─────────────────────────── Финансовые отчёты: источник данных ───────────────────────────
// Отч11: «Финансовый», P&L, «Касса за день» раньше читали моковую базу и в режиме api показывали бы пусто.
// Серверные маршруты finance/reports/* отдают только сводки (приход/расход/нал/безнал), матрицы «статья ×
// день» и 12 месяцев сервер не строит — поэтому в режиме api отчёт собирается здесь же из настоящих данных
// сервера (статьи, кассы, операции через фасад finance), тем же кодом, что и на моке.

interface FinanceSource {
  items: FinanceItem[];
  accounts: Account[];
  ops: Operation[];
  /** Системный ключ статьи операции (оплата визита, продажа товара…); на сервере ключей нет — по источнику операции */
  keyOf: (o: Operation) => SystemItemKey | undefined;
  /** id статьи по ключу — нужен P&L, чтобы найти строку «Зарплата» */
  itemIdOf: (key: SystemItemKey) => Id | undefined;
}

function financeWindow(from?: ISODate, to?: ISODate): Pick<OperationFilter, 'dateFrom' | 'dateTo'> {
  return { ...(from ? { dateFrom: `${from}T00:00` } : {}), ...(to ? { dateTo: `${to}T23:59` } : {}) };
}

/** Мок: синхронно из среза finance (внутри request) */
function financeSourceMock(businessId: Id, locationIds: Id[], from?: ISODate, to?: ISODate): FinanceSource {
  const fin = readArea('finance');
  const byKey = fin.itemBySystemKey[businessId] ?? {};
  const keyByItem = new Map(Object.entries(byKey).map(([k, id]) => [id, k as SystemItemKey] as const));
  return {
    items: fin.items.filter((i) => i.businessId === businessId),
    accounts: fin.accounts.filter((a) => a.businessId === businessId),
    ops: fin.operations.filter(
      (o) => o.businessId === businessId && locationIds.includes(o.locationId) && (!from || o.date.slice(0, 10) >= from) && (!to || o.date.slice(0, 10) <= to),
    ),
    keyOf: (o) => keyByItem.get(o.itemId),
    itemIdOf: (key) => byKey[key],
  };
}

/** api: те же данные с сервера. Вызовы фасадов — синхронно, до первого await (они объявляют, что читают) */
async function financeSourceApi(businessId: Id, locationIds: Id[], from?: ISODate, to?: ISODate): Promise<FinanceSource> {
  const [items, accounts, ops] = await Promise.all([
    listFinanceItems(businessId),
    listFinanceAccounts(businessId),
    listFinanceOperations(businessId, { locationIds, ...financeWindow(from, to) }),
  ]);
  const keyOf = (o: Operation): SystemItemKey | undefined => {
    if (o.source === 'booking' && o.kind === 'income') return 'servicePayment';
    if (o.source === 'sale' && o.kind === 'income') return 'goodsSale';
    if (o.source === 'account' && o.kind === 'income') return 'accountTopUp';
    if (o.source === 'payroll' && o.kind === 'expense') return 'staffPayroll';
    return undefined;
  };
  const payrollItem = ops.find((o) => keyOf(o) === 'staffPayroll')?.itemId;
  return { items, accounts, ops, keyOf, itemIdOf: (key) => (key === 'staffPayroll' ? payrollItem : undefined) };
}

// ─────────────────────────── F-12-044…045: «Финансовый отчет» ───────────────────────────

export interface FinanceReportQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
  filters: FinanceReportFilters;
}

/** Отч7: длиннее месяца — колонки по месяцам (за год было 365 дней × 2 типа кассы = 730 колонок) */
const FINANCE_DAILY_MAX_DAYS = 31;

function buildFinanceReport(q: FinanceReportQuery, src: FinanceSource): FinanceReportData {
  const itemById = new Map(src.items.map((i) => [i.id, i] as const));
  const accountById = new Map(src.accounts.map((a) => [a.id, a] as const));
  let ops = src.ops.filter((o) => !o.cancelled && o.date.slice(0, 10) >= q.range.from && o.date.slice(0, 10) <= q.range.to && (o.kind === 'income' || o.kind === 'expense'));
  if (q.filters.itemId) ops = ops.filter((o) => o.itemId === q.filters.itemId);
  if (q.filters.counterpartyId) ops = ops.filter((o) => o.partyType === 'counterparty' && o.partyId === q.filters.counterpartyId);
  if (q.filters.accountId) ops = ops.filter((o) => o.accountId === q.filters.accountId);
  const kindOf = (o: Operation): CashRegisterKind => (accountById.get(o.accountId)?.kind === 'cash' ? 'cash' : 'noncash');
  if (q.filters.registerKind && q.filters.registerKind !== 'any') ops = ops.filter((o) => kindOf(o) === q.filters.registerKind);

  const days = eachDay(q.range.from, q.range.to);
  const granularity: 'day' | 'month' = days.length > FINANCE_DAILY_MAX_DAYS ? 'month' : 'day';
  const periods = granularity === 'day' ? days : [...new Set(days.map((d) => d.slice(0, 7)))];
  const periodOf = (date: string) => (granularity === 'day' ? date.slice(0, 10) : date.slice(0, 7));

  // Отч7: «Без детализации» — одна колонка на период (раньше всё равно делилось на нал/безнал)
  const detail = q.filters.detail ?? 'none';
  const accountsUsed = [...new Set(ops.map((o) => o.accountId))];
  const columnsBase =
    detail === 'byAccount'
      ? accountsUsed.map((id) => ({ key: id, label: accountById.get(id)?.name ?? id }))
      : detail === 'byKind'
        ? [
            { key: 'cash', label: 'cash' },
            { key: 'noncash', label: 'noncash' },
          ]
        : [{ key: 'total', label: '' }];
  const colOf = (o: Operation): string => (detail === 'byAccount' ? o.accountId : detail === 'byKind' ? kindOf(o) : 'total');
  const columns: FinanceReportColumn[] = periods.flatMap((per) => columnsBase.map((c) => ({ key: `${per}:${c.key}`, label: `${per}:${c.label}` })));

  const opsByItem = groupByDay(ops, (o) => o.itemId);
  function buildRows(kind: 'income' | 'expense'): FinanceReportRow[] {
    return [...itemById.values()]
      .filter((i) => i.kind === kind)
      .map((item) => {
        const rowOps = opsByItem.get(item.id) ?? [];
        if (!q.filters.showAllItems && rowOps.length === 0) return null;
        const byColumn: Record<string, number> = {};
        let total = 0;
        for (const o of rowOps) {
          const key = `${periodOf(o.date)}:${colOf(o)}`;
          byColumn[key] = (byColumn[key] ?? 0) + o.amount;
          total += o.amount;
        }
        return { itemId: item.id, itemLabel: item.name, itemKind: kind, byColumn, total } satisfies FinanceReportRow;
      })
      .filter((r): r is FinanceReportRow => r !== null);
  }

  const income = buildRows('income');
  const expense = buildRows('expense');
  const incomeTotal: Record<string, number> = {};
  const expenseTotal: Record<string, number> = {};
  for (const c of columns) {
    incomeTotal[c.key] = income.reduce((s, r) => s + (r.byColumn[c.key] ?? 0), 0);
    expenseTotal[c.key] = expense.reduce((s, r) => s + (r.byColumn[c.key] ?? 0), 0);
  }
  const perPeriod = (totals: Record<string, number>, per: string) => columnsBase.reduce((s, c) => s + (totals[`${per}:${c.key}`] ?? 0), 0);
  const balanceEndOfDay: Record<string, number> = {};
  let running = 0;
  for (const per of periods) {
    running += perPeriod(incomeTotal, per) - perPeriod(expenseTotal, per);
    balanceEndOfDay[per] = running;
  }

  return {
    granularity,
    columns,
    income,
    expense,
    incomeTotal,
    expenseTotal,
    balanceEndOfDay,
    grandIncome: income.reduce((s, r) => s + r.total, 0),
    grandExpense: expense.reduce((s, r) => s + r.total, 0),
    chart: periods.map((per) => ({ date: granularity === 'day' ? per : `${per}-01`, income: perPeriod(incomeTotal, per), expense: perPeriod(expenseTotal, per) })),
  };
}

export function getFinanceReport(q: FinanceReportQuery): Promise<FinanceReportData> {
  if (isApiMode()) return financeSourceApi(q.businessId, q.locationIds, q.range.from, q.range.to).then((src) => buildFinanceReport(q, src));
  return request(() => buildFinanceReport(q, financeSourceMock(q.businessId, q.locationIds, q.range.from, q.range.to)));
}

// ─────────────────────────── F-12-046…047: «P&L отчет» ───────────────────────────

export interface PnlQuery {
  businessId: Id;
  locationIds: Id[];
  /** 'YYYY-MM' — с какого месяца показывать 12 месяцев */
  fromMonth: string;
  payrollDetail: PayrollDetailMode;
}

function pnlMonths(fromMonth: string): string[] {
  return Array.from({ length: 12 }, (_, i) => dayjs(`${fromMonth}-01`).add(i, 'month').format('YYYY-MM'));
}

function buildPnlReport(q: PnlQuery, src: FinanceSource): PnlData {
  const months = pnlMonths(q.fromMonth);
  const monthIdx = new Map(months.map((m, i) => [m, i] as const));
  const ops = src.ops.filter((o) => !o.cancelled && monthIdx.has(o.date.slice(0, 7)) && (o.kind === 'income' || o.kind === 'expense'));
  const opsByItem = groupByDay(ops, (o) => o.itemId);

  function rowsFor(kind: 'income' | 'expense'): PnlRow[] {
    return src.items
      .filter((i) => i.kind === kind)
      .map((item) => {
        const byMonth = months.map(() => 0);
        for (const o of opsByItem.get(item.id) ?? []) byMonth[monthIdx.get(o.date.slice(0, 7))!] += o.amount;
        // Отч11: пополнение депозита клиента — деньги в кассе, но аванс, а не выручка (услуги, оплаченные
        // с депозита, отдельной операцией в кассу не приходят — поэтому в кассовом P&L строка остаётся,
        // но помечена: экран пишет «аванс клиентов», итог «в т.ч. авансы» — отдельной строкой)
        const advance = (opsByItem.get(item.id) ?? []).some((o) => src.keyOf(o) === 'accountTopUp');
        return { itemId: item.id, itemLabel: item.name, itemKind: kind, byMonth, total: byMonth.reduce((a, b) => a + b, 0), ...(advance ? { advance: true } : {}) };
      })
      .filter((r) => r.total > 0 || r.byMonth.some((v) => v > 0));
  }

  const income = rowsFor('income');
  let expense = rowsFor('expense');

  // F-09-091: «детализировать зарплату по должностям / по сотрудникам» — вместо одной строки «Зарплата
  // персонала» по строке на сотрудника/должность. Отчёт кассовый (CYCLE-10 §7) — только реальные выплаты.
  const payrollItemId = src.itemIdOf('staffPayroll');
  if (q.payrollDetail !== 'none' && payrollItemId) {
    const payrollOps = ops.filter((o) => o.itemId === payrollItemId && o.partyType === 'staff' && o.partyId);
    const staffById = new Map(readCore().staff.map((s) => [s.id, s] as const));
    const groupKey = (staffId: Id) =>
      q.payrollDetail === 'byStaff' ? staffId : (staffById.get(staffId)?.position?.ru ?? staffById.get(staffId)?.position?.en ?? staffId);
    const groupLabel = (key: Id, staffId: Id) => (q.payrollDetail === 'byStaff' ? (staffById.get(staffId)?.name ?? key) : key);

    const groups = new Map<string, { label: string; byMonth: number[]; partyIds: Id[] }>();
    for (const op of payrollOps) {
      const key = String(groupKey(op.partyId!));
      if (!groups.has(key)) groups.set(key, { label: groupLabel(key, op.partyId!), byMonth: months.map(() => 0), partyIds: [] });
      const g = groups.get(key)!;
      g.byMonth[monthIdx.get(op.date.slice(0, 7))!] += op.amount;
      if (!g.partyIds.includes(op.partyId!)) g.partyIds.push(op.partyId!);
    }
    // itemId остаётся настоящей статьёй — клик по сумме находит реальные операции, суженные по partyIds строки
    const detailRows: PnlRow[] = [...groups.values()]
      .map((g) => ({ itemId: payrollItemId, itemLabel: g.label, itemKind: 'expense' as const, byMonth: g.byMonth, total: g.byMonth.reduce((a, b) => a + b, 0), partyIds: g.partyIds }))
      .sort((a, b) => b.total - a.total);
    expense = [...expense.filter((r) => r.itemId !== payrollItemId), ...detailRows];
  }

  const sumAt = (rows: PnlRow[], idx: number) => rows.reduce((s, r) => s + r.byMonth[idx], 0);
  const totalBeforeTax = months.map((_, idx) => sumAt(income, idx) - sumAt(expense, idx));

  return {
    months,
    income,
    expense,
    totalBeforeTax,
    chart: months.map((m, idx) => ({ month: m, income: sumAt(income, idx), expense: sumAt(expense, idx), profit: totalBeforeTax[idx] })),
  };
}

export function getPnlReport(q: PnlQuery): Promise<PnlData> {
  const months = pnlMonths(q.fromMonth);
  const from = `${months[0]}-01`;
  const to = toISODate(dayjs(`${months[11]}-01`).endOf('month'));
  if (isApiMode()) return financeSourceApi(q.businessId, q.locationIds, from, to).then((src) => buildPnlReport(q, src));
  return request(() => buildPnlReport(q, financeSourceMock(q.businessId, q.locationIds, from, to)));
}

export interface PnlOperationsQuery {
  businessId: Id;
  itemId: Id;
  month: string;
  /** F-09-091: строка «Зарплата — <сотрудник/должность>» — сузить операции до этих получателей */
  partyIds?: Id[];
  /** Отч: клик по сумме — операции тех же филиалов, что и строка отчёта */
  locationIds?: Id[];
}

export function getPnlItemOperations(q: PnlOperationsQuery): Promise<Operation[]> {
  const from = `${q.month}-01`;
  const to = toISODate(dayjs(from).endOf('month'));
  const pick = (ops: Operation[]) =>
    ops.filter(
      (o) =>
        o.itemId === q.itemId &&
        !o.cancelled &&
        o.date.slice(0, 7) === q.month &&
        (!q.locationIds || q.locationIds.includes(o.locationId)) &&
        (!q.partyIds || (o.partyId !== undefined && q.partyIds.includes(o.partyId))),
    );
  if (isApiMode()) return listFinanceOperations(q.businessId, { itemId: q.itemId, locationIds: q.locationIds, ...financeWindow(from, to) }).then(pick);
  return request(() => pick(readArea('finance').operations.filter((o) => o.businessId === q.businessId)));
}

// ─────────────────────────── F-12-048…049: «Отчет по кассе за день» ───────────────────────────

export interface CashDayQuery {
  businessId: Id;
  locationIds: Id[];
  date: ISODate;
  staffId?: Id;
  canSeePhones: boolean;
}

function tile(rows: { total: number }[]): CashDayTile {
  const amount = rows.reduce((s, r) => s + r.total, 0);
  return { count: rows.length, amount, avg: rows.length > 0 ? dram(amount / rows.length) : 0 };
}

function buildCashDay(
  q: CashDayQuery,
  all: Booking[],
  src: FinanceSource,
  balanceBefore: (a: Account) => number,
  stockSales: ProductSaleOp[] = [],
  goodNameOf: (goodId: Id) => string = () => '',
): CashDayReportData {
  const core = readCore();
  const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
  const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
  const bookingById = new Map(all.map((b) => [b.id, b] as const));
  const itemById = new Map(src.items.map((i) => [i.id, i] as const));
  const accounts = src.accounts.filter((a) => q.locationIds.includes(a.locationId));
  const accountById = new Map(src.accounts.map((a) => [a.id, a] as const));

  const dayBookings = all.filter((b) => q.locationIds.includes(b.locationId) && b.status === 'arrived' && !b.deletedAt && b.start.slice(0, 10) === q.date && (!q.staffId || b.staffId === q.staffId));
  const withClients = dayBookings.filter((b) => !!b.clientId);
  const withoutClients = dayBookings.filter((b) => !b.clientId);
  const clients = new Set(withClients.map((b) => b.clientId!));

  // Отч1: было `(!q.staffId || o.partyType === 'staff' ? o.partyId === q.staffId : true)` — из-за приоритета
  // «?:» без фильтра по сотруднику проходили только операции БЕЗ плательщика, и 25.09 (8 визитов, продажа
  // товара) показывался пустым. Операция сотрудника — по получателю, операция клиента — по мастеру визита.
  const byStaff = (o: Operation) => !q.staffId || (o.partyType === 'staff' ? o.partyId === q.staffId : (o.refId ? bookingById.get(o.refId)?.staffId : undefined) === q.staffId);
  const dayOps = src.ops.filter((o) => !o.cancelled && o.date.slice(0, 10) === q.date && byStaff(o));

  // Продажа товара со склада, у которой нет своей операции в кассе (демо-данные, продажа «в долг» оплачена позже) —
  // всё равно продажа дня: считаем в «Товары» и показываем строкой. Есть операция кассы — берём её, без двойного счёта.
  const finOpIds = new Set(src.ops.map((o) => o.id));
  const looseSales = stockSales.filter(
    (o) => (!o.financeOperationId || !finOpIds.has(o.financeOperationId)) && (!q.staffId || o.staffId === q.staffId),
  );
  const opsByKey = (key: SystemItemKey) => dayOps.filter((o) => src.keyOf(o) === key);
  const asRows = (ops: Operation[]) => ops.map((o) => ({ total: o.amount }));

  const summary: CashDaySummary = {
    totalRecords: tile(dayBookings.map((b) => ({ total: b.total }))),
    recordsWithClients: tile(withClients.map((b) => ({ total: b.total }))),
    recordsWithoutClients: tile(withoutClients.map((b) => ({ total: b.total }))),
    clients: tile([...clients].map((cid) => ({ total: withClients.filter((b) => b.clientId === cid).reduce((s, b) => s + b.total, 0) }))),
    // Решение владельца 01.10.2026: оплаты визитов минус возвраты клиенту по визиту — та же сумма, что «Услуги» дашборда
    servicesPaid: (() => {
      const paid = tile(asRows(opsByKey('servicePayment').filter((o) => o.kind === 'income')));
      const refunded = opsByKey('refund').filter((o) => o.kind === 'expense' && o.source === 'booking' && !!o.refId).reduce((sum, o) => sum + o.amount, 0);
      return { ...paid, amount: paid.amount - refunded };
    })(),
    accountTopUps: tile(asRows(opsByKey('accountTopUp'))),
    productsPaid: tile([...asRows(opsByKey('goodsSale')), ...looseSales.map((o) => ({ total: saleAmount(o) }))]),
    certificatesPaid: tile(asRows(opsByKey('certificateSale'))),
    membershipsPaid: tile(asRows(opsByKey('membershipSale'))),
  };

  const registers: CashRegisterRow[] = accounts.map((a) => {
    const before = balanceBefore(a);
    const todays = src.ops.filter((o) => o.accountId === a.id && !o.cancelled && o.date.slice(0, 10) === q.date);
    const paid = todays.reduce((s, o) => s + (o.kind === 'income' ? o.amount : 0), 0);
    const after = todays.reduce((s, o) => s + operationSign(o.kind) * o.amount, before);
    return { accountId: a.id, accountName: a.name, paid, openingBalance: before, closingBalance: after };
  });

  const operations: CashOperationRow[] = [...dayOps]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => {
      const client = o.partyType === 'client' && o.partyId ? clientById.get(o.partyId) : undefined;
      const booking = o.refId ? bookingById.get(o.refId) : undefined;
      const staffId = o.partyType === 'staff' ? o.partyId : booking?.staffId;
      const refund = src.keyOf(o) === 'refund' || (o.kind === 'expense' && o.itemId === src.itemIdOf('refund'));
      return {
        operationId: o.id,
        time: o.date.slice(11, 16) || '—',
        clientName: client?.name ?? o.partyName,
        staffName: staffId ? (staffById.get(staffId)?.name ?? '—') : '—',
        lineLabel: o.lineLabel ?? itemById.get(o.itemId)?.name ?? '—',
        cost: o.amount,
        discount: 0,
        total: o.amount,
        paid: o.kind === 'income' ? o.amount : 0,
        clientAccount: 0,
        loyalty: 0,
        method: o.method,
        accountName: accountById.get(o.accountId)?.name ?? '—',
        cancelled: Boolean(o.cancelled),
        isRefund: refund || o.kind === 'expense',
      } satisfies CashOperationRow;
    });

  const saleRows: CashOperationRow[] = looseSales.map((o) => {
    const amount = saleAmount(o);
    return {
      operationId: o.id,
      time: o.date.slice(11, 16) || '—',
      clientName: o.clientId ? clientById.get(o.clientId)?.name : undefined,
      staffName: o.staffId ? (staffById.get(o.staffId)?.name ?? '—') : '—',
      lineLabel: o.lines.map((l) => goodNameOf(l.goodId)).filter(Boolean).join(', ') || o.number,
      cost: amount,
      discount: 0,
      total: amount,
      paid: amount,
      clientAccount: 0,
      loyalty: 0,
      method: o.paymentMethod === 'card' ? 'card' : o.paymentMethod === 'cash' ? 'cash' : 'other',
      accountName: '—',
      cancelled: false,
      isRefund: false,
    } satisfies CashOperationRow;
  });

  return { summary, registers, operations: [...operations, ...saleRows].sort((a, b) => a.time.localeCompare(b.time)) };
}

export function getCashDayReport(q: CashDayQuery): Promise<CashDayReportData> {
  if (isApiMode()) {
    // Остаток на начало дня: сервер отдаёт текущий баланс кассы — вычитаем всё, что прошло с начала дня до сейчас
    const bookingsP = listBookings({ businessId: q.businessId, from: q.date, to: q.date });
    const balancesP = listFinanceAccountsWithBalance(q.businessId, q.locationIds);
    const srcP = financeSourceApi(q.businessId, q.locationIds, q.date);
    return Promise.all([bookingsP, balancesP, srcP]).then(([bookings, balances, src]) => {
      const balanceById = new Map(balances.map((a) => [a.id, a.balance] as const));
      const sinceDay = (a: Account) => src.ops.filter((o) => o.accountId === a.id && !o.cancelled && o.date.slice(0, 10) >= q.date).reduce((s, o) => s + operationSign(o.kind) * o.amount, 0);
      return buildCashDay(q, bookings, src, (a) => (balanceById.get(a.id) ?? a.openingBalance) - sinceDay(a));
    });
  }
  return request(async () => {
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false, from: q.date, to: q.date });
    const fin = readArea('finance');
    const src = financeSourceMock(q.businessId, q.locationIds, q.date, q.date);
    const balanceBefore = (a: Account) =>
      fin.operations.filter((o) => o.accountId === a.id && !o.cancelled && o.date.slice(0, 10) < q.date).reduce((s, o) => s + operationSign(o.kind) * o.amount, a.openingBalance);
    const stock = readArea('stock');
    const goodName = new Map(stock.goods.map((g) => [g.id, g.name] as const));
    const stockSales = stock.operations.filter((o) => o.type === 'sale' && o.paid && !o.cancelledAt && q.locationIds.includes(o.locationId) && o.date.slice(0, 10) === q.date);
    return buildCashDay(q, all, src, balanceBefore, stockSales, (id) => goodName.get(id) ?? '');
  });
}

// ─────────────────────────── F-12-050…051: «По сотрудникам» ───────────────────────────

export interface SalesByStaffQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
  serviceCategoryId?: Id;
  serviceId?: Id;
  productCategoryId?: Id;
  position?: string;
}

export function getSalesByStaff(q: SalesByStaffQuery): Promise<SalesByStaffData> {
  if (isApiMode()) return Server.getSalesByStaff(q);
  return request(async () => {
    const core = readCore();
    const staffList = core.staff.filter((s) => q.locationIds.some((l) => s.locationIds.includes(l)) && (!q.position || (s.position?.ru ?? s.position?.en) === q.position));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const scoped = all.filter((b) => q.locationIds.includes(b.locationId) && b.status === 'arrived' && inRange(b, q.range) && (!q.serviceId || b.services.some((l) => l.serviceId === q.serviceId)));
    const days = eachDay(q.range.from, q.range.to);
    const futureFrom = toISODate(dayjs(q.range.to).add(1, 'day'));

    // Решение владельца 01.10.2026: выручка — полученные деньги (как на дашборде и в кассе), см. receivedMoneyMock.
    // Фильтр услуги/категории режет деньги по визитам, где есть эта услуга.
    const bookingById = new Map(all.map((b) => [b.id, b] as const));
    const scopedIds = new Set(scoped.map((b) => b.id));
    const money = receivedMoneyMock(q.businessId, q.locationIds, q.range.from, q.range.to, bookingById).filter(
      (m) => !q.serviceId || m.kind === 'products' || (!!m.bookingId && scopedIds.has(m.bookingId)),
    );

    const rows: SalesByStaffRow[] = staffList.map((s) => {
      const own = scoped.filter((b) => b.staffId === s.id);
      const ownMoney = money.filter((m) => m.staffId === s.id);
      const servicesAmount = sumMoney(ownMoney.filter((m) => m.kind === 'services'));
      const servicesCount = own.reduce((sum, b) => sum + b.services.length, 0);
      const staffProducts = ownMoney.filter((m) => m.kind === 'products');
      const productsAmount = sumMoney(staffProducts);
      const productsCount = staffProducts.reduce((sum, m) => sum + m.qty, 0);
      const bookedAmount = own.reduce((sum, b) => sum + b.total, 0) + productsAmount;
      const ownByDay = groupByDay(ownMoney, (m) => m.date);
      const workedMinutes = own.reduce((sum, b) => sum + b.durationMin, 0);
      const workedHours = Math.round((workedMinutes / 60) * 10) / 10;
      const futureBookingsAmount = all.filter((b) => b.staffId === s.id && b.start.slice(0, 10) >= futureFrom && q.locationIds.includes(b.locationId) && !b.deletedAt && b.status !== 'cancelled_by_client' && b.status !== 'cancelled_by_master' && b.status !== 'no_show').reduce((s2, b) => s2 + b.total, 0);
      return {
        staffId: s.id,
        staffName: s.name,
        revenue: servicesAmount + productsAmount,
        servicesAmount,
        servicesCount,
        productsAmount,
        productsCount,
        discount: 0,
        points: 0,
        memberships: 0,
        certificates: 0,
        clientAccounts: 0,
        futureBookingsAmount,
        workedHours,
        hourCost: workedHours > 0 ? dram((servicesAmount + productsAmount) / workedHours) : null,
        revenueSharePct: 0,
        bookedAmount,
        byDay: days.map((date) => ({ date, revenue: sumMoney(ownByDay.get(date) ?? []) })),
      } satisfies SalesByStaffRow;
    });

    const grandRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    for (const r of rows) r.revenueSharePct = grandRevenue > 0 ? Math.round((r.revenue / grandRevenue) * 1000) / 10 : 0;
    // Деньги без сотрудника (приход без визита) — в итог, чтобы «Итого» совпадало с дашбордом и кассой
    const unassigned = q.position ? 0 : sumMoney(money.filter((m) => !m.staffId || !staffList.some((s) => s.id === m.staffId)));

    return { rows, grandRevenue: grandRevenue + unassigned, unassignedRevenue: unassigned, grandBooked: rows.reduce((s, r) => s + (r.bookedAmount ?? 0), 0) };
  });
}

// ─────────────────────────── F-12-052: «По сотрудникам в динамике» ───────────────────────────

export interface SalesByStaffDynamicsQuery {
  businessId: Id;
  locationIds: Id[];
  /** Пусто — Отч10: мастер с наибольшей выручкой за окно (раньше открывался первый в списке — админ с нулями) */
  staffId?: Id;
  fromMonth: string;
  monthsCount?: number;
}

interface DynamicsProducts {
  amount: number;
  count: number;
}

function buildStaffDynamics(
  q: SalesByStaffDynamicsQuery,
  months: string[],
  bookings: Booking[],
  productsOf: (staffId: Id, month: string) => DynamicsProducts,
  /** Полученные деньги за услуги мастера за месяц (решение владельца 01.10.2026); нет — по цене записей (сервер) */
  servicesMoneyOf?: (staffId: Id, month: string) => number,
): StaffDynamicsData {
  const core = readCore();
  const arrived = bookings.filter((b) => q.locationIds.includes(b.locationId) && b.status === 'arrived' && !b.deletedAt && months.includes(b.start.slice(0, 7)));
  let staffId = q.staffId;
  if (!staffId) {
    const revenueByStaff = new Map<Id, number>();
    for (const b of arrived) revenueByStaff.set(b.staffId, (revenueByStaff.get(b.staffId) ?? 0) + b.total);
    const masters = core.staff.filter((s) => s.role === 'master' && q.locationIds.some((l) => s.locationIds.includes(l)) && s.status !== 'fired');
    staffId = [...masters].sort((a, b) => (revenueByStaff.get(b.id) ?? 0) - (revenueByStaff.get(a.id) ?? 0))[0]?.id ?? '';
  }
  const staff = core.staff.find((s) => s.id === staffId);
  const own = groupByDay(
    arrived.filter((b) => b.staffId === staffId),
    (b) => b.start.slice(0, 7),
  );
  const result: StaffDynamicsMonth[] = months.map((m) => {
    const monthBookings = own.get(m) ?? [];
    const servicesAmount = staffId && servicesMoneyOf ? servicesMoneyOf(staffId, m) : monthBookings.reduce((s, b) => s + b.total, 0);
    const servicesCount = monthBookings.reduce((s, b) => s + b.services.length, 0);
    const visits = new Set(monthBookings.map(visitKeyOf)).size;
    const products = staffId ? productsOf(staffId, m) : { amount: 0, count: 0 };
    return {
      month: m,
      servicesAmount,
      servicesCount,
      visits,
      avgReceipt: visits > 0 ? dram(servicesAmount / visits) : 0,
      productsAmount: products.amount,
      productsCount: products.count,
    };
  });
  return { staffId: staffId ?? '', staffName: staff?.name ?? '—', months: result };
}

export function getSalesByStaffDynamics(q: SalesByStaffDynamicsQuery): Promise<StaffDynamicsData> {
  const months = Array.from({ length: q.monthsCount ?? 6 }, (_, i) => dayjs(`${q.fromMonth}-01`).add(i, 'month').format('YYYY-MM'));
  const from = `${months[0]}-01`;
  const to = toISODate(dayjs(`${months[months.length - 1]}-01`).endOf('month'));
  if (isApiMode()) {
    // Сервер строит «По сотрудникам» за любой период (товары по мастеру в том числе) — по разу на месяц;
    // услуги и визиты считаем по записям, как на моке (визит = склейка записей, F-01-041)
    const bookingsP = listBookings({ businessId: q.businessId, from, to });
    const perMonthP = Promise.all(
      months.map((m) =>
        Server.getSalesByStaff({ businessId: q.businessId, locationIds: q.locationIds, range: { from: `${m}-01`, to: toISODate(dayjs(`${m}-01`).endOf('month')) } }),
      ),
    );
    return Promise.all([bookingsP, perMonthP]).then(([bookings, perMonth]) =>
      buildStaffDynamics(q, months, bookings, (staffId, month) => {
        const row = perMonth[months.indexOf(month)]?.rows.find((r) => r.staffId === staffId);
        return { amount: row?.productsAmount ?? 0, count: row?.productsCount ?? 0 };
      }),
    );
  }
  return request(async () => {
    const bookings = await listBookings({ businessId: q.businessId, includeDeleted: false, from, to });
    // Отч10: товары тоже только выбранных филиалов; решение владельца 01.10.2026 — деньги полученные (receivedMoneyMock)
    const allBookings = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const money = receivedMoneyMock(q.businessId, q.locationIds, from, to, new Map(allBookings.map((b) => [b.id, b] as const)));
    const ownIn = (staffId: Id, month: string, kind: ReceivedMoney['kind']) => money.filter((m) => m.kind === kind && m.staffId === staffId && m.date.slice(0, 7) === month);
    return buildStaffDynamics(
      q,
      months,
      bookings,
      (staffId, month) => {
        const own = ownIn(staffId, month, 'products');
        return { amount: sumMoney(own), count: own.reduce((s, m) => s + m.qty, 0) };
      },
      (staffId, month) => sumMoney(ownIn(staffId, month, 'services')),
    );
  });
}

// ─────────────────────────── F-12-053…054: «По услугам» ───────────────────────────

export interface SalesByServicesQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
  staffId?: Id;
  categoryId?: Id;
}

export function getSalesByServices(q: SalesByServicesQuery): Promise<SalesByServicesData> {
  if (isApiMode()) return Server.getSalesByServices(q);
  return request(async () => {
    const core = readCore();
    const stock = readArea('stock');
    const categoryById = new Map(core.serviceCategories.map((c) => [c.id, c] as const));
    const services = core.services.filter((sv) => sv.businessId === q.businessId && (!q.categoryId || sv.categoryId === q.categoryId));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    // Фильтр «Сотрудник» — по мастеру СТРОКИ (как сервер `by-service`): в визите на двух мастеров услуга второго
    // не попадает в отчёт первого. Раньше мок брал главного мастера записи, и цифры расходились с сервером.
    const scoped = all.filter((b) => q.locationIds.includes(b.locationId) && b.status === 'arrived' && inRange(b, q.range) && (!q.staffId || b.services.some((l) => l.staffId === q.staffId)));

    // F-12-054: «ЗП сотрудников» — доля дневного начисления мастера (движок зарплаты), пропорционально
    // выручке услуги в этот день у этого мастера (assumed: точный расчёт по каждой строке — территория payroll)
    // Чинка (design pass, reports): ключ короткого замыкания раньше не совпадал с ключом записи
    // (`${locationId}:${date}` vs `${locationId}:${date}:${staffId}`) — computeDay() вызывался заново на
    // КАЖДУЮ строку услуги вместо одного раза на день, и экран «По услугам» не догружался вовсе
    // (30 c+ на демо-бизнесе, «нет ничего важнее скорости» — DESIGN.md). Теперь дни считаются один раз,
    // а сами вызовы computeDay() идут ПАРАЛЛЕЛЬНО (Promise.all по уникальным дням) — иначе имитация
    // сетевой задержки в request() суммируется последовательно на каждый день диапазона.
    const payrollDayCache = new Map<string, number>();
    const uniqueDays = new Set<string>();
    for (const b of scoped) uniqueDays.add(`${b.locationId}:${b.start.slice(0, 10)}`);
    await Promise.all(
      [...uniqueDays].map(async (dayKey) => {
        const sep = dayKey.lastIndexOf(':');
        const locationId = dayKey.slice(0, sep) as Id;
        const date = dayKey.slice(sep + 1) as ISODate;
        try {
          const day = await computeDay(locationId, date);
          for (const r of day.staff) payrollDayCache.set(`${locationId}:${date}:${r.staffId}`, r.total);
        } catch {
          /* нет схем/настроек — 0 */
        }
      }),
    );
    function staffDayEarnings(staffId: Id, locationId: Id, date: ISODate): number {
      return payrollDayCache.get(`${locationId}:${date}:${staffId}`) ?? 0;
    }

    const cardByKey = new Map(stock.techCards.filter((c) => c.businessId === q.businessId).map((c) => [`${c.serviceId}:${c.staffId}`, c] as const));
    const goodById = new Map(stock.goods.map((g) => [g.id, g] as const));
    // costPriceAt перебирает все приходы склада — за год это тысячи вызовов; одна цена на товар и день
    const costCache = new Map<string, number>();
    const costAt = (goodId: Id, at: string): number => {
      const key = `${goodId}:${at.slice(0, 10)}`;
      let v = costCache.get(key);
      if (v === undefined) {
        v = costPriceAt(q.businessId, goodId, at);
        costCache.set(key, v);
      }
      return v;
    };

    const rowsMap = new Map<Id, SalesByServiceRow & { _byDayMap: Map<string, number> }>();
    for (const sv of services) {
      rowsMap.set(sv.id, {
        serviceId: sv.id,
        serviceName: sv.name.ru || sv.name.en || sv.id,
        categoryName: categoryById.get(sv.categoryId)?.name.ru || categoryById.get(sv.categoryId)?.name.en || '—',
        count: 0,
        discount: 0,
        points: 0,
        memberships: 0,
        certificates: 0,
        clientAccounts: 0,
        paidMoney: 0,
        consumablesCost: 0,
        payrollCost: 0,
        profit: 0,
        revenueSharePct: 0,
        upsoldCount: 0,
        upsoldMoney: 0,
        byDay: [],
        _byDayMap: new Map(),
      });
    }

    for (const b of scoped) {
      const dayTotal = b.services.reduce((s, l) => s + l.price * Math.max(1, l.qty || 1), 0) || 1;
      for (const line of b.services) {
        if (q.staffId && line.staffId !== q.staffId) continue;
        const row = rowsMap.get(line.serviceId);
        if (!row) continue;
        const qty = Math.max(1, line.qty || 1);
        const lineTotal = line.price * qty;
        row.count += qty;
        row.paidMoney += lineTotal;
        // ⭐ «Допродано» (решение владельца 01.10.2026): строка добавлена к визиту как сопутствующая (upsellOf) —
        // тот же визит «пришёл», период и мастер, что у остальных колонок; уже входит в count/paidMoney
        if (line.upsellOf) {
          row.upsoldCount += qty;
          row.upsoldMoney += lineTotal;
        }
        row._byDayMap.set(b.start.slice(0, 10), (row._byDayMap.get(b.start.slice(0, 10)) ?? 0) + lineTotal);
        const card = cardByKey.get(`${line.serviceId}:${line.staffId}`);
        if (card) {
          // Отч2: себестоимость — за ЕДИНИЦУ ПРОДАЖИ (флакон), а техкарта списывает ЕДИНИЦЫ СПИСАНИЯ (мл):
          // делим на «Равно» товара (unitRatio), иначе маникюр «съедал» 255 000 расходников при выручке 150 000
          for (const l of card.lines) {
            const ratio = goodById.get(l.goodId)?.unitRatio || 1;
            row.consumablesCost += (costAt(l.goodId, b.start) * l.qtyWriteoff * qty) / ratio;
          }
        }
        const dayEarn = staffDayEarnings(line.staffId, b.locationId, b.start.slice(0, 10));
        row.payrollCost += dayEarn * (lineTotal / dayTotal);
      }
    }

    const rows = [...rowsMap.values()]
      .filter((r) => r.count > 0)
      .map((r) => {
        const consumablesCost = dram(r.consumablesCost);
        const payrollCost = dram(r.payrollCost);
        const { _byDayMap: _unused, ...rest } = r;
        void _unused;
        return {
          ...rest,
          consumablesCost,
          payrollCost,
          profit: dram(r.paidMoney) - consumablesCost - payrollCost,
          byDay: [...r._byDayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, paidMoney]) => ({ date, paidMoney })),
        } satisfies SalesByServiceRow;
      });

    const grandPaidMoney = rows.reduce((s, r) => s + r.paidMoney, 0);
    for (const r of rows) r.revenueSharePct = grandPaidMoney > 0 ? Math.round((r.paidMoney / grandPaidMoney) * 1000) / 10 : 0;

    return { rows, grandPaidMoney };
  });
}

// ─────────────────────────── F-12-055…056: «По клиентам» ───────────────────────────

export interface SalesByClientsQuery {
  businessId: Id;
  locationIds: Id[];
  range: ReportDateRange;
}

export function getSalesByClients(q: SalesByClientsQuery): Promise<SalesByClientsData> {
  if (isApiMode()) return Server.getSalesByClients(q);
  return request(async () => {
    const core = readCore();
    const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const scoped = all.filter((b) => q.locationIds.includes(b.locationId) && b.status === 'arrived' && inRange(b, q.range) && !!b.clientId);
    // Решение владельца 01.10.2026: выручка клиента — полученные от него деньги (receivedMoneyMock); визиты — «пришёл»
    const money = receivedMoneyMock(q.businessId, q.locationIds, q.range.from, q.range.to, new Map(all.map((b) => [b.id, b] as const)));

    const byClient = new Map<Id, { revenue: number; visits: Set<string> }>();
    for (const b of scoped) {
      const acc = byClient.get(b.clientId!) ?? { revenue: 0, visits: new Set<string>() };
      acc.visits.add(visitKeyOf(b));
      byClient.set(b.clientId!, acc);
    }
    for (const m of money) {
      if (!m.clientId) continue;
      const acc = byClient.get(m.clientId) ?? { revenue: 0, visits: new Set<string>() };
      acc.revenue += m.amount;
      byClient.set(m.clientId, acc);
    }

    const grandRevenue = [...byClient.values()].reduce((s, v) => s + v.revenue, 0);
    const rows: SalesByClientRow[] = [...byClient.entries()].map(([clientId, v]) => {
      const c = clientById.get(clientId);
      return {
        clientId,
        // F-12-117: 1:1 — платежи удалённого клиента остаются под его именем во «По клиентам»
        clientName: c?.name ?? '—',
        clientPhone: c?.phone,
        clientEmail: c?.email,
        revenue: v.revenue,
        revenueSharePct: grandRevenue > 0 ? Math.round((v.revenue / grandRevenue) * 1000) / 10 : 0,
        avgReceipt: v.visits.size > 0 ? dram(v.revenue / v.visits.size) : 0,
        visits: v.visits.size,
        clientDeleted: Boolean(c?.deletedAt),
      };
    });
    return { rows: rows.sort((a, b) => b.revenue - a.revenue), grandRevenue };
  });
}

export interface ClientVisitExportRow {
  date: string;
  services: string;
  staffName: string;
  amount: number;
}

/** F-12-056: выгрузка «По клиентам» с историей визитов или без — данные для CSV собираются здесь, файл строит экран */
export function getClientVisitsForExport(q: { businessId: Id; clientId: Id; range: ReportDateRange }): Promise<ClientVisitExportRow[]> {
  if (isApiMode()) return Server.getClientVisitsForExport(q);
  return request(async () => {
    const core = readCore();
    const staffById = new Map(core.staff.map((s) => [s.id, s] as const));
    const serviceById = new Map(core.services.map((s) => [s.id, s] as const));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    return all
      .filter((b) => b.clientId === q.clientId && b.status === 'arrived' && inRange(b, q.range))
      .map((b) => ({
        date: b.start,
        services: b.services.map((l) => serviceById.get(l.serviceId)?.name.ru ?? '').join(', '),
        staffName: staffById.get(b.staffId)?.name ?? '',
        amount: b.total,
      }));
  });
}

// ─────────────────────────── F-12-074…080: «Операции с данными» ───────────────────────────

export function listDataExports(businessId: Id, filters: DataExportFilters = {}): Promise<DataExportLogEntry[]> {
  if (isApiMode()) return Server.listDataExports(businessId, filters);
  return request(() => {
    let rows = readArea('reports').exportLogByBusiness[businessId] ?? [];
    if (filters.staffId) rows = rows.filter((r) => r.staffId === filters.staffId);
    if (filters.type) rows = rows.filter((r) => r.type === filters.type);
    if (filters.operation) rows = rows.filter((r) => r.operation === filters.operation);
    return [...rows].sort((a, b) => b.at.localeCompare(a.at));
  });
}

/** F-12-074/078/079/080: каждая выгрузка отчёта пишется сюда — вызывайте из кнопки «Выгрузить в Excel» */
export function logDataExport(input: { businessId: Id; staffId: Id; staffName: string; type: DataExportType; operation: DataExportOperationType; fileName: string; rowCount: number }): Promise<DataExportLogEntry> {
  if (isApiMode()) return Server.logDataExport(input);
  return request(() => {
    const entry: DataExportLogEntry = { id: `exp_${Date.now()}_${Math.round(Math.random() * 1e6)}`, at: new Date().toISOString(), ...input };
    mutateArea('reports', (s) => {
      const list = s.exportLogByBusiness[input.businessId] ?? (s.exportLogByBusiness[input.businessId] = []);
      list.push(entry);
    });
    return entry;
  });
}

// ─────────────────────────── b03: F-12-084…089 — 25 галочек «Отчёты» ───────────────────────────

/** F-12-084…089: см. комментарий у ReportsStaffPermissions — редактор карточки сотрудника не наш хост (запрос заведён) */
export function getReportsPermissions(businessId: Id, staffId: Id): Promise<ReportsStaffPermissions> {
  if (isApiMode()) return Server.getReportsPermissions(businessId, staffId);
  return request(() => {
    const stored = readArea('reports').reportsPermissionsByStaff[staffId];
    if (stored) return stored;
    const actor = currentActor();
    const isSelf = actor.staffId === staffId;
    const edit = isSelf ? actor.permissions.has('reports.view') && actor.permissions.has('staff.manage') : true;
    const view = isSelf ? actor.permissions.has('reports.view') : true;
    return defaultReportsPermissions({ edit, view });
  });
}

export function setReportsPermissions(businessId: Id, staffId: Id, patch: Partial<ReportsStaffPermissions>): Promise<ReportsStaffPermissions> {
  if (isApiMode()) return Server.setReportsPermissions(businessId, staffId, patch);
  return request(() => {
    assertCan('staff.manage');
    let updated: ReportsStaffPermissions | undefined;
    mutateArea('reports', (s) => {
      const current = s.reportsPermissionsByStaff[staffId] ?? defaultReportsPermissions({ edit: true, view: true });
      updated = { ...current, ...patch };
      s.reportsPermissionsByStaff[staffId] = updated;
    });
    return updated!;
  });
}

// ─────────────────────────── b03: F-12-057 «Остатки на складах» / F-12-120 себестоимость на дату ───────────────────────────

/**
 * F-12-126: отчёты за прошлый период должны видеть и АРХИВНЫЕ товары/категории (проданы и списаны, пока
 * ещё не были в архиве, или архивированы позже) — иначе прошлые продажи «теряют» строку молча. Только
 * getStockOrderReport (F-12-058, «что докупить сейчас») сам исключает архивные ниже.
 */
function stockGoodsAndCategories(businessId: Id, locationId: Id) {
  const stock = readArea('stock');
  const goods = stock.goods.filter((g) => g.businessId === businessId && g.locationId === locationId);
  const categories = stock.categories.filter((c) => c.locationId === locationId);
  return { stock, goods, categories };
}

function inCategorySubtree(categories: { id: Id; parentId?: Id }[], rootId: Id, id: Id): boolean {
  if (id === rootId) return true;
  const cat = categories.find((c) => c.id === id);
  if (!cat?.parentId) return false;
  return inCategorySubtree(categories, rootId, cat.parentId);
}

function categoryNameOf(categories: { id: Id; name: string }[], categoryId: Id): string {
  return categories.find((c) => c.id === categoryId)?.name ?? '';
}

/** Остаток товара на дату (включительно), по складу или по всем — F-12-057/120: перемещения нейтральны при warehouseId=undefined */
function qtyAtDate(ops: { businessId: Id; date: string; type: string; warehouseId: Id; toWarehouseId?: Id; lines: { goodId: Id; qtySale: number }[] }[], goodId: Id, atDate: ISODate, warehouseId?: Id): number {
  let qty = 0;
  for (const op of ops) {
    if (op.date.slice(0, 10) > atDate) continue;
    for (const line of op.lines) {
      if (line.goodId !== goodId) continue;
      if (!warehouseId || op.warehouseId === warehouseId) qty += line.qtySale;
      if (op.type === 'move' && op.toWarehouseId && (!warehouseId || op.toWarehouseId === warehouseId)) qty += Math.abs(line.qtySale);
    }
  }
  return qty;
}

export interface StockBalanceQuery {
  businessId: Id;
  locationId: Id;
  filters: StockBalanceFilters;
  /** F-12-057 (проверка 1): без права «Просмотр себестоимости» себестоимость/наценка/сумма скрыты целиком */
  canViewCost: boolean;
  /** F-12-088 (проверка 1): сотрудник видит остаток только по своим складам (StockStaffPermissions.warehouseAccess) — undefined = все склады */
  allowedWarehouseIds?: Id[];
}

export function getStockBalanceReport(q: StockBalanceQuery): Promise<StockBalanceRow[]> {
  if (isApiMode()) return Server.getStockBalanceReport(q);
  return request(() => {
    const { stock, goods, categories } = stockGoodsAndCategories(q.businessId, q.locationId);
    let ops = stock.operations.filter((o) => o.businessId === q.businessId);
    if (q.allowedWarehouseIds) {
      const allowed = new Set(q.allowedWarehouseIds);
      ops = ops.filter((o) => allowed.has(o.warehouseId) || (o.toWarehouseId && allowed.has(o.toWarehouseId)));
    }
    let items = goods;
    if (q.filters.categoryId) items = items.filter((g) => inCategorySubtree(categories, q.filters.categoryId!, g.categoryId));
    if (q.filters.search?.trim()) {
      const s = q.filters.search.trim().toLowerCase();
      items = items.filter((g) => g.name.toLowerCase().includes(s) || g.sku?.toLowerCase().includes(s) || g.barcode?.includes(s));
    }
    let rows: StockBalanceRow[] = items.map((g) => {
      const qtySale = Math.round(qtyAtDate(ops, g.id, q.filters.atDate, q.filters.warehouseId) * 100) / 100;
      // F-12-120: себестоимость на дату строки — последний приход НА эту дату, не сегодняшняя (costPriceAt)
      const cost = costPriceAt(q.businessId, g.id, q.filters.atDate);
      const markup = g.salePrice - cost;
      const markupPct = cost > 0 ? Math.round((markup / cost) * 1000) / 10 : 0;
      return {
        goodId: g.id,
        sku: g.sku,
        goodName: g.name,
        categoryName: categoryNameOf(categories, g.categoryId),
        qtySale,
        saleUnit: g.saleUnit,
        qtyWriteoff: Math.round(qtySale * g.unitRatio * 100) / 100,
        writeoffUnit: g.writeoffUnit,
        costPrice: q.canViewCost ? cost : undefined,
        markup: q.canViewCost ? dram(markup) : undefined,
        markupPct: q.canViewCost ? markupPct : undefined,
        price: g.salePrice,
        totalCost: q.canViewCost ? dram(cost * qtySale) : undefined,
        totalValue: dram(g.salePrice * qtySale),
      } satisfies StockBalanceRow;
    });
    if (q.filters.onlyCritical) rows = rows.filter((r) => { const g = items.find((x) => x.id === r.goodId)!; return g.criticalStock > 0 && r.qtySale <= g.criticalStock; });
    if (q.filters.zeroFilter === 'onlyZero') rows = rows.filter((r) => r.qtySale === 0);
    if (q.filters.zeroFilter === 'withoutZero') rows = rows.filter((r) => r.qtySale !== 0);
    return rows;
  });
}

// ─────────────────────────── b03: F-12-058 «Заказ товаров» ───────────────────────────

export function getStockOrderReport(q: { businessId: Id; locationId: Id; categoryId?: Id; onlyCritical?: boolean }): Promise<StockOrderRow[]> {
  if (isApiMode()) return Server.getStockOrderReport(q);
  return request(() => {
    const { stock, goods, categories } = stockGoodsAndCategories(q.businessId, q.locationId);
    const ops = stock.operations.filter((o) => o.businessId === q.businessId);
    const t = today();
    // F-12-058 (проверка 1): в список попадают ВСЕ товары ниже желаемого остатка, не только критичные;
    // F-12-126: архивный товар не заказывают — исключаем здесь (в отличие от исторических отчётов выше)
    let rows: StockOrderRow[] = goods
      .filter((g) => !g.archived && g.desiredStock > 0)
      .map((g) => ({ g, stockQty: qtyAtDate(ops, g.id, t, undefined) }))
      .filter(({ g, stockQty }) => stockQty < g.desiredStock)
      .map(
        ({ g, stockQty }): StockOrderRow => ({
          goodId: g.id,
          sku: g.sku,
          goodName: g.name,
          categoryName: categoryNameOf(categories, g.categoryId),
          stock: Math.round(stockQty * 100) / 100,
          criticalStock: g.criticalStock,
          desiredStock: g.desiredStock,
          shortage: Math.round((g.desiredStock - stockQty) * 100) / 100,
          unit: g.saleUnit,
        }),
      );
    if (q.categoryId) {
      rows = rows.filter((r) => {
        const g = goods.find((x) => x.id === r.goodId)!;
        return inCategorySubtree(categories, q.categoryId!, g.categoryId);
      });
    }
    if (q.onlyCritical) rows = rows.filter((r) => r.criticalStock > 0 && r.stock <= r.criticalStock);
    return rows;
  });
}

// ─────────────────────────── b03: F-12-059 «Анализ продаж товаров» ───────────────────────────

export function getStockSalesAnalysis(q: { businessId: Id; locationId: Id; range: ReportDateRange; categoryId?: Id; staffId?: Id }): Promise<{ rows: StockSalesAnalysisRow[]; totalCost: number; totalMarkup: number }> {
  if (isApiMode()) return Server.getStockSalesAnalysis(q);
  return request(() => {
    const { stock, goods, categories } = stockGoodsAndCategories(q.businessId, q.locationId);
    const sales = stock.operations.filter(
      // решение владельца 01.10.2026: только оплаченные деньгами продажи — как «Товары» в «Основных показателях»
      (o) => o.businessId === q.businessId && o.locationId === q.locationId && o.type === 'sale' && o.paid && o.paymentMethod !== 'loyalty' && !o.cancelledAt && o.date.slice(0, 10) >= q.range.from && o.date.slice(0, 10) <= q.range.to && (!q.staffId || o.staffId === q.staffId),
    );
    const byGood = new Map<Id, { qty: number; costTotal: number; totalValue: number }>();
    for (const op of sales) {
      for (const line of op.lines) {
        const good = goods.find((g) => g.id === line.goodId);
        if (!good) continue;
        if (q.categoryId && !inCategorySubtree(categories, q.categoryId, good.categoryId)) continue;
        const qty = Math.abs(line.qtySale);
        const acc = byGood.get(line.goodId) ?? { qty: 0, costTotal: 0, totalValue: 0 };
        acc.qty += qty;
        // F-12-059 (проверка 2): «Себестоимость» — сумма за ВСЕ проданные единицы строки, не за одну
        acc.costTotal += Math.abs(line.costTotal);
        acc.totalValue += qty * line.unitPrice;
        byGood.set(line.goodId, acc);
      }
    }
    const rows: StockSalesAnalysisRow[] = [...byGood.entries()]
      .map(([goodId, acc]): StockSalesAnalysisRow => {
        const good = goods.find((g) => g.id === goodId)!;
        const markup = acc.totalValue - acc.costTotal;
        return {
          goodId,
          sku: good.sku,
          barcode: good.barcode,
          goodName: good.name,
          categoryName: categoryNameOf(categories, good.categoryId),
          qty: acc.qty,
          costTotal: dram(acc.costTotal),
          markup: dram(markup),
          markupPct: acc.costTotal > 0 ? Math.round((markup / acc.costTotal) * 1000) / 10 : 0,
          totalValue: dram(acc.totalValue),
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);
    return { rows, totalCost: rows.reduce((s, r) => s + r.costTotal, 0), totalMarkup: rows.reduce((s, r) => s + r.markup, 0) };
  });
}

// ─────────────────────────── b03: F-12-060 «Анализ расхода материалов» ───────────────────────────

export function getStockUsageAnalysis(q: { businessId: Id; locationId: Id; range: ReportDateRange; categoryId?: Id }): Promise<StockUsageAnalysisRow[]> {
  if (isApiMode()) return Server.getStockUsageAnalysis(q);
  return request(async () => {
    const { stock, goods, categories } = stockGoodsAndCategories(q.businessId, q.locationId);
    const actualOps = stock.operations.filter(
      (o) => o.businessId === q.businessId && o.locationId === q.locationId && o.type === 'writeoffService' && o.date.slice(0, 10) >= q.range.from && o.date.slice(0, 10) <= q.range.to,
    );
    const actualByGood = new Map<Id, { qty: number; cost: number }>();
    for (const op of actualOps) {
      for (const line of op.lines) {
        const acc = actualByGood.get(line.goodId) ?? { qty: 0, cost: 0 };
        acc.qty += Math.abs(line.qtySale);
        acc.cost += Math.abs(line.costTotal);
        actualByGood.set(line.goodId, acc);
      }
    }
    // F-12-060 (проверка 1): расчёт = число оказанных за период услуг с техкартами × норма
    const bookings = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const arrived = bookings.filter((b) => b.locationId === q.locationId && b.status === 'arrived' && inRange(b, q.range));
    const calcByGood = new Map<Id, { qty: number; cost: number }>();
    for (const b of arrived) {
      for (const line of b.services) {
        const cards = stock.techCards.filter((tc) => tc.businessId === q.businessId && tc.serviceId === line.serviceId && tc.staffId === b.staffId);
        for (const tc of cards) {
          for (const tl of tc.lines) {
            const good = goods.find((g) => g.id === tl.goodId);
            if (!good) continue;
            const qtyInSaleUnits = tl.qtyWriteoff / (good.unitRatio || 1);
            const cost = costPriceAt(q.businessId, tl.goodId, b.start.slice(0, 10)) * qtyInSaleUnits;
            const acc = calcByGood.get(tl.goodId) ?? { qty: 0, cost: 0 };
            acc.qty += qtyInSaleUnits;
            acc.cost += cost;
            calcByGood.set(tl.goodId, acc);
          }
        }
      }
    }
    const goodIds = new Set<Id>([...actualByGood.keys(), ...calcByGood.keys()]);
    let rows: StockUsageAnalysisRow[] = [...goodIds].map((goodId): StockUsageAnalysisRow => {
      const good = goods.find((g) => g.id === goodId);
      const actual = actualByGood.get(goodId) ?? { qty: 0, cost: 0 };
      const calc = calcByGood.get(goodId) ?? { qty: 0, cost: 0 };
      return {
        goodId,
        sku: good?.sku,
        barcode: good?.barcode,
        categoryName: good ? categoryNameOf(categories, good.categoryId) : '',
        goodName: good?.name ?? '',
        actualQty: Math.round(actual.qty * 100) / 100,
        actualCost: dram(actual.cost),
        calcQty: Math.round(calc.qty * 100) / 100,
        calcCost: dram(calc.cost),
        diffQty: Math.round((actual.qty - calc.qty) * 100) / 100,
        diffCost: dram(actual.cost) - dram(calc.cost),
      };
    });
    if (q.categoryId) {
      rows = rows.filter((r) => {
        const g = goods.find((x) => x.id === r.goodId);
        return g && inCategorySubtree(categories, q.categoryId!, g.categoryId);
      });
    }
    return rows;
  });
}

// ─────────────────────────── b03: F-12-061 «Анализ списания товаров» ───────────────────────────

export function getStockWriteOffReport(q: { businessId: Id; locationId: Id; filters: StockWriteOffFilters }): Promise<{ rows: StockWriteOffRow[]; totalOutValue: number }> {
  if (isApiMode()) return Server.getStockWriteOffReport(q);
  return request(() => {
    const { stock, goods, categories } = stockGoodsAndCategories(q.businessId, q.locationId);
    const { range, warehouseId, categoryId, unitMode = 'sale', countMoves = false } = q.filters;
    const ops = stock.operations.filter((o) => o.businessId === q.businessId && o.locationId === q.locationId);
    let items = goods;
    if (categoryId) items = items.filter((g) => inCategorySubtree(categories, categoryId, g.categoryId));
    const rows: StockWriteOffRow[] = items.map((g): StockWriteOffRow => {
      const unitFactor = unitMode === 'writeoff' ? g.unitRatio || 1 : 1;
      const startQty = qtyAtDate(ops, g.id, addDays(range.from, -1), warehouseId);
      const endQty = qtyAtDate(ops, g.id, range.to, warehouseId);
      let inQty = 0;
      let inValue = 0;
      let outQty = 0;
      let outValue = 0;
      for (const op of ops) {
        const d = op.date.slice(0, 10);
        if (d < range.from || d > range.to) continue;
        for (const line of op.lines) {
          if (line.goodId !== g.id) continue;
          const qty = Math.abs(line.qtySale);
          const value = Math.abs(line.costTotal);
          if (op.type === 'income') {
            if (!warehouseId || op.warehouseId === warehouseId) {
              inQty += qty;
              inValue += value;
            }
          } else if (op.type === 'move') {
            if (!countMoves || !warehouseId) continue;
            if (op.toWarehouseId === warehouseId) {
              inQty += qty;
              inValue += value;
            } else if (op.warehouseId === warehouseId) {
              outQty += qty;
              outValue += value;
            }
          } else if (!warehouseId || op.warehouseId === warehouseId) {
            outQty += qty;
            outValue += value;
          }
        }
      }
      return {
        goodId: g.id,
        sku: g.sku,
        barcode: g.barcode,
        goodName: g.name,
        startQty: Math.round(startQty * unitFactor * 100) / 100,
        startValue: dram(costPriceAt(q.businessId, g.id, addDays(range.from, -1)) * startQty),
        inQty: Math.round(inQty * unitFactor * 100) / 100,
        inValue: dram(inValue),
        outQty: Math.round(outQty * unitFactor * 100) / 100,
        outValue: dram(outValue),
        endQty: Math.round(endQty * unitFactor * 100) / 100,
        endValue: dram(costPriceAt(q.businessId, g.id, range.to) * endQty),
      };
    });
    return { rows, totalOutValue: rows.reduce((s, r) => s + r.outValue, 0) };
  });
}

// ─────────────────────────── b03: F-12-062 «Анализ оборачиваемости» ───────────────────────────

/** F-12-062 (assumed): точные даты «З1…Зn» справка не раскрывает — берём еженедельные точки между началом и концом */
function sampleWeekly(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [from];
  let cur = from;
  while (cur < to) {
    cur = addDays(cur, 7);
    if (cur >= to) break;
    out.push(cur);
  }
  out.push(to);
  return out;
}

export function getStockTurnoverReport(q: { businessId: Id; locationId: Id; range: ReportDateRange; categoryId?: Id; warehouseId?: Id }): Promise<StockTurnoverRow[]> {
  if (isApiMode()) return Server.getStockTurnoverReport(q);
  return request(() => {
    const { goods, categories } = stockGoodsAndCategories(q.businessId, q.locationId);
    const stock = readArea('stock');
    const ops = stock.operations.filter((o) => o.businessId === q.businessId && o.locationId === q.locationId);
    let items = goods;
    if (q.categoryId) items = items.filter((g) => inCategorySubtree(categories, q.categoryId!, g.categoryId));
    const periodDays = Math.max(1, eachDay(q.range.from, q.range.to).length);
    const sampleDates = sampleWeekly(q.range.from, q.range.to);
    const rows: StockTurnoverRow[] = items.map((g): StockTurnoverRow => {
      const startQty = qtyAtDate(ops, g.id, addDays(q.range.from, -1), q.warehouseId);
      const endQty = qtyAtDate(ops, g.id, q.range.to, q.warehouseId);
      const qtyIn = ops
        .filter((o) => o.type === 'income' && o.date.slice(0, 10) >= q.range.from && o.date.slice(0, 10) <= q.range.to && (!q.warehouseId || o.warehouseId === q.warehouseId))
        .flatMap((o) => o.lines)
        .filter((l) => l.goodId === g.id)
        .reduce((s, l) => s + l.qtySale, 0);
      const soldQty = ops
        .filter(
          (o) =>
            (o.type === 'sale' || o.type === 'writeoffService' || o.type === 'writeoffProduct') &&
            o.date.slice(0, 10) >= q.range.from &&
            o.date.slice(0, 10) <= q.range.to &&
            (!q.warehouseId || o.warehouseId === q.warehouseId),
        )
        .flatMap((o) => o.lines)
        .filter((l) => l.goodId === g.id)
        .reduce((s, l) => s + Math.abs(l.qtySale), 0);
      const samples = sampleDates.map((d) => qtyAtDate(ops, g.id, d, q.warehouseId));
      let avgStock: number;
      if (samples.length >= 2) {
        const inner = samples.slice(1, -1).reduce((s, z) => s + z, 0);
        avgStock = (samples[0] / 2 + inner + samples[samples.length - 1] / 2) / (samples.length - 1);
      } else {
        avgStock = (startQty + endQty) / 2;
      }
      // F-12-062 (баг Altegio, не повторять — F-12-113): отрицательный/нулевой запас ⇒ дни не считаем, а не «−N дней»
      const safeAvg = avgStock > 0 ? avgStock : 0;
      const turnoverTimes = safeAvg > 0 && soldQty > 0 ? soldQty / safeAvg : null;
      const turnoverDays = turnoverTimes && turnoverTimes > 0 ? Math.round(periodDays / turnoverTimes) : null;
      const avgDailySale = periodDays > 0 ? soldQty / periodDays : 0;
      const stockLevelDays = avgDailySale > 0 && endQty > 0 ? Math.round(endQty / avgDailySale) : null;
      return {
        goodId: g.id,
        sku: g.sku,
        goodName: g.name,
        qtyIn: Math.round(qtyIn * 100) / 100,
        startQty: Math.round(startQty * 100) / 100,
        endQty: Math.round(endQty * 100) / 100,
        soldQty: Math.round(soldQty * 100) / 100,
        avgStock: Math.round(safeAvg * 100) / 100,
        turnoverDays,
        turnoverTimes: turnoverTimes !== null ? Math.round(turnoverTimes * 10) / 10 : null,
        stockLevelDays,
      };
    });
    return rows;
  });
}

// ─────────────────────────── b03: F-12-064…067 «Акции» ───────────────────────────

export function getPromotionsReport(q: { businessId: Id; locationIds: Id[]; filters: PromotionsFilters }): Promise<PromotionsReportData> {
  if (isApiMode()) return Server.getPromotionsReport(q);
  return request(async () => {
    const promotions = await listPromotions(q.businessId);
    const promo = promotions.find((p) => p.id === q.filters.promotionId);
    const core = readCore();
    const loyalty = readArea('loyalty');
    const matchingCards = promo ? loyalty.cards.filter((c) => c.businessId === q.businessId && promo.cardTypeIds.includes(c.cardTypeId)) : [];
    const cardByClient = new Map(matchingCards.map((c) => [c.clientId, c] as const));
    const cardClientIds = new Set(matchingCards.map((c) => c.clientId));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const clientVisits = all.filter((b) => q.locationIds.includes(b.locationId) && b.status === 'arrived' && b.clientId && cardClientIds.has(b.clientId));
    const inPeriod = clientVisits.filter((b) => inRange(b, q.filters.range));

    // F-12-065: график считает ВИЗИТЫ (не уникальных клиентов) — F-12-065 готово-когда
    const byDay = eachDay(q.filters.range.from, q.filters.range.to).map((date) => ({ date, visits: inPeriod.filter((b) => b.start.slice(0, 10) === date).length }));

    let newCount = 0;
    let returningCount = 0;
    let cameByPromotion = 0;
    let cameAgain = 0;
    for (const clientId of cardClientIds) {
      const card = cardByClient.get(clientId)!;
      const visitsAfterCard = all
        .filter((b) => b.clientId === clientId && b.status === 'arrived' && b.start >= card.createdAt)
        .sort((a, b) => a.start.localeCompare(b.start));
      const firstEverVisit = all.filter((b) => b.clientId === clientId && b.status === 'arrived').sort((a, b) => a.start.localeCompare(b.start))[0];
      const isNewClient = Boolean(firstEverVisit && firstEverVisit.start >= card.createdAt);
      if (visitsAfterCard.some((b) => inRange(b, q.filters.range))) {
        if (isNewClient) newCount++;
        else returningCount++;
        cameByPromotion++;
      }
      if (visitsAfterCard.length > 1) cameAgain++;
    }
    const notReturned = Math.max(cardClientIds.size - cameAgain, 0);

    const revenue = inPeriod.reduce((s, b) => s + b.total, 0);
    const repeatRevenue = inPeriod
      .filter((b) => {
        const card = cardByClient.get(b.clientId!);
        return card && b.start > card.createdAt;
      })
      .reduce((s, b) => s + b.total, 0);

    const staffMap = new Map<Id, { clients: Set<Id>; returned: Set<Id> }>();
    for (const b of clientVisits) {
      if (!b.clientId) continue;
      const acc = staffMap.get(b.staffId) ?? { clients: new Set<Id>(), returned: new Set<Id>() };
      acc.clients.add(b.clientId);
      const visitsForClientWithStaff = clientVisits.filter((x) => x.clientId === b.clientId && x.staffId === b.staffId);
      if (visitsForClientWithStaff.length > 1) acc.returned.add(b.clientId);
      staffMap.set(b.staffId, acc);
    }
    const staff = [...staffMap.entries()].map(([staffId, acc]) => ({
      staffId,
      staffName: core.staff.find((s) => s.id === staffId)?.name ?? '',
      clientsServed: acc.clients.size,
      clientsReturned: acc.returned.size,
    }));

    return {
      promotionName: promo?.name ?? '',
      clients: { newCount, returningCount, cameByPromotion, cameAgain, notReturned, byDay },
      revenue: dram(revenue),
      repeatRevenue: dram(repeatRevenue),
      staff,
    } satisfies PromotionsReportData;
  });
}

/** F-12-064: акции доступны отчёту только нефакопительных видов (discountFixed/cashbackFixed…) */
export function listReportablePromotions(businessId: Id) {
  return request(async () => (await listPromotions(businessId)).filter((p) => !ACCUMULATING_KINDS.includes(p.kind)));
}

export function listAccumulatingPromotions(businessId: Id) {
  return request(async () => (await listPromotions(businessId)).filter((p) => ACCUMULATING_KINDS.includes(p.kind)));
}

/** F-12-067: выгрузка «Не вернулись после акции» — семь колонок 1:1; право на телефоны/email проверяет экран */
export function getPromotionNotReturned(q: { businessId: Id; promotionId: Id }): Promise<PromotionNotReturnedRow[]> {
  if (isApiMode()) return Server.getPromotionNotReturned(q);
  return request(async () => {
    const promo = (await listPromotions(q.businessId)).find((p) => p.id === q.promotionId);
    if (!promo) return [];
    const core = readCore();
    const loyalty = readArea('loyalty');
    const cards = loyalty.cards.filter((c) => c.businessId === q.businessId && promo.cardTypeIds.includes(c.cardTypeId));
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const rows: PromotionNotReturnedRow[] = [];
    for (const card of cards) {
      const client = core.clients.find((c) => c.id === card.clientId);
      if (!client) continue;
      const visits = all.filter((b) => b.clientId === card.clientId && b.status === 'arrived').sort((a, b) => a.start.localeCompare(b.start));
      const afterCard = visits.filter((b) => b.start >= card.createdAt);
      if (afterCard.length > 1) continue;
      rows.push({
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        registeredAt: client.createdAt.slice(0, 10),
        lastVisitAt: visits[visits.length - 1]?.start.slice(0, 10),
        paidByPromotion: afterCard.reduce((s, b) => s + b.total, 0),
        accountBalance: card.balance,
      });
    }
    return rows;
  });
}

// ─────────────────────────── b03: F-12-068…069 «Отзывы» (⭐ звёздочка вместо оценки) ───────────────────────────

export function getReviewsReport(
  q: { businessId: Id; filters: ReviewsFilters },
): Promise<{ rows: ReviewRow[]; starSummary: StaffStarSummaryRow[]; ratingSummary: StaffRatingSummaryRow[] }> {
  if (isApiMode()) return Server.getReviewsReport(q);
  return request(() => {
    const core = readCore();
    const client = readArea('client');
    const inRangeDate = (at: string) => at.slice(0, 10) >= q.filters.range.from && at.slice(0, 10) <= q.filters.range.to;
    const rows: ReviewRow[] = [];
    const subject = q.filters.subject;
    if (subject === 'all' || subject === 'company') {
      for (const r of client.locationReviews.filter((r) => r.businessId === q.businessId && inRangeDate(r.createdAt))) {
        rows.push({ id: r.id, kind: 'company', text: r.text, createdAt: r.createdAt });
      }
    }
    const staffFilter = subject !== 'all' && subject !== 'company' ? subject : undefined;
    if (subject === 'all' || staffFilter) {
      for (const r of client.starRatings.filter((r) => (!staffFilter || r.staffId === staffFilter) && inRangeDate(r.createdAt))) {
        const staff = core.staff.find((s) => s.id === r.staffId && s.businessId === q.businessId);
        if (!staff) continue;
        rows.push({ id: r.id, kind: 'staffStar', staffName: staff.name, createdAt: r.createdAt });
      }
      // В-24: оценка 1–5 + текст — вместо звёздочки, когда online.reviewMode бизнеса = 'text'
      for (const r of client.staffReviews.filter((r) => r.businessId === q.businessId && (!staffFilter || r.staffId === staffFilter) && inRangeDate(r.createdAt))) {
        const staff = core.staff.find((s) => s.id === r.staffId && s.businessId === q.businessId);
        if (!staff) continue;
        rows.push({ id: r.id, kind: 'staffReview', staffName: staff.name, text: r.text, rating: r.rating, hiddenByBusiness: r.hiddenByBusiness, createdAt: r.createdAt });
      }
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const starSummary = core.staff
      .filter((s) => s.businessId === q.businessId)
      .map((s) => ({ staffId: s.id, staffName: s.name, starsCount: client.starRatings.filter((r) => r.staffId === s.id && inRangeDate(r.createdAt)).length }))
      .filter((r) => r.starsCount > 0)
      .sort((a, b) => b.starsCount - a.starsCount);
    const ratingSummary = core.staff
      .filter((s) => s.businessId === q.businessId)
      .map((s) => {
        const reviews = client.staffReviews.filter((r) => r.staffId === s.id && r.businessId === q.businessId && inRangeDate(r.createdAt));
        return { staffId: s.id, staffName: s.name, count: reviews.length, avgRating: reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0 };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.avgRating - a.avgRating);
    return { rows, starSummary, ratingSummary };
  });
}

/**
 * F-12-069: «У нас» — клиент снимает свою звёздочку сам, бизнес звёздочки не удаляет; удаление ТЕКСТОВОГО
 * отзыва о месте бизнесом — единственное, что здесь удаляется, и только с правом reviewsDelete. Мутация
 * чужого среза 'client' напрямую — просьба фундаменту завести deleteLocationReview в api/client.ts
 * (qa/requests/reports.md), пока такого метода там нет.
 */
export function deleteCompanyReview(businessId: Id, reviewId: Id): Promise<void> {
  if (isApiMode()) return Server.deleteCompanyReview(businessId, reviewId);
  return request(() => {
    assertCan('reports.view');
    mutateArea('client', (s) => {
      s.locationReviews = s.locationReviews.filter((r) => !(r.id === reviewId && r.businessId === businessId));
    });
  });
}

/**
 * В-24 (1:1 с Altegio, F-12-069): «отзыв можно скрыть из онлайн-записи» — в отличие от удаления, не стирает
 * оценку и текст, только прячет их с публичных экранов (виджет, карточка мастера); в отчёте бизнес видит
 * скрытые отзывы всегда, с пометкой.
 */
export function hideStaffReview(businessId: Id, reviewId: Id): Promise<void> {
  if (isApiMode()) return Server.hideStaffReview(businessId, reviewId);
  return request(() => {
    assertCan('reports.view');
    mutateArea('client', (s) => {
      const review = s.staffReviews.find((r) => r.id === reviewId && r.businessId === businessId);
      if (!review) throw new ApiError('not_found');
      review.hiddenByBusiness = true;
    });
  });
}

export function unhideStaffReview(businessId: Id, reviewId: Id): Promise<void> {
  if (isApiMode()) return Server.unhideStaffReview(businessId, reviewId);
  return request(() => {
    assertCan('reports.view');
    mutateArea('client', (s) => {
      const review = s.staffReviews.find((r) => r.id === reviewId && r.businessId === businessId);
      if (!review) throw new ApiError('not_found');
      review.hiddenByBusiness = false;
    });
  });
}

// ─────────────────────────── b03: F-12-070…071 «Сообщения» ───────────────────────────

/** F-12-070 «Любой тип»: 66 типов в ТЗ, но домен хранит только код без реестра — список строим из того, что реально есть в журнале */
export function listMessageTypesInLog(businessId: Id): Promise<{ code: string; label: string }[]> {
  if (isApiMode()) return Server.listMessageTypesInLog(businessId);
  return request(() => {
    const log = readArea('notify').log[businessId] ?? [];
    const map = new Map<string, string>();
    for (const m of log) map.set(String(m.typeCode ?? m.typeLabel.ru), m.typeLabel.ru || m.typeLabel.en || '');
    return [...map.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label));
  });
}

export function getMessagesReport(q: { businessId: Id; filters: MessagesReportFilters }): Promise<MessagesReportResult> {
  if (isApiMode()) return Server.getMessagesReport(q);
  return request(() => {
    const notify = readArea('notify');
    let rows = (notify.log[q.businessId] ?? []).filter((m) => m.createdAt.slice(0, 10) >= q.filters.range.from && m.createdAt.slice(0, 10) <= q.filters.range.to);
    if (q.filters.typeCode) rows = rows.filter((m) => String(m.typeCode ?? m.typeLabel.ru) === q.filters.typeCode);
    if (q.filters.status) rows = rows.filter((m) => m.status === q.filters.status);
    if (q.filters.channel) rows = rows.filter((m) => m.channel === q.filters.channel);
    if (q.filters.phoneSearch?.trim()) {
      const digits = q.filters.phoneSearch.replace(/\D/g, '');
      rows = rows.filter((m) => m.contact.replace(/\D/g, '').includes(digits));
    }
    const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = sorted.length;
    const page = q.filters.page ?? 1;
    const pageSize = q.filters.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    const items: MessagesReportRow[] = sorted.slice(start, start + pageSize).map(
      (m): MessagesReportRow => ({
        id: m.id,
        at: m.createdAt,
        typeLabel: m.typeLabel.ru || m.typeLabel.en || '',
        channel: m.channel,
        status: m.status,
        contact: m.contact,
        text: m.text.ru || m.text.en || '',
      }),
    );
    return { items, total };
  });
}

// ─────────────────────────── b03: F-12-072…073 «Звонки» ───────────────────────────

export function getCallsReport(q: { businessId: Id; networkId?: Id }): Promise<{ connected: boolean; rows: CallsReportRow[] }> {
  return request(async () => {
    if (!q.networkId) return { connected: false, rows: [] };
    let connected = false;
    try {
      const t = await getNetworkTelephony(q.networkId);
      connected = t.connected;
    } catch {
      connected = false;
    }
    if (!connected) return { connected: false, rows: [] };
    const calls = await listNetworkCalls(q.networkId, q.businessId);
    const rows: CallsReportRow[] = calls.map((c) => ({ id: c.id, at: c.at, phone: c.phone, direction: c.direction, status: c.status, durationSec: c.durationSec, hasRecording: c.hasRecording }));
    return { connected: true, rows };
  });
}

// ─────────────────────────── b03: F-12-076…077 «Изменения данных» ───────────────────────────

function actorLabel(by: Id | 'client' | 'system', staffById: Map<Id, string>): string {
  if (by === 'client') return 'client';
  if (by === 'system') return 'system';
  return staffById.get(by) ?? by;
}

export function listDataChanges(q: { businessId: Id; filters: DataChangesFilters }): Promise<DataChangeEntry[]> {
  if (isApiMode()) return Server.listDataChanges(q);
  return request(async () => {
    const core = readCore();
    const staffById = new Map(core.staff.map((s) => [s.id, s.name] as const));
    const inWindow = (at: string) => at.slice(0, 10) >= q.filters.from && at.slice(0, 10) <= q.filters.to;

    const entries: DataChangeEntry[] = [];

    // F-12-076/077: «Запись» — из событий ядра (F-01-097); журнал хранит ОДНУ строку на объект: последнее
    // действие; ⭐ «У нас» F-12-077: полная лента правок видна через «Показать» (history), не только последнее.
    const events = await listBookingEvents({ businessId: q.businessId });
    type ChangeStep = { at: string; authorName: string; kind: string; clientId?: Id };
    const byBooking = new Map<Id, ChangeStep[]>();
    for (const e of events) {
      const list = byBooking.get(e.bookingId) ?? [];
      list.push({ at: e.at, authorName: actorLabel(e.by, staffById), kind: e.kind, clientId: e.clientId });
      byBooking.set(e.bookingId, list);
    }
    // F-01-121: восстановление удалённой записи — своя история журнала (не событие ядра, F-01-096),
    // «Изменения данных» примешивает её строкой 'restored', отсюда и живёт фильтр «Восстановить».
    const journalHistory = readArea('journal').history;
    for (const [bookingId, entries2] of Object.entries(journalHistory)) {
      for (const h of entries2) {
        if (h.action !== 'restored') continue;
        const list = byBooking.get(bookingId) ?? [];
        list.push({ at: h.at, authorName: h.authorName, kind: 'restored' });
        byBooking.set(bookingId, list);
      }
    }
    for (const [bookingId, evs] of byBooking) {
      const sorted = [...evs].sort((a, b) => a.at.localeCompare(b.at));
      const last = sorted[sorted.length - 1];
      if (!inWindow(last.at)) continue;
      const action =
        last.kind === 'created' ? 'create' : last.kind === 'restored' ? 'restore' : last.kind === 'deleted' ? 'delete' : 'update';
      const lastClientId = [...sorted].reverse().find((e) => e.clientId)?.clientId;
      const client = lastClientId ? core.clients.find((c) => c.id === lastClientId) : undefined;
      entries.push({
        id: `dc_booking_${bookingId}`,
        entity: 'booking',
        entityId: bookingId,
        entityLabel: client?.name ?? '',
        deleted: last.kind === 'deleted',
        authorName: last.authorName,
        action,
        at: last.at,
        history: sorted.map((e) => ({ at: e.at, authorName: e.authorName, summary: e.kind })),
      });
    }

    // Складские операции (F-08-046…053) — снимок создания/изменения/отмены
    const stock = readArea('stock');
    for (const op of stock.operations.filter((o) => o.businessId === q.businessId)) {
      const at = op.updatedAt ?? op.createdAt;
      if (!inWindow(at)) continue;
      const author = op.staffId ? (staffById.get(op.staffId) ?? '') : '';
      const history: DataChangeEntry['history'] = [{ at: op.createdAt, authorName: author, summary: 'create' }];
      if (op.updatedAt) history.push({ at: op.updatedAt, authorName: author, summary: 'update' });
      if (op.cancelledAt) history.push({ at: op.cancelledAt, authorName: author, summary: 'delete' });
      entries.push({
        id: `dc_stock_${op.id}`,
        entity: 'stockOperation',
        entityId: op.id,
        entityLabel: op.number,
        deleted: Boolean(op.cancelledAt),
        authorName: author,
        action: op.cancelledAt ? 'delete' : op.updatedAt ? 'update' : 'create',
        at: op.cancelledAt ?? at,
        history,
      });
    }

    // Финансовые транзакции (F-07-173) — отменённые/удалённые остаются в журнале (справка 174913)
    const finance = readArea('finance');
    for (const op of finance.operations.filter((o) => o.businessId === q.businessId)) {
      if (!inWindow(op.date)) continue;
      entries.push({
        id: `dc_fin_${op.id}`,
        entity: 'financeOperation',
        entityId: op.id,
        entityLabel: op.partyName ?? op.lineLabel ?? '',
        deleted: false,
        authorName: '',
        action: 'create',
        at: op.date,
        history: [{ at: op.date, authorName: '', summary: 'create' }],
      });
    }

    let rows = entries;
    if (q.filters.entity) rows = rows.filter((r) => r.entity === q.filters.entity);
    if (q.filters.action) rows = rows.filter((r) => r.action === q.filters.action);
    if (q.filters.authorName) rows = rows.filter((r) => r.authorName === q.filters.authorName);
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  });
}

// ─────────────────────────── F-12-106: «Моя аналитика» администратора ───────────────────────────

export interface MyAnalyticsQuery {
  businessId: Id;
  staffId: Id;
  range: ReportDateRange;
}

export function getMyAnalytics(q: MyAnalyticsQuery): Promise<MyAnalyticsData> {
  return request(async () => {
    const all = await listBookings({ businessId: q.businessId, includeDeleted: false });
    const inRange = (iso: string) => iso.slice(0, 10) >= q.range.from && iso.slice(0, 10) <= q.range.to;
    const createdByHim = all.filter((b) => b.createdBy === q.staffId && inRange(b.createdAt));

    const completedByHim = createdByHim.filter((b) => b.status === 'arrived');
    const revenueOfCreated = completedByHim.reduce((sum, b) => sum + b.total, 0);
    const distinctClientsBooked = new Set(createdByHim.map((b) => b.clientId).filter(Boolean)).size;
    // F-12-106 «операционные записи»: сделаны в тот же день, на который ещё не наступил визит (запись «на потом»)
    const sameDayFutureBookings = createdByHim.filter((b) => b.start.slice(0, 10) > b.createdAt.slice(0, 10)).length;

    // Отч5: «пришло» — визиты (склейка записей, F-01-041), а не записи: было 157 записей под подписью «клиентов»
    const arrivedInRange = all.filter((b) => b.status === 'arrived' && inRange(b.start));
    const arrivedTotal = new Set(arrivedInRange.map(visitKeyOf)).size;
    const arrivedBookedByHim = new Set(arrivedInRange.filter((b) => b.createdBy === q.staffId).map(visitKeyOf)).size;

    const noShowInRange = all.filter((b) => b.status === 'no_show' && inRange(b.start));
    const noShowTotal = noShowInRange.length;
    // «перезаписал неявившегося» — тот же клиент получил от него новую запись после неявки, внутри периода
    const noShowRebookedByHim = noShowInRange.filter((ns) =>
      ns.clientId ? all.some((b) => b.clientId === ns.clientId && b.createdBy === q.staffId && b.createdAt > ns.start && inRange(b.createdAt)) : false,
    ).length;

    // F-09-095: «начисленные администратору выплаты» — общий баланс, не привязан к диапазону дат
    // (взаиморасчёты считаются нарастающим итогом, не за отчётный период — payroll's api как контракт).
    const balance = await getStaffBalance(q.businessId, q.staffId);

    return {
      createdBookings: createdByHim.length,
      completedByHim: completedByHim.length,
      revenueOfCreated,
      distinctClientsBooked,
      sameDayFutureBookings,
      arrivedTotal,
      arrivedBookedByHim,
      noShowTotal,
      noShowRebookedByHim,
      payrollEarned: balance.earned,
      payrollPaid: balance.paid,
      payrollRemaining: balance.remaining,
    } satisfies MyAnalyticsData;
  });
}

export type { Client };

// ─────────────────────────── F-00-195: «План месяца» ───────────────────────────

export interface MonthlyPlanData {
  /** Цель на месяц, драм; нет — план не поставлен */
  goal: number | null;
  /** Получено с начала месяца (receivedMoneyMock — как «Итого» «Основных показателей» за месяц), драм */
  revenue: number;
  /** 0–100, только если goal поставлен */
  percent: number | null;
}

/** Месяц плана: с 1-го числа по сегодня (текущий месяц) или по последний день — получить деньги «завтра» нельзя,
 * и так «Отчёт» с главной (с 1-го по сегодня) показывает ту же сумму */
function monthRange(month: string): { from: ISODate; to: ISODate } {
  const from = `${month}-01` as ISODate;
  const end = toISODate(dayjs(from).endOf('month'));
  const now = today();
  return { from, to: (now < end ? now : end) as ISODate };
}

/** Владелец видит план месяца и процент выполнения (F-00-195, «наше решение», не 1:1 с Altegio) */
export function getMonthlyPlan(businessId: Id, locationIds: Id[], month: string): Promise<MonthlyPlanData> {
  if (isApiMode()) return Server.getMonthlyPlan(businessId, locationIds, month);
  return request(async () => {
    const goal = readArea('reports').monthlyGoalByBusiness[businessId]?.[month] ?? null;
    const { from, to } = monthRange(month);
    // Решение владельца 01.10.2026: выручка = полученные деньги — тот же receivedMoneyMock, что «Итого» дашборда
    // за этот месяц (раньше — цена визитов «пришёл», и план расходился с «Основными показателями»)
    const all = await listBookings({ businessId, includeDeleted: true });
    const bookingById = new Map(all.map((b) => [b.id, b] as const));
    const revenue = dram(sumMoney(receivedMoneyMock(businessId, locationIds, from, to, bookingById)));
    return {
      goal,
      revenue,
      percent: goal && goal > 0 ? Math.round((revenue / goal) * 100) : null,
    } satisfies MonthlyPlanData;
  });
}

export function setMonthlyPlan(businessId: Id, month: string, goal: number): Promise<void> {
  if (isApiMode()) return Server.setMonthlyPlan(businessId, month, goal);
  return request(async () => {
    mutateArea('reports', (s) => {
      s.monthlyGoalByBusiness[businessId] ??= {};
      s.monthlyGoalByBusiness[businessId][month] = Math.max(0, Math.round(goal));
    });
  });
}


// ─────────────────────────── ⭐ Главная владельца (владелец, 01.10.2026) ───────────────────────────

export interface OwnerHomeQuery {
  businessId: Id;
  locationIds: Id[];
  /** Период цифр «загрузка / перезапись / не пришли» — последние 30 дней, как «Основные показатели» по умолчанию */
  range: ReportDateRange;
  /** Месяц плана, YYYY-MM */
  month: string;
}

/**
 * Пять цифр главной. Каждая — ТА ЖЕ функция, что отчёт, куда ведёт её кнопка (цифры не расходятся по построению):
 * план — getMonthlyPlan (полученные деньги месяца), загрузка — getWorkloadReport (итог «Загруженности»), перезапись и
 * «не пришли» — getMainDashboard за тот же период, «Пора позвать» — подборка «Пора записать» «Клиентов» (dueAt).
 * Сервер — один маршрут `GET …/reports/home`, который зовёт те же сервисы отчётов.
 */
export function getOwnerHome(q: OwnerHomeQuery): Promise<OwnerHomeData> {
  if (isApiMode()) return Server.getOwnerHome(q);
  const dashboardQ: DashboardQuery = { businessId: q.businessId, locationIds: q.locationIds, range: q.range, filters: {} };
  return Promise.all([
    getMonthlyPlan(q.businessId, q.locationIds, q.month),
    getWorkloadReport({ businessId: q.businessId, locationIds: q.locationIds, range: q.range }),
    getMainDashboard(dashboardQ),
    homeListsMock(q),
  ]).then(([plan, load, dash, lists]) => ({
    range: q.range,
    month: q.month,
    plan,
    load: {
      pct: load.totalScheduledHours > 0 ? Math.round((load.totalWorkedHours / load.totalScheduledHours) * 100) : null,
      workedHours: load.totalWorkedHours,
      scheduledHours: load.totalScheduledHours,
    },
    rebooking: {
      pct: dash.extras?.rebookingPct ?? null,
      rebooked: dash.extras?.rebookedClients ?? 0,
      visited: dash.extras?.visitedClients ?? 0,
      notRebooked: lists.notRebooked,
    },
    noShow: { count: dash.occupancy.noShow?.count ?? 0, pct: dash.extras?.noShowPct ?? null },
    due: lists.due,
    mailings: lists.mailings,
    setup: lists.setup,
    isEmpty: lists.setup.bookings === 0,
  }));
}

/** Списки и «первые шаги» главной — одним запросом к моковой базе */
function homeListsMock(q: OwnerHomeQuery): Promise<Pick<OwnerHomeData, 'due' | 'mailings' | 'setup'> & { notRebooked: HomeClientRow[] }> {
  return request(() => {
    const core = readCore();
    const todayIso = today();
    const canPhones = canNow('clients.phones');
    const serviceName = new Map(core.services.map((s) => [s.id, s.name] as const));
    const business = core.businesses.find((b) => b.id === q.businessId);
    const bizBookings = core.bookings.filter((b) => b.businessId === q.businessId);
    const lastArrived = new Map<Id, Booking>();
    for (const b of bizBookings) {
      if (b.deletedAt || b.status !== 'arrived' || !b.clientId) continue;
      const prev = lastArrived.get(b.clientId);
      if (!prev || b.start > prev.start) lastArrived.set(b.clientId, b);
    }
    const lastServiceOf = (clientId: Id) => {
      const last = lastArrived.get(clientId);
      const line = last?.services.find((l) => core.services.find((s) => s.id === l.serviceId)?.repeatIntervalDays) ?? last?.services[0];
      return line ? serviceName.get(line.serviceId) : undefined;
    };

    // «Пора позвать» — та же подборка, что «Пора записать» в «Клиентах»: dueAt наступил, будущей записи нет
    const dueRows = clientRowsFor([q.businessId])
      .filter((r) => Boolean(r.dueAt) && r.dueAt! <= todayIso)
      .sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : a.dueAt! > b.dueAt! ? 1 : a.name.localeCompare(b.name)));
    const due = {
      count: dueRows.length,
      clients: dueRows.slice(0, HOME_LIST_LIMIT).map(
        (r): HomeClientRow => ({ clientId: r.id, name: r.name, phone: canPhones ? r.phone : undefined, lastVisit: r.lastVisit, dueAt: r.dueAt, serviceName: lastServiceOf(r.id) }),
      ),
    };

    // «Не записались снова» — то же правило и тот же круг записей, что «Доля перезаписи» дашборда (rebookingOf)
    const staffIds = new Set(core.staff.filter((s) => q.locationIds.some((l) => s.locationIds.includes(l))).map((s) => s.id));
    const inScope = bizBookings.filter((b) => q.locationIds.includes(b.locationId) && staffIds.has(b.staffId));
    const completed = inScope.filter((b) => inRange(b, q.range) && b.status === 'arrived' && !b.deletedAt);
    const { lastVisitInPeriod, rebookedIds } = rebookingOf(inScope, completed);
    const clientById = new Map(core.clients.map((c) => [c.id, c] as const));
    const notRebooked = [...lastVisitInPeriod.entries()]
      .filter(([cid]) => !rebookedIds.has(cid) && clientById.get(cid) && !clientById.get(cid)!.deletedAt)
      .sort((a, b) => (a[1] < b[1] ? -1 : 1))
      .slice(0, HOME_LIST_LIMIT)
      .map(([cid, start]): HomeClientRow => {
        const c = clientById.get(cid)!;
        return { clientId: cid, name: c.name, phone: canPhones ? c.phone : undefined, lastVisit: start.slice(0, 10), serviceName: lastServiceOf(cid) };
      });

    // Отдача от рассылок: получатели, записавшиеся в течение 7 дней после отправленной в периоде рассылки
    const sent = (readArea('notify').mailings[q.businessId] ?? []).filter((m) => {
      const at = (m.scheduledAt ?? m.createdAt).slice(0, 10);
      return m.status === 'sent' && at >= q.range.from && at <= q.range.to;
    });
    let mailings: MailingReturn | null = null;
    if (sent.length) {
      const recipients = new Set<Id>();
      const booked = new Map<Id, Booking>();
      for (const m of sent) {
        const at = (m.scheduledAt ?? m.createdAt).slice(0, 16);
        const until = toISODate(dayjs(at).add(MAILING_RETURN_WINDOW_DAYS, 'day')) + at.slice(10);
        const ids = new Set(m.recipientClientIds ?? []);
        ids.forEach((id) => recipients.add(id));
        for (const b of bizBookings) {
          if (!b.clientId || b.deletedAt || !ids.has(b.clientId) || b.status === 'cancelled_by_master') continue;
          const created = b.createdAt.slice(0, 16);
          if (created > at && created <= until) booked.set(b.id, b);
        }
      }
      const list = [...booked.values()];
      mailings = {
        mailings: sent.length,
        recipients: recipients.size,
        bookedClients: new Set(list.map((b) => b.clientId)).size,
        bookings: list.length,
        bookedAmount: list.reduce((sum, b) => sum + b.total, 0),
        windowDays: MAILING_RETURN_WINDOW_DAYS,
      };
    }

    const setup = {
      services: core.services.filter((s) => s.businessId === q.businessId && s.active).length,
      masters: core.staff.filter((s) => s.businessId === q.businessId && s.status === 'active' && (s.role === 'master' || business?.kind === 'individual')).length,
      bookings: bizBookings.filter((b) => !b.deletedAt).length,
    };

    return { due, notRebooked, mailings, setup };
  });
}

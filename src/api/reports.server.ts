/**
 * Реализация раздела «reports» через сервер (booktime-backend, PLAN.md §7, этап 16). Зовётся из src/api/reports.ts
 * при `isApiMode()`. Один маршрут на отчёт (`GET /v1/biz/{b}/reports/{name}`, docs/backend/02 §16) — здесь просто
 * прокладки: собрать query-строку из мокового аргумента, распаковать ответ в тип, который уже знает экран.
 *
 * Честные пробелы (см. booktime-backend/docs/PROGRESS.md, этап 16 — эта пачка НЕ переключает):
 * - listFavoriteReports/toggleFavoriteReport — сигнатура мока не несёт businessId, серверный маршрут его требует.
 * - finance/pnl/cashDay, 6 отчётов склада, отзывы, звонки, «по сотрудникам в динамике», «Моя аналитика»,
 *   еженедельный отчёт/расписание на почту/план по месяцам — сервер их не строил в этом этапе, остаются на моке.
 */
import { http } from '@/api/http';
import type { AppointmentImportRow } from '@/api/reports';
import type { AppointmentsQuery, ClientVisitExportRow, DashboardQuery, EventsQuery, MonthlyPlanData, OwnerHomeQuery, RetentionQuery, SalesByClientsQuery, SalesByServicesQuery, SalesByStaffQuery, StockBalanceQuery, VisitsQuery, WorkloadQuery } from '@/api/reports';
import type { Id, ISODate } from '@/domain/core';
import type {
  ActivityEntry,
  ActivityFilter,
  AppointmentsResult,
  DataChangeEntry,
  DataChangesFilters,
  DataExportFilters,
  DataExportLogEntry,
  DataExportOperationType,
  DataExportType,
  EventsReportData,
  MainDashboardData,
  MessagesReportFilters,
  OwnerHomeData,
  MessagesReportResult,
  PromotionNotReturnedRow,
  PromotionsFilters,
  PromotionsReportData,
  ReportDateRange,
  ReportFavorite,
  ReportsStaffPermissions,
  ReviewRow,
  ReviewsFilters,
  RetentionReportData,
  SalesByClientsData,
  SalesByServicesData,
  SalesByStaffData,
  StaffRatingSummaryRow,
  StaffStarSummaryRow,
  StockBalanceRow,
  StockOrderRow,
  StockSalesAnalysisRow,
  StockTurnoverRow,
  StockUsageAnalysisRow,
  StockWriteOffFilters,
  StockWriteOffRow,
  VisitsDay,
  WeeklyReportSettings,
  WorkloadReportData,
} from '@/domain/reports';
import { WEEKLY_REPORT_DEFAULT } from '@/domain/reports';
import { dayjs, today, toISODate } from '@/lib/date';

const b = (businessId: Id) => `/v1/biz/${businessId}/reports`;
const csv = (ids?: Id[]) => (ids?.length ? ids.join(',') : undefined);

export function getChurnDays(businessId: Id): Promise<number> {
  return http<{ area: string; data: { churnDays?: number } }>('GET', `/v1/biz/${businessId}/settings/reports`).then((s) => s.data.churnDays ?? 60);
}

export function setChurnDays(businessId: Id, days: number): Promise<number> {
  return http<{ area: string; data: { churnDays?: number }; version: number }>('GET', `/v1/biz/${businessId}/settings/reports`).then((s) =>
    http<{ data: { churnDays?: number } }>('PUT', `/v1/biz/${businessId}/settings/reports`, { data: { ...s.data, churnDays: days } }, { version: s.version }).then(() => days),
  );
}

export function getMainDashboard(q: DashboardQuery): Promise<MainDashboardData> {
  return http('GET', `${b(q.businessId)}/overview`, undefined, { query: { from: q.range.from, to: q.range.to, locationIds: csv(q.locationIds), staffId: q.filters.staffId, position: q.filters.position } });
}

export function getVisits(q: VisitsQuery): Promise<{ days: VisitsDay[]; count: number }> {
  return http('GET', `${b(q.businessId)}/visits`, undefined, { query: { locationIds: csv(q.locationIds), tab: q.tab } });
}

export function listAppointmentsReport(q: AppointmentsQuery): Promise<AppointmentsResult> {
  return http('GET', `${b(q.businessId)}/records`, undefined, {
    query: {
      locationIds: csv(q.locationIds),
      from: q.filters.createdFrom,
      to: q.filters.createdTo,
      staffId: q.filters.staffId,
      createdBy: q.filters.createdBy,
      cancelled: q.filters.cancelled,
      source: q.filters.source,
      hasServices: q.filters.hasServices,
      search: q.filters.search,
      // Экран считает страницы от 0 (AppointmentsScreen.tsx), сервер — от 1 (records.page ≥ 1)
      page: q.page + 1,
      pageSize: q.filters.pageSize,
    },
  });
}

export function getEventsReport(q: EventsQuery): Promise<EventsReportData> {
  return http('GET', `${b(q.businessId)}/events`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to, serviceId: q.serviceId, staffId: q.staffId, status: q.status } });
}

export function getRetentionReport(q: RetentionQuery): Promise<RetentionReportData> {
  return http('GET', `${b(q.businessId)}/retention`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to, serviceId: q.serviceId } });
}

export function getWorkloadReport(q: WorkloadQuery): Promise<WorkloadReportData> {
  return http('GET', `${b(q.businessId)}/load`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to } });
}

export function setWorkloadIncluded(businessId: Id, staffId: Id, included: boolean): Promise<void> {
  return http('PATCH', `${b(businessId)}/load/staff/${staffId}`, { included }).then(() => undefined);
}

export function getSalesByStaff(q: SalesByStaffQuery): Promise<SalesByStaffData> {
  return http('GET', `${b(q.businessId)}/by-staff`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to, serviceId: q.serviceId, serviceCategoryId: q.serviceCategoryId, position: q.position } });
}

export function getSalesByServices(q: SalesByServicesQuery): Promise<SalesByServicesData> {
  return http('GET', `${b(q.businessId)}/by-service`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to, staffId: q.staffId, categoryId: q.categoryId } });
}

export function getSalesByClients(q: SalesByClientsQuery): Promise<SalesByClientsData> {
  return http('GET', `${b(q.businessId)}/by-client`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to } });
}

/** Сервер не хранит связь визит↔акция по локациям (см. reports-marketing.service.ts на бэкенде) — locationIds не передаём */
export function getPromotionsReport(q: { businessId: Id; locationIds: Id[]; filters: PromotionsFilters }): Promise<PromotionsReportData> {
  return http('GET', `${b(q.businessId)}/promotions`, undefined, { query: { promotionId: q.filters.promotionId, from: q.filters.range.from, to: q.filters.range.to } });
}

export function getMessagesReport(q: { businessId: Id; filters: MessagesReportFilters }): Promise<MessagesReportResult> {
  return http('GET', `${b(q.businessId)}/messages`, undefined, {
    query: { from: q.filters.range.from, to: q.filters.range.to, typeCode: q.filters.typeCode, status: q.filters.status, phoneSearch: q.filters.phoneSearch, channel: q.filters.channel, page: q.filters.page, pageSize: q.filters.pageSize },
  });
}

export function getReportsPermissions(businessId: Id, staffId: Id): Promise<ReportsStaffPermissions> {
  return http('GET', `${b(businessId)}/permissions/${staffId}`);
}

export function setReportsPermissions(businessId: Id, staffId: Id, patch: Partial<ReportsStaffPermissions>): Promise<ReportsStaffPermissions> {
  return http('PATCH', `${b(businessId)}/permissions/${staffId}`, patch);
}

/** F-12-076/077: сервер поднимает «Изменения данных» из общего журнала AuditEvent (booking/finOp/stockOperation),
 * а не из отдельных лент мока — сеть (`entity: 'network'`) он не покрывает, поэтому короткий выход без запроса. */
export function listDataChanges(q: { businessId: Id; filters: DataChangesFilters }): Promise<DataChangeEntry[]> {
  if (q.filters.entity === 'network') return Promise.resolve([]);
  return http('GET', `${b(q.businessId)}/data-changes`, undefined, { query: { from: q.filters.from, to: q.filters.to, entity: q.filters.entity, authorName: q.filters.authorName, action: q.filters.action } });
}

/**
 * F-12-003: избранное отчётов, per-сотрудник (этап 21, лейн services+rest — старый вывод «сигнатура мока не
 * несёт businessId» больше не блокирует: businessId берём из сессии, как `currentBusinessId()` в services.ts).
 */
export function listFavoriteReports(businessId: Id): Promise<ReportFavorite[]> {
  return http('GET', `${b(businessId)}/favorites`);
}

export function toggleFavoriteReport(businessId: Id, slug: string): Promise<ReportFavorite[]> {
  return http('POST', `${b(businessId)}/favorites/${slug}`);
}

// ─────────────────────────── этап 21 «network+reports» ───────────────────────────

/** `settings/reports` уже несёт `churnDays` (см. getChurnDays выше) — weeklyReport/monthlyGoal живут в том же
 * JSON, без нового бэкенда: один блок настроек на раздел (F4), read-modify-write под `version` (If-Match). */
interface ReportsSettingsBlob {
  churnDays?: number;
  weeklyReport?: WeeklyReportSettings;
  monthlyGoal?: Record<string, number>;
}

function reportsSettings(businessId: Id): Promise<{ data: ReportsSettingsBlob; version: number }> {
  return http('GET', `/v1/biz/${businessId}/settings/reports`);
}

function putReportsSettings(businessId: Id, version: number, data: ReportsSettingsBlob): Promise<void> {
  return http('PUT', `/v1/biz/${businessId}/settings/reports`, { data }, { version }).then(() => undefined);
}

export async function getWeeklyReportSettings(businessId: Id): Promise<WeeklyReportSettings> {
  const s = await reportsSettings(businessId);
  return s.data.weeklyReport ?? WEEKLY_REPORT_DEFAULT;
}

export async function setWeeklyReportEnabled(businessId: Id, enabled: boolean): Promise<WeeklyReportSettings> {
  const s = await reportsSettings(businessId);
  const current = s.data.weeklyReport ?? WEEKLY_REPORT_DEFAULT;
  const updated: WeeklyReportSettings = { ...current, enabled, lastSentAt: enabled ? new Date().toISOString() : current.lastSentAt };
  await putReportsSettings(businessId, s.version, { ...s.data, weeklyReport: updated });
  return updated;
}

/** Сервер проверяет дату строго (2026-09-31 — 400): последний день месяца считаем честно; текущий месяц — по сегодня
 * (деньги «завтра» не получены; так совпадает с «Отчётом» главной и моком monthRange) */
function monthRangeOf(month: string): { from: ISODate; to: ISODate } {
  const from = `${month}-01` as ISODate;
  const end = toISODate(dayjs(from).endOf('month'));
  const now = today();
  return { from, to: (now < end ? now : end) as ISODate };
}

/** F-00-195: план месяца хранится в настройках, факт — тот же `overview`, что видит дашборд (не вторая гонка по Booking) */
export async function getMonthlyPlan(businessId: Id, locationIds: Id[], month: string): Promise<MonthlyPlanData> {
  const s = await reportsSettings(businessId);
  const goal = s.data.monthlyGoal?.[month] ?? null;
  const dashboard = await getMainDashboard({ businessId, range: monthRangeOf(month), locationIds, filters: {} });
  const revenue = dashboard.sales.total.value;
  return { goal, revenue, percent: goal && goal > 0 ? Math.round((revenue / goal) * 100) : null };
}

export async function setMonthlyPlan(businessId: Id, month: string, goal: number): Promise<void> {
  const s = await reportsSettings(businessId);
  const monthlyGoal = { ...(s.data.monthlyGoal ?? {}), [month]: Math.max(0, Math.round(goal)) };
  await putReportsSettings(businessId, s.version, { ...s.data, monthlyGoal });
}

export function listMessageTypesInLog(businessId: Id): Promise<{ code: string; label: string }[]> {
  return http('GET', `${b(businessId)}/message-types`);
}

export function getClientVisitsForExport(q: { businessId: Id; clientId: Id; range: ReportDateRange }): Promise<ClientVisitExportRow[]> {
  return http('GET', `${b(q.businessId)}/client-visits/${q.clientId}`, undefined, { query: { from: q.range.from, to: q.range.to } });
}

export function getPromotionNotReturned(q: { businessId: Id; promotionId: Id }): Promise<PromotionNotReturnedRow[]> {
  return http('GET', `${b(q.businessId)}/promotion-not-returned`, undefined, { query: { promotionId: q.promotionId } });
}

export function getReviewsReport(q: { businessId: Id; filters: ReviewsFilters }): Promise<{ rows: ReviewRow[]; starSummary: StaffStarSummaryRow[]; ratingSummary: StaffRatingSummaryRow[] }> {
  return http('GET', `${b(q.businessId)}/reviews`, undefined, { query: { from: q.filters.range.from, to: q.filters.range.to, subject: q.filters.subject } });
}

export function deleteCompanyReview(businessId: Id, reviewId: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/reviews/company/${reviewId}`);
}

export function hideStaffReview(businessId: Id, reviewId: Id): Promise<void> {
  return http('PATCH', `${b(businessId)}/reviews/staff/${reviewId}`, { hidden: true }).then(() => undefined);
}

export function unhideStaffReview(businessId: Id, reviewId: Id): Promise<void> {
  return http('PATCH', `${b(businessId)}/reviews/staff/${reviewId}`, { hidden: false }).then(() => undefined);
}

/**
 * F-12-074…080: журнал ручных выгрузок/загрузок вне `REPORT_REGISTRY` — новый `POST/GET …/reports/exports`
 * (booktime-backend `reports-export.service.ts::logManual`, этап 21). `staffId`/`staffName` во входе игнорируем:
 * сервер сам берёт автора из сессии (то же решение, что `listFavoriteReports` выше, F-12-003).
 */
export function listDataExports(businessId: Id, filters: DataExportFilters = {}): Promise<DataExportLogEntry[]> {
  return http('GET', `${b(businessId)}/exports`, undefined, { query: { staffId: filters.staffId, type: filters.type, operation: filters.operation } });
}

export function logDataExport(input: { businessId: Id; staffId: Id; staffName: string; type: DataExportType; operation: DataExportOperationType; fileName: string; rowCount: number }): Promise<DataExportLogEntry> {
  return http('POST', `${b(input.businessId)}/exports`, { type: input.type, operation: input.operation, fileName: input.fileName, rowCount: input.rowCount });
}

/**
 * F-12-057…062 «Товары»: `canViewCost`/`allowedWarehouseIds` мока (права `StockStaffPermissions` лейна
 * «finance+stock») сервер пока не режет — считает `finance.view` из сессии сам (docs про упрощение —
 * `reports.controller.ts::stockBalance`, booktime-backend), поэтому эти два поля здесь не участвуют в запросе.
 */
export function getStockBalanceReport(q: StockBalanceQuery): Promise<StockBalanceRow[]> {
  return http('GET', `${b(q.businessId)}/stock-balance`, undefined, {
    query: { locationId: q.locationId, atDate: q.filters.atDate, warehouseId: q.filters.warehouseId, categoryId: q.filters.categoryId, onlyCritical: q.filters.onlyCritical, zeroFilter: q.filters.zeroFilter, search: q.filters.search },
  });
}

export function getStockOrderReport(q: { businessId: Id; locationId: Id; categoryId?: Id; onlyCritical?: boolean }): Promise<StockOrderRow[]> {
  return http('GET', `${b(q.businessId)}/stock-order`, undefined, { query: { locationId: q.locationId, categoryId: q.categoryId, onlyCritical: q.onlyCritical } });
}

export function getStockSalesAnalysis(q: { businessId: Id; locationId: Id; range: ReportDateRange; categoryId?: Id; staffId?: Id }): Promise<{ rows: StockSalesAnalysisRow[]; totalCost: number; totalMarkup: number }> {
  return http('GET', `${b(q.businessId)}/stock-sales-analysis`, undefined, { query: { locationId: q.locationId, from: q.range.from, to: q.range.to, categoryId: q.categoryId, staffId: q.staffId } });
}

export function getStockUsageAnalysis(q: { businessId: Id; locationId: Id; range: ReportDateRange; categoryId?: Id }): Promise<StockUsageAnalysisRow[]> {
  return http('GET', `${b(q.businessId)}/stock-usage-analysis`, undefined, { query: { locationId: q.locationId, from: q.range.from, to: q.range.to, categoryId: q.categoryId } });
}

export function getStockWriteOffReport(q: { businessId: Id; locationId: Id; filters: StockWriteOffFilters }): Promise<{ rows: StockWriteOffRow[]; totalOutValue: number }> {
  return http('GET', `${b(q.businessId)}/stock-write-off`, undefined, {
    query: { locationId: q.locationId, from: q.filters.range.from, to: q.filters.range.to, warehouseId: q.filters.warehouseId, categoryId: q.filters.categoryId, unitMode: q.filters.unitMode, countMoves: q.filters.countMoves },
  });
}

export function getStockTurnoverReport(q: { businessId: Id; locationId: Id; range: ReportDateRange; categoryId?: Id; warehouseId?: Id }): Promise<StockTurnoverRow[]> {
  return http('GET', `${b(q.businessId)}/stock-turnover`, undefined, { query: { locationId: q.locationId, from: q.range.from, to: q.range.to, categoryId: q.categoryId, warehouseId: q.warehouseId } });
}

// ─────────────────────────── этап 21 «network+reports», попытка 2 ───────────────────────────

/** F-12-030/038: «Лента активности» — новая запись `activity` в REPORT_REGISTRY, тот же маршрут `GET …/reports/{name}`, что overview/visits/records выше */
export function getActivityFeed(q: { businessId: Id; locationIds: Id[]; filter: ActivityFilter; canSeePhones: boolean }): Promise<ActivityEntry[]> {
  return http('GET', `${b(q.businessId)}/activity`, undefined, { query: { locationIds: csv(q.locationIds), filter: q.filter } });
}

/** F-12-037: загрузка Excel/CSV «как есть» — `POST …/reports/import-appointments` (booktime-backend
 * `reports-journal.service.ts::importAppointments`, поверх `BookingsService.createRaw` журнала) */
export function importAppointments(businessId: Id, locationId: Id, rows: AppointmentImportRow[]): Promise<{ created: number; failed: number }> {
  return http('POST', `${b(businessId)}/import-appointments`, { locationId, rows });
}

/** ⭐ Главная владельца (01.10.2026): один маршрут, сервер зовёт те же сервисы, что overview / load / «Пора записать» */
export function getOwnerHome(q: OwnerHomeQuery): Promise<OwnerHomeData> {
  return http('GET', `${b(q.businessId)}/home`, undefined, { query: { locationIds: csv(q.locationIds), from: q.range.from, to: q.range.to, month: q.month } });
}

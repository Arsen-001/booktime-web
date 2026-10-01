/**
 * Типы раздела «reports». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 *
 * F-12-002: витрина «Все отчеты» — 6 групп, 24 пункта. F-12-123: у каждого отчёта ОДНО название
 * (используется в витрине, в переключателе шапки F-12-003 и в заголовке страницы) — единственный
 * источник этих названий REPORT_CATALOG, ключ i18n на группу/пункт лежит в messages/<lang>/reports.json.
 */
import type { Id, ISODate, ISODateTime } from '@/domain/core';

export type ReportGroupId = 'attendance' | 'finance' | 'sales' | 'stock' | 'marketing' | 'security';

export const REPORT_GROUP_IDS: ReportGroupId[] = ['attendance', 'finance', 'sales', 'stock', 'marketing', 'security'];

/** Готов ли пункт витрины в этой пачке (b01) — остальное открывает ReportComingSoonScreen (честно, не мёртвая ссылка) */
export type ReportBuildState = 'built' | 'soon';

export interface ReportCatalogItem {
  slug: string;
  group: ReportGroupId;
  /** F-12-001: пункт верхнего меню «Отчёты» (только 'dashboard' и 'visits' в этой пачке) */
  topNav?: boolean;
  state: ReportBuildState;
  /** href конечного экрана; для 'soon' — /biz/reports/r/<slug> */
  href: string;
}

/** F-12-002: 24 отчёта, 6 групп — порядок и состав 1:1 с ТЗ */
export const REPORT_CATALOG: ReportCatalogItem[] = [
  // Посещаемость
  { slug: 'visits', group: 'attendance', topNav: true, state: 'built', href: '/biz/reports/visits' },
  { slug: 'appointments', group: 'attendance', state: 'built', href: '/biz/reports/r/appointments' },
  { slug: 'events', group: 'attendance', state: 'built', href: '/biz/reports/r/events' },
  { slug: 'retention', group: 'attendance', state: 'built', href: '/biz/reports/r/retention' },
  { slug: 'workload', group: 'attendance', state: 'built', href: '/biz/reports/r/workload' },
  // Финансы
  { slug: 'finance', group: 'finance', state: 'built', href: '/biz/reports/r/finance' },
  { slug: 'pnl', group: 'finance', state: 'built', href: '/biz/reports/r/pnl' },
  { slug: 'cashDay', group: 'finance', state: 'built', href: '/biz/reports/r/cashDay' },
  // Продажи
  { slug: 'salesByStaff', group: 'sales', state: 'built', href: '/biz/reports/r/salesByStaff' },
  { slug: 'salesByStaffDynamics', group: 'sales', state: 'built', href: '/biz/reports/r/salesByStaffDynamics' },
  { slug: 'salesByServices', group: 'sales', state: 'built', href: '/biz/reports/r/salesByServices' },
  { slug: 'salesByClients', group: 'sales', state: 'built', href: '/biz/reports/r/salesByClients' },
  // Склад
  { slug: 'stockBalance', group: 'stock', state: 'built', href: '/biz/reports/r/stockBalance' },
  { slug: 'stockOrders', group: 'stock', state: 'built', href: '/biz/reports/r/stockOrders' },
  { slug: 'stockSalesAnalysis', group: 'stock', state: 'built', href: '/biz/reports/r/stockSalesAnalysis' },
  { slug: 'stockUsageAnalysis', group: 'stock', state: 'built', href: '/biz/reports/r/stockUsageAnalysis' },
  { slug: 'stockWriteOffAnalysis', group: 'stock', state: 'built', href: '/biz/reports/r/stockWriteOffAnalysis' },
  { slug: 'stockTurnover', group: 'stock', state: 'built', href: '/biz/reports/r/stockTurnover' },
  // Маркетинг
  { slug: 'promotions', group: 'marketing', state: 'built', href: '/biz/reports/r/promotions' },
  { slug: 'reviews', group: 'marketing', state: 'built', href: '/biz/reports/r/reviews' },
  { slug: 'messages', group: 'marketing', state: 'built', href: '/biz/reports/r/messages' },
  { slug: 'calls', group: 'marketing', state: 'built', href: '/biz/reports/r/calls' },
  // Безопасность
  { slug: 'dataExports', group: 'security', state: 'built', href: '/biz/reports/r/dataExports' },
  { slug: 'dataChanges', group: 'security', state: 'built', href: '/biz/reports/r/dataChanges' },
];

/** F-12-009: «Основные показатели» — тоже в переключателе/витрине, отдельный slug вне 24 групп */
export const DASHBOARD_SLUG = 'dashboard';

export function reportHref(slug: string): string {
  if (slug === DASHBOARD_SLUG) return '/biz/reports';
  const item = REPORT_CATALOG.find((r) => r.slug === slug);
  return item?.href ?? '/biz/reports/all';
}

// ─────────────────────────── F-12-003: избранное отчётов ───────────────────────────
// Звёздочка шапки отчёта. Настоящий дом — левая панель журнала (F-01-005, api/journal.ts), но
// её FavoriteSection.labelKey читается ЧЕРЕЗ useT('journal') — межразделные подписи ещё не готовы
// (см. комментарий у FavoriteSection в src/domain/journal.ts). Пока — свой список, видимый в шапке
// отчёта и в витрине; просьба подключить показ в сайдбаре журнала — qa/requests/reports.md.
export interface ReportFavorite {
  slug: string;
  addedAt: ISODateTime;
}

// ─────────────────────────── F-12-024: период потери клиента ───────────────────────────
export const CHURN_DAYS_DEFAULT = 60;
/** F-12-025: тот же срок, но для сводки по всей сети — свой ключ в срезе, свой умолчательный день (60) */
export const NETWORK_CHURN_DAYS_DEFAULT = 60;

// ─────────────────────────── F-12-033…039: отчёт «Записи» ───────────────────────────
/**
 * ⚠️ F-12-033: справка отчёта упоминает фильтр по ресурсам и «категорию записи» (первичная консультация и
 * т. п.) — ни ресурсов у брони, ни категории записи в ядре Booking нет (домен не заводит их специально для
 * этого фильтра). Пропущено, отмечено ❓ в ТЗ — не додумываем без поля в ядре; заявка при необходимости —
 * qa/requests/reports.md. Полный список «статусов оплаты» локации в обходе Altegio тоже не раскрыт (❓),
 * поэтому статус оплаты в отчёте — производный (только «с услугами/без»), а не отдельный фильтр по кассе.
 */
export type AppointmentCancelledFilter = 'all' | 'cancelled' | 'notCancelled';
export type AppointmentSourceFilter = 'all' | 'online' | 'offline';
export type AppointmentServicesFilter = 'all' | 'with' | 'without';
export type AppointmentPageSize = 25 | 50 | 100;

export interface AppointmentsFilters {
  createdFrom: ISODate;
  createdTo: ISODate;
  visitFrom?: ISODate;
  visitTo?: ISODate;
  staffId?: Id;
  /** Кто создал: id сотрудника кабинета или 'client' — запись сделана самим клиентом онлайн */
  createdBy?: Id | 'client';
  cancelled: AppointmentCancelledFilter;
  status?: string;
  search?: string;
  source: AppointmentSourceFilter;
  hasServices: AppointmentServicesFilter;
  pageSize: AppointmentPageSize;
}

export function defaultAppointmentsFilters(yearAgoISO: ISODate, todayISO: ISODate): AppointmentsFilters {
  return { createdFrom: yearAgoISO, createdTo: todayISO, cancelled: 'all', source: 'all', hasServices: 'all', pageSize: 25 };
}

export interface AppointmentRow {
  id: Id;
  staffId: Id;
  staffName: string;
  staffSpecialty?: string;
  staffFired: boolean;
  servicesLabel: string;
  clientId?: Id;
  clientName: string;
  clientPhone?: string;
  visitStart: ISODateTime;
  createdByLabel: string;
  createdAt: ISODateTime;
  status: string;
  /** F-12-034: удалённая запись красная — по CYCLE-03/04 удалённые считаются «Отменёнными», отдельного статуса нет */
  isCancelledRow: boolean;
  sourceLabel: string;
  deleted: boolean;
  deletedAt?: ISODateTime;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AppointmentsResult {
  rows: AppointmentRow[];
  total: number;
}

// ─────────────────────────── F-12-009…018: «Основные показатели» ───────────────────────────

export interface ReportDateRange {
  from: string;
  to: string;
}

export interface DashboardFilters {
  staffId?: Id;
  /** Должность (Staff.position.ru как ключ группировки — своего перечня должностей раздел не заводит, F-12-007) */
  position?: string;
}

/** Значение с процентом динамики к предыдущему периоду той же длины (F-12-017); undefined — «новое» (был 0) */
export interface MetricValue {
  value: number;
  /** Значение за прошлый период той же длины — «было X» рядом с процентом (Отч6). Нет — не сравниваем */
  previous?: number;
  deltaPct?: number;
  /** true — предыдущий период был 0 и текущий > 0: показываем «новое», не процент (F-12-017 готово-когда) */
  isNew?: boolean;
}

export interface SalesBlockData {
  total: MetricValue & { count: number };
  services: MetricValue & { count: number };
  products: MetricValue & { count: number };
  /** count — сколько чеков в делителе: визиты + отдельные продажи товаров (Отч5) */
  avgVisit: MetricValue & { count?: number };
  avgService: MetricValue;
  avgProduct: MetricValue;
  /**
   * «Записано на сумму» (решение владельца 01.10.2026): визиты «Клиент пришел» по цене записи — оплачены или нет —
   * плюс оплаченные товары. Плитки выше — полученные деньги. Нет поля — сервер ещё не считает.
   */
  booked?: { total: number; services: number };
  byDay: { date: string; total: number; services: number; products: number }[];
}

export interface AttendanceBlockData {
  clients: MetricValue;
  visits: MetricValue;
  appointments: MetricValue;
  newClients: MetricValue;
  returningClients: MetricValue;
  lostClients: MetricValue;
  byDay: { date: string; newClients: number; returningClients: number }[];
}

export interface OccupancyBlockData {
  completed: { count: number; sharePct: number };
  incomplete: { count: number; sharePct: number };
  cancelled: { count: number; sharePct: number };
  /** Отч9: «Клиент не пришел» отдельно от отмен (раньше сидел внутри cancelled). Сервер может не прислать. */
  noShow?: { count: number; sharePct: number };
  avgOccupancyPct: number;
  byDay: { date: string; occupancyPct: number }[];
}

/** Отч13: дополнительные показатели сводки. Сервер их пока не строит — поле необязательное. */
export interface DashboardExtras {
  /** % клиентов, пришедших в периоде, у которых уже есть следующая запись; null — никто не приходил */
  rebookingPct: number | null;
  rebookedClients: number;
  visitedClients: number;
  /** Неявки ÷ (пришли + не пришли), %; null — не было ни тех, ни других */
  noShowPct: number | null;
  /** Продажи ÷ часы смен мастеров по графику, драм/час; null — графика нет */
  revenuePerScheduledHour: number | null;
  scheduledHours: number;
  /** Откуда пришла первая запись у новых клиентов периода */
  newClientSources: { source: string; count: number }[];
}

export interface MainDashboardData {
  sales: SalesBlockData;
  attendance: AttendanceBlockData;
  occupancy: OccupancyBlockData;
  extras?: DashboardExtras;
  isEmpty: boolean;
}

// ─────────────────────────── F-12-029…032, 038: «Визиты» ───────────────────────────

export type VisitsTab = 'upcoming' | 'past';

export interface VisitRow {
  bookingId: Id;
  date: string;
  time: string;
  durationMin: number;
  clientName?: string;
  clientPhone?: string;
  visitorName?: string;
  services: string[];
  staffName: string;
  canConfirm: boolean;
}

export interface VisitsDay {
  date: string;
  rows: VisitRow[];
}

export type ActivityFilter = 'newOnline' | 'all' | 'online' | 'offline';

export interface ActivityHistoryLine {
  id: string;
  authorName: string;
  action: 'created' | 'updated' | 'statusChanged' | 'moved' | 'deleted';
  summary: string;
  /** Только у action 'moved' (F-12-030): реальные время/мастер до и после, а не заглушка */
  moved?: { prevStart?: ISODateTime; start?: ISODateTime; prevStaffName?: string; staffName?: string };
  at: ISODateTime;
}

export interface ActivityEntry {
  bookingId: Id;
  date: string;
  sourceLabel: string;
  online: boolean;
  serviceNames: string;
  time: string;
  staffName: string;
  clientName?: string;
  clientPhone?: string;
  /** Клиент удалён (ux-best-c2 №4): имя/телефон в UI заменяются на «Удалённый клиент», без ФИО и номера */
  clientDeleted?: boolean;
  durationMin: number;
  history: ActivityHistoryLine[];
}

// ─────────────────────────── F-12-019…023,026,028: «Возвращаемость клиентов» ───────────────────────────

export interface RetentionRow {
  staffId: Id;
  staffName: string;
  total: number;
  newCount: number;
  newPct: number;
  returningCount: number;
  returningPct: number;
  /** Клиентов в прошлом окне (F-12-023) — период потери, примыкающий к началу текущего периода */
  priorWindowClients: number;
  priorWindowReturned: number;
  /** null — «Клиентов за N дней до начала периода» было 0 → показываем «-» (F-12-019) */
  retentionPct: number | null;
}

export interface RetentionReportData {
  rows: RetentionRow[];
  totalUniqueClients: number;
  churnDays: number;
}

// ─────────────────────────── F-12-041…042: «Загруженность сотрудников» ───────────────────────────

export interface WorkloadRow {
  staffId: Id;
  staffName: string;
  workedDays: number;
  /** Рабочие часы по графику за период; null — нет графика вообще (F-12-041 готово-когда, деление на 0) */
  scheduledHours: number | null;
  workedHours: number;
  idleHours: number | null;
  occupancyPct: number | null;
  /** F-12-042: записи после конца периода — число записей (не деньги, в отличие от F-12-051) */
  futureBookings: number;
  byDay: { date: string; occupancyPct: number }[];
  /** F-12-008 «Учитывать сотрудника в заполненности»: снятая галочка убирает его часы из знаменателя средней */
  includedInAverage: boolean;
}

export interface WorkloadReportData {
  rows: WorkloadRow[];
  totalWorkedHours: number;
  totalScheduledHours: number;
}

// ─────────────────────────── F-12-040: «События» (групповые записи) ───────────────────────────

export interface EventRow {
  groupEventId: Id;
  staffName: string;
  serviceName: string;
  date: string;
  time: string;
  durationMin: number;
  capacity: number;
  bookingsCount: number;
  arrivedCount: number;
  paidCount: number;
  paidAmount: number;
  createdByLabel: string;
  /** Событие отменено — строка розовая, остаётся в отчёте (F-12-040 логика: «удалённое» = у нас cancelled) */
  cancelled: boolean;
}

export interface EventsReportTotals {
  bookedPct: number;
  arrivedPct: number;
  paidPct: number;
  avgFillPct: number;
}

export interface EventsReportData {
  rows: EventRow[];
  totals: EventsReportTotals;
}

// ─────────────────────────── F-12-044…045: «Финансовый отчет» ───────────────────────────

export type CashRegisterKind = 'any' | 'cash' | 'noncash';
export type FinanceDetailMode = 'none' | 'byKind' | 'byAccount';

export interface FinanceReportFilters {
  itemId?: Id;
  counterpartyId?: Id;
  serviceId?: Id;
  productId?: Id;
  accountId?: Id;
  registerKind?: CashRegisterKind;
  detail?: FinanceDetailMode;
  showAllItems?: boolean;
}

export interface FinanceReportColumn {
  key: string;
  label: string;
}

export interface FinanceReportRow {
  itemId: Id;
  itemLabel: string;
  itemKind: 'income' | 'expense';
  /** По дате (ISODate) или по колонке (kind/account) → сумма */
  byColumn: Record<string, number>;
  total: number;
}

export interface FinanceReportData {
  /** Отч7: период длиннее 31 дня собирается по месяцам (иначе за год — 730 колонок) */
  granularity?: 'day' | 'month';
  columns: FinanceReportColumn[];
  income: FinanceReportRow[];
  expense: FinanceReportRow[];
  incomeTotal: Record<string, number>;
  expenseTotal: Record<string, number>;
  balanceEndOfDay: Record<string, number>;
  grandIncome: number;
  grandExpense: number;
  chart: { date: string; income: number; expense: number }[];
}

// ─────────────────────────── F-12-046…047: «P&L отчет» ───────────────────────────

export type PayrollDetailMode = 'none' | 'byPosition' | 'byStaff';

export interface PnlRow {
  itemId: Id;
  itemLabel: string;
  itemKind: 'income' | 'expense';
  byMonth: number[];
  total: number;
  /** F-09-091: детализация зарплаты по сотруднику/должности — какие сотрудники входят в эту строку (для клика-раскрытия по месяцу) */
  partyIds?: Id[];
  /** Отч11: строка — пополнения депозитов клиентов: деньги в кассе, но это аванс, а не выручка */
  advance?: boolean;
}

export interface PnlData {
  months: string[];
  income: PnlRow[];
  expense: PnlRow[];
  totalBeforeTax: number[];
  chart: { month: string; income: number; expense: number; profit: number }[];
}

// ─────────────────────────── F-12-048…049: «Отчет по кассе за день» ───────────────────────────

export interface CashDayTile {
  count: number;
  amount: number;
  avg: number;
}

export interface CashDaySummary {
  totalRecords: CashDayTile;
  recordsWithClients: CashDayTile;
  recordsWithoutClients: CashDayTile;
  clients: CashDayTile;
  servicesPaid: CashDayTile;
  accountTopUps: CashDayTile;
  productsPaid: CashDayTile;
  certificatesPaid: CashDayTile;
  membershipsPaid: CashDayTile;
}

export interface CashRegisterRow {
  accountId: Id;
  accountName: string;
  paid: number;
  openingBalance: number;
  closingBalance: number;
}

export interface CashOperationRow {
  operationId: Id;
  time: string;
  clientName?: string;
  staffName: string;
  lineLabel: string;
  cost: number;
  discount: number;
  total: number;
  paid: number;
  clientAccount: number;
  loyalty: number;
  method: string;
  accountName: string;
  cancelled: boolean;
  isRefund: boolean;
}

export interface CashDayReportData {
  summary: CashDaySummary;
  registers: CashRegisterRow[];
  operations: CashOperationRow[];
}

// ─────────────────────────── F-12-050…051: «По сотрудникам» ───────────────────────────

export interface SalesByStaffRow {
  staffId: Id;
  staffName: string;
  revenue: number;
  servicesAmount: number;
  servicesCount: number;
  productsAmount: number;
  productsCount: number;
  discount: number;
  points: number;
  memberships: number;
  certificates: number;
  clientAccounts: number;
  /** F-12-051: сумма будущих записей (деньги, не число — в отличие от F-12-042) */
  futureBookingsAmount: number;
  workedHours: number;
  hourCost: number | null;
  revenueSharePct: number;
  /** «Записано на сумму»: визиты «пришёл» по цене записи + товары (решение владельца 01.10.2026) */
  bookedAmount?: number;
  byDay: { date: string; revenue: number }[];
}

export interface SalesByStaffData {
  rows: SalesByStaffRow[];
  /** Все полученные деньги периода — с приходами без сотрудника (совпадает с «Основными показателями») */
  grandRevenue: number;
  /** Деньги без сотрудника (приход без визита/продавца) — в строках их нет */
  unassignedRevenue?: number;
  grandBooked?: number;
}

// ─────────────────────────── F-12-052: «По сотрудникам в динамике» ───────────────────────────

export interface StaffDynamicsMonth {
  month: string;
  servicesAmount: number;
  servicesCount: number;
  visits: number;
  avgReceipt: number;
  productsAmount: number;
  productsCount: number;
}

export interface StaffDynamicsData {
  staffId: Id;
  staffName: string;
  months: StaffDynamicsMonth[];
}

// ─────────────────────────── F-12-053…054: «По услугам» ───────────────────────────

export interface SalesByServiceRow {
  serviceId: Id;
  serviceName: string;
  categoryName: string;
  count: number;
  discount: number;
  points: number;
  memberships: number;
  certificates: number;
  clientAccounts: number;
  paidMoney: number;
  consumablesCost: number;
  payrollCost: number;
  profit: number;
  revenueSharePct: number;
  /** ⭐ «Допродано» (01.10.2026): сколько раз услуга добавлена к визиту как сопутствующая (строки с upsellOf), шт. */
  upsoldCount: number;
  /** …и на какую сумму по цене записи (price × qty), ֏ — входит в paidMoney */
  upsoldMoney: number;
  byDay: { date: string; paidMoney: number }[];
}

export type SalesByServiceDetailMode = 'byService' | 'byCategory';

export interface SalesByServicesData {
  rows: SalesByServiceRow[];
  grandPaidMoney: number;
}

// ─────────────────────────── F-12-055…056: «По клиентам» ───────────────────────────

export interface SalesByClientRow {
  clientId: Id;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  revenue: number;
  revenueSharePct: number;
  avgReceipt: number;
  visits: number;
  /** F-12-117: клиент удалён, но платежи остаются под его именем — 1:1 с Altegio (в отличие от ленты визитов) */
  clientDeleted?: boolean;
}

export interface SalesByClientsData {
  rows: SalesByClientRow[];
  grandRevenue: number;
}

// ─────────────────────────── F-12-074…080: «Операции с данными» (журнал выгрузок/загрузок) ───────────────────────────

/** F-12-074 «Тип отчёта»: значения из ТЗ 1:1 (включая «Отчет из конструктора отчетов», F-12-112 — ❓ неизвестный тип) */
export const DATA_EXPORT_TYPES = [
  'clients',
  'clientsImport',
  'appointments',
  'appointmentsImport',
  'loyaltyCards',
  'loyaltyCardsImport',
  'memberships',
  'membershipsImport',
  'clientAccounts',
  'transfers',
  'certificates',
  'certificateNumbers',
  'marketplaceRates',
  'reportBuilder',
] as const;
export type DataExportType = (typeof DATA_EXPORT_TYPES)[number];

export type DataExportOperationType = 'upload' | 'copyFromExcel' | 'emailLink' | 'browserDownload';

export interface DataExportLogEntry {
  id: Id;
  staffId: Id;
  staffName: string;
  type: DataExportType;
  operation: DataExportOperationType;
  at: ISODateTime;
  /** F-12-075: имя файла — по нему «скачать снова» (мок: просто повторно строит тот же CSV) */
  fileName: string;
  /** F-12-080: строк в выгрузке — предел показываем, когда близко/превышен (F-12-080 готово-когда) */
  rowCount: number;
}

export interface DataExportFilters {
  staffId?: Id;
  type?: DataExportType;
  operation?: DataExportOperationType;
}

/** F-12-080: пределы выгрузки/загрузки — используются кнопкой выгрузки и журналом */
export const EXPORT_ROW_LIMIT = 5000;

// ─────────────────────────── F-12-116: ФИО клиента в отчётах ───────────────────────────
/**
 * Без права «Просмотр фамилии и отчества клиента» отчёты сокращают фамилию до буквы и прячут отчество
 * (1168): «Carol Jackson» → «Carol J.». У нас отдельного права ещё нет — временно делит `recordsPhones`/
 * `clients.phones` (тот же владелец решает, кому доверить чужие персональные данные) — заявка на своё
 * право `clients.viewFullName` записана в qa/requests/reports.md, F-12-116 не додумывает поведение, только
 * переиспользует существующую галочку.
 */
export function formatClientNameForReports(fullName: string | undefined, hasFullNameAccess: boolean): string | undefined {
  if (!fullName || hasFullNameAccess) return fullName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${last.charAt(0)}.`;
}

// ─────────────────────────── F-12-106: «Моя аналитика» администратора ───────────────────────────
/** Личные показатели администратора за период — F-12-106, только его собственные записи (createdBy === его id) */
export interface MyAnalyticsData {
  createdBookings: number;
  completedByHim: number;
  revenueOfCreated: number;
  distinctClientsBooked: number;
  /** «Операционные записи» — созданы в день визита, на будущую дату (F-12-106) */
  sameDayFutureBookings: number;
  /** Клиенты «пришёл» за период и сколько из них он записал сам */
  arrivedTotal: number;
  arrivedBookedByHim: number;
  /** Перезапись неявившихся: клиенты «не пришёл» за период и сколько из них он перезаписал */
  noShowTotal: number;
  noShowRebookedByHim: number;
  /** F-09-095: «начисленные администратору выплаты» — всего заработано/выплачено/остаток (payroll's api как контракт) */
  payrollEarned: number;
  payrollPaid: number;
  payrollRemaining: number;
}

// ─────────────────────────── F-12-124…126: карта выгрузок и целостность отчётов ───────────────────────────
/** F-12-124: одна строка карты выгрузок/загрузок кабинета вне витрины «Все отчёты» */
export interface ExportMapEntry {
  /** ключ i18n-блока exportsMap.items.<key> (label/where/limit) */
  key: string;
  href?: string;
  permission?: string;
}

export const EXPORT_MAP_ENTRIES: ExportMapEntry[] = [
  { key: 'clients', href: '/biz/clients', permission: 'clients.export' },
  { key: 'services', href: '/biz/services' },
  { key: 'stockGoods', href: '/biz/stock' },
  { key: 'stockOperations', href: '/biz/stock/operations' },
  { key: 'inventory', href: '/biz/stock/inventory' },
  { key: 'financeOps', href: '/biz/finance' },
  { key: 'counterparties', href: '/biz/finance/counterparties' },
  { key: 'documents', href: '/biz/finance/documents' },
  { key: 'payroll', href: '/biz/payroll/period' },
  { key: 'schedulePdf', href: '/biz/schedule' },
  { key: 'privacyExport', href: '/biz/settings' },
  { key: 'networkClients', href: '/biz/network' },
  { key: 'loyaltyCards', href: '/biz/loyalty' },
  { key: 'memberships', href: '/biz/loyalty/memberships' },
  { key: 'certificates', href: '/biz/loyalty/certificates' },
  { key: 'clientAccounts', href: '/biz/loyalty/deposits' },
];
export const IMPORT_ROW_LIMIT = 500;

// ─────────────────────────── b03: F-12-057…062 — «Склад» ───────────────────────────

/** F-12-057: «Остатки на складах» — на выбранную дату, по единице продажи и списания */
export interface StockBalanceRow {
  goodId: Id;
  sku?: string;
  goodName: string;
  categoryName: string;
  qtySale: number;
  saleUnit: string;
  qtyWriteoff: number;
  writeoffUnit: string;
  /** undefined без права viewCost (F-12-057 готово-когда) */
  costPrice?: number;
  markup?: number;
  markupPct?: number;
  price: number;
  totalCost?: number;
  totalValue: number;
}

export interface StockBalanceFilters {
  atDate: ISODate;
  warehouseId?: Id;
  categoryId?: Id;
  onlyCritical?: boolean;
  zeroFilter?: 'all' | 'onlyZero' | 'withoutZero';
  search?: string;
}

/** F-12-058: «Заказ товаров» — товары ниже желаемого остатка (⭐ F-00-137) */
export interface StockOrderRow {
  goodId: Id;
  sku?: string;
  goodName: string;
  categoryName: string;
  stock: number;
  criticalStock: number;
  desiredStock: number;
  shortage: number;
  unit: string;
}

/** F-12-059: «Анализ продаж товаров» — что продано за период с наценкой */
export interface StockSalesAnalysisRow {
  goodId: Id;
  sku?: string;
  barcode?: string;
  goodName: string;
  categoryName: string;
  qty: number;
  /** Сумма себестоимости за ВСЕ проданные единицы (F-12-059 «проверка 2»: не цена одной) */
  costTotal: number;
  markup: number;
  markupPct: number;
  totalValue: number;
}

/** F-12-060: «Анализ расхода материалов» — факт по складским операциям против расчёта по техкартам */
export interface StockUsageAnalysisRow {
  goodId: Id;
  sku?: string;
  barcode?: string;
  categoryName: string;
  goodName: string;
  actualQty: number;
  actualCost: number;
  calcQty: number;
  calcCost: number;
  diffQty: number;
  diffCost: number;
}

/** F-12-061: «Анализ списания товаров» — движение за период: было/пришло/ушло/осталось */
export interface StockWriteOffRow {
  goodId: Id;
  sku?: string;
  barcode?: string;
  goodName: string;
  startQty: number;
  startValue: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  endQty: number;
  endValue: number;
}

export type StockUnitMode = 'sale' | 'writeoff';
export type StockReportView = 'list' | 'tree';

export interface StockWriteOffFilters {
  range: ReportDateRange;
  warehouseId?: Id;
  categoryId?: Id;
  unitMode?: StockUnitMode;
  view?: StockReportView;
  countMoves?: boolean;
}

/** F-12-062: «Анализ оборачиваемости» — формулы 1:1 со справкой (12-reports §18) */
export interface StockTurnoverRow {
  goodId: Id;
  sku?: string;
  goodName: string;
  qtyIn: number;
  startQty: number;
  endQty: number;
  soldQty: number;
  avgStock: number;
  /** Дней, за которые продаётся средний запас; null у товаров с отрицательным/нулевым запасом (F-12-062 багфикс) */
  turnoverDays: number | null;
  turnoverTimes: number | null;
  /** Остаток ÷ ожидаемый среднедневной оборот на ближайший период, в днях; null — нет продаж (та же защита) */
  stockLevelDays: number | null;
}

// ─────────────────────────── b03: F-12-064…067 — «Акции» ───────────────────────────

export interface PromotionsFilters {
  promotionId: Id;
  range: ReportDateRange;
}

export interface PromotionClientsBlock {
  newCount: number;
  returningCount: number;
  cameByPromotion: number;
  cameAgain: number;
  notReturned: number;
  byDay: { date: string; visits: number }[];
}

export interface PromotionStaffRow {
  staffId: Id;
  staffName: string;
  clientsServed: number;
  clientsReturned: number;
}

export interface PromotionsReportData {
  promotionName: string;
  clients: PromotionClientsBlock;
  revenue: number;
  repeatRevenue: number;
  staff: PromotionStaffRow[];
}

/** F-12-067: выгрузка «Не вернулись после акции» — семь колонок из ТЗ 1:1 */
export interface PromotionNotReturnedRow {
  clientId: Id;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  registeredAt?: ISODate;
  lastVisitAt?: ISODate;
  paidByPromotion: number;
  accountBalance: number;
}

// ─────────────────────────── b03: F-12-068…069 — «Отзывы» (⭐ звёздочка вместо оценки) ───────────────────────────

export type ReviewsSubject = 'all' | 'company';

export interface ReviewsFilters {
  range: ReportDateRange;
  /** 'all' | 'company' | staffId сотрудника (F-12-068) */
  subject: ReviewsSubject | Id;
}

/**
 * F-12-068 «У нас»: текстовый отзыв о месте, звёздочка мастеру ИЛИ (В-24, при online.reviewMode
 * бизнеса = 'text') оценка 1–5 с текстом — таблица показывает все виды одной строкой.
 */
export interface ReviewRow {
  id: Id;
  kind: 'company' | 'staffStar' | 'staffReview';
  staffName?: string;
  text?: string;
  /** Только у kind 'staffReview' (В-24) */
  rating?: number;
  /** Только у kind 'staffReview': бизнес скрыл отзыв из онлайн-записи, не удаляя (F-12-069, 1:1) */
  hiddenByBusiness?: boolean;
  createdAt: ISODateTime;
  /** F-12-069: без права reviews.delete кнопки нет — экран решает по PermissionGate, поле не хранится */
}

export interface StaffStarSummaryRow {
  staffId: Id;
  staffName: string;
  starsCount: number;
}

/** В-24: средняя оценка 1–5 по мастеру за период (только при online.reviewMode = 'text') */
export interface StaffRatingSummaryRow {
  staffId: Id;
  staffName: string;
  avgRating: number;
  count: number;
}

// ─────────────────────────── b03: F-12-070…071 — «Сообщения» ───────────────────────────

export interface MessagesReportFilters {
  range: ReportDateRange;
  typeCode?: string;
  status?: string;
  phoneSearch?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
}

export interface MessagesReportRow {
  id: Id;
  at: ISODateTime;
  typeLabel: string;
  channel: string;
  status: string;
  /** Без права reports.messagesPhones маскируется в экране, не здесь (сырые данные всегда полные) */
  contact: string;
  text: string;
}

export interface MessagesReportResult {
  items: MessagesReportRow[];
  total: number;
}

// ─────────────────────────── b03: F-12-072…073 — «Звонки» ───────────────────────────

export interface CallsReportRow {
  id: Id;
  at: ISODateTime;
  phone: string;
  direction: 'in' | 'out';
  status: 'accepted' | 'missed';
  durationSec: number;
  staffName?: string;
  hasRecording: boolean;
}

// ─────────────────────────── b03: F-12-076…077 — «Изменения данных» ───────────────────────────

export type DataChangeEntity = 'booking' | 'financeOperation' | 'stockOperation' | 'network';
export type DataChangeAction = 'create' | 'update' | 'delete' | 'restore';

export interface DataChangeHistoryLine {
  at: ISODateTime;
  authorName: string;
  summary: string;
}

export interface DataChangeEntry {
  id: Id;
  entity: DataChangeEntity;
  entityId: Id;
  /**
   * Короткая деталь СВОИМИ данными (имя клиента / номер документа / контрагент) — НЕ готовая фраза: язык
   * фразы «Запись от …» и дата собираются в экране через t() + useFormat, отдельно от этого поля, — API
   * не хардкодит текст (никогда не хардкодить пользовательский текст, AGENTS.md §i18n).
   */
  entityLabel: string;
  deleted: boolean;
  authorName: string;
  action: DataChangeAction;
  at: ISODateTime;
  history: DataChangeHistoryLine[];
}

export interface DataChangesFilters {
  from: ISODate;
  to: ISODate;
  entity?: DataChangeEntity;
  authorName?: string;
  action?: DataChangeAction;
  pageSize?: 25 | 100;
}

// ─────────────────────────── b03: F-12-084…089 — права раздела «Отчёты» ───────────────────────────

/**
 * ⭐ 25 галочек группы «Отчёты» из F-12-084 — своё мелкое право раздела (как StockStaffPermissions в
 * stock.ts): в ядре нет места для прав раздела уровня «отчёт+действие», хранится в своём срезе по
 * staffId. Переключатель самих групп (finance.view/stock.view/reports.view) остаётся в @/config/permissions;
 * здесь — что ВНУТРИ группы «Отчёты» видно и что можно выгрузить (F-12-084…089). Экран-редактор (карточка
 * сотрудника → вкладка «Доступ» → группа «Отчёты») — расширение чужого хоста staff/resources, которого пока
 * нет: просьба заведена в qa/requests/reports.md; здесь — модель и применение прав в самих отчётах.
 */
export type RecordsHistoryDepth = 1 | 7 | 30 | 90 | 180 | 'all' | 'none';

export interface ReportsStaffPermissions {
  dashboard: boolean;
  recordsView: boolean;
  recordsDepth: RecordsHistoryDepth;
  recordsExport: boolean;
  recordsPhones: boolean;
  /**
   * F-12-087 «Доступ к отчету по кассе за день»: у Altegio эти три права лежат в группе «Финансы», не
   * «Отчёты» — здесь смоделированы рядом с остальными правами раздела за неимением своего экрана-редактора
   * группы «Финансы» (то же ограничение, что у F-12-084…089). financePeriod/financeYear гейтят «Финансовый
   * отчет»/«P&L»; cashDayTodayOnly сужает «Отчёт по кассе за день» до сегодняшней даты (F-12-087 готово-когда).
   */
  financePeriod: boolean;
  financeYear: boolean;
  cashDayTodayOnly: boolean;
  events: boolean;
  visits: boolean;
  visitsPhones: boolean;
  retention: boolean;
  workload: boolean;
  adminAnalytics: boolean;
  salesByStaff: boolean;
  salesByStaffDynamics: boolean;
  salesByServices: boolean;
  salesByClients: boolean;
  promotions: boolean;
  reviewsView: boolean;
  reviewsDelete: boolean;
  messagesView: boolean;
  messagesExport: boolean;
  messagesPhones: boolean;
  callsView: boolean;
  callsExport: boolean;
  callsPhones: boolean;
  dataExports: boolean;
  dataChanges: boolean;
}

/** F-12-084: владелец — «25 из 25» включено; F-12-085/088 умолчание не полное, если base.view только смотрит */
export function defaultReportsPermissions(base: { edit: boolean; view: boolean }): ReportsStaffPermissions {
  const full = base.edit || base.view;
  return {
    dashboard: full,
    recordsView: full,
    recordsDepth: full ? 'all' : 30,
    recordsExport: base.edit,
    recordsPhones: base.edit,
    financePeriod: full,
    financeYear: full,
    cashDayTodayOnly: !base.edit,
    events: full,
    visits: full,
    visitsPhones: base.edit,
    retention: full,
    workload: full,
    adminAnalytics: base.edit,
    salesByStaff: full,
    salesByStaffDynamics: full,
    salesByServices: full,
    salesByClients: full,
    promotions: full,
    reviewsView: full,
    reviewsDelete: base.edit,
    messagesView: full,
    messagesExport: base.edit,
    messagesPhones: base.edit,
    callsView: full,
    callsExport: base.edit,
    callsPhones: base.edit,
    dataExports: base.edit,
    dataChanges: base.edit,
  };
}

/** F-12-085 готово-когда: глубина в днях для сравнения с датой строки; 'all'/'none' — крайние случаи */
export function withinRecordsDepth(dateISO: ISODate, depth: RecordsHistoryDepth, todayISO: ISODate): boolean {
  if (depth === 'all') return true;
  if (depth === 'none') return false;
  const days = (Date.parse(todayISO) - Date.parse(dateISO)) / 86_400_000;
  return days <= depth;
}

// F-12-086: маскировка телефона без права — переиспользуем f.maskedPhone из '@/i18n/useFormat'
// (lib/phone.ts), а не свой формат: тот же случай «номер скрыт без права/согласия», что и везде в
// приложении (CONVENTIONS §17/18 — готовые правила вместо своих).

/** F-12-081: расписание ссылки на Excel-отчёт «Выполнение плана» на почту пользователя сети. */
export type PlanEmailSchedule = 'none' | 'daily' | 'weekly' | 'monthly';
export const PLAN_EMAIL_SCHEDULE_DEFAULT: PlanEmailSchedule = 'none';

/**
 * F-12-083 «Сообщение "еженедельный отчёт"»: своих настроек у Altegio не нашли (❓ в ТЗ) — по нашему решению
 * (⭐, к обсуждению) это переключатель «раз в неделю присылать владельцу сводку салона»; хранится по бизнесу,
 * лог отправок — свой (не путать с журналом «Сообщений» notify, F-12-070, который мы не пишем изнутри reports).
 */
export interface WeeklyReportSettings {
  enabled: boolean;
  /** Последняя «отправка» (мок — просто дата постановки в очередь) */
  lastSentAt: string | null;
}
export const WEEKLY_REPORT_DEFAULT: WeeklyReportSettings = { enabled: false, lastSentAt: null };

/** F-12-083 готово-когда: следующая отправка — через 7 дней после последней (или сразу, если ещё не было) */
export function nextWeeklyReportAt(settings: WeeklyReportSettings, nowISO: string): string {
  if (!settings.lastSentAt) return nowISO;
  return new Date(new Date(settings.lastSentAt).getTime() + 7 * 86_400_000).toISOString();
}

// ─────────────────────────── ⭐ Главная владельца (владелец, 01.10.2026) ───────────────────────────

/**
 * Клиент в списках главной: «Пора позвать» (срок повтора услуги прошёл, будущей записи нет) и «Не записались снова»
 * (пришли в периоде, следующей записи нет). Телефон — только при праве clients.phones (иначе undefined).
 */
export interface HomeClientRow {
  clientId: Id;
  name: string;
  phone?: string;
  /** Последний визит «Пришёл», дата */
  lastVisit?: ISODate;
  /** «Пора снова» с этой даты (только у «Пора позвать») */
  dueAt?: ISODate;
  /** Услуга последнего визита (название как в каталоге) */
  serviceName?: { ru: string; hy?: string; en?: string };
}

/**
 * Пять цифр главной владельца — каждая считается ТЕМИ ЖЕ функциями, что отчёт, куда ведёт её кнопка:
 * выручка — план месяца (полученные деньги, receivedMoney), загрузка — «Загруженность сотрудников», перезапись и
 * «не пришли» — «Основные показатели» за тот же период, «Пора позвать» — подборка «Пора записать» в «Клиентах».
 */
export interface OwnerHomeData {
  /** Период цифр 2–4 (последние 30 дней, как «Основные показатели» по умолчанию) */
  range: ReportDateRange;
  /** Месяц плана, YYYY-MM */
  month: string;
  plan: { goal: number | null; revenue: number; percent: number | null };
  load: { pct: number | null; workedHours: number; scheduledHours: number };
  rebooking: { pct: number | null; rebooked: number; visited: number; notRebooked: HomeClientRow[] };
  noShow: { count: number; pct: number | null };
  due: { count: number; clients: HomeClientRow[] };
  /** Отдача от рассылок периода; null — рассылок в периоде не было (блок не показываем) */
  mailings: MailingReturn | null;
  /** Первые шаги пустого салона */
  setup: { services: number; masters: number; bookings: number };
  /** Ни одной записи за всё время — вместо цифр «первые шаги» */
  isEmpty: boolean;
}

/** Записи, сделанные получателями рассылки в течение windowDays дней после неё */
export interface MailingReturn {
  mailings: number;
  recipients: number;
  /** Получателей, которые записались */
  bookedClients: number;
  bookings: number;
  /** Сумма этих записей по цене записи, драм (не выручка: деньги ещё не получены) */
  bookedAmount: number;
  windowDays: number;
}

/** Окно «записался после рассылки» */
export const MAILING_RETURN_WINDOW_DAYS = 7;
/** Сколько клиентов отдаём в список главной (остальное — в «Клиентах») */
export const HOME_LIST_LIMIT = 50;

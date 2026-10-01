"use client";

/**
 * API раздела «payroll». Принадлежит разделу.
 * Функции — async поверх request() из '@/api/request'; свой срез — readArea/mutateArea из '@/api/area';
 * сущности ядра — функции '@/api/core'. Экраны зовут эти функции через useApiQuery/useApiMutation.
 */
import type { Booking, Id, ISODate, Staff } from "@/domain/core";
import {
  applyPayout,
  payoutForTarget,
  productSaleBase,
  applyDailyGuaranteedMinimum,
  applyMonthlyGuaranteedMinimum,
  canMarkPaid,
  computeServicesForDay,
  defaultGeneralSettings,
  emptyChart,
  emptyCriterion,
  emptyRule,
  emptyScheme,
  evaluateCriterion,
  extraRevenueAmount,
  locationServicesTurnover,
  monthlySalaryQualifies,
  monthLastDay,
  monthWorkShare,
  nextApprovalStatus,
  onlineWidgetRewardForDay,
  packageServiceStaffBases,
  pickRuleForChart,
  qualifyingMonthlySalaryMonths,
  recordsRewardForDay,
  resolveActiveChartAssignment,
  roundMoney,
  ruleAsScheme,
  evaluateCriterionForStaff,
  applySchemeVersion,
  emptyPayBreakdown,
  periodIsWholeMonth,
  schemeAtDate,
  validateScheme,
  schemeFromTemplate,
  serviceCostBasisPayout,
  staffWorkedHoursOnDay,
  sumDayResult,
  type BonusPenaltyKind,
  type BonusPenaltyType,
  type DayComputation,
  type GeneralSettings,
  type PackagePriceMethod,
  type PackageServiceInput,
  type PayrollChart,
  type PayrollChartAssignment,
  type PayrollChartType,
  type PayrollCriterion,
  type PayrollRule,
  type PayrollScheme,
  type PayrollScopeAccess,
  type PayBreakdown,
  type SchemeTemplateId,
  type PayrollStaffRights,
  type PeriodComputation,
  type PeriodRow,
  type StaffDayResult,
  type StatementApproval,
  type StatementComputation,
  type StatementOperation,
} from "@/domain/payroll";
import { assertCan, currentActor } from "@/api/core";
import { mutateArea, readArea, readCore } from "@/api/area";
import { ApiError, request } from "@/api/request";
import { eachDay, nowDateTime, today } from "@/lib/date";
import { newId } from "@/lib/id";
import { costPriceAt } from "@/api/stock";
import { cardFeePct, calcAcquiringFee, bookingAmountDue } from "@/domain/finance";
import { prepaidAmount } from "@/domain/rules";
import { listSettlementEntries } from "@/api/finance";
import { settlementBalance, settlementEntrySign } from "@/domain/finance";
import type { AssistantShare, LoyaltyPaidBreakdown } from "@/domain/payroll";
import { logChange } from "@/api/staff";
import { getScheduledMinutes } from "@/api/schedule/table";
import { isApiMode } from "@/api/http";
import * as Server from "@/api/payroll.server";
import * as JM from "@/api/journal-more.server";
import { apiIdentity } from "@/api/identity";
import { listStaff as serverListStaff } from "@/api/staff.server";

/**
 * F-09-082 (⭐ по нашему решению, отличие от Altegio 1:1 — у них зарплатные действия в журнал не
 * попадают): каждая правка схемы, ведомости и премии видна в общем журнале изменений (⭐ F-00-040,
 * `/biz/staff/log`) — тем же `logChange()`, что и другие разделы (см. `src/api/services.ts`).
 * Fire-and-forget (без `await`/`catch` — запись в журнал не должна ронять зарплатную операцию).
 */
function writeAudit(
  businessId: Id,
  entity: string,
  entityId: Id,
  action: string,
  before: unknown,
  after: unknown,
): void {
  void logChange({ businessId, entity, entityId, action, before, after });
}

// ─────────────────────────── Данные, которых ждёт движок, от других разделов ───────────────────────────

/**
 * F-09-019: сумма визита, закрытая каждым видом лояльности — `readArea('loyalty').transactions`
 * (LoyaltyTxType уже различает bookingId, тип и сумму); amount у списаний отрицательный.
 */
function loyaltyPaidLookup(
  businessId: Id,
): (bookingId: Id) => LoyaltyPaidBreakdown | undefined {
  const txByBooking = new Map<Id, LoyaltyPaidBreakdown>();
  for (const tx of readArea("loyalty").transactions) {
    if (tx.businessId !== businessId || !tx.bookingId) continue;
    const amount = Math.abs(tx.amount);
    if (amount <= 0) continue;
    const entry = txByBooking.get(tx.bookingId) ?? {
      bonus: 0,
      membership: 0,
      clientAccount: 0,
      certificate: 0,
      promotion: 0,
    };
    if (tx.type === "cardCharge") entry.bonus += amount;
    else if (tx.type === "membershipUse") entry.membership += amount;
    else if (tx.type === "accountCharge") entry.clientAccount += amount;
    else if (tx.type === "certificateCharge") entry.certificate += amount;
    else if (tx.type === "promoDiscount") entry.promotion += amount;
    else continue;
    txByBooking.set(tx.bookingId, entry);
  }
  return (bookingId) => txByBooking.get(bookingId);
}

/**
 * F-09-046/047: ассистенты строки услуги и их доли — `readArea('resources').bookingAssistants`,
 * тем же ключом `"<bookingId>:<serviceIndex>"`, что пишет `setBookingAssistants` (src/api/resources.ts,
 * CONVENTIONS §6: используем чужой срез как публичный контракт, не правим чужой файл).
 */
function assistantsForLineLookup(): (
  bookingId: Id,
  serviceIndex: number,
) => AssistantShare[] {
  const byLine = readArea("resources").bookingAssistants as Record<
    string,
    { staffId: Id; sharePercent: number }[]
  >;
  return (bookingId, serviceIndex) =>
    (byLine[`${bookingId}:${serviceIndex}`] ?? []).map((a) => ({
      staffId: a.staffId,
      sharePct: a.sharePercent,
    }));
}

/**
 * F-09-110: себестоимость техкарты пары «услуга × мастер» — `readArea('stock').techCards` +
 * `costPriceAt()` (F-08-097/098, средняя/последний приход по дате визита).
 */
function techCardCostLookup(
  businessId: Id,
  locationId: Id,
): (serviceId: Id, staffId: Id, atDate: ISODate) => number | undefined {
  const cards = readArea("stock").techCards.filter(
    (c) => c.businessId === businessId && c.locationId === locationId,
  );
  return (serviceId, staffId, atDate) => {
    const card = cards.find(
      (c) => c.serviceId === serviceId && c.staffId === staffId,
    );
    if (!card || card.lines.length === 0) return undefined;
    return roundMoney(
      card.lines.reduce(
        (sum, line) =>
          sum + line.qtyWriteoff * costPriceAt(businessId, line.goodId, atDate),
        0,
      ),
    );
  };
}

/**
 * F-09-007/107: комиссия эквайринга по визиту — только оплаты картой (`readArea('finance')
 * .bookingPayments`, methodKey 'card', F-07-181), процент — из «Методы оплаты и комиссии» (F-07-027).
 * Наличные и другие методы комиссии не создают (F-09-107).
 */
function cardCommissionLookup(businessId: Id): (bookingId: Id) => number {
  const finance = readArea("finance");
  const cardSettings = finance.paymentMethods[businessId]?.card;
  if (!cardSettings) return () => 0;
  const byBooking = new Map<Id, number>();
  for (const p of finance.bookingPayments) {
    if (p.businessId !== businessId || p.cancelled || p.methodKey !== "card")
      continue;
    const fee = calcAcquiringFee(p.amount, cardFeePct(cardSettings));
    byBooking.set(
      p.bookingId,
      roundMoney((byBooking.get(p.bookingId) ?? 0) + fee),
    );
  }
  return (bookingId) => byBooking.get(bookingId) ?? 0;
}

/**
 * F-09-006: сколько из суммы визита ещё не оплачено — то же правило ядра, что и «К оплате» окна записи
 * (`bookingAmountDue`, F-07-039/181, `readArea('finance').bookingPayments`), не своя копия. Полный или
 * частичный возврат (F-07-066/042) и отмена одного платежа уменьшают сумму активных строк визита, поэтому
 * `bookingAmountDue` растёт сама — без отдельного кода на «возврат». Удалённый визит (`deletedAt`) сюда
 * не попадает — его целиком убирает фильтр `!deletedAt` в `computeServicesForDay`, до вызова этого хука.
 */
function unpaidForBookingLookup(businessId: Id): (bookingId: Id) => number {
  const finance = readArea("finance");
  const core = readCore();
  const paymentsByBooking = new Map<Id, typeof finance.bookingPayments>();
  for (const p of finance.bookingPayments) {
    if (p.businessId !== businessId) continue;
    const list = paymentsByBooking.get(p.bookingId) ?? [];
    list.push(p);
    paymentsByBooking.set(p.bookingId, list);
  }
  return (bookingId) => {
    const booking = core.bookings.find((b) => b.id === bookingId);
    if (!booking) return 0;
    // ⭐ F-00-097 (решение владельца 01.10): предоплата, переведённая на реквизиты мастера, — своя операция
    // финансов (не строка bookingPayments), касса визита берёт только остаток. Для зарплаты это тоже оплаченная
    // часть визита — ровно один раз (то же правило, что amountDueOf в api/finance.ts); «Вернул» — уже не оплата.
    const prepaid = booking.prepayment?.refundedAt
      ? 0
      : Math.min(prepaidAmount(booking), booking.total);
    const lines = paymentsByBooking.get(bookingId) ?? [];
    return bookingAmountDue(
      booking.total,
      prepaid > 0 ? [...lines, { amount: prepaid, cancelled: false }] : lines,
    );
  };
}

/**
 * F-09-005 (QA 01.10): при «Дата поступления средств на банковский счет» визит начисляется днём, когда
 * пришли ПОСЛЕДНИЕ деньги по нему: дата платежа + «Время обработки платежа» карты (календарные дни,
 * F-07-027; у наличных и прочих — 0), предоплата на реквизиты — датой её операции. Визит без оплат
 * остаётся на дате визита (его база и так 0 — F-09-017). При «Дата визита» — undefined (прежнее поведение).
 */
function accrualDateLookup(
  businessId: Id,
  settings: GeneralSettings | undefined,
): ((bookingId: Id) => ISODate | undefined) | undefined {
  if (settings?.accrualDateBasis !== "received") return undefined;
  const finance = readArea("finance");
  const cardDays = Math.max(0, finance.paymentMethods[businessId]?.card?.settlementDays ?? 0);
  const latest = new Map<Id, ISODate>();
  const bump = (bookingId: Id, day: ISODate) => {
    const cur = latest.get(bookingId);
    if (!cur || day > cur) latest.set(bookingId, day);
  };
  for (const p of finance.bookingPayments) {
    if (p.businessId !== businessId || p.cancelled) continue;
    const day = p.createdAt.slice(0, 10) as ISODate;
    bump(p.bookingId, p.methodKey === "card" && cardDays > 0 ? addDaysIso(day, cardDays) : day);
  }
  for (const o of finance.operations) {
    if (o.businessId !== businessId || o.cancelled || o.kind !== "income" || !o.refId) continue;
    if (o.lineLabel !== "Предоплата") continue;
    bump(o.refId, o.date.slice(0, 10) as ISODate);
  }
  return (bookingId) => latest.get(bookingId);
}

function addDaysIso(day: ISODate, days: number): ISODate {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) as ISODate;
}

// ─────────────────────────── Основные настройки (F-09-004/005) ───────────────────────────

export const payrollKeys = {
  settings: (locationId: Id | undefined) =>
    ["payroll", "settings", locationId] as const,
  scheme: (staffId: Id | undefined) => ["payroll", "scheme", staffId] as const,
  schemesList: (businessId: Id | undefined) =>
    ["payroll", "schemesList", businessId] as const,
  day: (locationId: Id | undefined, date: ISODate | undefined) =>
    ["payroll", "day", locationId, date] as const,
  period: (
    locationId: Id | undefined,
    from: ISODate | undefined,
    to: ISODate | undefined,
    positionKey: string | undefined,
  ) => ["payroll", "period", locationId, from, to, positionKey] as const,
};

export function getGeneralSettings(
  locationId: Id,
): Promise<GeneralSettings | undefined> {
  if (isApiMode()) return Server.getGeneralSettings(locationId);
  return request(() => readArea("payroll").settingsByLocation[locationId]);
}

export function saveGeneralSettings(
  settings: GeneralSettings,
): Promise<GeneralSettings> {
  if (isApiMode()) return Server.saveGeneralSettings(settings);
  return request(() => {
    assertCan("payroll.manage");
    const before = readArea("payroll").settingsByLocation[settings.locationId];
    const saved: GeneralSettings = { ...settings, updatedAt: nowDateTime() };
    mutateArea("payroll", (s) => {
      s.settingsByLocation[settings.locationId] = saved;
    });
    const location = readCore().locations.find(
      (l) => l.id === settings.locationId,
    );
    if (location)
      writeAudit(
        location.businessId,
        "payrollSettings",
        settings.locationId,
        "updated",
        before,
        saved,
      );
    return saved;
  });
}

// ─────────────────────────── Схема сотрудника (F-09-010…013) ───────────────────────────

export function getScheme(staffId: Id): Promise<PayrollScheme | undefined> {
  if (isApiMode()) return Server.getScheme(staffId);
  return request(() => readArea("payroll").schemesByStaff[staffId]);
}

export function saveScheme(scheme: PayrollScheme): Promise<PayrollScheme> {
  if (isApiMode()) return Server.saveScheme(scheme);
  return request(() => {
    assertCan("payroll.manage");
    // З4: 150%, −20%, оклад −8 000 больше не сохраняются — та же проверка, что держит кнопку в форме
    if (validateScheme(scheme).length > 0) throw new ApiError("validation");
    const before = readArea("payroll").schemesByStaff[scheme.staffId];
    const staffRec = readCore().staff.find((s) => s.id === scheme.staffId);
    // З11: самый поздний «закрыто по» среди филиалов сотрудника
    const settingsByLocation = readArea("payroll").settingsByLocation;
    const closedThrough = (staffRec?.locationIds ?? [])
      .map((id) => settingsByLocation[id]?.closedThrough ?? "")
      .reduce((a, b) => (b > a ? b : a), "");
    // З6: версия с «Действует с» — прошлые визиты считаются по прежней версии
    const versioned = applySchemeVersion(before, scheme, closedThrough || undefined);
    if ("error" in versioned) throw new ApiError(`scheme_${versioned.error}`);
    const saved: PayrollScheme = { ...versioned.scheme, updatedAt: nowDateTime() };
    mutateArea("payroll", (s) => {
      s.schemesByStaff[scheme.staffId] = saved;
    });
    const staff = readCore().staff.find((s) => s.id === scheme.staffId);
    if (staff)
      writeAudit(
        staff.businessId,
        "payrollScheme",
        scheme.staffId,
        before ? "updated" : "created",
        before,
        saved,
      );
    return saved;
  });
}

/** F-09-012: переносит схему сотрудника-образца целиком, заменяя все блоки получателя */
export function copyScheme(
  fromStaffId: Id,
  toStaffId: Id,
): Promise<PayrollScheme> {
  if (isApiMode()) return Server.copyScheme(fromStaffId, toStaffId);
  return request(() => {
    assertCan("payroll.manage");
    const source = readArea("payroll").schemesByStaff[fromStaffId];
    if (!source) throw new ApiError("not_found");
    const existing = readArea("payroll").schemesByStaff[toStaffId];
    const now = nowDateTime();
    // F-09-037 условие 3: у получателя своя дата «начала» схемы — первое сохранение для НЕГО, а не
    // дата сотрудника-образца; уже настроенному сотруднику дата не переезжает.
    const copied: PayrollScheme = {
      ...source,
      staffId: toStaffId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    mutateArea("payroll", (s) => {
      s.schemesByStaff[toStaffId] = copied;
    });
    return copied;
  });
}

export interface StaffSchemeStatus {
  staff: Staff;
  scheme: PayrollScheme | undefined;
}

/** F-09-001/010: список сотрудников локации с состоянием их схемы, для экрана «Схемы расчёта» */
export function listStaffSchemeStatus(
  businessId: Id,
  locationId?: Id,
): Promise<StaffSchemeStatus[]> {
  if (isApiMode()) {
    return Promise.all([serverListStaff(businessId), Server.listSchemesByBusiness(businessId)]).then(
      ([rows, schemes]) =>
        rows
          .map((r) => r.staff)
          .filter((s) => s.status !== "fired" && s.status !== "disabled")
          .filter((s) => !locationId || s.locationIds.includes(locationId))
          .map((s) => ({ staff: s, scheme: schemes[s.id] })),
    );
  }
  return request(() => {
    const schemes = readArea("payroll").schemesByStaff;
    const staff = readCore()
      .staff.filter(
        (s) =>
          s.businessId === businessId &&
          s.status !== "fired" &&
          s.status !== "disabled",
      )
      .filter((s) => !locationId || s.locationIds.includes(locationId));
    return staff.map((s) => ({ staff: s, scheme: schemes[s.id] }));
  });
}

/**
 * Решение владельца 01.10.2026: без payroll.view / payroll.manage — только своя зарплата, и режется это в API,
 * а не только на экране. Возвращает staffId, которым надо ограничить строки, или undefined (видно всех).
 */
function ownOnlyStaffIdForActor(): Id | "nobody" | undefined {
  const actor = currentActor();
  if (actor.permissions.has("payroll.view") || actor.permissions.has("payroll.manage")) return undefined;
  return actor.staffId ?? "nobody";
}

// ─────────────────────────── Расчёт за день (F-09-058…061) ───────────────────────────

function workdayAmountForDay(
  scheme: PayrollScheme | undefined,
  hours: number,
): number {
  if (!scheme?.workday.enabled) return 0;
  if (scheme.workday.basePeriod === "hour")
    return roundMoney(scheme.workday.baseAmount * hours);
  if (scheme.workday.basePeriod === "day")
    return hours > 0 ? scheme.workday.baseAmount : 0;
  return 0; // 'month' — только в расчёте за период (F-09-037): один день не может доказать целый месяц
}

/**
 * F-09-002/054/099: реальный расчёт учитывает классическую модель («Правила расчёта» + «Критерии
 * расчёта» + «Схемы расчёта»), а не только упрощённую схему сотрудника — компания, переключившая
 * «Основные настройки → Модель настройки зарплаты» на «Классическая», продолжает работать с правилами,
 * критериями и схемами: `computeDay`/`computePeriod` считают именно по ним.
 * Для каждого сотрудника: если у филиала классическая модель и у сотрудника есть действующее на `date`
 * назначение схемы (F-09-055/099, назначение с наибольшей startDate ≤ date), выбираем правило по схеме
 * (F-09-054: первый выполненный критерий сверху, иначе стандартное) и считаем движком по НЕМУ (F-09-050:
 * то же правило имеет те же блоки, что упрощённая схема). Без назначения или в упрощённой модели —
 * прежнее поведение (`schemesByStaff`). Критерий проверяется по реальному обороту сотрудника/филиала за
 * его период (F-09-052) — `evaluateCriterionForStaff`, только `metric: 'turnover'` (🔒 qa/requests/payroll.md).
 */
function resolveEffectiveSchemes(
  businessId: Id,
  staffList: readonly Staff[],
  locationId: Id,
  date: ISODate,
  bookings: readonly Booking[],
  generalSettings: GeneralSettings | undefined,
): Map<Id, PayrollScheme> {
  const payrollArea = readArea("payroll");
  const schemesRaw = payrollArea.schemesByStaff;
  const map = new Map<Id, PayrollScheme>();
  const isClassic = generalSettings?.payrollModel === "classic";
  if (isClassic) {
    const chartsById = new Map(
      payrollArea.charts
        .filter((c) => c.businessId === businessId)
        .map((c) => [c.id, c]),
    );
    const rulesById = new Map(
      payrollArea.rules
        .filter((r) => r.businessId === businessId)
        .map((r) => [r.id, r]),
    );
    const criteriaById = new Map(
      payrollArea.criteria
        .filter((c) => c.businessId === businessId)
        .map((c) => [c.id, c]),
    );
    const assignments = payrollArea.chartAssignments;
    const monthStart = `${date.slice(0, 7)}-01`;
    for (const staff of staffList) {
      const assignment = resolveActiveChartAssignment(
        assignments,
        staff.id,
        date,
      );
      const chart = assignment ? chartsById.get(assignment.chartId) : undefined;
      if (chart) {
        const ruleId = pickRuleForChart(chart, (criterionId) => {
          const criterion = criteriaById.get(criterionId);
          if (!criterion) return false;
          const periodFrom = criterion.period === "day" ? date : monthStart;
          return evaluateCriterionForStaff(
            criterion,
            bookings,
            staff.id,
            locationId,
            periodFrom,
            date,
          );
        });
        const rule = ruleId ? rulesById.get(ruleId) : undefined;
        if (rule) {
          map.set(staff.id, ruleAsScheme(rule, staff.id, nowDateTime()));
          continue;
        }
      }
      const simplified = schemesRaw[staff.id];
      if (simplified) map.set(staff.id, schemeAtDate(simplified, date));
    }
    return map;
  }
  // З6: версия схемы, действующая на дату визита, — правка ставки не пересчитывает прошлое
  for (const staff of staffList) {
    const simplified = schemesRaw[staff.id];
    if (simplified) map.set(staff.id, schemeAtDate(simplified, date));
  }
  return map;
}

export function computeDay(
  locationId: Id,
  date: ISODate,
): Promise<DayComputation> {
  if (isApiMode()) return Server.computeDay(locationId, date);
  return request(() => {
    const core = readCore();
    const location = core.locations.find((l) => l.id === locationId);
    if (!location) throw new ApiError("not_found");
    const ownOnly = ownOnlyStaffIdForActor();
    const staffList = core.staff.filter(
      (s) =>
        s.locationIds.includes(locationId) &&
        s.status !== "fired" &&
        s.status !== "disabled" &&
        (ownOnly === undefined || s.id === ownOnly),
    );
    const generalSettings = readArea("payroll").settingsByLocation[locationId];
    const schemes = resolveEffectiveSchemes(
      location.businessId,
      staffList,
      locationId,
      date,
      core.bookings,
      generalSettings,
    );
    const anyConfigured = schemes.size > 0;

    const opsByStaff = computeServicesForDay({
      date,
      locationId,
      staffIds: staffList.map((s) => s.id),
      bookings: core.bookings,
      groupEvents: core.groupEvents,
      services: core.services,
      schemes,
      loyaltyPaidForBooking: loyaltyPaidLookup(location.businessId),
      techCardCost: techCardCostLookup(location.businessId, locationId),
      cardCommissionForBooking: cardCommissionLookup(location.businessId),
      bankCommissionSplit: generalSettings?.bankCommissionSplit,
      unpaidForBooking: unpaidForBookingLookup(location.businessId),
      assistantsForLine: assistantsForLineLookup(),
      accrualDateForBooking: accrualDateLookup(location.businessId, generalSettings),
    });
    const turnover = locationServicesTurnover(core.bookings, locationId, date);
    const events = core.bookingEvents ?? [];
    // F-09-031/111 (QA 30.09): % с продаж товаров — тем же productSalesPay, что и «Расчёт за период»;
    // раньше день всегда показывал 0, и сумма дней расходилась с периодом на выплату за товары.
    const productsCtx = payContext(locationId);
    const expenseCache: ExpenseCache = new Map();

    const staffResults: StaffDayResult[] = [];
    for (const staff of staffList) {
      const scheme = schemes.get(staff.id);
      const operations = opsByStaff.get(staff.id) ?? [];
      const servicesAmount = roundMoney(
        operations.reduce((sum, op) => sum + op.amount, 0),
      );
      const hours = staffWorkedHoursOnDay(core, staff.id, date, locationId);
      const workdayAmount = workdayAmountForDay(scheme, hours);
      // F-09-039/040/041: за каждую услугу в записи, которую сотрудник создал, + отдельно за услуги
      // в записях, закрытых из онлайн-виджета, где он первым поставил «Клиент пришел»
      const recordsAmount = scheme?.records.enabled
        ? roundMoney(
            recordsRewardForDay(
              core.bookings,
              staff.id,
              date,
              scheme.records,
              core.services,
              locationId,
            ) +
              onlineWidgetRewardForDay(
                core.bookings,
                events,
                staff.id,
                date,
                scheme.records,
                core.services,
                locationId,
              ),
          )
        : 0;
      const extraAmount = roundMoney(
        (scheme?.extraServiceRevenue.enabled
          ? extraRevenueAmount(
              turnover,
              scheme.extraServiceRevenue,
              locationExpensesForDay(location.businessId, locationId, date, expenseCache),
            )
          : 0) +
          (scheme?.extraProductRevenue.enabled
            ? extraRevenueAmount(
                locationProductsTurnover(location.businessId, locationId, date),
                scheme.extraProductRevenue,
                locationProductsCost(location.businessId, locationId, date),
              )
            : 0),
      );
      const productsAmount = productSalesPay(productsCtx, staff, date, date).payout;
      const result: StaffDayResult = {
        staffId: staff.id,
        configured: Boolean(scheme),
        operations,
        servicesAmount,
        productsAmount,
        workdayAmount,
        recordsAmount,
        extraAmount,
        total: 0,
      };
      // F-09-038: гарантированный минимум за день (за месяц — только в расчёте за период, ниже)
      result.total = scheme?.workday.enabled
        ? applyDailyGuaranteedMinimum(
            sumDayResult(result),
            scheme.workday.guaranteedMinimum,
          )
        : sumDayResult(result);
      const hasActivity =
        operations.length > 0 ||
        productsAmount > 0 ||
        workdayAmount > 0 ||
        recordsAmount > 0 ||
        extraAmount > 0;
      if (hasActivity) staffResults.push(result);
    }
    staffResults.sort((a, b) => b.total - a.total);

    return {
      date,
      anyConfigured,
      staff: staffResults,
      locationServicesTurnover: turnover,
    };
  });
}

// ─────────────────────────── Расчёт за период (F-09-062…064) ───────────────────────────

export interface ComputePeriodOptions {
  positionKey?: string;
}

export function computePeriod(
  locationId: Id,
  from: ISODate,
  to: ISODate,
  options: ComputePeriodOptions = {},
): Promise<PeriodComputation> {
  if (isApiMode()) return Server.computePeriod(locationId, from, to, options.positionKey);
  return request(() => {
    const ctx = payContext(locationId);
    const ownOnly = ownOnlyStaffIdForActor();
    const staffList = ctx.core.staff
      .filter(
        (s) =>
          s.locationIds.includes(locationId) &&
          s.status !== "fired" &&
          s.status !== "disabled",
      ) // F-09-064
      .filter((s) => ownOnly === undefined || s.id === ownOnly)
      .filter(
        (s) =>
          !options.positionKey ||
          (s.position?.ru ?? s.position?.en ?? s.position?.hy ?? "") ===
            options.positionKey,
      );
    const anyConfigured = staffList.some((s) =>
      staffHasScheme(ctx, s, to),
    );
    const rows: PeriodRow[] = [];
    for (const staff of staffList) {
      const { row, configured } = computeStaffPay(ctx, staff, from, to);
      if (
        row.workDays === 0 &&
        row.servicesAmount === 0 &&
        row.salary === 0 &&
        (row.breakdown?.toPay ?? 0) === 0 &&
        !configured
      )
        continue; // не грузим пустыми строками без активности и без схемы
      rows.push(row);
    }
    rows.sort((a, b) => b.salary - a.salary);
    return { from, to, anyConfigured, rows };
  });
}

// ─────────────────────────── Один расчёт зарплаты сотрудника (З1/З2) ───────────────────────────

interface PayContext {
  core: ReturnType<typeof readCore>;
  locationId: Id;
  businessId: Id;
  generalSettings: GeneralSettings | undefined;
  loyaltyPaidForBooking: (bookingId: Id) => LoyaltyPaidBreakdown | undefined;
  techCardCost: ReturnType<typeof techCardCostLookup>;
  cardCommissionForBooking: (bookingId: Id) => number;
  unpaidForBooking: (bookingId: Id) => number;
  assistantsForLine: ReturnType<typeof assistantsForLineLookup>;
  accrualDateForBooking: ReturnType<typeof accrualDateLookup>;
  expenseCache: ExpenseCache;
}

function payContext(locationId: Id): PayContext {
  const core = readCore();
  const location = core.locations.find((l) => l.id === locationId);
  if (!location) throw new ApiError("not_found");
  return {
    core,
    locationId,
    businessId: location.businessId,
    generalSettings: readArea("payroll").settingsByLocation[locationId],
    loyaltyPaidForBooking: loyaltyPaidLookup(location.businessId),
    techCardCost: techCardCostLookup(location.businessId, locationId),
    cardCommissionForBooking: cardCommissionLookup(location.businessId),
    unpaidForBooking: unpaidForBookingLookup(location.businessId),
    assistantsForLine: assistantsForLineLookup(),
    accrualDateForBooking: accrualDateLookup(
      location.businessId,
      readArea("payroll").settingsByLocation[locationId],
    ),
    expenseCache: new Map(),
  };
}

function schemeOn(ctx: PayContext, staff: Staff, date: ISODate): PayrollScheme | undefined {
  return resolveEffectiveSchemes(
    ctx.businessId,
    [staff],
    ctx.locationId,
    date,
    ctx.core.bookings,
    ctx.generalSettings,
  ).get(staff.id);
}

function staffHasScheme(ctx: PayContext, staff: Staff, date: ISODate): boolean {
  return Boolean(schemeOn(ctx, staff, date));
}

/**
 * З1/З2: ЕДИНСТВЕННЫЙ расчёт зарплаты сотрудника за период в филиале — его зовут «Расчёт за период»,
 * «Расчётная ведомость», «Аналитика ФОТ» и создание ведомости во «Взаиморасчётах» (finance
 * createSettlementSheet, ленивым импортом). Версия схемы — на дату каждого визита/дня (З6), минимум за
 * месяц — только за целый месяц (F-09-038), за день — по каждому рабочему дню; премии и штрафы — строки
 * взаиморасчётов, созданные в этом периоде (как их показывает ведомость).
 */
/**
 * F-09-043 (QA 30.09): дневной оборот товаров филиала — продажи склада этого дня (без отменённых и
 * автосписаний), цена × кол-во за вычетом скидки строки. База «доп. вознаграждения за продажу товаров»;
 * раньше блок сохранялся в схеме, но в расчёт не шёл вовсе.
 */
function locationProductsTurnover(businessId: Id, locationId: Id, date: ISODate): number {
  let total = 0;
  for (const doc of readArea("stock").operations) {
    if (doc.type !== "sale" || doc.cancelledAt || doc.autoWriteoff) continue;
    if (doc.businessId !== businessId || doc.locationId !== locationId) continue;
    if (doc.date.slice(0, 10) !== date) continue;
    for (const line of doc.lines) {
      const price = roundMoney(line.unitPrice * Math.abs(line.qtySale));
      total = roundMoney(total + price * (1 - (line.discountPct ?? 0) / 100));
    }
  }
  return total;
}

/**
 * Решение владельца 01.10.2026 (уточнено): «доп. от прибыли» — от настоящих расходов, но не день к дню (дни без
 * расходов давали прибыль = оборот). Прибыль считается за календарный месяц дня целиком — оборот услуг месяца
 * минус операции «расход» филиала за месяц — и делится по дням пропорционально обороту дня. Месяц, а не выбранный
 * период экрана: так «Расчёт за день», сумма дней и «Расчёт за период» дают одно число (F-09-111), а за целый месяц
 * это ровно «оборот периода − расходы периода». Возвращает расходы, приходящиеся на этот день; undefined — в
 * финансах филиала расходов не заведено вовсе (тогда условные 70 % и подпись «условно — расходы не заведены»).
 */
type ExpenseCache = Map<string, { turnover: number; expenses: number } | null>;

function locationExpensesForDay(
  businessId: Id,
  locationId: Id,
  date: ISODate,
  cache: ExpenseCache = new Map(),
): number | undefined {
  const month = date.slice(0, 7);
  const key = `${locationId}|${month}`;
  let entry = cache.get(key);
  if (entry === undefined) {
    const ops = readArea("finance").operations.filter(
      (o) => o.businessId === businessId && o.locationId === locationId && o.kind === "expense" && !o.cancelled,
    );
    if (ops.length === 0) entry = null;
    else {
      const expenses = roundMoney(
        ops.filter((o) => o.date.slice(0, 7) === month).reduce((sum, o) => sum + o.amount, 0),
      );
      const turnover = roundMoney(
        readCore()
          .bookings.filter(
            (b) =>
              b.locationId === locationId &&
              b.status === "arrived" &&
              !b.deletedAt &&
              b.start.slice(0, 7) === month,
          )
          .reduce((sum, b) => sum + b.total, 0),
      );
      entry = { turnover, expenses };
    }
    cache.set(key, entry);
  }
  if (entry === null) return undefined;
  const dayTurnover = locationServicesTurnover(readCore().bookings, locationId, date);
  if (entry.turnover <= 0 || dayTurnover <= 0) return 0;
  // доля месячных расходов этого дня — по доле дня в обороте месяца (прибыль месяца не ниже 0)
  const monthProfit = Math.max(0, entry.turnover - entry.expenses);
  return roundMoney(dayTurnover - (monthProfit * dayTurnover) / entry.turnover);
}

/** Себестоимость товаров, проданных филиалом за день (для «доп. от прибыли по товарам», F-09-043) */
function locationProductsCost(businessId: Id, locationId: Id, date: ISODate): number {
  let total = 0;
  for (const doc of readArea("stock").operations) {
    if (doc.type !== "sale" || doc.cancelledAt || doc.autoWriteoff) continue;
    if (doc.businessId !== businessId || doc.locationId !== locationId) continue;
    if (doc.date.slice(0, 10) !== date) continue;
    for (const line of doc.lines)
      total = roundMoney(total + Math.abs(line.qtySale) * costPriceAt(businessId, line.goodId, doc.date));
  }
  return total;
}

/** З9: выручка, число и выплата «% с продаж» сотрудника за период по документам продажи склада */
function productSalesPay(ctx: PayContext, staff: Staff, from: ISODate, to: ISODate): { revenue: number; count: number; payout: number } {
  const stock = readArea("stock");
  const goodById = new Map(stock.goods.map((g) => [g.id, g] as const));
  let revenue = 0;
  let count = 0;
  let payout = 0;
  for (const doc of stock.operations) {
    if (doc.type !== "sale" || doc.cancelledAt || doc.autoWriteoff) continue;
    if (doc.businessId !== ctx.businessId || doc.locationId !== ctx.locationId) continue;
    const day = doc.date.slice(0, 10) as ISODate;
    if (day < from || day > to) continue;
    const block = schemeOn(ctx, staff, day)?.productSales;
    for (const line of doc.lines) {
      if ((line.sellerId ?? doc.staffId) !== staff.id) continue;
      const qty = Math.abs(line.qtySale);
      const price = roundMoney(line.unitPrice * qty);
      const discountPct = line.discountPct ?? 0;
      revenue = roundMoney(revenue + price * (1 - discountPct / 100));
      count += qty;
      if (!block?.enabled) continue;
      const unitCost = costPriceAt(ctx.businessId, line.goodId, doc.date);
      const costPercent = unitCost > 0 && line.unitPrice > 0 ? (unitCost / line.unitPrice) * 100 : (block.demoCostPercent ?? 0);
      const base = productSaleBase(price, discountPct, costPercent, block.costBasis);
      payout = roundMoney(payout + applyPayout(base, payoutForTarget(block, line.goodId, goodById.get(line.goodId)?.categoryId)));
    }
  }
  return { revenue, count, payout };
}

function computeStaffPay(
  ctx: PayContext,
  staff: Staff,
  from: ISODate,
  to: ISODate,
): { row: PeriodRow; operations: StatementOperation[]; configured: boolean } {
  const { core, locationId } = ctx;
  const dates = eachDay(from, to);
  const events = core.bookingEvents ?? [];
  const qualifyingMonths = qualifyingMonthlySalaryMonths(from, to);
  const operations: StatementOperation[] = [];
  let workDays = 0;
  let workHours = 0;
  let servicesCount = 0;
  let servicesRevenue = 0;
  let servicesPayout = 0;
  let recordsAmount = 0;
  let extraAmount = 0;
  let workdayAmount = 0;
  let dailyMinTopUp = 0;
  let unpaidVisits = 0;
  let unpaidAmount = 0;
  let configured = false;
  let extraProfitAssumed = false;
  const hoursByMonth = new Map<string, number>();
  const unpaidSeen = new Set<Id>();
  const todayDate = today();
  let aheadDays = 0;
  let aheadHours = 0;

  for (const date of dates) {
    const scheme = schemeOn(ctx, staff, date);
    if (scheme) configured = true;
    // Решение владельца 01.10.2026: «отработано» и оплата «за рабочий день» — только по сегодня включительно;
    // график после сегодня — отдельная подпись (scheduledAhead*), в зарплату не идёт
    const scheduledHours = staffWorkedHoursOnDay(core, staff.id, date, locationId);
    const hours = date <= todayDate ? scheduledHours : 0;
    if (date > todayDate && scheduledHours > 0) {
      aheadDays += 1;
      aheadHours = roundMoney(aheadHours + scheduledHours);
    }
    if (hours > 0) {
      workDays += 1;
      workHours = roundMoney(workHours + hours);
    }
    const month = date.slice(0, 7);
    hoursByMonth.set(month, roundMoney((hoursByMonth.get(month) ?? 0) + hours));
    const schemes = new Map<Id, PayrollScheme>();
    if (scheme) schemes.set(staff.id, scheme);
    const ops =
      computeServicesForDay({
        date,
        locationId,
        staffIds: [staff.id],
        bookings: core.bookings,
        groupEvents: core.groupEvents,
        services: core.services,
        schemes,
        loyaltyPaidForBooking: ctx.loyaltyPaidForBooking,
        techCardCost: ctx.techCardCost,
        cardCommissionForBooking: ctx.cardCommissionForBooking,
        bankCommissionSplit: ctx.generalSettings?.bankCommissionSplit,
        unpaidForBooking: ctx.unpaidForBooking,
        assistantsForLine: ctx.assistantsForLine,
        accrualDateForBooking: ctx.accrualDateForBooking,
      }).get(staff.id) ?? [];
    let dayServices = 0;
    for (const op of ops) {
      operations.push({ ...op, date });
      servicesCount += op.lines.filter(
        (l) => !l.refId.startsWith("commission:"),
      ).length;
      servicesRevenue = roundMoney(servicesRevenue + op.revenue);
      dayServices = roundMoney(dayServices + op.amount);
      // З3: визит «пришёл», за который в кассу пришло не всё — считаем сам факт и долю этого мастера
      if (op.bookingId && !unpaidSeen.has(op.bookingId)) {
        const booking = core.bookings.find((b) => b.id === op.bookingId);
        const unpaid = booking ? ctx.unpaidForBooking(booking.id) : 0;
        if (booking && unpaid > 0) {
          unpaidSeen.add(booking.id);
          const bookingTotal =
            booking.services.reduce((s, l) => s + l.price * l.qty, 0) || 1;
          unpaidVisits += 1;
          unpaidAmount = roundMoney(
            unpaidAmount + (unpaid * op.revenue) / bookingTotal,
          );
        }
      }
    }
    servicesPayout = roundMoney(servicesPayout + dayServices);
    let dayRecords = 0;
    let dayExtra = 0;
    let dayWorkday = 0;
    if (scheme?.records.enabled) {
      dayRecords = roundMoney(
        recordsRewardForDay(core.bookings, staff.id, date, scheme.records, core.services, locationId) +
          onlineWidgetRewardForDay(core.bookings, events, staff.id, date, scheme.records, core.services, locationId),
      );
    }
    if (scheme?.extraServiceRevenue.enabled) {
      const expenses = locationExpensesForDay(ctx.businessId, locationId, date, ctx.expenseCache);
      if (scheme.extraServiceRevenue.base === "profit" && expenses === undefined) extraProfitAssumed = true;
      dayExtra = extraRevenueAmount(
        locationServicesTurnover(core.bookings, locationId, date),
        scheme.extraServiceRevenue,
        expenses,
      );
    }
    if (scheme?.extraProductRevenue.enabled) {
      dayExtra = roundMoney(
        dayExtra +
          extraRevenueAmount(
            locationProductsTurnover(ctx.businessId, locationId, date),
            scheme.extraProductRevenue,
            locationProductsCost(ctx.businessId, locationId, date),
          ),
      );
    }
    if (scheme?.workday.enabled) {
      if (scheme.workday.basePeriod === "hour")
        dayWorkday = roundMoney(scheme.workday.baseAmount * hours);
      else if (scheme.workday.basePeriod === "day")
        dayWorkday = hours > 0 ? scheme.workday.baseAmount : 0;
    }
    recordsAmount = roundMoney(recordsAmount + dayRecords);
    extraAmount = roundMoney(extraAmount + dayExtra);
    workdayAmount = roundMoney(workdayAmount + dayWorkday);
    // F-09-038: минимум за день — по каждому рабочему дню (как в «Расчёте за день»)
    if (scheme?.workday.enabled && (hours > 0 || ops.length > 0)) {
      const dayTotal = roundMoney(dayServices + dayRecords + dayExtra + dayWorkday);
      const withMin = applyDailyGuaranteedMinimum(dayTotal, scheme.workday.guaranteedMinimum);
      dailyMinTopUp = roundMoney(dailyMinTopUp + (withMin - dayTotal));
    }
  }

  // Решение владельца 01.10.2026: оклад и минимум месяца — пропорционально отработанному по графику:
  // × (часы графика месяца по сегодня) / (часы графика за весь месяц)
  const monthHoursOf = (month: string) => {
    let worked = 0;
    let scheduled = 0;
    for (const date of eachDay(`${month}-01`, monthLastDay(month))) {
      const h = staffWorkedHoursOnDay(core, staff.id, date, locationId);
      scheduled = roundMoney(scheduled + h);
      if (date <= todayDate) worked = roundMoney(worked + h);
    }
    return { worked, scheduled };
  };

  // F-09-037: месячный оклад — по версии схемы на последний день месяца (в пределах периода)
  for (const month of qualifyingMonths) {
    const monthEnd = `${month}-31` > to ? to : `${month}-31`;
    const scheme = schemeOn(ctx, staff, monthEnd < from ? from : monthEnd);
    if (!scheme?.workday.enabled || scheme.workday.basePeriod !== "month") continue;
    if (monthlySalaryQualifies(month, hoursByMonth.get(month) ?? 0, scheme.createdAt)) {
      const mh = monthHoursOf(month);
      workdayAmount = roundMoney(workdayAmount + Math.round(scheme.workday.baseAmount * monthWorkShare(mh.worked, mh.scheduled)));
    }
  }

  // F-09-031/032, З9 (28.09): % с продаж — по продажам склада этого филиала за период, где продавец строки
  // (sellerId; нет — продавец документа) — этот сотрудник. Отменённые продажи и автосписания не считаются.
  const products = productSalesPay(ctx, staff, from, to);
  const productsAmount = products.payout;
  const schemeAtEnd = schemeOn(ctx, staff, to);
  const beforeMin = roundMoney(
    servicesPayout + productsAmount + workdayAmount + recordsAmount + extraAmount + dailyMinTopUp,
  );
  let salary = beforeMin;
  const min = schemeAtEnd?.workday.enabled ? schemeAtEnd.workday.guaranteedMinimum : undefined;
  const wholeMonth = periodIsWholeMonth(from, to);
  const minMonth = min && min.period === "month" && min.enabled && wholeMonth ? monthHoursOf(from.slice(0, 7)) : undefined;
  const minProrated = min && minMonth ? Math.round(min.amount * monthWorkShare(minMonth.worked, minMonth.scheduled)) : undefined;
  if (min && min.period === "month")
    salary = applyMonthlyGuaranteedMinimum(salary, minProrated !== undefined ? { ...min, amount: minProrated } : min, from, to);

  // Премии/штрафы за период — те же строки взаиморасчётов, что показывает ведомость
  let bonuses = 0;
  let penalties = 0;
  for (const e of readArea("finance").settlementEntries) {
    if (e.businessId !== ctx.businessId || e.staffId !== staff.id) continue;
    const day = e.createdAt.slice(0, 10);
    if (day < from || day > to) continue;
    if (e.kind === "bonus" || e.kind === "adjustment") bonuses = roundMoney(bonuses + e.amount);
    else if (e.kind === "penalty") penalties = roundMoney(penalties + e.amount);
  }

  const breakdown: PayBreakdown = {
    ...emptyPayBreakdown(),
    services: servicesPayout,
    products: productsAmount,
    workday: workdayAmount,
    records: recordsAmount,
    extra: extraAmount,
    minimumTopUp: roundMoney(salary - beforeMin + dailyMinTopUp),
    salary,
    bonuses,
    penalties,
    toPay: roundMoney(salary + bonuses - penalties),
    unpaidVisits,
    unpaidAmount,
    workdayNoSchedule: Boolean(schemeAtEnd?.workday.enabled) && workHours === 0,
    minimum:
      min?.enabled && min.amount > 0
        ? {
            amount: min.amount,
            period: min.period,
            applied: min.period === "day" ? dailyMinTopUp > 0 : wholeMonth && salary > beforeMin,
            wholeMonth,
            ...(minMonth && minProrated !== undefined && minProrated < min.amount
              ? { proratedAmount: minProrated, workedHours: minMonth.worked, monthHours: minMonth.scheduled }
              : {}),
          }
        : undefined,
    // З9: продажа теперь привязана к продавцу — подсказка «не привязано» больше не нужна
    productsNotLinked: false,
    extraProfitAssumed: extraProfitAssumed && extraAmount > 0,
  };
  const totalAmount = roundMoney(servicesRevenue + products.revenue);
  const row: PeriodRow = {
    staffId: staff.id,
    workDays,
    workHours,
    scheduledAheadDays: aheadDays,
    scheduledAheadHours: aheadHours,
    servicesCount,
    servicesAmount: servicesRevenue,
    productsCount: products.count,
    productsAmount: products.revenue,
    totalAmount,
    paidAmount: roundMoney(Math.max(0, totalAmount - unpaidAmount)),
    salary,
    breakdown,
  };
  return { row, operations, configured };
}

/**
 * З1: зарплата сотрудника за период по всем его филиалам бизнеса — сумма для ведомости во
 * «Взаиморасчётах» (finance createSettlementSheet зовёт это ленивым импортом, не свою копию расчёта).
 * Синхронно: вызывающий уже внутри request().
 */
export function staffSalaryForSheetSync(
  businessId: Id,
  staffId: Id,
  from: ISODate,
  to: ISODate,
): number {
  const core = readCore();
  const staff = core.staff.find((s) => s.id === staffId && s.businessId === businessId);
  if (!staff) return 0;
  let total = 0;
  for (const locationId of staff.locationIds) {
    const location = core.locations.find((l) => l.id === locationId);
    if (!location || location.businessId !== businessId) continue;
    total = roundMoney(total + computeStaffPay(payContext(locationId), staff, from, to).row.salary);
  }
  return total;
}

export interface ProductCatalogItem {
  id: Id;
  name: string;
  kind: "product" | "subscription" | "certificate";
}

/**
 * Товары (и, для F-09-105, абонементы/сертификаты того же демо-каталога) для индивидуальных значений
 * блока «Оплата за продажу товаров» (F-09-032/105). Каталог временно живёт в срезе journal (владелец —
 * раздел stock, ещё не построен) — читаем его слепок здесь напрямую (readArea чужого среза разрешён
 * ВНУТРИ своих api-функций, CONVENTIONS.md §6), без импорта api/journal. Архива (F-09-035) в демо-
 * каталоге нет — запрошено в qa/requests/payroll.md.
 */
export function listProductCatalog(): Promise<ProductCatalogItem[]> {
  if (isApiMode()) {
    return JM.goodsCatalog().then((rows) => rows.map((g) => ({ id: g.id, name: g.name, kind: g.kind })));
  }
  return request(() =>
    readArea("journal").goodsCatalog.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
    })),
  );
}

/** Список должностей сотрудников локации — фильтр «Расчёта за период» (F-09-062) */
export function listPositions(locationId: Id): Promise<string[]> {
  if (isApiMode()) {
    const businessId = apiIdentity()?.businessId;
    if (!businessId) throw new ApiError("forbidden", "No business in session");
    return serverListStaff(businessId).then((rows) => {
      const set = new Set<string>();
      for (const { staff: s } of rows) {
        if (!s.locationIds.includes(locationId) || s.status === "fired") continue;
        const label = s.position?.ru ?? s.position?.en ?? s.position?.hy;
        if (label) set.add(label);
      }
      return Array.from(set).sort();
    });
  }
  return request(() => {
    const staffList = readCore().staff.filter(
      (s) => s.locationIds.includes(locationId) && s.status !== "fired",
    );
    const set = new Set<string>();
    for (const s of staffList) {
      const label = s.position?.ru ?? s.position?.en ?? s.position?.hy;
      if (label) set.add(label);
    }
    return Array.from(set).sort();
  });
}

// ─────────────────────────── Справочник «Премии и штрафы» (F-09-072) ───────────────────────────

export function listBonusPenaltyTypes(
  businessId: Id,
  kind?: BonusPenaltyKind,
): Promise<BonusPenaltyType[]> {
  if (isApiMode()) return Server.listBonusPenaltyTypes(businessId, kind);
  return request(() => {
    const all = readArea("payroll").bonusPenaltyTypes.filter(
      (t) => t.businessId === businessId,
    );
    return (kind ? all.filter((t) => t.kind === kind) : all).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  });
}

export function saveBonusPenaltyType(input: {
  id?: Id;
  businessId: Id;
  kind: BonusPenaltyKind;
  name: string;
  defaultAmount: number;
}): Promise<BonusPenaltyType> {
  if (isApiMode()) return Server.saveBonusPenaltyType(input);
  return request(() => {
    assertCan("payroll.manage");
    const name = input.name.trim();
    if (!name) throw new ApiError("validation");
    let saved!: BonusPenaltyType;
    mutateArea("payroll", (s) => {
      if (input.id) {
        const existing = s.bonusPenaltyTypes.find((t) => t.id === input.id);
        if (!existing) throw new ApiError("not_found");
        existing.name = name;
        existing.defaultAmount = Math.max(0, input.defaultAmount);
        saved = existing;
      } else {
        saved = {
          id: newId("bpt"),
          businessId: input.businessId,
          kind: input.kind,
          name,
          defaultAmount: Math.max(0, input.defaultAmount),
          createdAt: nowDateTime(),
        };
        s.bonusPenaltyTypes.push(saved);
      }
    });
    writeAudit(
      input.businessId,
      "payrollBonusPenaltyType",
      saved.id,
      input.id ? "updated" : "created",
      undefined,
      saved,
    );
    return saved;
  });
}

/** F-09-072: удаление шаблона — уже начисленные премии/штрафы по нему в истории (finance) не трогаем */
export function deleteBonusPenaltyType(businessId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteBonusPenaltyType(businessId, id);
  return request(() => {
    assertCan("payroll.manage");
    writeAudit(businessId, "payrollBonusPenaltyType", id, "deleted", undefined, undefined);
    mutateArea("payroll", (s) => {
      s.bonusPenaltyTypes = s.bonusPenaltyTypes.filter(
        (t) => !(t.id === id && t.businessId === businessId),
      );
    });
  });
}

// ─────────────────────────── Ведомость: детальная выписка операций (F-09-066…070) ───────────────────────────

/**
 * Все операции (визиты «пришёл») одного сотрудника за период, по дням — основа «страницы ведомости»
 * (F-09-067). Товары сюда не входят — см. комментарий в computePeriod (QuickSaleRecord без staffId).
 */
export function computeStatement(
  locationId: Id,
  staffId: Id,
  from: ISODate,
  to: ISODate,
): Promise<StatementComputation> {
  if (isApiMode()) return Server.computeStatement(locationId, staffId, from, to);
  return request(() => {
    const ctx = payContext(locationId);
    const staff = ctx.core.staff.find((s) => s.id === staffId);
    if (!staff) return { staffId, from, to, operations: [], total: 0 };
    // З2: тот же расчёт, что «Расчёт за период» и «Аналитика ФОТ», — computeStaffPay
    const { row, operations } = computeStaffPay(ctx, staff, from, to);
    const total = roundMoney(operations.reduce((sum, op) => sum + op.amount, 0));
    return {
      staffId,
      from,
      to,
      operations,
      total,
      breakdown: row.breakdown,
      workDays: row.workDays,
      workHours: row.workHours,
      scheduledAheadDays: row.scheduledAheadDays,
      scheduledAheadHours: row.scheduledAheadHours,
      salary: row.salary,
    };
  });
}

export { emptyScheme, defaultGeneralSettings };

/**
 * F-09-092: «рабочее время (дни и часы)» на экране «Расчёт» приложения — часы по графику за период
 * (тот же источник, что и колонка «Рабочее время» в /biz/payroll/period).
 */
export function getStaffWorkedHours(
  locationId: Id,
  staffId: Id,
  from: ISODate,
  to: ISODate,
): Promise<number> {
  // Этап 21 (лейн services+rest): та же цифра, что колонка «Рабочее время» графика — getScheduledMinutes
  // в schedule/table.ts уже читает сервер (комментарий в файле: «для будущего расчёта зарплаты»), здесь
  // только переводим минуты в часы тем же округлением, что и мок.
  if (isApiMode())
    return getScheduledMinutes(staffId, from, to, locationId).then((min) =>
      roundMoney(min / 60),
    );
  return request(() => {
    const core = readCore();
    let hours = 0;
    const todayDate = today();
    for (const date of eachDay(from, to)) {
      if (date > todayDate) break; // «отработано» — по сегодня включительно (решение 01.10)
      hours = roundMoney(
        hours + staffWorkedHoursOnDay(core, staffId, date, locationId),
      );
    }
    return hours;
  });
}

// ─────────────────────────── b04: права на зарплату (F-09-085…089) ───────────────────────────

export function getPayrollRights(
  staffId: Id,
): Promise<PayrollStaffRights | undefined> {
  if (isApiMode()) return Server.getStaffRights(staffId);
  return request(() => readArea("payroll").staffRightsByStaff[staffId]);
}

export function listPayrollRights(
  businessId: Id,
): Promise<Record<Id, PayrollStaffRights>> {
  if (isApiMode()) return Server.listStaffRights(businessId);
  return request(() => {
    const staffIds = new Set(
      readCore()
        .staff.filter((s) => s.businessId === businessId)
        .map((s) => s.id),
    );
    const all = readArea("payroll").staffRightsByStaff;
    const out: Record<Id, PayrollStaffRights> = {};
    for (const [id, r] of Object.entries(all))
      if (staffIds.has(id)) out[id] = r;
    return out;
  });
}

/** F-09-085: без права `schemesAccess` только владелец задаёт права — это сама точка входа */
export function savePayrollRights(
  rights: PayrollStaffRights,
): Promise<PayrollStaffRights> {
  if (isApiMode()) return Server.saveStaffRights(rights);
  return request(() => {
    assertCan("staff.manage");
    const saved: PayrollStaffRights = { ...rights, updatedAt: nowDateTime() };
    mutateArea("payroll", (s) => {
      s.staffRightsByStaff[rights.staffId] = saved;
    });
    return saved;
  });
}

/** З14/М2: права нескольких сотрудников одной кнопкой — один запрос вместо запроса на каждый клик */
export function savePayrollRightsBatch(
  list: PayrollStaffRights[],
): Promise<PayrollStaffRights[]> {
  if (isApiMode()) return Server.saveStaffRightsBatch(list);
  return request(() => {
    assertCan("staff.manage");
    const now = nowDateTime();
    const saved = list.map((r) => ({ ...r, updatedAt: now }));
    mutateArea("payroll", (s) => {
      for (const r of saved) s.staffRightsByStaff[r.staffId] = r;
    });
    return saved;
  });
}

/**
 * З11: «Закрыть период» — по этот день включительно ставки (версии схем) и ведомости не меняются; правка
 * задним числом идёт корректировкой в следующий период (StatementScreen). Хранится в «Основных настройках».
 */
export function closePayrollPeriod(
  locationId: Id,
  through: ISODate,
): Promise<GeneralSettings> {
  if (isApiMode())
    return Server.getGeneralSettings(locationId).then((current) =>
      Server.saveGeneralSettings({
        ...(current ?? defaultGeneralSettings(locationId, nowDateTime())),
        closedThrough: through,
      }),
    );
  return request(() => {
    assertCan("payroll.manage");
    const now = nowDateTime();
    const current =
      readArea("payroll").settingsByLocation[locationId] ??
      defaultGeneralSettings(locationId, now);
    if (current.closedThrough && current.closedThrough >= through) return current;
    const saved: GeneralSettings = { ...current, closedThrough: through, updatedAt: now };
    mutateArea("payroll", (s) => {
      s.settingsByLocation[locationId] = saved;
    });
    const location = readCore().locations.find((l) => l.id === locationId);
    if (location)
      writeAudit(location.businessId, "payrollSettings", locationId, "periodClosed", current, saved);
    return saved;
  });
}

/**
 * З12: «Применить к…» — сохранённая схема сотрудника-образца становится новой версией схемы каждого
 * выбранного сотрудника с даты `effectiveFrom` (прошлое у них считается по их прежним версиям).
 */
export function applySchemeToStaff(
  sourceStaffId: Id,
  staffIds: Id[],
  effectiveFrom: ISODate,
): Promise<number> {
  if (isApiMode())
    return Server.getScheme(sourceStaffId).then(async (source) => {
      if (!source) throw new ApiError("not_found");
      const targets = staffIds.filter((id) => id !== sourceStaffId);
      for (const staffId of targets)
        await Server.saveScheme({ ...source, history: undefined, staffId, effectiveFrom });
      return targets.length;
    });
  return request(() => {
    assertCan("payroll.manage");
    const area = readArea("payroll");
    const source = area.schemesByStaff[sourceStaffId];
    if (!source) throw new ApiError("not_found");
    const now = nowDateTime();
    const core = readCore();
    const results: PayrollScheme[] = [];
    for (const staffId of staffIds) {
      if (staffId === sourceStaffId) continue;
      const staff = core.staff.find((s) => s.id === staffId);
      const closedThrough = (staff?.locationIds ?? [])
        .map((id) => area.settingsByLocation[id]?.closedThrough ?? "")
        .reduce((a, b) => (b > a ? b : a), "");
      const existing = area.schemesByStaff[staffId];
      const { history: _h, ...blocks } = source;
      void _h;
      const next: PayrollScheme = {
        ...blocks,
        staffId,
        effectiveFrom,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const versioned = applySchemeVersion(existing, next, closedThrough || undefined);
      if ("error" in versioned) throw new ApiError(`scheme_${versioned.error}`);
      results.push({ ...versioned.scheme, updatedAt: now });
    }
    mutateArea("payroll", (s) => {
      for (const r of results) s.schemesByStaff[r.staffId] = r;
    });
    for (const r of results) {
      const staff = core.staff.find((x) => x.id === r.staffId);
      if (staff)
        writeAudit(staff.businessId, "payrollScheme", r.staffId, "updated", area.schemesByStaff[r.staffId], r);
    }
    return results.length;
  });
}

/** З12: схема из шаблона для черновика редактора */
export function createSchemeFromTemplate(
  templateId: SchemeTemplateId,
  staffId: Id,
): PayrollScheme {
  return schemeFromTemplate(templateId, staffId, nowDateTime());
}

export interface ResolvedPayrollAccess {
  schemesAccess: boolean;
  calcAccess: PayrollScopeAccess;
  accrueAccess: PayrollScopeAccess;
  /** F-09-088: заперт на одном сотруднике — не может выбрать другого */
  ownOnlyStaffId?: Id;
}

/**
 * F-09-085…089: права раздела для persona/staffId, комбинируя базовое `payroll.view`/`payroll.manage`
 * (фундамент) с override по конкретному сотруднику (owner задаёт в /biz/payroll/settings). Владелец/сеть/
 * ИП — всегда полный доступ (⭐ они видят все свои деньги); остальные — без override не видят раздел.
 */
export function resolvePayrollAccess(
  persona: string,
  staffId: Id | undefined,
  overrides: Record<Id, PayrollStaffRights>,
  /** payroll.view или payroll.manage у текущего пользователя; не передано — прежнее поведение (true) */
  canSeePayroll = true,
): ResolvedPayrollAccess {
  if (
    persona === "owner" ||
    persona === "individual" ||
    persona === "network"
  ) {
    return { schemesAccess: true, calcAccess: "all", accrueAccess: "all" };
  }
  const override = staffId ? overrides[staffId] : undefined;
  if (override) {
    // Решение владельца 01.10.2026: без payroll.view/manage — только своя зарплата, без начисления и схем
    if (!canSeePayroll)
      return {
        schemesAccess: false,
        calcAccess: override.calcAccess === "none" ? "all" : override.calcAccess,
        accrueAccess: "none",
        ownOnlyStaffId: staffId,
      };
    return {
      schemesAccess: override.schemesAccess,
      calcAccess: override.calcAccess,
      accrueAccess: override.accrueAccess,
      ownOnlyStaffId: override.ownOnlyStaffId,
    };
  }
  if (persona === "admin" && !canSeePayroll) {
    // Решение владельца 01.10.2026: администратор по умолчанию видит только свою зарплату
    return {
      schemesAccess: false,
      calcAccess: "all",
      accrueAccess: "none",
      ownOnlyStaffId: staffId,
    };
  }
  if (persona === "master") {
    // F-09-088: по умолчанию мастер видит расчёт только по себе, без начисления и без схем
    return {
      schemesAccess: false,
      calcAccess: "all",
      accrueAccess: "none",
      ownOnlyStaffId: staffId,
    };
  }
  // admin и прочие без явного override — раздела зарплаты не видят (F-09-089: право на сотрудников не даёт зарплату)
  return { schemesAccess: false, calcAccess: "none", accrueAccess: "none" };
}

// ─────────────────────────── b04: правила классической модели (F-09-049/050) ───────────────────────────

export function listRules(businessId: Id): Promise<PayrollRule[]> {
  if (isApiMode()) return Server.listRules(businessId);
  return request(() =>
    readArea("payroll")
      .rules.filter((r) => r.businessId === businessId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export function getRule(id: Id): Promise<PayrollRule | undefined> {
  if (isApiMode()) return Server.getRule(id);
  return request(() => readArea("payroll").rules.find((r) => r.id === id));
}

export function saveRule(
  rule:
    | PayrollRule
    | (Omit<PayrollRule, "id" | "createdAt" | "updatedAt"> & { id?: Id }),
): Promise<PayrollRule> {
  if (isApiMode()) return Server.saveRule(rule);
  return request(() => {
    assertCan("payroll.manage");
    if (!rule.name.trim()) throw new ApiError("validation");
    const now = nowDateTime();
    let saved!: PayrollRule;
    mutateArea("payroll", (s) => {
      const idx = rule.id ? s.rules.findIndex((r) => r.id === rule.id) : -1;
      if (idx >= 0) {
        saved = {
          ...(rule as PayrollRule),
          id: rule.id!,
          createdAt: s.rules[idx].createdAt,
          updatedAt: now,
        };
        s.rules[idx] = saved;
      } else {
        saved = {
          ...(rule as PayrollRule),
          id: rule.id ?? newId("prl"),
          createdAt: now,
          updatedAt: now,
        };
        s.rules.push(saved);
      }
    });
    return saved;
  });
}

/** F-09-049: правило можно удалить, даже если оно используется в схеме — схема тогда просто без него (❓ ТЗ, наш выбор) */
export function deleteRule(id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteRule(id);
  return request(() => {
    assertCan("payroll.manage");
    mutateArea("payroll", (s) => {
      s.rules = s.rules.filter((r) => r.id !== id);
    });
  });
}

export function createEmptyRule(businessId: Id, name: string): PayrollRule {
  return emptyRule(newId("prl"), businessId, name, nowDateTime());
}

// ─────────────────────────── b04: критерии классической модели (F-09-051/052) ───────────────────────────

export function listCriteria(businessId: Id): Promise<PayrollCriterion[]> {
  if (isApiMode()) return Server.listCriteria(businessId);
  return request(() =>
    readArea("payroll")
      .criteria.filter((c) => c.businessId === businessId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export function getCriterion(id: Id): Promise<PayrollCriterion | undefined> {
  if (isApiMode()) return Server.getCriterion(id);
  return request(() => readArea("payroll").criteria.find((c) => c.id === id));
}

export function saveCriterion(
  criterion:
    | PayrollCriterion
    | (Omit<PayrollCriterion, "id" | "createdAt" | "updatedAt"> & { id?: Id }),
): Promise<PayrollCriterion> {
  if (isApiMode()) return Server.saveCriterion(criterion);
  return request(() => {
    assertCan("payroll.manage");
    if (!criterion.name.trim()) throw new ApiError("validation");
    const now = nowDateTime();
    let saved!: PayrollCriterion;
    mutateArea("payroll", (s) => {
      const idx = criterion.id
        ? s.criteria.findIndex((c) => c.id === criterion.id)
        : -1;
      if (idx >= 0) {
        saved = {
          ...(criterion as PayrollCriterion),
          id: criterion.id!,
          createdAt: s.criteria[idx].createdAt,
          updatedAt: now,
        };
        s.criteria[idx] = saved;
      } else {
        saved = {
          ...(criterion as PayrollCriterion),
          id: criterion.id ?? newId("pcr"),
          createdAt: now,
          updatedAt: now,
        };
        s.criteria.push(saved);
      }
    });
    return saved;
  });
}

export function deleteCriterion(id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteCriterion(id);
  return request(() => {
    assertCan("payroll.manage");
    mutateArea("payroll", (s) => {
      s.criteria = s.criteria.filter((c) => c.id !== id);
    });
  });
}

export function createEmptyCriterion(
  businessId: Id,
  name: string,
): PayrollCriterion {
  return emptyCriterion(newId("pcr"), businessId, name, nowDateTime());
}

/**
 * F-09-052: фактическое значение критерия для сотрудника/филиала за период (месяц с 1-го числа или день).
 * metric='count' считает количество проданных строк услуг/товаров (по отмеченным категориям/позициям,
 * если заданы — иначе все); 'turnover' — оборот услуг (⭐ товары — 0, см. комментарий у computePeriod);
 * 'profit' — оборот × (1 − DEMO_EXPENSE_RATIO), тот же демо-коэффициент, что у extraRevenueAmount.
 */
export function evaluateCriterionValue(
  criterionId: Id,
  staffId: Id,
  locationId: Id,
  atDate: ISODate,
): Promise<number> {
  if (isApiMode())
    return Server.evaluateCriterionValue(criterionId, staffId, locationId, atDate);
  return request(() => {
    const criterion = readArea("payroll").criteria.find(
      (c) => c.id === criterionId,
    );
    if (!criterion) throw new ApiError("not_found");
    const from =
      criterion.period === "month" ? `${atDate.slice(0, 7)}-01` : atDate;
    const core = readCore();
    let turnover = 0;
    let count = 0;
    for (const date of eachDay(from, atDate)) {
      const dayBookings = core.bookings.filter(
        (b) =>
          b.locationId === locationId &&
          b.status === "arrived" &&
          !b.deletedAt &&
          b.start.slice(0, 10) === date,
      );
      for (const b of dayBookings) {
        for (const line of b.services) {
          if (criterion.scope === "staff" && line.staffId !== staffId) continue;
          if (!criterion.byServices) continue;
          if (
            criterion.countCategoryIds.length ||
            criterion.countItemIds.length
          ) {
            const service = core.services.find(
              (sv) => sv.id === line.serviceId,
            );
            const matches =
              criterion.countItemIds.includes(line.serviceId) ||
              (service &&
                criterion.countCategoryIds.includes(service.categoryId));
            if (!matches) continue;
          }
          const amount = criterion.includeDiscounts
            ? line.price * line.qty
            : (line.unitPrice ?? line.price) * line.qty;
          turnover = roundMoney(turnover + amount);
          count += line.qty;
        }
      }
    }
    if (criterion.metric === "count") return count;
    if (criterion.metric === "profit") return roundMoney(turnover * 0.3);
    return turnover;
  });
}

// ─────────────────────────── b04: схемы классической модели (F-09-053…056) ───────────────────────────

export function listCharts(businessId: Id): Promise<PayrollChart[]> {
  if (isApiMode()) return Server.listCharts(businessId);
  return request(() =>
    readArea("payroll")
      .charts.filter((c) => c.businessId === businessId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export function getChart(id: Id): Promise<PayrollChart | undefined> {
  if (isApiMode()) return Server.getChart(id);
  return request(() => readArea("payroll").charts.find((c) => c.id === id));
}

export function saveChart(
  chart:
    | PayrollChart
    | (Omit<PayrollChart, "id" | "createdAt" | "updatedAt"> & { id?: Id }),
): Promise<PayrollChart> {
  if (isApiMode()) return Server.saveChart(chart);
  return request(() => {
    assertCan("payroll.manage");
    if (!chart.name.trim()) throw new ApiError("validation");
    const now = nowDateTime();
    let saved!: PayrollChart;
    mutateArea("payroll", (s) => {
      const idx = chart.id ? s.charts.findIndex((c) => c.id === chart.id) : -1;
      if (idx >= 0) {
        saved = {
          ...(chart as PayrollChart),
          id: chart.id!,
          createdAt: s.charts[idx].createdAt,
          updatedAt: now,
        };
        s.charts[idx] = saved;
      } else {
        saved = {
          ...(chart as PayrollChart),
          id: chart.id ?? newId("pch"),
          createdAt: now,
          updatedAt: now,
        };
        s.charts.push(saved);
      }
    });
    return saved;
  });
}

export function deleteChart(id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteChart(id);
  return request(() => {
    assertCan("payroll.manage");
    mutateArea("payroll", (s) => {
      s.charts = s.charts.filter((c) => c.id !== id);
      s.chartAssignments = s.chartAssignments.filter((a) => a.chartId !== id);
    });
  });
}

export function createEmptyChart(
  businessId: Id,
  name: string,
  type: PayrollChartType,
): PayrollChart {
  const chart = emptyChart(newId("pch"), businessId, name, nowDateTime());
  chart.type = type;
  return chart;
}

export function listChartAssignments(
  chartId: Id,
): Promise<PayrollChartAssignment[]> {
  if (isApiMode()) return Server.listChartAssignments(chartId);
  return request(() =>
    readArea("payroll")
      .chartAssignments.filter((a) => a.chartId === chartId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
  );
}

/** Схема, действующая у сотрудника (любая схема бизнеса) — для «Схемы» → «Сотрудники» и для проверки на дату */
export function listStaffChartAssignments(
  businessId: Id,
  staffId: Id,
): Promise<PayrollChartAssignment[]> {
  if (isApiMode()) return Server.listStaffChartAssignments(businessId, staffId);
  return request(() => {
    const chartIds = new Set(
      readArea("payroll")
        .charts.filter((c) => c.businessId === businessId)
        .map((c) => c.id),
    );
    return readArea("payroll")
      .chartAssignments.filter(
        (a) => a.staffId === staffId && chartIds.has(a.chartId),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  });
}

/** F-09-055: назначение схемы сотруднику с датой начала */
export function assignChartToStaff(
  chartId: Id,
  staffId: Id,
  startDate: ISODate,
): Promise<PayrollChartAssignment> {
  if (isApiMode()) return Server.assignChartToStaff(chartId, staffId, startDate);
  return request(() => {
    assertCan("payroll.manage");
    const saved: PayrollChartAssignment = {
      id: newId("pca"),
      chartId,
      staffId,
      startDate,
      createdAt: nowDateTime(),
    };
    mutateArea("payroll", (s) => {
      s.chartAssignments.push(saved);
    });
    return saved;
  });
}

export function removeChartAssignment(id: Id): Promise<void> {
  if (isApiMode()) return Server.removeChartAssignment(id);
  return request(() => {
    assertCan("payroll.manage");
    mutateArea("payroll", (s) => {
      s.chartAssignments = s.chartAssignments.filter((a) => a.id !== id);
    });
  });
}

export interface ChartPreviewResult {
  chart: PayrollChart;
  ruleId: Id | undefined;
  rule: PayrollRule | undefined;
  matchedCriterionId?: Id;
}

/**
 * F-09-054/055/099: правило, действующее у сотрудника на дату — «свежее» назначение (startDate ≤ date),
 * для плановой схемы — первый выполненный критерий сверху вниз, иначе стандартное правило.
 */
export function previewChartForStaff(
  businessId: Id,
  staffId: Id,
  locationId: Id,
  atDate: ISODate,
): Promise<ChartPreviewResult | undefined> {
  if (isApiMode()) return Server.previewChartForStaff(staffId, locationId, atDate);
  return request(async () => {
    const state = readArea("payroll");
    const assignment = resolveActiveChartAssignment(
      state.chartAssignments,
      staffId,
      atDate,
    );
    if (!assignment) return undefined;
    const chart = state.charts.find((c) => c.id === assignment.chartId);
    if (!chart) return undefined;
    const met = new Map<Id, boolean>();
    for (const row of chart.planRows) {
      const criterion = state.criteria.find((c) => c.id === row.criterionId);
      if (!criterion) continue;
      const value = await evaluateCriterionValue(
        criterion.id,
        staffId,
        locationId,
        atDate,
      );
      met.set(row.criterionId, evaluateCriterion(criterion, value));
    }
    const ruleId = pickRuleForChart(chart, (id) => met.get(id) ?? false);
    const matchedRow = chart.planRows.find((r) => met.get(r.criterionId));
    return {
      chart,
      ruleId,
      rule: ruleId ? state.rules.find((r) => r.id === ruleId) : undefined,
      matchedCriterionId: matchedRow?.criterionId,
    };
  });
}

/** F-09-027: пример ТЗ прямым вызовом — цена 1000, себестоимость 300, 40% → 280 */
export { serviceCostBasisPayout };

// ─────────────────────────── b04: пакетная услуга «4 руки» (F-09-108) ───────────────────────────

export function computePackageBases(
  services: PackageServiceInput[],
  method: PackagePriceMethod,
  options?: { manualPrice?: number; discountPct?: number },
) {
  return packageServiceStaffBases(services, method, options);
}

// ─────────────────────────── b04: зарплата мастера с телефона (F-09-092…094) ───────────────────────────

export interface StaffBalance {
  earned: number;
  paid: number;
  remaining: number;
}

/** F-09-093: «Осталось выплатить» = баланс взаиморасчётов (finance's api как контракт, CONVENTIONS §6) */
export function getStaffBalance(
  businessId: Id,
  staffId: Id,
): Promise<StaffBalance> {
  if (isApiMode()) return Server.getStaffBalance(businessId, staffId);
  return request(async () => {
    const entries = await listSettlementEntries(businessId, staffId);
    const earned = roundMoney(
      entries
        .filter((e) => e.kind !== "payout")
        .reduce((s, e) => s + settlementEntrySign(e.kind) * e.amount, 0),
    );
    const paid = roundMoney(
      entries
        .filter((e) => e.kind === "payout")
        .reduce((s, e) => s + e.amount, 0),
    );
    return { earned, paid, remaining: settlementBalance(entries) };
  });
}

/**
 * F-09-114: начисления, премии, штрафы и выплаты сотрудника построчно — та же история, что
 * «Взаиморасчёты» (finance's api как контракт, CONVENTIONS §6), для своего экрана «Расчёт зарплат»
 * (`/biz/payroll/me`): сотрудник видит её по своему праву на СВОЮ зарплату (F-09-088/092), без
 * отдельного права на раздел «Финансы».
 */
export { listSettlementEntries } from "@/api/finance";

// ─────────────────────────── b04: согласование ведомости (F-09-100) ───────────────────────────

export function getStatementApproval(
  sheetId: Id,
): Promise<StatementApproval | undefined> {
  if (isApiMode()) return Server.getStatementApproval(sheetId);
  return request(() => readArea("payroll").statementApprovals[sheetId]);
}

export function advanceStatementApproval(
  sheetId: Id,
  by: Id | undefined,
): Promise<StatementApproval> {
  if (isApiMode()) return Server.advanceStatementApproval(sheetId);
  return request(() => {
    assertCan("payroll.manage");
    let saved!: StatementApproval;
    mutateArea("payroll", (s) => {
      const current = s.statementApprovals[sheetId] ?? {
        sheetId,
        status: "pendingReview" as const,
        history: [],
      };
      const next = nextApprovalStatus(current.status);
      if (!next) throw new ApiError("validation");
      saved = {
        sheetId,
        status: next,
        history: [...current.history, { status: next, at: nowDateTime(), by }],
      };
      s.statementApprovals[sheetId] = saved;
    });
    return saved;
  });
}

/** F-09-100: сотрудник подписывает свою ведомость (фиксирует время; «устройство» — демо, у нас один клиент) */
export function signStatement(
  sheetId: Id,
  staffId: Id,
): Promise<StatementApproval> {
  if (isApiMode()) return Server.signStatement(sheetId);
  return request(() => {
    let saved!: StatementApproval;
    mutateArea("payroll", (s) => {
      const current = s.statementApprovals[sheetId];
      if (!current || current.status !== "sentToStaff")
        throw new ApiError("validation");
      saved = {
        sheetId,
        status: "signed",
        history: [
          ...current.history,
          { status: "signed", at: nowDateTime(), by: staffId },
        ],
      };
      s.statementApprovals[sheetId] = saved;
    });
    return saved;
  });
}

export { canMarkPaid };

// ─────────────────────────── b04: аналитика ФОТ и риски (F-09-101) ───────────────────────────

export interface PayrollFundRisk {
  key: "noScheme" | "unsignedStatement" | "unmarkedPayout";
  count: number;
}

export interface PayrollFundAnalytics {
  turnover: number;
  fund: number;
  fundSharePct: number;
  targetPct: number;
  warnPct: number;
  overWarn: boolean;
  staffCount: number;
  avgPayout: number;
  topAccruals: { staffId: Id; amount: number }[];
  risks: PayrollFundRisk[];
}

export function getPayrollFundAnalytics(
  locationId: Id,
  from: ISODate,
  to: ISODate,
): Promise<PayrollFundAnalytics> {
  if (isApiMode()) return Server.getPayrollFundAnalytics(locationId, from, to) as Promise<PayrollFundAnalytics>;
  return request(async () => {
    const period = await computePeriod(locationId, from, to);
    const turnover = roundMoney(
      period.rows.reduce((s, r) => s + r.servicesAmount, 0),
    );
    // З2/З7: ФОТ = «К выплате» тех же строк, что в «Расчёте за период» (зарплата + премии − штрафы)
    const payOf = (r: PeriodRow) => r.breakdown?.toPay ?? r.salary;
    const fund = roundMoney(period.rows.reduce((s, r) => s + payOf(r), 0));
    const fundSharePct = turnover > 0 ? roundMoney((fund / turnover) * 100) : 0;
    const staffWithPayout = period.rows.filter((r) => payOf(r) > 0);
    const avgPayout = staffWithPayout.length
      ? roundMoney(fund / staffWithPayout.length)
      : 0;
    const topAccruals = [...period.rows]
      .sort((a, b) => payOf(b) - payOf(a))
      .slice(0, 5)
      .map((r) => ({ staffId: r.staffId, amount: payOf(r) }));

    const core = readCore();
    const location = core.locations.find((l) => l.id === locationId);
    const settings = readArea("payroll").settingsByLocation[locationId];
    const activeStaff = core.staff.filter(
      (s) =>
        s.locationIds.includes(locationId) &&
        s.status !== "fired" &&
        s.status !== "disabled",
    );
    const schemes = readArea("payroll").schemesByStaff;
    const noSchemeCount = activeStaff.filter((s) => !schemes[s.id]).length;
    let unsignedCount = 0;
    let unmarkedPayoutCount = 0;
    if (location) {
      const approvals = readArea("payroll").statementApprovals;
      // Все мастера разом, а не по очереди: на медленной сети очередь из 8 чтений держала экран в скелетоне ~20 с
      const entriesByStaff = await Promise.all(
        activeStaff.map((staff) =>
          listSettlementEntries(location.businessId, staff.id, from, to),
        ),
      );
      for (const entries of entriesByStaff) {
        for (const e of entries.filter((x) => x.kind === "sheet")) {
          const approval = approvals[e.id];
          if (
            settings?.statementApprovalEnabled &&
            (!approval || approval.status !== "paid")
          ) {
            if (approval?.status !== "signed" && approval?.status !== "paid")
              unsignedCount += 1;
            else if (approval.status === "signed") unmarkedPayoutCount += 1;
          }
        }
      }
    }
    const risks: PayrollFundRisk[] = (
      [
        { key: "noScheme", count: noSchemeCount },
        { key: "unsignedStatement", count: unsignedCount },
        { key: "unmarkedPayout", count: unmarkedPayoutCount },
      ] satisfies PayrollFundRisk[]
    ).filter((r) => r.count > 0);

    return {
      turnover,
      fund,
      fundSharePct,
      targetPct: settings?.payrollFundTargetPct ?? 30,
      warnPct: settings?.payrollFundWarnPct ?? 40,
      overWarn: fundSharePct > (settings?.payrollFundWarnPct ?? 40),
      staffCount: staffWithPayout.length,
      avgPayout,
      topAccruals,
      risks,
    };
  });
}

// ─────────────────────────── b04: быстрая настройка при подключении (F-09-104) ───────────────────────────

export interface SetupTarget {
  staff: Staff;
  hasScheme: boolean;
}

export function listSetupTargets(businessId: Id): Promise<SetupTarget[]> {
  if (isApiMode())
    return Server.listSetupTargetRows(businessId).then((rows) => {
      const byId = new Map(readCore().staff.map((s) => [s.id, s]));
      return rows.flatMap((r) => {
        const staff = byId.get(r.staffId);
        return staff ? [{ staff, hasScheme: r.hasScheme }] : [];
      });
    });
  return request(() => {
    const schemes = readArea("payroll").schemesByStaff;
    return readCore()
      .staff.filter(
        (s) =>
          s.businessId === businessId &&
          s.status !== "fired" &&
          s.status !== "disabled",
      )
      .map((s) => ({ staff: s, hasScheme: Boolean(schemes[s.id]) }));
  });
}

/** F-09-104: за один проход даёт одинаковую ставку за личные услуги всем выбранным (без схемы — не трогает уже настроенных) */
export function bulkApplyDefaultScheme(
  staffIds: Id[],
  defaultPercent: number,
): Promise<number> {
  if (isApiMode()) return Server.bulkApplyDefaultScheme(staffIds, defaultPercent);
  return request(() => {
    assertCan("payroll.manage");
    let applied = 0;
    mutateArea("payroll", (s) => {
      for (const staffId of staffIds) {
        if (s.schemesByStaff[staffId]) continue;
        const scheme = emptyScheme(staffId, nowDateTime());
        scheme.personalServices = {
          ...scheme.personalServices,
          enabled: true,
          defaultPayout: { unit: "percent", value: defaultPercent },
        };
        s.schemesByStaff[staffId] = scheme;
        applied += 1;
      }
    });
    return applied;
  });
}

'use client';

/**
 * «Зарплата» на настоящем сервере (docs/backend/PLAN.md этап 14, `02-api.md` §14). Покрывает основные настройки,
 * упрощённую схему сотрудника, классическую модель (правила/критерии/схемы-charts/назначения), расчёт за
 * день/период/ведомость (движок сервера — `booktime-backend/src/modules/payroll/payroll-engine.ts`, тот же по
 * формулам, что и здесь), справочник «Премии и штрафы», взаиморасчёты (черновик/начисление/премия/штраф/
 * выплата → операция в финансах), согласование ведомости, аналитику ФОТ, быструю настройку при подключении.
 *
 * Вторичный слой прав на сотрудника (`getStaffRights`/`listStaffRights`/`saveStaffRights(Batch)`, F-09-085…089,
 * таблица `PayrollStaffRights` — этап 21, лейн services+rest) тоже на сервере; `resolvePayrollAccess` остаётся
 * чистой функцией фронта над результатом `listStaffRights`, сервер прав не проверяет за неё.
 *
 * НЕ покрывает (остаётся на моке — честная дыра этого этапа, см. `booktime-backend/docs/PROGRESS.md` §14
 * «Не строил»): ассистенты услуги (нет таблицы «кто ассистировал» ни в одном разделе), деление комиссии
 * эквайринга (по умолчанию `businessOnly` — влияния на сотрудника нет), оплата за продажу товара (нет данных
 * «какой сотрудник продал», как и в моке), `previewChartForStaff`/`evaluateCriterionValue` (предпросмотр
 * плановой схемы — админский инструмент, не движение денег), `computePackageBases`/`serviceCostBasisPayout`
 * (чистая клиентская математика пакетов, сервера не требует), `getStaffWorkedHours` отдельным вызовом.
 */
import { HttpApiError, http as rawHttp, type HttpOptions } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import { bizOf } from '@/api/staff.server';
import { ApiError, trackRead } from '@/api/request';
import type { Id, ISODate } from '@/domain/core';
import { defaultAssistRates } from '@/domain/payroll';
import type {
  BonusPenaltyKind,
  BonusPenaltyType,
  DayComputation,
  GeneralSettings,
  PayrollChart,
  PayrollChartAssignment,
  PayrollCriterion,
  PayrollRule,
  PayrollScheme,
  PayrollStaffRights,
  PeriodComputation,
  StatementApproval,
  StatementComputation,
} from '@/domain/payroll';
import { notifyDbChange, readDbUntracked } from '@/mock/db';
import { toLocalDateTime } from '@/lib/date';

/**
 * Перечитывание в режиме api (проход 17.11, как finance.server): чтения зарплаты объявляют метку areas.payroll (и
 * areas.finance — ведомость считает оплаченные визиты, «Выплачено» — из кассы), запись будит её; выплата будит и
 * кассу. Без этого экран не видел свою запись до перезагрузки: новая ведомость, премия, утверждение, схема мастера.
 */
async function http<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts?: HttpOptions): Promise<T> {
  if (method === 'GET') {
    trackRead('areas.payroll', 'areas.finance');
    return rawHttp<T>(method, path, body, opts);
  }
  const res = await rawHttp<T>(method, path, body, opts);
  if (/\/payroll\/payouts$/.test(path)) notifyDbChange('areas.payroll', 'areas.finance');
  else notifyDbChange('areas.payroll');
  return res;
}

function currentBusinessId(): Id {
  const id = apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

/** Локация сотрудника — из ядра (мирроred staff), иначе первая локация текущего членства */
function locationOfStaff(staffId: Id): Id {
  const staff = readDbUntracked().core.staff.find((s) => s.id === staffId);
  const id = staff?.locationIds[0] ?? apiIdentity()?.locationIds[0];
  if (!id) throw new ApiError('forbidden', 'No location for staff');
  return id;
}

const b = (businessId: Id) => `/v1/biz/${businessId}`;

// ─────────────────────────── Основные настройки ───────────────────────────

export function getGeneralSettings(locationId: Id): Promise<GeneralSettings | undefined> {
  return http<GeneralSettings>('GET', `${b(currentBusinessId())}/payroll/settings`, undefined, { query: { locationId } }).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function saveGeneralSettings(settings: GeneralSettings): Promise<GeneralSettings> {
  const { locationId, updatedAt: _updatedAt, closedThrough: _closedThrough, ...body } = settings;
  return http<GeneralSettings>('PATCH', `${b(currentBusinessId())}/payroll/settings`, body, { query: { locationId } });
}

/** З11: «Закрыть период» по этот день включительно — сервер двигает дату только вперёд (как мок) */
export function closePeriod(locationId: Id, through: ISODate): Promise<GeneralSettings> {
  return http<GeneralSettings>('POST', `${b(currentBusinessId())}/payroll/settings/close-period`, { through }, { query: { locationId } });
}

// ─────────────────────────── Схема сотрудника ───────────────────────────

/**
 * Схема с сервера — в форме сайта: схемы, сохранённые до 17.11, на сервере без ставок ассистента (`assistRates` сервер
 * тогда не принимал) — подставляем «по умолчанию», как у новой схемы (проход 17.11: карточка зарплаты мастера падала
 * «Cannot read properties of undefined (reading 'withoutAssistant')»). То же у прежних версий схемы (`history`).
 */
function schemeFromServer(v: PayrollScheme): PayrollScheme {
  const ps = v.personalServices;
  const fixed = ps && !ps.assistRates ? { ...v, personalServices: { ...ps, assistRates: defaultAssistRates() } } : v;
  return fixed.history?.length ? { ...fixed, history: fixed.history.map(schemeFromServer) } : fixed;
}

export function getScheme(staffId: Id): Promise<PayrollScheme | undefined> {
  return http<PayrollScheme | null>('GET', `${b(bizOf(staffId))}/staff/${staffId}/payroll-scheme`).then((v) => (v ? schemeFromServer(v) : undefined));
}

/**
 * З6: блоки и «Действует с» — сервер сам решает, правка это текущей версии или новая (applySchemeVersion, как мок), и
 * ведёт историю версий; `history` черновика не отправляем.
 */
export function saveScheme(scheme: PayrollScheme): Promise<PayrollScheme> {
  const { staffId, createdAt: _createdAt, updatedAt: _updatedAt, history: _history, ...body } = scheme;
  return http<PayrollScheme>('PATCH', `${b(bizOf(staffId))}/staff/${staffId}/payroll-scheme`, body).then(schemeFromServer);
}

/** З12 «Применить к…»: одна операция на сервере — отказ на любом сотруднике не сохраняет схему ни у кого (как мок) */
export function applySchemeToStaff(sourceStaffId: Id, staffIds: Id[], effectiveFrom: ISODate): Promise<number> {
  return http<{ applied: number }>('POST', `${b(bizOf(sourceStaffId))}/payroll/schemes/apply`, { sourceStaffId, staffIds, effectiveFrom }).then((r) => r.applied);
}

export function copyScheme(fromStaffId: Id, toStaffId: Id): Promise<PayrollScheme> {
  return http<PayrollScheme>('POST', `${b(bizOf(toStaffId))}/staff/${toStaffId}/payroll-scheme/copy-from/${fromStaffId}`).then(schemeFromServer);
}

/** F-09-001/010: «Схемы расчёта» — все схемы бизнеса разом (этап 21, лейн rest), для listStaffSchemeStatus */
export function listSchemesByBusiness(businessId: Id): Promise<Record<Id, PayrollScheme>> {
  return http<Record<Id, PayrollScheme>>('GET', `${b(businessId)}/payroll/schemes`).then((all) =>
    Object.fromEntries(Object.entries(all).map(([id, sc]) => [id, schemeFromServer(sc)])),
  );
}

// ─────────────────────────── Расчёт ───────────────────────────

export function computeDay(locationId: Id, date: ISODate): Promise<DayComputation> {
  return http<DayComputation>('GET', `${b(currentBusinessId())}/payroll/day`, undefined, { query: { locationId, date } });
}

export function computePeriod(locationId: Id, from: ISODate, to: ISODate, positionKey?: string): Promise<PeriodComputation> {
  return http<PeriodComputation>('GET', `${b(currentBusinessId())}/payroll/period`, undefined, { query: { locationId, from, to, positionKey } });
}

export function computeStatement(locationId: Id, staffId: Id, from: ISODate, to: ISODate): Promise<StatementComputation> {
  return http<StatementComputation>('GET', `${b(currentBusinessId())}/payroll/statement`, undefined, { query: { locationId, staffId, from, to } });
}

export function getStaffBalance(businessId: Id, staffId: Id): Promise<{ earned: number; paid: number; remaining: number }> {
  return http('GET', `${b(businessId)}/staff/${staffId}/settlements/balance`);
}

export function getPayrollFundAnalytics(locationId: Id, from: ISODate, to: ISODate) {
  return http('GET', `${b(currentBusinessId())}/payroll/fund-analytics`, undefined, { query: { locationId, from, to } });
}

// ─────────────────────────── Справочник «Премии и штрафы» ───────────────────────────

export function listBonusPenaltyTypes(businessId: Id, kind?: BonusPenaltyKind): Promise<BonusPenaltyType[]> {
  return http<BonusPenaltyType[]>('GET', `${b(businessId)}/payroll/bonus-penalty-types`, undefined, { query: { kind } });
}

export function saveBonusPenaltyType(input: { id?: Id; businessId: Id; kind: BonusPenaltyKind; name: string; defaultAmount: number }): Promise<BonusPenaltyType> {
  const body = { kind: input.kind, name: input.name, defaultAmount: input.defaultAmount };
  return input.id ? http<BonusPenaltyType>('PATCH', `${b(input.businessId)}/payroll/bonus-penalty-types/${input.id}`, body) : http<BonusPenaltyType>('POST', `${b(input.businessId)}/payroll/bonus-penalty-types`, body);
}

export function deleteBonusPenaltyType(businessId: Id, id: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/payroll/bonus-penalty-types/${id}`).then(() => undefined);
}

// === stage 21 (лейн services+rest) ═══ Права на раздел «Зарплата» (F-09-085…089) ═══

export function getStaffRights(staffId: Id): Promise<PayrollStaffRights | undefined> {
  return http<PayrollStaffRights | null>('GET', `${b(bizOf(staffId))}/staff/${staffId}/payroll-rights`).then((v) => v ?? undefined);
}

export function listStaffRights(businessId: Id): Promise<Record<Id, PayrollStaffRights>> {
  return http<Record<Id, PayrollStaffRights>>('GET', `${b(businessId)}/payroll/rights`);
}

export function saveStaffRights(rights: PayrollStaffRights): Promise<PayrollStaffRights> {
  const { updatedAt: _updatedAt, ...body } = rights;
  return http<PayrollStaffRights>('POST', `${b(bizOf(rights.staffId))}/payroll/rights`, body);
}

export function saveStaffRightsBatch(list: PayrollStaffRights[]): Promise<PayrollStaffRights[]> {
  const body = { list: list.map(({ updatedAt: _updatedAt, ...r }) => r) };
  return http<PayrollStaffRights[]>('POST', `${b(currentBusinessId())}/payroll/rights/batch`, body);
}

// ─────────────────────────── Классическая модель: правила ───────────────────────────

export function listRules(businessId: Id): Promise<PayrollRule[]> {
  return http<PayrollRule[]>('GET', `${b(businessId)}/payroll/rules`);
}

export function getRule(id: Id): Promise<PayrollRule | undefined> {
  return http<PayrollRule>('GET', `${b(currentBusinessId())}/payroll/rules/${id}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function saveRule(rule: PayrollRule | (Omit<PayrollRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: Id })): Promise<PayrollRule> {
  const { id, businessId, createdAt: _c, updatedAt: _u, ...body } = rule as PayrollRule;
  return id ? http<PayrollRule>('PATCH', `${b(businessId)}/payroll/rules/${id}`, body) : http<PayrollRule>('POST', `${b(businessId)}/payroll/rules`, body);
}

export function deleteRule(id: Id): Promise<void> {
  return http('DELETE', `${b(currentBusinessId())}/payroll/rules/${id}`).then(() => undefined);
}

// ─────────────────────────── Классическая модель: критерии ───────────────────────────

export function listCriteria(businessId: Id): Promise<PayrollCriterion[]> {
  return http<PayrollCriterion[]>('GET', `${b(businessId)}/payroll/criteria`);
}

export function getCriterion(id: Id): Promise<PayrollCriterion | undefined> {
  return http<PayrollCriterion>('GET', `${b(currentBusinessId())}/payroll/criteria/${id}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function saveCriterion(criterion: PayrollCriterion | (Omit<PayrollCriterion, 'id' | 'createdAt' | 'updatedAt'> & { id?: Id })): Promise<PayrollCriterion> {
  const { id, businessId, createdAt: _c, updatedAt: _u, ...body } = criterion as PayrollCriterion;
  return id ? http<PayrollCriterion>('PATCH', `${b(businessId)}/payroll/criteria/${id}`, body) : http<PayrollCriterion>('POST', `${b(businessId)}/payroll/criteria`, body);
}

export function deleteCriterion(id: Id): Promise<void> {
  return http('DELETE', `${b(currentBusinessId())}/payroll/criteria/${id}`).then(() => undefined);
}

// === stage 21 (лейн services+rest) ===
/** F-09-052: предпросмотр значения критерия (docstring выше — 0 вызовов с экрана сегодня, честно отмечено там же) */
export function evaluateCriterionValue(criterionId: Id, staffId: Id, locationId: Id, atDate: ISODate): Promise<number> {
  return http<number>('GET', `${b(currentBusinessId())}/payroll/criteria/${criterionId}/value`, undefined, { query: { staffId, locationId, atDate } });
}

/**
 * F-09-054/055/099: предпросмотр действующего правила (тип `ChartPreviewResult` — @/api/payroll, type-only,
 * без цикла в рантайме). Сервер отдаёт пустое тело, когда у сотрудника нет активного назначения; `http()`
 * разбирает пустой текст в `undefined` (`src/api/http.ts`), не бросает.
 */
export function previewChartForStaff(staffId: Id, locationId: Id, atDate: ISODate): Promise<import('@/api/payroll').ChartPreviewResult | undefined> {
  return http('GET', `${b(currentBusinessId())}/payroll/preview`, undefined, { query: { staffId, locationId, atDate } });
}

// ─────────────────────────── Классическая модель: схемы расчёта (charts) ───────────────────────────

export function listCharts(businessId: Id): Promise<PayrollChart[]> {
  return http<PayrollChart[]>('GET', `${b(businessId)}/payroll/charts`);
}

export function getChart(id: Id): Promise<PayrollChart | undefined> {
  return http<PayrollChart>('GET', `${b(currentBusinessId())}/payroll/charts/${id}`).catch((e) => {
    if (e instanceof HttpApiError && e.code === 'not_found') return undefined;
    throw e;
  });
}

export function saveChart(chart: PayrollChart | (Omit<PayrollChart, 'id' | 'createdAt' | 'updatedAt'> & { id?: Id })): Promise<PayrollChart> {
  const { id, businessId, createdAt: _c, updatedAt: _u, ...body } = chart as PayrollChart;
  return id ? http<PayrollChart>('PATCH', `${b(businessId)}/payroll/charts/${id}`, body) : http<PayrollChart>('POST', `${b(businessId)}/payroll/charts`, body);
}

export function deleteChart(id: Id): Promise<void> {
  return http('DELETE', `${b(currentBusinessId())}/payroll/charts/${id}`).then(() => undefined);
}

export function listChartAssignments(chartId: Id): Promise<PayrollChartAssignment[]> {
  // Сервер фильтрует назначения только по staffId (F-09-055 не просит фильтр по схеме отдельным параметром) —
  // здесь чарт один из немногих в бизнесе, фильтруем на клиенте после короткого списка.
  return http<PayrollChartAssignment[]>('GET', `${b(currentBusinessId())}/payroll/assignments`).then((rows) => rows.filter((a) => a.chartId === chartId));
}

export function listStaffChartAssignments(businessId: Id, staffId: Id): Promise<PayrollChartAssignment[]> {
  return http<PayrollChartAssignment[]>('GET', `${b(businessId)}/payroll/assignments`, undefined, { query: { staffId } });
}

export function assignChartToStaff(chartId: Id, staffId: Id, startDate: ISODate): Promise<PayrollChartAssignment> {
  return http<PayrollChartAssignment>('POST', `${b(currentBusinessId())}/payroll/assignments`, { chartId, staffId, startDate });
}

export function removeChartAssignment(id: Id): Promise<void> {
  return http('DELETE', `${b(currentBusinessId())}/payroll/assignments/${id}`).then(() => undefined);
}

// ─────────────────────────── b04: быстрая настройка при подключении ───────────────────────────

export function listSetupTargetRows(businessId: Id): Promise<{ staffId: Id; hasScheme: boolean }[]> {
  return http('GET', `${b(businessId)}/payroll/setup-targets`);
}

export function bulkApplyDefaultScheme(staffIds: Id[], defaultPercent: number): Promise<number> {
  return http<{ applied: number }>('POST', `${b(currentBusinessId())}/payroll/setup-targets/bulk-apply`, { staffIds, defaultPercent }).then((r) => r.applied);
}

// ─────────────────────────── Согласование ведомости ───────────────────────────

export function getStatementApproval(sheetId: Id): Promise<StatementApproval | undefined> {
  return http<StatementApproval>('GET', `${b(currentBusinessId())}/payroll/statements/${sheetId}/approval`).then((v) => v ?? undefined);
}

export function advanceStatementApproval(sheetId: Id): Promise<StatementApproval> {
  return http<StatementApproval>('POST', `${b(currentBusinessId())}/payroll/statements/${sheetId}/approval/advance`);
}

/** «Вернуть на проверку» (ответ 26, 17.11.2026) */
export function reopenStatementApproval(sheetId: Id): Promise<StatementApproval> {
  return http<StatementApproval>('POST', `${b(currentBusinessId())}/payroll/statements/${sheetId}/approval/reopen`);
}

/** Сотрудник подписывает свою ведомость из «Моя зарплата» (без payroll.view, проход 17.11) */
export function signOwnStatement(businessId: Id, staffId: Id, sheetId: Id): Promise<StatementApproval> {
  return http<StatementApproval>('POST', `${b(businessId)}/staff/${staffId}/statements/${sheetId}/sign`);
}

export function signStatement(sheetId: Id): Promise<StatementApproval> {
  return http<StatementApproval>('POST', `${b(currentBusinessId())}/payroll/statements/${sheetId}/approval/sign`);
}

// ─────────────────────────── Взаиморасчёты (используется из src/api/finance.ts) ───────────────────────────

/** Ведомости до 17.11 сервер подписывал «2026-11-17 – 2026-11-17» — показываем как мок: «17.11.2026–17.11.2026» */
const ISO_PERIOD_LABEL = /^(\d{4})-(\d{2})-(\d{2}) – (\d{4})-(\d{2})-(\d{2})$/;

export function listSettlements(businessId: Id, staffId: Id, periodFrom?: ISODate, periodTo?: ISODate) {
  return http<{ label: string; createdAt?: string }[]>('GET', `${b(businessId)}/staff/${staffId}/settlements`, undefined, { query: { periodFrom, periodTo } }).then((rows) =>
    rows.map((r) => {
      const m = ISO_PERIOD_LABEL.exec(r.label);
      // Время записи — по Еревану без пояса, как у визитов: сервер отдаёт мгновение UTC («…T02:17:00Z»), и сравнение
      // «визит правили после начисления» (F-09-070) красило свежую ведомость «Изменилось после начисления» (проход 17.11)
      const createdAt = r.createdAt ? (toLocalDateTime(r.createdAt) ?? r.createdAt) : r.createdAt;
      return { ...r, createdAt, ...(m ? { label: `${m[3]}.${m[2]}.${m[1]}–${m[6]}.${m[5]}.${m[4]}` } : {}) };
    }),
  );
}

export function createSheet(businessId: Id, staffId: Id, periodFrom: ISODate, periodTo: ISODate, comment?: string, draft?: boolean) {
  return http('POST', `${b(businessId)}/payroll/settlements/sheet`, { staffId, locationId: locationOfStaff(staffId), periodFrom, periodTo, comment, draft });
}

export function accrueSheet(businessId: Id, id: Id) {
  return http('POST', `${b(businessId)}/payroll/settlements/${id}/accrue`);
}

export function createEntry(businessId: Id, staffId: Id, kind: 'bonus' | 'penalty' | 'adjustment', label: string, amount: number, comment?: string) {
  return http('POST', `${b(businessId)}/payroll/settlements/entry`, { staffId, kind, label, amount, comment });
}

export function deleteEntry(businessId: Id, id: Id) {
  return http('DELETE', `${b(businessId)}/payroll/settlements/${id}`).then(() => undefined);
}

/** Выплата зарплаты: способ, момент ('YYYY-MM-DDTHH:mm' по Еревану) и ведомость, по которой платим (ответ 28) */
export function payout(businessId: Id, locationId: Id, staffId: Id, accountId: Id, amount: number, comment?: string, options?: { method?: 'cash' | 'card' | 'transfer' | 'other'; date?: string; sheetId?: Id }) {
  return http('POST', `${b(businessId)}/payroll/payouts`, { staffId, locationId, accountId, amount, comment, method: options?.method, date: options?.date?.slice(0, 16), sheetId: options?.sheetId });
}

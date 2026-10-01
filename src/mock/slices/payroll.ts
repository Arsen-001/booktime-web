import type { CoreData, Id } from "@/domain/core";
import {
  defaultConsumablesSettings,
  defaultGeneralSettings,
  emptyChart,
  emptyCriterion,
  emptyRule,
  emptyScheme,
  type BonusPenaltyType,
  type GeneralSettings,
  type PayrollChart,
  type PayrollChartAssignment,
  type PayrollCriterion,
  type PayrollRule,
  type PayrollScheme,
  type PayrollStaffRights,
  type StatementApproval,
} from "@/domain/payroll";
import { toISODateTime } from "@/lib/date";
import { newId } from "@/lib/id";
import { EMPTY_BIZ_IDS } from "@/mock/seed/ids";
import { defineSlice } from "@/mock/slice";

/**
 * Срез моковой базы раздела «payroll». Принадлежит разделу.
 * Ключи — id сущностей ядра (staffId, locationId). Меняете форму — поднимите version.
 */
export interface PayrollState {
  /** Схема сотрудника; нет записи для staffId = «не настроена» (F-09-010) */
  schemesByStaff: Record<Id, PayrollScheme>;
  /** Основные настройки локации; нет записи для locationId = «не настроены» (F-09-061) */
  settingsByLocation: Record<Id, GeneralSettings>;
  /** Справочник «Премии и штрафы» (F-09-072) — шаблоны со стандартной суммой, по бизнесу */
  bonusPenaltyTypes: BonusPenaltyType[];
  /** F-09-085…088: права по сотруднику поверх базового payroll.view/manage — нет записи = права персоны по умолчанию */
  staffRightsByStaff: Record<Id, PayrollStaffRights>;
  /** F-09-049/050: правила классической модели */
  rules: PayrollRule[];
  /** F-09-051/052: критерии классической модели */
  criteria: PayrollCriterion[];
  /** F-09-053/054: схемы классической модели */
  charts: PayrollChart[];
  /** F-09-055: назначение схемы сотруднику с датой начала */
  chartAssignments: PayrollChartAssignment[];
  /** F-09-100: согласование ведомости — ключ sheetId (finance SettlementEntry.id, kind='sheet') */
  statementApprovals: Record<Id, StatementApproval>;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function seed(core: CoreData, now: Date): PayrollState {
  const nowIso = toISODateTime(now);
  const schemesByStaff: Record<Id, PayrollScheme> = {};
  const settingsByLocation: Record<Id, GeneralSettings> = {};
  const bonusPenaltyTypes: BonusPenaltyType[] = [];

  const businessIds = Array.from(
    new Set(core.locations.map((l) => l.businessId)),
  ).filter((id) => !EMPTY_BIZ_IDS.includes(id));
  for (const businessId of businessIds) {
    bonusPenaltyTypes.push(
      {
        id: newId("bpt"),
        businessId,
        kind: "bonus",
        name: "За хорошую работу",
        defaultAmount: 20000,
        createdAt: nowIso,
      },
      {
        id: newId("bpt"),
        businessId,
        kind: "bonus",
        name: "За вернувшихся клиентов",
        defaultAmount: 10000,
        createdAt: nowIso,
      },
      {
        id: newId("bpt"),
        businessId,
        kind: "penalty",
        name: "Опоздание",
        defaultAmount: 5000,
        createdAt: nowIso,
      },
      {
        id: newId("bpt"),
        businessId,
        kind: "penalty",
        name: "Порча оборудования",
        defaultAmount: 15000,
        createdAt: nowIso,
      },
    );
  }

  for (const location of core.locations) {
    if (EMPTY_BIZ_IDS.includes(location.businessId)) continue; // демо «пустой салон» — настроек нет нигде
    settingsByLocation[location.id] = defaultGeneralSettings(
      location.id,
      nowIso,
    );
  }

  for (const staff of core.staff) {
    if (staff.status === "fired" || staff.status === "disabled") continue;
    if (EMPTY_BIZ_IDS.includes(staff.businessId)) continue;
    const h = hashId(staff.id);

    if (staff.role === "master" && h % 3 !== 0) {
      // Две трети мастеров уже настроены — остальные показывают заставку «Настроить» (F-09-010)
      const scheme = emptyScheme(staff.id, nowIso);
      const hasConsumables = h % 7 === 0;
      scheme.personalServices = {
        ...scheme.personalServices,
        enabled: true,
        defaultPayout: { unit: "percent", value: 30 + (h % 5) * 5 }, // 30..50%
        // F-09-024/026 демо: часть мастеров списывает 100% расходников (без техкарты — 15% цены услуги);
        // при 60% (было) выплата «ставка 30–50% − расходники 60%» уходила в 0 по каждой услуге (QA 30.09)
        demoConsumablesPercent: hasConsumables ? 15 : 0,
        consumables: hasConsumables
          ? { mode: "full", applyClientDiscount: false }
          : defaultConsumablesSettings(),
        // F-09-018/019/020: часть мастеров работает с корректировкой лояльности — видно разнообразие блоков
        loyaltyAdjustment:
          h % 5 === 0
            ? {
                ...scheme.personalServices.loyaltyAdjustment,
                enabled: true,
                includeDiscount: true,
                includePromotion: true,
                promoPayout: { unit: "percent", value: 22 },
              }
            : scheme.personalServices.loyaltyAdjustment,
      };
      // Части мастеров получают ещё и доп. вознаграждение от оборота или прибыли — видно разнообразие блоков
      if (h % 8 === 0) {
        scheme.extraServiceRevenue = {
          enabled: true,
          percent: 5,
          base: "profit",
        }; // F-09-042 пример ТЗ
      } else if (h % 4 === 0) {
        scheme.extraServiceRevenue = {
          enabled: true,
          percent: 3,
          base: "turnover",
        };
      }
      schemesByStaff[staff.id] = scheme;
    } else if (staff.role === "admin" && h % 2 === 0) {
      const scheme = emptyScheme(staff.id, nowIso);
      scheme.workday = {
        enabled: true,
        baseAmount: 8000,
        basePeriod: "day",
        guaranteedMinimum:
          h % 3 === 0
            ? { enabled: true, amount: 150000, period: "month" }
            : scheme.workday.guaranteedMinimum, // F-09-038 пример ТЗ
      };
      scheme.records = {
        ...scheme.records,
        enabled: true,
        perServicePayout: { unit: "amount", value: 300 }, // F-09-040
        onlineWidgetEnabled: h % 4 === 0,
        onlineWidgetPayout: { unit: "amount", value: 200 }, // F-09-041
      };
      schemesByStaff[staff.id] = scheme;
    }
  }

  // F-09-008/009: один демо-салон уже включил компенсацию за ассистирование, видно все три ставки (F-09-015)
  for (const businessId of businessIds) {
    const businessLocations = core.locations.filter(
      (l) => l.businessId === businessId,
    );
    if (!businessLocations.length) continue;
    const firstLoc = businessLocations[0];
    if (hashId(businessId) % 4 === 0 && settingsByLocation[firstLoc.id]) {
      settingsByLocation[firstLoc.id] = {
        ...settingsByLocation[firstLoc.id],
        assistCompensationEnabled: true,
        multipleAssistantsAllowed: true,
        assistantSplitRule: "shared",
      };
      const staffHere = core.staff.filter(
        (s) =>
          s.businessId === businessId &&
          s.role === "master" &&
          schemesByStaff[s.id],
      );
      const withAssist = staffHere[0];
      if (withAssist) {
        schemesByStaff[withAssist.id].personalServices.assistRates = {
          withoutAssistant: { unit: "percent", value: 50 },
          asAssistant: { unit: "percent", value: 10 },
        }; // F-09-047 пример ТЗ: 50% без ассистента, 10% как ассистент
      }
    }
  }

  // F-09-085…088 демо: в одном салоне владелец сузил права одного администратора (видит расчёт, но
  // не может начислять и не может менять схемы) и одного мастера (видит только себя — F-09-088).
  const staffRightsByStaff: Record<Id, PayrollStaffRights> = {};
  const rules: PayrollRule[] = [];
  const criteria: PayrollCriterion[] = [];
  const charts: PayrollChart[] = [];
  const chartAssignments: PayrollChartAssignment[] = [];
  for (const businessId of businessIds) {
    const admins = core.staff.filter(
      (s) =>
        s.businessId === businessId &&
        s.role === "admin" &&
        s.status !== "fired",
    );
    const masters = core.staff.filter(
      (s) =>
        s.businessId === businessId &&
        s.role === "master" &&
        s.status !== "fired",
    );
    if (hashId(businessId) % 3 === 0 && admins[0]) {
      staffRightsByStaff[admins[0].id] = {
        staffId: admins[0].id,
        schemesAccess: false,
        calcAccess: "all",
        accrueAccess: "none",
        updatedAt: nowIso,
      };
    }
    if (masters[0]) {
      staffRightsByStaff[masters[0].id] = {
        staffId: masters[0].id,
        schemesAccess: false,
        calcAccess: "all",
        accrueAccess: "none",
        ownOnlyStaffId: masters[0].id,
        updatedAt: nowIso,
      };
    }
    if (masters[1] && hashId(businessId) % 2 === 0) {
      // Демо режима «только текущий день» (F-09-086/094)
      staffRightsByStaff[masters[1].id] = {
        staffId: masters[1].id,
        schemesAccess: false,
        calcAccess: "today",
        accrueAccess: "none",
        ownOnlyStaffId: masters[1].id,
        updatedAt: nowIso,
      };
    }

    // F-09-049…056 демо: один салон уже пользуется классической моделью (переключатель в настройках)
    if (hashId(businessId) % 4 === 1) {
      const businessLocations = core.locations.filter(
        (l) => l.businessId === businessId,
      );
      for (const loc of businessLocations) {
        if (settingsByLocation[loc.id])
          settingsByLocation[loc.id] = {
            ...settingsByLocation[loc.id],
            payrollModel: "classic",
          };
      }
      const ruleBase = emptyRule(
        newId("prl"),
        businessId,
        "Правило для мастеров маникюра",
        nowIso,
      );
      ruleBase.personalServices = {
        ...ruleBase.personalServices,
        enabled: true,
        defaultPayout: { unit: "percent", value: 40 },
      };
      const rulePlan = emptyRule(
        newId("prl"),
        businessId,
        "Правило при плане 500 000",
        nowIso,
      );
      rulePlan.workday = {
        ...rulePlan.workday,
        enabled: true,
        baseAmount: 25000,
        basePeriod: "month",
      };
      rulePlan.personalServices = {
        ...rulePlan.personalServices,
        enabled: true,
        defaultPayout: { unit: "percent", value: 35 },
      };
      const ruleAdmin = emptyRule(
        newId("prl"),
        businessId,
        "Правило для администратора",
        nowIso,
      );
      ruleAdmin.workday = {
        enabled: true,
        baseAmount: 150000,
        basePeriod: "month",
        guaranteedMinimum: { enabled: false, amount: 0, period: "month" },
      };
      rules.push(ruleBase, rulePlan, ruleAdmin);

      const criterion = emptyCriterion(
        newId("pcr"),
        businessId,
        "Услуги 500 000",
        nowIso,
      );
      criterion.threshold = 500000;
      criteria.push(criterion);

      const chartPlanned = emptyChart(
        newId("pch"),
        businessId,
        "Схема для мастеров маникюра",
        nowIso,
      );
      chartPlanned.type = "planned";
      chartPlanned.standardRuleId = ruleBase.id;
      chartPlanned.planRows = [
        { criterionId: criterion.id, ruleId: rulePlan.id },
      ];
      const chartAdmin = emptyChart(
        newId("pch"),
        businessId,
        "Схема для администраторов",
        nowIso,
      );
      chartAdmin.standardRuleId = ruleAdmin.id;
      charts.push(chartPlanned, chartAdmin);

      if (masters[0])
        chartAssignments.push({
          id: newId("pca"),
          chartId: chartPlanned.id,
          staffId: masters[0].id,
          startDate: "2026-01-01",
          createdAt: nowIso,
        });
      if (admins[0])
        chartAssignments.push({
          id: newId("pca"),
          chartId: chartAdmin.id,
          staffId: admins[0].id,
          startDate: "2026-01-01",
          createdAt: nowIso,
        });
    }
  }

  return {
    schemesByStaff,
    settingsByLocation,
    bonusPenaltyTypes,
    staffRightsByStaff,
    rules,
    criteria,
    charts,
    chartAssignments,
    statementApprovals: {},
  };
}

export const payrollSlice = defineSlice<PayrollState>({
  version: 5,
  seed,
});

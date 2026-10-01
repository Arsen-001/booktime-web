import type { Id } from '@/domain/core';
import type { DataExportLogEntry, PlanEmailSchedule, ReportFavorite, ReportsStaffPermissions, WeeklyReportSettings } from '@/domain/reports';
import { CHURN_DAYS_DEFAULT } from '@/domain/reports';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «reports». Принадлежит разделу.
 * Меняете форму — поднимите version.
 */
export interface ReportsState {
  /** F-12-024: «Считать потерянными, не посещавших более N дней» — по бизнесу (сеть/локация решают вместе) */
  churnDaysByBusiness: Record<Id, number>;
  /** F-12-003: избранные отчёты по сотруднику, порядок = порядок нажатия звёздочки */
  favoritesByStaff: Record<Id, ReportFavorite[]>;
  /** F-12-074: журнал выгрузок/загрузок «Операции с данными», по бизнесу; владелец видит все (F-00-040) */
  exportLogByBusiness: Record<Id, DataExportLogEntry[]>;
  /** F-12-069: id снятых звёздочек-отзывов (⭐ клиент снимает сам, бизнес не удаляет — F-12-069 «У нас») —
   * оставлено для будущей кнопки удаления текстового отзыва о месте, если её решат делать (к обсуждению) */
  removedCompanyReviewIds: Id[];
  /** F-12-084…089: 25 галочек группы «Отчёты» по сотруднику — override поверх defaultReportsPermissions() */
  reportsPermissionsByStaff: Record<Id, ReportsStaffPermissions>;
  /**
   * F-00-195 «План месяца»: цель выручки на месяц, драм. Ключ месяца — 'YYYY-MM'. Нет записи —
   * план не поставлен, карточка на дашборде предлагает поставить его вместо процента выполнения.
   */
  monthlyGoalByBusiness: Record<Id, Record<string, number>>;
  /** F-12-081: расписание ссылки на Excel «Выполнение плана» на почту, по сети. */
  planEmailScheduleByNetwork: Record<Id, PlanEmailSchedule>;
  /** F-12-008: сотрудники (мастера), исключённые владельцем из знаменателя средней заполненности, по бизнесу. */
  workloadExcludedStaffIds: Record<Id, Id[]>;
  /** F-12-083: «еженедельный отчёт» — настройка и лог отправок, по бизнесу. */
  weeklyReportByBusiness: Record<Id, WeeklyReportSettings>;
}

export const reportsSlice = defineSlice<ReportsState>({
  version: 7,
  seed: () => ({
    churnDaysByBusiness: {},
    favoritesByStaff: {},
    exportLogByBusiness: {},
    removedCompanyReviewIds: [],
    reportsPermissionsByStaff: {},
    monthlyGoalByBusiness: {},
    planEmailScheduleByNetwork: {},
    workloadExcludedStaffIds: {},
    weeklyReportByBusiness: {},
  }),
});

export function churnDaysOf(state: ReportsState, businessId: Id): number {
  return state.churnDaysByBusiness[businessId] ?? CHURN_DAYS_DEFAULT;
}

/**
 * API раздела «schedule». Импорт — `@/api/schedule` (экраны и другие разделы не знают, из какого файла функция).
 *   slots — свободные окна и правила онлайн-записи; demo — учебная запись; packages — пакеты; table — таблица графика, шаблоны, помощники для журнала;
 *   calendar — «Мой календарь», действия мастера, быстрая запись; series — повторяющиеся записи;
 *   staff — настройки сотрудника и бизнеса, «Убрать из графика». shared — внутреннее, наружу только типы правок.
 */
export * from '@/api/schedule/slots';
export * from '@/api/schedule/demo';
export * from '@/api/schedule/packages';
export * from '@/api/schedule/table';
export * from '@/api/schedule/calendar';
export * from '@/api/schedule/series';
export * from '@/api/schedule/staff';
export { DEFAULT_DAY_RANGE } from '@/api/schedule/shared';
export type {
  AffectedBooking,
  CellSnapshot,
  CellsApplyResult,
  CellsEditResult,
  MarksEditResult,
  PlanApplyInput,
  PlanApplyResult,
  PlanCounts,
  PlanEntry,
  QuickBookingInput,
  SetCellsInput,
  SetCellsResult,
} from '@/api/schedule/shared';

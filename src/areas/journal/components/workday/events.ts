/**
 * ⭐ Рабочий день журнала: шторки «Утренняя сводка», «Незакрытые визиты», «Итоги дня» открываются событием — из панели
 * «Требует внимания», «⋯ Ещё», сводки дня в шапке, — а живут один раз в журнале (WorkdaySheets). Как CONFIRM_TOMORROW_EVENT.
 */
import type { ISODate } from '@/domain/core';

export type WorkdaySheetKind = 'morning' | 'unclosed' | 'dayClose';

export const WORKDAY_EVENT = 'journal:workday';

export interface WorkdayEventDetail {
  kind: WorkdaySheetKind;
  /** День сводки / итогов (нет — день, открытый в журнале) */
  date?: ISODate;
}

export function openWorkdaySheet(kind: WorkdaySheetKind, date?: ISODate): void {
  window.dispatchEvent(new CustomEvent<WorkdayEventDetail>(WORKDAY_EVENT, { detail: { kind, date } }));
}

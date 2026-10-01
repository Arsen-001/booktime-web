'use client';

/**
 * Отч3: общий период и сотрудник для всех отчётов раздела. Раньше у каждого экрана был свой useState
 * (у «Финансового» по умолчанию 7 дней, у остальных 30) — открыл «Основные показатели» за квартал, перешёл
 * в «По сотрудникам», а там снова 30 дней. Теперь выбор живёт в одном месте и переживает переходы
 * между отчётами и перезагрузку вкладки (sessionStorage — у каждой вкладки свой, как у фильтров журнала).
 *
 * Переход «от цифры к списку» (Отч9) передаёт период явно — ?from=YYYY-MM-DD&to=…&staff=… — их применяет
 * ReportUrlSync и убирает из адреса, чтобы следующая смена периода не спорила со старой ссылкой.
 *
 * useSyncExternalStore с серверным снимком = период по умолчанию: гидратация не расходится с сервером,
 * сохранённый период подставляется сразу после неё (запросы отчётов всё равно ждут гидратации).
 */
import { useSyncExternalStore } from 'react';
import type { DateRange } from '@/ui/Calendar';
import { addDays, today } from '@/lib/date';

export type ReportRange = Required<DateRange>;

interface PeriodState {
  range: ReportRange;
  /** '' — все сотрудники */
  staffId: string;
}

const STORAGE_KEY = 'bt_reports_period';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function defaultReportRange(): ReportRange {
  return { from: addDays(today(), -29), to: today() };
}

function defaultState(): PeriodState {
  return { range: defaultReportRange(), staffId: '' };
}

let state: PeriodState | undefined;
let serverState: PeriodState | undefined;
const listeners = new Set<() => void>();

function load(): PeriodState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PeriodState>;
      const from = parsed.range?.from;
      const to = parsed.range?.to;
      if (from && to && ISO.test(from) && ISO.test(to) && from <= to) {
        return { range: { from, to }, staffId: typeof parsed.staffId === 'string' ? parsed.staffId : '' };
      }
    }
  } catch {
    /* приватное окно / запрет хранилища — живём без памяти */
  }
  return defaultState();
}

function getSnapshot(): PeriodState {
  return (state ??= load());
}

function getServerSnapshot(): PeriodState {
  // Сервер dev живёт сутками: снимок «по умолчанию» пересчитываем, когда сменился день (иначе после полуночи
  // сервер отдаёт вчерашние 30 дней, а браузер — сегодняшние, и гидратация расходится)
  if (!serverState || serverState.range.to !== today()) serverState = defaultState();
  return serverState;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(next: PeriodState): void {
  const prev = getSnapshot();
  if (prev.range.from === next.range.from && prev.range.to === next.range.to && prev.staffId === next.staffId) return;
  // Новый объект периода только если период правда сменился: ключ запроса и мемо соседей остаются теми же
  state = prev.range.from === next.range.from && prev.range.to === next.range.to ? { range: prev.range, staffId: next.staffId } : next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* см. load() */
  }
  for (const l of listeners) l();
}

export function setReportRange(range: DateRange): void {
  const cur = getSnapshot();
  const from = range.from ?? cur.range.from;
  const to = range.to ?? range.from ?? cur.range.to;
  write({ ...cur, range: from <= to ? { from, to } : { from: to, to: from } });
}

export function setReportStaff(staffId: string): void {
  write({ ...getSnapshot(), staffId });
}

/** Применить период/сотрудника из ссылки (ReportUrlSync). Некорректные значения молча пропускаются. */
export function applyReportParams(params: { from?: string | null; to?: string | null; staff?: string | null }): boolean {
  const cur = getSnapshot();
  let next = cur;
  if (params.from && params.to && ISO.test(params.from) && ISO.test(params.to) && params.from <= params.to) {
    next = { ...next, range: { from: params.from, to: params.to } };
  }
  if (params.staff !== null && params.staff !== undefined) next = { ...next, staffId: params.staff };
  if (next === cur) return false;
  write(next);
  return true;
}

/** Общий период отчётов (Отч3) */
export function useReportRange(): ReportRange {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).range;
}

/** Общий выбранный сотрудник отчётов ('' — все) */
export function useReportStaff(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).staffId;
}

/** Ссылка на отчёт с периодом (и сотрудником) — для переходов «от цифры к списку» (Отч9) */
export function reportLink(href: string, range: ReportRange, extra?: Record<string, string | undefined>): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v);
  return `${href}${href.includes('?') ? '&' : '?'}${params.toString()}`;
}

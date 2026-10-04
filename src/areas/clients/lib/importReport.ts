/**
 * Итоги импорта: отказы экрана + ответы сервера → счётчики и CSV «строки с ошибками» (исходные колонки + номер строки
 * в файле + причина) — его можно поправить и загрузить ещё раз.
 */
import type { ImportBatchRowResult, ImportRejectedRow, ImportResultCode } from '@/domain/clients';
import { toCsv } from '@/lib/csv';

/** Номер строки, как его видит человек в Excel: шапка — строка 1, данные — с 2 */
export const fileLine = (rowIndex: number, headerOffset = 1) => rowIndex + 1 + headerOffset;

export interface ImportTotals {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export function totalsOf(results: ImportBatchRowResult[], rejectedBeforeSend: number): ImportTotals {
  const by = (s: ImportBatchRowResult['status']) => results.filter((r) => r.status === s).length;
  return {
    created: by('created'),
    updated: by('updated'),
    skipped: by('skipped'),
    errors: by('error') + rejectedBeforeSend,
  };
}

export interface RejectedLine {
  rowIndex: number;
  code: ImportResultCode;
  duplicateOf?: number;
}

/** Все строки, которые не попали в базу как новые или дополненные, — для файла и списка причин */
export function rejectedLines(rejected: ImportRejectedRow[], results: ImportBatchRowResult[], includeSkipped: boolean): RejectedLine[] {
  const fromServer = results
    .filter((r) => r.status === 'error' || (includeSkipped && r.status === 'skipped'))
    .map((r) => ({ rowIndex: r.rowIndex, code: r.code ?? 'invalid' }));
  return [
    ...rejected.map((r) => ({
      rowIndex: r.rowIndex,
      code: r.code as ImportResultCode,
      duplicateOf: r.duplicateOf,
    })),
    ...fromServer,
  ].sort((a, b) => a.rowIndex - b.rowIndex);
}

/** Сколько строк по каждой причине — для списка «нет телефона — 3 строки» */
export function countByCode(lines: RejectedLine[]): [ImportResultCode, number][] {
  const m = new Map<ImportResultCode, number>();
  lines.forEach((l) => m.set(l.code, (m.get(l.code) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function rejectedCsv(input: {
  headers: string[];
  rows: string[][];
  lines: RejectedLine[];
  lineLabel: string;
  reasonLabel: string;
  reasonText: (line: RejectedLine) => string;
}): string {
  const { headers, rows, lines, lineLabel, reasonLabel, reasonText } = input;
  return toCsv(
    lines.map((l) => [fileLine(l.rowIndex), reasonText(l), ...(rows[l.rowIndex] ?? [])]),
    [lineLabel, reasonLabel, ...headers],
  );
}

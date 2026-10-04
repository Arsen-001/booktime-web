/**
 * Файл или вставка → таблица для импорта клиентов. CSV — `parseCsv` (кавычки, переносы строк в ячейке, `;` `,` Tab),
 * кодировка угадывается: UTF-8, UTF-16 (Excel «Юникод-текст») или Windows-1251 (старые выгрузки и Excel на Windows).
 * .xlsx — свой разбор Open XML (lib/xlsx.ts). Шапка — первая строка с колонкой телефона (findHeaderRow).
 */
import { ApiError } from '@/api/request';
import { findHeaderRow, IMPORT_FILE_MAX_ROWS } from '@/domain/clients';
import { parseCsv } from '@/lib/csv';
import { looksLikeLegacyBiff, looksLikeZip, parseXlsxBytes } from '@/areas/clients/lib/xlsx';

export interface ImportSheet {
  headers: string[];
  rows: string[][];
  fileName?: string;
}

/** Байты текстового файла → строка: BOM, затем строгий UTF-8, иначе Windows-1251 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}

/** true, если среди первых байтов есть управляющие символы (кроме tab/CR/LF) — это не текстовая таблица */
function hasBinaryJunk(bytes: Uint8Array): boolean {
  for (const b of bytes.subarray(0, 2000)) {
    if (b === 0x09 || b === 0x0a || b === 0x0d) continue;
    if (b < 0x20) return true;
  }
  return false;
}

/** Разделитель по первым пяти строкам (над шапкой выгрузки бывает строка-название без разделителей) */
function guessSeparator(text: string): string {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/, 5);
  const count = (sep: string) => Math.max(0, ...lines.map((l) => l.split(sep).length - 1));
  return ([';', '\t', ','] as const).reduce((best, sep) => (count(sep) > count(best) ? sep : best), ';' as string);
}

const parseTableText = (text: string) => parseCsv(text, guessSeparator(text));

/** Таблица → шапка + строки данных; ширина строк выравнивается по самой длинной */
export function tableToSheet(table: string[][], fileName?: string): ImportSheet {
  const clean = table.filter((r) => r.some((c) => (c ?? '').trim()));
  if (clean.length === 0) throw new ApiError('empty_import', 'Нет данных для загрузки');
  const h = findHeaderRow(clean);
  const rows = clean.slice(h + 1);
  if (rows.length === 0) throw new ApiError('empty_import', 'Нет данных для загрузки');
  if (rows.length > IMPORT_FILE_MAX_ROWS) throw new ApiError('too_many_rows', `Не больше ${IMPORT_FILE_MAX_ROWS} строк`);
  const width = Math.max(clean[h].length, ...rows.slice(0, 500).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (clean[h][i] ?? '').trim());
  return {
    headers,
    rows: rows.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim())),
    fileName,
  };
}

/** Вставка из Excel / Google Таблиц (табуляция) или CSV-текст */
export function parsePastedTable(text: string): ImportSheet {
  return tableToSheet(parseTableText(text));
}

/** Выбранный файл: .csv / .txt / .xlsx (и «.xls», который на деле Open XML или текст) */
export async function readImportFile(file: File): Promise<ImportSheet> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (looksLikeZip(bytes)) return tableToSheet(await parseXlsxBytes(bytes), file.name);
  if (looksLikeLegacyBiff(bytes)) throw new ApiError('legacy_xls_unsupported', 'Старый формат .xls');
  if (!/\.(csv|txt|tsv|xls)$/i.test(file.name) && file.type && !file.type.startsWith('text/')) {
    throw new ApiError('binary_unsupported', 'Формат не поддерживается');
  }
  if (bytes[0] !== 0xff && bytes[0] !== 0xfe && hasBinaryJunk(bytes)) throw new ApiError('binary_unsupported', 'Формат не поддерживается');
  return tableToSheet(parseTableText(decodeText(bytes)), file.name);
}

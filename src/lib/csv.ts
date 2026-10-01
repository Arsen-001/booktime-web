/**
 * CSV для Excel (arch-a1 №7: одна копия вместо двух). Разделитель ';' — Excel с ru/hy-локалью открывает
 * без мастера импорта; BOM — чтобы кириллица и армянский не превращались в «кракозябры».
 *
 *   const csv = toCsv(rows.map((r) => [r.name, r.phone, r.visits]), [t('name'), t('phone'), t('visits')]);
 *   downloadCsv('clients.csv', csv);
 *
 * Выгрузка базы клиентов — только с правом clients.export (проверяет api раздела: assertCan).
 */
export type CsvValue = string | number | boolean | null | undefined;

export const CSV_SEPARATOR = ';';

/** Ячейка: кавычки, если внутри разделитель, кавычка или перевод строки */
export function csvCell(value: CsvValue, separator = CSV_SEPARATOR): string {
  const text = value === null || value === undefined ? '' : String(value);
  const needsQuotes = text.includes(separator) || /[",\r\n]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Таблица → CSV (строки через \r\n); headers — первая строка */
export function toCsv(rows: readonly (readonly CsvValue[])[], headers?: readonly string[], separator = CSV_SEPARATOR): string {
  const lines = rows.map((row) => row.map((v) => csvCell(v, separator)).join(separator));
  return (headers ? [headers.map((h) => csvCell(h, separator)).join(separator), ...lines] : lines).join('\r\n');
}

/** Скачать CSV в браузере (с BOM) */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * CSV → строки ячеек (journal b04: «Загрузить из Excel» — Excel сохраняет таблицу как CSV без библиотек .xlsx).
 * Разделитель угадывается по первой строке (';', ',' или табуляция — вставка прямо из Excel), кавычки и переводы
 * строк внутри кавычек понимает, BOM и пустые строки убирает. Проверку содержимого делает раздел.
 *   const rows = parseCsv(await readTextFile(file));   // [['Имя', 'Телефон'], ['Ани', '+374…'], …]
 */
export function parseCsv(text: string, separator?: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep =
    separator ??
    ([CSV_SEPARATOR, ',', '\t'] as const).reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best), CSV_SEPARATOR as string);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.map((c) => c.trim()));
}

/** Текст выбранного файла (input type=file / ImageUpload-подобное поле) — для parseCsv */
export function readTextFile(file: Blob): Promise<string> {
  return file.text();
}

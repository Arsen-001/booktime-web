/**
 * F-04-126: разбор настоящих файлов .xlsx (Open XML) и «псевдо-xls» (тот же Open XML или обычный
 * табличный текст под старым расширением) без внешних библиотек — только встроенный в браузер ZIP-inflate
 * (`DecompressionStream('deflate-raw')`) и `DOMParser` для XML. Старый бинарный BIFF-формат .xls (до Excel
 * 2007) в это не входит — такой файл встречается редко и его разбор без библиотеки нереален; в этом случае
 * бросаем `ApiError('legacy_xls_unsupported')`, а не молча портим данные.
 *
 * 04.10.2026 (импорт за минуту): ячейки с форматом даты (стиль из xl/styles.xml) отдаются как 'YYYY-MM-DD', а не
 * числом дней Excel; лимит строк проверяет экран (файл до IMPORT_FILE_MAX_ROWS, на сервер — пачками).
 */
import { ApiError } from '@/api/request';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function findEocd(view: DataView): number {
  const maxBack = Math.min(view.byteLength, 65557);
  for (let i = view.byteLength - 22; i >= view.byteLength - maxBack; i--) {
    if (i < 0) break;
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new ApiError('not_a_zip', 'Файл повреждён или это не .xlsx');
}

function readCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder('utf-8');
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIG) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLen);
    entries.push({ name: decoder.decode(nameBytes), method, compressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflate(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes;
  if (method !== 8) throw new ApiError('unsupported_zip_method', 'Формат сжатия внутри файла не поддерживается');
  if (typeof DecompressionStream === 'undefined')
    throw new ApiError('no_decompression_stream', 'Браузер не умеет распаковывать .xlsx — обновите браузер или сохраните как .csv');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function readZipEntry(bytes: Uint8Array, entries: ZipEntry[], name: string): Promise<string | undefined> {
  const entry = entries.find((e) => e.name === name);
  if (!entry) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lo = entry.localHeaderOffset;
  if (view.getUint32(lo, true) !== LOCAL_SIG) throw new ApiError('bad_zip_entry', 'Файл повреждён');
  const nameLen = view.getUint16(lo + 26, true);
  const extraLen = view.getUint16(lo + 28, true);
  const dataStart = lo + 30 + nameLen + extraLen;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  const raw = await inflate(compressed, entry.method);
  return new TextDecoder('utf-8').decode(raw);
}

/** Общие ячейки `<si>` в sharedStrings.xml — конкатенация всех `<t>` внутри (обычный текст и rich-text runs) */
function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map((si) =>
    Array.from(si.getElementsByTagName('t'))
      .map((t) => t.textContent ?? '')
      .join(''),
  );
}

function colIndexFromRef(ref: string | null): number {
  const letters = ref?.match(/[A-Z]+/)?.[0] ?? 'A';
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

/** Встроенные форматы Excel, которые показывают дату (ECMA-376, 18.8.30) */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** Индексы стилей ячеек (cellXfs), у которых формат — дата: встроенный или свой с d/m/y */
function parseDateStyles(xml: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!xml) return out;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const custom = new Map<number, string>();
  for (const f of Array.from(doc.getElementsByTagName('numFmt'))) custom.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '');
  // Дата — если в формате есть день или год (кавычки, [цвет] и экранированные символы не считаются); «h:mm» — не дата
  const isDateCode = (code: string) => /[dy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));
  const xfs = doc.getElementsByTagName('cellXfs')[0];
  if (!xfs) return out;
  Array.from(xfs.getElementsByTagName('xf')).forEach((xf, i) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || (custom.has(id) && isDateCode(custom.get(id)!))) out.add(i);
  });
  return out;
}

/** Число дней Excel → 'YYYY-MM-DD' (время суток отбрасывается) */
function excelSerialToDate(v: string): string | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 73050) return undefined;
  const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

function cellValue(cell: Element, sharedStrings: string[], dateStyles: Set<number>): string {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    const is = cell.getElementsByTagName('is')[0];
    return is
      ? Array.from(is.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join('')
      : '';
  }
  const v = cell.getElementsByTagName('v')[0]?.textContent ?? '';
  if (type === 's') {
    const i = Number(v);
    return Number.isFinite(i) ? (sharedStrings[i] ?? '') : '';
  }
  if (type === 'e') return '';
  if ((type === null || type === 'n') && v && dateStyles.has(Number(cell.getAttribute('s') ?? -1))) return excelSerialToDate(v) ?? v;
  return v;
}

function parseSheetRows(xml: string, sharedStrings: string[], dateStyles: Set<number>): string[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const rowEls = Array.from(doc.getElementsByTagName('row'));
  return rowEls.map((rowEl) => {
    const cells = Array.from(rowEl.getElementsByTagName('c'));
    const row: string[] = [];
    for (const cell of cells) {
      const col = colIndexFromRef(cell.getAttribute('r'));
      row[col] = cellValue(cell, sharedStrings, dateStyles);
    }
    return Array.from(row, (v) => v ?? ''); // пропущенные ячейки — пустые строки, а не дыры массива
  });
}

/** Первый лист по порядку файлов в архиве (`xl/worksheets/sheet1.xml`, иначе — наименьший номер) */
function pickFirstSheetName(entries: ZipEntry[]): string {
  const sheets = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (sheets.length === 0) throw new ApiError('no_sheet', 'В файле не найдено ни одного листа');
  sheets.sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  return sheets[0].name;
}

/** Разбирает настоящий .xlsx (Open XML/ZIP) в таблицу строк первого листа (непустые строки, без шапки — её ищет экран) */
export async function parseXlsxBytes(bytes: Uint8Array): Promise<string[][]> {
  const entries = readCentralDirectory(bytes);
  const sheetName = pickFirstSheetName(entries);
  const [sheetXml, sharedXml, stylesXml] = await Promise.all([
    readZipEntry(bytes, entries, sheetName),
    readZipEntry(bytes, entries, 'xl/sharedStrings.xml'),
    readZipEntry(bytes, entries, 'xl/styles.xml'),
  ]);
  if (!sheetXml) throw new ApiError('no_sheet', 'В файле не найдено ни одного листа');
  const table = parseSheetRows(sheetXml, parseSharedStrings(sharedXml), parseDateStyles(stylesXml))
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ''));
  if (table.length === 0) throw new ApiError('empty_import', 'Нет данных для загрузки');
  return table;
}

/** true, когда байты начинаются с ZIP-сигнатуры `PK\x03\x04` — так начинаются и .xlsx, и .xls, ошибочно
 * пересохранённые как Open XML со старым расширением. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Настоящий бинарный .xls (BIFF, до Excel 2007) начинается с сигнатуры OLE-контейнера */
export function looksLikeLegacyBiff(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

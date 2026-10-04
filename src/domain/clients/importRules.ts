/**
 * Импорт клиентской базы (F-04-126…129, F-00-190 + ⭐ «переезд за минуту», 04.10.2026): чистые правила без React и
 * без базы — их зовут экран (разбор, сопоставление, проверка) и моковый api (та же проверка, что на сервере).
 * Сервер повторяет нормализацию телефона и проверку полей сам (booktime-backend clients-import.rules.ts) — данным
 * из браузера он не доверяет.
 *
 *   const preset = detectImportPreset(headers);                 // 'altegio' | 'dikidi' | 'generic'
 *   const mapping = suggestImportMapping(headers);              // колонка → поле базы
 *   const prepared = prepareImport(rows, mapping, { statsNote }); // готовые строки, отказы, предупреждения
 */
import type { Id, ISODate } from '@/domain/core';

// ─────────────────────────── Поля базы, в которые ложатся колонки ───────────────────────────

export type ImportColumnTarget =
  | 'ignore'
  | 'name'
  | 'lastName'
  | 'phone'
  | 'additionalPhone'
  | 'email'
  | 'comment'
  | 'birthday'
  | 'gender'
  | 'categories'
  | 'discount'
  | 'sold'
  | 'paid'
  | 'balance'
  | 'card'
  | 'visits'
  | 'firstVisit'
  | 'lastVisit';

/** Порядок в выпадающем списке сопоставления: сначала обязательное и частое */
export const IMPORT_COLUMN_TARGETS: ImportColumnTarget[] = [
  'ignore',
  'name',
  'lastName',
  'phone',
  'additionalPhone',
  'email',
  'birthday',
  'gender',
  'comment',
  'categories',
  'discount',
  'sold',
  'paid',
  'balance',
  'card',
  'visits',
  'firstVisit',
  'lastVisit',
];

/** Откуда файл: выгрузка Altegio, DIKIDI или любая своя таблица (Excel, Google Таблицы, Emly, Booker…) */
export type ImportPreset = 'altegio' | 'dikidi' | 'generic';

/** Что делать с клиентом, чей номер уже есть в базе */
export type ImportOnExisting = 'skip' | 'fillEmpty';

/** Пачка на сервер: не больше 1000 строк за вызов (сервер проверяет то же) */
export const IMPORT_BATCH_MAX = 1000;
/** Строк в одном файле — с запасом для самой большой базы салона; Altegio принимает 500 за раз */
export const IMPORT_FILE_MAX_ROWS = 20_000;

// ─────────────────────────── Строка, готовая к загрузке, и ответы ───────────────────────────

/** Нормализованная строка файла — её и отправляем (сырые ячейки не уходят на сервер) */
export interface ImportClientInput {
  /** Номер строки данных в файле, с 0 (строка заголовков не считается) — по нему экран сопоставляет ответы */
  rowIndex: number;
  name: string;
  lastName?: string;
  /** '+374XXXXXXXX' или иностранный E.164 '+…' */
  phone: string;
  additionalPhone?: string;
  email?: string;
  /** Комментарий из файла + строка со статистикой визитов (для неё в карточке нет своего поля) */
  note?: string;
  birthday?: ISODate;
  gender?: 'male' | 'female';
  tags?: string[];
  discountPercent?: number;
  /** «Продано» — прибавляется к визитам в карточке (importedSold), драмы */
  sold?: number;
  /** «Оплачено» сверх оплат визитов (paidAmount), драмы */
  paid?: number;
  cardNumber?: string;
}

/** Почему строка не загрузится (до отправки — экран, после — сервер) */
export type ImportRejectCode = 'noPhone' | 'phoneFormat' | 'duplicateInFile';
/** Что в строке поправили или выбросили, но клиента всё равно загрузим */
export type ImportWarningCode = 'foreignPhone' | 'nameFromPhone' | 'emailDropped' | 'birthdayDropped' | 'genderDropped' | 'additionalPhoneDropped';

export interface ImportRejectedRow {
  rowIndex: number;
  raw: string[];
  code: ImportRejectCode;
  /** Для duplicateInFile — строка, где этот номер встретился первым */
  duplicateOf?: number;
}

export interface ImportRowWarning {
  rowIndex: number;
  code: ImportWarningCode;
}

/** Итог по строке от сервера (или мока): создан / дополнен / пропущен / ошибка */
export type ImportRowStatus = 'created' | 'updated' | 'skipped' | 'error';
/** exists — номер уже в базе (режим «пропустить»), nothingToFill — в карточке уже всё заполнено */
export type ImportResultCode = 'exists' | 'nothingToFill' | 'duplicateInFile' | 'phoneFormat' | 'noPhone' | 'invalid';

export interface ImportBatchRowResult {
  rowIndex: number;
  status: ImportRowStatus;
  code?: ImportResultCode;
  clientId?: Id;
}

export interface ImportBatchInput {
  rows: ImportClientInput[];
  onExisting: ImportOnExisting;
  /** Только проверить: что создастся, что дополнится, что пропустится — без записи */
  dryRun?: boolean;
  /** Прогон целиком (несколько пачек) — одна строка в журнале загрузок; первая пачка без него, сервер вернёт id */
  runId?: string;
  authorName: string;
  method: 'paste' | 'file';
  /** Строки, отклонённые ещё на экране (нет телефона, повтор) — только чтобы журнал показал полный счёт */
  rejectedBeforeSend?: number;
  /** Последняя пачка прогона — мок пишет прогон в общий журнал «Операции с данными» один раз */
  final?: boolean;
}

export interface ImportBatchResult {
  runId?: string;
  results: ImportBatchRowResult[];
}

// ─────────────────────────── Телефон ───────────────────────────

/**
 * Номер из любой таблицы → E.164. Армения: «093 000 000», «93000000», «374 93 00 00 00», «+374-93-000-000»,
 * число Excel «37493000000» или «3,7493E+10» → '+37493000000'. Иностранный номер принимается, если записан
 * с «+»/«00» или длиной 11–15 цифр (так их выгружает Altegio — без плюса), и помечается foreign.
 */
export function normalizeImportPhone(raw: string | undefined): { phone: string; foreign: boolean } | undefined {
  let s = (raw ?? '').trim();
  if (!s) return undefined;
  // Excel превратил номер в число с экспонентой: 3.7493E+10 / 3,7493E+10
  if (/^\d[.,]\d+e\+?\d+$/i.test(s)) {
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n)) s = n.toFixed(0);
  }
  s = s.replace(/[.,]0+$/, '');
  let digits = s.replace(/\D/g, '');
  // «00» — международный выход, только если за ним полный номер с кодом страны («00374…», «0044…»); «000 900 001»
  // — местный номер с кодом 00 (так выглядят выдуманные номера демо-данных)
  const via00 = s.startsWith('00') && digits.length >= 12;
  const international = s.startsWith('+') || via00;
  if (via00) digits = digits.slice(2);
  if (!digits) return undefined;

  if (!international || digits.startsWith('374')) {
    let d = digits;
    if (d.startsWith('374') && d.length >= 11) d = d.slice(3);
    if (d.startsWith('0') && d.length === 9) d = d.slice(1);
    if (d.length === 8) return { phone: `+374${d}`, foreign: false };
    if (international) return undefined;
  }
  if (digits.startsWith('0')) return undefined;
  if (international ? digits.length >= 8 && digits.length <= 15 : digits.length >= 11 && digits.length <= 15) {
    return { phone: `+${digits}`, foreign: true };
  }
  return undefined;
}

// ─────────────────────────── Даты, пол, суммы ───────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): ISODate | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Дата из таблицы → 'YYYY-MM-DD'. Понимает «15.03.1990», «15-03-1990», «15/03/90», «1990-03-15», «1990-03-15 10:00»,
 * число дней Excel (32947), а «15-03» / «15.03» без года — с годом `yearIfMissing` (Altegio: ДД-ММ, F-04-128).
 * «03/15/1990» (американский порядок) узнаётся, когда второе число больше 12.
 */
export function parseImportDate(raw: string | undefined, yearIfMissing?: number): ISODate | undefined {
  const s = (raw ?? '').trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T].*)?$/);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-./](\d{1,2})(?:[-./](\d{2}|\d{4}))?(?:[ ,T].*)?$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    if (b > 12 && a <= 12) [a, b] = [b, a];
    let y: number | undefined;
    if (m[3]) {
      y = Number(m[3]);
      if (m[3].length === 2) {
        const nowYY = new Date().getFullYear() % 100;
        y += y > nowYY ? 1900 : 2000;
      }
    } else y = yearIfMissing;
    return y === undefined ? undefined : validDate(y, b, a);
  }
  // Дата Excel — число дней от 30.12.1899 (до 2100 года)
  if (/^\d{4,5}(?:[.,]\d+)?$/.test(s)) {
    const n = Math.floor(Number(s.replace(',', '.')));
    if (n > 0 && n < 73051) {
      const dt = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
      return validDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
  }
  return undefined;
}

const MALE = new Set(['m', 'м', '1', 'male', 'man', 'муж', 'мужской', 'мужчина', 'мужч', 'արական', 'տղամարդ']);
const FEMALE = new Set(['f', 'ж', '2', 'female', 'woman', 'w', 'жен', 'женский', 'женщина', 'իգական', 'կին']);

/** Пол: M/F, М/Ж, 1/2, «мужской»/«женский», male/female, по-армянски; пусто или «не указан» → undefined */
export function parseImportGender(raw: string | undefined): 'male' | 'female' | undefined {
  const s = (raw ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (MALE.has(s)) return 'male';
  if (FEMALE.has(s)) return 'female';
  return undefined;
}

/** Сумма: «5 000», «5 000,50 ֏», «5,000.00 AMD», «12.500», «12000 драм» → целые драмы; пусто/мусор → undefined */
export function parseImportMoney(raw: string | undefined, allowNegative = false): number | undefined {
  let s = (raw ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return undefined;
  const thousands = (sep: string) => new RegExp(`^-?\\d{1,3}(\\${sep}\\d{3})+$`).test(s);
  if (s.includes('.') && s.includes(',')) s = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = thousands(',') ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (s.includes('.') && thousands('.')) s = s.replace(/\./g, ''); // у драма нет копеек: «12.500» — это 12 500
  const n = Math.round(Number(s));
  if (!Number.isFinite(n) || (n < 0 && !allowNegative)) return undefined;
  return Math.max(-1_000_000_000, Math.min(n, 1_000_000_000));
}

/** Скидка в процентах 0…100 («10», «10%», «10,5») */
export function parseImportPercent(raw: string | undefined): number | undefined {
  const s = (raw ?? '').replace('%', '').replace(',', '.').trim();
  if (!s) return undefined;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isImportEmail = (v: string) => EMAIL_RE.test(v);

/** «VIP, постоянный; Аллергия» → ['VIP', 'постоянный', 'Аллергия'] (до 10 штук по 40 знаков) */
export function parseImportTags(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const part of (raw ?? '').split(/[,;|\n]/)) {
    const tag = part.trim().slice(0, 40);
    if (tag && !out.some((x) => x.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out.slice(0, 10);
}

// ─────────────────────────── Заголовки: шаблоны и подсказки ───────────────────────────

/** Заголовок → сравнимый вид: нижний регистр, ё→е, без знаков, «Кол-во» → «кол во» */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim();
}

/** Точные названия колонок (ru / en / hy) из выгрузок Altegio, DIKIDI, Emly, Booker и самодельных таблиц */
const EXACT: Record<string, ImportColumnTarget> = {};
const add = (target: ImportColumnTarget, ...names: string[]) => names.forEach((n) => (EXACT[normalizeHeader(n)] = target));
add(
  'name',
  'Имя',
  'Имя клиента',
  'Клиент',
  'ФИО',
  'Name',
  'First name',
  'Client',
  'Client name',
  'Full name',
  'Customer',
  'Անուն',
  'Հաճախորդ',
  'Անուն ազգանուն',
);
add('lastName', 'Фамилия', 'Last name', 'Surname', 'Family name', 'Ազգանուն');
add(
  'phone',
  'Телефон',
  'Номер телефона',
  'Мобильный',
  'Мобильный телефон',
  'Phone',
  'Phone number',
  'Mobile',
  'Tel',
  'Телефон клиента',
  'Հեռախոս',
  'Հեռախոսահամար',
);
add(
  'additionalPhone',
  'Дополнительный телефон',
  'Доп. телефон',
  'Второй телефон',
  'Телефон 2',
  'Additional phone',
  'Second phone',
  'Phone 2',
  'Լրացուցիչ հեռախոս',
);
add('email', 'Email', 'E-mail', 'Почта', 'Эл. почта', 'Электронная почта', 'Էլ. փոստ');
add('comment', 'Комментарий', 'Примечание', 'Заметка', 'Заметки', 'Описание', 'Comment', 'Comments', 'Note', 'Notes', 'Մեկնաբանություն');
add('birthday', 'Дата рождения', 'День рождения', 'Birthday', 'Date of birth', 'Birth date', 'DOB', 'Ծննդյան ամսաթիվ');
add('gender', 'Пол', 'Gender', 'Sex', 'Սեռ');
add('categories', 'Категории', 'Категория', 'Категории клиента', 'Теги', 'Метки', 'Группа', 'Группы', 'Categories', 'Category', 'Tags', 'Labels', 'Կատեգորիա');
add('discount', 'Скидка', 'Скидка %', 'Скидка, %', 'Discount', 'Discount %', 'Զեղչ');
add(
  'sold',
  'Продано',
  'Сумма продаж',
  'Сумма',
  'Выручка',
  'Потрачено',
  'Сумма визитов',
  'Total spent',
  'Spent',
  'Sold',
  'Sales',
  'Revenue',
  'Total',
  'Ծախսել է',
);
add('paid', 'Оплачено', 'Total paid', 'Paid', 'Վճարված');
add('balance', 'Баланс', 'Баланс клиента', 'Остаток', 'Balance', 'Մնացորդ');
add('card', 'Карта', 'Номер карты', 'Карта лояльности', 'Card', 'Card number', 'Loyalty card', 'Քարտ');
add(
  'visits',
  'Визиты',
  'Визитов',
  'Количество визитов',
  'Кол-во визитов',
  'Число визитов',
  'Записей',
  'Кол-во записей',
  'Количество записей',
  'Visits',
  'Visit count',
  'Number of visits',
  'Appointments',
  'Այցեր',
);
add('firstVisit', 'Первый визит', 'Дата первого визита', 'Первая запись', 'First visit', 'First appointment', 'Առաջին այց');
add('lastVisit', 'Последний визит', 'Дата последнего визита', 'Последняя запись', 'Последнее посещение', 'Last visit', 'Last appointment', 'Վերջին այց');

/** Если точного совпадения нет — по словам; порядок важен («доп. телефон» раньше «телефона», «последний визит» раньше «визитов») */
const FUZZY: [RegExp, ImportColumnTarget][] = [
  [/(доп|втор|addit|second|2).*(телефон|phone)|(телефон|phone).*(доп|2)/, 'additionalPhone'],
  [/последн|last (visit|appoint)|վերջին/, 'lastVisit'],
  [/перв.*(визит|запис)|first (visit|appoint)|առաջին/, 'firstVisit'],
  [/визит|запис|visit|appointment|այց/, 'visits'],
  [/телефон|phone|mobile|мобил|հեռախոս/, 'phone'],
  [/mail|почт|փոստ/, 'email'],
  [/фамил|last name|surname|ազգանուն/, 'lastName'],
  [/рожд|birth|ծնունդ|ծննդ/, 'birthday'],
  [/коммент|примеч|заметк|comment|note|մեկնաբան/, 'comment'],
  [/категор|тег|метк|categor|tag|label|կատեգոր/, 'categories'],
  [/скидк|discount|զեղչ/, 'discount'],
  [/оплач|paid/, 'paid'],
  [/продан|продаж|потрач|spent|sold|sales|revenue/, 'sold'],
  [/баланс|balance|остат/, 'balance'],
  [/карт|card/, 'card'],
  [/^пол$|gender|^sex$|սեռ/, 'gender'],
  [/имя|фио|клиент|name|client|customer|անուն/, 'name'],
];

export function guessImportTarget(header: string): ImportColumnTarget {
  const h = normalizeHeader(header);
  if (!h) return 'ignore';
  if (EXACT[h]) return EXACT[h];
  for (const [re, target] of FUZZY) if (re.test(h)) return target;
  return 'ignore';
}

/** Подсказка сопоставления на все колонки; одно поле — одной колонке (вторая такая же → «не загружать») */
export function suggestImportMapping(headers: string[]): ImportColumnTarget[] {
  const used = new Set<ImportColumnTarget>();
  return headers.map((h) => {
    const t = guessImportTarget(h);
    if (t === 'ignore' || used.has(t)) return 'ignore';
    used.add(t);
    return t;
  });
}

/** Колонки, по которым узнаём выгрузку. ⚠ Состав колонок выгрузок не сверен с живыми файлами (нет доступа к кабинетам) */
const ALTEGIO_MARKERS = [
  'продано',
  'оплачено',
  'sold',
  'paid',
  'total spent',
  'total paid',
  'первый визит',
  'first visit',
  'последний визит',
  'last visit',
  'категории',
  'categories',
  'скидка',
  'discount',
  'визиты',
  'visits',
  'баланс',
  'balance',
  'карта',
  'card',
];
const DIKIDI_MARKERS = [
  'кол во записей',
  'количество записей',
  'последняя запись',
  'первая запись',
  'дата добавления',
  'источник',
  'заметка',
  'appointments',
  'last appointment',
  'first appointment',
  'date added',
  'source',
];

export function detectImportPreset(headers: string[]): ImportPreset {
  const hs = headers.map(normalizeHeader);
  const hasPhone = hs.some((h) => guessImportTarget(h) === 'phone');
  if (!hasPhone) return 'generic';
  const score = (markers: string[]) => markers.filter((m) => hs.includes(m)).length;
  const altegio = score(ALTEGIO_MARKERS);
  const dikidi = score(DIKIDI_MARKERS);
  if (dikidi >= 2 && dikidi >= altegio) return 'dikidi';
  if (altegio >= 2) return 'altegio';
  return 'generic';
}

/**
 * Строка заголовков — первая из первых пяти, где узнаётся колонка телефона (над шапкой выгрузки бывает название
 * отчёта или дата); не нашли — первая непустая.
 */
export function findHeaderRow(table: string[][]): number {
  const limit = Math.min(table.length, 5);
  for (let i = 0; i < limit; i++) {
    const cells = table[i].filter((c) => c.trim());
    if (cells.length >= 2 && cells.some((c) => guessImportTarget(c) === 'phone')) return i;
  }
  return Math.max(
    0,
    table.findIndex((r) => r.some((c) => c.trim())),
  );
}

// ─────────────────────────── Проверка всей таблицы ───────────────────────────

export interface ImportVisitStats {
  visits?: number;
  firstVisit?: ISODate;
  lastVisit?: ISODate;
}

export interface PrepareImportOptions {
  /** Строка о визитах из прошлой системы на языке интерфейса («Из прошлой системы: 12 визитов, …») */
  statsNote?: (stats: ImportVisitStats) => string;
  /** Год для дня рождения без года (ДД-ММ) — по умолчанию текущий, как у Altegio */
  birthdayYear?: number;
}

export interface PreparedImport {
  ready: ImportClientInput[];
  rejected: ImportRejectedRow[];
  warnings: ImportRowWarning[];
}

const NOTE_MAX = 2000;

/** Сопоставленные строки → готовые к загрузке + отказы + предупреждения. Пустые строки пропускаются молча */
export function prepareImport(rows: string[][], mapping: ImportColumnTarget[], options: PrepareImportOptions = {}): PreparedImport {
  const col = (target: ImportColumnTarget) => mapping.indexOf(target);
  const idx = Object.fromEntries(IMPORT_COLUMN_TARGETS.map((t) => [t, col(t)])) as Record<ImportColumnTarget, number>;
  const ready: ImportClientInput[] = [];
  const rejected: ImportRejectedRow[] = [];
  const warnings: ImportRowWarning[] = [];
  const firstRowByPhone = new Map<string, number>();
  const year = options.birthdayYear ?? new Date().getFullYear();

  rows.forEach((raw, rowIndex) => {
    if (!raw.some((c) => (c ?? '').trim())) return;
    const get = (t: ImportColumnTarget) => (idx[t] >= 0 ? (raw[idx[t]] ?? '').trim() : '');
    const warn = (code: ImportWarningCode) => warnings.push({ rowIndex, code });

    const phoneRaw = get('phone');
    if (!phoneRaw) return void rejected.push({ rowIndex, raw, code: 'noPhone' });
    const phone = normalizeImportPhone(phoneRaw);
    if (!phone) return void rejected.push({ rowIndex, raw, code: 'phoneFormat' });
    const dupOf = firstRowByPhone.get(phone.phone);
    if (dupOf !== undefined)
      return void rejected.push({
        rowIndex,
        raw,
        code: 'duplicateInFile',
        duplicateOf: dupOf,
      });
    firstRowByPhone.set(phone.phone, rowIndex);
    if (phone.foreign) warn('foreignPhone');

    let name = get('name').replace(/\s+/g, ' ').slice(0, 160);
    let lastName = get('lastName').replace(/\s+/g, ' ').slice(0, 80) || undefined;
    if (!name && lastName) {
      name = lastName;
      lastName = undefined;
    }
    if (!name) {
      name = phone.phone;
      warn('nameFromPhone');
    }

    const input: ImportClientInput = { rowIndex, name, phone: phone.phone };
    if (lastName) input.lastName = lastName;

    const extraRaw = get('additionalPhone');
    if (extraRaw) {
      const extra = normalizeImportPhone(extraRaw);
      if (extra && extra.phone !== phone.phone) input.additionalPhone = extra.phone;
      else if (!extra) warn('additionalPhoneDropped');
    }

    const email = get('email');
    if (email) {
      if (isImportEmail(email) && email.length <= 160) input.email = email.toLowerCase();
      else warn('emailDropped');
    }

    const birthdayRaw = get('birthday');
    if (birthdayRaw) {
      const b = parseImportDate(birthdayRaw, year);
      if (b) input.birthday = b;
      else warn('birthdayDropped');
    }

    const genderRaw = get('gender');
    if (genderRaw) {
      const g = parseImportGender(genderRaw);
      if (g) input.gender = g;
      else if (!/^(-|—|не указан|unknown|не задан|n\/?a)$/i.test(genderRaw)) warn('genderDropped');
    }

    const tags = parseImportTags(get('categories'));
    if (tags.length) input.tags = tags;

    const discount = parseImportPercent(get('discount'));
    if (discount) input.discountPercent = discount;

    // F-04-177: «Баланс» прибавляется и к «Продано», и к «Оплачено» — после загрузки баланс карточки равен ему
    const balance = parseImportMoney(get('balance'), true) ?? 0;
    const sold = (parseImportMoney(get('sold')) ?? 0) + balance;
    const paid = (parseImportMoney(get('paid')) ?? 0) + balance;
    if (sold > 0) input.sold = sold;
    if (paid > 0) input.paid = paid;

    const card = get('card').slice(0, 40);
    if (card) input.cardNumber = card;

    const comment = get('comment');
    const stats: ImportVisitStats = {};
    const visits = parseImportMoney(get('visits'));
    if (visits) stats.visits = visits;
    const firstVisit = parseImportDate(get('firstVisit'));
    if (firstVisit) stats.firstVisit = firstVisit;
    const lastVisit = parseImportDate(get('lastVisit'));
    if (lastVisit) stats.lastVisit = lastVisit;
    const statsLine = options.statsNote && (stats.visits || stats.firstVisit || stats.lastVisit) ? options.statsNote(stats) : '';
    const note = [comment, statsLine].filter(Boolean).join('\n').slice(0, NOTE_MAX);
    if (note) input.note = note;

    ready.push(input);
  });

  return { ready, rejected, warnings };
}

/** Пачки для отправки: ~20 шагов прогресса, не меньше 100 и не больше IMPORT_BATCH_MAX строк в пачке */
export function importBatchSize(total: number): number {
  return Math.min(IMPORT_BATCH_MAX, Math.max(100, Math.ceil(total / 20)));
}

export function chunkImport<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ─────────────────────────── Применение к карточке: «дополнить пустые поля» ───────────────────────────

/** Поля карточки, которые импорт умеет заполнить (общая форма для мока и сервера) */
export interface ImportableClientFields {
  name: string;
  lastName?: string | null;
  email?: string | null;
  note?: string | null;
  birthday?: string | null;
  gender: 'male' | 'female' | 'unknown';
  tags: string[];
  additionalPhone?: string | null;
  discountPercent: number;
  cardNumber?: string | null;
  importedSold: number;
  paidAmount: number;
}

/**
 * Что дописать в существующую карточку в режиме «дополнить пустые поля»: только то, что в карточке пусто
 * (имя не трогаем никогда, суммы — только если там 0, поэтому повтор того же файла ничего не удваивает).
 */
export function fillEmptyPatch(existing: ImportableClientFields, row: ImportClientInput): Partial<ImportableClientFields> {
  const patch: Partial<ImportableClientFields> = {};
  if (!existing.lastName && row.lastName) patch.lastName = row.lastName;
  if (!existing.email && row.email) patch.email = row.email;
  if (!existing.note && row.note) patch.note = row.note;
  if (!existing.birthday && row.birthday) patch.birthday = row.birthday;
  if (existing.gender === 'unknown' && row.gender) patch.gender = row.gender;
  if (existing.tags.length === 0 && row.tags?.length) patch.tags = row.tags;
  if (!existing.additionalPhone && row.additionalPhone) patch.additionalPhone = row.additionalPhone;
  if (!existing.discountPercent && row.discountPercent) patch.discountPercent = row.discountPercent;
  if (!existing.cardNumber && row.cardNumber) patch.cardNumber = row.cardNumber;
  if (!existing.importedSold && row.sold) patch.importedSold = row.sold;
  if (!existing.paidAmount && row.paid) patch.paidAmount = row.paid;
  return patch;
}

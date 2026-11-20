/**
 * Компактная запись моковой базы в localStorage (20.11.2026). Файл фундамента, без зависимостей — его проверяет
 * src/mock/tests/storage-size.test.ts.
 *
 * Зачем: у браузера на сайт ~5,24 млн символов localStorage (Chrome: 5 242 880 на все ключи вместе). Демо пишет
 * только изменённые коллекции/срезы, но целиком: оплата визита — `core:bookings` 2,6 млн + `area:finance` 1,67 млн,
 * открыть вкладку «Уведомления» записи — ещё `area:notify` 1,09 млн. Вместе выше квоты: финансы не сохранялись, после
 * перезагрузки визит «Пришёл», а оплаты нет (demo.booktime.am, 20.11.2026). Урезать сид дальше — терять правдоподобие
 * демо, поэтому храним компактнее: тот же JSON, но
 *   • массив однотипных объектов — таблицей: список наборов ключей один раз, дальше только значения;
 *   • строки, которые повторяются (id, даты, статусы, тексты шаблонов), — один раз в словаре, в данных ссылка.
 * Весь свежий сид: 7,5 млн → 3,3 млн символов (63 % квоты, даже если записать все ключи разом). Без потерь:
 * unpackJson(packJson(x)) равно JSON.parse(JSON.stringify(x)). Старые значения (обычный JSON) читаются как раньше.
 *
 * Формат: MARK + VERSION + JSON.stringify([словарь, данные]). В данных:
 *   строка из словаря   → MARK + номер в base36;
 *   строка, начинающаяся с MARK → LITERAL + строка (в настоящих данных не бывает, но читается обратно точно);
 *   массив объектов (≥ 2) → [TABLE, [[ключи формы 0], …], номер формы, значения…, номер формы, значения…].
 * MARK — символ DEL (0x7f): JSON.stringify его не экранирует, обычный JSON с него не начинается.
 */

const MARK = '\x7f';
const VERSION = '1';
const TABLE = `${MARK}*`;
const LITERAL = `${MARK}!`;
/** Короче — ссылка не окупается */
const MIN_DICT_LENGTH = 3;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Как JSON.stringify: у объекта пропадают ключи со значением undefined/функцией/символом */
function skipped(v: unknown): boolean {
  return v === undefined || typeof v === 'function' || typeof v === 'symbol';
}

/** Значение для JSON: Date и всё с toJSON — как у JSON.stringify */
function toPlain(v: unknown): unknown {
  return isRecord(v) && typeof (v as { toJSON?: unknown }).toJSON === 'function' ? (v as { toJSON: () => unknown }).toJSON() : v;
}

/** Массив из одних объектов — пишется таблицей (дыры в массиве и Date — нет) */
function isTable(v: unknown[]): boolean {
  if (v.length < 2) return false;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (!isRecord(x) || typeof (x as { toJSON?: unknown }).toJSON === 'function') return false;
  }
  return true;
}

function put(o: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') Object.defineProperty(o, key, { value, enumerable: true, writable: true, configurable: true });
  else o[key] = value;
}

/** Упаковать значение в строку для localStorage */
export function packJson(value: unknown): string {
  const counts = new Map<string, number>();
  const count = (raw: unknown): void => {
    const v = toPlain(raw);
    if (typeof v === 'string') {
      if (v.length >= MIN_DICT_LENGTH) counts.set(v, (counts.get(v) ?? 0) + 1);
    } else if (Array.isArray(v)) {
      for (const x of v) count(x);
    } else if (isRecord(v)) {
      for (const k of Object.keys(v)) count(v[k]);
    }
  };
  count(value);

  // Самые выгодные строки — первыми, им достаются самые короткие номера
  const dict: string[] = [];
  const refs = new Map<string, string>();
  const candidates = [...counts].filter(([, c]) => c > 1).sort((a, b) => b[1] * b[0].length - a[1] * a[0].length);
  for (const [s, c] of candidates) {
    const ref = MARK + dict.length.toString(36);
    // ссылка в каждом месте против строки в словаре (кавычки и запятая)
    if (c * (s.length - ref.length) <= s.length + 3) continue;
    refs.set(s, ref);
    dict.push(s);
  }

  const enc = (raw: unknown): unknown => {
    const v = toPlain(raw);
    if (typeof v === 'string') return refs.get(v) ?? (v.startsWith(MARK) ? LITERAL + v : v);
    if (Array.isArray(v)) {
      if (isTable(v)) {
        const shapes: string[][] = [];
        const shapeIndex = new Map<string, number>();
        const out: unknown[] = [TABLE, shapes];
        for (const o of v as Record<string, unknown>[]) {
          const keys = Object.keys(o).filter((k) => !skipped(o[k]));
          const sig = JSON.stringify(keys);
          let i = shapeIndex.get(sig);
          if (i === undefined) {
            i = shapes.length;
            shapes.push(keys);
            shapeIndex.set(sig, i);
          }
          out.push(i);
          for (const k of keys) out.push(enc(o[k]));
        }
        return out;
      }
      return v.map(enc);
    }
    if (isRecord(v)) {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(v)) if (!skipped(v[k])) put(o, k, enc(v[k]));
      return o;
    }
    return v;
  };

  return MARK + VERSION + JSON.stringify([dict, enc(value)]);
}

/** Прочитать строку из localStorage: упакованную (packJson) или обычный JSON (старые записи) */
export function unpackJson<T = unknown>(raw: string): T {
  if (!raw.startsWith(MARK)) return JSON.parse(raw) as T;
  if (raw[1] !== VERSION) throw new Error(`[mock-db] неизвестная версия упаковки: ${JSON.stringify(raw.slice(0, 2))}`);
  const [dict, body] = JSON.parse(raw.slice(2)) as [string[], Json];
  const dec = (v: Json): unknown => {
    if (typeof v === 'string') {
      if (!v.startsWith(MARK)) return v;
      if (v.startsWith(LITERAL)) return v.slice(LITERAL.length);
      const s = dict[parseInt(v.slice(1), 36)];
      if (s === undefined) throw new Error('[mock-db] битая ссылка в упакованных данных');
      return s;
    }
    if (Array.isArray(v)) {
      if (v[0] !== TABLE) return v.map(dec);
      const shapes = v[1] as string[][];
      const out: Record<string, unknown>[] = [];
      let i = 2;
      while (i < v.length) {
        const keys = shapes[v[i++] as number];
        if (!keys) throw new Error('[mock-db] битая форма в упакованных данных');
        const o: Record<string, unknown> = {};
        for (const k of keys) put(o, k, dec(v[i++]));
        out.push(o);
      }
      return out;
    }
    if (isRecord(v)) {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(v)) put(o, k, dec(v[k] as Json));
      return o;
    }
    return v;
  };
  return dec(body) as T;
}

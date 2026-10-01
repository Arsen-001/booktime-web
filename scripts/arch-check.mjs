// Сторож архитектуры: границы слоёв и разделов, доступ к стору, any, дубли правил. Код НЕ правит.
//
//   node scripts/arch-check.mjs                    — весь src/**, сводка по разделам + список нарушений
//   node scripts/arch-check.mjs --area journal     — только файлы раздела (src/areas/journal, src/api/journal.ts,
//                                                     src/domain/journal.ts, src/mock/slices/journal.ts, его маршруты)
//   node scripts/arch-check.mjs --json             — машинный вывод (для qa/arch/*)
//   node scripts/arch-check.mjs --errors-only      — только ошибки (warn скрыть)
//
// Правила (id — в выводе; подробно — docs/ARCHITECTURE.md §«Сторож»):
//   A1 error  раздел импортирует внутренности чужого раздела (@/areas/<другой>/…)
//   A2 error  экран/раздел/оболочка лезет в моковую базу (@/mock/db, @/mock/slices, @/mock/seed) мимо src/api
//   A3 error  экран зовёт readArea/readCore/mutateArea (@/api/area) — это только для src/api/<area>.ts
//   A4 error  src/api/<X>.ts пишет в чужой срез: mutateArea('<Y>')
//   A5 warn   src/api/<X>.ts читает чужой срез: readArea('<Y>') — лучше через api раздела Y
//   A6 error  any: `: any`, `as any`, `<any>`, `any[]` (исключение — строка с `arch-ok`)
//   A7 warn   двойное приведение `as unknown as` — тип данных не описан
//   A8 warn   права по персоне (`persona ===`) вместо useCan(permission)
//   A9 warn   сырые даты: toISOString() / new Date(строка) / Date.now() в разделе или api — только @/lib/date
//   A10 warn  запись в обход useApiMutation: `await <функция из @/api/*>(` в компоненте .tsx
//   A11 warn  вложенный «сетевой» вызов в api: await coreCreate/coreUpdate/createBooking/… внутри api раздела
//             (каждый — отдельная задержка и отдельная «транзакция»; внутри request() — только синхронный доступ)
//   A12 warn  ключ запроса не начинается с id раздела (useApiQuery(['<area>', …]))
//   A13 warn  файл больше 400 строк (major — больше 700)
//   A14 warn  больше одного компонента в .tsx (правило «один компонент — один файл»)
//   A15 warn  ошибка проглочена молча: .catch(() => {}) / пустой catch
//   A16 warn  свой список «отменённых» статусов записи вместо общего (domain) — дубль правила
//
// Выход 1, если есть error. Строка с комментарием `arch-ok` пропускается.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlyArea = opt('--area');
const asJson = args.includes('--json');
const errorsOnly = args.includes('--errors-only');

const AREAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/areas.json'), 'utf8')).areas;
const AREA_IDS = AREAS.map((a) => a.id);
/** Префиксы маршрутов раздела: 'src/app/biz/journal/' */
const ROUTE_PREFIXES = AREAS.flatMap((a) => a.routes.map((r) => ({ area: a.id, prefix: r.replace(/\*\*$/, '').replace(/\/$/, '') + '/' })));

const FOUNDATION_API = new Set(['request', 'core', 'area']);
const MOCK_ALLOWED = [/^src\/mock\//, /^src\/api\/(core|area|request)\.ts$/, /^src\/demo\//, /^src\/dev\//, /^src\/app\/dev\//, /^src\/shell\/demo\//];
const NESTED_CALLS =
  /\bawait\s+(coreCreate|coreUpdate|coreRemove|coreGet|coreList|createBooking|updateBooking|setBookingStatus|deleteBooking|findClientByPhone|listBookings|ensureClientForAppUser|createGroupEvent|updateGroupEvent|listGroupEvents|getStaffPermissions|setStaffPermissions)\(/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Какому разделу принадлежит файл; undefined — фундамент */
function ownerOf(rel) {
  let m = rel.match(/^src\/areas\/([^/]+)\//);
  if (m) return m[1];
  m = rel.match(/^src\/(api|domain)\/([^/.]+)\.ts$/);
  if (m && AREA_IDS.includes(m[2])) return m[2];
  m = rel.match(/^src\/mock\/slices\/([^/.]+)\.ts$/);
  if (m && AREA_IDS.includes(m[1])) return m[1];
  let best;
  for (const r of ROUTE_PREFIXES) if (rel.startsWith(r.prefix) && (!best || r.prefix.length > best.prefix.length)) best = r;
  return best?.area;
}

const findings = [];
const add = (rule, level, file, line, msg) => findings.push({ rule, level, file, line, msg, area: ownerOf(file) ?? 'foundation' });

const files = walk(path.join(ROOT, 'src')).map((abs) => ({ abs, rel: path.relative(ROOT, abs).split(path.sep).join('/') }));

for (const { abs, rel } of files) {
  const owner = ownerOf(rel);
  if (onlyArea && owner !== onlyArea) continue;
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const isArea = rel.startsWith('src/areas/');
  const isApiArea = /^src\/api\/[^/]+\.ts$/.test(rel) && !FOUNDATION_API.has(path.basename(rel, '.ts'));
  const isUiFile = rel.endsWith('.tsx') && (isArea || rel.startsWith('src/app/') || rel.startsWith('src/shell/'));

  // Имена, импортированные из @/api/<не request> (для A10)
  const apiNames = new Set();
  for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'@\/api\/([a-z]+)'/g)) {
    if (m[2] === 'request') continue;
    if (/^\s*type\s/.test(m[0].slice(6))) continue;
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      if (name && !part.trim().startsWith('type ')) apiNames.add(name);
    }
  }

  lines.forEach((raw, i) => {
    const ln = i + 1;
    if (raw.includes('arch-ok')) return;
    const line = raw.replace(/\/\/.*$/, '');
    const trimmed = raw.trim();
    const isComment = trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//');

    // A1 — чужие внутренности
    for (const m of line.matchAll(/from\s+'@\/areas\/([a-z]+)\//g)) {
      if (owner && m[1] !== owner && !rel.startsWith('src/extensions/')) add('A1', 'error', rel, ln, `импорт внутренностей раздела «${m[1]}» из «${owner}»`);
      // Меню разделов (src/areas/<id>/nav.ts) собирает src/config/nav.ts — это договорённый вход, как extensions
      const navEntry = rel === 'src/config/nav.ts' && new RegExp(`@/areas/${m[1]}/nav'`).test(line);
      if (!owner && !navEntry && !rel.startsWith('src/extensions/') && !rel.startsWith('src/app/dev/') && !rel.startsWith('src/shell/dev/'))
        add('A1', 'error', rel, ln, `фундамент импортирует раздел «${m[1]}» (только через src/extensions)`);
    }
    // A2 — моковая база мимо api
    if (/from\s+'@\/mock\//.test(line) && !MOCK_ALLOWED.some((re) => re.test(rel)) && !/^src\/mock\/slices\//.test(rel)) {
      add('A2', 'error', rel, ln, 'прямой доступ к моковой базе — только через src/api/*');
    }
    // A3 — readArea в экранах
    if (/from\s+'@\/api\/area'/.test(line) && !/^src\/api\//.test(rel)) add('A3', 'error', rel, ln, 'readArea/mutateArea/readCore — только внутри src/api/<area>.ts');
    // A4/A5 — чужой срез
    if (isApiArea) {
      const me = path.basename(rel, '.ts');
      for (const m of line.matchAll(/\b(readArea|mutateArea)\('([a-z]+)'/g)) {
        if (m[2] === me) continue;
        if (m[1] === 'mutateArea') add('A4', 'error', rel, ln, `запись в чужой срез «${m[2]}»`);
        else add('A5', 'warn', rel, ln, `чтение чужого среза «${m[2]}» — лучше функцией src/api/${m[2]}.ts`);
      }
    }
    if (!isComment) {
      // A6 — any
      const allowedAny = /eslint-disable-next-line @typescript-eslint\/no-explicit-any/.test(lines[i - 1] ?? '');
      if (!allowedAny && /(:\s*any\b|\bas\s+any\b|<any>|\bany\[\])/.test(line)) add('A6', 'error', rel, ln, 'any');
      // A7 — as unknown as
      if (/\bas unknown as\b/.test(line)) add('A7', 'warn', rel, ln, 'двойное приведение `as unknown as`');
      // A8 — персона вместо прав
      if ((isArea || /^src\/app\/(?!dev)/.test(rel)) && /\bpersona\s*(===|!==)/.test(line)) add('A8', 'warn', rel, ln, 'проверка по персоне — используйте useCan(permission)');
      // A9 — сырые даты
      if ((isArea || isApiArea) && /(toISOString\(\)|new Date\([^)]|Date\.now\(\))/.test(line)) add('A9', 'warn', rel, ln, 'сырая дата — используйте @/lib/date (today, nowDateTime, parse, toISODate)');
      // A10 — запись мимо useApiMutation
      if (isUiFile) {
        for (const m of line.matchAll(/\bawait\s+([a-zA-Z_$][\w$]*)\(/g)) {
          if (apiNames.has(m[1])) add('A10', 'warn', rel, ln, `вызов ${m[1]}() в обход useApiMutation/useApiQuery`);
        }
      }
      // A11 — вложенные сетевые вызовы в api раздела
      if (isApiArea) for (const m of line.matchAll(NESTED_CALLS)) add('A11', 'warn', rel, ln, `вложенный вызов ${m[1]}() — отдельная задержка и не атомарно`);
      // A12 — ключ запроса
      if (owner && isArea) {
        const m = line.match(/useApiQuery(?:<[^>]*>)?\(\s*\[\s*'([^']+)'/);
        if (m && m[1] !== owner) add('A12', 'warn', rel, ln, `ключ запроса ['${m[1]}', …] — первым должен быть id раздела '${owner}'`);
      }
      // A15 — молчаливые ошибки
      if (/\.catch\(\(\)\s*=>\s*\{\s*\}\)|catch\s*(\(\w*\))?\s*\{\s*\}/.test(line)) add('A15', 'warn', rel, ln, 'ошибка проглочена молча');
      // A16 — свой список отменённых статусов
      if ((isArea || isApiArea) && /\[\s*'cancelled_by_client',\s*'cancelled_by_master'|new Set\(\[\s*'cancelled_by_client'/.test(line))
        add('A16', 'warn', rel, ln, 'свой список отменённых статусов — нужен общий isActiveBooking() в domain');
    }
  });

  // A13 — размер файла
  if (owner && (isArea || isApiArea || /^src\/domain\//.test(rel))) {
    if (lines.length > 700) add('A13', 'warn', rel, 1, `${lines.length} строк (major: > 700) — разбить`);
    else if (lines.length > 400) add('A13', 'warn', rel, 1, `${lines.length} строк (> 400) — разбить`);
  }
  // A14 — несколько компонентов в файле
  if (isArea && rel.endsWith('.tsx')) {
    const comps = [...text.matchAll(/^(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)/gm)].map((m) => m[1]);
    if (comps.length > 1) add('A14', 'warn', rel, 1, `${comps.length} компонентов в одном файле: ${comps.join(', ')}`);
  }
}

// ─────────────────────────── Вывод ───────────────────────────

const shown = errorsOnly ? findings.filter((f) => f.level === 'error') : findings;
const byArea = {};
for (const f of findings) {
  byArea[f.area] ??= { error: 0, warn: 0, rules: {} };
  byArea[f.area][f.level]++;
  byArea[f.area].rules[f.rule] = (byArea[f.area].rules[f.rule] ?? 0) + 1;
}

if (asJson) {
  console.log(JSON.stringify({ summary: byArea, findings: shown }, null, 2));
} else {
  const order = [...AREA_IDS, 'foundation'].filter((a) => byArea[a]);
  console.log('Раздел        error  warn  по правилам');
  for (const a of order) {
    const s = byArea[a];
    const rules = Object.entries(s.rules)
      .sort(([x], [y]) => Number(x.slice(1)) - Number(y.slice(1)))
      .map(([r, n]) => `${r}:${n}`)
      .join(' ');
    console.log(`${a.padEnd(13)} ${String(s.error).padStart(5)} ${String(s.warn).padStart(5)}  ${rules}`);
  }
  if (!order.length) console.log('(нарушений нет)');
  console.log('');
  for (const f of shown.sort((a, b) => (a.level === b.level ? a.file.localeCompare(b.file) || a.line - b.line : a.level === 'error' ? -1 : 1))) {
    console.log(`${f.level === 'error' ? 'ERROR' : 'warn '} ${f.rule.padEnd(3)} ${f.file}:${f.line}  ${f.msg}`);
  }
}

process.exit(findings.some((f) => f.level === 'error') ? 1 : 0);

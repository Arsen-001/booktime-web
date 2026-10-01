// Охват функций ТЗ: сколько F-id каждого раздела помечено в коде атрибутом data-f.
//
//   node scripts/fids.mjs                 — сводка по всем разделам
//   node scripts/fids.mjs --area journal  — плюс список непомеченных функций раздела (id + заголовок)
//   node scripts/fids.mjs --json          — полный JSON в stdout
//   node scripts/fids.mjs --unknown       — data-f в коде, которых нет в ТЗ (опечатки)
//
// Раздел = все F-id из его файлов ТЗ (поле spec в docs/areas.json) + диапазоны F-00 из поля ours.
// F-00-184…201 (поле unowned) — отдельная группа «unowned»; F-00, не попавшие никуда, — «unassigned».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag('--help') || flag('-h')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}

const areasDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/areas.json'), 'utf8'));
const specDir = areasDoc.specDir;

// ─── 1. Все F-id из ТЗ
/** @type {Map<string, {title: string, file: string}>} */
const spec = new Map();
for (const file of fs.readdirSync(specDir).filter((f) => f.endsWith('.md')).sort()) {
  const text = fs.readFileSync(path.join(specDir, file), 'utf8');
  for (const m of text.matchAll(/^###\s+(F-\d{2}-\d{3})\s*[·•\-—:]?\s*(.*)$/gm)) {
    if (!spec.has(m[1])) spec.set(m[1], { title: m[2].trim(), file });
  }
}

/** Диапазоны вида «F-00-001…010», «(F-00-176…183)», «F-00-001...F-00-010», «F-00-031–036» */
function parseRanges(text) {
  const ids = new Set();
  if (!text) return ids;
  const re = /F-(\d{2})-(\d{3})\s*(?:…|\.\.\.|–|—|-)\s*(?:F-\d{2}-)?(\d{3})/g;
  let m;
  const covered = [];
  while ((m = re.exec(text))) {
    const [, part, from, to] = m;
    for (let n = Number(from); n <= Number(to); n++) ids.add(`F-${part}-${String(n).padStart(3, '0')}`);
    covered.push([m.index, m.index + m[0].length]);
  }
  // Одиночные id вне диапазонов
  for (const s of text.matchAll(/F-\d{2}-\d{3}/g)) {
    if (!covered.some(([a, b]) => s.index >= a && s.index < b)) ids.add(s[0]);
  }
  return ids;
}

const byArea = {};
const assigned = new Set();
for (const area of areasDoc.areas) {
  const ids = new Set();
  for (const file of area.spec ?? []) for (const [id, info] of spec) if (info.file === file) ids.add(id);
  for (const id of parseRanges(area.ours)) if (spec.has(id)) ids.add(id);
  byArea[area.id] = ids;
  ids.forEach((id) => assigned.add(id));
}
const unowned = new Set([...parseRanges(areasDoc.unowned)].filter((id) => spec.has(id)));
unowned.forEach((id) => assigned.add(id));
const unassigned = new Set([...spec.keys()].filter((id) => !assigned.has(id)));

// ─── 2. Все data-f в src/**
/** @type {Map<string, string[]>} id → файлы */
const marked = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      const values = [
        ...[...text.matchAll(/data-f\s*=\s*"([^"]*)"/g)].map((m) => m[1]),
        ...[...text.matchAll(/data-f\s*=\s*\{\s*['"`]([^'"`]*)['"`]\s*\}/g)].map((m) => m[1]),
      ];
      for (const v of values) for (const id of v.match(/F-\d{2}-\d{3}/g) ?? []) {
        marked.set(id, [...new Set([...(marked.get(id) ?? []), path.relative(ROOT, full)])]);
      }
    }
  }
}
walk(path.join(ROOT, 'src'));

// ─── 3. Отчёт
const groups = [
  ...areasDoc.areas.map((a) => ({ id: a.id, title: a.title, ids: byArea[a.id] })),
  { id: 'unowned', title: 'Список «максимум функционала» (F-00-184…201)', ids: unowned },
  { id: 'unassigned', title: 'F-00 вне разделов', ids: unassigned },
];
const report = groups.map((g) => {
  const all = [...g.ids].sort();
  const done = all.filter((id) => marked.has(id));
  const missing = all.filter((id) => !marked.has(id));
  return {
    area: g.id,
    title: g.title,
    total: all.length,
    marked: done.length,
    percent: all.length ? Math.round((done.length / all.length) * 1000) / 10 : 0,
    markedIds: done.map((id) => ({ id, files: marked.get(id) })),
    unmarked: missing.map((id) => ({ id, title: spec.get(id)?.title ?? '' })),
  };
});
const unknown = [...marked.keys()].filter((id) => !spec.has(id)).sort().map((id) => ({ id, files: marked.get(id) }));
const totals = { total: spec.size, marked: [...spec.keys()].filter((id) => marked.has(id)).length };

const only = option('--area');
if (only && !report.some((r) => r.area === only)) {
  console.error(`Нет раздела «${only}». Есть: ${report.map((r) => r.area).join(', ')}`);
  process.exit(2);
}

if (flag('--json')) {
  // Без process.exit: иначе вывод в трубу обрезается
  const out = { totals, areas: only ? report.filter((r) => r.area === only) : report, unknown };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} else {
  printTable();
}

function printTable() {
  const rows = only ? report.filter((r) => r.area === only) : report;
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(`${pad('раздел', 14)}${padL('всего', 7)}${padL('помечено', 10)}${padL('%', 7)}`);
  for (const r of rows) console.log(`${pad(r.area, 14)}${padL(r.total, 7)}${padL(r.marked, 10)}${padL(r.percent.toFixed(1), 7)}`);
  if (!only) console.log(`${pad('ИТОГО', 14)}${padL(totals.total, 7)}${padL(totals.marked, 10)}${padL(((totals.marked / Math.max(1, totals.total)) * 100).toFixed(1), 7)}`);

  if (only) {
    const r = rows[0];
    console.log(`\nНе помечены в коде (${r.unmarked.length}):`);
    for (const u of r.unmarked) console.log(`  ${u.id}  ${u.title}`);
  }
  if (flag('--unknown')) {
    console.log(`\ndata-f, которых нет в ТЗ (${unknown.length}):`);
    for (const u of unknown) console.log(`  ${u.id}  ${u.files.join(', ')}`);
  }
}

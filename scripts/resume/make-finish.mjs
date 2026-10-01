// Собирает workflow «достройка»: каждому разделу — его неотмеченные F-id (из scripts/fids.mjs), пачками по 30.
//   node scripts/resume/make-finish.mjs [выход.js]
// 26.09.2026: пользователь «да, запускай» — достроить 786 неотмеченных функций, БЕЗ проверок (они после бэкенда).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../..', import.meta.url).pathname;
const out = process.argv[2] || root + 'scripts/resume/finish.js';
const fids = JSON.parse(execFileSync('node', [root + 'scripts/fids.mjs', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }));
const areas = JSON.parse(fs.readFileSync(root + 'docs/areas.json', 'utf8')).areas;
// Не строим: решение владельца «позже» (F-00-107), чужая страна (F-06-182), статьи-решения ТЗ без интерфейса.
const SKIP = new Set(['F-00-107', 'F-06-182', 'F-00-028', 'F-00-029', 'F-00-030', 'F-00-154']);
const byId = Object.fromEntries(areas.map(a => [a.id, a]));

const AREAS = fids.areas
  .filter(r => byId[r.area] && r.unmarked.length)
  .map(r => ({ ...byId[r.area], todo: r.unmarked.filter(x => !SKIP.has(x.id)) }))
  .filter(a => a.todo.length);
const UNOWNED = (fids.areas.find(r => r.area === 'unowned') || { unmarked: [] }).unmarked;

const tpl = fs.readFileSync(root + 'scripts/resume/finish-template.js', 'utf8');
fs.writeFileSync(out, tpl.replace('__AREAS__', JSON.stringify(AREAS)).replace('__UNOWNED__', JSON.stringify(UNOWNED)));
let n = 0;
for (const a of AREAS) { const k = Math.ceil(a.todo.length / 30); n += k; console.log(a.id.padEnd(13), String(a.todo.length).padStart(3), 'функций,', k, 'пачек'); }
console.log('ничьи', UNOWNED.length, '→ отдельный помощник в конце');
console.log('пачек всего', n, '→', out);

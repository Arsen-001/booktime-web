// Прогресс сборки интерфейса: сколько функций в коде, сколько пачек построено, что осталось.
//   node scripts/progress.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const J = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/a8dc06a4-7c3a-429b-aeb3-71de5e42264f/subagents/workflows/wf_f1d18c9a-efd/journal.jsonl';
const root = new URL('..', import.meta.url).pathname;
const fids = JSON.parse(execFileSync('node', [root + 'scripts/fids.mjs', '--json'], { cwd: root, encoding: 'utf8' }));

// последние результаты по меткам (перезапуски перезаписывают)
const label = {}, res = {}, running = new Set();
// 25.09.2026 18:45: перезапуск после лимита — новый журнал дописывается к старому.
const J2 = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_74ad0252-a62/journal.jsonl';
const J3 = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_ca0c4311-d89/journal.jsonl';
const J4 = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_7854f9f6-731/journal.jsonl';
const J5 = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_57679824-070/journal.jsonl';
const J6 = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_7cf68481-2e1/journal.jsonl';
const lines = [J, J2, J3, J4, J5, J6].filter(f => fs.existsSync(f)).flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const lastLaunch = lines.map(e => e.type).lastIndexOf('launched');
lines.forEach((e, i) => {
  if (e.type === 'started') { label[e.key] = e.label; if (i > lastLaunch) running.add(e.label); }
  if (e.type === 'result') { const l = label[e.key]; res[l] = e.result; running.delete(l); }
  if (e.type === 'failed' || e.type === 'error') running.delete(label[e.key]);
});
const areas = JSON.parse(fs.readFileSync(root + 'docs/areas.json', 'utf8')).areas.map(a => a.id);
const byArea = {};
for (const r of (fids.areas || fids)) byArea[r.area ?? r.id] = r;

const pad = (s, n) => String(s).padEnd(n), lp = (s, n) => String(s).padStart(n);
let T = 0, M = 0, BT = 0, BD = 0;
console.log(pad('раздел', 14) + lp('функций', 9) + lp('в коде', 8) + lp('%', 5) + lp('пачек', 9) + '  сейчас');
for (const id of areas) {
  const f = byArea[id] || {};
  const total = f.total ?? 0, marked = f.marked ?? 0;
  const plan = res[`план:${id}`];
  const nb = plan?.batches?.length ?? 0;
  const built = plan ? plan.batches.filter(b => res[`сборка:${id}:${b.id}`] && (res[`сборка:${id}:${b.id}`].marked ?? 0) > 0).length : 0;
  const now = [...running].filter(l => l.split(':')[1] === id).map(l => l.split(':')[0] + ' ' + l.split(':').slice(2).join(':')).join(', ');
  T += total; M += marked; BT += nb; BD += built;
  console.log(pad(id, 14) + lp(total, 9) + lp(marked, 8) + lp(total ? Math.round(marked / total * 100) : 0, 5) + lp(`${built}/${nb}`, 9) + '  ' + (now || (built === nb && nb ? 'пачки готовы' : 'ждёт очереди')));
}
console.log('-'.repeat(60));
if (fids.totals) { T = fids.totals.total; M = fids.totals.marked; }
console.log(pad('ИТОГО', 14) + lp(T, 9) + lp(M, 8) + lp(Math.round(M / T * 100), 5) + lp(`${BD}/${BT}`, 9));
console.log(`\nОсталось: функций ${T - M}, пачек ${BT - BD}. Потом — круги «пропуски», общая сверка, английский, итог.`);

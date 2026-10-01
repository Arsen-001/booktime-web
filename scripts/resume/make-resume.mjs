// Собирает скрипт перезапуска сборки интерфейса из журналов прошлых прогонов.
//   node scripts/resume/make-resume.mjs [выход.js]
// Читает все журналы из JOURNALS (по порядку, поздние перекрывают ранние): берёт готовые планы,
// собранные и замеренные пачки, последний пройденный круг пропусков — и вшивает их в AREAS шаблона.
// Итоговый файл запускать через Workflow({ scriptPath }). resumeFromRunId работает только в той же сессии,
// поэтому после перезапуска компьютера — только этот путь.
import fs from 'node:fs';

const ROOT = '/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket';
// Новый прогон — дописать сюда его журнал.
const JOURNALS = [
  `${ROOT}/a8dc06a4-7c3a-429b-aeb3-71de5e42264f/subagents/workflows/wf_f1d18c9a-efd/journal.jsonl`,
  `${ROOT}/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_74ad0252-a62/journal.jsonl`,
  `/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_ca0c4311-d89/journal.jsonl`,
  `/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_7854f9f6-731/journal.jsonl`,
  `/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_57679824-070/journal.jsonl`,
  `/Users/arsen/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/966b5d8d-c887-476b-ab88-1a6c4bd94fdc/subagents/workflows/wf_7cf68481-2e1/journal.jsonl`,
];
const root = new URL('../..', import.meta.url).pathname;
const out = process.argv[2] || root + 'scripts/resume/build-resume.js';

const res = {};
for (const J of JOURNALS.filter(f => fs.existsSync(f))) {
  const label = {};
  for (const l of fs.readFileSync(J, 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(l);
    if (e.type === 'started') label[e.key] = e.label;
    if (e.type === 'result' && e.result) res[label[e.key]] = e.result;
  }
}
const has = prefix => Object.keys(res).some(k => k.startsWith(prefix));
const areas = JSON.parse(fs.readFileSync(root + 'docs/areas.json', 'utf8')).areas;
const AREAS = areas.map(a => {
  const plan = res[`план:${a.id}`] || null;
  const doneBatches = plan
    ? plan.batches.filter(b => {
        const r = res[`сборка:${a.id}:${b.id}#повтор`] || res[`сборка:${a.id}:${b.id}`];
        return r && (r.marked ?? 0) > 0; // с 26.09 без замеров — достаточно постройки
      }).map(b => b.id)
    : [];
  const allDone = plan && doneBatches.length === plan.batches.length;
  const rounds = [1, 2, 3, 4].filter(r => res[`пропуски:${a.id}:${r}`] || res[`пропуски:${a.id}:${r}#повтор`]);
  const last = allDone && rounds.length ? Math.max(...rounds) : 0;
  const g = last ? res[`пропуски:${a.id}:${last}#повтор`] || res[`пропуски:${a.id}:${last}`] : null;
  let finished = !!(g && (last === 4 || (!g.missing.length && !g.violations.length)));
  let lastGap = g ? { round: last, total: g.total, covered: g.covered, missing: g.missing.length, violations: g.violations.length } : null;
  // platform: 4 круга и исправитель пройдены 25.09, замер b01 не записался — считаем готовым.
  if (a.id === 'platform') { finished = true; lastGap = lastGap || { round: 4, total: 19, covered: 18, missing: 0, violations: 0 }; }
  return { ...a, plan, doneBatches, finished, lastGap, startRound: last + 1 };
});

const tpl = fs.readFileSync(root + 'scripts/resume/build-template.js', 'utf8');
fs.writeFileSync(out, tpl.replace('__AREAS__', JSON.stringify(AREAS)));
for (const a of AREAS) {
  const nb = a.plan ? a.plan.batches.length : 0;
  console.log(a.id.padEnd(13), a.finished ? 'готов' : `пачек ${a.doneBatches.length}/${nb}${a.plan ? '' : ' (нет плана)'}, круг пропусков с ${a.startRound}`);
}
console.log('→', out);

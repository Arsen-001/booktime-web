// Таблица «цепочки × шаги» из результатов прогона — для qa/e2e/report-q1.md.
//   node qa/e2e/table.mjs [qa/e2e/results-q1.json]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const file = path.resolve(ROOT, process.argv[2] ?? 'qa/e2e/results-q4.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const ICON = { pass: '✅', fail: '❌', wait: '⏳', skip: '⛔' };
const maxSteps = Math.max(...data.chains.map((c) => c.results.length));
const head = ['Цепочка', ...Array.from({ length: maxSteps }, (_, i) => String(i + 1)), '✅', '❌', '⏳', '⛔'];
const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
for (const c of data.chains) {
  const cnt = { pass: 0, fail: 0, wait: 0, skip: 0 };
  const cells = c.results.map((r) => {
    cnt[r.status] += 1;
    return `${ICON[r.status]}&nbsp;${r.id}`;
  });
  while (cells.length < maxSteps) cells.push('');
  lines.push(`| **${c.id}** ${c.title} | ${cells.join(' | ')} | ${cnt.pass} | ${cnt.fail} | ${cnt.wait} | ${cnt.skip} |`);
}
const t = data.total;
lines.push(`| **Итого** (${data.chains.length} цепочек, ${t.pass + t.fail + t.wait + t.skip} шагов) | ${Array.from({ length: maxSteps }, () => '').join(' | ')} | **${t.pass}** | **${t.fail}** | **${t.wait}** | **${t.skip}** |`);
console.log(lines.join('\n'));

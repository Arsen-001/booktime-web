// Генерирует qa/e2e/scenarios.md из описаний цепочек (qa/e2e/chains/*.mjs) — один источник правды:
// что написано в сценарии, то и прогоняется.
//   node qa/e2e/scenarios-md.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const dir = path.join(ROOT, 'qa/e2e/chains');
const chains = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
  chains.push({ file: f, ...(await import(pathToFileURL(path.join(dir, f)).href)).default });
}
const PERSONA = {
  guest: 'гость', client: 'клиент', individual: 'мастер-индивидуал', owner: 'владелец', admin: 'администратор',
  master: 'мастер салона', network: 'владелец сети', platform: 'наша панель',
};
const intro = fs.readFileSync(path.join(ROOT, 'qa/e2e/scenarios.intro.md'), 'utf8');
const out = [intro.trim(), ''];
out.push('## Список цепочек', '');
out.push('| Цепочка | Персоны | Шагов | F-id |', '|---|---|---|---|');
for (const c of chains) out.push(`| [${c.id}](#${c.id.toLowerCase()}) ${c.title} | ${c.personas.map((p) => PERSONA[p] ?? p).join(', ')} | ${c.steps.length} | ${c.fids.join(', ')} |`);
out.push('');
for (const c of chains) {
  out.push(`## ${c.id}`, '', `**${c.title}**`, '', `Файл: \`qa/e2e/chains/${c.file}\` · персоны: ${c.personas.map((p) => `\`${p}\``).join(', ')}`, '');
  out.push('| Шаг | Кто (`?demo=`) | Раздел | Что делаем | Ожидаемое | F-id |', '|---|---|---|---|---|---|');
  for (const s of c.steps) {
    const who = s.persona ? `${PERSONA[s.persona] ?? s.persona} (\`${s.persona}\`)` : '—';
    const note = s.pending ? ` ⏳ ждёт раздела ${s.pending}` : '';
    out.push(`| ${s.id} | ${who} | ${s.area} | ${s.title.replace(/\|/g, '/')} | ${(s.expect ?? '').replace(/\|/g, '/')}${note} | ${(s.fids ?? []).join(', ')} |`);
  }
  out.push('');
}
fs.writeFileSync(path.join(ROOT, 'qa/e2e/scenarios.md'), out.join('\n'));
console.log(`qa/e2e/scenarios.md: ${chains.length} цепочек, ${chains.reduce((n, c) => n + c.steps.length, 0)} шагов`);

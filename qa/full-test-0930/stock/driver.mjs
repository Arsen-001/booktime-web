// Держит один браузер (слот) и выполняет куски кода из q/<n>.mjs: export default async (t, log) => {...}
import { start } from './h.mjs';
import fs from 'node:fs';
process.chdir(new URL('.', import.meta.url).pathname);
const t = await start();
console.log('READY');
fs.writeFileSync('q/READY', '1');
const deadline = Date.now() + 90 * 60_000;
let idle = Date.now();
while (Date.now() < deadline && Date.now() - idle < 15 * 60_000) {
  if (fs.existsSync('q/STOP')) break;
  const jobs = fs.readdirSync('q').filter((f) => f.endsWith('.mjs')).sort();
  if (!jobs.length) { await new Promise((r) => setTimeout(r, 500)); continue; }
  idle = Date.now();
  const f = jobs[0];
  const out = [];
  const log = (...a) => out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  t.log = log; t.errors.length = 0;
  try {
    const mod = await import(`./q/${f}?v=${Date.now()}`);
    await mod.default(t, log);
  } catch (e) { log('FAIL', String(e.stack || e).slice(0, 1500)); try { await t.shot('fail-' + f.replace('.mjs','')); } catch {} }
  if (t.errors.length) log('ERRORS', t.errors.slice(0, 10));
  fs.renameSync(`q/${f}`, `q/${f}.done`);
  fs.writeFileSync(`q/${f}.out`, out.join('\n') + '\n');
}
await t.end();
fs.rmSync('q/READY', { force: true });
console.log('BYE');

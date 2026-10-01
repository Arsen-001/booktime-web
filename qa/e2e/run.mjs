// Прогон сквозных цепочек (qa/e2e/chains/*.mjs) на живом дев-сервере :3710.
//
//   bash scripts/ensure-dev.sh
//   node qa/e2e/run.mjs                 # все цепочки
//   node qa/e2e/run.mjs --only C01,C04  # выбранные
//   node qa/e2e/run.mjs --headed        # смотреть глазами
//   node qa/e2e/run.mjs --out qa/e2e/results-q1.json
//
// Каждая цепочка — свой контекст браузера, то есть своя свежая демо-база (localStorage пуст → сид).
// Итог: JSON с шагами (pass/fail/wait/skip), снимки — qa/shots/e2e/<цепочка>-<шаг>.png,
// таблица для отчёта — node qa/e2e/table.mjs.
import fs from 'node:fs';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { BASE, ROOT, runChain } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const only = typeof opt('only') === 'string' ? String(opt('only')).split(',') : undefined;
const out = path.resolve(ROOT, typeof opt('out') === 'string' ? opt('out') : 'qa/e2e/results-q4.json');
const concurrency = Number(opt('concurrency') ?? 3);

const res = await fetch(`${BASE}/dev/health`).catch(() => undefined);
if (!res || !res.ok) {
  console.error(`✗ дев-сервер ${BASE} не отвечает — сначала bash scripts/ensure-dev.sh`);
  process.exit(2);
}

const dir = path.join(ROOT, 'qa/e2e/chains');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
const chains = [];
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  const chain = mod.default;
  if (!only || only.includes(chain.id)) chains.push(chain);
}

await acquireBrowserSlot();
// q4: браузер под нагрузкой может закрыться посреди прогона (весь прогон падал на 21-й цепочке) — перезапускаем
let browser = await chromium.launch({ headless: !opt('headed') });
let relaunching;
async function liveBrowser() {
  if (browser.isConnected()) return browser;
  relaunching ??= chromium.launch({ headless: !opt('headed') }).then((b) => {
    browser = b;
    relaunching = undefined;
    return b;
  });
  return relaunching;
}
const started = Date.now();
const done = [];
const queue = [...chains];
async function worker() {
  while (queue.length) {
    const chain = queue.shift();
    const lines = [];
    let r;
    try {
      r = await runChain(await liveBrowser(), chain, { log: (l) => lines.push(l) });
    } catch (e) {
      lines.push(`  ⚠ браузер упал: ${String(e.message).split('\n')[0]} — цепочка повторяется на новом браузере`);
      r = await runChain(await liveBrowser(), chain, { log: (l) => lines.push(l) });
    }
    console.log(`\n■ ${chain.id} · ${chain.title}\n${lines.join('\n')}`);
    done.push(r);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, chains.length) }, worker));
await browser.close().catch(() => {});

done.sort((a, b) => a.id.localeCompare(b.id));
const total = { pass: 0, fail: 0, wait: 0, skip: 0 };
for (const c of done) for (const s of c.results) total[s.status] += 1;

let merged = { chains: [] };
if (only && fs.existsSync(out)) {
  try {
    merged = JSON.parse(fs.readFileSync(out, 'utf8'));
  } catch {
    merged = { chains: [] };
  }
}
const keep = (merged.chains ?? []).filter((c) => !done.some((d) => d.id === c.id));
const chainsOut = [...keep, ...done].sort((a, b) => a.id.localeCompare(b.id));
const totalAll = { pass: 0, fail: 0, wait: 0, skip: 0 };
for (const c of chainsOut) for (const s of c.results) totalAll[s.status] += 1;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), total: totalAll, chains: chainsOut }, null, 2));

console.log(
  `\nИтог прогона (${((Date.now() - started) / 1000).toFixed(0)} с): цепочек ${done.length} · ✅ ${total.pass} · ❌ ${total.fail} · ⏳ ${total.wait} · ⛔ ${total.skip}`,
);
console.log(`Результаты: ${path.relative(ROOT, out)}`);

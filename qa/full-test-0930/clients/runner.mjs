// Долгоживущий браузер для проверки раздела clients: берёт один слот, выполняет файлы-команды cmd/<n>.mjs
// (export default async ({ browser, ctx, page, S, go, shot, text }) => result), пишет out/<n>.json.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const DIR = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients';
const CMD = path.join(DIR, 'cmd');
const OUT = path.join(DIR, 'out');
fs.mkdirSync(CMD, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const release = await acquireBrowserSlot({ timeoutMs: 4 * 3600_000 });
const browser = await chromium.launch();
const S = { consoleErrors: [] };
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
let page = await ctx.newPage();
const hook = (p) => {
  p.on('console', (m) => m.type() === 'error' && S.consoleErrors.push(`${p.url()} :: ${m.text().slice(0, 300)}`));
  p.on('pageerror', (e) => S.consoleErrors.push(`PAGEERROR ${p.url()} :: ${String(e).slice(0, 300)}`));
};
hook(page);
const BASE = 'http://localhost:3710';
const VP = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
async function go(route, { persona = 'owner', lang = 'ru', device = 'desktop', api = 'normal', sphere, p = page } = {}) {
  await p.setViewportSize(VP[device]);
  const sep = route.includes('?') ? '&' : '?';
  const url = `${BASE}${route}${sep}demo=${persona}&lang=${lang}&theme=light&api=${api}${sphere ? `&sphere=${sphere}` : ''}`;
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => {
    const el = document.querySelector('main button, main a, button');
    return !el || Object.keys(el).some((k) => k.startsWith('__reactProps'));
  }, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  // закрыть туры
  for (let i = 0; i < 5; i++) {
    const close = p.getByRole('button', { name: /^(Закрыть|Понятно|Close|Got it)$/ }).first();
    if (await close.isVisible().catch(() => false)) { await close.click().catch(() => {}); await p.waitForTimeout(300); } else break;
  }
}
async function shot(name, p = page) {
  const f = path.join(DIR, `${name}.png`);
  await p.screenshot({ path: f, fullPage: false });
  return f;
}
const text = async (p = page) => p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
const api = {
  get browser() { return browser; },
  get ctx() { return ctx; },
  get page() { return page; },
  S, go, shot, text,
  async newCtx() {
    await ctx.close().catch(() => {});
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
    page = await ctx.newPage();
    hook(page);
    return page;
  },
};
let lastActive = Date.now();
fs.writeFileSync(path.join(DIR, 'runner.ready'), String(process.pid));
for (;;) {
  const files = fs.readdirSync(CMD).filter((f) => f.endsWith('.mjs')).sort();
  if (files.includes('quit.mjs')) break;
  if (!files.length) {
    if (Date.now() - lastActive > 20 * 60_000) break;
    await new Promise((r) => setTimeout(r, 400));
    continue;
  }
  for (const f of files) {
    const full = path.join(CMD, f);
    const id = f.replace(/\.mjs$/, '');
    let result;
    const errsBefore = S.consoleErrors.length;
    try {
      const mod = await import(`${full}?t=${Date.now()}`);
      result = { ok: true, value: await Promise.race([mod.default(api), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 240s')), 240000))]) };
    } catch (e) {
      result = { ok: false, error: String(e?.stack ?? e).slice(0, 2000) };
    }
    result.newConsoleErrors = S.consoleErrors.slice(errsBefore);
    fs.renameSync(full, path.join(OUT, `${id}.cmd.mjs`));
    fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(result, null, 2));
    lastActive = Date.now();
  }
}
await browser.close();
release();
fs.rmSync(path.join(DIR, 'runner.ready'), { force: true });
process.exit(0);

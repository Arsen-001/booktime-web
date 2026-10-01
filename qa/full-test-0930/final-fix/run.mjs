// node run.mjs <step.mjs> [role=owner] [phone|desktop]  — шаг получает { page, go, shot, text, api, log }
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const [stepFile, role = 'owner', device = 'desktop'] = process.argv.slice(2);
const B = 'http://localhost:3710';
const sessions = process.env.MODE === 'mock' ? {} : JSON.parse(fs.readFileSync(`${DIR}/sessions.json`, 'utf8'));
const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const errors = [];
let result;
try {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ru-RU' });
  // MODE=mock — мок-режим (без сессии и cookie bt_data), персона задаётся ?demo= в адресе
  const cookieFor = (r) => (process.env.MODE === 'mock' ? [] : [...sessions[r], { name: 'bt_data', value: 'api', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
  const ck = cookieFor(role); if (ck.length) await ctx.addCookies(ck);
  // API=4011 — запросы фронта к :4010 уходят в копию бэкенда :4011 (новая сборка, та же база)
  if (process.env.API === '4011') await ctx.route(/localhost:4010\//, async (route) => {
    const req = route.request();
    // поток событий (SSE) через route.fetch не проксируется — оставляем его на :4010
    if ((req.headers().accept ?? '').includes('text/event-stream')) return route.continue();
    const res = await route.fetch({ url: req.url().replace('localhost:4010', 'localhost:4011') });
    await route.fulfill({ response: res });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => { if (/:401[01]/.test(r.url()) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace('http://localhost:4010', '')}`); });
  const go = async (p, wait = 2500) => { await page.goto(B + p, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(wait); };
  const shot = async (name, full = true) => page.screenshot({ path: `${DIR}/shots/${name}-${role}-${device}.png`, fullPage: full });
  const text = async () => (await page.innerText('main').catch(() => page.innerText('body'))).replace(/[ \t]+/g, ' ');
  const api = async (method, p, body) => page.evaluate(async ([m, u, b, API_BASE]) => { const r = await fetch(API_BASE + u, { method: m, credentials: 'include', headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d }; }, [method, p, body, process.env.API === '4011' ? 'http://localhost:4011' : 'http://localhost:4010']);
  const switchRole = async (r) => { await ctx.clearCookies(); const c2 = cookieFor(r); if (c2.length) await ctx.addCookies(c2); };
  fs.mkdirSync(`${DIR}/shots`, { recursive: true });
  const step = (await import(path.resolve(DIR, stepFile))).default;
  result = await step({ page, go, shot, text, api, switchRole, role, device, ctx });
} catch (e) {
  result = { ERROR: String(e).slice(0, 600) };
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify({ result, errors: [...new Set(errors)].slice(0, 40) }, null, 1));

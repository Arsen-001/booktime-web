// node run.mjs <step.mjs> [role=owner] [phone|desktop]  — шаг получает { page, go, shot, text, api, log }
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const [stepFile, role = 'owner', device = 'desktop'] = process.argv.slice(2);
const B = 'http://localhost:3710';
const sessions = JSON.parse(fs.readFileSync(`${DIR}/sessions.json`, 'utf8'));
const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const errors = [];
let result;
try {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ru-RU' });
  const cookieFor = (r) => [...sessions[r], { name: 'bt_data', value: 'api', domain: 'localhost', path: '/', sameSite: 'Lax' }];
  await ctx.addCookies(cookieFor(role));
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => { if (r.url().includes(':4010') && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace('http://localhost:4010', '')}`); });
  const go = async (p, wait = 2500) => { await page.goto(B + p, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(wait); };
  const shot = async (name, full = true) => page.screenshot({ path: `${DIR}/shots/${name}-${role}-${device}.png`, fullPage: full });
  const text = async () => (await page.innerText('main').catch(() => page.innerText('body'))).replace(/[ \t]+/g, ' ');
  const api = async (method, p, body) => page.evaluate(async ([m, u, b]) => { const r = await fetch('http://localhost:4010' + u, { method: m, credentials: 'include', headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d }; }, [method, p, body]);
  const switchRole = async (r) => { await ctx.clearCookies(); await ctx.addCookies(cookieFor(r)); };
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

// Без подмены: настоящий linked-clients (+ ошибки консоли журнала в api). node qa/queue-1001b/tg-badge/real.mjs
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const API = 'http://localhost:4010';
execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
const phone = '+37400130001';
await fetch(`${API}/v1/auth/code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
const r = await fetch(`${API}/v1/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: '0000', app: 'business' }) });
const cookies = r.headers.getSetCookie().map((c) => { const [nv] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/' }; });
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors = [];
  const tg = [];
  page.on('console', (m) => { if (m.type() === 'error' || /No business in session/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('response', (res) => { if (res.url().includes('/telegram/linked-clients')) tg.push(res.status()); });
  await page.goto('http://localhost:3710/biz/journal?data=api&lang=ru', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.dispatchEvent(new Event('journal:confirm-tomorrow')));
  await page.waitForTimeout(3000);
  console.log('linked-clients:', tg.join(',') || 'не вызывался');
  console.log('ошибки консоли:', errors.length ? errors.join(' | ') : 'нет');
} finally {
  await browser.close();
  release();
}

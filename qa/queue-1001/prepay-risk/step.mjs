// Пошаговый прогон: node step.mjs <name> <width> <url> [действия...]; действие: click:<text> | role:<name> | fill:<label>=<value> | wait:<ms> | shot:<name> | css:<selector>
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = new URL('./', import.meta.url).pathname;
const [name, w, url, ...acts] = process.argv.slice(2);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const api = process.env.API_PORT;
try {
  const ctx = await browser.newContext({ viewport: { width: +w, height: +w > 500 ? 900 : 844 } });
  if (api) await ctx.route('http://localhost:4010/**', (r) => r.continue({ url: r.request().url().replace(':4010', ':' + api) }));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
  await page.goto('http://localhost:3710' + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  for (const a of acts) {
    const [k, ...rest] = a.split(':'); const v = rest.join(':');
    try {
      if (k === 'click') await page.getByText(v, { exact: false }).first().click();
      else if (k === 'exact') await page.getByText(v, { exact: true }).first().click();
      else if (k === 'role') await page.getByRole('button', { name: v }).first().click();
      else if (k === 'radio') await page.getByRole('radio', { name: v }).first().click();
      else if (k === 'sw') await page.getByRole('switch', { name: v }).first().click();
      else if (k === 'css') await page.locator(v).first().click();
      else if (k === 'fill') { const [l, val] = v.split('='); await page.getByLabel(l).first().fill(val); }
      else if (k === 'fillph') { const [l, val] = v.split('='); await page.getByPlaceholder(l).first().fill(val); }
      else if (k === 'type') { await page.keyboard.type(v); }
      else if (k === 'savebk') { const m = page.url().match(/\/(?:bookings|booking)\/([A-Za-z0-9_-]+)/); globalThis.__bk = m?.[1]; console.log('booking', globalThis.__bk, page.url()); }
      else if (k === 'journal') { await page.goto('http://localhost:3710/biz/journal?booking=' + globalThis.__bk + '&' + v, { waitUntil: 'networkidle' }); await page.waitForTimeout(3000); }
      else if (k === 'relang') { const u = new URL(page.url()); u.searchParams.set('lang', v); await page.goto(u.href, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500); }
      else if (k === 'login') {
        // login:<phone>:<client|business> — вход кодом разработки на сервер (API_PORT), cookie сессии — на localhost
        const [phone, app] = v.split(':'); const base = 'http://localhost:' + (api || '4010');
        const h = { 'content-type': 'application/json', origin: 'http://localhost:3710' };
        for (let i = 0; i < 3; i++) {
          const c = await ctx.request.post(base + '/v1/auth/code', { headers: h, data: { phone } });
          if (c.ok()) break;
          const body = await c.json().catch(() => ({}));
          console.log('code', c.status(), JSON.stringify(body).slice(0, 160));
          await page.waitForTimeout(((body.retryAfter ?? body.details ?? 60) + 2) * 1000);
        }
        const r = await ctx.request.post(base + '/v1/auth/verify', { headers: h, data: { phone, code: '0000', app, consent: true } });
        console.log('login', phone, r.status());
      }
      else if (k === 'wait') await page.waitForTimeout(+v);
      else if (k === 'goto') { await page.goto('http://localhost:3710' + v, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); }
      else if (k === 'scroll') await page.getByText(v).first().scrollIntoViewIfNeeded();
      else if (k === 'shot') await page.screenshot({ path: OUT + v + '.png', fullPage: false });
      else if (k === 'full') await page.screenshot({ path: OUT + v + '.png', fullPage: true });
      else if (k === 'text') console.log('---TEXT---\n' + (await page.locator('body').innerText()).slice(0, +v || 3000));
      await page.waitForTimeout(700);
    } catch (e) { console.log('FAIL', a, String(e).slice(0, 200)); await page.screenshot({ path: OUT + name + '-fail.png' }); break; }
  }
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
} finally { await browser.close(); release(); }

// Рабочий день №8/10/12 в режиме api (cookie bt_data=api, вход — sessions.json из login.mjs).
// Пока :4010 не пересобран, запросы ленты (/journal/day-feed) уводятся на копию API :4011 (FEED_API; та же база).
// node api.mjs [step]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const B = 'http://localhost:3710';
const FEED_API = process.env.FEED_API ?? 'http://localhost:4011';
const sessions = JSON.parse(fs.readFileSync(`${DIR}/sessions.json`, 'utf8'));
const step = process.argv[2] ?? 'all';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = {};
const errors = [];
async function newCtx(role, lang, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : width < 1000 ? 1112 : 900 }, locale: lang === 'en' ? 'en-US' : 'ru-RU' });
  await ctx.addCookies([...sessions[role], { name: 'bt_data', value: 'api', domain: 'localhost', path: '/' }, { name: 'lang', value: lang, domain: 'localhost', path: '/' }]);
  if (FEED_API !== 'http://localhost:4010') {
    await ctx.route('http://localhost:4010/v1/biz/*/journal/day-feed*', async (route) => {
      const url = route.request().url().replace('http://localhost:4010', FEED_API);
      const res = await route.fetch({ url });
      await route.fulfill({ response: res });
    });
  }
  return ctx;
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  if (process.env.AT) await page.clock.install({ time: new Date(process.env.AT) });
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => { if (/:401[01]/.test(r.url()) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/http:\/\/localhost:401[01]/, '')}`); });
  return page;
}
const shot = (page, name, fullPage = false) => page.screenshot({ path: `${DIR}/shots/${name}.png`, fullPage });
const settle = async (page, ms = 1500) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(ms); };
const openMore = async (page, width, lang) => {
  if (width < 768) await page.getByRole('button', { name: lang === 'en' ? /more/i : /ещё/i }).last().click();
  else await page.locator('[data-f="F-01-010 F-01-011 F-01-016"]').first().click();
  await settle(page, 700);
};
try {
  if (step === 'all' || step === 'desk') {
    for (const [role, lang, width] of [['admin', 'ru', 834], ['admin', 'ru', 390], ['admin', 'en', 1440], ['master', 'ru', 834], ['owner', 'ru', 1024]]) {
      const ctx = await newCtx(role, lang, width);
      const page = await newPage(ctx);
      await page.goto(`${B}/biz/journal/desk`); await settle(page, 3000);
      await shot(page, `api-desk-${role}-${lang}-${width}`);
      out[`desk-${role}-${width}`] = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 220);
      await ctx.close();
    }
  }
  if (step === 'all' || step === 'keys') {
    const ctx = await newCtx('owner', 'ru', 1440);
    const page = await newPage(ctx);
    await page.goto(`${B}/biz/journal`); await settle(page, 3000);
    const press = (code, key, shiftKey = false) => page.evaluate(([code, key, shiftKey]) => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key, shiftKey, bubbles: true, cancelable: true })), [code, key, shiftKey]);
    await press('ArrowRight', 'ArrowRight'); await settle(page, 1500);
    out.keysNext = (await page.locator('[data-f*="F-01-009"]').first().innerText()).split('\n')[0];
    await press('KeyT', 'е'); await settle(page, 1200);
    out.keysToday = (await page.locator('[data-f*="F-01-009"]').first().innerText()).split('\n')[0];
    await press('Digit3', '3'); await settle(page, 1200);
    await shot(page, 'api-hotkey-3-timeline-ru-1440');
    await press('Digit1', '1'); await settle(page, 800);
    await press('Slash', ',', true); await settle(page, 800);
    out.keysHelp = await page.getByRole('dialog').count();
    await shot(page, 'api-hotkeys-help-ru-1440');
    await page.keyboard.press('Escape'); await settle(page, 600);
    await press('KeyN', 'ն'); await settle(page, 2500); // армянская раскладка: физическая N печатает «ն»
    out.keysNewUrl = page.url();
    await shot(page, 'api-hotkey-N-hy-layout-1440');
    await ctx.close();
  }
  if (step === 'all' || step === 'feed') {
    for (const [role, lang, width] of [['owner', 'ru', 1440], ['master', 'ru', 390], ['admin', 'en', 834]]) {
      const ctx = await newCtx(role, lang, width);
      const page = await newPage(ctx);
      await page.goto(`${B}/biz/journal`); await settle(page, 3000);
      await openMore(page, width, lang);
      await page.getByRole('button', { name: lang === 'en' ? 'Change log' : 'Лента изменений' }).click();
      await settle(page, 2000);
      await shot(page, `api-feed-${role}-${lang}-${width}`);
      out[`feed-${role}`] = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 300);
      await ctx.close();
    }
  }
  if (step === 'all' || step === 'highlight') {
    // A — владелец в журнале («Колонки»), B — администратор на стойке отмечает приход. Сервер шлёт booking.changed (SSE),
    // у A перечитываются записи и лента, запись мигает. Плюс опрос ленты каждые 15 с.
    const ca = await newCtx('owner', 'ru', 1440);
    const a = await newPage(ca);
    await a.goto(`${B}/biz/journal`); await settle(a, 3500);
    const cb = await newCtx('admin', 'ru', 834);
    const b = await newPage(cb);
    await b.goto(`${B}/biz/journal/desk`); await settle(b, 3000);
    const target = await b.locator('li[data-booking]:has([data-desk-action="arrive"])').first().getAttribute('data-booking').catch(() => null);
    out.hlTarget = target;
    if (target) {
      await b.locator(`li[data-booking="${target}"] [data-desk-action="arrive"]`).click(); await settle(b, 2000);
      await shot(b, 'api-desk-after-arrive-admin-ru-834');
      const t0 = Date.now();
      await a.waitForFunction((id) => (document.querySelector('style[data-journal-changes]')?.textContent ?? '').includes(id), target, { timeout: 40000 }).catch(() => {});
      out.hlSeconds = (Date.now() - t0) / 1000;
      out.hlCss = (await a.evaluate(() => document.querySelector('style[data-journal-changes]')?.textContent ?? '')).includes(target);
      const el = a.locator(`[data-booking="${target}"]:visible`).first();
      if (await el.count()) { await el.scrollIntoViewIfNeeded(); await a.waitForTimeout(400); await shot(a, 'api-highlight-owner-ru-1440'); }
      await openMore(a, 1440, 'ru');
      await a.getByRole('button', { name: 'Лента изменений' }).click(); await settle(a, 2000);
      out.hlFeedTop = (await a.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 260);
      await shot(a, 'api-feed-after-admin-arrival-owner-ru-1440');
    }
    await ca.close(); await cb.close();
  }
} catch (e) {
  out.ERROR = String(e).slice(0, 800);
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify({ out, errors: [...new Set(errors)].slice(0, 30) }, null, 1));

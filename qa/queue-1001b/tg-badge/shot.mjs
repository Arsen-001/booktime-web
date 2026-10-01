// Шторка «Подтвердить завтра»: пометка «напомнит Telegram» (F-00-121), режим api; ответ linked-clients подменён в браузере
// (все запрошенные клиенты «подключили бота») — база не меняется. node qa/queue-1001b/tg-badge/shot.mjs
import { execSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = path.resolve('qa/queue-1001b/tg-badge');
const API = 'http://localhost:4010';
execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
const phone = process.env.PHONE ?? '+37400130001';
await fetch(`${API}/v1/auth/code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
const r = await fetch(`${API}/v1/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: '0000', app: 'business' }) });
const cookies = r.headers.getSetCookie().map((c) => { const [nv] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/' }; });
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const [lang, w] of [['ru', 1440], ['ru', 390], ['en', 390]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.route('**/telegram/linked-clients**', (route) => {
      const ids = (new URL(route.request().url()).searchParams.get('clientIds') ?? '').split(',').filter(Boolean);
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clientIds: ids }) });
    });
    await page.goto(`http://localhost:3710/biz/journal?data=api&lang=${lang}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.dispatchEvent(new Event('journal:confirm-tomorrow')));
    await page.waitForTimeout(3000);
    const dlg = page.locator('[role="dialog"]');
    const tg = await dlg.getByText(lang === 'ru' ? 'напомнит Telegram' : 'Telegram will remind').count();
    const app = await dlg.getByText(lang === 'ru' ? 'придёт уведомление' : 'will get a notification').count();
    console.log(lang, w, `Telegram: ${tg}, приложение: ${app}`, errors.length ? 'ошибки: ' + errors.join(' | ') : 'ошибок нет');
    await page.screenshot({ path: path.join(OUT, `sheet-${lang}-${w}.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}

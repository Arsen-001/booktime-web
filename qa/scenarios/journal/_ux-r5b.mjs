// Дизайн-ревью journal ux-r5, дополнение: задержка открытия окна, телефонные шторки, фильтр «Отменённые».
// node qa/scenarios/journal/_ux-r5b.mjs   → qa/shots/journal-ux-r5/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-ux-r5';
const LOG = `${OUT}/ux-r5b-log.txt`;
fs.writeFileSync(LOG, '');
const log = (s) => {
  fs.appendFileSync(LOG, s + '\n');
  console.log(s);
};
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const browser = await chromium.launch();

async function open(device, { persona = 'owner', path = '/biz/journal', query = '' } = {}) {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${BASE}${path}?demo=${persona}&sphere=nails&lang=ru&theme=light${query ? '&' + query : ''}`, { waitUntil: 'load', timeout: 90000 });
  await page.addStyleTag({ content: '[data-demo-fab],[data-demo-fab] *{display:none !important}' }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('h1') && !document.querySelector('[data-skeleton]'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page };
}
const shot = async (name, page) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(`shot ${name}`);
};
async function sheetPages(prefix, page, max = 8) {
  const info = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    if (!dlg) return null;
    const els = [...dlg.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4;
    });
    const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el) return { h: 0 };
    el.setAttribute('data-ux-scroll', '1');
    return { h: el.scrollHeight, c: el.clientHeight };
  });
  log(`${prefix}: ${JSON.stringify(info)}`);
  if (!info?.h) return shot(`${prefix}-1`, page);
  const n = Math.min(max, Math.ceil(info.h / (info.c * 0.9)));
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => {
      const el = document.querySelector("[data-ux-scroll]"); if (el) el.scrollTop = y;
    }, Math.round(i * info.c * 0.9));
    await shot(`${prefix}-${i + 1}`, page);
  }
}
async function timeToDialog(page, action, label) {
  const t0 = Date.now();
  await action();
  await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {});
  log(`latency ${label}: ${Date.now() - t0} ms`);
}

// Задержка «Новая запись» / открытие записи (десктоп, прогретый сервер) — только при LAT=1
if (process.env.LAT)
{
  const { ctx, page } = await open('desktop');
  for (let i = 0; i < 3; i++) {
    await timeToDialog(page, () => page.getByRole('button', { name: 'Новая запись' }).first().click(), `desktop new #${i + 1}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    await timeToDialog(page, () => page.getByTestId('booking-block').first().click(), `desktop open #${i + 1}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
  }
  await ctx.close();
}

// Телефон: окно новой записи и открытой записи — по экранам
{
  const { ctx, page } = await open('phone');
  await timeToDialog(page, () => page.getByRole('button', { name: 'Новая запись' }).first().click(), 'phone new');
  await page.waitForTimeout(600);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Отмена' }).last().click().catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 600));
  await timeToDialog(page, () => page.getByTestId('booking-block').first().click({ force: true }), 'phone open');
  await page.waitForTimeout(600);
  await sheetPages('p11-open', page, 8);
  await ctx.close();
}

// Записи: «Отменённые»
for (const device of ['desktop', 'phone']) {
  const { ctx, page } = await open(device, { path: '/biz/records' });
  const ctl = page.getByText('Отменённые', { exact: true }).first();
  await ctl.click().catch((e) => log(`FAIL cancelled ${device}: ${String(e).split('\n')[0]}`));
  await page.waitForTimeout(600);
  await shot(`${device === 'phone' ? 'p' : 'd'}40-records-cancelled`, page);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  log(`records cancelled ${device} height: ${h}`);
  await ctx.close();
}

await browser.close();
log('done');

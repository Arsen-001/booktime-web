// Снимает состояние моковой базы + тексты «Расчёт за день/период» у владельца для ручной сверки.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/payroll';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  for (const [name, route] of [['daily', '/biz/payroll/daily'], ['period', '/biz/payroll/period']]) {
    await page.goto(`${B}${route}?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    fs.writeFileSync(`${OUT}/${name}.txt`, await page.innerText('main').catch(() => page.innerText('body')));
    await page.screenshot({ path: `${OUT}/${name}-desktop.png`, fullPage: true });
  }
  await page.waitForTimeout(1500);
  const db = await page.evaluate(() => localStorage.getItem('bp-mock-db'));
  fs.writeFileSync(`${OUT}/db.json`, db ?? 'null');
  const t = await page.evaluate(() => new Date().toISOString());
  console.log('now', t, 'dbsize', db?.length, 'errs', errs.slice(0, 10));
} finally { await browser.close(); release(); }

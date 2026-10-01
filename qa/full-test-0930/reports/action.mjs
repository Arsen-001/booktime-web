// Действие → отчёт: «Пришёл» + «Оплатить» в журнале (вид «Список», сегодня) → «Основные показатели» и «Касса за день».
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/reports';
const Q = 'demo=owner&lang=ru&sphere=nails&theme=light';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
const say = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(s); log.push(s); };
const num = (s) => Number(String(s).replace(/[^\d-]/g, ''));
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => say('PAGEERR', e.message));
  const open = async (path, wait = 2500) => {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}${Q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(wait);
    for (let i = 0; i < 30; i++) { if (!(await page.locator('[aria-busy="true"], .animate-pulse').count())) break; await page.waitForTimeout(500); }
  };
  const tile = (text, label) => { const m = new RegExp(`\\n${label}\\n+([\\d\\s  ]+)֏?\\n+([^\\n]*)`).exec(text); return m ? { v: num(m[1]), sub: m[2] } : null; };
  const snap = async (tag) => {
    await open('/biz/reports');
    const d = await page.innerText('main');
    await open('/biz/reports/r/cashDay');
    const c = await page.innerText('main');
    const r = { tag, total: tile(d, 'Итого'), services: tile(d, 'Услуги'), visits: tile(d, 'Визиты'), completed: tile(d, 'Завершенные записи'), cashRecords: tile(c, 'Всего записей'), cashServicesPaid: tile(c, 'Оказанные услуги') };
    say(r);
    return r;
  };

  const before = await snap('before');

  await open('/biz/journal', 4000);
  // вид «Список»
  const listBtn = page.getByRole('radio', { name: /Список/ }).or(page.getByRole('tab', { name: /Список/ })).or(page.getByRole('button', { name: /^Список$/ }));
  if (await listBtn.count()) await listBtn.first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/journal-list.png` });
  const arrive = page.locator('[data-list-action="arrive"]').first();
  say('arrive buttons', await page.locator('[data-list-action="arrive"]').count(), 'pay buttons', await page.locator('[data-list-action="pay"]').count());
  let rowText = '';
  if (await arrive.count()) {
    const row = arrive.locator('xpath=ancestor::*[self::li or self::tr or @role="row"][1]');
    rowText = (await row.count()) ? await row.first().innerText() : '';
    say('row', rowText.replace(/\n/g, ' | '));
    await arrive.click();
    await page.waitForTimeout(2500);
  }
  const payBtn = page.locator('[data-list-action="pay"]').first();
  if (await payBtn.count()) {
    const row = payBtn.locator('xpath=ancestor::*[self::li or self::tr or @role="row"][1]');
    say('pay row', ((await row.count()) ? await row.first().innerText() : '').replace(/\n/g, ' | '));
    await payBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: `${OUT}/journal-after.png` });

  const after = await snap('after');
  const delta = (k) => (after[k]?.v ?? NaN) - (before[k]?.v ?? NaN);
  say('DELTA', { total: delta('total'), services: delta('services'), visits: delta('visits'), completed: delta('completed'), cashRecords: delta('cashRecords'), cashServicesPaid: delta('cashServicesPaid') });
  await page.screenshot({ path: `${OUT}/cashday-after.png`, fullPage: true });
} finally {
  fs.writeFileSync(`${OUT}/action.log`, log.join('\n'));
  await browser.close();
  release();
}

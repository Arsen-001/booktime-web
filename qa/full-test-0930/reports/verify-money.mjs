// Проверка решения владельца 01.10: выручка аналитики = полученные деньги; сверка с кассой/финансовым; пустые состояния.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/reports';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
const say = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(s); log.push(s); };
const num = (s) => Number(String(s).replace(/[^\d-]/g, ''));
const tile = (text, label) => { const m = new RegExp(`\\n${label}\\n+([\\d\\s  ]+)֏?\\n+([^\\n]*)`).exec(text); return m ? { v: num(m[1]), sub: m[2] } : null; };
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', (e) => say('PAGEERR', e.message.slice(0, 120)));
  const open = async (path, q = 'demo=owner&lang=ru&sphere=nails', wait = 3000) => {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(wait);
    await page.waitForFunction(() => (document.querySelector('main')?.innerText.length ?? 0) > 200, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1500);
    for (let i = 0; i < 30; i++) { if (!(await page.locator('[aria-busy="true"], .animate-pulse').count())) break; await page.waitForTimeout(500); }
    return page.innerText('main');
  };
  const d = await open('/biz/reports');
  fs.writeFileSync(`${OUT}/v-dashboard.txt`, d);
  await page.screenshot({ path: `${OUT}/v-dashboard.png`, fullPage: true });
  say('dash', { total: tile(d, 'Итого'), services: tile(d, 'Услуги'), products: tile(d, 'Товары'), booked: /Записано на сумму[^\n]*/.exec(d)?.[0], foot: /\* Деньги[^\n]{0,80}/.exec(d)?.[0] });
  const s = await open('/biz/reports/r/salesByStaff');
  say('byStaff', /Всего получено[^\n]*/.exec(s)?.[0]);
  await page.screenshot({ path: `${OUT}/v-salesByStaff.png`, fullPage: true });
  const f = await open('/biz/reports/r/finance');
  const rowTotal = (label) => { const line = f.split('\n').find((l) => l.startsWith(label + '\t')); return line ? num(line.split('\t').pop()) : null; };
  say('finance', { services: rowTotal('Оказание услуг'), goods: rowTotal('Продажа товаров'), refund: rowTotal('Возврат') });
  // день с оплатами: сверка «Услуги» дашборда за день и «Оказанные услуги» кассы
  for (const day of ['2026-09-19', '2026-09-22', '2026-09-23', '2026-09-27']) {
    const dd = await open(`/biz/reports?from=${day}&to=${day}`);
    const cc = await open(`/biz/reports/r/cashDay?date=${day}`);
    say('day', day, { dashServices: tile(dd, 'Услуги')?.v, dashProducts: tile(dd, 'Товары')?.v, cashServices: tile(cc, 'Оказанные услуги')?.v, cashProducts: tile(cc, 'Товары')?.v });
  }
  // пустой бизнес
  for (const slug of ['salesByStaff', 'cashDay']) {
    const t = await open(`/biz/reports/r/${slug}`, 'demo=owner&empty=1&lang=ru&sphere=nails');
    await page.screenshot({ path: `${OUT}/v-empty-${slug}.png` });
    say('empty', slug, t.slice(0, 260).replace(/\n/g, ' | '));
  }
  // подписи фильтров
  await open('/biz/reports');
  await page.getByRole('button', { name: /^Фильтры/ }).click();
  await page.waitForTimeout(800);
  say('labels', await page.getByRole('combobox', { name: 'Должности' }).count(), await page.getByRole('combobox', { name: 'Сотрудники' }).count());
  await page.screenshot({ path: `${OUT}/v-filters.png` });
  // en
  const en = await open('/biz/reports', 'demo=owner&lang=en&sphere=nails');
  say('en', /Booked value[^\n]*/.exec(en)?.[0]);
} finally {
  fs.writeFileSync(`${OUT}/verify-money.log`, log.join('\n'));
  await browser.close();
  release();
}

// «Допродано» в отчёте «По услугам»: те же записи (выгрузка записей biz_nuri с сервера) в моке и на сервере →
// CSV-выгрузка отчёта в обоих режимах → сравнение «Количество / Стоимость / Допродано, раз / Допродано, ֏».
// Сервер с новой колонкой — копия на :4031 (запросы by-service страницы подменяются туда), запись в основную базу
// заблокирована (всё, кроме GET к :4010, отвечаем заглушкой).
// Запуск: node qa/queue-1001b/upsold/compare.mjs [staffId]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const API = 'http://localhost:4010';
const NEW_API = 'http://localhost:4031';
const S = JSON.parse(fs.readFileSync('/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001/upsell/sessions.json', 'utf8'));
const cookie = S.owner.map((c) => `${c.name}=${c.value}`).join('; ');
const staffId = process.argv[2] ?? '';
const range = { from: '2026-01-01', to: '2026-12-31' };

const bookings = await (await fetch(`${API}/v1/biz/biz_nuri/bookings?from=2025-09-01&to=2027-01-31`, { headers: { cookie } })).json();
console.log('записей сервера:', bookings.length, 'со строками upsellOf:', bookings.filter((b) => b.services.some((l) => l.upsellOf)).map((b) => `${b.id} ${b.status} ${b.start}`).join(', '));

async function run(mode) {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const cookies = [{ name: 'bt_data', value: mode, domain: 'localhost', path: '/' }, { name: 'lang', value: 'ru', domain: 'localhost', path: '/' }];
    if (mode === 'api') cookies.push(...S.owner);
    await ctx.addCookies(cookies);
    await ctx.route(`${API}/**`, async (route) => {
      const req = route.request();
      if (req.method() !== 'GET' && req.method() !== 'OPTIONS') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      if (req.url().includes('/reports/by-service')) return route.fulfill({ response: await route.fetch({ url: req.url().replace(API, NEW_API) }) });
      return route.continue();
    });
    await ctx.addInitScript(([r, s]) => sessionStorage.setItem('bt_reports_period', JSON.stringify({ range: r, staffId: s })), [range, staffId]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/biz/reports/r/salesByServices`, { waitUntil: 'networkidle' });
    if (mode === 'mock') {
      // те же записи, что на сервере: подкладываем их в моковую базу (ключ ядра bookings) и перезагружаем.
      // Ждём первый сброс сида (400 мс): он чистит ключи ядра, и подложенное раньше пропало бы
      await page.waitForTimeout(2000);
      await page.evaluate((list) => localStorage.setItem('bp-mock-db:core:bookings', JSON.stringify(list)), bookings);
      await page.reload({ waitUntil: 'networkidle' });
      const n = await page.evaluate(() => JSON.parse(localStorage.getItem('bp-mock-db:core:bookings') ?? '[]').length);
      if (n !== bookings.length) throw new Error(`мок не принял записи сервера: ${n} из ${bookings.length}`);
    }
    await page.getByRole('button', { name: /CSV|Excel|Выгрузить/ }).first().waitFor();
    await page.waitForTimeout(2500);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV|Excel|Выгрузить/ }).first().click()]);
    const text = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
    fs.writeFileSync(`/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/upsold/out-${mode}${staffId ? '-' + staffId : ''}.csv`, text);
    return text;
  } finally {
    await browser.close();
    release();
  }
}

function parse(csv) {
  const lines = csv.split(/\r\n/);
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, ''));
  const rows = new Map();
  for (const l of lines.slice(1)) {
    const c = l.split(sep).map((v) => v.replace(/^"|"$/g, ''));
    rows.set(c[0], { count: +c[2], paid: +c[3], upsoldCount: +c[4], upsoldMoney: +c[5] });
  }
  return { head, rows };
}

const mock = parse(await run('mock'));
const api = parse(await run('api'));
console.log('заголовки:', mock.head.join(' | '));
let diff = 0;
for (const name of new Set([...mock.rows.keys(), ...api.rows.keys()])) {
  const a = mock.rows.get(name);
  const b = api.rows.get(name);
  const same = a && b && a.count === b.count && a.paid === b.paid && a.upsoldCount === b.upsoldCount && a.upsoldMoney === b.upsoldMoney;
  if (!same) diff++;
  if (!same || a.upsoldCount) console.log(same ? '=' : '≠', name, 'мок', JSON.stringify(a), 'сервер', JSON.stringify(b));
}
console.log(`строк: мок ${mock.rows.size}, сервер ${api.rows.size}; расхождений: ${diff}`);

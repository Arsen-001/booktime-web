// Фильтр «Должности», «Визиты», роли, пусто/ошибка, телефон.
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
  const mk = async (vp) => { const ctx = await browser.newContext({ viewport: vp, ...(vp.width < 500 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) }); const p = await ctx.newPage(); p.on('pageerror', (e) => say('PAGEERR', e.message)); return p; };
  const open = async (page, path, q, wait = 2500) => {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(wait);
    for (let i = 0; i < 30; i++) { if (!(await page.locator('[aria-busy="true"], .animate-pulse').count())) break; await page.waitForTimeout(500); }
  };
  const Q = (demo, extra = '') => `demo=${demo}&lang=ru&sphere=nails&theme=light${extra}`;

  // 1. Фильтр «Должности»
  const page = await mk({ width: 1440, height: 900 });
  await open(page, '/biz/reports', Q('owner'));
  const base = await page.innerText('main');
  say('all', { products: tile(base, 'Товары'), services: tile(base, 'Услуги'), avg: tile(base, 'Средняя заполненность') });
  await page.getByRole('button', { name: /^Фильтры/ }).click();
  await page.waitForTimeout(800);
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').first().click();
  await page.waitForTimeout(500);
  const opts = await page.getByRole('option').allInnerTexts();
  say('positions', opts);
  await page.keyboard.press('Escape');
  for (const pos of opts.filter((o) => o.trim() && o.trim() !== 'Все')) {
    if (!(await dlg.count())) { await page.getByRole('button', { name: /^Фильтры/ }).click(); await page.waitForTimeout(600); }
    await dlg.getByRole('combobox').first().click();
    await page.waitForTimeout(400);
    await page.getByRole('option', { name: pos.trim(), exact: true }).click();
    await page.waitForTimeout(300);
    await dlg.getByRole('button', { name: 'Применить' }).click();
    await page.waitForTimeout(3000);
    const txt = await page.innerText('main');
    say('pos', pos.trim(), { products: tile(txt, 'Товары'), services: tile(txt, 'Услуги'), occ: /Средняя заполненность\n+([\d.,]+ ?%)/.exec(txt)?.[1] });
  }
  await page.screenshot({ path: `${OUT}/dashboard-position-filter.png` });

  // 2. Визиты: предстоящие — есть ли отменённые
  await open(page, '/biz/reports/visits', Q('owner'));
  const vis = await page.innerText('main');
  fs.writeFileSync(`${OUT}/visits.txt`, vis);
  await page.screenshot({ path: `${OUT}/visits-desktop.png` });
  say('visits head', vis.slice(0, 300).replace(/\n/g, ' | '));

  // 3. Роли
  for (const demo of ['admin', 'master', 'individual', 'network']) {
    await open(page, '/biz/reports', Q(demo));
    const t = await page.innerText('main').catch(() => '');
    await page.screenshot({ path: `${OUT}/role-${demo}.png` });
    say('role', demo, t.slice(0, 250).replace(/\n/g, ' | '));
  }
  // 4. Пусто / ошибка / медленно
  await open(page, '/biz/reports', 'demo=owner&empty=1&lang=ru&sphere=nails');
  await page.screenshot({ path: `${OUT}/empty-dashboard.png` });
  say('empty', (await page.innerText('main')).slice(0, 250).replace(/\n/g, ' | '));
  for (const slug of ['salesByStaff', 'finance', 'cashDay', 'appointments']) {
    await open(page, `/biz/reports/r/${slug}`, 'demo=owner&empty=1&lang=ru&sphere=nails');
    say('empty', slug, (await page.innerText('main')).slice(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: `${OUT}/empty-${slug}.png` });
  }
  await open(page, '/biz/reports', Q('owner', '&api=error'), 4000);
  await page.screenshot({ path: `${OUT}/error-dashboard.png` });
  say('error', (await page.innerText('main')).slice(0, 250).replace(/\n/g, ' | '));
  // 5. Телефон, ru+en
  const phone = await mk({ width: 390, height: 844 });
  for (const [path, name] of [['/biz/reports', 'dashboard'], ['/biz/reports/all', 'all'], ['/biz/reports/r/salesByStaff', 'salesByStaff'], ['/biz/reports/r/cashDay', 'cashDay'], ['/biz/reports/r/finance', 'finance'], ['/biz/reports/visits', 'visits']]) {
    await open(phone, path, Q('owner'));
    await phone.screenshot({ path: `${OUT}/phone-${name}.png` });
    const over = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    say('phone', name, 'overflowX', over);
  }
  await open(phone, '/biz/reports', 'demo=owner&lang=en&sphere=nails');
  await phone.screenshot({ path: `${OUT}/phone-dashboard-en.png` });
} finally {
  fs.writeFileSync(`${OUT}/checks2.log`, log.join('\n'));
  await browser.close();
  release();
}

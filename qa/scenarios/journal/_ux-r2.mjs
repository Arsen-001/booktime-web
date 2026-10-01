// Дизайн-ревью journal, заход ux-r2: окно записи b02 + перепроверка ux-r1 (телефон + десктоп, ru).
// node qa/scenarios/journal/_ux-r2.mjs   → qa/shots/journal-ux-r2/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-ux-r2';
fs.mkdirSync(OUT, { recursive: true });
const log = [];

const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch();

async function open(device, { persona = 'owner', query = '', theme = 'light', path = '/biz/journal' } = {}) {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  const url = `${BASE}${path}?demo=${persona}&sphere=nails&lang=ru&theme=${theme}${query ? '&' + query : ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(800);
  return { ctx, page };
}

async function shot(name, page) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function step(name, page, fn) {
  try {
    await fn();
    await shot(name, page);
    log.push(`ok   ${name}`);
  } catch (e) {
    log.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/${name}__fail.png` }).catch(() => {});
  }
}

// прокрутка тела шторки: снимки по экранам
async function sheetPages(prefix, page, max = 6) {
  const info = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const els = [...dlg.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4;
    });
    const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el) return { h: 0, c: 0 };
    el.setAttribute('data-ux-scroll', '1');
    return { h: el.scrollHeight, c: el.clientHeight };
  });
  log.push(`     ${prefix}: sheet scroll ${JSON.stringify(info)}`);
  if (!info || !info.h) {
    await shot(`${prefix}-1`, page);
    return;
  }
  const n = Math.min(max, Math.ceil(info.h / (info.c * 0.9)));
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => {
      const el = document.querySelector('[data-ux-scroll]');
      if (el) el.scrollTop = y;
    }, Math.round(i * info.c * 0.9));
    await shot(`${prefix}-${i + 1}`, page);
  }
  await page.evaluate(() => {
    const el = document.querySelector('[data-ux-scroll]');
    if (el) el.scrollTop = 0;
  });
}

const header = (page) => page.locator('p.text-lg.font-semibold').first().textContent().catch(() => '?');
const closeSheet = async (page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};

// ───────── Десктоп, владелец: окно записи ─────────
{
  const { ctx, page } = await open('desktop');
  // даты (перепроверка M1)
  const before = await header(page);
  await page.getByRole('button', { name: 'Следующий день' }).click().catch(() => {});
  await page.waitForTimeout(500);
  const after = await header(page);
  await page.getByRole('button', { name: 'Сегодня' }).click().catch(() => {});
  await page.waitForTimeout(500);
  log.push(`     dates: before="${before}" next="${after}" today="${await header(page)}"`);

  await step('d01-new-window', page, () => page.getByRole('button', { name: 'Новая запись' }).click());
  await sheetPages('d01-new-window-scroll', page);
  await step('d02-save-empty', page, () => page.getByRole('button', { name: /Сохранить пустую|Создавать|Сохранить/ }).last().click());
  await page.waitForTimeout(700);
  await shot('d02b-after-save-empty', page);
  await closeSheet(page);
  await closeSheet(page);

  // полный путь: клиент по телефону → услуга из частых → сохранить
  await step('d03-new-phone-typed', page, async () => {
    await page.getByRole('button', { name: 'Новая запись' }).click();
    await page.waitForTimeout(600);
    const tel = page.locator('[role="dialog"] input[type="tel"]').first();
    await tel.scrollIntoViewIfNeeded();
    await tel.fill('00 17');
    await page.waitForTimeout(800);
  });
  await step('d04-client-picked', page, async () => {
    const sug = page.locator('[role="dialog"]').getByRole('button').filter({ hasText: /\+374/ }).first();
    await sug.click({ timeout: 3000 });
  });
  await step('d05-service-picked', page, async () => {
    const chip = page.locator('[role="dialog"] [data-f*="F-01-056"] button').first();
    await chip.scrollIntoViewIfNeeded();
    await chip.click({ timeout: 3000 });
  });
  await sheetPages('d05b-filled-scroll', page, 5);
  await step('d06-saved', page, () => page.locator('[role="dialog"]').getByRole('button', { name: /Создавать|Создать|Сохранить/ }).last().click());
  await page.waitForTimeout(900);
  await shot('d06b-after-save', page);
  await closeSheet(page);

  // открытая запись
  await step('d07-booking-open', page, () => page.getByTestId('booking-block').first().click());
  await sheetPages('d07b-booking-open-scroll', page, 5);
  await step('d08-expanded-tile', page, async () => {
    const b = page.locator('[role="dialog"]').getByRole('button', { name: /Расширенные поля/ }).first();
    await b.scrollIntoViewIfNeeded();
    await b.click({ timeout: 3000 });
  });
  await closeSheet(page);
  await step('d09-goods-tab', page, async () => {
    await page.getByRole('button', { name: 'Новая запись' }).click();
    await page.waitForTimeout(600);
    const tab = page.locator('[role="dialog"]').getByRole('tab', { name: 'Товары' }).first();
    await tab.scrollIntoViewIfNeeded();
    await tab.click({ timeout: 3000 });
  });
  await step('d09b-tab-client-ext', page, async () => {
    const tab = page.locator('[role="dialog"]').getByRole('tab').nth(1);
    await tab.click({ timeout: 3000 });
  });
  await closeSheet(page);
  // черновик: открыть, ввести имя, закрыть, открыть снова
  await step('d10-hover-card', page, () => page.locator('button[title="Статус и оплата"]').first().click());
  await closeSheet(page);
  await step('d11-week', page, () => page.locator('select').first().selectOption('week'));
  await ctx.close();
}

for (const [name, opts] of [
  ['d20-empty-day', { query: 'date=2026-10-04' }],
  ['d21-api-error', { query: 'api=error' }],
  ['d23-dark', { theme: 'dark' }],
  ['d24-master', { persona: 'master' }],
  ['d30-records', { path: '/biz/records' }],
]) {
  const { ctx, page } = await open('desktop', opts);
  await step(name, page, async () => {});
  await ctx.close();
}
{
  const ctx = await browser.newContext({ ...DEV.desktop, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&api=slow`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/d22-api-slow.png` });
  log.push('ok   d22-api-slow');
  await ctx.close();
}
// окно записи при api=error
{
  const { ctx, page } = await open('desktop', { query: 'api=error&new=1' });
  await shot('d21b-api-error-new', page);
  log.push('ok   d21b-api-error-new');
  await ctx.close();
}

// ───────── Телефон, владелец ─────────
{
  const { ctx, page } = await open('phone');
  await step('p01-new-sheet', page, () => page.getByRole('button', { name: 'Новая запись' }).click());
  await sheetPages('p01b-new-sheet-scroll', page, 8);
  await step('p02-phone-typed', page, async () => {
    const tel = page.locator('[role="dialog"] input[type="tel"]').first();
    await tel.scrollIntoViewIfNeeded();
    await tel.fill('00 17');
    await page.waitForTimeout(800);
  });
  await closeSheet(page);
  await step('p03-booking-open', page, async () => {
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    await page.getByTestId('booking-block').first().click();
  });
  await sheetPages('p03b-booking-open-scroll', page, 6);
  await closeSheet(page);
  await step('p04-status-card', page, () => page.locator('button[title="Статус и оплата"]').first().click());
  await closeSheet(page);
  await ctx.close();
}
for (const [name, opts] of [
  ['p20-empty-day', { query: 'date=2026-10-04' }],
  ['p21-api-error', { query: 'api=error' }],
  ['p24-master', { persona: 'master' }],
  ['p30-records', { path: '/biz/records' }],
]) {
  const { ctx, page } = await open('phone', opts);
  await step(name, page, async () => {});
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/ux-r2-log.txt`, log.join('\n'));
console.log(log.join('\n'));

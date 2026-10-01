// Дизайн-ревью journal, заход ux-r5: журнал + окно записи + /biz/records (телефон + десктоп, ru).
// node qa/scenarios/journal/_ux-r5.mjs   → qa/shots/journal-ux-r5/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-ux-r5';
fs.mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/ux-r5-log.txt`;
fs.writeFileSync(LOG, '');
const log = { push: (s) => { fs.appendFileSync(LOG, s + '\n'); console.log(s); } };

const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch();

async function open(device, { persona = 'owner', query = '', theme = 'light', path = '/biz/journal', wait = 700 } = {}) {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const url = `${BASE}${path}?demo=${persona}&sphere=nails&lang=ru&theme=${theme}${query ? '&' + query : ''}`;
  await page.goto(url, { waitUntil: wait ? 'load' : 'commit', timeout: 90000 });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' }).catch(() => {});
  if (wait) {
    const t0 = Date.now();
    await page
      .waitForFunction(() => document.querySelector('h1') && !document.querySelector('[data-skeleton]'), null, { timeout: 60000 })
      .catch(() => {});
    log.push(`     load ${path}?${query} ${device}/${persona}: ${Date.now() - t0} ms`);
    await page.waitForTimeout(wait);
  }
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

async function sheetPages(prefix, page, max = 6) {
  const info = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    if (!dlg) return null;
    const els = [...dlg.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4;
    });
    const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el) return { h: 0, c: 0 };
    document.querySelectorAll('[data-ux-scroll]').forEach((x) => x.removeAttribute('data-ux-scroll'));
    el.setAttribute('data-ux-scroll', '1');
    return { h: el.scrollHeight, c: el.clientHeight, w: dlg.getBoundingClientRect().width };
  });
  log.push(`     ${prefix}: sheet ${JSON.stringify(info)}`);
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

const dayTitle = (page) =>
  page.evaluate(() => {
    const h = [...document.querySelectorAll('h2,p,span,div')].find((e) =>
      /^(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье),/.test(e.textContent?.trim() ?? '') && e.children.length === 0,
    );
    return h?.textContent?.trim() ?? '?';
  });
const closeSheet = async (page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};

// ───────── Десктоп, владелец ─────────
{
  const { ctx, page } = await open('desktop');
  const before = await dayTitle(page);
  await page.getByRole('button', { name: 'Следующий день' }).click().catch(() => {});
  await page.waitForTimeout(500);
  const n1 = await dayTitle(page);
  await page.getByRole('button', { name: 'Следующий день' }).click().catch(() => {});
  await page.waitForTimeout(500);
  const n2 = await dayTitle(page);
  await page.getByRole('button', { name: 'Сегодня' }).click().catch(() => {});
  await page.waitForTimeout(500);
  log.push(`     dates: before="${before}" next="${n1}" next2="${n2}" today="${await dayTitle(page)}"`);
  await shot('d00-after-today', page);

  await step('d01-new-window', page, () => page.getByRole('button', { name: 'Новая запись' }).first().click());
  await sheetPages('d01b-new-scroll', page);
  await step('d02-save-empty', page, () =>
    page.locator('[role="dialog"]').getByRole('button', { name: /Записать|Сохранить/ }).last().click(),
  );
  await page.waitForTimeout(700);
  await shot('d02b-after-save-empty', page);
  await closeSheet(page);
  await closeSheet(page);

  await step('d03-phone-typed', page, async () => {
    await page.getByRole('button', { name: 'Новая запись' }).first().click();
    await page.waitForTimeout(700);
    const tel = page.locator('[role="dialog"] input[type="tel"]').first();
    await tel.scrollIntoViewIfNeeded();
    await tel.fill('700');
    await page.waitForTimeout(900);
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
  await step('d06-saved', page, () => page.locator('[role="dialog"]').getByRole('button', { name: /^Записать$|Сохранить/ }).last().click());
  await page.waitForTimeout(300);
  await shot('d06b-after-save', page);
  await closeSheet(page);

  await step('d07-booking-open', page, () => page.getByTestId('booking-block').first().click());
  await sheetPages('d07b-open-scroll', page, 6);
  await step('d08-recurrence', page, async () => {
    const b = page.locator('[role="dialog"]').getByRole('button', { name: /Повтор/ }).first();
    await b.scrollIntoViewIfNeeded();
    await b.click({ timeout: 3000 });
  });
  await closeSheet(page);
  await closeSheet(page);

  await step('d09-status-card', page, () => page.locator('[data-testid="booking-block"] + button, [data-testid="booking-block"] ~ button').first().click());
  await closeSheet(page);
  await step('d10-status-filter', page, () => page.getByRole('button', { name: 'Статусы' }).first().click());
  await closeSheet(page);
  await step('d11-view-select', page, () => page.getByRole('combobox').first().click().catch(() => page.getByRole('button', { name: /^День/ }).first().click()));
  await step('d12-week', page, () => page.getByRole('option', { name: 'Неделя' }).first().click());
  await ctx.close();
}

for (const [name, opts] of [
  ['d20-empty-day', { query: 'date=2026-10-04' }],
  ['d21-api-error', { query: 'api=error' }],
  ['d23-dark', { theme: 'dark' }],
  ['d24-master', { persona: 'master' }],
  ['d25-individual', { persona: 'individual' }],
  ['d26-admin', { persona: 'admin' }],
  ['d30-records', { path: '/biz/records' }],
  ['d31-records-error', { path: '/biz/records', query: 'api=error' }],
  ['d32-records-master', { path: '/biz/records', persona: 'master' }],
  ['d33-records-dark', { path: '/biz/records', theme: 'dark' }],
]) {
  const { ctx, page } = await open('desktop', opts);
  await step(name, page, async () => {});
  await ctx.close();
}
for (const [name, path] of [
  ['d22-api-slow', '/biz/journal'],
  ['d34-records-slow', '/biz/records'],
]) {
  const { ctx, page } = await open('desktop', { path, query: 'api=slow', wait: 0 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push(`ok   ${name}`);
  await ctx.close();
}
{
  const { ctx, page } = await open('desktop', { path: '/biz/records' });
  await step('d35-records-cancelled', page, () => page.getByRole('tab', { name: 'Отменённые' }).first().click());
  await step('d36-records-row-click', page, () => page.locator('tbody tr').first().click());
  await ctx.close();
}

// ───────── Телефон, владелец ─────────
{
  const { ctx, page } = await open('phone');
  await step('p01-calendar-sheet', page, () => page.getByRole('button', { name: /календар|Календар|Выберите/i }).first().click());
  await closeSheet(page);
  await step('p02-new-sheet', page, () => page.getByRole('button', { name: 'Новая запись' }).first().click());
  await sheetPages('p02b-new-scroll', page, 8);
  await closeSheet(page);
  await step('p03-grid-scrolled', page, async () => {
    await page.evaluate(() => window.scrollTo(0, 700));
  });
  await step('p04-booking-open', page, () => page.getByTestId('booking-block').first().click());
  await sheetPages('p04b-open-scroll', page, 6);
  await closeSheet(page);
  await step('p05-status-card', page, () => page.locator('[data-testid="booking-block"] ~ button').first().click());
  await closeSheet(page);
  await ctx.close();
}
for (const [name, opts] of [
  ['p20-empty-day', { query: 'date=2026-10-04' }],
  ['p21-api-error', { query: 'api=error' }],
  ['p24-master', { persona: 'master' }],
  ['p30-records', { path: '/biz/records' }],
  ['p31-records-error', { path: '/biz/records', query: 'api=error' }],
]) {
  const { ctx, page } = await open('phone', opts);
  await step(name, page, async () => {});
  await ctx.close();
}
{
  const { ctx, page } = await open('phone', { path: '/biz/records' });
  await step('p32-records-cancelled', page, () => page.getByRole('tab', { name: 'Отменённые' }).first().click());
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  log.push(`     records phone page height: ${h}`);
  await step('p33-records-card-tap', page, () => page.locator('main li, main [role="row"], main article').first().click({ timeout: 3000 }));
  await ctx.close();
}

await browser.close();

console.log('done');

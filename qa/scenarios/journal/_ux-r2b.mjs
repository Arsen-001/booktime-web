// Дизайн-ревью journal, ux-r2 (добор): открытая запись, поиск клиента, черновик, телефон — создание целиком.
// node qa/scenarios/journal/_ux-r2b.mjs   → qa/shots/journal-ux-r2/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-ux-r2';
const log = [];
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const browser = await chromium.launch();

async function open(device, { persona = 'owner', query = '' } = {}) {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  page.on('crash', () => log.push('!!! page crash'));
  page.on('close', () => log.push('!!! page closed'));
  page.on('pageerror', (e) => log.push('!!! pageerror ' + String(e).slice(0, 200)));
  await page.goto(`${BASE}/biz/journal?demo=${persona}&sphere=nails&lang=ru${query ? '&' + query : ''}`, { waitUntil: 'networkidle' });
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
async function sheetPages(prefix, page, max = 6) {
  try { await sheetPagesInner(prefix, page, max); } catch (e) { log.push(`FAIL ${prefix}: ${String(e).split('\n')[0]}`); }
}
async function sheetPagesInner(prefix, page, max) {
  const info = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    if (!dlg) return null;
    const el = [...dlg.querySelectorAll('*')]
      .filter((e) => {
        const s = getComputedStyle(e);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4;
      })
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el) return { h: 0, c: 0 };
    document.querySelectorAll('[data-ux-scroll]').forEach((x) => x.removeAttribute('data-ux-scroll'));
    el.setAttribute('data-ux-scroll', '1');
    return { h: el.scrollHeight, c: el.clientHeight };
  });
  log.push(`     ${prefix}: sheet scroll ${JSON.stringify(info)}`);
  if (!info || !info.h) return shot(`${prefix}-1`, page);
  const n = Math.min(max, Math.ceil(info.h / (info.c * 0.9)));
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => {
      const el = document.querySelector('[data-ux-scroll]');
      if (el) el.scrollTop = y;
    }, Math.round(i * info.c * 0.9));
    await shot(`${prefix}-${i + 1}`, page);
  }
}

// Десктоп: открытая запись
{
  const { ctx, page } = await open('desktop');
  await step('e01-booking-open', page, () => page.getByTestId('booking-block').first().click());
  await sheetPages('e01b-booking-open-scroll', page, 5);
  await step('e02-edit-expanded', page, async () => {
    const b = page.locator('[role="dialog"]').getByRole('button', { name: /Изменить/ }).first();
    await b.click({ timeout: 3000 });
  });
  await ctx.close();
}
{
  const { ctx, page } = await open('desktop');
  // поиск клиента: печатаем по одной цифре последние цифры
  await step('e03-search-last-digits', page, async () => {
    await page.getByRole('button', { name: 'Новая запись' }).click();
    await page.waitForTimeout(600);
    const tel = page.locator('[role="dialog"] input[type="tel"]').first();
    await tel.scrollIntoViewIfNeeded();
    await tel.click();
    await page.keyboard.type('700', { delay: 120 });
    await page.waitForTimeout(1600);
  });
  await step('e04-search-by-name', page, async () => {
    const tel = page.locator('[role="dialog"] input[type="tel"]').first();
    await tel.fill('');
    const name = page.locator('[role="dialog"]').getByPlaceholder('Имя');
    await name.click();
    await page.keyboard.type('Мил', { delay: 120 });
    await page.waitForTimeout(1600);
  });
  await step('e05-client-picked', page, async () => {
    const sug = page.locator('[role="dialog"] button').filter({ hasText: /\+374/ }).first();
    await sug.click({ timeout: 3000 });
    await page.waitForTimeout(800);
  });
  await sheetPages('e05b-client-picked-scroll', page, 4);
  // черновик: закрыть и открыть снова
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await shot('e06-closed-with-draft', page);
  await step('e07-reopen-draft', page, async () => {
    await page.getByRole('button', { name: 'Новая запись' }).click();
    await page.waitForTimeout(1200);
  });
  // сохранить с клиентом без услуги — что с кнопкой и тостом
  await step('e08-save-with-client', page, async () => {
    await page.locator('[role="dialog"]').getByRole('button', { name: /Создавать|Создать|Сохранить/ }).last().click();
    await page.waitForTimeout(250);
  });
  await page.waitForTimeout(1500);
  await shot('e08b-after-save', page);
  // время вне графика
  await step('e09-outside-hours', page, async () => {
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&new=1&time=07:00`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('[role="dialog"]').getByRole('button', { name: /пустую|Создавать|Создать|Сохранить/ }).last().click();
    await page.waitForTimeout(1500);
  });
  await ctx.close();
}

// Телефон: создание целиком, по шагам
{
  const { ctx, page } = await open('phone');
  await step('q01-new', page, () => page.getByRole('button', { name: 'Новая запись' }).click());
  await step('q02-name-typed', page, async () => {
    const name = page.locator('[role="dialog"]').getByPlaceholder('Имя');
    await name.scrollIntoViewIfNeeded();
    await name.click();
    await page.keyboard.type('Мил', { delay: 120 });
    await page.waitForTimeout(1600);
  });
  await step('q03-picked', page, async () => {
    await page.locator('[role="dialog"] button').filter({ hasText: /\+374/ }).first().click({ timeout: 3000 });
  });
  await step('q04-service', page, async () => {
    const chip = page.locator('[role="dialog"] [data-f*="F-01-056"] button').first();
    await chip.scrollIntoViewIfNeeded();
    await chip.click({ timeout: 3000 });
  });
  await sheetPages('q04b-filled-scroll', page, 8);
  await step('q05-saved', page, async () => {
    await page.locator('[role="dialog"]').getByRole('button', { name: /Создавать|Создать|Сохранить/ }).last().click();
    await page.waitForTimeout(300);
  });
  await page.waitForTimeout(1500);
  await shot('q05b-after-save', page);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/ux-r2b-log.txt`, log.join('\n'));
console.log(log.join('\n'));

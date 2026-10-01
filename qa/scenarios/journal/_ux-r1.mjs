// Дизайн-ревью journal, заход ux-r1: снимки главных сценариев (телефон + десктоп, ru).
// node qa/scenarios/journal/_ux-r1.mjs   → qa/shots/journal-ux-r1/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-ux-r1';
fs.mkdirSync(OUT, { recursive: true });
const log = [];

const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch();

async function open(device, { persona = 'owner', query = '', theme = 'light' } = {}) {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  const url = `${BASE}/biz/journal?demo=${persona}&sphere=nails&lang=ru&theme=${theme}${query ? '&' + query : ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(700);
  return { ctx, page };
}

async function step(name, page, fn, { full = false } = {}) {
  try {
    await fn();
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    log.push(`ok   ${name}`);
  } catch (e) {
    log.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/${name}__fail.png` }).catch(() => {});
  }
}

const header = (page) => page.locator('p.text-lg.font-semibold').first().textContent().catch(() => '?');

// ───────── Десктоп, владелец ─────────
{
  const { ctx, page } = await open('desktop');
  await step('d02-new-button', page, () => page.getByRole('button', { name: 'Новая запись' }).click());
  await step('d02b-new-save-empty', page, () => page.getByRole('button', { name: 'Сохранить' }).click());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await step('d03-cell-click', page, async () => {
    const col = page.locator('[data-f="F-01-024"]').nth(0);
    const box = await col.boundingBox();
    await page.mouse.click(box.x + 60, box.y + 700 > 880 ? 880 : box.y + 420);
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await step('d04-booking-open', page, () => page.getByTestId('booking-block').first().click());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await step('d05-status-card', page, () => page.locator('button[title="Статус и оплата"]').first().click());
  await page.keyboard.press('Escape');
  await step('d06-status-filter', page, () => page.getByRole('button', { name: 'Статусы' }).click());
  await page.keyboard.press('Escape');
  const before = await header(page);
  await step('d07-next-day', page, () => page.getByRole('button', { name: 'Следующий день' }).click());
  const after = await header(page);
  log.push(`     date header: before="${before}" after next="${after}"`);
  await step('d07b-next-day-2', page, () => page.getByRole('button', { name: 'Следующий день' }).click());
  log.push(`     after 2x next="${await header(page)}"`);
  await step('d07c-today', page, () => page.getByRole('button', { name: 'Сегодня' }).click());
  log.push(`     after today="${await header(page)}"`);
  await step('d08-week', page, () => page.locator('select').first().selectOption('week'));
  await step('d09-resources', page, async () => {
    await page.locator('select').first().selectOption('day');
    await page.waitForTimeout(300);
    await page.locator('select').nth(1).selectOption('resource');
  });
  await step('d10-markup-menu', page, async () => {
    await page.locator('select').nth(1).selectOption('staff');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Разметка/ }).first().click();
  });
  await page.keyboard.press('Escape');
  await step('d11-break-menu', page, () => page.locator('button[data-f="F-01-032"]').first().click());
  await page.keyboard.press('Escape');
  await step('d12-sidebar-collapsed', page, () => page.getByRole('button', { name: 'Свернуть панель' }).click());
  // создание записи целиком: номер и имя → сохранить → тост
  await step('d13-create-filled', page, async () => {
    await page.getByRole('button', { name: 'Новая запись' }).click();
    await page.waitForTimeout(400);
    await page.locator('input[type="tel"]').first().fill('91234567');
    await page.getByPlaceholder('Имя').fill('Лилит Акопян');
  });
  await step('d14-create-saved', page, () => page.getByRole('button', { name: 'Сохранить' }).click());
  await page.waitForTimeout(800);
  await step('d14b-after-save', page, async () => {});
  await ctx.close();
}

// пустой день, ошибка, загрузка, тёмная, мастер
for (const [name, opts, wait] of [
  ['d20-empty-day', { query: 'date=2026-10-04' }],
  ['d21-api-error', { query: 'api=error' }],
  ['d23-dark', { theme: 'dark' }],
  ['d24-master', { persona: 'master' }],
  ['d25-individual', { persona: 'individual' }],
  ['d26-admin', { persona: 'admin' }],
]) {
  const { ctx, page } = await open('desktop', opts);
  await step(name, page, async () => {}, {});
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

// ───────── Телефон, владелец ─────────
{
  const { ctx, page } = await open('phone');
  await step('p02-calendar-sheet', page, () => page.getByRole('button', { name: 'Календарь и быстрые действия' }).click());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await step('p03-new-sheet', page, () => page.getByRole('button', { name: 'Новая запись' }).click());
  await step('p03b-new-sheet-full', page, async () => {}, { full: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await step('p04-scrolled-to-grid', page, () => page.evaluate(() => window.scrollTo(0, 800)));
  await step('p05-booking-open', page, () => page.getByTestId('booking-block').first().click());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await step('p06-status-card', page, () => page.locator('button[title="Статус и оплата"]').first().click());
  await page.keyboard.press('Escape');
  await step('p07-grid-scrolled-right', page, async () => {
    await page.evaluate(() => {
      const g = document.querySelector('[data-f^="F-01-018 F-01-019"]');
      if (g) { g.scrollLeft = 420; g.scrollTop = 300; }
      window.scrollTo(0, 700);
    });
  });
  await step('p08-week', page, async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('select').first().selectOption('week');
  }, { full: true });
  await ctx.close();
}
for (const [name, opts] of [
  ['p20-empty-day', { query: 'date=2026-10-04' }],
  ['p21-api-error', { query: 'api=error' }],
  ['p24-master', { persona: 'master' }],
  ['p25-individual', { persona: 'individual' }],
  ['p23-dark', { theme: 'dark' }],
]) {
  const { ctx, page } = await open('phone', opts);
  await step(name, page, async () => {}, { full: true });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/ux-r1-log.txt`, log.join('\n'));
console.log(log.join('\n'));

// Дизайн-ревью journal ux-r1, добор: телефон (открыть запись, закрыть), клик по ячейке, конфликт, день без графика.
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-ux-r1';
const log = [];
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const browser = await chromium.launch();
async function open(device, query = '') {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light${query ? '&' + query : ''}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = async (page, name, full = false) => {
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    log.push(`ok   ${name}  url=${page.url().replace(BASE, '')}`);
  } catch (e) { log.push(`SHOTFAIL ${name}: ${String(e).split('\n')[0]}`); }
};

// Телефон: открыть запись тапом, закрыть крестиком, поймать мигание
{
  const { ctx, page } = await open('phone');
  try {
    const block = page.getByTestId('booking-block').first();
    await block.scrollIntoViewIfNeeded();
    await block.tap();
    await page.waitForTimeout(600);
    await shot(page, 'p05-booking-open');
    await page.getByRole('button', { name: /Закрыть/ }).first().tap();
    await page.waitForTimeout(120);
    await shot(page, 'p05b-after-close-120ms');
    await page.waitForTimeout(900);
    await shot(page, 'p05c-after-close-1s');
    const grid = await page.evaluate(() => {
      const g = document.querySelector('[data-f^="F-01-018 F-01-019"]');
      const r = g?.getBoundingClientRect();
      return g ? { top: Math.round(r.top + scrollY), h: Math.round(r.height), inner: g.scrollHeight, doc: document.documentElement.scrollHeight } : null;
    });
    log.push(`     phone grid box: ${JSON.stringify(grid)}`);
  } catch (e) {
    log.push(`FAIL phone open: ${String(e).split('\n')[0]}`);
    await shot(page, 'p05-fail');
  }
  await ctx.close();
}

// Десктоп: клик по свободной ячейке у Ани в 16:00, затем конфликт
{
  const { ctx, page } = await open('desktop');
  try {
    const grid = page.locator('[data-f^="F-01-018 F-01-019"]');
    await grid.evaluate((g) => (g.scrollTop = 400));
    await page.waitForTimeout(300);
    const col = page.locator('[data-f="F-01-024"]').nth(0);
    const cb = await col.boundingBox();
    const gb = await grid.boundingBox();
    await page.mouse.click(cb.x + 30, gb.y + gb.height - 60);
    await page.waitForTimeout(700);
    await shot(page, 'd03-cell-click');
    log.push(`     url after cell: ${page.url().replace(BASE, '')}`);
    // выбрать время, пересекающееся с 10:45 у Ани
    await page.locator('select').first().selectOption({ index: 0 });
  } catch (e) {
    log.push(`FAIL cell: ${String(e).split('\n')[0]}`);
    await shot(page, 'd03-fail');
  }
  await ctx.close();
}

// Конфликт по адресу окна
{
  const { ctx, page } = await open('desktop', 'new=1&start=11:00&date=2026-09-25');
  try {
    await page.waitForTimeout(500);
    await shot(page, 'd15-new-by-url-11');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForTimeout(900);
    await shot(page, 'd15b-overlap-toast');
  } catch (e) {
    log.push(`FAIL overlap: ${String(e).split('\n')[0]}`);
  }
  await ctx.close();
}

// Вне графика
{
  const { ctx, page } = await open('desktop', 'new=1&start=21:30&date=2026-09-25');
  try {
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForTimeout(900);
    await shot(page, 'd16-outside-hours-confirm');
  } catch (e) {
    log.push(`FAIL outside: ${String(e).split('\n')[0]}`);
  }
  await ctx.close();
}

// Ищем день без графика: перебор дат октября
{
  const { ctx, page } = await open('desktop');
  for (const d of ['2026-10-03', '2026-10-11', '2026-10-14', '2026-10-17', '2026-10-18', '2026-10-25', '2026-11-01']) {
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=${d}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const empty = await page.locator('[data-f="F-01-018"]').filter({ hasText: 'Расписание' }).count();
    log.push(`     ${d}: empty-state=${empty}`);
    if (empty) {
      await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
      await shot(page, 'd20b-no-schedule');
      const ctx2 = await browser.newContext({ ...DEV.phone, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
      const p2 = await ctx2.newPage();
      await p2.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=${d}`, { waitUntil: 'networkidle' });
      await p2.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
      await p2.waitForTimeout(600);
      await shot(p2, 'p20b-no-schedule', true);
      await ctx2.close();
      break;
    }
  }
  await ctx.close();
}

await browser.close();
fs.appendFileSync(`${OUT}/ux-r1-log.txt`, '\n' + log.join('\n'));
console.log(log.join('\n'));

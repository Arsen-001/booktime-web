import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/b05-m1';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function log(name, ok, note) { results.push({ name, ok, note }); console.log(`${ok ? '✅' : ok === null ? '⚠️' : '❌'} ${name}${note ? ' — ' + note : ''}`); }

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    // F-01-192: дублирование записи
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.goto(`${BASE}/biz/journal?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const block = page.locator('[class*="cursor-pointer"][class*="rounded"]').filter({ hasText: /./ }).first();
      let opened = false;
      const anyBooking = page.locator('[data-testid="booking-block"], [class*="absolute"][class*="rounded"]').first();
      // Пробуем через свойства: кликаем по первому найденному блоку записи в сетке
      const bookingEls = await page.$$('[data-testid="booking-block"]');
      if (bookingEls.length > 0) {
        await bookingEls[0].click();
        opened = true;
      }
      await page.waitForTimeout(600);
      const dupBtn = page.locator('[data-f="F-01-192"] button');
      const dupVisible = await dupBtn.isVisible().catch(() => false);
      await page.screenshot({ path: `${OUT}/f192-window.png` });
      if (dupVisible) {
        const urlBefore = page.url();
        await dupBtn.click();
        await page.waitForTimeout(1200);
        const toastOk = await page.locator('text=/копия|дубл/i').isVisible().catch(() => false);
        const urlAfter = page.url();
        const statusPressed = await page.locator('[aria-pressed="true"], button:has-text("Записан")[data-state], [class*="ring"]').allTextContents().catch(() => []);
        const arrivedSelected = await page.getByRole('button', { name: /^Пришёл$/ }).getAttribute('aria-pressed').catch(() => null);
        const scheduledSelected = await page.getByRole('button', { name: /^Записан$/ }).getAttribute('aria-pressed').catch(() => null);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/f192-duplicated.png` });
        log('F-01-192: кнопка «дублировать» открыта, есть в окне записи', true, `opened=${opened}`);
        log('F-01-192: клик создаёт копию (тост)', toastOk);
        log('F-01-192: URL сменился на новую запись (?booking=<id> копии)', urlBefore !== urlAfter, `${urlBefore} -> ${urlAfter}`);
        log('F-01-192: статус копии — «Записан», не «Пришёл» (сброс статуса по ТЗ)', scheduledSelected === 'true' && arrivedSelected !== 'true', `Записан.aria-pressed=${scheduledSelected} Пришёл.aria-pressed=${arrivedSelected}`);
      } else {
        log('F-01-192: не удалось открыть окно существующей записи, чтобы найти кнопку дублирования', null, `opened=${opened}, bookingEls=${bookingEls.length}`);
      }
      log('F-01-192: без ошибок страницы', errs.length === 0, errs.join('|'));
      await ctx.close();
    }
  } finally {
    await browser.close();
    release();
  }
  fs.writeFileSync(`${OUT}/results-more.json`, JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });

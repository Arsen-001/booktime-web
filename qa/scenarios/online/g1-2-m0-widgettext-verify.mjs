import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const run = async () => {
  const release = await acquireBrowserSlot();
  try {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    // Set text as owner
    await page.goto(`${BASE}/biz/online/settings?persona=owner&lang=ru`);
    await page.waitForTimeout(1200);
    await page.locator('[data-f="F-03-075"] textarea').fill('Возьмите с собой сменную обувь.');
    await page.getByRole('button', { name: 'Сохранить' }).last().click();
    await page.waitForTimeout(500);
    // Same context (same localStorage/mock data) — go through wizard as guest
    await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&lang=ru`);
    await page.waitForTimeout(1000);
    const ind = page.getByText(/Индивидуальная запись/).first();
    if (await ind.count()) { await ind.click(); await page.waitForTimeout(600); }
    for (let i=0;i<4;i++) {
      if (await page.locator('[data-f*="F-03-090"]').count()) break;
      const staffStep = page.locator('[data-f*="F-03-087"]');
      const servicesStep = page.locator('[data-f*="F-03-088"]');
      const timeStep = page.locator('[data-f*="F-03-084"]');
      if (await staffStep.count()) {
        await staffStep.locator('button').nth(1).click(); // Мариам Петросян, без ограничений
        await page.waitForTimeout(300);
      } else if (await servicesStep.count()) {
        await servicesStep.locator('input[type=checkbox]').first().click();
        await page.waitForTimeout(200);
      } else if (await timeStep.count()) {
        await timeStep.locator('button.min-h-11').first().click();
        await page.waitForTimeout(300);
      }
      const cont = page.getByRole('button', { name: /Продолжить/ }).first();
      if (await cont.count()) { await cont.click(); await page.waitForTimeout(700); }
    }
    await page.screenshot({ path: 'qa/shots/online/g1-2-m0/widgettext/verify-details.png', fullPage: true });
    const shown = await page.locator('[data-f="F-03-075"]').count();
    const text = shown ? await page.locator('[data-f="F-03-075"]').innerText() : null;
    console.log('F-03-075 shown in wizard?', shown > 0, JSON.stringify(text));
    await browser.close();
  } finally { release(); }
};
run();

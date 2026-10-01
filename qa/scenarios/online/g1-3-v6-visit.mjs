import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const buttons = page.getByText('Записаться', { exact: true });
const count = await buttons.count();
console.log('Записаться buttons count:', count);
// последняя — «Маникюр с выездом к вам»
await buttons.nth(count - 1).click({ force: true });
await page.waitForTimeout(900);
await page.screenshot({ path: 'qa/shots/online/g1-3-m0/live4/6-visit-step1.png', fullPage: true });
console.log('url:', page.url());

// шаг может пропустить выбор мастера/услуг (уже задан клик по конкретной услуге) — сразу время/место
for (let i = 0; i < 3; i++) {
  const cont = page.getByText('Продолжить', { exact: true }).first();
  if (await cont.isVisible().catch(() => false)) {
    const dis = await cont.isDisabled().catch(() => true);
    console.log(`step ${i}: continue disabled=`, dis);
    if (dis) {
      // попробовать выбрать первую доступную опцию/карточку/район
      const card = page.locator('[role="radio"], .cursor-pointer').first();
      if (await card.isVisible().catch(() => false)) await card.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await cont.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
}
await page.screenshot({ path: 'qa/shots/online/g1-3-m0/live4/7-visit-progress.png', fullPage: true });
await browser.close();
release();

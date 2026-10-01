import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
(async () => {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/biz/journal?demo=individual&sphere=fitness&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'qa/shots/journal-g3-2-m1/f193-phone-00.png', fullPage: true });
    await page.mouse.click(346, 800);
    await page.waitForTimeout(600);
    const bookingTile = page.locator('text=Обычная запись').first();
    if (await bookingTile.count()) { await bookingTile.click(); await page.waitForTimeout(800); }
    const recordTile = page.locator('text=Индивидуальная запись клиента').first();
    if (await recordTile.count()) { await recordTile.click(); await page.waitForTimeout(1000); }
    await page.screenshot({ path: 'qa/shots/journal-g3-2-m1/f193-phone.png', fullPage: true });
    await page.close();
  } finally { await browser.close(); release(); }
})();

import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const log = (...a) => console.log(...a);
async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => log('[pageerror]', e.message));
    await page.goto(`${BASE}/biz/network/settings/users?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const rows = page.locator('table tbody tr, [role="row"]');
    log('row count:', await rows.count());
    await rows.first().click();
    await page.waitForTimeout(600);
    const dialog = page.locator('[role="dialog"]');
    log('dialog visible:', await dialog.count());
    await page.screenshot({ path: 'qa/shots/network-b01-m2-checks/a2-user-card.png', fullPage: true });

    // telephony recheck with right selector
    await page.goto(`${BASE}/biz/network/telephony?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const val = await page.locator('input[readonly], input[value*="NET"]').first().inputValue().catch(() => 'NOINPUT');
    log('telephony token input value:', val);
    await page.screenshot({ path: 'qa/shots/network-b01-m2-checks/d2-telephony.png', fullPage: true });
    await ctx.close();
  } finally { await browser.close(); release(); }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });

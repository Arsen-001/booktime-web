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
    const warns = [];
    page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
    await page.goto(`${BASE}/biz/network/settings/plans?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const cell = page.locator('table input, [role="table"] input, input').first();
    await cell.click();
    await cell.fill('654321');
    await cell.blur();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/shots/network-b01-m2-checks/plans-after-fill.png', fullPage: true });
    // full navigation reload
    await page.goto(`${BASE}/biz/network/settings/plans?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const valAfter = await page.locator('input').first().inputValue();
    log('value after reload:', valAfter);
    log('quota warnings seen this run:', warns.filter(w => w.includes('QuotaExceeded')).length, 'of', warns.length, 'total warnings');
    await page.screenshot({ path: 'qa/shots/network-b01-m2-checks/plans-after-reload.png', fullPage: true });
    await ctx.close();
  } finally { await browser.close(); release(); }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });

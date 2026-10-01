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
    await page.goto(`${BASE}/biz/network/settings/plans?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    const size = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('bp-mock-db');
        return raw ? raw.length : 0;
      } catch (e) { return 'ERR:' + e.message; }
    });
    log('bp-mock-db size (chars):', size);
    const quota = await page.evaluate(async () => {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        return e;
      }
      return null;
    });
    log('storage estimate:', quota);
    await ctx.close();
  } finally { await browser.close(); release(); }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });

import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const log = (...a) => console.log(...a);
async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/biz/network/telephony?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const copyBtn = page.getByRole('button', { name: /Копир/i });
    log('copy button count:', await copyBtn.count());
    if (await copyBtn.count()) {
      await copyBtn.first().click();
      await page.waitForTimeout(600);
      const toast = await page.locator('body').innerText();
      log('toast/body mentions copy success ("Скопировано"):', toast.includes('копировано') || toast.includes('Скопировано'));
    }
    await page.screenshot({ path: 'qa/shots/network-b01-m2-checks/d3-telephony-copy.png', fullPage: true });
    await ctx.close();
  } finally { await browser.close(); release(); }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });

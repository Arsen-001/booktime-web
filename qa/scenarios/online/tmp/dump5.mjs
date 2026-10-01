import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const links = page.getByRole('link', { name: /Записаться/i });
console.log('link count', await links.count());
for (let i=0;i<await links.count();i++){
  console.log(i, await links.nth(i).getAttribute('href'));
}
await browser.close();
release();

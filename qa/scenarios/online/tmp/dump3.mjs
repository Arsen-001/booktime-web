import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const txt = page.getByText('Записаться', { exact: true });
console.log('text count', await txt.count());
for (let i=0;i<await txt.count();i++){
  const el = txt.nth(i);
  const tag = await el.evaluate(e=>e.tagName+':'+e.className+':'+ (e.closest('a')?'A':'') + (e.closest('button')?'BTN':''));
  console.log(i, tag);
}
await browser.close();
release();

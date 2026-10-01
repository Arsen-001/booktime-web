import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(String(e)));

await p.goto('http://localhost:3710/biz/loyalty/online-sales?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
await p.getByRole('tab', { name: 'Виджет' }).click();
await p.waitForTimeout(700);
const sw = p.getByRole('switch').first();
if (await sw.count()) {
  const checked = await sw.getAttribute('aria-checked');
  console.log('widget switch aria-checked before:', checked);
  if (checked !== 'true') await sw.click();
  await p.waitForTimeout(800);
}
await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/widget-enabled.png', fullPage: true });

// now go to preview
await p.goto('http://localhost:3710/biz/loyalty/online-sales/preview?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/preview2.png', fullPage: true });
const text = await p.locator('body').innerText();
console.log('preview text after enable (first 400):', text.slice(0, 400));
console.log('page errors so far:', pageErrors);
await b.close();
release();

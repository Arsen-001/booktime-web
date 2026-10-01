import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3710/biz/schedule?demo=owner&empty=0&sphere=nails&lang=ru&theme=light');
await page.waitForTimeout(1000);
await page.click('table tbody tr:nth-child(1) td:nth-child(3) button');
await page.waitForTimeout(300);
const btn = page.locator('text=Снять выбор');
const box = await btn.boundingBox();
console.log('boundingBox', box);
const styles = await btn.evaluate(el => {
  const cs = getComputedStyle(el);
  return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, width: cs.width, color: cs.color, parentClass: el.closest('div.flex')?.className, overflow: getComputedStyle(el.closest('div.flex')).overflow };
});
console.log('styles', styles);
const parentBox = await page.locator('div.flex.flex-wrap.items-center.gap-2.rounded-xl').first().boundingBox();
console.log('parentBox', parentBox);
await browser.close();

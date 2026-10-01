import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
await page.waitForTimeout(500);

const handle = page.locator('[title="Потянуть, чтобы изменить длительность"]').first();
const count = await page.locator('[title="Потянуть, чтобы изменить длительность"]').count();
console.log('resize handles found:', count);
const box = await handle.boundingBox();
console.log('handle box', box);
// find the booking block text before
const block = handle.locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-x-0.5")]').first();
const beforeTimeText = await page.locator('text=/10:45.{1,3}11:45/').count();
await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(box.x + box.width/2, box.y + box.height/2 + 90, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/06b-after-resize.png` });
const afterTimeText = await page.locator('text=/10:45.{1,3}12:15/').count();
console.log(JSON.stringify({ beforeTimeText, afterTimeText }));
await browser.close();

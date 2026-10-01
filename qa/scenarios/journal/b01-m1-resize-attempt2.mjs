import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
await page.waitForTimeout(500);

// Find the block containing "Шушан М." text, then its own resize handle child
const block = page.locator('div[data-f="F-01-026 F-01-027 F-01-214 F-01-031"]', { hasText: 'Шушан' }).first();
const blockBox = await block.boundingBox();
console.log('block box', blockBox);
const handle = block.locator('[title="Потянуть, чтобы изменить длительность"]');
const handleBox = await handle.boundingBox();
console.log('handle box', handleBox);

await page.mouse.move(handleBox.x + handleBox.width/2, handleBox.y + handleBox.height/2);
await page.mouse.down();
await page.waitForTimeout(50);
await page.mouse.move(handleBox.x + handleBox.width/2, handleBox.y + handleBox.height/2 + 60, { steps: 10 });
await page.waitForTimeout(50);
await page.screenshot({ path: `${OUT}/06c-mid-drag.png` });
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/06d-after-drag-release.png` });
const newBlockBox = await block.boundingBox();
console.log('new block box', newBlockBox);
await browser.close();

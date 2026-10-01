import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
await page.waitForTimeout(500);
// click on empty cell in Ani Sargsyan column near existing booking 10:45-11:45 to attempt overlap at 11:00
const col = page.locator('[data-f="F-01-024"]').first();
const box = await col.boundingBox();
// 11:00 label around y=612 per earlier screenshot; click slightly below top within busy zone e.g. y=605
await page.mouse.click(box.x + 20, 605);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/17-overlap-attempt-window.png` });
const saveBtn = page.getByRole('button', { name: 'Сохранить' });
await saveBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/18-overlap-attempt-result.png` });
await browser.close();

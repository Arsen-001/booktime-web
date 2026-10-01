import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
await page.waitForTimeout(500);
// first round button near top (calendar icon)
const btn = page.locator('button').first();
const box = await btn.boundingBox();
console.log('first btn box', box);
await btn.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/13-mobile-hamburger-or-sheet.png` });

// now find calendar-icon button specifically (2nd or by svg calendar) - close menu first
await page.keyboard.press('Escape').catch(()=>{});
await page.waitForTimeout(200);
const buttons = await page.locator('button').all();
console.log('total buttons', buttons.length);
for (let i = 0; i < Math.min(buttons.length, 6); i++) {
  const box = await buttons[i].boundingBox();
  const txt = await buttons[i].innerText().catch(()=> '');
  console.log(i, box, JSON.stringify(txt.slice(0,20)));
}
await browser.close();

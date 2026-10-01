import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';
const browser = await chromium.launch();

// master persona - should see only own column
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=master&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/14-master-view.png` });
  await ctx.close();
}
// client persona - should not see /biz/journal
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=client&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/15-client-gate.png` });
  await ctx.close();
}
// en language raw key check on journal + status labels
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=en`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Statuses|Status/i }).click().catch(()=>{});
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/16-en-statuses.png` });
  await ctx.close();
}
await browser.close();

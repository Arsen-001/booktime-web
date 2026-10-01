// Снимки экранов с изменёнными цветами: node shots.mjs before|after
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const tag = process.argv[2];
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/final-api/tokens';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${B}/bookings?data=mock&demo=client&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${tag}-client-bookings.png`, fullPage: true });
  await page.goto(`${B}/biz/apps/services?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /пакет/i }).first().click();
  await page.waitForTimeout(1200);
  const boxes = page.locator('[role=dialog] input[type=checkbox]');
  if (await boxes.count()) await boxes.first().check();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${tag}-services-package.png` });
  // Чек печати: та же разметка стиля в отдельном документе
  const border = tag === 'before' ? '#eee' : 'color-mix(in srgb,currentColor 7%,transparent)';
  await page.setContent(`<style>body{font-family:sans-serif;max-width:420px;margin:24px auto;padding:16px}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px solid ${border}}</style><table><tr><td>Маникюр</td><td>8 000</td></tr><tr><td>Покрытие</td><td>4 000</td></tr></table>`);
  await page.screenshot({ path: `${OUT}/${tag}-receipt.png` });
  await ctx.close();
} finally { await browser.close(); release(); }

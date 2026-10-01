import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-g3-1-m1/probe';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=network&sphere=hair&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const names = async () => (await page.locator('header, [class*="grid"] >> text=/./').allTextContents()).join('|');
  const staffNames = async () => {
    const els = await page.locator('div:has(> img), div').filter({ hasText: /Азарян|Егиазарян|Ованнисян|Мартиросян|Сафарян|Минасян/ }).allTextContents();
    return els;
  };
  console.log('DEFAULT staff mentions:', JSON.stringify(await staffNames()));
  await page.screenshot({ path: `${OUT}/08-default-all-locations.png`, fullPage: false });

  const select = page.locator('button:has-text("Все филиалы"), button:has-text("Filials"), button').filter({ hasText: /филиал|Manana/ }).first();
  await select.click({ force: true });
  await page.waitForTimeout(400);
  const opts = page.locator('[role="option"]');
  const optTexts = await opts.allTextContents();
  console.log('options:', optTexts);
  // click Шенгавит
  const shIdx = optTexts.findIndex(t => t.includes('Шенгавит'));
  await opts.nth(shIdx).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/09-shengavit.png` });
  console.log('SHENGAVIT staff mentions:', JSON.stringify(await staffNames()));

  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
} finally {
  await browser.close();
  release();
}

import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/b05-m1';
fs.mkdirSync(OUT, { recursive: true });
async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${BASE}/biz/journal/settings?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Подключить/i }).click();
    await page.waitForTimeout(300);
    const autoSaveSwitch = page.locator('[data-f="F-01-165 F-01-166"] button[role="switch"]').nth(1);
    await autoSaveSwitch.click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Новое сообщение в чате/i }).click();
    await page.waitForTimeout(600);
    const link = page.locator('[data-f="F-01-165"] a');
    const hasLink = await link.isVisible().catch(() => false);
    const href = hasLink ? await link.getAttribute('href') : null;
    await page.screenshot({ path: `${OUT}/f165-popup-with-link.png` });
    console.log('F-01-165 link visible:', hasLink, 'href:', href, 'errors:', errs.join('|'));
    if (hasLink) {
      await link.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/f165-popup-link-target.png` });
      console.log('after click url:', page.url());
    }
    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

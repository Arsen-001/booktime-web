import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/g2-1-m2b';
fs.mkdirSync(OUT, { recursive: true });
const results = {};
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto(`${BASE}/biz/journal?demo=owner&lang=ru`);
  await page.waitForTimeout(1500);

  results.F01001_count = await page.locator('[data-f="F-01-001"]').count();
  results.F01011_count = await page.locator('[data-f="F-01-011"]').count();
  results.F01013_count = await page.locator('[data-f="F-01-013"]').count();
  results.F01019_count = await page.locator('[data-f~="F-01-019"]').count();
  results.F01018_count = await page.locator('[data-f~="F-01-018"]').count();
  results.F01035_count = await page.locator('[data-f~="F-01-035"]').count();

  // F-01-001: click mode toggle button
  const modeBtn = page.locator('[data-f="F-01-001"]').first();
  if (await modeBtn.count() > 0) {
    results.F01001_text = await modeBtn.innerText();
  }

  // F-01-011: day summary button in header - click to open
  const summaryBtn = page.locator('[data-f="F-01-011"]').first();
  if (await summaryBtn.count() > 0) {
    await summaryBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/01-day-summary.png` });
  }
  await page.keyboard.press('Escape').catch(() => {});

  // F-01-013: week view — the dropdown resolves to a native <select><option> (see finding below)
  const weekOption = page.locator('option', { hasText: 'Неделя' }).first();
  results.F01013_isNativeSelect = (await weekOption.count()) > 0;
  if (results.F01013_isNativeSelect) {
    const selectEl = page.locator('select').filter({ has: page.locator('option', { hasText: 'Неделя' }) }).first();
    if ((await selectEl.count()) > 0) {
      await selectEl.selectOption({ label: 'Неделя' }).catch(() => {});
      await page.waitForTimeout(600);
      results.F01013_afterClick = await page.locator('[data-f="F-01-013"]').count();
      await page.screenshot({ path: `${OUT}/02-week-view.png` });
    }
  }

  await page.screenshot({ path: `${OUT}/00-journal-full.png`, fullPage: true });

  // empty-business persona for F-01-018
  await page.goto(`${BASE}/biz/journal?demo=owner-empty&lang=ru`);
  await page.waitForTimeout(1200);
  results.F01018_emptyBiz_count = await page.locator('[data-f~="F-01-018"]').count();
  await page.screenshot({ path: `${OUT}/03-empty-day.png` });

  results.consoleErrors = errs.slice(0, 10);
  await ctx.close();
} finally {
  await browser.close();
  release();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

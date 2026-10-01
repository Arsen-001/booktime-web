// Замер g2-1-m2 — точечная проверка нескольких F-id за один браузерный контекст.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/g2-1-m2';
fs.mkdirSync(OUT, { recursive: true });
const results = {};

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  // 1) F-01-030 / F-01-026: клик по записи открывает окно без confirm
  await page.goto(`${BASE}/biz/journal?demo=owner&lang=ru`);
  await page.waitForTimeout(1500);
  const block = page.locator('[data-f~="F-01-026"]').first();
  const blockCount = await page.locator('[data-f~="F-01-026"]').count();
  results.F01026_count = blockCount;
  if (blockCount > 0) {
    await block.click();
    await page.waitForTimeout(500);
    results.F01030_windowOpened = await page.locator('[data-f~="F-01-037"]').count() > 0;
    await page.screenshot({ path: `${OUT}/01-window-open.png` });
  }

  // 2) F-01-121: data-f на кнопке undo тоста
  const delBtn = page.locator('[data-f~="F-01-118"]').first();
  const beforeDeleteCount = await page.locator('[data-f~="F-01-026"]').count();
  if (await delBtn.count() > 0) {
    await delBtn.click();
    await page.waitForTimeout(300);
    const confirmDel = page.getByRole('button', { name: /удалить/i }).last();
    if (await confirmDel.count() > 0) await confirmDel.click();
    await page.waitForTimeout(500);
    results.F01121_toastDataF = await page.locator('[data-f="F-01-121"]').count();
    results.F01121_undoByText = await page.getByText('Отменить', { exact: false }).count();
    await page.screenshot({ path: `${OUT}/02-after-delete.png` });
    const afterDeleteCount = await page.locator('[data-f~="F-01-026"]').count();
    results.deleteWorked = afterDeleteCount < beforeDeleteCount;
  }

  // 3) Persistence: localStorage state right now + after goto (no reload)
  results.dbInLocalStorage_afterDelete = await page.evaluate(() => localStorage.getItem('bp-mock-db') !== null);
  await page.goto(`${BASE}/biz/records?demo=owner&lang=ru`);
  await page.waitForTimeout(1000);
  results.dbInLocalStorage_afterNav = await page.evaluate(() => localStorage.getItem('bp-mock-db') !== null);
  await page.screenshot({ path: `${OUT}/03-records-after-nav.png` });

  // 4) F-01-156: waitlist panel open state persists across reload
  await page.goto(`${BASE}/biz/journal?demo=owner&lang=ru`);
  await page.waitForTimeout(1000);
  const waitlistBtn = page.locator('[data-f~="F-01-156"]').first();
  if (await waitlistBtn.count() > 0) {
    await waitlistBtn.click();
    await page.waitForTimeout(400);
    results.F01156_openedTabs = await page.locator('[data-f~="F-01-156"]').count();
    await page.reload();
    await page.waitForTimeout(1200);
    results.F01156_afterReloadTabs = await page.locator('[data-f~="F-01-156"]').count();
    await page.screenshot({ path: `${OUT}/04-waitlist-after-reload.png` });
  }

  // 5) F-01-006: LocationSwitcher data-f on DOM node
  results.F01006_domCount = await page.locator('[data-f="F-01-006"]').count();

  // 6) F-01-215: double booking on occupied slot shows reason (best-effort: look for conflict copy in code path not needed; skip deep interaction)

  results.consoleErrors = consoleErrors.slice(0, 10);
  await ctx.close();
} finally {
  await browser.close();
  release();
}

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

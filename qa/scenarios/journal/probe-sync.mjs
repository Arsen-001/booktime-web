import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-g3-1-m1/probe';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: undefined });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await b.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await a.waitForTimeout(1200);
  await b.waitForTimeout(1200);

  const before = await b.locator('[data-f~="F-01-026"]').count();
  console.log('B initial blocks:', before);

  // In tab A, open empty cell far down and save a minimal booking (name+phone only)
  const cells = a.locator('[data-f~="F-01-024"]');
  const n = await cells.count();
  const cell = cells.nth(n - 1);
  const box = await cell.boundingBox();
  await a.mouse.click(box.x + box.width / 2, box.y + 40);
  await a.waitForTimeout(800);
  await a.screenshot({ path: `${OUT}/10-sync-a-open.png` });
  // fill phone
  const phoneInput = a.locator('input[placeholder*="234"], input[type="tel"]').first();
  if (await phoneInput.count()) {
    await phoneInput.fill('91112233');
  }
  const nameInput = a.locator('input[placeholder="Имя"]').first();
  if (await nameInput.count()) await nameInput.fill('Синхро Тест');
  const saveBtn = a.locator('button:has-text("Записать")').first();
  if (await saveBtn.count()) {
    await saveBtn.click();
    await a.waitForTimeout(600);
    const confirmYes = a.locator('button:has-text("Да")').last();
    if (await confirmYes.count()) {
      await a.waitForTimeout(500);
      await confirmYes.click({ force: true });
      await a.waitForTimeout(3000);
    }
  }
  await a.screenshot({ path: `${OUT}/11-sync-a-saved.png` });
  const aAfter = await a.locator('[data-f~="F-01-026"]').count();
  console.log('A blocks after its own save:', aAfter);

  // check tab B without reload
  await b.waitForTimeout(3000);
  const after = await b.locator('[data-f~="F-01-026"]').count();
  console.log('B blocks after A saved (no reload):', after);
  await b.screenshot({ path: `${OUT}/12-sync-b-after.png` });
  // now reload B and recheck
  await b.reload({ waitUntil: 'networkidle' });
  await b.waitForTimeout(1200);
  const afterReload = await b.locator('[data-f~="F-01-026"]').count();
  console.log('B blocks after manual reload:', afterReload);

  await ctxA.close();
  await ctxB.close();
} catch (e) {
  console.log('ERROR', e.message);
} finally {
  await browser.close();
  release();
}

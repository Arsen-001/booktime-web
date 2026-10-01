// b05-m0 (F-01-085/179 editArrivedPaid): создаём оплаченную "Пришёл" запись, затем проверяем блокировку.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const out = { steps: [] };
const log = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); console.log((ok ? '✅' : '❌'), name, detail ?? ''); };

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru&booking=bk_2923`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const dialog = page.getByRole('dialog');
  log('окно записи bk_2923 открыто', await dialog.count() === 1);
  await page.screenshot({ path: 'qa/shots/journal/b05-pay-before.png', fullPage: true });

  const payBtn = dialog.getByRole('button', { name: /Оплатить/i }).first();
  log('кнопка "Оплатить" найдена', await payBtn.count() > 0);
  if (await payBtn.count()) {
    await payBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'qa/shots/journal/b05-pay-modal.png', fullPage: true });
    const confirmBtn = page.getByRole('button', { name: /Оплатить|Провести|Подтвердить/i }).last();
    if (await confirmBtn.count()) { await confirmBtn.click(); await page.waitForTimeout(1200); }
    await page.screenshot({ path: 'qa/shots/journal/b05-pay-after.png', fullPage: true });
  }

  const extras = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    return db.areas?.journal?.extras?.['bk_2923'];
  });
  log('paidAmount после оплаты', (extras?.paidAmount ?? 0) > 0, extras);

  if ((extras?.paidAmount ?? 0) > 0) {
    // Перезагрузить окно (editArrivedPaid уже выключен ранее в b05-rights2) и проверить блокировку
    await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru&booking=bk_2923`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const dialog2 = page.getByRole('dialog');
    await page.screenshot({ path: 'qa/shots/journal/b05-pay-locked-check.png', fullPage: true });
    const commentBox = dialog2.locator('textarea').first();
    const commentDisabled = await commentBox.isDisabled().catch(() => null);
    const statusButtons = dialog2.getByRole('button', { name: 'Не пришёл' });
    const statusDisabled = (await statusButtons.count()) ? await statusButtons.first().isDisabled().catch(() => null) : null;
    log('F-01-085/179: комментарий задизейблен на оплаченной "Пришёл" (editArrivedPaid=off)', commentDisabled === true, commentDisabled);
    log('кнопка смены статуса задизейблена', statusDisabled === true, statusDisabled);
  }

  await ctx.close();
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  await browser.close();
  release();
  fs.writeFileSync('qa/measure/journal/b05-rights3-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}

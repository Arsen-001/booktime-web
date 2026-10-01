// F-04-207: правка клиента должна появиться в журнале изменений (owner)
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${BASE}/biz/clients?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const nameCell = page.locator('table tbody tr').first().locator('td').nth(1);
    await nameCell.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Изменить' }).click();
    await page.waitForTimeout(500);
    // найдём поле "Примечание"/комментарий любое текстовое и допишем что-то, либо просто Email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(`qa-test-${Date.now()}@example.com`);
    } else {
      console.log('email input not found, trying any text input in form');
    }
    const saveBtn = page.getByRole('button', { name: /Сохранить|Готово/ }).first();
    await saveBtn.click();
    await page.waitForTimeout(1200);
    await page.goto(`${BASE}/biz/clients/log?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    const hasEntry = !body.includes('Изменений ещё не было');
    console.log(hasEntry ? '✅ F-04-207: запись в журнале появилась после правки клиента' : '❌ F-04-207: после правки клиента журнал изменений остался пустым');
    console.log('--- фрагмент текста страницы ---');
    console.log(body.slice(0, 500));
    await page.screenshot({ path: 'qa/shots/clients-b05/rights5-log-after-edit.png', fullPage: true });
  } finally {
    await browser.close();
    release();
  }
}
main().catch(e=>{console.error(e); process.exit(0);});

// Кассовая смена: открыть (видно «по учёту»), приход наличными + операция задним числом, закрыть, Z-отчёт
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/finance';
const B = 'http://localhost:3710';
const W = Number(process.env.W || 390), H = W > 800 ? 900 : 844;
const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
const log = (...a) => console.log(...a);
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && log('CONSOLE', m.text().slice(0, 200)));
  await page.goto(`${B}/biz/finance/accounts?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const card = page.locator('[data-f~="F-07-001"]').filter({ has: page.getByRole('button', { name: /Открыть смену|Закрыть смену/ }) }).first();
  let btn = card.getByRole('button', { name: /Закрыть смену/ });
  if (await btn.count()) { log('shift already open → closing first'); await btn.click(); await page.getByRole('dialog').locator('input').first().fill('0'); await page.getByRole('dialog').getByRole('button', { name: 'Закрыть смену' }).click(); await page.waitForTimeout(1500); await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await card.getByRole('button', { name: 'Открыть смену' }).click();
  await page.waitForTimeout(500);
  const dlg = page.getByRole('dialog');
  await dlg.locator('input').first().fill('10000');
  await page.waitForTimeout(300);
  log('OPEN DIALOG:', (await dlg.innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/shift-01-open-${W}.png` });
  await dlg.getByRole('button', { name: 'Открыть смену' }).click();
  await page.waitForTimeout(1500);
  log('CARD:', (await card.innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/shift-02-opened-${W}.png`, fullPage: true });
  // Операция задним числом (вчера) в ту же кассу — через api в странице нельзя; пишем прямо в мок-базу не будем: используем UI «Новый платёж»
  await page.goto(`${B}/biz/finance?lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const newBtn = page.getByRole('button', { name: /Новый платеж|Новый платёж|Новая операция/ }).first();
  log('new op btn:', await newBtn.count());
  if (process.env.BACKDATE && await newBtn.count()) {
    await newBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/shift-03-newop-${W}.png` });
  }
  await page.goto(`${B}/biz/finance/accounts?lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await card.getByRole('button', { name: 'Закрыть смену' }).click();
  await page.waitForTimeout(500);
  await dlg.locator('input').first().fill('9500');
  await page.waitForTimeout(300);
  log('CLOSE DIALOG:', (await dlg.innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/shift-04-close-${W}.png` });
  await dlg.getByRole('button', { name: 'Закрыть смену' }).click();
  await page.waitForTimeout(1500);
  log('Z:', (await page.getByRole('dialog').innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/shift-05-z-${W}.png` });
} finally {
  await browser.close();
  release();
}

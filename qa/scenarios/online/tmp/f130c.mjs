import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.goto('http://localhost:3710/b/nuri-nail-studio/book?demo=guest&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
console.log('STEP1', await page.locator('body').innerText());
await page.getByText('Индивидуальная запись', { exact: true }).click().catch(()=>{});
await page.waitForTimeout(800);
console.log('STEP-after-kind', await page.locator('body').innerText());
const card = page.locator('div').filter({ hasText: 'Мастер маникюра' }).last();
await card.click();
await page.waitForTimeout(500);
const understood = page.getByRole('button', { name: 'Понятно' });
if (await understood.isVisible().catch(() => false)) await understood.click();
await page.waitForTimeout(400);
const cont = page.getByRole('button', { name: 'Продолжить' });
await cont.click();
await page.waitForTimeout(900);
console.log('STEP-services', await page.locator('body').innerText());
await page.screenshot({ path: 'qa/shots/online/g1-3-m1/f130-wizard-services.png', fullPage: true });

// выбрать пакет
await page.getByText('Комплекс: Маникюр классический + Маникюр аппаратный', { exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'qa/shots/online/g1-3-m1/f130-pkg-selected.png', fullPage: true });
console.log('AFTER-PKG-SELECT', await page.locator('body').innerText());

// попытка добавить ещё услугу поверх пакета
const otherService = page.getByText('Педикюр классический', { exact: true }).first();
if (await otherService.isVisible().catch(() => false)) {
  await otherService.click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/shots/online/g1-3-m1/f130-add-another-attempt.png', fullPage: true });
  console.log('AFTER-ADD-ANOTHER', await page.locator('body').innerText());
}

const cont2 = page.getByRole('button', { name: /Продолжить/i });
if (!(await cont2.isDisabled().catch(() => true))) {
  await cont2.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/shots/online/g1-3-m1/f130-after-pkg-continue.png', fullPage: true });
  console.log('AFTER-CONTINUE', await page.locator('body').innerText());
}
console.log('errs', errs);
await browser.close();
release();

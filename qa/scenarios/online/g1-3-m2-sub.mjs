import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const shotsDir = 'qa/shots/online/g1-3-m2';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://localhost:3710/dev/ext/serviceCard/online?demo=individual&sphere=nails&lang=ru&theme=light', {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(1500);

// first ensure "Услуга доступна для онлайн-записи" is ON (it was toggled off in previous run)
const avail = page.getByText('Услуга доступна для онлайн-записи').first();
const availRow = avail.locator('xpath=..');
const availSwitch = availRow.locator('button[role="switch"]').first();
const availChecked = await availSwitch.getAttribute('aria-checked').catch(() => null);
console.log('availability switch aria-checked:', availChecked);
if (availChecked === 'false') {
  await availSwitch.click({ force: true });
  await page.waitForTimeout(600);
}

const subLabel = page.getByText('Запретить онлайн-запись без абонемента').first();
await subLabel.scrollIntoViewIfNeeded();
const subCheckbox = page.locator('input[type=checkbox]').first();
console.log('checkbox count on page:', await page.locator('input[type=checkbox]').count());
// find the checkbox nearest to that label: click on the label text itself (usually toggles associated control)
await subLabel.click({ force: true });
await page.waitForTimeout(700);
await page.screenshot({ path: `${shotsDir}/a3-subonly-toggled.png`, fullPage: true });

const checkedNow = await page.locator('input[type=checkbox]').first().isChecked().catch(() => null);
console.log('subscriptionOnly checkbox checked now:', checkedNow);

await browser.close();
release();

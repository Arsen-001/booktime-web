import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const shotsDir = 'qa/shots/online/g1-3-m2';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.setDefaultTimeout(60000);
ctx.setDefaultNavigationTimeout(60000);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(900);

const buttons = page.getByText('Записаться', { exact: true });
const count = await buttons.count();
console.log('Записаться buttons count:', count);
await buttons.nth(count - 1).click({ force: true }); // last = visit service, per prior confirmed runs
await page.waitForTimeout(900);
console.log('url:', page.url());
await page.screenshot({ path: `${shotsDir}/d1-visit-start.png`, fullPage: true });

const individualOpt = page.getByText('Индивидуальная запись', { exact: false }).first();
if (await individualOpt.isVisible().catch(() => false)) {
  await individualOpt.click({ force: true });
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${shotsDir}/d1b-after-individual.png`, fullPage: true });

// step through: click master card if present, handle gender modal, click Продолжить repeatedly
// until we land on the "Где оказывается услуга" (date/time) step — never touch a district field.
let reachedTimeStep = false;
for (let i = 0; i < 6 && !reachedTimeStep; i++) {
  const bodyNow = await page.locator('body').innerText();
  if (/Где оказывается услуга/i.test(bodyNow)) {
    reachedTimeStep = true;
    break;
  }
  const masterCard = page.locator('button').filter({ hasText: 'Мариам Нерсесян' }).first();
  if (await masterCard.isVisible().catch(() => false)) {
    await masterCard.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const genderOk = page.getByText('Понятно', { exact: true }).first();
  if (await genderOk.isVisible().catch(() => false)) {
    await genderOk.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const cont = page.getByText('Продолжить', { exact: false }).first();
  if (await cont.isVisible().catch(() => false)) {
    const dis = await cont.isDisabled().catch(() => true);
    console.log(`iter ${i}: continue disabled=`, dis);
    if (!dis) {
      await cont.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    } else {
      break; // stuck disabled without touching more fields — stop here (may already be time step)
    }
  } else {
    break;
  }
}
await page.screenshot({ path: `${shotsDir}/d2-time-step-visit.png`, fullPage: true });
console.log('url at time step:', page.url(), 'reachedTimeStep=', reachedTimeStep);

// Check the "Выезд к клиенту" tab is active/selected (this is a visit-only service)
const bodyAtTime = await page.locator('body').innerText();
console.log('mentions "Выезд" or "Район":', /Выезд|Район/i.test(bodyAtTime));

// The workplace tab defaults to "На дому" even for a visit-only service — switch to "Выезд к клиенту" explicitly
const visitTab = page.getByText('Выезд к клиенту', { exact: true }).first();
if (await visitTab.isVisible().catch(() => false)) {
  await visitTab.click({ force: true });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${shotsDir}/d2b-visit-tab.png`, fullPage: true });

// Deliberately do NOT touch any district select. Try to reach a time slot.
const nearestBtn = page.getByText('Перейти к ближайшей дате', { exact: false }).first();
if (await nearestBtn.isVisible().catch(() => false)) {
  await nearestBtn.click({ force: true });
  await page.waitForTimeout(600);
}
await page.screenshot({ path: `${shotsDir}/d3-before-slot.png`, fullPage: true });

const slot = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
let slotClicked = false;
if (await slot.isVisible().catch(() => false)) {
  await slot.click({ force: true });
  slotClicked = true;
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${shotsDir}/d4-after-slot-no-district.png`, fullPage: true });

const continueBtn = page.getByText('Продолжить', { exact: false }).first();
const contVisible = await continueBtn.isVisible().catch(() => false);
const contDisabled = contVisible ? await continueBtn.isDisabled().catch(() => true) : null;
console.log('F-00-080 CHECK: slotClicked=', slotClicked, 'continue visible=', contVisible, 'continue disabled=', contDisabled);

if (contVisible && !contDisabled) {
  console.log('!! F-00-080 REGRESSION SUSPECTED: continue enabled without district !!');
  await continueBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${shotsDir}/d5-clicked-without-district.png`, fullPage: true });
  console.log('url after clicking continue without district:', page.url());
} else if (contVisible && contDisabled) {
  console.log('F-00-080 CONFIRMED FIXED (client-side): continue stays disabled without a district selected.');
}

await browser.close();
release();
console.log('ERRORS', errors.length);
for (const e of errors) console.log('ERR:', e);

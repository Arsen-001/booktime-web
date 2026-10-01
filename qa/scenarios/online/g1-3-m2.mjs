import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const shotsDir = 'qa/shots/online/g1-3-m2';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();

const consoleErrors = [];

async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${page.url()} :: ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`${page.url()} :: pageerror :: ${err.message}`));
  return page;
}

// ===== Part A: toggle subscriptionOnly on first service (sv_mar_gel) via ext, wait properly =====
const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageA = await newPage(ctxA);
await pageA.goto('http://localhost:3710/dev/ext/serviceCard/online?demo=individual&sphere=nails&lang=ru&theme=light', {
  waitUntil: 'networkidle',
});
await pageA.waitForTimeout(1500);
await pageA.screenshot({ path: `${shotsDir}/a1-servicecard-ext.png`, fullPage: true });

const toggleLabel = pageA.getByText('Запретить онлайн-запись без абонемента').first();
const toggleVisible = await toggleLabel.isVisible().catch(() => false);
console.log('toggle visible:', toggleVisible);
if (toggleVisible) {
  const row = pageA.locator('label, div').filter({ hasText: 'Запретить онлайн-запись без абонемента' }).first();
  const sw = row.locator('button[role="switch"], input[type=checkbox]').first();
  if (await sw.count()) {
    await sw.click({ force: true });
  } else {
    await toggleLabel.click({ force: true });
  }
  await pageA.waitForTimeout(800);
}
await pageA.screenshot({ path: `${shotsDir}/a2-servicecard-toggled.png`, fullPage: true });
await ctxA.close();

// ===== Part B: try to book that service (sv_mar_gel = "Маникюр с покрытием") as guest, expect subscription block =====
const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageB = await newPage(ctxB);
await pageB.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await pageB.waitForTimeout(900);
await pageB.screenshot({ path: `${shotsDir}/b0-business-page.png`, fullPage: true });

const svcCard = pageB.getByText('Маникюр с покрытием', { exact: false }).first();
const svcVisible = await svcCard.isVisible().catch(() => false);
console.log('service card visible:', svcVisible);
if (svcVisible) {
  await svcCard.click({ force: true }).catch(() => {});
  await pageB.waitForTimeout(700);
}
await pageB.screenshot({ path: `${shotsDir}/b1-after-service-click.png`, fullPage: true });
console.log('url:', pageB.url());

for (let i = 0; i < 4; i++) {
  const cont = pageB.getByText('Продолжить', { exact: false }).first();
  if (await cont.isVisible().catch(() => false)) {
    const disabled = await cont.isDisabled().catch(() => true);
    console.log(`B step ${i} continue disabled=`, disabled);
    if (disabled) {
      const card = pageB.locator('[role="radio"], .cursor-pointer').first();
      if (await card.isVisible().catch(() => false)) await card.click({ force: true }).catch(() => {});
      await pageB.waitForTimeout(400);
    } else {
      await cont.click({ force: true }).catch(() => {});
      await pageB.waitForTimeout(700);
    }
  }
}
await pageB.screenshot({ path: `${shotsDir}/b2-after-steps.png`, fullPage: true });

const slotB = pageB.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
if (await slotB.isVisible().catch(() => false)) {
  await slotB.click({ force: true });
  await pageB.waitForTimeout(500);
  const cont2 = pageB.getByText('Продолжить', { exact: false }).first();
  if (await cont2.isVisible().catch(() => false)) {
    await cont2.click({ force: true }).catch(() => {});
    await pageB.waitForTimeout(700);
  }
}
await pageB.screenshot({ path: `${shotsDir}/b3-after-slot.png`, fullPage: true });

const nameInput = pageB.locator('input[name=name], input[placeholder*="Имя" i]').first();
if (await nameInput.isVisible().catch(() => false)) {
  await nameInput.fill('Тест Абонемент');
  const phoneInput = pageB.locator('input[type=tel], input[name=phone]').first();
  if (await phoneInput.isVisible().catch(() => false)) {
    await phoneInput.fill('93999999');
  }
  await pageB.screenshot({ path: `${shotsDir}/b4-details-filled.png`, fullPage: true });
  const submitBtn = pageB.getByText('Записаться', { exact: false }).last();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click({ force: true }).catch(() => {});
    await pageB.waitForTimeout(1200);
  }
}
await pageB.screenshot({ path: `${shotsDir}/b5-after-submit.png`, fullPage: true });
console.log('url after submit:', pageB.url());
await ctxB.close();

// ===== Part C: F-00-080 fix verification — visit service, do NOT pick a district, check continue stays disabled =====
const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageC = await newPage(ctxC);
await pageC.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await pageC.waitForTimeout(900);

const buttonsC = pageC.getByText('Записаться', { exact: true });
const countC = await buttonsC.count();
console.log('C Записаться buttons count:', countC);
await buttonsC.nth(countC - 1).click({ force: true }); // last = visit service per earlier runs
await pageC.waitForTimeout(900);
await pageC.screenshot({ path: `${shotsDir}/c1-visit-start.png`, fullPage: true });
console.log('C url:', pageC.url());

for (let i = 0; i < 4; i++) {
  const cont = pageC.getByText('Продолжить', { exact: false }).first();
  const visible = await cont.isVisible().catch(() => false);
  if (!visible) break;
  const disabled = await cont.isDisabled().catch(() => true);
  console.log(`C step ${i} continue disabled=`, disabled, 'url=', pageC.url());
  if (disabled) {
    const card = pageC.locator('[role="radio"], .cursor-pointer').first();
    if (await card.isVisible().catch(() => false)) await card.click({ force: true }).catch(() => {});
    await pageC.waitForTimeout(400);
    const contAfter = pageC.getByText('Продолжить', { exact: false }).first();
    const stillDisabled = await contAfter.isDisabled().catch(() => true);
    if (stillDisabled) {
      console.log('C stopped: still disabled at step', i, '(likely reached time step needing slot/district)');
      break;
    }
  } else {
    await cont.click({ force: true }).catch(() => {});
    await pageC.waitForTimeout(700);
  }
}
await pageC.screenshot({ path: `${shotsDir}/c2-before-slot.png`, fullPage: true });

const slotC = pageC.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
let slotClicked = false;
if (await slotC.isVisible().catch(() => false)) {
  await slotC.click({ force: true });
  slotClicked = true;
  await pageC.waitForTimeout(500);
}
await pageC.screenshot({ path: `${shotsDir}/c3-after-slot-no-district.png`, fullPage: true });

const continueBtn = pageC.getByText('Продолжить', { exact: false }).first();
const contVisible = await continueBtn.isVisible().catch(() => false);
const contDisabled = contVisible ? await continueBtn.isDisabled().catch(() => true) : null;
console.log('F-00-080 CHECK: slotClicked=', slotClicked, 'continue visible=', contVisible, 'continue disabled=', contDisabled);

if (contVisible && !contDisabled) {
  console.log('F-00-080 POTENTIAL REGRESSION: continue is enabled without district selected!');
  await continueBtn.click({ force: true }).catch(() => {});
  await pageC.waitForTimeout(700);
  await pageC.screenshot({ path: `${shotsDir}/c4-clicked-continue-no-district.png`, fullPage: true });
  console.log('url after continue click without district:', pageC.url());
} else if (contVisible && contDisabled) {
  console.log('F-00-080 CONFIRMED FIXED: continue button stays disabled without district.');
}

await ctxC.close();

await browser.close();
release();

console.log('CONSOLE_ERRORS_COUNT', consoleErrors.length);
for (const e of consoleErrors) console.log('CONSOLE_ERROR:', e);

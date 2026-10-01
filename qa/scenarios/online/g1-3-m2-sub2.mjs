import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const shotsDir = 'qa/shots/online/g1-3-m2';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.setDefaultTimeout(60000);
ctx.setDefaultNavigationTimeout(60000);
const errors = [];

async function newPage() {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return page;
}

// Step 1: toggle subscriptionOnly ON for sv_mar_gel (same context, individual persona)
let page = await newPage();
await page.goto('http://localhost:3710/dev/ext/serviceCard/online?demo=individual&sphere=nails&lang=ru&theme=light', {
  waitUntil: 'load', timeout: 60000,
});
await page.waitForTimeout(1200);
const subLabel = page.getByText('Запретить онлайн-запись без абонемента').first();
const subVisible = await subLabel.isVisible().catch(() => false);
console.log('sub label visible:', subVisible);
if (subVisible) {
  const checkbox = page.locator('input[type=checkbox]').first();
  const already = await checkbox.isChecked().catch(() => false);
  console.log('already checked?', already);
  if (!already) {
    await subLabel.click({ force: true });
    await page.waitForTimeout(700);
  }
}
await page.screenshot({ path: `${shotsDir}/x1-toggle-state.png`, fullPage: true });
const checkedFinal = await page.locator('input[type=checkbox]').first().isChecked().catch(() => null);
console.log('checkbox checked after step 1:', checkedFinal);
await page.close();

// Step 2: SAME context — switch to guest persona via demo query, book that service, no subscription
page = await newPage();
await page.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(900);
await page.getByText('Маникюр с покрытием', { exact: false }).first().click({ force: true });
await page.waitForTimeout(700);
await page.getByText('Индивидуальная запись', { exact: false }).first().click({ force: true }).catch(() => {});
await page.waitForTimeout(600);
// check for subscriptionOnly badge/label on the services step BEFORE proceeding
const stepText = await page.locator('body').innerText();
console.log('services-step body contains "абонемент":', /абонемент/i.test(stepText));
await page.screenshot({ path: `${shotsDir}/x2-services-step.png`, fullPage: true });

const masterCard = page.locator('button').filter({ hasText: 'Мариам Нерсесян' }).first();
if (await masterCard.isVisible().catch(() => false)) {
  await masterCard.click({ force: true });
  await page.waitForTimeout(500);
}
const genderOk = page.getByText('Понятно', { exact: true }).first();
if (await genderOk.isVisible().catch(() => false)) {
  await genderOk.click({ force: true });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${shotsDir}/x3-after-master.png`, fullPage: true });

for (let i = 0; i < 3; i++) {
  const cont = page.getByText('Продолжить', { exact: false }).first();
  const visible = await cont.isVisible().catch(() => false);
  if (!visible) break;
  const disabled = await cont.isDisabled().catch(() => true);
  console.log(`step ${i} disabled=`, disabled);
  if (!disabled) {
    await cont.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  } else break;
}
await page.screenshot({ path: `${shotsDir}/x4-time-step.png`, fullPage: true });

const nearestBtn = page.getByText('Перейти к ближайшей дате', { exact: false }).first();
if (await nearestBtn.isVisible().catch(() => false)) {
  await nearestBtn.click({ force: true });
  await page.waitForTimeout(600);
}
const slot = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
if (await slot.isVisible().catch(() => false)) {
  await slot.click({ force: true });
  await page.waitForTimeout(500);
  const cont2 = page.getByText('Продолжить', { exact: false }).first();
  if (await cont2.isVisible().catch(() => false)) {
    await cont2.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
}
await page.screenshot({ path: `${shotsDir}/x5-details-step.png`, fullPage: true });
const detailsText = await page.locator('body').innerText();
console.log('details-step body contains "абонемент":', /абонемент/i.test(detailsText));

const nameInput = page.locator('input[placeholder*="Введите имя" i]').first();
if (await nameInput.isVisible().catch(() => false)) {
  await nameInput.fill('Без Абонемента Тест');
  const phoneInput = page.locator('input[type=tel], input[placeholder*="234" i]').first();
  if (await phoneInput.isVisible().catch(() => false)) await phoneInput.fill('93444488');
  await page.waitForTimeout(300);
  const getCodeBtn = page.getByRole('button', { name: /Получить код/ }).first();
  if (await getCodeBtn.isVisible().catch(() => false)) {
    await getCodeBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    const toastText = await page.locator('body').innerText();
    const m = toastText.match(/Демо-код[^:]*:\s*(\d{4})/);
    const realCode = m ? m[1] : '0000';
    console.log('demo code:', realCode);
    const codeCandidates = page.locator('input[maxlength="4"], input[inputmode="numeric"]');
    const codeField = (await codeCandidates.count()) ? codeCandidates.first() : page.locator('input').last();
    await codeField.fill('').catch(() => {});
    await codeField.fill(realCode).catch(() => {});
    await page.waitForTimeout(300);
    const confirmBtn = page.getByRole('button', { name: /Подтвердить/ }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  const consent = page.locator('input[type=checkbox]').first();
  if (await consent.isVisible().catch(() => false)) {
    await consent.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${shotsDir}/x6-before-submit.png`, fullPage: true });
  const submitBtn = page.getByText('Записаться', { exact: false }).last();
  const submitDisabled = await submitBtn.isDisabled().catch(() => null);
  console.log('submit disabled?', submitDisabled);
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}
await page.screenshot({ path: `${shotsDir}/x7-final.png`, fullPage: true });
console.log('final url:', page.url());
const finalText = await page.locator('body').innerText();
console.log('final: created booking (url has /booking/)?', /\/booking\//.test(page.url()));
console.log('final: contains error about абонемент?', /абонемент/i.test(finalText));
console.log('final text snippet:', finalText.slice(0, 400));

await browser.close();
release();
console.log('ERRORS', errors.length);
for (const e of errors) console.log('ERR:', e);

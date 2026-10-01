import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const shotsDir = 'qa/shots/online/g1-3-m2';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const errors = [];

async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return page;
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await newPage(ctx);
await page.goto('http://localhost:3710/b/mariam-nails?demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const svcCard = page.getByText('Маникюр с покрытием', { exact: false }).first();
await svcCard.click({ force: true });
await page.waitForTimeout(700);
await page.screenshot({ path: `${shotsDir}/b1-service-page.png`, fullPage: true });
console.log('url:', page.url());

const individualOpt = page.getByText('Индивидуальная запись', { exact: false }).first();
if (await individualOpt.isVisible().catch(() => false)) {
  await individualOpt.click({ force: true });
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${shotsDir}/b1b-after-individual.png`, fullPage: true });

// click the master card to select it (step 1 "Мастер") — a plain <button> with the master's name
const masterCard = page.locator('button').filter({ hasText: 'Мариам Нерсесян' }).first();
if (await masterCard.isVisible().catch(() => false)) {
  await masterCard.click({ force: true });
  await page.waitForTimeout(500);
}
// gender-restriction modal (F-00-069) — acknowledge with "Понятно"
const genderOk = page.getByText('Понятно', { exact: true }).first();
if (await genderOk.isVisible().catch(() => false)) {
  await genderOk.click({ force: true });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${shotsDir}/b1c-master-selected.png`, fullPage: true });

// step through (services already selected -> staff -> time)
for (let i = 0; i < 5; i++) {
  const cont = page.getByText('Продолжить', { exact: false }).first();
  const visible = await cont.isVisible().catch(() => false);
  if (!visible) break;
  const disabled = await cont.isDisabled().catch(() => true);
  console.log(`step ${i} disabled=`, disabled, page.url());
  if (disabled) {
    const card = page.locator('[role="radio"], .cursor-pointer').first();
    if (await card.isVisible().catch(() => false)) await card.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  } else {
    await cont.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
}
await page.screenshot({ path: `${shotsDir}/b2-time-step.png`, fullPage: true });

// look for the subscription-only badge/label on this step already
const bodyText = await page.locator('body').innerText();
console.log('contains "абонемент" text:', /абонемент/i.test(bodyText));

const nearestBtn = page.getByText('Перейти к ближайшей дате', { exact: false }).first();
if (await nearestBtn.isVisible().catch(() => false)) {
  await nearestBtn.click({ force: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shotsDir}/b2b-nearest-date.png`, fullPage: true });
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
await page.screenshot({ path: `${shotsDir}/b3-details-step.png`, fullPage: true });
console.log('url after slot+continue:', page.url());

const nameInput = page.locator('input[placeholder*="Введите имя" i], input[placeholder*="Имя" i]').first();
if (await nameInput.isVisible().catch(() => false)) {
  await nameInput.fill('Тест Абонемент Гость');
  const phoneInput = page.locator('input[type=tel], input[placeholder*="234" i]').first();
  if (await phoneInput.isVisible().catch(() => false)) await phoneInput.fill('93555599');
  await page.waitForTimeout(300);
  const getCodeBtn = page.getByRole('button', { name: /Получить код/ }).first();
  if (await getCodeBtn.isVisible().catch(() => false)) {
    await getCodeBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${shotsDir}/b4-code-sent.png`, fullPage: true });
    // read the real demo code from the toast, in case it differs from a stale "0000"
    const toastText = await page.locator('body').innerText();
    const m = toastText.match(/Демо-код[^:]*:\s*(\d{4})/);
    const realCode = m ? m[1] : '0000';
    console.log('demo code from toast:', realCode);
    const codeCandidates = page.locator('input[maxlength="4"], input[inputmode="numeric"], input[placeholder*="код" i]');
    const codeField = (await codeCandidates.count()) ? codeCandidates.first() : page.locator('input').filter({ hasNotText: '' }).last();
    await codeField.fill('').catch(() => {});
    await codeField.fill(realCode).catch(() => {});
    await page.waitForTimeout(300);
    const confirmBtn = page.getByRole('button', { name: /Подтвердить/ }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  await page.screenshot({ path: `${shotsDir}/b4-filled.png`, fullPage: true });
  const consent = page.locator('input[type=checkbox]').first();
  if (await consent.isVisible().catch(() => false)) {
    await consent.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${shotsDir}/b4b-consent.png`, fullPage: true });
  const submitBtn = page.getByText('Записаться', { exact: false }).last();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
  }
}
await page.screenshot({ path: `${shotsDir}/b5-final.png`, fullPage: true });
console.log('final url:', page.url());
const finalText = await page.locator('body').innerText();
console.log('final body contains абонемент:', /абонемент/i.test(finalText));
console.log('final body contains "Ждёт подтверждения" or "Вы записаны":', /Ждёт подтверждения|Вы записаны/i.test(finalText));

await browser.close();
release();
console.log('ERRORS', errors.length, errors.join(' | '));

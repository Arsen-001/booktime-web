import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';

const OUT = 'qa/shots/online/g1-3-m1/flow-visit';
fs.mkdirSync(OUT, { recursive: true });

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('shot', name);
}
async function dump() {
  console.log('--- text ---');
  console.log(await page.locator('body').innerText());
}

await page.goto('http://localhost:3710/b/mariam-nails/book?service=sv_mar_visit&demo=guest&sphere=nails&lang=ru&theme=light&empty=0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('01-kind');
await page.getByText('Индивидуальная запись', { exact: true }).click();
await page.waitForTimeout(900);
await shot('02-after-kind');
await dump();

// шаг «Мастер» — карточка Мариам уже одна; кликаем по самой карточке (не по имени-ссылке), затем «Продолжить»
const masterCard = page.locator('div').filter({ hasText: 'Только женщины' }).last();
await masterCard.click();
await page.waitForTimeout(500);
await shot('02b-after-master-click');
const understoodBtn = page.getByRole('button', { name: 'Понятно' });
if (await understoodBtn.isVisible().catch(() => false)) await understoodBtn.click();
await page.waitForTimeout(500);
await shot('02c-modal-dismissed');
await dump();
const contBtn = page.getByRole('button', { name: 'Продолжить' });
console.log('continue disabled?', await contBtn.isDisabled());
console.log('continue count:', await page.getByRole('button', { name: 'Продолжить' }).count());
await contBtn.click();
await page.waitForTimeout(900);
console.log('URL after continue:', page.url());
await shot('03-after-master');
await dump();

// Шаг «Услуги»: с ?service= предзаполнено, «Маникюр с выездом к вам» должен быть выбран (F-00-080)
const cont2 = page.getByRole('button', { name: 'Продолжить' });
if (await cont2.isVisible().catch(() => false)) {
  console.log('services step continue disabled?', await cont2.isDisabled());
  await cont2.click();
  await page.waitForTimeout(900);
  await shot('04-after-services');
  await dump();
}

// Шаг «Место» — выбрать «Выезд к клиенту» (F-00-080)
await shot('05a-place-step');
await page.getByText('Выезд к клиенту', { exact: true }).click();
await page.waitForTimeout(600);
await shot('05b-after-visit-selected');
await dump();

// «Перейти к ближайшей дате», если сегодня пусто
const jumpBtn = page.getByRole('button', { name: /ближайшей дате/i });
if (await jumpBtn.isVisible().catch(() => false)) {
  await jumpBtn.click();
  await page.waitForTimeout(700);
  await shot('05c-jumped-date');
  await dump();
}

const slot = page.locator('button', { hasText: /^\d{1,2}:\d{2}$/ }).first();
if (await slot.isVisible().catch(() => false)) {
  await slot.click();
  await page.waitForTimeout(500);
  await shot('05d-slot-selected');
}
const nextBtn = page.getByRole('button', { name: /Продолжить/i }).first();
console.log('date step next disabled?', await nextBtn.isDisabled().catch(() => 'n/a'));
if (!(await nextBtn.isDisabled().catch(() => true))) {
  await nextBtn.click();
  await page.waitForTimeout(900);
}
await shot('06-final');
await dump();

// Шаг «Детали записи»: имя, телефон, код, согласие, «Записаться»
await page.locator('input[name="name"], input[placeholder*="мя" i]').first().fill('Тестовая Заявка').catch(() => {});
await page.locator('input[type="tel"], input[name="phone"]').first().fill('93123456').catch(() => {});
await page.waitForTimeout(300);
const getCodeBtn = page.getByRole('button', { name: /Получить код/i });
if (await getCodeBtn.isVisible().catch(() => false)) {
  await getCodeBtn.click();
  await page.waitForTimeout(700);
  await shot('07-after-getcode');
  await dump();
}
// демо-код показан в жёлтой плашке "Демо-код: XXXX" — читаем и вводим настоящий
const demoCodeText = await page.getByText(/Демо-код/).innerText().catch(() => '');
const codeMatch = demoCodeText.match(/(\d{4})/);
const demoCode = codeMatch ? codeMatch[1] : '0000';
console.log('demo code:', demoCode);
const codeInput = page.locator('input[inputmode="numeric"], input[name*="code" i], input[maxlength="4"]').first();
if (await codeInput.isVisible().catch(() => false)) {
  await codeInput.fill(demoCode).catch(() => {});
  await page.waitForTimeout(500);
  await shot('07b-code-filled');
  const confirmBtn = page.getByRole('button', { name: /^Подтвердить$/ });
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(700);
  }
  await shot('07c-code-confirmed');
  await dump();
}
const consent = page.locator('input[type="checkbox"]').first();
if (await consent.isVisible().catch(() => false)) {
  const checked = await consent.isChecked().catch(() => true);
  if (!checked) await consent.click({ force: true }).catch(() => {});
}
await shot('08-before-submit');
const submitBtn = page.getByRole('button', { name: /^Записаться$/ });
console.log('submit disabled?', await submitBtn.isDisabled().catch(() => 'n/a'));
if (!(await submitBtn.isDisabled().catch(() => true))) {
  await submitBtn.click();
  await page.waitForTimeout(1200);
}
console.log('final URL:', page.url());
await page.waitForTimeout(1500);
await shot('09-after-submit');
await dump();

await page.close();
await browser.close();
release();
console.log('console errors:', consoleErrors);

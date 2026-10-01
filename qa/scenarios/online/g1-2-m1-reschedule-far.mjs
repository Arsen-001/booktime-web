// Пробуем найти слот на будущий день (не сегодня), чтобы «Перенести» был доступен.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/g1-2-m1/reschedule-far';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
const page = await ctx.newPage();

await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&lang=ru`);
await page.waitForTimeout(1000);
const individualBtn = page.getByText(/Индивидуальная запись/).first();
if (await individualBtn.count()) { await individualBtn.click(); await page.waitForTimeout(700); }

for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(400);
  if (await page.locator('[data-f*="F-03-090"]').count()) break;
  const staffStep = page.locator('[data-f*="F-03-087"]');
  const servicesStep = page.locator('[data-f*="F-03-088"]');
  const timeStep = page.locator('[data-f*="F-03-084"]');
  if (await staffStep.count()) {
    await staffStep.locator('button').first().click();
    await page.waitForTimeout(300);
    const dialog = page.getByRole('dialog');
    if (await dialog.count()) await dialog.getByRole('button').last().click();
  } else if (await servicesStep.count()) {
    await servicesStep.locator('input[type=checkbox], [role=checkbox]').first().click();
  } else if (await timeStep.count()) {
    // Кликаем на день через ~3 дня вперёд, если видим календарь с кнопками дней
    const dayButtons = page.locator('[data-f*="F-03-084"] button').filter({ hasNotText: /:\d\d/ });
    const dayCount = await dayButtons.count();
    let picked = false;
    for (let d = 0; d < dayCount; d++) {
      const btn = dayButtons.nth(d);
      const disabled = await btn.isDisabled().catch(() => true);
      if (!disabled) {
        const txt = await btn.innerText().catch(() => '');
        if (/^\d+$/.test(txt.trim())) {
          // берём день с индексом подальше (не первый доступный)
        }
      }
    }
    const slots = timeStep.locator('button.min-h-11');
    if ((await slots.count()) > 0) {
      await slots.last().click();
      picked = true;
    }
    if (!picked) { console.log('нет слотов'); await browser.close(); release(); process.exit(0); }
  } else break;
  const cont = page.getByRole('button', { name: /Продолжить/ }).first();
  if (await cont.count()) { await cont.click(); await page.waitForTimeout(700); }
}

await page.locator('[data-f*="F-03-091"] input:not([type=tel])').first().fill('Тест Перенос', { timeout: 10000 });
await page.locator('[data-f*="F-03-125"] input[type=tel], input[type=tel]').first().fill('99777002');
const sendBtn = page.getByRole('button', { name: /Отправить код|Получить код/ }).first();
if (await sendBtn.count()) {
  await sendBtn.click();
  await page.waitForTimeout(400);
  const toastText = await page.locator('body').innerText();
  const code = (toastText.match(/(\d{4})\D*$/m) || toastText.match(/(\d{4})/))?.[1];
  if (code) {
    await page.locator('input[maxlength="4"], input[inputmode="numeric"]').first().fill(code);
    await page.getByRole('button', { name: /Подтвердить код|Подтвердить/ }).first().click();
    await page.waitForTimeout(300);
  }
}
const consentBox = page.locator('[data-f*="F-03-080"] input[type=checkbox], [data-f*="F-03-080"] [role=checkbox]').first();
if (await consentBox.count()) await consentBox.click();
await page.getByRole('button', { name: /Записаться/ }).first().click();
await page.waitForTimeout(2000);
console.log('URL:', page.url());
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/1-confirmed.png`, fullPage: true });

const rescheduleBtn = page.locator('[data-f="F-03-099"]');
console.log('перенести disabled?', await rescheduleBtn.isDisabled().catch(() => 'err'));
if ((await rescheduleBtn.isDisabled().catch(() => true)) === false) {
  await rescheduleBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/2-reschedule-sheet.png`, fullPage: true });
  const slotBtns = page.locator('[role=dialog] button, aside button, [role=complementary] button').filter({ hasText: /:\d\d/ });
  const n = await slotBtns.count();
  console.log('слотов в шите переноса:', n);
  if (n > 0) {
    await slotBtns.first().click();
    await page.waitForTimeout(300);
    const confirmBtn = page.getByRole('button', { name: /Перенести|Подтвердить/ }).last();
    await confirmBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/3-after-reschedule.png`, fullPage: true });
    const bodyAfter = await page.locator('body').innerText();
    console.log('после переноса body:', bodyAfter.slice(0, 300));
  }
}
await browser.close();
release();

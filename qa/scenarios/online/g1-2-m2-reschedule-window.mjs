// Проверка F-03-066 (fix2): видимая причина недоступности «Перенести» на телефоне без наведения.
// Создаём реальную запись через визард, затем двигаем её время в прошлое (внутри окна отсечки)
// напрямую в localStorage мок-базы (тот же приём, что и остальные сценарии проекта используют
// для доступа к mock db) и перезагружаем экран подтверждения — так получаем canReschedule:false
// без гонки с реальными часами.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/g1-2-m2';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

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
    const slots = timeStep.locator('button.min-h-11');
    if ((await slots.count()) > 0) { await slots.first().click(); }
    else { console.log('нет слотов'); await browser.close(); release(); process.exit(0); }
  } else break;
  const cont = page.getByRole('button', { name: /Продолжить/ }).first();
  if (await cont.count()) { await cont.click(); await page.waitForTimeout(700); }
}

await page.locator('[data-f*="F-03-091"] input:not([type=tel])').first().fill('Тест ОкноПереноса', { timeout: 10000 });
await page.locator('[data-f*="F-03-125"] input[type=tel], input[type=tel]').first().fill('99777003');
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
const url = page.url();
console.log('URL после записи:', url);

// Двигаем время записи в БД (localStorage) на через 1 час от текущего момента (обычно окно переноса 3ч/24ч)
const moved = await page.evaluate(() => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!/mock|booking|db/i.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw || !raw.includes('bookings')) continue;
      const obj = JSON.parse(raw);
      const state = obj.state ?? obj;
      const bookings = state.bookings || state.core?.bookings;
      if (!bookings) continue;
      const arr = Array.isArray(bookings) ? bookings : Object.values(bookings);
      // Берём последнюю созданную (по createdAt/самый большой id)
      const sorted = arr.slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
      const b = sorted[0];
      if (!b) continue;
      const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      b.start = soon;
      b.end = new Date(Date.now() + 90 * 60 * 1000).toISOString();
      if (Array.isArray(bookings)) {
        const idx = bookings.findIndex((x) => x.id === b.id);
        bookings[idx] = b;
      } else {
        bookings[b.id] = b;
      }
      localStorage.setItem(key, JSON.stringify(obj));
      return { key, id: b.id, start: b.start };
    }
    return null;
  } catch (e) {
    return { error: String(e) };
  }
});
console.log('moved:', JSON.stringify(moved));

await page.reload();
await page.waitForTimeout(1500);

const rescheduleBtn = page.locator('[data-f="F-03-099"]');
const rescheduleDisabled = await rescheduleBtn.isDisabled().catch(() => 'no-button');
const reasonParagraph = page.locator('[data-f="F-03-066"]');
const reasonCount = await reasonParagraph.count();
const reasonText = reasonCount ? await reasonParagraph.first().innerText() : null;
const reasonVisible = reasonCount ? await reasonParagraph.first().isVisible() : false;

console.log('перенести disabled?', rescheduleDisabled);
console.log('абзац причины найден?', reasonCount, 'видим?', reasonVisible, 'текст:', reasonText);

await page.screenshot({ path: `${OUT}/reschedule-window-forced.png`, fullPage: true });
console.log('errors:', JSON.stringify(errors));

await browser.close();
release();

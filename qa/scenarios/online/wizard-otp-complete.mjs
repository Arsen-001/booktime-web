// Разовая проверка: доводит визард записи (F-03-077/086/090/092/093/134) до конца, читая демо-код
// из тоста динамически (код случайный — зашитое значение в JSON-сценарии не подходит).
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/b/nuri-nail-studio/book?demo=client&empty=0&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.getByText('Индивидуальная запись').click();
    await page.waitForTimeout(300);
    await page.locator('div.cursor-pointer').first().click();
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await page.waitForTimeout(400);
    await page.getByText('Ани Саргсян').click();
    await page.waitForTimeout(200);
    const gate = page.getByRole('button', { name: /Понятно/ });
    if (await gate.isVisible().catch(() => false)) await gate.click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await page.waitForTimeout(500);
    await page.getByText('15:30').click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await page.waitForTimeout(400);

    await page.locator('input[placeholder="Введите имя"]').fill('Тест Тестов');
    await page.locator('input[placeholder="91 234 567"]').fill('91234567');
    await page.getByRole('button', { name: /Получить код/ }).click();
    await page.waitForTimeout(400);

    // читаем код прямо из тоста, а не гадаем
    const toastText = await page.getByText(/Демо-код/).first().textContent();
    const code = (toastText || '').match(/(\d{4})/)?.[1];
    console.log('demo code read from toast:', code);
    if (!code) throw new Error('не нашли демо-код в тосте: ' + toastText);

    await page.locator('input[placeholder="0000"]').fill(code);
    await page.getByRole('button', { name: /^Подтвердить$/ }).click();
    await page.waitForTimeout(400);
    const verifiedOk = await page.getByText('Номер подтверждён').isVisible().catch(() => false);
    console.log('phone verified banner visible:', verifiedOk);
    await page.screenshot({ path: 'qa/shots/online-g21-wizard/otp-after-verify.png', fullPage: true });

    // тосты перекрывают низ формы — закрываем перед кликом по чекбоксу согласия
    for (const btn of await page.locator('button[aria-label="Закрыть"], button:near(:text("Демо-код"))').all()) {
      await btn.click().catch(() => {});
    }
    await page.locator('text=Демо-код').locator('xpath=../..').locator('button').last().click().catch(() => {});
    await page.waitForTimeout(200);
    console.log('checkbox count:', await page.getByRole('checkbox').count());
    const allLabels = await page.locator('label').allTextContents();
    console.log('labels:', JSON.stringify(allLabels));
    const consentBox = page.getByRole('checkbox').last();
    await consentBox.scrollIntoViewIfNeeded();
    await consentBox.click({ force: true });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'qa/shots/online-g21-wizard/otp-after-consent.png', fullPage: true });

    await page.getByRole('button', { name: /Записаться/ }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'qa/shots/online-g21-wizard/otp-final.png', fullPage: true });

    const url = page.url();
    console.log('final url:', url);
    console.log('console errors:', JSON.stringify(consoleErrors));
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => { console.error('SCENARIO FAILED:', e); process.exitCode = 1; });

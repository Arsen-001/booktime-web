// Ручная проверка F-04-099: поиск клиента по номеру абонемента в окне записи (без сохранённого сценария measure.mjs,
// т.к. нужно прочитать код абонемента со страницы и подставить его в следующий шаг).
// Раздел: clients. Измеритель, код не правит. Запуск: node qa/scenarios/clients/g3-2-f099.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // 1. включить настройку "поиск по лояльности в окне записи"
    await page.goto(`${BASE}/dev/ext/settingsHub/clients?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    const switchEl = page.locator('[data-f="F-04-099"] button[role="switch"]');
    await switchEl.waitFor({ timeout: 10000 });
    const checked = await switchEl.getAttribute('aria-checked');
    if (checked !== 'true') {
      await switchEl.click();
      await page.waitForTimeout(1500);
    }
    console.log('F-04-099 switch aria-checked after ensure-on:', await switchEl.getAttribute('aria-checked'));
    await page.waitForTimeout(1000);

    // 2. открыть карточку клиента cl_001, вкладку "Лояльность", прочитать код абонемента
    await page.goto(`${BASE}/biz/clients/cl_001?tab=loyalty&persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    const loyaltyTabBtn = page.locator('button:has-text("Лояльность")').first();
    if (await loyaltyTabBtn.count()) {
      await loyaltyTabBtn.click();
      await page.waitForTimeout(2500);
    } else {
      console.log('no "Лояльность" tab button visible directly');
    }
    const bodyText = await page.locator('body').innerText();
    const subMatch = bodyText.match(/SUB-\d{4}/);
    const certMatch = bodyText.match(/CERT-\d{4}/);
    const code = subMatch?.[0] ?? certMatch?.[0];
    console.log('found code on cl_001 loyalty tab:', code ?? '(none found — client may have no subscription/certificate)');

    if (!code) {
      console.log('RESULT: cannot verify — cl_001 has no subscription/certificate code visible on loyalty tab');
      await page.screenshot({ path: 'qa/shots/clients/g3-2-f099-no-code.png', fullPage: true });
    } else {
      // 3. окно записи без выбранного клиента — ввести код
      await page.goto(`${BASE}/dev/ext/bookingWindow/clients?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
      const searchBox = page.locator('[data-f="F-04-099"] input');
      await searchBox.waitFor({ timeout: 10000 });
      await searchBox.fill(code);
      await page.locator('[data-f="F-04-099"] button:has-text("Найти"), [data-f="F-04-099"] button').last().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'qa/shots/clients/g3-2-f099-after-search.png', fullPage: true });
      const after = await page.locator('[data-f="F-04-099"]').innerText().catch(() => '(gone)');
      console.log('block content after search:', after);
      const notFound = await page.locator('text=/не найден/i').count();
      console.log('notFound message count:', notFound);
    }

    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});

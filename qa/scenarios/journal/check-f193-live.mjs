// qa/measure/journal/g3-2-m1: живая проверка F-01-193 — групповая услуга не должна предлагаться
// в окне ИНДИВИДУАЛЬНОЙ записи. Бизнес arman-fit (individual, sphere fitness) имеет и
// индивидуальные (sv_arm_personal), и групповые (sv_arm_group_func/stretch) услуги.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';

(async () => {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/biz/journal?demo=individual&sphere=fitness&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/shots/journal-g3-2-m1/f193-00-journal.png' });

    // Открыть создание записи: клик по пустой ячейке грида/FAB.
    const fab = page.locator('button[aria-label*="апис" i], button:has-text("Новая запись"), [data-f~="F-01-025"]').first();
    if (await fab.count()) {
      await fab.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: 'qa/shots/journal-g3-2-m1/f193-01-after-fab.png' });

    // Меню "Новая запись" → "Обычная запись"
    const bookingTile = page.locator('text=Обычная запись').first();
    if (await bookingTile.count()) {
      await bookingTile.click();
      await page.waitForTimeout(1000);
    }
    // "Что создать?" → "Запись"
    const recordTile = page.locator('text=Индивидуальная запись клиента').first();
    if (await recordTile.count()) {
      await recordTile.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'qa/shots/journal-g3-2-m1/f193-02-window.png' });

    // Открыть выбор услуги
    const svcOpener = page.locator('text=/Услуга|Добавить услугу|Выбрать услугу/').first();
    if (await svcOpener.count()) {
      await svcOpener.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'qa/shots/journal-g3-2-m1/f193-03-picker.png' });

    const bodyText = await page.locator('body').innerText();
    const result = {
      hasGroupFunc: bodyText.includes('Функциональная тренировка в группе'),
      hasGroupStretch: bodyText.includes('Растяжка в группе'),
      hasPersonal: bodyText.includes('Персональная тренировка'),
      consoleErrors,
    };
    console.log(JSON.stringify(result, null, 2));
    await page.close();
  } finally {
    await browser.close();
    release();
  }
})();

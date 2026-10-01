// Измеритель g1-2-m1: создаёт запись через визард, потом на её экране подтверждения (F-03-097/F-00-068)
// проверяет действием кнопки «Перенести» (F-03-066/F-03-099) и «Отменить» (F-03-067/F-03-100).
// node qa/scenarios/online/g1-2-m1-cancel-reschedule.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/g1-2-m1/cancel-reschedule';

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

const run = async () => {
  const release = await acquireBrowserSlot();
  const errs = [];
  try {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));

    await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&lang=ru`);
    await page.waitForTimeout(1000);

    const individualBtn = page.getByText(/Индивидуальная запись/).first();
    if (await individualBtn.count()) {
      await individualBtn.click();
      await page.waitForTimeout(700);
    }

    // Пройти визард генерически (мастер без ограничения по полу, чтобы избежать модалки где возможно)
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
        await page.waitForTimeout(200);
      } else if (await servicesStep.count()) {
        await servicesStep.locator('input[type=checkbox], [role=checkbox]').first().click();
        await page.waitForTimeout(200);
      } else if (await timeStep.count()) {
        const emptyDay = page.locator('[data-f*="F-03-085"]');
        if (await emptyDay.count()) {
          await emptyDay.getByRole('button').click();
          await page.waitForTimeout(500);
        }
        const slots = timeStep.locator('button.min-h-11');
        if ((await slots.count()) > 0) {
          await slots.first().click();
          await page.waitForTimeout(300);
        } else {
          console.log('нет слотов — прерываю');
          await browser.close();
          release();
          return;
        }
      } else {
        break;
      }
      const cont = page.getByRole('button', { name: /Продолжить/ }).first();
      if (await cont.count()) {
        await cont.click();
        await page.waitForTimeout(700);
      }
    }

    await shot(page, '0-before-details-fill');
    console.log('body snippet:', (await page.locator('body').innerText()).slice(0, 400));
    await page.locator('[data-f*="F-03-091"] input:not([type=tel])').first().fill('Тест Отмена', { timeout: 8000 });
    await page.locator('[data-f*="F-03-125"] input[type=tel], input[type=tel]').first().fill('99777001');
    await page.waitForTimeout(150);

    const sendBtn = page.getByRole('button', { name: /Отправить код|Получить код/ }).first();
    if (await sendBtn.count()) {
      await sendBtn.click();
      await page.waitForTimeout(400);
      const toastText = await page.locator('body').innerText();
      const codeMatch = toastText.match(/(\d{4})\D*$/m) || toastText.match(/(\d{4})/);
      const code = codeMatch?.[1];
      if (code) {
        const codeInput = page.locator('input[maxlength="4"], input[inputmode="numeric"]').first();
        await codeInput.fill(code);
        await page.getByRole('button', { name: /Подтвердить код|Подтвердить/ }).first().click();
        await page.waitForTimeout(300);
      }
    }

    const consentBox = page.locator('[data-f*="F-03-080"] input[type=checkbox], [data-f*="F-03-080"] [role=checkbox]').first();
    if (await consentBox.count()) await consentBox.click();
    await page.waitForTimeout(150);
    const submitBtn = page.getByRole('button', { name: /Записаться/ }).first();
    await submitBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, '1-after-submit');
    console.log('URL после отправки:', page.url());

    // Ожидаем переход на /b/nuri-nail-studio/booking/[id] (F-03-097)
    if (!/\/booking\//.test(page.url())) {
      // возможно кнопка "к записи" отдельная
      const viewLink = page.getByRole('link', { name: /детал|Подробнее|запис/i }).first();
      if (await viewLink.count()) {
        await viewLink.click();
        await page.waitForTimeout(800);
      }
    }
    console.log('URL итог:', page.url());
    await shot(page, '2-confirmed-screen');

    const rescheduleBtn = page.locator('[data-f="F-03-099"]');
    const cancelBtn = page.locator('[data-f="F-03-100"] button, button[data-f="F-03-100"]').first();
    console.log('кнопка «Перенести» найдена:', await rescheduleBtn.count());
    console.log('кнопка «Отменить» найдена:', await page.locator('button[data-f="F-03-100"]').count());

    const rescheduleDisabled = await rescheduleBtn.isDisabled().catch(() => null);
    console.log('«Перенести» disabled?', rescheduleDisabled);

    if (rescheduleDisabled === false) {
      await rescheduleBtn.click();
      await page.waitForTimeout(700);
      await shot(page, '3-reschedule-sheet');
      const slotBtns = page.locator('[role=dialog] button, aside button').filter({ hasText: /:\d\d/ });
      const n = await slotBtns.count();
      console.log('слотов в шите переноса:', n);
      if (n > 0) {
        await slotBtns.first().click();
        await page.waitForTimeout(300);
        const confirmBtn = page.getByRole('button', { name: /Перенести|Подтвердить/ }).last();
        await confirmBtn.click();
        await page.waitForTimeout(1000);
        await shot(page, '4-after-reschedule');
        const bodyAfter = await page.locator('body').innerText();
        console.log('после переноса виден тост/новое время:', /перенес|reschedul/i.test(bodyAfter));
      }
    }

    // Теперь отмена
    const cancelButton = page.locator('button[data-f="F-03-100"]').first();
    if (await cancelButton.count()) {
      await cancelButton.click();
      await page.waitForTimeout(500);
      await shot(page, '5-cancel-confirm-dialog');
      const dialog = page.getByRole('dialog');
      console.log('открылся наш ConfirmDialog (не системный confirm())?', await dialog.count() > 0);
      const confirmCancelBtn = dialog.getByRole('button', { name: /Отменить запись|Да, отменить|Подтвердить/ }).last();
      if (await confirmCancelBtn.count()) {
        await confirmCancelBtn.click();
        await page.waitForTimeout(2500);
        await shot(page, '6-after-cancel');
        const bodyFinal = await page.locator('body').innerText();
        console.log('после отмены (2.5с) весь текст:', bodyFinal.slice(0, 500));
        console.log('после отмены статус «Отменена» виден?', /Отменен|Отменён|cancelled|Cancelled/i.test(bodyFinal));
        console.log('окно освободилось / можно снова записаться (кнопка «Записаться снова»)?', /Записаться|Book again/i.test(bodyFinal));
      }
    }

    console.log('errs:', errs);
    await browser.close();
  } finally {
    release();
  }
};

run();

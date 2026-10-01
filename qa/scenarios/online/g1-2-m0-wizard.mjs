// Измеритель g1-2-m0: полный проход виджета записи /b/nuri-nail-studio/book с SMS-кодом, напоминанием,
// доп. полем, согласием — покрывает F-03-084/087/088/090/092/093/077/080/085/127/134/071/072/073/075.
// node qa/scenarios/online/g1-2-m0-wizard.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/g1-2-m0/wizard';

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

function log(...args) {
  console.log(...args);
}

async function fullWizard(browser, { device, lang }) {
  const viewport = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, locale: lang === 'en' ? 'en-US' : 'ru-RU' });
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', (e) => consoleErrs.push(String(e)));

  const tag = `${device}-${lang}`;
  await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&lang=${lang}`);
  await page.waitForTimeout(1000);
  await shot(page, `${tag}-1-services`);

  // Экран выбора «индивидуальная / групповая» перед мастером/услугами (F-03-082), если показан
  const individualBtn = page.getByText(/Индивидуальная запись|Individual booking/).first();
  if (await individualBtn.count()) {
    await individualBtn.click();
    await page.waitForTimeout(700);
    await shot(page, `${tag}-1b-after-individual`);
  }

  // Шаги «Мастер» / «Услуги» / «Время» могут идти в любом порядке (F-03-081 — свой порядок ссылки).
  // Проходим генерическим циклом, пока не появится «Детали записи» (F-03-090).
  const staffSeen = { v: false };
  const servicesSeen = { v: false };
  const timeSeen = { v: false };
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(400);
    if (await page.locator('[data-f*="F-03-090"]').count()) break; // дошли до деталей
    const staffStep = page.locator('[data-f*="F-03-087"]');
    const servicesStep = page.locator('[data-f*="F-03-088"]');
    const timeStep = page.locator('[data-f*="F-03-084"]');
    await shot(page, `${tag}-2-step-${i}`);
    if ((await staffStep.count()) && !staffSeen.v) {
      staffSeen.v = true;
      log(`[${tag}] F-03-087: шаг выбора специалиста показан`);
      await staffStep.locator('button').first().click();
      await page.waitForTimeout(300);
      // F-00-069: если у мастера «кого принимаю» ограничено, всплывает модалка подтверждения — закрыть «ОК»
      const genderModal = page.getByRole('dialog');
      if (await genderModal.count()) {
        log(`[${tag}] F-00-069: модалка «кого принимаю» показана при выборе мастера с ограничением`);
        const okBtn = genderModal.getByRole('button').last();
        await okBtn.click();
        await page.waitForTimeout(200);
      }
    } else if ((await servicesStep.count()) && !servicesSeen.v) {
      servicesSeen.v = true;
      log(`[${tag}] F-03-088: шаг выбора услуг показан`);
      await servicesStep.locator('input[type=checkbox], [role=checkbox]').first().click();
      await page.waitForTimeout(200);
    } else if ((await timeStep.count()) && !timeSeen.v) {
      timeSeen.v = true;
      log(`[${tag}] F-03-084: шаг даты и времени показан`);
      const emptyDay = page.locator('[data-f*="F-03-085"]');
      if (await emptyDay.count()) {
        log(`[${tag}] F-03-085: сегодняшний день пуст, есть блок «Ближайшая доступная дата» — жму`);
        await emptyDay.getByRole('button').click();
        await page.waitForTimeout(500);
        await shot(page, `${tag}-2b-nearest-date`);
      }
      const slotCount = await timeStep.locator('button.min-h-11').count();
      log(`[${tag}] F-03-084: найдено кнопок-слотов: ${slotCount}`);
      if (slotCount > 0) {
        await timeStep.locator('button.min-h-11').first().click();
        await page.waitForTimeout(300);
      } else {
        log(`[${tag}] F-03-084: !!! слотов нет вовсе — не могу продолжить проход`);
        await shot(page, `${tag}-2c-no-slots`);
        await ctx.close();
        return { tag, consoleErrs, blocked: 'no-slots' };
      }
    } else {
      log(`[${tag}] !!! неопознанный шаг ${i}, останавливаюсь`);
      break;
    }
    const cont = page.getByRole('button', { name: /Продолжить|Continue/ }).first();
    if (await cont.count()) {
      await cont.click();
      await page.waitForTimeout(700);
    }
  }
  await shot(page, `${tag}-4-details-step`);

  // F-03-090: сводка деталей записи присутствует
  const detailsPresent = await page.locator('[data-f*="F-03-090"]').count();
  log(`[${tag}] F-03-090: сводка «Детали записи» видна?`, detailsPresent > 0);

  // F-03-071 / F-03-091: имя + телефон
  await page.locator('[data-f*="F-03-091"] input:not([type=tel])').first().fill('Тест Тестов');
  await page.locator('[data-f*="F-03-125"] input[type=tel], input[type=tel]').first().fill('99123456');
  await page.waitForTimeout(150);

  // F-03-073: своё доп. поле локации, если есть
  const customField = page.locator('[data-f*="F-03-073"] input, [data-f*="F-03-073"] textarea').first();
  if (await customField.count()) {
    log(`[${tag}] F-03-073: своё доп. поле локации показано — заполняю`);
    await customField.fill('demo-value');
  }

  // F-03-075: «Текст в виджете» показан клиенту
  const widgetText = await page.locator('[data-f="F-03-075"]').count();
  log(`[${tag}] F-03-075: «Текст в виджете» показан?`, widgetText > 0);

  // F-03-077: подтверждение номера по SMS — отправить код, вытащить из тоста, ввести
  const sendBtn = page.getByRole('button', { name: /Отправить код|Send code|Получить код|Get code/ }).first();
  if (await sendBtn.count()) {
    await sendBtn.click();
    await page.waitForTimeout(400);
    const toastText = await page.locator('body').innerText();
    const codeMatch = toastText.match(/(\d{4})\D*$/m) || toastText.match(/(\d{4})/);
    const code = codeMatch?.[1];
    log(`[${tag}] F-03-077: код из демо-тоста найден?`, Boolean(code), code);
    await shot(page, `${tag}-4b-code-sent`);
    if (code) {
      const codeInput = page.locator('input[maxlength="4"], input[inputmode="numeric"]').first();
      await codeInput.fill('0000');
      await page.getByRole('button', { name: /Подтвердить код|Verify code|Подтвердить|Verify/ }).first().click();
      await page.waitForTimeout(300);
      const bodyAfterWrong = await page.locator('body').innerText();
      log(`[${tag}] F-03-077: неверный код даёт ошибку?`, /неверн|wrong|incorrect/i.test(bodyAfterWrong));
      await shot(page, `${tag}-4c-wrong-code`);
      await codeInput.fill(code);
      await page.getByRole('button', { name: /Подтвердить код|Verify code|Подтвердить|Verify/ }).first().click();
      await page.waitForTimeout(300);
      const verifiedText = await page.locator('body').innerText();
      log(`[${tag}] F-03-077: телефон подтверждён после верного кода?`, /подтвержд|verified/i.test(verifiedText));
    }
  } else {
    log(`[${tag}] F-03-077: !!! кнопка отправки кода не найдена`);
  }
  await shot(page, `${tag}-4d-verified`);

  // F-03-092: напоминание — доступно только после подтверждения телефона
  const reminderSelect = page.locator('[data-f="F-03-092"] select, [data-f="F-03-092"] button, [data-f="F-03-092"] [role=combobox]').first();
  const reminderEnabled = await reminderSelect.isEnabled().catch(() => null);
  log(`[${tag}] F-03-092: напоминание доступно (select не disabled)?`, reminderEnabled);

  // F-03-080: галочка согласия
  const consentBox = page.locator('[data-f*="F-03-080"] input[type=checkbox], [data-f*="F-03-080"] [role=checkbox]').first();
  await shot(page, `${tag}-4e-before-consent`);
  const submitBtn = page.getByRole('button', { name: /Записаться|Book|Sign up/ }).first();
  await submitBtn.click();
  await page.waitForTimeout(400);
  const bodyNoConsent = await page.locator('body').innerText();
  log(`[${tag}] F-03-080: без галочки согласия запись не создаётся (видна ошибка)?`, /соглас|consent|agree/i.test(bodyNoConsent));
  await shot(page, `${tag}-5-no-consent-error`);

  await consentBox.click();
  await page.waitForTimeout(150);
  await submitBtn.click();
  await page.waitForTimeout(1200);
  await shot(page, `${tag}-6-after-submit`);
  const bodyFinal = await page.locator('body').innerText();
  const created = /Запись создана|Booking confirmed|подтвержд|confirmed|Ожидание|Waiting/i.test(bodyFinal);
  log(`[${tag}] F-03-093/127: запись создана и виден статус ожидания/подтверждения?`, created);

  await ctx.close();
  return { tag, consoleErrs, created };
}

const run = async () => {
  const release = await acquireBrowserSlot();
  try {
    const browser = await chromium.launch();
    const results = [];
    for (const device of ['phone', 'desktop']) {
      for (const lang of ['ru', 'en']) {
        try {
          const r = await fullWizard(browser, { device, lang });
          results.push(r);
        } catch (e) {
          log(`[${device}-${lang}] !!! ИСКЛЮЧЕНИЕ:`, String(e));
          results.push({ tag: `${device}-${lang}`, error: String(e) });
        }
      }
    }
    await browser.close();
    log('\n=== ИТОГ ===');
    for (const r of results) {
      log(JSON.stringify(r));
    }
  } finally {
    release();
  }
};

run();

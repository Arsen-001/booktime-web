// Измеритель b04-m0: вход в кабинет (F-03-109), «Мои записи» (F-03-110), лояльность в кабинете (F-03-111),
// смена языка и выход (F-03-112/113); пакет услуг и несколько услуг в записи (F-03-089/130); групповое событие
// (F-03-076/101/102); оплата в виджете (F-03-094/095/096); отзывы/промо/абонемент-кнопка (F-03-105/106/107).
// node qa/scenarios/online/b04-m0-cabinet-wizard.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/b04-m0';

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

const run = async () => {
  const release = await acquireBrowserSlot();
  try {
    const browser = await chromium.launch();

    // --- 1. Кабинет: вход по телефону+код (F-03-109) ---
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      const consoleErrs = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
      page.on('pageerror', (e) => consoleErrs.push(String(e)));
      await page.goto(`${BASE}/b/nuri-nail-studio/me?persona=guest&lang=ru`);
      await page.waitForTimeout(600);
      await shot(page, '01-cabinet-login');
      await page.getByPlaceholder('91 234 567').fill('00160001'); // демо-клиент au_01, +37400160001 — есть записи у nuri
      await page.getByRole('button', { name: 'Получить код' }).click();
      await page.waitForTimeout(400);
      const toastText = await page.locator('text=Демо-код').first().innerText();
      const code = toastText.match(/(\d{4})\s*$/)?.[1];
      console.log('[cabinet] код из тоста:', code);
      if (!code) throw new Error('код не найден: ' + toastText);
      await page.locator('input[maxlength="4"], input[inputmode="numeric"]').first().fill(code);
      await page.getByRole('button', { name: 'Подтвердить' }).click();
      await page.waitForTimeout(600);
      await shot(page, '02-cabinet-loggedin');
      const body = await page.textContent('body');
      console.log('[F-03-110] заголовок «Мои записи» есть?', /Мои записи/i.test(body || ''));
      console.log('[F-03-111] секция лояльности видна?', /абонемент|сертификат/i.test(body || ''));

      // F-03-113: смена языка на английский
      await page.locator('button', { hasText: 'EN' }).first().click();
      await page.waitForTimeout(700);
      await shot(page, '03-cabinet-en');
      const bodyEn = await page.textContent('body');
      console.log('[F-03-113] после переключения виден английский текст (My bookings)?', /My bookings|My records/i.test(bodyEn || ''));

      // F-03-112: перезагрузка страницы — сессия должна остаться (сохранённый вход), проверяем persist
      await page.reload();
      await page.waitForTimeout(1500);
      const bodyReload = await page.textContent('body');
      console.log('[persist] после reload остаёмся залогинены (не форма входа)?', !/Get code|Получить код/i.test(bodyReload || ''));
      await shot(page, '04-cabinet-after-reload');

      // F-03-112: выход
      const logoutBtn = page.getByRole('button', { name: /Log out|Выйти/ });
      await logoutBtn.click();
      await page.waitForTimeout(400);
      await shot(page, '05-cabinet-after-logout');
      const bodyLogout = await page.textContent('body');
      console.log('[F-03-112] после выхода видна форма входа?', /Get code|Получить код/i.test(bodyLogout || ''));
      console.log('[cabinet] console errors:', consoleErrs);
      await ctx.close();
    }

    // --- 2. Права: другая персона (guest без входа) не видит записи чужого телефона ---
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/b/nuri-nail-studio/me?persona=guest&lang=ru`);
      await page.waitForTimeout(500);
      const body = await page.textContent('body');
      console.log('[права] новый анонимный визит видит форму входа (не чужие записи)?', /Получить код|Телефон/i.test(body || ''));
      await ctx.close();
    }

    // --- 3. Booking wizard: несколько услуг (F-03-089), пакет (F-03-130), оплата (F-03-094/095/096) ---
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      const consoleErrs = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
      await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&sphere=nails&lang=ru`);
      await page.waitForTimeout(700);
      await shot(page, '06-wizard-step1-services');
      const step1 = await page.textContent('body');
      console.log('[F-03-089] можно выбрать несколько услуг — чекбоксы/плюсы на шаге услуг?', /\+|Добавить/i.test(step1 || ''));
      console.log('[F-03-130] есть карточка пакета/комплекса на шаге услуг?', /комплекс|пакет/i.test(step1 || ''));
      console.log('[wizard] console errors on step1:', consoleErrs);
      await ctx.close();
    }

    // --- 4. Групповые события (F-03-076/101/102) ---
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      // групповые обычно у сферы fitness — пробуем публичную страницу с группами, если бизнес имеет их
      await page.goto(`${BASE}/b/arman-fit?persona=guest&sphere=fitness&lang=ru`);
      await page.waitForTimeout(700);
      await shot(page, '07-public-arman-fit');
      const body = await page.textContent('body');
      console.log('[F-03-101] есть группа/событие на публичной странице arman-fit?', /групп/i.test(body || ''));
      await ctx.close();
    }

    // --- 5. Публичная страница: отзывы (F-03-105), промо (F-03-106), кнопка абонементов/сертификатов (F-03-107) ---
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/b/nuri-nail-studio?persona=guest&sphere=nails&lang=ru`);
      await page.waitForTimeout(700);
      await shot(page, '08-public-desktop');
      const body = await page.textContent('body');
      console.log('[F-03-105] отзывы/рейтинг видны на публичной странице?', /отзыв|рейтинг|★|⭐/i.test(body || ''));
      console.log('[F-03-106] промоблок видим?', /промо|акци/i.test(body || ''));
      console.log('[F-03-107] кнопка покупки абонемента/сертификата видна?', /Купить абонемент|Купить сертификат/i.test(body || ''));
      await ctx.close();
    }

    await browser.close();
  } finally {
    release();
  }
};

run().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});

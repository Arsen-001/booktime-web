// Сквозная запись гостя в моковом режиме (sweep 04.10.2026):
// гость открывает страницу салона → услуга → мастер → время → телефон → код 0000 → запись;
// затем тот же человек видит её в «Моих записях» (/bookings).
//   node qa/scenarios/client-sweep-book-e2e.mjs [--device phone|desktop] [--lang ru|hy|en]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const device = arg('device', 'phone');
const lang = arg('lang', 'ru');
const BASE = 'http://localhost:3710';
const SLUG = 'nuri-nail-studio';
const shots = `qa/shots/client/sweep-e2e-${device}-${lang}`;
fs.mkdirSync(shots, { recursive: true });

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const problems = [];
let ok = false;
try {
  const ctx = await browser.newContext(
    device === 'phone'
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  );
  const page = await ctx.newPage();
  // дев-сервер общий и бывает медленным — ждём дольше обычных 30 с
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(60_000);
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || /i18n:(missing|no-en)/.test(m.text())) problems.push(`console ${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  let n = 0;
  const shot = async (name) => page.screenshot({ path: `${shots}/${String(++n).padStart(2, '0')}-${name}.png` });
  const step = (s) => console.log(`→ ${s}  (${page.url().replace(BASE, '')})`);

  await page.goto(`${BASE}/b/${SLUG}?demo=guest&sphere=nails&lang=${lang}&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('salon');
  step('страница салона');

  // 1. Записаться со страницы салона
  await page.locator(`a[href*="/b/${SLUG}/book"]:visible`).last().click();
  await page.waitForURL(/\/book/, { timeout: 90000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await shot('wizard-start');
  step('мастер записи');

  // Тип записи (если спрашивает) — индивидуальная
  const radios = page.locator('main [role=radio]:not([data-f*="F-03-113"] [role=radio])');
  const cont = () => page.locator('button:not([disabled])').filter({ hasText: /^(Продолжить|Շարունակել|Continue)/ }).last();

  for (let i = 0; i < 8; i++) {
    const url = page.url();
    const body = await page.locator('main').innerText().catch(() => '');
    const phoneField = page.locator('input[type=tel]');
    if (await phoneField.isVisible().catch(() => false)) break;
    // время
    const slot = page.locator('button').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).first();
    if (url.includes('step=staff')) {
      // мастер — карточка-кнопка с именем; берём первого настоящего (не «Любой мастер»)
      const card = page.locator('main button').filter({ hasText: /Ани Саргсян|Անի Սարգսյան|Ani Sargsyan/ }).first();
      await card.click();
      step('выбран мастер');
      await page.waitForTimeout(700);
      // окно «только женщины» и т. п. — подтверждаем
      const ok = page.getByRole('button', { name: /Понятно|Հասկանալի է|Got it|OK/ }).first();
      if (await ok.isVisible().catch(() => false)) await ok.click();
    } else if (await slot.isVisible().catch(() => false)) {
      await slot.click();
      step(`выбрано время ${(await slot.innerText()).trim()}`);
    } else if (await page.locator('main').getByRole('checkbox').first().isVisible().catch(() => false)) {
      // услуги — чекбоксы: отмечаем первую, если ещё ничего не выбрано
      const boxes = page.locator('main').getByRole('checkbox');
      const anyChecked = (await page.locator('main [role=checkbox][aria-checked=true], main input[type=checkbox]:checked').count()) > 0;
      if (!anyChecked) {
        await boxes.first().click();
        step('выбрана услуга (checkbox)');
      }
    } else if ((await radios.count()) > 0) {
      const r = radios.first();
      await r.click();
      step(`выбрано: ${(await r.innerText()).split('\n')[0].slice(0, 60)}`);
    }
    await page.waitForTimeout(300);
    const c = cont();
    if (await c.isVisible().catch(() => false)) {
      await c.click();
      await page.waitForTimeout(700);
    }
    await shot(`step-${i}`);
    if (page.url() === url && body === (await page.locator('main').innerText().catch(() => ''))) {
      problems.push(`шаг ${i} не сдвинулся: ${url}`);
      break;
    }
  }

  // 2. Данные и код
  await page.locator('input[type=tel]').first().fill('77123456');
  const nameInput = page.locator('input[autocomplete="name"], input[name="name"]').first();
  if (await nameInput.isVisible().catch(() => false)) await nameInput.fill('Тест Тестов');
  const consent = page.getByRole('checkbox');
  for (let i = 0; i < (await consent.count()); i++) {
    const c = consent.nth(i);
    if ((await c.getAttribute('aria-checked')) === 'false' || !(await c.isChecked().catch(() => true))) await c.click().catch(() => {});
  }
  await shot('details');
  await page.getByRole('button', { name: /Получить код|Ստանալ կոդ|Get code|Get the code/ }).first().click();
  await page.waitForTimeout(800);
  await shot('code-sent');
  step('код отправлен');
  const codeInput = page.locator('input[inputmode="numeric"]:not([type=tel]), input[autocomplete="one-time-code"]').first();
  if (await codeInput.isVisible().catch(() => false)) {
    await codeInput.fill('0000');
    step('введён код 0000');
  } else {
    console.log('поле кода не появилось: ', (await page.locator('main').innerText()).match(/Номер подтвержд[её]н|Код отправлен[^\n]*/)?.[0]);
  }
  await page.waitForTimeout(400);
  const confirm = page.getByRole('button', { name: /^(Записаться|Գրանցվել|Book)$/ }).last();
  await confirm.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${shots}/after-confirm-full.png`, fullPage: true });
  await shot('done');
  step('после подтверждения');
  const doneText = await page.locator('main').innerText();
  const bookedTitle = doneText.split('\n').slice(0, 6).join(' | ');
  console.log('экран после записи:', bookedTitle);

  // 3. «Мои записи»
  await page.goto(`${BASE}/bookings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot('bookings');
  // Гость ещё не вошёл в приложение — входит тем же номером (код 0000) и попадает обратно в «Мои записи»
  const loginLink = page.locator('main a[href^="/login"]').first();
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
    await page.waitForURL(/\/login/);
    await page.waitForLoadState('networkidle');
    await page.locator('input[autocomplete="given-name"]').fill('Тест Тестов');
    await page.locator('input[type=tel]').fill('77123456');
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: /Получить код|Ստանալ կոդը|Get code/ }).click();
    await page.waitForTimeout(800);
    const code = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]:not([type=tel])').first();
    if (await code.isVisible().catch(() => false)) await code.fill('0000');
    await page.waitForTimeout(2500);
    step('вход по номеру');
    if (!page.url().includes('/bookings')) await page.goto(`${BASE}/bookings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot('bookings-after-login');
  }
  const list = await page.locator('main').innerText();
  ok = /Nuri|Нури/i.test(list);
  console.log('в /bookings есть запись салона:', ok);
  console.log(list.split('\n').slice(0, 15).join(' | '));
} catch (e) {
  problems.push(`упал: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  release();
}
console.log(problems.length ? `ПРОБЛЕМЫ:\n${[...new Set(problems)].join('\n')}` : 'без ошибок консоли и сети');
console.log(ok ? 'ИТОГ: OK' : 'ИТОГ: НЕ ПРОШЛО');

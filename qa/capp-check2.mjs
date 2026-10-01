// Проверка кликами: язык Հայ в профиле, отзыв о месте после визита (режим «оценка + текст»), удаление аккаунта.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../scripts/pw-slots.mjs';
const B = 'http://localhost:3710';
const shots = process.argv[2];
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
page.setDefaultTimeout(60000);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) process.exitCode = 1; };
try {
  // 1. Язык
  await page.goto(`${B}/profile?demo=client&lang=ru&empty=0`);
  await page.getByRole('button', { name: 'Հայերեն' }).or(page.getByRole('radio', { name: 'Հայերեն' })).first().click();
  await page.waitForFunction(() => document.documentElement.lang === 'hy', null, { timeout: 20000 });
  const hyOk = await page.waitForFunction(() => /Պրոֆիլ/.test(document.querySelector('h1')?.textContent ?? ''), null, { timeout: 30000 }).then(() => true, () => false);
  ok(hyOk, 'профиль переключён на армянский (Հայ в переключателе)');
  await page.getByRole('button', { name: 'Русский' }).or(page.getByRole('radio', { name: 'Русский' })).first().click();
  await page.waitForFunction(() => /Профиль/.test(document.querySelector('h1')?.textContent ?? ''), null, { timeout: 30000 });
  // 2. Отзыв о месте: владелец Kaytsak включает «оценка + текст»
  await page.goto(`${B}/biz/online/settings?demo=owner&sphere=nails&lang=ru&empty=0`);
  const textMode = page.getByRole('radio', { name: /Оценка/ }).or(page.getByRole('button', { name: /Оценка/ })).first();
  await textMode.click(); await page.getByText(/Сохранено|сохранен/i).first().waitFor({ timeout: 20000 }).then(() => ok(true, 'владелец Nuri включил «оценка + текст»'), () => ok(false, 'режим отзывов сохранён'));
  await page.goto(`${B}/bookings?demo=client&lang=ru&empty=0`);
  await page.getByRole('radio', { name: 'Прошедшие' }).click();
  const past = page.locator('main div:not([hidden]) > ul a[href^="/bookings/"]');
  const n = await past.count();
  let found = false;
  for (let i = 0; i < n && !found; i++) {
    await page.goto(`${B}/bookings?demo=client&lang=ru&empty=0`);
    await page.getByRole('radio', { name: 'Прошедшие' }).click();
    await past.nth(i).click(); await page.waitForURL(/\/bookings\/bk/);
    await page.waitForTimeout(2500);
    found = await page.getByText('Отзыв о месте').isVisible();
  }
  ok(found, 'на прошедшем визите в салон с «оценка + текст» есть «Отзыв о месте»');
  if (found) {
    await page.getByRole('button', { name: 'Отправить отзыв' }).click();
    ok(await page.getByText('Напишите пару слов о месте').isVisible(), 'пустой отзыв: подсказка под полем');
    await page.getByLabel('Как вам салон?').fill('Капп: чисто и уютно');
    await page.getByRole('button', { name: 'Отправить отзыв' }).click();
    await page.getByText('Капп: чисто и уютно').waitFor();
    ok(true, 'отзыв сохранён и показан');
    const place = await page.locator('main a[href^="/places/"]').first().getAttribute('href');
    await page.goto(`${B}${place}?demo=client&lang=ru&empty=0`);
    await page.getByText('Капп: чисто и уютно').waitFor({ timeout: 20000 }).then(() => ok(true, 'отзыв виден на странице места'), () => ok(false, 'отзыв виден на странице места'));
    if (shots) await page.screenshot({ path: `${shots}/place-review.png`, fullPage: true });
  }
  // 3. Удаление аккаунта: новый клиент входит и удаляет себя
  await page.goto(`${B}/login?next=/profile&demo=guest&lang=ru&empty=0`);
  await page.getByLabel('Имя').fill('Капп Удаляемый');
  await page.locator('input[type="tel"]').fill('91 555 777');
  await page.getByText('Согласен с пользовательским').click();
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByRole('group').locator('input').first().pressSequentially('0000');
  await page.waitForURL(/\/profile/);
  await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить навсегда' }).click();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 });
  await page.goto(`${B}/profile`);
  await page.waitForTimeout(2000);
  ok(/Войти/.test(await page.locator('main').innerText()), 'после удаления — гость, профиль просит войти');
} catch (e) { console.log('✗ сбой', e.message.split('\n')[0]); if (shots) await page.screenshot({ path: `${shots}/check2-fail.png` }); process.exitCode = 1; }
ok(!errs.length, `ошибок страницы: ${errs.length} ${errs.slice(0, 2).join(' | ')}`);
await browser.close(); release();

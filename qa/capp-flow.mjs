// Сквозной прогон приложения клиента на телефоне: вход по коду → запись → «Мои записи» → журнал салона;
// поиск: фильтр живёт в адресе и возвращается «Назад». node qa/capp-flow.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const shots = process.argv[2];
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) process.exitCode = 1; };
const shot = async (n) => shots && page.screenshot({ path: `${shots}/${n}.png` });
try {
  // 1. Вход по коду гостем
  await page.goto(`${BASE}/login?next=/bookings&demo=guest&lang=ru&empty=0`);
  await page.getByRole('button', { name: 'Получить код' }).click();
  ok(await page.getByText('Введите имя').isVisible(), 'пустая форма: под полем видно «Введите имя»');
  await page.getByLabel('Имя').fill('Капп Тестов');
  await page.locator('input[type="tel"]').fill('91 555 123');
  await page.getByText('Согласен с пользовательским').click();
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByRole('group').locator('input').first().waitFor();
  await shot('flow-code');
  await page.getByRole('group').locator('input').first().pressSequentially('0000');
  await page.waitForURL(/\/bookings/, { timeout: 30000 });
  ok(true, 'четвёртая цифра сама входит и ведёт на next=/bookings');
  // 2. Запись к мастеру Kaytsak на ближайшее окно
  await page.goto(`${BASE}/masters/st_kaytsak_erik`);
  const slot = page.locator('a[href^="/book?staff=st_kaytsak_erik&slot="]').first();
  const href = await slot.getAttribute('href');
  const start = decodeURIComponent(href.match(/slot=([^&]+)/)[1]);
  await slot.click();
  await page.waitForURL(/\/book\?/);
  const confirmBtn = page.getByRole('button', { name: /Записаться|Подтвердить запись/ }).last();
  await confirmBtn.waitFor();
  await shot('flow-confirm');
  await confirmBtn.click();
  await page.getByText(/Готово|Вы записаны|Запись создана|Заявка отправлена/).first().waitFor({ timeout: 30000 });
  await shot('flow-done');
  ok(true, `запись создана на ${start}`);
  await page.goto(`${BASE}/bookings`);
  await page.locator('a[href^="/bookings/"]').first().waitFor();
  ok((await page.locator('main').innerText()).includes(start.slice(11, 16)), 'запись видна в «Моих записях»');
  // 3. Поиск: фильтр в адресе, «Назад» возвращает выбор
  await page.goto(`${BASE}/search`);
  await page.getByRole('button', { name: 'Свободно завтра' }).click();
  await page.waitForFunction(() => location.search.includes('free=tomorrow'));
  ok(true, 'фильтр «завтра» записан в адрес');
  await page.locator('a[href^="/masters/"]').nth(1).click();
  await page.waitForURL(/\/masters\//);
  await page.getByRole('link', { name: 'К поиску' }).click();
  await page.waitForURL(/\/search/);
  ok(page.url().includes('free=tomorrow'), `«К поиску» вернул фильтр (${page.url().replace(BASE, '')})`);
  ok((await page.getByRole('button', { name: 'Свободно завтра' }).getAttribute('aria-pressed')) === 'true', 'чип «Свободно завтра» снова выбран');
  // 4. Журнал салона видит запись
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=barber&date=${start.slice(0, 10)}`);
  await page.waitForTimeout(6000);
  await shot('flow-journal');
  const txt = await page.locator('body').innerText();
  ok(/Капп/.test(txt), 'в журнале салона есть клиент «Капп Тестов»');
} catch (e) {
  console.log('✗ сбой:', e.message.split('\n')[0]);
  await shot('flow-fail');
  process.exitCode = 1;
}
ok(errs.length === 0, `ошибок страницы: ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); release();

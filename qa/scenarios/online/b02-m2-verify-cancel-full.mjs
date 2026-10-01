// Разовый проверочный скрипт измерителя b02-m2: полный флоу код→запись→отмена→«Записаться ещё».
// Нужен отдельно от measure.mjs, т.к. код подтверждения теперь случайный и приходит в тексте тоста —
// стандартные JSON-сценарии (click/fill/wait) не умеют читать текст со страницы и подставлять его в поле.
// node qa/scenarios/online/b02-m2-verify-cancel-full.mjs
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/b02-m2/scn-cancel-full';

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&sphere=nails&lang=ru`);
  await page.waitForTimeout(800);
  await page.getByText('Маникюр классический').click();
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await page.waitForTimeout(300);
  await page.getByText('Гаяне Оганесян').click();
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: /^\d{1,2}:\d{2}$/ }).nth(2).click();
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Введите имя').fill('Отмена ФуллТест');
  await page.getByPlaceholder('91 234 567').fill('91234599');
  await page.getByText('Записываясь, вы соглашаетесь').click();
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.waitForTimeout(400);
  const toastText = await page.locator('text=Демо-код').first().innerText();
  const code = toastText.match(/(\d{4})\s*$/)?.[1];
  console.log('code:', code, '| toast:', toastText);
  if (!code) throw new Error('код не найден в тосте: ' + toastText);
  await page.locator('input[maxlength="4"], input[inputmode="numeric"]').first().fill(code);
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/01-verified.png` });
  await page.getByRole('button', { name: /Записаться/ }).last().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/02-created.png` });
  const bodyAfterCreate = await page.textContent('body');
  console.log('создана?', /Вы записаны|записан/i.test(bodyAfterCreate || ''));
  // Отмена
  const cancelBtn = page.locator('button', { hasText: 'Отменить' });
  await cancelBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03-cancel-confirm.png` });
  const confirmBtn = page.getByRole('button', { name: /Да, отменить|Отменить запись|Подтвердить/ }).last();
  await confirmBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/04-cancelled.png` });
  const bodyAfterCancel = await page.textContent('body');
  console.log('статус отменена?', /Запись отменена/i.test(bodyAfterCancel || ''));
  console.log('кнопка «Записаться ещё» есть?', /Записаться ещё/i.test(bodyAfterCancel || ''));
  // Клик по «Записаться ещё» уводит на /book
  const again = page.getByText('Записаться ещё');
  await again.click();
  await page.waitForTimeout(600);
  console.log('url после клика:', page.url());
  await page.screenshot({ path: `${OUT}/05-after-book-again-click.png` });
  await browser.close();
};

run().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});

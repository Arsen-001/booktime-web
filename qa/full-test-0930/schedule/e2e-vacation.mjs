// Решение владельца 01.10: отпуск не двигает записи сам — список задетых (с повторяющимися) + «Перенести к…» / «Отменить» по одной и для всех
import { ctx, go, shot } from './lib.mjs';
const STAFF = 'st_nuri_ani', DATES = ['2026-10-06', '2026-10-07', '2026-10-08'];
const log = (...a) => console.log(...a);
export async function run(b) {
  const { page, errors } = await ctx(b);
  await go(page, '/biz/schedule');
  const cell = (d) => page.locator(`[data-cell="${STAFF}|${d}"]:visible`);
  for (let k = 0; k < 3 && !(await cell(DATES[0]).count()); k++) {
    await page.getByRole('button', { name: 'Следующий период' }).first().click();
    await page.waitForTimeout(1200);
  }
  for (const d of DATES) { log('[cell before]', d, (await cell(d).innerText()).replace(/\n/g, ' ')); await cell(d).click(); }
  await page.getByRole('button', { name: /Отсутствие/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('dialog').getByRole('button', { name: 'Отметить' }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'vac-1-affected');
  const dlg = page.getByRole('dialog');
  log('[notice]', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 700));
  log('[recurring badges]', await dlg.getByText('Повторяющаяся', { exact: true }).count());
  const allCancel = dlg.getByRole('button', { name: 'Отменить все с уведомлением' });
  log('[bulk cancel visible]', await allCancel.count(), '[bulk move]', await dlg.getByRole('combobox', { name: 'Перенести все к…' }).count());
  // одну — перенести по одной (первый свободный кандидат), остальные — «Отменить все»
  const firstSel = dlg.getByRole('combobox', { name: 'Перенести к…' }).first();
  if (await firstSel.isEnabled()) {
    await firstSel.click(); await page.waitForTimeout(500);
    const opt = page.getByRole('option').first(); log('[move one to]', await opt.innerText()); await opt.click(); await page.waitForTimeout(1500);
  }
  await allCancel.click(); await page.waitForTimeout(800);
  await shot(page, 'vac-2-confirm');
  const confirmBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Отменить все с уведомлением' }).or(page.getByRole('button', { name: 'Отменить все с уведомлением' }).last());
  await confirmBtn.last().click(); await page.waitForTimeout(2500);
  log('[toasts]', (await page.locator('[data-sonner-toast],[role=status]').allInnerTexts()).join(' | ').slice(0, 300));
  await shot(page, 'vac-3-resolved');
  log('[after bulk]', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await dlg.getByRole('button', { name: /Отметить|Сохранить/ }).last().click(); await page.waitForTimeout(2000);
  for (const d of DATES) log('[cell after]', d, (await cell(d).innerText()).replace(/\n/g, ' '));
  await shot(page, 'vac-4-saved');
  await go(page, `/biz/journal?date=${DATES[2]}`); await page.waitForTimeout(1500); await shot(page, 'vac-5-journal');
  log('[errors]', errors.slice(0, 6));
}

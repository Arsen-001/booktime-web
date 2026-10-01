// Повторяющиеся записи в списке задетых отпуском — метка «Повторяющаяся»
import { ctx, go, shot } from './lib.mjs';
const STAFF = 'st_nuri_ani', DATES = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
const log = (...a) => console.log(...a);
export async function run(b) {
  const { page, errors } = await ctx(b);
  await go(page, '/biz/schedule/series');
  await page.waitForTimeout(1500);
  log('[series]', (await page.innerText('main')).replace(/\s+/g, ' ').slice(0, 400));
  await go(page, '/biz/schedule');
  const cell = (d) => page.locator(`[data-cell="${STAFF}|${d}"]:visible`);
  for (let k = 0; k < 4 && !(await cell(DATES[0]).count()); k++) {
    await page.getByRole('button', { name: 'Следующий период' }).first().click();
    await page.waitForTimeout(1200);
  }
  for (const d of DATES) await cell(d).click();
  await page.getByRole('button', { name: /Отсутствие/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('dialog').getByRole('button', { name: 'Отметить' }).click();
  await page.waitForTimeout(2500);
  const dlg = page.getByRole('dialog');
  const badges = dlg.getByText('Повторяющаяся', { exact: true });
  log('[recurring badges]', await badges.count());
  if (await badges.count()) await badges.first().scrollIntoViewIfNeeded();
  await shot(page, 'vac-6-series');
  log('[notice]', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 500));
  await dlg.getByRole('button', { name: 'Отмена', exact: true }).click();
  log('[errors]', errors.slice(0, 6));
}

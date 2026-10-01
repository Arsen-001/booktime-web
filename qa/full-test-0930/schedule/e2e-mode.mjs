// F-00-051/054: мастер-индивидуал меняет режим календаря → окна онлайн-записи; «Открыть весь день»; «В отпуске до…»
import { withBrowser, ctx, go, shot } from './lib.mjs';
const D = '2026-10-09';
const log = (...a) => console.log(...a);
async function slots(page, tag, d = D) {
  await go(page, `/b/mariam-nails/book?step=time&s=sv_mar_plain&m=st_mariam&d=${d}`);
  await page.waitForTimeout(1500);
  await shot(page, `mode-${tag}-online`);
  const times = await page.$$eval('button', (bs) => bs.map((b) => b.innerText.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)));
  log(`[online ${tag}]`, times.length, times.slice(0, 3).join(','), '…', times.slice(-2).join(','));
  return times;
}
export async function run(b) {
  const { page, errors } = await ctx(b, { persona: 'individual' });
  await slots(page, '0');
  await go(page, '/biz/schedule/calendar');
  await shot(page, 'mode-1-calendar');
  const mainTxt = await page.innerText('main');
  log('[calendar]', JSON.stringify(mainTxt.slice(0, 900)));
  async function setMode(label) {
    await page.waitForTimeout(3000);
    await shot(page, 'mode-before-change');
    for (const n of ['Закрыть']) { const x = page.getByRole('button', { name: n, exact: true }); if (await x.count()) { log('[closing overlay]', n); await x.first().click().catch(() => {}); } }
    await page.getByRole('button', { name: 'Изменить' }).first().click({ timeout: 20000 }).catch(async (e) => { log('[Изменить blocked]', e.message.split('\n').slice(-3).join(' ')); await page.getByRole('button', { name: 'Изменить' }).first().click({ force: true }); });
    await page.waitForTimeout(800);
    await page.getByRole('dialog').getByText(label, { exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Готово/ }).click();
    await page.waitForTimeout(1500);
    log('[toast]', (await page.locator('[data-sonner-toast],[role=status]').allInnerTexts()).join(' | ').slice(0, 200));
  }
  await setMode('Всё занято');
  await shot(page, 'mode-2-busy');
  log('[after busy]', JSON.stringify((await page.innerText('main')).slice(0, 500)));
  await slots(page, '2-busy');
  await go(page, '/biz/schedule/calendar');
  await setMode('Всё свободно');
  await shot(page, 'mode-3-free');
  await slots(page, '3-free-again');
  log('[errors]', errors.slice(0, 8));
}

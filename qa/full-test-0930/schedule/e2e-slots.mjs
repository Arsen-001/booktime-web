// F-02-041…055: окна для онлайн-записи мастера → слоты клиента; закрытые дни
import { ctx, go, shot } from './lib.mjs';
const STAFF = 'st_nuri_ani', D = '2026-10-08', SVC = 'sv_nuri_remove';
const log = (...a) => console.log(...a);
async function slots(page, tag) {
  await go(page, `/b/nuri-nail-studio/book?step=time&s=${SVC}&m=${STAFF}&d=${D}`);
  await page.waitForTimeout(1500);
  await shot(page, `slots-${tag}-online`);
  const times = await page.$$eval('button', (bs) => bs.map((b) => b.innerText.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)));
  log(`[online ${tag}]`, times.length, times.join(','));
  return times;
}
export async function run(b) {
  const { page, errors } = await ctx(b);
  await slots(page, '0');
  await go(page, `/biz/schedule/slots/${STAFF}`);
  await shot(page, 'slots-1-screen');
  log('[screen]', (await page.innerText('main')).replace(/\s+/g, ' ').slice(0, 700));
  const own = page.getByRole('radio', { name: 'Свои правила' }).or(page.getByRole('button', { name: 'Свои правила' }));
  if (await own.count()) { await own.first().click(); await page.waitForTimeout(1500); }
  log('[toast]', (await page.locator('[data-sonner-toast],[role=status]').allInnerTexts()).join(' | ').slice(0, 200));
  const on = page.locator('button[aria-label="15:00: клиенты видят"]');
  log('[slot buttons on]', await on.count(), 'disabled:', await page.locator('button[aria-label$="клиенты видят"][disabled]').count());
  await shot(page, 'slots-2-own');
  if ((await on.count()) > 0) {
    const lbl = await on.first().getAttribute('aria-label');
    await on.first().click({ trial: false }).catch((e) => log('[click fail]', e.message.slice(0, 100)));
    await page.waitForTimeout(1200);
    log('[toggled]', lbl, '->', await page.locator(`button[aria-label^="${lbl.split(':')[0]}:"]`).first().getAttribute('aria-label'));
    await shot(page, 'slots-3-toggled');
    await slots(page, '3-after-toggle');
  }
  log('[errors]', errors.slice(0, 8));
}

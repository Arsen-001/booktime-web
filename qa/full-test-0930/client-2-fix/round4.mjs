// Второй заход (01.10): 12 ч в журнале и у клиента, места события без «Гость +1», напоминания по языку, новый сотрудник, сторис мастера
import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const one = (s, n = 400) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/biz/apps/stories', 'owner');
  const ot = await text(page);
  log('owner sees master story (от …):', /от [А-Я]/.test(ot), '| delete buttons:', await page.getByRole('button', { name: 'Снять сторис' }).count());
  const del = page.getByRole('button', { name: 'Снять сторис' }).first();
  if (await del.count()) {
    const before = await del.count();
    await del.click(); await page.waitForTimeout(600);
    await page.getByRole('dialog').last().getByRole('button', { name: 'Снять сторис' }).click(); await page.waitForTimeout(1500);
    log('owner delete: before', before, 'after', await page.getByRole('button', { name: 'Снять сторис' }).count());
  }
  await shot(page, 'r2-stories-owner-phone');
  log('ERRORS', errors.filter((e) => !/favicon/.test(e)).slice(0, 5));
} catch (e) { console.error('FAIL', e.message); } finally { await done(); }

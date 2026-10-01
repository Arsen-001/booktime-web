// С6: «Вернул» у мастера → клиент видит «Предоплата возвращена» (замечание A координатора)
import { start, newPage, go, shot, text, hydrate } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page, ctx } = await newPage(browser);
  await go(page, '/bookings');
  const href = await page.locator('a[href^="/bookings/bk"]').first().getAttribute('href');
  const id = href.split('/').pop();
  await go(page, href);
  await page.getByRole('button', { name: 'Отменить запись' }).first().click();
  await page.waitForTimeout(800);
  await page.locator('[role=alertdialog],[role=dialog]').getByRole('button', { name: 'Отменить запись' }).click();
  await page.waitForTimeout(2500);
  const patch = (extra) =>
    page.evaluate(({ id, extra }) => {
      const k = 'bp-mock-db:core:bookings';
      const arr = JSON.parse(localStorage.getItem(k));
      if (!arr) return 'no key';
      const x = arr.find((y) => y.id === id);
      x.prepayment = { amount: 2100, paid: true, ...extra };
      localStorage.setItem(k, JSON.stringify(arr));
      return 'ok';
    }, { id, extra });
  log('patch1', await patch({ refundDue: 2100 }));
  await page.reload();
  await hydrate(page);
  log('pending:', JSON.stringify((await text(page)).match(/Предоплата[^\n]*\n[^\n]*/g)));
  log('patch2', await patch({ refundDue: 0, refundedAt: '2026-10-01T00:30' }));
  await page.reload();
  await hydrate(page);
  log('refunded:', JSON.stringify((await text(page)).match(/Предоплата[^\n]*\n[^\n]*/g)));
  await shot(page, 's6-refunded');
  await ctx.close();
} finally {
  await done();
}

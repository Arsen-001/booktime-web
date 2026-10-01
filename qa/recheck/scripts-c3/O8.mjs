import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online/settings');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'O8-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page, 'body')).slice(0, n);
await step('pause', async () => {
  const sw = page.getByRole('switch', { name: /Приостановить/ }).or(page.locator('main').getByRole('switch').first());
  console.log('switch', await sw.first().getAttribute('aria-checked')); await sw.first().click(); await page.waitForTimeout(1200);
  const al = page.locator('[role=dialog],[role=alertdialog]'); if (await al.count()) { console.log('dlg', (await al.last().innerText()).replace(/\n/g, ' | ').slice(0, 200)); await al.last().getByRole('button').last().click(); await page.waitForTimeout(1000); }
  console.log('toasts', await toasts(page), 'switch now', await sw.first().getAttribute('aria-checked'));
  await as(page, 'guest', '/b/nuri-nail-studio/book'); console.log('widget:', (await T(500)).replace(/\n/g, ' | '));
  await as(page, 'client', '/places/biz_nuri'); const t = await T(3000); console.log('client app place:', t.split('\n').filter(l => /Записаться|приостан|недоступ|пауз/i.test(l)).slice(0, 4));
  await as(page, 'client', '/book?business=biz_nuri'); console.log('client app book:', (await T(500)).replace(/\n/g, ' | '));
  await as(page, 'owner', '/biz/journal?new=1&staff=st_nuri_ani&date=2026-09-30&start=12:00'); console.log('journal window opens:', await page.locator('[role=dialog]').count());
});
await step('api-key', async () => {
  await as(page, 'owner', '/biz/online/widget');
  await page.getByRole('button', { name: 'Сгенерировать ключ' }).click(); await page.waitForTimeout(1200);
  const t = await T(8000); const i = t.indexOf('Свой виджет через API'); const k = t.slice(i, i + 300).replace(/\n/g, ' | '); console.log('after gen:', k, await toasts(page));
  await reload(page); const t2 = await T(8000); const j = t2.indexOf('Свой виджет через API'); console.log('after reload:', t2.slice(j, j + 300).replace(/\n/g, ' | '));
});
await stop();

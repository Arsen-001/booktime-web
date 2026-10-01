import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients?category=%D0%B0%D0%BB%D0%BB%D0%B5%D1%80%D0%B3%D0%B8%D1%8F');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'K4-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('category-filter', async () => { console.log((await T(3000)).split('\n').filter(l => /Найдено|клиент/.test(l)).slice(0, 3), 'rows', await page.locator('main tbody tr').count()); });
await step('edit-email-log', async () => {
  await go(page, '/biz/clients/cl_018');
  await page.getByRole('button', { name: 'Ещё' }).first().click(); await page.waitForTimeout(600);
  const items = await page.locator('[role=menuitem]').allInnerTexts(); console.log('menu', items);
  await page.getByRole('menuitem', { name: /Изменить|Редактировать/ }).first().click(); await page.waitForTimeout(1000);
  const dlg = page.locator('[role=dialog]').last(); const txt = await dlg.innerText(); console.log('sheet:', txt.replace(/\n/g,' | ').slice(0, 500));
  const email = dlg.locator('input[type=email], input[placeholder*="@"]'); console.log('email inputs', await email.count());
  await email.first().fill('elen.c3@example.com');
  await dlg.getByRole('button', { name: /Сохранить/ }).click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
  await go(page, '/biz/clients/log'); console.log('log:', (await T(1200)).replace(/\n/g,' | '));
});
await step('consent-refusal', async () => {
  await go(page, '/biz/clients/cl_018');
  await page.getByRole('tab', { name: 'О клиенте' }).click(); await page.waitForTimeout(800);
  let t = await T(8000); const i = t.indexOf('Согласие'); console.log('consent block:', t.slice(i, i + 200).replace(/\n/g,' | '));
  const b = page.getByRole('button', { name: /Отметить отказ|Отметить согласие/ }); console.log('btn', await b.count(), await b.first().innerText().catch(()=>''));
  await b.first().click(); await page.waitForTimeout(1200);
  if (await page.locator('[role=alertdialog],[role=dialog]').count()) { const d = page.locator('[role=alertdialog],[role=dialog]').last(); console.log('dlg', (await d.innerText()).replace(/\n/g,' | ')); await d.getByRole('button').last().click(); await page.waitForTimeout(1000); }
  console.log('toasts', await toasts(page));
  await reload(page); await page.getByRole('tab', { name: 'О клиенте' }).click(); await page.waitForTimeout(800);
  t = await T(8000); const j = t.indexOf('Согласие'); console.log('after reload:', t.slice(j, j + 200).replace(/\n/g,' | '));
});
await step('delete-client', async () => {
  const d0 = await db(page); const bks = d0.core.bookings.filter(b => b.clientId === 'cl_077'); console.log('cl_077 bookings', bks.length);
  await go(page, '/biz/clients/cl_077');
  await page.getByRole('button', { name: 'Ещё' }).first().click(); await page.waitForTimeout(600);
  console.log('menu', await page.locator('[role=menuitem]').allInnerTexts());
  await page.getByRole('menuitem', { name: /^Удалить клиента|^Удалить$/ }).first().click(); await page.waitForTimeout(800);
  const dlg = page.locator('[role=alertdialog],[role=dialog]').last(); console.log('dlg', (await dlg.innerText()).replace(/\n/g,' | ').slice(0, 400));
  await dlg.getByRole('button', { name: /Удалить/ }).last().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page), page.url());
  const d = await db(page); console.log('bookings after', d.core.bookings.filter(b => b.clientId === 'cl_077').length, 'client rec', JSON.stringify(d.core.clients.find(c => c.id === 'cl_077'))?.slice(0, 200));
  await go(page, '/biz/records'); const r = await T(30000); console.log('records mention Лиана Гаспарян:', (r.match(/Лиана Гаспарян/g) || []).length);
  await go(page, '/biz/clients/log'); console.log('log:', (await T(1200)).replace(/\n/g,' | '));
  await go(page, '/biz/clients/cl_077'); console.log('card after delete:', (await T(300)).replace(/\n/g,' | '));
});
await stop();

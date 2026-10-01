import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/records');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'J7-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('bulk-delete', async () => {
  const row = page.locator('main tbody tr').first(); const rt = (await row.innerText()).replace(/\s+/g, ' '); console.log('row0', rt);
  await row.locator('input[type=checkbox]').check(); await page.waitForTimeout(500);
  const del = page.getByRole('button', { name: /Удалить выбран/ }); console.log('del btn', await del.count());
  await del.first().click(); await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog],[role=alertdialog]').last(); console.log('dlg', (await dlg.innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await dlg.getByRole('button', { name: /Удалить/ }).last().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
  await page.getByRole('radio', { name: 'Отменённые', exact: true }).or(page.getByRole('button', { name: 'Отменённые', exact: true })).first().click(); await page.waitForTimeout(1200);
  const rows = await page.locator('main tbody tr').allInnerTexts(); console.log('cancelled rows', rows.length, rows.slice(0, 3).map(r => r.replace(/\s+/g, ' ')));
  const name = rt.split(' ')[1] + ' ' + rt.split(' ')[2];
  console.log('deleted row:', rows.filter(r => r.includes('Лилит Тадевосян') && r.includes('24.10.2026')).map(r => r.replace(/\s+/g,' ')));
});
await step('skip', async () => {
  await go(page, '/biz/journal/settings');
  await page.getByText('Расписание ресурсов', { exact: true }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Сохранить/ }).first().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page), page.url());
  await go(page, '/biz/journal'); await reload(page);
  const t = await T(3000); console.log('journal after reload:', t.split('\n').filter(l => /По ресурсам|По должностям|Ресурс|ресурс/.test(l)).slice(0, 6));
  await shot(page, 'J7-default-view');
});
await stop();

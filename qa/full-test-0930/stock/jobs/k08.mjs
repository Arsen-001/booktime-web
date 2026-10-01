const norm = (s) => s.replace(/[  ]/g, ' ');
async function findFin(t, p) {
  await t.go('owner', '/biz/finance');
  const sel = p.getByRole('combobox').filter({ hasText: /^10$/ }).last();
  await sel.click(); await p.waitForTimeout(300); await p.getByRole('option', { name: '100', exact: true }).click(); await t.settle(1500);
  const x = norm(await t.text());
  const m = x.match(/29\.09\.2026, 12:45[^]*?֏[^]*?֏/);
  return m ? m[0].replace(/\s+/g, ' ') : 'NOT FOUND';
}
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/operations?type=sale');
  const row = p.locator('main tr').filter({ hasText: 'Крем для рук' }).first();
  await row.getByRole('button', { name: /^\d+$/ }).click();
  await p.waitForURL(/operations\/op_/, { timeout: 60000 }); await t.settle(1000);
  log('doc', p.url());
  await p.getByRole('button', { name: 'Отменить продажу' }).click(); await p.waitForTimeout(700);
  await p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last().getByRole('button', { name: 'Отменить продажу' }).click();
  await t.settle(1500);
  log('doc after:', norm(await t.text()).match(/Эта продажа отменена[^\n]*/)?.[0]);
  log('finance after:', await findFin(t, p));
  await t.shot('k-finance-after-cancel');
  await t.go('owner', '/biz/stock');
  const s = p.locator('main input[type=search]:visible').first();
  await s.fill('Крем для'); await t.settle(1500);
  log('catalog cream:', norm(await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 60));
};

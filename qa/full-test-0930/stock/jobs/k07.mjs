const norm = (s) => s.replace(/[  ]/g, ' ');
async function findFin(t, p, log) {
  await t.go('owner', '/biz/finance');
  const sel = p.getByRole('combobox').filter({ hasText: /^10$/ }).last();
  await sel.click(); await p.waitForTimeout(300); await p.getByRole('option', { name: '100', exact: true }).click(); await t.settle(1500);
  const x = norm(await t.text());
  const m = x.match(/29\.09\.2026, 12:45[^]*?֏[^]*?֏/);
  return m ? m[0].replace(/\s+/g, ' ') : 'NOT FOUND';
}
export default async (t, log) => {
  const p = t.page;
  log('finance before:', await findFin(t, p, log));
  await t.go('owner', '/biz/stock/operations?type=sale');
  const row = p.locator('main tr').filter({ hasText: 'Крем для рук' }).first();
  await row.locator('td').nth(1).click(); await p.waitForTimeout(3000);
  log('url after row click', p.url());
};

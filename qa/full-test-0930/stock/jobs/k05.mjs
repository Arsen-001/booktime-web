const norm = (s) => s.replace(/[  ]/g, ' ');
const finRow = async (t, p) => { await t.go('owner', '/biz/finance'); const x = norm(await t.text()); const i = x.indexOf('9 800 ֏'); return i < 0 ? 'NOT FOUND' : x.slice(Math.max(0, i - 220), i + 30).replace(/\s+/g, ' '); };
export default async (t, log) => {
  const p = t.page;
  log('finance before:', await finRow(t, p));
  await t.go('owner', '/biz/stock/operations?type=sale');
  const rows = p.locator('main tr, main li, main [role=row]').filter({ hasText: 'Крем для рук' });
  log('rows', await rows.count());
  await rows.first().getByRole('button', { name: 'Показать' }).click().catch(async () => rows.first().click());
  await p.waitForTimeout(3000); log('url', p.url());
  const dlg = p.locator('[role=dialog]:visible').last();
  if (await dlg.count()) log('dialog:', norm(await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 300));
};

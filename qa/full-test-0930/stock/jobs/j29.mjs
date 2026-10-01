const norm = (s) => s.replace(/[  ]/g, ' ');
const rows = async (t) => norm(await t.text()).split('История изменений')[1]?.replace(/\s+/g,' ').slice(0, 170);
export default async (t, log) => {
  const p = t.page;
  await p.getByRole('button', { name: 'Сохранить изменения' }).click(); await p.waitForTimeout(2500);
  const top = p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last();
  if (await top.count()) { log('after save dialog:', norm(await top.innerText()).replace(/\n+/g,' | ').slice(0, 250)); }
  await t.go('owner', '/biz/stock/operations');
  log('ops after no-show first row:', await rows(t));
  // вернуть «Пришёл»
  await t.go('owner', '/biz/journal?booking=bk_4279'); await p.waitForTimeout(1500);
  const dlg = p.locator('[role=dialog]:visible').last();
  await dlg.getByText('Пришёл', { exact: true }).first().click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Сохранить изменения' }).click(); await p.waitForTimeout(2500);
  await t.go('owner', '/biz/stock/operations');
  log('ops after arrived again first row:', await rows(t));
};

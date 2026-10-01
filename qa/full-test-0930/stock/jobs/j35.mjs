const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  const facts = p.getByPlaceholder('не считали');
  const vals = ['2', '7', '10', '11'];
  for (let i = 0; i < 4; i++) { await facts.nth(i).fill(vals[i]); await facts.nth(i).press('Tab'); await p.waitForTimeout(400); }
  // Enter +1 поиском
  const s = p.getByPlaceholder(/Найти товар/);
  await s.fill('Бордо'); await s.press('Enter'); await p.waitForTimeout(800);
  log('after +1:', norm(await t.text()).match(/Гель-лак «Бордо»[^]*?Вскрытая/)?.[0].replace(/\n+/g,' | '));
  log('summary:', norm(await t.text()).match(/Расхождений[^]*?Обнулить/)?.[0].replace(/\n+/g,' '), norm(await t.text()).match(/Итоговое расхождение[^\n]*\n[^\n]*/)?.[0]);
  await t.shot('inventory-filled', true);
  await p.getByRole('button', { name: 'Провести' }).click(); await p.waitForTimeout(1000);
  const dlg = p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last();
  if (await dlg.count()) { log('confirm:', norm(await dlg.innerText()).replace(/\n+/g,' | ')); await dlg.getByRole('button').last().click(); }
  await t.settle(2000);
  log('after finalize:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 400));
  await t.go('owner', '/biz/stock/operations');
  log('ops top:', norm(await t.text()).split('История изменений')[1]?.replace(/\s+/g,' ').slice(0, 400));
};

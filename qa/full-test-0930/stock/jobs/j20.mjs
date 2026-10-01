const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await p.getByRole('combobox', { name: 'Со склада' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Товары' }).click(); await p.waitForTimeout(300);
  await p.getByRole('combobox', { name: 'На склад' }).click(); await p.waitForTimeout(300);
  log('to options', await p.getByRole('option').allInnerTexts());
  await p.getByRole('option', { name: 'Расходники' }).click();
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('мятн'); await p.waitForTimeout(1200); await q.press('Enter'); await p.waitForTimeout(800);
  await p.getByLabel(/^Количество/).first().fill('3');
  await p.getByRole('button', { name: 'Переместить' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new/move'), { timeout: 120000 }).catch(()=>log('no nav'));
  await t.settle(1000);
  log('move doc', p.url(), norm(await t.text()).replace(/\n+/g,' | ').slice(0, 500));
  const moveUrl = p.url();
  await t.go('owner', '/biz/stock/warehouses');
  log('warehouses:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 600));
  await t.go('owner', '/biz/stock');
  const s = p.locator('main input[type=search]:visible').first();
  await s.fill('мятн'); await t.settle(1500);
  await p.getByText('QA Гель-лак Мятный').first().click();
  await p.waitForURL(/goods\//, { timeout: 120000 }); await t.settle(1500);
  const ct = norm(await t.text()); const i = ct.indexOf('Остатки по складам');
  log('card levels:', ct.slice(i, i+200).replace(/\n+/g,' | '));
  // отмена перемещения
  await p.goto(moveUrl); await t.settle(1500);
  log('move doc buttons', await t.buttons());
  const cancelBtn = p.getByRole('button', { name: /Отменить перемещение/ });
  if (await cancelBtn.count()) {
    await cancelBtn.click(); await p.waitForTimeout(700);
    const dlg = p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last();
    await dlg.getByRole('button').last().click(); await t.settle(1500);
    log('after move cancel:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 300));
  }
};

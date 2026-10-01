const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  // 1) Отмена продажи
  await t.go('owner', '/biz/stock/operations/op_muon5spdsvqex8');
  await p.getByRole('button', { name: 'Отменить продажу' }).click(); await p.waitForTimeout(800);
  const dlg = p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last();
  log('cancel dialog:', norm(await dlg.innerText().catch(()=>'none')).replace(/\n+/g,' | ').slice(0,300));
  await dlg.getByRole('button').filter({ hasText: /Отменить продажу|Да|Подтвердить/ }).last().click().catch(e=>log('confirm fail', e.message.slice(0,80)));
  await t.settle(1500);
  log('after cancel URL', p.url(), norm(await t.text()).replace(/\n+/g,' | ').slice(0,300));
  await t.go('owner', '/biz/stock');
  const s = p.locator('main input[type=search]:visible').first();
  await s.fill('мятн'); await t.settle(1500);
  log('catalog after cancel:', norm(await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 60));
  await t.go('owner', '/biz/finance');
  const ft = norm(await t.text()); const i = ft.indexOf('поступления сегодня');
  log('finance today:', ft.slice(i, i+40).replace(/\s+/g,' '));
  // 2) Списание 1 шт (брак)
  await t.go('owner', '/biz/stock/operations/new/write-off');
  log('writeoff form:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 700));
  log(await p.evaluate(() => [...document.querySelectorAll('main input, main [role=combobox]')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim()+'='+(e.value||e.innerText))));
  await t.shot('writeoff-new', true);
};
